#!/usr/bin/env bash
#
# CI deploy — Busora demo (pull-on-server strategy)
#
# Runs in the CI runner. SSHes into the demo server and redeploys the Docker
# Compose stack straight from git: the server fetches the deploy branch,
# rebuilds the images, brings the stack up and runs the DB migrations.
# Nothing is built or shipped from the runner; the server is the build host.
#
# Required env (set by .github/workflows/deploy.yml):
#   DEPLOY_SSH_KEY      private SSH key for $DEPLOY_USER@$DEPLOY_HOST
#   DEPLOY_HOST         server hostname / public IP
#   DEPLOY_USER         SSH user (deploy)
#   DEPLOY_APP_DIR      the repository checkout on the server (/opt/busora)
#   DEPLOY_BRANCH       branch to deploy (main)
# Optional:
#   DEPLOY_KNOWN_HOSTS  the server's pinned host key line (ssh-keyscan output);
#                       without it the first key seen is trusted
#   SSH_PORT            SSH port (default: 22)
#
# One-time setup: infra/DEMO.md.

set -euo pipefail

: "${DEPLOY_SSH_KEY:?DEPLOY_SSH_KEY is required}"
: "${DEPLOY_HOST:?DEPLOY_HOST is required}"
: "${DEPLOY_USER:?DEPLOY_USER is required}"
: "${DEPLOY_APP_DIR:?DEPLOY_APP_DIR is required}"
: "${DEPLOY_BRANCH:?DEPLOY_BRANCH is required}"
SSH_PORT="${SSH_PORT:-22}"

# --- the private key and known hosts in temp files (removed on exit) -------
KEY_FILE="$(mktemp)"
KNOWN_HOSTS="$(mktemp)"
trap 'rm -f "$KEY_FILE" "$KNOWN_HOSTS"' EXIT
chmod 600 "$KEY_FILE"
printf '%s\n' "$DEPLOY_SSH_KEY" >"$KEY_FILE"

if [ -n "${DEPLOY_KNOWN_HOSTS:-}" ]; then
  printf '%s\n' "$DEPLOY_KNOWN_HOSTS" >"$KNOWN_HOSTS"
else
  # Pin the host key we first see (TOFU) rather than disabling host checking
  ssh-keyscan -p "$SSH_PORT" -H "$DEPLOY_HOST" >"$KNOWN_HOSTS" 2>/dev/null || true
fi

SSH=(ssh -i "$KEY_FILE" -p "$SSH_PORT"
  -o UserKnownHostsFile="$KNOWN_HOSTS"
  -o StrictHostKeyChecking=accept-new
  -o ConnectTimeout=20)

echo "==> Deploying '${DEPLOY_BRANCH}' to ${DEPLOY_USER}@${DEPLOY_HOST}:${DEPLOY_APP_DIR}"

# The remote script. Local values are interpolated in here (they come from
# trusted CI config, not user input); \$-vars run on the server.
# `git reset --hard` only touches tracked files, so the server's untracked
# infra/demo.env is preserved.
"${SSH[@]}" "${DEPLOY_USER}@${DEPLOY_HOST}" bash -s <<REMOTE
set -euo pipefail
cd "${DEPLOY_APP_DIR}"

echo "==> Fetching origin/${DEPLOY_BRANCH}"
git fetch --prune origin
git checkout "${DEPLOY_BRANCH}"
git reset --hard "origin/${DEPLOY_BRANCH}"
echo "    now at \$(git rev-parse --short HEAD) — \$(git log -1 --pretty=%s)"

dc() { docker compose --env-file infra/demo.env -f infra/docker-compose.demo.yml "\$@"; }

echo "==> Building & starting the stack"
dc up -d --build

echo "==> Running database migrations"
dc exec -T api npm run migrate

echo "==> Pruning dangling images"
docker image prune -f >/dev/null 2>&1 || true

echo "==> Service status:"
dc ps
REMOTE

echo "==> Deploy finished."
