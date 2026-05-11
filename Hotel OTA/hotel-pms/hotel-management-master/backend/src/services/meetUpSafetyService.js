import GuestMeetUpBlock from '../models/GuestMeetUpBlock.js';
import MeetUpRequest from '../models/MeetUpRequest.js';
import { ApplicationError } from '../middleware/errorHandler.js';

/**
 * @param {string|import('mongoose').Types.ObjectId} hotelId
 * @param {string|import('mongoose').Types.ObjectId} userIdA
 * @param {string|import('mongoose').Types.ObjectId} userIdB
 */
export async function assertMeetUpNotBlocked(hotelId, userIdA, userIdB) {
  if (!hotelId || !userIdA || !userIdB) return;
  const a = String(userIdA);
  const b = String(userIdB);
  if (a === b) return;
  const hit = await GuestMeetUpBlock.exists({
    hotelId,
    $or: [
      { blockerUserId: a, blockedUserId: b },
      { blockerUserId: b, blockedUserId: a }
    ]
  });
  if (hit) {
    throw new ApplicationError(
      'You cannot invite or interact with this guest based on privacy settings.',
      403,
      'MEETUP_BLOCKED'
    );
  }
}

/**
 * User IDs blocked or blocking `userId` at this hotel (excluded from partner discovery).
 */
export async function getMeetUpBlockedPeerIds(hotelId, userId) {
  if (!hotelId || !userId) return [];
  const uid = String(userId);
  const rows = await GuestMeetUpBlock.find({
    hotelId,
    $or: [{ blockerUserId: uid }, { blockedUserId: uid }]
  })
    .select('blockerUserId blockedUserId')
    .lean();
  const out = new Set();
  for (const r of rows) {
    const b = String(r.blockerUserId);
    const d = String(r.blockedUserId);
    out.add(b === uid ? d : b);
  }
  return [...out];
}

export async function assertUnderPendingMeetUpCap(hotelId, requesterId, maxPending) {
  const cap = Number(maxPending);
  if (!hotelId || !requesterId || !cap || cap < 1) return;
  const n = await MeetUpRequest.countDocuments({
    hotelId,
    requesterId,
    status: 'pending'
  });
  if (n >= cap) {
    throw new ApplicationError(
      `You already have ${cap} pending meet-up invite(s). Cancel one or wait for a reply before sending more.`,
      400,
      'MEETUP_PENDING_CAP'
    );
  }
}

/**
 * @param {string} timezone — IANA e.g. Asia/Kolkata
 * @param {string|null|undefined} quietStart — HH:mm
 * @param {string|null|undefined} quietEnd — HH:mm
 */
export function isHotelInMeetUpQuietHours(timezone, quietStart, quietEnd) {
  if (!quietStart || !quietEnd || !String(quietStart).includes(':') || !String(quietEnd).includes(':')) {
    return false;
  }
  const tz = timezone && String(timezone).trim() ? String(timezone) : 'UTC';
  const nowMins = getZonedMinutesFromMidnight(tz, new Date());
  const start = parseHHMM(quietStart);
  const end = parseHHMM(quietEnd);
  if (start === end) return false;
  if (start > end) {
    return nowMins >= start || nowMins < end;
  }
  return nowMins >= start && nowMins < end;
}

function parseHHMM(s) {
  const [h, m] = String(s).split(':').map((x) => parseInt(x, 10));
  if (Number.isNaN(h)) return 0;
  return h * 60 + (Number.isNaN(m) ? 0 : m);
}

function getZonedMinutesFromMidnight(timeZone, date) {
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
  const parts = fmt.formatToParts(date);
  const hh = parseInt(parts.find((p) => p.type === 'hour')?.value || '0', 10);
  const mm = parseInt(parts.find((p) => p.type === 'minute')?.value || '0', 10);
  return hh * 60 + mm;
}

export async function assertNotInMeetUpQuietHours(hotelSettings) {
  const ge = hotelSettings?.guestExperience;
  if (!ge?.quietHoursStart || !ge?.quietHoursEnd) return;
  const tz = hotelSettings?.operations?.timezone || 'UTC';
  if (isHotelInMeetUpQuietHours(tz, ge.quietHoursStart, ge.quietHoursEnd)) {
    throw new ApplicationError(
      `New meet-up invites are paused during quiet hours (${ge.quietHoursStart}–${ge.quietHoursEnd} hotel time).`,
      400,
      'MEETUP_QUIET_HOURS'
    );
  }
}
