/** @format */

// Unit tests for the ticket-list filter/sort builders. Pure functions — they
// only assemble Sequelize WHERE/ORDER structures, so no DB connection is made
// (requiring the models instantiates Sequelize but it connects lazily). Smart
// text conditions are opaque Where objects, so those are asserted by rendering
// the WHERE to SQL via the dialect's query generator.
//
// Run with:  node --test services/admin/ticketListService.test.js

require('module-alias/register');

const test = require('node:test');
const assert = require('node:assert/strict');
const { Op } = require('sequelize');

const {
  buildFilterWhere,
  buildSortOrder,
  buildCustomSortOrder
} = require('@services/admin/ticketListService');
const { sequelize } = require('@database/models/index');
const {
  agent: Agent,
  agentattributes: AgentAttributes,
  city: City,
  cityattributes: CityAttributes,
  discount: Discount,
  discountattributes: DiscountAttributes,
  passenger: Passenger,
  ticket: Ticket,
  ticketmeta: TicketMeta,
  ticketmetaattributes: TicketMetaAttributes
} = require('@database/models/index');

const qg = sequelize.getQueryInterface().queryGenerator;
// Render buildFilterWhere output to a SQL WHERE string.
const sql = (filters) => qg.whereItemsQuery(buildFilterWhere(filters));

// A single plain (non-smart) condition lives inside the top-level Op.and array.
const onlyCondition = (where) => {
  const and = where[Op.and];
  assert.ok(Array.isArray(and), 'expected an Op.and array');
  assert.equal(and.length, 1, 'expected exactly one condition');
  return and[0];
};

// ─── Plain (non-smart) fields keep exact, raw-column comparisons ─────────────

test('buildFilterWhere: no filters → empty object', () => {
  assert.deepEqual(buildFilterWhere([]), {});
});

test('buildFilterWhere: passenger-ticket numeric field is a direct column', () => {
  const where = buildFilterWhere([
    { id: 'discountCardNumber', value: 123, fn: 'equals' }
  ]);
  assert.deepStrictEqual(onlyCondition(where), {
    discountCardNumber: { [Op.eq]: 123 }
  });
});

test('buildFilterWhere: ticket key is remapped (discount → discountPercentage)', () => {
  const where = buildFilterWhere([
    { id: 'discount', value: 10, fn: 'greaterThanOrEqualTo' }
  ]);
  assert.deepStrictEqual(onlyCondition(where), {
    '$ticket.discountPercentage$': { [Op.gte]: 10 }
  });
});

test('buildFilterWhere: ticketId is remapped to ticket.id', () => {
  const where = buildFilterWhere([{ id: 'ticketId', value: 42, fn: 'equals' }]);
  assert.deepStrictEqual(onlyCondition(where), {
    '$ticket.id$': { [Op.eq]: 42 }
  });
});

test('buildFilterWhere: numeric between keeps its [min, max] array (price → priceUAH)', () => {
  // The admin "price" column is filtered in canonical UAH.
  assert.equal(
    sql([{ id: 'price', value: [100, 500], fn: 'between' }]),
    '(`ticket`.`priceUAH` BETWEEN 100 AND 500)'
  );
});

test('buildFilterWhere: payment columns filter on the UAH-truth INTEGER column', () => {
  // paymentAtOffice / paymentOnBus are shown in UAH; the filter targets the
  // dedicated UAH-truth INTEGER column (numeric by type, currency-consistent).
  const where = buildFilterWhere([
    { id: 'paymentAtOffice', value: [1500, 5000], fn: 'between' }
  ]);
  assert.deepStrictEqual(onlyCondition(where), {
    paymentAtOfficeUAH: { [Op.between]: [1500, 5000] }
  });
});

test('buildSortOrder: payment columns sort by the UAH-truth column', () => {
  const order = buildSortOrder([{ id: 'paymentOnBus', desc: true }]);
  assert.deepStrictEqual(order, [['paymentOnBusUAH', 'DESC']]);
});

test('buildFilterWhere: passengerType (enum) still maps localized name → constant', () => {
  // "Дорослий" → "adult" via transformStringToConstant, matched on passenger.type.
  const where = buildFilterWhere([
    { id: 'passengerType', value: 'Дорослий', fn: 'equals' }
  ]);
  assert.deepStrictEqual(onlyCondition(where), {
    '$passenger.type$': { [Op.eq]: 'adult' }
  });
});

// ─── Smart text matching (whitespace/case/diacritic-insensitive) ─────────────

test('buildFilterWhere: free-text name normalizes column + value', () => {
  const s = sql([{ id: 'name', value: 'John', fn: 'contains' }]);
  assert.match(s, /LOWER\(`passenger`\.`name`\)/);
  assert.match(s, /REPLACE\(/);
  assert.match(s, /LIKE '%john%'/);
});

test("buildFilterWhere: diacritics + spaces are folded ('Jo sé' → 'jose')", () => {
  const s = sql([{ id: 'name', value: 'Jo sé', fn: 'contains' }]);
  assert.match(s, /LIKE '%jose%'/);
});

test('buildFilterWhere: phone spaces are stripped on both sides', () => {
  const s = sql([{ id: 'phone', value: '+380 50', fn: 'startsWith' }]);
  assert.match(s, /LIKE '\+38050%'/);
});

test('buildFilterWhere: currency is smart-matched (remapped column)', () => {
  const s = sql([{ id: 'currency', value: 'UAH', fn: 'equals' }]);
  assert.match(s, /LOWER\(`ticket`\.`currencyAbbr`\)/);
  assert.match(s, /= 'uah'/);
});

test("buildFilterWhere: the screenshot case — '12до15' contains '12 до 15'", () => {
  // Stored "...12 до 15 років..." normalizes to contain "12до15".
  const s = sql([{ id: 'passengerDiscount', value: '12до15', fn: 'contains' }]);
  assert.match(s, /LIKE '%12до15%'/);
  assert.match(s, /`discount->discountattrs`\.`name`/);
});

test('buildFilterWhere: status is smart-matched on the meta name column', () => {
  const s = sql([{ id: 'status', value: 'Оплачений', fn: 'contains' }]);
  assert.match(s, /`ticket->statusMeta->ticketmetaattrs`\.`name`/);
  assert.match(s, /LIKE '%оплачений%'/);
});

test('buildFilterWhere: type is smart-matched on the meta name column', () => {
  const s = sql([{ id: 'type', value: 'В одну', fn: 'startsWith' }]);
  assert.match(s, /`ticket->typeMeta->ticketmetaattrs`\.`name`/);
  assert.match(s, /LIKE 'водну%'/);
});

test('buildFilterWhere: agent is smart-matched on the agent name column', () => {
  const s = sql([{ id: 'agent', value: 'Іван', fn: 'equals' }]);
  assert.match(s, /`agent->agentattrs`\.`name`/);
  assert.match(s, /= 'іван'/);
});

test('buildFilterWhere: passengerDiscount is smart-matched on the discount name', () => {
  const s = sql([
    { id: 'passengerDiscount', value: 'Студент', fn: 'endsWith' }
  ]);
  assert.match(s, /`discount->discountattrs`\.`name`/);
  assert.match(s, /LIKE '%студент'/);
});

// ─── IS NULL handling for synthetic placeholder labels ──────────────────────

test("buildFilterWhere: equals 'Без знижки' → IS NULL OR (smart) name match", () => {
  const s = sql([
    { id: 'passengerDiscount', value: 'Без знижки', fn: 'equals' }
  ]);
  assert.match(s, /`passengerDiscountId` IS NULL/);
  assert.match(s, /OR/);
  assert.match(s, /= 'беззнижки'/); // spaces stripped in normalization
});

test("buildFilterWhere: partial startsWith 'Без зниж' still reaches null rows", () => {
  // "Без знижки".startsWith("Без зниж") (normalized) is true.
  const s = sql([
    { id: 'passengerDiscount', value: 'Без зниж', fn: 'startsWith' }
  ]);
  assert.match(s, /`passengerDiscountId` IS NULL/);
  assert.match(s, /LIKE 'беззниж%'/);
});

test("buildFilterWhere: no-space partial 'беззнижки' matches the placeholder", () => {
  const s = sql([
    { id: 'passengerDiscount', value: 'беззнижки', fn: 'startsWith' }
  ]);
  assert.match(s, /`passengerDiscountId` IS NULL/);
});

test("buildFilterWhere: partial contains 'агент' reaches null agent rows", () => {
  const s = sql([{ id: 'agent', value: 'агент', fn: 'contains' }]);
  assert.match(s, /`agentId` IS NULL/);
  assert.match(s, /LIKE '%агент%'/);
});

test("buildFilterWhere: 'Без підтвердження' → confirmationId IS NULL branch", () => {
  const s = sql([
    { id: 'passengerConfirmation', value: 'Без підтвердження', fn: 'equals' }
  ]);
  assert.match(s, /`confirmationId` IS NULL/);
});

test("buildFilterWhere: non-matching partial 'Студ' does NOT add IS NULL", () => {
  const s = sql([{ id: 'passengerDiscount', value: 'Студ', fn: 'startsWith' }]);
  assert.doesNotMatch(s, /IS NULL/);
  assert.match(s, /LIKE 'студ%'/);
});

test('buildFilterWhere: multi-value ORs a null branch with a plain name match', () => {
  const s = sql([
    { id: 'passengerDiscount', value: ['Без знижки', 'Студент'], fn: 'equals' }
  ]);
  assert.match(s, /`passengerDiscountId` IS NULL/);
  assert.match(s, /= 'беззнижки'/);
  assert.match(s, /= 'студент'/);
  assert.match(s, /OR/);
});

// ─── Relation fields (city/route) are smart-matched + language-pinned ───────

test('buildFilterWhere: origin smart-matches city name and pins language', () => {
  const s = sql([{ id: 'origin', value: 'Київ', fn: 'equals' }]);
  assert.match(s, /`ticket->originCity->cityattrs`\.`name`/);
  assert.match(s, /= 'київ'/);
  assert.match(s, /`ticket->originCity->cityattrs`\.`languageId` = 1/);
});

test('buildFilterWhere: busFlightFrom smart-matches route name (spaces stripped)', () => {
  const s = sql([
    { id: 'busFlightFrom', value: 'Київ - Львів', fn: 'contains' }
  ]);
  assert.match(s, /`ticket->busFlightFrom->route->routeattrs`\.`name`/);
  assert.match(s, /LIKE '%київ-львів%'/);
});

test('buildFilterWhere: busFlightFrom matches the date shown in the label', () => {
  const s = sql([{ id: 'busFlightFrom', value: '02-12-2023', fn: 'contains' }]);
  // The composed "name (DD-MM-YYYY)" label is searched, so a date matches.
  assert.match(s, /DATE_FORMAT/);
  assert.match(s, /%d-%m-%Y/);
  assert.match(s, /CONCAT/);
  assert.match(s, /LIKE '%02-12-2023%'/);
});

test('buildFilterWhere: busFlightTo also matches the label date', () => {
  const s = sql([{ id: 'busFlightTo', value: '02-12-2023', fn: 'contains' }]);
  assert.match(s, /`ticket->busFlightTo`\.`dateOfDeparture`/);
  assert.match(s, /LIKE '%02-12-2023%'/);
});

// ─── Invalid operators are skipped, never thrown ────────────────────────────

test('buildFilterWhere: invalid filter fn is skipped, not thrown', () => {
  assert.deepEqual(
    buildFilterWhere([{ id: 'name', value: 'John', fn: 'nope' }]),
    {}
  );
  assert.deepEqual(
    buildFilterWhere([{ id: 'status', value: 'Оплачений', fn: '' }]),
    {}
  );
});

// ─── buildSortOrder ─────────────────────────────────────────────────────────

test('buildSortOrder: default groups by ticket id then row id', () => {
  const order = buildSortOrder([]);
  assert.equal(order.length, 2);
  assert.equal(order[0][0].model, Ticket);
  assert.deepEqual([order[0][1], order[0][2]], ['id', 'ASC']);
  assert.deepEqual(order[1], ['id', 'ASC']);
});

test('buildSortOrder: ticket field remaps key and roots at Ticket', () => {
  const [clause] = buildSortOrder([{ id: 'currency', desc: true }]);
  assert.equal(clause[0].model, Ticket);
  assert.deepEqual([clause[1], clause[2]], ['currencyAbbr', 'DESC']);
});

test('buildSortOrder: passenger field roots at Passenger', () => {
  const [clause] = buildSortOrder([{ id: 'lastName', desc: false }]);
  assert.equal(clause[0].model, Passenger);
  assert.deepEqual([clause[1], clause[2]], ['lastName', 'ASC']);
});

test('buildSortOrder: passengerType maps to the `type` column on Passenger', () => {
  const [clause] = buildSortOrder([{ id: 'passengerType', desc: false }]);
  assert.equal(clause[0].model, Passenger);
  assert.deepEqual([clause[1], clause[2]], ['type', 'ASC']);
});

test('buildSortOrder: passenger-ticket field is a direct column', () => {
  const [clause] = buildSortOrder([{ id: 'busSeat', desc: false }]);
  assert.deepEqual(clause, ['busSeat', 'ASC']);
});

test('buildSortOrder: status sorts by ticket meta name', () => {
  const [clause] = buildSortOrder([{ id: 'status', desc: true }]);
  assert.equal(clause[0].model, Ticket);
  assert.equal(clause[1].model, TicketMeta);
  assert.equal(clause[1].as, 'statusMeta');
  assert.equal(clause[2].model, TicketMetaAttributes);
  assert.equal(clause[2].as, 'ticketmetaattrs');
  assert.deepEqual([clause[3], clause[4]], ['name', 'DESC']);
});

test('buildSortOrder: type sorts by ticket meta name', () => {
  const [clause] = buildSortOrder([{ id: 'type', desc: false }]);
  assert.equal(clause[1].as, 'typeMeta');
  assert.deepEqual([clause[3], clause[4]], ['name', 'ASC']);
});

test('buildSortOrder: passengerConfirmation sorts by confirmation meta name', () => {
  const [clause] = buildSortOrder([
    { id: 'passengerConfirmation', desc: false }
  ]);
  assert.equal(clause[0].model, TicketMeta);
  assert.equal(clause[0].as, 'confirmationMeta');
  assert.equal(clause[1].model, TicketMetaAttributes);
  assert.deepEqual([clause[2], clause[3]], ['name', 'ASC']);
});

test('buildSortOrder: agent sorts by agent name', () => {
  const [clause] = buildSortOrder([{ id: 'agent', desc: false }]);
  assert.equal(clause[0].model, Agent);
  assert.equal(clause[1].model, AgentAttributes);
  assert.equal(clause[1].as, 'agentattrs');
  assert.deepEqual([clause[2], clause[3]], ['name', 'ASC']);
});

test('buildSortOrder: passengerDiscount sorts by discount name', () => {
  const [clause] = buildSortOrder([{ id: 'passengerDiscount', desc: true }]);
  assert.equal(clause[0].model, Discount);
  assert.equal(clause[1].model, DiscountAttributes);
  assert.equal(clause[1].as, 'discountattrs');
  assert.deepEqual([clause[2], clause[3]], ['name', 'DESC']);
});

test('buildSortOrder: origin sorts through originCity → cityattrs', () => {
  const [clause] = buildSortOrder([{ id: 'origin', desc: false }]);
  assert.equal(clause[0].model, Ticket);
  assert.equal(clause[1].model, City);
  assert.equal(clause[1].as, 'originCity');
  assert.equal(clause[2].model, CityAttributes);
  assert.equal(clause[2].as, 'cityattrs');
  assert.deepEqual([clause[3], clause[4]], ['name', 'ASC']);
});

// ─── buildCustomSortOrder (route-order sorting) ─────────────────────────────

// Render the ORDER terms' SQL literals so the subquery can be inspected.
const customSortSql = (sorting) =>
  buildCustomSortOrder(sorting).map(([literal, dir]) => [literal.val, dir]);

test('buildCustomSortOrder: any well-formed route key sorts by line position', () => {
  const terms = customSortSql([{ id: 'origin', order: 'KP' }]);
  assert.equal(terms.length, 2);
  assert.match(terms[0][0], /rco\.routeKey = 'KP'/);
  assert.match(terms[0][0], /`ticket`\.`originId`/);
  assert.match(terms[0][0], / IS NULL$/);
  assert.deepEqual(
    terms.map(([, dir]) => dir),
    ['ASC', 'ASC']
  );
});

test('buildCustomSortOrder: destination uses destinationId', () => {
  const [[literal]] = customSortSql([{ id: 'destination', order: 'PRAHA' }]);
  assert.match(literal, /`ticket`\.`destinationId`/);
});

test('buildCustomSortOrder: rejects malformed route keys (SQL safety)', () => {
  for (const order of [
    "KP' OR '1'='1",
    'kp',
    'K P',
    'TOOLONGKEY',
    '',
    undefined,
    42
  ]) {
    assert.deepEqual(
      buildCustomSortOrder([{ id: 'origin', order }]),
      [],
      String(order)
    );
  }
});

test('buildCustomSortOrder: ignores unknown columns and non-arrays', () => {
  assert.deepEqual(buildCustomSortOrder([{ id: 'price', order: 'KP' }]), []);
  assert.deepEqual(buildCustomSortOrder(null), []);
});
