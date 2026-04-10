import { useMemo } from "react";
import { useAuthStore } from "../../store/authStore";
import { useChatStore } from "../../store/chatStore";
import { useSocketStore } from "../../store/socketStore";
import MessageInput from "../chat/MessageInput";
import MessageList from "../chat/MessageList";

export default function ChatWindow() {
  const user = useAuthStore((state) => state.user);
  const groups = useChatStore((state) => state.groups);
  const activeGroupId = useChatStore((state) => state.activeGroupId);
  const activeGroup = useMemo(
    () => groups.find((group) => group._id === activeGroupId) ?? null,
    [activeGroupId, groups],
  );
  const isConnected = useSocketStore((state) => state.isConnected);

  if (!activeGroup) {
    return (
      <main className="chat-window chat-window--empty">
        <div className="chat-hero">
          <p className="eyebrow">Welcome back</p>
          <h2>
            {user?.username ? `Hello, ${user.username}` : "Choose a group"}
          </h2>
          <p>
            Pick one of your joined groups or join a public community from the
            sidebar to start chatting.
          </p>
          <div className="chat-hero__status">
            <span
              className={
                isConnected ? "status-pill status-pill--online" : "status-pill"
              }
            >
              {isConnected ? "Socket connected" : "Waiting for connection"}
            </span>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="chat-window">
      <header className="chat-window__header">
        <div>
          <p className="eyebrow">Channel</p>
          <h2>{activeGroup.name}</h2>
          <p>
            {activeGroup.description ||
              "A focused space for your team conversation."}
          </p>
        </div>
        <span className="status-pill status-pill--online">Live</span>
      </header>

      <MessageList />
      <MessageInput />
    </main>
  );
}
