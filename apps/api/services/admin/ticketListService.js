/** @format */

const { Op } = require('sequelize');
const sequelize = require('@database/models/index').sequelize;
const {
  agent: Agent,
  agentattributes: AgentAttributes,
  busflight: BusFlight,
  city: City,
  cityattributes: CityAttributes,
  country: Country,
  countryattributes: CountryAttributes,
  discount: Discount,
  discountattributes: DiscountAttributes,
  passenger: Passenger,
  passengerticket: PassengerTicket,
  route: Route,
  routeattributes: RouteAttributes,
  ticket: Ticket,
  ticketmeta: TicketMeta,
  ticketmetaattributes: TicketMetaAttributes
} = require('@database/models/index');
const queryHelper = require('@helpers/queries');
const { transformStringToConstant } = require('@helpers');
const { transformTicketsTableKey } = require('@services/ticketService');

const LANG_ID = 1;

const RELATION_FIELDS = new Set([
  'origin',
  'destination',
  'busFlightFrom',
  'busFlightTo'
]);

const PASSENGER_FIELDS = new Set([
  'name',
  'lastName',
  'phone',
  'additionalPhone',
  'dateOfBirth',
  'email',
  'passengerType'
]);

const PASSENGER_TICKET_FIELDS = new Set([
  'paymentOnBus',
  'paymentAtOffice',
  'busSeat',
  'note',
  'discountCardNumber'
]);

// The admin payment columns are shown, sorted, and filtered in canonical UAH.
// The booking-currency `paymentAtOffice` / `paymentOnBus` columns are varchar
// (derived), but the UAH truth lives in dedicated INTEGER columns — so the list
// targets those: numeric by type (no CAST) and currency-consistent (no rate
// math), exactly like the price → priceUAH mapping.
const PAYMENT_UAH_COLUMNS = {
  paymentAtOffice: 'paymentAtOfficeUAH',
  paymentOnBus: 'paymentOnBusUAH'
};

// Fields backed by an associated table's localized *name* column. The list row
// shows the name (status / type / confirmation / agent / discount), so the
// filter matches by that name — mirroring the city/route relation fields, but
// rooted either at a PassengerTicket association (agent, discount,
// confirmationMeta) or at the ticket's own meta associations (status, type).
// The raw value is matched directly (NOT transformStringToConstant): these
// names live in the attribute tables, so we compare against the stored name.
const ASSOCIATION_NAME_FIELDS = {
  status: '$ticket.statusMeta.ticketmetaattrs.name$',
  type: '$ticket.typeMeta.ticketmetaattrs.name$',
  passengerConfirmation: '$confirmationMeta.ticketmetaattrs.name$',
  agent: '$agent.agentattrs.name$',
  passengerDiscount: '$discount.discountattrs.name$'
};

// Some association fields show a synthetic placeholder label for rows whose FK
// is null (there is no linked record, so no name exists in the DB). Filtering
// for that label must therefore match `FK IS NULL` on the PassengerTicket row
// directly, not the (always-null) joined name column.
const ASSOCIATION_NULL_LABELS = {
  passengerDiscount: { label: 'Без знижки', fk: 'passengerDiscountId' },
  agent: { label: 'Без агента', fk: 'agentId' },
  passengerConfirmation: { label: 'Без підтвердження', fk: 'confirmationId' }
};

// ─── Smart text matching (whitespace- + case- + diacritic-insensitive) ───────
//
// All free-text filters normalize both the stored value and the search term the
// same way before comparing, so "12до15" matches "12 до 15" and "Jose" matches
// "José". Normalization = lowercase → fold diacritics → strip spaces. The SQL
// side (REPLACE/LOWER chain) and the JS side MUST stay byte-for-byte identical,
// so both are generated from the single FOLD_PAIRS list below.
//
// Trade-off: wrapping the column in LOWER()/REPLACE() means an index on it can't
// be used, so these become scans. Fine for admin-side filtering on this dataset.

// base letter → its accented variants. Expanded into [variant, base] pairs.
const FOLD_GROUPS = {
  a: 'àáâãäåāăą',
  e: 'èéêëēĕėęě',
  i: 'ìíîïīĭįı',
  o: 'òóôõöøōŏő',
  u: 'ùúûüūŭůűų',
  c: 'çćĉċč',
  n: 'ñńņň',
  y: 'ýÿŷ',
  s: 'śŝşš',
  z: 'źżž',
  g: 'ĝğġģ',
  l: 'łļľ',
  r: 'ŕř',
  t: 'ţť',
  d: 'ðđď'
};

const FOLD_PAIRS = [];
for (const [base, variants] of Object.entries(FOLD_GROUPS)) {
  for (const ch of variants) FOLD_PAIRS.push([ch, base]);
}
// Multi-letter ligatures and the various apostrophe glyphs.
FOLD_PAIRS.push(['ß', 'ss'], ['æ', 'ae'], ['œ', 'oe']);
FOLD_PAIRS.push(['’', "'"], ['ʼ', "'"], ['`', "'"], ['´', "'"]);

// Text operators eligible for smart matching (LIKE/=, where normalization is
// meaningful). Numeric/date operators (between/gt/…) are never smart-matched.
const TEXT_OPS = new Set(['equals', 'contains', 'startsWith', 'endsWith']);

// Plain free-text columns that should use smart matching (enums like
// passengerType and all numeric/date columns are intentionally excluded).
const SMART_TEXT_FIELDS = new Set([
  'name',
  'lastName',
  'phone',
  'additionalPhone',
  'email',
  'busSeat',
  'note',
  'currency'
]);

// City/route relation name columns (bare dotted paths for sequelize.col) plus
// the language-id WHERE columns ($-wrapped, used as plain where keys).
const RELATION_NAME_COLUMNS = {
  origin: 'ticket.originCity.cityattrs.name',
  destination: 'ticket.destinationCity.cityattrs.name',
  busFlightFrom: 'ticket.busFlightFrom.route.routeattrs.name',
  busFlightTo: 'ticket.busFlightTo.route.routeattrs.name'
};
const RELATION_LANG_COLUMNS = {
  origin: '$ticket.originCity.cityattrs.languageId$',
  destination: '$ticket.destinationCity.cityattrs.languageId$',
  busFlightFrom: '$ticket.busFlightFrom.route.routeattrs.languageId$',
  busFlightTo: '$ticket.busFlightTo.route.routeattrs.languageId$'
};

// Bus-flight columns are labelled "<route name> (DD-MM-YYYY)" in the table, the
// date coming from the flight's own departure. Filtering must match that whole
// composed label so the date shown in the name is searchable, not just the route.
const RELATION_DATE_COLUMNS = {
  busFlightFrom: 'ticket.busFlightFrom.dateOfDeparture',
  busFlightTo: 'ticket.busFlightTo.dateOfDeparture'
};

/** Normalizes a search term: lowercase → fold diacritics → strip spaces. */
function _normalizeText(str) {
  let s = String(str).toLowerCase();
  for (const [from, to] of FOLD_PAIRS) s = s.split(from).join(to);
  return s.split(' ').join('');
}

/** Coerces a column-path string to a Sequelize expression (leaves exprs as-is). */
const _asExpr = (col) => (typeof col === 'string' ? sequelize.col(col) : col);

/** Builds the SQL expression that normalizes an expression identically to _normalizeText. */
function _normalizedExpr(col) {
  // LOWER first (innermost) so the lowercase fold pairs match any source case.
  let expr = sequelize.fn('LOWER', _asExpr(col));
  for (const [from, to] of FOLD_PAIRS) {
    expr = sequelize.fn('REPLACE', expr, from, to);
  }
  return sequelize.fn('REPLACE', expr, ' ', '');
}

/** Builds the SQL expression that normalizes a column identically to _normalizeText. */
function _normalizedCol(colPath) {
  return _normalizedExpr(sequelize.col(colPath));
}

/** A single normalized comparison: normalize(col) <op> normalize(value). */
function _smartValueCondition(col, fn, value) {
  const op = queryHelper[fn](null, null, true);
  return sequelize.where(_normalizedExpr(col), {
    [op]: _normalizeText(value)
  });
}

/**
 * Smart text condition for a (possibly multi-value) filter. Text operators get
 * the normalized comparison; any other operator falls back to a plain column
 * comparison so nothing crashes.
 */
function _smartTextCondition(col, fn, value) {
  if (typeof queryHelper[fn] !== 'function') return null;
  const values = Array.isArray(value) ? value.filter(Boolean) : [value];
  if (!values.length) return null;

  const make = TEXT_OPS.has(fn)
    ? (v) => _smartValueCondition(col, fn, v)
    : (v) =>
        sequelize.where(_asExpr(col), queryHelper[fn](null, null, true), v);

  return values.length === 1 ? make(values[0]) : { [Op.or]: values.map(make) };
}

/** Bare dotted column path (drops the $…$ wrapping) for sequelize.col. */
function _bareColumn(id) {
  return _toSequelizePath(id).replace(/\$/g, '');
}

// Paths are rooted at PassengerTicket (the list's row unit): passenger columns
// live under the `passenger` belongsTo, passenger-ticket columns are direct, and
// ticket columns live under the `ticket` belongsTo.
function _toSequelizePath(id) {
  // The admin "price" column is shown and sorted/filtered in canonical UAH.
  if (id === 'price') return '$ticket.priceUAH$';
  if (PASSENGER_FIELDS.has(id)) {
    const col = id === 'passengerType' ? 'type' : id;
    return `$passenger.${col}$`;
  }
  if (PASSENGER_TICKET_FIELDS.has(id)) {
    // Payment columns resolve to their UAH-truth counterpart.
    return PAYMENT_UAH_COLUMNS[id] || id;
  }
  return `$ticket.${transformTicketsTableKey(id)}$`;
}

const TICKET_ATTRIBUTES = [
  'id',
  'dateOfDeparture',
  'dateOfReturn',
  'dateOfCreature',
  'busFlightFromId',
  'busFlightToId',
  'price',
  'priceUAH',
  'exchangeRate',
  'currencyAbbr',
  'typeId',
  'statusId',
  'signature',
  'dateOfFirstUsage',
  'hasDiscount',
  'discountPercentage',
  'originId',
  'destinationId',
  'passengerRowCount',
  'PDFFileName',
  'prevPDFFileName',
  'ticketNumber',
  'createdAt',
  'updatedAt'
];

// ─── Param parsing ──────────────────────────────────────────────────────────

/**
 * Parses raw query string params into structured filter and sort arrays.
 */
function parseTicketListParams(filters, filtersFns, sorting) {
  const parsedFilters = JSON.parse(filters).filter((el) => !!el?.value);
  const parsedFiltersFns = JSON.parse(filtersFns);
  const parsedSorting = JSON.parse(sorting);

  const parsedFiltersWithFns = parsedFilters.map((el) => ({
    id: el.id,
    value: Array.isArray(el.value)
      ? el.value.filter(Boolean).length > 0
        ? el.value
        : []
      : el.value,
    fn: parsedFiltersFns[el.id] || ''
  }));

  return { parsedFiltersWithFns, parsedSorting };
}

// ─── WHERE builder ──────────────────────────────────────────────────────────

// Composed label expression matching what the table shows for a bus flight:
// "<route name> (DD-MM-YYYY)". DATE_FORMAT mirrors the frontend's day-month-year
// formatting so a date typed into the filter matches the visible label.
function _flightLabelExpr(nameCol, dateCol) {
  return sequelize.fn(
    'CONCAT',
    sequelize.col(nameCol),
    ' (',
    sequelize.fn('DATE_FORMAT', sequelize.col(dateCol), '%d-%m-%Y'),
    ')'
  );
}

function _buildRelationFilterConditions(el) {
  const nameCol = RELATION_NAME_COLUMNS[el.id];
  const langCol = RELATION_LANG_COLUMNS[el.id];
  if (!nameCol) return [];

  // Bus flights match the full "name (date)" label; cities match the name only.
  const dateCol = RELATION_DATE_COLUMNS[el.id];
  const target = dateCol ? _flightLabelExpr(nameCol, dateCol) : nameCol;

  const matchCond = _smartTextCondition(target, el.fn, el.value);
  if (!matchCond) return [];

  return [matchCond, { [langCol]: { [Op.eq]: LANG_ID } }];
}

/**
 * Builds a name-match condition for an association-backed field (status, type,
 * confirmation, agent, discount). The list shows the localized name, so the
 * filter matches the raw value against the association's localized name column.
 */
// True when the synthetic placeholder label itself satisfies the active text
// operator for `value` — e.g. "Без знижки" startsWith "Без зниж". Rows with a
// null FK have no DB name, so this is the only way a partial filter can reach
// them. Non-text operators (between/gt/…) never match a label.
function _placeholderMatches(fn, label, value) {
  if (!TEXT_OPS.has(fn)) return false;
  const l = _normalizeText(label);
  const v = _normalizeText(value);
  switch (fn) {
    case 'equals':
      return l === v;
    case 'contains':
      return l.includes(v);
    case 'startsWith':
      return l.startsWith(v);
    case 'endsWith':
      return l.endsWith(v);
    default:
      return false;
  }
}

function _buildAssociationNameCondition(el) {
  if (typeof queryHelper[el.fn] !== 'function') return null;

  const col = ASSOCIATION_NAME_FIELDS[el.id].replace(/\$/g, '');
  const nullMeta = ASSOCIATION_NULL_LABELS[el.id];
  const values = Array.isArray(el.value)
    ? el.value.filter(Boolean)
    : [el.value];
  if (!values.length) return null;

  // Each value matches real rows by (smart) name; when the value also matches
  // the synthetic placeholder under the same operator, OR-in `FK IS NULL` so the
  // no-record rows are included too (the placeholder has no DB name to match).
  const make = (v) => {
    const nameCond = _smartTextCondition(col, el.fn, v);
    if (nullMeta && _placeholderMatches(el.fn, nullMeta.label, v)) {
      return { [Op.or]: [{ [nullMeta.fk]: { [Op.is]: null } }, nameCond] };
    }
    return nameCond;
  };

  return values.length === 1 ? make(values[0]) : { [Op.or]: values.map(make) };
}

/**
 * Builds the Sequelize WHERE clause (rooted at PassengerTicket) from the parsed
 * filter list. Every condition is a path relative to the PassengerTicket row.
 */
function buildFilterWhere(parsedFiltersWithFns) {
  const conditions = [];

  for (const el of parsedFiltersWithFns) {
    if (RELATION_FIELDS.has(el.id)) continue;
    if (ASSOCIATION_NAME_FIELDS[el.id]) continue;
    if (typeof queryHelper[el.fn] !== 'function') continue;

    // Free-text columns get whitespace/case/diacritic-insensitive matching.
    if (SMART_TEXT_FIELDS.has(el.id) && TEXT_OPS.has(el.fn)) {
      const smart = _smartTextCondition(_bareColumn(el.id), el.fn, el.value);
      if (smart) conditions.push(smart);
      continue;
    }

    // Everything else (enums via transformStringToConstant, numeric, date)
    // keeps the exact, raw-column comparison.
    const valueArr = transformStringToConstant(el.value);
    const path = _toSequelizePath(el.id);

    const condition =
      valueArr.length === 1
        ? queryHelper[el.fn](path, valueArr[0])
        : { [Op.or]: valueArr.map((v) => queryHelper[el.fn](path, v)) };

    if (condition) conditions.push(condition);
  }

  const relationConditions = parsedFiltersWithFns
    .filter((el) => RELATION_FIELDS.has(el.id))
    .flatMap(_buildRelationFilterConditions);

  conditions.push(...relationConditions);

  const associationConditions = parsedFiltersWithFns
    .filter((el) => ASSOCIATION_NAME_FIELDS[el.id])
    .map(_buildAssociationNameCondition)
    .filter(Boolean);

  conditions.push(...associationConditions);

  return conditions.length ? { [Op.and]: conditions } : {};
}

// ─── ORDER builder ──────────────────────────────────────────────────────────

/**
 * Builds the Sequelize ORDER clause from the parsed sort list.
 */
function buildSortOrder(parsedSorting) {
  // Rooted at PassengerTicket. Default: group rows by ticket (ticket.id), then
  // by the passenger-ticket row id so a ticket's passengers stay in order.
  if (!parsedSorting.length) {
    return [
      [{ model: Ticket }, 'id', 'ASC'],
      ['id', 'ASC']
    ];
  }

  return parsedSorting
    .map((el) => {
      const dir = el.desc ? 'DESC' : 'ASC';
      switch (el.id) {
        case 'origin':
          return [
            { model: Ticket },
            { model: City, as: 'originCity' },
            { model: CityAttributes, as: 'cityattrs' },
            'name',
            dir
          ];
        case 'destination':
          return [
            { model: Ticket },
            { model: City, as: 'destinationCity' },
            { model: CityAttributes, as: 'cityattrs' },
            'name',
            dir
          ];
        case 'busFlightFrom':
          return [
            { model: Ticket },
            { model: BusFlight, as: 'busFlightFrom' },
            { model: Route },
            { model: RouteAttributes, as: 'routeattrs' },
            'name',
            dir
          ];
        case 'busFlightTo':
          return [
            { model: Ticket },
            { model: BusFlight, as: 'busFlightTo' },
            { model: Route },
            { model: RouteAttributes, as: 'routeattrs' },
            'name',
            dir
          ];
        case 'status':
          return [
            { model: Ticket },
            { model: TicketMeta, as: 'statusMeta' },
            { model: TicketMetaAttributes, as: 'ticketmetaattrs' },
            'name',
            dir
          ];
        case 'type':
          return [
            { model: Ticket },
            { model: TicketMeta, as: 'typeMeta' },
            { model: TicketMetaAttributes, as: 'ticketmetaattrs' },
            'name',
            dir
          ];
        case 'passengerConfirmation':
          return [
            { model: TicketMeta, as: 'confirmationMeta' },
            { model: TicketMetaAttributes, as: 'ticketmetaattrs' },
            'name',
            dir
          ];
        case 'agent':
          return [
            { model: Agent },
            { model: AgentAttributes, as: 'agentattrs' },
            'name',
            dir
          ];
        case 'passengerDiscount':
          return [
            { model: Discount },
            { model: DiscountAttributes, as: 'discountattrs' },
            'name',
            dir
          ];
        default: {
          // The admin "price" column sorts in canonical UAH.
          if (el.id === 'price') return [{ model: Ticket }, 'priceUAH', dir];
          // Passenger columns live on the `passenger` belongsTo; passenger-ticket
          // columns are direct on the row; ticket columns on the `ticket`
          // belongsTo — mirroring _toSequelizePath.
          if (PASSENGER_FIELDS.has(el.id)) {
            const col = el.id === 'passengerType' ? 'type' : el.id;
            return [{ model: Passenger }, col, dir];
          }
          if (PASSENGER_TICKET_FIELDS.has(el.id)) {
            // Payment columns sort by their UAH-truth INTEGER counterpart
            // (numeric and currency-consistent), like the priceUAH column.
            return [PAYMENT_UAH_COLUMNS[el.id] || el.id, dir];
          }
          return [{ model: Ticket }, transformTicketsTableKey(el.id), dir];
        }
      }
    })
    .filter(Boolean);
}

// ─── Custom (route-order) sorting ───────────────────────────────────────────

const CUSTOM_SORT_COLUMNS = {
  origin: 'originId',
  destination: 'destinationId'
};
// routecityorders.routeKey is varchar(8); keys are uppercase line codes.
const ROUTE_KEY_PATTERN = /^[A-Z]{1,8}$/;

/**
 * Builds ORDER terms that sort rows by a city's position along a bus-line
 * direction, sourced from `routecityorders` (the same data the /cities endpoint
 * returns). customSorting = [{ id: 'origin'|'destination', order: <routeKey> }]:
 * order by the position of the ticket's origin/destination city for that
 * direction, with cities that have no entry sorted last.
 *
 * `id` is whitelisted and `order` must match ROUTE_KEY_PATTERN before being
 * interpolated into the SQL literal, so the correlated subquery is
 * injection-safe.
 */
function buildCustomSortOrder(parsedCustomSorting) {
  if (!Array.isArray(parsedCustomSorting)) return [];

  const terms = [];
  for (const el of parsedCustomSorting) {
    const column = CUSTOM_SORT_COLUMNS[el?.id];
    const routeKey = el?.order;
    if (
      !column ||
      typeof routeKey !== 'string' ||
      !ROUTE_KEY_PATTERN.test(routeKey)
    ) {
      continue;
    }

    const positionExpr =
      `(SELECT rco.position FROM routecityorders AS rco ` +
      `WHERE rco.cityId = \`ticket\`.\`${column}\` AND rco.routeKey = '${routeKey}' LIMIT 1)`;

    // NULLs (no entry for this direction) last, then ascending by position.
    terms.push([sequelize.literal(`${positionExpr} IS NULL`), 'ASC']);
    terms.push([sequelize.literal(positionExpr), 'ASC']);
  }
  return terms;
}

// ─── Phase 1: page of passenger-ticket rows ─────────────────────────────────

/**
 * Builds the lightweight JOINs needed to filter/sort PassengerTicket rows.
 * `ticket` and `passenger` (both belongsTo, 1:1) are always joined so the
 * default ordering and passenger sort/filter resolve. City/route attribute
 * joins are added only when a relation field is active, and are constrained to
 * the active language in the ON clause (required:false) so they stay 1:1 and
 * never multiply or drop rows.
 */
function _buildRowIncludes(relatedIds) {
  const ticketInclude = {
    model: Ticket,
    attributes: [],
    required: true,
    include: []
  };

  const cityAttrJoin = (alias) => ({
    model: City,
    as: alias,
    attributes: [],
    required: false,
    include: [
      {
        model: CityAttributes,
        as: 'cityattrs',
        attributes: [],
        required: false,
        where: { languageId: LANG_ID }
      }
    ]
  });

  const routeAttrJoin = (alias) => ({
    model: BusFlight,
    as: alias,
    attributes: [],
    required: false,
    include: [
      {
        model: Route,
        attributes: [],
        required: false,
        include: [
          {
            model: RouteAttributes,
            as: 'routeattrs',
            attributes: [],
            required: false,
            where: { languageId: LANG_ID }
          }
        ]
      }
    ]
  });

  // TicketMeta name join, reused for the ticket's status/type metas and for the
  // PassengerTicket's confirmation meta. Localized name only, lang-pinned in the
  // ON clause and required:false so it stays 1:1 and never drops/duplicates rows.
  const metaAttrJoin = (alias) => ({
    model: TicketMeta,
    as: alias,
    attributes: [],
    required: false,
    include: [
      {
        model: TicketMetaAttributes,
        as: 'ticketmetaattrs',
        attributes: [],
        required: false,
        where: { languageId: LANG_ID }
      }
    ]
  });

  if (relatedIds.has('origin'))
    ticketInclude.include.push(cityAttrJoin('originCity'));
  if (relatedIds.has('destination'))
    ticketInclude.include.push(cityAttrJoin('destinationCity'));
  if (relatedIds.has('busFlightFrom'))
    ticketInclude.include.push(routeAttrJoin('busFlightFrom'));
  if (relatedIds.has('busFlightTo'))
    ticketInclude.include.push(routeAttrJoin('busFlightTo'));
  // status / type live on the ticket's own meta associations.
  if (relatedIds.has('type'))
    ticketInclude.include.push(metaAttrJoin('typeMeta'));
  if (relatedIds.has('status'))
    ticketInclude.include.push(metaAttrJoin('statusMeta'));

  const includes = [
    ticketInclude,
    { model: Passenger, attributes: [], required: false }
  ];

  // agent / passengerDiscount / passengerConfirmation are belongsTo on the
  // PassengerTicket row itself, so they join at the top level.
  if (relatedIds.has('agent')) {
    includes.push({
      model: Agent,
      attributes: [],
      required: false,
      include: [
        {
          model: AgentAttributes,
          as: 'agentattrs',
          attributes: [],
          required: false,
          where: { languageId: LANG_ID }
        }
      ]
    });
  }
  if (relatedIds.has('passengerDiscount')) {
    includes.push({
      model: Discount,
      attributes: [],
      required: false,
      include: [
        {
          model: DiscountAttributes,
          as: 'discountattrs',
          attributes: [],
          required: false,
          where: { languageId: LANG_ID }
        }
      ]
    });
  }
  if (relatedIds.has('passengerConfirmation'))
    includes.push(metaAttrJoin('confirmationMeta'));

  return includes;
}

/**
 * Phase 1: orders and paginates the PassengerTicket rows (the list's row unit)
 * directly, so each passenger row is positioned independently by the sort key.
 *
 * @param {Object} where      - Sequelize WHERE (from buildFilterWhere)
 * @param {Array}  order      - Sequelize ORDER (from buildSortOrder)
 * @param {Set}    relatedIds - Field IDs of active filters/sorts that need JOINs
 * @param {number} startInt   - First row index (0-based offset)
 * @param {number} sizeInt    - Page size (number of rows)
 * @returns {Promise<{ pageRows: Array<{id:number, ticketId:number}>, totalRowCount: number }>}
 */
async function fetchRowPage(where, order, relatedIds, startInt, sizeInt) {
  const include = _buildRowIncludes(relatedIds);

  const [rows, totalRowCount] = await Promise.all([
    PassengerTicket.findAll({
      attributes: ['id', 'ticketId'],
      where,
      include,
      order,
      offset: startInt,
      limit: sizeInt,
      subQuery: false
    }),
    PassengerTicket.count({
      where,
      include,
      distinct: true
    })
  ]);

  return {
    pageRows: rows.map((r) => ({ id: r.id, ticketId: r.ticketId })),
    totalRowCount
  };
}

// ─── Phase 2: full data query ───────────────────────────────────────────────

function _cityInclude(alias) {
  return {
    model: City,
    as: alias,
    include: [
      {
        model: CityAttributes,
        as: 'cityattrs',
        attributes: ['name'],
        where: { languageId: { [Op.eq]: LANG_ID } }
      },
      {
        model: Country,
        attributes: ['id'],
        include: [
          {
            model: CountryAttributes,
            as: 'countryattrs',
            attributes: ['name'],
            where: { languageId: { [Op.eq]: LANG_ID } }
          }
        ]
      }
    ]
  };
}

function _busFlightInclude(alias) {
  return {
    model: BusFlight,
    attributes: ['id', 'routeId', 'dateOfDeparture', 'freeSeats'],
    as: alias,
    include: [
      {
        model: Route,
        attributes: ['id'],
        include: [
          {
            model: RouteAttributes,
            required: false,
            as: 'routeattrs',
            attributes: ['name'],
            where: { languageId: { [Op.eq]: LANG_ID } }
          }
        ]
      }
    ]
  };
}

function _ticketMetaInclude(alias) {
  return {
    model: TicketMeta,
    as: alias,
    attributes: ['id', 'meta_key'],
    include: [
      {
        model: TicketMetaAttributes,
        as: 'ticketmetaattrs',
        attributes: ['name'],
        where: { languageId: { [Op.eq]: LANG_ID } },
        required: false
      }
    ]
  };
}

function _passengerTicketInclude() {
  return {
    model: PassengerTicket,
    attributes: [
      'id',
      'passengerDiscountId',
      'discountCardNumber',
      'ticketId',
      'passengerId',
      'confirmationId',
      'paymentAtOffice',
      'paymentOnBus',
      'paymentAtOfficeUAH',
      'paymentOnBusUAH',
      'busSeat',
      'note',
      'agentId',
      'PDFFileName',
      'discountPercentage',
      'price',
      'priceUAH'
    ],
    include: [
      {
        model: Passenger,
        attributes: [
          'id',
          'name',
          'lastName',
          'phone',
          'additionalPhone',
          'dateOfBirth',
          'email',
          'type'
        ]
      },
      {
        model: Discount,
        attributes: ['id', 'coef'],
        include: [
          {
            model: DiscountAttributes,
            required: false,
            as: 'discountattrs',
            attributes: ['name'],
            where: { languageId: { [Op.eq]: LANG_ID } }
          }
        ]
      },
      {
        model: Agent,
        attributes: ['id'],
        include: [
          {
            model: AgentAttributes,
            required: false,
            as: 'agentattrs',
            attributes: ['name'],
            where: { languageId: { [Op.eq]: LANG_ID } }
          }
        ]
      },
      {
        model: TicketMeta,
        as: 'confirmationMeta',
        attributes: ['id'],
        required: false,
        include: [
          {
            model: TicketMetaAttributes,
            as: 'ticketmetaattrs',
            attributes: ['name'],
            where: { languageId: { [Op.eq]: LANG_ID } },
            required: false
          }
        ]
      }
    ]
  };
}

/**
 * Phase 2: fetches full ticket data with all associations for the given ticket
 * IDs (each ticket carries all its passenger rows). Final row ordering is
 * applied by the caller from the Phase-1 page order, so no ORDER is needed here.
 * Returns plain objects (toJSON already applied).
 *
 * @param {Object} where - Sequelize WHERE (must include id IN pageTicketIds)
 * @returns {Promise<Object[]>}
 */
async function fetchFullTicketData(where) {
  const rows = await Ticket.findAll({
    attributes: TICKET_ATTRIBUTES,
    where,
    distinct: true,
    include: [
      _cityInclude('originCity'),
      _cityInclude('destinationCity'),
      _busFlightInclude('busFlightFrom'),
      _busFlightInclude('busFlightTo'),
      _passengerTicketInclude(),
      _ticketMetaInclude('statusMeta'),
      _ticketMetaInclude('typeMeta')
    ]
  });

  return rows.map((r) => r.toJSON());
}

module.exports = {
  parseTicketListParams,
  buildFilterWhere,
  buildSortOrder,
  buildCustomSortOrder,
  fetchRowPage,
  fetchFullTicketData
};
