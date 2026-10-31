import type { PassengerForm, PassengersInfo } from '@/lib/api/booking';

export type PassengerKind = 'adult' | 'child';

/** One passenger as the form edits it. */
export interface PassengerFields {
  kind: PassengerKind;
  name: string;
  lastName: string;
  phone: string;
  additionalPhone: string;
  email: string;
  dateOfBirth: string;
  discountId: string;
  cardNumber: string;
}

export const NO_DISCOUNT = '0';

// Which discount groups each kind of passenger may choose from (mirrors the
// API's validation in passengerService.createValidateConstraints)
const GROUPS_FOR: Record<PassengerKind, string[]> = {
  adult: ['adults', 'both', 'discount-card'],
  child: ['children', 'both']
};

export function discountGroupsFor(
  kind: PassengerKind,
  groups: PassengerForm['discounts']
) {
  return groups.filter((group) => GROUPS_FOR[kind].includes(group.group));
}

export function isCardDiscount(
  discountId: string,
  groups: PassengerForm['discounts']
) {
  return groups.some(
    (group) =>
      group.group === 'discount-card' &&
      group.items.some((item) => String(item.id) === discountId)
  );
}

export function discountCoef(
  discountId: string,
  groups: PassengerForm['discounts']
) {
  for (const group of groups) {
    const item = group.items.find((i) => String(i.id) === discountId);
    if (item) return item.coef;
  }
  return 0;
}

/** Adults first, then children — the order the API numbers them in. */
export function emptyPassengers(adults: number, children: number) {
  const blank = (kind: PassengerKind): PassengerFields => ({
    kind,
    name: '',
    lastName: '',
    phone: '',
    additionalPhone: '',
    email: '',
    dateOfBirth: '',
    discountId: NO_DISCOUNT,
    cardNumber: ''
  });
  return [
    ...Array.from({ length: adults }, () => blank('adult')),
    ...Array.from({ length: children }, () => blank('child'))
  ];
}

/**
 * The API's passenger payload: one `<kind>-passenger-<n>` entry per passenger
 * with `<field>-<n>` keys, n counting from 1 across adults and children.
 */
export function toPassengersData(
  passengers: PassengerFields[],
  groups: PassengerForm['discounts']
): PassengersInfo {
  return Object.fromEntries(
    passengers.map((p, index) => {
      const n = index + 1;
      const fields: Record<string, string> = {
        [`name-${n}`]: p.name.trim(),
        [`last-name-${n}`]: p.lastName.trim(),
        [`date-of-birth-${n}`]: p.dateOfBirth
      };
      if (p.kind === 'adult') fields[`phone-${n}`] = p.phone.trim();
      if (p.kind === 'adult' && p.additionalPhone.trim()) {
        fields[`phone-additional-${n}`] = p.additionalPhone.trim();
      }
      if (n === 1) fields[`email-${n}`] = p.email.trim();
      if (p.discountId !== NO_DISCOUNT) {
        fields[`discount-${n}`] = p.discountId;
        if (isCardDiscount(p.discountId, groups)) {
          fields[`card-discount-${n}`] = p.cardNumber.trim();
        }
      }
      return [`${p.kind}-passenger-${n}`, fields];
    })
  );
}

/** Back from the session's passengersInfo, to prefill the form. */
export function fromPassengersInfo(info: PassengersInfo): PassengerFields[] {
  return Object.entries(info).map(([key, fields]) => {
    const n = key.replace(/\D+/g, '');
    const get = (field: string) => String(fields[`${field}-${n}`] ?? '');
    return {
      kind: key.startsWith('child') ? 'child' : 'adult',
      name: get('name'),
      lastName: get('last-name'),
      phone: get('phone'),
      additionalPhone: get('phone-additional'),
      email: get('email'),
      dateOfBirth: get('date-of-birth').slice(0, 10),
      discountId: get('discount') || NO_DISCOUNT,
      cardNumber: get('card-discount')
    };
  });
}

/**
 * Where a server field error belongs: "phone-2" → passenger index 1, field
 * "phone". Unknown keys return null.
 */
const FIELD_OF: Record<string, keyof PassengerFields> = {
  name: 'name',
  'last-name': 'lastName',
  phone: 'phone',
  'phone-additional': 'additionalPhone',
  email: 'email',
  'date-of-birth': 'dateOfBirth',
  discount: 'discountId',
  'card-discount': 'cardNumber'
};

export function locateFieldError(key: string) {
  const match = /^([a-z-]+)-(\d+)$/.exec(key);
  const field = match && FIELD_OF[match[1]];
  return field ? { index: Number(match[2]) - 1, field } : null;
}
