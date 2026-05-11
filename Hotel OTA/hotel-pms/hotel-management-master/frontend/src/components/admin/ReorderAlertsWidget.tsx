import React, { useState, useEffect } from 'react';
import {
  AlertTriangle,
  Package,
  Clock,
  CheckCircle,
  XCircle,
  Eye,
  RefreshCw,
  Filter,
  Bell,
  TrendingUp,
  Calendar,
  DollarSign,
  User,
  MessageSquare
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/badge';
import { reorderService } from '../../services/reorderService';
import { ReorderAlert } from '../../types/admin';

interface ReorderAlertsWidgetProps {
  className?: string;
  showHeader?: boolean;
  maxItems?: number;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

interface AlertFilters {
  status?: 'active' | 'acknowledged' | 'resolved' | 'dismissed';
  priority?: 'low' | 'medium' | 'high' | 'critical';
  alertType?: 'low_stock' | 'critical_stock' | 'reorder_needed';
}

export const ReorderAlertsWidget: React.FC<ReorderAlertsWidgetProps> = ({
  className = '',
  showHeader = true,
  maxItems = 10,
  autoRefresh = true,
  refreshInterval = 30000 // 30 seconds
}) => {
  const [alerts, setAlerts] = useState<ReorderAlert[]>([]);
  const [summary, setSummary] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<AlertFilters>({});
  const [showFilters, setShowFilters] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedAlert, setSelectedAlert] = useState<ReorderAlert | null>(null);
  const [processing, setProcessing] = useState<string | null>(null);
  const [notes, setNotes] = useState('');

  // Fetch alerts
  const fetchAlerts = async () => {
    try {
      setError(null);
      const data = await reorderService.getAlerts(filters);

      // Limit items if maxItems is specified
      const limitedAlerts = maxItems ? data.alerts.slice(0, maxItems) : data.alerts;

      setAlerts(limitedAlerts);
      setSummary(data.summary);
    } catch (err) {
      setError('Failed to load reorder alerts');
    } finally {
      setLoading(false);
    }
  };

  // Initial load and filter changes
  useEffect(() => {
    fetchAlerts();
  }, [filters]);

  // Auto-refresh
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(fetchAlerts, refreshInterval);
    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval, filters]);

  // Handle alert actions
  const handleAcknowledge = async (alertId: string) => {
    try {
      setProcessing(alertId);
      await reorderService.acknowledgeAlert(alertId, notes);
      await fetchAlerts();
      setNotes('');
    } catch {
      // Error handled silently
    } finally {
      setProcessing(null);
    }
  };

  const handleDismiss = async (alertId: string) => {
    try {
      setProcessing(alertId);
      await reorderService.dismissAlert(alertId, notes || 'Dismissed from widget');
      await fetchAlerts();
      setNotes('');
    } catch {
      // Error handled silently
    } finally {
      setProcessing(null);
    }
  };

  const handleApprove = async (alertId: string) => {
    try {
      setProcessing(alertId);
      await reorderService.processReorderRequest(alertId, {
        action: 'approve',
        notes: notes || 'Approved from widget'
      });
      await fetchAlerts();
      setNotes('');
    } catch {
      // Error handled silently
    } finally {
      setProcessing(null);
    }
  };

  const handleReject = async (alertId: string) => {
    try {
      setProcessing(alertId);
      await reorderService.processReorderRequest(alertId, {
        action: 'reject',
        notes: notes || 'Rejected from widget'
      });
      await fetchAlerts();
      setNotes('');
    } catch {
      // Error handled silently
    } finally {
      setProcessing(null);
    }
  };

  // Get priority icon and color
  const getPriorityDisplay = (priority: string) => {
    const configs = {
      critical: { icon: AlertTriangle, color: 'text-red-500', bg: 'bg-red-50' },
      high: { icon: TrendingUp, color: 'text-orange-500', bg: 'bg-orange-50' },
      medium: { icon: Clock, color: 'text-yellow-500', bg: 'bg-yellow-50' },
      low: { icon: Bell, color: 'text-blue-500', bg: 'bg-blue-50' }
    };
    return configs[priority as keyof typeof configs] || configs.low;
  };

  // Get status display
  const getStatusDisplay = (status: string) => {
    const configs = {
      active: { label: 'Active', color: 'bg-red-100 text-red-800 border-red-200' },
      acknowledged: { label: 'In Progress', color: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
      resolved: { label: 'Resolved', color: 'bg-green-100 text-green-800 border-green-200' },
      dismissed: { label: 'Dismissed', color: 'bg-gray-100 text-gray-800 border-gray-200' }
    };
    return configs[status as keyof typeof configs] || configs.active;
  };

  // Filter alerts by status for quick access
  const activeAlerts = alerts.filter(alert => alert.status === 'active');
  const criticalAlerts = alerts.filter(alert => alert.priority === 'critical');

  if (loading) {
    return (
      <Card className={className}>
        <CardContent className="p-6">
          <div className="flex items-center justify-center space-x-2">
            <RefreshCw className="h-4 w-4 animate-spin" />
            <span>Loading reorder alerts...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={className}>
        <CardContent className="p-6">
          <div className="text-center">
            <AlertTriangle className="h-8 w-8 text-red-500 mx-auto mb-2" />
            <p className="text-sm text-gray-600">{error}</p>
            <Button
              onClick={fetchAlerts}
              variant="outline"
              size="sm"
              className="mt-2"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className={className}>
        {showHeader && (
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg font-semibold flex items-center">
                <Package className="h-5 w-5 mr-2 text-blue-600" />
                Reorder Alerts
                {summary && (
                  <Badge variant="secondary" className="ml-2">
                    {summary.total}
                  </Badge>
                )}
              </CardTitle>
              <div className="flex items-center space-x-2">
                <Button
                  onClick={() => setShowFilters(!showFilters)}
                  variant="outline"
                  size="sm"
                >
                  <Filter className="h-4 w-4" />
                </Button>
                <Button
                  onClick={fetchAlerts}
                  variant="outline"
                  size="sm"
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Summary Cards */}
            {summary && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
                <div className="bg-red-50 p-3 rounded-lg">
                  <div className="text-2xl font-bold text-red-600">
                    {criticalAlerts.length}
                  </div>
                  <div className="text-xs text-red-600">Critical</div>
                </div>
                <div className="bg-yellow-50 p-3 rounded-lg">
                  <div className="text-2xl font-bold text-yellow-600">
                    {activeAlerts.length}
                  </div>
                  <div className="text-xs text-yellow-600">Active</div>
                </div>
                <div className="bg-green-50 p-3 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">
                    {summary.byStatus.resolved || 0}
                  </div>
                  <div className="text-xs text-green-600">Resolved</div>
                </div>
                <div className="bg-blue-50 p-3 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">
                    {summary.total}
                  </div>
                  <div className="text-xs text-blue-600">Total</div>
                </div>
              </div>
            )}

            {/* Filters */}
            {showFilters && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4 p-3 bg-gray-50 rounded-lg">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Status
                  </label>
                  <select
                    value={filters.status || ''}
                    onChange={(e) => setFilters({ ...filters, status: e.target.value as string })}
                    className="w-full px-3 py-1 text-sm border border-gray-300 rounded-md"
                  >
                    <option value="">All Statuses</option>
                    <option value="active">Active</option>
                    <option value="acknowledged">Acknowledged</option>
                    <option value="resolved">Resolved</option>
                    <option value="dismissed">Dismissed</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Priority
                  </label>
                  <select
                    value={filters.priority || ''}
                    onChange={(e) => setFilters({ ...filters, priority: e.target.value as string })}
                    className="w-full px-3 py-1 text-sm border border-gray-300 rounded-md"
                  >
                    <option value="">All Priorities</option>
                    <option value="critical">Critical</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Type
                  </label>
                  <select
                    value={filters.alertType || ''}
                    onChange={(e) => setFilters({ ...filters, alertType: e.target.value as string })}
                    className="w-full px-3 py-1 text-sm border border-gray-300 rounded-md"
                  >
                    <option value="">All Types</option>
                    <option value="low_stock">Low Stock</option>
                    <option value="critical_stock">Critical Stock</option>
                    <option value="reorder_needed">Reorder Needed</option>
                  </select>
                </div>
              </div>
            )}
          </CardHeader>
        )}

        <CardContent className="p-0">
          {alerts.length === 0 ? (
            <div className="p-6 text-center">
              <Package className="h-8 w-8 text-gray-400 mx-auto mb-2" />
              <p className="text-sm text-gray-600">No reorder alerts found</p>
              <p className="text-xs text-gray-500 mt-1">
                {filters.status || filters.priority || filters.alertType
                  ? 'Try adjusting your filters'
                  : 'All inventory items are adequately stocked'
                }
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {alerts.map((alert) => {
                const priorityConfig = getPriorityDisplay(alert.priority);
                const statusConfig = getStatusDisplay(alert.status);
                const PriorityIcon = priorityConfig.icon;

                return (
                  <div key={alert._id} className="p-4 hover:bg-gray-50 transition-colors">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start space-x-3 flex-1">
                        <div className={`p-2 rounded-lg ${priorityConfig.bg}`}>
                          <PriorityIcon className={`h-4 w-4 ${priorityConfig.color}`} />
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-2 mb-1">
                            <h4 className="font-medium text-gray-900 truncate">
                              {alert.inventoryItemId.name}
                            </h4>
                            <Badge className={statusConfig.color} variant="outline">
                              {statusConfig.label}
                            </Badge>
                            <Badge variant="outline">
                              {alert.priority}
                            </Badge>
                          </div>

                          <div className="grid grid-cols-2 gap-2 text-xs text-gray-600 mb-2">
                            <div>Current: {alert.currentStock}</div>
                            <div>Threshold: {alert.reorderPoint}</div>
                            <div>Suggested: {alert.suggestedQuantity}</div>
                            <div>
                              Cost: {alert.estimatedCost ? `$${alert.estimatedCost.toFixed(2)}` : 'TBD'}
                            </div>
                          </div>

                          <div className="flex items-center text-xs text-gray-500">
                            <Calendar className="h-3 w-3 mr-1" />
                            {reorderService.formatRelativeTime(alert.createdAt)}
                            {alert.urgencyScore && (
                              <>
                                <span className="mx-2">•</span>
                                <TrendingUp className="h-3 w-3 mr-1" />
                                Urgency: {alert.urgencyScore}/100
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center space-x-1 ml-3">
                        <Button
                          onClick={() => {
                            setSelectedAlert(alert);
                            setShowDetailsModal(true);
                          }}
                          variant="ghost"
                          size="sm"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>

                        {alert.status === 'active' && (
                          <>
                            <Button
                              onClick={() => handleAcknowledge(alert._id)}
                              disabled={processing === alert._id}
                              variant="ghost"
                              size="sm"
                              className="text-yellow-600 hover:text-yellow-700"
                            >
                              <Clock className="h-4 w-4" />
                            </Button>
                            <Button
                              onClick={() => handleApprove(alert._id)}
                              disabled={processing === alert._id}
                              variant="ghost"
                              size="sm"
                              className="text-green-600 hover:text-green-700"
                            >
                              <CheckCircle className="h-4 w-4" />
                            </Button>
                            <Button
                              onClick={() => handleDismiss(alert._id)}
                              disabled={processing === alert._id}
                              variant="ghost"
                              size="sm"
                              className="text-red-600 hover:text-red-700"
                            >
                              <XCircle className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Alert Details Modal */}
      {showDetailsModal && selectedAlert && (
        <Modal
          isOpen={showDetailsModal}
          onClose={() => setShowDetailsModal(false)}
          title="Reorder Alert Details"
          size="lg"
        >
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <h3 className="font-medium text-gray-900 mb-2">Item Information</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Name:</span>
                    <span className="font-medium">{selectedAlert.inventoryItemId.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Category:</span>
                    <span>{selectedAlert.inventoryItemId.category}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Current Stock:</span>
                    <span className={selectedAlert.currentStock <= 0 ? 'text-red-600 font-bold' : ''}>
                      {selectedAlert.currentStock}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Reorder Point:</span>
                    <span>{selectedAlert.reorderPoint}</span>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="font-medium text-gray-900 mb-2">Alert Details</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Priority:</span>
                    <Badge className={reorderService.getPriorityColor(selectedAlert.priority)}>
                      {selectedAlert.priority}
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Status:</span>
                    <Badge className={reorderService.getStatusColor(selectedAlert.status)}>
                      {getStatusDisplay(selectedAlert.status).label}
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Urgency Score:</span>
                    <span>{selectedAlert.urgencyScore}/100</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Created:</span>
                    <span>{new Date(selectedAlert.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>
            </div>

            {selectedAlert.supplierInfo?.name && (
              <div>
                <h3 className="font-medium text-gray-900 mb-2">Supplier Information</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Name:</span>
                    <span>{selectedAlert.supplierInfo.name}</span>
                  </div>
                  {selectedAlert.supplierInfo.contact && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Contact:</span>
                      <span>{selectedAlert.supplierInfo.contact}</span>
                    </div>
                  )}
                  {selectedAlert.supplierInfo.email && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Email:</span>
                      <span>{selectedAlert.supplierInfo.email}</span>
                    </div>
                  )}
                  {selectedAlert.supplierInfo.leadTime && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Lead Time:</span>
                      <span>{selectedAlert.supplierInfo.leadTime} days</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div>
              <h3 className="font-medium text-gray-900 mb-2">Reorder Recommendation</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Suggested Quantity:</span>
                  <span className="font-medium">{selectedAlert.suggestedQuantity}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Estimated Cost:</span>
                  <span>
                    {selectedAlert.estimatedCost
                      ? reorderService.formatCurrency(selectedAlert.estimatedCost)
                      : 'TBD'
                    }
                  </span>
                </div>
                {selectedAlert.expectedDeliveryDate && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Expected Delivery:</span>
                    <span>{new Date(selectedAlert.expectedDeliveryDate).toLocaleDateString()}</span>
                  </div>
                )}
              </div>
            </div>

            {selectedAlert.notes && (
              <div>
                <h3 className="font-medium text-gray-900 mb-2">Notes</h3>
                <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">
                  {selectedAlert.notes}
                </p>
              </div>
            )}

            {selectedAlert.status === 'active' && (
              <div>
                <h3 className="font-medium text-gray-900 mb-2">Actions</h3>
                <div className="space-y-3">
                  <Input
                    placeholder="Add notes (optional)"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                  <div className="flex space-x-2">
                    <Button
                      onClick={() => {
                        handleAcknowledge(selectedAlert._id);
                        setShowDetailsModal(false);
                      }}
                      disabled={processing === selectedAlert._id}
                      variant="outline"
                    >
                      <Clock className="h-4 w-4 mr-2" />
                      Acknowledge
                    </Button>
                    <Button
                      onClick={() => {
                        handleApprove(selectedAlert._id);
                        setShowDetailsModal(false);
                      }}
                      disabled={processing === selectedAlert._id}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Approve Reorder
                    </Button>
                    <Button
                      onClick={() => {
                        handleReject(selectedAlert._id);
                        setShowDetailsModal(false);
                      }}
                      disabled={processing === selectedAlert._id}
                      variant="outline"
                      className="text-red-600 border-red-600 hover:bg-red-50"
                    >
                      <XCircle className="h-4 w-4 mr-2" />
                      Reject
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}
    </>
  );
};

export default ReorderAlertsWidget;