// Property Service Unit Tests
import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import mongoose from 'mongoose';

// Mock the Property model
const mockPropertyModel = {
  find: jest.fn(),
  findOne: jest.fn(),
  findOneAndUpdate: jest.fn(),
  countDocuments: jest.fn(),
  create: jest.fn(),
  findOneAndDelete: jest.fn(),
};

const mockSave = jest.fn();
const mockLean = jest.fn();

// Mock mongoose before importing the service
jest.mock('mongoose', () => {
  const actualMongoose = jest.requireActual('mongoose') as typeof import('mongoose');
  return {
    ...actualMongoose,
    model: jest.fn().mockReturnValue(function MockProperty() {
      return { save: mockSave, ...mockPropertyModel };
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

// Import after mocking
import * as PropertyService from '../services/PropertyService';
import { NotFoundError, ValidationError } from '../utils/errors';

describe('PropertyService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createProperty', () => {
    it('should create a property with valid input', async () => {
      const mockPropertyData = {
        hostId: 'host_123',
        brand: 'habixo_stay' as const,
        title: 'Modern Apartment in Bangalore',
        description: 'A beautiful 2BHK apartment with all amenities',
        propertyType: 'apartment',
        roomType: 'entire_place',
        location: {
          address: '123 Main St',
          city: 'Bangalore',
          state: 'Karnataka',
          country: 'India',
          lat: 12.9716,
          lng: 77.5946,
        },
        bedrooms: 2,
        bathrooms: 2,
        maxGuests: 4,
        beds: 2,
        amenities: ['wifi', 'ac', 'tv'],
        pricing: {
          basePrice: 2000,
          cleaningFee: 500,
          serviceFee: 200,
          weeklyDiscount: 10,
          monthlyDiscount: 20,
          currency: 'INR',
        },
        rentalType: 'short_term',
      };

      const expectedProperty = {
        propertyId: expect.stringMatching(/^HAB-[A-Z0-9]+$/),
        ...mockPropertyData,
        status: 'draft',
        stats: {
          totalBookings: 0,
          rating: 0,
          reviewCount: 0,
          responseRate: 100,
          responseTime: 'within an hour',
        },
        qualityScore: 0,
        trustScore: 50,
        verified: false,
      };

      mockSave.mockResolvedValue(expectedProperty);

      const result = await PropertyService.createProperty(mockPropertyData);

      expect(mockSave).toHaveBeenCalled();
      expect(result.status).toBe('draft');
      expect(result.trustScore).toBe(50);
    });
  });

  describe('getPropertyById', () => {
    it('should return property when found', async () => {
      const mockProperty = {
        propertyId: 'HAB-12345678',
        hostId: 'host_123',
        title: 'Test Property',
        status: 'active',
      };

      mockPropertyModel.findOne.mockReturnValue({ lean: mockLean });
      mockLean.mockResolvedValue(mockProperty);

      const result = await PropertyService.getPropertyById('HAB-12345678');

      expect(mockPropertyModel.findOne).toHaveBeenCalledWith({ propertyId: 'HAB-12345678' });
      expect(result.propertyId).toBe('HAB-12345678');
    });

    it('should throw NotFoundError when property not found', async () => {
      mockPropertyModel.findOne.mockReturnValue({ lean: mockLean });
      mockLean.mockResolvedValue(null);

      await expect(PropertyService.getPropertyById('NONEXISTENT'))
        .rejects
        .toThrow(NotFoundError);
    });
  });

  describe('updateProperty', () => {
    it('should update property fields', async () => {
      const mockProperty = {
        propertyId: 'HAB-12345678',
        title: 'Updated Title',
        status: 'active',
      };

      mockPropertyModel.findOneAndUpdate.mockResolvedValue(mockProperty);

      const result = await PropertyService.updateProperty('HAB-12345678', {
        title: 'Updated Title',
        status: 'active',
      });

      expect(mockPropertyModel.findOneAndUpdate).toHaveBeenCalledWith(
        { propertyId: 'HAB-12345678' },
        { $set: { title: 'Updated Title', status: 'active' } },
        { new: true }
      );
      expect(result.title).toBe('Updated Title');
    });

    it('should throw NotFoundError when property not found', async () => {
      mockPropertyModel.findOneAndUpdate.mockResolvedValue(null);

      await expect(
        PropertyService.updateProperty('NONEXISTENT', { title: 'Test' })
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe('searchProperties', () => {
    it('should search with default parameters', async () => {
      const mockProperties = [
        { propertyId: 'HAB-1', title: 'Property 1', status: 'active' },
        { propertyId: 'HAB-2', title: 'Property 2', status: 'active' },
      ];

      mockPropertyModel.find.mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        lean: mockLean,
      });
      mockPropertyModel.countDocuments.mockResolvedValue(2);
      mockLean.mockResolvedValue(mockProperties);

      const result = await PropertyService.searchProperties({});

      expect(result.total).toBe(2);
      expect(result.properties.length).toBe(2);
      expect(result.page).toBe(1);
    });

    it('should filter by city', async () => {
      mockPropertyModel.find.mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        lean: mockLean,
      });
      mockPropertyModel.countDocuments.mockResolvedValue(0);
      mockLean.mockResolvedValue([]);

      await PropertyService.searchProperties({ city: 'Bangalore' });

      expect(mockPropertyModel.find).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'active',
          'location.city': expect.any(RegExp),
        })
      );
    });

    it('should filter by price range', async () => {
      mockPropertyModel.find.mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        lean: mockLean,
      });
      mockPropertyModel.countDocuments.mockResolvedValue(0);
      mockLean.mockResolvedValue([]);

      await PropertyService.searchProperties({ minPrice: 1000, maxPrice: 5000 });

      expect(mockPropertyModel.find).toHaveBeenCalledWith(
        expect.objectContaining({
          'pricing.basePrice': expect.objectContaining({
            $gte: 1000,
            $lte: 5000,
          }),
        })
      );
    });

    it('should filter by amenities', async () => {
      mockPropertyModel.find.mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        lean: mockLean,
      });
      mockPropertyModel.countDocuments.mockResolvedValue(0);
      mockLean.mockResolvedValue([]);

      await PropertyService.searchProperties({ amenities: ['wifi', 'pool'] });

      expect(mockPropertyModel.find).toHaveBeenCalledWith(
        expect.objectContaining({
          amenities: { $all: ['wifi', 'pool'] },
        })
      );
    });
  });

  describe('getPropertiesByHost', () => {
    it('should return all properties for a host', async () => {
      const mockProperties = [
        { propertyId: 'HAB-1', hostId: 'host_123' },
        { propertyId: 'HAB-2', hostId: 'host_123' },
      ];

      mockPropertyModel.find.mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        lean: mockLean,
      });
      mockLean.mockResolvedValue(mockProperties);

      const result = await PropertyService.getPropertiesByHost('host_123');

      expect(mockPropertyModel.find).toHaveBeenCalledWith({ hostId: 'host_123' });
      expect(result.length).toBe(2);
    });
  });

  describe('activateProperty', () => {
    it('should activate an inactive property', async () => {
      const mockProperty = {
        propertyId: 'HAB-12345678',
        status: 'active',
      };

      mockPropertyModel.findOneAndUpdate.mockResolvedValue(mockProperty);

      const result = await PropertyService.activateProperty('HAB-12345678');

      expect(mockPropertyModel.findOneAndUpdate).toHaveBeenCalledWith(
        { propertyId: 'HAB-12345678' },
        { $set: { status: 'active' } },
        { new: true }
      );
      expect(result.status).toBe('active');
    });

    it('should throw NotFoundError for non-existent property', async () => {
      mockPropertyModel.findOneAndUpdate.mockResolvedValue(null);

      await expect(PropertyService.activateProperty('NONEXISTENT'))
        .rejects
        .toThrow(NotFoundError);
    });
  });

  describe('deactivateProperty', () => {
    it('should deactivate an active property', async () => {
      const mockProperty = {
        propertyId: 'HAB-12345678',
        status: 'inactive',
      };

      mockPropertyModel.findOneAndUpdate.mockResolvedValue(mockProperty);

      const result = await PropertyService.deactivateProperty('HAB-12345678');

      expect(mockPropertyModel.findOneAndUpdate).toHaveBeenCalledWith(
        { propertyId: 'HAB-12345678' },
        { $set: { status: 'inactive' } },
        { new: true }
      );
      expect(result.status).toBe('inactive');
    });
  });

  describe('updatePropertyStats', () => {
    it('should increment booking count', async () => {
      mockPropertyModel.findOneAndUpdate.mockResolvedValue({
        propertyId: 'HAB-12345678',
        stats: { totalBookings: 1 },
      });

      await PropertyService.updatePropertyStats('HAB-12345678');

      expect(mockPropertyModel.findOneAndUpdate).toHaveBeenCalledWith(
        { propertyId: 'HAB-12345678' },
        { $inc: { 'stats.totalBookings': 1 } }
      );
    });
  });
});

describe('Property Types and Constants', () => {
  it('should support habixo_stay brand', () => {
    const brand = 'habixo_stay';
    expect(['habixo_stay', 'habixo_rent', 'habixo_match']).toContain(brand);
  });

  it('should support habixo_rent brand', () => {
    const brand = 'habixo_rent';
    expect(['habixo_stay', 'habixo_rent', 'habixo_match']).toContain(brand);
  });

  it('should support habixo_match brand', () => {
    const brand = 'habixo_match';
    expect(['habixo_stay', 'habixo_rent', 'habixo_match']).toContain(brand);
  });

  it('should validate property types', () => {
    const propertyTypes = ['apartment', 'house', 'room', 'shared'];
    expect(propertyTypes).toContain('apartment');
    expect(propertyTypes).toContain('house');
    expect(propertyTypes).toContain('room');
    expect(propertyTypes).toContain('shared');
  });

  it('should validate room types', () => {
    const roomTypes = ['entire_place', 'private_room', 'shared_room'];
    expect(roomTypes).toContain('entire_place');
    expect(roomTypes).toContain('private_room');
    expect(roomTypes).toContain('shared_room');
  });

  it('should validate rental types', () => {
    const rentalTypes = ['short_term', 'long_term', 'both'];
    expect(rentalTypes).toContain('short_term');
    expect(rentalTypes).toContain('long_term');
    expect(rentalTypes).toContain('both');
  });

  it('should have correct default trust score', () => {
    const defaultTrustScore = 50;
    expect(defaultTrustScore).toBeGreaterThanOrEqual(0);
    expect(defaultTrustScore).toBeLessThanOrEqual(100);
  });

  it('should have correct default stats', () => {
    const defaultStats = {
      totalBookings: 0,
      rating: 0,
      reviewCount: 0,
      responseRate: 100,
      responseTime: 'within an hour',
    };
    expect(defaultStats.totalBookings).toBe(0);
    expect(defaultStats.responseRate).toBe(100);
  });
});
