import { describe, it, expect } from 'vitest';
import {
  roomBlockSchema,
  reservationSchema,
  roomAssignmentSchema,
  tapeChartViewSchema,
  userLoginSchema,
  userRegistrationSchema,
  roomSchema,
  bookingSchema
} from './validationSchemas';

describe('Validation Schemas', () => {
  describe('roomBlockSchema', () => {
    it('should validate valid room block data', () => {
      const validData = {
        blockName: 'Wedding Block',
        groupName: 'Smith Wedding',
        startDate: new Date('2024-06-01'),
        endDate: new Date('2024-06-03'),
        totalRooms: 5,
        contactPerson: {
          name: 'John Smith',
          email: 'john@email.com',
          phone: '+1234567890'
        }
      };

      const result = roomBlockSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should reject invalid room block data', () => {
      const invalidData = {
        blockName: 'AB', // Too short
        groupName: '', // Empty
        startDate: new Date('2024-06-03'),
        endDate: new Date('2024-06-01'), // End before start
        totalRooms: 0, // Less than 1
        contactPerson: {
          name: 'X', // Too short
          email: 'invalid-email', // Invalid format
          phone: '123' // Too short
        }
      };

      const result = roomBlockSchema.safeParse(invalidData);
      expect(result.success).toBe(false);

      if (!result.success) {
        expect(result.error.issues).toHaveLength(6);
        expect(result.error.issues.some(issue =>
          issue.path.includes('blockName')
        )).toBe(true);
        expect(result.error.issues.some(issue =>
          issue.path.includes('endDate')
        )).toBe(true);
      }
    });

    it('should handle optional phone field', () => {
      const validData = {
        blockName: 'Conference Block',
        groupName: 'Tech Conference',
        startDate: new Date('2024-06-01'),
        endDate: new Date('2024-06-03'),
        totalRooms: 10,
        contactPerson: {
          name: 'Jane Doe',
          email: 'jane@email.com'
          // phone is optional
        }
      };

      const result = roomBlockSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });
  });

  describe('reservationSchema', () => {
    it('should validate valid reservation data', () => {
      const validData = {
        guestName: 'John Doe',
        email: 'john@email.com',
        phone: '+1234567890',
        checkIn: new Date('2024-06-01'),
        checkOut: new Date('2024-06-03'),
        roomType: 'deluxe',
        guestCount: 2,
        specialRequests: 'Late check-in'
      };

      const result = reservationSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should reject invalid dates', () => {
      const invalidData = {
        guestName: 'John Doe',
        email: 'john@email.com',
        phone: '+1234567890',
        checkIn: new Date('2024-06-03'),
        checkOut: new Date('2024-06-01'), // Before check-in
        roomType: 'deluxe',
        guestCount: 2
      };

      const result = reservationSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should validate guest count limits', () => {
      const invalidData = {
        guestName: 'John Doe',
        email: 'john@email.com',
        phone: '+1234567890',
        checkIn: new Date('2024-06-01'),
        checkOut: new Date('2024-06-03'),
        roomType: 'deluxe',
        guestCount: 0 // Should be at least 1
      };

      const result = reservationSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });

  describe('userLoginSchema', () => {
    it('should validate valid login credentials', () => {
      const validData = {
        email: 'user@example.com',
        password: 'securePassword123'
      };

      const result = userLoginSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should reject invalid email format', () => {
      const invalidData = {
        email: 'invalid-email',
        password: 'password123'
      };

      const result = userLoginSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should reject short passwords', () => {
      const invalidData = {
        email: 'user@example.com',
        password: '123' // Too short
      };

      const result = userLoginSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });

  describe('userRegistrationSchema', () => {
    it('should validate valid registration data', () => {
      const validData = {
        name: 'John Doe',
        email: 'john@example.com',
        password: 'securePassword123',
        confirmPassword: 'securePassword123',
        phone: '+1234567890',
        role: 'guest' as const
      };

      const result = userRegistrationSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should reject mismatched passwords', () => {
      const invalidData = {
        name: 'John Doe',
        email: 'john@example.com',
        password: 'password123',
        confirmPassword: 'differentPassword',
        phone: '+1234567890',
        role: 'guest' as const
      };

      const result = userRegistrationSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should reject invalid role', () => {
      const invalidData = {
        name: 'John Doe',
        email: 'john@example.com',
        password: 'password123',
        confirmPassword: 'password123',
        phone: '+1234567890',
        role: 'invalid-role' as any
      };

      const result = userRegistrationSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });

  describe('roomSchema', () => {
    it('should validate valid room data', () => {
      const validData = {
        roomNumber: '101',
        type: 'deluxe',
        floor: 1,
        capacity: 2,
        baseRate: 2500,
        amenities: ['WiFi', 'AC', 'TV'],
        status: 'available' as const
      };

      const result = roomSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should reject negative values', () => {
      const invalidData = {
        roomNumber: '101',
        type: 'deluxe',
        floor: -1, // Negative floor
        capacity: 0, // Zero capacity
        baseRate: -100, // Negative rate
        amenities: ['WiFi'],
        status: 'available' as const
      };

      const result = roomSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });
});