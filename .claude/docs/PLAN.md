# Plan — Ukraine ⇄ Czech Republic bus booking (educational fork of the Busreisen API)

## Context
We are building an educational bus-ticket booking project from the Busreisen / "Benz Express" API.

**The existing API:**
- Express 4 + Sequelize on MySQL.
- Routes run between Ukraine and Germany.
- Payments go through LiqPay.
- Languages are uk, ru and de.

**What stays the same:** the operational flow is search → select → passengers + discounts → payment → callback → per-passenger PDF → email, plus the admin operations.

**What changes:**
- Routes run between Ukraine and Czechia, in both directions.
- The brand and the legal details on tickets and emails are fictional.
- A new **Next.js** frontend replaces the old jQuery site. It will be styled later from a reference design the user provides.

**Decisions:**
- **Payments:** mock provider behind a payment adapter. LiqPay is kept as a second adapter.
- **Admin:** fork and rebrand `back-dashboard`.
- **Locales:** uk, cs, en.
- **Repository:** new repo with clean git history.
- **Money:** UAH stays the stored truth and CZK replaces EUR as the display currency.
- **Hosting:** local Docker Compose plus a public demo.

**Findings that shape the plan** (from the code sweep):
1. **Prices in CZK would silently come out wrong.** PrivatBank's live feed has only EUR and USD, and `services/paymentService.js:18-31` returns rate `1` for any currency it can't find. Without a code change, CZK customers would pay roughly half price.
2. **A fresh database can't be built from git.** The seeders are gitignored (`.gitignore:15`) and were never committed. Migration `20250912130003` throws on an empty DB ("No languages found"). Several migrations, and `busFlights.js:556`, use MySQL-only SQL, so the project has to stay on MySQL.
3. **Germany is hardcoded in logic, not just data:**
   - The phone check accepts only `+380` and `+49` (`services/passengerService.js:216,233` and the pug forms).
   - The Dresden filter `customRoutesFilterMap` (`extra/index.js:3`).
   - The route sort keys `ZD/DZ/ZK/KZ` (`services/admin/ticketListService.js:537`).
   - The LiqPay language map (`api/routes/payment.js:165,208`).
   - City order inserted by German name in migration `20260621000001`.
4. **The old frontend expects HTML from the API.** It receives HTML fragments rendered with pug: the city dropdown, the passenger form, the info-check form and the payment widget (`mode=html`). A Next.js frontend needs JSON for every step, and it needs the session cookie (`busreisen-sess`) to work across origins.
5. **Inherited security issues:**
   - `POST /api/current-data` writes any key into the session, including `currencyExchangeRate`, so a client can lower the price it is charged (`api/routes/sessionData.js:137-141` → `payment.js:131`).
   - The language code from the URL ends up in a `require` path, which allows path traversal (`helpers/index.js:26`, `api/routes/translations.js:57`).
   - The full session, including passenger personal data, is written to `console.log`.
6. **PDFs and emails are always in Ukrainian with UAH prices**, whatever language the customer chose. The PDFs also print the real company's licence, EDRPOU code, addresses and phones (`languages/*/_ticket.js`, `views/full-ticket.pug:701`, `views/ticket-terms-of-use/*.pug`). All of these must become fictional.

---

## Progress (2026-10-31)
- Phases 0–9 are done. See `.claude/changelog/daily.md` for what each one changed.
- Where the work departed from the text below:
  - The mock payment endpoint is `POST /api/payment/mock/complete`.
  - Line 1 serves Ostrava – Olomouc – Hradec Králové – Praha.
  - The HTTP tests use `fetch`, not `supertest`.
  - Generating the API types moved to Phase 9.
- **Next:** Phase 10 waits for the design reference; Phase 11 (public demo)
  can start before it.

## Target layout (one monorepo, new repo)
```
<project>/
  apps/api      ← this backend (copied with git clone, so untracked files stay behind)
  apps/admin    ← fork of back-dashboard
  apps/web      ← new Next.js + TypeScript app
  infra/        ← docker-compose.dev.yml, docker-compose.demo.yml, Caddyfile
  .claude/      ← context layer rewritten for this project (docs + changelog)
```
The project name and brand are still open. They are only needed by Phase 5.

---

## Phase 0 — Set up the new repository
1. `git clone` both repos (API and admin) into the monorepo folders, then delete their `.git` folders. Cloning means none of the untracked files come along:
   - `.env`, `.env.development.local`
   - `scripts/booking-*.json` (a real customer booking)
   - `test.html`, `graphify-out/`, `.playwright-mcp/`
2. Remove what only makes sense for production:
   - `DEPLOY-PRODUCTION.md`, `OPS-COMMANDS.md`, `CHILDREN_TABLE_MIGRATION_PLAN.md`
   - `scripts/recover-orphan-ticket.js`, `bin/ci-deploy.sh`
   - `api/index-base.js` (dead copy of the app setup)
   - `config/constants.js` locale and currency lists (never imported)
   - The incident entries in `.claude/docs/05-issues.md` and the old changelog
3. Make one initial commit, then work on a `dev` branch with Conventional Commits.

**Check:** run `git log` (one commit) and search the repo for real secrets, IPs and personal data (e.g. `185.65.`, `+38 044`, `33741502`). All searches must come back empty or show only lines you are about to replace.

## Phase 1 — The backend boots on an empty database
1. **Database:** use MySQL only. Set `.env.example` to `DB_DIALECT=mysql`, port 3306.
2. **Migrations:** replace the 57 old migrations with **one baseline migration**.
   - Generate it from the schema after running the old chain on a scratch MySQL: tables, foreign keys, and the `passengerRowCount` triggers.
   - Drop the one-off fixes that only applied to production data (`fix-de-payment`, the price recalculations, the children JSON migration, the deduplication).
   - Put the `ticketmeta` rows into a migration, and put the language rows into an earlier migration so nothing fails on an empty DB.
   - This is safe because the new repo has no production database to stay compatible with.
3. **Seeders:** remove `/database/seeders` from `.gitignore`. Write fresh seeders (Phase 6); the old ones are full of production-specific changes.
4. **Local stack:** `infra/docker-compose.dev.yml` runs the API, MySQL 8 (with the `--log-bin-trust-function-creators` flag from the staging compose), Redis and **Mailpit** (a fake SMTP server with a web inbox). Reuse the existing `Dockerfile`, which already includes Chromium and the fonts for PDFs.
5. **Children migration:** confirm that every code path reads children from the `passengerticket` table, not from `ticket.children`. Delete what is left of the JSON path and the column in the baseline.

**Check:** `docker compose up`, then `npm run migrate && npm run seed`, then `GET /api/cities?languageCode=uk_UA&mode=json` returns cities.

## Phase 2 — Move country-specific rules into one config (backend)
1. **New file `config/market.js`:**
   - Home currency `UAH`.
   - Countries `UA` and `CZ`, each with its display currency (UAH / CZK) and phone prefix (`+380`, `+420`).
   - The locale map (uk_UA, cs_CZ, en_US) and the payment-provider language map.
   - Services read from this file instead of having literals in code.
2. **Exchange-rate adapter `services/exchangeRates/`:**
   - An interface `getRate(currency) → number` that **throws** when a rate is missing.
   - `NbuRateProvider`, using `bank.gov.ua/NBUStatService/v1/statdirectory/exchange?valcode=CZK&json`, which includes CZK. Cache the rate once per day in Redis.
   - `FixedRateProvider` for tests and offline use.
   - Replace `getCurrencyExchangeRate` in `paymentService.js` and update its callers (`busFlights.js:361,807`, `ticketService.js`).
3. **Phone validation:** in `passengerService.js:216,233`, build the regexes from `market.js`. The pug forms are retired in Phase 7.
4. **Remove the Germany-only filters:** delete `customRoutesFilterMap` and its four call sites. Turn `CUSTOM_SORT_ROUTE_KEYS` into config, or drop it.

**Check:** unit tests for the rate provider (cache hit; error on a missing rate) and for phone validation (accepts +380 and +420, rejects +49).

## Phase 3 — Payment adapter + mock provider (backend)
1. **Interface** in `services/payments/`:
   - `createCheckout(order) → { checkoutUrl | formData }`
   - `verifyCallback({data, signature}) → { orderId, status, transactionId, amount, currency }`
2. **`LiqPayProvider`:** move the existing signing code (`paymentService.js`, `middlewares/paymentMiddlewares.js`, `payment.js`) into it unchanged.
3. **`MockPaymentProvider`:**
   - It signs `{data, signature}` in the same shape with a `MOCK_PAYMENT_SECRET` (HMAC). This means `getSessionData`, `getOrCreateTicket` and `ensureTicketPDFAndSendEmail` stay exactly as they are and simply receive the normalized result.
   - **Endpoints:**
     - `POST /api/payment` returns `{ provider, checkoutUrl }` as JSON instead of the pug widget.
     - `POST /api/payment/mock/:orderId/complete {outcome: success|failure}` builds the signed payload and runs the same handler as the callback. The 30-second wait is skipped for the mock.
3. Choose the provider with `PAYMENT_PROVIDER=mock|liqpay`, validated when the app starts. Keep the idempotency check on `transaction_id` and the de-duplication of admin alerts.

**Check:** an integration test that books → pays with the mock → finds exactly one ticket, N passengers and N PDFs, and finds that a second completion call is a no-op.

## Phase 4 — Locales uk / cs / en (backend)
1. **Text files:**
   - Add `languages/cs_CZ/*` and `languages/en_US/*` (13 files each).
   - Add `views/ticket-terms-of-use/{cs_CZ,en_US}.pug`.
   - Delete `ru_RU` and `de_DE`.
2. **Database:** language rows for uk_UA (keep id 1, because code falls back to id 1), cs_CZ and en_US, plus `ticketmetaattributes` for all three.
3. **Path traversal:** in `helpers/index.js:25` and `api/routes/translations.js:57`, check the language code against the list in `market.js` before any `require` or `readdirSync`.
4. **PDF and email language:**
   - `ticketPdfService.js:35,586,620` and `services/ticketPdfService.js:173-194` take the booking's `languageCode`. The info is already stored in the payment request.
   - Prices are still printed in UAH, which matches what was charged.
   - This is a small behavior change, made because Czech customers would otherwise get Ukrainian tickets.

**Check:** a test booking in cs_CZ gets a Czech PDF and email in Mailpit, and Czech text renders without missing characters.

## Phase 5 — New brand, fictional legal details, security fixes (backend)
1. **Brand:** replace "Benz Express" and `busreisen` in:
   - The cookie name (`config/app.config.js:47`) and Redis prefix (`api/index.js:114`).
   - The Swagger title and the PM2 name.
   - The logo (`assets/images/`, `services/ticketService.js:225`) and the download file names (`api/routes/tickets.js:342-361`, `services/ticketPdfService.js:169`).
   - The email texts (`languages/*/_mail.js`, `payment.js:361`, `mailService.js:174`) and the QR code / PDF colours.
2. **Legal details:** replace the licence, EDRPOU code, addresses, phones and insurer with obviously fictional values, and add an "Educational demo — not a real carrier" line on PDFs and emails.
3. **Security fixes:**
   - `POST /api/current-data`: allow only an explicit list of keys. The price and the exchange rate are always recalculated on the server when payment starts.
   - Remove the `console.log` calls that print sessions or personal data (`payment.js:172,213`, `passengers.js:178,262`) and use the Winston logger with IDs only.
   - Remove the debug log in `busFlights.js:~868`.

**Check:** searching for `Benz|Бенс|busreisen|586965|33741502` returns nothing, and every test still passes.

## Phase 6 — Reference data for Ukraine ⇄ Czechia (seeders)
1. **Countries:** UA and CZ. **Currencies:** UAH (id 1) and CZK.
2. **Cities and stops (illustrative)**, each with names in uk, cs and en (cities without a name in the requested language are hidden, `cities.js:149`):
   - **Ukraine:** Kyiv, Zhytomyr, Rivne, Lviv, Ternopil, Uzhhorod, Mukachevo.
   - **Czechia:** Praha (Florenc), Brno (Zvonařka), Ostrava, Olomouc, Hradec Králové, Plzeň.
3. **Routes:**
   - **Line 1:** Kyiv – Zhytomyr – Rivne – Lviv ⇄ Ostrava – Olomouc – Brno – Praha
   - **Line 2:** Uzhhorod – Mukachevo ⇄ Brno – Praha – Plzeň
   - Each line has both directions, so there are 4 routes, plus their `routecityorders`.
4. **Prices:** a price matrix in UAH and CZK for every city pair. Discounts copy the current children / student / senior / seasonal set, with new texts.
5. **Bus flights:** a seeder that generates **dates relative to today** (daily for the next 90 days), so the demo always has flights.
6. **Admin user:** a demo admin and manager, with passwords from env and never committed.

**Check:** a search for Kyiv → Praha and for Praha → Lviv returns priced flights in UAH and CZK.

## Phase 7 — API contract for the Next.js frontend, tests and CI (backend)
1. Make sure every step the frontend uses has a JSON mode: cities, passengers / discounts, `validate`, `current-data`, payment, ticket download. Add JSON where only pug HTML exists (`passengers-form.pug`, `info-check-form.pug`, `cities-dropdown.pug`, `payment-widget.pug`). After that, delete the frontend pug views. Keep the PDF templates.
2. Document the public endpoints with the existing **swagger-jsdoc** setup. Generate TypeScript types for `apps/web` with `openapi-typescript`.
3. **Cookies:** the frontend calls `/api/*` through **Next.js rewrites** to the API, so the session cookie is first-party and `SameSite` / cross-origin problems don't arise. Add CORS entries only for the admin panel.
4. **Tests** (plain `node --test`; add `supertest` for HTTP tests):
   - Price calculation: `calcBusFlightPrice` and the per-passenger NET/GROSS split.
   - The exchange-rate provider and the mock payment verification.
   - The booking flow from start to finish against the compose MySQL.
   - Rewrite the existing `ticketListService.test.js` cases for the new route keys.
5. **CI:** a GitHub Actions workflow that runs lint, `format:check` and `npm test` for the API, then lint, typecheck and build for `apps/web` and `apps/admin`. The current CI never runs `npm test`.

## Phase 8 — Admin panel (fork of `back-dashboard`)
1. Set the API base URL from env, and rename the title, logo and `package.json` name.
2. Replace EUR / DE with CZK / CZ in the currency pickers and phone inputs (`react-phone-number-input` country list: UA, CZ). Replace the ru/de interface texts with uk/cs/en if the admin has i18n; otherwise keep it Ukrainian-only.
3. Go through the screens for flights, routes, discounts, tickets and the ticket PDF against the new seed data.

**Check:** log in as the demo admin, create a flight with a discount, see a booking made through the web app, and download its PDF.

## Phase 9 — Next.js frontend: working version (before the reference design)
Scope agreed on 2026-10-31. The site's **page and section structure follows
busreisen.com.ua** (the real carrier this project forked from), **structure
only**: every text, contact detail and photo is our own and fictional, in
uk/cs/en. The visual design still comes from the reference provided in Phase 10.

1. **API additions (backend, with OpenAPI schemas and tests):**
   - `GET /api/network?languageCode=`: lines → directions → stops (city, place,
     time), the operating weekdays derived from the actual flights, and the
     fares for every city pair in UAH and CZK. One small, cacheable response
     that the routes, schedule, fares and popular-destination views are all
     built from, so nothing is duplicated in the frontend.
   - `GET /api/discounts?languageCode=`: public discount names, groups,
     percentages and age limits (for the fares page).
   - **Seed change:** flights run on set weekdays instead of daily, so the
     schedule, routes and booking calendar show real gaps. For example, line 1
     leaves Ukraine Tue/Thu/Sat and Czechia Wed/Fri/Sun, and line 2 runs on
     other days.
2. **Stack:**
   - `apps/web`: Next.js App Router + TypeScript.
   - `next-intl` with `/[locale]` routes for uk, cs and en.
   - Next.js rewrites send `/api/*` to the API, so the session cookie is
     same-origin.
   - TanStack Query for data; react-hook-form + zod for forms (phone rules
     mirror `market.js`).
   - Types generated from `apps/api/openapi.json`, plus a typed client in
     `src/lib/api/`. API error `code`s map to translated messages.
3. **Site pages** (deliberately unstyled; the look comes in Phase 10):
   - **Header:** Home, Routes, Schedule, Fares, Rules, Contacts, and a
     uk/cs/en switch. Every page shows the "educational demo, not a real
     carrier" banner. **Footer:** navigation, contacts and the public-offer
     (rules) link. No newsletter.
   - **Home**, in this order:
     1. Hero: headline, intro, phones, and the booking form (from/to grouped
        by country, one-way/return/open date with a bookable-dates calendar,
        passengers).
     2. Our advantages: amenity tiles.
     3. Our fleet: bus cards with photo, model, year, Euro class, seats and
        amenities.
     4. Popular destinations: city-pair cards with duration, price "from" and
        a photo. The pairs are chosen in web config; prices and durations come
        from `/api/network`.
     5. About the company, with "read more": why choose us, how to book,
        border-crossing tips, about Czechia.
     - No reviews section.
   - **`/routes`:** a table of city pairs with one-way/round-trip price and
     operating days from each side. Filters for departure city, arrival city
     and weekday. A row opens the search with the pair filled in.
   - **`/schedule`:** a line selector, then one table per direction: city,
     stop, departure days/time, arrival days/time, and a border-delay note.
   - **`/fares`:** a line selector, then a price grid per direction
     (destinations × origins, one-way/round trip) in the origin country's
     currency (UAH from Ukraine, CZK from Czechia), then the discounts table.
   - **`/rules`:** a table of contents plus numbered sections (general,
     carrier duties, passenger duties, passenger rights, prohibited, tickets,
     refunds with a fee table). The refund and baggage terms match the terms
     printed on the PDF tickets.
   - **`/contacts`:** cards for fictional UA (+380) and CZ (+420) phones with
     live Kyiv/Prague clocks, and the office with hours and an open/closed
     indicator. No bank details.
   - **Attributions:** the photo credits page.
4. **Booking flow:** search results with the nearest-date alternatives and
   choosing the return leg, passengers (one form per passenger, discount
   picker, promo-flight warning), review, the mock payment page (Pay /
   Decline), success (summary + PDF/ZIP download), and failed. A session
   countdown (15 min) offers to restart the search.
5. **Images:** free-licensed photos of the buses and cities (Wikimedia
   Commons / Unsplash), credited on the attributions page.
6. **Checks:**
   - A Playwright E2E of the full booking in uk and cs, run **locally only**
     against the compose stack (decided 2026-10-31: not in CI).
   - CI gets a `web` job: lint, typecheck and build.

## Phase 10 — Apply the reference design (after the user provides it)
1. Pull the design tokens (colours, type, spacing, breakpoints) into a theme, then build the shared components (search form, flight card, calendar, passenger form, stepper).
2. Restyle each page from Phase 9 without changing the data layer. Check every page on mobile and desktop, and check accessibility (labels, focus, contrast).
3. Use Playwright screenshots to compare against the reference.

## Phase 11 — Public demo
1. **One small VPS** running `infra/docker-compose.demo.yml` with Caddy (the same pattern as today's `docker-compose.staging.yml` and `Caddyfile`). It serves:
   - `demo.<domain>` → web, which proxies `/api` to the API
   - `admin.<domain>` → admin static build
   - the API internally only
   - Mailpit behind basic auth
   - The API needs Chromium for the PDFs, so serverless hosting such as Vercel doesn't fit the API.
2. **Demo safeguards:**
   - `PAYMENT_PROVIDER=mock` is forced.
   - Emails are captured by Mailpit and never delivered, so the site can't be used to send email to strangers. The success page offers the PDF download directly.
   - A banner on every page and the existing rate limit.
   - A nightly job that resets and re-seeds the database.
3. Deploy with GitHub Actions on pushes to `main`: build the images, then pull and restart over SSH.

## Phase 12 — Context layer of the new project
Rewrite `.claude/CLAUDE.md` and `docs/01-05` for the new project: the monorepo, the market config, the payment and exchange-rate adapters, and the seed data. Start a fresh changelog.

---

## Critical files (backend)
- **Money:** `services/paymentService.js`, `api/routes/payment.js`, `middlewares/paymentMiddlewares.js`, `services/ticketService.js`
- **Booking flow:** `api/routes/busFlights.js`, `services/busFlightService.js`, `services/passengerService.js`, `api/routes/sessionData.js`, `api/routes/tickets.js`
- **Country and language:** `helpers/index.js`, `api/routes/translations.js`, `extra/index.js`, `services/admin/ticketListService.js`, `services/admin/ticketPdfService.js`, `services/ticketPdfService.js`, `services/mailService.js`
- **Texts and templates:** `languages/*`, `views/full-ticket.pug`, `views/ticket-terms-of-use/*`
- **Database and infra:** `database/migrations/*` (→ baseline), `database/seeders/*` (new), `.gitignore`, `Dockerfile`, `docker-compose.staging.yml` → `infra/`

## Verification (end to end)
1. `docker compose -f infra/docker-compose.dev.yml up`, then migrate and seed. API, web, admin and Mailpit all start.
2. `npm test` (API) and `npm run lint && npm run typecheck && npm run build` (web, admin) pass in CI.
3. **Manual run in Czech:** search Praha → Kyiv, pick a flight, enter 2 adults and 1 child with +420 phones, pay with the mock. Then check:
   - One ticket and 3 passenger rows in the DB, with the price stored in UAH.
   - Czech PDFs and the email in Mailpit, on fictional branding.
   - The PDF / ZIP downloads from the success page.
4. **Mock decline:** the failed page appears, no ticket is created, and seats are unchanged.
5. **Safety checks:**
   - Calling the mock completion twice creates no duplicate ticket.
   - `POST /current-data {currencyExchangeRate: 0.01}` has no effect on the amount charged.
   - `GET /api/translations?languageCode=../../x` is rejected.
6. The Playwright E2E test passes in uk and cs, and the admin shows the booking.
