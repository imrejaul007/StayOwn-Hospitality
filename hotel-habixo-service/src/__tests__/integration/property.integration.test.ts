// Property Integration Tests
import mongoose from 'mongoose';
import { Property } from '../../models/Property';
import * as PropertyService from '../../services/PropertyService';
import { createMockProperty, createMockProperties, generatePropertyId } from './testData';
import { NotFoundError, ValidationError } from '../../utils/errors';

describe('Property Integration Tests', () => {
  describe('createProperty', () => {
    it('should create a property with all required fields', async () => {
      const mockProperty = createMockProperty();

      const result = await PropertyService.createProperty({
        hostId: mockProperty.hostId!,
        brand: mockProperty.brand as 'habixo_stay',
        title: mockProperty.title!,
        description: mockProperty.description!,
        propertyType: mockProperty.propertyType!,
        roomType: mockProperty.roomType!,
        location: mockProperty.location!,
        bedrooms: mockProperty.bedrooms!,
        bathrooms: mockProperty.bathrooms!,
        maxGuests: mockProperty.maxGuests!,
        beds: mockProperty.beds!,
        amenities: mockProperty.amenities!,
        pricing: mockProperty.pricing!,
        rentalType: mockProperty.rentalType!,
      });

      expect(result).toBeDefined();
      expect(result.propertyId).toMatch(/^HAB-[A-Z0-9]+$/);
      expect(result.status).toBe('draft');
      expect(result.trustScore).toBe(50);
      expect(result.qualityScore).toBe(0);
      expect(result.verified).toBe(false);
      expect(result.stats.totalBookings).toBe(0);
    });

    it('should generate unique property IDs', async () => {
      const mockProperty = createMockProperty();

      const property1 = await PropertyService.createProperty({
        hostId: mockProperty.hostId!,
        brand: 'habixo_stay',
        title: 'Property 1',
        description: 'Description 1',
        propertyType: 'apartment',
        roomType: 'entire_place',
        location: mockProperty.location!,
        bedrooms: 2,
        bathrooms: 1,
        maxGuests: 4,
        beds: 2,
        amenities: ['wifi'],
        pricing: { basePrice: 2000 },
        rentalType: 'short_term',
      });

      const property2 = await PropertyService.createProperty({
        hostId: mockProperty.hostId!,
        brand: 'habixo_stay',
        title: 'Property 2',
        description: 'Description 2',
        propertyType: 'apartment',
        roomType: 'entire_place',
        location: mockProperty.location!,
        bedrooms: 2,
        bathrooms: 1,
        maxGuests: 4,
        beds: 2,
        amenities: ['wifi'],
        pricing: { basePrice: 2000 },
        rentalType: 'short_term',
      });

      expect(property1.propertyId).not.toBe(property2.propertyId);
    });

    it('should support all three habixo brands', async () => {
      const mockProperty = createMockProperty();
      const brands = ['habixo_stay', 'habixo_rent', 'habixo_match'] as const;

      for (const brand of brands) {
        const property = await PropertyService.createProperty({
          hostId: mockProperty.hostId!,
          brand,
          title: `${brand} property`,
          description: 'Test description',
          propertyType: 'apartment',
          roomType: 'entire_place',
          location: mockProperty.location!,
          bedrooms: 2,
          bathrooms: 1,
          maxGuests: 4,
          beds: 2,
          amenities: [],
          pricing: { basePrice: 2000 },
          rentalType: brand === 'habixo_rent' ? 'long_term' : 'short_term',
        });

        expect(property.brand).toBe(brand);
      }
    });
  });

  describe('getPropertyById', () => {
    it('should retrieve a property by ID', async () => {
      const mockProperty = createMockProperty();
      const created = await PropertyService.createProperty({
        hostId: mockProperty.hostId!,
        brand: 'habixo_stay',
        title: mockProperty.title!,
        description: mockProperty.description!,
        propertyType: mockProperty.propertyType!,
        roomType: mockProperty.roomType!,
        location: mockProperty.location!,
        bedrooms: mockProperty.bedrooms!,
        bathrooms: mockProperty.bathrooms!,
        maxGuests: mockProperty.maxGuests!,
        beds: mockProperty.beds!,
        amenities: mockProperty.amenities!,
        pricing: mockProperty.pricing!,
        rentalType: mockProperty.rentalType!,
      });

      const retrieved = await PropertyService.getPropertyById(created.propertyId);

      expect(retrieved.propertyId).toBe(created.propertyId);
      expect(retrieved.hostId).toBe(created.hostId);
      expect(retrieved.title).toBe(mockProperty.title);
    });

    it('should throw NotFoundError for non-existent property', async () => {
      const fakeId = generatePropertyId();

      await expect(PropertyService.getPropertyById(fakeId))
        .rejects
        .toThrow(NotFoundError);
    });
  });

  describe('updateProperty', () => {
    it('should update property fields', async () => {
      const mockProperty = createMockProperty();
      const created = await PropertyService.createProperty({
        hostId: mockProperty.hostId!,
        brand: 'habixo_stay',
        title: 'Original Title',
        description: mockProperty.description!,
        propertyType: mockProperty.propertyType!,
        roomType: mockProperty.roomType!,
        location: mockProperty.location!,
        bedrooms: mockProperty.bedrooms!,
        bathrooms: mockProperty.bathrooms!,
        maxGuests: mockProperty.maxGuests!,
        beds: mockProperty.beds!,
        amenities: mockProperty.amenities!,
        pricing: mockProperty.pricing!,
        rentalType: mockProperty.rentalType!,
      });

      const updated = await PropertyService.updateProperty(created.propertyId, {
        title: 'Updated Title',
        status: 'active',
      });

      expect(updated.title).toBe('Updated Title');
      expect(updated.status).toBe('active');
    });

    it('should throw NotFoundError when updating non-existent property', async () => {
      const fakeId = generatePropertyId();

      await expect(PropertyService.updateProperty(fakeId, { title: 'Test' }))
        .rejects
        .toThrow(NotFoundError);
    });
  });

  describe('searchProperties', () => {
    beforeEach(async () => {
      // Create test properties
      const properties = createMockProperties(10);
      for (const prop of properties) {
        await new Property(prop).save();
      }
    });

    it('should find properties by city', async () => {
      const result = await PropertyService.searchProperties({
        city: 'Bangalore',
        status: 'active',
      });

      expect(result.total).toBeGreaterThan(0);
      result.properties.forEach((p) => {
        expect(p.location?.city.toLowerCase()).toContain('bangalore');
      });
    });

    it('should filter by price range', async () => {
      const result = await PropertyService.searchProperties({
        minPrice: 1000,
        maxPrice: 3000,
        status: 'active',
      });

      result.properties.forEach((p) => {
        expect(p.pricing?.basePrice).toBeGreaterThanOrEqual(1000);
        expect(p.pricing?.basePrice).toBeLessThanOrEqual(3000);
      });
    });

    it('should filter by amenities', async () => {
      const result = await PropertyService.searchProperties({
        amenities: ['wifi', 'pool'],
        status: 'active',
      });

      result.properties.forEach((p) => {
        expect(p.amenities).toContain('wifi');
        expect(p.amenities).toContain('pool');
      });
    });

    it('should paginate results', async () => {
      const page1 = await PropertyService.searchProperties({
        page: 1,
        limit: 3,
        status: 'active',
      });

      const page2 = await PropertyService.searchProperties({
        page: 2,
        limit: 3,
        status: 'active',
      });

      expect(page1.properties.length).toBeLessThanOrEqual(3);
      expect(page2.properties.length).toBeLessThanOrEqual(3);
      expect(page1.page).toBe(1);
      expect(page2.page).toBe(2);
    });

    it('should sort by trust score descending', async () => {
      const result = await PropertyService.searchProperties({
        sortBy: 'trustScore',
        sortOrder: 'desc',
        status: 'active',
      });

      if (result.properties.length > 1) {
        for (let i = 0; i < result.properties.length - 1; i++) {
          expect(result.properties[i].trustScore!).toBeGreaterThanOrEqual(
            result.properties[i + 1].trustScore!
          );
        }
      }
    });
  });

  describe('getPropertiesByHost', () => {
    it('should return all properties for a host', async () => {
      const hostId = `host_${Date.now()}`;
      const mockProperty = createMockProperty({ hostId });

      // Create multiple properties for the same host
      for (let i = 0; i < 3; i++) {
        await new Property({
          ...mockProperty,
          title: `Property ${i + 1}`,
        }).save();
      }

      const properties = await PropertyService.getPropertiesByHost(hostId);

      expect(properties.length).toBe(3);
      properties.forEach((p) => {
        expect(p.hostId).toBe(hostId);
      });
    });

    it('should return empty array for host with no properties', async () => {
      const properties = await PropertyService.getPropertiesByHost('nonexistent_host');
      expect(properties).toEqual([]);
    });
  });

  describe('activateProperty', () => {
    it('should activate a draft property', async () => {
      const mockProperty = createMockProperty({ status: 'draft' });
      const property = await new Property(mockProperty).save();

      const activated = await PropertyService.activateProperty(property.propertyId);

      expect(activated.status).toBe('active');
    });

    it('should throw NotFoundError for non-existent property', async () => {
      await expect(PropertyService.activateProperty('NONEXISTENT'))
        .rejects
        .toThrow(NotFoundError);
    });
  });

  describe('deactivateProperty', () => {
    it('should deactivate an active property', async () => {
      const mockProperty = createMockProperty({ status: 'active' });
      const property = await new Property(mockProperty).save();

      const deactivated = await PropertyService.deactivateProperty(property.propertyId);

      expect(deactivated.status).toBe('inactive');
    });
  });

  describe('updatePropertyStats', () => {
    it('should increment booking count', async () => {
      const mockProperty = createMockProperty({ stats: { totalBookings: 0 } as any });
      const property = await new Property(mockProperty).save();

      await PropertyService.updatePropertyStats(property.propertyId);

      const updated = await Property.findOne({ propertyId: property.propertyId });
      expect(updated?.stats.totalBookings).toBe(1);
    });
  });
});
