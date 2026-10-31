import { describe, expect, it } from 'vitest';
import type { PassengerForm } from '@/lib/api/booking';
import {
  discountGroupsFor,
  emptyPassengers,
  fromPassengersInfo,
  locateFieldError,
  toPassengersData
} from './passengers';

const groups: PassengerForm['discounts'] = [
  {
    group: 'children',
    items: [{ id: 3, name: 'Child', coef: 0.2, minAge: null, maxAge: 11 }]
  },
  {
    group: 'adults',
    items: [{ id: 6, name: 'Senior', coef: 0.1, minAge: 60, maxAge: null }]
  },
  {
    group: 'both',
    items: [{ id: 9, name: 'Group', coef: 0.1, minAge: null, maxAge: null }]
  },
  {
    group: 'discount-card',
    items: [{ id: 10, name: 'Card', coef: 0.1, minAge: null, maxAge: null }]
  }
];

describe('passenger payload', () => {
  it('numbers adults then children and keeps per-kind fields', () => {
    const [adult, child] = emptyPassengers(1, 1);
    const data = toPassengersData(
      [
        {
          ...adult,
          name: ' Jana ',
          lastName: 'Novakova',
          phone: '+420601123456',
          email: 'jana@example.test',
          dateOfBirth: '1985-03-20',
          discountId: '10',
          cardNumber: 'C-1'
        },
        {
          ...child,
          name: 'Eva',
          lastName: 'Novakova',
          phone: 'ignored',
          dateOfBirth: '2019-05-05',
          discountId: '3'
        }
      ],
      groups
    );
    expect(data).toEqual({
      'adult-passenger-1': {
        'name-1': 'Jana',
        'last-name-1': 'Novakova',
        'date-of-birth-1': '1985-03-20',
        'phone-1': '+420601123456',
        'email-1': 'jana@example.test',
        'discount-1': '10',
        'card-discount-1': 'C-1'
      },
      'child-passenger-2': {
        'name-2': 'Eva',
        'last-name-2': 'Novakova',
        'date-of-birth-2': '2019-05-05',
        'discount-2': '3'
      }
    });
  });

  it('leaves out an empty extra phone and "no discount"', () => {
    const [adult] = emptyPassengers(1, 0);
    const data = toPassengersData([{ ...adult, name: 'Jana' }], groups);
    expect(Object.keys(data['adult-passenger-1'])).toEqual([
      'name-1',
      'last-name-1',
      'date-of-birth-1',
      'phone-1',
      'email-1'
    ]);
  });

  it('prefills the form from what the session stored', () => {
    const [adult, child] = emptyPassengers(1, 1);
    const passengers = [
      {
        ...adult,
        name: 'Jana',
        lastName: 'Novakova',
        phone: '+420601123456',
        email: 'jana@example.test',
        dateOfBirth: '1985-03-20'
      },
      {
        ...child,
        name: 'Eva',
        lastName: 'Novakova',
        dateOfBirth: '2019-05-05',
        discountId: '3'
      }
    ];
    const stored = toPassengersData(passengers, groups);
    // The session adds computed prices, which the form ignores
    stored['child-passenger-2']['discount-ticket-price-2'] = 1272;
    expect(fromPassengersInfo(stored)).toEqual(passengers);
  });
});

describe('discounts by passenger kind', () => {
  it('offers children no loyalty cards and adults no child discounts', () => {
    expect(discountGroupsFor('child', groups).map((g) => g.group)).toEqual([
      'children',
      'both'
    ]);
    expect(discountGroupsFor('adult', groups).map((g) => g.group)).toEqual([
      'adults',
      'both',
      'discount-card'
    ]);
  });
});

describe('locateFieldError', () => {
  it('maps API field keys to form fields', () => {
    expect(locateFieldError('phone-2')).toEqual({ index: 1, field: 'phone' });
    expect(locateFieldError('last-name-1')).toEqual({
      index: 0,
      field: 'lastName'
    });
    expect(locateFieldError('phone-additional-3')).toEqual({
      index: 2,
      field: 'additionalPhone'
    });
    expect(locateFieldError('card-discount-1')).toEqual({
      index: 0,
      field: 'cardNumber'
    });
    expect(locateFieldError('unknown')).toBeNull();
  });
});
