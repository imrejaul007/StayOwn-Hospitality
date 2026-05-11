/**
 * Room QR Manager - Room-Bound System
 *
 * Key Concept:
 * - Each ROOM has a FIXED QR code (pre-generated)
 * - When GUEST checks in, QR is LINKED to guest
 * - When guest scans QR, system knows ROOM + GUEST
 *
 * Flow:
 * 1. Hotel creates rooms with fixed QR codes
 * 2. Guest checks in to Room 101
 * 3. System links Room 101's QR to guest
 * 4. Guest scans QR101
 * 5. System knows: Room 101 + Guest John Doe
 * 6. All requests go to Room 101's queue
 */

import jwt from 'jsonwebtoken';
import QRCode from 'qrcode';
import mongoose from 'mongoose';

const JWT_SECRET = process.env.ROOM_QR_JWT_SECRET || process.env.JWT_SECRET || 'room-qr-secret-key-change-in-production';
const QR_BASE_URL = process.env.ROOM_QR_BASE_URL || 'https://rez.money/room';

// ─── Types ─────────────────────────────────────────────────────────────────

export interface RoomQRConfig {
  hotelId: string;
  hotelName: string;
  hotelSlug: string;
  roomId: string;
  roomNumber: string;
  bookingId?: string;
  guestId?: string;
  guestName?: string;
  guestEmail?: string;
  guestPhone?: string;
  checkIn?: Date;
  checkOut?: Date;
}

export interface GeneratedRoomQR {
  roomId: string;
  roomNumber: string;
  token: string;
  qrPayload: string;
  qrImage: string;
  qrUrl: string;
}

export interface RoomQRLink {
  roomId: string;
  bookingId: string;
  guestId: string;
  guestName: string;
  guestPhone: string;
  checkedInAt: Date;
  checkOut: Date;
  expiresAt: Date;
  isActive: boolean;
}

// ─── Schemas ────────────────────────────────────────────────────────────────

// Room QR Template - Fixed QR for each room
const RoomQRTemplatesSchema = new mongoose.Schema({
  roomId: { type: String, required: true, unique: true, index: true },
  roomNumber: { type: String, required: true },
  floor: { type: String },
  roomType: { type: String },
  hotelId: { type: String, required: true, index: true },
  hotelName: { type: String, required: true },
  hotelSlug: { type: String, required: true },
  // Pre-generated token for this room
  token: { type: String, unique: true },
  qrPayload: { type: String },
  qrImage: { type: String },
  qrUrl: { type: String },
  // Current link to guest
  currentLink: {
    bookingId: String,
    guestId: String,
    guestName: String,
    guestPhone: String,
    checkedInAt: Date,
    checkOut: Date,
    expiresAt: Date,
  },
  // QR usage tracking
  useCount: { type: Number, default: 0 },
  lastUsedAt: Date,
  isActive: { type: Boolean, default: false },
}, { timestamps: true });

// Historical links (for audit)
const RoomQRLinksSchema = new mongoose.Schema({
  roomId: { type: String, required: true, index: true },
  roomNumber: { type: String, required: true },
  bookingId: { type: String, required: true },
  guestId: { type: String, required: true },
  guestName: String,
  guestPhone: String,
  checkedInAt: { type: Date, required: true },
  checkedOutAt: Date,
  expiresAt: Date,
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

// Service requests with room context
const RoomServiceRequestSchema = new mongoose.Schema({
  roomId: { type: String, required: true, index: true },
  roomNumber: { type: String, required: true },
  hotelId: { type: String, required: true, index: true },
  // Guest info from QR link
  guestId: String,
  guestName: String,
  guestPhone: String,
  // Request details
  requestType: {
    type: String,
    enum: ['food', 'housekeeping', 'laundry', 'spa', 'transport', 'concierge', 'checkout', 'other'],
    required: true,
  },
  items: [{
    name: String,
    quantity: Number,
    pricePaise: Number,
  }],
  status: {
    type: String,
    enum: ['pending', 'acknowledged', 'in_progress', 'completed', 'cancelled'],
    default: 'pending',
  },
  specialInstructions: String,
  // Tracking
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date },
  completedAt: Date,
}, { timestamps: true });

// ─── Models ─────────────────────────────────────────────────────────────────

export const RoomQRTemplates = mongoose.models.RoomQRTemplates || mongoose.model('RoomQRTemplates', RoomQRTemplatesSchema);
export const RoomQRLinks = mongoose.models.RoomQRLinks || mongoose.model('RoomQRLinks', RoomQRLinksSchema);
export const RoomServiceRequests = mongoose.models.RoomServiceRequests || mongoose.model('RoomServiceRequests', RoomServiceRequestSchema);

// ─── Core Functions ────────────────────────────────────────────────────────

/**
 * Generate a fixed QR for a room (done during hotel setup)
 */
export async function generateRoomQRTemplate(config: {
  hotelId: string;
  hotelName: string;
  hotelSlug: string;
  roomId: string;
  roomNumber: string;
  floor?: string;
  roomType?: string;
}): Promise<GeneratedRoomQR> {
  // Create JWT token with room info (NO guest info yet)
  const tokenPayload = {
    intent: 'room-hub',
    v: 1,
    hotelId: config.hotelId,
    hotelSlug: config.hotelSlug,
    roomId: config.roomId,
    roomNumber: config.roomNumber,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + (365 * 24 * 60 * 60), // 1 year expiry for template
  };

  const token = jwt.sign(tokenPayload, JWT_SECRET);

  // QR payload for scanning
  const qrPayload = {
    intent: 'room-hub',
    v: 1,
    hotelId: config.hotelId,
    hotelSlug: config.hotelSlug,
    roomId: config.roomId,
    roomNumber: config.roomNumber,
    token,
  };

  // Generate QR image
  const qrImage = await QRCode.toDataURL(JSON.stringify(qrPayload), {
    width: 300,
    margin: 2,
    color: { dark: '#1a3a52', light: '#ffffff' },
  });

  // QR URL for deep linking
  const encodedPayload = encodeURIComponent(JSON.stringify(qrPayload));
  const qrUrl = QR_BASE_URL + '/' + config.hotelSlug + '/' + config.roomNumber + '?qr=' + encodedPayload;

  return {
    roomId: config.roomId,
    roomNumber: config.roomNumber,
    token,
    qrPayload: JSON.stringify(qrPayload),
    qrImage,
    qrUrl,
  };
}

/**
 * Link a guest to a room QR (done at check-in)
 */
export async function linkGuestToRoomQR(config: {
  roomId: string;
  bookingId: string;
  guestId: string;
  guestName: string;
  guestPhone: string;
  checkOut: Date;
}): Promise<{ success: boolean; qrUrl: string; expiresAt: Date }> {
  // Find the room template
  const roomQR = await RoomQRTemplates.findOne({ roomId: config.roomId });
  if (!roomQR) {
    throw new Error('Room QR template not found. Please generate QR for this room first.');
  }

  const expiresAt = new Date(config.checkOut);
  expiresAt.setHours(expiresAt.getHours() + 24); // Grace period

  // Update current link
  roomQR.currentLink = {
    bookingId: config.bookingId,
    guestId: config.guestId,
    guestName: config.guestName,
    guestPhone: config.guestPhone,
    checkedInAt: new Date(),
    checkOut: config.checkOut,
    expiresAt,
  };
  roomQR.isActive = true;
  roomQR.useCount = 0;
  await roomQR.save();

  // Create historical link
  await RoomQRLinks.create({
    roomId: config.roomId,
    roomNumber: roomQR.roomNumber,
    bookingId: config.bookingId,
    guestId: config.guestId,
    guestName: config.guestName,
    guestPhone: config.guestPhone,
    checkedInAt: new Date(),
    checkOut: config.checkOut,
    expiresAt,
    isActive: true,
  });

  return {
    success: true,
    qrUrl: roomQR.qrUrl,
    expiresAt,
  };
}

/**
 * Unlink guest from room QR (done at check-out)
 */
export async function unlinkGuestFromRoomQR(roomId: string): Promise<{ success: boolean }> {
  const roomQR = await RoomQRTemplates.findOne({ roomId });
  if (!roomQR) {
    return { success: false };
  }

  // Mark current link as inactive
  if (roomQR.currentLink) {
    await RoomQRLinks.updateOne(
      { roomId, isActive: true },
      {
        isActive: false,
        checkedOutAt: new Date(),
      }
    );
  }

  roomQR.currentLink = undefined;
  roomQR.isActive = false;
  await roomQR.save();

  return { success: true };
}

/**
 * Validate QR scan and get room + guest context
 */
export async function validateRoomQRScan(token: string): Promise<{
  valid: boolean;
  roomId?: string;
  roomNumber?: string;
  hotelId?: string;
  hotelSlug?: string;
  guestId?: string;
  guestName?: string;
  bookingId?: string;
  canAccess: boolean;
  error?: string;
}> {
  try {
    // Verify JWT
    const decoded = jwt.verify(token, JWT_SECRET) as any;

    if (!decoded.intent || decoded.intent !== 'room-hub') {
      return { valid: false, canAccess: false, error: 'Invalid QR format' };
    }

    // Find room QR template
    const roomQR = await RoomQRTemplates.findOne({ roomId: decoded.roomId });
    if (!roomQR) {
      return { valid: false, canAccess: false, error: 'Room not found' };
    }

    // Check if guest is linked
    if (!roomQR.currentLink) {
      return {
        valid: true,
        roomId: decoded.roomId,
        roomNumber: decoded.roomNumber,
        hotelId: decoded.hotelId,
        hotelSlug: decoded.hotelSlug,
        canAccess: false,
        error: 'No guest linked to this room',
      };
    }

    // Check expiry
    if (new Date() > roomQR.currentLink.expiresAt) {
      return {
        valid: true,
        roomId: decoded.roomId,
        roomNumber: decoded.roomNumber,
        guestId: roomQR.currentLink.guestId,
        guestName: roomQR.currentLink.guestName,
        bookingId: roomQR.currentLink.bookingId,
        canAccess: false,
        error: 'QR has expired',
      };
    }

    // Update usage stats
    roomQR.useCount = (roomQR.useCount || 0) + 1;
    roomQR.lastUsedAt = new Date();
    await roomQR.save();

    return {
      valid: true,
      roomId: decoded.roomId,
      roomNumber: decoded.roomNumber,
      hotelId: decoded.hotelId,
      hotelSlug: decoded.hotelSlug,
      guestId: roomQR.currentLink.guestId,
      guestName: roomQR.currentLink.guestName,
      bookingId: roomQR.currentLink.bookingId,
      canAccess: true,
    };
  } catch (error: any) {
    return { valid: false, canAccess: false, error: error.message };
  }
}

/**
 * Create a service request from scanned QR
 */
export async function createServiceRequest(config: {
  roomId: string;
  requestType: string;
  items?: Array<{ name: string; quantity: number; pricePaise: number }>;
  specialInstructions?: string;
}): Promise<{ requestId: string }> {
  // Get room context
  const roomQR = await RoomQRTemplates.findOne({ roomId: config.roomId });
  if (!roomQR || !roomQR.currentLink) {
    throw new Error('Room not active or no guest linked');
  }

  const request = await RoomServiceRequests.create({
    roomId: config.roomId,
    roomNumber: roomQR.roomNumber,
    hotelId: roomQR.hotelId,
    guestId: roomQR.currentLink.guestId,
    guestName: roomQR.currentLink.guestName,
    guestPhone: roomQR.currentLink.guestPhone,
    requestType: config.requestType,
    items: config.items || [],
    specialInstructions: config.specialInstructions,
    status: 'pending',
  });

  return { requestId: request._id.toString() };
}

/**
 * Get active service requests for a room
 */
export async function getRoomServiceRequests(roomId: string): Promise<any[]> {
  return RoomServiceRequests.find({
    roomId,
    status: { $in: ['pending', 'acknowledged', 'in_progress'] },
  }).sort({ createdAt: -1 });
}

/**
 * Bulk generate QRs for all rooms in a hotel
 */
export async function bulkGenerateRoomQRs(hotelConfig: {
  hotelId: string;
  hotelName: string;
  hotelSlug: string;
  rooms: Array<{ roomId: string; roomNumber: string; floor?: string; roomType?: string }>;
}): Promise<{ generated: number; failed: number }> {
  let generated = 0;
  let failed = 0;

  for (const room of hotelConfig.rooms) {
    try {
      const qr = await generateRoomQRTemplate({
        ...hotelConfig,
        ...room,
      });

      await RoomQRTemplates.findOneAndUpdate(
        { roomId: room.roomId },
        {
          roomId: room.roomId,
          roomNumber: room.roomNumber,
          floor: room.floor,
          roomType: room.roomType,
          hotelId: hotelConfig.hotelId,
          hotelName: hotelConfig.hotelName,
          hotelSlug: hotelConfig.hotelSlug,
          token: qr.token,
          qrPayload: qr.qrPayload,
          qrImage: qr.qrImage,
          qrUrl: qr.qrUrl,
        },
        { upsert: true, new: true }
      );

      generated++;
    } catch (error) {
      console.error(`Failed to generate QR for room ${room.roomId}:`, error);
      failed++;
    }
  }

  return { generated, failed };
}
