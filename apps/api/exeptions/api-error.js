/**
 * Machine-readable error codes of the public API. Clients branch on these and
 * localise the text themselves; `message` is meant for developers.
 */
const ERROR_CODES = Object.freeze({
  BAD_REQUEST: 'BAD_REQUEST',
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  NOT_FOUND: 'NOT_FOUND',
  INVALID_DATES: 'INVALID_DATES',
  NO_FLIGHTS: 'NO_FLIGHTS',
  NO_FREE_SEATS: 'NO_FREE_SEATS',
  NO_ALTERNATIVES: 'NO_ALTERNATIVES',
  SESSION_NOT_STARTED: 'SESSION_NOT_STARTED',
  FLIGHT_NOT_SELECTED: 'FLIGHT_NOT_SELECTED',
  PASSENGERS_MISSING: 'PASSENGERS_MISSING'
});

class APIError extends Error {
  status;
  code;
  errors;

  constructor(status, message, code, errors = []) {
    super(message);
    this.status = status;
    this.code = code;
    this.errors = errors;
  }

  static BadRequestError(message, errors = [], code = ERROR_CODES.BAD_REQUEST) {
    return new APIError(400, message, code, errors);
  }

  static UnauthorizedError(message, code) {
    return new APIError(401, message, code);
  }

  static NotFoundError(message, code = ERROR_CODES.NOT_FOUND) {
    return new APIError(404, message, code);
  }

  static ValidationError(message, errors = []) {
    return new APIError(422, message, ERROR_CODES.VALIDATION_FAILED, errors);
  }
}

APIError.codes = ERROR_CODES;

module.exports = APIError;
