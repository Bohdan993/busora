# Module Architecture — Busreisen API

> Updated: 2026-06-02

## Folder Map

```
index.js               ← startup: load env, sync DB, start server
api/
  index.js             ← Express app: middleware stack + route mounting
  routes/
    *.js               ← Public route handlers
    admin/
      *.js             ← Admin route handlers (JWT-protected)
services/              ← Business logic
  admin/
    ticketListService.js   ← Paginated ticket search
    ticketPdfService.js    ← Admin PDF generation
  busFlightService.js
  discountService.js
  loggerService.js
  mailService.js
  passengerService.js
  paymentService.js
  sessionService.js
  ticketMetaService.js   ← Metadata lookup (replaces hard-coded enums)
  ticketService.js
  tokenService.js
  userService.js
middlewares/
  errorMiddlewares.js
  requestMiddleware.js
  validationMiddleware.js  ← SQL injection prevention
  sessionMiddlewares.js
  busFlightMiddlewares.js
  ticketMiddlewares.js
  passengersMiddleware.js
  paymentMiddlewares.js
  admin/
    authMiddlewares.js     ← JWT check, role check, activation, blocked check
helpers/
  constants.js           ← 200+ named constants (all enums, limits, keys)
  index.js               ← Helper functions (date parsing, translations)
  queries.js             ← Sequelize query builders
  responseFormatter.js   ← Standardized JSON response shape
exeptions/
  api-error.js           ← Public API error class
  admin/api-error.js     ← Admin API error class
database/
  config/config.js       ← Sequelize DB config from env
  models/                ← 25 Sequelize models
  migrations/            ← 47 sequential migrations
  seeders/
languages/
  uk_UA/ ru_RU/ de_DE/   ← Translation JSON per locale
views/                   ← Pug templates (PDF ticket layout)
assets/                  ← Static assets (logos, fonts for PDFs)
logs/                    ← Winston log output
```

## Module Aliases (`package.json`)

Used with `module-alias` — all path lookups go through these:

| Alias           | Resolves to                                          |
| --------------- | ---------------------------------------------------- |
| `@root`         | `.`                                                  |
| `@api`          | `./api`                                              |
| `@database`     | `./database`                                         |
| `@exeptions`    | `./exeptions`                                        |
| `@extra`        | `./extra`                                            |
| `@helpers`      | `./helpers`                                          |
| `@languages`    | `./languages`                                        |
| `@middlewares`  | `./middlewares`                                      |
| `@services`     | `./services`                                         |
| `@views`        | `./views`                                            |
| `@assets`       | `./assets`                                           |
| `@controllers`  | `./controllers` — **alias exists, folder does not**  |
| `@repositories` | `./repositories` — **alias exists, folder does not** |
| `@validators`   | `./validators` — **alias exists, folder does not**   |

The three unused aliases are placeholders from an abandoned architectural refactor — business logic lives in `services/`, validation is inline in routes.

## Localization Pattern

Localized entities follow a consistent two-table pattern:

- **Main table:** e.g., `city` (id, countryId, currencyId, non-localized fields)
- **Attributes table:** e.g., `cityattributes` (id, cityId, languageId, localized fields like `name`)

This pattern appears for: City, Country, Discount, Place, Route, Agent, TicketMeta.

When fetching localized data, always join via `include: [{ model: *Attributes, where: { languageId } }]`.

## Key Service Responsibilities

| Service                      | Owns                                                                                    |
| ---------------------------- | --------------------------------------------------------------------------------------- |
| `ticketService.js`           | Ticket creation, transformation, public PDF generation                                  |
| `busFlightService.js`        | Flight availability, seat logic                                                         |
| `passengerService.js`        | Passenger upsert, association to tickets                                                |
| `discountService.js`         | Discount calculation                                                                    |
| `ticketMetaService.js`       | Lookup ticket statuses/types from `ticketmeta` table (replaces hard-coded string enums) |
| `tokenService.js`            | JWT sign/verify, refresh token rotation, fingerprint binding                            |
| `userService.js`             | Register, login, email activation                                                       |
| `paymentService.js`          | LiqPay signature generation/verification                                                |
| `mailService.js`             | SMTP dispatch (Nodemailer)                                                              |
| `admin/ticketListService.js` | Paginated ticket search with window cursor                                              |
| `admin/ticketPdfService.js`  | Admin-side PDF ticket generation (Puppeteer)                                            |

## Constants

All magic strings and numbers live in [helpers/constants.js](../../helpers/constants.js). Key groups:

- `TICKET_TYPES` — ticket type keys (e.g., one-way, round-trip)
- `PASSENGER_TYPES` — adult, child
- `DISCOUNT_TYPES`
- `FLIGHT_DIRECTIONS`
- `TICKET_STATUS` — pending, confirmed, cancelled, etc.
- `USER_ROLES` — admin, manager, user
- `LANGUAGES` — uk_UA, ru_RU, de_DE
- `CURRENCIES` — UAH, EUR, USD, etc.
- `PAYMENT_STATUS`
- `HTTP_STATUS` / `ERROR_CODES`
- `TIME` / `LIMITS` — rate limits, pagination page sizes
- `CACHE_KEYS` — Redis key prefixes

**Rule:** Never hard-code ticket status or type strings — always use constants, and for DB-persisted values, use `ticketMetaService` to resolve the `ticketmeta` row ID.
