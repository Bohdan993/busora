'use client';

import { useTranslations } from 'next-intl';
import type { Network } from '@/lib/network';

/** Picks one line of the network (by its outbound direction's name). */
export function LinePicker({
  network,
  value,
  onChange
}: {
  network: Network;
  value: number;
  onChange: (lineId: number) => void;
}) {
  const t = useTranslations();
  return (
    <label>
      {t('schedulePage.line')}
      <br />
      <select value={value} onChange={(e) => onChange(Number(e.target.value))}>
        {network.lines.map((line, index) => (
          <option key={line.id} value={line.id}>
            {t('schedulePage.lineName', {
              n: index + 1,
              name: line.directions[0]?.name ?? ''
            })}
          </option>
        ))}
      </select>
    </label>
  );
}
