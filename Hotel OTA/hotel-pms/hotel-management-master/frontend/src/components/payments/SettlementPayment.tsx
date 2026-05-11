import React, { useState, useEffect, useRef} from 'react';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { CreditCard, AlertTriangle, CheckCircle, Loader2, Receipt } from 'lucide-react';
import { getStripe, stripePaymentService } from '../../services/stripePaymentService';

interface Settlement {
  _id: string;
  bookingId: {
    _id: string;
    bookingNumber: string;
  };
  finalAmount: number;
  outstandingBalance: number;
  status: string;
  description?: string;
}

interface PaymentFormProps {
  settlement: Settlement;
  paymentAmount: number;
  description?: string;
  onSuccess: () => void;
  onCancel: () => void;
}

function PaymentForm({ settlement, paymentAmount, description, onSuccess, onCancel }: PaymentFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paymentSuccessful, setPaymentSuccessful] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      setError('Stripe has not loaded yet. Please try again.');
      return;
    }

    if (!stripePaymentService.validateSettlementPayment(paymentAmount)) {
      setError('Invalid payment amount');
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      const result = await stripePaymentService.processSettlementPayment(
        settlement._id,
        paymentAmount,
        elements,
        'INR',
        description
      );

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
          Settlement payment of {stripePaymentService.formatAmount(paymentAmount)} has been processed.
        </p>
        <p className="text-sm text-gray-500 mt-2">
          Booking: {settlement.bookingId.bookingNumber}
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="bg-green-50 rounded-lg p-4 border border-green-200">
        <div className="flex items-center gap-2 mb-3">
          <Receipt className="w-5 h-5 text-green-600" />
          <h3 className="font-semibold text-gray-900">Settlement Payment</h3>
        </div>

        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">Booking Number:</span>
            <span className="font-medium">{settlement.bookingId.bookingNumber}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Total Settlement Amount:</span>
            <span className="font-medium">{stripePaymentService.formatAmount(settlement.finalAmount)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Outstanding Balance:</span>
            <span className="font-medium text-orange-600">
              {stripePaymentService.formatAmount(settlement.outstandingBalance)}
            </span>
          </div>
          <div className="border-t border-green-300 pt-2 mt-3">
            <div className="flex justify-between font-semibold">
              <span>Payment Amount:</span>
              <span className="text-green-600">{stripePaymentService.formatAmount(paymentAmount)}</span>
            </div>
          </div>
          {description && (
            <div className="mt-2 p-2 bg-gray-50 rounded text-gray-700">
              <span className="font-medium">Note:</span> {description}
            </div>
          )}
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
          className="flex-1 bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
        >
          {isProcessing ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Processing...
            </>
          ) : (
            <>Pay {stripePaymentService.formatAmount(paymentAmount)}</>
          )}
        </button>
      </div>
    </form>
  );
}

interface SettlementPaymentProps {
  isOpen: boolean;
  onClose: () => void;
  settlement: Settlement;
  paymentAmount?: number; // If not provided, uses outstanding balance
  description?: string;
  onPaymentSuccess?: () => void;
}

export function SettlementPayment({
  isOpen,
  onClose,
  settlement,
  paymentAmount,
  description,
  onPaymentSuccess
}: SettlementPaymentProps) {
  const [stripePromise, setStripePromise] = useState<unknown>(null);
  const [customAmount, setCustomAmount] = useState<number>(0);
  const [customDescription, setCustomDescription] = useState(description || '');
  const [showCustomAmount, setShowCustomAmount] = useState(false);

  const effectiveAmount = paymentAmount || settlement.outstandingBalance;

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  useEffect(() => {
    setStripePromise(getStripe());
    setCustomAmount(effectiveAmount);
  }, [effectiveAmount]);

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
            <h2 className="text-2xl font-bold text-gray-900">Process Settlement Payment</h2>
            <p className="text-gray-600 mt-2">
              Securely process settlement payment for booking {settlement.bookingId.bookingNumber}.
            </p>
          </div>

          {/* Payment Amount Options */}
          {!paymentAmount && settlement.outstandingBalance > 0 && (
            <div className="mb-6 p-4 bg-gray-50 rounded-lg">
              <h3 className="font-medium text-gray-900 mb-3">Payment Amount</h3>
              <div className="space-y-3">
                <label className="flex items-center">
                  <input
                    type="radio"
                    checked={!showCustomAmount}
                    onChange={() => {
                      setShowCustomAmount(false);
                      setCustomAmount(settlement.outstandingBalance);
                    }}
                    className="mr-2"
                  />
                  <span>Full outstanding balance: {stripePaymentService.formatAmount(settlement.outstandingBalance)}</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    checked={showCustomAmount}
                    onChange={() => setShowCustomAmount(true)}
                    className="mr-2"
                  />
                  <span>Custom amount</span>
                </label>
                {showCustomAmount && (
                  <div className="ml-6 flex items-center gap-2">
                    <span>₹</span>
                    <input
                      type="number"
                      value={customAmount}
                      onChange={(e) => setCustomAmount(parseFloat(e.target.value) || 0)}
                      min="1"
                      max={settlement.outstandingBalance}
                      className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                      placeholder="Enter amount"
                      required
                    />
                  </div>
                )}
              </div>

              <div className="mt-3">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Payment Description (Optional)
                </label>
                <input
                  type="text"
                  value={customDescription}
                  onChange={(e) => setCustomDescription(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  placeholder="e.g., Partial payment, Late checkout fee, etc."
                />
              </div>
            </div>
          )}

          {stripePromise && (
            <Elements
              stripe={stripePromise}
              options={{
                appearance: {
                  theme: 'stripe',
                  variables: {
                    colorPrimary: '#059669',
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
                settlement={settlement}
                paymentAmount={customAmount}
                description={customDescription}
                onSuccess={handleSuccess}
                onCancel={onClose}
              />
            </Elements>
          )}
        </div>
      </div>
    </div>
  );
}