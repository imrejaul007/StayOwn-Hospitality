const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/v1';

const COOKIE_NAME = 'hotel_admin_session';

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
  if (!res.ok) throw new Error(data.message || 'Request failed');
  return data;
}

export const authApi = {
  login: (email: string, password: string) =>
    apiFetch('/auth/admin/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  logout: () => apiFetch('/auth/logout', { method: 'POST' }),
};

export const hotelsApi = {
  list: (page = 1, status = '') =>
    apiFetch(`/admin/hotels?page=${page}${status ? `&status=${status}` : ''}`),
  get: (id: string) => apiFetch(`/admin/hotels/${id}`),
  updateStatus: (id: string, status: string) =>
    apiFetch(`/admin/hotels/${id}/status`, { method: 'PUT', body: JSON.stringify({ status }) }),
  onboarding: (page = 1) => apiFetch(`/admin/hotels/onboarding?page=${page}`),
  approveOnboarding: (id: string) =>
    apiFetch(`/admin/hotels/${id}/onboarding/approve`, { method: 'PUT' }),
  rejectOnboarding: (id: string, reason: string) =>
    apiFetch(`/admin/hotels/${id}/onboarding/reject`, { method: 'PUT', body: JSON.stringify({ reason }) }),
};

export const bookingsApi = {
  list: (page = 1, status = '') =>
    apiFetch(`/admin/bookings?page=${page}${status ? `&status=${status}` : ''}`),
};

export const usersApi = {
  list: (page = 1, search = '') =>
    apiFetch(`/admin/users?page=${page}${search ? `&search=${encodeURIComponent(search)}` : ''}`),
  get: (id: string) => apiFetch(`/admin/users/${id}`),
  suspend: (id: string, reason: string) =>
    apiFetch(`/admin/users/${id}/suspend`, { method: 'PUT', body: JSON.stringify({ reason }) }),
  unsuspend: (id: string) =>
    apiFetch(`/admin/users/${id}/unsuspend`, { method: 'PUT' }),
  adjustCoins: (id: string, amount: number, reason: string) =>
    apiFetch(`/admin/users/${id}/coins/adjust`, { method: 'POST', body: JSON.stringify({ amount_paise: amount, reason }) }),
};

export const earnRulesApi = {
  list: () => apiFetch('/admin/earn-rules'),
  create: (data: any) => apiFetch('/admin/earn-rules', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: any) => apiFetch(`/admin/earn-rules/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: string) => apiFetch(`/admin/earn-rules/${id}`, { method: 'DELETE' }),
};

export const burnRulesApi = {
  list: () => apiFetch('/admin/burn-rules'),
  create: (data: any) => apiFetch('/admin/burn-rules', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: any) => apiFetch(`/admin/burn-rules/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: string) => apiFetch(`/admin/burn-rules/${id}`, { method: 'DELETE' }),
};

export const coinLiabilityApi = {
  get: () => apiFetch('/admin/coin-liability'),
};

export const settlementsApi = {
  list: (page = 1, status = '') =>
    apiFetch(`/admin/settlements?page=${page}${status ? `&status=${status}` : ''}`),
  approveBatch: (batchId: string) =>
    apiFetch('/admin/settlements/approve-batch', { method: 'POST', body: JSON.stringify({ batch_id: batchId }) }),
  history: (page = 1) => apiFetch(`/admin/settlements/history?page=${page}`),
};

export const miningApi = {
  preview: (period: string) => apiFetch(`/admin/ownership-mining/preview?period=${period}`),
  run: (period: string) =>
    apiFetch('/admin/ownership-mining/run', { method: 'POST', body: JSON.stringify({ period }) }),
  status: (runId: string) => apiFetch(`/admin/ownership-mining/runs/${runId}`),
  disputes: (page = 1) => apiFetch(`/admin/ownership-mining/disputes?page=${page}`),
  resolveDispute: (id: string, data: any) =>
    apiFetch(`/admin/ownership-mining/disputes/${id}/resolve`, { method: 'PUT', body: JSON.stringify(data) }),
};

export const stayRegistrationsApi = {
  list: (page = 1, status = 'pending') =>
    apiFetch(`/admin/stay-registrations?page=${page}&status=${status}`),
  approve: (id: string, coinsPaise: number) =>
    apiFetch(`/admin/stay-registrations/${id}/approve`, { method: 'PUT', body: JSON.stringify({ coins_to_award_paise: coinsPaise }) }),
  reject: (id: string, reason: string) =>
    apiFetch(`/admin/stay-registrations/${id}/reject`, { method: 'PUT', body: JSON.stringify({ reason }) }),
};

export const rezApi = {
  status: () => apiFetch('/admin/rez/status'),
  webhookHealth: () => apiFetch('/admin/rez/webhook-health'),
  failures: (page = 1) => apiFetch(`/admin/rez/failures?page=${page}`),
  attributionLog: (page = 1) => apiFetch(`/admin/rez/attribution-log?page=${page}`),
  retryWebhook: (id: string) =>
    apiFetch(`/admin/rez/failures/${id}/retry`, { method: 'POST' }),
};

export const configApi = {
  get: () => apiFetch('/admin/config'),
  update: (data: any) => apiFetch('/admin/config', { method: 'PUT', body: JSON.stringify(data) }),
  getCities: () => apiFetch('/admin/config/cities'),
  addCity: (city: string) =>
    apiFetch('/admin/config/cities', { method: 'POST', body: JSON.stringify({ city }) }),
  removeCity: (city: string) =>
    apiFetch(`/admin/config/cities/${encodeURIComponent(city)}`, { method: 'DELETE' }),
};

export const adminUsersApi = {
  list: () => apiFetch('/admin/admin-users'),
  create: (data: any) => apiFetch('/admin/admin-users', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: any) =>
    apiFetch(`/admin/admin-users/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deactivate: (id: string) =>
    apiFetch(`/admin/admin-users/${id}/deactivate`, { method: 'PUT' }),
};

export const dashboardApi = {
  kpis: () => apiFetch('/admin/dashboard/kpis'),
  liveFeed: () => apiFetch('/admin/dashboard/live-feed'),
  alerts: () => apiFetch('/admin/dashboard/alerts'),
};

export const billPaymentsApi = {
  list: (page = 1, hotelId = '') =>
    apiFetch(`/admin/bill-payments?page=${page}${hotelId ? `&hotel_id=${hotelId}` : ''}`),
};

export function formatINR(paise: number): string {
  return '₹' + (paise / 100).toLocaleString('en-IN');
}
