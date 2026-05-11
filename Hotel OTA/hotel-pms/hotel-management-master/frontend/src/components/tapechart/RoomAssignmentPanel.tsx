import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  User, Calendar, Clock, IndianRupee, Star, Crown, Coffee,
  Bed, Wifi, Car, Bath, Tv, Wind, Phone, MapPin, Zap,
  CheckCircle, AlertTriangle, XCircle, ArrowRight
} from 'lucide-react';
import { cn } from '@/utils/cn';
import { formatCurrency } from '@/utils/currencyUtils';
import { toast } from '@/utils/toast';
import tapeChartService from '@/services/tapeChartService';

interface Room {
  id: string;
  roomNumber: string;
  roomType: string;
  floor: number;
  status: 'available' | 'occupied' | 'reserved' | 'maintenance' | 'dirty' | 'clean' | 'out_of_order';
  features: string[];
  baseRate: number;
  maxOccupancy: number;
  bedType: string;
  size: number; // in sq ft
  view?: string;
  lastCleaned?: string;
  maintenanceNotes?: string;
  assignmentScore?: number;
}

interface Reservation {
  id: string;
  guestName: string;
  roomType: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  adults: number;
  children: number;
  vipStatus?: 'none' | 'vip' | 'svip' | 'corporate';
  rate?: number;
  specialRequests?: string[];
  preferences?: {
    floor?: 'high' | 'low' | 'any';
    view?: 'ocean' | 'city' | 'garden' | 'any';
    bedType?: 'king' | 'queen' | 'twin' | 'any';
    smoking?: boolean;
    accessible?: boolean;
    connecting?: boolean;
  };
  assignedRoom?: string;
  assignmentScore?: number;
  potentialUpgrade?: {
    fromType: string;
    toType: string;
    additionalCharge: number;
  };
}

interface RoomAssignmentPanelProps {
  selectedReservation: Reservation | null;
  onReservationSelect: (reservation: Reservation | null) => void;
  onAssignRoom: (reservationId: string, roomId: string) => void;
  date: Date;
}

const RoomAssignmentPanel: React.FC<RoomAssignmentPanelProps> = ({
  selectedReservation,
  onReservationSelect,
  onAssignRoom,
  date
}) => {
  const [availableRooms, setAvailableRooms] = useState<Room[]>([]);
  const [filteredRooms, setFilteredRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [floorFilter, setFloorFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'score' | 'rate' | 'room' | 'floor'>('score');
  const [showUpgradeOptions, setShowUpgradeOptions] = useState(false);

  useEffect(() => {
    if (selectedReservation) {
      fetchAvailableRooms();
    }
  }, [selectedReservation, date]);

  useEffect(() => {
    filterAndSortRooms();
  }, [availableRooms, searchTerm, floorFilter, typeFilter, sortBy]);

  const fetchAvailableRooms = async () => {
    if (!selectedReservation) return;

    try {
      setLoading(true);

      // Use real API call to fetch available rooms
      const filters = {
        checkIn: selectedReservation.checkIn,
        checkOut: selectedReservation.checkOut,
        roomType: selectedReservation.roomType,
        guestCount: selectedReservation.adults + selectedReservation.children
      };

      const apiRooms = await tapeChartService.getAvailableRooms(filters);

      // Transform API response to match our Room interface and add assignment scores
      const roomsWithScores = apiRooms.map((room: Record<string, unknown>) => ({
        ...room,
        assignmentScore: room.assignmentScore || calculateAssignmentScore(room, selectedReservation)
      }));

      setAvailableRooms(roomsWithScores);
    } catch (error) {
      toast.error('Failed to load available rooms');

      // Fallback to empty array instead of mock data
      setAvailableRooms([]);
    } finally {
      setLoading(false);
    }
  };

  const calculateAssignmentScore = (room: Room, reservation: Reservation): number => {
    let score = 50; // Base score

    // Room type match
    if (room.roomType === reservation.roomType) {
      score += 30;
    }

    // Occupancy match
    if (room.maxOccupancy >= reservation.adults + reservation.children) {
      score += 20;
    }

    // Preferences match
    if (reservation.preferences) {
      if (reservation.preferences.floor === 'high' && room.floor >= 3) score += 10;
      if (reservation.preferences.floor === 'low' && room.floor <= 2) score += 10;
      if (reservation.preferences.view && room.view === reservation.preferences.view) score += 15;
      if (reservation.preferences.bedType && room.bedType.toLowerCase().includes(reservation.preferences.bedType)) score += 10;
    }

    // VIP status boost
    if (reservation.vipStatus === 'svip') score += 20;
    if (reservation.vipStatus === 'vip') score += 10;

    // Room condition
    if (room.status === 'clean') score += 5;
    if (room.status === 'maintenance' || room.status === 'dirty') score -= 20;

    return Math.max(0, Math.min(100, score));
  };

  const filterAndSortRooms = () => {
    let filtered = availableRooms;

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(room =>
        room.roomNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        room.roomType.toLowerCase().includes(searchTerm.toLowerCase()) ||
        room.view?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Floor filter
    if (floorFilter !== 'all') {
      filtered = filtered.filter(room => room.floor === parseInt(floorFilter));
    }

    // Type filter
    if (typeFilter !== 'all') {
      filtered = filtered.filter(room => room.roomType === typeFilter);
    }

    // Sort
    filtered = [...filtered].sort((a, b) => {
      switch (sortBy) {
        case 'score':
          return (b.assignmentScore || 0) - (a.assignmentScore || 0);
        case 'rate':
          return a.baseRate - b.baseRate;
        case 'room':
          return a.roomNumber.localeCompare(b.roomNumber);
        case 'floor':
          return a.floor - b.floor;
        default:
          return 0;
      }
    });

    setFilteredRooms(filtered);
  };

  const handleAssignRoom = async (roomId: string) => {
    if (!selectedReservation) return;

    try {
      await onAssignRoom(selectedReservation.id, roomId);
      toast.success(`Room ${roomId} assigned successfully`);
      onReservationSelect(null); // Close the panel
    } catch (error) {
      toast.error('Failed to assign room');
    }
  };

  const getScoreColor = (score?: number): string => {
    if (!score) return 'bg-gray-100 text-gray-700';
    if (score >= 80) return 'bg-green-100 text-green-700';
    if (score >= 60) return 'bg-yellow-100 text-yellow-700';
    return 'bg-red-100 text-red-700';
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'available': return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'clean': return <Zap className="w-4 h-4 text-blue-500" />;
      case 'maintenance': return <AlertTriangle className="w-4 h-4 text-orange-500" />;
      case 'dirty': return <XCircle className="w-4 h-4 text-red-500" />;
      default: return null;
    }
  };

  const getRoomFeatureIcons = (features: string[]) => {
    const iconMap = {
      wifi: <Wifi className="w-4 h-4 text-blue-500" />,
      tv: <Tv className="w-4 h-4 text-gray-600" />,
      ac: <Wind className="w-4 h-4 text-cyan-500" />,
      minibar: <Coffee className="w-4 h-4 text-brown-500" />,
      balcony: <MapPin className="w-4 h-4 text-green-500" />,
      kitchenette: <Coffee className="w-4 h-4 text-orange-500" />,
      parking: <Car className="w-4 h-4 text-gray-500" />,
      bathtub: <Bath className="w-4 h-4 text-blue-400" />
    };

    return features.slice(0, 4).map((feature, index) => (
      <span key={`-${index}-${feature}`} title={feature}>
        {iconMap[feature as keyof typeof iconMap] || null}
      </span>
    ));
  };

  if (!selectedReservation) {
    return (
      <Card className="h-full">
        <CardContent className="p-6 flex items-center justify-center h-full text-gray-500">
          <div className="text-center">
            <Bed className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p>Select a reservation to view room assignment options</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <User className="w-5 h-5" />
            Room Assignment
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onReservationSelect(null)}
          >
            <XCircle className="w-4 h-4" />
          </Button>
        </div>

        {/* Guest info */}
        <div className="bg-blue-50 rounded-lg p-3 space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="font-medium">{selectedReservation.guestName}</h3>
            {selectedReservation.vipStatus && selectedReservation.vipStatus !== 'none' && (
              <div className="flex items-center gap-1">
                {selectedReservation.vipStatus === 'vip' && <Star className="w-4 h-4 text-yellow-500" />}
                {selectedReservation.vipStatus === 'svip' && <Crown className="w-4 h-4 text-purple-500" />}
                {selectedReservation.vipStatus === 'corporate' && <Coffee className="w-4 h-4 text-blue-500" />}
                <span className="text-xs font-medium uppercase">{selectedReservation.vipStatus}</span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2 text-sm text-gray-600">
            <div className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              <span>{selectedReservation.checkIn} - {selectedReservation.checkOut}</span>
            </div>
            <div className="flex items-center gap-1">
              <User className="w-3 h-3" />
              <span>{selectedReservation.adults}A{selectedReservation.children > 0 ? `, ${selectedReservation.children}C` : ''}</span>
            </div>
            <div className="flex items-center gap-1">
              <Bed className="w-3 h-3" />
              <span>{selectedReservation.roomType}</span>
            </div>
            <div className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              <span>{selectedReservation.nights} nights</span>
            </div>
          </div>

          {selectedReservation.specialRequests && selectedReservation.specialRequests.length > 0 && (
            <div className="mt-2">
              <p className="text-xs text-gray-500 mb-1">Special Requests:</p>
              <div className="flex flex-wrap gap-1">
                {selectedReservation.specialRequests.map((request, index) => (
                  <Badge key={`selectedReservation-specialRequests-${index}-${request}`} variant="outline" className="text-xs">
                    {request}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col gap-3 overflow-hidden">
        {/* Filters */}
        <div className="space-y-2">
          <Input
            placeholder="Search rooms..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="text-sm"
          />

          <div className="grid grid-cols-3 gap-2">
            <Select value={floorFilter} onValueChange={setFloorFilter}>
              <SelectTrigger className="text-xs">
                <SelectValue placeholder="Floor" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Floors</SelectItem>
                <SelectItem value="1">Floor 1</SelectItem>
                <SelectItem value="2">Floor 2</SelectItem>
                <SelectItem value="3">Floor 3</SelectItem>
                <SelectItem value="4">Floor 4</SelectItem>
              </SelectContent>
            </Select>

            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="text-xs">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="Standard Room">Standard</SelectItem>
                <SelectItem value="Deluxe Room">Deluxe</SelectItem>
                <SelectItem value="Suite">Suite</SelectItem>
              </SelectContent>
            </Select>

            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="text-xs">
                <SelectValue placeholder="Sort" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="score">Match Score</SelectItem>
                <SelectItem value="rate">Rate</SelectItem>
                <SelectItem value="room">Room #</SelectItem>
                <SelectItem value="floor">Floor</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Available rooms */}
        <div className="flex-1 overflow-hidden">
          <ScrollArea className="h-full">
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="animate-pulse">
                    <div className="h-24 bg-gray-200 rounded-md"></div>
                  </div>
                ))}
              </div>
            ) : filteredRooms.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Bed className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p className="text-sm">No suitable rooms found</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredRooms.map(room => (
                  <div role="button" tabIndex={0}
                    key={room.id}
                    className="border rounded-lg p-3 hover:shadow-sm transition-shadow cursor-pointer"
                    onClick={() => handleAssignRoom(room.id)}
                   onKeyDown={(e: React.KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); const clickHandler = () => handleAssignRoom(room.id); if (typeof clickHandler === 'function') { clickHandler(e as any); } } }}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{room.roomNumber}</span>
                        {getStatusIcon(room.status)}
                        <Badge
                          variant="outline"
                          className={cn('text-xs', getScoreColor(room.assignmentScore))}
                        >
                          {room.assignmentScore}% match
                        </Badge>
                      </div>

                      <div className="text-sm font-medium text-green-600">
                        {formatCurrency(room.baseRate)}
                      </div>
                    </div>

                    <div className="text-sm text-gray-600 mb-2">
                      {room.roomType} • Floor {room.floor} • {room.size} sq ft
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500">{room.bedType}</span>
                        <span className="text-xs text-gray-500">• {room.maxOccupancy} guests</span>
                        {room.view && (
                          <Badge variant="outline" className="text-xs">
                            {room.view} view
                          </Badge>
                        )}
                      </div>

                      <div className="flex items-center gap-1">
                        {getRoomFeatureIcons(room.features)}
                      </div>
                    </div>

                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-xs text-gray-400">
                        Last cleaned: {room.lastCleaned ? new Date(room.lastCleaned).toLocaleTimeString() : 'N/A'}
                      </span>

                      <Button size="sm" variant="outline" className="text-xs">
                        Assign <ArrowRight className="w-3 h-3 ml-1" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>
      </CardContent>
    </Card>
  );
};

export default RoomAssignmentPanel;