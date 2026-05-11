import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { reportsService, BookingsBreakdown } from '../../services/reportsService';
import { formatCurrency } from '../../utils/dashboardUtils';
import { LoadingSpinner } from '../LoadingSpinner';
import { 
  Calendar, 
  BookOpen, 
  TrendingUp,
  Users,
  IndianRupee,
  AlertCircle,
  CheckCircle,
  XCircle,
  Clock
} from 'lucide-react';

interface BookingsBreakdownPopupProps {
  isVisible: boolean;
  hotelId?: string;
  onClose?: () => void;
  position?: 'right' | 'left' | 'bottom';
}

export const BookingsBreakdownPopup: React.FC<BookingsBreakdownPopupProps> = ({
  isVisible,
  hotelId,
  onClose,
  position = 'right'
}) => {
  const [month, setMonth] = useState<number>(new Date().getMonth() + 1);
  const [year, setYear] = useState<number>(new Date().getFullYear());

  const { data: breakdownData, isLoading, error } = useQuery({
    queryKey: ['bookings-breakdown', hotelId, month, year],
    queryFn: () => reportsService.getBookingsBreakdown({
      month,
      year,
      hotelId
    }),
    enabled: isVisible,
    staleTime: 2 * 60 * 1000,
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

  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case 'confirmed':
        return <CheckCircle className="h-3 w-3 text-green-500" />;
      case 'cancelled':
        return <XCircle className="h-3 w-3 text-red-500" />;
      case 'pending':
        return <Clock className="h-3 w-3 text-yellow-500" />;
      default:
        return <BookOpen className="h-3 w-3 text-blue-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'confirmed':
        return 'bg-green-500';
      case 'cancelled':
        return 'bg-red-500';
      case 'pending':
        return 'bg-yellow-500';
      default:
        return 'bg-blue-500';
    }
  };

  return (
    <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
      <div 
        className={positionClasses.popup}
        style={{
          animation: positionClasses.animation
        }}
      >
        <div className={positionClasses.arrow}>
          <div className={positionClasses.arrowShape}></div>
        </div>

        <div className="p-4">
          <div className="bg-gradient-to-r from-purple-50 to-pink-50 -m-4 mb-4 p-4 rounded-t-xl border-b border-gray-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <BookOpen className="h-5 w-5 text-purple-600" />
                </div>
                <h3 className="text-lg font-bold text-gray-800">Bookings Breakdown</h3>
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

          <div className="flex items-center space-x-2 mb-3 text-sm">
            <Calendar className="h-4 w-4 text-gray-400" />
            <select
              value={month}
              onChange={(e) => setMonth(parseInt(e.target.value))}
              className="border border-gray-300 rounded px-2 py-1 text-sm"
            >
              {Array.from({ length: 12 }, (_, i) => (
                <option key={i + 1} value={i + 1}>
                  {new Date(2023, i, 1).toLocaleString('default', { month: 'long' })}
                </option>
              ))}
            </select>
            <select
              value={year}
              onChange={(e) => setYear(parseInt(e.target.value))}
              className="border border-gray-300 rounded px-2 py-1 text-sm"
            >
              {Array.from({ length: 5 }, (_, i) => {
                const y = new Date().getFullYear() - 4 + i;
                return (
                  <option key={y} value={y}>{y}</option>
                );
              })}
            </select>
          </div>

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
              <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-blue-800">Total Bookings</span>
                  <span className="text-lg font-bold text-blue-900">
                    {breakdownData.total || 0}
                  </span>
                </div>
                <div className="text-xs text-blue-600 mt-1">
                  {breakdownData.period?.monthName} {breakdownData.period?.year}
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-gray-700 flex items-center">
                  <Users className="h-4 w-4 mr-1" />
                  By Status
                </h4>
                
                {(breakdownData.byStatus || []).map((status) => (
                  <div key={status?.status || 'unknown'} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-b-0">
                    <div className="flex items-center space-x-2">
                      <div className={`w-3 h-3 rounded-full ${getStatusColor(status?.status || '')}`}></div>
                      <span className="text-sm text-gray-700 capitalize">{status?.status || 'Unknown'}</span>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-medium text-gray-900">
                        {status?.count || 0} ({status?.percentage || '0'}%)
                      </div>
                      <div className="text-xs text-gray-500">
                        {formatCurrency(status?.revenue || 0)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {(breakdownData.bySource || []).length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold text-gray-700 flex items-center">
                    <TrendingUp className="h-4 w-4 mr-1" />
                    By Source
                  </h4>
                  
                  {(breakdownData.bySource || []).map((source) => (
                    <div key={source?.source || 'unknown'} className="flex items-center justify-between py-1">
                      <span className="text-sm text-gray-600 capitalize">{source?.source || 'Unknown'}</span>
                      <div className="text-right">
                        <span className="text-sm font-medium text-gray-900">
                          {source?.count || 0} ({source?.percentage || '0'}%)
                        </span>
                        <div className="text-xs text-gray-500">
                          Avg: {formatCurrency(source?.averageValue || 0)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {(breakdownData.weekly || []).length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold text-gray-700 flex items-center">
                    <Calendar className="h-4 w-4 mr-1" />
                    Weekly Trend
                  </h4>
                  
                  {(breakdownData.weekly || []).slice(0, 3).map((week, index) => (
                    <div key={week?.week || index} className="flex items-center justify-between py-1">
                      <span className="text-sm text-gray-600">Week {week?.week || 'N/A'}</span>
                      <div className="text-right">
                        <span className="text-sm font-medium text-gray-900">
                          {week?.count || 0} bookings
                        </span>
                        <div className="text-xs text-gray-500">
                          {formatCurrency(week?.revenue || 0)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="bg-green-50 p-3 rounded-lg border border-green-200">
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <div className="text-green-600 font-medium">Total Revenue</div>
                    <div className="text-green-900 font-semibold">
                      {formatCurrency(breakdownData.metrics?.totalRevenue || 0)}
                    </div>
                  </div>
                  <div>
                    <div className="text-green-600 font-medium">Avg. Value</div>
                    <div className="text-green-900 font-semibold">
                      {formatCurrency(breakdownData.metrics?.averageBookingValue || 0)}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-between items-center text-xs text-gray-500">
                <span>Confirmation Rate: {(Number(breakdownData.metrics?.confirmationRate) || 0).toFixed(1)}%</span>
                <span>Cancellation Rate: {(Number(breakdownData.metrics?.cancellationRate) || 0).toFixed(1)}%</span>
              </div>
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