import crypto, { timingSafeEqual } from 'crypto';
import dayjs from 'dayjs';

/**
 * Safely extract a single string from Express query param (which may be string | string[])
 */
export function qstr(val: unknown): string | undefined {
  if (typeof val === 'string') return val;
  if (Array.isArray(val) && typeof val[0] === 'string') return val[0];
  return undefined;
}

/**
 * Generate a human-readable booking reference: OTA-BLR-YYYY-XXXXX
 */
export function generateBookingRef(): string {
  const year = dayjs().year();
  const seq = crypto.randomInt(10000, 99999);
  return `OTA-BLR-${year}-${seq}`;
}

/**
 * Generate a random 6-digit OTP
 */
export function generateOtp(): string {
  return crypto.randomInt(100000, 999999).toString();
}

/**
 * Generate a random reference string
 */
export function generateRef(prefix: string = ''): string {
  const id = crypto.randomBytes(12).toString('hex');
  return prefix ? `${prefix}_${id}` : id;
}

/**
 * Calculate HMAC SHA256 signature
 */
export function hmacSha256(data: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(data).digest('hex');
}

/**
 * Verify HMAC SHA256 signature (timing-safe)
 */
export function verifyHmac(data: string, secret: string, signature: string): boolean {
  const expected = hmacSha256(data, secret);
  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false;
  }
}

/**
 * Calculate number of nights between two dates
 */
export function calculateNights(checkin: string | Date, checkout: string | Date): number {
  return dayjs(checkout).diff(dayjs(checkin), 'day');
}
