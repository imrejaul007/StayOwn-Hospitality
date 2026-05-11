import { api } from './api';

export interface RoomTypeAmenity {
  code: string;
  name?: string;
  category?: string;
  isHighlight?: boolean;
}

export interface RoomType {
  _id: string;
  roomTypeId: string;
  hotelId: string;
  name: string;
  code: string;
  maxOccupancy: number;
  basePrice: number;
  baseRate?: number;
  description?: string;
  amenities?: Array<string | RoomTypeAmenity>;
  images?: string[];
  size?: {
    squareFeet?: number;
    squareMeters?: number;
  };
  bedConfiguration?: Array<{
    bedType: 'single' | 'double' | 'queen' | 'king' | 'twin' | 'sofa_bed';
    quantity: number;
  }>;
  settings?: {
    allowOverbooking?: boolean;
    overbookingLimit?: number;
    requiresApproval?: boolean;
  };
  isActive: boolean;
  legacyType?: 'single' | 'double' | 'suite' | 'deluxe';
  channelMappings?: Array<{
    channel: string;
    channelRoomTypeId: string;
    channelRoomTypeName: string;
    isActive: boolean;
  }>;
  totalRooms?: number; // Added when includeStats=true
  createdAt: string;
  updatedAt: string;
}

export interface RoomTypeOption {
  id: string;
  roomTypeId: string;
  name: string;
  code: string;
  basePrice: number;
  maxOccupancy: number;
  legacyType?: string;
}

export interface CreateRoomTypeData {
  hotelId: string;
  name: string;
  code: string;
  maxOccupancy: number;
  basePrice: number;
  description?: string;
  amenities?: Array<string | RoomTypeAmenity>;
  images?: string[];
  size?: {
    squareFeet?: number;
    squareMeters?: number;
  };
  bedConfiguration?: Array<{
    bedType: 'single' | 'double' | 'queen' | 'king' | 'twin' | 'sofa_bed';
    quantity: number;
  }>;
  settings?: {
    allowOverbooking?: boolean;
    overbookingLimit?: number;
    requiresApproval?: boolean;
  };
  legacyType?: 'single' | 'double' | 'suite' | 'deluxe';
}

export interface MigrationResult {
  totalRooms: number;
  migratedCount: number;
  results: Array<{
    roomId: string;
    roomNumber: string;
    legacyType: string;
    roomTypeId?: string;
    status: 'migrated' | 'failed';
    error?: string;
  }>;
}

class RoomTypeService {
  /**
   * Get all room types for a hotel
   */
  async getRoomTypes(hotelId: string, options: {
    isActive?: boolean;
    includeStats?: boolean;
  } = {}): Promise<RoomType[]> {
    try {
      const params = new URLSearchParams();
      if (options.isActive !== undefined) {
        params.append('isActive', options.isActive.toString());
      }
      if (options.includeStats) {
        params.append('includeStats', 'true');
      }

      const response = await api.get(`/room-types/hotel/${hotelId}?${params.toString()}`);
      return response.data.data;
    } catch (error: unknown) {
      const axiosErr = error as { response?: { data?: { message?: string }; status?: number }; config?: unknown };
      throw new Error(axiosErr.response?.data?.message || 'Failed to fetch room types');
    }
  }

  /**
   * Get room type options for dropdowns
   */
  async getRoomTypeOptions(hotelId: string): Promise<RoomTypeOption[]> {
    try {
      const response = await api.get(`/room-types/hotel/${hotelId}/options`);
      return response.data.data;
    } catch (error: unknown) {
      const axiosErr = error as { response?: { data?: { message?: string }; status?: number }; config?: unknown };
      throw new Error(axiosErr.response?.data?.message || 'Failed to fetch room type options');
    }
  }

  /**
   * Get single room type by ID
   */
  async getRoomType(roomTypeId: string): Promise<RoomType> {
    try {
      const response = await api.get(`/room-types/${roomTypeId}`);
      return response.data.data;
    } catch (error: unknown) {
      const axiosErr = error as { response?: { data?: { message?: string }; status?: number }; config?: unknown };
      throw new Error(axiosErr.response?.data?.message || 'Failed to fetch room type');
    }
  }

  /**
   * Create new room type
   */
  async createRoomType(roomTypeData: CreateRoomTypeData): Promise<RoomType> {
    try {
      const response = await api.post('/room-types', roomTypeData);
      return response.data.data;
    } catch (error: unknown) {
      const axiosErr = error as { response?: { data?: { message?: string }; status?: number }; config?: unknown };
      throw new Error(axiosErr.response?.data?.message || 'Failed to create room type');
    }
  }

  /**
   * Update room type
   */
  async updateRoomType(roomTypeId: string, updateData: Partial<CreateRoomTypeData>): Promise<RoomType> {
    try {
      const response = await api.put(`/room-types/${roomTypeId}`, updateData);
      return response.data.data;
    } catch (error: unknown) {
      const axiosErr = error as { response?: { data?: { message?: string }; status?: number }; config?: unknown };
      throw new Error(axiosErr.response?.data?.message || 'Failed to update room type');
    }
  }

  /**
   * Delete (deactivate) room type
   */
  async deleteRoomType(roomTypeId: string): Promise<void> {
    try {
      await api.delete(`/room-types/${roomTypeId}`);
    } catch (error: unknown) {
      const axiosErr = error as { response?: { data?: { message?: string }; status?: number }; config?: unknown };
      throw new Error(axiosErr.response?.data?.message || 'Failed to delete room type');
    }
  }

  /**
   * Add channel mapping to room type
   */
  async addChannelMapping(roomTypeId: string, mappingData: {
    channel: string;
    channelRoomTypeId: string;
    channelRoomTypeName: string;
  }): Promise<RoomType> {
    try {
      const response = await api.post(`/room-types/${roomTypeId}/channel-mapping`, mappingData);
      return response.data.data;
    } catch (error: unknown) {
      const axiosErr = error as { response?: { data?: { message?: string }; status?: number }; config?: unknown };
      throw new Error(axiosErr.response?.data?.message || 'Failed to add channel mapping');
    }
  }

  /**
   * Remove channel mapping from room type
   */
  async removeChannelMapping(roomTypeId: string, channelId: string): Promise<void> {
    try {
      await api.delete(`/room-types/${roomTypeId}/channel-mapping/${channelId}`);
    } catch (error: unknown) {
      const axiosErr = error as { response?: { data?: { message?: string }; status?: number }; config?: unknown };
      throw new Error(axiosErr.response?.data?.message || 'Failed to remove channel mapping');
    }
  }

  /**
   * Get room type by legacy type (for backward compatibility)
   */
  async getRoomTypeByLegacy(hotelId: string, legacyType: string): Promise<RoomType> {
    try {
      const response = await api.get(`/room-types/legacy/${hotelId}/${legacyType}`);
      return response.data.data;
    } catch (error: unknown) {
      const axiosErr = error as { response?: { data?: { message?: string }; status?: number }; config?: unknown };
      throw new Error(axiosErr.response?.data?.message || 'Failed to fetch room type by legacy type');
    }
  }

  /**
   * Migrate existing rooms to use room types
   */
  async migrateRoomsToRoomTypes(hotelId: string): Promise<MigrationResult> {
    try {
      const response = await api.post(`/room-types/migrate/hotel/${hotelId}/rooms`);
      return response.data.data;
    } catch (error: unknown) {
      const axiosErr = error as { response?: { data?: { message?: string }; status?: number }; config?: unknown };
      throw new Error(axiosErr.response?.data?.message || 'Failed to migrate rooms');
    }
  }

  /**
   * Create inventory for room type
   */
  async createInventoryForRoomType(roomTypeId: string, inventoryData: {
    year: number;
    month: number;
    totalRooms: number;
    baseRate: number;
  }): Promise<{
    roomTypeId: string;
    year: number;
    month: number;
    recordsCreated: number;
  }> {
    try {
      const response = await api.post(`/room-types/${roomTypeId}/inventory`, inventoryData);
      return response.data.data;
    } catch (error: unknown) {
      const axiosErr = error as { response?: { data?: { message?: string }; status?: number }; config?: unknown };
      throw new Error(axiosErr.response?.data?.message || 'Failed to create inventory');
    }
  }

  /**
   * Resolve legacy room type to new room type
   * This is a utility method for transitioning from legacy to new system
   */
  async resolveLegacyToRoomType(hotelId: string, legacyType: string): Promise<string | null> {
    try {
      const roomType = await this.getRoomTypeByLegacy(hotelId, legacyType);
      return roomType._id;
    } catch (error) {
      return null;
    }
  }

  /**
   * Get room types with inventory statistics
   */
  async getRoomTypesWithStats(hotelId: string): Promise<RoomType[]> {
    return this.getRoomTypes(hotelId, { includeStats: true });
  }

  /**
   * Get active room types for booking
   */
  async getActiveRoomTypesForBooking(hotelId: string): Promise<RoomTypeOption[]> {
    const roomTypes = await this.getRoomTypes(hotelId, { isActive: true });
    return roomTypes.map(rt => ({
      id: rt._id,
      roomTypeId: rt.roomTypeId,
      name: rt.name,
      code: rt.code,
      basePrice: rt.basePrice,
      maxOccupancy: rt.maxOccupancy,
      legacyType: rt.legacyType
    }));
  }
}

export const roomTypeService = new RoomTypeService();
export default roomTypeService;