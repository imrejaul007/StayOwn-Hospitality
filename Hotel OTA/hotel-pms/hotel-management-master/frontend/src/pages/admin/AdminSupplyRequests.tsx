import React, { useState, useEffect } from 'react';
import { format, parseISO } from 'date-fns';
import {
  Package,
  Clock,
  CheckCircle,
  AlertTriangle,
  Filter,
  Eye,
  IndianRupee,
  RefreshCw,
  CheckSquare,
  XCircle,
  FileText
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/Modal';
import { DataTable } from '../../components/dashboard/DataTable';
import { StatusBadge } from '../../components/dashboard/StatusBadge';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import ErrorBoundary from '../../components/ErrorBoundary';
import { formatNumber } from '../../utils/dashboardUtils';
import { formatCurrency } from '../../utils/formatters';
import toast from 'react-hot-toast';
import { adminSupplyRequestsService, SupplyRequest, SupplyRequestStats, SupplyRequestFilters } from '../../services/adminSupplyRequestsService';
import { useRealTime } from '../../services/realTimeService';
import { useProperty } from '../../context/PropertyContext';
import { PropertyBreadcrumb } from '../../components/common/PropertyBreadcrumb';


export default function AdminSupplyRequests() {
  const { selectedPropertyId } = useProperty();
  const [requests, setRequests] = useState<SupplyRequest[]>([]);
  const [stats, setStats] = useState<SupplyRequestStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [filters, setFilters] = useState<SupplyRequestFilters>({ page: 1, limit: 20 });
  const [pagination, setPagination] = useState({ total: 0, pages: 0 });
  
  // Real-time connection
  const { connectionState, connect, disconnect, on, off } = useRealTime();
  
  // Modal states
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<SupplyRequest | null>(null);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [approvalData, setApprovalData] = useState({
    action: '' as 'approve' | 'reject',
    notes: '',
    rejectedReason: ''
  });

  const fetchRequests = async () => {
    try {
      setLoading(true);
      const response = await adminSupplyRequestsService.getRequests({
        ...filters,
        hotelId: selectedPropertyId || undefined
      });
      setRequests(response.data.requests || []);
      setPagination({
        total: response.data.pagination?.total || 0,
        pages: response.data.pagination?.pages || 1
      });
    } catch (error) {
      toast.error('Failed to load supply requests');
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await adminSupplyRequestsService.getStats({
        hotelId: selectedPropertyId || undefined
      });
      setStats(response.data);
    } catch (error) {
      toast.error('Failed to load supply request statistics');
    }
  };

  useEffect(() => {
    if (selectedPropertyId) {
      fetchRequests();
      fetchStats();

      // Connect to real-time updates
      // Do NOT disconnect on unmount — realTimeService is a singleton shared across components
      connect().catch(() => { /* Error handled silently */ });
    }
  }, [selectedPropertyId, filters]);
  
  // Set up real-time event listeners
  // Note: `isConnected` from useRealTime is a snapshot captured once at hook init;
  // use the reactive `connectionState` instead so listeners attach when the socket connects.
  const isSocketConnected = connectionState === 'connected';
  useEffect(() => {
    if (!isSocketConnected) return;

    const handleSupplyRequestUpdate = (_data: Record<string, unknown>) => {
      fetchRequests();
      fetchStats();
      toast.success('Supply request data updated in real-time');
    };

    const handleSupplyRequestCreate = (_data: Record<string, unknown>) => {
      fetchRequests();
      fetchStats();
      toast.success('New supply request created');
    };

    // Subscribe to supply request events
    on('supply-requests:created', handleSupplyRequestCreate);
    on('supply-requests:updated', handleSupplyRequestUpdate);
    on('supply-requests:status_changed', handleSupplyRequestUpdate);

    return () => {
      off('supply-requests:created', handleSupplyRequestCreate);
      off('supply-requests:updated', handleSupplyRequestUpdate);
      off('supply-requests:status_changed', handleSupplyRequestUpdate);
    };
  }, [isSocketConnected, on, off]);

  // Handle approval/rejection
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
      } else {
        await adminSupplyRequestsService.rejectRequest(
          selectedRequest._id, 
          approvalData.rejectedReason, 
          approvalData.notes
        );
      }
      
      await fetchRequests();
      await fetchStats();
      setShowApprovalModal(false);
      setApprovalData({ action: '' as 'approve' | 'reject', notes: '', rejectedReason: '' });
      toast.success(`Request ${approvalData.action}d successfully`);
    } catch (error) {
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

  const getDepartmentColor = (department: string) => {
    const colors: Record<string, string> = {
      housekeeping: 'bg-green-100 text-green-800',
      maintenance: 'bg-orange-100 text-orange-800',
      front_desk: 'bg-blue-100 text-blue-800',
      food_beverage: 'bg-purple-100 text-purple-800',
      spa: 'bg-pink-100 text-pink-800',
      other: 'bg-gray-100 text-gray-800'
    };
    return colors[department] || 'bg-gray-100 text-gray-800';
  };

  const getPriorityColor = (priority: string) => {
    const colors: Record<string, string> = {
      low: 'bg-gray-100 text-gray-800',
      medium: 'bg-yellow-100 text-yellow-800',
      high: 'bg-orange-100 text-orange-800',
      urgent: 'bg-red-100 text-red-800',
      emergency: 'bg-red-200 text-red-900'
    };
    return colors[priority] || 'bg-gray-100 text-gray-800';
  };

  const isOverdue = (request: SupplyRequest) => {
    return new Date(request.neededBy) < new Date() && 
           !['received', 'cancelled'].includes(request.status);
  };

  const columns = [
    {
      key: 'requestNumber',
      header: 'Request',
      render: (value: unknown, request: SupplyRequest) => (
        <div>
          <div className="font-medium text-gray-900">{request.requestNumber}</div>
          <div className="text-sm text-gray-500">{request.title}</div>
          {isOverdue(request) && (
            <div className="text-xs text-red-600 font-medium">OVERDUE</div>
          )}
        </div>
      )
    },
    {
      key: 'requestedBy',
      header: 'Requested By',
      render: (value: unknown, request: SupplyRequest) => (
        <div className="text-sm">
          <div className="font-medium">{request.requestedBy?.name ?? 'Unknown'}</div>
          <div className="text-gray-500">{request.requestedBy?.email ?? ''}</div>
        </div>
      )
    },
    {
      key: 'department',
      header: 'Department',
      render: (value: unknown, request: SupplyRequest) => (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getDepartmentColor(request.department)}`}>
          {request.department.replace(/_/g, ' ')}
        </span>
      )
    },
    {
      key: 'priority',
      header: 'Priority',
      render: (value: unknown, request: SupplyRequest) => (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getPriorityColor(request.priority)}`}>
          {request.priority}
        </span>
      )
    },
    {
      key: 'status',
      header: 'Status',
      render: (value: unknown, request: SupplyRequest) => (
        <StatusBadge status={request.status} />
      )
    },
    {
      key: 'totalEstimatedCost',
      header: 'Cost',
      render: (value: unknown, request: SupplyRequest) => (
        <div className="text-sm">
          {request.totalActualCost > 0 ? (
            <div>
              <div className="font-medium">{formatCurrency(request.totalActualCost)}</div>
              {request.totalActualCost !== request.totalEstimatedCost && (
                <div className="text-gray-500">Est: {formatCurrency(request.totalEstimatedCost)}</div>
              )}
            </div>
          ) : (
            <div className="text-gray-600">{formatCurrency(request.totalEstimatedCost)}</div>
          )}
        </div>
      )
    },
    {
      key: 'neededBy',
      header: 'Needed By',
      render: (value: unknown, request: SupplyRequest) => (
        <div className={`text-sm ${isOverdue(request) ? 'text-red-600 font-medium' : 'text-gray-600'}`}>
          {format(parseISO(request.neededBy), 'MMM dd, yyyy')}
        </div>
      )
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (value: unknown, request: SupplyRequest) => (
        <div className="flex items-center space-x-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => handleViewRequest(request)}
          >
            <Eye className="h-4 w-4" />
          </Button>
          {request.status === 'pending' && (
            <>
              <Button
                size="sm"
                onClick={() => openApprovalModal(request, 'approve')}
                disabled={updating}
                className="bg-green-600 hover:bg-green-700"
              >
                <CheckSquare className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                onClick={() => openApprovalModal(request, 'reject')}
                disabled={updating}
                className="bg-red-600 hover:bg-red-700"
              >
                <XCircle className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>
      ),
      align: 'center' as const
    }
  ];

  // Property validation
  if (!selectedPropertyId) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">🏨</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">No Property Selected</h2>
          <p className="text-gray-600">Please select a property from the header to view supply requests.</p>
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
    <ErrorBoundary level="page" onError={(error, errorInfo) => {
      toast.error('An error occurred in the supply requests management page');
    }}>
    <div className="space-y-6">
      {/* Property Breadcrumb */}
      <PropertyBreadcrumb items={['Supply Requests']} />

      {/* Modern Header */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-gradient-to-br from-orange-500 to-red-600 rounded-xl shadow-md">
              <Package className="h-6 w-6 text-white" />
            </div>
        <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
                Supply Requests Management
              </h1>
              <p className="text-gray-600 mt-1 text-sm sm:text-base">
                Review and approve supply requests from staff
              </p>
        </div>
          </div>
          
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            {/* Real-time connection status */}
            <div className={`flex items-center justify-center px-3 py-2 rounded-full text-xs font-medium ${
              connectionState === 'connected' 
                ? 'bg-green-100 text-green-800 border border-green-200' 
                : connectionState === 'connecting' 
                ? 'bg-yellow-100 text-yellow-800 border border-yellow-200' 
                : 'bg-red-100 text-red-800 border border-red-200'
            }`}>
              <div className={`w-2 h-2 rounded-full mr-2 ${
                connectionState === 'connected' ? 'bg-green-500 animate-pulse' : 
                connectionState === 'connecting' ? 'bg-yellow-500' : 'bg-red-500'
              }`}></div>
              {connectionState === 'connected' ? 'Live Connected' : connectionState === 'connecting' ? 'Connecting...' : 'Disconnected'}
            </div>
            
            <Button 
              onClick={fetchRequests} 
              size="sm" 
              disabled={loading}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          </div>
        </div>
      </div>

      {/* Modern Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4 lg:gap-6">
          <Card className="bg-gradient-to-br from-white to-blue-50 border-0 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
            <CardContent className="p-3 sm:p-4 lg:p-6">
              <div className="flex items-center">
                <div className="p-2 sm:p-3 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-md">
                  <FileText className="h-4 w-4 sm:h-5 sm:w-5 lg:h-6 lg:w-6 text-white" />
                </div>
                <div className="ml-2 sm:ml-3 lg:ml-4">
                  <p className="text-xs sm:text-sm font-semibold text-gray-600">Total Requests</p>
                  <p className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900">{stats.total}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-white to-yellow-50 border-0 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
            <CardContent className="p-3 sm:p-4 lg:p-6">
              <div className="flex items-center">
                <div className="p-2 sm:p-3 bg-gradient-to-br from-yellow-500 to-orange-500 rounded-xl shadow-md">
                  <Clock className="h-4 w-4 sm:h-5 sm:w-5 lg:h-6 lg:w-6 text-white" />
                </div>
                <div className="ml-2 sm:ml-3 lg:ml-4">
                  <p className="text-xs sm:text-sm font-semibold text-gray-600">Pending</p>
                  <p className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900">{stats.pending}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-white to-green-50 border-0 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
            <CardContent className="p-3 sm:p-4 lg:p-6">
              <div className="flex items-center">
                <div className="p-2 sm:p-3 bg-gradient-to-br from-green-500 to-emerald-500 rounded-xl shadow-md">
                  <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5 lg:h-6 lg:w-6 text-white" />
                </div>
                <div className="ml-2 sm:ml-3 lg:ml-4">
                  <p className="text-xs sm:text-sm font-semibold text-gray-600">Approved</p>
                  <p className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900">{stats.approved}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-white to-red-50 border-0 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 border-l-4 border-red-500">
            <CardContent className="p-3 sm:p-4 lg:p-6">
              <div className="flex items-center">
                <div className="p-2 sm:p-3 bg-gradient-to-br from-red-500 to-red-600 rounded-xl shadow-md">
                  <AlertTriangle className="h-4 w-4 sm:h-5 sm:w-5 lg:h-6 lg:w-6 text-white" />
                </div>
                <div className="ml-2 sm:ml-3 lg:ml-4">
                  <p className="text-xs sm:text-sm font-semibold text-gray-600">Overdue</p>
                  <p className="text-lg sm:text-xl lg:text-2xl font-bold text-red-600">{stats.overdue}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-white to-purple-50 border-0 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
            <CardContent className="p-3 sm:p-4 lg:p-6">
              <div className="flex items-center">
                <div className="p-2 sm:p-3 bg-gradient-to-br from-purple-500 to-indigo-500 rounded-xl shadow-md">
                  <IndianRupee className="h-4 w-4 sm:h-5 sm:w-5 lg:h-6 lg:w-6 text-white" />
                </div>
                <div className="ml-2 sm:ml-3 lg:ml-4">
                  <p className="text-xs sm:text-sm font-semibold text-gray-600">Total Value</p>
                  <p className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900">{formatNumber(stats.totalValue)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Modern Filters */}
      <Card className="bg-white rounded-xl shadow-lg border border-gray-200 p-4 sm:p-6">
        <div className="flex items-center mb-4">
          <div className="p-2 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg shadow-md">
            <Filter className="h-4 w-4 text-white" />
          </div>
          <h3 className="text-lg font-bold text-gray-900 ml-3">Filter Supply Requests</h3>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Status</label>
              <select
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                value={filters.status || ''}
                onChange={(e) => setFilters({ ...filters, status: e.target.value || undefined, page: 1 })}
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
            <label className="block text-sm font-semibold text-gray-700 mb-2">Department</label>
              <select
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                value={filters.department || ''}
                onChange={(e) => setFilters({ ...filters, department: e.target.value || undefined, page: 1 })}
              >
                <option value="">All Departments</option>
                <option value="housekeeping">Housekeeping</option>
                <option value="maintenance">Maintenance</option>
                <option value="front_desk">Front Desk</option>
                <option value="food_beverage">Food & Beverage</option>
                <option value="spa">Spa</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Priority</label>
              <select
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                value={filters.priority || ''}
                onChange={(e) => setFilters({ ...filters, priority: e.target.value || undefined, page: 1 })}
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
                variant="secondary"
                onClick={() => setFilters({ page: 1, limit: 20 })}
                className="w-full"
              >
                Reset Filters
              </Button>
            </div>
        </div>
      </Card>

      {/* Requests Table */}
      <Card>
        <CardHeader>
          <CardTitle>Supply Requests ({pagination.total})</CardTitle>
        </CardHeader>
        <CardContent>
          <ErrorBoundary level="component" fallback={
            <div className="p-4 text-center text-gray-500">
              Failed to load supply requests table
            </div>
          }>
            <DataTable
              data={requests}
              columns={columns}
              loading={loading}
              emptyMessage="No supply requests found. Adjust your filters or check back later."
            />
          </ErrorBoundary>
        </CardContent>
        
        {/* Pagination */}
        {pagination.pages > 1 && (
          <div className="px-6 py-4 border-t border-gray-200">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-700">
                Showing {((filters.page || 1) - 1) * (filters.limit || 20) + 1} to{' '}
                {Math.min((filters.page || 1) * (filters.limit || 20), pagination.total)} of{' '}
                {pagination.total} results
              </div>
              <div className="flex items-center space-x-2">
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={(filters.page || 1) <= 1}
                  onClick={() => setFilters({ ...filters, page: (filters.page || 1) - 1 })}
                >
                  Previous
                </Button>
                <span className="text-sm text-gray-700">
                  Page {filters.page || 1} of {pagination.pages}
                </span>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={(filters.page || 1) >= pagination.pages}
                  onClick={() => setFilters({ ...filters, page: (filters.page || 1) + 1 })}
                >
                  Next
                </Button>
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* View Request Modal */}
      {selectedRequest && (
        <Modal
          isOpen={showViewModal}
          onClose={() => setShowViewModal(false)}
          title="Supply Request Details"
          size="lg"
        >
          <div className="space-y-6">
            {/* Header Info */}
            <div className="border-b border-gray-200 pb-4">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">{selectedRequest.title}</h3>
                  <p className="text-sm text-gray-500 mt-1">Request #{selectedRequest.requestNumber}</p>
                </div>
                <div className="text-right">
                  <StatusBadge status={selectedRequest.status} />
                  {isOverdue(selectedRequest) && (
                    <div className="text-xs text-red-600 font-medium mt-1">OVERDUE</div>
                  )}
                </div>
              </div>
              <p className="text-gray-600 mt-2">{selectedRequest.description}</p>
            </div>

            {/* Request Info */}
            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700">Requested By</label>
                <div className="mt-1">
                  <div className="font-medium">{selectedRequest.requestedBy?.name ?? 'Unknown'}</div>
                  <div className="text-sm text-gray-500">{selectedRequest.requestedBy?.email ?? ''}</div>
                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium mt-1 ${getDepartmentColor(selectedRequest.department)}`}>
                    {selectedRequest.department.replace(/_/g, ' ')}
                  </span>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Priority & Dates</label>
                <div className="mt-1">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getPriorityColor(selectedRequest.priority)}`}>
                    {selectedRequest.priority}
                  </span>
                  <div className="text-sm text-gray-600 mt-2">
                    <div>Created: {format(parseISO(selectedRequest.createdAt), 'MMM dd, yyyy')}</div>
                    <div className={isOverdue(selectedRequest) ? 'text-red-600 font-medium' : ''}>
                      Needed: {format(parseISO(selectedRequest.neededBy), 'MMM dd, yyyy')}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Items List */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">Requested Items</label>
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="space-y-4">
                  {selectedRequest.items.map((item, index) => (
                    <div key={`selectedRequest-items-${index}-${item.name}`} className="flex items-start justify-between p-3 bg-white rounded border">
                      <div className="flex-1">
                        <div className="font-medium text-gray-900">{item.name}</div>
                        <div className="text-sm text-gray-500">{item.description}</div>
                        <div className="text-sm text-gray-600 mt-1">
                          {item.quantity} {item.unit} • {item.category}
                          {item.supplier && (
                            <span className="ml-2">• Supplier: {item.supplier}</span>
                          )}
                        </div>
                      </div>
                      <div className="text-right ml-4">
                        <div className="font-medium text-gray-900">
                          {formatCurrency(item.actualCost ? item.actualCost : item.estimatedCost)}
                        </div>
                        {item.actualCost && item.actualCost !== item.estimatedCost && (
                          <div className="text-sm text-gray-500">Est: {formatCurrency(item.estimatedCost)}</div>
                        )}
                        {item.isReceived && (
                          <div className="text-xs text-green-600 font-medium mt-1">
                            ✓ Received {item.receivedQuantity}/{item.quantity}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="border-t border-gray-200 pt-4 mt-4">
                  <div className="flex justify-between items-center">
                    <span className="text-lg font-semibold text-gray-900">Total Cost:</span>
                    <span className="text-lg font-bold text-gray-900">
                      {formatCurrency(selectedRequest.totalActualCost > 0 ? selectedRequest.totalActualCost : selectedRequest.totalEstimatedCost)}
                      {selectedRequest.totalActualCost > 0 && selectedRequest.totalActualCost !== selectedRequest.totalEstimatedCost && (
                        <span className="text-sm text-gray-500 ml-2">(Est: {formatCurrency(selectedRequest.totalEstimatedCost)})</span>
                      )}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Approval Info */}
            {selectedRequest.approvedBy && (
              <div>
                <label className="block text-sm font-medium text-gray-700">Approval Details</label>
                <div className="mt-1 bg-blue-50 p-3 rounded-md">
                  <div className="text-sm">
                    <div className="font-medium">Approved by {selectedRequest.approvedBy.name}</div>
                    <div className="text-gray-600">
                      {selectedRequest.approvedAt && format(parseISO(selectedRequest.approvedAt), 'MMM dd, yyyy HH:mm')}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Rejection Reason */}
            {selectedRequest.status === 'rejected' && selectedRequest.rejectedReason && (
              <div>
                <label className="block text-sm font-medium text-gray-700">Rejection Reason</label>
                <div className="mt-1 bg-red-50 p-3 rounded-md text-sm text-red-800">
                  {selectedRequest.rejectedReason}
                </div>
              </div>
            )}

            {/* Notes */}
            {selectedRequest.notes && (
              <div>
                <label className="block text-sm font-medium text-gray-700">Notes</label>
                <div className="mt-1 bg-gray-50 p-3 rounded-md text-sm text-gray-900">
                  {selectedRequest.notes}
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center justify-end space-x-3 pt-6 border-t border-gray-200">
            <Button variant="secondary" onClick={() => setShowViewModal(false)}>
              Close
            </Button>
            {selectedRequest.status === 'pending' && (
              <>
                <Button 
                  onClick={() => {
                    setShowViewModal(false);
                    openApprovalModal(selectedRequest, 'reject');
                  }}
                  className="bg-red-600 hover:bg-red-700"
                >
                  Reject Request
                </Button>
                <Button 
                  onClick={() => {
                    setShowViewModal(false);
                    openApprovalModal(selectedRequest, 'approve');
                  }}
                  className="bg-green-600 hover:bg-green-700"
                >
                  Approve Request
                </Button>
              </>
            )}
          </div>
        </Modal>
      )}

      {/* Approval Modal */}
      <Modal
        isOpen={showApprovalModal}
        onClose={() => setShowApprovalModal(false)}
        title={`${approvalData.action === 'approve' ? 'Approve' : 'Reject'} Supply Request`}
      >
        <form onSubmit={handleApprovalAction} className="space-y-4">
          {selectedRequest && (
            <div className="bg-gray-50 p-4 rounded-md">
              <div className="text-sm">
                <div className="font-medium">Request: {selectedRequest.requestNumber}</div>
                <div className="text-gray-600">{selectedRequest.title}</div>
                <div className="font-medium mt-2">Total Cost: {formatCurrency(selectedRequest.totalEstimatedCost)}</div>
              </div>
            </div>
          )}

          {approvalData.action === 'reject' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Rejection Reason *</label>
              <textarea
                className="w-full border border-gray-300 rounded-md px-3 py-2 h-24 resize-none"
                required
                value={approvalData.rejectedReason}
                onChange={(e) => setApprovalData({ ...approvalData, rejectedReason: e.target.value })}
                placeholder="Please provide a reason for rejection..."
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Additional Notes</label>
            <textarea
              className="w-full border border-gray-300 rounded-md px-3 py-2 h-20 resize-none"
              value={approvalData.notes}
              onChange={(e) => setApprovalData({ ...approvalData, notes: e.target.value })}
              placeholder="Add any additional notes or comments..."
            />
          </div>

          <div className="flex items-center justify-end space-x-3 pt-4 border-t border-gray-200">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setShowApprovalModal(false)}
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={updating}
              className={approvalData.action === 'approve' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}
            >
              {updating ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  {approvalData.action === 'approve' ? (
                    <CheckSquare className="h-4 w-4 mr-2" />
                  ) : (
                    <XCircle className="h-4 w-4 mr-2" />
                  )}
                  {approvalData.action === 'approve' ? 'Approve Request' : 'Reject Request'}
                </>
              )}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
    </ErrorBoundary>
  );
}