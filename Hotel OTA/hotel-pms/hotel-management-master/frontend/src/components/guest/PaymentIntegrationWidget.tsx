import React, { useState, useEffect } from 'react';
import {
  CreditCard,
  Wallet,
  Home,
  DollarSign,
  Lock,
  CheckCircle,
  AlertCircle,
  Loader2,
  Receipt,
  Shield
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatCurrency } from '../../utils/formatters';
import { api } from '../../services/api';

interface OrderItem {
  name: string;
  price: number;
  quantity: number;
}

interface PaymentIntegrationWidgetProps {
  orderId?: string;
  amount: number;
  currency?: string;
  items: OrderItem[];
  onPaymentSuccess?: (paymentResult: Record<string, unknown>) => void;
  onPaymentError?: (error: Record<string, unknown>) => void;
  guestDetails?: unknown;
  roomNumber?: string;
  bookingId?: string;
}

interface PaymentMethod {
  id: string;
  name: string;
  icon: React.ReactNode;
  description: string;
  available: boolean;
  fee?: number;
  feePercentage?: number;
}

interface PaymentState {
  selectedMethod: string;
  processing: boolean;
  completed: boolean;
  error: string | null;
  transactionId?: string;
}

const paymentMethods: PaymentMethod[] = [
  {
    id: 'room_charge',
    name: 'Room Charge',
    icon: <Home className="w-5 h-5" />,
    description: 'Add to your room bill - pay at checkout',
    available: true,
    fee: 0
  },
  {
    id: 'card',
    name: 'Credit/Debit Card',
    icon: <CreditCard className="w-5 h-5" />,
    description: 'Pay securely with your card',
    available: true,
    feePercentage: 2.5
  },
  {
    id: 'digital_wallet',
    name: 'Digital Wallet',
    icon: <Wallet className="w-5 h-5" />,
    description: 'UPI, Google Pay, PhonePe, Paytm',
    available: true,
    fee: 0
  },
  {
    id: 'cash',
    name: 'Cash on Delivery',
    icon: <DollarSign className="w-5 h-5" />,
    description: 'Pay with cash when your order arrives',
    available: true,
    fee: 0
  }
];

export function PaymentIntegrationWidget({
  orderId,
  amount,
  currency = 'INR',
  items,
  onPaymentSuccess,
  onPaymentError,
  guestDetails,
  roomNumber,
  bookingId
}: PaymentIntegrationWidgetProps) {
  const [paymentState, setPaymentState] = useState<PaymentState>({
    selectedMethod: 'room_charge',
    processing: false,
    completed: false,
    error: null
  });

  const [digitalWalletDetails, setDigitalWalletDetails] = useState({
    walletType: '',
    phoneNumber: ''
  });

  const [billingAddress, setBillingAddress] = useState({
    address: '',
    city: '',
    state: '',
    pincode: '',
    country: 'India'
  });

  const [totals, setTotals] = useState({
    subtotal: amount,
    fees: 0,
    taxes: 0,
    total: amount
  });

  useEffect(() => {
    calculateTotals();
  }, [paymentState.selectedMethod, amount]);

  const calculateTotals = () => {
    const selectedPaymentMethod = paymentMethods.find(m => m.id === paymentState.selectedMethod);
    let fees = 0;

    if (selectedPaymentMethod) {
      if (selectedPaymentMethod.fee) {
        fees = selectedPaymentMethod.fee;
      } else if (selectedPaymentMethod.feePercentage) {
        fees = (amount * selectedPaymentMethod.feePercentage) / 100;
      }
    }

    // Calculate taxes (GST is typically 18% in India for services)
    const taxes = paymentState.selectedMethod === 'room_charge' ? 0 : (amount * 0.18);

    setTotals({
      subtotal: amount,
      fees: Math.round(fees * 100) / 100,
      taxes: Math.round(taxes * 100) / 100,
      total: Math.round((amount + fees + taxes) * 100) / 100
    });
  };

  const validatePaymentDetails = (): boolean => {
    if (!paymentState.selectedMethod) {
      setPaymentState(prev => ({ ...prev, error: 'Please select a payment method' }));
      return false;
    }

    switch (paymentState.selectedMethod) {
      case 'card':
        // Card payments are handled via Stripe Elements on the billing page
        window.location.href = '/app/billing';
        return false;

      case 'digital_wallet':
        if (!digitalWalletDetails.walletType || !digitalWalletDetails.phoneNumber) {
          setPaymentState(prev => ({ ...prev, error: 'Please select wallet type and enter phone number' }));
          return false;
        }
        break;

      case 'room_charge':
        if (!roomNumber) {
          setPaymentState(prev => ({ ...prev, error: 'Room number is required for room charges' }));
          return false;
        }
        break;
    }

    return true;
  };

  const processPayment = async () => {
    if (!validatePaymentDetails()) return;

    try {
      setPaymentState(prev => ({ ...prev, processing: true, error: null }));

      const paymentData = {
        orderId,
        amount: totals.total,
        currency,
        paymentMethod: paymentState.selectedMethod,
        items,
        guestDetails,
        roomNumber,
        bookingId,
        paymentDetails: {
          ...(paymentState.selectedMethod === 'digital_wallet' && { digitalWallet: digitalWalletDetails }),
          billingAddress
        }
      };

      let response;

      switch (paymentState.selectedMethod) {
        case 'room_charge':
          response = await processRoomChargePayment(paymentData);
          break;

        case 'card':
          // Card payments are redirected to billing page (handled in validation)
          return;

        case 'digital_wallet':
          response = await processDigitalWalletPayment(paymentData);
          break;

        case 'cash':
          response = await processCashPayment(paymentData);
          break;

        default:
          throw new Error('Invalid payment method');
      }

      if (response.success) {
        setPaymentState(prev => ({
          ...prev,
          processing: false,
          completed: true,
          transactionId: response.transactionId
        }));

        if (onPaymentSuccess) {
          onPaymentSuccess(response);
        }
      } else {
        throw new Error(response.message || 'Payment failed');
      }

    } catch (error: unknown) {
      setPaymentState(prev => ({
        ...prev,
        processing: false,
        error: error instanceof Error ? error.message : 'Payment processing failed'
      }));

      if (onPaymentError) {
        onPaymentError(error);
      }
    }
  };

  const processRoomChargePayment = async (paymentData: Record<string, unknown>) => {
    try {
      const response = await api.post('/payments/room-charge', paymentData);
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Room charge payment failed');
    }
  };

  const processDigitalWalletPayment = async (paymentData: Record<string, unknown>) => {
    try {
      const response = await api.post('/payments/digital-wallet', paymentData);
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Digital wallet payment failed');
    }
  };

  const processCashPayment = async (paymentData: Record<string, unknown>) => {
    try {
      const response = await api.post('/payments/cash-on-delivery', paymentData);
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Cash payment processing failed');
    }
  };

  const renderPaymentMethodDetails = () => {
    switch (paymentState.selectedMethod) {
      case 'card':
        return (
          <div className="space-y-4">
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-700">
                Card payments are processed securely through Stripe.
                Please use the secure payment form on the billing page.
              </p>
            </div>
            <Button
              onClick={() => window.location.href = '/app/billing'}
              className="w-full"
            >
              Go to Secure Payment
            </Button>
          </div>
        );

      case 'digital_wallet':
        return (
          <div className="space-y-4">
            <div>
              <Label htmlFor="walletType">Wallet Type</Label>
              <Select
                value={digitalWalletDetails.walletType}
                onValueChange={(value) => setDigitalWalletDetails(prev => ({ ...prev, walletType: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select wallet type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="upi">UPI</SelectItem>
                  <SelectItem value="googlepay">Google Pay</SelectItem>
                  <SelectItem value="phonepe">PhonePe</SelectItem>
                  <SelectItem value="paytm">Paytm</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="phoneNumber">Phone Number</Label>
              <Input
                id="phoneNumber"
                type="tel"
                placeholder="+91 9876543210"
                value={digitalWalletDetails.phoneNumber}
                onChange={(e) => setDigitalWalletDetails(prev => ({ ...prev, phoneNumber: e.target.value }))}
              />
            </div>
          </div>
        );

      case 'room_charge':
        return (
          <div className="bg-green-50 p-4 rounded-lg">
            <div className="flex items-center mb-2">
              <CheckCircle className="w-5 h-5 text-green-600 mr-2" />
              <h4 className="font-medium text-green-900">Room Charge Selected</h4>
            </div>
            <p className="text-green-700 text-sm mb-3">
              This amount will be added to your room bill and you can pay at checkout.
            </p>
            {roomNumber && (
              <p className="text-green-600 text-sm font-medium">
                Room: {roomNumber}
              </p>
            )}
          </div>
        );

      case 'cash':
        return (
          <div className="bg-yellow-50 p-4 rounded-lg">
            <div className="flex items-center mb-2">
              <DollarSign className="w-5 h-5 text-yellow-600 mr-2" />
              <h4 className="font-medium text-yellow-900">Cash on Delivery</h4>
            </div>
            <p className="text-yellow-700 text-sm">
              Please have the exact amount ready when your order arrives. Our delivery staff will collect the payment.
            </p>
          </div>
        );

      default:
        return null;
    }
  };

  if (paymentState.completed) {
    return (
      <Card className="p-6">
        <div className="text-center">
          <CheckCircle className="mx-auto h-12 w-12 text-green-600 mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Payment Successful!</h3>
          <p className="text-gray-600 mb-4">
            Your payment has been processed successfully.
          </p>
          {paymentState.transactionId && (
            <p className="text-sm text-gray-500 mb-4">
              Transaction ID: {paymentState.transactionId}
            </p>
          )}
          <div className="bg-green-50 p-4 rounded-lg">
            <p className="text-green-700 text-sm">
              Your order is being prepared and will be delivered shortly.
            </p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Payment Method Selection */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Select Payment Method</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {paymentMethods.map(method => (
            <div role="button" tabIndex={0}
              key={method.id}
              className={`p-4 border-2 rounded-lg cursor-pointer transition-colors ${
                paymentState.selectedMethod === method.id
                  ? 'border-blue-600 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              } ${!method.available ? 'opacity-50 cursor-not-allowed' : ''}`}
              onClick={() => method.available && setPaymentState(prev => ({ ...prev, selectedMethod: method.id }))}
             onKeyDown={(e: React.KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); const clickHandler = () => method.available && setPaymentState(prev => ({ ...prev, selectedMethod: method.id })); if (typeof clickHandler === 'function') { clickHandler(e as any); } } }}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center">
                  {method.icon}
                  <span className="ml-2 font-medium text-gray-900">{method.name}</span>
                </div>
                {method.fee || method.feePercentage ? (
                  <Badge variant="secondary" className="text-xs">
                    {method.fee ? `+${formatCurrency(method.fee)}` : `+${method.feePercentage}%`}
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="text-xs bg-green-100 text-green-800">
                    No Fee
                  </Badge>
                )}
              </div>
              <p className="text-sm text-gray-600">{method.description}</p>
            </div>
          ))}
        </div>
      </Card>

      {/* Payment Details */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Payment Details</h3>
        {renderPaymentMethodDetails()}
      </Card>

      {/* Order Summary */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Order Summary</h3>

        {/* Items */}
        <div className="space-y-2 mb-4">
          {items.map((item, index) => (
            <div key={`items-${index}-${item.name}`} className="flex justify-between text-sm">
              <span>{item.quantity}x {item.name}</span>
              <span>{formatCurrency(item.price * item.quantity)}</span>
            </div>
          ))}
        </div>

        {/* Totals */}
        <div className="border-t pt-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span>Subtotal</span>
            <span>{formatCurrency(totals.subtotal)}</span>
          </div>

          {totals.fees > 0 && (
            <div className="flex justify-between text-sm">
              <span>Payment Fee</span>
              <span>{formatCurrency(totals.fees)}</span>
            </div>
          )}

          {totals.taxes > 0 && (
            <div className="flex justify-between text-sm">
              <span>Taxes</span>
              <span>{formatCurrency(totals.taxes)}</span>
            </div>
          )}

          <div className="flex justify-between font-semibold text-lg pt-2 border-t">
            <span>Total</span>
            <span>{formatCurrency(totals.total)}</span>
          </div>
        </div>
      </Card>

      {/* Security Notice */}
      <Card className="p-4 bg-gray-50">
        <div className="flex items-center">
          <Shield className="w-5 h-5 text-gray-600 mr-2" />
          <p className="text-sm text-gray-600">
            Your payment information is secure and encrypted. We do not store your card details.
          </p>
        </div>
      </Card>

      {/* Error Message */}
      {paymentState.error && (
        <Card className="p-4 bg-red-50 border-red-200">
          <div className="flex items-center">
            <AlertCircle className="w-5 h-5 text-red-600 mr-2" />
            <p className="text-sm text-red-600">{paymentState.error}</p>
          </div>
        </Card>
      )}

      {/* Payment Button */}
      <Button
        onClick={processPayment}
        disabled={paymentState.processing}
        className="w-full bg-green-600 hover:bg-green-700 text-white py-3"
        size="lg"
      >
        {paymentState.processing ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Processing Payment...
          </>
        ) : (
          <>
            <Lock className="w-4 h-4 mr-2" />
            Pay {formatCurrency(totals.total)}
          </>
        )}
      </Button>
    </div>
  );
}