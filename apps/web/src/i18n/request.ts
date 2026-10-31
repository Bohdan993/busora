import { hasLocale } from 'next-intl';
import { getRequestConfig } from 'next-intl/server';
import { routing } from './routing';

export default getRequestConfig(async ({ requestLocale }) => {
  // Corresponds to the [locale] segment
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested)
    ? requested
    : routing.defaultLocale;

  return {
    locale,
    // Kyiv and Prague differ by an hour; dates in the UI are calendar dates,
    // so one fixed zone keeps server and browser rendering identical.
    timeZone: 'Europe/Kyiv',
    messages: (await import(`../../messages/${locale}.json`)).default
  };
});
