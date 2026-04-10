/**
 * Custom operational error class.
 * Distinguishes expected errors (wrong password, 404, etc.)
 * from unexpected bugs so the global handler can respond accordingly.
 */
class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string | null;
  public readonly isOperational: boolean;
  public details?: any;

  constructor(
    message: string,
    statusCode: number = 500,
    code: string | null = null,
  ) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

export default AppError;
