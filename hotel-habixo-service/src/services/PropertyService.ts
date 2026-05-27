import { v4 as uuidv4 } from 'uuid';
import { Property, IProperty } from '../models';
import { NotFoundError, ValidationError } from '../utils/errors';
import { logger } from '../utils/logger';
import { getHostProfile, createHostProfile, getHostProfileWithStats, HostProfile } from '../integrations/rez-profile';

const propertyLogger = logger.child({ service: 'PropertyService' });

export interface CreatePropertyInput {
  hostId: string;
  brand: 'habixo_stay' | 'habixo_rent' | 'habixo_match';
  title: string;
  description: string;
  propertyType: string;
  roomType: string;
  location: {
    address: string;
    city: string;
    state: string;
    country: string;
    pincode?: string;
    lat: number;
    lng: number;
    neighborhood?: string;
  };
  bedrooms: number;
  bathrooms: number;
  maxGuests: number;
  beds: number;
  amenities: string[];
  pricing: {
    basePrice: number;
    cleaningFee?: number;
    serviceFee?: number;
    weeklyDiscount?: number;
    monthlyDiscount?: number;
    currency?: string;
  };
  availability?: {
    checkInTime?: string;
    checkOutTime?: string;
    minNights?: number;
    maxNights?: number;
  };
  rentalType: string;
  leaseTerms?: {
    minMonths?: number;
    maxMonths?: number;
    securityDeposit?: number;
    furnished?: boolean;
  };
  flatmateProfile?: {
    vibeTags?: string[];
    sleepSchedule?: string;
    workFromHome?: boolean;
    smokeFriendly?: boolean;
    petFriendly?: boolean;
  };
  photos?: Array<{ url: string; caption?: string; isPrimary?: boolean }>;
}

export interface PropertySearchInput {
  city?: string;
  neighborhood?: string;
  lat?: number;
  lng?: number;
  radius?: number;
  brand?: string;
  propertyType?: string;
  roomType?: string;
  minPrice?: number;
  maxPrice?: number;
  bedrooms?: number;
  bathrooms?: number;
  guests?: number;
  amenities?: string[];
  checkIn?: string;
  checkOut?: string;
  status?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: string;
}

/**
 * Create a new property
 */
export async function createProperty(input: CreatePropertyInput): Promise<IProperty> {
  // Ensure host profile exists in ReZ Profile Service
  let hostProfile = await getHostProfile(input.hostId);
  if (!hostProfile) {
    hostProfile = await createHostProfile(input.hostId, {});
    propertyLogger.info({ hostId: input.hostId }, 'Host profile created in ReZ Profile Service');
  }

  const propertyId = `HAB-${uuidv4().substring(0, 8).toUpperCase()}`;

  const property = new Property({
    propertyId,
    ...input,
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
  });

  await property.save();
  propertyLogger.info({ propertyId, hostId: input.hostId }, 'Property created');

  return property;
}

/**
 * Get property by ID
 */
export async function getPropertyById(propertyId: string): Promise<IProperty> {
  const property = await Property.findOne({ propertyId }).lean();
  if (!property) {
    throw new NotFoundError('Property', propertyId);
  }
  return property as unknown as IProperty;
}

/**
 * Get property with host profile
 * Returns property data enriched with host profile information from ReZ Profile Service
 */
export async function getPropertyWithHostProfile(propertyId: string): Promise<{
  property: IProperty;
  hostProfile: HostProfile | null;
}> {
  const property = await getPropertyById(propertyId);

  // Get host profile from ReZ Profile Service with Habixo stats
  const hostProfile = await getHostProfileWithStats(property.hostId, {
    totalProperties: await Property.countDocuments({ hostId: property.hostId, status: 'active' }),
    responseRate: property.stats.responseRate,
    responseTime: property.stats.responseTime,
    avgRating: property.stats.rating,
    totalReviews: property.stats.reviewCount,
    yearsHosting: Math.floor(
      (Date.now() - new Date(property.createdAt).getTime()) / (1000 * 60 * 60 * 24 * 365)
    ),
  });

  return { property, hostProfile };
}

/**
 * Update property
 */
export async function updateProperty(
  propertyId: string,
  updates: Partial<IProperty>
): Promise<IProperty> {
  const property = await Property.findOneAndUpdate(
    { propertyId },
    { $set: updates },
    { new: true }
  );

  if (!property) {
    throw new NotFoundError('Property', propertyId);
  }

  propertyLogger.info({ propertyId }, 'Property updated');
  return property;
}

/**
 * Search properties
 */
export async function searchProperties(input: PropertySearchInput): Promise<{
  properties: IProperty[];
  total: number;
  page: number;
  totalPages: number;
}> {
  const {
    city,
    neighborhood,
    brand,
    propertyType,
    roomType,
    minPrice,
    maxPrice,
    bedrooms,
    bathrooms,
    guests,
    amenities,
    status = 'active',
    page = 1,
    limit = 20,
    sortBy = 'trustScore',
    sortOrder = 'desc',
  } = input;

  const query: Record<string, unknown> = { status };

  if (city) query['location.city'] = new RegExp(city, 'i');
  if (neighborhood) query['location.neighborhood'] = new RegExp(neighborhood, 'i');
  if (brand) query.brand = brand;
  if (propertyType) query.propertyType = propertyType;
  if (roomType) query.roomType = roomType;
  if (bedrooms) query.bedrooms = { $gte: bedrooms };
  if (bathrooms) query.bathrooms = { $gte: bathrooms };
  if (guests) query.maxGuests = { $gte: guests };
  if (minPrice || maxPrice) {
    query['pricing.basePrice'] = {};
    if (minPrice) (query['pricing.basePrice'] as Record<string, number>).$gte = minPrice;
    if (maxPrice) (query['pricing.basePrice'] as Record<string, number>).$lte = maxPrice;
  }
  if (amenities && amenities.length > 0) {
    query.amenities = { $all: amenities };
  }

  const sortDirection = sortOrder === 'asc' ? 1 : -1;
  const sort: Record<string, 1 | -1> = {};
  sort[sortBy] = sortDirection;

  const skip = (page - 1) * limit;

  const [properties, total] = await Promise.all([
    Property.find(query).sort(sort).skip(skip).limit(limit).lean(),
    Property.countDocuments(query),
  ]);

  return {
    properties: properties as unknown as IProperty[],
    total,
    page,
    totalPages: Math.ceil(total / limit),
  };
}

/**
 * Get properties by host
 */
export async function getPropertiesByHost(hostId: string): Promise<IProperty[]> {
  return (await Property.find({ hostId }).sort({ createdAt: -1 }).lean()) as unknown as IProperty[];
}

/**
 * Activate property
 */
export async function activateProperty(propertyId: string): Promise<IProperty> {
  const property = await Property.findOneAndUpdate(
    { propertyId },
    { $set: { status: 'active' } },
    { new: true }
  );

  if (!property) {
    throw new NotFoundError('Property', propertyId);
  }

  propertyLogger.info({ propertyId }, 'Property activated');
  return property;
}

/**
 * Deactivate property
 */
export async function deactivateProperty(propertyId: string): Promise<IProperty> {
  const property = await Property.findOneAndUpdate(
    { propertyId },
    { $set: { status: 'inactive' } },
    { new: true }
  );

  if (!property) {
    throw new NotFoundError('Property', propertyId);
  }

  propertyLogger.info({ propertyId }, 'Property deactivated');
  return property;
}

/**
 * Update property stats after booking
 */
export async function updatePropertyStats(propertyId: string): Promise<void> {
  await Property.findOneAndUpdate(
    { propertyId },
    {
      $inc: { 'stats.totalBookings': 1 },
    }
  );
}
