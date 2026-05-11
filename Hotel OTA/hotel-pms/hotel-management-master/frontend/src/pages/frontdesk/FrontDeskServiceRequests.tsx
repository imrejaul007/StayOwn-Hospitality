import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import {
  ClipboardList,
  Clock,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Filter,
  Wifi,
  WifiOff,
  Plus,
  User,
  Calendar,
  Flag,
  Users,
  Play,
  Search,
  XCircle
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useProperty } from '../../context/PropertyContext';
import { guestServiceService, GuestServiceRequest } from '../../services/guestService';
import { useRealTime } from '../../services/realTimeService';
import { api } from '../../services/api';
import { toast } from 'react-hot-toast';
import { withErrorBoundary } from '../../components/ErrorBoundary';

const PAGE_LIMIT = 20;

const SERVICE_TYPES = [
  { value: 'room_service', label: 'Room Service' },
  { value: 'housekeeping', label: 'Housekeeping' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'concierge', label: 'Concierge' },
  { value: 'transport', label: 'Transport' },
  { value: 'spa', label: 'Spa' },
  { value: 'laundry', label: 'Laundry' },
  { value: 'other', label: 'Other' },
] as const;

const STATUS_TABS = [
  { key: '', label: 'All', icon: <ClipboardList className="h-4 w-4" />, color: 'text-gray-600' },
  { key: 'pending', label: 'Pending', icon: <Clock className="h-4 w-4" />, color: 'text-orange-600' },
  { key: 'assigned', label: 'Assigned', icon: <Users className="h-4 w-4" />, color: 'text-blue-600' },
  { key: 'in_progress', label: 'In Progress', icon: <Play className="h-4 w-4" />, color: 'text-yellow-600' },
  { key: 'completed', label: 'Completed', icon: <CheckCircle className="h-4 w-4" />, color: 'text-green-600' },
] as const;

const PRIORITIES = [
  { value: 'urgent', label: 'Urgent' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'now', label: 'Now' },
  { value: 'low', label: 'Low' },
  { value: 'later', label: 'Later' },
] as const;

interface StaffMember {
  _id: string;
  name: string;
  email: string;
  department?: string;
}

interface ActiveBooking {
  _id: string;
  bookingNumber: string;
  rooms?: Array<{
    roomId?: {
      _id: string;
      roomNumber: string;
    };
  }>;
  userId?: {
    _id: string;
    name: string;
  };
}

interface StatsOverall {
  totalRequests?: number;
  pendingCount?: number;
  assignedCount?: number;
  inProgressCount?: number;
  completedCount?: number;
  cancelledCount?: number;
  avgRating?: number;
}

function FrontDeskServiceRequests() {
  const { user } = useAuth();
  const { selectedPropertyId, primaryTenantHotelId } = useProperty();
  const hotelId = selectedPropertyId || primaryTenantHotelId || '';
  const { connect, on, off, isConnected } = useRealTime();

  // List state
  const [requests, setRequests] = useState<GuestServiceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [priorityFilter, setPriorityFilter] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Stats
  const [stats, setStats] = useState<StatsOverall | null>(null);

  // Create modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [activeBookings, setActiveBookings] = useState<ActiveBooking[]>([]);
  const [newRequest, setNewRequest] = useState({
    bookingId: '',
    serviceType: 'room_service' as string,
    title: '',
    description: '',
    priority: 'medium' as string,
    scheduledTime: '',
    specialInstructions: '',
  });

  // Assign modal
  const [assigningRequest, setAssigningRequest] = useState<GuestServiceRequest | null>(null);
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [assignTo, setAssignTo] = useState('');
  const [assigning, setAssigning] = useState(false);

  // Status update modal
  const [updatingRequest, setUpdatingRequest] = useState<GuestServiceRequest | null>(null);
  const [newStatus, setNewStatus] = useState('');
  const [statusNotes, setStatusNotes] = useState('');
  const [updatingStatus, setUpdatingStatus] = useState(false);

  const fetchRequestsRef = useRef<(() => Promise<void>) | null>(null);

  // ---- Data fetching ----

  const fetchRequests = useCallback(async () => {
    if (!hotelId) return;
    try {
      setLoading(true);
      setError(null);
      const params: Record<string, string | number> = {
        page,
        limit: PAGE_LIMIT,
        hotelId,
      };
      if (statusFilter) params.status = statusFilter;
      if (typeFilter) params.serviceType = typeFilter;
      if (priorityFilter) params.priority = priorityFilter;
      if (searchQuery.trim()) params.search = searchQuery.trim();

      const response = await guestServiceService.getServiceRequests(params as any);
      setRequests(response.data.serviceRequests || []);
      const pagination = response.data.pagination;
      if (pagination) {
        setTotalPages(pagination.pages ?? 1);
        setTotalCount(pagination.total ?? 0);
      }
    } catch {
      setError('Unable to load service requests.');
      setRequests([]);
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, typeFilter, priorityFilter, searchQuery, hotelId]);

  const fetchStats = useCallback(async () => {
    if (!hotelId) return;
    try {
      const response = await api.get('/guest-services/stats', { params: { hotelId } });
      const data = response.data?.data;
      setStats(data?.overall || null);
    } catch {
      // Stats are supplementary — don't block
    }
  }, [hotelId]);

  const fetchAvailableStaff = useCallback(async () => {
    if (!hotelId) return;
    try {
      const response = await api.get('/guest-services/available-staff', { params: { hotelId, limit: 100 } });
      setStaffList(response.data?.data || []);
    } catch {
      setStaffList([]);
    }
  }, [hotelId]);

  const fetchActiveBookings = useCallback(async () => {
    if (!hotelId) return;
    try {
      const response = await api.get('/bookings', {
        params: {
          hotelId,
          status: 'checked_in',
          page: 1,
          limit: 100,
        },
      });
      const bookings = response.data?.data?.bookings || response.data?.data || [];
      setActiveBookings(Array.isArray(bookings) ? bookings : []);
    } catch {
      setActiveBookings([]);
    }
  }, [hotelId]);

  // ---- Effects ----

  useEffect(() => { fetchRequests(); }, [fetchRequests]);
  useEffect(() => { fetchStats(); }, [fetchStats]);
  useEffect(() => { fetchRequestsRef.current = fetchRequests; }, [fetchRequests]);

  // Reset page on filter change
  useEffect(() => { setPage(1); }, [statusFilter, typeFilter, priorityFilter, searchQuery]);

  // Real-time WebSocket
  useEffect(() => { connect().catch(() => {}); }, [connect]);
  useEffect(() => {
    if (!isConnected) return;
    const refresh = () => {
      fetchRequestsRef.current?.();
      fetchStats();
    };
    on('guest-services:created', refresh);
    on('guest-services:updated', refresh);
    on('guest-services:status_changed', refresh);
    on('guest-services:assigned', refresh);
    on('guest-services:in_progress', refresh);
    on('guest-services:completed', refresh);
    on('guest-services:cancelled', refresh);
    return () => {
      off('guest-services:created', refresh);
      off('guest-services:updated', refresh);
      off('guest-services:status_changed', refresh);
      off('guest-services:assigned', refresh);
      off('guest-services:in_progress', refresh);
      off('guest-services:completed', refresh);
      off('guest-services:cancelled', refresh);
    };
  }, [isConnected, on, off, fetchStats]);

  // ---- Handlers ----

  const handleCreateRequest = async () => {
    if (!newRequest.bookingId || !newRequest.serviceType) {
      toast.error('Booking and service type are required.');
      return;
    }
    try {
      setCreating(true);
      const payload: Record<string, unknown> = {
        bookingId: newRequest.bookingId,
        serviceType: newRequest.serviceType,
        serviceVariations: newRequest.title ? [newRequest.title] : [],
        title: newRequest.title || undefined,
        description: newRequest.description || undefined,
        priority: newRequest.priority || 'medium',
        specialInstructions: newRequest.specialInstructions || undefined,
      };
      if (newRequest.scheduledTime) {
        payload.scheduledTime = new Date(newRequest.scheduledTime).toISOString();
      }
      await guestServiceService.createServiceRequest(payload as any);
      toast.success('Service request created successfully!');
      setShowCreateModal(false);
      setNewRequest({
        bookingId: '', serviceType: 'room_service', title: '', description: '',
        priority: 'medium', scheduledTime: '', specialInstructions: '',
      });
      fetchRequests();
      fetchStats();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to create service request.';
      toast.error(msg);
    } finally {
      setCreating(false);
    }
  };

  const handleAssign = async () => {
    if (!assigningRequest || !assignTo) {
      toast.error('Select a staff member.');
      return;
    }
    try {
      setAssigning(true);
      await guestServiceService.updateServiceRequest(assigningRequest._id, {
        assignedTo: assignTo,
        status: 'assigned',
      } as any);
      toast.success('Request assigned successfully!');
      setAssigningRequest(null);
      setAssignTo('');
      fetchRequests();
      fetchStats();
    } catch {
      toast.error('Failed to assign request.');
    } finally {
      setAssigning(false);
    }
  };

  const handleStatusUpdate = async () => {
    if (!updatingRequest || !newStatus) {
      toast.error('Select a status.');
      return;
    }
    try {
      setUpdatingStatus(true);
      const payload: Record<string, unknown> = { status: newStatus };
      if (statusNotes.trim()) payload.notes = statusNotes.trim();
      await guestServiceService.updateServiceRequest(updatingRequest._id, payload as any);
      toast.success(`Status updated to ${newStatus.replace('_', ' ')}`);
      setUpdatingRequest(null);
      setNewStatus('');
      setStatusNotes('');
      fetchRequests();
      fetchStats();
    } catch {
      toast.error('Failed to update status.');
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleQuickStatusUpdate = async (request: GuestServiceRequest, status: string) => {
    try {
      await guestServiceService.updateServiceRequest(request._id, { status } as any);
      toast.success(`Status updated to ${status.replace('_', ' ')}`);
      fetchRequests();
      fetchStats();
    } catch {
      toast.error('Failed to update status.');
    }
  };

  // ---- Helpers ----

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      pending: 'bg-orange-100 text-orange-800',
      assigned: 'bg-blue-100 text-blue-800',
      in_progress: 'bg-yellow-100 text-yellow-800',
      completed: 'bg-green-100 text-green-800',
      cancelled: 'bg-red-100 text-red-800',
    };
    return <Badge className={styles[status] || 'bg-gray-100 text-gray-800'}>{status.replace(/_/g, ' ')}</Badge>;
  };

  const getPriorityBadge = (priority: string) => {
    const styles: Record<string, string> = {
      urgent: 'bg-red-100 text-red-800 ring-1 ring-red-300',
      high: 'bg-orange-100 text-orange-800',
      now: 'bg-yellow-100 text-yellow-800',
      medium: 'bg-blue-100 text-blue-800',
      low: 'bg-gray-100 text-gray-600',
      later: 'bg-gray-100 text-gray-500',
    };
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${styles[priority] || 'bg-gray-100 text-gray-600'}`}>
        <Flag className="w-3 h-3 mr-1" />
        {priority}
      </span>
    );
  };

  const getPriorityRowColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'border-l-4 border-l-red-500 bg-red-50/50';
      case 'high': return 'border-l-4 border-l-orange-400 bg-orange-50/50';
      case 'now': return 'border-l-4 border-l-yellow-400 bg-yellow-50/50';
      case 'medium': return 'border-l-4 border-l-blue-300';
      case 'low': return 'border-l-4 border-l-gray-300';
      case 'later': return 'border-l-4 border-l-gray-200';
      default: return 'border-l-4 border-l-gray-200';
    }
  };

  const getServiceTypeLabel = (type: string) => {
    return SERVICE_TYPES.find(t => t.value === type)?.label || type.replace(/_/g, ' ');
  };

  const getTimeAgo = (dateString: unknown): string => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString as string);
    if (isNaN(date.getTime())) return 'N/A';
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / (1000 * 60));
    if (diffMin < 0) return 'N/A';
    if (diffMin < 1) return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHrs = Math.floor(diffMin / 60);
    if (diffHrs < 24) return `${diffHrs}h ago`;
    const diffDays = Math.floor(diffHrs / 24);
    return `${diffDays}d ago`;
  };

  const getRoomNumber = (request: GuestServiceRequest): string => {
    const rooms = request.bookingId?.rooms;
    if (rooms && rooms.length > 0 && rooms[0]?.roomId?.roomNumber) {
      return rooms[0].roomId.roomNumber;
    }
    return 'N/A';
  };

  const getNextStatuses = (currentStatus: string): string[] => {
    switch (currentStatus) {
      case 'pending': return ['assigned', 'in_progress', 'cancelled'];
      case 'assigned': return ['in_progress', 'cancelled'];
      case 'in_progress': return ['completed', 'cancelled'];
      default: return [];
    }
  };

  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > totalPages) return;
    setPage(newPage);
  };

  // ---- Guards ----

  if (!hotelId) {
    return (
      <div className="p-6 max-w-7xl mx-auto flex items-center justify-center min-h-[400px]">
        <div className="text-center max-w-md">
          <AlertTriangle className="mx-auto h-10 w-10 text-yellow-500 mb-3" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">No Property Selected</h2>
          <p className="text-gray-600">
            Select a property from the header to manage service requests.
          </p>
        </div>
      </div>
    );
  }

  if (loading && requests.length === 0 && !error) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner />
      </div>
    );
  }

  if (error && requests.length === 0) {
    return (
      <div className="p-6 max-w-7xl mx-auto text-center py-12">
        <AlertTriangle className="mx-auto h-8 w-8 text-red-500 mb-3" />
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Unable to Load Service Requests</h3>
        <p className="text-gray-600 mb-4">{error}</p>
        <Button onClick={fetchRequests}>
          <RefreshCw className="h-4 w-4 mr-2" />Try Again
        </Button>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-1">Service Requests</h1>
          <p className="text-gray-600">Unified operational queue for all guest service requests</p>
        </div>
        <div className="flex items-center space-x-3">
          <div className={`flex items-center px-2 py-1 rounded-full text-xs font-medium ${
            isConnected ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
          }`}>
            {isConnected
              ? <><Wifi className="w-3 h-3 mr-1" /> Live</>
              : <><WifiOff className="w-3 h-3 mr-1" /> Offline</>}
          </div>
          <Button
            onClick={() => {
              fetchAvailableStaff();
              fetchActiveBookings();
              setShowCreateModal(true);
            }}
            size="sm"
          >
            <Plus className="w-4 h-4 mr-2" />
            New Request
          </Button>
          <Button onClick={() => { fetchRequests(); fetchStats(); }} variant="secondary" size="sm">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Quick Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-6">
          <Card className="p-3">
            <div className="text-xs text-gray-500">Total</div>
            <div className="text-lg font-bold">{stats.totalRequests ?? 0}</div>
          </Card>
          <Card className="p-3">
            <div className="text-xs text-gray-500">Pending</div>
            <div className="text-lg font-bold text-orange-600">{stats.pendingCount ?? 0}</div>
          </Card>
          <Card className="p-3">
            <div className="text-xs text-gray-500">Assigned</div>
            <div className="text-lg font-bold text-blue-600">{stats.assignedCount ?? 0}</div>
          </Card>
          <Card className="p-3">
            <div className="text-xs text-gray-500">In Progress</div>
            <div className="text-lg font-bold text-yellow-600">{stats.inProgressCount ?? 0}</div>
          </Card>
          <Card className="p-3">
            <div className="text-xs text-gray-500">Completed</div>
            <div className="text-lg font-bold text-green-600">{stats.completedCount ?? 0}</div>
          </Card>
          <Card className="p-3">
            <div className="text-xs text-gray-500">Cancelled</div>
            <div className="text-lg font-bold text-red-600">{stats.cancelledCount ?? 0}</div>
          </Card>
        </div>
      )}

      {/* Status Tabs */}
      <div className="flex gap-1 mb-4 border-b border-gray-200 overflow-x-auto">
        {STATUS_TABS.map(tab => (
          <button
            key={tab.key}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              statusFilter === tab.key
                ? `border-blue-600 ${tab.color}`
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
            onClick={() => {
              setStatusFilter(tab.key);
              setPage(1);
            }}
          >
            <span className={statusFilter === tab.key ? tab.color : ''}>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Filters Row */}
      <Card className="mb-6">
        <CardContent className="pt-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1">
              <Filter className="w-4 h-4 text-gray-500" />
              <span className="text-sm font-medium text-gray-700">Filters:</span>
            </div>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="h-9 px-3 rounded-md border border-gray-200 text-sm"
            >
              <option value="">All Types</option>
              {SERVICE_TYPES.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="h-9 px-3 rounded-md border border-gray-200 text-sm"
            >
              <option value="">All Priorities</option>
              {PRIORITIES.map(p => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
            <div className="relative flex-1 min-w-[200px] max-w-xs">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search requests..."
                className="pl-8 h-9"
              />
            </div>
            {(typeFilter || priorityFilter || searchQuery) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setTypeFilter(''); setPriorityFilter(''); setSearchQuery(''); }}
                className="text-gray-500"
              >
                <XCircle className="w-4 h-4 mr-1" />
                Clear
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Request List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <ClipboardList className="h-5 w-5 mr-2 text-blue-600" />
            Service Requests ({totalCount})
            {loading && <RefreshCw className="w-4 h-4 ml-2 animate-spin text-gray-400" />}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {requests.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <CheckCircle className="mx-auto h-10 w-10 text-green-400 mb-3" />
              <p className="font-medium">No service requests match the current filters.</p>
              <p className="text-sm mt-1">Try adjusting your filters or create a new request.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {requests.map(request => (
                <div
                  key={request._id}
                  className={`p-4 rounded-lg ${getPriorityRowColor(request.priority)} flex items-start justify-between gap-3`}
                >
                  <div className="flex-1 min-w-0">
                    {/* Title line */}
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="font-medium text-sm">
                        {request.serviceVariations && request.serviceVariations.length > 0
                          ? request.serviceVariations.length === 1
                            ? request.serviceVariations[0]
                            : `${request.serviceVariations.length} ${getServiceTypeLabel(request.serviceType)} items`
                          : request.title || request.serviceVariation || 'Service Request'}
                      </span>
                      {getStatusBadge(request.status)}
                      <Badge variant="secondary" className="text-xs capitalize">
                        {getServiceTypeLabel(request.serviceType)}
                      </Badge>
                      {request.priority && getPriorityBadge(request.priority)}
                    </div>

                    {/* Description */}
                    {request.description && (
                      <p className="text-sm text-gray-600 mb-1 line-clamp-2">{request.description}</p>
                    )}

                    {/* Service variations list */}
                    {request.serviceVariations && request.serviceVariations.length > 1 && (
                      <div className="mt-1 mb-1 flex flex-wrap gap-1">
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
                              {isCompleted && <CheckCircle className="w-3 h-3 mr-0.5" />}
                              {variation}
                            </span>
                          );
                        })}
                      </div>
                    )}

                    {/* Meta info */}
                    <div className="flex flex-wrap gap-3 text-xs text-gray-500 mt-1">
                      <span className="flex items-center">
                        <ClipboardList className="w-3 h-3 mr-1" />
                        Room {getRoomNumber(request)}
                      </span>
                      {request.bookingId?.bookingNumber && (
                        <span>#{request.bookingId.bookingNumber}</span>
                      )}
                      {request.userId?.name && (
                        <span className="flex items-center">
                          <User className="w-3 h-3 mr-1" />
                          {request.userId.name}
                        </span>
                      )}
                      <span className="flex items-center">
                        <Users className="w-3 h-3 mr-1" />
                        {request.assignedTo?.name || 'Unassigned'}
                      </span>
                      {request.scheduledTime && (
                        <span className="flex items-center">
                          <Calendar className="w-3 h-3 mr-1" />
                          {new Date(request.scheduledTime).toLocaleString()}
                        </span>
                      )}
                      <span className="flex items-center">
                        <Clock className="w-3 h-3 mr-1" />
                        {getTimeAgo(request.createdAt)}
                      </span>
                      {request.completedTime && (
                        <span className="text-green-600">
                          Completed: {getTimeAgo(request.completedTime)}
                        </span>
                      )}
                    </div>

                    {/* Special instructions */}
                    {request.specialInstructions && (
                      <p className="text-xs text-gray-500 mt-1 italic">
                        Note: {request.specialInstructions}
                      </p>
                    )}

                    {/* Items */}
                    {request.items && request.items.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {request.items.map((item, idx) => (
                          <span key={idx} className="inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-gray-100 text-gray-700">
                            {item.quantity}x {item.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex-shrink-0 flex flex-col gap-1">
                    {(request.status === 'pending' || (request.status === 'assigned' && !request.assignedTo)) && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          fetchAvailableStaff();
                          setAssigningRequest(request);
                          setAssignTo('');
                        }}
                        className="text-blue-600 border-blue-300 hover:bg-blue-50"
                      >
                        <User className="w-3 h-3 mr-1" />
                        Assign
                      </Button>
                    )}
                    {request.status === 'assigned' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleQuickStatusUpdate(request, 'in_progress')}
                        className="text-yellow-700 border-yellow-300 hover:bg-yellow-50"
                      >
                        <Play className="w-3 h-3 mr-1" />
                        Start
                      </Button>
                    )}
                    {request.status === 'in_progress' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleQuickStatusUpdate(request, 'completed')}
                        className="text-green-700 border-green-300 hover:bg-green-50"
                      >
                        <CheckCircle className="w-3 h-3 mr-1" />
                        Complete
                      </Button>
                    )}
                    {getNextStatuses(request.status).length > 0 && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setUpdatingRequest(request);
                          setNewStatus('');
                          setStatusNotes('');
                        }}
                        className="text-gray-500 text-xs"
                      >
                        More...
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-4 mt-6 pt-4 border-t">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(page - 1)}
                disabled={page <= 1 || loading}
              >
                <ChevronLeft className="w-4 h-4 mr-1" />Previous
              </Button>
              <span className="text-sm text-gray-600">
                Page {page} of {totalPages} ({totalCount} total)
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(page + 1)}
                disabled={page >= totalPages || loading}
              >
                Next<ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Request Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-semibold mb-4">Create Service Request</h2>
            <p className="text-sm text-gray-600 mb-4">
              Create a service request on behalf of a checked-in guest.
            </p>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Booking *</label>
                <select
                  value={newRequest.bookingId}
                  onChange={(e) => setNewRequest(r => ({ ...r, bookingId: e.target.value }))}
                  className="w-full h-9 px-3 rounded-md border border-gray-200 text-sm"
                >
                  <option value="">Select a checked-in booking...</option>
                  {activeBookings.map(b => (
                    <option key={b._id} value={b._id}>
                      #{b.bookingNumber}
                      {b.rooms?.[0]?.roomId?.roomNumber ? ` - Room ${b.rooms[0].roomId.roomNumber}` : ''}
                      {b.userId?.name ? ` (${b.userId.name})` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Service Type *</label>
                  <select
                    value={newRequest.serviceType}
                    onChange={(e) => setNewRequest(r => ({ ...r, serviceType: e.target.value }))}
                    className="w-full h-9 px-3 rounded-md border border-gray-200 text-sm"
                  >
                    {SERVICE_TYPES.map(t => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                  <select
                    value={newRequest.priority}
                    onChange={(e) => setNewRequest(r => ({ ...r, priority: e.target.value }))}
                    className="w-full h-9 px-3 rounded-md border border-gray-200 text-sm"
                  >
                    {PRIORITIES.map(p => (
                      <option key={p.value} value={p.value}>{p.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title / Service</label>
                <Input
                  value={newRequest.title}
                  onChange={(e) => setNewRequest(r => ({ ...r, title: e.target.value }))}
                  placeholder="e.g., Extra towels, Room cleaning, Airport pickup"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={newRequest.description}
                  onChange={(e) => setNewRequest(r => ({ ...r, description: e.target.value }))}
                  className="w-full border rounded-md p-2 text-sm h-20"
                  placeholder="Detailed description of the request..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Special Instructions</label>
                <textarea
                  value={newRequest.specialInstructions}
                  onChange={(e) => setNewRequest(r => ({ ...r, specialInstructions: e.target.value }))}
                  className="w-full border rounded-md p-2 text-sm h-16"
                  placeholder="Any special instructions for staff..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Scheduled Time</label>
                <Input
                  type="datetime-local"
                  value={newRequest.scheduledTime}
                  onChange={(e) => setNewRequest(r => ({ ...r, scheduledTime: e.target.value }))}
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <Button variant="outline" onClick={() => setShowCreateModal(false)} disabled={creating}>
                Cancel
              </Button>
              <Button onClick={handleCreateRequest} disabled={creating || !newRequest.bookingId}>
                {creating ? 'Creating...' : 'Create Request'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Assign Modal */}
      {assigningRequest && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h2 className="text-xl font-semibold mb-4">Assign Service Request</h2>
            <div className="mb-3 p-3 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600">
                <strong>Type:</strong> {getServiceTypeLabel(assigningRequest.serviceType)}
              </p>
              <p className="text-sm text-gray-600">
                <strong>Room:</strong> {getRoomNumber(assigningRequest)}
              </p>
              {assigningRequest.title && (
                <p className="text-sm text-gray-600">
                  <strong>Title:</strong> {assigningRequest.title}
                </p>
              )}
              {assigningRequest.priority && (
                <p className="text-sm text-gray-600 mt-1">
                  <strong>Priority:</strong> {assigningRequest.priority}
                </p>
              )}
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Assign to Staff Member</label>
              <select
                value={assignTo}
                onChange={(e) => setAssignTo(e.target.value)}
                className="w-full h-9 px-3 rounded-md border border-gray-200 text-sm"
              >
                <option value="">Select staff member...</option>
                {staffList.map(s => (
                  <option key={s._id} value={s._id}>
                    {s.name} {s.department ? `(${s.department})` : ''} - {s.email}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setAssigningRequest(null)} disabled={assigning}>
                Cancel
              </Button>
              <Button onClick={handleAssign} disabled={assigning || !assignTo}>
                {assigning ? 'Assigning...' : 'Assign'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Status Update Modal */}
      {updatingRequest && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h2 className="text-xl font-semibold mb-4">Update Request Status</h2>
            <div className="mb-3 p-3 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600">
                <strong>Type:</strong> {getServiceTypeLabel(updatingRequest.serviceType)}
              </p>
              <p className="text-sm text-gray-600">
                <strong>Room:</strong> {getRoomNumber(updatingRequest)}
              </p>
              <p className="text-sm text-gray-600">
                <strong>Current Status:</strong> {updatingRequest.status.replace(/_/g, ' ')}
              </p>
            </div>
            <div className="mb-3">
              <label className="block text-sm font-medium text-gray-700 mb-1">New Status</label>
              <select
                value={newStatus}
                onChange={(e) => setNewStatus(e.target.value)}
                className="w-full h-9 px-3 rounded-md border border-gray-200 text-sm"
              >
                <option value="">Select new status...</option>
                {getNextStatuses(updatingRequest.status).map(s => (
                  <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
                ))}
              </select>
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
              <textarea
                value={statusNotes}
                onChange={(e) => setStatusNotes(e.target.value)}
                className="w-full border rounded-md p-2 text-sm h-16"
                placeholder="Add notes about this status change..."
              />
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setUpdatingRequest(null)} disabled={updatingStatus}>
                Cancel
              </Button>
              <Button onClick={handleStatusUpdate} disabled={updatingStatus || !newStatus}>
                {updatingStatus ? 'Updating...' : 'Update Status'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default withErrorBoundary(FrontDeskServiceRequests, { level: 'page' });
