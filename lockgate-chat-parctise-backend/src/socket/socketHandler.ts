import { Server, Socket } from "socket.io";
import { authenticateSocket } from "../middleware/auth";
import { Group } from "../models/Group";
import { IUser, User } from "../models/User";
import * as messageService from "../services/messageService";
import logger from "../utils/logger";

// In-memory map: userId -> Set of socketIds (supports multiple tabs)
const onlineUsers = new Map<string, Set<string>>();
// In-memory map: groupId -> Map of typing userIds
const typingUsers = new Map<string, Map<string, string>>();

const addOnlineUser = (userId: string, socketId: string): void => {
  if (!onlineUsers.has(userId)) onlineUsers.set(userId, new Set());
  onlineUsers.get(userId)!.add(socketId);
};

const removeOnlineUser = (userId: string, socketId: string): boolean => {
  const sockets = onlineUsers.get(userId);
  if (!sockets) return false;
  sockets.delete(socketId);
  if (sockets.size === 0) {
    onlineUsers.delete(userId);
    return true;
  }
  return false;
};

const isUserOnline = (userId: string): boolean =>
  onlineUsers.has(userId.toString());

const socketHandler = (io: Server): void => {
  io.use(authenticateSocket as any);

  io.on("connection", async (socket: Socket) => {
    const user = (socket as any).user as IUser;
    const userId = user._id.toString();

    logger.info(`🔌 Socket connected: ${user.username} (${socket.id})`);

    // ─── Online presence ────────────────────────────────────────────────────
    addOnlineUser(userId, socket.id);
    await User.findByIdAndUpdate(userId, { isOnline: true });

    // Auto-join all user's groups
    const groups = await Group.find({
      "members.user": userId,
      isActive: true,
    }).select("_id");
    const groupRooms = groups.map((g) => g._id.toString());
    if (groupRooms.length) socket.join(groupRooms);

    // Notify others that user is online
    groupRooms.forEach((roomId) => {
      socket
        .to(roomId)
        .emit("user:online", { userId, username: user.username });
    });

    // ─── Join a group room ──────────────────────────────────────────────────
    socket.on(
      "group:join",
      async ({ groupId }, ack?: (response: any) => void) => {
        try {
          const group = await Group.findById(groupId);
          if (!group?.isMember(userId)) {
            return ack?.({ error: "Not a member of this group" });
          }
          socket.join(groupId);
          ack?.({ success: true });
        } catch (err: any) {
          ack?.({ error: err.message });
        }
      },
    );

    // ─── Leave a group room ─────────────────────────────────────────────────
    socket.on("group:leave", ({ groupId }) => {
      socket.leave(groupId);
    });

    // ─── Send message ───────────────────────────────────────────────────────
    socket.on(
      "message:send",
      async (
        { groupId, content, type, replyTo },
        ack?: (response: any) => void,
      ) => {
        try {
          if (!content?.trim())
            return ack?.({ error: "Message content is required" });

          const message = await messageService.sendMessage({
            groupId,
            senderId: userId,
            content,
            type: type || "text",
            replyTo,
            files: [],
            req: { protocol: "http", get: () => "localhost:5000" } as any,
          });

          const populated = await message.populate([
            { path: "sender", select: "username avatar isOnline" },
            {
              path: "replyTo",
              populate: { path: "sender", select: "username avatar" },
            },
          ]);

          io.to(groupId).emit("message:new", { message: populated });
          clearTyping(io, groupId, userId, user.username);

          ack?.({ success: true, message: populated });
        } catch (err: any) {
          logger.error(`message:send error: ${err.message}`);
          ack?.({ error: err.message });
        }
      },
    );

    // ─── Edit message ───────────────────────────────────────────────────────
    socket.on(
      "message:edit",
      async (
        { messageId, groupId, content },
        ack?: (response: any) => void,
      ) => {
        try {
          const message = await messageService.editMessage(
            messageId,
            userId,
            content,
          );
          io.to(groupId).emit("message:edited", { message });
          ack?.({ success: true, message });
        } catch (err: any) {
          ack?.({ error: err.message });
        }
      },
    );

    // ─── Delete message ─────────────────────────────────────────────────────
    socket.on(
      "message:delete",
      async ({ messageId, groupId }, ack?: (response: any) => void) => {
        try {
          const message = await messageService.deleteMessage(
            messageId,
            userId,
            groupId,
          );
          io.to(groupId).emit("message:deleted", { messageId, groupId });
          ack?.({ success: true });
        } catch (err: any) {
          ack?.({ error: err.message });
        }
      },
    );

    // ─── React to message ───────────────────────────────────────────────────
    socket.on(
      "message:react",
      async ({ messageId, groupId, emoji }, ack?: (response: any) => void) => {
        try {
          const message = await messageService.toggleReaction(
            messageId,
            userId,
            emoji,
          );
          io.to(groupId).emit("message:reacted", {
            messageId,
            reactions: message.reactions,
          });
          ack?.({ success: true });
        } catch (err: any) {
          ack?.({ error: err.message });
        }
      },
    );

    // ─── Typing indicators ──────────────────────────────────────────────────
    socket.on("typing:start", ({ groupId }) => {
      if (!typingUsers.has(groupId)) typingUsers.set(groupId, new Map());
      typingUsers.get(groupId)!.set(userId, user.username);

      socket.to(groupId).emit("typing:update", {
        groupId,
        typingUsers: Array.from(
          typingUsers.get(groupId) || new Map(),
          ([id, name]) => ({ userId: id, username: name }),
        ),
      });

      setTimeout(() => clearTyping(io, groupId, userId, user.username), 5000);
    });

    socket.on("typing:stop", ({ groupId }) => {
      clearTyping(io, groupId, userId, user.username);
    });

    // ─── Mark messages as read ──────────────────────────────────────────────
    socket.on(
      "messages:read",
      async ({ groupId }, ack?: (response: any) => void) => {
        try {
          await messageService.markAsRead(groupId, userId);
          socket.to(groupId).emit("messages:read", { groupId, userId });
          ack?.({ success: true });
        } catch (err: any) {
          ack?.({ error: err.message });
        }
      },
    );

    // ─── Disconnect ─────────────────────────────────────────────────────────
    socket.on("disconnect", async (reason: string) => {
      logger.info(
        `🔌 Socket disconnected: ${user.username} (${socket.id}) — ${reason}`,
      );

      const fullyOffline = removeOnlineUser(userId, socket.id);
      if (fullyOffline) {
        const lastSeen = new Date();
        await User.findByIdAndUpdate(userId, { isOnline: false, lastSeen });

        groupRooms.forEach((roomId) => {
          socket
            .to(roomId)
            .emit("user:offline", {
              userId,
              username: user.username,
              lastSeen,
            });
          clearTyping(io, roomId, userId, user.username);
        });
      }
    });

    // ─── Error handler ──────────────────────────────────────────────────────
    socket.on("error", (err: any) => {
      logger.error(`Socket error (${user.username}): ${err.message}`);
    });
  });
};

// ─── Helper: clear typing indicator ──────────────────────────────────────────
const clearTyping = (
  io: Server,
  groupId: string,
  userId: string,
  username: string,
): void => {
  const group = typingUsers.get(groupId);
  if (!group) return;
  group.delete(userId);
  if (group.size === 0) typingUsers.delete(groupId);

  io.to(groupId).emit("typing:update", {
    groupId,
    typingUsers: Array.from(
      typingUsers.get(groupId) || new Map(),
      ([id, name]) => ({ userId: id, username: name }),
    ),
  });
};

export { isUserOnline, onlineUsers, socketHandler };
