import mongoose, { Schema, Document, Model } from 'mongoose';
import { IChannelConfig, ChannelType } from '../types/index.js';

export interface IChannelConfigDocument extends Omit<IChannelConfig, 'metadata'>, Document {
  metadata?: Record<string, any>;
  lastSyncAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ChannelConfigSchema = new Schema<IChannelConfigDocument>(
  {
    channelId: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    channelType: {
      type: String,
      enum: Object.values(ChannelType),
      required: true,
      index: true
    },
    name: {
      type: String,
      required: true,
      maxlength: 100,
      trim: true
    },
    apiEndpoint: {
      type: String,
      required: true
    },
    apiKey: {
      type: String,
      select: false
    },
    apiSecret: {
      type: String,
      select: false
    },
    propertyId: {
      type: String,
      required: true,
      index: true
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true
    },
    webhookUrl: {
      type: String
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {}
    },
    lastSyncAt: {
      type: Date
    }
  },
  {
    timestamps: true,
    collection: 'channel_configs'
  }
);

// Compound indexes
ChannelConfigSchema.index({ channelType: 1, isActive: 1 });
ChannelConfigSchema.index({ propertyId: 1, channelType: 1 });

export const ChannelConfig: Model<IChannelConfigDocument> = mongoose.model<IChannelConfigDocument>(
  'ChannelConfig',
  ChannelConfigSchema
);
