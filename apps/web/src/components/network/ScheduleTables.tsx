'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useErrorMessage, useNetwork } from '@/lib/api/hooks';
import { cityName, stopWeekdays } from '@/lib/network';
import { LinePicker } from './LinePicker';
import { Weekdays } from './Weekdays';

export function ScheduleTables() {
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
  const data = network.data;
  const line = data.lines.find((l) => l.id === lineId) ?? data.lines[0];
  if (!line) return null;

  return (
    <>
      <LinePicker network={data} value={line.id} onChange={setLineId} />
      {line.directions.map((direction) => (
        <section key={direction.routeId} className="section">
          <h2>{direction.name}</h2>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th scope="col">{t('schedulePage.city')}</th>
                  <th scope="col">{t('schedulePage.stop')}</th>
                  <th scope="col">{t('schedulePage.departure')}</th>
                  <th scope="col">{t('schedulePage.arrival')}</th>
                </tr>
              </thead>
              <tbody>
                {direction.stops.map((stop) => {
                  const when = (
                    <>
                      <Weekdays days={stopWeekdays(direction, stop)} />{' '}
                      <strong>{stop.time}</strong>
                    </>
                  );
                  return (
                    <tr key={`${stop.kind}-${stop.cityId}`}>
                      <th scope="row">{cityName(data, stop.cityId)}</th>
                      <td>{stop.placeName}</td>
                      <td>{stop.kind === 'boarding' ? when : '—'}</td>
                      <td>{stop.kind === 'dropOff' ? when : '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ))}
      <p className="muted">{t('schedulePage.note')}</p>
    </>
  );
}
