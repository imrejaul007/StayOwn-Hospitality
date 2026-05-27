// Habixo Types - Smart Living OS powered by ReZ

// Brand Types
export const HABIXO_BRANDS = ['habixo_stay', 'habixo_rent', 'habixo_match'] as const;
export type HabixoBrand = typeof HABIXO_BRANDS[number];

// Property Types
export const PROPERTY_TYPES = ['apartment', 'house', 'room', 'shared'] as const;
export type PropertyType = typeof PROPERTY_TYPES[number];

export const ROOM_TYPES = ['entire_place', 'private_room', 'shared_room'] as const;
export type RoomType = typeof ROOM_TYPES[number];

export const RENTAL_TYPES = ['short_term', 'long_term', 'both'] as const;
export type RentalType = typeof RENTAL_TYPES[number];

// Booking Status
export const BOOKING_STATUS = ['pending', 'confirmed', 'cancelled', 'completed', 'disputed'] as const;
export type BookingStatus = typeof BOOKING_STATUS[number];

// Flatmate Profile Types
export const LIFESTYLE_VIBE_TAGS = ['chill', 'party', 'professional', 'fitness', 'foodie', 'creative', 'outdoors', 'gamer'] as const;
export type LifestyleVibeTag = typeof LIFESTYLE_VIBE_TAGS[number];

export const SLEEP_SCHEDULES = ['early_bird', 'night_owl', 'flexible'] as const;
export type SleepSchedule = typeof SLEEP_SCHEDULES[number];

export const SMOKING_HABITS = ['never', 'occasionally', 'regularly'] as const;
export type SmokingHabit = typeof SMOKING_HABITS[number];

export const DRINKING_HABITS = ['never', 'occasionally', 'socially'] as const;
export type DrinkingHabit = typeof DRINKING_HABITS[number];

// Trust Score Weights
export const TRUST_COMPONENT_WEIGHTS = {
  reliability: 30,
  quality: 30,
  behavior: 20,
  reviews: 20,
} as const;

// Experience Types
export const EXPERIENCE_CATEGORIES = ['food', 'tours', 'classes', 'wellness', 'entertainment', 'outdoor', 'cultural', 'other'] as const;
export type ExperienceCategory = typeof EXPERIENCE_CATEGORIES[number];

// Amenity Defaults
export const AMENITY_CATEGORIES = ['basic', 'kitchen', 'bathroom', 'bedroom', 'tech', 'outdoor', 'safety', 'accessibility'] as const;
export type AmenityCategory = typeof AMENITY_CATEGORIES[number];

export const AMENITY_DEFAULTS = [
  { code: 'wifi', name: 'WiFi', category: 'tech' },
  { code: 'ac', name: 'Air Conditioning', category: 'basic' },
  { code: 'heating', name: 'Heating', category: 'basic' },
  { code: 'tv', name: 'TV', category: 'tech' },
  { code: 'kitchen', name: 'Kitchen', category: 'kitchen' },
  { code: 'washer', name: 'Washer', category: 'basic' },
  { code: 'dryer', name: 'Dryer', category: 'basic' },
  { code: 'parking', name: 'Free Parking', category: 'outdoor' },
  { code: 'pool', name: 'Pool', category: 'outdoor' },
  { code: 'gym', name: 'Gym', category: 'outdoor' },
  { code: 'hot_tub', name: 'Hot Tub', category: 'outdoor' },
  { code: 'security', name: 'Security System', category: 'safety' },
  { code: 'smoke_detector', name: 'Smoke Detector', category: 'safety' },
  { code: 'first_aid', name: 'First Aid Kit', category: 'safety' },
  { code: 'fire_extinguisher', name: 'Fire Extinguisher', category: 'safety' },
  { code: 'wheelchair', name: 'Wheelchair Accessible', category: 'accessibility' },
  { code: 'elevator', name: 'Elevator', category: 'accessibility' },
  { code: 'balcony', name: 'Balcony', category: 'outdoor' },
  { code: 'garden', name: 'Garden', category: 'outdoor' },
  { code: 'pet_friendly', name: 'Pet Friendly', category: 'basic' },
  { code: 'self_checkin', name: 'Self Check-in', category: 'basic' },
  { code: 'doorman', name: 'Doorman', category: 'safety' },
  { code: 'hair_dryer', name: 'Hair Dryer', category: 'bathroom' },
  { code: 'iron', name: 'Iron', category: 'bedroom' },
  { code: 'coffee', name: 'Coffee Maker', category: 'kitchen' },
];

// Intent Event Types
export const INTENT_EVENT_TYPES = ['search', 'view', 'wishlist', 'hold', 'booking_confirmed', 'fulfilled'] as const;
export type IntentEventType = typeof INTENT_EVENT_TYPES[number];

// Pagination
export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// API Response
export interface ApiResponse<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
}

// HabitError
export class HabitError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public code: string = 'HABIT_ERROR'
  ) {
    super(message);
    this.name = 'HabitError';
  }
}
