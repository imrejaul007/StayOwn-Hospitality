import React, { useState, useEffect, useRef} from 'react';
import {
  X,
  Plus,
  Trash2,
  CreditCard,
  Banknote,
  Smartphone,
  Globe,
  Building2,
  DollarSign,
  CheckCircle2,
  AlertTriangle,
  Percent,
  TrendingUp,
  Receipt,
  Clock,
  ArrowRight,
  Zap,
  Wallet
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { formatCurrency } from '@/utils/dashboardUtils';

interface PaymentMethod {
  method: 'cash' | 'card' | 'upi' | 'online_portal' | 'corporate';
  amount: number;
  reference?: string;
  notes?: string;
}

interface PaymentCollectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (paymentDetails: { paymentMethods: PaymentMethod[]; isPartialPayment: boolean } | null) => void;
  totalAmount: number;
  currency: string;
  bookingNumber: string;
  mode?: 'checkin' | 'checkout';
  onBypassCheckout?: () => void;
  paidAmount?: number; // Already paid amount
}

const paymentMethodConfig = {
  cash: {
    icon: Banknote,
    label: 'Cash',
    color: 'from-green-500 to-emerald-600',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-500',
    textColor: 'text-green-700'
  },
  card: {
    icon: CreditCard,
    label: 'Card',
    color: 'from-blue-500 to-indigo-600',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-500',
    textColor: 'text-blue-700'
  },
  upi: {
    icon: Smartphone,
    label: 'UPI',
    color: 'from-purple-500 to-purple-600',
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-500',
    textColor: 'text-purple-700'
  },
  online_portal: {
    icon: Globe,
    label: 'Online Portal',
    color: 'from-cyan-500 to-cyan-600',
    bgColor: 'bg-cyan-50',
    borderColor: 'border-cyan-500',
    textColor: 'text-cyan-700'
  },
  corporate: {
    icon: Building2,
    label: 'Corporate',
    color: 'from-orange-500 to-orange-600',
    bgColor: 'bg-orange-50',
    borderColor: 'border-orange-500',
    textColor: 'text-orange-700'
  }
};

const quickAmountTemplates = [
  { label: 'Full', percentage: 100, icon: CheckCircle2 },
  { label: '75%', percentage: 75, icon: TrendingUp },
  { label: '50%', percentage: 50, icon: Percent },
  { label: '25%', percentage: 25, icon: Percent }
];

export default function PaymentCollectionModal({
  isOpen,
  onClose,
  onConfirm,
  totalAmount,
  currency,
  bookingNumber,
  mode = 'checkin',
  onBypassCheckout,
  paidAmount = 0
}: PaymentCollectionModalProps) {
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [selectedMethod, setSelectedMethod] = useState<'cash' | 'card' | 'upi' | 'online_portal' | 'corporate'>('cash');
  const [currentAmount, setCurrentAmount] = useState<string>('');
  const [currentReference, setCurrentReference] = useState('');
  const [currentNotes, setCurrentNotes] = useState('');
  const [totalPaid, setTotalPaid] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);

  const balanceAmount = totalAmount - paidAmount;
  const remainingAmount = Math.max(0, balanceAmount - totalPaid);
  const progressPercentage = balanceAmount > 0 ? ((paidAmount + totalPaid) / totalAmount) * 100 : 0;
  const isPartialPayment = mode === 'checkout' && totalPaid > 0 && totalPaid < balanceAmount;
  const isFullPayment = totalPaid > 0 && totalPaid >= balanceAmount;
  const isOverpayment = totalPaid > balanceAmount && balanceAmount > 0;

  const isMountedRef = useRef(true);

  useEffect(() => {
    return () => { isMountedRef.current = false; };
  }, []);

  useEffect(() => {
    const total = paymentMethods.reduce((sum, payment) => sum + payment.amount, 0);
    setTotalPaid(total);
  }, [paymentMethods]);

  // Auto-save draft
  useEffect(() => {
    if (paymentMethods.length > 0 && totalPaid > 0) {
      localStorage.setItem(`payment-draft-${bookingNumber}`, JSON.stringify(paymentMethods));
    }
  }, [paymentMethods, totalPaid, bookingNumber]);

  // Load draft
  useEffect(() => {
    if (isOpen) {
      const draft = localStorage.getItem(`payment-draft-${bookingNumber}`);
      if (draft) {
        try {
          const savedPayments = JSON.parse(draft);
          setPaymentMethods(savedPayments);
        } catch {
          // Error handled silently
        }
      }
    }
  }, [isOpen, bookingNumber]);

  const handleQuickAmount = (percentage: number) => {
    const amount = (balanceAmount * percentage) / 100;
    setCurrentAmount(amount.toFixed(2));
  };

  const handleAddPayment = () => {
    const amount = parseFloat(currentAmount);
    if (amount <= 0 || isNaN(amount)) {
      return;
    }

    const newPayment: PaymentMethod = {
      method: selectedMethod,
      amount: amount,
      reference: currentReference || undefined,
      notes: currentNotes || undefined
    };

    setPaymentMethods([...paymentMethods, newPayment]);
    setCurrentAmount('');
    setCurrentReference('');
    setCurrentNotes('');
  };

  const handleRemovePayment = (index: number) => {
    setPaymentMethods(paymentMethods.filter((_, i) => i !== index));
  };

  const handleConfirm = () => {
    if (paymentMethods.length === 0 || totalPaid <= 0) {
      return;
    }
    setShowConfirmation(true);
  };

  const handleFinalConfirm = async () => {
    setIsLoading(true);
    try {
      localStorage.removeItem(`payment-draft-${bookingNumber}`);
      onConfirm({ paymentMethods, isPartialPayment });
      handleClose();
    } finally {
      setIsLoading(false);
    }
  };

  const handleSkipPayment = () => {
    onConfirm(null);
    handleClose();
  };

  const handleBypassCheckout = () => {
    handleClose();
    onBypassCheckout?.();
  };

  const handleClose = () => {
    // Clear draft before resetting state to prevent auto-save from persisting empty data
    localStorage.removeItem(`payment-draft-${bookingNumber}`);
    setPaymentMethods([]);
    setSelectedMethod('cash');
    setCurrentAmount('');
    setCurrentReference('');
    setCurrentNotes('');
    setShowConfirmation(false);
    onClose();
  };

  const getModeGradient = () => {
    if (mode === 'checkout') {
      return 'from-green-500 via-green-600 to-emerald-600';
    }
    return 'from-blue-500 via-blue-600 to-indigo-600';
  };

  const getModeColor = () => {
    return mode === 'checkout' ? 'green' : 'blue';
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-5xl max-h-[95vh] overflow-y-auto p-0">
        {!showConfirmation ? (
          <>
            {/* Gradient Header */}
            <div className={`relative bg-gradient-to-br ${getModeGradient()} text-white p-8 rounded-t-lg`}>
              <div className="absolute top-0 left-0 w-full h-full bg-black/10 rounded-t-lg"></div>
              <div className="relative z-10">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-4">
                    <div className="p-4 bg-white/20 backdrop-blur-sm rounded-2xl shadow-lg animate-pulse">
                      <Wallet className="h-8 w-8 text-white" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold mb-1">
                        {mode === 'checkout' ? 'Checkout Payment' : 'Check-in Payment'}
                      </h2>
                      <p className={`${mode === 'checkout' ? 'text-green-100' : 'text-blue-100'} text-sm`}>
                        Booking #{bookingNumber}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Progress Indicator */}
                <div className="flex items-center gap-2 text-sm text-white/90">
                  <Clock className="h-4 w-4" />
                  <span>Step 1 of 2: Collect Payment Details</span>
                </div>
              </div>
            </div>

            <div className="p-8">
              {/* Payment Summary Card */}
              <Card className="mb-8 p-6 bg-gradient-to-br from-gray-50 to-gray-100 border-2 border-gray-300 shadow-lg">
                <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <Receipt className="h-5 w-5 text-blue-600" />
                  Payment Summary
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                  <div className="bg-white p-4 rounded-lg border-2 border-gray-200">
                    <p className="text-xs text-gray-600 mb-1 font-medium uppercase tracking-wide">Total Amount</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {formatCurrency(totalAmount, currency)}
                    </p>
                  </div>

                  <div className="bg-white p-4 rounded-lg border-2 border-green-200">
                    <p className="text-xs text-green-700 mb-1 font-medium uppercase tracking-wide">Already Paid</p>
                    <p className="text-2xl font-bold text-green-600">
                      {formatCurrency(paidAmount, currency)}
                    </p>
                  </div>

                  <div className={`bg-white p-4 rounded-lg border-2 ${
                    remainingAmount === 0 ? 'border-green-200' : 'border-red-200'
                  }`}>
                    <p className={`text-xs mb-1 font-medium uppercase tracking-wide ${
                      remainingAmount === 0 ? 'text-green-700' : 'text-red-700'
                    }`}>
                      Balance Due
                    </p>
                    <p className={`text-2xl font-bold ${
                      remainingAmount === 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {formatCurrency(balanceAmount, currency)}
                    </p>
                  </div>

                  <div className="bg-white p-4 rounded-lg border-2 border-blue-200">
                    <p className="text-xs text-blue-700 mb-1 font-medium uppercase tracking-wide">Collecting Now</p>
                    <p className="text-2xl font-bold text-blue-600">
                      {formatCurrency(totalPaid, currency)}
                    </p>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-gray-700">Payment Progress</span>
                    <span className="font-bold text-gray-900">{progressPercentage.toFixed(0)}%</span>
                  </div>
                  <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full bg-gradient-to-r ${
                        progressPercentage >= 100
                          ? 'from-green-500 to-emerald-600'
                          : 'from-blue-500 to-indigo-600'
                      } transition-all duration-500 ease-out`}
                      style={{ width: `${Math.min(progressPercentage, 100)}%` }}
                    />
                  </div>
                  {remainingAmount > 0 && totalPaid > 0 && (
                    <p className="text-xs text-gray-600">
                      Remaining: {formatCurrency(remainingAmount, currency)}
                    </p>
                  )}
                </div>
              </Card>

              {/* Payment Entry Section */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                {/* Left Column - Payment Method & Amount */}
                <div className="space-y-6">
                  {/* Payment Method Selection */}
                  <div>
                    <Label className="flex items-center gap-2 text-sm font-semibold text-gray-900 mb-3">
                      <CreditCard className="h-4 w-4 text-blue-600" />
                      Select Payment Method
                    </Label>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {Object.entries(paymentMethodConfig).map(([key, config]) => {
                        const Icon = config.icon;
                        const isSelected = selectedMethod === key;
                        return (
                          <button aria-label={`Select ${config.label} payment method`}
                            key={key}
                            type="button"
                            onClick={() => setSelectedMethod(key as 'cash' | 'card' | 'upi' | 'online_portal' | 'corporate')}
                            className={`relative p-4 rounded-xl border-2 transition-all duration-200 cursor-pointer
                              ${isSelected
                                ? `${config.borderColor} ${config.bgColor} shadow-lg scale-105`
                                : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-md hover:scale-102'
                              }`}
                          >
                            <div className="flex flex-col items-center gap-2">
                              <div className={`p-2 rounded-lg ${isSelected ? 'bg-white shadow-sm' : 'bg-gray-100'}`}>
                                <Icon className={`h-5 w-5 ${isSelected ? config.textColor : 'text-gray-600'}`} />
                              </div>
                              <span className={`text-sm font-semibold ${isSelected ? config.textColor : 'text-gray-700'}`}>
                                {config.label}
                              </span>
                            </div>
                            {isSelected && (
                              <div className="absolute -top-1 -right-1 bg-blue-600 text-white rounded-full p-1">
                                <CheckCircle2 className="h-3 w-3" />
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Quick Amount Buttons */}
                  <div>
                    <Label className="flex items-center gap-2 text-sm font-semibold text-gray-900 mb-3">
                      <Zap className="h-4 w-4 text-yellow-600" />
                      Quick Amount
                    </Label>
                    <div className="grid grid-cols-4 gap-2">
                      {quickAmountTemplates.map((template) => {
                        const Icon = template.icon;
                        const amount = (balanceAmount * template.percentage) / 100;
                        return (
                          <button aria-label={`Quick amount ${template.label}`}
                            key={template.percentage}
                            type="button"
                            onClick={() => handleQuickAmount(template.percentage)}
                            className={`p-3 rounded-lg border-2 transition-all hover:scale-105 ${
                              parseFloat(currentAmount) === amount
                                ? 'bg-blue-500 text-white border-blue-600 shadow-md'
                                : 'bg-white text-gray-700 border-gray-300 hover:border-blue-400 hover:bg-blue-50'
                            }`}
                          >
                            <Icon className="h-4 w-4 mx-auto mb-1" />
                            <p className="text-xs font-bold">{template.label}</p>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Amount Input */}
                  <div>
                    <Label htmlFor="amount" className="flex items-center gap-2 text-sm font-semibold text-gray-900 mb-3">
                      <DollarSign className="h-4 w-4 text-green-600" />
                      Payment Amount
                    </Label>
                    <div className="relative">
                      <div className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center gap-2 text-gray-500">
                        <DollarSign className="h-5 w-5" />
                        <span className="text-sm font-medium">{currency || 'USD'}</span>
                      </div>
                      <Input
                        id="amount"
                        type="number"
                        min="0"
                        max={balanceAmount}
                        step="0.01"
                        value={currentAmount}
                        onChange={(e) => setCurrentAmount(e.target.value)}
                        placeholder="0.00"
                        className="w-full pl-20 pr-4 py-6 text-xl font-bold border-2 border-gray-300
                                 focus:border-green-500 focus:ring-green-500 transition-all"
                      />
                    </div>
                  </div>
                </div>

                {/* Right Column - Additional Details */}
                <div className="space-y-6">
                  {/* Reference Number */}
                  <div>
                    <Label htmlFor="reference" className="flex items-center gap-2 text-sm font-semibold text-gray-900 mb-3">
                      <Receipt className="h-4 w-4 text-purple-600" />
                      Reference/Transaction ID
                    </Label>
                    <Input
                      id="reference"
                      value={currentReference}
                      onChange={(e) => setCurrentReference(e.target.value)}
                      placeholder="Enter transaction reference"
                      className="w-full py-3 border-2 border-gray-300 focus:border-purple-500 focus:ring-purple-500"
                    />
                  </div>

                  {/* Notes */}
                  <div>
                    <Label htmlFor="notes" className="flex items-center gap-2 text-sm font-semibold text-gray-900 mb-3">
                      <AlertTriangle className="h-4 w-4 text-orange-600" />
                      Notes (Optional)
                    </Label>
                    <Textarea
                      id="notes"
                      value={currentNotes}
                      onChange={(e) => setCurrentNotes(e.target.value)}
                      placeholder="Add any additional notes about this payment..."
                      rows={4}
                      className="w-full resize-none border-2 border-gray-300 focus:border-orange-500 focus:ring-orange-500"
                    />
                  </div>

                  {/* Add Payment Button */}
                  <Button
                    type="button"
                    onClick={handleAddPayment}
                    disabled={!currentAmount || parseFloat(currentAmount) <= 0}
                    className="w-full py-6 text-base font-semibold bg-gradient-to-r from-blue-500 to-indigo-600
                             hover:from-blue-600 hover:to-indigo-700 shadow-lg hover:shadow-xl transition-all
                             disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Plus className="h-5 w-5 mr-2" />
                    Add Payment Method
                  </Button>
                </div>
              </div>

              {/* Payment Breakdown List */}
              {paymentMethods.length > 0 && (
                <Card className="mb-6 p-6 bg-white border-2 border-gray-200">
                  <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-green-600" />
                    Payment Breakdown
                  </h3>
                  <div className="space-y-3">
                    {paymentMethods.map((payment, index) => {
                      const config = paymentMethodConfig[payment.method];
                      const Icon = config.icon;
                      return (
                        <div
                          key={`paymentMethods-${index}-${payment.method}`}
                          className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border-2
                                   border-gray-200 hover:border-gray-300 transition-all animate-slideIn"
                        >
                          <div className="flex items-center gap-3 flex-1">
                            <div className={`p-2 rounded-lg ${config.bgColor}`}>
                              <Icon className={`h-5 w-5 ${config.textColor}`} />
                            </div>
                            <div>
                              <Badge variant="outline" className={`${config.textColor} mb-1`}>
                                {config.label}
                              </Badge>
                              {payment.reference && (
                                <p className="text-xs text-gray-600">Ref: {payment.reference}</p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-xl font-bold text-gray-900">
                              {formatCurrency(payment.amount, currency)}
                            </span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemovePayment(index)}
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}

                    {/* Running Total */}
                    <div className="flex items-center justify-between p-4 bg-gradient-to-r from-blue-50 to-indigo-50
                                  rounded-lg border-2 border-blue-300">
                      <span className="text-sm font-bold text-gray-900 uppercase tracking-wide">
                        Total Collecting:
                      </span>
                      <span className="text-2xl font-bold text-blue-600">
                        {formatCurrency(totalPaid, currency)}
                      </span>
                    </div>
                  </div>
                </Card>
              )}

              {/* Overpayment Warning */}
              {isOverpayment && (
                <Alert variant="destructive" className="mb-6 border-2">
                  <AlertTriangle className="h-5 w-5" />
                  <AlertTitle className="font-bold">Overpayment Warning</AlertTitle>
                  <AlertDescription>
                    The amount being collected ({formatCurrency(totalPaid, currency)}) exceeds the balance due ({formatCurrency(balanceAmount, currency)}).
                    Please adjust the payment amount.
                  </AlertDescription>
                </Alert>
              )}

              {/* Partial Payment Notice (checkout mode) */}
              {isPartialPayment && (
                <Alert variant="default" className="mb-6 border-2 border-orange-300 bg-orange-50">
                  <AlertTriangle className="h-5 w-5 text-orange-600" />
                  <AlertTitle className="font-bold text-orange-800">Partial Payment</AlertTitle>
                  <AlertDescription className="text-orange-700">
                    This will record a partial payment of {formatCurrency(totalPaid, currency)}.
                    The remaining balance of {formatCurrency(remainingAmount, currency)} will still be outstanding.
                    The guest will NOT be checked out until full payment is collected.
                  </AlertDescription>
                </Alert>
              )}

              {/* Information Alert */}
              <Alert variant="info" className="mb-6 border-2">
                <AlertTriangle className="h-5 w-5" />
                <AlertTitle className="font-bold">Payment Information</AlertTitle>
                <AlertDescription>
                  {mode === 'checkout'
                    ? isPartialPayment
                      ? 'Collecting partial payment will update the balance but will not check out the guest. Collect the full balance due to proceed with checkout.'
                      : 'Complete the payment collection to proceed with checkout. You can also bypass checkout if needed.'
                    : 'You can collect partial payment now and the remaining amount later. Use "Skip Payment" to check in without collecting payment.'}
                </AlertDescription>
              </Alert>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-3 pt-6 border-t-2 border-gray-200">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleClose}
                  className="flex-1 py-6 text-base font-semibold hover:bg-gray-100 transition-colors"
                >
                  <X className="h-5 w-5 mr-2" />
                  Cancel
                </Button>

                {mode === 'checkin' && (
                  <Button
                    type="button"
                    onClick={handleSkipPayment}
                    className="flex-1 py-6 text-base font-semibold bg-gradient-to-r from-orange-500 to-orange-600
                             hover:from-orange-600 hover:to-orange-700 text-white shadow-lg hover:shadow-xl
                             transition-all"
                  >
                    <AlertTriangle className="h-5 w-5 mr-2" />
                    Skip Payment & Check In
                  </Button>
                )}

                {mode === 'checkout' && onBypassCheckout && (
                  <Button
                    type="button"
                    onClick={handleBypassCheckout}
                    className="flex-1 py-6 text-base font-semibold bg-gradient-to-r from-red-500 to-rose-600
                             hover:from-red-600 hover:to-rose-700 text-white shadow-lg hover:shadow-xl
                             transition-all"
                  >
                    <AlertTriangle className="h-5 w-5 mr-2" />
                    Bypass Checkout
                  </Button>
                )}

                <Button
                  type="button"
                  onClick={handleConfirm}
                  disabled={totalPaid <= 0 || isOverpayment}
                  className={`flex-1 py-6 text-base font-semibold bg-gradient-to-r ${
                    isPartialPayment
                      ? 'from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700'
                      : mode === 'checkout'
                        ? 'from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700'
                        : 'from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700'
                  } text-white shadow-lg hover:shadow-xl transition-all disabled:opacity-50
                  disabled:cursor-not-allowed`}
                >
                  <CheckCircle2 className="h-5 w-5 mr-2" />
                  {mode === 'checkout'
                    ? isPartialPayment
                      ? 'Collect Partial Payment'
                      : 'Review & Checkout'
                    : 'Review & Check In'}
                  <ArrowRight className="h-5 w-5 ml-2" />
                </Button>
              </div>
            </div>
          </>
        ) : (
          <>
            {/* Confirmation Step */}
            <div className={`relative bg-gradient-to-br ${getModeGradient()} text-white p-8 rounded-t-lg`}>
              <div className="absolute top-0 left-0 w-full h-full bg-black/10 rounded-t-lg"></div>
              <div className="relative z-10">
                <div className="flex items-center gap-4 mb-4">
                  <div className="p-4 bg-white/20 backdrop-blur-sm rounded-2xl shadow-lg">
                    <CheckCircle2 className="h-8 w-8 text-white" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold mb-1">Confirm Payment</h2>
                    <p className={`${mode === 'checkout' ? 'text-green-100' : 'text-blue-100'} text-sm`}>
                      Please review the payment details before confirming
                    </p>
                  </div>
                </div>

                {/* Progress Indicator */}
                <div className="flex items-center gap-2 text-sm text-white/90">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Step 2 of 2: Review & Confirm</span>
                </div>
              </div>
            </div>

            <div className="p-8 space-y-6">
              {/* Summary Card */}
              <Card className="p-6 bg-gradient-to-br from-gray-50 to-gray-100 border-2 border-gray-300">
                <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <Receipt className="h-5 w-5 text-blue-600" />
                  Payment Receipt Preview
                </h3>

                <div className="space-y-4">
                  <div className="pb-4 border-b border-gray-300">
                    <p className="text-sm text-gray-600 mb-1">Booking Number</p>
                    <p className="text-base font-bold text-gray-900">#{bookingNumber}</p>
                  </div>

                  <div className="pb-4 border-b border-gray-300">
                    <p className="text-sm text-gray-600 mb-2">Payment Methods</p>
                    <div className="space-y-2">
                      {paymentMethods.map((payment, index) => {
                        const config = paymentMethodConfig[payment.method];
                        const Icon = config.icon;
                        return (
                          <div key={`paymentMethods-${index}-${payment.method}`} className="flex items-center justify-between bg-white p-3 rounded-lg">
                            <div className="flex items-center gap-2">
                              <Icon className={`h-4 w-4 ${config.textColor}`} />
                              <span className="font-medium text-gray-900">{config.label}</span>
                              {payment.reference && (
                                <span className="text-xs text-gray-500">({payment.reference})</span>
                              )}
                            </div>
                            <span className="font-bold text-gray-900">
                              {formatCurrency(payment.amount, currency)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between bg-gradient-to-r from-green-50 to-emerald-50
                                  p-4 rounded-lg border-2 border-green-300">
                      <span className="text-sm font-bold text-gray-900 uppercase tracking-wide">
                        Total Payment:
                      </span>
                      <span className="text-3xl font-bold text-green-600">
                        {formatCurrency(totalPaid, currency)}
                      </span>
                    </div>
                    {remainingAmount > 0 && (
                      <p className="text-sm text-orange-600 mt-2 font-medium">
                        Remaining balance: {formatCurrency(remainingAmount, currency)}
                      </p>
                    )}
                    {remainingAmount === 0 && (
                      <div className="flex items-center gap-2 mt-2 text-green-600">
                        <CheckCircle2 className="h-4 w-4" />
                        <span className="text-sm font-medium">Full payment collected</span>
                      </div>
                    )}
                  </div>
                </div>
              </Card>

              {/* Final Confirmation */}
              <Alert variant={isPartialPayment ? 'default' : 'info'} className={`border-2 ${isPartialPayment ? 'border-orange-300 bg-orange-50' : ''}`}>
                <CheckCircle2 className="h-5 w-5" />
                <AlertTitle className="font-bold">
                  {isPartialPayment ? 'Confirm Partial Payment' : 'Confirm Payment Collection'}
                </AlertTitle>
                <AlertDescription>
                  {isPartialPayment
                    ? `This will record a partial payment of ${formatCurrency(totalPaid, currency)}. The remaining balance of ${formatCurrency(remainingAmount, currency)} will still be outstanding. The guest will NOT be checked out.`
                    : <>
                        This payment will be recorded and the {mode === 'checkout' ? 'checkout' : 'check-in'} process will continue.
                        {mode === 'checkout' && ' The guest will be checked out after payment confirmation.'}
                      </>
                  }
                </AlertDescription>
              </Alert>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowConfirmation(false)}
                  className="flex-1 py-6 text-base font-semibold hover:bg-gray-100"
                  disabled={isLoading}
                >
                  <X className="h-5 w-5 mr-2" />
                  Go Back
                </Button>
                <Button
                  type="button"
                  onClick={handleFinalConfirm}
                  disabled={isLoading}
                  className={`flex-1 py-6 text-base font-semibold bg-gradient-to-r ${
                    isPartialPayment
                      ? 'from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700'
                      : mode === 'checkout'
                        ? 'from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700'
                        : 'from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700'
                  } text-white shadow-lg hover:shadow-xl transition-all`}
                >
                  {isLoading ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent mr-2" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-5 w-5 mr-2" />
                      {mode === 'checkout'
                        ? isPartialPayment
                          ? 'Confirm Partial Payment'
                          : 'Confirm & Checkout'
                        : 'Confirm & Check In'}
                    </>
                  )}
                </Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
