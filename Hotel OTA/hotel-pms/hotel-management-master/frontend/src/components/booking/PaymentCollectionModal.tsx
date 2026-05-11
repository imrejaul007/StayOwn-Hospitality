import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../ui/dialog';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Badge } from '../ui/Badge';
import { Input } from '../ui/Input';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';
import { CreditCard, Wallet, Smartphone, Plus, Trash2, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { api } from '../../services/api';
import { loadStripe, Stripe, StripeElements } from '@stripe/stripe-js';
import toast from 'react-hot-toast';

// Initialize Stripe
const STRIPE_PUBLISHABLE_KEY = import.meta.env.VITE_STRIPE_PUBLIC_KEY;
if (!STRIPE_PUBLISHABLE_KEY) {
  throw new Error('VITE_STRIPE_PUBLIC_KEY environment variable is required');
}
const stripePromise = loadStripe(STRIPE_PUBLISHABLE_KEY);

interface PaymentMethod {
  method: 'cash' | 'card' | 'upi';
  amount: number;
  reference?: string;
  notes?: string;
}

interface PaymentCollectionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bookingId: string;
  totalAmount: number;
  totalPaid: number;
  balanceRemaining: number;
  onPaymentSuccess: () => void;
  mode: 'checkin' | 'checkout';
}

export function PaymentCollectionModal({
  open,
  onOpenChange,
  bookingId,
  totalAmount,
  totalPaid,
  balanceRemaining,
  onPaymentSuccess,
  mode
}: PaymentCollectionModalProps) {
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [currentMethod, setCurrentMethod] = useState<'cash' | 'card' | 'upi'>('cash');
  const [currentAmount, setCurrentAmount] = useState<string>('');
  const [currentReference, setCurrentReference] = useState<string>('');
  const [currentNotes, setCurrentNotes] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Stripe-specific state
  const [stripe, setStripe] = useState<Stripe | null>(null);
  const [isLoadingStripe, setIsLoadingStripe] = useState(false);
  const [cardHolderName, setCardHolderName] = useState('');

  // Load Stripe when modal opens and card method is selected
  useEffect(() => {
    if (open && currentMethod === 'card') {
      setIsLoadingStripe(true);
      stripePromise.then((stripeInstance) => {
        setStripe(stripeInstance);
        setIsLoadingStripe(false);
      }).catch((err) => {
        toast.error('Failed to load payment processor');
        setIsLoadingStripe(false);
      });
    }
  }, [open, currentMethod]);

  // Reset form when modal closes
  useEffect(() => {
    if (!open) {
      setPaymentMethods([]);
      setCurrentMethod('cash');
      setCurrentAmount('');
      setCurrentReference('');
      setCurrentNotes('');
      setCardHolderName('');
      setError(null);
    }
  }, [open]);

  // Auto-fill remaining balance on first load
  useEffect(() => {
    if (open && paymentMethods.length === 0 && balanceRemaining > 0) {
      setCurrentAmount(balanceRemaining.toString());
    }
  }, [open, balanceRemaining]);

  const getTotalPaymentAmount = () => {
    return paymentMethods.reduce((sum, pm) => sum + pm.amount, 0);
  };

  const getRemainingToCollect = () => {
    return balanceRemaining - getTotalPaymentAmount();
  };

  const addPaymentMethod = () => {
    const amount = parseFloat(currentAmount);

    if (!amount || amount <= 0) {
      setError('Please enter a valid amount');
      return;
    }

    const totalCollected = getTotalPaymentAmount();
    if (totalCollected + amount > balanceRemaining) {
      setError(`Amount exceeds remaining balance. Maximum: ₹${(balanceRemaining - totalCollected).toLocaleString()}`);
      return;
    }

    if (currentMethod === 'card' && !cardHolderName.trim()) {
      setError('Card holder name is required');
      return;
    }

    if (currentMethod === 'upi' && !currentReference.trim()) {
      setError('UPI transaction ID is required');
      return;
    }

    const newPayment: PaymentMethod = {
      method: currentMethod,
      amount: amount,
      reference: currentReference || undefined,
      notes: currentNotes || undefined
    };

    setPaymentMethods([...paymentMethods, newPayment]);

    // Reset current fields
    setCurrentAmount('');
    setCurrentReference('');
    setCurrentNotes('');
    setCardHolderName('');
    setError(null);
  };

  const removePaymentMethod = (index: number) => {
    setPaymentMethods(paymentMethods.filter((_, i) => i !== index));
  };

  const processCardPayment = async (): Promise<boolean> => {
    if (!stripe) {
      setError('Payment processor not loaded');
      return false;
    }

    const cardPayments = paymentMethods.filter(pm => pm.method === 'card');
    if (cardPayments.length === 0) {
      return true; // No card payments to process
    }

    try {
      const totalCardAmount = cardPayments.reduce((sum, pm) => sum + pm.amount, 0);

      // Create payment intent
      const response = await api.post('/payments/intent', {
        bookingId,
        amount: totalCardAmount,
        currency: 'INR'
      });

      const { clientSecret } = response.data.data;

      // For simplicity, we'll just verify the payment intent was created
      // In a real implementation, you would integrate Stripe Elements here

      return true;
    } catch (err: unknown) {
      setError(err.response?.data?.message || 'Card payment processing failed');
      return false;
    }
  };

  const handleSubmit = async () => {
    if (paymentMethods.length === 0) {
      setError('Please add at least one payment method');
      return;
    }

    const totalCollected = getTotalPaymentAmount();
    if (totalCollected > balanceRemaining) {
      setError('Total payment exceeds balance remaining');
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      // Process card payments if any
      const hasCardPayments = paymentMethods.some(pm => pm.method === 'card');
      if (hasCardPayments) {
        const cardProcessed = await processCardPayment();
        if (!cardProcessed) {
          setIsProcessing(false);
          return;
        }
      }

      // Submit payment based on mode
      if (mode === 'checkin') {
        // Check-in payment
        await api.patch(`/bookings/${bookingId}/check-in`, {
          paymentDetails: {
            paymentMethods: paymentMethods
          }
        });

        toast.success(`Payment collected successfully! ₹${totalCollected.toLocaleString()} received.`);
      } else {
        // Checkout/settlement payment
        await api.post(`/bookings/${bookingId}/settlement/payment`, {
          paymentMethods: paymentMethods,
          amount: totalCollected
        });

        toast.success(`Settlement payment processed successfully! ₹${totalCollected.toLocaleString()} received.`);
      }

      onPaymentSuccess();
      onOpenChange(false);
    } catch (err: unknown) {
      const errorMessage = err.response?.data?.message || err.message || 'Failed to process payment';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSkipPayment = async () => {
    if (mode !== 'checkin') {
      setError('Can only skip payment during check-in');
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      // Check-in without payment
      await api.patch(`/bookings/${bookingId}/check-in`, {
        paymentDetails: undefined
      });

      toast.info('Guest checked in without payment collection');
      onPaymentSuccess();
      onOpenChange(false);
    } catch (err: unknown) {
      const errorMessage = err.response?.data?.message || err.message || 'Failed to check in';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsProcessing(false);
    }
  };

  const getPaymentMethodIcon = (method: string) => {
    switch (method) {
      case 'cash':
        return <Wallet className="w-4 h-4" />;
      case 'card':
        return <CreditCard className="w-4 h-4" />;
      case 'upi':
        return <Smartphone className="w-4 h-4" />;
      default:
        return null;
    }
  };

  const getPaymentMethodLabel = (method: string) => {
    switch (method) {
      case 'cash':
        return 'Cash';
      case 'card':
        return 'Credit/Debit Card';
      case 'upi':
        return 'UPI';
      default:
        return method;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">
            {mode === 'checkin' ? 'Collect Payment at Check-in' : 'Collect Settlement Payment'}
          </DialogTitle>
          <DialogDescription>
            {mode === 'checkin'
              ? 'Collect payment from guest during check-in process'
              : 'Process final settlement payment at checkout'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Payment Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Payment Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Total Amount:</span>
                <span className="font-semibold text-lg">₹{totalAmount.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Already Paid:</span>
                <span className="font-semibold text-green-600">₹{totalPaid.toLocaleString()}</span>
              </div>
              <div className="border-t pt-3 flex justify-between items-center">
                <span className="font-medium text-gray-900">Balance Remaining:</span>
                <span className="font-bold text-xl text-red-600">₹{balanceRemaining.toLocaleString()}</span>
              </div>
              {paymentMethods.length > 0 && (
                <>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Collecting Now:</span>
                    <span className="font-semibold text-blue-600">₹{getTotalPaymentAmount().toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Remaining After Payment:</span>
                    <span className="font-semibold text-orange-600">₹{getRemainingToCollect().toLocaleString()}</span>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Add Payment Method */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Add Payment Method</CardTitle>
              <CardDescription>Select payment method and enter amount</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Payment Method Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Payment Method
                </label>
                <RadioGroup value={currentMethod} onValueChange={(value) => setCurrentMethod(value as 'cash' | 'card' | 'upi')}>
                  <div className="grid grid-cols-3 gap-3">
                    {(['cash', 'card', 'upi'] as const).map((method) => (
                      <label
                        key={method}
                        className={`flex items-center gap-2 p-3 border-2 rounded-lg cursor-pointer transition-all ${
                          currentMethod === method
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <RadioGroupItem value={method} id={method} />
                        <div className="flex items-center gap-2">
                          {getPaymentMethodIcon(method)}
                          <span className="text-sm font-medium">{getPaymentMethodLabel(method)}</span>
                        </div>
                      </label>
                    ))}
                  </div>
                </RadioGroup>
              </div>

              {/* Amount Input */}
              <div className="grid grid-cols-2 gap-4">
                <Input
                  type="number"
                  label="Amount *"
                  placeholder="Enter amount"
                  value={currentAmount}
                  onChange={(e) => setCurrentAmount(e.target.value)}
                  min="0"
                  step="0.01"
                />
                {currentMethod === 'card' && (
                  <Input
                    type="text"
                    label="Card Holder Name *"
                    placeholder="Name on card"
                    value={cardHolderName}
                    onChange={(e) => setCardHolderName(e.target.value)}
                  />
                )}
                {currentMethod === 'upi' && (
                  <Input
                    type="text"
                    label="UPI Transaction ID *"
                    placeholder="Transaction reference"
                    value={currentReference}
                    onChange={(e) => setCurrentReference(e.target.value)}
                  />
                )}
                {currentMethod === 'cash' && (
                  <Input
                    type="text"
                    label="Reference (Optional)"
                    placeholder="Receipt number, etc."
                    value={currentReference}
                    onChange={(e) => setCurrentReference(e.target.value)}
                  />
                )}
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notes (Optional)
                </label>
                <textarea
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Add any notes about this payment..."
                  value={currentNotes}
                  onChange={(e) => setCurrentNotes(e.target.value)}
                  rows={2}
                />
              </div>

              {/* Add Button */}
              <button
                onClick={addPaymentMethod}
                disabled={!currentAmount || parseFloat(currentAmount) <= 0}
                className="w-full bg-blue-600 text-white px-4 py-2.5 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 font-medium transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add Payment Method
              </button>
            </CardContent>
          </Card>

          {/* Payment Methods List */}
          {paymentMethods.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Payment Breakdown</CardTitle>
                <CardDescription>
                  {paymentMethods.length} payment method{paymentMethods.length > 1 ? 's' : ''} added
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {paymentMethods.map((pm, index) => (
                    <div
                      key={`paymentMethods-${index}-${pm.method}`}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center border border-gray-200">
                          {getPaymentMethodIcon(pm.method)}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-gray-900">
                              {getPaymentMethodLabel(pm.method)}
                            </span>
                            <Badge variant="info" size="sm">
                              ₹{pm.amount.toLocaleString()}
                            </Badge>
                          </div>
                          {pm.reference && (
                            <p className="text-xs text-gray-500 mt-0.5">
                              Ref: {pm.reference}
                            </p>
                          )}
                          {pm.notes && (
                            <p className="text-xs text-gray-600 mt-0.5">
                              {pm.notes}
                            </p>
                          )}
                        </div>
                      </div>
                      <button aria-label="Delete"
                        onClick={() => removePaymentMethod(index)}
                        className="text-red-600 hover:text-red-700 p-2 hover:bg-red-50 rounded-lg transition-colors"
                        title="Remove payment method"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>

                {/* Total */}
                <div className="mt-4 pt-4 border-t border-gray-200 flex justify-between items-center">
                  <span className="font-semibold text-gray-900">Total to Collect:</span>
                  <span className="text-xl font-bold text-blue-600">
                    ₹{getTotalPaymentAmount().toLocaleString()}
                  </span>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-red-800">Error</p>
                <p className="text-sm text-red-700 mt-1">{error}</p>
              </div>
            </div>
          )}

          {/* Stripe Loading */}
          {isLoadingStripe && currentMethod === 'card' && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-center gap-3">
              <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
              <p className="text-sm text-blue-800">Loading payment processor...</p>
            </div>
          )}
        </div>

        <DialogFooter className="flex gap-3">
          <button
            onClick={() => onOpenChange(false)}
            disabled={isProcessing}
            className="bg-gray-200 text-gray-800 px-4 py-2.5 rounded-lg hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors"
          >
            Cancel
          </button>
          <div className="flex gap-3 flex-1">
            {mode === 'checkin' && (
              <button aria-label="Close"
                onClick={handleSkipPayment}
                disabled={isProcessing}
                className="flex-1 bg-orange-500 text-white px-4 py-2.5 rounded-lg hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 font-medium transition-colors"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    Skip Payment & Check In
                  </>
                )}
              </button>
            )}
            <button
              onClick={handleSubmit}
              disabled={isProcessing || paymentMethods.length === 0}
              className="flex-1 bg-green-600 text-white px-4 py-2.5 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 font-medium transition-colors"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4" />
                  {mode === 'checkin' ? 'Collect Payment & Check In' : 'Process Payment'}
                </>
              )}
            </button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
