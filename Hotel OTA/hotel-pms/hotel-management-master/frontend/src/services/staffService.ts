import { api } from './api';

export interface StaffMember {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  role: 'admin' | 'manager' | 'staff' | 'frontdesk' | 'housekeeping';
  isActive: boolean;
  hotelId: {
    _id: string;
    name: string;
  };
  createdAt: string;
  lastLogin?: string;
}

export interface CreateStaffData {
  name: string;
  email: string;
  phone?: string;
  password: string;
  role: 'admin' | 'manager' | 'staff' | 'frontdesk' | 'housekeeping';
}

export interface UpdateStaffData {
  name?: string;
  phone?: string;
  role?: 'admin' | 'manager' | 'staff' | 'frontdesk' | 'housekeeping';
  isActive?: boolean;
}

export interface StaffQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  hotelId?: string;
  role?: 'admin' | 'manager' | 'staff' | 'frontdesk' | 'housekeeping';
  isActive?: boolean;
}

export interface StaffResponse {
  staff: StaffMember[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

class StaffService {
  // Get all staff members with filtering and pagination
  async getStaffMembers(params: StaffQueryParams = {}): Promise<StaffResponse> {
    try {
      const queryParams = new URLSearchParams();

      // Always send page and limit for server-side pagination
      queryParams.append('page', (params.page ?? 1).toString());
      queryParams.append('limit', (params.limit ?? 20).toString());

      if (params.search) queryParams.append('search', params.search);
      if (params.hotelId) queryParams.append('hotelId', params.hotelId);

      // For staff management, always filter by role unless explicitly specified
      // This ensures we only get staff and admin users, never guests
      if (params.role) {
        queryParams.append('role', params.role);
      }

      if (params.isActive !== undefined) queryParams.append('isActive', params.isActive.toString());

      const response = await api.get(`/admin/users?${queryParams.toString()}`);

      // Filter out any guest users that might have slipped through (extra safety)
      const staffRoles = ['admin', 'manager', 'staff', 'frontdesk', 'housekeeping'];
      const users = Array.isArray(response.data?.data?.users) ? response.data.data.users : [];
      const staffUsers = users.filter((user: StaffMember) =>
        staffRoles.includes(user.role)
      );

      const paginationData = response.data?.data?.pagination;

      return {
        staff: staffUsers,
        pagination: paginationData ?? { page: 1, limit: 20, total: 0, pages: 1 }
      };
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  // Get a specific staff member by ID
  async getStaffMember(id: string): Promise<StaffMember> {
    try {
      const response = await api.get(`/admin/users/${id}`);
      return response.data.data.user;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  // Create a new staff member
  async createStaffMember(data: CreateStaffData): Promise<StaffMember> {
    try {
      const response = await api.post('/admin/users', data);
      return response.data.data.user;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  // Update a staff member
  async updateStaffMember(id: string, data: UpdateStaffData): Promise<StaffMember> {
    try {
      const response = await api.patch(`/admin/users/${id}`, data);
      return response.data.data.user;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  // Delete a staff member
  async deleteStaffMember(id: string): Promise<void> {
    try {
      await api.delete(`/admin/users/${id}`);
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  // Get staff statistics using paginated endpoint (avoids unbounded fetch)
  async getStaffStats(hotelId?: string): Promise<{
    total: number;
    active: number;
    inactive: number;
    admins: number;
    regularStaff: number;
  }> {
    try {
      // Use separate paginated calls with limit=1 to get counts efficiently
      const queryBase = new URLSearchParams();
      queryBase.append('limit', '1');
      if (hotelId) queryBase.append('hotelId', hotelId);

      const activeParams = new URLSearchParams(queryBase);
      activeParams.append('isActive', 'true');

      const inactiveParams = new URLSearchParams(queryBase);
      inactiveParams.append('isActive', 'false');

      const adminParams = new URLSearchParams(queryBase);
      adminParams.append('role', 'admin');

      const staffParams = new URLSearchParams(queryBase);
      staffParams.append('role', 'staff');

      const [allRes, activeRes, inactiveRes, adminRes, staffRes] = await Promise.all([
        api.get(`/admin/users?${queryBase.toString()}`),
        api.get(`/admin/users?${activeParams.toString()}`),
        api.get(`/admin/users?${inactiveParams.toString()}`),
        api.get(`/admin/users?${adminParams.toString()}`),
        api.get(`/admin/users?${staffParams.toString()}`),
      ]);

      return {
        total: allRes.data?.data?.pagination?.total ?? 0,
        active: activeRes.data?.data?.pagination?.total ?? 0,
        inactive: inactiveRes.data?.data?.pagination?.total ?? 0,
        admins: adminRes.data?.data?.pagination?.total ?? 0,
        regularStaff: staffRes.data?.data?.pagination?.total ?? 0,
      };
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  // Bulk operations
  async bulkUpdateStatus(ids: string[], isActive: boolean): Promise<void> {
    await Promise.all(
      ids.map(id => this.updateStaffMember(id, { isActive }))
    );
  }

  async bulkDelete(ids: string[]): Promise<void> {
    await Promise.all(
      ids.map(id => this.deleteStaffMember(id))
    );
  }
}

export const staffService = new StaffService();
