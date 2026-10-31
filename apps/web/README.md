# Busora web

The public booking site: search, routes, schedule, fares, rules and contacts,
plus the booking flow from search to ticket. Next.js (App Router, Cache
Components) with TypeScript, `next-intl` (uk, cs, en at `/uk`, `/cs`, `/en`),
TanStack Query and react-hook-form + zod.

The layout is deliberately plain for now; the visual design is applied in
Phase 10.

## How it talks to the API

The browser only calls this app. Next.js forwards `/api/*` to the booking API
(`API_ORIGIN`, see `next.config.ts`), so the API's session cookie is
first-party. All API data loads in the browser; server components render only
translated text, so `npm run build` never needs a running API.

The API client is typed from the API's contract:
`npm run api:types` regenerates `src/lib/api/schema.d.ts` from
`../api/openapi.json` (run it after `npm run openapi` in `apps/api`). API errors
carry a `code` that maps to the messages under `errors` in `messages/*.json`.

## Run locally

1. Start the API stack and seed it (see the repository README).
2. `cp .env.example .env.local`
3. `npm ci && npm run dev`, then open <http://localhost:3000>.

## Checks

- `npm run lint`, `npm run format:check`, `npm run typecheck`
- `npm test`: unit tests (Vitest)
- `npm run build`
- `npm run test:e2e`: Playwright books through the site in uk and cs against
  the local stack (run locally only; it books real seats in the dev database —
  re-seed the flights to reset them)

## Content

Texts live in `messages/{uk,cs,en}.json` (a test keeps their keys identical).
Contact details are fictional and match the PDF tickets. Photos come from
Wikimedia Commons; their credits are in `src/content/imageCredits.json` and on
the `/attributions` page.
