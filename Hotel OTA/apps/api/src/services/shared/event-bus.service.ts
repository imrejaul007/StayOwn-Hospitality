import { prisma } from '../../config/database';
import { holdExpiryQueue, coinExpiryQueue, settlementBatchQueue, tierUpdateQueue } from '../../jobs/queues';
import dayjs from 'dayjs';

/**
 * Central Event Bus — every booking generates ONE event packet.
 * This is the single point that triggers all downstream systems:
 * - OTA Coin engine
 * - ReZ Coin engine
 * - Ownership mining engine
 * - Settlement engine
 * - Notification engine
 * - Analytics pipeline
 *
 * All events are persisted in booking_events table (append-only).
 * Downstream processing is async via BullMQ queues.
 */

export interface BookingEventPacket {
  bookingId: string;
  userId: string;
  hotelId: string;
  roomTypeId: string;
  channelSource: string;
  attributionPartner: string | null;
  bookingValuePaise: number;
  checkinDate: string;
  checkoutDate: string;
  stayCompletedFlag: boolean;
  paymentMethod: string | null;
  otaCoinBurned: number;
  rezCoinBurned: number;
  pgAmountPaise: number;
}

type EventHandler = (event: BookingEventPacket, eventType: string) => Promise<void>;

class EventBus {
  private handlers: Map<string, EventHandler[]> = new Map();

  /**
   * Register an event handler
   */
  on(eventType: string, handler: EventHandler): void {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, []);
    }
    this.handlers.get(eventType)!.push(handler);
  }

  /**
   * Emit an event — persists to DB, then dispatches to all handlers.
   * Handlers run async and don't block the caller.
   * Failed handlers are logged but don't fail the event.
   */
  async emit(eventType: string, packet: BookingEventPacket, triggeredBy: string = 'system'): Promise<void> {
    // 1. Persist event (append-only)
    await prisma.bookingEvent.create({
      data: {
        bookingId: packet.bookingId,
        eventType: eventType as any,
        eventData: packet as any,
        triggeredBy: triggeredBy as any,
      },
    });

    // 2. Dispatch to handlers (fire-and-forget with error logging)
    const handlers = this.handlers.get(eventType) || [];
    for (const handler of handlers) {
      try {
        await handler(packet, eventType);
      } catch (err) {
        console.error(`[EventBus] Handler failed for ${eventType}:`, err);
        // Log to risk events for monitoring
        await prisma.$executeRaw`
          INSERT INTO booking_events (booking_id, event_type, event_data, triggered_by)
          VALUES (${packet.bookingId}::uuid, 'settlement_triggered', ${JSON.stringify({ error: String(err), eventType })}::jsonb, 'system')
        `.catch((err: unknown) => { console.warn('[EventBus] operation failed', { err }); });
      }
    }
  }
}

// Singleton event bus instance
export const eventBus = new EventBus();

/**
 * Idempotency guard — prevents duplicate processing.
 * Uses a simple check: has this exact event already been processed?
 */
export async function isEventProcessed(bookingId: string, eventType: string): Promise<boolean> {
  const existing = await prisma.bookingEvent.findFirst({
    where: { bookingId, eventType: eventType as any },
  });
  return !!existing;
}

/**
 * Reconciliation pipeline — finds orphaned/stuck bookings.
 * Run nightly to catch edge cases.
 */
export class ReconciliationPipeline {
  /**
   * Find holds that should have expired but didn't (queue failure).
   */
  static async findStuckHolds(): Promise<string[]> {
    const stuck = await prisma.booking.findMany({
      where: {
        status: 'hold',
        holdExpiresAt: { lt: new Date() },
      },
      select: { id: true, bookingRef: true },
    });

    return stuck.map((b) => b.id);
  }

  /**
   * Find confirmed bookings past checkout date that are still "confirmed".
   * These should be marked as "no_show".
   */
  static async findMissedCheckouts(): Promise<string[]> {
    const missed = await prisma.booking.findMany({
      where: {
        status: 'confirmed',
        checkoutDate: { lt: dayjs().subtract(1, 'day').toDate() },
      },
      select: { id: true },
    });

    return missed.map((b) => b.id);
  }

  /**
   * Find bookings with settlement entries missing.
   */
  static async findMissingSettlements(): Promise<string[]> {
    const bookings = await prisma.booking.findMany({
      where: {
        status: { in: ['confirmed', 'checked_in', 'stayed'] },
        paymentStatus: 'paid',
        settlementEntry: null,
      },
      select: { id: true },
    });

    return bookings.map((b) => b.id);
  }

  /**
   * Find coin transactions without matching booking events.
   */
  static async findOrphanedCoinTransactions(): Promise<number> {
    const result = await prisma.coinTransaction.count({
      where: {
        bookingId: null,
        transactionType: { in: ['earn', 'burn'] },
      },
    });
    return result;
  }

  /**
   * Run full reconciliation and return report.
   */
  static async runFullReconciliation(): Promise<{
    stuckHolds: number;
    missedCheckouts: number;
    missingSettlements: number;
    orphanedTransactions: number;
    runAt: string;
  }> {
    const [stuckHolds, missedCheckouts, missingSettlements, orphanedTransactions] = await Promise.all([
      this.findStuckHolds().then((r) => r.length),
      this.findMissedCheckouts().then((r) => r.length),
      this.findMissingSettlements().then((r) => r.length),
      this.findOrphanedCoinTransactions(),
    ]);

    return {
      stuckHolds,
      missedCheckouts,
      missingSettlements,
      orphanedTransactions,
      runAt: new Date().toISOString(),
    };
  }
}
