# Busora

Educational bus-ticket booking project for routes between Ukraine and the Czech
Republic, in both directions.

> **Demo project.** Busora is not a real carrier. Payments are simulated and
> all company and legal details are fictional.

## Structure

- `apps/api`: Express + Sequelize REST API (MySQL). Handles search, seats,
  passengers, discounts, payment, PDF tickets and email.
- `apps/admin`: React + MUI admin dashboard.
- `apps/web`: public Next.js frontend (coming soon).
- `infra/`: Docker Compose setups for local development and the demo.

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

The implementation plan is in [.claude/docs/PLAN.md](.claude/docs/PLAN.md).
