# Daily Changelog — Busora

## 2026-10-30

- Phase 0: created the monorepo from the `dev` branches of the Busreisen API
  and admin dashboard, with clean history (untracked files, `.git`, and the
  old `.claude` folders were not carried over).
- Replaced the real carrier's legal details on tickets with fictional Busora
  values: company name, licence, addresses, phones, EDRPOU code and insurer
  (in `languages/*/_ticket.js`, `views/full-ticket.pug` and
  `views/ticket-terms-of-use/*.pug`). This was done before the first commit so
  they never enter history.
- Removed production-only files: deploy runbooks, the staging
  compose/Caddyfile/env, both deploy workflows and scripts, the children
  migration plan, and the dead `api/index-base.js` and `config/constants.js`.
- [DECISION] Monorepo with `apps/api`, `apps/admin`, `apps/web` and `infra/`.
  MySQL only. Mock payment provider by default. Locales are uk/cs/en. UAH stays
  the stored truth, with CZK as the display currency. Hosting is local Compose
  plus a public demo. See `docs/PLAN.md`.
- Phase 1 (partial, commit `bbd3cc1`): Husky and lint-staged moved to the repo
  root. Each app keeps its own `.lintstagedrc.json`, and lint-staged runs each
  file's closest config from that app's directory. Running the hook needs
  `npm ci` in every app.
- Phase 1: wrote `infra/docker-compose.dev.yml` (MySQL 8 on host port **3307**,
  because a local MySQL80 service owns 3306; Redis; Mailpit on 1025/8025).
  `.env.example` now targets that stack, and the project is MySQL only (`pg`
  removed).
- Fixed: `DB_PORT` was never passed to Sequelize; `MAIL_SECURE="false"` was
  truthy and forced TLS; dev mode crashed without `localhost.pem` (HTTPS is now
  opt-in through `DEV_HTTPS_*_PATH`); npm scripts used the cmd-only `set`.
- [DECISION] Required rows (languages uk_UA=1, cs_CZ=2, en_US=3 and the
  ticketmeta rows in uk/cs/en) live in migration
  `20261030000002-reference-data.js`, not in seeders. That way
  `npm run migrate` alone produces a working database.
- Removed the `tickets.children` JSON column from the model. Every code path
  already used `passengertickets`.
- Blocked: Docker is not installed on this machine. Still to do in Phase 1:
  run `database/tools/generate-baseline.sh`, write the baseline migration
  `20261030000001`, delete the 57 inherited migrations, and verify that
  migrate and boot work on an empty database.
