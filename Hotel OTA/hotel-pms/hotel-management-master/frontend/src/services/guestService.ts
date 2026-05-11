import { api, normalizeEntityId, normalizeListParams } from './api';

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
    rooms?: Array<{
      roomId?: {
        _id: string;
        roomNumber: string;
      };
    }>;
  };
  serviceType: 'room_service' | 'housekeeping' | 'maintenance' | 'concierge' | 'transport' | 'spa' | 'laundry' | 'other';
  serviceVariation: string;
  serviceVariations?: string[];
  completedServiceVariations?: string[];
  title?: string;
  description?: string;
  priority: 'now' | 'later' | 'low' | 'medium' | 'high' | 'urgent';
  status: 'pending' | 'assigned' | 'in_progress' | 'completed' | 'cancelled';
  assignedTo?: {
    _id: string;
    name: string;
  };
  scheduledTime?: string;
  completedTime?: string;
  estimatedCost?: number;
  actualCost?: number;
  notes?: string;
  specialInstructions?: string;
  rating?: number;
  feedback?: string;
  cancellationReason?: string;
  attachments?: string[];
  items?: Array<{
    name: string;
    quantity: number;
    price: number;
  }>;
  createdAt: string;
  updatedAt: string;
}

interface CreateServiceRequestData {
  bookingId: string;
  serviceType: string;
  serviceVariation?: string;
  serviceVariations: string[];
  title?: string;
  description?: string;
  priority?: string;
  scheduledTime?: string;
  items?: Array<{
    name: string;
    quantity: number;
    price: number;
  }>;
  specialInstructions?: string;
}

interface ServiceRequestFilters {
  status?: string;
  serviceType?: string;
  priority?: string;
  assignedTo?: string;
  hotelId?: string;
  page?: number;
  limit?: number;
  fromDate?: string;
  toDate?: string;
  completedFrom?: string;
  completedTo?: string;
  bookingId?: string;
  userId?: string;
}

interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

interface ApiResponse<T> {
  status: string;
  data: T & { pagination?: PaginationMeta };
  pagination?: PaginationMeta;
}

class GuestServiceService {
  async createServiceRequest(data: CreateServiceRequestData): Promise<ApiResponse<{ serviceRequest: GuestServiceRequest }>> {
    try {
      const response = await api.post('/guest-services', data);
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  async getServiceRequests(filters: ServiceRequestFilters = {}): Promise<ApiResponse<{ serviceRequests: GuestServiceRequest[] }>> {
    try {
      const normalizedFilters = normalizeListParams(filters);
      const params = new URLSearchParams();
    
      Object.entries(normalizedFilters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          params.append(key, value.toString());
        }
      });

      const response = await api.get(`/guest-services?${params.toString()}`);
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  async getServiceRequestById(id: string): Promise<ApiResponse<{ serviceRequest: GuestServiceRequest }>> {
    try {
      const response = await api.get(`/guest-services/${normalizeEntityId(id)}`);
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  async updateServiceRequest(
    id: string,
    updates: {
      status?: GuestServiceRequest['status'];
      assignedTo?: { _id: string; name: string } | string | null;
      notes?: string;
      actualCost?: number;
      scheduledTime?: string;
      priority?: GuestServiceRequest['priority'];
      completedServiceVariations?: string[];
      cancellationReason?: string;
      rating?: number;
      feedback?: string;
    }
  ): Promise<ApiResponse<{ serviceRequest: GuestServiceRequest }>> {
    try {
      // Normalize assignedTo to string ID for the API
      const payload: Record<string, unknown> = { ...updates };
      if (updates.assignedTo && typeof updates.assignedTo === 'object' && '_id' in updates.assignedTo) {
        payload.assignedTo = updates.assignedTo._id;
      }
      const response = await api.patch(`/guest-services/${normalizeEntityId(id)}`, payload);
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  async cancelServiceRequest(id: string, reason?: string): Promise<ApiResponse<{ serviceRequest: GuestServiceRequest }>> {
    try {
      const response = await api.patch(`/guest-services/${normalizeEntityId(id)}`, { status: 'cancelled', cancellationReason: reason });
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  /**
   * Submit rating + feedback for a completed service request.
   * Uses the dedicated POST /guest-services/:id/feedback endpoint which enforces
   * that the request is completed and belongs to the current guest.
   */
  async submitFeedback(id: string, rating: number, feedback?: string): Promise<ApiResponse<{ serviceRequest: GuestServiceRequest }>> {
    try {
      const response = await api.post(`/guest-services/${normalizeEntityId(id)}/feedback`, { rating, feedback });
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }
}

export const guestServiceService = new GuestServiceService();
