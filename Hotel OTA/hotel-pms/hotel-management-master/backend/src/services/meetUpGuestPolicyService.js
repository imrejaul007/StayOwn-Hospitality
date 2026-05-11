import HotelSettings from '../models/HotelSettings.js';
import User from '../models/User.js';
import { ApplicationError } from '../middleware/errorHandler.js';
import { createAndDeliverInApp } from './inAppNotificationDeliveryService.js';
import websocketService from './websocketService.js';
import logger from '../utils/logger.js';
import emailService from './emailService.js';

const MEETUP_NOTIFY_TTL_MS = 14 * 24 * 60 * 60 * 1000;

export function guestMeetUpsAppBaseUrl() {
  const u = process.env.GUEST_APP_URL || process.env.FRONTEND_URL || 'http://localhost:5173';
  return u.replace(/\/$/, '');
}

export function shouldApplyGuestMeetUpFeatureGate(role) {
  return role === 'guest' || role === 'travel_agent';
}

/**
 * When false in HotelSettings, guests cannot create or mutate meet-ups (reads still allowed).
 */
export async function assertGuestMeetUpsEnabled(hotelId) {
  if (!hotelId) return;
  const settings = await HotelSettings.findOne({ hotelId }).select('guestExperience').lean();
  if (settings?.guestExperience?.meetUpsEnabled === false) {
    throw new ApplicationError(
      'Guest meet-ups are disabled for this property.',
      403,
      'MEETUPS_DISABLED'
    );
  }
}

export async function maybeAssertGuestMeetUpsEnabled(req, hotelId) {
  if (!shouldApplyGuestMeetUpFeatureGate(req.user.role)) return;
  await assertGuestMeetUpsEnabled(hotelId);
}

/**
 * In-app notification + optional email + realtime refresh for meet-up participants.
 */
export async function deliverMeetUpGuestNotification({
  hotelId,
  recipientId,
  type,
  title,
  message,
  meetUpRequestId
}) {
  const rid = recipientId?.toString?.() || String(recipientId || '');
  if (!rid || rid === 'undefined') return;

  const base = guestMeetUpsAppBaseUrl();
  const actionUrl = `${base}/app/meet-ups`;

  try {
    await createAndDeliverInApp({
      userId: rid,
      hotelId,
      type,
      title: (title || 'Meet-up').slice(0, 100),
      message: (message || '').slice(0, 500),
      priority: 'medium',
      metadata: {
        category: 'guest_social',
        tags: ['meetup'],
        meetUpRequestId,
        actionUrl,
        actionText: 'Open meet-ups'
      },
      expiresAt: new Date(Date.now() + MEETUP_NOTIFY_TTL_MS)
    });
  } catch (e) {
    logger.warn('meet-up notification persist failed', { error: e.message, rid, type });
  }

  logger.info('meetup.notify', {
    channel: 'in_app',
    type,
    recipientId: rid,
    hotelId: String(hotelId),
    meetUpRequestId: meetUpRequestId ? String(meetUpRequestId) : undefined
  });

  try {
    const settings = await HotelSettings.findOne({ hotelId }).select('guestExperience').lean();
    if (settings?.guestExperience?.meetUpsEmailNotify === false) {
      // skip email
    } else {
      const recipient = await User.findById(rid).select('email name').lean();
      if (recipient?.email) {
        const safeText = `${message || ''}\n\nView meet-ups: ${actionUrl}`;
        const html = `
          <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;padding:16px">
            <h2 style="font-size:18px;margin:0 0 12px">${(title || 'Meet-up').replace(/</g, '&lt;')}</h2>
            <p style="color:#333;line-height:1.5">${(message || '').replace(/</g, '&lt;').replace(/\n/g, '<br/>')}</p>
            <p style="margin-top:20px"><a href="${actionUrl}" style="color:#2563eb">Open guest meet-ups</a></p>
          </div>`;
        const mail = await emailService.sendEmail({
          to: recipient.email,
          subject: (title || 'Meet-up update').slice(0, 200),
          text: safeText,
          html
        });
        if (mail.success) {
          logger.info('meetup.notify', {
            channel: 'email',
            type,
            recipientId: rid,
            hotelId: String(hotelId)
          });
        }
      }
    }
  } catch (e) {
    logger.warn('meet-up email failed', { error: e.message, rid, type });
  }

  try {
    await websocketService.sendToUser(rid, 'meetup:updated', {
      meetUpRequestId: meetUpRequestId?.toString?.() || String(meetUpRequestId),
      type
    });
  } catch (e) {
    logger.warn('meet-up websocket emit failed', { error: e.message, rid });
  }
}

export async function broadcastMeetUpUpdate(userIds, payload) {
  const ids = [...new Set((userIds || []).map((u) => (u && u.toString ? u.toString() : String(u))).filter(Boolean))];
  await Promise.all(
    ids.map((uid) =>
      websocketService.sendToUser(uid, 'meetup:updated', payload).catch((err) => {
        logger.warn('meetup:updated emit failed', { uid, error: err.message });
      })
    )
  );
}
