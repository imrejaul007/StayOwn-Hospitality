import React, { useState, useEffect, useRef} from 'react';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { CreditCard, AlertTriangle, CheckCircle, Loader2 } from 'lucide-react';
import { getStripe, stripePaymentService, ExtraPersonChargePayment } from '../../services/stripePaymentService';

interface PaymentFormProps {
  bookingId: string;
  extraPersonCharges: ExtraPersonChargePayment[];
  onSuccess: () => void;
  onCancel: () => void;
}

function PaymentForm({ bookingId, extraPersonCharges, onSuccess, onCancel }: PaymentFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paymentSuccessful, setPaymentSuccessful] = useState(false);

  const totalAmount = extraPersonCharges.reduce((sum, charge) => sum + charge.amount, 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      setError('Stripe has not loaded yet. Please try again.');
      return;
    }

    if (!stripePaymentService.validateExtraPersonCharges(extraPersonCharges)) {
      setError('Invalid extra person charge data');
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      // Since we already have the clientSecret and PaymentIntent, just confirm the payment
      const { error } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/booking-success`,
        },
        redirect: 'if_required'
      });

      if (error) {
        setError(error.message ?? 'Payment failed');
        return;
      }

      const result = { success: true };

      if (result.success) {
        setPaymentSuccessful(true);
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => {
          onSuccess();
        }, 2000);
      } else {
        setError(result.error || 'Payment failed');
      }
    } catch (err: unknown) {
      setError(err.message || 'An unexpected error occurred');
    if (timerRef.current) clearTimeout(timerRef.current);
    } finally {
      setIsProcessing(false);
    }
  };

  if (paymentSuccessful) {
    return (
      <div className="text-center py-8">
        <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
        <h3 className="text-2xl font-semibold text-gray-900 mb-2">Payment Successful!</h3>
        <p className="text-gray-600">
          Extra person charges of {stripePaymentService.formatAmount(totalAmount)} have been processed.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
        <h3 className="font-semibold text-gray-900 mb-3">Payment Summary</h3>
        <div className="space-y-2">
          {extraPersonCharges.map((charge, index) => (
            <div key={charge.personId || index} className="flex justify-between text-sm">
              <span className="text-gray-600">{charge.description}</span>
              <span className="font-medium">{stripePaymentService.formatAmount(charge.amount)}</span>
            </div>
          ))}
          <div className="border-t border-blue-300 pt-2 mt-3">
            <div className="flex justify-between font-semibold">
              <span>Total Amount:</span>
              <span className="text-blue-600">{stripePaymentService.formatAmount(totalAmount)}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="font-semibold text-gray-900 flex items-center gap-2">
          <CreditCard className="w-5 h-5" />
          Payment Information
        </h3>

        <PaymentElement
          options={{
            layout: 'tabs',
            paymentMethodOrder: ['card']
          }}
        />
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0" />
          <p className="text-red-700">{error}</p>
        </div>
      )}

      <div className="flex gap-3 pt-4">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          disabled={isProcessing}
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={!stripe || isProcessing}
          className="flex-1 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
        >
          {isProcessing ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Processing...
            </>
          ) : (
            <>Pay {stripePaymentService.formatAmount(totalAmount)}</>
          )}
        </button>
      </div>
    </form>
  );
}

interface ExtraPersonChargesPaymentProps {
  isOpen: boolean;
  onClose: () => void;
  bookingId: string;
  extraPersonCharges: ExtraPersonChargePayment[];
  onPaymentSuccess?: () => void;
}

export function ExtraPersonChargesPayment({
  isOpen,
  onClose,
  bookingId,
  extraPersonCharges,
  onPaymentSuccess
}: ExtraPersonChargesPaymentProps) {
  const [stripePromise, setStripePromise] = useState<unknown>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  useEffect(() => {
    setStripePromise(getStripe());
  }, []);

  useEffect(() => {
    if (isOpen && extraPersonCharges.length > 0) {
      initializePayment();
    }
  }, [isOpen, extraPersonCharges]);

  const initializePayment = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Create PaymentIntent to get clientSecret
      const paymentIntent = await stripePaymentService.createExtraPersonChargesPaymentIntent(
        bookingId,
        extraPersonCharges
      );

      setClientSecret(paymentIntent.clientSecret);
    } catch (err: unknown) {
      setError(err.message || 'Failed to initialize payment');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSuccess = () => {
    if (onPaymentSuccess) {
      onPaymentSuccess();
    }
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:p-0">
        <div aria-hidden="true" className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75" onClick={onClose} />

        <div className="relative inline-block w-full max-w-2xl p-6 overflow-hidden text-left align-bottom transition-all transform bg-white shadow-xl rounded-lg sm:my-8 sm:align-middle">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-gray-900">Process Extra Person Charges</h2>
            <p className="text-gray-600 mt-2">
              Securely process payment for additional guests using Stripe.
            </p>
          </div>

          {isLoading ? (
            <div className="text-center py-8">
              <Loader2 className="w-8 h-8 text-blue-500 mx-auto mb-4 animate-spin" />
              <p className="text-gray-600">Initializing payment...</p>
            </div>
          ) : error ? (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0" />
              <div>
                <p className="text-red-700">{error}</p>
                <button
                  onClick={initializePayment}
                  className="text-red-600 underline mt-1 text-sm hover:text-red-700"
                >
                  Try again
                </button>
              </div>
            </div>
          ) : stripePromise && clientSecret ? (
            <Elements
              stripe={stripePromise}
              options={{
                clientSecret,
                appearance: {
                  theme: 'stripe',
                  variables: {
                    colorPrimary: '#2563eb',
                    colorBackground: '#ffffff',
                    colorText: '#1f2937',
                    colorDanger: '#dc2626',
                    fontFamily: 'Inter, system-ui, sans-serif',
                    spacingUnit: '4px',
                    borderRadius: '8px'
                  }
                }
              }}
            >
              <PaymentForm
                bookingId={bookingId}
                extraPersonCharges={extraPersonCharges}
                onSuccess={handleSuccess}
                onCancel={onClose}
              />
            </Elements>
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-600">Unable to initialize payment</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}