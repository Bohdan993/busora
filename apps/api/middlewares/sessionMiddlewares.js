/** @format */

const APIError = require('@exeptions/api-error');
const { loadLanguageFile } = require('@helpers');

function checkIfSessionIsStarted(req, res, next) {
  try {
    const { languageCode = 'uk_UA' } = req.query;

    if (req.session?.isStarted) {
      return next();
    }

    const error401Translations = loadLanguageFile('401-error.js', languageCode);
    throw APIError.UnauthorizedError('unauthorized', 'error-401', {
      translations: error401Translations,
      languageCode
    });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  checkIfSessionIsStarted
};
