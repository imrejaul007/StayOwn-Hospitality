import React from 'react';
import { cn } from '../../utils/cn';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface ChartCardProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  loading?: boolean;
  error?: string;
  onRefresh?: () => void;
  onExport?: () => void;
  actions?: React.ReactNode;
  height?: string | number;
  className?: string;
}

export function ChartCard({
  title,
  subtitle,
  children,
  loading,
  error,
  onRefresh,
  onExport,
  actions,
  height = '400px',
  className,
}: ChartCardProps) {
  return (
    <Card className={cn('overflow-hidden', className)}>
      <CardHeader className="pb-3 sm:pb-4 px-4 sm:px-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="min-w-0 flex-1">
            <CardTitle className="text-base sm:text-lg font-semibold text-gray-900 truncate">
              {title}
            </CardTitle>
            {subtitle && (
              <p className="text-xs sm:text-sm text-gray-600 mt-1 truncate">{subtitle}</p>
            )}
          </div>
          
          <div className="flex items-center space-x-1 sm:space-x-2 flex-shrink-0">
            {actions}
            {onRefresh && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onRefresh}
                className="p-1.5 sm:p-2"
                title="Refresh data"
              >
                <svg className="w-3 h-3 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </Button>
            )}
            {onExport && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onExport}
                className="p-1.5 sm:p-2"
                title="Export chart"
              >
                <svg className="w-3 h-3 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                    d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        <div 
          className="relative"
          style={{ height: typeof height === 'number' ? `${height}px` : height, minHeight: '200px' }}
        >
          {loading && (
            <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center z-10">
              <div className="flex flex-col items-center space-y-2">
                <div className="animate-spin rounded-full h-6 w-6 sm:h-8 sm:w-8 border-b-2 border-blue-600"></div>
                <p className="text-xs sm:text-sm text-gray-600">Loading chart...</p>
              </div>
            </div>
          )}

          {error && (
            <div className="absolute inset-0 bg-red-50 flex items-center justify-center">
              <div className="text-center p-3 sm:p-4">
                <svg className="w-8 h-8 sm:w-12 sm:h-12 text-red-400 mx-auto mb-2 sm:mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                    d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-red-600 font-medium text-sm sm:text-base">Failed to load chart</p>
                <p className="text-red-500 text-xs sm:text-sm mt-1">{error}</p>
                {onRefresh && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={onRefresh}
                    className="mt-3 text-xs sm:text-sm"
                  >
                    Retry
                  </Button>
                )}
              </div>
            </div>
          )}

          <div className={cn(
            'h-full',
            (loading || error) && 'opacity-25'
          )}>
            {children}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}