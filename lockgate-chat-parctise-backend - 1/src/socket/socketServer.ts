import { Server as HTTPServer } from "http";
import { Namespace, Socket, Server as SocketServer } from "socket.io";

import { authenticateSocket } from "../middleware/authenticateSocket"; // ✅ FIXED PATH
import { getUserStatus, updateUserStatus } from "../services/userStatusService";

export let io: SocketServer;
export let mainNamespace: Namespace;

const OFFLINE_TIMEOUT_MS = 30 * 1000;

/**
 * Initialize Socket.IO
 */
export const initSocket = (server: HTTPServer) => {
  io = new SocketServer(server, {
    cors: {
      origin: "*",
    },
  });

  mainNamespace = io.of("/");

  // ✅ Attach auth middleware
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

/**
 * Handle New Connection
 */
const handleConnection = async (socket: Socket) => {
  const user = socket.data.user;

  if (!user || !user._id) {
    console.error("Invalid user on socket. Disconnecting...");
    socket.disconnect();
    return;
  }

  const userId = user._id.toString();

  console.log(`✅ User connected: ${userId}`);

  // ✅ Join personal room
  await socket.join(userId);

  // Setup listeners
  registerEventHandlers(socket, userId);

  // Update user online status
  await handleOnlineStatus(socket, userId);
};

/**
 * Register All Socket Events
 */
const registerEventHandlers = (socket: Socket, userId: string) => {
  /**
   * Get online status of users
   */
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
      console.error("Error fetching user status:", error);

      socket.nsp.in(userId).emit("user-online-status", {
        error: "Failed to fetch status",
      });
    }
  });
};

/**
 * Handle Online/Offline + Heartbeat
 */
const handleOnlineStatus = async (socket: Socket, userId: string) => {
  let offlineTimer: NodeJS.Timeout;

  try {
    const { old } = await updateUserStatus({
      userId,
      status: "ONLINE",
      socketId: socket.id,
    });

    // Disconnect old session if exists
    if (old?.socketId && old.socketId !== socket.id) {
      const oldSocket = socket.nsp.sockets.get(old.socketId);
      oldSocket?.disconnect(true);
    }
  } catch (error) {
    console.error("Error setting ONLINE status:", error);
  }

  /**
   * Start offline timer
   */
  const startOfflineTimer = () => {
    offlineTimer = setTimeout(async () => {
      try {
        await updateUserStatus({
          userId,
          status: "OFFLINE",
        });

        console.log(`⛔ User offline due to inactivity: ${userId}`);
      } catch (error) {
        console.error("Error setting OFFLINE:", error);
      }
    }, OFFLINE_TIMEOUT_MS);
  };

  startOfflineTimer();

  /**
   * Heartbeat → keep user online
   */
  socket.on("heartbeat", async () => {
    try {
      await updateUserStatus({
        userId,
        status: "ONLINE",
      });

      clearTimeout(offlineTimer);
      startOfflineTimer();
    } catch (error) {
      console.error("Heartbeat error:", error);
    }
  });

  /**
   * Disconnect
   */
  socket.on("disconnect", async () => {
    try {
      await updateUserStatus({
        userId,
        status: "OFFLINE",
        socketId: "",
      });

      clearTimeout(offlineTimer);

      console.log(`❌ User disconnected: ${userId}`);
    } catch (error) {
      console.error("Disconnect error:", error);
    }
  });
};

// rentisity
// import { type Server } from "http";
// import { Namespace, Socket, Server as SocketServer } from "socket.io";

// import { authenticateSocket } from "../middleware/authenticateSocket";
// // import { getUserStatus, updateUserStatus } from "../services/userStatusService";
// // import { chatSockets } from "./chatSockets";
// // import { checkIfHasJoinedRoom } from "./functions";
// // import { notificationFunctions } from "./notificationFunctions";

// export const socketIO: SocketServer | undefined = undefined;
// export let mainNamespace: Namespace | null = null;
// const OFFLINE_TIMEOUT_MS = 30 * 1000;

// export const initSocket = (server: Server) => {
//   const socketIO = new SocketServer(server, {
//     cors: {
//       origin: "*",
//     },
//   });

//   mainNamespace = socketIO.of("/");

//   mainNamespace.use(authenticateSocket).on("connection", async (socket) => {
//     await handleNewConnection(socket);
//     if (socket.data.user) {
//       // notificationFunctions(socket);
//     }
//   });

//   // chatSockets(socketIO);
// };

// const handleNewConnection = async (socket: Socket) => {
//   const { user, isAdmin } = socket.data;
//   if (!user || !user._id) {
//     console.error(
//       "Invalid user data on socket connection. Disconnecting socket.",
//     );
//     socket.disconnect();
//     return undefined;
//   }
//   const userId = user._id.toString() as string;

//   // Ensure the user is in their dedicated room (using userId)
//   // if (!checkIfHasJoinedRoom(socket, userId)) {
//   //   await socket.join(userId);
//   // }

//   // Listen for requests to get the user online status
//   socket.on("user-online-status", async (data) => {
//     await handleUserOnlineStatus(socket, userId, data);
//   });

//   // Set up user status updates and heartbeat handling
//   await updateUserOnlineStatus({
//     socket,
//     adminId: isAdmin ? userId : undefined,
//     userId: isAdmin ? undefined : userId,
//   });
// };

// const handleUserOnlineStatus = async (
//   socket: Socket,
//   userId: string,
//   data: any,
// ): Promise<void> => {
//   const { participantIds } = data as { participantIds: string[] };
//   if (
//     participantIds &&
//     Array.isArray(participantIds) &&
//     participantIds.length > 0
//   ) {
//     try {
//       const status = await getUserStatus(participantIds);
//       socket.nsp.in(userId).emit("user-online-status", status);
//     } catch (error) {
//       console.error("Error fetching user status:", error);
//       socket.nsp
//         .in(userId)
//         .emit("user-online-status", { error: "Error fetching status" });
//     }
//   } else {
//     socketIO
//       ?.in(userId)
//       .emit("user-online-status", { message: "Please provide participantIds" });
//   }
// };

// const updateUserOnlineStatus = async ({
//   userId,
//   adminId,
//   socket,
// }: {
//   userId?: string;
//   adminId?: string;
//   socket: Socket;
// }) => {
//   try {
//     const { old } = await updateUserStatus({
//       userId,
//       adminId,
//       status: "ONLINE",
//       socketId: socket.id,
//     });

//     if (old?.socketId) {
//       const oldSocketId = old.socketId;
//       const oldSocket = socket?.nsp?.sockets.get(oldSocketId);

//       if (oldSocket) {
//         oldSocket?.disconnect(true);
//       }
//     }
//   } catch (error) {
//     console.error("Error setting user status to ONLINE:", error);
//   }

//   // Make user offline if user didn't ping within 5 minutes and update lastSeen
//   let offlineTimer = setTimeout(() => {
//     void updateUserStatus({
//       userId,
//       adminId,
//       status: "OFFLINE",
//     });
//   }, OFFLINE_TIMEOUT_MS);

//   // heartbeat to indicate user is online
//   socket.on("heartbeat", async () => {
//     try {
//       await updateUserStatus({
//         userId,
//         adminId,
//         status: "ONLINE",
//       });

//       clearInterval(offlineTimer);
//       // Make user offline if user didn't ping within 5 minutes and update lastSeen
//       offlineTimer = setTimeout(() => {
//         void updateUserStatus({
//           userId,
//           adminId,
//           status: "OFFLINE",
//         });
//       }, OFFLINE_TIMEOUT_MS);
//     } catch (error) {
//       console.error("Error during heartbeat update:", error);
//     }
//   });

//   socket.on("disconnect", async () => {
//     await socket.leave(userId);
//     (void updateUserStatus({
//       userId,
//       adminId,
//       status: "OFFLINE",
//       socketId: "",
//     }),
//       clearInterval(offlineTimer));
//     for (const room of socket?.rooms ?? []) {
//       await socket.leave(room);
//     }
//     console.log(
//       `User ${userId || adminId} disconnected and left all rooms 🥺🥺🥺🥺`,
//     );
//   });
// };
