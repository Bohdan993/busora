import { Check } from 'lucide-react';
import { useTranslations } from 'next-intl';
import styles from './booking.module.css';

const STEPS = ['search', 'passengers', 'review', 'payment', 'done'] as const;
export type BookingStep = (typeof STEPS)[number];

export function BookingSteps({ current }: { current: BookingStep }) {
  const t = useTranslations('steps');
  const currentIndex = STEPS.indexOf(current);
  return (
    <nav aria-label={t('label')} className={styles.steps}>
      <ol>
        {STEPS.map((step, index) => {
          const done = index < currentIndex;
          const state = done
            ? 'done'
            : index === currentIndex
              ? 'current'
              : 'todo';
          return (
            <li
              key={step}
              data-state={state}
              aria-current={step === current ? 'step' : undefined}
            >
              <span className={styles.mark} aria-hidden="true">
                {done ? <Check size={14} strokeWidth={3} /> : index + 1}
              </span>
              <span className={styles.label}>
                {t(step)}
                {done && (
                  <span className="visually-hidden"> ({t('completed')})</span>
                )}
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
