import { useEffect, useMemo, useRef, useState } from "react";
import api from "../../api/axios";
import { connectSocket, getSocket } from "../../socket/socket";
import { useAuthStore } from "../../store/authStore";
import { useChatStore, type ChatMessage } from "../../store/chatStore";

export default function MessageList() {
  const activeGroupId = useChatStore((state) => state.activeGroupId);
  const messages = useChatStore((state) => state.messages);
  const setMessages = useChatStore((state) => state.setMessages);
  const appendMessage = useChatStore((state) => state.appendMessage);
  const accessToken = useAuthStore((state) => state.accessToken);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollerRef = useRef<HTMLDivElement | null>(null);

  const groupMessages = useMemo(
    () => messages[activeGroupId ?? ""] ?? [],
    [activeGroupId, messages],
  );

  useEffect(() => {
    if (!activeGroupId) {
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    const loadMessages = async () => {
      try {
        const response = await api.get(
          `/groups/${activeGroupId}/messages?limit=50`,
        );
        const nextMessages = response.data?.data?.messages ?? [];
        if (!cancelled) {
          setMessages(activeGroupId, nextMessages);
        }
      } catch (requestError) {
        if (!cancelled) {
          setError(
            requestError instanceof Error
              ? requestError.message
              : "Unable to load messages",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    if (accessToken) {
      connectSocket(accessToken);
    }

    loadMessages();

    const socket = getSocket();
    if (socket?.connected) {
      socket.emit("group:join", { groupId: activeGroupId });
    }

    const handleNewMessage = ({ message }: { message: ChatMessage }) => {
      const messageGroupId =
        typeof message.group === "string" ? message.group : message.group?._id;
      if (messageGroupId === activeGroupId) {
        appendMessage(activeGroupId, message);
      }
    };

    socket?.on("message:new", handleNewMessage);

    return () => {
      cancelled = true;
      socket?.off("message:new", handleNewMessage);
    };
  }, [accessToken, activeGroupId, appendMessage, setMessages]);

  useEffect(() => {
    scrollerRef.current?.scrollTo({
      top: scrollerRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [groupMessages.length]);

  return (
    <section ref={scrollerRef} className="message-list">
      {loading ? (
        <div className="message-list__state">Loading messages...</div>
      ) : null}
      {error ? (
        <div className="message-list__state message-list__state--error">
          {error}
        </div>
      ) : null}
      {!loading && groupMessages.length === 0 && !error ? (
        <div className="message-list__state">
          Start the conversation. Your first message sets the tone.
        </div>
      ) : null}

      <div className="message-list__items">
        {groupMessages.map((message) => {
          const isSystem = message.type === "system";
          return (
            <article
              key={message._id}
              className={
                isSystem ? "message-card message-card--system" : "message-card"
              }
            >
              <div className="message-card__header">
                <strong>
                  {isSystem ? "System" : message.sender?.username || "Unknown"}
                </strong>
                {message.isEdited ? <span>edited</span> : null}
              </div>
              <p className="message-card__content">{message.content || " "}</p>
              {Array.isArray(message.attachments) &&
              message.attachments.length > 0 ? (
                <div className="message-card__attachments">
                  {message.attachments.map((attachment) => (
                    <a
                      key={attachment.url}
                      href={attachment.url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {attachment.filename}
                    </a>
                  ))}
                </div>
              ) : null}
            </article>
          );
        })}
      </div>
    </section>
  );
}
