import {
  AirVent,
  Armchair,
  CreditCard,
  Footprints,
  LampDesk,
  Luggage,
  MonitorPlay,
  PlugZap,
  Toilet,
  Wifi,
  type LucideIcon
} from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { AMENITIES, type Amenity } from '@/content/fleet';
import styles from './home.module.css';

const ICONS: Record<Amenity, LucideIcon> = {
  wifi: Wifi,
  screens: MonitorPlay,
  sockets: PlugZap,
  climate: AirVent,
  lighting: LampDesk,
  seats: Armchair,
  footrest: Footprints,
  luggage: Luggage,
  toilet: Toilet,
  payment: CreditCard
};

export async function Advantages() {
  const t = await getTranslations('home.advantages');

  return (
    <section className="section" aria-labelledby="advantages-title">
      <div className="section-head">
        <h2 id="advantages-title">{t('title')}</h2>
      </div>
      <ul className={styles.tiles}>
        {AMENITIES.map((amenity) => {
          const Icon = ICONS[amenity];
          return (
            <li key={amenity} className={styles.tile}>
              <span className={styles.icon}>
                <Icon size={22} strokeWidth={1.75} aria-hidden="true" />
              </span>
              {t(`items.${amenity}`)}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
