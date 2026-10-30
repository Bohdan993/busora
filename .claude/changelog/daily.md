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
- Open: each app still has its own `.husky/` and `prepare: husky` script.
  Husky needs to move to the repo root in Phase 1 or 7, because the apps are
  no longer git roots.
