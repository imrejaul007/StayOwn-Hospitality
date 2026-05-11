import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { User } from '../types/auth';
import { authService } from '../services/authService';
import toast from 'react-hot-toast';

/** Shared React Query cache key — PropertyContext reads the same key (no second `/auth/me`). */
export const AUTH_ME_QUERY_KEY = ['auth-me'] as const;

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<{ user: User }>;
  register: (userData: RegisterData) => Promise<void>;
  logout: () => void;
  updateUser: (userData: User) => void;
  isAuthenticated: boolean;
  hasRole: (roles: string[]) => boolean;
}

interface RegisterData {
  name: string;
  email: string;
  password: string;
  phone?: string;
  role?: string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    initializeAuth();
  }, []);

  const initializeAuth = async () => {
    try {
      const userData = await queryClient.fetchQuery({
        queryKey: AUTH_ME_QUERY_KEY,
        queryFn: () => authService.getCurrentUser(),
        staleTime: 5 * 60 * 1000
      });
      setUser(userData);
    } catch (error: unknown) {
      setUser(null);
      queryClient.removeQueries({ queryKey: AUTH_ME_QUERY_KEY });
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    try {
      const { user: userData } = await authService.login({ email, password });
      setUser(userData);
      queryClient.setQueryData(AUTH_ME_QUERY_KEY, userData);
      toast.success('Login successful!');
      return { user: userData };
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } }; message?: string };
      const message = err.response?.data?.message || 'Login failed';
      toast.error(message);
      throw error;
    }
  };

  const register = async (userData: RegisterData) => {
    try {
      const { user: newUser } = await authService.register(userData);
      // Token is set as httpOnly cookie by the server automatically
      setUser(newUser);
      toast.success('Registration successful!');
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } }; message?: string };
      const message = err.response?.data?.message || 'Registration failed';
      toast.error(message);
      throw error;
    }
  };

  const logout = async () => {
    try {
      await authService.logout();
    } catch {
      // Logout even if server call fails
    }
    localStorage.removeItem('selectedPropertyId');
    setUser(null);
    queryClient.removeQueries({ queryKey: AUTH_ME_QUERY_KEY });
    toast.success('Logged out successfully');
  };

  const isAuthenticated = !!user;

  const hasRole = (roles: string[]): boolean => {
    return user ? roles.includes(user.role) : false;
  };

  const updateUser = (userData: User) => {
    setUser(userData);
    queryClient.setQueryData(AUTH_ME_QUERY_KEY, userData);
  };

  const value = {
    user,
    isLoading,
    login,
    register,
    logout,
    updateUser,
    isAuthenticated,
    hasRole,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}