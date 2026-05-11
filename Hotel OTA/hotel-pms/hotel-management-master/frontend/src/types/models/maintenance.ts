// -----------------------------------------------------------------------------
// Maintenance types - mirrors backend/src/models/MaintenanceTask.js
// -----------------------------------------------------------------------------

export type MaintenanceType =
  | 'plumbing'
  | 'electrical'
  | 'hvac'
  | 'cleaning'
  | 'carpentry'
  | 'painting'
  | 'appliance'
  | 'safety'
  | 'other';

export type MaintenanceStatus =
  | 'pending'
  | 'assigned'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'on_hold';

export type MaintenancePriority =
  | 'low'
  | 'medium'
  | 'high'
  | 'urgent'
  | 'emergency';

export type MaintenanceCategory =
  | 'preventive'
  | 'corrective'
  | 'emergency'
  | 'inspection';

export type MaintenanceImpact = 'low' | 'medium' | 'high' | 'critical';

export type MaintenanceRecurringFrequency = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';

export interface MaintenanceMaterial {
  name: string;
  quantity: number;
  unitCost?: number;
  totalCost?: number;
  supplier?: string;
}

export interface MaintenanceImage {
  url: string;
  caption?: string;
  type?: 'before' | 'during' | 'after';
}

export interface RecurringSchedule {
  frequency?: MaintenanceRecurringFrequency;
  interval?: number;
  nextDue?: string;
  lastCompleted?: string;
}

export interface MaintenanceVendor {
  name?: string;
  contact?: string;
  cost?: number;
}

export interface MaintenanceWarranty {
  isUnderWarranty: boolean;
  warrantyProvider?: string;
  expiryDate?: string;
}

export interface MaintenanceTask {
  _id: string;
  id?: string;
  hotelId: string;
  roomId?: string;
  title: string;
  description?: string;
  type: MaintenanceType;
  priority: MaintenancePriority;
  status: MaintenanceStatus;
  assignedTo?: string;
  reportedBy: string;
  estimatedDuration?: number;
  actualDuration?: number;
  estimatedCost?: number;
  actualCost?: number;
  scheduledDate?: string;
  startedDate?: string;
  completedDate?: string;
  dueDate?: string;
  materials?: MaintenanceMaterial[];
  tools?: string[];
  skills?: string[];
  notes?: string;
  completionNotes?: string;
  images?: MaintenanceImage[];
  isRecurring: boolean;
  recurringSchedule?: RecurringSchedule;
  category: MaintenanceCategory;
  impact: MaintenanceImpact;
  roomOutOfOrder: boolean;
  vendorRequired: boolean;
  vendor?: MaintenanceVendor;
  warranty?: MaintenanceWarranty;
  createdAt: string;
  updatedAt: string;
}
