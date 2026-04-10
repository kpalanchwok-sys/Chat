import { Socket } from "socket.io";
// import Admin from "../database/models/admin";
import User from "../models/User";
import { verifyLocalAccessToken } from "../utils";
import AppError from "../utils/AppError";

export const authenticateSocket = async (
  socket: Socket,
  next: (err?: any) => void,
) => {
  try {
    const bearer =
      socket.handshake.auth?.token || socket.handshake.headers?.authorization;

    console.log("RAW AUTH HEADER:", socket.handshake.headers.authorization);
    // console.log("RAW AUTH TOKEN:", socket.handshake.auth.token);

    if (!bearer) {
      throw new AppError("Validation token not provided.", 401);
    }

    const token = bearer.startsWith("Bearer ") ? bearer.split(" ")[1] : bearer;

    console.log("FINAL BEARER:", bearer);
    console.log("FINAL TOKEN:", token);

    const decoded = verifyLocalAccessToken(token);

    const userId = decoded?.userId;

    if (!userId) {
      throw new AppError("Invalid token payload", 401);
    }

    const currentUser = await User.findById(userId).select("-password");

    if (!currentUser) {
      throw new AppError("User not found or invalid token.", 404);
    }

    socket.data.user = currentUser;

    next();
  } catch (error: any) {
    console.log("AUTHENTICATION ERROR: 📛📛📛 ::" + error.message);
    next(error);
  }
};

