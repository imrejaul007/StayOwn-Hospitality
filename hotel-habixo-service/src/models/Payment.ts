import mongoose, { Schema, Document } from 'mongoose';

export type PaymentStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'refunded' | 'cancelled';
export type PaymentMethod = 'card' | 'upi' | 'netbanking' | 'wallet' | 'razorpay';

export interface IPayment extends Document {
  paymentId: string;
  bookingId: string;
  userId: string;
  amount: number;
  currency: string;
  method: PaymentMethod;
  status: PaymentStatus;
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  razorpaySignature?: string;
  failureReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const PaymentSchema = new Schema<IPayment>(
  {
    paymentId: { type: String, required: true, unique: true },
    bookingId: { type: String, required: true, index: true },
    userId: { type: String, required: true, index: true },
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, default: 'INR' },
    method: {
      type: String,
      required: true,
      enum: ['card', 'upi', 'netbanking', 'wallet', 'razorpay'],
    },
    status: {
      type: String,
      required: true,
      enum: ['pending', 'processing', 'completed', 'failed', 'refunded', 'cancelled'],
      default: 'pending',
      index: true,
    },
    razorpayOrderId: { type: String, sparse: true },
    razorpayPaymentId: { type: String, sparse: true },
    razorpaySignature: { type: String },
    failureReason: { type: String },
  },
  { timestamps: true }
);

// Indexes
PaymentSchema.index({ paymentId: 1 }, { unique: true });
PaymentSchema.index({ bookingId: 1, status: 1 });
PaymentSchema.index({ userId: 1, status: 1 });
PaymentSchema.index({ razorpayOrderId: 1 }, { sparse: true });
PaymentSchema.index({ razorpayPaymentId: 1 }, { sparse: true });
PaymentSchema.index({ createdAt: -1, status: 1 });

export const Payment = mongoose.model<IPayment>('Payment', PaymentSchema);
