export interface Hotel {
  _id: string;
  name: string;
  description?: string;
  address: {
    street?: string;
    city: string;
    state?: string;
    country: string;
    zipCode?: string;
    coordinates?: {
      latitude: number;
      longitude: number;
    };
  };
  contact: {
    phone: string;
    email: string;
    website?: string;
  };
  amenities: string[];
  images: string[];
  policies: {
    checkInTime: string;
    checkOutTime: string;
    cancellationPolicy: string;
    petPolicy?: string;
    smokingPolicy?: string;
  };
  settings: {
    currency: string;
    timezone: string;
    language: string;
  };
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}