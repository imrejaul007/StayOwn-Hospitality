import React, { useEffect, useRef, useState } from 'react';
import { Wifi, WifiOff, RefreshCw } from 'lucide-react';

export interface RealTimeUpdaterProps {
  onUpdate: () => void;
  interval?: number; // in milliseconds
  enabled?: boolean;
  className?: string;
}

const RealTimeUpdater: React.FC<RealTimeUpdaterProps> = ({
  onUpdate,
  interval = 30000, // 30 seconds default
  enabled = true,
  className = ''
}) => {
  const [isConnected, setIsConnected] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [isUpdating, setIsUpdating] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!enabled) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    const updateData = async () => {
      try {
        setIsUpdating(true);
        await onUpdate();
        setLastUpdate(new Date());
        setIsConnected(true);
      } catch (error) {
        setIsConnected(false);
      } finally {
        setIsUpdating(false);
      }
    };

    // Initial update
    updateData();

    // Set up interval
    intervalRef.current = setInterval(updateData, interval);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [onUpdate, interval, enabled]);

  const formatLastUpdate = () => {
    const now = new Date();
    const diff = now.getTime() - lastUpdate.getTime();
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);

    if (minutes > 0) {
      return `${minutes}m ago`;
    } else {
      return `${seconds}s ago`;
    }
  };

  const handleManualRefresh = async () => {
    try {
      setIsUpdating(true);
      await onUpdate();
      setLastUpdate(new Date());
      setIsConnected(true);
    } catch (error) {
      setIsConnected(false);
    } finally {
      setIsUpdating(false);
    }
  };

  if (!enabled) {
    return null;
  }

  return (
    <div className={`flex items-center gap-2 text-sm text-gray-600 ${className}`}>
      <div className="flex items-center gap-1">
        {isConnected ? (
          <Wifi className="h-4 w-4 text-green-600" />
        ) : (
          <WifiOff className="h-4 w-4 text-red-600" />
        )}
        <span className={isConnected ? 'text-green-600' : 'text-red-600'}>
          {isConnected ? 'Live' : 'Offline'}
        </span>
      </div>

      <span className="text-gray-400">•</span>

      <span>
        Last update: {formatLastUpdate()}
      </span>

      <button aria-label="Refresh"
        onClick={handleManualRefresh}
        disabled={isUpdating}
        className="p-1 text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
        title="Refresh now"
      >
        <RefreshCw className={`h-4 w-4 ${isUpdating ? 'animate-spin' : ''}`} />
      </button>
    </div>
  );
};

export default RealTimeUpdater;