import mongoose from 'mongoose';

/**
 * @swagger
 * components:
 *   schemas:
 *     CheckoutInventory:
 *       type: object
 *       required:
 *         - bookingId
 *         - roomId
 *         - checkedBy
 *         - items
 *       properties:
 *         _id:
 *           type: string
 *         bookingId:
 *           type: string
 *           description: Booking ID
 *         roomId:
 *           type: string
 *           description: Room ID
 *         checkedBy:
 *           type: string
 *           description: Staff member who performed the check
 *         items:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               itemName:
 *                 type: string
 *               category:
 *                 type: string
 *               quantity:
 *                 type: number
 *               unitPrice:
 *                 type: number
 *               totalPrice:
 *                 type: number
 *               status:
 *                 type: string
 *                 enum: [intact, used, damaged, missing, consumed]
 *               notes:
 *                 type: string
 *         subtotal:
 *           type: number
 *         tax:
 *           type: number
 *         totalAmount:
 *           type: number
 *         status:
 *           type: string
 *           enum: [pending, completed, paid]
 *         paymentMethod:
 *           type: string
 *         paymentStatus:
 *           type: string
 *           enum: [pending, paid, failed]
 *         notes:
 *           type: string
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 */

const checkoutInventorySchema = new mongoose.Schema({
  hotelId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Hotel',
    required: true,
    index: true
  },
  bookingId: {
    type: mongoose.Schema.ObjectId,
    ref: 'Booking',
    required: [true, 'Booking ID is required'],
    index: true
  },
  roomId: {
    type: mongoose.Schema.ObjectId,
    ref: 'Room',
    required: [true, 'Room ID is required'],
    index: true
  },
  checkedBy: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: [true, 'Staff member ID is required']
  },
  items: [{
    itemName: {
      type: String,
      required: true
    },
    category: {
      type: String,
      required: true,
      enum: ['bathroom', 'bedroom', 'kitchen', 'electronics', 'furniture', 'other']
    },
    quantity: {
      type: Number,
      required: true,
      min: 0,
      default: 1
    },
    unitPrice: {
      type: Number,
      required: true,
      min: 0
    },
    totalPrice: {
      type: Number,
      required: true,
      min: 0
    },
    status: {
      type: String,
      enum: ['intact', 'used', 'damaged', 'missing', 'consumed'],
      default: 'intact'
    },
    notes: {
      type: String,
      maxlength: 200
    }
  }],
  subtotal: {
    type: Number,
    required: true,
    min: 0,
    default: 0
  },
  tax: {
    type: Number,
    required: true,
    min: 0,
    default: 0
  },
  totalAmount: {
    type: Number,
    required: true,
    min: 0,
    default: 0
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'paid'],
    default: 'pending'
  },
  paymentMethod: {
    type: String,
    enum: ['cash', 'card', 'upi', 'bank_transfer'],
    default: 'cash'
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'paid', 'failed'],
    default: 'pending'
  },
  notes: {
    type: String,
    maxlength: 500
  },
  checkedAt: {
    type: Date,
    default: Date.now
  },
  paidAt: {
    type: Date
  },
  isAdminBypass: {
    type: Boolean,
    default: false
  },
  // Settlement integration fields
  settlementId: {
    type: mongoose.Schema.ObjectId,
    ref: 'Settlement'
  },
  settlementStatus: {
    type: String,
    enum: ['pending', 'integrated', 'settled'],
    default: 'pending'
  },
  integratedAt: Date
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Calculate totals before saving
checkoutInventorySchema.pre('save', function(next) {
  // Calculate subtotal
  this.subtotal = this.items.reduce((sum, item) => {
    return sum + (item.totalPrice || 0);
  }, 0);

  // Calculate tax (18% GST)
  this.tax = Math.round(this.subtotal * 0.18);

  // Calculate total amount
  this.totalAmount = this.subtotal + this.tax;

  next();
});

// Virtual for formatted total amount
checkoutInventorySchema.virtual('formattedTotalAmount').get(function() {
  return `₹${this.totalAmount.toLocaleString('en-IN')}`;
});

// Virtual for formatted subtotal
checkoutInventorySchema.virtual('formattedSubtotal').get(function() {
  return `₹${this.subtotal.toLocaleString('en-IN')}`;
});

// Virtual for formatted tax
checkoutInventorySchema.virtual('formattedTax').get(function() {
  return `₹${this.tax.toLocaleString('en-IN')}`;
});

// Static method to get checkout inventory by booking
checkoutInventorySchema.statics.findByBooking = function(bookingId) {
  return this.findOne({ bookingId }).populate([
    { path: 'bookingId', select: 'bookingNumber checkIn checkOut totalAmount' },
    { path: 'roomId', select: 'roomNumber type' },
    { path: 'checkedBy', select: 'name email' }
  ]);
};

// Static method to get all checkout inventories for a hotel (paginated)
checkoutInventorySchema.statics.findByHotel = function(hotelId, { page = 1, limit = 20 } = {}) {
  const skip = (Math.max(1, page) - 1) * Math.min(limit, 100);
  return this.find({ hotelId })
    .populate([
      { path: 'bookingId', select: 'bookingNumber checkIn checkOut totalAmount userId' },
      { path: 'roomId', select: 'roomNumber type' },
      { path: 'checkedBy', select: 'name email' }
    ])
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(Math.min(limit, 100))
    .lean();
};

// Settlement integration methods

// Method to check if checkout has chargeable items
checkoutInventorySchema.methods.hasChargeableItems = function() {
  return this.items.some(item =>
    (['damaged', 'missing', 'consumed'].includes(item.status)) && item.totalPrice > 0
  );
};

// Method to get chargeable items for settlement
checkoutInventorySchema.methods.getChargeableItemsForSettlement = function() {
  const chargeTypeMap = {
    damaged: 'damage_charge',
    missing: 'missing_item_charge',
    consumed: 'consumption_charge'
  };
  return this.items
    .filter(item => (['damaged', 'missing', 'consumed'].includes(item.status)) && item.totalPrice > 0)
    .map(item => ({
      itemName: item.itemName,
      category: item.category,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      totalPrice: item.totalPrice,
      status: item.status,
      notes: item.notes,
      chargeType: chargeTypeMap[item.status] || 'other_charge'
    }));
};

// Method to mark as integrated with settlement
checkoutInventorySchema.methods.markAsIntegrated = function(settlementId) {
  this.settlementId = settlementId;
  this.settlementStatus = 'integrated';
  this.integratedAt = new Date();
  return this;
};

// Method to get checkout summary for settlement integration
checkoutInventorySchema.methods.getSettlementSummary = function() {
  const chargeableItems = this.getChargeableItemsForSettlement();

  return {
    checkoutId: this._id,
    bookingId: this.bookingId,
    roomId: this.roomId,
    totalAmount: this.totalAmount,
    subtotal: this.subtotal,
    tax: this.tax,
    chargeableItemsCount: chargeableItems.length,
    chargeableItems,
    status: this.status,
    settlementStatus: this.settlementStatus,
    settlementId: this.settlementId,
    checkedAt: this.checkedAt,
    integratedAt: this.integratedAt,
    hasCharges: this.hasChargeableItems()
  };
};

// Static method to find checkouts ready for settlement integration
checkoutInventorySchema.statics.findReadyForSettlement = async function(hotelId, bookingId = null) {
  try {
    if (!hotelId) throw new Error('hotelId is required');

    const query = {
      hotelId,
      status: 'completed',
      settlementStatus: 'pending',
      totalAmount: { $gt: 0 }
    };

    if (bookingId) {
      query.bookingId = bookingId;
    }

    const results = await this.find(query)
      .populate([
        { path: 'bookingId', select: 'bookingNumber checkIn checkOut totalAmount hotelId' },
        { path: 'roomId', select: 'roomNumber type' },
        { path: 'checkedBy', select: 'name email' }
      ])
      .sort({ createdAt: -1 })
      .limit(100);

    // Use instance method (not lean) to check chargeable items
    return results.filter(result =>
      result.bookingId && result.hasChargeableItems()
    );
  } catch (error) {
    throw new Error(`${error.message}`);
  }
};

// Static method to get checkout integration statistics
checkoutInventorySchema.statics.getCheckoutIntegrationStats = async function(hotelId, dateRange = {}) {
  try {
    if (!hotelId) throw new Error('hotelId is required');

    // Always filter by hotelId first for tenant isolation and index efficiency
    const matchStage = { hotelId };

    if (dateRange.start || dateRange.end) {
      matchStage.checkedAt = {};
      if (dateRange.start) matchStage.checkedAt.$gte = new Date(dateRange.start);
      if (dateRange.end) matchStage.checkedAt.$lte = new Date(dateRange.end);
    }

    const pipeline = [
      { $match: matchStage },
      {
        $group: {
          _id: '$settlementStatus',
          count: { $sum: 1 },
          totalAmount: { $sum: '$totalAmount' },
          avgAmount: { $avg: '$totalAmount' }
        }
      },
      {
        $group: {
          _id: null,
          byStatus: {
            $push: {
              status: '$_id',
              count: '$count',
              totalAmount: '$totalAmount',
              avgAmount: '$avgAmount'
            }
          },
          totalCheckouts: { $sum: '$count' },
          totalCharges: { $sum: '$totalAmount' }
        }
      }
    ];

    return await this.aggregate(pipeline);
  } catch (error) {
    throw new Error(`${error.message}`);
  }
};

// Compound indexes for performance
checkoutInventorySchema.index({ hotelId: 1, createdAt: -1 });
checkoutInventorySchema.index({ hotelId: 1, bookingId: 1 });
// Unique guard: prevent duplicate inventory checks per booking+room per hotel
checkoutInventorySchema.index({ hotelId: 1, bookingId: 1, roomId: 1 }, { unique: true });

export default mongoose.model('CheckoutInventory', checkoutInventorySchema);
