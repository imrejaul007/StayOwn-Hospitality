import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { 
  Calendar, 
  Users, 
  ArrowLeft, 
  ArrowRight, 
  CreditCard, 
  CheckCircle,
  Bed,
  Crown,
  Star,
  Wifi,
  Car,
  Coffee,
  Bath,
  Tv,
  Wind
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { LoadingSpinner } from '../LoadingSpinner';
import { bookingService } from '../../services/bookingService';
import { formatIndianCurrency } from '../../utils/currency';
import { useAuth } from '../../context/AuthContext';

// Room types with Indian pricing
const ROOM_TYPES = {
  single: {
    name: 'Single Room',
    description: 'Perfect for solo travelers',
    baseRate: 2500,
    maxGuests: 1,
    icon: Bed,
    amenities: ['Free WiFi', 'AC', 'TV', 'Room Service'],
    image: '/images/single-room.jpg'
  },
  double: {
    name: 'Double Room',
    description: 'Comfortable for couples',
    baseRate: 3500,
    maxGuests: 2,
    icon: Crown,
    amenities: ['Free WiFi', 'AC', 'TV', 'Mini Bar', 'Room Service'],
    image: '/images/double-room.jpg'
  },
  suite: {
    name: 'Suite',
    description: 'Spacious luxury suite',
    baseRate: 6500,
    maxGuests: 3,
    icon: Star,
    amenities: ['Free WiFi', 'AC', 'TV', 'Mini Bar', 'Balcony', 'Room Service', 'Kitchenette'],
    image: '/images/suite.jpg'
  },
  deluxe: {
    name: 'Deluxe Room',
    description: 'Premium comfort and amenities',
    baseRate: 8500,
    maxGuests: 4,
    icon: Crown,
    amenities: ['Free WiFi', 'AC', 'TV', 'Mini Bar', 'Balcony', 'Room Service', 'Jacuzzi', 'City View'],
    image: '/images/deluxe-room.jpg'
  }
};

interface BookingStep1Props {
  selectedRoomType: keyof typeof ROOM_TYPES | null;
  guests: number;
  checkIn: string;
  checkOut: string;
  onRoomTypeSelect: (roomType: keyof typeof ROOM_TYPES) => void;
  onGuestsChange: (guests: number) => void;
  onDateChange: (checkIn: string, checkOut: string) => void;
  onNext: () => void;
}

const BookingStep1: React.FC<BookingStep1Props> = ({
  selectedRoomType,
  guests,
  checkIn,
  checkOut,
  onRoomTypeSelect,
  onGuestsChange,
  onDateChange,
  onNext
}) => {
  const today = new Date().toISOString().split('T')[0];
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];

  const calculateNights = () => {
    if (!checkIn || !checkOut) return 0;
    const start = new Date(checkIn);
    const end = new Date(checkOut);
    return Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  };

  const nights = calculateNights();

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Book Your Stay</h1>
        <p className="text-gray-600">Choose your room type and travel dates</p>
      </div>

      {/* Date Selection */}
      <Card className="border-2">
        <CardHeader>
          <CardTitle className="flex items-center">
            <Calendar className="h-5 w-5 mr-2 text-blue-600" />
            Select Your Dates
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Check-in Date</label>
              <Input
                type="date"
                value={checkIn}
                min={today}
                onChange={(e) => onDateChange(e.target.value, checkOut)}
                className="w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Check-out Date</label>
              <Input
                type="date"
                value={checkOut}
                min={checkIn || tomorrow}
                onChange={(e) => onDateChange(checkIn, e.target.value)}
                className="w-full"
              />
            </div>
            <div className="flex items-end">
              <div className="bg-blue-50 p-3 rounded-lg w-full">
                <p className="text-sm text-blue-600 font-medium">
                  {nights > 0 ? `${nights} Night${nights > 1 ? 's' : ''}` : 'Select dates'}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Guest Selection */}
      <Card className="border-2">
        <CardHeader>
          <CardTitle className="flex items-center">
            <Users className="h-5 w-5 mr-2 text-blue-600" />
            Number of Guests
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center space-x-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onGuestsChange(Math.max(1, guests - 1))}
              disabled={guests <= 1}
            >
              <Users className="h-4 w-4" />
              -
            </Button>
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">{guests}</div>
              <div className="text-sm text-gray-500">Guest{guests > 1 ? 's' : ''}</div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onGuestsChange(guests + 1)}
              disabled={guests >= 4}
            >
              <Users className="h-4 w-4" />
              +
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Room Type Selection */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-gray-900">Choose Your Room Type</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {Object.entries(ROOM_TYPES).map(([type, room]) => {
            const Icon = room.icon;
            const isSelected = selectedRoomType === type;
            const canAccommodate = guests <= room.maxGuests;
            const totalPrice = nights > 0 ? room.baseRate * nights : room.baseRate;

            return (
              <Card
                key={type}
                className={`cursor-pointer transition-all hover:shadow-lg ${
                  isSelected 
                    ? 'border-2 border-blue-500 shadow-md' 
                    : canAccommodate 
                    ? 'border-2 border-gray-200 hover:border-blue-300' 
                    : 'border-2 border-gray-100 opacity-50 cursor-not-allowed'
                }`}
                onClick={() => canAccommodate && onRoomTypeSelect(type as keyof typeof ROOM_TYPES)}
              >
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center">
                      <Icon className={`h-6 w-6 mr-3 ${isSelected ? 'text-blue-600' : 'text-gray-600'}`} />
                      <div>
                        <h3 className={`font-semibold ${isSelected ? 'text-blue-900' : 'text-gray-900'}`}>
                          {room.name}
                        </h3>
                        <p className="text-sm text-gray-600">{room.description}</p>
                      </div>
                    </div>
                    {isSelected && <CheckCircle className="h-5 w-5 text-blue-600" />}
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Max Guests</span>
                      <Badge variant={canAccommodate ? "default" : "destructive"}>
                        {room.maxGuests} Guest{room.maxGuests > 1 ? 's' : ''}
                      </Badge>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Per Night</span>
                      <span className="font-semibold text-gray-900">
                        {formatIndianCurrency(room.baseRate)}
                      </span>
                    </div>

                    {nights > 0 && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">{nights} Night{nights > 1 ? 's' : ''}</span>
                        <span className="font-bold text-blue-600 text-lg">
                          {formatIndianCurrency(totalPrice)}
                        </span>
                      </div>
                    )}

                    <div className="pt-2 border-t">
                      <p className="text-xs text-gray-600 mb-2">Amenities:</p>
                      <div className="flex flex-wrap gap-1">
                        {room.amenities.slice(0, 3).map((amenity) => (
                          <Badge key={amenity} variant="outline" className="text-xs">
                            {amenity}
                          </Badge>
                        ))}
                        {room.amenities.length > 3 && (
                          <Badge variant="outline" className="text-xs">
                            +{room.amenities.length - 3} more
                          </Badge>
                        )}
                      </div>
                    </div>

                    {!canAccommodate && (
                      <div className="mt-3 p-2 bg-red-50 rounded-md">
                        <p className="text-xs text-red-600">
                          This room can accommodate maximum {room.maxGuests} guest{room.maxGuests > 1 ? 's' : ''}
                        </p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Continue Button */}
      <div className="flex justify-end pt-6">
        <Button
          onClick={onNext}
          disabled={!selectedRoomType || !checkIn || !checkOut || nights <= 0}
          className="px-8 py-3 text-lg"
        >
          Continue to Guest Details
          <ArrowRight className="h-5 w-5 ml-2" />
        </Button>
      </div>
    </div>
  );
};

export default BookingStep1;