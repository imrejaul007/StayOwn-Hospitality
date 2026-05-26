/**
 * Hotel Housekeeping Service
 * Room cleaning, task management, and staff scheduling
 */

import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { taskRoutes } from './routes/task.routes';
import { staffRoutes } from './routes/staff.routes';
import { roomRoutes } from './routes/room.routes';
import { errorHandler } from './middleware/errorHandler';
import { logger } from './config/logger';

dotenv.config();

const app: Application = express();
const PORT = process.env.PORT || 4020;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/hotel-housekeeping';

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? process.env.CORS_ORIGIN?.split(',')
    : ['http://localhost:3000'],
  credentials: true,
}));
app.use(express.json());

// Health check
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'rez-hotel-housekeeping-service', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api/tasks', taskRoutes);
app.use('/api/staff', staffRoutes);
app.use('/api/rooms', roomRoutes);

// Error handling
app.use(errorHandler);

// Database connection
async function start() {
  try {
    await mongoose.connect(MONGODB_URI);
    logger.info('Connected to MongoDB');

    app.listen(PORT, () => {
      logger.info(`Hotel Housekeeping service running on port ${PORT}`);
      logger.info(`Health check: http://localhost:${PORT}/health`);
    });
  } catch (error) {
    logger.error('Failed to start server', error);
    process.exit(1);
  }
}

start();

export default app;
