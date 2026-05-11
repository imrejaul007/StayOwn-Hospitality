import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  X,
  MapPin,
  Users,
  Clock,
  Wifi,
  Monitor,
  Coffee,
  Car,
  Search,
  Calendar,
  DollarSign,
  CheckCircle,
  AlertCircle,
  Loader
} from 'lucide-react';
import roomBookingService, {
  Room,
  RoomAvailabilityRequest,
  RoomAvailabilityResponse
} from '../../services/roomBookingService';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import toast from 'react-hot-toast';

interface RoomSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  hotelId: string;
  date: string;
  timeSlot: {
    start: string;
    end: string;
  };
  participants: number;
  onRoomSelect: (room: Room) => void;
  meetUpTitle: string;
}

export default function RoomSelectionModal({
  isOpen,
  onClose,
  hotelId,
  date,
  timeSlot,
  participants,
  onRoomSelect,
  meetUpTitle
}: RoomSelectionModalProps) {
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [filterCapacity, setFilterCapacity] = useState<number>(participants);
  const [filterType, setFilterType] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Check room availability
  const {
    data: availabilityData,
    isLoading: availabilityLoading,
    error: availabilityError,
    refetch: refetchAvailability
  } = useQuery<RoomAvailabilityResponse>({
    queryKey: ['room-availability', hotelId, date, timeSlot, participants],
    queryFn: () => roomBookingService.checkRoomAvailability({
      hotelId,
      date,
      timeSlot,
      capacity: participants
    }),
    enabled: isOpen && !!hotelId && !!date,
    staleTime: 2 * 60 * 1000, // 2 minutes
    retry: 2
  });

  // Get all available rooms
  const {
    data: allRooms,
    isLoading: roomsLoading
  } = useQuery<Room[]>({
    queryKey: ['hotel-rooms', hotelId, filterCapacity, filterType],
    queryFn: () => roomBookingService.getAvailableRooms(hotelId, filterCapacity, filterType),
    enabled: isOpen && !!hotelId,
    staleTime: 5 * 60 * 1000 // 5 minutes
  });

  useEffect(() => {
    if (availabilityData?.recommendedRoom) {
      setSelectedRoom(availabilityData.recommendedRoom);
    }
  }, [availabilityData]);

  const handleRoomSelect = () => {
    if (selectedRoom) {
      onRoomSelect(selectedRoom);
      onClose();
    }
  };

  const handleRefresh = () => {
    refetchAvailability();
    toast.success('Availability refreshed');
  };

  const filteredRooms = allRooms?.filter(room => {
    const matchesSearch = searchTerm === '' ||
      room.roomNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      room.type.toLowerCase().includes(searchTerm.toLowerCase());

    return matchesSearch;
  }) || [];

  const getAmenityIcon = (amenity: string) => {
    const amenityIcons: Record<string, unknown> = {
      'wifi': Wifi,
      'projector': Monitor,
      'coffee': Coffee,
      'parking': Car,
      'whiteboard': Monitor,
      'air_conditioning': Coffee
    };

    const IconComponent = amenityIcons[amenity.toLowerCase()] || MapPin;
    return <IconComponent className="w-4 h-4" />;
  };

  const getRoomTypeColor = (type: string) => {
    const colors: { [key: string]: string } = {
      'meeting_room': 'bg-blue-100 text-blue-800',
      'conference_room': 'bg-purple-100 text-purple-800',
      'boardroom': 'bg-green-100 text-green-800',
      'training_room': 'bg-orange-100 text-orange-800',
      'executive_suite': 'bg-red-100 text-red-800'
    };
    return colors[type] || 'bg-gray-100 text-gray-800';
  };

  const calculateDuration = () => {
    return roomBookingService.calculateDuration(timeSlot.start, timeSlot.end);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Select Meeting Room</h2>
            <p className="text-sm text-gray-600 mt-1">
              For "{meetUpTitle}" on {new Date(date).toLocaleDateString()} at {timeSlot.start}-{timeSlot.end}
            </p>
          </div>
          <button aria-label="Close"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Availability Status */}
        <div className="px-6 py-4 border-b border-gray-200">
          {availabilityLoading ? (
            <div className="flex items-center gap-2 text-blue-600">
              <Loader className="w-5 h-5 animate-spin" />
              <span>Checking availability...</span>
            </div>
          ) : availabilityError ? (
            <div className="flex items-center gap-2 text-red-600">
              <AlertCircle className="w-5 h-5" />
              <span>Failed to check availability</span>
              <Button variant="outline" size="sm" onClick={handleRefresh}>
                Retry
              </Button>
            </div>
          ) : availabilityData?.available ? (
            <div className="flex items-center gap-2 text-green-600">
              <CheckCircle className="w-5 h-5" />
              <span>
                {availabilityData.allAvailableRooms?.length || 0} room(s) available for your time slot
              </span>
              <Button variant="outline" size="sm" onClick={handleRefresh}>
                Refresh
              </Button>
            </div>
          ) : (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex items-center gap-2 text-yellow-800 mb-2">
                <AlertCircle className="w-5 h-5" />
                <span className="font-medium">No rooms available for selected time</span>
              </div>
              <p className="text-yellow-700 text-sm mb-3">
                {availabilityData?.reason}
              </p>
              {availabilityData?.alternativeTimeSlots && availabilityData.alternativeTimeSlots.length > 0 && (
                <div>
                  <p className="text-yellow-800 font-medium text-sm mb-2">Alternative time slots:</p>
                  <div className="flex flex-wrap gap-2">
                    {availabilityData.alternativeTimeSlots.map((slot, index) => (
                      <span
                        key={`availabilityData-alternativeTimeSlots-${index}`}
                        className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded text-xs"
                      >
                        {slot.displayTime} ({slot.availableRooms} rooms)
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Filters */}
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Search Rooms
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  type="text"
                  placeholder="Room number or type..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Minimum Capacity
              </label>
              <Input
                type="number"
                min="2"
                max="50"
                value={filterCapacity}
                onChange={(e) => setFilterCapacity(parseInt(e.target.value) || 2)}
                className="w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Room Type
              </label>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Types</option>
                <option value="meeting_room">Meeting Room</option>
                <option value="conference_room">Conference Room</option>
                <option value="boardroom">Boardroom</option>
                <option value="training_room">Training Room</option>
                <option value="executive_suite">Executive Suite</option>
              </select>
            </div>
          </div>
        </div>

        {/* Room List */}
        <div className="flex-1 overflow-y-auto p-6">
          {roomsLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader className="w-8 h-8 animate-spin text-blue-600" />
              <span className="ml-2 text-gray-600">Loading rooms...</span>
            </div>
          ) : filteredRooms.length === 0 ? (
            <div className="text-center py-12">
              <MapPin className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No rooms found</h3>
              <p className="text-gray-600">
                {searchTerm || filterType ? 'Try adjusting your filters' : 'No meeting rooms available'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {filteredRooms.map((room) => {
                const isAvailable = availabilityData?.allAvailableRooms?.some(
                  availableRoom => availableRoom._id === room._id
                );
                const isSelected = selectedRoom?._id === room._id;

                return (
                  <Card
                    key={room._id}
                    className={`p-4 cursor-pointer transition-all duration-200 ${
                      isSelected
                        ? 'border-blue-500 bg-blue-50'
                        : isAvailable
                        ? 'border-gray-200 hover:border-blue-300 hover:shadow-md'
                        : 'border-gray-200 bg-gray-50 opacity-60 cursor-not-allowed'
                    }`}
                    onClick={() => isAvailable && setSelectedRoom(room)}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="font-medium text-gray-900">
                          Room {room.roomNumber}
                        </h3>
                        <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium mt-1 ${getRoomTypeColor(room.type)}`}>
                          {room.type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                        </span>
                      </div>
                      <div className="text-right">
                        <div className="flex items-center gap-1 text-gray-600">
                          <Users className="w-4 h-4" />
                          <span className="text-sm">{room.capacity}</span>
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          {roomBookingService.formatCurrency(room.baseRate * (calculateDuration() / 60))}
                        </div>
                      </div>
                    </div>

                    {room.description && (
                      <p className="text-sm text-gray-600 mb-3">
                        {room.description}
                      </p>
                    )}

                    {room.amenities && room.amenities.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-3">
                        {room.amenities.slice(0, 4).map((amenity, index) => (
                          <div
                            key={`amenity-${index}`}
                            className="flex items-center gap-1 px-2 py-1 bg-gray-100 rounded text-xs"
                          >
                            {getAmenityIcon(amenity)}
                            <span className="text-gray-600">
                              {amenity.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                            </span>
                          </div>
                        ))}
                        {room.amenities.length > 4 && (
                          <span className="text-xs text-gray-500 px-2 py-1">
                            +{room.amenities.length - 4} more
                          </span>
                        )}
                      </div>
                    )}

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm">
                        <Clock className="w-4 h-4 text-gray-400" />
                        <span className="text-gray-600">
                          {roomBookingService.formatDuration(calculateDuration())}
                        </span>
                      </div>
                      {isAvailable ? (
                        <div className="flex items-center gap-1 text-green-600">
                          <CheckCircle className="w-4 h-4" />
                          <span className="text-sm font-medium">Available</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 text-red-600">
                          <AlertCircle className="w-4 h-4" />
                          <span className="text-sm font-medium">Booked</span>
                        </div>
                      )}
                    </div>

                    {isSelected && (
                      <div className="mt-3 pt-3 border-t border-blue-200">
                        <div className="flex items-center gap-2 text-blue-600">
                          <CheckCircle className="w-4 h-4" />
                          <span className="text-sm font-medium">Selected for booking</span>
                        </div>
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200 bg-gray-50">
          <div className="text-sm text-gray-600">
            {selectedRoom ? (
              <span>
                Selected: Room {selectedRoom.roomNumber} for {roomBookingService.formatDuration(calculateDuration())}
              </span>
            ) : (
              <span>Select a room to continue</span>
            )}
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              onClick={handleRoomSelect}
              disabled={!selectedRoom || !availabilityData?.available}
              className="bg-blue-600 hover:bg-blue-700"
            >
              Select Room
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}