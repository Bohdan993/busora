/** @format */

/**
 * Market configuration: the country-specific rules of the Ukraine ⇄ Czech
 * Republic network. Code reads these values instead of hard-coding countries,
 * currencies or phone formats.
 */

// Money is stored in UAH (priceUAH columns); other currencies convert to it.
const HOME_CURRENCY = 'UAH';

// Countries whose phone numbers passengers may enter: international prefix
// followed by a mobile number (operator code + subscriber digits).
const COUNTRIES = {
  UA: { phonePrefix: '+380', mobileNumberPattern: '[5-9][0-9]\\d{7}' },
  CZ: { phonePrefix: '+420', mobileNumberPattern: '[67]\\d{8}' }
};

const PHONE_PATTERN = new RegExp(
  Object.values(COUNTRIES)
    .map(
      ({ phonePrefix, mobileNumberPattern }) =>
        `^\\${phonePrefix}(${mobileNumberPattern})$`
    )
    .join('|')
);

// Site locales (folders in languages/, rows in the languages table).
// uk_UA is the default and must keep languageId 1 — code falls back to it.
const LOCALES = ['uk_UA', 'cs_CZ', 'en_US'];
const DEFAULT_LOCALE = 'uk_UA';

function isSupportedLocale(code) {
  return LOCALES.includes(code);
}

// Payment page language per site locale (LiqPay supports uk and en).
const PAYMENT_LANGUAGES = {
  uk_UA: 'uk',
  cs_CZ: 'en',
  en_US: 'en'
};
const DEFAULT_PAYMENT_LANGUAGE = 'en';

function getPaymentLanguage(languageCode) {
  return PAYMENT_LANGUAGES[languageCode] || DEFAULT_PAYMENT_LANGUAGE;
}

module.exports = {
  HOME_CURRENCY,
  COUNTRIES,
  PHONE_PATTERN,
  LOCALES,
  DEFAULT_LOCALE,
  isSupportedLocale,
  getPaymentLanguage
};
