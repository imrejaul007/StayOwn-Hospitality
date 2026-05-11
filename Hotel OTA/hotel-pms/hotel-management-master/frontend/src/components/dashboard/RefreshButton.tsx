import React from 'react';
import { cn } from '../../utils/cn';
import { Button } from '@/components/ui/button';

interface RefreshButtonProps {
  onRefresh: () => void;
  loading?: boolean;
  lastUpdated?: string;
  autoRefresh?: boolean;
  refreshInterval?: number;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'primary' | 'secondary' | 'ghost';
  showLastUpdated?: boolean;
  className?: string;
}

export function RefreshButton({
  onRefresh,
  loading = false,
  lastUpdated,
  autoRefresh = false,
  refreshInterval = 30000,
  size = 'sm',
  variant = 'ghost',
  showLastUpdated = true,
  className,
}: RefreshButtonProps) {
  const [isAutoRefreshing, setIsAutoRefreshing] = React.useState(autoRefresh);
  const onRefreshRef = React.useRef(onRefresh);
  onRefreshRef.current = onRefresh;

  React.useEffect(() => {
    if (isAutoRefreshing) {
      const interval = setInterval(() => {
        onRefreshRef.current();
      }, refreshInterval);

      return () => clearInterval(interval);
    }
  }, [isAutoRefreshing, refreshInterval]);

  const formatLastUpdated = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));

    if (diffInMinutes < 1) return 'now';
    if (diffInMinutes < 60) return `${diffInMinutes}m`;
    
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours}h ago`;
    
    const diffInDays = Math.floor(diffInHours / 24);
    return `${diffInDays}d ago`;
  };

  return (
    <div className={cn('flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-2', className)}>
      <div className="flex items-center gap-2">
        <Button
          variant={variant}
          size={size}
          onClick={onRefresh}
          disabled={loading}
          className="flex items-center space-x-1 text-xs sm:text-sm px-2 sm:px-3"
          title="Refresh data"
        >
          <svg 
            className={cn(
              'w-3 h-3 sm:w-4 sm:h-4',
              loading && 'animate-spin'
            )} 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" 
            />
          </svg>
          <span className="hidden sm:inline">Refresh</span>
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsAutoRefreshing(!isAutoRefreshing)}
          className={cn(
            'flex items-center space-x-1 text-xs sm:text-sm px-2 sm:px-3',
            isAutoRefreshing && 'text-blue-600 bg-blue-50'
          )}
          title={isAutoRefreshing ? 'Disable auto-refresh' : 'Enable auto-refresh'}
        >
          <svg className="w-3 h-3 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {isAutoRefreshing ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                d="M14.828 14.828a4 4 0 01-5.656 0M9 10h1m4 0h1m-6 4h.01M15 14h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            )}
          </svg>
          <span className="hidden sm:inline">
            {isAutoRefreshing ? 'Auto' : 'Manual'}
          </span>
        </Button>
      </div>

      {showLastUpdated && lastUpdated && (
        <span className="text-xs text-gray-500 whitespace-nowrap">
          Updated {formatLastUpdated(lastUpdated)}
        </span>
      )}
    </div>
  );
}