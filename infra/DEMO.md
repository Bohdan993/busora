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

Deploys follow one rule: `dev` ──PR──> `main` ──merge──> the server pulls
`main` and rebuilds the stack ([.github/workflows/deploy.yml](../.github/workflows/deploy.yml),
[bin/ci-deploy.sh](../bin/ci-deploy.sh)). A pull request into `main` only
builds the three images as a check.

1. A Linux server (amd64 or arm64; it builds the images, so 4 GB RAM or more)
   with Docker Engine, the Compose plugin and git. Open ports 80 and 443 (TCP,
   plus UDP 443 for HTTP/3) and SSH; nothing else.
2. DNS: A (and AAAA) records for the three hostnames pointing at the server.
3. A `deploy` user that may run Docker, with the repository checked out at
   `/opt/busora`:

   ```sh
   sudo mkdir -p /opt/busora && sudo chown deploy: /opt/busora
   sudo -iu deploy git clone https://github.com/Bohdan993/busora.git /opt/busora
   ```

4. `infra/demo.env` in that checkout, from [demo.env.example](demo.env.example),
   with every empty value filled in (`openssl rand -hex 32` for the secrets;
   the Mailpit hash as the template explains). `chmod 600 infra/demo.env`.
   Git ignores it, and the deploy's `git reset --hard` leaves it alone.
5. GitHub settings, on the repository:
   - Environment `demo`, limited to the `main` branch.
   - Repository variables: `DEMO_USER` (`deploy`), `DEMO_DIR`
     (`/opt/busora`), and last `DEMO_HOST`: it switches deploys on.
   - Environment secrets: `DEMO_SSH_KEY` (a private key for the deploy user,
     made only for this) and `DEMO_SSH_KNOWN_HOSTS` (the output of
     `ssh-keyscan <host>`, so the deploy refuses an unexpected server).
6. First deploy: merge a pull request into `main`. The server builds and
   starts everything and runs the migrations. Then fill the database once:

   ```sh
   cd /opt/busora
   docker compose --env-file infra/demo.env -f infra/docker-compose.demo.yml      run --rm reset node scripts/demoReset.js
   ```

7. Check: the site loads over HTTPS and a booking goes through to the ticket
   download; the admin login works; the inbox asks for its password and shows
   the booking email.

### On Oracle Cloud (the current demo server)

The demo runs on its own OCI instance, `busora-demo` (VM.Standard.A1.Flex,
arm64, Oracle Linux 9), in the `busreisen-vcn` public subnet, next to the
Busreisen staging server but separate from it. The subnet's security list
allows TCP 22, 80 and 443; UDP 443 (HTTP/3) is optional. On the instance:

```sh
sudo dnf -y update && sudo reboot
sudo firewall-cmd --permanent --add-service=http --add-service=https
sudo firewall-cmd --permanent --add-port=443/udp && sudo firewall-cmd --reload
sudo dnf -y install dnf-plugins-core
sudo dnf config-manager --add-repo https://download.docker.com/linux/rhel/docker-ce.repo
sudo dnf -y install docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo systemctl enable --now docker
sudo dnf -y install git
sudo useradd --create-home deploy && sudo usermod -aG docker deploy
```

- `infra/demo.env` (in the checkout) and `~deploy/inbox-password` (the
  Mailpit login, `busora / <password>`) are readable by `deploy` only. Read a
  value with `sudo -u deploy grep SEED_ADMIN_PASSWORD /opt/busora/infra/demo.env`.
- `deploy` logs in only with the GitHub Actions key, which is marked
  `restrict` in `authorized_keys` (no terminal, no forwarding; commands and
  `scp` still work). Administrators log in as `opc` with their own key.

## Day to day

Every command runs in `/opt/busora`; `dc` stands for
`docker compose --env-file infra/demo.env -f infra/docker-compose.demo.yml`.

- **Deploys** happen on every merge into `main`; the Actions log shows the
  commit the server moved to.
- **Logs:** `dc logs -f api` (also kept in the `api_logs` volume); the reset
  logs its runs under `dc logs reset`.
- **Reset now:** `dc run --rm reset node scripts/demoReset.js`.
- **Roll back:** revert the bad commit on `dev` and merge it into `main`, or
  on the server `git checkout <older commit> && dc up -d --build` (the next
  deploy returns to `main`). Migrations only ever add, so an older API runs
  on the newer schema; if not, reset.
- **Change a setting:** edit `infra/demo.env`, then `dc up -d`.
- **Disk:** builds leave cache behind; `docker builder prune -f` frees it.

## Rehearse locally

The whole stack runs on a workstation with Docker Desktop, using `*.localhost`
names (Caddy gives them certificates from its own local authority, so the
browser warns once).

```sh
cp infra/demo.env.example infra/demo.env
# set the hosts to demo.localhost, admin.localhost and mail.localhost,
# and fill in the secrets
docker compose --env-file infra/demo.env -f infra/docker-compose.demo.yml up -d --build
docker compose --env-file infra/demo.env -f infra/docker-compose.demo.yml \n  run --rm reset node scripts/demoReset.js
```

The Playwright suite runs against it too:
`E2E_BASE_URL=https://demo.localhost npm run test:e2e` in `apps/web`.
