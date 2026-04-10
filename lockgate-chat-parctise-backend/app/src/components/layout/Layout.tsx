import { useEffect } from "react";
import { connectSocket, disconnectSocket } from "../../socket/socket";
import { useAuthStore } from "../../store/authStore";
import { useChatStore } from "../../store/chatStore";
import ChatWindow from "./ChatWindow";
import Sidebar from "./Sidebar";

export default function Layout() {
  const user = useAuthStore((state) => state.user);
  const accessToken = useAuthStore((state) => state.accessToken);
  const groups = useChatStore((state) => state.groups);
  const activeGroupId = useChatStore((state) => state.activeGroupId);
  const loadMyGroups = useChatStore((state) => state.loadMyGroups);
  const loadDiscoverGroups = useChatStore((state) => state.loadDiscoverGroups);
  const setActiveGroup = useChatStore((state) => state.setActiveGroup);

  useEffect(() => {
    if (!user || !accessToken) {
      return;
    }

    connectSocket(accessToken);
    void loadMyGroups();
    void loadDiscoverGroups();

    return () => {
      disconnectSocket();
    };
  }, [accessToken, loadDiscoverGroups, loadMyGroups, user]);

  useEffect(() => {
    if (!activeGroupId && groups.length > 0) {
      setActiveGroup(groups[0]._id);
    }
  }, [activeGroupId, groups, setActiveGroup]);

  return (
    <div className="chat-shell">
      <Sidebar />
      <ChatWindow />
    </div>
  );
}
