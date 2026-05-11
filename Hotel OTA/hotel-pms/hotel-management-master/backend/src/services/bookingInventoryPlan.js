import mongoose from 'mongoose';
import Room from '../models/Room.js';

/**
 * Room-type counts for RoomAvailability calendar (physical rooms and/or primary room type).
 * @param {import('mongoose').Document | Record<string, unknown>} booking
 * @returns {Promise<Map<string, number>>} roomType ObjectId string -> count
 */
export async function getRoomTypeCountsForBooking(booking) {
  const counts = new Map();

  if (booking.rooms?.length > 0) {
    const roomLineIds = booking.rooms
      .map((line) => line.roomId?._id || line.roomId)
      .filter(Boolean);
    const roomsFromDb =
      roomLineIds.length > 0
        ? await Room.find({ _id: { $in: roomLineIds } }).select('roomTypeId').lean()
        : [];
    const roomTypeByRoomId = new Map(
      roomsFromDb.map((r) => [r._id.toString(), r.roomTypeId])
    );

    for (const line of booking.rooms) {
      const rid = line.roomId?._id || line.roomId;
      if (!rid) continue;
      let rtid = line.roomTypeId ? String(line.roomTypeId) : null;
      if (!rtid || !mongoose.Types.ObjectId.isValid(rtid)) {
        const fromRoom = roomTypeByRoomId.get(String(rid));
        rtid = fromRoom ? String(fromRoom) : null;
      }
      if (!rtid || !mongoose.Types.ObjectId.isValid(rtid)) continue;
      counts.set(rtid, (counts.get(rtid) || 0) + 1);
    }
    return counts;
  }

  const pr = booking.primaryRoomTypeId?._id || booking.primaryRoomTypeId;
  if (pr && mongoose.Types.ObjectId.isValid(String(pr))) {
    const qty = Math.max(1, Number(booking.primaryRoomQuantity) || 1);
    counts.set(String(pr), qty);
  }

  return counts;
}

/**
 * @param {import('mongoose').Types.ObjectId|string} hotelId
 * @param {Date} checkIn
 * @param {Date} checkOut
 * @param {Map<string, number>} counts
 * @returns {Array<{ hotelId: import('mongoose').Types.ObjectId, roomTypeId: string, checkIn: Date, checkOut: Date, roomsCount: number }>}
 */
export function expandPlan(hotelId, checkIn, checkOut, counts) {
  const hid = hotelId;
  const entries = [];
  for (const [roomTypeId, roomsCount] of counts) {
    entries.push({
      hotelId: hid,
      roomTypeId,
      checkIn,
      checkOut,
      roomsCount
    });
  }
  return entries;
}

function serializePlan(entries) {
  return JSON.stringify(
    entries.map((e) => ({
      roomTypeId: String(e.roomTypeId),
      roomsCount: e.roomsCount,
      checkIn: new Date(e.checkIn).toISOString().slice(0, 10),
      checkOut: new Date(e.checkOut).toISOString().slice(0, 10)
    }))
  );
}

/**
 * @param {Array<{ roomTypeId: string, checkIn: Date, checkOut: Date, roomsCount: number }>} a
 * @param {Array<{ roomTypeId: string, checkIn: Date, checkOut: Date, roomsCount: number }>} b
 */
export function inventoryPlansEqual(a, b) {
  return serializePlan(a) === serializePlan(b);
}

/**
 * True if PATCH body may affect calendar-linked inventory.
 * @param {Record<string, unknown>} updateData
 */
export function patchTouchesInventory(updateData) {
  if (!updateData || typeof updateData !== 'object') return false;
  return (
    updateData.checkIn !== undefined ||
    updateData.checkOut !== undefined ||
    updateData.rooms !== undefined ||
    updateData.primaryRoomTypeId !== undefined ||
    updateData.primaryRoomQuantity !== undefined
  );
}
