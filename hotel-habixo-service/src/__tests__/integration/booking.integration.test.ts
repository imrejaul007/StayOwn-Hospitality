// Booking Integration Tests
import { Property } from '../../models/Property';
import { Booking } from '../../models/Booking';
import * as BookingService from '../../services/BookingService';
import { createMockProperty, createMockBooking, createDateRange } from './testData';
import { NotFoundError, ValidationError } from '../../utils/errors';

// Mock external services
jest.mock('../../integrations/rez-wallet', () => ({
  creditWallet: jest.fn().mockResolvedValue({ success: true, transactionId: 'mock-tx-123' }),
  debitWallet: jest.fn().mockResolvedValue({ success: true, transactionId: 'mock-tx-456' }),
  getWalletBalance: jest.fn().mockResolvedValue({ success: true, balance: 1000 }),
  RewardAmounts: {
    BOOKING_CONFIRMED: 50,
    RENT_PAYMENT: 25,
    REVIEW_SUBMITTED: 20,
    FIVE_STAR_REVIEW: 100,
    REFERRAL_SIGNUP: 100,
    STREAK_BONUS: 10,
  },
}));

jest.mock('../../integrations/rez-gamification', () => ({
  getUserStreak: jest.fn().mockResolvedValue({ streakCount: 5, longestStreak: 10 }),
  incrementStreak: jest.fn().mockResolvedValue(true),
  getStreakBonus: jest.fn().mockReturnValue(1.1),
}));

jest.mock('../../integrations/rez-karma', () => ({
  getKarmaStatus: jest.fn().mockResolvedValue({ success: true, karma: { level: 'L2', points: 150 } }),
  addKarmaPoints: jest.fn().mockResolvedValue(true),
  deductKarmaPoints: jest.fn().mockResolvedValue(true),
  checkKarmaUpgrade: jest.fn().mockResolvedValue({ upgraded: false }),
  KarmaBenefits: {
    L1: { name: 'New', trustBoost: 0, benefits: [] },
    L2: { name: 'Trusted', trustBoost: 5, benefits: ['Priority support'] },
    L3: { name: 'Valued', trustBoost: 10, benefits: ['Discounts'] },
    L4: { name: 'Elite', trustBoost: 15, benefits: ['VIP access'] },
  },
}));

jest.mock('../../integrations/rez-mind', () => ({
  captureIntent: jest.fn().mockResolvedValue(true),
  HabixoIntents: {
    stayBooked: jest.fn().mockReturnValue({
      appType: 'habixo_stay',
      category: 'TRAVEL',
      eventType: 'fulfilled',
      intentKey: 'mock_intent_key',
      metadata: {},
    }),
  },
}));

jest.mock('../../integrations/external-services', () => ({
  httpRequest: jest.fn().mockResolvedValue({ success: true, data: {} }),
  getServiceUrl: jest.fn().mockReturnValue('http://mock-service'),
}));

describe('Booking Integration Tests', () => {
  let testProperty: any;

  beforeEach(async () => {
    // Create a test property for booking tests
    const mockProperty = createMockProperty({
      status: 'active',
      pricing: {
        basePrice: 2000,
        cleaningFee: 500,
        serviceFee: 0,
        weeklyDiscount: 10,
        monthlyDiscount: 20,
        currency: 'INR',
      },
      availability: {
        checkInTime: '14:00',
        checkOutTime: '11:00',
        minNights: 1,
        maxNights: 30,
      },
    });
    testProperty = await new Property(mockProperty).save();
  });

  describe('createBooking', () => {
    it('should create a booking with valid property', async () => {
      const { checkIn, checkOut } = createDateRange(7, 3);

      const booking = await BookingService.createBooking({
        propertyId: testProperty.propertyId,
        guestId: 'guest_123',
        hostId: testProperty.hostId,
        brand: 'habixo_stay',
        checkIn: checkIn.toISOString(),
        checkOut: checkOut.toISOString(),
        guests: { adults: 2, children: 0, infants: 0 },
      });

      expect(booking).toBeDefined();
      expect(booking.bookingId).toMatch(/^HBK-[A-Z0-9]+$/);
      expect(booking.propertyId).toBe(testProperty.propertyId);
      expect(booking.status).toBe('confirmed');
      expect(booking.totalNights).toBe(3);
    });

    it('should calculate pricing correctly', async () => {
      const { checkIn, checkOut } = createDateRange(7, 3);

      const booking = await BookingService.createBooking({
        propertyId: testProperty.propertyId,
        guestId: 'guest_123',
        hostId: testProperty.hostId,
        brand: 'habixo_stay',
        checkIn: checkIn.toISOString(),
        checkOut: checkOut.toISOString(),
        guests: { adults: 2 },
      });

      // Base: 2000 * 3 = 6000
      expect(booking.pricing.subtotal).toBe(6000);
      // Cleaning fee: 500
      expect(booking.pricing.cleaningFee).toBe(500);
      // Service fee: 6000 * 0.03 = 180
      expect(booking.pricing.serviceFee).toBe(180);
      // Total: 6000 + 500 + 180 + taxes - discount
      expect(booking.pricing.total).toBeGreaterThan(6000);
    });

    it('should apply weekly discount for 7+ nights', async () => {
      const checkIn = new Date();
      checkIn.setDate(checkIn.getDate() + 7);
      const checkOut = new Date(checkIn);
      checkOut.setDate(checkOut.getDate() + 7); // 7 nights

      const booking = await BookingService.createBooking({
        propertyId: testProperty.propertyId,
        guestId: 'guest_123',
        hostId: testProperty.hostId,
        brand: 'habixo_stay',
        checkIn: checkIn.toISOString(),
        checkOut: checkOut.toISOString(),
        guests: { adults: 2 },
      });

      expect(booking.pricing.discount).toBeGreaterThan(0);
    });

    it('should throw NotFoundError for non-existent property', async () => {
      const { checkIn, checkOut } = createDateRange(7, 3);

      await expect(
        BookingService.createBooking({
          propertyId: 'NONEXISTENT',
          guestId: 'guest_123',
          hostId: 'host_123',
          brand: 'habixo_stay',
          checkIn: checkIn.toISOString(),
          checkOut: checkOut.toISOString(),
          guests: { adults: 2 },
        })
      ).rejects.toThrow(NotFoundError);
    });

    it('should throw ValidationError for inactive property', async () => {
      const inactiveProperty = await new Property({
        ...createMockProperty(),
        status: 'inactive',
      }).save();

      const { checkIn, checkOut } = createDateRange(7, 3);

      await expect(
        BookingService.createBooking({
          propertyId: inactiveProperty.propertyId,
          guestId: 'guest_123',
          hostId: inactiveProperty.hostId,
          brand: 'habixo_stay',
          checkIn: checkIn.toISOString(),
          checkOut: checkOut.toISOString(),
          guests: { adults: 2 },
        })
      ).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError for stay below minimum nights', async () => {
      const { checkIn, checkOut } = createDateRange(7, 0);

      await expect(
        BookingService.createBooking({
          propertyId: testProperty.propertyId,
          guestId: 'guest_123',
          hostId: testProperty.hostId,
          brand: 'habixo_stay',
          checkIn: checkIn.toISOString(),
          checkOut: checkOut.toISOString(),
          guests: { adults: 2 },
        })
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('getBookingById', () => {
    it('should retrieve a booking by ID', async () => {
      const { checkIn, checkOut } = createDateRange(7, 3);
      const created = await BookingService.createBooking({
        propertyId: testProperty.propertyId,
        guestId: 'guest_123',
        hostId: testProperty.hostId,
        brand: 'habixo_stay',
        checkIn: checkIn.toISOString(),
        checkOut: checkOut.toISOString(),
        guests: { adults: 2 },
      });

      const retrieved = await BookingService.getBookingById(created.bookingId);

      expect(retrieved.bookingId).toBe(created.bookingId);
      expect(retrieved.propertyId).toBe(testProperty.propertyId);
    });

    it('should throw NotFoundError for non-existent booking', async () => {
      await expect(BookingService.getBookingById('NONEXISTENT'))
        .rejects
        .toThrow(NotFoundError);
    });
  });

  describe('cancelBooking', () => {
    it('should cancel a booking', async () => {
      const { checkIn, checkOut } = createDateRange(7, 3);
      const booking = await BookingService.createBooking({
        propertyId: testProperty.propertyId,
        guestId: 'guest_123',
        hostId: testProperty.hostId,
        brand: 'habixo_stay',
        checkIn: checkIn.toISOString(),
        checkOut: checkOut.toISOString(),
        guests: { adults: 2 },
      });

      const cancelled = await BookingService.cancelBooking(booking.bookingId, 'guest');

      expect(cancelled.status).toBe('cancelled');
    });

    it('should throw NotFoundError for cancelling non-existent booking', async () => {
      await expect(BookingService.cancelBooking('NONEXISTENT', 'guest'))
        .rejects
        .toThrow(NotFoundError);
    });
  });

  describe('completeBooking', () => {
    it('should complete a booking and update property stats', async () => {
      const { checkIn, checkOut } = createDateRange(7, 3);
      const booking = await BookingService.createBooking({
        propertyId: testProperty.propertyId,
        guestId: 'guest_123',
        hostId: testProperty.hostId,
        brand: 'habixo_stay',
        checkIn: checkIn.toISOString(),
        checkOut: checkOut.toISOString(),
        guests: { adults: 2 },
      });

      const initialStats = await Property.findOne({ propertyId: testProperty.propertyId });
      const initialBookings = initialStats?.stats.totalBookings || 0;

      await BookingService.completeBooking(booking.bookingId);

      const updatedStats = await Property.findOne({ propertyId: testProperty.propertyId });
      expect(updatedStats?.stats.totalBookings).toBe(initialBookings + 1);
    });
  });

  describe('searchBookings', () => {
    beforeEach(async () => {
      // Create multiple bookings
      for (let i = 0; i < 5; i++) {
        const { checkIn, checkOut } = createDateRange(7 + i, 3);
        await BookingService.createBooking({
          propertyId: testProperty.propertyId,
          guestId: `guest_${i}`,
          hostId: testProperty.hostId,
          brand: 'habixo_stay',
          checkIn: checkIn.toISOString(),
          checkOut: checkOut.toISOString(),
          guests: { adults: 2 },
        });
      }
    });

    it('should search bookings by guest ID', async () => {
      const result = await BookingService.searchBookings({
        guestId: 'guest_0',
      });

      expect(result.bookings.length).toBeGreaterThanOrEqual(1);
      result.bookings.forEach((b) => {
        expect(b.guestId).toBe('guest_0');
      });
    });

    it('should search bookings by host ID', async () => {
      const result = await BookingService.searchBookings({
        hostId: testProperty.hostId,
      });

      expect(result.total).toBeGreaterThanOrEqual(5);
      result.bookings.forEach((b) => {
        expect(b.hostId).toBe(testProperty.hostId);
      });
    });

    it('should search bookings by property ID', async () => {
      const result = await BookingService.searchBookings({
        propertyId: testProperty.propertyId,
      });

      expect(result.total).toBeGreaterThanOrEqual(5);
      result.bookings.forEach((b) => {
        expect(b.propertyId).toBe(testProperty.propertyId);
      });
    });

    it('should search bookings by status', async () => {
      const result = await BookingService.searchBookings({
        status: 'confirmed',
      });

      result.bookings.forEach((b) => {
        expect(b.status).toBe('confirmed');
      });
    });

    it('should paginate results', async () => {
      const page1 = await BookingService.searchBookings({
        page: 1,
        limit: 2,
      });

      expect(page1.bookings.length).toBeLessThanOrEqual(2);
      expect(page1.page).toBe(1);
      expect(page1.totalPages).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Lifecycle Hooks', () => {
    it('should trigger coins reward on booking confirmation', async () => {
      const { checkIn, checkOut } = createDateRange(7, 3);
      const booking = await BookingService.createBooking({
        propertyId: testProperty.propertyId,
        guestId: 'guest_lifecycle_test',
        hostId: testProperty.hostId,
        brand: 'habixo_stay',
        checkIn: checkIn.toISOString(),
        checkOut: checkOut.toISOString(),
        guests: { adults: 2 },
      });

      // Wait for lifecycle hooks to complete
      await new Promise((resolve) => setTimeout(resolve, 100));

      const updatedBooking = await Booking.findOne({ bookingId: booking.bookingId });
      expect(updatedBooking?.lifecycleHooks.coinsRewarded).toBe(true);
    });

    it('should trigger streak update on booking', async () => {
      const { checkIn, checkOut } = createDateRange(7, 3);
      const booking = await BookingService.createBooking({
        propertyId: testProperty.propertyId,
        guestId: 'guest_streak_test',
        hostId: testProperty.hostId,
        brand: 'habixo_stay',
        checkIn: checkIn.toISOString(),
        checkOut: checkOut.toISOString(),
        guests: { adults: 2 },
      });

      // Wait for lifecycle hooks
      await new Promise((resolve) => setTimeout(resolve, 100));

      const updatedBooking = await Booking.findOne({ bookingId: booking.bookingId });
      expect(updatedBooking?.lifecycleHooks.streakUpdated).toBe(true);
    });

    it('should trigger karma update on booking', async () => {
      const { checkIn, checkOut } = createDateRange(7, 3);
      const booking = await BookingService.createBooking({
        propertyId: testProperty.propertyId,
        guestId: 'guest_karma_test',
        hostId: testProperty.hostId,
        brand: 'habixo_stay',
        checkIn: checkIn.toISOString(),
        checkOut: checkOut.toISOString(),
        guests: { adults: 2 },
      });

      // Wait for lifecycle hooks
      await new Promise((resolve) => setTimeout(resolve, 100));

      const updatedBooking = await Booking.findOne({ bookingId: booking.bookingId });
      expect(updatedBooking?.lifecycleHooks.karmaUpdated).toBe(true);
    });
  });
});
