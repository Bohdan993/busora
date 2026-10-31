/** @format */

const crypto = require('crypto');
const path = require('path');
const os = require('os');
const fs = require('fs');
const puppeteer = require('puppeteer');
const QRCode = require('qrcode');
const pug = require('pug');
const { Op } = require('sequelize');
const logger = require('@services/loggerService');
const {
  loadLanguageFile,
  base64Encode,
  includeFunc,
  isSpecialDate,
  getConstantTranslation,
  transformTimestampToDate
} = require('@helpers');
const {
  sequelize,
  busflight: BusFlight,
  language: Language,
  passenger: Passenger,
  passengerticket: PassengerTicket,
  ticket: Ticket
} = require('@database/models/index');
const constants = require('@helpers/constants.js');
const { isSupportedLocale } = require('@root/config/market');

// uk_UA — see the reference-data migration
const DEFAULT_LANGUAGE_ID = 1;
const {
  convertEnumToMetaId,
  resolveMetaId,
  getMetaNameById,
  getMetaIdByKey
} = require('@services/ticketMetaService');
const { getExchangeRate } = require('@services/exchangeRates');

// Base Chrome flags. Note: NO fixed --user-data-dir here. A shared profile dir
// is what caused the 2026-07-10 outage: a render that hung on navigation left a
// leaked Chrome holding the profile's SingletonLock, after which every launch
// failed with "SingletonLock: File exists". Each render below gets its own
// throwaway profile dir instead, so one bad render can never poison the next.
const PDF_LAUNCH_ARGS = [
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-dev-shm-usage',
  '--disable-gpu',
  '--single-process',
  '--no-first-run',
  '--no-zygote',
  '--disable-extensions',
  '--disable-web-security',
  '--disable-features=VizDisplayCompositor'
];
// Bounded so a hanging resource fails fast (and is retried) instead of pinning
// a Chrome process for the full default 30s and leaking it.
const PDF_NAV_TIMEOUT_MS = 20000;
const PDF_MAX_ATTEMPTS = 2;

/**
 * Renders `html` to `pdfOptions.path` in an isolated, always-cleaned-up Chrome.
 * The browser is closed and the throwaway profile dir removed in `finally`
 * whether or not rendering succeeds — this is the guarantee html-pdf-node did
 * NOT give us (it only closed the browser on the success path).
 */
async function renderPdfWithBrowser(html, pdfOptions) {
  const userDataDir = await fs.promises.mkdtemp(
    path.join(os.tmpdir(), 'pptr-ticket-')
  );
  let browser = null;
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: [...PDF_LAUNCH_ARGS, `--user-data-dir=${userDataDir}`]
    });
    const page = await browser.newPage();
    page.setDefaultNavigationTimeout(PDF_NAV_TIMEOUT_MS);
    // 'load' — NOT 'networkidle0'. The ticket HTML is self-contained (QR code
    // and logo are embedded as data URIs), so waiting for network idle only
    // exposes us to a single stray external request hanging the whole render
    // (the exact 30s navigation timeout seen on 2026-07-10).
    await page.setContent(html, {
      waitUntil: 'load',
      timeout: PDF_NAV_TIMEOUT_MS
    });
    await page.pdf(pdfOptions);
  } finally {
    if (browser) {
      try {
        await browser.close();
      } catch {
        /* best-effort: never mask the original error with a close failure */
      }
    }
    fs.promises
      .rm(userDataDir, { recursive: true, force: true })
      .catch(() => {});
  }
}

async function generatePDFTicket({
  html,
  signature,
  ticketUpdateTimestamp
} = {}) {
  const pdfHash = crypto
    .createHash('sha256')
    .update(signature + ticketUpdateTimestamp)
    .digest('hex');
  const pdfName = pdfHash + '.pdf';
  const pdfPath = path.resolve('assets', 'tickets', pdfName);
  const pdfOptions = {
    path: pdfPath,
    margin: { top: '10px', bottom: '10px', left: '5px', right: '5px' },
    printBackground: true,
    format: 'A4'
  };

  // Make sure the output directory exists — a freshly-mounted (empty) volume
  // can shadow assets/tickets, and a missing dir makes the write fail.
  await fs.promises.mkdir(path.dirname(pdfPath), { recursive: true });

  // Retry once: a transient launch/navigation failure shouldn't drop a paid
  // customer's ticket. Each attempt is fully isolated (own profile dir, own
  // browser closed in finally), so a retry starts from a clean slate.
  let lastErr;
  for (let attempt = 1; attempt <= PDF_MAX_ATTEMPTS; attempt++) {
    try {
      await renderPdfWithBrowser(html, pdfOptions);
      return { pdfPath, pdfName };
    } catch (err) {
      lastErr = err;
      logger.warn(
        `[PDF] generate attempt ${attempt}/${PDF_MAX_ATTEMPTS} failed: ${err.message}`
      );
    }
  }
  throw lastErr;
}

async function generateHTMLTicket({
  languageCode = 'uk_UA',
  cities,
  signature,
  price,
  convertedPrice = 0,
  currencyAbbr,
  passengersInfoData,
  dates,
  places,
  ticket,
  constants,
  template = 'full-ticket.pug',
  transformTimestampToDate = () => {}
} = {}) {
  const ticketTemplate = path.resolve('views', template);
  const termsOfUsePath = path.resolve(
    'views',
    'ticket-terms-of-use',
    `${languageCode}.pug`
  );
  let newTicket = ticket;
  const transformedPassengersInfoData = passengersInfoData.map((el) => {
    const res = Object.entries(el?.[1]).reduce((acc, [key, value]) => {
      const newKey = key.replace(/-\d+$/, '');
      acc[newKey] = value;
      return acc;
    }, {});

    return [el?.[0], res];
  });

  // fs.writeFileSync(
  //   path.resolve(__dirname, "debug_transformedPassengersInfoData.json"),
  //   JSON.stringify(transformedPassengersInfoData, null, 2)
  // );

  if (typeof newTicket?.toJSON === 'function') {
    newTicket = newTicket.toJSON();
  }
  if (newTicket?.createdAt && typeof newTicket.createdAt !== 'string') {
    newTicket.createdAt = newTicket.createdAt.toISOString();
  }

  // Add localized type field for template compatibility
  if (newTicket?.typeId && !newTicket?.type) {
    newTicket.type =
      (await getMetaNameById(newTicket.typeId, languageCode)) ||
      getConstantTranslation(newTicket?.type);
  }

  // Sanitize route names to remove text in parentheses (deep copy to avoid mutation)
  const sanitizedPlaces = JSON.parse(JSON.stringify(places));
  if (sanitizedPlaces?.from?.routeName) {
    sanitizedPlaces.from.routeName = sanitizedPlaces.from.routeName
      .replace(/\s*\([^)]*\)/g, '')
      .trim();
  }

  if (sanitizedPlaces?.to?.routeName) {
    sanitizedPlaces.to.routeName = sanitizedPlaces.to.routeName
      .replace(/\s*\([^)]*\)/g, '')
      .trim();
  }

  return new Promise((res, rej) => {
    QRCode.toDataURL(
      JSON.stringify({
        signature,
        ticketNumber: newTicket.ticketNumber,
        timestamp: newTicket.updatedAt
      }),
      {
        color: {
          dark: '#005A87',
          light: '#FFFFFF'
        }
      },
      function (err, url) {
        if (err) rej(err);

        const ticketData = {
          qr: url,
          logo:
            'data:image/png;base64,' +
            base64Encode(path.resolve('assets', 'images', 'logo_busora.png')),
          translations: loadLanguageFile('_ticket.js', languageCode),
          constants,
          transformTimestampToDate,
          include:
            template === 'full-ticket.pug' ? includeFunc.bind(null, pug) : null,
          termsOfUsePath:
            template === 'full-ticket.pug' ? termsOfUsePath : null,
          data: {
            price,
            convertedPrice,
            currencyAbbr,
            passengersInfo: transformedPassengersInfoData,
            startDate: transformTimestampToDate(dates?.departurePure),
            endDate: dates?.returnPure
              ? transformTimestampToDate(dates?.returnPure)
              : null,
            origin:
              template === 'full-ticket.pug'
                ? cities?.from?.nameUkr
                : cities?.from?.name,
            destination:
              template === 'full-ticket.pug'
                ? cities?.to?.nameUkr
                : cities?.to?.name,
            ticket: newTicket,
            places: sanitizedPlaces
          }
        };

        try {
          const html = pug.renderFile(ticketTemplate, ticketData);
          res(html);
        } catch (err) {
          rej(err);
        }
      }
    );
  });
}

// The booking language travels in the payment `info` JSON (languageCode).
// Admin-created tickets carry no `info` and get the default language.
async function resolveBookingLanguageId(info) {
  const languageCode = info ? JSON.parse(info)?.languageCode : null;
  if (!isSupportedLocale(languageCode)) return DEFAULT_LANGUAGE_ID;

  const language = await Language.findOne({
    attributes: ['id'],
    where: { code: languageCode }
  });
  return language?.id ?? DEFAULT_LANGUAGE_ID;
}

async function createTicket({
  transactionId = null,
  signature,
  selectedBusFlight,
  children: numOfChildren,
  adults: numOfAdults,
  originId,
  destinationId,
  startDate,
  endDate,
  passengersInfo = null,
  passengers = null,
  status = constants.TICKET_STATUS_PAYED,
  data,
  type = null,
  exchangeRate: exchangeRateOverride = null
} = {}) {
  const { currency: currencyAbbr, amount: price, info } = JSON.parse(data);
  const languageId = await resolveBookingLanguageId(info);

  // Lock the UAH exchange rate at booking time (UAH → 1, CZK → live rate). The
  // ticket is stored in its display currency; priceUAH is the canonical UAH
  // amount used by the backend/admin/reporting. Never let a rate-lookup failure
  // block ticket creation (this runs after payment) — fall back to 1 and warn,
  // since priceUAH is then wrong for a non-UAH ticket. The caller may pass a
  // pre-resolved rate (admin create already fetched it to convert the UAH
  // inputs) so the same rate drives the stored price and priceUAH.
  let exchangeRate = 1;
  if (exchangeRateOverride != null) {
    exchangeRate = Number(exchangeRateOverride) || 1;
  } else {
    try {
      exchangeRate = await getExchangeRate(currencyAbbr);
    } catch (err) {
      logger.warn('Exchange rate unavailable at ticket creation; using 1', {
        currency: currencyAbbr,
        error: err.message
      });
      exchangeRate = 1;
    }
  }
  const priceUAH = Math.round((Number(price) || 0) * exchangeRate);

  // Normalize passengers: prefer the explicit array (admin create), otherwise
  // convert the legacy flattened passengersInfo (booking flow). The adapter
  // reads each passenger's index from its key, so children are no longer
  // mis-indexed when adults precede them.
  const passengerList = passengers?.length
    ? passengers
    : passengersInfoToArray(passengersInfo);

  // Convert ENUM values to meta IDs
  let ticketTypeId, ticketStatusId;

  const ticketType =
    type ??
    (isSpecialDate(endDate)
      ? Object.values(constants).find((el) => el === endDate)
      : constants.ROUND);

  // Resolve type to a meta ID. The admin UI sends the DB localized name, the
  // booking flow sends the enum key — resolveMetaId handles both (+ default).
  ticketTypeId = await resolveMetaId(ticketType, 'ticket_type');
  if (!ticketTypeId) {
    // Fallback to getting ID by key if conversion fails
    if (ticketType === constants.ONE_WAY) {
      ticketTypeId = await getMetaIdByKey('one_way');
    } else if (ticketType === constants.ROUND) {
      ticketTypeId = await getMetaIdByKey('round_trip');
    } else if (ticketType === constants.OPEN_DATE) {
      ticketTypeId = await getMetaIdByKey('open_date');
    }
  }

  // Resolve status to a meta ID (DB localized name or enum key; + default).
  ticketStatusId = await resolveMetaId(status, 'ticket_status');
  if (!ticketStatusId) {
    // Fallback to getting ID by key if conversion fails
    if (status === constants.TICKET_STATUS_NOT_PAYED) {
      ticketStatusId = await getMetaIdByKey('not_paid');
    } else if (status === constants.TICKET_STATUS_PAYED) {
      ticketStatusId = await getMetaIdByKey('paid');
    } else if (status === constants.TICKET_STATUS_HALF_USED) {
      ticketStatusId = await getMetaIdByKey('partially_used');
    } else if (status === constants.TICKET_STATUS_USED) {
      ticketStatusId = await getMetaIdByKey('used');
    }
  }

  const createOpts = {
    dateOfDeparture: startDate,
    dateOfReturn: isSpecialDate(endDate) || !endDate ? null : endDate,
    dateOfCreature: transformTimestampToDate(Date.now(), '-', 'yy mm dd'),
    busFlightFromId: selectedBusFlight?.busFlightFromId,
    busFlightToId: selectedBusFlight?.busFlightToId || null,
    price: price,
    priceUAH: priceUAH,
    exchangeRate: exchangeRate,
    // Use new meta system instead of ENUM
    typeId: ticketTypeId,
    statusId: ticketStatusId,
    currencyAbbr: currencyAbbr,
    originId: parseInt(originId),
    destinationId: parseInt(destinationId),
    languageId,
    signature: signature,
    transactionId: transactionId,
    hasDiscount: selectedBusFlight?.hasDiscount,
    discountPercentage: selectedBusFlight?.discountPercentage || 0
  };

  // A paid ticket with no passengers can never render a PDF (the generator
  // iterates passengers) and would be an unrecoverable paid orphan. This only
  // happens when the booking session data was lost before the callback ran —
  // never a valid state — so refuse to create anything at all.
  if (passengerList.length === 0) {
    throw new Error(
      `Refusing to create ticket for transaction ${
        transactionId ?? '(none)'
      } with zero passengers — booking session data was empty or lost.`
    );
  }

  // Ticket + its passenger rows + the seat decrement must be atomic. Before
  // this was transactional, any failure after Ticket.create left a committed
  // *paid* ticket with no passengers (the 2026-08-18 null.pdf incident): the
  // PDF generator then produced 0 files and every LiqPay callback retry tried
  // to open assets/tickets/null.pdf and re-alerted the admin. All-or-nothing.
  const transaction = await sequelize.transaction();
  let ticket;
  try {
    ticket = await Ticket.create(createOpts, { transaction });

    // Persist Passenger + PassengerTicket rows for every passenger, then free
    // up seats by the number booked. Adults are de-duplicated by identity;
    // children are always created fresh (matching the previous behaviour).
    const passengerTicketRows = await buildPassengerTicketRows(
      passengerList,
      ticket,
      transaction
    );

    // Every PassengerTicket carries its own price so that tickets.price is the
    // sum of them. When the caller didn't supply explicit per-passenger prices
    // (e.g. the booking flow), distribute the ticket amount across those rows
    // in proportion to each passenger's discounted fare (evenly when unknown),
    // so the invariant SUM(passenger price) === ticket.price still holds.
    const explicitSum = passengerTicketRows.reduce(
      (sum, row) => sum + (Number(row.price) || 0),
      0
    );
    const unpriced = passengerTicketRows.filter((row) => row.price == null);
    if (unpriced.length > 0) {
      // Booking-flow rows arrive without per-passenger prices. Distribute the
      // (already discounted) ticket amount across them so the invariant
      // SUM(passenger price) === ticket.price holds, and record each
      // passenger's net (pre-discount) price in paymentAtOffice. The booking
      // flow never has an on-bus payment, so the whole net price lives in
      // paymentAtOffice (paymentOnBus stays null). In this flow the booking
      // currency is the truth, so the UAH mirror columns are derived (× rate).
      const discountPct = Number(selectedBusFlight?.discountPercentage) || 0;
      const multiplier = 1 - discountPct / 100;
      const remaining = Math.max(0, Math.round(price) - explicitSum);
      // Rows are built in passengerList order
      const shares = splitAmount(
        remaining,
        unpriced.map(
          (row) => passengerList[passengerTicketRows.indexOf(row)]?.priceWeight
        )
      );
      unpriced.forEach((row, i) => {
        row.price = shares[i];
        row.paymentAtOffice =
          multiplier > 0 ? Math.round(row.price / multiplier) : row.price;
        if (row.paymentAtOfficeUAH == null && row.paymentAtOffice != null)
          row.paymentAtOfficeUAH = Math.round(
            Number(row.paymentAtOffice) * exchangeRate
          );
        if (row.paymentOnBusUAH == null && row.paymentOnBus != null)
          row.paymentOnBusUAH = Math.round(
            Number(row.paymentOnBus) * exchangeRate
          );
      });
    }

    // Per-passenger priceUAH: admin-created rows carry the UAH truth already;
    // booking-flow rows derive it from the distributed booking price, the last
    // such row absorbing the remainder so the distributed Σ stays exact.
    const needsUAH = passengerTicketRows.filter((row) => row.priceUAH == null);
    let assignedUAH = 0;
    needsUAH.forEach((row, i) => {
      row.priceUAH =
        i === needsUAH.length - 1
          ? priceUAH - assignedUAH
          : Math.round((Number(row.price) || 0) * exchangeRate);
      assignedUAH += row.priceUAH;
    });

    await PassengerTicket.bulkCreate(passengerTicketRows, { transaction });

    // Ticket totals are the sum of the (now-final) per-passenger amounts so the
    // SUM invariants hold exactly for both the admin (UAH-truth) and booking
    // (booking-truth) flows.
    const sumPrice = passengerTicketRows.reduce(
      (s, r) => s + (Number(r.price) || 0),
      0
    );
    const sumUAH = passengerTicketRows.reduce(
      (s, r) => s + (Number(r.priceUAH) || 0),
      0
    );
    if (sumPrice !== Number(createOpts.price) || sumUAH !== priceUAH) {
      await ticket.update(
        { price: sumPrice, priceUAH: sumUAH },
        { transaction }
      );
    }

    await BusFlight.decrement(
      { freeSeats: passengerList.length },
      {
        where: {
          [Op.or]: [
            { id: selectedBusFlight?.busFlightFromId || null },
            { id: selectedBusFlight?.busFlightToId || null }
          ]
        },
        transaction
      }
    );

    await transaction.commit();
  } catch (err) {
    await transaction.rollback();
    throw err;
  }

  await ticket.reload();
  return ticket;
}

/**
 * Splits an integer total into integer parts proportional to `weights`, using
 * largest-remainder rounding so the parts always sum exactly to the total.
 * If any weight is missing or not positive, the total is split evenly.
 */
function splitAmount(total, weights) {
  const hasWeights = weights.every((weight) => Number(weight) > 0);
  const effective = weights.map((weight) => (hasWeights ? Number(weight) : 1));
  const weightSum = effective.reduce((sum, weight) => sum + weight, 0);
  const exact = effective.map((weight) => (total * weight) / weightSum);
  const parts = exact.map(Math.floor);

  const remainder = total - parts.reduce((sum, part) => sum + part, 0);
  exact
    .map((value, index) => ({ fraction: value - Math.floor(value), index }))
    .sort((a, b) => b.fraction - a.fraction || a.index - b.index)
    .slice(0, remainder)
    .forEach(({ index }) => {
      parts[index] += 1;
    });
  return parts;
}

/**
 * Normalizes a submitted date of birth to "YYYY-MM-DD" (passenger.dateOfBirth
 * is DATEONLY). Accepts an ISO date string or epoch milliseconds (number or
 * numeric string — the old frontend's format); anything else becomes null.
 */
function toDateOnly(raw) {
  if (raw === null || raw === undefined || raw === '') return null;
  const isEpochMs = typeof raw === 'number' || /^\d+$/.test(String(raw));
  const date = new Date(isEpochMs ? Number(raw) : raw);
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
}

/**
 * Converts the legacy flattened `passengersInfo` object (built by the booking
 * flow and stored in the session) into a normalized passenger array. The index
 * is read from each entry's key (e.g. "child-passenger-3" → 3), so a child's
 * fields are read with the correct index even when adults precede them.
 */
function passengersInfoToArray(passengersInfo) {
  if (!passengersInfo) return [];

  return Object.entries(passengersInfo)
    .map(([key, val]) => {
      const match = /^(adult|child)-passenger-(\d+)$/.exec(key);
      if (!match) return null;
      const type = match[1];
      const n = match[2];

      const dateOfBirth = toDateOnly(val[`date-of-birth-${n}`]);

      return {
        type,
        name: val[`name-${n}`],
        lastName: val[`last-name-${n}`],
        phone: type === 'child' ? null : (val[`phone-${n}`] ?? null),
        additionalPhone: val[`phone-additional-${n}`] ?? null,
        email: val[`email-${n}`] ?? null,
        dateOfBirth,
        passengerDiscountId: parseInt(val[`discount-${n}`]) || null,
        discountPercentage:
          val[`discount-percentage-${n}`] ??
          val[`discount-percantage-${n}`] ??
          null,
        discountCardNumber: parseInt(val[`card-discount-${n}`]) || null,
        // This passenger's discounted fare in the booking currency, computed
        // at validation. Weights the split of the charged total across rows.
        priceWeight: Number(val[`discount-ticket-price-${n}`]) || null,
        // Booking flow never collects these admin-only fields.
        agentId: null,
        paymentAtOffice: null,
        paymentOnBus: null,
        confirmationId: null,
        busSeat: null,
        note: null
      };
    })
    .filter(Boolean);
}

/**
 * Builds PassengerTicket rows for a normalized passenger array, creating the
 * Passenger rows as needed. Adults are looked up by identity (phone + name +
 * lastName + dateOfBirth) and reused if found; children are always created.
 */
async function buildPassengerTicketRows(
  passengerList,
  ticket,
  transaction = null
) {
  return Promise.all(
    passengerList.map(async (p) => {
      const dateOfBirth = p?.dateOfBirth ?? null;
      let passenger;

      if (p?.type === 'child') {
        passenger = await Passenger.create(
          {
            name: p?.name || '',
            lastName: p?.lastName || '',
            phone: p?.phone ?? null,
            additionalPhone: p?.additionalPhone ?? null,
            dateOfBirth,
            email: p?.email ?? null,
            type: 'child'
          },
          { transaction }
        );
      } else {
        passenger = await Passenger.findOne({
          where: {
            phone: p?.phone ?? null,
            name: p?.name,
            lastName: p?.lastName,
            dateOfBirth
          },
          transaction
        });
        if (!passenger) {
          passenger = await Passenger.create(
            {
              name: p?.name,
              lastName: p?.lastName,
              phone: p?.phone ?? null,
              additionalPhone: p?.additionalPhone ?? null,
              dateOfBirth,
              email: p?.email ?? null,
              type: 'adult'
            },
            { transaction }
          );
        }
      }

      return {
        ticketId: ticket.id,
        passengerId: passenger.id,
        passengerDiscountId: parseInt(p?.passengerDiscountId) || null,
        discountCardNumber: parseInt(p?.discountCardNumber) || null,
        // discountPercentage is a child-only override in the existing schema.
        discountPercentage:
          p?.type === 'child' ? (p?.discountPercentage ?? null) : null,
        agentId: parseInt(p?.agentId) || null,
        // Booking-currency amounts (derived, for the customer-facing PDF) plus
        // the UAH amounts the admin actually entered (the stored truth).
        paymentAtOffice: p?.paymentAtOffice ?? null,
        paymentOnBus: p?.paymentOnBus ?? null,
        paymentAtOfficeUAH:
          p?.paymentAtOfficeUAH != null
            ? Math.round(Number(p.paymentAtOfficeUAH))
            : null,
        paymentOnBusUAH:
          p?.paymentOnBusUAH != null
            ? Math.round(Number(p.paymentOnBusUAH))
            : null,
        confirmationId: parseInt(p?.confirmationId) || null,
        busSeat: p?.busSeat ?? null,
        note: p?.note ?? null,
        price: p?.price != null ? Math.round(Number(p.price)) : null,
        priceUAH: p?.priceUAH != null ? Math.round(Number(p.priceUAH)) : null,
        PDFFileName: null
      };
    })
  );
}

async function isPFDTicketExists(signature) {
  const pdfHash = crypto.createHash('sha256').update(signature).digest('hex');
  const pdfName = pdfHash + '.pdf';
  const pdfPath = path.resolve('assets', 'tickets', pdfName);

  return new Promise((res, rej) => {
    fs.readFile(pdfPath, function (err, fileData) {
      try {
        if (err) {
          return rej({ pdfPath, pdfName });
        }
        return res({ pdfPath, pdfName });
      } catch (err) {
        return rej({ pdfPath, pdfName });
      }
    });
  });
}

async function transformTicket(ticket) {
  // console.log("TICKET ticketServise.js", ticket);

  // Get meta names from IDs using the new system (do this once for the whole ticket)
  const ticketType =
    (await getMetaNameById(ticket?.typeId, 'uk_UA')) ||
    getConstantTranslation(ticket?.type);
  const ticketStatus =
    (await getMetaNameById(ticket?.statusId, 'uk_UA')) ||
    getConstantTranslation(ticket?.status);

  // Normalize empty / "-" placeholder values to null so the frontend never
  // receives a "-" sentinel (and any legacy "-" already stored is cleaned too).
  const clean = (v) =>
    v === '-' || v === '' || v === undefined || v === null ? null : v;

  // Coerce id-ish values to a string, or null when there is no value.
  const idOrNull = (v) =>
    v === null || v === undefined || v === '' ? null : String(v);

  // Coerce money/numeric values to a Number, or null when empty/invalid.
  const toNum = (v) =>
    v === null || v === undefined || v === '' || isNaN(Number(v))
      ? null
      : Number(v);

  const sharedFields = (passengerTicket, ind) => ({
    ticketId: String(ticket?.id),
    ticketNumber: ticket?.ticketNumber
      ? `${ticket.ticketNumber}-${ind + 1}`
      : ticket?.ticketNumber,
    type: {
      id: idOrNull(ticket?.typeId),
      name: ticketType
    },
    price: toNum(ticket?.price),
    currency: ticket?.currencyAbbr,
    // Canonical UAH amount (LiqPay currency); the admin list shows this, while
    // price/currency above stay in the ticket's display currency for editing.
    priceUAH: toNum(ticket?.priceUAH),
    exchangeRate: toNum(ticket?.exchangeRate),
    discount: {
      percentage: ticket?.hasDiscount
        ? toNum(ticket?.discountPercentage) || 0
        : 0,
      name: ticket?.hasDiscount ? null : 'Без знижки'
    },
    origin: {
      id: idOrNull(ticket?.originCity?.id),
      name: ticket?.originCity?.cityattrs?.[0]?.name,
      countryId: idOrNull(ticket?.originCity?.country?.id)
    },
    destination: {
      id: idOrNull(ticket?.destinationCity?.id),
      name: ticket?.destinationCity?.cityattrs?.[0]?.name,
      countryId: idOrNull(ticket?.destinationCity?.country?.id)
    },
    busFlightFrom: {
      id: idOrNull(ticket?.busFlightFrom?.id),
      routeId: idOrNull(ticket?.busFlightFrom?.routeId),
      freeSeats: toNum(ticket?.busFlightFrom?.freeSeats),
      name: ticket?.busFlightFrom?.route?.routeattrs?.[0]?.name,
      discount: ticket?.busFlightFrom?.discount
        ? Math.round(ticket.busFlightFrom.discount.coef * 100)
        : 0,
      dateOfDeparture: ticket?.busFlightFrom?.dateOfDeparture
    },
    busFlightTo: ticket?.busFlightTo?.id
      ? {
          id: idOrNull(ticket?.busFlightTo?.id),
          routeId: idOrNull(ticket?.busFlightTo?.routeId),
          freeSeats: toNum(ticket?.busFlightTo?.freeSeats),
          name: ticket?.busFlightTo?.route?.routeattrs?.[0]?.name,
          discount: ticket?.busFlightTo?.discount
            ? Math.round(ticket.busFlightTo.discount.coef * 100)
            : 0,
          dateOfDeparture: ticket?.busFlightTo?.dateOfDeparture
        }
      : null,
    dateOfCreature: ticket?.dateOfCreature,
    dateOfDeparture: ticket?.dateOfDeparture,
    dateOfReturn: clean(ticket?.dateOfReturn),
    status: {
      id: idOrNull(ticket?.statusId),
      name: ticketStatus
    },
    dateOfFirstUsage: ticket?.dateOfFirstUsage
  });

  const result = await Promise.all(
    ticket?.passengertickets?.map(async (passengerTicket, ind) => {
      const passenger = passengerTicket?.passenger;
      const discount = passengerTicket?.discount;
      const isChild = passenger?.type === 'child';

      const confirmationStatus =
        (await getMetaNameById(passengerTicket?.confirmationId, 'uk_UA')) ||
        passengerTicket?.confirmation;

      return {
        ...sharedFields(passengerTicket, ind),
        lastName: passenger?.lastName,
        name: passenger?.name,
        passengerConfirmation: {
          id: passengerTicket?.confirmationId
            ? String(passengerTicket?.confirmationId)
            : '0',
          name: confirmationStatus || null
        },
        passengerPrice: toNum(passengerTicket?.price),
        passengerPriceUAH: toNum(passengerTicket?.priceUAH),
        // The UAH amounts are the stored truth (what the admin works in); the
        // booking-currency amounts are the derived side, kept for the
        // customer-facing PDF.
        paymentAtOffice: toNum(passengerTicket?.paymentAtOffice),
        paymentOnBus: toNum(passengerTicket?.paymentOnBus),
        paymentAtOfficeUAH: toNum(passengerTicket?.paymentAtOfficeUAH),
        paymentOnBusUAH: toNum(passengerTicket?.paymentOnBusUAH),
        passengerDiscount: {
          id: discount?.id ? String(discount?.id) : '0',
          percentage: discount?.coef ? (discount?.coef || 0) * 100 : 0,
          name: discount?.discountattrs?.[0]?.name || 'Без знижки'
        },
        discountCardNumber: clean(passengerTicket?.discountCardNumber),
        phone: clean(passenger?.phone),
        additionalPhone: clean(passenger?.additionalPhone),
        email: clean(passenger?.email),
        dateOfBirth: passenger?.dateOfBirth,
        passengerType: {
          id: isChild ? constants.CHILD : constants.ADULT,
          name: isChild ? constants.CHILD : constants.ADULT
        },
        agent: {
          id: passengerTicket?.agent?.id
            ? String(passengerTicket?.agent?.id)
            : '0',
          name: passengerTicket?.agent?.agentattrs?.[0]?.name || 'Без агента'
        },
        busSeat: clean(passengerTicket?.busSeat),
        note: clean(passengerTicket?.note),
        // Per-passenger PDF takes priority; fall back to the legacy ticket-level
        // combined PDF (old tickets had one PDF for all passengers).
        pdfName: passengerTicket?.PDFFileName || ticket?.PDFFileName || null,
        isPDFExists: !!(passengerTicket?.PDFFileName || ticket?.PDFFileName),
        passengerId: passenger?.id || null,
        passengerTicketId: passengerTicket?.id || null
      };
    })
  );

  return result;
}

/**
 * Deletes a PDF file from the file system
 * @param {string} filename - The filename (without .pdf extension)
 * @returns {Promise<void>}
 */
async function deleteTicketPDFFile(filename) {
  if (!filename) return;

  const pdfName = filename + '.pdf';
  const pdfPath = path.resolve('assets', 'tickets', pdfName);

  try {
    await fs.promises.unlink(pdfPath);
  } catch (err) {
    // Ignore ENOENT errors (file doesn't exist)
    if (err?.code !== 'ENOENT') {
      console.error(`Failed to delete PDF file ${pdfName}:`, err);
      // Don't throw - we want to continue with database updates
    }
  }
}

/**
 * Fully deletes a ticket and everything attached to it:
 *  - every per-passenger PDF file (passengertickets.PDFFileName)
 *  - the ticket-level (legacy combined) PDF files (PDFFileName + prevPDFFileName)
 *  - child passenger rows (adults are shared identities and are left in place)
 *  - the passengerticket rows and the ticket row itself
 *  - restores freeSeats on the outbound/return flights by the booked seat count
 *
 * The ticket must be loaded with its `passengertickets`, each including the
 * `passenger` (for `type`) and `PDFFileName`, so children and PDFs are cleaned.
 *
 * @param {Object} ticket - Ticket instance to delete
 * @returns {Promise<void>}
 */
async function deleteTicketCascade(ticket) {
  if (!ticket) throw new Error('Ticket is required');

  const passengerTickets = ticket.passengertickets || [];

  // 1. Per-passenger PDF files.
  for (const pt of passengerTickets) {
    if (pt?.PDFFileName) await deleteTicketPDFFile(pt.PDFFileName);
  }
  // 2. Ticket-level (legacy combined) PDF files.
  if (ticket.PDFFileName) await deleteTicketPDFFile(ticket.PDFFileName);
  if (ticket.prevPDFFileName) await deleteTicketPDFFile(ticket.prevPDFFileName);

  // 3. Child passenger ids (children are 1:1 with the ticket). Adults can be
  //    shared across tickets and are de-duplicated on create, so they stay.
  const childPassengerIds = passengerTickets
    .filter((pt) => pt?.passenger?.type === 'child')
    .map((pt) => pt.passengerId);

  // Restore exactly the seats this ticket currently occupies. Prefer the real
  // loaded row count over the cached passengerRowCount, which can lag behind.
  const seatCount =
    passengerTickets.length || parseInt(ticket.passengerRowCount || 0);

  // 4. Remove the junction rows, then the ticket itself.
  await PassengerTicket.destroy({ where: { ticketId: ticket.id } });
  await Ticket.destroy({ where: { id: ticket.id } });

  // 5. Remove the now-orphaned child passengers. Guarded by a NOT IN check so a
  //    child somehow still linked to another ticket is never deleted.
  if (childPassengerIds.length) {
    await Passenger.destroy({
      where: {
        id: {
          [Op.in]: childPassengerIds,
          [Op.notIn]: sequelize.literal(
            '(SELECT passengerId FROM passengertickets)'
          )
        },
        type: 'child'
      }
    });
  }

  // 6. Restore the seats this ticket had taken on its flight(s).
  if (seatCount > 0) {
    await BusFlight.increment(
      { freeSeats: seatCount },
      {
        where: {
          [Op.or]: [
            { id: ticket.busFlightFromId || null },
            { id: ticket.busFlightToId || null }
          ]
        }
      }
    );
  }
}

/**
 * Archives the current PDF by moving it to backup slot and deleting old backup
 * @param {Object} ticket - The ticket instance
 * @returns {Promise<Object>} Update object with new PDF filename values
 */
async function archiveTicketPDF(ticket) {
  if (!ticket) {
    throw new Error('Ticket is required');
  }

  // Delete old backup if it exists
  if (ticket.prevPDFFileName) {
    await deleteTicketPDFFile(ticket.prevPDFFileName);
  }

  // Return the updates: move current to backup, clear current
  return {
    prevPDFFileName: ticket.PDFFileName || null,
    PDFFileName: null
  };
}

/**
 * Prepares PDF update fields for a query object (without saving)
 * Use this when you want to batch multiple updates together
 * @param {Object} ticket - The ticket instance
 * @returns {Promise<Object>} Object with prevPDFFileName and PDFFileName fields
 */
async function prepareTicketPDFUpdate(ticket) {
  if (!ticket) {
    throw new Error('Ticket is required');
  }

  // Delete old backup if it exists
  if (ticket.prevPDFFileName) {
    await deleteTicketPDFFile(ticket.prevPDFFileName);
  }

  // Return the update fields without saving
  return {
    prevPDFFileName: ticket.PDFFileName || null,
    PDFFileName: null
  };
}

/**
 * Archives current PDF and saves ticket with transaction support
 * @param {Object} ticket - The ticket instance to update
 * @param {Object} transaction - Optional Sequelize transaction
 * @returns {Promise<void>}
 */
async function updateTicketPDFFile(ticket, transaction = null) {
  if (!ticket) {
    throw new Error('Ticket is required');
  }

  // Archive current PDF
  const updates = await archiveTicketPDF(ticket);

  // Apply updates to ticket instance
  Object.assign(ticket, updates);
  ticket.updatedAt = new Date();
  ticket.changed('updatedAt', true);

  // Save with optional transaction
  await ticket.save({ transaction });
}

/**
 * Re-derives a ticket's booking-currency amounts from the per-passenger UAH
 * truth after its roster/prices change (edit / add / remove), and re-sums the
 * ticket totals. UAH is the stored truth (priceUAH, paymentAtOfficeUAH,
 * paymentOnBusUAH); the booking-currency columns are derived = round(UAH / rate)
 * — so a rate change (currency edit) re-prices every row consistently. The
 * ticket totals are the exact sums of the per-passenger amounts.
 *
 * @param {number} ticketId
 * @param {number} exchangeRate - UAH per 1 unit of the ticket's currency (1 for UAH)
 * @returns {Promise<number>} the ticket's new priceUAH
 */
async function recomputeTicketMoney(ticketId, exchangeRate) {
  const rate = Number(exchangeRate) || 1;
  const rows = await PassengerTicket.findAll({
    attributes: ['id', 'priceUAH', 'paymentAtOfficeUAH', 'paymentOnBusUAH'],
    where: { ticketId },
    order: [['id', 'ASC']],
    raw: true
  });

  let totalUAH = 0;
  let totalBooking = 0;
  for (const r of rows) {
    const priceUAH = Number(r.priceUAH) || 0;
    const price = Math.round(priceUAH / rate);
    const office =
      r.paymentAtOfficeUAH == null
        ? null
        : String(Math.round(Number(r.paymentAtOfficeUAH) / rate));
    const bus =
      r.paymentOnBusUAH == null
        ? null
        : String(Math.round(Number(r.paymentOnBusUAH) / rate));
    totalUAH += priceUAH;
    totalBooking += price;
    await PassengerTicket.update(
      { price, paymentAtOffice: office, paymentOnBus: bus },
      { where: { id: r.id } }
    );
  }

  await Ticket.update(
    { priceUAH: totalUAH, price: totalBooking, exchangeRate: rate },
    { where: { id: ticketId } }
  );
  return totalUAH;
}

function transformTicketsTableKey(key) {
  const keysMap = {
    ticketId: 'id',
    currency: 'currencyAbbr',
    discount: 'discountPercentage'
  };

  if (keysMap.hasOwnProperty(key)) return keysMap[key];
  return key;
}

module.exports = {
  generatePDFTicket,
  generateHTMLTicket,
  isPFDTicketExists,
  createTicket,
  passengersInfoToArray,
  splitAmount,
  buildPassengerTicketRows,
  transformTicket,
  updateTicketPDFFile,
  prepareTicketPDFUpdate,
  archiveTicketPDF,
  deleteTicketPDFFile,
  deleteTicketCascade,
  recomputeTicketMoney,
  transformTicketsTableKey
};
