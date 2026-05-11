import React from 'react';
import { useRealTime } from '../../services/realTimeService';
import { Activity, AlertCircle, CheckCircle, Loader } from 'lucide-react';

interface WebSocketStatusProps {
  showDetails?: boolean;
}

export default function WebSocketStatus({ showDetails = false }: WebSocketStatusProps) {
  const { connectionState, reconnectAttempts, isConnected } = useRealTime();

  const getStatusColor = () => {
    switch (connectionState) {
      case 'connected': return 'text-green-600 bg-green-100';
      case 'connecting': return 'text-yellow-600 bg-yellow-100';
      case 'disconnected': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getStatusIcon = () => {
    switch (connectionState) {
      case 'connected': return <CheckCircle className="h-4 w-4" />;
      case 'connecting': return <Loader className="h-4 w-4 animate-spin" />;
      case 'disconnected': return <AlertCircle className="h-4 w-4" />;
      default: return <Activity className="h-4 w-4" />;
    }
  };

  return (
    <div className={`inline-flex items-center space-x-2 px-3 py-1 rounded-full text-sm ${getStatusColor()}`}>
      {getStatusIcon()}
      <span className="capitalize font-medium">{connectionState}</span>

      {showDetails && (
        <div className="text-xs opacity-75">
          {reconnectAttempts > 0 && (
            <span className="ml-2">
              (Attempt: {reconnectAttempts})
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// Debug component to show connection info in development
export function WebSocketDebugInfo() {
  const realTime = useRealTime();

  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-4 bg-white shadow-lg rounded-lg p-4 border border-gray-200 z-50">
      <div className="text-sm font-semibold text-gray-700 mb-2">
        🔌 WebSocket Debug Info
      </div>

      <div className="space-y-1 text-xs">
        <div>
          <span className="font-medium">Status:</span>{' '}
          <WebSocketStatus showDetails />
        </div>

        <div>
          <span className="font-medium">Connected:</span>{' '}
          <span className={realTime.isConnected ? 'text-green-600' : 'text-red-600'}>
            {realTime.isConnected ? 'Yes' : 'No'}
          </span>
        </div>

        <div>
          <span className="font-medium">Reconnect Attempts:</span>{' '}
          <span>{realTime.reconnectAttempts}</span>
        </div>
      </div>

      <div className="mt-2 pt-2 border-t border-gray-200">
        <button
          onClick={() => realTime.connect()}
          className="text-xs bg-blue-500 text-white px-2 py-1 rounded mr-2"
          disabled={realTime.connectionState === 'connecting'}
        >
          Connect
        </button>
        <button
          onClick={() => realTime.disconnect()}
          className="text-xs bg-red-500 text-white px-2 py-1 rounded"
        >
          Disconnect
        </button>
      </div>
    </div>
  );
}