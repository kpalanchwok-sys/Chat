import mongoose, { Document, Model, Schema } from "mongoose";

interface IMember extends Document {
  user: mongoose.Types.ObjectId;
  role: "member" | "moderator" | "admin" | "owner";
  joinedAt: Date;
  nickname: string | null;
  isMuted: boolean;
  mutedUntil: Date | null;
}

interface IGroup extends Document {
  name: string;
  description: string;
  avatar: string | null;
  type: "public" | "private";
  inviteCode: string;
  createdBy: mongoose.Types.ObjectId;
  members: IMember[];
  maxMembers: number;
  lastMessage: mongoose.Types.ObjectId | null;
  lastActivity: Date;
  pinnedMessages: mongoose.Types.ObjectId[];
  isActive: boolean;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
  memberCount: number;
  isMember(userId: mongoose.Types.ObjectId | string): boolean;
  getMemberRole(userId: mongoose.Types.ObjectId | string): string | null;
  isAdmin(userId: mongoose.Types.ObjectId | string): boolean;
  isModerator(userId: mongoose.Types.ObjectId | string): boolean;
}

const memberSchema = new Schema<IMember>(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    role: {
      type: String,
      enum: ["member", "moderator", "admin", "owner"],
      default: "member",
    },
    joinedAt: { type: Date, default: Date.now },
    nickname: { type: String, default: null, maxlength: 30 },
    isMuted: { type: Boolean, default: false },
    mutedUntil: { type: Date, default: null },
  },
  { _id: false },
);

const groupSchema = new Schema<IGroup>(
  {
    name: {
      type: String,
      required: [true, "Group name is required"],
      trim: true,
      minlength: [2, "Group name must be at least 2 characters"],
      maxlength: [60, "Group name cannot exceed 60 characters"],
    },
    description: {
      type: String,
      maxlength: [500, "Description cannot exceed 500 characters"],
      default: "",
    },
    avatar: { type: String, default: null },
    type: { type: String, enum: ["public", "private"], default: "public" },
    inviteCode: { type: String },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    members: [memberSchema],
    maxMembers: { type: Number, default: 500, min: 2, max: 5000 },
    lastMessage: {
      type: Schema.Types.ObjectId,
      ref: "Message",
      default: null,
    },
    lastActivity: { type: Date, default: Date.now, index: true },
    pinnedMessages: [{ type: Schema.Types.ObjectId, ref: "Message" }],
    isActive: { type: Boolean, default: true },
    tags: [{ type: String, maxlength: 30 }],
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// ─── Indexes ──────────────────────────────────────────────────────────────────
groupSchema.index({ name: "text", description: "text", tags: "text" });
groupSchema.index({ inviteCode: 1 });
groupSchema.index({ "members.user": 1 });
groupSchema.index({ type: 1, isActive: 1, lastActivity: -1 });

// ─── Virtuals ─────────────────────────────────────────────────────────────────
groupSchema.virtual<IGroup, number>("memberCount").get(function () {
  return this.members.length;
});

// ─── Methods ──────────────────────────────────────────────────────────────────
groupSchema.methods.isMember = function (
  userId: mongoose.Types.ObjectId | string,
): boolean {
  return this.members.some((m) => m.user.toString() === userId.toString());
};

groupSchema.methods.getMemberRole = function (
  userId: mongoose.Types.ObjectId | string,
): string | null {
  const m = this.members.find((m) => m.user.toString() === userId.toString());
  return m ? m.role : null;
};

groupSchema.methods.isAdmin = function (
  userId: mongoose.Types.ObjectId | string,
): boolean {
  return this.members.some(
    (m) =>
      m.user.toString() === userId.toString() &&
      ["admin", "owner"].includes(m.role),
  );
};

groupSchema.methods.isModerator = function (
  userId: mongoose.Types.ObjectId | string,
): boolean {
  return this.members.some(
    (m) =>
      m.user.toString() === userId.toString() &&
      ["moderator", "admin", "owner"].includes(m.role),
  );
};

groupSchema.methods.isMuted = function (
  userId: mongoose.Types.ObjectId | string,
): boolean {
  const m = this.members.find((m) => m.user.toString() === userId.toString());
  if (!m || !m.isMuted) return false;
  if (m.mutedUntil && m.mutedUntil < new Date()) return false;
  return true;
};

groupSchema.methods.generateInviteCode = function (): string {
  const { v4: uuidv4 } = require("uuid");
  this.inviteCode = uuidv4().replace(/-/g, "").slice(0, 10).toUpperCase();
  return this.inviteCode;
};

const Group: Model<IGroup> = mongoose.model<IGroup>("Group", groupSchema);
export { Group, IGroup };
