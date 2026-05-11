import React, { useState } from 'react';
import { cn } from '../../utils/cn';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  eachDayOfInterval, 
  isSameMonth, 
  isSameDay, 
  addMonths, 
  subMonths,
  isToday
} from 'date-fns';

interface CalendarProps {
  mode: 'single' | 'range';
  selected?: Date | { from?: Date; to?: Date };
  onSelect?: (date: Date | { from?: Date; to?: Date } | undefined) => void;
  className?: string;
}

export function Calendar({ mode, selected, onSelect, className }: CalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [rangeStart, setRangeStart] = useState<Date | null>(null);
  
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarStart = startOfWeek(monthStart);
  const calendarEnd = endOfWeek(monthEnd);
  
  const days = eachDayOfInterval({
    start: calendarStart,
    end: calendarEnd,
  });
  
  const handleDateClick = (date: Date) => {
    if (mode === 'single') {
      onSelect?.(date);
    } else if (mode === 'range') {
      if (!rangeStart || (rangeStart && selected && typeof selected === 'object' && selected.to)) {
        setRangeStart(date);
        onSelect?.({ from: date, to: undefined });
      } else {
        const range = rangeStart <= date 
          ? { from: rangeStart, to: date }
          : { from: date, to: rangeStart };
        setRangeStart(null);
        onSelect?.(range);
      }
    }
  };
  
  const isSelected = (date: Date) => {
    if (mode === 'single' && selected instanceof Date) {
      return isSameDay(date, selected);
    }
    
    if (mode === 'range' && selected && typeof selected === 'object') {
      if (selected.from && selected.to) {
        return date >= selected.from && date <= selected.to;
      }
      if (selected.from) {
        return isSameDay(date, selected.from);
      }
    }
    
    return false;
  };
  
  const isRangeStart = (date: Date) => {
    return mode === 'range' && 
           selected && 
           typeof selected === 'object' && 
           selected.from && 
           isSameDay(date, selected.from);
  };
  
  const isRangeEnd = (date: Date) => {
    return mode === 'range' && 
           selected && 
           typeof selected === 'object' && 
           selected.to && 
           isSameDay(date, selected.to);
  };
  
  return (
    <div className={cn('p-3', className)}>
      <div className="flex items-center justify-between mb-4">
        <button aria-label="Previous"
          onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
          className="p-1 hover:bg-gray-100 rounded"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        
        <h2 className="text-sm font-medium">
          {format(currentMonth, 'MMMM yyyy')}
        </h2>
        
        <button aria-label="Add"
          onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
          className="p-1 hover:bg-gray-100 rounded"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
      
      <div className="grid grid-cols-7 gap-1 mb-2">
        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(day => (
          <div key={day} className="text-xs text-center text-gray-500 p-2">
            {day}
          </div>
        ))}
      </div>
      
      <div className="grid grid-cols-7 gap-1">
        {days.map(date => {
          const isCurrentMonth = isSameMonth(date, currentMonth);
          const selected = isSelected(date);
          const isStart = isRangeStart(date);
          const isEnd = isRangeEnd(date);
          const today = isToday(date);
          
          return (
            <button aria-label="Favorite"
              key={date.toISOString()}
              onClick={() => handleDateClick(date)}
              className={cn(
                'p-2 text-sm rounded-md hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500',
                !isCurrentMonth && 'text-gray-300',
                selected && 'bg-blue-500 text-white hover:bg-blue-600',
                (isStart || isEnd) && 'font-medium',
                today && !selected && 'bg-blue-100 text-blue-900'
              )}
            >
              {format(date, 'd')}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default Calendar;