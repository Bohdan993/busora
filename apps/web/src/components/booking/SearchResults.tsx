'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { SearchForm } from '@/components/search/SearchForm';
import { useRouter } from '@/i18n/navigation';
import {
  getAlternatives,
  searchFlights,
  selectFlight,
  type BusFlight,
  type Direction,
  type SearchQuery
} from '@/lib/api/booking';
import { ApiError } from '@/lib/api/client';
import { useApiLanguage, useErrorMessage, useNetwork } from '@/lib/api/hooks';
import { parseSearchQuery } from '@/lib/booking/searchQuery';
import { startSessionClock, writeBooking } from '@/lib/booking/storage';
import { formatDate } from '@/lib/format';
import { cityName } from '@/lib/network';
import { BookingSteps } from './BookingSteps';
import { FlightOffer } from './FlightOffer';
import { SessionTimer } from './SessionTimer';

const NOTHING_ON_DATE = ['NO_FLIGHTS', 'NO_FREE_SEATS'];

/** A round trip picked from alternatives: the outbound leg plus the return. */
const combine = (outbound: BusFlight, back: BusFlight): BusFlight => ({
  ...outbound,
  places: { from: outbound.places.from, to: back.places.from },
  dates: {
    ...outbound.dates,
    return: back.dates.departure,
    returnPure: back.dates.departurePure
  }
});

export function SearchResults() {
  const params = useSearchParams();
  const query = useMemo(
    () => parseSearchQuery(new URLSearchParams(params.toString())),
    [params]
  );
  const t = useTranslations();

  if (!query) {
    return (
      <>
        <p role="alert" className="error">
          {t('errors.BAD_REQUEST')}
        </p>
        <SearchForm />
      </>
    );
  }
  // Remount on a new search so no state from the previous one leaks
  return <Results key={params.toString()} query={query} />;
}

function Results({ query }: { query: SearchQuery }) {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const languageCode = useApiLanguage();
  const errorMessage = useErrorMessage();
  const network = useNetwork();
  const isRound = /^\d{4}-/.test(query.endDate);
  const [outboundChoice, setOutboundChoice] = useState<BusFlight | null>(null);

  // Searching starts a new booking session, so never serve it from cache
  const search = useQuery({
    queryKey: ['search', query, languageCode],
    queryFn: async () => {
      const result = await searchFlights(query, languageCode);
      startSessionClock(result.sessionExpiresTime);
      writeBooking('search', query);
      return result.data;
    },
    staleTime: 0,
    gcTime: 0
  });

  const nothingOnDate =
    search.error instanceof ApiError &&
    NOTHING_ON_DATE.includes(search.error.code);

  const alternatives = (direction: Direction, startDate: string) => ({
    queryKey: ['alternatives', query, direction, startDate, languageCode],
    queryFn: async () => {
      // The API looks for buses from originId to destinationId, so the return
      // leg asks with the cities swapped (unlike /available-dates, which
      // swaps them itself for `backwards`)
      const cities =
        direction === 'backwards'
          ? { originId: query.destinationId, destinationId: query.originId }
          : {};
      const result = await getAlternatives(
        { ...query, ...cities, startDate, direction },
        languageCode
      );
      if (direction === 'forwards') {
        startSessionClock(result.sessionExpiresTime);
        writeBooking('search', query);
      }
      return result.data;
    },
    staleTime: 0,
    gcTime: 0
  });
  const outboundAlternatives = useQuery({
    ...alternatives('forwards', query.startDate),
    enabled: nothingOnDate
  });
  const returnAlternatives = useQuery({
    // Returns leave after the chosen outbound departure
    ...alternatives('backwards', outboundChoice?.dates.departurePure ?? ''),
    enabled: Boolean(isRound && outboundChoice)
  });

  const select = useMutation({
    mutationFn: async (choice: {
      offer: BusFlight;
      isMain: boolean;
      direction: Direction;
    }) => {
      await selectFlight({
        id: choice.offer.id,
        isMain: choice.isMain,
        direction: choice.direction
      });
      return choice;
    },
    onSuccess: ({ offer, isMain, direction }) => {
      if (!isMain && isRound && direction === 'forwards') {
        // The return leg is picked next
        setOutboundChoice(offer);
        return;
      }
      writeBooking(
        'offer',
        outboundChoice && direction === 'backwards'
          ? combine(outboundChoice, offer)
          : offer
      );
      router.push('/booking/passengers');
    }
  });

  const from = network.data ? cityName(network.data, query.originId) : '';
  const to = network.data ? cityName(network.data, query.destinationId) : '';
  const passengers = query.adults + query.children;
  const dateText = (iso: string) => formatDate(iso, locale);

  const offers = (
    list: BusFlight[],
    isMain: boolean,
    direction: Direction,
    showReturn = true
  ) =>
    list.map((offer) => (
      <FlightOffer
        key={offer.id}
        offer={offer}
        currency={query.currencyAbbr}
        showReturn={showReturn}
        busy={select.isPending && select.variables?.offer.id === offer.id}
        onSelect={() => select.mutate({ offer, isMain, direction })}
      />
    ));

  return (
    <>
      <BookingSteps current="search" />
      <h1>{t('results.title', { from, to })}</h1>
      <p className="muted">
        {isRound
          ? t('results.summaryRound', {
              date: dateText(query.startDate),
              returnDate: dateText(query.endDate),
              passengers
            })
          : t('results.summary', {
              date: dateText(query.startDate),
              passengers
            })}
      </p>
      <SessionTimer />

      {select.isError && (
        <p role="alert" className="error">
          {errorMessage(select.error)}
        </p>
      )}

      {search.isPending && <p>{t('common.loading')}</p>}
      {search.isError && !nothingOnDate && (
        <p role="alert" className="error">
          {errorMessage(search.error)}
        </p>
      )}
      {search.isSuccess && (
        <section className="section">
          {offers(search.data, true, 'forwards')}
        </section>
      )}

      {nothingOnDate && (
        <section className="section" aria-live="polite">
          <p>{errorMessage(search.error)}</p>
          <h2>{t('results.alternativesTitle')}</h2>
          <p className="muted">{t('results.alternativesHint')}</p>
          {outboundAlternatives.isPending && <p>{t('common.loading')}</p>}
          {outboundAlternatives.isError && (
            <p role="alert" className="error">
              {errorMessage(outboundAlternatives.error)}
            </p>
          )}
          {outboundAlternatives.data?.map((day) => (
            <div key={day.date}>
              <h3>{dateText(day.date)}</h3>
              {offers(day.flights, false, 'forwards', false)}
            </div>
          ))}
        </section>
      )}

      {outboundChoice && (
        <section className="section" aria-live="polite">
          <h2>{t('results.alternativesReturnTitle')}</h2>
          <p className="muted">{t('results.chooseReturnHint')}</p>
          {returnAlternatives.isPending && <p>{t('common.loading')}</p>}
          {returnAlternatives.isError && (
            <p role="alert" className="error">
              {errorMessage(returnAlternatives.error)}
            </p>
          )}
          {returnAlternatives.data?.map((day) => (
            <div key={day.date}>
              <h3>{dateText(day.date)}</h3>
              {offers(day.flights, false, 'backwards', false)}
            </div>
          ))}
        </section>
      )}

      <p className="muted">{t('results.arrivalNote')}</p>
      <details>
        <summary>{t('results.newSearch')}</summary>
        <SearchForm initial={query} />
      </details>
    </>
  );
}
