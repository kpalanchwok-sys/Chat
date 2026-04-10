import type { Socket } from "socket.io-client";
import { create } from "zustand/react";

interface SocketState {
  socket: Socket | null;
  isConnected: boolean;
  lastError: string | null;
  setSocket: (socket: Socket | null) => void;
  setConnected: (isConnected: boolean) => void;
  setLastError: (error: string | null) => void;
  resetSocket: () => void;
}

export const useSocketStore = create<SocketState>((set) => ({
  socket: null,
  isConnected: false,
  lastError: null,
  setSocket: (socket) => set({ socket }),
  setConnected: (isConnected) => set({ isConnected }),
  setLastError: (lastError) => set({ lastError }),
  resetSocket: () => set({ socket: null, isConnected: false, lastError: null }),
}));
