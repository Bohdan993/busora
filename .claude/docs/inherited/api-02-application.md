# Application Architecture — Busreisen API

> Updated: 2026-06-02

## Stack

- **Framework:** Express 4.x
- **View engine:** Pug (used for PDF ticket templates in `views/`)
- **Authentication:** JWT — access + refresh token pattern, stored in cookies
- **Session:** `express-session` via Redis (or memory fallback), cookie name `busreisen-sess`
- **PDF generation:** direct **Puppeteer** headless (`services/ticketService.js` → `renderPdfWithBrowser`/`generatePDFTicket`). Each render uses its own throwaway `--user-data-dir` and always closes the browser in `finally`; `waitUntil: 'load'` + 20s timeout + one retry. Do NOT reuse a fixed Chrome profile dir across renders/workers — that caused the 2026-07-10 outage (see `05-issues.md`). `html-pdf-node` is no longer used.
- **Logging:** Winston
- **Validation:** `express-validator` (inline per route)

## Middleware Stack (in order)

Applied globally in [api/index.js](../../api/index.js):

1. **Request tracking** — `requestIdMiddleware`, `attachLoggerContext`, `requestLoggingMiddleware` — assigns UUID to each request, logs method/path/duration
2. **Response helpers** — `responseHelpers` — attaches standardized `res.success()` / `res.error()` methods
3. **CORS** — `cors()` — allows `CORS_ORIGIN` + `CORS_ORIGIN_ADMIN`, `credentials: true`
4. **Helmet** — CSP (`'self'` scripts, `'unsafe-inline'` styles), HSTS (1 year), `frameguard: deny`
5. **Rate limit** — 100 requests / 15 min per IP; custom handler logs security event
6. **Body parsing** — `bodyParser.urlencoded` + `bodyParser.json`, 10MB limit each
7. **Cookie parser**
8. **Session** — Redis store if configured, 15 min TTL, `secure` + `httpOnly` cookie
9. **Fingerprint** — `express-fingerprint` — device fingerprinting (used by token service)
10. **Compression** — level 6, 1024 byte threshold
11. **SQL injection prevention** — `preventSQLInjection` middleware (before all routes)

## Route Structure

All routes are prefixed `/api`.

### Public routes

| Prefix              | Handler file                 | Purpose                          |
| ------------------- | ---------------------------- | -------------------------------- |
| `/api/cities`       | `api/routes/cities.js`       | City data & localized attributes |
| `/api/currencies`   | `api/routes/currencies.js`   | Currency list                    |
| `/api/bus-flights`  | `api/routes/busFlights.js`   | Flight search & ticket booking   |
| `/api/passengers`   | `api/routes/passengers.js`   | Passenger data                   |
| `/api/tickets`      | `api/routes/tickets.js`      | Ticket lookup & PDF download     |
| `/api/translations` | `api/routes/translations.js` | i18n strings for frontend        |
| `/api/payment`      | `api/routes/payment.js`      | LiqPay callback receiver         |
| `/api/current-data` | `api/routes/sessionData.js`  | Session data for current user    |

### Admin routes (all under `/api/admin`)

Require `Authorization: Bearer <token>` header (JWT).

| Prefix                   | Handler file                     | Roles                   |
| ------------------------ | -------------------------------- | ----------------------- |
| `/api/admin/auth`        | `api/routes/admin/auth.js`       | public (register/login) |
| `/api/admin/bus-flights` | `api/routes/admin/busFlights.js` | manager+                |
| `/api/admin/cities`      | `api/routes/admin/cities.js`     | manager+                |
| `/api/admin/currencies`  | `api/routes/admin/currencies.js` | manager+                |
| `/api/admin/discounts`   | `api/routes/admin/discounts.js`  | manager+                |
| `/api/admin/routes`      | `api/routes/admin/routes.js`     | manager+                |
| `/api/admin/search`      | `api/routes/admin/search.js`     | manager+                |
| `/api/admin/tickets`     | `api/routes/admin/tickets.js`    | manager+                |

### Error handler

`handleError` middleware catches `APIError` and `AdminAPIError` from `exeptions/` and returns structured JSON.

## Authentication Flow (Admin)

1. `POST /api/admin/auth/login` → returns access token (JWT) + sets refresh token cookie
2. Every protected request must include `Authorization: Bearer <accessToken>`
3. `checkUserAuth` middleware validates JWT; `checkUserPermissions(...roles)` enforces role
4. `POST /api/admin/auth/refresh` → rotates refresh token (fingerprint-bound)
5. `POST /api/admin/auth/logout` → clears tokens

**Roles:** `admin` > `manager` > `user`

Additional guards:

- `checkUserActivation()` — email must be confirmed before access
- `checkUserBlocked()` — blocked users are rejected

## Response Format

All routes use a standardized response shape via `responseHelpers`:

```json
{
  "status": "success" | "error",
  "data": { ... },
  "message": "..."
}
```

## Localization

Three supported locales: `uk_UA`, `ru_RU`, `de_DE`.

- Translation strings live in [languages/](../../languages/) (JSON per locale)
- DB records have `*Attributes` join tables with localized fields (see `03-architecture.md`)
- `GET /api/translations` serves frontend i18n strings
