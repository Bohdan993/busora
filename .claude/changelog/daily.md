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
