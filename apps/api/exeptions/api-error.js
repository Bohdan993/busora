class APIError extends Error {
  status;
  template;
  options;
  errors;
  date;

  constructor(
    status,
    message,
    template = '',
    options = {},
    errors = [],
    date = '(Date: ' + new Date().toUTCString() + ')'
  ) {
    super(message);
    this.status = status;
    this.template = template;
    this.options = options;
    this.errors = errors;
    this.date = date;
  }

  static BadRequestError(message, errors = []) {
    return new APIError(400, message, '', {}, errors);
  }

  static UnauthorizedError(message, template, options = {}) {
    return new APIError(401, message, template, options);
  }

  static NotFoundError(message, template, options = {}) {
    return new APIError(404, message, template, options);
  }

  static ValidationError(message, errors = []) {
    return new APIError(422, message, '', {}, errors);
  }
}

module.exports = APIError;
