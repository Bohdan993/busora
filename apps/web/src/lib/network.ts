import type { Schemas } from './api/client';

export type Network = Schemas['Network'];
export type Direction = Schemas['NetworkDirection'];
export type Stop = Schemas['NetworkStop'];
export type Fare = Schemas['Fare'];

const MINUTES_PER_DAY = 24 * 60;

const toMinutes = (time: string) => {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
};

/** The direction that boards at `fromCityId` and drops off at `toCityId`. */
export function findDirection(
  network: Network,
  fromCityId: number,
  toCityId: number
): Direction | undefined {
  return network.lines
    .flatMap((line) => line.directions)
    .find(
      (direction) =>
        direction.stops.some(
          (s) => s.kind === 'boarding' && s.cityId === fromCityId
        ) &&
        direction.stops.some(
          (s) => s.kind === 'dropOff' && s.cityId === toCityId
        )
    );
}

const stopOf = (direction: Direction, cityId: number, kind: Stop['kind']) =>
  direction.stops.find((s) => s.cityId === cityId && s.kind === kind);

/** Travel time in minutes between two stops of one direction. */
export function tripMinutes(
  direction: Direction,
  fromCityId: number,
  toCityId: number
): number | undefined {
  const from = stopOf(direction, fromCityId, 'boarding');
  const to = stopOf(direction, toCityId, 'dropOff');
  if (!from || !to) return undefined;
  return (
    (to.dayOffset - from.dayOffset) * MINUTES_PER_DAY +
    toMinutes(to.time) -
    toMinutes(from.time)
  );
}

/**
 * Weekdays (0 = Sunday) a stop is served on: the direction's departure days
 * shifted by the days it takes to reach that stop.
 */
export function stopWeekdays(direction: Direction, stop: Stop): number[] {
  return direction.weekdays
    .map((day) => (day + stop.dayOffset) % 7)
    .sort((a, b) => a - b);
}

/** Departure weekdays from `fromCityId` in a direction. */
export function departureWeekdays(
  direction: Direction,
  fromCityId: number
): number[] {
  const stop = stopOf(direction, fromCityId, 'boarding');
  return stop ? stopWeekdays(direction, stop) : [];
}

export function findFare(
  network: Network,
  fromCityId: number,
  toCityId: number,
  currency: string
): Fare | undefined {
  return network.fares.find(
    (f) =>
      f.fromCityId === fromCityId &&
      f.toCityId === toCityId &&
      f.currency === currency
  );
}

/** Fares are shown in the departure city's currency (UAH or CZK). */
export function currencyOf(network: Network, cityId: number) {
  return network.cities.find((c) => c.id === cityId)?.currency;
}

export function cityName(network: Network, cityId: number) {
  return network.cities.find((c) => c.id === cityId)?.name ?? '';
}

/** Destinations bookable from a city: those it has a fare to. */
export function destinationsFrom(network: Network, fromCityId: number) {
  const ids = new Set(
    network.fares
      .filter((f) => f.fromCityId === fromCityId)
      .map((f) => f.toCityId)
  );
  return network.cities.filter((c) => ids.has(c.id));
}

export interface CityPair {
  fromCityId: number;
  toCityId: number;
  /** The direction from → to, used for departure days and duration */
  outbound: Direction;
  /** The direction to → from, for the return trip */
  inbound?: Direction;
}

/** Every bookable pair, departure city first, in line and stop order. */
export function cityPairs(network: Network): CityPair[] {
  const pairs: CityPair[] = [];
  for (const line of network.lines) {
    for (const direction of line.directions) {
      const boarding = direction.stops.filter((s) => s.kind === 'boarding');
      const dropOff = direction.stops.filter((s) => s.kind === 'dropOff');
      for (const from of boarding) {
        for (const to of dropOff) {
          pairs.push({
            fromCityId: from.cityId,
            toCityId: to.cityId,
            outbound: direction,
            inbound: findDirection(network, to.cityId, from.cityId)
          });
        }
      }
    }
  }
  return pairs;
}
