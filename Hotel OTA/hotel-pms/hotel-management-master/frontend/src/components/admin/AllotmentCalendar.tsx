import React, { useState, useEffect, useMemo } from 'react';
import { api } from '@/services/api';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  DragDropContext,
  Droppable,
  Draggable,
  DropResult,
} from '@hello-pangea/dnd';
import {
  addDays,
  format,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameDay,
  parseISO,
} from 'date-fns';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Edit,
  Copy,
  Trash2,
  Plus,
  AlertTriangle,
  TrendingUp,
  Eye,
} from 'lucide-react';
import { toast } from 'sonner';

export interface RoomType {
  _id: string;
  name: string;
  totalInventory: number;
  basePrice: number;
}

export interface Channel {
  name: string;
  type: 'DIRECT' | 'BOOKING_COM' | 'EXPEDIA' | 'AIRBNB' | 'AGODA' | 'HOTELS_COM';
  allocation: number;
  priority: number;
  commission: number;
  restrictions: {
    minStay?: number;
    maxStay?: number;
    closedToArrival?: boolean;
    closedToDeparture?: boolean;
  };
  color: string;
}

export interface DailyAllotment {
  date: string;
  totalInventory: number;
  channels: {
    channelName: string;
    allocated: number;
    booked: number;
    remaining: number;
  }[];
  occupancyRate: number;
  revenue: number;
  warnings: string[];
}

export interface AllotmentData {
  _id: string;
  roomTypeId: string;
  roomTypeName: string;
  channels: Channel[];
  dailyAllotments: DailyAllotment[];
  allocationMethod: 'PERCENTAGE' | 'FIXED' | 'PRIORITY' | 'DYNAMIC';
  lastUpdated: string;
}

interface AllotmentCalendarProps {
  roomTypes: RoomType[];
  selectedRoomType: string;
  onRoomTypeChange: (roomTypeId: string) => void;
  dateRange: { start: Date; end: Date };
  onDateRangeChange: (range: { start: Date; end: Date }) => void;
}

const CHANNEL_COLORS: Record<string, string> = {
  DIRECT: '#3b82f6',
  BOOKING_COM: '#0066cc',
  EXPEDIA: '#ffd700',
  AIRBNB: '#ff5a5f',
  AGODA: '#d4237a',
  HOTELS_COM: '#e53e3e',
};

export default function AllotmentCalendar({
  roomTypes,
  selectedRoomType,
  onRoomTypeChange,
  dateRange,
  onDateRangeChange,
}: AllotmentCalendarProps) {
  const [allotmentData, setAllotmentData] = useState<AllotmentData | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'week' | 'month'>('week');
  const [tempAllocations, setTempAllocations] = useState<Record<string, number>>({});

  // Generate calendar dates based on view mode
  const calendarDates = useMemo(() => {
    if (viewMode === 'week') {
      const start = startOfWeek(dateRange.start);
      const end = endOfWeek(dateRange.end);
      return eachDayOfInterval({ start, end });
    } else {
      return eachDayOfInterval(dateRange);
    }
  }, [dateRange, viewMode]);

  // Load allotment data for selected room type
  useEffect(() => {
    if (selectedRoomType) {
      loadAllotmentData();
    }
  }, [selectedRoomType, dateRange]);

  const loadAllotmentData = async () => {

    setLoading(true);
    try {
      const apiUrl = `/allotments/room-type/${selectedRoomType}`;
      const params = {
        startDate: format(dateRange.start, 'yyyy-MM-dd'),
        endDate: format(dateRange.end, 'yyyy-MM-dd'),
      };


      const response = await api.get(apiUrl, { params });


      if (response.data && response.data.success) {
        setAllotmentData(response.data.data);

        if (response.data.data?.dailyAllotments) {
        }

        if (response.data.data?.channels) {
        }
      } else {
        throw new Error('Failed to load allotment data - invalid response structure');
      }
    } catch (error) {
      const axiosErr = error as { response?: { data?: { error?: string } } };
      toast.error('Failed to load allotment data: ' + (axiosErr.response?.data?.error || (error instanceof Error ? error.message : 'Unknown error')));
    } finally {
      setLoading(false);
    }
  };

  const handleDragEnd = async (result: DropResult) => {
    const { destination, source, draggableId } = result;
    
    if (!destination || !allotmentData) return;
    if (destination.droppableId === source.droppableId && 
        destination.index === source.index) return;

    const [sourceDate, sourceChannel] = source.droppableId.split('-');
    const [destDate, destChannel] = destination.droppableId.split('-');
    const draggedAmount = parseInt(draggableId.split('-')[2]);

    // Update allocations locally first for immediate feedback
    const updatedData = { ...allotmentData };
    const sourceDayIndex = updatedData.dailyAllotments.findIndex(d => d.date === sourceDate);
    const destDayIndex = updatedData.dailyAllotments.findIndex(d => d.date === destDate);

    if (sourceDayIndex >= 0 && destDayIndex >= 0) {
      const sourceChannelIndex = updatedData.dailyAllotments[sourceDayIndex].channels
        .findIndex(c => c.channelName === sourceChannel);
      const destChannelIndex = updatedData.dailyAllotments[destDayIndex].channels
        .findIndex(c => c.channelName === destChannel);

      if (sourceChannelIndex >= 0 && destChannelIndex >= 0) {
        // Move allocation from source to destination
        updatedData.dailyAllotments[sourceDayIndex].channels[sourceChannelIndex].allocated -= draggedAmount;
        updatedData.dailyAllotments[sourceDayIndex].channels[sourceChannelIndex].remaining -= draggedAmount;
        
        updatedData.dailyAllotments[destDayIndex].channels[destChannelIndex].allocated += draggedAmount;
        updatedData.dailyAllotments[destDayIndex].channels[destChannelIndex].remaining += draggedAmount;

        setAllotmentData(updatedData);

        // Sync with backend
        try {
          const response = await api.post(`/allotments/${allotmentData._id}/allocate`, {
            date: destDate,
            channelAllocations: updatedData.dailyAllotments[destDayIndex].channels.map(c => ({
              channelName: c.channelName,
              allocated: c.allocated,
            })),
          });

          if (!response.data) {
            throw new Error('Failed to update allocation');
          }

          toast.success('Allocation updated successfully');
        } catch (error) {
          toast.error('Failed to update allocation');
          // Revert changes on error
          loadAllotmentData();
        }
      }
    }
  };

  const handleQuickEdit = (date: string) => {
    setSelectedDate(date);
    const dayData = allotmentData?.dailyAllotments?.find(d => {
      const dailyDateStr = typeof d.date === 'string' ? d.date.split('T')[0] : format(new Date(d.date), 'yyyy-MM-dd');
      return dailyDateStr === date;
    });
    if (dayData) {
      const allocations: Record<string, number> = {};
      dayData.channels?.forEach(c => {
        allocations[c.channelName] = c.allocated;
      });
      setTempAllocations(allocations);
    }
    setEditDialogOpen(true);
  };

  const handleSaveAllocations = async () => {
    if (!selectedDate || !allotmentData) return;

    try {
      const response = await api.post(`/allotments/${allotmentData._id}/allocate`, {
        date: selectedDate,
        channelAllocations: Object.entries(tempAllocations).map(([channelName, allocated]) => ({
          channelName,
          allocated,
        })),
      });

      if (response.data?.success !== false) {
        toast.success('Allocations updated successfully');
        setEditDialogOpen(false);
        loadAllotmentData();
      } else {
        throw new Error('Failed to update allocations');
      }
    } catch {
      toast.error('Failed to update allocations');
    }
  };

  const handleCopyAllocations = async (fromDate: string, toDate: string) => {
    if (!allotmentData) return;

    const sourceDay = allotmentData.dailyAllotments.find(d => d.date === fromDate);
    if (!sourceDay) return;

    try {
      const response = await api.post(`/allotments/${allotmentData._id}/allocate`, {
        date: toDate,
        channelAllocations: sourceDay.channels.map(c => ({
          channelName: c.channelName,
          allocated: c.allocated,
        })),
      });

      if (response.data) {
        toast.success('Allocations copied successfully');
        loadAllotmentData();
      } else {
        throw new Error('Failed to copy allocations');
      }
    } catch (error) {
      toast.error('Failed to copy allocations');
    }
  };

  const navigateWeek = (direction: 'prev' | 'next') => {
    const days = viewMode === 'week' ? 7 : 30;
    const newStart = addDays(dateRange.start, direction === 'next' ? days : -days);
    const newEnd = addDays(dateRange.end, direction === 'next' ? days : -days);
    onDateRangeChange({ start: newStart, end: newEnd });
  };

  const getDayData = (date: Date): DailyAllotment | undefined => {
    const dateStr = format(date, 'yyyy-MM-dd');

    return allotmentData?.dailyAllotments?.find(d => {
      // Handle both date string formats: "2025-09-15" and "2025-09-15T10:14:21.868Z"
      const dailyDateStr = typeof d.date === 'string' ? d.date.split('T')[0] : format(new Date(d.date), 'yyyy-MM-dd');
      return dailyDateStr === dateStr;
    });
  };

  const getOccupancyColor = (rate: number): string => {
    if (rate >= 90) return 'bg-red-100 text-red-800';
    if (rate >= 75) return 'bg-yellow-100 text-yellow-800';
    if (rate >= 50) return 'bg-blue-100 text-blue-800';
    return 'bg-gray-100 text-gray-800';
  };

  if (!selectedRoomType) {
    return (
      <Card className="h-96 flex items-center justify-center">
        <CardContent>
          <p className="text-muted-foreground">Select a room type to view allotments</p>
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card className="h-96 flex items-center justify-center">
        <CardContent>
          <div className="flex flex-col items-center space-y-3">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
            <p className="text-muted-foreground">Loading allotment data...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <TooltipProvider>
      <div className="space-y-4">
        {/* Calendar Controls */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigateWeek('prev')}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <div className="text-lg font-semibold">
                  {format(dateRange.start, 'MMM d')} - {format(dateRange.end, 'MMM d, yyyy')}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigateWeek('next')}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
              
              <div className="flex items-center space-x-2">
                <Select value={viewMode} onValueChange={(value: 'week' | 'month') => setViewMode(value)}>
                  <SelectTrigger className="w-24">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="week">Week</SelectItem>
                    <SelectItem value="month">Month</SelectItem>
                  </SelectContent>
                </Select>
                
                <Button variant="outline" size="sm" onClick={loadAllotmentData}>
                  <CalendarIcon className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Calendar Grid */}
        <DragDropContext onDragEnd={handleDragEnd}>
          <div className="grid grid-cols-7 gap-2">
            {/* Header */}
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div key={day} className="p-3 text-center font-medium text-sm bg-muted rounded-t">
                {day}
              </div>
            ))}
            
            {/* Calendar Days */}
            {calendarDates.map(date => {
              const dayData = getDayData(date);
              const dateStr = format(date, 'yyyy-MM-dd');
              
              return (
                <Card key={dateStr} className="min-h-32">
                  <CardContent className="p-2 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">
                        {format(date, 'd')}
                      </span>
                      {dayData && (
                        <div className="flex items-center space-x-1">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Badge 
                                variant="secondary" 
                                className={`text-xs ${getOccupancyColor(dayData.occupancyRate)}`}
                              >
                                {dayData.occupancyRate.toFixed(0)}%
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Occupancy Rate: {dayData.occupancyRate.toFixed(1)}%</p>
                              <p>Revenue: ${dayData.revenue}</p>
                            </TooltipContent>
                          </Tooltip>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0"
                            onClick={() => handleQuickEdit(dateStr)}
                          >
                            <Edit className="h-3 w-3" />
                          </Button>
                        </div>
                      )}
                    </div>
                    
                    {dayData ? (
                      <div className="space-y-1">
                        {dayData.channels?.map(channel => (
                          <Droppable key={channel.channelName} droppableId={`${dateStr}-${channel.channelName}`}>
                            {(provided, snapshot) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.droppableProps}
                                className={`p-1 rounded text-xs ${
                                  snapshot.isDraggingOver ? 'bg-blue-50' : 'bg-gray-50'
                                }`}
                                style={{
                                  borderLeft: `3px solid ${CHANNEL_COLORS[channel.channelName] || '#666'}`
                                }}
                              >
                                <div className="flex items-center justify-between">
                                  <span className="font-medium text-xs truncate">
                                    {channel.channelName}
                                  </span>
                                  <div className="text-xs">
                                    {channel.remaining}/{channel.allocated}
                                  </div>
                                </div>
                                
                                {channel.allocated > 0 && (
                                  <Draggable
                                    draggableId={`${dateStr}-${channel.channelName}-${channel.allocated}`}
                                    index={0}
                                  >
                                    {(provided, snapshot) => (
                                      <div
                                        ref={provided.innerRef}
                                        {...provided.draggableProps}
                                        {...provided.dragHandleProps}
                                        className={`mt-1 p-1 rounded cursor-move ${
                                          snapshot.isDragging ? 'bg-white shadow-md' : 'bg-white'
                                        }`}
                                      >
                                        <div className="text-xs text-center">
                                          {channel.allocated}
                                        </div>
                                      </div>
                                    )}
                                  </Draggable>
                                )}
                                
                                {channel.remaining < channel.allocated * 0.2 && (
                                  <AlertTriangle className="h-3 w-3 text-orange-500 mt-1" />
                                )}
                                
                                {provided.placeholder}
                              </div>
                            )}
                          </Droppable>
                        ))}
                        
                        {dayData.warnings?.length > 0 && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="flex items-center justify-center">
                                <AlertTriangle className="h-4 w-4 text-red-500" />
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>
                              <div className="space-y-1">
                                {dayData.warnings?.map((warning, idx) => (
                                  <p key={idx} className="text-xs">{warning}</p>
                                ))}
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center justify-center h-16 text-xs text-muted-foreground">
                        No data
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </DragDropContext>

        {/* Edit Dialog */}
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Edit Allocations</DialogTitle>
              <DialogDescription>
                {selectedDate && format(parseISO(selectedDate), 'MMMM d, yyyy')}
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              {allotmentData?.channels?.map(channel => (
                <div key={channel.name} className="space-y-2">
                  <Label>{channel.name}</Label>
                  <Input
                    type="number"
                    min="0"
                    value={tempAllocations[channel.name] || 0}
                    onChange={(e) => setTempAllocations(prev => ({
                      ...prev,
                      [channel.name]: parseInt(e.target.value) || 0
                    }))}
                  />
                </div>
              ))}
            </div>
            
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSaveAllocations}>
                Save Changes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}