# Busora admin

Admin panel for the Busora booking demo: tickets, passengers, bus flights,
discounts and ticket PDFs. React 17 + MUI (create-react-app), Ukrainian UI.
It is built on the MIT-licensed [Tokyo Free White](https://bloomui.com)
template (see `LICENSE`).

## Run locally

1. Start the API stack (see the repository README) and seed it — the seed
   creates the demo users `admin@busora.test` and `manager@busora.test`, with
   the passwords from `SEED_ADMIN_PASSWORD` / `SEED_MANAGER_PASSWORD` in
   `apps/api/.env`.
2. `cp .env.example .env` — the admin runs on port 3001 and talks to
   `REACT_APP_API_URL`.
3. `npm ci && npm start`, then open <http://localhost:3001>.

The template's demo pages (Cryptocurrency, Messenger, …) show only in
development; set `REACT_APP_SHOW_DEMO=false` to hide them locally.

## Checks

`npm run lint`, `npm run format:check`, `npx tsc --noEmit` and `npm run build`
— CI runs all four.
