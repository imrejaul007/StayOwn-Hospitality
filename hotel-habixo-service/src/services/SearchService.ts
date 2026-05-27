import { Property, IProperty } from '../models';
import { logger } from '../utils/logger';

const searchLogger = logger.child({ service: 'SearchService' });

export interface AdvancedSearchInput {
  // Text search
  query?: string;

  // Location filters
  city?: string;
  lat?: number;
  lng?: number;
  radius?: number; // in kilometers

  // Availability
  checkIn?: string;
  checkOut?: string;

  // Property filters
  guests?: number;
  bedrooms?: number;
  bathrooms?: number;
  minPrice?: number;
  maxPrice?: number;
  amenities?: string[];
  propertyType?: string;
  roomType?: string;

  // Brand filter (stay/rent/match)
  brand?: 'habixo_stay' | 'habixo_rent' | 'habixo_match';

  // Match-specific filters
  vibeTags?: string[];

  // Boolean filters
  instantBook?: boolean;
  verified?: boolean;

  // Sorting
  sortBy?: 'price' | 'rating' | 'relevance' | 'trustScore';
  sortOrder?: 'asc' | 'desc';

  // Pagination
  page?: number;
  limit?: number;
}

export interface SearchResult {
  properties: IProperty[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  facets: SearchFacets;
}

export interface SearchFacets {
  brands: { value: string; count: number }[];
  propertyTypes: { value: string; count: number }[];
  roomTypes: { value: string; count: number }[];
  priceRange: { min: number; max: number };
  amenities: { value: string; count: number }[];
  cities: { value: string; count: number }[];
}

export interface SearchSuggestion {
  type: 'city' | 'neighborhood' | 'property_type' | 'amenity' | 'brand';
  value: string;
  count: number;
}

/**
 * Calculate distance between two coordinates using Haversine formula
 */
function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371; // Earth's radius in kilometers
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Build MongoDB query from search input
 */
function buildSearchQuery(input: AdvancedSearchInput): Record<string, unknown> {
  const query: Record<string, unknown> = { status: 'active' };

  // Text search using MongoDB text index
  if (input.query) {
    query.$text = { $search: input.query };
  }

  // City filter (case-insensitive)
  if (input.city) {
    query['location.city'] = new RegExp(input.city, 'i');
  }

  // Brand filter
  if (input.brand) {
    query.brand = input.brand;
  }

  // Property type filter
  if (input.propertyType) {
    query.propertyType = input.propertyType;
  }

  // Room type filter
  if (input.roomType) {
    query.roomType = input.roomType;
  }

  // Guest capacity filter
  if (input.guests) {
    query.maxGuests = { $gte: input.guests };
  }

  // Bedroom filter
  if (input.bedrooms) {
    query.bedrooms = { $gte: input.bedrooms };
  }

  // Bathroom filter
  if (input.bathrooms) {
    query.bathrooms = { $gte: input.bathrooms };
  }

  // Price range filter
  if (input.minPrice !== undefined || input.maxPrice !== undefined) {
    query['pricing.basePrice'] = {};
    if (input.minPrice !== undefined) {
      (query['pricing.basePrice'] as Record<string, number>).$gte = input.minPrice;
    }
    if (input.maxPrice !== undefined) {
      (query['pricing.basePrice'] as Record<string, number>).$lte = input.maxPrice;
    }
  }

  // Amenities filter (must have ALL specified amenities)
  if (input.amenities && input.amenities.length > 0) {
    query.amenities = { $all: input.amenities };
  }

  // Verified filter
  if (input.verified !== undefined) {
    query.verified = input.verified;
  }

  // Vibe tags for match brand
  if (input.vibeTags && input.vibeTags.length > 0) {
    query['flatmateProfile.vibeTags'] = { $all: input.vibeTags };
  }

  return query;
}

/**
 * Build geo query for location-based search
 */
function buildGeoQuery(input: AdvancedSearchInput): Record<string, unknown> | null {
  if (input.lat !== undefined && input.lng !== undefined && input.radius !== undefined) {
    return {
      'location.lat': {
        $gte: input.lat - input.radius / 111,
        $lte: input.lat + input.radius / 111,
      },
      'location.lng': {
        $gte: input.lng - input.radius / (111 * Math.cos((input.lat * Math.PI) / 180)),
        $lte: input.lng + input.radius / (111 * Math.cos((input.lat * Math.PI) / 180)),
      },
    };
  }
  return null;
}

/**
 * Build aggregation pipeline for faceted search
 */
function buildAggregationPipeline(
  query: Record<string, unknown>,
  page: number,
  limit: number,
  sortBy: string,
  sortOrder: string,
  geoQuery: Record<string, unknown> | null,
  textScore: boolean
): object[] {
  const pipeline: object[] = [];

  // Match stage with combined query
  const matchQuery = { ...query };
  if (geoQuery) {
    Object.assign(matchQuery, geoQuery);
  }
  pipeline.push({ $match: matchQuery });

  // Add text score to projection if searching by query
  if (textScore) {
    pipeline.push({
      $addFields: { score: { $meta: 'textScore' } },
    });
  }

  // Facet stage for aggregations
  pipeline.push({
    $facet: {
      results: [
        { $sort: sortBy === 'relevance' && textScore ? { score: -1 } : { [sortBy]: sortOrder === 'asc' ? 1 : -1 } },
        { $skip: (page - 1) * limit },
        { $limit: limit },
      ],
      totalCount: [{ $count: 'count' }],
      // Brand facets
      brandCounts: [{ $group: { _id: '$brand', count: { $sum: 1 } } }],
      // Property type facets
      propertyTypeCounts: [{ $group: { _id: '$propertyType', count: { $sum: 1 } } }],
      // Room type facets
      roomTypeCounts: [{ $group: { _id: '$roomType', count: { $sum: 1 } } }],
      // Price range
      priceStats: [{ $group: { _id: null, min: { $min: '$pricing.basePrice' }, max: { $max: '$pricing.basePrice' } } }],
      // Amenity facets (top 10)
      amenityCounts: [{ $unwind: '$amenities' }, { $group: { _id: '$amenities', count: { $sum: 1 } } }, { $sort: { count: -1 } }, { $limit: 10 }],
      // City facets (top 10)
      cityCounts: [{ $group: { _id: '$location.city', count: { $sum: 1 } } }, { $sort: { count: -1 } }, { $limit: 10 }],
    },
  });

  return pipeline;
}

/**
 * Advanced property search with filters, geo-search, and facets
 */
export async function advancedSearch(input: AdvancedSearchInput): Promise<SearchResult> {
  const {
    query,
    city,
    lat,
    lng,
    radius,
    checkIn,
    checkOut,
    guests,
    bedrooms,
    bathrooms,
    minPrice,
    maxPrice,
    amenities,
    propertyType,
    roomType,
    brand,
    vibeTags,
    verified,
    instantBook,
    sortBy = 'relevance',
    sortOrder = 'desc',
    page = 1,
    limit = 20,
  } = input;

  // Build base query
  const searchQuery = buildSearchQuery({
    query,
    city,
    brand,
    propertyType,
    roomType,
    guests,
    bedrooms,
    bathrooms,
    minPrice,
    maxPrice,
    amenities,
    verified,
    vibeTags,
  });

  // Build geo query
  const geoQuery = buildGeoQuery({ lat, lng, radius });

  // Determine if we need text score
  const hasTextSearch = !!query;

  // Build sort configuration
  let actualSortBy = sortBy;
  if (sortBy === 'relevance') {
    actualSortBy = hasTextSearch ? 'score' : 'trustScore';
  } else if (sortBy === 'price') {
    actualSortBy = 'pricing.basePrice';
  } else if (sortBy === 'rating') {
    actualSortBy = 'stats.rating';
  } else {
    actualSortBy = 'trustScore';
  }

  const pipeline = buildAggregationPipeline(
    searchQuery,
    page,
    limit,
    actualSortBy,
    sortOrder,
    geoQuery,
    hasTextSearch
  );

  searchLogger.info({ query: searchQuery, geoQuery, sortBy: actualSortBy }, 'Executing advanced search');

  const [result] = await Property.aggregate(pipeline);

  // Process facets
  const facets: SearchFacets = {
    brands: result.brandCounts.map((b: { _id: string; count: number }) => ({ value: b._id, count: b.count })),
    propertyTypes: result.propertyTypeCounts.map((p: { _id: string; count: number }) => ({ value: p._id, count: p.count })),
    roomTypes: result.roomTypeCounts.map((r: { _id: string; count: number }) => ({ value: r._id, count: r.count })),
    priceRange: result.priceStats[0] || { min: 0, max: 0 },
    amenities: result.amenityCounts.map((a: { _id: string; count: number }) => ({ value: a._id, count: a.count })),
    cities: result.cityCounts.map((c: { _id: string; count: number }) => ({ value: c._id, count: c.count })),
  };

  const total = result.totalCount[0]?.count || 0;

  // If geo search was requested, filter results by exact distance
  let properties = result.results as unknown as IProperty[];
  if (geoQuery && lat !== undefined && lng !== undefined) {
    properties = properties.filter((p) => {
      const distance = calculateDistance(lat, lng, p.location.lat, p.location.lng);
      return distance <= (radius || 10);
    });
  }

  searchLogger.info({ total, page, limit }, 'Search completed');

  return {
    properties,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
    facets,
  };
}

/**
 * Search suggestions for autocomplete
 * SECURITY: Escapes regex special characters to prevent ReDoS
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export async function getSearchSuggestions(input: string, limit: number = 10): Promise<SearchSuggestion[]> {
  if (!input || input.length < 2) {
    return [];
  }

  // SECURITY: Escape special regex characters to prevent ReDoS attacks
  const escapedInput = escapeRegex(input);
  const searchRegex = new RegExp(`^${escapedInput}`, 'i');

  const pipeline = [
    { $match: { status: 'active' } },
    {
      $facet: {
        cities: [
          { $match: { 'location.city': searchRegex } },
          { $group: { _id: '$location.city', count: { $sum: 1 } } },
          { $project: { value: '$_id', count: 1, _id: 0 } },
          { $limit: limit },
        ],
        neighborhoods: [
          { $match: { 'location.neighborhood': searchRegex } },
          { $group: { _id: '$location.neighborhood', count: { $sum: 1 } } },
          { $project: { value: '$_id', count: 1, _id: 0 } },
          { $limit: limit },
        ],
        propertyTypes: [
          { $match: { propertyType: searchRegex } },
          { $group: { _id: '$propertyType', count: { $sum: 1 } } },
          { $project: { value: '$_id', count: 1, _id: 0 } },
          { $limit: limit },
        ],
        amenities: [
          { $unwind: '$amenities' },
          { $match: { amenities: searchRegex } },
          { $group: { _id: '$amenities', count: { $sum: 1 } } },
          { $project: { value: '$_id', count: 1, _id: 0 } },
          { $limit: limit },
        ],
        brands: [
          { $match: { brand: searchRegex } },
          { $group: { _id: '$brand', count: { $sum: 1 } } },
          { $project: { value: '$_id', count: 1, _id: 0 } },
          { $limit: limit },
        ],
      },
    },
  ];

  const [result] = await Property.aggregate(pipeline);

  const suggestions: SearchSuggestion[] = [];

  // Transform facet results to SearchSuggestion format
  result.cities.forEach((item: { value: string; count: number }) => {
    suggestions.push({ type: 'city', value: item.value, count: item.count });
  });
  result.neighborhoods.forEach((item: { value: string; count: number }) => {
    suggestions.push({ type: 'neighborhood', value: item.value, count: item.count });
  });
  result.propertyTypes.forEach((item: { value: string; count: number }) => {
    suggestions.push({ type: 'property_type', value: item.value, count: item.count });
  });
  result.amenities.forEach((item: { value: string; count: number }) => {
    suggestions.push({ type: 'amenity', value: item.value, count: item.count });
  });
  result.brands.forEach((item: { value: string; count: number }) => {
    suggestions.push({ type: 'brand', value: item.value, count: item.count });
  });

  // Sort by count descending and limit total
  suggestions.sort((a, b) => b.count - a.count);

  searchLogger.info({ input, resultCount: suggestions.length }, 'Search suggestions generated');

  return suggestions.slice(0, limit);
}

/**
 * Quick search for header autocomplete
 * SECURITY: Escapes regex special characters
 */
export async function quickSearch(query: string, limit: number = 5): Promise<{ cities: string[]; amenities: string[]; brands: string[] }> {
  if (!query || query.length < 2) {
    return { cities: [], amenities: [], brands: [] };
  }

  // SECURITY: Escape special regex characters
  const escapedQuery = escapeRegex(query);
  const searchRegex = new RegExp(`^${escapedQuery}`, 'i');

  const pipeline = [
    { $match: { status: 'active' } },
    {
      $facet: {
        cities: [
          { $match: { 'location.city': searchRegex } },
          { $group: { _id: '$location.city' } },
          { $limit: limit },
          { $project: { value: '$_id', _id: 0 } },
        ],
        amenities: [
          { $unwind: '$amenities' },
          { $match: { amenities: searchRegex } },
          { $group: { _id: '$amenities' } },
          { $limit: limit },
          { $project: { value: '$_id', _id: 0 } },
        ],
        brands: [
          { $match: { brand: searchRegex } },
          { $group: { _id: '$brand' } },
          { $limit: limit },
          { $project: { value: '$_id', _id: 0 } },
        ],
      },
    },
  ];

  const [result] = await Property.aggregate(pipeline);

  return {
    cities: result.cities.map((c: { value: string }) => c.value),
    amenities: result.amenities.map((a: { value: string }) => a.value),
    brands: result.brands.map((b: { value: string }) => b.value),
  };
}

/**
 * Search nearby properties (geo-based search)
 */
export async function searchNearby(
  lat: number,
  lng: number,
  radiusKm: number = 10,
  options?: {
    brand?: string;
    propertyType?: string;
    minPrice?: number;
    maxPrice?: number;
    limit?: number;
  }
): Promise<IProperty[]> {
  const query: Record<string, unknown> = { status: 'active' };

  // Geo bounding box
  const latDelta = radiusKm / 111;
  const lngDelta = radiusKm / (111 * Math.cos((lat * Math.PI) / 180));

  query['location.lat'] = { $gte: lat - latDelta, $lte: lat + latDelta };
  query['location.lng'] = { $gte: lng - lngDelta, $lte: lng + lngDelta };

  if (options?.brand) query.brand = options.brand;
  if (options?.propertyType) query.propertyType = options.propertyType;
  if (options?.minPrice) query['pricing.basePrice'] = { $gte: options.minPrice };
  if (options?.maxPrice) {
    query['pricing.basePrice'] = { ...(query['pricing.basePrice'] as object || {}), $lte: options.maxPrice };
  }

  const limit = options?.limit || 20;

  const properties = await Property.find(query).limit(limit).lean();

  // Filter by exact distance and sort
  const withDistance = properties
    .map((p) => ({
      ...p,
      distance: calculateDistance(lat, lng, p.location.lat, p.location.lng),
    }))
    .filter((p) => p.distance <= radiusKm)
    .sort((a, b) => a.distance - b.distance);

  searchLogger.info({ lat, lng, radiusKm, found: withDistance.length }, 'Nearby search completed');

  return withDistance as unknown as IProperty[];
}
