import React from 'react';
import { AlertCircle, XCircle, RefreshCw, WifiOff, AlertTriangle } from 'lucide-react';
import { Button } from './button';

interface GenericErrorAlertProps {
  error?: unknown;
  title?: string;
  message?: string;
  type?: 'error' | 'warning' | 'network' | 'validation';
  onDismiss?: () => void;
  onRetry?: () => void;
  showRetry?: boolean;
  className?: string;
}

const GenericErrorAlert: React.FC<GenericErrorAlertProps> = ({
  error,
  title,
  message,
  type = 'error',
  onDismiss,
  onRetry,
  showRetry = false,
  className = ''
}) => {
  const getErrorConfig = () => {
    switch (type) {
      case 'warning':
        return {
          icon: <AlertTriangle className="h-5 w-5" />,
          bgColor: 'bg-yellow-50',
          borderColor: 'border-yellow-200',
          textColor: 'text-yellow-800',
          iconColor: 'text-yellow-500',
          defaultTitle: 'Warning'
        };
      case 'network':
        return {
          icon: <WifiOff className="h-5 w-5" />,
          bgColor: 'bg-blue-50',
          borderColor: 'border-blue-200',
          textColor: 'text-blue-800',
          iconColor: 'text-blue-500',
          defaultTitle: 'Connection Error'
        };
      case 'validation':
        return {
          icon: <AlertTriangle className="h-5 w-5" />,
          bgColor: 'bg-orange-50',
          borderColor: 'border-orange-200',
          textColor: 'text-orange-800',
          iconColor: 'text-orange-500',
          defaultTitle: 'Validation Error'
        };
      default: // error
        return {
          icon: <AlertCircle className="h-5 w-5" />,
          bgColor: 'bg-red-50',
          borderColor: 'border-red-200',
          textColor: 'text-red-800',
          iconColor: 'text-red-500',
          defaultTitle: 'Error'
        };
    }
  };

  const getErrorMessage = () => {
    if (message) return message;

    const axiosErr = error as { response?: { data?: { message?: string } } } | undefined;
    if (axiosErr?.response?.data?.message) {
      return axiosErr.response.data.message;
    }

    if (error instanceof Error) {
      return error.message;
    }

    switch (type) {
      case 'network':
        return 'Unable to connect to the server. Please check your connection and try again.';
      case 'validation':
        return 'Please check your input and try again.';
      case 'warning':
        return 'Please review the information and proceed with caution.';
      default:
        return 'An unexpected error occurred. Please try again.';
    }
  };

  const config = getErrorConfig();
  const errorTitle = title || config.defaultTitle;
  const errorMessage = getErrorMessage();

  return (
    <div className={`rounded-lg border p-4 ${config.bgColor} ${config.borderColor} ${className}`}>
      <div className="flex items-start gap-3">
        <div className={config.iconColor}>
          {config.icon}
        </div>
        <div className="flex-1 min-w-0">
          <h4 className={`text-sm font-medium ${config.textColor}`}>
            {errorTitle}
          </h4>
          <p className={`mt-1 text-sm ${config.textColor} opacity-90`}>
            {errorMessage}
          </p>

          {(showRetry || onRetry || onDismiss) && (
            <div className="mt-3 flex items-center gap-2">
              {(showRetry || onRetry) && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={onRetry}
                  className="h-8 text-xs"
                >
                  <RefreshCw className="h-3 w-3 mr-1" />
                  Try Again
                </Button>
              )}

              {onDismiss && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={onDismiss}
                  className={`h-8 text-xs ${config.textColor} opacity-70 hover:opacity-100`}
                >
                  Dismiss
                </Button>
              )}
            </div>
          )}
        </div>

        {onDismiss && (
          <button
            onClick={onDismiss}
            className={`${config.textColor} opacity-50 hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-offset-2 rounded`}
          >
            <XCircle className="h-4 w-4" />
            <span className="sr-only">Dismiss</span>
          </button>
        )}
      </div>
    </div>
  );
};

export default GenericErrorAlert;