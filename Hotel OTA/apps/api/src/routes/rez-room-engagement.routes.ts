import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import axios from 'axios';
import { prisma } from '../config/database';
import { env } from '../config/env';
import { logger } from '../config/logger';

const router = Router();

// REZ webhook secret for verification
const REZ_WEBHOOK_SECRET = process.env.REZ_ROOM_ENGAGEMENT_SECRET || process.env.REZ_OTA_WEBHOOK_SECRET || 'dev-secret';

/**
 * Verify HMAC-SHA256 signature
 */
function verifySignature(payload: string, signature: string): boolean {
  const expectedSig = crypto
    .createHmac('sha256', REZ_WEBHOOK_SECRET)
    .update(payload)
    .digest('hex');
  return crypto.timingSafeEqual(
    Buffer.from(signature, 'hex'),
    Buffer.from(expectedSig, 'hex')
  );
}

/**
 * REZ Room Engagement Webhook
 * Called when a guest scans a room QR code and engages with services
 *
 * Events:
 * - room_engaged: Guest scanned room QR
 * - service_requested: Guest made a service request
 * - order_placed: Guest placed a room service order
 */
router.post('/webhook', async (req: Request, res: Response) => {
  try {
    const signature = req.headers['x-rez-signature'] as string;
    const timestamp = req.headers['x-rez-timestamp'] as string;

    // Validate timestamp (5 min tolerance)
    if (timestamp) {
      const requestTime = parseInt(timestamp, 10);
      const now = Math.floor(Date.now() / 1000);
      if (Math.abs(now - requestTime) > 300) {
        return res.status(401).json({
          success: false,
          message: 'Request timestamp expired'
        });
      }
    }

    // Verify signature
    if (signature) {
      const rawBody = JSON.stringify(req.body);
      if (!verifySignature(rawBody, signature)) {
        return res.status(401).json({
          success: false,
          message: 'Invalid signature'
        });
      }
    }

    const { event, data } = req.body;

    switch (event) {
      case 'room_engaged':
        await handleRoomEngaged(data);
        break;
      case 'service_requested':
        await handleServiceRequested(data);
        break;
      case 'order_placed':
        await handleOrderPlaced(data);
        break;
      default:
        logger.warn('Unknown REZ room engagement event', { event });
    }

    res.json({ success: true, message: 'Event processed' });
  } catch (error: any) {
    logger.error('REZ room engagement webhook error', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Webhook processing failed'
    });
  }
});

/**
 * Handle room_engaged event
 * Award bonus coins for scanning room QR
 */
async function handleRoomEngaged(data: {
  rezUserId: string;
  otaUserId: string;
  bookingId: string;
  hotelId: string;
  roomId: string;
  roomNumber: string;
  timestamp: string;
}) {
  logger.info('Room engagement event', {
    rezUserId: data.rezUserId,
    roomNumber: data.roomNumber
  });

  // Record engagement in database
  await prisma.roomEngagement.create({
    data: {
      rezUserId: data.rezUserId,
      otaUserId: data.otaUserId,
      bookingId: data.bookingId,
      hotelId: data.hotelId,
      roomId: data.roomId,
      roomNumber: data.roomNumber,
      engagementType: 'qr_scan',
      engagedAt: new Date(data.timestamp)
    }
  });

  // TODO: Send event to REZ backend to award engagement bonus
  // This would call REZ's travel-webhook or a new engagement-webhook endpoint
}

/**
 * Handle service_requested event
 * Track service usage and award coins
 */
async function handleServiceRequested(data: {
  rezUserId: string;
  otaUserId: string;
  bookingId: string;
  hotelId: string;
  roomId: string;
  roomNumber: string;
  serviceType: string;
  timestamp: string;
}) {
  logger.info('Service requested event', {
    rezUserId: data.rezUserId,
    serviceType: data.serviceType
  });

  // Record service request
  await prisma.roomEngagement.create({
    data: {
      rezUserId: data.rezUserId,
      otaUserId: data.otaUserId,
      bookingId: data.bookingId,
      hotelId: data.hotelId,
      roomId: data.roomId,
      roomNumber: data.roomNumber || 'Unknown',
      engagementType: 'service_request',
      metadata: { serviceType: data.serviceType },
      engagedAt: new Date(data.timestamp)
    }
  });
}

/**
 * Handle order_placed event
 * Track room service orders
 */
async function handleOrderPlaced(data: {
  rezUserId: string;
  otaUserId: string;
  bookingId: string;
  hotelId: string;
  roomId: string;
  roomNumber: string;
  orderValuePaise: number;
  items: Array<{ name: string; quantity: number; pricePaise: number }>;
  timestamp: string;
}) {
  logger.info('Order placed event', {
    rezUserId: data.rezUserId,
    orderValue: data.orderValuePaise
  });

  // Record order engagement
  await prisma.roomEngagement.create({
    data: {
      rezUserId: data.rezUserId,
      otaUserId: data.otaUserId,
      bookingId: data.bookingId,
      hotelId: data.hotelId,
      roomId: data.roomId,
      roomNumber: data.roomNumber || 'Unknown',
      engagementType: 'order',
      metadata: {
        orderValuePaise: data.orderValuePaise,
        items: data.items
      },
      engagedAt: new Date(data.timestamp)
    }
  });
}

/**
 * Sync room engagement to REZ backend
 * Called periodically or on checkout
 */
router.post('/sync', async (req: Request, res: Response) => {
  try {
    const { bookingId, hotelId } = req.body;

    if (!bookingId || !hotelId) {
      return res.status(400).json({
        success: false,
        message: 'bookingId and hotelId are required'
      });
    }

    // Get all engagements for this booking
    const engagements = await prisma.roomEngagement.findMany({
      where: { bookingId, hotelId }
    });

    // Get booking details
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        user: { select: { id: true } }
      }
    });

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    // Calculate engagement metrics
    const qrScans = engagements.filter(e => e.engagementType === 'qr_scan').length;
    const serviceRequests = engagements.filter(e => e.engagementType === 'service_request').length;
    const orders = engagements.filter(e => e.engagementType === 'order');
    const totalOrderValue = orders.reduce((sum, o) => sum + ((o.metadata as any)?.orderValuePaise || 0), 0);

    // Send to REZ backend
    const rezPayload = {
      event: 'room_engagement_summary',
      bookingId,
      rezUserId: booking.userId,
      hotelId,
      engagementMetrics: {
        qrScanCount: qrScans,
        serviceRequestCount: serviceRequests,
        orderCount: orders.length,
        totalOrderValuePaise: totalOrderValue
      },
      timestamp: new Date().toISOString()
    };

    try {
      await axios.post(`${env.REZ_API_BASE_URL}/api/travel-webhooks/room-engagement`, rezPayload, {
        headers: {
          'Content-Type': 'application/json',
          'x-internal-token': env.INTERNAL_SERVICE_TOKEN
        },
        timeout: 5000
      });
    } catch (error) {
      logger.warn('Failed to sync engagement to REZ', { error });
    }

    res.json({
      success: true,
      data: {
        bookingId,
        engagementMetrics: {
          qrScans,
          serviceRequests,
          orders: orders.length,
          totalOrderValue
        },
        syncedToRez: true
      }
    });
  } catch (error: any) {
    logger.error('Failed to sync room engagement', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to sync engagement'
    });
  }
});

export default router;
