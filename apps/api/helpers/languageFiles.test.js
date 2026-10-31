/** @format */

// Run with:  node --test helpers/languageFiles.test.js

require('module-alias/register');

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const { loadLanguageFile } = require('@helpers');
const { LOCALES, DEFAULT_LOCALE } = require('@root/config/market');

const LANGUAGES_DIR = path.resolve(__dirname, '..', 'languages');
const TERMS_DIR = path.resolve(__dirname, '..', 'views', 'ticket-terms-of-use');

// Shape of a translation object: nested keys and value kinds, not the text.
function shapeOf(value) {
  if (typeof value === 'function') return 'function';
  if (Array.isArray(value)) return value.map(shapeOf);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, shapeOf(value[key])])
    );
  }
  return typeof value;
}

test('loadLanguageFile reads a supported locale', () => {
  const mail = loadLanguageFile('_mail.js', 'cs_CZ');
  assert.equal(typeof mail.subjectText, 'string');
});

test('loadLanguageFile refuses unsupported locales and path traversal', () => {
  for (const code of ['ru_RU', 'de_DE', '../uk_UA', '../../package.json']) {
    assert.throws(() => loadLanguageFile('_mail.js', code), /locale/i, code);
  }
});

test('there is a language folder for exactly the supported locales', () => {
  const folders = fs.readdirSync(LANGUAGES_DIR).sort();
  assert.deepEqual(folders, [...LOCALES].sort());
});

test('every locale has the same translation files as the default', () => {
  const expected = fs
    .readdirSync(path.join(LANGUAGES_DIR, DEFAULT_LOCALE))
    .sort();
  for (const locale of LOCALES) {
    const files = fs.readdirSync(path.join(LANGUAGES_DIR, locale)).sort();
    assert.deepEqual(files, expected, locale);
  }
});

test('every translation file has the same keys as the default locale', () => {
  const files = fs.readdirSync(path.join(LANGUAGES_DIR, DEFAULT_LOCALE));
  for (const file of files) {
    const expected = shapeOf(loadLanguageFile(file, DEFAULT_LOCALE));
    for (const locale of LOCALES) {
      assert.deepEqual(
        shapeOf(loadLanguageFile(file, locale)),
        expected,
        `${locale}/${file}`
      );
    }
  }
});

test('every locale has ticket terms of use', () => {
  for (const locale of LOCALES) {
    assert.ok(fs.existsSync(path.join(TERMS_DIR, `${locale}.pug`)), locale);
  }
});
