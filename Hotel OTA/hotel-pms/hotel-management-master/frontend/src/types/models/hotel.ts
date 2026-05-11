// -----------------------------------------------------------------------------
// Hotel types - mirrors backend/src/models/Hotel.js
// -----------------------------------------------------------------------------

export type SyncFrequency = 'real_time' | 'hourly' | 'daily' | 'manual';

export type HierarchyLevel = 'corporate' | 'region' | 'property';

export interface HotelAddress {
  street?: string;
  city: string;
  state?: string;
  country: string;
  zipCode?: string;
  coordinates?: {
    latitude?: number;
    longitude?: number;
  };
}

export interface HotelContact {
  phone: string;
  email: string;
  website?: string;
}

export interface HotelPolicies {
  checkInTime?: string;
  checkOutTime?: string;
  cancellationPolicy?: string;
  petPolicy?: string;
  smokingPolicy?: string;
}

export interface HotelSettings {
  currency?: string;
  timezone?: string;
  language?: string;
}

export interface OTACredentials {
  clientId?: string;
  clientSecret?: string;
  hotelId?: string;
}

export interface OTAConnection {
  isEnabled: boolean;
  credentials?: OTACredentials;
  lastSync?: string;
}

export interface OTAConnections {
  bookingCom?: OTAConnection;
}

export interface GroupSettings {
  inheritSettings: boolean;
  lastSyncAt?: string;
  version?: string;
  overrides?: {
    policies?: Record<string, unknown>;
    branding?: Record<string, unknown>;
    currencies?: string[];
    languages?: string[];
  };
}

export interface InheritanceConfig {
  autoSync: boolean;
  syncFrequency: SyncFrequency;
  allowLocalOverrides: boolean;
}

export interface HotelHierarchy {
  level: HierarchyLevel;
  parentId?: string;
  path?: string;
}

export interface Hotel {
  _id: string;
  id?: string;
  name: string;
  description?: string;
  address: HotelAddress;
  contact: HotelContact;
  amenities?: string[];
  images?: string[];
  policies?: HotelPolicies;
  settings?: HotelSettings;
  otaConnections?: OTAConnections;
  isActive: boolean;
  ownerId: string;
  propertyGroupId?: string;
  groupSettings?: GroupSettings;
  inheritSettings?: boolean;
  settingsOverrides?: Record<string, unknown>;
  lastSyncedAt?: string | null;
  multiPropertyEnabled?: boolean;
  inheritanceConfig?: InheritanceConfig;
  hierarchy?: HotelHierarchy;
  createdAt: string;
  updatedAt: string;
}
