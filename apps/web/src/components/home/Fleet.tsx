import Image from 'next/image';
import { getTranslations } from 'next-intl/server';
import { FLEET } from '@/content/fleet';
import styles from './home.module.css';

export async function Fleet() {
  const t = await getTranslations('home');

  return (
    <section className="section" aria-labelledby="fleet-title">
      <div className="section-head">
        <h2 id="fleet-title">{t('fleet.title')}</h2>
        <p className="muted">{t('fleet.note')}</p>
      </div>
      <ul className="grid">
        {FLEET.map((coach) => (
          <li key={coach.image} className={styles.mediaCard}>
            <div className={styles.media}>
              <Image
                src={coach.image}
                alt={coach.model}
                width={640}
                height={427}
                sizes="(max-width: 640px) 100vw, 320px"
              />
            </div>
            <div className={styles.body}>
              <h3>{coach.model}</h3>
              <dl className={styles.specs}>
                <dt>{t('fleet.year')}</dt>
                <dd>{coach.year}</dd>
                <dt>{t('fleet.emission')}</dt>
                <dd>{coach.emission}</dd>
                <dt>{t('fleet.seats')}</dt>
                <dd>{coach.seats}</dd>
                <dt>{t('fleet.class')}</dt>
                <dd aria-label={`${coach.stars}/5`} className={styles.stars}>
                  {'★'.repeat(coach.stars)}
                </dd>
              </dl>
              <ul className="chips">
                {coach.amenities.map((amenity) => (
                  <li key={amenity} className="badge">
                    {t(`advantages.items.${amenity}`)}
                  </li>
                ))}
              </ul>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
