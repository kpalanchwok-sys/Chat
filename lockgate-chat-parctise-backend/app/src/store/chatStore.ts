import { create } from "zustand/react";
import api from "../api/axios";

export interface ChatGroup {
  _id: string;
  name: string;
  description?: string;
  avatar?: string | null;
  type?: "public" | "private";
  lastActivity?: string;
  lastMessage?: {
    content?: string;
    type?: string;
    createdAt?: string;
    sender?: { username?: string };
  } | null;
  memberCount?: number;
  members?: Array<{
    user: { _id: string; username: string; avatar?: string | null };
  }>;
}

export interface ChatAttachment {
  url: string;
  filename: string;
  mimetype: string;
  size: number;
}

export interface ChatMessage {
  _id: string;
  group: string | ChatGroup;
  sender: {
    _id?: string;
    username: string;
    avatar?: string | null;
    isOnline?: boolean;
  };
  content: string;
  type: "text" | "image" | "file" | "system" | "reply";
  attachments?: ChatAttachment[];
  replyTo?: ChatMessage | null;
  isDeleted?: boolean;
  isEdited?: boolean;
  createdAt?: string;
}

interface ChatState {
  groups: ChatGroup[];
  discoverGroups: ChatGroup[];
  messages: Record<string, ChatMessage[]>;
  activeGroupId: string | null;
  isLoadingGroups: boolean;
  isLoadingMessages: boolean;
  error: string | null;
  setGroups: (groups: ChatGroup[]) => void;
  setDiscoverGroups: (groups: ChatGroup[]) => void;
  setActiveGroup: (id: string | null) => void;
  setMessages: (groupId: string, messages: ChatMessage[]) => void;
  appendMessage: (groupId: string, message: ChatMessage) => void;
  resetChat: () => void;
  loadMyGroups: () => Promise<void>;
  loadDiscoverGroups: () => Promise<void>;
  joinGroup: (groupId: string) => Promise<void>;
}

const sortByLastActivity = (groups: ChatGroup[]) =>
  [...groups].sort((left, right) => {
    const leftTime = new Date(left.lastActivity ?? 0).getTime();
    const rightTime = new Date(right.lastActivity ?? 0).getTime();
    return rightTime - leftTime;
  });

const uniqById = (groups: ChatGroup[]) => {
  const map = new Map<string, ChatGroup>();
  groups.forEach((group) => map.set(group._id, group));
  return Array.from(map.values());
};

const uniqMessages = (messages: ChatMessage[]) => {
  const map = new Map<string, ChatMessage>();
  messages.forEach((message) => map.set(message._id, message));
  return Array.from(map.values()).sort((left, right) => {
    const leftTime = new Date(left.createdAt ?? 0).getTime();
    const rightTime = new Date(right.createdAt ?? 0).getTime();
    return leftTime - rightTime;
  });
};

export const useChatStore = create<ChatState>((set) => ({
  groups: [],
  discoverGroups: [],
  messages: {},
  activeGroupId: null,
  isLoadingGroups: false,
  isLoadingMessages: false,
  error: null,

  setGroups: (groups) =>
    set((state) => ({
      ...state,
      groups: sortByLastActivity(uniqById(groups)),
      error: null,
    })),

  setDiscoverGroups: (groups) =>
    set((state) => ({
      ...state,
      discoverGroups: sortByLastActivity(uniqById(groups)),
      error: null,
    })),

  setActiveGroup: (id) => set({ activeGroupId: id }),

  setMessages: (groupId, messages) =>
    set((state) => ({
      ...state,
      messages: {
        ...state.messages,
        [groupId]: uniqMessages(messages),
      },
      isLoadingMessages: false,
      error: null,
    })),

  appendMessage: (groupId, message) =>
    set((state) => {
      const existing = state.messages[groupId] ?? [];
      const nextMessages = uniqMessages([...existing, message]);

      const hydrateGroup = (group: ChatGroup) =>
        group._id === groupId
          ? {
              ...group,
              lastMessage: {
                content: message.content,
                type: message.type,
                createdAt: message.createdAt,
                sender: { username: message.sender?.username },
              },
              lastActivity: message.createdAt ?? new Date().toISOString(),
            }
          : group;

      return {
        ...state,
        messages: {
          ...state.messages,
          [groupId]: nextMessages,
        },
        groups: state.groups.map(hydrateGroup),
        discoverGroups: state.discoverGroups.map(hydrateGroup),
      };
    }),

  resetChat: () =>
    set({
      groups: [],
      discoverGroups: [],
      messages: {},
      activeGroupId: null,
      isLoadingGroups: false,
      isLoadingMessages: false,
      error: null,
    }),

  loadMyGroups: async () => {
    set({ isLoadingGroups: true, error: null });
    try {
      const response = await api.get("/groups/my");
      const groups = (response.data?.data?.groups ?? []) as ChatGroup[];
      set((state) => ({
        ...state,
        groups: sortByLastActivity(uniqById(groups)),
        isLoadingGroups: false,
        error: null,
        activeGroupId: state.activeGroupId ?? groups[0]?._id ?? null,
      }));
    } catch (error) {
      set({
        isLoadingGroups: false,
        error: error instanceof Error ? error.message : "Unable to load groups",
      });
      throw error;
    }
  },

  loadDiscoverGroups: async () => {
    try {
      const response = await api.get("/groups?limit=30");
      const groups = (response.data?.data ?? []) as ChatGroup[];
      set((state) => ({
        ...state,
        discoverGroups: sortByLastActivity(uniqById(groups)),
      }));
    } catch (error) {
      set({
        error:
          error instanceof Error ? error.message : "Unable to browse groups",
      });
      throw error;
    }
  },

  joinGroup: async (groupId) => {
    const response = await api.post(`/groups/${groupId}/join`);
    const group = response.data?.data?.group as ChatGroup | undefined;

    if (!group) {
      return;
    }

    set((state) => ({
      ...state,
      groups: sortByLastActivity(uniqById([group, ...state.groups])),
      discoverGroups: state.discoverGroups.filter(
        (item) => item._id !== groupId,
      ),
      activeGroupId: group._id,
    }));
  },
}));
