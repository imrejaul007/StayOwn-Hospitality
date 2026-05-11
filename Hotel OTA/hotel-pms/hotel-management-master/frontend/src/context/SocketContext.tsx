import React, { createContext, useContext, useEffect, useRef, useState, useCallback, ReactNode } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './AuthContext';
import { API_CONFIG } from '../config/api';

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
  /** Subscribe to a custom channel (e.g., 'booking:123') */
  subscribe: (channel: string) => void;
  /** Unsubscribe from a custom channel */
  unsubscribe: (channel: string) => void;
  /** Listen for a specific event */
  on: <T = unknown>(event: string, callback: (data: T) => void) => void;
  /** Remove listener for a specific event */
  off: (event: string, callback?: (...args: unknown[]) => void) => void;
}

const SocketContext = createContext<SocketContextType | undefined>(undefined);

interface SocketProviderProps {
  children: ReactNode;
}

export function SocketProvider({ children }: SocketProviderProps) {
  const { user, isAuthenticated } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  // Connect when authenticated, disconnect when not
  useEffect(() => {
    if (!isAuthenticated || !user) {
      // Disconnect if previously connected
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        setIsConnected(false);
      }
      return;
    }

    // Already connected
    if (socketRef.current?.connected) return;

    const socket = io(API_CONFIG.WS_URL, {
      path: '/ws/notifications',
      transports: ['websocket', 'polling'],
      auth: {
        // The backend reads token from socket.handshake.auth.token
        // or falls back to the accessToken cookie (sent automatically via withCredentials)
        token: undefined, // Cookie-based auth; token sent via credentials
      },
      withCredentials: true,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 30000,
    });

    socket.on('connect', () => {
      setIsConnected(true);
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
    });

    socket.on('connect_error', (err) => {
      // Silently handle — reconnection is automatic
      if (process.env.NODE_ENV === 'development') {
        console.warn('[Socket] Connection error:', err.message);
      }
    });

    socketRef.current = socket;

    return () => {
      socket.disconnect();
      socketRef.current = null;
      setIsConnected(false);
    };
  }, [isAuthenticated, user]);

  const subscribe = useCallback((channel: string) => {
    socketRef.current?.emit('subscribe', { channel });
  }, []);

  const unsubscribe = useCallback((channel: string) => {
    socketRef.current?.emit('unsubscribe', { channel });
  }, []);

  const on = useCallback(<T = unknown>(event: string, callback: (data: T) => void) => {
    socketRef.current?.on(event, callback as (...args: unknown[]) => void);
  }, []);

  const off = useCallback((event: string, callback?: (...args: unknown[]) => void) => {
    if (callback) {
      socketRef.current?.off(event, callback);
    } else {
      socketRef.current?.off(event);
    }
  }, []);

  const value: SocketContextType = {
    socket: socketRef.current,
    isConnected,
    subscribe,
    unsubscribe,
    on,
    off,
  };

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket(): SocketContextType {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
}

export default SocketContext;
