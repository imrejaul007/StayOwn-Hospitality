import { api } from './api';

export interface GuestServiceRequest {
  _id: string;
  hotelId: {
    _id: string;
    name: string;
  };
  userId: {
    _id: string;
    name: string;
    email: string;
  };
  bookingId: {
    _id: string;
    bookingNumber: string;
    rooms?: {
      roomId?: {
        _id: string;
        roomNumber: string;
      };
    }[];
  };
  serviceType: 'room_service' | 'housekeeping' | 'maintenance' | 'concierge' | 'transport' | 'spa' | 'laundry' | 'other';
  serviceVariation?: string;
  serviceVariations?: string[];
  completedServiceVariations?: string[];
  title?: string;
  description?: string;
  priority: 'now' | 'later' | 'low' | 'medium' | 'high' | 'urgent';
  status: 'pending' | 'assigned' | 'in_progress' | 'completed' | 'cancelled';
  scheduledTime?: string;
  completedTime?: string;
  estimatedCost?: number;
  items?: {
    name: string;
    quantity: number;
    price?: number;
  }[];
  specialInstructions?: string;
  assignedTo?: {
    _id: string;
    name: string;
    email: string;
    role: string;
  };
  notes?: string;
  actualCost?: number;
  estimatedCost?: number;
  completedTime?: string;
  rating?: number;
  feedback?: string;
  cancellationReason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateGuestServiceRequest {
  bookingId: string;
  serviceType: GuestServiceRequest['serviceType'];
  serviceVariation?: string;
  serviceVariations?: string[];
  title?: string;
  description?: string;
  priority?: GuestServiceRequest['priority'];
  scheduledTime?: string;
  items?: GuestServiceRequest['items'];
  specialInstructions?: string;
}

export interface UpdateGuestServiceRequest {
  status?: GuestServiceRequest['status'];
  assignedTo?: string;
  notes?: string;
  actualCost?: number;
  scheduledTime?: string;
  priority?: GuestServiceRequest['priority'];
  completedServiceVariations?: string[];
  cancellationReason?: string;
  rating?: number;
  feedback?: string;
}

export interface ServiceRequestStats {
  totalRequests: number;
  avgRating: number;
  totalRevenue: number;
  pendingCount: number;
  completedCount: number;
}

export interface ServiceStatsResponse {
  overall: ServiceRequestStats;
  byServiceType: {
    _id: string;
    count: number;
    avgRating: number;
    totalRevenue: number;
  }[];
}

export interface StaffMember {
  _id: string;
  name: string;
  email: string;
  department?: string;
}

export interface GuestServiceRequestsResponse {
  serviceRequests: GuestServiceRequest[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

class GuestServiceRequestService {
  /**
   * Create a new guest service request
   */
  async createServiceRequest(data: CreateGuestServiceRequest): Promise<GuestServiceRequest> {
    try {
      const response = await api.post('/guest-services', data);
      return response.data.data.serviceRequest;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  /**
   * Get guest service requests with filtering and pagination
   */
  async getServiceRequests(params?: {
    page?: number;
    limit?: number;
    status?: string;
    serviceType?: string;
    priority?: string;
    assignedTo?: string;
    hotelId?: string;
  }): Promise<GuestServiceRequestsResponse> {
    try {
      const response = await api.get('/guest-services', { params });
      return response.data.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  /**
   * Get service request statistics
   */
  async getServiceStats(params?: {
    startDate?: string;
    endDate?: string;
    hotelId?: string;
  }): Promise<ServiceStatsResponse> {
    try {
      const response = await api.get('/guest-services/stats', { params });
      return response.data.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  /**
   * Get available staff members for assignment
   */
  async getAvailableStaff(hotelId?: string): Promise<StaffMember[]> {
    try {
      const params = hotelId ? { hotelId } : {};
      const response = await api.get('/guest-services/available-staff', { params });
      return response.data.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  /**
   * Get specific service request by ID
   */
  async getServiceRequest(requestId: string): Promise<GuestServiceRequest> {
    try {
      const response = await api.get(`/guest-services/${requestId}`);
      return response.data.data.serviceRequest;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  /**
   * Update a service request
   */
  async updateServiceRequest(requestId: string, data: UpdateGuestServiceRequest): Promise<GuestServiceRequest> {
    try {
      const response = await api.patch(`/guest-services/${requestId}`, data);
      return response.data.data.serviceRequest;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  /**
   * Add feedback to a completed service
   */
  async addFeedback(requestId: string, rating: number, feedback?: string): Promise<GuestServiceRequest> {
    try {
      const response = await api.post(`/guest-services/${requestId}/feedback`, { rating, feedback });
      return response.data.data.serviceRequest;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  /**
   * Cancel a service request (guest only)
   */
  async cancelServiceRequest(requestId: string): Promise<GuestServiceRequest> {
    return this.updateServiceRequest(requestId, { status: 'cancelled' });
  }

  /**
   * Assign a service request to staff
   */
  async assignServiceRequest(requestId: string, staffId: string): Promise<GuestServiceRequest> {
    return this.updateServiceRequest(requestId, {
      assignedTo: staffId,
      status: 'assigned'
    });
  }

  /**
   * Start work on a service request
   */
  async startServiceRequest(requestId: string, notes?: string): Promise<GuestServiceRequest> {
    return this.updateServiceRequest(requestId, {
      status: 'in_progress',
      notes
    });
  }

  /**
   * Complete a service request
   */
  async completeServiceRequest(requestId: string, actualCost?: number, notes?: string): Promise<GuestServiceRequest> {
    return this.updateServiceRequest(requestId, {
      status: 'completed',
      actualCost,
      notes
    });
  }

  /**
   * Get service type display information
   */
  getServiceTypeInfo(type: string): {
    label: string;
    icon: string;
    color: string;
    description: string;
  } {
    switch (type) {
      case 'room_service':
        return {
          label: 'Room Service',
          icon: '🍽️',
          color: 'text-orange-600 bg-orange-100',
          description: 'Food and beverage delivery to room'
        };
      case 'housekeeping':
        return {
          label: 'Housekeeping',
          icon: '🧹',
          color: 'text-blue-600 bg-blue-100',
          description: 'Room cleaning and maintenance'
        };
      case 'maintenance':
        return {
          label: 'Maintenance',
          icon: '🔧',
          color: 'text-red-600 bg-red-100',
          description: 'Room and facility repairs'
        };
      case 'concierge':
        return {
          label: 'Concierge',
          icon: '🛎️',
          color: 'text-purple-600 bg-purple-100',
          description: 'Guest assistance and information'
        };
      case 'transport':
        return {
          label: 'Transportation',
          icon: '🚗',
          color: 'text-green-600 bg-green-100',
          description: 'Airport transfers and local transport'
        };
      case 'spa':
        return {
          label: 'Spa & Wellness',
          icon: '💆',
          color: 'text-pink-600 bg-pink-100',
          description: 'Spa treatments and wellness services'
        };
      case 'laundry':
        return {
          label: 'Laundry',
          icon: '👕',
          color: 'text-indigo-600 bg-indigo-100',
          description: 'Laundry and dry cleaning services'
        };
      default:
        return {
          label: 'Other',
          icon: '📋',
          color: 'text-gray-600 bg-gray-100',
          description: 'Other guest services'
        };
    }
  }

  /**
   * Get priority display information
   */
  getPriorityInfo(priority: string): {
    label: string;
    color: string;
    urgency: number;
  } {
    switch (priority) {
      case 'urgent':
        return {
          label: 'Urgent',
          color: 'text-red-800 bg-red-100 border-red-200',
          urgency: 5
        };
      case 'high':
        return {
          label: 'High',
          color: 'text-orange-800 bg-orange-100 border-orange-200',
          urgency: 4
        };
      case 'medium':
        return {
          label: 'Medium',
          color: 'text-yellow-800 bg-yellow-100 border-yellow-200',
          urgency: 3
        };
      case 'low':
        return {
          label: 'Low',
          color: 'text-green-800 bg-green-100 border-green-200',
          urgency: 2
        };
      case 'now':
        return {
          label: 'Now',
          color: 'text-red-800 bg-red-100 border-red-200',
          urgency: 5
        };
      case 'later':
        return {
          label: 'Later',
          color: 'text-blue-800 bg-blue-100 border-blue-200',
          urgency: 1
        };
      default:
        return {
          label: 'Normal',
          color: 'text-gray-800 bg-gray-100 border-gray-200',
          urgency: 3
        };
    }
  }

  /**
   * Get status display information
   */
  getStatusInfo(status: string): {
    label: string;
    color: string;
    icon: string;
    description: string;
  } {
    switch (status) {
      case 'pending':
        return {
          label: 'Pending',
          color: 'text-yellow-800 bg-yellow-100',
          icon: '🕒',
          description: 'Awaiting assignment'
        };
      case 'assigned':
        return {
          label: 'Assigned',
          color: 'text-blue-800 bg-blue-100',
          icon: '👤',
          description: 'Assigned to staff member'
        };
      case 'in_progress':
        return {
          label: 'In Progress',
          color: 'text-orange-800 bg-orange-100',
          icon: '⚡',
          description: 'Work in progress'
        };
      case 'completed':
        return {
          label: 'Completed',
          color: 'text-green-800 bg-green-100',
          icon: '✅',
          description: 'Service completed'
        };
      case 'cancelled':
        return {
          label: 'Cancelled',
          color: 'text-red-800 bg-red-100',
          icon: '❌',
          description: 'Request cancelled'
        };
      default:
        return {
          label: 'Unknown',
          color: 'text-gray-800 bg-gray-100',
          icon: '❓',
          description: 'Unknown status'
        };
    }
  }

  /**
   * Check if request is overdue
   */
  isOverdue(request: GuestServiceRequest): boolean {
    if (request.status === 'completed' || request.status === 'cancelled') {
      return false;
    }
    if (!request.scheduledTime) {
      return false;
    }
    return new Date(request.scheduledTime) < new Date();
  }

  /**
   * Format date for display
   */
  formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString();
  }

  /**
   * Format date and time for display
   */
  formatDateTime(dateString: string): string {
    return new Date(dateString).toLocaleString();
  }

  /**
   * Get room numbers from booking
   */
  getRoomNumbers(request: GuestServiceRequest): string[] {
    if (!request.bookingId || !request.bookingId.rooms) {
      return [];
    }
    return request.bookingId.rooms.map(room => room.roomId?.roomNumber || 'Unknown');
  }

  /**
   * Calculate estimated completion time based on service type
   */
  getEstimatedDuration(serviceType: string): number {
    switch (serviceType) {
      case 'room_service':
        return 30; // 30 minutes
      case 'housekeeping':
        return 45; // 45 minutes
      case 'maintenance':
        return 120; // 2 hours
      case 'concierge':
        return 15; // 15 minutes
      case 'transport':
        return 90; // 1.5 hours
      case 'spa':
        return 90; // 1.5 hours
      case 'laundry':
        return 240; // 4 hours
      default:
        return 60; // 1 hour
    }
  }
}

export const guestServiceRequestService = new GuestServiceRequestService();