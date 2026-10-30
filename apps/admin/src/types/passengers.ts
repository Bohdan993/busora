import { type TicketPassenger } from './tickets';
export interface PassengerDiscount {
  name: string;
  percentage: number;
  id: string;
}

export interface Passenger {
  readonly passengerId?: string;
  passengerType: 'adult';
  name: string;
  lastName: string;
  phone: string;
  additionalPhone?: string | null;
  dateOfBirth: string;
  email: string;
  tickets?: TicketPassenger[];
}

export type PassengerTicket = Passenger & {
  ticketId?: string;
  passengerDiscount: PassengerDiscount;
  discountCardNumber: string | null;
};

export interface Child {
  readonly passengerId: string;
  passengerType: 'child';
  name: string;
  lastName: string;
  dateOfBirth: string;
}

export type ChildTicket = Child & {
  ticketId?: string;
  passengerDiscount: PassengerDiscount;
};

export interface PassengerOption {
  readonly passengerId?: string;
  name?: string;
  lastName?: string;
  phone?: string;
  label: string;
  passengerType?: 'adult' | 'child';
  additionalPhone?: string;
  dateOfBirth?: string;
  email?: string;
  passengerDiscount?: PassengerDiscount;
  discountCardNumber?: string | null;
}
