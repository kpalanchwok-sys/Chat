const Message = require('../models/Message');
const Group = require('../models/Group');
const AppError = require('../utils/AppError');
const xss = require('xss');
const path = require('path');
const fs = require('fs');

// ─── Helpers ──────────────────────────────────────────────────────────────────
const sanitize = (str) => xss(str, { whiteList: {}, stripIgnoreTag: true });

const buildAttachments = (files = [], req) => {
  return files.map((file) => {
    const isImage = file.mimetype.startsWith('image/');
    const subDir = isImage ? 'images' : 'files';
    const relativePath = `${subDir}/${file.filename}`;
    const url = `${req.protocol}://${req.get('host')}/uploads/${relativePath}`;
    return {
      url,
      filename: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
    };
  });
};

// ─── Service ──────────────────────────────────────────────────────────────────
const getMessages = async (groupId, userId, { page = 1, limit = 30, before }) => {
  const group = await Group.findById(groupId);
  if (!group || !group.isActive) throw new AppError('Group not found', 404);
  if (!group.isMember(userId)) throw new AppError('Join the group to view messages', 403);

  const filter = { group: groupId, isDeleted: false };
  if (before) filter.createdAt = { $lt: new Date(before) };

  const messages = await Message.find(filter)
    .populate('sender', 'username avatar isOnline')
    .populate({ path: 'replyTo', populate: { path: 'sender', select: 'username avatar' } })
    .sort({ createdAt: -1 })
    .limit(Number(limit))
    .skip((page - 1) * limit);

  const total = await Message.countDocuments(filter);

  return {
    messages: messages.reverse(), // chronological order
    pagination: { page: Number(page), limit: Number(limit), total },
  };
};

const sendMessage = async ({ groupId, senderId, content, type = 'text', replyTo, files = [], req }) => {
  const group = await Group.findById(groupId);
  if (!group || !group.isActive) throw new AppError('Group not found', 404);
  if (!group.isMember(senderId)) throw new AppError('Join the group to send messages', 403);
  if (group.isMuted(senderId)) throw new AppError('You are muted in this group', 403, 'USER_MUTED');

  if (!content?.trim() && files.length === 0) {
    throw new AppError('Message must have content or at least one attachment', 400);
  }

  // Validate replyTo
  if (replyTo) {
    const parent = await Message.findOne({ _id: replyTo, group: groupId });
    if (!parent) throw new AppError('Replied-to message not found', 404);
  }

  const attachments = buildAttachments(files, req);

  const message = await Message.create({
    group: groupId,
    sender: senderId,
    content: content ? sanitize(content.trim()) : '',
    type: files.length > 0 ? (files[0].mimetype.startsWith('image/') ? 'image' : 'file') : type,
    replyTo: replyTo || null,
    attachments,
  });

  // Update group's lastMessage and lastActivity
  await Group.findByIdAndUpdate(groupId, {
    lastMessage: message._id,
    lastActivity: new Date(),
  });

  return message.populate([
    { path: 'sender', select: 'username avatar' },
    { path: 'replyTo', populate: { path: 'sender', select: 'username avatar' } },
  ]);
};

const editMessage = async (messageId, userId, newContent) => {
  const message = await Message.findById(messageId);
  if (!message) throw new AppError('Message not found', 404);
  if (message.isDeleted) throw new AppError('Cannot edit a deleted message', 400);
  if (message.sender.toString() !== userId.toString()) {
    throw new AppError('You can only edit your own messages', 403);
  }

  message.content = sanitize(newContent.trim());
  message.isEdited = true;
  message.editedAt = new Date();
  await message.save();

  return message.populate('sender', 'username avatar');
};

const deleteMessage = async (messageId, userId, groupId) => {
  const message = await Message.findById(messageId);
  if (!message) throw new AppError('Message not found', 404);
  if (message.isDeleted) throw new AppError('Message already deleted', 400);

  // Allow sender or group admin to delete
  const group = await Group.findById(groupId);
  const isSender = message.sender.toString() === userId.toString();
  const isGroupAdmin = group?.isModerator(userId);

  if (!isSender && !isGroupAdmin) {
    throw new AppError('You cannot delete this message', 403);
  }

  // Soft delete (preserve record, hide content)
  message.isDeleted = true;
  message.deletedAt = new Date();

  // Clean up uploaded files
  if (message.attachments.length > 0) {
    message.attachments.forEach((att) => {
      try {
        const urlPath = new URL(att.url).pathname;
        const filePath = path.join(process.cwd(), urlPath);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      } catch (_) {}
    });
    message.attachments = [];
  }

  await message.save();
  return message;
};

const toggleReaction = async (messageId, userId, emoji) => {
  const message = await Message.findById(messageId);
  if (!message || message.isDeleted) throw new AppError('Message not found', 404);

  const existing = message.reactions.find((r) => r.emoji === emoji);
  if (existing) {
    const hasReacted = existing.users.some((u) => u.toString() === userId.toString());
    if (hasReacted) {
      existing.users = existing.users.filter((u) => u.toString() !== userId.toString());
      if (existing.users.length === 0) {
        message.reactions = message.reactions.filter((r) => r.emoji !== emoji);
      }
    } else {
      existing.users.push(userId);
    }
  } else {
    message.reactions.push({ emoji, users: [userId] });
  }

  await message.save();
  return message;
};

const markAsRead = async (groupId, userId) => {
  const now = new Date();
  await Message.updateMany(
    { group: groupId, 'readBy.user': { $ne: userId }, sender: { $ne: userId } },
    { $push: { readBy: { user: userId, readAt: now } } }
  );
};

const pinMessage = async (messageId, groupId, userId) => {
  const group = await Group.findById(groupId);
  if (!group || !group.isActive) throw new AppError('Group not found', 404);
  if (!group.isAdmin(userId)) throw new AppError('Admin access required', 403);

  const message = await Message.findOne({ _id: messageId, group: groupId });
  if (!message) throw new AppError('Message not found', 404);

  const isPinned = group.pinnedMessages.some((id) => id.toString() === messageId);
  if (isPinned) {
    group.pinnedMessages = group.pinnedMessages.filter((id) => id.toString() !== messageId);
  } else {
    if (group.pinnedMessages.length >= 5) throw new AppError('Max 5 pinned messages allowed', 400);
    group.pinnedMessages.push(messageId);
  }

  await group.save();
  return { pinned: !isPinned };
};

module.exports = { getMessages, sendMessage, editMessage, deleteMessage, toggleReaction, markAsRead, pinMessage };
