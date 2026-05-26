/**
 * Folio Model
 */

import mongoose, { Document, Schema } from 'mongoose';

export interface IFolio extends Document {
  hotelId: string;
  guestId: string;
  bookingId: string;
  folioNumber: string;
  status: 'open' | 'closed' | 'cancelled';
  items: {
    type: 'room' | 'food' | 'bar' | 'laundry' | 'spa' | 'parking' | 'other';
    description: string;
    amount: number;
    quantity: number;
    date: Date;
    postedBy?: string;
  }[];
  subtotal: number;
  taxes: number;
  discounts: number;
  total: number;
  payments: {
    method: 'cash' | 'card' | 'upi' | 'bank_transfer';
    amount: number;
    reference?: string;
    date: Date;
    processedBy?: string;
  }[];
  balanceDue: number;
  openedAt: Date;
  closedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const FolioSchema = new Schema<IFolio>({
  hotelId: { type: String, required: true, index: true },
  guestId: { type: String, required: true, index: true },
  bookingId: { type: String, required: true, index: true },
  folioNumber: { type: String, required: true, unique: true },
  status: { type: String, enum: ['open', 'closed', 'cancelled'], default: 'open' },
  items: [{
    type: { type: String, enum: ['room', 'food', 'bar', 'laundry', 'spa', 'parking', 'other'], required: true },
    description: { type: String, required: true },
    amount: { type: Number, required: true },
    quantity: { type: Number, default: 1 },
    date: { type: Date, default: Date.now },
    postedBy: String,
  }],
  subtotal: { type: Number, default: 0 },
  taxes: { type: Number, default: 0 },
  discounts: { type: Number, default: 0 },
  total: { type: Number, default: 0 },
  payments: [{
    method: { type: String, enum: ['cash', 'card', 'upi', 'bank_transfer'], required: true },
    amount: { type: Number, required: true },
    reference: String,
    date: { type: Date, default: Date.now },
    processedBy: String,
  }],
  balanceDue: { type: Number, default: 0 },
  openedAt: { type: Date, default: Date.now },
  closedAt: Date,
}, { timestamps: true });

FolioSchema.index({ hotelId: 1, guestId: 1 });
FolioSchema.index({ folioNumber: 1 }, { unique: true });

export const Folio = mongoose.model<IFolio>('Folio', FolioSchema);
