// API Configuration for deployment compatibility
const getApiBaseUrl = (): string => {
  // Check if we have an environment variable for the API URL
  if ((import.meta as any).env?.VITE_API_URL) {
    return (import.meta as any).env.VITE_API_URL;
  }
  
  // In production, use relative URLs to work with reverse proxy/same domain
  if ((import.meta as any).env?.PROD) {
    return '/api/v1';
  }
  
  // In development, use localhost
  return 'http://localhost:4000/api/v1';
};

const getWebSocketUrl = (): string => {
  // Check if we have an environment variable for the WebSocket URL
  if ((import.meta as any).env?.VITE_WS_URL) {
    return (import.meta as any).env.VITE_WS_URL;
  }

  // In production, use relative URLs to work with reverse proxy/same domain
  if ((import.meta as any).env?.PROD) {
    return window.location.origin;
  }

  // In development, use localhost with HTTP protocol for Socket.IO
  return 'http://localhost:4000';
};

export const API_CONFIG = {
  BASE_URL: getApiBaseUrl(),
  WS_URL: getWebSocketUrl(),
  TIMEOUT: 30000, // 30 seconds
  RETRY_ATTEMPTS: 3,
} as const;

export default API_CONFIG;
