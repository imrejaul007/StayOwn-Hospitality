import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ClipboardList,
  Clock,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  Package,
} from 'lucide-react';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { dailyInventoryCheckService, DailyInventoryCheck } from '../../services/dailyInventoryCheckService';
import { guestServiceService, GuestServiceRequest } from '../../services/guestService';
import { formatDate } from '../../utils/formatters';
import toast from 'react-hot-toast';
import { withErrorBoundary } from '../../components/ErrorBoundary';

function StaffTasks() {
  const [inventoryChecks, setInventoryChecks] = useState<DailyInventoryCheck[]>([]);
  const [serviceRequests, setServiceRequests] = useState<GuestServiceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updating, setUpdating] = useState<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const fetchTasks = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      // Fetch both assigned and in-progress service requests in two parallel calls
      // (the API only supports a single status filter at a time)
      const [checksResponse, assignedResponse, inProgressResponse] = await Promise.all([
        dailyInventoryCheckService.getTodayChecks(),
        guestServiceService.getServiceRequests({ status: 'assigned', limit: 50 }),
        guestServiceService.getServiceRequests({ status: 'in_progress', limit: 50 }),
      ]);

      if (!mountedRef.current) return;

      setInventoryChecks(checksResponse.data.dailyChecks || []);

      // Merge assigned + in_progress requests, deduplicate by _id
      const merged: GuestServiceRequest[] = [
        ...(assignedResponse.data.serviceRequests || []),
        ...(inProgressResponse.data.serviceRequests || []),
      ];
      const seen = new Set<string>();
      const deduped = merged.filter((r) => {
        if (seen.has(r._id)) return false;
        seen.add(r._id);
        return true;
      });
      setServiceRequests(deduped);
    } catch (error) {
      if (mountedRef.current) toast.error('Failed to load tasks');
    } finally {
      if (mountedRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const updateServiceRequestStatus = async (requestId: string, newStatus: string) => {
    try {
      setUpdating(requestId);
      await guestServiceService.updateServiceRequest(requestId, {
        status: newStatus as GuestServiceRequest['status'],
      });
      toast.success('Request status updated successfully');
      fetchTasks(true);
    } catch (error) {
      toast.error('Failed to update request status');
    } finally {
      if (mountedRef.current) setUpdating(null);
    }
  };

  const completeInventoryCheck = async (checkId: string) => {
    try {
      setUpdating(checkId);
      await dailyInventoryCheckService.completeInventoryCheck(checkId);
      toast.success('Inventory check completed successfully');
      fetchTasks(true);
    } catch (error) {
      toast.error('Failed to complete inventory check');
    } finally {
      if (mountedRef.current) setUpdating(null);
    }
  };

  const getTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));

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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner />
      </div>
    );
  }

  const pendingChecks = inventoryChecks.filter((c) => c.status === 'pending');
  const inProgressChecks = inventoryChecks.filter((c) => c.status === 'in_progress');
  const completedChecks = inventoryChecks.filter((c) => c.status === 'completed');
  const overdueChecks = inventoryChecks.filter((c) => c.status === 'overdue');

  const assignedRequests = serviceRequests.filter((r) => r.status === 'assigned');
  const inProgressRequests = serviceRequests.filter((r) => r.status === 'in_progress');

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">My Tasks</h1>
          <p className="text-gray-600">Manage your daily tasks and inventory checks</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => fetchTasks(true)} disabled={refreshing}>
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Daily Inventory Checks */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Package className="h-5 w-5 mr-2 text-blue-600" />
              Daily Inventory Checks
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Overdue Checks */}
              {overdueChecks.length > 0 && (
                <div>
                  <h4 className="font-medium text-red-600 mb-2">
                    Overdue ({overdueChecks.length})
                  </h4>
                  {overdueChecks.map((check) => (
                    <div
                      key={check._id}
                      className="flex items-center justify-between p-3 bg-red-50 rounded-lg border border-red-200 mb-2"
                    >
                      <div>
                        <p className="font-medium">Room {check.roomId?.roomNumber ?? 'N/A'}</p>
                        <p className="text-sm text-gray-600">
                          {check.items.length} items to check
                        </p>
                        <p className="text-xs text-red-600">
                          Overdue since: {formatDate(check.checkDate)}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => completeInventoryCheck(check._id)}
                        disabled={updating === check._id}
                      >
                        {updating === check._id ? (
                          <RefreshCw className="h-4 w-4 animate-spin" />
                        ) : (
                          'Complete'
                        )}
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              {/* Pending Checks */}
              {pendingChecks.length > 0 && (
                <div>
                  <h4 className="font-medium text-orange-600 mb-2">
                    Pending ({pendingChecks.length})
                  </h4>
                  {pendingChecks.map((check) => (
                    <div
                      key={check._id}
                      className="flex items-center justify-between p-3 bg-orange-50 rounded-lg border border-orange-200 mb-2"
                    >
                      <div>
                        <p className="font-medium">Room {check.roomId?.roomNumber ?? 'N/A'}</p>
                        <p className="text-sm text-gray-600">
                          {check.items.length} items to check
                        </p>
                        <p className="text-xs text-orange-600">
                          Due: {formatDate(check.checkDate)}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => completeInventoryCheck(check._id)}
                        disabled={updating === check._id}
                      >
                        {updating === check._id ? (
                          <RefreshCw className="h-4 w-4 animate-spin" />
                        ) : (
                          'Start'
                        )}
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              {/* In Progress Checks */}
              {inProgressChecks.length > 0 && (
                <div>
                  <h4 className="font-medium text-blue-600 mb-2">
                    In Progress ({inProgressChecks.length})
                  </h4>
                  {inProgressChecks.map((check) => (
                    <div
                      key={check._id}
                      className="flex items-center justify-between p-3 bg-blue-50 rounded-lg border border-blue-200 mb-2"
                    >
                      <div>
                        <p className="font-medium">Room {check.roomId?.roomNumber ?? 'N/A'}</p>
                        <p className="text-sm text-gray-600">
                          {check.items.length} items checked
                        </p>
                        <p className="text-xs text-blue-600">
                          Started: {getTimeAgo(check.updatedAt)}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => completeInventoryCheck(check._id)}
                        disabled={updating === check._id}
                      >
                        {updating === check._id ? (
                          <RefreshCw className="h-4 w-4 animate-spin" />
                        ) : (
                          'Complete'
                        )}
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              {/* Completed Today */}
              {completedChecks.length > 0 && (
                <div>
                  <h4 className="font-medium text-green-600 mb-2">
                    Completed Today ({completedChecks.length})
                  </h4>
                  {completedChecks.map((check) => (
                    <div
                      key={check._id}
                      className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-200 mb-2"
                    >
                      <div>
                        <p className="font-medium">Room {check.roomId?.roomNumber ?? 'N/A'}</p>
                        <p className="text-sm text-gray-600">
                          {check.items.length} items checked
                        </p>
                        <p className="text-xs text-green-600">
                          Completed: {getTimeAgo(check.completedAt || check.updatedAt)}
                        </p>
                      </div>
                      <Badge variant="outline" className="text-green-700">
                        Completed
                      </Badge>
                    </div>
                  ))}
                </div>
              )}

              {inventoryChecks.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <Package className="mx-auto h-8 w-8 text-gray-400 mb-2" />
                  <p>No inventory checks assigned</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Assigned Service Requests */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <ClipboardList className="h-5 w-5 mr-2 text-purple-600" />
              Assigned Service Requests
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Assigned Requests */}
              {assignedRequests.length > 0 && (
                <div>
                  <h4 className="font-medium text-blue-600 mb-2">
                    Assigned ({assignedRequests.length})
                  </h4>
                  {assignedRequests.map((request) => (
                    <div
                      key={request._id}
                      className="flex items-center justify-between p-3 bg-blue-50 rounded-lg border border-blue-200 mb-2"
                    >
                      <div>
                        <p className="font-medium">{request.title || request.serviceType}</p>
                        <p className="text-sm text-gray-600">
                          {request.bookingId?.bookingNumber
                            ? `Booking #${request.bookingId.bookingNumber}`
                            : '—'}{' '}
                          &mdash; {request.serviceType.replace(/_/g, ' ')}
                        </p>
                        <p className="text-xs text-blue-600">
                          Assigned: {getTimeAgo(request.updatedAt)}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        onClick={() =>
                          updateServiceRequestStatus(request._id, 'in_progress')
                        }
                        disabled={updating === request._id}
                      >
                        {updating === request._id ? (
                          <RefreshCw className="h-4 w-4 animate-spin" />
                        ) : (
                          'Start'
                        )}
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              {/* In Progress Requests */}
              {inProgressRequests.length > 0 && (
                <div>
                  <h4 className="font-medium text-yellow-600 mb-2">
                    In Progress ({inProgressRequests.length})
                  </h4>
                  {inProgressRequests.map((request) => (
                    <div
                      key={request._id}
                      className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg border border-yellow-200 mb-2"
                    >
                      <div>
                        <p className="font-medium">{request.title || request.serviceType}</p>
                        <p className="text-sm text-gray-600">
                          {request.bookingId?.bookingNumber
                            ? `Booking #${request.bookingId.bookingNumber}`
                            : '—'}{' '}
                          &mdash; {request.serviceType.replace(/_/g, ' ')}
                        </p>
                        <p className="text-xs text-yellow-600">
                          Started: {getTimeAgo(request.updatedAt)}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          updateServiceRequestStatus(request._id, 'completed')
                        }
                        disabled={updating === request._id}
                      >
                        {updating === request._id ? (
                          <RefreshCw className="h-4 w-4 animate-spin" />
                        ) : (
                          'Complete'
                        )}
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              {serviceRequests.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <ClipboardList className="mx-auto h-8 w-8 text-gray-400 mb-2" />
                  <p>No service requests assigned</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Stats */}
      <div className="mt-8 grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center">
              <Clock className="h-8 w-8 text-orange-600 mr-3" />
              <div>
                <p className="text-sm text-gray-600">Pending Checks</p>
                <p className="text-2xl font-bold text-orange-600">{pendingChecks.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center">
              <RefreshCw className="h-8 w-8 text-blue-600 mr-3" />
              <div>
                <p className="text-sm text-gray-600">In Progress</p>
                <p className="text-2xl font-bold text-blue-600">
                  {inProgressChecks.length + inProgressRequests.length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center">
              <CheckCircle className="h-8 w-8 text-green-600 mr-3" />
              <div>
                <p className="text-sm text-gray-600">Completed Today</p>
                <p className="text-2xl font-bold text-green-600">{completedChecks.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center">
              <AlertTriangle className="h-8 w-8 text-red-600 mr-3" />
              <div>
                <p className="text-sm text-gray-600">Overdue</p>
                <p className="text-2xl font-bold text-red-600">{overdueChecks.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default withErrorBoundary(StaffTasks);
