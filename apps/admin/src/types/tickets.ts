// import { type PassengerTicket, type ChildTicket } from './passengers';
import { type PassengerDiscount } from './passengers';

export type TicketBusFlight = {
  readonly id: string;
  label?: string;
  name: string;
  routeId: string;
  freeSeats: number;
  discount: number;
  dateOfDeparture: string;
};

export type TicketCity = {
  readonly id: string;
  name: string;
  countryId: string;
};

export interface TicketStatus {
  readonly id: string;
  label: string;
  value: string;
  color: string;
}

export interface TicketConfirmationStatuses {
  readonly id: string;
  label: string;
  value: string;
}

export interface TicketType {
  readonly id: string;
  label: string;
  value: string;
}

export interface TicketAttributes {
  statuses: TicketStatus[];
  types: TicketType[];
  confirmations: TicketConfirmationStatuses[];
}

export interface TicketOption {
  readonly ticketId?: string;
  label: string;
  type?: string;
  dateOfCreature?: string;
  dateOfDeparture?: string;
  dateOfReturn?: string | null;
  origin?: TicketCity;
  destination?: TicketCity;
  busFlightFrom?: TicketBusFlight;
  busFlightTo?: TicketBusFlight | string | null;
  price?: number;
  currency?: string;
  status?: string;
  discount?: string | number;
}

export interface Agent {
  // Mirrors the API/PUT shape; backend reads `id`, `name` is the display label.
  readonly id: string;
  name?: string;
}

// Shape returned by GET /agents (used to populate the agent dropdown).
// Includes a synthetic "No agent" entry with id "0".
export interface AgentOption {
  id: string;
  label: string;
  value: string;
  name: string;
}

export interface Ticket {
  readonly ticketId: string;
  lastName: string;
  name: string;
  confirmation: string;
  // Id-bearing object the PUT endpoint reads (parseInt(passengerConfirmation.id)).
  // `confirmation` above is the display/select string; this is what's persisted.
  passengerConfirmation?: { id: string } | null;
  ticketNumber: string;
  type: string;
  paymentOnBus: number | null;
  paymentAtOffice: number | null;
  price: number;
  // Per-passenger price (the "Ціна квитка" column); `price` is the booking total.
  passengerPrice?: number;
  // UAH-normalized amounts derived by the backend on read (raw × exchangeRate).
  // The table DISPLAYS these so the whole money row is consistent in UAH;
  // editing/writing still uses the raw paymentOnBus/paymentAtOffice above
  // (booking currency). exchangeRate is locked at booking.
  priceUAH?: number;
  passengerPriceUAH?: number;
  paymentOnBusUAH?: number | null;
  paymentAtOfficeUAH?: number | null;
  exchangeRate?: number;
  currency: string;
  passengerDiscount: PassengerDiscount | null;
  discountCardNumber: string;
  discount: string | number;
  origin: TicketCity;
  destination: TicketCity;
  busFlightFrom: TicketBusFlight;
  busFlightTo: TicketBusFlight | string | null;
  dateOfCreature: string;
  dateOfDeparture: string;
  dateOfReturn: string | null;
  phone: string;
  additionalPhone: string;
  email: string;
  dateOfBirth: string;
  passengerType: 'adult' | 'child';
  agent: Agent | string; // TODO
  busSeat: string;
  status: string;
  note: string | null;
  dateOfFirstUsage?: string | null;
  pdfName?: string | null;
  isPDFExists?: boolean;
  childKey?: string | null;
  passengerId?: number;
}

export type TicketPassenger = Ticket & {
  passengerId?: string;
  passengerDiscount: PassengerDiscount | null;
  discountCardNumber: string | null;
};

// Per-passenger fields the POST /tickets endpoint reads beyond the identity
// ones. The backend derives each passenger's price from paymentAtOffice +
// paymentOnBus, so these must be sent (not just edited later).
export interface CreateTicketPassengerExtras {
  agent?: { id: string; name?: string | null } | null;
  passengerConfirmation?: { id: string; name?: string | null } | null;
  paymentAtOffice?: number | null;
  paymentOnBus?: number | null;
  busSeat?: string | null;
  note?: string | null;
}

// Shape the POST /tickets endpoint expects: ticket-level fields + per-passenger
// arrays (children carry fewer fields than adults).
export interface CreateTicketPassenger extends CreateTicketPassengerExtras {
  name: string;
  lastName: string;
  passengerType: { id: string; name?: string | null } | null;
  phone?: string | null;
  additionalPhone?: string | null;
  email?: string | null;
  dateOfBirth?: string | null;
  passengerDiscount?: PassengerDiscount | null;
  discountCardNumber?: string | null;
}

export interface CreateTicketChild extends CreateTicketPassengerExtras {
  name: string;
  lastName: string;
  passengerType: { id: string; name?: string | null } | null;
  dateOfBirth?: string | null;
  passengerDiscount?: PassengerDiscount | null;
}

export interface CreateTicketBody {
  type: { id: string; name: string } | null;
  dateOfDeparture: string;
  dateOfReturn: string | null;
  origin: TicketCity;
  destination: TicketCity;
  busFlightFrom: TicketBusFlight | string;
  busFlightTo: TicketBusFlight | string | null;
  price: number;
  currency: string;
  status: { id: string; name: string } | null;
  discount: { percentage: number; name: string | null };
  passengers: CreateTicketPassenger[];
  children: CreateTicketChild[];
}
