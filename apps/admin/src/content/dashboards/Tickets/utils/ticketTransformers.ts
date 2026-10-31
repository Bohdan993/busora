import dayjs from 'dayjs';
import type {
  Ticket,
  TicketBusFlight,
  TicketConfirmationStatuses
} from 'src/types/tickets';
import { isOneWayTicket } from 'src/helpers';

// UAH is the backend's canonical currency. A ticket whose `currency` is unset
// or "UAH" is edited/written in UAH (the *UAH fields); any other currency is a
// booking-currency ticket, edited/written in that currency (the raw fields).
export const isUAHCurrency = (currency: any): boolean =>
  !currency || String(currency).toUpperCase() === 'UAH';

// Symbol shown on the money inputs so the admin sees which currency they are
// typing in. Falls back to the currency code itself for anything unmapped.
const CURRENCY_SYMBOLS: Record<string, string> = {
  UAH: '₴',
  EUR: '€',
  USD: '$',
  GBP: '£',
  PLN: 'zł',
  CZK: 'Kč'
};
export const currencySymbol = (currency: any): string => {
  const code = String(currency || 'UAH').toUpperCase();
  return CURRENCY_SYMBOLS[code] || code;
};

// GET /tickets returns several reference fields as objects ({ id, name }),
// but the table/validation/edit/create code all consume them as the plain
// string a create-form select produces (e.g. type === "В одну сторону").
// Flatten them once on load so the rest of the module keeps working.
// Defensive + idempotent: if the API ever sends the flat shape, pass it
// through unchanged (so running this twice is a no-op).
export const normalizeTicket = (
  raw: any,
  confirmationStatuses: TicketConfirmationStatuses[] = []
): Ticket => {
  if (!raw || typeof raw !== 'object') return raw;

  const toName = (value: any): any =>
    value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    'name' in value
      ? value.name
      : value;

  // The API sends `passengerConfirmation: { id, name }`. The table/select uses
  // a `confirmation` string for display; the PUT endpoint reads
  // `passengerConfirmation.id`. Keep both: resolve the display value (name may
  // be null, so look it up by id) and keep an id-bearing object for writes.
  const rawConfirmation = raw.passengerConfirmation ?? raw.confirmation;
  let confirmation = '';
  let passengerConfirmation: { id: string } | null = null;
  if (rawConfirmation && typeof rawConfirmation === 'object') {
    const match = confirmationStatuses.find(
      (c) => String(c.id) === String(rawConfirmation.id)
    );
    confirmation = match?.value ?? rawConfirmation.name ?? '';
    passengerConfirmation =
      rawConfirmation.id != null ? { id: String(rawConfirmation.id) } : null;
  } else {
    confirmation = rawConfirmation ?? '';
    const match = confirmationStatuses.find((c) => c.value === confirmation);
    passengerConfirmation = match ? { id: String(match.id) } : null;
  }

  // agent: normalise to the { id, name } shape the API returns and the PUT
  // body needs (backend reads agent.id); `name` is the display label. Handles
  // the legacy { agentId, label, name } shape defensively.
  let agent = raw.agent;
  if (agent && typeof agent === 'object') {
    agent = {
      id: String(agent.id ?? agent.agentId ?? ''),
      name: agent.name ?? agent.label ?? ''
    };
  }

  return {
    ...raw,
    type: toName(raw.type),
    status: toName(raw.status),
    passengerType:
      raw.passengerType && typeof raw.passengerType === 'object'
        ? raw.passengerType.id
        : raw.passengerType,
    // discount (the "Акційна знижка" % column) now comes as { percentage, name };
    // the column displays/edits a number and the PUT body sends a number.
    discount:
      raw.discount && typeof raw.discount === 'object'
        ? raw.discount.percentage ?? 0
        : raw.discount,
    // The backend derives UAH amounts and owns all currency math. The money
    // COLUMNS display the *UAH fields directly (see the Cells), and
    // price/passengerPrice stay in UAH so a CZK row and a UAH row sort/compare
    // correctly. The EDIT inputs, however, work in the ticket's own currency
    // (Option 1): a UAH ticket is edited in UAH, a CZK ticket in CZK. So
    // paymentOnBus/paymentAtOffice — the accessor the edit field binds to —
    // hold the UAH value for UAH tickets and the backend-derived
    // booking-currency value otherwise. The *UAH and raw fields both stay on
    // the object via ...raw, so the display Cells and the write path can pick
    // whichever they need.
    price: raw.priceUAH ?? raw.price,
    passengerPrice: raw.passengerPriceUAH ?? raw.passengerPrice,
    paymentOnBus: isUAHCurrency(raw.currency)
      ? raw.paymentOnBusUAH ?? raw.paymentOnBus
      : raw.paymentOnBus ?? raw.paymentOnBusUAH,
    paymentAtOffice: isUAHCurrency(raw.currency)
      ? raw.paymentAtOfficeUAH ?? raw.paymentAtOffice
      : raw.paymentAtOffice ?? raw.paymentAtOfficeUAH,
    confirmation,
    passengerConfirmation,
    agent
  };
};

// Empty -> null, so the PUT body matches what GET returns (null, not "" / "-").
const blankToNull = (v: any) =>
  v === '' || v === '-' || v === undefined ? null : v;

// A busflight object reaches us either from GET (keyed by `id`) or from the
// search autocomplete (keyed by `busFlightId`). The backend reads
// busFlight*?.id, so ensure `id` is present (derive from busFlightId). Returns
// null for empty/"-".
const normalizeBusFlight = (v: any) => {
  if (v === null || v === undefined || v === '' || v === '-') return null;
  if (typeof v !== 'object') return v;
  return v.id != null && v.id !== '' ? v : { ...v, id: v.busFlightId };
};

// Money fields: empty or 0 -> null (GET returns null for "not paid").
const amountOrNull = (v: any) =>
  v === null || v === undefined || v === '' || Number(v) === 0
    ? null
    : Number(v);

// Rebuild a { id, name } reference object from the flattened display value the
// table stores (e.g. type/status are strings in the row, but GET/PUT use the
// object). Looks the id up in the attribute list by its `value`.
const buildMeta = (
  value: any,
  list: Array<{ id: string; value: string }> = []
): { id: string | null; name: string } | null => {
  if (value === null || value === undefined || value === '' || value === '-')
    return null;
  if (typeof value === 'object') return value; // already an object — pass through
  const found = list.find((x) => x.value === value);
  return found
    ? { id: String(found.id), name: found.value }
    : { id: null, name: String(value) };
};

// Rebuild passengerDiscount { id, percentage, name } from the select's display
// string (MRT stores it in _valuesCache, so other cells' edits can clobber the
// object with the string). Pass an object through unchanged.
const buildPassengerDiscount = (
  value: any,
  list: Array<{ id: string; value: string; coef?: string | number }> = []
) => {
  if (value === null || value === undefined || value === '' || value === '-')
    return null;
  if (typeof value === 'object') return value;
  const found = list.find(
    (d) => d.value?.toLowerCase() === String(value).toLowerCase()
  );
  return found
    ? {
        id: String(found.id),
        percentage: Math.round(Number(found.coef) * 100) || 0,
        name: found.value
      }
    : null;
};

// Rebuild agent { id, name } from the select's display string, same reasoning.
// The string can be the option value (after editing) OR the agent name (the
// column accessor) — match any of value/label/name so the result round-trips to
// the same object the loaded row holds (otherwise no-op edits look like changes).
const buildAgent = (
  value: any,
  list: Array<{ id: string; value: string; label: string; name?: string }> = []
) => {
  if (value === null || value === undefined || value === '' || value === '-')
    return null;
  if (typeof value === 'object')
    return { id: String(value.id), name: value.name ?? null };
  const needle = String(value).toLowerCase();
  const found = list.find((a) =>
    [a.value, a.label, a.name].some((x) => String(x).toLowerCase() === needle)
  );
  return found ? { id: String(found.id), name: found.label } : null;
};

export interface TransformTicketRefs {
  types?: Array<{ id: string; value: string }>;
  statuses?: Array<{ id: string; value: string }>;
  discounts?: Array<{ id: string; value: string; coef?: string | number }>;
  agents?: Array<{ id: string; value: string; label: string; name?: string }>;
}

// Normalises a ticket for the PUT endpoint so the body mirrors the GET shape:
// objects stay objects, strings strings, numbers numbers, empties -> null.
// The table stores flattened values (selects need string values), so reference
// fields are re-inflated to { id, name } here. Drops only the FE-only
// `confirmation` display copy (GET exposes `passengerConfirmation`).
export const transformTicket = (
  ticket: Ticket | undefined,
  refs: TransformTicketRefs = {}
): Record<string, any> | null => {
  if (!ticket) return null;

  // `confirmation` is a display-only mirror of passengerConfirmation — not part
  // of the GET/PUT shape. ticketId stays; the caller pulls it out for the URL.
  const { confirmation, ...rest } = ticket as Ticket & {
    confirmation?: string;
  };

  const discountNum =
    ticket.discount === 'Без знижки' ? 0 : Number(ticket.discount) || 0;

  return {
    ...rest,
    type: buildMeta(ticket.type, refs.types),
    status: buildMeta(ticket.status, refs.statuses),
    // GET sends discount as { percentage, name }; backend reads percentage.
    discount: { percentage: discountNum, name: null },
    passengerType:
      ticket.passengerType && typeof ticket.passengerType === 'object'
        ? ticket.passengerType
        : ticket.passengerType
        ? {
            id: String(ticket.passengerType),
            name: String(ticket.passengerType)
          }
        : null,
    passengerConfirmation:
      ticket.passengerConfirmation?.id != null
        ? {
            id: String(ticket.passengerConfirmation.id),
            name: confirmation || null
          }
        : null,
    passengerDiscount: buildPassengerDiscount(
      ticket.passengerDiscount,
      refs.discounts
    ),
    agent: buildAgent(ticket.agent, refs.agents),
    busFlightFrom: normalizeBusFlight(ticket?.busFlightFrom),
    busFlightTo:
      isOneWayTicket(ticket?.type || '') || ticket?.busFlightTo === '-'
        ? null
        : normalizeBusFlight(ticket?.busFlightTo),
    dateOfReturn:
      isOneWayTicket(ticket?.type || '') ||
      ticket?.dateOfReturn === '-' ||
      !dayjs(ticket?.dateOfReturn).isValid()
        ? null
        : dayjs(ticket?.dateOfReturn).format('YYYY-MM-DD'),
    dateOfDeparture: dayjs(ticket?.dateOfDeparture).isValid()
      ? dayjs(ticket?.dateOfDeparture).format('YYYY-MM-DD')
      : dayjs(new Date()).format('YYYY-MM-DD'),
    // The date-column accessors yield Dayjs objects, but GET sends plain
    // YYYY-MM-DD strings — normalise so an unchanged row hashes identically
    // (otherwise every edit looks like a change and fires a spurious PUT).
    dateOfBirth: dayjs(ticket?.dateOfBirth).isValid()
      ? dayjs(ticket?.dateOfBirth).format('YYYY-MM-DD')
      : ticket?.dateOfBirth ?? null,
    dateOfCreature: dayjs(ticket?.dateOfCreature).isValid()
      ? dayjs(ticket?.dateOfCreature).format('YYYY-MM-DD')
      : ticket?.dateOfCreature ?? null,
    // Currency-aware write (Option 1). The backend infers which currency an
    // amount is in from WHICH field carries it, so we send exactly one pair and
    // leave the other undefined (JSON drops undefined keys):
    //   UAH ticket → the edited amounts are UAH → send the *UAH pair.
    //   booking-currency ticket → the edited amounts are in `currency` → send
    //     the raw pair; the backend converts to UAH at the locked rate.
    // `currency` rides along in ...rest. Never send both pairs (the *UAH pair
    // would win and the raw amount be ignored).
    ...(isUAHCurrency(ticket?.currency)
      ? {
          paymentOnBusUAH: amountOrNull(ticket?.paymentOnBus),
          paymentAtOfficeUAH: amountOrNull(ticket?.paymentAtOffice),
          paymentOnBus: undefined,
          paymentAtOffice: undefined
        }
      : {
          paymentOnBus: amountOrNull(ticket?.paymentOnBus),
          paymentAtOffice: amountOrNull(ticket?.paymentAtOffice),
          paymentOnBusUAH: undefined,
          paymentAtOfficeUAH: undefined
        }),
    busSeat: blankToNull(ticket?.busSeat),
    note: blankToNull(ticket?.note),
    additionalPhone: blankToNull(ticket?.additionalPhone),
    // Backend validates discountCardNumber as a string; GET returns it as a
    // number, so coerce (null when empty).
    discountCardNumber:
      blankToNull(ticket?.discountCardNumber) === null
        ? null
        : String(ticket?.discountCardNumber),
    email: blankToNull(ticket?.email)
  };
};

// Build the POST /tickets body. The create form is a single passenger row, but
// the endpoint expects ticket-level fields plus `passengers[]` and `children[]`
// (an item lands in `children` when its passengerType is "child"). Reuses
// transformTicket to normalise the values, then splits ticket- vs passenger-level
// fields per the POST contract (no agent/payments/confirmation/busSeat/note at
// create time).
export const buildCreateTicketBody = (
  values: Ticket | undefined,
  refs: TransformTicketRefs = {}
): Record<string, any> | null => {
  const t = transformTicket(values, refs);
  if (!t) return null;

  // passengerType is required as an object; default to adult when the create
  // row never set it (the column defaults to "Дорослий"/adult on display).
  const passengerType = t.passengerType || { id: 'adult', name: 'adult' };
  const isChild = String(passengerType.id) === 'child';

  // Per-passenger fields the backend reads to compute price + store the record.
  // transformTicket already normalised them (amounts → number|null, agent /
  // confirmation → { id, name }, busSeat / note → null when blank).
  const extras = {
    agent: t.agent ?? null,
    passengerConfirmation: t.passengerConfirmation ?? null,
    // Currency-aware (same contract as the edit path): send the *UAH pair for a
    // UAH ticket, the raw pair for a booking-currency ticket. transformTicket
    // already nulled the unused pair; ticket-level `currency` is sent below.
    ...(isUAHCurrency(t.currency)
      ? {
          paymentAtOfficeUAH: t.paymentAtOfficeUAH ?? null,
          paymentOnBusUAH: t.paymentOnBusUAH ?? null
        }
      : {
          paymentAtOffice: t.paymentAtOffice ?? null,
          paymentOnBus: t.paymentOnBus ?? null
        }),
    busSeat: t.busSeat ?? null,
    note: t.note ?? null
  };

  const passengerItem = {
    name: t.name ?? '',
    lastName: t.lastName ?? '',
    passengerType,
    phone: t.phone ?? null,
    additionalPhone: t.additionalPhone ?? null,
    email: t.email ?? null,
    dateOfBirth: t.dateOfBirth ?? null,
    passengerDiscount: t.passengerDiscount ?? null,
    discountCardNumber: t.discountCardNumber ?? null,
    ...extras
  };

  const childItem = {
    name: t.name ?? '',
    lastName: t.lastName ?? '',
    passengerType,
    dateOfBirth: t.dateOfBirth ?? null,
    passengerDiscount: t.passengerDiscount ?? null,
    ...extras
  };

  return {
    type: t.type,
    dateOfDeparture: t.dateOfDeparture,
    dateOfReturn: t.dateOfReturn,
    origin: t.origin,
    destination: t.destination,
    busFlightFrom: t.busFlightFrom,
    busFlightTo: t.busFlightTo,
    // Price is calculated on the backend; send a valid int placeholder.
    price: Number(t.price) || 0,
    currency: t.currency,
    status: t.status,
    discount: t.discount,
    passengers: isChild ? [] : [passengerItem],
    children: isChild ? [childItem] : []
  };
};

export const transformTicketBusFlightToString = (
  ticket: Ticket,
  flightType: 'busFlightFrom' | 'busFlightTo'
): string => {
  const flight = ticket[flightType] as TicketBusFlight | string;

  if (!flight || (typeof flight === 'string' && flight === '-')) {
    return '-';
  }

  if (typeof flight === 'object' && flight.name && flight.dateOfDeparture) {
    return `${flight.name} (${dayjs(flight.dateOfDeparture).format(
      'DD-MM-YYYY'
    )})`;
  }

  return String(flight);
};
