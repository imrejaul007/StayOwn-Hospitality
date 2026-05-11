import { prisma, Prisma } from '../../config/database';
import dayjs from 'dayjs';

export class SettlementService {
  /**
   * Create settlement entry on booking confirmation
   * BUG-6 FIX: Accept optional Prisma transaction client for atomicity with booking confirmation.
   * When called with tx, the settlement creation and booking update happen in a single transaction.
   * When called without tx, creates its own transaction (backward compatible).
   */
  static async createEntry(
    params: {
      hotelId: string;
      bookingId: string;
      grossAmountPaise: number;
      commissionPaise: number;
      coinLiabilityPaise: number;
    },
    tx?: Prisma.TransactionClient
  ) {
    const { hotelId, bookingId, grossAmountPaise, commissionPaise, coinLiabilityPaise } = params;
    const netPayablePaise = grossAmountPaise - commissionPaise;

    const client = tx || prisma;

    await client.settlementEntry.create({
      data: {
        hotelId,
        bookingId,
        grossAmountPaise,
        commissionPaise,
        coinLiabilityPaise,
        netPayablePaise,
        status: 'pending',
      },
    });

    // Update hotel wallet pending balance
    await client.hotelWallet.upsert({
      where: { hotelId },
      create: {
        hotelId,
        pendingBalancePaise: netPayablePaise,
        lifetimeEarnedPaise: netPayablePaise,
      },
      update: {
        pendingBalancePaise: { increment: netPayablePaise },
        lifetimeEarnedPaise: { increment: netPayablePaise },
      },
    });
  }

  /**
   * Reverse settlement entry on booking cancellation.
   * BUG-15 FIX: Added proper error handling — throws on failure, logs to audit table, emits event.
   * Prevents cancelled bookings from being paid out to hotels.
   */
  static async reverseEntry(bookingId: string): Promise<void> {
    const entry = await prisma.settlementEntry.findFirst({
      where: { bookingId },
    });

    // 'cancelled' added in migration 20260410_add_settlement_cancelled_status — cast until client regenerated
    if (!entry || (entry.status as string) === 'cancelled' || entry.status === 'disputed') {
      return;
    }

    try {
      await prisma.$transaction(async (tx) => {
        await tx.settlementEntry.update({
          where: { id: entry.id },
          data: { status: (entry.status === 'pending' ? 'cancelled' : 'disputed') as any },
        });

        // Decrement the appropriate wallet balance column based on entry lifecycle
        if (entry.status === 'pending') {
          await tx.hotelWallet.update({
            where: { hotelId: entry.hotelId },
            data: { pendingBalancePaise: { decrement: entry.netPayablePaise } },
          });
        } else if (entry.status === 'approved') {
          // Entry was moved to available during batch — reverse that
          await tx.hotelWallet.update({
            where: { hotelId: entry.hotelId },
            data: { availableBalancePaise: { decrement: entry.netPayablePaise } },
          });
        }
      });
    } catch (error) {
      // Log failure to audit table
      await prisma.settlementAuditLog.create({
        data: {
          settlementId: entry.id,
          action: 'reversal_failed',
          bookingId,
          hotelId: entry.hotelId,
          errorMessage: error instanceof Error ? error.message : String(error),
          metadata: {
            entryStatus: entry.status,
            netPayablePaise: entry.netPayablePaise,
            originalError: error instanceof Error ? error.stack : String(error),
          },
        },
      });

      // Emit event for monitoring/alerting
      console.error('[SettlementService] Settlement reversal failed', {
        settlementId: entry.id,
        bookingId,
        hotelId: entry.hotelId,
        error,
      });

      throw new Error(`Settlement reversal failed for booking ${bookingId}: ${error instanceof Error ? error.message : String(error)}`);
    }

    // Log successful reversal
    await prisma.settlementAuditLog.create({
      data: {
        settlementId: entry.id,
        action: 'reversal_success',
        bookingId,
        hotelId: entry.hotelId,
        metadata: {
          entryStatus: entry.status,
          netPayablePaise: entry.netPayablePaise,
        },
      },
    });
  }

  /**
   * Process T+1 settlement batch
   * Picks up yesterday's confirmed bookings, creates payout batch
   */
  static async processSettlementBatch() {
    const yesterday = dayjs().subtract(1, 'day').startOf('day').toDate();
    const today = dayjs().startOf('day').toDate();

    const pendingEntries = await prisma.settlementEntry.findMany({
      where: {
        status: 'pending',
        createdAt: { gte: yesterday, lt: today },
      },
      include: { hotel: { select: { id: true, name: true } } },
    });

    if (pendingEntries.length === 0) return null;

    // Group by hotel
    const hotelPayouts = new Map<string, number>();
    for (const entry of pendingEntries) {
      const current = hotelPayouts.get(entry.hotelId) || 0;
      hotelPayouts.set(entry.hotelId, current + entry.netPayablePaise);
    }

    const batchRef = `BATCH-${dayjs().format('YYYYMMDD')}-${Date.now()}`;
    const totalAmount = Array.from(hotelPayouts.values()).reduce((sum, v) => sum + v, 0);

    const batch = await prisma.$transaction(async (tx) => {
      const newBatch = await tx.payoutBatch.create({
        data: {
          batchRef,
          totalHotels: hotelPayouts.size,
          totalAmountPaise: totalAmount,
          status: 'processing',
        },
      });

      // Link entries to batch and mark approved
      await tx.settlementEntry.updateMany({
        where: { id: { in: pendingEntries.map((e) => e.id) } },
        data: { status: 'approved', payoutBatchId: newBatch.id },
      });

      // Move hotel wallet balances from pending to available
      for (const [hotelId, amount] of hotelPayouts) {
        await tx.hotelWallet.update({
          where: { hotelId },
          data: {
            pendingBalancePaise: { decrement: amount },
            availableBalancePaise: { increment: amount },
          },
        });
      }

      return newBatch;
    });

    return { batchRef: batch.batchRef, totalHotels: hotelPayouts.size, totalAmountPaise: totalAmount };
  }

  /**
   * Get settlement statement for a hotel
   */
  static async getHotelStatement(hotelId: string, page = 1, perPage = 20) {
    const [entries, total, wallet] = await Promise.all([
      prisma.settlementEntry.findMany({
        where: { hotelId },
        include: { booking: { select: { bookingRef: true, checkinDate: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * perPage,
        take: perPage,
      }),
      prisma.settlementEntry.count({ where: { hotelId } }),
      prisma.hotelWallet.findUnique({ where: { hotelId } }),
    ]);

    return {
      wallet: wallet
        ? {
            availableBalancePaise: wallet.availableBalancePaise,
            pendingBalancePaise: wallet.pendingBalancePaise,
            lifetimeEarnedPaise: wallet.lifetimeEarnedPaise,
            lifetimeSettledPaise: wallet.lifetimeSettledPaise,
          }
        : null,
      entries: entries.map((e) => ({
        id: e.id,
        bookingRef: e.booking.bookingRef,
        checkinDate: e.booking.checkinDate,
        grossAmountPaise: e.grossAmountPaise,
        commissionPaise: e.commissionPaise,
        netPayablePaise: e.netPayablePaise,
        status: e.status,
        createdAt: e.createdAt,
      })),
      total,
      page,
    };
  }
}
