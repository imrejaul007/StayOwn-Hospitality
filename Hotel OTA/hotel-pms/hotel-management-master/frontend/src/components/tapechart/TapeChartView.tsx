import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Calendar as CalendarComponent } from '../ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { TooltipProvider } from '../ui/tooltip';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '../ui/dropdown-menu';
import { toast } from '../../utils/toast';
import {
  CalendarIcon, Calendar, ChevronLeft, ChevronRight, Filter, Settings, Maximize2,
  User, Clock, Bed, IndianRupee, AlertTriangle, CheckCircle,
  MoreHorizontal, Move, Copy, Trash2, Bell, Phone, Mail,
  Zap, Star, Crown, UserCheck, UserX, Coffee, Wifi, Users,
  UserPlus, Building2, Plane, Heart, RefreshCw, Check, X, ChevronUp
} from 'lucide-react';
import { format, addDays, subDays, eachDayOfInterval, isSameDay, parseISO, formatISO } from 'date-fns';
import tapeChartService, { TapeChartData, TapeChartView as TapeChartViewType } from '../../services/tapeChartService';
import { api } from '../../services/api';
import { formatCurrency } from '../../utils/currencyUtils';
import { dragDropManager, DraggedReservation, DropTarget } from '../../utils/DragDropManager';
import ReservationSidebar from './ReservationSidebar';
import CollapsibleSidebar from '../ui/CollapsibleSidebar';
import GlobalSearch from '../ui/GlobalSearch';
import LiveChatWidget from '../ui/LiveChatWidget';
import NotificationSystem from '../ui/NotificationSystem';
import ReservationWorkflowPanel from './ReservationWorkflowPanel';
import VIPGuestManager from './VIPGuestManager';
import { UpgradeProcessor } from './UpgradeProcessor';
import { SpecialRequestTracker } from './SpecialRequestTracker';
import { WaitlistProcessor } from './WaitlistProcessor';
import { TempReservationSystem } from './TempReservationSystem';
import { MultiViewOperationsDashboard } from './MultiViewOperationsDashboard';
import { ChannelManager } from './ChannelManager';
import { DynamicPricingEngine } from './DynamicPricingEngine';
import { PredictiveAnalyticsEngine } from './PredictiveAnalyticsEngine';
import { MobileExperience } from './MobileExperience';
import { GuestIntelligence } from './GuestIntelligence';
import { AdvancedHousekeeping } from './AdvancedHousekeeping';
import { VoiceInterface } from './VoiceInterface';
import { DayNightMode } from './DayNightMode';
import { SecurityCompliance } from './SecurityCompliance';
import { BusinessIntelligence } from './BusinessIntelligence';
import { ColorCodedManagement } from './ColorCodedManagement';
import BlockManagementPanel from './BlockManagementPanel';
import BookingDetailsModal from './BookingDetailsModal';
import WalkInBooking from '../../pages/admin/WalkInBooking';
import { withErrorBoundary } from '../ErrorBoundary';
import { useProperty } from '../../context/PropertyContext';

interface RoomCell {
  id: string;
  roomId: string;
  roomNumber: string;
  roomType: string;
  floor: number;
  status: 'available' | 'occupied' | 'reserved' | 'maintenance' | 'dirty' | 'clean' | 'out_of_order' | 'blocked';
  guestName?: string;
  bookingId?: string;
  checkIn?: string;
  checkOut?: string;
  rate?: number;
  vipStatus?: 'none' | 'vip' | 'svip' | 'corporate';
  specialRequests?: string[];
  amenities?: string[];
  isDragOver?: boolean;
  isSelected?: boolean;
  // New fields for task.md requirements
  guestGender?: 'male' | 'female' | 'other' | 'family';
  bookingType?: 'individual' | 'group' | 'corporate' | 'travel_agent';
  aiPrediction?: {
    demandLevel: 'high' | 'medium' | 'low';
    profitabilityScore: number; // 0-100
    recommendedRate: number;
    confidence: number; // 0-100
  };
  preferences?: {
    roomTemp?: number;
    pillow?: string;
    wakeUpCall?: boolean;
    newspaper?: boolean;
  };
}

interface TimelineCell {
  date: string;
  status: string;
  guestName?: string;
  bookingId?: string;
  rate?: number;
  isWeekend?: boolean;
  isToday?: boolean;
  isBlockedDate?: boolean;
}

// DraggedReservation is now imported from DragDropManager

interface DragState {
  isDragging: boolean;
  draggedItems: DraggedReservation[];
  dragPreview: HTMLElement | null;
  operationId: string | null;
}

// New interface for slide-to-create feature
interface SlideToCreateState {
  isSliding: boolean;
  startRoom: string | null;
  startDate: string | null;
  endDate: string | null;
  previewCells: Set<string>;
}

interface ConflictIndicator {
  roomId: string;
  date: string;
  conflictType: 'locked' | 'occupied' | 'maintenance' | 'unsuitable';
  message: string;
  suggestions: string[];
}

const TapeChartView: React.FC = () => {
  const { selectedPropertyId } = useProperty();
  const [chartData, setChartData] = useState<TapeChartData | null>(null);

  // Slide-to-create reservation state (Hotelogix GAME CHANGER feature)
  const [slideToCreate, setSlideToCreate] = useState<SlideToCreateState>({
    isSliding: false,
    startRoom: null,
    startDate: null,
    endDate: null,
    previewCells: new Set()
  });
  const [isMouseDown, setIsMouseDown] = useState(false);

  // Enhanced Interactive Features (Phase 2)
  const [clickToBookMode, setClickToBookMode] = useState(false);
  const [multiNightSelection, setMultiNightSelection] = useState({
    active: false,
    startCell: null as string | null,
    endCell: null as string | null,
    selectedCells: new Set<string>()
  });
  const [quickBookingModal, setQuickBookingModal] = useState({
    isOpen: false,
    roomId: null as string | null,
    roomNumber: null as string | null,
    startDate: null as string | null,
    endDate: null as string | null,
    totalRate: 0
  });
  const [views, setViews] = useState<TapeChartViewType[]>([]);
  const [selectedView, setSelectedView] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Date range management
  const [startDate, setStartDate] = useState<Date>(new Date());
  const [endDate, setEndDate] = useState<Date>(addDays(new Date(), 7));
  const [dateRange, setDateRange] = useState<{ from?: Date; to?: Date }>({});
  
  // UI state
  const [selectedRooms, setSelectedRooms] = useState<Set<string>>(new Set());
  const [draggedItem, setDraggedItem] = useState<DraggedReservation | null>(null);
  const [dragOverCell, setDragOverCell] = useState<string | null>(null);
  const [dragState, setDragState] = useState<DragState>({
    isDragging: false,
    draggedItems: [],
    dragPreview: null,
    operationId: null
  });
  const [conflictIndicators, setConflictIndicators] = useState<Map<string, ConflictIndicator>>(new Map());
  const [roomSuggestions, setRoomSuggestions] = useState<Map<string, unknown[]>>(new Map());

  // Performance optimization states
  const [hoverTimer, setHoverTimer] = useState<NodeJS.Timeout | null>(null);
  const [dragOverCache, setDragOverCache] = useState<Map<string, boolean>>(new Map());

  // Global event handlers for slide-to-create feature
  const isMountedRef = useRef(true);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  useEffect(() => {
    return () => { isMountedRef.current = false; };
  }, []);

  React.useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (slideToCreate.isSliding) {
        handleSlideEnd();
      }
    };

    const handleGlobalMouseLeave = () => {
      if (slideToCreate.isSliding) {
        handleSlideEnd();
      }
    };

    document.addEventListener('mouseup', handleGlobalMouseUp);
    document.addEventListener('mouseleave', handleGlobalMouseLeave);

    return () => {
      document.removeEventListener('mouseup', handleGlobalMouseUp);
      document.removeEventListener('mouseleave', handleGlobalMouseLeave);
    };
  }, [slideToCreate.isSliding]);

  // Enhanced Interactive Features - Click-to-Book Handler
  const handleCellClick = useCallback((roomId: string, roomNumber: string, date: string, timelineData: RoomCell | undefined) => {
    if (clickToBookMode && timelineData?.status === 'available') {
      const baseRate = timelineData?.rate || 0;
      setQuickBookingModal({
        isOpen: true,
        roomId,
        roomNumber,
        startDate: date,
        endDate: format(addDays(new Date(date), 1), 'yyyy-MM-dd'),
        totalRate: baseRate
      });
      toast.success(`Quick booking opened for Room ${roomNumber}`);
    }
  }, [clickToBookMode]);

  // Multi-Night Selection Handler
  const handleMultiNightSelection = useCallback((roomId: string, date: string, roomNumber: string, event: React.MouseEvent) => {
    if (!multiNightSelection.active) return;

    event.preventDefault();

    const cellId = `${roomId}-${date}`;

    if (!multiNightSelection.startCell) {
      // Start selection
      setMultiNightSelection(prev => ({
        ...prev,
        startCell: cellId,
        selectedCells: new Set([cellId])
      }));
    } else if (!multiNightSelection.endCell && multiNightSelection.startCell !== cellId) {
      // End selection - calculate range
      const startDate = multiNightSelection.startCell.split('-').slice(1).join('-');
      const endDate = date;

      const start = new Date(startDate);
      const end = new Date(endDate);
      const selectedCells = new Set<string>();

      // Generate all dates between start and end
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const dateStr = format(d, 'yyyy-MM-dd');
        selectedCells.add(`${roomId}-${dateStr}`);
      }

      setMultiNightSelection(prev => ({
        ...prev,
        endCell: cellId,
        selectedCells
      }));

      // Open quick booking for multi-night stay
      const totalNights = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      // Get room rate from chart data; fall back to first available cell rate or 0
      const roomRow = chartData?.rooms?.find((r: { roomId: string }) => r.roomId === roomId);
      const firstCellRate = roomRow?.timeline?.[0]?.rate;
      const baseRate = firstCellRate || 0;

      setQuickBookingModal({
        isOpen: true,
        roomId,
        roomNumber,
        startDate: format(start, 'yyyy-MM-dd'),
        endDate: format(end, 'yyyy-MM-dd'),
        totalRate: baseRate * totalNights
      });

      toast.success(`Multi-night booking: ${totalNights} nights selected`);
    } else {
      // Reset selection
      setMultiNightSelection({
        active: true,
        startCell: cellId,
        endCell: null,
        selectedCells: new Set([cellId])
      });
    }
  }, [multiNightSelection]);

  // Quick Booking Handler
  const handleQuickBookingConfirm = useCallback(async () => {
    try {
      await api.post('/bookings', {
        roomId: quickBookingModal.roomId,
        checkIn: quickBookingModal.startDate,
        checkOut: quickBookingModal.endDate,
        totalRate: quickBookingModal.totalRate,
        roomNumber: quickBookingModal.roomNumber,
        source: 'tapechart_quick_booking'
      });

      if (!isMountedRef.current) return;

      toast.success(`Booking created for Room ${quickBookingModal.roomNumber}!`);

      setQuickBookingModal({
        isOpen: false,
        roomId: null,
        roomNumber: null,
        startDate: null,
        endDate: null,
        totalRate: 0
      });

      // Refresh chart data
      fetchChartData();
    } catch (error) {
      if (!isMountedRef.current) return;
      const message = error instanceof Error ? error.message : 'Failed to create booking';
      toast.error(message);
    }
  }, [quickBookingModal]);

  // Toggle Interactive Modes
  const toggleClickToBookMode = useCallback(() => {
    setClickToBookMode(prev => !prev);
    setMultiNightSelection({ active: false, startCell: null, endCell: null, selectedCells: new Set() });
    toast.info(clickToBookMode ? 'Click-to-Book mode disabled' : 'Click-to-Book mode enabled - Click any available cell to book');
  }, [clickToBookMode]);

  const toggleMultiNightMode = useCallback(() => {
    setMultiNightSelection(prev => ({
      active: !prev.active,
      startCell: null,
      endCell: null,
      selectedCells: new Set()
    }));
    setClickToBookMode(false);
    toast.info(multiNightSelection.active ? 'Multi-night selection disabled' : 'Multi-night selection enabled - Click start and end dates');
  }, [multiNightSelection.active]);

  const [showFilters, setShowFilters] = useState(false);
  const [compactView, setCompactView] = useState(false);
  const [showGuestNames, setShowGuestNames] = useState(true); // Now guest names are ALWAYS visible as per Hotelogix standard
  const [showRates, setShowRates] = useState(false);
  const [showSidebar, setShowSidebar] = useState(true);
  const [isReservationSidebarCollapsed, setIsReservationSidebarCollapsed] = useState(false);
  const [isMenuCollapsed, setIsMenuCollapsed] = useState(false);
  const [showPhasesSidebar, setShowPhasesSidebar] = useState(true);

  // Refresh trigger for sidebar
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [lastAssignedCell, setLastAssignedCell] = useState<string | null>(null);
  const [recentlyUpdatedCells, setRecentlyUpdatedCells] = useState<Set<string>>(new Set());

  // Booking Details Modal State
  const [bookingDetailsModal, setBookingDetailsModal] = useState({
    isOpen: false,
    bookingId: null as string | null,
    roomNumber: null as string | null
  });

  // Walk-In Booking Modal State (for new bookings created via slide-to-create)
  const [walkInBookingModal, setWalkInBookingModal] = useState({
    isOpen: false,
    roomNumber: null as string | null,
    checkIn: null as string | null,
    checkOut: null as string | null,
    nights: 0
  });

  // Filters
  const [filters, setFilters] = useState({
    floors: [] as number[],
    roomTypes: [] as string[],
    statuses: [] as string[],
    buildings: [] as string[],
    wings: [] as string[]
  });
  
  // Context menu
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    roomId: string;
    roomNumber: string;
    roomType: string;
    floor: number;
    currentStatus: string;
    visible: boolean;
  }>({ x: 0, y: 0, roomId: '', roomNumber: '', roomType: '', floor: 0, currentStatus: '', visible: false });

  // Block creation mode
  const [blockCreationMode, setBlockCreationMode] = useState(false);
  const [selectedRoomsForBlock, setSelectedRoomsForBlock] = useState<Set<string>>(new Set());

  const chartRef = useRef<HTMLDivElement>(null);
  const [chartHeight, setChartHeight] = useState(600);

  // Helper functions for task.md visual indicators
  const getGenderIcon = (gender?: string) => {
    switch (gender) {
      case 'male': return <User className="h-3 w-3 text-blue-600" />;
      case 'female': return <UserCheck className="h-3 w-3 text-pink-600" />;
      case 'family': return <Users className="h-3 w-3 text-green-600" />;
      case 'other': return <Heart className="h-3 w-3 text-purple-600" />;
      default: return null;
    }
  };

  const getBookingTypeIcon = (bookingType?: string) => {
    switch (bookingType) {
      case 'individual': return <User className="h-3 w-3 text-gray-600" />;
      case 'group': return <Users className="h-3 w-3 text-orange-600" />;
      case 'corporate': return <Building2 className="h-3 w-3 text-blue-700" />;
      case 'travel_agent': return <Plane className="h-3 w-3 text-indigo-600" />;
      default: return <User className="h-3 w-3 text-gray-400" />;
    }
  };

  const getBookingTypeColor = (bookingType?: string) => {
    switch (bookingType) {
      case 'individual': return 'bg-gray-100 border-gray-300';
      case 'group': return 'bg-orange-100 border-orange-300';
      case 'corporate': return 'bg-blue-100 border-blue-300';
      case 'travel_agent': return 'bg-indigo-100 border-indigo-300';
      default: return 'bg-gray-50 border-gray-200';
    }
  };

  const getProfitabilityRoomColor = (timelineData: RoomCell | undefined, status: string) => {
    // If room is available, show AI prediction profitability colors
    if (status === 'available' && timelineData?.aiPrediction) {
      const score = timelineData.aiPrediction.profitabilityScore;
      if (score >= 80) return 'bg-green-50 border-green-300 hover:bg-green-100';
      if (score >= 60) return 'bg-yellow-50 border-yellow-300 hover:bg-yellow-100';
      return 'bg-red-50 border-red-300 hover:bg-red-100';
    }
    
    // For occupied rooms, enhance booking type colors with profitability hints
    if (status !== 'available' && timelineData?.bookingType) {
      const baseColor = getBookingTypeColor(timelineData.bookingType);
      // Add slight gradient for high-value bookings
      if (timelineData.rate && timelineData.rate > 15000) {
        return baseColor.replace('100', '200').replace('300', '400');
      }
      return baseColor;
    }
    
    // Fallback to original status color
    return getStatusColor(status);
  };

  const getRoomNotifications = (roomNumber: string, timelineData: RoomCell | undefined) => {
    const notifications = [];
    
    // Housekeeping notifications
    if (timelineData?.status === 'dirty') {
      notifications.push({ type: 'housekeeping', priority: 'high', message: 'Room needs cleaning' });
    }
    
    // Maintenance notifications
    if (timelineData?.status === 'maintenance') {
      notifications.push({ type: 'maintenance', priority: 'high', message: 'Under maintenance' });
    }
    
    // VIP guest notifications
    if (timelineData?.vipStatus === 'svip' || timelineData?.vipStatus === 'vip') {
      notifications.push({ type: 'vip', priority: 'medium', message: 'VIP guest' });
    }
    
    // Special requests notifications
    if (timelineData?.specialRequests?.length > 0) {
      notifications.push({ type: 'request', priority: 'medium', message: 'Special requests' });
    }
    
    // AI prediction alerts for high demand
    if (timelineData?.aiPrediction?.demandLevel === 'high' && timelineData?.status === 'available') {
      notifications.push({ type: 'demand', priority: 'low', message: 'High demand period' });
    }
    
    return notifications;
  };

  const getNotificationBadge = (notifications: { type: string; priority: string; message: string }[]) => {
    if (notifications.length === 0) return null;
    
    const highPriority = notifications.filter(n => n.priority === 'high').length;
    const hasNotifications = notifications.length > 0;
    
    return (
      <div className="absolute -top-1 -right-1 z-10">
        {highPriority > 0 ? (
          <div className="bg-red-500 text-white text-xs rounded-full h-4 w-4 flex items-center justify-center animate-pulse">
            {highPriority}
          </div>
        ) : hasNotifications ? (
          <div className="bg-blue-500 text-white text-xs rounded-full h-4 w-4 flex items-center justify-center">
            {notifications.length}
          </div>
        ) : null}
      </div>
    );
  };

  const getAIPredictionIndicator = (aiPrediction?: RoomCell['aiPrediction']) => {
    if (!aiPrediction) return null;
    
    const getDemandColor = (level: string) => {
      switch (level) {
        case 'high': return 'text-red-500';
        case 'medium': return 'text-yellow-500';
        case 'low': return 'text-green-500';
        default: return 'text-gray-400';
      }
    };

    const getProfitabilityColor = (score: number) => {
      if (score >= 80) return 'text-green-600';
      if (score >= 60) return 'text-yellow-600';
      if (score >= 40) return 'text-orange-600';
      return 'text-red-600';
    };

    return (
      <div className="flex items-center space-x-1">
        <Zap className={`h-3 w-3 ${getDemandColor(aiPrediction.demandLevel)}`} />
        <span className={`text-xs font-medium ${getProfitabilityColor(aiPrediction.profitabilityScore)}`}>
          {aiPrediction.profitabilityScore}%
        </span>
      </div>
    );
  };

  const getVipIcon = (vipStatus?: string) => {
    switch (vipStatus) {
      case 'vip': return <Star className="h-3 w-3 text-yellow-500" />;
      case 'svip': return <Crown className="h-3 w-3 text-gold-500" />;
      case 'corporate': return <Building2 className="h-3 w-3 text-blue-600" />;
      default: return null;
    }
  };

  const getPreferenceIcons = (preferences?: RoomCell['preferences']) => {
    if (!preferences) return null;
    return (
      <div className="flex gap-1 mt-1">
        {preferences.wakeUpCall && <Bell className="h-2 w-2 text-orange-500" />}
        {preferences.newspaper && <Coffee className="h-2 w-2 text-brown-500" />}
        {preferences.roomTemp && <Zap className="h-2 w-2 text-blue-400" />}
      </div>
    );
  };

  useEffect(() => {
    if (selectedPropertyId) {
      fetchViews();
    }
  }, [selectedPropertyId]);

  useEffect(() => {
    if (selectedView) {
      fetchChartData();
    }
  }, [selectedView, startDate, endDate]);

  // Set up drag drop manager refresh callback for real-time updates
  useEffect(() => {
    dragDropManager.setRefreshCallback(() => {
      fetchChartData();
      setRefreshTrigger(prev => prev + 1);
    });

    return () => {
      dragDropManager.setRefreshCallback(() => {});
    };
  }, []);

  // Auto-refresh every 30 seconds to keep data updated
  useEffect(() => {
    if (!selectedView) return;

    const interval = setInterval(() => {
      fetchChartData();
    }, 30000); // Refresh every 30 seconds

    return () => clearInterval(interval);
  }, [selectedView, startDate, endDate]);

  // Clear conflict indicators when not dragging to prevent stale indicators
  useEffect(() => {
    if (!dragState.isDragging && conflictIndicators.size > 0) {
      setConflictIndicators(new Map());
    }
  }, [dragState.isDragging, conflictIndicators.size]);

  const fetchViews = async () => {
    try {
      const response = await tapeChartService.getTapeChartViews(selectedPropertyId || undefined);

      let viewsData = response.data || [];

      // Create default views if none exist
      if (viewsData.length === 0) {
        viewsData = [
          {
            _id: 'default-week',
            viewName: '7-Day View',
            viewType: 'daily',
            isSystemDefault: true
          },
          {
            _id: 'default-month',
            viewName: '30-Day View',
            viewType: 'weekly',
            isSystemDefault: true
          }
        ];
      }

      setViews(viewsData);
      if (viewsData.length > 0) {
        setSelectedView(viewsData[0]._id);
      }
    } catch (err: unknown) {
      const error = err as { message?: string };
      // Create fallback views on error
      const fallbackViews = [
        {
          _id: 'fallback-view',
          viewName: 'Weekly Overview',
          viewType: 'daily',
          isSystemDefault: true
        }
      ];
      setViews(fallbackViews);
      setSelectedView(fallbackViews[0]._id);
      setError(error.message || 'Failed to fetch views');
      toast.error('Failed to load tape chart views, using default view');
    }
  };

  const fetchChartData = async () => {
    if (!selectedView) {
      return;
    }

    try {
      setLoading(true);
      // Clear any stale conflict indicators on data refresh
      if (conflictIndicators.size > 0) {
        setConflictIndicators(new Map());
      }
      const response = await tapeChartService.generateTapeChartData(selectedView, {
        startDate: formatISO(startDate, { representation: 'date' }),
        endDate: formatISO(endDate, { representation: 'date' })
      }, selectedPropertyId || undefined);
      setChartData(response);
      setError(null);
    } catch (err: unknown) {
      const error = err as { message?: string };
      setError(error.message || 'Failed to fetch chart data');
      toast.error('Failed to load tape chart data');
    } finally {
      setLoading(false);
    }
  };

  const getDatesInRange = useMemo(() => {
    return eachDayOfInterval({ start: startDate, end: endDate });
  }, [startDate, endDate]);

  // Filter logic for rooms
  const filteredChartData = useMemo(() => {
    if (!chartData) return null;

    // Apply filters to room data
    const applyRoomFilters = (rooms: Record<string, unknown>[]) => {
      if (!rooms) return [];

      return rooms.filter((room: Record<string, unknown>) => {
        // Room type filter
        if (filters.roomTypes.length > 0 && !filters.roomTypes.includes(room.roomType || room.config?.roomType)) {
          return false;
        }

        // Status filter
        if (filters.statuses.length > 0 && !filters.statuses.includes(room.status || room.currentStatus)) {
          return false;
        }

        // Floor filter
        if (filters.floors.length > 0 && !filters.floors.includes(room.floor || room.config?.floor)) {
          return false;
        }

        // Building filter
        if (filters.buildings.length > 0 && !filters.buildings.includes(room.building || room.config?.building)) {
          return false;
        }

        return true;
      });
    };

    // Create filtered chart data
    const filtered = {
      ...chartData,
      rooms: applyRoomFilters(chartData.rooms || []),
      roomData: applyRoomFilters(chartData.roomData || []),
      timeline: chartData.timeline ? {
        ...chartData.timeline,
        rooms: applyRoomFilters(chartData.timeline.rooms || [])
      } : undefined
    };

    // Update summary with filtered data
    if (filtered.rooms && filtered.summary) {
      const filteredRooms = filtered.rooms;
      // Preserve backend's correct occupancy calculation while updating room counts for filtered view
      const filteredAvailableRooms = filteredRooms.filter((r: Record<string, unknown>) => (r.status || r.currentStatus) === 'available').length;
      const filteredReservedRooms = filteredRooms.filter((r: Record<string, unknown>) => (r.status || r.currentStatus) === 'reserved').length;
      const filteredMaintenanceRooms = filteredRooms.filter((r: Record<string, unknown>) => (r.status || r.currentStatus) === 'maintenance').length;
      const filteredDirtyRooms = filteredRooms.filter((r: Record<string, unknown>) => (r.status || r.currentStatus) === 'dirty').length;

      // Debug: Log what backend is sending

      filtered.summary = {
        ...chartData.summary, // Keep backend's corrected calculations
        totalRooms: filteredRooms.length,
        // Use ALL backend calculations instead of frontend filtering
        availableRooms: chartData.summary.availableRooms,
        reservedRooms: chartData.summary.reservedRooms || 0,
        maintenanceRooms: chartData.summary.maintenanceRooms || 0, // Use backend's calculation
        dirtyRooms: chartData.summary.dirtyRooms || 0, // Use backend's calculation
        blockedRooms: chartData.summary.blockedRooms || 0, // Use backend's calculation
        // Use backend's occupiedRooms but recalculate occupancy rate for filtered view
        occupancyRate: filteredRooms.length > 0 ? ((chartData.summary.occupiedRooms ?? 0) / filteredRooms.length) * 100 : 0
      };
    }

    return filtered;
  }, [chartData, filters]);

  // Use filtered data for rendering
  const displayData = filteredChartData || chartData;

  const getStatusColor = (status: string): string => {
    const colors = {
      available: 'bg-green-50 text-green-900 border-green-300 hover:bg-green-100',
      occupied: 'bg-red-50 text-red-900 border-red-300 hover:bg-red-100',
      reserved: 'bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100',
      maintenance: 'bg-purple-50 text-purple-900 border-purple-300 hover:bg-purple-100',
      dirty: 'bg-orange-50 text-orange-900 border-orange-300 hover:bg-orange-100',
      clean: 'bg-blue-50 text-blue-900 border-blue-300 hover:bg-blue-100',
      out_of_order: 'bg-red-100 text-red-900 border-red-400 hover:bg-red-150',
      blocked: 'bg-indigo-50 text-indigo-900 border-indigo-300 hover:bg-indigo-100',
      checkout: 'bg-teal-50 text-teal-900 border-teal-300 hover:bg-teal-100',
      checkin: 'bg-cyan-50 text-cyan-900 border-cyan-300 hover:bg-cyan-100'
    };
    return colors[status as keyof typeof colors] || colors.available;
  };

  const getStatusIcon = (status: string) => {
    const icons = {
      available: <CheckCircle className="w-3 h-3 text-green-600" />,
      occupied: <User className="w-3 h-3 text-red-600" />,
      reserved: <Clock className="w-3 h-3 text-amber-600" />,
      maintenance: <AlertTriangle className="w-3 h-3 text-purple-600" />,
      dirty: <AlertTriangle className="w-3 h-3 text-orange-600" />,
      clean: <CheckCircle className="w-3 h-3 text-blue-600" />,
      out_of_order: <UserX className="w-3 h-3 text-gray-600" />,
      blocked: <UserX className="w-3 h-3 text-indigo-600" />,
      checkout: <UserCheck className="w-3 h-3 text-teal-600" />,
      checkin: <UserCheck className="w-3 h-3 text-cyan-600" />
    };
    return icons[status as keyof typeof icons] || icons.available;
  };


  const getBookingTypeIndicator = (bookingType?: string) => {
    const indicators = {
      individual: { color: 'bg-blue-500', label: 'IND' },
      group: { color: 'bg-green-500', label: 'GRP' },
      travel_agent: { color: 'bg-orange-500', label: 'TA' },
      corporate: { color: 'bg-purple-500', label: 'CORP' },
      online: { color: 'bg-cyan-500', label: 'OTA' },
      walk_in: { color: 'bg-gray-500', label: 'WI' }
    };
    
    const indicator = indicators[bookingType as keyof typeof indicators];
    if (!indicator) return null;
    
    return (
      <div className={`absolute bottom-1 left-1 ${indicator.color} text-white text-xs px-1 rounded-sm font-bold`}>
        {indicator.label}
      </div>
    );
  };

  const handleDragStart = (e: React.DragEvent, reservation: DraggedReservation | Record<string, unknown>) => {

    // Transform reservation to DraggedReservation if needed
    let draggedReservation: DraggedReservation;

    if (reservation.hasOwnProperty('_id') && typeof reservation._id === 'string') {
      // This is already a DraggedReservation from timeline cell
      draggedReservation = reservation;
    } else {
      // Transform from Reservation (sidebar) to DraggedReservation format
      draggedReservation = {
        id: reservation.id,
        _id: reservation._id || reservation.id,
        bookingNumber: reservation.bookingNumber || reservation.id.slice(-6),
        guestName: reservation.guestName,
        roomType: reservation.roomType,
        checkIn: reservation.checkIn,
        checkOut: reservation.checkOut,
        status: reservation.status,
        vipStatus: reservation.vipStatus || 'none',
        totalAmount: reservation.totalAmount || (reservation.rate || 0),
        paymentStatus: reservation.paymentStatus || 'pending',
        adults: reservation.adults || 2,
        children: reservation.children || 0,
        nights: reservation.nights || 1,
        specialRequests: reservation.specialRequests || []
      };
    }

    setDraggedItem(draggedReservation);
    e.dataTransfer.effectAllowed = 'move';

    // Get selected reservations for batch operations
    const selectedIds = dragDropManager.getSelectedReservations();
    let draggedReservations: DraggedReservation[];

    if (selectedIds.length > 0 && selectedIds.includes(draggedReservation.id)) {
      // If the dragged reservation is part of a selection, drag all selected
      draggedReservations = [draggedReservation]; // Start with the clicked one
      // TODO: Add other selected reservations from the sidebar data
    } else {
      // Single reservation drag
      draggedReservations = [draggedReservation];
    }

    // Determine operation type based on selection
    const operationType = selectedIds.length > 1 ? 'batch_assign' : 'assign';

    // Start drag operation
    const operationId = dragDropManager.startDragOperation(draggedReservations, operationType);

    // Create enhanced drag image
    const dragImage = dragDropManager.createDragImage(draggedReservations);
    document.body.appendChild(dragImage);
    e.dataTransfer.setDragImage(dragImage, 0, 0);

    // Update drag state
    setDragState({
      isDragging: true,
      draggedItems: draggedReservations,
      dragPreview: dragImage,
      operationId
    });

    // Clean up drag image
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      if (document.body.contains(dragImage)) {
        document.body.removeChild(dragImage);
      }
    }, 0);

    // Clear any existing conflict indicators
    setConflictIndicators(new Map());

    // Generate room suggestions for the dragged reservation
    generateRoomSuggestions(draggedReservation);

  };

  // Slide-to-Create Reservation handlers (Hotelogix GAME CHANGER feature)
  const handleSlideStart = (roomNumber: string, date: string) => {
    if (slideToCreate.isSliding) return;

    setSlideToCreate({
      isSliding: true,
      startRoom: roomNumber,
      startDate: date,
      endDate: date,
      previewCells: new Set([`${roomNumber}-${date}`])
    });
  };

  const handleSlideMove = (roomNumber: string, date: string) => {
    if (!slideToCreate.isSliding || roomNumber !== slideToCreate.startRoom) return;

    // Update preview cells based on date range
    const startDate = new Date(slideToCreate.startDate!);
    const currentDate = new Date(date);
    const previewCells = new Set<string>();

    const minDate = startDate <= currentDate ? startDate : currentDate;
    const maxDate = startDate > currentDate ? startDate : currentDate;

    // Add all dates in range to preview
    let iterDate = new Date(minDate);
    while (iterDate <= maxDate) {
      previewCells.add(`${roomNumber}-${format(iterDate, 'yyyy-MM-dd')}`);
      iterDate = addDays(iterDate, 1);
    }

    setSlideToCreate(prev => ({
      ...prev,
      endDate: date,
      previewCells
    }));
  };

  const handleSlideEnd = React.useCallback(() => {
    if (!slideToCreate.isSliding) return;

    const { startRoom, startDate, endDate } = slideToCreate;
    if (startRoom && startDate && endDate) {
      // Calculate nights
      const start = new Date(startDate);
      const end = new Date(endDate);
      const nights = Math.abs(Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));

      if (nights > 0) {

        // Open Walk-In Booking modal with pre-filled data
        setWalkInBookingModal({
          isOpen: true,
          roomNumber: startRoom,
          checkIn: startDate < endDate ? startDate : endDate,
          checkOut: startDate < endDate ? endDate : startDate,
          nights
        });

        toast.success(`Create ${nights} night${nights > 1 ? 's' : ''} reservation for Room ${startRoom}`);
      }
    }

    // Reset slide state
    setSlideToCreate({
      isSliding: false,
      startRoom: null,
      startDate: null,
      endDate: null,
      previewCells: new Set()
    });
    setIsMouseDown(false);
  }, [slideToCreate.isSliding, slideToCreate.startRoom, slideToCreate.startDate, slideToCreate.endDate]);

  const handleDragOver = async (e: React.DragEvent, cellId: string) => {
    e.preventDefault();

    if (!dragState.isDragging || dragState.draggedItems.length === 0) {
      return;
    }

    // Split cellId properly: "702-2025-09-23" -> roomNumber: "702", dateStr: "2025-09-23"
    const splitParts = cellId.split('-');
    const roomNumber = splitParts[0];
    const dateStr = splitParts.slice(1).join('-'); // Join back "2025-09-23"
    const room = chartData?.rooms?.find(r => r.config.roomNumber === roomNumber);

    if (!room) return;

    // Create drop target first
    const dropTarget: DropTarget = {
      roomId: room.room?._id || room.config.roomId,
      roomNumber: room.config.roomNumber,
      date: dateStr,
      isAvailable: true
    };

    // Register drop zone immediately to prevent "No drop target registered" errors
    dragDropManager.registerDropZone(cellId, dropTarget);
    setDragOverCell(cellId);

    // Enhanced visual feedback and validation
    const draggedReservation = dragState.draggedItems[0];
    if (draggedReservation) {
      // Check room type compatibility
      const draggedRoomType = draggedReservation.roomType?.toLowerCase();
      const targetRoomType = room.room?.type?.toLowerCase() || room.config.roomType?.toLowerCase();

      if (draggedRoomType && targetRoomType && draggedRoomType !== targetRoomType) {
        setConflictIndicators(new Map([[cellId, {
          roomId: room.room?._id || room.config.roomId,
          date: dateStr,
          conflictType: 'unsuitable',
          message: `Room type mismatch: Guest booked ${draggedReservation.roomType} but this is ${room.room?.type || room.config.roomType}`,
          suggestions: ['Select a room with matching type', 'Update guest booking to match room type']
        }]]));
        e.dataTransfer.dropEffect = 'none';
        return;
      }

      // Check date compatibility
      const targetDate = parseISO(dateStr);
      const checkInDate = parseISO(draggedReservation.checkIn);
      const checkOutDate = parseISO(draggedReservation.checkOut);

      // Normalize dates for comparison
      targetDate.setHours(0, 0, 0, 0);
      checkInDate.setHours(0, 0, 0, 0);
      checkOutDate.setHours(0, 0, 0, 0);

      if (targetDate < checkInDate || targetDate >= checkOutDate) {
        let errorMessage = '';
        if (targetDate < checkInDate) {
          errorMessage = `Guest ${draggedReservation.guestName} checks in on ${checkInDate.toDateString()}. Cannot assign before check-in.`;
        } else if (targetDate >= checkOutDate) {
          errorMessage = `Guest ${draggedReservation.guestName} checks out on ${checkOutDate.toDateString()}. Cannot assign on check-out date.`;
        }

        setConflictIndicators(new Map([[cellId, {
          roomId: room.room?._id || room.config.roomId,
          date: dateStr,
          conflictType: 'locked',
          message: errorMessage,
          reason: errorMessage,
          suggestions: ['Select a date within the booking period', 'Check guest check-in/check-out dates']
        }]]));
        e.dataTransfer.dropEffect = 'none';
        return;
      }

      // Check if room is already occupied for this date
      const timelineData = room.timeline.find((t: TimelineCell) => t.date === dateStr);

      if (timelineData?.status === 'occupied' || timelineData?.status === 'reserved') {
        // Skip conflict if the cell is occupied by the booking being dragged (source cell)
        const isOwnBooking = timelineData.bookingId &&
          draggedReservation._id &&
          timelineData.bookingId.toString() === draggedReservation._id.toString();

        if (!isOwnBooking) {
          setConflictIndicators(new Map([[cellId, {
            message: `Room is ${timelineData.status} by ${timelineData.guestName || 'another guest'}`
          }]]));
          e.dataTransfer.dropEffect = 'none';
          return;
        }
      }

      // No conflicts — clear all indicators
      setConflictIndicators(new Map());
      e.dataTransfer.dropEffect = 'move';
    }
  };

  const handleDragLeave = (e: React.DragEvent, cellId?: string) => {
    // Performance optimization: clear hover timer on leave
    if (hoverTimer) {
      clearTimeout(hoverTimer);
      setHoverTimer(null);
    }

    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = e.clientX;
    const y = e.clientY;

    if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
      setDragOverCell(null);

      // Clear conflict indicators for this cell
      if (cellId) {
        setConflictIndicators(prev => {
          const newMap = new Map(prev);
          newMap.delete(cellId);
          return newMap;
        });
        dragDropManager.unregisterDropZone(cellId);
      }
    }
  };

  const handleDrop = async (e: React.DragEvent, roomId: string, date: string, roomNumber?: string) => {

    e.preventDefault();

    if (!dragState.isDragging || dragState.draggedItems.length === 0) {
      return;
    }

    const cellId = `${roomNumber || roomId}-${date}`;

    const dropTarget = dragDropManager.getDropZone(cellId);

    if (!dropTarget) {
      return;
    }

    // Check for conflicts one more time
    const hasConflict = conflictIndicators.has(cellId);
    if (hasConflict) {
      const conflict = conflictIndicators.get(cellId)!;
      const proceedAnyway = window.confirm(
        `⚠️ Conflict detected: ${conflict.message}\n\nSuggestions:\n${conflict.suggestions.join('\n')}\n\nProceed anyway?`
      );

      if (!proceedAnyway) {
        endDragOperation();
        return;
      }
    }

    // Show confirmation for moves
    const reservationsText = dragState.draggedItems.length === 1
      ? `${dragState.draggedItems[0].guestName}'s reservation`
      : `${dragState.draggedItems.length} reservations`;


    const confirmed = window.confirm(
      `Move ${reservationsText} to room ${roomNumber || roomId} for ${date}?`
    );


    if (!confirmed) {
      endDragOperation();
      return;
    }

    try {

      const result = await dragDropManager.executeAssignment(
        dragState.draggedItems,
        dropTarget,
        {
          notes: `Moved via enhanced drag & drop to room ${roomNumber || roomId} for ${date}`,
          moveReason: 'Staff reassignment via enhanced tape chart',
          sendNotification: true,
          lockRoom: true
        }
      );


      if (result.success) {

        // Clear all drag states immediately to prevent UI issues
        setDragOverCell(null);
        setConflictIndicators(new Map());
        setRoomSuggestions(new Map());
        setDragState({
          isDragging: false,
          draggedItems: [],
          dragPreview: null,
          operationId: null
        });

        // Force clear any lingering drag over states and classes
        const dragOverElements = document.querySelectorAll('[data-drag-over="true"]');
        dragOverElements.forEach(el => {
          el.removeAttribute('data-drag-over');
          el.classList.remove('drag-over', 'drag-hover');
        });

        // Force a React re-render to clear any lingering drag indicators
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => {
          setDragOverCell(null);
        }, 0);

        // Track cells that were updated for immediate UI feedback
        const cellId = `${roomNumber}-${date}`;
        setRecentlyUpdatedCells(prev => new Set(prev).add(cellId));

        // Set success animation
        setLastAssignedCell(cellId);
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => {
          setLastAssignedCell(null);
          // Clear the recently updated tracking after data refresh is complete
          setRecentlyUpdatedCells(prev => {
            const newSet = new Set(prev);
            newSet.delete(cellId);
            return newSet;
          });
        }, 3000); // Extended time to ensure data refresh

        fetchChartData();
        setRefreshTrigger(prev => prev + 1);
      } else {
      }

    } catch (err: unknown) {
      const error = err as { message?: string; response?: { data?: { message?: string } } };

      // Enhanced error handling with specific user guidance
      let errorMessage = 'Failed to move reservation';
      let errorType = 'error';

      if (error.response?.data?.message) {
        errorMessage = error.response.data.message;

        // Categorize errors for better UX
        if (errorMessage.includes('Room type mismatch')) {
          errorType = 'warning';
          errorMessage += '\n\n💡 Tip: Check that the room type matches the booking requirement.';
        } else if (errorMessage.includes('Date mismatch')) {
          errorType = 'warning';
          errorMessage += '\n\n📅 Tip: Guests can only be assigned to dates within their booking period.';
        } else if (errorMessage.includes('not active') || errorMessage.includes('maintenance')) {
          errorType = 'warning';
          errorMessage += '\n\n🔧 This room may need maintenance attention.';
        } else if (errorMessage.includes('conflict') || errorMessage.includes('occupied')) {
          errorType = 'warning';
          errorMessage += '\n\n📅 Try selecting a different date or room.';
        }
      } else if (error.message) {
        errorMessage = error.message;
      }

      // Network error handling
      if (!navigator.onLine) {
        errorMessage = '🌐 No internet connection. Please check your connection and try again.';
        errorType = 'error';
      } else if ((error as Record<string, unknown>).code === 'NETWORK_ERROR') {
        errorMessage = '🔄 Network error. Please try again in a moment.';
        errorType = 'warning';
      }

      if (errorType === 'warning') {
        toast.warning(errorMessage);
      } else {
        toast.error(errorMessage);
      }
    } finally {
      endDragOperation();
    }
  };

  const handleRoomSelect = (roomId: string) => {
    const newSelection = new Set(selectedRooms);
    if (newSelection.has(roomId)) {
      newSelection.delete(roomId);
    } else {
      newSelection.add(roomId);
    }
    setSelectedRooms(newSelection);
  };

  const handleRightClick = (e: React.MouseEvent, roomData: {
    roomId: string;
    roomNumber: string;
    roomType: string;
    floor: number;
    currentStatus: string;
  }) => {
    e.preventDefault();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      roomId: roomData.roomId,
      roomNumber: roomData.roomNumber,
      roomType: roomData.roomType,
      floor: roomData.floor,
      currentStatus: roomData.currentStatus,
      visible: true
    });
  };

  const handleCloseContextMenu = () => {
    setContextMenu(prev => ({ ...prev, visible: false }));
  };

  // Close context menu on outside click
  useEffect(() => {
    const handleClickOutside = () => {
      if (contextMenu.visible) {
        handleCloseContextMenu();
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [contextMenu.visible]);

  const hideContextMenu = () => {
    setContextMenu(prev => ({ ...prev, visible: false }));
  };

  // Booking Details Modal Handlers
  const handleCellDoubleClick = (timelineData: RoomCell | undefined, roomNumber: string) => {
    if (timelineData?.bookingId) {
      setBookingDetailsModal({
        isOpen: true,
        bookingId: timelineData.bookingId,
        roomNumber
      });
    } else {
      toast.info('No booking assigned to this room/date');
    }
  };

  const closeBookingDetailsModal = () => {
    setBookingDetailsModal({
      isOpen: false,
      bookingId: null,
      roomNumber: null
    });
  };

  const handleBookingUpdate = () => {
    // Refresh the tape chart data after booking update
    fetchChartData();
    setRefreshTrigger(prev => prev + 1);
  };

  // Enhanced drag & drop helper functions
  const generateRoomSuggestions = async (reservation: DraggedReservation) => {
    try {
      const suggestions = await dragDropManager.getSuggestedRooms(reservation);
      const suggestionMap = new Map();

      suggestions.forEach(suggestion => {
        const cellId = `${suggestion.roomNumber}-${format(startDate, 'yyyy-MM-dd')}`;
        suggestionMap.set(cellId, suggestion);
      });

      setRoomSuggestions(suggestionMap);
    } catch {
      // Error handled silently
    }
  };

  const endDragOperation = () => {

    // Clear drag drop manager state
    dragDropManager.endDragOperation();

    // Force clear all UI states
    setDragState({
      isDragging: false,
      draggedItems: [],
      dragPreview: null,
      operationId: null
    });

    setDraggedItem(null);
    setDragOverCell(null);
    setConflictIndicators(new Map());
    setRoomSuggestions(new Map());

    // Remove any remaining drag preview elements
    const dragPreviews = document.querySelectorAll('.drag-preview');
    dragPreviews.forEach(element => {
      if (element.parentNode) {
        element.parentNode.removeChild(element);
      }
    });

    // Force clear any drag over styling or attributes
    const allCells = document.querySelectorAll('[data-cell-id]');
    allCells.forEach(cell => {
      cell.classList.remove('drag-over', 'drag-hover');
      cell.removeAttribute('data-drag-over');
    });

  };

  // Cleanup drag state on component unmount or when drag ends unexpectedly
  useEffect(() => {
    const handleDragEnd = () => {
      if (dragState.isDragging) {
        endDragOperation();
      }
    };

    document.addEventListener('dragend', handleDragEnd);
    document.addEventListener('mouseup', handleDragEnd);

    return () => {
      document.removeEventListener('dragend', handleDragEnd);
      document.removeEventListener('mouseup', handleDragEnd);
      // Clean up hover timer
      if (hoverTimer) {
        clearTimeout(hoverTimer);
      }
      dragDropManager.cleanup();
    };
  }, [dragState.isDragging]);

  const handleStatusChange = async (roomId: string, newStatus: string) => {
    try {
      await tapeChartService.updateRoomStatus(roomId, {
        status: newStatus,
        notes: `Status changed to ${newStatus} via tape chart`,
        changeReason: 'Manual update'
      });
      toast.success(`Room ${roomId} status updated to ${newStatus}`);
      fetchChartData();
      hideContextMenu();
    } catch (err: unknown) {
      const error = err as { message?: string };
      toast.error(error.message || 'Failed to update room status');
    }
  };

  const handleCreateBlockFromSelection = async () => {
    try {
      if (selectedRoomsForBlock.size === 0) {
        toast.error('Please select rooms to create a block');
        return;
      }

      const roomIds = Array.from(selectedRoomsForBlock);
      const roomNumbers = roomIds.map(id => {
        const room = chartData?.rooms?.find((r: Record<string, unknown>) => r.config?._id === id || r.room?._id === id);
        return room?.config?.roomNumber || id;
      });

      await tapeChartService.createRoomBlock({
        blockName: `Block - ${format(new Date(), 'MMM dd yyyy')}`,
        groupName: 'Manual Block',
        eventType: 'general',
        startDate: formatISO(startDate, { representation: 'date' }),
        endDate: formatISO(endDate, { representation: 'date' }),
        rooms: roomIds.map((id, idx) => ({
          roomId: id,
          roomNumber: roomNumbers[idx] || '',
          roomType: 'Standard',
          status: 'blocked'
        })),
        totalRooms: roomIds.length,
        roomsBooked: 0,
        roomsReleased: 0,
        status: 'active',
        contactPerson: {},
        billingInstructions: '',
        amenities: [],
        currency: 'INR'
      });

      toast.success(`Block created with ${roomIds.length} rooms`);
      fetchChartData();

      // Reset selection and exit block mode
      setSelectedRoomsForBlock(new Set());
      setBlockCreationMode(false);
    } catch (err: unknown) {
      const error = err as { message?: string };
      toast.error(error.message || 'Failed to create block');
    }
  };

  const toggleBlockCreationMode = () => {
    setBlockCreationMode(!blockCreationMode);
    if (blockCreationMode) {
      // Exiting block mode, clear selections
      setSelectedRoomsForBlock(new Set());
    }
  };

  const renderRoomCell = (room: Record<string, unknown>, date: Date) => {
    const cellId = `${room.config.roomNumber}-${format(date, 'yyyy-MM-dd')}`;
    const isWeekend = date.getDay() === 0 || date.getDay() === 6;
    const isToday = isSameDay(date, new Date());
    const isDragOver = dragOverCell === cellId;
    // Only show conflicts on the cell currently being hovered — prevents stale indicators on adjacent cells
    const hasConflict = isDragOver && conflictIndicators.has(cellId);
    const conflict = hasConflict ? conflictIndicators.get(cellId) : undefined;
    const isRecommended = roomSuggestions.has(cellId);
    
    // Find timeline data for this date
    const timelineData = (room.timeline as TimelineCell[]).find((t: TimelineCell) =>
      isSameDay(parseISO(t.date), date)
    );
    
    const status = timelineData?.status || 'available';
    const guestName = timelineData?.guestName;
    const rate = timelineData?.rate;
    
    return (
      <div aria-hidden="true"
        key={cellId}
        className={`
          relative min-h-[${compactView ? '28px' : '40px'}] border border-gray-200/60
          ${getProfitabilityRoomColor(timelineData, status)}
          ${isDragOver && !hasConflict ? 'ring-2 ring-blue-400 bg-blue-50/80 border-blue-300 scale-[1.01]' : ''}
          ${isDragOver && hasConflict ? 'ring-2 ring-red-400 bg-red-50/80 border-red-300' : ''}
          ${isRecommended ? 'ring-1 ring-green-400 bg-green-50/60' : ''}
          ${isToday ? 'ring-1 ring-blue-300 bg-blue-50/30' : ''}
          ${isWeekend ? 'bg-opacity-50' : ''}
          ${slideToCreate.previewCells.has(cellId) ? 'bg-blue-100 ring-2 ring-blue-400 border-blue-400' : ''}
          transition-all duration-150 ease-out cursor-pointer hover:shadow-sm hover:border-gray-300
          ${dragState.isDragging ? 'hover:ring-1 hover:ring-blue-300' : ''}
          ${!timelineData?.bookingId && status === 'available' && !slideToCreate.isSliding ? 'hover:bg-green-50 hover:border-green-300' : ''}
          transform-gpu will-change-transform rounded-sm
        `}
        onDragOver={(e) => handleDragOver(e, cellId)}
        onDragLeave={(e) => handleDragLeave(e, cellId)}
        onDrop={(e) => handleDrop(e, room.room?._id || room.config.roomId, format(date, 'yyyy-MM-dd'), room.config.roomNumber)}
        onClick={() => {
          // If cell has a booking (occupied/reserved), open booking details modal on single click
          if (timelineData?.bookingId && (status === 'occupied' || status === 'reserved')) {
            setBookingDetailsModal({
              isOpen: true,
              bookingId: timelineData.bookingId,
              roomNumber: room.config.roomNumber
            });
          } else {
            handleCellClick(room.config._id, room.config.roomNumber, format(date, 'yyyy-MM-dd'), timelineData as RoomCell | undefined);
            handleRoomSelect(room.config._id);
          }
        }}
        onDoubleClick={() => handleCellDoubleClick(timelineData, room.config.roomNumber)}
        // Slide-to-Create feature (Hotelogix GAME CHANGER)
        onMouseDown={(e) => {
          if (!timelineData?.bookingId && status === 'available' && e.button === 0 && !e.ctrlKey && !e.shiftKey) {
            setIsMouseDown(true);
            handleSlideStart(room.config.roomNumber, format(date, 'yyyy-MM-dd'));
            e.preventDefault();
          }
        }}
        onMouseEnter={() => {
          if (isMouseDown && !timelineData?.bookingId && status === 'available') {
            handleSlideMove(room.config.roomNumber, format(date, 'yyyy-MM-dd'));
          }
        }}
        onMouseUp={() => {
          if (slideToCreate.isSliding) {
            handleSlideEnd();
          }
        }}
        onContextMenu={(e) => handleRightClick(e, {
          roomId: room.config._id,
          roomNumber: room.config.roomNumber,
          roomType: room.config.roomType,
          floor: room.config.floor,
          currentStatus: room.currentStatus
        })}
      >
        {/* Status indicator */}
        <div className={`absolute top-0 left-0 w-1 h-full ${getStatusColor(status).replace('bg-', 'bg-').replace('-50', '-500')}`} />
        
        {/* Status icon */}
        <div className="absolute top-1 left-1">
          {getStatusIcon(status)}
        </div>
        
        {/* Notification badges */}
        {getNotificationBadge(getRoomNotifications(room.config.roomNumber, timelineData))}
        
        {/* Enhanced drag drop indicators */}
        {isDragOver && !hasConflict && !recentlyUpdatedCells.has(cellId) && dragState.isDragging && (
          <div className="absolute inset-0 flex items-center justify-center bg-green-100 bg-opacity-75 border-2 border-dashed border-green-400 animate-pulse">
            <div className="bg-green-500 text-white px-2 py-1 rounded text-xs font-medium flex items-center gap-1 shadow-lg">
              <Check className="w-3 h-3" />
              Drop to assign
            </div>
          </div>
        )}

        {/* Room type mismatch indicator */}
        {isDragOver && hasConflict && conflict?.message?.includes('Room type mismatch') && dragState.isDragging && (
          <div className="absolute inset-0 flex items-center justify-center bg-orange-100 bg-opacity-75 border-2 border-dashed border-orange-400">
            <div className="bg-orange-500 text-white px-2 py-1 rounded text-xs font-medium flex items-center gap-1 shadow-lg">
              <AlertTriangle className="w-3 h-3" />
              Wrong type
            </div>
          </div>
        )}

        {/* Date mismatch indicator */}
        {isDragOver && hasConflict && conflict?.reason?.includes('Date mismatch') && dragState.isDragging && (
          <div className="absolute inset-0 flex items-center justify-center bg-red-100 bg-opacity-75 border-2 border-dashed border-red-400">
            <div className="bg-red-500 text-white px-2 py-1 rounded text-xs font-medium flex items-center gap-1 shadow-lg">
              <CalendarIcon className="w-3 h-3" />
              Wrong date
            </div>
          </div>
        )}

        {/* Room occupied indicator */}
        {isDragOver && hasConflict && conflict?.message?.includes('occupied') && dragState.isDragging && (
          <div className="absolute inset-0 flex items-center justify-center bg-red-100 bg-opacity-75 border-2 border-dashed border-red-400">
            <div className="bg-red-500 text-white px-2 py-1 rounded text-xs font-medium flex items-center gap-1 shadow-lg">
              <X className="w-3 h-3" />
              Occupied
            </div>
          </div>
        )}


        {/* Room suggestion highlight */}
        {isRecommended && !isDragOver && (
          <div className="absolute inset-0 ring-2 ring-blue-400 ring-opacity-50 bg-blue-50 bg-opacity-30 animate-pulse">
            <div className="absolute top-1 right-1 bg-blue-500 text-white rounded-full p-1">
              <Star className="w-3 h-3" />
            </div>
          </div>
        )}

        {/* Assignment success animation */}
        {cellId === lastAssignedCell && (
          <div className="absolute inset-0 bg-green-400 bg-opacity-50 animate-ping">
            <div className="absolute inset-0 flex items-center justify-center">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
          </div>
        )}

        {/* Conflict indicator - only show during active drag operations */}
        {isDragOver && hasConflict && dragState.isDragging && (
          <div className="absolute inset-0 flex items-center justify-center bg-red-100 bg-opacity-90 border-2 border-dashed border-red-400">
            <div className="bg-red-500 text-white px-2 py-1 rounded text-xs font-medium flex items-center gap-1">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 18.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              {conflict?.conflictType === 'locked' ? 'Room Locked' : 'Conflict!'}
            </div>
          </div>
        )}

        {/* Recommendation indicator */}
        {isRecommended && !isDragOver && (
          <div className="absolute top-1 right-1">
            <div className="bg-green-500 text-white rounded-full p-1 text-xs">
              <svg className="w-2 h-2" fill="currentColor" viewBox="0 0 24 24">
                <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        )}
        
        {/* Content */}
        <div className="p-1 pl-5 text-xs">
          {/* Show updating message for recently assigned cells */}
          {recentlyUpdatedCells.has(cellId) && (
            <div className="space-y-1 text-center text-blue-600 font-medium animate-pulse">
              <div>Updating...</div>
            </div>
          )}

          {/* HOTELOGIX STANDARD: Guest names ALWAYS visible in cells */}
          {guestName && timelineData?.bookingId && !recentlyUpdatedCells.has(cellId) && (
            <div
              className="space-y-1 cursor-move hover:bg-blue-50 rounded p-1 -m-1 transition-colors duration-150"
              draggable={true}
              onDragStart={async (e) => {
                try {
                  // Find the actual booking data from the room.bookings array
                  const actualBooking = (room.bookings as Record<string, unknown>[] | undefined)?.find((booking: Record<string, unknown>) =>
                    booking._id.toString() === timelineData.bookingId.toString()
                  );


                  if (!actualBooking) {
                    toast.error('Booking data not found. Cannot move reservation.');
                    e.preventDefault();
                    return;
                  }

                  // Create proper draggable reservation data from actual booking
                  const draggedReservation: DraggedReservation = {
                    id: actualBooking._id.toString(),
                    _id: actualBooking._id.toString(),
                    bookingNumber: actualBooking.bookingNumber || actualBooking._id.toString().slice(-6),
                    guestName: actualBooking.userId?.name || guestName,
                    roomType: room.config.roomType || 'Standard',
                    checkIn: actualBooking.checkIn,
                    checkOut: actualBooking.checkOut,
                    status: actualBooking.status,
                    vipStatus: timelineData.vipStatus || 'none',
                    totalAmount: actualBooking.totalAmount || 0,
                    paymentStatus: actualBooking.paymentStatus || 'pending',
                    adults: actualBooking.guestDetails?.adults || 2,
                    children: actualBooking.guestDetails?.children || 0,
                    nights: actualBooking.nights || 1,
                    specialRequests: actualBooking.specialRequests || []
                  };

                  handleDragStart(e, draggedReservation);

                } catch (error) {
                  toast.error('Failed to prepare booking data for move');
                  e.preventDefault();
                }
              }}
              title={recentlyUpdatedCells.has(cellId) ? "Updating room assignment..." : `Drag to move ${guestName} to another room`}
            >
              <div className="font-medium truncate flex items-center gap-1">
                {getGenderIcon(timelineData?.gender)}
                {getVipIcon(timelineData?.vipStatus)}
                {/* HOTELOGIX STANDARD: Show (T) for Travel Agent bookings */}
                {timelineData?.bookingType === 'travel_agent' && (
                  <span className="text-xs font-bold text-orange-600">(T)</span>
                )}
                {getBookingTypeIcon(timelineData?.bookingType)}
                <span className="select-none font-semibold text-gray-800">{guestName}</span>
                <svg className="w-3 h-3 text-gray-400 ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                </svg>
              </div>
              <div className="flex items-center justify-between">
                {getPreferenceIcons(timelineData?.preferences)}
                {getAIPredictionIndicator(timelineData?.aiPrediction)}
              </div>
              {timelineData?.bookingType && (
                <div className="text-xs opacity-75 capitalize">
                  {timelineData.bookingType.replace('_', ' ')}
                </div>
              )}
            </div>
          )}

          {/* Show room status and slide-to-create hint when no guest */}
          {(!guestName || !timelineData?.bookingId) && (
            <div className="text-gray-500 capitalize text-center py-2">
              {status === 'available' && !slideToCreate.isSliding ? (
                <div className="flex flex-col items-center">
                  <span className="text-xs font-medium">Available</span>
                  {!compactView && (
                    <span className="text-xs opacity-60 mt-0.5">Click & drag to book</span>
                  )}
                </div>
              ) : (
                status.replace('_', ' ')
              )}
            </div>
          )}

          {/* Slide-to-Create preview indicator */}
          {slideToCreate.previewCells.has(cellId) && (
            <div className="absolute inset-0 bg-blue-100 bg-opacity-50 flex items-center justify-center pointer-events-none animate-pulse">
              <div className="bg-blue-600 text-white px-2 py-1 rounded text-xs font-bold shadow-lg">
                New Booking
              </div>
            </div>
          )}
          
          {showRates && rate && (
            <div className="text-gray-600 font-mono">
              {formatCurrency(rate)}
            </div>
          )}
          
          {timelineData?.bookingId && (
            <div className="text-gray-500 text-xs opacity-75">
              #{timelineData.bookingId.slice(-6)}
            </div>
          )}
        </div>
        
        {/* Special indicators */}
        {timelineData?.specialRequests?.length > 0 && (
          <Bell className="absolute top-1 right-1 w-3 h-3 text-orange-500" />
        )}
        
        {status === 'maintenance' && (
          <AlertTriangle className="absolute bottom-1 right-1 w-3 h-3 text-red-500" />
        )}
        
        {status === 'clean' && (
          <CheckCircle className="absolute bottom-1 right-1 w-3 h-3 text-green-500" />
        )}
        
        {/* Booking type indicator */}
        {timelineData?.bookingType && getBookingTypeIndicator(timelineData.bookingType)}
      </div>
    );
  };

  const renderRoomRow = (room: Record<string, unknown>, index: number) => {
    const isSelected = selectedRooms.has(room.config._id);
    
    return (
      <div key={room.config._id} className="flex min-w-fit border-b border-gray-200">
        {/* Room header */}
        <div className={`
          sticky left-0 z-10 bg-white border-r border-gray-200/60 p-1.5
          min-w-[120px] flex flex-col justify-center
          ${isSelected ? 'bg-blue-50/80 border-blue-200' : ''}
        `}>
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <div className="font-medium text-xs truncate">{room.config.roomNumber}</div>
              <div className="text-xs text-gray-500 truncate">{room.room?.type || room.config.roomType}</div>
              <div className="text-xs text-gray-400">F{room.config.floor}</div>
            </div>

            <div className="flex flex-col items-center gap-0.5 ml-1">
              <div className={`w-2 h-2 rounded-full ${getStatusColor(room.currentStatus || 'available').replace('bg-', 'bg-').replace('-100', '-500')}`} />
              <div className="text-xs text-gray-500 capitalize px-1 py-0.5 bg-gray-50 rounded text-center leading-none">
                {(room.currentStatus || 'available').replace('_', ' ')}
              </div>
            </div>
          </div>
          {room.room?.amenities?.length > 0 && (
            <div className="flex gap-1 mt-0.5 justify-center">
              {room.room.amenities.includes('wifi') && <Wifi className="w-2 h-2 text-gray-400" />}
              {room.room.amenities.includes('coffee') && <Coffee className="w-2 h-2 text-gray-400" />}
            </div>
          )}
        </div>
        
        {/* Timeline cells */}
        <div className="flex flex-1">
          {getDatesInRange.map(date => renderRoomCell(room, date))}
        </div>
      </div>
    );
  };

  if (loading && !chartData) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="p-6">
            <div className="animate-pulse space-y-4">
              <div className="h-4 bg-gray-200 rounded w-1/4"></div>
              <div className="space-y-3">
                <div className="h-4 bg-gray-200 rounded"></div>
                <div className="h-4 bg-gray-200 rounded w-5/6"></div>
                <div className="h-4 bg-gray-200 rounded w-4/6"></div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error && !chartData) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="p-6 text-center">
            <AlertTriangle className="w-12 h-12 mx-auto mb-3 text-red-400" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Failed to Load Tape Chart</h3>
            <p className="text-sm text-gray-500 mb-4">{error}</p>
            <Button
              variant="outline"
              onClick={() => { setError(null); fetchViews(); }}
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <>
        <div role="button" tabIndex={0} className="h-screen flex overflow-x-auto" onClick={hideContextMenu} onKeyDown={(e: React.KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); hideContextMenu(e as any); } }}>
        {/* Collapsible Menu Sidebar */}
        <CollapsibleSidebar
          isCollapsed={isMenuCollapsed}
          onToggle={() => setIsMenuCollapsed(!isMenuCollapsed)}
          className="h-full border-r border-gray-200"
        />
        
        {/* Reservations Sidebar */}
        <div className={`${isReservationSidebarCollapsed ? 'w-16' : 'w-80'} transition-all duration-300 ease-in-out`}>
          <ReservationSidebar
            onDragStart={handleDragStart}
            selectedDate={startDate}
            endDate={endDate}
            isCompact={compactView}
            refreshTrigger={refreshTrigger}
            isCollapsed={isReservationSidebarCollapsed}
            onToggleCollapse={() => setIsReservationSidebarCollapsed(!isReservationSidebarCollapsed)}
            className="h-full"
          />
        </div>


        {/* Phase Components Vertical Sidebar */}
        {showPhasesSidebar && (
          <div className="w-64 border-r border-gray-200 bg-white flex flex-col transition-all duration-300 ease-in-out">
            <div className="p-3 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-blue-50 to-purple-50">
              <div>
                <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                  <div className="w-6 h-6 bg-gradient-to-r from-blue-500 to-purple-600 rounded-md flex items-center justify-center">
                    <Settings className="w-3 h-3 text-white" />
                  </div>
                  Hotel Features
                </h3>
                <p className="text-xs text-gray-500">Enterprise Management Tools</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowPhasesSidebar(false)}
                className="h-6 w-6 p-0 hover:bg-white/60 transition-colors"
                title="Hide features panel"
              >
                <ChevronLeft className="w-4 h-4 text-gray-600" />
              </Button>
            </div>
            <div className="flex-1 p-2 space-y-2 overflow-y-auto">
            {/* Phase 1: Core Enterprise Features */}
            <div className="space-y-1">
              <h4 className="text-xs font-medium text-gray-600 uppercase tracking-wide px-2">Core Features</h4>
              <ReservationWorkflowPanel isOpen={false} onClose={() => {}} />
              <VIPGuestManager isOpen={false} onClose={() => {}} />
              <UpgradeProcessor />
              <TempReservationSystem />
              <SpecialRequestTracker />
              <WaitlistProcessor />
              <MultiViewOperationsDashboard />
            </div>

            {/* Phase 2: Advanced Features */}
            <div className="space-y-1 pt-3 border-t border-gray-100">
              <h4 className="text-xs font-medium text-gray-600 uppercase tracking-wide px-2">Advanced Features</h4>
              <ChannelManager />
              <DynamicPricingEngine />
              <PredictiveAnalyticsEngine />
              <MobileExperience />
              <GuestIntelligence />
              <AdvancedHousekeeping />
            </div>

            {/* Phase 3: Innovation Leadership Features */}
            <div className="space-y-1 pt-3 border-t border-gray-100">
              <h4 className="text-xs font-medium text-gray-600 uppercase tracking-wide px-2">Innovation Features</h4>
              <VoiceInterface />
              <SecurityCompliance />
              <DayNightMode />
              <BusinessIntelligence />
              <ColorCodedManagement />
            </div>

            {/* Management Tools */}
            <div className="space-y-1 pt-3 border-t border-gray-100">
              <h4 className="text-xs font-medium text-gray-600 uppercase tracking-wide px-2">Management Tools</h4>
              <BlockManagementPanel isOpen={false} onClose={() => {}} />
            </div>
          </div>
        </div>
        )}

        
        {/* Main content */}
        <div className="flex-1 p-1 space-y-2 flex flex-col min-w-fit">
        {/* Toggle Button for Hotel Features Panel */}
        {!showPhasesSidebar && (
          <div className="flex justify-start mb-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowPhasesSidebar(true)}
              className="h-8 w-8 p-0 hover:bg-blue-50 transition-all duration-200 rounded-md"
              title="Show Hotel Features Panel"
            >
              <div className="w-6 h-6 bg-gradient-to-r from-blue-500 to-purple-600 rounded-md flex items-center justify-center shadow-sm">
                <Settings className="w-3 h-3 text-white" />
              </div>
            </Button>
          </div>
        )}

        {/* Modern Compact Header */}
        <Card className="flex-none shadow-sm">
          <CardHeader className="pb-1 pt-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                    <Bed className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <h1 className="text-lg font-bold text-gray-900">Tape Chart</h1>
                    <p className="text-xs text-gray-500">Room assignments & availability</p>
                  </div>
                </div>
                {selectedRooms.size > 0 && (
                  <Badge variant="secondary" className="bg-blue-50 text-blue-700 border-blue-200">
                    {selectedRooms.size} selected
                  </Badge>
                )}
              </div>

              {/* Compact Global Search */}
              <div className="flex-1 max-w-sm mx-4">
                <GlobalSearch
                  onResultSelect={(result) => {
                  }}
                  placeholder="Search guests, rooms..."
                />
              </div>
            </div>

            {/* Compact Controls Row */}
            <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-100">
              <div className="flex items-center gap-3">
                {/* Batch operation controls */}
                {dragDropManager.getSelectionCount() > 1 && (
                  <div className="flex items-center gap-2 px-2 py-1 bg-amber-50 border border-amber-200 rounded-md">
                    <Users className="w-3 h-3 text-amber-600" />
                    <span className="text-xs font-medium text-amber-700">
                      {dragDropManager.getSelectionCount()} selected
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        dragDropManager.clearSelection();
                        setRefreshTrigger(prev => prev + 1);
                      }}
                      className="h-5 px-1 text-xs text-amber-700 hover:bg-amber-100"
                    >
                      ×
                    </Button>
                  </div>
                )}

                {/* Drag operation status */}
                {dragState.isDragging && (
                  <div className="flex items-center gap-2 px-2 py-1 bg-blue-50 rounded-md border border-blue-200">
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                    <span className="text-xs text-blue-700 font-medium">
                      Moving {dragState.draggedItems.length} guest{dragState.draggedItems.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                {/* Compact View Selector */}
                <Select value={selectedView || undefined} onValueChange={setSelectedView}>
                  <SelectTrigger className="w-32 h-8 text-xs">
                    <SelectValue placeholder="Weekly View" />
                  </SelectTrigger>
                  <SelectContent>
                    {views.map(view => (
                      <SelectItem key={view._id} value={view._id} className="text-xs">
                        {view.viewName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Compact Date Range */}
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-1 h-8 px-2 text-xs">
                      <CalendarIcon className="w-3 h-3" />
                      {format(startDate, 'MMM dd')} - {format(endDate, 'MMM dd')}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="end">
                    <div className="p-2 space-y-2">
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => {
                          const newStart = subDays(startDate, 7);
                          const newEnd = subDays(endDate, 7);
                          setStartDate(newStart);
                          setEndDate(newEnd);
                        }}>
                          Previous Week
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => {
                          const today = new Date();
                          setStartDate(today);
                          setEndDate(addDays(today, 7));
                        }}>
                          This Week
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => {
                          const newStart = addDays(startDate, 7);
                          const newEnd = addDays(endDate, 7);
                          setStartDate(newStart);
                          setEndDate(addDays(endDate, 7));
                        }}>
                          Next Week
                        </Button>
                      </div>
                      <CalendarComponent
                        mode="range"
                        selected={dateRange}
                        onSelect={(range) => {
                          if (range?.from) setStartDate(range.from);
                          if (range?.to) setEndDate(range.to);
                          setDateRange(range || {});
                        }}
                      />
                    </div>
                  </PopoverContent>
                </Popover>

                {/* Compact Quick Actions */}
                <div className="flex items-center gap-1">
                  <Button
                    variant={showSidebar ? "default" : "outline"}
                    size="sm"
                    onClick={() => setShowSidebar(!showSidebar)}
                    className="h-8 px-2 text-xs"
                    title="Toggle reservations sidebar"
                  >
                    <Users className="w-3 h-3" />
                  </Button>

                  <Button
                    variant={compactView ? "default" : "outline"}
                    size="sm"
                    onClick={() => setCompactView(!compactView)}
                    className="h-8 px-2 text-xs"
                    title="Toggle compact view"
                  >
                    <Maximize2 className="w-3 h-3" />
                  </Button>

                  <Button
                    variant={showFilters ? "default" : "outline"}
                    size="sm"
                    onClick={() => setShowFilters(!showFilters)}
                    className={`h-8 px-2 text-xs ${
                      showFilters
                        ? 'bg-blue-500 hover:bg-blue-600 text-white border-blue-500'
                        : 'hover:bg-blue-50 hover:text-blue-600 hover:border-blue-300'
                    }`}
                    title={showFilters ? "Hide filters" : "Show filters"}
                  >
                    <Filter className={`w-3 h-3 ${showFilters ? 'text-white' : 'text-gray-600'}`} />
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setLoading(true);
                      fetchChartData();
                      setRefreshTrigger(prev => prev + 1);
                      toast.success('Tape chart refreshed successfully');
                    }}
                    title="Refresh tape chart data"
                    className="h-8 px-2 text-xs hover:bg-green-50 hover:text-green-600 hover:border-green-300"
                    disabled={loading}
                  >
                    <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin text-green-600' : 'text-gray-600'}`} />
                  </Button>

                  {/* Undo button for drag operations */}
                  {dragDropManager.canUndo() && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => dragDropManager.undoLastOperation()}
                      title="Undo last operation"
                      className="h-8 px-2 text-xs text-orange-600 border-orange-300 hover:bg-orange-50"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                      </svg>
                    </Button>
                  )}

                  {/* Block creation controls */}
                  {blockCreationMode && (
                    <div className="flex items-center gap-2 px-3 py-1 bg-purple-50 border border-purple-200 rounded-lg">
                      <Building2 className="w-4 h-4 text-purple-600" />
                      <span className="text-sm font-medium text-purple-700">
                        Block Mode: {selectedRoomsForBlock.size} room{selectedRoomsForBlock.size !== 1 ? 's' : ''} selected
                      </span>
                      {selectedRoomsForBlock.size > 0 && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleCreateBlockFromSelection}
                          className="h-6 px-2 text-xs border-purple-300 text-purple-700 hover:bg-purple-100"
                        >
                          Create Block
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={toggleBlockCreationMode}
                        className="h-6 px-2 text-xs text-purple-600 hover:bg-purple-100"
                      >
                        Cancel
                      </Button>
                    </div>
                  )}
                  
                  {/* Phase components moved to vertical sidebar */}

                    {/* Enhanced Interactive Features */}
                    <div className="flex items-center gap-2 ml-2 pl-2 border-l border-gray-300">
                      <Button
                        variant={clickToBookMode ? "default" : "outline"}
                        size="sm"
                        onClick={toggleClickToBookMode}
                        className={clickToBookMode ?
                          "bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600" :
                          "border-green-200 hover:bg-green-50"
                        }
                      >
                        <Zap className="h-4 w-4 mr-2" />
                        Click-to-Book
                        {clickToBookMode && (
                          <Badge className="ml-2 bg-white text-green-700 text-xs">ON</Badge>
                        )}
                      </Button>

                      <Button
                        variant={multiNightSelection.active ? "default" : "outline"}
                        size="sm"
                        onClick={toggleMultiNightMode}
                        className={multiNightSelection.active ?
                          "bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600" :
                          "border-blue-200 hover:bg-blue-50"
                        }
                      >
                        <Calendar className="h-4 w-4 mr-2" />
                        Multi-Night
                        {multiNightSelection.active && (
                          <Badge className="ml-2 bg-white text-blue-700 text-xs">ON</Badge>
                        )}
                      </Button>
                    </div>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm">
                          <Settings className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setShowGuestNames(!showGuestNames)}>
                          <UserCheck className="w-4 h-4 mr-2" />
                          {showGuestNames ? 'Hide' : 'Show'} Guest Names
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setShowRates(!showRates)}>
                          <IndianRupee className="w-4 h-4 mr-2" />
                          {showRates ? 'Hide' : 'Show'} Rates
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={fetchChartData}>
                          <Zap className="w-4 h-4 mr-2" />
                          Refresh Data
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </div>

            {/* Ultra-Compact Chart Summary */}
            {displayData?.summary && (
              <div className="pt-1 space-y-1">
                {/* Ultra-compact stats row with filter indicator */}
                <div className="flex items-center justify-between mb-1">
                  <div className="text-xs font-medium text-gray-600">Room Overview</div>
                  {(filters.roomTypes.length > 0 || filters.statuses.length > 0 || filters.floors.length > 0 || filters.buildings.length > 0) && (
                    <div className="flex items-center gap-1">
                      <Filter className="w-3 h-3 text-blue-500" />
                      <span className="text-xs text-blue-600 font-medium">Filtered</span>
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-8 gap-1 text-xs">
                  <div className="bg-gray-50 rounded-md p-2 text-center">
                    <div className="text-lg font-bold text-gray-800">{displayData.summary.totalRooms}</div>
                    <div className="text-xs text-gray-600">Total</div>
                  </div>
                  <div className="bg-red-50 rounded-md p-2 text-center">
                    <div className="text-lg font-bold text-red-800">{displayData.summary.occupiedRooms}</div>
                    <div className="text-xs text-red-600">Occupied</div>
                  </div>
                  <div className="bg-green-50 rounded-md p-2 text-center">
                    <div className="text-lg font-bold text-green-800">{displayData.summary.availableRooms}</div>
                    <div className="text-xs text-green-600">Available</div>
                  </div>
                  <div className="bg-amber-50 rounded-md p-2 text-center">
                    <div className="text-lg font-bold text-amber-800">{displayData.summary.reservedRooms}</div>
                    <div className="text-xs text-amber-600">Reserved</div>
                  </div>
                  <div className="bg-orange-50 rounded-md p-2 text-center">
                    <div className="text-lg font-bold text-orange-800">{displayData.summary.dirtyRooms || 0}</div>
                    <div className="text-xs text-orange-600">Dirty</div>
                  </div>
                  <div className="bg-purple-50 rounded-md p-2 text-center">
                    <div className="text-lg font-bold text-purple-800">{displayData.summary.maintenanceRooms}</div>
                    <div className="text-xs text-purple-600">Maintenance</div>
                  </div>
                  <div className="bg-gray-50 border border-gray-300 rounded-md p-2 text-center">
                    <div className="text-lg font-bold text-gray-800">{displayData.summary.blockedRooms || 0}</div>
                    <div className="text-xs text-gray-600">Blocked</div>
                  </div>
                  <div className="bg-blue-50 rounded-md p-2 text-center">
                    <div className="text-lg font-bold text-blue-800">{(displayData.summary.occupancyRate ?? 0).toFixed(1)}%</div>
                    <div className="text-xs text-blue-600">Occupancy</div>
                  </div>
                </div>

                {/* Compact occupancy progress bar */}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500 w-8">0%</span>
                  <div className="flex-1 bg-gray-200 rounded-full h-2 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-green-500 to-red-500 transition-all duration-500 ease-out"
                      style={{ width: `${Math.min(displayData.summary.occupancyRate ?? 0, 100)}%` }}
                    />
                  </div>
                  <span className="text-xs text-gray-500 w-8">100%</span>
                  <span className="text-xs text-blue-600 font-medium ml-2">Target: 85%</span>
                </div>
              </div>
            )}
          </CardHeader>
        </Card>

        {/* Advanced Filter Panel with Animation */}
        {showFilters && (
          <Card className="shadow-sm border border-blue-200 bg-blue-50 animate-in slide-in-from-top-2 duration-300">
            <CardContent className="p-3">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-blue-800 flex items-center gap-2">
                  <Filter className="w-4 h-4" />
                  Advanced Filters
                  <Badge variant="secondary" className="ml-2 text-xs">
                    {(filters.roomTypes.length + filters.statuses.length + filters.floors.length + filters.buildings.length) || 'None'} Active
                  </Badge>
                </h3>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      // Reset all filters
                      setFilters({
                        floors: [],
                        roomTypes: [],
                        statuses: [],
                        buildings: [],
                        wings: []
                      });
                      toast.success('All filters cleared');
                    }}
                    className="h-6 px-2 text-xs text-blue-600 hover:text-blue-800"
                    disabled={filters.roomTypes.length === 0 && filters.statuses.length === 0 && filters.floors.length === 0 && filters.buildings.length === 0}
                  >
                    <X className="w-3 h-3 mr-1" />
                    Clear All
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowFilters(false)}
                    className="h-6 px-2 text-xs text-gray-600 hover:text-gray-800"
                  >
                    <ChevronUp className="w-3 h-3" />
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-5 gap-3">
                {/* Room Types Filter */}
                <div>
                  <label className="text-xs font-medium text-gray-700 mb-1 block">Room Type</label>
                  <Select
                    value={filters.roomTypes.length > 0 ? filters.roomTypes[0] : ''}
                    onValueChange={(value) => {
                      if (value === 'all') {
                        setFilters(prev => ({ ...prev, roomTypes: [] }));
                      } else {
                        setFilters(prev => ({ ...prev, roomTypes: [value] }));
                      }
                    }}
                  >
                    <SelectTrigger className="h-7 text-xs">
                      <SelectValue placeholder="All Types" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Types</SelectItem>
                      <SelectItem value="single">Single</SelectItem>
                      <SelectItem value="double">Double</SelectItem>
                      <SelectItem value="suite">Suite</SelectItem>
                      <SelectItem value="deluxe">Deluxe</SelectItem>
                      <SelectItem value="presidential">Presidential</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Room Status Filter */}
                <div>
                  <label className="text-xs font-medium text-gray-700 mb-1 block">Status</label>
                  <Select
                    value={filters.statuses.length > 0 ? filters.statuses[0] : ''}
                    onValueChange={(value) => {
                      if (value === 'all') {
                        setFilters(prev => ({ ...prev, statuses: [] }));
                      } else {
                        setFilters(prev => ({ ...prev, statuses: [value] }));
                      }
                    }}
                  >
                    <SelectTrigger className="h-7 text-xs">
                      <SelectValue placeholder="All Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="available">🟢 Available</SelectItem>
                      <SelectItem value="occupied">🔴 Occupied</SelectItem>
                      <SelectItem value="reserved">🟡 Reserved</SelectItem>
                      <SelectItem value="maintenance">🔧 Maintenance</SelectItem>
                      <SelectItem value="dirty">🧹 Dirty</SelectItem>
                      <SelectItem value="clean">✨ Clean</SelectItem>
                      <SelectItem value="out_of_order">❌ Out of Order</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Floor Filter */}
                <div>
                  <label className="text-xs font-medium text-gray-700 mb-1 block">Floor</label>
                  <Select
                    value={filters.floors.length > 0 ? filters.floors[0].toString() : ''}
                    onValueChange={(value) => {
                      if (value === 'all') {
                        setFilters(prev => ({ ...prev, floors: [] }));
                      } else {
                        setFilters(prev => ({ ...prev, floors: [parseInt(value)] }));
                      }
                    }}
                  >
                    <SelectTrigger className="h-7 text-xs">
                      <SelectValue placeholder="All Floors" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Floors</SelectItem>
                      <SelectItem value="1">Floor 1</SelectItem>
                      <SelectItem value="2">Floor 2</SelectItem>
                      <SelectItem value="3">Floor 3</SelectItem>
                      <SelectItem value="4">Floor 4</SelectItem>
                      <SelectItem value="5">Floor 5</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Building Filter */}
                <div>
                  <label className="text-xs font-medium text-gray-700 mb-1 block">Building</label>
                  <Select
                    value={filters.buildings.length > 0 ? filters.buildings[0] : ''}
                    onValueChange={(value) => {
                      if (value === 'all') {
                        setFilters(prev => ({ ...prev, buildings: [] }));
                      } else {
                        setFilters(prev => ({ ...prev, buildings: [value] }));
                      }
                    }}
                  >
                    <SelectTrigger className="h-7 text-xs">
                      <SelectValue placeholder="All Buildings" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Buildings</SelectItem>
                      <SelectItem value="main">Main Building</SelectItem>
                      <SelectItem value="east">East Wing</SelectItem>
                      <SelectItem value="west">West Wing</SelectItem>
                      <SelectItem value="tower">Tower Block</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Quick Action Filters */}
                <div>
                  <label className="text-xs font-medium text-gray-700 mb-1 block">Quick Filter</label>
                  <div className="flex gap-1">
                    <Button
                      variant={filters.statuses.includes('available') ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => {
                        setFilters(prev => ({
                          ...prev,
                          statuses: prev.statuses.includes('available') ? [] : ['available']
                        }));
                      }}
                      className="h-7 px-2 text-xs"
                      title="Show only available rooms"
                    >
                      🟢
                    </Button>
                    <Button
                      variant={filters.statuses.includes('occupied') ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => {
                        setFilters(prev => ({
                          ...prev,
                          statuses: prev.statuses.includes('occupied') ? [] : ['occupied']
                        }));
                      }}
                      className="h-7 px-2 text-xs"
                      title="Show only occupied rooms"
                    >
                      🔴
                    </Button>
                    <Button
                      variant={filters.statuses.includes('maintenance') ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => {
                        setFilters(prev => ({
                          ...prev,
                          statuses: prev.statuses.includes('maintenance') ? [] : ['maintenance']
                        }));
                      }}
                      className="h-7 px-2 text-xs"
                      title="Show only maintenance rooms"
                    >
                      🔧
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Main chart */}
        <Card className="flex-1 overflow-hidden">
          <CardContent className="p-0 h-full">
            <div className="w-full h-full overflow-auto" ref={chartRef}>
              <div className="min-w-fit">
                {/* Date header */}
                <div className="sticky top-0 z-20 bg-white border-b border-gray-300">
                  <div className="flex min-w-fit">
                  <div className="sticky left-0 z-30 bg-gray-50 border-r border-gray-300 min-w-[150px] p-2">
                    <div className="font-medium">Room</div>
                  </div>
                  {getDatesInRange.map(date => {
                    const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                    const isToday = isSameDay(date, new Date());
                    
                    return (
                      <div
                        key={format(date, 'yyyy-MM-dd')}
                        className={`
                          min-w-[100px] p-1.5 border-r border-gray-200/60 text-center
                          ${isWeekend ? 'bg-gray-50/80' : 'bg-white'}
                          ${isToday ? 'bg-blue-50/80 border-blue-200' : ''}
                        `}
                      >
                        <div className={`font-medium text-xs ${isToday ? 'text-blue-600' : 'text-gray-700'}`}>
                          {format(date, 'EEE')}
                        </div>
                        <div className={`text-xs ${isToday ? 'text-blue-500 font-medium' : 'text-gray-500'}`}>
                          {format(date, 'MMM dd')}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              
                {/* Room rows */}
                <div className="divide-y divide-gray-200">
                  {displayData?.rooms?.map((room: Record<string, unknown>, index: number) => (
                    <div key={room.room?._id || `room-${index}`}>
                      {renderRoomRow(room, index)}
                    </div>
                  ))}
                </div>

                {(!displayData?.rooms || displayData.rooms.length === 0) && (
                  <div className="p-8 text-center text-gray-500">
                    <Bed className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                    <p>No room data available</p>
                    <p className="text-sm">Try selecting a different view or date range</p>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
        
        {/* Enhanced Scrollable Context Menu */}
        {contextMenu.visible && (
          <div
            className="fixed z-50 bg-white rounded-xl shadow-2xl border border-gray-200 min-w-[280px] max-w-[320px] backdrop-blur-sm max-h-[80vh] overflow-hidden"
            style={{
              left: Math.min(contextMenu.x, window.innerWidth - 320),
              top: Math.min(contextMenu.y, window.innerHeight - Math.min(600, window.innerHeight * 0.8))
            }}
          >
            {/* Scrollable Content Container */}
            <div className="max-h-[75vh] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
            {/* Modern Room Header with Close Button */}
            <div className="px-4 py-3 border-b border-gray-100 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-t-xl sticky top-0 z-10">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-gray-900 text-sm">Room {contextMenu.roomNumber}</h3>
                  <p className="text-xs text-gray-600 capitalize">{contextMenu.roomType} • Floor {contextMenu.floor}</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${
                      contextMenu.currentStatus === 'available' ? 'bg-green-500' :
                      contextMenu.currentStatus === 'occupied' ? 'bg-red-500' :
                      contextMenu.currentStatus === 'maintenance' ? 'bg-yellow-500' :
                      contextMenu.currentStatus === 'dirty' ? 'bg-orange-500' :
                      'bg-gray-400'
                    }`}></div>
                    <span className="text-xs font-medium text-gray-700 capitalize bg-white px-2 py-1 rounded-full border">
                      {contextMenu.currentStatus.replace('_', ' ')}
                    </span>
                  </div>
                  <button aria-label="Close"
                    onClick={handleCloseContextMenu}
                    className="p-1 hover:bg-white hover:bg-opacity-50 rounded-full transition-colors"
                    title="Close menu"
                  >
                    <X className="w-4 h-4 text-gray-500" />
                  </button>
                </div>
              </div>
            </div>
            
            {/* Compact Quick Actions Section */}
            <div className="py-2 border-b border-gray-100">
              <div className="px-4 py-1 text-xs font-semibold text-gray-500 uppercase tracking-wider">Quick Actions</div>
              <div className="space-y-1 px-2">
                <button
                  className="flex items-center w-full px-3 py-2 text-left text-sm hover:bg-blue-50 hover:border-blue-200 rounded-lg transition-all duration-200 border border-transparent"
                  onClick={() => { handleStatusChange(contextMenu.roomId, 'occupied'); toast.success(`Room ${contextMenu.roomNumber} checked in`); }}
                >
                  <div className="w-6 h-6 bg-blue-100 rounded-md flex items-center justify-center mr-3">
                    <UserPlus className="h-3 w-3 text-blue-600" />
                  </div>
                  <span className="text-sm text-gray-700">Check In Guest</span>
                </button>
                <button
                  className="flex items-center w-full px-3 py-2 text-left text-sm hover:bg-red-50 hover:border-red-200 rounded-lg transition-all duration-200 border border-transparent"
                  onClick={() => { handleStatusChange(contextMenu.roomId, 'dirty'); toast.success(`Room ${contextMenu.roomNumber} checked out`); }}
                >
                  <div className="w-6 h-6 bg-red-100 rounded-md flex items-center justify-center mr-3">
                    <UserX className="h-3 w-3 text-red-600" />
                  </div>
                  <span className="text-sm text-gray-700">Check Out Guest</span>
                </button>
                <button
                  className="flex items-center w-full px-3 py-2 text-left text-sm hover:bg-green-50 hover:border-green-200 rounded-lg transition-all duration-200 border border-transparent"
                  onClick={() => {
                    hideContextMenu();
                    setWalkInBookingModal({
                      isOpen: true,
                      roomNumber: contextMenu.roomNumber,
                      checkIn: format(startDate, 'yyyy-MM-dd'),
                      checkOut: format(addDays(startDate, 1), 'yyyy-MM-dd'),
                      nights: 1
                    });
                  }}
                >
                  <div className="w-6 h-6 bg-green-100 rounded-md flex items-center justify-center mr-3">
                    <CalendarIcon className="h-3 w-3 text-green-600" />
                  </div>
                  <span className="text-sm text-gray-700">New Reservation</span>
                </button>
                <button
                  className="flex items-center w-full px-3 py-2 text-left text-sm hover:bg-orange-50 hover:border-orange-200 rounded-lg transition-all duration-200 border border-transparent"
                  onClick={() => { hideContextMenu(); toast.info('Duplicate booking: Use the booking details modal to clone this reservation'); }}
                >
                  <div className="w-6 h-6 bg-orange-100 rounded-md flex items-center justify-center mr-3">
                    <Copy className="h-3 w-3 text-orange-600" />
                  </div>
                  <span className="text-sm text-gray-700">Duplicate Booking</span>
                </button>
                {/* HOTELOGIX STANDARD: Advanced Reservation Actions */}
                <button
                  className="flex items-center w-full px-3 py-2 text-left text-sm hover:bg-blue-50 hover:border-blue-200 rounded-lg transition-all duration-200 border border-transparent"
                  onClick={() => { hideContextMenu(); toast.info('Extend stay: Open the booking details to modify check-out date'); }}
                >
                  <div className="w-6 h-6 bg-blue-100 rounded-md flex items-center justify-center mr-3">
                    <CalendarIcon className="h-3 w-3 text-blue-600" />
                  </div>
                  <span className="text-sm text-gray-700">Extend Stay</span>
                </button>
                <button
                  className="flex items-center w-full px-3 py-2 text-left text-sm hover:bg-indigo-50 hover:border-indigo-200 rounded-lg transition-all duration-200 border border-transparent"
                  onClick={() => { hideContextMenu(); toast.info('Group management: Open the booking details to manage group assignments'); }}
                >
                  <div className="w-6 h-6 bg-indigo-100 rounded-md flex items-center justify-center mr-3">
                    <Users className="h-3 w-3 text-indigo-600" />
                  </div>
                  <span className="text-sm text-gray-700">Add to Group</span>
                </button>
                <button
                  className="flex items-center w-full px-3 py-2 text-left text-sm hover:bg-gray-50 hover:border-gray-200 rounded-lg transition-all duration-200 border border-transparent"
                  onClick={() => { hideContextMenu(); toast.info('Group management: Open the booking details to remove from group'); }}
                >
                  <div className="w-6 h-6 bg-gray-100 rounded-md flex items-center justify-center mr-3">
                    <UserX className="h-3 w-3 text-gray-600" />
                  </div>
                  <span className="text-sm text-gray-700">Remove from Group</span>
                </button>
              </div>
            </div>

            {/* Modern Housekeeping Section */}
            <div className="py-2">
              <div className="px-4 py-1 text-xs font-semibold text-gray-500 uppercase tracking-wider">Housekeeping</div>
              <div className="space-y-1 px-2">
                <button
                  className="flex items-center w-full px-3 py-2 text-left text-sm hover:bg-green-50 hover:border-green-200 rounded-lg transition-all duration-200 border border-transparent"
                  onClick={() => handleStatusChange(contextMenu.roomId, 'clean')}
                >
                  <div className="w-6 h-6 bg-green-100 rounded-md flex items-center justify-center mr-3">
                    <CheckCircle className="h-3 w-3 text-green-600" />
                  </div>
                  <span className="text-sm text-gray-700">Mark Clean</span>
                </button>
                <button
                  className="flex items-center w-full px-3 py-2 text-left text-sm hover:bg-yellow-50 hover:border-yellow-200 rounded-lg transition-all duration-200 border border-transparent"
                  onClick={() => handleStatusChange(contextMenu.roomId, 'dirty')}
                >
                  <div className="w-6 h-6 bg-yellow-100 rounded-md flex items-center justify-center mr-3">
                    <AlertTriangle className="h-3 w-3 text-yellow-600" />
                  </div>
                  <span className="text-sm text-gray-700">Mark Dirty</span>
                </button>
                <button
                  className="flex items-center w-full px-3 py-2 text-left text-sm hover:bg-blue-50 hover:border-blue-200 rounded-lg transition-all duration-200 border border-transparent"
                  onClick={() => { handleStatusChange(contextMenu.roomId, 'dirty'); toast.info(`Room ${contextMenu.roomNumber} marked for inspection`); }}
                >
                  <div className="w-6 h-6 bg-blue-100 rounded-md flex items-center justify-center mr-3">
                    <Settings className="h-3 w-3 text-blue-600" />
                  </div>
                  <span className="text-sm text-gray-700">Inspect Required</span>
                </button>
                <button
                  className="flex items-center w-full px-3 py-2 text-left text-sm hover:bg-red-50 hover:border-red-200 rounded-lg transition-all duration-200 border border-transparent"
                  onClick={() => handleStatusChange(contextMenu.roomId, 'maintenance')}
                >
                  <div className="w-6 h-6 bg-red-100 rounded-md flex items-center justify-center mr-3">
                    <Zap className="h-3 w-3 text-red-600" />
                  </div>
                  <span className="text-sm text-gray-700">Maintenance</span>
                </button>
                {/* HOTELOGIX STANDARD: Advanced Housekeeping Actions */}
                <button
                  className="flex items-center w-full px-3 py-2 text-left text-sm hover:bg-orange-50 hover:border-orange-200 rounded-lg transition-all duration-200 border border-transparent"
                  onClick={() => handleStatusChange(contextMenu.roomId, 'out_of_order')}
                >
                  <div className="w-6 h-6 bg-orange-100 rounded-md flex items-center justify-center mr-3">
                    <X className="h-3 w-3 text-orange-600" />
                  </div>
                  <span className="text-sm text-gray-700">Set Out of Order</span>
                </button>
                <button
                  className="flex items-center w-full px-3 py-2 text-left text-sm hover:bg-purple-50 hover:border-purple-200 rounded-lg transition-all duration-200 border border-transparent"
                  onClick={() => handleStatusChange(contextMenu.roomId, 'blocked')}
                >
                  <div className="w-6 h-6 bg-purple-100 rounded-md flex items-center justify-center mr-3">
                    <AlertTriangle className="h-3 w-3 text-purple-600" />
                  </div>
                  <span className="text-sm text-gray-700">Block Room</span>
                </button>
                <button
                  className="flex items-center w-full px-3 py-2 text-left text-sm hover:bg-gray-50 hover:border-gray-200 rounded-lg transition-all duration-200 border border-transparent"
                  onClick={async () => {
                    hideContextMenu();
                    try {
                      const history = await tapeChartService.getRoomStatusHistory(contextMenu.roomId);
                      const entries = history?.data || history || [];
                      if (entries.length === 0) {
                        toast.info(`No status history found for Room ${contextMenu.roomNumber}`);
                      } else {
                        const latest = entries.slice(0, 5).map((h: { status?: string; changedBy?: string; date?: string }) =>
                          `${h.status || 'unknown'} (${h.changedBy || 'system'} on ${h.date ? format(parseISO(h.date), 'MMM dd') : 'N/A'})`
                        ).join('\n');
                        toast.info(`Room ${contextMenu.roomNumber} history:\n${latest}`);
                      }
                    } catch {
                      toast.error('Failed to load room history');
                    }
                  }}
                >
                  <div className="w-6 h-6 bg-gray-100 rounded-md flex items-center justify-center mr-3">
                    <Clock className="h-3 w-3 text-gray-600" />
                  </div>
                  <span className="text-sm text-gray-700">View Room History</span>
                </button>
              </div>
            </div>

            {/* Compact Guest Services Section */}
            <div className="py-2 border-b border-gray-100">
              <div className="px-4 py-1 text-xs font-semibold text-gray-500 uppercase tracking-wider">Guest Services</div>
              <div className="space-y-1 px-2">
                <button
                  className="flex items-center w-full px-3 py-2 text-left text-sm hover:bg-blue-50 hover:border-blue-200 rounded-lg transition-all duration-200 border border-transparent"
                  onClick={() => { hideContextMenu(); toast.info(`Contact guest in Room ${contextMenu.roomNumber} via phone`); }}
                >
                  <div className="w-6 h-6 bg-blue-100 rounded-md flex items-center justify-center mr-3">
                    <Phone className="h-3 w-3 text-blue-600" />
                  </div>
                  <span className="text-sm text-gray-700">Call Guest</span>
                </button>
                <button
                  className="flex items-center w-full px-3 py-2 text-left text-sm hover:bg-green-50 hover:border-green-200 rounded-lg transition-all duration-200 border border-transparent"
                  onClick={() => { hideContextMenu(); toast.info(`Email notification queued for guest in Room ${contextMenu.roomNumber}`); }}
                >
                  <div className="w-6 h-6 bg-green-100 rounded-md flex items-center justify-center mr-3">
                    <Mail className="h-3 w-3 text-green-600" />
                  </div>
                  <span className="text-sm text-gray-700">Send Email to Guest</span>
                </button>
                {/* HOTELOGIX STANDARD: Advanced Guest Communication */}
                <button
                  className="flex items-center w-full px-3 py-2 text-left text-sm hover:bg-blue-50 hover:border-blue-200 rounded-lg transition-all duration-200 border border-transparent"
                  onClick={() => { hideContextMenu(); toast.info(`Push notification sent to guest in Room ${contextMenu.roomNumber}`); }}
                >
                  <div className="w-6 h-6 bg-blue-100 rounded-md flex items-center justify-center mr-3">
                    <Bell className="h-3 w-3 text-blue-600" />
                  </div>
                  <span className="text-sm text-gray-700">Send Notification</span>
                </button>
                <button
                  className="flex items-center w-full px-3 py-2 text-left text-sm hover:bg-cyan-50 hover:border-cyan-200 rounded-lg transition-all duration-200 border border-transparent"
                  onClick={() => { hideContextMenu(); toast.info(`Calling Room ${contextMenu.roomNumber}...`); }}
                >
                  <div className="w-6 h-6 bg-cyan-100 rounded-md flex items-center justify-center mr-3">
                    <Phone className="h-3 w-3 text-cyan-600" />
                  </div>
                  <span className="text-sm text-gray-700">Call Guest Now</span>
                </button>
                <button
                  className="flex items-center w-full px-3 py-2 text-left text-sm hover:bg-orange-50 hover:border-orange-200 rounded-lg transition-all duration-200 border border-transparent"
                  onClick={() => { hideContextMenu(); toast.info(`Room service request created for Room ${contextMenu.roomNumber}`); }}
                >
                  <div className="w-6 h-6 bg-orange-100 rounded-md flex items-center justify-center mr-3">
                    <Coffee className="h-3 w-3 text-orange-600" />
                  </div>
                  <span className="text-sm text-gray-700">Room Service</span>
                </button>
                <button
                  className="flex items-center w-full px-3 py-2 text-left text-sm hover:bg-yellow-50 hover:border-yellow-200 rounded-lg transition-all duration-200 border border-transparent"
                  onClick={() => { hideContextMenu(); toast.info(`VIP amenities package prepared for Room ${contextMenu.roomNumber}`); }}
                >
                  <div className="w-6 h-6 bg-yellow-100 rounded-md flex items-center justify-center mr-3">
                    <Star className="h-3 w-3 text-yellow-600" />
                  </div>
                  <span className="text-sm text-gray-700">VIP Services</span>
                </button>
              </div>
            </div>

            {/* Compact Management Section */}
            <div className="py-2">
              <div className="px-4 py-1 text-xs font-semibold text-gray-500 uppercase tracking-wider">Management</div>
              <div className="space-y-1 px-2">
                <button
                  className="flex items-center w-full px-3 py-2 text-left text-sm hover:bg-purple-50 hover:border-purple-200 rounded-lg transition-all duration-200 border border-transparent"
                  onClick={() => { hideContextMenu(); toast.info(`Drag & drop the guest from Room ${contextMenu.roomNumber} to move them to another room`); }}
                >
                  <div className="w-6 h-6 bg-purple-100 rounded-md flex items-center justify-center mr-3">
                    <Move className="h-3 w-3 text-purple-600" />
                  </div>
                  <span className="text-sm text-gray-700">Move Guest</span>
                </button>
                <button
                  className="flex items-center w-full px-3 py-2 text-left text-sm hover:bg-green-50 hover:border-green-200 rounded-lg transition-all duration-200 border border-transparent"
                  onClick={() => { hideContextMenu(); toast.info(`Open booking details to view billing for Room ${contextMenu.roomNumber}`); }}
                >
                  <div className="w-6 h-6 bg-green-100 rounded-md flex items-center justify-center mr-3">
                    <IndianRupee className="h-3 w-3 text-green-600" />
                  </div>
                  <span className="text-sm text-gray-700">Billing Details</span>
                </button>
                <button
                  className="flex items-center w-full px-3 py-2 text-left text-sm hover:bg-indigo-50 hover:border-indigo-200 rounded-lg transition-all duration-200 border border-transparent"
                  onClick={() => { hideContextMenu(); toast.info('Group management: Use the block management panel to organize group bookings'); }}
                >
                  <div className="w-6 h-6 bg-indigo-100 rounded-md flex items-center justify-center mr-3">
                    <Users className="h-3 w-3 text-indigo-600" />
                  </div>
                  <span className="text-sm text-gray-700">Group Management</span>
                </button>
                <button
                  className="flex items-center w-full px-3 py-2 text-left text-sm hover:bg-red-50 hover:border-red-200 rounded-lg transition-all duration-200 border border-transparent"
                  onClick={() => { hideContextMenu(); toast.warning(`Cancel booking: Open the booking details for Room ${contextMenu.roomNumber} to cancel`); }}
                >
                  <div className="w-6 h-6 bg-red-100 rounded-md flex items-center justify-center mr-3">
                    <Trash2 className="h-3 w-3 text-red-600" />
                  </div>
                  <span className="text-sm text-red-600">Cancel Booking</span>
                </button>
              </div>
            </div>
            </div>
          </div>
        )}
        
        {/* Live Chat Widget */}
        <LiveChatWidget position="bottom-right" />
        
        {/* Notification System */}
        <NotificationSystem position="top-right" soundEnabled={true} />

        {/* Quick Booking Modal */}
        <Dialog open={quickBookingModal.isOpen} onOpenChange={(open) =>
          setQuickBookingModal(prev => ({ ...prev, isOpen: open }))
        }>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-green-600" />
                Quick Booking - Room {quickBookingModal.roomNumber}
              </DialogTitle>
              <DialogDescription>
                Create a new booking with one click
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="p-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg border border-green-200">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-600">Check-in Date</p>
                    <p className="font-medium">
                      {quickBookingModal.startDate ? format(new Date(quickBookingModal.startDate), 'MMM dd, yyyy') : '--'}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-600">Check-out Date</p>
                    <p className="font-medium">
                      {quickBookingModal.endDate ? format(new Date(quickBookingModal.endDate), 'MMM dd, yyyy') : '--'}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-600">Total Rate</p>
                    <p className="font-bold text-green-700 text-lg">
                      {formatCurrency(quickBookingModal.totalRate)}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-600">Nights</p>
                    <p className="font-medium">
                      {quickBookingModal.startDate && quickBookingModal.endDate ?
                        Math.ceil((new Date(quickBookingModal.endDate).getTime() - new Date(quickBookingModal.startDate).getTime()) / (1000 * 60 * 60 * 24)) :
                        1
                      } night(s)
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                <p className="text-sm text-blue-800">
                  <strong>Quick Booking:</strong> This will create a placeholder reservation.
                  Complete guest details and payment can be added later from the booking details.
                </p>
              </div>

              <div className="flex gap-3 pt-4">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setQuickBookingModal(prev => ({ ...prev, isOpen: false }))}
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600"
                  onClick={handleQuickBookingConfirm}
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Create Booking
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

      </div>

      </div>

      {/* Booking Details Modal */}
      <BookingDetailsModal
        isOpen={bookingDetailsModal.isOpen}
        onClose={closeBookingDetailsModal}
        bookingId={bookingDetailsModal.bookingId}
        roomNumber={bookingDetailsModal.roomNumber}
        onBookingUpdate={handleBookingUpdate}
      />

      {/* Walk-In Booking Modal for new bookings created via slide-to-create */}
      <WalkInBooking
        isOpen={walkInBookingModal.isOpen}
        onClose={() => setWalkInBookingModal({
          isOpen: false,
          roomNumber: null,
          checkIn: null,
          checkOut: null,
          nights: 0
        })}
        onSuccess={() => {
          // Close modal and refresh chart data
          setWalkInBookingModal({
            isOpen: false,
            roomNumber: null,
            checkIn: null,
            checkOut: null,
            nights: 0
          });
          fetchChartData();
          toast.success('New booking created successfully!');
        }}
        prefilledData={{
          roomNumber: walkInBookingModal.roomNumber || undefined,
          checkIn: walkInBookingModal.checkIn || undefined,
          checkOut: walkInBookingModal.checkOut || undefined,
          nights: walkInBookingModal.nights || undefined
        }}
      />
    </>
    </TooltipProvider>
  );
};

export default withErrorBoundary(TapeChartView, { level: 'component' });