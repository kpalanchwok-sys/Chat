import mongoose, { Document, Schema } from "mongoose";

export interface IUserStatus extends Document {
  userId: mongoose.Types.ObjectId;
  status: "ONLINE" | "OFFLINE";
  socketId?: string;
  lastSeen?: Date;
  updatedAt: Date;
}

const userStatusSchema = new Schema<IUserStatus>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    status: {
      type: String,
      enum: ["ONLINE", "OFFLINE"],
      default: "OFFLINE",
    },
    socketId: {
      type: String,
    },
    lastSeen: {
      type: Date,
    },
  },
  { timestamps: true },
);

export const UserStatus = mongoose.model<IUserStatus>(
  "UserStatus",
  userStatusSchema,
);
