import mongoose from 'mongoose';
import connectDB from '../config/database.js';
import queueService from '../services/queueService.js';

const run = async () => {
  await connectDB();
  await queueService.initialize();

  const queueStats = await queueService.getQueueStats();
  console.log('Queue health snapshot:');
  console.log(JSON.stringify(queueStats, null, 2));
};

run()
  .catch((error) => {
    console.error('Failed to generate queue health snapshot:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await queueService.stopProcessing();
    } catch {}
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  });
