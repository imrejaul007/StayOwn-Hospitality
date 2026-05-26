import logger from './utils/logger';

const API_BASE = (() => {
  const url = process.env.EXPO_PUBLIC_API_URL;
  if (!url) {
    throw new Error('[Hotel OTA Mobile] EXPO_PUBLIC_API_URL is not configured. Set it in your .env file.');
  }
  return url;
})();

// CD-SEC-001 FIX: Tokens MUST be stored in SecureStore (iOS Keychain / Android Keystore).
// AsyncStorage stores data in plaintext accessible to any app on the device — never use
// it for access tokens or refresh tokens. expo-secure-store is available (package.json:14).
// User data (non-sensitive profile info) can still use AsyncStorage.
let SecureStore: any = null;
let AsyncStorage: any = null;
if (typeof navigator !== 'undefined' && navigator.product !== 'ReactNative') {
  // Web: SecureStore is not available; fall back to sessionStorage for tokens (session-persistent,
  // not cross-tab persistent). Auth on web should ideally use httpOnly cookies set by the backend.
  // We do NOT use localStorage for tokens — sessionStorage limits exposure to the current tab.
  // Non-sensitive user data still uses AsyncStorage (which maps to localStorage on web).
  try { AsyncStorage = require('@react-native-async-storage/async-storage').default; } catch {}
} else {
  try { SecureStore = require('expo-secure-store'); } catch {}
  try { AsyncStorage = require('@react-native-async-storage/async-storage').default; } catch {}
}

const TOKEN_KEY = 'ota_access_token';
const REFRESH_KEY = 'ota_refresh_token';
// USER_KEY stores non-sensitive profile info (name, phone prefix) — not a secret.
// Keep in AsyncStorage so it survives SecureStore failures and is accessible to non-auth flows.
const USER_KEY = 'ota_user_data';

let accessToken: string | null = null;
let refreshToken: string | null = null;

// ── Secure token helpers ────────────────────────────────────────────────────────

async function secureSet(key: string, value: string): Promise<void> {
  if (!SecureStore) {
    // Web: use sessionStorage (not localStorage) — session-scoped, not cross-session
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem(`@${key}`, value);
    }
    return;
  }
  try {
    await SecureStore.setItemAsync(key, value);
  } catch {
    // CD-SEC-001 FIX: If SecureStore fails, fail explicitly. Do NOT fall back to
    // AsyncStorage for token storage — that would re-introduce the plaintext vulnerability.
    logger.error(`[Hotel OTA API] SecureStore.setItemAsync failed for ${key} — refusing AsyncStorage fallback`);
    throw new Error(`Failed to store sensitive key '${key}' securely`);
  }
}

async function secureGet(key: string): Promise<string | null> {
  if (!SecureStore) {
    // Web: sessionStorage
    if (typeof sessionStorage !== 'undefined') {
      return sessionStorage.getItem(`@${key}`);
    }
    return null;
  }
  try {
    return await SecureStore.getItemAsync(key);
  } catch {
    // CD-SEC-001 FIX: Do NOT fall back to AsyncStorage for token reads.
    return null;
  }
}

async function secureDelete(key: string): Promise<void> {
  if (!SecureStore) {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem(`@${key}`);
    }
    return;
  }
  try {
    await SecureStore.deleteItemAsync(key);
  } catch {}
}

// ── Public API ─────────────────────────────────────────────────────────────────

export async function setTokens(access: string, refresh: string): Promise<void> {
  accessToken = access;
  refreshToken = refresh;
  // CD-SEC-001 FIX: Write to SecureStore (native) or sessionStorage (web), never AsyncStorage
  await Promise.all([
    secureSet(TOKEN_KEY, access),
    secureSet(REFRESH_KEY, refresh),
  ]);
}

export async function loadStoredTokens(): Promise<boolean> {
  try {
    const stored = await secureGet(TOKEN_KEY);
    const storedRefresh = await secureGet(REFRESH_KEY);
    if (stored) { accessToken = stored; refreshToken = storedRefresh; return true; }
  } catch {}
  return false;
}

export async function clearTokens(): Promise<void> {
  accessToken = null; refreshToken = null;
  await Promise.all([
    secureDelete(TOKEN_KEY),
    secureDelete(REFRESH_KEY),
  ]);
  // Also clear user data from AsyncStorage
  if (AsyncStorage) {
    await AsyncStorage.removeItem(USER_KEY).catch(() => {});
  }
}

export async function storeUser(user: any): Promise<void> {
  // USER_KEY stores non-sensitive profile data (name, phone prefix). AsyncStorage is acceptable here.
  if (AsyncStorage) await AsyncStorage.setItem(USER_KEY, JSON.stringify(user)).catch(() => {});
}

export async function getStoredUser(): Promise<any | null> {
  if (!AsyncStorage) return null;
  try { const raw = await AsyncStorage.getItem(USER_KEY); return raw ? JSON.parse(raw) : null; } catch { return null; }
}

export function getAccessToken() { return accessToken; }

async function apiFetch(path: string, options: RequestInit = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...options.headers,
    },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Request failed');
  return data;
}

// Auth
export const authApi = {
  sendOtp: (phone: string) => apiFetch('/auth/send-otp', { method: 'POST', body: JSON.stringify({ phone }) }),
  verifyOtp: (phone: string, otp: string, otpRef: string) =>
    apiFetch('/auth/verify-otp', { method: 'POST', body: JSON.stringify({ phone, otp, otp_ref: otpRef }) }),
  refresh: () => apiFetch('/auth/refresh', { method: 'POST', body: JSON.stringify({ refresh_token: refreshToken }) }),
};

// Hotels
export const hotelsApi = {
  search: (params: string) => apiFetch(`/hotels/search?${params}`),
  getById: (id: string) => apiFetch(`/hotels/${id}`),
};

// Bookings
export const bookingsApi = {
  hold: (data: any) => apiFetch('/bookings/hold', { method: 'POST', body: JSON.stringify(data) }),
  confirm: (data: any) => apiFetch('/bookings/confirm', { method: 'POST', body: JSON.stringify(data) }),
  list: (status = '') => apiFetch(`/bookings${status ? `?status=${status}` : ''}`),
  getById: (id: string) => apiFetch(`/bookings/${id}`),
  cancel: (id: string, reason: string) =>
    apiFetch(`/bookings/${id}/cancel`, { method: 'POST', body: JSON.stringify({ reason }) }),
};

// Wallet
export const walletApi = {
  get: () => apiFetch('/wallet'),
  getBalance: () => apiFetch('/wallet'),
  transactions: (coinType = '') => apiFetch(`/wallet/transactions${coinType ? `?coin_type=${coinType}` : ''}`),
  checkBurn: (data: any) => apiFetch('/wallet/check-burn', { method: 'POST', body: JSON.stringify(data) }),
};

// User
export const userApi = {
  getMe: () => apiFetch('/user/profile'),
  updateMe: (data: any) => apiFetch('/user/profile', { method: 'PUT', body: JSON.stringify(data) }),
};

// Stay registration
export const stayApi = {
  register: (data: any) => apiFetch('/user/stay-registration', { method: 'POST', body: JSON.stringify(data) }),
  getStatus: (id: string) => apiFetch(`/user/stay-registration/${id}`),
};

// Bill Pay
export const billPayApi = {
  initiate: (data: any) => apiFetch('/offline-payment/initiate', { method: 'POST', body: JSON.stringify(data) }),
  confirm: (data: any) => apiFetch('/offline-payment/confirm', { method: 'POST', body: JSON.stringify(data) }),
  history: () => apiFetch('/offline-payment/history'),
};

// Helpers
export function formatINR(paise: number): string {
  return '₹' + (paise / 100).toLocaleString('en-IN');
}
