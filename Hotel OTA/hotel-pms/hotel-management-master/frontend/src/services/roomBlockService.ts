import { api as apiClient } from './api';

export interface RoomBlock {
  _id: string;
  blockName: string;
  groupName: string;
  hotelId: {
    _id: string;
    name: string;
  };
  corporateId?: {
    _id: string;
    name: string;
  };
  eventType: 'conference' | 'wedding' | 'corporate_event' | 'group_booking' | 'convention' | 'other';
  startDate: string;
  endDate: string;
  rooms: Array<{
    _id: string;
    roomId: {
      _id: string;
      roomNumber: string;
      type: string;
    };
    roomNumber: string;
    roomType: string;
    rate?: number;
    status: 'blocked' | 'booked' | 'released';
    guestName?: string;
    specialRequests?: string;
    bookingId?: string;
  }>;
  totalRooms: number;
  roomsBooked: number;
  roomsReleased: number;
  availableRooms: number;
  blockRate?: number;
  currency: string;
  cutOffDate?: string;
  autoReleaseDate?: string;
  status: 'active' | 'completed' | 'cancelled' | 'partially_released';
  contactPerson: {
    name?: string;
    email?: string;
    phone?: string;
    title?: string;
  };
  billingInstructions: string;
  specialInstructions?: string;
  amenities: string[];
  cateringRequirements?: string;
  paymentTerms: {
    depositPercentage: number;
    paymentDueDate?: string;
    cancellationPolicy: string;
  };
  notes: Array<{
    _id: string;
    content: string;
    createdBy: {
      _id: string;
      name: string;
    };
    createdAt: string;
    isInternal: boolean;
  }>;
  nights: number;
  createdBy: {
    _id: string;
    name: string;
    email: string;
  };
  lastModifiedBy?: {
    _id: string;
    name: string;
    email: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface CreateRoomBlockData {
  blockId?: string;
  blockName: string;
  groupName: string;
  hotelId: string;
  corporateId?: string;
  eventType: 'conference' | 'wedding' | 'corporate_event' | 'group_booking' | 'convention' | 'other';
  startDate: string;
  endDate: string;
  roomIds: string[];
  totalRooms?: number;
  blockRate?: number;
  contactPerson: {
    name?: string;
    email?: string;
    phone?: string;
    title?: string;
  };
  billingInstructions: 'master_account' | 'individual_folios' | 'split_billing';
  specialInstructions?: string;
  amenities?: string[];
  cateringRequirements?: string;
  paymentTerms?: {
    depositPercentage?: number;
    paymentDueDate?: string;
    cancellationPolicy?: string;
  };
}

export interface RoomBlockFilters {
  hotelId?: string;
  status?: string;
  eventType?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface RoomBlockStats {
  statusStats: Array<{
    _id: string;
    count: number;
    totalRooms: number;
    totalBookedRooms: number;
    totalReleasedRooms: number;
  }>;
  eventTypeStats: Array<{
    _id: string;
    count: number;
    totalRooms: number;
  }>;
  recentBlocks: RoomBlock[];
}

class RoomBlockService {
  // Create a new room block
  async createRoomBlock(data: CreateRoomBlockData): Promise<RoomBlock> {
    const response = await apiClient.post('/room-blocks', data);
    return response.data.data;
  }

  // Get all room blocks with filters
  async getRoomBlocks(filters: RoomBlockFilters = {}): Promise<{
    data: RoomBlock[];
    pagination: {
      current: number;
      pages: number;
      total: number;
    };
  }> {
    const params = new URLSearchParams();
    
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params.append(key, value.toString());
      }
    });

    const response = await apiClient.get(`/room-blocks?${params.toString()}`);
    return {
      data: response.data.data,
      pagination: response.data.pagination
    };
  }

  // Get room block by ID
  async getRoomBlock(id: string): Promise<RoomBlock> {
    const response = await apiClient.get(`/room-blocks/${id}`);
    return response.data.data;
  }

  // Update room block
  async updateRoomBlock(id: string, data: Partial<CreateRoomBlockData>): Promise<RoomBlock> {
    const response = await apiClient.put(`/room-blocks/${id}`, data);
    return response.data.data;
  }

  // Release a room from block
  async releaseRoom(blockId: string, roomId: string, reason?: string): Promise<RoomBlock> {
    const response = await apiClient.post(`/room-blocks/${blockId}/rooms/${roomId}/release`, {
      reason
    });
    return response.data.data;
  }

  // Book a room from block
  async bookRoom(
    blockId: string, 
    roomId: string, 
    data: {
      guestName: string;
      specialRequests?: string;
      bookingId?: string;
    }
  ): Promise<RoomBlock> {
    const response = await apiClient.post(`/room-blocks/${blockId}/rooms/${roomId}/book`, data);
    return response.data.data;
  }

  // Get room block statistics
  async getRoomBlockStats(hotelId?: string): Promise<RoomBlockStats> {
    const params = new URLSearchParams();
    if (hotelId) params.append('hotelId', hotelId);
    
    const response = await apiClient.get(`/room-blocks/stats?${params.toString()}`);
    return response.data.data;
  }

  // Add note to room block
  async addNote(blockId: string, content: string, isInternal: boolean = true): Promise<RoomBlock['notes']> {
    const response = await apiClient.post(`/room-blocks/${blockId}/notes`, {
      content,
      isInternal
    });
    return response.data.data;
  }

  // Get available rooms for blocking
  async getAvailableRooms(
    hotelId: string,
    startDate: string,
    endDate: string,
    roomType?: string
  ): Promise<Array<{
    _id: string;
    roomNumber: string;
    type: string;
    floor?: number;
    currentRate: number;
  }>> {
    const params = new URLSearchParams({
      hotelId,
      startDate,
      endDate
    });
    
    if (roomType) params.append('roomType', roomType);
    
    const response = await apiClient.get(`/rooms?checkIn=${startDate.split('T')[0]}&checkOut=${endDate.split('T')[0]}&${params.toString()}`, {
      headers: {
        'x-admin-request': 'true'
      }
    });
    return response.data.data.rooms;
  }

  // Calculate room block revenue
  calculateTotalRevenue(roomBlock: RoomBlock): number {
    return roomBlock.rooms.reduce((total, room) => {
      if (room.status === 'booked' && room.rate) {
        return total + (room.rate * roomBlock.nights);
      }
      return total;
    }, 0);
  }

  // Get room block utilization percentage
  getUtilizationPercentage(roomBlock: RoomBlock): number {
    if (roomBlock.totalRooms === 0) return 0;
    return Math.round((roomBlock.roomsBooked / roomBlock.totalRooms) * 100);
  }

  // Check if room block is near cut-off date
  isNearCutOff(roomBlock: RoomBlock, daysThreshold: number = 7): boolean {
    if (!roomBlock.cutOffDate) return false;
    
    const cutOffDate = new Date(roomBlock.cutOffDate);
    const now = new Date();
    const diffTime = cutOffDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return diffDays <= daysThreshold && diffDays > 0;
  }

  // Get room block status color
  getStatusColor(status: RoomBlock['status']): string {
    const colors = {
      active: 'text-green-600 bg-green-50',
      completed: 'text-blue-600 bg-blue-50',
      cancelled: 'text-red-600 bg-red-50',
      partially_released: 'text-yellow-600 bg-yellow-50'
    };
    return colors[status] || 'text-gray-600 bg-gray-50';
  }

  // Get event type display name
  getEventTypeDisplayName(eventType: RoomBlock['eventType']): string {
    const names = {
      conference: 'Conference',
      wedding: 'Wedding',
      corporate_event: 'Corporate Event',
      group_booking: 'Group Booking',
      convention: 'Convention',
      other: 'Other'
    };
    return names[eventType] || eventType;
  }
}

export default new RoomBlockService();