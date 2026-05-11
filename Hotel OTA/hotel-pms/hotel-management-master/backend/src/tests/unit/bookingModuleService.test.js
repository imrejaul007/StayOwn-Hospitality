import bookingService from '../../modules/booking/service.js';
import bookingRepository from '../../modules/booking/repository.js';

describe('booking module service', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('prepares booking creation context with resolved rooms and totals', async () => {
    const roomId = '507f191e810c19729de860ea';
    const hotelId = '507f191e810c19729de860eb';
    const requestedUserId = '507f191e810c19729de860ec';

    jest.spyOn(bookingRepository, 'findByIdempotencyKey').mockResolvedValue(null);
    jest.spyOn(bookingRepository, 'findActiveRoomsByIds').mockResolvedValue([
      { _id: roomId, roomNumber: '101', currentRate: 1200, isActive: true }
    ]);
    jest.spyOn(bookingRepository, 'findOverlappingBookings').mockResolvedValue([]);

    const result = await bookingService.prepareBookingCreation({
      clientIdempotencyKey: 'client-key-1',
      requestedUserId,
      userId: requestedUserId,
      roomIds: [roomId],
      hotelId,
      checkIn: '2026-04-01',
      checkOut: '2026-04-03',
      totalAmount: 0,
      session: {}
    });

    expect(result.idempotencyKey).toBe('client-key-1');
    expect(result.nights).toBe(2);
    expect(result.roomsWithRates).toEqual([{ roomId, rate: 1200 }]);
    expect(result.calculatedTotal).toBe(2400);
  });

  it('builds restricted booking update data for guest role', () => {
    const updateData = bookingService.buildBookingUpdateData(
      {
        guestDetails: { adults: 2 },
        paymentStatus: 'paid',
        notes: 'should be ignored for guests'
      },
      'guest'
    );

    expect(updateData).toEqual({
      guestDetails: { adults: 2 }
    });
  });

  it('rejects cancel when guest does not own booking', () => {
    expect(() => {
      bookingService.assertCanModifyBooking(
        { userId: 'user-owner', hotelId: 'hotel-1' },
        { role: 'guest', _id: 'other-user' },
        'cancel'
      );
    }).toThrow('You do not have permission to cancel this booking');
  });

  it('finds room-change booking by id and initializes rooms', async () => {
    jest.spyOn(bookingRepository, 'findBookingByIdForUpdate').mockResolvedValue({
      _id: 'b1',
      status: 'confirmed',
      rooms: undefined
    });

    const booking = await bookingService.findBookingForRoomChange({
      bookingId: 'b1',
      guestName: null,
      checkIn: null,
      checkOut: null
    });

    expect(booking._id).toBe('b1');
    expect(Array.isArray(booking.rooms)).toBe(true);
  });

  it('rejects room assignment for terminal booking status', async () => {
    jest.spyOn(bookingRepository, 'findBookingByIdForUpdate').mockResolvedValue({
      _id: 'b2',
      status: 'cancelled',
      rooms: []
    });

    await expect(
      bookingService.findBookingForRoomChange({
        bookingId: 'b2',
        guestName: null,
        checkIn: null,
        checkOut: null
      })
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('rejects room assignment on room type mismatch', async () => {
    jest.spyOn(bookingRepository, 'findRoomById').mockResolvedValue({
      _id: 'room-2',
      roomType: 'suite',
      isActive: true
    });

    await expect(
      bookingService.validateRoomAssignment({
        booking: { roomType: 'single' },
        newRoomId: 'room-2',
        newRoomNumber: '202'
      })
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('rejects existing room change when booking has no rooms', () => {
    expect(() =>
      bookingService.applyExistingRoomChange({
        booking: { rooms: [] },
        newRoomId: 'room-1',
        newRoomNumber: '101',
        actorName: 'Staff',
        reason: 'Move'
      })
    ).toThrow('Booking has no rooms to change');
  });

  it('builds modification request payload with expected metadata', () => {
    const payload = bookingService.buildModificationRequest({
      booking: {
        checkIn: new Date('2026-04-01'),
        checkOut: new Date('2026-04-02'),
        roomType: 'single',
        totalAmount: 1000,
        guestDetails: { adults: 2 }
      },
      modificationType: 'date_change',
      requestedChanges: { checkOut: '2026-04-03' },
      reason: 'Need one more night',
      user: { _id: 'u1', name: 'Guest User', role: 'guest' },
      ip: '127.0.0.1'
    });

    expect(payload.modificationType).toBe('date_change');
    expect(payload.modifiedBy.source).toBe('guest');
    expect(payload.newValues).toEqual({ checkOut: '2026-04-03' });
  });

  it('rejects already reviewed modification request', () => {
    expect(() =>
      bookingService.findModificationRequestOrThrow(
        {
          modifications: [{ modificationId: 'm1', reason: 'foo REVIEWED: APPROVE by Admin' }]
        },
        'm1'
      )
    ).toThrow('Modification request has already been reviewed');
  });

  it('rejects check-in for unauthorized staff hotel', () => {
    expect(() =>
      bookingService.assertCanCheckInBooking(
        { hotelId: 'hotel-a' },
        { role: 'staff', hotelId: 'hotel-b' }
      )
    ).toThrow('You do not have permission to check-in this booking');
  });

  it('rejects check-in when booking has no assigned room', () => {
    expect(() =>
      bookingService.assertBookingCanBeCheckedIn({
        status: 'confirmed',
        rooms: []
      })
    ).toThrow('Cannot check in: no room assigned to this booking. Please assign a room first.');
  });

  it('rejects checkout when booking is not checked in', () => {
    expect(() =>
      bookingService.assertBookingCanBeCheckedOut({
        status: 'confirmed'
      })
    ).toThrow('Only checked-in bookings can be checked out');
  });

  it('validates settlement payment amounts sum to total', () => {
    expect(() =>
      bookingService.assertSettlementPaymentInput({
        paymentMethods: [{ amount: 100 }, { amount: 50 }],
        amount: 120
      })
    ).toThrow('Payment amounts do not match total');
  });

  it('rejects settlement adjustment with missing required fields', () => {
    expect(() =>
      bookingService.assertSettlementAdjustmentInput({
        type: 'other',
        amount: 10
      })
    ).toThrow('Type, amount, and description are required');
  });

  it('rejects booking access when hotel scope mismatches', () => {
    expect(() =>
      bookingService.assertBookingInUserHotel(
        { hotelId: 'hotel-a' },
        { hotelId: 'hotel-b' }
      )
    ).toThrow('Booking not found in your hotel');
  });
});
