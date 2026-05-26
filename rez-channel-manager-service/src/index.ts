import express import logger from './utils/logger';
import from 'express';
import mongoose from 'mongoose';
import channelRoutes from './routes/channels';

const app = express();
const PORT = process.env.PORT || 3082;

app.use(express.json());
app.use('/api/channels', channelRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'rez-channel-manager-service' });
});

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/rez_channel_manager';

mongoose.connect(MONGODB_URI)
  .then(() => {
    logger.info('Channel Manager connected to MongoDB');
    app.listen(PORT, () => {
      logger.info(`Channel Manager running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });
