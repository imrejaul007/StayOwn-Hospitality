import mongoose from 'mongoose';

/**
 * Execute multiple database operations within a single MongoDB transaction.
 * If any operation fails, all changes are rolled back.
 *
 * @param {Function} operations - async function receiving (session) parameter
 * @returns {*} Result of the operations function
 *
 * Usage:
 *   const result = await withTransaction(async (session) => {
 *     const booking = await Booking.create([data], { session });
 *     await RoomAvailability.updateOne({ roomId }, { $set: { status: 'reserved' } }, { session });
 *     return booking;
 *   });
 */
export const withTransaction = async (operations) => {
  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      result = await operations(session);
    });
    return result;
  } finally {
    session.endSession();
  }
};
