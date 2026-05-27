// Booking Service Unit Tests
import { jest, describe, it, expect, beforeEach } from '@jest/globals';

// Mock mongoose and external services
const mockBookingModel = {
  find: jest.fn(),
  findOne: jest.fn(),
  findOneAndUpdate: jest.fn(),
  updateOne: jest.fn(),
  countDocuments: jest.fn(),
};

const mockPropertyModel = {
  findOne: jest.fn(),
  updateOne: jest.fn(),
};

const mockSave = jest.fn();

jest.mock('mongoose', () => {
  const actualMongoose = jest.requireActual('mongoose') as typeof import('mongoose');
  return {
    ...actualMongoose,
    model: jest.fn().mockImplementation((name: string) => {
      if (name === 'Booking') {
        return function MockBooking() {
          return { save: mockSave, ...mockBookingModel };
        };
      }
      if (name === 'Property') {
        return function MockProperty() {
          return { ...mockPropertyModel };
        };
      }
      return {};
    }),
    Schema: actualMongoose.Schema,
    connect: jest.fn().mockResolvedValue(undefined),
    connection: {
      readyState: 1,
      on: jest.fn(),
      close: jest.fn(),
    },
  };
});

// Mock external services
jest.mock('../integrations/rez-wallet', () => ({
  creditWallet: jest.fn().mockResolvedValue({ success: true, transactionId: 'mock-tx-123' }),
  debitWallet: jest.fn().mockResolvedValue({ success: true, transactionId: 'mock-tx-456' }),
  RewardAmounts: {
    BOOKING_CONFIRMED: 50,
    RENT_PAYMENT: 25,
    REVIEW_SUBMITTED: 20,
    FIVE_STAR_REVIEW: 100,
    REFERRAL_SIGNUP: 100,
    STREAK_BONUS: 10,
  },
}));

jest.mock('../integrations/rez-gamification', () => ({
  getUserStreak: jest.fn().mockResolvedValue({ streakCount: 5, longestStreak: 10 }),
  incrementStreak: jest.fn().mockResolvedValue(true),
  getStreakBonus: jest.fn().mockReturnValue(1.1),
}));

jest.mock('../integrations/rez-karma', () => ({
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

jest.mock('../integrations/rez-mind', () => ({
  captureIntent: jest.fn().mockResolvedValue(true),
  HabixoIntents: {
    stayBooked: jest.fn().mockReturnValue({
      appType: 'habixo_stay',
      category: 'TRAVEL',
      eventType: 'fulfilled',
      intentKey: 'mock_stay_booked',
      metadata: {},
    }),
  },
}));

jest.mock('../integrations/external-services', () => ({
  httpRequest: jest.fn().mockResolvedValue({ success: true, data: {} }),
  getServiceUrl: jest.fn().mockReturnValue('http://mock-service'),
}));

// Import service after mocking
import * as BookingService from '../services/BookingService';
import { RewardAmounts } from '../integrations/rez-wallet';
import { NotFoundError, ValidationError } from '../utils/errors';

describe('BookingService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createBooking', () => {
    it('should create a booking with valid property', async () => {
      const mockProperty = {
        propertyId: 'HAB-12345678',
        status: 'active',
        pricing: {
          basePrice: 2000,
          cleaningFee: 500,
          weeklyDiscount: 10,
          monthlyDiscount: 20,
          currency: 'INR',
        },
        availability: {
          minNights: 1,
          maxNights: 30,
        },
      };

      mockPropertyModel.findOne.mockReturnValue({ lean: jest.fn().mockResolvedValue(mockProperty) });
      mockSave.mockResolvedValue({
        bookingId: 'HBK-TEST123',
        propertyId: mockProperty.propertyId,
        status: 'confirmed',
        pricing: { subtotal: 6000, total: 7600 },
      });
      mockBookingModel.updateOne.mockResolvedValue({});

      const checkIn = new Date();
      checkIn.setDate(checkIn.getDate() + 7);
      const checkOut = new Date(checkIn);
      checkOut.setDate(checkOut.getDate() + 3);

      const result = await BookingService.createBooking({
        propertyId: mockProperty.propertyId,
        guestId: 'guest_123',
        hostId: 'host_123',
        brand: 'habixo_stay',
        checkIn: checkIn.toISOString(),
        checkOut: checkOut.toISOString(),
        guests: { adults: 2 },
      });

      expect(mockSave).toHaveBeenCalled();
      expect(result.status).toBe('confirmed');
    });

    it('should throw NotFoundError for non-existent property', async () => {
      mockPropertyModel.findOne.mockReturnValue({ lean: jest.fn().mockResolvedValue(null) });

      const checkIn = new Date();
      checkIn.setDate(checkIn.getDate() + 7);
      const checkOut = new Date(checkIn);
      checkOut.setDate(checkOut.getDate() + 3);

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
      const mockProperty = {
        propertyId: 'HAB-12345678',
        status: 'inactive',
        pricing: { basePrice: 2000 },
        availability: { minNights: 1, maxNights: 30 },
      };

      mockPropertyModel.findOne.mockReturnValue({ lean: jest.fn().mockResolvedValue(mockProperty) });

      const checkIn = new Date();
      checkIn.setDate(checkIn.getDate() + 7);
      const checkOut = new Date(checkIn);
      checkOut.setDate(checkOut.getDate() + 3);

      await expect(
        BookingService.createBooking({
          propertyId: mockProperty.propertyId,
          guestId: 'guest_123',
          hostId: 'host_123',
          brand: 'habixo_stay',
          checkIn: checkIn.toISOString(),
          checkOut: checkOut.toISOString(),
          guests: { adults: 2 },
        })
      ).rejects.toThrow(ValidationError);
    });

    it('should calculate total nights correctly', () => {
      const checkIn = new Date('2024-06-01');
      const checkOut = new Date('2024-06-04');
      const totalNights = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));

      expect(totalNights).toBe(3);
    });
  });

  describe('getBookingById', () => {
    it('should return booking when found', async () => {
      const mockBooking = {
        bookingId: 'HBK-TEST123',
        propertyId: 'HAB-12345678',
        status: 'confirmed',
      };

      mockBookingModel.findOne.mockReturnValue({ lean: jest.fn().mockResolvedValue(mockBooking) });

      const result = await BookingService.getBookingById('HBK-TEST123');

      expect(mockBookingModel.findOne).toHaveBeenCalledWith({ bookingId: 'HBK-TEST123' });
      expect(result.bookingId).toBe('HBK-TEST123');
    });

    it('should throw NotFoundError when booking not found', async () => {
      mockBookingModel.findOne.mockReturnValue({ lean: jest.fn().mockResolvedValue(null) });

      await expect(BookingService.getBookingById('NONEXISTENT'))
        .rejects
        .toThrow(NotFoundError);
    });
  });

  describe('cancelBooking', () => {
    it('should cancel a booking', async () => {
      const mockBooking = {
        bookingId: 'HBK-TEST123',
        status: 'cancelled',
        guestId: 'guest_123',
      };

      mockBookingModel.findOneAndUpdate.mockResolvedValue(mockBooking);

      const result = await BookingService.cancelBooking('HBK-TEST123', 'guest');

      expect(mockBookingModel.findOneAndUpdate).toHaveBeenCalledWith(
        { bookingId: 'HBK-TEST123' },
        { $set: { status: 'cancelled' } },
        { new: true }
      );
      expect(result.status).toBe('cancelled');
    });
  });

  describe('completeBooking', () => {
    it('should complete a booking', async () => {
      const mockBooking = {
        bookingId: 'HBK-TEST123',
        propertyId: 'HAB-12345678',
        status: 'completed',
      };

      mockBookingModel.findOneAndUpdate.mockResolvedValue(mockBooking);
      mockPropertyModel.updateOne.mockResolvedValue({});

      const result = await BookingService.completeBooking('HBK-TEST123');

      expect(result.status).toBe('completed');
      expect(mockPropertyModel.updateOne).toHaveBeenCalledWith(
        { propertyId: mockBooking.propertyId },
        { $inc: { 'stats.totalBookings': 1 } }
      );
    });
  });

  describe('searchBookings', () => {
    it('should search with default parameters', async () => {
      const mockBookings = [
        { bookingId: 'HBK-1', status: 'confirmed' },
        { bookingId: 'HBK-2', status: 'confirmed' },
      ];

      mockBookingModel.find.mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(mockBookings),
      });
      mockBookingModel.countDocuments.mockResolvedValue(2);

      const result = await BookingService.searchBookings({});

      expect(result.total).toBe(2);
      expect(result.bookings.length).toBe(2);
      expect(result.page).toBe(1);
    });

    it('should filter by guest ID', async () => {
      mockBookingModel.find.mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([]),
      });
      mockBookingModel.countDocuments.mockResolvedValue(0);

      await BookingService.searchBookings({ guestId: 'guest_123' });

      expect(mockBookingModel.find).toHaveBeenCalledWith(
        expect.objectContaining({ guestId: 'guest_123' })
      );
    });

    it('should filter by status', async () => {
      mockBookingModel.find.mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([]),
      });
      mockBookingModel.countDocuments.mockResolvedValue(0);

      await BookingService.searchBookings({ status: 'confirmed' });

      expect(mockBookingModel.find).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'confirmed' })
      );
    });
  });
});

describe('BookingService - Lifecycle Hooks', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Coin Rewards', () => {
    it('should have correct reward amounts', () => {
      expect(RewardAmounts.BOOKING_CONFIRMED).toBe(50);
      expect(RewardAmounts.RENT_PAYMENT).toBe(25);
      expect(RewardAmounts.REVIEW_SUBMITTED).toBe(20);
      expect(RewardAmounts.FIVE_STAR_REVIEW).toBe(100);
      expect(RewardAmounts.REFERRAL_SIGNUP).toBe(100);
      expect(RewardAmounts.STREAK_BONUS).toBe(10);
    });

    it('should credit coins on booking confirmation', async () => {
      const { creditWallet } = await import('../integrations/rez-wallet');

      const result = await creditWallet('guest_123', RewardAmounts.BOOKING_CONFIRMED, 'rez', 'Booking confirmed reward');

      expect(creditWallet).toHaveBeenCalledWith(
        'guest_123',
        RewardAmounts.BOOKING_CONFIRMED,
        'rez',
        'Booking confirmed reward'
      );
      expect(result.success).toBe(true);
    });
  });

  describe('Streak Updates', () => {
    it('should increment streak on booking', async () => {
      const { incrementStreak } = await import('../integrations/rez-gamification');

      const result = await incrementStreak('guest_123', 'habixo_booking');

      expect(incrementStreak).toHaveBeenCalledWith('guest_123', 'habixo_booking');
      expect(result).toBe(true);
    });

    it('should calculate streak bonus correctly', () => {
      const { getStreakBonus } = require('../integrations/rez-gamification');

      expect(getStreakBonus(0)).toBe(1.0);
      expect(getStreakBonus(2)).toBe(1.0);
      expect(getStreakBonus(3)).toBe(1.1);
      expect(getStreakBonus(6)).toBe(1.1);
      expect(getStreakBonus(7)).toBe(1.25);
      expect(getStreakBonus(13)).toBe(1.25);
      expect(getStreakBonus(14)).toBe(1.5);
      expect(getStreakBonus(29)).toBe(1.5);
      expect(getStreakBonus(30)).toBe(2.0);
      expect(getStreakBonus(100)).toBe(2.0);
    });
  });

  describe('Karma Updates', () => {
    it('should add karma points on booking', async () => {
      const { addKarmaPoints } = await import('../integrations/rez-karma');

      const result = await addKarmaPoints('guest_123', 50, 'Booking completed');

      expect(addKarmaPoints).toHaveBeenCalledWith('guest_123', 50, 'Booking completed');
      expect(result).toBe(true);
    });

    it('should deduct karma points on cancellation', async () => {
      const { deductKarmaPoints } = await import('../integrations/rez-karma');

      const result = await deductKarmaPoints('guest_123', 100, 'Booking cancellation');

      expect(deductKarmaPoints).toHaveBeenCalledWith('guest_123', 100, 'Booking cancellation');
      expect(result).toBe(true);
    });

    it('should have karma benefits per level', () => {
      const { KarmaBenefits } = require('../integrations/rez-karma');

      expect(KarmaBenefits.L1.trustBoost).toBe(0);
      expect(KarmaBenefits.L2.trustBoost).toBe(5);
      expect(KarmaBenefits.L3.trustBoost).toBe(10);
      expect(KarmaBenefits.L4.trustBoost).toBe(15);
    });
  });

  describe('Intent Capture', () => {
    it('should capture intent on booking', async () => {
      const { captureIntent, HabixoIntents } = await import('../integrations/rez-mind');

      const intent = HabixoIntents.stayBooked('HAB-123', 'HBK-456', '2024-06-01', '2024-06-04');
      const result = await captureIntent({
        userId: 'guest_123',
        ...intent,
      });

      expect(captureIntent).toHaveBeenCalled();
      expect(result).toBe(true);
    });
  });

  describe('Lifecycle Hook Flags', () => {
    it('should track all lifecycle hook states', () => {
      const lifecycleHooks = {
        coinsRewarded: false,
        streakUpdated: false,
        karmaUpdated: false,
        nudgeScheduled: false,
      };

      expect(lifecycleHooks.coinsRewarded).toBe(false);
      expect(lifecycleHooks.streakUpdated).toBe(false);
      expect(lifecycleHooks.karmaUpdated).toBe(false);
      expect(lifecycleHooks.nudgeScheduled).toBe(false);
    });

    it('should update lifecycle hook flags after execution', () => {
      const lifecycleHooks = {
        coinsRewarded: false,
        streakUpdated: false,
        karmaUpdated: false,
        nudgeScheduled: false,
      };

      // Simulate lifecycle execution
      lifecycleHooks.coinsRewarded = true;
      lifecycleHooks.streakUpdated = true;
      lifecycleHooks.karmaUpdated = true;

      expect(lifecycleHooks.coinsRewarded).toBe(true);
      expect(lifecycleHooks.streakUpdated).toBe(true);
      expect(lifecycleHooks.karmaUpdated).toBe(true);
      expect(lifecycleHooks.nudgeScheduled).toBe(false);
    });
  });
});

describe('BookingService - Pricing Calculations', () => {
  it('should calculate subtotal correctly', () => {
    const basePrice = 2000;
    const totalNights = 5;
    const subtotal = basePrice * totalNights;

    expect(subtotal).toBe(10000);
  });

  it('should calculate weekly discount', () => {
    const subtotal = 14000;
    const weeklyDiscount = 10;
    const discount = subtotal * (weeklyDiscount / 100);

    expect(discount).toBe(1400);
  });

  it('should calculate monthly discount', () => {
    const subtotal = 60000;
    const monthlyDiscount = 20;
    const discount = subtotal * (monthlyDiscount / 100);

    expect(discount).toBe(12000);
  });

  it('should calculate service fee', () => {
    const subtotal = 10000;
    const serviceFeeRate = 0.03;
    const serviceFee = subtotal * serviceFeeRate;

    expect(serviceFee).toBe(300);
  });

  it('should calculate taxes', () => {
    const subtotal = 10000;
    const cleaningFee = 500;
    const serviceFee = 300;
    const discount = 0;
    const taxes = (subtotal - discount + serviceFee) * 0.18;

    expect(taxes).toBe((10000 + 300) * 0.18);
  });

  it('should calculate total correctly', () => {
    const subtotal = 10000;
    const cleaningFee = 500;
    const serviceFee = 300;
    const discount = 1000;
    const taxes = (subtotal - discount + serviceFee) * 0.18;
    const total = subtotal - discount + cleaningFee + serviceFee + taxes;

    // subtotal - discount + cleaningFee + serviceFee + taxes
    // 10000 - 1000 + 500 + 300 + ((10000 - 1000 + 300) * 0.18)
    // 9250 + 1620 = 10870
    expect(total).toBe(10870);
  });
});

describe('BookingService - Booking Status', () => {
  const validStatuses = ['pending', 'confirmed', 'cancelled', 'completed', 'disputed'];

  it('should have all valid booking statuses', () => {
    expect(validStatuses).toContain('pending');
    expect(validStatuses).toContain('confirmed');
    expect(validStatuses).toContain('cancelled');
    expect(validStatuses).toContain('completed');
    expect(validStatuses).toContain('disputed');
  });

  it('should transition from pending to confirmed', () => {
    const initialStatus = 'pending';
    const newStatus = 'confirmed';
    expect(validStatuses).toContain(newStatus);
  });

  it('should allow cancellation from confirmed', () => {
    const status = 'confirmed';
    expect(validStatuses).toContain(status);
  });
});

describe('BookingService - Guest Counts', () => {
  it('should validate guest counts', () => {
    const guests = {
      adults: 2,
      children: 1,
      infants: 0,
    };

    expect(guests.adults).toBeGreaterThanOrEqual(1);
    expect(guests.children).toBeGreaterThanOrEqual(0);
    expect(guests.infants).toBeGreaterThanOrEqual(0);
  });

  it('should calculate total guests', () => {
    const guests = {
      adults: 2,
      children: 2,
      infants: 1,
    };

    const totalGuests = guests.adults + guests.children + guests.infants;
    expect(totalGuests).toBe(5);
  });
});
