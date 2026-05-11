const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/v1';

const COOKIE_NAME = 'ota_session';

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

export function getUser(): any {
  if (typeof window !== 'undefined') {
    const u = localStorage.getItem('ota_user');
    return u ? JSON.parse(u) : null;
  }
  return null;
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
  sendOtp: (phone: string) => apiFetch('/auth/send-otp', { method: 'POST', body: JSON.stringify({ phone }) }),
  verifyOtp: (phone: string, otp: string, otpRef: string) =>
    apiFetch('/auth/verify-otp', { method: 'POST', body: JSON.stringify({ phone, otp, otp_ref: otpRef }) }),
};

export const hotelsApi = {
  list: (page = 1, perPage = 50) => apiFetch(`/hotels?page=${page}&per_page=${perPage}`),
  search: (city: string, checkin: string, checkout: string, rooms = 1, guests = 2) =>
    apiFetch(`/hotels/search?city=${city}&checkin=${checkin}&checkout=${checkout}&rooms=${rooms}&guests=${guests}`),
  getById: (id: string) => apiFetch(`/hotels/${id}`),
};

export const bookingsApi = {
  hold: (data: any) => apiFetch('/bookings/hold', { method: 'POST', body: JSON.stringify(data) }),
  confirm: (data: any) => apiFetch('/bookings/confirm', { method: 'POST', body: JSON.stringify(data) }),
  list: (status = '') => apiFetch(`/bookings${status ? `?status=${status}` : ''}`),
  getById: (id: string) => apiFetch(`/bookings/${id}`),
  cancel: (id: string, reason: string) =>
    apiFetch(`/bookings/${id}/cancel`, { method: 'POST', body: JSON.stringify({ reason }) }),
};

export const walletApi = {
  get: () => apiFetch('/wallet'),
  transactions: (page = 1, coinType = '') =>
    apiFetch(`/wallet/transactions?page=${page}${coinType ? `&coin_type=${coinType}` : ''}`),
  checkBurn: (data: any) => apiFetch('/wallet/check-burn', { method: 'POST', body: JSON.stringify(data) }),
};

export const userApi = {
  getProfile: () => apiFetch('/user/profile'),
  updateProfile: (data: any) => apiFetch('/user/profile', { method: 'PUT', body: JSON.stringify(data) }),
  registerStay: (data: any) => apiFetch('/user/register-stay', { method: 'POST', body: JSON.stringify(data) }),
  getStayRegistrations: () => apiFetch('/user/register-stay'),
};

export const reviewsApi = {
  getForHotel: (hotelId: string) => apiFetch(`/reviews/hotel/${hotelId}`),
  submit: (data: any) => apiFetch('/reviews', { method: 'POST', body: JSON.stringify(data) }),
};

export const wishlistApi = {
  list: () => apiFetch('/wishlists'),
  add: (hotelId: string) => apiFetch(`/wishlists/${hotelId}`, { method: 'POST' }),
  remove: (hotelId: string) => apiFetch(`/wishlists/${hotelId}`, { method: 'DELETE' }),
};

export const referralApi = {
  getCode: () => apiFetch('/user/referral-code'),
};

export const billPayApi = {
  initiate: (data: any) => apiFetch('/offline-payment/initiate', { method: 'POST', body: JSON.stringify(data) }),
  confirm: (data: any) => apiFetch('/offline-payment/confirm', { method: 'POST', body: JSON.stringify(data) }),
  history: () => apiFetch('/offline-payment/history'),
};

export function formatINR(paise: number): string {
  return '₹' + (paise / 100).toLocaleString('en-IN');
}

export function formatDate(d: string): string {
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}
