import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home, Mail } from 'lucide-react';
import { Button } from './ui/button';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  level?: 'page' | 'component' | 'critical';
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  errorId: string | null;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
    errorId: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI
    return {
      hasError: true,
      error,
      errorInfo: null,
      errorId: crypto.randomUUID(),
    };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    
    this.setState({
      error,
      errorInfo,
    });

    // Call optional error handler
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // Log error to monitoring service (e.g., Sentry, LogRocket, etc.)
    this.logErrorToService(error, errorInfo);
  }

  private logErrorToService = (error: Error, errorInfo: ErrorInfo) => {
    // In a real application, you would send this to your error monitoring service
    const errorReport = {
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      timestamp: new Date().toISOString(),
      url: window.location.href,
      userAgent: navigator.userAgent,
      userId: localStorage.getItem('userId'), // If available
      level: this.props.level || 'component',
      errorId: this.state.errorId,
    };

    // Example: Send to monitoring service
    // fetch('/api/v1/errors', {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify(errorReport),
    // }).catch(console.error);

    console.error('Error Report:', errorReport);
  };

  private handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null,
    });
  };

  private handleReload = () => {
    window.location.reload();
  };

  private handleGoHome = () => {
    window.location.href = '/';
  };

  private copyErrorDetails = () => {
    const errorDetails = {
      error: this.state.error?.message,
      stack: this.state.error?.stack,
      componentStack: this.state.errorInfo?.componentStack,
      timestamp: new Date().toISOString(),
      url: window.location.href,
      errorId: this.state.errorId,
    };

    navigator.clipboard.writeText(JSON.stringify(errorDetails, null, 2))
      .then(() => {
        alert('Error details copied to clipboard');
      })
      .catch(() => {
        console.error('Failed to copy error details');
      });
  };

  public render() {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const { level = 'component' } = this.props;
      const { error, errorId } = this.state;

      // Different UI based on error level
      if (level === 'critical') {
        return (
          <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
            <div className="sm:mx-auto sm:w-full sm:max-w-md">
              <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
                <div className="text-center">
                  <AlertTriangle className="mx-auto h-12 w-12 text-red-500" />
                  <h2 className="mt-4 text-lg font-medium text-gray-900">
                    Critical System Error
                  </h2>
                  <p className="mt-2 text-sm text-gray-600">
                    A critical error has occurred that requires immediate attention.
                  </p>
                  {errorId && (
                    <p className="mt-2 text-xs text-gray-500">
                      Error ID: {errorId}
                    </p>
                  )}
                </div>

                <div className="mt-6 space-y-3">
                  <Button
                    onClick={this.handleReload}
                    className="w-full flex items-center justify-center"
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Reload Application
                  </Button>

                  <Button
                    variant="secondary"
                    onClick={this.copyErrorDetails}
                    className="w-full flex items-center justify-center"
                  >
                    <Mail className="h-4 w-4 mr-2" />
                    Copy Error Details
                  </Button>

                  <div className="text-center">
                    <p className="text-xs text-gray-500">
                      If the problem persists, please contact support with the error ID.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      }

      if (level === 'page') {
        return (
          <div className="min-h-96 bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
            <div className="sm:mx-auto sm:w-full sm:max-w-lg">
              <div className="bg-white py-8 px-4 shadow-sm rounded-lg sm:px-10 border border-gray-200">
                <div className="text-center">
                  <AlertTriangle className="mx-auto h-10 w-10 text-orange-500" />
                  <h2 className="mt-4 text-lg font-medium text-gray-900">
                    Page Error
                  </h2>
                  <p className="mt-2 text-sm text-gray-600">
                    Something went wrong while loading this page.
                  </p>
                  {error && (
                    <p className="mt-2 text-xs text-gray-500 font-mono bg-gray-50 p-2 rounded">
                      {error.message}
                    </p>
                  )}
                  {errorId && (
                    <p className="mt-2 text-xs text-gray-500">
                      Error ID: {errorId}
                    </p>
                  )}
                </div>

                <div className="mt-6 flex space-x-3">
                  <Button
                    onClick={this.handleRetry}
                    className="flex-1 flex items-center justify-center"
                    size="sm"
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Try Again
                  </Button>

                  <Button
                    variant="secondary"
                    onClick={this.handleGoHome}
                    className="flex-1 flex items-center justify-center"
                    size="sm"
                  >
                    <Home className="h-4 w-4 mr-2" />
                    Go Home
                  </Button>
                </div>

                <div className="mt-4 text-center">
                  <button
                    onClick={this.copyErrorDetails}
                    className="text-xs text-gray-500 hover:text-gray-700 underline"
                  >
                    Copy technical details
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      }

      // Component level error (default)
      return (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <AlertTriangle className="h-5 w-5 text-red-400" />
            </div>
            <div className="ml-3 flex-1">
              <h3 className="text-sm font-medium text-red-800">
                Component Error
              </h3>
              <div className="mt-2 text-sm text-red-700">
                <p>
                  {error?.message || 'An unexpected error occurred in this component.'}
                </p>
                {errorId && (
                  <p className="mt-1 text-xs text-red-600">
                    Error ID: {errorId}
                  </p>
                )}
              </div>
              <div className="mt-3">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={this.handleRetry}
                  className="bg-red-100 text-red-800 hover:bg-red-200 border-red-300"
                >
                  <RefreshCw className="h-4 w-4 mr-1" />
                  Retry
                </Button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Higher-order component for easy wrapping
export const withErrorBoundary = <P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Omit<Props, 'children'>
) => {
  return (props: P) => (
    <ErrorBoundary {...errorBoundaryProps}>
      <Component {...props} />
    </ErrorBoundary>
  );
};

// Hook for triggering errors in development/testing
export const useErrorHandler = () => {
  return (error: Error, errorInfo?: ErrorInfo) => {
    // In development, you might want to throw the error to trigger the boundary
    if (import.meta.env.MODE === 'development') {
      throw error;
    }
    
    // In production, log and handle gracefully
    console.error('Handled error:', error, errorInfo);
  };
};

export default ErrorBoundary;