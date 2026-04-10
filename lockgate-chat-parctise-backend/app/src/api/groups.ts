import api from "./axios";
import type { ChatGroup, GroupMember, GroupRole } from "../store/chatTypes";

export interface BrowseGroupsParams {
  search?: string;
  page?: number;
  limit?: number;
}

export interface CreateGroupInput {
  name: string;
  description?: string;
  type?: "public" | "private";
  maxMembers?: number;
  tags?: string[];
}

export interface UpdateGroupInput {
  name?: string;
  description?: string;
  avatar?: string;
  maxMembers?: number;
  tags?: string[];
}

export const browseGroups = async (params: BrowseGroupsParams = {}) => {
  const response = await api.get("/groups", { params });

  return {
    groups: (response.data?.data ?? []) as ChatGroup[],
    pagination: response.data?.meta?.pagination as
      | {
          page?: number;
          limit?: number;
          total?: number;
          pages?: number;
        }
      | undefined,
  };
};

export const getMyGroups = async () => {
  const response = await api.get("/groups/my");
  return (response.data?.data?.groups ?? []) as ChatGroup[];
};

export const createGroup = async (payload: CreateGroupInput) => {
  const response = await api.post("/groups", payload);
  return response.data?.data?.group as ChatGroup;
};

export const joinByInvite = async (inviteCode: string) => {
  const response = await api.post("/groups/join-invite", { inviteCode });
  return response.data?.data?.group as ChatGroup;
};

export const getGroupById = async (groupId: string) => {
  const response = await api.get(`/groups/${groupId}`);
  return response.data?.data?.group as ChatGroup;
};

export const joinGroup = async (groupId: string) => {
  const response = await api.post(`/groups/${groupId}/join`);
  return response.data?.data?.group as ChatGroup;
};

export const leaveGroup = async (groupId: string) => {
  await api.post(`/groups/${groupId}/leave`);
};

export const updateGroup = async (
  groupId: string,
  payload: UpdateGroupInput,
) => {
  const response = await api.patch(`/groups/${groupId}`, payload);
  return response.data?.data?.group as ChatGroup;
};

export const deleteGroup = async (groupId: string) => {
  await api.delete(`/groups/${groupId}`);
};

export const getGroupMembers = async (groupId: string) => {
  const response = await api.get(`/groups/${groupId}/members`);
  return {
    members: (response.data?.data?.members ?? []) as GroupMember[],
    memberCount: response.data?.data?.memberCount as number | undefined,
  };
};

export const updateMemberRole = async (
  groupId: string,
  userId: string,
  role: GroupRole,
) => {
  const response = await api.patch(`/groups/${groupId}/members/${userId}/role`, {
    role,
  });
  return response.data?.data?.group as ChatGroup;
};

export const kickMember = async (groupId: string, userId: string) => {
  await api.delete(`/groups/${groupId}/members/${userId}`);
};
