import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Users, Clock, CheckCircle, MessageSquare, RefreshCw, AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { TaskCompletionModal, getDefaultSteps, getServiceVariationSteps } from '../../components/staff/TaskCompletionModal';
import { guestServiceService, GuestServiceRequest } from '../../services/guestService';
import { useRealTime } from '../../services/realTimeService';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import { useProperty } from '../../context/PropertyContext';
import { withErrorBoundary } from '../../components/ErrorBoundary';

const PAGE_SIZE = 20;

function StaffGuestServices() {
  const { user } = useAuth();
  const { selectedPropertyId, primaryTenantHotelId } = useProperty();
  const propertyScopeId = selectedPropertyId || primaryTenantHotelId || '';
  const { isConnected, connect, on, off } = useRealTime();
  const currentUserId = user?._id || user?.id;
  const [requests, setRequests] = useState<GuestServiceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);
  const [selectedRequest, setSelectedRequest] = useState<GuestServiceRequest | null>(null);
  const [showCompletionModal, setShowCompletionModal] = useState(false);

  // Pagination state
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Active status tab for paginated view
  const [activeTab, setActiveTab] = useState<'pending' | 'assigned' | 'in_progress' | 'completed'>('pending');

  useEffect(() => {
    if (currentUserId && propertyScopeId) {
      fetchRequests(1, activeTab);
    }
  }, [currentUserId, activeTab, propertyScopeId, fetchRequests]);

  useEffect(() => {
    connect().catch(() => {
      // Manual refresh remains available if realtime is unavailable.
    });
  }, [connect]);

  useEffect(() => {
    if (!isConnected || !currentUserId) return;

    const handleGuestServiceEvent = () => {
      fetchRequests(page, activeTab);
    };

    on('guest-services:created', handleGuestServiceEvent);
    on('guest-services:updated', handleGuestServiceEvent);
    on('guest-services:status_changed', handleGuestServiceEvent);
    on('guest-services:assigned', handleGuestServiceEvent);
    on('guest-services:in_progress', handleGuestServiceEvent);
    on('guest-services:completed', handleGuestServiceEvent);
    on('guest-services:cancelled', handleGuestServiceEvent);

    return () => {
      off('guest-services:created', handleGuestServiceEvent);
      off('guest-services:updated', handleGuestServiceEvent);
      off('guest-services:status_changed', handleGuestServiceEvent);
      off('guest-services:assigned', handleGuestServiceEvent);
      off('guest-services:in_progress', handleGuestServiceEvent);
      off('guest-services:completed', handleGuestServiceEvent);
      off('guest-services:cancelled', handleGuestServiceEvent);
    };
  }, [isConnected, currentUserId, on, off, page, activeTab, fetchRequests]);

  const fetchRequests = useCallback(async (targetPage: number = 1, status?: string) => {
    if (!currentUserId || !propertyScopeId) {
      setRequests([]);
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setFetchError(null);
      const params: {
        page: number;
        limit: number;
        hotelId?: string;
        status?: string;
        assignedTo?: string;
        completedFrom?: string;
      } = {
        page: targetPage,
        limit: PAGE_SIZE,
        hotelId: propertyScopeId,
      };

      if (status) params.status = status;

      // For non-pending statuses, filter to this staff member's assignments.
      // Pending requests are shown hotel-wide so staff can claim them.
      if (status && status !== 'pending') {
        params.assignedTo = currentUserId;
      }

      // For completed tab, filter to requests completed today (filter on completedTime, not createdAt)
      if (status === 'completed') {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        params.completedFrom = today.toISOString();
      }

      const response = await guestServiceService.getServiceRequests(params);
      setRequests(response.data.serviceRequests || []);
      // Always update page so UI controls stay in sync even if pagination is absent
      setPage(targetPage);
      const pagination = response.data.pagination;
      if (pagination) {
        setTotalPages(pagination.pages ?? 1);
        setTotalCount(pagination.total ?? 0);
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Failed to load service requests';
      setFetchError(msg);
      toast.error('Failed to load service requests');
    } finally {
      setLoading(false);
    }
  }, [currentUserId, propertyScopeId]);

  const updateRequestStatus = async (requestId: string, newStatus: string) => {
    if (!currentUserId) {
      toast.error('User session not found. Please log in again.');
      return;
    }
    try {
      setUpdating(requestId);
      if (newStatus === 'assigned') {
        // Pass assignedTo as a plain ID string; guestService normalizes object -> string automatically
        await guestServiceService.updateServiceRequest(requestId, {
          assignedTo: { _id: currentUserId, name: user?.name || '' },
          status: 'assigned'
        });
      } else {
        await guestServiceService.updateServiceRequest(requestId, { status: newStatus as GuestServiceRequest['status'] });
      }
      toast.success('Request status updated successfully');
      fetchRequests(page, activeTab);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Failed to update request status';
      toast.error(msg);
    } finally {
      setUpdating(null);
    }
  };

  const handleCompleteClick = (request: GuestServiceRequest) => {
    setSelectedRequest(request);
    setShowCompletionModal(true);
  };

  const handleCompleteRequest = async (completedSteps: string[]) => {
    if (!selectedRequest) return;

    try {
      setUpdating(selectedRequest._id);

      // Extract completed service variations from the steps
      const completedServiceVariations: string[] = [];
      if (selectedRequest.serviceVariations) {
        selectedRequest.serviceVariations.forEach((variation, index) => {
          if (completedSteps.includes(`service_${index}`)) {
            completedServiceVariations.push(variation);
          }
        });
      }

      // Check if all service variations are completed
      const allServicesCompleted =
        !selectedRequest.serviceVariations?.length ||
        selectedRequest.serviceVariations.length === completedServiceVariations.length;

      const updatePayload: Partial<GuestServiceRequest> = {
        completedServiceVariations
      };

      if (allServicesCompleted) {
        updatePayload.status = 'completed';
      } else if (selectedRequest.status !== 'in_progress') {
        updatePayload.status = 'in_progress';
      }

      await guestServiceService.updateServiceRequest(selectedRequest._id, updatePayload);

      toast.success(allServicesCompleted ? 'Request completed successfully' : 'Progress updated successfully');
      fetchRequests(page, activeTab);
      setShowCompletionModal(false);
      setSelectedRequest(null);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Failed to update request';
      toast.error(msg);
    } finally {
      setUpdating(null);
    }
  };

  // Only staff and frontdesk roles can self-assign; backend ASSIGNABLE_ROLES = ['staff', 'frontdesk'].
  const canSelfAssign = user?.role === 'staff' || user?.role === 'frontdesk';

  const getActionButton = (request: GuestServiceRequest) => {
    const isUpdating = updating === request._id;

    switch (request.status) {
      case 'pending':
        if (!canSelfAssign) {
          return <Badge variant="outline" className="text-orange-600">Pending</Badge>;
        }
        return (
          <Button
            size="sm"
            onClick={() => updateRequestStatus(request._id, 'assigned')}
            disabled={isUpdating}
          >
            {isUpdating ? <RefreshCw className="h-4 w-4 animate-spin" /> : 'Assign to Me'}
          </Button>
        );
      case 'assigned':
        return (
          <Button
            size="sm"
            variant="outline"
            onClick={() => updateRequestStatus(request._id, 'in_progress')}
            disabled={isUpdating}
          >
            {isUpdating ? <RefreshCw className="h-4 w-4 animate-spin" /> : 'Start'}
          </Button>
        );
      case 'in_progress':
        return (
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleCompleteClick(request)}
            disabled={isUpdating}
          >
            {isUpdating ? <RefreshCw className="h-4 w-4 animate-spin" /> : 'Complete'}
          </Button>
        );
      case 'completed':
        return <Badge variant="outline" className="text-green-700">Completed</Badge>;
      case 'cancelled':
        return <Badge variant="outline" className="text-red-700">Cancelled</Badge>;
      default:
        return null;
    }
  };

  const parseDateValue = (value: unknown): Date | null => {
    if (!value) return null;
    if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
    if (typeof value === 'number') {
      const d = new Date(value);
      return Number.isNaN(d.getTime()) ? null : d;
    }
    if (typeof value === 'string') {
      const d = new Date(value);
      return Number.isNaN(d.getTime()) ? null : d;
    }
    if (typeof value === 'object') {
      const candidate = value as { $date?: unknown; date?: unknown };
      return parseDateValue(candidate.$date ?? candidate.date ?? null);
    }
    return null;
  };

  const getTimeAgo = (dateString: unknown) => {
    const date = parseDateValue(dateString);
    if (!date) return 'N/A';
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    if (Number.isNaN(diffInMinutes) || diffInMinutes < 0) return 'N/A';

    if (diffInMinutes < 60) {
      return `${diffInMinutes} min ago`;
    } else if (diffInMinutes < 1440) {
      const hours = Math.floor(diffInMinutes / 60);
      return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    } else {
      const days = Math.floor(diffInMinutes / 1440);
      return `${days} day${days > 1 ? 's' : ''} ago`;
    }
  };

  const getRequestedTimeAgo = (request: GuestServiceRequest) => {
    return getTimeAgo(request.createdAt || request.updatedAt || request.scheduledTime);
  };

  const getPriorityBadge = (priority: string) => {
    const map: Record<string, string> = {
      urgent: 'bg-red-100 text-red-800',
      high: 'bg-orange-100 text-orange-800',
      now: 'bg-yellow-100 text-yellow-800',
      medium: 'bg-blue-100 text-blue-800',
      low: 'bg-gray-100 text-gray-600',
      later: 'bg-gray-100 text-gray-600'
    };
    return map[priority] || 'bg-gray-100 text-gray-600';
  };

  const TABS: Array<{ key: 'pending' | 'assigned' | 'in_progress' | 'completed'; label: string; icon: React.ReactNode; color: string }> = [
    { key: 'pending', label: 'Pending', icon: <Clock className="h-4 w-4" />, color: 'text-orange-600' },
    { key: 'assigned', label: 'Assigned', icon: <Users className="h-4 w-4" />, color: 'text-blue-600' },
    { key: 'in_progress', label: 'In Progress', icon: <MessageSquare className="h-4 w-4" />, color: 'text-yellow-600' },
    { key: 'completed', label: 'Completed Today', icon: <CheckCircle className="h-4 w-4" />, color: 'text-green-600' }
  ];

  const getCardColorClass = (status: string) => {
    const map: Record<string, { bg: string; border: string }> = {
      pending: { bg: 'bg-orange-50', border: 'border-orange-200' },
      assigned: { bg: 'bg-blue-50', border: 'border-blue-200' },
      in_progress: { bg: 'bg-yellow-50', border: 'border-yellow-200' },
      completed: { bg: 'bg-green-50', border: 'border-green-200' }
    };
    return map[status] || { bg: 'bg-gray-50', border: 'border-gray-200' };
  };

  const renderRequestCard = (request: GuestServiceRequest) => {
    const colors = getCardColorClass(request.status);
    return (
      <div
        key={request._id}
        className={`flex items-start justify-between p-3 ${colors.bg} rounded-lg border ${colors.border} gap-3`}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-medium text-sm">
              {request.serviceVariations && request.serviceVariations.length > 0
                ? request.serviceVariations.length === 1
                  ? request.serviceVariations[0]
                  : `${request.serviceVariations.length} ${request.serviceType?.replace(/_/g, ' ')} services`
                : request.title || request.serviceVariation || 'Service Request'}
            </p>
            {request.priority && (
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getPriorityBadge(request.priority)}`}>
                {request.priority}
              </span>
            )}
          </div>
          <p className="text-sm text-gray-600 mt-0.5">
            Room {request.bookingId?.rooms?.[0]?.roomId?.roomNumber || 'N/A'} — {request.serviceType?.replace(/_/g, ' ')}
            {request.bookingId?.bookingNumber && (
              <span className="text-xs ml-1 text-gray-400">(#{request.bookingId.bookingNumber})</span>
            )}
          </p>
          {request.status === 'pending' && (
            <p className="text-xs text-orange-600 mt-0.5">Requested: {getRequestedTimeAgo(request)}</p>
          )}
          {request.status === 'assigned' && (
            <p className="text-xs text-blue-600 mt-0.5">Assigned: {getTimeAgo(request.updatedAt)}</p>
          )}
          {request.status === 'in_progress' && (
            <p className="text-xs text-yellow-600 mt-0.5">Started: {getTimeAgo(request.updatedAt)}</p>
          )}
          {request.status === 'completed' && (
            <p className="text-xs text-green-600 mt-0.5">
              Completed: {getTimeAgo(request.completedTime || request.updatedAt)}
            </p>
          )}

          {/* Service variations list */}
          {request.serviceVariations && request.serviceVariations.length > 1 && (
            <div className="mt-1 flex flex-wrap gap-1">
              {request.serviceVariations.map((variation, index) => {
                const isCompleted = request.completedServiceVariations?.includes(variation);
                return (
                  <span
                    key={`${request._id}-var-${index}`}
                    className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${
                      isCompleted
                        ? 'bg-green-100 text-green-800 line-through'
                        : 'bg-blue-100 text-blue-800'
                    }`}
                  >
                    {isCompleted && '✓ '}{variation}
                  </span>
                );
              })}
            </div>
          )}

          {/* Guest name */}
          {request.userId?.name && (
            <p className="text-xs text-gray-500 mt-0.5">Guest: {request.userId.name}</p>
          )}

          {/* Assigned to (for pending/manager views) */}
          {request.assignedTo?.name && request.status !== 'pending' && (
            <p className="text-xs text-gray-500">Assigned to: {request.assignedTo.name}</p>
          )}

          {request.description && (
            <p className="text-xs text-gray-500 mt-1 line-clamp-2">{request.description}</p>
          )}
        </div>
        <div className="flex-shrink-0">{getActionButton(request)}</div>
      </div>
    );
  };

  const getEmptyStateText = () => {
    switch (activeTab) {
      case 'pending': return 'No pending requests';
      case 'assigned': return 'No assigned requests';
      case 'in_progress': return 'No requests in progress';
      case 'completed': return 'No completed requests today';
      default: return 'No requests found';
    }
  };

  if (!propertyScopeId) {
    return (
      <div className="p-6 max-w-5xl mx-auto flex items-center justify-center min-h-[400px]">
        <div className="text-center max-w-md">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Property unavailable</h2>
          <p className="text-gray-600">
            Your account needs a hotel assignment or property selection. Open the property switcher in the header, or refresh after logging in.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-1">Guest Services</h1>
          <p className="text-gray-600">Manage guest requests and services</p>
        </div>
        <Button onClick={() => fetchRequests(page, activeTab)} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Status Tabs */}
      <div className="flex gap-2 mb-6 border-b border-gray-200 overflow-x-auto">
        {TABS.map(tab => (
          <button
            key={tab.key}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              activeTab === tab.key
                ? `border-blue-600 ${tab.color}`
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
            onClick={() => {
              setActiveTab(tab.key);
              setPage(1);
            }}
          >
            <span className={activeTab === tab.key ? tab.color : ''}>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Main Content Card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {TABS.find(t => t.key === activeTab)?.icon}
              <span>
                {TABS.find(t => t.key === activeTab)?.label}
                {totalCount > 0 && (
                  <span className="ml-2 text-sm font-normal text-gray-500">({totalCount} total)</span>
                )}
              </span>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <LoadingSpinner />
            </div>
          ) : fetchError ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-500">
              <AlertCircle className="h-10 w-10 text-red-400 mb-3" />
              <p className="font-medium text-red-600">Failed to load requests</p>
              <p className="text-sm mt-1 text-gray-500">{fetchError}</p>
              <Button
                size="sm"
                variant="outline"
                className="mt-4"
                onClick={() => fetchRequests(page, activeTab)}
              >
                Retry
              </Button>
            </div>
          ) : requests.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <CheckCircle className="mx-auto h-10 w-10 text-green-500 mb-3" />
              <p className="font-medium">{getEmptyStateText()}</p>
            </div>
          ) : (
            <>
              <div className="space-y-3">
                {requests.map(renderRequestCard)}
              </div>

              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-100">
                  <p className="text-sm text-gray-500">
                    Page {page} of {totalPages}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => fetchRequests(page - 1, activeTab)}
                      disabled={page <= 1 || loading}
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Previous
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => fetchRequests(page + 1, activeTab)}
                      disabled={page >= totalPages || loading}
                    >
                      Next
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Task Completion Modal */}
      {selectedRequest && (
        <TaskCompletionModal
          isOpen={showCompletionModal}
          onClose={() => {
            setShowCompletionModal(false);
            setSelectedRequest(null);
          }}
          onComplete={handleCompleteRequest}
          title="Complete Guest Service Request"
          taskName={`${
            selectedRequest.bookingId?.bookingNumber
              ? `Booking #${selectedRequest.bookingId.bookingNumber} — `
              : ''
          }${
            selectedRequest.serviceVariations && selectedRequest.serviceVariations.length > 0
              ? selectedRequest.serviceVariations.length === 1
                ? selectedRequest.serviceVariations[0]
                : `${selectedRequest.serviceVariations.length} ${selectedRequest.serviceType?.replace(/_/g, ' ')} services`
              : selectedRequest.title || 'Guest Service Request'
          }`}
          steps={
            selectedRequest.serviceVariations && selectedRequest.serviceVariations.length > 0
              ? getServiceVariationSteps(
                  selectedRequest.serviceVariations,
                  selectedRequest.completedServiceVariations
                )
              : getDefaultSteps('guest_service', selectedRequest.serviceType)
          }
          loading={updating === selectedRequest._id}
        />
      )}
    </div>
  );
}

export default withErrorBoundary(StaffGuestServices, { level: 'page' });
