# Daily Changelog — Busora

## 2026-10-31

- Phase 1 complete. The 59 inherited migrations are replaced by
  `20261030000001-baseline-schema.js` (25 tables in foreign-key order, plus the
  two `passengerRowCount` triggers), followed by `20261030000002-reference-data.js`.
- Verified on the dev Compose stack:
  - `npm run migrate` on an empty `busora_dev` succeeds.
  - Compared through `information_schema`, the resulting schema is identical
    to what the old chain produced, minus `tickets.children`: 193 columns, 89
    index entries, 37 FK columns, 2 triggers, plus each column's
    charset/collation.
  - The API boots: cities and currencies return 200 with empty data, Swagger
    loads, and Redis is used for sessions.
  - Admin register → activation email in Mailpit → link → activated.
- Fixed: `sequelize-cli` never registered the `@helpers` module aliases, so
  migrations that imported constants crashed. `.sequelizerc` now loads
  `module-alias/register`.
- Found in the old chain (now moot): `20250912040507` (ticketmetaattributes)
  sorted before the `ticketmeta` table it references. The chain could not run
  on an empty DB in order.
- Inherited quirk kept as-is: `tickets.statusId` and `tickets.typeId` each have
  two FKs to `ticketmeta`, one RESTRICT and one SET NULL. In effect, deleting a
  ticketmeta row in use is blocked.
- Docker needed Windows' Virtual Machine Platform enabled plus a reboot.
  Firmware virtualization was already on.
- Phase 1 check note: cities are empty until the Phase 6 seeders.
