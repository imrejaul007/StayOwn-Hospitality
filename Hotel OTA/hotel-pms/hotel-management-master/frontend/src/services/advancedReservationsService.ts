import { api } from './api';

export interface AdvancedReservation {
  _id: string;
  reservationId: string;
  bookingId: {
    _id: string;
    bookingNumber: string;
    guestName: string;
    checkIn: string;
    checkOut: string;
    status: string;
    totalAmount?: number;
  };
  reservationType: 'standard' | 'group' | 'corporate' | 'vip' | 'complimentary' | 'house_use';
  priority: 'low' | 'medium' | 'high' | 'vip';
  roomPreferences: {
    preferredRooms?: string[];
    preferredFloor?: number;
    preferredView?: string;
    adjacentRooms?: boolean;
    connectingRooms?: boolean;
    accessibleRoom?: boolean;
    smokingPreference?: 'non_smoking' | 'smoking' | 'no_preference';
  };
  guestProfile: {
    vipStatus?: 'none' | 'member' | 'silver' | 'gold' | 'platinum' | 'diamond';
    loyaltyNumber?: string;
    preferences?: {
      bedType?: string;
      pillowType?: string;
      roomTemperature?: number;
      newspaper?: string;
      wakeUpCall?: boolean;
      turndownService?: boolean;
    };
    allergies?: string[];
    specialNeeds?: string[];
    dietaryRestrictions?: string[];
  };
  roomAssignments: Array<{
    _id: string;
    roomId: {
      _id: string;
      roomNumber: string;
      type: string;
      floor: number;
    };
    roomNumber: string;
    assignedDate: string;
    assignmentType: 'auto' | 'manual' | 'upgrade' | 'preference';
    assignedBy: {
      _id: string;
      name: string;
      email: string;
    };
    notes?: string;
  }>;
  upgrades: Array<{
    _id: string;
    fromRoomType: string;
    toRoomType: string;
    upgradeType: 'complimentary' | 'paid' | 'loyalty' | 'operational';
    upgradeReason?: string;
    additionalCharge: number;
    approvedBy: {
      _id: string;
      name: string;
      email: string;
    };
    upgradeDate: string;
  }>;
  specialRequests: Array<{
    _id: string;
    type: 'room_setup' | 'amenities' | 'services' | 'dining' | 'transportation' | 'other';
    description: string;
    priority: 'low' | 'medium' | 'high';
    status: 'pending' | 'confirmed' | 'completed' | 'cancelled';
    assignedTo?: {
      _id: string;
      name: string;
      email: string;
    };
    dueDate?: string;
    cost?: number;
    notes?: string;
  }>;
  reservationFlags: Array<{
    _id: string;
    flag: 'credit_hold' | 'no_show_risk' | 'special_attention' | 'vip' | 'complainer' | 'loyalty_member';
    severity: 'info' | 'warning' | 'critical';
    description?: string;
    createdBy: {
      _id: string;
      name: string;
    };
    createdAt: string;
    expiryDate?: string;
  }>;
  waitlistInfo?: {
    waitlistPosition?: number;
    waitlistDate?: string;
    preferredRoomTypes?: string[];
    maxRate?: number;
    flexibleDates?: {
      checkInRange?: {
        start: string;
        end: string;
      };
      checkOutRange?: {
        start: string;
        end: string;
      };
    };
    notificationPreferences?: {
      email?: boolean;
      sms?: boolean;
      phone?: boolean;
    };
    autoConfirm?: boolean;
  };
  createdAt: string;
  updatedAt: string;
}

export interface CreateAdvancedReservationData {
  bookingId: string;
  reservationType?: AdvancedReservation['reservationType'];
  priority?: AdvancedReservation['priority'];
  roomPreferences?: AdvancedReservation['roomPreferences'];
  guestProfile?: AdvancedReservation['guestProfile'];
  specialRequests?: Omit<AdvancedReservation['specialRequests'][0], '_id' | 'assignedTo' | 'createdAt'>[];
  waitlistInfo?: AdvancedReservation['waitlistInfo'];
}

export interface AdvancedReservationFilters {
  reservationType?: string;
  priority?: string;
  hasWaitlist?: boolean;
  search?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface AdvancedReservationsStats {
  typeStats: Array<{
    _id: string;
    count: number;
  }>;
  priorityStats: Array<{
    _id: string;
    count: number;
  }>;
  upgradeStats: Array<{
    _id: string;
    count: number;
    totalCharge: number;
  }>;
  waitlistCount: number;
  recentReservations: Array<{
    _id: string;
    reservationId: string;
    bookingId: {
      bookingNumber: string;
      guestName: string;
    };
    priority: string;
    createdAt: string;
  }>;
}

class AdvancedReservationsService {
  private baseURL = '/api/v1/advanced-reservations';

  // Get all advanced reservations
  async getAdvancedReservations(filters?: AdvancedReservationFilters): Promise<{
    data: AdvancedReservation[];
    pagination: {
      current: number;
      pages: number;
      total: number;
    };
  }> {
    try {
      const params = new URLSearchParams();
    
      if (filters?.reservationType) params.append('reservationType', filters.reservationType);
      if (filters?.priority) params.append('priority', filters.priority);
      if (filters?.hasWaitlist !== undefined) params.append('hasWaitlist', filters.hasWaitlist.toString());
      if (filters?.search) params.append('search', filters.search);
      if (filters?.page) params.append('page', filters.page.toString());
      if (filters?.limit) params.append('limit', filters.limit.toString());
      if (filters?.sortBy) params.append('sortBy', filters.sortBy);
      if (filters?.sortOrder) params.append('sortOrder', filters.sortOrder);

      const response = await api.get(`${this.baseURL}?${params.toString()}`);
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  // Get advanced reservation by ID
  async getAdvancedReservation(id: string): Promise<AdvancedReservation> {
    try {
      const response = await api.get(`${this.baseURL}/${id}`);
      return response.data.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  // Create new advanced reservation
  async createAdvancedReservation(data: CreateAdvancedReservationData): Promise<AdvancedReservation> {
    try {
      const response = await api.post(this.baseURL, data);
      return response.data.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  // Update advanced reservation
  async updateAdvancedReservation(id: string, data: Partial<CreateAdvancedReservationData>): Promise<AdvancedReservation> {
    try {
      const response = await api.put(`${this.baseURL}/${id}`, data);
      return response.data.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  // Assign room to reservation
  async assignRoom(id: string, roomId: string, assignmentType?: string, notes?: string): Promise<AdvancedReservation> {
    try {
      const response = await api.post(`${this.baseURL}/${id}/assign-room`, {
        roomId,
        assignmentType,
        notes
      });
      return response.data.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  // Add upgrade
  async addUpgrade(id: string, upgrade: {
    fromRoomType: string;
    toRoomType: string;
    upgradeType: 'complimentary' | 'paid' | 'loyalty' | 'operational';
    upgradeReason?: string;
    additionalCharge?: number;
  }): Promise<AdvancedReservation> {
    try {
      const response = await api.post(`${this.baseURL}/${id}/add-upgrade`, upgrade);
      return response.data.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  // Add reservation flag
  async addReservationFlag(id: string, flag: {
    flag: AdvancedReservation['reservationFlags'][0]['flag'];
    severity?: 'info' | 'warning' | 'critical';
    description?: string;
    expiryDate?: string;
  }): Promise<AdvancedReservation['reservationFlags']> {
    try {
      const response = await api.post(`${this.baseURL}/${id}/add-flag`, flag);
      return response.data.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  // Get advanced reservations statistics
  async getAdvancedReservationsStats(): Promise<AdvancedReservationsStats> {
    try {
      const response = await api.get(`${this.baseURL}/stats`);
      return response.data.data;
    } catch (error: unknown) {
      // Return default stats if API fails
      return {
        typeStats: [],
        priorityStats: [],
        upgradeStats: [],
        waitlistCount: 0,
        recentReservations: []
      };
    }
  }
}

export default new AdvancedReservationsService();