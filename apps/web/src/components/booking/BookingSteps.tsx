import { useTranslations } from 'next-intl';

const STEPS = ['search', 'passengers', 'review', 'payment', 'done'] as const;
export type BookingStep = (typeof STEPS)[number];

export function BookingSteps({ current }: { current: BookingStep }) {
  const t = useTranslations('steps');
  return (
    <nav aria-label={t('label')} className="steps">
      <ol>
        {STEPS.map((step, index) => (
          <li key={step} aria-current={step === current ? 'step' : undefined}>
            {index + 1}. {t(step)}
          </li>
        ))}
      </ol>
    </nav>
  );
}
