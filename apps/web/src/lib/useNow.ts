'use client';

import { useCallback, useSyncExternalStore } from 'react';

/**
 * The current time (ms), rounded down to `stepMs` and updated every step.
 * null while prerendering and hydrating: the time must not be baked into
 * static HTML.
 */
export function useNow(stepMs: number): number | null {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const timer = window.setInterval(onChange, Math.min(stepMs, 1000));
      return () => window.clearInterval(timer);
    },
    [stepMs]
  );
  return useSyncExternalStore(
    subscribe,
    () => Math.floor(Date.now() / stepMs) * stepMs,
    () => null
  );
}
