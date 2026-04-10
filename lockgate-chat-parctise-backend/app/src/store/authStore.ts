import { create } from "zustand/react";
import { createJSONStorage, persist } from "zustand/middleware";
import {
  loginRequest,
  logoutRequest,
  meRequest,
  registerRequest,
  type AuthUser,
} from "../api/auth";

interface LoginPayload {
  email: string;
  password: string;
}

interface RegisterPayload extends LoginPayload {
  username: string;
  bio?: string;
}

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  isHydrated: boolean;
  isAuthenticating: boolean;
  error: string | null;
  setHydrated: () => void;
  setTokens: (session: { accessToken: string; refreshToken: string }) => void;
  clearSession: () => void;
  login: (data: LoginPayload) => Promise<void>;
  register: (data: RegisterPayload) => Promise<void>;
  validateSession: () => Promise<void>;
  logout: () => Promise<void>;
}

const emptySession = {
  user: null,
  accessToken: null,
  refreshToken: null,
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      ...emptySession,
      isHydrated: false,
      isAuthenticating: false,
      error: null,

      setHydrated: () => set({ isHydrated: true }),

      setTokens: ({ accessToken, refreshToken }) =>
        set({
          accessToken,
          refreshToken,
        }),

      clearSession: () => set({ ...emptySession, error: null }),

      login: async (data) => {
        set({ isAuthenticating: true, error: null });
        try {
          const session = await loginRequest(data);
          set({
            user: session.user,
            accessToken: session.accessToken,
            refreshToken: session.refreshToken,
            isAuthenticating: false,
          });
        } catch (error) {
          set({
            isAuthenticating: false,
            error: error instanceof Error ? error.message : "Unable to login",
          });
          throw error;
        }
      },

      register: async (data) => {
        set({ isAuthenticating: true, error: null });
        try {
          const session = await registerRequest(data);
          set({
            user: session.user,
            accessToken: session.accessToken,
            refreshToken: session.refreshToken,
            isAuthenticating: false,
          });
        } catch (error) {
          set({
            isAuthenticating: false,
            error:
              error instanceof Error
                ? error.message
                : "Unable to create account",
          });
          throw error;
        }
      },

      validateSession: async () => {
        const { accessToken } = get();
        if (!accessToken) return;

        try {
          const response = await meRequest(accessToken);
          set({ user: response.user, error: null });
        } catch (error) {
          set({ ...emptySession, error: null });
          throw error;
        }
      },

      logout: async () => {
        const { accessToken } = get();

        try {
          if (accessToken) {
            await logoutRequest(accessToken);
          }
        } catch {
          // Ignore server logout failures and clear the client session anyway.
        } finally {
          set({ ...emptySession, error: null });
        }
      },
    }),
    {
      name: "lockgate-auth",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHydrated();
      },
    },
  ),
);
