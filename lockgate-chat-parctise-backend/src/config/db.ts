import mongoose from "mongoose";
import logger from "../utils/logger";

const MAX_RETRIES = 5;
const RETRY_DELAY_MS = 3000;

const connectDB = async (retries: number = MAX_RETRIES): Promise<void> => {
  try {
    const conn = await mongoose.connect(
      process.env.MONGO_URI || "mongodb://localhost:27017/lockgate-chat",
      {
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
      },
    );

    logger.info(`✅ MongoDB connected: ${conn.connection.host}`);

    // Graceful disconnect on SIGINT / SIGTERM
    process.on("SIGINT", gracefulDisconnect);
    process.on("SIGTERM", gracefulDisconnect);
  } catch (err: any) {
    logger.error(`❌ MongoDB connection failed: ${err.message}`);
    if (retries > 0) {
      logger.warn(
        `Retrying in ${RETRY_DELAY_MS / 1000}s… (${retries} attempts left)`,
      );
      await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
      return connectDB(retries - 1);
    }
    logger.error("All MongoDB connection retries exhausted. Exiting.");
    process.exit(1);
  }
};

const gracefulDisconnect = async (): Promise<void> => {
  await mongoose.connection.close();
  logger.info("MongoDB connection closed (process termination).");
  process.exit(0);
};

// Log connection events
mongoose.connection.on("disconnected", () =>
  logger.warn("⚠️  MongoDB disconnected"),
);
mongoose.connection.on("reconnected", () =>
  logger.info("♻️  MongoDB reconnected"),
);
mongoose.connection.on("error", (err) =>
  logger.error(`MongoDB error: ${err.message}`),
);

export { connectDB };
