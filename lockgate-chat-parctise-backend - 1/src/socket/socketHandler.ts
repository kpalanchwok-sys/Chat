import { Server, Socket } from "socket.io";
import { authenticateSocket } from "../middleware/auth";
import { Group } from "../models/Group";
import User from "../models/User";
// import { IUser, User } from "../models/User";
import * as messageService from "../services/messageService";
import logger from "../utils/logger";

/**
 * ─────────────────────────────────────────────
 * TYPES (FIXED: no `as any`)
 * ─────────────────────────────────────────────
 */
interface AuthenticatedSocket extends Socket {
  user?: InstanceType<typeof User>;
}

/**
 * ─────────────────────────────────────────────
 * MEMORY STATE
 * ─────────────────────────────────────────────
 */
const onlineUsers = new Map<string, Set<string>>();
const typingUsers = new Map<string, Map<string, string>>();
const typingTimeouts = new Map<string, NodeJS.Timeout>();

// /**
//  * ─────────────────────────────────────────────
//  * ONLINE USERS
//  * ─────────────────────────────────────────────
//  */
// const addOnlineUser = (userId: string, socketId: string) => {
//   if (!onlineUsers.has(userId)) onlineUsers.set(userId, new Set());
//   onlineUsers.get(userId)!.add(socketId);
// };

// const removeOnlineUser = (userId: string, socketId: string): boolean => {
//   const sockets = onlineUsers.get(userId);
//   if (!sockets) return false;

//   sockets.delete(socketId);

//   if (sockets.size === 0) {
//     onlineUsers.delete(userId);
//     return true;
//   }

//   return false;
// };

const addOnlineUser = async (userId: string, socketId: string) => {
  if (!onlineUsers.has(userId)) {
    onlineUsers.set(userId, new Set());
    await User.findByIdAndUpdate(userId, { isOnline: true });
  }
  onlineUsers.get(userId)!.add(socketId);
};

const removeOnlineUser = async (userId: string, socketId: string) => {
  const sockets = onlineUsers.get(userId);
  if (!sockets) return;

  sockets.delete(socketId);

  if (sockets.size === 0) {
    onlineUsers.delete(userId);

    await User.findByIdAndUpdate(userId, {
      isOnline: false,
      lastSeen: new Date(),
    });
  }
};

const isUserOnline = (userId: string): boolean => onlineUsers.has(userId);

/**
 * ─────────────────────────────────────────────
 * CLEAR TYPING
 * ─────────────────────────────────────────────
 */
const clearTyping = (io: Server, groupId: string, userId: string) => {
  const group = typingUsers.get(groupId);
  if (!group) return;

  group.delete(userId);

  if (group.size === 0) typingUsers.delete(groupId);

  io.to(groupId).emit("typing:update", {
    groupId,
    typingUsers: Array.from(group, ([id, name]) => ({
      userId: id,
      username: name,
    })),
  });
};

/**
 * ─────────────────────────────────────────────
 * SOCKET HANDLER
 * ─────────────────────────────────────────────
 */
const socketHandler = (io: Server): void => {
  io.use(authenticateSocket as any);

  io.on("connection", async (socket: AuthenticatedSocket) => {
    try {
      /**
       * SAFETY CHECK
       */
      if (!socket.user) {
        logger.warn("⚠️ Socket connected without user. Disconnecting.");
        socket.disconnect(true);
        return;
      }

      const user = socket.user;
      const userId = user._id.toString();

      logger.info(`🔌 Connected: ${user.username} (${socket.id})`);

      /**
       * ONLINE STATE
       */
      await addOnlineUser(userId, socket.id);

      await User.findByIdAndUpdate(userId, { isOnline: true });

      /**
       * JOIN USER GROUPS
       */
      const groups = await Group.find({
        "members.user": userId,
        isActive: true,
      }).select("_id");

      const groupRooms = groups.map((g) => g._id.toString());

      if (groupRooms.length) {
        socket.join(groupRooms);
      }

      /**
       * NOTIFY ONLINE
       */
      groupRooms.forEach((roomId) => {
        socket.to(roomId).emit("user:online", {
          userId,
          username: user.username,
        });
      });

      /**
       * ───────── GROUP JOIN ─────────
       */
      socket.on("group:join", async ({ groupId }, ack) => {
        try {
          const group = await Group.findById(groupId);

          if (!group?.isMember(userId)) {
            return ack?.({ error: "Not a member of this group" });
          }

          socket.join(groupId);
          ack?.({ success: true });
        } catch (e: any) {
          ack?.({ error: e.message });
        }
      });

      /**
       * ───────── MESSAGE SEND ─────────
       */
      socket.on("message:send", async (data, ack) => {
        try {
          const { groupId, content, type, replyTo } = data;

          if (!groupId) {
            return ack?.({ error: "groupId required" });
          }

          if (!content?.trim()) {
            return ack?.({ error: "Empty message" });
          }

          const group = await Group.findById(groupId);
          if (!group?.isMember(userId)) {
            return ack?.({ error: "Not authorized for this group" });
          }

          const message = await messageService.sendMessage({
            groupId,
            senderId: userId,
            content,
            type: type || "text",
            replyTo,
            files: [],
            req: { protocol: "http", get: () => "localhost" } as any,
          });

          const populated = await message.populate([
            { path: "sender", select: "username avatar isOnline" },
            {
              path: "replyTo",
              populate: { path: "sender", select: "username avatar" },
            },
          ]);

          io.to(groupId).emit("message:new", { message: populated });

          clearTyping(io, groupId, userId);

          ack?.({ success: true, message: populated });
        } catch (e: any) {
          logger.error("message:send error:", e);
          ack?.({ error: e.message });
        }
      });

      /**
       * ───────── TYPING START ─────────
       */
      socket.on("typing:start", ({ groupId }) => {
        if (!groupId) return;

        if (!typingUsers.has(groupId)) {
          typingUsers.set(groupId, new Map());
        }

        typingUsers.get(groupId)!.set(userId, user.username);

        socket.to(groupId).emit("typing:update", {
          groupId,
          typingUsers: Array.from(typingUsers.get(groupId)!, ([id, name]) => ({
            userId: id,
            username: name,
          })),
        });

        const key = `${groupId}:${userId}`;

        if (typingTimeouts.has(key)) {
          clearTimeout(typingTimeouts.get(key)!);
        }

        typingTimeouts.set(
          key,
          setTimeout(() => {
            clearTyping(io, groupId, userId);
            typingTimeouts.delete(key);
          }, 4000),
        );
      });

      /**
       * ───────── TYPING STOP ─────────
       */
      socket.on("typing:stop", ({ groupId }) => {
        if (!groupId) return;
        clearTyping(io, groupId, userId);
      });

      /**
       * ───────── DISCONNECT ─────────
       */
      socket.on("disconnect", async (reason) => {
        logger.info(`❌ Disconnected: ${user.username} (${reason})`);

        const fullyOffline = removeOnlineUser(userId, socket.id);

        // if (fullyOffline) {
        //   const lastSeen = new Date();

        //   await User.findByIdAndUpdate(userId, {
        //     isOnline: false,
        //     lastSeen,
        //   });

        //   groupRooms.forEach((roomId) => {
        //     socket.to(roomId).emit("user:offline", {
        //       userId,
        //       username: user.username,
        //       lastSeen,
        //     });

        //     clearTyping(io, roomId, userId);
        //   });
        // }
      });

      /**
       * ───────── ERROR ─────────
       */
      socket.on("error", (err: any) => {
        logger.error(`Socket error (${user.username}): ${err.message}`);
      });
    } catch (err: any) {
      logger.error("Socket connection error:", err);
      socket.disconnect(true);
    }
  });
};

export { isUserOnline, onlineUsers, socketHandler };
