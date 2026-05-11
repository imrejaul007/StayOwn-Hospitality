import { api } from './api';

// Enhanced interfaces for localized room types
export interface LocalizedRoomType {
  _id: string;
  code: string;
  name: string;
  description?: string;
  shortDescription?: string;
  specifications: {
    maxOccupancy: number;
    bedType: string;
    bedCount: number;
    roomSize?: number;
    floor?: { min?: number; max?: number };
    view?: string;
    smokingPolicy: string;
  };
  amenities: Array<{
    code: string;
    name: string;
    category: string;
    isHighlight: boolean;
  }>;
  totalRooms: number;
  baseRate: number;
  baseCurrency: string;
  images: Array<{
    url: string;
    type: string;
    order: number;
    caption?: string;
    isActive: boolean;
  }>;
  category: string;
  rank: number;
  hotelId: string;
  isActive: boolean;
  isPublished: boolean;
  // Translation-related fields
  content: {
    baseLanguage: string;
    translations: Array<{
      language: string;
      status: 'pending' | 'translated' | 'approved' | 'published';
      completeness: number;
      lastUpdated?: string;
    }>;
    autoTranslate: boolean;
    translationPriority: 'low' | 'medium' | 'high' | 'critical';
  };
  translationProgress?: TranslationProgress;
  translationCompleteness?: number;
  createdAt: string;
  updatedAt: string;
}

export interface TranslationProgress {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  byLanguage: Record<string, {
    total: number;
    pending: number;
    approved: number;
    rejected: number;
    completeness: number;
  }>;
}

export interface LocalizationOptions {
  language?: string;
  includeStats?: boolean;
  category?: string;
  isActive?: boolean;
  published?: boolean;
}

export interface TranslationInitializationRequest {
  targetLanguages: string[];
  autoTranslate?: boolean;
}

export interface BulkTranslationRequest extends TranslationInitializationRequest {
  roomTypeIds: string[];
}

export interface CreateRoomTypeWithTranslationsRequest {
  // Basic room type data
  name: string;
  description?: string;
  shortDescription?: string;
  code?: string;
  specifications: LocalizedRoomType['specifications'];
  amenities?: LocalizedRoomType['amenities'];
  totalRooms: number;
  baseRate: number;
  baseCurrency?: string;
  images?: LocalizedRoomType['images'];
  category?: string;
  rank?: number;
  hotelId: string;
  
  // Translation configuration
  targetLanguages?: string[];
  content?: {
    baseLanguage?: string;
    autoTranslate?: boolean;
    translationPriority?: 'low' | 'medium' | 'high' | 'critical';
  };
}

export interface UpdateRoomTypeWithTranslationsRequest extends Partial<CreateRoomTypeWithTranslationsRequest> {
  updateTranslations?: boolean;
}

class RoomTypeLocalizationService {
  private readonly baseUrl = '/room-types';

  /**
   * Get localized room types for a hotel
   */
  async getLocalizedRoomTypes(
    hotelId: string, 
    options: LocalizationOptions = {}
  ): Promise<{ data: LocalizedRoomType[]; meta: { language: string; total: number } }> {
    try {
      const params = new URLSearchParams();
      
      if (options.language) params.append('language', options.language);
      if (options.includeStats !== undefined) params.append('includeStats', options.includeStats.toString());
      if (options.category) params.append('category', options.category);
      if (options.isActive !== undefined) params.append('isActive', options.isActive.toString());
      if (options.published !== undefined) params.append('published', options.published.toString());

      const response = await api.get(`${this.baseUrl}/${hotelId}/localized?${params.toString()}`);
      return response.data;
    } catch (error: unknown) {
      const axiosErr = error as { response?: { data?: { message?: string }; status?: number }; config?: unknown };
      throw new Error(axiosErr.response?.data?.message || 'Failed to fetch localized room types');
    }
  }

  /**
   * Get a single localized room type
   */
  async getLocalizedRoomType(
    roomTypeId: string, 
    language = 'EN'
  ): Promise<{ data: LocalizedRoomType; meta: { language: string } }> {
    try {
      const response = await api.get(`${this.baseUrl}/${roomTypeId}/localized?language=${language}`);
      return response.data;
    } catch (error: unknown) {
      const axiosErr = error as { response?: { data?: { message?: string }; status?: number }; config?: unknown };
      throw new Error(axiosErr.response?.data?.message || 'Failed to fetch localized room type');
    }
  }

  /**
   * Initialize translations for a room type
   */
  async initializeTranslations(
    roomTypeId: string, 
    request: TranslationInitializationRequest
  ): Promise<unknown> {
    try {
      const response = await api.post(`${this.baseUrl}/${roomTypeId}/translations/initialize`, request);
      return response.data;
    } catch (error: unknown) {
      const axiosErr = error as { response?: { data?: { message?: string }; status?: number }; config?: unknown };
      throw new Error(axiosErr.response?.data?.message || 'Failed to initialize translations');
    }
  }

  /**
   * Get translation progress for a room type
   */
  async getTranslationProgress(
    roomTypeId: string, 
    language?: string
  ): Promise<{ data: TranslationProgress }> {
    try {
      const params = language ? `?language=${language}` : '';
      const response = await api.get(`${this.baseUrl}/${roomTypeId}/translations/progress${params}`);
      return response.data;
    } catch (error: unknown) {
      const axiosErr = error as { response?: { data?: { message?: string }; status?: number }; config?: unknown };
      throw new Error(axiosErr.response?.data?.message || 'Failed to fetch translation progress');
    }
  }

  /**
   * Bulk initialize translations for multiple room types
   */
  async bulkInitializeTranslations(
    hotelId: string, 
    request: BulkTranslationRequest
  ): Promise<unknown> {
    try {
      const response = await api.post(`${this.baseUrl}/${hotelId}/translations/bulk-initialize`, request);
      return response.data;
    } catch (error: unknown) {
      const axiosErr = error as { response?: { data?: { message?: string }; status?: number }; config?: unknown };
      throw new Error(axiosErr.response?.data?.message || 'Failed to bulk initialize translations');
    }
  }

  /**
   * Get room types with translation status
   */
  async getRoomTypesWithTranslationStatus(
    hotelId: string,
    options: Omit<LocalizationOptions, 'language'> = {}
  ): Promise<{ data: LocalizedRoomType[]; meta: { total: number } }> {
    try {
      const params = new URLSearchParams();
      
      if (options.category) params.append('category', options.category);
      if (options.isActive !== undefined) params.append('isActive', options.isActive.toString());

      const response = await api.get(`${this.baseUrl}/${hotelId}/translations/status?${params.toString()}`);
      return response.data;
    } catch (error: unknown) {
      const axiosErr = error as { response?: { data?: { message?: string }; status?: number }; config?: unknown };
      throw new Error(axiosErr.response?.data?.message || 'Failed to fetch translation status');
    }
  }

  /**
   * Create a new room type with automatic translation initialization
   */
  async createRoomTypeWithTranslations(
    request: CreateRoomTypeWithTranslationsRequest
  ): Promise<{ data: LocalizedRoomType; message: string }> {
    try {
      const response = await api.post(`${this.baseUrl}/with-translations`, request);
      return response.data;
    } catch (error: unknown) {
      const axiosErr = error as { response?: { data?: { message?: string }; status?: number }; config?: unknown };
      throw new Error(axiosErr.response?.data?.message || 'Failed to create room type with translations');
    }
  }

  /**
   * Update a room type and handle translation updates
   */
  async updateRoomTypeWithTranslations(
    roomTypeId: string,
    request: UpdateRoomTypeWithTranslationsRequest
  ): Promise<{ data: LocalizedRoomType; message: string }> {
    try {
      const response = await api.put(`${this.baseUrl}/${roomTypeId}/with-translations`, request);
      return response.data;
    } catch (error: unknown) {
      const axiosErr = error as { response?: { data?: { message?: string }; status?: number }; config?: unknown };
      throw new Error(axiosErr.response?.data?.message || 'Failed to update room type with translations');
    }
  }

  /**
   * Get available languages for translation
   */
  async getAvailableLanguages(): Promise<Array<{ code: string; name: string; nativeName: string }>> {
    try {
      const response = await api.get('/api/languages/active');
      return response.data.data;
    } catch (error: unknown) {
      const axiosErr = error as { response?: { data?: { message?: string }; status?: number }; config?: unknown };
      throw new Error(axiosErr.response?.data?.message || 'Failed to fetch available languages');
    }
  }

  /**
   * Helper method to get room type display name in current language
   */
  getDisplayName(roomType: LocalizedRoomType, fallbackLanguage = 'EN'): string {
    return roomType.name || `Room Type ${roomType.code}`;
  }

  /**
   * Helper method to get room type description in current language
   */
  getDescription(roomType: LocalizedRoomType, fallbackLanguage = 'EN'): string {
    return roomType.description || roomType.shortDescription || '';
  }

  /**
   * Helper method to format amenities for display
   */
  formatAmenities(
    amenities: LocalizedRoomType['amenities'], 
    options: { 
      highlightsOnly?: boolean; 
      maxCount?: number; 
      category?: string 
    } = {}
  ): LocalizedRoomType['amenities'] {
    let filtered = amenities;

    if (options.highlightsOnly) {
      filtered = filtered.filter(amenity => amenity.isHighlight);
    }

    if (options.category) {
      filtered = filtered.filter(amenity => amenity.category === options.category);
    }

    if (options.maxCount) {
      filtered = filtered.slice(0, options.maxCount);
    }

    return filtered;
  }

  /**
   * Helper method to get translation completeness percentage
   */
  getTranslationCompleteness(roomType: LocalizedRoomType, language?: string): number {
    if (!roomType.translationProgress) {
      return 0;
    }

    if (language && roomType.translationProgress.byLanguage[language]) {
      return roomType.translationProgress.byLanguage[language].completeness;
    }

    const { total, approved } = roomType.translationProgress;
    return total > 0 ? Math.round((approved / total) * 100) : 0;
  }

  /**
   * Helper method to check if a room type needs translation updates
   */
  needsTranslationUpdates(roomType: LocalizedRoomType, language?: string): boolean {
    if (!roomType.content.translations.length) {
      return true;
    }

    if (language) {
      const langTranslation = roomType.content.translations.find(t => t.language === language);
      return !langTranslation || langTranslation.status === 'pending';
    }

    return roomType.content.translations.some(t => t.status === 'pending');
  }

  /**
   * Helper method to get supported languages for a room type
   */
  getSupportedLanguages(roomType: LocalizedRoomType): string[] {
    return [
      roomType.content.baseLanguage,
      ...roomType.content.translations.map(t => t.language)
    ];
  }

  /**
   * Helper method to format room specifications for display
   */
  formatSpecifications(specifications: LocalizedRoomType['specifications']): Array<{
    key: string;
    label: string;
    value: string;
    icon?: string;
  }> {
    const formatted = [
      {
        key: 'maxOccupancy',
        label: 'Max Occupancy',
        value: `${specifications.maxOccupancy} guests`,
        icon: 'users'
      },
      {
        key: 'bedType',
        label: 'Bed Type',
        value: specifications.bedType.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()),
        icon: 'bed'
      }
    ];

    if (specifications.roomSize) {
      formatted.push({
        key: 'roomSize',
        label: 'Room Size',
        value: `${specifications.roomSize} sqm`,
        icon: 'square'
      });
    }

    if (specifications.view) {
      formatted.push({
        key: 'view',
        label: 'View',
        value: specifications.view.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()),
        icon: 'eye'
      });
    }

    return formatted;
  }
}

// Create and export singleton instance
export const roomTypeLocalizationService = new RoomTypeLocalizationService();
export default roomTypeLocalizationService;