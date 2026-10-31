/** @format */

const APIError = require('@exeptions/api-error');

function checkIfSessionIsStarted(req, res, next) {
  if (req.session?.isStarted) {
    return next();
  }

  return next(
    APIError.UnauthorizedError(
      'booking session not started or expired',
      APIError.codes.SESSION_NOT_STARTED
    )
  );
}

module.exports = {
  checkIfSessionIsStarted
};
