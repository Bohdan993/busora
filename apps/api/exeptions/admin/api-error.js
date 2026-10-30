class AdminAPIError extends Error {
  status;
  errors;
  date;

  constructor(
    status,
    message,
    errors = [],
    date = '(Date: ' + new Date().toUTCString() + ')'
  ) {
    super(message);
    this.status = status;
    this.errors = errors;
    this.date = date;
  }

  static UnauthorizedError() {
    return new AdminAPIError(401, 'Користувач не авторизований');
  }

  static BadRequestError(message, errors = []) {
    return new AdminAPIError(400, message, errors);
  }

  static ForbiddenError(message = 'Доступ заборонено', errors = []) {
    return new AdminAPIError(403, message, errors);
  }

  static NotFoundError(message) {
    return new AdminAPIError(404, message);
  }

  static ValidationError(message, errors = []) {
    return new AdminAPIError(422, message, errors);
  }
}

module.exports = AdminAPIError;
