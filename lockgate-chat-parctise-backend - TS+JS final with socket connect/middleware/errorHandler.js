const logger = require('../utils/logger');
const AppError = require('../utils/AppError');

// Cast mongoose ObjectId error → 400
const handleCastError = (err) =>
  new AppError(`Invalid ${err.path}: ${err.value}`, 400, 'INVALID_ID');

// Mongoose duplicate key → 409
const handleDuplicateKey = (err) => {
  const field = Object.keys(err.keyValue)[0];
  return new AppError(`${field} is already taken`, 409, 'DUPLICATE_KEY');
};

// Mongoose validation error → 422
const handleValidationError = (err) => {
  const details = Object.values(err.errors).map((e) => ({
    field: e.path,
    message: e.message,
  }));
  const appErr = new AppError('Validation failed', 422, 'VALIDATION_ERROR');
  appErr.details = details;
  return appErr;
};

// Multer errors → 400
const handleMulterError = (err) => {
  if (err.code === 'LIMIT_FILE_SIZE') {
    return new AppError(`File too large. Max size is ${process.env.MAX_FILE_SIZE_MB || 10}MB`, 400, 'FILE_TOO_LARGE');
  }
  return new AppError(err.message || 'File upload error', 400, 'UPLOAD_ERROR');
};

// ─── Main error handler ───────────────────────────────────────────────────────
const errorHandler = (err, req, res, next) => {
  let error = err;

  // Transform known error types into AppError
  if (err.name === 'CastError') error = handleCastError(err);
  else if (err.code === 11000) error = handleDuplicateKey(err);
  else if (err.name === 'ValidationError') error = handleValidationError(err);
  else if (err.name === 'MulterError') error = handleMulterError(err);
  else if (!err.isOperational) {
    // Unknown / programmer errors — log fully but send generic message
    logger.error('UNHANDLED ERROR', { error: err.message, stack: err.stack, url: req.originalUrl });
    return res.status(500).json({
      success: false,
      message: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
      ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
    });
  }

  // Operational errors — safe to expose message
  if (process.env.NODE_ENV !== 'test') {
    logger.warn(`[${error.statusCode}] ${error.message}`, { code: error.code, url: req.originalUrl });
  }

  const body = {
    success: false,
    message: error.message,
    ...(error.code && { code: error.code }),
    ...(error.details && { details: error.details }),
  };

  res.status(error.statusCode || 500).json(body);
};

// 404 catch-all — must be added BEFORE errorHandler
const notFoundHandler = (req, res, next) => {
  next(new AppError(`Cannot ${req.method} ${req.originalUrl}`, 404, 'NOT_FOUND'));
};

module.exports = { errorHandler, notFoundHandler };
