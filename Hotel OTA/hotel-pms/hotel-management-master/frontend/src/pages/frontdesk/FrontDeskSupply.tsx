import React, { useState, useEffect, useCallback, useRef } from 'react';
import { format, parseISO } from 'date-fns';
import {
  Package,
  Clock,
  CheckCircle,
  AlertTriangle,
  Filter,
  Eye,
  DollarSign,
  RefreshCw,
  CheckSquare,
  XCircle,
  Search,
  Download,
  Zap,
  TrendingUp,
  ShoppingCart,
  Truck,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/Modal';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import ErrorBoundary from '../../components/ErrorBoundary';
import toast from 'react-hot-toast';
import {
  adminSupplyRequestsService,
  SupplyRequest,
  SupplyRequestStats,
  SupplyRequestFilters,
} from '../../services/adminSupplyRequestsService';
import { useRealTime } from '../../services/realTimeService';
import { useProperty } from '../../context/PropertyContext';
import { PropertyBreadcrumb } from '../../components/common/PropertyBreadcrumb';

function safeFormatDate(dateStr: string | undefined | null, formatStr: string): string {
  if (!dateStr) return 'N/A';
  try {
    return format(parseISO(dateStr), formatStr);
  } catch {
    return 'N/A';
  }
}

function formatCurrency(value?: number): string {
  if (value === undefined || value === null) return 'N/A';
  return `$${value.toFixed(2)}`;
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
  ordered: 'Ordered',
  partial_received: 'Partial',
  received: 'Received',
  cancelled: 'Cancelled',
};

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  approved: 'bg-blue-100 text-blue-800',
  rejected: 'bg-red-100 text-red-800',
  ordered: 'bg-purple-100 text-purple-800',
  partial_received: 'bg-orange-100 text-orange-800',
  received: 'bg-green-100 text-green-800',
  cancelled: 'bg-gray-100 text-gray-800',
};

const PRIORITY_COLORS: Record<string, string> = {
  low: 'bg-gray-100 text-gray-800',
  medium: 'bg-yellow-100 text-yellow-800',
  high: 'bg-orange-100 text-orange-800',
  urgent: 'bg-red-100 text-red-800',
  emergency: 'bg-red-200 text-red-900',
};

const DEPARTMENT_LABELS: Record<string, string> = {
  housekeeping: 'Housekeeping',
  maintenance: 'Maintenance',
  front_desk: 'Front Desk',
  food_beverage: 'Food & Beverage',
  spa: 'Spa',
  laundry: 'Laundry',
  kitchen: 'Kitchen',
  bar: 'Bar',
  other: 'Other',
};

export default function FrontDeskSupply() {
  const { selectedPropertyId, viewMode } = useProperty();
  const { on, off } = useRealTime();
  const [requests, setRequests] = useState<SupplyRequest[]>([]);
  const [stats, setStats] = useState<SupplyRequestStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [filters, setFilters] = useState<SupplyRequestFilters>({ page: 1, limit: 20 });
  const [pagination, setPagination] = useState({ total: 0, pages: 0 });
  const [searchTerm, setSearchTerm] = useState('');
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Modal states
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<SupplyRequest | null>(null);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [approvalData, setApprovalData] = useState({
    action: '' as 'approve' | 'reject',
    notes: '',
    rejectedReason: '',
  });

  const fetchRequests = useCallback(async () => {
    if (!selectedPropertyId) return;
    try {
      setLoading(true);
      const response = await adminSupplyRequestsService.getRequests({
        ...filters,
        hotelId: selectedPropertyId,
      });
      setRequests(response.data.requests || []);
      setPagination({
        total: response.data.pagination?.total || 0,
        pages: response.data.pagination?.pages || 1,
      });
    } catch {
      toast.error('Failed to load supply requests');
    } finally {
      setLoading(false);
    }
  }, [filters, selectedPropertyId]);

  const fetchStats = useCallback(async () => {
    if (!selectedPropertyId) return;
    try {
      setStatsLoading(true);
      const response = await adminSupplyRequestsService.getStats({
        hotelId: selectedPropertyId,
      });
      setStats(response.data);
    } catch {
      // Stats are non-critical
    } finally {
      setStatsLoading(false);
    }
  }, [selectedPropertyId]);

  useEffect(() => {
    if (selectedPropertyId) {
      fetchRequests();
      fetchStats();
    }
    return () => {
      if (debounceTimeoutRef.current) clearTimeout(debounceTimeoutRef.current);
    };
  }, [fetchRequests, fetchStats, selectedPropertyId]);

  // Real-time WebSocket listeners for supply request events
  useEffect(() => {
    const handleSupplyEvent = () => {
      fetchRequests();
      fetchStats();
    };
    on('supply-requests:created', handleSupplyEvent);
    on('supply-requests:updated', handleSupplyEvent);
    on('supply-requests:status_changed', handleSupplyEvent);
    return () => {
      off('supply-requests:created', handleSupplyEvent);
      off('supply-requests:updated', handleSupplyEvent);
      off('supply-requests:status_changed', handleSupplyEvent);
    };
  }, [on, off, fetchRequests, fetchStats]);

  const debouncedSearch = useCallback((term: string) => {
    if (debounceTimeoutRef.current) clearTimeout(debounceTimeoutRef.current);
    debounceTimeoutRef.current = setTimeout(() => setSearchTerm(term), 300);
  }, []);

  const displayedRequests = searchTerm.trim()
    ? requests.filter((request) => {
        const lower = searchTerm.toLowerCase();
        return (
          (request.title || '').toLowerCase().includes(lower) ||
          (request.requestNumber || '').toLowerCase().includes(lower) ||
          (request.requestedBy?.name || '').toLowerCase().includes(lower) ||
          (request.department || '').toLowerCase().includes(lower) ||
          (request.description || '').toLowerCase().includes(lower)
        );
      })
    : requests;

  const isOverdue = (request: SupplyRequest) => {
    return (
      new Date(request.neededBy) < new Date() &&
      !['received', 'cancelled'].includes(request.status)
    );
  };

  const handleApprovalAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRequest) return;
    try {
      setUpdating(true);
      if (approvalData.action === 'approve') {
        await adminSupplyRequestsService.approveRequest(
          selectedRequest._id,
          approvalData.notes
        );
        toast.success('Request approved');
      } else {
        await adminSupplyRequestsService.rejectRequest(
          selectedRequest._id,
          approvalData.rejectedReason,
          approvalData.notes
        );
        toast.success('Request rejected');
      }
      await fetchRequests();
      await fetchStats();
      setShowApprovalModal(false);
      setApprovalData({ action: '' as 'approve' | 'reject', notes: '', rejectedReason: '' });
    } catch {
      toast.error(`Failed to ${approvalData.action} request`);
    } finally {
      setUpdating(false);
    }
  };

  const handleViewRequest = (request: SupplyRequest) => {
    setSelectedRequest(request);
    setShowViewModal(true);
  };

  const openApprovalModal = (request: SupplyRequest, action: 'approve' | 'reject') => {
    setSelectedRequest(request);
    setApprovalData({ action, notes: '', rejectedReason: '' });
    setShowApprovalModal(true);
  };

  const exportToCSV = useCallback(() => {
    const headers = [
      'Request #',
      'Title',
      'Department',
      'Requested By',
      'Priority',
      'Status',
      'Items Count',
      'Estimated Cost',
      'Needed By',
      'Created Date',
    ];
    const csvData = requests.map((r) => [
      r.requestNumber || '',
      r.title || '',
      DEPARTMENT_LABELS[r.department] || r.department || '',
      r.requestedBy?.name || '',
      r.priority || '',
      STATUS_LABELS[r.status] || r.status || '',
      String(r.items?.length || 0),
      String(r.totalEstimatedCost || 0),
      safeFormatDate(r.neededBy, 'yyyy-MM-dd'),
      safeFormatDate(r.createdAt, 'yyyy-MM-dd HH:mm'),
    ]);
    const csvContent = [headers, ...csvData]
      .map((row) =>
        row.map((field) => `"${field.toString().replace(/"/g, '""')}"`).join(',')
      )
      .join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.setAttribute('href', URL.createObjectURL(blob));
    link.setAttribute(
      'download',
      `supply-requests-${format(new Date(), 'yyyy-MM-dd')}.csv`
    );
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Exported to CSV');
  }, [requests]);

  if (!selectedPropertyId && viewMode === 'single') {
    return (
      <div className="p-6">
        <PropertyBreadcrumb items={['Supply', 'Requests']} />
        <div className="text-center py-12">
          <p className="text-gray-600">Please select a property to view supply requests</p>
        </div>
      </div>
    );
  }

  if (loading && !requests.length) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <ErrorBoundary level="page">
      <div className="space-y-6 p-6">
        <PropertyBreadcrumb items={['Supply', 'Requests']} />

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
              Supply Request Management
            </h1>
            <p className="text-gray-600 mt-1 text-sm">
              Review, approve, and track departmental supply requests
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={exportToCSV}
              size="sm"
              variant="outline"
              disabled={displayedRequests.length === 0}
            >
              <Download className="w-4 h-4 mr-1" /> Export
            </Button>
            <Button
              onClick={() => {
                fetchRequests();
                fetchStats();
              }}
              size="sm"
              disabled={loading}
            >
              <RefreshCw className={`w-4 h-4 mr-1 ${loading ? 'animate-spin' : ''}`} />{' '}
              Refresh
            </Button>
          </div>
        </div>

        {/* Stats cards */}
        {stats && !statsLoading && (
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            <Card>
              <CardContent className="p-4 flex items-center">
                <div className="p-2 bg-blue-100 rounded-lg mr-3">
                  <TrendingUp className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-600">Total</p>
                  <p className="text-xl font-bold">{stats.total}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex items-center">
                <div className="p-2 bg-yellow-100 rounded-lg mr-3">
                  <Clock className="h-5 w-5 text-yellow-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-600">Pending</p>
                  <p className="text-xl font-bold text-yellow-700">{stats.pending}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex items-center">
                <div className="p-2 bg-green-100 rounded-lg mr-3">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-600">Approved</p>
                  <p className="text-xl font-bold text-green-700">{stats.approved}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex items-center">
                <div className="p-2 bg-red-100 rounded-lg mr-3">
                  <AlertTriangle className="h-5 w-5 text-red-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-600">Overdue</p>
                  <p className="text-xl font-bold text-red-700">{stats.overdue}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex items-center">
                <div className="p-2 bg-purple-100 rounded-lg mr-3">
                  <DollarSign className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-600">Total Value</p>
                  <p className="text-xl font-bold">{formatCurrency(stats.totalValue)}</p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center mb-4">
              <Filter className="h-5 w-5 text-gray-500 mr-2" />
              <h2 className="font-semibold text-gray-800">Filters</h2>
            </div>

            <div className="mb-4 relative">
              <input
                type="text"
                placeholder="Search by request #, title, requester, or department..."
                className="w-full border rounded-lg px-4 py-2 pl-10 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-200"
                onChange={(e) => debouncedSearch(e.target.value)}
              />
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Status
                </label>
                <select
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                  value={filters.status || ''}
                  onChange={(e) =>
                    setFilters({ ...filters, status: e.target.value || undefined, page: 1 })
                  }
                >
                  <option value="">All Statuses</option>
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                  <option value="ordered">Ordered</option>
                  <option value="partial_received">Partially Received</option>
                  <option value="received">Received</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Department
                </label>
                <select
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                  value={filters.department || ''}
                  onChange={(e) =>
                    setFilters({
                      ...filters,
                      department: e.target.value || undefined,
                      page: 1,
                    })
                  }
                >
                  <option value="">All Departments</option>
                  {Object.entries(DEPARTMENT_LABELS).map(([val, label]) => (
                    <option key={val} value={val}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Priority
                </label>
                <select
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                  value={filters.priority || ''}
                  onChange={(e) =>
                    setFilters({
                      ...filters,
                      priority: e.target.value || undefined,
                      page: 1,
                    })
                  }
                >
                  <option value="">All Priorities</option>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                  <option value="emergency">Emergency</option>
                </select>
              </div>
              <div className="flex items-end">
                <Button
                  onClick={() => setFilters({ page: 1, limit: 20 })}
                  variant="outline"
                  size="sm"
                  className="w-full"
                >
                  <RefreshCw className="h-4 w-4 mr-1" /> Reset
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Request cards */}
        <div className="space-y-4">
          {displayedRequests.length === 0 && !loading ? (
            <Card>
              <CardContent className="p-12 text-center">
                <ShoppingCart className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  No Supply Requests Found
                </h3>
                <p className="text-gray-500">No requests match the current filters.</p>
              </CardContent>
            </Card>
          ) : (
            displayedRequests.map((request) => (
              <Card
                key={request._id}
                className={`border-l-4 ${
                  isOverdue(request)
                    ? 'border-red-500'
                    : request.priority === 'urgent' || request.priority === 'emergency'
                    ? 'border-orange-500'
                    : request.priority === 'high'
                    ? 'border-yellow-500'
                    : 'border-gray-300'
                }`}
              >
                <CardContent className="p-5">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2 flex-wrap">
                        <Package className="h-5 w-5 text-blue-600 flex-shrink-0" />
                        <h3 className="font-semibold text-gray-900">{request.title}</h3>
                        <span className="text-xs text-gray-500">
                          #{request.requestNumber}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                            STATUS_COLORS[request.status] || 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {STATUS_LABELS[request.status] || request.status}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                            PRIORITY_COLORS[request.priority] || 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {(request.priority === 'urgent' ||
                            request.priority === 'emergency') && (
                            <Zap className="inline h-3 w-3 mr-0.5" />
                          )}
                          {request.priority}
                        </span>
                        {isOverdue(request) && (
                          <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-red-200 text-red-900">
                            OVERDUE
                          </span>
                        )}
                      </div>
                      {request.description && (
                        <p className="text-sm text-gray-600 mb-2 line-clamp-2">
                          {request.description}
                        </p>
                      )}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs text-gray-500">
                        <div>
                          <span className="font-medium text-gray-700">By:</span>{' '}
                          {request.requestedBy?.name || 'Unknown'}
                        </div>
                        <div>
                          <span className="font-medium text-gray-700">Dept:</span>{' '}
                          {DEPARTMENT_LABELS[request.department] || request.department}
                        </div>
                        <div>
                          <span className="font-medium text-gray-700">Items:</span>{' '}
                          {request.items?.length || 0} item
                          {(request.items?.length || 0) !== 1 ? 's' : ''}
                        </div>
                        <div>
                          <span className="font-medium text-gray-700">Cost:</span>{' '}
                          {formatCurrency(
                            request.totalActualCost > 0
                              ? request.totalActualCost
                              : request.totalEstimatedCost
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                        <div>
                          <Clock className="inline h-3 w-3 mr-1" />
                          Created: {safeFormatDate(request.createdAt, 'MMM dd, HH:mm')}
                        </div>
                        <div
                          className={
                            isOverdue(request) ? 'text-red-600 font-medium' : ''
                          }
                        >
                          <Truck className="inline h-3 w-3 mr-1" />
                          Needed: {safeFormatDate(request.neededBy, 'MMM dd, yyyy')}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 ml-4 flex-shrink-0">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleViewRequest(request)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      {request.status === 'pending' && (
                        <>
                          <Button
                            size="sm"
                            className="bg-green-600 hover:bg-green-700 text-white"
                            onClick={() => openApprovalModal(request, 'approve')}
                            disabled={updating}
                          >
                            <CheckSquare className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            className="bg-red-600 hover:bg-red-700 text-white"
                            onClick={() => openApprovalModal(request, 'reject')}
                            disabled={updating}
                          >
                            <XCircle className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* Pagination */}
        {!searchTerm.trim() && pagination.pages > 1 && (
          <div className="flex items-center justify-between pt-4">
            <span className="text-sm text-gray-600">
              Page {filters.page || 1} of {pagination.pages} ({pagination.total} results)
            </span>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={(filters.page || 1) <= 1}
                onClick={() =>
                  setFilters({ ...filters, page: (filters.page || 1) - 1 })
                }
              >
                Previous
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={(filters.page || 1) >= pagination.pages}
                onClick={() =>
                  setFilters({ ...filters, page: (filters.page || 1) + 1 })
                }
              >
                Next
              </Button>
            </div>
          </div>
        )}

        {/* View Request Modal */}
        {selectedRequest && (
          <Modal
            isOpen={showViewModal}
            onClose={() => setShowViewModal(false)}
            title="Supply Request Details"
          >
            <div className="space-y-4">
              {/* Header */}
              <div className="flex items-start justify-between">
                <div className="flex items-start space-x-3">
                  <div className="p-2 rounded-lg bg-blue-100">
                    <Package className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold">{selectedRequest.title}</h3>
                    <p className="text-sm text-gray-500">
                      #{selectedRequest.requestNumber}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      STATUS_COLORS[selectedRequest.status] ||
                      'bg-gray-100 text-gray-800'
                    }`}
                  >
                    {STATUS_LABELS[selectedRequest.status] || selectedRequest.status}
                  </span>
                  {isOverdue(selectedRequest) && (
                    <div className="text-xs text-red-600 font-bold mt-1">OVERDUE</div>
                  )}
                </div>
              </div>

              {selectedRequest.description && (
                <p className="text-gray-600 text-sm">{selectedRequest.description}</p>
              )}

              {/* Request Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">
                    Requested By
                  </label>
                  <div className="mt-1 font-medium">
                    {selectedRequest.requestedBy?.name || 'Unknown'}
                  </div>
                  <div className="text-sm text-gray-500">
                    {selectedRequest.requestedBy?.email || ''}
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Department</label>
                  <div className="mt-1 font-medium">
                    {DEPARTMENT_LABELS[selectedRequest.department] ||
                      selectedRequest.department}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">Priority</label>
                  <div className="mt-1">
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        PRIORITY_COLORS[selectedRequest.priority] ||
                        'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {selectedRequest.priority}
                    </span>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Needed By</label>
                  <div
                    className={`mt-1 font-medium ${
                      isOverdue(selectedRequest) ? 'text-red-600' : ''
                    }`}
                  >
                    {safeFormatDate(selectedRequest.neededBy, 'MMM dd, yyyy')}
                  </div>
                </div>
              </div>

              {/* Items */}
              {selectedRequest.items && selectedRequest.items.length > 0 && (
                <div>
                  <label className="text-sm font-medium text-gray-500 mb-2 block">
                    Requested Items ({selectedRequest.items.length})
                  </label>
                  <div className="bg-gray-50 p-3 rounded-md space-y-2">
                    {selectedRequest.items.map((item, idx) => (
                      <div
                        key={`item-${idx}-${item.name}`}
                        className="flex justify-between items-start p-2 bg-white rounded border"
                      >
                        <div className="flex-1">
                          <div className="font-medium text-sm">{item.name}</div>
                          {item.description && (
                            <div className="text-xs text-gray-500">
                              {item.description}
                            </div>
                          )}
                          <div className="text-xs text-gray-500 mt-1">
                            {item.quantity} {item.unit}
                            {item.category && ` | ${item.category}`}
                            {item.supplier && ` | ${item.supplier}`}
                          </div>
                        </div>
                        <div className="text-right ml-3">
                          <div className="font-medium text-sm">
                            {formatCurrency(
                              item.actualCost || item.estimatedCost
                            )}
                          </div>
                          {item.isReceived && (
                            <div className="text-xs text-green-600 font-medium">
                              Received {item.receivedQuantity}/{item.quantity}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                    <div className="border-t pt-2 mt-2 flex justify-between font-semibold text-sm">
                      <span>Total Cost:</span>
                      <span>
                        {formatCurrency(
                          selectedRequest.totalActualCost > 0
                            ? selectedRequest.totalActualCost
                            : selectedRequest.totalEstimatedCost
                        )}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Approval Info */}
              {selectedRequest.approvedBy && (
                <div>
                  <label className="text-sm font-medium text-gray-500">
                    Approval Details
                  </label>
                  <div className="mt-1 bg-blue-50 p-3 rounded-md text-sm">
                    <div className="font-medium">
                      {selectedRequest.status === 'rejected'
                        ? 'Rejected'
                        : 'Approved'}{' '}
                      by {selectedRequest.approvedBy.name}
                    </div>
                    {selectedRequest.approvedAt && (
                      <div className="text-gray-600">
                        {safeFormatDate(
                          selectedRequest.approvedAt,
                          'MMM dd, yyyy HH:mm'
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Rejection reason */}
              {selectedRequest.status === 'rejected' &&
                selectedRequest.rejectedReason && (
                  <div>
                    <label className="text-sm font-medium text-gray-500">
                      Rejection Reason
                    </label>
                    <div className="mt-1 bg-red-50 p-3 rounded-md text-sm text-red-800">
                      {selectedRequest.rejectedReason}
                    </div>
                  </div>
                )}

              {/* Purchase Order */}
              {selectedRequest.purchaseOrder?.number && (
                <div>
                  <label className="text-sm font-medium text-gray-500">
                    Purchase Order
                  </label>
                  <div className="mt-1 bg-purple-50 p-3 rounded-md text-sm">
                    <div className="font-medium">
                      PO #{selectedRequest.purchaseOrder.number}
                    </div>
                    {selectedRequest.purchaseOrder.date && (
                      <div className="text-gray-600">
                        Date:{' '}
                        {safeFormatDate(
                          selectedRequest.purchaseOrder.date,
                          'MMM dd, yyyy'
                        )}
                      </div>
                    )}
                    {selectedRequest.purchaseOrder.totalAmount !== undefined && (
                      <div className="text-gray-600">
                        Amount:{' '}
                        {formatCurrency(selectedRequest.purchaseOrder.totalAmount)}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Supplier */}
              {selectedRequest.supplier?.name && (
                <div>
                  <label className="text-sm font-medium text-gray-500">Supplier</label>
                  <div className="mt-1 bg-gray-50 p-3 rounded-md text-sm">
                    <div className="font-medium">{selectedRequest.supplier.name}</div>
                    {selectedRequest.supplier.contact && (
                      <div className="text-gray-500">
                        {selectedRequest.supplier.contact}
                      </div>
                    )}
                    {selectedRequest.supplier.email && (
                      <div className="text-gray-500">
                        {selectedRequest.supplier.email}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Notes */}
              {selectedRequest.notes && (
                <div>
                  <label className="text-sm font-medium text-gray-500">Notes</label>
                  <div className="mt-1 bg-gray-50 p-3 rounded-md text-sm">
                    {selectedRequest.notes}
                  </div>
                </div>
              )}

              {/* Justification */}
              {selectedRequest.justification && (
                <div>
                  <label className="text-sm font-medium text-gray-500">
                    Justification
                  </label>
                  <div className="mt-1 bg-gray-50 p-3 rounded-md text-sm">
                    {selectedRequest.justification}
                  </div>
                </div>
              )}

              {/* Dates */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <label className="text-sm font-medium text-gray-500">Created</label>
                  <div className="mt-1">
                    {safeFormatDate(selectedRequest.createdAt, 'MMM dd, yyyy HH:mm')}
                  </div>
                </div>
                {selectedRequest.orderedDate && (
                  <div>
                    <label className="text-sm font-medium text-gray-500">Ordered</label>
                    <div className="mt-1">
                      {safeFormatDate(selectedRequest.orderedDate, 'MMM dd, yyyy')}
                    </div>
                  </div>
                )}
                {selectedRequest.expectedDelivery && (
                  <div>
                    <label className="text-sm font-medium text-gray-500">
                      Expected Delivery
                    </label>
                    <div className="mt-1">
                      {safeFormatDate(
                        selectedRequest.expectedDelivery,
                        'MMM dd, yyyy'
                      )}
                    </div>
                  </div>
                )}
                {selectedRequest.actualDelivery && (
                  <div>
                    <label className="text-sm font-medium text-gray-500">
                      Actual Delivery
                    </label>
                    <div className="mt-1">
                      {safeFormatDate(
                        selectedRequest.actualDelivery,
                        'MMM dd, yyyy'
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t mt-4">
              <Button variant="outline" onClick={() => setShowViewModal(false)}>
                Close
              </Button>
              {selectedRequest.status === 'pending' && (
                <>
                  <Button
                    className="bg-red-600 hover:bg-red-700 text-white"
                    onClick={() => {
                      setShowViewModal(false);
                      openApprovalModal(selectedRequest, 'reject');
                    }}
                  >
                    <XCircle className="h-4 w-4 mr-1" /> Reject
                  </Button>
                  <Button
                    className="bg-green-600 hover:bg-green-700 text-white"
                    onClick={() => {
                      setShowViewModal(false);
                      openApprovalModal(selectedRequest, 'approve');
                    }}
                  >
                    <CheckSquare className="h-4 w-4 mr-1" /> Approve
                  </Button>
                </>
              )}
            </div>
          </Modal>
        )}

        {/* Approval Modal */}
        {showApprovalModal && selectedRequest && (
          <Modal
            isOpen={showApprovalModal}
            onClose={() => setShowApprovalModal(false)}
            title={`${
              approvalData.action === 'approve' ? 'Approve' : 'Reject'
            } Supply Request`}
          >
            <form onSubmit={handleApprovalAction} className="space-y-4">
              <div className="bg-gray-50 p-4 rounded-md">
                <div className="text-sm">
                  <div className="font-medium">
                    Request: #{selectedRequest.requestNumber}
                  </div>
                  <div className="text-gray-600">{selectedRequest.title}</div>
                  <div className="font-medium mt-2">
                    Total Cost:{' '}
                    {formatCurrency(selectedRequest.totalEstimatedCost)}
                  </div>
                  <div className="text-gray-500 mt-1">
                    By: {selectedRequest.requestedBy?.name || 'Unknown'} |{' '}
                    {DEPARTMENT_LABELS[selectedRequest.department] ||
                      selectedRequest.department}
                  </div>
                </div>
              </div>

              {approvalData.action === 'reject' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Rejection Reason *
                  </label>
                  <textarea
                    className="w-full border rounded-lg px-3 py-2 text-sm h-24 resize-none"
                    required
                    value={approvalData.rejectedReason}
                    onChange={(e) =>
                      setApprovalData({
                        ...approvalData,
                        rejectedReason: e.target.value,
                      })
                    }
                    placeholder="Please provide a reason for rejection..."
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Additional Notes
                </label>
                <textarea
                  className="w-full border rounded-lg px-3 py-2 text-sm h-20 resize-none"
                  value={approvalData.notes}
                  onChange={(e) =>
                    setApprovalData({ ...approvalData, notes: e.target.value })
                  }
                  placeholder="Optional notes..."
                />
              </div>

              <div className="flex justify-end gap-3 pt-2 border-t">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowApprovalModal(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={updating}
                  className={
                    approvalData.action === 'approve'
                      ? 'bg-green-600 hover:bg-green-700 text-white'
                      : 'bg-red-600 hover:bg-red-700 text-white'
                  }
                >
                  {updating ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-1 animate-spin" /> Processing...
                    </>
                  ) : approvalData.action === 'approve' ? (
                    <>
                      <CheckSquare className="h-4 w-4 mr-1" /> Approve Request
                    </>
                  ) : (
                    <>
                      <XCircle className="h-4 w-4 mr-1" /> Reject Request
                    </>
                  )}
                </Button>
              </div>
            </form>
          </Modal>
        )}
      </div>
    </ErrorBoundary>
  );
}
