import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { ensureTenantContext } from '../middleware/tenantIsolation.js';
import { ensurePropertyAccess } from '../middleware/propertyAccess.js';
import { assertUserCanAccessHotel, getUserPropertyIds } from '../middleware/propertyAccess.js';
import { authorizePolicy } from '../middleware/rbacPolicy.js';
import { validate } from '../middleware/validation.js';
import { SettingsInheritanceService } from '../services/settingsInheritance.js';
import Hotel from '../models/Hotel.js';
import PropertyGroup from '../models/PropertyGroup.js';
import { ApplicationError } from '../middleware/errorHandler.js';
import { catchAsync } from '../utils/catchAsync.js';
import Joi from 'joi';

const router = express.Router();
const anySettingsMutationSchema = Joi.object({}).unknown(true);

const inheritanceManageAccess = authorizePolicy('settings', 'manageAccess');

const ensurePropertyParamAccess = catchAsync(async (req, res, next) => {
  const { propertyId } = req.params;
  if (!propertyId) return next();
  await assertUserCanAccessHotel(req.user, propertyId);
  next();
});

const ensureGroupParamAccess = catchAsync(async (req, res, next) => {
  const { groupId } = req.params;
  if (!groupId) return next();
  const group = await PropertyGroup.findById(groupId).lean();
  if (!group) {
    throw new ApplicationError('Property group not found', 404);
  }
  const userPropertyIds = await getUserPropertyIds(req.user._id, req.user);
  if (
    group.ownerId?.toString() !== req.user._id.toString() &&
    !await Hotel.exists({ _id: { $in: userPropertyIds }, propertyGroupId: groupId, isActive: true })
  ) {
    throw new ApplicationError('You do not have permission to access this group', 403);
  }
  req.propertyGroup = group;
  next();
});

/**
 * Settings Routes with Group Inheritance Support
 *
 * All endpoints support three application scopes:
 * 1. Single property only (default)
 * 2. Property group (applyToGroup: true)
 * 3. All user properties (applyToAll: true)
 */

// =============================================================================
// Check-in/Check-out Time Settings
// =============================================================================

/**
 * PUT /api/v1/settings/check-in-out
 * Update check-in/check-out times
 *
 * Body:
 * {
 *   "checkInTime": "14:00",
 *   "checkOutTime": "11:00",
 *   "applyToAll": false,
 *   "applyToGroup": false,
 *   "propertyId": "xxx"  // Required unless applyToAll is true
 * }
 */
router.put('/check-in-out',
  authenticate, ensureTenantContext,
  authorizePolicy('settings', 'baseAccess'),
  validate(anySettingsMutationSchema),
  catchAsync(async (req, res) => {
    const { checkInTime, checkOutTime, applyToAll, applyToGroup, propertyId } = req.body;

    // Validate time formats
    const validation = SettingsInheritanceService.validateSettings(
      { checkInTime, checkOutTime },
      'checkInOut'
    );

    if (!validation.valid) {
      throw new ApplicationError(validation.errors.join(', '), 400);
    }

    const settingUpdates = { checkInTime, checkOutTime };
    let result;

    if (applyToAll) {
      // Apply to all user properties
      result = await SettingsInheritanceService.applySettingsToAllUserProperties(
        req.user._id,
        settingUpdates,
        'checkInOut'
      );
    } else if (applyToGroup) {
      // Apply to property group
      if (!propertyId) {
        throw new ApplicationError('propertyId is required when applyToGroup is true', 400);
      }

      const property = await Hotel.findById(propertyId).lean();
      if (!property) {
        throw new ApplicationError('Property not found', 404);
      }

      if (!property.propertyGroupId) {
        throw new ApplicationError('Property is not part of a group', 400);
      }

      result = await SettingsInheritanceService.applySettingsToGroup(
        property.propertyGroupId,
        settingUpdates
      );
    } else {
      // Apply to single property only
      if (!propertyId) {
        throw new ApplicationError('propertyId is required', 400);
      }

      const property = await Hotel.findById(propertyId).lean();
      if (!property) {
        throw new ApplicationError('Property not found', 404);
      }

      // Check if property can override group settings
      if (property.propertyGroupId) {
        const canOverride = await SettingsInheritanceService.canOverride(property, 'checkInOut');
        if (!canOverride) {
          throw new ApplicationError('This property cannot override group settings', 403);
        }
      }

      // Update single property
      const updates = {};
      if (checkInTime) updates['policies.checkInTime'] = checkInTime;
      if (checkOutTime) updates['policies.checkOutTime'] = checkOutTime;

      const updatedProperty = await Hotel.findByIdAndUpdate(
        propertyId,
        { $set: updates },
        { new: true, runValidators: true }
      );

      result = {
        success: true,
        message: 'Check-in/out times updated successfully',
        propertiesUpdated: 1,
        property: updatedProperty
      };
    }

    res.json({
      success: true,
      data: result
    });
  })
);

// =============================================================================
// Currency Settings
// =============================================================================

/**
 * PUT /api/v1/settings/currency
 * Update currency settings
 */
router.put('/currency',
  authenticate, ensureTenantContext,
  authorizePolicy('settings', 'baseAccess'),
  validate(anySettingsMutationSchema),
  catchAsync(async (req, res) => {
    const { currency, applyToAll, applyToGroup, propertyId } = req.body;

    // Validate currency
    const validation = SettingsInheritanceService.validateSettings(
      { currency },
      'currency'
    );

    if (!validation.valid) {
      throw new ApplicationError(validation.errors.join(', '), 400);
    }

    const settingUpdates = { currency };
    let result;

    if (applyToAll) {
      result = await SettingsInheritanceService.applySettingsToAllUserProperties(
        req.user._id,
        settingUpdates,
        'currency'
      );
    } else if (applyToGroup) {
      if (!propertyId) {
        throw new ApplicationError('propertyId is required when applyToGroup is true', 400);
      }

      const property = await Hotel.findById(propertyId).lean();
      if (!property || !property.propertyGroupId) {
        throw new ApplicationError('Property not found or not part of a group', 400);
      }

      result = await SettingsInheritanceService.applySettingsToGroup(
        property.propertyGroupId,
        settingUpdates
      );
    } else {
      if (!propertyId) {
        throw new ApplicationError('propertyId is required', 400);
      }

      const property = await Hotel.findById(propertyId).lean();
      if (!property) {
        throw new ApplicationError('Property not found', 404);
      }

      if (property.propertyGroupId) {
        const canOverride = await SettingsInheritanceService.canOverride(property, 'currency');
        if (!canOverride) {
          throw new ApplicationError('This property cannot override group settings', 403);
        }
      }

      const updatedProperty = await Hotel.findByIdAndUpdate(
        propertyId,
        { $set: { 'settings.currency': currency } },
        { new: true, runValidators: true }
      );

      result = {
        success: true,
        message: 'Currency updated successfully',
        propertiesUpdated: 1,
        property: updatedProperty
      };
    }

    res.json({
      success: true,
      data: result
    });
  })
);

// =============================================================================
// Timezone Settings
// =============================================================================

/**
 * PUT /api/v1/settings/timezone
 * Update timezone settings
 */
router.put('/timezone',
  authenticate, ensureTenantContext,
  authorizePolicy('settings', 'baseAccess'),
  validate(anySettingsMutationSchema),
  catchAsync(async (req, res) => {
    const { timezone, applyToAll, applyToGroup, propertyId } = req.body;

    // Validate timezone
    const validation = SettingsInheritanceService.validateSettings(
      { timezone },
      'timezone'
    );

    if (!validation.valid) {
      throw new ApplicationError(validation.errors.join(', '), 400);
    }

    const settingUpdates = { timezone };
    let result;

    if (applyToAll) {
      result = await SettingsInheritanceService.applySettingsToAllUserProperties(
        req.user._id,
        settingUpdates,
        'timezone'
      );
    } else if (applyToGroup) {
      if (!propertyId) {
        throw new ApplicationError('propertyId is required when applyToGroup is true', 400);
      }

      const property = await Hotel.findById(propertyId).lean();
      if (!property || !property.propertyGroupId) {
        throw new ApplicationError('Property not found or not part of a group', 400);
      }

      result = await SettingsInheritanceService.applySettingsToGroup(
        property.propertyGroupId,
        settingUpdates
      );
    } else {
      if (!propertyId) {
        throw new ApplicationError('propertyId is required', 400);
      }

      const property = await Hotel.findById(propertyId).lean();
      if (!property) {
        throw new ApplicationError('Property not found', 404);
      }

      if (property.propertyGroupId) {
        const canOverride = await SettingsInheritanceService.canOverride(property, 'timezone');
        if (!canOverride) {
          throw new ApplicationError('This property cannot override group settings', 403);
        }
      }

      const updatedProperty = await Hotel.findByIdAndUpdate(
        propertyId,
        { $set: { 'settings.timezone': timezone } },
        { new: true, runValidators: true }
      );

      result = {
        success: true,
        message: 'Timezone updated successfully',
        propertiesUpdated: 1,
        property: updatedProperty
      };
    }

    res.json({
      success: true,
      data: result
    });
  })
);

// =============================================================================
// Cancellation Policy Settings
// =============================================================================

/**
 * PUT /api/v1/settings/cancellation-policy
 * Update cancellation policy settings
 */
router.put('/cancellation-policy',
  authenticate, ensureTenantContext,
  authorizePolicy('settings', 'baseAccess'),
  validate(anySettingsMutationSchema),
  catchAsync(async (req, res) => {
    const { cancellationPolicy, applyToAll, applyToGroup, propertyId } = req.body;

    if (!cancellationPolicy) {
      throw new ApplicationError('cancellationPolicy is required', 400);
    }

    const settingUpdates = { cancellationPolicy };
    let result;

    if (applyToAll) {
      result = await SettingsInheritanceService.applySettingsToAllUserProperties(
        req.user._id,
        settingUpdates,
        'cancellationPolicy'
      );
    } else if (applyToGroup) {
      if (!propertyId) {
        throw new ApplicationError('propertyId is required when applyToGroup is true', 400);
      }

      const property = await Hotel.findById(propertyId).lean();
      if (!property || !property.propertyGroupId) {
        throw new ApplicationError('Property not found or not part of a group', 400);
      }

      result = await SettingsInheritanceService.applySettingsToGroup(
        property.propertyGroupId,
        settingUpdates
      );
    } else {
      if (!propertyId) {
        throw new ApplicationError('propertyId is required', 400);
      }

      const property = await Hotel.findById(propertyId).lean();
      if (!property) {
        throw new ApplicationError('Property not found', 404);
      }

      if (property.propertyGroupId) {
        const canOverride = await SettingsInheritanceService.canOverride(property, 'cancellationPolicy');
        if (!canOverride) {
          throw new ApplicationError('This property cannot override group settings', 403);
        }
      }

      const updatedProperty = await Hotel.findByIdAndUpdate(
        propertyId,
        { $set: { 'policies.cancellationPolicy': cancellationPolicy } },
        { new: true, runValidators: true }
      );

      result = {
        success: true,
        message: 'Cancellation policy updated successfully',
        propertiesUpdated: 1,
        property: updatedProperty
      };
    }

    res.json({
      success: true,
      data: result
    });
  })
);

// =============================================================================
// Generic Settings Update
// =============================================================================

/**
 * PUT /api/v1/settings/general
 * Update general settings (generic endpoint for any setting type)
 *
 * Body:
 * {
 *   "settingType": "roomTypes" | "taxes" | "policies" | etc,
 *   "settingUpdates": { ... },
 *   "applyToAll": false,
 *   "applyToGroup": false,
 *   "propertyId": "xxx"
 * }
 */
router.put('/general',
  authenticate, ensureTenantContext,
  authorizePolicy('settings', 'baseAccess'),
  validate(anySettingsMutationSchema),
  catchAsync(async (req, res) => {
    const { settingType, settingUpdates, applyToAll, applyToGroup, propertyId } = req.body;

    if (!settingType || !settingUpdates) {
      throw new ApplicationError('settingType and settingUpdates are required', 400);
    }

    let result;

    if (applyToAll) {
      result = await SettingsInheritanceService.applySettingsToAllUserProperties(
        req.user._id,
        settingUpdates,
        settingType
      );
    } else if (applyToGroup) {
      if (!propertyId) {
        throw new ApplicationError('propertyId is required when applyToGroup is true', 400);
      }

      const property = await Hotel.findById(propertyId).lean();
      if (!property || !property.propertyGroupId) {
        throw new ApplicationError('Property not found or not part of a group', 400);
      }

      result = await SettingsInheritanceService.applySettingsToGroup(
        property.propertyGroupId,
        settingUpdates
      );
    } else {
      if (!propertyId) {
        throw new ApplicationError('propertyId is required', 400);
      }

      const property = await Hotel.findById(propertyId).lean();
      if (!property) {
        throw new ApplicationError('Property not found', 404);
      }

      if (property.propertyGroupId) {
        const canOverride = await SettingsInheritanceService.canOverride(property, settingType);
        if (!canOverride) {
          throw new ApplicationError('This property cannot override group settings', 403);
        }
      }

      // Build update object
      const updates = {};
      Object.keys(settingUpdates).forEach(key => {
        updates[`settings.${key}`] = settingUpdates[key];
      });

      const updatedProperty = await Hotel.findByIdAndUpdate(
        propertyId,
        { $set: updates },
        { new: true, runValidators: true }
      );

      result = {
        success: true,
        message: `${settingType} settings updated successfully`,
        propertiesUpdated: 1,
        property: updatedProperty
      };
    }

    res.json({
      success: true,
      data: result
    });
  })
);

// =============================================================================
// Get Inheritance Status
// =============================================================================

/**
 * GET /api/v1/settings/inheritance-status/:propertyId
 * Get inheritance status for a property
 */
router.get('/inheritance-status/:propertyId',
  authenticate, ensureTenantContext,
  ensurePropertyParamAccess,
  catchAsync(async (req, res) => {
    const { propertyId } = req.params;

    const status = await SettingsInheritanceService.getInheritanceStatus(propertyId);

    res.json({
      success: true,
      data: status
    });
  })
);

// =============================================================================
// Apply Group Settings to Property
// =============================================================================

/**
 * POST /api/v1/settings/apply-group-settings
 * Manually apply group settings to a property
 *
 * Body:
 * {
 *   "propertyId": "xxx",
 *   "groupId": "xxx"  // Optional, uses property's group if not provided
 * }
 */
router.post('/apply-group-settings',
  authenticate, ensureTenantContext,
  inheritanceManageAccess,
  validate(anySettingsMutationSchema),
  catchAsync(async (req, res) => {
    const { propertyId, groupId } = req.body;

    if (!propertyId) {
      throw new ApplicationError('propertyId is required', 400);
    }

    await assertUserCanAccessHotel(req.user, propertyId);
    let finalGroupId = groupId;

    // If groupId not provided, get it from the property
    if (!finalGroupId) {
      const property = await Hotel.findById(propertyId).lean();
      if (!property) {
        throw new ApplicationError('Property not found', 404);
      }

      if (!property.propertyGroupId) {
        throw new ApplicationError('Property is not part of a group', 400);
      }

      finalGroupId = property.propertyGroupId;
    }

    if (finalGroupId) {
      const group = await PropertyGroup.findById(finalGroupId).lean();
      if (!group) {
        throw new ApplicationError('Property group not found', 404);
      }
      if (group.ownerId?.toString() !== req.user._id.toString()) {
        const hasGroupPropertyAccess = await Hotel.exists({
          propertyGroupId: finalGroupId,
          _id: { $in: await getUserPropertyIds(req.user._id, req.user) },
          isActive: true
        });
        if (!hasGroupPropertyAccess) {
          throw new ApplicationError('You do not have permission to access this group', 403);
        }
      }
    }

    const propertyForGroup = await Hotel.findById(propertyId).lean();
    if (!propertyForGroup) {
      throw new ApplicationError('Property not found', 404);
    }
    if (propertyForGroup.propertyGroupId?.toString() !== finalGroupId.toString()) {
      throw new ApplicationError('Property does not belong to the specified group', 400);
    }

    const result = await SettingsInheritanceService.applyGroupSettings(
      propertyId,
      finalGroupId
    );

    res.json({
      success: true,
      data: result
    });
  })
);

// =============================================================================
// Toggle Inheritance for Property
// =============================================================================

/**
 * PUT /api/v1/settings/toggle-inheritance/:propertyId
 * Enable or disable settings inheritance for a property
 *
 * Body:
 * {
 *   "inheritSettings": true | false
 * }
 */
router.put('/toggle-inheritance/:propertyId',
  authenticate, ensureTenantContext,
  inheritanceManageAccess,
  ensurePropertyParamAccess,
  validate(anySettingsMutationSchema),
  catchAsync(async (req, res) => {
    const { propertyId } = req.params;
    const { inheritSettings } = req.body;

    if (typeof inheritSettings !== 'boolean') {
      throw new ApplicationError('inheritSettings must be a boolean', 400);
    }

    const property = await Hotel.findById(propertyId);
    if (!property) {
      throw new ApplicationError('Property not found', 404);
    }

    // Verify user owns this property
    if (property.ownerId?.toString() !== req.user._id.toString() &&
        property.createdBy?.toString() !== req.user._id.toString()) {
      throw new ApplicationError('You do not have permission to modify this property', 403);
    }

    property.groupSettings = property.groupSettings || {};
    property.groupSettings.inheritSettings = inheritSettings;

    await property.save();

    res.json({
      success: true,
      message: `Settings inheritance ${inheritSettings ? 'enabled' : 'disabled'} for property`,
      data: {
        propertyId: property._id,
        inheritSettings
      }
    });
  })
);

// =============================================================================
// Get Property Group Settings
// =============================================================================

/**
 * GET /api/v1/settings/group/:groupId
 * Get property group settings
 */
router.get('/group/:groupId',
  authenticate, ensureTenantContext,
  ensureGroupParamAccess,
  catchAsync(async (req, res) => {
    const { groupId } = req.params;

    const group = req.propertyGroup || await PropertyGroup.findById(groupId).lean();
    if (!group) {
      throw new ApplicationError('Property group not found', 404);
    }

    res.json({
      success: true,
      data: {
        groupId: group._id,
        groupName: group.name,
        settings: group.settings
      }
    });
  })
);

// =============================================================================
// Universal Settings Application Endpoint (Phase 5.3)
// =============================================================================

/**
 * POST /api/v1/settings/apply
 * Universal endpoint to apply settings with scope
 * Supports all 28 setting types from Phase 4
 *
 * Body:
 * {
 *   "scope": "single" | "group" | "all",
 *   "propertyId": "xxx",
 *   "settingType": "booking_rules" | "room_types" | "message_templates" | etc.,
 *   "settingUpdates": { ... }
 * }
 */
router.post('/apply',
  authenticate, ensureTenantContext,
  inheritanceManageAccess,
  validate(anySettingsMutationSchema),
  catchAsync(async (req, res) => {
    const { scope, propertyId, settingType, settingUpdates } = req.body;
    const userId = req.user._id;

    // Validate required fields
    if (!scope || !propertyId || !settingType || !settingUpdates) {
      throw new ApplicationError('Missing required fields: scope, propertyId, settingType, settingUpdates', 400);
    }

    // Validate scope
    if (!['single', 'group', 'all'].includes(scope)) {
      throw new ApplicationError('Invalid scope. Must be: single, group, or all', 400);
    }

    await assertUserCanAccessHotel(req.user, propertyId);

    // Apply settings using the service
    const result = await SettingsInheritanceService.applySettingsByScope({
      scope,
      propertyId,
      settingType,
      settingUpdates,
      userId,
      user: req.user
    });

    res.json({
      status: 'success',
      message: `Settings applied to ${result.propertiesUpdated} ${result.propertiesUpdated === 1 ? 'property' : 'properties'}`,
      data: result
    });
  })
);

// =============================================================================
// Get Affected Properties Count
// =============================================================================

/**
 * POST /api/v1/settings/affected-count
 * Calculate how many properties will be affected by a settings change
 *
 * Body:
 * {
 *   "scope": "single" | "group" | "all",
 *   "propertyId": "xxx"
 * }
 */
router.post('/affected-count',
  authenticate, ensureTenantContext,
  inheritanceManageAccess,
  validate(anySettingsMutationSchema),
  catchAsync(async (req, res) => {
    const { scope, propertyId } = req.body;

    if (!scope || !propertyId) {
      throw new ApplicationError('scope and propertyId are required', 400);
    }

    await assertUserCanAccessHotel(req.user, propertyId);
    const count = await SettingsInheritanceService.getAffectedPropertiesCount({
      scope,
      propertyId,
      userId: req.user._id,
      user: req.user
    });

    res.json({
      status: 'success',
      data: { count }
    });
  })
);

// =============================================================================
// Toggle Inheritance for Setting Type
// =============================================================================

/**
 * PUT /api/v1/settings/toggle-inheritance
 * Toggle inheritance for a specific setting type
 *
 * Body:
 * {
 *   "propertyId": "xxx",
 *   "settingType": "booking_rules" | "room_types" | etc.,
 *   "enabled": true | false
 * }
 */
router.put('/toggle-inheritance',
  authenticate, ensureTenantContext,
  inheritanceManageAccess,
  validate(anySettingsMutationSchema),
  catchAsync(async (req, res) => {
    const { propertyId, settingType, enabled } = req.body;

    if (!propertyId || !settingType || typeof enabled !== 'boolean') {
      throw new ApplicationError('propertyId, settingType, and enabled are required', 400);
    }

    await assertUserCanAccessHotel(req.user, propertyId);
    const result = await SettingsInheritanceService.toggleInheritance(
      propertyId,
      settingType,
      enabled
    );

    res.json({
      status: 'success',
      message: `Inheritance ${enabled ? 'enabled' : 'disabled'} for ${settingType}`,
      data: result
    });
  })
);

// =============================================================================
// Set Override for Setting Type
// =============================================================================

/**
 * PUT /api/v1/settings/override
 * Set property-specific override for a setting type
 *
 * Body:
 * {
 *   "propertyId": "xxx",
 *   "settingType": "booking_rules" | "room_types" | etc.,
 *   "overrideValues": { ... }
 * }
 */
router.put('/override',
  authenticate, ensureTenantContext,
  inheritanceManageAccess,
  validate(anySettingsMutationSchema),
  catchAsync(async (req, res) => {
    const { propertyId, settingType, overrideValues } = req.body;
    const userId = req.user._id;

    if (!propertyId || !settingType || !overrideValues) {
      throw new ApplicationError('propertyId, settingType, and overrideValues are required', 400);
    }

    await assertUserCanAccessHotel(req.user, propertyId);
    const result = await SettingsInheritanceService.setOverride(
      propertyId,
      settingType,
      overrideValues,
      userId
    );

    res.json({
      status: 'success',
      message: 'Override set successfully',
      data: result
    });
  })
);

// =============================================================================
// Remove Override (Revert to Inheritance)
// =============================================================================

/**
 * DELETE /api/v1/settings/override
 * Remove property-specific override and revert to group inheritance
 *
 * Body:
 * {
 *   "propertyId": "xxx",
 *   "settingType": "booking_rules" | "room_types" | etc.
 * }
 */
router.delete('/override',
  authenticate, ensureTenantContext,
  inheritanceManageAccess,
  validate(anySettingsMutationSchema),
  catchAsync(async (req, res) => {
    const { propertyId, settingType } = req.body;

    if (!propertyId || !settingType) {
      throw new ApplicationError('propertyId and settingType are required', 400);
    }

    await assertUserCanAccessHotel(req.user, propertyId);
    const result = await SettingsInheritanceService.removeOverride(
      propertyId,
      settingType
    );

    res.json({
      status: 'success',
      message: 'Override removed successfully',
      data: result
    });
  })
);

// =============================================================================
// Get Group Inheritance Summary
// =============================================================================

/**
 * GET /api/v1/settings/group-summary/:groupId
 * Get inheritance summary for a property group
 */
router.get('/group-summary/:groupId',
  authenticate, ensureTenantContext,
  ensureGroupParamAccess,
  catchAsync(async (req, res) => {
    const { groupId } = req.params;

    const summary = await SettingsInheritanceService.getGroupInheritanceSummary(groupId);

    res.json({
      status: 'success',
      data: summary
    });
  })
);

// =============================================================================
// Change Preview (Feature 2)
// =============================================================================

/**
 * POST /api/v1/settings/preview-changes
 * Preview changes before applying
 *
 * Body:
 * {
 *   "scope": "single" | "group" | "all",
 *   "propertyId": "xxx",
 *   "settingType": "booking_rules",
 *   "settingUpdates": { ... }
 * }
 */
router.post('/preview-changes',
  authenticate, ensureTenantContext,
  inheritanceManageAccess,
  validate(anySettingsMutationSchema),
  catchAsync(async (req, res) => {
    const { scope, propertyId, settingType, settingUpdates } = req.body;

    // Validate inputs
    if (!['single', 'group', 'all'].includes(scope)) {
      throw new ApplicationError('Invalid scope. Must be single, group, or all', 400);
    }

    if (!settingType || !settingUpdates) {
      throw new ApplicationError('settingType and settingUpdates are required', 400);
    }

    if (!propertyId) {
      throw new ApplicationError('propertyId is required', 400);
    }

    await assertUserCanAccessHotel(req.user, propertyId);
    const preview = await SettingsInheritanceService.previewChanges({
      scope,
      propertyId,
      settingType,
      settingUpdates,
      userId: req.user._id,
      user: req.user
    });

    res.json({
      status: 'success',
      data: preview
    });
  })
);

// =============================================================================
// Change History & Rollback (Feature 3)
// =============================================================================

/**
 * GET /api/v1/settings/change-history/:propertyId/:settingType
 * Get change history for a property/setting
 *
 * Query params:
 * - limit: number (default: 50)
 * - includeRolledBack: boolean (default: false)
 */
router.get('/change-history/:propertyId/:settingType',
  authenticate, ensureTenantContext,
  ensurePropertyParamAccess,
  catchAsync(async (req, res) => {
    const { propertyId, settingType } = req.params;
    const { limit, includeRolledBack } = req.query;

    const history = await SettingsInheritanceService.getChangeHistory({
      propertyId,
      settingType,
      limit: parseInt(limit) || 50,
      includeRolledBack: includeRolledBack === 'true'
    });

    res.json({
      status: 'success',
      data: { history }
    });
  })
);

/**
 * POST /api/v1/settings/rollback
 * Rollback specific change
 *
 * Body:
 * {
 *   "propertyId": "xxx",
 *   "settingType": "booking_rules",
 *   "historyId": "xxx"
 * }
 */
router.post('/rollback',
  authenticate, ensureTenantContext,
  inheritanceManageAccess,
  validate(anySettingsMutationSchema),
  catchAsync(async (req, res) => {
    const { propertyId, settingType, historyId } = req.body;

    if (!propertyId || !settingType || !historyId) {
      throw new ApplicationError('propertyId, settingType, and historyId are required', 400);
    }

    await assertUserCanAccessHotel(req.user, propertyId);
    const result = await SettingsInheritanceService.rollbackChange({
      propertyId,
      settingType,
      historyId,
      userId: req.user._id
    });

    res.json({
      status: 'success',
      message: 'Settings rolled back successfully',
      data: result
    });
  })
);

/**
 * POST /api/v1/settings/bulk-rollback
 * Rollback same change across multiple properties
 *
 * Body:
 * {
 *   "propertyIds": ["xxx", "yyy"],
 *   "settingType": "booking_rules",
 *   "historyId": "xxx"
 * }
 */
router.post('/bulk-rollback',
  authenticate, ensureTenantContext,
  inheritanceManageAccess,
  validate(anySettingsMutationSchema),
  catchAsync(async (req, res) => {
    const { propertyIds, settingType, historyId } = req.body;

    if (!propertyIds || !Array.isArray(propertyIds) || !settingType || !historyId) {
      throw new ApplicationError('propertyIds (array), settingType, and historyId are required', 400);
    }

    await Promise.all(propertyIds.map(propertyId => assertUserCanAccessHotel(req.user, propertyId)));
    const result = await SettingsInheritanceService.bulkRollback({
      propertyIds,
      settingType,
      historyId,
      userId: req.user._id
    });

    res.json({
      status: 'success',
      message: `Rolled back ${result.successful} of ${result.total} properties`,
      data: result
    });
  })
);

export default router;
