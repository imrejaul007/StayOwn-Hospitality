import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { guestServiceRequestService } from '../../services/guestServiceRequestService';
import {
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Calendar,
  Users,
  Filter,
  Search,
  Play,
  Square,
  Package,
  FileText,
  Wifi,
  WifiOff,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { formatDate, formatCurrency } from '../../utils/formatters';
import { useRealTime } from '../../services/realTimeService';
import toast from 'react-hot-toast';
import { withErrorBoundary } from '../../components/ErrorBoundary';

interface ServiceRequest {
  _id: string;
  userId: {
    _id: string;
    name: string;
    email: string;
  };
  bookingId: {
    _id: string;
    bookingNumber: string;
  };
  hotelId: {
    _id: string;
    name: string;
  };
  serviceType: 'room_service' | 'housekeeping' | 'maintenance' | 'concierge' | 'transport' | 'spa' | 'laundry' | 'other';
  serviceVariation: string;
  serviceVariations?: string[];
  title?: string;
  description?: string;
  priority: 'now' | 'later' | 'low' | 'medium' | 'high' | 'urgent';
  status: 'pending' | 'assigned' | 'in_progress' | 'completed' | 'cancelled';
  assignedTo?: {
    _id: string;
    name: string;
  };
  scheduledTime?: string;
  completedTime?: string;
  estimatedCost?: number;
  actualCost?: number;
  notes?: string;
  specialInstructions?: string;
  items?: Array<{
    name: string;
    quantity: number;
    price: number;
  }>;
  createdAt: string;
  updatedAt: string;
}

const PAGE_SIZE = 20;

function StaffServiceRequests() {
  const { user } = useAuth();
  const currentUserId = user?._id || user?.id;
  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('assigned');
  const [serviceTypeFilter, setServiceTypeFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Real-time connection
  const { connectionState, connect, disconnect, on, off, isConnected } = useRealTime();

  const fetchMyServiceRequests = useCallback(async () => {
    if (!user || user.role !== 'staff' || !currentUserId) return;
    try {
      setLoading(true);
      const params: Record<string, unknown> = {
        assignedTo: currentUserId,
        page,
        limit: PAGE_SIZE,
      };

      if (serviceTypeFilter !== 'all') params.serviceType = serviceTypeFilter;
      if (statusFilter !== 'all') params.status = statusFilter;

      // Exclude inventory requests at the API level via excludeServiceVariation
      params.excludeServiceVariation = 'inventory_request';

      const response = await guestServiceRequestService.getServiceRequests(params as Parameters<typeof guestServiceRequestService.getServiceRequests>[0]);

      // The backend already scopes to assignedTo for staff role; apply a lightweight
      // client-side guard to exclude any remaining inventory/supply records.
      const EXCLUDED_VARIATIONS = ['inventory_request', 'inventory'];
      const myServiceRequests = (response.serviceRequests || []).filter(service => {
        const variation = (service.serviceVariation || '').toLowerCase();
        const variations = (service.serviceVariations || []).map((v: string) => v.toLowerCase());
        const isInventory =
          service.serviceType === 'other' &&
          (EXCLUDED_VARIATIONS.some(v => variation.includes(v)) ||
            variations.some(v => EXCLUDED_VARIATIONS.some(iv => v.includes(iv))));
        return !isInventory;
      });

      setRequests(myServiceRequests);
      if (response.pagination) {
        setTotalCount(response.pagination.total);
        setTotalPages(response.pagination.pages || Math.ceil(response.pagination.total / PAGE_SIZE) || 1);
      }
    } catch (error) {
      toast.error('Failed to load service requests');
    } finally {
      setLoading(false);
    }
  }, [user, currentUserId, statusFilter, serviceTypeFilter, page]);

  useEffect(() => {
    fetchMyServiceRequests();
  }, [fetchMyServiceRequests]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setPage(1);
  }, [statusFilter, serviceTypeFilter]);

  // Real-time updates
  useEffect(() => {
    if (!isConnected) return;

    const handleServiceUpdate = (data: Record<string, unknown>) => {
      const payloadRequest = data.serviceRequest as { assignedTo?: { _id?: string } } | undefined;
      const payloadAssignedTo = (data.assignedTo as string | undefined) || payloadRequest?.assignedTo?._id;
      if (!payloadAssignedTo || payloadAssignedTo === currentUserId) {
        fetchMyServiceRequests();
      }
    };

    on('guest-services:created', handleServiceUpdate);
    on('guest-services:updated', handleServiceUpdate);
    on('guest-services:completed', handleServiceUpdate);
    on('guest-services:cancelled', handleServiceUpdate);
    on('guest-services:assigned', handleServiceUpdate);

    return () => {
      off('guest-services:created', handleServiceUpdate);
      off('guest-services:updated', handleServiceUpdate);
      off('guest-services:completed', handleServiceUpdate);
      off('guest-services:cancelled', handleServiceUpdate);
      off('guest-services:assigned', handleServiceUpdate);
    };
  }, [isConnected, on, off, currentUserId, fetchMyServiceRequests]);

  const handleUpdateStatus = async (requestId: string, status: string, notes?: string) => {
    try {
      setUpdating(requestId);
      await guestServiceRequestService.updateServiceRequest(requestId, { status: status as ServiceRequest['status'], notes });
      
      const statusLabels: { [key: string]: string } = {
        'in_progress': 'started',
        'completed': 'completed',
        'cancelled': 'cancelled'
      };
      
      toast.success(`Service request ${statusLabels[status] || status.replace('_', ' ')}`);
      fetchMyServiceRequests();
    } catch (error: unknown) {
      const maybeAxios = error as { response?: { data?: { message?: string } } };
      toast.error(maybeAxios.response?.data?.message || 'Failed to update status');
    } finally {
      setUpdating(null);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'assigned': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'in_progress': return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'completed': return 'bg-green-100 text-green-800 border-green-200';
      case 'cancelled': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return <Clock className="w-4 h-4" />;
      case 'assigned': return <AlertCircle className="w-4 h-4" />;
      case 'in_progress': return <Play className="w-4 h-4" />;
      case 'completed': return <CheckCircle className="w-4 h-4" />;
      case 'cancelled': return <XCircle className="w-4 h-4" />;
      default: return <Clock className="w-4 h-4" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'now': return 'bg-red-100 text-red-800 border-red-200';
      case 'urgent': return 'bg-red-100 text-red-800 border-red-200';
      case 'high': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low': return 'bg-green-100 text-green-800 border-green-200';
      case 'later': return 'bg-blue-100 text-blue-800 border-blue-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getServiceTypeIcon = (serviceType: string) => {
    switch (serviceType) {
      case 'room_service': return '🍽️';
      case 'housekeeping': return '🧹';
      case 'maintenance': return '🔧';
      case 'concierge': return '🛎️';
      case 'transport': return '🚗';
      case 'spa': return '💆';
      case 'laundry': return '👔';
      default: return '📋';
    }
  };

  const filteredRequests = requests.filter(request =>
    request.serviceVariations?.some(variation => variation.toLowerCase().includes(searchTerm.toLowerCase())) ||
    request.serviceVariation?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    request.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    request.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    request.bookingId?.bookingNumber?.includes(searchTerm) ||
    request.userId?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    request.serviceType.replace('_', ' ').toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Stats are derived from server-side counts, not just the current page.
  // For status-specific counts we rely on the pagination total when a filter is active,
  // and count the current page as a lower-bound indicator when showing "all".
  const statsData = {
    total: totalCount,
    // When filtered to a single status the totalCount is the accurate count for that status.
    assigned: statusFilter === 'assigned' ? totalCount : requests.filter(r => r.status === 'assigned').length,
    inProgress: statusFilter === 'in_progress' ? totalCount : requests.filter(r => r.status === 'in_progress').length,
    completed: statusFilter === 'completed' ? totalCount : requests.filter(r => r.status === 'completed').length,
    urgent: requests.filter(r => ['now', 'urgent'].includes(r.priority)).length
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">My Service Assignments</h1>
        <div className="flex items-center justify-between">
          <p className="text-sm sm:text-base text-gray-600">Service requests assigned to you</p>
          <div className="flex items-center space-x-2">
            {isConnected ? (
              <div className="flex items-center space-x-1 text-green-600">
                <Wifi className="w-4 h-4" />
                <span className="text-xs sm:text-sm">Connected</span>
              </div>
            ) : (
              <div className="flex items-center space-x-1 text-red-600">
                <WifiOff className="w-4 h-4" />
                <span className="text-xs sm:text-sm">Offline</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 sm:gap-4 mb-6">
        <Card className="p-3 sm:p-4 text-center">
          <div className="text-lg sm:text-2xl font-bold text-gray-900">{statsData.total}</div>
          <div className="text-xs sm:text-sm text-gray-600">Total</div>
        </Card>
        <Card className="p-3 sm:p-4 text-center">
          <div className="text-lg sm:text-2xl font-bold text-blue-600">{statsData.assigned}</div>
          <div className="text-xs sm:text-sm text-gray-600">Assigned</div>
        </Card>
        <Card className="p-3 sm:p-4 text-center">
          <div className="text-lg sm:text-2xl font-bold text-purple-600">{statsData.inProgress}</div>
          <div className="text-xs sm:text-sm text-gray-600">In Progress</div>
        </Card>
        <Card className="p-3 sm:p-4 text-center">
          <div className="text-lg sm:text-2xl font-bold text-green-600">{statsData.completed}</div>
          <div className="text-xs sm:text-sm text-gray-600">Completed</div>
        </Card>
        <Card className="p-3 sm:p-4 text-center">
          <div className="text-lg sm:text-2xl font-bold text-red-600">{statsData.urgent}</div>
          <div className="text-xs sm:text-sm text-gray-600">Urgent</div>
        </Card>
      </div>

      {/* Filters */}
      <div className="mb-6 space-y-3 sm:space-y-4">
        <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search requests..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm sm:text-base"
              />
            </div>
          </div>
          
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm sm:text-base"
          >
            <option value="all">All Status</option>
            <option value="assigned">Assigned</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
          </select>

          <select
            value={serviceTypeFilter}
            onChange={(e) => setServiceTypeFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm sm:text-base"
          >
            <option value="all">All Services</option>
            <option value="room_service">Room Service</option>
            <option value="housekeeping">Housekeeping</option>
            <option value="maintenance">Maintenance</option>
            <option value="concierge">Concierge</option>
            <option value="transport">Transport</option>
            <option value="spa">Spa</option>
            <option value="laundry">Laundry</option>
          </select>
        </div>
      </div>

      {/* Service Requests List */}
      {filteredRequests.length === 0 ? (
        <Card className="p-8 sm:p-12 text-center">
          <AlertCircle className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No service requests found</h3>
          <p className="text-sm sm:text-base text-gray-500">
            {statusFilter === 'assigned' 
              ? "You have no assigned service requests at the moment." 
              : `No ${statusFilter === 'all' ? '' : statusFilter + ' '}service requests found.`}
          </p>
        </Card>
      ) : (
        <>
        <div className="space-y-4">
          {filteredRequests.map((request) => (
            <Card key={request._id} className="p-4 sm:p-6">
              <div className="flex flex-col space-y-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-3">
                      <span className="text-xl sm:text-2xl">{getServiceTypeIcon(request.serviceType)}</span>
                      <div className="min-w-0 flex-1">
                        <h3 className="text-base sm:text-lg font-semibold text-gray-900 truncate">
                          {request.serviceVariations && request.serviceVariations.length > 1
                            ? `${request.serviceVariations.length} ${request.serviceType.replace('_', ' ')} services`
                            : request.serviceVariation === 'multiple_services'
                            ? `Multiple ${request.serviceType.replace('_', ' ')} services`
                            : request.serviceVariations?.[0] || request.title || `${request.serviceType.replace('_', ' ')} Service`}
                        </h3>
                        <p className="text-xs sm:text-sm text-gray-600">
                          {request.bookingId?.bookingNumber ? `Booking #${request.bookingId.bookingNumber} • ` : ''}
                          Guest: {request.userId.name}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 mb-3">
                      <span className={`inline-flex items-center px-2 sm:px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(request.status)}`}>
                        {getStatusIcon(request.status)}
                        <span className="ml-1 capitalize">{request.status.replace('_', ' ')}</span>
                      </span>
                      <span className={`inline-flex items-center px-2 sm:px-2.5 py-0.5 rounded-full text-xs font-medium border ${getPriorityColor(request.priority)}`}>
                        {request.priority === 'now' ? 'Now' : request.priority === 'later' ? 'Scheduled' : `${request.priority.charAt(0).toUpperCase() + request.priority.slice(1)}`}
                      </span>
                    </div>

                    {request.description && (
                      <p className="text-sm text-gray-700 mb-3 line-clamp-2">{request.description}</p>
                    )}

                    {request.serviceVariations && request.serviceVariations.length > 1 && (
                      <div className="mb-3">
                        <p className="text-sm font-medium text-gray-700 mb-2">Services:</p>
                        <div className="flex flex-wrap gap-1">
                          {request.serviceVariations.slice(0, 3).map((variation, index) => (
                            <span key={`${request._id}-variation-${index}-${variation}`} className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                              {variation}
                            </span>
                          ))}
                          {request.serviceVariations.length > 3 && (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                              +{request.serviceVariations.length - 3} more
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-6 space-y-2 sm:space-y-0 text-xs sm:text-sm text-gray-500">
                      <div className="flex items-center space-x-1">
                        <Calendar className="w-4 h-4 flex-shrink-0" />
                        <span>Created {formatDate(request.createdAt)}</span>
                      </div>
                      {request.scheduledTime && (
                        <div className="flex items-center space-x-1">
                          <Clock className="w-4 h-4 flex-shrink-0" />
                          <span>Scheduled {formatDate(request.scheduledTime)}</span>
                        </div>
                      )}
                    </div>

                    {request.specialInstructions && (
                      <div className="mt-3 p-3 bg-blue-50 rounded-lg">
                        <p className="text-sm text-blue-800">
                          <strong>Special Instructions:</strong> {request.specialInstructions}
                        </p>
                      </div>
                    )}

                    {request.notes && (
                      <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                        <p className="text-sm text-gray-700">
                          <strong>Staff Notes:</strong> {request.notes}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-3">
                  {request.status === 'assigned' && (
                    <Button
                      variant="primary"
                      onClick={() => handleUpdateStatus(request._id, 'in_progress')}
                      loading={updating === request._id}
                      className="w-full sm:w-auto"
                    >
                      <Play className="w-4 h-4 mr-2" />
                      Start Working
                    </Button>
                  )}

                  {request.status === 'in_progress' && (
                    <Button
                      variant="success"
                      onClick={() => handleUpdateStatus(request._id, 'completed')}
                      loading={updating === request._id}
                      className="w-full sm:w-auto"
                    >
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Mark Complete
                    </Button>
                  )}

                  {['assigned', 'in_progress'].includes(request.status) && (
                    <Button
                      variant="ghost"
                      onClick={() => handleUpdateStatus(request._id, 'cancelled', 'Unable to complete')}
                      loading={updating === request._id}
                      className="w-full sm:w-auto text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <Square className="w-4 h-4 mr-2" />
                      Cannot Complete
                    </Button>
                  )}
                </div>

                {/* Cost Information */}
                {(request.estimatedCost || request.actualCost) && (
                  <div className="border-t border-gray-200 pt-4">
                    <div className="flex flex-col sm:flex-row sm:justify-between text-sm space-y-1 sm:space-y-0">
                      {request.estimatedCost && (
                        <span className="text-gray-600">
                          Estimated Cost: {formatCurrency(request.estimatedCost, 'INR')}
                        </span>
                      )}
                      {request.actualCost && (
                        <span className="text-gray-900 font-medium">
                          Actual Cost: {formatCurrency(request.actualCost, 'INR')}
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-6">
            <p className="text-sm text-gray-600">
              Showing {filteredRequests.length} of {totalCount} requests
            </p>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1 || loading}
                className="flex items-center"
              >
                <ChevronLeft className="w-4 h-4 mr-1" />
                Previous
              </Button>
              <span className="text-sm text-gray-700 px-2">
                Page {page} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages || loading}
                className="flex items-center"
              >
                Next
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
        )}
        </>
      )}
    </div>
  );
}

export default withErrorBoundary(StaffServiceRequests);
