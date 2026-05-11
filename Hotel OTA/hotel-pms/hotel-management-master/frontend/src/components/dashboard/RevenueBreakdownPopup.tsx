import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { reportsService, RevenueBreakdown } from '../../services/reportsService';
import { formatCurrency } from '../../utils/dashboardUtils';
import { LoadingSpinner } from '../LoadingSpinner';
import {
  PieChart,
  IndianRupee,
  Calendar,
  Users,
  AlertCircle
} from 'lucide-react';

interface RevenueBreakdownPopupProps {
  isVisible: boolean;
  hotelId?: string;
  onClose?: () => void;
  position?: 'right' | 'left' | 'bottom';
}

const POPUP_STYLE_ID = 'breakdownPopupAnimations';

function ensureBreakdownStyles() {
  if (typeof document === 'undefined') return;
  if (document.getElementById(POPUP_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = POPUP_STYLE_ID;
  style.textContent = `
    @keyframes fadeInRight {
      from { opacity: 0; transform: translateY(-50%) translateX(-10px); }
      to { opacity: 1; transform: translateY(-50%) translateX(0); }
    }
    @keyframes fadeInLeft {
      from { opacity: 0; transform: translateY(-50%) translateX(10px); }
      to { opacity: 1; transform: translateY(-50%) translateX(0); }
    }
    @keyframes fadeInUp {
      from { opacity: 0; transform: translateX(-50%) translateY(-10px); }
      to { opacity: 1; transform: translateX(-50%) translateY(0); }
    }
    .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
    .scrollbar-hide::-webkit-scrollbar { display: none; }
  `;
  document.head.appendChild(style);
}

export const RevenueBreakdownPopup: React.FC<RevenueBreakdownPopupProps> = ({
  isVisible,
  hotelId,
  onClose,
  position = 'right'
}) => {
  const [month, setMonth] = useState<number>(new Date().getMonth() + 1);
  const [year, setYear] = useState<number>(new Date().getFullYear());

  useEffect(() => {
    ensureBreakdownStyles();
  }, []);

  const { data: breakdownData, isLoading, error, refetch } = useQuery({
    queryKey: ['revenue-breakdown', hotelId, month, year],
    queryFn: () => reportsService.getRevenueBreakdown({
      month,
      year,
      hotelId
    }),
    enabled: isVisible,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });

  if (!isVisible) return null;

  const getPositionClasses = () => {
    switch (position) {
      case 'left':
        return {
          popup: 'absolute top-1/2 right-full transform -translate-y-1/2 mr-2 w-80 bg-white rounded-xl shadow-2xl border-0 z-50 pointer-events-auto max-h-96 overflow-y-auto scrollbar-hide backdrop-blur-sm',
          arrow: 'absolute top-1/2 -right-1 transform -translate-y-1/2',
          arrowShape: 'w-4 h-4 bg-white shadow-lg transform rotate-45',
          animation: 'fadeInLeft 0.3s ease-out'
        };
      case 'bottom':
        return {
          popup: 'absolute top-full left-1/2 transform -translate-x-1/2 mt-2 w-80 bg-white rounded-xl shadow-2xl border-0 z-50 pointer-events-auto max-h-96 overflow-y-auto scrollbar-hide backdrop-blur-sm',
          arrow: 'absolute -top-1 left-1/2 transform -translate-x-1/2',
          arrowShape: 'w-4 h-4 bg-white shadow-lg transform rotate-45',
          animation: 'fadeInUp 0.3s ease-out'
        };
      case 'right':
      default:
        return {
          popup: 'absolute top-1/2 left-full transform -translate-y-1/2 ml-2 w-80 bg-white rounded-xl shadow-2xl border-0 z-50 pointer-events-auto max-h-96 overflow-y-auto scrollbar-hide backdrop-blur-sm',
          arrow: 'absolute top-1/2 -left-1 transform -translate-y-1/2',
          arrowShape: 'w-4 h-4 bg-white shadow-lg transform rotate-45',
          animation: 'fadeInRight 0.3s ease-out'
        };
    }
  };

  const positionClasses = getPositionClasses();

  return (
    <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
      <div 
        className={positionClasses.popup}
        style={{
          animation: positionClasses.animation
        }}
      >
        {/* Arrow pointing to the MetricCard */}
        <div className={positionClasses.arrow}>
          <div className={positionClasses.arrowShape}></div>
        </div>

        <div className="p-4">
          {/* Header with gradient background */}
          <div className="bg-gradient-to-r from-blue-50 to-green-50 -m-4 mb-4 p-4 rounded-t-xl border-b border-gray-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <PieChart className="h-5 w-5 text-blue-600" />
                </div>
                <h3 className="text-lg font-bold text-gray-800">Revenue Breakdown</h3>
              </div>
              {onClose && (
                <button aria-label="Close"
                  onClick={onClose}
                  className="text-gray-400 hover:text-gray-600 transition-colors p-1 hover:bg-white rounded-full"
                >
                  <AlertCircle className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          {/* Period Selector with better styling */}
          <div className="bg-gray-50 rounded-lg p-3 mb-4">
            <div className="flex items-center justify-center space-x-3">
              <div className="flex items-center space-x-2 bg-white rounded-md px-3 py-2 shadow-sm">
                <Calendar className="h-4 w-4 text-blue-500" />
                <select
                  value={month}
                  onChange={(e) => setMonth(parseInt(e.target.value))}
                  className="border-0 bg-transparent text-sm font-medium text-gray-700 focus:outline-none"
                >
                  {Array.from({ length: 12 }, (_, i) => (
                    <option key={i + 1} value={i + 1}>
                      {new Date(2023, i, 1).toLocaleString('default', { month: 'long' })}
                    </option>
                  ))}
                </select>
              </div>
              <div className="bg-white rounded-md px-3 py-2 shadow-sm">
                <select
                  value={year}
                  onChange={(e) => setYear(parseInt(e.target.value))}
                  className="border-0 bg-transparent text-sm font-medium text-gray-700 focus:outline-none"
                >
                  {Array.from({ length: 5 }, (_, i) => {
                    const y = new Date().getFullYear() - 4 + i;
                    return (
                      <option key={y} value={y}>{y}</option>
                    );
                  })}
                </select>
              </div>
            </div>
          </div>

          {/* Content */}
          {isLoading ? (
            <div className="flex items-center justify-center h-32">
              <LoadingSpinner size="sm" />
            </div>
          ) : error ? (
            <div className="text-center h-32 flex items-center justify-center">
              <div className="text-red-500 text-sm">
                <AlertCircle className="h-8 w-8 mx-auto mb-2" />
                Failed to load breakdown
              </div>
            </div>
          ) : breakdownData ? (
            <div className="space-y-4">
              {/* Total Revenue with enhanced styling */}
              <div className="bg-gradient-to-r from-green-50 to-emerald-50 p-4 rounded-lg border-l-4 border-green-400 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div className="p-1 bg-green-100 rounded">
                      <IndianRupee className="h-4 w-4 text-green-600" />
                    </div>
                    <span className="text-sm font-semibold text-green-800">Total Revenue</span>
                  </div>
                  <span className="text-xl font-bold text-green-900">
                    {formatCurrency(breakdownData.total)}
                  </span>
                </div>
                <div className="text-xs text-green-600 mt-2 font-medium">
                  {breakdownData.period.monthName} {breakdownData.period.year}
                </div>
              </div>

              {/* Revenue Components with enhanced styling */}
              <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
                  <h4 className="text-sm font-semibold text-gray-700 flex items-center">
                    <IndianRupee className="h-4 w-4 mr-2 text-blue-500" />
                    Revenue Sources
                  </h4>
                </div>
                <div className="divide-y divide-gray-100">
                  {Object.entries(breakdownData.components).map(([key, component]) => (
                    <div key={key} className="flex items-center justify-between py-3 px-4 hover:bg-gray-50 transition-colors">
                      <div className="flex items-center space-x-3">
                        <div 
                          className="w-4 h-4 rounded-full shadow-sm"
                          style={{
                            backgroundColor: 
                              key === 'roomRevenue' ? '#10b981' :
                              key === 'taxRevenue' ? '#f59e0b' :
                              key === 'serviceRevenue' ? '#3b82f6' :
                              '#8b5cf6'
                          }}
                        ></div>
                        <span className="text-sm font-medium text-gray-700">{component.label}</span>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-bold text-gray-900">
                          {formatCurrency(component.amount)}
                        </div>
                        <div className="text-xs text-gray-500 font-medium">{component.percentage}%</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Room Type Breakdown (if available) */}
              {breakdownData.byRoomType.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold text-gray-700 flex items-center">
                    <Users className="h-4 w-4 mr-1" />
                    By Room Type
                  </h4>
                  
                  {breakdownData.byRoomType.map((roomType) => (
                    <div key={roomType.type} className="flex items-center justify-between py-1">
                      <span className="text-sm text-gray-600">{roomType.type}</span>
                      <div className="text-right">
                        <span className="text-sm font-medium text-gray-900">
                          {formatCurrency(roomType.amount)}
                        </span>
                        <span className="text-xs text-gray-500 ml-1">({roomType.percentage}%)</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Key Metrics */}
              <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <div className="text-blue-600 font-medium">Total Bookings</div>
                    <div className="text-blue-900 font-semibold">{breakdownData.metrics.totalBookings}</div>
                  </div>
                  <div>
                    <div className="text-blue-600 font-medium">Avg. Booking</div>
                    <div className="text-blue-900 font-semibold">
                      {formatCurrency(breakdownData.metrics.averageBookingValue)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Refunds (if any) */}
              {breakdownData.metrics.refunds > 0 && (
                <div className="bg-red-50 p-2 rounded border border-red-200">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-red-600">Refunds</span>
                    <span className="text-red-900 font-medium">
                      -{formatCurrency(breakdownData.metrics.refunds)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center h-32 flex items-center justify-center text-gray-500">
              No data available
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Styles are injected via ensureBreakdownStyles() in the component's useEffect above.