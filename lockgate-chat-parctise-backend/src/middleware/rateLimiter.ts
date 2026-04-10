import { Request, Response } from "express";
import rateLimit, { RateLimitRequestHandler } from "express-rate-limit";
import slowDown from "express-slow-down";
import { error } from "../utils/response";

const windowMs = parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000; // 15 min
const isDevelopment = process.env.NODE_ENV !== "production";
const authWindowMs =
  parseInt(process.env.AUTH_RATE_LIMIT_WINDOW_MS || "") || windowMs;
const authMaxAttempts =
  parseInt(process.env.AUTH_RATE_LIMIT_MAX || "") || 10;
const authDevWindowMs =
  parseInt(process.env.AUTH_RATE_LIMIT_DEV_WINDOW_MS || "") || 60 * 1000;
const authDevMaxAttempts =
  parseInt(process.env.AUTH_RATE_LIMIT_DEV_MAX || "") || 100;

// ─── General API limiter ──────────────────────────────────────────────────────
const apiLimiter: RateLimitRequestHandler = rateLimit({
  windowMs,
  max: parseInt(process.env.RATE_LIMIT_MAX) || 100,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req: Request, res: Response) =>
    error(res, "Too many requests, please try again later.", 429),
});

// ─── Strict limiter for auth endpoints ───────────────────────────────────────
const authLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: isDevelopment ? authDevWindowMs : authWindowMs,
  max: isDevelopment ? authDevMaxAttempts : authMaxAttempts,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  handler: (req: Request, res: Response) =>
    error(
      res,
      isDevelopment
        ? "Too many login attempts for local development. Please wait a minute and try again."
        : "Too many login attempts. Please wait 15 minutes before trying again.",
      429,
    ),
});

// ─── Speed limiter: progressively slow down after 50 requests ─────────────
const speedLimiter = slowDown({
  windowMs,
  delayAfter: 50,
  delayMs: (hits: number) => (hits - 50) * 100,
});

// ─── File upload limiter ──────────────────────────────────────────────────────
const uploadLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  handler: (req: Request, res: Response) =>
    error(res, "Too many upload requests. Please slow down.", 429),
});

export { apiLimiter, authLimiter, speedLimiter, uploadLimiter };
