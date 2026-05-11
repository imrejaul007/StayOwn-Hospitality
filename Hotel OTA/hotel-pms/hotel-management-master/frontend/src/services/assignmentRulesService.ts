import { api } from './api';

export interface AssignmentRule {
  _id: string;
  ruleId: string;
  ruleName: string;
  priority: number;
  isActive: boolean;
  conditions: {
    guestType?: string[];
    reservationType?: string[];
    roomTypes?: string[];
    lengthOfStay?: {
      min?: number;
      max?: number;
    };
    advanceBooking?: {
      min?: number;
      max?: number;
    };
    seasonality?: string[];
    occupancyLevel?: {
      min?: number;
      max?: number;
    };
  };
  actions: {
    preferredFloors?: number[];
    preferredRoomNumbers?: string[];
    avoidRoomNumbers?: string[];
    upgradeEligible?: boolean;
    upgradeFromTypes?: string[];
    upgradeToTypes?: string[];
    amenityPackages?: string[];
    specialServices?: string[];
    rateOverrides?: {
      discountPercentage?: number;
      fixedRate?: number;
    };
  };
  restrictions: {
    maxUpgrades?: number;
    blockoutDates?: Array<{
      startDate: string;
      endDate: string;
      reason: string;
    }>;
    minimumRevenue?: number;
    requiredApproval?: 'none' | 'supervisor' | 'manager' | 'gm';
  };
  createdBy: {
    _id: string;
    name: string;
    email: string;
  };
  lastModifiedBy?: {
    _id: string;
    name: string;
    email: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface CreateAssignmentRuleData {
  ruleName: string;
  priority?: number;
  conditions?: AssignmentRule['conditions'];
  actions?: AssignmentRule['actions'];
  restrictions?: AssignmentRule['restrictions'];
}

export interface AssignmentRuleFilters {
  isActive?: boolean;
  priority?: number;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface AssignmentRulesStats {
  statusStats: Array<{
    _id: boolean;
    count: number;
    avgPriority: number;
  }>;
  priorityStats: Array<{
    _id: number;
    count: number;
  }>;
  recentRules: Array<{
    _id: string;
    ruleName: string;
    priority: number;
    createdBy: {
      name: string;
    };
    createdAt: string;
  }>;
}

export interface TestCriteria {
  guestType: string;
  roomType: string;
  lengthOfStay: number;
  reservationType?: string;
  advanceBooking?: number;
}

export interface TestResult {
  ruleId: string;
  ruleName: string;
  matches: boolean;
  applicableActions: AssignmentRule['actions'] | null;
  testCriteria: TestCriteria;
}

export interface AutoAssignCriteria {
  guestType?: string;
  roomType?: string;
  priority?: 'low' | 'medium' | 'high' | 'vip';
  maxBookings?: number;
}

export interface AutoAssignResult {
  assigned: number;
  failed: number;
  skipped: number;
  details: Array<{
    bookingId: string;
    bookingNumber?: string;
    guestName: string;
    status: 'assigned' | 'failed' | 'skipped';
    assignedRoom?: string;
    roomType?: string;
    rule?: string;
    reason?: string;
  }>;
}

class AssignmentRulesService {
  private baseURL = '/assignment-rules';

  // Get all assignment rules
  async getAssignmentRules(filters?: AssignmentRuleFilters): Promise<{
    data: AssignmentRule[];
    pagination: {
      current: number;
      pages: number;
      total: number;
    };
  }> {
    try {
      const params = new URLSearchParams();
    
      if (filters?.isActive !== undefined) params.append('isActive', filters.isActive.toString());
      if (filters?.priority) params.append('priority', filters.priority.toString());
      if (filters?.page) params.append('page', filters.page.toString());
      if (filters?.limit) params.append('limit', filters.limit.toString());
      if (filters?.sortBy) params.append('sortBy', filters.sortBy);
      if (filters?.sortOrder) params.append('sortOrder', filters.sortOrder);

      const response = await api.get(`${this.baseURL}?${params.toString()}`);
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  // Get assignment rule by ID
  async getAssignmentRule(id: string): Promise<AssignmentRule> {
    try {
      const response = await api.get(`${this.baseURL}/${id}`);
      return response.data.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  // Create new assignment rule
  async createAssignmentRule(data: CreateAssignmentRuleData): Promise<AssignmentRule> {
    try {
      const response = await api.post(this.baseURL, data);
      return response.data.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  // Update assignment rule
  async updateAssignmentRule(id: string, data: Partial<CreateAssignmentRuleData>): Promise<AssignmentRule> {
    try {
      const response = await api.put(`${this.baseURL}/${id}`, data);
      return response.data.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  // Delete assignment rule
  async deleteAssignmentRule(id: string): Promise<void> {
    try {
      await api.delete(`${this.baseURL}/${id}`);
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  // Get assignment rules statistics
  async getAssignmentRulesStats(): Promise<AssignmentRulesStats> {
    try {
      const response = await api.get(`${this.baseURL}/stats`);
      return response.data.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  // Test assignment rule
  async testAssignmentRule(id: string, testCriteria: TestCriteria): Promise<TestResult> {
    try {
      const response = await api.post(`${this.baseURL}/${id}/test`, { testCriteria });
      return response.data.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  // Auto-assign rooms based on assignment rules
  async autoAssignRooms(criteria?: AutoAssignCriteria): Promise<AutoAssignResult> {
    try {
      const response = await api.post(`${this.baseURL}/auto-assign`, { criteria });
      return response.data.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  // Get available guest types
  getGuestTypes(): string[] {
    return ['standard', 'vip', 'loyalty_member', 'corporate', 'group', 'walk_in'];
  }

  // Get available room types
  getRoomTypes(): string[] {
    return ['single', 'double', 'deluxe', 'suite', 'presidential'];
  }

  // Get available reservation types
  getReservationTypes(): string[] {
    return ['standard', 'group', 'corporate', 'vip', 'complimentary', 'house_use'];
  }

  // Get available amenity packages
  getAmenityPackages(): string[] {
    return ['wifi', 'breakfast', 'parking', 'spa_access', 'gym_access', 'late_checkout', 'early_checkin', 'newspaper'];
  }

  // Get available special services
  getSpecialServices(): string[] {
    return ['turndown_service', 'welcome_amenities', 'room_upgrade', 'priority_housekeeping', 'concierge_service'];
  }
}

export default new AssignmentRulesService();