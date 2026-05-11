// Authentication utility functions

export const AUTH_CREDENTIALS = {
  ADMIN: {
    email: '',
    password: ''
  },
  GUEST: {
    email: '',
    password: ''
  }
};

export const isAuthenticated = (): boolean => {
  return document.cookie.includes('csrfToken=');
};

export const getAuthToken = (): string | null => {
  return null;
};

export const setAuthToken = (_token: string): void => {};

export const clearAuthToken = (): void => {
  // Auth token is httpOnly cookie; cleared by logout endpoint.
};

export const loginAsAdmin = async (): Promise<string> => {
  throw new Error('loginAsAdmin is disabled for production safety');
};

export const loginAsGuest = async (): Promise<string> => {
  throw new Error('loginAsGuest is disabled for production safety');
};

// Auto-login for demo purposes
export const ensureAuthenticated = async (): Promise<string> => {
  throw new Error('Authentication required');
};