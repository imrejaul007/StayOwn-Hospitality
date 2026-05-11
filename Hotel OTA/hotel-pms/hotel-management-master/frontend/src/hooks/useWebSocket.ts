import { useState, useEffect, useRef, useCallback } from 'react';
import toast from 'react-hot-toast';
import { API_CONFIG } from '../config/api';
import { realTimeService, useRealTime } from '../services/realTimeService';

export interface WebSocketMessage {
  type: string;
  data?: Record<string, unknown>;
  timestamp: string;
  userId?: string;
  role?: string;
  message?: string;
}

interface WebSocketHookOptions {
  autoConnect?: boolean;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  onMessage?: (message: WebSocketMessage) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: Event) => void;
}

export function useWebSocket(options: WebSocketHookOptions = {}) {
  const {
    autoConnect = true,
    reconnectInterval = 5000,
    maxReconnectAttempts = 5,
    onMessage,
    onConnect,
    onDisconnect,
    onError
  } = options;

  // Use the centralized realTimeService instead of creating individual connections
  const realTimeHook = useRealTime();

  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);

  // Legacy refs for compatibility (no longer used for WebSocket connections)
  const reconnectCount = useRef(0);

  // Map realTimeService connection states to useWebSocket API
  const isConnected = realTimeHook.connectionState === 'connected';
  const isConnecting = realTimeHook.connectionState === 'connecting';

  const connect = useCallback(async () => {
    try {
      await realTimeHook.connect();
      setConnectionError(null);
      onConnect?.();
    } catch (error) {
      setConnectionError(error instanceof Error ? error.message : 'Connection failed');
      onError?.(error as Event);
    }
  }, [realTimeHook.connect, onConnect, onError]);

  const disconnect = useCallback(() => {
    realTimeHook.disconnect();
    onDisconnect?.();
  }, [realTimeHook.disconnect, onDisconnect]);

  const send = useCallback((message: WebSocketMessage | Record<string, unknown>) => {
    if (isConnected) {
      // Convert useWebSocket message format to realTimeService format
      if (message.type === 'ping') {
        // realTimeService handles heartbeats internally
        return true;
      }

      // For other message types, emit through realTimeService
      realTimeService.emit('message', message);
      return true;
    }
    return false;
  }, [isConnected]);

  const handleNotification = useCallback((message: WebSocketMessage) => {
    const { data } = message;

    if (data) {
      // Show toast notification for real-time updates
      const toastOptions = {
        duration: data.priority === 'urgent' ? 8000 : 5000,
        style: {
          background: getPriorityColor(data.priority),
          color: '#fff',
        },
      };

      switch (data.type) {
        case 'inventory_damage':
          toast.error(`🔧 ${data.title}`, toastOptions);
          break;
        case 'inventory_missing':
          toast.error(`📦 ${data.title}`, toastOptions);
          break;
        case 'inventory_guest_charged':
          toast.success(`💰 ${data.title}`, toastOptions);
          break;
        case 'checkout_inspection_failed':
          toast.error(`⚠️ ${data.title}`, toastOptions);
          break;
        default:
          toast(`🔔 ${data.title || data.message}`, toastOptions);
      }

      // Play notification sound for urgent notifications
      if (data.priority === 'urgent') {
        playNotificationSound();
      }
    }
  }, []);

  // Set up event listeners for realTimeService events
  useEffect(() => {
    const handleRealTimeEvent = (eventData: Record<string, unknown>) => {
      // Convert realTimeService event format to useWebSocket message format
      const message: WebSocketMessage = {
        type: eventData.type || 'notification',
        data: eventData.data || eventData,
        timestamp: eventData.timestamp || new Date().toISOString(),
        userId: eventData.userId,
        role: eventData.role
      };

      setLastMessage(message);
      onMessage?.(message);

      // Handle different message types
      switch (message.type) {
        case 'notification':
        case 'admin_notification':
          handleNotification(message);
          break;
        default:
      }
    };

    // Listen to all real-time events
    realTimeService.on('*', handleRealTimeEvent);

    return () => {
      realTimeService.off('*', handleRealTimeEvent);
    };
  }, [onMessage, handleNotification]);

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return '#dc2626';
      case 'high': return '#ea580c';
      case 'medium': return '#d97706';
      case 'low': return '#059669';
      default: return '#4f46e5';
    }
  };

  const playNotificationSound = () => {
    try {
      // Create a simple beep sound
      const audioContext = new (window.AudioContext || (window as Record<string, unknown>).webkitAudioContext as typeof AudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.value = 800;
      oscillator.type = 'sine';
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.5);
    } catch {
      // Error handled silently
    }
  };

  // WebSocket methods - adapted for realTimeService
  const subscribe = useCallback((channels: string[]) => {
    channels.forEach(channel => {
      realTimeService.subscribe(channel);
    });
  }, []);

  const markNotificationsRead = useCallback((notificationIds: string[]) => {
    // This functionality would need to be handled at the API level
    // For now, just emit an event that can be handled by components
    realTimeService.emit('markNotificationsRead', { notificationIds });
  }, []);

  // Auto-connect on mount if enabled
  useEffect(() => {
    if (autoConnect) {
      connect();
    }

    // Don't disconnect on unmount since realTimeService is shared
    // Components will share the same connection
  }, [autoConnect, connect]);

  // Reconnect if disconnected and autoConnect is enabled
  useEffect(() => {
    if (!isConnected && autoConnect) {
      connect();
    }
  }, [isConnected, autoConnect, connect]);

  return {
    isConnected,
    isConnecting,
    connectionError,
    lastMessage,
    connect,
    disconnect,
    send,
    subscribe,
    markNotificationsRead,
    reconnectCount: realTimeHook.reconnectAttempts
  };
}

export default useWebSocket;