import { Request, Response } from "express";
import rateLimit, { RateLimitRequestHandler } from "express-rate-limit";
import slowDown from "express-slow-down";
import { error } from "../utils/response";

const windowMs = parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000; // 15 min

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
  windowMs: 15 * 60 * 1000,
  max: parseInt(process.env.AUTH_RATE_LIMIT_MAX) || 10,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  handler: (req: Request, res: Response) =>
    error(
      res,
      "Too many login attempts. Please wait 15 minutes before trying again.",
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
