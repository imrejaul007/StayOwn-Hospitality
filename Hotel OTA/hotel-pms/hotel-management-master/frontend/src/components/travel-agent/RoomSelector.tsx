import React from 'react';
import {
  Bed,
  Users,
  Plus,
  Minus,
  Star,
  Wifi,
  Car,
  Coffee,
  MapPin
} from 'lucide-react';

interface RoomType {
  roomTypeId: string;
  roomTypeName: string;
  standardRate: number;
  agentRate?: number;
  maxOccupancy: number;
  amenities: string[];
  description: string;
  availability: number;
  quantity: number;
}

interface RoomSelectorProps {
  rooms: RoomType[];
  selectedRooms: RoomType[];
  onRoomAdd: (room: RoomType) => void;
  onRoomRemove: (roomTypeId: string) => void;
  onQuantityChange: (roomTypeId: string, change: number) => void;
  nights: number;
  showPricing?: boolean;
  className?: string;
}

const RoomSelector: React.FC<RoomSelectorProps> = ({
  rooms,
  selectedRooms,
  onRoomAdd,
  onRoomRemove,
  onQuantityChange,
  nights,
  showPricing = true,
  className = ''
}) => {
  const getAmenityIcon = (amenity: string) => {
    switch (amenity.toLowerCase()) {
      case 'free wifi':
        return <Wifi className="h-4 w-4" />;
      case 'room service':
        return <Coffee className="h-4 w-4" />;
      case 'balcony':
        return <MapPin className="h-4 w-4" />;
      case 'parking':
        return <Car className="h-4 w-4" />;
      default:
        return <Star className="h-4 w-4" />;
    }
  };

  const getAvailabilityColor = (availability: number) => {
    if (availability >= 5) return 'text-green-600 bg-green-100';
    if (availability >= 2) return 'text-yellow-600 bg-yellow-100';
    return 'text-red-600 bg-red-100';
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {rooms.map((room) => {
        const selectedRoom = selectedRooms.find(r => r.roomTypeId === room.roomTypeId);
        const rate = room.agentRate || room.standardRate;
        const savings = room.agentRate ? (room.standardRate - room.agentRate) * nights : 0;
        const totalCost = rate * (selectedRoom?.quantity || 0) * nights;

        return (
          <div
            key={room.roomTypeId}
            className="border border-gray-200 rounded-lg p-4 hover:border-indigo-300 transition-colors"
          >
            <div className="flex justify-between items-start mb-3">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <Bed className="h-5 w-5 text-gray-600" />
                  <h3 className="font-semibold text-gray-900">{room.roomTypeName}</h3>
                  {room.agentRate && (
                    <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full">
                      Special Rate
                    </span>
                  )}
                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getAvailabilityColor(room.availability)}`}>
                    {room.availability} available
                  </span>
                </div>

                <p className="text-gray-600 text-sm mb-2">{room.description}</p>

                <div className="flex flex-wrap gap-2 mb-2">
                  {room.amenities.slice(0, 4).map((amenity, index) => (
                    <span
                      key={`-${index}-${amenity}`}
                      className="flex items-center gap-1 text-xs text-gray-600 bg-gray-100 px-2 py-1 rounded"
                    >
                      {getAmenityIcon(amenity)}
                      {amenity}
                    </span>
                  ))}
                  {room.amenities.length > 4 && (
                    <span className="text-xs text-gray-500">
                      +{room.amenities.length - 4} more
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1">
                  <Users className="h-4 w-4 text-gray-500" />
                  <span className="text-sm text-gray-600">
                    Max {room.maxOccupancy} guests
                  </span>
                </div>
              </div>

              <div className="text-right">
                {showPricing && (
                  <div className="flex flex-col items-end gap-1 mb-3">
                    {room.agentRate ? (
                      <>
                        <span className="text-sm text-gray-500 line-through">
                          ${room.standardRate}/night
                        </span>
                        <span className="text-lg font-bold text-green-600">
                          ${room.agentRate}/night
                        </span>
                        {savings > 0 && (
                          <span className="text-xs text-green-600">
                            Save ${savings} total
                          </span>
                        )}
                      </>
                    ) : (
                      <span className="text-lg font-bold text-gray-900">
                        ${room.standardRate}/night
                      </span>
                    )}
                  </div>
                )}

                {selectedRoom ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <button aria-label="Close"
                        onClick={() => onQuantityChange(room.roomTypeId, -1)}
                        className="p-1 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        disabled={selectedRoom.quantity <= 0}
                      >
                        <Minus className="h-4 w-4" />
                      </button>
                      <span className="px-3 py-1 bg-indigo-100 text-indigo-800 rounded min-w-[40px] text-center">
                        {selectedRoom.quantity}
                      </span>
                      <button aria-label="Add"
                        onClick={() => onQuantityChange(room.roomTypeId, 1)}
                        className="p-1 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        disabled={selectedRoom.quantity >= room.availability}
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>

                    {showPricing && totalCost > 0 && (
                      <div className="text-center">
                        <span className="text-sm font-medium text-gray-900">
                          ${totalCost.toLocaleString()} total
                        </span>
                      </div>
                    )}

                    <button
                      onClick={() => onRoomRemove(room.roomTypeId)}
                      className="w-full text-red-600 hover:text-red-800 text-sm"
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <button aria-label="Add"
                    onClick={() => onRoomAdd(room)}
                    disabled={room.availability === 0}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
                  >
                    {room.availability === 0 ? 'Unavailable' : 'Add Room'}
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default RoomSelector;