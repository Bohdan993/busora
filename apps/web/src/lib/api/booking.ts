import { api, unwrap, type Schemas } from './client';

type LanguageCode = Schemas['LanguageCode'];
export type BusFlight = Schemas['BusFlight'];
export type AlternativeDay = Schemas['AlternativeDay'];
export type PassengerForm = Schemas['PassengerForm'];
export type PassengersInfo = Schemas['PassengersInfo'];
export type Checkout = Schemas['Checkout'];
export type MockCompletion = Schemas['MockCompletion'];
export type TicketSummary = Schemas['TicketSummary'];
export type SignedPayload = Schemas['SignedPayload'];
export type Direction = 'forwards' | 'backwards';

export interface SearchQuery {
  originId: number;
  destinationId: number;
  startDate: string;
  /** ISO return date, or 'one-way' / 'open-date' */
  endDate: string;
  adults: number;
  children: number;
  currencyAbbr: string;
}

// ── Site data ──────────────────────────────────────────────────────────────

export const getNetwork = (languageCode: LanguageCode) =>
  unwrap(api.GET('/api/network', { params: { query: { languageCode } } })).then(
    (body) => body.data
  );

export const getDiscounts = (languageCode: LanguageCode) =>
  unwrap(
    api.GET('/api/discounts', { params: { query: { languageCode } } })
  ).then((body) => body.data);

export const getAvailableDates = (query: {
  originId: number;
  destinationId: number;
  direction: Direction;
}) =>
  unwrap(
    api.GET('/api/bus-flights/available-dates', { params: { query } })
  ).then((body) => body.data);

// ── Booking (session-bound: each call reads or writes the booking session) ──

/** Starts a booking session; the first offer comes back pre-selected. */
export const searchFlights = (query: SearchQuery, languageCode: LanguageCode) =>
  unwrap(
    api.GET('/api/bus-flights', {
      params: { query: { ...query, languageCode } }
    })
  );

export const getAlternatives = (
  query: SearchQuery & { direction: Direction },
  languageCode: LanguageCode
) =>
  unwrap(
    api.GET('/api/bus-flights/alternatives', {
      params: { query: { ...query, languageCode } }
    })
  );

export const selectFlight = (body: {
  id: string;
  isMain: boolean;
  direction: Direction;
}) => unwrap(api.POST('/api/bus-flights/select', { body }));

export const getPassengerForm = (languageCode: LanguageCode) =>
  unwrap(
    api.GET('/api/passengers', { params: { query: { languageCode } } })
  ).then((body) => body.data);

export const validatePassengers = (
  passengersData: PassengersInfo,
  languageCode: LanguageCode
) =>
  unwrap(
    api.POST('/api/passengers/validate', {
      params: { query: { languageCode } },
      body: { passengersData }
    })
  );

export const getCurrentData = () =>
  unwrap(api.GET('/api/current-data')).then((body) => body.data);

export const startCheckout = (languageCode: LanguageCode) =>
  unwrap(
    api.POST('/api/payment', { params: { query: { languageCode } } })
  ).then((body) => body.data);

export const completeMockPayment = (
  checkout: Checkout,
  outcome: 'success' | 'failure'
) =>
  unwrap(
    api.POST('/api/payment/mock/complete', {
      body: { data: checkout.data, signature: checkout.signature, outcome }
    })
  ).then((body) => body.data);

export const getTicketSummary = (paid: SignedPayload) =>
  unwrap(api.POST('/api/tickets/summary', { body: paid })).then(
    (body) => body.data
  );

/** The ticket PDF (one passenger) or a ZIP of PDFs, with its file name. */
export async function downloadTickets(paid: SignedPayload) {
  const blob = await unwrap(
    api.POST('/api/tickets/download-pdf', { body: paid, parseAs: 'blob' })
  );
  const isZip = blob.type.includes('zip');
  return {
    blob,
    fileName: isZip ? 'Busora_Tickets.zip' : 'Busora_Ticket.pdf'
  };
}
