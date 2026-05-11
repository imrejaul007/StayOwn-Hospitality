import { api } from './api';

export interface WaitingListEntry {
  _id: string;
  waitlistId: string;
  guestName: string;
  email: string;
  phone: string;
  roomType: string;
  hotelId: string;
  preferredDates: {
    checkIn: string;
    checkOut: string;
  };
  alternativeDates?: {
    checkIn: string;
    checkOut: string;
  }[];
  guests: number;
  priority: 'low' | 'medium' | 'high';
  vipStatus: boolean;
  loyaltyTier?: string;
  specialRequests: string;
  contactPreference: 'email' | 'phone' | 'sms';
  maxRate?: number;
  status: 'active' | 'contacted' | 'confirmed' | 'expired' | 'cancelled';
  addedDate: string;
  lastContact?: string;
  contactHistory: Array<{
    contactDate: string;
    method: string;
    message: string;
    contactedBy: {
      _id: string;
      name: string;
      email: string;
    };
  }>;
  notes: Array<{
    content: string;
    createdAt: string;
    createdBy: {
      _id: string;
      name: string;
      email: string;
    };
    isInternal: boolean;
  }>;
  source: string;
  notificationPreferences: {
    email: boolean;
    sms: boolean;
    phone: boolean;
  };
  roomAvailabilityAlerts: boolean;
  autoConfirm: boolean;
  expiryDate?: string;
  convertedToBooking?: {
    bookingId: {
      _id: string;
      bookingNumber: string;
    };
    convertedDate: string;
    convertedBy: {
      _id: string;
      name: string;
      email: string;
    };
  };
  priority_score: number;
  engagement_score: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateWaitingListEntryData {
  guestName: string;
  email: string;
  phone?: string;
  roomType: string;
  preferredDates: {
    checkIn: string;
    checkOut: string;
  };
  alternativeDates?: {
    checkIn: string;
    checkOut: string;
  }[];
  guests?: number;
  priority?: 'low' | 'medium' | 'high';
  vipStatus?: boolean;
  loyaltyTier?: string;
  specialRequests?: string;
  contactPreference?: 'email' | 'phone' | 'sms';
  maxRate?: number;
  source?: string;
  notificationPreferences?: {
    email?: boolean;
    sms?: boolean;
    phone?: boolean;
  };
}

export interface WaitingListFilters {
  status?: string;
  priority?: string;
  roomType?: string;
  vipStatus?: boolean;
  search?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface RoomAvailability {
  roomType: string;
  available: number;
  total: number;
  nextAvailable: string;
}

export interface WaitingListStats {
  statusBreakdown: Array<{
    _id: string;
    count: number;
    avgWaitTime: number;
  }>;
  totalActive: number;
  vipCount: number;
  urgentCount: number;
  recentEntries: Array<{
    _id: string;
    waitlistId: string;
    guestName: string;
    roomType: string;
    priority: string;
    addedDate: string;
    status: string;
  }>;
}

class WaitingListService {
  private baseURL = '/waiting-list';

  // Get all waiting list entries with filters
  async getWaitingList(filters?: WaitingListFilters): Promise<{
    data: WaitingListEntry[];
    pagination: {
      current: number;
      pages: number;
      total: number;
    };
  }> {
    try {
      const params = new URLSearchParams();

      if (filters?.status) params.append('status', filters.status);
      if (filters?.priority) params.append('priority', filters.priority);
      if (filters?.roomType) params.append('roomType', filters.roomType);
      if (filters?.vipStatus !== undefined) params.append('vipStatus', filters.vipStatus.toString());
      if (filters?.search) params.append('search', filters.search);
      if (filters?.page) params.append('page', filters.page.toString());
      if (filters?.limit) params.append('limit', filters.limit.toString());
      if (filters?.sortBy) params.append('sortBy', filters.sortBy);
      if (filters?.sortOrder) params.append('sortOrder', filters.sortOrder);

      const response = await api.get(`${this.baseURL}?${params.toString()}`);
      return response.data;
    } catch (error: unknown) {
      throw this.handleError(error);
    }
  }

  // Get single waiting list entry
  async getWaitingListEntry(id: string): Promise<WaitingListEntry> {
    try {
      const response = await api.get(`${this.baseURL}/${id}`);
      return response.data.data;
    } catch (error: unknown) {
      throw this.handleError(error);
    }
  }

  // Create new waiting list entry
  async createWaitingListEntry(data: CreateWaitingListEntryData): Promise<WaitingListEntry> {
    try {
      const response = await api.post(this.baseURL, data);
      return response.data.data;
    } catch (error: unknown) {
      throw this.handleError(error);
    }
  }

  // Update waiting list entry
  async updateWaitingListEntry(id: string, data: Partial<CreateWaitingListEntryData>): Promise<WaitingListEntry> {
    try {
      const response = await api.put(`${this.baseURL}/${id}`, data);
      return response.data.data;
    } catch (error: unknown) {
      throw this.handleError(error);
    }
  }

  // Update entry status
  async updateStatus(id: string, status: WaitingListEntry['status'], note?: string): Promise<WaitingListEntry> {
    try {
      const response = await api.patch(`${this.baseURL}/${id}/status`, { status, note });
      return response.data.data;
    } catch (error: unknown) {
      throw this.handleError(error);
    }
  }

  // Update entry priority
  async updatePriority(id: string, priority: WaitingListEntry['priority']): Promise<WaitingListEntry> {
    try {
      const response = await api.patch(`${this.baseURL}/${id}/priority`, { priority });
      return response.data.data;
    } catch (error: unknown) {
      throw this.handleError(error);
    }
  }

  // Add note to entry
  async addNote(id: string, content: string, isInternal: boolean = true): Promise<WaitingListEntry> {
    try {
      const response = await api.post(`${this.baseURL}/${id}/notes`, { content, isInternal });
      return response.data.data;
    } catch (error: unknown) {
      throw this.handleError(error);
    }
  }

  // Record contact with guest
  async recordContact(id: string, method: string, message: string): Promise<WaitingListEntry> {
    try {
      const response = await api.post(`${this.baseURL}/${id}/contact`, { method, message });
      return response.data.data;
    } catch (error: unknown) {
      throw this.handleError(error);
    }
  }

  // Send availability notification
  async sendAvailabilityNotification(id: string, message?: string): Promise<{
    method: string;
    recipient: string;
    message: string;
  }> {
    try {
      const response = await api.post(`${this.baseURL}/${id}/notify`, { message });
      return response.data.data;
    } catch (error: unknown) {
      throw this.handleError(error);
    }
  }

  // Delete waiting list entry
  async deleteWaitingListEntry(id: string): Promise<void> {
    try {
      await api.delete(`${this.baseURL}/${id}`);
    } catch (error: unknown) {
      throw this.handleError(error);
    }
  }

  // Get room availability
  async getRoomAvailability(checkIn?: string, checkOut?: string): Promise<RoomAvailability[]> {
    try {
      const params = new URLSearchParams();
      if (checkIn) params.append('checkIn', checkIn);
      if (checkOut) params.append('checkOut', checkOut);

      const response = await api.get(`${this.baseURL}/room-availability?${params.toString()}`);
      return response.data.data;
    } catch (error: unknown) {
      // Return fallback data on error
      return this.getFallbackRoomAvailability();
    }
  }

  // Get waitlist statistics
  async getWaitlistStats(): Promise<WaitingListStats> {
    try {
      const response = await api.get(`${this.baseURL}/stats`);
      return response.data.data;
    } catch (error: unknown) {
      // Return fallback stats on error
      return this.getFallbackStats();
    }
  }

  // Error handling helper
  private handleError(error: unknown) {
    const axiosErr = error as { response?: { data?: { message?: string } } };
    if (axiosErr.response?.data?.message) {
      return new Error(axiosErr.response.data.message);
    }
    if (error instanceof Error) {
      return new Error((error instanceof Error ? error.message : "Unknown error"));
    }
    return new Error('An unexpected error occurred');
  }

  // Fallback room availability data
  private getFallbackRoomAvailability(): RoomAvailability[] {
    return [
      { roomType: 'Standard Room', available: 0, total: 12, nextAvailable: new Date().toISOString().split('T')[0] },
      { roomType: 'Deluxe Room', available: 0, total: 8, nextAvailable: new Date().toISOString().split('T')[0] },
      { roomType: 'Executive Room', available: 0, total: 6, nextAvailable: new Date().toISOString().split('T')[0] },
      { roomType: 'Deluxe Suite', available: 0, total: 4, nextAvailable: new Date().toISOString().split('T')[0] },
      { roomType: 'Presidential Suite', available: 0, total: 2, nextAvailable: new Date().toISOString().split('T')[0] }
    ];
  }

  // Fallback stats data
  private getFallbackStats(): WaitingListStats {
    return {
      statusBreakdown: [],
      totalActive: 0,
      vipCount: 0,
      urgentCount: 0,
      recentEntries: []
    };
  }
}

export default new WaitingListService();