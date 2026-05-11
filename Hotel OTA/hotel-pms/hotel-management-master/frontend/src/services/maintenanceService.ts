import { ApiResponse } from '../types/dashboard';
import { api, normalizeListParams } from './api';

export interface MaintenanceTask {
  _id: string;
  title: string;
  description: string;
  type: 'plumbing' | 'electrical' | 'hvac' | 'cleaning' | 'carpentry' | 'painting' | 'appliance' | 'safety' | 'other';
  priority: 'low' | 'medium' | 'high' | 'urgent' | 'emergency';
  status: 'pending' | 'assigned' | 'in_progress' | 'completed' | 'cancelled' | 'on_hold';
  category?: 'preventive' | 'corrective' | 'emergency' | 'inspection';
  assignedTo?: {
    _id: string;
    name: string;
  };
  reportedBy: {
    _id: string;
    name: string;
  };
  roomId?: {
    _id: string;
    roomNumber: string;
    type: string;
  };
  dueDate?: string;
  createdAt: string;
  updatedAt: string;
  startedDate?: string;
  completedDate?: string;
  isOverdue?: boolean;
  estimatedDuration?: number;
  actualDuration?: number;
  estimatedCost?: number;
  actualCost?: number;
}

export interface MaintenancePaginatedResponse {
  status: string;
  data: {
    tasks: MaintenanceTask[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      pages: number;
    };
  };
}

export interface GroupedTasks {
  urgent: MaintenanceTask[];
  pending: MaintenanceTask[];
  inProgress: MaintenanceTask[];
  completed: MaintenanceTask[];
  urgentTotal: number;
  pendingTotal: number;
  inProgressTotal: number;
  completedTotal: number;
}

export interface MaintenanceStats {
  total: number;
  pending: number;
  assigned: number;
  inProgress: number;
  completed: number;
  cancelled: number;
  avgDuration: number;
  overdueCount: number;
  byType?: unknown;
  overdueTasks?: number;
  upcomingRecurring?: number;
  overdueDetails?: MaintenanceTask[];
  upcomingDetails?: MaintenanceTask[];
}

class MaintenanceService {
  private baseURL = '/maintenance';

  // Get maintenance tasks with filters — returns full paginated response
  async getTasks(params: {
    page?: number;
    limit?: number;
    status?: string;
    type?: string;
    priority?: string;
    overdue?: boolean;
  } = {}): Promise<MaintenancePaginatedResponse> {
    try {
      const normalizedParams = normalizeListParams(params);
      const queryParams = new URLSearchParams();
      if (normalizedParams.page) queryParams.append('page', normalizedParams.page.toString());
      if (normalizedParams.limit) queryParams.append('limit', normalizedParams.limit.toString());
      if (normalizedParams.status) queryParams.append('status', normalizedParams.status);
      if (normalizedParams.type) queryParams.append('type', normalizedParams.type);
      if (normalizedParams.priority) queryParams.append('priority', normalizedParams.priority);
      if (normalizedParams.overdue) queryParams.append('overdue', 'true');

      const endpoint = queryParams.toString() ? `?${queryParams.toString()}` : '';
      const response = await api.get(`${this.baseURL}${endpoint}`);
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  // Get maintenance statistics
  async getStats() {
    try {
      const response = await api.get(`${this.baseURL}/stats`);
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  // Get overdue tasks
  async getOverdueTasks() {
    try {
      const response = await api.get(`${this.baseURL}/overdue`);
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  // Get task by ID
  async getTask(id: string) {
    try {
      const response = await api.get(`${this.baseURL}/${id}`);
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  // Create new maintenance task
  async createTask(taskData: {
    title: string;
    description?: string;
    type: string;
    priority: string;
    roomId?: string;
    dueDate?: string;
    estimatedDuration?: number;
    estimatedCost?: number;
    category?: string;
    roomOutOfOrder?: boolean;
  }) {
    try {
      const response = await api.post(`${this.baseURL}`, taskData);
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  // Update task
  async updateTask(id: string, updates: {
    status?: string;
    assignedTo?: string;
    scheduledDate?: string;
    actualDuration?: number;
    actualCost?: number;
    completionNotes?: string;
    priority?: string;
  }) {
    try {
      const response = await api.patch(`${this.baseURL}/${id}`, updates);
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  // Assign task
  async assignTask(id: string, data: {
    assignedTo: string;
    scheduledDate?: string;
    notes?: string;
  }) {
    try {
      const response = await api.post(`${this.baseURL}/${id}/assign`, data);
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  /**
   * Get tasks for staff dashboard (grouped by status).
   * Urgent   = assigned OR pending tasks with emergency/urgent priority.
   * Pending  = non-urgent pending/assigned tasks the current staff can pick up.
   * In Progress = tasks currently being worked on by this staff member.
   * Completed   = recently completed tasks, paginated.
   *
   * The backend already scopes pending tasks to the hotel and in_progress/assigned
   * tasks to the current staff member, so four parallel requests are sufficient.
   */
  async getTasksGrouped(completedPage = 1): Promise<GroupedTasks> {
    const [pendingResult, assignedResult, inProgressResult, completedResult] = await Promise.allSettled([
      // Pending tasks (hotel-wide — staff can self-assign and start any of these)
      this.getTasks({ status: 'pending', limit: 20 }),
      // Assigned tasks (scoped to this staff member on the backend)
      this.getTasks({ status: 'assigned', limit: 20 }),
      // In-progress tasks (scoped to this staff member on the backend)
      this.getTasks({ status: 'in_progress', limit: 20 }),
      // Completed tasks, paginated
      this.getTasks({ status: 'completed', limit: 10, page: completedPage }),
    ]);

    // If ALL requests failed, surface the error so the page can show an error state.
    const allFailed =
      pendingResult.status === 'rejected' &&
      assignedResult.status === 'rejected' &&
      inProgressResult.status === 'rejected' &&
      completedResult.status === 'rejected';
    if (allFailed) {
      throw (pendingResult as PromiseRejectedResult).reason instanceof Error
        ? (pendingResult as PromiseRejectedResult).reason
        : new Error('Failed to load maintenance tasks');
    }

    // Partial failures: treat the failed slice as empty so the rest of the dashboard stays visible.
    const pendingRes    = pendingResult.status    === 'fulfilled' ? pendingResult.value    : null;
    const assignedRes   = assignedResult.status   === 'fulfilled' ? assignedResult.value   : null;
    const inProgressRes = inProgressResult.status === 'fulfilled' ? inProgressResult.value : null;
    const completedRes  = completedResult.status  === 'fulfilled' ? completedResult.value  : null;

    const pendingTasks: MaintenanceTask[]    = pendingRes?.data?.tasks    || [];
    const assignedTasks: MaintenanceTask[]   = assignedRes?.data?.tasks   || [];
    const inProgressTasks: MaintenanceTask[] = inProgressRes?.data?.tasks || [];

    // Urgent = emergency/urgent priority from both pending AND assigned pools, deduplicated
    const urgentPriorities = new Set(['emergency', 'urgent']);
    const urgentFromAssigned = assignedTasks.filter(t => urgentPriorities.has(t.priority));
    const urgentFromPending = pendingTasks.filter(t => urgentPriorities.has(t.priority));
    const seenUrgentIds = new Set(urgentFromAssigned.map(t => t._id));
    const mergedUrgent = [
      ...urgentFromAssigned,
      ...urgentFromPending.filter(t => !seenUrgentIds.has(t._id))
    ];

    // Pending list = non-urgent pending/assigned tasks (excluding those already shown as urgent)
    const urgentIds = new Set(mergedUrgent.map(t => t._id));
    const filteredPending = [
      ...pendingTasks.filter(t => !urgentIds.has(t._id)),
      ...assignedTasks.filter(t => !urgentIds.has(t._id))
    ];

    // Dedup filteredPending in case same task appears in both lists (shouldn't happen but defensive)
    const seenPendingIds = new Set<string>();
    const dedupedPending = filteredPending.filter(t => {
      if (seenPendingIds.has(t._id)) return false;
      seenPendingIds.add(t._id);
      return true;
    });

    const pendingTotal = (pendingRes?.data?.pagination?.total ?? 0) +
      (assignedRes?.data?.pagination?.total ?? 0) -
      mergedUrgent.length;

    return {
      urgent: mergedUrgent.slice(0, 10),
      pending: dedupedPending,
      inProgress: inProgressTasks,
      completed: completedRes?.data?.tasks || [],
      urgentTotal: mergedUrgent.length,
      pendingTotal: Math.max(0, pendingTotal),
      inProgressTotal: inProgressRes?.data?.pagination?.total ?? 0,
      completedTotal: completedRes?.data?.pagination?.total ?? 0,
    };
  }

  /**
   * Start a maintenance task.
   * - If task is already `assigned` (to the current user): move to `in_progress`.
   * - If task is `pending` (unassigned): the backend supports a shortcut
   *   pending → in_progress that self-assigns the caller automatically.
   * Both cases send `status: 'in_progress'`; the backend handles the self-assign.
   */
  async startTask(id: string) {
    return this.updateTask(id, { status: 'in_progress' });
  }

  // Complete task
  async completeTask(id: string, completionData?: {
    actualDuration?: number;
    actualCost?: number;
    completionNotes?: string;
  }) {
    return this.updateTask(id, {
      status: 'completed',
      ...completionData,
    });
  }
}

export const maintenanceService = new MaintenanceService();
