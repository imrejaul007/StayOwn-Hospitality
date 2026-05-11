import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { reportsService, SatisfactionBreakdown } from '../../services/reportsService';
import { LoadingSpinner } from '../LoadingSpinner';
import { 
  Star, 
  Heart, 
  TrendingUp,
  Users,
  Calendar,
  AlertCircle,
  ThumbsUp,
  ThumbsDown,
  Minus
} from 'lucide-react';

interface SatisfactionBreakdownPopupProps {
  isVisible: boolean;
  hotelId?: string;
  onClose?: () => void;
  position?: 'right' | 'left' | 'bottom';
}

export const SatisfactionBreakdownPopup: React.FC<SatisfactionBreakdownPopupProps> = ({
  isVisible,
  hotelId,
  onClose,
  position = 'bottom'
}) => {
  const [month, setMonth] = useState<number>(new Date().getMonth() + 1);
  const [year, setYear] = useState<number>(new Date().getFullYear());

  const { data: breakdownData, isLoading, error } = useQuery({
    queryKey: ['satisfaction-breakdown', hotelId, month, year],
    queryFn: () => reportsService.getSatisfactionBreakdown({
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
      case 'right':
        return {
          popup: 'absolute top-1/2 left-full transform -translate-y-1/2 ml-2 w-80 bg-white rounded-xl shadow-2xl border-0 z-50 pointer-events-auto max-h-96 overflow-y-auto scrollbar-hide backdrop-blur-sm',
          arrow: 'absolute top-1/2 -left-1 transform -translate-y-1/2',
          arrowShape: 'w-4 h-4 bg-white shadow-lg transform rotate-45',
          animation: 'fadeInRight 0.3s ease-out'
        };
      case 'bottom':
      default:
        return {
          popup: 'absolute top-full left-1/2 transform -translate-x-1/2 mt-2 w-80 bg-white rounded-xl shadow-2xl border-0 z-50 pointer-events-auto max-h-96 overflow-y-auto scrollbar-hide backdrop-blur-sm',
          arrow: 'absolute -top-1 left-1/2 transform -translate-x-1/2',
          arrowShape: 'w-4 h-4 bg-white shadow-lg transform rotate-45',
          animation: 'fadeInUp 0.3s ease-out'
        };
    }
  };

  const positionClasses = getPositionClasses();

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star
        key={i}
        className={`h-3 w-3 ${i < rating ? 'text-yellow-400 fill-current' : 'text-gray-300'}`}
      />
    ));
  };

  const getRatingColor = (rating: number) => {
    if (rating >= 4) return 'bg-green-500';
    if (rating >= 3) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const getScoreIcon = (type: string) => {
    switch (type) {
      case 'promoter':
        return <ThumbsUp className="h-3 w-3 text-green-500" />;
      case 'detractor':
        return <ThumbsDown className="h-3 w-3 text-red-500" />;
      default:
        return <Minus className="h-3 w-3 text-yellow-500" />;
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
          <div className="bg-gradient-to-r from-pink-50 to-rose-50 -m-4 mb-4 p-4 rounded-t-xl border-b border-gray-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-pink-100 rounded-lg">
                  <Heart className="h-5 w-5 text-pink-600" />
                </div>
                <h3 className="text-lg font-bold text-gray-800">Guest Satisfaction</h3>
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
              <div className="bg-pink-50 p-3 rounded-lg border border-pink-200">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-pink-800">Overall Rating</span>
                  <div className="flex items-center space-x-1">
                    {renderStars(Math.round(breakdownData.overall?.rating || 0))}
                    <span className="text-sm font-bold text-pink-900 ml-1">
                      {(Number(breakdownData.overall?.rating) || 0).toFixed(1)}
                    </span>
                  </div>
                </div>
                <div className="text-xs text-pink-600 mt-1">
                  {breakdownData.overall?.totalReviews || 0} reviews • {(Number(breakdownData.overall?.responseRate) || 0).toFixed(1)}% response rate
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-gray-700 flex items-center">
                  <Star className="h-4 w-4 mr-1" />
                  Rating Distribution
                </h4>
                
                {(breakdownData.byRating || []).map((rating) => (
                  <div key={rating?.rating || 'unknown'} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-b-0">
                    <div className="flex items-center space-x-2">
                      <div className={`w-3 h-3 rounded-full ${getRatingColor(rating?.rating || 0)}`}></div>
                      <div className="flex items-center space-x-1">
                        {renderStars(rating?.rating || 0)}
                        <span className="text-sm text-gray-700 ml-1">{rating?.rating || 0} stars</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-medium text-gray-900">
                        {rating?.count || 0} ({rating?.percentage || '0'}%)
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {(breakdownData.byCategory || []).length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold text-gray-700 flex items-center">
                    <Users className="h-4 w-4 mr-1" />
                    By Category
                  </h4>
                  
                  {(breakdownData.byCategory || []).map((category) => (
                    <div key={category?.category || 'unknown'} className="flex items-center justify-between py-1">
                      <span className="text-sm text-gray-600 capitalize">{category?.category || 'Unknown'}</span>
                      <div className="flex items-center space-x-1">
                        <div className="flex">
                          {renderStars(Math.round(category?.rating || 0))}
                        </div>
                        <span className="text-sm font-medium text-gray-900">
                          {(Number(category?.rating) || 0).toFixed(1)}
                        </span>
                        <span className="text-xs text-gray-500">
                          ({category?.count || 0})
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
                <h4 className="text-sm font-semibold text-blue-800 mb-2">Net Promoter Score</h4>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div className="text-center">
                    <div className="flex items-center justify-center mb-1">
                      <ThumbsUp className="h-3 w-3 text-green-500 mr-1" />
                      <span className="text-green-600 font-medium">Promoters</span>
                    </div>
                    <div className="text-green-900 font-semibold">
                      {(Number(breakdownData.metrics?.promoterScore) || 0).toFixed(0)}%
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="flex items-center justify-center mb-1">
                      <Minus className="h-3 w-3 text-yellow-500 mr-1" />
                      <span className="text-yellow-600 font-medium">Neutral</span>
                    </div>
                    <div className="text-yellow-900 font-semibold">
                      {(Number(breakdownData.metrics?.neutralScore) || 0).toFixed(0)}%
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="flex items-center justify-center mb-1">
                      <ThumbsDown className="h-3 w-3 text-red-500 mr-1" />
                      <span className="text-red-600 font-medium">Detractors</span>
                    </div>
                    <div className="text-red-900 font-semibold">
                      {(Number(breakdownData.metrics?.detractorScore) || 0).toFixed(0)}%
                    </div>
                  </div>
                </div>
              </div>

              {(breakdownData.trends || []).length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold text-gray-700 flex items-center">
                    <TrendingUp className="h-4 w-4 mr-1" />
                    Weekly Trends
                  </h4>
                  
                  {(breakdownData.trends || []).slice(-3).map((trend, index) => (
                    <div key={trend?.week || index} className="flex items-center justify-between py-1">
                      <span className="text-sm text-gray-600">Week {trend?.week || 'N/A'}</span>
                      <div className="text-right">
                        <div className="flex items-center space-x-1">
                          {renderStars(Math.round(trend?.rating || 0))}
                          <span className="text-sm font-medium text-gray-900 ml-1">
                            {(Number(trend?.rating) || 0).toFixed(1)}
                          </span>
                        </div>
                        <div className="text-xs text-gray-500">
                          {trend?.reviewCount || 0} reviews
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {(breakdownData.metrics?.improvement || 0) !== 0 && (
                <div className={`p-2 rounded border text-xs ${
                  breakdownData.metrics.improvement > 0 
                    ? 'bg-green-50 border-green-200 text-green-700' 
                    : 'bg-red-50 border-red-200 text-red-700'
                }`}>
                  <div className="flex items-center justify-center">
                    {(breakdownData.metrics?.improvement || 0) > 0 ? (
                      <TrendingUp className="h-4 w-4 mr-1" />
                    ) : (
                      <TrendingUp className="h-4 w-4 mr-1 transform rotate-180" />
                    )}
                    <span>
                      {Math.abs(Number(breakdownData.metrics?.improvement) || 0).toFixed(1)}% 
                      {(breakdownData.metrics?.improvement || 0) > 0 ? ' improvement' : ' decline'} this month
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