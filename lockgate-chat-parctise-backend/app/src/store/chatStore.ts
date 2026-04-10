import { create } from "zustand/react";
import {
  browseGroups,
  createGroup as createGroupRequest,
  deleteGroup as deleteGroupRequest,
  getGroupById,
  getGroupMembers,
  getMyGroups,
  joinByInvite as joinByInviteRequest,
  joinGroup as joinGroupRequest,
  kickMember as kickMemberRequest,
  leaveGroup as leaveGroupRequest,
  updateGroup as updateGroupRequest,
  updateMemberRole as updateMemberRoleRequest,
  type CreateGroupInput,
  type UpdateGroupInput,
} from "../api/groups";
import type {
  ChatGroup,
  ChatMessage,
  GroupMember,
  GroupRole,
} from "./chatTypes";

export type { ChatAttachment, ChatGroup, ChatMessage } from "./chatTypes";

interface ChatState {
  groups: ChatGroup[];
  discoverGroups: ChatGroup[];
  messages: Record<string, ChatMessage[]>;
  activeGroupId: string | null;
  activeGroupDetails: ChatGroup | null;
  isLoadingGroups: boolean;
  isLoadingDiscoverGroups: boolean;
  isLoadingGroupDetails: boolean;
  error: string | null;
  setGroups: (groups: ChatGroup[]) => void;
  setDiscoverGroups: (groups: ChatGroup[]) => void;
  setActiveGroup: (id: string | null) => void;
  setMessages: (groupId: string, messages: ChatMessage[]) => void;
  appendMessage: (groupId: string, message: ChatMessage) => void;
  resetChat: () => void;
  loadMyGroups: () => Promise<void>;
  loadDiscoverGroups: (search?: string) => Promise<void>;
  loadGroupDetails: (groupId: string) => Promise<void>;
  loadGroupMembers: (groupId: string) => Promise<void>;
  createGroup: (payload: CreateGroupInput) => Promise<ChatGroup>;
  joinByInvite: (inviteCode: string) => Promise<ChatGroup>;
  joinGroup: (groupId: string) => Promise<void>;
  leaveGroup: (groupId: string) => Promise<void>;
  updateGroup: (groupId: string, payload: UpdateGroupInput) => Promise<void>;
  deleteGroup: (groupId: string) => Promise<void>;
  updateMemberRole: (
    groupId: string,
    userId: string,
    role: GroupRole,
  ) => Promise<void>;
  kickMember: (groupId: string, userId: string) => Promise<void>;
}

const sortByLastActivity = (groups: ChatGroup[]) =>
  [...groups].sort((left, right) => {
    const leftTime = new Date(left.lastActivity ?? 0).getTime();
    const rightTime = new Date(right.lastActivity ?? 0).getTime();
    return rightTime - leftTime;
  });

const uniqById = (groups: ChatGroup[]) => {
  const map = new Map<string, ChatGroup>();

  groups.forEach((group) => {
    const previous = map.get(group._id);
    map.set(group._id, previous ? { ...previous, ...group } : group);
  });

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

const upsertGroup = (groups: ChatGroup[], group: ChatGroup) =>
  sortByLastActivity(uniqById([group, ...groups]));

const replaceGroup = (groups: ChatGroup[], group: ChatGroup) =>
  sortByLastActivity(
    uniqById(groups.map((entry) => (entry._id === group._id ? group : entry))),
  );

const mergeMembers = (group: ChatGroup | null, members: GroupMember[]) =>
  group
    ? {
        ...group,
        members,
        memberCount: members.length,
      }
    : group;

const toErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;

export const useChatStore = create<ChatState>((set, get) => ({
  groups: [],
  discoverGroups: [],
  messages: {},
  activeGroupId: null,
  activeGroupDetails: null,
  isLoadingGroups: false,
  isLoadingDiscoverGroups: false,
  isLoadingGroupDetails: false,
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

  setActiveGroup: (id) =>
    set((state) => ({
      activeGroupId: id,
      activeGroupDetails:
        state.activeGroupDetails?._id === id ? state.activeGroupDetails : null,
    })),

  setMessages: (groupId, messages) =>
    set((state) => ({
      ...state,
      messages: {
        ...state.messages,
        [groupId]: uniqMessages(messages),
      },
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

      const nextActiveGroup =
        state.activeGroupDetails?._id === groupId
          ? hydrateGroup(state.activeGroupDetails)
          : state.activeGroupDetails;

      return {
        ...state,
        messages: {
          ...state.messages,
          [groupId]: nextMessages,
        },
        groups: state.groups.map(hydrateGroup),
        discoverGroups: state.discoverGroups.map(hydrateGroup),
        activeGroupDetails: nextActiveGroup,
      };
    }),

  resetChat: () =>
    set({
      groups: [],
      discoverGroups: [],
      messages: {},
      activeGroupId: null,
      activeGroupDetails: null,
      isLoadingGroups: false,
      isLoadingDiscoverGroups: false,
      isLoadingGroupDetails: false,
      error: null,
    }),

  loadMyGroups: async () => {
    set({ isLoadingGroups: true, error: null });
    try {
      const groups = await getMyGroups();
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
        error: toErrorMessage(error, "Unable to load groups"),
      });
      throw error;
    }
  },

  loadDiscoverGroups: async (search) => {
    set({ isLoadingDiscoverGroups: true, error: null });
    try {
      const { groups } = await browseGroups({ limit: 30, search });
      set((state) => ({
        ...state,
        discoverGroups: sortByLastActivity(uniqById(groups)),
        isLoadingDiscoverGroups: false,
        error: null,
      }));
    } catch (error) {
      set({
        isLoadingDiscoverGroups: false,
        error: toErrorMessage(error, "Unable to browse groups"),
      });
    }
  },

  loadGroupDetails: async (groupId) => {
    set({ isLoadingGroupDetails: true, error: null });

    try {
      const group = await getGroupById(groupId);
      set((state) => ({
        ...state,
        groups: replaceGroup(state.groups, group),
        discoverGroups: replaceGroup(state.discoverGroups, group),
        activeGroupDetails: state.activeGroupId === groupId ? group : null,
        isLoadingGroupDetails: false,
        error: null,
      }));
    } catch (error) {
      set({
        isLoadingGroupDetails: false,
        error: toErrorMessage(error, "Unable to load group"),
      });
      throw error;
    }
  },

  loadGroupMembers: async (groupId) => {
    try {
      const { members, memberCount } = await getGroupMembers(groupId);

      set((state) => {
        const applyMembers = (group: ChatGroup) =>
          group._id === groupId ? { ...group, members, memberCount } : group;

        return {
          ...state,
          groups: state.groups.map(applyMembers),
          discoverGroups: state.discoverGroups.map(applyMembers),
          activeGroupDetails:
            state.activeGroupDetails?._id === groupId
              ? mergeMembers(state.activeGroupDetails, members)
              : state.activeGroupDetails,
          error: null,
        };
      });
    } catch (error) {
      set({
        error: toErrorMessage(error, "Unable to load group members"),
      });
      throw error;
    }
  },

  createGroup: async (payload) => {
    try {
      const group = await createGroupRequest(payload);
      set((state) => ({
        ...state,
        groups: upsertGroup(state.groups, group),
        activeGroupId: group._id,
        activeGroupDetails: group,
        error: null,
      }));
      return group;
    } catch (error) {
      set({
        error: toErrorMessage(error, "Unable to create group"),
      });
      throw error;
    }
  },

  joinByInvite: async (inviteCode) => {
    try {
      const group = await joinByInviteRequest(inviteCode);
      set((state) => ({
        ...state,
        groups: upsertGroup(state.groups, group),
        discoverGroups: state.discoverGroups.filter(
          (entry) => entry._id !== group._id,
        ),
        activeGroupId: group._id,
        activeGroupDetails: group,
        error: null,
      }));
      return group;
    } catch (error) {
      set({
        error: toErrorMessage(error, "Unable to join with invite code"),
      });
      throw error;
    }
  },

  joinGroup: async (groupId) => {
    try {
      const group = await joinGroupRequest(groupId);
      set((state) => ({
        ...state,
        groups: upsertGroup(state.groups, group),
        discoverGroups: state.discoverGroups.filter(
          (item) => item._id !== groupId,
        ),
        activeGroupId: group._id,
        activeGroupDetails: group,
        error: null,
      }));
    } catch (error) {
      set({
        error: toErrorMessage(error, "Unable to join group"),
      });
      throw error;
    }
  },

  leaveGroup: async (groupId) => {
    try {
      await leaveGroupRequest(groupId);

      set((state) => {
        const nextGroups = state.groups.filter(
          (group) => group._id !== groupId,
        );
        const nextActiveGroupId =
          state.activeGroupId === groupId
            ? (nextGroups[0]?._id ?? null)
            : state.activeGroupId;

        return {
          ...state,
          groups: nextGroups,
          activeGroupId: nextActiveGroupId,
          activeGroupDetails:
            state.activeGroupId === groupId ? null : state.activeGroupDetails,
          error: null,
        };
      });

      await get().loadDiscoverGroups();
    } catch (error) {
      set({
        error: toErrorMessage(error, "Unable to leave group"),
      });
      throw error;
    }
  },

  updateGroup: async (groupId, payload) => {
    try {
      const group = await updateGroupRequest(groupId, payload);
      set((state) => ({
        ...state,
        groups: replaceGroup(state.groups, group),
        discoverGroups: replaceGroup(state.discoverGroups, group),
        activeGroupDetails:
          state.activeGroupDetails?._id === groupId
            ? { ...state.activeGroupDetails, ...group }
            : state.activeGroupDetails,
        error: null,
      }));
    } catch (error) {
      set({
        error: toErrorMessage(error, "Unable to update group"),
      });
      throw error;
    }
  },

  deleteGroup: async (groupId) => {
    try {
      await deleteGroupRequest(groupId);
      set((state) => {
        const nextGroups = state.groups.filter(
          (group) => group._id !== groupId,
        );
        const nextActiveGroupId =
          state.activeGroupId === groupId
            ? (nextGroups[0]?._id ?? null)
            : state.activeGroupId;

        return {
          ...state,
          groups: nextGroups,
          activeGroupId: nextActiveGroupId,
          activeGroupDetails:
            state.activeGroupId === groupId ? null : state.activeGroupDetails,
          error: null,
        };
      });

      await get().loadDiscoverGroups();
    } catch (error) {
      set({
        error: toErrorMessage(error, "Unable to delete group"),
      });
      throw error;
    }
  },

  updateMemberRole: async (groupId, userId, role) => {
    try {
      const group = await updateMemberRoleRequest(groupId, userId, role);
      set((state) => ({
        ...state,
        groups: replaceGroup(state.groups, group),
        discoverGroups: replaceGroup(state.discoverGroups, group),
        activeGroupDetails:
          state.activeGroupDetails?._id === groupId
            ? { ...state.activeGroupDetails, ...group }
            : state.activeGroupDetails,
        error: null,
      }));
      await get().loadGroupMembers(groupId);
    } catch (error) {
      set({
        error: toErrorMessage(error, "Unable to update member role"),
      });
      throw error;
    }
  },

  kickMember: async (groupId, userId) => {
    try {
      await kickMemberRequest(groupId, userId);
      await get().loadGroupMembers(groupId);
      await get().loadGroupDetails(groupId);
    } catch (error) {
      set({
        error: toErrorMessage(error, "Unable to remove member"),
      });
      throw error;
    }
  },
}));
