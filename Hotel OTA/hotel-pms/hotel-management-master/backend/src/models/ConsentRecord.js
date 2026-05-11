import mongoose from 'mongoose';

/**
 * ConsentRecord Model
 * Tracks GDPR-compliant consent for data processing activities.
 * Each record represents a user's explicit consent (or withdrawal) for
 * a specific processing purpose, with full audit trail.
 */
const consentRecordSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  hotelId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Hotel',
    index: true
  },
  // The specific consent type being granted or withdrawn
  consentType: {
    type: String,
    required: true,
    enum: [
      'marketing_emails',
      'promotional_sms',
      'behavioral_analytics',
      'third_party_sharing',
      'location_tracking',
      'cookie_analytics',
      'cookie_marketing',
      'data_processing',
      'loyalty_program',
      'personalization',
      'survey_feedback'
    ]
  },
  // Whether consent is currently granted
  granted: {
    type: Boolean,
    required: true,
    default: false
  },
  // Version of the privacy policy at the time of consent
  policyVersion: {
    type: String,
    required: true,
    default: '1.0'
  },
  // How consent was collected
  collectionMethod: {
    type: String,
    required: true,
    enum: ['web_form', 'api', 'email', 'phone', 'in_person', 'checkbox', 'double_opt_in'],
    default: 'web_form'
  },
  // IP address at time of consent (for proof of consent)
  ipAddress: {
    type: String
  },
  // User agent at time of consent
  userAgent: {
    type: String
  },
  // Lawful basis for processing under GDPR
  lawfulBasis: {
    type: String,
    enum: ['consent', 'contract', 'legal_obligation', 'vital_interest', 'public_interest', 'legitimate_interest'],
    default: 'consent'
  },
  // When consent was last given (not just record creation)
  consentGivenAt: {
    type: Date,
    default: Date.now
  },
  // When consent was withdrawn (null if still active)
  consentWithdrawnAt: {
    type: Date,
    default: null
  },
  // Who withdrew consent (could be user or admin)
  withdrawnBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  // Reason for withdrawal
  withdrawalReason: {
    type: String,
    default: null
  },
  // Expiry date for consent (must be re-confirmed after this date)
  expiresAt: {
    type: Date,
    default: function() {
      // Default consent validity: 2 years
      return new Date(Date.now() + 730 * 24 * 60 * 60 * 1000);
    }
  },
  // Full audit trail of consent changes
  auditTrail: [{
    action: {
      type: String,
      enum: ['granted', 'withdrawn', 'renewed', 'expired', 'updated'],
      required: true
    },
    timestamp: {
      type: Date,
      default: Date.now
    },
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    ipAddress: String,
    reason: String,
    policyVersion: String
  }]
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Compound index: one consent record per user per consent type
consentRecordSchema.index({ userId: 1, consentType: 1 }, { unique: true });
// Index for finding expired consents
consentRecordSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
// Index for compliance reporting
consentRecordSchema.index({ hotelId: 1, consentType: 1, granted: 1 });

// Virtual: check if consent is currently active
consentRecordSchema.virtual('isActive').get(function() {
  return this.granted && !this.consentWithdrawnAt && new Date() < this.expiresAt;
});

// Static: get all active consents for a user
consentRecordSchema.statics.getActiveConsents = async function(userId) {
  try {
    return this.find({
      userId,
      granted: true,
      consentWithdrawnAt: null,
      expiresAt: { $gt: new Date() }
    });
  } catch (error) {
    throw new Error(`${error.message}`);
  }
};

// Static: check if user has consent for a specific type
consentRecordSchema.statics.hasConsent = async function(userId, consentType) {
  try {
    const record = await this.findOne({
      userId,
      consentType,
      granted: true,
      consentWithdrawnAt: null,
      expiresAt: { $gt: new Date() }
    });
    return !!record;
  } catch (error) {
    throw new Error(`${error.message}`);
  }
};

// Static: get consent status summary for a user
consentRecordSchema.statics.getConsentSummary = async function(userId) {
  try {
    const records = await this.find({ userId });
    const summary = {};
    for (const record of records) {
      summary[record.consentType] = {
        granted: record.granted,
        isActive: record.granted && !record.consentWithdrawnAt && new Date() < record.expiresAt,
        consentGivenAt: record.consentGivenAt,
        expiresAt: record.expiresAt,
        policyVersion: record.policyVersion
      };
    }
    return summary;
  } catch (error) {
    throw new Error(`${error.message}`);
  }
};

// Static: get bulk consent status for multiple users
consentRecordSchema.statics.getBulkConsentStatus = async function(userIds, consentType) {
  try {
    return this.find({
      userId: { $in: userIds },
      consentType,
      granted: true,
      consentWithdrawnAt: null,
      expiresAt: { $gt: new Date() }
    }).select('userId granted consentGivenAt expiresAt');
  } catch (error) {
    throw new Error(`${error.message}`);
  }
};

// Static: generate compliance report for a hotel
consentRecordSchema.statics.getComplianceReport = async function(hotelId) {
  try {
    return this.aggregate([
      { $match: { hotelId: new mongoose.Types.ObjectId(hotelId) } },
      {
        $group: {
          _id: '$consentType',
          totalRecords: { $sum: 1 },
          activeConsents: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ['$granted', true] },
                    { $eq: ['$consentWithdrawnAt', null] },
                    { $gt: ['$expiresAt', new Date()] }
                  ]
                },
                1,
                0
              ]
            }
          },
          withdrawnConsents: {
            $sum: { $cond: [{ $ne: ['$consentWithdrawnAt', null] }, 1, 0] }
          },
          expiredConsents: {
            $sum: { $cond: [{ $lt: ['$expiresAt', new Date()] }, 1, 0] }
          }
        }
      },
      { $sort: { _id: 1 } }
    ]);
  } catch (error) {
    throw new Error(`${error.message}`);
  }
};

export default mongoose.model('ConsentRecord', consentRecordSchema);
