import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useErrorHandler } from './useErrorHandler';

// Mock toast notifications
vi.mock('react-hot-toast', () => ({
  default: {
    error: vi.fn(),
    success: vi.fn(),
    info: vi.fn()
  }
}));

describe('useErrorHandler', () => {
  let mockToast: unknown;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});

    // Get the mocked toast
    const toast = await import('react-hot-toast');
    mockToast = toast.default;
  });

  it('should handle API errors with proper error messages', async () => {
    const { result } = renderHook(() => useErrorHandler());

    const apiError = {
      response: {
        status: 400,
        data: {
          message: 'Bad request error'
        }
      }
    };

    act(() => {
      result.current.handleError(apiError);
    });

    expect(mockToast.error).toHaveBeenCalledWith('Bad request error');
    expect(result.current.error).toEqual(apiError);
  });

  it('should handle network errors', async () => {
    const { result } = renderHook(() => useErrorHandler());

    const networkError = {
      code: 'NETWORK_ERROR',
      message: 'Network Error'
    };

    act(() => {
      result.current.handleError(networkError);
    });

    expect(mockToast.error).toHaveBeenCalledWith('Network error. Please check your connection and try again.');
    expect(result.current.error).toEqual(networkError);
  });

  it('should handle 401 unauthorized errors', async () => {
    const { result } = renderHook(() => useErrorHandler());

    const authError = {
      response: {
        status: 401,
        data: {
          message: 'Unauthorized'
        }
      }
    };

    act(() => {
      result.current.handleError(authError);
    });

    expect(mockToast.error).toHaveBeenCalledWith('Session expired. Please login again.');
    expect(result.current.error).toEqual(authError);
  });

  it('should handle 403 forbidden errors', async () => {
    const { result } = renderHook(() => useErrorHandler());

    const forbiddenError = {
      response: {
        status: 403,
        data: {
          message: 'Forbidden'
        }
      }
    };

    act(() => {
      result.current.handleError(forbiddenError);
    });

    expect(mockToast.error).toHaveBeenCalledWith('You don\'t have permission to perform this action.');
    expect(result.current.error).toEqual(forbiddenError);
  });

  it('should handle 404 not found errors', async () => {
    const { result } = renderHook(() => useErrorHandler());

    const notFoundError = {
      response: {
        status: 404,
        data: {
          message: 'Not found'
        }
      }
    };

    act(() => {
      result.current.handleError(notFoundError);
    });

    expect(mockToast.error).toHaveBeenCalledWith('Resource not found.');
    expect(result.current.error).toEqual(notFoundError);
  });

  it('should handle 500 server errors', async () => {
    const { result } = renderHook(() => useErrorHandler());

    const serverError = {
      response: {
        status: 500,
        data: {
          message: 'Internal server error'
        }
      }
    };

    act(() => {
      result.current.handleError(serverError);
    });

    expect(mockToast.error).toHaveBeenCalledWith('Server error. Please try again later.');
    expect(result.current.error).toEqual(serverError);
  });

  it('should clear errors', async () => {
    const { result } = renderHook(() => useErrorHandler());

    const error = { message: 'Test error' };

    act(() => {
      result.current.handleError(error);
    });

    expect(result.current.error).toEqual(error);

    act(() => {
      result.current.clearError();
    });

    expect(result.current.error).toBeNull();
  });

  it('should handle custom error callback', async () => {
    const customCallback = vi.fn();
    const { result } = renderHook(() => useErrorHandler({ onError: customCallback }));

    const error = { message: 'Test error' };

    act(() => {
      result.current.handleError(error);
    });

    expect(customCallback).toHaveBeenCalledWith(error);
  });

  it('should handle retry logic', async () => {
    const retryFn = vi.fn().mockResolvedValue('success');
    const { result } = renderHook(() => useErrorHandler());

    await act(async () => {
      const success = await result.current.withRetry(retryFn, 2);
      expect(success).toBe('success');
    });

    expect(retryFn).toHaveBeenCalledTimes(1);
  });

  it('should retry failed operations', async () => {
    let callCount = 0;
    const retryFn = vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount < 3) {
        throw new Error('Retry error');
      }
      return 'success';
    });

    const { result } = renderHook(() => useErrorHandler());

    await act(async () => {
      const success = await result.current.withRetry(retryFn, 3);
      expect(success).toBe('success');
    });

    expect(retryFn).toHaveBeenCalledTimes(3);
  });

  it('should throw error after max retries exceeded', async () => {
    const retryFn = vi.fn().mockRejectedValue(new Error('Always fails'));
    const { result } = renderHook(() => useErrorHandler());

    await act(async () => {
      try {
        await result.current.withRetry(retryFn, 2);
        expect(true).toBe(false); // Should not reach here
      } catch (error: unknown) {
        expect(error.message).toBe('Always fails');
      }
    });

    expect(retryFn).toHaveBeenCalledTimes(2);
  });
});