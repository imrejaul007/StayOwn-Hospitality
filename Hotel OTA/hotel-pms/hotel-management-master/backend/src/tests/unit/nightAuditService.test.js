import Booking from '../../models/Booking.js';
import nightAuditService from '../../services/nightAuditService.js';

describe('night audit service', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('processes confirmed arrivals as no-shows using real documents', async () => {
    const bookingDocument = {
      _id: 'booking-1',
      totalAmount: 2000,
      ratePlanSnapshot: {
        cancellationPolicy: {
          penaltyPercentage: 50
        }
      },
      save: jest.fn().mockResolvedValue(undefined)
    };

    const limit = jest.fn().mockResolvedValue([bookingDocument]);
    jest.spyOn(Booking, 'find').mockReturnValue({ limit });

    const result = await nightAuditService.processNoShows('hotel-1', '2026-03-25');

    expect(Booking.find).toHaveBeenCalledWith(
      expect.objectContaining({
        hotelId: 'hotel-1',
        status: 'confirmed'
      })
    );
    expect(limit).toHaveBeenCalledWith(1000);
    expect(bookingDocument.status).toBe('no_show');
    expect(bookingDocument.noShowChargeAmount).toBe(1000);
    expect(bookingDocument.noShowChargeApplied).toBe(true);
    expect(bookingDocument.save).toHaveBeenCalled();
    expect(result).toEqual({
      detected: 1,
      processed: 1,
      chargesApplied: 1000
    });
  });
});
