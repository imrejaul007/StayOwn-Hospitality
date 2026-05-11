import { api } from './api';

export interface LocalAttraction {
  _id: string;
  name: string;
  description: string;
  category: 'amenities' | 'dining' | 'attractions' | 'shopping' | 'transport' | 'medical' | 'entertainment';
  distance: number;
  distanceText: string;
  address: string;
  coordinates: {
    lat: number;
    lng: number;
  };
  rating: number;
  imageUrl?: string;
  website?: string;
  phone?: string;
  openingHours: {
    monday: string;
    tuesday: string;
    wednesday: string;
    thursday: string;
    friday: string;
    saturday: string;
    sunday: string;
  };
  hotelId: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  // Virtual properties
  ratingStars?: string;
}

export interface AttractionsResponse {
  status: string;
  results: number;
  data: {
    attractions: LocalAttraction[];
  };
}

export interface CategorizedAttractionsResponse {
  status: string;
  data: {
    categories: {
      [key: string]: {
        attractions: LocalAttraction[];
        count: number;
        averageDistance: number;
      };
    };
    totalCategories: number;
  };
}

export interface AttractionParams {
  hotelId?: string;
  category?: LocalAttraction['category'];
  maxDistance?: number;
  limit?: number;
}

class AttractionsService {
  private baseUrl = '/attractions';

  async getAttractions(params?: AttractionParams): Promise<LocalAttraction[]> {
    const searchParams = new URLSearchParams();
    
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          searchParams.append(key, value.toString());
        }
      });
    }

    const response = await api.get<AttractionsResponse>(`${this.baseUrl}?${searchParams.toString()}`);
    return response.data.data.attractions;
  }

  async getCategorizedAttractions(hotelId: string, maxDistance?: number): Promise<CategorizedAttractionsResponse['data']> {
    const searchParams = new URLSearchParams();
    searchParams.append('hotelId', hotelId);
    
    if (maxDistance !== undefined) {
      searchParams.append('maxDistance', maxDistance.toString());
    }

    const response = await api.get<CategorizedAttractionsResponse>(`${this.baseUrl}/categories?${searchParams.toString()}`);
    return response.data.data;
  }

  async getAttractionById(id: string): Promise<LocalAttraction> {
    try {
      const response = await api.get(`${this.baseUrl}/${id}`);
      return response.data.data.attraction;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  async getAttractionsByCategory(hotelId: string, category: LocalAttraction['category'], maxDistance?: number): Promise<LocalAttraction[]> {
    return this.getAttractions({
      hotelId,
      category,
      maxDistance
    });
  }

  async getNearbyAttractions(hotelId: string, maxDistance: number = 10): Promise<LocalAttraction[]> {
    return this.getAttractions({
      hotelId,
      maxDistance
    });
  }

  // Admin methods for managing attractions
  async createAttraction(attraction: Omit<LocalAttraction, '_id' | 'createdAt' | 'updatedAt' | 'isActive' | 'distanceText' | 'ratingStars'>): Promise<LocalAttraction> {
    try {
      const response = await api.post(this.baseUrl, attraction);
      return response.data.data.attraction;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  async updateAttraction(id: string, updates: Partial<LocalAttraction>): Promise<LocalAttraction> {
    try {
      const response = await api.patch(`${this.baseUrl}/${id}`, updates);
      return response.data.data.attraction;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  async deleteAttraction(id: string): Promise<void> {
    try {
      await api.delete(`${this.baseUrl}/${id}`);
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  // Utility methods
  getAvailableCategories(): LocalAttraction['category'][] {
    return ['amenities', 'dining', 'attractions', 'shopping', 'transport', 'medical', 'entertainment'];
  }

  getCategoryDisplayName(category: LocalAttraction['category']): string {
    const displayNames: Record<LocalAttraction['category'], string> = {
      amenities: 'Amenities',
      dining: 'Dining',
      attractions: 'Local Attractions',
      shopping: 'Shopping',
      transport: 'Transport',
      medical: 'Medical',
      entertainment: 'Entertainment'
    };
    return displayNames[category];
  }

  getCategoryIcon(category: LocalAttraction['category']): string {
    const icons: Record<LocalAttraction['category'], string> = {
      amenities: '🏨',
      dining: '🍽️',
      attractions: '🎯',
      shopping: '🛍️',
      transport: '🚇',
      medical: '🏥',
      entertainment: '🎭'
    };
    return icons[category];
  }

  formatDistance(distance: number): string {
    if (distance < 1) {
      return `${Math.round(distance * 5280)} feet away`;
    }
    return `${distance.toFixed(1)} mile${distance !== 1 ? 's' : ''} away`;
  }

  calculateWalkingTime(distance: number): string {
    // Average walking speed: 3 mph
    const walkingTimeHours = distance / 3;
    const walkingTimeMinutes = Math.round(walkingTimeHours * 60);
    
    if (walkingTimeMinutes < 5) return '< 5 min walk';
    if (walkingTimeMinutes < 60) return `${walkingTimeMinutes} min walk`;
    
    const hours = Math.floor(walkingTimeMinutes / 60);
    const minutes = walkingTimeMinutes % 60;
    return minutes > 0 ? `${hours}h ${minutes}m walk` : `${hours}h walk`;
  }
}

export const attractionsService = new AttractionsService();