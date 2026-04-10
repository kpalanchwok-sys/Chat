const User = require('../models/User');
const { generateAccessToken, generateRefreshToken, verifyRefreshToken } = require('../config/jwt');
const AppError = require('../utils/AppError');

const issueTokens = async (user) => {
  const payload = { userId: user._id };
  const accessToken = generateAccessToken(payload);
  const refreshToken = generateRefreshToken(payload);

  // Persist hashed refresh token (store plain here; hash if extra security needed)
  await User.findByIdAndUpdate(user._id, { refreshToken });

  return { accessToken, refreshToken };
};

const register = async ({ username, email, password, bio }) => {
  const existing = await User.findOne({ $or: [{ email }, { username }] });
  if (existing) {
    const field = existing.email === email ? 'email' : 'username';
    throw new AppError(`This ${field} is already taken`, 409, 'DUPLICATE_KEY');
  }

  const user = await User.create({ username, email, password, bio });
  const tokens = await issueTokens(user);
  return { user, ...tokens };
};

const login = async ({ email, password }) => {
  const user = await User.findOne({ email }).select('+password +passwordChangedAt');
  if (!user || !(await user.comparePassword(password))) {
    throw new AppError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
  }
  if (user.isBanned) throw new AppError('Your account has been suspended', 403, 'ACCOUNT_BANNED');

  user.isOnline = true;
  await user.save({ validateBeforeSave: false });

  const tokens = await issueTokens(user);
  return { user, ...tokens };
};

const refreshTokens = async (token) => {
  const decoded = verifyRefreshToken(token); // throws if invalid/expired
  const user = await User.findById(decoded.userId).select('+refreshToken');

  if (!user || user.refreshToken !== token) {
    throw new AppError('Invalid refresh token', 401, 'INVALID_REFRESH');
  }

  const tokens = await issueTokens(user);
  return tokens;
};

const logout = async (userId) => {
  await User.findByIdAndUpdate(userId, {
    refreshToken: null,
    isOnline: false,
    lastSeen: new Date(),
  });
};

module.exports = { register, login, refreshTokens, logout };
