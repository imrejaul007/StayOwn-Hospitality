const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/v1';

const COOKIE_NAME = 'hotel_panel_session';

export function setSessionCookie(token: string) {
  if (typeof window !== 'undefined') {
    document.cookie = `${COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${7 * 24 * 60 * 60}`;
  }
}

export function clearSessionCookie() {
  if (typeof window !== 'undefined') {
    document.cookie = `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
  }
}

async function apiFetch(path: string, options: RequestInit = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (res.status === 401) {
    clearSessionCookie();
    if (typeof window !== 'undefined') {
      window.location.href = '/';
    }
    throw new Error('Session expired. Please log in again.');
  }

  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'API request failed');
  return data;
}

// Auth
export const authApi = {
  sendOtp: (phone: string) => apiFetch('/auth/hotel/send-otp', { method: 'POST', body: JSON.stringify({ phone }) }),
  verifyOtp: (phone: string, otp: string, otpRef: string) =>
    apiFetch('/auth/hotel/verify-otp', { method: 'POST', body: JSON.stringify({ phone, otp, otp_ref: otpRef }) }),
  logout: () => apiFetch('/auth/logout', { method: 'POST' }),
};

// Dashboard
export const dashboardApi = {
  get: () => apiFetch('/hotel/dashboard'),
  todayCheckins: () => apiFetch('/hotel/bookings?status=confirmed&checkin_from=' + new Date().toISOString().split('T')[0] + '&checkin_to=' + new Date().toISOString().split('T')[0]),
  todayCheckouts: () => apiFetch('/hotel/bookings?status=checked_in&checkin_to=' + new Date().toISOString().split('T')[0]),
};

// Inventory
export const inventoryApi = {
  get: (from: string, to: string) => apiFetch(`/hotel/inventory?from=${from}&to=${to}`),
  update: (roomTypeId: string, date: string, data: any) =>
    apiFetch(`/hotel/inventory/${roomTypeId}/${date}`, { method: 'PUT', body: JSON.stringify(data) }),
};

// Bookings
export const bookingsApi = {
  list: (params: string = '') => apiFetch(`/hotel/bookings${params ? '?' + params : ''}`),
  checkin: (bookingId: string) => apiFetch(`/hotel/bookings/${bookingId}/checkin`, { method: 'POST' }),
  checkout: (bookingId: string) => apiFetch(`/hotel/bookings/${bookingId}/checkout`, { method: 'POST' }),
};

// Settlement
export const settlementApi = {
  get: (page = 1) => apiFetch(`/hotel/settlement?page=${page}`),
};

// Ownership
export const ownershipApi = {
  dashboard: () => apiFetch('/mining/hotel/dashboard'),
  performanceHistory: () => apiFetch('/mining/hotel/performance-history'),
  vestingTimeline: () => apiFetch('/mining/hotel/vesting-timeline'),
  networkStanding: () => apiFetch('/mining/hotel/network-standing'),
  projections: () => apiFetch('/mining/hotel/projections'),
  submitDispute: (data: any) => apiFetch('/mining/hotel/dispute', { method: 'POST', body: JSON.stringify(data) }),
  disputeStatus: () => apiFetch('/mining/hotel/dispute-status'),
};

// Pricing
export const pricingApi = {
  getSuggestions: () => apiFetch('/pricing/suggestions'),
  acceptSuggestion: (id: string) => apiFetch(`/pricing/suggestions/${id}/accept`, { method: 'POST' }),
  rejectSuggestion: (id: string) => apiFetch(`/pricing/suggestions/${id}/reject`, { method: 'POST' }),
  getForecast: () => apiFetch('/pricing/forecast'),
};

// Channel Manager
export const channelManagerApi = {
  configure: (data: any) => apiFetch('/channel-manager/configure', { method: 'POST', body: JSON.stringify(data) }),
  sync: () => apiFetch('/channel-manager/sync', { method: 'POST' }),
  getLogs: () => apiFetch('/channel-manager/logs'),
};

// Hotel Brand Coin Program
export const brandCoinApi = {
  getProgram: () => apiFetch('/hotel/brand-coin/program'),
  updateProgram: (data: {
    brand_coin_name: string;
    brand_coin_symbol: string;
    earn_pct: number;
    max_burn_pct: number;
  }) => apiFetch('/hotel/brand-coin/program', { method: 'PUT', body: JSON.stringify(data) }),
  getMembers: (page = 1) => apiFetch(`/hotel/brand-coin/members?page=${page}`),
};
