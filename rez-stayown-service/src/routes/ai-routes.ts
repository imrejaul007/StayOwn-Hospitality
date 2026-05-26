/**
 * AI Routes for StayOwn - REZ Mind Integration
 *
 * Endpoints:
 * - GET /ai/pricing/:hotelId - Get dynamic price
 * - GET /ai/recommendations/:userId - Get personalized recommendations
 * - GET /ai/insights/:hotelId - Get hotel insights
 */

import { Router, Request, Response } from 'express';
import logger from './utils/logger';
import { z } from 'zod';
import { pricingService } from '../services/pricing.service';
import { rezMindHotel } from '../services/rez-mind-integration';
import { authenticateToken, optionalAuth } from '../middleware/auth';

const router = Router();

// ─── Validation Schemas ────────────────────────────────────────────────────────

const pricingQuerySchema = z.object({
  roomTypeId: z.string(),
  checkIn: z.string(),
  checkOut: z.string(),
  baseRate: z.string().transform(Number),
});

const recommendationsQuerySchema = z.object({
  city: z.string().optional(),
  checkIn: z.string().optional(),
  checkOut: z.string().optional(),
  budget: z.string().optional().transform(v => v ? Number(v) : undefined),
});

const insightsQuerySchema = z.object({
  checkIn: z.string().optional(),
  checkOut: z.string().optional(),
});

// ─── Helper Functions ─────────────────────────────────────────────────────────

async function fetchFromPMS(endpoint: string): Promise<any | null> {
  try {
    const axios = (await import('axios')).default;
    const response = await axios.get(`${process.env.HOTEL_PMS_URL || 'http://localhost:3008'}${endpoint}`, {
      timeout: 5000,
      headers: {
        'x-service-key': process.env.INTERNAL_SERVICE_TOKEN || '',
      },
    });
    return response.data;
  } catch (error) {
    logger.warn(`[AI Routes] PMS fetch failed for ${endpoint}`);
    return null;
  }
}

// ─── Routes ───────────────────────────────────────────────────────────────────

/**
 * GET /ai/pricing/:hotelId
 * Get dynamic pricing for a hotel room
 */
router.get('/pricing/:hotelId', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { hotelId } = req.params;
    const query = pricingQuerySchema.parse(req.query);
    const { roomTypeId, checkIn, checkOut, baseRate } = query;
    const userId = req.user?.sub;

    logger.info(`[AI Routes] Getting dynamic pricing for ${hotelId}/${roomTypeId}`);

    // Get dynamic price from pricing service
    const priceResponse = await pricingService.getPrice({
      hotelId,
      roomTypeId,
      checkIn,
      checkOut,
      baseRate,
      userId,
    });

    res.json({
      success: true,
      data: {
        pricing: priceResponse,
        metadata: {
          hotelId,
          roomTypeId,
          userId: userId || 'anonymous',
          timestamp: new Date().toISOString(),
        },
      },
    });
  } catch (error) {
    console.error('[AI Routes] Dynamic pricing error:', error);
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, message: 'Invalid parameters', errors: error.errors });
      return;
    }
    res.status(500).json({ success: false, message: 'Failed to get dynamic pricing' });
  }
});

/**
 * GET /ai/recommendations/:userId
 * Get personalized hotel recommendations
 */
router.get('/recommendations/:userId', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const query = recommendationsQuerySchema.parse(req.query);
    const { city, checkIn, checkOut, budget } = query;

    logger.info(`[AI Routes] Getting recommendations for user ${userId}`);

    // Get recommendations from REZ Mind
    const recommendations = await rezMindHotel.getRecommendations(userId, {
      city,
      checkIn,
      checkOut,
      budget,
    });

    if (!recommendations) {
      // Fallback to basic recommendations
      res.json({
        success: true,
        data: {
          recommendedHotels: [],
          upsells: [],
          message: 'AI recommendations unavailable',
          source: 'fallback',
        },
      });
      return;
    }

    res.json({
      success: true,
      data: {
        ...recommendations,
        source: 'rez_mind',
        metadata: {
          userId,
          query: { city, checkIn, checkOut, budget },
          timestamp: new Date().toISOString(),
        },
      },
    });
  } catch (error) {
    console.error('[AI Routes] Recommendations error:', error);
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, message: 'Invalid parameters', errors: error.errors });
      return;
    }
    res.status(500).json({ success: false, message: 'Failed to get recommendations' });
  }
});

/**
 * GET /ai/insights/:hotelId
 * Get hotel insights and analytics
 */
router.get('/insights/:hotelId', optionalAuth, async (req: Request, res: Response) => {
  try {
    const { hotelId } = req.params;
    const query = insightsQuerySchema.parse(req.query);
    const { checkIn, checkOut } = query;

    logger.info(`[AI Routes] Getting insights for hotel ${hotelId}`);

    // Fetch hotel data from PMS
    const hotelData = await fetchFromPMS(`/v1/hotels/${hotelId}`);

    if (!hotelData?.data) {
      res.status(404).json({ success: false, message: 'Hotel not found' });
      return;
    }

    const hotel = hotelData.data;

    // Gather insights from multiple sources
    const insights = {
      hotel: {
        id: hotel.propertyId || hotelId,
        name: hotel.name,
        location: hotel.address?.city,
        rating: hotel.userRating || hotel.starRating,
        reviewCount: hotel.reviewCount || 0,
      },
      pricing: {
        baseRate: hotel.roomTypes?.[0]?.baseRate || 0,
        averageDiscount: hotel.roomTypes?.[0]?.discount || 0,
        currency: 'INR',
      },
      availability: {
        roomTypes: hotel.roomTypes?.length || 0,
        availableRooms: hotel.roomTypes?.filter((r: any) => r.available)?.length || 0,
      },
      predictions: {
        occupancyLikelihood: null as number | null,
        demandLevel: null as string | null,
        recommendedPricing: null as number | null,
      },
      factors: [] as string[],
    };

    // Try to get SLA predictions for the hotel
    const slaPrediction = await rezMindHotel.predictServiceResponseTime(hotelId, 'room_service');
    if (slaPrediction) {
      insights.predictions.occupancyLikelihood = Math.round((1 - slaPrediction.currentLoad) * 100);
      insights.predictions.demandLevel = slaPrediction.currentLoad > 0.8 ? 'high' : slaPrediction.currentLoad > 0.5 ? 'medium' : 'low';
    }

    // Calculate demand factors
    if (checkIn) {
      const date = new Date(checkIn);
      const dayOfWeek = date.getDay();
      insights.factors.push(`Booking day: ${['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][dayOfWeek]}`);

      if (dayOfWeek === 5 || dayOfWeek === 6) {
        insights.factors.push('Weekend - higher demand expected');
      }
    }

    if (hotel.reviewCount > 1000) {
      insights.factors.push('High review volume - established property');
    }

    res.json({
      success: true,
      data: {
        ...insights,
        metadata: {
          hotelId,
          checkIn,
          checkOut,
          timestamp: new Date().toISOString(),
        },
      },
    });
  } catch (error) {
    console.error('[AI Routes] Insights error:', error);
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, message: 'Invalid parameters', errors: error.errors });
      return;
    }
    res.status(500).json({ success: false, message: 'Failed to get insights' });
  }
});

/**
 * POST /ai/track-search
 * Track search behavior for AI learning
 */
router.post('/track-search', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { query, city, checkIn, checkOut, guests, resultsCount, selectedHotelId } = req.body;
    const userId = req.user?.sub;

    await rezMindHotel.trackSearch({
      userId,
      query,
      city,
      checkIn,
      checkOut,
      guests,
      resultsCount,
      selectedHotelId,
    });

    res.json({ success: true, message: 'Search tracked' });
  } catch (error) {
    console.error('[AI Routes] Track search error:', error);
    res.status(500).json({ success: false, message: 'Failed to track search' });
  }
});

/**
 * POST /ai/satisfaction-predict
 * Predict guest satisfaction for a booking
 */
router.post('/satisfaction-predict', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { bookingId, checkInTime, serviceResponseTimes, totalCharges, specialRequests } = req.body;

    const prediction = await rezMindHotel.predictGuestSatisfaction(bookingId, {
      checkInTime,
      serviceResponseTimes,
      totalCharges,
      specialRequests,
    });

    if (!prediction) {
      res.json({
        success: true,
        data: {
          score: null,
          riskFactors: [],
          recommendations: ['AI prediction unavailable'],
          source: 'fallback',
        },
      });
      return;
    }

    res.json({
      success: true,
      data: {
        ...prediction,
        source: 'rez_mind',
        bookingId,
      },
    });
  } catch (error) {
    console.error('[AI Routes] Satisfaction predict error:', error);
    res.status(500).json({ success: false, message: 'Failed to predict satisfaction' });
  }
});

/**
 * GET /ai/cache-stats
 * Get pricing cache statistics
 */
router.get('/cache-stats', authenticateToken, async (req: Request, res: Response) => {
  const stats = pricingService.getCacheStats();

  res.json({
    success: true,
    data: {
      cache: stats,
      timestamp: new Date().toISOString(),
    },
  });
});

/**
 * DELETE /ai/cache
 * Clear pricing cache (admin only)
 */
router.delete('/cache', authenticateToken, async (req: Request, res: Response) => {
  pricingService.clearCache();

  res.json({
    success: true,
    message: 'Cache cleared',
    timestamp: new Date().toISOString(),
  });
});

export default router;
