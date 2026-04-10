// socket/socketServer.ts
import { Server as HTTPServer } from "http";
import { Namespace, Socket, Server as SocketServer } from "socket.io";
import { authenticateSocket } from "../middleware/authenticateSocket";
import { Group } from "../models/Group";
import User from "../models/User";
import * as messageService from "../services/messageService";
import { getUserStatus, updateUserStatus } from "../services/userStatusService";

export let io: SocketServer;
export let mainNamespace: Namespace;

const OFFLINE_TIMEOUT_MS = 30 * 1000;

// ── In-memory typing state ──────────────────────────────────────────
const typingUsers = new Map<string, Map<string, string>>();
const typingTimeouts = new Map<string, NodeJS.Timeout>();

const clearTyping = (nsp: Namespace, groupId: string, userId: string) => {
  const group = typingUsers.get(groupId);
  if (!group) return;
  group.delete(userId);
  if (group.size === 0) typingUsers.delete(groupId);
  nsp.to(groupId).emit("typing:update", {
    groupId,
    typingUsers: Array.from(group, ([id, name]) => ({
      userId: id,
      username: name,
    })),
  });
};

export const initSocket = (server: HTTPServer) => {
  io = new SocketServer(server, { cors: { origin: "*" } });
  mainNamespace = io.of("/");
  mainNamespace.use(authenticateSocket);
  mainNamespace.on("connection", async (socket: Socket) => {
    try {
      await handleConnection(socket);
    } catch (error) {
      console.error("Socket connection error:", error);
      socket.disconnect();
    }
  });
};

// const handleConnection = async (socket: Socket) => {
//   // ✅ FIX: read from socket.data.user (set by middleware)
//   const user = socket.data.user;

//   if (!user || !user._id) {
//     console.error("Invalid user on socket. Disconnecting...");
//     socket.disconnect();
//     return;
//   }

//   const userId = user._id.toString();
//   logger.info(`✅ User connected: ${user.username} (${socket.id})`);

//   // Join personal room
//   await socket.join(userId);

//   // Join all active groups
//   const groups = await Group.find({
//     "members.user": userId,
//     isActive: true,
//   }).select("_id");

//   const groupRooms = groups.map((g) => g._id.toString());
//   if (groupRooms.length) socket.join(groupRooms);

//   // Notify group members this user is online
//   groupRooms.forEach((roomId) => {
//     socket.to(roomId).emit("user:online", { userId, username: user.username });
//   });

//   // Register all event handlers
//   registerChatEvents(socket, userId, user, groupRooms);
//   registerStatusEvents(socket, userId);
// };

// ── CHAT EVENTS ────────────────────────────────────────────────────

// const registerChatEvents = (
//   socket: Socket,
//   userId: string,
//   user: any,
//   groupRooms: string[],
// ) => {
//   // Group Join
//   socket.on("group:join", async ({ groupId }, ack) => {
//     try {
//       const group = await Group.findById(groupId);
//       if (!group?.isMember(userId))
//         return ack?.({ error: "Not a member of this group" });
//       socket.join(groupId);
//       ack?.({ success: true });
//     } catch (e: any) {
//       ack?.({ error: e.message });
//     }
//   });

//   // Message Send
//   socket.on("message:send", async (data, ack) => {
//     try {
//       const { groupId, content, type, replyTo } = data;
//       if (!groupId) return ack?.({ error: "groupId required" });
//       if (!content?.trim()) return ack?.({ error: "Empty message" });

//       const group = await Group.findById(groupId);
//       if (!group?.isMember(userId))
//         return ack?.({ error: "Not authorized for this group" });

//       const message = await messageService.sendMessage({
//         groupId,
//         senderId: userId,
//         content,
//         type: type || "text",
//         replyTo,
//         files: [],
//         req: { protocol: "http", get: () => "localhost" } as any,
//       });

//       const populated = await message.populate([
//         { path: "sender", select: "username avatar isOnline" },
//         {
//           path: "replyTo",
//           populate: { path: "sender", select: "username avatar" },
//         },
//       ]);

//       mainNamespace.to(groupId).emit("message:new", { message: populated });
//       clearTyping(mainNamespace, groupId, userId);
//       ack?.({ success: true, message: populated });
//     } catch (e: any) {
//       logger.error("message:send error:", e);
//       ack?.({ error: e.message });
//     }
//   });

//   // Typing Start
//   socket.on("typing:start", ({ groupId }) => {
//     if (!groupId) return;
//     if (!typingUsers.has(groupId)) typingUsers.set(groupId, new Map());
//     typingUsers.get(groupId)!.set(userId, user.username);

//     socket.to(groupId).emit("typing:update", {
//       groupId,
//       typingUsers: Array.from(typingUsers.get(groupId)!, ([id, name]) => ({
//         userId: id,
//         username: name,
//       })),
//     });

//     const key = `${groupId}:${userId}`;
//     if (typingTimeouts.has(key)) clearTimeout(typingTimeouts.get(key)!);
//     typingTimeouts.set(
//       key,
//       setTimeout(() => {
//         clearTyping(mainNamespace, groupId, userId);
//         typingTimeouts.delete(key);
//       }, 4000),
//     );
//   });

//   // Typing Stop
//   socket.on("typing:stop", ({ groupId }) => {
//     if (!groupId) return;
//     clearTyping(mainNamespace, groupId, userId);
//   });

//   // Disconnect
//   socket.on("disconnect", async (reason) => {
//     logger.info(`❌ Disconnected: ${user.username} (${reason})`);
//     const lastSeen = new Date();
//     await User.findByIdAndUpdate(userId, { isOnline: false, lastSeen });
//     groupRooms.forEach((roomId) => {
//       socket
//         .to(roomId)
//         .emit("user:offline", { userId, username: user.username, lastSeen });
//       clearTyping(mainNamespace, roomId, userId);
//     });
//   });
// };

const handleConnection = async (socket: Socket) => {
  console.log("🟡 handleConnection called");

  const user = socket.data.user;
  if (!user || !user._id) {
    console.error("Invalid user on socket. Disconnecting...");
    socket.disconnect();
    return;
  }

  const userId = user._id.toString();
  console.log(`✅ User connected: ${user.username} (${socket.id})`);

  // Join personal room
  await socket.join(userId);

  // Join all active groups automatically
  const groups = await Group.find({
    "members.user": userId,
    isActive: true,
  }).select("_id");

  const groupRooms = groups.map((g) => g._id.toString());
  if (groupRooms.length) socket.join(groupRooms);

  // Notify others user is online
  groupRooms.forEach((roomId) => {
    socket.to(roomId).emit("user:online", { userId, username: user.username });
  });

  console.log("🟡 calling registerChatEvents");

  // ✅ Register BOTH chat and status events
  registerChatEvents(socket, userId, user, groupRooms);
  registerStatusEvents(socket, userId);
};

const registerChatEvents = (
  socket: Socket,
  userId: string,
  user: any,
  groupRooms: string[],
) => {
  // group:join
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

  // message:send
  socket.on("message:send", async (data, ack) => {
    try {
      const { groupId, content, type, replyTo } = data;
      if (!groupId) return ack?.({ error: "groupId required" });
      if (!content?.trim()) return ack?.({ error: "Empty message" });

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

      mainNamespace.to(groupId).emit("message:new", { message: populated });
      clearTyping(mainNamespace, groupId, userId);
      ack?.({ success: true, message: populated });
    } catch (e: any) {
      ack?.({ error: e.message });
    }
  });

  // typing:start
  socket.on("typing:start", ({ groupId }) => {
    if (!groupId) return;
    if (!typingUsers.has(groupId)) typingUsers.set(groupId, new Map());
    typingUsers.get(groupId)!.set(userId, user.username);

    socket.to(groupId).emit("typing:update", {
      groupId,
      typingUsers: Array.from(typingUsers.get(groupId)!, ([id, name]) => ({
        userId: id,
        username: name,
      })),
    });

    const key = `${groupId}:${userId}`;
    if (typingTimeouts.has(key)) clearTimeout(typingTimeouts.get(key)!);
    typingTimeouts.set(
      key,
      setTimeout(() => {
        clearTyping(mainNamespace, groupId, userId);
        typingTimeouts.delete(key);
      }, 4000),
    );
  });

  // typing:stop
  socket.on("typing:stop", ({ groupId }) => {
    if (!groupId) return;
    clearTyping(mainNamespace, groupId, userId);
  });

  // disconnect
  socket.on("disconnect", async (reason) => {
    console.log(`❌ Disconnected: ${user.username} (${reason})`);
    const lastSeen = new Date();
    await User.findByIdAndUpdate(userId, { isOnline: false, lastSeen });
    groupRooms.forEach((roomId) => {
      socket.to(roomId).emit("user:offline", {
        userId,
        username: user.username,
        lastSeen,
      });
      clearTyping(mainNamespace, roomId, userId);
    });
  });
};

// ── STATUS EVENTS ──────────────────────────────────────────────────
const registerStatusEvents = async (socket: Socket, userId: string) => {
  let offlineTimer: NodeJS.Timeout;

  socket.on("user-online-status", async (data) => {
    const { participantIds } = data as { participantIds: string[] };
    if (!participantIds || !Array.isArray(participantIds)) {
      socket.emit("user-online-status", {
        error: "participantIds must be an array",
      });
      return;
    }
    try {
      const status = await getUserStatus(participantIds);
      socket.nsp.in(userId).emit("user-online-status", status);
    } catch (error) {
      socket.nsp
        .in(userId)
        .emit("user-online-status", { error: "Failed to fetch status" });
    }
  });

  try {
    const { old } = await updateUserStatus({
      userId,
      status: "ONLINE",
      socketId: socket.id,
    });
    if (old?.socketId && old.socketId !== socket.id) {
      const oldSocket = socket.nsp.sockets.get(old.socketId);
      oldSocket?.disconnect(true);
    }
  } catch (error) {
    console.error("Error setting ONLINE status:", error);
  }

  const startOfflineTimer = () => {
    offlineTimer = setTimeout(async () => {
      try {
        await updateUserStatus({ userId, status: "OFFLINE" });
      } catch (error) {
        console.error("Error setting OFFLINE:", error);
      }
    }, OFFLINE_TIMEOUT_MS);
  };

  startOfflineTimer();

  socket.on("heartbeat", async () => {
    try {
      await updateUserStatus({ userId, status: "ONLINE" });
      clearTimeout(offlineTimer);
      startOfflineTimer();
    } catch (error) {
      console.error("Heartbeat error:", error);
    }
  });
};

// import { Server as HTTPServer } from "http";
// import { Namespace, Socket, Server as SocketServer } from "socket.io";

// import { authenticateSocket } from "../middleware/authenticateSocket"; // ✅ FIXED PATH
// import { getUserStatus, updateUserStatus } from "../services/userStatusService";

// export let io: SocketServer;
// export let mainNamespace: Namespace;

// const OFFLINE_TIMEOUT_MS = 30 * 1000;

// /**
//  * Initialize Socket.IO
//  */
// export const initSocket = (server: HTTPServer) => {
//   io = new SocketServer(server, {
//     cors: {
//       origin: "*",
//     },
//   });

//   mainNamespace = io.of("/");

//   // ✅ Attach auth middleware
//   mainNamespace.use(authenticateSocket);

//   mainNamespace.on("connection", async (socket: Socket) => {
//     try {
//       await handleConnection(socket);
//     } catch (error) {
//       console.error("Socket connection error:", error);
//       socket.disconnect();
//     }
//   });
// };

// /**
//  * Handle New Connection
//  */
// const handleConnection = async (socket: Socket) => {
//   const user = socket.data.user;

//   if (!user || !user._id) {
//     console.error("Invalid user on socket. Disconnecting...");
//     socket.disconnect();
//     return;
//   }

//   const userId = user._id.toString();

//   console.log(`✅ User connected: ${userId}`);

//   // ✅ Join personal room
//   await socket.join(userId);

//   // Setup listeners
//   registerEventHandlers(socket, userId);

//   // Update user online status
//   await handleOnlineStatus(socket, userId);
// };

// /**
//  * Register All Socket Events
//  */
// const registerEventHandlers = (socket: Socket, userId: string) => {
//   /**
//    * Get online status of users
//    */
//   socket.on("user-online-status", async (data) => {
//     const { participantIds } = data as { participantIds: string[] };

//     if (!participantIds || !Array.isArray(participantIds)) {
//       socket.emit("user-online-status", {
//         error: "participantIds must be an array",
//       });
//       return;
//     }

//     try {
//       const status = await getUserStatus(participantIds);

//       socket.nsp.in(userId).emit("user-online-status", status);
//     } catch (error) {
//       console.error("Error fetching user status:", error);

//       socket.nsp.in(userId).emit("user-online-status", {
//         error: "Failed to fetch status",
//       });
//     }
//   });
// };

// /**
//  * Handle Online/Offline + Heartbeat
//  */
// const handleOnlineStatus = async (socket: Socket, userId: string) => {
//   let offlineTimer: NodeJS.Timeout;

//   try {
//     const { old } = await updateUserStatus({
//       userId,
//       status: "ONLINE",
//       socketId: socket.id,
//     });

//     // Disconnect old session if exists
//     if (old?.socketId && old.socketId !== socket.id) {
//       const oldSocket = socket.nsp.sockets.get(old.socketId);
//       oldSocket?.disconnect(true);
//     }
//   } catch (error) {
//     console.error("Error setting ONLINE status:", error);
//   }

//   /**
//    * Start offline timer
//    */
//   const startOfflineTimer = () => {
//     offlineTimer = setTimeout(async () => {
//       try {
//         await updateUserStatus({
//           userId,
//           status: "OFFLINE",
//         });

//         console.log(`⛔ User offline due to inactivity: ${userId}`);
//       } catch (error) {
//         console.error("Error setting OFFLINE:", error);
//       }
//     }, OFFLINE_TIMEOUT_MS);
//   };

//   startOfflineTimer();

//   /**
//    * Heartbeat → keep user online
//    */
//   socket.on("heartbeat", async () => {
//     try {
//       await updateUserStatus({
//         userId,
//         status: "ONLINE",
//       });

//       clearTimeout(offlineTimer);
//       startOfflineTimer();
//     } catch (error) {
//       console.error("Heartbeat error:", error);
//     }
//   });

//   /**
//    * Disconnect
//    */
//   socket.on("disconnect", async () => {
//     try {
//       await updateUserStatus({
//         userId,
//         status: "OFFLINE",
//         socketId: "",
//       });

//       clearTimeout(offlineTimer);

//       console.log(`❌ User disconnected: ${userId}`);
//     } catch (error) {
//       console.error("Disconnect error:", error);
//     }
//   });
// };
