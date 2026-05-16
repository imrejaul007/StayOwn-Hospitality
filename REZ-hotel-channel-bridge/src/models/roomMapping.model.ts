import mongoose, { Schema, Document, Model } from 'mongoose';
import { IRoomMapping, RoomType } from '../types/index.js';

export interface IRoomMappingDocument extends Omit<IRoomMapping, 'roomType'>, Document {
  roomType: string;
  createdAt: Date;
  updatedAt: Date;
}

const RoomMappingSchema = new Schema<IRoomMappingDocument>(
  {
    mappingId: {
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
    internalRoomId: {
      type: String,
      required: true
    },
    channelRoomId: {
      type: String,
      required: true
    },
    roomType: {
      type: String,
      enum: Object.values(RoomType),
      required: true
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true
    },
    syncAvailability: {
      type: Boolean,
      default: true
    },
    syncPricing: {
      type: Boolean,
      default: true
    },
    syncRestrictions: {
      type: Boolean,
      default: true
    }
  },
  {
    timestamps: true,
    collection: 'room_mappings'
  }
);

// Compound indexes
RoomMappingSchema.index({ hotelId: 1, channelId: 1 });
RoomMappingSchema.index({ internalRoomId: 1, channelId: 1 });
RoomMappingSchema.index({ channelRoomId: 1, channelId: 1 });

export const RoomMapping: Model<IRoomMappingDocument> = mongoose.model<IRoomMappingDocument>(
  'RoomMapping',
  RoomMappingSchema
);
