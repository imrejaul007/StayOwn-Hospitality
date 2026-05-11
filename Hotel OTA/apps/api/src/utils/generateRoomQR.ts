import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';

interface QRData {
  roomId: string;
  roomNumber: string;
  roomType: string;
  floor?: string;
  hotelId?: string;
}

interface QRResult {
  qrCodeDataUrl: string;
  printUrl: string;
  qrData: string;
  signature?: string;
}

/**
 * Generate a QR code for a room
 *
 * QR payload format:
 * {
 *   intent: 'room-hub',
 *   roomId: string,
 *   roomNumber: string,
 *   roomType: string,
 *   floor: string,
 *   hotelSlug: string,
 *   expiresAt: string, // ISO date
 *   timestamp: number,
 *   signature: string  // HMAC-SHA256
 * }
 */
export async function generateRoomQR(
  roomData: QRData,
  secret: string
): Promise<QRResult> {
  const APP_URL = process.env.FRONTEND_URL || 'https://hotel-ota.vercel.app';

  // Generate unique room ID if not provided
  const roomId = roomData.roomId || uuidv4();

  // Create QR payload
  const expiresAt = new Date();
  expiresAt.setFullYear(expiresAt.getFullYear() + 1); // QR valid for 1 year

  const payload = {
    intent: 'room-hub',
    roomId,
    roomNumber: roomData.roomNumber,
    roomType: roomData.roomType,
    floor: roomData.floor || '1',
    timestamp: Date.now(),
    expiresAt: expiresAt.toISOString(),
  };

  // Sign the payload
  const payloadStr = JSON.stringify(payload);
  const signature = crypto
    .createHmac('sha256', secret || process.env.ROOM_QR_SECRET || 'dev-secret')
    .update(payloadStr)
    .digest('hex')
    .slice(0, 16);

  const signedPayload = {
    ...payload,
    signature,
  };

  // Encode as base64 for compact QR code
  const qrData = Buffer.from(JSON.stringify(signedPayload)).toString('base64');

  // Generate SVG QR code (simple implementation)
  // In production, use a proper QR library like 'qrcode'
  const qrCodeDataUrl = await generateSVGQRCode(qrData, roomData.roomNumber);

  // Print URL for individual room
  const printUrl = `${APP_URL}/print/room-qr/${roomId}`;

  return {
    qrCodeDataUrl,
    printUrl,
    qrData,
    signature,
  };
}

/**
 * Generate an SVG-based QR code representation
 * In production, replace with actual QR code generation library
 */
async function generateSVGQRCode(data: string, roomNumber?: string): Promise<string> {
  // Generate a simple QR-like pattern based on data
  // In production, use 'qrcode' npm package

  // Simple QR pattern generator
  const size = 200;
  const modules = 25; // QR code matrix size
  const moduleSize = size / modules;

  // Generate pattern from data hash
  const hash = crypto.createHash('md5').update(data).digest('hex');
  const pattern: boolean[][] = [];

  // Position patterns (finder patterns)
  const positionPatterns = [
    { x: 0, y: 0 },
    { x: modules - 7, y: 0 },
    { x: 0, y: modules - 7 },
  ];

  for (let y = 0; y < modules; y++) {
    pattern[y] = [];
    for (let x = 0; x < modules; x++) {
      // Check if we're in a position pattern area
      let isPositionPattern = false;
      for (const pos of positionPatterns) {
        if (
          x >= pos.x &&
          x < pos.x + 7 &&
          y >= pos.y &&
          y < pos.y + 7
        ) {
          isPositionPattern = true;
          // Create finder pattern
          const px = x - pos.x;
          const py = y - pos.y;
          if (
            (px === 0 || px === 6 || py === 0 || py === 6) &&
            px >= 0 &&
            px <= 6 &&
            py >= 0 &&
            py <= 6
          ) {
            pattern[y][x] = true;
          } else if (px >= 2 && px <= 4 && py >= 2 && py <= 4) {
            pattern[y][x] = true;
          } else {
            pattern[y][x] = false;
          }
          break;
        }
      }

      if (!isPositionPattern) {
        // Data modules based on hash
        const hashIndex = (x + y) % hash.length;
        const bit = parseInt(hash[hashIndex], 16);
        pattern[y][x] = bit % 2 === 0;
      }
    }
  }

  // Generate SVG
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">`;

  // White background
  svg += `<rect fill="white" width="${size}" height="${size}"/>`;

  // Draw modules
  for (let y = 0; y < modules; y++) {
    for (let x = 0; x < modules; x++) {
      if (pattern[y][x]) {
        svg += `<rect fill="black" x="${x * moduleSize}" y="${y * moduleSize}" width="${moduleSize}" height="${moduleSize}"/>`;
      }
    }
  }

  // Add room number label
  if (roomNumber) {
    svg += `<text x="${size / 2}" y="${size - 5}" text-anchor="middle" font-family="Arial, sans-serif" font-size="16" font-weight="bold" fill="black">${roomNumber}</text>`;
  }

  svg += '</svg>';

  // Convert to data URL
  const base64 = Buffer.from(svg).toString('base64');
  return `data:image/svg+xml;base64,${base64}`;
}

/**
 * Validate a room QR payload
 */
export function validateRoomQRPayload(payload: any, secret: string): boolean {
  if (!payload || typeof payload !== 'object') {
    return false;
  }

  const { signature, ...data } = payload;

  if (!signature || !data.roomId || !data.roomNumber) {
    return false;
  }

  // Verify signature
  const dataStr = JSON.stringify(data);
  const expectedSig = crypto
    .createHmac('sha256', secret || process.env.ROOM_QR_SECRET || 'dev-secret')
    .update(dataStr)
    .digest('hex')
    .slice(0, 16);

  if (signature !== expectedSig) {
    return false;
  }

  // Check expiration
  if (payload.expiresAt) {
    const expiresAt = new Date(payload.expiresAt);
    if (expiresAt < new Date()) {
      return false;
    }
  }

  return true;
}

/**
 * Generate bulk QR codes for multiple rooms
 */
export async function generateBulkRoomQRCodes(
  rooms: QRData[],
  secret: string
): Promise<QRResult[]> {
  const results = await Promise.all(
    rooms.map((room) => generateRoomQR(room, secret))
  );

  return results;
}
