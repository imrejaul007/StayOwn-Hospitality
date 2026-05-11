import mongoose from 'mongoose';

const inventorySchema = new mongoose.Schema({
  hotelId: {
    type: mongoose.Schema.ObjectId,
    ref: 'Hotel',
    required: true,
    index: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  sku: {
    type: String,
    required: true
    // NOTE: unique constraint is handled by the compound index { hotelId: 1, sku: 1 } below
    // to allow different hotels to use the same SKU codes
  },
  category: {
    type: String,
    enum: ['linens', 'toiletries', 'cleaning', 'maintenance', 'food_beverage', 'other'],
    required: true
  },
  quantity: {
    type: Number,
    required: true,
    min: 0
  },
  unit: {
    type: String,
    enum: ['pieces', 'bottles', 'rolls', 'kg', 'liters', 'sets'],
    default: 'pieces'
  },
  minimumThreshold: {
    type: Number,
    required: true,
    min: 0
  },
  maximumCapacity: {
    type: Number,
    required: true
  },
  costPerUnit: {
    type: Number,
    min: 0
  },
  supplier: {
    name: String,
    contact: String,
    email: String
  },
  location: {
    building: String,
    floor: String,
    room: String,
    shelf: String
  },
  requests: [{
    userId: {
      type: mongoose.Schema.ObjectId,
      ref: 'User',
      required: true
    },
    quantity: {
      type: Number,
      required: true
    },
    reason: String,
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'fulfilled'],
      default: 'pending'
    },
    approvedBy: {
      type: mongoose.Schema.ObjectId,
      ref: 'User'
    },
    requestedAt: {
      type: Date,
      default: Date.now
    },
    processedAt: Date
  }],
  lastRestocked: Date,
  expiryDate: Date,
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes - compound unique index on hotelId+sku so each hotel has unique SKUs
inventorySchema.index({ hotelId: 1, sku: 1 }, { unique: true });
inventorySchema.index({ hotelId: 1, category: 1 });
inventorySchema.index({ hotelId: 1, quantity: 1 });

// Virtual for low stock status
inventorySchema.virtual('isLowStock').get(function() {
  return this.quantity <= this.minimumThreshold;
});

export default mongoose.model('Inventory', inventorySchema);
