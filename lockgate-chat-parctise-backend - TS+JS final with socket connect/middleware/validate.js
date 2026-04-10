const { body, param, query, validationResult } = require('express-validator');
const { validationError } = require('../utils/response');

// Run validation and send 422 if any errors found
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return validationError(
      res,
      errors.array().map((e) => ({ field: e.path, message: e.msg }))
    );
  }
  next();
};

// ─── Auth ─────────────────────────────────────────────────────────────────────
const registerRules = [
  body('username')
    .trim()
    .isLength({ min: 3, max: 30 }).withMessage('Username must be 3–30 characters')
    .matches(/^[a-zA-Z0-9_]+$/).withMessage('Username: letters, numbers, underscores only'),
  body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
  body('password')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
    .matches(/[A-Z]/).withMessage('Password must contain at least one uppercase letter')
    .matches(/[0-9]/).withMessage('Password must contain at least one number'),
  validate,
];

const loginRules = [
  body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
  body('password').notEmpty().withMessage('Password is required'),
  validate,
];

// ─── Groups ───────────────────────────────────────────────────────────────────
const createGroupRules = [
  body('name').trim().isLength({ min: 2, max: 60 }).withMessage('Group name must be 2–60 characters'),
  body('description').optional().isLength({ max: 500 }).withMessage('Max 500 characters'),
  body('type').optional().isIn(['public', 'private']).withMessage('Type: public or private'),
  body('maxMembers').optional().isInt({ min: 2, max: 5000 }).withMessage('maxMembers: 2–5000'),
  validate,
];

const updateGroupRules = [
  body('name').optional().trim().isLength({ min: 2, max: 60 }).withMessage('Group name must be 2–60 characters'),
  body('description').optional().isLength({ max: 500 }).withMessage('Max 500 characters'),
  body('maxMembers').optional().isInt({ min: 2, max: 5000 }).withMessage('maxMembers: 2–5000'),
  validate,
];

// ─── Messages ─────────────────────────────────────────────────────────────────
const sendMessageRules = [
  body('content').optional().isLength({ max: 4000 }).withMessage('Max 4000 characters'),
  body('type').optional().isIn(['text', 'image', 'file', 'reply']).withMessage('Invalid type'),
  body('replyTo').optional().isMongoId().withMessage('Invalid replyTo message ID'),
  body().custom((_, { req }) => {
    if (!req.body.content?.trim() && (!req.files || req.files.length === 0)) {
      throw new Error('Message must have content or at least one attachment');
    }
    return true;
  }),
  validate,
];

const editMessageRules = [
  body('content').trim().notEmpty().withMessage('Content is required').isLength({ max: 4000 }),
  validate,
];

// ─── Params ───────────────────────────────────────────────────────────────────
const mongoId = (name) => [
  param(name).isMongoId().withMessage(`Invalid ${name}`),
  validate,
];

// ─── Pagination ───────────────────────────────────────────────────────────────
const paginationRules = [
  query('page').optional().isInt({ min: 1 }).withMessage('page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('limit must be 1–100'),
  validate,
];

module.exports = {
  registerRules,
  loginRules,
  createGroupRules,
  updateGroupRules,
  sendMessageRules,
  editMessageRules,
  mongoId,
  paginationRules,
};
