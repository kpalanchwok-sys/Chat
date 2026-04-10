import jwt from "jsonwebtoken";
import AppError from "../utils/AppError";

const {
  JWT_SECRET,
  JWT_EXPIRES_IN = "15m",
  JWT_REFRESH_SECRET,
  JWT_REFRESH_EXPIRES_IN = "30d",
} = process.env;

if (!JWT_SECRET || !JWT_REFRESH_SECRET) {
  throw new Error(
    "JWT_SECRET and JWT_REFRESH_SECRET must be set in environment variables",
  );
}

interface TokenPayload {
  userId: string;
  username: string;
  iat?: number;
}

const generateAccessToken = (payload: TokenPayload): string =>
  jwt.sign(payload, JWT_SECRET!, { expiresIn: JWT_EXPIRES_IN });

const generateRefreshToken = (payload: TokenPayload): string =>
  jwt.sign(payload, JWT_REFRESH_SECRET!, { expiresIn: JWT_REFRESH_EXPIRES_IN });

const verifyAccessToken = (token: string): TokenPayload => {
  try {
    return jwt.verify(token, JWT_SECRET!) as TokenPayload;
  } catch (err: any) {
    if (err.name === "TokenExpiredError")
      throw new AppError("Access token expired", 401, "TOKEN_EXPIRED");
    throw new AppError("Invalid access token", 401, "INVALID_TOKEN");
  }
};

const verifyRefreshToken = (token: string): TokenPayload => {
  try {
    return jwt.verify(token, JWT_REFRESH_SECRET!) as TokenPayload;
  } catch (err: any) {
    if (err.name === "TokenExpiredError")
      throw new AppError(
        "Refresh token expired, please login again",
        401,
        "REFRESH_EXPIRED",
      );
    throw new AppError("Invalid refresh token", 401, "INVALID_REFRESH");
  }
};

export {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
};
