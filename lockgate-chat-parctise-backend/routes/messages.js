const express = require('express');
const router = express.Router({ mergeParams: true }); // groupId from parent
const messageService = require('../services/messageService');
const { authenticate } = require('../middleware/auth');
const { sendMessageRules, editMessageRules, paginationRules } = require('../middleware/validate');
const { upload } = require('../config/multer');
const { uploadLimiter } = require('../middleware/rateLimiter');
const { success, created } = require('../utils/response');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');

// GET /api/groups/:groupId/messages — paginated message history
router.get('/', authenticate, paginationRules, asyncHandler(async (req, res) => {
  const { page, limit, before } = req.query;
  const result = await messageService.getMessages(req.params.groupId, req.user._id, { page, limit, before });
  success(res, result);
}));

// POST /api/groups/:groupId/messages — send a message (text or with files)
router.post('/',
  authenticate,
  uploadLimiter,
  upload.array('files', 5), // up to 5 attachments
  sendMessageRules,
  asyncHandler(async (req, res) => {
    const { content, type, replyTo } = req.body;
    const message = await messageService.sendMessage({
      groupId: req.params.groupId,
      senderId: req.user._id,
      content,
      type,
      replyTo,
      files: req.files || [],
      req,
    });
    created(res, { message }, 'Message sent');
  })
);

// PATCH /api/groups/:groupId/messages/:messageId — edit message
router.patch('/:messageId',
  authenticate,
  editMessageRules,
  asyncHandler(async (req, res) => {
    const message = await messageService.editMessage(
      req.params.messageId,
      req.user._id,
      req.body.content
    );
    success(res, { message }, 'Message updated');
  })
);

// DELETE /api/groups/:groupId/messages/:messageId — soft delete
router.delete('/:messageId',
  authenticate,
  asyncHandler(async (req, res) => {
    const message = await messageService.deleteMessage(
      req.params.messageId,
      req.user._id,
      req.params.groupId
    );
    success(res, { message }, 'Message deleted');
  })
);

// POST /api/groups/:groupId/messages/:messageId/react — toggle reaction
router.post('/:messageId/react',
  authenticate,
  asyncHandler(async (req, res) => {
    const { emoji } = req.body;
    if (!emoji || typeof emoji !== 'string' || emoji.length > 10) {
      throw new AppError('Valid emoji is required', 400);
    }
    const message = await messageService.toggleReaction(req.params.messageId, req.user._id, emoji);
    success(res, { reactions: message.reactions }, 'Reaction toggled');
  })
);

// POST /api/groups/:groupId/messages/read — mark all as read
router.post('/read',
  authenticate,
  asyncHandler(async (req, res) => {
    await messageService.markAsRead(req.params.groupId, req.user._id);
    success(res, {}, 'Messages marked as read');
  })
);

// POST /api/groups/:groupId/messages/:messageId/pin — pin/unpin (admin)
router.post('/:messageId/pin',
  authenticate,
  asyncHandler(async (req, res) => {
    const result = await messageService.pinMessage(
      req.params.messageId,
      req.params.groupId,
      req.user._id
    );
    success(res, result, result.pinned ? 'Message pinned' : 'Message unpinned');
  })
);

module.exports = router;
