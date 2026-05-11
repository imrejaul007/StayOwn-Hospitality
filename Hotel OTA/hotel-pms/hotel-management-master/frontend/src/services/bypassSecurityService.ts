import { api } from './api';

export interface SecurityMetrics {
  totalBypasses: number;
  averageRiskScore: number;
  totalFinancialImpact: number;
  highRiskCount: number;
  criticalFlags: number;
  suspiciousPatterns: number;
  pendingApprovals: number;
  activeAlerts: number;
}

export interface SecurityEvent {
  _id: string;
  bypassId: string;
  adminId: {
    _id: string;
    name: string;
    email: string;
    role: string;
  };
  bookingId: {
    _id: string;
    bookingNumber: string;
  };
  riskScore: number;
  riskLevel: string;
  reason: {
    category: string;
    subcategory?: string;
    description: string;
    urgencyLevel: string;
  };
  financialImpact: {
    estimatedLoss: number;
    actualLoss?: number;
    currency: string;
    impactCategory: string;
  };
  securityFlags: Array<{
    type: string;
    severity: 'info' | 'warning' | 'critical';
    message: string;
    timestamp: string;
    details?: Record<string, unknown>;
  }>;
  operationStatus: {
    status: string;
    initiatedAt: string;
    completedAt?: string;
    duration?: number;
  };
  guestContext: {
    guestName?: string;
    vipStatus?: boolean;
    loyaltyTier?: string;
  };
  propertyContext: {
    roomNumber?: string;
    roomType?: string;
    occupancyRate?: number;
  };
  analytics: {
    shift: string;
    businessHours: boolean;
    weekday: string;
    hotelOccupancy?: number;
  };
  createdAt: string;
  updatedAt: string;
}

export interface SecurityAlert {
  id: string;
  type: string;
  severity: 'critical' | 'warning' | 'info';
  title: string;
  message: string;
  timestamp: string;
  adminId?: string;
  adminName?: string;
  count?: number;
  details?: Record<string, unknown>;
  acknowledged?: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: string;
}

export interface SecurityTrend {
  date: string;
  totalBypasses: number;
  averageRiskScore: number;
  highRiskCount: number;
  financialImpact: number;
}

export interface SecurityAnalytics {
  riskDistribution: Array<{
    riskLevel: string;
    count: number;
    percentage: number;
  }>;
  categoryBreakdown: Array<{
    category: string;
    count: number;
    avgRiskScore: number;
  }>;
  timeDistribution: Array<{
    hour: number;
    count: number;
    avgRiskScore: number;
  }>;
  adminActivity: Array<{
    adminId: string;
    adminName: string;
    bypassCount: number;
    avgRiskScore: number;
    totalFinancialImpact: number;
  }>;
  trends: SecurityTrend[];
}

export interface EnhancedBypassRequest {
  bookingId: string;
  reason: {
    category: string;
    subcategory?: string;
    description: string;
    urgencyLevel: 'low' | 'medium' | 'high' | 'critical';
    estimatedDuration?: number;
    followUpRequired?: boolean;
    sensitiveNotes?: string;
  };
  financialImpact?: {
    estimatedLoss: number;
    currency: string;
    impactCategory: 'minimal' | 'low' | 'medium' | 'high' | 'severe';
    recoveryPlan?: string;
  };
  paymentMethod: 'cash' | 'card' | 'upi' | 'bank_transfer';
  confirmPassword?: string;
  deviceFingerprint?: string;
}

export interface SecurityValidationResult {
  allowed: boolean;
  riskScore: number;
  riskLevel: string;
  securityFlags: Array<{
    type: string;
    severity: string;
    message: string;
  }>;
  requiresApproval: boolean;
  requiresPasswordConfirmation: boolean;
  warnings: string[];
  recommendations: string[];
}

class BypassSecurityService {
  /**
   * Get security metrics for dashboard
   */
  async getSecurityMetrics(timeRange: '24h' | '7d' | '30d' = '24h') {
    try {
      const response = await api.get(`/admin-bypass-management/security/metrics?timeRange=${timeRange}`);
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  /**
   * Get security events with filtering
   */
  async getSecurityEvents(params: {
    timeRange?: '24h' | '7d' | '30d';
    riskLevel?: string;
    adminId?: string;
    limit?: number;
    offset?: number;
  } = {}) {
    try {
      const searchParams = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          searchParams.append(key, value.toString());
        }
      });

      const response = await api.get(`/admin-bypass-management/security/events?${searchParams}`);
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  /**
   * Get active security alerts
   */
  async getActiveAlerts() {
    try {
      const response = await api.get('/admin-bypass-management/security/alerts');
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  /**
   * Get security analytics
   */
  async getSecurityAnalytics(timeRange: '24h' | '7d' | '30d' = '7d') {
    try {
      const response = await api.get(`/admin-bypass-management/security/analytics?timeRange=${timeRange}`);
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  /**
   * Validate bypass operation before execution
   */
  async validateBypassOperation(request: EnhancedBypassRequest): Promise<SecurityValidationResult> {
    try {
      const response = await api.post('/admin-bypass-management/security/validate', request);
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  /**
   * Execute enhanced bypass checkout with full security tracking
   */
  async executeEnhancedBypass(request: EnhancedBypassRequest) {
    try {
      const response = await api.post('/admin-bypass-management/enhanced-checkout', request);
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  /**
   * Get high-risk bypass operations
   */
  async getHighRiskBypasses(threshold: number = 70) {
    try {
      const response = await api.get(`/admin-bypass-management/security/high-risk?threshold=${threshold}`);
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  /**
   * Get pending approval requests
   */
  async getPendingApprovals() {
    try {
      const response = await api.get('/admin-bypass-management/security/pending-approvals');
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  /**
   * Acknowledge security alert
   */
  async acknowledgeAlert(alertId: string, notes?: string) {
    try {
      const response = await api.post(`/admin-bypass-management/security/alerts/${alertId}/acknowledge`, {
        notes
      });
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  /**
   * Export security report
   */
  async exportSecurityReport(timeRange: '24h' | '7d' | '30d' = '7d') {
    try {
      const response = await api.get(`/admin-bypass-management/security/export?timeRange=${timeRange}`);
      return response;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  /**
   * Get admin bypass statistics
   */
  async getAdminStatistics(adminId: string, timeRange: '7d' | '30d' | '90d' = '30d') {
    try {
      const response = await api.get(`/admin-bypass-management/security/admin/${adminId}/stats?timeRange=${timeRange}`);
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  /**
   * Get bypass operation details
   */
  async getBypassDetails(bypassId: string) {
    try {
      const response = await api.get(`/admin-bypass-management/security/bypass/${bypassId}`);
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  /**
   * Update bypass operation (for follow-up actions)
   */
  async updateBypassOperation(bypassId: string, updates: {
    followUpNotes?: string;
    actualFinancialImpact?: number;
    resolutionStatus?: string;
    preventiveMeasures?: string[];
  }) {
    try {
      const response = await api.patch(`/admin-bypass-management/security/bypass/${bypassId}`, updates);
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  /**
   * Get compliance report
   */
  async getComplianceReport(timeRange: '30d' | '90d' | '365d' = '90d') {
    try {
      const response = await api.get(`/admin-bypass-management/security/compliance?timeRange=${timeRange}`);
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  /**
   * Search security events
   */
  async searchSecurityEvents(query: {
    searchTerm?: string;
    startDate?: string;
    endDate?: string;
    adminIds?: string[];
    riskLevels?: string[];
    categories?: string[];
    flags?: string[];
    limit?: number;
    offset?: number;
  }) {
    try {
      const response = await api.post('/admin-bypass-management/security/search', query);
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  /**
   * Get security patterns analysis
   */
  async getSecurityPatterns(timeRange: '7d' | '30d' | '90d' = '30d') {
    try {
      const response = await api.get(`/admin-bypass-management/security/patterns?timeRange=${timeRange}`);
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  /**
   * Generate device fingerprint for enhanced security
   */
  generateDeviceFingerprint(): string {
    const components = [
      navigator.userAgent,
      navigator.language,
      navigator.platform,
      screen.width + 'x' + screen.height,
      screen.colorDepth,
      new Date().getTimezoneOffset(),
      navigator.hardwareConcurrency || 'unknown',
      (navigator as Record<string, unknown>).deviceMemory || 'unknown'
    ];

    // Simple hash function
    let hash = 0;
    const str = components.join('|');
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }

    return Math.abs(hash).toString(16);
  }

  /**
   * Get geolocation for security tracking (if permission granted)
   */
  async getGeolocation(): Promise<{ latitude: number; longitude: number; accuracy: number } | null> {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        resolve(null);
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy
          });
        },
        () => {
          resolve(null); // Don't fail if geolocation is denied
        },
        {
          timeout: 5000,
          enableHighAccuracy: false,
          maximumAge: 300000 // 5 minutes
        }
      );
    });
  }

  /**
   * Create enhanced bypass request with security metadata
   */
  async createEnhancedBypassRequest(baseRequest: {
    bookingId: string;
    reason: {
      category: string;
      subcategory?: string;
      description: string;
      urgencyLevel: 'low' | 'medium' | 'high' | 'critical';
      estimatedDuration?: number;
      followUpRequired?: boolean;
      sensitiveNotes?: string;
    };
    financialImpact?: {
      estimatedLoss: number;
      currency: string;
      impactCategory: 'minimal' | 'low' | 'medium' | 'high' | 'severe';
      recoveryPlan?: string;
    };
    paymentMethod: 'cash' | 'card' | 'upi' | 'bank_transfer';
    confirmPassword?: string;
  }): Promise<EnhancedBypassRequest> {
    const deviceFingerprint = this.generateDeviceFingerprint();
    const geolocation = await this.getGeolocation();

    return {
      ...baseRequest,
      deviceFingerprint,
      // Add geolocation to metadata if available
      ...(geolocation && { geolocation })
    };
  }

  /**
   * Format risk score for display
   */
  formatRiskScore(score: number): { level: string; color: string; description: string } {
    if (score >= 80) {
      return {
        level: 'Critical',
        color: 'text-red-600',
        description: 'Immediate attention required'
      };
    } else if (score >= 60) {
      return {
        level: 'High',
        color: 'text-orange-600',
        description: 'Supervisor approval recommended'
      };
    } else if (score >= 40) {
      return {
        level: 'Medium',
        color: 'text-yellow-600',
        description: 'Standard monitoring'
      };
    } else if (score >= 20) {
      return {
        level: 'Low',
        color: 'text-blue-600',
        description: 'Routine operation'
      };
    } else {
      return {
        level: 'Minimal',
        color: 'text-green-600',
        description: 'Low risk operation'
      };
    }
  }

  /**
   * Format financial impact for display
   */
  formatFinancialImpact(amount: number, currency: string = 'INR'): string {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  }

  /**
   * Get security recommendations based on patterns
   */
  async getSecurityRecommendations() {
    try {
      const response = await api.get('/admin-bypass-management/security/recommendations');
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

}

export const bypassSecurityService = new BypassSecurityService();