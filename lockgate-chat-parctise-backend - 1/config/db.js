const mongoose = require('mongoose');
const logger = require('../utils/logger');

const MAX_RETRIES = 5;
const RETRY_DELAY_MS = 3000;

const connectDB = async (retries = MAX_RETRIES) => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      // Mongoose 8+ no longer needs useNewUrlParser / useUnifiedTopology
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });

    logger.info(`✅ MongoDB connected: ${conn.connection.host}`);

    // Graceful disconnect on SIGINT / SIGTERM
    process.on('SIGINT', gracefulDisconnect);
    process.on('SIGTERM', gracefulDisconnect);
  } catch (err) {
    logger.error(`❌ MongoDB connection failed: ${err.message}`);
    if (retries > 0) {
      logger.warn(`Retrying in ${RETRY_DELAY_MS / 1000}s… (${retries} attempts left)`);
      await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
      return connectDB(retries - 1);
    }
    logger.error('All MongoDB connection retries exhausted. Exiting.');
    process.exit(1);
  }
};

const gracefulDisconnect = async () => {
  await mongoose.connection.close();
  logger.info('MongoDB connection closed (process termination).');
  process.exit(0);
};

// Log connection events
mongoose.connection.on('disconnected', () => logger.warn('⚠️  MongoDB disconnected'));
mongoose.connection.on('reconnected', () => logger.info('♻️  MongoDB reconnected'));
mongoose.connection.on('error', (err) => logger.error(`MongoDB error: ${err.message}`));

module.exports = { connectDB };
