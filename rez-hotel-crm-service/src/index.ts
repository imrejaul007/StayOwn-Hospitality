/**
 * Hotel CRM Service
 * Guest management and profile tracking
 */

import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { guestRoutes } from './routes/guest.routes';
import { stayRoutes } from './routes/stay.routes';
import { errorHandler } from './middleware/errorHandler';
import { logger } from './config/logger';

dotenv.config();

const app: Application = express();
const PORT = process.env.PORT || 4021;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/hotel-crm';

app.use(helmet());
app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? process.env.CORS_ORIGIN?.split(',')
    : ['http://localhost:3000'],
  credentials: true,
}));
app.use(express.json());

app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'rez-hotel-crm-service', timestamp: new Date().toISOString() });
});

app.use('/api/guests', guestRoutes);
app.use('/api/stays', stayRoutes);
app.use(errorHandler);

async function start() {
  try {
    await mongoose.connect(MONGODB_URI);
    logger.info('Connected to MongoDB');

    app.listen(PORT, () => {
      logger.info(`Hotel CRM service running on port ${PORT}`);
      logger.info(`Health check: http://localhost:${PORT}/health`);
    });
  } catch (error) {
    logger.error('Failed to start server', error);
    process.exit(1);
  }
}

start();

export default app;
