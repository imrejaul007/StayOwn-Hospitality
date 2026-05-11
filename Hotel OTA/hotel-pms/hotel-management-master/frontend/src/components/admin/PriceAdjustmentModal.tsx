import React, { useState, useEffect } from 'react';
import { XMarkIcon, ExclamationTriangleIcon, CheckCircleIcon } from '@heroicons/react/24/outline';
import { toast } from 'react-hot-toast';
import { api } from '../../services/api';

interface Booking {
  _id: string;
  totalAmount: number;
  originalAmount?: number;
  discountAmount?: number;
  surchargeAmount?: number;
  currency: string;
  bookingNumber: string;
  guestDetails?: {
    adults: number;
    children: number;
  };
  checkIn: string;
  checkOut: string;
  rooms: Array<{
    roomId: string;
    rate: number;
  }>;
}

interface PriceAdjustment {
  adjustmentId: string;
  adjustmentType: string;
  amount: number;
  reason: string;
  adjustedBy: {
    userName: string;
    userRole: string;
  };
  adjustedAt: string;
  isReversed: boolean;
  previousAmount: number;
  newAmount: number;
}

interface PriceAdjustmentModalProps {
  booking: Booking;
  onClose: () => void;
  onSuccess: () => void;
}

const PriceAdjustmentModal: React.FC<PriceAdjustmentModalProps> = ({
  booking,
  onClose,
  onSuccess
}) => {
  const [adjustmentType, setAdjustmentType] = useState<'fixed' | 'percentage'>('fixed');
  const [adjustmentAmount, setAdjustmentAmount] = useState<number>(0);
  const [reason, setReason] = useState('');
  const [adjustmentCategory, setAdjustmentCategory] = useState('manual_adjustment');
  const [discountCode, setDiscountCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [priceHistory, setPriceHistory] = useState<PriceAdjustment[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [reversingAdjustmentId, setReversingAdjustmentId] = useState<string | null>(null);
  const [reverseReason, setReverseReason] = useState('');

  const currentAmount = booking.totalAmount;
  const calculatedAdjustment = adjustmentType === 'percentage'
    ? (currentAmount * adjustmentAmount / 100)
    : adjustmentAmount;
  const newAmount = currentAmount + calculatedAdjustment;

  useEffect(() => {
    if (showHistory) {
      fetchPriceHistory();
    }
  }, [showHistory]);

  const fetchPriceHistory = async () => {
    try {
      setHistoryLoading(true);
      const response = await api.get(`/bookings/enhanced/${booking._id}/price-history`);
      setPriceHistory(response.data.data.adjustmentHistory || []);
    } catch (error: unknown) {
      toast.error('Failed to load price history');
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!reason.trim()) {
      toast.error('Reason is required for price adjustment');
      return;
    }

    if (newAmount < 0) {
      toast.error('Adjustment cannot result in negative total amount');
      return;
    }

    if (Math.abs(calculatedAdjustment) === 0) {
      toast.error('Adjustment amount cannot be zero');
      return;
    }

    setLoading(true);

    try {
      const adjustmentData = {
        amount: calculatedAdjustment,
        type: adjustmentCategory,
        reason: reason.trim(),
        percentage: adjustmentType === 'percentage' ? adjustmentAmount : undefined,
        discountCode: discountCode.trim() || undefined
      };

      await api.post(`/bookings/enhanced/${booking._id}/adjust-price`, adjustmentData);

      toast.success(`Price adjustment of ${calculatedAdjustment > 0 ? '+' : ''}₹${Math.abs(calculatedAdjustment).toLocaleString()} applied successfully`);
      onSuccess();
      onClose();
    } catch (error: unknown) {
      const axiosErr = error as { response?: { data?: { message?: string } } };
      toast.error(axiosErr?.response?.data?.message || 'Failed to apply price adjustment');
    } finally {
      setLoading(false);
    }
  };

  const handleReverseAdjustment = async (adjustmentId: string) => {
    if (reversingAdjustmentId === adjustmentId) {
      // Already in reverse mode - submit the reversal
      if (!reverseReason.trim()) {
        toast.error('Please provide a reason for reversing this adjustment');
        return;
      }

      try {
        await api.post(`/bookings/enhanced/${booking._id}/adjustments/${adjustmentId}/reverse`, {
          reason: reverseReason.trim()
        });

        toast.success('Price adjustment reversed successfully');
        setReversingAdjustmentId(null);
        setReverseReason('');
        fetchPriceHistory();
        onSuccess();
      } catch (error: unknown) {
        const axiosErr = error as { response?: { data?: { message?: string } } };
        toast.error(axiosErr?.response?.data?.message || 'Failed to reverse adjustment');
      }
    } else {
      // Enter reverse mode for this adjustment
      setReversingAdjustmentId(adjustmentId);
      setReverseReason('');
    }
  };

  const getAdjustmentTypeColor = (type: string) => {
    const colors = {
      discount: 'bg-green-100 text-green-800',
      surcharge: 'bg-red-100 text-red-800',
      rate_change: 'bg-blue-100 text-blue-800',
      promotion: 'bg-purple-100 text-purple-800',
      manual_adjustment: 'bg-gray-100 text-gray-800'
    };
    return colors[type as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="fixed inset-0 z-[100] overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        <div aria-hidden="true" className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75" onClick={onClose} />

        <div className="inline-block w-full max-w-4xl p-6 my-8 overflow-hidden text-left align-middle transition-all transform bg-white shadow-xl rounded-lg">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-medium text-gray-900">
              Price Adjustment - Booking #{booking.bookingNumber}
            </h3>
            <button aria-label="Close"
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <XMarkIcon className="w-6 h-6" />
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Adjustment Form */}
            <div className="space-y-6">
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="text-sm font-medium text-gray-900 mb-3">Current Booking Details</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Current Amount:</span>
                    <span className="font-medium">₹{currentAmount.toLocaleString()}</span>
                  </div>
                  {booking.originalAmount && booking.originalAmount !== currentAmount && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Original Amount:</span>
                      <span className="text-gray-500">₹{booking.originalAmount.toLocaleString()}</span>
                    </div>
                  )}
                  {booking.discountAmount && booking.discountAmount > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Total Discounts:</span>
                      <span className="text-green-600">-₹{booking.discountAmount.toLocaleString()}</span>
                    </div>
                  )}
                  {booking.surchargeAmount && booking.surchargeAmount > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Total Surcharges:</span>
                      <span className="text-red-600">+₹{booking.surchargeAmount.toLocaleString()}</span>
                    </div>
                  )}
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Adjustment Type */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Adjustment Type
                  </label>
                  <div className="flex space-x-4">
                    <label className="flex items-center">
                      <input
                        type="radio"
                        value="fixed"
                        checked={adjustmentType === 'fixed'}
                        onChange={(e) => setAdjustmentType(e.target.value as 'fixed')}
                        className="mr-2"
                      />
                      Fixed Amount
                    </label>
                    <label className="flex items-center">
                      <input
                        type="radio"
                        value="percentage"
                        checked={adjustmentType === 'percentage'}
                        onChange={(e) => setAdjustmentType(e.target.value as 'percentage')}
                        className="mr-2"
                      />
                      Percentage
                    </label>
                  </div>
                </div>

                {/* Adjustment Amount */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {adjustmentType === 'fixed' ? 'Amount (₹)' : 'Percentage (%)'}
                  </label>
                  <input
                    type="number"
                    value={adjustmentAmount}
                    onChange={(e) => setAdjustmentAmount(parseFloat(e.target.value) || 0)}
                    step={adjustmentType === 'fixed' ? '1' : '0.1'}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder={adjustmentType === 'fixed' ? 'Enter amount' : 'Enter percentage'}
                    required
                  />
                  <p className="mt-1 text-sm text-gray-500">
                    Use negative values for discounts, positive for surcharges
                  </p>
                </div>

                {/* Category */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Category
                  </label>
                  <select
                    value={adjustmentCategory}
                    onChange={(e) => setAdjustmentCategory(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="manual_adjustment">Manual Adjustment</option>
                    <option value="discount">Discount</option>
                    <option value="surcharge">Surcharge</option>
                    <option value="rate_change">Rate Change</option>
                    <option value="promotion">Promotion</option>
                  </select>
                </div>

                {/* Discount Code */}
                {adjustmentCategory === 'discount' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Discount Code (Optional)
                    </label>
                    <input
                      type="text"
                      value={discountCode}
                      onChange={(e) => setDiscountCode(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Enter discount code"
                    />
                  </div>
                )}

                {/* Reason */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Reason *
                  </label>
                  <textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Explain the reason for this price adjustment"
                    required
                  />
                </div>

                {/* Preview */}
                {adjustmentAmount !== 0 && (
                  <div className={`p-4 rounded-lg ${newAmount >= 0 ? 'bg-blue-50 border border-blue-200' : 'bg-red-50 border border-red-200'}`}>
                    <h5 className="text-sm font-medium text-gray-900 mb-2">Adjustment Preview</h5>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span>Current Amount:</span>
                        <span>₹{currentAmount.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Adjustment:</span>
                        <span className={calculatedAdjustment >= 0 ? 'text-red-600' : 'text-green-600'}>
                          {calculatedAdjustment >= 0 ? '+' : ''}₹{calculatedAdjustment.toLocaleString()}
                        </span>
                      </div>
                      <div className="flex justify-between font-medium pt-1 border-t">
                        <span>New Amount:</span>
                        <span className={newAmount >= 0 ? 'text-gray-900' : 'text-red-600'}>
                          ₹{newAmount.toLocaleString()}
                        </span>
                      </div>
                    </div>
                    {newAmount < 0 && (
                      <div className="mt-2 flex items-center text-red-600 text-sm">
                        <ExclamationTriangleIcon className="w-4 h-4 mr-1" />
                        Warning: Total amount cannot be negative
                      </div>
                    )}
                  </div>
                )}

                {/* Submit Buttons */}
                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200"
                  >
                    Cancel
                  </button>
                  <button aria-label="Apply price adjustment"
                    type="submit"
                    disabled={loading || newAmount < 0 || !reason.trim() || adjustmentAmount === 0}
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? 'Applying...' : 'Apply Adjustment'}
                  </button>
                </div>
              </form>
            </div>

            {/* Price History */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium text-gray-900">Price History</h4>
                <button
                  onClick={() => setShowHistory(!showHistory)}
                  className="text-sm text-blue-600 hover:text-blue-700"
                >
                  {showHistory ? 'Hide' : 'Show'} History
                </button>
              </div>

              {showHistory && (
                <div className="bg-gray-50 rounded-lg p-4 max-h-96 overflow-y-auto">
                  {historyLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                    </div>
                  ) : priceHistory.length > 0 ? (
                    <div className="space-y-3">
                      {priceHistory.map((adjustment) => (
                        <div
                          key={adjustment.adjustmentId}
                          className={`border rounded-lg p-3 ${adjustment.isReversed ? 'bg-gray-100 opacity-75' : 'bg-white'}`}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center space-x-2 mb-1">
                                <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getAdjustmentTypeColor(adjustment.adjustmentType)}`}>
                                  {adjustment.adjustmentType.replace('_', ' ')}
                                </span>
                                {adjustment.isReversed && (
                                  <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">
                                    Reversed
                                  </span>
                                )}
                              </div>
                              <div className="text-sm">
                                <span className="font-medium">
                                  ₹{adjustment.previousAmount.toLocaleString()} → ₹{adjustment.newAmount.toLocaleString()}
                                </span>
                                <span className={`ml-2 ${adjustment.amount >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                                  ({adjustment.amount >= 0 ? '+' : ''}₹{adjustment.amount.toLocaleString()})
                                </span>
                              </div>
                              <div className="text-xs text-gray-600 mt-1">
                                {adjustment.reason}
                              </div>
                              <div className="text-xs text-gray-500 mt-1">
                                by {adjustment.adjustedBy.userName} ({adjustment.adjustedBy.userRole}) • {new Date(adjustment.adjustedAt).toLocaleString()}
                              </div>
                            </div>
                            {!adjustment.isReversed && (
                              <div className="flex flex-col items-end gap-1 ml-2">
                                {reversingAdjustmentId === adjustment.adjustmentId ? (
                                  <div className="flex flex-col gap-1">
                                    <input
                                      type="text"
                                      value={reverseReason}
                                      onChange={(e) => setReverseReason(e.target.value)}
                                      placeholder="Reason for reversal..."
                                      className="text-xs px-2 py-1 border border-gray-300 rounded w-48 focus:outline-none focus:ring-1 focus:ring-red-500"
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') handleReverseAdjustment(adjustment.adjustmentId);
                                        if (e.key === 'Escape') { setReversingAdjustmentId(null); setReverseReason(''); }
                                      }}
                                      autoFocus
                                    />
                                    <div className="flex gap-1">
                                      <button
                                        onClick={() => handleReverseAdjustment(adjustment.adjustmentId)}
                                        className="text-xs text-white bg-red-600 hover:bg-red-700 px-2 py-0.5 rounded"
                                        disabled={!reverseReason.trim()}
                                      >
                                        Confirm
                                      </button>
                                      <button
                                        onClick={() => { setReversingAdjustmentId(null); setReverseReason(''); }}
                                        className="text-xs text-gray-600 hover:text-gray-700 px-2 py-0.5 rounded border border-gray-300"
                                      >
                                        Cancel
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => handleReverseAdjustment(adjustment.adjustmentId)}
                                    className="text-xs text-red-600 hover:text-red-700"
                                  >
                                    Reverse
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <CheckCircleIcon className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                      <p className="text-sm text-gray-500">No price adjustments yet</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PriceAdjustmentModal;