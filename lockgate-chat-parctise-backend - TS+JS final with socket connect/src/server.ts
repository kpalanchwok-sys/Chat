import cors from "cors";
import "dotenv/config";
import express, { Express, Request, Response } from "express";
import helmet from "helmet";
import http from "http";
import morgan from "morgan";
import path from "path";

import { connectDB } from "./config/db";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";
import { apiLimiter, speedLimiter } from "./middleware/rateLimiter";
import { initSocket } from "./socket/socketServer";
import logger from "./utils/logger";

// ─── Routes ───────────────────────────────────────────────────────────────────
import authRoutes from "./routes/auth";
import groupRoutes from "./routes/groups";
import messageRoutes from "./routes/messages";
import userRoutes from "./routes/users";

// ─── App + Server (ONE of each) ───────────────────────────────────────────────
const app: Express = express();
export const httpServer = http.createServer(app); // ✅ single server

// ─── Security middleware ──────────────────────────────────────────────────────
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));

app.use(
  cors({
    origin: (origin, cb) => {
      const allowed = (process.env.CLIENT_URL || "http://localhost:3000")
        .split(",")
        .map((s) => s.trim());
      if (!origin || allowed.includes(origin)) return cb(null, true);
      cb(new Error(`CORS: origin ${origin} not allowed`));
    },
    credentials: true,
    methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

// ─── DB ───────────────────────────────────────────────────────────────────────
connectDB();

// ─── Body parsing ─────────────────────────────────────────────────────────────
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

// ─── Logging ──────────────────────────────────────────────────────────────────
if (process.env.NODE_ENV !== "test") {
  app.use(
    morgan(process.env.NODE_ENV === "production" ? "combined" : "dev", {
      stream: { write: (msg) => logger.info(msg.trim()) },
    }),
  );
}

// ─── Static files ─────────────────────────────────────────────────────────────
app.use(
  "/uploads",
  express.static(path.resolve(process.env.UPLOAD_DIR || "uploads"), {
    maxAge: "7d",
    etag: true,
  }),
);

// ─── Rate limiting ────────────────────────────────────────────────────────────
app.use("/api/", speedLimiter);
app.use("/api/", apiLimiter);

// ─── API routes ───────────────────────────────────────────────────────────────
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/groups", groupRoutes);
app.use("/api/groups/:groupId/messages", messageRoutes);

// ─── Health check ─────────────────────────────────────────────────────────────
app.get("/api/health", (_req: Request, res: Response) => {
  res.json({
    status: "ok",
    environment: process.env.NODE_ENV,
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
  });
});

// ─── Error handlers ───────────────────────────────────────────────────────────
app.use(notFoundHandler);
app.use(errorHandler);

// ─── Socket (ONE call, after server is defined) ───────────────────────────────
initSocket(httpServer); // ✅ called exactly once

// ─── Start ────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5001;

httpServer.listen(PORT, () => {
  console.info(`🔌 Server listening on port: \x1b[94m${PORT}\x1b[0m`);
  console.info(`\x1b[95m🚀 Deploy stage: ${process.env.NODE_ENV}\x1b[0m`);
});

// ─── Unhandled rejections / exceptions ────────────────────────────────────────
process.on("unhandledRejection", (err: any) => {
  logger.error("UNHANDLED REJECTION", {
    message: err.message,
    stack: err.stack,
  });
  httpServer.close(() => process.exit(1)); // ✅ close the right server
});

process.on("uncaughtException", (err: any) => {
  logger.error("UNCAUGHT EXCEPTION", {
    message: err.message,
    stack: err.stack,
  });
  process.exit(1);
});
