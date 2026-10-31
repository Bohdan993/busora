import { defineRouting } from 'next-intl/routing';

export const routing = defineRouting({
  locales: ['uk', 'cs', 'en'],
  defaultLocale: 'uk'
});

export type Locale = (typeof routing.locales)[number];

/** The API's language codes (the `languageCode` query parameter). */
export const API_LANGUAGE = {
  uk: 'uk_UA',
  cs: 'cs_CZ',
  en: 'en_US'
} as const satisfies Record<Locale, string>;
