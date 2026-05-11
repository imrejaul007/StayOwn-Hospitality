import { api } from './api';

export interface PendingApproval {
  _id: string;
  workflowId: string;
  bypassAuditId: {
    bypassId: string;
    reason: {
      category: string;
      description: string;
      urgencyLevel: string;
    };
    financialImpact: {
      estimatedLoss: number;
      currency: string;
    };
    securityMetadata: {
      riskScore: number;
    };
  };
  initiatedBy: {
    _id: string;
    name: string;
    email: string;
  };
  currentLevel: number;
  approvalChain: Array<{
    level: number;
    requiredRole: string;
    status: string;
    requestedAt: string;
    assignedTo?: {
      _id: string;
      name: string;
      email: string;
    };
  }>;
  timing: {
    timeoutAt: string;
    initiatedAt: string;
  };
  analytics: {
    urgencyLevel: string;
  };
  timeRemaining: number;
  completionPercentage: number;
}

export interface ApprovalStatistics {
  totalWorkflows: number;
  approvedWorkflows: number;
  rejectedWorkflows: number;
  expiredWorkflows: number;
  averageResponseTime: number;
  averageTotalDuration: number;
  escalatedCount: number;
}

export interface ApprovalWorkflow {
  _id: string;
  workflowId: string;
  hotelId: string;
  bypassAuditId: {
    bypassId: string;
    reason: {
      category: string;
      description: string;
      urgencyLevel: string;
    };
    financialImpact: {
      estimatedLoss: number;
      currency: string;
    };
    securityMetadata: {
      riskScore: number;
    };
  };
  initiatedBy: {
    _id: string;
    name: string;
    email: string;
  };
  approvalChain: Array<{
    level: number;
    requiredRole: string;
    status: string;
    requestedAt: string;
    respondedAt?: string;
    approverNotes?: string;
    assignedTo?: {
      _id: string;
      name: string;
      email: string;
      role: string;
    };
    delegatedTo?: {
      _id: string;
      name: string;
      email: string;
      role: string;
    };
  }>;
  currentLevel: number;
  workflowStatus: string;
  timing: {
    initiatedAt: string;
    timeoutAt: string;
    completedAt?: string;
    totalDuration?: number;
  };
  escalation: {
    currentEscalationLevel: number;
    maxEscalationLevel: number;
  };
  completionPercentage: number;
  timeRemaining: number;
}

export interface ProcessApprovalRequest {
  action: 'approved' | 'rejected';
  notes: string;
}

export interface DelegateApprovalRequest {
  toUserId: string;
  delegationReason: string;
}

export interface EscalateApprovalRequest {
  reason?: string;
}

class BypassApprovalService {
  /**
   * Get pending approvals for the current user
   */
  async getPendingApprovals() {
    try {
      const response = await api.get('/admin-bypass-management/approvals/pending');
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  /**
   * Process an approval (approve/reject)
   */
  async processApproval(workflowId: string, action: 'approved' | 'rejected', notes: string) {
    try {
      const response = await api.post(`/admin-bypass-management/approvals/${workflowId}/process`, {
        action,
        notes
      });
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  /**
   * Delegate an approval to another user
   */
  async delegateApproval(workflowId: string, toUserId: string, delegationReason: string) {
    try {
      const response = await api.post(`/admin-bypass-management/approvals/${workflowId}/delegate`, {
        toUserId,
        delegationReason
      });
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  /**
   * Escalate an approval workflow
   */
  async escalateApproval(workflowId: string, reason?: string) {
    try {
      const response = await api.post(`/admin-bypass-management/approvals/${workflowId}/escalate`, {
        reason
      });
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  /**
   * Get approval workflow details
   */
  async getApprovalWorkflow(workflowId: string): Promise<{ data: ApprovalWorkflow }> {
    try {
      const response = await api.get(`/admin-bypass-management/approvals/${workflowId}`);
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  /**
   * Get approval statistics
   */
  async getApprovalStatistics(timeRange: number = 30): Promise<{ data: ApprovalStatistics }> {
    try {
      const response = await api.get(`/admin-bypass-management/approvals/statistics?timeRange=${timeRange}`);
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  /**
   * Get workflows by status
   */
  async getWorkflowsByStatus(status: string, limit: number = 50) {
    try {
      const response = await api.get(`/admin-bypass-management/approvals/status/${status}?limit=${limit}`);
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  /**
   * Get all approved workflows
   */
  async getApprovedWorkflows(limit: number = 50) {
    return this.getWorkflowsByStatus('approved', limit);
  }

  /**
   * Get all rejected workflows
   */
  async getRejectedWorkflows(limit: number = 50) {
    return this.getWorkflowsByStatus('rejected', limit);
  }

  /**
   * Get all expired workflows
   */
  async getExpiredWorkflows(limit: number = 50) {
    return this.getWorkflowsByStatus('expired', limit);
  }

  /**
   * Get all escalated workflows
   */
  async getEscalatedWorkflows(limit: number = 50) {
    return this.getWorkflowsByStatus('escalated', limit);
  }

  /**
   * Enhanced bypass checkout with approval workflow support
   */
  async enhancedBypassCheckout(data: {
    bookingId: string;
    reason: {
      category: string;
      subcategory?: string;
      description: string;
      urgencyLevel?: string;
      estimatedDuration?: number;
      followUpRequired?: boolean;
      sensitiveNotes?: string;
    };
    financialImpact?: {
      estimatedLoss?: number;
      currency?: string;
      impactCategory?: string;
      recoveryPlan?: string;
    };
    paymentMethod?: string;
    deviceFingerprint?: string;
    geolocation?: {
      latitude?: number;
      longitude?: number;
      accuracy?: number;
      city?: string;
      country?: string;
    };
  }) {
    try {
      const response = await api.post('/admin-bypass-management/enhanced-checkout', data);
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  /**
   * Validate bypass operation before submission
   */
  async validateBypassOperation(data: {
    bookingId: string;
    reason: {
      category: string;
      description: string;
      urgencyLevel?: string;
    };
    financialImpact?: {
      estimatedLoss?: number;
      currency?: string;
    };
  }) {
    try {
      const response = await api.post('/admin-bypass-management/security/validate', data);
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  /**
   * Get approval workflow history for a bypass audit
   */
  async getWorkflowHistory(bypassAuditId: string) {
    try {
      const response = await api.get(`/admin-bypass-management/approvals/history/${bypassAuditId}`);
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  /**
   * Check if user can approve workflows
   */
  async canApproveWorkflows(): Promise<boolean> {
    try {
      const response = await api.get('/admin-bypass-management/approvals/permissions');
      return response.data.canApprove || false;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get users who can be assigned as approvers
   */
  async getAvailableApprovers(role?: string) {
    try {
      const params = role ? `?role=${role}` : '';
      const response = await api.get(`/admin-bypass-management/approvals/approvers${params}`);
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  /**
   * Get approval workflow templates
   */
  async getApprovalTemplates() {
    try {
      const response = await api.get('/admin-bypass-management/approvals/templates');
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  /**
   * Create custom approval workflow
   */
  async createCustomWorkflow(data: {
    bypassAuditId: string;
    approvalLevels: Array<{
      requiredRole: string;
      specificApproverId?: string;
      timeoutMinutes?: number;
    }>;
    escalationEnabled?: boolean;
    timeoutMinutes?: number;
  }) {
    try {
      const response = await api.post('/admin-bypass-management/approvals/custom', data);
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  /**
   * Format approval workflow data for display
   */
  formatWorkflowForDisplay(workflow: ApprovalWorkflow) {
    return {
      ...workflow,
      formattedTimeRemaining: this.formatTimeRemaining(workflow.timeRemaining),
      formattedDuration: workflow.timing.totalDuration ? 
        this.formatDuration(workflow.timing.totalDuration) : null,
      riskLevel: this.getRiskLevel(workflow.bypassAuditId.securityMetadata.riskScore),
      urgencyColor: this.getUrgencyColor(workflow.bypassAuditId.reason.urgencyLevel),
      statusColor: this.getStatusColor(workflow.workflowStatus)
    };
  }

  /**
   * Format time remaining
   */
  private formatTimeRemaining(timeRemaining: number): string {
    if (timeRemaining <= 0) return 'Expired';
    
    const hours = Math.floor(timeRemaining / (60 * 60 * 1000));
    const minutes = Math.floor((timeRemaining % (60 * 60 * 1000)) / (60 * 1000));
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  }

  /**
   * Format duration
   */
  private formatDuration(duration: number): string {
    const hours = Math.floor(duration / (60 * 60 * 1000));
    const minutes = Math.floor((duration % (60 * 60 * 1000)) / (60 * 1000));
    const seconds = Math.floor((duration % (60 * 1000)) / 1000);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    }
    return `${seconds}s`;
  }

  /**
   * Get risk level from score
   */
  private getRiskLevel(riskScore: number): string {
    if (riskScore >= 80) return 'Critical';
    if (riskScore >= 60) return 'High';
    if (riskScore >= 40) return 'Medium';
    if (riskScore >= 20) return 'Low';
    return 'Minimal';
  }

  /**
   * Get urgency color class
   */
  private getUrgencyColor(urgency: string): string {
    switch (urgency) {
      case 'critical': return 'bg-red-100 text-red-800 border-red-200';
      case 'high': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low': return 'bg-blue-100 text-blue-800 border-blue-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  }

  /**
   * Get status color class
   */
  private getStatusColor(status: string): string {
    switch (status) {
      case 'approved': return 'bg-green-100 text-green-800 border-green-200';
      case 'rejected': return 'bg-red-100 text-red-800 border-red-200';
      case 'pending': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'escalated': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'expired': return 'bg-gray-100 text-gray-800 border-gray-200';
      default: return 'bg-blue-100 text-blue-800 border-blue-200';
    }
  }
}

export const bypassApprovalService = new BypassApprovalService();

