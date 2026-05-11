import mongoose from 'mongoose';

/**
 * @swagger
 * components:
 *   schemas:
 *     ServiceType:
 *       type: object
 *       required:
 *         - hotelId
 *         - type
 *         - name
 *         - basePrice
 *       properties:
 *         _id:
 *           type: string
 *           description: Service Type ID
 *         hotelId:
 *           type: string
 *           description: Hotel ID where service type is configured
 *         type:
 *           type: string
 *           enum: [room_service, housekeeping, maintenance, concierge, transport, spa, laundry, other]
 *           description: Service type category
 *         name:
 *           type: string
 *           description: Display name for service type
 *         description:
 *           type: string
 *           description: Service type description
 *         basePrice:
 *           type: number
 *           description: Base price for this service type
 *         currency:
 *           type: string
 *           description: Price currency (default INR)
 *         estimatedDuration:
 *           type: number
 *           description: Estimated duration in minutes
 *         slaTime:
 *           type: number
 *           description: Service Level Agreement time in minutes
 *         isActive:
 *           type: boolean
 *           description: Whether service type is active
 *         variations:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               additionalPrice:
 *                 type: number
 *               description:
 *                 type: string
 *               estimatedDuration:
 *                 type: number
 *         templates:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               services:
 *                 type: array
 *                 items:
 *                   type: string
 *               totalPrice:
 *                 type: number
 *               estimatedDuration:
 *                 type: number
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 */

const serviceVariationSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Variation name is required'],
    trim: true,
    maxlength: [100, 'Variation name cannot exceed 100 characters']
  },
  additionalPrice: {
    type: Number,
    required: [true, 'Additional price is required'],
    min: [0, 'Additional price cannot be negative']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  estimatedDuration: {
    type: Number,
    min: [0, 'Duration cannot be negative']
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, { _id: false });

const serviceTemplateSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Template name is required'],
    trim: true,
    maxlength: [100, 'Template name cannot exceed 100 characters']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  services: [{
    type: String,
    trim: true
  }],
  totalPrice: {
    type: Number,
    required: [true, 'Total price is required'],
    min: [0, 'Total price cannot be negative']
  },
  estimatedDuration: {
    type: Number,
    min: [1, 'Duration must be at least 1 minute']
  },
  isActive: {
    type: Boolean,
    default: true
  },
  priority: {
    type: Number,
    default: 0,
    min: 0
  }
}, { _id: false });

const serviceTypeSchema = new mongoose.Schema({
  hotelId: {
    type: mongoose.Schema.ObjectId,
    ref: 'Hotel',
    required: [true, 'Hotel ID is required'],
    index: true
  },
  type: {
    type: String,
    enum: ['room_service', 'housekeeping', 'maintenance', 'concierge', 'transport', 'spa', 'laundry', 'other'],
    required: [true, 'Service type is required'],
    index: true
  },
  name: {
    type: String,
    required: [true, 'Service type name is required'],
    trim: true,
    maxlength: [100, 'Service type name cannot exceed 100 characters']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [1000, 'Description cannot exceed 1000 characters']
  },
  basePrice: {
    type: Number,
    required: [true, 'Base price is required'],
    min: [0, 'Price cannot be negative']
  },
  currency: {
    type: String,
    default: 'INR',
    uppercase: true,
    maxlength: 3
  },
  estimatedDuration: {
    type: Number,
    min: [1, 'Duration must be at least 1 minute'],
    default: 30
  },
  slaTime: {
    type: Number,
    min: [1, 'SLA time must be at least 1 minute'],
    default: 60
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  variations: [serviceVariationSchema],
  templates: [serviceTemplateSchema],
  // Pricing rules
  pricingRules: {
    dynamicPricing: {
      type: Boolean,
      default: false
    },
    timeBasedPricing: [{
      startTime: String,
      endTime: String,
      priceMultiplier: {
        type: Number,
        min: 0.1,
        max: 10,
        default: 1
      }
    }],
    seasonalPricing: [{
      startDate: Date,
      endDate: Date,
      priceMultiplier: {
        type: Number,
        min: 0.1,
        max: 10,
        default: 1
      },
      name: String
    }]
  },
  // SLA and performance settings
  slaSettings: {
    responseTime: {
      type: Number,
      min: [1, 'Response time must be at least 1 minute'],
      default: 15
    },
    completionTime: {
      type: Number,
      min: [1, 'Completion time must be at least 1 minute'],
      default: 60
    },
    escalationTime: {
      type: Number,
      min: [1, 'Escalation time must be at least 1 minute'],
      default: 30
    },
    autoEscalation: {
      type: Boolean,
      default: true
    }
  },
  // Configuration settings
  settings: {
    requireApproval: {
      type: Boolean,
      default: false
    },
    allowGuestNotes: {
      type: Boolean,
      default: true
    },
    allowScheduling: {
      type: Boolean,
      default: true
    },
    maxAdvanceBooking: {
      type: Number,
      min: 1,
      default: 7 // days
    },
    notificationSettings: {
      emailAlerts: {
        type: Boolean,
        default: true
      },
      smsAlerts: {
        type: Boolean,
        default: false
      },
      pushNotifications: {
        type: Boolean,
        default: true
      }
    }
  },
  // Statistics
  stats: {
    totalRequests: {
      type: Number,
      default: 0,
      min: 0
    },
    completedRequests: {
      type: Number,
      default: 0,
      min: 0
    },
    averageRating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5
    },
    averageCompletionTime: {
      type: Number,
      default: 0,
      min: 0
    },
    averageResponseTime: {
      type: Number,
      default: 0,
      min: 0
    }
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Compound indexes for efficient querying
serviceTypeSchema.index({ hotelId: 1, type: 1 }, { unique: true });
serviceTypeSchema.index({ hotelId: 1, isActive: 1 });
serviceTypeSchema.index({ type: 1, isActive: 1 });

// Virtual for formatted base price
serviceTypeSchema.virtual('formattedBasePrice').get(function() {
  return `${this.currency} ${this.basePrice.toLocaleString()}`;
});

// Virtual for SLA display
serviceTypeSchema.virtual('slaDisplay').get(function() {
  const hours = Math.floor(this.slaTime / 60);
  const minutes = this.slaTime % 60;

  if (hours > 0 && minutes > 0) {
    return `${hours}h ${minutes}m`;
  } else if (hours > 0) {
    return `${hours}h`;
  } else {
    return `${minutes}m`;
  }
});

// Virtual for completion rate
serviceTypeSchema.virtual('completionRate').get(function() {
  if (this.stats.totalRequests === 0) return 0;
  return Math.round((this.stats.completedRequests / this.stats.totalRequests) * 100);
});

// Static method to get service types by hotel
serviceTypeSchema.statics.getByHotel = async function(hotelId, options = {}) {
  try {
    const filter = { hotelId };

    if (options.activeOnly !== false) {
      filter.isActive = true;
    }

    if (options.type) {
      filter.type = options.type;
    }

    return await this.find(filter).sort({ type: 1, name: 1 }).lean().limit(1000);
  } catch (error) {
    throw new Error(`${error.message}`);
  }
};

// Static method to get service type by type and hotel
serviceTypeSchema.statics.getByTypeAndHotel = async function(type, hotelId) {
  try {
    return await this.findOne({ type, hotelId, isActive: true }).lean();
  } catch (error) {
    throw new Error(`${error.message}`);
  }
};

// Instance method to calculate price with variations
serviceTypeSchema.methods.calculatePrice = function(variationNames = [], customMultiplier = 1) {
  let totalPrice = this.basePrice;

  // Add variation costs
  if (variationNames && variationNames.length > 0) {
    variationNames.forEach(variationName => {
      const variation = this.variations.find(v => v.name === variationName && v.isActive);
      if (variation) {
        totalPrice += variation.additionalPrice;
      }
    });
  }

  // Apply custom multiplier (for time-based or seasonal pricing)
  totalPrice *= customMultiplier;

  return Math.round(totalPrice * 100) / 100; // Round to 2 decimal places
};

// Instance method to get active variations
serviceTypeSchema.methods.getActiveVariations = function() {
  return this.variations.filter(variation => variation.isActive);
};

// Instance method to get active templates
serviceTypeSchema.methods.getActiveTemplates = function() {
  return this.templates.filter(template => template.isActive)
    .sort((a, b) => (b.priority || 0) - (a.priority || 0));
};

// Instance method to update statistics
serviceTypeSchema.methods.updateStats = function(newRequest = false, completed = false, rating = null, responseTime = null, completionTime = null) {
  if (newRequest) {
    this.stats.totalRequests += 1;
  }

  if (completed) {
    this.stats.completedRequests += 1;
  }

  if (rating !== null && rating >= 0 && rating <= 5) {
    const currentTotal = this.stats.averageRating * this.stats.completedRequests;
    this.stats.averageRating = (currentTotal + rating) / (this.stats.completedRequests + 1);
  }

  if (responseTime !== null && responseTime > 0) {
    const currentTotal = this.stats.averageResponseTime * this.stats.totalRequests;
    this.stats.averageResponseTime = (currentTotal + responseTime) / this.stats.totalRequests;
  }

  if (completionTime !== null && completionTime > 0) {
    const currentTotal = this.stats.averageCompletionTime * this.stats.completedRequests;
    this.stats.averageCompletionTime = (currentTotal + completionTime) / this.stats.completedRequests;
  }

  return this;
};

// Instance method to check if SLA is met
serviceTypeSchema.methods.isSLAMet = function(responseTime, completionTime) {
  const responseOK = !responseTime || responseTime <= this.slaSettings.responseTime;
  const completionOK = !completionTime || completionTime <= this.slaSettings.completionTime;

  return { responseOK, completionOK, overall: responseOK && completionOK };
};

// Pre-save middleware to validate templates
serviceTypeSchema.pre('save', function(next) {
  // Validate template pricing
  this.templates.forEach(template => {
    if (template.totalPrice < this.basePrice) {
      return next(new Error('Template price cannot be less than base price'));
    }
  });

  // Validate time-based pricing
  if (this.pricingRules.timeBasedPricing) {
    this.pricingRules.timeBasedPricing.forEach(rule => {
      if (rule.startTime && rule.endTime) {
        const start = new Date(`2000-01-01 ${rule.startTime}`);
        const end = new Date(`2000-01-01 ${rule.endTime}`);

        if (start >= end) {
          return next(new Error('End time must be after start time for time-based pricing'));
        }
      }
    });
  }

  next();
});

export default mongoose.model('ServiceType', serviceTypeSchema);