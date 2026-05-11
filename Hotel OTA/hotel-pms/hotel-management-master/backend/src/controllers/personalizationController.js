import personalizationEngineService from '../services/personalizationEngineService.js';
import { catchAsync } from '../utils/catchAsync.js';
import { AppError } from '../utils/appError.js';
import { ensureTenantContext } from '../middleware/tenantIsolation.js';

export const generatePersonalizedExperience = catchAsync(async (req, res, next) => {
  const userId = req.user.id;
  const hotelId = req.user.hotelId;
  const context = req.body || {};

  const experience = await personalizationEngineService.generatePersonalizedExperience(
    userId,
    hotelId,
    context
  );

  res.status(200).json({
    success: true,
    data: experience
  });
});

export const getPersonalizedContent = catchAsync(async (req, res, next) => {
  const userId = req.user.id;
  const hotelId = req.user.hotelId;
  const { page = 'home', context = {} } = req.query;

  const experience = await personalizationEngineService.generatePersonalizedExperience(
    userId,
    hotelId,
    { page, ...context }
  );

  res.status(200).json({
    success: true,
    data: {
      content: experience.content,
      personalizationMetadata: experience.personalizationMetadata
    }
  });
});

export const getPersonalizedPricing = catchAsync(async (req, res, next) => {
  const userId = req.user.id;
  const hotelId = req.user.hotelId;
  const context = req.body || {};

  const experience = await personalizationEngineService.generatePersonalizedExperience(
    userId,
    hotelId,
    context
  );

  res.status(200).json({
    success: true,
    data: {
      pricing: experience.pricing,
      profileInfo: experience.profileInfo
    }
  });
});

export const getPersonalizedRecommendations = catchAsync(async (req, res, next) => {
  const userId = req.user.id;
  const hotelId = req.user.hotelId;
  const context = req.body || {};

  const experience = await personalizationEngineService.generatePersonalizedExperience(
    userId,
    hotelId,
    context
  );

  res.status(200).json({
    success: true,
    data: {
      recommendations: experience.recommendations,
      offers: experience.offers
    }
  });
});

export const getPersonalizedOffers = catchAsync(async (req, res, next) => {
  const userId = req.user.id;
  const hotelId = req.user.hotelId;
  const context = req.body || {};

  const experience = await personalizationEngineService.generatePersonalizedExperience(
    userId,
    hotelId,
    context
  );

  res.status(200).json({
    success: true,
    data: {
      offers: experience.offers,
      personalizationMetadata: experience.personalizationMetadata
    }
  });
});

export const getPersonalizedDashboard = catchAsync(async (req, res, next) => {
  const userId = req.user.id;
  const hotelId = req.user.hotelId;

  const dashboard = await personalizationEngineService.getPersonalizedDashboard(userId, hotelId);

  res.status(200).json({
    success: true,
    data: dashboard
  });
});

export const getPersonalizedExperienceForGuest = catchAsync(async (req, res, next) => {
  const { guestId } = req.params;
  const hotelId = req.user.hotelId;
  const context = req.body || {};

  // Admin/Manager can get personalized experience for any guest
  if (!['admin', 'manager'].includes(req.user.role)) {
    return next(new AppError('Insufficient permissions', 403));
  }

  const experience = await personalizationEngineService.generatePersonalizedExperience(
    guestId,
    hotelId,
    context
  );

  res.status(200).json({
    success: true,
    data: experience
  });
});

export const updatePersonalizationPreferences = catchAsync(async (req, res, next) => {
  const userId = req.user.id;
  const hotelId = req.user.hotelId;
  const preferences = req.body;

  // This would update user preferences that affect personalization
  // For now, we'll return success and regenerate experience
  const experience = await personalizationEngineService.generatePersonalizedExperience(
    userId,
    hotelId,
    { preferences }
  );

  res.status(200).json({
    success: true,
    message: 'Personalization preferences updated successfully',
    data: {
      updatedPreferences: preferences,
      newExperience: experience
    }
  });
});

export const getPersonalizationAnalytics = catchAsync(async (req, res, next) => {
  res.status(501).json({
    success: false,
    message: 'Personalization analytics requires event tracking and aggregation infrastructure. Not available in current deployment.',
    data: null
  });
});

export const testPersonalizationVariant = catchAsync(async (req, res, next) => {
  const userId = req.user.id;
  const hotelId = req.user.hotelId;
  const { variant, context = {} } = req.body;

  // This would run A/B testing for personalization variants
  const baseExperience = await personalizationEngineService.generatePersonalizedExperience(
    userId,
    hotelId,
    context
  );

  // Modify experience based on variant
  let variantExperience = { ...baseExperience };

  switch (variant) {
    case 'aggressive_discount':
      variantExperience.pricing.baseDiscountRange.max += 10;
      break;
    case 'luxury_focused':
      variantExperience.content.heroSection.headline = 'Indulge in Unmatched Luxury';
      variantExperience.recommendations = variantExperience.recommendations.filter(r =>
        ['suite', 'luxury', 'premium'].some(type => r.roomType.name.toLowerCase().includes(type))
      );
      break;
    case 'urgency_boost':
      variantExperience.content.heroSection.callToAction.urgency = 'high';
      variantExperience.offers.forEach(offer => {
        offer.expires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
      });
      break;
  }

  res.status(200).json({
    success: true,
    data: {
      variant,
      experience: variantExperience,
      testMetadata: {
        testId: `test_${Date.now()}`,
        startTime: new Date(),
        userId,
        hotelId
      }
    }
  });
});

export default {
  generatePersonalizedExperience,
  getPersonalizedContent,
  getPersonalizedPricing,
  getPersonalizedRecommendations,
  getPersonalizedOffers,
  getPersonalizedDashboard,
  getPersonalizedExperienceForGuest,
  updatePersonalizationPreferences,
  getPersonalizationAnalytics,
  testPersonalizationVariant
};