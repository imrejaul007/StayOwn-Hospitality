import React from 'react';
import { cn } from '../../utils/cn';
import { AlertTriangle, CheckCircle, Info, XCircle } from 'lucide-react';

interface AlertProps {
  children: React.ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info' | 'destructive';
  className?: string;
}

export function Alert({ children, variant = 'default', className }: AlertProps) {
  const variants: Record<string, string> = {
    default: 'bg-blue-50 border-blue-200 text-blue-800',
    success: 'bg-green-50 border-green-200 text-green-800',
    warning: 'bg-yellow-50 border-yellow-200 text-yellow-800',
    error: 'bg-red-50 border-red-200 text-red-800',
    info: 'bg-blue-50 border-blue-200 text-blue-800',
    destructive: 'bg-red-50 border-red-300 text-red-900'
  };

  const icons: Record<string, typeof Info> = {
    default: Info,
    success: CheckCircle,
    warning: AlertTriangle,
    error: XCircle,
    info: Info,
    destructive: XCircle
  };

  const Icon = icons[variant] || Info;

  return (
    <div
      className={cn(
        'flex items-start p-4 border rounded-lg',
        variants[variant],
        className
      )}
    >
      <Icon className="h-5 w-5 mr-3 mt-0.5 flex-shrink-0" />
      <div className="flex-1">
        {children}
      </div>
    </div>
  );
}

interface AlertDescriptionProps {
  children: React.ReactNode;
  className?: string;
}

export function AlertDescription({ children, className }: AlertDescriptionProps) {
  return (
    <div className={cn('text-sm', className)}>
      {children}
    </div>
  );
}

interface AlertTitleProps {
  children: React.ReactNode;
  className?: string;
}

export function AlertTitle({ children, className }: AlertTitleProps) {
  return (
    <div className={cn('font-medium mb-1', className)}>
      {children}
    </div>
  );
}