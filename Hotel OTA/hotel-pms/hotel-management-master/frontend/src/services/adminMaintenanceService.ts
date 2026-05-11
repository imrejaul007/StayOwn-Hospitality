import { ApiResponse } from '../types/api';
import { api } from './api';

export interface MaintenanceTask {
  _id: string;
  title: string;
  description: string;
  type: 'plumbing' | 'electrical' | 'hvac' | 'cleaning' | 'carpentry' | 'painting' | 'appliance' | 'safety' | 'other';
  category: 'preventive' | 'corrective' | 'emergency' | 'inspection';
  priority: 'low' | 'medium' | 'high' | 'urgent' | 'emergency';
  status: 'pending' | 'assigned' | 'in_progress' | 'completed' | 'cancelled' | 'on_hold';
  roomId?: { _id: string; roomNumber: string; type: string };
  assignedToUserId?: { _id: string; name: string; email: string };
  estimatedDuration?: number;
  estimatedCost?: number;
  actualCost?: number;
  startedAt?: string;
  completedAt?: string;
  actualDuration?: number;
  notes?: string;
  hotelId: string;
  createdAt: string;
  updatedAt: string;
  materials?: Material[];
  vendorRequired?: boolean;
  vendor?: { name: string; contact?: string; cost?: number };
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
}

export interface Material {
  name: string;
  quantity: number;
  unitCost?: number;
  supplier?: string;
}

export interface CreateMaintenanceTaskData {
  title: string;
  description: string;
  type: 'plumbing' | 'electrical' | 'hvac' | 'cleaning' | 'carpentry' | 'painting' | 'appliance' | 'safety' | 'other';
  category: 'preventive' | 'corrective' | 'emergency' | 'inspection';
  priority: 'low' | 'medium' | 'high' | 'urgent' | 'emergency';
  roomId?: string;
  assignedToUserId?: string;
  estimatedDuration?: number;
  estimatedCost?: number;
  notes?: string;
  materials?: Material[];
  hotelId?: string;
}

export interface MaintenanceFilters {
  status?: string;
  type?: string;
  priority?: string;
  roomId?: string;
  assignedToUserId?: string;
  hotelId?: string;
  page?: number;
  limit?: number;
}

class AdminMaintenanceService {
  private basePath = '/maintenance';
  private hotelIdCache: string | null = null;
  private hotelIdCacheExpiry: number = 0;

  private async apiRequest<T>(endpoint: string, options: { method?: string; data?: Record<string, unknown>; basePath?: string } = {}): Promise<ApiResponse<T>> {
    try {
      // Properly handle basePath - empty string should override the default
      const basePath = options.basePath !== undefined ? options.basePath : this.basePath;
      const url = `${basePath}${endpoint}`;

      let response;
      const method = (options.method || 'GET').toUpperCase();

      switch (method) {
        case 'POST':
          response = await api.post(url, options.data);
          break;
        case 'PUT':
          response = await api.put(url, options.data);
          break;
        case 'PATCH':
          response = await api.patch(url, options.data);
          break;
        case 'DELETE':
          response = await api.delete(url);
          break;
        default:
          response = await api.get(url);
          break;
      }

      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  private roomsCache: Array<{ _id: string; roomNumber: string; type: string; floor?: string }> = [];
  private roomsCacheHotelId: string | null = null;

  async getTasks(filters: MaintenanceFilters = {}): Promise<ApiResponse<{ tasks: MaintenanceTask[]; pagination: { page: number; limit: number; total: number; pages: number } }>> {
    const queryParams = new URLSearchParams();

    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        queryParams.append(key, value.toString());
      }
    });

    const queryString = queryParams.toString();
    const endpoint = queryString ? `?${queryString}` : '';

    // Fetch available rooms to create a lookup cache if needed
    // Invalidate cache when switching hotels
    const cacheHotelId = filters.hotelId || null;
    if (cacheHotelId && (this.roomsCache.length === 0 || this.roomsCacheHotelId !== cacheHotelId)) {
      try {
        const roomsResponse = await this.getAvailableRooms(cacheHotelId);
        this.roomsCache = roomsResponse.data;
        this.roomsCacheHotelId = cacheHotelId;
      } catch (error) {
        this.roomsCache = [];
        this.roomsCacheHotelId = cacheHotelId;
      }
    }

    const response = await this.apiRequest(endpoint);

    // Transform backend data to match frontend interface
    if (response.data && response.data.tasks) {
      response.data.tasks = response.data.tasks.map((task: Record<string, unknown>) => {
        // Map room ID to room details from cache
        let roomDetails = null;
        if (task.roomId) {
          if (typeof task.roomId === 'string') {
            // If roomId is just a string ID, look it up in cache
            const cachedRoom = this.roomsCache.find(room => room._id === task.roomId);
            if (cachedRoom) {
              roomDetails = {
                _id: cachedRoom._id,
                roomNumber: cachedRoom.roomNumber,
                type: cachedRoom.type
              };
            } else {
              // If not in cache, create a fallback with just the ID
              roomDetails = {
                _id: task.roomId,
                roomNumber: `Room ${task.roomId.slice(-4)}`, // Use last 4 chars of ID as fallback
                type: 'Unknown'
              };
            }
          } else if (task.roomId && typeof task.roomId === 'object') {
            // If roomId is an object, use its data or enhance with cache
            const cachedRoom = this.roomsCache.find(room => room._id === task.roomId._id);

            roomDetails = {
              _id: task.roomId._id,
              roomNumber: task.roomId.roomNumber || task.roomId.number || cachedRoom?.roomNumber || `Room ${task.roomId._id?.slice(-4) || 'Unknown'}`,
              type: task.roomId.type || cachedRoom?.type || 'Unknown'
            };
          }
        }

        const transformedTask = {
          ...task,
          // Maintain backend field names
          type: task.type || 'other',
          category: task.category || 'corrective',
          assignedToUserId: task.assignedTo ? {
            _id: task.assignedTo._id,
            name: task.assignedTo.name,
            email: task.assignedTo.email || ''
          } : undefined,
          roomId: roomDetails,
          // Ensure required fields have default values
          title: task.title || 'Untitled Task',
          description: task.description || 'No description provided',
          priority: task.priority || 'medium',
          status: task.status || 'pending',
          estimatedDuration: task.estimatedDuration || 60,
          startedAt: task.startedAt || task.startedDate,
          completedAt: task.completedAt || task.completedDate
        };
        return transformedTask;
      });
    }

    return response;
  }

  async getTaskById(taskId: string): Promise<ApiResponse<MaintenanceTask>> {
    return this.apiRequest(`/${taskId}`);
  }

  private async getUserHotelId(): Promise<string> {
    // Check cache first (cache for 10 minutes)
    const now = Date.now();
    if (this.hotelIdCache && now < this.hotelIdCacheExpiry) {
      return this.hotelIdCache;
    }

    // Get hotelId from user profile API using the configured api instance
    try {
      const response = await api.get('/auth/me');
      const userData = response.data?.user;

      if (userData?.hotelId) {
        // hotelId may be a populated object { _id, name, ... } or a plain string
        const hotelId = typeof userData.hotelId === 'object' && userData.hotelId._id
          ? String(userData.hotelId._id)
          : String(userData.hotelId);
        this.hotelIdCache = hotelId;
        this.hotelIdCacheExpiry = now + 10 * 60 * 1000;
        return hotelId;
      }
    } catch {
      // Error handled silently
    }

    throw new Error('Unable to determine hotel ID for this user');
  }

  async createTask(taskData: CreateMaintenanceTaskData): Promise<ApiResponse<MaintenanceTask>> {
    // Get hotelId from cache or token
    const userHotelId = await this.getUserHotelId();

    // Validate required fields before sending
    if (!taskData.title || !taskData.type || !taskData.priority) {
      throw new Error('Missing required fields: title, type, and priority are required');
    }

    // Transform frontend data to match backend interface
    const backendData = {
      ...taskData,
      hotelId: taskData.hotelId || userHotelId, // Use provided hotelId or fall back to user's primary
      assignedTo: taskData.assignedToUserId, // Frontend uses 'assignedToUserId', backend expects 'assignedTo'
      // Ensure required fields have valid values
      title: String(taskData.title).trim(),
      type: taskData.type,
      priority: taskData.priority,
      category: taskData.category || 'corrective', // Ensure category has a valid default
      estimatedDuration: Number(taskData.estimatedDuration) || 60,
      estimatedCost: Number(taskData.estimatedCost) || 0,
    };

    // Remove frontend-specific fields and undefined values
    delete backendData.assignedToUserId;

    // Clean up undefined or empty string values for optional fields
    if (!backendData.roomId) delete backendData.roomId;
    if (!backendData.assignedTo) delete backendData.assignedTo;
    if (!backendData.description) delete backendData.description;
    if (!backendData.notes) delete backendData.notes;

    return this.apiRequest('/', {
      method: 'POST',
      data: backendData,
    });
  }

  async updateTask(taskId: string, updates: Partial<MaintenanceTask>): Promise<ApiResponse<MaintenanceTask>> {
    // Transform frontend data to match backend interface
    const backendUpdates: Record<string, unknown> = { ...updates };

    if (updates.assignedToUserId) {
      backendUpdates.assignedTo = updates.assignedToUserId;
      delete backendUpdates.assignedToUserId;
    }

    return this.apiRequest(`/${taskId}`, {
      method: 'PATCH',
      data: backendUpdates,
    });
  }

  async assignTask(taskId: string, assignedToUserId: string, notes?: string): Promise<ApiResponse<MaintenanceTask>> {
    return this.apiRequest(`/${taskId}/assign`, {
      method: 'POST',
      data: { assignedTo: assignedToUserId, notes },
    });
  }

  async getStats(hotelId?: string): Promise<ApiResponse<MaintenanceStats>> {
    // Use provided hotelId or get from cache/token
    const targetHotelId = hotelId || await this.getUserHotelId();

    const queryParams = new URLSearchParams();
    queryParams.append('hotelId', targetHotelId);
    const endpoint = `/stats?${queryParams.toString()}`;
    return this.apiRequest(endpoint);
  }

  async getOverdueTasks(hotelId?: string): Promise<ApiResponse<MaintenanceTask[]>> {
    // Use provided hotelId or fetch dynamically
    const targetHotelId = hotelId || await this.getUserHotelId();

    const queryParams = new URLSearchParams();
    if (targetHotelId) {
      queryParams.append('hotelId', targetHotelId);
    }
    const queryString = queryParams.toString();
    const endpoint = queryString ? `/overdue?${queryString}` : '/overdue';
    return this.apiRequest(endpoint);
  }

  async getUpcomingRecurring(): Promise<ApiResponse<MaintenanceTask[]>> {
    return this.apiRequest('/recurring/upcoming');
  }

  // Get available staff members for assignment
  async getAvailableStaff(hotelId?: string): Promise<ApiResponse<Array<{ _id: string; name: string; email: string; department?: string }>>> {
    // Use provided hotelId or get from cache/token
    const targetHotelId = hotelId || await this.getUserHotelId();

    const queryParams = new URLSearchParams();
    queryParams.append('hotelId', targetHotelId);
    const endpoint = `/available-staff?${queryParams.toString()}`;
    return this.apiRequest(endpoint);
  }

  // Get available rooms
  async getAvailableRooms(hotelId?: string): Promise<ApiResponse<Array<{ _id: string; roomNumber: string; type: string; floor?: string }>>> {
    // Use provided hotelId or get from cache/token
    const targetHotelId = hotelId || await this.getUserHotelId();

    const queryParams = new URLSearchParams();
    queryParams.append('hotelId', targetHotelId);
    const endpoint = `/available-rooms?${queryParams.toString()}`;
    return this.apiRequest(endpoint);
  }

  // Bulk operations
  async bulkUpdateStatus(taskIds: string[], status: string): Promise<ApiResponse<{ updated: number }>> {
    return this.apiRequest('/bulk/status', {
      method: 'PATCH',
      data: { taskIds, status },
    });
  }

  async bulkAssign(taskIds: string[], assignedToUserId: string): Promise<ApiResponse<{ updated: number }>> {
    return this.apiRequest('/bulk/assign', {
      method: 'PATCH',
      data: { taskIds, assignedToUserId },
    });
  }
}

export const adminMaintenanceService = new AdminMaintenanceService();