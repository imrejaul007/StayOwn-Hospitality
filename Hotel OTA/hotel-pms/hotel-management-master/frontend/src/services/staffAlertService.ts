import logger from './utils/logger';

import { api } from './api';

// Staff Alert Interfaces
export interface StaffAlert {
  _id: string;
  hotelId: string;
  type: StaffAlertType;
  priority: 'low' | 'medium' | 'high' | 'urgent' | 'critical';
  title: string;
  message: string;
  category: 'operational' | 'maintenance' | 'guest_service' | 'inventory' | 'safety' | 'system';
  source: {
    type: 'guest_request' | 'system' | 'staff' | 'maintenance' | 'inventory' | 'booking' | 'payment';
    id: string;
    details?: Record<string, unknown>;
  };
  assignedTo?: {
    _id: string;
    name: string;
    role: string;
  };
  departmentFilter?: string[];
  roleFilter?: string[];
  status: 'active' | 'acknowledged' | 'in_progress' | 'resolved' | 'dismissed';
  acknowledgedBy?: {
    _id: string;
    name: string;
    acknowledgedAt: string;
  };
  resolvedBy?: {
    _id: string;
    name: string;
    resolvedAt: string;
  };
  metadata?: {
    roomNumber?: string;
    guestName?: string;
    bookingId?: string;
    serviceType?: string;
    inventoryItem?: string;
    urgencyLevel?: string;
    estimatedResolution?: string;
    actionRequired?: string;
    escalationLevel?: number;
    relatedAlerts?: string[];
    location?: string;
    equipment?: string;
  };
  actionUrl?: string;
  actionText?: string;
  expiresAt?: string;
  escalatesAt?: string;
  createdAt: string;
  updatedAt: string;
  isExpired?: boolean;
  isEscalated?: boolean;
  requiresImmediate?: boolean;
}

export type StaffAlertType = 
  | 'guest_service_request' | 'maintenance_required' | 'room_ready' | 'room_issue'
  | 'inventory_low' | 'inventory_critical' | 'checkout_ready' | 'cleaning_priority'
  | 'safety_incident' | 'equipment_failure' | 'system_alert' | 'shift_change'
  | 'vip_arrival' | 'complaint_received' | 'emergency_request' | 'security_alert'
  | 'payment_issue' | 'booking_modification' | 'special_request' | 'deadline_approaching'
  | 'staff_assistance' | 'quality_check' | 'audit_required' | 'training_reminder';

export interface StaffAlertFilters {
  status?: string;
  type?: string;
  priority?: string;
  category?: string;
  assignedTo?: string;
  department?: string;
  page?: number;
  limit?: number;
  skip?: number;
  unreadOnly?: boolean;
  activeOnly?: boolean;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface StaffAlertSummary {
  totalActive: number;
  totalUnacknowledged: number;
  criticalCount: number;
  urgentCount: number;
  highCount: number;
  byCategory: Record<string, number>;
  byType: Record<string, number>;
  escalatedCount: number;
  expiringSoon: number;
}

class StaffAlertService {
  // Get staff alerts with filters
  async getAlerts(filters: StaffAlertFilters = {}): Promise<{
    alerts: StaffAlert[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      pages: number;
    };
    summary: StaffAlertSummary;
  }> {
    try {
      const page = Math.max(1, Number(filters.page) || 1);
      const limit = Math.min(100, Math.max(1, Number(filters.limit) || 20));
      const skip = filters.skip != null ? Number(filters.skip) : (page - 1) * limit;

      const params: Record<string, string | number | boolean> = {
        limit,
        skip,
        status: filters.status || 'all',
        priority: filters.priority || 'all',
        category: filters.category || 'all',
        sortBy: filters.sortBy || 'createdAt',
        sortOrder: filters.sortOrder || 'desc'
      };

      // Pass optional filters only when set
      if (filters.type) params.type = filters.type;
      if (filters.search) params.search = filters.search;
      if (filters.assignedTo) params.assignedTo = filters.assignedTo;
      if (filters.department) params.department = filters.department;
      if (filters.activeOnly) params.activeOnly = 'true';
      if (filters.unreadOnly) params.unreadOnly = 'true';

      const [response, summaryResponse] = await Promise.all([
        api.get('/staff/alerts', { params }),
        api.get('/staff/alerts/summary')
      ]);
      const payload = response.data;
      const alerts = payload?.data?.alerts || [];
      const total = payload?.total || 0;
      const pages = Math.max(1, Math.ceil(total / limit));
      const summaryPayload = summaryResponse?.data?.data || {};

      return {
        alerts,
        pagination: { page, limit, total, pages },
        summary: {
          totalActive: summaryPayload.totalAlerts || 0,
          totalUnacknowledged: summaryPayload.unacknowledgedAlerts || 0,
          criticalCount: summaryPayload.criticalAlerts || 0,
          urgentCount: summaryPayload.urgentAlerts || 0,
          highCount: 0,
          byCategory: summaryPayload.alertsByCategory || {},
          byType: {},
          escalatedCount: 0,
          expiringSoon: 0
        }
      };
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  // Get alert summary/dashboard data
  async getAlertSummary(): Promise<StaffAlertSummary> {
    try {
      const response = await api.get('/staff/alerts/summary');
      const data = response.data.data;

      // Convert backend response format to expected format
      return {
        totalActive: data.totalAlerts || 0,
        totalUnacknowledged: data.unacknowledgedAlerts || 0,
        criticalCount: data.criticalAlerts || 0,
        urgentCount: data.urgentAlerts || 0,
        highCount: 0,
        byCategory: data.alertsByCategory || {},
        byType: {},
        escalatedCount: 0,
        expiringSoon: 0
      };
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  // Get specific alert
  async getAlert(id: string): Promise<StaffAlert> {
    try {
      const response = await api.get(`/staff/alerts/${id}`);
      return response.data.data.alert;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  // Acknowledge alert
  async acknowledgeAlert(id: string): Promise<StaffAlert> {
    try {
      const response = await api.patch(`/staff/alerts/${id}/acknowledge`);
      return response.data.data.alert;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  // Start working on alert
  async startWorkingOnAlert(id: string, notes?: string): Promise<StaffAlert> {
    try {
      const response = await api.put(`/staff/alerts/${id}`, { status: 'in_progress', notes });
      return response.data.data.alert;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  // Resolve alert
  async resolveAlert(id: string, resolution: string, notes?: string): Promise<StaffAlert> {
    try {
      const response = await api.put(`/staff/alerts/${id}`, { status: 'resolved', resolution, notes });
      return response.data.data.alert;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  // Dismiss alert
  async dismissAlert(id: string, reason?: string): Promise<StaffAlert> {
    try {
      const response = await api.put(`/staff/alerts/${id}`, { status: 'dismissed', reason });
      return response.data.data.alert;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  // Escalate alert (sets escalate:true so the backend bumps priority to critical and increments escalationLevel)
  async escalateAlert(id: string, reason: string, escalateTo?: string): Promise<StaffAlert> {
    try {
      const response = await api.put(`/staff/alerts/${id}`, { escalate: true, reason, escalateTo });
      return response.data.data.alert;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  // Assign alert to staff member (uses PUT /:id with assignedTo field)
  async assignAlert(id: string, assignToId: string, notes?: string): Promise<StaffAlert> {
    try {
      const response = await api.put(`/staff/alerts/${id}`, { assignedTo: assignToId, notes });
      return response.data.data.alert;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  // Get recent alerts for dropdown
  async getRecentAlerts(limit: number = 5): Promise<StaffAlert[]> {
    try {
      const response = await api.get(`/staff/alerts/recent?limit=${limit}`);
      return response.data.data.alerts;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  // Mark multiple alerts as acknowledged — run all in parallel and count only successes
  async acknowledgeMultiple(alertIds: string[]): Promise<{ modifiedCount: number }> {
    const results = await Promise.allSettled(alertIds.map((id) => this.acknowledgeAlert(id)));
    const modifiedCount = results.filter((r) => r.status === 'fulfilled').length;
    const failedCount = results.length - modifiedCount;
    if (modifiedCount === 0) {
      throw new Error('Failed to acknowledge any alerts');
    }
    if (failedCount > 0) {
      // Partial success — still return count so UI can report correctly
      logger.warn(`acknowledgeMultiple: ${failedCount} alert(s) failed to acknowledge`);
    }
    return { modifiedCount };
  }

  // Utility functions
  getAlertTypeInfo(type: StaffAlertType): {
    label: string;
    icon: string;
    color: string;
    description: string;
  } {
    const typeInfo: Record<StaffAlertType, {
      label: string;
      icon: string;
      color: string;
      description: string;
    }> = {
      guest_service_request: {
        label: 'Guest Service',
        icon: 'user',
        color: 'bg-blue-100 text-blue-800',
        description: 'Guest requires assistance or service'
      },
      maintenance_required: {
        label: 'Maintenance',
        icon: 'wrench',
        color: 'bg-orange-100 text-orange-800',
        description: 'Maintenance or repair needed'
      },
      room_ready: {
        label: 'Room Ready',
        icon: 'check-circle',
        color: 'bg-green-100 text-green-800',
        description: 'Room is ready for check-in'
      },
      room_issue: {
        label: 'Room Issue',
        icon: 'alert-triangle',
        color: 'bg-red-100 text-red-800',
        description: 'Issue with room condition or amenities'
      },
      inventory_low: {
        label: 'Low Inventory',
        icon: 'package',
        color: 'bg-yellow-100 text-yellow-800',
        description: 'Inventory item running low'
      },
      inventory_critical: {
        label: 'Critical Inventory',
        icon: 'alert-octagon',
        color: 'bg-red-100 text-red-800',
        description: 'Critical inventory shortage'
      },
      checkout_ready: {
        label: 'Checkout Ready',
        icon: 'clock',
        color: 'bg-blue-100 text-blue-800',
        description: 'Guest ready for checkout'
      },
      cleaning_priority: {
        label: 'Priority Cleaning',
        icon: 'clipboard-check',
        color: 'bg-purple-100 text-purple-800',
        description: 'High priority cleaning required'
      },
      safety_incident: {
        label: 'Safety Incident',
        icon: 'shield-alert',
        color: 'bg-red-100 text-red-800',
        description: 'Safety incident requires attention'
      },
      equipment_failure: {
        label: 'Equipment Failure',
        icon: 'x-circle',
        color: 'bg-red-100 text-red-800',
        description: 'Equipment malfunction or failure'
      },
      system_alert: {
        label: 'System Alert',
        icon: 'monitor',
        color: 'bg-gray-100 text-gray-800',
        description: 'System notification or update'
      },
      shift_change: {
        label: 'Shift Change',
        icon: 'rotate-ccw',
        color: 'bg-indigo-100 text-indigo-800',
        description: 'Shift change notification'
      },
      vip_arrival: {
        label: 'VIP Arrival',
        icon: 'star',
        color: 'bg-purple-100 text-purple-800',
        description: 'VIP guest arriving soon'
      },
      complaint_received: {
        label: 'Complaint',
        icon: 'frown',
        color: 'bg-red-100 text-red-800',
        description: 'Guest complaint received'
      },
      emergency_request: {
        label: 'Emergency',
        icon: 'alert-triangle',
        color: 'bg-red-100 text-red-800',
        description: 'Emergency assistance required'
      },
      security_alert: {
        label: 'Security Alert',
        icon: 'shield',
        color: 'bg-red-100 text-red-800',
        description: 'Security incident or alert'
      },
      payment_issue: {
        label: 'Payment Issue',
        icon: 'credit-card',
        color: 'bg-yellow-100 text-yellow-800',
        description: 'Payment processing issue'
      },
      booking_modification: {
        label: 'Booking Change',
        icon: 'edit',
        color: 'bg-blue-100 text-blue-800',
        description: 'Booking modification request'
      },
      special_request: {
        label: 'Special Request',
        icon: 'heart',
        color: 'bg-pink-100 text-pink-800',
        description: 'Special guest request'
      },
      deadline_approaching: {
        label: 'Deadline',
        icon: 'clock',
        color: 'bg-orange-100 text-orange-800',
        description: 'Task deadline approaching'
      },
      staff_assistance: {
        label: 'Staff Help',
        icon: 'users',
        color: 'bg-green-100 text-green-800',
        description: 'Staff member needs assistance'
      },
      quality_check: {
        label: 'Quality Check',
        icon: 'check-square',
        color: 'bg-indigo-100 text-indigo-800',
        description: 'Quality inspection required'
      },
      audit_required: {
        label: 'Audit',
        icon: 'file-text',
        color: 'bg-gray-100 text-gray-800',
        description: 'Audit or inspection required'
      },
      training_reminder: {
        label: 'Training',
        icon: 'book-open',
        color: 'bg-green-100 text-green-800',
        description: 'Training or certification reminder'
      }
    };

    return typeInfo[type] || {
      label: 'Unknown',
      icon: 'help-circle',
      color: 'bg-gray-100 text-gray-800',
      description: 'Unknown alert type'
    };
  }

  getPriorityInfo(priority: string): {
    label: string;
    color: string;
    icon: string;
    bgColor: string;
  } {
    const priorityInfo: Record<string, { label: string; color: string; icon: string; bgColor: string }> = {
      low: {
        label: 'Low',
        color: 'text-gray-600',
        icon: 'minus',
        bgColor: 'bg-gray-100'
      },
      medium: {
        label: 'Medium',
        color: 'text-blue-600',
        icon: 'circle',
        bgColor: 'bg-blue-100'
      },
      high: {
        label: 'High',
        color: 'text-orange-600',
        icon: 'alert-triangle',
        bgColor: 'bg-orange-100'
      },
      urgent: {
        label: 'Urgent',
        color: 'text-red-600',
        icon: 'alert-triangle',
        bgColor: 'bg-red-100'
      },
      critical: {
        label: 'Critical',
        color: 'text-red-700',
        icon: 'alert-octagon',
        bgColor: 'bg-red-200'
      }
    };

    return priorityInfo[priority] || priorityInfo.medium;
  }

  formatTimeAgo(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
    return `${Math.floor(diffInMinutes / 1440)}d ago`;
  }

  isUrgent(alert: StaffAlert): boolean {
    return ['urgent', 'critical'].includes(alert.priority);
  }

  requiresImmediate(alert: StaffAlert): boolean {
    return alert.priority === 'critical' || alert.requiresImmediate === true;
  }

  isExpiringSoon(alert: StaffAlert): boolean {
    if (!alert.expiresAt) return false;
    const expiresAt = new Date(alert.expiresAt);
    const now = new Date();
    const diffInMinutes = Math.floor((expiresAt.getTime() - now.getTime()) / (1000 * 60));
    return diffInMinutes <= 30; // Expiring within 30 minutes
  }
}

export const staffAlertService = new StaffAlertService();