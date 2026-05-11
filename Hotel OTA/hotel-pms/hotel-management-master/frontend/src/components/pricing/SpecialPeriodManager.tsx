import React, { useState } from 'react';
import {
  Edit,
  Trash2,
  AlertTriangle,
  Calendar,
  Clock,
  Users,
  Repeat,
  Ban,
  Filter,
  ArrowUpDown as Sort,
  Eye
} from 'lucide-react';

interface SpecialPeriod {
  _id: string;
  periodId: string;
  name: string;
  description: string;
  type: string;
  startDate: string;
  endDate: string;
  isRecurring: boolean;
  rateOverrides: Array<{
    roomType: string;
    overrideType: 'percentage' | 'fixed' | 'absolute' | 'block';
    overrideValue: number;
    currency: string;
  }>;
  restrictions?: {
    bookingRestriction?: string;
    minLength?: number;
    maxLength?: number;
    mustStayThrough?: boolean;
  };
  eventDetails?: {
    eventName?: string;
    venue?: string;
    organizer?: string;
    expectedAttendees?: number;
  };
  demand?: {
    level?: string;
    expectedOccupancy?: number;
    competitorImpact?: string;
  };
  priority: number;
  color: string;
  isActive: boolean;
  alerts?: {
    emailNotification?: boolean;
    daysBeforeAlert?: number;
  };
}

interface SpecialPeriodManagerProps {
  specialPeriods: SpecialPeriod[];
  onUpdate: () => void;
  onEdit: (period: SpecialPeriod) => void;
  onDelete: (id: string) => void;
}

type SortField = 'startDate' | 'priority' | 'name';
type SortOrder = 'asc' | 'desc';

const SpecialPeriodManager: React.FC<SpecialPeriodManagerProps> = ({
  specialPeriods,
  onUpdate,
  onEdit,
  onDelete
}) => {
  const [filterType, setFilterType] = useState<string>('all');
  const [sortBy, setSortBy] = useState<SortField>('startDate');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [expandedPeriod, setExpandedPeriod] = useState<string | null>(null);

  const periodTypes = [
    'all', 'holiday', 'festival', 'event', 'conference',
    'wedding_season', 'sports_event', 'blackout', 'maintenance', 'custom'
  ];

  const demandLevels: Record<string, { label: string; color: string }> = {
    very_low: { label: 'Very Low', color: 'text-blue-600 bg-blue-100' },
    low: { label: 'Low', color: 'text-green-600 bg-green-100' },
    normal: { label: 'Normal', color: 'text-gray-600 bg-gray-100' },
    high: { label: 'High', color: 'text-orange-600 bg-orange-100' },
    very_high: { label: 'Very High', color: 'text-red-600 bg-red-100' },
    extreme: { label: 'Extreme', color: 'text-purple-600 bg-purple-100' }
  };

  const restrictionTypes: Record<string, { label: string; icon: React.ElementType | null; color: string }> = {
    none: { label: 'No Restrictions', icon: null, color: 'text-gray-600' },
    closed_to_arrival: { label: 'Closed to Arrival', icon: Ban, color: 'text-orange-600' },
    closed_to_departure: { label: 'Closed to Departure', icon: Ban, color: 'text-orange-600' },
    closed_to_both: { label: 'Closed to Both', icon: Ban, color: 'text-red-600' },
    blocked: { label: 'Blocked', icon: AlertTriangle, color: 'text-red-600' }
  };

  const filteredAndSortedPeriods = [...specialPeriods]
    .filter(period => filterType === 'all' || period.type === filterType)
    .sort((a, b) => {
      let aVal: string | number;
      let bVal: string | number;

      switch (sortBy) {
        case 'startDate':
          aVal = new Date(a.startDate).getTime();
          bVal = new Date(b.startDate).getTime();
          break;
        case 'priority':
          aVal = a.priority;
          bVal = b.priority;
          break;
        case 'name':
          aVal = a.name.toLowerCase();
          bVal = b.name.toLowerCase();
          break;
        default:
          return 0;
      }

      if (sortOrder === 'asc') {
        return aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      } else {
        return aVal > bVal ? -1 : aVal < bVal ? 1 : 0;
      }
    });

  const getPeriodTypeLabel = (type: string) => {
    return type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const getPeriodTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      holiday: 'text-red-600 bg-red-100',
      festival: 'text-purple-600 bg-purple-100',
      event: 'text-blue-600 bg-blue-100',
      conference: 'text-green-600 bg-green-100',
      wedding_season: 'text-pink-600 bg-pink-100',
      sports_event: 'text-yellow-600 bg-yellow-100',
      blackout: 'text-gray-600 bg-gray-100',
      maintenance: 'text-gray-600 bg-gray-100',
      custom: 'text-indigo-600 bg-indigo-100'
    };
    return colors[type] ?? 'text-gray-600 bg-gray-100';
  };

  const formatDateRange = (startDate: string, endDate: string) => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const duration = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    return {
      formatted: `${start.toLocaleDateString()} - ${end.toLocaleDateString()}`,
      duration: `${duration} day${duration !== 1 ? 's' : ''}`
    };
  };

  const isCurrentlyActive = (startDate: string, endDate: string) => {
    const now = new Date();
    const start = new Date(startDate);
    const end = new Date(endDate);
    return now >= start && now <= end;
  };

  const daysUntilStart = (startDate: string) => {
    const now = new Date();
    const start = new Date(startDate);
    const diff = Math.ceil((start.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return diff > 0 ? diff : 0;
  };

  const handleSortChange = (value: string) => {
    const parts = value.split('_');
    // Handle fields like "startDate" which contain no underscore ambiguity,
    // and sort values like "startDate_asc", "priority_desc", "name_asc"
    const order = parts[parts.length - 1] as SortOrder;
    const field = parts.slice(0, -1).join('_') as SortField;
    setSortBy(field);
    setSortOrder(order);
  };

  return (
    <div className="space-y-6">
      {/* Header and Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h3 className="text-lg font-semibold">
          Special Periods ({filteredAndSortedPeriods.length})
        </h3>

        <div className="flex flex-wrap items-center gap-3">
          {/* Filter */}
          <div className="flex items-center space-x-2">
            <Filter className="h-4 w-4 text-gray-400" />
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-indigo-500"
            >
              {periodTypes.map(type => (
                <option key={type} value={type}>
                  {type === 'all' ? 'All Types' : getPeriodTypeLabel(type)}
                </option>
              ))}
            </select>
          </div>

          {/* Sort */}
          <div className="flex items-center space-x-2">
            <Sort className="h-4 w-4 text-gray-400" />
            <select
              value={`${sortBy}_${sortOrder}`}
              onChange={(e) => handleSortChange(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-indigo-500"
            >
              <option value="startDate_asc">Date (Earliest)</option>
              <option value="startDate_desc">Date (Latest)</option>
              <option value="priority_desc">Priority (High to Low)</option>
              <option value="priority_asc">Priority (Low to High)</option>
              <option value="name_asc">Name (A-Z)</option>
              <option value="name_desc">Name (Z-A)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Special Periods List */}
      <div className="space-y-4">
        {filteredAndSortedPeriods.map((period) => {
          const dateInfo = formatDateRange(period.startDate, period.endDate);
          const isActive = isCurrentlyActive(period.startDate, period.endDate);
          const daysLeft = daysUntilStart(period.startDate);
          const isExpanded = expandedPeriod === period._id;
          const bookingRestriction = period.restrictions?.bookingRestriction ?? 'none';
          const restrictionInfo = restrictionTypes[bookingRestriction] ?? restrictionTypes.none;
          const demandLevel = period.demand?.level ?? 'normal';
          const demandInfo = demandLevels[demandLevel] ?? demandLevels.normal;

          return (
            <div
              key={period._id}
              className={`border rounded-lg p-4 transition-all duration-200 ${
                isActive ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 bg-white'
              } ${bookingRestriction === 'blocked' ? 'border-red-300 bg-red-50' : ''}`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-2">
                    <div
                      className="w-4 h-4 rounded-full"
                      style={{ backgroundColor: period.color }}
                    />

                    <h4 className="text-lg font-semibold text-gray-900">
                      {period.name}
                    </h4>

                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${getPeriodTypeColor(period.type)}`}>
                      {getPeriodTypeLabel(period.type)}
                    </span>

                    {isActive && (
                      <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">
                        Active Now
                      </span>
                    )}

                    {period.isRecurring && (
                      <Repeat className="h-4 w-4 text-blue-600" title="Recurring" />
                    )}

                    {bookingRestriction !== 'none' && restrictionInfo.icon && (
                      <restrictionInfo.icon
                        className={`h-4 w-4 ${restrictionInfo.color}`}
                        title={restrictionInfo.label}
                      />
                    )}
                  </div>

                  {period.description && (
                    <p className="text-gray-600 mb-3">{period.description}</p>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-600">
                    <div className="flex items-center space-x-2">
                      <Calendar className="h-4 w-4" />
                      <div>
                        <div>{dateInfo.formatted}</div>
                        <div className="text-xs text-gray-500">{dateInfo.duration}</div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Clock className="h-4 w-4" />
                      <div>
                        {daysLeft > 0 ? (
                          <div>Starts in {daysLeft} {daysLeft === 1 ? 'day' : 'days'}</div>
                        ) : isActive ? (
                          <div className="text-green-600 font-medium">Currently Active</div>
                        ) : (
                          <div className="text-gray-500">Past Event</div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Users className="h-4 w-4" />
                      <div>
                        <span className={`px-2 py-0.5 text-xs font-medium rounded ${demandInfo.color}`}>
                          {demandInfo.label} Demand
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Rate Overrides Summary */}
                  {period.rateOverrides && period.rateOverrides.length > 0 && (
                    <div className="mt-3">
                      <p className="text-sm font-medium text-gray-700 mb-1">Rate Overrides:</p>
                      <div className="flex flex-wrap gap-2">
                        {period.rateOverrides.map((override, index) => (
                          <span
                            key={`period-rateOverrides-${index}`}
                            className={`px-2 py-1 text-xs font-medium rounded ${
                              override.overrideType === 'block'
                                ? 'bg-red-100 text-red-800'
                                : override.overrideType === 'absolute'
                                ? 'bg-purple-100 text-purple-800'
                                : 'bg-blue-100 text-blue-800'
                            }`}
                          >
                            {override.roomType === 'all' ? 'All Rooms' : override.roomType}: {' '}
                            {override.overrideType === 'block'
                              ? 'BLOCKED'
                              : override.overrideType === 'percentage'
                              ? `${override.overrideValue}%`
                              : `${override.overrideValue} ${override.currency}`}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Booking Restrictions */}
                  {bookingRestriction !== 'none' && (
                    <div className="mt-3">
                      <div className={`inline-flex items-center space-x-2 px-3 py-1 rounded-full text-sm ${restrictionInfo.color} bg-opacity-10 border border-current border-opacity-20`}>
                        {restrictionInfo.icon && <restrictionInfo.icon className="h-4 w-4" />}
                        <span>{restrictionInfo.label}</span>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex items-center space-x-2">
                  <button aria-label="Expand details"
                    onClick={() => setExpandedPeriod(isExpanded ? null : period._id)}
                    className="p-2 text-gray-400 hover:text-gray-600"
                    title="View Details"
                  >
                    <Eye className="h-4 w-4" />
                  </button>

                  <button aria-label="Edit"
                    onClick={() => onEdit(period)}
                    className="p-2 text-gray-400 hover:text-blue-600"
                    title="Edit"
                  >
                    <Edit className="h-4 w-4" />
                  </button>

                  <button aria-label="Delete"
                    onClick={() => onDelete(period._id)}
                    className="p-2 text-gray-400 hover:text-red-600"
                    title="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Expanded Details */}
              {isExpanded && (
                <div className="mt-4 pt-4 border-t border-gray-200 grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Event Details */}
                  {period.eventDetails && (
                    <div>
                      <h5 className="font-medium text-gray-900 mb-2">Event Details</h5>
                      <div className="space-y-1 text-sm text-gray-600">
                        {period.eventDetails.eventName && (
                          <div><strong>Event:</strong> {period.eventDetails.eventName}</div>
                        )}
                        {period.eventDetails.venue && (
                          <div><strong>Venue:</strong> {period.eventDetails.venue}</div>
                        )}
                        {period.eventDetails.organizer && (
                          <div><strong>Organizer:</strong> {period.eventDetails.organizer}</div>
                        )}
                        {period.eventDetails.expectedAttendees != null && (
                          <div><strong>Expected Attendees:</strong> {period.eventDetails.expectedAttendees.toLocaleString()}</div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Technical Details */}
                  <div>
                    <h5 className="font-medium text-gray-900 mb-2">Settings</h5>
                    <div className="space-y-1 text-sm text-gray-600">
                      <div><strong>Priority:</strong> {period.priority}</div>
                      <div><strong>Min Stay:</strong> {period.restrictions?.minLength ?? 1} nights</div>
                      <div><strong>Max Stay:</strong> {period.restrictions?.maxLength ?? 30} nights</div>
                      {period.alerts?.emailNotification && (
                        <div><strong>Alert:</strong> {period.alerts.daysBeforeAlert ?? 30} days before</div>
                      )}
                      {period.demand?.expectedOccupancy != null && (
                        <div><strong>Expected Occupancy:</strong> {period.demand.expectedOccupancy}%</div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {filteredAndSortedPeriods.length === 0 && (
          <div className="text-center py-12">
            <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No special periods found</h3>
            <p className="text-gray-600 mb-4">
              {filterType === 'all'
                ? "No special periods have been created yet."
                : `No special periods of type "${getPeriodTypeLabel(filterType)}" found.`
              }
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default SpecialPeriodManager;
