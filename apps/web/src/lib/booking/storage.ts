import { useMemo, useSyncExternalStore } from 'react';
import type {
  BusFlight,
  Checkout,
  MockCompletion,
  SearchQuery
} from '@/lib/api/booking';

/**
 * What the browser remembers about the booking in progress, per tab. The
 * booking itself lives in the API session (cookie); this only keeps what the
 * pages need to show and to carry between steps.
 */
interface BookingState {
  search: SearchQuery;
  /** When the API session cookie expires (ms since epoch) */
  expiresAt: number;
  /** The selected offer, for showing the trip on later steps */
  offer: BusFlight;
  checkout: Checkout;
  payment: MockCompletion;
}

const PREFIX = 'busora.booking.';

function readRaw(key: keyof BookingState): string | null {
  try {
    return window.sessionStorage.getItem(PREFIX + key);
  } catch {
    // Storage blocked: behave as if nothing was saved
    return null;
  }
}

function parse<T>(raw: string | null): T | null {
  try {
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    // Corrupted entry: behave as if nothing was saved
    return null;
  }
}

export function readBooking<K extends keyof BookingState>(
  key: K
): BookingState[K] | null {
  return parse(readRaw(key));
}

// Steps write before navigating, so a value never changes under a mounted page
const subscribeNever = () => () => {};

/**
 * A saved booking value for rendering: undefined while prerendering and
 * hydrating (storage is browser-only), then the value or null.
 */
export function useBooking<K extends keyof BookingState>(
  key: K
): BookingState[K] | null | undefined {
  // The raw string is the snapshot: stable between reads, unlike parsed objects
  const raw = useSyncExternalStore(
    subscribeNever,
    () => readRaw(key),
    () => undefined
  );
  return useMemo(
    () => (raw === undefined ? undefined : parse<BookingState[K]>(raw)),
    [raw]
  );
}

export function writeBooking<K extends keyof BookingState>(
  key: K,
  value: BookingState[K]
) {
  try {
    window.sessionStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    // Storage unavailable: later steps fall back to the API session
  }
}

export function clearBooking(...keys: (keyof BookingState)[]) {
  try {
    for (const key of keys) window.sessionStorage.removeItem(PREFIX + key);
  } catch {
    // Nothing to clear when storage is unavailable
  }
}

/** Remembers when the session cookie set by a search will expire. */
export function startSessionClock(sessionExpiresTime: number) {
  writeBooking('expiresAt', Date.now() + sessionExpiresTime);
}
