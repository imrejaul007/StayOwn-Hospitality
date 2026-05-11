// -----------------------------------------------------------------------------
// Inventory types - mirrors backend/src/models/InventoryItem.js
// and backend/src/models/InventoryTransaction.js
// -----------------------------------------------------------------------------

export type InventoryCategory =
  | 'bedding'
  | 'toiletries'
  | 'minibar'
  | 'electronics'
  | 'amenities'
  | 'cleaning'
  | 'furniture';

export type InventoryTransactionType =
  | 'replacement'
  | 'extra_request'
  | 'damage'
  | 'checkout_charge'
  | 'maintenance'
  | 'restocking'
  | 'setup'
  | 'theft'
  | 'complimentary';

export type InventoryTransactionStatus =
  | 'pending'
  | 'approved'
  | 'completed'
  | 'cancelled'
  | 'refunded';

export type ItemCondition =
  | 'excellent'
  | 'good'
  | 'fair'
  | 'worn'
  | 'damaged'
  | 'missing';

export type ItemReason =
  | 'damaged_by_guest'
  | 'normal_wear'
  | 'stolen'
  | 'missing'
  | 'guest_request'
  | 'maintenance_replacement'
  | 'hygiene_requirement'
  | 'initial_setup'
  | 'restock'
  | 'complimentary_upgrade'
  | 'quality_issue';

export type ReorderStatus =
  | 'pending'
  | 'approved'
  | 'ordered'
  | 'received'
  | 'cancelled'
  | 'rejected';

// -- Inventory Item -----------------------------------------------------------

export interface InventorySupplier {
  name?: string;
  contact?: string;
  email?: string;
}

export interface PreferredSupplier extends InventorySupplier {
  leadTime?: number;
}

export interface ReorderHistoryEntry {
  date?: string;
  quantity: number;
  supplier: string;
  estimatedCost?: number;
  actualCost?: number;
  status?: ReorderStatus;
  approvedBy?: string;
  orderDate?: string;
  expectedDeliveryDate?: string;
  actualDeliveryDate?: string;
  notes?: string;
  alertId?: string;
}

export interface ReorderSettings {
  autoReorderEnabled: boolean;
  reorderPoint?: number;
  reorderQuantity?: number;
  preferredSupplier?: PreferredSupplier;
  lastReorderDate?: string;
  reorderHistory?: ReorderHistoryEntry[];
}

export interface InventoryItem {
  _id: string;
  id?: string;
  hotelId: string;
  name: string;
  category: InventoryCategory;
  subcategory?: string;
  brand?: string;
  unitPrice: number;
  replacementPrice?: number;
  guestPrice?: number;
  isComplimentary: boolean;
  isChargeable: boolean;
  maxComplimentary?: number;
  stockThreshold: number;
  currentStock: number;
  supplier?: InventorySupplier;
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
  reorderSettings?: ReorderSettings;
  createdBy?: string;
  lastUpdatedBy?: string;
  createdAt: string;
  updatedAt: string;
}

// -- Inventory Transaction ----------------------------------------------------

export interface TransactionItemPhoto {
  url: string;
  description?: string;
  uploadedAt?: string;
}

export interface TransactionItem {
  itemId: string;
  name: string;
  category?: InventoryCategory;
  quantityChanged: number;
  previousQuantity?: number;
  newQuantity?: number;
  unitPrice: number;
  totalCost: number;
  condition?: ItemCondition;
  reason: ItemReason;
  isChargeable: boolean;
  chargeType?: 'replacement' | 'extra' | 'damage' | 'theft';
  location?: string;
  notes?: string;
  photos?: TransactionItemPhoto[];
}

export interface InventoryTransaction {
  _id: string;
  id?: string;
  hotelId: string;
  roomId: string;
  bookingId?: string;
  guestId?: string;
  transactionType: InventoryTransactionType;
  items: TransactionItem[];
  totalAmount: number;
  chargedToGuest: boolean;
  guestChargeAmount?: number;
  processedBy: string;
  approvedBy?: string;
  processedAt: string;
  approvedAt?: string;
  status: InventoryTransactionStatus;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
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
  createdAt: string;
  updatedAt: string;
}
