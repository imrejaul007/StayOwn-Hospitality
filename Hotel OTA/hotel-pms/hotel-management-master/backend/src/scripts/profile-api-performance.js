import mongoose from 'mongoose';
import connectDB from '../config/database.js';
import APIMetrics from '../models/APIMetrics.js';

const daysBack = Number(process.argv[2] || 7);
const limit = Number(process.argv[3] || 20);

const since = new Date();
since.setDate(since.getDate() - daysBack);

const run = async () => {
  await connectDB();

  if (mongoose.connection.readyState !== 1) {
    console.log('Database not connected. Skipping API profile.');
    return;
  }

  const results = await APIMetrics.aggregate([
    {
      $match: {
        period: { $in: ['minute', 'hour', 'day'] },
        timestamp: { $gte: since }
      }
    },
    {
      $group: {
        _id: {
          method: '$endpoint.method',
          path: '$endpoint.path'
        },
        requestCount: { $sum: '$requests.total' },
        failureCount: { $sum: '$requests.failed' },
        avgLatency: { $avg: '$performance.averageResponseTime' },
        p95Latency: { $max: '$performance.p95ResponseTime' },
        maxLatency: { $max: '$performance.maxResponseTime' }
      }
    },
    {
      $project: {
        _id: 0,
        method: '$_id.method',
        path: '$_id.path',
        requestCount: 1,
        failureCount: 1,
        failureRatePct: {
          $cond: [
            { $eq: ['$requestCount', 0] },
            0,
            { $multiply: [{ $divide: ['$failureCount', '$requestCount'] }, 100] }
          ]
        },
        avgLatency: { $round: ['$avgLatency', 2] },
        p95Latency: { $round: ['$p95Latency', 2] },
        maxLatency: { $round: ['$maxLatency', 2] }
      }
    },
    { $sort: { p95Latency: -1, requestCount: -1 } },
    { $limit: limit }
  ]);

  console.log(`Top ${limit} API hotspots over last ${daysBack} day(s):`);
  console.log(JSON.stringify(results, null, 2));
};

run()
  .catch((error) => {
    console.error('Failed to profile API performance:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  });
