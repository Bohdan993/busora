#!/usr/bin/env bash
# One-off tool: builds the baseline schema migration from the inherited
# migration chain. Run from the repo root with the dev Compose stack up:
#
#   bash apps/api/database/tools/generate-baseline.sh
#
# Steps:
#   1. Recreate an empty scratch database inside the Compose MySQL.
#   2. Run the inherited chain on it, inserting the language rows that
#      20250912130003 requires (it throws on an empty languages table).
#   3. Drop the deprecated tickets.children JSON column.
#   4. Dump the schema (tables only; triggers are written by hand in the
#      baseline) to database/tools/baseline-schema.sql for review.
set -euo pipefail

COMPOSE=(docker compose -f infra/docker-compose.dev.yml)
SCRATCH_DB=busora_baseline
ROOT_PW=busora_root_dev
LAST_BEFORE_TICKETMETA_DATA=20250912130002-add-ticketmeta-foreign-keys.js
LAST_INHERITED=20260626000005-payment-booking-gross.js
OUT=apps/api/database/tools/baseline-schema.sql

mysql_root() {
  "${COMPOSE[@]}" exec -T mysql mysql -uroot -p"$ROOT_PW" "$@"
}

echo "1/4 Recreating scratch database $SCRATCH_DB"
mysql_root -e "DROP DATABASE IF EXISTS $SCRATCH_DB; CREATE DATABASE $SCRATCH_DB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci; GRANT ALL ON $SCRATCH_DB.* TO 'busora'@'%';"

migrate() {
  "${COMPOSE[@]}" exec -T -e DB_NAME="$SCRATCH_DB" api npx sequelize-cli db:migrate "$@"
}

echo "2/4 Running the inherited migration chain"
migrate --to "$LAST_BEFORE_TICKETMETA_DATA"
mysql_root "$SCRATCH_DB" -e "INSERT INTO languages (id, name, code) VALUES (1,'Українська','uk_UA'),(2,'Čeština','cs_CZ'),(3,'English','en_US');"
migrate --to "$LAST_INHERITED"

echo "3/4 Dropping deprecated tickets.children"
mysql_root "$SCRATCH_DB" -e "ALTER TABLE tickets DROP COLUMN children;"

echo "4/4 Dumping schema to $OUT"
"${COMPOSE[@]}" exec -T mysql mysqldump -uroot -p"$ROOT_PW" \
  --no-data --skip-triggers --skip-comments --skip-add-drop-table \
  --ignore-table="$SCRATCH_DB.SequelizeMeta" \
  --ignore-table="$SCRATCH_DB.SequelizeData" \
  "$SCRATCH_DB" | sed -E 's/ AUTO_INCREMENT=[0-9]+//' > "$OUT"

echo "Done. Tables dumped: $(grep -c '^CREATE TABLE' "$OUT")"
