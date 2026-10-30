// Central runtime flags.
//
// `isDev` is true under `npm start` and false in a production build
// (`npm run build` sets NODE_ENV=production). It is used to hide the leftover
// BloomUI "Tokyo" template demo pages (Cryptocurrency, Messenger, Management,
// Accounts, Components, Extra Pages) from the deployed app while keeping them
// reachable during local development.
//
// To force the production menu locally, set REACT_APP_SHOW_DEMO=false in a
// .env file (or REACT_APP_SHOW_DEMO=true to keep the demos in a prod build).
export const isDev = process.env.NODE_ENV === 'development';
export const isProd = !isDev;

const demoOverride = process.env.REACT_APP_SHOW_DEMO;

// Whether to show the template demo pages in the sidebar. Defaults to dev-only;
// an explicit REACT_APP_SHOW_DEMO env value wins when provided.
export const showDemoPages =
  demoOverride === 'true' ? true : demoOverride === 'false' ? false : isDev;
