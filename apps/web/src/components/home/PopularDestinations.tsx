'use client';

import Image from 'next/image';
import { useLocale, useTranslations } from 'next-intl';
import { POPULAR_PAIRS } from '@/content/popular';
import { Link } from '@/i18n/navigation';
import { useErrorMessage, useNetwork } from '@/lib/api/hooks';
import { formatMoney } from '@/lib/format';
import { useDurationText } from '@/lib/useDurationText';
import {
  cityName,
  currencyOf,
  findDirection,
  findFare,
  tripMinutes
} from '@/lib/network';

export function PopularDestinations() {
  const t = useTranslations();
  const locale = useLocale();
  const errorMessage = useErrorMessage();
  const network = useNetwork();
  const durationText = useDurationText();

  return (
    <section className="section" aria-labelledby="popular-title">
      <h2 id="popular-title">{t('home.popular.title')}</h2>
      {network.isPending && <p>{t('common.loading')}</p>}
      {network.isError && (
        <p role="alert" className="error">
          {errorMessage(network.error)}
        </p>
      )}
      {network.isSuccess && (
        <ul className="grid">
          {POPULAR_PAIRS.map(({ fromCityId, toCityId, image }) => {
            const data = network.data;
            const direction = findDirection(data, fromCityId, toCityId);
            const currency = currencyOf(data, fromCityId)?.abbr;
            const fare =
              currency && findFare(data, fromCityId, toCityId, currency);
            if (!direction || !fare || !currency) return null;
            const minutes = tripMinutes(direction, fromCityId, toCityId) ?? 0;
            const country = data.cities.find((c) => c.id === toCityId)?.country
              .name;
            const pair = `from=${fromCityId}&to=${toCityId}`;
            return (
              <li key={pair} className="card">
                <Image
                  src={image}
                  alt=""
                  width={640}
                  height={427}
                  sizes="(max-width: 640px) 100vw, 320px"
                />
                <h3>
                  {cityName(data, fromCityId)} → {cityName(data, toCityId)}
                </h3>
                <p className="muted">
                  {country} · {durationText(minutes)}
                </p>
                <p>
                  <strong>
                    {t('common.priceFrom', {
                      price: formatMoney(fare.oneWay, currency, locale)
                    })}
                  </strong>
                </p>
                <p>
                  <Link href={`/routes?${pair}`}>{t('home.popular.more')}</Link>
                  {' · '}
                  <Link href={`/?${pair}#search`}>
                    {t('home.popular.book')}
                  </Link>
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
