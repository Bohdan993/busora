/** @format */

// The whole booking flow over HTTP against a real MySQL: search → select →
// passengers → checkout → mock payment → ticket, PDFs, email, download.
//
//   npm run test:integration
//
// Needs the migrated + seeded database from .env (or the DB_* env vars) and
// Mailpit for the confirmation email (MAILPIT_URL, default localhost:8025).
// Sessions use the in-memory store, payments the mock provider and exchange
// rates a fixed table, so the run doesn't depend on Redis or the NBU API.
// Tickets created here are deleted again afterwards (seats are restored).

const path = require('path');
const crypto = require('crypto');

process.chdir(path.resolve(__dirname, '..'));
process.env.NODE_ENV = 'test';
require('module-alias/register');
require('dotenv').config();

const CZK_RATE = 2.08;
// Empty, not deleted: the DB config loads .env again, and dotenv only fills
// variables that are unset
process.env.REDIS_HOST = '';
process.env.SESSION_COOKIE_SECURE = 'false';
process.env.PAYMENT_PROVIDER = 'mock';
process.env.EXCHANGE_RATE_PROVIDER = 'fixed';
process.env.FIXED_EXCHANGE_RATES = `CZK=${CZK_RATE}`;
process.env.MOCK_PAYMENT_SECRET ||= crypto.randomBytes(32).toString('hex');
process.env.SESSION_SECRET ||= crypto.randomBytes(32).toString('hex');
const MAILPIT_URL = process.env.MAILPIT_URL || 'http://localhost:8025';

const fs = require('fs');
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');

const { app } = require('@api/index');
const {
  sequelize,
  ticket: Ticket,
  busflight: BusFlight
} = require('@database/models/index');
const { loadTicketWithRelations } = require('@services/admin/ticketPdfService');
const { deleteTicketCascade } = require('@services/ticketService');
const { decodePayload } = require('@services/payments/signedPayload');

const PRAHA = 8;
const KYIV = 1;
const EMAIL = 'integration-test@busora.test';

let server;
let baseUrl;
const startedAt = new Date();
const createdTransactionIds = [];

/** A cookie-keeping HTTP client: one instance = one browser. */
function createClient() {
  let cookie = '';
  return async function call(method, url, body) {
    const res = await fetch(baseUrl + url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(cookie && { Cookie: cookie })
      },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    const setCookie = res.headers.get('set-cookie');
    if (setCookie) cookie = setCookie.split(';')[0];
    const type = res.headers.get('content-type') || '';
    const payload = type.includes('json')
      ? await res.json()
      : Buffer.from(await res.arrayBuffer());
    return { status: res.status, type, body: payload };
  };
}

const isoDate = (date) => date.toISOString().slice(0, 10);

async function searchPrahaKyiv(call, { adults, children }) {
  const dates = await call(
    'GET',
    `/bus-flights/available-dates?originId=${PRAHA}&destinationId=${KYIV}` +
      `&startDate=${isoDate(new Date(Date.now() + 864e5))}`
  );
  assert.equal(dates.status, 200, JSON.stringify(dates.body));
  // About a week out: clear of today's cut-off, inside the seeded schedule
  const startDate = dates.body.data[6] ?? dates.body.data[0];
  const query = new URLSearchParams({
    originId: PRAHA,
    destinationId: KYIV,
    startDate,
    endDate: 'one-way',
    adults,
    children,
    currencyAbbr: 'CZK',
    languageCode: 'cs_CZ'
  });
  return call('GET', `/bus-flights?${query}`);
}

before(async () => {
  await sequelize.authenticate();
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}/api`;
});

after(async () => {
  for (const transactionId of createdTransactionIds) {
    const ticket = await Ticket.findOne({ where: { transactionId } });
    if (ticket) {
      await deleteTicketCascade(await loadTicketWithRelations(ticket.id));
    }
  }
  await new Promise((resolve) => server?.close(resolve));
  await sequelize.close();
});

test('a paid Czech booking produces one ticket, PDFs, an email and a download', async (t) => {
  const call = createClient();
  const state = {};

  await t.test('cities are listed in Czech', async () => {
    const res = await call('GET', '/cities?languageCode=cs_CZ');
    assert.equal(res.status, 200);
    const names = res.body.data.flatMap((group) =>
      group.cities.map((city) => city.cityattrs[0].name)
    );
    assert.ok(names.includes('Praha'), names.join(', '));
  });

  await t.test('search starts a session with priced offers', async () => {
    const res = await searchPrahaKyiv(call, { adults: 2, children: 1 });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    const [offer] = res.body.data;
    assert.equal(offer.cities.from.id, PRAHA);
    assert.ok(Number(offer.purePrice) > 0);
    state.offer = offer;
  });

  await t.test('selecting the offer succeeds', async () => {
    const res = await call('POST', '/bus-flights/select', {
      id: state.offer.id,
      isMain: true
    });
    assert.equal(res.status, 200, JSON.stringify(res.body));
  });

  await t.test(
    'a client cannot write the exchange rate into the session',
    async () => {
      const res = await call('POST', '/current-data', {
        currencyExchangeRate: 0.01
      });
      assert.equal(res.status, 400);
      assert.equal(res.body.code, 'BAD_REQUEST');
    }
  );

  await t.test('the passenger form offers child discounts in CZK', async () => {
    const res = await call('GET', '/passengers?languageCode=cs_CZ');
    assert.equal(res.status, 200, JSON.stringify(res.body));
    const form = res.body.data;
    assert.equal(form.adults, 2);
    assert.equal(form.children, 1);
    assert.equal(form.currency.abbr, 'CZK');
    assert.equal(form.ticketPrice, Number(state.offer.purePrice));
    const children = form.discounts.find((g) => g.group === 'children');
    state.childDiscount = children.items.find((d) => d.maxAge === 11);
    assert.ok(state.childDiscount, 'a discount for children up to 11');
  });

  await t.test('a German phone number is rejected', async () => {
    const res = await call('POST', '/passengers/validate?languageCode=cs_CZ', {
      passengersData: {
        'adult-passenger-1': {
          'name-1': 'Jana',
          'last-name-1': 'Novakova',
          'phone-1': '+4915112345678',
          'email-1': EMAIL,
          'date-of-birth-1': '1985-03-20'
        }
      }
    });
    assert.equal(res.status, 422);
    assert.equal(res.body.code, 'VALIDATION_FAILED');
    assert.ok(res.body.errors['phone-1'], JSON.stringify(res.body.errors));
  });

  await t.test('two adults and a seven-year-old are accepted', async () => {
    const departure = new Date(state.offer.dates.departurePure);
    const childBirthYear = departure.getUTCFullYear() - 7;
    const res = await call('POST', '/passengers/validate?languageCode=cs_CZ', {
      passengersData: {
        'adult-passenger-1': {
          'name-1': 'Jana',
          'last-name-1': 'Novakova',
          'phone-1': '+420601123456',
          'email-1': EMAIL,
          'date-of-birth-1': '1985-03-20'
        },
        'adult-passenger-2': {
          'name-2': 'Petr',
          'last-name-2': 'Novak',
          'phone-2': '+420777123456',
          'date-of-birth-2': '1983-07-11'
        },
        'child-passenger-3': {
          'name-3': 'Eva',
          'last-name-3': 'Novakova',
          'date-of-birth-3': `${childBirthYear}-01-15`,
          'discount-3': String(state.childDiscount.id)
        }
      }
    });
    assert.equal(res.status, 200, JSON.stringify(res.body));
  });

  await t.test('the review total applies the child discount', async () => {
    const res = await call('GET', '/current-data');
    assert.equal(res.status, 200);
    const fare = Number(state.offer.purePrice);
    const childFare = Math.round(fare * (1 - state.childDiscount.coef));
    assert.equal(res.body.data.price, 2 * fare + childFare);
    state.priceCzk = res.body.data.price;
  });

  await t.test('checkout charges the CZK total in UAH', async () => {
    const flight = await BusFlight.findByPk(state.offer.busFlightFromId);
    state.freeSeatsBefore = flight.freeSeats;

    const res = await call('POST', '/payment?languageCode=cs_CZ');
    assert.equal(res.status, 200, JSON.stringify(res.body));
    const checkout = res.body.data;
    assert.equal(checkout.provider, 'mock');
    assert.equal(checkout.currency, 'UAH');
    assert.equal(checkout.amount, Math.round(state.priceCzk * CZK_RATE));
    state.checkout = checkout;
  });

  await t.test(
    'paying creates the ticket with per-passenger PDFs',
    async () => {
      const { data, signature } = state.checkout;
      const res = await call('POST', '/payment/mock/complete', {
        data,
        signature,
        outcome: 'success'
      });
      assert.equal(res.status, 200, JSON.stringify(res.body));
      assert.equal(res.body.data.outcome, 'success');
      state.paid = res.body.data;
      state.transactionId = decodePayload(state.paid.data).transaction_id;
      createdTransactionIds.push(state.transactionId);

      const ticket = await Ticket.findOne({
        where: { transactionId: state.transactionId }
      });
      const loaded = await loadTicketWithRelations(ticket.id);
      assert.equal(loaded.language.code, 'cs_CZ');
      assert.equal(loaded.passengertickets.length, 3);
      for (const row of loaded.passengertickets) {
        const pdf = path.resolve('assets', 'tickets', `${row.PDFFileName}.pdf`);
        assert.ok(fs.existsSync(pdf), `PDF on disk: ${pdf}`);
      }
      const paidPerPassenger = loaded.passengertickets.map((row) =>
        Number(row.priceUAH)
      );
      assert.equal(
        paidPerPassenger.reduce((sum, price) => sum + price, 0),
        state.checkout.amount
      );

      const flight = await BusFlight.findByPk(state.offer.busFlightFromId);
      assert.equal(flight.freeSeats, state.freeSeatsBefore - 3);
    }
  );

  await t.test(
    'completing the same payment again changes nothing',
    async () => {
      const { data, signature } = state.checkout;
      const res = await call('POST', '/payment/mock/complete', {
        data,
        signature,
        outcome: 'success'
      });
      assert.equal(res.status, 200, JSON.stringify(res.body));
      const tickets = await Ticket.count({
        where: { transactionId: state.transactionId }
      });
      assert.equal(tickets, 1);
      const flight = await BusFlight.findByPk(state.offer.busFlightFromId);
      assert.equal(flight.freeSeats, state.freeSeatsBefore - 3);
    }
  );

  await t.test('the success page summary ends the session', async () => {
    const res = await call('POST', '/tickets/summary', {
      data: state.paid.data,
      signature: state.paid.signature
    });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    const summary = res.body.data;
    assert.equal(summary.languageCode, 'cs_CZ');
    assert.equal(summary.origin.name, 'Praha');
    assert.equal(summary.passengers.length, 3);
    assert.deepEqual(summary.amountPaid, {
      amount: state.checkout.amount,
      currency: 'UAH'
    });

    const after = await call('GET', '/current-data/is-started');
    assert.equal(after.status, 401);
    assert.equal(after.body.code, 'SESSION_NOT_STARTED');
  });

  await t.test('the tickets download as a ZIP of three PDFs', async () => {
    const res = await call('POST', '/tickets/download-pdf', {
      data: state.paid.data,
      signature: state.paid.signature
    });
    assert.equal(res.status, 200);
    assert.match(res.type, /zip/);
    assert.equal(res.body.subarray(0, 2).toString(), 'PK');
  });

  await t.test('the confirmation email carries the three PDFs', async () => {
    const res = await fetch(
      `${MAILPIT_URL}/api/v1/search?query=${encodeURIComponent(`to:${EMAIL}`)}`
    );
    assert.equal(res.status, 200, `Mailpit at ${MAILPIT_URL}`);
    const { messages } = await res.json();
    const mail = messages.find((m) => new Date(m.Created) >= startedAt);
    assert.ok(mail, `an email to ${EMAIL} sent during this run`);
    assert.equal(mail.Attachments, 3);
  });
});

test('a declined payment creates no ticket and keeps the seats', async () => {
  const call = createClient();
  const search = await searchPrahaKyiv(call, { adults: 1, children: 0 });
  assert.equal(search.status, 200, JSON.stringify(search.body));
  const [offer] = search.body.data;
  await call('POST', '/bus-flights/select', { id: offer.id, isMain: true });
  const validate = await call('POST', '/passengers/validate', {
    passengersData: {
      'adult-passenger-1': {
        'name-1': 'Jana',
        'last-name-1': 'Novakova',
        'phone-1': '+380671234567',
        'email-1': EMAIL,
        'date-of-birth-1': '1985-03-20'
      }
    }
  });
  assert.equal(validate.status, 200, JSON.stringify(validate.body));
  const seatsBefore = (await BusFlight.findByPk(offer.busFlightFromId))
    .freeSeats;

  const checkout = (await call('POST', '/payment')).body.data;
  const res = await call('POST', '/payment/mock/complete', {
    data: checkout.data,
    signature: checkout.signature,
    outcome: 'failure'
  });

  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.data.outcome, 'failure');
  const { transaction_id: transactionId } = decodePayload(res.body.data.data);
  createdTransactionIds.push(transactionId);
  assert.equal(await Ticket.count({ where: { transactionId } }), 0);
  assert.equal(
    (await BusFlight.findByPk(offer.busFlightFromId)).freeSeats,
    seatsBefore
  );
});

test('errors share one JSON shape with a machine-readable code', async () => {
  const call = createClient();

  const noSession = await call('GET', '/passengers');
  assert.equal(noSession.status, 401);
  assert.equal(noSession.body.code, 'SESSION_NOT_STARTED');

  const badIds = await call(
    'GET',
    '/bus-flights/alternatives?originId=1%20OR%201&destinationId=8' +
      '&startDate=2030-01-01&endDate=one-way&currencyAbbr=UAH'
  );
  assert.equal(badIds.status, 400);
  assert.deepEqual(badIds.body.errors, [
    { field: 'originId', message: 'positive integer' }
  ]);

  const pastDates = await call(
    'GET',
    `/bus-flights?originId=${PRAHA}&destinationId=${KYIV}` +
      '&startDate=2020-01-10&endDate=2020-01-05&currencyAbbr=CZK'
  );
  assert.equal(pastDates.status, 400);
  assert.equal(pastDates.body.code, 'INVALID_DATES');

  const unknown = await call('GET', '/no-such-endpoint');
  assert.equal(unknown.status, 404);
  assert.deepEqual(Object.keys(unknown.body).sort(), [
    'code',
    'errors',
    'message',
    'status'
  ]);
});

test('the network lists both lines with weekdays, stops and fares', async () => {
  const call = createClient();
  const res = await call('GET', '/network?languageCode=cs_CZ');
  assert.equal(res.status, 200, JSON.stringify(res.body));
  const { cities, lines, fares } = res.body.data;

  assert.equal(cities.find((c) => c.id === PRAHA).name, 'Praha');
  assert.equal(lines.length, 2);
  const [outbound, inbound] = lines[0].directions;
  // Kyiv → Prague leaves Tue/Thu/Sat; the bus returns the day it arrives
  assert.deepEqual(outbound.weekdays, [2, 4, 6]);
  assert.deepEqual(inbound.weekdays, [0, 3, 5]);
  assert.equal(outbound.stops[0].cityId, KYIV);
  const praha = outbound.stops.find((s) => s.cityId === PRAHA);
  assert.equal(praha.kind, 'dropOff');
  assert.equal(praha.dayOffset, 1);

  const kyivPraha = fares.filter(
    (f) => f.fromCityId === KYIV && f.toCityId === PRAHA
  );
  assert.deepEqual(kyivPraha.map((f) => f.currency).sort(), ['CZK', 'UAH']);
  assert.ok(kyivPraha.every((f) => f.roundTrip > f.oneWay));
});

test('discounts are public, grouped and named in the requested language', async () => {
  const call = createClient();
  const res = await call('GET', '/discounts?languageCode=en_US');
  assert.equal(res.status, 200, JSON.stringify(res.body));
  const children = res.body.data.find((g) => g.group === 'children');
  assert.ok(children.items.length > 0);
  assert.ok(children.items.every((d) => d.name && d.coef > 0 && d.coef < 1));
  assert.ok(!res.body.data.some((g) => g.group === 'bus-flights'));
});
