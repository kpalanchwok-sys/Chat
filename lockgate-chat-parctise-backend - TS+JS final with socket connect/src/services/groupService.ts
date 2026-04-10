import { Group } from "../models/Group";
import { Message } from "../models/Message";
import User from "../models/User";
import AppError from "../utils/AppError";

// ─── Helpers ──────────────────────────────────────────────────────────────────
const systemMessage = async (
  groupId: string,
  senderId: string,
  content: string,
) =>
  Message.create({ group: groupId, sender: senderId, content, type: "system" });

const populateGroup = (query: any) =>
  query
    .populate("createdBy", "username avatar")
    .populate("members.user", "username avatar isOnline lastSeen")
    .populate({
      path: "lastMessage",
      populate: { path: "sender", select: "username avatar" },
    });

// ─── Service functions ────────────────────────────────────────────────────────
interface BrowseGroupsOptions {
  search?: string;
  page?: number;
  limit?: number;
}

const browseGroups = async ({
  search,
  page = 1,
  limit = 20,
}: BrowseGroupsOptions) => {
  const skip = (page - 1) * limit;
  const filter: any = { type: "public", isActive: true };
  if (search?.trim()) filter.$text = { $search: search.trim() };

  const [groups, total] = await Promise.all([
    Group.find(filter)
      .populate("createdBy", "username avatar")
      .sort({ lastActivity: -1 })
      .skip(skip)
      .limit(Number(limit))
      .select("-members -pinnedMessages"),
    Group.countDocuments(filter),
  ]);

  return { groups, total, page: Number(page), limit: Number(limit) };
};

const getUserGroups = async (userId: string) => {
  return populateGroup(
    Group.find({ "members.user": userId, isActive: true }),
  ).sort({ lastActivity: -1 });
};

const getGroupById = async (groupId: string, requestingUserId: string) => {
  const group = await populateGroup(Group.findById(groupId));
  if (!group || !group.isActive) throw new AppError("Group not found", 404);

  if (group.type === "private" && !group.isMember(requestingUserId)) {
    throw new AppError("This is a private group", 403, "PRIVATE_GROUP");
  }
  return group;
};

interface CreateGroupPayload {
  name: string;
  description?: string;
  type?: "public" | "private";
  maxMembers?: number;
  tags?: string[];
}

const createGroup = async (
  { name, description, type, maxMembers, tags }: CreateGroupPayload,
  userId: string,
) => {
  const group = new Group({
    name,
    description,
    type,
    maxMembers,
    tags,
    createdBy: userId,
    members: [{ user: userId, role: "owner", joinedAt: new Date() }],
  });

  // if (type === "private") group.generateInviteCode();
  await group.save();

  await User.findByIdAndUpdate(userId, { $addToSet: { groups: group._id } });
  await systemMessage(
    group._id.toString(),
    userId,
    `Group "${name}" was created`,
  );

  return populateGroup(Group.findById(group._id));
};

// const joinGroup = async (groupId: string, user: IUser) => {
const joinGroup = async (groupId: string, user: any) => {
  const group = await Group.findById(groupId);
  if (!group || !group.isActive) throw new AppError("Group not found", 404);
  if (group.type === "private")
    throw new AppError("Use an invite code to join this private group", 403);
  if (group.isMember(user._id))
    throw new AppError("You are already a member", 409, "ALREADY_MEMBER");
  if (group.members.length >= group.maxMembers)
    throw new AppError("This group is full", 400, "GROUP_FULL");

  group.members.push({
    user: user._id,
    role: "member",
    joinedAt: new Date(),
  } as any);
  group.lastActivity = new Date();
  await group.save();

  await User.findByIdAndUpdate(user._id, { $addToSet: { groups: group._id } });
  const msg = await systemMessage(
    groupId,
    user._id.toString(),
    `${user.username} joined the group`,
  );

  await Group.findByIdAndUpdate(group._id, { lastMessage: msg._id });
  return group;
};

// const joinByInvite = async (inviteCode: string, user: IUser) => {
const joinByInvite = async (inviteCode: string, user: any) => {
  const group = await Group.findOne({ inviteCode, isActive: true });
  if (!group) throw new AppError("Invalid invite code", 404, "INVALID_INVITE");
  if (group.isMember(user._id))
    throw new AppError("You are already a member", 409, "ALREADY_MEMBER");
  if (group.members.length >= group.maxMembers)
    throw new AppError("This group is full", 400, "GROUP_FULL");

  group.members.push({
    user: user._id,
    role: "member",
    joinedAt: new Date(),
  } as any);
  group.lastActivity = new Date();
  await group.save();

  await User.findByIdAndUpdate(user._id, { $addToSet: { groups: group._id } });
  const msg = await systemMessage(
    group._id.toString(),
    user._id.toString(),
    `${user.username} joined via invite link`,
  );
  await Group.findByIdAndUpdate(group._id, { lastMessage: msg._id });
  return group;
};

// const leaveGroup = async (groupId: string, user: IUser) => {
const leaveGroup = async (groupId: string, user: any) => {
  const group = await Group.findById(groupId);
  if (!group) throw new AppError("Group not found", 404);
  if (!group.isMember(user._id))
    throw new AppError("You are not a member of this group", 400);

  const role = group.getMemberRole(user._id);
  if (role === "owner") {
    throw new AppError(
      "Owner cannot leave. Transfer ownership or delete the group first.",
      400,
      "OWNER_CANNOT_LEAVE",
    );
  }

  group.members = group.members.filter(
    (m) => m.user.toString() !== user._id.toString(),
  );
  group.lastActivity = new Date();
  await group.save();

  await User.findByIdAndUpdate(user._id, { $pull: { groups: group._id } });
  await systemMessage(
    groupId,
    user._id.toString(),
    `${user.username} left the group`,
  );
};

interface UpdateGroupPayload {
  name?: string;
  description?: string;
  avatar?: string;
  maxMembers?: number;
  tags?: string[];
}

const updateGroup = async (
  groupId: string,
  updates: UpdateGroupPayload,
  requestingUserId: string,
) => {
  const group = await Group.findById(groupId);
  if (!group || !group.isActive) throw new AppError("Group not found", 404);
  if (!group.isAdmin(requestingUserId))
    throw new AppError("Admin access required", 403);

  const allowed = ["name", "description", "avatar", "maxMembers", "tags"];
  allowed.forEach((f) => {
    if ((updates as any)[f] !== undefined)
      (group as any)[f] = (updates as any)[f];
  });

  await group.save();
  return group;
};

const deleteGroup = async (groupId: string, requestingUserId: string) => {
  const group = await Group.findById(groupId);
  if (!group || !group.isActive) throw new AppError("Group not found", 404);
  if (group.getMemberRole(requestingUserId) !== "owner") {
    throw new AppError("Only the owner can delete this group", 403);
  }

  group.isActive = false;
  await group.save();

  const memberIds = group.members.map((m) => m.user);
  await User.updateMany(
    { _id: { $in: memberIds } },
    { $pull: { groups: group._id } },
  );
};

const updateMemberRole = async (
  groupId: string,
  targetUserId: string,
  newRole: string,
  requestingUserId: string,
) => {
  const group = await Group.findById(groupId);
  if (!group || !group.isActive) throw new AppError("Group not found", 404);
  if (!group.isAdmin(requestingUserId))
    throw new AppError("Admin access required", 403);
  if (!group.isMember(targetUserId))
    throw new AppError("User is not a member", 404);

  const member = group.members.find(
    (m) => m.user.toString() === targetUserId.toString(),
  );
  if (member?.role === "owner")
    throw new AppError("Cannot change owner role", 400);
  if (member) member.role = newRole as any;
  await group.save();
  return group;
};

const kickMember = async (
  groupId: string,
  targetUserId: string,
  requestingUserId: string,
) => {
  const group = await Group.findById(groupId);
  if (!group || !group.isActive) throw new AppError("Group not found", 404);
  if (!group.isModerator(requestingUserId))
    throw new AppError("Moderator access required", 403);
  if (!group.isMember(targetUserId))
    throw new AppError("User is not a member", 404);

  const targetRole = group.getMemberRole(targetUserId);
  if (["owner", "admin"].includes(targetRole || ""))
    throw new AppError("Cannot kick an admin or owner", 400);

  group.members = group.members.filter(
    (m) => m.user.toString() !== targetUserId.toString(),
  );
  await group.save();

  await User.findByIdAndUpdate(targetUserId, { $pull: { groups: group._id } });
};

const regenerateInviteCode = async (
  groupId: string,
  requestingUserId: string,
) => {
  const group = await Group.findById(groupId);
  if (!group || !group.isActive) throw new AppError("Group not found", 404);
  if (!group.isAdmin(requestingUserId))
    throw new AppError("Admin access required", 403);
  if (group.type !== "private")
    throw new AppError("Only private groups have invite codes", 400);

  // group.generateInviteCode();
  await group.save();
  return group.inviteCode;
};

export {
  browseGroups,
  createGroup,
  deleteGroup,
  getGroupById,
  getUserGroups,
  joinByInvite,
  joinGroup,
  kickMember,
  leaveGroup,
  regenerateInviteCode,
  updateGroup,
  updateMemberRole,
};
