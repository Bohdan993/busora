import { getTranslations } from 'next-intl/server';
import { AMENITIES } from '@/content/fleet';

export async function Advantages() {
  const t = await getTranslations('home.advantages');

  return (
    <section className="section" aria-labelledby="advantages-title">
      <h2 id="advantages-title">{t('title')}</h2>
      <ul className="grid">
        {AMENITIES.map((amenity) => (
          <li key={amenity} className="card">
            {t(`items.${amenity}`)}
          </li>
        ))}
      </ul>
    </section>
  );
}
