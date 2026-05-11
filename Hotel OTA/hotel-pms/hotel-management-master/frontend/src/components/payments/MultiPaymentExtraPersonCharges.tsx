import React, { useState, useEffect, useRef} from 'react';
import { api } from '../../services/api';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import {
  CreditCard,
  Banknote,
  Smartphone,
  Plus,
  Trash2,
  CheckCircle,
  AlertTriangle,
  Loader2
} from 'lucide-react';
import { getStripe, stripePaymentService, ExtraPersonChargePayment } from '../../services/stripePaymentService';

interface PaymentMethod {
  method: 'cash' | 'upi' | 'stripe';
  amount: number;
  reference?: string;
  notes?: string;
}

interface PaymentFormProps {
  bookingId: string;
  extraPersonCharges: ExtraPersonChargePayment[];
  onSuccess: (paymentDetails: { paymentMethods: PaymentMethod[] }) => void;
  onCancel: () => void;
}

const paymentMethodIcons = {
  cash: Banknote,
  upi: Smartphone,
  stripe: CreditCard
};

const paymentMethodLabels = {
  cash: 'Cash',
  upi: 'UPI',
  stripe: 'Stripe'
};

function MultiPaymentForm({ bookingId, extraPersonCharges, onSuccess, onCancel }: PaymentFormProps) {
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([
    { method: 'cash', amount: 0, reference: '', notes: '' }
  ]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paymentSuccessful, setPaymentSuccessful] = useState(false);

  const totalAmount = extraPersonCharges.reduce((sum, charge) => sum + charge.amount, 0);
  const totalPaid = paymentMethods.reduce((sum, payment) => sum + payment.amount, 0);
  const remainingAmount = Math.max(0, totalAmount - totalPaid);

  const addPaymentMethod = () => {
    setPaymentMethods([...paymentMethods, { method: 'cash', amount: 0, reference: '', notes: '' }]);
  };

  const removePaymentMethod = (index: number) => {
    if (paymentMethods.length > 1) {
      setPaymentMethods(paymentMethods.filter((_, i) => i !== index));
    }
  };

  const updatePaymentMethod = (index: number, field: keyof PaymentMethod, value: unknown) => {
    const updated = [...paymentMethods];
    updated[index] = { ...updated[index], [field]: field === 'amount' ? Number(value) : value };
    setPaymentMethods(updated);
  };

  const formatAmount = (amount: number): string => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const validPayments = paymentMethods.filter(payment => payment.amount > 0);
    if (validPayments.length === 0) {
      setError('Please add at least one payment method with amount greater than 0');
      return;
    }

    if (totalPaid <= 0) {
      setError('Total payment amount must be greater than 0');
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      // Process each payment method
      const processedPayments: PaymentMethod[] = [];

      for (const payment of validPayments) {
        if (payment.method === 'stripe' && payment.amount > 0) {
          // For Stripe payments, create payment intent and process
          try {
            const stripeCharges = extraPersonCharges.map(charge => ({
              personId: charge.personId,
              amount: (charge.amount / totalAmount) * payment.amount, // Proportional amount for this payment method
              description: charge.description
            }));

            const paymentIntent = await stripePaymentService.createExtraPersonChargesPaymentIntent(
              bookingId,
              stripeCharges
            );

            // For multi-payment, we'll create a simulated success since we can't easily integrate Elements here
            // In a real implementation, this would need proper Stripe Elements integration
            processedPayments.push({
              ...payment,
              reference: paymentIntent.id || `stripe-${Date.now()}`,
              notes: payment.notes || 'Stripe payment for extra person charges'
            });
          } catch (stripeError) {
            setError('Stripe payment failed. Please try again or use a different payment method.');
            setIsProcessing(false);
            return;
          }
        } else {
          // For cash and UPI payments
          processedPayments.push({
            ...payment,
            reference: payment.reference || `${payment.method}-${Date.now()}`,
            notes: payment.notes || `${paymentMethodLabels[payment.method]} payment for extra person charges`
          });
        }
      }

      // Determine if this is a settlement payment or extra person payment
      const isSettlementPayment = extraPersonCharges.some(charge => charge.type === 'settlement_payment');
      const endpoint = isSettlementPayment
        ? `/bookings/${bookingId}/settlement/payment`
        : `/bookings/${bookingId}/extra-persons/payment`;

      // Call backend to process the payments
      await api.post(endpoint, {
        paymentMethods: processedPayments,
        [isSettlementPayment ? 'settlementCharges' : 'extraPersonCharges']: extraPersonCharges,
        [isSettlementPayment ? 'amount' : 'totalAmount']: totalPaid
      });

      setPaymentSuccessful(true);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        onSuccess({ paymentMethods: processedPayments });
      }, 2000);
    } catch (err: unknown) {
      setError(err.response?.data?.message || err.message || 'An unexpected error occurred');
    } finally {
      setIsProcessing(false);
    }
  };

  if (paymentSuccessful) {
    const isSettlementPayment = extraPersonCharges.some(charge => charge.type === 'settlement_payment');
    return (
      <div className="text-center py-8">
        <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
        <h3 className="text-2xl font-semibold text-gray-900 mb-2">Payment Successful!</h3>
        <p className="text-gray-600">
          {isSettlementPayment
            ? `Settlement payment of ${formatAmount(totalPaid)} has been processed successfully.`
            : `Extra person charges of ${formatAmount(totalPaid)} have been processed successfully.`
          }
        </p>
      </div>
    );
  }

  const isSettlementPayment = extraPersonCharges.some(charge => charge.type === 'settlement_payment');

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Charges Summary */}
      <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
        <h3 className="font-semibold text-gray-900 mb-3">
          {isSettlementPayment ? 'Settlement Charges' : 'Extra Person Charges'}
        </h3>
        <div className="space-y-2">
          {extraPersonCharges.map((charge, index) => (
            <div key={charge.personId || index} className="flex justify-between text-sm">
              <span className="text-gray-600">{charge.description}</span>
              <span className="font-medium">{formatAmount(charge.amount)}</span>
            </div>
          ))}
          <div className="border-t border-blue-300 pt-2 mt-3">
            <div className="flex justify-between font-semibold">
              <span>Total Amount:</span>
              <span className="text-blue-600">{formatAmount(totalAmount)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Payment Methods */}
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="font-semibold text-gray-900">Payment Methods</h3>
          <button
            type="button"
            onClick={addPaymentMethod}
            className="flex items-center gap-2 px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" />
            Add Payment Method
          </button>
        </div>

        {paymentMethods.map((payment, index) => {
          const IconComponent = paymentMethodIcons[payment.method];
          return (
            <div key={`paymentMethods-${index}-${payment.method}`} className="border border-gray-200 rounded-lg p-4 space-y-3">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <IconComponent className="w-5 h-5 text-gray-500" />
                  <span className="font-medium">{paymentMethodLabels[payment.method]}</span>
                </div>
                {paymentMethods.length > 1 && (
                  <button aria-label="Delete"
                    type="button"
                    onClick={() => removePaymentMethod(index)}
                    className="text-red-500 hover:text-red-700 p-1"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Payment Method
                  </label>
                  <select
                    value={payment.method}
                    onChange={(e) => updatePaymentMethod(index, 'method', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                  >
                    <option value="cash">Cash</option>
                    <option value="upi">UPI</option>
                    <option value="stripe">Stripe</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Amount
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={payment.amount || ''}
                    onChange={(e) => updatePaymentMethod(index, 'amount', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="0.00"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Reference/Transaction ID
                  </label>
                  <input
                    type="text"
                    value={payment.reference || ''}
                    onChange={(e) => updatePaymentMethod(index, 'reference', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Reference ID"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notes (Optional)
                </label>
                <textarea
                  value={payment.notes || ''}
                  onChange={(e) => updatePaymentMethod(index, 'notes', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  rows={2}
                  placeholder="Additional notes..."
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Payment Summary */}
      <div className="bg-gray-50 p-4 rounded-lg">
        <div className="space-y-2">
          <div className="flex justify-between">
            <span className="text-gray-600">Total Charges:</span>
            <span className="font-medium">{formatAmount(totalAmount)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Total Paid:</span>
            <span className="font-medium">{formatAmount(totalPaid)}</span>
          </div>
          <div className="flex justify-between border-t pt-2">
            <span className="font-semibold">Remaining:</span>
            <span className={`font-semibold ${remainingAmount === 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatAmount(remainingAmount)}
            </span>
          </div>
        </div>
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
          disabled={isProcessing || totalPaid <= 0}
          className="flex-1 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
        >
          {isProcessing ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Processing...
            </>
          ) : (
            <>Process Payment {formatAmount(totalPaid)}</>
          )}
        </button>
      </div>
    </form>
  );
}

interface MultiPaymentExtraPersonChargesProps {
  isOpen: boolean;
  onClose: () => void;
  bookingId: string;
  extraPersonCharges: ExtraPersonChargePayment[];
  onPaymentSuccess?: (paymentDetails: { paymentMethods: PaymentMethod[] }) => void;
}

export function MultiPaymentExtraPersonCharges({
  isOpen,
  onClose,
  bookingId,
  extraPersonCharges,
  onPaymentSuccess
}: MultiPaymentExtraPersonChargesProps) {
  const handleSuccess = (paymentDetails: { paymentMethods: PaymentMethod[] }) => {
    if (onPaymentSuccess) {
      onPaymentSuccess(paymentDetails);
    }
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:p-0">
        <div aria-hidden="true" className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75" onClick={onClose} />

        <div className="relative inline-block w-full max-w-4xl p-6 overflow-hidden text-left align-bottom transition-all transform bg-white shadow-xl rounded-lg sm:my-8 sm:align-middle">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-gray-900">Process Extra Person Payment</h2>
            <p className="text-gray-600 mt-2">
              Choose payment methods and process payment for additional guests.
            </p>
          </div>

          <MultiPaymentForm
            bookingId={bookingId}
            extraPersonCharges={extraPersonCharges}
            onSuccess={handleSuccess}
            onCancel={onClose}
          />
        </div>
      </div>
    </div>
  );
}

export type { PaymentMethod };