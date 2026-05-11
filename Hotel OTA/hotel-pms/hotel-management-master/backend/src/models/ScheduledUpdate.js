import mongoose from 'mongoose';

/**
 * Scheduled Update Model
 *
 * Tracks scheduled settings updates that will be applied in the future.
 * Supports single, group, and all-properties scopes.
 */
const scheduledUpdateSchema = new mongoose.Schema({
  hotelId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Hotel',
    required: true,
    index: true
  },

  scheduledFor: {
    type: Date,
    required: [true, 'Scheduled time is required'],
    index: true,
    validate: {
      validator: function(value) {
        // Scheduled time must be in the future (only for new documents)
        if (this.isNew) {
          return value > new Date();
        }
        return true;
      },
      message: 'Scheduled time must be in the future'
    }
  },

  scope: {
    type: String,
    enum: ['single', 'group', 'all'],
    required: [true, 'Scope is required']
  },

  propertyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Hotel',
    required: function() {
      return this.scope === 'single';
    },
    index: true
  },

  groupId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PropertyGroup',
    required: function() {
      return this.scope === 'group';
    },
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

  settingName: {
    type: String,
    default: ''
  },

  settingUpdates: {
    type: mongoose.Schema.Types.Mixed,
    required: [true, 'Setting updates are required']
  },

  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Created by user is required']
  },

  createdByName: String,

  status: {
    type: String,
    enum: ['pending', 'executing', 'completed', 'failed', 'cancelled'],
    default: 'pending',
    index: true
  },

  executedAt: Date,

  executedBy: {
    type: String,
    default: 'system' // 'system' or user ID if manual execution
  },

  propertiesAffected: {
    type: Number,
    default: 0
  },

  errorMessage: String,

  errorDetails: mongoose.Schema.Types.Mixed,

  cancelledAt: Date,

  cancelledBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },

  cancelReason: String,

  notificationsSent: {
    type: Boolean,
    default: false
  },

  executionDuration: {
    type: Number, // milliseconds
    default: 0
  }

}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Compound indexes for performance
scheduledUpdateSchema.index({ hotelId: 1, status: 1 });
scheduledUpdateSchema.index({ hotelId: 1, scheduledFor: 1, status: 1 });
scheduledUpdateSchema.index({ createdBy: 1, status: 1 });
scheduledUpdateSchema.index({ propertyId: 1, scheduledFor: 1 });
scheduledUpdateSchema.index({ status: 1, scheduledFor: 1 });

// Virtual for property
scheduledUpdateSchema.virtual('property', {
  ref: 'Hotel',
  localField: 'propertyId',
  foreignField: '_id',
  justOne: true
});

// Virtual for group
scheduledUpdateSchema.virtual('group', {
  ref: 'PropertyGroup',
  localField: 'groupId',
  foreignField: '_id',
  justOne: true
});

// Virtual for creator
scheduledUpdateSchema.virtual('creator', {
  ref: 'User',
  localField: 'createdBy',
  foreignField: '_id',
  justOne: true
});

// Static Methods

/**
 * Get due updates (scheduled time has passed and status is pending)
 */
scheduledUpdateSchema.statics.getDueUpdates = async function() {
  try {
    return this.find({
      status: 'pending',
      scheduledFor: { $lte: new Date() }
    })
    .populate('createdBy', 'name email')
    .populate('propertyId', 'name code')
    .populate('groupId', 'name')
    .sort({ scheduledFor: 1 });
  } catch (error) {
    throw new Error(`${error.message}`);
  }
};

/**
 * Get upcoming updates (next 24 hours)
 */
scheduledUpdateSchema.statics.getUpcomingUpdates = async function(hours = 24) {
  try {
    const now = new Date();
    const future = new Date(now.getTime() + hours * 60 * 60 * 1000);

    return this.find({
      status: 'pending',
      scheduledFor: { $gte: now, $lte: future }
    })
    .populate('createdBy', 'name email')
    .populate('propertyId', 'name code')
    .populate('groupId', 'name')
    .sort({ scheduledFor: 1 });
  } catch (error) {
    throw new Error(`${error.message}`);
  }
};

/**
 * Get updates by property
 */
scheduledUpdateSchema.statics.getByProperty = function(propertyId, options = {}) {
  const query = {
    $or: [
      { propertyId },
      { scope: 'all', createdBy: options.userId }
    ]
  };

  if (options.status) {
    query.status = options.status;
  }

  return this.find(query)
    .populate('createdBy', 'name email')
    .sort({ scheduledFor: -1 });
};

// Instance Methods

/**
 * Execute scheduled update
 */
scheduledUpdateSchema.methods.execute = async function(settingsService) {
  const startTime = Date.now();

  try {
    // Mark as executing
    this.status = 'executing';
    await this.save();

    // Execute via settings service
    const result = await settingsService.applySettingsByScope({
      scope: this.scope,
      propertyId: this.propertyId,
      settingType: this.settingType,
      settingUpdates: this.settingUpdates,
      userId: this.createdBy
    });

    // Mark as completed
    this.status = 'completed';
    this.executedAt = new Date();
    this.executedBy = 'system';
    this.propertiesAffected = result.propertiesUpdated;
    this.executionDuration = Date.now() - startTime;
    await this.save();

    return {
      success: true,
      propertiesAffected: result.propertiesUpdated
    };
  } catch (error) {
    // Mark as failed
    this.status = 'failed';
    this.errorMessage = error.message;
    this.errorDetails = {
      stack: error.stack,
      timestamp: new Date()
    };
    this.executionDuration = Date.now() - startTime;
    await this.save();

    throw error;
  }
};

/**
 * Cancel scheduled update
 */
scheduledUpdateSchema.methods.cancel = async function(userId, reason) {
  try {
    if (this.status !== 'pending') {
      throw new Error(`Cannot cancel update with status: ${this.status}`);
    }

    this.status = 'cancelled';
    this.cancelledAt = new Date();
    this.cancelledBy = userId;
    this.cancelReason = reason || 'No reason provided';
    await this.save();

    return this;
  } catch (error) {
    throw new Error(`${error.message}`);
  }
};

/**
 * Reschedule update
 */
scheduledUpdateSchema.methods.reschedule = async function(newScheduledFor) {
  try {
    if (this.status !== 'pending') {
      throw new Error(`Cannot reschedule update with status: ${this.status}`);
    }

    if (new Date(newScheduledFor) <= new Date()) {
      throw new Error('New scheduled time must be in the future');
    }

    this.scheduledFor = newScheduledFor;
    await this.save();

    return this;
  } catch (error) {
    throw new Error(`${error.message}`);
  }
};

// Pre-save middleware
scheduledUpdateSchema.pre('save', function(next) {
  // Set created by name if not set
  if (this.isNew && !this.createdByName && this.createdBy) {
    const User = mongoose.model('User');
    User.findById(this.createdBy)
      .select('name')
      .then(user => {
        if (user) {
          this.createdByName = user.name;
        }
        next();
      })
      .catch(next);
  } else {
    next();
  }
});

// Post-save middleware
scheduledUpdateSchema.post('save', function(doc) {
  // Emit event for real-time updates (if using event system)
  // eventEmitter.emit('scheduledUpdate:updated', doc);
});

export default mongoose.model('ScheduledUpdate', scheduledUpdateSchema);
