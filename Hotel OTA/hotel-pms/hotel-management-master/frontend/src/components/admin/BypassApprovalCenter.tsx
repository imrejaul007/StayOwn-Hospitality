import React, { useState, useEffect, useRef} from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  User,
  DollarSign,
  FileText,
  Eye,
  MessageSquare,
  ArrowUp,
  RefreshCw,
  Calendar,
  TrendingUp,
  Shield
} from 'lucide-react';
import { bypassApprovalService } from '../../services/bypassApprovalService';
import LoadingSpinner from '../ui/LoadingSpinner';

interface PendingApproval {
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

interface ApprovalStatistics {
  totalWorkflows: number;
  approvedWorkflows: number;
  rejectedWorkflows: number;
  expiredWorkflows: number;
  averageResponseTime: number;
  averageTotalDuration: number;
  escalatedCount: number;
}

const BypassApprovalCenter: React.FC = () => {
  const [pendingApprovals, setPendingApprovals] = useState<PendingApproval[]>([]);
  const [statistics, setStatistics] = useState<ApprovalStatistics | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [selectedApproval, setSelectedApproval] = useState<PendingApproval | null>(null);
  const [approvalAction, setApprovalAction] = useState<'approved' | 'rejected' | null>(null);
  const [approvalNotes, setApprovalNotes] = useState('');
  const [filterUrgency, setFilterUrgency] = useState<string>('all');
  const [refreshing, setRefreshing] = useState(false);

  const successTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (successTimerRef.current) clearTimeout(successTimerRef.current);
    };
  }, []);

  useEffect(() => {
    fetchData(true);

    // Auto-refresh every 30 seconds (silent, no loading spinner)
    const interval = setInterval(() => fetchData(false), 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchData = async (isInitial = false) => {
    try {
      if (isInitial) setLoading(true);
      setError(null);

      const [approvalsData, statsData] = await Promise.all([
        bypassApprovalService.getPendingApprovals(),
        bypassApprovalService.getApprovalStatistics()
      ]);

      setPendingApprovals(approvalsData.data || []);
      setStatistics(statsData.data || null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to fetch approval data');
    } finally {
      if (isInitial) setLoading(false);
    }
  };

  const handleRefresh = async () => {
    try {
      setRefreshing(true);
      setError(null);
      const [approvalsData, statsData] = await Promise.all([
        bypassApprovalService.getPendingApprovals(),
        bypassApprovalService.getApprovalStatistics()
      ]);
      setPendingApprovals(approvalsData.data || []);
      setStatistics(statsData.data || null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to refresh data');
    } finally {
      setRefreshing(false);
    }
  };

  const openApprovalModal = (approval: PendingApproval, action: 'approved' | 'rejected') => {
    setSelectedApproval(approval);
    setApprovalAction(action);
    setApprovalNotes('');
    setError(null);
  };

  const closeApprovalModal = () => {
    setSelectedApproval(null);
    setApprovalAction(null);
    setApprovalNotes('');
    setError(null);
  };

  const processApproval = async () => {
    if (!selectedApproval || !approvalAction || approvalNotes.trim().length < 5) {
      setError('Please provide approval notes (minimum 5 characters)');
      return;
    }

    try {
      setProcessing(selectedApproval.workflowId);
      setError(null);

      await bypassApprovalService.processApproval(
        selectedApproval.workflowId,
        approvalAction,
        approvalNotes.trim()
      );

      setSuccess(`✅ Approval ${approvalAction} successfully`);
      closeApprovalModal();
      fetchData(); // Refresh data
      
      // Clear success message after 5 seconds
      if (successTimerRef.current) clearTimeout(successTimerRef.current);
      successTimerRef.current = setTimeout(() => setSuccess(null), 5000);
      
    } catch (err: unknown) {
      setError('Failed to process approval: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setProcessing(null);
    }
  };

  const escalateApproval = async (workflowId: string) => {
    try {
      setProcessing(workflowId);
      await bypassApprovalService.escalateApproval(workflowId, 'manual_escalation');
      setSuccess('✅ Approval escalated successfully');
      fetchData();
      if (successTimerRef.current) clearTimeout(successTimerRef.current);
      successTimerRef.current = setTimeout(() => setSuccess(null), 5000);
    } catch (err: unknown) {
      setError('Failed to escalate approval: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setProcessing(null);
    }
  };

  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case 'critical': return 'bg-red-100 text-red-800 border-red-200';
      case 'high': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low': return 'bg-blue-100 text-blue-800 border-blue-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getRiskColor = (riskScore: number) => {
    if (riskScore >= 80) return 'bg-red-100 text-red-800 border-red-200';
    if (riskScore >= 60) return 'bg-orange-100 text-orange-800 border-orange-200';
    if (riskScore >= 40) return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    if (riskScore >= 20) return 'bg-blue-100 text-blue-800 border-blue-200';
    return 'bg-green-100 text-green-800 border-green-200';
  };

  const formatTimeRemaining = (timeRemaining: number) => {
    if (timeRemaining <= 0) return 'Expired';
    
    const hours = Math.floor(timeRemaining / (60 * 60 * 1000));
    const minutes = Math.floor((timeRemaining % (60 * 60 * 1000)) / (60 * 1000));
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  const filteredApprovals = pendingApprovals.filter(approval => {
    if (filterUrgency === 'all') return true;
    return approval.analytics.urgencyLevel === filterUrgency;
  });

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <LoadingSpinner />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center">
            <Shield className="h-6 w-6 mr-2 text-blue-600" />
            Bypass Approval Center
          </h1>
          <p className="text-gray-600 mt-1">Review and approve bypass checkout requests</p>
        </div>

        <div className="flex items-center space-x-3">
          <select
            value={filterUrgency}
            onChange={(e) => setFilterUrgency(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm"
          >
            <option value="all">All Urgency Levels</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>

          <Button onClick={handleRefresh} disabled={refreshing} size="sm" variant="outline">
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Success Message */}
      {success && (
        <Alert className="border-green-200 bg-green-50">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">{success}</AlertDescription>
        </Alert>
      )}

      {/* Error Message */}
      {error && (
        <Alert className="border-red-200 bg-red-50">
          <AlertTriangle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-800">{error}</AlertDescription>
        </Alert>
      )}

      {/* Statistics */}
      {statistics && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center">
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-600">Pending Approvals</p>
                  <p className="text-2xl font-bold text-orange-600">{filteredApprovals.length}</p>
                </div>
                <Clock className="h-8 w-8 text-orange-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center">
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-600">Approved (30d)</p>
                  <p className="text-2xl font-bold text-green-600">{statistics.approvedWorkflows}</p>
                </div>
                <CheckCircle className="h-8 w-8 text-green-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center">
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-600">Avg Response Time</p>
                  <p className="text-2xl font-bold text-blue-600">
                    {Math.round(statistics.averageResponseTime / 60000)}m
                  </p>
                </div>
                <TrendingUp className="h-8 w-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center">
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-600">Escalated</p>
                  <p className="text-2xl font-bold text-red-600">{statistics.escalatedCount}</p>
                </div>
                <ArrowUp className="h-8 w-8 text-red-600" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Pending Approvals */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Clock className="h-5 w-5 mr-2" />
            Pending Approvals ({filteredApprovals.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredApprovals.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <CheckCircle className="mx-auto h-12 w-12 mb-3 text-gray-400" />
              <p>No pending approvals found</p>
              <p className="text-sm">All bypass requests have been processed</p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredApprovals.map((approval) => (
                <div
                  key={approval._id}
                  className="border rounded-lg p-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <Badge className={getUrgencyColor(approval.analytics.urgencyLevel)}>
                          {approval.analytics.urgencyLevel.toUpperCase()}
                        </Badge>

                        <Badge className={getRiskColor(approval.bypassAuditId.securityMetadata.riskScore)}>
                          Risk: {approval.bypassAuditId.securityMetadata.riskScore}
                        </Badge>

                        <Badge variant="outline">
                          Level {approval.currentLevel}
                        </Badge>

                        <Badge 
                          variant={approval.timeRemaining <= 900000 ? 'destructive' : 'secondary'}
                        >
                          {formatTimeRemaining(approval.timeRemaining)}
                        </Badge>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <h4 className="font-medium text-gray-900 mb-1">
                            Bypass Request #{approval.bypassAuditId.bypassId}
                          </h4>
                          <p className="text-sm text-gray-600 mb-2">
                            <User className="h-4 w-4 inline mr-1" />
                            Requested by: {approval.initiatedBy.name}
                          </p>
                          <p className="text-sm text-gray-600 mb-2">
                            <FileText className="h-4 w-4 inline mr-1" />
                            Category: {approval.bypassAuditId.reason.category.replace(/_/g, ' ')}
                          </p>
                          <p className="text-sm text-gray-600">
                            {approval.bypassAuditId.reason.description.substring(0, 150)}
                            {approval.bypassAuditId.reason.description.length > 150 ? '...' : ''}
                          </p>
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-center text-sm text-gray-600">
                            <DollarSign className="h-4 w-4 mr-2" />
                            Financial Impact: ₹{approval.bypassAuditId.financialImpact.estimatedLoss?.toLocaleString('en-IN') || '0'}
                          </div>

                          <div className="flex items-center text-sm text-gray-600">
                            <Calendar className="h-4 w-4 mr-2" />
                            Requested: {new Date(approval.timing.initiatedAt).toLocaleString()}
                          </div>

                          <div className="flex items-center text-sm text-gray-600">
                            <Clock className="h-4 w-4 mr-2" />
                            Timeout: {new Date(approval.timing.timeoutAt).toLocaleString()}
                          </div>
                        </div>
                      </div>

                      {/* Progress Bar */}
                      <div className="mt-3">
                        <div className="flex justify-between text-xs text-gray-500 mb-1">
                          <span>Approval Progress</span>
                          <span>{approval.completionPercentage}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-blue-600 h-2 rounded-full"
                            style={{ width: `${approval.completionPercentage}%` }}
                          ></div>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col space-y-2 ml-4">
                      <Button
                        onClick={() => openApprovalModal(approval, 'approved')}
                        disabled={processing === approval.workflowId}
                        size="sm"
                        className="bg-green-600 hover:bg-green-700"
                      >
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Approve
                      </Button>

                      <Button
                        onClick={() => openApprovalModal(approval, 'rejected')}
                        disabled={processing === approval.workflowId}
                        size="sm"
                        variant="destructive"
                      >
                        <XCircle className="h-4 w-4 mr-2" />
                        Reject
                      </Button>

                      <Button
                        onClick={() => escalateApproval(approval.workflowId)}
                        disabled={processing === approval.workflowId}
                        size="sm"
                        variant="outline"
                      >
                        <ArrowUp className="h-4 w-4 mr-2" />
                        Escalate
                      </Button>

                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => openApprovalModal(approval, 'approved')}
                        title="View approval details"
                      >
                        <Eye className="h-4 w-4 mr-2" />
                        Details
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Approval Modal */}
      {selectedApproval && approvalAction && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold mb-4 flex items-center">
              {approvalAction === 'approved' ? (
                <CheckCircle className="h-5 w-5 text-green-600 mr-2" />
              ) : (
                <XCircle className="h-5 w-5 text-red-600 mr-2" />
              )}
              {approvalAction === 'approved' ? 'Approve' : 'Reject'} Bypass Request
            </h3>
            
            <div className="space-y-4">
              <div className="bg-gray-50 p-3 rounded">
                <p><strong>Bypass ID:</strong> {selectedApproval.bypassAuditId.bypassId}</p>
                <p><strong>Requested by:</strong> {selectedApproval.initiatedBy.name}</p>
                <p><strong>Risk Score:</strong> {selectedApproval.bypassAuditId.securityMetadata.riskScore}</p>
                <p><strong>Financial Impact:</strong> ₹{selectedApproval.bypassAuditId.financialImpact.estimatedLoss?.toLocaleString('en-IN') || '0'}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <MessageSquare className="h-4 w-4 inline mr-1" />
                  {approvalAction === 'approved' ? 'Approval' : 'Rejection'} Notes (Required)
                </label>
                <textarea
                  value={approvalNotes}
                  onChange={(e) => setApprovalNotes(e.target.value)}
                  placeholder={`Enter detailed notes explaining your ${approvalAction} decision...`}
                  className="w-full p-3 border border-gray-300 rounded-md resize-none h-24"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  Provide clear reasoning for your decision (minimum 5 characters)
                </p>
              </div>

              {error && (
                <div className="text-red-600 text-sm bg-red-50 p-2 rounded">
                  {error}
                </div>
              )}

              <div className="flex space-x-3">
                <Button
                  onClick={processApproval}
                  disabled={approvalNotes.trim().length < 5 || processing === selectedApproval.workflowId}
                  className={approvalAction === 'approved' ? 'bg-green-600 hover:bg-green-700' : ''}
                  variant={approvalAction === 'approved' ? 'default' : 'destructive'}
                >
                  {processing === selectedApproval.workflowId ? 'Processing...' : `Confirm ${approvalAction === 'approved' ? 'Approval' : 'Rejection'}`}
                </Button>
                <Button
                  onClick={closeApprovalModal}
                  variant="outline"
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BypassApprovalCenter;

