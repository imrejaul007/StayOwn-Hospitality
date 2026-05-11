import React, { useState, useEffect } from 'react';
import {
  Banknote,
  Calculator,
  Percent,
  TrendingDown,
  TrendingUp,
  Info,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Star,
  AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';

interface RoomBooking {
  id: string;
  roomTypeId: string;
  roomTypeName: string;
  guestDetails: {
    totalGuests: number;
  };
  addOns: Array<{
    name: string;
    price: number;
    quantity: number;
  }>;
  ratePerNight: number;
  specialRate?: number;
}

interface BookingDates {
  checkIn: Date;
  checkOut: Date;
  nights: number;
}

interface BulkPricing {
  subtotal: number;
  taxes: number;
  fees: number;
  discounts: number;
  totalAmount: number;
  commissionAmount: number;
  roomBreakdown: Array<{
    roomId: string;
    roomTotal: number;
    commission: number;
  }>;
}

interface BulkPricingCalculatorProps {
  roomBookings: RoomBooking[];
  bookingDates: BookingDates;
  bulkPricing: BulkPricing;
  onPricingUpdate: (pricing: BulkPricing) => void;
}

interface DiscountTier {
  minRooms: number;
  discountPercent: number;
  name: string;
  description: string;
}

const BulkPricingCalculator: React.FC<BulkPricingCalculatorProps> = ({
  roomBookings,
  bookingDates,
  bulkPricing,
  onPricingUpdate
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [isCalculating, setIsCalculating] = useState(false);
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [appliedDiscounts, setAppliedDiscounts] = useState<string[]>([]);

  // Commission rates and discount tiers
  const baseCommissionRate = 8; // 8%
  const bonusCommissionRate = 2; // Additional 2% for bulk bookings

  const discountTiers: DiscountTier[] = [
    { minRooms: 3, discountPercent: 5, name: 'Group Discount', description: '5% off for 3+ rooms' },
    { minRooms: 5, discountPercent: 8, name: 'Large Group', description: '8% off for 5+ rooms' },
    { minRooms: 10, discountPercent: 12, name: 'Corporate Rate', description: '12% off for 10+ rooms' },
    { minRooms: 20, discountPercent: 15, name: 'Conference Rate', description: '15% off for 20+ rooms' }
  ];

  useEffect(() => {
    calculatePricing();
  }, [roomBookings, bookingDates]);

  const calculatePricing = async () => {
    setIsCalculating(true);

    try {
      // Calculate base pricing for each room
      let subtotal = 0;
      const roomBreakdown: Array<{ roomId: string; roomTotal: number; commission: number }> = [];

      roomBookings.forEach((room) => {
        if (!room.roomTypeId) return;

        const nightlyRate = room.specialRate || room.ratePerNight;
        const roomNightlyTotal = nightlyRate * bookingDates.nights;
        const addOnsTotal = room.addOns.reduce((sum, addon) => sum + (addon.price * addon.quantity), 0);
        const roomTotal = roomNightlyTotal + addOnsTotal;

        subtotal += roomTotal;

        // Calculate commission for this room
        const roomCommission = (roomTotal * (baseCommissionRate + (roomBookings.length >= 3 ? bonusCommissionRate : 0))) / 100;

        roomBreakdown.push({
          roomId: room.id,
          roomTotal,
          commission: roomCommission
        });
      });

      // Apply bulk discounts
      const applicableDiscount = getApplicableDiscount(roomBookings.length);
      const discountAmount = applicableDiscount ? (subtotal * applicableDiscount.discountPercent) / 100 : 0;

      // Calculate taxes and fees
      const taxRate = 12; // 12% tax
      const serviceFeeRate = 3; // 3% service fee

      const discountedSubtotal = subtotal - discountAmount;
      const taxes = (discountedSubtotal * taxRate) / 100;
      const fees = (discountedSubtotal * serviceFeeRate) / 100;
      const totalAmount = discountedSubtotal + taxes + fees;

      // Calculate total commission
      const totalCommissionRate = baseCommissionRate + (roomBookings.length >= 3 ? bonusCommissionRate : 0);
      const commissionAmount = (discountedSubtotal * totalCommissionRate) / 100;

      const pricing: BulkPricing = {
        subtotal,
        taxes,
        fees,
        discounts: discountAmount,
        totalAmount,
        commissionAmount,
        roomBreakdown
      };

      // Update applied discounts
      const newAppliedDiscounts: string[] = [];
      if (applicableDiscount) {
        newAppliedDiscounts.push(applicableDiscount.name);
      }
      if (roomBookings.length >= 3) {
        newAppliedDiscounts.push('Bulk Commission Bonus');
      }
      setAppliedDiscounts(newAppliedDiscounts);

      onPricingUpdate(pricing);
    } catch {
      // Error handled silently
    } finally {
      setIsCalculating(false);
    }
  };

  const getApplicableDiscount = (roomCount: number): DiscountTier | null => {
    const applicableDiscounts = discountTiers.filter(tier => roomCount >= tier.minRooms);
    return applicableDiscounts.length > 0 ? applicableDiscounts[applicableDiscounts.length - 1] : null;
  };

  const getNextDiscountTier = (roomCount: number): DiscountTier | null => {
    return discountTiers.find(tier => roomCount < tier.minRooms) || null;
  };

  const formatCurrency = (amount: number) => {
    return `₹${amount.toLocaleString()}`;
  };

  const currentDiscount = getApplicableDiscount(roomBookings.length);
  const nextTier = getNextDiscountTier(roomBookings.length);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-lg shadow-sm overflow-hidden"
    >
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-lg">
              <Calculator className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">Pricing Calculator</h3>
              <p className="text-indigo-100 text-sm">
                {roomBookings.length} rooms • {bookingDates.nights} nights
              </p>
            </div>
          </div>
          <button aria-label="Expand"
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-2 hover:bg-white/20 rounded-lg transition-colors"
          >
            {isExpanded ? (
              <ChevronUp className="h-5 w-5" />
            ) : (
              <ChevronDown className="h-5 w-5" />
            )}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: 'auto' }}
            exit={{ height: 0 }}
            className="overflow-hidden"
          >
            <div className="p-6 space-y-6">
              {/* Quick Stats */}
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-4 bg-blue-50 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">
                    {formatCurrency(bulkPricing.totalAmount)}
                  </div>
                  <div className="text-sm text-blue-700">Total Amount</div>
                </div>
                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">
                    {formatCurrency(bulkPricing.commissionAmount)}
                  </div>
                  <div className="text-sm text-green-700">Your Commission</div>
                </div>
              </div>

              {/* Discount Information */}
              {currentDiscount && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="bg-green-50 border border-green-200 rounded-lg p-4"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingDown className="h-5 w-5 text-green-600" />
                    <span className="font-medium text-green-800">
                      {currentDiscount.name} Applied!
                    </span>
                  </div>
                  <p className="text-sm text-green-700">
                    {currentDiscount.description} - Saving {formatCurrency(bulkPricing.discounts)}
                  </p>
                </motion.div>
              )}

              {/* Next Tier Incentive */}
              {nextTier && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Star className="h-5 w-5 text-yellow-600" />
                    <span className="font-medium text-yellow-800">
                      Upgrade Opportunity
                    </span>
                  </div>
                  <p className="text-sm text-yellow-700">
                    Add {nextTier.minRooms - roomBookings.length} more room(s) to unlock{' '}
                    <strong>{nextTier.name}</strong> and save {nextTier.discountPercent}%!
                  </p>
                </div>
              )}

              {/* Applied Discounts */}
              {appliedDiscounts.length > 0 && (
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Applied Benefits</h4>
                  <div className="space-y-2">
                    {appliedDiscounts.map((discount, index) => (
                      <div
                        key={`appliedDiscounts-${index}-${discount}`}
                        className="flex items-center gap-2 text-sm text-green-700 bg-green-50 px-3 py-2 rounded-lg"
                      >
                        <TrendingDown className="h-4 w-4" />
                        {discount}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Pricing Breakdown */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Subtotal ({roomBookings.length} rooms)</span>
                  <span className="font-medium">{formatCurrency(bulkPricing.subtotal)}</span>
                </div>

                {bulkPricing.discounts > 0 && (
                  <div className="flex items-center justify-between text-green-600">
                    <span className="flex items-center gap-1">
                      <TrendingDown className="h-4 w-4" />
                      Bulk Discount
                    </span>
                    <span className="font-medium">-{formatCurrency(bulkPricing.discounts)}</span>
                  </div>
                )}

                <div className="flex items-center justify-between text-gray-600">
                  <span>Taxes & Fees</span>
                  <span>{formatCurrency(bulkPricing.taxes + bulkPricing.fees)}</span>
                </div>

                <div className="border-t pt-3 flex items-center justify-between text-lg font-semibold">
                  <span>Total Amount</span>
                  <span className="text-indigo-600">{formatCurrency(bulkPricing.totalAmount)}</span>
                </div>

                <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-green-700 font-medium">Your Commission</span>
                    <span className="text-green-600 font-bold text-lg">
                      {formatCurrency(bulkPricing.commissionAmount)}
                    </span>
                  </div>
                  <div className="text-sm text-green-600 mt-1">
                    {baseCommissionRate}% base + {roomBookings.length >= 3 ? bonusCommissionRate : 0}% bulk bonus
                  </div>
                </div>
              </div>

              {/* Detailed Breakdown */}
              <div>
                <button
                  onClick={() => setShowBreakdown(!showBreakdown)}
                  className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-800 transition-colors"
                >
                  <Info className="h-4 w-4" />
                  {showBreakdown ? 'Hide' : 'Show'} Room Breakdown
                  {showBreakdown ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </button>

                <AnimatePresence>
                  {showBreakdown && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="mt-3 space-y-3"
                    >
                      {roomBookings.map((room, index) => {
                        const breakdown = bulkPricing.roomBreakdown.find(r => r.roomId === room.id);
                        if (!breakdown) return null;

                        return (
                          <div
                            key={room.id}
                            className="bg-gray-50 rounded-lg p-3 border border-gray-200"
                          >
                            <div className="flex items-center justify-between mb-2">
                              <span className="font-medium text-gray-900">
                                Room {index + 1} - {room.roomTypeName || 'Room Type'}
                              </span>
                              <span className="font-medium">
                                {formatCurrency(breakdown.roomTotal)}
                              </span>
                            </div>
                            <div className="text-sm text-gray-600 space-y-1">
                              <div className="flex justify-between">
                                <span>Base rate ({bookingDates.nights} nights)</span>
                                <span>
                                  {formatCurrency((room.specialRate || room.ratePerNight) * bookingDates.nights)}
                                </span>
                              </div>
                              {room.addOns.length > 0 && (
                                <div className="flex justify-between">
                                  <span>Add-ons</span>
                                  <span>
                                    {formatCurrency(room.addOns.reduce((sum, addon) => sum + (addon.price * addon.quantity), 0))}
                                  </span>
                                </div>
                              )}
                              <div className="flex justify-between text-green-600 font-medium">
                                <span>Commission</span>
                                <span>{formatCurrency(breakdown.commission)}</span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Recalculate Button */}
              <button aria-label="Refresh"
                onClick={calculatePricing}
                disabled={isCalculating}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-indigo-100 text-indigo-700 rounded-lg hover:bg-indigo-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <RefreshCw className={`h-4 w-4 ${isCalculating ? 'animate-spin' : ''}`} />
                {isCalculating ? 'Calculating...' : 'Recalculate Pricing'}
              </button>

              {/* Booking Dates Summary */}
              <div className="bg-gray-50 rounded-lg p-3 text-sm">
                <div className="font-medium text-gray-900 mb-1">Booking Period</div>
                <div className="text-gray-600">
                  {format(bookingDates.checkIn, 'MMM dd, yyyy')} - {format(bookingDates.checkOut, 'MMM dd, yyyy')}
                </div>
                <div className="text-gray-600">
                  {bookingDates.nights} {bookingDates.nights === 1 ? 'night' : 'nights'}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default BulkPricingCalculator;