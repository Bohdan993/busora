'use client';

import { useQuery } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { API_LANGUAGE } from '@/i18n/routing';
import { getAvailableDates, getDiscounts, getNetwork } from './booking';
import { ApiError } from './client';

/** The API language code for the page's locale. */
export function useApiLanguage() {
  return API_LANGUAGE[useLocale()];
}

export function useNetwork() {
  const languageCode = useApiLanguage();
  return useQuery({
    queryKey: ['network', languageCode],
    queryFn: () => getNetwork(languageCode)
  });
}

export function useDiscounts() {
  const languageCode = useApiLanguage();
  return useQuery({
    queryKey: ['discounts', languageCode],
    queryFn: () => getDiscounts(languageCode)
  });
}

/** Bookable departure dates for a pair (`backwards`: the return leg). */
export function useAvailableDates(
  originId: number | undefined,
  destinationId: number | undefined,
  direction: 'forwards' | 'backwards'
) {
  return useQuery({
    queryKey: ['available-dates', originId, destinationId, direction],
    queryFn: () =>
      getAvailableDates({
        originId: originId!,
        destinationId: destinationId!,
        direction
      }),
    enabled: Boolean(originId && destinationId),
    // Seats sell out; keep this fresher than the network
    staleTime: 60 * 1000
  });
}

/** Turns any error into a localised sentence via the API error code. */
export function useErrorMessage() {
  const t = useTranslations('errors');
  return (error: unknown) =>
    t(error instanceof ApiError ? error.code : 'SERVER_ERROR');
}
