import React from 'react';
import {
  DollarSign,
  Star,
  TrendingDown,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  Calendar,
  Users,
  Bed
} from 'lucide-react';

interface RoomBooking {
  roomTypeId: string;
  roomTypeName: string;
  quantity: number;
  standardRate: number;
  specialRate?: number;
  nights: number;
}

interface PricingBreakdown {
  subtotal: number;
  taxes: number;
  fees: number;
  discounts: number;
  totalAmount: number;
  specialRateDiscount?: number;
  bulkDiscount?: number;
}

interface CommissionDetails {
  baseRate: number;
  bonusRate?: number;
  baseCommission: number;
  bonusCommission?: number;
  totalCommission: number;
}

interface PricingDisplayProps {
  roomBookings: RoomBooking[];
  pricing: PricingBreakdown;
  commission: CommissionDetails;
  nights: number;
  guests?: number;
  checkIn?: Date;
  checkOut?: Date;
  className?: string;
  showCommission?: boolean;
  showDetailedBreakdown?: boolean;
  compact?: boolean;
}

const PricingDisplay: React.FC<PricingDisplayProps> = ({
  roomBookings,
  pricing,
  commission,
  nights,
  guests,
  checkIn,
  checkOut,
  className = '',
  showCommission = true,
  showDetailedBreakdown = true,
  compact = false
}) => {
  const formatCurrency = (amount: number) => {
    return `$${amount.toLocaleString()}`;
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  if (compact) {
    return (
      <div className={`bg-white border border-gray-200 rounded-lg p-4 ${className}`}>
        <div className="flex justify-between items-center mb-3">
          <span className="text-sm text-gray-600">Total Amount</span>
          <span className="text-xl font-bold text-gray-900">
            {formatCurrency(pricing.totalAmount)}
          </span>
        </div>

        {showCommission && (
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600">Your Commission</span>
            <span className="text-lg font-semibold text-indigo-600">
              {formatCurrency(commission.totalCommission)}
            </span>
          </div>
        )}

        {roomBookings.length > 0 && (
          <div className="mt-3 pt-3 border-t border-gray-200">
            <p className="text-xs text-gray-500">
              {roomBookings.reduce((sum, room) => sum + room.quantity, 0)} room(s) × {nights} night(s)
            </p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`bg-white border border-gray-200 rounded-lg p-6 ${className}`}>
      {/* Header */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Pricing Summary</h3>

        {(checkIn && checkOut) && (
          <div className="flex items-center gap-4 text-sm text-gray-600 mb-3">
            <div className="flex items-center gap-1">
              <Calendar className="h-4 w-4" />
              <span>
                {formatDate(checkIn)} - {formatDate(checkOut)}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <Bed className="h-4 w-4" />
              <span>{nights} night{nights !== 1 ? 's' : ''}</span>
            </div>
            {guests && (
              <div className="flex items-center gap-1">
                <Users className="h-4 w-4" />
                <span>{guests} guest{guests !== 1 ? 's' : ''}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Room Breakdown */}
      {showDetailedBreakdown && roomBookings.length > 0 && (
        <div className="mb-6">
          <h4 className="font-medium text-gray-900 mb-3">Room Details</h4>
          <div className="space-y-3">
            {roomBookings.map((room, index) => {
              const rate = room.specialRate || room.standardRate;
              const totalCost = rate * room.quantity * nights;
              const savings = room.specialRate
                ? (room.standardRate - room.specialRate) * room.quantity * nights
                : 0;

              return (
                <div key={`roomBookings-${index}`} className="flex justify-between items-start text-sm">
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">{room.roomTypeName}</p>
                    <div className="text-gray-600 space-y-1">
                      <p>
                        {room.quantity} room{room.quantity > 1 ? 's' : ''} × {nights} night{nights > 1 ? 's' : ''}
                      </p>
                      <div className="flex items-center gap-2">
                        <span>{formatCurrency(rate)}/night</span>
                        {room.specialRate && (
                          <>
                            <span className="text-gray-400 line-through">
                              {formatCurrency(room.standardRate)}
                            </span>
                            <span className="text-green-600 text-xs">
                              Special Rate
                            </span>
                          </>
                        )}
                      </div>
                      {savings > 0 && (
                        <div className="flex items-center gap-1 text-green-600">
                          <TrendingDown className="h-3 w-3" />
                          <span className="text-xs">
                            Save {formatCurrency(savings)}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                  <span className="font-medium text-gray-900">
                    {formatCurrency(totalCost)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Pricing Breakdown */}
      <div className="space-y-3 mb-6">
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Subtotal</span>
          <span className="text-gray-900">{formatCurrency(pricing.subtotal)}</span>
        </div>

        {pricing.discounts > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Discounts</span>
            <span className="text-green-600">-{formatCurrency(pricing.discounts)}</span>
          </div>
        )}

        {pricing.specialRateDiscount && pricing.specialRateDiscount > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Special Rate Savings</span>
            <span className="text-green-600">-{formatCurrency(pricing.specialRateDiscount)}</span>
          </div>
        )}

        {pricing.bulkDiscount && pricing.bulkDiscount > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Bulk Discount</span>
            <span className="text-green-600">-{formatCurrency(pricing.bulkDiscount)}</span>
          </div>
        )}

        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Taxes & Fees</span>
          <span className="text-gray-900">{formatCurrency(pricing.taxes + pricing.fees)}</span>
        </div>

        <div className="border-t border-gray-200 pt-3">
          <div className="flex justify-between items-center">
            <span className="text-lg font-semibold text-gray-900">Total Amount</span>
            <span className="text-xl font-bold text-gray-900">
              {formatCurrency(pricing.totalAmount)}
            </span>
          </div>
        </div>
      </div>

      {/* Commission Section */}
      {showCommission && (
        <div className="bg-indigo-50 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <Star className="h-5 w-5 text-indigo-600" />
            <h4 className="font-semibold text-indigo-900">Your Commission</h4>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-indigo-700">
                Base Commission ({commission.baseRate}%)
              </span>
              <span className="text-indigo-900 font-medium">
                {formatCurrency(commission.baseCommission)}
              </span>
            </div>

            {commission.bonusCommission && commission.bonusCommission > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-indigo-700 flex items-center gap-1">
                  <TrendingUp className="h-3 w-3" />
                  Bonus Commission ({commission.bonusRate || 0}%)
                </span>
                <span className="text-indigo-900 font-medium">
                  {formatCurrency(commission.bonusCommission)}
                </span>
              </div>
            )}

            <div className="border-t border-indigo-200 pt-2">
              <div className="flex justify-between items-center">
                <span className="font-semibold text-indigo-900">Total Commission</span>
                <span className="text-lg font-bold text-indigo-600">
                  {formatCurrency(commission.totalCommission)}
                </span>
              </div>
            </div>
          </div>

          {commission.bonusCommission && commission.bonusCommission > 0 && (
            <div className="mt-3 flex items-start gap-2">
              <CheckCircle className="h-4 w-4 text-green-600 mt-0.5" />
              <p className="text-xs text-green-700">
                Bonus commission applied for special rates or bulk booking!
              </p>
            </div>
          )}
        </div>
      )}

      {/* Additional Information */}
      {showDetailedBreakdown && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-gray-500 mt-0.5" />
            <div className="text-xs text-gray-600 space-y-1">
              <p>• Commission will be paid within 30 days of guest checkout</p>
              <p>• Prices are in INR and include all applicable taxes</p>
              <p>• Special rates and discounts are subject to availability</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PricingDisplay;