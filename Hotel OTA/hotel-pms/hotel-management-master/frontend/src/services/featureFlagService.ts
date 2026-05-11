import { api } from './api';

export const featureFlagService = {
  getAll: async () => {
    try {
      return await api.get('/feature-flags');
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  },

  check: async (flagName: string, hotelId?: string) => {
    try {
      return await api.get(`/feature-flags/${flagName}`, { params: { hotelId } });
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  },

  toggle: async (flagName: string, enabled: boolean, hotelId?: string) => {
    try {
      return await api.post(`/feature-flags/${flagName}`, { enabled, hotelId });
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  },
};
