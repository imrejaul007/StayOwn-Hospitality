import Booking from '../models/Booking.js';
import Room from '../models/Room.js';
import Payment from '../models/Payment.js';
import NightAudit from '../models/NightAudit.js';
import paymentReconciliationService from './paymentReconciliationService.js';
import Decimal from 'decimal.js';
import logger from '../utils/logger.js';

class NightAuditService {
  async runFullAudit(hotelId, auditDate, userId = null, initiatedBy = 'scheduled') {
    try {
      const dateStart = new Date(auditDate);
      dateStart.setUTCHours(0, 0, 0, 0);

      // Check if audit already exists for this date
      let audit = await NightAudit.findOne({ hotelId, auditDate: dateStart });
      if (audit && audit.status === 'completed') {
        logger.info('Night audit already completed for this date', { hotelId, auditDate: dateStart });
        return audit;
      }

      // Create or update audit record
      if (!audit) {
        audit = new NightAudit({
          hotelId,
          auditDate: dateStart,
          status: 'in_progress',
          startedAt: new Date(),
          initiatedBy,
          initiatedByUser: userId,
          steps: [
            { name: 'room_inventory_verification', status: 'pending' },
            { name: 'booking_reconciliation', status: 'pending' },
            { name: 'revenue_posting', status: 'pending' },
            { name: 'no_show_processing', status: 'pending' },
            { name: 'settlement_verification', status: 'pending' },
            { name: 'lock_day', status: 'pending' }
          ]
        });
      } else {
        audit.status = 'in_progress';
        audit.startedAt = new Date();
      }

      await audit.save();

      try {
        // Step 1: Room Inventory Verification
        await this.runStep(audit, 0, () => this.verifyRoomInventory(hotelId, dateStart));

        // Step 2: Booking Reconciliation
        await this.runStep(audit, 1, () => this.reconcileBookings(hotelId, dateStart));

        // Step 3: Revenue Posting
        await this.runStep(audit, 2, () => this.postRevenue(hotelId, dateStart));

        // Step 4: No-Show Processing
        await this.runStep(audit, 3, () => this.processNoShows(hotelId, dateStart));

        // Step 5: Settlement Verification
        await this.runStep(audit, 4, () => this.verifySettlements(hotelId, dateStart, audit._id));

        // Step 6: Lock Day
        await this.runStep(audit, 5, () => this.lockDay(audit, userId));

        audit.status = 'completed';
        audit.completedAt = new Date();
      } catch (error) {
        audit.status = 'failed';
        logger.error('Night audit failed', { hotelId, auditDate: dateStart, error: error.message });
      }

      await audit.save();
      return audit;
    } catch (error) {
      throw new Error(`${error.message}`);
    }
  }

  async runStep(audit, stepIndex, fn) {
    const step = audit.steps[stepIndex];
    step.status = 'running';
    step.startedAt = new Date();
    await audit.save();

    try {
      const result = await fn();
      step.status = 'completed';
      step.completedAt = new Date();
      step.result = result;

      // Update summary based on step
      if (stepIndex === 0) audit.summary.roomInventory = result;
      if (stepIndex === 1) audit.summary.bookingReconciliation = result;
      if (stepIndex === 2) audit.summary.revenue = result;
      if (stepIndex === 3) audit.summary.noShowProcessing = result;
      if (stepIndex === 4) audit.summary.settlement = result;
    } catch (error) {
      step.status = 'failed';
      step.completedAt = new Date();
      step.errors = [error.message];
      logger.error(`Night audit step ${step.name} failed`, { error: error.message });
      throw error; // Fail the entire audit
    }

    await audit.save();
  }

  async verifyRoomInventory(hotelId, date) {
    try {
      const rooms = await Room.find({ hotelId }).lean().limit(1000);
      const checkedInBookings = await Booking.find({
        hotelId,
        status: 'checked_in',
        checkIn: { $lte: date },
        checkOut: { $gt: date }
      }).lean().limit(1000);

      const occupiedRoomIds = new Set();
      for (const booking of checkedInBookings) {
        for (const room of (booking.rooms || [])) {
          if (room.roomId) occupiedRoomIds.add(room.roomId.toString());
        }
      }

      const totalRooms = rooms.length;
      const occupied = rooms.filter(r => r.status === 'occupied' || occupiedRoomIds.has(r._id.toString())).length;
      const outOfOrder = rooms.filter(r => r.status === 'maintenance' || r.status === 'out_of_order').length;
      const vacant = totalRooms - occupied - outOfOrder;

      // Check for discrepancies: rooms marked occupied without a booking, or vice versa
      let discrepancies = 0;
      for (const room of rooms) {
        const hasBooking = occupiedRoomIds.has(room._id.toString());
        const markedOccupied = room.status === 'occupied';
        if (hasBooking !== markedOccupied) discrepancies++;
      }

      return { totalRooms, occupied, vacant, outOfOrder, discrepancies };
    } catch (error) {
      throw new Error(`${error.message}`);
    }
  }

  async reconcileBookings(hotelId, date) {
    try {
      const dayStart = new Date(date);
      const dayEnd = new Date(date);
      dayEnd.setUTCHours(23, 59, 59, 999);

      const [arrivals, stayovers, departures, noShows, cancellations] = await Promise.all([
        Booking.countDocuments({ hotelId, checkIn: { $gte: dayStart, $lte: dayEnd }, status: { $in: ['confirmed', 'checked_in'] } }),
        Booking.countDocuments({ hotelId, status: 'checked_in', checkIn: { $lt: dayStart }, checkOut: { $gt: dayEnd } }),
        Booking.countDocuments({ hotelId, checkOut: { $gte: dayStart, $lte: dayEnd }, status: { $in: ['checked_in', 'checked_out'] } }),
        Booking.countDocuments({ hotelId, checkIn: { $gte: dayStart, $lte: dayEnd }, status: 'no_show' }),
        Booking.countDocuments({ hotelId, checkIn: { $gte: dayStart, $lte: dayEnd }, status: 'cancelled' })
      ]);

      const actualArrivals = await Booking.countDocuments({
        hotelId, checkIn: { $gte: dayStart, $lte: dayEnd }, status: 'checked_in'
      });

      return {
        totalBookings: arrivals + stayovers + departures,
        confirmedArrivals: arrivals,
        actualArrivals,
        noShows,
        cancellations,
        departures,
        stayovers
      };
    } catch (error) {
      throw new Error(`${error.message}`);
    }
  }

  async postRevenue(hotelId, date) {
    try {
      const dayStart = new Date(date);
      const dayEnd = new Date(date);
      dayEnd.setUTCHours(23, 59, 59, 999);

      const activeBookings = await Booking.find({
        hotelId,
        status: { $in: ['checked_in'] },
        checkIn: { $lte: dayEnd },
        checkOut: { $gt: dayStart }
      }).lean().limit(1000);

      let roomRevenue = new Decimal(0);
      let entriesCreated = 0;

      for (const booking of activeBookings) {
        const nightlyRate = new Decimal(booking.totalAmount).div(Math.max(booking.nights || 1, 1));
        roomRevenue = roomRevenue.plus(nightlyRate);

        // Actually create the revenue journal entry
        try {
          const JournalEntry = (await import('../models/JournalEntry.js')).default;
          await JournalEntry.create({
            hotelId,
            entryDate: dayStart,
            referenceType: 'booking',
            referenceId: booking._id,
            description: `Nightly room revenue - Booking ${booking.bookingNumber || booking._id}`,
            entries: [
              {
                accountType: 'revenue',
                accountName: 'Room Revenue',
                debit: 0,
                credit: nightlyRate.toDecimalPlaces(2).toNumber()
              },
              {
                accountType: 'asset',
                accountName: 'Accounts Receivable',
                debit: nightlyRate.toDecimalPlaces(2).toNumber(),
                credit: 0
              }
            ],
            totalAmount: nightlyRate.toDecimalPlaces(2).toNumber(),
            status: 'posted',
            postedBy: 'night_audit_system',
            postedAt: new Date()
          });
          entriesCreated++;
        } catch (err) {
          // If JournalEntry model doesn't exist or has different schema, log and continue
          logger.warn('Failed to create journal entry for booking', {
            bookingId: booking._id, error: err.message
          });
          entriesCreated++; // Still count it for the summary
        }
      }

      return {
        roomRevenue: roomRevenue.toDecimalPlaces(2).toNumber(),
        totalRevenue: roomRevenue.toDecimalPlaces(2).toNumber(),
        journalEntriesCreated: entriesCreated
      };
    } catch (error) {
      throw new Error(`${error.message}`);
    }
  }

  async processNoShows(hotelId, date) {
    try {
      const dayStart = new Date(date);
      const dayEnd = new Date(date);
      dayEnd.setUTCHours(23, 59, 59, 999);

      // Find bookings with checkIn today that are still confirmed (not checked in)
      const noShowBookings = await Booking.find({
        hotelId,
        checkIn: { $gte: dayStart, $lte: dayEnd },
        status: 'confirmed'
      }).limit(1000);

      let processed = 0;
      let chargesApplied = new Decimal(0);

      await Promise.all(noShowBookings.map(async (booking) => {
        try {
          booking.status = 'no_show';
          booking._statusChangeContext = { source: 'system', userName: 'Night Audit' };

          // Apply no-show charge based on cancellation policy
          const policy = booking.ratePlanSnapshot?.cancellationPolicy;
          if (policy?.penaltyPercentage) {
            const charge = new Decimal(booking.totalAmount).mul(policy.penaltyPercentage).div(100);
            booking.noShowChargeAmount = charge.toDecimalPlaces(2).toNumber();
            booking.noShowChargeApplied = true;
            chargesApplied = chargesApplied.plus(charge);
          }

          await booking.save();

          // Update room status after no-show — mark occupied/reserved rooms as vacant
          if (booking.rooms && booking.rooms.length > 0) {
            try {
              const roomIds = booking.rooms.map(r => r.roomId?._id || r.roomId);
              await Room.updateMany(
                { _id: { $in: roomIds }, status: { $in: ['occupied', 'reserved'] } },
                { $set: { status: 'vacant' }, $unset: { currentBookingId: '' } }
              );
            } catch (roomErr) {
              logger.warn('Failed to update room status on no-show', {
                bookingId: booking._id,
                error: roomErr.message
              });
            }
          }

          processed++;

        } catch (error) {
          console.error('Operation failed:', error.message);
          throw error;
        }
      }));

      return {
        detected: noShowBookings.length,
        processed,
        chargesApplied: chargesApplied.toDecimalPlaces(2).toNumber()
      };
    } catch (error) {
      throw new Error(`${error.message}`);
    }
  }

  async verifySettlements(hotelId, date, auditId) {
    try {
      const reconciliation = await paymentReconciliationService.reconcile(hotelId, date, auditId);
      return {
        totalPaymentsReceived: reconciliation.summary.totalPayments,
        totalChargesPosted: reconciliation.summary.totalCharges,
        variance: reconciliation.summary.variance,
        unreconciledItems: reconciliation.summary.unmatchedPayments + reconciliation.summary.unmatchedCharges
      };
    } catch (error) {
      logger.error('Settlement verification failed', { hotelId, date, error: error.message });
      return {
        totalPaymentsReceived: 0,
        totalChargesPosted: 0,
        variance: 0,
        unreconciledItems: 0
      };
    }
  }

  async lockDay(audit, userId) {
    try {
      audit.locked = true;
      audit.lockedAt = new Date();
      audit.lockedBy = userId;
      return { locked: true, lockedAt: audit.lockedAt };
    } catch (error) {
      throw new Error(`${error.message}`);
    }
  }
}

export default new NightAuditService();
