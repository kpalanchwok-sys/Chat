export type GroupRole = "member" | "moderator" | "admin" | "owner";

export interface GroupUser {
  _id: string;
  username: string;
  avatar?: string | null;
  email?: string;
  bio?: string;
  isOnline?: boolean;
  lastSeen?: string;
}

export interface GroupMember {
  user: GroupUser;
  role: GroupRole;
  joinedAt?: string;
  nickname?: string | null;
  isMuted?: boolean;
  mutedUntil?: string | null;
}

export interface ChatGroup {
  _id: string;
  name: string;
  description?: string;
  avatar?: string | null;
  type?: "public" | "private";
  inviteCode?: string;
  maxMembers?: number;
  tags?: string[];
  lastActivity?: string;
  lastMessage?: {
    content?: string;
    type?: string;
    createdAt?: string;
    sender?: { username?: string };
  } | null;
  memberCount?: number;
  createdBy?: GroupUser;
  members?: GroupMember[];
  isActive?: boolean;
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
