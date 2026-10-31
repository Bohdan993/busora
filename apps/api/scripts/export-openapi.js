/**
 * Writes the OpenAPI spec (built from the route JSDoc and config/swagger*.js)
 * to openapi.json, the file the web app generates its API types from.
 *
 *   npm run openapi          regenerate openapi.json
 *   npm run openapi:check    fail if openapi.json is out of date (CI)
 */
require('module-alias/register');

const fs = require('fs');
const path = require('path');

// swagger-jsdoc resolves its `apis` globs against the working directory
process.chdir(path.resolve(__dirname, '..'));

const spec = require('../config/swagger');

const OUTPUT = path.resolve('openapi.json');
const content = JSON.stringify(spec, null, 2) + '\n';

if (process.argv.includes('--check')) {
  const current = fs.existsSync(OUTPUT) ? fs.readFileSync(OUTPUT, 'utf8') : '';
  if (current.replace(/\r\n/g, '\n') !== content) {
    console.error('openapi.json is out of date — run `npm run openapi`.');
    process.exit(1);
  }
  console.log('openapi.json is up to date.');
} else {
  fs.writeFileSync(OUTPUT, content);
  console.log(`Wrote ${path.relative(process.cwd(), OUTPUT)}`);
}
