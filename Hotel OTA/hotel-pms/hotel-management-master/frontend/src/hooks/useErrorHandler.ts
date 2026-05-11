import { useState, useCallback, useEffect, useRef } from 'react';
import toast from 'react-hot-toast';

interface ErrorHandlerOptions {
  onError?: (error: unknown) => void;
  showToast?: boolean;
}

interface ApiError {
  response?: {
    status: number;
    data?: {
      message?: string;
    };
  };
  code?: string;
  message?: string;
}

export const useErrorHandler = (options: ErrorHandlerOptions = {}) => {
  const { onError, showToast = true } = options;
  const [error, setError] = useState<unknown>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    return () => { isMountedRef.current = false; };
  }, []);

  const getErrorMessage = useCallback((error: ApiError): string => {
    // Handle API errors with status codes
    if (error.response?.status) {
      const status = error.response.status;
      const serverMessage = error.response.data?.message;

      switch (status) {
        case 400:
          return serverMessage || 'Bad request. Please check your input.';
        case 401:
          return 'Session expired. Please login again.';
        case 403:
          return 'You don\'t have permission to perform this action.';
        case 404:
          return 'Resource not found.';
        case 409:
          return serverMessage || 'Conflict occurred. Please try again.';
        case 422:
          return serverMessage || 'Validation error. Please check your input.';
        case 429:
          return 'Too many requests. Please wait and try again.';
        case 500:
        case 502:
        case 503:
        case 504:
          return 'Server error. Please try again later.';
        default:
          return serverMessage || `Request failed with status ${status}`;
      }
    }

    // Handle network errors
    if (error.code === 'NETWORK_ERROR' || error.message === 'Network Error') {
      return 'Network error. Please check your connection and try again.';
    }

    // Handle timeout errors
    if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
      return 'Request timed out. Please try again.';
    }

    // Handle other error types
    if (error.message) {
      return error.message;
    }

    // Fallback message
    return 'An unexpected error occurred. Please try again.';
  }, []);

  const handleError = useCallback((error: unknown) => {

    setError(error);

    // Show toast notification if enabled
    if (showToast) {
      const message = getErrorMessage(error);
      toast.error(message);
    }

    // Call custom error handler if provided
    if (onError) {
      onError(error);
    }
  }, [getErrorMessage, onError, showToast]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const withRetry = useCallback(async <T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    delay: number = 1000
  ): Promise<T> => {
    let lastError: unknown;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;

        if (attempt === maxRetries) {
          throw error;
        }

        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, delay * attempt));
        if (!isMountedRef.current) throw new Error('Component unmounted during retry');
      }
    }

    throw lastError;
  }, []);

  const withErrorHandling = useCallback(<T>(
    operation: () => Promise<T>
  ): Promise<T> => {
    return operation().catch((error) => {
      handleError(error);
      throw error;
    });
  }, [handleError]);

  return {
    error,
    handleError,
    clearError,
    withRetry,
    withErrorHandling,
    getErrorMessage
  };
};