import bcrypt from "bcryptjs";
import mongoose, { Schema } from "mongoose";

// interface IUser extends Document {
//   username: string;
//   email: string;
//   password: string;
//   avatar: string | null;
//   bio: string;
//   isOnline: boolean;
//   lastSeen: Date;
//   refreshToken: string | null;
//   groups: mongoose.Types.ObjectId[];
//   isVerified: boolean;
//   isBanned: boolean;
//   bannedReason: string | null;
//   passwordChangedAt: Date | null;
//   createdAt: Date;
//   updatedAt: Date;
//   comparePassword(candidatePassword: string): Promise<boolean>;
//   changedPasswordAfter(jwtIssuedAt: number): boolean;
//   toJSON(): Omit<
//     IUser,
//     "password" | "refreshToken" | "bannedReason" | "passwordChangedAt"
//   >;
// }

// const userSchema = new Schema<IUser>(
const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: [true, "Username is required"],
      unique: true,
      trim: true,
      minlength: [3, "Username must be at least 3 characters"],
      maxlength: [30, "Username cannot exceed 30 characters"],
      match: [
        /^[a-zA-Z0-9_]+$/,
        "Username can only contain letters, numbers, and underscores",
      ],
      index: true,
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, "Please provide a valid email"],
      index: true,
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: [8, "Password must be at least 8 characters"],
      select: false,
    },
    avatar: { type: String, default: null },
    bio: {
      type: String,
      maxlength: [200, "Bio cannot exceed 200 characters"],
      default: "",
    },
    isOnline: { type: Boolean, default: false },
    lastSeen: { type: Date, default: Date.now },
    refreshToken: { type: String, select: false, default: null },
    groups: [{ type: Schema.Types.ObjectId, ref: "Group" }],
    isVerified: { type: Boolean, default: false },
    isBanned: { type: Boolean, default: false },
    bannedReason: { type: String, default: null, select: false },
    passwordChangedAt: { type: Date, select: false, default: null },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// ─── Indexes ──────────────────────────────────────────────────────────────────
userSchema.index({ username: "text" });

// ─── Pre-save: hash password ──────────────────────────────────────────────────
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 12);
  if (!this.isNew) this.passwordChangedAt = new Date();
  next();
});

// ─── Methods ──────────────────────────────────────────────────────────────────
userSchema.methods.comparePassword = async function (
  candidatePassword: string,
): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.password);
};

// Check if password changed after JWT was issued
userSchema.methods.changedPasswordAfter = function (
  jwtIssuedAt: number,
): boolean {
  if (this.passwordChangedAt) {
    return Math.round(this.passwordChangedAt.getTime() / 1000) > jwtIssuedAt;
  }
  return false;
};

// Strip sensitive fields from output
userSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete (obj as any).password;
  delete (obj as any).refreshToken;
  delete (obj as any).bannedReason;
  delete (obj as any).passwordChangedAt;
  delete (obj as any).__v;
  return obj;
};

const User = mongoose.model("User", userSchema);
export default User;

// const User: Model<IUser> = mongoose.model<IUser>("User", userSchema);
// export { IUser, User };
