const express = require('express');
const router = express.Router();
const groupService = require('../services/groupService');
const { authenticate } = require('../middleware/auth');
const { createGroupRules, updateGroupRules, mongoId, paginationRules } = require('../middleware/validate');
const { uploadAvatar, getFileUrl } = require('../config/multer');
const { success, created, paginated } = require('../utils/response');
const asyncHandler = require('../utils/asyncHandler');
const { body, validationResult } = require('express-validator');
const AppError = require('../utils/AppError');

// GET /api/groups — browse public groups
router.get('/', authenticate, paginationRules, asyncHandler(async (req, res) => {
  const { search, page, limit } = req.query;
  const result = await groupService.browseGroups({ search, page, limit });
  paginated(res, result.groups, {
    page: result.page,
    limit: result.limit,
    total: result.total,
    pages: Math.ceil(result.total / result.limit),
  });
}));

// GET /api/groups/my — groups the user has joined
router.get('/my', authenticate, asyncHandler(async (req, res) => {
  const groups = await groupService.getUserGroups(req.user._id);
  success(res, { groups });
}));

// POST /api/groups — create group
router.post('/', authenticate, createGroupRules, asyncHandler(async (req, res) => {
  const { name, description, type, maxMembers, tags } = req.body;
  const group = await groupService.createGroup({ name, description, type, maxMembers, tags }, req.user._id);
  created(res, { group }, 'Group created successfully');
}));

// POST /api/groups/join-invite — join via invite code
router.post('/join-invite', authenticate, asyncHandler(async (req, res) => {
  const { inviteCode } = req.body;
  if (!inviteCode) throw new AppError('Invite code is required', 400);
  const group = await groupService.joinByInvite(inviteCode, req.user);
  success(res, { group }, 'Joined group successfully');
}));

// GET /api/groups/:id — get group details
router.get('/:id', authenticate, mongoId('id'), asyncHandler(async (req, res) => {
  const group = await groupService.getGroupById(req.params.id, req.user._id);
  success(res, { group });
}));

// POST /api/groups/:id/join — join a public group
router.post('/:id/join', authenticate, mongoId('id'), asyncHandler(async (req, res) => {
  const group = await groupService.joinGroup(req.params.id, req.user);
  success(res, { group }, 'Joined group successfully');
}));

// POST /api/groups/:id/leave — leave a group
router.post('/:id/leave', authenticate, mongoId('id'), asyncHandler(async (req, res) => {
  await groupService.leaveGroup(req.params.id, req.user);
  success(res, {}, 'Left group successfully');
}));

// PATCH /api/groups/:id — update group info (admin only)
router.patch('/:id', authenticate, mongoId('id'), updateGroupRules, asyncHandler(async (req, res) => {
  const group = await groupService.updateGroup(req.params.id, req.body, req.user._id);
  success(res, { group }, 'Group updated');
}));

// DELETE /api/groups/:id — delete group (owner only)
router.delete('/:id', authenticate, mongoId('id'), asyncHandler(async (req, res) => {
  await groupService.deleteGroup(req.params.id, req.user._id);
  success(res, {}, 'Group deleted');
}));

// GET /api/groups/:id/members — list members
router.get('/:id/members', authenticate, mongoId('id'), asyncHandler(async (req, res) => {
  const group = await groupService.getGroupById(req.params.id, req.user._id);
  success(res, { members: group.members, memberCount: group.memberCount });
}));

// PATCH /api/groups/:id/members/:userId/role — update member role (admin only)
router.patch('/:id/members/:userId/role',
  authenticate,
  asyncHandler(async (req, res) => {
    const { role } = req.body;
    const validRoles = ['member', 'moderator', 'admin'];
    if (!validRoles.includes(role)) throw new AppError(`Role must be one of: ${validRoles.join(', ')}`, 400);
    const group = await groupService.updateMemberRole(req.params.id, req.params.userId, role, req.user._id);
    success(res, { group }, 'Member role updated');
  })
);

// DELETE /api/groups/:id/members/:userId — kick member (moderator+)
router.delete('/:id/members/:userId',
  authenticate,
  asyncHandler(async (req, res) => {
    await groupService.kickMember(req.params.id, req.params.userId, req.user._id);
    success(res, {}, 'Member removed from group');
  })
);

// POST /api/groups/:id/invite/regenerate — regenerate invite code (admin only)
router.post('/:id/invite/regenerate', authenticate, mongoId('id'), asyncHandler(async (req, res) => {
  const inviteCode = await groupService.regenerateInviteCode(req.params.id, req.user._id);
  success(res, { inviteCode }, 'Invite code regenerated');
}));

// POST /api/groups/:id/avatar — upload group avatar (admin only)
router.post('/:id/avatar',
  authenticate,
  mongoId('id'),
  uploadAvatar.single('avatar'),
  asyncHandler(async (req, res) => {
    if (!req.file) throw new AppError('Avatar image required', 400);
    const avatarUrl = getFileUrl(req, req.file.path);
    const group = await groupService.updateGroup(req.params.id, { avatar: avatarUrl }, req.user._id);
    success(res, { avatar: group.avatar }, 'Group avatar updated');
  })
);

module.exports = router;
