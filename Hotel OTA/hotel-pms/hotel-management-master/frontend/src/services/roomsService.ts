import { api } from './api';

export interface Room {
  _id: string;
  hotelId: string;
  roomNumber: string;
  roomTypeId?: string;
  type: 'single' | 'double' | 'suite' | 'deluxe';
  baseRate: number;
  currentRate: number;
  status: 'vacant' | 'occupied' | 'dirty' | 'cleaning' | 'reserved' | 'maintenance' | 'out_of_order';
  computedStatus?: 'vacant' | 'occupied' | 'dirty' | 'cleaning' | 'reserved' | 'maintenance' | 'out_of_order';
  floor: number;
  capacity: number;
  amenities: string[];
  images: string[];
  description: string;
  isActive: boolean;
  maintenanceNotes?: string;
  lastCleaned?: string;
  createdAt: string;
  updatedAt: string;
  currentBooking?: {
    bookingId: string;
    checkIn: string;
    checkOut: string;
    status: string;
  };
}

export interface RoomMetrics {
  totalRooms: number;
  availableRooms: number;
  occupiedRooms: number;
  maintenanceRooms: number;
  outOfOrderRooms: number;
  dirtyRooms: number;
  occupancyRate: number;
  availabilityRate: number;
}

export interface RoomsResponse {
  rooms: Room[];
  metrics: RoomMetrics;
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

class RoomsService {
  private baseUrl = '/rooms';

  async getRooms(params?: {
    hotelId?: string;
    page?: number;
    limit?: number;
    type?: string;
    status?: string;
    floor?: number;
  }): Promise<RoomsResponse> {
    try {
      const searchParams = new URLSearchParams();
    
      if (params) {
        Object.entries(params).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            searchParams.append(key, value.toString());
          }
        });
      }

      const response = await api.get(`${this.baseUrl}?${searchParams.toString()}`);
      return response.data.data; // The API returns { status: 'success', data: {...} }
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  async getAdminRooms(params?: {
    hotelId?: string;
    page?: number;
    limit?: number;
    type?: string;
    status?: string;
    floor?: number;
  }): Promise<RoomsResponse> {
    try {
      const searchParams = new URLSearchParams();

      if (params) {
        Object.entries(params).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            searchParams.append(key, value.toString());
          }
        });
      }

      const response = await api.get(`${this.baseUrl}?${searchParams.toString()}`, {
        headers: {
          'X-Admin-Request': 'true'
        }
      });

      return response.data.data; // The API returns { status: 'success', data: {...} }
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  async getRoomById(id: string): Promise<Room> {
    try {
      const response = await api.get(`${this.baseUrl}/${id}`);
      return response.data.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  async updateRoom(id: string, updates: Partial<Room>): Promise<Room> {
    try {
      const response = await api.patch(`${this.baseUrl}/${id}`, updates);
      return response.data.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  async updateRoomStatus(id: string, status: Room['status']): Promise<Room> {
    try {
      const response = await api.patch(`${this.baseUrl}/${id}`, { status });
      return response.data.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  async bulkUpdateStatus(roomIds: string[], status: Room['status']): Promise<Room[]> {
    // Since there's no bulk endpoint, update rooms in batches of 5 to avoid rate limits
    const results: Room[] = [];
    const batchSize = 5;
    for (let i = 0; i < roomIds.length; i += batchSize) {
      const batch = roomIds.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map(id => this.updateRoomStatus(id, status))
      );
      results.push(...batchResults);
    }
    return results;
  }

  async getRoomMetrics(hotelId: string): Promise<RoomMetrics> {
    try {
      const response = await api.get(`${this.baseUrl}/metrics?hotelId=${hotelId}`);
      return response.data.data; // The API returns { status: 'success', data: {...} }
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }
}

export const roomsService = new RoomsService();