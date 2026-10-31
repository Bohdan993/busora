# Busora

Educational bus-ticket booking project for routes between Ukraine and the Czech
Republic, in both directions.

> **Demo project.** Busora is not a real carrier. Payments are simulated and
> all company and legal details are fictional.

## Structure

- `apps/api`: Express + Sequelize REST API (MySQL). Handles search, seats,
  passengers, discounts, payment, PDF tickets and email.
- `apps/admin`: React + MUI admin dashboard (port 3001), see
  [apps/admin/README.md](apps/admin/README.md).
- `apps/web`: public Next.js site in Ukrainian, Czech and English (port 3000):
  booking, routes, schedule, fares, rules and contacts. See
  [apps/web/README.md](apps/web/README.md).
- `infra/`: Docker Compose setups for local development and the demo.

## Public demo

The demo runs the whole stack on one server behind Caddy: the site, a private
admin panel and a password-protected Mailpit inbox. Payments are always
simulated, emails never leave the server, and the data resets every night.
After CI passes on `main`, GitHub Actions builds the images and deploys them.
Setup, operations and a local rehearsal: [infra/DEMO.md](infra/DEMO.md).

## Run it locally

1. `docker compose -f infra/docker-compose.dev.yml up -d --build`, then
   `npm run migrate && npm run seed` in `apps/api` (the API on port 5000,
   MySQL, Redis and Mailpit at <http://localhost:8025>).
2. The site: `npm ci && npm run dev` in `apps/web`, then
   <http://localhost:3000>.
3. The admin: `npm ci && npm start` in `apps/admin`, then
   <http://localhost:3001>.

## API contract and checks

The public booking API speaks JSON only. Its contract is the OpenAPI spec in
`apps/api/openapi.json`, served as interactive docs at
<http://localhost:5000/api-docs>. Every error has the same shape with a
machine-readable `code`.

In `apps/api` (CI runs the same on every push and pull request):

- `npm run lint` and `npm run format:check`
- `npm test`: unit tests
- `npm run test:integration`: the whole booking flow against the dev stack's
  MySQL and Mailpit (migrated and seeded); it deletes the tickets it creates
- `npm run openapi`: regenerates `openapi.json` after an endpoint changes
  (`npm run openapi:check` fails while it is stale)

In `apps/web`, CI runs lint, format, typecheck, unit tests and the build, and
checks that the generated API types match `openapi.json`. The Playwright
end-to-end test (`npm run test:e2e`) runs locally only.

The implementation plan is in [.claude/docs/PLAN.md](.claude/docs/PLAN.md).
