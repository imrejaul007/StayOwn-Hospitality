import React, { useState, useEffect, useRef} from 'react';
import {
  ArrowLeft,
  Download,
  Search,
  Filter,
  Calendar,
  Banknote,
  TrendingUp,
  TrendingDown,
  Star,
  Bed,
  Users,
  Clock,
  AlertCircle,
  CheckCircle,
  Eye,
  ExternalLink,
  FileText,
  Grid,
  List
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { format, addMonths, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isToday } from 'date-fns';
import { toast } from 'sonner';
import { withErrorBoundary } from '../../components/ErrorBoundary';
import { api } from '../../services/api';
import { useProperty } from '../../context/PropertyContext';

interface RoomTypeRate {
  roomTypeId: string;
  roomTypeName: string;
  standardRate: number;
  agentRate: number;
  discount: number;
  commissionRate: number;
  description: string;
  maxOccupancy: number;
  amenities: string[];
  availability: number;
  validFrom: Date;
  validTo: Date;
  minimumNights: number;
  conditions: string[];
}

interface SeasonalRate {
  season: string;
  period: string;
  roomRates: RoomTypeRate[];
  commissionBonus: number;
  description: string;
}

const ViewRates: React.FC = () => {
  const navigate = useNavigate();
  const { selectedPropertyId } = useProperty();
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'table' | 'calendar' | 'seasonal'>('table');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRoomType, setSelectedRoomType] = useState('all');
  const [selectedSeason, setSelectedSeason] = useState('all');
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [rates, setRates] = useState<RoomTypeRate[]>([]);
  const [seasonalRates, setSeasonalRates] = useState<SeasonalRate[]>([]);
  const [roomTypes, setRoomTypes] = useState<string[]>([]);

  const isMountedRef = useRef(true);

  useEffect(() => {
    return () => { isMountedRef.current = false; };
  }, []);

  useEffect(() => {
    fetchRates();
  }, [selectedPropertyId]);

  const fetchRates = async () => {
    try {
      setLoading(true);

      if (!selectedPropertyId) {
        toast.error('Please select a property to view rates');
        setRates([]);
        setSeasonalRates([]);
        setRoomTypes(['all']);
        return;
      }

      // Fetch real room types from the backend
      const response = await api.get(`/room-types/hotel/${selectedPropertyId}`, { params: { limit: 100 } });
      if (!isMountedRef.current) return;

      const rawRoomTypes = response.data?.data?.roomTypes || response.data?.data || response.data?.roomTypes || [];

      if (!Array.isArray(rawRoomTypes) || rawRoomTypes.length === 0) {
        setRates([]);
        setSeasonalRates([]);
        setRoomTypes(['all']);
        return;
      }

      // Map room type data to RoomTypeRate interface
      const mappedRates: RoomTypeRate[] = rawRoomTypes.map((rt: Record<string, unknown>) => {
        const baseRate = (rt.basePrice as number) || (rt.baseRate as number) || (rt.ratePerNight as number) || 0;
        const agentDiscount = 0.1; // 10% default agent discount
        const agentRate = Math.round(baseRate * (1 - agentDiscount));
        return {
          roomTypeId: (rt._id as string) || (rt.id as string) || '',
          roomTypeName: (rt.name as string) || (rt.displayName as string) || 'Room',
          standardRate: baseRate,
          agentRate,
          discount: agentDiscount * 100,
          commissionRate: 10,
          description: (rt.description as string) || '',
          maxOccupancy: (rt.maxOccupancy as number) || (rt.capacity as number) || 2,
          amenities: (rt.amenities as string[]) || [],
          availability: (rt.availableRooms as number) || (rt.totalRooms as number) || 0,
          validFrom: rt.validFrom ? new Date(rt.validFrom as string) : new Date(),
          validTo: rt.validTo ? new Date(rt.validTo as string) : new Date(new Date().getFullYear(), 11, 31),
          minimumNights: (rt.minimumNights as number) || 1,
          conditions: (rt.conditions as string[]) || []
        };
      });

      setRates(mappedRates);
      setRoomTypes(['all', ...Array.from(new Set(mappedRates.map(r => r.roomTypeName)))]);
      // No seasonal rates from backend - leave empty
      setSeasonalRates([]);
    } catch (error) {
      if (!isMountedRef.current) return;
      toast.error('Failed to load rates');
      setRates([]);
      setSeasonalRates([]);
      setRoomTypes(['all']);
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  };

  const filteredRates = rates.filter(rate => {
    const matchesSearch = rate.roomTypeName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         rate.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRoomType = selectedRoomType === 'all' || rate.roomTypeName === selectedRoomType;
    return matchesSearch && matchesRoomType;
  });

  const handleDownloadRateSheet = async () => {
    try {
      toast.success('Rate sheet download started');
      // Simulate download
      const blob = new Blob([JSON.stringify(filteredRates, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `travel-agent-rates-${format(new Date(), 'yyyy-MM-dd')}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      toast.error('Failed to download rate sheet');
    }
  };

  const getCalendarDays = () => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    return eachDayOfInterval({ start, end });
  };

  const getRateForDate = (date: Date, roomTypeId: string) => {
    const rate = rates.find(r => r.roomTypeId === roomTypeId);
    if (!rate) return null;

    // Simulate dynamic pricing based on date
    const baseRate = rate.agentRate;
    const dayOfWeek = date.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const multiplier = isWeekend ? 1.2 : 1.0;

    return Math.round(baseRate * multiplier);
  };

  const getAvailabilityColor = (availability: number) => {
    if (availability >= 5) return 'text-green-600 bg-green-100';
    if (availability >= 2) return 'text-yellow-600 bg-yellow-100';
    return 'text-red-600 bg-red-100';
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-6">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button aria-label="Previous"
                onClick={() => navigate('/travel-agent')}
                className="p-2 text-gray-600 hover:text-indigo-600 transition-colors"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Agent Rates & Pricing</h1>
                <p className="text-gray-600">View special rates and commission structures</p>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleDownloadRateSheet}
                className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <Download className="h-5 w-5" />
                Download Rate Sheet
              </button>
              <button
                onClick={() => navigate('/travel-agent/booking/new')}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
              >
                <ExternalLink className="h-5 w-5" />
                Create Booking
              </button>
            </div>
          </div>
        </div>

        {/* View Mode Tabs */}
        <div className="bg-white rounded-lg shadow-sm mb-6">
          <div className="border-b border-gray-200">
            <nav className="flex -mb-px">
              {[
                { key: 'table', label: 'Table View', icon: List },
                { key: 'calendar', label: 'Calendar View', icon: Calendar },
                { key: 'seasonal', label: 'Seasonal Rates', icon: TrendingUp }
              ].map(({ key, label, icon: Icon }) => (
                <button aria-label="View"
                  key={key}
                  onClick={() => setViewMode(key as unknown)}
                  className={`flex items-center gap-2 px-6 py-3 text-sm font-medium ${
                    viewMode === key
                      ? 'text-indigo-600 border-b-2 border-indigo-600'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </button>
              ))}
            </nav>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search room types..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-600 focus:border-transparent"
              />
            </div>
            <select
              value={selectedRoomType}
              onChange={(e) => setSelectedRoomType(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-600 focus:border-transparent"
            >
              {roomTypes.map(type => (
                <option key={type} value={type}>
                  {type === 'all' ? 'All Room Types' : type}
                </option>
              ))}
            </select>
            {viewMode === 'seasonal' && (
              <select
                value={selectedSeason}
                onChange={(e) => setSelectedSeason(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-600 focus:border-transparent"
              >
                <option value="all">All Seasons</option>
                {seasonalRates.map(season => (
                  <option key={season.season} value={season.season}>
                    {season.season}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        {/* Table View */}
        {viewMode === 'table' && filteredRates.length === 0 && (
          <div className="bg-white rounded-lg shadow-sm p-12 text-center">
            <Bed className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No rates configured</h3>
            <p className="text-gray-600">Room rates are not yet available. Please check back later or contact the hotel.</p>
          </div>
        )}
        {viewMode === 'table' && filteredRates.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Room Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Standard Rate
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Agent Rate
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Savings
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Commission
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Availability
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Min Nights
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredRates.map((rate) => (
                    <motion.tr
                      key={rate.roomTypeId}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="hover:bg-gray-50"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-start gap-3">
                          <div className="p-2 bg-indigo-100 rounded-lg">
                            <Bed className="h-5 w-5 text-indigo-600" />
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">{rate.roomTypeName}</p>
                            <p className="text-sm text-gray-600 mt-1">{rate.description}</p>
                            <div className="flex items-center gap-1 mt-2">
                              <Users className="h-4 w-4 text-gray-500" />
                              <span className="text-sm text-gray-600">
                                Max {rate.maxOccupancy} guests
                              </span>
                            </div>
                            <div className="flex flex-wrap gap-1 mt-2">
                              {rate.amenities.slice(0, 3).map((amenity, index) => (
                                <span
                                  key={`-${index}-${amenity}`}
                                  className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded"
                                >
                                  {amenity}
                                </span>
                              ))}
                              {rate.amenities.length > 3 && (
                                <span className="text-xs text-gray-500">
                                  +{rate.amenities.length - 3} more
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-lg font-medium text-gray-900">
                          ₹{rate.standardRate}
                        </span>
                        <p className="text-sm text-gray-600">per night</p>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-lg font-bold text-green-600">
                          ₹{rate.agentRate}
                        </span>
                        <p className="text-sm text-gray-600">per night</p>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1">
                          <TrendingDown className="h-4 w-4 text-green-600" />
                          <span className="font-medium text-green-600">
                            ₹{rate.standardRate - rate.agentRate}
                          </span>
                        </div>
                        <p className="text-sm text-green-600">
                          {rate.discount.toFixed(1)}% off
                        </p>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1">
                          <Star className="h-4 w-4 text-yellow-500" />
                          <span className="font-medium text-gray-900">
                            {rate.commissionRate}%
                          </span>
                        </div>
                        <p className="text-sm text-gray-600">
                          ₹{((rate.agentRate * rate.commissionRate) / 100).toFixed(0)} per night
                        </p>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getAvailabilityColor(rate.availability)}`}>
                          {rate.availability} rooms
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1">
                          <Clock className="h-4 w-4 text-gray-500" />
                          <span className="text-sm text-gray-900">
                            {rate.minimumNights} night{rate.minimumNights > 1 ? 's' : ''}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex gap-2">
                          <button
                            onClick={() => navigate(`/travel-agent/booking/new?roomType=${rate.roomTypeId}`)}
                            className="text-indigo-600 hover:text-indigo-900 text-sm font-medium"
                          >
                            Book Now
                          </button>
                          <button aria-label="View" className="text-gray-600 hover:text-gray-900">
                            <Eye className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Calendar View */}
        {viewMode === 'calendar' && (
          <div className="space-y-6">
            {/* Calendar Navigation */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">
                  {format(currentMonth, 'MMMM yyyy')}
                </h2>
                <div className="flex gap-2">
                  <button aria-label="Add"
                    onClick={() => setCurrentMonth(addMonths(currentMonth, -1))}
                    className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </button>
                  <button aria-label="Add"
                    onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                    className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    <ArrowLeft className="h-4 w-4 rotate-180" />
                  </button>
                </div>
              </div>

              {/* Room Type Selector for Calendar */}
              <select
                value={selectedRoomType}
                onChange={(e) => setSelectedRoomType(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-600 focus:border-transparent mb-4"
              >
                {roomTypes.filter(type => type !== 'all').map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>

              {/* Calendar Grid */}
              <div className="grid grid-cols-7 gap-1">
                {/* Day headers */}
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                  <div key={day} className="p-2 text-center text-sm font-medium text-gray-600">
                    {day}
                  </div>
                ))}

                {/* Calendar days */}
                {getCalendarDays().map(date => {
                  const selectedRoom = rates.find(r => r.roomTypeName === selectedRoomType);
                  const rate = selectedRoom ? getRateForDate(date, selectedRoom.roomTypeId) : null;
                  const isCurrentMonth = isSameMonth(date, currentMonth);
                  const isCurrentDay = isToday(date);

                  return (
                    <div
                      key={date.toString()}
                      className={`p-2 min-h-[60px] border border-gray-200 ${
                        isCurrentMonth ? 'bg-white' : 'bg-gray-50'
                      } ${isCurrentDay ? 'ring-2 ring-indigo-600' : ''}`}
                    >
                      <div className={`text-sm ${
                        isCurrentMonth ? 'text-gray-900' : 'text-gray-400'
                      }`}>
                        {format(date, 'd')}
                      </div>
                      {rate && isCurrentMonth && (
                        <div className="mt-1">
                          <div className="text-xs font-medium text-green-600">
                            ₹{rate}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Seasonal Rates View */}
        {viewMode === 'seasonal' && (
          <div className="space-y-6">
            {seasonalRates
              .filter(season => selectedSeason === 'all' || season.season === selectedSeason)
              .map((season) => (
              <motion.div
                key={season.season}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-lg shadow-sm overflow-hidden"
              >
                <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white p-6">
                  <h2 className="text-xl font-bold mb-2">{season.season}</h2>
                  <p className="text-indigo-100 mb-2">{season.period}</p>
                  <p className="text-sm text-indigo-100">{season.description}</p>
                  <div className="flex items-center gap-2 mt-3">
                    <Star className="h-5 w-5 text-yellow-300" />
                    <span className="font-medium">
                      +{season.commissionBonus}% Bonus Commission
                    </span>
                  </div>
                </div>

                <div className="p-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {season.roomRates.map((rate) => (
                      <div
                        key={rate.roomTypeId}
                        className="border border-gray-200 rounded-lg p-4 hover:border-indigo-300 transition-colors"
                      >
                        <div className="flex items-start gap-3 mb-3">
                          <div className="p-2 bg-indigo-100 rounded-lg">
                            <Bed className="h-5 w-5 text-indigo-600" />
                          </div>
                          <div className="flex-1">
                            <h3 className="font-semibold text-gray-900">{rate.roomTypeName}</h3>
                            <p className="text-sm text-gray-600 mt-1">{rate.description}</p>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-gray-600">Standard Rate</span>
                            <span className="font-medium text-gray-900">₹{rate.standardRate}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-gray-600">Agent Rate</span>
                            <span className="font-bold text-green-600">₹{rate.agentRate}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-gray-600">Commission</span>
                            <span className="font-medium text-indigo-600">
                              {rate.commissionRate}%
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-gray-600">Min Nights</span>
                            <span className="font-medium text-gray-900">
                              {rate.minimumNights}
                            </span>
                          </div>
                        </div>

                        <div className="mt-4 pt-4 border-t border-gray-200">
                          <div className="flex justify-between items-center">
                            <span className="text-sm font-medium text-gray-900">
                              Total Commission/Night
                            </span>
                            <span className="font-bold text-indigo-600">
                              ₹{((rate.agentRate * rate.commissionRate) / 100).toFixed(0)}
                            </span>
                          </div>
                        </div>

                        <button
                          onClick={() => navigate(`/travel-agent/booking/new?roomType=${rate.roomTypeId}&season=${season.season}`)}
                          className="w-full mt-4 bg-indigo-600 text-white py-2 rounded-lg hover:bg-indigo-700 transition-colors"
                        >
                          Book This Rate
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {/* Rate Conditions */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Terms & Conditions</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-medium text-gray-900 mb-3">Booking Conditions</h3>
              <ul className="space-y-2 text-sm text-gray-600">
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600 mt-0.5" />
                  Advance booking required for special rates
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600 mt-0.5" />
                  Commission paid within 30 days of guest checkout
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600 mt-0.5" />
                  Flexible cancellation policies available
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600 mt-0.5" />
                  Group booking discounts for 5+ rooms
                </li>
              </ul>
            </div>
            <div>
              <h3 className="font-medium text-gray-900 mb-3">Commission Structure</h3>
              <ul className="space-y-2 text-sm text-gray-600">
                <li className="flex items-start gap-2">
                  <Star className="h-4 w-4 text-yellow-500 mt-0.5" />
                  Base commission: 8-15% depending on room type
                </li>
                <li className="flex items-start gap-2">
                  <Star className="h-4 w-4 text-yellow-500 mt-0.5" />
                  Seasonal bonuses up to +3% commission
                </li>
                <li className="flex items-start gap-2">
                  <Star className="h-4 w-4 text-yellow-500 mt-0.5" />
                  Volume bonuses for high-performing agents
                </li>
                <li className="flex items-start gap-2">
                  <Star className="h-4 w-4 text-yellow-500 mt-0.5" />
                  Special event rates with enhanced commissions
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default withErrorBoundary(ViewRates, { level: 'page' });