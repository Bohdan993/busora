import type { SearchQuery } from '@/lib/api/booking';

export type TripType = 'oneWay' | 'round' | 'openDate';

const ONE_WAY = 'one-way';
const OPEN_DATE = 'open-date';
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const CURRENCY = /^[A-Z]{3}$/;
export const MAX_PASSENGERS = 9;

export function tripTypeOf(endDate: string): TripType {
  if (endDate === ONE_WAY) return 'oneWay';
  if (endDate === OPEN_DATE) return 'openDate';
  return 'round';
}

/** The API's endDate for a trip type: a return date, or a keyword. */
export function endDateFor(tripType: TripType, returnDate = ''): string {
  if (tripType === 'oneWay') return ONE_WAY;
  if (tripType === 'openDate') return OPEN_DATE;
  return returnDate;
}

export function toSearchParams(query: SearchQuery): URLSearchParams {
  return new URLSearchParams({
    originId: String(query.originId),
    destinationId: String(query.destinationId),
    startDate: query.startDate,
    endDate: query.endDate,
    adults: String(query.adults),
    children: String(query.children),
    currencyAbbr: query.currencyAbbr
  });
}

const positiveInt = (value: string | null) =>
  value && /^[1-9]\d*$/.test(value) ? Number(value) : null;
const count = (value: string | null, min: number) => {
  const n = value !== null && /^\d+$/.test(value) ? Number(value) : NaN;
  return n >= min && n <= MAX_PASSENGERS ? n : null;
};

/** A search from URL parameters, or null when anything is missing or malformed. */
export function parseSearchQuery(params: URLSearchParams): SearchQuery | null {
  const originId = positiveInt(params.get('originId'));
  const destinationId = positiveInt(params.get('destinationId'));
  const startDate = params.get('startDate') ?? '';
  const endDate = params.get('endDate') ?? '';
  const adults = count(params.get('adults'), 1);
  const children = count(params.get('children'), 0);
  const currencyAbbr = params.get('currencyAbbr') ?? '';

  const validEnd =
    endDate === ONE_WAY ||
    endDate === OPEN_DATE ||
    (ISO_DATE.test(endDate) && endDate > startDate);

  if (
    !originId ||
    !destinationId ||
    originId === destinationId ||
    !ISO_DATE.test(startDate) ||
    !validEnd ||
    adults === null ||
    children === null ||
    adults + children > MAX_PASSENGERS ||
    !CURRENCY.test(currencyAbbr)
  ) {
    return null;
  }
  return {
    originId,
    destinationId,
    startDate,
    endDate,
    adults,
    children,
    currencyAbbr
  };
}
