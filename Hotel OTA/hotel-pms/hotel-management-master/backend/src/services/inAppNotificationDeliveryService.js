import logger from '../utils/logger.js';
import Notification from '../models/Notification.js';
import User from '../models/User.js';
import mongoose from 'mongoose';
import websocketService from './websocketService.js';
import { notificationEmitter } from './notificationEmitter.js';

/** Operation roles that should receive hotel ops / dashboard alerts in-app */
export const HOTEL_OPS_ROLES = ['admin', 'manager', 'frontdesk'];

/**
 * All active staff tied to a property (for broad operational fan-out when needed).
 */
export async function getHotelOperationalUserIds(hotelId) {
  if (!hotelId) return [];
  const hid =
    hotelId instanceof mongoose.Types.ObjectId ? hotelId : new mongoose.Types.ObjectId(String(hotelId));
  const users = await User.find({
    hotelId: hid,
    role: { $in: HOTEL_OPS_ROLES },
    isActive: true
  })
    .select('_id')
    .lean()
    .limit(500);
  return users.map((u) => u._id);
}

function toPlain(doc) {
  if (!doc) return null;
  return doc.toObject ? doc.toObject() : { ...doc };
}

/**
 * Build payloads for SSE (flat) and Socket.IO guest UI ({ notification }).
 */
function buildPayloads(plain) {
  const id = plain._id?.toString?.() || String(plain._id || '');
  const userId = plain.userId?.toString?.() || String(plain.userId || '');
  const hotelId = plain.hotelId?.toString?.() || String(plain.hotelId || '');

  const ssePayload = {
    id,
    type: plain.type,
    title: plain.title,
    message: plain.message,
    priority: plain.priority,
    channels: plain.channels || ['in_app'],
    metadata: plain.metadata || {},
    createdAt: plain.createdAt || new Date()
  };

  const socketNotification = {
    _id: id,
    id,
    userId,
    hotelId,
    type: plain.type,
    title: plain.title,
    message: plain.message,
    priority: plain.priority || 'medium',
    status: plain.status || 'sent',
    channels: plain.channels || ['in_app'],
    metadata: plain.metadata || {},
    createdAt: plain.createdAt || new Date()
  };

  return { ssePayload, socketNotification, userId, id };
}

/**
 * After a Notification document exists, fan-out to SSE subscribers and Socket.IO (`notification:new`).
 * Safe to call multiple times for the same doc (idempotent from client perspective).
 */
export async function deliverInAppNotificationToUser(savedDoc) {
  const plain = toPlain(savedDoc);
  if (!plain) return false;

  const { ssePayload, socketNotification, userId } = buildPayloads(plain);
  if (!userId || userId === 'undefined') {
    logger.warn('deliverInAppNotificationToUser: missing userId', { type: plain.type });
    return false;
  }

  try {
    notificationEmitter.emit(`user:${userId}`, ssePayload);
  } catch (e) {
    logger.warn('notificationEmitter emit failed', { userId, error: e.message });
  }

  try {
    await websocketService.sendToUser(userId, 'notification:new', {
      notification: socketNotification
    });
  } catch (e) {
    logger.warn('websocket notification:new failed', { userId, error: e.message });
  }

  return true;
}

/**
 * Fan-out many notifications (e.g. after insertMany).
 */
export async function deliverInAppNotificationsBulk(docs) {
  if (!Array.isArray(docs) || docs.length === 0) return { delivered: 0 };
  let n = 0;
  for (const doc of docs) {
    if (await deliverInAppNotificationToUser(doc)) n++;
  }
  return { delivered: n };
}

/**
 * Create in-app row + deliver (guest / staff single recipient).
 */
export async function createAndDeliverInApp(fields) {
  const doc = await Notification.create({
    channels: ['in_app'],
    status: 'sent',
    sentAt: new Date(),
    priority: 'medium',
    ...fields
  });
  await deliverInAppNotificationToUser(doc);
  return doc;
}

/**
 * Same content to many operational users (admin / manager / frontdesk).
 */
export async function createAndDeliverToHotelOps(hotelId, baseFields) {
  const userIds = await getHotelOperationalUserIds(hotelId);
  if (userIds.length === 0) {
    logger.debug('createAndDeliverToHotelOps: no recipients', { hotelId: String(hotelId) });
    return [];
  }

  const hid =
    hotelId instanceof mongoose.Types.ObjectId ? hotelId : new mongoose.Types.ObjectId(String(hotelId));

  const rows = userIds.map((userId) => ({
    userId,
    hotelId: hid,
    channels: ['in_app'],
    status: 'sent',
    sentAt: new Date(),
    priority: 'medium',
    ...baseFields
  }));

  const created = await Notification.insertMany(rows);
  await deliverInAppNotificationsBulk(created);
  return created;
}

export default {
  HOTEL_OPS_ROLES,
  getHotelOperationalUserIds,
  deliverInAppNotificationToUser,
  deliverInAppNotificationsBulk,
  createAndDeliverInApp,
  createAndDeliverToHotelOps
};
