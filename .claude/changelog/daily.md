# Daily Changelog — Busora

## 2026-10-31

- Phase 1 complete. The 59 inherited migrations are replaced by
  `20261030000001-baseline-schema.js` (25 tables in foreign-key order, plus the
  two `passengerRowCount` triggers), followed by `20261030000002-reference-data.js`.
- Verified on the dev Compose stack:
  - `npm run migrate` on an empty `busora_dev` succeeds.
  - Compared through `information_schema`, the resulting schema is identical
    to what the old chain produced, minus `tickets.children`: 193 columns, 89
    index entries, 37 FK columns, 2 triggers, plus each column's
    charset/collation.
  - The API boots: cities and currencies return 200 with empty data, Swagger
    loads, and Redis is used for sessions.
  - Admin register → activation email in Mailpit → link → activated.
- Fixed: `sequelize-cli` never registered the `@helpers` module aliases, so
  migrations that imported constants crashed. `.sequelizerc` now loads
  `module-alias/register`.
- Found in the old chain (now moot): `20250912040507` (ticketmetaattributes)
  sorted before the `ticketmeta` table it references. The chain could not run
  on an empty DB in order.
- Inherited quirk kept as-is: `tickets.statusId` and `tickets.typeId` each have
  two FKs to `ticketmeta`, one RESTRICT and one SET NULL. In effect, deleting a
  ticketmeta row in use is blocked.
- Docker needed Windows' Virtual Machine Platform enabled plus a reboot.
  Firmware virtualization was already on.
- Phase 1 check note: cities are empty until the Phase 6 seeders.
- Phase 2 complete:
  - [DECISION] New `config/market.js` holds the country rules: home currency
    UAH, phone formats for UA (`+380` mobile) and CZ (`+420` + 6/7 + 8 digits),
    and the payment-page language per locale (cs → en, because LiqPay has no
    Czech). `passengerService` and `payment.js` read from it.
  - [INTEGRATION] Exchange rates now come from `services/exchangeRates`. The
    default is the NBU API (`bank.gov.ua … statdirectory/exchange`), cached in
    memory for 1 h. `EXCHANGE_RATE_PROVIDER=fixed` with `FIXED_EXCHANGE_RATES`
    works offline. PrivatBank's live feed had no CZK, and the old code then
    silently used rate 1. A missing rate now throws `ExchangeRateError`, which
    maps to 503. Live check on 2026-10-31: CZK 2.0818, EUR 50.6843 UAH.
  - [DECISION] The rate source changed from PrivatBank's *sale* rate to the
    official NBU rate, which is slightly lower.
  - [DECISION] The cache is in memory instead of Redis (the plan said Redis),
    because the API runs as one process. Revisit if it ever scales out.
  - The search routes resolve the rate *before* `session.regenerate`; an error
    thrown in that callback escaped the try/catch. An unknown `currencyAbbr`
    now returns 400.
  - Ticket creation after payment and admin edits still fall back to rate 1 /
    the locked rate on failure (a paid booking must never fail). Ticket
    creation now logs a warning when that happens.
  - Removed the Dresden route-group filter (`extra/customRoutesFilterMap` and
    six functions in `busFlightService`, the admin search variant, the
    alternatives limit multiplier, and the `@extra` alias). The UA ⇄ CZ network
    has no city pair served by two lines.
  - Admin route-order sorting accepts any route key matching `^[A-Z]{1,8}$`
    instead of the hardcoded `ZD/DZ/ZK/KZ`. The format check keeps the SQL
    literal injection-safe. Phase 8: the admin UI still sends the old keys.
  - Tests: 46 → 63 (market rules, rate providers and cache, route keys, error
    mapping).
- Phase 3 (payments) done, apart from the full-booking E2E (see the last
  item):
  - [INTEGRATION] `services/payments`: the provider is chosen by
    `PAYMENT_PROVIDER` (`mock` by default, or `liqpay`). Both implement
    `sign` / `verify` / `createCheckout`. Config is validated at startup; the
    API refuses to boot without its keys (`MOCK_PAYMENT_SECRET` ≥ 32 chars for
    the mock, all three `LIQPAY_*` for LiqPay).
  - [DECISION] The shared contract is LiqPay's payload shape (`status`,
    `transaction_id`, `amount`, `currency`, `info`, `order_id`) as base64 JSON
    plus a signature. The mock produces the same shape, so `getSessionData`,
    `getOrCreateTicket` and `ensureTicketPDFAndSendEmail` are unchanged. The
    plan had a separate normalized object; it isn't needed.
  - [DECISION] `POST /api/payment` returns JSON
    `{provider, data, signature, amount, currency, hasDiscount}` instead of
    pug widget HTML, and the frontend decides how to render it. The plan said
    `checkoutUrl`; this keeps frontend URLs out of the API.
    `views/payment-widget.pug` was deleted.
  - New `POST /api/payment/mock/complete {data, signature, outcome}` (mock
    only, otherwise 404). It builds a signed callback and runs the same
    `processPaymentCallback` (extracted to `services/paymentCallbackService.js`)
    as the LiqPay webhook. The transaction id is derived from the order, and
    a repeat completion skips delivery, so there is no second ticket or email.
    The plan's `/:orderId/` path segment was dropped, because the signed
    checkout already identifies the order.
  - The order id and saved-session key are signed by the active provider
    (`sessionService.deriveOrderKeys`, shared by payment creation and lookup)
    instead of with `LIQPAY_PRIVATE_KEY`. The algorithm is identical in LiqPay
    mode. Admin ticket creation also signs through the provider.
  - Signature checks are constant-time. A bad signature is now a 400 (it used
    to be a plain Error, so a 500).
  - Verified over HTTP: decline, a success that reaches the session lookup,
    forged signatures (mock, LiqPay webhook, `/tickets/generate`), an invalid
    outcome, and the startup failure on incomplete LiqPay config.
  - Not yet verified: the full booking E2E (search → passengers → mock pay →
    1 ticket, N PDFs, repeat completion is a no-op). It needs route data, so
    it runs in Phase 6 with the real seeders.
  - Tests: 63 → 77.
- Phase 4 (locales uk / cs / en) done, apart from the rendered-PDF check:
  - Added `languages/cs_CZ` and `languages/en_US` (10 files each) and
    `views/ticket-terms-of-use/{cs_CZ,en_US}.pug`. The cs and en mail and
    ticket texts already use the Busora brand. Deleted ru_RU and de_DE.
  - [DECISION] 10 files per locale, not 13. `400-error.js`,
    `payment-widget.js` and `search-widget.js` were only served to the old
    jQuery frontend via `/api/translations`; the Next.js app will have its
    own i18n. They were deleted for all locales.
  - uk fixes: Russian "К поиску" → "До пошуку"; extra baggage price 2€/kg →
    50 Kč/kg in all three terms; new `_mail.paymentDescriptionText`, so the
    payment description is no longer hardcoded Ukrainian.
  - Security: `loadLanguageFile` accepts only `config/market.LOCALES` and
    bare file names, which closes the `require()` path traversal. A global
    `validateLanguageCode` middleware returns 400 for an unsupported
    `?languageCode=`. `/api/translations` only accepts `^[a-z]+$` object names
    (they were interpolated into a RegExp) and returns 400 for unknown ones.
  - [DECISION] New column `tickets.languageId` (NOT NULL DEFAULT 1, FK to
    languages; migration `20261031000001`). `createTicket` sets it from the
    payment `info.languageCode`. Admin-created tickets default to uk_UA.
    Storing it on the ticket means PDFs that the admin re-generates or
    re-sends later keep the customer's language.
  - PDFs: `loadTicketWithRelations(id)` reads the ticket's `languageId`, then
    loads city, place and route names in that language. `buildHTMLTicketOptions`
    takes language, dates and terms from the ticket (signature is now
    `(ticket, template)`). Prices stay in UAH.
  - Emails: the customer's subject and body use the booking language; the
    admin copy is always uk_UA (DEFAULT_LOCALE). Admin "send PDF" uses the
    ticket's language for city names, subject and body.
  - Note for Phase 6: the language-filtered includes in `buildTicketQuery` are
    inner joins. Every city, place and route must have a name in all three
    languages, or a ticket's PDF query finds nothing.
  - Not yet verified: rendering an actual cs/en PDF (needs route data). It
    runs in the Phase 6 E2E.
  - Tests: 77 → 88, including a parity test that every locale has the same
    files and keys as uk_UA.
- Phase 5 (brand, demo notice, security) done:
  - Brand:
    - Logo `assets/images/logo_busora.png` (cropped from `brand/logo.png`,
      512 px, 88 KB).
    - Palette: header and QR use `#005A87` (darker brand blue, 7.47:1 on
      white, so it scans and stays readable); accents use `#007BB7`.
    - Names: cookie `busora-sess`, Redis prefix `busora:`, Swagger "Busora
      API", download names `Busora_Ticket*.pdf` / `Busora_Tickets.zip`, uk
      mail subject and signature.
    - No `Benz|Бенс|busreisen` left in the API except the baseline
      migration's provenance comment.
  - Demo notice: `demoNoticeText` (uk/cs/en) is rendered as a boxed line above
    the terms in the PDF (`full-ticket.pug`) and under the customer email body.
  - `generate-html-ticket.js [uk_UA|cs_CZ|en_US]` previews a Kyiv ⇄ Praha
    ticket per language; output `assets/ticket-sample-*.html` is gitignored.
    Used it to render real PDFs in the container (app's `generatePDFTicket`,
    container Chromium and fonts): Czech diacritics, dates, terms, logo and
    notice all render. This closes Phase 4's open rendering check, apart from
    the DB-driven path, which the Phase 6 E2E covers.
  - Security:
    - `POST /api/current-data` only accepts string `bookingPageParams`
      (`sessionService.applyClientSessionUpdate`); any other key returns 400
      and nothing is applied.
    - `POST /api/payment` resolves the exchange rate fresh instead of trusting
      `session.currencyExchangeRate`.
  - Logs with personal data removed: session/passenger dumps in
    `passengers.js` and `passengersMiddleware`; headers, cookies and session
    in `sessionMiddlewares` (the session cookie is a credential); customer
    email addresses in `mailService`. `/tickets/payment-fail` now logs only
    order id, transaction id, status and error through
    `logger.logPayment`.
  - Tests: 88 → 92.
- Phase 6 (UA ⇄ CZ seed data) done, plus the full-booking E2E deferred from
  Phases 3 and 4:
  - [DECISION] Network (illustrative). All names are in uk/cs/en; ids are
    explicit.
    - Line 1 (group 1, route keys KP/PK): Kyiv, Zhytomyr, Rivne, Lviv ⇄
      Ostrava, Olomouc, Hradec Králové, Praha.
    - Line 2 (group 2, TP/PT): Ternopil, Mukachevo, Uzhhorod ⇄ Brno, Praha,
      Plzeň.
    - The lines share only Praha, so no city pair is served twice.
    - 13 cities, 1 stop each, 4 routes.
    - Fares: a UA base plus a CZ surcharge in UAH, with fixed CZK list prices
      at ÷2.08 rounded to 10; round trip = 1.8×. Kyiv–Praha is 3300 ₴ /
      1590 Kč.
    - The inherited 11 passenger discounts, plus a 15 % promo on line 2's
      Wednesday departures.
    - 2 agents.
  - Seeders (now committed): `20261101000001-network`,
    `20261101000002-bus-flights` (daily on every route for 90 days from the
    seeding date; re-run it to move the schedule forward) and
    `20261101000003-demo-users` (admin and manager from
    `SEED_*_EMAIL/PASSWORD`, bcrypt cost 10; skipped if unset). Data lives in
    `database/seeders/data/network.js`; the pure row builders in
    `buildRows.js` have 9 invariant tests.
  - Rules the data must follow (they're encoded in the tests):
    - Fares are directional and per currency: 4 rows per city pair, or the
      search returns no price.
    - A route's `countryId` is the country it starts in; the return leg is
      found by `routeGroupId` plus the other country.
    - Every name must exist in all locales, because queries inner-join on
      language.
  - E2E (scratchpad script, to become a committed test in Phase 7), all
    passed:
    - Czech: Praha → Kyiv, CZK, 2 adults + 1 child, `+420` phones. Charged
      9268 UAH (4452 Kč × 2.0818). 1 ticket (cs_CZ), 3 passengers, 3 PDFs,
      a Czech email with 3 attachments. A repeat completion was a no-op.
      The ZIP downloaded.
    - English: Kyiv → Praha, UAH. Ticket and email in English.
    - Declined payment: no ticket, seats unchanged.
    - Round trips on both lines pair by group. The Wednesday promo shows
      2700 → 2295 ₴.
    - `POST /current-data {currencyExchangeRate}` returns 400 with a live
      session.
  - Bugs found by the E2E and fixed:
    - The session cookie was hardcoded `secure: true`, so it was never set
      over HTTP and no booking could get past search locally. It is now
      secure unless `SESSION_COOKIE_SECURE=false` (local `.env` only;
      `trust proxy` covers HTTPS behind Caddy). `sameSite` is now `lax`
      (was `none` in dev and `strict` in prod; strict breaks the redirect
      back from a payment page).
    - Child dates of birth had to be epoch milliseconds; an ISO date passed
      validation and then crashed ticket creation *after payment*
      ("Invalid time value"). `toDateOnly` now accepts both formats for all
      passengers. The Swagger example said `20-03-1985`, which the parser
      rejects; it now says ISO.
    - Freshly rendered PDFs were attached as `<hash>.pdf.pdf` (ENOENT). This
      was inherited and only hit when the callback rendered the PDFs itself
      (the old flow usually rendered them earlier via `POST /tickets`).
    - Per-passenger prices were split **evenly**, so with mixed discounts
      every ticket PDF printed the wrong price (child 3090 instead of 2648).
      This was inherited. The total is now split in proportion to each
      passenger's discounted fare (`splitAmount`, largest remainder, exact
      sum).
  - Noted, not changed: the app hashes passwords with bcrypt cost 5 (weak);
    seeded users use 10.
  - Tests: 92 → 109.
- Phase 7 complete (API contract for the Next.js frontend, tests, CI):
  - [BREAKING] The public API is JSON only. `mode=html` is gone from cities,
    search, alternatives and the passenger form, and the frontend pug views
    are deleted (`full-ticket.pug` and the terms stay, for the PDFs). Also
    removed: `GET /api/translations` (the web app owns its UI text),
    `POST /tickets/generate` (HTML) and the Postman collection.
  - [DECISION] Public errors share one shape:
    `{ status: 'fail', code, message, errors }`. `code` is machine-readable
    (`NO_FLIGHTS`, `SESSION_NOT_STARTED`, `VALIDATION_FAILED`, …, listed in
    `APIError.codes`); clients localise from it. The old 401/404 errors
    rendered pug pages; their language files are deleted.
    `passengers-form.js` and `ticket-list.js` keep only the validation
    messages and the month names. Invalid travel dates are now 400
    `INVALID_DATES` (were 404). Unknown `/api` paths return a JSON 404. A
    500 no longer echoes the internal error message. Admin errors are
    unchanged.
  - New/changed JSON:
    - `GET /passengers` now also returns `ticketPrice`, `currency`,
      `showDiscounts` and the earlier `passengersInfo` (all of which only
      the pug form had). Discounts come as `{ group, items: [{ id, name,
      coef, minAge, maxAge }] }`. The `type=check` variant is gone (use
      `GET /current-data`). It no longer requires existing passenger data.
    - Alternatives come as `[{ date: ISO, flights }]`.
    - `GET /current-data` returns `adults` and `children` as numbers.
    - New `POST /tickets/summary` (signed payment result → ticket number,
      route, dates, amount paid, passengers; ends the session).
  - [SECURITY] `originId`/`destinationId` were interpolated into a raw
    `JSON_CONTAINS` literal in the alternatives query (inherited). The search
    routes now accept positive integers only (`validateCityIds`), and the
    literal casts with `Number()`.
  - [DECISION] Contract = OpenAPI. Public schemas live in
    `config/swaggerBookingSchemas.js`; `npm run openapi` writes
    `apps/api/openapi.json` (committed, prettier-ignored), and
    `openapi:check` fails when it is stale. Verified that
    `openapi-typescript` generates clean types from it. Type generation
    itself belongs to `apps/web` (Phase 9).
  - CORS: the web app will call the API through a Next.js `/api` rewrite
    (same origin), so `.env.example` leaves `CORS_ORIGIN` empty; only the
    admin needs an entry.
  - [DECISION] `npm run test:integration` (`integration/booking.flow.js`, 17
    checks). It runs the booking flow over HTTP against the in-process app:
    real MySQL, Mailpit and puppeteer, in-memory sessions, mock payments,
    fixed rate `CZK=2.08`. It checks prices, the UAH amount, 3 PDFs on
    disk, seats −3, idempotent repeat, summary, ZIP, email with 3
    attachments, declined payment and the error shapes. It deletes its
    tickets afterwards via `deleteTicketCascade` (seats restored). No
    supertest: `app.listen(0)` + `fetch` is enough. Not matched by
    `npm test`'s default globs.
  - Gotcha: `database/config/config.js` calls `dotenv.config()` itself, so
    deleting an env var before requiring the models does not stick (it is
    reloaded from `.env`). Set it to `''` instead. A deleted `REDIS_HOST`
    left a Redis socket open and the test process never exited.
  - `config.test` no longer logs every SQL query.
  - CI: `.github/workflows/ci.yml`.
    - API job: lint, `format:check`, `openapi:check`, unit tests, then
      migrate + seed + integration tests against MySQL 8 and Mailpit service
      containers. It runs as MySQL root because a service container cannot
      take `--log-bin-trust-function-creators`, Chrome is the runner's
      `/usr/bin/google-chrome`, and secrets are generated per run.
    - Admin job: lint, `format:check`, `tsc --noEmit` and the CRA build
      (`CI=true`).
    - Simulated locally on a fresh `busora_ci` database as root with
      `NODE_ENV=test`: migrate, seed and 17/17 pass. The admin passes all
      four. No GitHub remote exists yet, so the workflow has not run on
      Actions.
  - Gotcha: on Windows `core.autocrlf=true` checks files out with CRLF and
    `prettier --check` then flags them. Git stores LF, so CI is clean. Use
    `--end-of-line auto` to check locally.
  - Noted, not changed: the passenger form's `discount-name-N` in the session
    is always the Ukrainian name (`passengerService.js` picks `uk_UA`).
  - Tests: 109 → 114 unit tests, plus 17 integration checks.
- Phase 8 complete (admin panel fork):
  - Rebrand: package `busora-admin`, title "Busora Адмін Панель" (index.html,
    manifest, home, 500 page), the Busora logo in the sidebar and on
    login/registration (in place of the lock avatar), favicon and PWA icons
    generated from `brand/logo.png`, theme primary `#007BB7` and success
    `#2CA04D`, footer "Busora (навчальний демо-проєкт)", PDF downloads named
    `Busora_Ticket_<n>.pdf`. Removed the Benz Express logo and the
    busreisen.com.ua links. The template's MIT `LICENSE` stays. The README
    now covers running the admin and its checks.
  - Phones: UA (+380) / CZ (+420) replace UA/DE in both phone inputs and in
    `validatePhone`. The rule lives in `src/helpers/phone.ts`, mirroring the
    API's `PHONE_PATTERN`. Note that the API does not validate phones on
    admin saves; only the booking site does.
  - Route sort: the hardcoded ZD/DZ/ZK/KZ menus (in two columns) now render
    from `ROUTE_SORT_OPTIONS` (KP/PK/TP/PT, the seeded `routeKey`s), and
    `CustomOrder` is derived from it. The API side was already generic.
  - Currencies: the admin loads them from the API, and the symbol map
    already had CZK; EUR examples in comments became CZK.
  - Config: `API_URL` defaults to `http://localhost:5000/api/admin`
    (was https), and a new `apps/admin/.env.example` sets `PORT=3001` (Next
    takes 3000) and `REACT_APP_API_URL`. `.gitignore` now lets
    `.env.example` through.
  - API: the admin refresh-token cookie was hardcoded `secure: true` (same
    bug class as the Phase 6 session cookie). It now uses
    `refreshTokenCookieConfig` in `config/app.config.js` with the same
    `SESSION_COOKIE_SECURE` switch and `sameSite: 'lax'`. The unused
    `validators` lists in `validationMiddleware.js` now read
    `LOCALES` / UAH+CZK.
  - Verified in Chromium (Playwright) against the dev stack:
    - Login as the seeded admin. The refresh cookie is not Secure on
      local HTTP, and a bad access token is renewed through it.
    - Branding as described above.
    - The tickets table lists the Phase 6/7 bookings.
    - The route-sort menu shows the 4 directions, and choosing
      "Прага - Київ" requests `customSorting` `PK` (200).
    - A row's "Завантажити PDF квиток" downloads `Busora_Ticket_000101-1.pdf`
      (valid PDF).
    - The add-flight form created a Kyiv–Prague flight for 2027-02-15 with
      a 20 % discount (flight 361, discount coef 0.20). It was deleted
      afterwards through the admin API.
    - Admin lint, format, `tsc` and the `CI=true` build pass.
  - Expected noise: the login page's silent `GET /auth/refresh` returns 401
    before anyone has logged in (inherited).
  - Left for later: the login/registration pages still use a default MUI
    theme of their own, and "demo admin login" for the public demo
    (showing credentials or not) is a Phase 11 decision.
- Phase 9 complete (Next.js site, working but unstyled):
  - [DECISION] Scope (agreed with the user):
    - Page and section structure follows busreisen.com.ua, structure only:
      every text, contact and photo is our own and fictional.
    - The Playwright e2e runs locally only, not in CI.
    - Photos are free-licensed (Wikimedia Commons).
    - Flights run on set weekdays.
    - No newsletter.
  - API:
    - Seed: the flights run on set weekdays. Line 1 runs KP Tue/Thu/Sat and
      PK Wed/Fri/Sun; line 2 runs TP Mon/Wed/Fri and PT Tue/Thu/Sat. Each
      inbound leaves the day its bus arrives. The Wednesday promo now covers
      route 3 only.
    - `GET /api/network` returns cities, lines × directions (stops with
      place, time and `dayOffset`; weekdays derived from upcoming flights)
      and all fares (UAH + CZK). It is cacheable for 5 min.
    - `GET /api/discounts` lists every personal discount, including
      seasonally inactive ones.
    - The discount query moved to `discountService.findPersonalDiscounts`.
  - Gotcha: `busflightprices` has no `id` column, so any Sequelize `include`
    on it fails ("Unknown column busflightprices.id"). Query it raw and join
    in code.
  - Gotcha: `dayOffset` is inferred from wall-clock times (an earlier time
    than the previous stop's means the next day). That is only valid while
    no leg is 24 h or longer; this is documented in `networkService.js`.
  - `apps/web`:
    - Stack: Next.js 16.4 (create-next-app defaults, with Cache Components
      and partial prefetching on), next-intl 4 (`/uk`, `/cs`, `/en`,
      `src/proxy.ts`), TanStack Query, react-hook-form + zod 4,
      openapi-fetch with types from `apps/api/openapi.json`
      (`npm run api:types`), and Vitest.
    - [DECISION] All API data loads in the browser through the `/api`
      rewrite. Server components render only translated text, so pages
      prerender and `next build` never needs the API (CI).
  - Pages:
    - Home: hero + search, amenities, fleet, popular destinations and the
      about section.
    - Routes (filters for both cities and weekday; "Book" prefills the
      form), schedule and fares (per line), rules (TOC; refund fees and
      baggage match the PDF terms), contacts (live Kyiv/Prague clocks,
      open/closed), attributions, and a localised 404.
    - Booking: results (plus the nearest-departures fallback, and outbound
      then return for round trips), passengers, review, mock payment,
      success (summary + ZIP), failed, and a session countdown.
  - Bug found and fixed in the UI: the API's alternatives endpoint always
    looks for buses originId → destinationId, so the return leg must ask
    with the cities swapped. Without the swap a round trip "returned" on an
    outbound bus. (`/available-dates` swaps for `backwards` itself.) An e2e
    test covers this now.
  - Gotchas with this Next.js version:
    - `AGENTS.md` says to read the docs bundled in
      `node_modules/next/dist/docs`, and they were needed: under Cache
      Components `new Date()` is not allowed while prerendering. That is
      why the footer year was dropped, and clocks and timers use
      `useSyncExternalStore` (`useNow`).
    - Exports of a `'use client'` module arrive in server components as
      client references (the `NAV_ITEMS.map` crash), so shared constants
      live in plain modules.
    - The `react-hooks/set-state-in-effect` lint rule bans reading storage
      in effects; `useBooking` uses `useSyncExternalStore`.
    - `getByLabel` on a `<label>` that wraps a `<select>` includes the
      option texts, so match selects with `getByRole('combobox', { name })`.
    - Installing Playwright 1.64's Chromium deleted build 1234, which the
      home-folder Playwright 1.62.1 used by the scratch scripts needs. It
      was reinstalled.
  - Images: 8 cities + 4 coaches from Wikimedia Commons (CC BY, CC BY-SA or
    CC0), 1280 px, under 600 KB each. A Setra photo with a small real
    operator logo (BerlinMobil) was replaced with an unmarked Van Hool TX16.
  - Checks:
    - Vitest: 34 (network helpers, formatting, search query, passenger
      payload, office hours, message key parity).
    - Playwright: 4 locally. Full booking in uk and cs, decline, and a
      round trip from alternatives through to the ticket.
    - API: 121 unit tests and 19 integration checks.
    - CI gets a `web` job: lint, format, API types match `openapi.json`,
      typecheck, unit tests and build.
  - Noted:
    - In dev, the catch-all 404 logs a "could not validate instant"
      diagnostic. It is harmless; the page answers 404 as intended.
    - The passenger form's discount names include percentages (seed text),
      which duplicates the percentage column on the fares page.
- Phase 10 complete: the site wears the reference design (a style reference
  for a white-canvas product site: Inter, pill controls, one 6% shadow).
  - [DECISION] Busora blue `#007BB7` replaces the reference's Signal Blue as
    the action colour, and Busora green marks positive states (done steps,
    "office open", payment success). Decided with the owner. Text uses darker
    shades where the brand colours fall below 4.5:1: `#00699D` for links on
    grey, `#1D7A38` for green text.
  - Deliberate departures from the reference are listed at the top of
    `apps/web/src/styles/tokens.css`: a danger red for errors, milder body
    tracking (Cyrillic and Czech diacritics), fluid display sizes.
  - Plain CSS, no framework: tokens, global primitives in `globals.css`, CSS
    Modules per component. New dependency: `lucide-react` (stroke icons).
    Inter comes through `next/font` with Cyrillic and Latin Extended subsets,
    so the build fetches it once from Google Fonts.
  - Data layer unchanged. Markup changes: labels hold only their text (hints
    and errors are linked by `aria-describedby`, no longer inside the label),
    the demo banner is a labelled `<aside>`, leg titles in offer cards take
    their heading level from where the list sits (`h2` / `h4`).
  - New message keys in all three locales: `common.demoBadge`, `nav.book`,
    `home.hero.badge`, `steps.completed`.
  - Checks: axe-core (WCAG 2.1 AA + best practice) finds no violations on the
    main pages, the search results and the passenger form with errors; focus
    rings are visible on links, fields and the pill switch; no horizontal
    scroll at 390 px. Lint, format, typecheck, 34 Vitest tests, build and the
    4 Playwright tests pass.
  - Fixed on the way: a visually hidden table header escaped the table's
    scroll box and widened the routes page on phones (`.table-scroll` is now
    `position: relative`).
  - Noted for Phase 11: the API's rate limiter (100 requests per IP per
    15 min) answers 429 without an error `code`, so the site shows "service
    cannot be reached". Repeated screenshot and E2E runs hit it locally.
- Phase 11 complete (built and rehearsed locally; going live needs a server,
  DNS and the GitHub settings listed in `infra/DEMO.md`).
  - [DECISION] With the owner: rehearse locally first; the admin panel is
    online but private (logins only in the server's `demo.env`); images are
    built by GitHub Actions and pushed to GHCR.
  - `infra/docker-compose.demo.yml` + `infra/Caddyfile.demo`: Caddy is the
    only service with ports. The site's `/api/*` goes straight to the API (one
    proxy hop, so `trust proxy 1` sees the visitor's IP; Caddy discards
    client-sent X-Forwarded-For). `/api/admin/*` answers only on the admin
    host. Mailpit sits behind Caddy basic auth. `X-Robots-Tag: noindex`
    everywhere. `PAYMENT_PROVIDER=mock` is forced in the Compose file, and
    each service gets only the variables it needs.
  - Nightly reset: `apps/api/scripts/demoReset.js` (`--daily`, 03:00 Kyiv)
    drops all tables (including SequelizeMeta/SequelizeData, because seeders
    are tracked and would otherwise be skipped), migrates, seeds, deletes the
    ticket PDFs, empties Mailpit and flushes Redis. It refuses to run without
    `DEMO_RESET_ENABLED=true`, which only the `reset` service sets.
  - Images: API Node 18 (EOL) → 22; web is the Next.js standalone server
    (`NEXT_OUTPUT=standalone`, only in Docker); admin is the CRA build
    served by Caddy, calling the API at the relative `/api/admin`.
  - `.github/workflows/deploy-demo.yml`: after CI succeeds on `main`, builds
    amd64 + arm64 images (`DEMO_PLATFORMS` narrows it), tags `latest` and the
    commit SHA, then deploys over SSH with a pinned host key. The deploy job
    is skipped until the `DEMO_HOST` variable exists.
  - Fixed: the rate limiter answered 429 without an error code, so the site
    said "service cannot be reached" and retried. It now returns
    `TOO_MANY_REQUESTS` in the public error shape (OpenAPI and web types
    updated, message in uk/cs/en), and the site doesn't retry it.
  - Fixed: the demo-user seeder accepted passwords over 32 characters, which
    the admin login form and API validation reject. It now refuses them.
  - Rehearsal with `*.localhost` hosts, all verified:
    - Routing: site, admin SPA, admin API 401 without a cookie, admin API 404
      on the site host, Mailpit 401 without or with a wrong password and 200
      with the right one, HTTP → HTTPS.
    - Spoofed X-Forwarded-For shares the caller's rate-limit bucket; the API
      logs the caller's IP, not Caddy's.
    - The 4 Playwright tests pass against https://demo.localhost
      (`E2E_BASE_URL`); bookings produce emails in Mailpit and PDFs.
    - The private admin login works; the reset empties PDFs, the inbox and the
      sessions; the scheduler waits until 03:00 Kyiv.
  - Checks: API 132 unit tests and 19 integration checks; web lint, format,
    typecheck, 34 unit tests and build.
  - Noted: Docker Desktop restarted once during the rehearsal (two MySQL
    stacks plus the 2 GB API image). The demo containers came back on their
    own (`restart: unless-stopped`); the dev stack had to be started again.
