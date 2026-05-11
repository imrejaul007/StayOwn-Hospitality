import { api } from './api';

/** Public `GET /room-types/hotel/:hotelId/options` — no auth required */
export interface PublicRoomTypeOption {
  id: string;
  name: string;
  code: string;
  basePrice: number;
  baseRate?: number;
  maxOccupancy: number;
  /** Lowercase code from API; may align with single|double|suite|deluxe */
  legacyType?: string;
  totalRooms?: number;
}

export async function fetchPublicRoomTypeOptions(hotelId: string): Promise<PublicRoomTypeOption[]> {
  const res = await api.get(`/room-types/hotel/${hotelId}/options`);
  const data = res.data?.data;
  return Array.isArray(data) ? data : [];
}

export interface PublicBookingAvailabilityResult {
  ok: boolean;
  skipped?: boolean;
  reason?: string;
  minAvailable?: number;
  nights?: number;
  roomsRequested?: number;
}

/** Pre-booking check against live RoomAvailability (ok=true if calendar rows are missing). */
export async function checkPublicBookingAvailability(params: {
  hotelId: string;
  roomTypeId: string;
  checkIn: string;
  checkOut: string;
  roomsCount?: number;
}): Promise<PublicBookingAvailabilityResult> {
  const res = await api.get(`/room-types/hotel/${params.hotelId}/booking-availability`, {
    params: {
      roomTypeId: params.roomTypeId,
      checkIn: params.checkIn,
      checkOut: params.checkOut,
      roomsCount: params.roomsCount ?? 1,
    },
  });
  const data = res.data?.data;
  if (data && typeof data.ok === 'boolean') {
    return data as PublicBookingAvailabilityResult;
  }
  return { ok: true, skipped: true, reason: 'unexpected_response' };
}
