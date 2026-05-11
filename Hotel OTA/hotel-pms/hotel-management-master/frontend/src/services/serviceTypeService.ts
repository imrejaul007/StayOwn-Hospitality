import { api } from './api';

export interface ServiceVariation {
  name: string;
  additionalPrice: number;
  description?: string;
  estimatedDuration?: number;
  isActive?: boolean;
}

export interface ServiceTemplate {
  name: string;
  description?: string;
  services: string[];
  totalPrice: number;
  estimatedDuration?: number;
  priority?: number;
  isActive?: boolean;
}

export interface ServiceType {
  _id?: string;
  hotelId: string;
  type: 'room_service' | 'housekeeping' | 'maintenance' | 'concierge' | 'transport' | 'spa' | 'laundry' | 'other';
  name: string;
  description?: string;
  basePrice: number;
  currency?: string;
  estimatedDuration: number;
  slaTime: number;
  isActive?: boolean;
  variations: ServiceVariation[];
  templates: ServiceTemplate[];
  pricingRules?: {
    dynamicPricing?: boolean;
    timeBasedPricing?: Array<{
      startTime: string;
      endTime: string;
      priceMultiplier: number;
    }>;
    seasonalPricing?: Array<{
      startDate: Date;
      endDate: Date;
      priceMultiplier: number;
      name: string;
    }>;
  };
  slaSettings?: {
    responseTime: number;
    completionTime: number;
    escalationTime: number;
    autoEscalation: boolean;
  };
  settings?: {
    requireApproval: boolean;
    allowGuestNotes: boolean;
    allowScheduling: boolean;
    maxAdvanceBooking: number;
    notificationSettings: {
      emailAlerts: boolean;
      smsAlerts: boolean;
      pushNotifications: boolean;
    };
  };
  stats?: {
    totalRequests: number;
    completedRequests: number;
    averageRating: number;
    averageCompletionTime: number;
    averageResponseTime: number;
  };
  createdAt?: string;
  updatedAt?: string;
}

export interface ServiceTypeStats {
  totalServiceTypes: number;
  totalRequests: number;
  totalCompletedRequests: number;
  averageRating: number;
  averageResponseTime: number;
  averageCompletionTime: number;
  serviceTypeBreakdown: Array<{
    type: string;
    name: string;
    totalRequests: number;
    completedRequests: number;
    completionRate: number;
    averageRating: number;
    basePrice: number;
  }>;
}

export interface PriceCalculation {
  basePrice: number;
  variations: Array<{
    name: string;
    additionalPrice: number;
  }>;
  multiplier: number;
  totalPrice: number;
  currency: string;
}

export interface ServiceTypeFilters {
  hotelId?: string;
  type?: string;
  activeOnly?: boolean;
}

class ServiceTypeService {
  private baseUrl = '/admin/service-types';

  // Get all service types for a hotel
  async getServiceTypes(filters?: ServiceTypeFilters): Promise<{
    serviceTypes: ServiceType[];
    total: number;
    hotelId: string;
  }> {
    try {
      const params = new URLSearchParams();

      if (filters?.hotelId) {
        const hid = typeof filters.hotelId === 'object' && filters.hotelId !== null
          ? String((filters.hotelId as { _id?: string })._id || filters.hotelId)
          : String(filters.hotelId);
        params.append('hotelId', hid);
      }
      if (filters?.type) params.append('type', filters.type);
      if (filters?.activeOnly !== undefined) params.append('activeOnly', filters.activeOnly.toString());

      const response = await api.get(`${this.baseUrl}?${params.toString()}`);
      return response.data.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  // Get specific service type by ID
  async getServiceTypeById(id: string): Promise<ServiceType> {
    try {
      const response = await api.get(`${this.baseUrl}/${id}`);
      return response.data.data.serviceType;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  // Create new service type
  async createServiceType(serviceTypeData: Omit<ServiceType, '_id' | 'createdAt' | 'updatedAt'>): Promise<ServiceType> {
    try {
      const response = await api.post(this.baseUrl, serviceTypeData);
      return response.data.data.serviceType;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  // Update service type
  async updateServiceType(id: string, updates: Partial<ServiceType>): Promise<ServiceType> {
    try {
      const response = await api.put(`${this.baseUrl}/${id}`, updates);
      return response.data.data.serviceType;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  // Delete service type (soft delete)
  async deleteServiceType(id: string): Promise<void> {
    try {
      await api.delete(`${this.baseUrl}/${id}`);
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  // Add variation to service type
  async addVariation(id: string, variation: Omit<ServiceVariation, 'isActive'>): Promise<ServiceType> {
    try {
      const response = await api.post(`${this.baseUrl}/${id}/variations`, variation);
      return response.data.data.serviceType;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  // Add template to service type
  async addTemplate(id: string, template: Omit<ServiceTemplate, 'isActive'>): Promise<ServiceType> {
    try {
      const response = await api.post(`${this.baseUrl}/${id}/templates`, template);
      return response.data.data.serviceType;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  // Calculate price with variations
  async calculatePrice(
    type: string,
    options: {
      hotelId?: string;
      variations?: string[];
      multiplier?: number;
    }
  ): Promise<PriceCalculation> {
    try {
      const response = await api.post(`${this.baseUrl}/${type}/calculate-price`, {
        hotelId: options.hotelId,
        variations: options.variations || [],
        multiplier: options.multiplier || 1
      });
      return response.data.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  // Get service type statistics
  async getServiceTypeStats(hotelId?: string | unknown): Promise<ServiceTypeStats> {
    try {
      let hid: string | undefined;
      if (hotelId) {
        if (typeof hotelId === 'string') {
          hid = hotelId;
        } else if (typeof hotelId === 'object' && hotelId !== null && '_id' in hotelId) {
          hid = String((hotelId as { _id: string })._id);
        } else {
          hid = String(hotelId);
        }
      }
      const params = hid ? `?hotelId=${hid}` : '';
      const response = await api.get(`${this.baseUrl}/stats${params}`);
      return response.data.data.stats;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  // Utility methods for common operations

  // Get service types by category
  async getServiceTypesByCategory(category: ServiceType['type'], hotelId?: string): Promise<ServiceType[]> {
    const data = await this.getServiceTypes({
      type: category,
      hotelId,
      activeOnly: true
    });
    return data.serviceTypes;
  }

  // Get default service types for hotel setup
  getDefaultServiceTypes(): Omit<ServiceType, '_id' | 'hotelId' | 'createdAt' | 'updatedAt'>[] {
    return [
      {
        type: 'room_service',
        name: 'Room Service',
        description: 'Food and beverage delivery to guest rooms',
        basePrice: 200,
        currency: 'INR',
        estimatedDuration: 45,
        slaTime: 60,
        isActive: true,
        variations: [
          { name: 'Express Service', additionalPrice: 100, description: 'Priority delivery within 30 minutes' },
          { name: 'Late Night Service', additionalPrice: 150, description: 'Service between 11 PM and 6 AM' }
        ],
        templates: [
          {
            name: 'Breakfast Package',
            description: 'Continental breakfast with coffee, juice, and pastries',
            services: ['Continental Breakfast', 'Coffee/Tea Service', 'Fresh Juice'],
            totalPrice: 800,
            estimatedDuration: 30
          }
        ]
      },
      {
        type: 'housekeeping',
        name: 'Housekeeping',
        description: 'Room cleaning and maintenance services',
        basePrice: 150,
        currency: 'INR',
        estimatedDuration: 30,
        slaTime: 120,
        isActive: true,
        variations: [
          { name: 'Deep Cleaning', additionalPrice: 200, description: 'Thorough cleaning including all surfaces' },
          { name: 'Express Cleaning', additionalPrice: 100, description: 'Quick 15-minute tidy up' }
        ],
        templates: [
          {
            name: 'Turnover Service',
            description: 'Complete room turnover for new guest arrival',
            services: ['Room Cleaning', 'Linen Change', 'Amenity Restock', 'Inspection'],
            totalPrice: 400,
            estimatedDuration: 45
          }
        ]
      },
      {
        type: 'maintenance',
        name: 'Maintenance',
        description: 'Technical and repair services',
        basePrice: 300,
        currency: 'INR',
        estimatedDuration: 60,
        slaTime: 240,
        isActive: true,
        variations: [
          { name: 'Emergency Repair', additionalPrice: 500, description: 'Immediate response for urgent issues' },
          { name: 'Preventive Maintenance', additionalPrice: 0, description: 'Scheduled maintenance checks' }
        ],
        templates: []
      },
      {
        type: 'concierge',
        name: 'Concierge',
        description: 'Guest assistance and information services',
        basePrice: 100,
        currency: 'INR',
        estimatedDuration: 15,
        slaTime: 30,
        isActive: true,
        variations: [
          { name: 'Premium Assistance', additionalPrice: 200, description: 'Dedicated concierge support' },
          { name: 'Tour Booking', additionalPrice: 150, description: 'Local tour and activity arrangements' }
        ],
        templates: [
          {
            name: 'Welcome Package',
            description: 'Complete guest welcome with local information and assistance',
            services: ['Welcome Greeting', 'Local Information', 'Restaurant Recommendations'],
            totalPrice: 250,
            estimatedDuration: 20
          }
        ]
      },
      {
        type: 'transport',
        name: 'Transport',
        description: 'Transportation and transfer services',
        basePrice: 500,
        currency: 'INR',
        estimatedDuration: 90,
        slaTime: 60,
        isActive: true,
        variations: [
          { name: 'Airport Transfer', additionalPrice: 300, description: 'Dedicated airport pickup/drop-off' },
          { name: 'Premium Vehicle', additionalPrice: 800, description: 'Luxury vehicle upgrade' }
        ],
        templates: []
      },
      {
        type: 'laundry',
        name: 'Laundry',
        description: 'Laundry and dry cleaning services',
        basePrice: 100,
        currency: 'INR',
        estimatedDuration: 1440, // 24 hours
        slaTime: 1440,
        isActive: true,
        variations: [
          { name: 'Express Service', additionalPrice: 200, description: 'Same-day return service' },
          { name: 'Dry Cleaning', additionalPrice: 150, description: 'Professional dry cleaning' }
        ],
        templates: []
      }
    ];
  }

  // Bulk create default service types for a hotel
  async createDefaultServiceTypes(hotelId: string): Promise<ServiceType[]> {
    const defaultTypes = this.getDefaultServiceTypes();
    const createdTypes: ServiceType[] = [];

    for (const serviceType of defaultTypes) {
      try {
        const created = await this.createServiceType({
          ...serviceType,
          hotelId
        });
        createdTypes.push(created);
      } catch (error) {
        // Continue with other types if one fails
      }
    }

    return createdTypes;
  }
}

export const serviceTypeService = new ServiceTypeService();