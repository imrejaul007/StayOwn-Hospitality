import mongoose from 'mongoose';

/**
 * @swagger
 * components:
 *   schemas:
 *     Booking:
 *       type: object
 *       required:
 *         - hotelId
 *         - userId
 *         - rooms
 *         - checkIn
 *         - checkOut
 *       properties:
 *         _id:
 *           type: string
 *         hotelId:
 *           type: string
 *           description: Hotel ID
 *         userId:
 *           type: string
 *           description: Guest user ID
 *         rooms:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               roomId:
 *                 type: string
 *               rate:
 *                 type: number
 *         checkIn:
 *           type: string
 *           format: date
 *         checkOut:
 *           type: string
 *           format: date
 *         nights:
 *           type: number
 *         status:
 *           type: string
 *           enum: [pending, confirmed, modified, checked_in, checked_out, cancelled, no_show]
 *           default: pending
 *         paymentStatus:
 *           type: string
 *           enum: [pending, paid, partially_paid, refunded, failed]
 *           default: pending
 *         totalAmount:
 *           type: number
 *         currency:
 *           type: string
 *           default: USD
 *         roomType:
 *           type: string
 *           enum: [single, double, suite, deluxe]
 *           description: Room type preference for room-type bookings
 *         stripePaymentId:
 *           type: string
 *         idempotencyKey:
 *           type: string
 *         reservedUntil:
 *           type: string
 *           format: date-time
 *         guestDetails:
 *           type: object
 *           properties:
 *             adults:
 *               type: number
 *             children:
 *               type: number
 *             specialRequests:
 *               type: string
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 */

const bookingSchema = new mongoose.Schema({
  hotelId: {
    type: mongoose.Schema.ObjectId,
    ref: 'Hotel',
    required: [true, 'Hotel ID is required'],
    index: true
  },
  userId: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required'],
    index: true
  },
  bookingNumber: {
    type: String,
    unique: true
  },
  rooms: [{
    roomId: {
      type: mongoose.Schema.ObjectId,
      ref: 'Room',
      required: true
    },
    roomTypeId: {
      type: String,
      index: true
    },
    rate: {
      type: Number,
      required: true,
      min: 0
    }
  }],
  checkIn: {
    type: Date,
    required: [true, 'Check-in date is required']
  },
  checkOut: {
    type: Date,
    required: [true, 'Check-out date is required'],
    validate: {
      validator: function(value) {
        return value > this.checkIn;
      },
      message: 'Check-out date must be after check-in date'
    }
  },
  nights: {
    type: Number,
    required: true
  },
  status: {
    type: String,
    enum: {
      values: [
        'pending',      // Initial status when booking is received but not processed
        'confirmed',    // Booking is confirmed and guaranteed
        'modified',     // Booking has been amended/modified (OTA changes)
        'checked_in',   // Guest has checked in
        'checked_out',  // Guest has checked out
        'cancelled',    // Booking has been cancelled
        'no_show'       // Guest failed to show up
      ],
      message: 'Invalid booking status'
    },
    default: 'pending'
  },
  // Status transition tracking
  statusHistory: [{
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'modified', 'checked_in', 'checked_out', 'cancelled', 'no_show'],
      required: true
    },
    timestamp: {
      type: Date,
      default: Date.now
    },
    changedBy: {
      source: {
        type: String,
        enum: ['direct', 'ota', 'admin', 'guest', 'system', 'api', 'walk_in', 'manual', 'frontdesk'],
        required: true
      },
      userId: String,
      userName: String,
      channel: String
    },
    reason: String,
    automaticTransition: {
      type: Boolean,
      default: false
    },
    validatedTransition: {
      type: Boolean,
      default: true
    }
  }],
  // Last status change tracking
  lastStatusChange: {
    from: String,
    to: String,
    timestamp: Date,
    reason: String
  },
  paymentStatus: {
    type: String,
    enum: {
      values: ['pending', 'paid', 'partially_paid', 'refunded', 'failed'],
      message: 'Invalid payment status'
    },
    default: 'pending'
  },
  totalAmount: {
    type: Number,
    required: true,
    min: [0, 'Total amount cannot be negative']
  },
  currency: {
    type: String,
    default: 'INR',
    uppercase: true
  },
  // Detailed payment information for check-in/check-out
  paymentDetails: {
    totalPaid: {
      type: Number,
      default: 0,
      min: 0
    },
    remainingAmount: {
      type: Number,
      default: 0,
      min: 0
    },
    paymentMethods: [{
      method: {
        type: String,
        enum: ['cash', 'card', 'upi', 'online_portal', 'corporate'],
        required: true
      },
      amount: {
        type: Number,
        required: true,
        min: 0
      },
      reference: String, // Transaction reference, UPI ID, etc.
      processedBy: {
        type: mongoose.Schema.ObjectId,
        ref: 'User'
      },
      processedAt: {
        type: Date,
        default: Date.now
      },
      notes: String
    }],
    collectedAt: Date,
    collectedBy: {
      type: mongoose.Schema.ObjectId,
      ref: 'User'
    }
  },
  // Post-checkout settlement tracking
  settlementTracking: {
    status: {
      type: String,
      enum: ['not_required', 'pending', 'partial', 'completed', 'refund_pending', 'refunded'],
      default: 'not_required'
    },
    finalAmount: {
      type: Number,
      min: 0,
      description: 'Final amount including all charges and adjustments'
    },
    adjustments: [{
      type: {
        type: String,
        enum: ['extra_person_charge', 'damage_charge', 'minibar_charge', 'service_charge', 'discount', 'refund', 'penalty', 'other'],
        required: true
      },
      amount: {
        type: Number,
        required: true
      },
      description: {
        type: String,
        required: true
      },
      appliedAt: {
        type: Date,
        default: Date.now
      },
      appliedBy: {
        userId: {
          type: mongoose.Schema.ObjectId,
          ref: 'User'
        },
        userName: String,
        userRole: {
          type: String,
          enum: ['admin', 'staff', 'manager', 'frontdesk']
        }
      },
      invoiceGenerated: {
        type: Boolean,
        default: false
      },
      invoiceId: String
    }],
    outstandingBalance: {
      type: Number,
      default: 0,
      description: 'Amount still owed by guest'
    },
    refundAmount: {
      type: Number,
      default: 0,
      description: 'Amount to be refunded to guest'
    },
    settlementNotes: String,
    lastUpdated: {
      type: Date,
      default: Date.now
    },
    settlementHistory: [{
      action: {
        type: String,
        enum: ['balance_calculated', 'payment_received', 'refund_processed', 'adjustment_applied', 'settlement_completed', 'settlement_created'],
        required: true
      },
      amount: Number,
      description: String,
      timestamp: {
        type: Date,
        default: Date.now
      },
      processedBy: {
        userId: {
          type: mongoose.Schema.ObjectId,
          ref: 'User'
        },
        userName: String,
        userRole: {
          type: String,
          enum: ['admin', 'staff', 'manager', 'frontdesk']
        }
      },
      paymentMethod: {
        type: String,
        enum: ['cash', 'card', 'upi', 'bank_transfer', 'refund_to_source']
      },
      reference: String,
      metadata: mongoose.Schema.Types.Mixed
    }],
    remindersSent: [{
      type: {
        type: String,
        enum: ['email', 'sms', 'phone_call'],
        required: true
      },
      sentAt: {
        type: Date,
        default: Date.now
      },
      sentTo: String,
      status: {
        type: String,
        enum: ['sent', 'delivered', 'failed'],
        default: 'sent'
      },
      template: String,
      response: String
    }],
    escalationLevel: {
      type: Number,
      min: 0,
      max: 5,
      default: 0,
      description: 'Escalation level for overdue settlements'
    },
    dueDate: {
      type: Date,
      description: 'When settlement is due'
    }
  },
  roomType: {
    type: String,
    enum: ['single', 'double', 'suite', 'deluxe'],
    required: false // Optional field for room-type bookings
  },
  /** When booking has no physical `rooms` yet, inventory is held against this RoomType. */
  primaryRoomTypeId: {
    type: mongoose.Schema.ObjectId,
    ref: 'RoomType',
    index: true
  },
  primaryRoomQuantity: {
    type: Number,
    min: 1
  },
  stripePaymentId: String,
  idempotencyKey: {
    type: String,
    unique: true,
    sparse: true
  },
  reservedUntil: {
    type: Date,
    default: function() {
      // Only set expiration for pending bookings
      if (this.status === 'pending') {
        return new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
      }
      return undefined; // No expiration for confirmed bookings
    }
  },
  guestDetails: {
    adults: {
      type: Number,
      required: true,
      min: 1,
      default: 1
    },
    children: {
      type: Number,
      default: 0,
      min: 0
    },
    specialRequests: String
  },
  reminderSent: { type: Boolean, default: false },
  idVerification: {
    documentType: { type: String, enum: ['passport', 'national_id', 'driving_license', 'aadhaar', 'voter_id', 'other'] },
    documentNumber: String,
    issuingCountry: String,
    expiryDate: Date,
    verified: { type: Boolean, default: false },
    verifiedBy: { type: mongoose.Schema.ObjectId, ref: 'User' },
    verifiedAt: Date,
    frontImage: String,
    backImage: String
  },
  corporateBooking: {
    corporateCompanyId: {
      type: mongoose.Schema.ObjectId,
      ref: 'CorporateCompany'
    },
    groupBookingId: {
      type: mongoose.Schema.ObjectId,
      ref: 'GroupBooking'
    },
    employeeId: {
      type: String,
      trim: true
    },
    department: {
      type: String,
      trim: true
    },
    costCenter: {
      type: String,
      trim: true
    },
    purchaseOrderNumber: {
      type: String,
      trim: true
    },
    approverEmail: {
      type: String,
      lowercase: true
    },
    paymentMethod: {
      type: String,
      enum: ['corporate_credit', 'direct_billing', 'advance_payment'],
      default: 'corporate_credit'
    },
    billingEmail: {
      type: String,
      lowercase: true
    }
  },
  gstDetails: {
    gstNumber: {
      type: String,
      match: [/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/, 'Please enter a valid GST number']
    },
    gstRate: {
      type: Number,
      default: 18,
      min: 0,
      max: 100
    },
    gstAmount: {
      type: Number,
      default: 0,
      min: 0
    },
    cgst: Number,
    sgst: Number,
    igst: Number
  },
  extras: [{
    name: String,
    price: Number,
    quantity: {
      type: Number,
      default: 1
    }
  }],
  // Extra persons added after booking creation
  extraPersons: [{
    personId: {
      type: String,
      default: () => new mongoose.Types.ObjectId().toString()
    },
    name: {
      type: String,
      required: true,
      trim: true
    },
    type: {
      type: String,
      enum: ['adult', 'child'],
      required: true
    },
    age: {
      type: Number,
      min: 0,
      max: 120
    },
    addedAt: {
      type: Date,
      default: Date.now
    },
    addedBy: {
      userId: {
        type: mongoose.Schema.ObjectId,
        ref: 'User'
      },
      userName: String,
      userRole: {
        type: String,
        enum: ['admin', 'staff']
      }
    },
    isActive: {
      type: Boolean,
      default: true
    }
  }],
  // Charges for extra persons
  extraPersonCharges: [{
    personId: {
      type: String,
      required: true
    },
    chargeRuleId: {
      type: mongoose.Schema.ObjectId,
      ref: 'ExtraPersonCharge'
    },
    baseCharge: {
      type: Number,
      required: true,
      min: 0
    },
    multipliers: {
      seasonal: {
        type: Number,
        default: 1
      },
      dayOfWeek: {
        type: Number,
        default: 1
      },
      source: {
        type: Number,
        default: 1
      }
    },
    chargeBeforeTax: {
      type: Number,
      required: true,
      min: 0
    },
    taxAmount: {
      type: Number,
      default: 0,
      min: 0
    },
    totalCharge: {
      type: Number,
      required: true,
      min: 0
    },
    currency: {
      type: String,
      default: 'INR'
    },
    appliedAt: {
      type: Date,
      default: Date.now
    },
    paidAmount: {
      type: Number,
      default: 0,
      min: 0
    },
    isPaid: {
      type: Boolean,
      default: false
    },
    paidAt: {
      type: Date
    },
    appliedBy: {
      userId: {
        type: mongoose.Schema.ObjectId,
        ref: 'User'
      },
      userName: String,
      userRole: {
        type: String,
        enum: ['admin', 'staff']
      }
    },
    description: String,
    // NEW: Approval workflow fields
    status: {
      type: String,
      enum: ['pending', 'applied', 'paid'],
      default: 'pending',
      index: true,
      description: 'Charge status - pending (awaiting approval), applied (approved but unpaid), paid (fully paid)'
    },
    calculatedAmount: {
      type: Number,
      required: true,
      min: 0,
      description: 'Original calculated amount from pricing rules'
    },
    adjustedAmount: {
      type: Number,
      min: 0,
      description: 'Admin-adjusted amount (if different from calculated)'
    },
    adjustmentReason: {
      type: String,
      trim: true,
      maxLength: 500,
      description: 'Reason for price adjustment'
    },
    adjustedBy: {
      userId: {
        type: mongoose.Schema.ObjectId,
        ref: 'User'
      },
      userName: String,
      userRole: String,
      adjustedAt: Date
    },
    approvedBy: {
      userId: {
        type: mongoose.Schema.ObjectId,
        ref: 'User'
      },
      userName: String,
      userRole: String
    },
    approvedAt: {
      type: Date,
      description: 'When the charge was approved/applied'
    }
  }],
  cancellationReason: String,
  cancellationPolicy: {
    type: String,
    default: 'standard'
  },
  checkInTime: Date,
  checkOutTime: Date,
  source: {
    type: String,
    // Accept current and legacy booking-origin values so unrelated updates
    // (for example automated status changes) do not fail on revalidation.
    enum: [
      'direct',
      'walk_in',
      'phone',
      'email',
      'web',
      'online',
      'booking_com',
      'expedia',
      'airbnb',
      'ota',
      'corporate',
      'travel_agent',
      'admin',
      'api',
      'manual'
    ],
    default: 'direct'
  },
  // OTA Integration fields for channel management
  channelBookingId: {
    type: String,
    index: true,
    sparse: true // Only OTA bookings will have this
  },
  channelReservationId: {
    type: String,
    index: true,
    sparse: true
  },
  channel: {
    type: mongoose.Schema.ObjectId,
    ref: 'Channel',
    index: true
  },
  // Store raw booking payload for reconciliation
  rawBookingPayload: {
    type: mongoose.Schema.Types.Mixed,
    select: false // Don't include by default to save bandwidth
  },
  // Channel-specific data
  channelData: {
    confirmationCode: String,
    channelCommission: {
      amount: Number,
      percentage: Number,
      currency: String
    },
    paymentMethod: {
      type: String,
      enum: ['credit_card', 'bank_transfer', 'virtual_card', 'pay_at_hotel']
    },
    channelRate: Number,
    channelCurrency: String,
    exchangeRate: Number,
    marketingSource: String,
    bookerCountry: String,
    bookerLanguage: String
  },
  // Enhanced modification history for comprehensive OTA amendment tracking
  modifications: [{
    modificationId: {
      type: String,
      default: () => new mongoose.Types.ObjectId().toString()
    },
    modificationType: {
      type: String,
      enum: [
        'status_change',     // Status transitions
        'rate_change',       // Rate modifications
        'date_change',       // Check-in/out date changes
        'guest_change',      // Guest details updates
        'room_change',       // Room type/number changes
        'cancellation',      // Cancellation requests
        'amendment',         // General amendments
        'ota_modification',  // Specific OTA-initiated changes
        'system_update'      // Automated system updates
      ],
      required: true
    },
    modificationDate: {
      type: Date,
      default: Date.now
    },
    modifiedBy: {
      source: {
        type: String,
        enum: ['direct', 'ota', 'admin', 'guest', 'system', 'api'],
        required: true
      },
      userId: String,
      channel: String,
      userName: String,
      ipAddress: String
    },
    oldValues: {
      type: mongoose.Schema.Types.Mixed,
      required: true
    },
    newValues: {
      type: mongoose.Schema.Types.Mixed,
      required: true
    },
    reason: String,
    otaAmendmentId: String,  // OTA-specific amendment reference
    autoApproved: {
      type: Boolean,
      default: false
    },
    validationErrors: [String],  // Track any validation issues
    conflictResolution: String   // How conflicts were resolved
  }],
  // Sync status for channel management
  syncStatus: {
    lastSyncedAt: Date,
    syncedToChannels: [{
      channel: {
        type: mongoose.Schema.ObjectId,
        ref: 'Channel'
      },
      syncedAt: Date,
      syncStatus: {
        type: String,
        enum: ['pending', 'success', 'failed'],
        default: 'pending'
      },
      errorMessage: String
    }],
    needsSync: {
      type: Boolean,
      default: false
    }
  },
  
  // OTA Amendment specific tracking
  otaAmendments: [{
    amendmentId: {
      type: String,
      required: true
    },
    channelAmendmentId: String,  // OTA's amendment reference
    amendmentType: {
      type: String,
      enum: [
        'booking_modification',
        'guest_details_change', 
        'dates_change',
        'rate_change',
        'room_change',
        'cancellation_request',
        'special_request_change'
      ],
      required: true
    },
    requestedBy: {
      channel: String,
      guestId: String,
      timestamp: {
        type: Date,
        default: Date.now
      }
    },
    amendmentStatus: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'partially_approved'],
      default: 'pending'
    },
    originalData: mongoose.Schema.Types.Mixed,
    requestedChanges: mongoose.Schema.Types.Mixed,
    approvedChanges: mongoose.Schema.Types.Mixed,
    rejectionReason: String,
    processingNotes: String,
    requiresManualApproval: {
      type: Boolean,
      default: false
    },
    approvedBy: {
      userId: String,
      userName: String,
      timestamp: Date
    }
  }],
  
  // Amendment processing flags
  amendmentFlags: {
    hasActivePendingAmendments: {
      type: Boolean,
      default: false
    },
    lastAmendmentDate: Date,
    amendmentCount: {
      type: Number,
      default: 0
    },
    requiresReconfirmation: {
      type: Boolean,
      default: false
    }
  },
  // Travel Agent fields
  travelAgentDetails: {
    travelAgentId: {
      type: mongoose.Schema.ObjectId,
      ref: 'TravelAgent'
    },
    agentCode: {
      type: String,
      uppercase: true,
      trim: true
    },
    agentName: {
      type: String,
      trim: true
    },
    commissionRate: {
      type: Number,
      min: 0,
      max: 50
    },
    commissionAmount: {
      type: Number,
      min: 0
    },
    specialRatesApplied: {
      type: Boolean,
      default: false
    },
    totalSavings: {
      type: Number,
      default: 0,
      min: 0
    },
    agentBookingReference: {
      type: String,
      trim: true
    }
  },
  bookingSource: {
    type: String,
    enum: ['direct', 'travel_agent', 'ota', 'corporate', 'walk_in', 'phone', 'email'],
    default: 'direct'
  },
  // Automation fields
  needsAutomaticProcessing: {
    type: Boolean,
    default: false,
    description: 'Flag to indicate if automatic checkout processing is needed'
  },
  automationStatus: {
    type: String,
    enum: ['pending', 'in_progress', 'completed', 'partial_success', 'failed', 'disabled'],
    default: null,
    description: 'Status of automatic checkout processing'
  },
  automationTriggeredAt: {
    type: Date,
    description: 'When automatic processing was triggered'
  },
  automationCompletedAt: {
    type: Date,
    description: 'When automatic processing was completed'
  },
  automationResults: {
    type: mongoose.Schema.Types.Mixed,
    description: 'Results of automatic processing'
  },
  // Price adjustment tracking
  originalAmount: {
    type: Number,
    description: 'Original booking amount before any adjustments'
  },
  priceAdjustments: [{
    adjustmentId: {
      type: String,
      default: () => new mongoose.Types.ObjectId().toString()
    },
    adjustmentType: {
      type: String,
      enum: ['discount', 'surcharge', 'rate_change', 'promotion', 'manual_adjustment'],
      required: true
    },
    amount: {
      type: Number,
      required: true,
      description: 'Adjustment amount (positive for surcharges, negative for discounts)'
    },
    percentage: {
      type: Number,
      description: 'Percentage of adjustment if applicable'
    },
    reason: {
      type: String,
      required: true,
      trim: true,
      description: 'Reason for price adjustment'
    },
    adjustedBy: {
      userId: {
        type: mongoose.Schema.ObjectId,
        ref: 'User',
        required: true
      },
      userName: {
        type: String,
        required: true
      },
      userRole: {
        type: String,
        enum: ['admin', 'manager', 'staff', 'frontdesk'],
        required: true
      }
    },
    adjustedAt: {
      type: Date,
      default: Date.now
    },
    authorizedBy: {
      userId: {
        type: mongoose.Schema.ObjectId,
        ref: 'User'
      },
      userName: String,
      userRole: String,
      authorizedAt: Date
    },
    discountCode: {
      type: String,
      trim: true,
      description: 'Discount code used if applicable'
    },
    previousAmount: {
      type: Number,
      required: true,
      description: 'Total amount before this adjustment'
    },
    newAmount: {
      type: Number,
      required: true,
      description: 'Total amount after this adjustment'
    },
    isReversed: {
      type: Boolean,
      default: false
    },
    reversedAt: Date,
    reversedBy: {
      userId: {
        type: mongoose.Schema.ObjectId,
        ref: 'User'
      },
      userName: String
    },
    reverseReason: String
  }],
  discountAmount: {
    type: Number,
    default: 0,
    description: 'Total discount amount applied'
  },
  surchargeAmount: {
    type: Number,
    default: 0,
    description: 'Total surcharge amount applied'
  },

  // No-show tracking fields
  noShowRecorded: {
    type: Date,
    description: 'When the booking was marked as no-show'
  },
  noShowReason: {
    type: String,
    maxlength: 500,
    description: 'Reason for marking as no-show'
  },
  noShowMarkedBy: {
    userId: {
      type: mongoose.Schema.ObjectId,
      ref: 'User'
    },
    userName: String,
    userRole: {
      type: String,
      enum: ['admin', 'staff', 'manager']
    }
  },
  noShowChargeAmount: {
    type: Number,
    default: 0,
    min: 0,
    description: 'Amount charged for no-show penalty'
  },
  noShowChargeApplied: {
    type: Boolean,
    default: false,
    description: 'Whether no-show charge has been applied'
  },

  // Cancellation policy snapshot (captured at booking time)
  ratePlanId: {
    type: String,
    description: 'Rate plan used at time of booking'
  },
  ratePlanSnapshot: {
    cancellationPolicy: {
      type: { type: String, enum: ['flexible', 'moderate', 'strict', 'non_refundable'] },
      hoursBeforeCheckIn: Number,
      penaltyPercentage: Number
    }
  },

  // Field-level modification audit trail
  modificationHistory: [{
    modifiedAt: { type: Date, default: Date.now },
    modifiedBy: {
      userId: { type: mongoose.Schema.ObjectId, ref: 'User' },
      userName: String,
      userRole: String,
      source: { type: String, enum: ['direct', 'ota', 'admin', 'guest', 'system', 'api', 'walk_in', 'manual', 'frontdesk'] }
    },
    fieldChanges: [{
      field: { type: String, required: true },
      oldValue: mongoose.Schema.Types.Mixed,
      newValue: mongoose.Schema.Types.Mixed,
      displayField: String
    }],
    reason: String,
    changeType: { type: String, enum: ['modification', 'cancellation', 'status_change', 'payment', 'room_change'] }
  }],

  // Soft delete fields for financial record preservation
  isDeleted: {
    type: Boolean,
    default: false,
    index: true
  },
  deletedAt: Date,
  deletedBy: {
    type: mongoose.Schema.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance
bookingSchema.index({ hotelId: 1, checkIn: 1, checkOut: 1 });
bookingSchema.index({ hotelId: 1, status: 1, checkIn: 1 });
// Compound index for overlap detection queries (double-booking prevention)
bookingSchema.index({ 'rooms.roomId': 1, status: 1, checkIn: 1, checkOut: 1 });
bookingSchema.index({ hotelId: 1, status: 1, createdAt: -1 }); // Compound index for revenue/dashboard aggregation pipelines
bookingSchema.index({ hotelId: 1, paymentStatus: 1, checkOut: -1 }); // Index for overdue payment aggregation pipelines
bookingSchema.index({ userId: 1, status: 1 });
bookingSchema.index({ status: 1, paymentStatus: 1 });
// idempotencyKey already has unique and sparse constraints in schema
// bookingNumber already has unique constraint in schema
// TTL index for pending reservations only - confirmed bookings should not expire
// Corporate bookings are protected by setting their status to 'confirmed' or not setting reservedUntil
bookingSchema.index({
  reservedUntil: 1
}, {
  expireAfterSeconds: 0,
  partialFilterExpression: {
    status: 'pending',
    reservedUntil: { $exists: true }
  }
});

// Compound index for channel-specific idempotency (prevents OTA duplicates)
// Only enforce uniqueness when channelBookingId is not null (for OTA bookings only)
bookingSchema.index({ source: 1, channelBookingId: 1 }, { 
  unique: true, 
  sparse: true,
  partialFilterExpression: { channelBookingId: { $ne: null } }
});

// Enhanced indexes for status tracking and OTA amendments
bookingSchema.index({ 'lastStatusChange.timestamp': -1 });
bookingSchema.index({ 'amendmentFlags.hasActivePendingAmendments': 1, status: 1 });
bookingSchema.index({ 'amendmentFlags.lastAmendmentDate': -1 });
bookingSchema.index({ 'otaAmendments.amendmentStatus': 1 });
bookingSchema.index({ 'statusHistory.timestamp': -1 });
bookingSchema.index({ 'otaAmendments.channelAmendmentId': 1 }, { sparse: true });

// Exclude soft-deleted bookings from all find queries by default
bookingSchema.pre(/^find/, function(next) {
  if (this.getFilter().isDeleted === undefined) {
    this.where({ isDeleted: { $ne: true } });
  }
  next();
});

// Enhanced pre-save middleware for status tracking and validation
bookingSchema.pre('save', function(next) {
  // Protect corporate bookings from TTL deletion
  if (this.corporateBooking && this.corporateBooking.corporateCompanyId) {
    // Remove reservedUntil for corporate bookings
    if (this.reservedUntil) {
      this.reservedUntil = undefined;
    }
    // Ensure corporate bookings are never left in pending status
    if (this.status === 'pending' && this.isNew) {
      this.status = 'confirmed';
    }
  }

  // Calculate nights when dates change
  if (this.isModified('checkIn') || this.isModified('checkOut')) {
    const timeDiff = this.checkOut.getTime() - this.checkIn.getTime();
    this.nights = Math.ceil(timeDiff / (1000 * 3600 * 24));
  }

  // Calculate payment details and sync paymentStatus with actual amounts
  if (this.paymentDetails && this.paymentDetails.paymentMethods && this.paymentDetails.paymentMethods.length > 0) {
    this.paymentDetails.totalPaid = this.paymentDetails.paymentMethods.reduce((total, payment) => total + payment.amount, 0);
    this.paymentDetails.remainingAmount = Math.max(0, this.totalAmount - this.paymentDetails.totalPaid);

    // Auto-update payment status based on actual payment amount
    if (this.paymentDetails.totalPaid >= this.totalAmount) {
      this.paymentStatus = 'paid';
    } else if (this.paymentDetails.totalPaid > 0) {
      this.paymentStatus = 'partially_paid';
    }
  } else if (this.paymentDetails) {
    // paymentDetails exists but no paymentMethods array (or empty array)
    // Ensure totalPaid/remainingAmount are consistent
    if (!this.paymentDetails.totalPaid || this.paymentDetails.totalPaid === 0) {
      this.paymentDetails.remainingAmount = this.totalAmount || 0;
    }
  }

  // Safety: ensure paymentStatus is consistent with paymentDetails.totalPaid
  // This prevents the scenario where paymentStatus is 'paid' but totalPaid is 0
  if (this.paymentDetails && typeof this.paymentDetails.totalPaid === 'number' && this.totalAmount > 0) {
    if (this.paymentStatus === 'paid' && this.paymentDetails.totalPaid < this.totalAmount) {
      // paymentStatus says paid but totalPaid disagrees -- fix the status
      if (this.paymentDetails.totalPaid > 0) {
        this.paymentStatus = 'partially_paid';
      } else {
        this.paymentStatus = 'pending';
      }
    } else if (this.paymentStatus !== 'refunded' && this.paymentStatus !== 'failed' &&
               this.paymentDetails.totalPaid >= this.totalAmount && this.paymentStatus !== 'paid') {
      // totalPaid covers full amount but paymentStatus is not 'paid' -- fix
      this.paymentStatus = 'paid';
    }
  }

  // Generate booking number if not exists
  if (!this.bookingNumber) {
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    // Use 7 random digits (10M possibilities per day) to avoid collisions under high volume
    const random = Math.floor(Math.random() * 10000000).toString().padStart(7, '0');
    this.bookingNumber = `BK${date}${random}`;
  }
  
  // Initialize status history for new bookings
  if (this.isNew && (!this.statusHistory || this.statusHistory.length === 0)) {
    this.statusHistory = [{
      status: this.status || 'pending',
      timestamp: new Date(),
      changedBy: {
        source: this.source || 'direct',
        userId: this.createdBy,
        userName: 'System',
        channel: this.channel
      },
      reason: 'Initial booking creation',
      automaticTransition: false,
      validatedTransition: true
    }];
  }
  
  // Track status changes for existing bookings
  if (!this.isNew && this.isModified('status')) {
    // Store original status before the change (this requires custom tracking)
    const previousStatus = this._previousStatus || 'unknown';

    // Legacy / imported bookings may not have statusHistory initialized
    if (!Array.isArray(this.statusHistory)) {
      this.statusHistory = [];
    }
    
    // Add to status history
    this.statusHistory.push({
      status: this.status,
      timestamp: new Date(),
      changedBy: {
        source: this._statusChangeContext?.source || 'system',
        userId: this._statusChangeContext?.userId,
        userName: this._statusChangeContext?.userName || 'System',
        channel: this._statusChangeContext?.channel
      },
      reason: this._statusChangeContext?.reason || 'Status updated',
      automaticTransition: this._statusChangeContext?.automatic || false,
      validatedTransition: true
    });
    
    // Update last status change tracking
    this.lastStatusChange = {
      from: previousStatus,
      to: this.status,
      timestamp: new Date(),
      reason: this._statusChangeContext?.reason || 'Status updated'
    };
    
    // Clear context
    delete this._statusChangeContext;
    delete this._previousStatus;
  }
  
  // Update amendment flags if amendments exist
  if (this.otaAmendments && this.otaAmendments.length > 0) {
    this.amendmentFlags.amendmentCount = this.otaAmendments.length;
    this.amendmentFlags.hasActivePendingAmendments = this.otaAmendments.some(
      amendment => amendment.amendmentStatus === 'pending'
    );
    this.amendmentFlags.lastAmendmentDate = Math.max(
      ...this.otaAmendments.map(a => new Date(a.requestedBy.timestamp))
    );
  }
  
  next();
});

// Virtual for room details
bookingSchema.virtual('roomDetails', {
  ref: 'Room',
  localField: 'rooms.roomId',
  foreignField: '_id'
});

// Instance method to calculate total amount
bookingSchema.methods.calculateTotalAmount = function() {
  const roomsTotal = this.rooms.reduce((total, room) => total + room.rate, 0) * this.nights;
  const extrasTotal = this.extras.reduce((total, extra) => total + (extra.price * extra.quantity), 0);
  const extraPersonTotal = this.extraPersonCharges.reduce((total, charge) => total + charge.totalCharge, 0);
  return roomsTotal + extrasTotal + extraPersonTotal;
};

// Instance method to add extra person
bookingSchema.methods.addExtraPerson = async function(personData, userContext) {
  try {
    if (!['admin', 'staff', 'manager', 'frontdesk'].includes(userContext.userRole)) {
      throw new Error('Only authorized staff can add extra persons');
    }

    // Validate person data
    if (!personData.name || !personData.type) {
      throw new Error('Person name and type are required');
    }

    if (personData.type === 'child' && (personData.age === undefined || personData.age < 0 || personData.age > 17)) {
      throw new Error('Valid age is required for children (0-17)');
    }

    // Check if booking allows extra persons
    if (this.status === 'cancelled' || this.status === 'no_show') {
      throw new Error('Cannot add extra persons to cancelled or no-show bookings');
    }

    const extraPerson = {
      name: personData.name,
      type: personData.type,
      age: personData.age,
      addedBy: {
        userId: userContext.userId,
        userName: userContext.userName,
        userRole: userContext.userRole
      }
    };

    this.extraPersons.push(extraPerson);

    // Update guest details count
    if (personData.type === 'adult') {
      this.guestDetails.adults += 1;
    } else {
      this.guestDetails.children += 1;
    }

    return extraPerson;
  } catch (error) {
    throw new Error(`${error.message}`);
  }
};

// Instance method to remove extra person
bookingSchema.methods.removeExtraPerson = async function(personId, userContext) {
  try {
    if (!['admin', 'staff', 'manager', 'frontdesk'].includes(userContext.userRole)) {
      throw new Error('Only authorized staff can remove extra persons');
    }

    const personIndex = this.extraPersons.findIndex(p => p.personId === personId);
    if (personIndex === -1) {
      throw new Error('Extra person not found');
    }

    const person = this.extraPersons[personIndex];

    // Update guest details count
    if (person.type === 'adult') {
      this.guestDetails.adults = Math.max(1, this.guestDetails.adults - 1);
    } else {
      this.guestDetails.children = Math.max(0, this.guestDetails.children - 1);
    }

    // Remove person
    this.extraPersons.splice(personIndex, 1);

    // Remove associated charges
    this.extraPersonCharges = this.extraPersonCharges.filter(charge => charge.personId !== personId);

    return person;
  } catch (error) {
    throw new Error(`${error.message}`);
  }
};

// Instance method to calculate and apply extra person charges
bookingSchema.methods.calculateExtraPersonCharges = async function() {
  try {
    if (this.extraPersons.length === 0) {
      return { totalCharges: 0, charges: [] };
    }

    const ExtraPersonCharge = mongoose.model('ExtraPersonCharge');

    // Get room type from the first room, or the booking's roomType field as fallback
    let roomType = this.roomType;
    if (!roomType && this.rooms.length > 0) {
      // Check if already populated
      if (this.rooms[0].roomId && typeof this.rooms[0].roomId === 'object' && this.rooms[0].roomId.type) {
        roomType = this.rooms[0].roomId.type;
      } else {
        // Need to populate
        await this.populate('rooms.roomId', 'type');
        roomType = this.rooms[0].roomId?.type;
      }
    }

    const bookingData = {
      roomType: roomType,
      baseRoomRate: this.rooms.reduce((total, room) => total + room.rate, 0) / this.rooms.length,
      extraPersons: this.extraPersons.map(p => ({
        id: p.personId,
        name: p.name,
        type: p.type,
        age: p.age
      })),
      checkIn: this.checkIn,
      checkOut: this.checkOut,
      bookingSource: this.source,
      nights: this.nights
    };

    const chargeResult = await ExtraPersonCharge.calculateExtraPersonCharge(this.hotelId, bookingData);

    // Update extra person charges while preserving payment and approval status
    const existingCharges = this.extraPersonCharges || [];
    this.extraPersonCharges = chargeResult.chargeBreakdown.map(charge => {
      // Find existing charge for this person to preserve payment and approval status
      const existingCharge = existingCharges.find(existing => existing.personId === charge.personId);

      return {
        personId: charge.personId,
        chargeRuleId: charge.ruleApplied,
        baseCharge: charge.baseCharge,
        multipliers: {
          seasonal: charge.seasonMultiplier,
          dayOfWeek: charge.dayMultiplier,
          source: charge.sourceMultiplier
        },
        chargeBeforeTax: charge.chargeBeforeTax,
        taxAmount: charge.taxAmount,
        totalCharge: charge.totalCharge,
        currency: charge.currency,
        description: `Extra ${charge.personType} charge for ${charge.personName}`,
        // Preserve payment status from existing charge, or set defaults for new charges
        paidAmount: existingCharge ? existingCharge.paidAmount : 0,
        isPaid: existingCharge ? existingCharge.isPaid : false,
        paidAt: existingCharge ? existingCharge.paidAt : undefined,
        // NEW: Approval workflow fields
        status: existingCharge ? existingCharge.status : 'pending',
        calculatedAmount: charge.totalCharge, // Store the original calculated amount
        adjustedAmount: existingCharge ? existingCharge.adjustedAmount : undefined,
        adjustmentReason: existingCharge ? existingCharge.adjustmentReason : undefined,
        adjustedBy: existingCharge ? existingCharge.adjustedBy : undefined,
        approvedBy: existingCharge ? existingCharge.approvedBy : undefined,
        approvedAt: existingCharge ? existingCharge.approvedAt : undefined
      };
    });

    return chargeResult;
  } catch (error) {
    throw new Error(`${error.message}`);
  }
};

// Instance method to calculate settlement
bookingSchema.methods.calculateSettlement = function() {
  if (!this.settlementTracking) {
    this.settlementTracking = {
      status: 'not_required',
      adjustments: [],
      outstandingBalance: 0,
      refundAmount: 0,
      settlementHistory: [],
      remindersSent: [],
      escalationLevel: 0
    };
  }

  const finalAmount = this.calculateTotalAmount();
  const totalPaid = this.paymentDetails?.totalPaid || 0;

  // Add all adjustments
  const adjustmentsTotal = this.settlementTracking.adjustments.reduce((total, adj) => total + adj.amount, 0);
  const finalAmountWithAdjustments = finalAmount + adjustmentsTotal;

  if (finalAmountWithAdjustments > totalPaid) {
    // Guest owes money
    this.settlementTracking.status = 'pending';
    this.settlementTracking.outstandingBalance = finalAmountWithAdjustments - totalPaid;
    this.settlementTracking.refundAmount = 0;
  } else if (finalAmountWithAdjustments < totalPaid) {
    // Refund required
    this.settlementTracking.status = 'refund_pending';
    this.settlementTracking.outstandingBalance = 0;
    this.settlementTracking.refundAmount = totalPaid - finalAmountWithAdjustments;
  } else {
    // No settlement required
    this.settlementTracking.status = 'completed';
    this.settlementTracking.outstandingBalance = 0;
    this.settlementTracking.refundAmount = 0;
  }

  this.settlementTracking.finalAmount = finalAmountWithAdjustments;
  this.settlementTracking.lastUpdated = new Date();

  return this.settlementTracking;
};

// Instance method to add settlement adjustment
bookingSchema.methods.addSettlementAdjustment = function(adjustmentData, userContext) {
  if (!['admin', 'staff', 'manager', 'frontdesk'].includes(userContext.userRole)) {
    throw new Error('Only authorized staff can add settlement adjustments');
  }

  const adjustment = {
    type: adjustmentData.type,
    amount: adjustmentData.amount,
    description: adjustmentData.description,
    appliedBy: {
      userId: userContext.userId,
      userName: userContext.userName,
      userRole: userContext.userRole
    },
    invoiceGenerated: false
  };

  if (!this.settlementTracking) {
    this.settlementTracking = {
      status: 'not_required',
      adjustments: [],
      outstandingBalance: 0,
      refundAmount: 0,
      settlementHistory: [],
      remindersSent: [],
      escalationLevel: 0
    };
  }

  this.settlementTracking.adjustments.push(adjustment);

  // Add to settlement history
  this.settlementTracking.settlementHistory.push({
    action: 'adjustment_applied',
    amount: adjustmentData.amount,
    description: `${adjustmentData.type}: ${adjustmentData.description}`,
    processedBy: {
      userId: userContext.userId,
      userName: userContext.userName,
      userRole: userContext.userRole
    }
  });

  // Recalculate settlement
  this.calculateSettlement();

  return adjustment;
};

// Instance method to process settlement payment
bookingSchema.methods.processSettlementPayment = function(paymentData, userContext) {
  if (!['admin', 'staff', 'manager', 'frontdesk'].includes(userContext.userRole)) {
    throw new Error('Only authorized staff can process settlement payments');
  }

  if (!this.settlementTracking || this.settlementTracking.status === 'not_required') {
    throw new Error('No settlement required for this booking');
  }

  const payment = {
    amount: paymentData.amount,
    method: paymentData.method,
    reference: paymentData.reference,
    notes: paymentData.notes
  };

  // Add to payment details
  if (!this.paymentDetails.paymentMethods) {
    this.paymentDetails.paymentMethods = [];
  }

  this.paymentDetails.paymentMethods.push({
    method: paymentData.method,
    amount: paymentData.amount,
    reference: paymentData.reference,
    processedBy: userContext.userId,
    notes: paymentData.notes
  });

  // Update payment totals
  this.paymentDetails.totalPaid = this.paymentDetails.paymentMethods.reduce((total, payment) => total + payment.amount, 0);
  this.paymentDetails.remainingAmount = Math.max(0, this.totalAmount - this.paymentDetails.totalPaid);

  // Sync paymentStatus with actual payment totals
  if (this.paymentDetails.totalPaid >= this.totalAmount) {
    this.paymentStatus = 'paid';
  } else if (this.paymentDetails.totalPaid > 0) {
    this.paymentStatus = 'partially_paid';
  }

  // Add to settlement history
  this.settlementTracking.settlementHistory.push({
    action: 'payment_received',
    amount: paymentData.amount,
    description: `Payment received via ${paymentData.method}`,
    processedBy: {
      userId: userContext.userId,
      userName: userContext.userName,
      userRole: userContext.userRole
    },
    paymentMethod: paymentData.method,
    reference: paymentData.reference
  });

  // Recalculate settlement
  this.calculateSettlement();

  return payment;
};

// Static method to find overlapping bookings
bookingSchema.statics.findOverlapping = async function(
  roomIds,
  checkIn,
  checkOut,
  excludeBookingIdOrOptions = null,
  maybeOptions = {}
) {
  try {
    let options = {};

    // Backward compatible argument parsing:
    // old: findOverlapping(roomIds, checkIn, checkOut, excludeBookingId)
    // new: findOverlapping(roomIds, checkIn, checkOut, { hotelId, excludeBookingId, session })
    const isOptionsObject =
      excludeBookingIdOrOptions &&
      typeof excludeBookingIdOrOptions === 'object' &&
      !Array.isArray(excludeBookingIdOrOptions) &&
      (
        Object.prototype.hasOwnProperty.call(excludeBookingIdOrOptions, 'hotelId') ||
        Object.prototype.hasOwnProperty.call(excludeBookingIdOrOptions, 'excludeBookingId') ||
        Object.prototype.hasOwnProperty.call(excludeBookingIdOrOptions, 'session')
      );

    if (isOptionsObject) {
      options = excludeBookingIdOrOptions;
    } else {
      options = {
        ...maybeOptions,
        excludeBookingId: excludeBookingIdOrOptions || maybeOptions.excludeBookingId || null
      };
    }

    const {
      hotelId,
      excludeBookingId = null,
      session = null
    } = options;

    const query = {
      'rooms.roomId': { $in: roomIds },
      // Only include bookings that actually occupy the room (exclude checked_out, cancelled, no_show)
      status: { $in: ['pending', 'confirmed', 'modified', 'checked_in'] },
      // Canonical overlap condition:
      // existing.checkIn < requestedCheckOut && existing.checkOut > requestedCheckIn
      checkIn: { $lt: checkOut },
      checkOut: { $gt: checkIn }
    };

    if (excludeBookingId) {
      query._id = { $ne: excludeBookingId };
    }

    if (hotelId) {
      query.hotelId = hotelId;
    }

    let bookingQuery = this.find(query);
    if (session) {
      bookingQuery = bookingQuery.session(session);
    }

    return await bookingQuery.lean().limit(1000);
  } catch (error) {
    throw new Error(`${error.message}`);
  }
};

// Instance method to check if booking can be cancelled
bookingSchema.methods.canCancel = function() {
  const now = new Date();
  const checkInTime = new Date(this.checkIn);
  const hoursUntilCheckIn = (checkInTime - now) / (1000 * 60 * 60);
  
  // Can cancel if more than 24 hours before check-in and not already checked in
  return hoursUntilCheckIn > 24 && !['checked_in', 'checked_out', 'cancelled'].includes(this.status);
};

// Status transition validation matrix
const STATUS_TRANSITIONS = {
  pending: ['confirmed', 'cancelled', 'modified'],
  confirmed: ['checked_in', 'cancelled', 'no_show', 'modified'],
  modified: ['confirmed', 'cancelled', 'checked_in', 'no_show'],
  checked_in: ['checked_out'],
  checked_out: [], // Final state
  cancelled: [], // Final state
  no_show: ['cancelled'] // Can cancel no-shows for cleanup
};

// Instance method for safe status transitions with validation
bookingSchema.methods.changeStatus = async function(newStatus, context = {}) {
  try {
    const currentStatus = this.status;
  
    // Validate transition is allowed
    if (!STATUS_TRANSITIONS[currentStatus]?.includes(newStatus)) {
      throw new Error(
        `Invalid status transition from '${currentStatus}' to '${newStatus}'. ` +
        `Allowed transitions: ${STATUS_TRANSITIONS[currentStatus]?.join(', ') || 'none'}`
      );
    }
  
    // Business rule validations
    await this.validateStatusTransition(currentStatus, newStatus, context);
  
    // Store context for pre-save middleware
    this._previousStatus = currentStatus;
    this._statusChangeContext = {
      source: context.source || 'system',
      userId: context.userId,
      userName: context.userName || 'System',
      channel: context.channel,
      reason: context.reason || `Status changed from ${currentStatus} to ${newStatus}`,
      automatic: context.automatic || false,
      validationPassed: true
    };
  
    // Update status
    this.status = newStatus;
  
    // Handle status-specific logic
    await this.handleStatusSpecificActions(newStatus, currentStatus, context);
  
    return this;
  } catch (error) {
    throw new Error(`${error.message}`);
  }
};

// Business rule validation for status transitions
bookingSchema.methods.validateStatusTransition = async function(fromStatus, toStatus, context) {
  try {
    const now = new Date();
    const checkInTime = new Date(this.checkIn);
    const checkOutTime = new Date(this.checkOut);
  
    switch (toStatus) {
      case 'confirmed':
        // Must have valid payment or be within payment terms
        if (this.paymentStatus === 'failed') {
          throw new Error('Cannot confirm booking with failed payment');
        }
        if (this.amendmentFlags.hasActivePendingAmendments && !context.bypassAmendmentCheck) {
          throw new Error('Cannot confirm booking with pending amendments. Resolve amendments first.');
        }
        break;
      
      case 'checked_in':
        // Can only check in on or after check-in date
        if (now < checkInTime && !context.earlyCheckIn) {
          throw new Error(`Cannot check in before check-in date: ${checkInTime.toISOString()}`);
        }
        // Must be confirmed first (unless coming from modified)
        if (fromStatus !== 'confirmed' && fromStatus !== 'modified') {
          throw new Error('Can only check in confirmed or modified bookings');
        }
        break;
      
      case 'checked_out':
        // Must be checked in first
        if (fromStatus !== 'checked_in') {
          throw new Error('Must be checked in before checking out');
        }
        break;
      
      case 'cancelled':
        // Check cancellation policy if not system/admin
        if (context.source === 'guest' || context.source === 'ota') {
          const canCancel = this.canCancel();
          if (!canCancel && !context.bypassCancellationPolicy) {
            throw new Error('Booking cannot be cancelled due to cancellation policy restrictions');
          }
        }
        break;
      
      case 'no_show':
        // Can only mark as no-show after check-in time has passed
        const hoursAfterCheckIn = (now - checkInTime) / (1000 * 60 * 60);
        if (hoursAfterCheckIn < 2 && !context.manualNoShow) { // 2 hour grace period
          throw new Error('Cannot mark as no-show before grace period expires');
        }
        break;
      
      case 'modified':
        // Ensure there are pending amendments to justify modified status
        if (!this.amendmentFlags.hasActivePendingAmendments && !context.forceModified) {
          throw new Error('Cannot set status to modified without pending amendments');
        }
        break;
    }
  
    return true;
  } catch (error) {
    throw new Error(`${error.message}`);
  }
};

// Handle status-specific actions and side effects
bookingSchema.methods.handleStatusSpecificActions = async function(newStatus, oldStatus, context) {
  try {
    const now = new Date();
  
    switch (newStatus) {
      case 'confirmed':
        // Clear any temporary holds
        this.reservedUntil = undefined;
        // Mark as needing sync to channels
        if (this.source !== 'direct') {
          this.syncStatus.needsSync = true;
        }
        break;
      
      case 'checked_in':
        // Record actual check-in time
        if (!this.actualCheckIn) {
          this.actualCheckIn = now;
        }
        // Update room occupancy status if available
        if (this.rooms?.length > 0 && context.updateRoomStatus !== false) {
          // This would typically trigger room status updates
          this.needsRoomStatusUpdate = true;
        }
        break;
      
      case 'checked_out':
        // Record actual check-out time
        if (!this.actualCheckOut) {
          this.actualCheckOut = now;
        }
        // Calculate final billing if needed
        this.needsFinalBilling = true;
        // Mark rooms as needing cleaning
        this.needsRoomStatusUpdate = true;
      
        // NEW: Trigger automatic checkout processing
        if (context.enableAutomation !== false) {
          this.needsAutomaticProcessing = true;
          this.automationStatus = 'pending';
          this.automationTriggeredAt = now;
        }
        break;
      
      case 'cancelled':
        // Clear room assignments
        this.reservedUntil = undefined;
        // Handle refund processing
        if (this.paymentStatus === 'paid' && context.processRefund !== false) {
          this.needsRefundProcessing = true;
        }
        // Sync cancellation to OTAs
        if (this.source !== 'direct') {
          this.syncStatus.needsSync = true;
        }
        break;
      
      case 'modified':
        // Ensure amendment tracking is properly set
        this.amendmentFlags.requiresReconfirmation = true;
        // Mark as needing sync
        this.syncStatus.needsSync = true;
        break;
      
      case 'no_show':
        // Apply no-show penalties if configured
        this.noShowRecorded = now;
        // Still may need refund processing based on policy
        if (context.applyNoShowPenalty !== false) {
          this.needsPenaltyProcessing = true;
        }
        break;
    }
  
    return this;
  } catch (error) {
    throw new Error(`${error.message}`);
  }
};

// Price Adjustment Methods
bookingSchema.methods.applyPriceAdjustment = function(adjustmentData, userContext) {
  // Store original amount if this is the first adjustment
  if (!this.originalAmount) {
    this.originalAmount = this.totalAmount;
  }

  const previousAmount = this.totalAmount;
  const adjustmentAmount = adjustmentData.amount;
  const newAmount = previousAmount + adjustmentAmount;

  // Validate adjustment
  if (newAmount < 0) {
    throw new Error('Adjustment would result in negative total amount');
  }

  // Create adjustment record
  const adjustment = {
    adjustmentType: adjustmentData.type || 'manual_adjustment',
    amount: adjustmentAmount,
    percentage: adjustmentData.percentage,
    reason: adjustmentData.reason,
    adjustedBy: {
      userId: userContext.userId,
      userName: userContext.userName,
      userRole: userContext.userRole
    },
    discountCode: adjustmentData.discountCode,
    previousAmount: previousAmount,
    newAmount: newAmount
  };

  // Add authorization data if provided
  if (adjustmentData.authorizedBy) {
    adjustment.authorizedBy = {
      userId: adjustmentData.authorizedBy.userId,
      userName: adjustmentData.authorizedBy.userName,
      userRole: adjustmentData.authorizedBy.userRole,
      authorizedAt: new Date()
    };
  }

  // Add to price adjustments array
  this.priceAdjustments.push(adjustment);

  // Update total amount
  this.totalAmount = newAmount;

  // Update discount/surcharge amounts
  if (adjustmentAmount < 0) {
    this.discountAmount = (this.discountAmount || 0) + Math.abs(adjustmentAmount);
  } else {
    this.surchargeAmount = (this.surchargeAmount || 0) + adjustmentAmount;
  }

  // Recalculate payment details
  if (this.paymentDetails && this.paymentDetails.totalPaid) {
    this.paymentDetails.remainingAmount = Math.max(0, this.totalAmount - this.paymentDetails.totalPaid);
  }

  return adjustment;
};

bookingSchema.methods.reversePriceAdjustment = function(adjustmentId, reverseReason, userContext) {
  const adjustment = this.priceAdjustments.id(adjustmentId);
  if (!adjustment) {
    throw new Error('Price adjustment not found');
  }

  if (adjustment.isReversed) {
    throw new Error('Price adjustment already reversed');
  }

  // Mark as reversed
  adjustment.isReversed = true;
  adjustment.reversedAt = new Date();
  adjustment.reversedBy = {
    userId: userContext.userId,
    userName: userContext.userName
  };
  adjustment.reverseReason = reverseReason;

  // Reverse the amount
  this.totalAmount -= adjustment.amount;

  // Update discount/surcharge amounts
  if (adjustment.amount < 0) {
    this.discountAmount = Math.max(0, (this.discountAmount || 0) - Math.abs(adjustment.amount));
  } else {
    this.surchargeAmount = Math.max(0, (this.surchargeAmount || 0) - adjustment.amount);
  }

  // Recalculate payment details
  if (this.paymentDetails && this.paymentDetails.totalPaid) {
    this.paymentDetails.remainingAmount = Math.max(0, this.totalAmount - this.paymentDetails.totalPaid);
  }

  return adjustment;
};

bookingSchema.methods.getTotalAdjustments = function() {
  const activeAdjustments = this.priceAdjustments.filter(adj => !adj.isReversed);
  return {
    totalDiscount: this.discountAmount || 0,
    totalSurcharge: this.surchargeAmount || 0,
    netAdjustment: activeAdjustments.reduce((sum, adj) => sum + adj.amount, 0),
    adjustmentCount: activeAdjustments.length,
    originalAmount: this.originalAmount || this.totalAmount
  };
};

bookingSchema.methods.canAdjustPrice = function(userRole, adjustmentAmount) {
  const adjustmentLimits = {
    staff: { maxDiscount: 500, maxSurcharge: 200 },
    frontdesk: { maxDiscount: 1000, maxSurcharge: 500 },
    manager: { maxDiscount: 2000, maxSurcharge: 1000 },
    admin: { maxDiscount: Infinity, maxSurcharge: Infinity }
  };

  const limits = adjustmentLimits[userRole];
  if (!limits) return false;

  if (adjustmentAmount < 0 && Math.abs(adjustmentAmount) > limits.maxDiscount) {
    return false;
  }

  if (adjustmentAmount > 0 && adjustmentAmount > limits.maxSurcharge) {
    return false;
  }

  return true;
};

// Method to handle OTA amendments with status management
bookingSchema.methods.processOTAAmendment = async function(amendmentData, context = {}) {
  try {
    const amendmentId = `AM${Date.now()}${Math.floor(Math.random() * 1000)}`;
  
    // Create amendment record
    const amendment = {
      amendmentId,
      channelAmendmentId: amendmentData.channelAmendmentId,
      amendmentType: amendmentData.type,
      requestedBy: {
        channel: amendmentData.channel || this.channel,
        guestId: amendmentData.guestId,
        timestamp: new Date()
      },
      amendmentStatus: 'pending',
      originalData: amendmentData.originalData,
      requestedChanges: amendmentData.requestedChanges,
      requiresManualApproval: amendmentData.requiresManualApproval || false,
      processingNotes: amendmentData.notes
    };
  
    // Add to amendments array
    if (!this.otaAmendments) {
      this.otaAmendments = [];
    }
    this.otaAmendments.push(amendment);
  
    // Update status to modified if not already
    if (this.status !== 'modified') {
      await this.changeStatus('modified', {
        source: 'ota',
        channel: amendmentData.channel,
        reason: `OTA amendment received: ${amendmentData.type}`,
        automatic: true,
        ...context
      });
    }
  
    // Update flags
    this.amendmentFlags.hasActivePendingAmendments = true;
    this.amendmentFlags.lastAmendmentDate = new Date();
    this.amendmentFlags.amendmentCount++;
  
    return amendmentId;
  } catch (error) {
    throw new Error(`${error.message}`);
  }
};

// Method to approve/reject amendments
bookingSchema.methods.resolveAmendment = async function(amendmentId, decision, approverInfo = {}) {
  try {
    const amendment = this.otaAmendments.find(a => a.amendmentId === amendmentId);
    if (!amendment) {
      throw new Error(`Amendment ${amendmentId} not found`);
    }
  
    if (amendment.amendmentStatus !== 'pending') {
      throw new Error(`Amendment ${amendmentId} is already ${amendment.amendmentStatus}`);
    }
  
    // Update amendment status
    amendment.amendmentStatus = decision;
    amendment.approvedBy = {
      userId: approverInfo.userId,
      userName: approverInfo.userName || 'System',
      timestamp: new Date()
    };
  
    if (decision === 'approved' || decision === 'partially_approved') {
      // Apply approved changes
      amendment.approvedChanges = decision === 'approved' ? 
        amendment.requestedChanges : 
        approverInfo.partialChanges;
      
      // Apply changes to booking
      await this.applyAmendmentChanges(amendment.approvedChanges);
    
    } else if (decision === 'rejected') {
      amendment.rejectionReason = approverInfo.rejectionReason || 'Amendment rejected';
    }
  
    // Check if all amendments are resolved
    const pendingAmendments = this.otaAmendments.filter(a => a.amendmentStatus === 'pending');
    if (pendingAmendments.length === 0) {
      this.amendmentFlags.hasActivePendingAmendments = false;
    
      // If all approved, change status back to confirmed
      const hasApprovedAmendments = this.otaAmendments.some(
        a => ['approved', 'partially_approved'].includes(a.amendmentStatus)
      );
    
      if (hasApprovedAmendments && this.status === 'modified') {
        await this.changeStatus('confirmed', {
          source: 'system',
          reason: 'All amendments processed, booking reconfirmed',
          automatic: true,
          bypassAmendmentCheck: true
        });
      }
    }
  
    return amendment;
  } catch (error) {
    throw new Error(`${error.message}`);
  }
};

// Helper method to apply amendment changes to booking
bookingSchema.methods.applyAmendmentChanges = async function(changes) {
  try {
    const originalData = {};
  
    // Store original values for audit
    for (const [field, newValue] of Object.entries(changes)) {
      originalData[field] = this[field];
    
      // Apply change based on field type
      if (field === 'checkIn' || field === 'checkOut') {
        this[field] = new Date(newValue);
      } else if (field === 'guestInfo') {
        Object.assign(this.guestInfo, newValue);
      } else if (field === 'rooms') {
        this.rooms = newValue;
      } else {
        this[field] = newValue;
      }
    }
  
    // Add modification record
    this.modifications.push({
      timestamp: new Date(),
      type: 'ota_modification',
      details: {
        amendmentApplied: true,
        originalData,
        appliedChanges: changes
      },
      source: 'ota',
      userName: 'OTA Amendment System'
    });
  
    return this;
  } catch (error) {
    throw new Error(`${error.message}`);
  }
};

// Import and integrate checkout automation middleware
import checkoutAutomationMiddleware from '../middleware/checkoutAutomationMiddleware.js';

// Modification audit trail -- track field-level changes on existing bookings
const AUDITABLE_FIELDS = [
  'checkIn', 'checkOut', 'rooms', 'totalAmount', 'status',
  'guestDetails', 'paymentStatus', 'cancellationReason',
  'extraPersons', 'extraPersonCharges'
];

bookingSchema.pre('save', function(next) {
  if (!this.isNew) {
    const changes = [];
    for (const field of AUDITABLE_FIELDS) {
      if (this.isModified(field)) {
        changes.push({
          field,
          oldValue: this._originalValues?.[field],
          newValue: this.get(field),
          displayField: field.replace(/([A-Z])/g, ' $1').trim()
        });
      }
    }
    if (changes.length > 0 && this.modificationHistory) {
      this.modificationHistory.push({
        modifiedBy: this._modifiedBy || { source: 'system' },
        fieldChanges: changes,
        reason: this._modificationReason || '',
        changeType: this._changeType || 'modification'
      });
    }
  }
  next();
});

// Add pre-save middleware to store previous status
bookingSchema.pre('save', checkoutAutomationMiddleware.bookingPreSaveMiddleware);

// Add post-save middleware to trigger automation
bookingSchema.post('save', checkoutAutomationMiddleware.bookingPostSaveMiddleware);

// Prevent zero-night bookings and NaN totalAmount
bookingSchema.pre('validate', function(next) {
  // Ensure nights >= 1
  if (this.isModified('checkIn') || this.isModified('checkOut')) {
    const timeDiff = new Date(this.checkOut).getTime() - new Date(this.checkIn).getTime();
    const nights = Math.ceil(timeDiff / (1000 * 3600 * 24));
    if (nights < 1) {
      return next(new Error('Booking must be at least 1 night'));
    }
  }
  // Prevent NaN or Infinity in totalAmount
  if (this.totalAmount !== undefined && !Number.isFinite(this.totalAmount)) {
    this.totalAmount = 0;
  }
  next();
});

export default mongoose.model('Booking', bookingSchema);
