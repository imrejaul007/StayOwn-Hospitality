import React, { useState, useEffect, useCallback, useRef } from 'react';
import { format, parseISO } from 'date-fns';
import {
  Package,
  Clock,
  Filter,
  Eye,
  User,
  RefreshCw,
  UserCheck,
  Play,
  CheckSquare,
  TrendingUp,
  Activity,
  Zap,
  Package2,
  CheckCheck,
  Download,
  Search,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/Modal';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import ErrorBoundary from '../../components/ErrorBoundary';
import toast from 'react-hot-toast';
import { adminGuestServicesService, GuestService, GuestServiceFilters } from '../../services/adminGuestServicesService';
import { useProperty } from '../../context/PropertyContext';
import { PropertyBreadcrumb } from '../../components/common/PropertyBreadcrumb';
import { useRealTime } from '../../services/realTimeService';

interface InventoryRequest extends GuestService {
  items?: Array<{
    name: string;
    quantity: number;
    price: number;
  }>;
  specialInstructions?: string;
}

interface InventoryStats {
  total: number;
  pending: number;
  assigned: number;
  inProgress: number;
  completed: number;
  cancelled: number;
  urgent: number;
}

function safeFormatDate(dateStr: string | undefined | null, formatStr: string): string {
  if (!dateStr) return 'N/A';
  try {
    return format(parseISO(dateStr), formatStr);
  } catch {
    return 'N/A';
  }
}

export default function FrontDeskInventoryRequests() {
  const { selectedPropertyId, viewMode } = useProperty();
  const { on, off } = useRealTime();
  const [requests, setRequests] = useState<InventoryRequest[]>([]);
  const [stats, setStats] = useState<InventoryStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [filters, setFilters] = useState<GuestServiceFilters>({
    serviceType: 'other',
    page: 1,
    limit: 20
  });
  const [pagination, setPagination] = useState({ total: 0, pages: 0 });
  const [availableStaff, setAvailableStaff] = useState<Array<{ _id: string; name: string; email: string; department: string }>>([]);

  const [searchTerm, setSearchTerm] = useState('');
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<InventoryRequest | null>(null);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignData, setAssignData] = useState({
    assignedTo: '',
    notes: '',
    scheduledTime: ''
  });

  const fetchRequests = useCallback(async () => {
    try {
      setLoading(true);
      const response = await adminGuestServicesService.getServices({
        ...filters,
        hotelId: selectedPropertyId,
        serviceVariation: 'inventory_request'
      } as GuestServiceFilters & { hotelId?: string });
      const inventoryRequests = (response.data.serviceRequests || []) as InventoryRequest[];
      const responsePagination = response.data.pagination;
      const serverTotal = responsePagination?.total || 0;
      setRequests(inventoryRequests);
      setPagination({
        total: serverTotal,
        pages: responsePagination?.pages || 1
      });
      // Pass server total so the "Total" stat card reflects the full dataset
      computeStats(inventoryRequests, serverTotal);
    } catch {
      toast.error('Failed to load inventory requests');
    } finally {
      setLoading(false);
    }
  }, [filters, selectedPropertyId, computeStats]);

  // Stats are computed from the current page slice for status breakdown,
  // but the "total" counter uses the server-side pagination total so it
  // reflects the full dataset (not just the current page).
  const computeStats = useCallback((reqs: InventoryRequest[], serverTotal?: number) => {
    setStats({
      total: serverTotal ?? reqs.length,
      pending: reqs.filter(r => r.status === 'pending').length,
      assigned: reqs.filter(r => r.status === 'assigned').length,
      inProgress: reqs.filter(r => r.status === 'in_progress').length,
      completed: reqs.filter(r => r.status === 'completed').length,
      cancelled: reqs.filter(r => r.status === 'cancelled').length,
      urgent: reqs.filter(r => r.priority === 'urgent' || r.priority === 'high').length,
    });
  }, []);

  const fetchAvailableStaff = useCallback(async () => {
    try {
      const response = await adminGuestServicesService.getAvailableStaff(selectedPropertyId);
      setAvailableStaff(response.data || []);
    } catch {
      setAvailableStaff([]);
    }
  }, [selectedPropertyId]);

  const debouncedSearch = useCallback((term: string) => {
    if (debounceTimeoutRef.current) clearTimeout(debounceTimeoutRef.current);
    debounceTimeoutRef.current = setTimeout(() => setSearchTerm(term), 300);
  }, []);

  const exportToCSV = useCallback(() => {
    const headers = [
      'Request Title', 'Description', 'Guest Name', 'Room Number',
      'Priority', 'Status', 'Assigned To', 'Items', 'Created Date', 'Completed Date'
    ];
    const csvData = requests.map(request => [
      request.title || '',
      request.description || '',
      request.userId?.name || '',
      request.bookingId?.rooms?.[0]?.roomId?.roomNumber || '',
      request.priority || '',
      request.status || '',
      request.assignedTo?.name || 'Unassigned',
      getItemsSummary(request.items),
      safeFormatDate(request.createdAt, 'yyyy-MM-dd HH:mm'),
      request.completedTime ? safeFormatDate(request.completedTime, 'yyyy-MM-dd HH:mm') : ''
    ]);
    const csvContent = [headers, ...csvData]
      .map(row => row.map(field => `"${field.toString().replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.setAttribute('href', URL.createObjectURL(blob));
    link.setAttribute('download', `inventory-requests-${format(new Date(), 'yyyy-MM-dd')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Exported to CSV');
  }, [requests]);

  useEffect(() => {
    if (selectedPropertyId) {
      fetchRequests();
      fetchAvailableStaff();
    }
    return () => { if (debounceTimeoutRef.current) clearTimeout(debounceTimeoutRef.current); };
  }, [fetchRequests, fetchAvailableStaff, selectedPropertyId]);

  // Stats are updated inside fetchRequests with the correct server total.
  // This secondary effect is kept only to handle edge cases where requests
  // state is mutated outside of fetchRequests (e.g., optimistic updates).
  // It intentionally does NOT pass a serverTotal so the stored total is
  // preserved by the nullish-coalescing fallback in computeStats.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (requests.length > 0) {
      // Only recompute breakdown counts; total stays from last fetchRequests call
      setStats(prev => prev ? {
        ...prev,
        pending: requests.filter(r => r.status === 'pending').length,
        assigned: requests.filter(r => r.status === 'assigned').length,
        inProgress: requests.filter(r => r.status === 'in_progress').length,
        completed: requests.filter(r => r.status === 'completed').length,
        cancelled: requests.filter(r => r.status === 'cancelled').length,
        urgent: requests.filter(r => r.priority === 'urgent' || r.priority === 'high').length,
      } : prev);
    }
  }, [requests]);

  // Real-time WebSocket listeners for guest service / inventory events
  useEffect(() => {
    const handleServiceEvent = () => {
      fetchRequests();
    };
    on('guest-services:created', handleServiceEvent);
    on('guest-services:updated', handleServiceEvent);
    on('guest-services:status_changed', handleServiceEvent);
    on('guest-services:assigned', handleServiceEvent);
    return () => {
      off('guest-services:created', handleServiceEvent);
      off('guest-services:updated', handleServiceEvent);
      off('guest-services:status_changed', handleServiceEvent);
      off('guest-services:assigned', handleServiceEvent);
    };
  }, [on, off]);

  const displayedRequests = searchTerm.trim()
    ? requests.filter((request) => {
        const searchLower = searchTerm.toLowerCase();
        const guestName = request.userId?.name?.toLowerCase() || '';
        const roomNumber = request.bookingId?.rooms?.[0]?.roomId?.roomNumber?.toString() || '';
        const title = request.title?.toLowerCase() || '';
        const description = request.description?.toLowerCase() || '';
        return guestName.includes(searchLower) ||
               roomNumber.includes(searchLower) ||
               title.includes(searchLower) ||
               description.includes(searchLower);
      })
    : requests;

  const handleStatusUpdate = async (requestId: string, newStatus: 'assigned' | 'in_progress' | 'completed' | 'cancelled') => {
    try {
      setUpdating(true);
      await adminGuestServicesService.updateStatus(requestId, newStatus);
      await fetchRequests();
      toast.success('Status updated');
    } catch {
      toast.error('Failed to update status');
    } finally {
      setUpdating(false);
    }
  };

  const handleAssignRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRequest) return;
    try {
      setUpdating(true);
      await adminGuestServicesService.assignService(selectedRequest._id, assignData);
      await fetchRequests();
      setShowAssignModal(false);
      setAssignData({ assignedTo: '', notes: '', scheduledTime: '' });
      toast.success('Request assigned');
    } catch {
      toast.error('Failed to assign request');
    } finally {
      setUpdating(false);
    }
  };

  const handleViewRequest = (request: InventoryRequest) => {
    setSelectedRequest(request);
    setShowViewModal(true);
  };

  const openAssignModal = (request: InventoryRequest) => {
    setSelectedRequest(request);
    setShowAssignModal(true);
  };

  const getItemsSummary = (items?: Array<{ name: string; quantity: number; price: number }>) => {
    if (!items || items.length === 0) return 'No specific items listed';
    const summary = items.map(item => `${item.quantity}x ${item.name}`).join(', ');
    return summary.length > 50 ? `${summary.substring(0, 50)}...` : summary;
  };

  if (!selectedPropertyId && viewMode === 'single') {
    return (
      <div className="p-6">
        <PropertyBreadcrumb items={['Inventory', 'Requests']} />
        <div className="text-center py-12">
          <p className="text-gray-600">Please select a property to view inventory requests</p>
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
        <PropertyBreadcrumb items={['Inventory', 'Requests']} />

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Inventory Requests</h1>
            <p className="text-gray-600 mt-1 text-sm">Monitor and manage guest inventory requests</p>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={exportToCSV} size="sm" variant="outline" disabled={displayedRequests.length === 0}>
              <Download className="w-4 h-4 mr-1" /> Export
            </Button>
            <Button onClick={fetchRequests} size="sm" disabled={loading}>
              <RefreshCw className={`w-4 h-4 mr-1 ${loading ? 'animate-spin' : ''}`} /> Refresh
            </Button>
          </div>
        </div>

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Card><CardContent className="p-4 flex items-center"><div className="p-2 bg-blue-100 rounded-lg mr-3"><TrendingUp className="h-5 w-5 text-blue-600" /></div><div><p className="text-xs text-gray-600">Total</p><p className="text-xl font-bold">{stats.total}</p></div></CardContent></Card>
            <Card><CardContent className="p-4 flex items-center"><div className="p-2 bg-yellow-100 rounded-lg mr-3"><Clock className="h-5 w-5 text-yellow-600" /></div><div><p className="text-xs text-gray-600">Pending</p><p className="text-xl font-bold">{stats.pending}</p></div></CardContent></Card>
            <Card><CardContent className="p-4 flex items-center"><div className="p-2 bg-orange-100 rounded-lg mr-3"><Activity className="h-5 w-5 text-orange-600" /></div><div><p className="text-xs text-gray-600">In Progress</p><p className="text-xl font-bold">{stats.inProgress}</p></div></CardContent></Card>
            <Card><CardContent className="p-4 flex items-center"><div className="p-2 bg-green-100 rounded-lg mr-3"><CheckCheck className="h-5 w-5 text-green-600" /></div><div><p className="text-xs text-gray-600">Completed</p><p className="text-xl font-bold">{stats.completed}</p></div></CardContent></Card>
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
                placeholder="Search by guest, room, or description..."
                className="w-full border rounded-lg px-4 py-2 pl-10 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-200"
                onChange={(e) => debouncedSearch(e.target.value)}
              />
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                  value={filters.status || ''}
                  onChange={(e) => setFilters({ ...filters, status: e.target.value || undefined, page: 1 })}
                >
                  <option value="">All Statuses</option>
                  <option value="pending">Pending</option>
                  <option value="assigned">Assigned</option>
                  <option value="in_progress">In Progress</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                <select
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                  value={filters.priority || ''}
                  onChange={(e) => setFilters({ ...filters, priority: e.target.value || undefined, page: 1 })}
                >
                  <option value="">All Priorities</option>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
              <div className="flex items-end">
                <Button
                  onClick={() => setFilters({ serviceType: 'other', page: 1, limit: 20 })}
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
                <Package className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Inventory Requests Found</h3>
                <p className="text-gray-500">No requests match the current filters.</p>
              </CardContent>
            </Card>
          ) : (
            displayedRequests.map((request) => (
              <Card key={request._id} className={`border-l-4 ${
                request.priority === 'urgent' ? 'border-red-500' :
                request.priority === 'high' ? 'border-orange-500' :
                request.priority === 'medium' ? 'border-yellow-500' : 'border-gray-300'
              }`}>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <Package className="h-5 w-5 text-blue-600" />
                        <h3 className="font-semibold text-gray-900">{request.title}</h3>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          request.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                          request.status === 'assigned' ? 'bg-blue-100 text-blue-800' :
                          request.status === 'in_progress' ? 'bg-orange-100 text-orange-800' :
                          request.status === 'completed' ? 'bg-green-100 text-green-800' :
                          'bg-red-100 text-red-800'
                        }`}>{(request.status || '').replace('_', ' ')}</span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          request.priority === 'urgent' ? 'bg-red-100 text-red-800' :
                          request.priority === 'high' ? 'bg-orange-100 text-orange-800' :
                          request.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>{request.priority === 'urgent' && <Zap className="inline h-3 w-3 mr-0.5" />}{request.priority}</span>
                      </div>
                      <p className="text-sm text-gray-600 mb-2">{request.description}</p>
                      <div className="grid grid-cols-3 gap-4 text-xs text-gray-500">
                        <div><User className="inline h-3 w-3 mr-1" />{request.userId?.name || 'Unknown'}</div>
                        <div><Package2 className="inline h-3 w-3 mr-1" />Room {request.bookingId?.rooms?.[0]?.roomId?.roomNumber || 'N/A'}</div>
                        <div><Clock className="inline h-3 w-3 mr-1" />{safeFormatDate(request.createdAt, 'MMM dd, HH:mm')}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 ml-4">
                      <Button size="sm" variant="outline" onClick={() => handleViewRequest(request)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                      {request.status === 'pending' && (
                        <Button size="sm" variant="outline" onClick={() => openAssignModal(request)} disabled={updating}>
                          <UserCheck className="h-4 w-4" />
                        </Button>
                      )}
                      {request.status === 'assigned' && (
                        <Button size="sm" onClick={() => handleStatusUpdate(request._id, 'in_progress')} disabled={updating}>
                          <Play className="h-4 w-4" />
                        </Button>
                      )}
                      {(request.status === 'in_progress' || request.status === 'assigned') && (
                        <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white" onClick={() => handleStatusUpdate(request._id, 'completed')} disabled={updating}>
                          <CheckSquare className="h-4 w-4" />
                        </Button>
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
              <Button size="sm" variant="outline" disabled={(filters.page || 1) <= 1}
                onClick={() => setFilters({ ...filters, page: (filters.page || 1) - 1 })}>Previous</Button>
              <Button size="sm" variant="outline" disabled={(filters.page || 1) >= pagination.pages}
                onClick={() => setFilters({ ...filters, page: (filters.page || 1) + 1 })}>Next</Button>
            </div>
          </div>
        )}

        {/* View Modal */}
        {selectedRequest && (
          <Modal isOpen={showViewModal} onClose={() => setShowViewModal(false)} title="Inventory Request Details">
            <div className="space-y-4">
              <div className="flex items-start space-x-3">
                <div className="p-2 rounded-lg bg-blue-100"><Package className="h-5 w-5 text-blue-600" /></div>
                <div>
                  <h3 className="text-lg font-semibold">{selectedRequest.title}</h3>
                  <p className="text-gray-600 mt-1">{selectedRequest.description}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div><label className="text-sm font-medium text-gray-500">Priority</label><div className="mt-1 capitalize font-medium">{selectedRequest.priority}</div></div>
                <div><label className="text-sm font-medium text-gray-500">Status</label><div className="mt-1 capitalize font-medium">{(selectedRequest.status || '').replace('_', ' ')}</div></div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div><label className="text-sm font-medium text-gray-500">Guest</label><div className="mt-1 font-medium">{selectedRequest.userId?.name || 'N/A'}</div><div className="text-sm text-gray-500">{selectedRequest.userId?.email || ''}</div></div>
                <div><label className="text-sm font-medium text-gray-500">Room & Booking</label><div className="mt-1 font-medium">Room {selectedRequest.bookingId?.rooms?.[0]?.roomId?.roomNumber || 'N/A'}</div><div className="text-sm text-gray-500">{selectedRequest.bookingId?.bookingNumber || ''}</div></div>
              </div>

              {selectedRequest.assignedTo && (
                <div><label className="text-sm font-medium text-gray-500">Assigned To</label><div className="mt-1 font-medium">{selectedRequest.assignedTo.name}</div></div>
              )}

              {selectedRequest.items && selectedRequest.items.length > 0 && (
                <div>
                  <label className="text-sm font-medium text-gray-500 mb-2 block">Requested Items</label>
                  <div className="bg-gray-50 p-3 rounded-md space-y-2">
                    {selectedRequest.items.map((item, idx) => (
                      <div key={`item-${idx}-${item.name}`} className="flex justify-between">
                        <span>{item.name}</span><span className="text-gray-500">Qty: {item.quantity}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selectedRequest.specialInstructions && (
                <div><label className="text-sm font-medium text-gray-500">Special Instructions</label><div className="mt-1 bg-blue-50 p-3 rounded-md text-sm">{selectedRequest.specialInstructions}</div></div>
              )}

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><label className="text-sm font-medium text-gray-500">Created</label><div className="mt-1">{safeFormatDate(selectedRequest.createdAt, 'MMM dd, yyyy HH:mm')}</div></div>
                {selectedRequest.completedTime && (
                  <div><label className="text-sm font-medium text-gray-500">Completed</label><div className="mt-1">{safeFormatDate(selectedRequest.completedTime, 'MMM dd, yyyy HH:mm')}</div></div>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t mt-4">
              <Button variant="outline" onClick={() => setShowViewModal(false)}>Close</Button>
              {selectedRequest.status === 'pending' && (
                <Button onClick={() => { setShowViewModal(false); openAssignModal(selectedRequest); }}>
                  <UserCheck className="h-4 w-4 mr-1" /> Assign
                </Button>
              )}
              {selectedRequest.status === 'assigned' && (
                <Button onClick={() => { handleStatusUpdate(selectedRequest._id, 'in_progress'); setShowViewModal(false); }} disabled={updating}>
                  <Play className="h-4 w-4 mr-1" /> Start
                </Button>
              )}
              {selectedRequest.status === 'in_progress' && (
                <Button className="bg-green-600 hover:bg-green-700 text-white" onClick={() => { handleStatusUpdate(selectedRequest._id, 'completed'); setShowViewModal(false); }} disabled={updating}>
                  <CheckSquare className="h-4 w-4 mr-1" /> Complete
                </Button>
              )}
            </div>
          </Modal>
        )}

        {/* Assign Modal */}
        {showAssignModal && (
          <Modal isOpen={showAssignModal} onClose={() => setShowAssignModal(false)} title="Assign Inventory Request">
            <form onSubmit={handleAssignRequest} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Assign To</label>
                <select
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                  value={assignData.assignedTo}
                  onChange={(e) => setAssignData({ ...assignData, assignedTo: e.target.value })}
                  required
                >
                  <option value="">Select Staff Member</option>
                  {availableStaff.map((staff) => (
                    <option key={staff._id} value={staff._id}>{staff.name} - {staff.department}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Scheduled Time (Optional)</label>
                <input
                  type="datetime-local"
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                  value={assignData.scheduledTime}
                  onChange={(e) => setAssignData({ ...assignData, scheduledTime: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  className="w-full border rounded-lg px-3 py-2 text-sm h-20 resize-none"
                  value={assignData.notes}
                  onChange={(e) => setAssignData({ ...assignData, notes: e.target.value })}
                  placeholder="Optional assignment notes"
                />
              </div>
              <div className="flex justify-end gap-3 pt-2 border-t">
                <Button type="button" variant="outline" onClick={() => setShowAssignModal(false)}>Cancel</Button>
                <Button type="submit" disabled={updating}>
                  {updating ? <><RefreshCw className="h-4 w-4 mr-1 animate-spin" /> Assigning...</> : <><UserCheck className="h-4 w-4 mr-1" /> Assign</>}
                </Button>
              </div>
            </form>
          </Modal>
        )}
      </div>
    </ErrorBoundary>
  );
}
