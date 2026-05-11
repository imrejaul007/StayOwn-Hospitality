import cron from 'node-cron';
import ScheduledUpdatesService from '../services/scheduledUpdates.js';

/**
 * Scheduled Updates Cron Job
 *
 * Runs every 5 minutes to process due scheduled updates.
 * Checks for updates where scheduledFor <= current time and status = 'pending'
 */
const scheduledUpdatesJob = cron.schedule('*/5 * * * *', async () => {
  const timestamp = new Date().toISOString();
  console.log(`[Scheduled Updates Job] Running at ${timestamp}`);

  try {
    const result = await ScheduledUpdatesService.processDueUpdates();

    console.log(`[Scheduled Updates Job] Result:`, {
      total: result.total,
      succeeded: result.succeeded,
      failed: result.failed,
      timestamp
    });

    // Log failures for debugging
    if (result.failed > 0) {
      const failures = result.results.filter(r => r.status === 'failed');
      console.error(`[Scheduled Updates Job] Failures:`, failures);
    }
  } catch (error) {
    console.error(`[Scheduled Updates Job] Error:`, {
      message: error.message,
      stack: error.stack,
      timestamp
    });
  }
}, {
  scheduled: false, // Don't start automatically, start manually in server.js
  timezone: 'UTC' // Use UTC for consistency
});

/**
 * Start the cron job
 */
export const startScheduledUpdatesJob = () => {
  scheduledUpdatesJob.start();
  console.log('[Scheduled Updates Job] Started - runs every 5 minutes');
};

/**
 * Stop the cron job
 */
export const stopScheduledUpdatesJob = () => {
  scheduledUpdatesJob.stop();
  console.log('[Scheduled Updates Job] Stopped');
};

export default scheduledUpdatesJob;
