/**
 * REZ OTA Connector
 *
 * Bridges the Hotel PMS with the Hotel OTA platform and REZ ecosystem.
 *
 * Responsibilities:
 * 1. Push OTA booking confirmations into PMS as native reservations
 * 2. Push inventory / rate changes from PMS to Hotel OTA
 * 3. Award hotel brand coins via Hotel OTA on PMS checkout
 * 4. Verify REZ tokens for PMS SSO (same flow as Hotel OTA)
 */

import axios from 'axios';
import crypto from 'crypto';
import logger from '../utils/logger.js';

const OTA_API_URL    = process.env.REZ_OTA_API_URL    || '';
const OTA_TOKEN      = process.env.REZ_OTA_INTERNAL_TOKEN || '';
const REZ_AUTH_URL   = process.env.REZ_AUTH_SERVICE_URL   || '';
const INTERNAL_TOKEN = process.env.INTERNAL_SERVICE_TOKEN  || '';

const HTTP_TIMEOUT = 8000;

// ── Startup env check ─────────────────────────────────────────────────────────
// Warn early so missing vars are visible in logs at boot rather than only at
// the moment a webhook or API call fails.
const REQUIRED_VARS = [
  ['REZ_OTA_API_URL',          OTA_API_URL,    'push inventory + coin awards to Hotel OTA'],
  ['REZ_OTA_INTERNAL_TOKEN',   OTA_TOKEN,      'service-to-service auth for OTA partner API'],
  ['REZ_OTA_WEBHOOK_SECRET',   process.env.REZ_OTA_WEBHOOK_SECRET || '', 'verify inbound booking webhooks from Hotel OTA'],
  ['REZ_AUTH_SERVICE_URL',     REZ_AUTH_URL,   'REZ SSO token validation'],
  ['INTERNAL_SERVICE_TOKEN',   INTERNAL_TOKEN, 'internal auth for REZ user profile fetch'],
];
for (const [name, value, purpose] of REQUIRED_VARS) {
  if (!value) {
    logger.warn(`[RezOtaConnector] ⚠ ${name} is not set — ${purpose} will be disabled`);
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function otaHeaders() {
  return {
    'x-internal-token': OTA_TOKEN,
    'Content-Type': 'application/json',
  };
}

function signPayload(payload, secret) {
  return crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(payload))
    .digest('hex');
}

// ── 1. Push OTA booking confirmed → PMS ──────────────────────────────────────
//   Called by the PMS webhook route when Hotel OTA fires booking_confirmed.

export async function handleOtaBookingConfirmed(data) {
  const {
    bookingId, bookingRef, hotelId, userId,
    checkinDate, checkoutDate, numRooms, numGuests,
    guestName, guestPhone, totalValuePaise, pgAmountPaise,
    otaCoinBurnedPaise, rezCoinBurnedPaise, hotelBrandCoinBurnedPaise,
  } = data;

  // Import Booking model lazily to avoid circular deps
  const { default: Booking } = await import('../models/Booking.js');
  const { default: Hotel }   = await import('../models/Hotel.js');

  // Find matching hotel (by rezOtaHotelId stored on Hotel document)
  const hotel = await Hotel.findOne({ 'otaConnections.rezOta.hotelId': hotelId });
  if (!hotel) {
    logger.warn('[RezOta] No PMS hotel matched for OTA hotelId:', hotelId);
    return null;
  }

  const totalAmountRupees = totalValuePaise / 100;
  const checkIn  = new Date(checkinDate);
  const checkOut = new Date(checkoutDate);
  const nights   = Math.round((checkOut - checkIn) / (1000 * 60 * 60 * 24));

  // Resolve PMS userId: try to find existing user by phone, otherwise use hotel's OTA system user
  const { default: User } = await import('../models/User.js');
  let pmsUser = null;
  if (guestPhone) {
    pmsUser = await User.findOne({ hotel: hotel._id, $or: [{ phone: guestPhone }, { otaUserId: userId }] }).lean();
  }
  if (!pmsUser) {
    // Fallback: use a system/guest account for OTA-sourced bookings
    pmsUser = await User.findOne({ hotel: hotel._id, role: 'guest' }).lean()
      || await User.findOne({ hotel: hotel._id, role: 'admin' }).lean();
  }
  if (!pmsUser) {
    logger.warn('[RezOta] No PMS user found for OTA booking, cannot create Booking record:', bookingId);
    return null;
  }

  // FIX PMS-HIGH-001: Atomic upsert — prevents race condition where concurrent webhooks
  // could create duplicate bookings. Uses findOneAndUpdate with upsert:true instead of
  // check-then-create pattern. The unique index on channelBookingId ensures idempotency.
  const bookingData = {
    hotelId: hotel._id,
    userId: pmsUser._id,
    source: 'ota',          // String enum: 'ota'
    channelBookingId: bookingId,
    channelReservationId: bookingRef,
    checkIn,
    checkOut,
    nights,
    status: 'confirmed',
    paymentStatus: 'paid',
    guestDetails: {
      adults: numGuests || 1,
      specialRequests: guestName ? `OTA Guest: ${guestName}${guestPhone ? ` | ${guestPhone}` : ''}` : '',
    },
    totalAmount: totalAmountRupees,
    currency: 'INR',
    channelData: {
      channelCommission: 0,
      channelRate: totalAmountRupees,
      channelCurrency: 'INR',
      // Store OTA-specific fields in marketingSource as a JSON string (channelData has no coin fields)
      marketingSource: JSON.stringify({ otaCoinBurnedPaise, rezCoinBurnedPaise, hotelBrandCoinBurnedPaise, pgAmountPaise, otaUserId: userId }),
    },
  };

  const booking = await Booking.findOneAndUpdate(
    { channelBookingId: bookingId },
    { $setOnInsert: bookingData },
    { upsert: true, new: true }
  );

  if (booking.createdAt === booking.updatedAt) {
    logger.info('[RezOta] Booking created in PMS from OTA:', booking._id, '←', bookingId);
  } else {
    logger.info('[RezOta] Booking already exists in PMS, skipping duplicate:', bookingId);
  }
  return booking;
}

// ── 2. Push OTA booking cancelled → PMS ──────────────────────────────────────

export async function handleOtaBookingCancelled(data) {
  const { bookingId } = data;
  const { default: Booking } = await import('../models/Booking.js');
  const { default: Room }    = await import('../models/Room.js');

  const booking = await Booking.findOneAndUpdate(
    { channelBookingId: bookingId },
    { $set: { status: 'cancelled', updatedAt: new Date() } },
    { new: true }
  );

  if (booking) {
    logger.info('[RezOta] PMS booking cancelled via OTA webhook:', booking._id);

    // Release room inventory so rooms become available again
    if (booking.rooms && booking.rooms.length > 0) {
      const roomIds = booking.rooms.map(r => r.roomId?._id || r.roomId).filter(Boolean);
      if (roomIds.length > 0) {
        await Room.updateMany(
          { _id: { $in: roomIds }, status: { $in: ['occupied', 'reserved'] } },
          { $set: { status: 'vacant' }, $unset: { currentBookingId: '' } }
        );
        logger.info('[RezOta] Released', roomIds.length, 'room(s) for cancelled OTA booking:', bookingId);
      }
    }
  } else {
    logger.warn('[RezOta] Cancel webhook: no matching PMS booking for OTA id:', bookingId);
  }

  return booking;
}

// ── 3. Push PMS inventory update → Hotel OTA ─────────────────────────────────
//   Call this when hotel staff changes room availability or rates in PMS.

export async function pushInventoryToOta({ otaHotelId, roomTypeId, date, availableRooms, ratePaise }) {
  if (!OTA_API_URL || !OTA_TOKEN) {
    logger.warn('[RezOta] pushInventoryToOta: OTA env vars not set, skipping');
    return null;
  }

  try {
    const resp = await axios.put(
      `${OTA_API_URL}/v1/partner/pms/inventory/${otaHotelId}/${roomTypeId}/${date}`,
      { available_rooms: availableRooms, rate_paise: ratePaise },
      { headers: otaHeaders(), timeout: HTTP_TIMEOUT }
    );
    logger.info('[RezOta] Inventory pushed to OTA:', { otaHotelId, roomTypeId, date });
    return resp.data;
  } catch (err) {
    logger.error('[RezOta] Inventory push failed:', err.message);
    return null;
  }
}

// ── 4. Award hotel brand coins on PMS checkout ────────────────────────────────
//   Call this from PMS loyalty service when guest checks out.
//   Hotel OTA handles the actual coin credit so the balance shows in the wallet.

export async function awardBrandCoinsOnCheckout({ otaUserId, otaHotelId, bookingId, bookingValuePaise, earnRuleHint }) {
  if (!OTA_API_URL || !OTA_TOKEN) {
    logger.warn('[RezOta] awardBrandCoins: OTA env vars not set, skipping');
    return null;
  }

  try {
    const resp = await axios.post(
      `${OTA_API_URL}/v1/partner/pms/coins/earn`,
      {
        user_id: otaUserId,
        hotel_id: otaHotelId,
        booking_id: bookingId,
        booking_value_paise: bookingValuePaise,
        coin_type: 'hotel_brand',
        source: 'pms_checkout',
      },
      { headers: otaHeaders(), timeout: HTTP_TIMEOUT }
    );
    logger.info('[RezOta] Brand coins awarded via OTA:', resp.data);
    return resp.data;
  } catch (err) {
    logger.error('[RezOta] Brand coin award failed:', err.message);
    return null;
  }
}

// ── 5. REZ SSO for PMS ────────────────────────────────────────────────────────
//   Hotel staff can log in to PMS using a REZ token.
//   Mirrors the 2-step flow from Hotel OTA's rez-integration.service.ts.

export async function verifyRezTokenForPms(rezAccessToken) {
  if (!REZ_AUTH_URL || !INTERNAL_TOKEN) {
    throw new Error('REZ_AUTH_SERVICE_URL and INTERNAL_SERVICE_TOKEN must be configured');
  }

  // Step 1 — validate token (signature + expiry + blacklist)
  const validateResp = await axios.get(
    `${REZ_AUTH_URL}/auth/validate`,
    { headers: { Authorization: `Bearer ${rezAccessToken}` }, timeout: HTTP_TIMEOUT }
  );

  if (!validateResp.data.valid || !validateResp.data.userId) {
    throw new Error('Invalid or expired REZ token');
  }

  const rezUserId = validateResp.data.userId;

  // Step 2 — fetch user profile via internal API
  const profileResp = await axios.get(
    `${REZ_AUTH_URL}/internal/auth/user/${rezUserId}`,
    { headers: { 'x-internal-token': INTERNAL_TOKEN }, timeout: HTTP_TIMEOUT }
  );

  if (!profileResp.data.success || !profileResp.data.data) {
    throw new Error('Failed to fetch REZ user profile');
  }

  const userData = profileResp.data.data;
  const rawPhone = (userData.phone || userData.phoneNumber || '');
  const digits   = rawPhone.replace(/\D/g, '');
  const phone    = digits.length === 12 && digits.startsWith('91') ? digits.slice(2) : digits.slice(-10);

  return { rezUserId, phone, name: userData.name, role: userData.role };
}

// ── 6. Verify incoming webhook from Hotel OTA ─────────────────────────────────

export function verifyOtaWebhookSignature(payload, signature) {
  const secret = process.env.REZ_OTA_WEBHOOK_SECRET || '';
  if (!secret) return false; // REZ_OTA_WEBHOOK_SECRET not set — reject all unsigned webhooks
  const expected = signPayload(payload, secret);
  try {
    const expectedBuf = Buffer.from(expected);
    const sigBuf = Buffer.from(signature || '');
    // timingSafeEqual requires identical buffer lengths — mismatched = bad signature
    if (expectedBuf.length !== sigBuf.length) return false;
    return crypto.timingSafeEqual(expectedBuf, sigBuf);
  } catch {
    return false;
  }
}
