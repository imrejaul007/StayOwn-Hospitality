import React, { useState, useEffect } from 'react';
import { useProperty } from '../../context/PropertyContext';
import { PropertyBreadcrumb } from '../../components/common/PropertyBreadcrumb';
import { api } from '../../services/api';
import { toast } from 'react-hot-toast';
import { withErrorBoundary } from '../../components/ErrorBoundary';
import {
  Edit,
  Save,
  X,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Calendar,
  Filter,
  Download,
  Upload,
  Building,
  Bed
} from 'lucide-react';

interface Room {
  _id: string;
  roomNumber: string;
  type: string;
  baseRate: number;
  currentRate: number;
  status: string;
  floor: number;
  capacity: number;
  amenities: string[];
  hotelId: string;
}

interface RoomType {
  _id: string;
  name: string;
  basePrice: number;
  description: string;
  capacity: number;
  amenities: string[];
}

interface PriceHistory {
  date: string;
  oldPrice: number;
  newPrice: number;
  changedBy: string;
  reason: string;
}

const AdminRoomPricing: React.FC = () => {
  const { selectedPropertyId, selectedProperty, viewMode } = useProperty();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingRoom, setEditingRoom] = useState<string | null>(null);
  const [tempPrices, setTempPrices] = useState<{ [key: string]: { baseRate: number; currentRate: number } }>({});
  const [bulkUpdateMode, setBulkUpdateMode] = useState(false);
  const [bulkUpdateData, setBulkUpdateData] = useState({
    type: 'percentage', // 'percentage' or 'fixed'
    value: 0,
    applyTo: 'all', // 'all', 'room_type', 'selected'
    roomType: '',
    selectedRooms: [] as string[]
  });
  const [priceHistory, setPriceHistory] = useState<{ [key: string]: PriceHistory[] }>({});
  const [showHistory, setShowHistory] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    roomType: '',
    floor: '',
    status: '',
    minPrice: '',
    maxPrice: ''
  });

  // Early return if no property selected in single mode
  if (!selectedPropertyId && viewMode === 'single') {
    return <div className="p-6">Please select a property</div>;
  }

  useEffect(() => {
    if (selectedPropertyId) {
      fetchRooms();
      fetchRoomTypes();
    }
  }, [selectedPropertyId]);

  const fetchRooms = async () => {
    try {
      setLoading(true);
      // Request more rooms - set limit to 100 to show all rooms for pricing management
      const response = await api.get(`/rooms?hotelId=${selectedPropertyId}&limit=100`);
      // The API returns { data: { rooms: [...], pagination: {...} } }
      const roomsData = response.data.data?.rooms || [];

      // Debug: Log the first room to see what status fields are available
      if (roomsData.length > 0) {
      }

      setRooms(Array.isArray(roomsData) ? roomsData : []);
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } }; message?: string };
      toast.error(err.response?.data?.message || 'Failed to fetch rooms');
      setRooms([]); // Ensure rooms is always an array
    } finally {
      setLoading(false);
    }
  };

  const fetchRoomTypes = async () => {
    try {
      const response = await api.get(`/room-types/hotel/${selectedPropertyId}`);
      // The API returns { success: true, data: [...] }
      const roomTypesData = response.data.data || [];
      setRoomTypes(Array.isArray(roomTypesData) ? roomTypesData : []);
    } catch (error: unknown) {
      setRoomTypes([]); // Ensure roomTypes is always an array
    }
  };

  const fetchPriceHistory = async (roomId: string) => {
    try {
      const response = await api.get(`/rooms/${roomId}/price-history`);
      setPriceHistory(prev => ({
        ...prev,
        [roomId]: response.data.data || []
      }));
    } catch (error: unknown) {
      toast.error('Failed to fetch price history');
    }
  };

  const handleEditRoom = (roomId: string) => {
    const room = rooms.find(r => r._id === roomId);
    if (room) {
      setEditingRoom(roomId);
      setTempPrices({
        [roomId]: {
          baseRate: room.baseRate,
          currentRate: room.currentRate
        }
      });
    }
  };

  const handleSaveRoom = async (roomId: string) => {
    try {
      const prices = tempPrices[roomId];
      if (!prices) return;

      await api.put(`/rooms/${roomId}/pricing`, {
        baseRate: prices.baseRate,
        currentRate: prices.currentRate,
        reason: 'Price updated via admin panel'
      });

      setRooms(prev => prev.map(room =>
        room._id === roomId
          ? { ...room, baseRate: prices.baseRate, currentRate: prices.currentRate }
          : room
      ));

      setEditingRoom(null);
      setTempPrices({});
      toast.success('Room price updated successfully');
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } }; message?: string };
      toast.error(err.response?.data?.message || 'Failed to update room price');
    }
  };

  const handleCancelEdit = (roomId: string) => {
    setEditingRoom(null);
    setTempPrices(prev => {
      const { [roomId]: removed, ...rest } = prev;
      return rest;
    });
  };

  const updateTempPrice = (roomId: string, field: 'baseRate' | 'currentRate', value: number) => {
    setTempPrices(prev => ({
      ...prev,
      [roomId]: {
        ...prev[roomId],
        [field]: value
      }
    }));
  };

  const handleBulkUpdate = async () => {
    try {
      let roomsToUpdate: string[] = [];

      if (bulkUpdateData.applyTo === 'all') {
        roomsToUpdate = rooms.map(r => r._id);
      } else if (bulkUpdateData.applyTo === 'room_type') {
        roomsToUpdate = rooms.filter(r => r.type === bulkUpdateData.roomType).map(r => r._id);
      } else {
        roomsToUpdate = bulkUpdateData.selectedRooms;
      }

      const updates = roomsToUpdate.map(roomId => {
        const room = rooms.find(r => r._id === roomId);
        if (!room) return null;

        let newBaseRate, newCurrentRate;
        if (bulkUpdateData.type === 'percentage') {
          newBaseRate = room.baseRate * (1 + bulkUpdateData.value / 100);
          newCurrentRate = room.currentRate * (1 + bulkUpdateData.value / 100);
        } else {
          newBaseRate = room.baseRate + bulkUpdateData.value;
          newCurrentRate = room.currentRate + bulkUpdateData.value;
        }

        return {
          roomId,
          baseRate: Math.max(0, newBaseRate),
          currentRate: Math.max(0, newCurrentRate)
        };
      }).filter(Boolean);

      await api.post('/rooms/bulk-price-update', {
        updates,
        reason: `Bulk price update: ${bulkUpdateData.type === 'percentage' ? bulkUpdateData.value + '%' : '₹' + bulkUpdateData.value} adjustment`
      });

      setBulkUpdateMode(false);
      setBulkUpdateData({
        type: 'percentage',
        value: 0,
        applyTo: 'all',
        roomType: '',
        selectedRooms: []
      });
      fetchRooms();
      toast.success(`Updated prices for ${updates.length} rooms`);
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } }; message?: string };
      toast.error(err.response?.data?.message || 'Failed to update room prices');
    }
  };

  const filteredRooms = Array.isArray(rooms) ? rooms.filter(room => {
    // Use computedStatus if available, otherwise fall back to status
    const roomStatus = room.computedStatus || room.currentStatus || room.status;

    // Debug: Log filter matching for status
    if (filters.status && filters.status === 'occupied') {
    }

    return (
      (!filters.roomType || room.type === filters.roomType) &&
      (!filters.floor || room.floor?.toString() === filters.floor) &&
      (!filters.status || roomStatus === filters.status) &&
      (!filters.minPrice || room.currentRate >= parseFloat(filters.minPrice)) &&
      (!filters.maxPrice || room.currentRate <= parseFloat(filters.maxPrice))
    );
  }) : [];

  const getRoomTypeColor = (type: string) => {
    const colors = {
      single: 'bg-blue-100 text-blue-800',
      double: 'bg-green-100 text-green-800',
      deluxe: 'bg-purple-100 text-purple-800',
      suite: 'bg-amber-100 text-amber-800'
    };
    return colors[type as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  const getStatusColor = (status: string) => {
    const colors = {
      vacant: 'bg-green-100 text-green-800',
      occupied: 'bg-red-100 text-red-800',
      dirty: 'bg-yellow-100 text-yellow-800',
      maintenance: 'bg-orange-100 text-orange-800',
      out_of_order: 'bg-red-100 text-red-800'
    };
    return colors[status as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6">
      {/* Property Breadcrumb */}
      <PropertyBreadcrumb items={['Configuration', 'Room Pricing']} />

      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Room Pricing Management</h1>
          <p className="text-gray-600 mt-1">
            Manage room rates and pricing strategies
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
            <Building className="w-4 h-4 mr-1" />
            {filteredRooms.length} Rooms
          </span>
          <button
            onClick={() => setBulkUpdateMode(!bulkUpdateMode)}
            className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
          >
            <TrendingUp className="w-4 h-4 mr-2" />
            Bulk Update
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-md border border-gray-200 p-4 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900">Filters</h3>
          <button
            onClick={() => setFilters({ roomType: '', floor: '', status: '', minPrice: '', maxPrice: '' })}
            className="text-sm text-blue-600 hover:text-blue-700"
          >
            Clear All
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Room Type</label>
            <select
              value={filters.roomType}
              onChange={(e) => setFilters(prev => ({ ...prev, roomType: e.target.value }))}
              className="block w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Types</option>
              <option value="single">Single</option>
              <option value="double">Double</option>
              <option value="deluxe">Deluxe</option>
              <option value="suite">Suite</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Floor</label>
            <input
              type="number"
              value={filters.floor}
              onChange={(e) => setFilters(prev => ({ ...prev, floor: e.target.value }))}
              placeholder="Floor number"
              className="block w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              value={filters.status}
              onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
              className="block w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Status</option>
              <option value="vacant">Vacant</option>
              <option value="occupied">Occupied</option>
              <option value="dirty">Dirty</option>
              <option value="maintenance">Maintenance</option>
              <option value="out_of_order">Out of Order</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Min Price</label>
            <input
              type="number"
              value={filters.minPrice}
              onChange={(e) => setFilters(prev => ({ ...prev, minPrice: e.target.value }))}
              placeholder="Min price"
              className="block w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Max Price</label>
            <input
              type="number"
              value={filters.maxPrice}
              onChange={(e) => setFilters(prev => ({ ...prev, maxPrice: e.target.value }))}
              placeholder="Max price"
              className="block w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Bulk Update Modal */}
      {bulkUpdateMode && (
        <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-gray-900">Bulk Price Update</h3>
            <button aria-label="Close"
              onClick={() => setBulkUpdateMode(false)}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Update Type</label>
              <select
                value={bulkUpdateData.type}
                onChange={(e) => setBulkUpdateData(prev => ({ ...prev, type: e.target.value as 'percentage' | 'fixed' }))}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="percentage">Percentage</option>
                <option value="fixed">Fixed Amount</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {bulkUpdateData.type === 'percentage' ? 'Percentage (%)' : 'Amount (₹)'}
              </label>
              <input
                type="number"
                value={bulkUpdateData.value}
                onChange={(e) => setBulkUpdateData(prev => ({ ...prev, value: parseFloat(e.target.value) || 0 }))}
                placeholder={bulkUpdateData.type === 'percentage' ? '10' : '500'}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Apply To</label>
              <select
                value={bulkUpdateData.applyTo}
                onChange={(e) => setBulkUpdateData(prev => ({ ...prev, applyTo: e.target.value }))}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Rooms</option>
                <option value="room_type">By Room Type</option>
                <option value="selected">Selected Rooms</option>
              </select>
            </div>

            {bulkUpdateData.applyTo === 'room_type' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Room Type</label>
                <select
                  value={bulkUpdateData.roomType}
                  onChange={(e) => setBulkUpdateData(prev => ({ ...prev, roomType: e.target.value }))}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select Type</option>
                  <option value="single">Single</option>
                  <option value="double">Double</option>
                  <option value="deluxe">Deluxe</option>
                  <option value="suite">Suite</option>
                </select>
              </div>
            )}
          </div>

          <div className="flex justify-end space-x-3 mt-6">
            <button
              onClick={() => setBulkUpdateMode(false)}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200"
            >
              Cancel
            </button>
            <button
              onClick={handleBulkUpdate}
              disabled={!bulkUpdateData.value || (bulkUpdateData.applyTo === 'room_type' && !bulkUpdateData.roomType)}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Apply Update
            </button>
          </div>
        </div>
      )}

      {/* Rooms Table */}
      <div className="bg-white shadow-lg rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <h3 className="text-lg font-semibold text-gray-900">Room Pricing</h3>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Room
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Type & Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Base Rate
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Current Rate
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Capacity
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredRooms.map((room) => (
                <tr key={room._id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                        <Bed className="w-5 h-5 text-blue-600" />
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">
                          Room {room.roomNumber}
                        </div>
                        <div className="text-sm text-gray-500">
                          Floor {room.floor}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="space-y-1">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getRoomTypeColor(room.type)}`}>
                        {room.type}
                      </span>
                      <br />
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(room.computedStatus || room.currentStatus || room.status)}`}>
                        {room.computedStatus || room.currentStatus || room.status}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {editingRoom === room._id ? (
                      <input
                        type="number"
                        value={tempPrices[room._id]?.baseRate || room.baseRate}
                        onChange={(e) => updateTempPrice(room._id, 'baseRate', parseFloat(e.target.value) || 0)}
                        className="w-24 px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    ) : (
                      <div className="text-sm text-gray-900">
                        ₹{room.baseRate.toLocaleString()}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {editingRoom === room._id ? (
                      <input
                        type="number"
                        value={tempPrices[room._id]?.currentRate || room.currentRate}
                        onChange={(e) => updateTempPrice(room._id, 'currentRate', parseFloat(e.target.value) || 0)}
                        className="w-24 px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    ) : (
                      <div className="flex items-center">
                        <span className="text-sm font-medium text-gray-900">
                          ₹{room.currentRate.toLocaleString()}
                        </span>
                        {room.currentRate !== room.baseRate && room.baseRate > 0 && (
                          <span className={`ml-2 inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium ${
                            room.currentRate > room.baseRate
                              ? 'bg-green-100 text-green-800'
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {room.currentRate > room.baseRate ? (
                              <TrendingUp className="w-3 h-3 mr-1" />
                            ) : (
                              <TrendingDown className="w-3 h-3 mr-1" />
                            )}
                            {Math.abs(((room.currentRate - room.baseRate) / room.baseRate) * 100).toFixed(1)}%
                          </span>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {room.capacity} guests
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex items-center space-x-2">
                      {editingRoom === room._id ? (
                        <>
                          <button aria-label="Save"
                            onClick={() => handleSaveRoom(room._id)}
                            className="text-green-600 hover:text-green-700"
                          >
                            <Save className="w-4 h-4" />
                          </button>
                          <button aria-label="Edit"
                            onClick={() => handleCancelEdit(room._id)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </>
                      ) : (
                        <>
                          <button aria-label="Edit"
                            onClick={() => handleEditRoom(room._id)}
                            className="text-blue-600 hover:text-blue-700"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button aria-label="Close"
                            onClick={() => {
                              setShowHistory(room._id);
                              fetchPriceHistory(room._id);
                            }}
                            className="text-gray-600 hover:text-gray-700"
                          >
                            <Calendar className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredRooms.length === 0 && (
          <div className="text-center py-8">
            <Bed className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">
              No rooms found matching your filters
            </p>
          </div>
        )}
      </div>

      {/* Price History Modal */}
      {showHistory && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center">
            <div aria-hidden="true" className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75" onClick={() => setShowHistory(null)} />

            <div className="inline-block w-full max-w-2xl p-6 my-8 overflow-hidden text-left align-middle transition-all transform bg-white shadow-xl rounded-lg">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">
                  Price History - Room {rooms.find(r => r._id === showHistory)?.roomNumber}
                </h3>
                <button aria-label="Close"
                  onClick={() => setShowHistory(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="max-h-96 overflow-y-auto">
                {priceHistory[showHistory]?.length > 0 ? (
                  <div className="space-y-3">
                    {priceHistory[showHistory].map((entry, index) => (
                      <div key={`-${index}-${entry.date}`} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              ₹{entry.oldPrice.toLocaleString()} → ₹{entry.newPrice.toLocaleString()}
                            </div>
                            <div className="text-sm text-gray-500">
                              {entry.reason}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-sm text-gray-500">
                              {new Date(entry.date).toLocaleDateString()}
                            </div>
                            <div className="text-sm text-gray-400">
                              by {entry.changedBy}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500">No price history available</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default withErrorBoundary(AdminRoomPricing, { level: 'page' });