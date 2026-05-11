import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from '../../context/AuthContext';

// Mock authService
vi.mock('../../services/authService', () => ({
  authService: {
    login: vi.fn(),
    register: vi.fn(),
    getCurrentUser: vi.fn(),
    switchHotel: vi.fn(),
    logout: vi.fn(),
  },
}));

// Mock react-hot-toast
vi.mock('react-hot-toast', () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const TestComponent = () => {
  const { user, login, logout, isLoading, isAuthenticated } = useAuth();

  return (
    <div>
      <div data-testid="user-info">
        {user ? user.name : 'No user'}
      </div>
      <div data-testid="loading">{isLoading ? 'Loading' : 'Not loading'}</div>
      <div data-testid="authenticated">{isAuthenticated ? 'Yes' : 'No'}</div>
      <button onClick={() => login('test@example.com', 'password')}>
        Login
      </button>
      <button onClick={logout}>Logout</button>
    </div>
  );
};

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      {ui}
    </QueryClientProvider>
  );
}

describe('AuthContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('should provide initial state', async () => {
    const { authService } = await import('../../services/authService');
    vi.mocked(authService.getCurrentUser).mockRejectedValue(new Error('No session'));

    renderWithProviders(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('Not loading');
    });

    expect(screen.getByTestId('user-info')).toHaveTextContent('No user');
    expect(screen.getByTestId('authenticated')).toHaveTextContent('No');
  });

  it('should handle successful login', async () => {
    const { authService } = await import('../../services/authService');
    const mockUser = {
      _id: '123',
      name: 'Test User',
      email: 'test@example.com',
      role: 'guest' as const,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    vi.mocked(authService.getCurrentUser).mockRejectedValue(new Error('No session'));
    vi.mocked(authService.login).mockResolvedValue({
      status: 'success',
      user: mockUser,
    });

    renderWithProviders(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('Not loading');
    });

    fireEvent.click(screen.getByText('Login'));

    await waitFor(() => {
      expect(screen.getByTestId('user-info')).toHaveTextContent('Test User');
    });

    expect(screen.getByTestId('authenticated')).toHaveTextContent('Yes');
  });

  it('should handle login failure', async () => {
    const { authService } = await import('../../services/authService');
    vi.mocked(authService.getCurrentUser).mockRejectedValue(new Error('No session'));
    vi.mocked(authService.login).mockRejectedValue({
      response: { data: { message: 'Invalid credentials' } },
    });

    renderWithProviders(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('Not loading');
    });

    fireEvent.click(screen.getByText('Login'));

    await waitFor(() => {
      expect(screen.getByTestId('user-info')).toHaveTextContent('No user');
    });
  });

  it('should handle logout', async () => {
    const { authService } = await import('../../services/authService');
    const mockUser = {
      _id: '123',
      name: 'Test User',
      email: 'test@example.com',
      role: 'guest' as const,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    vi.mocked(authService.getCurrentUser).mockRejectedValue(new Error('No session'));
    vi.mocked(authService.login).mockResolvedValue({
      status: 'success',
      user: mockUser,
    });
    vi.mocked(authService.logout).mockResolvedValue();

    renderWithProviders(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('Not loading');
    });

    fireEvent.click(screen.getByText('Login'));

    await waitFor(() => {
      expect(screen.getByTestId('user-info')).toHaveTextContent('Test User');
    });

    fireEvent.click(screen.getByText('Logout'));

    await waitFor(() => {
      expect(screen.getByTestId('user-info')).toHaveTextContent('No user');
      expect(screen.getByTestId('authenticated')).toHaveTextContent('No');
    });
  });

  it('should restore session from cookie on mount', async () => {
    const { authService } = await import('../../services/authService');
    const mockUser = {
      _id: '123',
      name: 'Test User',
      email: 'test@example.com',
      role: 'admin' as const,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    vi.mocked(authService.getCurrentUser).mockResolvedValue(mockUser);

    renderWithProviders(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('user-info')).toHaveTextContent('Test User');
      expect(screen.getByTestId('authenticated')).toHaveTextContent('Yes');
    });
  });
});
