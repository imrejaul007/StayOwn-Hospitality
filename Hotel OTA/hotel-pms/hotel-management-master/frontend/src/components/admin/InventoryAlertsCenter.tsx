import React, { useState, useEffect, useCallback } from 'react';
import { withErrorBoundary } from '../ErrorBoundary';
import { api } from '@/services/api';
import {
  AlertTriangle,
  AlertCircle,
  Info,
  CheckCircle,
  X,
  Eye,
  EyeOff,
  Clock,
  Package,
  Truck,
  DollarSign,
  TrendingDown,
  Calendar,
  User,
  Filter,
  Search,
  RefreshCw,
  Bell,
  BellOff,
  ArrowUp,
  ArrowDown,
  MoreHorizontal
} from 'lucide-react';

interface InventoryAlert {
  _id: string;
  hotelId: string;
  type: 'LOW_STOCK' | 'REORDER' | 'OVERDUE_DELIVERY' | 'QUALITY_ISSUE' | 'BUDGET_THRESHOLD' | 'EXPIRY_WARNING';
  title: string;
  message: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'active' | 'acknowledged' | 'resolved' | 'dismissed';
  itemId?: string;
  itemName?: string;
  vendorId?: string;
  vendorName?: string;
  purchaseOrderId?: string;
  poNumber?: string;
  currentValue?: number;
  thresholdValue?: number;
  actionRequired: boolean;
  actionTaken?: string;
  assignedTo?: string;
  assignedToName?: string;
  dueDate?: string;
  createdAt: string;
  acknowledgedAt?: string;
  resolvedAt?: string;
  createdBy?: string;
  createdByName?: string;
}

interface ReorderAlert {
  _id: string;
  hotelId: string;
  inventoryItemId: string;
  itemName: string;
  currentStock: number;
  reorderPoint: number;
  suggestedQuantity: number;
  urgencyLevel: 'low' | 'medium' | 'high' | 'critical';
  estimatedCost: number;
  suggestedVendor?: {
    id: string;
    name: string;
    rating: number;
    leadTime: number;
    unitPrice: number;
  };
  autoCreatePO: boolean;
  status: 'pending' | 'approved' | 'po_created' | 'dismissed';
  createdAt: string;
  processedAt?: string;
}

interface AlertFilters {
  type: string;
  severity: string;
  status: string;
  assignedTo: string;
  dateRange: string;
  actionRequired: boolean | null;
}

const InventoryAlertsCenter: React.FC = () => {
  const [alerts, setAlerts] = useState<InventoryAlert[]>([]);
  const [reorderAlerts, setReorderAlerts] = useState<ReorderAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'inventory' | 'reorder'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedAlerts, setSelectedAlerts] = useState<string[]>([]);
  const [filters, setFilters] = useState<AlertFilters>({
    type: 'all',
    severity: 'all',
    status: 'active',
    assignedTo: 'all',
    dateRange: 'all',
    actionRequired: null
  });
  const [sortBy, setSortBy] = useState<'createdAt' | 'severity' | 'dueDate'>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [selectedAlert, setSelectedAlert] = useState<InventoryAlert | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [notifications, setNotifications] = useState(true);

  // Mock data - Replace with actual API calls
  useEffect(() => {
    fetchAlerts();
    fetchReorderAlerts();
  }, [filters, sortBy, sortOrder]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    if (!notifications) return;

    const interval = setInterval(() => {
      refreshAlerts();
    }, 30000);

    return () => clearInterval(interval);
  }, [notifications]);

  const fetchAlerts = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.get('/inventory-notifications', {
        params: { limit: 50 }
      });
      const notifications = response.data?.data?.notifications || [];

      // Map notifications to the InventoryAlert shape
      const mapped: InventoryAlert[] = notifications.map((n: Record<string, unknown>) => ({
        _id: (n._id as string) || (n.id as string) || '',
        hotelId: (n.hotelId as string) || '',
        type: mapNotificationType((n.type as string) || ''),
        title: (n.title as string) || '',
        message: (n.message as string) || '',
        severity: mapSeverity((n.priority as string) || (n.severity as string) || 'low'),
        status: (n.isRead as boolean) ? 'acknowledged' : 'active',
        itemId: (n.metadata as Record<string, unknown>)?.roomId as string || undefined,
        itemName: (n.metadata as Record<string, unknown>)?.roomNumber as string || (n.itemName as string) || undefined,
        currentValue: (n.currentValue as number) || undefined,
        thresholdValue: (n.thresholdValue as number) || undefined,
        actionRequired: (n.priority as string) === 'urgent' || (n.priority as string) === 'high',
        createdAt: (n.createdAt as string) || new Date().toISOString(),
        createdByName: 'System'
      }));

      setAlerts(mapped);
    } catch {
      setAlerts([]);
    } finally {
      setLoading(false);
    }
  }, [filters, sortBy, sortOrder]);

  const mapNotificationType = (type: string): InventoryAlert['type'] => {
    const typeMap: Record<string, InventoryAlert['type']> = {
      'low_stock': 'LOW_STOCK',
      'LOW_STOCK': 'LOW_STOCK',
      'reorder': 'REORDER',
      'REORDER': 'REORDER',
      'overdue': 'OVERDUE_DELIVERY',
      'OVERDUE_DELIVERY': 'OVERDUE_DELIVERY',
      'quality': 'QUALITY_ISSUE',
      'QUALITY_ISSUE': 'QUALITY_ISSUE',
      'budget': 'BUDGET_THRESHOLD',
      'BUDGET_THRESHOLD': 'BUDGET_THRESHOLD',
      'expiry': 'EXPIRY_WARNING',
      'EXPIRY_WARNING': 'EXPIRY_WARNING',
    };
    return typeMap[type] || 'LOW_STOCK';
  };

  const mapSeverity = (priority: string): InventoryAlert['severity'] => {
    const map: Record<string, InventoryAlert['severity']> = {
      'urgent': 'critical',
      'critical': 'critical',
      'high': 'high',
      'medium': 'medium',
      'low': 'low',
    };
    return map[priority] || 'low';
  };

  const fetchReorderAlerts = useCallback(async () => {
    try {
      // Reorder alerts come from the same inventory notification endpoint
      // filtered for low-stock type items that need reordering
      const response = await api.get('/inventory', {
        params: { limit: 20, lowStock: true }
      });
      const items = response.data?.data?.items || response.data?.data || [];

      if (!Array.isArray(items)) {
        setReorderAlerts([]);
        return;
      }

      const mapped: ReorderAlert[] = items
        .filter((item: Record<string, unknown>) =>
          (item.currentStock as number || 0) <= (item.stockThreshold as number || item.reorderPoint as number || 0))
        .map((item: Record<string, unknown>) => ({
          _id: (item._id as string) || '',
          hotelId: (item.hotelId as string) || '',
          inventoryItemId: (item._id as string) || '',
          itemName: (item.name as string) || '',
          currentStock: (item.currentStock as number) || 0,
          reorderPoint: (item.stockThreshold as number) || (item.reorderPoint as number) || 0,
          suggestedQuantity: Math.max(0, ((item.stockThreshold as number || 0) * 2) - (item.currentStock as number || 0)),
          urgencyLevel: (item.currentStock as number || 0) === 0 ? 'critical' as const :
            (item.currentStock as number || 0) < ((item.stockThreshold as number || 0) / 2) ? 'high' as const : 'medium' as const,
          estimatedCost: ((item.unitPrice as number) || 0) * Math.max(0, ((item.stockThreshold as number || 0) * 2) - (item.currentStock as number || 0)),
          autoCreatePO: false,
          status: 'pending' as const,
          createdAt: (item.updatedAt as string) || new Date().toISOString(),
        }));

      setReorderAlerts(mapped);
    } catch {
      setReorderAlerts([]);
    }
  }, []);

  const refreshAlerts = async () => {
    setRefreshing(true);
    await Promise.all([fetchAlerts(), fetchReorderAlerts()]);
    setRefreshing(false);
  };

  const handleAlertAction = async (alertId: string, action: 'acknowledge' | 'resolve' | 'dismiss', actionTaken?: string) => {
    try {
      // Mock API call - Replace with actual implementation

      // Update local state
      setAlerts(prevAlerts =>
        prevAlerts.map(alert =>
          alert._id === alertId
            ? {
                ...alert,
                status: action === 'acknowledge' ? 'acknowledged' : action === 'resolve' ? 'resolved' : 'dismissed',
                actionTaken,
                [action === 'acknowledge' ? 'acknowledgedAt' : 'resolvedAt']: new Date().toISOString()
              }
            : alert
        )
      );

      // Remove from selected alerts
      setSelectedAlerts(prev => prev.filter(id => id !== alertId));

    } catch {
      // Error handled silently
    }
  };

  const handleReorderAction = async (alertId: string, action: 'approve' | 'dismiss' | 'create_po') => {
    try {
      // Mock API call - Replace with actual implementation

      setReorderAlerts(prevAlerts =>
        prevAlerts.map(alert =>
          alert._id === alertId
            ? {
                ...alert,
                status: action === 'approve' ? 'approved' : action === 'create_po' ? 'po_created' : 'dismissed',
                processedAt: new Date().toISOString()
              }
            : alert
        )
      );

    } catch {
      // Error handled silently
    }
  };

  const handleBulkAction = async (action: 'acknowledge' | 'resolve' | 'dismiss') => {
    try {
      await Promise.all(
        selectedAlerts.map(alertId => handleAlertAction(alertId, action))
      );
      setSelectedAlerts([]);
    } catch {
      // Error handled silently
    }
  };

  const getAlertIcon = (type: string) => {
    switch (type) {
      case 'LOW_STOCK': return <Package className="w-5 h-5" />;
      case 'REORDER': return <RefreshCw className="w-5 h-5" />;
      case 'OVERDUE_DELIVERY': return <Truck className="w-5 h-5" />;
      case 'QUALITY_ISSUE': return <AlertTriangle className="w-5 h-5" />;
      case 'BUDGET_THRESHOLD': return <DollarSign className="w-5 h-5" />;
      case 'EXPIRY_WARNING': return <Calendar className="w-5 h-5" />;
      default: return <Info className="w-5 h-5" />;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'text-red-600 bg-red-50 border-red-200';
      case 'high': return 'text-orange-600 bg-orange-50 border-orange-200';
      case 'medium': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      default: return 'text-blue-600 bg-blue-50 border-blue-200';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'text-red-600 bg-red-100';
      case 'acknowledged': return 'text-yellow-600 bg-yellow-100';
      case 'resolved': return 'text-green-600 bg-green-100';
      case 'dismissed': return 'text-gray-600 bg-gray-100';
      default: return 'text-blue-600 bg-blue-100';
    }
  };

  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case 'critical': return 'text-red-600 bg-red-100';
      case 'high': return 'text-orange-600 bg-orange-100';
      case 'medium': return 'text-yellow-600 bg-yellow-100';
      default: return 'text-green-600 bg-green-100';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR'
    }).format(amount);
  };

  const filteredAlerts = alerts.filter(alert => {
    if (filters.type !== 'all' && alert.type !== filters.type) return false;
    if (filters.severity !== 'all' && alert.severity !== filters.severity) return false;
    if (filters.status !== 'all' && alert.status !== filters.status) return false;
    if (filters.assignedTo !== 'all' && alert.assignedTo !== filters.assignedTo) return false;
    if (filters.actionRequired !== null && alert.actionRequired !== filters.actionRequired) return false;
    if (searchTerm && !alert.title.toLowerCase().includes(searchTerm.toLowerCase()) &&
        !alert.message.toLowerCase().includes(searchTerm.toLowerCase()) &&
        !(alert.itemName && alert.itemName.toLowerCase().includes(searchTerm.toLowerCase()))) return false;
    return true;
  });

  const filteredReorderAlerts = reorderAlerts.filter(alert => {
    if (searchTerm && !alert.itemName.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    return true;
  });

  const activeAlertsCount = alerts.filter(alert => alert.status === 'active').length;
  const criticalAlertsCount = alerts.filter(alert => alert.severity === 'critical').length;
  const actionRequiredCount = alerts.filter(alert => alert.actionRequired && alert.status === 'active').length;

  return (
    <div className="bg-white rounded-lg shadow-sm">
      {/* Header */}
      <div className="border-b border-gray-200 px-6 py-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center">
          <div className="flex items-center">
            <Bell className={`w-6 h-6 mr-3 ${activeAlertsCount > 0 ? 'text-red-500' : 'text-gray-400'}`} />
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Inventory Alerts Center</h2>
              <p className="text-sm text-gray-600">
                {activeAlertsCount} active alerts • {criticalAlertsCount} critical • {actionRequiredCount} require action
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-3 mt-4 sm:mt-0">
            <button
              onClick={() => setNotifications(!notifications)}
              className={`flex items-center px-3 py-2 rounded-lg text-sm transition-colors ${
                notifications
                  ? 'bg-green-100 text-green-700 hover:bg-green-200'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {notifications ? <Bell className="w-4 h-4 mr-1" /> : <BellOff className="w-4 h-4 mr-1" />}
              Auto-refresh {notifications ? 'ON' : 'OFF'}
            </button>
            <button
              onClick={refreshAlerts}
              disabled={refreshing}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="border-b border-gray-200 px-6 py-4">
        <div className="flex flex-col sm:flex-row items-center space-y-3 sm:space-y-0 sm:space-x-4">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search alerts..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center px-4 py-2 rounded-lg transition-colors ${
              showFilters ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <Filter className="w-4 h-4 mr-2" />
            Filters
          </button>
        </div>

        {showFilters && (
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <select
              value={filters.type}
              onChange={(e) => setFilters(prev => ({ ...prev, type: e.target.value }))}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Types</option>
              <option value="LOW_STOCK">Low Stock</option>
              <option value="REORDER">Reorder</option>
              <option value="OVERDUE_DELIVERY">Overdue</option>
              <option value="QUALITY_ISSUE">Quality</option>
              <option value="BUDGET_THRESHOLD">Budget</option>
            </select>

            <select
              value={filters.severity}
              onChange={(e) => setFilters(prev => ({ ...prev, severity: e.target.value }))}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Severities</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>

            <select
              value={filters.status}
              onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="acknowledged">Acknowledged</option>
              <option value="resolved">Resolved</option>
              <option value="dismissed">Dismissed</option>
            </select>

            <select
              value={filters.actionRequired === null ? 'all' : filters.actionRequired.toString()}
              onChange={(e) => setFilters(prev => ({
                ...prev,
                actionRequired: e.target.value === 'all' ? null : e.target.value === 'true'
              }))}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Actions</option>
              <option value="true">Action Required</option>
              <option value="false">No Action</option>
            </select>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as unknown)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="createdAt">Sort by Date</option>
              <option value="severity">Sort by Severity</option>
              <option value="dueDate">Sort by Due Date</option>
            </select>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex px-6">
          {[
            { id: 'all', label: 'All Alerts', count: alerts.length + reorderAlerts.length },
            { id: 'inventory', label: 'Inventory Alerts', count: alerts.length },
            { id: 'reorder', label: 'Reorder Alerts', count: reorderAlerts.length }
          ].map(({ id, label, count }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id as unknown)}
              className={`${
                activeTab === id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm mr-8`}
            >
              {label} ({count})
            </button>
          ))}
        </nav>
      </div>

      {/* Bulk Actions */}
      {selectedAlerts.length > 0 && (
        <div className="bg-blue-50 px-6 py-3 border-b border-blue-200">
          <div className="flex items-center justify-between">
            <span className="text-sm text-blue-800">
              {selectedAlerts.length} alert(s) selected
            </span>
            <div className="flex space-x-2">
              <button
                onClick={() => handleBulkAction('acknowledge')}
                className="px-3 py-1 bg-yellow-600 text-white text-sm rounded hover:bg-yellow-700"
              >
                Acknowledge
              </button>
              <button
                onClick={() => handleBulkAction('resolve')}
                className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700"
              >
                Resolve
              </button>
              <button
                onClick={() => handleBulkAction('dismiss')}
                className="px-3 py-1 bg-gray-600 text-white text-sm rounded hover:bg-gray-700"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="p-6">
        {loading ? (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="animate-pulse border rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-5 h-5 bg-gray-300 rounded"></div>
                    <div className="space-y-2">
                      <div className="h-4 bg-gray-300 rounded w-48"></div>
                      <div className="h-3 bg-gray-300 rounded w-32"></div>
                    </div>
                  </div>
                  <div className="h-8 bg-gray-300 rounded w-20"></div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            {/* Inventory Alerts */}
            {(activeTab === 'all' || activeTab === 'inventory') && (
              <>
                {filteredAlerts.map((alert) => (
                  <div
                    key={alert._id}
                    className={`border rounded-lg p-4 transition-all duration-200 hover:shadow-md ${getSeverityColor(alert.severity)}`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start space-x-3 flex-1">
                        <input
                          type="checkbox"
                          checked={selectedAlerts.includes(alert._id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedAlerts(prev => [...prev, alert._id]);
                            } else {
                              setSelectedAlerts(prev => prev.filter(id => id !== alert._id));
                            }
                          }}
                          className="mt-1 w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                        />
                        <div className="flex-shrink-0">
                          {getAlertIcon(alert.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-2 mb-2">
                            <h3 className="font-medium text-gray-900">{alert.title}</h3>
                            <span className={`px-2 py-1 text-xs font-medium rounded-full ${getSeverityColor(alert.severity)}`}>
                              {alert.severity.toUpperCase()}
                            </span>
                            <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(alert.status)}`}>
                              {alert.status.toUpperCase()}
                            </span>
                          </div>
                          <p className="text-sm text-gray-700 mb-2">{alert.message}</p>
                          <div className="flex items-center space-x-4 text-xs text-gray-500">
                            <span className="flex items-center">
                              <Clock className="w-3 h-3 mr-1" />
                              Created: {formatDate(alert.createdAt)}
                            </span>
                            {alert.dueDate && (
                              <span className="flex items-center">
                                <Calendar className="w-3 h-3 mr-1" />
                                Due: {formatDate(alert.dueDate)}
                              </span>
                            )}
                            {alert.assignedToName && (
                              <span className="flex items-center">
                                <User className="w-3 h-3 mr-1" />
                                Assigned to: {alert.assignedToName}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2 ml-4">
                        {alert.status === 'active' && (
                          <>
                            <button
                              onClick={() => handleAlertAction(alert._id, 'acknowledge')}
                              className="px-3 py-1 bg-yellow-600 text-white text-sm rounded hover:bg-yellow-700 transition-colors"
                            >
                              Acknowledge
                            </button>
                            <button
                              onClick={() => handleAlertAction(alert._id, 'resolve')}
                              className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700 transition-colors"
                            >
                              Resolve
                            </button>
                            <button
                              onClick={() => handleAlertAction(alert._id, 'dismiss')}
                              className="px-3 py-1 bg-gray-600 text-white text-sm rounded hover:bg-gray-700 transition-colors"
                            >
                              Dismiss
                            </button>
                          </>
                        )}
                        <button aria-label="View"
                          onClick={() => {
                            setSelectedAlert(alert);
                            setShowDetailModal(true);
                          }}
                          className="p-2 text-gray-600 hover:bg-gray-100 rounded transition-colors"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </>
            )}

            {/* Reorder Alerts */}
            {(activeTab === 'all' || activeTab === 'reorder') && (
              <>
                {filteredReorderAlerts.map((alert) => (
                  <div
                    key={alert._id}
                    className={`border rounded-lg p-4 transition-all duration-200 hover:shadow-md ${getUrgencyColor(alert.urgencyLevel)} border-l-4`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start space-x-3 flex-1">
                        <RefreshCw className="w-5 h-5 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-2 mb-2">
                            <h3 className="font-medium text-gray-900">Reorder Required: {alert.itemName}</h3>
                            <span className={`px-2 py-1 text-xs font-medium rounded-full ${getUrgencyColor(alert.urgencyLevel)}`}>
                              {alert.urgencyLevel.toUpperCase()}
                            </span>
                            <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(alert.status)}`}>
                              {alert.status.toUpperCase()}
                            </span>
                          </div>
                          <p className="text-sm text-gray-700 mb-2">
                            Current stock: {alert.currentStock} | Reorder point: {alert.reorderPoint} |
                            Suggested quantity: {alert.suggestedQuantity}
                          </p>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                            <div>
                              <p className="text-gray-600">Estimated Cost: <span className="font-medium text-gray-900">{formatCurrency(alert.estimatedCost)}</span></p>
                              {alert.suggestedVendor && (
                                <p className="text-gray-600">
                                  Suggested Vendor: <span className="font-medium text-gray-900">{alert.suggestedVendor.name}</span>
                                  <span className="text-yellow-600 ml-1">★ {alert.suggestedVendor.rating.toFixed(1)}</span>
                                </p>
                              )}
                            </div>
                            <div>
                              {alert.suggestedVendor && (
                                <>
                                  <p className="text-gray-600">Lead Time: <span className="font-medium text-gray-900">{alert.suggestedVendor.leadTime} days</span></p>
                                  <p className="text-gray-600">Unit Price: <span className="font-medium text-gray-900">{formatCurrency(alert.suggestedVendor.unitPrice)}</span></p>
                                </>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center space-x-4 text-xs text-gray-500 mt-2">
                            <span className="flex items-center">
                              <Clock className="w-3 h-3 mr-1" />
                              Created: {formatDate(alert.createdAt)}
                            </span>
                            {alert.autoCreatePO && (
                              <span className="flex items-center text-green-600">
                                <CheckCircle className="w-3 h-3 mr-1" />
                                Auto-PO Enabled
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      {alert.status === 'pending' && (
                        <div className="flex items-center space-x-2 ml-4">
                          <button
                            onClick={() => handleReorderAction(alert._id, 'approve')}
                            className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700 transition-colors"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => handleReorderAction(alert._id, 'create_po')}
                            className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors"
                          >
                            Create PO
                          </button>
                          <button
                            onClick={() => handleReorderAction(alert._id, 'dismiss')}
                            className="px-3 py-1 bg-gray-600 text-white text-sm rounded hover:bg-gray-700 transition-colors"
                          >
                            Dismiss
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </>
            )}

            {/* No alerts message */}
            {filteredAlerts.length === 0 && filteredReorderAlerts.length === 0 && (
              <div className="text-center py-12">
                <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No alerts found</h3>
                <p className="text-gray-600">
                  {searchTerm || Object.values(filters).some(f => f !== 'all' && f !== null)
                    ? 'Try adjusting your filters or search terms.'
                    : 'All systems are running smoothly!'}
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {showDetailModal && selectedAlert && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full m-4 max-h-[90vh] overflow-y-auto">
            <div className="border-b border-gray-200 px-6 py-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-gray-900">Alert Details</h2>
                <button aria-label="Close"
                  onClick={() => setShowDetailModal(false)}
                  className="p-2 text-gray-400 hover:text-gray-600 rounded transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>
            <div className="p-6">
              <div className="space-y-4">
                <div className="flex items-center space-x-2">
                  {getAlertIcon(selectedAlert.type)}
                  <h3 className="text-lg font-medium">{selectedAlert.title}</h3>
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${getSeverityColor(selectedAlert.severity)}`}>
                    {selectedAlert.severity.toUpperCase()}
                  </span>
                </div>
                <p className="text-gray-700">{selectedAlert.message}</p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">Alert Information</h4>
                    <dl className="space-y-2 text-sm">
                      <div>
                        <dt className="text-gray-600">Type:</dt>
                        <dd className="font-medium">{selectedAlert.type.replace('_', ' ')}</dd>
                      </div>
                      <div>
                        <dt className="text-gray-600">Status:</dt>
                        <dd className="font-medium">{selectedAlert.status}</dd>
                      </div>
                      <div>
                        <dt className="text-gray-600">Created:</dt>
                        <dd className="font-medium">{formatDate(selectedAlert.createdAt)}</dd>
                      </div>
                      {selectedAlert.dueDate && (
                        <div>
                          <dt className="text-gray-600">Due Date:</dt>
                          <dd className="font-medium">{formatDate(selectedAlert.dueDate)}</dd>
                        </div>
                      )}
                    </dl>
                  </div>

                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">Related Information</h4>
                    <dl className="space-y-2 text-sm">
                      {selectedAlert.itemName && (
                        <div>
                          <dt className="text-gray-600">Item:</dt>
                          <dd className="font-medium">{selectedAlert.itemName}</dd>
                        </div>
                      )}
                      {selectedAlert.vendorName && (
                        <div>
                          <dt className="text-gray-600">Vendor:</dt>
                          <dd className="font-medium">{selectedAlert.vendorName}</dd>
                        </div>
                      )}
                      {selectedAlert.poNumber && (
                        <div>
                          <dt className="text-gray-600">PO Number:</dt>
                          <dd className="font-medium">{selectedAlert.poNumber}</dd>
                        </div>
                      )}
                      {selectedAlert.assignedToName && (
                        <div>
                          <dt className="text-gray-600">Assigned To:</dt>
                          <dd className="font-medium">{selectedAlert.assignedToName}</dd>
                        </div>
                      )}
                    </dl>
                  </div>
                </div>

                {selectedAlert.currentValue !== undefined && selectedAlert.thresholdValue !== undefined && (
                  <div className="pt-4">
                    <h4 className="font-medium text-gray-900 mb-2">Value Comparison</h4>
                    <div className="bg-gray-50 p-3 rounded-lg">
                      <div className="flex justify-between text-sm">
                        <span>Current Value: <span className="font-medium">{selectedAlert.currentValue}</span></span>
                        <span>Threshold: <span className="font-medium">{selectedAlert.thresholdValue}</span></span>
                      </div>
                      <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-blue-500 h-2 rounded-full"
                          style={{
                            width: `${Math.min(100, (selectedAlert.currentValue / selectedAlert.thresholdValue) * 100)}%`
                          }}
                        ></div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default withErrorBoundary(InventoryAlertsCenter, { level: 'component' });