export interface BusFlight {
  readonly busFlightId?: string;
  allSeats: number;
  freeSeats: number;
  routeId: string;
  route?: any;
  dateOfDeparture: string;
  discount?: number;
}

export interface BusFlightOption {
  readonly busFlightId?: string;
  label: string;
  routeId?: string;
  name?: string;
  freeSeats?: number;
  discount?: string | number;
  dateOfDeparture?: string;
}
