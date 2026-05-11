import { api } from './api';

export interface WaitlistEntry {
  _id: string;
  hotelId: string;
  guestId: string;
  guestInfo: {
    name: string;
    email: string;
    phone: string;
    tier: 'regular' | 'vip' | 'svip' | 'corporate' | 'diamond';
  };
  requestedRoomType: string;
  checkInDate: string;
  checkOutDate: string;
  partySize: number;
  maxPrice: number;
  urgency: 'low' | 'medium' | 'high' | 'urgent';
  preferences: string[];
  specialRequests: string[];
  status: 'waiting' | 'matched' | 'contacted' | 'confirmed' | 'declined' | 'expired' | 'cancelled';
  matchResults: MatchResult[];
  contactHistory: ContactHistory[];
  autoNotify: boolean;
  priority: number;
  expiryDate: string;
  lastProcessedAt?: string;
  assignedTo?: string;
  notes: Note[];
  metadata: {
    source: 'web' | 'phone' | 'email' | 'walk_in' | 'api';
    referenceNumber?: string;
    corporateAccount?: string;
    eventType?: string;
  };
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  waitingDays: number;
  waitingHours: number;
  isExpired: boolean;
  hasActiveMatches: boolean;
  bestMatch?: MatchResult;
}

export interface MatchResult {
  _id: string;
  roomId: string;
  roomNumber: string;
  roomType: string;
  matchScore: number;
  matchReasons: string[];
  priceMatch: boolean;
  dateMatch: boolean;
  typeMatch: boolean;
  availabilityConfirmed: boolean;
  recommendedAction: 'auto_confirm' | 'manual_review' | 'contact_guest';
  matchedAt: string;
  processed: boolean;
}

export interface ContactHistory {
  _id: string;
  contactDate: string;
  method: 'email' | 'phone' | 'sms' | 'in_person';
  status: 'attempted' | 'successful' | 'failed' | 'no_response';
  notes?: string;
  contactedBy: string;
}

export interface Note {
  _id: string;
  note: string;
  addedBy: string;
  addedAt: string;
}

export interface WaitlistFilters {
  status?: string;
  tier?: string;
  urgency?: string;
  roomType?: string;
  page?: number;
  limit?: number;
}

export interface WaitlistAnalytics {
  totalStats: [{
    totalWaiting: number;
    totalMatched: number;
    totalContacted: number;
    totalConfirmed: number;
    priorityQueue: number;
    averageWaitTime: number;
  }];
  periodStats: [{
    processedToday: number;
    successfulMatches: number;
  }];
}

export interface CreateWaitlistEntry {
  guestId: string;
  guestInfo: {
    name: string;
    email: string;
    phone: string;
    tier: 'regular' | 'vip' | 'svip' | 'corporate' | 'diamond';
  };
  requestedRoomType: string;
  checkInDate: string;
  checkOutDate: string;
  partySize: number;
  maxPrice: number;
  urgency?: 'low' | 'medium' | 'high' | 'urgent';
  preferences?: string[];
  specialRequests?: string[];
  autoNotify?: boolean;
  source?: 'web' | 'phone' | 'email' | 'walk_in' | 'api';
}

export interface MatchCandidatesRequest {
  roomType?: string;
  checkInDate?: string;
  checkOutDate?: string;
  maxPrice?: number;
  partySize?: number;
  minimumMatchScore?: number;
}

class WaitlistService {
  private baseUrl = '/waitlist';

  // Get active waitlist with filtering and pagination
  async getActiveWaitlist(filters: WaitlistFilters = {}) {
    try {
      const queryParams = new URLSearchParams();

      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          queryParams.append(key, value.toString());
        }
      });

      const response = await api.get(`${this.baseUrl}?${queryParams}`);
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  // Create new waitlist entry
  async createWaitlistEntry(entryData: CreateWaitlistEntry) {
    try {
      const response = await api.post(this.baseUrl, entryData);
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  // Get specific waitlist entry
  async getWaitlistEntry(id: string) {
    try {
      const response = await api.get(`${this.baseUrl}/${id}`);
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  // Update waitlist entry
  async updateWaitlistEntry(id: string, updateData: Partial<WaitlistEntry>) {
    try {
      const response = await api.patch(`${this.baseUrl}/${id}`, updateData);
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  // Process waitlist matches
  async processWaitlistMatches(forceRefresh: boolean = false) {
    try {
      const response = await api.post(`${this.baseUrl}/process-matches`, {
        forceRefresh
      });
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  // Get waitlist analytics
  async getWaitlistAnalytics(period: 'day' | 'week' | 'month' = 'month') {
    try {
      const response = await api.get(`${this.baseUrl}/analytics?period=${period}`);
      return response.data.data.analytics;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  // Handle match action (confirm, decline, contact)
  async handleMatchAction(waitlistId: string, matchId: string, action: 'confirm' | 'decline' | 'contact', notes?: string) {
    try {
      const response = await api.post(`${this.baseUrl}/${waitlistId}/match/${matchId}/action`, {
        action,
        notes
      });
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  // Add contact history
  async addContactHistory(waitlistId: string, contactData: {
    method: 'email' | 'phone' | 'sms' | 'in_person';
    status: 'attempted' | 'successful' | 'failed' | 'no_response';
    notes?: string;
  }) {
    try {
      const response = await api.post(`${this.baseUrl}/${waitlistId}/contact`, contactData);
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  // Find match candidates
  async findMatchCandidates(criteria: MatchCandidatesRequest) {
    try {
      const response = await api.post(`${this.baseUrl}/find-candidates`, criteria);
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  // Process expired entries
  async processExpiredEntries() {
    try {
      const response = await api.post(`${this.baseUrl}/process-expired`);
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  // Helper methods for status management
  async confirmWaitlistEntry(id: string, notes?: string) {
    return this.updateWaitlistEntry(id, {
      status: 'confirmed',
      notes
    });
  }

  async declineWaitlistEntry(id: string, reason?: string) {
    return this.updateWaitlistEntry(id, {
      status: 'declined',
      reason
    });
  }

  async cancelWaitlistEntry(id: string, reason?: string) {
    return this.updateWaitlistEntry(id, {
      status: 'cancelled',
      reason
    });
  }

  async contactWaitlistGuest(id: string, method: 'email' | 'phone' | 'sms' | 'in_person', notes?: string) {
    await this.updateWaitlistEntry(id, { status: 'contacted' });
    return this.addContactHistory(id, {
      method,
      status: 'attempted',
      notes
    });
  }

  // Bulk operations
  async bulkUpdateStatus(ids: string[], status: WaitlistEntry['status'], reason?: string) {
    const promises = ids.map(id => this.updateWaitlistEntry(id, { status, reason }));
    return Promise.allSettled(promises);
  }

  async bulkProcessMatches(ids: string[]) {
    try {
      // Process matches for specific waitlist entries
      // This would require backend support for bulk operations
      const response = await api.post(`${this.baseUrl}/bulk/process-matches`, {
        waitlistIds: ids
      });
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  // Real-time updates (if WebSocket is available)
  subscribeToWaitlistUpdates(callback: (update: unknown) => void) {
    // This would integrate with WebSocket service
    // For now, return a mock subscription
    return {
      unsubscribe: () => {
        // Cleanup subscription
      }
    };
  }

  // Utility methods
  calculatePriority(tier: string, urgency: string): number {
    const tierWeights = { diamond: 50, svip: 40, vip: 30, corporate: 20, regular: 10 };
    const urgencyWeights = { urgent: 40, high: 30, medium: 20, low: 10 };

    return (tierWeights[tier as keyof typeof tierWeights] || 10) +
           (urgencyWeights[urgency as keyof typeof urgencyWeights] || 10);
  }

  formatWaitingTime(hours: number): string {
    if (hours < 24) {
      return `${hours} hour${hours !== 1 ? 's' : ''}`;
    }
    const days = Math.floor(hours / 24);
    const remainingHours = hours % 24;

    if (remainingHours === 0) {
      return `${days} day${days !== 1 ? 's' : ''}`;
    }

    return `${days} day${days !== 1 ? 's' : ''} ${remainingHours} hour${remainingHours !== 1 ? 's' : ''}`;
  }

  getUrgencyColor(urgency: string): string {
    const colors = {
      low: 'bg-green-100 text-green-800',
      medium: 'bg-yellow-100 text-yellow-800',
      high: 'bg-orange-100 text-orange-800',
      urgent: 'bg-red-100 text-red-800'
    };
    return colors[urgency as keyof typeof colors] || colors.medium;
  }

  getTierColor(tier: string): string {
    const colors = {
      regular: 'bg-gray-100 text-gray-800',
      corporate: 'bg-blue-100 text-blue-800',
      vip: 'bg-purple-100 text-purple-800',
      svip: 'bg-indigo-100 text-indigo-800',
      diamond: 'bg-yellow-100 text-yellow-800'
    };
    return colors[tier as keyof typeof colors] || colors.regular;
  }

  getStatusColor(status: string): string {
    const colors = {
      waiting: 'bg-blue-100 text-blue-800',
      matched: 'bg-green-100 text-green-800',
      contacted: 'bg-yellow-100 text-yellow-800',
      confirmed: 'bg-emerald-100 text-emerald-800',
      declined: 'bg-red-100 text-red-800',
      expired: 'bg-gray-100 text-gray-800',
      cancelled: 'bg-orange-100 text-orange-800'
    };
    return colors[status as keyof typeof colors] || colors.waiting;
  }

  // Export/Import functionality
  async exportWaitlist(filters: WaitlistFilters = {}, format: 'csv' | 'excel' = 'csv') {
    try {
      const queryParams = new URLSearchParams();
      queryParams.append('format', format);

      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          queryParams.append(key, value.toString());
        }
      });

      const response = await api.get(`${this.baseUrl}/export?${queryParams}`, {
        responseType: 'blob'
      });

      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `waitlist-export-${new Date().toISOString().split('T')[0]}.${format}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  // Validation helpers
  validateWaitlistEntry(entry: Partial<CreateWaitlistEntry>): string[] {
    const errors: string[] = [];

    if (!entry.guestInfo?.name?.trim()) {
      errors.push('Guest name is required');
    }

    if (!entry.guestInfo?.email?.trim()) {
      errors.push('Guest email is required');
    } else if (!/\S+@\S+\.\S+/.test(entry.guestInfo.email)) {
      errors.push('Valid email address is required');
    }

    if (!entry.guestInfo?.phone?.trim()) {
      errors.push('Guest phone number is required');
    }

    if (!entry.requestedRoomType?.trim()) {
      errors.push('Requested room type is required');
    }

    if (!entry.checkInDate) {
      errors.push('Check-in date is required');
    }

    if (!entry.checkOutDate) {
      errors.push('Check-out date is required');
    }

    if (entry.checkInDate && entry.checkOutDate && new Date(entry.checkInDate) >= new Date(entry.checkOutDate)) {
      errors.push('Check-out date must be after check-in date');
    }

    if (!entry.partySize || entry.partySize < 1 || entry.partySize > 20) {
      errors.push('Party size must be between 1 and 20');
    }

    if (entry.maxPrice === undefined || entry.maxPrice < 0) {
      errors.push('Maximum price must be a positive number');
    }

    return errors;
  }
}

export const waitlistService = new WaitlistService();
export default waitlistService;