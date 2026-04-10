import { NextFunction, Request, Response } from "express";
import { Socket } from "socket.io";
import { verifyAccessToken } from "../config/jwt";
// import { IUser, User } from "../models/User";
import User from "../models/User";
import AppError from "../utils/AppError";
import asyncHandler from "../utils/asyncHandler";

/**
 * Extend Express Request
 */
declare global {
  namespace Express {
    interface Request {
      // user?: IUser;
      user?: InstanceType<typeof User>;
      groupRole?: string;
    }
  }
}

/**
 * Correct Socket.IO augmentation (FIXED)
 */
declare module "socket.io" {
  interface Socket {
    user?: InstanceType<typeof User>;
  }
}

/**
 * ─────────────────────────────────────────────
 * HTTP AUTH MIDDLEWARE
 * ─────────────────────────────────────────────
 */
const authenticate = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith("Bearer ")) {
      throw new AppError("Access token required", 401, "NO_TOKEN");
    }

    const token = authHeader.split(" ")[1];

    let decoded;
    try {
      decoded = verifyAccessToken(token);
    } catch {
      throw new AppError("Invalid token", 401, "INVALID_TOKEN");
    }

    const user = await User.findById(decoded.userId).select(
      "+passwordChangedAt",
    );

    if (!user) {
      throw new AppError("User no longer exists", 401, "USER_NOT_FOUND");
    }

    if (user.isBanned) {
      throw new AppError(
        "Your account has been suspended",
        403,
        "ACCOUNT_BANNED",
      );
    }

    const tokenTime = (decoded.iat ?? 0) * 1000;

    // if (user.changedPasswordAfter(tokenTime)) {
    //   throw new AppError(
    //     "Password recently changed. Please login again.",
    //     401,
    //     "PASSWORD_CHANGED",
    //   );
    // }

    req.user = user;

    // FIX: ensure role is available
    req.groupRole = (user as any).role;

    next();
  },
);

/**
 * ─────────────────────────────────────────────
 * ROLE GUARD (FIXED)
 * ─────────────────────────────────────────────
 */
const requireRole = (...roles: string[]) =>
  asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      throw new AppError("Not authenticated", 401, "NO_AUTH");
    }

    if (!roles.includes(req.groupRole || "")) {
      throw new AppError(
        "You do not have permission to perform this action",
        403,
        "FORBIDDEN",
      );
    }

    next();
  });

/**
 * ─────────────────────────────────────────────
 * SOCKET AUTH MIDDLEWARE (FIXED TYPES)
 * ─────────────────────────────────────────────
 */
// import { ExtendedError } from "socket.io/dist/namespace";

const authenticateSocket = async (
  socket: Socket,
  next: (err?: Error) => void,
) => {
  try {
    const token =
      socket.handshake.auth?.token ||
      socket.handshake.headers?.authorization?.replace("Bearer ", "");

    if (!token) return next(new Error("NO_TOKEN"));

    let decoded;
    try {
      decoded = verifyAccessToken(token);
    } catch {
      return next(new Error("INVALID_TOKEN"));
    }

    const user = await User.findById(decoded.userId);

    if (!user) return next(new Error("USER_NOT_FOUND"));
    if (user.isBanned) return next(new Error("ACCOUNT_BANNED"));

    socket.user = user;

    next();
  } catch (err: any) {
    next(new Error(err?.message || "AUTH_FAILED"));
  }
};

export { authenticate, authenticateSocket, requireRole };
