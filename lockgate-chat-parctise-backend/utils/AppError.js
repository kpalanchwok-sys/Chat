/**
 * Custom operational error class.
 * Distinguishes expected errors (wrong password, 404, etc.)
 * from unexpected bugs so the global handler can respond accordingly.
 */
class AppError extends Error {
  constructor(message, statusCode = 500, code = null) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;          // Optional machine-readable code, e.g. 'TOKEN_EXPIRED'
    this.isOperational = true; // Marks it as a handled error (not a bug)
    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = AppError;
