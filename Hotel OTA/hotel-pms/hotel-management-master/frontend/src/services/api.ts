import axios from 'axios';
import toast from 'react-hot-toast';
import { API_CONFIG } from '../config/api';

const API_BASE_URL = API_CONFIG.BASE_URL;
export const DEFAULT_PAGE = 1;
export const DEFAULT_LIMIT = 20;
export const MAX_LIMIT = 100;

export type SortOrder = 'asc' | 'desc';

export const normalizeListParams = <
  T extends {
    page?: number;
    limit?: number;
    sort?: string;
    order?: SortOrder;
    sortBy?: string;
    sortOrder?: SortOrder;
  }
>(
  params: T = {} as T,
  defaults: { page?: number; limit?: number } = {}
) => {
  const defaultPage = defaults.page ?? DEFAULT_PAGE;
  const defaultLimit = defaults.limit ?? DEFAULT_LIMIT;
  const page = Math.max(1, Number(params.page ?? defaultPage));
  const limit = Math.min(MAX_LIMIT, Math.max(1, Number(params.limit ?? defaultLimit)));
  const sort = params.sort ?? params.sortBy;
  const order = params.order ?? params.sortOrder;

  return {
    ...params,
    page,
    limit,
    ...(sort ? { sort } : {}),
    ...(order ? { order } : {}),
  };
};

export const unwrapApiData = <T>(payload: unknown): T => {
  const body = (payload || {}) as { data?: unknown };
  return (body.data ?? body) as T;
};

const bytesToHex = (bytes: number[]): string =>
  bytes
    .map((b) => Number(b).toString(16).padStart(2, '0'))
    .join('');

export const normalizeEntityId = (raw: unknown): string => {
  if (raw == null) return '';
  if (typeof raw === 'string' || typeof raw === 'number') return String(raw);

  if (typeof raw === 'object') {
    const obj = raw as Record<string, unknown>;
    const nested = obj._id ?? obj.id ?? obj.$oid ?? obj;

    if (typeof nested === 'string' || typeof nested === 'number') {
      return String(nested);
    }

    if (nested && typeof nested === 'object') {
      const nestedObj = nested as Record<string, unknown>;
      const bufferLike = nestedObj.buffer ?? nestedObj.data;

      if (Array.isArray(bufferLike)) {
        return bytesToHex(bufferLike as number[]);
      }

      if (bufferLike && typeof bufferLike === 'object') {
        const orderedBytes = Object.keys(bufferLike)
          .filter((k) => /^\d+$/.test(k))
          .sort((a, b) => Number(a) - Number(b))
          .map((k) => Number((bufferLike as Record<string, unknown>)[k]));
        if (orderedBytes.length > 0) return bytesToHex(orderedBytes);
      }

      const maybeString = nestedObj.toString?.();
      if (maybeString && maybeString !== '[object Object]') return maybeString;
    }
  }

  return String(raw);
};

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

/**
 * Axios `Idempotency-Key` header for these paths only.
 * Booking create uses **body** `idempotencyKey` enforced in `backend/src/modules/booking/service.js` — do not duplicate here.
 */
const IDEMPOTENT_MUTATION_PATTERNS = [
  /^\/payments\/intent$/,
  /^\/payments\/confirm$/,
  /^\/payments\/extra-person-charges\/intent$/,
  /^\/payments\/settlement\/intent$/,
  /^\/payments\/refund$/,
  /^\/payments\/room-charge$/,
  /^\/payments\/cash-on-delivery$/,
  /^\/invoices$/,
  /^\/invoices\/[^/]+$/,
  /^\/invoices\/[^/]+\/payments$/,
  /^\/invoices\/[^/]+\/discounts$/,
  /^\/invoices\/[^/]+\/split-billing$/,
  /^\/invoices\/[^/]+\/splits\/[^/]+\/pay$/,
  /^\/invoices\/supplementary\/extra-person-charges$/,
  /^\/invoices\/supplementary\/settlement$/,
  /^\/invoices\/[^/]+\/add-extra-charges$/
];

const createIdempotencyKey = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `idem_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
};

/** localStorage sometimes holds the literal "undefined" / "null" — never send those as hotelId. */
function sanitizeStoredPropertyId(raw: string | null): string | null {
  if (raw == null) return null;
  const t = raw.trim();
  if (t === '' || t === 'null' || t === 'undefined') return null;
  return t;
}

function getCookieValue(name: string): string | null {
  if (typeof document === 'undefined' || !document.cookie) return null;
  const parts = document.cookie.split(';');
  for (const part of parts) {
    const [k, ...rest] = part.trim().split('=');
    if (k === name) {
      const raw = rest.join('=');
      if (!raw) return null;
      try {
        return decodeURIComponent(raw);
      } catch {
        return raw;
      }
    }
  }
  return null;
}

const isIdempotentProtectedMutation = (config: { method?: string; url?: string }) => {
  const method = (config.method || '').toLowerCase();
  if (!['post', 'put', 'patch'].includes(method)) {
    return false;
  }

  const rawUrl = config.url || '';
  const cleanPath = rawUrl.split('?')[0].replace(/^https?:\/\/[^/]+/i, '');

  return IDEMPOTENT_MUTATION_PATTERNS.some((pattern) => pattern.test(cleanPath));
};

// Request interceptor to add CSRF token and selected property
api.interceptors.request.use(
  (config) => {
    const rawStored = localStorage.getItem('selectedPropertyId');
    const selectedPropertyId = sanitizeStoredPropertyId(rawStored);
    if (rawStored !== null && !selectedPropertyId) {
      localStorage.removeItem('selectedPropertyId');
    }

    // Add CSRF token from cookie for state-changing requests
    if (['post', 'put', 'patch', 'delete'].includes(config.method || '')) {
      const csrfToken = getCookieValue('csrfToken');
      if (csrfToken) {
        config.headers['X-CSRF-Token'] = csrfToken;
      }
    }

    // Add cache-busting headers for GET requests
    if (config.method?.toUpperCase() === 'GET') {
      config.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate';
      config.headers['Pragma'] = 'no-cache';
      config.headers['Expires'] = '0';
    }

    // Drop bogus tenant/property IDs from params (avoids [object Object]/undefined in query string)
    if (config.method?.toUpperCase() === 'GET' && config.params && typeof config.params === 'object') {
      const p = config.params as Record<string, unknown>;
      if ('hotelId' in p) {
        const ok = sanitizeStoredPropertyId(p.hotelId == null ? null : String(p.hotelId));
        if (!ok) delete p.hotelId;
        else p.hotelId = ok;
      }
      if ('propertyId' in p) {
        const rawProperty = p.propertyId;
        if (rawProperty && typeof rawProperty === 'object') {
          const propertyObj = rawProperty as Record<string, unknown>;
          const candidate = propertyObj._id ?? propertyObj.id ?? null;
          p.propertyId = candidate == null ? '' : String(candidate);
        }
        const okProperty = sanitizeStoredPropertyId(p.propertyId == null ? null : String(p.propertyId));
        if (!okProperty) delete p.propertyId;
        else p.propertyId = okProperty;
      }
    }

    // Add selected property ID to requests if available
    // BUT: Skip for auth endpoints and certain other endpoints that don't need it
    if (selectedPropertyId) {
      if (config.method?.toUpperCase() === 'GET') {
        const skipHotelIdEndpoints = [
          '/auth/me',        // Getting current user - doesn't need hotelId
          '/auth/login',     // Login - no auth context yet
          '/auth/register',  // Register - no auth context yet
          '/auth/logout',    // Logout - user context not needed
        ];
        
        const shouldSkipHotelId = skipHotelIdEndpoints.some(endpoint => 
          config.url?.includes(endpoint)
        );

        if (!shouldSkipHotelId) {
          config.params = config.params || {};
          const urlHasHotelId = config.url?.includes('hotelId=');
          const paramsHaveHotelId = config.params.hotelId;
          if (!urlHasHotelId && !paramsHaveHotelId) {
            config.params.hotelId = selectedPropertyId;
          }
        }
      } else if (['POST', 'PUT', 'PATCH'].includes(config.method?.toUpperCase() || '')) {
        const skipMutationHotelIdEndpoints = [
          '/auth/login',
          '/auth/register',
          '/auth/logout',
          '/auth/refresh',
          '/auth/profile',
          '/auth/change-password'
        ];
        const shouldSkipMutationHotelId = skipMutationHotelIdEndpoints.some((endpoint) =>
          config.url?.includes(endpoint)
        );
        if (!shouldSkipMutationHotelId && config.data && typeof config.data === 'object' && !config.data.hotelId) {
          config.data.hotelId = selectedPropertyId;
        }
      }
    }

    // Attach idempotency key for payment/invoice financial mutations.
    // Keep existing key if caller already supplied one.
    if (isIdempotentProtectedMutation(config)) {
      const hasIdempotencyKey =
        !!config.headers['Idempotency-Key'] ||
        !!config.headers['idempotency-key'] ||
        !!config.headers['X-Idempotency-Key'] ||
        !!config.headers['x-idempotency-key'];

      if (!hasIdempotencyKey) {
        config.headers['Idempotency-Key'] = createIdempotencyKey();
      }
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Token refresh state
let isRefreshing = false;
let failedQueue: Array<{ resolve: (value?: unknown) => void; reject: (reason?: unknown) => void }> = [];

const processQueue = (error: unknown) => {
  failedQueue.forEach(prom => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve();
    }
  });
  failedQueue = [];
};

// Prevent infinite redirect loops
let isRedirecting = false;
let redirectResetTimer: ReturnType<typeof setTimeout> | null = null;

// Response interceptor with automatic token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const { response } = error;

    // Handle 401 -- attempt token refresh before redirecting
    if (response?.status === 401 && !originalRequest._retry) {
      // Don't retry refresh or logout endpoints
      if (originalRequest.url?.includes('/auth/refresh') || originalRequest.url?.includes('/auth/logout')) {
        if (!isRedirecting && !window.location.pathname.includes('/login')) {
          isRedirecting = true;
          localStorage.removeItem('selectedPropertyId');
          window.location.href = '/login';
          if (redirectResetTimer) clearTimeout(redirectResetTimer);
          redirectResetTimer = setTimeout(() => { isRedirecting = false; redirectResetTimer = null; }, 2000);
        }
        return Promise.reject(error);
      }

      if (isRefreshing) {
        // Queue the request while refresh is in progress
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then(() => api(originalRequest));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        await api.post('/auth/refresh');
        processQueue(null);
        isRefreshing = false;
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError);
        isRefreshing = false;
        if (!isRedirecting && !window.location.pathname.includes('/login')) {
          isRedirecting = true;
          localStorage.removeItem('selectedPropertyId');
          window.location.href = '/login';
          if (redirectResetTimer) clearTimeout(redirectResetTimer);
          redirectResetTimer = setTimeout(() => { isRedirecting = false; redirectResetTimer = null; }, 2000);
        }
        return Promise.reject(refreshError);
      }
    }

    if (response?.status === 429) {
      toast.error('Too many requests. Please wait a moment and try again.');
      return Promise.reject(error);
    }

    if (response?.status >= 500) {
      toast.error(response?.data?.error?.message || 'Server error. Please try again later.');
    }
    // Let component-level catch handlers display specific error messages for 4xx errors

    return Promise.reject(error);
  }
);

// Centralized Rates API
export const centralizedRatesApi = {
  // Rate CRUD operations
  createRate: (data: Record<string, unknown>) => api.post('/centralized-rates', data),
  getRates: (params?: Record<string, unknown>) => api.get('/centralized-rates', { params }),
  getRateById: (rateId: string, params?: Record<string, unknown>) => api.get(`/centralized-rates/${rateId}`, { params }),
  updateRate: (rateId: string, data: Record<string, unknown>) => api.put(`/centralized-rates/${rateId}`, data),
  deleteRate: (rateId: string) => api.delete(`/centralized-rates/${rateId}`),
  
  // Rate operations
  distributeRate: (rateId: string, data: Record<string, unknown>) => api.post(`/centralized-rates/${rateId}/distribute`, data),
  calculateRate: (rateId: string, data: Record<string, unknown>) => api.post(`/centralized-rates/${rateId}/calculate`, data),
  validateRate: (rateId: string) => api.get(`/centralized-rates/${rateId}/validate`),
  duplicateRate: (rateId: string, data: Record<string, unknown>) => api.post(`/centralized-rates/${rateId}/duplicate`, data),
  updateRateStatus: (rateId: string, data: Record<string, unknown>) => api.patch(`/centralized-rates/${rateId}/status`, data),
  
  // Distribution and sync
  previewDistribution: (rateId: string, data: Record<string, unknown>) => api.post(`/centralized-rates/${rateId}/preview-distribution`, data),
  syncRates: (groupId: string, data?: Record<string, unknown>) => api.post(`/centralized-rates/group/${groupId}/sync`, data),
  
  // Analytics and reporting
  getRateAnalytics: (rateId: string, params?: Record<string, unknown>) => api.get(`/centralized-rates/${rateId}/analytics`, { params }),
  getRateHistory: (rateId: string, params?: Record<string, unknown>) => api.get(`/centralized-rates/${rateId}/history`, { params }),
  getGroupDashboard: (groupId: string, params?: Record<string, unknown>) => api.get(`/centralized-rates/group/${groupId}/dashboard`, { params }),
  exportRates: (params?: Record<string, unknown>) => api.get('/centralized-rates/export', { params }),
  
  // Conflict management
  getConflicts: (params?: Record<string, unknown>) => api.get('/centralized-rates/conflicts', { params }),
  resolveConflict: (conflictId: string, data: Record<string, unknown>) => api.post(`/centralized-rates/conflicts/${conflictId}/resolve`, data),
  
  // Additional utility functions
  getRateDistribution: (rateId: string) => api.get(`/centralized-rates/${rateId}/distribution`),
  getActiveConflicts: (rateId: string) => api.get(`/centralized-rates/${rateId}/conflicts`),
  getDashboardStats: () => api.get('/centralized-rates/dashboard/stats'),
  getGroupAnalytics: (groupId: string, params?: Record<string, unknown>) => api.get(`/centralized-rates/group/${groupId}/analytics`, { params }),
  syncRate: (rateId: string) => api.post(`/centralized-rates/${rateId}/sync`)
};

// Property Groups API
export const propertyGroupsApi = {
  // Group CRUD operations
  createGroup: (data: Record<string, unknown>) => api.post('/property-groups', data),
  getGroups: (params?: Record<string, unknown>) => api.get('/property-groups', { params }),
  getGroupById: (groupId: string, params?: Record<string, unknown>) => api.get(`/property-groups/${groupId}`, { params }),
  updateGroup: (groupId: string, data: Record<string, unknown>) => api.put(`/property-groups/${groupId}`, data),
  deleteGroup: (groupId: string) => api.delete(`/property-groups/${groupId}`),
  
  // Group operations
  getGroupStats: (groupId: string) => api.get(`/property-groups/${groupId}/stats`),
  addPropertiesToGroup: (groupId: string, data: Record<string, unknown>) => api.post(`/property-groups/${groupId}/properties`, data),
  removePropertiesFromGroup: (groupId: string, data: Record<string, unknown>) => api.delete(`/property-groups/${groupId}/properties`, { data }),
  syncGroupSettings: (groupId: string, data?: Record<string, unknown>) => api.post(`/property-groups/${groupId}/sync`, data),
  
  // Dashboard and analytics
  getConsolidatedDashboard: (groupId: string, params?: Record<string, unknown>) => api.get(`/property-groups/${groupId}/dashboard`, { params }),
  getPropertyGroupAuditLog: (groupId: string, params?: Record<string, unknown>) => api.get(`/property-groups/${groupId}/audit-log`, { params }),
  
  // Settings management
  updateGroupSettings: (groupId: string, data: Record<string, unknown>) => api.patch(`/property-groups/${groupId}/settings`, data)
};

// API Management API
export const apiManagementApi = {
  // API Keys CRUD operations
  createAPIKey: (data: Record<string, unknown>) => api.post('/api-management/api-keys', data),
  getAPIKeys: (params?: Record<string, unknown>) => api.get('/api-management/api-keys', { params }),
  getAPIKeyById: (keyId: string, params?: Record<string, unknown>) => api.get(`/api-management/api-keys/${keyId}`, { params }),
  updateAPIKey: (keyId: string, data: Record<string, unknown>) => api.put(`/api-management/api-keys/${keyId}`, data),
  deleteAPIKey: (keyId: string) => api.delete(`/api-management/api-keys/${keyId}`),
  toggleAPIKeyStatus: (keyId: string) => api.patch(`/api-management/api-keys/${keyId}/toggle`),
  
  // Webhook CRUD operations
  createWebhook: (data: Record<string, unknown>) => api.post('/api-management/webhooks', data),
  getWebhooks: (params?: Record<string, unknown>) => api.get('/api-management/webhooks', { params }),
  getWebhookById: (webhookId: string, params?: Record<string, unknown>) => api.get(`/api-management/webhooks/${webhookId}`, { params }),
  updateWebhook: (webhookId: string, data: Record<string, unknown>) => api.put(`/api-management/webhooks/${webhookId}`, data),
  deleteWebhook: (webhookId: string) => api.delete(`/api-management/webhooks/${webhookId}`),
  testWebhook: (webhookId: string) => api.post(`/api-management/webhooks/${webhookId}/test`),
  regenerateWebhookSecret: (webhookId: string) => api.post(`/api-management/webhooks/${webhookId}/regenerate-secret`),
  
  // API Endpoints Catalog
  getAllEndpoints: (params?: Record<string, unknown>) => api.get('/api-management/endpoints', { params }),

  // Metrics and Analytics
  getMetrics: (params?: Record<string, unknown>) => api.get('/api-management/metrics', { params }),
  getTopEndpoints: (params?: Record<string, unknown>) => api.get('/api-management/metrics/endpoints', { params }),
  getEndpointMetrics: (endpoint: string, params?: Record<string, unknown>) => api.get(`/api-management/metrics/endpoints/${encodeURIComponent(endpoint)}`, { params }),
  getAPIKeyUsage: (params?: Record<string, unknown>) => api.get('/api-management/metrics/api-keys', { params }),
  getWebhookStats: (params?: Record<string, unknown>) => api.get('/api-management/metrics/webhooks', { params }),
  
  // Export functionality
  exportLogs: (params?: Record<string, unknown>) => api.get('/api-management/export/logs', { params, responseType: 'blob' }),

  // API Documentation
  getAPIDocumentation: () => api.get('/api-management/documentation'),
};

// Generic API request function used by hooks
export const apiRequest = async (url: string, options?: {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  body?: string;
  headers?: Record<string, string>;
}) => {
  const { method = 'GET', body, headers } = options || {};

  const config = {
    method,
    url,
    ...(body && { data: JSON.parse(body) }),
    ...(headers && { headers: { ...api.defaults.headers.common, ...headers } })
  };

  const response = await api.request(config);
  return response.data;
};

// Departments API
export const departmentsApi = {
  getDepartments: (params?: Record<string, unknown>) => api.get('/departments', { params }),
  getDepartmentById: (id: string) => api.get(`/departments/${id}`),
  createDepartment: (data: Record<string, unknown>) => api.post('/departments', data),
  updateDepartment: (id: string, data: Record<string, unknown>) => api.put(`/departments/${id}`, data),
  deleteDepartment: (id: string) => api.delete(`/departments/${id}`),
};

export { api };