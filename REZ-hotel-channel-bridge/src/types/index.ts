import { z } from 'zod';

// Channel Types
export enum ChannelType {
  BOOKING_COM = 'booking_com',
  EXPEDIA = 'expedia',
  HOTELS_COM = 'hotels_com',
  AIRBNB = 'airbnb',
  AGODA = 'agoda',
  CUSTOM = 'custom'
}

// Room Types
export enum RoomType {
  STANDARD = 'standard',
  DELUXE = 'deluxe',
  SUITE = 'suite',
  PRES_SUITE = 'presidential_suite',
  FAMILY = 'family',
  ACCESSIBLE = 'accessible'
}

// Booking Status
export enum BookingStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  CANCELLED = 'cancelled',
  NO_SHOW = 'no_show',
  COMPLETED = 'completed'
}

// Sync Status
export enum SyncStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  FAILED = 'failed'
}

// Zod Schemas
export const ChannelConfigSchema = z.object({
  channelId: z.string().uuid(),
  channelType: z.nativeEnum(ChannelType),
  name: z.string().min(1).max(100),
  apiEndpoint: z.string().url(),
  apiKey: z.string().optional(),
  apiSecret: z.string().optional(),
  propertyId: z.string().min(1),
  isActive: z.boolean().default(true),
  webhookUrl: z.string().url().optional(),
  metadata: z.record(z.any()).optional()
});

export const RoomMappingSchema = z.object({
  mappingId: z.string().uuid(),
  hotelId: z.string().uuid(),
  channelId: z.string().uuid(),
  internalRoomId: z.string().min(1),
  channelRoomId: z.string().min(1),
  roomType: z.nativeEnum(RoomType),
  isActive: z.boolean().default(true),
  syncAvailability: z.boolean().default(true),
  syncPricing: z.boolean().default(true),
  syncRestrictions: z.boolean().default(true)
});

export const InventoryUpdateSchema = z.object({
  hotelId: z.string().uuid(),
  roomMappingId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  availableRooms: z.number().int().min(0),
  totalRooms: z.number().int().min(1),
  minStay: z.number().int().min(0).optional(),
  maxStay: z.number().int().min(1).optional(),
  closedToArrival: z.boolean().default(false),
  closedToDeparture: z.boolean().default(false)
});

export const PricingUpdateSchema = z.object({
  hotelId: z.string().uuid(),
  roomMappingId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  roomType: z.nativeEnum(RoomType),
  rates: z.array(z.object({
    ratePlanId: z.string(),
    currency: z.string().length(3).default('USD'),
    baseRate: z.number().positive(),
    taxes: z.number().min(0).default(0),
    fees: z.number().min(0).default(0),
    totalRate: z.number().positive(),
    minLos: z.number().int().min(1).default(1),
    maxLos: z.number().int().min(1).default(30)
  }))
});

export const BookingImportSchema = z.object({
  channelId: z.string().uuid(),
  externalBookingId: z.string().min(1),
  hotelId: z.string().uuid(),
  internalRoomId: z.string().min(1),
  guestName: z.object({
    first: z.string().min(1),
    last: z.string().min(1)
  }),
  guestEmail: z.string().email().optional(),
  guestPhone: z.string().optional(),
  checkIn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  checkOut: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  totalGuests: z.number().int().min(1),
  rooms: z.array(z.object({
    roomMappingId: z.string().uuid(),
    roomType: z.nativeEnum(RoomType),
    ratePlanId: z.string().optional(),
    nightlyRate: z.number().positive(),
    totalNights: z.number().int().positive(),
    totalAmount: z.number().positive()
  })),
  totalAmount: z.number().positive(),
  currency: z.string().length(3).default('USD'),
  status: z.nativeEnum(BookingStatus),
  specialRequests: z.string().optional(),
  metadata: z.record(z.any()).optional()
});

export const SyncJobSchema = z.object({
  jobId: z.string().uuid(),
  hotelId: z.string().uuid(),
  channelId: z.string().uuid(),
  syncType: z.enum(['inventory', 'pricing', 'booking', 'full']),
  status: z.nativeEnum(SyncStatus),
  startTime: z.date(),
  endTime: z.date().optional(),
  itemsProcessed: z.number().int().default(0),
  itemsFailed: z.number().int().default(0),
  errors: z.array(z.object({
    itemId: z.string(),
    error: z.string(),
    timestamp: z.date()
  })).default([])
});

// TypeScript Interfaces
export interface IChannelConfig extends z.infer<typeof ChannelConfigSchema> {}
export interface IRoomMapping extends z.infer<typeof RoomMappingSchema> {}
export interface IInventoryUpdate extends z.infer<typeof InventoryUpdateSchema> {}
export interface IPricingUpdate extends z.infer<typeof PricingUpdateSchema> {}
export interface IBookingImport extends z.infer<typeof BookingImportSchema> {}
export interface ISyncJob extends z.infer<typeof SyncJobSchema> {}

// API Response Types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  timestamp: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Channel Adapter Interface
export interface IChannelAdapter {
  channelType: ChannelType;
  authenticate(credentials: { apiKey: string; apiSecret?: string }): Promise<boolean>;
  getAvailability(propertyId: string, startDate: string, endDate: string): Promise<IInventoryUpdate[]>;
  updateAvailability(propertyId: string, updates: IInventoryUpdate[]): Promise<boolean>;
  getPricing(propertyId: string, startDate: string, endDate: string): Promise<IPricingUpdate[]>;
  updatePricing(propertyId: string, updates: IPricingUpdate[]): Promise<boolean>;
  getBookings(propertyId: string, startDate: string, endDate: string): Promise<IBookingImport[]>;
  updateBookingStatus(bookingId: string, status: BookingStatus): Promise<boolean>;
  testConnection(): Promise<boolean>;
}
