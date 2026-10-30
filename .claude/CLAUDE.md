# Busora — Development Context

> Educational bus-ticket booking project (Ukraine ⇄ Czech Republic, both
> directions). Forked from the Busreisen API + admin dashboard with clean
> history. **Not a real carrier** — no real payments, no real customer data.

## Monorepo layout

| Path          | What                                                         |
| ------------- | ------------------------------------------------------------ |
| `apps/api`    | Express 4 + Sequelize (MySQL) REST API — booking, PDFs, mail |
| `apps/admin`  | React 17 + MUI admin dashboard (fork of Tokyo template)      |
| `apps/web`    | Public Next.js + TS frontend (not created yet — Phase 9)     |
| `infra/`      | Docker Compose (dev / demo), Caddy                           |
| `brand/`      | Busora logo source (`logo.png`, blue `#007BB7` / green `#2CA04D`) |

## The plan

`docs/PLAN.md` is the approved step-by-step plan (Phases 0–12). Work through it
in order; each phase ends with a check. Record phase progress in the changelog.

## Docs

`docs/inherited/` holds the architecture notes carried over from the original
project (application, architecture, data model — for both API and admin). They
describe the code **as forked**: trust them for structure, but update or
replace them as phases change the code (Phase 12 rewrites them properly).

## Changelog

Three-tier rolling changelog in `changelog/` — follow `changelog/README.md`.
Write to `daily.md` at the end of any session where something changed, was
decided, or was discovered.

## Key rules

- MySQL only (several migrations and queries are MySQL-specific).
- Run migrations via `npm run migrate` in `apps/api`, never edit the DB by hand.
- Payments: mock provider by default; never wire real payment keys into the demo.
- Never commit secrets, real personal data, or DB dumps. Legal details on
  tickets/emails must stay fictional.
- Conventional Commits (`feat(api): …`, `fix(web): …`), `dev` → `main` flow.
- Follow SOLID; when touching poor-quality code, refactor it toward SOLID
  within the scope of the change.
