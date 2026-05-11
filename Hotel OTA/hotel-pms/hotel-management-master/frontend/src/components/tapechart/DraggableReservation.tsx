import React, { useState, useEffect } from 'react';
import { cn } from '@/utils/cn';
import { Star, Crown, Coffee, Bell, User, Calendar, Check } from 'lucide-react';
import { formatCurrency } from '@/utils/currencyUtils';
import { dragDropManager } from '@/utils/DragDropManager';

interface DraggableReservationProps {
  reservation: {
    id: string;
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
  };
  onDragStart: (e: React.DragEvent, reservation: Record<string, unknown>) => void;
  isCompact?: boolean;
  selectionMode?: boolean;
  onSelectionChange?: (selected: boolean) => void;
}

const DraggableReservation: React.FC<DraggableReservationProps> = ({
  reservation,
  onDragStart,
  isCompact = false,
  selectionMode = false,
  onSelectionChange
}) => {
  const [isSelected, setIsSelected] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStarted, setDragStarted] = useState(false);

  // Sync with dragDropManager selection state
  useEffect(() => {
    const selected = dragDropManager.isSelected(reservation.id);
    setIsSelected(selected);
  }, [reservation.id]);
  const getAssignmentColor = (assignedRoom?: string): string => {
    if (assignedRoom) {
      // Assigned bookings - green theme
      return 'bg-green-100 text-green-800 border-green-200';
    } else {
      // Unassigned bookings - red theme  
      return 'bg-red-100 text-red-800 border-red-200';
    }
  };

  const getStatusColor = (status: string): string => {
    const colors = {
      confirmed: 'bg-green-100 text-green-800 border-green-200',
      pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      cancelled: 'bg-red-100 text-red-800 border-red-200',
      checked_in: 'bg-blue-100 text-blue-800 border-blue-200',
      checked_out: 'bg-gray-100 text-gray-800 border-gray-200',
      no_show: 'bg-orange-100 text-orange-800 border-orange-200'
    };
    return colors[status as keyof typeof colors] || colors.confirmed;
  };

  const getVipIcon = (vipStatus?: string) => {
    switch (vipStatus) {
      case 'vip': return <Star className="w-3 h-3 text-yellow-500" />;
      case 'svip': return <Crown className="w-3 h-3 text-purple-500" />;
      case 'corporate': return <Coffee className="w-3 h-3 text-blue-500" />;
      default: return null;
    }
  };

  const handleClick = (e: React.MouseEvent) => {
    if (selectionMode && e.ctrlKey) {
      e.preventDefault();
      const newSelected = !isSelected;
      setIsSelected(newSelected);

      if (newSelected) {
        dragDropManager.addToSelection(reservation.id);
      } else {
        dragDropManager.removeFromSelection(reservation.id);
      }

      onSelectionChange?.(newSelected);
    }
  };

  const handleDragStart = (e: React.DragEvent) => {

    if (isSelected || dragDropManager.getSelectionCount() > 0) {
      // If this reservation is part of a selection, include all selected items
      if (!isSelected) {
        dragDropManager.addToSelection(reservation.id);
        setIsSelected(true);
      }
    } else {
    }

    if (onDragStart) {
      onDragStart(e, reservation);
    } else {
    }

    setIsDragging(true);
    setDragStarted(true);
  };

  const handleDragEnd = () => {
    setIsDragging(false);
    setDragStarted(false);
  };

  return (
    <div role="button" tabIndex={0}
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onClick={handleClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={cn(
        'relative rounded-md border-2 border-dashed p-3 cursor-move group',
        'hover:shadow-md transition-all duration-300 ease-out bg-white shadow-sm',
        // Selection states
        isSelected
          ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200'
          : 'border-gray-300 hover:border-blue-400 hover:bg-blue-50',
        // Assignment colors
        !isSelected && getAssignmentColor(reservation.assignedRoom),
        // Drag states
        isDragging && 'opacity-50 scale-95 rotate-2 shadow-2xl ring-4 ring-blue-300',
        dragStarted && 'animate-pulse',
        // Hover effects
        isHovered && !isSelected && !isDragging && 'transform scale-[1.02] shadow-lg',
        isSelected && !isDragging && 'transform scale-[1.01]',
        isCompact && 'p-2',
        // Multi-selection mode styling
        selectionMode && 'hover:ring-1 hover:ring-blue-300',
        // Smooth transitions for all states
        'transform-gpu will-change-transform'
      )}
      title={
        selectionMode
          ? `Ctrl+click to select • ${isSelected ? 'Selected' : 'Click to select'} • Drag to assign ${reservation.guestName}`
          : `Drag to assign ${reservation.guestName} to a room`
      }
     onKeyDown={(e: React.KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleClick(e as any); } }}>
      {/* Selection checkbox and drag handle */}
      <div className="absolute top-1 left-1 flex items-center gap-1">
        {/* Selection checkbox for multi-select mode */}
        {selectionMode && (
          <div role="button" tabIndex={0}
            className={cn(
              'w-4 h-4 rounded border-2 flex items-center justify-center cursor-pointer',
              isSelected
                ? 'bg-blue-500 border-blue-500 text-white'
                : 'border-gray-300 hover:border-blue-400'
            )}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleClick(e as unknown);
            }}
           onKeyDown={(e: React.KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); const clickHandler = (e) => {
              e.preventDefault();
              e.stopPropagation();
              handleClick(e as unknown);
            }; if (typeof clickHandler === 'function') { clickHandler(e as any); } } }}>
            {isSelected && <Check className="w-3 h-3" />}
          </div>
        )}

        {/* Drag handle indicator */}
        <div className={cn(
          'flex flex-col gap-0.5',
          selectionMode ? 'ml-1' : ''
        )}>
          <div className={cn(
            'w-1 h-1 rounded-full',
            isSelected ? 'bg-blue-500' : 'bg-gray-400'
          )}></div>
          <div className={cn(
            'w-1 h-1 rounded-full',
            isSelected ? 'bg-blue-500' : 'bg-gray-400'
          )}></div>
          <div className={cn(
            'w-1 h-1 rounded-full',
            isSelected ? 'bg-blue-500' : 'bg-gray-400'
          )}></div>
        </div>
      </div>

      <div className={cn(
        selectionMode ? 'ml-8' : 'ml-4'
      )}>
        {/* Guest name with VIP status */}
        <div className="flex items-center gap-2 mb-1">
          {getVipIcon(reservation.vipStatus)}
          <span className={cn(
            'font-medium truncate',
            isCompact ? 'text-xs' : 'text-sm'
          )}>
            {reservation.guestName}
          </span>
        </div>

        {/* Room type */}
        <div className={cn(
          'text-gray-600 mb-1',
          isCompact ? 'text-xs' : 'text-sm'
        )}>
          {reservation.roomType}
        </div>

        {/* Check-in/out dates */}
        <div className={cn(
          'flex items-center gap-1 mb-1 text-gray-500',
          isCompact ? 'text-xs' : 'text-sm'
        )}>
          <Calendar className="w-3 h-3" />
          <span>{reservation.checkIn} - {reservation.checkOut}</span>
        </div>

        {/* Additional info */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <User className="w-3 h-3" />
            <span>{reservation.adults}A{reservation.children > 0 ? `, ${reservation.children}C` : ''}</span>
            <span>•</span>
            <span>{reservation.nights}N</span>
          </div>
          
          {reservation.rate && (
            <div className="text-xs font-medium text-gray-700">
              {formatCurrency(reservation.rate)}
            </div>
          )}
        </div>

        {/* Special requests indicator */}
        {reservation.specialRequests && reservation.specialRequests.length > 0 && (
          <div className="absolute top-2 right-2">
            <Bell className="w-3 h-3 text-orange-500" />
          </div>
        )}
      </div>

      {/* Status badge and selection counter */}
      <div className="absolute top-2 right-2 flex items-center gap-2">
        {/* Multi-selection indicator */}
        {isSelected && dragDropManager.getSelectionCount() > 1 && (
          <div className="bg-blue-500 text-white rounded-full px-2 py-0.5 text-xs font-bold">
            {dragDropManager.getSelectionCount()}
          </div>
        )}

        {/* Status badge */}
        <span className={cn(
          'px-1.5 py-0.5 rounded-full text-xs font-medium uppercase',
          isSelected
            ? 'bg-blue-600 text-white'
            : reservation.assignedRoom
            ? 'bg-green-600 text-white'
            : 'bg-red-600 text-white'
        )}>
          {isSelected
            ? 'SELECTED'
            : reservation.assignedRoom
            ? 'ASSIGNED'
            : 'UNASSIGNED'}
        </span>
      </div>
    </div>
  );
};

export default DraggableReservation;