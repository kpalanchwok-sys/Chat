import { Response } from "express";

interface PaginationMeta {
  pagination: {
    page?: number;
    limit?: number;
    total?: number;
    pages?: number;
  };
}

/**
 * Standardised API response helpers.
 * All responses follow the shape: { success, message, data?, meta?, error? }
 */

const success = (
  res: Response,
  data: any = {},
  message: string = "Success",
  statusCode: number = 200,
): Response => {
  return res.status(statusCode).json({ success: true, message, data });
};

const created = (
  res: Response,
  data: any = {},
  message: string = "Created successfully",
): Response => {
  return success(res, data, message, 201);
};

const paginated = (
  res: Response,
  data: any,
  pagination: any,
  message: string = "Success",
): Response => {
  return res
    .status(200)
    .json({ success: true, message, data, meta: { pagination } });
};

const error = (
  res: Response,
  message: string = "Something went wrong",
  statusCode: number = 500,
  details: any = null,
): Response => {
  const body: any = { success: false, message };
  if (details) body.details = details;
  return res.status(statusCode).json(body);
};

const badRequest = (
  res: Response,
  message: string = "Bad request",
  details: any = null,
): Response => error(res, message, 400, details);

const unauthorized = (
  res: Response,
  message: string = "Unauthorized",
): Response => error(res, message, 401);

const forbidden = (res: Response, message: string = "Forbidden"): Response =>
  error(res, message, 403);

const notFound = (
  res: Response,
  message: string = "Resource not found",
): Response => error(res, message, 404);

const conflict = (res: Response, message: string = "Conflict"): Response =>
  error(res, message, 409);

const validationError = (res: Response, details: any): Response =>
  error(res, "Validation failed", 422, details);

export {
  badRequest,
  conflict,
  created,
  error,
  forbidden,
  notFound,
  paginated,
  success,
  unauthorized,
  validationError,
};
