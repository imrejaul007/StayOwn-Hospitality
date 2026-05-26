import logger from './utils/logger';

import { ApiResponse } from '../types/api';
import { api, normalizeEntityId } from './api';

export interface GuestService {
  _id: string;
  serviceType: 'room_service' | 'housekeeping' | 'maintenance' | 'concierge' | 'transport' | 'spa' | 'laundry' | 'other';
  serviceVariation?: string;
  serviceVariations?: string[];
  title: string;
  description: string;
  priority: 'now' | 'later' | 'low' | 'medium' | 'high' | 'urgent';
  status: 'pending' | 'assigned' | 'in_progress' | 'completed' | 'cancelled';
  userId?: { _id: string; name: string; email: string; phone?: string };
  bookingId?: {
    _id: string;
    bookingNumber: string;
    rooms?: Array<{ roomId?: { roomNumber: string } }>;
  };
  assignedTo?: { _id: string; name: string; email: string };
  estimatedCost?: number;
  actualCost?: number;
  scheduledTime?: string;
  completedTime?: string;
  notes?: string;
  guestNotes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface GuestServiceStats {
  total: number;
  pending: number;
  assigned: number;
  inProgress: number;
  completed: number;
  cancelled: number;
  avgResponseTime: number;
  avgCompletionTime: number;
  satisfactionScore: number;
}

export interface AssignServiceData {
  assignedTo: string;
  notes?: string;
  scheduledTime?: string;
}

export interface GuestServiceFilters {
  status?: string;
  serviceType?: string;
  serviceTypes?: string;
  serviceVariation?: string;
  excludeServiceVariation?: string;
  priority?: string;
  assignedTo?: string;
  userId?: string;
  bookingId?: string;
  hotelId?: string;
  page?: number;
  limit?: number;
}

class AdminGuestServicesService {
  private basePath = '/guest-services';
  private hotelIdCache: string | null = null;
  private hotelIdCacheExpiry: number = 0;

  private async apiRequest<T>(endpoint: string, options: { method?: string; data?: Record<string, unknown>; basePath?: string } = {}): Promise<ApiResponse<T>> {
    // Properly handle basePath - empty string should override the default
    const basePath = options.basePath !== undefined ? options.basePath : this.basePath;
    const url = `${basePath}${endpoint}`;

    let response;
    const method = (options.method || 'GET').toUpperCase();

    switch (method) {
      case 'POST':
        response = await api.post(url, options.data);
        break;
      case 'PUT':
        response = await api.put(url, options.data);
        break;
      case 'PATCH':
        response = await api.patch(url, options.data);
        break;
      case 'DELETE':
        response = await api.delete(url);
        break;
      default:
        response = await api.get(url);
        break;
    }

    return response.data;
  }

  private async getUserHotelId(): Promise<string> {
    // Check cache first (cache for 10 minutes)
    const now = Date.now();
    if (this.hotelIdCache && now < this.hotelIdCacheExpiry) {
      return this.hotelIdCache;
    }

    // Prefer selected property context when available (multi-property admin flow)
    const selectedPropertyId = typeof window !== 'undefined' ? localStorage.getItem('selectedPropertyId') : null;
    if (selectedPropertyId) {
      this.hotelIdCache = selectedPropertyId;
      this.hotelIdCacheExpiry = now + 10 * 60 * 1000;
      return selectedPropertyId;
    }

    // Get hotelId from user profile API using the configured api instance
    try {
      const response = await api.get('/auth/me');
      const userData = (response.data as { user?: unknown })?.user;

      if (userData?.hotelId) {
        // hotelId may be a populated object or a string — extract the ID string
        const rawId = userData.hotelId;
        const hotelIdStr = typeof rawId === 'string' ? rawId
          : (rawId && typeof rawId === 'object' && rawId._id) ? String(rawId._id)
          : String(rawId);
        this.hotelIdCache = hotelIdStr;
        this.hotelIdCacheExpiry = now + 10 * 60 * 1000;
        return hotelIdStr;
      }
    } catch {
      // Error handled silently
    }

    // Fallback: Use a placeholder error or throw - the API should provide hotelId
    logger.warn('No hotelId found from auth endpoint, falling back to user context');
    throw new Error('Unable to determine hotel ID. Please ensure you are logged in.');
  }

  async getServices(filters: GuestServiceFilters = {}): Promise<ApiResponse<{ serviceRequests: GuestService[]; pagination: { page: number; limit: number; total: number; pages: number } }>> {
    const queryParams = new URLSearchParams();

    // Use provided hotelId (from selected property) or fall back to user's primary
    const hotelId = filters.hotelId || await this.getUserHotelId();
    queryParams.append('hotelId', hotelId);

    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && key !== 'hotelId' && key !== 'propertyId') {
        queryParams.append(key, value.toString());
      }
    });

    const queryString = queryParams.toString();
    const endpoint = `?${queryString}`;

    return this.apiRequest(endpoint);
  }

  async getServiceById(serviceId: string): Promise<ApiResponse<GuestService>> {
    return this.apiRequest(`/${normalizeEntityId(serviceId)}`);
  }

  async updateService(serviceId: string, updates: Partial<GuestService>): Promise<ApiResponse<GuestService>> {
    const hotelId = await this.getUserHotelId();
    return this.apiRequest(`/${normalizeEntityId(serviceId)}`, {
      method: 'PATCH',
      data: { ...updates, hotelId },
    });
  }

  async assignService(serviceId: string, assignData: AssignServiceData): Promise<ApiResponse<GuestService>> {
    const hotelId = await this.getUserHotelId();
    return this.apiRequest(`/${normalizeEntityId(serviceId)}`, {
      method: 'PATCH',
      data: {
        hotelId,
        assignedTo: assignData.assignedTo,
        notes: assignData.notes,
        scheduledTime: assignData.scheduledTime,
        status: 'assigned' // Set status to assigned when assigning
      },
    });
  }

  async updateStatus(serviceId: string, status: string, notes?: string): Promise<ApiResponse<GuestService>> {
    return this.apiRequest(`/${normalizeEntityId(serviceId)}`, {
      method: 'PATCH',
      data: { status, notes },
    });
  }

  async getStats(hotelId?: string): Promise<ApiResponse<GuestServiceStats>> {
    const rawId = hotelId || await this.getUserHotelId();
    const targetHotelId = typeof rawId === 'object' && rawId !== null ? String((rawId as { _id?: string })._id || rawId) : String(rawId);

    const queryParams = new URLSearchParams();
    queryParams.append('hotelId', targetHotelId);
    const endpoint = `/stats?${queryParams.toString()}`;
    return this.apiRequest(endpoint);
  }

  // Get pending services that need attention
  async getPendingServices(): Promise<ApiResponse<GuestService[]>> {
    return this.apiRequest('?status=pending&sortBy=priority,createdAt');
  }

  // Get overdue services (assigned/in_progress past scheduled time)
  async getOverdueServices(): Promise<ApiResponse<GuestService[]>> {
    return this.apiRequest('/overdue');
  }

  // Get services by department for workload distribution
  async getServicesByDepartment(): Promise<ApiResponse<Record<string, number>>> {
    return this.apiRequest('/stats/by-department');
  }

  // Get available staff members for assignment
  async getAvailableStaff(hotelId?: string): Promise<ApiResponse<Array<{ _id: string; name: string; email: string; department: string }>>> {
    const rawId = hotelId || await this.getUserHotelId();
    const targetHotelId = typeof rawId === 'object' && rawId !== null ? String((rawId as { _id?: string })._id || rawId) : String(rawId);

    const queryParams = new URLSearchParams();
    queryParams.append('hotelId', targetHotelId);
    const endpoint = `/available-staff?${queryParams.toString()}`;
    return this.apiRequest(endpoint);
  }

  // Get guest satisfaction ratings for completed services
  async getSatisfactionRatings(filters?: { from?: string; to?: string }): Promise<ApiResponse<{
    average: number;
    total: number;
    breakdown: Record<number, number>
  }>> {
    const queryParams = new URLSearchParams();
    if (filters?.from) queryParams.append('from', filters.from);
    if (filters?.to) queryParams.append('to', filters.to);

    const queryString = queryParams.toString();
    const endpoint = queryString ? `/satisfaction?${queryString}` : '/satisfaction';

    return this.apiRequest(endpoint);
  }

  // Add internal notes to a service
  async addInternalNotes(serviceId: string, notes: string): Promise<ApiResponse<GuestService>> {
    return this.apiRequest(`/${normalizeEntityId(serviceId)}/notes`, {
      method: 'POST',
      data: { notes },
    });
  }

  // Update service cost (when completed)
  async updateCost(serviceId: string, actualCost: number): Promise<ApiResponse<GuestService>> {
    return this.apiRequest(`/${normalizeEntityId(serviceId)}/cost`, {
      method: 'PATCH',
      data: { actualCost },
    });
  }

  // Bulk operations
  async bulkAssign(serviceIds: string[], assignedTo: string): Promise<ApiResponse<{ updated: number }>> {
    const hotelId = await this.getUserHotelId();
    return this.apiRequest('/bulk/assign', {
      method: 'PATCH',
      data: { serviceIds, assignedTo, hotelId },
    });
  }

  async bulkUpdateStatus(serviceIds: string[], status: string): Promise<ApiResponse<{ updated: number }>> {
    const hotelId = await this.getUserHotelId();
    return this.apiRequest('/bulk/status', {
      method: 'PATCH',
      data: { serviceIds, status, hotelId },
    });
  }

  // Export services data for reporting
  async exportServices(filters?: GuestServiceFilters, format: 'csv' | 'json' = 'csv', hotelId?: string): Promise<Blob> {
    try {
      const queryParams = new URLSearchParams();

      // Ensure hotelId is included for tenant isolation
      const resolvedHotelId = hotelId || await this.getUserHotelId();
      queryParams.append('hotelId', resolvedHotelId);

      if (filters) {
        Object.entries(filters).forEach(([key, value]) => {
          if (value !== undefined && value !== null && key !== 'hotelId' && key !== 'propertyId') {
            queryParams.append(key, value.toString());
          }
        });
      }

      queryParams.append('format', format);

      const response = await api.get(`${this.basePath}/export?${queryParams.toString()}`, {
        responseType: 'blob',
      });

      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }
}

export const adminGuestServicesService = new AdminGuestServicesService();