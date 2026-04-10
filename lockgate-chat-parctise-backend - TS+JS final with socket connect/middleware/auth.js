const User = require('../models/User');
const { verifyAccessToken } = require('../config/jwt');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');

// ─── HTTP middleware ───────────────────────────────────────────────────────────
const authenticate = asyncHandler(async (req, res, next) => {
  // 1. Extract token
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    throw new AppError('Access token required', 401, 'NO_TOKEN');
  }
  const token = authHeader.split(' ')[1];

  // 2. Verify token
  const decoded = verifyAccessToken(token); // throws AppError on failure

  // 3. Load user
  const user = await User.findById(decoded.userId).select('+passwordChangedAt');
  if (!user) throw new AppError('User no longer exists', 401, 'USER_NOT_FOUND');
  if (user.isBanned) throw new AppError('Your account has been suspended', 403, 'ACCOUNT_BANNED');

  // 4. Check password change after token issue
  if (user.changedPasswordAfter(decoded.iat)) {
    throw new AppError('Password recently changed. Please login again.', 401, 'PASSWORD_CHANGED');
  }

  req.user = user;
  next();
});

// ─── Role guard ───────────────────────────────────────────────────────────────
const requireRole = (...roles) =>
  asyncHandler(async (req, res, next) => {
    if (!req.user) throw new AppError('Not authenticated', 401);
    // req.groupRole is set by group-scoped middleware
    if (!roles.includes(req.groupRole)) {
      throw new AppError('You do not have permission to perform this action', 403, 'FORBIDDEN');
    }
    next();
  });

// ─── Socket.io middleware ─────────────────────────────────────────────────────
const authenticateSocket = async (socket, next) => {
  try {
    const token =
      socket.handshake.auth?.token ||
      socket.handshake.headers?.authorization?.replace('Bearer ', '');

    if (!token) return next(new Error('NO_TOKEN'));

    const decoded = verifyAccessToken(token);
    const user = await User.findById(decoded.userId);
    if (!user) return next(new Error('USER_NOT_FOUND'));
    if (user.isBanned) return next(new Error('ACCOUNT_BANNED'));

    socket.user = user;
    next();
  } catch (err) {
    next(new Error(err.code || 'AUTH_FAILED'));
  }
};

module.exports = { authenticate, requireRole, authenticateSocket };
