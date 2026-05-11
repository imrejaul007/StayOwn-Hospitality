import { api } from './api';

export const nightAuditService = {
  runAudit: async (data: { hotelId?: string; date?: string }) => {
    try {
      return await api.post('/night-audit/run', data);
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  },

  getAuditByDate: async (date: string, hotelId?: string) => {
    try {
      return await api.get(`/night-audit/${date}`, { params: { hotelId } });
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  },

  getAuditHistory: async (params?: Record<string, unknown>) => {
    try {
      return await api.get('/night-audit', { params });
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  },

  lockAudit: async (auditId: string) => {
    try {
      return await api.post(`/night-audit/${auditId}/lock`);
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  },
};
