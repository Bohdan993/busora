/** @format */

const {
  isSpecialDate,
  isValidDate,
  loadLanguageFile,
  isRound
} = require('@helpers');
const { Op } = require('sequelize');
const { language: Language } = require('@database/models/index');
const APIError = require('@exeptions/api-error');

async function validateDates(req, res, next) {
  try {
    const {
      languageCode = 'uk_UA',
      startDate = null,
      endDate = null
    } = req?.query ?? {};

    const lang = await Language.findOne({
      where: {
        code: {
          [Op.eq]: languageCode
        }
      }
    });

    const isAlternativesRoute =
      req.originalUrl.split('?')?.[0] === '/api/bus-flights/alternatives';
    const error404Translations = isAlternativesRoute
      ? loadLanguageFile('_404-error-no-alternative-tickets.js', lang?.code)
      : loadLanguageFile('404-error.js', lang?.code);

    if (isValidDate(new Date(startDate)) && isValidDate(new Date(endDate))) {
      if (new Date(startDate) >= new Date(endDate)) {
        throw APIError.NotFoundError('not found', 'error-404', {
          translations: error404Translations,
          isShowBtn: !isAlternativesRoute
        });
      }

      if (new Date(startDate) < new Date(new Date().toDateString())) {
        throw APIError.NotFoundError('not found', 'error-404', {
          translations: error404Translations,
          isShowBtn: !isAlternativesRoute
        });
      }

      return next();
    } else {
      if (!isSpecialDate(endDate) && !isRound(endDate)) {
        throw APIError.NotFoundError('not found', 'error-404', {
          translations: error404Translations,
          isShowBtn: !isAlternativesRoute
        });
      }

      return next();
    }
  } catch (err) {
    return next(err);
  }
}

function checkIfBusFlightSelected(req, res, next) {
  try {
    const { languageCode = 'uk_UA' } = req.query;

    if (req.originalUrl.split('?')?.[0] === '/api/tickets') {
      console.log(
        'IS BUS FLIGHT SELECTED',
        req.session?.selectedBusFlight?.isSelected
      );
    }

    if (req.originalUrl.split('?')?.[0] === '/api/tickets/send') {
      console.log(
        'IS BUS FLIGHT SELECTED TICKET SEND',
        req.session?.selectedBusFlight?.isSelected
      );
    }

    if (req.session?.selectedBusFlight?.isSelected) {
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
  validateDates,
  checkIfBusFlightSelected
};
