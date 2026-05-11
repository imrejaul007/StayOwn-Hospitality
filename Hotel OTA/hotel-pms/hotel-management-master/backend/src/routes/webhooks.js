import express from 'express';
import Stripe from 'stripe';
import mongoose from 'mongoose';
import Booking from '../models/Booking.js';
import Payment from '../models/Payment.js';
import User from '../models/User.js';
import StripeWebhookEvent from '../models/StripeWebhookEvent.js';
import logger from '../utils/logger.js';
import bookingAuditService from '../services/bookingAuditService.js';
import invoiceLifecycleSyncService from '../services/invoiceLifecycleSyncService.js';
import { awardStayCompletionPoints } from '../services/loyaltyAwardService.js';
import { dashboardUpdateService } from '../services/dashboardUpdateService.js';
import websocketService from '../services/websocketService.js';
import emailService from '../services/emailService.js';

const router = express.Router();
const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;

/**
 * @swagger
 * /webhooks/stripe:
 *   post:
 *     summary: Stripe webhook handler
 *     tags: [Webhooks]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Webhook processed successfully
 */
router.post('/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
  if (!stripe) {
    logger.error('Stripe is not configured. Set STRIPE_SECRET_KEY.');
    return res.status(503).json({ error: 'Payment processing is not configured' });
  }
  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    logger.error('Stripe webhook secret is not configured. Set STRIPE_WEBHOOK_SECRET.');
    return res.status(503).json({ error: 'Webhook processing is not configured' });
  }

  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    logger.error('Stripe webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  logger.info('Stripe webhook received:', { type: event.type, id: event.id });

  try {
    const existingEvent = await StripeWebhookEvent.findOne({
      provider: 'stripe',
      eventId: event.id
    });

    if (existingEvent?.status === 'processed') {
      logger.info('Duplicate Stripe webhook ignored (already processed)', {
        id: event.id,
        type: event.type
      });
      return res.json({ received: true, duplicate: true });
    }

    if (existingEvent?.status === 'processing') {
      logger.info('Stripe webhook currently processing, acknowledging duplicate delivery', {
        id: event.id,
        type: event.type
      });
      return res.json({ received: true, duplicate: true });
    }

    if (existingEvent?.status === 'failed') {
      existingEvent.status = 'processing';
      existingEvent.attempts += 1;
      existingEvent.lastError = undefined;
      await existingEvent.save();
    } else if (!existingEvent) {
      await StripeWebhookEvent.create({
        provider: 'stripe',
        eventId: event.id,
        eventType: event.type,
        status: 'processing'
      });
    }

    switch (event.type) {
      case 'payment_intent.succeeded':
        await handlePaymentSuccess(event.data.object);
        break;

      case 'payment_intent.payment_failed':
        await handlePaymentFailed(event.data.object);
        break;

      case 'charge.refunded':
        await handleRefund(event.data.object);
        break;

      case 'payment_intent.canceled':
        await handlePaymentCanceled(event.data.object);
        break;

      default:
        logger.info(`Unhandled event type: ${event.type}`);
    }

    await StripeWebhookEvent.updateOne(
      { provider: 'stripe', eventId: event.id },
      {
        $set: {
          status: 'processed',
          processedAt: new Date(),
          eventType: event.type
        }
      }
    );

    res.json({ received: true });
  } catch (error) {
    await StripeWebhookEvent.updateOne(
      { provider: 'stripe', eventId: event.id },
      {
        $set: {
          status: 'failed',
          eventType: event.type,
          lastError: error?.message || 'Unknown webhook processing error'
        }
      },
      { upsert: true }
    );
    logger.error('Error processing Stripe webhook:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

async function handlePaymentSuccess(paymentIntent) {
  try {
    // Find and update payment record
    const payment = await Payment.findOneAndUpdate(
      { stripePaymentIntentId: paymentIntent.id },
      { 
        status: 'succeeded',
        processedAt: new Date()
      },
      { new: true }
    );

    if (payment) {
      // Update booking status
      const booking = await Booking.findByIdAndUpdate(
        payment.bookingId,
        {
          status: 'confirmed',
          paymentStatus: 'paid',
          stripePaymentId: paymentIntent.id
        },
        { new: true }
      );

      if (!booking) {
        logger.warn('Booking not found for payment update', {
          paymentId: payment._id,
          bookingId: payment.bookingId
        });
      } else {
        try {
          await invoiceLifecycleSyncService.syncBookingPaymentStatus({
            bookingId: booking._id,
            paymentStatus: 'paid',
            actorUserId: booking.userId
          });
        } catch (error) {
          invoiceLifecycleSyncService.logSyncFailure(
            { bookingId: booking._id, flow: 'stripe-webhook-payment-success' },
            error
          );
        }

        await bookingAuditService.logBookingMutation({
          booking,
          changeType: 'update',
          user: { _id: booking.userId, role: 'system', email: null },
          req: {
            originalUrl: '/api/v1/webhooks/stripe',
            headers: {},
            ip: 'stripe-webhook'
          },
          oldValues: {
            paymentStatus: 'pending'
          },
          newValues: bookingAuditService.buildSnapshot(booking),
          metadata: {
            priority: 'high',
            tags: ['stripe_webhook', 'payment_success'],
            paymentIntentId: paymentIntent.id
          }
        });

        // Loyalty award is idempotent and will only post when booking is checked out.
        await awardStayCompletionPoints(booking).catch((error) => {
          logger.warn('Webhook loyalty award skipped', {
            bookingId: booking._id,
            error: error.message
          });
        });
      }

      // Notify dashboards of payment update
      try {
        if (payment.bookingId) {
          const fullBooking = await Booking.findById(payment.bookingId).populate('hotelId').lean();
          if (fullBooking) {
            dashboardUpdateService.notifyPaymentUpdate(fullBooking, 'pending', 'succeeded', null);
            dashboardUpdateService.triggerDashboardRefresh(fullBooking.hotelId?._id || fullBooking.hotelId, 'payments');
            // Broadcast to hotel
            const hotelId = (fullBooking.hotelId?._id || fullBooking.hotelId)?.toString();
            if (hotelId) {
              websocketService.broadcastToHotel(hotelId, 'booking:payment_updated', {
                bookingId: fullBooking._id,
                paymentStatus: 'succeeded'
              });
            }
            // Notify the guest directly
            if (fullBooking.userId) {
              const guestId = fullBooking.userId._id?.toString() || fullBooking.userId.toString();
              websocketService.sendToUser(guestId, 'booking:payment_updated', {
                bookingId: fullBooking._id,
                paymentStatus: 'succeeded'
              });
            }
          }
        }
      } catch (notifErr) {
        logger.warn('Failed to notify dashboard of payment webhook:', notifErr.message);
      }

      // Send booking confirmation email to guest
      try {
        if (booking?.userId) {
          const guest = await User.findById(booking.userId).select('email name').lean();
          if (guest?.email) {
            const amount = (paymentIntent.amount / 100).toFixed(2);
            const currency = (paymentIntent.currency || 'INR').toUpperCase();
            await emailService.sendEmail({
              to: guest.email,
              subject: `Booking Confirmed — ${booking.bookingNumber || booking._id}`,
              html: `
                <h2>Your booking is confirmed!</h2>
                <p>Dear ${guest.name || 'Guest'},</p>
                <p>We're delighted to confirm your reservation.</p>
                <table style="border-collapse:collapse;width:100%;max-width:500px;">
                  <tr><td style="padding:8px;border:1px solid #ddd;"><strong>Booking ID</strong></td><td style="padding:8px;border:1px solid #ddd;">${booking.bookingNumber || booking._id}</td></tr>
                  <tr><td style="padding:8px;border:1px solid #ddd;"><strong>Check-in</strong></td><td style="padding:8px;border:1px solid #ddd;">${new Date(booking.checkIn).toLocaleDateString()}</td></tr>
                  <tr><td style="padding:8px;border:1px solid #ddd;"><strong>Check-out</strong></td><td style="padding:8px;border:1px solid #ddd;">${new Date(booking.checkOut).toLocaleDateString()}</td></tr>
                  <tr><td style="padding:8px;border:1px solid #ddd;"><strong>Amount Paid</strong></td><td style="padding:8px;border:1px solid #ddd;">${currency} ${amount}</td></tr>
                </table>
                <p style="margin-top:16px;">If you have any questions, please don't hesitate to contact us.</p>
              `
            });
            logger.info('Booking confirmation email sent', { bookingId: booking._id, email: guest.email });
          }
        }
      } catch (emailErr) {
        logger.warn('Failed to send booking confirmation email:', emailErr.message);
      }

      logger.info('Payment and booking updated successfully', {
        paymentId: payment._id,
        bookingId: booking?._id,
        amount: paymentIntent.amount / 100
      });
    } else {
      logger.warn('Payment record not found for successful payment intent:', paymentIntent.id);
    }
  } catch (error) {
    logger.error('Error handling payment success:', error);
    throw error;
  }
}

async function handlePaymentFailed(paymentIntent) {
  try {
    // Update payment record
    const payment = await Payment.findOneAndUpdate(
      { stripePaymentIntentId: paymentIntent.id },
      { 
        status: 'failed',
        failureReason: paymentIntent.last_payment_error?.message || 'Payment failed',
        processedAt: new Date()
      },
      { new: true }
    );

    if (payment) {
      // Update booking status
      const booking = await Booking.findByIdAndUpdate(payment.bookingId, {
        paymentStatus: 'failed'
      },
        { new: true }
      );

      // Notify guest of payment failure
      try {
        if (booking?.userId) {
          const guest = await User.findById(booking.userId).select('email name').lean();
          if (guest?.email) {
            const reason = paymentIntent.last_payment_error?.message || 'Your payment could not be processed.';
            await emailService.sendEmail({
              to: guest.email,
              subject: `Payment Failed — Booking ${booking.bookingNumber || booking._id}`,
              html: `
                <h2>Payment Failed</h2>
                <p>Dear ${guest.name || 'Guest'},</p>
                <p>Unfortunately, the payment for your booking <strong>${booking.bookingNumber || booking._id}</strong> could not be processed.</p>
                <p><strong>Reason:</strong> ${reason}</p>
                <p>Please try again or use a different payment method to complete your reservation.</p>
              `
            });
          }
        }
      } catch (emailErr) {
        logger.warn('Failed to send payment failure email:', emailErr.message);
      }

      logger.info('Payment failure processed', {
        paymentId: payment._id,
        bookingId: payment.bookingId,
        reason: paymentIntent.last_payment_error?.message
      });
    }
  } catch (error) {
    logger.error('Error handling payment failure:', error);
    throw error;
  }
}

async function handleRefund(charge) {
  try {
    // Find payment by charge ID (from payment intent)
    const payment = await Payment.findOne({
      stripePaymentIntentId: charge.payment_intent
    });

    if (payment) {
      // Update payment and booking atomically within a transaction
      const totalRefunded = charge.amount_refunded;
      const originalAmount = charge.amount;

      const newPaymentStatus = totalRefunded === originalAmount ? 'refunded' : 'partially_refunded';
      const bookingPaymentStatus = totalRefunded === originalAmount ? 'refunded' : 'partially_paid';

      let booking = null;
      const session = await mongoose.startSession();
      try {
        await session.withTransaction(async () => {
          // Update payment record
          payment.status = newPaymentStatus;
          payment.refundAmount = charge.amount_refunded / 100;
          payment.refundedAt = new Date();
          await payment.save({ session });

          // Update booking status
          if (payment.bookingId) {
            booking = await Booking.findByIdAndUpdate(
              payment.bookingId,
              { paymentStatus: bookingPaymentStatus },
              { new: true, session }
            );
          }
        });
      } finally {
        await session.endSession();
      }

      if (booking) {
        try {
          await invoiceLifecycleSyncService.syncInvoiceAfterRefund({
            bookingId: booking._id,
            refundAmount: totalRefunded / 100,
            reason: charge.reason || 'stripe_webhook_refund'
          });
        } catch (error) {
          invoiceLifecycleSyncService.logSyncFailure(
            { bookingId: booking._id, flow: 'stripe-webhook-refund' },
            error
          );
        }

        await bookingAuditService.logBookingMutation({
          booking,
          changeType: 'update',
          user: { _id: booking.userId, role: 'system', email: null },
          req: {
            originalUrl: '/api/v1/webhooks/stripe',
            headers: {},
            ip: 'stripe-webhook'
          },
          oldValues: {
            paymentStatus: 'paid'
          },
          newValues: bookingAuditService.buildSnapshot(booking),
          metadata: {
            priority: 'high',
            tags: ['stripe_webhook', 'refund'],
            paymentIntentId: charge.payment_intent,
            refundAmount: totalRefunded / 100
          }
        });
      }

      // Send refund confirmation email to guest
      try {
        if (booking?.userId) {
          const guest = await User.findById(booking.userId).select('email name').lean();
          if (guest?.email) {
            const refundAmount = (totalRefunded / 100).toFixed(2);
            const currency = (charge.currency || 'INR').toUpperCase();
            await emailService.sendEmail({
              to: guest.email,
              subject: `Refund Processed — Booking ${booking.bookingNumber || booking._id}`,
              html: `
                <h2>Refund Confirmation</h2>
                <p>Dear ${guest.name || 'Guest'},</p>
                <p>A refund of <strong>${currency} ${refundAmount}</strong> has been processed for booking <strong>${booking.bookingNumber || booking._id}</strong>.</p>
                <p>The refund should appear in your account within 5–10 business days depending on your payment provider.</p>
              `
            });
          }
        }
      } catch (emailErr) {
        logger.warn('Failed to send refund confirmation email:', emailErr.message);
      }

      // Notify dashboards of payment update
      try {
        if (payment.bookingId) {
          const updatedBooking = booking || await Booking.findById(payment.bookingId).lean();
          if (updatedBooking) {
            await dashboardUpdateService.notifyPaymentUpdate(
              updatedBooking,
              'paid',
              bookingPaymentStatus,
              { name: 'Stripe Webhook', _id: null }
            );
          }
        }
      } catch (err) {
        logger.warn('Failed to notify dashboard of webhook payment update:', err.message);
      }

      logger.info('Refund processed', {
        paymentId: payment._id,
        bookingId: payment.bookingId,
        refundAmount: totalRefunded / 100
      });
    }
  } catch (error) {
    logger.error('Error handling refund:', error);
    throw error;
  }
}

async function handlePaymentCanceled(paymentIntent) {
  try {
    // Update payment record
    const payment = await Payment.findOneAndUpdate(
      { stripePaymentIntentId: paymentIntent.id },
      { 
        status: 'canceled',
        processedAt: new Date()
      },
      { new: true }
    );

    if (payment) {
      // Update booking - set back to pending or cancel based on timing
      const booking = await Booking.findById(payment.bookingId);
      if (booking && booking.status === 'pending') {
        booking.paymentStatus = 'failed';
        await booking.save();
      }

      logger.info('Payment cancellation processed', {
        paymentId: payment._id,
        bookingId: payment.bookingId
      });
    }
  } catch (error) {
    logger.error('Error handling payment cancellation:', error);
    throw error;
  }
}

export default router;
