import { api } from './api';

// Enhanced interfaces for staff supervision
export interface SupervisionMeetUp {
  _id: string;
  title: string;
  description: string;
  status: 'pending' | 'accepted' | 'declined' | 'cancelled' | 'completed';
  type: 'casual' | 'business' | 'social' | 'networking' | 'activity';
  proposedDate: string;
  proposedTime: {
    start: string;
    end: string;
  };
  location: {
    type: 'hotel_lobby' | 'restaurant' | 'bar' | 'meeting_room' | 'outdoor' | 'other';
    name: string;
    details?: string;
  };
  requesterId: {
    _id: string;
    name: string;
    email: string;
  };
  targetUserId: {
    _id: string;
    name: string;
    email: string;
  };
  hotelId: {
    _id: string;
    name: string;
  };
  participants: {
    maxParticipants: number;
    confirmedParticipants: Array<{
      userId: string;
      name: string;
      email: string;
      confirmedAt: string;
    }>;
  };
  safety?: {
    verifiedOnly: boolean;
    publicLocation: boolean;
    hotelStaffPresent: boolean;
  };
  assignedStaff?: {
    _id: string;
    name: string;
    email: string;
  };
  supervisionStatus: 'not_required' | 'assigned' | 'in_progress' | 'completed';
  supervisionNotes?: string;
  supervisionCompletedAt?: string;
  supervision: {
    priority: {
      priority: 'high' | 'medium' | 'low';
      color: string;
      label: string;
      score: number;
      factors: string[];
    };
    safetyLevel: {
      level: 'high' | 'medium' | 'low';
      color: string;
      label: string;
      score: number;
    };
    requiresStaffPresence: boolean;
    riskFactors: string[];
  };
  createdAt: string;
  updatedAt: string;
}

export interface SupervisionMeetUpsResponse {
  meetUps: SupervisionMeetUp[];
  pagination: {
    currentPage: number;
    totalPages: number;
    totalItems: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export interface StaffAssignmentsResponse {
  assignments: SupervisionMeetUp[];
  pagination: {
    currentPage: number;
    totalPages: number;
    totalItems: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export interface SupervisionStats {
  totalMeetUps: number;
  pendingSupervision: number;
  completedSupervision: number;
  highRiskMeetUps: number;
  staffRequiredMeetUps: number;
  upcomingSupervised: number;
}

export interface SupervisionStatsResponse {
  summary: SupervisionStats;
  statusBreakdown: Array<{
    _id: string;
    count: number;
  }>;
  period: string;
  generatedAt: string;
}

export interface UrgentTasksResponse {
  urgentTasks: SupervisionMeetUp[];
  count: number;
}

export interface AssignStaffRequest {
  staffId: string;
  supervisionNotes?: string;
}

export interface UpdateSupervisionStatusRequest {
  supervisionStatus: 'not_required' | 'assigned' | 'in_progress' | 'completed';
  supervisionNotes?: string;
}

export interface ProcessAlertsResponse {
  alertsCreated: number;
  alerts: Array<{
    id: string;
    type: string;
    priority: string;
    title: string;
    meetUpId: string;
    createdAt: string;
  }>;
}

export interface SupervisionAlertStats {
  total: number;
  active: number;
  acknowledged: number;
  inProgress: number;
  resolved: number;
  critical: number;
  high: number;
}

class StaffMeetUpSupervisionService {
  /**
   * Get meet-ups requiring supervision
   */
  async getSupervisionMeetUps(params?: {
    page?: number;
    limit?: number;
    status?: string;
    priority?: string;
    safetyLevel?: string;
  }): Promise<SupervisionMeetUpsResponse> {
    try {
      const response = await api.get('/staff-meetups/supervision', { params });
      return response.data.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  /**
   * Assign staff to supervise a meet-up
   */
  async assignStaffToMeetUp(meetUpId: string, data: AssignStaffRequest): Promise<SupervisionMeetUp> {
    try {
      const response = await api.post(`/staff-meetups/${meetUpId}/assign`, data);
      return response.data.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  /**
   * Get staff member's supervision assignments
   */
  async getStaffAssignments(params?: {
    page?: number;
    limit?: number;
    status?: string;
  }): Promise<StaffAssignmentsResponse> {
    try {
      const response = await api.get('/staff-meetups/my-assignments', { params });
      return response.data.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  /**
   * Update supervision status
   */
  async updateSupervisionStatus(meetUpId: string, data: UpdateSupervisionStatusRequest): Promise<SupervisionMeetUp> {
    try {
      const response = await api.put(`/staff-meetups/${meetUpId}/supervision-status`, data);
      return response.data.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  /**
   * Get supervision statistics
   */
  async getSupervisionStats(period?: '24h' | '7d' | '30d'): Promise<SupervisionStatsResponse> {
    try {
      const response = await api.get('/staff-meetups/stats', { params: { period } });
      return response.data.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  /**
   * Get urgent supervision tasks
   */
  async getUrgentSupervisionTasks(): Promise<UrgentTasksResponse> {
    try {
      const response = await api.get('/staff-meetups/urgent');
      return response.data.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  /**
   * Process upcoming meet-ups and create supervision alerts
   */
  async processSupervisionAlerts(): Promise<ProcessAlertsResponse> {
    try {
      const response = await api.post('/staff-meetups/process-alerts');
      return response.data.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  /**
   * Get supervision alert statistics
   */
  async getSupervisionAlertStats(): Promise<SupervisionAlertStats> {
    try {
      const response = await api.get('/staff-meetups/alert-stats');
      return response.data.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  // Utility methods for UI components
  getPriorityColor(priority: string): string {
    const colors = {
      high: 'bg-red-100 text-red-800',
      medium: 'bg-yellow-100 text-yellow-800',
      low: 'bg-green-100 text-green-800'
    };
    return colors[priority as keyof typeof colors] || colors.low;
  }

  getSafetyLevelColor(level: string): string {
    const colors = {
      high: 'bg-green-100 text-green-800',
      medium: 'bg-yellow-100 text-yellow-800',
      low: 'bg-red-100 text-red-800'
    };
    return colors[level as keyof typeof colors] || colors.medium;
  }

  getSupervisionStatusColor(status: string): string {
    const colors = {
      not_required: 'bg-gray-100 text-gray-800',
      assigned: 'bg-blue-100 text-blue-800',
      in_progress: 'bg-orange-100 text-orange-800',
      completed: 'bg-green-100 text-green-800'
    };
    return colors[status as keyof typeof colors] || colors.not_required;
  }

  getSupervisionStatusLabel(status: string): string {
    const labels = {
      not_required: 'Not Required',
      assigned: 'Assigned',
      in_progress: 'In Progress',
      completed: 'Completed'
    };
    return labels[status as keyof typeof labels] || 'Unknown';
  }

  formatRiskFactors(factors: string[]): string {
    if (factors.length === 0) return 'No risk factors identified';
    if (factors.length <= 2) return factors.join(', ');
    return `${factors.slice(0, 2).join(', ')} and ${factors.length - 2} more`;
  }

  formatDateTime(dateString: string, timeRange: { start: string; end: string }): string {
    const date = new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    });
    return `${date} at ${timeRange.start} - ${timeRange.end}`;
  }

  isUpcoming(dateString: string): boolean {
    return new Date(dateString) > new Date();
  }

  getTimeUntil(dateString: string): string {
    const now = new Date();
    const date = new Date(dateString);
    const diffInMs = date.getTime() - now.getTime();
    const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
    const diffInDays = Math.floor(diffInHours / 24);

    if (diffInDays > 0) {
      return `${diffInDays} day${diffInDays > 1 ? 's' : ''}`;
    } else if (diffInHours > 0) {
      return `${diffInHours} hour${diffInHours > 1 ? 's' : ''}`;
    } else if (diffInMs > 0) {
      const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
      return `${diffInMinutes} minute${diffInMinutes > 1 ? 's' : ''}`;
    } else {
      return 'Now';
    }
  }

  shouldHighlightUrgent(supervision: SupervisionMeetUp['supervision'], proposedDate: string): boolean {
    const msUntil = new Date(proposedDate).getTime() - new Date().getTime();
    // Past meet-ups are never highlighted as urgent
    if (msUntil <= 0) return false;
    const isWithin24Hours = msUntil < 24 * 60 * 60 * 1000;
    const isHighRisk = supervision.priority.priority === 'high';
    const requiresStaff = supervision.requiresStaffPresence;

    return isWithin24Hours && (isHighRisk || requiresStaff);
  }

  getUrgencyIndicator(meetUp: SupervisionMeetUp): {
    level: 'urgent' | 'high' | 'medium' | 'low';
    color: string;
    label: string;
  } {
    const timeUntil = new Date(meetUp.proposedDate).getTime() - new Date().getTime();
    const hoursUntil = timeUntil / (1000 * 60 * 60);

    // Past meet-ups are no longer actionable — treat as low urgency
    if (hoursUntil <= 0) {
      return { level: 'low', color: 'bg-gray-400 text-white', label: 'PAST' };
    }

    if (hoursUntil < 2 && meetUp.supervision.priority.priority === 'high') {
      return { level: 'urgent', color: 'bg-red-600 text-white', label: 'URGENT' };
    } else if (hoursUntil < 4 && meetUp.supervision.requiresStaffPresence) {
      return { level: 'urgent', color: 'bg-red-600 text-white', label: 'URGENT' };
    } else if (hoursUntil < 8 && meetUp.supervision.priority.priority === 'high') {
      return { level: 'high', color: 'bg-orange-500 text-white', label: 'HIGH' };
    } else if (hoursUntil < 24 && meetUp.supervision.priority.priority === 'medium') {
      return { level: 'medium', color: 'bg-yellow-500 text-white', label: 'MEDIUM' };
    } else {
      return { level: 'low', color: 'bg-green-500 text-white', label: 'LOW' };
    }
  }
}

export const staffMeetUpSupervisionService = new StaffMeetUpSupervisionService();