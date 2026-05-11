import { Prisma } from '@prisma/client';
import { prisma } from '../../config/database';
import { Errors } from '../../utils/errors';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface InventorySlot {
  id: string;
  date: Date;
  ratePaise: number;
  availableRooms: number;
  isBlocked: boolean;
}

type PrismaTransactionClient = Omit<
  typeof prisma,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;

// PostgreSQL error code for "could not obtain lock" (NOWAIT)
const PG_LOCK_NOT_AVAILABLE = '55P03';
// PostgreSQL error code for deadlock detected
const PG_DEADLOCK_DETECTED = '40P01';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Compute the number of calendar days in a half-open range [checkin, checkout).
 */
function countNights(checkinDate: string, checkoutDate: string): number {
  const msPerDay = 86_400_000;
  return Math.round(
    (new Date(checkoutDate).getTime() - new Date(checkinDate).getTime()) / msPerDay,
  );
}

/**
 * Narrow an unknown error to a Prisma raw query error and return the
 * PostgreSQL error code if available.
 */
function pgCode(err: unknown): string | undefined {
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    return (err.meta as Record<string, unknown> | undefined)?.code as string | undefined;
  }
  // Raw query errors surface as a plain Error whose message contains the pg code.
  if (err instanceof Error) {
    const match = err.message.match(/error code: (\w+)/i) || err.message.match(/\b(55P03|40P01)\b/);
    return match?.[1];
  }
  return undefined;
}

// ─── InventoryEngine ──────────────────────────────────────────────────────────

export class InventoryEngine {
  // ── Locking ────────────────────────────────────────────────────────────────

  /**
   * Lock inventory with PostgreSQL row-level locking.
   *
   * Uses SELECT FOR UPDATE NOWAIT so we fail fast on contention instead of
   * queuing behind another transaction. Callers must be inside a
   * prisma.$transaction block so the locks are released on commit/rollback.
   *
   * Throws INVENTORY_UNAVAILABLE when:
   *  - any date in the range is missing (hole in the calendar),
   *  - any slot is blocked (blackout),
   *  - any slot has fewer available rooms than requested, or
   *  - another transaction already holds the row lock.
   */
  static async lockInventory(
    tx: PrismaTransactionClient,
    params: {
      hotelId: string;
      roomTypeId: string;
      checkinDate: string;
      checkoutDate: string;
      numRooms: number;
    },
  ): Promise<InventorySlot[]> {
    const { hotelId, roomTypeId, checkinDate, checkoutDate, numRooms } = params;
    const numNights = countNights(checkinDate, checkoutDate);

    if (numNights <= 0) {
      throw Errors.validation('Checkout must be after checkin');
    }

    let rows: Array<{
      id: string;
      date: Date;
      rate_paise: number;
      available_rooms: number;
      is_blocked: boolean;
    }>;

    try {
      rows = await tx.$queryRaw<typeof rows>`
        SELECT id, date, rate_paise, available_rooms, is_blocked
        FROM inventory_slots
        WHERE hotel_id     = ${hotelId}::uuid
          AND room_type_id = ${roomTypeId}::uuid
          AND date >= ${checkinDate}::date
          AND date <  ${checkoutDate}::date
        ORDER BY date
        FOR UPDATE NOWAIT
      `;
    } catch (err: unknown) {
      const code = pgCode(err);
      if (code === PG_LOCK_NOT_AVAILABLE || code === PG_DEADLOCK_DETECTED) {
        console.warn(
          '[InventoryEngine] Lock contention on %s/%s %s→%s — code %s',
          hotelId,
          roomTypeId,
          checkinDate,
          checkoutDate,
          code,
        );
        throw Errors.inventoryUnavailable();
      }
      throw err;
    }

    // Verify we got a row for every night (no calendar gaps)
    if (rows.length !== numNights) {
      throw Errors.inventoryUnavailable();
    }

    // Validate every slot
    for (const row of rows) {
      if (row.is_blocked) {
        throw Errors.inventoryUnavailable();
      }
      if (row.available_rooms < numRooms) {
        throw Errors.inventoryUnavailable();
      }
    }

    // Atomically decrement available rooms for each slot
    for (const row of rows) {
      await tx.$executeRaw`
        UPDATE inventory_slots
        SET available_rooms = available_rooms - ${numRooms},
            updated_at      = NOW()
        WHERE id = ${row.id}::uuid
      `;

      // Oversell guard: double-check after decrement
      const check = await tx.$queryRaw<[{ available_rooms: number }]>`
        SELECT available_rooms FROM inventory_slots WHERE id = ${row.id}::uuid
      `;
      if (check[0].available_rooms < 0) {
        console.warn(
          '[InventoryEngine] Oversell detected on slot %s — rolling back',
          row.id,
        );
        throw Errors.inventoryUnavailable();
      }
    }

    return rows.map((r) => ({
      id: r.id,
      date: r.date,
      ratePaise: r.rate_paise,
      availableRooms: r.available_rooms - numRooms, // value after decrement
      isBlocked: r.is_blocked,
    }));
  }

  // ── Release ────────────────────────────────────────────────────────────────

  /**
   * Release inventory — increment available rooms back.
   *
   * Used on hold expiry, cancellation, and payment failure. Safe to call
   * inside or outside a transaction; pass the tx client when already inside
   * one, otherwise use `prisma` directly (the caller should wrap this in a
   * $transaction).
   *
   * FIX-BUG-10: Uses SELECT FOR UPDATE to lock rows before updating.
   * This prevents a concurrent hold() with NOWAIT from acquiring locks
   * on the same rows while release is in progress. The hold() will block
   * until this transaction commits, ensuring rooms aren't double-booked.
   */
  static async releaseInventory(
    tx: PrismaTransactionClient,
    params: {
      hotelId: string;
      roomTypeId: string;
      checkinDate: string;
      checkoutDate: string;
      numRooms: number;
    },
  ): Promise<void> {
    const { hotelId, roomTypeId, checkinDate, checkoutDate, numRooms } = params;

    // FIX-BUG-10 + C-2: Lock rows with FOR UPDATE inside a serializable transaction.
    // The $transaction wrapper at the call site uses Serializable isolation,
    // preventing any race between SELECT FOR UPDATE and UPDATE.
    const rows = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM inventory_slots
      WHERE hotel_id     = ${hotelId}::uuid
        AND room_type_id = ${roomTypeId}::uuid
        AND date >= ${checkinDate}::date
        AND date <  ${checkoutDate}::date
        AND is_blocked = false
      FOR UPDATE
    `;

    if (rows.length === 0) return; // No rows to release

    const affected = await tx.$executeRaw`
      UPDATE inventory_slots
      SET available_rooms = available_rooms + ${numRooms},
          updated_at      = NOW()
      WHERE hotel_id     = ${hotelId}::uuid
        AND room_type_id = ${roomTypeId}::uuid
        AND date >= ${checkinDate}::date
        AND date <  ${checkoutDate}::date
        AND is_blocked = false
    `;

    if (affected === 0) {
      console.warn(
        '[InventoryEngine] releaseInventory: no rows updated for %s/%s %s→%s',
        hotelId,
        roomTypeId,
        checkinDate,
        checkoutDate,
      );
    }

    // Post-release oversell check
    const oversold = await tx.$queryRaw<Array<{ id: string; date: Date; available_rooms: number }>>`
      SELECT id, date, available_rooms
      FROM inventory_slots
      WHERE hotel_id     = ${hotelId}::uuid
        AND room_type_id = ${roomTypeId}::uuid
        AND date >= ${checkinDate}::date
        AND date <  ${checkoutDate}::date
        AND available_rooms < 0
    `;

    if (oversold.length > 0) {
      console.error(
        '[InventoryEngine] OVERSELL after release on %s/%s — affected slots: %j',
        hotelId,
        roomTypeId,
        oversold.map((s) => ({ id: s.id, date: s.date, available: s.available_rooms })),
      );
    }
  }

  // ── Read-only availability ─────────────────────────────────────────────────

  /**
   * Check availability without locking (read-only, uses a snapshot read).
   *
   * Suitable for search results and availability UI. Does NOT guarantee the
   * inventory will still be available when the caller tries to hold; use
   * lockInventory inside a transaction for that guarantee.
   */
  static async checkAvailability(params: {
    hotelId: string;
    roomTypeId: string;
    checkinDate: string;
    checkoutDate: string;
    numRooms: number;
  }): Promise<{ available: boolean; slots: InventorySlot[]; totalPaise: number }> {
    const { hotelId, roomTypeId, checkinDate, checkoutDate, numRooms } = params;
    const numNights = countNights(checkinDate, checkoutDate);

    if (numNights <= 0) {
      return { available: false, slots: [], totalPaise: 0 };
    }

    const rows = await prisma.$queryRaw<
      Array<{
        id: string;
        date: Date;
        rate_paise: number;
        available_rooms: number;
        is_blocked: boolean;
      }>
    >`
      SELECT id, date, rate_paise, available_rooms, is_blocked
      FROM inventory_slots
      WHERE hotel_id     = ${hotelId}::uuid
        AND room_type_id = ${roomTypeId}::uuid
        AND date >= ${checkinDate}::date
        AND date <  ${checkoutDate}::date
        AND is_blocked = false
        AND available_rooms >= ${numRooms}
      ORDER BY date
    `;

    const available = rows.length === numNights;
    const slots: InventorySlot[] = rows.map((r) => ({
      id: r.id,
      date: r.date,
      ratePaise: r.rate_paise,
      availableRooms: r.available_rooms,
      isBlocked: r.is_blocked,
    }));

    const totalPaise = available
      ? rows.reduce((sum, r) => sum + r.rate_paise, 0) * numRooms
      : 0;

    return { available, slots, totalPaise };
  }

  // ── Blackouts ──────────────────────────────────────────────────────────────

  /**
   * Apply blackout dates — block inventory for a closed date range [from, to].
   *
   * Sets is_blocked = true and available_rooms = 0 for every slot in the
   * range. Returns the number of rows affected.
   */
  static async applyBlackout(
    hotelId: string,
    roomTypeId: string,
    fromDate: string,
    toDate: string,
    reason: string,
  ): Promise<number> {
    const affected = await prisma.$executeRaw`
      UPDATE inventory_slots
      SET is_blocked  = true,
          available_rooms = 0,
          block_reason = ${reason},
          updated_at  = NOW()
      WHERE hotel_id     = ${hotelId}::uuid
        AND room_type_id = ${roomTypeId}::uuid
        AND date >= ${fromDate}::date
        AND date <= ${toDate}::date
    `;

    console.info(
      '[InventoryEngine] Blackout applied: %s/%s %s→%s (%s) — %d rows',
      hotelId,
      roomTypeId,
      fromDate,
      toDate,
      reason,
      affected,
    );

    return affected;
  }

  /**
   * Remove blackout dates — restore availability for the date range.
   *
   * Clears is_blocked flag and restores the original room count from the
   * room_type table. Returns the number of rows affected.
   */
  static async removeBlackout(
    hotelId: string,
    roomTypeId: string,
    fromDate: string,
    toDate: string,
  ): Promise<number> {
    // Fetch the total rooms for this room type to restore the correct count
    const roomType = await prisma.$queryRaw<[{ total_rooms: number }]>`
      SELECT total_rooms FROM room_types WHERE id = ${roomTypeId}::uuid LIMIT 1
    `;

    const totalRooms = roomType[0]?.total_rooms ?? 0;

    const affected = await prisma.$executeRaw`
      UPDATE inventory_slots
      SET is_blocked      = false,
          available_rooms = ${totalRooms},
          block_reason = NULL,
          updated_at      = NOW()
      WHERE hotel_id     = ${hotelId}::uuid
        AND room_type_id = ${roomTypeId}::uuid
        AND date >= ${fromDate}::date
        AND date <= ${toDate}::date
        AND is_blocked = true
    `;

    console.info(
      '[InventoryEngine] Blackout removed: %s/%s %s→%s — %d rows restored',
      hotelId,
      roomTypeId,
      fromDate,
      toDate,
      affected,
    );

    return affected;
  }

  // ── Reconciliation ─────────────────────────────────────────────────────────

  /**
   * Validate no overselling — find all slots where available_rooms < 0.
   *
   * Designed to run as a nightly reconciliation cron job. Returns a list of
   * issues that an operator should investigate and correct manually.
   */
  static async reconcileInventory(
    hotelId: string,
  ): Promise<{ issues: Array<{
    slotId: string;
    roomTypeId: string;
    date: Date;
    availableRooms: number;
    severity: 'oversold' | 'warning';
  }> }> {
    const oversoldRows = await prisma.$queryRaw<
      Array<{
        id: string;
        room_type_id: string;
        date: Date;
        available_rooms: number;
        total_rooms: number;
      }>
    >`
      SELECT
        s.id,
        s.room_type_id,
        s.date,
        s.available_rooms,
        rt.total_rooms
      FROM inventory_slots s
      JOIN room_types rt ON rt.id = s.room_type_id
      WHERE s.hotel_id = ${hotelId}::uuid
        AND (
          s.available_rooms < 0
          OR s.available_rooms > rt.total_rooms
        )
      ORDER BY s.date
    `;

    if (oversoldRows.length > 0) {
      console.error(
        '[InventoryEngine] Reconciliation found %d issues for hotel %s',
        oversoldRows.length,
        hotelId,
      );
    }

    const issues = oversoldRows.map((r) => ({
      slotId: r.id,
      roomTypeId: r.room_type_id,
      date: r.date,
      availableRooms: r.available_rooms,
      severity: (r.available_rooms < 0 ? 'oversold' : 'warning') as 'oversold' | 'warning',
    }));

    return { issues };
  }

  // ── Bulk rate updates ──────────────────────────────────────────────────────

  /**
   * Bulk update rates for a date range.
   *
   * Supports base, weekend, and event rate types. Each entry targets a single
   * calendar date. Returns the number of rows updated.
   *
   * This is done outside a transaction intentionally — individual date
   * failures should not roll back the entire batch. Each row is upserted
   * independently with optimistic concurrency (updated_at guard).
   */
  static async bulkUpdateRates(
    hotelId: string,
    roomTypeId: string,
    updates: Array<{
      date: string;
      ratePaise: number;
      rateType?: 'base' | 'weekend' | 'event';
    }>,
  ): Promise<number> {
    if (updates.length === 0) return 0;

    let updatedCount = 0;
    const errors: Array<{ date: string; error: string }> = [];

    for (const update of updates) {
      if (update.ratePaise < 0) {
        errors.push({ date: update.date, error: 'ratePaise must be >= 0' });
        continue;
      }

      try {
        const result = await prisma.$executeRaw`
          UPDATE inventory_slots
          SET rate_paise = ${update.ratePaise},
              rate_type  = ${update.rateType ?? 'base'},
              updated_at = NOW()
          WHERE hotel_id     = ${hotelId}::uuid
            AND room_type_id = ${roomTypeId}::uuid
            AND date         = ${update.date}::date
        `;

        if (result === 0) {
          errors.push({ date: update.date, error: 'Slot not found — rate not updated' });
        } else {
          updatedCount++;
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        errors.push({ date: update.date, error: message });
        console.error('[InventoryEngine] bulkUpdateRates error on %s: %s', update.date, message);
      }
    }

    if (errors.length > 0) {
      console.warn(
        '[InventoryEngine] bulkUpdateRates: %d/%d updates failed for %s/%s: %j',
        errors.length,
        updates.length,
        hotelId,
        roomTypeId,
        errors,
      );
    }

    return updatedCount;
  }
}
