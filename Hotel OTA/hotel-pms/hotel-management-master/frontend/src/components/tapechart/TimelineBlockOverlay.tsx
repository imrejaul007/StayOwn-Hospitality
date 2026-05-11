import React, { useState } from 'react';
import { cn } from '@/utils/cn';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Building2,
  Users,
  Calendar,
  Star,
  MoreHorizontal,
  Edit,
  Trash2,
  ExternalLink,
  Lock,
  Unlock
} from 'lucide-react';
import { format, parseISO, isSameDay } from 'date-fns';

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
  }>;
  totalRooms: number;
  roomsBooked: number;
  roomsReleased: number;
  status: 'active' | 'completed' | 'cancelled';
  contactPerson: {
    name?: string;
    email?: string;
    phone?: string;
  };
  vipStatus?: 'standard' | 'vip' | 'corporate';
}

interface TimelineBlockOverlayProps {
  roomBlocks: RoomBlock[];
  roomId: string;
  roomNumber: string;
  startDate: Date;
  endDate: Date;
  onBlockEdit?: (block: RoomBlock) => void;
  onBlockRelease?: (blockId: string, roomId: string) => void;
  onBlockExtend?: (blockId: string) => void;
  onBlockDetails?: (block: RoomBlock) => void;
  className?: string;
}

const TimelineBlockOverlay: React.FC<TimelineBlockOverlayProps> = ({
  roomBlocks,
  roomId,
  roomNumber,
  startDate,
  endDate,
  onBlockEdit,
  onBlockRelease,
  onBlockExtend,
  onBlockDetails,
  className
}) => {
  const [hoveredBlock, setHoveredBlock] = useState<string | null>(null);

  // Filter blocks that affect this room
  const relevantBlocks = roomBlocks.filter(block =>
    block.rooms.some(room => room.roomId === roomId || room.roomNumber === roomNumber)
  );

  // Calculate timeline positions for each block
  const getBlockPosition = (block: RoomBlock) => {
    const blockStart = parseISO(block.startDate);
    const blockEnd = parseISO(block.endDate);

    // Calculate overlap with current view
    const viewStart = startDate;
    const viewEnd = endDate;

    const effectiveStart = blockStart > viewStart ? blockStart : viewStart;
    const effectiveEnd = blockEnd < viewEnd ? blockEnd : viewEnd;

    if (effectiveStart >= effectiveEnd) {
      return null; // No overlap
    }

    const totalDays = Math.ceil((viewEnd.getTime() - viewStart.getTime()) / (1000 * 60 * 60 * 24));
    const startDay = Math.ceil((effectiveStart.getTime() - viewStart.getTime()) / (1000 * 60 * 60 * 24));
    const duration = Math.ceil((effectiveEnd.getTime() - effectiveStart.getTime()) / (1000 * 60 * 60 * 24));

    return {
      left: `${(startDay / totalDays) * 100}%`,
      width: `${(duration / totalDays) * 100}%`,
      effectiveStart,
      effectiveEnd,
      isPartial: blockStart < viewStart || blockEnd > viewEnd
    };
  };

  const getBlockTypeColor = (eventType: string, status: string) => {
    const colors = {
      conference: status === 'active' ? 'bg-blue-500' : 'bg-blue-300',
      wedding: status === 'active' ? 'bg-pink-500' : 'bg-pink-300',
      corporate_event: status === 'active' ? 'bg-purple-500' : 'bg-purple-300',
      tour_group: status === 'active' ? 'bg-green-500' : 'bg-green-300',
      other: status === 'active' ? 'bg-gray-500' : 'bg-gray-300'
    };

    return colors[eventType as keyof typeof colors] || colors.other;
  };

  const getVipIcon = (vipStatus?: string) => {
    switch (vipStatus) {
      case 'vip':
        return <Star className="w-3 h-3 text-yellow-400" />;
      case 'corporate':
        return <Building2 className="w-3 h-3 text-blue-400" />;
      default:
        return null;
    }
  };

  const getRoomInBlock = (block: RoomBlock) => {
    return block.rooms.find(room => room.roomId === roomId || room.roomNumber === roomNumber);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'blocked':
        return <Lock className="w-3 h-3" />;
      case 'reserved':
        return <Calendar className="w-3 h-3" />;
      case 'occupied':
        return <Users className="w-3 h-3" />;
      case 'released':
        return <Unlock className="w-3 h-3" />;
      default:
        return null;
    }
  };

  if (relevantBlocks.length === 0) {
    return null;
  }

  return (
    <div className={cn('absolute inset-0 pointer-events-none', className)}>
      {relevantBlocks.map((block, index) => {
        const position = getBlockPosition(block);
        if (!position) return null;

        const roomInBlock = getRoomInBlock(block);
        const isHovered = hoveredBlock === block._id;

        return (
          <Tooltip key={block._id}>
            <TooltipTrigger asChild>
              <div role="button" tabIndex={0}
                className={cn(
                  'absolute top-0 h-full pointer-events-auto cursor-pointer',
                  'border-l-2 border-r-2 border-opacity-60',
                  getBlockTypeColor(block.eventType, block.status),
                  'hover:opacity-90 transition-all duration-200',
                  isHovered && 'ring-2 ring-white ring-opacity-80 shadow-lg'
                )}
                style={{
                  left: position.left,
                  width: position.width,
                  zIndex: 10 + index,
                  borderColor: 'white'
                }}
                onMouseEnter={() => setHoveredBlock(block._id)}
                onMouseLeave={() => setHoveredBlock(null)}
                onClick={() => onBlockDetails?.(block)}
               onKeyDown={(e: React.KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); const clickHandler = () => onBlockDetails?.(block); if (typeof clickHandler === 'function') { clickHandler(e as any); } } }}>
                {/* Block content */}
                <div className="h-full flex items-center justify-between px-1 text-white text-xs">
                  <div className="flex items-center gap-1 min-w-0 flex-1">
                    {getVipIcon(block.vipStatus)}
                    {getStatusIcon(roomInBlock?.status || 'blocked')}
                    <span className="truncate font-medium">
                      {block.blockName.length > 10 ? `${block.blockName.substring(0, 10)}...` : block.blockName}
                    </span>
                  </div>

                  {/* Block actions - only show on hover */}
                  {isHovered && (
                    <div className="flex items-center gap-1 ml-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          onBlockEdit?.(block);
                        }}
                        className="h-4 w-4 p-0 hover:bg-white hover:bg-opacity-20"
                      >
                        <Edit className="w-2 h-2" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          onBlockRelease?.(block._id, roomId);
                        }}
                        className="h-4 w-4 p-0 hover:bg-white hover:bg-opacity-20"
                      >
                        <Unlock className="w-2 h-2" />
                      </Button>
                    </div>
                  )}
                </div>

                {/* Partial block indicators */}
                {position.isPartial && (
                  <>
                    {parseISO(block.startDate) < startDate && (
                      <div className="absolute left-0 top-0 h-full w-1 bg-white bg-opacity-60" />
                    )}
                    {parseISO(block.endDate) > endDate && (
                      <div className="absolute right-0 top-0 h-full w-1 bg-white bg-opacity-60" />
                    )}
                  </>
                )}

                {/* Status indicator */}
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white bg-opacity-40" />
                <div
                  className={cn(
                    'absolute bottom-0 left-0 h-0.5',
                    roomInBlock?.status === 'reserved' && 'bg-green-400',
                    roomInBlock?.status === 'occupied' && 'bg-blue-400',
                    roomInBlock?.status === 'released' && 'bg-red-400',
                    roomInBlock?.status === 'blocked' && 'bg-yellow-400'
                  )}
                  style={{ width: `${(block.roomsBooked / block.totalRooms) * 100}%` }}
                />
              </div>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs">
              <div className="space-y-2">
                <div className="font-medium flex items-center gap-2">
                  {getVipIcon(block.vipStatus)}
                  {block.blockName}
                </div>
                <div className="text-sm space-y-1">
                  <div><strong>Group:</strong> {block.groupName}</div>
                  <div><strong>Event:</strong> {block.eventType.replace('_', ' ')}</div>
                  <div><strong>Duration:</strong> {format(parseISO(block.startDate), 'MMM dd')} - {format(parseISO(block.endDate), 'MMM dd')}</div>
                  <div><strong>Rooms:</strong> {block.roomsBooked}/{block.totalRooms} booked</div>
                  <div><strong>Status:</strong>
                    <Badge variant="outline" className="ml-1 text-xs">
                      {roomInBlock?.status || 'blocked'}
                    </Badge>
                  </div>
                  {block.contactPerson.name && (
                    <div><strong>Contact:</strong> {block.contactPerson.name}</div>
                  )}
                </div>
                <div className="pt-1 border-t border-gray-200">
                  <div className="text-xs text-gray-500">
                    Click to view details • Hover for actions
                  </div>
                </div>
              </div>
            </TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
};

export default TimelineBlockOverlay;