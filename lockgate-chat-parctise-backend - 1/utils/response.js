/**
 * Standardised API response helpers.
 * All responses follow the shape: { success, message, data?, meta?, error? }
 */

const success = (res, data = {}, message = 'Success', statusCode = 200) => {
  return res.status(statusCode).json({ success: true, message, data });
};

const created = (res, data = {}, message = 'Created successfully') => {
  return success(res, data, message, 201);
};

const paginated = (res, data, pagination, message = 'Success') => {
  return res.status(200).json({ success: true, message, data, meta: { pagination } });
};

const error = (res, message = 'Something went wrong', statusCode = 500, details = null) => {
  const body = { success: false, message };
  if (details) body.details = details;
  return res.status(statusCode).json(body);
};

const badRequest = (res, message = 'Bad request', details = null) =>
  error(res, message, 400, details);

const unauthorized = (res, message = 'Unauthorized') => error(res, message, 401);

const forbidden = (res, message = 'Forbidden') => error(res, message, 403);

const notFound = (res, message = 'Resource not found') => error(res, message, 404);

const conflict = (res, message = 'Conflict') => error(res, message, 409);

const validationError = (res, details) =>
  error(res, 'Validation failed', 422, details);

module.exports = { success, created, paginated, error, badRequest, unauthorized, forbidden, notFound, conflict, validationError };
