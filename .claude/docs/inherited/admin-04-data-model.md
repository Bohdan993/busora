# 04 — Data Model & API

> Updated: 2026-06-07

This documents the **client-side view** of the data (TypeScript types in
[src/types/](../../src/types/)) and the API endpoints consumed via RTK Query
([src/services/](../../src/services/)). The authoritative schema lives in the
backend (`bus-back`), not here.

## API response envelope ([src/types/apiResponse.ts](../../src/types/apiResponse.ts))
Every endpoint returns:
```ts
type ApiResponse<T = void> = {
  status: string;
  data?: T;
  meta?: { totalRowCount?: number; startPage?: number; timestamp?: string };
};
```
`meta.totalRowCount` drives server-side table pagination.

Base URL: `https://localhost:5000/api/admin` (see `01-infrastructure.md`).

## Domain entities
Types live in `src/types/<domain>.ts`; each has a matching `src/services/<domain>.ts`
RTK Query file. Key entities:

| Entity | Type file | Notes |
|---|---|---|
| **Ticket** | `tickets.ts` | A booking. Has adult + child passengers, options, attributes. PK `ticketId`. |
| **Passenger** | `passengers.ts` | `PassengerTicket` / `ChildTicket`; passengers link to tickets. PK `passengerId`. |
| **BusFlight (рейс)** | `busFlights.ts` | A scheduled trip. PK `busFlightId` / `id`. |
| **City** | `cities.ts` | Reference data for routes/flights. |
| **Currency** | `currencies.ts` | Reference data for pricing. |
| **Discount** | `discounts.ts` | Reference data for ticket pricing. |
| **Route** | `routes.ts` | Reference data. |
| **User** | `users.ts` | Admin account; `isActivated` gates domain access. |
| **Auth** | `auth.ts` | `AuthRequest` (login/register), `AuthResponse` (`accessToken`, `user`). |
| (crypto_order) | `crypto_order.ts` | Template demo only — not domain. |

## Endpoints by service

### `auth.ts` (`/auth/*`)
- `register` (POST `/auth/register`)
- `login` (POST `/auth/login`)
- `logout` (GET `/auth/logout`)
- `checkAuth` — raw `fetch` to `/auth/refresh` with `credentials: include`
  (used on boot; bypasses RTK Query baseQuery to read the refresh cookie)

### `ticket.ts` (`/tickets/*`, tag type `Ticket`)
- `getTickets` (server-side list: `start,size,filters,filtersFns,sorting`)
- `getTicket` `/tickets/:id`
- `getTicketAttributes` `/tickets/attributes` (`keepUnusedDataFor: 3600` — rarely changes)
- `createTicket` (POST) · `updateTicket` (PUT) · `deleteTicket` (DELETE)
- `addTicketPassenger` (POST `/tickets/passengers`) · `deleteTicketPassenger` (DELETE)
- `generateTicket` (POST `/tickets/generate-pdf`)
- `sendTicket` (POST `/tickets/send-pdf` — emails the PDF)
- `searchTickets` (GET `/search/tickets`)
- `downloadTicket` — **uses axios `$api`** (blob), not RTK Query baseQuery;
  triggers a browser download of the PDF

### `busFlight.ts` (`/bus-flights/*`)
- `getBusFlights` (server-side list) · `getBusFlight` `/:id`
- `searchBusFlights` (GET `/search/bus-flights`)
- `createBusFlight` (POST) · `updateBusFlight` (PUT) · `deleteBusFlight` (DELETE)

### `passenger.ts` (`/passengers/*`)
- `getPassengers` (server-side list) · `getPassenger` `/:id`
- `createPassenger` (POST) · `updatePassenger` (PUT) · `deletePassenger` (DELETE)
- `addPassengerTicket` / `deletePassengerTicket` (passenger↔ticket linking)
- `searchPassengers` (GET `/search/passengers`)
- (No passenger route/sidebar entry — guards are scaffolded but commented out
  in `router.tsx`. The API is used indirectly from the Tickets flow.)

### Reference-data services (read-only, simple `void` queries)
- `cities.ts` → `getCities` (`/cities`)
- `currencies.ts` → `getCurrencies` (`/currencies`)
- `discounts.ts` → `getDiscounts` (`/discounts`)
- `routes.ts` → `getRoutes` (`/routes`)

These feed dropdowns/autocompletes in the Ticket and BusFlight forms.

## Conventions when adding endpoints
- Add to the relevant `src/services/<domain>.ts` via `injectEndpoints`.
- Register a tag type with `enhanceEndpoints({ addTagTypes: [...] })` and wire
  `providesTags` / `invalidatesTags` so the cache stays consistent.
- Type request/response with `ApiResponse<T>` and a type from `src/types/`.
- For **binary responses** (PDF/CSV/blob), use the axios `$api` channel inside
  a `queryFn` (see `downloadTicket`), not the default `fetchBaseQuery`.
