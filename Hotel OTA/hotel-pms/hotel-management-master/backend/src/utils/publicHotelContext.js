import mongoose from 'mongoose';

/**
 * Default tenant for guest/public flows when JWT has no `hotelId` (e.g. role guest).
 * Must match frontend `DEFAULT_PUBLIC_HOTEL_ID` / `VITE_PUBLIC_DEFAULT_HOTEL_ID` per deployment.
 */
const ENV_FALLBACK = (process.env.PUBLIC_DEFAULT_HOTEL_ID || '').trim();
const HARDCODED_FALLBACK = '68cd01414419c17b5f6b4c12';

function toValidObjectIdString(value) {
  if (value == null || value === '') return null;
  const s = typeof value === 'object' && value?.toString
    ? value.toString()
    : String(value).trim();
  if (!s || s === 'undefined' || s === 'null') return null;
  return mongoose.Types.ObjectId.isValid(s) ? s : null;
}

/**
 * Resolve hotel scope for catalog and guest service APIs: user token → query/body → env → hardcoded default.
 */
export function resolvePublicHotelIdFromRequest(req) {
  const candidates = [
    req.user?.hotelId,
    req.query?.hotelId,
    req.body?.hotelId,
    ENV_FALLBACK || null,
    HARDCODED_FALLBACK
  ];
  for (const c of candidates) {
    const id = toValidObjectIdString(c);
    if (id) return id;
  }
  return HARDCODED_FALLBACK;
}
