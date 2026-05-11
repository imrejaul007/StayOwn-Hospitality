import axios, { AxiosError, AxiosResponse } from 'axios';
import toast from 'react-hot-toast';

interface ApiErrorResponse {
  message?: string;
  error?: string;
  details?: Record<string, unknown>;
}

// Global error handling configuration
interface ErrorHandlingConfig {
  showToasts: boolean;
  logErrors: boolean;
  retryAttempts: number;
  retryDelay: number;
}

class ApiErrorInterceptor {
  private config: ErrorHandlingConfig = {
    showToasts: true,
    logErrors: true,
    retryAttempts: 2,
    retryDelay: 1000
  };
  private retryTimers: Set<ReturnType<typeof setTimeout>> = new Set();

  constructor(config?: Partial<ErrorHandlingConfig>) {
    if (config) {
      this.config = { ...this.config, ...config };
    }
    this.setupInterceptors();
  }

  private setupInterceptors() {
    // Request interceptor to add retry logic
    axios.interceptors.request.use(
      (config) => {
        // Add request ID for tracking retries
        config.metadata = {
          ...config.metadata,
          requestId: Math.random().toString(36).substring(7),
          startTime: Date.now()
        };
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Response interceptor for error handling
    axios.interceptors.response.use(
      (response: AxiosResponse) => {
        // Log successful responses in development
        if (this.config.logErrors && import.meta.env.MODE === 'development') {
          const duration = Date.now() - (response.config.metadata?.startTime || 0);
        }
        return response;
      },
      async (error: AxiosError<ApiErrorResponse>) => {
        return this.handleError(error);
      }
    );
  }

  private async handleError(error: AxiosError<ApiErrorResponse>): Promise<never> {
    const { config, response, request } = error;

    // Log error details
    if (this.config.logErrors) {
      this.logError(error);
    }

    // Handle different types of errors
    if (response) {
      // Server responded with error status
      await this.handleResponseError(error);
    } else if (request) {
      // Request was made but no response received
      await this.handleNetworkError(error);
    } else {
      // Something else happened
      await this.handleGenericError(error);
    }

    // Enhanced error object with additional context
    const enhancedError = {
      ...error,
      context: {
        url: config?.url,
        method: config?.method?.toUpperCase(),
        requestId: config?.metadata?.requestId,
        timestamp: new Date().toISOString()
      }
    };

    return Promise.reject(enhancedError);
  }

  private async handleResponseError(error: AxiosError<ApiErrorResponse>) {
    const { response, config } = error;
    const status = response?.status;
    const data = response?.data;

    switch (status) {
      case 400:
        this.showToast('Bad request. Please check your input.', 'error');
        break;

      case 401:
        this.showToast('Session expired. Please login again.', 'error');
        // Handle authentication redirect
        if (typeof window !== 'undefined') {
          window.location.href = '/login';
        }
        break;

      case 403:
        this.showToast('You don\'t have permission to perform this action.', 'error');
        break;

      case 404:
        this.showToast('Resource not found.', 'error');
        break;

      case 409:
        // Conflict - often used for business logic errors
        const conflictMessage = data?.message || 'A conflict occurred. Please refresh and try again.';
        this.showToast(conflictMessage, 'error');
        break;

      case 422:
        // Validation errors
        const validationMessage = data?.message || 'Validation failed. Please check your input.';
        this.showToast(validationMessage, 'error');
        break;

      case 429:
        this.showToast('Too many requests. Please wait and try again.', 'error');
        break;

      case 500:
      case 502:
      case 503:
      case 504:
        // Server errors - attempt retry for idempotent operations
        if (this.shouldRetry(config)) {
          return this.retryRequest(config);
        }
        this.showToast('Server error. Please try again later.', 'error');
        break;

      default:
        const defaultMessage = data?.message || `Request failed with status ${status}`;
        this.showToast(defaultMessage, 'error');
    }
  }

  private async handleNetworkError(error: AxiosError) {
    const { config } = error;

    // Check if it's a timeout
    if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
      if (this.shouldRetry(config)) {
        return this.retryRequest(config);
      }
      this.showToast('Request timed out. Please try again.', 'error');
    } else {
      // Network connectivity issues
      if (this.shouldRetry(config)) {
        return this.retryRequest(config);
      }
      this.showToast('Network error. Please check your connection.', 'error');
    }
  }

  private async handleGenericError(error: AxiosError) {
    this.showToast('An unexpected error occurred. Please try again.', 'error');
  }

  private shouldRetry(config: Record<string, unknown>): boolean {
    if (!config) return false;

    // Don't retry POST, PUT, PATCH requests by default (not idempotent)
    const method = config.method?.toLowerCase();
    const isIdempotent = ['get', 'head', 'options', 'delete'].includes(method);

    // Check if retries are exhausted
    const retryCount = config.metadata?.retryCount || 0;

    return isIdempotent && retryCount < this.config.retryAttempts;
  }

  private async retryRequest(config: Record<string, unknown>): Promise<never> {
    const retryCount = (config.metadata?.retryCount || 0) + 1;

    // Wait before retrying
    await new Promise<void>(resolve => {
      const timer = setTimeout(() => {
        this.retryTimers.delete(timer);
        resolve();
      }, this.config.retryDelay * retryCount);
      this.retryTimers.add(timer);
    });

    // Update retry count
    config.metadata = {
      ...config.metadata,
      retryCount
    };


    return axios.request(config);
  }

  private showToast(message: string, type: 'error' | 'warning' | 'success') {
    if (!this.config.showToasts) return;

    switch (type) {
      case 'error':
        toast.error(message);
        break;
      case 'warning':
        toast(message, { icon: '⚠️' });
        break;
      case 'success':
        toast.success(message);
        break;
    }
  }

  private logError(error: AxiosError<ApiErrorResponse>) {
    const { config, response, request } = error;

    const logData = {
      timestamp: new Date().toISOString(),
      requestId: config?.metadata?.requestId,
      method: config?.method?.toUpperCase(),
      url: config?.url,
      status: response?.status,
      statusText: response?.statusText,
      message: error.message,
      responseData: response?.data,
      stack: error.stack
    };

    console.group(`🚨 API Error - ${logData.method} ${logData.url}`);
    console.groupEnd();

    // In production, send to error reporting service
    if (import.meta.env.MODE === 'production') {
      this.reportError(logData);
    }
  }

  private reportError(errorData: Record<string, unknown>) {
    // Send to external error reporting service
    // Example: Sentry, LogRocket, Bugsnag, etc.
    try {
      // Replace with your error reporting service
    } catch {
      // Error handled silently
    }
  }

  // Public methods for configuration
  public configure(config: Partial<ErrorHandlingConfig>) {
    this.config = { ...this.config, ...config };
  }

  public disableToasts() {
    this.config.showToasts = false;
  }

  public enableToasts() {
    this.config.showToasts = true;
  }

  public destroy() {
    this.retryTimers.forEach(timer => clearTimeout(timer));
    this.retryTimers.clear();
  }
}

// Create and export singleton instance
export const apiErrorInterceptor = new ApiErrorInterceptor();

// Export for manual initialization if needed
export default ApiErrorInterceptor;