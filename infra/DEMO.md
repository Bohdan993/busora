# Busora public demo — runbook

One server runs the whole demo with Docker Compose
([docker-compose.demo.yml](docker-compose.demo.yml)). Caddy is the only thing
facing the internet and gets the HTTPS certificates itself.

| Address           | Goes to                                        | Who uses it          |
| ----------------- | ---------------------------------------------- | -------------------- |
| `DEMO_SITE_HOST`  | the Next.js site; `/api/*` straight to the API | everyone             |
| `DEMO_ADMIN_HOST` | the admin panel; `/api/*` to the API           | you (private logins) |
| `DEMO_MAIL_HOST`  | the Mailpit inbox, behind a password           | you                  |

The API, MySQL, Redis and Mailpit are reachable only inside the Compose
network.

## Safeguards

- **No real payments:** the Compose file forces `PAYMENT_PROVIDER=mock`,
  whatever `demo.env` says.
- **No real emails:** the API's only mail server is Mailpit, which keeps every
  message and delivers none. Visitors download their tickets on the success
  page; only you can open the inbox.
- **Fresh every night:** the `reset` service drops all data at 03:00 Kyiv time
  and seeds it again ([scripts/demoReset.js](../apps/api/scripts/demoReset.js)).
  Bookings, ticket PDFs, emails and sessions go; the timetable moves forward
  with the date. The script refuses to run without `DEMO_RESET_ENABLED=true`,
  which only the `reset` service sets.
- **Rate limit per visitor:** 100 API requests per IP every 15 minutes. Caddy
  passes the visitor's IP to the API (and drops any `X-Forwarded-For` a client
  makes up), so visitors don't share one limit.
- **Not indexed:** every response carries `X-Robots-Tag: noindex, nofollow`, so
  a fictional carrier doesn't turn up in search results.
- **Demo banner** on every page of the site; all company details are fictional.
- **Private admin:** the admin host is public, but its logins live only in
  `demo.env`. Sign-ups need an activation link that only reaches Mailpit.

## One-time server setup

1. A Linux server (amd64 or arm64; 2 GB RAM is enough, since images are built
   on GitHub) with Docker Engine and the Compose plugin. Open ports 80 and 443
   (TCP, plus UDP 443 for HTTP/3) and SSH; nothing else.
2. DNS: A (and AAAA) records for the three hostnames pointing at the server.
3. A deploy user that may run Docker, and the folder (default `/opt/busora`):

   ```sh
   sudo mkdir -p /opt/busora && sudo chown deploy: /opt/busora
   ```

4. In that folder, `demo.env` from [demo.env.example](demo.env.example), with
   every empty value filled in (`openssl rand -hex 32` for the secrets; the
   Mailpit hash as the template explains). `chmod 600 demo.env`.
5. Registry access: the images are public-safe (no secrets inside), so the
   simplest is to make the three `busora-*` packages public in GitHub's
   package settings. To keep them private, log in once on the server with a
   token that only has `read:packages`:
   `docker login ghcr.io -u <github-user>`.
6. GitHub settings, on the repository:
   - Environment `demo` (optionally with required reviewers).
   - Variables: `DEMO_HOST`, `DEMO_USER`, optionally `DEMO_DIR` (default
     `/opt/busora`) and `DEMO_PLATFORMS` (e.g. `linux/arm64` for an ARM server).
   - Secrets: `DEMO_SSH_KEY` (a private key for the deploy user, made only for
     this) and `DEMO_SSH_KNOWN_HOSTS` (the output of `ssh-keyscan <host>`, so
     the workflow refuses an unexpected server).
7. First deploy: run the **Deploy demo** workflow by hand (or push to `main`).
   It copies the Compose file and Caddyfile, pulls the images, migrates and
   starts everything. Then fill the database once:

   ```sh
   cd /opt/busora
   docker compose --env-file demo.env -f docker-compose.demo.yml \
     run --rm reset node scripts/demoReset.js
   ```

8. Check: the site loads over HTTPS and a booking goes through to the ticket
   download; the admin login works; the inbox asks for its password and shows
   the booking email.

## Day to day

Every command runs in `/opt/busora`; `dc` stands for
`docker compose --env-file demo.env -f docker-compose.demo.yml`.

- **Deploys** happen on every push to `main` once CI passes. Images are tagged
  `latest` and with the commit SHA.
- **Logs:** `dc logs -f api` (also kept in the `api_logs` volume); the reset
  logs its runs under `dc logs reset`.
- **Reset now:** `dc run --rm reset node scripts/demoReset.js`.
- **Roll back:** `BUSORA_IMAGE_TAG=<older commit SHA> dc up -d`. Migrations
  only ever add, so an older API runs on the newer schema; if not, reset.
- **Change a setting:** edit `demo.env`, then `dc up -d`.

## Rehearse locally

The whole stack runs on a workstation with Docker Desktop, using `*.localhost`
names (Caddy gives them certificates from its own local authority, so the
browser warns once).

```sh
docker build -t busora-local-api apps/api
docker build -t busora-local-web apps/web
docker build -t busora-local-admin apps/admin
cd infra
cp demo.env.example demo.env
# set BUSORA_IMAGE_PREFIX=busora-local, the hosts to demo.localhost,
# admin.localhost and mail.localhost, and fill in the secrets
docker compose --env-file demo.env -f docker-compose.demo.yml up -d
docker compose --env-file demo.env -f docker-compose.demo.yml \
  run --rm reset node scripts/demoReset.js
```

The Playwright suite runs against it too:
`E2E_BASE_URL=https://demo.localhost npm run test:e2e` in `apps/web`.
