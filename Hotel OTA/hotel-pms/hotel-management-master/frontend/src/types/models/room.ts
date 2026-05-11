// -----------------------------------------------------------------------------
// Room & RoomAvailability types - mirrors backend/src/models/Room.js
// and backend/src/models/RoomAvailability.js
// -----------------------------------------------------------------------------

export type RoomStatus = 'vacant' | 'occupied' | 'dirty' | 'maintenance' | 'out_of_order';

export type RoomType = 'single' | 'double' | 'suite' | 'deluxe';

/** Computed status includes extra statuses resolved at runtime. */
export type RoomComputedStatus = RoomStatus | 'reserved';

export type ChannelSyncStatus = 'pending' | 'success' | 'failed';

export type InventoryChangeAction =
  | 'booking'
  | 'cancellation'
  | 'modification'
  | 'stop_sell'
  | 'rate_change'
  | 'inventory_adjustment'
  | 'maintenance'
  | 'cleaning';

export type ReservationSource =
  | 'direct'
  | 'booking_com'
  | 'expedia'
  | 'airbnb'
  | 'agoda'
  | 'other';

export interface Room {
  _id: string;
  id?: string;
  hotelId: string;
  roomNumber: string;
  roomTypeId?: string;
  hotelAreaId?: string;
  /** Legacy room type string. */
  type?: RoomType;
  baseRate: number;
  currentRate?: number;
  status: RoomStatus;
  floor?: number;
  capacity: number;
  amenities?: string[];
  images?: string[];
  description?: string;
  isActive: boolean;
  revenueAccountCode?: string;
  revenueAccountId?: string;
  lastCleaned?: string;
  maintenanceNotes?: string;
  /** Computed at runtime; not stored in the database. */
  computedStatus?: RoomComputedStatus;
  currentBooking?: {
    bookingId: string;
    checkIn: string;
    checkOut: string;
    status: string;
  };
  createdAt: string;
  updatedAt: string;
}

// -- RoomAvailability (date-level inventory for channel management) -----------

export interface ChannelInventoryEntry {
  channel?: string;
  channelId?: string;
  availableRooms?: number;
  rate?: number;
  restrictions?: {
    stopSell: boolean;
    closedToArrival: boolean;
    closedToDeparture: boolean;
    minLOS: number;
    maxLOS: number;
  };
  lastSyncedAt?: string;
  syncStatus?: ChannelSyncStatus;
}

export interface AvailabilityReservation {
  bookingId?: string;
  roomsReserved?: number;
  source?: ReservationSource;
  reservedAt?: string;
}

export interface InventoryChangeEntry {
  timestamp?: string;
  action?: InventoryChangeAction;
  userId?: string;
  source?: string;
  oldValues?: Record<string, unknown>;
  newValues?: Record<string, unknown>;
  reason?: string;
  metadata?: {
    bookingId?: string;
    channel?: string;
    ipAddress?: string;
    userAgent?: string;
  };
}

export interface PerformanceMetrics {
  lastUpdated?: string;
  averageOccupancy: number;
  revenuePerRoom: number;
  conversionRate: number;
  lastCalculated?: string;
}

export interface SyncError {
  channel: string;
  error: string;
  timestamp?: string;
}

export interface RoomAvailability {
  _id: string;
  inventoryId?: string;
  hotelId: string;
  roomTypeId: string;
  date: string;
  totalRooms: number;
  availableRooms: number;
  soldRooms: number;
  blockedRooms: number;
  overbookedRooms: number;
  stopSellFlag: boolean;
  closedToArrival: boolean;
  closedToDeparture: boolean;
  minLengthOfStay: number;
  maxLengthOfStay: number;
  baseRate?: number;
  sellingRate?: number;
  currency: string;
  channelInventory?: ChannelInventoryEntry[];
  reservations?: AvailabilityReservation[];
  lastModifiedBy?: string;
  lastSyncedAt?: string;
  needsSync: boolean;
  syncErrors?: SyncError[];
  inventoryChanges?: InventoryChangeEntry[];
  performanceMetrics?: PerformanceMetrics;
  createdAt: string;
  updatedAt: string;
}
