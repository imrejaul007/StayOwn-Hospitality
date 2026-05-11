import mongoose from 'mongoose';

/**
 * Settings Inheritance Model
 *
 * Tracks settings inheritance for individual properties from their property groups.
 * Allows fine-grained control over which settings are inherited vs overridden.
 */
const settingsInheritanceSchema = new mongoose.Schema({
  propertyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Hotel',
    required: [true, 'Property ID is required'],
    index: true
  },

  groupId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PropertyGroup',
    required: [true, 'Property Group ID is required'],
    index: true
  },

  settingType: {
    type: String,
    required: [true, 'Setting type is required'],
    enum: [
      // Basic Settings
      'check_in_out',
      'currency',
      'timezone',
      'general',

      // System Settings
      'integration_settings',
      'system_settings',
      'display_preferences',

      // Tax & Payment Settings
      'room_taxes',
      'pos_taxes',
      'payment_method',

      // Room & Booking Settings
      'room_types',
      'room_types_update',
      'booking_rules',
      'seasonal_pricing_season',
      'seasonal_pricing_period',

      // Channel & Web Settings
      'web_settings',
      'ota_channel_configuration',

      // Communication Settings
      'message_templates',
      'notification_templates',
      'email_campaign',

      // Operational Settings
      'housekeeping_settings',
      'allotment_global_settings',
      'custom_fields',

      // Hotel Structure Settings
      'departments',
      'hotel_areas',
      'reason_codes',
      'salutations',
      'measurement_units',
      'phone_extensions',
      'revenue_accounts',
      'pos_attributes'
    ],
    index: true
  },

  isInheriting: {
    type: Boolean,
    default: true,
    index: true
  },

  hasOverride: {
    type: Boolean,
    default: false,
    index: true
  },

  overrideValues: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },

  inheritedValues: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },

  // Track the last sync
  syncedAt: {
    type: Date,
    default: Date.now,
    index: true
  },

  syncedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },

  // Track sync status
  syncStatus: {
    type: String,
    enum: ['synced', 'pending', 'failed', 'manual_override'],
    default: 'synced',
    index: true
  },

  syncError: {
    type: String,
    default: null
  },

  // Metadata
  metadata: {
    appliedScope: {
      type: String,
      enum: ['single', 'group', 'all'],
      default: 'single'
    },
    affectedPropertiesCount: {
      type: Number,
      default: 1
    },
    syncDuration: {
      type: Number, // milliseconds
      default: 0
    },
    previousVersion: {
      type: Date
    },
    currentVersion: {
      type: Date
    }
  },

  // Change History for Rollback
  changeHistory: [{
    _id: { type: mongoose.Schema.Types.ObjectId, auto: true },
    changedAt: { type: Date, default: Date.now, index: true },
    changedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    changedByName: String,
    previousValues: mongoose.Schema.Types.Mixed,
    newValues: mongoose.Schema.Types.Mixed,
    changeScope: {
      type: String,
      enum: ['single', 'group', 'all'],
      required: true
    },
    propertiesAffected: {
      type: Number,
      default: 1
    },
    rollbackExpiresAt: {
      type: Date,
      index: true
    }, // 30 days from change
    rolledBackAt: Date,
    rolledBackBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    rollbackReason: String
  }]

}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Compound indexes for performance
settingsInheritanceSchema.index({ propertyId: 1, settingType: 1 }, { unique: true });
settingsInheritanceSchema.index({ groupId: 1, settingType: 1 });
settingsInheritanceSchema.index({ propertyId: 1, groupId: 1 });
settingsInheritanceSchema.index({ isInheriting: 1, syncStatus: 1 });
settingsInheritanceSchema.index({ syncedAt: -1 });

// Virtual for property
settingsInheritanceSchema.virtual('property', {
  ref: 'Hotel',
  localField: 'propertyId',
  foreignField: '_id',
  justOne: true
});

// Virtual for group
settingsInheritanceSchema.virtual('group', {
  ref: 'PropertyGroup',
  localField: 'groupId',
  foreignField: '_id',
  justOne: true
});

// Instance methods

/**
 * Apply inheritance from group settings
 */
settingsInheritanceSchema.methods.applyInheritance = async function(groupSettings) {
  try {
    this.inheritedValues = groupSettings;
    this.syncedAt = new Date();
    this.syncStatus = 'synced';
    this.syncError = null;

    if (!this.hasOverride) {
      // If no override, inherited values are the active values
      this.metadata.currentVersion = new Date();
    }

    await this.save();

    return {
      success: true,
      message: 'Inheritance applied successfully',
      inheritance: this
    };
  } catch (error) {
    this.syncStatus = 'failed';
    this.syncError = error.message;
    await this.save();

    throw error;
  }
};

/**
 * Set override values
 */
settingsInheritanceSchema.methods.setOverride = async function(overrideValues, userId) {
  try {
    this.hasOverride = true;
    this.overrideValues = overrideValues;
    this.isInheriting = false;
    this.syncStatus = 'manual_override';
    this.syncedBy = userId;
    this.metadata.previousVersion = this.metadata.currentVersion;
    this.metadata.currentVersion = new Date();

    await this.save();

    return {
      success: true,
      message: 'Override values set successfully',
      inheritance: this
    };
  } catch (error) {
    throw new Error(`${error.message}`);
  }
};

/**
 * Remove override and revert to inheritance
 */
settingsInheritanceSchema.methods.removeOverride = async function() {
  try {
    this.hasOverride = false;
    this.overrideValues = {};
    this.isInheriting = true;
    this.syncStatus = 'synced';
    this.metadata.previousVersion = this.metadata.currentVersion;
    this.metadata.currentVersion = new Date();

    await this.save();

    return {
      success: true,
      message: 'Override removed, inheritance restored',
      inheritance: this
    };
  } catch (error) {
    throw new Error(`${error.message}`);
  }
};

/**
 * Get effective values (override or inherited)
 */
settingsInheritanceSchema.methods.getEffectiveValues = function() {
  return this.hasOverride ? this.overrideValues : this.inheritedValues;
};

/**
 * Check if sync is needed
 */
settingsInheritanceSchema.methods.needsSync = function(groupLastUpdated) {
  if (!this.isInheriting) return false;
  if (this.syncStatus === 'failed') return true;
  if (!this.syncedAt) return true;

  return groupLastUpdated > this.syncedAt;
};

/**
 * Add entry to change history
 */
settingsInheritanceSchema.methods.addToHistory = async function(changedBy, previousValues, newValues, scope, propertiesAffected) {
  try {
    // Get user name
    const User = mongoose.model('User');
    const user = await User.findById(changedBy).select('name').lean();

    // Calculate rollback expiration (30 days from now)
    const rollbackExpiresAt = new Date();
    rollbackExpiresAt.setDate(rollbackExpiresAt.getDate() + 30);

    this.changeHistory.push({
      changedBy,
      changedByName: user ? user.name : 'Unknown User',
      previousValues,
      newValues,
      changeScope: scope,
      propertiesAffected: propertiesAffected || 1,
      rollbackExpiresAt
    });

    // Keep only last 50 history entries to prevent unbounded growth
    if (this.changeHistory.length > 50) {
      this.changeHistory = this.changeHistory.slice(-50);
    }

    await this.save();

    return this.changeHistory[this.changeHistory.length - 1];
  } catch (error) {
    throw new Error(`${error.message}`);
  }
};

// Static methods

/**
 * Find inheritance records for a property
 */
settingsInheritanceSchema.statics.findByProperty = function(propertyId, options = {}) {
  const query = this.find({ propertyId });

  if (options.settingType) {
    query.where('settingType').equals(options.settingType);
  }

  if (options.isInheriting !== undefined) {
    query.where('isInheriting').equals(options.isInheriting);
  }

  if (options.populate) {
    query.populate('property group syncedBy');
  }

  return query.sort({ settingType: 1 });
};

/**
 * Find inheritance records for a group
 */
settingsInheritanceSchema.statics.findByGroup = function(groupId, options = {}) {
  const query = this.find({ groupId });

  if (options.settingType) {
    query.where('settingType').equals(options.settingType);
  }

  if (options.syncStatus) {
    query.where('syncStatus').equals(options.syncStatus);
  }

  if (options.populate) {
    query.populate('property group syncedBy');
  }

  return query.sort({ propertyId: 1, settingType: 1 });
};

/**
 * Get properties that need sync for a specific setting type
 */
settingsInheritanceSchema.statics.findPendingSync = function(groupId, settingType) {
  return this.find({
    groupId,
    settingType,
    isInheriting: true,
    syncStatus: { $in: ['pending', 'failed'] }
  }).populate('property');
};

/**
 * Bulk create or update inheritance records
 */
settingsInheritanceSchema.statics.bulkUpsert = async function(records) {
  try {
    const operations = records.map(record => ({
      updateOne: {
        filter: {
          propertyId: record.propertyId,
          settingType: record.settingType
        },
        update: {
          $set: record
        },
        upsert: true
      }
    }));

    return this.bulkWrite(operations);
  } catch (error) {
    throw new Error(`${error.message}`);
  }
};

/**
 * Get inheritance summary for a property
 */
settingsInheritanceSchema.statics.getPropertySummary = async function(propertyId) {
  try {
    const records = await this.find({ propertyId }).lean().limit(1000);

    const summary = {
      total: records.length,
      inheriting: 0,
      overridden: 0,
      synced: 0,
      pending: 0,
      failed: 0,
      bySettingType: {}
    };

    records.forEach(record => {
      if (record.isInheriting) summary.inheriting++;
      if (record.hasOverride) summary.overridden++;

      switch (record.syncStatus) {
        case 'synced':
          summary.synced++;
          break;
        case 'pending':
          summary.pending++;
          break;
        case 'failed':
          summary.failed++;
          break;
      }

      summary.bySettingType[record.settingType] = {
        isInheriting: record.isInheriting,
        hasOverride: record.hasOverride,
        syncStatus: record.syncStatus,
        syncedAt: record.syncedAt
      };
    });

    return summary;
  } catch (error) {
    throw new Error(`${error.message}`);
  }
};

/**
 * Get inheritance summary for a group
 */
settingsInheritanceSchema.statics.getGroupSummary = async function(groupId) {
  try {
    const records = await this.find({ groupId }).lean().limit(1000);

    const summary = {
      total: records.length,
      properties: new Set(),
      settingTypes: new Set(),
      inheriting: 0,
      overridden: 0,
      synced: 0,
      pending: 0,
      failed: 0,
      byProperty: {}
    };

    records.forEach(record => {
      summary.properties.add(record.propertyId.toString());
      summary.settingTypes.add(record.settingType);

      if (record.isInheriting) summary.inheriting++;
      if (record.hasOverride) summary.overridden++;

      switch (record.syncStatus) {
        case 'synced':
          summary.synced++;
          break;
        case 'pending':
          summary.pending++;
          break;
        case 'failed':
          summary.failed++;
          break;
      }

      const propId = record.propertyId.toString();
      if (!summary.byProperty[propId]) {
        summary.byProperty[propId] = {
          total: 0,
          inheriting: 0,
          overridden: 0
        };
      }

      summary.byProperty[propId].total++;
      if (record.isInheriting) summary.byProperty[propId].inheriting++;
      if (record.hasOverride) summary.byProperty[propId].overridden++;
    });

    summary.properties = Array.from(summary.properties);
    summary.settingTypes = Array.from(summary.settingTypes);

    return summary;
  } catch (error) {
    throw new Error(`${error.message}`);
  }
};

// Pre-save middleware
settingsInheritanceSchema.pre('save', function(next) {
  // If transitioning to inherited state, clear override values
  if (this.isInheriting && !this.hasOverride) {
    this.overrideValues = {};
  }

  // Update sync timestamp when status changes
  if (this.isModified('syncStatus')) {
    this.syncedAt = new Date();
  }

  next();
});

// Post-save middleware
settingsInheritanceSchema.post('save', function(doc) {
  // Emit event for real-time updates (if using event system)
  // eventEmitter.emit('settingsInheritance:updated', doc);
});

export default mongoose.model('SettingsInheritance', settingsInheritanceSchema);
