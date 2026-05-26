import logger from './utils/logger';

import { loadStripe, Stripe } from '@stripe/stripe-js';
import { api } from './api';

const STRIPE_PUBLISHABLE_KEY = import.meta.env.VITE_STRIPE_PUBLIC_KEY;
if (!STRIPE_PUBLISHABLE_KEY) {
  logger.error('VITE_STRIPE_PUBLIC_KEY environment variable is required');
}

let stripePromise: Promise<Stripe | null>;

export const getStripe = () => {
  if (!stripePromise) {
    stripePromise = loadStripe(STRIPE_PUBLISHABLE_KEY);
  }
  return stripePromise;
};

export interface ExtraPersonChargePayment {
  personId: string;
  amount: number;
  description: string;
}

export interface CreatePaymentIntentResponse {
  clientSecret: string;
  paymentIntentId: string;
  amount: number;
  currency: string;
}

export interface PaymentConfirmationResponse {
  paymentIntent: {
    id: string;
    status: string;
    amount: number;
    paymentType: string;
  };
}

class StripePaymentService {
  // Create payment intent for extra person charges
  async createExtraPersonChargesPaymentIntent(
    bookingId: string,
    extraPersonCharges: ExtraPersonChargePayment[],
    currency = 'INR'
  ): Promise<CreatePaymentIntentResponse> {
    try {
      const response = await api.post('/payments/extra-person-charges/intent', {
        bookingId,
        extraPersonCharges,
        currency
      });
      return response.data.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  // Create payment intent for settlement
  async createSettlementPaymentIntent(
    settlementId: string,
    amount: number,
    currency = 'INR',
    description?: string
  ): Promise<CreatePaymentIntentResponse> {
    try {
      const response = await api.post('/payments/settlement/intent', {
        settlementId,
        amount,
        currency,
        description
      });
      return response.data.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  // Confirm payment on server
  async confirmPayment(paymentIntentId: string): Promise<PaymentConfirmationResponse> {
    try {
      const response = await api.post('/payments/confirm', {
        paymentIntentId
      });
      return response.data.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  // Process extra person charges payment
  async processExtraPersonChargesPayment(
    bookingId: string,
    extraPersonCharges: ExtraPersonChargePayment[],
    paymentElement: unknown, // Stripe Payment Element
    currency = 'INR'
  ) {
    try {
      // Step 1: Create payment intent
      const { clientSecret, paymentIntentId, amount } = await this.createExtraPersonChargesPaymentIntent(
        bookingId,
        extraPersonCharges,
        currency
      );

      // Step 2: Get Stripe instance
      const stripe = await getStripe();
      if (!stripe) {
        throw new Error('Stripe failed to load');
      }

      // Step 3: Confirm payment with Stripe
      const { error, paymentIntent } = await stripe.confirmPayment({
        elements: paymentElement as Parameters<Stripe['confirmPayment']>[0]['elements'],
        clientSecret,
        confirmParams: {
          return_url: `${window.location.origin}/booking-success`, // Adjust as needed
        },
        redirect: 'if_required' // Don't redirect if not needed
      });

      if (error) {
        throw new Error(error.message);
      }

      // Step 4: Confirm on server if payment succeeded
      if (paymentIntent && paymentIntent.status === 'succeeded') {
        await this.confirmPayment(paymentIntent.id);
      }

      return {
        success: true,
        paymentIntent,
        amount,
        currency: currency.toUpperCase()
      };

    } catch (error: unknown) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Payment failed'
      };
    }
  }

  // Process settlement payment
  async processSettlementPayment(
    settlementId: string,
    amount: number,
    paymentElement: unknown, // Stripe Payment Element
    currency = 'INR',
    description?: string
  ) {
    try {
      // Step 1: Create payment intent
      const { clientSecret, paymentIntentId } = await this.createSettlementPaymentIntent(
        settlementId,
        amount,
        currency,
        description
      );

      // Step 2: Get Stripe instance
      const stripe = await getStripe();
      if (!stripe) {
        throw new Error('Stripe failed to load');
      }

      // Step 3: Confirm payment with Stripe
      const { error, paymentIntent } = await stripe.confirmPayment({
        elements: paymentElement as Parameters<Stripe['confirmPayment']>[0]['elements'],
        clientSecret,
        confirmParams: {
          return_url: `${window.location.origin}/settlement-success`, // Adjust as needed
        },
        redirect: 'if_required'
      });

      if (error) {
        throw new Error(error.message);
      }

      // Step 4: Confirm on server if payment succeeded
      if (paymentIntent && paymentIntent.status === 'succeeded') {
        await this.confirmPayment(paymentIntent.id);
      }

      return {
        success: true,
        paymentIntent,
        amount,
        currency: currency.toUpperCase()
      };

    } catch (error: unknown) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Payment failed'
      };
    }
  }

  // Create standard booking payment intent (existing functionality)
  async createBookingPaymentIntent(
    bookingId: string,
    amount?: number,
    currency = 'INR'
  ): Promise<CreatePaymentIntentResponse> {
    try {
      const response = await api.post('/payments/intent', {
        bookingId,
        amount,
        currency
      });
      return response.data.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  // Format amount for display
  formatAmount(amount: number, currency = 'INR'): string {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  }

  // Validate payment data
  validateExtraPersonCharges(charges: ExtraPersonChargePayment[]): boolean {
    if (!Array.isArray(charges) || charges.length === 0) {
      return false;
    }

    return charges.every(charge =>
      charge.personId &&
      typeof charge.amount === 'number' &&
      charge.amount > 0 &&
      charge.description
    );
  }

  validateSettlementPayment(amount: number): boolean {
    return typeof amount === 'number' && amount > 0;
  }
}

export const stripePaymentService = new StripePaymentService();