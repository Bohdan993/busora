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

The implementation plan is in [.claude/docs/PLAN.md](.claude/docs/PLAN.md).
