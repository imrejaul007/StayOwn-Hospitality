import mongoose from 'mongoose';

const stripeWebhookEventSchema = new mongoose.Schema({
  provider: {
    type: String,
    default: 'stripe',
    index: true
  },
  eventId: {
    type: String,
    required: true
  },
  eventType: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['processing', 'processed', 'failed'],
    default: 'processing',
    index: true
  },
  attempts: {
    type: Number,
    default: 1
  },
  firstSeenAt: {
    type: Date,
    default: Date.now
  },
  processedAt: Date,
  lastError: String
}, { timestamps: true });

stripeWebhookEventSchema.index({ provider: 1, eventId: 1 }, { unique: true });

const StripeWebhookEvent = mongoose.model('StripeWebhookEvent', stripeWebhookEventSchema);

export default StripeWebhookEvent;
