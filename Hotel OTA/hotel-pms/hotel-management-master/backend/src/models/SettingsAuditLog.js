import mongoose from 'mongoose';

const { Schema } = mongoose;

const SettingsAuditLogSchema = new Schema({
  hotelId: {
    type: Schema.Types.ObjectId,
    ref: 'Hotel',
    required: true,
    index: true
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  },
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  userName: {
    type: String
  },
  userEmail: {
    type: String
  },
  action: {
    type: String,
    enum: ['create', 'update', 'delete', 'rollback', 'schedule', 'cancel'],
    required: true
  },
  scope: {
    type: String,
    enum: ['single', 'group', 'all'],
    required: true
  },
  propertyId: {
    type: Schema.Types.ObjectId,
    ref: 'Hotel'
  },
  groupId: {
    type: Schema.Types.ObjectId,
    ref: 'PropertyGroup'
  },
  settingType: {
    type: String,
    required: true,
    index: true
  },
  settingName: {
    type: String
  },
  propertiesAffected: {
    type: Number,
    default: 1
  },
  affectedPropertyIds: [{
    type: Schema.Types.ObjectId,
    ref: 'Hotel'
  }],
  changesSummary: {
    type: Schema.Types.Mixed
  },
  previousValues: {
    type: Schema.Types.Mixed
  },
  newValues: {
    type: Schema.Types.Mixed
  },
  ipAddress: {
    type: String
  },
  userAgent: {
    type: String
  },
  duration: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    enum: ['success', 'partial', 'failed'],
    default: 'success'
  },
  errorMessage: {
    type: String
  },
  scheduledFor: {
    type: Date
  },
  executedAt: {
    type: Date
  },
  metadata: {
    type: Schema.Types.Mixed
  }
}, {
  timestamps: true
});

// Compound indexes for efficient querying
SettingsAuditLogSchema.index({ hotelId: 1, timestamp: -1 });
SettingsAuditLogSchema.index({ userId: 1, timestamp: -1 });
SettingsAuditLogSchema.index({ propertyId: 1, timestamp: -1 });
SettingsAuditLogSchema.index({ settingType: 1, timestamp: -1 });
SettingsAuditLogSchema.index({ scope: 1, timestamp: -1 });
SettingsAuditLogSchema.index({ action: 1, timestamp: -1 });
SettingsAuditLogSchema.index({ status: 1, timestamp: -1 });
SettingsAuditLogSchema.index({ timestamp: -1 }); // For recent activity queries

// Virtual for age
SettingsAuditLogSchema.virtual('age').get(function() {
  return Date.now() - this.timestamp.getTime();
});

// Method to get human-readable duration
SettingsAuditLogSchema.methods.getReadableDuration = function() {
  if (this.duration < 1000) return `${this.duration}ms`;
  if (this.duration < 60000) return `${(this.duration / 1000).toFixed(2)}s`;
  return `${(this.duration / 60000).toFixed(2)}m`;
};

// Static method to get recent logs
SettingsAuditLogSchema.statics.getRecentLogs = function(limit = 100) {
  return this.find()
    .sort({ timestamp: -1 })
    .limit(limit)
    .populate('userId', 'name email')
    .populate('propertyId', 'name')
    .populate('groupId', 'name')
    .lean();
};

// Static method to get logs by property
SettingsAuditLogSchema.statics.getLogsByProperty = function(propertyId, options = {}) {
  const query = {
    $or: [
      { propertyId },
      { affectedPropertyIds: propertyId }
    ]
  };
  if (options.hotelId) query.hotelId = options.hotelId;

  return this.find(query)
    .sort({ timestamp: -1 })
    .limit(options.limit || 100)
    .skip(options.skip || 0)
    .populate('userId', 'name email')
    .populate('groupId', 'name')
    .lean();
};

// Static method to get logs by user
SettingsAuditLogSchema.statics.getLogsByUser = function(userId, options = {}) {
  const query = { userId };
  if (options.hotelId) query.hotelId = options.hotelId;

  return this.find(query)
    .sort({ timestamp: -1 })
    .limit(options.limit || 100)
    .skip(options.skip || 0)
    .populate('propertyId', 'name')
    .populate('groupId', 'name')
    .lean();
};

// Static method to get logs by date range
SettingsAuditLogSchema.statics.getLogsByDateRange = function(startDate, endDate, options = {}) {
  const query = {
    timestamp: {
      $gte: new Date(startDate),
      $lte: new Date(endDate)
    }
  };
  if (options.hotelId) query.hotelId = options.hotelId;

  if (options.propertyId) {
    query.$or = [
      { propertyId: options.propertyId },
      { affectedPropertyIds: options.propertyId }
    ];
  }

  if (options.userId) {
    query.userId = options.userId;
  }

  if (options.settingType) {
    query.settingType = options.settingType;
  }

  if (options.action) {
    query.action = options.action;
  }

  if (options.scope) {
    query.scope = options.scope;
  }

  if (options.status) {
    query.status = options.status;
  }

  return this.find(query)
    .sort({ timestamp: -1 })
    .limit(options.limit || 1000)
    .skip(options.skip || 0)
    .populate('userId', 'name email')
    .populate('propertyId', 'name')
    .populate('groupId', 'name')
    .lean();
};

// Static method to get statistics
SettingsAuditLogSchema.statics.getStatistics = async function(dateRange = {}) {
  try {
    const matchStage = {};
    if (dateRange.hotelId) matchStage.hotelId = dateRange.hotelId;

    if (dateRange.startDate && dateRange.endDate) {
      matchStage.timestamp = {
        $gte: new Date(dateRange.startDate),
        $lte: new Date(dateRange.endDate)
      };
    }

    const stats = await this.aggregate([
      { $match: matchStage },
      {
        $facet: {
          totalChanges: [{ $count: 'count' }],
          byAction: [
            { $group: { _id: '$action', count: { $sum: 1 } } },
            { $sort: { count: -1 } }
          ],
          byScope: [
            { $group: { _id: '$scope', count: { $sum: 1 } } },
            { $sort: { count: -1 } }
          ],
          bySettingType: [
            { $group: { _id: '$settingType', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 10 }
          ],
          byStatus: [
            { $group: { _id: '$status', count: { $sum: 1 } } },
            { $sort: { count: -1 } }
          ],
          totalPropertiesAffected: [
            { $group: { _id: null, total: { $sum: '$propertiesAffected' } } }
          ],
          averageDuration: [
            { $group: { _id: null, avg: { $avg: '$duration' } } }
          ]
        }
      }
    ]);

    return stats[0];
  } catch (error) {
    throw new Error(`${error.message}`);
  }
};

// Static method to get most active users
SettingsAuditLogSchema.statics.getMostActiveUsers = async function(limit = 10, dateRange = {}) {
  try {
    const matchStage = {};
    if (dateRange.hotelId) matchStage.hotelId = dateRange.hotelId;

    if (dateRange.startDate && dateRange.endDate) {
      matchStage.timestamp = {
        $gte: new Date(dateRange.startDate),
        $lte: new Date(dateRange.endDate)
      };
    }

    return this.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: '$userId',
          userName: { $first: '$userName' },
          userEmail: { $first: '$userEmail' },
          totalChanges: { $sum: 1 },
          propertiesAffected: { $sum: '$propertiesAffected' },
          lastActivity: { $max: '$timestamp' }
        }
      },
      { $sort: { totalChanges: -1 } },
      { $limit: limit }
    ]);
  } catch (error) {
    throw new Error(`${error.message}`);
  }
};

// Static method to get most changed settings
SettingsAuditLogSchema.statics.getMostChangedSettings = async function(limit = 10, dateRange = {}) {
  try {
    const matchStage = {};
    if (dateRange.hotelId) matchStage.hotelId = dateRange.hotelId;

    if (dateRange.startDate && dateRange.endDate) {
      matchStage.timestamp = {
        $gte: new Date(dateRange.startDate),
        $lte: new Date(dateRange.endDate)
      };
    }

    return this.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: '$settingType',
          settingName: { $first: '$settingName' },
          totalChanges: { $sum: 1 },
          propertiesAffected: { $sum: '$propertiesAffected' },
          lastChange: { $max: '$timestamp' }
        }
      },
      { $sort: { totalChanges: -1 } },
      { $limit: limit }
    ]);
  } catch (error) {
    throw new Error(`${error.message}`);
  }
};

// Static method to get activity heatmap
SettingsAuditLogSchema.statics.getActivityHeatmap = async function(dateRange = {}) {
  try {
    const matchStage = {};
    if (dateRange.hotelId) matchStage.hotelId = dateRange.hotelId;

    if (dateRange.startDate && dateRange.endDate) {
      matchStage.timestamp = {
        $gte: new Date(dateRange.startDate),
        $lte: new Date(dateRange.endDate)
      };
    }

    return this.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: {
            date: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } },
            hour: { $hour: '$timestamp' }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.date': 1, '_id.hour': 1 } }
    ]);
  } catch (error) {
    throw new Error(`${error.message}`);
  }
};

// Pre-save middleware to set human-readable names
SettingsAuditLogSchema.pre('save', async function(next) {
  try {
    // Set setting name from type if not provided
    if (!this.settingName && this.settingType) {
      const typeToName = {
        'check-in-out': 'Check-in/Check-out Times',
        'currency': 'Currency Settings',
        'timezone': 'Timezone Settings',
        'payment-gateway': 'Payment Gateway',
        'analytics': 'Analytics Integration',
        'security': 'Security Settings',
        'backup': 'Backup Configuration',
        'room-types': 'Room Types',
        'taxes': 'Tax Configuration',
        'cancellation-policy': 'Cancellation Policy',
        'language': 'Language Settings'
      };

      this.settingName = typeToName[this.settingType] || this.settingType;
    }

    next();
  } catch (error) {
    throw new Error(`${error.message}`);
  }
});

// Data retention TTL: auto-delete settings audit logs after 2 years (regulatory compliance)
SettingsAuditLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 730 * 24 * 60 * 60 });

const SettingsAuditLog = mongoose.model('SettingsAuditLog', SettingsAuditLogSchema);

export default SettingsAuditLog;
