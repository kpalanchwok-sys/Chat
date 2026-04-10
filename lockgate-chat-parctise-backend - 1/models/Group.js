const mongoose = require("mongoose");
const { v4: uuidv4 } = require("uuid");

const memberSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
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

const groupSchema = new mongoose.Schema(
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
    inviteCode: {
      type: String,
      // unique: true, sparse: true
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    members: [memberSchema],
    maxMembers: { type: Number, default: 500, min: 2, max: 5000 },
    lastMessage: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
      default: null,
    },
    lastActivity: { type: Date, default: Date.now, index: true },
    pinnedMessages: [{ type: mongoose.Schema.Types.ObjectId, ref: "Message" }],
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
groupSchema.virtual("memberCount").get(function () {
  return this.members.length;
});

// ─── Methods ──────────────────────────────────────────────────────────────────
groupSchema.methods.isMember = function (userId) {
  return this.members.some((m) => m.user.toString() === userId.toString());
};

groupSchema.methods.getMemberRole = function (userId) {
  const m = this.members.find((m) => m.user.toString() === userId.toString());
  return m ? m.role : null;
};

groupSchema.methods.isAdmin = function (userId) {
  return this.members.some(
    (m) =>
      m.user.toString() === userId.toString() &&
      ["admin", "owner"].includes(m.role),
  );
};

groupSchema.methods.isModerator = function (userId) {
  return this.members.some(
    (m) =>
      m.user.toString() === userId.toString() &&
      ["moderator", "admin", "owner"].includes(m.role),
  );
};

groupSchema.methods.isMuted = function (userId) {
  const m = this.members.find((m) => m.user.toString() === userId.toString());
  if (!m || !m.isMuted) return false;
  if (m.mutedUntil && m.mutedUntil < new Date()) return false; // mute expired
  return true;
};

groupSchema.methods.generateInviteCode = function () {
  this.inviteCode = uuidv4().replace(/-/g, "").slice(0, 10).toUpperCase();
  return this.inviteCode;
};

// ─── toJSON cleanup ───────────────────────────────────────────────────────────
groupSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.__v;
  return obj;
};

module.exports = mongoose.model("Group", groupSchema);
