import { Worker } from 'bullmq';
import { BookingEventType } from '@prisma/client';
import { env } from '../config/env';
import { prisma } from '../config/database';
import { CoinService } from '../services/finance/coin.service';
import { SettlementService } from '../services/payments/settlement.service';
import { MiningService } from '../services/mining/mining.service';
import { ReconciliationPipeline } from '../services/shared/event-bus.service';
import { CoinLedger } from '../services/finance/coin-ledger.service';
import { InventoryEngine } from '../services/booking/inventory-engine.service';
import { createServiceLogger } from '../config/logger';
import dayjs from 'dayjs';
import axios from 'axios';
import crypto from 'crypto';
import { pmsInventorySyncQueue, pmsNotificationQueue } from './queues';

const logger = createServiceLogger('workers');

const connection = { url: env.REDIS_URL };

/**
 * Hold expiry worker — releases inventory and reverses coin burns
 * when a 10-minute hold expires without payment.
 *
 * FIX-BUG-11: Atomically check-and-update status inside the transaction.
 * Uses updateMany with WHERE status='hold' so concurrent job runs are
 * idempotent — only the first run succeeds, subsequent runs find 0 rows
 * to update and bail out early without releasing inventory twice.
 */
export const holdExpiryWorker = new Worker(
  'hold-expiry',
  async (job) => {
    const { bookingId } = job.data;

    // FIX-BUG-11: Atomic check-and-update inside the transaction.
    // updateMany with status='hold' in WHERE is idempotent — if another
    // worker already processed this booking, count=0 and we skip the release.
    const result = await prisma.$transaction(async (tx) => {
      const updated = await tx.booking.updateMany({
        where: { id: bookingId, status: 'hold' },
        data: { status: 'cancelled', cancellationReason: 'Hold expired' },
      });

      if (updated.count === 0) {
        return null; // Already processed by another worker
      }

      // Fetch booking details for inventory release (only if we just acquired the lock)
      const booking = await tx.booking.findUnique({
        where: { id: bookingId },
        select: {
          id: true,
          hotelId: true,
          roomTypeId: true,
          userId: true,
          bookingRef: true,
          checkinDate: true,
          checkoutDate: true,
          numRooms: true,
          otaCoinBurnedPaise: true,
          rezCoinBurnedPaise: true,
          hotelBrandCoinBurnedPaise: true,
        },
      });

      if (!booking) return null;

      // Release inventory via InventoryEngine (includes oversell post-check)
      await InventoryEngine.releaseInventory(tx, {
        hotelId: booking.hotelId,
        roomTypeId: booking.roomTypeId,
        checkinDate: booking.checkinDate.toISOString().slice(0, 10),
        checkoutDate: booking.checkoutDate.toISOString().slice(0, 10),
        numRooms: booking.numRooms,
      });

      await tx.bookingEvent.create({
        data: {
          bookingId: booking.id,
          eventType: BookingEventType.cancelled,
          eventData: { reason: 'hold_expired' },
          triggeredBy: 'system',
        },
      });

      return booking;
    });

    if (!result) {
      logger.info(`Hold expiry job ${job.id}: booking ${bookingId} already processed, skipping`);
      return;
    }

    const booking = result;

    // Reverse coin burns
    if (booking.otaCoinBurnedPaise > 0) {
      await CoinService.reverseBurn({
        userId: booking.userId,
        coinType: 'ota',
        amountPaise: booking.otaCoinBurnedPaise,
        bookingId: booking.id,
      });
    }
    if (booking.rezCoinBurnedPaise > 0) {
      await CoinService.reverseBurn({
        userId: booking.userId,
        coinType: 'rez',
        amountPaise: booking.rezCoinBurnedPaise,
        bookingId: booking.id,
      });
    }
    if (booking.hotelBrandCoinBurnedPaise > 0) {
      await CoinService.reverseBurn({
        userId: booking.userId,
        coinType: 'hotel_brand',
        amountPaise: booking.hotelBrandCoinBurnedPaise,
        bookingId: booking.id,
        hotelId: booking.hotelId,
      });
    }

    logger.info(`Hold expired for booking ${booking.bookingRef}`);
  },
  { connection }
);

/**
 * Coin expiry worker — runs nightly, expires due OTA and hotel_brand coins
 */
export const coinExpiryWorker = new Worker(
  'coin-expiry',
  async () => {
    const today = dayjs().startOf('day').toDate();

    // Process OTA coin expiries
    const otaExpiries = await prisma.coinExpirySchedule.findMany({
      where: { expiryDate: { lte: today }, status: 'pending', coinType: 'ota' },
    });

    for (const expiry of otaExpiries) {
      const wallet = await prisma.coinWallet.findUnique({ where: { userId: expiry.userId } });
      if (!wallet) continue;

      const amountToExpire = Math.min(expiry.amountPaise, wallet.otaCoinBalancePaise);
      if (amountToExpire <= 0) {
        await prisma.coinExpirySchedule.update({
          where: { id: expiry.id },
          data: { status: 'used', processedAt: new Date() },
        });
        continue;
      }

      const newBalance = wallet.otaCoinBalancePaise - amountToExpire;

      await prisma.$transaction(async (tx) => {
        await tx.coinTransaction.create({
          data: {
            userId: expiry.userId,
            walletId: wallet.id,
            coinType: 'ota',
            transactionType: 'expire',
            amountPaise: amountToExpire,
            direction: 'debit',
            balanceAfterPaise: newBalance,
            notes: 'OTA coins expired after 12 months',
          },
        });

        await tx.coinWallet.update({
          where: { id: wallet.id },
          data: { otaCoinBalancePaise: newBalance },
        });

        await tx.coinExpirySchedule.update({
          where: { id: expiry.id },
          data: { status: 'expired', processedAt: new Date() },
        });
      });
    }

    // Process hotel_brand coin expiries
    const brandExpiries = await prisma.coinExpirySchedule.findMany({
      where: { expiryDate: { lte: today }, status: 'pending', coinType: 'hotel_brand' },
    });

    for (const expiry of brandExpiries) {
      if (!expiry.hotelId) {
        await prisma.coinExpirySchedule.update({
          where: { id: expiry.id },
          data: { status: 'used', processedAt: new Date() },
        });
        continue;
      }

      const brandBalance = await prisma.hotelBrandCoinBalance.findUnique({
        where: { userId_hotelId: { userId: expiry.userId, hotelId: expiry.hotelId } },
      });
      if (!brandBalance) continue;

      const wallet = await prisma.coinWallet.findUnique({ where: { userId: expiry.userId } });
      if (!wallet) continue;

      const amountToExpire = Math.min(expiry.amountPaise, brandBalance.balancePaise);
      if (amountToExpire <= 0) {
        await prisma.coinExpirySchedule.update({
          where: { id: expiry.id },
          data: { status: 'used', processedAt: new Date() },
        });
        continue;
      }

      await prisma.$transaction(async (tx) => {
        await tx.coinTransaction.create({
          data: {
            userId: expiry.userId,
            walletId: wallet.id,
            coinType: 'hotel_brand',
            hotelId: expiry.hotelId,
            transactionType: 'expire',
            amountPaise: amountToExpire,
            direction: 'debit',
            balanceAfterPaise: brandBalance.balancePaise - amountToExpire,
            notes: 'Hotel brand coins expired after 12 months',
          },
        });

        await tx.hotelBrandCoinBalance.update({
          where: { userId_hotelId: { userId: expiry.userId, hotelId: expiry.hotelId! } },
          data: { balancePaise: { decrement: amountToExpire } },
        });

        await tx.coinExpirySchedule.update({
          where: { id: expiry.id },
          data: { status: 'expired', processedAt: new Date() },
        });
      });
    }

    logger.info(`Coin expiry: ${otaExpiries.length} OTA + ${brandExpiries.length} hotel_brand records processed`);
  },
  { connection }
);

/**
 * Settlement batch worker — runs daily, creates T+1 payout batches
 */
export const settlementBatchWorker = new Worker(
  'settlement-batch',
  async () => {
    const result = await SettlementService.processSettlementBatch();
    if (result) {
      logger.info(`Settlement batch ${result.batchRef}: ${result.totalHotels} hotels, ₹${result.totalAmountPaise / 100}`);
    } else {
      logger.info('No settlements to process today');
    }
  },
  { connection }
);

/**
 * Tier update worker — runs monthly, updates user tiers based on rolling 12m activity
 */
export const tierUpdateWorker = new Worker(
  'tier-update',
  async () => {
    const twelveMonthsAgo = dayjs().subtract(12, 'month').toDate();

    // Get all active users with their booking stats
    const users = await prisma.user.findMany({
      where: { isActive: true },
      select: {
        id: true,
        tier: true,
        bookings: {
          where: {
            status: 'stayed',
            stayCompletedAt: { gte: twelveMonthsAgo },
          },
          select: { totalValuePaise: true },
        },
      },
    });

    let upgraded = 0;
    let downgraded = 0;

    for (const user of users) {
      const completedStays = user.bookings.length;
      const totalBookingValue = user.bookings.reduce((sum, b) => sum + b.totalValuePaise, 0);

      let newTier: 'basic' | 'silver' | 'gold' = 'basic';

      if (completedStays >= 8 || totalBookingValue >= 5000000) {
        newTier = 'gold';
      } else if (completedStays >= 3 || totalBookingValue >= 1500000) {
        newTier = 'silver';
      }

      if (newTier !== user.tier) {
        await prisma.user.update({
          where: { id: user.id },
          data: { tier: newTier },
        });

        if (newTier === 'gold' || (newTier === 'silver' && user.tier === 'basic')) {
          upgraded++;
        } else {
          downgraded++;
        }
      }
    }

    logger.info(`Tier update: ${upgraded} upgraded, ${downgraded} downgraded`);
  },
  { connection }
);

/**
 * Monthly mining worker — calculates HCS and issues ownership units
 * Runs 1st of each month for the prior month
 */
export const monthlyMiningWorker = new Worker(
  'monthly-mining',
  async () => {
    const lastMonth = dayjs().subtract(1, 'month').startOf('month').toDate();
    try {
      const result = await MiningService.runMiningCycle(lastMonth);
      logger.info(`Mining completed: ${result.hotelsProcessed} hotels, ${result.monthlyPoolUnits} units distributed`);
    } catch (err: any) {
      logger.info(`Mining skipped: ${err.message}`);
    }
  },
  { connection }
);

/**
 * Nightly vesting checker — unlocks vested ownership units
 */
export const vestingCheckerWorker = new Worker(
  'vesting-checker',
  async () => {
    const result = await MiningService.processVesting();
    logger.info(`Vesting: ${result.unlocked} unlocked, ${result.forfeited} forfeited`);
  },
  { connection }
);

/**
 * Nightly reconciliation — finds stuck/orphaned records
 */
export const reconciliationWorker = new Worker(
  'reconciliation',
  async (job) => {
    // P0-LOGIC-4: Ledger verification sub-job
    if (job.name === 'ledger-verification') {
      const verification = await CoinLedger.batchVerifyBalances();
      logger.info(`Ledger verification: ${verification.valid}/${verification.total} valid, ${verification.invalid} discrepancies`);
      if (verification.invalid > 0) {
        logger.error('[Scheduler] Ledger discrepancy detected', {
          discrepancies: verification.invalid,
          details: verification.discrepancies,
        });
        // TODO: route to monitoring/alerting (PagerDuty, Slack webhook, etc.)
      }
      return verification;
    }

    // Default: booking/settlement reconciliation
    const report = await ReconciliationPipeline.runFullReconciliation();
    logger.info(`Reconciliation: ${report.stuckHolds} stuck holds, ${report.missedCheckouts} missed checkouts, ${report.missingSettlements} missing settlements`);

    // Fix stuck holds
    if (report.stuckHolds > 0) {
      const stuckIds = await ReconciliationPipeline.findStuckHolds();
      for (const id of stuckIds) {
        await prisma.booking.update({
          where: { id },
          data: { status: 'cancelled', cancellationReason: 'Hold expired (reconciliation)' },
        }).catch((err: unknown) => { console.warn('[Workers] operation failed', { err }); });
      }
      logger.info(`  Fixed ${stuckIds.length} stuck holds`);
    }

    // Process no-shows
    if (report.missedCheckouts > 0) {
      const missedIds = await ReconciliationPipeline.findMissedCheckouts();
      for (const id of missedIds) {
        await prisma.booking.update({
          where: { id },
          data: { status: 'no_show' },
        }).catch((err: unknown) => { console.warn('[Workers] operation failed', { err }); });
      }
      logger.info(`  Marked ${missedIds.length} as no-show`);
    }

    // Store reconciliation run
    await prisma.reconciliationRun.create({
      data: {
        runType: 'daily',
        stuckHolds: report.stuckHolds,
        missedCheckouts: report.missedCheckouts,
        missingSettlements: report.missingSettlements,
        orphanedTransactions: report.orphanedTransactions,
        issuesFound: report.stuckHolds + report.missedCheckouts + report.missingSettlements,
        issuesResolved: report.stuckHolds + report.missedCheckouts,
        details: report as any,
      },
    });
  },
  { connection }
);

/**
 * Coin expiry FIFO worker — consumes the coin-expiry-fifo queue.
 * Uses CoinLedger.processExpiredCoins() which burns oldest batches first (FIFO).
 * Also runs batchVerifyBalances() after each expiry run.
 */
export const coinExpiryFifoWorker = new Worker(
  'coin-expiry-fifo',
  async () => {
    const result = await CoinLedger.processExpiredCoins();
    logger.info(`Coin expiry FIFO: ${result.processed} batches, ₹${result.totalExpired / 100} expired`);

    // Verify balances after expiry
    const verification = await CoinLedger.batchVerifyBalances();
    if (verification.invalid > 0) {
      logger.warn(`⚠️ ${verification.invalid} wallet discrepancies found!`);
    }
  },
  { connection }
);

/**
 * PMS inventory sync worker — pulls availability from connected PMS backends
 * and upserts inventory_slots in OTA.
 *
 * Each job carries: { hotelId, pmsUrl, pmsToken, syncDays? }
 * The queue is populated at startup (once per connected hotel) and re-enqueued
 * after each run with a 15-minute delay.
 */
export const pmsInventorySyncWorker = new Worker(
  'pms-inventory-sync',
  async (job) => {
    const { hotelId, pmsUrl, pmsToken, syncDays = 60 } = job.data as {
      hotelId: string;
      pmsUrl: string;
      pmsToken: string;
      syncDays?: number;
    };

    const hotel = await prisma.hotel.findUnique({
      where: { id: hotelId },
      select: { id: true, name: true, onboardingStatus: true },
    });
    if (!hotel || hotel.onboardingStatus !== 'active') {
      logger.info(`[PmsSync] Skipping inactive hotel ${hotelId}`);
      return;
    }

    const checkin = dayjs().format('YYYY-MM-DD');
    const checkout = dayjs().add(syncDays, 'day').format('YYYY-MM-DD');

    let pmsData: Array<{ roomTypeId: string; date: string; available: number; ratePaise: number }> = [];

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15_000);
      const res = await fetch(
        `${pmsUrl}/v1/partner/pms/inventory?hotel_id=${hotelId}&checkin=${checkin}&checkout=${checkout}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'x-internal-token': pmsToken,
          },
          signal: controller.signal,
        }
      );
      clearTimeout(timeout);

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`PMS returned ${res.status}: ${text.slice(0, 200)}`);
      }

      const payload: any = await res.json();
      pmsData = payload.data ?? payload ?? [];
    } catch (err: any) {
      logger.error(`[PmsSync] Fetch failed for hotel ${hotel.name}: ${err.message}`);
      // Re-enqueue with 5-minute backoff on error
      await pmsInventorySyncQueue.add(
        `sync-${hotelId}`,
        { hotelId, pmsUrl, pmsToken, syncDays },
        { delay: 5 * 60 * 1000, jobId: `sync-${hotelId}` }
      );
      return;
    }

    if (!Array.isArray(pmsData) || pmsData.length === 0) {
      logger.info(`[PmsSync] No inventory data from PMS for hotel ${hotel.name}`);
    } else {
      // Upsert inventory slots — OTA is the source-of-truth for availability
      for (const slot of pmsData) {
        await prisma.$executeRaw`
          INSERT INTO inventory_slots (id, hotel_id, room_type_id, date, available_rooms, rate_paise, updated_at)
          VALUES (
            gen_random_uuid(),
            ${hotelId}::uuid,
            ${slot.roomTypeId}::uuid,
            ${slot.date}::date,
            ${slot.available},
            ${slot.ratePaise},
            NOW()
          )
          ON CONFLICT (room_type_id, date)
          DO UPDATE SET
            available_rooms = EXCLUDED.available_rooms,
            rate_paise = EXCLUDED.rate_paise,
            is_blocked = EXCLUDED.is_blocked,
            updated_at = NOW()
        `;
      }

      logger.info(`[PmsSync] Synced ${pmsData.length} slots for hotel ${hotel.name}`);
    }

    // Re-enqueue for next sync in 15 minutes
    await pmsInventorySyncQueue.add(
      `sync-${hotelId}`,
      { hotelId, pmsUrl, pmsToken, syncDays },
      { delay: 15 * 60 * 1000, jobId: `sync-${hotelId}` }
    );
  },
  { connection, concurrency: 5 }
);

/**
 * BUG-24: PMS notification worker — delivers booking events to Hotel PMS with reliable retry.
 * Uses BullMQ for queue management with exponential backoff.
 * Tracks delivery status in the database for observability.
 */
const PMS_WEBHOOK_URL = process.env.PMS_API_URL
  ? `${process.env.PMS_API_URL}/api/v1/ota-webhooks/rez-ota`
  : '';
const PMS_WEBHOOK_SECRET = process.env.PMS_WEBHOOK_SECRET || '';

function signPayload(payload: object): string {
  return crypto.createHmac('sha256', PMS_WEBHOOK_SECRET).update(JSON.stringify(payload)).digest('hex');
}

export const pmsNotificationWorker = new Worker(
  'pms-notification',
  async (job) => {
    const { event, data, bookingId } = job.data as {
      event: string;
      data: Record<string, unknown>;
      bookingId: string;
    };

    if (!PMS_WEBHOOK_URL) {
      logger.warn(`[PmsNotify] PMS_API_URL not set — skipping event: ${event}`);
      return;
    }

    const body = { event, data };
    const signature = PMS_WEBHOOK_SECRET ? signPayload(body) : undefined;
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (signature) headers['x-webhook-signature'] = signature;

    try {
      const response = await axios.post(PMS_WEBHOOK_URL, body, {
        headers,
        timeout: 10_000,
      });

      // Log successful delivery
      await prisma.pmsWebhookEvent.upsert({
        where: { id: bookingId },
        create: {
          id: bookingId,
          hotelId: data.hotelId as string,
          eventType: event,
          eventData: data as any,
          processed: true,
          processedAt: new Date(),
        },
        update: {
          processed: true,
          processedAt: new Date(),
          error: null,
        },
      });

      logger.info(`[PmsNotify] ${event} delivered successfully for booking ${bookingId}`);
      return { success: true, statusCode: response.status };
    } catch (err: any) {
      // Log failed attempt - will be retried by BullMQ
      await prisma.pmsWebhookEvent.upsert({
        where: { id: bookingId },
        create: {
          id: bookingId,
          hotelId: data.hotelId as string,
          eventType: event,
          eventData: data as any,
          processed: false,
          error: err.message,
        },
        update: {
          error: err.message,
        },
      }).catch(() => {}); // Don't fail the job if DB update fails

      console.error(
        `[PmsNotify] ${event} failed for booking ${bookingId}: ${err.message}. ` +
        `Attempt ${job.attemptsMade}/${job.opts.attempts || 5}`
      );

      // Re-throw to trigger BullMQ retry
      throw err;
    }
  },
  {
    connection,
    concurrency: 3,
  }
);

// Log worker events
pmsNotificationWorker.on('completed', (job) => {
  logger.info(`[PmsNotify] Job ${job.id} completed for event ${job.data.event}`);
});

pmsNotificationWorker.on('failed', (job, err) => {
  logger.error(`[PmsNotify] Job ${job?.id} permanently failed: ${err.message}`);
});

/**
 * Bootstrap PMS sync jobs at startup — one job per hotel that has a PMS URL configured.
 * Runs once on server start; each job self-re-enqueues after completion.
 */
async function bootstrapPmsSyncJobs() {
  // PMS-connected hotels store their backend URL and token in hotel.pmsWebhookUrl / pmsToken
  // For now we check for hotels where pmsWebhookUrl is set (populated by hotel-panel setup)
  const connectedHotels = await prisma.hotel.findMany({
    where: { onboardingStatus: 'active', pmsWebhookUrl: { not: null } },
    select: { id: true, name: true, pmsWebhookUrl: true },
  });

  for (const hotel of connectedHotels) {
    const jobId = `sync-${hotel.id}`;

    // Don't add if a job with this ID is already waiting
    const existing = await pmsInventorySyncQueue.getJob(jobId);
    if (existing) continue;

    await pmsInventorySyncQueue.add(
      jobId,
      {
        hotelId: hotel.id,
        pmsUrl: hotel.pmsWebhookUrl,
        pmsToken: env.REZ_OTA_INTERNAL_TOKEN || '',
        syncDays: 60,
      },
      { jobId, delay: 30_000 } // first run 30s after startup to let server settle
    );

    logger.info(`[PmsSync] Scheduled startup sync for hotel ${hotel.name}`);
  }

  if (connectedHotels.length === 0) {
    logger.info('[PmsSync] No PMS-connected hotels found at startup');
  }
}

// Run bootstrap after a brief delay (DB must be ready)
setTimeout(() => {
  bootstrapPmsSyncJobs().catch((err) => {
    console.error('[PmsSync] Bootstrap failed:', err.message);
  });
}, 10_000);
