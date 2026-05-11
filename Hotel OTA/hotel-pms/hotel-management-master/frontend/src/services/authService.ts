import { api } from './api';
import { User, AuthResponse } from '../types/auth';

interface RegisterData {
  name: string;
  email: string;
  password: string;
  phone?: string;
  role?: string;
}

interface LoginData {
  email: string;
  password: string;
}

class AuthService {
  private normalizeAuthPayload(payload: unknown): AuthResponse {
    const responseData = payload as {
      status?: string;
      token?: string;
      user?: User;
      data?: { user?: User; token?: string; status?: string };
    };

    const nested = responseData?.data || {};
    const user = responseData?.user || nested.user;
    const token = responseData?.token || nested.token;
    const status = responseData?.status || nested.status || 'success';

    if (!user) {
      throw new Error('Invalid authentication response: missing user');
    }

    return { status, token, user };
  }

  async login(data: LoginData): Promise<AuthResponse> {
    try {
      const response = await api.post('/auth/login', data);
      return this.normalizeAuthPayload(response.data);
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  async register(data: RegisterData): Promise<AuthResponse> {
    try {
      const response = await api.post('/auth/register', data);
      return this.normalizeAuthPayload(response.data);
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  async getCurrentUser(): Promise<User> {
    try {
      const response = await api.get('/auth/me');
      return this.normalizeAuthPayload(response.data).user;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  async switchHotel(hotelId: string): Promise<AuthResponse> {
    try {
      const response = await api.post('/auth/switch-hotel', { hotelId });
      return this.normalizeAuthPayload(response.data);
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  async logout(): Promise<void> {
    try {
      await api.post('/auth/logout');
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }
}

export const authService = new AuthService();
