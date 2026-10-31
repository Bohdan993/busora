'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useDiscounts, useErrorMessage, useNetwork } from '@/lib/api/hooks';
import { formatMoney } from '@/lib/format';
import { cityName, currencyOf, findFare, type Direction } from '@/lib/network';
import { LinePicker } from './LinePicker';

function FareGrid({ direction }: { direction: Direction }) {
  const t = useTranslations('faresPage');
  const locale = useLocale();
  const network = useNetwork().data!;
  const origins = direction.stops.filter((s) => s.kind === 'boarding');
  const destinations = direction.stops.filter((s) => s.kind === 'dropOff');
  const currency = currencyOf(network, origins[0]?.cityId ?? 0)?.abbr ?? 'UAH';
  const money = (amount: number) => formatMoney(amount, currency, locale);

  return (
    <section className="section">
      <h2>
        {direction.name} ({currency})
      </h2>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th scope="col">{t('fromTo')}</th>
              {origins.map((stop) => (
                <th key={stop.cityId} scope="col">
                  {cityName(network, stop.cityId)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {destinations.map((to) => (
              <tr key={to.cityId}>
                <th scope="row">{cityName(network, to.cityId)}</th>
                {origins.map((from) => {
                  const fare = findFare(
                    network,
                    from.cityId,
                    to.cityId,
                    currency
                  );
                  return (
                    <td key={from.cityId}>
                      {fare
                        ? `${money(fare.oneWay)} / ${money(fare.roundTrip)}`
                        : '—'}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function DiscountsTable() {
  const t = useTranslations('faresPage');
  const errorMessage = useErrorMessage();
  const discounts = useDiscounts();

  if (discounts.isPending) return null;
  if (discounts.isError) {
    return (
      <p role="alert" className="error">
        {errorMessage(discounts.error)}
      </p>
    );
  }
  return (
    <section className="section">
      <h2>{t('discountsTitle')}</h2>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th scope="col">{t('who')}</th>
              <th scope="col">{t('discount')}</th>
            </tr>
          </thead>
          <tbody>
            {discounts.data.flatMap((group) =>
              group.items.map((item) => (
                <tr key={item.id}>
                  <th scope="row">
                    {t(`groups.${group.group}`)}: {item.name}
                  </th>
                  <td>{Math.round(item.coef * 100)}%</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <p className="muted">{t('discountsNote')}</p>
    </section>
  );
}

export function FaresTables() {
  const t = useTranslations();
  const errorMessage = useErrorMessage();
  const network = useNetwork();
  const [lineId, setLineId] = useState<number | null>(null);

  if (network.isPending) return <p>{t('common.loading')}</p>;
  if (network.isError) {
    return (
      <p role="alert" className="error">
        {errorMessage(network.error)}
      </p>
    );
  }
  const line =
    network.data.lines.find((l) => l.id === lineId) ?? network.data.lines[0];

  return (
    <>
      {line && (
        <>
          <LinePicker
            network={network.data}
            value={line.id}
            onChange={setLineId}
          />
          {line.directions.map((direction) => (
            <FareGrid key={direction.routeId} direction={direction} />
          ))}
        </>
      )}
      <DiscountsTable />
      <section className="section card card-muted prose">
        <h2>{t('faresPage.baggageTitle')}</h2>
        <ul>
          {(t.raw('faresPage.baggage') as string[]).map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>
    </>
  );
}
