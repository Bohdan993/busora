/** @format */

const swaggerJsdoc = require('swagger-jsdoc');
const bookingSchemas = require('./swaggerBookingSchemas');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Busora API',
      version: '1.0.0',
      description:
        'Busora bus-ticket booking API (educational demo).\n\n' +
        '**Booking flow:** cities → search flights → select a flight → passenger form → validate passengers → ' +
        'start checkout → pay (mock page or LiqPay) → ticket summary and PDF download. ' +
        'Booking state lives in a session cookie (`busora-sess`), so a browser client must send credentials; ' +
        'the web app calls the API through a same-origin proxy.\n\n' +
        '**Errors** share one shape (`ErrorResponse`) with a machine-readable `code`.\n\n' +
        '**Admin flow:** JWT login required. Access token goes in `Authorization: Bearer <token>` header.'
    },
    servers: [{ url: 'http://localhost:5000', description: 'Local dev' }],
    tags: [
      { name: 'Cities', description: 'Public city/country lookup' },
      { name: 'Currencies', description: 'Currency lookup by abbreviation' },
      { name: 'Bus Flights', description: 'Flight search and selection' },
      { name: 'Passengers', description: 'Passenger form and validation' },
      { name: 'Session', description: 'Booking session state' },
      {
        name: 'Payment',
        description: 'Checkout (mock or LiqPay) and the provider callback'
      },
      {
        name: 'Tickets',
        description: 'Ticket summary and PDF download after payment'
      },
      { name: 'Admin / Auth', description: 'Admin authentication' },
      {
        name: 'Admin / Bus Flights',
        description: 'Admin bus-flight management (CRUD)'
      },
      {
        name: 'Admin / Cities',
        description: 'Admin city list with route assignments'
      },
      { name: 'Admin / Currencies', description: 'Admin currency list' },
      { name: 'Admin / Discounts', description: 'Admin discount list' },
      { name: 'Admin / Routes', description: 'Admin route list' },
      {
        name: 'Admin / Search',
        description: 'Admin autocomplete search helpers'
      },
      {
        name: 'Admin / Tickets',
        description: 'Admin ticket management (CRUD + PDF)'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description:
            'Admin JWT access token obtained from `POST /api/admin/auth/login`'
        }
      },
      schemas: {
        // ── Public booking flow ────────────────────────────────────────────
        ...bookingSchemas,
        SuccessResponse: {
          type: 'object',
          properties: {
            status: { $ref: '#/components/schemas/OkStatus' }
          }
        },
        // ── Admin ──────────────────────────────────────────────────────────
        AdminErrorResponse: {
          type: 'object',
          properties: {
            status: {
              type: 'string',
              description: 'The error message',
              example: 'Користувач не авторизований'
            },
            error: { type: 'array', items: { type: 'object' } }
          }
        },
        PaginationMeta: {
          type: 'object',
          properties: {
            totalRowCount: { type: 'integer', example: 142 },
            startPage: { type: 'integer', example: 0 },
            timestamp: { type: 'integer', example: 1717000000000 }
          }
        },
        // ── Admin bus-flight ───────────────────────────────────────────────
        BusFlightTableRow: {
          type: 'object',
          properties: {
            busFlightId: { type: 'string', example: '2165' },
            allSeats: { type: 'integer', example: 50 },
            freeSeats: { type: 'integer', example: 12 },
            routeId: { type: 'string', example: '3' },
            route: { type: 'string', example: 'Київ — Штутгарт' },
            dateOfDeparture: {
              type: 'string',
              format: 'date',
              example: '2026-06-19'
            },
            discount: {
              oneOf: [{ type: 'integer' }, { type: 'string' }],
              example: 20
            }
          }
        },
        BusFlightDetail: {
          type: 'object',
          properties: {
            busFlightId: { type: 'string', example: '2165' },
            allSeats: { type: 'integer', example: 50 },
            freeSeats: { type: 'integer', example: 12 },
            dateOfDeparture: {
              type: 'string',
              format: 'date',
              example: '2026-06-19'
            },
            discount: { type: 'integer', example: 20 },
            route: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                label: { type: 'string' },
                groupBy: { type: 'string', description: 'Country name' }
              }
            }
          }
        },
        // ── Admin ticket ───────────────────────────────────────────────────
        AdminTicketRow: {
          type: 'object',
          properties: {
            ticketId: { type: 'string', example: '4149' },
            ticketNumber: { type: 'string', example: '#004249' },
            dateOfDeparture: { type: 'string', format: 'date' },
            dateOfReturn: { type: 'string', format: 'date', nullable: true },
            origin: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                name: { type: 'string' }
              }
            },
            destination: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                name: { type: 'string' }
              }
            },
            price: {
              type: 'number',
              example: 4880,
              description: "Ticket total; the sum of every passenger's price."
            },
            passengerPrice: {
              type: 'number',
              nullable: true,
              example: 1627,
              description:
                "This passenger's price: (paymentAtOffice + paymentOnBus) × discount multiplier."
            },
            currency: { type: 'string', example: 'UAH' },
            type: {
              type: 'object',
              description:
                'Ticket type ({ id, name }); id is the ticket_type meta id.',
              properties: {
                id: { type: 'string', example: '5' },
                name: { type: 'string', example: 'В одну сторону' }
              }
            },
            status: {
              type: 'object',
              description:
                'Ticket status ({ id, name }); id is the ticket_status meta id.',
              properties: {
                id: { type: 'string', example: '2' },
                name: { type: 'string', example: 'Оплачено' }
              }
            },
            passengerType: {
              type: 'object',
              description:
                'Passenger type; id/name are the enum value (adult|child).',
              properties: {
                id: { type: 'string', example: 'adult' },
                name: { type: 'string', example: 'adult' }
              }
            },
            agent: {
              type: 'object',
              description: 'Assigned agent ({ id, name }); id "0" = no agent.',
              properties: {
                id: { type: 'string', example: '0' },
                name: { type: 'string', example: 'Без агента' }
              }
            },
            passengerConfirmation: {
              type: 'object',
              description: 'Confirmation status ({ id, name }); id "0" = none.',
              properties: {
                id: { type: 'string', example: '0' },
                name: { type: 'string', nullable: true, example: null }
              }
            },
            hasDiscount: { type: 'boolean' },
            discountPercentage: { type: 'number', example: 20 }
          }
        }
      }
    }
  },
  apis: ['./api/routes/*.js', './api/routes/admin/*.js']
};

module.exports = swaggerJsdoc(options);
