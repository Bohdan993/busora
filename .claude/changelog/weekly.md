# Weekly Changelog — Busora

## Week 2026-W44

- Phase 0: created the Busora monorepo (`apps/api`, `apps/admin`, `infra/`)
  from the `dev` branches of the Busreisen API and admin, with clean history.
  Production-only files and dead code were removed. The real carrier's legal
  details on tickets were replaced with fictional ones before the first commit.
- [DECISION] Architecture: MySQL only; mock payment provider by default;
  locales uk/cs/en; UAH stays the stored truth with CZK as the display
  currency; hosting is local Compose plus a public demo. See `docs/PLAN.md`.
- [DECISION] Required rows (languages uk_UA=1, cs_CZ=2, en_US=3, ticketmeta
  in uk/cs/en) live in migration `20261030000002-reference-data.js`, not in
  seeders.
- Phase 1 prep: dev Compose stack (MySQL on host port 3307, Redis, Mailpit);
  Husky and lint-staged moved to the repo root; `tickets.children` removed from
  the model.
- Fixed: `DB_PORT` was never passed to Sequelize; `MAIL_SECURE="false"` was
  truthy and forced TLS; dev mode crashed without cert files (HTTPS is now
  opt-in); npm scripts used the cmd-only `set`.
