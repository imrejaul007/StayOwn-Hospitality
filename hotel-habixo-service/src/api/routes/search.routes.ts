import { Router, Request, Response } from 'express';
import { logger } from '../../utils/logger';
import { rateLimiters } from '../middleware/rateLimiter';

const router = Router();
const searchLogger = logger.child({ service: 'SearchRoutes' });

// RABTUL Search Service URL
const SEARCH_SERVICE_URL = process.env.SEARCH_SERVICE_URL || 'https://rez-search-service.onrender.com';

/**
 * Send search request to RABTUL Search Service
 */
async function sendToRABTULSearch(endpoint: string, body: any): Promise<any> {
  const internalToken = process.env.INTERNAL_SERVICE_TOKEN || '';

  const response = await fetch(`${SEARCH_SERVICE_URL}${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Internal-Token': internalToken,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`RABTUL Search Service error: ${response.status} - ${errorText}`);
  }

  return response.json();
}

/**
 * GET /api/habixo/search
 * Unified advanced search endpoint
 * Rate limited: 30 requests per minute
 */
router.get('/', rateLimiters.search, async (req: Request, res: Response) => {
  try {
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
      instantBook,
      verified,
      sortBy,
      sortOrder,
      page,
      limit,
    } = req.query;

    // Build filters object for RABTUL
    const filters: any = {};

    if (city) filters.city = city;
    if (lat) filters.lat = parseFloat(lat as string);
    if (lng) filters.lng = parseFloat(lng as string);
    if (radius) filters.radius = parseFloat(radius as string);
    if (checkIn) filters.checkIn = checkIn;
    if (checkOut) filters.checkOut = checkOut;
    if (guests) filters.guests = parseInt(guests as string);
    if (bedrooms) filters.bedrooms = parseInt(bedrooms as string);
    if (bathrooms) filters.bathrooms = parseInt(bathrooms as string);
    if (minPrice) filters.minPrice = parseFloat(minPrice as string);
    if (maxPrice) filters.maxPrice = parseFloat(maxPrice as string);
    if (amenities) filters.amenities = typeof amenities === 'string' ? amenities.split(',') : amenities;
    if (propertyType) filters.propertyType = propertyType;
    if (roomType) filters.roomType = roomType;
    if (brand) filters.brand = brand;
    if (vibeTags) filters.vibeTags = typeof vibeTags === 'string' ? vibeTags.split(',') : vibeTags;
    if (instantBook !== undefined) filters.instantBook = instantBook === 'true';
    if (verified !== undefined) filters.verified = verified === 'true';
    if (sortBy) filters.sortBy = sortBy;
    if (sortOrder) filters.sortOrder = sortOrder;
    if (page) filters.page = parseInt(page as string);
    if (limit) filters.limit = parseInt(limit as string);

    // Send to RABTUL Search Service
    const result = await sendToRABTULSearch('/api/search', { query, filters });

    res.json({
      success: true,
      data: {
        properties: result.properties || [],
        pagination: {
          page: result.page || 1,
          limit: result.limit || 20,
          total: result.total || 0,
          totalPages: result.totalPages || 0,
        },
        facets: result.facets || {},
      },
    });
  } catch (error) {
    searchLogger.error({ error, query: req.query }, 'Failed to execute search');
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to execute search',
    });
  }
});

/**
 * GET /api/habixo/search/suggestions
 * Search suggestions for autocomplete
 */
router.get('/suggestions', async (req: Request, res: Response) => {
  try {
    const { q, limit } = req.query;

    if (!q || (typeof q === 'string' && q.length < 2)) {
      res.json({
        success: true,
        data: [],
      });
      return;
    }

    // Send to RABTUL Search Service
    const result = await sendToRABTULSearch('/api/search/suggestions', {
      query: q,
      limit: limit ? parseInt(limit as string) : 10,
    });

    res.json({
      success: true,
      data: result.suggestions || [],
    });
  } catch (error) {
    searchLogger.error({ error, query: req.query }, 'Failed to get search suggestions');
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to get search suggestions',
    });
  }
});

/**
 * GET /api/habixo/search/quick
 * Quick search for header autocomplete (cities, amenities, brands)
 */
router.get('/quick', async (req: Request, res: Response) => {
  try {
    const { q, limit } = req.query;

    if (!q || (typeof q === 'string' && q.length < 2)) {
      res.json({
        success: true,
        data: { cities: [], amenities: [], brands: [] },
      });
      return;
    }

    // Send to RABTUL Search Service
    const result = await sendToRABTULSearch('/api/search/quick', {
      query: q,
      limit: limit ? parseInt(limit as string) : 5,
    });

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    searchLogger.error({ error, query: req.query }, 'Failed to execute quick search');
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to execute quick search',
    });
  }
});

/**
 * GET /api/habixo/search/nearby
 * Search nearby properties
 */
router.get('/nearby', async (req: Request, res: Response) => {
  try {
    const { lat, lng, radius, brand, propertyType, minPrice, maxPrice, limit } = req.query;

    if (!lat || !lng) {
      res.status(400).json({
        success: false,
        message: 'lat and lng are required for nearby search',
      });
      return;
    }

    // Build filters for RABTUL
    const filters: any = {
      lat: parseFloat(lat as string),
      lng: parseFloat(lng as string),
      radius: radius ? parseFloat(radius as string) : 10,
    };

    if (brand) filters.brand = brand;
    if (propertyType) filters.propertyType = propertyType;
    if (minPrice) filters.minPrice = parseFloat(minPrice as string);
    if (maxPrice) filters.maxPrice = parseFloat(maxPrice as string);
    if (limit) filters.limit = parseInt(limit as string);

    // Send to RABTUL Search Service
    const result = await sendToRABTULSearch('/api/search/nearby', { filters });

    res.json({
      success: true,
      data: result.properties || [],
    });
  } catch (error) {
    searchLogger.error({ error, query: req.query }, 'Failed to search nearby properties');
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to search nearby properties',
    });
  }
});

/**
 * GET /api/habixo/search/filters
 * Get available filter options (for filter sidebar)
 */
router.get('/filters', async (req: Request, res: Response) => {
  try {
    const { city, brand } = req.query;

    // Send to RABTUL Search Service
    const result = await sendToRABTULSearch('/api/search/filters', {
      city,
      brand,
    });

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    searchLogger.error({ error }, 'Failed to get filter options');
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to get filter options',
    });
  }
});

export default router;
