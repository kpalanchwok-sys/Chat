export interface AuthUser {
  _id: string;
  username: string;
  email: string;
  avatar: string | null;
  bio: string;
  isOnline?: boolean;
  lastSeen?: string;
}

export interface AuthSession {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
}

const apiBaseUrl =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:5000/api";

const requestJson = async <T>(
  path: string,
  options: RequestInit = {},
): Promise<T> => {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
  });

  const payload = (await response.json().catch(() => ({}))) as {
    data?: T;
    message?: string;
  };

  if (!response.ok) {
    throw new Error(payload.message || "Request failed");
  }

  if (payload.data === undefined) {
    throw new Error("Malformed response from API");
  }

  return payload.data;
};

export const loginRequest = (payload: {
  email: string;
  password: string;
}): Promise<AuthSession> =>
  requestJson<AuthSession>("/auth/login", {
    method: "POST",
    body: JSON.stringify(payload),
    
  });

export const registerRequest = (payload: {
  username: string;
  email: string;
  password: string;
  bio?: string;
}): Promise<AuthSession> =>
  requestJson<AuthSession>("/auth/register", {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const meRequest = (token: string): Promise<{ user: AuthUser }> =>
  requestJson<{ user: AuthUser }>("/auth/me", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

export const logoutRequest = (token: string): Promise<void> =>
  requestJson<void>("/auth/logout", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
