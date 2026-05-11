import { api } from './api';
import { User } from '../types/auth';

interface UpdateProfileData {
  name?: string;
  phone?: string;
  preferences?: {
    bedType?: string;
    floor?: string;
    smokingAllowed?: boolean;
    other?: string;
  };
}

interface ChangePasswordData {
  currentPassword: string;
  newPassword: string;
}

class UserService {
  async updateProfile(data: UpdateProfileData): Promise<{ status: string; user: User }> {
    try {
      const response = await api.patch('/auth/profile', data);
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  async changePassword(data: ChangePasswordData): Promise<{ status: string; message: string }> {
    try {
      const response = await api.patch('/auth/change-password', data);
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  async getCurrentUser(): Promise<User> {
    try {
      const response = await api.get('/auth/me');
      return response.data.user;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }
}

export const userService = new UserService();
