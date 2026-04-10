const rateLimit = require('express-rate-limit');
const slowDown = require('express-slow-down');
const { error } = require('../utils/response');

const windowMs = parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000; // 15 min

// ─── General API limiter ──────────────────────────────────────────────────────
const apiLimiter = rateLimit({
  windowMs,
  max: parseInt(process.env.RATE_LIMIT_MAX) || 100,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) =>
    error(res, 'Too many requests, please try again later.', 429),
});

// ─── Strict limiter for auth endpoints ───────────────────────────────────────
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: parseInt(process.env.AUTH_RATE_LIMIT_MAX) || 10,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // only count failed attempts
  handler: (req, res) =>
    error(res, 'Too many login attempts. Please wait 15 minutes before trying again.', 429),
});

// ─── Speed limiter: progressively slow down after 50 requests ─────────────
const speedLimiter = slowDown({
  windowMs,
  delayAfter: 50,
  delayMs: (hits) => (hits - 50) * 100, // add 100ms per request above 50
});

// ─── File upload limiter ──────────────────────────────────────────────────────
const uploadLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 min
  max: 20,
  handler: (req, res) =>
    error(res, 'Too many upload requests. Please slow down.', 429),
});

module.exports = { apiLimiter, authLimiter, speedLimiter, uploadLimiter };
