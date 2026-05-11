import React from 'react';
import { cn } from '../../utils/cn';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

interface DashboardCardProps {
  title: string;
  value: string | number;
  change?: number;
  changeLabel?: string;
  icon?: React.ReactNode;
  loading?: boolean;
  children?: React.ReactNode;
  className?: string;
}

export function DashboardCard({
  title,
  value,
  change,
  changeLabel,
  icon,
  loading,
  children,
  className,
}: DashboardCardProps) {
  const getChangeColor = (change: number) => {
    if (change > 0) return 'text-green-600';
    if (change < 0) return 'text-red-600';
    return 'text-gray-600';
  };

  const getChangeIcon = (change: number) => {
    if (change > 0) return '↗';
    if (change < 0) return '↘';
    return '→';
  };

  return (
    <Card className={cn('hover:shadow-lg transition-shadow duration-200', className)}>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <div className="flex items-center space-x-2">
              {icon && <div className="text-gray-400">{icon}</div>}
              <p className="text-sm font-medium text-gray-600">{title}</p>
            </div>
            
            <div className="mt-2">
              {loading ? (
                <div className="animate-pulse">
                  <div className="h-8 bg-gray-200 rounded w-24"></div>
                </div>
              ) : (
                <p className="text-2xl font-bold text-gray-900">{value}</p>
              )}
            </div>

            {change !== undefined && !loading && (
              <div className={cn('flex items-center mt-2', getChangeColor(change))}>
                <span className="text-sm font-medium">
                  {getChangeIcon(change)} {Math.abs(change).toFixed(1)}%
                </span>
                {changeLabel && (
                  <span className="text-sm text-gray-500 ml-1">
                    {changeLabel}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
        
        {children && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            {children}
          </div>
        )}
      </CardContent>
    </Card>
  );
}