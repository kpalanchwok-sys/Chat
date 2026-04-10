const jwt = require('jsonwebtoken');
const AppError = require('../utils/AppError');

const {
  JWT_SECRET,
  JWT_EXPIRES_IN = '15m',
  JWT_REFRESH_SECRET,
  JWT_REFRESH_EXPIRES_IN = '30d',
} = process.env;

if (!JWT_SECRET || !JWT_REFRESH_SECRET) {
  throw new Error('JWT_SECRET and JWT_REFRESH_SECRET must be set in environment variables');
}

const generateAccessToken = (payload) =>
  jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

const generateRefreshToken = (payload) =>
  jwt.sign(payload, JWT_REFRESH_SECRET, { expiresIn: JWT_REFRESH_EXPIRES_IN });

const verifyAccessToken = (token) => {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (err) {
    if (err.name === 'TokenExpiredError') throw new AppError('Access token expired', 401, 'TOKEN_EXPIRED');
    throw new AppError('Invalid access token', 401, 'INVALID_TOKEN');
  }
};

const verifyRefreshToken = (token) => {
  try {
    return jwt.verify(token, JWT_REFRESH_SECRET);
  } catch (err) {
    if (err.name === 'TokenExpiredError') throw new AppError('Refresh token expired, please login again', 401, 'REFRESH_EXPIRED');
    throw new AppError('Invalid refresh token', 401, 'INVALID_REFRESH');
  }
};

module.exports = { generateAccessToken, generateRefreshToken, verifyAccessToken, verifyRefreshToken };
