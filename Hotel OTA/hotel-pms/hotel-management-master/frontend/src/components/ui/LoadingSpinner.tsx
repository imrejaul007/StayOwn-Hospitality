import React from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LoadingSpinnerProps {
  size?: 'small' | 'medium' | 'large';
  message?: string;
  variant?: 'primary' | 'secondary' | 'success' | 'warning' | 'danger';
  className?: string;
  centered?: boolean;
  overlay?: boolean;
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'medium',
  message,
  variant = 'primary',
  className,
  centered = false,
  overlay = false
}) => {
  const sizeClasses = {
    small: 'w-4 h-4',
    medium: 'w-6 h-6',
    large: 'w-8 h-8'
  };

  const variantClasses = {
    primary: 'text-blue-600',
    secondary: 'text-gray-600',
    success: 'text-green-600',
    warning: 'text-yellow-600',
    danger: 'text-red-600'
  };

  const spinnerElement = (
    <div
      role="status"
      aria-label="Loading"
      className={cn(
        'inline-flex flex-col items-center space-y-2',
        className
      )}
    >
      <Loader2
        className={cn(
          'animate-spin',
          sizeClasses[size],
          variantClasses[variant]
        )}
      />
      {message && (
        <span className={cn(
          'text-sm font-medium',
          variantClasses[variant]
        )}>
          {message}
        </span>
      )}
      <span className="sr-only">Loading</span>
    </div>
  );

  if (overlay) {
    return (
      <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center z-50">
        {spinnerElement}
      </div>
    );
  }

  if (centered) {
    return (
      <div className="flex justify-center items-center min-h-[200px] w-full">
        {spinnerElement}
      </div>
    );
  }

  return spinnerElement;
};

export default LoadingSpinner;