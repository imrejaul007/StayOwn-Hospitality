import { api } from './api';

export interface InventoryItem {
  _id: string;
  hotelId: string;
  name: string;
  category: 'bedding' | 'toiletries' | 'minibar' | 'electronics' | 'amenities' | 'cleaning' | 'furniture';
  subcategory?: string;
  brand?: string;
  unitPrice: number;
  replacementPrice?: number;
  guestPrice?: number;
  isComplimentary: boolean;
  isChargeable: boolean;
  maxComplimentary: number;
  stockThreshold: number;
  currentStock: number;
  supplier?: {
    name?: string;
    contact?: string;
    email?: string;
  };
  imageUrl?: string;
  description?: string;
  specifications?: Record<string, string>;
  dimensions?: {
    length?: number;
    width?: number;
    height?: number;
    weight?: number;
  };
  maintenanceInfo?: {
    cleaningInstructions?: string;
    replacementFrequency?: number;
    lastMaintenanceDate?: string;
  };
  isActive: boolean;
  tags?: string[];
  isLowStock: boolean;
  effectiveGuestPrice: number;
  effectiveReplacementPrice: number;
  createdAt: string;
  updatedAt: string;
}

export interface RoomInventoryTemplate {
  _id: string;
  hotelId: string;
  name: string;
  description?: string;
  roomTypes: string[];
  items: Array<{
    itemId: InventoryItem;
    defaultQuantity: number;
    minQuantity: number;
    maxComplimentary: number;
    isRequired: boolean;
    checkFrequency: 'daily' | 'weekly' | 'checkout' | 'checkin' | 'maintenance';
    location?: string;
    notes?: string;
  }>;
  checklistItems: Array<{
    name: string;
    category: 'electronics' | 'plumbing' | 'furniture' | 'amenities' | 'cleanliness';
    description?: string;
    checkPoints: Array<{
      item: string;
      expectedCondition: string;
      checkInstructions: string;
    }>;
    isRequired: boolean;
    checkFrequency: 'daily' | 'checkout' | 'checkin' | 'maintenance';
  }>;
  isDefault: boolean;
  isActive: boolean;
  version: number;
  totalItems: number;
  estimatedCost: number;
  createdAt: string;
  updatedAt: string;
}

export interface RoomInventory {
  _id: string;
  hotelId: string;
  roomId: {
    _id: string;
    roomNumber: string;
    type: string;
  };
  currentBookingId?: string;
  templateId: RoomInventoryTemplate;
  lastInspectionDate?: string;
  lastCleaningDate?: string;
  nextInspectionDue?: string;
  status: 'clean' | 'dirty' | 'maintenance' | 'inspection_required' | 'damaged' | 'out_of_order';
  items: Array<{
    _id: string;
    itemId: InventoryItem;
    currentQuantity: number;
    expectedQuantity: number;
    condition: 'excellent' | 'good' | 'fair' | 'worn' | 'damaged' | 'missing';
    lastCheckedDate: string;
    lastReplacedDate?: string;
    checkedBy?: string;
    location?: string;
    needsReplacement: boolean;
    replacementReason?: 'damaged' | 'worn' | 'missing' | 'hygiene' | 'guest_request' | 'maintenance';
    replacementRequested: boolean;
    replacementRequestedDate?: string;
    notes?: string;
    photos?: Array<{
      url: string;
      description: string;
      uploadedAt: string;
      uploadedBy: string;
    }>;
  }>;
  inspectionHistory: Array<{
    inspectedBy: string;
    inspectionDate: string;
    inspectionType: 'daily_cleaning' | 'checkout_inspection' | 'maintenance' | 'damage_assessment' | 'setup';
    findings: Array<{
      itemId: string;
      issue: string;
      severity: 'minor' | 'moderate' | 'major' | 'critical';
      action: 'none' | 'cleaned' | 'replaced' | 'repaired' | 'reported';
      cost?: number;
      chargedToGuest: boolean;
    }>;
    overallStatus: 'passed' | 'failed' | 'needs_attention';
    score?: number;
    timeSpent?: number;
    notes?: string;
    photos?: Array<{
      url: string;
      description: string;
      uploadedAt: string;
    }>;
  }>;
  specialInstructions: Array<{
    instruction: string;
    addedBy: string;
    addedAt: string;
    isActive: boolean;
  }>;
  maintenanceRequired: boolean;
  maintenanceNotes?: string;
  isActive: boolean;
  daysSinceLastInspection?: number;
  itemsNeedingReplacement: Array<unknown>;
  missingItems: Array<unknown>;
  conditionScore: number;
  isInspectionOverdue: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface InventoryTransaction {
  _id: string;
  hotelId: string;
  roomId: {
    _id: string;
    roomNumber: string;
    type: string;
  };
  bookingId?: {
    _id: string;
    bookingNumber: string;
    guestDetails: Record<string, unknown>;
  };
  guestId?: string;
  transactionType: 'replacement' | 'extra_request' | 'damage' | 'checkout_charge' | 'maintenance' | 'restocking' | 'setup' | 'theft' | 'complimentary';
  items: Array<{
    itemId: InventoryItem;
    name: string;
    category: string;
    quantityChanged: number;
    previousQuantity?: number;
    newQuantity?: number;
    unitPrice: number;
    totalCost: number;
    condition?: string;
    reason: string;
    isChargeable: boolean;
    chargeType?: 'replacement' | 'extra' | 'damage' | 'theft';
    location?: string;
    notes?: string;
    photos?: Array<{
      url: string;
      description: string;
      uploadedAt: string;
    }>;
  }>;
  totalAmount: number;
  chargedToGuest: boolean;
  guestChargeAmount?: number;
  processedBy: {
    _id: string;
    name: string;
  };
  approvedBy?: {
    _id: string;
    name: string;
  };
  processedAt: string;
  approvedAt?: string;
  status: 'pending' | 'approved' | 'completed' | 'cancelled' | 'refunded';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  notes?: string;
  inspectionId?: string;
  invoiceId?: string;
  replacementRequestId?: string;
  scheduledDate?: string;
  completedDate?: string;
  cancellationReason?: string;
  refundAmount?: number;
  refundDate?: string;
  refundReason?: string;
  ageInHours: number;
  itemsCount: number;
  chargeableItemsCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CheckoutInspection {
  _id: string;
  hotelId: string;
  roomId: {
    _id: string;
    roomNumber: string;
    type: string;
  };
  bookingId: string;
  guestId?: string;
  inspectedBy: {
    _id: string;
    name: string;
  };
  inspectionDate: string;
  checklistItems: Array<{
    category: 'electronics' | 'plumbing' | 'furniture' | 'amenities' | 'cleanliness' | 'safety';
    item: string;
    description?: string;
    status: 'working' | 'not_working' | 'missing' | 'damaged' | 'dirty' | 'satisfactory';
    severity?: 'minor' | 'moderate' | 'major' | 'critical';
    actionRequired: 'none' | 'clean' | 'repair' | 'replace' | 'report_maintenance';
    estimatedCost?: number;
    notes?: string;
    photos?: Array<{
      url: string;
      description: string;
      uploadedAt: string;
    }>;
    checkedAt: string;
  }>;
  inventoryVerification: Array<{
    itemId: InventoryItem;
    itemName: string;
    category: string;
    expectedQuantity: number;
    actualQuantity: number;
    condition: string;
    verified: boolean;
    discrepancy: 'none' | 'missing' | 'damaged' | 'extra' | 'wrong_condition';
    replacementNeeded: boolean;
    chargeGuest: boolean;
    chargeAmount?: number;
    location?: string;
    notes?: string;
    photos?: Array<{
      url: string;
      description: string;
      uploadedAt: string;
    }>;
  }>;
  damagesFound: Array<{
    type: 'inventory_damage' | 'room_damage' | 'missing_item' | 'extra_usage';
    category?: string;
    itemId?: string;
    itemName?: string;
    description: string;
    severity: 'minor' | 'moderate' | 'major' | 'critical';
    quantity: number;
    estimatedCost: number;
    chargeGuest: boolean;
    chargeAmount?: number;
    chargeReason?: string;
    location?: string;
    photos?: Array<{
      url: string;
      description: string;
      uploadedAt: string;
    }>;
    reportedToMaintenance: boolean;
    maintenanceTicketId?: string;
  }>;
  roomConditionScore?: number;
  totalCharges: number;
  chargesSummary: {
    damages: number;
    missing: number;
    extra: number;
    cleaning: number;
  };
  inspectionStatus: 'in_progress' | 'passed' | 'failed' | 'pending_charges' | 'completed';
  canCheckout: boolean;
  checkoutBlocked: boolean;
  blockingIssues?: Array<{
    issue: string;
    severity: string;
    resolution: string;
  }>;
  specialInstructions?: string;
  followUpRequired: boolean;
  followUpNotes?: string;
  timeSpent?: number;
  notes?: string;
  completedAt?: string;
  approvedBy?: string;
  approvedAt?: string;
  transactionId?: string;
  invoiceId?: string;
  inspectionDuration?: number;
  overallStatus: string;
  itemsNeedingAttention: number;
  createdAt: string;
  updatedAt: string;
}

interface ApiResponse<T> {
  status: string;
  data: T;
  pagination?: {
    current: number;
    pages: number;
    total: number;
  };
}

class RoomInventoryService {
  private baseUrl = '/room-inventory';

  // Inventory Items
  async getInventoryItems(params: {
    category?: string;
    search?: string;
    active?: boolean;
    page?: number;
    limit?: number;
  } = {}): Promise<ApiResponse<{ items: InventoryItem[] }>> {
    try {
      const searchParams = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          searchParams.append(key, value.toString());
        }
      });

      const response = await api.get(`${this.baseUrl}/items?${searchParams.toString()}`);
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  async createInventoryItem(itemData: Partial<InventoryItem>): Promise<ApiResponse<{ item: InventoryItem }>> {
    try {
      const response = await api.post(`${this.baseUrl}/items`, itemData);
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  async updateInventoryItem(id: string, itemData: Partial<InventoryItem>): Promise<ApiResponse<{ item: InventoryItem }>> {
    try {
      const response = await api.put(`${this.baseUrl}/items/${id}`, itemData);
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  // Templates
  async getInventoryTemplates(params: {
    roomType?: string;
    active?: boolean;
  } = {}): Promise<ApiResponse<{ templates: RoomInventoryTemplate[] }>> {
    try {
      const searchParams = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          searchParams.append(key, value.toString());
        }
      });

      const response = await api.get(`${this.baseUrl}/templates?${searchParams.toString()}`);
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  async createInventoryTemplate(templateData: Partial<RoomInventoryTemplate>): Promise<ApiResponse<{ template: RoomInventoryTemplate }>> {
    try {
      const response = await api.post(`${this.baseUrl}/templates`, templateData);
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  // Room Inventory
  async getRoomInventory(roomId: string): Promise<ApiResponse<{ roomInventory: RoomInventory }>> {
    try {
      const response = await api.get(`${this.baseUrl}/rooms/${roomId}`);
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  async recordRoomInspection(roomId: string, inspectionData: {
    inspectionType: string;
    findings: unknown[];
    overallStatus: string;
    score?: number;
    notes?: string;
    itemUpdates?: Array<{
      itemId: string;
      condition: string;
      currentQuantity: number;
      needsReplacement?: boolean;
      notes?: string;
    }>;
  }): Promise<ApiResponse<{ roomInventory: RoomInventory }>> {
    try {
      const response = await api.post(`${this.baseUrl}/rooms/${roomId}/inspect`, inspectionData);
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  async requestItemReplacement(roomId: string, replacementData: {
    items: Array<{
      itemId: string;
      quantity: number;
      condition?: string;
    }>;
    reason: string;
    notes?: string;
  }): Promise<ApiResponse<{ message: string }>> {
    try {
      const response = await api.post(`${this.baseUrl}/rooms/${roomId}/replace`, replacementData);
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  // Transactions
  async getInventoryTransactions(params: {
    roomId?: string;
    transactionType?: string;
    status?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
  } = {}): Promise<ApiResponse<{ transactions: InventoryTransaction[] }>> {
    try {
      const searchParams = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          searchParams.append(key, value.toString());
        }
      });

      const response = await api.get(`${this.baseUrl}/transactions?${searchParams.toString()}`);
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  // Analytics
  async getInventoryAnalytics(params: {
    startDate?: string;
    endDate?: string;
  } = {}): Promise<ApiResponse<{
    inventorySummary: unknown;
    costAnalytics: unknown;
    lowStockItems: InventoryItem[];
    roomsNeedingInspection: RoomInventory[];
  }>> {
    try {
      const searchParams = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          searchParams.append(key, value.toString());
        }
      });

      const response = await api.get(`${this.baseUrl}/analytics?${searchParams.toString()}`);
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  // Checkout Inspection
  async createCheckoutInspection(inspectionData: {
    roomId: string;
    bookingId: string;
    guestId?: string;
  }): Promise<ApiResponse<{ inspection: CheckoutInspection }>> {
    try {
      const response = await api.post(`${this.baseUrl}/checkout-inspection`, inspectionData);
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  async getCheckoutInspection(bookingId: string): Promise<ApiResponse<{ inspection: CheckoutInspection }>> {
    try {
      const response = await api.get(`${this.baseUrl}/checkout-inspection/${bookingId}`);
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  async updateCheckoutInspection(bookingId: string, inspectionData: Partial<CheckoutInspection>): Promise<ApiResponse<{ inspection: CheckoutInspection }>> {
    try {
      const response = await api.put(`${this.baseUrl}/checkout-inspection/${bookingId}`, inspectionData);
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }
}

export const roomInventoryService = new RoomInventoryService();