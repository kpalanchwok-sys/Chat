const mongoose = require('mongoose');

const attachmentSchema = new mongoose.Schema(
  {
    url: { type: String, required: true },
    filename: { type: String, required: true },
    mimetype: { type: String, required: true },
    size: { type: Number, required: true }, // bytes
    width: { type: Number, default: null },  // images only
    height: { type: Number, default: null }, // images only
  },
  { _id: false }
);

const reactionSchema = new mongoose.Schema(
  {
    emoji: { type: String, required: true },
    users: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  },
  { _id: false }
);

const readReceiptSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    readAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const messageSchema = new mongoose.Schema(
  {
    group: { type: mongoose.Schema.Types.ObjectId, ref: 'Group', required: true, index: true },
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    content: {
      type: String,
      default: '',
      maxlength: [4000, 'Message cannot exceed 4000 characters'],
    },
    type: {
      type: String,
      enum: ['text', 'image', 'file', 'system', 'reply'],
      default: 'text',
    },
    replyTo: { type: mongoose.Schema.Types.ObjectId, ref: 'Message', default: null },
    attachments: [attachmentSchema],
    reactions: [reactionSchema],
    readBy: [readReceiptSchema],
    isEdited: { type: Boolean, default: false },
    editedAt: { type: Date, default: null },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null },
    // System messages: "John joined", "Jane left", etc.
    metadata: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ─── Indexes ──────────────────────────────────────────────────────────────────
messageSchema.index({ group: 1, createdAt: -1 });
messageSchema.index({ group: 1, isDeleted: 1, createdAt: -1 });

// ─── Virtual: reaction summary ────────────────────────────────────────────────
messageSchema.virtual('reactionSummary').get(function () {
  return this.reactions.map((r) => ({ emoji: r.emoji, count: r.users.length }));
});

// ─── toJSON: hide deleted content ────────────────────────────────────────────
messageSchema.methods.toJSON = function () {
  const obj = this.toObject();
  if (obj.isDeleted) {
    obj.content = 'This message was deleted.';
    obj.attachments = [];
  }
  delete obj.__v;
  return obj;
};

module.exports = mongoose.model('Message', messageSchema);
