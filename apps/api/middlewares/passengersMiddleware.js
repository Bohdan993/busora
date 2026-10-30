/** @format */

const APIError = require('@exeptions/api-error');
const { loadLanguageFile } = require('@helpers');

function checkIfPassengersInfoExists(req, res, next) {
  try {
    const { languageCode = 'uk_UA', type } = req.query;

    if (req.originalUrl.split('?')?.[0] === '/api/tickets') {
      console.log('IS PASSANGERS INFO EXISTS', req.session?.passengersInfo);
    }

    if (req.originalUrl.split('?')?.[0] === '/api/tickets/send') {
      console.log(
        'IS PASSANGERS INFO EXISTS TICKET SEND',
        req.session?.passengersInfo
      );
    }

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
