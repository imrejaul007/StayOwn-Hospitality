import express from 'express';
import HotelSettings from '../models/HotelSettings.js';
import Hotel from '../models/Hotel.js';
import { authenticate } from '../middleware/auth.js';
import { ensureTenantContext } from '../middleware/tenantIsolation.js';
import { ensurePropertyAccess } from '../middleware/propertyAccess.js';
import { assertUserCanAccessHotel } from '../middleware/propertyAccess.js';
import { authorizePolicy } from '../middleware/rbacPolicy.js';
import { validate } from '../middleware/validation.js';
import { ApplicationError } from '../middleware/errorHandler.js';
import { catchAsync } from '../utils/catchAsync.js';
import Joi from 'joi';

const router = express.Router();
const mutationBaselineSchema = Joi.object({}).unknown(true).optional();
const MASKED_SECRET_VALUE = '***masked***';

const maskSecret = (value) => (value ? MASKED_SECRET_VALUE : '');

const sanitizeIntegrationsForResponse = (integrations = {}) => {
  const safeIntegrations = JSON.parse(JSON.stringify(integrations));

  if (safeIntegrations.payment?.stripe) {
    safeIntegrations.payment.stripe.secretKey = maskSecret(safeIntegrations.payment.stripe.secretKey);
    safeIntegrations.payment.stripe.webhookSecret = maskSecret(safeIntegrations.payment.stripe.webhookSecret);
  }

  if (safeIntegrations.payment?.razorpay) {
    safeIntegrations.payment.razorpay.keySecret = maskSecret(safeIntegrations.payment.razorpay.keySecret);
  }

  if (safeIntegrations.ota?.booking) {
    safeIntegrations.ota.booking.apiKey = maskSecret(safeIntegrations.ota.booking.apiKey);
  }

  if (safeIntegrations.ota?.expedia) {
    safeIntegrations.ota.expedia.apiKey = maskSecret(safeIntegrations.ota.expedia.apiKey);
  }

  if (safeIntegrations.analytics?.mixpanel) {
    safeIntegrations.analytics.mixpanel.token = maskSecret(safeIntegrations.analytics.mixpanel.token);
  }

  return safeIntegrations;
};

// Apply authentication middleware to all routes
router.use(authenticate);
router.use(ensureTenantContext);
router.use(ensurePropertyAccess);

// GET routes use readAccess (admin, manager, frontdesk); mutation routes use modifyAccess (admin, manager)
const readOnly = authorizePolicy('hotelSettings', 'readAccess');
const mutate = authorizePolicy('hotelSettings', 'modifyAccess');

// Validation schemas for hotel settings
const hotelSettingsSchemas = {
  basicInfo: Joi.object({
    name: Joi.string().min(2).max(100).required(),
    address: Joi.object({
      street: Joi.string().required(),
      city: Joi.string().required(),
      state: Joi.string().required(),
      country: Joi.string().required(),
      postalCode: Joi.string()
    }),
    contact: Joi.object({
      phone: Joi.string().required(),
      email: Joi.string().email().required(),
      website: Joi.string().uri().allow('')
    })
  }),

  operations: Joi.object({
    checkInTime: Joi.string().pattern(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/).required(),
    checkOutTime: Joi.string().pattern(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/).required(),
    currency: Joi.string().length(3),
    timezone: Joi.string()
  }),

  policies: Joi.object({
    cancellation: Joi.string().max(500),
    child: Joi.string().max(500),
    pet: Joi.string().max(500),
    smoking: Joi.string().max(500),
    extraBed: Joi.string().max(500)
  }),

  taxes: Joi.object({
    gst: Joi.number().min(0).max(100).required(),
    serviceCharge: Joi.number().min(0).max(100),
    localTax: Joi.number().min(0).max(100),
    tourismTax: Joi.number().min(0).max(100)
  }),

  integrations: Joi.object({
    payment: Joi.object({
      stripe: Joi.object({
        enabled: Joi.boolean(),
        publicKey: Joi.string().when('enabled', { is: true, then: Joi.required() }),
        secretKey: Joi.string().when('enabled', { is: true, then: Joi.required() }),
        webhookSecret: Joi.string()
      }),
      razorpay: Joi.object({
        enabled: Joi.boolean(),
        keyId: Joi.string().when('enabled', { is: true, then: Joi.required() }),
        keySecret: Joi.string().when('enabled', { is: true, then: Joi.required() })
      })
    }),
    ota: Joi.object({
      booking: Joi.object({
        enabled: Joi.boolean(),
        apiKey: Joi.string().when('enabled', { is: true, then: Joi.required() }),
        hotelId: Joi.string().when('enabled', { is: true, then: Joi.required() })
      }),
      expedia: Joi.object({
        enabled: Joi.boolean(),
        apiKey: Joi.string().when('enabled', { is: true, then: Joi.required() }),
        hotelId: Joi.string().when('enabled', { is: true, then: Joi.required() })
      })
    }),
    analytics: Joi.object({
      googleAnalytics: Joi.object({
        enabled: Joi.boolean(),
        trackingId: Joi.string().when('enabled', { is: true, then: Joi.required() })
      }),
      mixpanel: Joi.object({
        enabled: Joi.boolean(),
        token: Joi.string().when('enabled', { is: true, then: Joi.required() })
      })
    })
  }),

  bookingRules: Joi.object({
    minimumStay: Joi.object({
      enabled: Joi.boolean(),
      nights: Joi.number().min(1).max(30),
      applyToWeekends: Joi.boolean()
    }),
    maximumStay: Joi.object({
      enabled: Joi.boolean(),
      nights: Joi.number().min(1).max(365)
    }),
    advanceBooking: Joi.object({
      minDays: Joi.number().min(0).max(365),
      maxDays: Joi.number().min(1).max(730)
    }),
    cutoffTime: Joi.object({
      hours: Joi.number().min(0).max(168),
      sameDay: Joi.boolean()
    }),
    blackoutDates: Joi.object({
      enabled: Joi.boolean(),
      dates: Joi.array().items(Joi.string())
    }),
    cancellationWindow: Joi.object({
      hours: Joi.number().min(0).max(168),
      penaltyPercentage: Joi.number().min(0).max(100)
    }),
    gapRules: Joi.object({
      enabled: Joi.boolean(),
      minGapNights: Joi.number().min(1).max(7)
    })
  })
};

// GET /api/v1/hotel-settings - Get all hotel settings
router.get('/', readOnly, catchAsync(async (req, res, next) => {
  const hotelId = req.user.hotelId;

  if (!hotelId) {
    return next(new ApplicationError('User not associated with any hotel', 400));
  }

  const settings = await HotelSettings.getOrCreateForHotel(hotelId);

  // Don't expose sensitive data
  const safeSettings = JSON.parse(JSON.stringify(settings));
  if (safeSettings.integrations) {
    safeSettings.integrations = sanitizeIntegrationsForResponse(safeSettings.integrations);
  }

  res.status(200).json({
    status: 'success',
    data: { settings: safeSettings }
  });
}));

const guestExperienceUpdateSchema = Joi.object({
  meetUpsEnabled: Joi.boolean(),
  meetUpsEmailNotify: Joi.boolean(),
  maxPendingInvitesPerGuest: Joi.number().integer().min(1).max(100),
  quietHoursStart: Joi.string().pattern(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/).allow(null, ''),
  quietHoursEnd: Joi.string().pattern(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/).allow(null, ''),
  blockUrlsInMeetUpText: Joi.boolean(),
  profanityAction: Joi.string().valid('none', 'block', 'sanitize')
}).min(1);

// GET /api/v1/hotel-settings/guest-experience — guest portal toggles for the selected property
router.get('/guest-experience', readOnly, catchAsync(async (req, res, next) => {
  const hotelId = req.query.propertyId || req.user.hotelId;
  if (!hotelId) {
    return next(new ApplicationError('Property ID is required', 400));
  }
  await assertUserCanAccessHotel(req.user, hotelId);
  const settings = await HotelSettings.findOne({ hotelId }).select('guestExperience').lean();
  res.status(200).json({
    status: 'success',
    data: {
      guestExperience: settings?.guestExperience || { meetUpsEnabled: true }
    }
  });
}));

// PUT /api/v1/hotel-settings/guest-experience
router.put('/guest-experience', mutate, validate(guestExperienceUpdateSchema), catchAsync(async (req, res, next) => {
  const hotelId = req.query.propertyId || req.user.hotelId;
  if (!hotelId) {
    return next(new ApplicationError('Property ID is required', 400));
  }
  await assertUserCanAccessHotel(req.user, hotelId);
  const body = { ...req.body };
  const set = {};
  const mapField = (key, path = `guestExperience.${key}`) => {
    if (body[key] !== undefined) {
      let v = body[key];
      if (key === 'quietHoursStart' || key === 'quietHoursEnd') {
        v = v === '' ? null : v;
      }
      set[path] = v;
    }
  };
  mapField('meetUpsEnabled');
  mapField('meetUpsEmailNotify');
  mapField('maxPendingInvitesPerGuest');
  mapField('quietHoursStart');
  mapField('quietHoursEnd');
  mapField('blockUrlsInMeetUpText');
  mapField('profanityAction');

  const updated = await HotelSettings.findOneAndUpdate(
    { hotelId },
    { $set: set },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  res.status(200).json({
    status: 'success',
    message: 'Guest experience settings updated',
    data: { guestExperience: updated.guestExperience || {} }
  });
}));

// GET /api/v1/hotel-settings/backup - Create settings backup
router.get('/backup', readOnly, catchAsync(async (req, res, next) => {
  const hotelId = req.user.hotelId;

  if (!hotelId) {
    return next(new ApplicationError('User not associated with any hotel', 400));
  }

  const settings = await HotelSettings.findOne({ hotelId }).lean();
  if (!settings) {
    return next(new ApplicationError('Hotel settings not found', 404));
  }

  // Remove sensitive data from backup
  const backup = JSON.parse(JSON.stringify(settings));
  delete backup._id;
  delete backup.__v;

  // Remove sensitive integration keys
  if (backup.integrations) {
    if (backup.integrations.payment?.stripe?.secretKey) delete backup.integrations.payment.stripe.secretKey;
    if (backup.integrations.payment?.razorpay?.keySecret) delete backup.integrations.payment.razorpay.keySecret;
    if (backup.integrations.ota?.booking?.apiKey) delete backup.integrations.ota.booking.apiKey;
    if (backup.integrations.ota?.expedia?.apiKey) delete backup.integrations.ota.expedia.apiKey;
  }

  res.status(200).json({
    status: 'success',
    data: {
      backup,
      createdAt: new Date().toISOString(),
      hotelId,
      version: '1.0'
    }
  });
}));

// GET /api/v1/hotel-settings/:section - Get specific section
router.get('/:section', readOnly, catchAsync(async (req, res, next) => {
  const { section } = req.params;
  const hotelId = req.user.hotelId;

  if (!hotelId) {
    return next(new ApplicationError('User not associated with any hotel', 400));
  }

  const validSections = ['basicInfo', 'operations', 'policies', 'taxes', 'integrations', 'amenities', 'notifications', 'security', 'maintenance'];
  if (!validSections.includes(section)) {
    return next(new ApplicationError('Invalid settings section', 400));
  }

  const settings = await HotelSettings.getOrCreateForHotel(hotelId);
  const sectionData = settings[section] || {};
  const safeSectionData = section === 'integrations'
    ? sanitizeIntegrationsForResponse(sectionData)
    : sectionData;

  res.status(200).json({
    status: 'success',
    data: { [section]: safeSectionData }
  });
}));

// PUT /api/v1/hotel-settings/basic-info - Update basic hotel information
router.put('/basic-info', mutate, validate(hotelSettingsSchemas.basicInfo), catchAsync(async (req, res, next) => {
  const hotelId = req.user.hotelId;
  if (!hotelId) {
    return next(new ApplicationError('User not associated with any hotel', 400));
  }

  const updates = { 'basicInfo': req.body };
  const settings = await HotelSettings.updateHotelSettings(hotelId, updates);

  // Also update the main Hotel document
  await Hotel.findByIdAndUpdate(hotelId, {
    name: req.body.name,
    address: req.body.address,
    phone: req.body.contact.phone,
    email: req.body.contact.email,
    website: req.body.contact.website
  },
    { new: true }
  );

  res.status(200).json({
    status: 'success',
    message: 'Basic hotel information updated successfully',
    data: { settings }
  });
}));

// PUT /api/v1/hotel-settings/operations - Update operational settings
router.put('/operations', mutate, validate(hotelSettingsSchemas.operations), catchAsync(async (req, res, next) => {
  const hotelId = req.user.hotelId;
  if (!hotelId) {
    return next(new ApplicationError('User not associated with any hotel', 400));
  }

  const updates = { 'operations': req.body };
  const settings = await HotelSettings.updateHotelSettings(hotelId, updates);

  res.status(200).json({
    status: 'success',
    message: 'Operational settings updated successfully',
    data: { settings }
  });
}));

// PUT /api/v1/hotel-settings/policies - Update hotel policies
router.put('/policies', mutate, validate(hotelSettingsSchemas.policies), catchAsync(async (req, res, next) => {
  const hotelId = req.user.hotelId;
  if (!hotelId) {
    return next(new ApplicationError('User not associated with any hotel', 400));
  }

  const updates = { 'policies': req.body };
  const settings = await HotelSettings.updateHotelSettings(hotelId, updates);

  res.status(200).json({
    status: 'success',
    message: 'Hotel policies updated successfully',
    data: { settings }
  });
}));

// PUT /api/v1/hotel-settings/taxes - Update tax settings
router.put('/taxes', mutate, validate(hotelSettingsSchemas.taxes), catchAsync(async (req, res, next) => {
  const hotelId = req.user.hotelId;
  if (!hotelId) {
    return next(new ApplicationError('User not associated with any hotel', 400));
  }

  const updates = { 'taxes': req.body };
  const settings = await HotelSettings.updateHotelSettings(hotelId, updates);

  res.status(200).json({
    status: 'success',
    message: 'Tax settings updated successfully',
    data: { settings }
  });
}));

// PUT /api/v1/hotel-settings/integrations - Update integration settings
router.put('/integrations', mutate, validate(hotelSettingsSchemas.integrations), catchAsync(async (req, res, next) => {
  const hotelId = req.user.hotelId;
  if (!hotelId) {
    return next(new ApplicationError('User not associated with any hotel', 400));
  }

  // Mask sensitive keys - don't store masked placeholders, keep existing values
  const integrationData = JSON.parse(JSON.stringify(req.body));
  const currentSettings = await HotelSettings.findOne({ hotelId }).lean();

  // If masked values are sent back, preserve the existing stored values
  if (integrationData.payment?.stripe?.secretKey === MASKED_SECRET_VALUE && currentSettings?.integrations?.payment?.stripe?.secretKey) {
    integrationData.payment.stripe.secretKey = currentSettings.integrations.payment.stripe.secretKey;
  }
  if (integrationData.payment?.stripe?.webhookSecret === MASKED_SECRET_VALUE && currentSettings?.integrations?.payment?.stripe?.webhookSecret) {
    integrationData.payment.stripe.webhookSecret = currentSettings.integrations.payment.stripe.webhookSecret;
  }
  if (integrationData.payment?.razorpay?.keySecret === MASKED_SECRET_VALUE && currentSettings?.integrations?.payment?.razorpay?.keySecret) {
    integrationData.payment.razorpay.keySecret = currentSettings.integrations.payment.razorpay.keySecret;
  }
  if (integrationData.ota?.booking?.apiKey === MASKED_SECRET_VALUE && currentSettings?.integrations?.ota?.booking?.apiKey) {
    integrationData.ota.booking.apiKey = currentSettings.integrations.ota.booking.apiKey;
  }
  if (integrationData.ota?.expedia?.apiKey === MASKED_SECRET_VALUE && currentSettings?.integrations?.ota?.expedia?.apiKey) {
    integrationData.ota.expedia.apiKey = currentSettings.integrations.ota.expedia.apiKey;
  }
  if (integrationData.analytics?.mixpanel?.token === MASKED_SECRET_VALUE && currentSettings?.integrations?.analytics?.mixpanel?.token) {
    integrationData.analytics.mixpanel.token = currentSettings.integrations.analytics.mixpanel.token;
  }

  const updates = { 'integrations': integrationData };
  const settings = await HotelSettings.updateHotelSettings(hotelId, updates);
  const safeUpdatedSettings = JSON.parse(JSON.stringify(settings));
  if (safeUpdatedSettings.integrations) {
    safeUpdatedSettings.integrations = sanitizeIntegrationsForResponse(safeUpdatedSettings.integrations);
  }

  res.status(200).json({
    status: 'success',
    message: 'Integration settings updated successfully',
    data: { settings: safeUpdatedSettings }
  });
}));

// Validation schemas for security and maintenance
const securitySchema = Joi.object({
  requireTwoFactor: Joi.boolean(),
  sessionSettings: Joi.object({
    timeout: Joi.number().min(5).max(480),
    maxConcurrentSessions: Joi.number().min(1).max(20)
  }),
  passwordPolicy: Joi.object({
    minLength: Joi.number().min(6).max(32),
    requireUppercase: Joi.boolean(),
    requireNumbers: Joi.boolean(),
    requireSymbols: Joi.boolean(),
    expireDays: Joi.number().min(0).max(365)
  }),
  auditLog: Joi.boolean(),
  ipRestrictions: Joi.array().items(Joi.string()),
  maxLoginAttempts: Joi.number().min(1).max(20)
});

const maintenanceSchema = Joi.object({
  autoBackup: Joi.boolean(),
  backupSchedule: Joi.string().valid('hourly', 'daily', 'weekly'),
  backupRetention: Joi.number().min(1).max(365),
  maintenanceWindow: Joi.object({
    start: Joi.string().pattern(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/),
    end: Joi.string().pattern(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/),
    timezone: Joi.string()
  })
});

// PUT /api/v1/hotel-settings/security - Update security settings
router.put('/security', mutate, validate(securitySchema), catchAsync(async (req, res, next) => {
  const hotelId = req.user.hotelId;
  if (!hotelId) {
    return next(new ApplicationError('User not associated with any hotel', 400));
  }

  const securityData = {
    requireTwoFactor: req.body.requireTwoFactor,
    sessionSettings: req.body.sessionSettings,
    passwordPolicy: req.body.passwordPolicy,
    auditLog: req.body.auditLog !== undefined ? req.body.auditLog : true,
    ipRestrictions: req.body.ipRestrictions || [],
    maxLoginAttempts: req.body.maxLoginAttempts || 5
  };

  const settings = await HotelSettings.updateHotelSettings(hotelId, { security: securityData });

  res.status(200).json({
    status: 'success',
    message: 'Security settings updated successfully',
    data: { security: settings.security }
  });
}));

// PUT /api/v1/hotel-settings/maintenance - Update maintenance settings
router.put('/maintenance', mutate, validate(maintenanceSchema), catchAsync(async (req, res, next) => {
  const hotelId = req.user.hotelId;
  if (!hotelId) {
    return next(new ApplicationError('User not associated with any hotel', 400));
  }

  const maintenanceData = {
    autoBackup: req.body.autoBackup !== undefined ? req.body.autoBackup : true,
    backupSchedule: req.body.backupSchedule || 'daily',
    backupRetention: req.body.backupRetention || 30,
    maintenanceWindow: req.body.maintenanceWindow || {
      start: '02:00',
      end: '04:00',
      timezone: 'Asia/Kolkata'
    }
  };

  const settings = await HotelSettings.updateHotelSettings(hotelId, { maintenance: maintenanceData });

  res.status(200).json({
    status: 'success',
    message: 'Maintenance settings updated successfully',
    data: { maintenance: settings.maintenance }
  });
}));

// POST /api/v1/hotel-settings/integrations/test - Test integration connection
router.post('/integrations/test', mutate, validate(mutationBaselineSchema), catchAsync(async (req, res, next) => {
  const { type, service } = req.body;

  const hotelId = req.user.hotelId;
  if (!hotelId) {
    return next(new ApplicationError('User not associated with any hotel', 400));
  }

  const settings = await HotelSettings.findOne({ hotelId }).lean();
  if (!settings) {
    return next(new ApplicationError('Hotel settings not found', 404));
  }

  const integration = settings.integrations?.[type]?.[service];
  if (!integration || !integration.enabled) {
    return next(new ApplicationError(`${service} integration is not enabled`, 400));
  }

  // Connectivity check: verify the API key format is valid before reporting status.
  // This does not make a live call to the external service but validates that
  // required credentials are present and well-formed.
  let testResult = { success: false, message: 'Unknown integration type' };

  if (type === 'payment' && service === 'stripe') {
    const key = integration.publicKey || '';
    if (/^pk_(test|live)_[A-Za-z0-9]{20,}$/.test(key)) {
      testResult = { success: true, message: 'Stripe API key format is valid' };
    } else {
      testResult = { success: false, message: 'Stripe public key format is invalid. Expected pk_test_* or pk_live_*' };
    }
  } else if (type === 'payment' && service === 'razorpay') {
    const key = integration.keyId || '';
    if (/^rzp_(test|live)_[A-Za-z0-9]{10,}$/.test(key)) {
      testResult = { success: true, message: 'Razorpay key ID format is valid' };
    } else {
      testResult = { success: false, message: 'Razorpay key ID format is invalid. Expected rzp_test_* or rzp_live_*' };
    }
  } else if (type === 'analytics' && service === 'googleAnalytics') {
    const trackingId = integration.trackingId || '';
    if (/^(UA-\d{4,}-\d+|G-[A-Za-z0-9]{8,})$/.test(trackingId)) {
      testResult = { success: true, message: 'Google Analytics tracking ID format is valid' };
    } else {
      testResult = { success: false, message: 'Google Analytics tracking ID format is invalid. Expected UA-XXXXX-X or G-XXXXXXXX' };
    }
  } else if (type === 'analytics' && service === 'mixpanel') {
    const token = integration.token || '';
    if (token.length >= 20) {
      testResult = { success: true, message: 'Mixpanel token format is valid' };
    } else {
      testResult = { success: false, message: 'Mixpanel token appears too short or missing' };
    }
  } else if (type === 'ota') {
    const apiKey = integration.apiKey || '';
    const hotelIdField = integration.hotelId || '';
    if (apiKey.length >= 10 && hotelIdField.length >= 1) {
      testResult = { success: true, message: `${service} OTA credentials format check passed` };
    } else {
      testResult = { success: false, message: `${service} OTA credentials are incomplete or too short` };
    }
  }

  res.status(200).json({
    status: 'success',
    data: { testResult }
  });
}));

// POST /api/v1/hotel-settings/amenities - Add new amenity
router.post('/amenities', mutate, validate(mutationBaselineSchema), catchAsync(async (req, res, next) => {
  const { name, category, enabled = true, chargeable = false, price } = req.body;

  if (!name || !category) {
    return next(new ApplicationError('Name and category are required', 400));
  }

  const hotelId = req.user.hotelId;
  if (!hotelId) {
    return next(new ApplicationError('User not associated with any hotel', 400));
  }

  const settings = await HotelSettings.findOne({ hotelId });
  if (!settings) {
    return next(new ApplicationError('Hotel settings not found', 404));
  }

  const newAmenity = { name, category, enabled, chargeable, price: chargeable ? price : undefined };
  settings.amenities.push(newAmenity);
  await settings.save();

  res.status(201).json({
    status: 'success',
    message: 'Amenity added successfully',
    data: { amenity: newAmenity }
  });
}));

// PUT /api/v1/hotel-settings/amenities/:amenityId - Update amenity
router.put('/amenities/:amenityId', mutate, validate(mutationBaselineSchema), catchAsync(async (req, res, next) => {
  const { amenityId } = req.params;
  const { name, category, enabled, chargeable, price } = req.body;

  const hotelId = req.user.hotelId;
  if (!hotelId) {
    return next(new ApplicationError('User not associated with any hotel', 400));
  }

  const settings = await HotelSettings.findOne({ hotelId });
  if (!settings) {
    return next(new ApplicationError('Hotel settings not found', 404));
  }

  const amenity = settings.amenities.id(amenityId);
  if (!amenity) {
    return next(new ApplicationError('Amenity not found', 404));
  }

  if (name !== undefined) amenity.name = name;
  if (category !== undefined) amenity.category = category;
  if (enabled !== undefined) amenity.enabled = enabled;
  if (chargeable !== undefined) amenity.chargeable = chargeable;
  if (price !== undefined) amenity.price = price;

  await settings.save();

  res.status(200).json({
    status: 'success',
    message: 'Amenity updated successfully',
    data: { amenity }
  });
}));

// DELETE /api/v1/hotel-settings/amenities/:amenityId - Delete amenity
router.delete('/amenities/:amenityId', mutate, validate(mutationBaselineSchema), catchAsync(async (req, res, next) => {
  const { amenityId } = req.params;

  const hotelId = req.user.hotelId;
  if (!hotelId) {
    return next(new ApplicationError('User not associated with any hotel', 400));
  }

  const settings = await HotelSettings.findOne({ hotelId });
  if (!settings) {
    return next(new ApplicationError('Hotel settings not found', 404));
  }

  const amenity = settings.amenities.id(amenityId);
  if (!amenity) {
    return next(new ApplicationError('Amenity not found', 404));
  }

  amenity.deleteOne();
  await settings.save();

  res.status(200).json({
    status: 'success',
    message: 'Amenity deleted successfully'
  });
}));

// POST /api/v1/hotel-settings/restore - Restore settings from backup
router.post('/restore', mutate, validate(mutationBaselineSchema), catchAsync(async (req, res, next) => {
  const { backup } = req.body;

  if (!backup || typeof backup !== 'object') {
    return next(new ApplicationError('Invalid backup data', 400));
  }

  const hotelId = req.user.hotelId;
  if (!hotelId) {
    return next(new ApplicationError('User not associated with any hotel', 400));
  }

  // Only allow known settings fields to prevent arbitrary data injection
  const allowedFields = ['basicInfo', 'operations', 'policies', 'taxes', 'amenities', 'roomDefaults', 'notifications', 'security', 'maintenance', 'guestExperience'];
  const sanitizedBackup = {};
  for (const field of allowedFields) {
    if (backup[field] !== undefined) {
      sanitizedBackup[field] = backup[field];
    }
  }

  if (Object.keys(sanitizedBackup).length === 0) {
    return next(new ApplicationError('Backup data contains no valid settings fields', 400));
  }

  const settings = await HotelSettings.updateHotelSettings(hotelId, sanitizedBackup);

  res.status(200).json({
    status: 'success',
    message: 'Settings restored from backup successfully',
    data: { settings }
  });
}));

// GET /api/v1/hotel-settings/booking-rules - Get booking rules
router.get('/booking-rules', readOnly, catchAsync(async (req, res, next) => {
  const propertyId = req.query.propertyId || req.user.hotelId;

  if (!propertyId) {
    return next(new ApplicationError('Property ID is required', 400));
  }
  await assertUserCanAccessHotel(req.user, propertyId);

  const settings = await HotelSettings.getOrCreateForHotel(propertyId);

  res.status(200).json({
    status: 'success',
    data: {
      bookingRules: settings.bookingRules || {
        minimumStay: { enabled: false, nights: 1, applyToWeekends: false },
        maximumStay: { enabled: false, nights: 30 },
        advanceBooking: { minDays: 0, maxDays: 365 },
        cutoffTime: { hours: 24, sameDay: false },
        blackoutDates: { enabled: false, dates: [] },
        cancellationWindow: { hours: 24, penaltyPercentage: 0 },
        gapRules: { enabled: false, minGapNights: 1 }
      }
    }
  });
}));

// PUT /api/v1/hotel-settings/booking-rules - Update booking rules
router.put('/booking-rules', mutate, validate(hotelSettingsSchemas.bookingRules), catchAsync(async (req, res, next) => {
  const { propertyId, ...bookingRulesData } = req.body;

  const targetPropertyId = propertyId || req.user.hotelId;

  if (!targetPropertyId) {
    return next(new ApplicationError('Property ID is required', 400));
  }
  await assertUserCanAccessHotel(req.user, targetPropertyId);

  const { error } = hotelSettingsSchemas.bookingRules.validate(bookingRulesData);
  if (error) {
    return next(new ApplicationError(error.details[0].message, 400));
  }

  const updates = { bookingRules: bookingRulesData };
  const settings = await HotelSettings.updateHotelSettings(targetPropertyId, updates);

  res.status(200).json({
    status: 'success',
    message: 'Booking rules updated successfully',
    data: { bookingRules: settings.bookingRules }
  });
}));

export default router;