'use client';

import { useId, useState, type FormEvent } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import type { SearchQuery } from '@/lib/api/booking';
import {
  useAvailableDates,
  useErrorMessage,
  useNetwork
} from '@/lib/api/hooks';
import {
  endDateFor,
  MAX_PASSENGERS,
  toSearchParams,
  tripTypeOf,
  type TripType
} from '@/lib/booking/searchQuery';
import { formatDate } from '@/lib/format';
import { currencyOf, destinationsFrom, type Network } from '@/lib/network';
import { useRouter } from '@/i18n/navigation';

const TRIP_TYPES: TripType[] = ['oneWay', 'round', 'openDate'];
const TRIP_LABEL = {
  oneWay: 'oneWay',
  round: 'roundTrip',
  openDate: 'openDate'
} as const;

/** Cities grouped by country, for <optgroup>s. */
function byCountry(cities: Network['cities']) {
  const groups = new Map<string, Network['cities']>();
  for (const city of cities) {
    const country = city.country.name ?? '';
    groups.set(country, [...(groups.get(country) ?? []), city]);
  }
  return [...groups.entries()].map(([country, list]) => ({
    country,
    cities: [...list].sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''))
  }));
}

function CityOptions({ cities }: { cities: Network['cities'] }) {
  return byCountry(cities).map(({ country, cities: list }) => (
    <optgroup key={country} label={country}>
      {list.map((city) => (
        <option key={city.id} value={city.id}>
          {city.name}
        </option>
      ))}
    </optgroup>
  ));
}

function DateOptions({ dates }: { dates: string[] }) {
  const locale = useLocale();
  return dates.map((date) => (
    <option key={date} value={date}>
      {formatDate(date, locale, {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      })}
    </option>
  ));
}

export function SearchForm({ initial }: { initial?: Partial<SearchQuery> }) {
  const t = useTranslations();
  const router = useRouter();
  const errorMessage = useErrorMessage();
  const id = useId();
  const network = useNetwork();

  const [originId, setOriginId] = useState(initial?.originId);
  const [destinationId, setDestinationId] = useState(initial?.destinationId);
  const [tripType, setTripType] = useState<TripType>(
    initial?.endDate ? tripTypeOf(initial.endDate) : 'oneWay'
  );
  const [startDate, setStartDate] = useState(initial?.startDate ?? '');
  const [returnDate, setReturnDate] = useState(
    initial?.endDate && tripTypeOf(initial.endDate) === 'round'
      ? initial.endDate
      : ''
  );
  const [adults, setAdults] = useState(initial?.adults ?? 1);
  const [children, setChildren] = useState(initial?.children ?? 0);

  const departures = useAvailableDates(originId, destinationId, 'forwards');
  const returns = useAvailableDates(
    tripType === 'round' ? originId : undefined,
    destinationId,
    'backwards'
  );

  if (network.isPending) return <p>{t('common.loading')}</p>;
  if (network.isError) {
    return (
      <p role="alert" className="error">
        {errorMessage(network.error)}
      </p>
    );
  }

  const origins = network.data.cities.filter((city) =>
    network.data.fares.some((fare) => fare.fromCityId === city.id)
  );
  const destinations = originId ? destinationsFrom(network.data, originId) : [];
  const departureDates = departures.data ?? [];
  const returnDates = (returns.data ?? []).filter((date) => date > startDate);
  // Keep a chosen date only while it is still on offer
  const departure = departureDates.includes(startDate) ? startDate : '';
  const returnOn = returnDates.includes(returnDate) ? returnDate : '';

  const canSubmit =
    originId &&
    destinationId &&
    departure &&
    (tripType !== 'round' || returnOn) &&
    adults + children <= MAX_PASSENGERS;

  function submit(event: FormEvent) {
    event.preventDefault();
    const currency = originId ? currencyOf(network.data!, originId) : undefined;
    if (!canSubmit || !currency?.abbr) return;
    const query: SearchQuery = {
      originId: originId!,
      destinationId: destinationId!,
      startDate: departure,
      endDate: endDateFor(tripType, returnOn),
      adults,
      children,
      currencyAbbr: currency.abbr
    };
    router.push(`/search?${toSearchParams(query)}`);
  }

  return (
    <form onSubmit={submit} aria-labelledby={`${id}-title`} className="card">
      <h2 id={`${id}-title`}>{t('search.title')}</h2>
      <div className="form-row">
        <label>
          {t('search.from')}
          <br />
          <select
            required
            value={originId ?? ''}
            onChange={(e) => {
              setOriginId(Number(e.target.value) || undefined);
              setDestinationId(undefined);
            }}
          >
            <option value="">{t('search.chooseCity')}</option>
            <CityOptions cities={origins} />
          </select>
        </label>
        <label>
          {t('search.to')}
          <br />
          <select
            required
            disabled={!originId}
            value={destinationId ?? ''}
            onChange={(e) =>
              setDestinationId(Number(e.target.value) || undefined)
            }
          >
            <option value="">
              {originId
                ? t('search.chooseCity')
                : t('search.chooseOriginFirst')}
            </option>
            <CityOptions cities={destinations} />
          </select>
        </label>
      </div>

      <fieldset>
        <legend>{t('search.tripType')}</legend>
        {TRIP_TYPES.map((type) => (
          <label
            key={type}
            style={{ display: 'inline-block', marginRight: '1rem' }}
          >
            <input
              type="radio"
              name={`${id}-trip`}
              value={type}
              checked={tripType === type}
              onChange={() => setTripType(type)}
            />{' '}
            {t(`common.${TRIP_LABEL[type]}`)}
          </label>
        ))}
      </fieldset>

      <div className="form-row">
        <label>
          {t('search.departure')}
          <br />
          <select
            required
            disabled={!destinationId || departures.isPending}
            value={departure}
            onChange={(e) => setStartDate(e.target.value)}
          >
            <option value="">{t('search.pickDate')}</option>
            <DateOptions dates={departureDates} />
          </select>
        </label>
        {tripType === 'round' && (
          <label>
            {t('search.return')}
            <br />
            <select
              required
              disabled={!departure || returns.isPending}
              value={returnOn}
              onChange={(e) => setReturnDate(e.target.value)}
            >
              <option value="">{t('search.pickDate')}</option>
              <DateOptions dates={returnDates} />
            </select>
          </label>
        )}
        <label>
          {t('search.adults')}
          <br />
          <select
            value={adults}
            onChange={(e) => setAdults(Number(e.target.value))}
          >
            {Array.from({ length: MAX_PASSENGERS }, (_, i) => i + 1).map(
              (n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              )
            )}
          </select>
        </label>
        <label>
          {t('search.children')}
          <br />
          <select
            value={children}
            onChange={(e) => setChildren(Number(e.target.value))}
          >
            {Array.from({ length: MAX_PASSENGERS }, (_, i) => i).map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
      </div>

      {destinationId && departures.isSuccess && departureDates.length === 0 && (
        <p className="muted">{t('search.noDates')}</p>
      )}
      <p>
        <button type="submit" disabled={!canSubmit}>
          {t('search.submit')}
        </button>
      </p>
    </form>
  );
}
