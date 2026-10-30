# 02 — Application Stack

> Updated: 2026-06-07

## What this is
The **admin panel** ("Busreisen Адмін Панель") for the Busreisen bus-travel
platform. PMs/operators manage **tickets** and **bus flights (рейси)**, with
passenger management, PDF ticket generation, and CSV/PDF export.

It is built on the **BloomUI "Tokyo Free White" React TypeScript admin
dashboard** template (see top-level `README.md`). A large amount of the
template's demo content still ships in the routes and sidebar (Crypto,
Messenger, Transactions, Users profile/settings, a Components showcase, Status
pages) — see `05-issues.md`. The **real domain features are Tickets and
BusFlights**; treat everything else as template scaffolding.

## Core stack
| Concern | Choice |
|---|---|
| UI framework | React **17.0.2** |
| Language | TypeScript **4.7.3** |
| Build | Create React App (`react-scripts` 5.0.1) |
| Component lib | Material-UI (MUI) **5.8** + `@mui/lab`, `@mui/styles`, `@mui/icons-material` |
| Styling | Emotion (`@emotion/react`, `@emotion/styled`) + MUI `styled`; RTL via `stylis-plugin-rtl` |
| Global state | Redux Toolkit **1.9** |
| Server state / data fetching | **RTK Query** (`@reduxjs/toolkit/query/react`) |
| HTTP (side channel) | **axios** 1.5 (used for blob/PDF downloads) |
| Routing | `react-router` / `react-router-dom` **6.3** |
| Forms | `react-hook-form` 7 + `@hookform/resolvers` + **zod** 3 |
| Dates | `dayjs` (utc plugin, `uk` locale) + `@mui/x-date-pickers`; `date-fns` also present |
| Data tables | **`material-react-table` v2** (server-side pagination/sorting/filtering) |
| Charts | `apexcharts` + `react-apexcharts` (template demo only) |
| PDF | `jspdf` + `jspdf-autotable` (embeds `helpers/Roboto-Regular-normal.js` font) |
| CSV | `export-to-csv` |
| Misc | `react-helmet-async` (head), `nprogress` (load bar), `async-mutex` (refresh lock), `react-phone-number-input`, `react-input-mask`, `numeral` |

> Note: `@tanstack/react-query` is in `package.json` but the app's data layer
> is RTK Query — React Query appears unused (it's a `material-react-table`
> transitive peer). Confirm before relying on it.

## Scripts (`package.json`)
- `start` — CRA dev server (http, :3000)
- `start-https` — CRA dev server over HTTPS using `cert.pem` / `key.pem`
- `start-https-prod` — same, with `NODE_ENV=production`
- `build` — CRA production build → `build/`
- `lint` / `lint:fix` — ESLint (airbnb-typescript + prettier configs)
- `format` — Prettier across `ts,tsx,js,jsx,json`

## Path aliases
Imports use an absolute `src/...` base (e.g. `import App from 'src/App'`),
configured via `tsconfig.json` `baseUrl`. Keep using `src/`-rooted imports for
consistency with the existing code.
