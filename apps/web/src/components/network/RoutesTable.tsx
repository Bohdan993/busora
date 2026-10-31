'use client';

import { useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { Link } from '@/i18n/navigation';
import { useErrorMessage, useNetwork } from '@/lib/api/hooks';
import { formatMoney, WEEK_ORDER, weekdayNames } from '@/lib/format';
import { useDurationText } from '@/lib/useDurationText';
import {
  cityName,
  cityPairs,
  currencyOf,
  departureWeekdays,
  findFare,
  tripMinutes,
  type Network
} from '@/lib/network';
import { Weekdays } from './Weekdays';

interface Row {
  /** The pair as the outbound direction serves it (Ukraine → Czechia) */
  uaCityId: number;
  czCityId: number;
  daysFromUa: number[];
  daysFromCz: number[];
  minutes?: number;
}

/** One row per Ukrainian–Czech city pair, in line and stop order. */
function buildRows(network: Network): Row[] {
  const startCountry = network.lines[0]?.directions[0]?.countryId;
  return cityPairs(network)
    .filter((pair) => pair.outbound.countryId === startCountry)
    .map((pair) => ({
      uaCityId: pair.fromCityId,
      czCityId: pair.toCityId,
      daysFromUa: departureWeekdays(pair.outbound, pair.fromCityId),
      daysFromCz: pair.inbound
        ? departureWeekdays(pair.inbound, pair.toCityId)
        : [],
      minutes: tripMinutes(pair.outbound, pair.fromCityId, pair.toCityId)
    }));
}

const toId = (value: string | null) => Number(value) || 0;

export function RoutesTable() {
  const t = useTranslations();
  const locale = useLocale();
  const params = useSearchParams();
  const errorMessage = useErrorMessage();
  const network = useNetwork();
  const durationText = useDurationText();
  const [fromId, setFromId] = useState(toId(params.get('from')));
  const [toCityId, setToCityId] = useState(toId(params.get('to')));
  const [day, setDay] = useState(-1);
  const rows = useMemo(
    () => (network.data ? buildRows(network.data) : []),
    [network.data]
  );

  if (network.isPending) return <p>{t('common.loading')}</p>;
  if (network.isError) {
    return (
      <p role="alert" className="error">
        {errorMessage(network.error)}
      </p>
    );
  }
  const data = network.data;
  const names = weekdayNames(locale, 'long');
  const touches = (row: Row, cityId: number) =>
    !cityId || row.uaCityId === cityId || row.czCityId === cityId;
  const visible = rows.filter(
    (row) =>
      touches(row, fromId) &&
      touches(row, toCityId) &&
      (day < 0 || row.daysFromUa.includes(day) || row.daysFromCz.includes(day))
  );
  const fareText = (from: number, to: number) => {
    const currency = currencyOf(data, from)?.abbr;
    const fare = currency && findFare(data, from, to, currency);
    return fare
      ? `${formatMoney(fare.oneWay, currency, locale)} / ${formatMoney(fare.roundTrip, currency, locale)}`
      : '—';
  };
  const cityOptions = [...data.cities].sort((a, b) =>
    (a.name ?? '').localeCompare(b.name ?? '')
  );

  return (
    <>
      <div className="toolbar" role="search">
        <label className="field">
          <span className="field-label">{t('routesPage.filterFrom')}</span>
          <select
            value={fromId}
            onChange={(e) => setFromId(Number(e.target.value))}
          >
            <option value={0}>{t('routesPage.anyCity')}</option>
            {cityOptions.map((city) => (
              <option key={city.id} value={city.id}>
                {city.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className="field-label">{t('routesPage.filterTo')}</span>
          <select
            value={toCityId}
            onChange={(e) => setToCityId(Number(e.target.value))}
          >
            <option value={0}>{t('routesPage.anyCity')}</option>
            {cityOptions.map((city) => (
              <option key={city.id} value={city.id}>
                {city.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className="field-label">{t('routesPage.filterDay')}</span>
          <select value={day} onChange={(e) => setDay(Number(e.target.value))}>
            <option value={-1}>{t('routesPage.anyDay')}</option>
            {WEEK_ORDER.map((d) => (
              <option key={d} value={d}>
                {names[d]}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="button-outline"
          onClick={() => {
            setFromId(0);
            setToCityId(0);
            setDay(-1);
          }}
        >
          {t('routesPage.reset')}
        </button>
      </div>

      <div className="table-scroll" aria-live="polite">
        <table>
          <thead>
            <tr>
              <th scope="col">{t('routesPage.route')}</th>
              <th scope="col">{t('routesPage.price')}</th>
              <th scope="col">{t('routesPage.duration')}</th>
              <th scope="col">{t('routesPage.daysFromUa')}</th>
              <th scope="col">{t('routesPage.daysFromCz')}</th>
              <th scope="col">
                <span className="visually-hidden">{t('routesPage.book')}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => {
              // Book in the direction the visitor filtered for
              const reverse = fromId === row.czCityId;
              const [from, to] = reverse
                ? [row.czCityId, row.uaCityId]
                : [row.uaCityId, row.czCityId];
              return (
                <tr key={`${row.uaCityId}-${row.czCityId}`}>
                  <th scope="row">
                    {cityName(data, from)} — {cityName(data, to)}
                  </th>
                  <td>
                    {fareText(row.uaCityId, row.czCityId)}
                    <br />
                    {fareText(row.czCityId, row.uaCityId)}
                  </td>
                  <td>
                    {row.minutes !== undefined && durationText(row.minutes)}
                  </td>
                  <td>
                    <Weekdays days={row.daysFromUa} />
                  </td>
                  <td>
                    <Weekdays days={row.daysFromCz} />
                  </td>
                  <td>
                    <Link
                      href={`/?from=${from}&to=${to}#search`}
                      className="button button-small"
                    >
                      {t('routesPage.book')}
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {visible.length === 0 && <p>{t('routesPage.empty')}</p>}

      <section className="section">
        <h2>{t('routesPage.alsoTitle')}</h2>
        <ul className="chips">
          {cityOptions.map((city) => {
            const other = data.cities.find(
              (c) => c.country.id !== city.country.id
            );
            return (
              <li key={city.id}>
                <Link
                  href={`/routes?from=${city.id}`}
                  className="button button-outline button-small"
                  onClick={() => setFromId(city.id)}
                >
                  {t('routesPage.toCountry', {
                    city: city.name ?? '',
                    country: other?.country.name ?? ''
                  })}
                </Link>
              </li>
            );
          })}
        </ul>
      </section>
    </>
  );
}
