# Data Model — Busreisen API

> Updated: 2026-06-28

## Overview

25 Sequelize models, 47 migrations. PostgreSQL or MySQL (dialect set by `DB_DIALECT`).
Localized entities follow the main-table + `*attributes` join-table pattern (see `03-architecture.md`).

## Core Models

### `ticket`

Central booking record.

| Column               | Type            | Notes                                                                                                                                  |
| -------------------- | --------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `id`                 | int auto        | PK                                                                                                                                     |
| `ticketNumber`       | string          | Human-readable booking ref                                                                                                             |
| `dateOfDeparture`    | date            |                                                                                                                                        |
| `dateOfReturn`       | date            | Round-trip return date                                                                                                                 |
| `dateOfCreature`     | date            | Creation timestamp                                                                                                                     |
| `busFlightFromId`    | FK → busflight  | Outbound flight                                                                                                                        |
| `busFlightToId`      | FK → busflight  | Return flight (null if one-way)                                                                                                        |
| `originCityId`       | FK → city       |                                                                                                                                        |
| `destinationCityId`  | FK → city       |                                                                                                                                        |
| `price`              | decimal         | Total price                                                                                                                            |
| `currencyAbbr`       | string          | e.g., `UAH`                                                                                                                            |
| `statusId`           | FK → ticketmeta | ticket_status meta key                                                                                                                 |
| `typeId`             | FK → ticketmeta | ticket_type meta key                                                                                                                   |
| `transactionId`      | string          | LiqPay transaction ID                                                                                                                  |
| `signature`          | string          | LiqPay signature                                                                                                                       |
| `pdfFileName`        | string          | Current PDF file                                                                                                                       |
| `prevPDFFileName`    | string          | Previous PDF (before re-generation)                                                                                                    |
| `hasDiscount`        | boolean         | `1` only when the booked busFlight has a `group='bus-flights'` discount. Stays `0` for passenger-type discounts (student, child, etc.) |
| `discountPercentage` | float(3,1)      | BUS_FLIGHT discount % (e.g., `15`). Set from `busFlight.discount.coef * 100`. `0` when no flight-level discount                        |
| `passengerRowCount`  | int             | **Cached count** of all passengers (adults + children) — maintained by DB trigger; used for O(1) pagination                            |

**Associations:** `belongsTo` BusFlight (x2), City (x2), TicketMeta (x2); `belongsToMany` Passenger; `hasMany` PassengerTicket

### `passenger`

Individual traveller.

| Column        | Type     | Notes                                                     |
| ------------- | -------- | --------------------------------------------------------- |
| `id`          | int auto | PK                                                        |
| `name`        | string   |                                                           |
| `lastName`    | string   |                                                           |
| `phone`       | string   | nullable (children may not have phone)                    |
| `email`       | string   |                                                           |
| `dateOfBirth` | date     |                                                           |
| `type`        | enum     | **NEW:** `adult` \| `child` — added in children migration |

**Associations:** `belongsToMany` Ticket (via `passengerticket`); `hasMany` PassengerTicket

### `passengerticket`

Join table between Passenger ↔ Ticket, with per-passenger booking data.

| Column                | Type            | Notes                                                                                                                                     |
| --------------------- | --------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `id`                  | int auto        | PK                                                                                                                                        |
| `ticketId`            | FK → ticket     |                                                                                                                                           |
| `passengerId`         | FK → passenger  |                                                                                                                                           |
| `agentId`             | FK → agent      | nullable                                                                                                                                  |
| `passengerDiscountId` | FK → discount   | nullable                                                                                                                                  |
| `discountPercentage`  | decimal         | **NEW:** explicit discount override (used for children)                                                                                   |
| `busSeat`             | string          | Seat number                                                                                                                               |
| `note`                | text            |                                                                                                                                           |
| `price`               | int             | Per-passenger NET price (booking currency). Σ over a ticket = `ticket.price`                                                              |
| `priceUAH`            | int             | Per-passenger NET price in UAH — the **stored truth** for money                                                                           |
| `paymentAtOffice`     | varchar         | GROSS pre-discount fare (booking currency). **Not** boolean — holds an amount; for legacy DE-origin rows historically held the EUR figure |
| `paymentOnBus`        | varchar         | GROSS pre-discount fare when paid on the bus (booking currency)                                                                           |
| `paymentAtOfficeUAH`  | int             | `paymentAtOffice` as the stored-truth UAH fare = `ROUND(priceUAH / mult)`                                                                 |
| `paymentOnBusUAH`     | int             | `paymentOnBus` as the stored-truth UAH fare                                                                                               |
| `confirmationId`      | FK → ticketmeta | confirmation status (pending/confirmed/etc.)                                                                                              |
| `PDFFileName`         | string          | Per-passenger PDF                                                                                                                         |

> **Pricing model (dual-currency).** UAH is the stored truth: `priceUAH` / `paymentAtOfficeUAH` / `paymentOnBusUAH` are exact (admin works in UAH); the booking-currency columns are derived `÷ exchangeRate`. `paymentAtOffice` is the **GROSS pre-discount fare** and `price` is the **NET** paid: `price = (paymentAtOffice + paymentOnBus) × (1 − discount)`, so with a discount `paymentAtOffice > price`. `mult = 1 − (ticket.discountPercentage/100 OR discounts.coef)` (ticket-level discount wins). PDFs **always** render UAH (`priceUAH ?? price`, currency hardcoded `"UAH"`). On edit the API resolves UAH via `resolveUahTruth` (UAH field wins; legacy booking value only used as `× rate` fallback) — with both representations grossed to the fare, edits are idempotent. **Reality:** every prod ticket is `currencyAbbr="UAH"` with `price` in UAH (LiqPay always charges UAH); "EUR" only ever lived in the legacy booking columns for DE-origin (countryId=2) tickets (~1781). See changelog 2026-06-28.

### `busflight`

A specific departure of a bus on a route.

| Column            | Type         | Notes                                    |
| ----------------- | ------------ | ---------------------------------------- |
| `id`              | int auto     | PK                                       |
| `routeId`         | FK → route   |                                          |
| `dateOfDeparture` | datetime     |                                          |
| `allSeats`        | int unsigned | Total capacity                           |
| `freeSeats`       | int unsigned | Available seats (decremented on booking) |

**Associations:** `belongsTo` Route; `hasMany` Ticket (as From/To)

### `ticketmeta`

Replaces hard-coded enums for ticket statuses and types. Added Sep 2025.

| Column      | Type          | Notes                                                   |
| ----------- | ------------- | ------------------------------------------------------- |
| `id`        | int           | PK                                                      |
| `meta_key`  | string unique | e.g., `status_pending`, `type_one_way`                  |
| `meta_type` | enum          | `ticket_status` \| `ticket_type` \| `confirmation_type` |
| `is_active` | boolean       |                                                         |

**Associations:** `hasMany` Ticket (statusId/typeId), PassengerTicket (confirmationId), TicketMetaAttributes

Use `ticketMetaService` to look up IDs — never hard-code them.

### `user`

Admin panel users.

| Column           | Type          | Notes                             |
| ---------------- | ------------- | --------------------------------- |
| `id`             | int           | PK                                |
| `name`           | string        |                                   |
| `email`          | string unique |                                   |
| `password`       | string        | bcrypt hash                       |
| `phone`          | string        |                                   |
| `dateOfBirth`    | date          |                                   |
| `role`           | enum          | `admin` \| `manager` \| `user`    |
| `isActivated`    | boolean       | Email confirmation required       |
| `isBlocked`      | boolean       |                                   |
| `activationLink` | string        | UUID token for email confirmation |

**Associations:** `hasMany` Token

### `token`

JWT refresh tokens — one per device session.

| Column              | Type      | Notes                                     |
| ------------------- | --------- | ----------------------------------------- |
| `userId`            | FK → user |                                           |
| `refreshToken`      | string    |                                           |
| `deviceFingerprint` | string    | Bound to device via `express-fingerprint` |

### Other models (summary)

| Model             | Purpose                                                           |
| ----------------- | ----------------------------------------------------------------- |
| `city`            | City with country + currency; localized via `cityattributes`      |
| `country`         | Country; localized via `countryattributes`                        |
| `currency`        | Currency (abbr); referenced by city + busflightprices             |
| `route`           | Named bus route (routePath JSON); localized via `routeattributes` |
| `busflightprices` | Price matrix between city pairs per currency                      |
| `discount`        | Discount record — see full schema below                           |
| `place`           | Pickup/dropoff point in a city; localized via `placeattributes`   |
| `agent`           | Booking agent; localized via `agentattributes`                    |
| `language`        | Locale (id, code: uk_UA / ru_RU / de_DE)                          |
| `session`         | Express session storage (`sid`, `expires`, `data` JSON)           |

### `discount`

Discount rows that apply to either a specific busFlight or to passenger categories.

| Column              | Type           | Notes                                                                |
| ------------------- | -------------- | -------------------------------------------------------------------- |
| `id`                | int auto       | PK                                                                   |
| `coef`              | float(3,2)     | Discount coefficient 0–1 (e.g., 0.15 = 15% off)                      |
| `group`             | enum           | `adults` \| `children` \| `both` \| `bus-flights` \| `discount-card` |
| `busFlightId`       | FK → busflight | nullable — if set, discount applies to that specific flight only     |
| `inactivePeriod`    | string(11)     | Date range when discount is inactive: `"MM-DD\|MM-DD"`               |
| `minAge` / `maxAge` | int            | Age filter for child/senior discounts                                |
| `order`             | int            | Sort priority (default 500)                                          |

**Two discount flows:**

- **BUS_FLIGHT discount** (`group='bus-flights'`, `busFlightId=N`): Applied at the busFlight level by `busFlightService.calcBusFlightPrice()`. Result stored in `ticket.hasDiscount=1` and `ticket.discountPercentage`. Personal passenger discounts are BLOCKED when a BUS_FLIGHT discount is active (enforced in UI with warning).
- **Passenger discount** (`group='adults'|'children'|'discount-card'`, `busFlightId=null`): Shown as dropdown in passenger form. Result stored in `passengerticket.passengerDiscountId` FK. `ticket.hasDiscount` stays 0. Multiple passenger-type discounts exist (e.g., id=5 = student 10%).

**Creating BUS_FLIGHT discounts:**
Via admin API: `POST /api/admin/bus-flights` with `discount` field (integer %) auto-creates the discount row. Or direct DB insert: `INSERT INTO discounts (coef, group, busFlightId, order) VALUES (0.15, 'bus-flights', {bfId}, 500)`.

**Admin route:** `GET /api/admin/discounts` (read-only list).

## Migration History (Key Milestones)

| Date                    | Change                                                                                                                                       |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| 2023-11-10              | Initial schema: countries, cities, currencies, languages, routes, users, tokens, flights, prices, discounts, passengers, tickets, attributes |
| 2024-01-05              | Sessions table                                                                                                                               |
| 2024-04-16              | `busflight` seat columns → INTEGER UNSIGNED                                                                                                  |
| 2024-04-30 – 2024-06-04 | Ticket PDF columns (`pdfFileName`, `prevPDFFileName`, `transactionId`, `dateOfCreature`)                                                     |
| 2024-06-05              | `user.isBlocked`                                                                                                                             |
| 2024-10-07              | `ticket.ticketNumber`; `passengerticket` enum columns (confirmation, paymentAtOffice, paymentOnBus, busSeat, note)                           |
| 2024-10-09              | `agent` + `agentattributes` tables                                                                                                           |
| 2024-10-10              | `passengerticket.agentId` FK                                                                                                                 |
| 2025-09-12              | `ticketmeta` + `ticketmetaattributes` tables — replace hard-coded enums                                                                      |
| 2026-02-22              | Remove `phone` unique constraint (children can share/omit phone)                                                                             |
| 2026-03-03              | `passengerticket.PDFFileName` (per-passenger PDFs)                                                                                           |
| 2026-06-17              | `passengerticket.price` + recalc (distribute `ticket.price` across passengers; never overwrite `ticket.price`)                               |
| 2026-06-26 (0001)       | `passengerticket.priceUAH` + backfill (UAH stored-truth for net price)                                                                       |
| 2026-06-26 (0002)       | `passengerticket.paymentAtOfficeUAH` / `paymentOnBusUAH` INT columns                                                                         |
| 2026-06-26 (0003)       | Fix DE-origin payment UAH columns (`= priceUAH` where the column held euros)                                                                 |
| 2026-06-26 (0004)       | Gross UAH payment columns to the pre-discount fare (`= ROUND(priceUAH / mult)`)                                                              |
| 2026-06-26 (0005)       | Gross booking-currency `paymentAtOffice`/`paymentOnBus` to the fare — makes admin edits idempotent                                           |

## Pending: Children Table Migration

See [CHILDREN_TABLE_MIGRATION_PLAN.md](../../CHILDREN_TABLE_MIGRATION_PLAN.md) — 662-line plan.

**Current state:** Child passengers stored as JSON blob in `ticket.children`.
**Target state:** Children as `passenger` rows (`type = 'child'`) joined via `passengerticket`, same as adults.

Migrations for `passenger.type`, `passengerticket.discountPercentage`, and `ticket.passengerRowCount` have been added (visible in migrations list). The code-side changes across 12 service files are **not yet complete**.

**Two DB triggers required:** keep `ticket.passengerRowCount` in sync on INSERT/DELETE to `passengerticket`.

Do not build new features that read `ticket.children` JSON — use the relational path.
