// Phone numbers passengers may have: Ukrainian and Czech mobiles. Mirrors
// PHONE_PATTERN in the API's config/market.js (used by the booking site).
export const PHONE_COUNTRIES = [
  { code: 'UA', calling: '+380', flag: '🇺🇦' },
  { code: 'CZ', calling: '+420', flag: '🇨🇿' }
] as const;

export type CallingCode = typeof PHONE_COUNTRIES[number]['calling'];

export const PHONE_PATTERN = /^\+380([5-9][0-9]\d{7})$|^\+420([67]\d{8})$/;

// A supported calling code at the start of a value / as the whole value
export const CALLING_CODE_PREFIX = /^\+(380|420)/;
export const CALLING_CODE_ONLY = /^\+(380|420)$/;

// The country of a stored number, by its calling code; Ukraine by default.
export const countryOfPhone = (phone?: string | null) =>
  PHONE_COUNTRIES.find((c) => phone?.startsWith(c.calling)) ??
  PHONE_COUNTRIES[0];
