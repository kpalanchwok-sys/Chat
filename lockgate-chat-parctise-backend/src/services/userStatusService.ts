import mongoose from "mongoose";
import { UserStatus } from "../models/userStatus";

/**
 * Update user status
 */
export const updateUserStatus = async ({
  userId,
  adminId,
  status,
  socketId,
}: {
  userId?: string;
  adminId?: string;
  status: "ONLINE" | "OFFLINE";
  socketId?: string;
}) => {
  const id = userId || adminId;

  if (!id) {
    throw new Error("userId or adminId is required");
  }

  const objectId = new mongoose.Types.ObjectId(id);

  const existing = await UserStatus.findOne({ userId: objectId });

  const updated = await UserStatus.findOneAndUpdate(
    { userId: objectId },
    {
      userId: objectId,
      status,
      socketId: status === "ONLINE" ? socketId : "",
      lastSeen: status === "OFFLINE" ? new Date() : undefined,
    },
    {
      new: true,
      upsert: true,
    },
  );

  return {
    old: existing,
    current: updated,
  };
};

/**
 * Get status of multiple users
 */
export const getUserStatus = async (userIds: string[]) => {
  const objectIds = userIds.map((id) => new mongoose.Types.ObjectId(id));

  const statuses = await UserStatus.find({
    userId: { $in: objectIds },
  }).lean();

  // Convert to map for fast lookup
  const statusMap = new Map(statuses.map((s) => [s.userId.toString(), s]));

  // Return consistent response for all requested users
  return userIds.map((id) => {
    const status = statusMap.get(id);

    return {
      userId: id,
      status: status?.status || "OFFLINE",
      lastSeen: status?.lastSeen || null,
    };
  });
};
