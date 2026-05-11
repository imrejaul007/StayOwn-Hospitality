/**
 * Google Hotel Ads Routes
 *
 * Endpoints:
 * - GET  /feeds/hotels.xml  - Product feed for Google crawler
 * - POST /webhooks/google-hotel-ads/click      - Click tracking
 * - POST /webhooks/google-hotel-ads/conversion  - Conversion tracking
 * - GET  /api/google-hotel-ads/inline           - Inline data for dynamic listings
 */

import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { googleHotelAdsService } from '../services/google-hotel-ads';

const router = Router();

const WEBHOOK_SECRET = process.env.GOOGLE_HOTEL_ADS_WEBHOOK_SECRET || process.env.WEBHOOK_SECRET || 'dev-webhook-secret';

/**
 * Verify HMAC signature from Google
 */
function verifySignature(payload: string, signature: string | undefined): boolean {
  if (!WEBHOOK_SECRET || WEBHOOK_SECRET === 'dev-webhook-secret') {
    // Development mode - skip verification
    console.warn('[GoogleHotelAds] Running in dev mode - skipping signature verification');
    return true;
  }

  if (!signature) {
    return false;
  }

  const expectedSignature = crypto
    .createHmac('sha256', WEBHOOK_SECRET)
    .update(payload)
    .digest('hex');

  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  } catch {
    return false;
  }
}

/**
 * GET /hotels.xml
 *
 * Product feed for Google Hotel Ads
 * Google crawls this to index our hotels
 * Mounted at /feeds/hotels.xml via index.ts
 */
router.get('/hotels.xml', async (_req: Request, res: Response) => {
  try {
    const xml = await googleHotelAdsService.generateProductFeed();

    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour
    res.send(xml);
  } catch (error: any) {
    console.error('[GoogleHotelAds] Feed generation error:', error);
    res.status(500).send('Error generating product feed');
  }
});

/**
 * GET /api/google-hotel-ads/inline
 *
 * Returns inline structured data for Google Hotel Ads
 * Used for dynamic hotel listings
 */
router.get('/inline', async (_req: Request, res: Response) => {
  try {
    const data = await googleHotelAdsService.generateInlineData();

    res.json({
      success: true,
      data
    });
  } catch (error: any) {
    console.error('[GoogleHotelAds] Inline data error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate inline data'
    });
  }
});

/**
 * POST /api/webhooks/google-hotel-ads/click
 *
 * Click tracking webhook from Google
 * Called when user clicks on our hotel listing in Google
 *
 * Body:
 * {
 *   hotel_id: string,
 *   gclid: string,
 *   user_id?: string,
 *   check_in?: string,
 *   check_out?: string,
 *   guests: number
 * }
 */
router.post('/click', async (req: Request, res: Response) => {
  try {
    // Verify signature if provided
    const signature = req.headers['x-googlesignature'] as string | undefined;
    const rawBody = JSON.stringify(req.body);

    if (!verifySignature(rawBody, signature)) {
      console.warn('[GoogleHotelAds] Invalid click webhook signature');
      return res.status(401).json({ success: false, error: 'Invalid signature' });
    }

    const { hotel_id, gclid, user_id, check_in, check_out, guests } = req.body;

    // Validate required fields
    if (!hotel_id || !gclid || guests === undefined) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: hotel_id, gclid, guests'
      });
    }

    await googleHotelAdsService.trackClick({
      hotel_id,
      gclid,
      user_id,
      check_in,
      check_out,
      guests
    });

    res.json({ success: true });
  } catch (error: any) {
    console.error('[GoogleHotelAds] Click webhook error:', error);
    res.status(500).json({ success: false, error: 'Webhook processing failed' });
  }
});

/**
 * POST /api/webhooks/google-hotel-ads/conversion
 *
 * Conversion tracking webhook from Google
 * Called when user completes a booking after clicking our ad
 *
 * Body:
 * {
 *   hotel_id: string,
 *   gclid: string,
 *   booking_id: string,
 *   value: number,
 *   currency: string
 * }
 */
router.post('/conversion', async (req: Request, res: Response) => {
  try {
    // Verify signature if provided
    const signature = req.headers['x-googlesignature'] as string | undefined;
    const rawBody = JSON.stringify(req.body);

    if (!verifySignature(rawBody, signature)) {
      console.warn('[GoogleHotelAds] Invalid conversion webhook signature');
      return res.status(401).json({ success: false, error: 'Invalid signature' });
    }

    const { hotel_id, gclid, booking_id, value, currency } = req.body;

    // Validate required fields
    if (!hotel_id || !gclid || !booking_id || value === undefined || !currency) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: hotel_id, gclid, booking_id, value, currency'
      });
    }

    await googleHotelAdsService.trackConversion({
      hotel_id,
      gclid,
      booking_id,
      value,
      currency
    });

    res.json({ success: true });
  } catch (error: any) {
    console.error('[GoogleHotelAds] Conversion webhook error:', error);
    res.status(500).json({ success: false, error: 'Webhook processing failed' });
  }
});

export default router;
