/** @format */

'use strict';

// Busora demo network: Ukraine ⇄ Czech Republic. Illustrative data for an
// educational project — schedules and fares are invented.
//
// Names are given in every locale (uk_UA, cs_CZ, en_US): city, place and route
// queries join on the requested language, so a missing name hides the row.
// IDs are explicit so the seeded data is the same on every machine.

const LANGUAGE_IDS = { uk_UA: 1, cs_CZ: 2, en_US: 3 };

const CURRENCIES = [
  { id: 1, name: 'Гривня', abbr: 'UAH', symbol: '₴', isBaseCurrency: true },
  { id: 2, name: 'Koruna', abbr: 'CZK', symbol: 'Kč', isBaseCurrency: false }
];

const COUNTRIES = [
  {
    id: 1,
    code: 'UA',
    currencyId: 1,
    names: { uk_UA: 'Україна', cs_CZ: 'Ukrajina', en_US: 'Ukraine' }
  },
  {
    id: 2,
    code: 'CZ',
    currencyId: 2,
    names: { uk_UA: 'Чехія', cs_CZ: 'Česko', en_US: 'Czechia' }
  }
];

// One boarding/drop-off place per city; place id = city id.
const CITIES = [
  // Ukraine
  {
    id: 1,
    countryId: 1,
    names: { uk_UA: 'Київ', cs_CZ: 'Kyjev', en_US: 'Kyiv' },
    place: {
      uk_UA: 'Автостанція «Видубичі»',
      cs_CZ: 'Autobusové nádraží Vydubyči',
      en_US: 'Vydubychi bus station'
    }
  },
  {
    id: 2,
    countryId: 1,
    names: { uk_UA: 'Житомир', cs_CZ: 'Žytomyr', en_US: 'Zhytomyr' },
    place: {
      uk_UA: 'Автовокзал «Житомир»',
      cs_CZ: 'Autobusové nádraží Žytomyr',
      en_US: 'Zhytomyr bus station'
    }
  },
  {
    id: 3,
    countryId: 1,
    names: { uk_UA: 'Рівне', cs_CZ: 'Rivne', en_US: 'Rivne' },
    place: {
      uk_UA: 'Автовокзал «Рівне»',
      cs_CZ: 'Autobusové nádraží Rivne',
      en_US: 'Rivne bus station'
    }
  },
  {
    id: 4,
    countryId: 1,
    names: { uk_UA: 'Львів', cs_CZ: 'Lvov', en_US: 'Lviv' },
    place: {
      uk_UA: 'Автовокзал «Стрийський»',
      cs_CZ: 'Autobusové nádraží Stryjský',
      en_US: 'Stryiskyi bus station'
    }
  },
  {
    id: 5,
    countryId: 1,
    names: { uk_UA: 'Тернопіль', cs_CZ: 'Ternopil', en_US: 'Ternopil' },
    place: {
      uk_UA: 'Автовокзал «Тернопіль»',
      cs_CZ: 'Autobusové nádraží Ternopil',
      en_US: 'Ternopil bus station'
    }
  },
  {
    id: 6,
    countryId: 1,
    names: { uk_UA: 'Мукачево', cs_CZ: 'Mukačevo', en_US: 'Mukachevo' },
    place: {
      uk_UA: 'Автовокзал «Мукачево»',
      cs_CZ: 'Autobusové nádraží Mukačevo',
      en_US: 'Mukachevo bus station'
    }
  },
  {
    id: 7,
    countryId: 1,
    names: { uk_UA: 'Ужгород', cs_CZ: 'Užhorod', en_US: 'Uzhhorod' },
    place: {
      uk_UA: 'Автовокзал «Ужгород»',
      cs_CZ: 'Autobusové nádraží Užhorod',
      en_US: 'Uzhhorod bus station'
    }
  },
  // Czech Republic
  {
    id: 8,
    countryId: 2,
    names: { uk_UA: 'Прага', cs_CZ: 'Praha', en_US: 'Prague' },
    place: {
      uk_UA: 'Автовокзал «Флоренц»',
      cs_CZ: 'ÚAN Florenc',
      en_US: 'Florenc bus station'
    }
  },
  {
    id: 9,
    countryId: 2,
    names: { uk_UA: 'Брно', cs_CZ: 'Brno', en_US: 'Brno' },
    place: {
      uk_UA: 'Автовокзал «Звонаржка»',
      cs_CZ: 'AN Zvonařka',
      en_US: 'Zvonařka bus station'
    }
  },
  {
    id: 10,
    countryId: 2,
    names: { uk_UA: 'Острава', cs_CZ: 'Ostrava', en_US: 'Ostrava' },
    place: {
      uk_UA: 'Центральний автовокзал Острава',
      cs_CZ: 'ÚAN Ostrava',
      en_US: 'Ostrava central bus station'
    }
  },
  {
    id: 11,
    countryId: 2,
    names: { uk_UA: 'Оломоуць', cs_CZ: 'Olomouc', en_US: 'Olomouc' },
    place: {
      uk_UA: 'Автовокзал Оломоуць',
      cs_CZ: 'AN Olomouc',
      en_US: 'Olomouc bus station'
    }
  },
  {
    id: 12,
    countryId: 2,
    names: {
      uk_UA: 'Градець-Кралове',
      cs_CZ: 'Hradec Králové',
      en_US: 'Hradec Králové'
    },
    place: {
      uk_UA: 'Термінал Градець-Кралове',
      cs_CZ: 'Terminál HD Hradec Králové',
      en_US: 'Hradec Králové terminal'
    }
  },
  {
    id: 13,
    countryId: 2,
    names: { uk_UA: 'Пльзень', cs_CZ: 'Plzeň', en_US: 'Pilsen' },
    place: {
      uk_UA: 'Центральний автовокзал Пльзень',
      cs_CZ: 'CAN Plzeň',
      en_US: 'Pilsen central bus station'
    }
  }
];

// Each line runs in both directions. A route only carries passengers from its
// boarding (onboarding) cities to its drop-off (outboarding) cities; times are
// departures at boarding stops and arrivals (next day) at drop-off stops.
// routeKey codes order the cities along each direction for the admin panel.
const LINES = [
  {
    routeGroupId: 1,
    outbound: {
      routeId: 1,
      routeKey: 'KP',
      names: {
        uk_UA: 'Київ - Прага',
        cs_CZ: 'Kyjev - Praha',
        en_US: 'Kyiv - Prague'
      },
      boarding: [
        [1, '07:00'],
        [2, '09:15'],
        [3, '12:00'],
        [4, '15:30']
      ],
      dropOff: [
        [10, '03:30'],
        [11, '05:00'],
        [12, '07:00'],
        [8, '09:00']
      ]
    },
    inbound: {
      routeId: 2,
      routeKey: 'PK',
      names: {
        uk_UA: 'Прага - Київ',
        cs_CZ: 'Praha - Kyjev',
        en_US: 'Prague - Kyiv'
      },
      boarding: [
        [8, '17:00'],
        [12, '19:00'],
        [11, '21:00'],
        [10, '22:30']
      ],
      dropOff: [
        [4, '11:30'],
        [3, '15:00'],
        [2, '17:45'],
        [1, '20:00']
      ]
    }
  },
  {
    routeGroupId: 2,
    outbound: {
      routeId: 3,
      routeKey: 'TP',
      names: {
        uk_UA: 'Тернопіль - Пльзень',
        cs_CZ: 'Ternopil - Plzeň',
        en_US: 'Ternopil - Pilsen'
      },
      boarding: [
        [5, '08:00'],
        [6, '14:30'],
        [7, '16:00']
      ],
      dropOff: [
        [9, '06:00'],
        [8, '09:30'],
        [13, '11:30']
      ]
    },
    inbound: {
      routeId: 4,
      routeKey: 'PT',
      names: {
        uk_UA: 'Пльзень - Тернопіль',
        cs_CZ: 'Plzeň - Ternopil',
        en_US: 'Pilsen - Ternopil'
      },
      boarding: [
        [13, '15:00'],
        [8, '17:00'],
        [9, '20:00']
      ],
      dropOff: [
        [7, '09:30'],
        [6, '11:00'],
        [5, '17:30']
      ]
    }
  }
];

// One-way fares in UAH: base fare of the Ukrainian city + surcharge of the
// Czech city on the same line. CZK fares are fixed list prices (not converted
// live); a round trip costs 1.8× a one-way fare.
const UA_BASE_FARE_UAH = { 1: 2900, 2: 2800, 3: 2600, 4: 2200, 5: 2700, 6: 2100, 7: 2000 };
const CZ_SURCHARGE_UAH = {
  1: { 10: 0, 11: 150, 12: 300, 8: 400 },
  2: { 9: 0, 8: 300, 13: 500 }
};
const UAH_PER_CZK_LIST_RATE = 2.08;
const ROUND_TRIP_FACTOR = 1.8;
const FARE_ROUNDING = 10;

// Passenger discounts (personal), shown in the passenger form. Ages follow the
// validation rules: maxAge N = born within N years before departure, minAge N
// = at least N years old. inactivePeriod "MM-DD|MM-DD" disables a discount.
const PASSENGER_DISCOUNTS = [
  {
    id: 1, coef: 0.5, group: 'children', maxAge: 1, order: 100,
    names: {
      uk_UA: 'Дітям до 1 року - 50 %.',
      cs_CZ: 'Děti do 1 roku - 50 %.',
      en_US: 'Children under 1 year - 50%.'
    }
  },
  {
    id: 2, coef: 0.3, group: 'children', maxAge: 4, order: 101,
    names: {
      uk_UA: 'Дітям від 1 до 4 років - 30 %.',
      cs_CZ: 'Děti od 1 do 4 let - 30 %.',
      en_US: 'Children aged 1 to 4 - 30%.'
    }
  },
  {
    id: 3, coef: 0.2, group: 'children', maxAge: 11, order: 102,
    names: {
      uk_UA: 'Дітям від 5 до 11 років - 20 %.',
      cs_CZ: 'Děti od 5 do 11 let - 20 %.',
      en_US: 'Children aged 5 to 11 - 20%.'
    }
  },
  {
    id: 4, coef: 0.1, group: 'children', maxAge: 15, order: 103,
    names: {
      uk_UA: 'Дітям від 12 до 15 років - 10 %.',
      cs_CZ: 'Děti od 12 do 15 let - 10 %.',
      en_US: 'Children aged 12 to 15 - 10%.'
    }
  },
  {
    id: 5, coef: 0.1, group: 'adults', inactivePeriod: '06-15|08-15', order: 104,
    names: {
      uk_UA: 'Студентам (за наявності посвідчення) - 10 %. Не діє з 15 червня по 15 серпня.',
      cs_CZ: 'Studenti (s průkazem) - 10 %. Neplatí od 15. června do 15. srpna.',
      en_US: 'Students (with ID) - 10%. Not valid from 15 June to 15 August.'
    }
  },
  {
    id: 6, coef: 0.1, group: 'adults', minAge: 60, order: 105,
    names: {
      uk_UA: 'Пенсіонерам від 60 років - 10 %.',
      cs_CZ: 'Senioři od 60 let - 10 %.',
      en_US: 'Seniors aged 60+ - 10%.'
    }
  },
  {
    id: 7, coef: 0.1, group: 'adults', order: 106,
    names: {
      uk_UA: 'Особам з інвалідністю I і II групи (за наявності посвідчення) - 10 %.',
      cs_CZ: 'Osoby se zdravotním postižením (s průkazem ZTP/ZTP-P) - 10 %.',
      en_US: 'Persons with disabilities (with ID) - 10%.'
    }
  },
  {
    id: 8, coef: 0.1, group: 'adults', order: 107,
    names: {
      uk_UA: 'Військовим (за наявності посвідчення) - 10 %.',
      cs_CZ: 'Vojáci (s průkazem) - 10 %.',
      en_US: 'Military personnel (with ID) - 10%.'
    }
  },
  {
    id: 9, coef: 0.1, group: 'both', order: 108,
    names: {
      uk_UA: 'Групам від 10 осіб - 10 %.',
      cs_CZ: 'Skupiny od 10 osob - 10 %.',
      en_US: 'Groups of 10 or more - 10%.'
    }
  },
  {
    id: 10, coef: 0.1, group: 'discount-card', order: 109,
    names: {
      uk_UA: 'Картка постійного клієнта - 10 %.',
      cs_CZ: 'Věrnostní karta - 10 %.',
      en_US: 'Loyalty card - 10%.'
    }
  },
  {
    id: 11, coef: 0.15, group: 'discount-card', order: 110,
    names: {
      uk_UA: 'Картка постійного клієнта Gold - 15 %.',
      cs_CZ: 'Věrnostní karta Gold - 15 %.',
      en_US: 'Gold loyalty card - 15%.'
    }
  }
];

// Promotional (bus-flight) discount applied to some scheduled flights.
const PROMO_DISCOUNT = {
  coef: 0.15,
  order: 500,
  // 0 = Sunday … 6 = Saturday (UTC): Wednesday departures of line 2
  weekday: 3,
  routeIds: [3, 4],
  names: {
    uk_UA: 'Знижка на рейс - 15 %.',
    cs_CZ: 'Sleva na spoj - 15 %.',
    en_US: 'Trip discount - 15%.'
  }
};

const AGENTS = [
  {
    id: 1,
    names: { uk_UA: 'Офіс Київ', cs_CZ: 'Kancelář Kyjev', en_US: 'Kyiv office' }
  },
  {
    id: 2,
    names: { uk_UA: 'Офіс Прага', cs_CZ: 'Kancelář Praha', en_US: 'Prague office' }
  }
];

// Daily departures on every route for this many days from the seeding date.
const SCHEDULE_DAYS = 90;
const SEATS_PER_BUS = 50;

module.exports = {
  LANGUAGE_IDS,
  CURRENCIES,
  COUNTRIES,
  CITIES,
  LINES,
  UA_BASE_FARE_UAH,
  CZ_SURCHARGE_UAH,
  UAH_PER_CZK_LIST_RATE,
  ROUND_TRIP_FACTOR,
  FARE_ROUNDING,
  PASSENGER_DISCOUNTS,
  PROMO_DISCOUNT,
  AGENTS,
  SCHEDULE_DAYS,
  SEATS_PER_BUS
};
