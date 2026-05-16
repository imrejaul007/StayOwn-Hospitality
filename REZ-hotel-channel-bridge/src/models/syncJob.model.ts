import mongoose, { Schema, Document, Model } from 'mongoose';
import { SyncStatus } from '../types/index.js';

export interface ISyncError {
  itemId: string;
  error: string;
  timestamp: Date;
}

export interface ISyncJobDocument extends Document {
  jobId: string;
  hotelId: string;
  channelId: string;
  syncType: string;
  status: string;
  startTime: Date;
  endTime?: Date;
  itemsProcessed: number;
  itemsFailed: number;
  errors: ISyncError[];
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

const SyncErrorSchema = new Schema<ISyncError>({
  itemId: { type: String, required: true },
  error: { type: String, required: true },
  timestamp: { type: Date, required: true }
}, { _id: false });

const SyncJobSchema = new Schema<ISyncJobDocument>(
  {
    jobId: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    hotelId: {
      type: String,
      required: true,
      index: true
    },
    channelId: {
      type: String,
      required: true,
      index: true
    },
    syncType: {
      type: String,
      enum: ['inventory', 'pricing', 'booking', 'full'],
      required: true,
      index: true
    },
    status: {
      type: String,
      enum: Object.values(SyncStatus),
      required: true,
      default: SyncStatus.PENDING,
      index: true
    },
    startTime: {
      type: Date,
      required: true
    },
    endTime: {
      type: Date
    },
    itemsProcessed: {
      type: Number,
      default: 0,
      min: 0
    },
    itemsFailed: {
      type: Number,
      default: 0,
      min: 0
    },
    errors: {
      type: [SyncErrorSchema],
      default: []
    },
    metadata: {
      type: Schema.Types.Mixed
    }
  },
  {
    timestamps: true,
    collection: 'sync_jobs'
  }
);

// Compound indexes
SyncJobSchema.index({ hotelId: 1, status: 1 });
SyncJobSchema.index({ channelId: 1, status: 1 });
SyncJobSchema.index({ startTime: -1 });
SyncJobSchema.index({ status: 1, startTime: -1 });

// TTL index to auto-delete old sync jobs (keep 90 days)
SyncJobSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: 7776000 }
);

export const SyncJob: Model<ISyncJobDocument> = mongoose.model<ISyncJobDocument>(
  'SyncJob',
  SyncJobSchema
);
