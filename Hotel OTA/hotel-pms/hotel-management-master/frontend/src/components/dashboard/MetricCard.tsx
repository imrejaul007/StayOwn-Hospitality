import React from 'react';
import { cn } from '../../utils/cn';
import { Card, CardContent } from '@/components/ui/card';
import { formatNumber, formatCurrency, formatPercentage } from '../../utils/dashboardUtils';

interface MetricCardProps {
  title: string;
  value: number | string | undefined | null;
  type?: 'number' | 'currency' | 'percentage';
  prefix?: string;
  suffix?: string;
  trend?: {
    value: number | string | undefined | null;
    direction: 'up' | 'down' | 'neutral';
    label?: string;
  };
  icon?: React.ReactNode;
  color?: 'blue' | 'green' | 'yellow' | 'red' | 'purple' | 'gray' | 'orange';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  className?: string;
}

export function MetricCard({
  title,
  value,
  type = 'number',
  prefix,
  suffix,
  trend,
  icon,
  color = 'blue',
  size = 'md',
  loading,
  className,
}: MetricCardProps) {
  const formatValue = () => {
    if (loading) return '---';
    
    switch (type) {
      case 'currency':
        return formatCurrency(value);
      case 'percentage':
        return formatPercentage(value);
      case 'number':
      default:
        return formatNumber(value);
    }
  };

  const colorClasses = {
    blue: {
      bg: 'bg-blue-50',
      icon: 'text-blue-600',
      accent: 'border-blue-200',
    },
    green: {
      bg: 'bg-green-50',
      icon: 'text-green-600',
      accent: 'border-green-200',
    },
    yellow: {
      bg: 'bg-yellow-50',
      icon: 'text-yellow-600',
      accent: 'border-yellow-200',
    },
    red: {
      bg: 'bg-red-50',
      icon: 'text-red-600',
      accent: 'border-red-200',
    },
    purple: {
      bg: 'bg-purple-50',
      icon: 'text-purple-600',
      accent: 'border-purple-200',
    },
    gray: {
      bg: 'bg-gray-50',
      icon: 'text-gray-600',
      accent: 'border-gray-200',
    },
    orange: {
      bg: 'bg-orange-50',
      icon: 'text-orange-600',
      accent: 'border-orange-200',
    },
  };

  const sizeClasses = {
    sm: {
      padding: 'p-3 sm:p-4',
      title: 'text-xs',
      value: 'text-base sm:text-lg',
      icon: 'w-4 h-4 sm:w-5 sm:h-5',
    },
    md: {
      padding: 'p-4 sm:p-6',
      title: 'text-xs sm:text-sm',
      value: 'text-xl sm:text-2xl',
      icon: 'w-5 h-5 sm:w-6 sm:h-6',
    },
    lg: {
      padding: 'p-6 sm:p-8',
      title: 'text-sm sm:text-base',
      value: 'text-2xl sm:text-3xl',
      icon: 'w-6 h-6 sm:w-8 sm:h-8',
    },
  };

  const getTrendColor = (direction: string) => {
    switch (direction) {
      case 'up':
        return 'text-green-600';
      case 'down':
        return 'text-red-600';
      default:
        return 'text-gray-600';
    }
  };

  const getTrendIcon = (direction: string) => {
    switch (direction) {
      case 'up':
        return '↗';
      case 'down':
        return '↘';
      default:
        return '→';
    }
  };

  return (
    <Card className={cn(
      'hover:shadow-md transition-all duration-200 border-l-4',
      colorClasses[color].bg,
      colorClasses[color].accent,
      className
    )}>
      <CardContent className={cn(sizeClasses[size].padding, 'space-y-2')}>
        <div className="flex items-center justify-between">
          <p className={cn(
            'font-medium text-gray-600 uppercase tracking-wide leading-tight pr-2',
            sizeClasses[size].title
          )} style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
            {title}
          </p>
          {icon && (
            <div className={cn(
              'flex-shrink-0',
              colorClasses[color].icon,
              sizeClasses[size].icon
            )}>
              {icon}
            </div>
          )}
        </div>

        <div className="space-y-1">
          {loading ? (
            <div className="animate-pulse">
              <div className={cn(
                'bg-gray-200 rounded',
                size === 'sm' ? 'h-6 w-16' : size === 'md' ? 'h-8 w-20' : 'h-10 w-24'
              )}></div>
            </div>
          ) : (
            <div className="flex items-baseline space-x-1 min-w-0">
              {prefix && (
                <span className="text-xs sm:text-sm text-gray-500 flex-shrink-0">{prefix}</span>
              )}
              <p className={cn(
                'font-bold text-gray-900',
                sizeClasses[size].value
              )}>
                {formatValue()}
              </p>
              {suffix && (
                <span className="text-xs sm:text-sm text-gray-500 flex-shrink-0">{suffix}</span>
              )}
            </div>
          )}

          {trend && !loading && (
            <div className={cn(
              'flex items-center text-xs',
              getTrendColor(trend.direction)
            )}>
              <span className="font-medium">
                {getTrendIcon(trend.direction)} {Math.abs(Number(trend.value) || 0)}%
              </span>
              {trend.label && (
                <span className="text-gray-500 ml-1">{trend.label}</span>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}