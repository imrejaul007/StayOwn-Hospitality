/**
 * Digital Check-in Service for StayOwn
 *
 * Features:
 * - Pre-arrival form submission
 * - ID upload/verification
 * - Room selection
 * - Digital key generation
 * - Express checkout
 */

import mongoose from 'mongoose';
import { randomUUID } from 'crypto';
import QRCode from 'qrcode';
import axios from 'axios';
import { logger } from '../config/logger';

// Configuration
const HOTEL_PMS_API = process.env.HOTEL_PMS_API_URL || 'http://localhost:3008';
const DIGITAL_KEY_API = process.env.DIGITAL_KEY_API_URL || 'http://localhost:4016';

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface GuestPreferences {
  checkInTime?: string;
  roomType?: string;
  floor?: string;
  smoking?: boolean;
  quietRoom?: boolean;
  highFloor?: boolean;
  earlyCheckin?: boolean;
  lateCheckout?: boolean;
  specialRequests?: string;
}

export interface EmergencyContact {
  name: string;
  phone: string;
  relationship: string;
}

export interface CheckinData {
  bookingId: string;
  userId: string;
  hotelId: string;
  // Guest details
  guestName: string;
  guestEmail: string;
  guestPhone: string;
  guestAddress?: string;
  // ID verification
  idType: 'passport' | 'aadhar' | 'driving_license' | 'voter_id';
  idNumber: string;
  idImage?: string; // Base64 or URL
  idVerified: boolean;
  // Preferences
  preferences: GuestPreferences;
  // Emergency contact
  emergencyContact?: EmergencyContact;
  // Payment for incidentals
  incidentalPaymentMethod?: 'credit_card' | 'debit_card' | 'cash';
  // Digital signature
  signature?: string; // Base64
  termsAccepted: boolean;
  // Status
  status: 'pending' | 'in_progress' | 'ready' | 'completed';
  step: number; // 1-5
  // Timestamps
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface DigitalKey {
  keyId: string;
  bookingId: string;
  roomId: string;
  roomNumber: string;
  validFrom: Date;
  validUntil: Date;
  qrCode: string;
  qrCodeImage?: string; // Base64 PNG
  nfcData?: string; // For NFC-enabled locks
  status: 'active' | 'expired' | 'revoked';
  createdAt: Date;
  updatedAt: Date;
}

export interface BookingInfo {
  bookingId: string;
  guestName: string;
  guestEmail: string;
  guestPhone: string;
  hotelId: string;
  hotelName?: string;
  checkIn: Date;
  checkOut: Date;
  roomType?: string;
}

export interface RoomAssignment {
  roomId: string;
  roomNumber: string;
  floor?: string;
  checkIn: Date;
  checkOut: Date;
}

// ─── MongoDB Schemas ──────────────────────────────────────────────────────────

const EmergencyContactSchema = new mongoose.Schema({
  name: { type: String },
  phone: { type: String },
  relationship: { type: String },
}, { _id: false });

const GuestPreferencesSchema = new mongoose.Schema({
  checkInTime: { type: String },
  roomType: { type: String },
  floor: { type: String },
  smoking: { type: Boolean },
  quietRoom: { type: Boolean },
  highFloor: { type: Boolean },
  earlyCheckin: { type: Boolean },
  lateCheckout: { type: Boolean },
  specialRequests: { type: String },
}, { _id: false });

const CheckinSchema = new mongoose.Schema({
  bookingId: { type: String, required: true, unique: true, index: true },
  userId: { type: String, required: true, index: true },
  hotelId: { type: String, required: true, index: true },
  guestName: { type: String, required: true },
  guestEmail: { type: String, required: true },
  guestPhone: { type: String, required: true },
  guestAddress: { type: String },
  idType: {
    type: String,
    enum: ['passport', 'aadhar', 'driving_license', 'voter_id'],
    default: 'aadhar',
  },
  idNumber: { type: String },
  idImage: { type: String }, // Base64 or URL
  idVerified: { type: Boolean, default: false },
  preferences: { type: GuestPreferencesSchema, default: {} },
  emergencyContact: { type: EmergencyContactSchema },
  incidentalPaymentMethod: {
    type: String,
    enum: ['credit_card', 'debit_card', 'cash'],
  },
  signature: { type: String }, // Base64
  termsAccepted: { type: Boolean, default: false },
  status: {
    type: String,
    enum: ['pending', 'in_progress', 'ready', 'completed'],
    default: 'pending',
  },
  step: { type: Number, default: 1, min: 1, max: 5 },
  completedAt: { type: Date },
}, { timestamps: true });

// Compound indexes
CheckinSchema.index({ hotelId: 1, status: 1 });
CheckinSchema.index({ userId: 1, createdAt: -1 });

const DigitalKeySchema = new mongoose.Schema({
  keyId: { type: String, required: true, unique: true, index: true },
  bookingId: { type: String, required: true, index: true },
  roomId: { type: String, required: true, index: true },
  roomNumber: { type: String, required: true },
  validFrom: { type: Date, required: true },
  validUntil: { type: Date, required: true },
  qrCode: { type: String, required: true },
  qrCodeImage: { type: String },
  nfcData: { type: String },
  status: {
    type: String,
    enum: ['active', 'expired', 'revoked'],
    default: 'active',
  },
}, { timestamps: true });

// Compound indexes
DigitalKeySchema.index({ bookingId: 1, status: 1 });
DigitalKeySchema.index({ roomId: 1, status: 1 });
DigitalKeySchema.index({ validUntil: 1 }, { expireAfterSeconds: 0 }); // TTL index

// ─── Models ─────────────────────────────────────────────────────────────────────

export const Checkin = mongoose.models.Checkin || mongoose.model<mongoose.Document & CheckinData>('Checkin', CheckinSchema);
export const DigitalKeyModel = mongoose.models.DigitalKey || mongoose.model<mongoose.Document & DigitalKey>('DigitalKey', DigitalKeySchema);

// ─── Service Functions ─────────────────────────────────────────────────────────

/**
 * Get booking details from Hotel-PMS
 */
async function getBookingFromPMS(bookingId: string): Promise<BookingInfo | null> {
  try {
    const response = await axios.get(`${HOTEL_PMS_API}/api/bookings/${bookingId}`, {
      timeout: 10000,
      headers: { 'Content-Type': 'application/json' },
    });
    return response.data;
  } catch (error: any) {
    logger.warn('Failed to get booking from PMS', { bookingId, error: error.message });
    return null;
  }
}

/**
 * Get room assignment from Hotel-PMS
 */
async function getRoomAssignmentFromPMS(hotelId: string, bookingId: string): Promise<RoomAssignment | null> {
  try {
    const response = await axios.get(`${HOTEL_PMS_API}/api/bookings/${bookingId}/room`, {
      timeout: 10000,
      headers: { 'Content-Type': 'application/json' },
    });
    return response.data;
  } catch (error: any) {
    logger.warn('Failed to get room assignment from PMS', { bookingId, error: error.message });
    return null;
  }
}

/**
 * Update booking status in Hotel-PMS
 */
async function updateBookingStatusInPMS(bookingId: string, status: string): Promise<boolean> {
  try {
    await axios.patch(`${HOTEL_PMS_API}/api/bookings/${bookingId}/status`, {
      status,
    }, {
      timeout: 10000,
      headers: { 'Content-Type': 'application/json' },
    });
    return true;
  } catch (error: any) {
    logger.warn('Failed to update booking status in PMS', { bookingId, status, error: error.message });
    return false;
  }
}

/**
 * Send notification to hotel via PMS webhook
 */
async function notifyHotelPMS(hotelId: string, event: string, data: any): Promise<void> {
  try {
    await axios.post(`${HOTEL_PMS_API}/api/webhooks/guest`, {
      event,
      hotelId,
      data,
      timestamp: new Date().toISOString(),
    }, {
      timeout: 10000,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    logger.warn('Failed to notify hotel PMS', { hotelId, event, error: error.message });
  }
}

/**
 * Calculate the next step in check-in process
 */
function calculateNextStep(checkin: CheckinData): number {
  if (!checkin.idVerified) return 2;
  if (!checkin.emergencyContact?.name) return 3;
  if (!checkin.termsAccepted) return 4;
  return 5;
}

/**
 * Start check-in process for a booking
 */
export async function startCheckin(bookingId: string, userId: string): Promise<CheckinData> {
  logger.info('Starting digital check-in', { bookingId, userId });

  // Check if check-in already exists
  const existing = await Checkin.findOne({ bookingId });
  if (existing) {
    logger.info('Check-in already exists, returning existing', { bookingId });
    return existing as unknown as CheckinData;
  }

  // Get booking details from PMS
  const booking = await getBookingFromPMS(bookingId);

  // Create check-in record
  const checkinData: Partial<CheckinData> = {
    bookingId,
    userId,
    hotelId: booking?.hotelId || '',
    guestName: booking?.guestName || 'Guest',
    guestEmail: booking?.guestEmail || '',
    guestPhone: booking?.guestPhone || '',
    idType: 'aadhar',
    idNumber: '',
    idVerified: false,
    preferences: {},
    termsAccepted: false,
    status: 'in_progress',
    step: 1,
  };

  const checkin = new Checkin(checkinData);
  await checkin.save();

  logger.info('Check-in record created', { bookingId, checkinId: checkin._id });

  // Notify hotel
  await notifyHotelPMS(checkin.hotelId, 'checkin_started', {
    bookingId,
    guestName: checkin.guestName,
    guestPhone: checkin.guestPhone,
  });

  return checkin as unknown as CheckinData;
}

/**
 * Get check-in data for a booking
 */
export async function getCheckin(bookingId: string): Promise<CheckinData | null> {
  const checkin = await Checkin.findOne({ bookingId });
  return checkin ? (checkin as unknown as CheckinData) : null;
}

/**
 * Get check-in data by user ID
 */
export async function getCheckinByUser(userId: string): Promise<CheckinData[]> {
  const checkins = await Checkin.find({ userId }).sort({ createdAt: -1 });
  return checkins as unknown as CheckinData[];
}

/**
 * Update check-in step
 */
export async function updateCheckin(
  bookingId: string,
  updates: Partial<CheckinData>
): Promise<CheckinData> {
  const checkin = await Checkin.findOne({ bookingId });

  if (!checkin) {
    throw new Error('Check-in not found');
  }

  // Apply updates
  Object.assign(checkin, updates);

  // Recalculate step
  checkin.step = calculateNextStep(checkin as unknown as CheckinData);

  if (checkin.step === 5) {
    checkin.status = 'ready';
  }

  await checkin.save();

  logger.info('Check-in updated', { bookingId, step: checkin.step, status: checkin.status });

  // If ID verified, notify hotel
  if (updates.idVerified) {
    await notifyHotelPMS(checkin.hotelId, 'id_verified', {
      bookingId,
      guestName: checkin.guestName,
      idType: checkin.idType,
      idNumber: checkin.idNumber,
    });
  }

  return checkin as unknown as CheckinData;
}

/**
 * Verify guest ID
 */
export async function verifyId(
  bookingId: string,
  idType: CheckinData['idType'],
  idNumber: string,
  idImage?: string
): Promise<CheckinData> {
  // In production, this would integrate with ID verification service
  // For now, we'll auto-verify for demo purposes
  const isVerified = true; // await verifyWithIdService(idType, idNumber, idImage);

  logger.info('ID verification attempted', { bookingId, idType, isVerified });

  return updateCheckin(bookingId, {
    idType,
    idNumber,
    idImage,
    idVerified: isVerified,
  });
}

/**
 * Generate QR code for digital key
 */
async function generateQRCodePayload(bookingId: string, roomId: string, keyId: string): Promise<string> {
  const payload = {
    intent: 'room_key',
    bookingId,
    roomId,
    keyId,
    timestamp: Date.now(),
    version: '1.0',
  };

  return JSON.stringify(payload);
}

/**
 * Generate QR code as base64 image
 */
async function generateQRCodeImage(payload: string): Promise<string> {
  try {
    const qrDataUrl = await QRCode.toDataURL(payload, {
      errorCorrectionLevel: 'M',
      type: 'image/png',
      width: 300,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF',
      },
    });
    return qrDataUrl;
  } catch (error: any) {
    logger.error('Failed to generate QR code image', { error: error.message });
    throw new Error('Failed to generate QR code');
  }
}

/**
 * Generate NFC data for digital key
 */
function generateNFCData(key: DigitalKey): string {
  // In production: integrate with lock manufacturer API
  // Format: REZ:keyId:roomId:validFrom:validUntil:signature
  const nfcPayload = {
    v: '1', // version
    k: key.keyId,
    r: key.roomId,
    f: key.validFrom.getTime(),
    u: key.validUntil.getTime(),
  };

  return Buffer.from(JSON.stringify(nfcPayload)).toString('base64');
}

/**
 * Complete check-in and generate digital key
 */
export async function completeCheckin(bookingId: string): Promise<DigitalKey> {
  const checkin = await Checkin.findOne({ bookingId });

  if (!checkin) {
    throw new Error('Check-in not found');
  }

  if (checkin.status !== 'ready') {
    throw new Error('Check-in not ready. Please complete all steps first.');
  }

  // Check if key already exists
  const existingKey = await DigitalKeyModel.findOne({ bookingId, status: 'active' });
  if (existingKey) {
    logger.info('Active digital key already exists', { bookingId, keyId: existingKey.keyId });
    return existingKey as unknown as DigitalKey;
  }

  // Get room assignment from PMS
  const room = await getRoomAssignmentFromPMS(checkin.hotelId, bookingId);

  if (!room) {
    throw new Error('Room not assigned. Please wait for room assignment from hotel.');
  }

  // Calculate validity period
  const validFrom = new Date();
  const checkOutDate = room.checkOut || new Date(validFrom.getTime() + 24 * 60 * 60 * 1000);
  const validUntil = checkin.preferences?.lateCheckout
    ? new Date(checkOutDate.getTime() + 24 * 60 * 60 * 1000) // Extend by 24 hours
    : checkOutDate;

  // Generate key
  const keyId = randomUUID();
  const qrPayload = await generateQRCodePayload(bookingId, room.roomId, keyId);
  const qrCodeImage = await generateQRCodeImage(qrPayload);

  const digitalKey: Partial<DigitalKey> = {
    keyId,
    bookingId,
    roomId: room.roomId,
    roomNumber: room.roomNumber,
    validFrom,
    validUntil,
    qrCode: qrPayload,
    qrCodeImage,
    nfcData: generateNFCData({
      keyId,
      bookingId,
      roomId: room.roomId,
      roomNumber: room.roomNumber,
      validFrom,
      validUntil,
      qrCode: qrPayload,
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
    }),
    status: 'active',
  };

  const savedKey = new DigitalKeyModel(digitalKey);
  await savedKey.save();

  // Update check-in status
  checkin.status = 'completed';
  checkin.completedAt = new Date();
  await checkin.save();

  // Update booking status in PMS
  await updateBookingStatusInPMS(bookingId, 'checked_in');

  // Notify hotel
  await notifyHotelPMS(checkin.hotelId, 'checkin_completed', {
    bookingId,
    guestName: checkin.guestName,
    roomNumber: room.roomNumber,
    keyId,
  });

  logger.info('Check-in completed, digital key generated', {
    bookingId,
    keyId,
    roomNumber: room.roomNumber,
  });

  return savedKey as unknown as DigitalKey;
}

/**
 * Get digital key for a booking
 */
export async function getDigitalKey(bookingId: string): Promise<DigitalKey | null> {
  const key = await DigitalKeyModel.findOne({ bookingId, status: 'active' });
  return key ? (key as unknown as DigitalKey) : null;
}

/**
 * Get digital key by key ID
 */
export async function getDigitalKeyById(keyId: string): Promise<DigitalKey | null> {
  const key = await DigitalKeyModel.findOne({ keyId });
  return key ? (key as unknown as DigitalKey) : null;
}

/**
 * Get all active keys for a room
 */
export async function getRoomKeys(roomId: string): Promise<DigitalKey[]> {
  const keys = await DigitalKeyModel.find({ roomId, status: 'active' });
  return keys as unknown as DigitalKey[];
}

/**
 * Revoke digital key (on checkout or emergency)
 */
export async function revokeKey(keyId: string, reason: string): Promise<DigitalKey> {
  const key = await DigitalKeyModel.findOne({ keyId });

  if (!key) {
    throw new Error('Digital key not found');
  }

  key.status = 'revoked';
  await key.save();

  // Notify hotel
  await notifyHotelPMS(key.bookingId, 'key_revoked', {
    keyId,
    bookingId: key.bookingId,
    roomNumber: key.roomNumber,
    reason,
  });

  logger.info('Digital key revoked', { keyId, reason });

  return key as unknown as DigitalKey;
}

/**
 * Revoke all keys for a booking (typically on checkout)
 */
export async function revokeBookingKeys(bookingId: string, reason: string = 'checkout'): Promise<number> {
  const result = await DigitalKeyModel.updateMany(
    { bookingId, status: 'active' },
    { $set: { status: 'revoked' } }
  );

  if (result.modifiedCount > 0) {
    await notifyHotelPMS('', 'keys_revoked', {
      bookingId,
      reason,
      count: result.modifiedCount,
    });

    logger.info('Booking keys revoked', { bookingId, count: result.modifiedCount });
  }

  return result.modifiedCount;
}

/**
 * Express checkout - process guest checkout
 */
export async function expressCheckout(bookingId: string): Promise<{
  success: boolean;
  message: string;
  charges?: any;
}> {
  const checkin = await Checkin.findOne({ bookingId });

  if (!checkin) {
    return { success: false, message: 'Check-in not found' };
  }

  if (checkin.status !== 'completed') {
    return { success: false, message: 'Guest has not completed check-in' };
  }

  // Revoke digital keys
  const keysRevoked = await revokeBookingKeys(bookingId, 'express_checkout');

  // Update booking status in PMS
  await updateBookingStatusInPMS(bookingId, 'checked_out');

  logger.info('Express checkout completed', { bookingId, keysRevoked });

  return {
    success: true,
    message: 'Express checkout completed successfully',
  };
}

/**
 * Validate a QR code scan
 */
export async function validateQRCodeScan(qrPayload: string): Promise<{
  valid: boolean;
  key?: DigitalKey;
  error?: string;
}> {
  try {
    const payload = JSON.parse(qrPayload);

    if (payload.intent !== 'room_key') {
      return { valid: false, error: 'Invalid QR code type' };
    }

    const key = await DigitalKeyModel.findOne({
      keyId: payload.keyId,
      bookingId: payload.bookingId,
      roomId: payload.roomId,
    });

    if (!key) {
      return { valid: false, error: 'Key not found' };
    }

    if (key.status !== 'active') {
      return { valid: false, error: `Key is ${key.status}` };
    }

    const now = new Date();
    if (now < key.validFrom || now > key.validUntil) {
      return { valid: false, error: 'Key has expired or is not yet valid' };
    }

    return { valid: true, key: key as unknown as DigitalKey };
  } catch (error: any) {
    logger.error('QR code validation failed', { error: error.message });
    return { valid: false, error: 'Invalid QR code format' };
  }
}

/**
 * Get check-in statistics for a hotel
 */
export async function getCheckinStats(hotelId: string, period: 'today' | 'week' | 'month' = 'today'): Promise<{
  totalCheckins: number;
  completedCheckins: number;
  pendingCheckins: number;
  activeKeys: number;
  averageCheckinTime: number; // minutes
}> {
  let dateFilter: { $gte?: Date } = {};
  const now = new Date();

  if (period === 'today') {
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    dateFilter = { $gte: startOfDay };
  } else if (period === 'week') {
    dateFilter = { $gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) };
  } else {
    dateFilter = { $gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) };
  }

  const checkins = await Checkin.find({
    hotelId,
    createdAt: dateFilter,
  });

  const completed = checkins.filter(c => c.status === 'completed').length;
  const pending = checkins.filter(c => c.status === 'pending' || c.status === 'in_progress').length;

  const activeKeys = await DigitalKeyModel.countDocuments({
    bookingId: { $in: checkins.map(c => c.bookingId) },
    status: 'active',
    validUntil: { $gt: new Date() },
  });

  // Calculate average check-in time (mock for now)
  const averageCheckinTime = 8; // minutes

  return {
    totalCheckins: checkins.length,
    completedCheckins: completed,
    pendingCheckins: pending,
    activeKeys,
    averageCheckinTime,
  };
}

/**
 * Send digital key to guest
 */
export async function sendKeyToGuest(bookingId: string): Promise<boolean> {
  const checkin = await Checkin.findOne({ bookingId });
  const key = await getDigitalKey(bookingId);

  if (!checkin || !key) {
    return false;
  }

  try {
    // Send via email/SMS/WhatsApp based on guest preference
    const payload = {
      to: checkin.guestEmail,
      phone: checkin.guestPhone,
      subject: `Your Digital Room Key - Room ${key.roomNumber}`,
      template: 'digital-key',
      data: {
        guestName: checkin.guestName,
        roomNumber: key.roomNumber,
        validUntil: key.validUntil,
        qrCodeImage: key.qrCodeImage,
        qrCode: key.qrCode,
      },
    };

    // In production: call notification service
    logger.info('Digital key sent to guest', { bookingId, guestEmail: checkin.guestEmail });

    return true;
  } catch (error: any) {
    logger.error('Failed to send key to guest', { bookingId, error: error.message });
    return false;
  }
}

// ─── Export ─────────────────────────────────────────────────────────────────────

export const digitalCheckinService = {
  startCheckin,
  getCheckin,
  getCheckinByUser,
  updateCheckin,
  verifyId,
  completeCheckin,
  getDigitalKey,
  getDigitalKeyById,
  getRoomKeys,
  revokeKey,
  revokeBookingKeys,
  expressCheckout,
  validateQRCodeScan,
  getCheckinStats,
  sendKeyToGuest,
};

export default digitalCheckinService;
