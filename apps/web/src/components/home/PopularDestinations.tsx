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
import styles from './home.module.css';

export function PopularDestinations() {
  const t = useTranslations();
  const locale = useLocale();
  const errorMessage = useErrorMessage();
  const network = useNetwork();
  const durationText = useDurationText();

  return (
    <section className="section" aria-labelledby="popular-title">
      <div className="section-head">
        <h2 id="popular-title">{t('home.popular.title')}</h2>
      </div>
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
              <li key={pair} className={styles.mediaCard}>
                <div className={styles.media}>
                  <Image
                    src={image}
                    alt=""
                    width={640}
                    height={427}
                    sizes="(max-width: 640px) 100vw, 320px"
                  />
                </div>
                <div className={styles.body}>
                  <h3>
                    {cityName(data, fromCityId)} → {cityName(data, toCityId)}
                  </h3>
                  <p className="muted">
                    {country} · {durationText(minutes)}
                  </p>
                  <p>
                    <Link href={`/routes?${pair}`}>
                      {t('home.popular.more')}
                    </Link>
                  </p>
                  <div className={styles.footer}>
                    <span className={styles.price}>
                      {t('common.priceFrom', {
                        price: formatMoney(fare.oneWay, currency, locale)
                      })}
                    </span>
                    <Link
                      href={`/?${pair}#search`}
                      className="button button-small"
                    >
                      {t('home.popular.book')}
                    </Link>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
