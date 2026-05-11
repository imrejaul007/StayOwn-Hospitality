import { DEFAULT_PUBLIC_HOTEL_ID } from '../constants/publicHotel';
import { api, normalizeListParams, unwrapApiData } from './api';

function tenantHotelIdForServices(hotelId?: string | null): string {
  const h = typeof hotelId === 'string' ? hotelId.trim() : '';
  return h || DEFAULT_PUBLIC_HOTEL_ID;
}

export interface HotelService {
  _id: string;
  name: string;
  description: string;
  type: 'dining' | 'spa' | 'gym' | 'transport' | 'entertainment' | 'business' | 'wellness' | 'recreation';
  price: number;
  currency: string;
  duration?: number;
  capacity?: number;
  isActive: boolean;
  available: boolean;
  images: string[];
  amenities: string[];
  operatingHours?: {
    open: string;
    close: string;
  };
  location?: string;
  contactInfo?: {
    phone?: string;
    email?: string;
  };
  specialInstructions?: string;
  tags: string[];
  featured: boolean;
  rating: {
    average: number;
    count: number;
  };
  hotelId?: {
    _id: string;
    name: string;
    address?: string;
  };
  formattedPrice?: string;
  durationDisplay?: string;
  operatingHoursDisplay?: string;
}

export interface ServiceType {
  value: string;
  label: string;
  icon: string;
}

export interface ServiceBooking {
  _id: string;
  userId: string;
  serviceId: HotelService;
  hotelId: {
    _id: string;
    name: string;
    address?: string;
  };
  bookingDate: string;
  numberOfPeople: number;
  totalAmount: number;
  currency: string;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled';
  specialRequests?: string;
  paymentStatus: 'pending' | 'paid' | 'refunded';
  paymentMethod?: string;
  cancellationReason?: string;
  cancelledAt?: string;
  cancelledBy?: string;
  notes?: string;
  rating?: {
    score: number;
    review: string;
    reviewedAt: string;
  };
  reminderSent: boolean;
  reminderSentAt?: string;
  createdAt: string;
  updatedAt: string;
  formattedAmount?: string;
  bookingDateDisplay?: string;
  timeUntilBooking?: string;
  statusColor?: string;
}

export interface AvailabilityCheck {
  available: boolean;
  reason?: string;
  availableCapacity?: number;
}

export interface ServiceBookingRequest {
  bookingDate: string;
  numberOfPeople: number;
  specialRequests?: string;
}

export interface CancelBookingRequest {
  reason: string;
}

export interface ServiceBookingsResponse {
  bookings: ServiceBooking[];
  pagination: {
    currentPage: number;
    totalPages: number;
    totalItems: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export interface HotelServicesResponse {
  services: HotelService[];
  pagination: {
    page: number;
    limit: number;
    totalCount: number;
    totalPages: number;
  };
}

class HotelServicesService {
  /**
   * Get all hotel services with pagination
   */
  async getServices(params?: {
    type?: string;
    search?: string;
    featured?: boolean;
    page?: number;
    limit?: number;
    hotelId?: string | null;
  }): Promise<HotelService[]> {
    try {
      const paginatedParams = normalizeListParams(params);
      const response = await api.get('/hotel-services', {
        params: {
          ...paginatedParams,
          hotelId: tenantHotelIdForServices(params?.hotelId)
        }
      });
      return unwrapApiData<HotelService[]>(response.data);
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  async getServicesWithPagination(params?: {
    type?: string;
    search?: string;
    featured?: boolean;
    tags?: string[];
    minPrice?: number;
    maxPrice?: number;
    availabilityNow?: boolean;
    page?: number;
    limit?: number;
    hotelId?: string | null;
  }): Promise<HotelServicesResponse> {
    const paginatedParams = normalizeListParams(params);
    const response = await api.get('/hotel-services', {
      params: {
        ...paginatedParams,
        tags: params?.tags?.join(','),
        minPrice: params?.minPrice,
        maxPrice: params?.maxPrice,
        availabilityNow: params?.availabilityNow,
        hotelId: tenantHotelIdForServices(params?.hotelId)
      }
    });
    return {
      services: unwrapApiData<HotelService[]>(response.data) || [],
      pagination: response.data?.pagination || {
        page: paginatedParams.page,
        limit: paginatedParams.limit,
        totalCount: 0,
        totalPages: 1
      }
    };
  }

  /**
   * Get specific hotel service details
   */
  async getService(serviceId: string, hotelId?: string | null): Promise<HotelService> {
    try {
      const response = await api.get(`/hotel-services/${serviceId}`, {
        params: { hotelId: tenantHotelIdForServices(hotelId) }
      });
      return response.data.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  /**
   * Get service details (alias for getService for consistency)
   */
  async getServiceDetails(serviceId: string, hotelId?: string | null): Promise<HotelService> {
    return this.getService(serviceId, hotelId);
  }

  /**
   * Check service availability
   */
  async checkAvailability(
    serviceId: string,
    date: string,
    people: number,
    hotelId?: string | null
  ): Promise<AvailabilityCheck> {
    try {
      const response = await api.get(`/hotel-services/${serviceId}/availability`, {
        params: { date, people, hotelId: tenantHotelIdForServices(hotelId) }
      });
      return response.data.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  /**
   * Book a hotel service
   */
  async bookService(
    serviceId: string,
    bookingData: ServiceBookingRequest & { idempotencyKey?: string },
    hotelId?: string | null
  ): Promise<{ message: string; booking: ServiceBooking }> {
    try {
      const response = await api.post(`/hotel-services/${serviceId}/bookings`, bookingData, {
        params: { hotelId: tenantHotelIdForServices(hotelId) }
      });
      return response.data.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  /**
   * Get user's service bookings
   */
  async getUserBookings(params?: {
    page?: number;
    limit?: number;
    status?: string;
    hotelId?: string | null;
  }): Promise<ServiceBookingsResponse> {
    try {
      const normalizedParams = normalizeListParams(params);
      const response = await api.get('/hotel-services/bookings', {
        params: {
          ...normalizedParams,
          hotelId: tenantHotelIdForServices(params?.hotelId)
        }
      });
      return unwrapApiData<ServiceBookingsResponse>(response.data);
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  /**
   * Get specific service booking details
   */
  async getBooking(bookingId: string): Promise<ServiceBooking> {
    try {
      const response = await api.get(`/hotel-services/bookings/${bookingId}`);
      return response.data.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  /**
   * Cancel a service booking
   */
  async cancelBooking(
    bookingId: string,
    cancelData: CancelBookingRequest,
    hotelId?: string | null
  ): Promise<{ message: string; booking: ServiceBooking }> {
    try {
      const response = await api.post(`/hotel-services/bookings/${bookingId}/cancel`, cancelData, {
        params: { hotelId: tenantHotelIdForServices(hotelId) }
      });
      return response.data.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  /**
   * Get all service types
   */
  async getServiceTypes(): Promise<ServiceType[]> {
    try {
      const response = await api.get('/hotel-services/types');
      return response.data.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  /**
   * Get featured services
   */
  async getFeaturedServices(hotelId?: string | null): Promise<HotelService[]> {
    try {
      const response = await api.get('/hotel-services/featured', {
        params: { hotelId: tenantHotelIdForServices(hotelId) }
      });
      return response.data.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  async getFavorites(hotelId?: string | null): Promise<string[]> {
    const response = await api.get('/hotel-services/favorites', {
      params: { hotelId: tenantHotelIdForServices(hotelId) }
    });
    return response.data?.data || [];
  }

  async addFavorite(serviceId: string, hotelId?: string | null): Promise<void> {
    await api.post(`/hotel-services/favorites/${serviceId}`, {}, {
      params: { hotelId: tenantHotelIdForServices(hotelId) }
    });
  }

  async removeFavorite(serviceId: string, hotelId?: string | null): Promise<void> {
    await api.delete(`/hotel-services/favorites/${serviceId}`, {
      params: { hotelId: tenantHotelIdForServices(hotelId) }
    });
  }

  async getAdminFulfillmentQueue(params?: { page?: number; limit?: number; status?: string; hotelId?: string | null }): Promise<{ bookings: ServiceBooking[]; pagination: { page: number; limit: number; totalCount: number; totalPages: number } }> {
    const response = await api.get('/admin/hotel-services/bookings/queue', { params: normalizeListParams(params) });
    return unwrapApiData(response.data);
  }

  async assignBookingStaff(bookingId: string, staffId: string): Promise<ServiceBooking> {
    const response = await api.patch(`/admin/hotel-services/bookings/${bookingId}/assign-staff`, { staffId });
    return unwrapApiData(response.data);
  }

  async updateBookingStatus(bookingId: string, status: 'confirmed' | 'completed' | 'cancelled', reason?: string): Promise<ServiceBooking> {
    const response = await api.patch(`/admin/hotel-services/bookings/${bookingId}/status`, { status, reason });
    return unwrapApiData(response.data);
  }

  async getServiceAnalyticsSummary(params?: { from?: string; to?: string; hotelId?: string | null }): Promise<unknown> {
    const response = await api.get('/admin/hotel-services/analytics/summary', { params });
    return unwrapApiData(response.data);
  }

  /**
   * Get services by type
   */
  async getServicesByType(type: string): Promise<HotelService[]> {
    return this.getServices({ type });
  }

  /**
   * Search services
   */
  async searchServices(searchTerm: string): Promise<HotelService[]> {
    return this.getServices({ search: searchTerm });
  }

  /**
   * Get service type display info
   */
  getServiceTypeInfo(type: string): {
    label: string;
    color: string;
    icon: string;
    description: string;
  } {
    switch (type) {
      case 'dining':
        return {
          label: 'Dining & Restaurants',
          color: 'text-orange-600 bg-orange-100',
          icon: '🍽️',
          description: 'Restaurants, bars, and dining experiences'
        };
      case 'spa':
        return {
          label: 'Spa & Wellness',
          color: 'text-pink-600 bg-pink-100',
          icon: '💆',
          description: 'Spa treatments and wellness services'
        };
      case 'gym':
        return {
          label: 'Fitness & Gym',
          color: 'text-blue-600 bg-blue-100',
          icon: '💪',
          description: 'Fitness facilities and personal training'
        };
      case 'transport':
        return {
          label: 'Transportation',
          color: 'text-green-600 bg-green-100',
          icon: '🚗',
          description: 'Airport transfers and local transport'
        };
      case 'entertainment':
        return {
          label: 'Entertainment',
          color: 'text-purple-600 bg-purple-100',
          icon: '🎭',
          description: 'Shows, events, and entertainment'
        };
      case 'business':
        return {
          label: 'Business Services',
          color: 'text-gray-600 bg-gray-100',
          icon: '💼',
          description: 'Meeting rooms and business facilities'
        };
      case 'wellness':
        return {
          label: 'Wellness & Health',
          color: 'text-teal-600 bg-teal-100',
          icon: '🧘',
          description: 'Health and wellness programs'
        };
      case 'recreation':
        return {
          label: 'Recreation',
          color: 'text-indigo-600 bg-indigo-100',
          icon: '🏊',
          description: 'Swimming pools and recreational activities'
        };
      default:
        return {
          label: 'Service',
          color: 'text-gray-600 bg-gray-100',
          icon: '🔧',
          description: 'Hotel service'
        };
    }
  }

  /**
   * Get booking status display info
   */
  getBookingStatusInfo(status: string): {
    label: string;
    color: string;
    description: string;
  } {
    switch (status) {
      case 'pending':
        return {
          label: 'Pending',
          color: 'text-yellow-600 bg-yellow-100',
          description: 'Awaiting confirmation'
        };
      case 'confirmed':
        return {
          label: 'Confirmed',
          color: 'text-blue-600 bg-blue-100',
          description: 'Booking confirmed'
        };
      case 'completed':
        return {
          label: 'Completed',
          color: 'text-green-600 bg-green-100',
          description: 'Service completed'
        };
      case 'cancelled':
        return {
          label: 'Cancelled',
          color: 'text-red-600 bg-red-100',
          description: 'Booking cancelled'
        };
      default:
        return {
          label: 'Unknown',
          color: 'text-gray-600 bg-gray-100',
          description: 'Unknown status'
        };
    }
  }

  /**
   * Format price with currency using proper locale formatting
   */
  formatPrice(price: number, currency: string = 'INR'): string {
    try {
      return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency,
      }).format(price);
    } catch {
      return `${currency} ${price.toLocaleString('en-IN')}`;
    }
  }

  /**
   * Format duration in hours and minutes
   */
  formatDuration(minutes: number): string {
    if (!minutes) return '';
    
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    
    if (hours > 0 && mins > 0) {
      return `${hours}h ${mins}m`;
    } else if (hours > 0) {
      return `${hours}h`;
    } else {
      return `${mins}m`;
    }
  }

  /**
   * Format operating hours
   */
  formatOperatingHours(hours?: { open: string; close: string }): string {
    if (!hours?.open || !hours?.close) {
      return 'Contact for hours';
    }
    return `${hours.open} - ${hours.close}`;
  }

  /**
   * Calculate time until booking
   */
  getTimeUntilBooking(bookingDate: string): string {
    const now = new Date();
    const booking = new Date(bookingDate);
    const diff = booking.getTime() - now.getTime();
    
    if (diff <= 0) return 'Past';
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    
    if (days > 0) {
      return `${days} day${days > 1 ? 's' : ''} ${hours} hour${hours > 1 ? 's' : ''}`;
    } else {
      return `${hours} hour${hours > 1 ? 's' : ''}`;
    }
  }

  /**
   * Check if booking can be cancelled
   */
  canCancelBooking(booking: ServiceBooking): boolean {
    return booking.status === 'pending' || booking.status === 'confirmed';
  }

  /**
   * Check if booking is upcoming
   */
  isUpcomingBooking(booking: ServiceBooking): boolean {
    const now = new Date();
    const bookingDate = new Date(booking.bookingDate);
    return bookingDate > now && booking.status !== 'cancelled';
  }

  // Admin Methods for Service Management

  /**
   * Get all services for admin management (with pagination)
   */
  async getAdminServices(params?: {
    hotelId?: string;
    page?: number;
    limit?: number;
    type?: string;
    search?: string;
    status?: string;
  }): Promise<{
    services: HotelService[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      pages: number;
      hasNext: boolean;
      hasPrev: boolean;
    };
  }> {
    try {
      const normalizedParams = normalizeListParams(params);
      const response = await api.get('/admin/hotel-services', { params: normalizedParams });
      return unwrapApiData<{
        services: HotelService[];
        pagination: {
          page: number;
          limit: number;
          total: number;
          pages: number;
          hasNext: boolean;
          hasPrev: boolean;
        };
      }>(response.data);
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  /**
   * Create a new hotel service (Admin only)
   */
  async createService(serviceData: FormData): Promise<HotelService> {
    try {
      const response = await api.post('/admin/hotel-services', serviceData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      return response.data.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  /**
   * Update a hotel service (Admin only)
   */
  async updateService(serviceId: string, serviceData: FormData): Promise<HotelService> {
    try {
      const response = await api.put(`/admin/hotel-services/${serviceId}`, serviceData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      return response.data.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  /**
   * Delete a hotel service (Admin only)
   */
  async deleteService(serviceId: string): Promise<void> {
    try {
      await api.delete(`/admin/hotel-services/${serviceId}`);
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  /**
   * Toggle service active status (Admin only)
   */
  async toggleServiceStatus(serviceId: string): Promise<HotelService> {
    try {
      const response = await api.patch(`/admin/hotel-services/${serviceId}/toggle-status`);
      return response.data.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  /**
   * Delete a specific service image (Admin only)
   */
  async deleteServiceImage(serviceId: string, imageIndex: number): Promise<HotelService> {
    try {
      const response = await api.delete(`/admin/hotel-services/${serviceId}/images/${imageIndex}`);
      return response.data.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  /**
   * Perform bulk operations on services (Admin only)
   */
  async bulkOperations(operation: string, serviceIds: string[]): Promise<void> {
    try {
      await api.post('/admin/hotel-services/bulk-operations', {
        operation,
        serviceIds
      });
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  /**
   * Convert service data to FormData for API submission
   */
  convertToFormData(serviceData: Record<string, unknown>, images?: File[]): FormData {
    const formData = new FormData();

    // Add basic fields
    Object.keys(serviceData).forEach(key => {
      const value = serviceData[key];
      if (value !== undefined && value !== null) {
        if (Array.isArray(value)) {
          value.forEach((item, index) => {
            formData.append(`${key}[]`, item);
          });
        } else if (typeof value === 'object' && key === 'operatingHours') {
          formData.append('operatingHoursOpen', value.open || '');
          formData.append('operatingHoursClose', value.close || '');
        } else if (typeof value === 'object' && key === 'contactInfo') {
          if (value.phone) formData.append('contactPhone', value.phone);
          if (value.email) formData.append('contactEmail', value.email);
        } else {
          formData.append(key, value.toString());
        }
      }
    });

    // Add image files
    if (images && images.length > 0) {
      images.forEach(image => {
        formData.append('images', image);
      });
    }

    return formData;
  }
}

export const hotelServicesService = new HotelServicesService();
