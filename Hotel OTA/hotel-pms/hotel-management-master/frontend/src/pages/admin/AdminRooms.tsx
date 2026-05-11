import React, { useState, useMemo, useEffect, useCallback, useRef} from 'react';
import { useAuth } from '../../context/AuthContext';
import { useProperty } from '../../context/PropertyContext';
import { PropertyBreadcrumb } from '../../components/common/PropertyBreadcrumb';
import { useAdminRooms, useRoomMetrics, useUpdateRoomStatus, useBulkUpdateStatus } from '../../hooks/useRooms';
import { useBulkCheckIn, useBulkCheckOut, useScheduleHousekeeping, useRequestMaintenance, useUpdateRoomStatus as useWorkflowRoomStatus } from '../../hooks/useWorkflow';
import { MetricCard, RefreshButton, ChartCard, BarChart } from '../../components/dashboard';
import { WorkflowModal } from '../../components/admin/WorkflowModal';
import { PredictiveAnalyticsDashboard } from '../../components/analytics/PredictiveAnalyticsDashboard';
import { PerformanceBenchmarking } from '../../components/analytics/PerformanceBenchmarking';
import { formatPercentage, formatCurrency } from '../../utils/dashboardUtils';
import { Room } from '../../services/roomsService';
import analyticsService, { ProfitabilityData } from '../../services/analyticsService';
import toast from 'react-hot-toast';
import { withErrorBoundary } from '../../components/ErrorBoundary';

const RoomCard = React.memo(({ room, status, isSelected, isChanged, onSelect, onMultiSelect }: {
  room: Room;
  status: string;
  isSelected: boolean;
  isChanged: boolean;
  onSelect: (id: string) => void;
  onMultiSelect: (id: string) => void;
}) => (
  <div role="button" tabIndex={0}
    className={[
      'relative aspect-square rounded-xl border-2 cursor-pointer transition-all duration-300',
      status === 'vacant' ? 'bg-green-500 border-green-600 hover:bg-green-600' :
      status === 'occupied' ? 'bg-red-500 border-red-600 hover:bg-red-600' :
      status === 'reserved' ? 'bg-purple-500 border-purple-600 hover:bg-purple-600' :
      status === 'dirty' ? 'bg-yellow-500 border-yellow-600 hover:bg-yellow-600' :
      status === 'maintenance' ? 'bg-orange-500 border-orange-600 hover:bg-orange-600' :
      status === 'out_of_order' ? 'bg-gray-500 border-gray-600 hover:bg-gray-600' :
      'bg-gray-300 border-gray-400 hover:bg-gray-400',
      isSelected ? 'ring-4 ring-blue-500 ring-offset-2 shadow-xl' : '',
      isChanged ? 'animate-pulse ring-4 ring-yellow-400 shadow-lg' : '',
      'group hover:scale-110 hover:shadow-2xl transform-gpu'
    ].filter(Boolean).join(' ')}
    onClick={(e) => {
      if (e.ctrlKey || e.metaKey) {
        onMultiSelect(room._id);
      } else {
        onSelect(room._id);
      }
    }}
    title={`Click to change status \u2022 Ctrl+Click for bulk selection \u2022 Room ${room.roomNumber} - ${status} - ${room.type} - \u20B9${room.currentRate}`}
   onKeyDown={(e: React.KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); const clickHandler = (e) => {
      if (e.ctrlKey || e.metaKey) {
        onMultiSelect(room._id);
      } else {
        onSelect(room._id);
      }
    }; if (typeof clickHandler === 'function') { clickHandler(e as any); } } }}>
    <div className="absolute inset-0 flex flex-col items-center justify-center text-white font-medium">
      <div className="text-lg mb-1 drop-shadow-lg">
        {room.type === 'suite' ? '\uD83D\uDC51' : room.type === 'deluxe' ? '\u2B50' : room.type === 'double' ? '\uD83D\uDC65' : '\uD83D\uDC64'}
      </div>
      <div className="text-lg font-bold drop-shadow-lg">{room.roomNumber}</div>
      <div className="text-xs opacity-90 mt-1 capitalize">{room.type}</div>
    </div>
    {isSelected && (
      <div className="absolute -top-2 -left-2">
        <div className="w-5 h-5 bg-blue-500 rounded-full border-2 border-white flex items-center justify-center">
          <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
        </div>
      </div>
    )}
  </div>
));
RoomCard.displayName = 'RoomCard';

export function AdminRooms() {
  const { user } = useAuth();
  const { selectedPropertyId } = useProperty();
  const [refreshKey, setRefreshKey] = useState(0);
  const [selectedFloor, setSelectedFloor] = useState<number | null>(null);
  
  // Filter and action states
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [floorFilter, setFloorFilter] = useState<string>('all');
  const [selectedRooms, setSelectedRooms] = useState<Set<string>>(new Set());
  const [showBulkActions, setShowBulkActions] = useState(false);
  const [isPerformingAction, setIsPerformingAction] = useState(false);

  // Real-time integration states
  const [realTimeEnabled, setRealTimeEnabled] = useState(false); // Start disabled to prevent 429 errors
  const [autoRefreshInterval, setAutoRefreshInterval] = useState(120000); // 2 minutes
  const [lastUpdateTime, setLastUpdateTime] = useState<Date | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'reconnecting'>('connected');
  const [changedRooms, setChangedRooms] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<'grid' | 'list' | 'compact'>('grid');

  // Analytics data state
  const [analyticsData, setAnalyticsData] = useState<ProfitabilityData | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  
  // Room status modal states
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [selectedRoomForStatus, setSelectedRoomForStatus] = useState<Room | null>(null);
  
  // Workflow modal states
  const [showWorkflowModal, setShowWorkflowModal] = useState(false);
  const [workflowType, setWorkflowType] = useState<'checkin' | 'checkout' | 'housekeeping' | 'maintenance' | 'status_update'>('checkin');
  const [selectedRoomIds, setSelectedRoomIds] = useState<string[]>([]);
  
  // Analytics view states
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [analyticsView, setAnalyticsView] = useState<'predictive' | 'benchmarking'>('predictive');
  
  // Use PropertyContext's selectedPropertyId
  const hotelId = selectedPropertyId || user?.hotelId || '';
  
  // Helper function to get room status (computed or fallback to static)
  const getRoomStatus = (room: Room) => {
    const status = room.computedStatus || room.status;
    return status;
  };
  
  // Fetch rooms data and metrics with real-time configuration
  const roomsQuery = useAdminRooms({ 
    hotelId,
    limit: 100, // Get more rooms for accurate metrics
    enabled: !!hotelId,
    refetchInterval: realTimeEnabled ? autoRefreshInterval : false,
    staleTime: 0, // Force fresh data on every request
  });
  
  // Disable separate metrics query to reduce API calls since we calculate from rooms data
  const metricsQuery = useRoomMetrics(hotelId, { 
    enabled: false, // Disabled - we calculate metrics from rooms data
  });
  
  // Mutation hooks
  const updateRoomStatus = useUpdateRoomStatus();
  const bulkUpdateStatus = useBulkUpdateStatus();
  
  // Workflow mutation hooks
  const bulkCheckIn = useBulkCheckIn();
  const bulkCheckOut = useBulkCheckOut();
  const scheduleHousekeeping = useScheduleHousekeeping();
  const requestMaintenance = useRequestMaintenance();
  const updateRoomStatusWorkflow = useWorkflowRoomStatus();

  // Fetch analytics data
  const fetchAnalyticsData = useCallback(async () => {
    if (!hotelId) return;

    setAnalyticsLoading(true);
    try {
      const data = await analyticsService.getProfitabilityMetrics('30d');
      setAnalyticsData(data);
    } catch (error) {
      setAnalyticsData(null);
    } finally {
      setAnalyticsLoading(false);
    }
  }, [hotelId]);

  // Fetch analytics data on mount and when rooms data changes
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  useEffect(() => {
    fetchAnalyticsData();
  }, [fetchAnalyticsData, roomsQuery.dataUpdatedAt]);

  // Workflow handlers
  const handleWorkflowAction = (type: 'checkin' | 'checkout' | 'housekeeping' | 'maintenance' | 'status_update', roomIds?: string[]) => {
    const rooms = roomIds || (selectedFloor ? 
      roomsQuery.data?.rooms?.filter(room => room.floor === selectedFloor).map(room => room._id) || [] :
      []
    );
    
    setWorkflowType(type);
    setSelectedRoomIds(rooms);
    setShowWorkflowModal(true);
  };

  const handleWorkflowConfirm = async (data: Record<string, unknown>) => {
    try {
      switch (workflowType) {
        case 'checkin':
          await bulkCheckIn.mutateAsync({
            roomIds: selectedRoomIds,
            guestData: {
              name: data.guestName,
              email: data.email,
              phone: data.phone,
              checkInDate: data.checkInDate,
              checkOutDate: data.checkOutDate,
              specialRequests: data.specialRequests,
            },
            paymentMethod: data.paymentMethod,
            notes: data.notes,
          });
          toast.success('Bulk check-in completed successfully!');
          break;
          
        case 'checkout':
          await bulkCheckOut.mutateAsync({
            roomIds: selectedRoomIds,
            checkoutTime: data.checkoutTime,
            paymentStatus: data.paymentStatus,
            notes: data.notes,
          });
          toast.success('Bulk check-out completed successfully!');
          break;
          
        case 'housekeeping':
          await scheduleHousekeeping.mutateAsync({
            roomIds: selectedRoomIds,
            floorId: selectedFloor || undefined,
            priority: data.priority,
            tasks: data.tasks,
            estimatedDuration: data.estimatedDuration,
            specialInstructions: data.specialInstructions,
          });
          toast.success('Housekeeping scheduled successfully!');
          break;
          
        case 'maintenance':
          await requestMaintenance.mutateAsync({
            roomIds: selectedRoomIds,
            floorId: selectedFloor || undefined,
            issueType: data.issueType,
            priority: data.priority,
            description: data.description,
            estimatedCost: data.estimatedCost,
            scheduledDate: data.scheduledDate,
          });
          toast.success('Maintenance request submitted successfully!');
          break;
          
        case 'status_update':
          await updateRoomStatusWorkflow.mutateAsync({
            roomIds: selectedRoomIds,
            newStatus: data.newStatus,
            reason: data.reason,
            notes: data.notes,
          });
          toast.success('Room status updated successfully!');
          break;
      }
      
      setShowWorkflowModal(false);
    } catch (error) {
      toast.error('Failed to complete workflow action. Please try again.');
    }
  };
  
  const isLoading = roomsQuery.isLoading || metricsQuery.isLoading || analyticsLoading;

  const error = roomsQuery.error || metricsQuery.error;

  // Filter rooms based on selected filters
  const filteredRooms = useMemo(() => {
    let rooms = roomsQuery.data?.rooms || [];
    if (statusFilter !== 'all') {
      rooms = rooms.filter(room => getRoomStatus(room) === statusFilter);
    }
    
    if (typeFilter !== 'all') {
      rooms = rooms.filter(room => room.type === typeFilter);
    }
    
    if (floorFilter !== 'all') {
      rooms = rooms.filter(room => room.floor.toString() === floorFilter);
    }
    
    return rooms;
  }, [roomsQuery.data?.rooms, statusFilter, typeFilter, floorFilter]);

  // Real-time change detection - use a ref to properly track previous state
  const previousRoomsRef = useRef<Room[]>([]);

  // Detect room changes for visual feedback
  useEffect(() => {
    const currentRooms = roomsQuery.data?.rooms || [];
    const prevRooms = previousRoomsRef.current;

    if (prevRooms.length > 0 && currentRooms.length > 0) {
      const newChangedRooms = new Set<string>();

      currentRooms.forEach(currentRoom => {
        const previousRoom = prevRooms.find(r => r._id === currentRoom._id);
        if (previousRoom) {
          const currentStatus = getRoomStatus(currentRoom);
          const previousStatus = getRoomStatus(previousRoom);
          if (previousStatus !== currentStatus) {
            newChangedRooms.add(currentRoom._id);
          }
        }
      });

      if (newChangedRooms.size > 0) {
        setChangedRooms(newChangedRooms);
        setLastUpdateTime(new Date());

        // Clear change indicators after 5 seconds
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => {
          setChangedRooms(new Set());
        }, 5000);
      }
    }

    // Update ref to current rooms AFTER comparison
    previousRoomsRef.current = currentRooms;
  }, [roomsQuery.data?.rooms]);

  // Connection status monitoring
  useEffect(() => {
    const handleOnline = () => setConnectionStatus('connected');
    const handleOffline = () => setConnectionStatus('disconnected');
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    // Set initial status
    setConnectionStatus(navigator.onLine ? 'connected' : 'disconnected');
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Handle query errors for connection status
  useEffect(() => {
    if (roomsQuery.error || metricsQuery.error) {
      setConnectionStatus('disconnected');
    } else if (roomsQuery.isLoading || metricsQuery.isLoading) {
      setConnectionStatus('reconnecting');
    } else {
      setConnectionStatus('connected');
    }
  }, [roomsQuery.error, metricsQuery.error, roomsQuery.isLoading, metricsQuery.isLoading]);

  // Auto-reconnect when back online
  const handleReconnect = useCallback(() => {
    setConnectionStatus('reconnecting');
    roomsQuery.refetch();
    metricsQuery.refetch();
  }, [roomsQuery, metricsQuery]);

  // Calculate metrics from rooms data if metrics API doesn't exist
  const calculateMetrics = () => {
    const rooms = roomsQuery.data?.rooms || [];

    if (rooms.length === 0) {
      return null;
    }

    const totalRooms = rooms.length;
    const occupiedRooms = rooms.filter(r => getRoomStatus(r) === 'occupied').length;
    const reservedRooms = rooms.filter(r => getRoomStatus(r) === 'reserved').length;
    const availableRooms = rooms.filter(r => getRoomStatus(r) === 'vacant').length;
    const maintenanceRooms = rooms.filter(r => getRoomStatus(r) === 'maintenance').length;
    const outOfOrderRooms = rooms.filter(r => getRoomStatus(r) === 'out_of_order').length;
    const dirtyRooms = rooms.filter(r => getRoomStatus(r) === 'dirty').length;

    const metrics = {
      totalRooms,
      occupiedRooms,
      reservedRooms,
      availableRooms,
      maintenanceRooms,
      outOfOrderRooms,
      dirtyRooms,
      occupancyRate: totalRooms > 0 ? Math.round(((occupiedRooms + reservedRooms) / totalRooms) * 100 * 10) / 10 : 0,
      availabilityRate: totalRooms > 0 ? Math.round((availableRooms / totalRooms) * 100 * 10) / 10 : 0,
    };

    return metrics;
  };

  // Always use calculated metrics from real-time rooms data for consistency
  const metrics = calculateMetrics();

  // Calculate floor-wise distribution
  const calculateFloorData = () => {
    const rooms = roomsQuery.data?.rooms || [];

    if (rooms.length === 0) {
      return [];
    }

    const floorMap = new Map();

    rooms.forEach(room => {
      const floor = room.floor;

      if (!floorMap.has(floor)) {
        floorMap.set(floor, {
          floor,
          totalRooms: 0,
          occupied: 0,
          available: 0,
          maintenance: 0,
          outOfOrder: 0,
          dirty: 0,
        });
      }

      const floorData = floorMap.get(floor);
      floorData.totalRooms++;

      const roomStatus = getRoomStatus(room);
      switch (roomStatus) {
        case 'occupied':
          floorData.occupied++;
          break;
        case 'reserved':
          floorData.occupied++;
          break;
        case 'vacant':
          floorData.available++;
          break;
        case 'maintenance':
          floorData.maintenance++;
          break;
        case 'out_of_order':
          floorData.outOfOrder++;
          break;
        case 'dirty':
          floorData.dirty++;
          break;
      }
    });

    // Convert to array and sort by floor number
    const result = Array.from(floorMap.values()).sort((a, b) => a.floor - b.floor);
    return result;
  };

  const floorData = calculateFloorData();
  
  // Debug logging for floorData
  
  // Throttled refresh to prevent API spam
  const [lastRefreshTime, setLastRefreshTime] = useState(0);
  const handleRefresh = () => {
    const now = Date.now();
    // Throttle refresh to once per 5 seconds
    if (now - lastRefreshTime < 5000) {
      return;
    }

    setLastRefreshTime(now);
    setRefreshKey(prev => prev + 1);
    
    // Force invalidate and refetch
    roomsQuery.refetch();
    fetchAnalyticsData();
    // Don't refetch metrics since it's disabled and we calculate from rooms data
  };

  // Room selection handlers
  const handleRoomSelect = (roomId: string) => {
    // For single room click, show status change modal
    const room = roomsQuery.data?.rooms.find(r => r._id === roomId);
    if (room) {
      setSelectedRoomForStatus(room);
      setShowStatusModal(true);
    }
  };

  // Bulk selection handler (for shift+click or bulk actions)
  const handleRoomMultiSelect = (roomId: string) => {
    const newSelection = new Set(selectedRooms);
    if (newSelection.has(roomId)) {
      newSelection.delete(roomId);
    } else {
      newSelection.add(roomId);
    }
    setSelectedRooms(newSelection);
    setShowBulkActions(newSelection.size > 0);
  };

  const handleSelectAll = () => {
    if (selectedRooms.size === filteredRooms.length) {
      setSelectedRooms(new Set());
      setShowBulkActions(false);
    } else {
      setSelectedRooms(new Set(filteredRooms.map(room => room._id)));
      setShowBulkActions(true);
    }
  };

  const handleClearSelection = () => {
    setSelectedRooms(new Set());
    setShowBulkActions(false);
  };

  // Modal handlers
  const handleCloseStatusModal = () => {
    setShowStatusModal(false);
    setSelectedRoomForStatus(null);
  };

  // Handle escape key to close modal
  useEffect(() => {
    const handleEscapeKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && showStatusModal) {
        handleCloseStatusModal();
      }
    };

    if (showStatusModal) {
      document.addEventListener('keydown', handleEscapeKey);
      return () => document.removeEventListener('keydown', handleEscapeKey);
    }
  }, [showStatusModal]);

  // Monitor for rate limit errors and auto-disable real-time updates
  useEffect(() => {
    if ((roomsQuery.error as unknown)?.message?.includes('429') || (roomsQuery.error as unknown)?.message?.includes('Too Many Requests')) {
      setRealTimeEnabled(false);
      setConnectionStatus('disconnected');
    }
  }, [roomsQuery.error]);

  const handleStatusUpdate = async (newStatus: Room['status']) => {
    if (!selectedRoomForStatus) return;

    setIsPerformingAction(true);
    try {
      await updateRoomStatus.mutateAsync({
        id: selectedRoomForStatus._id,
        status: newStatus
      });

      toast.success(`Room ${selectedRoomForStatus.roomNumber} updated to ${newStatus.replace('_', ' ')}`);

      // Close modal and clear selection
      handleCloseStatusModal();
    } catch (error) {
      toast.error(`Failed to update room status: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsPerformingAction(false);
    }
  };

  // Quick action handlers
  const handleQuickStatusUpdate = async (roomId: string, newStatus: Room['status']) => {
    setIsPerformingAction(true);
    try {
      await updateRoomStatus.mutateAsync({ id: roomId, status: newStatus });
      toast.success(`Room status updated to ${newStatus.replace('_', ' ')}`);
    } catch (error) {
      toast.error(`Failed to update room status: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsPerformingAction(false);
    }
  };

  const handleBulkStatusUpdate = async (newStatus: Room['status']) => {
    if (selectedRooms.size === 0) return;

    setIsPerformingAction(true);
    try {
      await bulkUpdateStatus.mutateAsync({
        roomIds: Array.from(selectedRooms),
        status: newStatus
      });
      toast.success(`${selectedRooms.size} room(s) updated to ${newStatus.replace('_', ' ')}`);
      handleClearSelection();
    } catch (error: unknown) {
      toast.error(`Failed to update rooms: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsPerformingAction(false);
    }
  };

  // Reset filters
  const handleResetFilters = () => {
    setStatusFilter('all');
    setTypeFilter('all');
    setFloorFilter('all');
    setSelectedFloor(null);
    handleClearSelection();
  };

  if (error) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <div className="text-red-500 mb-4">
            <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">Failed to load room data</h3>
          <p className="text-gray-500 mb-4">There was an error loading the room information.</p>
          <button 
            onClick={handleRefresh}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6 max-w-7xl mx-auto">
      {/* Breadcrumb */}
      <PropertyBreadcrumb items={['Rooms']} />

      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Room Management</h1>
          <p className="text-gray-600 mt-1 text-sm sm:text-base">Manage and monitor all hotel rooms</p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
          {/* Analytics Toggle */}
          <button aria-label={showAnalytics ? 'Hide analytics panel' : 'Show analytics panel'}
            onClick={() => setShowAnalytics(!showAnalytics)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              showAnalytics
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {showAnalytics ? 'Hide Analytics' : 'Show Analytics'}
          </button>
          
          {/* Real-time Controls */}
          <div className="flex items-center space-x-2 bg-gray-50 rounded-lg p-2">
            {/* Connection Status Indicator */}
            <div className="flex items-center space-x-2">
              <div className={`w-2 h-2 rounded-full ${
                connectionStatus === 'connected' ? 'bg-green-500' : 
                connectionStatus === 'reconnecting' ? 'bg-yellow-500 animate-pulse' : 
                'bg-red-500'
              }`}></div>
              <span className="text-xs text-gray-600">
                {connectionStatus === 'connected' ? 'Live' : 
                 connectionStatus === 'reconnecting' ? 'Reconnecting' : 
                 'Offline'}
              </span>
            </div>

            {/* Real-time Toggle */}
            <label className="flex items-center space-x-1 cursor-pointer">
              <input
                type="checkbox"
                checked={realTimeEnabled}
                onChange={(e) => setRealTimeEnabled(e.target.checked)}
                className="w-3 h-3 text-blue-600 rounded focus:ring-blue-500"
              />
              <span className="text-xs text-gray-600">Real-time</span>
            </label>

            {/* Refresh Interval Selector */}
            {realTimeEnabled && (
              <select
                value={autoRefreshInterval}
                onChange={(e) => setAutoRefreshInterval(Number(e.target.value))}
                className="text-xs border border-gray-300 rounded px-2 py-1 bg-white"
                title="Select refresh interval to prevent rate limits"
              >
                <option value={60000}>1m</option>
                <option value={120000}>2m</option>
                <option value={300000}>5m</option>
                <option value={600000}>10m</option>
              </select>
            )}
          </div>

          {/* Rate Limit Warning */}
          {((roomsQuery.error as unknown)?.message?.includes('429') || (roomsQuery.error as unknown)?.message?.includes('Too Many Requests')) && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-yellow-800">Rate Limit Reached</h3>
                  <div className="mt-2 text-sm text-yellow-700">
                    <p>Too many requests to the server. Real-time updates have been temporarily disabled. Try:</p>
                    <ul className="list-disc list-inside mt-1">
                      <li>Disable real-time updates above</li>
                      <li>Increase refresh interval to 5+ minutes</li>
                      <li>Refresh manually only when needed</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Connection Issues Banner */}
          {connectionStatus === 'disconnected' && (
            <button
              onClick={handleReconnect}
              className="px-3 py-1 text-xs bg-yellow-100 text-yellow-800 rounded-md hover:bg-yellow-200 transition-colors"
            >
              Reconnect
            </button>
          )}

          {/* Last Update Time */}
          {lastUpdateTime && (
            <div className="text-xs text-gray-500">
              Updated {lastUpdateTime.toLocaleTimeString()}
            </div>
          )}

          <RefreshButton
            onRefresh={handleRefresh}
            loading={isLoading}
            lastUpdated={new Date().toISOString()}
            autoRefresh={realTimeEnabled}
            showLastUpdated={false}
          />
        </div>
      </div>

      {/* Phase 5: Filters and Quick Actions */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 sm:p-6">
        <div className="flex flex-col lg:flex-row gap-4 sm:gap-6">
          {/* Filter Section */}
          <div className="flex-1">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Filters</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Status Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="all">All Status</option>
                  <option value="vacant">Available</option>
                  <option value="occupied">Occupied</option>
                  <option value="reserved">Reserved</option>
                  <option value="dirty">Dirty/Cleaning</option>
                  <option value="maintenance">Maintenance</option>
                  <option value="out_of_order">Out of Order</option>
                </select>
              </div>

              {/* Type Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Room Type</label>
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="all">All Types</option>
                  <option value="single">Single</option>
                  <option value="double">Double</option>
                  <option value="suite">Suite</option>
                  <option value="deluxe">Deluxe</option>
                </select>
              </div>

              {/* Floor Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Floor</label>
                <select
                  value={floorFilter}
                  onChange={(e) => setFloorFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="all">All Floors</option>
                  {floorData.map(floor => (
                    <option key={floor.floor} value={floor.floor.toString()}>
                      Floor {floor.floor}
                    </option>
                  ))}
                </select>
              </div>

              {/* Action Buttons */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Actions</label>
                <div className="space-y-2">
                  <button
                    onClick={handleResetFilters}
                    className="w-full px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
                  >
                    Reset Filters
                  </button>
                </div>
              </div>
            </div>

            {/* Filter Results Summary */}
            <div className="mt-4 text-sm text-gray-600">
              Showing {filteredRooms.length} of {roomsQuery.data?.rooms?.length || 0} rooms
              {selectedRooms.size > 0 && (
                <span className="ml-2 text-blue-600">
                  • {selectedRooms.size} selected
                </span>
              )}
            </div>
          </div>

          {/* Quick Actions Section */}
          <div className="lg:w-80">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Quick Actions</h3>
            <div className="space-y-4">
              {/* Selection Controls */}
              <div className="flex space-x-2">
                <button aria-label={selectedRooms.size === filteredRooms.length ? 'Deselect all rooms' : 'Select all rooms'}
                  onClick={handleSelectAll}
                  className="flex-1 px-4 py-2 text-sm bg-blue-50 text-blue-700 rounded-md hover:bg-blue-100 transition-colors"
                >
                  {selectedRooms.size === filteredRooms.length ? 'Deselect All' : 'Select All'}
                </button>
                {selectedRooms.size > 0 && (
                  <button
                    onClick={handleClearSelection}
                    className="px-4 py-2 text-sm bg-gray-50 text-gray-700 rounded-md hover:bg-gray-100 transition-colors"
                  >
                    Clear
                  </button>
                )}
              </div>

              {/* Bulk Status Updates */}
              {showBulkActions && (
                <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <h4 className="text-sm font-medium text-blue-900 mb-3">
                    Bulk Actions ({selectedRooms.size} rooms)
                  </h4>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => handleBulkStatusUpdate('vacant')}
                      disabled={isPerformingAction}
                      className="px-3 py-2 text-xs bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50 transition-colors"
                    >
                      Mark Available
                    </button>
                    <button
                      onClick={() => handleBulkStatusUpdate('dirty')}
                      disabled={isPerformingAction}
                      className="px-3 py-2 text-xs bg-yellow-500 text-white rounded hover:bg-yellow-600 disabled:opacity-50 transition-colors"
                    >
                      Mark Dirty
                    </button>
                    <button
                      onClick={() => handleBulkStatusUpdate('maintenance')}
                      disabled={isPerformingAction}
                      className="px-3 py-2 text-xs bg-orange-500 text-white rounded hover:bg-orange-600 disabled:opacity-50 transition-colors"
                    >
                      Maintenance
                    </button>
                    <button
                      onClick={() => handleBulkStatusUpdate('out_of_order')}
                      disabled={isPerformingAction}
                      className="px-3 py-2 text-xs bg-gray-500 text-white rounded hover:bg-gray-600 disabled:opacity-50 transition-colors"
                    >
                      Out of Order
                    </button>
                  </div>
                  {isPerformingAction && (
                    <div className="mt-2 text-xs text-blue-600">
                      Updating rooms...
                    </div>
                  )}
                </div>
              )}

              {/* Quick Stats for Filtered Data */}
              <div className="p-4 bg-gray-50 rounded-lg">
                <h4 className="text-sm font-medium text-gray-900 mb-2">Filtered Results</h4>
                <div className="space-y-1 text-xs text-gray-600">
                  <div>Available: {filteredRooms.filter(r => getRoomStatus(r) === 'vacant').length}</div>
                  <div>Occupied: {filteredRooms.filter(r => getRoomStatus(r) === 'occupied').length}</div>
                  <div>Reserved: {filteredRooms.filter(r => getRoomStatus(r) === 'reserved').length}</div>
                  <div>Maintenance: {filteredRooms.filter(r => getRoomStatus(r) === 'maintenance').length}</div>
                  <div>Out of Order: {filteredRooms.filter(r => getRoomStatus(r) === 'out_of_order').length}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Phase 1: Room Overview Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-4 sm:gap-6">
        {/* Total Rooms */}
        <MetricCard
          title="Total Rooms"
          value={metrics?.totalRooms || 0}
          icon={
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          }
          color="blue"
          loading={isLoading}
        />

        {/* Available Rooms */}
        <MetricCard
          title="Available"
          value={metrics?.availableRooms || 0}
          trend={{
            value: metrics?.availabilityRate || 0,
            direction: 'up',
            label: 'availability rate'
          }}
          icon={
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
          color="green"
          loading={isLoading}
        />

        {/* Occupied Rooms */}
        <MetricCard
          title="Occupied"
          value={metrics?.occupiedRooms || 0}
          trend={{
            value: metrics?.occupancyRate || 0,
            direction: metrics && metrics.occupancyRate > 70 ? 'up' : 'down',
            label: 'occupancy rate'
          }}
          icon={
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          }
          color="purple"
          loading={isLoading}
        />

        {/* Maintenance Rooms */}
        <MetricCard
          title="Maintenance"
          value={metrics?.maintenanceRooms || 0}
          suffix={metrics?.totalRooms ? ` of ${metrics.totalRooms}` : ''}
          icon={
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          }
          color="orange"
          loading={isLoading}
        />

        {/* Out of Order Rooms */}
        <MetricCard
          title="Out of Order"
          value={metrics?.outOfOrderRooms || 0}
          suffix={metrics?.totalRooms ? ` of ${metrics.totalRooms}` : ''}
          icon={
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 19c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          }
          color="red"
          loading={isLoading}
        />
      </div>

      {/* Phase 2: Floor-wise Distribution Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Floor Distribution Bar Chart */}
        <ChartCard
          title="Rooms by Floor"
          subtitle="Total room count per floor"
          loading={isLoading}
          error={(roomsQuery.error as unknown)?.message || undefined}
          onRefresh={() => roomsQuery.refetch()}
          height="400px"
        >
          {floorData.length > 0 ? (
            <div className="w-full h-[350px] p-4">
              {/* Custom Chart Header */}
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">Rooms by Floor</h3>
                <div className="text-sm text-gray-600">Total: {floorData.reduce((sum, floor) => sum + floor.totalRooms, 0)} rooms</div>
              </div>
              
              {/* Custom Chart */}
              <div className="w-full h-full flex items-end justify-between px-4 pb-8">
                {floorData.map((floor, index) => {
                  const maxRooms = Math.max(...floorData.map(f => f.totalRooms));
                  const barHeight = (floor.totalRooms / maxRooms) * 200; // Max height of 200px
                  
                  return (
                    <div key={floor.floor} className="flex flex-col items-center group">
                      {/* Tooltip */}
                      <div className="absolute -top-12 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity z-10">
                        Floor {floor.floor}: {floor.totalRooms} rooms
                      </div>
                      
                      {/* Bar */}
                      <div role="button" tabIndex={0} 
                        className="w-8 bg-blue-500 hover:bg-blue-600 transition-colors cursor-pointer rounded-t"
                        style={{ height: `${barHeight}px` }}
                        onClick={() => setSelectedFloor(floor.floor)}
                        title={`Floor ${floor.floor}: ${floor.totalRooms} rooms`}
                        onKeyDown={(e: React.KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); const clickHandler = () => setSelectedFloor(floor.floor); if (typeof clickHandler === 'function') { clickHandler(e as any); } } }}
                      />

                      {/* Floor Label */}
                      <span className="text-xs text-gray-600 mt-2 transform -rotate-45 origin-center">
                        F{floor.floor}
                      </span>
                      
                      {/* Room Count */}
                      <span className="text-xs font-medium text-gray-800 mt-1">
                        {floor.totalRooms}
                      </span>
                    </div>
                  );
                })}
              </div>
              
              {/* Quick Actions */}
              <div className="mt-4 flex justify-center space-x-2">
                <button
                  onClick={() => handleWorkflowAction('checkin')}
                  className="px-3 py-1 bg-green-500 text-white text-xs rounded hover:bg-green-600 transition-colors"
                >
                  Bulk Check-in
                </button>
                <button
                  onClick={() => handleWorkflowAction('checkout')}
                  className="px-3 py-1 bg-red-500 text-white text-xs rounded hover:bg-red-600 transition-colors"
                >
                  Bulk Check-out
                </button>
                <button
                  onClick={() => handleWorkflowAction('status_update')}
                  className="px-3 py-1 bg-blue-500 text-white text-xs rounded hover:bg-blue-600 transition-colors"
                >
                  Update Status
                </button>
              </div>
              
              {/* Y-axis labels */}
              <div className="absolute left-2 top-16 bottom-8 flex flex-col justify-between text-xs text-gray-500">
                <span>12</span>
                <span>9</span>
                <span>6</span>
                <span>3</span>
                <span>0</span>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center p-8">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Room Data Available</h3>
              <p className="text-gray-500 mb-4">Unable to load room data for the selected hotel.</p>
              <div className="space-y-2">
                <button
                  onClick={() => roomsQuery.refetch()}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Refresh Data
                </button>
                <button
                  onClick={() => {
                  }}
                  className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors text-sm"
                >
                  Debug Info
                </button>
              </div>
            </div>
          )}
        </ChartCard>

        {/* Floor Status Breakdown */}
        <ChartCard
          title="Floor Status Breakdown"
          subtitle={selectedFloor ? `Floor ${selectedFloor} details` : 'Select a floor to view details'}
          loading={isLoading}
          error={(roomsQuery.error as unknown)?.message}
          onRefresh={() => roomsQuery.refetch()}
          height="400px"
        >
          {selectedFloor ? (
            <div className="p-4">
              {(() => {
                const floor = floorData.find(f => f.floor === selectedFloor);
                if (!floor) return <p className="text-gray-500">No data for selected floor</p>;
                
                const statusData = [
                  { name: 'Available', value: floor.available, color: '#10b981' },
                  { name: 'Occupied', value: floor.occupied, color: '#8b5cf6' },
                  { name: 'Maintenance', value: floor.maintenance, color: '#f97316' },
                  { name: 'Dirty', value: floor.dirty, color: '#eab308' },
                  { name: 'Out of Order', value: floor.outOfOrder, color: '#ef4444' },
                ].filter(item => item.value > 0);

                return (
                  <div className="space-y-4">
                    <div className="text-center mb-6">
                      <h3 className="text-2xl font-bold text-gray-900">Floor {selectedFloor}</h3>
                      <p className="text-gray-600">{floor.totalRooms} total rooms</p>
                    </div>
                    
                    <div className="space-y-3">
                      {statusData.map(item => {
                        const percentage = (item.value / floor.totalRooms) * 100;
                        return (
                          <div key={item.name} className="flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                              <div 
                                className="w-4 h-4 rounded" 
                                style={{ backgroundColor: item.color }}
                              />
                              <span className="font-medium">{item.name}</span>
                            </div>
                            <div className="text-right">
                              <div className="font-bold">{item.value}</div>
                              <div className="text-sm text-gray-500">{percentage.toFixed(1)}%</div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    
                    {/* Floor Actions */}
                    <div className="mt-6 pt-4 border-t space-y-3">
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => handleWorkflowAction('housekeeping')}
                          className="px-3 py-2 bg-blue-500 text-white text-sm rounded hover:bg-blue-600 transition-colors"
                        >
                          Schedule Housekeeping
                        </button>
                        <button
                          onClick={() => handleWorkflowAction('maintenance')}
                          className="px-3 py-2 bg-orange-500 text-white text-sm rounded hover:bg-orange-600 transition-colors"
                        >
                          Request Maintenance
                        </button>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => handleWorkflowAction('checkin')}
                          className="px-3 py-2 bg-green-500 text-white text-sm rounded hover:bg-green-600 transition-colors"
                        >
                          Bulk Check-in
                        </button>
                        <button
                          onClick={() => handleWorkflowAction('checkout')}
                          className="px-3 py-2 bg-red-500 text-white text-sm rounded hover:bg-red-600 transition-colors"
                        >
                          Bulk Check-out
                        </button>
                      </div>
                      
                      <button
                        onClick={() => setSelectedFloor(null)}
                        className="w-full text-blue-600 hover:text-blue-700 text-sm font-medium py-2"
                      >
                        ← Back to all floors
                      </button>
                    </div>
                  </div>
                );
              })()}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center p-8">
              <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                    d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Select a Floor</h3>
              <p className="text-gray-500 mb-4">Click on a floor bar in the chart to see detailed room status breakdown</p>
              {floorData.length > 0 && (
                <div className="text-sm text-gray-400">
                  Available floors: {floorData.map(f => f.floor).join(', ')}
                </div>
              )}
            </div>
          )}
        </ChartCard>
      </div>

      {/* Quick Floor Navigation */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Quick Floor Navigation</h3>
        <div className="flex flex-wrap gap-2">
          {floorData.map(floor => {
            const occupancyRate = floor.totalRooms > 0 ? (floor.occupied / floor.totalRooms) * 100 : 0;
            const isSelected = selectedFloor === floor.floor;
            
            return (
              <button
                key={floor.floor}
                onClick={() => setSelectedFloor(isSelected ? null : floor.floor)}
                className={`px-4 py-2 rounded-lg border transition-all ${
                  isSelected 
                    ? 'bg-blue-50 border-blue-200 text-blue-700' 
                    : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100'
                }`}
              >
                <div className="text-sm font-medium">Floor {floor.floor}</div>
                <div className="text-xs">
                  {floor.occupied}/{floor.totalRooms} occupied
                  <span className="ml-1">({occupancyRate.toFixed(0)}%)</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Phase 3: Revenue Metrics Section */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="mb-6">
          <h2 className="text-xl font-bold text-gray-900">Revenue & Performance Metrics</h2>
          <p className="text-gray-600 mt-1">Key financial and operational indicators</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Average Daily Rate (ADR) */}
          <MetricCard
            title="Average Daily Rate"
            type='currency'
            value={analyticsData?.averageDailyRate || 0}
            icon={
              <div className="w-6 h-6 flex items-center justify-center text-lg font-bold">
                ₹
              </div>
            }
            color="green"
            loading={isLoading}
            trend={{
              value: 12.5,
              direction: 'up',
              label: 'vs last month'
            }}
          />

          {/* Revenue Per Available Room (RevPAR) */}
          <MetricCard
            title="Revenue Per Available Room"
            type='currency'
            value={analyticsData?.revenuePAR || 0}
            icon={
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
              </svg>
            }
            color="blue"
            loading={isLoading}
            trend={{
              value: 8.3,
              direction: 'up',
              label: 'vs last month'
            }}
          />

          {/* Occupancy Rate */}
          <MetricCard
            title="Occupancy Rate"
            type='percentage'
            value={formatPercentage(metrics?.occupancyRate || analyticsData?.occupancyRate || 0)}
            icon={
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            }
            color="purple"
            loading={isLoading}
            trend={{
              value: metrics?.occupancyRate || analyticsData?.occupancyRate || 0,
              direction: (metrics?.occupancyRate || analyticsData?.occupancyRate || 0) > 70 ? 'up' : 'down',
              label: 'target: 80%'
            }}
          />

          {/* Occupancy vs Target */}
          <MetricCard
            title="Occupancy vs Target"
            type="percentage"
            value={`${Math.min(((metrics?.occupancyRate || analyticsData?.occupancyRate || 0) / 80 * 100), 100).toFixed(1)}%`}
            icon={
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            }
            color="orange"
            loading={isLoading}
          />
        </div>

        {/* Revenue breakdown by room type */}
        <div className="mt-8">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Revenue by Room Type</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {analyticsData?.roomTypeProfitability?.map(roomType => {
              const rooms = roomsQuery.data?.rooms || [];
              const typeRooms = rooms.filter(r => r.type === roomType.roomType);
              const typeOccupied = typeRooms.filter(r => getRoomStatus(r) === 'occupied').length;
              const realTimeOccupancy = typeRooms.length > 0 ? Math.round((typeOccupied / typeRooms.length) * 100) : 0;
              return (
              <div key={roomType.roomType} className="bg-gray-50 rounded-lg p-4">
                <div className="text-sm font-medium text-gray-900 capitalize mb-2">
                  {roomType.roomType} Rooms
                </div>
                <div className="space-y-1">
                  <div className="text-xs text-gray-600">
                    {realTimeOccupancy}% occupied ({roomType.roomCount} {roomType.roomCount === 1 ? 'room' : 'rooms'})
                  </div>
                  <div className="text-sm font-medium text-gray-900">
                    Avg Rate: {formatCurrency(roomType.averageRate)}
                  </div>
                  <div className="text-lg font-bold text-green-600">
                    {formatCurrency(roomType.revenue)}
                  </div>
                  <div className="text-xs text-gray-500">daily revenue</div>
                </div>
              </div>
              );
            }) || (
              // Fallback to room calculation if analytics data not available
              ['single', 'double', 'suite', 'deluxe'].map(type => {
                const rooms = roomsQuery.data?.rooms || [];
                const typeRooms = rooms.filter(room => room.type === type);
                const totalRooms = typeRooms.length;
                const occupiedRooms = typeRooms.filter(room => getRoomStatus(room) === 'occupied').length;
                const averageRate = totalRooms > 0
                  ? typeRooms.reduce((sum, room) => sum + (room.currentRate || 0), 0) / totalRooms
                  : 0;
                const dailyRevenue = occupiedRooms * averageRate;

                if (totalRooms === 0) return null;

                return (
                  <div key={type} className="bg-gray-50 rounded-lg p-4">
                    <div className="text-sm font-medium text-gray-900 capitalize mb-2">
                      {type} Rooms
                    </div>
                    <div className="space-y-1">
                      <div className="text-xs text-gray-600">
                        {occupiedRooms}/{totalRooms} occupied
                      </div>
                      <div className="text-sm font-medium text-gray-900">
                        Avg Rate: {formatCurrency(averageRate)}
                      </div>
                      <div className="text-lg font-bold text-green-600">
                        {formatCurrency(dailyRevenue)}
                      </div>
                      <div className="text-xs text-gray-500">daily revenue</div>
                    </div>
                  </div>
                );
              }).filter(Boolean)
            )}
          </div>
        </div>

        {/* Performance indicators */}
        <div className="mt-8 pt-6 border-t border-gray-200">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">
                {formatPercentage(metrics?.availabilityRate || 0)}
              </div>
              <div className="text-sm text-gray-600">Availability Rate</div>
              <div className={`text-xs mt-1 ${(metrics?.availabilityRate || 0) > 20 ? 'text-green-600' : 'text-orange-600'}`}>
                {(metrics?.availabilityRate || 0) > 20 ? 'Good availability' : 'High demand'}
              </div>
            </div>

            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">
                {metrics?.totalRooms ? Math.round((metrics.occupiedRooms / metrics.totalRooms) * 100) : 0}%
              </div>
              <div className="text-sm text-gray-600">Efficiency Rate</div>
              <div className="text-xs mt-1 text-blue-600">
                {metrics?.maintenanceRooms || 0} in maintenance
              </div>
            </div>

            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">
                {formatCurrency(
                  roomsQuery.data?.rooms && roomsQuery.data.rooms.length > 0 && metrics
                    ? (roomsQuery.data.rooms
                        .filter(room => getRoomStatus(room) === 'occupied')
                        .reduce((sum, room) => sum + (room.currentRate || 0), 0))
                    : 0
                )}
              </div>
              <div className="text-sm text-gray-600">Current Daily Revenue</div>
              <div className="text-xs mt-1 text-purple-600">
                from {metrics?.occupiedRooms || 0} occupied {(metrics?.occupiedRooms || 0) === 1 ? 'room' : 'rooms'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Analytics Section */}
      {showAnalytics && (
        <div className="space-y-6">
          {/* Analytics View Toggle */}
          <div className="flex justify-center">
            <div className="bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setAnalyticsView('predictive')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  analyticsView === 'predictive'
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Predictive Analytics
              </button>
              <button
                onClick={() => setAnalyticsView('benchmarking')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  analyticsView === 'benchmarking'
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Performance Benchmarking
              </button>
            </div>
          </div>

          {/* Analytics Content */}
          {analyticsView === 'predictive' ? (
            <PredictiveAnalyticsDashboard 
              hotelId={hotelId} 
              selectedFloor={selectedFloor || undefined}
            />
          ) : (
            <PerformanceBenchmarking 
              hotelId={hotelId} 
              selectedFloor={selectedFloor || undefined}
            />
          )}
        </div>
      )}

      {/* Phase 4: Enhanced Room Status Overview */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
        {/* Header with gradient background */}
        <div className="bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 p-4 sm:p-6 text-white">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold text-white flex items-center">
                <svg className="w-6 h-6 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
                Room Status Overview
              </h2>
              <p className="text-blue-100 mt-2 text-sm">Real-time visual representation of all rooms with live status updates</p>
            </div>
            
            {/* Enhanced View Controls */}
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-3 bg-white/10 backdrop-blur-sm rounded-lg p-2">
                <label className="text-sm font-medium text-white">View Mode:</label>
                <select 
                  value={viewMode} 
                  onChange={(e) => setViewMode(e.target.value as 'grid' | 'list' | 'compact')}
                  className="text-sm bg-white/20 text-white border border-white/30 rounded-md px-3 py-1.5 focus:ring-2 focus:ring-white/50 focus:border-white/50 transition-all duration-200"
                >
                  <option value="grid" className="text-gray-900">Grid View</option>
                  <option value="list" className="text-gray-900">List View</option>
                  <option value="compact" className="text-gray-900">Compact View</option>
                </select>
              </div>
              
              <button aria-label="Refresh"
                onClick={handleRefresh}
                disabled={isLoading}
                className="flex items-center space-x-2 px-4 py-2 bg-white/20 backdrop-blur-sm text-white text-sm rounded-lg hover:bg-white/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 border border-white/30"
              >
                <svg className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <span>{isLoading ? 'Refreshing...' : 'Refresh'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Enhanced Status Legend with modern design */}
        <div className="p-4 sm:p-6 bg-gradient-to-br from-gray-50 via-blue-50 to-indigo-50">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center">
              <svg className="w-5 h-5 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Status Legend
            </h3>
            <div className="text-sm text-gray-600">
              Total: {metrics?.totalRooms || 0} rooms
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
            {[
              { 
                color: 'bg-gradient-to-r from-green-400 to-green-600', 
                borderColor: 'border-green-500',
                icon: '🏠',
                label: 'Available', 
                count: metrics?.availableRooms || 0,
                percentage: metrics?.totalRooms ? ((metrics.availableRooms / metrics.totalRooms) * 100).toFixed(1) : '0'
              },
              {
                color: 'bg-gradient-to-r from-red-400 to-red-600',
                borderColor: 'border-red-500',
                icon: '👥',
                label: 'Occupied',
                count: metrics?.occupiedRooms || 0,
                percentage: metrics?.totalRooms ? ((metrics.occupiedRooms / metrics.totalRooms) * 100).toFixed(1) : '0'
              },
              {
                color: 'bg-gradient-to-r from-purple-400 to-purple-600',
                borderColor: 'border-purple-500',
                icon: '📅',
                label: 'Reserved',
                count: filteredRooms.filter(r => getRoomStatus(r) === 'reserved').length || 0,
                percentage: metrics?.totalRooms ? ((filteredRooms.filter(r => getRoomStatus(r) === 'reserved').length / metrics.totalRooms) * 100).toFixed(1) : '0'
              },
              {
                color: 'bg-gradient-to-r from-yellow-400 to-yellow-600',
                borderColor: 'border-yellow-500',
                icon: '🧹',
                label: 'Dirty / Cleaning',
                count: metrics?.dirtyRooms || 0,
                percentage: metrics?.totalRooms ? ((metrics.dirtyRooms / metrics.totalRooms) * 100).toFixed(1) : '0'
              },
              { 
                color: 'bg-gradient-to-r from-orange-400 to-orange-600', 
                borderColor: 'border-orange-500',
                icon: '🔧',
                label: 'Maintenance', 
                count: metrics?.maintenanceRooms || 0,
                percentage: metrics?.totalRooms ? ((metrics.maintenanceRooms / metrics.totalRooms) * 100).toFixed(1) : '0'
              },
              { 
                color: 'bg-gradient-to-r from-gray-400 to-gray-600', 
                borderColor: 'border-gray-500',
                icon: '🚫',
                label: 'Out of Order', 
                count: metrics?.outOfOrderRooms || 0,
                percentage: metrics?.totalRooms ? ((metrics.outOfOrderRooms / metrics.totalRooms) * 100).toFixed(1) : '0'
              }
            ].map((item, index) => (
              <div key={`-${index}-${item.label}`} className="group relative bg-white rounded-xl border border-gray-200 p-4 hover:shadow-lg hover:scale-105 transition-all duration-300 cursor-pointer">
                <div className="flex items-center space-x-3">
                  <div className={`w-12 h-12 ${item.color} rounded-lg flex items-center justify-center text-white text-xl shadow-lg`}>
                    {item.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-gray-900 truncate">{item.label}</div>
                    <div className="text-lg font-bold text-gray-800">{item.count}</div>
                    <div className="text-xs text-gray-500">{item.percentage}%</div>
                  </div>
                </div>
                <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 to-purple-500/5 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              </div>
            ))}
          </div>
        </div>

        {/* Floor-by-Floor Room Grid */}
        <div className="space-y-4 sm:space-y-6 p-4 sm:p-6">
          {floorData.map(floor => {
            // Get filtered rooms for this floor
            const floorRooms = filteredRooms
              .filter(room => room.floor === floor.floor)
              .sort((a, b) => a.roomNumber.localeCompare(b.roomNumber));

            // Skip floor if no rooms match filters
            if (floorRooms.length === 0) return null;

            const occupancyRate = floor.totalRooms > 0 ? ((floor.occupied / floor.totalRooms) * 100).toFixed(1) : '0';

            return (
              <div key={floor.floor} className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow duration-300 overflow-hidden">
                {/* Floor Header with gradient */}
                <div className="bg-gradient-to-r from-gray-50 to-blue-50 px-4 sm:px-6 py-4 border-b border-gray-200">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div className="flex items-center space-x-4">
                      <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center text-white font-bold text-lg shadow-lg">
                        {floor.floor}
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-gray-900">
                          Floor {floor.floor}
                        </h3>
                        <p className="text-sm text-gray-600">Room Management</p>
                      </div>
                    </div>
                    
                    <div className="flex flex-col sm:flex-row items-start sm:items-center space-y-2 sm:space-y-0 sm:space-x-6">
                      {/* Occupancy Rate */}
                      <div className="flex items-center space-x-3">
                        <div className="text-right">
                          <div className="text-2xl font-bold text-blue-600">{occupancyRate}%</div>
                          <div className="text-xs text-gray-500">Occupancy</div>
                        </div>
                        <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-gradient-to-r from-blue-500 to-purple-600 rounded-full transition-all duration-500"
                            style={{ width: `${occupancyRate}%` }}
                          ></div>
                        </div>
                      </div>
                      
                      {/* Room Stats */}
                      <div className="flex space-x-4 text-sm">
                        <div className="text-center">
                          <div className="font-semibold text-green-600">{floor.available}</div>
                          <div className="text-gray-500">Available</div>
                        </div>
                        <div className="text-center">
                          <div className="font-semibold text-red-600">{floor.occupied}</div>
                          <div className="text-gray-500">Occupied</div>
                        </div>
                        <div className="text-center">
                          <div className="font-semibold text-gray-600">{floor.totalRooms}</div>
                          <div className="text-gray-500">Total</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Enhanced Room Grid */}
                <div className="p-4 sm:p-6">
                  <div className="grid gap-2 sm:gap-3 grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 2xl:grid-cols-12">
                    {floorRooms.map(room => (
                      <RoomCard
                        key={room._id}
                        room={room}
                        status={getRoomStatus(room)}
                        isSelected={selectedRooms.has(room._id)}
                        isChanged={changedRooms.has(room._id)}
                        onSelect={handleRoomSelect}
                        onMultiSelect={handleRoomMultiSelect}
                      />
                    ))}
                  </div>
                </div>

                {/* Floor Summary */}
                <div className="mt-4 pt-3 border-t border-gray-200">
                  <div className="flex items-center justify-between text-sm">
                    <div className="text-gray-600">
                      Occupancy: {floor.totalRooms > 0 ? ((floor.occupied / floor.totalRooms) * 100).toFixed(1) : 0}%
                    </div>
                    <div className="flex space-x-4 text-xs">
                      <span className="text-green-600">Available: {floor.available}</span>
                      <span className="text-red-600">Occupied: {floor.occupied}</span>
                      <span className="text-purple-600">Reserved: {floorRooms.filter(r => getRoomStatus(r) === 'reserved').length}</span>
                      <span className="text-yellow-600">Cleaning: {floor.dirty}</span>
                      <span className="text-orange-600">Maintenance: {floor.maintenance}</span>
                      <span className="text-gray-600">OOO: {floor.outOfOrder}</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Additional Sections */}
      {(changedRooms.size > 0 || connectionStatus !== 'connected') && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="mb-4">
            <h2 className="text-xl font-bold text-gray-900">Real-time Activity</h2>
            <p className="text-gray-600 mt-1">Recent room updates and system status</p>
          </div>

          {/* Activity Feed */}
          <div className="space-y-3">
            {/* Connection Status Updates */}
            {connectionStatus !== 'connected' && (
              <div className={`p-3 rounded-lg border ${
                connectionStatus === 'reconnecting' 
                  ? 'bg-yellow-50 border-yellow-200 text-yellow-800'
                  : 'bg-red-50 border-red-200 text-red-800'
              }`}>
                <div className="flex items-center space-x-2">
                  <div className={`w-2 h-2 rounded-full ${
                    connectionStatus === 'reconnecting' ? 'bg-yellow-500 animate-pulse' : 'bg-red-500'
                  }`}></div>
                  <span className="font-medium">
                    {connectionStatus === 'reconnecting' 
                      ? 'Reconnecting to server...'
                      : 'Connection lost - Click reconnect to restore real-time updates'
                    }
                  </span>
                </div>
              </div>
            )}

            {/* Recent Changes */}
            {changedRooms.size > 0 && (
              <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                    <span className="font-medium text-green-800">
                      {changedRooms.size} room{changedRooms.size > 1 ? 's' : ''} updated
                    </span>
                  </div>
                  <span className="text-xs text-green-600">
                    {lastUpdateTime?.toLocaleTimeString()}
                  </span>
                </div>
                <div className="mt-2 text-sm text-green-700">
                  Rooms with status changes are highlighted with yellow indicators
                </div>
              </div>
            )}

            {/* Real-time Settings Summary */}
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className={`w-2 h-2 rounded-full ${
                    realTimeEnabled ? 'bg-blue-500' : 'bg-gray-500'
                  }`}></div>
                  <span className="font-medium text-blue-800">
                    Real-time updates: {realTimeEnabled ? 'Enabled' : 'Disabled'}
                  </span>
                </div>
                {realTimeEnabled && (
                  <span className="text-xs text-blue-600">
                    Refreshing every {autoRefreshInterval / 1000}s
                  </span>
                )}
              </div>
              {!realTimeEnabled && (
                <div className="mt-2 text-sm text-blue-700">
                  Enable real-time updates in the header controls for live data
                </div>
              )}
            </div>

            {/* Data Freshness Indicator */}
            <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
              <div className="flex items-center justify-between">
                <span className="font-medium text-gray-800">Data Freshness</span>
                <div className="text-right">
                  <div className="text-sm text-gray-600">
                    Rooms: {roomsQuery.dataUpdatedAt ? new Date(roomsQuery.dataUpdatedAt).toLocaleTimeString() : 'Loading...'}
                  </div>
                  <div className="text-xs text-gray-500">
                    Metrics: {metricsQuery.dataUpdatedAt ? new Date(metricsQuery.dataUpdatedAt).toLocaleTimeString() : 'Loading...'}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Performance Stats */}
          <div className="mt-6 pt-4 border-t border-gray-200">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              <div>
                <div className="text-lg font-bold text-gray-900">
                  {filteredRooms.length}
                </div>
                <div className="text-xs text-gray-600">Rooms Displayed</div>
              </div>
              <div>
                <div className="text-lg font-bold text-gray-900">
                  {changedRooms.size}
                </div>
                <div className="text-xs text-gray-600">Recent Updates</div>
              </div>
              <div>
                <div className="text-lg font-bold text-gray-900">
                  {autoRefreshInterval / 1000}s
                </div>
                <div className="text-xs text-gray-600">Refresh Rate</div>
              </div>
              <div>
                <div className={`text-lg font-bold ${
                  connectionStatus === 'connected' ? 'text-green-600' : 
                  connectionStatus === 'reconnecting' ? 'text-yellow-600' : 'text-red-600'
                }`}>
                  {connectionStatus === 'connected' ? '✓' : connectionStatus === 'reconnecting' ? '⟲' : '✗'}
                </div>
                <div className="text-xs text-gray-600">Connection</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Debug Information (temporary) */}
      

      {/* Room Status Change Modal */}
      {showStatusModal && selectedRoomForStatus && (
        <div aria-hidden="true" 
          className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50"
          onClick={handleCloseStatusModal}
        >
          <div
            role="dialog"
            aria-modal="true"
            className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mt-3">
              {/* Modal Header */}
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">
                  Change Room Status
                </h3>
                <button aria-label="Close"
                  onClick={handleCloseStatusModal}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Room Information */}
              <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center text-white font-bold text-lg shadow-lg">
                    {selectedRoomForStatus.type === 'suite' ? '👑' : 
                     selectedRoomForStatus.type === 'deluxe' ? '⭐' : 
                     selectedRoomForStatus.type === 'double' ? '👥' : '👤'}
                  </div>
                  <div>
                    <h4 className="text-xl font-bold text-gray-900">
                      Room {selectedRoomForStatus.roomNumber}
                    </h4>
                    <p className="text-sm text-gray-600 capitalize">
                      {selectedRoomForStatus.type} • Floor {selectedRoomForStatus.floor}
                    </p>
                    <p className="text-sm text-gray-600">
                      Rate: {formatCurrency(selectedRoomForStatus.currentRate)}
                    </p>
                  </div>
                </div>
                
                <div className="mt-3 flex items-center space-x-2">
                  <span className="text-sm font-medium text-gray-700">Current Status:</span>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    getRoomStatus(selectedRoomForStatus) === 'vacant' ? 'bg-green-100 text-green-800' :
                    getRoomStatus(selectedRoomForStatus) === 'occupied' ? 'bg-red-100 text-red-800' :
                    getRoomStatus(selectedRoomForStatus) === 'reserved' ? 'bg-orange-100 text-orange-800' :
                    getRoomStatus(selectedRoomForStatus) === 'dirty' ? 'bg-yellow-100 text-yellow-800' :
                    getRoomStatus(selectedRoomForStatus) === 'maintenance' ? 'bg-orange-100 text-orange-800' :
                    getRoomStatus(selectedRoomForStatus) === 'out_of_order' ? 'bg-gray-100 text-gray-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {getRoomStatus(selectedRoomForStatus) === 'vacant' ? 'Available' :
                     getRoomStatus(selectedRoomForStatus) === 'occupied' ? 'Occupied' :
                     getRoomStatus(selectedRoomForStatus) === 'reserved' ? 'Reserved' :
                     getRoomStatus(selectedRoomForStatus) === 'dirty' ? 'Dirty/Cleaning' :
                     getRoomStatus(selectedRoomForStatus) === 'maintenance' ? 'Maintenance' :
                     getRoomStatus(selectedRoomForStatus) === 'out_of_order' ? 'Out of Order' :
                     'Unknown'}
                  </span>
                </div>

                {selectedRoomForStatus.currentBooking && (
                  <div className="mt-3 p-2 bg-blue-50 border border-blue-200 rounded">
                    <p className="text-xs text-blue-800 font-medium">Current Booking</p>
                    <p className="text-xs text-blue-700">
                      Check-in: {new Date(selectedRoomForStatus.currentBooking.checkIn).toLocaleDateString()}
                    </p>
                    <p className="text-xs text-blue-700">
                      Check-out: {new Date(selectedRoomForStatus.currentBooking.checkOut).toLocaleDateString()}
                    </p>
                  </div>
                )}
              </div>

              {/* Status Options */}
              <div className="mb-6">
                <p className="text-sm font-medium text-gray-700 mb-3">Select New Status:</p>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => handleStatusUpdate('vacant')}
                    disabled={isPerformingAction || getRoomStatus(selectedRoomForStatus) === 'vacant'}
                    className="flex items-center justify-center p-3 border-2 border-green-300 rounded-lg hover:border-green-500 hover:bg-green-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <div className="text-center">
                      <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center text-white text-sm font-bold mx-auto mb-1">
                        ✓
                      </div>
                      <span className="text-sm font-medium text-green-700">Available</span>
                    </div>
                  </button>

                  <button
                    onClick={() => handleStatusUpdate('dirty')}
                    disabled={isPerformingAction || getRoomStatus(selectedRoomForStatus) === 'dirty'}
                    className="flex items-center justify-center p-3 border-2 border-yellow-300 rounded-lg hover:border-yellow-500 hover:bg-yellow-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <div className="text-center">
                      <div className="w-8 h-8 bg-yellow-500 rounded-full flex items-center justify-center text-white text-sm font-bold mx-auto mb-1">
                        🧹
                      </div>
                      <span className="text-sm font-medium text-yellow-700">Dirty/Cleaning</span>
                    </div>
                  </button>

                  <button
                    onClick={() => handleStatusUpdate('maintenance')}
                    disabled={isPerformingAction || getRoomStatus(selectedRoomForStatus) === 'maintenance'}
                    className="flex items-center justify-center p-3 border-2 border-orange-300 rounded-lg hover:border-orange-500 hover:bg-orange-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <div className="text-center">
                      <div className="w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center text-white text-sm font-bold mx-auto mb-1">
                        🔧
                      </div>
                      <span className="text-sm font-medium text-orange-700">Maintenance</span>
                    </div>
                  </button>

                  <button
                    onClick={() => handleStatusUpdate('out_of_order')}
                    disabled={isPerformingAction || getRoomStatus(selectedRoomForStatus) === 'out_of_order'}
                    className="flex items-center justify-center p-3 border-2 border-gray-300 rounded-lg hover:border-gray-500 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <div className="text-center">
                      <div className="w-8 h-8 bg-gray-500 rounded-full flex items-center justify-center text-white text-sm font-bold mx-auto mb-1">
                        🚫
                      </div>
                      <span className="text-sm font-medium text-gray-700">Out of Order</span>
                    </div>
                  </button>
                </div>
              </div>

              {/* Note about occupied status */}
              {getRoomStatus(selectedRoomForStatus) === 'occupied' && (
                <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-xs text-blue-800">
                    <strong>Note:</strong> This room is currently occupied. Changing status may affect active bookings.
                  </p>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex justify-between">
                <button
                  onClick={() => {
                    // Navigate to room details page
                    window.location.href = `/admin/rooms/${selectedRoomForStatus._id}`;
                  }}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                >
                  <div className="flex items-center space-x-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                    <span>View Details</span>
                  </div>
                </button>
                <button
                  onClick={handleCloseStatusModal}
                  disabled={isPerformingAction}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-200 border border-gray-300 rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>

              {/* Loading indicator */}
              {isPerformingAction && (
                <div className="mt-4 flex items-center justify-center">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                  <span className="ml-2 text-sm text-gray-600">Updating status...</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Workflow Modal */}
      <WorkflowModal
        isOpen={showWorkflowModal}
        onClose={() => setShowWorkflowModal(false)}
        type={workflowType}
        roomIds={selectedRoomIds}
        floorId={selectedFloor || undefined}
        onConfirm={handleWorkflowConfirm}
        loading={bulkCheckIn.isPending || bulkCheckOut.isPending || scheduleHousekeeping.isPending || requestMaintenance.isPending || updateRoomStatusWorkflow.isPending}
      />

    </div>
  );
}

export default withErrorBoundary(AdminRooms, { level: 'page' });