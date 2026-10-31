/** @format */

const APIError = require('@exeptions/api-error');

function checkIfPassengersInfoExists(req, res, next) {
  if (req.session?.passengersInfo) {
    return next();
  }

  return next(
    APIError.UnauthorizedError(
      'passenger details missing',
      APIError.codes.PASSENGERS_MISSING
    )
  );
}

module.exports = {
  checkIfPassengersInfoExists
};
