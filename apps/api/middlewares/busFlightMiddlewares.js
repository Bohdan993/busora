/** @format */

const { isSpecialDate, isValidDate, isRound } = require('@helpers');
const APIError = require('@exeptions/api-error');

const POSITIVE_INTEGER = /^[1-9]\d*$/;

function invalidDates() {
  return APIError.BadRequestError(
    'invalid travel dates',
    [],
    APIError.codes.INVALID_DATES
  );
}

function validateDates(req, res, next) {
  const { startDate = null, endDate = null } = req?.query ?? {};
  const start = new Date(startDate);
  const end = new Date(endDate);

  if (isValidDate(start) && isValidDate(end)) {
    if (start >= end || start < new Date(new Date().toDateString())) {
      return next(invalidDates());
    }
    return next();
  }

  if (!isSpecialDate(endDate) && !isRound(endDate)) {
    return next(invalidDates());
  }

  return next();
}

/**
 * City ids reach a raw JSON_CONTAINS literal in the alternatives query, so
 * only positive integers are let through.
 */
function validateCityIds(req, res, next) {
  const { originId, destinationId } = req?.query ?? {};
  const invalid = ['originId', 'destinationId'].filter(
    (field) => !POSITIVE_INTEGER.test(String(req.query?.[field] ?? ''))
  );

  if (invalid.length || originId === destinationId) {
    return next(
      APIError.BadRequestError(
        'originId and destinationId must be different positive integers',
        invalid.map((field) => ({ field, message: 'positive integer' }))
      )
    );
  }

  return next();
}

function checkIfBusFlightSelected(req, res, next) {
  if (req.session?.selectedBusFlight?.isSelected) {
    return next();
  }

  return next(
    APIError.UnauthorizedError(
      'no bus flight selected',
      APIError.codes.FLIGHT_NOT_SELECTED
    )
  );
}

module.exports = {
  validateDates,
  validateCityIds,
  checkIfBusFlightSelected
};
