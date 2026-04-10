import { useEffect, useState } from "react";
import Layout from "./components/layout/Layout";
import Login from "./pages/Login";
import { useAuthStore } from "./store/authStore";

export default function App() {
  const user = useAuthStore((s) => s.user);

  console.log("App render - user:", user);

  const accessToken = useAuthStore((s) => s.accessToken);
  const isHydrated = useAuthStore((s) => s.isHydrated);
  const validateSession = useAuthStore((s) => s.validateSession);
  const [hydrationError, setHydrationError] = useState<string | null>(null);

  useEffect(() => {
    if (isHydrated && accessToken) {
      void validateSession().catch((e) =>
        setHydrationError(e?.message || "Session validation failed"),
      );
    }
  }, [accessToken, isHydrated, validateSession]);

  if (!isHydrated) {
    return (
      <div className="app-loading">
        <div className="app-loading__panel">
          <span className="app-loading__eyebrow">Lockgate Chat</span>
          <h1>Loading workspace</h1>
          <p>Restoring your session and reconnecting to the chat server.</p>
        </div>
      </div>
    );
  }

  if (hydrationError) {
    return (
      <div className="app-loading">
        <div className="app-loading__panel">
          <span className="app-loading__eyebrow">Lockgate Chat</span>
          <h1>Session Error</h1>
          <p style={{ color: "#fb7185" }}>{hydrationError}</p>
        </div>
      </div>
    );
  }

  return <>{user ? <Layout /> : <Login />}</>;
}
