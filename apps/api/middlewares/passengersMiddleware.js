/** @format */

const APIError = require('@exeptions/api-error');
const { loadLanguageFile } = require('@helpers');

function checkIfPassengersInfoExists(req, res, next) {
  try {
    const { languageCode = 'uk_UA', type } = req.query;

    const error401Translations = loadLanguageFile('401-error.js', languageCode);
    if (req.originalUrl.split('?')?.[0] === '/api/passengers') {
      if (type === 'check') {
        if (req.session?.passengersInfo) {
          return next();
        }
        throw APIError.UnauthorizedError('unauthorized', 'error-401', {
          translations: error401Translations,
          languageCode
        });
      }

      if (type === 'standart') {
        return next();
      }
    }

    if (req.session?.passengersInfo) {
      return next();
    }

    throw APIError.UnauthorizedError('unauthorized', 'error-401', {
      translations: error401Translations,
      languageCode
    });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  checkIfPassengersInfoExists
};
