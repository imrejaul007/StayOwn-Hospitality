import logger from './utils/logger';

/**
 * Room QR Integration Module for StayOwn Hotel Booking
 *
 * Features:
 * 1. Auto-generate Room QR when booking is confirmed
 * 2. Send QR to guest via email/WhatsApp/SMS
 * 3. Track Room QR usage
 * 4. Sync charges to StayOwn folio
 */

import jwt from 'jsonwebtoken';
import QRCode from 'qrcode';
import axios from 'axios';
import mongoose from 'mongoose';
import { rezMindClient } from './services/rez-mind-client';

// Configuration - FAIL CLOSED if secrets not configured in production
function getJwtSecret(): string {
  const secret = process.env.ROOM_QR_JWT_SECRET || process.env.JWT_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('CRITICAL: ROOM_QR_JWT_SECRET or JWT_SECRET must be configured in production');
    }
    logger.warn('[Security] WARNING: Using fallback JWT secret - DO NOT use in production');
    return 'dev-only-fallback-secret-do-not-use-in-production';
  }
  return secret;
}

const JWT_SECRET = getJwtSecret();
const QR_BASE_URL = process.env.ROOM_QR_BASE_URL || 'https://rez.money/room';
const HOTEL_OTA_API = process.env.HOTEL_OTA_API_URL || 'http://localhost:3008';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface RoomQRConfig {
  hotelId: string;
  hotelName: string;
  hotelSlug: string;
  roomId: string;
  roomNumber: string;
  bookingId: string;
  guestId: string;
  guestName: string;
  guestEmail: string;
  guestPhone: string;
  checkIn: Date;
  checkOut: Date;
}

export interface GeneratedQR {
  qrPayload: QRPpayload;
  qrImage: string; // Base64 PNG
  qrUrl: string; // Short URL for QR
  token: string; // JWT for authentication
  expiresAt: Date;
}

export interface QRPpayload {
  intent: 'room_access';
  hotelId: string;
  roomId: string;
  bookingId: string;
  guestId: string;
  token: string;
  checkIn: string;
  checkOut: string;
}

export interface TokenValidation {
  valid: boolean;
  hotelId?: string;
  roomId?: string;
  bookingId?: string;
  guestId?: string;
  roomNumber?: string;
  expiresAt?: Date;
  canUseServices?: boolean;
  canCheckout?: boolean;
  error?: string;
}

export interface ServiceCharge {
  id: string;
  bookingId: string;
  hotelId: string;
  roomId: string;
  category: 'minibar' | 'laundry' | 'room_service' | 'restaurant' | 'spa' | 'transport' | 'other';
  description: string;
  amountPaise: number;
  quantity: number;
  unitPricePaise: number;
  source: 'minibar' | 'room_service' | 'laundry' | 'restaurant' | 'spa' | 'transport' | 'manual';
  createdAt: Date;
  synced: boolean;
}

export interface ServiceChargeInput {
  bookingId: string;
  hotelId: string;
  roomId: string;
  category: 'minibar' | 'laundry' | 'room_service' | 'restaurant' | 'spa' | 'transport' | 'other';
  description: string;
  amountPaise: number;
  quantity?: number;
  unitPricePaise?: number;
  source?: 'minibar' | 'room_service' | 'laundry' | 'restaurant' | 'spa' | 'transport' | 'manual';
}

export interface CheckoutSummary {
  bookingId: string;
  guestName: string;
  roomNumber: string;
  checkIn: Date;
  checkOut: Date;
  roomCharges: ChargeItem[];
  serviceCharges: ChargeItem[];
  subtotalPaise: number;
  taxesPaise: number;
  totalPaise: number;
  payments: PaymentRecord[];
  balanceDuePaise: number;
  checkoutTime: Date;
}

export interface ChargeItem {
  id: string;
  description: string;
  quantity: number;
  unitPricePaise: number;
  totalPaise: number;
  date: Date;
  category: string;
}

export interface PaymentRecord {
  id: string;
  amountPaise: number;
  method: string;
  status: string;
  date: Date;
}

export interface RoomQRDocument extends mongoose.Document {
  bookingId: string;
  hotelId: string;
  roomId: string;
  roomNumber: string;
  guestId: string;
  guestName: string;
  guestEmail: string;
  guestPhone: string;
  token: string;
  qrPayload: string; // JSON stringified
  qrImage: string; // Base64 PNG
  qrUrl: string;
  checkIn: Date;
  checkOut: Date;
  expiresAt: Date;
  isActive: boolean;
  lastUsedAt?: Date;
  useCount: number;
  notifications: {
    emailSent: boolean;
    emailSentAt?: Date;
    whatsappSent: boolean;
    whatsappSentAt?: Date;
    smsSent: boolean;
    smsSentAt?: Date;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface ServiceChargeDocument extends mongoose.Document {
  bookingId: string;
  hotelId: string;
  roomId: string;
  category: string;
  description: string;
  amountPaise: number;
  quantity: number;
  unitPricePaise: number;
  source: 'minibar' | 'room_service' | 'laundry' | 'restaurant' | 'spa' | 'transport' | 'manual';
  syncedToFolio: boolean;
  syncedAt?: Date;
  folioTransactionId?: string;
  createdAt: Date;
  updatedAt: Date;
}

// ─── MongoDB Schemas ─────────────────────────────────────────────────────────

const RoomQRSchema = new mongoose.Schema({
  bookingId: { type: String, required: true, unique: true, index: true },
  hotelId: { type: String, required: true, index: true },
  roomId: { type: String, required: true, index: true },
  roomNumber: { type: String, required: true },
  guestId: { type: String, required: true },
  guestName: { type: String, required: true },
  guestEmail: { type: String, required: true },
  guestPhone: { type: String, required: true },
  token: { type: String, required: true, unique: true },
  qrPayload: { type: String, required: true },
  qrImage: { type: String, required: true },
  qrUrl: { type: String, required: true },
  checkIn: { type: Date, required: true },
  checkOut: { type: Date, required: true },
  expiresAt: { type: Date, required: true },
  isActive: { type: Boolean, default: true },
  lastUsedAt: { type: Date },
  useCount: { type: Number, default: 0 },
  notifications: {
    emailSent: { type: Boolean, default: false },
    emailSentAt: { type: Date },
    whatsappSent: { type: Boolean, default: false },
    whatsappSentAt: { type: Date },
    smsSent: { type: Boolean, default: false },
    smsSentAt: { type: Date }
  }
}, { timestamps: true });

const ServiceChargeSchema = new mongoose.Schema({
  bookingId: { type: String, required: true, index: true },
  hotelId: { type: String, required: true, index: true },
  roomId: { type: String, required: true, index: true },
  category: { type: String, required: true },
  description: { type: String, required: true },
  amountPaise: { type: Number, required: true },
  quantity: { type: Number, default: 1 },
  unitPricePaise: { type: Number, required: true },
  source: {
    type: String,
    enum: ['minibar', 'room_service', 'laundry', 'restaurant', 'spa', 'transport', 'manual'],
    default: 'manual'
  },
  syncedToFolio: { type: Boolean, default: false },
  syncedAt: { type: Date },
  folioTransactionId: { type: String }
}, { timestamps: true });

// ─── Models ─────────────────────────────────────────────────────────────────

export const RoomQR = mongoose.models.RoomQR || mongoose.model<RoomQRDocument>('RoomQR', RoomQRSchema);
export const ServiceCharge = mongoose.models.ServiceCharge || mongoose.model<ServiceChargeDocument>('ServiceCharge', ServiceChargeSchema);

// ─── QR Generation ───────────────────────────────────────────────────────────

/**
 * Generate Room QR for a booking
 */
export async function generateRoomQR(config: RoomQRConfig): Promise<GeneratedQR> {
  try {
    // Calculate expiry (checkOut + 24 hours)
    const expiresAt = new Date(config.checkOut);
    expiresAt.setHours(expiresAt.getHours() + 24);

    // Create JWT token with HMAC
    const tokenPayload = {
      intent: 'room_access',
      hotelId: config.hotelId,
      roomId: config.roomId,
      bookingId: config.bookingId,
      guestId: config.guestId,
      checkIn: config.checkIn.toISOString(),
      checkOut: config.checkOut.toISOString(),
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(expiresAt.getTime() / 1000)
    };

    const token = jwt.sign(tokenPayload, JWT_SECRET, { algorithm: 'HS256' });

    // Create QR payload
    const qrPayload: QRPpayload = {
      intent: 'room_access',
      hotelId: config.hotelId,
      roomId: config.roomId,
      bookingId: config.bookingId,
      guestId: config.guestId,
      token,
      checkIn: config.checkIn.toISOString(),
      checkOut: config.checkOut.toISOString()
    };

    const qrPayloadString = JSON.stringify(qrPayload);
    const qrUrl = `${QR_BASE_URL}/${config.hotelSlug}/${config.roomId}?qr=${encodeURIComponent(qrPayloadString)}`;

    // Generate QR code as base64 PNG
    const qrImage = await QRCode.toDataURL(qrUrl, {
      errorCorrectionLevel: 'H',
      type: 'image/png',
      width: 400,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    });

    return {
      qrPayload,
      qrImage,
      qrUrl,
      token,
      expiresAt
    };
  } catch (error) {
    console.error('[RoomQR] Failed to generate QR:', error);
    throw new Error('Failed to generate room QR code');
  }
}

// ─── QR Storage ──────────────────────────────────────────────────────────────

/**
 * Store generated QR in database
 */
export async function storeRoomQR(
  config: RoomQRConfig,
  generatedQR: GeneratedQR
): Promise<RoomQRDocument> {
  try {
    // Check if QR already exists for this booking
    const existing = await RoomQR.findOne({ bookingId: config.bookingId });
    if (existing) {
      // Update existing record
      existing.token = generatedQR.token;
      existing.qrPayload = JSON.stringify(generatedQR.qrPayload);
      existing.qrImage = generatedQR.qrImage;
      existing.qrUrl = generatedQR.qrUrl;
      existing.expiresAt = generatedQR.expiresAt;
      existing.isActive = true;
      existing.notifications = {
        emailSent: false,
        whatsappSent: false,
        smsSent: false
      };
      await existing.save();
      return existing;
    }

    // Create new record
    const roomQR = new RoomQR({
      bookingId: config.bookingId,
      hotelId: config.hotelId,
      roomId: config.roomId,
      roomNumber: config.roomNumber,
      guestId: config.guestId,
      guestName: config.guestName,
      guestEmail: config.guestEmail,
      guestPhone: config.guestPhone,
      token: generatedQR.token,
      qrPayload: JSON.stringify(generatedQR.qrPayload),
      qrImage: generatedQR.qrImage,
      qrUrl: generatedQR.qrUrl,
      checkIn: config.checkIn,
      checkOut: config.checkOut,
      expiresAt: generatedQR.expiresAt,
      isActive: true,
      useCount: 0,
      notifications: {
        emailSent: false,
        whatsappSent: false,
        smsSent: false
      }
    });

    await roomQR.save();
    return roomQR;
  } catch (error) {
    console.error('[RoomQR] Failed to store QR:', error);
    throw new Error('Failed to store room QR');
  }
}

/**
 * Get QR details for a booking
 */
export async function getRoomQRByBookingId(bookingId: string): Promise<RoomQRDocument | null> {
  return RoomQR.findOne({ bookingId });
}

/**
 * Get QR details by token
 */
export async function getRoomQRByToken(token: string): Promise<RoomQRDocument | null> {
  return RoomQR.findOne({ token });
}

// ─── Token Validation ────────────────────────────────────────────────────────

/**
 * Validate Room QR token
 */
export async function validateRoomQRToken(token: string): Promise<TokenValidation> {
  try {
    // Find the QR record
    const qrRecord = await RoomQR.findOne({ token });

    if (!qrRecord) {
      return { valid: false, error: 'QR code not found' };
    }

    if (!qrRecord.isActive) {
      return { valid: false, error: 'QR code is no longer active' };
    }

    // Verify JWT signature and expiration
    let decoded: any;
    try {
      decoded = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
    } catch (jwtError: any) {
      if (jwtError.name === 'TokenExpiredError') {
        return { valid: false, error: 'QR code has expired' };
      }
      return { valid: false, error: 'Invalid QR code token' };
    }

    // Check if token matches record
    if (decoded.bookingId !== qrRecord.bookingId) {
      return { valid: false, error: 'Token mismatch' };
    }

    // Update usage statistics
    qrRecord.useCount += 1;
    qrRecord.lastUsedAt = new Date();
    await qrRecord.save();

    // Determine service permissions based on time
    const now = new Date();
    const canUseServices = now >= qrRecord.checkIn && now <= qrRecord.checkOut;
    const canCheckout = now >= qrRecord.checkIn && now <= qrRecord.expiresAt;

    return {
      valid: true,
      hotelId: qrRecord.hotelId,
      roomId: qrRecord.roomId,
      bookingId: qrRecord.bookingId,
      guestId: qrRecord.guestId,
      roomNumber: qrRecord.roomNumber,
      expiresAt: qrRecord.expiresAt,
      canUseServices,
      canCheckout
    };
  } catch (error) {
    console.error('[RoomQR] Token validation error:', error);
    return { valid: false, error: 'Validation failed' };
  }
}

// ─── Guest Notification ──────────────────────────────────────────────────────

/**
 * Send QR notification to guest via multiple channels
 */
export async function notifyGuestBooking(
  hotelId: string,
  bookingId: string,
  qrData: {
    qrImage: string;
    qrUrl: string;
    hotelName: string;
    roomNumber: string;
    checkIn: Date;
    checkOut: Date;
    guestName: string;
    guestEmail: string;
    guestPhone: string;
  }
): Promise<void> {
  const promises: Promise<void>[] = [];

  // Send email
  if (qrData.guestEmail) {
    promises.push(sendEmailNotification(qrData));
  }

  // Send WhatsApp
  if (qrData.guestPhone) {
    promises.push(sendWhatsAppNotification(qrData));
  }

  // Send SMS (fallback)
  if (qrData.guestPhone) {
    promises.push(sendSMSNotification(qrData));
  }

  // Wait for all notifications
  await Promise.allSettled(promises);

  // Update notification status in database
  const roomQR = await RoomQR.findOne({ bookingId });
  if (roomQR) {
    const now = new Date();
    roomQR.notifications = {
      emailSent: !!qrData.guestEmail,
      emailSentAt: qrData.guestEmail ? now : undefined,
      whatsappSent: !!qrData.guestPhone,
      whatsappSentAt: qrData.guestPhone ? now : undefined,
      smsSent: !!qrData.guestPhone,
      smsSentAt: qrData.guestPhone ? now : undefined
    };
    await roomQR.save();
  }
}

async function sendEmailNotification(data: {
  qrImage: string;
  qrUrl: string;
  hotelName: string;
  roomNumber: string;
  checkIn: Date;
  checkOut: Date;
  guestName: string;
  guestEmail: string;
}): Promise<void> {
  try {
    // Dynamic import for email template
    const { generateRoomQREmail } = await import('./templates/room-qr-email');

    const emailHtml = generateRoomQREmail({
      guestName: data.guestName,
      hotelName: data.hotelName,
      roomNumber: data.roomNumber,
      checkIn: data.checkIn,
      checkOut: data.checkOut,
      qrImage: data.qrImage,
      qrUrl: data.qrUrl
    });

    // Send via email service (e.g., SendGrid, Resend)
    const emailService = process.env.EMAIL_SERVICE_URL || 'http://localhost:4003';
    await axios.post(`${emailService}/api/send`, {
      to: data.guestEmail,
      subject: `Your Room QR Code - ${data.hotelName}`,
      html: emailHtml,
      from: `noreply@rez.money`
    }, {
      timeout: 10000
    });

    logger.info(`[RoomQR] Email sent to ${data.guestEmail}`);
  } catch (error) {
    console.error('[RoomQR] Email notification failed:', error);
    // Don't throw - continue with other notification methods
  }
}

async function sendWhatsAppNotification(data: {
  qrImage: string;
  qrUrl: string;
  hotelName: string;
  roomNumber: string;
  checkIn: Date;
  checkOut: Date;
  guestName: string;
  guestPhone: string;
}): Promise<void> {
  try {
    const message = `Hello ${data.guestName}!

Welcome to ${data.hotelName}!

Your Room QR Code:
Room: ${data.roomNumber}
Check-in: ${data.checkIn.toLocaleDateString()}
Check-out: ${data.checkOut.toLocaleDateString()}

Scan the QR code in your email or use this link:
${data.qrUrl}

Best regards,
${data.hotelName}`;

    // Send via WhatsApp service
    const whatsappService = process.env.WHATSAPP_SERVICE_URL || 'http://localhost:4004';
    await axios.post(`${whatsappService}/api/send`, {
      to: data.guestPhone,
      message,
      type: 'text'
    }, {
      timeout: 10000
    });

    logger.info(`[RoomQR] WhatsApp sent to ${data.guestPhone}`);
  } catch (error) {
    console.error('[RoomQR] WhatsApp notification failed:', error);
  }
}

async function sendSMSNotification(data: {
  qrUrl: string;
  hotelName: string;
  roomNumber: string;
  guestPhone: string;
}): Promise<void> {
  try {
    const message = `Your ${data.hotelName} Room QR: ${data.qrUrl} - Room ${data.roomNumber}`;

    // Send via SMS service
    const smsService = process.env.SMS_SERVICE_URL || 'http://localhost:4005';
    await axios.post(`${smsService}/api/send`, {
      to: data.guestPhone,
      message,
      type: 'text'
    }, {
      timeout: 10000
    });

    logger.info(`[RoomQR] SMS sent to ${data.guestPhone}`);
  } catch (error) {
    console.error('[RoomQR] SMS notification failed:', error);
  }
}

// ─── Service Charge Sync ─────────────────────────────────────────────────────

/**
 * Record a service charge
 */
export async function recordServiceCharge(charge: ServiceChargeInput): Promise<ServiceChargeDocument> {
  try {
    const serviceCharge = new ServiceCharge({
      bookingId: charge.bookingId,
      hotelId: charge.hotelId,
      roomId: charge.roomId,
      category: charge.category,
      description: charge.description,
      amountPaise: charge.amountPaise,
      quantity: charge.quantity || 1,
      unitPricePaise: charge.unitPricePaise || charge.amountPaise,
      source: charge.source || 'manual',
      syncedToFolio: false
    });

    await serviceCharge.save();

    // Try to sync to StayOwn folio immediately
    await syncChargeToFolio(serviceCharge);

    // Emit service_ordered event to REZ Mind
    rezMindClient.sendEvent({
      eventType: 'service_ordered',
      source: 'stayown',
      data: {
        bookingId: charge.bookingId,
        hotelId: charge.hotelId,
        roomId: charge.roomId,
        category: charge.category,
        description: charge.description,
        amountPaise: charge.amountPaise,
        quantity: charge.quantity || 1,
        source: charge.source || 'manual',
      },
      timestamp: new Date(),
    });

    return serviceCharge;
  } catch (error) {
    console.error('[RoomQR] Failed to record service charge:', error);
    throw new Error('Failed to record service charge');
  }
}

/**
 * Sync a charge to StayOwn folio via bridge
 */
export async function syncChargeToFolio(charge: ServiceChargeDocument): Promise<void> {
  if (charge.syncedToFolio) {
    return; // Already synced
  }

  try {
    // Dynamic import to avoid circular dependency
    const { addChargeToFolio } = await import('./bridge');

    const result = await addChargeToFolio({
      bookingId: charge.bookingId,
      hotelId: charge.hotelId,
      category: charge.category as 'minibar' | 'laundry' | 'room_service' | 'restaurant' | 'spa' | 'transport' | 'other',
      description: charge.description,
      amountPaise: charge.amountPaise,
      quantity: charge.quantity,
      unitPricePaise: charge.unitPricePaise,
      source: charge.source as 'minibar' | 'room_service' | 'laundry' | 'restaurant' | 'spa' | 'transport' | 'manual'
    });

    if (result.success) {
      // Update sync status
      charge.syncedToFolio = true;
      charge.syncedAt = new Date();
      if (result.transactionId) {
        charge.folioTransactionId = result.transactionId;
      }
      await charge.save();

      console.log(`[RoomQR] Charge ${charge.id} synced to folio${result.transactionId ? ` (txn: ${result.transactionId})` : ''}`);
    } else {
      logger.error(`[RoomQR] Failed to sync charge ${charge.id}: ${result.error}`);
      // Don't throw - will retry on checkout
    }
  } catch (error) {
    console.error(`[RoomQR] Failed to sync charge ${charge.id} to folio:`, error);
    // Don't throw - will retry on checkout
  }
}

/**
 * Get all charges for a booking
 */
export async function getChargesForBooking(bookingId: string): Promise<ServiceChargeDocument[]> {
  return ServiceCharge.find({ bookingId }).sort({ createdAt: -1 });
}

/**
 * Sync all unsynced charges for a booking
 */
export async function syncAllChargesToFolio(bookingId: string): Promise<number> {
  const unsyncedCharges = await ServiceCharge.find({
    bookingId,
    syncedToFolio: false
  });

  let syncedCount = 0;

  for (const charge of unsyncedCharges) {
    try {
      await syncChargeToFolio(charge);
      syncedCount++;
    } catch (error) {
      console.error(`[RoomQR] Failed to sync charge ${charge.id}:`, error);
    }
  }

  return syncedCount;
}

// ─── Checkout Integration ────────────────────────────────────────────────────

/**
 * Process room checkout
 */
export async function processRoomCheckout(bookingId: string): Promise<CheckoutSummary> {
  try {
    // Get booking details
    const roomQR = await RoomQR.findOne({ bookingId });
    if (!roomQR) {
      throw new Error('Room QR not found for this booking');
    }

    // Sync all pending charges
    await syncAllChargesToFolio(bookingId);

    // Get all charges
    const charges = await ServiceCharge.find({ bookingId }).sort({ createdAt: 1 });

    // Group charges by category
    const roomCharges: ChargeItem[] = [];
    const serviceCharges: ChargeItem[] = [];

    for (const charge of charges) {
      const item: ChargeItem = {
        id: charge.id,
        description: charge.description,
        quantity: charge.quantity,
        unitPricePaise: charge.unitPricePaise,
        totalPaise: charge.amountPaise,
        date: charge.createdAt,
        category: charge.category
      };

      if (charge.category === 'room') {
        roomCharges.push(item);
      } else {
        serviceCharges.push(item);
      }
    }

    // Calculate totals
    const roomSubtotal = roomCharges.reduce((sum, item) => sum + item.totalPaise, 0);
    const serviceSubtotal = serviceCharges.reduce((sum, item) => sum + item.totalPaise, 0);
    const subtotalPaise = roomSubtotal + serviceSubtotal;
    const taxesPaise = Math.round(subtotalPaise * 0.18); // 18% GST
    const totalPaise = subtotalPaise + taxesPaise;

    // Get payments (would come from payment service)
    const payments: PaymentRecord[] = [];

    // Deactivate the QR code
    roomQR.isActive = false;
    await roomQR.save();

    const checkoutSummary: CheckoutSummary = {
      bookingId,
      guestName: roomQR.guestName,
      roomNumber: roomQR.roomNumber,
      checkIn: roomQR.checkIn,
      checkOut: roomQR.checkOut,
      roomCharges,
      serviceCharges,
      subtotalPaise,
      taxesPaise,
      totalPaise,
      payments,
      balanceDuePaise: Math.max(0, totalPaise - payments.reduce((sum, p) => sum + p.amountPaise, 0)),
      checkoutTime: new Date()
    };

    // Emit checkout_completed event to REZ Mind
    rezMindClient.sendEvent({
      eventType: 'checkout_completed',
      source: 'stayown',
      userId: roomQR.guestId,
      data: {
        bookingId,
        hotelId: roomQR.hotelId,
        roomId: roomQR.roomId,
        roomNumber: roomQR.roomNumber,
        checkIn: roomQR.checkIn.toISOString(),
        checkOut: roomQR.checkOut.toISOString(),
        roomChargesPaise: roomSubtotal,
        serviceChargesPaise: serviceSubtotal,
        taxesPaise,
        totalPaise,
        balanceDuePaise: checkoutSummary.balanceDuePaise,
      },
      timestamp: new Date(),
    });

    return checkoutSummary;
  } catch (error) {
    console.error('[RoomQR] Checkout processing failed:', error);
    throw new Error('Failed to process checkout');
  }
}

/**
 * Get checkout bill for a booking
 */
export async function getCheckoutBill(bookingId: string): Promise<CheckoutSummary | null> {
  try {
    const roomQR = await RoomQR.findOne({ bookingId });
    if (!roomQR) {
      return null;
    }

    const charges = await ServiceCharge.find({ bookingId }).sort({ createdAt: 1 });

    const roomCharges: ChargeItem[] = [];
    const serviceCharges: ChargeItem[] = [];

    for (const charge of charges) {
      const item: ChargeItem = {
        id: charge.id,
        description: charge.description,
        quantity: charge.quantity,
        unitPricePaise: charge.unitPricePaise,
        totalPaise: charge.amountPaise,
        date: charge.createdAt,
        category: charge.category
      };

      if (charge.category === 'room') {
        roomCharges.push(item);
      } else {
        serviceCharges.push(item);
      }
    }

    const roomSubtotal = roomCharges.reduce((sum, item) => sum + item.totalPaise, 0);
    const serviceSubtotal = serviceCharges.reduce((sum, item) => sum + item.totalPaise, 0);
    const subtotalPaise = roomSubtotal + serviceSubtotal;
    const taxesPaise = Math.round(subtotalPaise * 0.18);
    const totalPaise = subtotalPaise + taxesPaise;

    return {
      bookingId,
      guestName: roomQR.guestName,
      roomNumber: roomQR.roomNumber,
      checkIn: roomQR.checkIn,
      checkOut: roomQR.checkOut,
      roomCharges,
      serviceCharges,
      subtotalPaise,
      taxesPaise,
      totalPaise,
      payments: [],
      balanceDuePaise: totalPaise,
      checkoutTime: new Date()
    };
  } catch (error) {
    console.error('[RoomQR] Failed to get checkout bill:', error);
    return null;
  }
}

// ─── Full QR Generation Pipeline ─────────────────────────────────────────────

/**
 * Generate and store QR, then notify guest
 * Called when a booking is confirmed
 */
export async function generateAndNotifyRoomQR(config: RoomQRConfig): Promise<RoomQRDocument> {
  // 1. Generate QR
  const generatedQR = await generateRoomQR(config);

  // 2. Store in database
  const roomQR = await storeRoomQR(config, generatedQR);

  // 3. Notify guest
  await notifyGuestBooking(config.hotelId, config.bookingId, {
    qrImage: generatedQR.qrImage,
    qrUrl: generatedQR.qrUrl,
    hotelName: config.hotelName,
    roomNumber: config.roomNumber,
    checkIn: config.checkIn,
    checkOut: config.checkOut,
    guestName: config.guestName,
    guestEmail: config.guestEmail,
    guestPhone: config.guestPhone
  });

  // 4. Emit room_qr_generated event to REZ Mind
  rezMindClient.sendEvent({
    eventType: 'room_qr_generated',
    source: 'stayown',
    userId: config.guestId,
    data: {
      bookingId: config.bookingId,
      hotelId: config.hotelId,
      roomId: config.roomId,
      roomNumber: config.roomNumber,
      checkIn: config.checkIn.toISOString(),
      checkOut: config.checkOut.toISOString(),
    },
    timestamp: new Date(),
  });

  logger.info(`[RoomQR] Generated and notified for booking ${config.bookingId}`);

  return roomQR;
}

/**
 * Resend QR notification for a booking
 */
export async function resendQRNotification(bookingId: string): Promise<boolean> {
  try {
    const roomQR = await RoomQR.findOne({ bookingId });
    if (!roomQR) {
      throw new Error('Room QR not found');
    }

    const qrPayload = JSON.parse(roomQR.qrPayload);

    await notifyGuestBooking(roomQR.hotelId, bookingId, {
      qrImage: roomQR.qrImage,
      qrUrl: roomQR.qrUrl,
      hotelName: '',
      roomNumber: roomQR.roomNumber,
      checkIn: roomQR.checkIn,
      checkOut: roomQR.checkOut,
      guestName: roomQR.guestName,
      guestEmail: roomQR.guestEmail,
      guestPhone: roomQR.guestPhone
    });

    return true;
  } catch (error) {
    console.error(`[RoomQR] Failed to resend notification for ${bookingId}:`, error);
    return false;
  }
}

// ─── Webhook Handler for Room Service Events ─────────────────────────────────

export interface RoomServiceWebhookEvent {
  event: 'request.created' | 'request.completed' | 'charge.added' | 'checkout.requested';
  bookingId: string;
  hotelId: string;
  roomId: string;
  data?: Record<string, any>;
}

/**
 * Handle room service webhook events from Hotel OTA
 */
export async function handleRoomServiceWebhook(event: RoomServiceWebhookEvent): Promise<void> {
  logger.info(`[RoomQR] Webhook received: ${event.event} for booking ${event.bookingId}`);

  switch (event.event) {
    case 'request.created':
      // Log new service request
      logger.info(`[RoomQR] New ${event.data?.serviceType || 'unknown'} request for booking ${event.bookingId}`);
      break;

    case 'request.completed':
      // Record the charge when service is completed
      if (event.data && event.data.totalAmountPaise > 0) {
        await recordServiceCharge({
          bookingId: event.bookingId,
          hotelId: event.hotelId,
          roomId: event.roomId,
          category: (event.data.serviceType as any) || 'other',
          description: event.data.description || `${event.data.serviceType || 'service'} service`,
          amountPaise: event.data.totalAmountPaise,
          quantity: 1,
          unitPricePaise: event.data.totalAmountPaise,
          source: 'room_service'
        });
        logger.info(`[RoomQR] Recorded charge for completed service: ${event.data.totalAmountPaise} paise`);
      }
      break;

    case 'charge.added':
      // Directly record minibar or other charges
      if (event.data && event.data.amountPaise > 0) {
        await recordServiceCharge({
          bookingId: event.bookingId,
          hotelId: event.hotelId,
          roomId: event.roomId,
          category: (event.data.category as any) || 'other',
          description: event.data.description || 'Service charge',
          amountPaise: event.data.amountPaise,
          quantity: event.data.quantity || 1,
          unitPricePaise: event.data.unitPricePaise || event.data.amountPaise,
          source: (event.data.source as any) || 'manual'
        });
        logger.info(`[RoomQR] Recorded charge: ${event.data.amountPaise} paise`);
      }
      break;

    case 'checkout.requested':
      // Process checkout
      const summary = await processRoomCheckout(event.bookingId);
      logger.info(`[RoomQR] Checkout processed. Total: ${summary.totalPaise} paise`);
      break;
  }
}

// ─── Utility Functions ──────────────────────────────────────────────────────

/**
 * Deactivate QR for a booking
 */
export async function deactivateRoomQR(bookingId: string): Promise<boolean> {
  try {
    const result = await RoomQR.updateOne(
      { bookingId },
      { isActive: false }
    );
    return result.modifiedCount > 0;
  } catch (error) {
    console.error('[RoomQR] Failed to deactivate QR:', error);
    return false;
  }
}

/**
 * Get QR statistics for a hotel
 */
export async function getHotelQRStats(hotelId: string): Promise<{
  totalQRs: number;
  activeQRs: number;
  totalUses: number;
  averageUses: number;
}> {
  const stats = await RoomQR.aggregate([
    { $match: { hotelId } },
    {
      $group: {
        _id: null,
        totalQRs: { $sum: 1 },
        activeQRs: { $sum: { $cond: ['$isActive', 1, 0] } },
        totalUses: { $sum: '$useCount' }
      }
    }
  ]);

  if (stats.length === 0) {
    return { totalQRs: 0, activeQRs: 0, totalUses: 0, averageUses: 0 };
  }

  return {
    totalQRs: stats[0].totalQRs,
    activeQRs: stats[0].activeQRs,
    totalUses: stats[0].totalUses,
    averageUses: stats[0].totalQRs > 0 ? stats[0].totalUses / stats[0].totalQRs : 0
  };
}
