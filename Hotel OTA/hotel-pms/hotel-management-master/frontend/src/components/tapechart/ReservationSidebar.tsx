import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import DraggableReservation from './DraggableReservation';
import { Search, Filter, Users, Clock, Star, CheckSquare, Square, Zap, ChevronLeft, ChevronRight, Hotel, UserPlus, CalendarCheck } from 'lucide-react';
import { cn } from '@/utils/cn';
import { bookingService } from '@/services/bookingService';
import { dragDropManager } from '@/utils/DragDropManager';
import { format } from 'date-fns';

interface Reservation {
  id: string;
  _id: string; // MongoDB ObjectId
  bookingNumber: string;
  guestName: string;
  roomType: string;
  checkIn: string;
  checkOut: string;
  status: 'confirmed' | 'pending' | 'cancelled' | 'checked_in' | 'checked_out' | 'no_show';
  vipStatus?: 'none' | 'vip' | 'svip' | 'corporate';
  rate?: number;
  specialRequests?: string[];
  nights: number;
  adults: number;
  children: number;
  assignedRoom?: string;
  priority?: 'high' | 'medium' | 'low';
  arrivalTime?: string;
  phoneNumber?: string;
  email?: string;
  companyName?: string;
  totalAmount: number;
  paymentStatus: string;
  source?: string;
}

interface ReservationSidebarProps {
  onDragStart: (e: React.DragEvent, reservation: Record<string, unknown>) => void;
  selectedDate: Date;
  endDate?: Date;
  isCompact?: boolean;
  className?: string;
  refreshTrigger?: number; // Add refresh trigger prop
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

const ReservationSidebar: React.FC<ReservationSidebarProps> = ({
  onDragStart,
  selectedDate,
  endDate: endDateProp,
  isCompact = false,
  className,
  refreshTrigger,
  isCollapsed = false,
  onToggleCollapse
}) => {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [filteredReservations, setFilteredReservations] = useState<Reservation[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [roomTypeFilter, setRoomTypeFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'all' | 'unassigned' | 'assigned'>('unassigned');
  const [loading, setLoading] = useState(true);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedCount, setSelectedCount] = useState(0);

  // Fetch real booking data from the database
  useEffect(() => {
    fetchReservations();
  }, [selectedDate, refreshTrigger]);

  // Update selection count when selection changes
  useEffect(() => {
    const updateSelectionCount = () => {
      setSelectedCount(dragDropManager.getSelectionCount());
    };

    // Update count initially
    updateSelectionCount();

    // Set up an interval to check for changes (since we don't have events from dragDropManager)
    const interval = setInterval(updateSelectionCount, 100);

    return () => clearInterval(interval);
  }, [selectionMode]);

  const fetchReservations = async () => {
    try {
      setLoading(true);
      
      // Get bookings for the selected date range (check-ins and current stays)
      const startDate = format(selectedDate, 'yyyy-MM-dd');
      const endDatePlusWeek = endDateProp
        ? format(endDateProp, 'yyyy-MM-dd')
        : format(new Date(selectedDate.getTime() + 7 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd');
      
      const response = await bookingService.getBookings({
        // Get bookings that overlap with the tape chart date range
        status: statusFilter === 'all' ? 'confirmed,pending,checked_in' : statusFilter,
        startDate: startDate,
        endDate: endDatePlusWeek,
        page: 1,
        limit: 100
      });
      
      if (response.status === 'success' && response.data && Array.isArray(response.data)) {
        const bookings = response.data;
        
        // Transform booking data to match Reservation interface
        const transformedReservations: Reservation[] = bookings.map((booking: Record<string, unknown>) => {
          // Determine priority based on booking characteristics
          let priority: 'high' | 'medium' | 'low' = 'medium';
          if (booking.guestDetails?.adults > 3 || booking.totalAmount > 20000) {
            priority = 'high';
          } else if (booking.totalAmount < 5000) {
            priority = 'low';
          }
          
          // Determine VIP status based on total amount or corporate booking
          let vipStatus: 'none' | 'vip' | 'svip' | 'corporate' = 'none';
          if (booking.corporateBooking?.corporateCompanyId) {
            vipStatus = 'corporate';
          } else if (booking.totalAmount > 25000) {
            vipStatus = 'svip';
          } else if (booking.totalAmount > 15000) {
            vipStatus = 'vip';
          }
          
          return {
            id: booking._id,
            _id: booking._id,
            bookingNumber: booking.bookingNumber,
            guestName: booking.userId?.name || 'Unknown Guest',
            roomType: booking.roomType || booking.rooms?.[0]?.roomId?.type || 'Unknown',
            checkIn: format(new Date(booking.checkIn), 'yyyy-MM-dd'),
            checkOut: format(new Date(booking.checkOut), 'yyyy-MM-dd'),
            status: booking.status,
            vipStatus,
            rate: booking.rooms?.[0]?.rate || 0,
            specialRequests: booking.guestDetails?.specialRequests ? [booking.guestDetails.specialRequests] : [],
            nights: booking.nights,
            adults: booking.guestDetails?.adults || 1,
            children: booking.guestDetails?.children || 0,
            assignedRoom: booking.rooms?.[0]?.roomId?.roomNumber,
            priority,
            phoneNumber: booking.userId?.phone,
            email: booking.userId?.email,
            companyName: booking.corporateBooking?.corporateCompanyId?.name,
            totalAmount: booking.totalAmount,
            paymentStatus: booking.paymentStatus,
            source: booking.source
          };
        });
        
        setReservations(transformedReservations);
      } else {
        setReservations([]);
      }
    } catch (error) {
      // Fall back to empty array instead of mock data
      setReservations([]);
    } finally {
      setLoading(false);
    }
  };

  // Filter reservations based on search and filters
  useEffect(() => {
    let filtered = reservations;

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(res => 
        res.guestName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        res.roomType.toLowerCase().includes(searchTerm.toLowerCase()) ||
        res.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        res.phoneNumber?.includes(searchTerm)
      );
    }

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(res => res.status === statusFilter);
    }

    // Priority filter
    if (priorityFilter !== 'all') {
      filtered = filtered.filter(res => res.priority === priorityFilter);
    }

    // Room type filter
    if (roomTypeFilter !== 'all') {
      filtered = filtered.filter(res => res.roomType === roomTypeFilter);
    }

    // View mode filter
    if (viewMode === 'unassigned') {
      filtered = filtered.filter(res => !res.assignedRoom);
    } else if (viewMode === 'assigned') {
      filtered = filtered.filter(res => res.assignedRoom);
    }
    // 'all' shows both assigned and unassigned

    setFilteredReservations(filtered);
  }, [reservations, searchTerm, statusFilter, priorityFilter, roomTypeFilter, viewMode]);

  const getPriorityIcon = (priority?: string) => {
    switch (priority) {
      case 'high': return <Star className="w-3 h-3 text-red-500" />;
      case 'medium': return <Clock className="w-3 h-3 text-yellow-500" />;
      case 'low': return <Users className="w-3 h-3 text-green-500" />;
      default: return null;
    }
  };

  const getStatusCount = (status: string) => {
    return reservations.filter(res => status === 'all' || res.status === status).length;
  };

  const unassignedCount = reservations.filter(res => !res.assignedRoom).length;
  const assignedCount = reservations.filter(res => res.assignedRoom).length;

  const handleSelectionModeToggle = () => {
    const newSelectionMode = !selectionMode;
    setSelectionMode(newSelectionMode);

    if (!newSelectionMode) {
      // Clear all selections when disabling selection mode
      dragDropManager.clearSelection();
      setSelectedCount(0);
    }
  };

  const handleSelectAll = () => {
    const visibleReservations = filteredReservations;
    visibleReservations.forEach(reservation => {
      dragDropManager.addToSelection(reservation.id);
    });
    setSelectedCount(dragDropManager.getSelectionCount());
  };

  const handleClearSelection = () => {
    dragDropManager.clearSelection();
    setSelectedCount(0);
  };

  const handleBulkAssignment = async () => {
    const selectedIds = dragDropManager.getSelectedReservations();
    const selectedReservations = reservations.filter(r => selectedIds.includes(r.id));

    if (selectedReservations.length === 0) {
      return;
    }

    // This would open a bulk assignment dialog or use smart assignment
    // TODO: Implement bulk assignment logic
  };

  // Render collapsed state with icons only
  if (isCollapsed) {
    return (
      <TooltipProvider>
        <Card className={cn(
          'h-full flex flex-col transition-all duration-300 w-16 bg-gradient-to-b from-white to-gray-50 border-r-2 border-gray-200 shadow-lg',
          className
        )}>
          <div className="p-2 space-y-4">
            {/* Toggle button */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onToggleCollapse}
                  className="w-full h-10 p-0 hover:bg-blue-50 transition-colors"
                >
                  <ChevronRight className="w-5 h-5 text-blue-600" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">
                <p>Expand Sidebar</p>
              </TooltipContent>
            </Tooltip>

            {/* Quick stats icons */}
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="relative">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full h-10 p-0 hover:bg-red-50 transition-colors"
                  >
                    <Hotel className="w-5 h-5 text-red-600" />
                  </Button>
                  {unassignedCount > 0 && (
                    <Badge className="absolute -top-1 -right-1 h-5 min-w-[20px] px-1 bg-red-600 text-white text-xs">
                      {unassignedCount}
                    </Badge>
                  )}
                </div>
              </TooltipTrigger>
              <TooltipContent side="right">
                <p>{unassignedCount} Unassigned Reservations</p>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <div className="relative">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full h-10 p-0 hover:bg-green-50 transition-colors"
                  >
                    <CalendarCheck className="w-5 h-5 text-green-600" />
                  </Button>
                  {assignedCount > 0 && (
                    <Badge className="absolute -top-1 -right-1 h-5 min-w-[20px] px-1 bg-green-600 text-white text-xs">
                      {assignedCount}
                    </Badge>
                  )}
                </div>
              </TooltipTrigger>
              <TooltipContent side="right">
                <p>{assignedCount} Assigned Reservations</p>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full h-10 p-0 hover:bg-blue-50 transition-colors"
                  onClick={() => setViewMode(viewMode === 'all' ? 'unassigned' : 'all')}
                >
                  <Users className="w-5 h-5 text-blue-600" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">
                <p>{reservations.length} Total Reservations</p>
              </TooltipContent>
            </Tooltip>

            {/* Add more icon shortcuts as needed */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full h-10 p-0 hover:bg-purple-50 transition-colors"
                  onClick={handleSelectionModeToggle}
                >
                  {selectionMode ? (
                    <CheckSquare className="w-5 h-5 text-purple-600" />
                  ) : (
                    <Square className="w-5 h-5 text-purple-600" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">
                <p>{selectionMode ? 'Disable' : 'Enable'} Selection Mode</p>
              </TooltipContent>
            </Tooltip>
          </div>
        </Card>
      </TooltipProvider>
    );
  }

  return (
    <Card className={cn(
      'h-full flex flex-col transition-all duration-300 bg-gradient-to-b from-white to-gray-50 border-r-2 border-gray-200 shadow-lg',
      className
    )}>
      <CardHeader className={cn('pb-3 bg-white border-b border-gray-200', isCompact && 'p-3')}>
        <CardTitle className={cn(
          'flex items-center justify-between',
          isCompact ? 'text-sm' : 'text-base'
        )}>
          <div className="flex items-center gap-2">
            {onToggleCollapse && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onToggleCollapse}
                className="p-0 h-6 w-6 hover:bg-gray-100"
              >
                <ChevronLeft className="w-4 h-4 text-gray-600" />
              </Button>
            )}
            <Hotel className="w-4 h-4 text-blue-600" />
            <span className="font-semibold text-gray-800">Reservations</span>
            {selectionMode && selectedCount > 0 && (
              <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                {selectedCount} selected
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-300">
              {filteredReservations.length}/{reservations.length}
            </Badge>
            <Button
              variant={selectionMode ? "default" : "outline"}
              size="sm"
              onClick={handleSelectionModeToggle}
              className={cn(
                'h-6 px-2',
                selectionMode
                  ? 'bg-blue-600 hover:bg-blue-700 text-white'
                  : 'border-blue-300 text-blue-600 hover:bg-blue-50'
              )}
            >
              {selectionMode ? <CheckSquare className="w-3 h-3" /> : <Square className="w-3 h-3" />}
            </Button>
          </div>
        </CardTitle>
        
        {/* Quick stats and selection controls */}
        {selectionMode ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Selection Mode Active</span>
              <div className="flex gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSelectAll}
                  disabled={filteredReservations.length === 0}
                  className="h-6 px-2 text-xs"
                >
                  Select All
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleClearSelection}
                  disabled={selectedCount === 0}
                  className="h-6 px-2 text-xs"
                >
                  Clear
                </Button>
              </div>
            </div>
            {selectedCount > 0 && (
              <div className="flex gap-2">
                <Button
                  variant="default"
                  size="sm"
                  onClick={handleBulkAssignment}
                  className="flex-1 h-7 text-xs bg-blue-600 hover:bg-blue-700"
                >
                  <Zap className="w-3 h-3 mr-1" />
                  Bulk Assign ({selectedCount})
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2 text-xs mt-3">
            <div className="text-center p-2.5 bg-gradient-to-br from-red-50 to-red-100 rounded-lg border border-red-200 shadow-sm hover:shadow-md transition-shadow cursor-pointer">
              <div className="font-bold text-lg text-red-700">{unassignedCount}</div>
              <div className="text-red-600 font-medium flex items-center justify-center gap-1">
                <Hotel className="w-3 h-3" />
                Unassigned
              </div>
            </div>
            <div className="text-center p-2.5 bg-gradient-to-br from-green-50 to-green-100 rounded-lg border border-green-200 shadow-sm hover:shadow-md transition-shadow cursor-pointer">
              <div className="font-bold text-lg text-green-700">{assignedCount}</div>
              <div className="text-green-600 font-medium flex items-center justify-center gap-1">
                <CalendarCheck className="w-3 h-3" />
                Assigned
              </div>
            </div>
          </div>
        )}
      </CardHeader>
      
      <CardContent className={cn('flex-1 flex flex-col gap-3 overflow-hidden bg-transparent', isCompact && 'p-3 pt-0')}>
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-blue-500" />
          <Input
            placeholder="Search reservations..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={cn(
              'pl-10 bg-white border-gray-300 focus:border-blue-400 focus:ring-blue-400 shadow-sm',
              isCompact && 'text-sm h-8'
            )}
          />
        </div>
        
        {/* Filters */}
        <div className="grid grid-cols-2 gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className={isCompact ? 'text-xs h-8' : 'text-sm'}>
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status ({getStatusCount('all')})</SelectItem>
              <SelectItem value="confirmed">Confirmed ({getStatusCount('confirmed')})</SelectItem>
              <SelectItem value="pending">Pending ({getStatusCount('pending')})</SelectItem>
              <SelectItem value="checked_in">Checked In ({getStatusCount('checked_in')})</SelectItem>
              <SelectItem value="checked_out">Checked Out ({getStatusCount('checked_out')})</SelectItem>
            </SelectContent>
          </Select>
          
          <Select value={priorityFilter} onValueChange={setPriorityFilter}>
            <SelectTrigger className={isCompact ? 'text-xs h-8' : 'text-sm'}>
              <SelectValue placeholder="Priority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Priority</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="low">Low</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        {/* View Mode Buttons */}
        <div className="flex items-center gap-2">
          <Button
            variant={viewMode === 'unassigned' ? "default" : "outline"}
            size="sm"
            onClick={() => setViewMode('unassigned')}
            className={cn(
              'flex items-center gap-1 shadow-sm',
              isCompact ? 'text-xs h-7' : 'text-sm h-8',
              viewMode === 'unassigned'
                ? 'bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 border-red-600 text-white shadow-md'
                : 'border-red-300 text-red-600 hover:bg-red-50 bg-white'
            )}
          >
            <Hotel className="w-3 h-3" />
            Unassigned
            <Badge className="bg-white/20 text-white border-0 px-1.5">{unassignedCount}</Badge>
          </Button>
          <Button
            variant={viewMode === 'assigned' ? "default" : "outline"}
            size="sm"
            onClick={() => setViewMode('assigned')}
            className={cn(
              'flex items-center gap-1 shadow-sm',
              isCompact ? 'text-xs h-7' : 'text-sm h-8',
              viewMode === 'assigned'
                ? 'bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 border-green-600 text-white shadow-md'
                : 'border-green-300 text-green-600 hover:bg-green-50 bg-white'
            )}
          >
            <CalendarCheck className="w-3 h-3" />
            Assigned
            <Badge className="bg-white/20 text-white border-0 px-1.5">{assignedCount}</Badge>
          </Button>
        </div>
        
        <div className="flex items-center justify-between">
          <Button
            variant={viewMode === 'all' ? "default" : "outline"}
            size="sm"
            onClick={() => setViewMode('all')}
            className={cn(
              'shadow-sm',
              isCompact ? 'text-xs h-7' : 'text-sm h-8',
              viewMode === 'all'
                ? 'bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white shadow-md'
                : 'bg-white hover:bg-gray-50'
            )}
          >
            <Users className="w-3 h-3 mr-1" />
            Show All
            <Badge className={cn(
              'ml-1 px-1.5',
              viewMode === 'all' ? 'bg-white/20 text-white border-0' : 'bg-blue-100 text-blue-700'
            )}>
              {reservations.length}
            </Badge>
          </Button>

          <Button
            variant="outline"
            size="sm"
            className={cn(
              'bg-white hover:bg-gray-50 border-gray-300 shadow-sm',
              isCompact ? 'text-xs h-7' : 'text-sm h-8'
            )}
          >
            <Filter className="w-3 h-3 mr-1 text-gray-600" />
            More Filters
          </Button>
        </div>
        
        {/* Reservations list */}
        <div className="flex-1 overflow-hidden bg-white rounded-lg border border-gray-200 shadow-inner">
          <ScrollArea className="h-full p-2">
            <div className="space-y-3">
              {loading ? (
                <div className="space-y-3">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="animate-pulse">
                      <div className="h-20 bg-gray-200 rounded-md"></div>
                    </div>
                  ))}
                </div>
              ) : filteredReservations.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <div className="relative inline-block">
                    <Users className="w-16 h-16 mx-auto mb-3 text-gray-300" />
                    <div className="absolute inset-0 bg-gradient-to-br from-blue-100 to-purple-100 rounded-full opacity-30 blur-xl"></div>
                  </div>
                  <p className={cn('font-medium text-gray-700', isCompact ? 'text-sm' : 'text-base')}>No reservations found</p>
                  <p className={cn('text-gray-500 mt-1', isCompact ? 'text-xs' : 'text-sm')}>Try adjusting your filters</p>
                </div>
              ) : (
                filteredReservations.map(reservation => (
                  <div key={reservation.id} className="relative">
                    <DraggableReservation
                      reservation={reservation}
                      onDragStart={onDragStart}
                      isCompact={isCompact}
                      selectionMode={selectionMode}
                      onSelectionChange={(selected) => {
                        // This will be handled automatically by the DragDropManager
                        // but we can add any additional logic here if needed
                        setSelectedCount(dragDropManager.getSelectionCount());
                      }}
                    />
                    
                    {/* Priority indicator */}
                    {reservation.priority && (
                      <div className="absolute top-1 right-1">
                        {getPriorityIcon(reservation.priority)}
                      </div>
                    )}
                    
                    {/* Assigned room badge */}
                    {reservation.assignedRoom && (
                      <div className="absolute bottom-1 right-1">
                        <Badge variant="secondary" className="text-xs">
                          Room {reservation.assignedRoom}
                        </Badge>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </div>
      </CardContent>
    </Card>
  );
};

export default ReservationSidebar;