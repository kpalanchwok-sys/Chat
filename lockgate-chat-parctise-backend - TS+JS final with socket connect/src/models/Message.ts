import mongoose, { Document, Model, Schema } from "mongoose";

interface IAttachment extends Document {
  url: string;
  filename: string;
  mimetype: string;
  size: number;
  width: number | null;
  height: number | null;
}

interface IReaction extends Document {
  emoji: string;
  users: mongoose.Types.ObjectId[];
}

interface IReadReceipt extends Document {
  user: mongoose.Types.ObjectId;
  readAt: Date;
}

interface IMessage extends Document {
  group: mongoose.Types.ObjectId;
  sender: mongoose.Types.ObjectId;
  content: string;
  type: "text" | "image" | "file" | "system" | "reply";
  replyTo: mongoose.Types.ObjectId | null;
  attachments: IAttachment[];
  reactions: IReaction[];
  readBy: IReadReceipt[];
  isEdited: boolean;
  editedAt: Date | null;
  isDeleted: boolean;
  deletedAt: Date | null;
  metadata: any;
  createdAt: Date;
  updatedAt: Date;
  reactionSummary: Array<{ emoji: string; count: number }>;
  toJSON(): any;
}

const attachmentSchema = new Schema<IAttachment>(
  {
    url: { type: String, required: true },
    filename: { type: String, required: true },
    mimetype: { type: String, required: true },
    size: { type: Number, required: true },
    width: { type: Number, default: null },
    height: { type: Number, default: null },
  },
  { _id: false },
);

const reactionSchema = new Schema<IReaction>(
  {
    emoji: { type: String, required: true },
    users: [{ type: Schema.Types.ObjectId, ref: "User" }],
  },
  { _id: false },
);

const readReceiptSchema = new Schema<IReadReceipt>(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    readAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const messageSchema = new Schema<IMessage>(
  {
    group: {
      type: Schema.Types.ObjectId,
      ref: "Group",
      required: true,
      index: true,
    },
    sender: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    content: {
      type: String,
      default: "",
      maxlength: [4000, "Message cannot exceed 4000 characters"],
    },
    type: {
      type: String,
      enum: ["text", "image", "file", "system", "reply"],
      default: "text",
    },
    replyTo: { type: Schema.Types.ObjectId, ref: "Message", default: null },
    attachments: [attachmentSchema],
    reactions: [reactionSchema],
    readBy: [readReceiptSchema],
    isEdited: { type: Boolean, default: false },
    editedAt: { type: Date, default: null },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null },
    metadata: { type: Schema.Types.Mixed, default: null },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// ─── Indexes ──────────────────────────────────────────────────────────────────
messageSchema.index({ group: 1, createdAt: -1 });
messageSchema.index({ group: 1, isDeleted: 1, createdAt: -1 });

// ─── Virtual: reaction summary ────────────────────────────────────────────────
messageSchema.virtual<IMessage, any>("reactionSummary").get(function () {
  return this.reactions.map((r) => ({ emoji: r.emoji, count: r.users.length }));
});

// ─── toJSON: hide deleted content ────────────────────────────────────────────
messageSchema.methods.toJSON = function () {
  const obj = this.toObject();
  if (obj.isDeleted) {
    obj.content = "This message was deleted.";
    obj.attachments = [];
  }
  delete (obj as any).__v;
  return obj;
};

const Message: Model<IMessage> = mongoose.model<IMessage>(
  "Message",
  messageSchema,
);
export { IMessage, Message };
