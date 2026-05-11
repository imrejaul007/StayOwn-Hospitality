import React, { useState, useRef, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Info } from 'lucide-react';

interface Season {
  _id: string;
  name: string;
  type: string;
  startDate: string;
  endDate: string;
  color: string;
  rateAdjustments: Array<{
    roomType: string;
    adjustmentType: string;
    adjustmentValue: number;
  }>;
  priority: number;
}

interface SpecialPeriod {
  _id: string;
  name: string;
  type: string;
  startDate: string;
  endDate: string;
  color: string;
  rateOverrides: Array<{
    roomType: string;
    overrideType: string;
    overrideValue: number;
  }>;
  priority: number;
  restrictions?: {
    bookingRestriction?: string;
  };
}

interface TooltipInfo {
  date: string;
  seasons: Season[];
  periods: SpecialPeriod[];
}

interface SeasonCalendarProps {
  seasons: Season[];
  specialPeriods: SpecialPeriod[];
  year: number;
  onSeasonClick: (season: Season) => void;
  onSpecialPeriodClick: (period: SpecialPeriod) => void;
}

const SeasonCalendar: React.FC<SeasonCalendarProps> = ({
  seasons,
  specialPeriods,
  year,
  onSeasonClick,
  onSpecialPeriodClick
}) => {
  const [currentMonth, setCurrentMonth] = useState(0);
  const [hoveredDate, setHoveredDate] = useState<string | null>(null);
  const [tooltipInfo, setTooltipInfo] = useState<TooltipInfo | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const tooltipRef = useRef<HTMLDivElement>(null);

  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const getDaysInMonth = (month: number, year: number) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (month: number, year: number) => {
    return new Date(year, month, 1).getDay();
  };

  const formatDate = (year: number, month: number, day: number) => {
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  };

  const getDatePeriods = useCallback((dateStr: string) => {
    const date = new Date(dateStr + 'T00:00:00');
    const seasonsForDate: Season[] = [];
    const periodsForDate: SpecialPeriod[] = [];

    seasons.forEach(season => {
      const startDate = new Date(season.startDate);
      const endDate = new Date(season.endDate);
      if (date >= startDate && date <= endDate) {
        seasonsForDate.push(season);
      }
    });

    specialPeriods.forEach(period => {
      const startDate = new Date(period.startDate);
      const endDate = new Date(period.endDate);
      if (date >= startDate && date <= endDate) {
        periodsForDate.push(period);
      }
    });

    return { seasons: seasonsForDate, periods: periodsForDate };
  }, [seasons, specialPeriods]);

  const getDateColor = useCallback((dateStr: string) => {
    const { seasons: dateSeason, periods: datePeriods } = getDatePeriods(dateStr);

    // Special periods take priority
    if (datePeriods.length > 0) {
      const highestPriority = [...datePeriods].sort((a, b) => b.priority - a.priority)[0];
      return highestPriority.color || getDefaultPeriodColor(highestPriority.type);
    }

    // Then seasons
    if (dateSeason.length > 0) {
      const highestPriority = [...dateSeason].sort((a, b) => b.priority - a.priority)[0];
      return highestPriority.color || getDefaultSeasonColor(highestPriority.type);
    }

    return '#F9FAFB'; // Default gray
  }, [getDatePeriods]);

  const getDefaultSeasonColor = (type: string) => {
    const colors: Record<string, string> = {
      peak: '#FCA5A5',
      high: '#FED7AA',
      shoulder: '#FDE68A',
      low: '#BBF7D0',
      off: '#A7F3D0',
      custom: '#C7D2FE'
    };
    return colors[type] ?? '#E5E7EB';
  };

  const getDefaultPeriodColor = (type: string) => {
    const colors: Record<string, string> = {
      holiday: '#FCA5A5',
      festival: '#DDD6FE',
      event: '#BFDBFE',
      conference: '#A7F3D0',
      wedding_season: '#FBCFE8',
      sports_event: '#FEF3C7',
      blackout: '#D1D5DB',
      maintenance: '#E5E7EB',
      custom: '#C7D2FE'
    };
    return colors[type] ?? '#E5E7EB';
  };

  const handleDateHover = (dateStr: string, e: React.MouseEvent) => {
    const { seasons: dateSeasons, periods: datePeriods } = getDatePeriods(dateStr);

    if (dateSeasons.length > 0 || datePeriods.length > 0) {
      setTooltipInfo({
        date: dateStr,
        seasons: dateSeasons,
        periods: datePeriods
      });
      setTooltipPos({ x: e.clientX, y: e.clientY });
    } else {
      setTooltipInfo(null);
    }

    setHoveredDate(dateStr);
  };

  const handleDateClick = (datePeriods: SpecialPeriod[], dateSeasons: Season[]) => {
    if (datePeriods.length > 0) {
      onSpecialPeriodClick(datePeriods[0]);
    } else if (dateSeasons.length > 0) {
      onSeasonClick(dateSeasons[0]);
    }
  };

  const renderCalendarGrid = () => {
    const daysInMonth = getDaysInMonth(currentMonth, year);
    const firstDay = getFirstDayOfMonth(currentMonth, year);
    const days = [];

    // Empty cells for days before the first day of the month
    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`empty-${i}`} className="h-24 border border-gray-200"></div>);
    }

    // Days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = formatDate(year, currentMonth, day);
      const color = getDateColor(dateStr);
      const { seasons: dateSeasons, periods: datePeriods } = getDatePeriods(dateStr);
      const hasContent = dateSeasons.length > 0 || datePeriods.length > 0;

      days.push(
        <div role="button" tabIndex={0}
          key={day}
          className={`h-24 border border-gray-200 p-1 cursor-pointer transition-all duration-200 ${
            hasContent ? 'hover:shadow-md hover:z-10 relative' : ''
          }`}
          style={{ backgroundColor: color }}
          onMouseEnter={(e) => handleDateHover(dateStr, e)}
          onMouseLeave={() => {
            setHoveredDate(null);
            setTooltipInfo(null);
          }}
          onClick={() => handleDateClick(datePeriods, dateSeasons)}
          onKeyDown={(e: React.KeyboardEvent) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              handleDateClick(datePeriods, dateSeasons);
            }
          }}
        >
          <div className="text-sm font-medium text-gray-800">{day}</div>

          {hasContent && (
            <div className="mt-1 space-y-1">
              {dateSeasons.slice(0, 2).map((season) => (
                <div
                  key={season._id}
                  className="text-xs bg-white bg-opacity-75 rounded px-1 py-0.5 truncate"
                  title={season.name}
                >
                  {season.name}
                </div>
              ))}
              {datePeriods.slice(0, 1).map((period) => (
                <div
                  key={period._id}
                  className="text-xs bg-gray-800 bg-opacity-75 text-white rounded px-1 py-0.5 truncate"
                  title={period.name}
                >
                  {period.name}
                </div>
              ))}
              {(dateSeasons.length + datePeriods.length) > 3 && (
                <div className="text-xs text-gray-600">
                  +{(dateSeasons.length + datePeriods.length) - 3} more
                </div>
              )}
            </div>
          )}
        </div>
      );
    }

    return days;
  };

  return (
    <div className="space-y-6">
      {/* Calendar Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <h3 className="text-xl font-semibold">
            {months[currentMonth]} {year}
          </h3>

          <div className="flex items-center space-x-2">
            <button aria-label="Previous month"
              onClick={() => setCurrentMonth(prev => prev === 0 ? 11 : prev - 1)}
              className="p-2 hover:bg-gray-100 rounded-lg"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            <button aria-label="Next month"
              onClick={() => setCurrentMonth(prev => prev === 11 ? 0 : prev + 1)}
              className="p-2 hover:bg-gray-100 rounded-lg"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2 text-sm">
            <Info className="h-4 w-4 text-gray-400" />
            <span className="text-gray-600">Click on dates to edit seasons/periods</span>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="bg-gray-50 rounded-lg p-4">
        <h4 className="font-medium text-gray-900 mb-3">Legend</h4>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <h5 className="text-sm font-medium text-gray-700 mb-2">Seasons</h5>
            <div className="space-y-1">
              {['peak', 'high', 'shoulder', 'low', 'off'].map(type => (
                <div key={type} className="flex items-center space-x-2 text-sm">
                  <div
                    className="w-3 h-3 rounded"
                    style={{ backgroundColor: getDefaultSeasonColor(type) }}
                  />
                  <span className="capitalize">{type}</span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h5 className="text-sm font-medium text-gray-700 mb-2">Special Periods</h5>
            <div className="space-y-1">
              {['holiday', 'festival', 'event', 'blackout'].map(type => (
                <div key={type} className="flex items-center space-x-2 text-sm">
                  <div
                    className="w-3 h-3 rounded"
                    style={{ backgroundColor: getDefaultPeriodColor(type) }}
                  />
                  <span className="capitalize">{type}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="bg-white rounded-lg shadow">
        {/* Day headers */}
        <div className="grid grid-cols-7 border-b border-gray-200">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div key={day} className="p-4 text-center font-medium text-gray-700 border-r border-gray-200 last:border-r-0">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar days */}
        <div className="grid grid-cols-7">
          {renderCalendarGrid()}
        </div>
      </div>

      {/* Tooltip */}
      {tooltipInfo && hoveredDate && (
        <div
          ref={tooltipRef}
          className="fixed z-50 bg-white border border-gray-200 rounded-lg shadow-lg p-4 max-w-sm pointer-events-none"
          style={{
            left: Math.min(tooltipPos.x + 12, window.innerWidth - 320),
            top: Math.max(tooltipPos.y - 10, 10)
          }}
        >
          <div className="text-sm font-medium text-gray-900 mb-2">
            {new Date(tooltipInfo.date + 'T00:00:00').toLocaleDateString('en-US', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            })}
          </div>

          {tooltipInfo.seasons.length > 0 && (
            <div className="mb-3">
              <h5 className="text-xs font-medium text-gray-700 mb-1">Active Seasons:</h5>
              {tooltipInfo.seasons.map((season) => (
                <div key={season._id} className="text-xs text-gray-600 flex items-center space-x-2">
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: season.color || getDefaultSeasonColor(season.type) }}
                  />
                  <span>{season.name} ({season.type})</span>
                </div>
              ))}
            </div>
          )}

          {tooltipInfo.periods.length > 0 && (
            <div>
              <h5 className="text-xs font-medium text-gray-700 mb-1">Special Periods:</h5>
              {tooltipInfo.periods.map((period) => (
                <div key={period._id} className="text-xs text-gray-600 flex items-center space-x-2">
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: period.color || getDefaultPeriodColor(period.type) }}
                  />
                  <span>{period.name} ({period.type})</span>
                  {period.restrictions?.bookingRestriction === 'blocked' && (
                    <span className="text-red-600 font-medium">BLOCKED</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SeasonCalendar;
