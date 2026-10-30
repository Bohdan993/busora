# 03 — Architecture

> Updated: 2026-06-07

## Folder layout (`src/`)
```
src/
  index.tsx          App bootstrap + provider tree
  App.tsx            Auth-on-boot, route rendering, theme/localization wrappers
  router.tsx         react-router 6 route table (lazy-loaded pages)
  http/index.ts      axios instance ($api) + reauth interceptors (PDF/blob channel)
  store/             Redux store (configureStore) + typed hooks
  slices/            Redux slices: userSlice (auth), appSlice (loading/fullscreen)
  services/          RTK Query API: index.ts (mainApi) + one file per domain
  types/             Shared TypeScript types, one file per domain
  contexts/          SidebarContext (sidebar open/close, non-Redux UI state)
  hoc/               Route guards: withAuthentication, withIsAccountActivated
  helpers/           hooks, validators, jsPDF font, misc utilities
  layouts/           BaseLayout (public) and SidebarLayout (authenticated shell)
  components/         Reusable presentational/widget components
  content/           Page-level features:
    dashboards/      Tickets, BusFlights (REAL domain), Crypto (template demo)
    applications/    Messenger, Transactions, Users (template demo)
    pages/           Login, Registration, Components showcase, Status pages
    home/            Landing/home
  theme/             MUI theme (ThemeProvider, base.ts, schemes/PureLightTheme)
```

## Provider tree (`src/index.tsx`)
```
HelmetProvider
  └ SidebarProvider            (context: sidebar toggle)
     └ BrowserRouter
        └ Redux <Provider store>
           └ App
              └ ErrorBoundary
                 └ ThemeProvider (MUI)
                    └ LocalizationProvider (dayjs, uk)
                       └ CssBaseline + routed content
```

## Routing & layouts ([src/router.tsx](../../src/router.tsx))
- `useRoutes(router)` with a flat `RouteObject[]`. Every page is
  `lazy()`-imported and wrapped in a `Loader` HOC that adds `<Suspense>` with a
  `SuspenseLoader` fallback.
- **Two layouts:**
  - `BaseLayout` — public/unauthenticated: `/login`, `/registration`, `/status/*`, 404.
  - `SidebarLayout` — authenticated app shell (sidebar + header): `/home`,
    `/dashboards/*`, `/management/*`, `/components/*`.
- **Route groups:** `dashboards` (crypto, messenger, **tickets**, **bus-flights**),
  `management` (transactions, profile), `components` (template showcase),
  `status`.
- **Route guards are composed HOCs** ([src/hoc/](../../src/hoc/)):
  - `withAuthentication` → redirects to `/login` unless `state.users.isAuth`.
  - `withIsAccountActivated` → redirects to `/home` unless `user.isActivated`.
  - Domain pages use both: `withIsAccountActivated(withAuthentication(Page))`.

## State management
Two distinct layers, both in the Redux store ([src/store/index.ts](../../src/store/index.ts)):

1. **Client/UI state — plain RTK slices** ([src/slices/](../../src/slices/)):
   - `userSlice` → `{ isAuth, user }`; selectors `selectIsAuth`, `selectUser`.
   - `appSlice` → `{ isLoading, isFullScreen }`; selectors `selectIsLoading`, …
   - Sidebar open/close lives **outside** Redux in `SidebarContext`.
2. **Server state — RTK Query** (`mainApi`, reducer mounted under
   `mainApi.reducerPath`). This is the single data-fetching layer.

Use the typed hooks `useAppDispatch` / `useAppSelector` from
[src/store/hooks.ts](../../src/store/hooks.ts), never the untyped react-redux ones.

## Data layer — RTK Query (`mainApi`)
- A **single** `createApi` instance (`mainApi`) is defined in
  [src/services/index.ts](../../src/services/index.ts) with an **empty endpoint
  set**. Each domain file calls `mainApi.injectEndpoints(...)` to add its
  endpoints, and `enhanceEndpoints({ addTagTypes })` to register cache tags.
  This keeps one normalized cache and one middleware.
- Config: `keepUnusedDataFor: 30`, `refetchOnFocus: true`, `refetchOnReconnect: true`.
- **Cache invalidation via tags** — e.g. the ticket API tags each row with
  `{ type: 'Ticket', id }` plus a `'LIST'` tag; mutations invalidate the
  relevant ids so lists/detail refetch automatically. Follow this pattern when
  adding endpoints.
- **Server-side table data:** list endpoints (`getTickets`, `getBusFlights`,
  `getPassengers`) take `{ start, size, filters, filtersFns, sorting }` query
  params — pagination, filtering, and sorting are all done **on the backend**,
  driven by `material-react-table` state.

## Authentication flow
JWT **access token in `localStorage('token')`** + **refresh token in an
httpOnly cookie** (every request uses `withCredentials` / `credentials: 'include'`).

1. **On boot** ([src/App.tsx](../../src/App.tsx)): `useLazyCheckAuthQuery` hits
   `/auth/refresh`. If a local token exists and the check succeeds, it stores
   the new `accessToken` and dispatches `setAuth(true)` + `setUser(...)`.
   Otherwise it clears auth and redirects to `/login`. A global `isLoading`
   gate shows `SuspenseLoader` until this resolves.
2. **Per request:** an `Authorization: Bearer <token>` header is attached
   (RTK Query `prepareHeaders`; axios request interceptor).
3. **401 → silent refresh + retry:** both HTTP layers call `/auth/refresh`,
   store the new token, and replay the original request. RTK Query guards this
   with an `async-mutex` `Mutex` so concurrent 401s trigger only one refresh.
4. **403 "Користувача заблоковано" (user blocked):** clear token, reset auth,
   hard-redirect to `/login?redirect=<path>`.

> ⚠️ **There are TWO independent reauth implementations** with the same logic:
> RTK Query's `baseQueryWithReauth` ([services/index.ts](../../src/services/index.ts))
> and axios `$api` interceptors ([http/index.ts](../../src/http/index.ts)).
> `$api` exists because RTK Query is awkward for **binary/blob responses** —
> it's used for PDF ticket downloads (`downloadTicket` uses `$api.get(..., { responseType: 'blob' })`).
> Keep both in sync if you change auth behavior. See `05-issues.md`.

## Feature module pattern (Tickets — the reference module)
The Tickets module ([src/content/dashboards/Tickets/](../../src/content/dashboards/Tickets/))
was refactored from one ~3,500-line file into a layered structure and is the
intended template for complex features. It has its own docs (`ARCHITECTURE.md`,
`README.md`, `REFACTORING.md`, `MIGRATION_GUIDE.md`, `QUICK_REFERENCE.md`,
`SUMMARY.md`, `FINAL_REPORT.md`).

```
Tickets/
  TicketsTable.tsx        Presentation: composes hooks, renders MaterialReactTable
  hooks/
    useTicketsData.ts       data fetching (attributes, currencies, cities, discounts)
    useTicketsMutations.ts  create/update/delete/generate
    useTicketsState.ts      pagination / sorting / filtering / UI state
    useTicketsValidation.ts validation errors
  utils/
    ticketTransformers.ts   pure data shaping
    ticketValidators.ts     pure validation logic
  columns/columnHelpers.ts  column definitions
  constants.ts              page sizes, column defs
  Add/  Edit/               create + edit sub-pages
```
Responsibility layers (outer depends on inner, never reverse):
**Presentation → Business-logic hooks → Pure utils → Data (RTK Query).**
When building a new complex feature, mirror this split rather than the older
monolithic table style still seen elsewhere.

## Theming
MUI theme in [src/theme/](../../src/theme/): `ThemeProvider.tsx` selects a scheme
(only `PureLightTheme` exists), `base.ts` holds shared tokens. Components style
via Emotion `styled` with template-literal access to `theme.colors.*`.
