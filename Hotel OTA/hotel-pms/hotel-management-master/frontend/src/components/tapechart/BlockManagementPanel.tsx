import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { toast } from '@/utils/toast';
import {
  Building2,
  Users,
  Calendar,
  Plus,
  Search,
  Filter,
  Edit,
  Trash2,
  Eye,
  Lock,
  Unlock,
  Clock,
  Star,
  AlertTriangle,
  CheckCircle,
  MoreHorizontal,
  Download,
  Upload,
  RefreshCw
} from 'lucide-react';
import { format, parseISO, addDays, differenceInDays } from 'date-fns';
import RoomBlockModal from './RoomBlockModal';
import tapeChartService from '@/services/tapeChartService';
import { cn } from '@/utils/cn';

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && error !== null && 'message' in error) return String((error as Record<string, unknown>).message);
  return 'An unexpected error occurred';
};

interface RoomBlock {
  _id: string;
  blockName: string;
  groupName: string;
  eventType: string;
  startDate: string;
  endDate: string;
  rooms: Array<{
    roomId: string;
    roomNumber: string;
    roomType: string;
    status: 'blocked' | 'reserved' | 'occupied' | 'released';
    guestName?: string;
    specialRequests?: string;
  }>;
  totalRooms: number;
  roomsBooked: number;
  roomsReleased: number;
  status: 'active' | 'completed' | 'cancelled';
  contactPerson: {
    name?: string;
    email?: string;
    phone?: string;
    title?: string;
  };
  billingInstructions: string;
  specialInstructions?: string;
  vipStatus?: 'standard' | 'vip' | 'corporate';
  cutOffDate?: string;
  autoReleaseDate?: string;
  createdBy: string;
}

interface BlockManagementPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onBlockCreate?: (block: RoomBlock) => void;
  onBlockUpdate?: (block: RoomBlock) => void;
  onBlockDelete?: (blockId: string) => void;
  className?: string;
}

const BlockManagementPanel: React.FC<BlockManagementPanelProps> = ({
  isOpen,
  onClose,
  onBlockCreate,
  onBlockUpdate,
  onBlockDelete,
  className
}) => {
  const [blocks, setBlocks] = useState<RoomBlock[]>([]);
  const [filteredBlocks, setFilteredBlocks] = useState<RoomBlock[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [eventTypeFilter, setEventTypeFilter] = useState<string>('all');
  const [selectedBlock, setSelectedBlock] = useState<RoomBlock | null>(null);
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [showBlockDetails, setShowBlockDetails] = useState(false);

  // Fetch blocks data
  useEffect(() => {
    if (isOpen) {
      fetchBlocks();
    }
  }, [isOpen]);

  // Filter blocks based on search and filters
  useEffect(() => {
    let filtered = blocks;

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(block =>
        block.blockName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        block.groupName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        block.contactPerson.name?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(block => block.status === statusFilter);
    }

    // Event type filter
    if (eventTypeFilter !== 'all') {
      filtered = filtered.filter(block => block.eventType === eventTypeFilter);
    }

    // Sort by creation date (newest first)
    filtered.sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());

    setFilteredBlocks(filtered);
  }, [blocks, searchTerm, statusFilter, eventTypeFilter]);

  const fetchBlocks = async () => {
    try {
      setLoading(true);
      const response = await tapeChartService.getRoomBlocks();
      setBlocks(response.data || []);
    } catch (error) {
      toast.error('Failed to load room blocks');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateBlock = async (blockData: Record<string, unknown>) => {
    try {
      const response = await tapeChartService.createRoomBlock(blockData);
      toast.success('Room block created successfully');
      fetchBlocks();
      setShowBlockModal(false);
      onBlockCreate?.(response.data);
    } catch (error: unknown) {
      toast.error(getErrorMessage(error));
    }
  };

  const handleUpdateBlock = async (blockData: Record<string, unknown>) => {
    if (!selectedBlock) return;

    try {
      const response = await tapeChartService.updateRoomBlock(selectedBlock._id, blockData);
      toast.success('Room block updated successfully');
      fetchBlocks();
      setShowBlockModal(false);
      setSelectedBlock(null);
      onBlockUpdate?.(response.data);
    } catch (error: unknown) {
      toast.error(getErrorMessage(error));
    }
  };

  const handleDeleteBlock = async (blockId: string) => {
    const confirmed = window.confirm('Are you sure you want to delete this room block?');
    if (!confirmed) return;

    try {
      await tapeChartService.releaseRoomBlock(blockId);
      toast.success('Room block deleted successfully');
      fetchBlocks();
      onBlockDelete?.(blockId);
    } catch (error: unknown) {
      toast.error(getErrorMessage(error));
    }
  };

  const handleReleaseBlock = async (blockId: string) => {
    const confirmed = window.confirm('Are you sure you want to release this room block?');
    if (!confirmed) return;

    try {
      await tapeChartService.releaseRoomBlock(blockId);
      toast.success('Room block released successfully');
      fetchBlocks();
    } catch (error: unknown) {
      toast.error(getErrorMessage(error));
    }
  };

  const getStatusColor = (status: string) => {
    const colors = {
      active: 'bg-green-100 text-green-800 border-green-200',
      completed: 'bg-blue-100 text-blue-800 border-blue-200',
      cancelled: 'bg-red-100 text-red-800 border-red-200'
    };
    return colors[status as keyof typeof colors] || colors.active;
  };

  const getEventTypeIcon = (eventType: string) => {
    const icons = {
      conference: <Building2 className="w-4 h-4" />,
      wedding: <Star className="w-4 h-4" />,
      corporate_event: <Users className="w-4 h-4" />,
      tour_group: <Users className="w-4 h-4" />,
      other: <Calendar className="w-4 h-4" />
    };
    return icons[eventType as keyof typeof icons] || icons.other;
  };

  const getOccupancyRate = (block: RoomBlock) => {
    if (block.totalRooms === 0) return 0;
    return Math.round((block.roomsBooked / block.totalRooms) * 100);
  };

  const getDaysUntilEvent = (startDate: string) => {
    const eventDate = parseISO(startDate);
    const today = new Date();
    return differenceInDays(eventDate, today);
  };

  const getBlockDuration = (startDate: string, endDate: string) => {
    return differenceInDays(parseISO(endDate), parseISO(startDate));
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Room Block Management
            </DialogTitle>
          </DialogHeader>

          <div className="flex flex-col h-full space-y-4">
            {/* Header Actions */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    placeholder="Search blocks..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-8 w-64"
                  />
                </div>

                {/* Filters */}
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-32">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={eventTypeFilter} onValueChange={setEventTypeFilter}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Event Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="conference">Conference</SelectItem>
                    <SelectItem value="wedding">Wedding</SelectItem>
                    <SelectItem value="corporate_event">Corporate Event</SelectItem>
                    <SelectItem value="tour_group">Tour Group</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={fetchBlocks}
                  disabled={loading}
                >
                  <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
                </Button>
                <Button
                  onClick={() => {
                    setSelectedBlock(null);
                    setShowBlockModal(true);
                  }}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Create Block
                </Button>
              </div>
            </div>

            {/* Stats Overview */}
            <div className="grid grid-cols-5 gap-4">
              <div className="bg-blue-50 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-blue-700">{blocks.filter(b => b.status === 'active').length}</div>
                <div className="text-sm text-blue-600">Active Blocks</div>
              </div>
              <div className="bg-green-50 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-green-700">{blocks.reduce((sum, b) => sum + b.totalRooms, 0)}</div>
                <div className="text-sm text-green-600">Total Rooms</div>
              </div>
              <div className="bg-amber-50 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-amber-700">{blocks.reduce((sum, b) => sum + b.roomsBooked, 0)}</div>
                <div className="text-sm text-amber-600">Rooms Booked</div>
              </div>
              <div className="bg-purple-50 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-purple-700">{blocks.filter(b => getDaysUntilEvent(b.startDate) <= 7 && getDaysUntilEvent(b.startDate) >= 0).length}</div>
                <div className="text-sm text-purple-600">This Week</div>
              </div>
              <div className="bg-red-50 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-red-700">{blocks.filter(b => getDaysUntilEvent(b.startDate) < 0).length}</div>
                <div className="text-sm text-red-600">Overdue</div>
              </div>
            </div>

            {/* Blocks List */}
            <div className="flex-1 overflow-hidden">
              <ScrollArea className="h-full">
                {loading ? (
                  <div className="space-y-3">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <div key={i} className="animate-pulse">
                        <div className="h-24 bg-gray-200 rounded-lg"></div>
                      </div>
                    ))}
                  </div>
                ) : filteredBlocks.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <Building2 className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                    <p>No room blocks found</p>
                    <p className="text-sm">Try adjusting your filters or create a new block</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredBlocks.map(block => (
                      <Card key={block._id} className="hover:shadow-md transition-shadow">
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4 flex-1">
                              {/* Event Type Icon */}
                              <div className="flex-shrink-0">
                                {getEventTypeIcon(block.eventType)}
                              </div>

                              {/* Block Info */}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <h4 className="font-medium truncate">{block.blockName}</h4>
                                  <Badge className={getStatusColor(block.status)}>
                                    {block.status}
                                  </Badge>
                                  {block.vipStatus === 'vip' && (
                                    <Star className="w-4 h-4 text-yellow-500" />
                                  )}
                                </div>
                                <div className="flex items-center gap-4 text-sm text-gray-600">
                                  <span>{block.groupName}</span>
                                  <span>•</span>
                                  <span>{format(parseISO(block.startDate), 'MMM dd')} - {format(parseISO(block.endDate), 'MMM dd')}</span>
                                  <span>•</span>
                                  <span>{block.roomsBooked}/{block.totalRooms} rooms</span>
                                  <span>•</span>
                                  <span>{getOccupancyRate(block)}% occupied</span>
                                </div>
                                {block.contactPerson.name && (
                                  <div className="text-sm text-gray-500 mt-1">
                                    Contact: {block.contactPerson.name}
                                  </div>
                                )}
                              </div>

                              {/* Progress Indicator */}
                              <div className="flex-shrink-0 w-24">
                                <div className="bg-gray-200 rounded-full h-2">
                                  <div
                                    className="bg-blue-500 h-2 rounded-full"
                                    style={{ width: `${getOccupancyRate(block)}%` }}
                                  />
                                </div>
                                <div className="text-xs text-center mt-1 text-gray-500">
                                  {getOccupancyRate(block)}%
                                </div>
                              </div>

                              {/* Days Until Event */}
                              <div className="flex-shrink-0 text-center">
                                <div className="text-lg font-bold text-gray-700">
                                  {getDaysUntilEvent(block.startDate)}
                                </div>
                                <div className="text-xs text-gray-500">
                                  {getDaysUntilEvent(block.startDate) === 0 ? 'Today' :
                                   getDaysUntilEvent(block.startDate) === 1 ? 'Tomorrow' :
                                   getDaysUntilEvent(block.startDate) > 0 ? 'days' : 'overdue'}
                                </div>
                              </div>
                            </div>

                            {/* Actions */}
                            <div className="flex items-center gap-2 ml-4">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      setSelectedBlock(block);
                                      setShowBlockDetails(true);
                                    }}
                                  >
                                    <Eye className="w-4 h-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>View Details</TooltipContent>
                              </Tooltip>

                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      setSelectedBlock(block);
                                      setShowBlockModal(true);
                                    }}
                                  >
                                    <Edit className="w-4 h-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Edit Block</TooltipContent>
                              </Tooltip>

                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleReleaseBlock(block._id)}
                                    disabled={block.status !== 'active'}
                                  >
                                    <Unlock className="w-4 h-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Release Block</TooltipContent>
                              </Tooltip>

                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleDeleteBlock(block._id)}
                                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Delete Block</TooltipContent>
                              </Tooltip>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Room Block Modal */}
      <RoomBlockModal
        isOpen={showBlockModal}
        onClose={() => {
          setShowBlockModal(false);
          setSelectedBlock(null);
        }}
        onSave={selectedBlock ? handleUpdateBlock : handleCreateBlock}
        blockData={selectedBlock}
      />

      {/* Block Details Modal */}
      {selectedBlock && (
        <Dialog open={showBlockDetails} onOpenChange={setShowBlockDetails}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {getEventTypeIcon(selectedBlock.eventType)}
                {selectedBlock.blockName}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="font-medium">Group Name</label>
                  <p className="text-gray-600">{selectedBlock.groupName}</p>
                </div>
                <div>
                  <label className="font-medium">Event Type</label>
                  <p className="text-gray-600 capitalize">{selectedBlock.eventType.replace('_', ' ')}</p>
                </div>
                <div>
                  <label className="font-medium">Duration</label>
                  <p className="text-gray-600">
                    {format(parseISO(selectedBlock.startDate), 'MMM dd, yyyy')} - {format(parseISO(selectedBlock.endDate), 'MMM dd, yyyy')}
                    <span className="text-sm text-gray-500 ml-2">({getBlockDuration(selectedBlock.startDate, selectedBlock.endDate)} days)</span>
                  </p>
                </div>
                <div>
                  <label className="font-medium">Status</label>
                  <div className="flex items-center gap-2">
                    <Badge className={getStatusColor(selectedBlock.status)}>
                      {selectedBlock.status}
                    </Badge>
                    {selectedBlock.vipStatus === 'vip' && (
                      <Star className="w-4 h-4 text-yellow-500" />
                    )}
                  </div>
                </div>
              </div>

              <div>
                <label className="font-medium">Room Allocation</label>
                <div className="bg-gray-50 rounded-lg p-3 mt-1">
                  <div className="flex justify-between items-center mb-2">
                    <span>Progress: {selectedBlock.roomsBooked}/{selectedBlock.totalRooms} rooms</span>
                    <span className="font-medium">{getOccupancyRate(selectedBlock)}%</span>
                  </div>
                  <div className="bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-500 h-2 rounded-full"
                      style={{ width: `${getOccupancyRate(selectedBlock)}%` }}
                    />
                  </div>
                </div>
              </div>

              {selectedBlock.contactPerson.name && (
                <div>
                  <label className="font-medium">Contact Person</label>
                  <div className="bg-gray-50 rounded-lg p-3 mt-1">
                    <div className="font-medium">{selectedBlock.contactPerson.name}</div>
                    {selectedBlock.contactPerson.title && (
                      <div className="text-sm text-gray-600">{selectedBlock.contactPerson.title}</div>
                    )}
                    {selectedBlock.contactPerson.email && (
                      <div className="text-sm text-gray-600">{selectedBlock.contactPerson.email}</div>
                    )}
                    {selectedBlock.contactPerson.phone && (
                      <div className="text-sm text-gray-600">{selectedBlock.contactPerson.phone}</div>
                    )}
                  </div>
                </div>
              )}

              {selectedBlock.specialInstructions && (
                <div>
                  <label className="font-medium">Special Instructions</label>
                  <p className="text-gray-600 bg-gray-50 rounded-lg p-3 mt-1">{selectedBlock.specialInstructions}</p>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
};

export default BlockManagementPanel;