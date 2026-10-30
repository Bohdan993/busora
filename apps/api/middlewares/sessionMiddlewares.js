/** @format */

const APIError = require('@exeptions/api-error');
const { loadLanguageFile } = require('@helpers');

function checkIfSessionIsStarted(req, res, next) {
  try {
    const { languageCode = 'uk_UA' } = req.query;

    if (req.originalUrl.split('?')?.[0] === '/api/tickets') {
      console.log('Headers: ', req.headers);
      console.log('COOKIES', req.cookies);
      console.log('REQ SESSION TICKET', req.session);
      console.log('IS SESSION STARTED', req.session?.isStarted);
      // console.log("EXPIRE DATE FROM CLIENT", req?.body?.sessionExpiresDate);
    }

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
