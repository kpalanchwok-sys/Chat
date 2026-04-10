import type { FormEvent } from "react";
import { useEffect, useRef, useState } from "react";
import api from "../../api/axios";
import { getSocket } from "../../socket/socket";
import { useAuthStore } from "../../store/authStore";
import { useChatStore, type ChatMessage } from "../../store/chatStore";

export default function MessageInput() {
  const activeGroupId = useChatStore((state) => state.activeGroupId);
  const appendMessage = useChatStore((state) => state.appendMessage);
  const accessToken = useAuthStore((state) => state.accessToken);
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      stopTyping();
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, [activeGroupId]);

  const emitTyping = () => {
    if (!activeGroupId) return;

    const socket = getSocket();
    socket?.emit("typing:start", { groupId: activeGroupId });

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      socket?.emit("typing:stop", { groupId: activeGroupId });
    }, 1200);
  };

  const stopTyping = () => {
    if (!activeGroupId) return;
    const socket = getSocket();
    socket?.emit("typing:stop", { groupId: activeGroupId });
  };

  const sendMessage = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const content = message.trim();

    if (!activeGroupId || !content || sending) {
      return;
    }

    setSending(true);
    setError(null);
    stopTyping();

    try {
      const socket = getSocket();

      if (socket?.connected) {
        type SendAck = {
          success?: boolean;
          message?: ChatMessage;
          error?: string;
        };

        const response = await new Promise<SendAck>((resolve) => {
          socket.emit(
            "message:send",
            { groupId: activeGroupId, content, type: "text" },
            (ack: SendAck) => resolve(ack ?? {}),
          );
        });

        if (response.error) {
          throw new Error(response.error);
        }

        if (response.message) {
          appendMessage(activeGroupId, response.message);
        }
      } else {
        const response = await api.post(`/groups/${activeGroupId}/messages`, {
          content,
          type: "text",
        });

        const nextMessage = response.data?.data?.message;
        if (nextMessage) {
          appendMessage(activeGroupId, nextMessage);
        }
      }

      setMessage("");
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to send message",
      );
    } finally {
      setSending(false);
    }
  };

  if (!activeGroupId) {
    return (
      <footer className="message-input message-input--disabled">
        <p>Select a group to start chatting.</p>
      </footer>
    );
  }

  return (
    <footer className="message-input">
      {error ? <div className="message-input__error">{error}</div> : null}
      <form className="message-input__form" onSubmit={sendMessage}>
        <textarea
          value={message}
          onChange={(event) => {
            setMessage(event.target.value);
            emitTyping();
          }}
          onBlur={stopTyping}
          placeholder="Write a message"
          rows={3}
        />
        <div className="message-input__actions">
          <span>
            {accessToken ? "Encrypted session active" : "Offline mode"}
          </span>
          <button
            type="submit"
            className="button button--primary"
            disabled={sending || !message.trim()}
          >
            {sending ? "Sending..." : "Send"}
          </button>
        </div>
      </form>
    </footer>
  );
}
