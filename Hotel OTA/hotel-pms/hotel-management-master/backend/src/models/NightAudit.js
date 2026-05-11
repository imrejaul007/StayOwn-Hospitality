import mongoose from 'mongoose';

const nightAuditSchema = new mongoose.Schema({
  hotelId: { type: mongoose.Schema.ObjectId, ref: 'Hotel', required: true },
  auditDate: { type: Date, required: true },
  status: {
    type: String,
    enum: ['pending', 'in_progress', 'completed', 'failed', 'partially_completed'],
    default: 'pending'
  },
  startedAt: Date,
  completedAt: Date,
  initiatedBy: {
    type: String,
    enum: ['manual', 'scheduled'],
    default: 'scheduled'
  },
  initiatedByUser: { type: mongoose.Schema.ObjectId, ref: 'User' },
  steps: [{
    name: { type: String, required: true },
    status: { type: String, enum: ['pending', 'running', 'completed', 'failed', 'skipped'], default: 'pending' },
    startedAt: Date,
    completedAt: Date,
    result: mongoose.Schema.Types.Mixed,
    errors: [String],
    warnings: [String]
  }],
  summary: {
    roomInventory: {
      totalRooms: Number,
      occupied: Number,
      vacant: Number,
      outOfOrder: Number,
      discrepancies: Number
    },
    bookingReconciliation: {
      totalBookings: Number,
      confirmedArrivals: Number,
      actualArrivals: Number,
      noShows: Number,
      cancellations: Number,
      departures: Number,
      stayovers: Number
    },
    revenue: {
      roomRevenue: { type: Number, default: 0 },
      totalRevenue: { type: Number, default: 0 },
      journalEntriesCreated: { type: Number, default: 0 }
    },
    noShowProcessing: {
      detected: { type: Number, default: 0 },
      processed: { type: Number, default: 0 },
      chargesApplied: { type: Number, default: 0 }
    },
    settlement: {
      totalPaymentsReceived: { type: Number, default: 0 },
      totalChargesPosted: { type: Number, default: 0 },
      variance: { type: Number, default: 0 },
      unreconciledItems: { type: Number, default: 0 }
    }
  },
  locked: { type: Boolean, default: false },
  lockedAt: Date,
  lockedBy: { type: mongoose.Schema.ObjectId, ref: 'User' }
}, { timestamps: true });

nightAuditSchema.index({ hotelId: 1, auditDate: -1 }, { unique: true });

export default mongoose.model('NightAudit', nightAuditSchema);
