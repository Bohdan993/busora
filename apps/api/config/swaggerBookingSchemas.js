/** @format */

/**
 * OpenAPI component schemas of the public booking flow — the contract the web
 * app is typed against (see `npm run openapi`). Shapes follow the real JSON
 * responses; keep them in step with the routes in api/routes/*.js.
 */

const APIError = require('@exeptions/api-error');
const constants = require('@helpers/constants');
const { LOCALES } = require('@root/config/market');

const ref = (name) => ({ $ref: `#/components/schemas/${name}` });
const nullable = (schema) => ({ ...schema, nullable: true });

const LocalizedName = {
  type: 'object',
  required: ['name'],
  properties: {
    name: { type: 'string', example: 'Praha' },
    languageId: { type: 'integer', example: 2 }
  }
};

const FlightCity = {
  type: 'object',
  required: ['id', 'name'],
  properties: {
    id: { type: 'integer', example: 8 },
    name: { type: 'string', example: 'Prague' },
    nameUkr: { type: 'string', example: 'Прага' }
  }
};

const FlightLeg = {
  type: 'object',
  description:
    'Route and stops of one direction. Empty object for the return leg of a one-way or open-date trip.',
  properties: {
    routeId: { type: 'integer', example: 1 },
    routeName: { type: 'string', example: 'Kyiv - Prague' },
    routeNameUkr: { type: 'string' },
    onBoardingPlace: { type: 'string', example: 'Kyiv Central Bus Station' },
    onBoardingPlaceUkr: { type: 'string' },
    outBoardingPlace: { type: 'string', example: 'Praha Florenc' },
    outBoardingPlaceUkr: { type: 'string' },
    onBoardingTime: { type: 'string', example: '18:00' },
    outBoardingTime: { type: 'string', example: '14:30' }
  }
};

const BusFlight = {
  type: 'object',
  required: [
    'id',
    'type',
    'busFlightFromId',
    'cities',
    'places',
    'dates',
    'price',
    'purePrice'
  ],
  properties: {
    id: {
      type: 'string',
      description:
        'Id of this offer within the current session — pass it to `POST /api/bus-flights/select`.',
      example: 'main-ticket-0-0-0'
    },
    type: {
      type: 'string',
      enum: [constants.ONE_WAY, constants.ROUND, constants.OPEN_DATE]
    },
    busFlightFromId: { type: 'integer', example: 17 },
    busFlightToId: nullable({ type: 'integer', example: 46 }),
    cities: {
      type: 'object',
      required: ['from', 'to'],
      properties: { from: FlightCity, to: FlightCity }
    },
    places: {
      type: 'object',
      required: ['from', 'to'],
      properties: { from: FlightLeg, to: FlightLeg }
    },
    dates: {
      type: 'object',
      required: ['departure', 'departurePure'],
      properties: {
        departure: {
          type: 'string',
          description: 'Display date in the requested language',
          example: '07 Nov. 2026'
        },
        departureUkr: { type: 'string' },
        departurePure: { type: 'string', format: 'date' },
        return: nullable({ type: 'string', example: '14 Nov. 2026' }),
        returnUkr: nullable({ type: 'string' }),
        returnPure: nullable({
          type: 'string',
          description: 'ISO date, or `one-way` / `open-date`',
          example: '2026-11-14'
        })
      }
    },
    discountPercentage: {
      type: 'number',
      description: 'Promo discount on this flight, 0 when none',
      example: 0
    },
    purePriceFull: {
      type: 'string',
      description: 'Price per passenger before the promo, digits only',
      example: '2250'
    },
    purePrice: {
      type: 'string',
      description: 'Price per passenger in the search currency, digits only',
      example: '2250'
    },
    priceFull: { type: 'string', example: '2250 Kč' },
    price: { type: 'string', example: '2250 Kč' },
    hasDiscount: { type: 'boolean' },
    isSelected: { type: 'boolean' }
  }
};

const Discount = {
  type: 'object',
  required: ['id', 'name', 'coef', 'minAge', 'maxAge'],
  properties: {
    id: { type: 'integer', example: 3 },
    name: nullable({ type: 'string', example: 'Children aged 5 to 11 - 20%.' }),
    coef: {
      type: 'number',
      description: 'Share taken off the price',
      example: 0.2
    },
    minAge: nullable({ type: 'integer' }),
    maxAge: nullable({ type: 'integer', example: 11 })
  }
};

const PassengersInfo = {
  type: 'object',
  description:
    'Passenger details as validated and stored in the session. Keys are `adult-passenger-N` / `child-passenger-N`; ' +
    'each value holds fields suffixed with the same N (`name-N`, `last-name-N`, `phone-N`, `email-N`, ' +
    '`date-of-birth-N`, `discount-N`, `card-discount-N`) plus the computed `full-ticket-price-N`, ' +
    '`discount-ticket-price-N` and `discount-percentage-N`.',
  additionalProperties: {
    type: 'object',
    additionalProperties: { oneOf: [{ type: 'string' }, { type: 'number' }] }
  },
  example: {
    'adult-passenger-1': {
      'name-1': 'Jana',
      'last-name-1': 'Novakova',
      'phone-1': '+420601123456',
      'email-1': 'jana@example.test',
      'date-of-birth-1': '1985-03-20'
    },
    'child-passenger-2': {
      'name-2': 'Eva',
      'last-name-2': 'Novakova',
      'date-of-birth-2': '2019-05-05',
      'discount-2': '3'
    }
  }
};

const okEnvelope = (data, { withSession = false } = {}) => ({
  type: 'object',
  required: ['status', 'data', ...(withSession ? ['sessionExpiresTime'] : [])],
  properties: {
    status: ref('OkStatus'),
    data,
    ...(withSession && { sessionExpiresTime: ref('SessionExpiresTime') })
  }
});

module.exports = {
  OkStatus: { type: 'string', enum: ['ok'], example: 'ok' },
  SessionExpiresTime: {
    type: 'integer',
    description: `Booking session lifetime in ms (${constants.SESSION_TIME}); the session cookie expires this long after it was created.`,
    example: constants.SESSION_TIME
  },
  LanguageCode: { type: 'string', enum: LOCALES, default: 'uk_UA' },
  ErrorResponse: {
    type: 'object',
    required: ['status', 'code', 'message'],
    properties: {
      status: { type: 'string', enum: ['fail'] },
      code: {
        type: 'string',
        enum: [
          ...Object.values(APIError.codes),
          'EXCHANGE_RATE_UNAVAILABLE',
          'SERVER_ERROR'
        ],
        description:
          'Machine-readable reason. Clients localise their message from this.'
      },
      message: {
        type: 'string',
        description: 'Developer-facing text, not localised'
      },
      errors: {
        description:
          'Details: a list of `{ field, message }` objects, or for passenger validation a map of field → localised messages.',
        oneOf: [
          {
            type: 'array',
            items: { type: 'object', additionalProperties: true }
          },
          {
            type: 'object',
            additionalProperties: { type: 'array', items: { type: 'string' } }
          }
        ]
      }
    },
    example: {
      status: 'fail',
      code: 'NO_FLIGHTS',
      message: 'no flights found',
      errors: []
    }
  },
  CountryWithNames: {
    type: 'object',
    required: ['id', 'countryattrs'],
    properties: {
      id: { type: 'integer', example: 2 },
      countryattrs: { type: 'array', items: LocalizedName }
    }
  },
  City: {
    type: 'object',
    required: ['id', 'cityattrs', 'currency'],
    properties: {
      id: { type: 'integer', example: 8 },
      country: ref('CountryWithNames'),
      cityattrs: { type: 'array', items: LocalizedName },
      currency: {
        type: 'object',
        description: 'Currency prices are shown in when travelling from here',
        properties: {
          abbr: { type: 'string', example: 'CZK' },
          symbol: { type: 'string', example: 'Kč' }
        }
      }
    }
  },
  CityGroup: {
    type: 'object',
    required: ['country', 'cities'],
    properties: {
      country: ref('CountryWithNames'),
      cities: { type: 'array', items: ref('City') }
    }
  },
  BusFlight,
  AlternativeDay: {
    type: 'object',
    required: ['date', 'flights'],
    properties: {
      date: { type: 'string', format: 'date' },
      flights: { type: 'array', items: ref('BusFlight') }
    }
  },
  SelectFlightRequest: {
    type: 'object',
    required: ['id'],
    properties: {
      id: { type: 'string', description: '`id` of a returned offer' },
      isMain: {
        type: 'boolean',
        default: true,
        description:
          '`true` for an offer from the main search, `false` for one from the alternatives'
      },
      direction: {
        type: 'string',
        enum: [constants.FORWARDS, constants.BACKWARDS],
        default: constants.FORWARDS,
        description: 'For alternatives: outbound (forwards) or return leg'
      }
    }
  },
  DiscountGroup: {
    type: 'object',
    required: ['group', 'items'],
    properties: {
      group: {
        type: 'string',
        enum: [
          constants.CHILDREN,
          constants.ADULTS,
          constants.BOTH,
          constants.DISCOUNT_CARD
        ],
        description: 'Which passengers the discounts apply to'
      },
      items: { type: 'array', items: Discount }
    }
  },
  PassengersInfo,
  PassengerForm: {
    type: 'object',
    required: [
      'adults',
      'children',
      'ticketPrice',
      'currency',
      'showDiscounts',
      'discounts',
      'passengersInfo'
    ],
    properties: {
      adults: { type: 'integer', example: 2 },
      children: { type: 'integer', example: 1 },
      ticketPrice: {
        type: 'number',
        description: 'Price per passenger before personal discounts',
        example: 1590
      },
      currency: {
        type: 'object',
        properties: {
          abbr: { type: 'string', example: 'CZK' },
          symbol: { type: 'string', example: 'Kč' }
        }
      },
      showDiscounts: {
        type: 'boolean',
        description:
          'False when the selected flight already has a promo — personal discounts do not stack with it'
      },
      discounts: { type: 'array', items: ref('DiscountGroup') },
      passengersInfo: nullable({
        ...ref('PassengersInfo'),
        description: 'Details entered earlier in this session, for prefilling'
      })
    }
  },
  ValidatePassengersRequest: {
    type: 'object',
    required: ['passengersData'],
    properties: { passengersData: ref('PassengersInfo') }
  },
  CurrentData: {
    type: 'object',
    required: ['adults', 'children', 'price', 'startDate', 'currencySymbol'],
    properties: {
      adults: { type: 'integer', example: 2 },
      children: { type: 'integer', example: 1 },
      price: {
        type: 'number',
        description:
          'Total for all passengers in the search currency, after discounts',
        example: 4452
      },
      startDate: { type: 'string', format: 'date' },
      endDate: {
        type: 'string',
        description: 'ISO date, or `one-way` / `open-date`'
      },
      bookingPageParams: nullable({
        type: 'string',
        description: 'Opaque client state saved with `POST /api/current-data`'
      }),
      currencySymbol: { type: 'string', example: 'Kč' }
    }
  },
  SessionUpdateRequest: {
    type: 'object',
    required: ['bookingPageParams'],
    additionalProperties: false,
    properties: {
      bookingPageParams: {
        type: 'string',
        description:
          'Opaque client state (e.g. the booking page query string). The only key a client may write.'
      }
    }
  },
  SignedPayload: {
    type: 'object',
    required: ['data', 'signature'],
    properties: {
      data: {
        type: 'string',
        description:
          'Base64-encoded JSON in LiqPay format (`order_id`, `amount`, `currency`, `status`, `transaction_id`, …)'
      },
      signature: { type: 'string' }
    }
  },
  Checkout: {
    type: 'object',
    required: ['provider', 'data', 'signature', 'amount', 'currency'],
    properties: {
      provider: { type: 'string', enum: ['mock', 'liqpay'] },
      data: { type: 'string', description: 'Base64-encoded JSON checkout' },
      signature: { type: 'string' },
      amount: {
        type: 'integer',
        description: 'Amount to be charged, in UAH',
        example: 9268
      },
      currency: { type: 'string', example: 'UAH' }
    }
  },
  MockCompleteRequest: {
    type: 'object',
    required: ['data', 'signature', 'outcome'],
    properties: {
      data: { type: 'string', description: '`data` from the checkout' },
      signature: {
        type: 'string',
        description: '`signature` from the checkout'
      },
      outcome: { type: 'string', enum: ['success', 'failure'] }
    }
  },
  MockCompletion: {
    type: 'object',
    required: ['outcome', 'data', 'signature'],
    properties: {
      outcome: { type: 'string', enum: ['success', 'failure'] },
      data: {
        type: 'string',
        description:
          'Signed payment result — pass it with `signature` to the ticket summary and download endpoints'
      },
      signature: { type: 'string' }
    }
  },
  TicketSummary: {
    type: 'object',
    required: [
      'ticketNumber',
      'dateOfDeparture',
      'origin',
      'destination',
      'amountPaid',
      'passengers'
    ],
    properties: {
      ticketNumber: { type: 'string', example: '000105' },
      languageCode: nullable(ref('LanguageCode')),
      dateOfDeparture: { type: 'string', format: 'date' },
      dateOfReturn: nullable({ type: 'string', format: 'date' }),
      origin: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          name: nullable({ type: 'string' })
        }
      },
      destination: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          name: nullable({ type: 'string' })
        }
      },
      amountPaid: {
        type: 'object',
        required: ['amount', 'currency'],
        properties: {
          amount: { type: 'number', example: 9268 },
          currency: { type: 'string', example: 'UAH' }
        }
      },
      passengers: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: nullable({ type: 'string' }),
            lastName: nullable({ type: 'string' }),
            type: nullable({ type: 'string', enum: ['adult', 'child'] })
          }
        }
      }
    }
  },
  NetworkStop: {
    type: 'object',
    required: ['kind', 'cityId', 'placeId', 'placeName', 'time', 'dayOffset'],
    properties: {
      kind: {
        type: 'string',
        enum: ['boarding', 'dropOff'],
        description:
          'Passengers board at boarding stops and leave at drop-off stops'
      },
      cityId: { type: 'integer', example: 1 },
      placeId: { type: 'integer', example: 1 },
      placeName: nullable({
        type: 'string',
        example: 'Kyiv Central Bus Station'
      }),
      time: {
        type: 'string',
        example: '07:00',
        description: 'Local time, HH:MM'
      },
      dayOffset: {
        type: 'integer',
        example: 0,
        description: 'Days after departure from the first stop (0 = same day)'
      }
    }
  },
  NetworkDirection: {
    type: 'object',
    required: ['routeId', 'name', 'countryId', 'weekdays', 'stops'],
    properties: {
      routeId: { type: 'integer', example: 1 },
      name: nullable({ type: 'string', example: 'Kyiv - Prague' }),
      countryId: {
        type: 'integer',
        description: 'Country the direction starts in'
      },
      weekdays: {
        type: 'array',
        items: { type: 'integer', minimum: 0, maximum: 6 },
        description: 'Departure days from the first stop, 0 = Sunday',
        example: [2, 4, 6]
      },
      stops: { type: 'array', items: ref('NetworkStop') }
    }
  },
  NetworkLine: {
    type: 'object',
    required: ['id', 'directions'],
    properties: {
      id: { type: 'integer', example: 1 },
      directions: {
        type: 'array',
        items: ref('NetworkDirection'),
        description: 'Outbound first (lower route id), then inbound'
      }
    }
  },
  NetworkCity: {
    type: 'object',
    required: ['id', 'name', 'country', 'currency'],
    properties: {
      id: { type: 'integer', example: 8 },
      name: nullable({ type: 'string', example: 'Praha' }),
      country: {
        type: 'object',
        required: ['id', 'name'],
        properties: {
          id: { type: 'integer', example: 2 },
          name: nullable({ type: 'string', example: 'Česko' })
        }
      },
      currency: {
        type: 'object',
        required: ['abbr', 'symbol'],
        description: 'Currency fares from this city are shown in',
        properties: {
          abbr: nullable({ type: 'string', example: 'CZK' }),
          symbol: nullable({ type: 'string', example: 'Kč' })
        }
      }
    }
  },
  Fare: {
    type: 'object',
    required: ['fromCityId', 'toCityId', 'currency', 'oneWay', 'roundTrip'],
    properties: {
      fromCityId: { type: 'integer', example: 8 },
      toCityId: { type: 'integer', example: 1 },
      currency: nullable({ type: 'string', example: 'CZK' }),
      oneWay: { type: 'number', example: 1590 },
      roundTrip: { type: 'number', example: 2860 }
    }
  },
  Network: {
    type: 'object',
    required: ['cities', 'lines', 'fares'],
    properties: {
      cities: { type: 'array', items: ref('NetworkCity') },
      lines: { type: 'array', items: ref('NetworkLine') },
      fares: { type: 'array', items: ref('Fare') }
    }
  },
  // Response envelopes, so generated client types name them
  CitiesResponse: okEnvelope({ type: 'array', items: ref('CityGroup') }),
  BusFlightsResponse: okEnvelope(
    { type: 'array', items: ref('BusFlight') },
    { withSession: true }
  ),
  AlternativesResponse: okEnvelope(
    { type: 'array', items: ref('AlternativeDay') },
    { withSession: true }
  ),
  AvailableDatesResponse: okEnvelope({
    type: 'array',
    items: { type: 'string', format: 'date' }
  }),
  PassengerFormResponse: okEnvelope(ref('PassengerForm'), {
    withSession: true
  }),
  CurrentDataResponse: okEnvelope(ref('CurrentData'), { withSession: true }),
  CheckoutResponse: okEnvelope(ref('Checkout'), { withSession: true }),
  MockCompletionResponse: okEnvelope(ref('MockCompletion')),
  TicketSummaryResponse: okEnvelope(ref('TicketSummary')),
  NetworkResponse: okEnvelope(ref('Network')),
  DiscountsResponse: okEnvelope({
    type: 'array',
    items: ref('DiscountGroup')
  }),
  SessionOkResponse: {
    type: 'object',
    required: ['status', 'sessionExpiresTime'],
    properties: {
      status: ref('OkStatus'),
      sessionExpiresTime: ref('SessionExpiresTime')
    }
  }
};
