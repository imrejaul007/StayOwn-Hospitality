import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { reportsService, OccupancyBreakdown } from '../../services/reportsService';
import { LoadingSpinner } from '../LoadingSpinner';
import {
  Building,
  Calendar,
  Users,
  Bed,
  AlertCircle,
  Activity
} from 'lucide-react';

interface OccupancyBreakdownPopupProps {
  isVisible: boolean;
  hotelId?: string;
  onClose?: () => void;
  position?: 'right' | 'left' | 'bottom';
}

export const OccupancyBreakdownPopup: React.FC<OccupancyBreakdownPopupProps> = ({
  isVisible,
  hotelId,
  onClose,
  position = 'right'
}) => {
  const [month, setMonth] = useState<number>(new Date().getMonth() + 1);
  const [year, setYear] = useState<number>(new Date().getFullYear());

  const { data: breakdownData, isLoading, error } = useQuery({
    queryKey: ['occupancy-breakdown', hotelId, month, year],
    queryFn: () => reportsService.getOccupancyBreakdown({
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

  const formatPercentage = (value: number | string | undefined | null) => `${(Number(value) || 0).toFixed(1)}%`;

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
          <div className="bg-gradient-to-r from-blue-50 to-purple-50 -m-4 mb-4 p-4 rounded-t-xl border-b border-gray-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Building className="h-5 w-5 text-blue-600" />
                </div>
                <h3 className="text-lg font-bold text-gray-800">Occupancy Breakdown</h3>
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

          <div className="bg-blue-50 rounded-lg p-3 mb-4 text-center">
            <div className="flex items-center justify-center space-x-2 text-blue-700">
              <Activity className="h-4 w-4" />
              <span className="text-sm font-semibold">Real-Time Current Occupancy</span>
            </div>
            <div className="text-xs text-blue-600 mt-1">
              {breakdownData?.period?.currentTime || 'Live Status'}
            </div>
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
                  <span className="text-sm font-medium text-blue-800">Overall Rate</span>
                  <span className="text-lg font-bold text-blue-900">
                    {formatPercentage(breakdownData.overall?.rate || 0)}
                  </span>
                </div>
                <div className="text-xs text-blue-600 mt-1 flex items-center space-x-4">
                  <span>{breakdownData.overall?.occupiedRooms || 0} / {breakdownData.overall?.totalRooms || 0} rooms</span>
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-gray-700 flex items-center">
                  <Bed className="h-4 w-4 mr-1" />
                  By Room Type
                </h4>
                
                {(breakdownData.byRoomType || []).map((roomType) => (
                  <div key={roomType?.type || 'unknown'} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-b-0">
                    <div className="flex items-center space-x-2">
                      <div 
                        className="w-3 h-3 rounded-full bg-blue-500"
                      ></div>
                      <span className="text-sm text-gray-700">{roomType?.type || 'Unknown'}</span>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-medium text-gray-900">
                        {formatPercentage(roomType?.rate)}
                      </div>
                      <div className="text-xs text-gray-500">
                        {roomType?.occupiedRooms || 0}/{roomType?.totalRooms || 0} rooms
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {(breakdownData.occupiedRooms || []).length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold text-gray-700 flex items-center">
                    <Users className="h-4 w-4 mr-1" />
                    Currently Occupied Rooms
                  </h4>
                  
                  <div className="bg-white rounded-lg border border-gray-200 max-h-32 overflow-y-auto scrollbar-hide">
                    {(breakdownData.occupiedRooms || []).slice(0, 8).map((room, index) => (
                      <div key={`room-${index}`} className="flex items-center justify-between py-2 px-3 border-b border-gray-100 last:border-b-0">
                        <div className="flex items-center space-x-2">
                          <div className="w-2 h-2 rounded-full bg-red-500"></div>
                          <span className="text-sm font-medium text-gray-700">Room {room?.roomNumber}</span>
                        </div>
                        <div className="text-right">
                          <div className="text-xs text-gray-600">{room?.type}</div>
                          <div className="text-xs text-green-600">{room?.status}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                  {(breakdownData.occupiedRooms || []).length > 8 && (
                    <div className="text-xs text-gray-500 text-center">
                      +{(breakdownData.occupiedRooms || []).length - 8} more rooms occupied
                    </div>
                  )}
                </div>
              )}

              {(breakdownData.availableRooms || []).length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold text-gray-700 flex items-center">
                    <Bed className="h-4 w-4 mr-1 text-green-500" />
                    Available Rooms (Sample)
                  </h4>
                  
                  <div className="bg-white rounded-lg border border-gray-200">
                    {(breakdownData.availableRooms || []).slice(0, 5).map((room, index) => (
                      <div key={`room-${index}`} className="flex items-center justify-between py-2 px-3 border-b border-gray-100 last:border-b-0">
                        <div className="flex items-center space-x-2">
                          <div className="w-2 h-2 rounded-full bg-green-500"></div>
                          <span className="text-sm font-medium text-gray-700">Room {room?.roomNumber}</span>
                        </div>
                        <div className="text-right">
                          <div className="text-xs text-gray-600">{room?.type}</div>
                          <div className="text-xs text-green-600">Available</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="bg-green-50 p-3 rounded-lg border border-green-200">
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <div className="text-green-600 font-medium">Avg. Rate</div>
                    <div className="text-green-900 font-semibold">
                      {formatPercentage(breakdownData.metrics?.averageRate || 0)}
                    </div>
                  </div>
                  <div>
                    <div className="text-green-600 font-medium">Room Nights</div>
                    <div className="text-green-900 font-semibold">
                      {breakdownData.metrics?.roomNights || 0}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-between items-center text-xs text-gray-500">
                <span>Peak: {formatPercentage(breakdownData.metrics?.peakOccupancy || 0)}</span>
                <span>Lowest: {formatPercentage(breakdownData.metrics?.lowestOccupancy || 0)}</span>
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