import axios, { AxiosError, type AxiosRequestConfig } from "axios";
import { disconnectSocket } from "../socket/socket";
import { useAuthStore } from "../store/authStore";

const baseURL =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:5000/api";

const api = axios.create({
  baseURL,
  withCredentials: false,
});

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;

  if (token) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as
      | (AxiosRequestConfig & {
          _retry?: boolean;
        })
      | null;

    if (
      !originalRequest ||
      error.response?.status !== 401 ||
      originalRequest._retry ||
      originalRequest.url?.includes("/auth/refresh")
    ) {
      return Promise.reject(error);
    }

    const refreshToken = useAuthStore.getState().refreshToken;
    if (!refreshToken) {
      disconnectSocket();
      useAuthStore.getState().clearSession();
      return Promise.reject(error);
    }

    originalRequest._retry = true;

    try {
      const refreshResponse = await fetch(`${baseURL}/auth/refresh`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ refreshToken }),
      });

      if (!refreshResponse.ok) {
        throw new Error("Unable to refresh access token");
      }

      const payload = (await refreshResponse.json()) as {
        data?: { accessToken?: string; refreshToken?: string };
      };
      const nextAccessToken = payload.data?.accessToken;
      const nextRefreshToken = payload.data?.refreshToken;

      if (!nextAccessToken || !nextRefreshToken) {
        throw new Error("Refresh response missing tokens");
      }

      useAuthStore.getState().setTokens({
        accessToken: nextAccessToken,
        refreshToken: nextRefreshToken,
      });

      originalRequest.headers = originalRequest.headers ?? {};
      originalRequest.headers.Authorization = `Bearer ${nextAccessToken}`;
      return api(originalRequest);
    } catch (refreshError) {
      disconnectSocket();
      useAuthStore.getState().clearSession();
      return Promise.reject(refreshError);
    }
  },
);

export { baseURL };
export default api;
