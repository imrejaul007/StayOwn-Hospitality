import express from 'express';
import UserPreference from '../models/UserPreference.js';
import HotelSettings from '../models/HotelSettings.js';
import User from '../models/User.js';
import { authenticate } from '../middleware/auth.js';
import { ensurePropertyAccess } from '../middleware/propertyAccess.js';
import { ensureTenantContext } from '../middleware/tenantIsolation.js';
import { authorizePolicy } from '../middleware/rbacPolicy.js';
import { ApplicationError } from '../middleware/errorHandler.js';
import { catchAsync } from '../utils/catchAsync.js';
import { validate, schemas } from '../middleware/validation.js';
import ProfileSyncService from '../services/profileSyncService.js';
import logger from '../utils/logger.js';
import Joi from 'joi';

const router = express.Router();
const mutationBaselineSchema = Joi.object({}).unknown(true).optional();

// Apply authentication, tenant isolation, and property access middleware to all routes
router.use(authenticate);
router.use(ensureTenantContext);
router.use(ensurePropertyAccess);
router.use(authorizePolicy('userPreferences', 'baseAccess'));

// Validation schemas for different preference types
const preferenceSchemas = {
  profile: Joi.object({
    timezone: Joi.string(),
    language: Joi.string().valid('en', 'es', 'fr', 'de', 'hi', 'ja', 'zh'),
    avatar: Joi.string().uri().allow('')
  }),

  notifications: Joi.object({
    channels: Joi.object({
      inApp: Joi.boolean(),
      email: Joi.boolean(),
      sms: Joi.boolean(),
      push: Joi.boolean()
    }),
    categories: Joi.object().pattern(Joi.string(), Joi.boolean()),
    quietHours: Joi.object({
      enabled: Joi.boolean(),
      start: Joi.string().pattern(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/),
      end: Joi.string().pattern(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/)
    }),
    sound: Joi.boolean(),
    desktop: Joi.boolean(),
    vibration: Joi.boolean(),
    frequency: Joi.string().valid('instant', 'hourly', 'daily')
  }),

  display: Joi.object({
    theme: Joi.string().valid('light', 'dark', 'auto'),
    sidebarCollapsed: Joi.boolean(),
    compactView: Joi.boolean(),
    highContrast: Joi.boolean(),
    dateFormat: Joi.string(),
    timeFormat: Joi.string().valid('12h', '24h'),
    currency: Joi.string(),
    numberFormat: Joi.string()
  }),

  staff: Joi.object({
    department: Joi.string(),
    employeeId: Joi.string(),
    availability: Joi.object({
      status: Joi.string().valid('available', 'busy', 'break', 'offline'),
      autoStatusChange: Joi.boolean(),
      breakReminder: Joi.boolean(),
      breakDuration: Joi.number().min(5).max(60),
      maxTasksPerHour: Joi.number().min(1).max(20)
    }),
    quickActions: Joi.array().items(
      Joi.string().valid('daily-check', 'guest-request', 'maintenance', 'inventory', 'housekeeping')
    )
  }),

  guest: Joi.object({
    stayPreferences: Joi.object({
      roomType: Joi.string().valid('Standard', 'Deluxe', 'Suite', 'Executive'),
      floor: Joi.string().valid('Any', 'High', 'Low'),
      bedType: Joi.string().valid('Single', 'Double', 'Twin', 'King'),
      smoking: Joi.boolean(),
      dietaryRestrictions: Joi.array().items(
        Joi.string().valid('vegetarian', 'vegan', 'gluten-free', 'dairy-free', 'halal', 'kosher')
      )
    }),
    communication: Joi.object({
      preferredChannel: Joi.string().valid('email', 'sms', 'whatsapp', 'in_app'),
      marketingConsent: Joi.boolean()
    }),
    privacy: Joi.object({
      dataSharing: Joi.boolean(),
      locationTracking: Joi.boolean(),
      analyticsTracking: Joi.boolean()
    })
  }),

  system: Joi.object({
    twoFactorAuth: Joi.boolean(),
    sessionTimeout: Joi.number().min(5).max(480),
    autoLogout: Joi.boolean(),
    passwordExpiry: Joi.number().min(30).max(365),
    loginAttempts: Joi.number().min(3).max(10),
    backupSchedule: Joi.string().valid('hourly', 'daily', 'weekly', 'monthly'),
    dataRetention: Joi.number().min(30).max(2555)
  })
};

// GET /api/v1/user-preferences - Get all user preferences
router.get('/', catchAsync(async (req, res, next) => {
  const userId = req.user._id;
  const hotelId = req.user.hotelId;

  const preferences = await UserPreference.getOrCreateForUser(userId, hotelId);

  res.status(200).json({
    status: 'success',
    data: { preferences }
  });
}));

// GET /api/v1/user-preferences/export - Export user preferences
// NOTE: This must be defined BEFORE /:section to avoid being caught by the param route
router.get('/export', catchAsync(async (req, res, next) => {
  const userId = req.user._id;

  const preferences = await UserPreference.getOrCreateForUser(userId, req.user.hotelId);

  // Remove sensitive data before export
  const exportData = JSON.parse(JSON.stringify(preferences));
  delete exportData.system; // Don't export system preferences
  delete exportData._id;
  delete exportData.__v;
  delete exportData.createdAt;
  delete exportData.updatedAt;

  res.status(200).json({
    status: 'success',
    data: {
      preferences: exportData,
      exportedAt: new Date().toISOString(),
      user: {
        name: req.user.name,
        email: req.user.email,
        role: req.user.role
      }
    }
  });
}));

// GET /api/v1/user-preferences/:section - Get specific section of preferences
router.get('/:section', catchAsync(async (req, res, next) => {
  const { section } = req.params;
  const userId = req.user._id;

  const validSections = ['profile', 'notifications', 'display', 'staff', 'guest', 'system'];
  if (!validSections.includes(section)) {
    return next(new ApplicationError('Invalid preferences section', 400));
  }

  const preferences = await UserPreference.getOrCreateForUser(userId, req.user.hotelId);

  res.status(200).json({
    status: 'success',
    data: { [section]: preferences[section] || {} }
  });
}));

// Helper: flatten an object into dot-notation keys under a given prefix
// This prevents partial PUT requests from wiping fields not included in the body.
function flattenToDotNotation(obj, prefix) {
  const result = {};
  const recurse = (current, path) => {
    Object.keys(current).forEach(key => {
      const val = current[key];
      const fullPath = `${path}.${key}`;
      if (val !== null && typeof val === 'object' && !Array.isArray(val)) {
        recurse(val, fullPath);
      } else {
        result[fullPath] = val;
      }
    });
  };
  recurse(obj, prefix);
  return result;
}

// PUT /api/v1/user-preferences/profile - Update profile preferences
router.put('/profile', catchAsync(async (req, res, next) => {
  const { error } = preferenceSchemas.profile.validate(req.body);
  if (error) {
    return next(new ApplicationError(error.details[0].message, 400));
  }

  const userId = req.user._id;
  const updates = flattenToDotNotation(req.body, 'profile');

  const preferences = await UserPreference.updatePreferences(userId, updates);

  res.status(200).json({
    status: 'success',
    message: 'Profile preferences updated successfully',
    data: { preferences }
  });
}));

// PUT /api/v1/user-preferences/notifications - Update notification preferences
router.put('/notifications', catchAsync(async (req, res, next) => {
  const { error } = preferenceSchemas.notifications.validate(req.body);
  if (error) {
    return next(new ApplicationError(error.details[0].message, 400));
  }

  const userId = req.user._id;
  // Use dot-notation to avoid wiping existing channels, quietHours, etc.
  const updates = flattenToDotNotation(req.body, 'notifications');

  const preferences = await UserPreference.updatePreferences(userId, updates);

  res.status(200).json({
    status: 'success',
    message: 'Notification preferences updated successfully',
    data: { preferences }
  });
}));

// PUT /api/v1/user-preferences/display - Update display preferences
router.put('/display', catchAsync(async (req, res, next) => {
  const { error } = preferenceSchemas.display.validate(req.body);
  if (error) {
    return next(new ApplicationError(error.details[0].message, 400));
  }

  const userId = req.user._id;
  // Use dot-notation to avoid wiping existing display fields not sent in this request
  const updates = flattenToDotNotation(req.body, 'display');

  const preferences = await UserPreference.updatePreferences(userId, updates);

  res.status(200).json({
    status: 'success',
    message: 'Display preferences updated successfully',
    data: { preferences }
  });
}));

// PUT /api/v1/user-preferences/staff - Update staff preferences (staff only)
router.put('/staff', authorizePolicy('userPreferences', 'staffAccess'), catchAsync(async (req, res, next) => {
  const { error } = preferenceSchemas.staff.validate(req.body);
  if (error) {
    return next(new ApplicationError(error.details[0].message, 400));
  }

  const userId = req.user._id;
  // Use dot-notation to merge into existing staff preferences without wiping
  const updates = flattenToDotNotation(req.body, 'staff');

  const preferences = await UserPreference.updatePreferences(userId, updates);

  res.status(200).json({
    status: 'success',
    message: 'Staff preferences updated successfully',
    data: { preferences }
  });
}));

// PUT /api/v1/user-preferences/guest - Update guest preferences (guest only)
router.put('/guest', authorizePolicy('userPreferences', 'guestAccess'), catchAsync(async (req, res, next) => {
  const { error } = preferenceSchemas.guest.validate(req.body);
  if (error) {
    return next(new ApplicationError(error.details[0].message, 400));
  }

  const userId = req.user._id;
  // Use dot-notation to merge into existing guest preferences without wiping
  const updates = flattenToDotNotation(req.body, 'guest');

  const preferences = await UserPreference.updatePreferences(userId, updates);

  // Sync preferences back to User model
  await ProfileSyncService.syncPreferencesToUser(req.user._id).catch(err => logger.warn('ProfileSyncService.syncPreferencesToUser failed:', err.message));

  res.status(200).json({
    status: 'success',
    message: 'Guest preferences updated successfully',
    data: { preferences }
  });
}));

// PUT /api/v1/user-preferences/system - Update system preferences (admin only)
router.put('/system', authorizePolicy('userPreferences', 'adminAccess'), catchAsync(async (req, res, next) => {
  const { error } = preferenceSchemas.system.validate(req.body);
  if (error) {
    return next(new ApplicationError(error.details[0].message, 400));
  }

  const userId = req.user._id;
  // Use dot-notation to merge into existing system preferences without wiping
  const updates = flattenToDotNotation(req.body, 'system');

  const preferences = await UserPreference.updatePreferences(userId, updates);

  res.status(200).json({
    status: 'success',
    message: 'System preferences updated successfully',
    data: { preferences }
  });
}));

// PATCH /api/v1/user-preferences/availability - Quick update staff availability
router.patch('/availability', authorizePolicy('userPreferences', 'staffAccess'), validate(mutationBaselineSchema), catchAsync(async (req, res, next) => {
  const { status } = req.body;

  const validStatuses = ['available', 'busy', 'break', 'offline'];
  if (!validStatuses.includes(status)) {
    return next(new ApplicationError('Invalid availability status', 400));
  }

  const userId = req.user._id;
  const updates = { 'staff.availability.status': status };

  const preferences = await UserPreference.updatePreferences(userId, updates);

  res.status(200).json({
    status: 'success',
    message: 'Availability status updated successfully',
    data: {
      availability: preferences.staff?.availability || { status }
    }
  });
}));

// DELETE /api/v1/user-preferences - Reset preferences to defaults
router.delete('/', validate(mutationBaselineSchema), catchAsync(async (req, res, next) => {
  const userId = req.user._id;

  await UserPreference.findOneAndDelete({ userId });

  // Create new preferences with defaults
  const preferences = await UserPreference.getOrCreateForUser(userId, req.user.hotelId);

  res.status(200).json({
    status: 'success',
    message: 'Preferences reset to defaults',
    data: { preferences }
  });
}));

// POST /api/v1/user-preferences/import - Import user preferences
router.post('/import', validate(mutationBaselineSchema), catchAsync(async (req, res, next) => {
  const { preferences } = req.body;

  if (!preferences || typeof preferences !== 'object') {
    return next(new ApplicationError('Invalid preferences data', 400));
  }

  const userId = req.user._id;

  // Remove system settings from import (security)
  delete preferences.system;
  delete preferences._id;
  delete preferences.__v;

  const updatedPreferences = await UserPreference.updatePreferences(userId, preferences);

  res.status(200).json({
    status: 'success',
    message: 'Preferences imported successfully',
    data: { preferences: updatedPreferences }
  });
}));

export default router;