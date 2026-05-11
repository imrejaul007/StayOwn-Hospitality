/**
 * Onboarding API Client
 * Handles all API calls for the hotel onboarding flow
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/v1';

interface RoomConfig {
  roomId: string;
  roomNumber: string;
  floor: string;
  roomType: string;
  price: number;
  qrCode?: string;
  printUrl?: string;
}

interface StaffInvite {
  email: string;
  role: string;
}

export interface OnboardingSession {
  sessionId: string;
  token: string;
  step: number;
  hotelName?: string;
  location?: string;
  hotelType?: string;
  starRating?: number;
  phone?: string;
  constactEmail?: string;
  rooms?: RoomConfig[];
  services?: Record<string, boolean>;
  staffInvites?: StaffInvite[];
  createdAt?: string;
  expiresAt?: string;
}

interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  session?: OnboardingSession;
  error?: string;
}

async function apiFetch<T = any>(path: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.message || data.error || 'Request failed');
  }

  return data;
}

export const onboardingApi = {
  /**
   * Start a new onboarding session with an invitation token
   */
  start: async (token: string): Promise<{ session: OnboardingSession }> => {
    const response = await apiFetch('/hotel/onboarding/start', {
      method: 'POST',
      body: JSON.stringify({ token }),
    });
    return { session: response.session! };
  },

  /**
   * Save Step 1 - Hotel Information
   */
  saveStep1: async (
    sessionId: string,
    data: Partial<OnboardingSession>
  ): Promise<{ session: OnboardingSession }> => {
    const response = await apiFetch(`/hotel/onboarding/step-1`, {
      method: 'POST',
      body: JSON.stringify({
        sessionId,
        hotelName: data.hotelName,
        location: data.location,
        hotelType: data.hotelType,
        starRating: data.starRating,
        phone: data.phone,
        constactEmail: data.constactEmail,
      }),
    });
    return { session: response.session! };
  },

  /**
   * Save Step 2 - Room Configuration
   */
  saveStep2: async (
    sessionId: string,
    data: Partial<OnboardingSession>
  ): Promise<{ session: OnboardingSession }> => {
    const response = await apiFetch(`/hotel/onboarding/step-2`, {
      method: 'POST',
      body: JSON.stringify({
        sessionId,
        rooms: data.rooms,
      }),
    });
    return { session: response.session! };
  },

  /**
   * Save Step 3 - Services Configuration
   */
  saveStep3: async (
    sessionId: string,
    data: Partial<OnboardingSession>
  ): Promise<{ session: OnboardingSession }> => {
    const response = await apiFetch(`/hotel/onboarding/step-3`, {
      method: 'POST',
      body: JSON.stringify({
        sessionId,
        services: data.services,
      }),
    });
    return { session: response.session! };
  },

  /**
   * Save Step 4 - Staff Invitations
   */
  saveStep4: async (
    sessionId: string,
    data: Partial<OnboardingSession>
  ): Promise<{ session: OnboardingSession }> => {
    const response = await apiFetch(`/hotel/onboarding/step-4`, {
      method: 'POST',
      body: JSON.stringify({
        sessionId,
        staffInvites: data.staffInvites,
      }),
    });
    return { session: response.session! };
  },

  /**
   * Complete the onboarding process
   */
  complete: async (sessionId: string): Promise<{ hotelId: string }> => {
    const response = await apiFetch(`/hotel/onboarding/complete`, {
      method: 'POST',
      body: JSON.stringify({ sessionId }),
    });
    return { hotelId: (response as any).hotelId! };
  },

  /**
   * Generate QR codes for rooms
   */
  generateQRCodes: async (
    sessionId: string,
    roomIds: string[]
  ): Promise<{ rooms: RoomConfig[] }> => {
    const response = await apiFetch(`/hotel/onboarding/generate-qr`, {
      method: 'POST',
      body: JSON.stringify({ sessionId, roomIds }),
    });
    return { rooms: (response as any).rooms! };
  },

  /**
   * Get onboarding session status
   */
  getSession: async (sessionId: string): Promise<{ session: OnboardingSession }> => {
    const response = await apiFetch(`/hotel/onboarding/session/${sessionId}`);
    return { session: response.session! };
  },

  /**
   * Cancel onboarding
   */
  cancel: async (sessionId: string): Promise<void> => {
    await apiFetch(`/hotel/onboarding/cancel`, {
      method: 'POST',
      body: JSON.stringify({ sessionId }),
    });
  },
};

// Type exports
export type { RoomConfig, StaffInvite };
