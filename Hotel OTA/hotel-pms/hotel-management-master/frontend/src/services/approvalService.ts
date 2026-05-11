import { api } from './api';

/** Matches the backend ApprovalRequest model shape (after populate). */
export interface ApprovalRequest {
  _id: string;
  requestType: 'price_change' | 'rate_adjustment' | 'room_type_add' | 'room_type_delete';
  requestedBy: {
    _id: string;
    name: string;
    email: string;
    role?: string;
  };
  targetResource: 'room_type' | 'booking' | 'room';
  targetResourceId: string;
  requestData: {
    original: Record<string, unknown>;
    proposed: Record<string, unknown>;
  };
  status: 'pending' | 'approved' | 'rejected';
  reviewedBy?: {
    _id: string;
    name: string;
    email: string;
    role?: string;
  } | null;
  reviewedAt?: string | null;
  reviewNotes?: string;
  hotelId: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateApprovalRequestData {
  requestType: string;
  targetResource: string;
  targetResourceId: string;
  requestData: {
    original: Record<string, unknown>;
    proposed: Record<string, unknown>;
  };
}

export interface ApprovalFilters {
  status?: string;
  requestType?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedApprovalResponse {
  data: ApprovalRequest[];
  page: number;
  limit: number;
  totalCount: number;
  totalPages: number;
}

export const approvalService = {
  createApprovalRequest: async (data: CreateApprovalRequestData): Promise<ApprovalRequest> => {
    const response = await api.post('/approvals', data);
    return response.data?.data?.approvalRequest ?? response.data;
  },

  getMyApprovalRequests: async (
    filters?: ApprovalFilters
  ): Promise<PaginatedApprovalResponse> => {
    const params = {
      page: filters?.page ?? 1,
      limit: filters?.limit ?? 20,
      sortBy: filters?.sortBy ?? 'createdAt',
      sortOrder: filters?.sortOrder ?? 'desc',
      ...(filters?.status && { status: filters.status }),
      ...(filters?.requestType && { requestType: filters.requestType }),
    };
    const response = await api.get('/approvals/my-requests', { params });
    // Backend returns a raw array; normalize into paginated envelope
    const raw = response.data;
    if (Array.isArray(raw)) {
      return {
        data: raw,
        page: params.page,
        limit: params.limit,
        totalCount: raw.length,
        totalPages: Math.max(1, Math.ceil(raw.length / params.limit)),
      };
    }
    return raw;
  },

  getAllApprovalRequests: async (
    filters?: ApprovalFilters
  ): Promise<PaginatedApprovalResponse> => {
    const params = {
      page: filters?.page ?? 1,
      limit: filters?.limit ?? 20,
      sortBy: filters?.sortBy ?? 'createdAt',
      sortOrder: filters?.sortOrder ?? 'desc',
      ...(filters?.status && { status: filters.status }),
      ...(filters?.requestType && { requestType: filters.requestType }),
    };
    const response = await api.get('/approvals', { params });
    const raw = response.data;
    if (Array.isArray(raw)) {
      return {
        data: raw,
        page: params.page,
        limit: params.limit,
        totalCount: raw.length,
        totalPages: Math.max(1, Math.ceil(raw.length / params.limit)),
      };
    }
    return raw;
  },

  approveRequest: async (id: string, notes?: string): Promise<ApprovalRequest> => {
    const response = await api.put(`/approvals/${id}/approve`, { reviewNotes: notes });
    return response.data?.data?.approvalRequest ?? response.data;
  },

  rejectRequest: async (id: string, reason: string): Promise<ApprovalRequest> => {
    const response = await api.put(`/approvals/${id}/reject`, { reviewNotes: reason });
    return response.data?.data?.approvalRequest ?? response.data;
  },

  cancelRequest: async (id: string): Promise<void> => {
    await api.put(`/approvals/${id}/cancel`);
  },

  getPendingCount: async (): Promise<number> => {
    const response = await api.get('/approvals/pending-count');
    return response.data.count;
  },

  getApprovalStats: async (): Promise<{
    pending: number;
    approved: number;
    rejected: number;
  }> => {
    const response = await api.get('/approvals/stats');
    return response.data?.data?.stats ?? response.data;
  },
};

export default approvalService;
