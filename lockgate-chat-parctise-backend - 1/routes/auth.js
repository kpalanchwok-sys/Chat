const express = require('express');
const router = express.Router();
const authService = require('../services/authService');
const { authenticate } = require('../middleware/auth');
const { registerRules, loginRules } = require('../middleware/validate');
const { authLimiter } = require('../middleware/rateLimiter');
const { success, created } = require('../utils/response');
const asyncHandler = require('../utils/asyncHandler');

// POST /api/auth/register
router.post('/register', authLimiter, registerRules, asyncHandler(async (req, res) => {
  const { username, email, password, bio } = req.body;
  const result = await authService.register({ username, email, password, bio });
  created(res, result, 'Account created successfully');
}));

// POST /api/auth/login
router.post('/login', authLimiter, loginRules, asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const result = await authService.login({ email, password });
  success(res, result, 'Login successful');
}));

// POST /api/auth/refresh
router.post('/refresh', asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) {
    return res.status(400).json({ success: false, message: 'Refresh token required' });
  }
  const tokens = await authService.refreshTokens(refreshToken);
  success(res, tokens, 'Tokens refreshed');
}));

// POST /api/auth/logout
router.post('/logout', authenticate, asyncHandler(async (req, res) => {
  await authService.logout(req.user._id);
  success(res, {}, 'Logged out successfully');
}));

// GET /api/auth/me
router.get('/me', authenticate, (req, res) => {
  success(res, { user: req.user });
});

module.exports = router;
