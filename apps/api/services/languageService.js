/** @format */

const { language: Language } = require('@database/models/index');
const { DEFAULT_LOCALE } = require('@root/config/market');

/**
 * Locale code (e.g. "cs_CZ") of a languages row; the default locale when the
 * id is missing or unknown.
 */
async function getLanguageCodeById(languageId) {
  if (!languageId) return DEFAULT_LOCALE;
  const language = await Language.findByPk(languageId, {
    attributes: ['code']
  });
  return language?.code ?? DEFAULT_LOCALE;
}

module.exports = { getLanguageCodeById };
