import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/Modal';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { PropertyBreadcrumb } from '../../components/common/PropertyBreadcrumb';
import { useProperty } from '../../context/PropertyContext';
import { api } from '../../services/api';
import toast from 'react-hot-toast';
import { withErrorBoundary } from '../../components/ErrorBoundary';
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  ClipboardCheck,
  RefreshCw,
  Filter,
  Eye,
  Package,
  Wrench,
  ChevronLeft,
  ChevronRight,
  Activity,
  ShieldAlert,
  ArrowUpDown,
  FileText,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RoomRef {
  _id: string;
  roomNumber: string;
  type?: string;
  floor?: number;
}

interface BookingRef {
  _id: string;
  bookingNumber?: string;
  checkIn?: string;
  checkOut?: string;
}

interface RoomInventoryItem {
  _id: string;
  name?: string;
  category?: string;
  condition?: string;
  needsReplacement?: boolean;
  replacementReason?: string;
  lastCheckedDate?: string;
  checkedBy?: string;
}

interface RoomInventory {
  _id: string;
  roomId: RoomRef | string;
  currentBookingId?: BookingRef | string;
  hotelId: string;
  status: string;
  conditionScore: number;
  maintenanceRequired?: boolean;
  maintenanceNotes?: string;
  lastInspectionDate?: string;
  items?: RoomInventoryItem[];
  isActive?: boolean;
}

interface Statistics {
  roomsNeedingAttention?: number;
  pendingInspections?: number;
  itemsNeedingReplacement?: number;
  completedToday?: number;
  averageConditionScore?: number;
  totalRoomsMonitored?: number;
}

interface AssessmentResult {
  summary?: {
    overallScore?: number;
    totalItems?: number;
    itemsNeedingAttention?: number;
    recommendations?: string[];
  };
  items?: Array<{
    _id?: string;
    name?: string;
    category?: string;
    condition?: string;
    conditionScore?: number;
    needsReplacement?: boolean;
    replacementReason?: string;
  }>;
  roomCondition?: string;
}

interface ReplacementItem {
  _id?: string;
  itemId?: string;
  name?: string;
  category?: string;
  currentCondition?: string;
  replacementReason?: string;
  estimatedCost?: number;
  priority?: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PAGE_LIMIT = 20;

const PRIORITY_COLORS: Record<string, string> = {
  critical: 'bg-red-100 text-red-800 border-red-200',
  urgent: 'bg-red-100 text-red-800 border-red-200',
  high: 'bg-orange-100 text-orange-800 border-orange-200',
  medium: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  low: 'bg-green-100 text-green-800 border-green-200',
};

const STATUS_COLORS: Record<string, string> = {
  clean: 'bg-green-100 text-green-800',
  dirty: 'bg-orange-100 text-orange-800',
  maintenance: 'bg-blue-100 text-blue-800',
  inspection_required: 'bg-purple-100 text-purple-800',
  damaged: 'bg-red-100 text-red-800',
  out_of_order: 'bg-gray-100 text-gray-800',
};

const ROOM_STATUSES = [
  { value: '', label: 'All Statuses' },
  { value: 'clean', label: 'Clean' },
  { value: 'dirty', label: 'Dirty' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'inspection_required', label: 'Inspection Required' },
  { value: 'damaged', label: 'Damaged' },
  { value: 'out_of_order', label: 'Out of Order' },
];

const ROOM_PRIORITIES = [
  { value: '', label: 'All Priorities' },
  { value: 'urgent', label: 'Urgent' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
];

const UPDATABLE_STATUSES = [
  { value: 'clean', label: 'Clean' },
  { value: 'dirty', label: 'Dirty' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'inspection_required', label: 'Inspection Required' },
  { value: 'damaged', label: 'Damaged' },
  { value: 'out_of_order', label: 'Out of Order' },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getRoomNumber(room: RoomRef | string | undefined): string {
  if (!room) return 'N/A';
  if (typeof room === 'string') return room;
  return room.roomNumber || 'N/A';
}

function getRoomId(room: RoomRef | string | undefined): string {
  if (!room) return '';
  if (typeof room === 'string') return room;
  return room._id || '';
}

function getRoomType(room: RoomRef | string | undefined): string {
  if (!room || typeof room === 'string') return '';
  return room.type || '';
}

function getRoomFloor(room: RoomRef | string | undefined): number | undefined {
  if (!room || typeof room === 'string') return undefined;
  return room.floor;
}

function getBookingNumber(booking: BookingRef | string | undefined): string {
  if (!booking) return '';
  if (typeof booking === 'string') return booking;
  return booking.bookingNumber || '';
}

function getBookingId(booking: BookingRef | string | undefined): string {
  if (!booking) return '';
  if (typeof booking === 'string') return booking;
  return booking._id || '';
}

function derivePriority(score: number, maintenanceRequired?: boolean): string {
  if (score < 30 || maintenanceRequired) return 'urgent';
  if (score < 50) return 'high';
  if (score < 70) return 'medium';
  return 'low';
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return 'N/A';
  try {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
}

function conditionScoreColor(score: number): string {
  if (score >= 80) return 'text-green-600';
  if (score >= 60) return 'text-yellow-600';
  if (score >= 40) return 'text-orange-600';
  return 'text-red-600';
}

function conditionScoreBg(score: number): string {
  if (score >= 80) return 'bg-green-500';
  if (score >= 60) return 'bg-yellow-500';
  if (score >= 40) return 'bg-orange-500';
  return 'bg-red-500';
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

function FrontDeskInventoryAutomation() {
  const { selectedPropertyId } = useProperty();

  // Statistics
  const [statistics, setStatistics] = useState<Statistics | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);

  // Rooms list
  const [rooms, setRooms] = useState<RoomInventory[]>([]);
  const [roomsLoading, setRoomsLoading] = useState(true);
  const [roomsError, setRoomsError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Filters
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');

  // Assessment modal
  const [assessmentRoom, setAssessmentRoom] = useState<RoomInventory | null>(null);
  const [assessment, setAssessment] = useState<AssessmentResult | null>(null);
  const [assessmentLoading, setAssessmentLoading] = useState(false);

  // Replacement items modal
  const [replacementRoom, setReplacementRoom] = useState<RoomInventory | null>(null);
  const [replacementItems, setReplacementItems] = useState<ReplacementItem[]>([]);
  const [replacementLoading, setReplacementLoading] = useState(false);

  // Update room status modal
  const [updateRoom, setUpdateRoom] = useState<RoomInventory | null>(null);
  const [updateStatus, setUpdateStatus] = useState('');
  const [updateNotes, setUpdateNotes] = useState('');
  const [updateSubmitting, setUpdateSubmitting] = useState(false);

  // Checkout inspection modal
  const [checkoutModalOpen, setCheckoutModalOpen] = useState(false);
  const [checkoutBookingId, setCheckoutBookingId] = useState('');
  const [checkoutRoomId, setCheckoutRoomId] = useState('');
  const [checkoutCondition, setCheckoutCondition] = useState('normal');
  const [checkoutSubmitting, setCheckoutSubmitting] = useState(false);

  // Track filter changes for page reset
  const prevFilterRef = useRef({ statusFilter, priorityFilter });

  // ---------- Data Fetching ----------

  const fetchStatistics = useCallback(async () => {
    if (!selectedPropertyId) return;
    try {
      setStatsLoading(true);
      const today = new Date().toISOString().split('T')[0];
      const response = await api.get('/inventory-automation/statistics', {
        params: { hotelId: selectedPropertyId, startDate: today, endDate: today },
      });
      setStatistics(response.data?.data?.statistics || null);
    } catch {
      // Statistics are supplementary; do not block the page
    } finally {
      setStatsLoading(false);
    }
  }, [selectedPropertyId]);

  const fetchRooms = useCallback(async () => {
    if (!selectedPropertyId) return;
    try {
      setRoomsLoading(true);
      setRoomsError(null);
      const params: Record<string, string | number> = {
        hotelId: selectedPropertyId,
        page,
        limit: PAGE_LIMIT,
      };
      if (statusFilter) params.status = statusFilter;
      if (priorityFilter) params.priority = priorityFilter;

      const response = await api.get('/inventory-automation/rooms-needing-attention', { params });
      const data = response.data?.data || {};
      setRooms(data.rooms || []);
      setTotalPages(data.totalPages || 1);
      setTotalCount(data.totalCount || 0);
    } catch {
      setRoomsError('Unable to load rooms needing attention. Please try again.');
      setRooms([]);
    } finally {
      setRoomsLoading(false);
    }
  }, [selectedPropertyId, page, statusFilter, priorityFilter]);

  // Reset page when filters change
  useEffect(() => {
    const prev = prevFilterRef.current;
    if (prev.statusFilter !== statusFilter || prev.priorityFilter !== priorityFilter) {
      prevFilterRef.current = { statusFilter, priorityFilter };
      if (page !== 1) {
        setPage(1);
        return; // page change triggers fetchRooms via its own effect
      }
    }
    fetchRooms();
  }, [statusFilter, priorityFilter, page, fetchRooms]);

  useEffect(() => {
    fetchStatistics();
  }, [fetchStatistics]);

  // ---------- Actions ----------

  const handleAssessRoom = async (room: RoomInventory) => {
    const roomId = getRoomId(room.roomId);
    if (!roomId || !selectedPropertyId) return;
    setAssessmentRoom(room);
    setAssessment(null);
    setAssessmentLoading(true);
    try {
      const response = await api.get(`/inventory-automation/assess-room/${roomId}`, {
        params: { hotelId: selectedPropertyId },
      });
      setAssessment(response.data?.data?.assessment || null);
    } catch {
      toast.error('Failed to assess room inventory');
      setAssessmentRoom(null);
    } finally {
      setAssessmentLoading(false);
    }
  };

  const handleViewReplacements = async (room: RoomInventory) => {
    const roomId = getRoomId(room.roomId);
    if (!roomId || !selectedPropertyId) return;
    setReplacementRoom(room);
    setReplacementItems([]);
    setReplacementLoading(true);
    try {
      const response = await api.get(`/inventory-automation/replacement-items/${roomId}`, {
        params: { hotelId: selectedPropertyId },
      });
      setReplacementItems(response.data?.data?.replacementItems || []);
    } catch {
      toast.error('Failed to load replacement items');
      setReplacementRoom(null);
    } finally {
      setReplacementLoading(false);
    }
  };

  const handleOpenUpdateModal = (room: RoomInventory) => {
    setUpdateRoom(room);
    setUpdateStatus(room.status || '');
    setUpdateNotes(room.maintenanceNotes || '');
  };

  const handleUpdateRoomStatus = async () => {
    if (!updateRoom || !selectedPropertyId) return;
    const roomId = getRoomId(updateRoom.roomId);
    if (!roomId) return;
    try {
      setUpdateSubmitting(true);
      await api.put(`/inventory-automation/update-room-status/${roomId}`, {
        status: updateStatus,
        maintenanceNotes: updateNotes || undefined,
      }, {
        params: { hotelId: selectedPropertyId },
      });
      toast.success('Room status updated successfully');
      setUpdateRoom(null);
      fetchRooms();
      fetchStatistics();
    } catch {
      toast.error('Failed to update room status');
    } finally {
      setUpdateSubmitting(false);
    }
  };

  const handleProcessCheckout = async () => {
    if (!checkoutBookingId.trim() || !checkoutRoomId.trim() || !selectedPropertyId) {
      toast.error('Booking ID and Room ID are required');
      return;
    }
    try {
      setCheckoutSubmitting(true);
      await api.post('/inventory-automation/process-checkout', {
        bookingId: checkoutBookingId.trim(),
        roomId: checkoutRoomId.trim(),
        options: { roomCondition: checkoutCondition },
      }, {
        params: { hotelId: selectedPropertyId },
      });
      toast.success('Checkout inventory inspection completed');
      setCheckoutModalOpen(false);
      setCheckoutBookingId('');
      setCheckoutRoomId('');
      setCheckoutCondition('normal');
      fetchRooms();
      fetchStatistics();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      toast.error(axiosErr?.response?.data?.message || 'Failed to process checkout inspection');
    } finally {
      setCheckoutSubmitting(false);
    }
  };

  const handleRefresh = () => {
    fetchRooms();
    fetchStatistics();
  };

  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > totalPages) return;
    setPage(newPage);
  };

  // ---------- Guards ----------

  if (!selectedPropertyId) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <div className="text-center py-16">
          <Package className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">No Property Selected</h2>
          <p className="text-gray-600">Please select a property to view inventory automation.</p>
        </div>
      </div>
    );
  }

  // ---------- Render ----------

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Breadcrumb */}
      <PropertyBreadcrumb
        items={[
          { label: 'Front Desk', href: '/frontdesk' },
          { label: 'Inventory Automation' },
        ]}
      />

      {/* Header */}
      <div className="flex items-center justify-between mb-6 mt-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-1">Inventory Automation</h1>
          <p className="text-gray-600">
            Monitor room inventory conditions and manage checkout inspections
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button onClick={() => setCheckoutModalOpen(true)} className="bg-blue-600 hover:bg-blue-700 text-white">
            <ClipboardCheck className="w-4 h-4 mr-2" />
            Trigger Checkout Inspection
          </Button>
          <Button onClick={handleRefresh} variant="outline" size="sm">
            <RefreshCw className={`w-4 h-4 mr-2 ${roomsLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card className="p-4">
          <div className="flex items-center">
            <div className="p-2 bg-red-100 rounded-lg">
              <ShieldAlert className="w-5 h-5 text-red-600" />
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-600">Needs Attention</p>
              <p className="text-lg font-semibold text-gray-900">
                {statsLoading ? '...' : (statistics?.roomsNeedingAttention ?? totalCount)}
              </p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Eye className="w-5 h-5 text-purple-600" />
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-600">Pending Inspections</p>
              <p className="text-lg font-semibold text-gray-900">
                {statsLoading ? '...' : (statistics?.pendingInspections ?? 0)}
              </p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center">
            <div className="p-2 bg-orange-100 rounded-lg">
              <Wrench className="w-5 h-5 text-orange-600" />
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-600">Replacement Items</p>
              <p className="text-lg font-semibold text-gray-900">
                {statsLoading ? '...' : (statistics?.itemsNeedingReplacement ?? 0)}
              </p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 rounded-lg">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-600">Completed Today</p>
              <p className="text-lg font-semibold text-gray-900">
                {statsLoading ? '...' : (statistics?.completedToday ?? 0)}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="pt-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1">
              <Filter className="w-4 h-4 text-gray-500" />
              <span className="text-sm font-medium text-gray-700">Filters:</span>
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-9 px-3 rounded-md border border-gray-200 text-sm"
            >
              {ROOM_STATUSES.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="h-9 px-3 rounded-md border border-gray-200 text-sm"
            >
              {ROOM_PRIORITIES.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
            {(statusFilter || priorityFilter) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setStatusFilter(''); setPriorityFilter(''); }}
                className="text-gray-500 hover:text-gray-700"
              >
                Clear filters
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Rooms Needing Attention */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Activity className="h-5 w-5 mr-2 text-blue-600" />
            Rooms Needing Attention ({totalCount})
            {roomsLoading && <RefreshCw className="w-4 h-4 ml-2 animate-spin text-gray-400" />}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Error State */}
          {roomsError && rooms.length === 0 && (
            <div className="text-center py-12">
              <AlertTriangle className="mx-auto h-8 w-8 text-red-500 mb-3" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Unable to Load Rooms</h3>
              <p className="text-gray-600 mb-4">{roomsError}</p>
              <Button onClick={fetchRooms} className="flex items-center gap-2 mx-auto">
                <RefreshCw className="h-4 w-4" />
                Try Again
              </Button>
            </div>
          )}

          {/* Loading State */}
          {roomsLoading && rooms.length === 0 && !roomsError && (
            <div className="flex items-center justify-center py-12">
              <LoadingSpinner />
            </div>
          )}

          {/* Empty State */}
          {!roomsLoading && !roomsError && rooms.length === 0 && (
            <div className="text-center py-12">
              <CheckCircle className="mx-auto h-12 w-12 text-green-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">All rooms in good condition</h3>
              <p className="text-gray-500">
                {statusFilter || priorityFilter
                  ? 'No rooms match the current filters. Try adjusting your filters.'
                  : 'No rooms currently need inventory attention.'}
              </p>
            </div>
          )}

          {/* Room List */}
          {rooms.length > 0 && (
            <div className="space-y-3">
              {rooms.map((room) => {
                const priority = derivePriority(room.conditionScore, room.maintenanceRequired);
                const priorityColorClass = PRIORITY_COLORS[priority] || PRIORITY_COLORS.low;
                const statusColorClass = STATUS_COLORS[room.status] || 'bg-gray-100 text-gray-800';
                const roomNumber = getRoomNumber(room.roomId);
                const roomType = getRoomType(room.roomId);
                const floor = getRoomFloor(room.roomId);
                const bookingNum = getBookingNumber(room.currentBookingId);

                return (
                  <div
                    key={room._id}
                    className={`p-4 rounded-lg border ${priorityColorClass} transition-shadow hover:shadow-md`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="font-semibold text-base">Room {roomNumber}</span>
                          {roomType && (
                            <Badge variant="secondary" className="text-xs capitalize">
                              {roomType}
                            </Badge>
                          )}
                          {floor !== undefined && (
                            <span className="text-xs text-gray-500">Floor {floor}</span>
                          )}
                          <Badge className={statusColorClass}>
                            {room.status?.replace(/_/g, ' ') || 'Unknown'}
                          </Badge>
                          <Badge className={`capitalize ${priorityColorClass}`}>
                            {priority}
                          </Badge>
                        </div>

                        <div className="flex flex-wrap gap-4 text-sm text-gray-600 mt-2">
                          <span className="flex items-center gap-1">
                            <Activity className="w-3 h-3" />
                            Condition:{' '}
                            <span className={`font-semibold ${conditionScoreColor(room.conditionScore)}`}>
                              {room.conditionScore}/100
                            </span>
                          </span>
                          {room.maintenanceRequired && (
                            <span className="flex items-center gap-1 text-red-600">
                              <Wrench className="w-3 h-3" />
                              Maintenance Required
                            </span>
                          )}
                          {bookingNum && (
                            <span className="flex items-center gap-1">
                              <FileText className="w-3 h-3" />
                              Booking: {bookingNum}
                            </span>
                          )}
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            Last Inspected: {formatDate(room.lastInspectionDate)}
                          </span>
                        </div>

                        {/* Condition Bar */}
                        <div className="mt-2 w-48">
                          <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${conditionScoreBg(room.conditionScore)}`}
                              style={{ width: `${Math.min(100, Math.max(0, room.conditionScore))}%` }}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex flex-col gap-2 ml-4 shrink-0">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleAssessRoom(room)}
                          className="text-blue-600 border-blue-300 hover:bg-blue-50"
                        >
                          <Eye className="w-3 h-3 mr-1" />
                          Assess
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleViewReplacements(room)}
                          className="text-orange-600 border-orange-300 hover:bg-orange-50"
                        >
                          <Package className="w-3 h-3 mr-1" />
                          Replacements
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleOpenUpdateModal(room)}
                          className="text-purple-600 border-purple-300 hover:bg-purple-50"
                        >
                          <ArrowUpDown className="w-3 h-3 mr-1" />
                          Update
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-4 mt-6 pt-4 border-t">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(page - 1)}
                disabled={page <= 1 || roomsLoading}
              >
                <ChevronLeft className="w-4 h-4 mr-1" />
                Previous
              </Button>
              <span className="text-sm text-gray-600">
                Page {page} of {totalPages} ({totalCount} total)
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(page + 1)}
                disabled={page >= totalPages || roomsLoading}
              >
                Next
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ---- Assessment Modal ---- */}
      <Modal
        isOpen={!!assessmentRoom}
        onClose={() => setAssessmentRoom(null)}
        title={`Room Assessment - ${assessmentRoom ? getRoomNumber(assessmentRoom.roomId) : ''}`}
        size="lg"
      >
        {assessmentLoading ? (
          <div className="flex items-center justify-center py-12">
            <LoadingSpinner />
          </div>
        ) : assessment ? (
          <div>
            {/* Summary */}
            {assessment.summary && (
              <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                <h4 className="font-semibold text-gray-900 mb-3">Summary</h4>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {assessment.summary.overallScore !== undefined && (
                    <div>
                      <p className="text-xs text-gray-500">Overall Score</p>
                      <p className={`text-xl font-bold ${conditionScoreColor(assessment.summary.overallScore)}`}>
                        {assessment.summary.overallScore}/100
                      </p>
                    </div>
                  )}
                  {assessment.summary.totalItems !== undefined && (
                    <div>
                      <p className="text-xs text-gray-500">Total Items</p>
                      <p className="text-xl font-bold text-gray-900">{assessment.summary.totalItems}</p>
                    </div>
                  )}
                  {assessment.summary.itemsNeedingAttention !== undefined && (
                    <div>
                      <p className="text-xs text-gray-500">Need Attention</p>
                      <p className="text-xl font-bold text-orange-600">
                        {assessment.summary.itemsNeedingAttention}
                      </p>
                    </div>
                  )}
                </div>
                {assessment.summary.recommendations && assessment.summary.recommendations.length > 0 && (
                  <div className="mt-4">
                    <p className="text-xs font-medium text-gray-500 mb-1">Recommendations</p>
                    <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
                      {assessment.summary.recommendations.map((rec, idx) => (
                        <li key={idx}>{rec}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* Items */}
            {assessment.items && assessment.items.length > 0 ? (
              <div>
                <h4 className="font-semibold text-gray-900 mb-3">Items ({assessment.items.length})</h4>
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {assessment.items.map((item, idx) => (
                    <div
                      key={item._id || idx}
                      className={`p-3 rounded-lg border ${
                        item.needsReplacement
                          ? 'border-red-200 bg-red-50'
                          : 'border-gray-200 bg-white'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-medium text-gray-900">{item.name || 'Unnamed Item'}</span>
                          {item.category && (
                            <Badge variant="secondary" className="ml-2 text-xs">
                              {item.category}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {item.conditionScore !== undefined && (
                            <span className={`text-sm font-semibold ${conditionScoreColor(item.conditionScore)}`}>
                              {item.conditionScore}/100
                            </span>
                          )}
                          {item.needsReplacement && (
                            <Badge className="bg-red-100 text-red-800 text-xs">
                              Needs Replacement
                            </Badge>
                          )}
                        </div>
                      </div>
                      {item.condition && (
                        <p className="text-xs text-gray-500 mt-1">Condition: {item.condition}</p>
                      )}
                      {item.replacementReason && (
                        <p className="text-xs text-red-600 mt-1">Reason: {item.replacementReason}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-gray-500 text-center py-4">No items found in assessment.</p>
            )}
          </div>
        ) : (
          <p className="text-gray-500 text-center py-8">No assessment data available.</p>
        )}
      </Modal>

      {/* ---- Replacement Items Modal ---- */}
      <Modal
        isOpen={!!replacementRoom}
        onClose={() => setReplacementRoom(null)}
        title={`Replacement Items - Room ${replacementRoom ? getRoomNumber(replacementRoom.roomId) : ''}`}
        size="lg"
      >
        {replacementLoading ? (
          <div className="flex items-center justify-center py-12">
            <LoadingSpinner />
          </div>
        ) : replacementItems.length > 0 ? (
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {replacementItems.map((item, idx) => (
              <div
                key={item._id || item.itemId || idx}
                className="p-4 rounded-lg border border-orange-200 bg-orange-50"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <span className="font-medium text-gray-900">{item.name || 'Unnamed Item'}</span>
                    {item.category && (
                      <Badge variant="secondary" className="ml-2 text-xs">
                        {item.category}
                      </Badge>
                    )}
                    {item.priority && (
                      <Badge className={`ml-2 text-xs ${PRIORITY_COLORS[item.priority] || ''}`}>
                        {item.priority}
                      </Badge>
                    )}
                  </div>
                  {item.estimatedCost !== undefined && item.estimatedCost > 0 && (
                    <span className="text-sm font-semibold text-gray-700">
                      ${item.estimatedCost.toFixed(2)}
                    </span>
                  )}
                </div>
                {item.currentCondition && (
                  <p className="text-xs text-gray-500 mt-1">
                    Current Condition: {item.currentCondition}
                  </p>
                )}
                {item.replacementReason && (
                  <p className="text-xs text-orange-700 mt-1">
                    Reason: {item.replacementReason}
                  </p>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <CheckCircle className="mx-auto h-10 w-10 text-green-400 mb-3" />
            <p className="text-gray-600">No items need replacement for this room.</p>
          </div>
        )}
      </Modal>

      {/* ---- Update Room Status Modal ---- */}
      <Modal
        isOpen={!!updateRoom}
        onClose={() => setUpdateRoom(null)}
        title={`Update Room Status - ${updateRoom ? getRoomNumber(updateRoom.roomId) : ''}`}
        size="md"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Room Status</label>
            <select
              value={updateStatus}
              onChange={(e) => setUpdateStatus(e.target.value)}
              className="w-full h-10 px-3 rounded-md border border-gray-300 text-sm"
            >
              {UPDATABLE_STATUSES.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Maintenance Notes (optional)
            </label>
            <textarea
              value={updateNotes}
              onChange={(e) => setUpdateNotes(e.target.value)}
              className="w-full border border-gray-300 rounded-md p-3 text-sm h-24 resize-none"
              placeholder="Add any maintenance notes or observations..."
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => setUpdateRoom(null)} disabled={updateSubmitting}>
              Cancel
            </Button>
            <Button
              onClick={handleUpdateRoomStatus}
              disabled={updateSubmitting || !updateStatus}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {updateSubmitting ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Updating...
                </>
              ) : (
                'Update Status'
              )}
            </Button>
          </div>
        </div>
      </Modal>

      {/* ---- Checkout Inspection Modal ---- */}
      <Modal
        isOpen={checkoutModalOpen}
        onClose={() => setCheckoutModalOpen(false)}
        title="Trigger Checkout Inspection"
        size="md"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Start an automated inventory assessment for a room during guest checkout.
          </p>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Booking ID</label>
            <Input
              value={checkoutBookingId}
              onChange={(e) => setCheckoutBookingId(e.target.value)}
              placeholder="Enter the booking ID"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Room ID</label>
            <Input
              value={checkoutRoomId}
              onChange={(e) => setCheckoutRoomId(e.target.value)}
              placeholder="Enter the room ID"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Room Condition</label>
            <select
              value={checkoutCondition}
              onChange={(e) => setCheckoutCondition(e.target.value)}
              className="w-full h-10 px-3 rounded-md border border-gray-300 text-sm"
            >
              <option value="normal">Normal</option>
              <option value="dirty">Dirty</option>
              <option value="very_dirty">Very Dirty</option>
              <option value="damaged">Damaged</option>
              <option value="unused">Unused</option>
            </select>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button
              variant="outline"
              onClick={() => setCheckoutModalOpen(false)}
              disabled={checkoutSubmitting}
            >
              Cancel
            </Button>
            <Button
              onClick={handleProcessCheckout}
              disabled={checkoutSubmitting || !checkoutBookingId.trim() || !checkoutRoomId.trim()}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {checkoutSubmitting ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <ClipboardCheck className="w-4 h-4 mr-2" />
                  Start Inspection
                </>
              )}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default withErrorBoundary(FrontDeskInventoryAutomation);
