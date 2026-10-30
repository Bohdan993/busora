/** @format */

const { Router } = require('express');

const path = require('path');
const fs = require('fs');
const { Op } = require('sequelize');
const { v4: uuidv4 } = require('uuid');
const { body, validationResult, param, query } = require('express-validator');
const sequelize = require('@database/models/index').sequelize;
const {
  createTicket,
  transformTicket,
  updateTicketPDFFile,
  deleteTicketPDFFile,
  deleteTicketCascade,
  recomputeTicketMoney,
  transformTicketsTableKey
} = require('@services/ticketService');
const AdminAPIError = require('@exeptions/admin/api-error');
const constants = require('@helpers/constants.js');
const queryHelper = require('@helpers/queries');
const {
  agentattributes: AgentAttributes,
  agent: Agent,
  busflight: BusFlight,
  city: City,
  cityattributes: CityAttributes,
  country: Country,
  countryattributes: CountryAttributes,
  discount: Discount,
  discountattributes: DiscountAttributes,
  language: Language,
  passenger: Passenger,
  passengerticket: PassengerTicket,
  place: Place,
  placeattributes: PlaceAttributes,
  route: Route,
  routeattributes: RouteAttributes,
  ticket: Ticket,
  ticketmeta: TicketMeta,
  ticketmetaattributes: TicketMetaAttributes
} = require('@database/models/index');
const {
  checkUserPermissions,
  checkUserAuth,
  checkUserBlocked,
  checkUserActivation
} = require('@middlewares/admin/authMiddlewares');
const {
  mapStringsToConstants,
  transformStringToConstant,
  transformTimestampToDate,
  transformDate
} = require('@helpers');
const { getPaymentProvider } = require('@services/payments');
const { getExchangeRate } = require('@services/exchangeRates');
const { sendFileMail, getTicketSubject } = require('@services/mailService');
const { getLanguageCodeById } = require('@services/languageService');
const {
  resolveMetaId,
  getConfirmationTypes,
  getTicketStatuses,
  getTicketTypes
} = require('@services/ticketMetaService');
const {
  loadTicketWithRelations,
  generatePerPassengerPDFs,
  persistPerPassengerPDFs
} = require('@services/admin/ticketPdfService');
const { ensureTicketPDFAndSendEmail } = require('@services/ticketPdfService');
const {
  parseTicketListParams,
  buildFilterWhere,
  buildSortOrder,
  buildCustomSortOrder,
  fetchRowPage,
  fetchFullTicketData
} = require('@services/admin/ticketListService');
const { hasActualDiscount } = require('@services/busFlightService');

const router = Router();

// ─── UAH ⇄ booking-currency conversion (admin works in UAH) ──────────────────
//
// The admin UI enters and shows every money amount in UAH, and UAH is the stored
// truth (priceUAH / paymentAtOfficeUAH / paymentOnBusUAH). A ticket also keeps
// its booking-currency columns (EUR for DE-origin, UAH for UA-origin) for the
// customer-facing price/PDF; those are the DERIVED side = round(UAH / rate).
// These helpers resolve the UAH truth from the request and derive booking from it.

// Resolve the UAH-per-1-unit rate for a currency: UAH → 1, otherwise the live
// NBU rate. A lookup failure falls back (to the ticket's locked rate or 1) so a
// flaky rate API never blocks an edit.
async function resolveCurrencyRate(currency, fallback = 1) {
  if (!currency || String(currency).toUpperCase() === 'UAH') return 1;
  try {
    return await getExchangeRate(String(currency).toUpperCase());
  } catch {
    return Number(fallback) || 1;
  }
}

// Derive a booking-currency amount from its UAH truth (÷ rate, rounded).
const uahToBooking = (uahVal, rate) =>
  uahVal === null || uahVal === undefined || uahVal === ''
    ? null
    : Math.round(Number(uahVal) / (Number(rate) || 1));

// Resolve the UAH truth for a payment amount. The UAH-native field wins (admin
// works in UAH); when only the legacy booking-currency field is present it is
// converted up to UAH (× rate), so older clients keep working through the
// rollout. Returns an integer UAH amount or null.
const resolveUahTruth = (uahVal, legacyBookingVal, rate) =>
  uahVal !== null && uahVal !== undefined && uahVal !== ''
    ? Math.round(Number(uahVal))
    : legacyBookingVal !== null &&
        legacyBookingVal !== undefined &&
        legacyBookingVal !== ''
      ? Math.round(Number(legacyBookingVal) * (Number(rate) || 1))
      : null;

/**
 * @swagger
 * /api/admin/tickets:
 *   get:
 *     summary: List tickets (paginated, filterable, sortable)
 *     tags: [Admin / Tickets]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: start
 *         required: true
 *         schema: { type: integer, example: 0 }
 *       - in: query
 *         name: size
 *         required: true
 *         schema: { type: integer, example: 10 }
 *       - in: query
 *         name: filters
 *         required: true
 *         schema: { type: string, example: "[]" }
 *       - in: query
 *         name: filtersFns
 *         required: true
 *         schema: { type: string, example: "[]" }
 *       - in: query
 *         name: sorting
 *         required: true
 *         schema: { type: string, example: "[]" }
 *     responses:
 *       200:
 *         description: Paginated ticket list
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   $ref: '#/components/schemas/OkStatus'
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/AdminTicketRow'
 *                 meta:
 *                   $ref: '#/components/schemas/PaginationMeta'
 *       401:
 *         description: Unauthorized
 */
router.get(
  '/',
  [
    query('start').isInt(),
    query('size').isInt(),
    query('filters').isString(),
    query('filtersFns').isString(),
    query('sorting').isString(),
    query('customSorting').optional().isString(),
    checkUserAuth,
    checkUserBlocked,
    checkUserActivation,
    checkUserPermissions(constants.ADMIN_ROLE, constants.MANAGER_ROLE)
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw AdminAPIError.ValidationError(
          'Помилка при валідації',
          errors.array()
        );
      }
      const {
        start = 0,
        size = 10,
        filters = '[]',
        filtersFns = '[]',
        sorting = '[]',
        customSorting = '[]'
      } = req.query;
      const startInt = parseInt(start, 10);
      const sizeInt = parseInt(size, 10);

      const { parsedFiltersWithFns, parsedSorting } = parseTicketListParams(
        filters,
        filtersFns,
        sorting
      );

      let parsedCustomSorting = [];
      try {
        parsedCustomSorting = JSON.parse(customSorting);
      } catch {
        parsedCustomSorting = [];
      }

      const where = parsedFiltersWithFns.length
        ? buildFilterWhere(parsedFiltersWithFns)
        : {};
      // customSorting (route-order) takes priority; the regular sort (or the
      // default ticket/row order) follows as a stable tiebreaker.
      const order = [
        ...buildCustomSortOrder(parsedCustomSorting),
        ...buildSortOrder(parsedSorting)
      ];
      const relatedIds = new Set([
        ...parsedFiltersWithFns.map((f) => f.id),
        ...parsedSorting.map((s) => s.id)
      ]);

      // Phase 1: the exact, ordered page of passenger-ticket rows.
      const { pageRows, totalRowCount } = await fetchRowPage(
        where,
        order,
        relatedIds,
        startInt,
        sizeInt
      );

      if (pageRows.length === 0) {
        return res.json({
          status: 'ok',
          data: [],
          meta: { totalRowCount, startPage: 0, timestamp: Date.now() }
        });
      }

      // Phase 2: full data for the page's tickets (each carries all its
      // passengers, so the per-row ticketNumber suffix stays correct), then
      // re-emit only the page's rows in the Phase-1 order.
      const ticketIds = [...new Set(pageRows.map((r) => r.ticketId))];
      const tickets = await fetchFullTicketData({ id: { [Op.in]: ticketIds } });
      const transformed = (
        await Promise.all(tickets.map(transformTicket))
      ).flat();
      const rowByPtId = new Map(
        transformed.map((row) => [row.passengerTicketId, row])
      );
      const results = pageRows.map((r) => rowByPtId.get(r.id)).filter(Boolean);

      return res.json({
        status: 'ok',
        data: results,
        meta: { totalRowCount, startPage: 0, timestamp: Date.now() }
      });
    } catch (err) {
      return next(err);
    }
  }
);

/**
 * @swagger
 * /api/admin/tickets/attributes:
 *   get:
 *     summary: Get ticket status and type lookup values
 *     description: Returns the localised label/value pairs for ticket statuses (not-payed, payed, etc.) and types (one-way, open-date, round).
 *     tags: [Admin / Tickets]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: languageCode
 *         schema: { type: string, default: uk_UA }
 *     responses:
 *       200:
 *         description: Attribute lookup values
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   $ref: '#/components/schemas/OkStatus'
 *                 data:
 *                   type: object
 *                   properties:
 *                     confirmations:
 *                       type: array
 *                       description: Confirmation statuses, incl. a synthetic "0" (no confirmation).
 *                       items:
 *                         type: object
 *                         properties:
 *                           id: { type: string, example: "8" }
 *                           label: { type: string, example: "Підтвердження" }
 *                           value: { type: string, example: "Підтвердження" }
 *                     statuses:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id: { type: string }
 *                           label: { type: string }
 *                           value: { type: string }
 *                           color: { type: string }
 *                     types:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id: { type: string }
 *                           label: { type: string }
 *                           value: { type: string }
 */
router.get(
  '/attributes',
  [
    query('languageCode').isString().optional({ values: 'null' }),
    checkUserAuth,
    checkUserBlocked,
    checkUserActivation,
    checkUserPermissions(constants.ADMIN_ROLE, constants.MANAGER_ROLE)
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw AdminAPIError.ValidationError(
          'Помилка при валідації',
          errors.array()
        );
      }
      const { languageCode = 'uk_UA' } = req?.query ?? {};

      // All three lists are sourced from their ticketmeta groups so their ids
      // are the real meta ids — matching what the ticket-list response returns
      // and what the create/update handlers persist (via convertEnumToMetaId).
      const [statusMetas, typeMetas, confirmationMetas] = await Promise.all([
        getTicketStatuses(languageCode),
        getTicketTypes(languageCode),
        getConfirmationTypes(languageCode)
      ]);

      const statuses = statusMetas.map((s) => ({
        id: String(s.id),
        label: s.name,
        value: s.name,
        color: 'red'
      }));

      const types = typeMetas.map((t) => ({
        id: String(t.id),
        label: t.name,
        value: t.name
      }));

      // Confirmation also gets a synthetic id "0" = no confirmation, matching
      // the passengerConfirmation default in the ticket-list response.
      const confirmations = [
        { id: '0', label: 'Без підтвердження', value: 'Без підтвердження' },
        ...confirmationMetas.map((c) => ({
          id: String(c.id),
          label: c.name,
          value: c.name
        }))
      ];

      return res.json({
        status: 'ok',
        data: {
          confirmations,
          statuses,
          types
        },
        meta: {}
      });
    } catch (err) {
      return next(err);
    }
  }
);

/**
 * @swagger
 * /api/admin/tickets/download-pdf:
 *   get:
 *     summary: Download a ticket PDF (admin)
 *     description: >
 *       When `passengerId` is given, returns that passenger's individual PDF.
 *       When omitted, falls back to the legacy combined ticket PDF.
 *     tags: [Admin / Tickets]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *         description: Ticket ID
 *       - in: query
 *         name: passengerId
 *         schema: { type: integer }
 *         description: Optional — download only this passenger's PDF
 *     responses:
 *       200:
 *         description: PDF file
 *         content:
 *           application/pdf:
 *             schema: { type: string, format: binary }
 *       404:
 *         description: Ticket or PDF not found
 */
router.get(
  '/download-pdf',
  [
    query('id').isInt(),
    // Optional: when provided, serve only that passenger's individual PDF.
    // When omitted, falls back to the legacy ticket-level PDFFileName.
    query('passengerId').isInt().optional({ values: 'null' }),
    checkUserAuth,
    checkUserBlocked,
    checkUserActivation,
    checkUserPermissions(constants.ADMIN_ROLE)
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw AdminAPIError.ValidationError(
          'Помилка при валідації',
          errors.array()
        );
      }
      const { id, passengerId } = req?.query ?? {};

      if (passengerId) {
        // Per-passenger download: look up the PassengerTicket row for this
        // specific passenger on this ticket and serve its individual PDF.
        const pt = await PassengerTicket.findOne({
          attributes: ['PDFFileName'],
          where: { ticketId: id, passengerId }
        });

        if (!pt) {
          throw AdminAPIError.NotFoundError(
            `Пасажира з id ${passengerId} у квитку з id ${id} не знайдено`
          );
        }

        // Per-passenger PDF takes priority; fall back to the legacy ticket-level
        // combined PDF when this passenger has no individual PDF (old tickets).
        let fileName = pt.PDFFileName;
        if (!fileName) {
          const ticket = await Ticket.findOne({
            attributes: ['PDFFileName'],
            where: { id }
          });
          fileName = ticket?.PDFFileName || null;
        }
        if (!fileName) {
          throw AdminAPIError.NotFoundError(
            `PDF для пасажира з id ${passengerId} ще не згенеровано`
          );
        }

        const pdfName = fileName + '.pdf';
        const pdfPath = path.resolve('assets', 'tickets', pdfName);
        return res.download(pdfPath, function (err) {
          if (err) return next(err);
          console.log('Sent downloaded:', pdfName);
        });
      }

      // Legacy behaviour: serve the ticket-level combined PDF.
      const ticket = await Ticket.findOne({
        attributes: [
          'id',
          'PDFFileName',
          'prevPDFFileName',
          'createdAt',
          'updatedAt'
        ],
        where: { id }
      });

      if (!ticket) {
        throw AdminAPIError.NotFoundError(`Квиток з id ${id} не знайдено`);
      }

      const pdfName = ticket?.PDFFileName + '.pdf';
      const pdfPath = path.resolve('assets', 'tickets', pdfName);

      return res.download(pdfPath, function (err) {
        if (err) return next(err);
        console.log('Sent downloaded:', pdfName);
      });
    } catch (err) {
      return next(err);
    }
  }
);

/**
 * @swagger
 * /api/admin/tickets:
 *   post:
 *     summary: Create a ticket manually (admin)
 *     description: Creates a ticket without going through the LiqPay payment flow. A synthetic transaction ID and signature are generated.
 *     tags: [Admin / Tickets]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [type, dateOfDeparture, origin, destination, busFlightFrom, currency, status, discount, children, passengers]
 *             properties:
 *               type:
 *                 type: object
 *                 description: "Ticket type { id, name }; backend reads name (resolved to a meta key)."
 *                 properties:
 *                   id: { type: string, example: "5" }
 *                   name: { type: string, example: "В одну сторону" }
 *               dateOfDeparture: { type: string, format: date }
 *               dateOfReturn: { type: string, format: date, nullable: true }
 *               origin:
 *                 type: object
 *                 properties:
 *                   id: { type: integer }
 *               destination:
 *                 type: object
 *                 properties:
 *                   id: { type: integer }
 *               busFlightFrom:
 *                 type: object
 *                 properties:
 *                   id: { type: integer }
 *               busFlightTo:
 *                 type: object
 *                 nullable: true
 *               price: { type: integer, nullable: true, example: 4880, description: "Calculated by the form; optional on create." }
 *               currency: { type: string, example: "UAH" }
 *               status:
 *                 type: object
 *                 description: "Ticket status { id, name }; backend reads name (resolved to a meta key)."
 *                 properties:
 *                   id: { type: string, example: "1" }
 *                   name: { type: string, example: "Не оплачено" }
 *               discount:
 *                 type: object
 *                 description: "Ticket discount { percentage, name }; backend reads percentage."
 *                 properties:
 *                   percentage: { type: number, example: 0 }
 *                   name: { type: string, nullable: true }
 *               passengers:
 *                 type: array
 *                 items: { type: object }
 *                 description: Adult passenger objects
 *               children:
 *                 type: array
 *                 items: { type: object }
 *                 description: Child passenger objects
 *     responses:
 *       200:
 *         description: Ticket created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   $ref: '#/components/schemas/OkStatus'
 *                 data:
 *                   type: object
 *                   properties:
 *                     ticketId: { type: string }
 *       400:
 *         description: Validation error
 */
router.post(
  '/',
  [
    body('type').isObject(),
    body('dateOfDeparture').isDate({
      format: 'YYYY-MM-DD',
      strictMode: true
    }),
    body('dateOfReturn')
      .isDate({
        format: 'YYYY-MM-DD',
        strictMode: true
      })
      .optional({ values: 'null' }),
    body('origin').isObject(),
    body('destination').isObject(),
    body('busFlightFrom').isObject(),
    body('busFlightTo').isObject().optional({ values: 'null' }),
    // price is calculated from the flight/payments in the admin form, so it is
    // not required on create.
    body('price').isInt().optional({ values: 'null' }),
    body('currency').isString(),
    body('status').isObject(),
    body('discount').isObject(),
    body('children').isArray(),
    body('passengers').isArray(),
    // Adult passenger items
    body('passengers.*.name').isString(),
    body('passengers.*.lastName').isString(),
    body('passengers.*.passengerType').isObject(),
    body('passengers.*.phone').isString().optional({ values: 'null' }),
    body('passengers.*.additionalPhone')
      .isString()
      .optional({ values: 'null' }),
    body('passengers.*.email').isString().optional({ values: 'null' }),
    body('passengers.*.dateOfBirth').optional({ values: 'null' }),
    body('passengers.*.passengerDiscount')
      .isObject()
      .optional({ values: 'null' }),
    body('passengers.*.discountCardNumber')
      .isString()
      .optional({ values: 'null' }),
    body('passengers.*.agent').isObject().optional({ values: 'null' }),
    body('passengers.*.passengerConfirmation')
      .isObject()
      .optional({ values: 'null' }),
    body('passengers.*.paymentAtOffice')
      .isNumeric()
      .optional({ values: 'null' }),
    body('passengers.*.paymentOnBus').isNumeric().optional({ values: 'null' }),
    // UAH-native payment inputs (admin works in UAH) — the stored truth; the
    // booking-currency amount is derived from them. Preferred over the legacy
    // fields above.
    body('passengers.*.paymentAtOfficeUAH')
      .isNumeric()
      .optional({ values: 'null' }),
    body('passengers.*.paymentOnBusUAH')
      .isNumeric()
      .optional({ values: 'null' }),
    body('passengers.*.busSeat').isString().optional({ values: 'null' }),
    body('passengers.*.note').isString().optional({ values: 'null' }),
    // Child passenger items (no contact fields)
    body('children.*.name').isString(),
    body('children.*.lastName').isString(),
    body('children.*.passengerType').isObject(),
    body('children.*.dateOfBirth').optional({ values: 'null' }),
    body('children.*.passengerDiscount')
      .isObject()
      .optional({ values: 'null' }),
    body('children.*.agent').isObject().optional({ values: 'null' }),
    body('children.*.passengerConfirmation')
      .isObject()
      .optional({ values: 'null' }),
    body('children.*.paymentAtOffice').isNumeric().optional({ values: 'null' }),
    body('children.*.paymentOnBus').isNumeric().optional({ values: 'null' }),
    body('children.*.paymentAtOfficeUAH')
      .isNumeric()
      .optional({ values: 'null' }),
    body('children.*.paymentOnBusUAH').isNumeric().optional({ values: 'null' }),
    body('children.*.busSeat').isString().optional({ values: 'null' }),
    body('children.*.note').isString().optional({ values: 'null' }),
    checkUserAuth,
    checkUserBlocked,
    checkUserActivation,
    checkUserPermissions(constants.ADMIN_ROLE)
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw AdminAPIError.ValidationError(
          'Помилка при валідації',
          errors.array()
        );
      }
      const {
        type,
        dateOfDeparture,
        dateOfReturn,
        origin,
        destination,
        busFlightFrom,
        busFlightTo,
        price,
        currency,
        status,
        discount,
        children,
        passengers
      } = req.body;

      // Frontend sends { id, name } / { percentage, name } objects (mirroring
      // the GET shape). Extract the primitives createTicket expects: localized
      // names (mapStringsToConstants turns them into meta keys) and a number.
      const typeName = type?.name ?? type;
      const statusName = status?.name ?? status;
      const discountPercentageValue =
        typeof discount === 'number' ? discount : (discount?.percentage ?? 0);
      // passengerType arrives per passenger as { id, name }; read the id.
      const passengerTypeOf = (p) => p?.passengerType?.id ?? p?.passengerType;

      const allPassengers = [...passengers, ...children];

      // The admin enters payments in UAH (the stored truth); resolve the rate so
      // the booking-currency columns can be derived for the customer-facing PDF.
      // The same rate is handed to createTicket so all totals agree.
      const createRate = await resolveCurrencyRate(currency);
      const ticketDiscountPct = discountPercentageValue || 0;

      // Per passenger: UAH truth (paymentAtOfficeUAH/paymentOnBusUAH + priceUAH)
      // and the derived booking-currency amounts. A ticket-level discount
      // overrides the per-passenger one (the two are mutually exclusive).
      const moneyOf = (p) => {
        const officeUAH = resolveUahTruth(
          p?.paymentAtOfficeUAH,
          p?.paymentAtOffice,
          createRate
        );
        const busUAH = resolveUahTruth(
          p?.paymentOnBusUAH,
          p?.paymentOnBus,
          createRate
        );
        const pct =
          ticketDiscountPct > 0
            ? ticketDiscountPct
            : Number(p?.passengerDiscount?.percentage) || 0;
        const priceUAH = Math.round(
          ((Number(officeUAH) || 0) + (Number(busUAH) || 0)) * (1 - pct / 100)
        );
        return {
          officeUAH,
          busUAH,
          priceUAH,
          office: uahToBooking(officeUAH, createRate),
          bus: uahToBooking(busUAH, createRate),
          price: Math.round(priceUAH / (createRate || 1))
        };
      };
      const money = allPassengers.map(moneyOf);
      const computedPrice = money.reduce((sum, m) => sum + m.price, 0);
      const effectivePrice = computedPrice || price || 0;

      // Normalize the passenger arrays into the shape createTicket expects.
      const passengerList = allPassengers.map((p, i) => {
        const m = money[i];
        return {
          type: passengerTypeOf(p) === 'child' ? 'child' : 'adult',
          name: p?.name,
          lastName: p?.lastName,
          phone: p?.phone ?? null,
          additionalPhone: p?.additionalPhone ?? null,
          email: p?.email ?? null,
          dateOfBirth: p?.dateOfBirth ?? null,
          passengerDiscountId: parseInt(p?.passengerDiscount?.id) || null,
          discountPercentage: Number(p?.passengerDiscount?.percentage) || null,
          discountCardNumber: parseInt(p?.discountCardNumber) || null,
          agentId: parseInt(p?.agent?.id) || null,
          paymentAtOffice: m.office,
          paymentOnBus: m.bus,
          paymentAtOfficeUAH: m.officeUAH,
          paymentOnBusUAH: m.busUAH,
          confirmationId: parseInt(p?.passengerConfirmation?.id) || null,
          busSeat: p?.busSeat ?? null,
          note: p?.note ?? null,
          price: m.price,
          priceUAH: m.priceUAH
        };
      });

      const currDate = Date.now();

      const infoObj = {
        originalCurrency: currency,
        originalPrice: effectivePrice,
        languageCode: 'uk_UA',
        date: currDate
      };
      const { sign } = getPaymentProvider();
      const infoData = Buffer.from(JSON.stringify(infoObj)).toString('base64');
      const infoDataSignature = sign(infoData);

      const signatureObj = {
        action: 'pay',
        order_id: infoDataSignature,
        create_date: currDate,
        amount: effectivePrice,
        currency: currency,
        currency_debit: currency,
        currency_credit: currency
      };
      const signatureData = Buffer.from(JSON.stringify(signatureObj)).toString(
        'base64'
      );
      const signature = sign(signatureData);

      const ticket = await createTicket({
        transactionId: uuidv4(),
        signature: 'mocked' + signature,
        selectedBusFlight: {
          busFlightFromId: busFlightFrom?.id,
          busFlightToId: busFlightTo?.id || null,
          hasDiscount:
            hasActualDiscount(busFlightFrom) ||
            hasActualDiscount(busFlightTo) ||
            (discountPercentageValue > 0 &&
              !busFlightFrom?.discount &&
              !busFlightTo?.discount),
          discountPercentage: discountPercentageValue
        },
        originId: origin?.id,
        destinationId: destination?.id,
        startDate: dateOfDeparture,
        endDate: dateOfReturn,
        passengers: passengerList,
        status: statusName,
        type: typeName,
        data: JSON.stringify({ currency: currency, amount: effectivePrice }),
        exchangeRate: createRate
      });

      return res.json({
        status: 'ok',
        data: { ticketId: ticket?.id ? String(ticket?.id) : '' }
      });
    } catch (err) {
      return next(err);
    }
  }
);

/**
 * @swagger
 * /api/admin/tickets/passengers:
 *   post:
 *     summary: Add a passenger to an existing ticket
 *     description: >
 *       Attaches an existing passenger (by `id`) or creates a new one (via `data`) and links
 *       them to the specified ticket. Also decrements `freeSeats` on the associated bus flight.
 *     tags: [Admin / Tickets]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [ticketId, type]
 *             properties:
 *               ticketId: { type: string, description: "Ticket ID to add the passenger to" }
 *               id:
 *                 type: string
 *                 nullable: true
 *                 description: Existing passenger ID (omit to create a new one)
 *               type:
 *                 type: string
 *                 enum: [adult, child]
 *               data:
 *                 type: object
 *                 nullable: true
 *                 description: New passenger data (used when `id` is omitted)
 *                 properties:
 *                   name: { type: string }
 *                   lastName: { type: string }
 *                   phone: { type: string }
 *                   dateOfBirth: { type: string }
 *                   email: { type: string }
 *                   passengerDiscount: { type: object }
 *                   discountCardNumber: { type: string }
 *     responses:
 *       200:
 *         description: Passenger added
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   $ref: '#/components/schemas/OkStatus'
 *                 data:
 *                   type: object
 *                   properties:
 *                     ticketId: { type: string }
 *       400:
 *         description: Passenger already on ticket
 *       404:
 *         description: Ticket or passenger not found
 */
router.post(
  '/passengers',
  [
    body('ticketId').isString(),
    body('id').isString().optional({ values: 'null' }),
    body('type').isString(),
    body('data').isObject().optional({ values: 'null' }),
    checkUserAuth,
    checkUserBlocked,
    checkUserActivation,
    checkUserPermissions(constants.ADMIN_ROLE)
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw AdminAPIError.ValidationError(
          'Помилка при валідації',
          errors.array()
        );
      }
      const { ticketId, id, type, data } = req.body;

      let ticket;
      let query = {
        attributes: [
          'id',
          'dateOfDeparture',
          'dateOfReturn',
          'busFlightFromId',
          'busFlightToId',
          'price',
          'currencyAbbr',
          'exchangeRate',
          'typeId',
          'statusId',
          'hasDiscount',
          'discountPercentage',
          'PDFFileName',
          'prevPDFFileName',
          'originId',
          'destinationId'
        ],
        where: {
          id: ticketId
        },
        include: [
          {
            model: BusFlight,
            attributes: ['id', 'routeId', 'dateOfDeparture'],
            as: 'busFlightFrom'
          },
          {
            model: BusFlight,
            attributes: ['id', 'routeId', 'dateOfDeparture'],
            as: 'busFlightTo'
          }
        ],
        order: [
          ['id', 'ASC'],
          ['dateOfDeparture', 'ASC']
        ]
      };
      ticket = await Ticket.findOne(query);

      if (!ticket) {
        throw AdminAPIError.NotFoundError(
          `Квиток з id ${ticketId} не знайдено`
        );
      }

      if (type === 'adult') {
        let passenger;
        if (id) {
          let passengerQuery = {
            attributes: [
              'id',
              'name',
              'lastName',
              'phone',
              'additionalPhone',
              'dateOfBirth',
              'email'
            ],
            where: {
              id: id
            },
            include: [
              {
                model: PassengerTicket,
                attributes: ['id', 'ticketId', 'passengerId']
              }
            ],
            order: [
              ['lastName', 'ASC'],
              ['id', 'ASC']
            ]
          };

          passenger = await Passenger.findOne(passengerQuery);

          if (!passenger) {
            throw AdminAPIError.NotFoundError(
              `Пасажира з id ${id} не знайдено`
            );
          }

          if (
            passenger?.passengertickets?.some(
              (el) => String(el.ticketId) === String(ticketId)
            )
          ) {
            throw AdminAPIError.BadRequestError('Помилка', [
              `У квитку з id ${ticketId} уже присутній пасажир з id ${id}`
            ]);
          }
        } else {
          passenger = await Passenger.create({
            name: data?.name,
            lastName: data?.lastName,
            phone: data?.phone,
            additionalPhone: data?.additionalPhone || null,
            dateOfBirth: data?.dateOfBirth,
            email: data?.email || null
          });
        }

        const passengerData = {
          passengerId: passenger?.id,
          ticketId: ticket?.id
        };

        if (parseInt(data?.passengerDiscount?.id)) {
          passengerData['passengerDiscountId'] = data.passengerDiscount.id;
        }

        if (parseInt(data?.discountCardNumber)) {
          passengerData['discountCardNumber'] = parseInt(
            data.discountCardNumber
          );
        }

        await PassengerTicket.create(passengerData);
      }

      if (type === 'child') {
        const childPassenger = await Passenger.create({
          name: data?.name,
          lastName: data?.lastName,
          phone: null,
          dateOfBirth: data?.dateOfBirth || null,
          type: 'child'
        });
        const rawDiscountId = data?.passengerDiscount?.id;
        await PassengerTicket.create({
          ticketId: ticket.id,
          passengerId: childPassenger.id,
          passengerDiscountId:
            rawDiscountId && rawDiscountId !== '0' ? rawDiscountId : null,
          discountPercentage: data?.passengerDiscount?.percentage || null,
          paymentAtOffice: null,
          paymentOnBus: null,
          PDFFileName: null
        });
      }

      await updateTicketPDFFile(ticket);
      await BusFlight.decrement(
        {
          freeSeats: 1
        },
        {
          where: {
            [Op.or]: [
              { id: ticket?.busFlightFrom?.id || null },
              { id: ticket?.busFlightTo?.id || null }
            ]
          }
        }
      );

      // Keep the canonical UAH amounts consistent after the roster change.
      await recomputeTicketMoney(ticket.id, ticket.exchangeRate || 1);

      return res.json({
        status: 'ok',
        data: { ticketId: ticket?.id ? String(ticket?.id) : '' }
      });
    } catch (err) {
      return next(err);
    }
  }
);

/**
 * @swagger
 * /api/admin/tickets/send-pdf:
 *   post:
 *     summary: Email ticket PDF to a recipient
 *     description: >
 *       Sends the ticket PDF(s) to the given email address. When `passengerId` is
 *       provided, only that passenger's PDF is attached; otherwise all passenger
 *       PDFs are attached.
 *     tags: [Admin / Tickets]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [id, email]
 *             properties:
 *               id: { type: integer, description: "Ticket ID" }
 *               email: { type: string, format: email }
 *               passengerId:
 *                 type: integer
 *                 nullable: true
 *                 description: Optional — send only this passenger's PDF
 *     responses:
 *       200:
 *         description: Email sent
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   $ref: '#/components/schemas/OkStatus'
 *                 data:
 *                   type: object
 *                   properties:
 *                     ticketId: { type: string }
 *       404:
 *         description: Ticket or PDF not found
 */
router.post(
  '/send-pdf',
  [
    body('id').isInt(),
    body('email').isString(),
    // Optional: when provided, send only that passenger's individual PDF.
    // When omitted, all per-passenger PDFs are attached to one email.
    body('passengerId').isInt().optional({ values: 'null' }),
    checkUserAuth,
    checkUserBlocked,
    checkUserActivation,
    checkUserPermissions(constants.ADMIN_ROLE)
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw AdminAPIError.ValidationError(
          'Помилка при валідації',
          errors.array()
        );
      }
      const { id, email, passengerId } = req?.body ?? {};

      // The email (subject, city names, body) is in the booking language
      const ticketLanguage = await Ticket.findByPk(id, {
        attributes: ['languageId']
      });
      if (!ticketLanguage) {
        throw AdminAPIError.NotFoundError(`Квиток з id ${id} не знайдено`);
      }
      const { languageId } = ticketLanguage;
      const languageCode = await getLanguageCodeById(languageId);

      const ticket = await Ticket.findOne({
        attributes: [
          'id',
          'dateOfDeparture',
          'dateOfReturn',
          'typeId',
          'PDFFileName'
        ],
        where: { id },
        include: [
          {
            model: City,
            as: 'originCity',
            include: [
              {
                model: CityAttributes,
                as: 'cityattrs',
                attributes: ['name'],
                where: { languageId: { [Op.eq]: languageId } }
              }
            ]
          },
          {
            model: City,
            as: 'destinationCity',
            include: [
              {
                model: CityAttributes,
                as: 'cityattrs',
                attributes: ['name'],
                where: { languageId: { [Op.eq]: languageId } }
              }
            ]
          },
          {
            model: TicketMeta,
            as: 'typeMeta',
            attributes: ['id', 'meta_key']
          },
          {
            // Load PDFFileName for every adult passenger on this ticket.
            model: PassengerTicket,
            attributes: ['id', 'passengerId', 'PDFFileName']
          }
        ],
        order: [
          ['id', 'ASC'],
          ['dateOfDeparture', 'ASC']
        ]
      });

      if (!ticket) {
        throw AdminAPIError.NotFoundError(`Квиток з id ${id} не знайдено`);
      }

      const subject = getTicketSubject(
        {
          cities: {
            from: { name: ticket?.originCity?.cityattrs?.[0]?.name },
            to: { name: ticket?.destinationCity?.cityattrs?.[0]?.name }
          },
          dates: {
            departure: transformDate(ticket?.dateOfDeparture, languageCode),
            return: transformDate(ticket?.dateOfReturn, languageCode)
          },
          type: ticket?.typeMeta?.meta_key
        },
        languageCode
      );

      let pdfPaths;

      if (passengerId) {
        // Single-passenger send: find this passenger's PassengerTicket row and
        // use its PDFFileName, falling back to the legacy ticket-level combined
        // PDF when this passenger has no individual PDF (old tickets).
        const pt = ticket.passengertickets?.find(
          (p) => String(p.passengerId) === String(passengerId)
        );
        const fileName = pt?.PDFFileName || ticket?.PDFFileName || null;
        if (!fileName) {
          throw AdminAPIError.NotFoundError(
            `PDF для пасажира з id ${passengerId} ще не згенеровано`
          );
        }
        pdfPaths = [
          {
            path: path.resolve('assets', 'tickets', fileName + '.pdf'),
            filename: 'ticket.pdf'
          }
        ];
      } else {
        // All-passengers send: all PDFs (adults + children) are in passengertickets
        pdfPaths = (ticket.passengertickets || [])
          .filter((pt) => pt.PDFFileName)
          .map((pt, i) => ({
            path: path.resolve('assets', 'tickets', pt.PDFFileName + '.pdf'),
            filename: `ticket-${i + 1}.pdf`
          }));

        // No per-passenger PDFs (old tickets) → fall back to the single
        // ticket-level combined PDF if one exists.
        if (!pdfPaths.length && ticket?.PDFFileName) {
          pdfPaths = [
            {
              path: path.resolve(
                'assets',
                'tickets',
                ticket.PDFFileName + '.pdf'
              ),
              filename: 'ticket.pdf'
            }
          ];
        }

        if (!pdfPaths.length) {
          throw AdminAPIError.NotFoundError(
            `Для квитка з id ${id} немає жодного згенерованого PDF. Спочатку натисніть «Згенерувати PDF».`
          );
        }
      }

      // The DB can reference a PDFFileName whose file is absent on disk (e.g. a
      // DB dump restored without its assets), and isPDFExists only checks the
      // column, not the file. Verify every attachment exists before sending so a
      // missing file yields a clear "regenerate the PDF" message rather than a
      // raw ENOENT 500 mid-send from nodemailer.
      const missingPaths = pdfPaths.filter(
        ({ path: filePath }) => !fs.existsSync(filePath)
      );
      if (missingPaths.length) {
        throw AdminAPIError.NotFoundError(
          `Файл PDF відсутній на сервері (${missingPaths.length} з ${pdfPaths.length}). Натисніть «Згенерувати PDF» і повторіть надсилання.`
        );
      }

      await sendFileMail({
        email,
        pdfPaths,
        subject,
        languageCode,
        sendAdminEmail: false
      });

      return res.json({
        status: 'ok',
        data: { ticketId: ticket?.id ? String(ticket?.id) : '' }
      });
    } catch (err) {
      return next(err);
    }
  }
);

// ─── DEV/TEST ROUTE ──────────────────────────────────────────────────────────
// Triggers ensureTicketPDFAndSendEmail for an existing ticket without going
// through the full payment flow. Useful for testing PDF generation + email.
// Usage:  POST /admin/tickets/test-send-email  { "id": 123, "email": "you@example.com" }
// Remove or guard behind a dev-only flag before going to production.
/*
router.get(
  "/test-send-email",
  [
    query("id").isInt(),
    query("email").isEmail(),
    // checkUserAuth,
    // checkUserBlocked,
    // checkUserActivation,
    // checkUserPermissions(constants.ADMIN_ROLE),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw AdminAPIError.ValidationError(
          "Помилка при валідації",
          errors.array(),
        );
      }

      const { id, email } = req?.query ?? {};

      // Load ticket with city/type relations so we can build the email subject.
      const ticket = await Ticket.findOne({
        attributes: [
          "id",
          "signature",
          "PDFFileName",
          "dateOfDeparture",
          "dateOfReturn",
          "typeId",
          "transactionId",
        ],
        where: { id },
        include: [
          {
            model: City,
            as: "originCity",
            include: [
              {
                model: CityAttributes,
                as: "cityattrs",
                attributes: ["name"],
                where: { languageId: { [Op.eq]: 1 } },
              },
            ],
          },
          {
            model: City,
            as: "destinationCity",
            include: [
              {
                model: CityAttributes,
                as: "cityattrs",
                attributes: ["name"],
                where: { languageId: { [Op.eq]: 1 } },
              },
            ],
          },
          {
            model: TicketMeta,
            as: "typeMeta",
            attributes: ["id", "meta_key"],
          },
        ],
      });

      if (!ticket) {
        throw AdminAPIError.NotFoundError(`Квиток з id ${id} не знайдено`);
      }

      // Build the selectedBusFlight shape that getTicketSubject expects.
      const selectedBusFlight = {
        cities: {
          from: { name: ticket?.originCity?.cityattrs?.[0]?.name },
          to: { name: ticket?.destinationCity?.cityattrs?.[0]?.name },
        },
        dates: {
          departure: transformDate(ticket?.dateOfDeparture),
          return: transformDate(ticket?.dateOfReturn),
        },
        type: ticket?.typeMeta?.meta_key,
      };

      await ensureTicketPDFAndSendEmail({
        ticket,
        signature: ticket.signature,
        email,
        passangersData: [], // empty: admin letter body will only show orderId
        selectedBusFlight,
        transactionId: ticket.transactionId,
        orderId: ticket.transactionId,
        getTicketSubjectFn: getTicketSubject,
      });

      return res.json({ status: "ok", message: `Email sent to ${email}` });
    } catch (err) {
      return next(err);
    }
  },
);
*/

/**
 * @swagger
 * /api/admin/tickets/generate-pdf:
 *   post:
 *     summary: (Re)generate per-passenger PDFs for a ticket
 *     description: >
 *       Generates one PDF per passenger (adult + child). When `passengerId` is
 *       provided, only that passenger's PDF is (re)generated; otherwise every
 *       passenger on the ticket is regenerated. Old PDFs are replaced and the
 *       new filenames are written back to `passengertickets.PDFFileName`.
 *     tags: [Admin / Tickets]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [id]
 *             properties:
 *               id: { type: integer, description: "Ticket ID" }
 *               passengerId:
 *                 type: integer
 *                 nullable: true
 *                 description: Optional — (re)generate only this passenger's PDF
 *     responses:
 *       200:
 *         description: PDFs generated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   $ref: '#/components/schemas/OkStatus'
 *                 data:
 *                   type: object
 *                   properties:
 *                     ticketId: { type: string }
 *       400:
 *         description: No passengers on ticket
 *       404:
 *         description: Ticket not found
 */
router.post(
  '/generate-pdf',
  [
    body('id').isInt(),
    // Optional: when provided, only this passenger's PDF is (re)generated.
    body('passengerId').isInt().optional({ values: 'null' }),
    checkUserAuth,
    checkUserBlocked,
    checkUserActivation,
    checkUserPermissions(constants.ADMIN_ROLE)
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw AdminAPIError.ValidationError(
          'Помилка при валідації',
          errors.array()
        );
      }

      const { id, passengerId } = req?.body ?? {};

      // Fetch ticket with all necessary relations
      const ticket = await loadTicketWithRelations(id);

      if (!ticket) {
        throw AdminAPIError.NotFoundError(`Квиток з id ${id} не знайдено`);
      }

      if (!ticket.passengertickets?.length) {
        throw AdminAPIError.BadRequestError('Помилка', [
          `У квитку з id ${id} немає жодного дорослого пасажира`
        ]);
      }

      // When a specific passenger is requested, make sure they belong to this
      // ticket before generating.
      if (
        passengerId != null &&
        !ticket.passengertickets.some(
          (pt) => String(pt.passengerId) === String(passengerId)
        )
      ) {
        throw AdminAPIError.NotFoundError(
          `Пасажира з id ${passengerId} у квитку з id ${id} не знайдено`
        );
      }

      // Generate the PDF file(s). generatePerPassengerPDFs builds all shared
      // ticket data once, then renders a single-passenger HTML ticket per
      // passenger (or just the requested one when passengerId is given),
      // produces a PDF with a unique filename, and cleans up any old file that
      // existed for that passenger. It returns [{ key, pdfName, ptId }, ...].
      const perPassengerResults = await generatePerPassengerPDFs(
        ticket,
        passengerId ?? null
      );

      console.log('perPassengerResults: ', perPassengerResults);

      // Write the new PDF filenames back to PassengerTicket.PDFFileName
      // (adults and children alike)
      await persistPerPassengerPDFs(ticket, perPassengerResults);

      return res.json({
        status: 'ok',
        data: { ticketId: ticket?.id ? String(ticket?.id) : '' }
      });
    } catch (err) {
      return next(err);
    }
  }
);

/**
 * @swagger
 * /api/admin/tickets/delete-pdf:
 *   post:
 *     summary: Delete generated PDF(s) for a ticket
 *     description: >
 *       Deletes generated PDF file(s) and clears the corresponding DB pointers.
 *       When `passengerId` is provided, that passenger's per-passenger PDF is
 *       deleted; if it has none, the legacy ticket-level PDF (its fallback) is
 *       deleted instead. Without `passengerId`, every per-passenger PDF plus the
 *       ticket-level PDF are removed. Idempotent: anything already absent is
 *       skipped.
 *     tags: [Admin / Tickets]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [id]
 *             properties:
 *               id: { type: integer, description: "Ticket ID" }
 *               passengerId:
 *                 type: integer
 *                 nullable: true
 *                 description: Optional — delete only this passenger's PDF
 *     responses:
 *       200:
 *         description: PDF(s) deleted
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   $ref: '#/components/schemas/OkStatus'
 *                 data:
 *                   type: object
 *                   properties:
 *                     ticketId: { type: string }
 *                     deleted: { type: integer, description: "Number of PDF files removed" }
 *       404:
 *         description: Ticket or passenger not found
 */
router.post(
  '/delete-pdf',
  [
    body('id').isInt(),
    // Optional: when provided, only this passenger's PDF is deleted.
    body('passengerId').isInt().optional({ values: 'null' }),
    checkUserAuth,
    checkUserBlocked,
    checkUserActivation,
    checkUserPermissions(constants.ADMIN_ROLE)
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw AdminAPIError.ValidationError(
          'Помилка при валідації',
          errors.array()
        );
      }

      const { id, passengerId } = req?.body ?? {};

      const ticket = await Ticket.findOne({
        attributes: ['id', 'PDFFileName', 'prevPDFFileName'],
        where: { id },
        include: [
          {
            model: PassengerTicket,
            attributes: ['id', 'passengerId', 'PDFFileName']
          }
        ]
      });

      if (!ticket) {
        throw AdminAPIError.NotFoundError(`Квиток з id ${id} не знайдено`);
      }

      const passengerTickets = ticket.passengertickets || [];

      // Pick the target rows: one passenger when passengerId is given (which
      // must belong to the ticket), otherwise every passenger on the ticket.
      let targets;
      if (passengerId != null) {
        const pt = passengerTickets.find(
          (p) => String(p.passengerId) === String(passengerId)
        );
        if (!pt) {
          throw AdminAPIError.NotFoundError(
            `Пасажира з id ${passengerId} у квитку з id ${id} не знайдено`
          );
        }
        targets = [pt];
      } else {
        targets = passengerTickets;
      }

      // Delete each target's per-passenger PDF file (if any) and clear its DB pointer.
      let deleted = 0;
      let perPassengerDeleted = 0;
      for (const pt of targets) {
        if (!pt.PDFFileName) continue;
        await deleteTicketPDFFile(pt.PDFFileName);
        await PassengerTicket.update(
          { PDFFileName: null },
          { where: { id: pt.id } }
        );
        deleted += 1;
        perPassengerDeleted += 1;
      }

      // Ticket-level (legacy combined) PDF — the fallback shown for passengers
      // that have no individual PDF. Remove it when deleting all passengers, or
      // when the single targeted passenger had no per-passenger PDF of its own
      // (i.e. it was relying on the ticket-level fallback).
      if (
        (passengerId == null || perPassengerDeleted === 0) &&
        (ticket.PDFFileName || ticket.prevPDFFileName)
      ) {
        if (ticket.PDFFileName) {
          await deleteTicketPDFFile(ticket.PDFFileName);
          deleted += 1;
        }
        if (ticket.prevPDFFileName) {
          await deleteTicketPDFFile(ticket.prevPDFFileName);
          deleted += 1;
        }
        await Ticket.update(
          { PDFFileName: null, prevPDFFileName: null },
          { where: { id: ticket.id } }
        );
      }

      return res.json({
        status: 'ok',
        data: { ticketId: ticket?.id ? String(ticket?.id) : '', deleted }
      });
    } catch (err) {
      return next(err);
    }
  }
);

/**
 * @swagger
 * /api/admin/tickets/{id}:
 *   put:
 *     summary: Update a ticket
 *     description: >
 *       Updates ticket metadata (dates, flight, price, status, discount) and the
 *       passenger's fields when `passengerId` is supplied. Because edited fields
 *       appear on the generated tickets, any existing PDFs (ticket-level and
 *       per-passenger) are invalidated, so they must be regenerated afterwards.
 *     tags: [Admin / Tickets]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [type, dateOfDeparture, origin, destination, busFlightFrom, currency, status, discount]
 *             properties:
 *               type:
 *                 type: object
 *                 description: "Ticket type { id, name }; backend reads id (the ticket_type meta id)."
 *                 properties:
 *                   id: { type: string, example: "5" }
 *                   name: { type: string, example: "В одну сторону" }
 *               dateOfDeparture: { type: string, format: date }
 *               dateOfReturn: { type: string, format: date, nullable: true }
 *               origin: { type: object }
 *               destination: { type: object }
 *               busFlightFrom: { type: object }
 *               busFlightTo: { type: object, nullable: true }
 *               price: { type: integer, nullable: true, description: "Ignored; recalculated as the sum of per-passenger prices." }
 *               currency: { type: string }
 *               status:
 *                 type: object
 *                 description: "Ticket status { id, name }; backend reads id (the ticket_status meta id)."
 *                 properties:
 *                   id: { type: string, example: "1" }
 *                   name: { type: string, example: "Не оплачено" }
 *               discount:
 *                 type: object
 *                 description: "Ticket discount { percentage, name }; backend reads percentage."
 *                 properties:
 *                   percentage: { type: number, example: 10 }
 *                   name: { type: string, nullable: true }
 *               passengerId:
 *                 type: integer
 *                 nullable: true
 *                 description: "Original passenger id of the row; used to locate the junction row to update."
 *               newPassengerId:
 *                 type: integer
 *                 nullable: true
 *                 description: "Selected existing passenger to re-link this row to. When present and different from passengerId, the junction row is re-pointed to this passenger and the target passenger's identity is left untouched. Omit (or equal to passengerId) for a plain edit."
 *               passengerDiscount: { type: object, nullable: true }
 *               passengerConfirmation:
 *                 type: object
 *                 nullable: true
 *                 description: "Confirmation status; id matches a confirmation_type meta, or \"0\" for none."
 *                 properties:
 *                   id: { type: string, example: "8" }
 *                   name: { type: string, example: "Підтвердження" }
 *               agent:
 *                 type: object
 *                 nullable: true
 *                 description: "Assigned agent; id matches an agent, or \"0\" for none."
 *                 properties:
 *                   id: { type: string, example: "0" }
 *                   name: { type: string, example: "Без агента" }
 *               discountCardNumber: { type: string, nullable: true }
 *               paymentAtOfficeUAH: { type: number, nullable: true, description: "Amount paid at office, in UAH — the stored truth. The booking-currency paymentAtOffice is derived from it (round(UAH / rate)). Preferred over paymentAtOffice." }
 *               paymentOnBusUAH: { type: number, nullable: true, description: "Amount paid on bus, in UAH — the stored truth. The booking-currency paymentOnBus is derived from it. Preferred over paymentOnBus." }
 *               paymentAtOffice: { type: number, nullable: true, description: "Legacy: amount in the ticket's booking currency; used (lifted to UAH × rate) only when paymentAtOfficeUAH is absent." }
 *               paymentOnBus: { type: number, nullable: true, description: "Legacy: amount in the ticket's booking currency; used (lifted to UAH × rate) only when paymentOnBusUAH is absent." }
 *               busSeat: { type: string, nullable: true }
 *               note: { type: string, nullable: true }
 *               name: { type: string }
 *               lastName: { type: string }
 *               phone: { type: string, nullable: true }
 *               additionalPhone: { type: string, nullable: true }
 *               email: { type: string, nullable: true }
 *               dateOfBirth: { type: string, format: date, nullable: true }
 *               passengerType:
 *                 type: object
 *                 description: "Passenger type { id, name }; backend reads id (adult|child)."
 *                 properties:
 *                   id: { type: string, example: "adult" }
 *                   name: { type: string, example: "adult" }
 *     responses:
 *       200:
 *         description: Ticket updated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   $ref: '#/components/schemas/OkStatus'
 *                 data:
 *                   type: object
 *                   properties:
 *                     ticketId: { type: string }
 *       404:
 *         description: Ticket not found
 */
router.put(
  '/:id',
  [
    param('id').isInt(),
    body('type').isObject(),
    body('dateOfDeparture').isDate({
      format: 'YYYY-MM-DD',
      strictMode: true
    }),
    body('dateOfReturn')
      .isDate({
        format: 'YYYY-MM-DD',
        strictMode: true
      })
      .optional({
        values: 'null'
      }),
    body('origin').isObject(),
    body('destination').isObject(),
    body('busFlightFrom').isObject(),
    body('busFlightTo').isObject().optional({
      values: 'null'
    }),
    // price is recalculated from the per-passenger prices, so it is not required.
    body('price').isInt().optional({ values: 'null' }),
    body('currency').isString(),
    body('status').isObject(),
    body('discount').isObject(),
    body('passengerId').isInt().optional({ values: 'null' }),
    // When the row is re-pointed to a different existing passenger, the client
    // sends the selected passenger's id here; passengerId stays the original
    // (used to locate the junction row).
    body('newPassengerId').isInt().optional({ values: 'null' }),
    body('passengerDiscount').isObject().optional({ values: 'null' }),
    body('passengerConfirmation').isObject().optional({ values: 'null' }),
    body('agent').isObject().optional({ values: 'null' }),
    body('discountCardNumber').isString().optional({ values: 'null' }),
    body('paymentAtOffice').isNumeric().optional({ values: 'null' }),
    body('paymentOnBus').isNumeric().optional({ values: 'null' }),
    // UAH-native payment inputs (admin works in UAH) — the stored truth; the
    // booking-currency amount is derived from them. Preferred over the legacy
    // fields above.
    body('paymentAtOfficeUAH').isNumeric().optional({ values: 'null' }),
    body('paymentOnBusUAH').isNumeric().optional({ values: 'null' }),
    body('busSeat').isString().optional({ values: 'null' }),
    body('note').isString().optional({ values: 'null' }),
    body('name').isString().optional({ values: 'null' }),
    body('lastName').isString().optional({ values: 'null' }),
    body('phone').isString().optional({ values: 'null' }),
    body('additionalPhone').isString().optional({ values: 'null' }),
    body('email').isString().optional({ values: 'null' }),
    body('dateOfBirth').optional({ values: 'null' }),
    body('passengerType').isObject().optional({ values: 'null' }),
    checkUserAuth,
    checkUserBlocked,
    checkUserActivation,
    checkUserPermissions(constants.ADMIN_ROLE)
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw AdminAPIError.ValidationError(
          'Помилка при валідації',
          errors.array()
        );
      }
      const {
        type,
        dateOfDeparture,
        dateOfReturn,
        origin,
        destination,
        busFlightFrom,
        busFlightTo,
        price,
        currency,
        status,
        discount,
        passengerId,
        newPassengerId,
        passengerDiscount,
        passengerConfirmation,
        agent,
        discountCardNumber,
        paymentAtOffice,
        paymentOnBus,
        paymentAtOfficeUAH,
        paymentOnBusUAH,
        busSeat,
        note,
        name,
        lastName,
        phone,
        additionalPhone,
        email,
        dateOfBirth,
        passengerType
      } = req.body;
      const { id } = req.params;
      let ticket;
      const query = {
        attributes: [
          'id',
          'dateOfDeparture',
          'dateOfReturn',
          'busFlightFromId',
          'busFlightToId',
          'price',
          'currencyAbbr',
          'exchangeRate',
          'typeId',
          'statusId',
          'hasDiscount',
          'discountPercentage',
          'originId',
          'destinationId',
          'prevPDFFileName',
          'PDFFileName',
          'passengerRowCount'
        ],
        where: {
          id
        },
        include: [
          {
            model: BusFlight,
            attributes: ['id', 'routeId', 'dateOfDeparture'],
            as: 'busFlightFrom'
          },
          {
            model: BusFlight,
            attributes: ['id', 'routeId', 'dateOfDeparture'],
            as: 'busFlightTo'
          },
          {
            model: PassengerTicket,
            attributes: [
              'id',
              'passengerDiscountId',
              'discountCardNumber',
              'ticketId',
              'passengerId',
              'PDFFileName'
            ]
          }
        ],
        order: [
          ['id', 'ASC'],
          ['dateOfDeparture', 'ASC']
        ]
      };

      // Add TicketMeta includes for type and status
      query.include.push({
        model: TicketMeta,
        as: 'statusMeta',
        attributes: ['id', 'meta_key'],
        include: [
          {
            model: TicketMetaAttributes,
            as: 'ticketmetaattrs',
            attributes: ['name'],
            where: {
              languageId: {
                [Op.eq]: 1
              }
            },
            required: false
          }
        ]
      });

      query.include.push({
        model: TicketMeta,
        as: 'typeMeta',
        attributes: ['id', 'meta_key'],
        include: [
          {
            model: TicketMetaAttributes,
            as: 'ticketmetaattrs',
            attributes: ['name'],
            where: {
              languageId: {
                [Op.eq]: 1
              }
            },
            required: false
          }
        ]
      });

      ticket = await Ticket.findOne(query);
      if (!ticket) {
        throw AdminAPIError.NotFoundError(`Квиток з id ${id} не знайдено`);
      }

      // Frontend sends { id, name } objects — read the id, falling back to
      // resolving by localized name (legacy clients) when the id is absent.
      const typeId =
        parseInt(type?.id) || (await resolveMetaId(type?.name, 'ticket_type'));
      const statusId =
        parseInt(status?.id) ||
        (await resolveMetaId(status?.name, 'ticket_status'));

      // discount arrives as { percentage, name } (a bare number is tolerated).
      const discountPercentageValue =
        typeof discount === 'number' ? discount : (discount?.percentage ?? 0);

      // The admin enters UAH; resolve the booking-currency rate up front so the
      // payment conversion below and the priceUAH recompute later use one rate.
      // Reuse the rate locked at booking; re-fetch only when the currency
      // changed (or none was stored yet).
      let uahRate = Number(ticket.exchangeRate) || null;
      if (
        !uahRate ||
        String(currency).toUpperCase() !==
          String(ticket.currencyAbbr).toUpperCase()
      ) {
        uahRate = await resolveCurrencyRate(currency, uahRate || 1);
      }

      const queryObj = mapStringsToConstants({
        dateOfDeparture: dateOfDeparture,
        dateOfReturn: dateOfReturn,
        busFlightFromId: busFlightFrom?.id,
        busFlightToId: busFlightTo?.id || null,
        price: price,
        currencyAbbr: currency,
        typeId: typeId,
        statusId: statusId,
        hasDiscount:
          hasActualDiscount(busFlightFrom) ||
          hasActualDiscount(busFlightTo) ||
          (discountPercentageValue > 0 &&
            !busFlightFrom?.discount &&
            !busFlightTo?.discount),
        discountPercentage: discountPercentageValue,
        originId: origin?.id,
        destinationId: destination?.id
      });
      const queryOpts = {
        where: {
          id
        },
        returning: true
      };

      if (passengerId) {
        // Re-link mode: the row was re-pointed to a different existing
        // passenger. `passengerId` is the original (used to locate the
        // junction row); `newPassengerId` is the selected passenger to link.
        // When newPassengerId is absent or equal to passengerId, this is a
        // plain edit of the current passenger (behaves exactly as before).
        const targetPassengerId = parseInt(newPassengerId) || null;
        const isRelink =
          targetPassengerId && targetPassengerId !== parseInt(passengerId);

        // The admin enters payments in UAH (the stored truth); derive the
        // booking-currency amounts for the customer-facing PDF. A legacy
        // booking-currency input is lifted to UAH (× rate) for older clients.
        const officeUAH = resolveUahTruth(
          paymentAtOfficeUAH,
          paymentAtOffice,
          uahRate
        );
        const busUAH = resolveUahTruth(paymentOnBusUAH, paymentOnBus, uahRate);

        // Per-passenger priceUAH = (officeUAH + busUAH) × discount multiplier
        // (the UAH truth); the booking price is derived from it. A ticket-level
        // discount overrides the per-passenger one.
        const effectivePct =
          discountPercentageValue > 0
            ? discountPercentageValue
            : Number(passengerDiscount?.percentage) || 0;
        const passengerPriceUAHValue = Math.round(
          ((Number(officeUAH) || 0) + (Number(busUAH) || 0)) *
            (1 - effectivePct / 100)
        );

        const passengerTicketUpdate = {
          passengerDiscountId: parseInt(passengerDiscount?.id) || null,
          confirmationId: parseInt(passengerConfirmation?.id) || null,
          agentId: parseInt(agent?.id) || null,
          discountCardNumber: parseInt(discountCardNumber) || null,
          paymentAtOfficeUAH: officeUAH,
          paymentOnBusUAH: busUAH,
          priceUAH: passengerPriceUAHValue,
          paymentAtOffice: uahToBooking(officeUAH, uahRate),
          paymentOnBus: uahToBooking(busUAH, uahRate),
          busSeat: busSeat ?? null,
          note: note ?? null,
          price: Math.round(passengerPriceUAHValue / (uahRate || 1))
        };
        // Re-point this ticket's junction row to the selected passenger.
        if (isRelink) passengerTicketUpdate.passengerId = targetPassengerId;

        await PassengerTicket.update(passengerTicketUpdate, {
          where: {
            [Op.and]: [{ passengerId: passengerId }, { ticketId: ticket?.id }]
          }
        });

        // In re-link mode we point at an existing passenger and must NOT edit
        // their identity. Only persist edits to the passenger's own fields
        // (name, contacts, DOB, type) on a plain edit of the current passenger.
        if (!isRelink) {
          // The frontend sends "-" as an empty-placeholder; normalize those to
          // null for optional fields (email in particular must be null, not
          // "-", or the model's isEmail validator rejects the update).
          const blankPlaceholder = (v) =>
            v === undefined || v === null || v === '' || v === '-' ? null : v;

          const passengerUpdate = {};
          if (name !== undefined) passengerUpdate.name = name;
          if (lastName !== undefined) passengerUpdate.lastName = lastName;
          if (phone !== undefined) passengerUpdate.phone = phone;
          if (additionalPhone !== undefined)
            passengerUpdate.additionalPhone = blankPlaceholder(additionalPhone);
          if (email !== undefined)
            passengerUpdate.email = blankPlaceholder(email);
          if (dateOfBirth !== undefined)
            passengerUpdate.dateOfBirth = dateOfBirth || null;
          // passengerType arrives as { id, name } ("adult" | "child"); a bare
          // string is tolerated for legacy clients.
          const passengerTypeValue = passengerType?.id || passengerType;
          if (passengerTypeValue) passengerUpdate.type = passengerTypeValue;

          if (Object.keys(passengerUpdate).length) {
            await Passenger.update(passengerUpdate, {
              where: { id: passengerId }
            });
          }
        }
      }

      // ticket.price is a calculated value: the sum of its passengers' prices.
      const ticketTotalPrice = await PassengerTicket.sum('price', {
        where: { ticketId: ticket?.id }
      });
      queryObj.price = Math.round(ticketTotalPrice) || 0;

      // updateTicketPDFFile archives the legacy ticket-level PDF. Any edit can
      // also change fields printed on the per-passenger PDFs (names, dates,
      // route, prices, discounts, seat, confirmation, …), so invalidate those
      // too: delete the stale files and clear their pointers. isPDFExists then
      // reports false until the admin regenerates via "Generate PDF".
      for (const pt of ticket.passengertickets || []) {
        if (!pt.PDFFileName) continue;
        await deleteTicketPDFFile(pt.PDFFileName);
        await PassengerTicket.update(
          { PDFFileName: null },
          { where: { id: pt.id } }
        );
      }

      await updateTicketPDFFile(ticket, null, queryObj);
      await Ticket.update(queryObj, queryOpts);

      // Keep the canonical UAH amounts in sync with the edited prices, using the
      // same rate resolved above for the UAH→booking payment conversion.
      await recomputeTicketMoney(ticket.id, uahRate);

      if (
        String(ticket?.busFlightFromId) !== String(busFlightFrom?.id) ||
        String(ticket?.busFlightToId) !== String(busFlightTo?.id)
      ) {
        await BusFlight.increment(
          {
            freeSeats: parseInt(ticket?.passengerRowCount || 0)
          },
          {
            where: {
              [Op.or]: [
                {
                  id: ticket?.busFlightFrom?.id || null
                },
                {
                  id: ticket?.busFlightTo?.id || null
                }
              ]
            }
          }
        );

        await BusFlight.decrement(
          {
            freeSeats: parseInt(ticket?.passengerRowCount || 0)
          },
          {
            where: {
              [Op.or]: [
                {
                  id: busFlightFrom?.id || null
                },
                {
                  id: busFlightTo?.id || null
                }
              ]
            }
          }
        );
      }

      // const currPassengers = passengers.map(el => {
      //     return {
      //         id: String(el?.passengerId),
      //         name: String(el?.name),
      //         lastName: String(el?.lastName),
      //         phone: String(el?.phone),
      //         additionalPhone: String(el?.additionalPhone || '-'),
      //         dateOfBirth: new Date(el?.dateOfBirth).toString(),
      //         email: String(el?.email),
      //         discount: String(el?.passengerDiscount?.id || 0),
      //         discountCardNumber: el?.discountCardNumber
      //     }
      // }).sort((a, b) => Number(a.id) > Number(b.id));

      // const prevPassengers = ticket.passengertickets.map(el => {
      //     return {
      //         id: String(el?.passenger?.id),
      //         name: String(el?.passenger?.name),
      //         lastName: String(el?.passenger?.lastName),
      //         phone: String(el?.passenger?.phone),
      //         additionalPhone: String(el?.passenger?.additionalPhone || '-'),
      //         dateOfBirth: new Date(el?.passenger?.dateOfBirth).toString(),
      //         email: String(el?.passenger?.email),
      //         discount: String(el?.discount?.id || 0),
      //         discountCardNumber: el?.discountCardNumber
      //     }
      // }).sort((a, b) => Number(a.id) > Number(b.id));

      // if (
      //     hashCode(JSON.stringify(currPassengers)) !== hashCode(JSON.stringify(prevPassengers))
      // ) {

      //     const passengersData = passengers.map(el => {

      //         const result = {
      //             id: el?.passengerId,
      //             name: el?.name,
      //             lastName: el?.lastName,
      //             phone: el?.phone,
      //             additionalPhone: el?.additionalPhone,
      //             dateOfBirth: el?.dateOfBirth,
      //             email: el?.email || null
      //         }

      //         if(!result?.id) return null;

      //         return result;
      //     }).filter(Boolean);

      //     const passengersTicketData = passengers.map(el => {
      //         const result = {
      //             id: ticket.passengertickets.find(elem => (String(elem?.passengerId) === String(el?.passengerId) && String(elem?.ticketId) === String(ticket?.id)))?.id,
      //             passengerId: el?.passengerId,
      //             ticketId: ticket?.id
      //         }

      //         if(!result?.id || !result?.passengerId) return null;

      //         if (parseInt(el?.passengerDiscount?.id)) {
      //             result["passengerDiscountId"] = parseInt(el.passengerDiscount.id);
      //         }

      //         if (el?.discountCardNumber) {
      //             result["discountCardNumber"] = el.discountCardNumber;
      //         }

      //         return result;
      //     }).filter(Boolean);

      //     await PassengerTicket.bulkCreate(passengersTicketData, {
      //         updateOnDuplicate: ['passengerDiscountId', 'discountCardNumber', 'passengerId', 'ticketId']
      //     });

      //     await Passenger.bulkCreate(passengersData, {
      //         updateOnDuplicate: ['name', 'lastName', 'phone', 'additionalPhone', 'dateOfBirth', 'email']
      //     });

      //     const currPassengersEssentialFields = passengers.map(el => {
      //         return {
      //             id: String(el?.passengerId),
      //             name: String(el?.name),
      //             lastName: String(el?.lastName),
      //             dateOfBirth: new Date(el?.dateOfBirth).toString(),
      //         }
      //     }).sort((a, b) => Number(a.id) > Number(b.id));

      //     const prevPassengersEssentialFields = ticket.passengertickets.map(el => {
      //         return {
      //             id: String(el?.passenger?.id),
      //             name: String(el?.passenger?.name),
      //             lastName: String(el?.passenger?.lastName),
      //             dateOfBirth: new Date(el?.passenger?.dateOfBirth).toString(),
      //         }
      //     }).sort((a, b) => Number(a.id) > Number(b.id));

      //     // const passangerIds = [];
      //     const passangerIds = (await Promise.all(currPassengersEssentialFields.map(async passenger => {
      //         const prevPassenger = prevPassengersEssentialFields.find(el => el.id === passenger.id);
      //         if (hashCode(JSON.stringify(passenger)) !== hashCode(JSON.stringify(prevPassenger))) {
      //             return [passenger.id, prevPassenger.id];
      //         }
      //         return null;
      //     }))).filter(Boolean)?.flat();

      //     const passangerIdsWithoutDuplicates = Array.from(new Set(passangerIds));

      //     if (passangerIdsWithoutDuplicates.length) {

      //         const resultTickets = await Ticket.findAll({
      //             where: {
      //                 '$passengertickets.passenger.id$': {
      //                     [Op.in]: passangerIdsWithoutDuplicates,
      //                 }
      //             },
      //             include: [{
      //                 model: PassengerTicket,
      //                 attributes: [
      //                     "id",
      //                     "ticketId",
      //                     "passengerId"
      //                 ],
      //                 include: [{
      //                     model: Passenger,
      //                     attributes: [
      //                         "id"
      //                     ]
      //                 }, ]
      //             }]
      //         });

      //         const t = await sequelize.transaction();
      //         try {
      //             await Promise.all(resultTickets?.map(async el => {
      //                 await updateTicketPDFFile(el, t);
      //                 return el.id;
      //             }));
      //             await t.commit();
      //         } catch (err) {
      //             await t.rollback();
      //         }

      //         // const resultTickets2 = await Ticket.findAll({
      //         //     where: {
      //         //         '$passengertickets.passenger.id$': {
      //         //             [Op.in]: passangerIdsWithoutDuplicates,
      //         //         }
      //         //     },
      //         //     include: [{
      //         //         model: PassengerTicket,
      //         //         attributes: [
      //         //             "id",
      //         //             "ticketId",
      //         //             "passengerId"
      //         //         ],
      //         //         include: [{
      //         //             model: Passenger,
      //         //             attributes: [
      //         //                 "id"
      //         //             ]
      //         //         }, ]
      //         //     }]
      //         // });

      //         // console.log(resultTickets2, "resultTickets2");
      //     }
      // }

      return res.json({
        status: 'ok',
        data: { ticketId: ticket?.id ? String(ticket?.id) : '' }
      });
    } catch (err) {
      return next(err);
    }
  }
);

/**
 * @swagger
 * /api/admin/tickets/{id}:
 *   delete:
 *     summary: Delete a ticket
 *     description: Deletes the ticket and its PDF files, and restores `freeSeats` on associated flights.
 *     tags: [Admin / Tickets]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Ticket deleted
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   $ref: '#/components/schemas/OkStatus'
 *                 data:
 *                   type: object
 *                   properties:
 *                     ticketId: { type: string }
 *       404:
 *         description: Ticket not found
 */
router.delete(
  '/:id',
  [
    param('id').isInt(),
    checkUserAuth,
    checkUserBlocked,
    checkUserActivation,
    checkUserPermissions(constants.ADMIN_ROLE)
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw AdminAPIError.ValidationError(
          'Помилка при валідації',
          errors.array()
        );
      }
      const { id } = req.params;
      let ticket;
      const query = {
        attributes: [
          'id',
          'dateOfDeparture',
          'dateOfReturn',
          'busFlightFromId',
          'busFlightToId',
          'price',
          'currencyAbbr',
          'typeId',
          'statusId',
          'hasDiscount',
          'discountPercentage',
          'PDFFileName',
          'prevPDFFileName',
          'originId',
          'destinationId',
          'passengerRowCount'
        ],
        where: {
          id
        },
        include: [
          {
            model: BusFlight,
            attributes: ['id', 'routeId', 'dateOfDeparture'],
            as: 'busFlightFrom'
          },
          {
            model: BusFlight,
            attributes: ['id', 'routeId', 'dateOfDeparture'],
            as: 'busFlightTo'
          },
          {
            // Load each passenger's type + PDF filename so deleteTicketCascade
            // can remove child passengers and their per-passenger PDF files.
            model: PassengerTicket,
            attributes: ['id', 'ticketId', 'passengerId', 'PDFFileName'],
            include: [{ model: Passenger, attributes: ['id', 'type'] }]
          }
        ],
        order: [
          ['id', 'ASC'],
          ['dateOfDeparture', 'ASC']
        ]
      };

      ticket = await Ticket.findOne(query);

      if (!ticket) {
        throw AdminAPIError.NotFoundError(`Квиток з id ${id} не знайдено`);
      }

      // Delete the ticket and everything attached to it (junction rows, child
      // passengers, ticket-level + per-passenger PDF files) and restore seats.
      await deleteTicketCascade(ticket);

      return res.json({
        status: 'ok',
        data: { ticketId: ticket?.id ? String(ticket?.id) : '' }
      });
    } catch (err) {
      return next(err);
    }
  }
);

/**
 * @swagger
 * /api/admin/tickets/passengers/{id}:
 *   delete:
 *     summary: Remove a passenger from a ticket
 *     description: >
 *       Unlinks the passenger from the ticket, deletes that passenger's PDF, and
 *       restores one free seat. For `type=child`, also deletes the child
 *       passenger row. If the passenger is the last one on the ticket, the whole
 *       ticket is deleted instead (all junction rows, child passengers, and
 *       ticket-level + per-passenger PDF files), restoring all its seats.
 *     tags: [Admin / Tickets]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *         description: Ticket ID
 *       - in: query
 *         name: passengerId
 *         required: true
 *         schema: { type: string }
 *         description: Passenger ID to remove
 *       - in: query
 *         name: type
 *         required: true
 *         schema: { type: string, enum: [adult, child] }
 *     responses:
 *       200:
 *         description: Passenger removed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   $ref: '#/components/schemas/OkStatus'
 *                 data:
 *                   type: object
 *                   properties:
 *                     ticketId: { type: string }
 *       400:
 *         description: Passenger not on this ticket
 *       404:
 *         description: Ticket or passenger not found
 */
router.delete(
  '/passengers/:id',
  [
    param('id').isInt(),
    query('passengerId').isString(),
    query('type').isString(),
    checkUserAuth,
    checkUserBlocked,
    checkUserActivation,
    checkUserPermissions(constants.ADMIN_ROLE)
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw AdminAPIError.ValidationError(
          'Помилка при валідації',
          errors.array()
        );
      }
      const { id } = req.params;
      const { passengerId, type } = req.query;

      const query = {
        attributes: [
          'id',
          'busFlightFromId',
          'busFlightToId',
          'passengerRowCount',
          'exchangeRate',
          'prevPDFFileName',
          'PDFFileName'
        ],
        where: {
          id
        },
        include: [
          {
            // Every passenger on the ticket, with its type + PDF filename, so we
            // can count them, clean the right files, and (when this is the last
            // passenger) hand the whole ticket to deleteTicketCascade.
            model: PassengerTicket,
            attributes: ['id', 'ticketId', 'passengerId', 'PDFFileName'],
            include: [{ model: Passenger, attributes: ['id', 'type'] }]
          }
        ],
        order: [['id', 'ASC']]
      };
      const ticket = await Ticket.findOne(query);

      if (!ticket) {
        throw AdminAPIError.NotFoundError(`Квиток з id ${id} не знайдено`);
      }

      const passengerTickets = ticket.passengertickets || [];
      const targetPT = passengerTickets.find(
        (pt) => String(pt.passengerId) === String(passengerId)
      );

      if (!targetPT) {
        throw AdminAPIError.BadRequestError('Помилка', [
          `Пасажира з id ${passengerId} немає у квитку з id ${id}`
        ]);
      }

      // Last passenger on the ticket → delete the whole ticket and all its data
      // (junction rows, child passengers, every PDF file) and restore its seats.
      if (passengerTickets.length <= 1) {
        await deleteTicketCascade(ticket);
        return res.json({
          status: 'ok',
          data: { ticketId: ticket?.id ? String(ticket?.id) : '' }
        });
      }

      // Otherwise remove just this one passenger.
      const isChild = type === 'child' || targetPT?.passenger?.type === 'child';

      // 1. This passenger's individual PDF file.
      if (targetPT.PDFFileName) await deleteTicketPDFFile(targetPT.PDFFileName);

      // 2. The junction row (and the child passenger record, which is 1:1).
      await PassengerTicket.destroy({
        where: {
          [Op.and]: [{ ticketId: ticket.id }, { passengerId }]
        }
      });
      if (isChild) {
        await Passenger.destroy({ where: { id: passengerId, type: 'child' } });
      }

      // 3. ticket.price is the sum of the remaining passengers' prices.
      const ticketTotalPrice = await PassengerTicket.sum('price', {
        where: { ticketId: ticket.id }
      });
      await Ticket.update(
        { price: Math.round(ticketTotalPrice) || 0 },
        { where: { id: ticket.id } }
      );
      // Keep the canonical UAH amounts consistent after the roster change.
      await recomputeTicketMoney(ticket.id, ticket.exchangeRate || 1);

      // 4. Archive the combined ticket PDF and free up this passenger's seat.
      await updateTicketPDFFile(ticket);
      await BusFlight.increment(
        {
          freeSeats: 1
        },
        {
          where: {
            [Op.or]: [
              { id: ticket?.busFlightFromId || null },
              { id: ticket?.busFlightToId || null }
            ]
          }
        }
      );

      return res.json({
        status: 'ok',
        data: { ticketId: ticket?.id ? String(ticket?.id) : '' }
      });
    } catch (err) {
      return next(err);
    }
  }
);

module.exports = router;
