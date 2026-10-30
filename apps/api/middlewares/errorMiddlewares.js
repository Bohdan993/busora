/** @format */

const APIError = require('@exeptions/api-error');
const AdminAPIError = require('@exeptions/admin/api-error');

function handleError(err, req, res, next) {
  console.error('[API error]: ', err);

  if (err instanceof APIError) {
    if (err.template !== '') {
      return res.status(err.status).render(err.template, err.options);
    }

    return res
      .status(err.status)
      .json({ status: err.message, error: err.errors });
  }

  if (err instanceof AdminAPIError) {
    return res
      .status(err.status)
      .json({ status: err.message, error: err.errors });
  }

  return res
    .status(500)
    .json({ status: 'fail', error: err?.message || 'Server error' });
}

module.exports = {
  handleError
};
