// -----------------------------------------------------------------------------
// Housekeeping types - mirrors backend/src/models/Housekeeping.js
// and backend/src/models/HousekeepingTask.js
// -----------------------------------------------------------------------------

// -- Housekeeping (legacy / general model) ------------------------------------

export type HousekeepingTaskType =
  | 'cleaning'
  | 'maintenance'
  | 'inspection'
  | 'deep_clean'
  | 'checkout_clean';

export type HousekeepingStatus =
  | 'pending'
  | 'assigned'
  | 'in_progress'
  | 'completed'
  | 'inspected'
  | 'cancelled';

export type HousekeepingPriority = 'low' | 'medium' | 'high' | 'urgent';

export type RoomCleaningStatus =
  | 'dirty'
  | 'clean'
  | 'inspected'
  | 'maintenance_required';

export interface HousekeepingSupply {
  name: string;
  quantity: number;
  unit?: string;
}

export interface Housekeeping {
  _id: string;
  id?: string;
  hotelId: string;
  roomId: string;
  taskType: HousekeepingTaskType;
  /** Legacy alias for taskType. */
  type?: HousekeepingTaskType;
  title: string;
  description?: string;
  priority: HousekeepingPriority;
  status: HousekeepingStatus;
  assignedToUserId?: string;
  assignedTo?: string;
  estimatedDuration?: number;
  startedAt?: string;
  completedAt?: string;
  actualDuration?: number;
  notes?: string;
  supplies?: HousekeepingSupply[];
  beforeImages?: string[];
  afterImages?: string[];
  checkIn?: string;
  checkOut?: string;
  roomStatus?: RoomCleaningStatus;
  timeSpent?: number;
  inspection?: {
    inspectedBy?: string;
    inspectedAt?: string;
    passed?: boolean;
    rating?: number;
    notes?: string;
    failureReasons?: Array<{
      category?: 'cleanliness' | 'amenities' | 'damage' | 'safety' | 'other';
      description?: string;
      severity?: 'minor' | 'major' | 'critical';
    }>;
    qaChecklist?: Array<{
      item?: string;
      passed?: boolean;
      notes?: string;
    }>;
  };
  reinspectionCount?: number;
  createdAt: string;
  updatedAt: string;
}

// -- HousekeepingTask (granular task model) -----------------------------------

export type HousekeepingTaskSubtype =
  | 'cleaning'
  | 'bed_making'
  | 'bathroom'
  | 'amenities'
  | 'inspection';

export type HousekeepingTaskStatus =
  | 'pending'
  | 'in_progress'
  | 'completed'
  | 'cancelled';

export type InventoryReplacementType =
  | 'damaged'
  | 'lost'
  | 'wear_and_tear'
  | 'theft'
  | 'guest_request';

export interface InventoryConsumedEntry {
  inventoryItemId: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
  replacementType?: InventoryReplacementType;
  notes?: string;
  recordedAt?: string;
}

export interface InventoryPredictedEntry {
  inventoryItemId: string;
  predictedQuantity: number;
  confidence?: number;
  basedOnHistory?: boolean;
}

export interface InventoryEfficiency {
  overallScore?: number;
  itemsEfficiency?: {
    inventoryItemId: string;
    predictedQuantity: number;
    actualQuantity: number;
    efficiencyScore: number;
  }[];
  lastCalculated?: string;
}

export interface HousekeepingInspection {
  qualityScore?: number;
  notes?: string;
}

export interface HousekeepingTask {
  _id: string;
  id?: string;
  hotelId: string;
  roomId: string;
  floorId?: number;
  priority: HousekeepingPriority;
  tasks: HousekeepingTaskSubtype[];
  estimatedDuration: number;
  actualDuration?: number | null;
  specialInstructions?: string | null;
  status: HousekeepingTaskStatus;
  assignedTo?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  qualityScore?: number | null;
  notes?: string | null;
  createdBy: string;
  inventoryConsumed?: InventoryConsumedEntry[];
  inventoryPredicted?: InventoryPredictedEntry[];
  inventoryEfficiency?: InventoryEfficiency;
  autoInventoryConsumed?: boolean;
  createdAt: string;
  updatedAt: string;
}
