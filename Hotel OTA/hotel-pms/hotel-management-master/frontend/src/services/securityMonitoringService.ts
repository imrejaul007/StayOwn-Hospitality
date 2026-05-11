import { api } from './api';

// ---------- Types ----------

export interface SecurityEvent {
  _id: string;
  type:
    | 'authentication'
    | 'authorization'
    | 'data_access'
    | 'session_start'
    | 'session_end'
    | 'privilege_change'
    | 'api_request'
    | 'file_access'
    | 'configuration_change'
    | 'system_access';
  severity: 'low' | 'medium' | 'high' | 'critical';
  resource?: string;
  action: string;
  outcome: 'success' | 'failure' | 'blocked' | 'denied';
  details?: Record<string, unknown>;
  risk_score?: number;
  userId?: string;
  hotelId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ThreatAlert {
  _id: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'open' | 'investigating' | 'resolved' | 'false_positive';
  type: string;
  source: string;
  description: string;
  assignedTo?: string;
  notes?: string;
  mitigationActions?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface SuspiciousActivity {
  _id: string;
  status: 'under_review' | 'reviewed' | 'escalated' | 'resolved';
  false_positive?: boolean;
  type: string;
  description: string;
  source: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuditLogEntry {
  _id: string;
  action: string;
  resource: string;
  resourceId?: string;
  outcome: 'success' | 'failure' | 'denied';
  userId?: string;
  userName?: string;
  ipAddress?: string;
  userAgent?: string;
  changes?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  compliance_tags?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface SecurityDashboard {
  securityScore: number;
  totalEvents: number;
  activeAlerts: number;
  resolvedAlerts: number;
  suspiciousActivities: number;
  complianceStatus: Array<{
    standard: string;
    status: 'compliant' | 'non_compliant' | 'partial' | 'pending';
    requirement: string;
    lastCheck: string;
    nextCheck: string;
    details: string;
    remediationActions: string[];
  }>;
  recentEvents: SecurityEvent[];
  mfaEnrollment?: number;
  settings?: Record<string, unknown>;
}

export interface SecurityMetrics {
  period: string;
  totalEvents: number;
  eventsByType: Record<string, number>;
  eventsBySeverity: Record<string, number>;
  alertsTrend: Array<{ date: string; count: number }>;
  threatCategories: Record<string, number>;
}

export interface ThreatIntelligence {
  threats: Array<{
    type: string;
    severity: string;
    description: string;
    indicators: string[];
    recommendations: string[];
  }>;
  vulnerabilities: Array<{
    id: string;
    severity: string;
    description: string;
    affected: string;
    remediation: string;
  }>;
  riskScore: number;
  lastUpdated: string;
}

// ---------- Filter types ----------

export interface SecurityEventFilters {
  type?: string;
  severity?: 'low' | 'medium' | 'high' | 'critical';
  userId?: string;
  timeframe?: number;
  limit?: number;
  offset?: number;
}

export interface ThreatAlertFilters {
  severity?: 'low' | 'medium' | 'high' | 'critical';
  status?: 'open' | 'investigating' | 'resolved' | 'false_positive' | 'all';
  timeframe?: number;
  limit?: number;
  offset?: number;
}

export interface SuspiciousActivityFilters {
  status?: 'under_review' | 'reviewed' | 'escalated' | 'resolved' | 'all';
  timeframe?: number;
  limit?: number;
  offset?: number;
}

export interface AuditLogFilters {
  userId?: string;
  resource?: string;
  action?: string;
  outcome?: 'success' | 'failure' | 'denied';
  timeframe?: number;
  limit?: number;
  offset?: number;
}

// ---------- Service ----------

class SecurityMonitoringService {
  // Security Events

  async getSecurityEvents(
    filters?: SecurityEventFilters
  ): Promise<{ success: boolean; data: SecurityEvent[]; total?: number }> {
    try {
      const response = await api.get('/security-monitoring/events', { params: filters });
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  async getSecurityEvent(
    eventId: string
  ): Promise<{ success: boolean; data: SecurityEvent }> {
    try {
      const response = await api.get(`/security-monitoring/events/${eventId}`);
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  // Threat Alerts

  async getThreatAlerts(
    filters?: ThreatAlertFilters
  ): Promise<{ success: boolean; data: ThreatAlert[]; total?: number }> {
    try {
      const response = await api.get('/security-monitoring/alerts', { params: filters });
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  async updateAlertStatus(
    alertId: string,
    update: { status?: string; assignedTo?: string; notes?: string }
  ): Promise<{ success: boolean; data: ThreatAlert }> {
    try {
      const response = await api.put(`/security-monitoring/alerts/${alertId}`, update);
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  // Suspicious Activities

  async getSuspiciousActivities(
    filters?: SuspiciousActivityFilters
  ): Promise<{ success: boolean; data: SuspiciousActivity[]; total?: number }> {
    try {
      const response = await api.get('/security-monitoring/suspicious-activities', { params: filters });
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  async reviewSuspiciousActivity(
    activityId: string,
    review: { status?: string; false_positive?: boolean; notes?: string }
  ): Promise<{ success: boolean; data: SuspiciousActivity }> {
    try {
      const response = await api.put(
        `/security-monitoring/suspicious-activities/${activityId}/review`,
        review
      );
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  // Audit Logs

  async getAuditLogs(
    filters?: AuditLogFilters
  ): Promise<{ success: boolean; data: AuditLogEntry[]; total?: number }> {
    try {
      const response = await api.get('/security-monitoring/audit', { params: filters });
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  // Dashboard & Analytics

  async getSecurityDashboard(
    timeframe?: number
  ): Promise<{ success: boolean; data: SecurityDashboard }> {
    try {
      const response = await api.get('/security-monitoring/dashboard', {
        params: timeframe ? { timeframe } : undefined,
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  async getSecurityMetrics(
    period?: 'day' | 'week' | 'month'
  ): Promise<{ success: boolean; data: SecurityMetrics }> {
    try {
      const response = await api.get('/security-monitoring/metrics', {
        params: period ? { period } : undefined,
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  async getThreatIntelligence(): Promise<{ success: boolean; data: ThreatIntelligence }> {
    try {
      const response = await api.get('/security-monitoring/threat-intelligence');
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  // Export

  async exportSecurityReport(params?: {
    format?: 'json' | 'csv';
    timeframe?: number;
    include_events?: boolean;
    include_alerts?: boolean;
    include_audit?: boolean;
  }): Promise<{ success: boolean; data: unknown }> {
    try {
      const response = await api.get('/security-monitoring/export', { params });
      return response.data;
    } catch (error) {
      throw error;
    }
  }
}

export const securityMonitoringService = new SecurityMonitoringService();
export default securityMonitoringService;
