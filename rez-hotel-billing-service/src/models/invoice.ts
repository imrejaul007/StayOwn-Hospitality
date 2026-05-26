/**
 * Invoice Model
 */

import mongoose, { Document, Schema } from 'mongoose';

export interface IInvoice extends Document {
  hotelId: string;
  guestId: string;
  invoiceNumber: string;
  folioId: string;
  guestName: string;
  guestEmail?: string;
  guestAddress?: string;
  items: {
    description: string;
    amount: number;
    taxRate?: number;
    taxAmount?: number;
  }[];
  subtotal: number;
  taxTotal: number;
  discountTotal: number;
  total: number;
  amountPaid: number;
  balanceDue: number;
  status: 'draft' | 'issued' | 'paid' | 'cancelled' | 'refunded';
  issuedAt: Date;
  dueDate: Date;
  paidAt?: Date;
  paymentMethod?: string;
  paymentReference?: string;
  gstNumber?: string;
  createdAt: Date;
  updatedAt: Date;
}

const InvoiceSchema = new Schema<IInvoice>({
  hotelId: { type: String, required: true, index: true },
  guestId: { type: String, required: true, index: true },
  invoiceNumber: { type: String, required: true, unique: true },
  folioId: { type: String, required: true },
  guestName: { type: String, required: true },
  guestEmail: String,
  guestAddress: String,
  items: [{
    description: { type: String, required: true },
    amount: { type: Number, required: true },
    taxRate: Number,
    taxAmount: Number,
  }],
  subtotal: { type: Number, required: true },
  taxTotal: { type: Number, default: 0 },
  discountTotal: { type: Number, default: 0 },
  total: { type: Number, required: true },
  amountPaid: { type: Number, default: 0 },
  balanceDue: { type: Number, required: true },
  status: {
    type: String,
    enum: ['draft', 'issued', 'paid', 'cancelled', 'refunded'],
    default: 'draft',
  },
  issuedAt: Date,
  dueDate: Date,
  paidAt: Date,
  paymentMethod: String,
  paymentReference: String,
  gstNumber: String,
}, { timestamps: true });

InvoiceSchema.index({ hotelId: 1, status: 1 });
InvoiceSchema.index({ invoiceNumber: 1 }, { unique: true });

export const Invoice = mongoose.model<IInvoice>('Invoice', InvoiceSchema);
