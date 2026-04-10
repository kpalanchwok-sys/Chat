import type { FormEvent } from "react";
import { useState } from "react";
import { connectSocket } from "../socket/socket";
import { useAuthStore } from "../store/authStore";

interface RegisterProps {
  onSwitchToLogin?: () => void;
}

export default function Register({ onSwitchToLogin }: RegisterProps) {
  const register = useAuthStore((state) => state.register);
  const isAuthenticating = useAuthStore((state) => state.isAuthenticating);
  const authError = useAuthStore((state) => state.error);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [bio, setBio] = useState("");

  const handleRegister = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      await register({ username, email, password, bio });
      connectSocket();
    } catch {
      // The auth store already exposes the server error in UI state.
    }
  };

  return (
    <form className="auth-form" onSubmit={handleRegister}>
      <div className="auth-form__header">
        <h2>Create your account</h2>
        <p>Register once and keep access to every group you join.</p>
      </div>

      <label>
        <span>Username</span>
        <input
          type="text"
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          placeholder="your_handle"
          autoComplete="username"
          required
        />
      </label>

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
          placeholder="Choose a secure password"
          autoComplete="new-password"
          required
        />
      </label>

      <label>
        <span>Bio</span>
        <textarea
          value={bio}
          onChange={(event) => setBio(event.target.value)}
          placeholder="A short profile note for your teammates"
          rows={3}
        />
      </label>

      {authError ? <p className="auth-form__error">{authError}</p> : null}

      <button
        type="submit"
        className="button button--primary"
        disabled={isAuthenticating}
      >
        {isAuthenticating ? "Creating account..." : "Create account"}
      </button>

      {onSwitchToLogin ? (
        <p className="auth-form__hint">
          Already have an account?{" "}
          <button
            type="button"
            className="text-button"
            onClick={onSwitchToLogin}
          >
            Sign in
          </button>
        </p>
      ) : null}
    </form>
  );
}
