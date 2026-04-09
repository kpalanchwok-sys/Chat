import { NextFunction, Request, Response } from "express";
import { Socket } from "socket.io";
import { verifyAccessToken } from "../config/jwt";
import { IUser, User } from "../models/User";
import AppError from "../utils/AppError";
import asyncHandler from "../utils/asyncHandler";

// Extend Express Request type to include user
declare global {
  namespace Express {
    interface Request {
      user?: IUser;
      groupRole?: string;
    }
  }
}

declare global {
  namespace SocketIO {
    interface Socket {
      user?: IUser;
    }
  }
}

// ─── HTTP middleware ───────────────────────────────────────────────────────────
const authenticate = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    // 1. Extract token
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      throw new AppError("Access token required", 401, "NO_TOKEN");
    }
    const token = authHeader.split(" ")[1];

    // 2. Verify token
    const decoded = verifyAccessToken(token);

    // 3. Load user
    const user = await User.findById(decoded.userId).select(
      "+passwordChangedAt",
    );
    if (!user)
      throw new AppError("User no longer exists", 401, "USER_NOT_FOUND");
    if (user.isBanned)
      throw new AppError(
        "Your account has been suspended",
        403,
        "ACCOUNT_BANNED",
      );

    // 4. Check password change after token issue
    if (user.changedPasswordAfter(decoded.iat || 0)) {
      throw new AppError(
        "Password recently changed. Please login again.",
        401,
        "PASSWORD_CHANGED",
      );
    }

    req.user = user;
    next();
  },
);

// ─── Role guard ───────────────────────────────────────────────────────────────
const requireRole = (...roles: string[]) =>
  asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) throw new AppError("Not authenticated", 401);
    if (!roles.includes(req.groupRole || "")) {
      throw new AppError(
        "You do not have permission to perform this action",
        403,
        "FORBIDDEN",
      );
    }
    next();
  });

// ─── Socket.io middleware ─────────────────────────────────────────────────────
const authenticateSocket = async (socket: Socket, next: any) => {
  try {
    const token =
      socket.handshake.auth?.token ||
      socket.handshake.headers?.authorization?.replace("Bearer ", "");

    if (!token) return next(new Error("NO_TOKEN"));

    const decoded = verifyAccessToken(token);
    const user = await User.findById(decoded.userId);
    if (!user) return next(new Error("USER_NOT_FOUND"));
    if (user.isBanned) return next(new Error("ACCOUNT_BANNED"));

    socket.user = user;
    next();
  } catch (err: any) {
    next(new Error(err.code || "AUTH_FAILED"));
  }
};

export { authenticate, authenticateSocket, requireRole };
