import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
} from "../config/jwt";
import { IUser, User } from "../models/User";
import AppError from "../utils/AppError";

interface TokenPayload {
  userId: string;
  username: string;
}

interface TokenResponse {
  accessToken: string;
  refreshToken: string;
}

const issueTokens = async (user: IUser): Promise<TokenResponse> => {
  const payload = { userId: user._id.toString(), username: user.username };
  const accessToken = generateAccessToken(payload);
  const refreshToken = generateRefreshToken(payload);

  await User.findByIdAndUpdate(user._id, { refreshToken });

  return { accessToken, refreshToken };
};

interface RegisterPayload {
  username: string;
  email: string;
  password: string;
  bio?: string;
}

interface LoginPayload {
  email: string;
  password: string;
}

const register = async ({
  username,
  email,
  password,
  bio,
}: RegisterPayload) => {
  const existing = await User.findOne({ $or: [{ email }, { username }] });
  if (existing) {
    const field = existing.email === email ? "email" : "username";
    throw new AppError(`This ${field} is already taken`, 409, "DUPLICATE_KEY");
  }

  const user = await User.create({ username, email, password, bio });
  const tokens = await issueTokens(user);
  return { user, ...tokens };
};

const login = async ({ email, password }: LoginPayload) => {
  const user = await User.findOne({ email }).select(
    "+password +passwordChangedAt",
  );
  if (!user || !(await user.comparePassword(password))) {
    throw new AppError("Invalid email or password", 401, "INVALID_CREDENTIALS");
  }
  if (user.isBanned)
    throw new AppError(
      "Your account has been suspended",
      403,
      "ACCOUNT_BANNED",
    );

  user.isOnline = true;
  await user.save({ validateBeforeSave: false });

  const tokens = await issueTokens(user);
  return { user, ...tokens };
};

const refreshTokens = async (token: string): Promise<TokenResponse> => {
  const decoded = verifyRefreshToken(token);
  const user = await User.findById(decoded.userId).select("+refreshToken");

  if (!user || user.refreshToken !== token) {
    throw new AppError("Invalid refresh token", 401, "INVALID_REFRESH");
  }

  const tokens = await issueTokens(user);
  return tokens;
};

const logout = async (userId: string): Promise<void> => {
  await User.findByIdAndUpdate(userId, {
    refreshToken: null,
    isOnline: false,
    lastSeen: new Date(),
  });
};

export { login, logout, refreshTokens, register };
