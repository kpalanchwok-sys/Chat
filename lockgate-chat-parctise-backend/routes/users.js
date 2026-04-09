const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { authenticate } = require('../middleware/auth');
const { uploadAvatar, getFileUrl } = require('../config/multer');
const { success } = require('../utils/response');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const { body, validationResult } = require('express-validator');
const xss = require('xss');

// GET /api/users/search?q=username
router.get('/search', authenticate, asyncHandler(async (req, res) => {
  const { q } = req.query;
  if (!q || q.trim().length < 2) throw new AppError('Search query must be at least 2 characters', 400);

  const users = await User.find({
    username: { $regex: q.trim(), $options: 'i' },
    _id: { $ne: req.user._id },
    isBanned: false,
  })
    .select('username avatar bio isOnline lastSeen')
    .limit(20);

  success(res, { users });
}));

// GET /api/users/:id — get public profile
router.get('/:id', authenticate, asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id).select('username avatar bio isOnline lastSeen createdAt');
  if (!user) throw new AppError('User not found', 404);
  success(res, { user });
}));

// PATCH /api/users/me — update own profile
router.patch('/me', authenticate,
  [
    body('bio').optional().isLength({ max: 200 }).withMessage('Bio max 200 characters'),
    body('username')
      .optional()
      .trim()
      .isLength({ min: 3, max: 30 }).withMessage('Username 3–30 chars')
      .matches(/^[a-zA-Z0-9_]+$/).withMessage('Letters, numbers, underscores only'),
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) throw new AppError('Validation failed', 422);

    const { bio, username } = req.body;
    const updates = {};

    if (username && username !== req.user.username) {
      const taken = await User.findOne({ username });
      if (taken) throw new AppError('Username is already taken', 409);
      updates.username = username;
    }

    if (bio !== undefined) updates.bio = xss(bio, { whiteList: {}, stripIgnoreTag: true });

    const user = await User.findByIdAndUpdate(req.user._id, updates, { new: true, runValidators: true });
    success(res, { user }, 'Profile updated');
  })
);

// POST /api/users/me/avatar — upload avatar
router.post('/me/avatar',
  authenticate,
  uploadAvatar.single('avatar'),
  asyncHandler(async (req, res) => {
    if (!req.file) throw new AppError('Avatar image is required', 400);
    const avatarUrl = getFileUrl(req, req.file.path);
    const user = await User.findByIdAndUpdate(req.user._id, { avatar: avatarUrl }, { new: true });
    success(res, { avatar: user.avatar }, 'Avatar updated');
  })
);

// PATCH /api/users/me/password — change password
router.patch('/me/password',
  authenticate,
  [
    body('currentPassword').notEmpty().withMessage('Current password is required'),
    body('newPassword')
      .isLength({ min: 8 }).withMessage('Min 8 characters')
      .matches(/[A-Z]/).withMessage('Must contain uppercase')
      .matches(/[0-9]/).withMessage('Must contain a number'),
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new AppError(errors.array()[0].msg, 422);
    }

    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user._id).select('+password');
    if (!(await user.comparePassword(currentPassword))) {
      throw new AppError('Current password is incorrect', 401);
    }

    user.password = newPassword;
    await user.save();

    // Invalidate all sessions
    await User.findByIdAndUpdate(req.user._id, { refreshToken: null });

    success(res, {}, 'Password changed. Please login again.');
  })
);

module.exports = router;
