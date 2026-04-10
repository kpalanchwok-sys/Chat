import { io, type Socket } from "socket.io-client";
import { useAuthStore } from "../store/authStore";
import { useSocketStore } from "../store/socketStore";

const socketBaseUrl = (
  import.meta.env.VITE_SOCKET_URL ??
  import.meta.env.VITE_API_BASE_URL ??
  "http://localhost:5001/api"
).replace(/\/api\/?$/, "");

let activeSocket: Socket | null = null;
let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
let activeToken: string | null = null;

const clearHeartbeat = () => {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
};

const registerSocketLifecycle = (socket: Socket) => {
  socket.on("connect", () => {
    useSocketStore.getState().setConnected(true);
    useSocketStore.getState().setLastError(null);
    clearHeartbeat();
    heartbeatTimer = setInterval(() => {
      socket.emit("heartbeat");
    }, 20_000);
  });

  socket.on("disconnect", () => {
    useSocketStore.getState().setConnected(false);
    clearHeartbeat();
  });

  socket.on("connect_error", (error: { message: string }) => {
    useSocketStore.getState().setLastError(error.message);
    useSocketStore.getState().setConnected(false);
  });
};

export const connectSocket = (token = useAuthStore.getState().accessToken) => {
  if (!token) {
    return null;
  }

  if (activeSocket && activeToken === token) {
    return activeSocket;
  }

  if (activeSocket) {
    activeSocket.removeAllListeners();
    activeSocket.disconnect();
    activeSocket = null;
  }

  activeToken = token;

  const socket = io(socketBaseUrl, {
    autoConnect: false,
    transports: ["websocket"],
    auth: { token },
  });

  activeSocket = socket;
  useSocketStore.getState().setSocket(socket);
  useSocketStore.getState().setConnected(false);
  registerSocketLifecycle(socket);
  socket.connect();

  return socket;
};

export const disconnectSocket = () => {
  clearHeartbeat();

  if (activeSocket) {
    activeSocket.removeAllListeners();
    activeSocket.disconnect();
  }

  activeSocket = null;
  activeToken = null;
  useSocketStore.getState().resetSocket();
};

export const getSocket = () => activeSocket ?? connectSocket();
