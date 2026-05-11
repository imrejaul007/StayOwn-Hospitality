/**
 * Merchant Integration Client for Hotel OTA
 *
 * Provides integration with Rez Merchant Service for:
 * - Hotel/Room information retrieval
 * - Room service orders
 * - Housekeeping requests
 * - Maintenance requests
 * - Service request tracking
 * - Hotel analytics
 *
 * This is specifically designed for hotel room QR code integrations.
 */

import axios, { AxiosInstance } from 'axios';

const MERCHANT_API_BASE = process.env.MERCHANT_API_URL || 'https://api.rez.money/api/merchant';

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface HotelInfo {
  id: string;
  name: string;
  logo?: string;
  address?: string;
  city?: string;
  contact?: {
    phone?: string;
    email?: string;
    website?: string;
    whatsapp?: string;
  };
}

export interface RoomService {
  id: string;
  name: string;
  icon: string;
  description?: string;
  price?: number;
  estimatedTime?: string;
}

export interface RoomQuickAction {
  action: string;
  label: string;
  icon: string;
  deepLink?: string;
}

export interface HotelRoomInfo {
  hotel: HotelInfo;
  room: {
    id: string;
    roomNumber?: string;
    floor?: string;
    roomType?: string;
    availableServices: RoomService[];
    quickActions: RoomQuickAction[];
  };
  menu: {
    hasMenu: boolean;
    endpoint: string;
  };
}

export interface MerchantStore {
  id: string;
  name: string;
  slug: string;
  description?: string;
  logo?: string;
  category: string;
  location: {
    address: string;
    city: string;
    state?: string;
    pincode?: string;
  };
  contact?: {
    phone?: string;
    email?: string;
    website?: string;
    whatsapp?: string;
  };
  operationalInfo?: {
    hours?: Record<string, { open: string; close: string }>;
    dineIn?: boolean;
    delivery?: boolean;
    takeaway?: boolean;
  };
  storeType?: 'restaurant' | 'cafe' | 'bakery' | 'salon' | 'spa' | 'retail' | 'other';
  acceptsOnlineOrders?: boolean;
  acceptsScanPay?: boolean;
}

export interface ServiceRequestItem {
  productId?: string;
  name: string;
  quantity: number;
  notes?: string;
}

export interface ServiceRequest {
  type: 'room_service' | 'housekeeping' | 'maintenance' | 'general' | 'order';
  storeId: string;
  roomId?: string;
  hotelId?: string;
  customerId?: string;
  customerName?: string;
  customerPhone?: string;
  request: string;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  items?: ServiceRequestItem[];
  scheduledTime?: string;
}

export interface ServiceRequestResponse {
  requestId: string;
  status: string;
  estimatedResponse?: string;
}

export interface MerchantMenuProduct {
  id: string;
  name: string;
  description?: string;
  images: Array<{ url: string; alt?: string; isPrimary?: boolean }>;
  pricing: {
    original: number;
    selling: number;
    discount?: number;
    currency: string;
  };
  isVeg?: boolean;
  tags?: string[];
  preparationTime?: number;
}

// ─── API Client ────────────────────────────────────────────────────────────────

/**
 * Creates an axios client for merchant API calls
 */
function createMerchantClient(): AxiosInstance {
  return axios.create({
    baseURL: MERCHANT_API_BASE,
    timeout: 30000,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

const client = createMerchantClient();

// ─── Hotel Room Operations ──────────────────────────────────────────────────────

/**
 * Get hotel room information by hotel ID and room ID
 * This is the primary endpoint for Room QR codes
 */
export async function getHotelRoomInfo(
  hotelId: string,
  roomId: string
): Promise<HotelRoomInfo> {
  const { data } = await client.get<{
    success: boolean;
    data: HotelRoomInfo;
    meta?: {
      qrType?: string;
      hotelId?: string;
      roomId?: string;
      scannedAt?: string;
    };
  }>(`/qr/public/hotel/${hotelId}/room/${roomId}`);

  if (!data.success) {
    throw new Error(data.message || 'Failed to fetch hotel room info');
  }
  return data.data;
}

/**
 * Get services available for a hotel store
 */
export async function getHotelServices(storeId: string): Promise<RoomService[]> {
  const { data } = await client.get<{
    success: boolean;
    data: {
      services: Array<{
        id: string;
        name: string;
        icon: string;
      }>;
    };
  }>(`/qr/public/services/${storeId}`);

  if (!data.success) {
    throw new Error(data.message || 'Failed to fetch hotel services');
  }
  return data.data.services;
}

// ─── Store Operations ──────────────────────────────────────────────────────────

/**
 * Get store by ID (for hotel store lookup)
 */
export async function getStoreById(storeId: string): Promise<MerchantStore> {
  const { data } = await client.get<{
    success: boolean;
    data: MerchantStore;
  }>(`/qr/public/store/id/${storeId}`);

  if (!data.success) {
    throw new Error(data.message || 'Failed to fetch store');
  }
  return data.data;
}

/**
 * Get hotel's stores (authenticated merchant)
 */
export async function getHotelStores(merchantId?: string): Promise<MerchantStore[]> {
  // In production, merchantId would come from auth token
  const { data } = await client.get<{
    success: boolean;
    data: MerchantStore[];
  }>('/qr/merchant/stores');

  if (!data.success) {
    throw new Error(data.message || 'Failed to fetch stores');
  }

  // Filter for hotel category if needed
  const stores = data.data;
  return stores.filter(
    (s) =>
      s.category?.toLowerCase().includes('hotel') ||
      s.category?.toLowerCase().includes('resort') ||
      s.storeType === 'other' // Fallback
  );
}

// ─── Menu Operations ───────────────────────────────────────────────────────────

export interface MerchantMenu {
  store: {
    id: string;
    name: string;
    slug: string;
    logo?: string;
    category: string;
  };
  categories: Array<{
    id: string;
    name: string;
    description?: string;
    products: MerchantMenuProduct[];
  }>;
  totalProducts: number;
}

/**
 * Get menu for hotel room service
 */
export async function getRoomServiceMenu(storeId: string): Promise<MerchantMenu> {
  const { data } = await client.get<{
    success: boolean;
    data: MerchantMenu;
  }>(`/qr/public/menu/${storeId}`);

  if (!data.success) {
    throw new Error(data.message || 'Failed to fetch room service menu');
  }
  return data.data;
}

/**
 * Get room service items from menu
 */
export async function getRoomServiceItems(
  storeId: string
): Promise<MerchantMenuProduct[]> {
  const menu = await getRoomServiceMenu(storeId);
  // Flatten all products from all categories
  return menu.categories.flatMap((c) => c.products);
}

// ─── Service Request Operations ────────────────────────────────────────────────

/**
 * Submit a service request (room service, housekeeping, maintenance)
 */
export async function submitServiceRequest(
  request: ServiceRequest
): Promise<ServiceRequestResponse> {
  const { data } = await client.post<{
    success: boolean;
    data: ServiceRequestResponse;
    message?: string;
  }>('/qr/public/service-request', request);

  if (!data.success) {
    throw new Error(data.message || 'Failed to submit service request');
  }
  return data.data;
}

/**
 * Submit room service order
 */
export async function orderRoomService(
  hotelId: string,
  roomId: string,
  storeId: string,
  items: ServiceRequestItem[],
  options?: {
    customerId?: string;
    customerName?: string;
    customerPhone?: string;
  }
): Promise<ServiceRequestResponse> {
  return submitServiceRequest({
    type: 'room_service',
    storeId,
    roomId,
    hotelId,
    request: 'Room service order',
    items,
    ...options,
  });
}

/**
 * Request housekeeping
 */
export async function requestHousekeeping(
  hotelId: string,
  roomId: string,
  storeId: string,
  options?: {
    customerId?: string;
    customerName?: string;
    customerPhone?: string;
    priority?: 'low' | 'normal' | 'high' | 'urgent';
    scheduledTime?: string;
  }
): Promise<ServiceRequestResponse> {
  return submitServiceRequest({
    type: 'housekeeping',
    storeId,
    roomId,
    hotelId,
    request: 'Housekeeping request',
    ...options,
  });
}

/**
 * Report maintenance issue
 */
export async function reportMaintenance(
  hotelId: string,
  roomId: string,
  storeId: string,
  issue: string,
  options?: {
    customerId?: string;
    customerName?: string;
    customerPhone?: string;
    priority?: 'low' | 'normal' | 'high' | 'urgent';
  }
): Promise<ServiceRequestResponse> {
  return submitServiceRequest({
    type: 'maintenance',
    storeId,
    roomId,
    hotelId,
    request: issue,
    priority: options?.priority || 'normal',
    ...options,
  });
}

/**
 * Submit general request
 */
export async function submitGeneralRequest(
  hotelId: string,
  roomId: string,
  storeId: string,
  message: string,
  options?: {
    customerId?: string;
    customerName?: string;
    customerPhone?: string;
    priority?: 'low' | 'normal' | 'high' | 'urgent';
  }
): Promise<ServiceRequestResponse> {
  return submitServiceRequest({
    type: 'general',
    storeId,
    roomId,
    hotelId,
    request: message,
    ...options,
  });
}

// ─── Analytics Operations ──────────────────────────────────────────────────────

/**
 * Track service request analytics
 */
export async function trackServiceAnalytics(
  event: 'service_request_submitted' | 'room_service_order' | 'housekeeping_request' | 'maintenance_report',
  options?: {
    storeId?: string;
    hotelId?: string;
    roomId?: string;
    requestId?: string;
    customerId?: string;
  }
): Promise<void> {
  try {
    await client.post('/qr/public/analytics/track', {
      storeId: options?.storeId,
      event,
      metadata: {
        hotelId: options?.hotelId,
        roomId: options?.roomId,
        requestId: options?.requestId,
      },
      customerId: options?.customerId,
      source: 'room_qr',
    });
  } catch {
    // Non-blocking
    console.warn('[HotelOTA] Analytics tracking failed:', event);
  }
}

/**
 * Track room service order
 */
export function trackRoomServiceOrder(
  storeId: string,
  hotelId: string,
  roomId: string,
  requestId: string,
  customerId?: string
): void {
  trackServiceAnalytics('room_service_order', {
    storeId,
    hotelId,
    roomId,
    requestId,
    customerId,
  });
}

/**
 * Track housekeeping request
 */
export function trackHousekeepingRequest(
  storeId: string,
  hotelId: string,
  roomId: string,
  requestId: string,
  customerId?: string
): void {
  trackServiceAnalytics('housekeeping_request', {
    storeId,
    hotelId,
    roomId,
    requestId,
    customerId,
  });
}

// ─── Hotel QR Analytics ───────────────────────────────────────────────────────

export interface HotelQRAnalytics {
  totalScans: number;
  roomServiceOrders: number;
  housekeepingRequests: number;
  maintenanceReports: number;
  conversionRate: string;
}

export interface HotelAnalyticsResponse {
  hotelId: string;
  hotelName: string;
  qrScans: number;
  roomServiceOrders: number;
  housekeepingRequests: number;
  maintenanceReports: number;
  conversionRate: string;
  lastUpdated?: string;
}

/**
 * Get QR analytics for hotel (merchant authenticated)
 */
export async function getHotelQRAnalytics(
  storeId: string
): Promise<HotelAnalyticsResponse> {
  const { data } = await client.get<{
    success: boolean;
    data: HotelAnalyticsResponse;
  }>(`/qr/merchant/stores/${storeId}/analytics`);

  if (!data.success) {
    throw new Error(data.message || 'Failed to fetch hotel analytics');
  }
  return data.data;
}

// ─── Convenience Functions ─────────────────────────────────────────────────────

/**
 * Initialize room service order with common items
 */
export function createRoomServiceOrder(
  hotelId: string,
  roomId: string,
  storeId: string,
  items: Array<{ productId?: string; name: string; quantity: number; notes?: string }>,
  customerInfo?: {
    customerId?: string;
    customerName?: string;
    customerPhone?: string;
  }
): Promise<{ requestId: string; status: string; estimatedResponse?: string }> {
  return orderRoomService(hotelId, roomId, storeId, items, customerInfo);
}

/**
 * Quick housekeeping request
 */
export function quickHousekeeping(
  hotelId: string,
  roomId: string,
  storeId: string,
  customerInfo?: {
    customerId?: string;
    customerName?: string;
    customerPhone?: string;
  }
): Promise<{ requestId: string; status: string; estimatedResponse?: string }> {
  return requestHousekeeping(hotelId, roomId, storeId, {
    ...customerInfo,
    priority: 'normal',
  });
}

/**
 * Express checkout request
 */
export function expressCheckout(
  hotelId: string,
  roomId: string,
  storeId: string,
  customerInfo?: {
    customerId?: string;
    customerName?: string;
    customerPhone?: string;
  }
): Promise<{ requestId: string; status: string; estimatedResponse?: string }> {
  return submitGeneralRequest(
    hotelId,
    roomId,
    storeId,
    'Express checkout requested',
    {
      ...customerInfo,
      priority: 'high',
    }
  );
}
