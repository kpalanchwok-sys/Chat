import type { FormEvent } from "react";
import { useState } from "react";
import { connectSocket } from "../socket/socket";
import { useAuthStore } from "../store/authStore";
import Register from "./Register";

export default function Login() {
  const login = useAuthStore((state) => state.login);
  const isAuthenticating = useAuthStore((state) => state.isAuthenticating);
  const authError = useAuthStore((state) => state.error);
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      await login({ email, password });
      connectSocket();
    } catch {
      // The auth store already exposes the server error in UI state.
    }
  };

  return (
    <main className="auth-shell">
      <section className="auth-shell__hero">
        <p className="eyebrow">Lockgate Chat</p>
        <h1>Production-ready team chat with sockets and secure auth.</h1>
        <p>
          Sign in to browse your groups, join public communities, and keep
          conversations flowing in real time.
        </p>
        <div className="auth-shell__stats">
          <div>
            <strong>JWT</strong>
            <span>Session-backed login</span>
          </div>
          <div>
            <strong>Socket</strong>
            <span>Live message sync</span>
          </div>
          <div>
            <strong>Groups</strong>
            <span>Browse and join</span>
          </div>
        </div>
      </section>

      <section className="auth-card">
        <div className="auth-card__tabs">
          <button
            type="button"
            className={
              mode === "login"
                ? "auth-card__tab auth-card__tab--active"
                : "auth-card__tab"
            }
            onClick={() => setMode("login")}
          >
            Sign in
          </button>
          <button
            type="button"
            className={
              mode === "register"
                ? "auth-card__tab auth-card__tab--active"
                : "auth-card__tab"
            }
            onClick={() => setMode("register")}
          >
            Create account
          </button>
        </div>

        {mode === "login" ? (
          <form className="auth-form" onSubmit={handleLogin}>
            <div className="auth-form__header">
              <h2>Welcome back</h2>
              <p>Use your existing account to continue.</p>
            </div>

            <label>
              <span>Email</span>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                required
              />
            </label>

            <label>
              <span>Password</span>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Your password"
                autoComplete="current-password"
                required
              />
            </label>

            {authError ? <p className="auth-form__error">{authError}</p> : null}

            <button
              type="submit"
              className="button button--primary"
              disabled={isAuthenticating}
            >
              {isAuthenticating ? "Signing in..." : "Sign in"}
            </button>

            <p className="auth-form__hint">
              New here?{" "}
              <button
                type="button"
                className="text-button"
                onClick={() => setMode("register")}
              >
                Create an account
              </button>
            </p>
          </form>
        ) : (
          <Register onSwitchToLogin={() => setMode("login")} />
        )}
      </section>
    </main>
  );
}
