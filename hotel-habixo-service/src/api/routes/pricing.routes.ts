// Pricing Routes for Habixo
import { Router, Request, Response } from 'express';
import {
  getPricingEstimate,
  getAIRecommendedPrice,
  updateHostPricingRules,
  learnFromMarket,
  calculateSmartPrice,
  PRICING_FACTORS,
} from '../../services';
import { logger } from '../../utils/logger';

const router = Router();
const pricingLogger = logger.child({ service: 'PricingRoutes' });

/**
 * GET /api/habixo/pricing/estimate
 * Calculate price estimate for dates
 * Query params: propertyId, checkIn, checkOut, guests (optional)
 */
router.get('/estimate', async (req: Request, res: Response) => {
  try {
    const { propertyId, checkIn, checkOut, adults, children, infants } = req.query;

    if (!propertyId || !checkIn || !checkOut) {
      res.status(400).json({
        success: false,
        message: 'Missing required parameters: propertyId, checkIn, checkOut',
      });
      return;
    }

    const guests = adults
      ? {
          adults: parseInt(adults as string) || 1,
          children: parseInt(children as string) || 0,
          infants: parseInt(infants as string) || 0,
        }
      : undefined;

    const estimate = await getPricingEstimate(
      propertyId as string,
      checkIn as string,
      checkOut as string,
      guests
    );

    res.json({
      success: true,
      data: estimate,
    });
  } catch (error) {
    pricingLogger.error({ error, query: req.query }, 'Failed to get pricing estimate');
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to calculate pricing estimate',
    });
  }
});

/**
 * POST /api/habixo/pricing/smart
 * Get AI-recommended smart price
 * Body: { propertyId, dates: { checkIn, checkOut }, guests?: { adults, children, infants } }
 */
router.post('/smart', async (req: Request, res: Response) => {
  try {
    const { propertyId, dates, guests } = req.body;

    if (!propertyId || !dates || !dates.checkIn || !dates.checkOut) {
      res.status(400).json({
        success: false,
        message: 'Missing required fields: propertyId, dates.checkIn, dates.checkOut',
      });
      return;
    }

    const recommendation = await getAIRecommendedPrice(
      propertyId,
      {
        checkIn: dates.checkIn,
        checkOut: dates.checkOut,
      },
      guests
    );

    res.json({
      success: true,
      data: recommendation,
    });
  } catch (error) {
    pricingLogger.error({ error, body: req.body }, 'Failed to get AI recommendation');
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to get AI price recommendation',
    });
  }
});

/**
 * GET /api/habixo/pricing/smart
 * Get AI-recommended smart price (GET version)
 * Query params: propertyId, checkIn, checkOut, adults, children, infants
 */
router.get('/smart', async (req: Request, res: Response) => {
  try {
    const { propertyId, checkIn, checkOut, adults, children, infants } = req.query;

    if (!propertyId || !checkIn || !checkOut) {
      res.status(400).json({
        success: false,
        message: 'Missing required parameters: propertyId, checkIn, checkOut',
      });
      return;
    }

    const guests = adults
      ? {
          adults: parseInt(adults as string) || 1,
          children: parseInt(children as string) || 0,
          infants: parseInt(infants as string) || 0,
        }
      : undefined;

    const recommendation = await getAIRecommendedPrice(
      propertyId as string,
      {
        checkIn: checkIn as string,
        checkOut: checkOut as string,
      },
      guests
    );

    res.json({
      success: true,
      data: recommendation,
    });
  } catch (error) {
    pricingLogger.error({ error, query: req.query }, 'Failed to get AI recommendation');
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to get AI price recommendation',
    });
  }
});

/**
 * GET /api/habixo/pricing/breakdown
 * Get detailed price breakdown
 * Query params: propertyId, checkIn, checkOut
 */
router.get('/breakdown', async (req: Request, res: Response) => {
  try {
    const { propertyId, checkIn, checkOut, adults, children, infants } = req.query;

    if (!propertyId || !checkIn || !checkOut) {
      res.status(400).json({
        success: false,
        message: 'Missing required parameters: propertyId, checkIn, checkOut',
      });
      return;
    }

    const guests = adults
      ? {
          adults: parseInt(adults as string) || 1,
          children: parseInt(children as string) || 0,
          infants: parseInt(infants as string) || 0,
        }
      : undefined;

    const smartPrice = await calculateSmartPrice(
      propertyId as string,
      { checkIn: checkIn as string, checkOut: checkOut as string },
      guests
    );

    res.json({
      success: true,
      data: smartPrice,
    });
  } catch (error) {
    pricingLogger.error({ error, query: req.query }, 'Failed to get price breakdown');
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to get price breakdown',
    });
  }
});

/**
 * GET /api/habixo/pricing/factors
 * Get current pricing factors/multipliers
 */
router.get('/factors', (req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      factors: PRICING_FACTORS,
      descriptions: {
        weekdayMultiplier: 'Base price multiplier for Monday-Thursday',
        weekendMultiplier: 'Price multiplier for Friday-Sunday',
        peakSeasonMultiplier: 'Multiplier during high-demand seasons',
        offSeasonMultiplier: 'Discount multiplier during low-demand periods',
        lastMinuteDiscount: 'Discount when booking within threshold days',
        longStayDiscount: 'Discount for stays over threshold nights',
        guestExtraPricePerPerson: 'Additional fee per extra guest',
        maxGuestsIncluded: 'Number of guests included in base price',
      },
      peakSeasons: [
        { name: 'Summer', period: 'May 15 - Aug 31' },
        { name: 'Holiday', period: 'Dec 20 - Jan 5' },
        { name: 'Spring Break', period: 'Mar 15 - Apr 15' },
      ],
    },
  });
});

/**
 * POST /api/habixo/pricing/learn
 * Trigger market learning for a property
 * Body: { propertyId }
 */
router.post('/learn', async (req: Request, res: Response) => {
  try {
    const { propertyId } = req.body;

    if (!propertyId) {
      res.status(400).json({
        success: false,
        message: 'Missing required field: propertyId',
      });
      return;
    }

    const learningResult = await learnFromMarket(propertyId);

    res.json({
      success: true,
      data: learningResult,
    });
  } catch (error) {
    pricingLogger.error({ error, body: req.body }, 'Failed to learn from market');
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to analyze market data',
    });
  }
});

/**
 * PUT /api/habixo/host/pricing/:id
 * Update host pricing rules
 * Body: { hostId, rules: {...}, options: {...} }
 */
router.put('/host/pricing/:id', async (req: Request, res: Response) => {
  try {
    const { id: propertyId } = req.params;
    const { hostId, rules, options } = req.body;

    if (!hostId) {
      res.status(400).json({
        success: false,
        message: 'Missing required field: hostId',
      });
      return;
    }

    if (!rules || typeof rules !== 'object') {
      res.status(400).json({
        success: false,
        message: 'Missing required field: rules (object)',
      });
      return;
    }

    const updatedRules = await updateHostPricingRules(
      propertyId,
      hostId,
      rules,
      options
    );

    res.json({
      success: true,
      data: updatedRules,
      message: 'Pricing rules updated successfully',
    });
  } catch (error) {
    pricingLogger.error({ error, params: req.params, body: req.body }, 'Failed to update pricing rules');
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to update pricing rules',
    });
  }
});

/**
 * GET /api/habixo/host/pricing/:id
 * Get host pricing rules for a property
 * Query params: hostId
 */
router.get('/host/pricing/:id', async (req: Request, res: Response) => {
  try {
    const { id: propertyId } = req.params;
    const { hostId } = req.query;

    if (!hostId) {
      res.status(400).json({
        success: false,
        message: 'Missing required query param: hostId',
      });
      return;
    }

    // In production, this would fetch from HostPricingRules collection
    // For now, return a placeholder response
    res.json({
      success: true,
      data: {
        propertyId,
        hostId,
        customRules: {
          minPrice: null,
          maxPrice: null,
          weekendPremium: PRICING_FACTORS.weekendMultiplier,
          lastMinuteDiscount: PRICING_FACTORS.lastMinuteDiscount,
          longStayDiscount: PRICING_FACTORS.longStayDiscount,
          seasonalAdjustments: [],
          eventPricing: [],
          blockedDates: [],
          customPricing: [],
        },
        autoPricingEnabled: false,
        competitorBasedPricing: false,
        lastUpdated: new Date().toISOString(),
      },
    });
  } catch (error) {
    pricingLogger.error({ error, params: req.params }, 'Failed to get pricing rules');
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to get pricing rules',
    });
  }
});

export default router;
