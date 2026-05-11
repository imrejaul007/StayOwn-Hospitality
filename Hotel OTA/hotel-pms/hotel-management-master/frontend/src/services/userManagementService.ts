import { api } from './api';

export interface CreateUserData {
  name: string;
  email: string;
  phone?: string;
  password: string;
  role: 'admin' | 'manager' | 'staff';
  hotelId?: string;
  department?: string;
  employeeId?: string;
  isActive?: boolean;
  sendWelcomeEmail?: boolean;
  // Multi-property
  properties?: string[];
  primaryProperty?: string;
  multiPropertyAccess?: {
    enabled: boolean;
    canCreateProperties: boolean;
    canDeleteProperties: boolean;
    canManageGroups: boolean;
  };
}

export interface UpdateUserData {
  name?: string;
  email?: string;
  phone?: string;
  password?: string;
  role?: 'admin' | 'manager' | 'staff';
  department?: string;
  employeeId?: string;
  isActive?: boolean;
  properties?: string[];
  primaryProperty?: string;
  multiPropertyAccess?: {
    enabled: boolean;
    canCreateProperties: boolean;
    canDeleteProperties: boolean;
    canManageGroups: boolean;
  };
}

export interface UserFilters {
  role?: string;
  isActive?: boolean;
  hotelId?: string;
  search?: string;
  page?: number;
  limit?: number;
}

class UserManagementService {
  /**
   * Create new user
   */
  async createUser(data: CreateUserData) {
    try {
      const response = await api.post('/users/create', data);
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  /**
   * Update existing user
   */
  async updateUser(userId: string, data: UpdateUserData) {
    try {
      const response = await api.put(`/users/${userId}`, data);
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  /**
   * Delete user (soft delete - sets isActive to false)
   */
  async deleteUser(userId: string) {
    try {
      const response = await api.delete(`/users/${userId}`);
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  /**
   * Get list of users with filters
   */
  async getUsers(filters?: UserFilters) {
    try {
      const response = await api.get('/users', {
        params: filters
      });
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  /**
   * Get single user by ID
   */
  async getUserById(userId: string) {
    try {
      const response = await api.get(`/users/${userId}`);
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  /**
   * Generate temporary password
   */
  async generatePassword() {
    try {
      const response = await api.get('/users/generate-password');
      return response.data.data.password;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }
}

export default new UserManagementService();
