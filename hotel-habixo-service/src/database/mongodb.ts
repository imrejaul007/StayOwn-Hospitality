import mongoose from 'mongoose';
import { config } from '../config';
import { logger } from '../utils/logger';

const mongoLogger = logger.child({ service: 'MongoDB' });

let isConnected = false;

export async function connectDB(): Promise<void> {
  if (isConnected) {
    mongoLogger.info('Using existing MongoDB connection');
    return;
  }

  try {
    const options: mongoose.ConnectOptions = {
      maxPoolSize: 50,
      minPoolSize: 2,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      retryWrites: true,
      w: 'majority',
    };

    await mongoose.connect(config.mongodb.uri, options);
    isConnected = true;

    mongoose.connection.on('error', (error) => {
      mongoLogger.error({ error }, 'MongoDB connection error');
    });

    mongoose.connection.on('disconnected', () => {
      mongoLogger.warn('MongoDB disconnected');
      isConnected = false;
    });

    mongoose.connection.on('reconnected', () => {
      mongoLogger.info('MongoDB reconnected');
      isConnected = true;
    });

    mongoLogger.info(`MongoDB connected: ${config.mongodb.uri}`);
  } catch (error) {
    mongoLogger.error({ error }, 'Failed to connect to MongoDB');
    throw error;
  }
}

export async function disconnectDB(): Promise<void> {
  if (!isConnected) return;

  await mongoose.disconnect();
  isConnected = false;
  mongoLogger.info('MongoDB disconnected');
}

export function getConnectionStatus(): boolean {
  return isConnected && mongoose.connection.readyState === 1;
}
