import React, { useState, useEffect } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  IndianRupee,
  Users,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Settings,
  RefreshCw,
  Download,
  Eye,
  EyeOff
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/Input';
import { Modal } from '../ui/Modal';
import { Badge } from '../ui/Badge';
// import { Select } from '../ui/Select'; // Not compatible with our usage
import { inventoryService, type CalendarData, type InventoryRecord } from '../../services/inventoryService';
import { roomTypeService, type RoomTypeOption } from '../../services/roomTypeService';
import { withErrorBoundary } from '../ErrorBoundary';

interface InventoryCalendarProps {
  hotelId: string;
}

interface CalendarCellData {
  date: string;
  inventory?: InventoryRecord;
  isToday: boolean;
  isWeekend: boolean;
  isPast: boolean;
  dayOfWeek: number;
}

const InventoryCalendar: React.FC<InventoryCalendarProps> = ({ hotelId }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [roomTypes, setRoomTypes] = useState<RoomTypeOption[]>([]);
  const [selectedRoomTypeId, setSelectedRoomTypeId] = useState<string>('');
  const [calendarData, setCalendarData] = useState<CalendarData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedCell, setSelectedCell] = useState<CalendarCellData | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editData, setEditData] = useState<{
    availableRooms?: number;
    baseRate?: number;
    sellingRate?: number;
    stopSell?: boolean;
  }>({});
  const [viewMode, setViewMode] = useState<'availability' | 'rates'>('availability');
  const [showStopSell, setShowStopSell] = useState(true);

  useEffect(() => {
    fetchRoomTypes();
  }, [hotelId]);

  useEffect(() => {
    if (selectedRoomTypeId) {
      fetchCalendarData();
    }
  }, [selectedRoomTypeId, currentDate]);

  const fetchRoomTypes = async () => {
    try {
      const data = await roomTypeService.getRoomTypeOptions(hotelId);
      setRoomTypes(data);
      
      if (data.length > 0 && !selectedRoomTypeId) {
        setSelectedRoomTypeId(data[0].id);
      }
      
      setError(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to fetch room types');
    }
  };

  const fetchCalendarData = async () => {
    if (!selectedRoomTypeId) return;

    try {
      setLoading(true);
      const data = await inventoryService.getInventoryCalendar({
        hotelId,
        roomTypeId: selectedRoomTypeId,
        year: currentDate.getFullYear(),
        month: currentDate.getMonth() + 1
      });
      setCalendarData(data);
      setError(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to fetch calendar data');
    } finally {
      setLoading(false);
    }
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentDate);
    if (direction === 'prev') {
      newDate.setMonth(newDate.getMonth() - 1);
    } else {
      newDate.setMonth(newDate.getMonth() + 1);
    }
    setCurrentDate(newDate);
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const getDaysInMonth = (date: Date): CalendarCellData[] => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const days: CalendarCellData[] = [];

    // Add empty cells for days before the first day of the month
    const firstDayOfWeek = firstDay.getDay();
    for (let i = 0; i < firstDayOfWeek; i++) {
      days.push({
        date: '',
        isToday: false,
        isWeekend: false,
        isPast: false,
        dayOfWeek: i
      });
    }

    // Add cells for each day of the month
    for (let day = 1; day <= lastDay.getDate(); day++) {
      const cellDate = new Date(year, month, day);
      const dateString = cellDate.toISOString().split('T')[0];
      const dayOfWeek = cellDate.getDay();
      
      // Find inventory data for this date
      const selectedRoomType = roomTypes.find(rt => rt.id === selectedRoomTypeId);
      let inventoryData: InventoryRecord | undefined;
      
      if (calendarData && selectedRoomType) {
        const calendarEntry = calendarData.calendar[dateString];
        if (calendarEntry && calendarEntry[selectedRoomType.code]) {
          const entry = calendarEntry[selectedRoomType.code];
          inventoryData = {
            _id: '',
            hotelId,
            roomTypeId: { _id: selectedRoomTypeId, name: selectedRoomType.name, code: selectedRoomType.code, basePrice: selectedRoomType.basePrice },
            date: dateString,
            totalRooms: entry.totalRooms,
            availableRooms: entry.availableRooms,
            soldRooms: entry.soldRooms,
            blockedRooms: entry.blockedRooms,
            baseRate: entry.baseRate,
            sellingRate: entry.sellingRate,
            currency: 'INR',
            stopSellFlag: entry.stopSellFlag,
            closedToArrival: entry.closedToArrival,
            closedToDeparture: entry.closedToDeparture,
            minimumStay: entry.minimumStay,
            maximumStay: entry.maximumStay,
            needsSync: false,
            lastModified: new Date().toISOString()
          };
        }
      }

      days.push({
        date: dateString,
        inventory: inventoryData,
        isToday: cellDate.getTime() === today.getTime(),
        isWeekend: dayOfWeek === 0 || dayOfWeek === 6,
        isPast: cellDate < today,
        dayOfWeek
      });
    }

    return days;
  };

  const getCellColor = (cell: CalendarCellData): string => {
    if (!cell.inventory) return 'bg-gray-100';
    
    const inv = cell.inventory;
    
    if (inv.stopSellFlag && showStopSell) return 'bg-red-100 border-red-300';
    
    if (viewMode === 'availability') {
      const occupancyRate = inv.totalRooms > 0 ? 
        ((inv.soldRooms + inv.blockedRooms) / inv.totalRooms) * 100 : 0;
      
      if (occupancyRate >= 90) return 'bg-red-100 border-red-300';
      if (occupancyRate >= 70) return 'bg-yellow-100 border-yellow-300';
      if (occupancyRate >= 40) return 'bg-green-100 border-green-300';
      return 'bg-blue-100 border-blue-300';
    } else {
      // Rate view
      const selectedRoomType = roomTypes.find(rt => rt.id === selectedRoomTypeId);
      if (!selectedRoomType) return 'bg-gray-100';
      
      const rateVariation = ((inv.sellingRate - selectedRoomType.basePrice) / selectedRoomType.basePrice) * 100;
      
      if (rateVariation > 20) return 'bg-green-100 border-green-300';
      if (rateVariation > 0) return 'bg-yellow-100 border-yellow-300';
      if (rateVariation < -20) return 'bg-red-100 border-red-300';
      return 'bg-blue-100 border-blue-300';
    }
  };

  const handleCellClick = (cell: CalendarCellData) => {
    if (!cell.date || cell.isPast) return;
    
    setSelectedCell(cell);
    setEditData({
      availableRooms: cell.inventory?.availableRooms || 0,
      baseRate: cell.inventory?.baseRate || 0,
      sellingRate: cell.inventory?.sellingRate || 0,
      stopSell: cell.inventory?.stopSellFlag || false
    });
    setShowEditModal(true);
  };

  const handleUpdateInventory = async () => {
    if (!selectedCell || !selectedRoomTypeId) return;

    try {
      await inventoryService.updateInventory({
        hotelId,
        roomTypeId: selectedRoomTypeId,
        date: selectedCell.date,
        availableRooms: editData.availableRooms,
        baseRate: editData.baseRate,
        sellingRate: editData.sellingRate,
        restrictions: {
          stopSellFlag: editData.stopSell
        }
      });
      
      await fetchCalendarData();
      setShowEditModal(false);
      setSelectedCell(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update inventory');
    }
  };

  const toggleStopSellView = () => {
    setShowStopSell(!showStopSell);
  };

  const monthName = currentDate.toLocaleString('default', { month: 'long', year: 'numeric' });
  const selectedRoomType = roomTypes.find(rt => rt.id === selectedRoomTypeId);
  const days = getDaysInMonth(currentDate);

  return (
    <div className="space-y-6">
      {/* Enhanced Header */}
      <div className="bg-white/90 backdrop-blur-sm border-0 shadow-xl rounded-3xl p-4 sm:p-6">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 sm:gap-6">
          <div className="flex-1">
            <div className="flex items-center gap-3 sm:gap-4 mb-4">
              <div className="p-2 sm:p-3 bg-gradient-to-br from-green-500 to-emerald-500 rounded-2xl">
                <CalendarIcon className="h-6 w-6 sm:h-8 sm:w-8 text-white" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-green-600 via-emerald-600 to-teal-600 bg-clip-text text-transparent">
                  Inventory Calendar
                </h1>
                <p className="text-gray-600 text-sm sm:text-base mt-1">
                  Manage room availability and rates by date
                </p>
              </div>
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-3">
            {/* Enhanced View Mode Toggle */}
            <div className="bg-white/60 backdrop-blur-sm border border-white/20 rounded-2xl p-1 shadow-lg">
              <Button
                onClick={() => setViewMode('availability')}
                variant={viewMode === 'availability' ? 'default' : 'ghost'}
                size="sm"
                className={`px-3 py-2 rounded-xl font-semibold transition-all duration-200 ${
                  viewMode === 'availability'
                    ? 'bg-gradient-to-r from-blue-500 to-indigo-500 text-white shadow-lg transform scale-105'
                    : 'text-gray-600 hover:text-gray-800 hover:bg-white/50'
                }`}
              >
                <Users className="w-4 h-4 mr-2" />
                Availability
              </Button>
              <Button
                onClick={() => setViewMode('rates')}
                variant={viewMode === 'rates' ? 'default' : 'ghost'}
                size="sm"
                className={`px-3 py-2 rounded-xl font-semibold transition-all duration-200 ${
                  viewMode === 'rates'
                    ? 'bg-gradient-to-r from-blue-500 to-indigo-500 text-white shadow-lg transform scale-105'
                    : 'text-gray-600 hover:text-gray-800 hover:bg-white/50'
                }`}
              >
                <IndianRupee className="w-4 h-4 mr-2" />
                Rates
              </Button>
            </div>
            
            <Button 
              onClick={toggleStopSellView} 
              variant="outline" 
              size="sm"
              className="bg-white/80 backdrop-blur-sm border-2 border-gray-200 hover:border-blue-300 rounded-2xl px-4 py-2 font-semibold transition-all duration-200 transform hover:scale-105"
            >
              {showStopSell ? <Eye className="w-4 h-4 mr-2" /> : <EyeOff className="w-4 h-4 mr-2" />}
              {showStopSell ? 'Hide' : 'Show'} Stop Sell
            </Button>
            
            <Button 
              onClick={fetchCalendarData} 
              variant="outline" 
              size="sm"
              className="bg-white/80 backdrop-blur-sm border-2 border-gray-200 hover:border-blue-300 rounded-2xl px-4 py-2 font-semibold transition-all duration-200 transform hover:scale-105"
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Enhanced Room Type Selector */}
      <div className="bg-white/90 backdrop-blur-sm border-0 shadow-xl rounded-3xl overflow-hidden">
        <div className="bg-gradient-to-r from-purple-500 to-violet-500 p-4 sm:p-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-xl">
              <Settings className="h-6 w-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Room Type Configuration</h2>
              <p className="text-white/80 mt-1">Select and configure room type settings</p>
            </div>
          </div>
        </div>
        <div className="p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="min-w-0 flex-1">
              <label className="block text-sm font-semibold text-gray-700 mb-3">
                Select Room Type
              </label>
              <select
                value={selectedRoomTypeId}
                onChange={(e) => setSelectedRoomTypeId(e.target.value)}
                className="flex w-full rounded-2xl border-2 border-gray-200 bg-white/80 backdrop-blur-sm px-4 py-3 text-sm font-semibold ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 min-w-0 transition-all duration-200 hover:border-blue-300"
              >
                <option value="">Select a room type...</option>
                {roomTypes.map(rt => (
                  <option key={rt.id} value={rt.id}>
                    {rt.name} ({rt.code}) - ₹{rt.basePrice}
                  </option>
                ))}
              </select>
            </div>
            
            {selectedRoomType && (
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-4 border border-blue-200/50">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-blue-100 rounded-xl">
                      <Users className="w-4 h-4 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-gray-600">Max Occupancy</p>
                      <p className="text-lg font-bold text-gray-900">{selectedRoomType.maxOccupancy}</p>
                    </div>
                  </div>
                </div>
                <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl p-4 border border-green-200/50">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-green-100 rounded-xl">
                      <IndianRupee className="w-4 h-4 text-green-600" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-gray-600">Base Rate</p>
                      <p className="text-lg font-bold text-gray-900">₹{selectedRoomType.basePrice}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center">
            <AlertTriangle className="w-5 h-5 text-red-600 mr-3" />
            <span className="text-red-700">{error}</span>
          </div>
        </div>
      )}

      {/* Enhanced Calendar Navigation */}
      <div className="bg-white/90 backdrop-blur-sm border-0 shadow-xl rounded-3xl p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Button 
              onClick={() => navigateMonth('prev')} 
              variant="outline" 
              size="sm"
              className="bg-white/80 backdrop-blur-sm border-2 border-gray-200 hover:border-blue-300 rounded-2xl px-4 py-2 font-semibold transition-all duration-200 transform hover:scale-105"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <h2 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent min-w-[200px] text-center">
              {monthName}
            </h2>
            <Button 
              onClick={() => navigateMonth('next')} 
              variant="outline" 
              size="sm"
              className="bg-white/80 backdrop-blur-sm border-2 border-gray-200 hover:border-blue-300 rounded-2xl px-4 py-2 font-semibold transition-all duration-200 transform hover:scale-105"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
          
          <Button 
            onClick={goToToday} 
            variant="outline" 
            size="sm"
            className="bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white border-0 rounded-2xl px-6 py-2 font-semibold transition-all duration-200 transform hover:scale-105 shadow-lg"
          >
            <CalendarIcon className="w-4 h-4 mr-2" />
            Today
          </Button>
        </div>
      </div>

      {/* Enhanced Legend */}
      <div className="bg-white/90 backdrop-blur-sm border-0 shadow-xl rounded-3xl overflow-hidden">
        <div className="bg-gradient-to-r from-indigo-500 to-purple-500 p-4 sm:p-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-xl">
              <Eye className="h-6 w-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Color Legend</h2>
              <p className="text-white/80 mt-1">
                {viewMode === 'availability' ? 'Occupancy levels' : 'Rate variations'}
              </p>
            </div>
          </div>
        </div>
        <div className="p-4 sm:p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {viewMode === 'availability' ? (
              <>
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl p-4 border border-blue-200/50">
                  <div className="flex items-center gap-3">
                    <div className="w-6 h-6 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-lg shadow-lg"></div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">Low occupancy</p>
                      <p className="text-xs text-gray-600">&lt;40%</p>
                    </div>
                  </div>
                </div>
                <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-2xl p-4 border border-green-200/50">
                  <div className="flex items-center gap-3">
                    <div className="w-6 h-6 bg-gradient-to-r from-green-500 to-emerald-500 rounded-lg shadow-lg"></div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">Medium</p>
                      <p className="text-xs text-gray-600">40-70%</p>
                    </div>
                  </div>
                </div>
                <div className="bg-gradient-to-r from-yellow-50 to-amber-50 rounded-2xl p-4 border border-yellow-200/50">
                  <div className="flex items-center gap-3">
                    <div className="w-6 h-6 bg-gradient-to-r from-yellow-500 to-amber-500 rounded-lg shadow-lg"></div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">High</p>
                      <p className="text-xs text-gray-600">70-90%</p>
                    </div>
                  </div>
                </div>
                <div className="bg-gradient-to-r from-red-50 to-rose-50 rounded-2xl p-4 border border-red-200/50">
                  <div className="flex items-center gap-3">
                    <div className="w-6 h-6 bg-gradient-to-r from-red-500 to-rose-500 rounded-lg shadow-lg"></div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">Nearly full</p>
                      <p className="text-xs text-gray-600">90%+</p>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="bg-gradient-to-r from-red-50 to-rose-50 rounded-2xl p-4 border border-red-200/50">
                  <div className="flex items-center gap-3">
                    <div className="w-6 h-6 bg-gradient-to-r from-red-500 to-rose-500 rounded-lg shadow-lg"></div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">Below base</p>
                      <p className="text-xs text-gray-600">-20%+</p>
                    </div>
                  </div>
                </div>
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl p-4 border border-blue-200/50">
                  <div className="flex items-center gap-3">
                    <div className="w-6 h-6 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-lg shadow-lg"></div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">At base rate</p>
                      <p className="text-xs text-gray-600">Standard</p>
                    </div>
                  </div>
                </div>
                <div className="bg-gradient-to-r from-yellow-50 to-amber-50 rounded-2xl p-4 border border-yellow-200/50">
                  <div className="flex items-center gap-3">
                    <div className="w-6 h-6 bg-gradient-to-r from-yellow-500 to-amber-500 rounded-lg shadow-lg"></div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">Premium</p>
                      <p className="text-xs text-gray-600">0-20%</p>
                    </div>
                  </div>
                </div>
                <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-2xl p-4 border border-green-200/50">
                  <div className="flex items-center gap-3">
                    <div className="w-6 h-6 bg-gradient-to-r from-green-500 to-emerald-500 rounded-lg shadow-lg"></div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">High premium</p>
                      <p className="text-xs text-gray-600">20%+</p>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Enhanced Calendar Grid */}
      {selectedRoomTypeId ? (
        <div className="bg-white/90 backdrop-blur-sm border-0 shadow-xl rounded-3xl overflow-hidden">
          <div className="bg-gradient-to-r from-teal-500 to-cyan-500 p-4 sm:p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/20 rounded-xl">
                <CalendarIcon className="h-6 w-6 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">Calendar View</h2>
                <p className="text-white/80 mt-1">
                  {viewMode === 'availability' ? 'Room availability by date' : 'Rate variations by date'}
                </p>
              </div>
            </div>
          </div>
          <div className="p-4 sm:p-6">
            {loading ? (
              <div className="flex items-center justify-center h-64">
                <div className="text-center">
                  <RefreshCw className="animate-spin h-12 w-12 text-blue-600 mx-auto mb-4" />
                  <p className="text-lg font-semibold text-gray-600">Loading calendar...</p>
                  <p className="text-sm text-gray-500 mt-2">Please wait while we fetch the data</p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-7 gap-2">
                {/* Enhanced Day headers */}
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                  <div key={day} className="p-3 text-center text-sm font-bold text-gray-700 bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl border border-gray-200/50">
                    {day}
                  </div>
                ))}
                
                {/* Enhanced Calendar cells */}
                {days.map((cell, index) => (
                  <div role="button" tabIndex={0}
                    key={`days-${index}-${cell.date}`}
                    className={`
                      relative h-24 border-2 border-gray-200/50 cursor-pointer transition-all duration-200 hover:shadow-lg hover:scale-105 rounded-xl overflow-hidden
                      ${cell.date ? getCellColor(cell) : 'bg-gray-50'}
                      ${cell.isToday ? 'ring-2 ring-blue-500 shadow-lg' : ''}
                      ${cell.isPast ? 'opacity-50' : 'hover:border-blue-300'}
                    `}
                    onClick={() => handleCellClick(cell)}
                   onKeyDown={(e: React.KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); const clickHandler = () => handleCellClick(cell); if (typeof clickHandler === 'function') { clickHandler(e as any); } } }}>
                    {cell.date && (
                      <>
                        <div className="p-2 h-full flex flex-col">
                          <div className="flex items-center justify-between mb-1">
                            <div className={`text-sm font-bold ${
                              cell.isToday ? 'text-blue-600' : 'text-gray-900'
                            }`}>
                              {new Date(cell.date).getDate()}
                            </div>
                            {cell.isWeekend && (
                              <div className="w-2 h-2 bg-orange-400 rounded-full"></div>
                            )}
                          </div>
                          
                          {cell.inventory && (
                            <div className="flex-1 flex flex-col justify-center text-xs space-y-1">
                              {viewMode === 'availability' ? (
                                <>
                                  <div className="flex items-center justify-between bg-white/50 rounded-lg px-2 py-1">
                                    <span className="text-green-600 font-semibold">A:</span>
                                    <span className="font-bold text-gray-900">{cell.inventory.availableRooms}</span>
                                  </div>
                                  <div className="flex items-center justify-between bg-white/50 rounded-lg px-2 py-1">
                                    <span className="text-red-600 font-semibold">S:</span>
                                    <span className="font-bold text-gray-900">{cell.inventory.soldRooms}</span>
                                  </div>
                                </>
                              ) : (
                                <>
                                  <div className="bg-white/50 rounded-lg px-2 py-1 text-center">
                                    <div className="text-blue-600 font-bold">
                                      ₹{cell.inventory.sellingRate}
                                    </div>
                                    {cell.inventory.baseRate !== cell.inventory.sellingRate && (
                                      <div className="text-gray-500 line-through text-xs">
                                        ₹{cell.inventory.baseRate}
                                      </div>
                                    )}
                                  </div>
                                </>
                              )}
                            </div>
                          )}
                          
                          {cell.inventory?.stopSellFlag && showStopSell && (
                            <div className="absolute top-1 right-1">
                              <div className="bg-red-500 text-white rounded-full p-1">
                                <XCircle className="w-3 h-3" />
                              </div>
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="bg-white/90 backdrop-blur-sm border-0 shadow-xl rounded-3xl overflow-hidden">
          <div className="bg-gradient-to-r from-gray-500 to-gray-600 p-4 sm:p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/20 rounded-xl">
                <CalendarIcon className="h-6 w-6 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">Calendar Ready</h2>
                <p className="text-white/80 mt-1">Select a room type to begin</p>
              </div>
            </div>
          </div>
          <div className="text-center py-16">
            <div className="p-4 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-full w-20 h-20 mx-auto mb-6 flex items-center justify-center">
              <CalendarIcon className="w-10 h-10 text-blue-600" />
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-3">Select a Room Type</h3>
            <p className="text-gray-600 text-lg">Choose a room type from the dropdown above to view its inventory calendar</p>
          </div>
        </div>
      )}

      {/* Enhanced Edit Modal */}
      <Modal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        title={selectedCell ? `Edit ${new Date(selectedCell.date).toLocaleDateString()}` : 'Edit Inventory'}
      >
        {selectedCell && (
          <div className="space-y-6">
            {/* Enhanced Header Info */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6 rounded-2xl border border-blue-200/50">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-blue-100 rounded-xl">
                  <Settings className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <h4 className="text-lg font-bold text-gray-900">
                    {selectedRoomType?.name}
                  </h4>
                  <p className="text-sm text-gray-600">
                    {new Date(selectedCell.date).toLocaleDateString('en-US', { 
                      weekday: 'long', 
                      year: 'numeric', 
                      month: 'long', 
                      day: 'numeric' 
                    })}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white/80 rounded-xl p-3 border border-blue-200/30">
                  <p className="text-xs font-semibold text-gray-600">Total Rooms</p>
                  <p className="text-lg font-bold text-gray-900">{selectedCell.inventory?.totalRooms || 0}</p>
                </div>
                <div className="bg-white/80 rounded-xl p-3 border border-blue-200/30">
                  <p className="text-xs font-semibold text-gray-600">Sold Rooms</p>
                  <p className="text-lg font-bold text-gray-900">{selectedCell.inventory?.soldRooms || 0}</p>
                </div>
              </div>
            </div>

            {/* Enhanced Form Fields */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">
                  Available Rooms
                </label>
                <Input
                  type="number"
                  min="0"
                  value={editData.availableRooms || ''}
                  onChange={(e) => setEditData({ ...editData, availableRooms: Number(e.target.value) })}
                  className="p-4 border-2 border-gray-200 rounded-2xl bg-white/80 backdrop-blur-sm focus:border-blue-300 focus:ring-0 font-semibold"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-3">
                    Base Rate (₹)
                  </label>
                  <Input
                    type="number"
                    min="0"
                    step="50"
                    value={editData.baseRate || ''}
                    onChange={(e) => setEditData({ ...editData, baseRate: Number(e.target.value) })}
                    className="p-4 border-2 border-gray-200 rounded-2xl bg-white/80 backdrop-blur-sm focus:border-blue-300 focus:ring-0 font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-3">
                    Selling Rate (₹)
                  </label>
                  <Input
                    type="number"
                    min="0"
                    step="50"
                    value={editData.sellingRate || ''}
                    onChange={(e) => setEditData({ ...editData, sellingRate: Number(e.target.value) })}
                    className="p-4 border-2 border-gray-200 rounded-2xl bg-white/80 backdrop-blur-sm focus:border-blue-300 focus:ring-0 font-semibold"
                  />
                </div>
              </div>

              <div className="bg-gradient-to-r from-red-50 to-rose-50 p-4 rounded-2xl border border-red-200/50">
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="stopSell"
                    checked={editData.stopSell || false}
                    onChange={(e) => setEditData({ ...editData, stopSell: e.target.checked })}
                    className="w-5 h-5 rounded border-gray-300 text-red-600 focus:ring-red-500"
                  />
                  <label htmlFor="stopSell" className="ml-3 text-sm font-semibold text-gray-700">
                    Stop Sell (close to new bookings)
                  </label>
                </div>
              </div>
            </div>

            {/* Enhanced Action Buttons */}
            <div className="flex justify-end gap-4 pt-6 border-t border-gray-200">
              <Button
                onClick={() => setShowEditModal(false)}
                variant="outline"
                className="px-6 py-3 rounded-2xl font-semibold border-2 border-gray-200 hover:border-gray-300 transition-all duration-200"
              >
                Cancel
              </Button>
              <Button
                onClick={handleUpdateInventory}
                className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-6 py-3 rounded-2xl font-semibold transition-all duration-200 transform hover:scale-105 shadow-lg"
              >
                Update Inventory
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default withErrorBoundary(InventoryCalendar, { level: 'component' });