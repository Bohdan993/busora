// Fictional contact details, the same ones printed on the PDF tickets
// (apps/api/languages/*/_ticket.js). Translatable parts are in messages/*.json.

export const PHONES_UA = ['+380 00 000 00 00', '+380 00 000 00 01'];
export const PHONES_CZ = ['+420 000 000 000', '+420 000 000 001'];

export const OFFICE = {
  timeZone: 'Europe/Kyiv',
  // Monday–Friday, 9:00–18:00 local time
  openDays: [1, 2, 3, 4, 5],
  opensAt: 9,
  closesAt: 18
};

export const tel = (phone: string) => `tel:${phone.replace(/\s/g, '')}`;
