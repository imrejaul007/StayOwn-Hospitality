import { DEFAULT_PUBLIC_HOTEL_ID } from '../constants/publicHotel';

/** Persisted choice when the guest returns without `?hotelId=` in the URL */
export const PUBLIC_GUEST_HOTEL_STORAGE_KEY = 'guest_public_selected_hotel_id';

export function isValidMongoIdLike(id: string | null | undefined): boolean {
  if (!id || typeof id !== 'string') return false;
  return /^[a-fA-F0-9]{24}$/.test(id.trim());
}

/**
 * Public booking flows: `?hotelId=` → localStorage → `VITE_PUBLIC_DEFAULT_HOTEL_ID` fallback.
 */
export function resolvePublicHotelId(searchParams: URLSearchParams): string {
  const fromUrl = searchParams.get('hotelId');
  if (isValidMongoIdLike(fromUrl)) return fromUrl!.trim();

  try {
    const stored = localStorage.getItem(PUBLIC_GUEST_HOTEL_STORAGE_KEY);
    if (isValidMongoIdLike(stored)) return stored!.trim();
  } catch {
    // ignore
  }

  return DEFAULT_PUBLIC_HOTEL_ID;
}

export function persistPublicHotelId(id: string): void {
  if (!isValidMongoIdLike(id)) return;
  try {
    localStorage.setItem(PUBLIC_GUEST_HOTEL_STORAGE_KEY, id.trim());
  } catch {
    // ignore
  }
}

export function hotelLabel(h: {
  name: string;
  address?: { city?: string; state?: string };
}): string {
  const city = h.address?.city?.trim();
  const state = h.address?.state?.trim();
  if (city && state) return `${h.name} — ${city}, ${state}`;
  if (city) return `${h.name} — ${city}`;
  return h.name;
}
