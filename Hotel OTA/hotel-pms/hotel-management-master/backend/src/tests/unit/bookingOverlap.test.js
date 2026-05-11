import mongoose from 'mongoose';
import Booking from '../../models/Booking.js';

const mockFindChain = (resolvedValue) => {
  const limit = jest.fn().mockResolvedValue(resolvedValue);
  const lean = jest.fn(() => ({ limit }));
  const session = jest.fn(() => ({ lean }));

  return { limit, lean, session };
};

describe('Booking.findOverlapping', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('builds canonical overlap query with hotel scope', async () => {
    const { lean, limit } = mockFindChain([]);
    const findSpy = jest.spyOn(Booking, 'find').mockReturnValue({ lean });

    const roomId = new mongoose.Types.ObjectId();
    const hotelId = new mongoose.Types.ObjectId();
    const checkIn = new Date('2026-04-10T00:00:00.000Z');
    const checkOut = new Date('2026-04-12T00:00:00.000Z');

    await Booking.findOverlapping(
      [roomId],
      checkIn,
      checkOut,
      { hotelId }
    );

    expect(findSpy).toHaveBeenCalledWith({
      'rooms.roomId': { $in: [roomId] },
      status: { $in: ['pending', 'confirmed', 'modified', 'checked_in'] },
      checkIn: { $lt: checkOut },
      checkOut: { $gt: checkIn },
      hotelId
    });
    expect(lean).toHaveBeenCalled();
    expect(limit).toHaveBeenCalledWith(1000);
  });

  it('supports backward compatibility for excludeBookingId argument', async () => {
    const { lean } = mockFindChain([]);
    const findSpy = jest.spyOn(Booking, 'find').mockReturnValue({ lean });

    const roomId = new mongoose.Types.ObjectId();
    const excludeBookingId = new mongoose.Types.ObjectId();

    await Booking.findOverlapping(
      [roomId],
      new Date('2026-05-01T00:00:00.000Z'),
      new Date('2026-05-03T00:00:00.000Z'),
      excludeBookingId
    );

    expect(findSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        _id: { $ne: excludeBookingId }
      })
    );
  });

  it('attaches session when provided', async () => {
    const { session } = mockFindChain([]);
    const findSpy = jest.spyOn(Booking, 'find').mockReturnValue({ session });
    const dbSession = { id: 'session-1' };

    await Booking.findOverlapping(
      [new mongoose.Types.ObjectId()],
      new Date('2026-06-01T00:00:00.000Z'),
      new Date('2026-06-02T00:00:00.000Z'),
      { session: dbSession }
    );

    expect(findSpy).toHaveBeenCalled();
    expect(session).toHaveBeenCalledWith(dbSession);
  });
});
