import React from 'react';
import { cn } from '../../utils/cn';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatRelativeTime } from '../../utils/dashboardUtils';
import type { Alert } from '../../types/dashboard';

interface AlertCardProps {
  alert: Alert;
  onAcknowledge?: (alertId: string) => void;
  onViewDetails?: (alert: Alert) => void;
  showActions?: boolean;
  compact?: boolean;
  className?: string;
}

export function AlertCard({
  alert,
  onAcknowledge,
  onViewDetails,
  showActions = true,
  compact = false,
  className,
}: AlertCardProps) {
  const getSeverityColor = (severity: string) => {
    const colors = {
      critical: 'bg-red-100 text-red-800 border-red-200',
      urgent: 'bg-red-50 text-red-700 border-red-200',
      high: 'bg-orange-100 text-orange-800 border-orange-200',
      medium: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      low: 'bg-gray-100 text-gray-800 border-gray-200',
    };
    return colors[severity as keyof typeof colors] || colors.low;
  };

  const getTypeIcon = (type: string) => {
    const icons = {
      incident: (
        <svg className="w-full h-full" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 19c-.77.833.192 2.5 1.732 2.5z" />
        </svg>
      ),
      maintenance: (
        <svg className="w-full h-full" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
            d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
      finance: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
            d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
        </svg>
      ),
      service: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
            d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      ),
      system: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    };
    return icons[type as keyof typeof icons] || icons.system;
  };

  if (compact) {
    return (
      <div className={cn(
        'flex items-center p-2 sm:p-3 border-l-4 bg-white shadow-sm',
        getSeverityColor(alert.severity),
        className
      )}>
        <div className="flex-shrink-0 mr-2 sm:mr-3 text-current">
          <div className="w-4 h-4 sm:w-5 sm:h-5">{getTypeIcon(alert.type)}</div>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs sm:text-sm font-medium text-gray-900 truncate">{alert.title}</p>
          <p className="text-xs text-gray-500">{formatRelativeTime(alert.createdAt || alert.timestamp)}</p>
        </div>
        {showActions && onViewDetails && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onViewDetails(alert)}
            className="ml-1 sm:ml-2 p-1"
          >
            <svg className="w-3 h-3 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                d="M9 5l7 7-7 7" />
            </svg>
          </Button>
        )}
      </div>
    );
  }

  return (
    <Card className={cn(
      'border-l-4',
      getSeverityColor(alert.severity),
      className
    )}>
      <CardContent className="p-3 sm:p-4">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div className="flex items-start space-x-2 sm:space-x-3 min-w-0 flex-1">
            <div className="flex-shrink-0 text-current">
              <div className="w-4 h-4 sm:w-5 sm:h-5">{getTypeIcon(alert.type)}</div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 mb-1">
                <h4 className="text-sm font-medium text-gray-900 truncate">{alert.title}</h4>
                <Badge variant="secondary" size="sm" className="self-start">
                  {alert.severity}
                </Badge>
              </div>
              <p className="text-sm text-gray-600 mb-2 line-clamp-2">{alert.message}</p>
              <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 text-xs text-gray-500">
                <span className="truncate">Type: {alert.type}</span>
                {alert.hotel && <span className="truncate">Hotel: {alert.hotel}</span>}
                {alert.guest && <span className="truncate">Guest: {alert.guest}</span>}
                <span className="whitespace-nowrap">{formatRelativeTime(alert.createdAt || alert.timestamp)}</span>
              </div>
            </div>
          </div>

          {showActions && (
            <div className="flex items-center space-x-1 sm:space-x-2 flex-shrink-0">
              {onViewDetails && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => onViewDetails(alert)}
                  className="text-xs sm:text-sm px-2 sm:px-3"
                >
                  Details
                </Button>
              )}
              {onAcknowledge && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => onAcknowledge(alert.id)}
                  className="text-xs sm:text-sm px-2 sm:px-3"
                >
                  Acknowledge
                </Button>
              )}
            </div>
          )}
        </div>

        {alert.action && alert.actionUrl && (
          <div className="mt-3 pt-3 border-t border-gray-100">
            <Button
              variant="ghost"
              size="sm"
              className="text-blue-600 hover:text-blue-700 text-xs sm:text-sm px-2 sm:px-3"
              onClick={() => window.open(alert.actionUrl, '_blank')}
            >
              <span className="truncate">{alert.action} →</span>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}