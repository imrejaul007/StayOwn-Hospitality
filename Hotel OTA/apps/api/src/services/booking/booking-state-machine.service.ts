import dayjs from 'dayjs';
import { BookingEventType, EventTriggeredBy } from '@prisma/client';
import { prisma } from '../../config/database';
import { Errors } from '../../utils/errors';
import { CoinService } from '../finance/coin.service';
import { SettlementService } from '../payments/settlement.service';
import { RezWebhookService } from '../integrations/rez-webhook.service';
import { PaymentService } from '../payments/payment.service';
import { InventoryEngine } from './inventory-engine.service';

// ─── State machine definition ─────────────────────────────────────────────────

/**
 * All valid state transitions for a booking.
 *
 * Terminals: 'cancelled' and 'mining_counted' have no outgoing edges.
 * 'no_show' is a quasi-terminal that still allows settlement of the
 * cancellation fee.
 */
const TRANSITIONS: Record<string, readonly string[]> = {
  init: ['hold'],
  hold: ['confirmed', 'cancelled'],
  confirmed: ['checked_in', 'cancelled', 'no_show'],
  checked_in: ['stayed'],
  stayed: ['settled'],
  settled: ['mining_counted'],
  cancelled: [],
  no_show: ['settled'],
  mining_counted: [],
} as const;

type BookingState = keyof typeof TRANSITIONS;

// ─── Internal helpers ─────────────────────────────────────────────────────────

function assertValidState(state: string): asserts state is BookingState {
  if (!(state in TRANSITIONS)) {
    throw Errors.validation(`Unknown booking state: ${state}`);
  }
}

/** Fetch the full booking row including related user and hotel. */
async function fetchBooking(bookingId: string) {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      user: { select: { id: true, rezUserId: true, tier: true } },
      hotel: { select: { id: true, name: true, otaCommissionPct: true } },
      rezBookingSyncs: { select: { rezSessionId: true } },
    },
  });

  if (!booking) throw Errors.notFound('Booking');
  return booking;
}

// ─── BookingStateMachine ──────────────────────────────────────────────────────

export class BookingStateMachine {
  // ── Core transition ────────────────────────────────────────────────────────

  /**
   * Transition a booking to a new state.
   *
   * 1. Validates the transition is legal per TRANSITIONS map.
   * 2. Atomically updates booking.status and appends a booking_event row.
   * 3. Runs side-effects (inventory release, coin ops, webhooks, etc.)
   *    outside the DB transaction so that a failing side-effect does not
   *    roll back the authoritative state change.
   *
   * Side-effects that must succeed (coin reversal, inventory release) are
   *    awaited; fire-and-forget side-effects (webhooks, mining score) are
   *    started without await and failures are logged.
   */
  static async transition(
    bookingId: string,
    toState: string,
    triggeredBy: string,
    eventData: Record<string, unknown> = {},
  ): Promise<void> {
    assertValidState(toState);

    const booking = await fetchBooking(bookingId);
    const fromState = booking.status as string;

    // Validate transition is legal
    assertValidState(fromState);
    if (!TRANSITIONS[fromState].includes(toState)) {
      throw Errors.validation(
        `Invalid state transition: ${fromState} → ${toState}`,
        { bookingId, fromState, toState, validTransitions: TRANSITIONS[fromState] },
      );
    }

    // Map toState to the closest BookingEventType enum value.
    // States that map 1:1 to an existing event type are used directly;
    // everything else falls back to the 'created' placeholder so that the
    // audit row is still written without a schema migration.
    const STATE_TO_EVENT_TYPE: Partial<Record<string, BookingEventType>> = {
      hold:            BookingEventType.hold_placed,
      confirmed:       BookingEventType.confirmed,
      checked_in:      BookingEventType.checked_in,
      stayed:          BookingEventType.stayed,
      cancelled:       BookingEventType.cancelled,
      settlement_done: BookingEventType.settlement_triggered,
      mining_counted:  BookingEventType.mining_triggered,
    };
    const eventType: BookingEventType =
      STATE_TO_EVENT_TYPE[toState] ?? BookingEventType.created;

    // Normalise the triggeredBy string to a valid enum member.
    const VALID_TRIGGERED_BY = new Set<string>(['user', 'system', 'admin', 'rez_webhook']);
    const resolvedTriggeredBy: EventTriggeredBy = VALID_TRIGGERED_BY.has(triggeredBy)
      ? (triggeredBy as EventTriggeredBy)
      : EventTriggeredBy.system;

    // Atomically persist the state change + audit event
    await prisma.$transaction(async (tx) => {
      await tx.booking.update({
        where: { id: bookingId },
        data: { status: toState as any },
      });

      await tx.bookingEvent.create({
        data: {
          bookingId,
          eventType,
          eventData: {
            fromState,
            toState,
            rawTriggeredBy: triggeredBy,
            ...eventData,
          },
          triggeredBy: resolvedTriggeredBy,
        },
      });
    });

    console.info(
      '[BookingStateMachine] Booking %s: %s → %s (by %s)',
      bookingId,
      fromState,
      toState,
      triggeredBy,
    );

    // Run side-effects after the state is committed
    try {
      await BookingStateMachine.handleSideEffects(booking, fromState, toState);
    } catch (err: unknown) {
      // Side-effect failure: log loudly but do not roll back the state change.
      // Operators must reconcile via the booking_event log.
      console.error(
        '[BookingStateMachine] Side-effect error on %s (%s→%s): %s',
        bookingId,
        fromState,
        toState,
        err instanceof Error ? err.message : String(err),
        err,
      );
    }
  }

  // ── Query helpers ──────────────────────────────────────────────────────────

  /**
   * Return the list of states a booking can legally move to from its
   * current state.
   */
  static getValidTransitions(currentState: string): string[] {
    return [...(TRANSITIONS[currentState as BookingState] ?? [])];
  }

  // ── Side-effects ───────────────────────────────────────────────────────────

  /**
   * Dispatch side-effects for each state transition.
   *
   * Each branch handles exactly one (fromState, toState) pair. Unknown pairs
   * are no-ops so that future states can be added to TRANSITIONS without
   * breaking this method.
   */
  static async handleSideEffects(
    booking: Awaited<ReturnType<typeof fetchBooking>>,
    fromState: string,
    toState: string,
  ): Promise<void> {
    const key = `${fromState}→${toState}`;

    switch (key) {
      // ── hold → confirmed ─────────────────────────────────────────────────
      case 'hold→confirmed': {
        await BookingStateMachine._onHoldToConfirmed(booking);
        break;
      }

      // ── hold → cancelled (hold expired or user cancelled before payment) ─
      case 'hold→cancelled': {
        await BookingStateMachine._onCancelledFromHold(booking);
        break;
      }

      // ── confirmed → cancelled ────────────────────────────────────────────
      case 'confirmed→cancelled': {
        await BookingStateMachine._onCancelledFromConfirmed(booking);
        break;
      }

      // ── confirmed → no_show ──────────────────────────────────────────────
      case 'confirmed→no_show': {
        await BookingStateMachine._onNoShow(booking);
        break;
      }

      // ── checked_in → stayed ──────────────────────────────────────────────
      case 'checked_in→stayed': {
        await BookingStateMachine._onStayed(booking);
        break;
      }

      // ── stayed → settled ─────────────────────────────────────────────────
      case 'stayed→settled': {
        await BookingStateMachine._onSettled(booking);
        break;
      }

      // ── no_show → settled (cancellation fee settlement) ──────────────────
      case 'no_show→settled': {
        await BookingStateMachine._onNoShowSettled(booking);
        break;
      }

      // ── settled → mining_counted ──────────────────────────────────────────
      case 'settled→mining_counted': {
        // Mining uses the monthly cycle; nothing to do per-booking.
        // Log for audit completeness.
        console.info(
          '[BookingStateMachine] Booking %s marked mining_counted',
          booking.id,
        );
        break;
      }

      // ── init → hold: handled by BookingService.hold() ────────────────────
      case 'init→hold':
        break;

      default:
        // No side-effect defined for this pair — safe no-op.
        break;
    }
  }

  // ── Nightly no-show sweep ──────────────────────────────────────────────────

  /**
   * Mark bookings as no-show if their checkout date has passed and the
   * booking is still in 'confirmed' state.
   *
   * Designed to run as a daily cron job (after midnight).
   * Returns the count of bookings transitioned.
   */
  static async processNoShows(): Promise<number> {
    const now = new Date();

    // Find all confirmed bookings whose checkin date is in the past
    const overdueBookings = await prisma.booking.findMany({
      where: {
        status: 'confirmed',
        checkinDate: { lt: now },
      },
      select: { id: true },
    });

    if (overdueBookings.length === 0) return 0;

    let processed = 0;

    for (const { id } of overdueBookings) {
      try {
        await BookingStateMachine.transition(
          id,
          'no_show',
          'system:nightly-cron',
          { reason: 'Checkin date passed without check-in recorded' },
        );
        processed++;
      } catch (err: unknown) {
        console.error(
          '[BookingStateMachine] processNoShows: failed to transition %s: %s',
          id,
          err instanceof Error ? err.message : String(err),
        );
        // Continue processing remaining bookings
      }
    }

    console.info(
      '[BookingStateMachine] processNoShows: %d/%d bookings transitioned to no_show',
      processed,
      overdueBookings.length,
    );

    return processed;
  }

  // ── Private side-effect handlers ──────────────────────────────────────────

  /**
   * hold → confirmed
   *
   * Triggers:
   *  - OTA coin earn for the user
   *  - Settlement entry creation
   *  - ReZ webhook (async, non-blocking)
   */
  private static async _onHoldToConfirmed(
    booking: Awaited<ReturnType<typeof fetchBooking>>,
  ): Promise<void> {
    // Resolve OTA earn rule and credit coins
    const otaRule = await CoinService.findEarnRule({
      coinType: 'ota',
      channelSource: booking.channelSource,
      hotelId: booking.hotelId,
      userTier: booking.user.tier,
      campaignId: (booking as any).campaignId ?? null,
      bookingValue: booking.totalValuePaise,
    });

    let otaCoinEarned = 0;
    if (otaRule) {
      otaCoinEarned = CoinService.calculateEarnAmount(
        booking.totalValuePaise,
        Number(otaRule.earnPct),
        otaRule.maxEarnPerBookingPaise,
      );
      await CoinService.earnCoins({
        userId: booking.userId,
        coinType: 'ota',
        amountPaise: otaCoinEarned,
        bookingId: booking.id,
        earnRuleId: otaRule.id,
      });
    }

    // Resolve ReZ earn rule (ReZ manages its own ledger via webhook)
    const rezRule = await CoinService.findEarnRule({
      coinType: 'rez',
      channelSource: booking.channelSource,
      hotelId: booking.hotelId,
      userTier: booking.user.tier,
      campaignId: (booking as any).campaignId ?? null,
      bookingValue: booking.totalValuePaise,
    });

    let rezCoinEarned = 0;
    if (rezRule) {
      rezCoinEarned = CoinService.calculateEarnAmount(
        booking.totalValuePaise,
        Number(rezRule.earnPct),
        rezRule.maxEarnPerBookingPaise,
      );
    }

    // Create settlement entry
    await SettlementService.createEntry({
      hotelId: booking.hotelId,
      bookingId: booking.id,
      grossAmountPaise: booking.pgAmountPaise,
      commissionPaise: booking.otaCommissionPaise,
      coinLiabilityPaise: booking.otaCoinBurnedPaise + booking.rezCoinBurnedPaise,
    });

    // Fire-and-forget: ReZ webhook
    if (rezCoinEarned > 0 && booking.user.rezUserId) {
      RezWebhookService.sendBookingConfirmed({
        bookingId: booking.id,
        rezUserId: booking.user.rezUserId,
        bookingValuePaise: booking.totalValuePaise,
        channelSource: booking.channelSource,
        rezCoinToCreditPaise: rezCoinEarned,
        // CD-XS-05 FIX: Pass actual session ID from RezBookingSync for campaign attribution
        rezSessionId: booking.rezBookingSyncs[0]?.rezSessionId ?? undefined,
      }).catch((err: unknown) =>
        console.error('[BookingStateMachine] ReZ webhook (confirmed) failed — will not retry:', err),
      );
    }
  }

  /**
   * hold → cancelled
   *
   * Triggers:
   *  - Inventory release
   *  - Coin burn reversal (coins were already debited at hold time)
   */
  private static async _onCancelledFromHold(
    booking: Awaited<ReturnType<typeof fetchBooking>>,
  ): Promise<void> {
    // Release inventory
    await prisma.$transaction(async (tx) => {
      await InventoryEngine.releaseInventory(tx as any, {
        hotelId: booking.hotelId,
        roomTypeId: booking.roomTypeId,
        checkinDate: dayjs(booking.checkinDate).format('YYYY-MM-DD'),
        checkoutDate: dayjs(booking.checkoutDate).format('YYYY-MM-DD'),
        numRooms: booking.numRooms,
      });

      await (tx as any).booking.update({
        where: { id: booking.id },
        data: {
          cancellationReason: 'Hold expired or cancelled before payment',
          cancelledAt: new Date(),
          refundAmountPaise: 0,
          refundStatus: 'not_applicable',
        },
      });
    });

    // Reverse coin burns (held-in-escrow coins returned to wallet)
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
  }

  /**
   * confirmed → cancelled
   *
   * Triggers:
   *  - Inventory release
   *  - Coin burn reversal
   *  - Coin earn reversal (earned coins credited on confirmation are clawed back)
   *  - Razorpay refund (fire-and-forget with error log)
   */
  private static async _onCancelledFromConfirmed(
    booking: Awaited<ReturnType<typeof fetchBooking>>,
  ): Promise<void> {
    // Release inventory + mark refund in a single atomic operation
    await prisma.$transaction(async (tx) => {
      await InventoryEngine.releaseInventory(tx as any, {
        hotelId: booking.hotelId,
        roomTypeId: booking.roomTypeId,
        checkinDate: dayjs(booking.checkinDate).format('YYYY-MM-DD'),
        checkoutDate: dayjs(booking.checkoutDate).format('YYYY-MM-DD'),
        numRooms: booking.numRooms,
      });

      await (tx as any).booking.update({
        where: { id: booking.id },
        data: {
          cancelledAt: new Date(),
          refundAmountPaise: booking.pgAmountPaise,
          refundStatus: 'pending',
        },
      });
    });

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

    // Reverse coin earn for this booking
    const earnTransactions = await prisma.coinTransaction.findMany({
      where: { bookingId: booking.id, transactionType: 'earn' },
    });

    for (const earnTx of earnTransactions) {
      await CoinService.reverseEarn({
        userId: booking.userId,
        coinType: earnTx.coinType,
        amountPaise: earnTx.amountPaise,
        bookingId: booking.id,
      });
    }

    // Fire-and-forget: initiate Razorpay refund
    if (booking.razorpayPaymentId && booking.pgAmountPaise > 0) {
      PaymentService.initiateRefund(booking.razorpayPaymentId, booking.pgAmountPaise, booking.id).catch(
        (err: unknown) =>
          console.error(
            '[BookingStateMachine] Razorpay refund failed for booking %s — requires manual intervention: %s',
            booking.id,
            err instanceof Error ? err.message : String(err),
          ),
      );
    }
  }

  /**
   * confirmed → no_show
   *
   * Guest did not check in. Triggers:
   *  - Partial settlement adjustment (cancellation fee retained)
   *  - Reversal of earned coins (if any)
   *  - Coin burn reversal NOT applied — cancellation fee offsets the burn
   *
   * The no_show → settled transition handles the actual fee settlement.
   */
  private static async _onNoShow(
    booking: Awaited<ReturnType<typeof fetchBooking>>,
  ): Promise<void> {
    // Cancellation fee: retain first night's rate (or 100% if single night)
    const cancellationFeePaise = booking.roomRatePaise * booking.numRooms;
    const refundAmountPaise = Math.max(0, booking.pgAmountPaise - cancellationFeePaise);

    await prisma.booking.update({
      where: { id: booking.id },
      data: {
        refundAmountPaise,
        refundStatus: refundAmountPaise > 0 ? 'pending' : 'not_applicable',
        cancellationPenaltyPaise: cancellationFeePaise,
      },
    });

    // Reverse earned coins since the stay did not happen
    const earnTransactions = await prisma.coinTransaction.findMany({
      where: { bookingId: booking.id, transactionType: 'earn' },
    });

    for (const earnTx of earnTransactions) {
      await CoinService.reverseEarn({
        userId: booking.userId,
        coinType: earnTx.coinType,
        amountPaise: earnTx.amountPaise,
        bookingId: booking.id,
      });
    }

    // Partial refund (fire-and-forget)
    if (refundAmountPaise > 0 && booking.razorpayPaymentId) {
      PaymentService.initiateRefund(booking.razorpayPaymentId, refundAmountPaise, booking.id).catch(
        (err: unknown) =>
          console.error(
            '[BookingStateMachine] No-show partial refund failed for booking %s: %s',
            booking.id,
            err instanceof Error ? err.message : String(err),
          ),
      );
    }
  }

  /**
   * checked_in → stayed
   *
   * Guest has completed their stay. Triggers:
   *  - Mining score update for the hotel (async)
   *  - ReZ stay-completed webhook (async, non-blocking)
   */
  private static async _onStayed(
    booking: Awaited<ReturnType<typeof fetchBooking>>,
  ): Promise<void> {
    // Fire-and-forget: ReZ stay-completed webhook
    if (booking.user.rezUserId) {
      RezWebhookService.sendStayCompleted({
        bookingId: booking.id,
        rezUserId: booking.user.rezUserId,
      }).catch((err: unknown) =>
        console.error(
          '[BookingStateMachine] ReZ stay-completed webhook failed for booking %s: %s',
          booking.id,
          err instanceof Error ? err.message : String(err),
        ),
      );
    }

    // Mining score is recalculated monthly via MiningService.runMiningCycle().
    // Per-stay, we log so the monthly job can pick it up from bookings.
    console.info(
      '[BookingStateMachine] Stay completed for booking %s — hotel %s eligible for mining score update',
      booking.id,
      booking.hotelId,
    );
  }

  /**
   * stayed → settled
   *
   * Mark the settlement entry as complete (payment released to hotel).
   */
  private static async _onSettled(
    booking: Awaited<ReturnType<typeof fetchBooking>>,
  ): Promise<void> {
    await prisma.settlementEntry.updateMany({
      where: { bookingId: booking.id, status: { in: ['pending', 'approved'] } },
      data: { status: 'paid' },
    });

    console.info(
      '[BookingStateMachine] Settlement marked complete for booking %s',
      booking.id,
    );
  }

  /**
   * no_show → settled
   *
   * No-show bookings still generate a settlement entry for the cancellation
   * fee retained by the hotel. Mark it complete.
   */
  private static async _onNoShowSettled(
    booking: Awaited<ReturnType<typeof fetchBooking>>,
  ): Promise<void> {
    // Upsert a settlement entry for the no-show fee if one doesn't exist yet
    const existing = await prisma.settlementEntry.findFirst({
      where: { bookingId: booking.id },
    });

    if (!existing) {
      const feePaise: number = (booking as { noShowFeeChargedPaise?: number }).noShowFeeChargedPaise
        ?? (booking as { cancellationPenaltyPaise?: number }).cancellationPenaltyPaise
        ?? 0;
      if (feePaise > 0) {
        await SettlementService.createEntry({
          hotelId: booking.hotelId,
          bookingId: booking.id,
          grossAmountPaise: feePaise,
          commissionPaise: Math.round(
            feePaise * (Number(booking.hotel.otaCommissionPct) / 100),
          ),
          coinLiabilityPaise: 0,
        });
      }
    }

    await prisma.settlementEntry.updateMany({
      where: { bookingId: booking.id, status: { in: ['pending', 'approved'] } },
      data: { status: 'paid' },
    });

    console.info(
      '[BookingStateMachine] No-show settlement complete for booking %s',
      booking.id,
    );
  }
}
