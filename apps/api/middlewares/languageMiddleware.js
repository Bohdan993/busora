/** @format */

const APIError = require('@exeptions/api-error');
const { isSupportedLocale, LOCALES } = require('@root/config/market');

/**
 * Rejects an unsupported ?languageCode= at the boundary. Routes default to the
 * default locale when it is absent; an unknown value would otherwise reach
 * file-system lookups of translation files.
 */
function validateLanguageCode(req, res, next) {
  const { languageCode } = req.query ?? {};
  if (languageCode === undefined || isSupportedLocale(languageCode)) {
    return next();
  }
  return next(
    APIError.BadRequestError(
      `languageCode must be one of: ${LOCALES.join(', ')}`
    )
  );
}

module.exports = { validateLanguageCode };
