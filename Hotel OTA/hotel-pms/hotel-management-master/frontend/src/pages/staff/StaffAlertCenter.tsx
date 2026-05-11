import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  Bell,
  Filter,
  Search,
  Check,
  Play,
  CheckCircle,
  XCircle,
  ArrowUp,
  MoreHorizontal,
  Zap
} from 'lucide-react';
import { staffAlertService, StaffAlert, StaffAlertFilters } from '../../services/staffAlertService';
import { useStaffAlerts } from '../../hooks/useStaffAlerts';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import toast from 'react-hot-toast';
import { withErrorBoundary } from '../../components/ErrorBoundary';

function StaffAlertCenter() {
  const [currentPage, setCurrentPage] = useState(1);
  const [filters, setFilters] = useState<StaffAlertFilters>({
    status: '',
    type: '',
    priority: '',
    category: '',
    activeOnly: true
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedAlerts, setSelectedAlerts] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<'created' | 'priority' | 'status'>('priority');

  const queryClient = useQueryClient();
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounce search input: wait 400 ms after user stops typing before firing query
  useEffect(() => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setCurrentPage(1);
    }, 400);
    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, [searchTerm]);

  // Enable real-time updates via WebSocket — invalidates queries when alerts change
  useStaffAlerts();

  // Fetch alerts with auto-refresh every 30 seconds
  const {
    data: alertsData,
    isLoading: isLoadingAlerts,
    error: alertsError
  } = useQuery({
    queryKey: ['staff-alerts', currentPage, filters, debouncedSearch, sortBy],
    queryFn: () => staffAlertService.getAlerts({
      ...filters,
      page: currentPage,
      limit: 20,
      sortBy: sortBy === 'created' ? 'createdAt' : sortBy,
      ...(debouncedSearch && { search: debouncedSearch })
    }),
    placeholderData: (prev) => prev,
    refetchInterval: 30000,
    staleTime: 10000
  });

  // Mutations — use arrow functions to preserve 'this' context on service methods
  const acknowledgeAlertMutation = useMutation({
    mutationFn: (id: string) => staffAlertService.acknowledgeAlert(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff-alerts'] });
      queryClient.invalidateQueries({ queryKey: ['staff-alert-summary'] });
      toast.success('Alert acknowledged');
    },
    onError: () => {
      toast.error('Failed to acknowledge alert. Please try again.');
    }
  });

  const startWorkingMutation = useMutation({
    mutationFn: (id: string) => staffAlertService.startWorkingOnAlert(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff-alerts'] });
      queryClient.invalidateQueries({ queryKey: ['staff-alert-summary'] });
      toast.success('Started working on alert');
    },
    onError: () => {
      toast.error('Failed to update alert status. Please try again.');
    }
  });

  const resolveAlertMutation = useMutation({
    mutationFn: ({ id, resolution, notes }: { id: string; resolution: string; notes?: string }) =>
      staffAlertService.resolveAlert(id, resolution, notes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff-alerts'] });
      queryClient.invalidateQueries({ queryKey: ['staff-alert-summary'] });
      toast.success('Alert resolved');
    },
    onError: () => {
      toast.error('Failed to resolve alert. Please try again.');
    }
  });

  const dismissAlertMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      staffAlertService.dismissAlert(id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff-alerts'] });
      queryClient.invalidateQueries({ queryKey: ['staff-alert-summary'] });
      toast.success('Alert dismissed');
    },
    onError: () => {
      toast.error('Failed to dismiss alert. Please try again.');
    }
  });

  const escalateAlertMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      staffAlertService.escalateAlert(id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff-alerts'] });
      queryClient.invalidateQueries({ queryKey: ['staff-alert-summary'] });
      toast.success('Alert escalated to critical');
    },
    onError: () => {
      toast.error('Failed to escalate alert. Please try again.');
    }
  });

  const acknowledgeMultipleMutation = useMutation({
    mutationFn: (alertIds: string[]) => staffAlertService.acknowledgeMultiple(alertIds),
    onSuccess: ({ modifiedCount }) => {
      queryClient.invalidateQueries({ queryKey: ['staff-alerts'] });
      queryClient.invalidateQueries({ queryKey: ['staff-alert-summary'] });
      setSelectedAlerts([]);
      toast.success(`${modifiedCount} alerts acknowledged`);
    },
    onError: () => {
      toast.error('Failed to acknowledge alerts. Please try again.');
    }
  });

  // Handle filter changes
  const handleFilterChange = (key: keyof StaffAlertFilters, value: unknown) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setCurrentPage(1);
  };

  // Handle alert selection
  const handleAlertSelect = (alertId: string) => {
    setSelectedAlerts(prev => 
      prev.includes(alertId)
        ? prev.filter(id => id !== alertId)
        : [...prev, alertId]
    );
  };

  // Handle select all — toggle: if every current-page alert is already selected, deselect all; otherwise select all
  const handleSelectAll = () => {
    if (alertsData?.alerts) {
      const allIds = alertsData.alerts.map(alert => alert._id);
      const allSelected = allIds.every(id => selectedAlerts.includes(id));
      setSelectedAlerts(allSelected ? [] : allIds);
    }
  };

  // Alerts are already sorted server-side by the sortBy param sent to the API.
  // No client-side re-sort needed — avoids incorrect ordering across paginated pages.
  const sortedAlerts = alertsData?.alerts ?? [];

  if (isLoadingAlerts) {
    return (
      <div className="flex justify-center items-center h-64">
        <LoadingSpinner />
      </div>
    );
  }

  if (alertsError) {
    return (
      <div className="text-center py-8">
        <AlertTriangle className="mx-auto h-12 w-12 text-red-500 mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">Error loading alerts</h3>
        <p className="text-gray-600">Please try again later.</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
              Staff Alert Center
            </h1>
            <div className="flex items-center space-x-4 mt-2">
              <p className="text-gray-600">
                Monitor and manage operational alerts
              </p>
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 rounded-full bg-blue-500" />
                <span className="text-xs text-gray-500">
                  Auto-refresh every 30s
                </span>
              </div>
            </div>
          </div>
          
          {/* Summary */}
          {alertsData?.summary && (
            <div className="flex items-center space-x-4 text-sm">
              {alertsData.summary.criticalCount > 0 && (
                <span className="text-red-600 font-semibold">
                  🚨 {alertsData.summary.criticalCount} Critical
                </span>
              )}
              {alertsData.summary.urgentCount > 0 && (
                <span className="text-orange-600 font-semibold">
                  ⚠️ {alertsData.summary.urgentCount} Urgent
                </span>
              )}
              <span className="text-gray-600">
                {alertsData.summary.totalActive} Total Active
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Search and Filters */}
      <div className="mb-6 space-y-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                type="text"
                placeholder="Search alerts..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center space-x-2"
            >
              <Filter className="h-4 w-4" />
              <span>Filters</span>
            </Button>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'created' | 'priority' | 'status')}
              className="border border-gray-300 rounded-md px-3 py-2 text-sm"
            >
              <option value="priority">Sort by Priority</option>
              <option value="created">Sort by Created</option>
              <option value="status">Sort by Status</option>
            </select>
          </div>
        </div>

        {/* Filter Panel */}
        {showFilters && (
          <Card className="p-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                <select
                  value={filters.status}
                  onChange={(e) => handleFilterChange('status', e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                >
                  <option value="">All Status</option>
                  <option value="active">Active</option>
                  <option value="acknowledged">Acknowledged</option>
                  <option value="in_progress">In Progress</option>
                  <option value="resolved">Resolved</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Priority</label>
                <select
                  value={filters.priority}
                  onChange={(e) => handleFilterChange('priority', e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                >
                  <option value="">All Priorities</option>
                  <option value="critical">Critical</option>
                  <option value="urgent">Urgent</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
                <select
                  value={filters.category}
                  onChange={(e) => handleFilterChange('category', e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                >
                  <option value="">All Categories</option>
                  <option value="operational">Operational</option>
                  <option value="maintenance">Maintenance</option>
                  <option value="guest_service">Guest Service</option>
                  <option value="inventory">Inventory</option>
                  <option value="safety">Safety</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Options</label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={filters.activeOnly}
                    onChange={(e) => handleFilterChange('activeOnly', e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">Active only</span>
                </label>
              </div>
            </div>
          </Card>
        )}
      </div>

      {/* Bulk Actions */}
      {selectedAlerts.length > 0 && (
        <Card className="p-4 mb-6 bg-blue-50 border-blue-200">
          <div className="flex items-center justify-between">
            <span className="text-sm text-blue-800 font-medium">
              {selectedAlerts.length} alert{selectedAlerts.length !== 1 ? 's' : ''} selected
            </span>
            <div className="flex space-x-2">
              <Button
                size="sm"
                onClick={() => acknowledgeMultipleMutation.mutate(selectedAlerts)}
                disabled={acknowledgeMultipleMutation.isPending}
              >
                <Check className="h-4 w-4 mr-1" />
                Acknowledge Selected
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Alerts List */}
      <div className="space-y-4">
        {sortedAlerts.length === 0 ? (
          <Card className="p-8 text-center">
            <Bell className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No alerts found</h3>
            <p className="text-gray-600">
              {(filters.status !== '' || filters.type !== '' || filters.priority !== '' || filters.category !== '' || !filters.activeOnly || debouncedSearch)
                ? 'No alerts match your current filters.'
                : 'Great! All alerts have been resolved.'
              }
            </p>
          </Card>
        ) : (
          sortedAlerts.map((alert) => (
            <StaffAlertCard
              key={alert._id}
              alert={alert}
              isSelected={selectedAlerts.includes(alert._id)}
              onSelect={() => handleAlertSelect(alert._id)}
              onAcknowledge={() => acknowledgeAlertMutation.mutate(alert._id)}
              onStartWorking={() => startWorkingMutation.mutate(alert._id)}
              onResolve={(resolution, notes) =>
                resolveAlertMutation.mutate({ id: alert._id, resolution, notes })
              }
              onDismiss={(reason) =>
                dismissAlertMutation.mutate({ id: alert._id, reason })
              }
              onEscalate={(reason) =>
                escalateAlertMutation.mutate({ id: alert._id, reason })
              }
            />
          ))
        )}
      </div>

      {/* Pagination */}
      {alertsData?.pagination && alertsData.pagination.pages > 1 && (
        <div className="mt-8 flex items-center justify-center space-x-2">
          <Button
            variant="outline"
            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
            disabled={currentPage === 1}
          >
            Previous
          </Button>
          <span className="text-sm text-gray-600">
            Page {currentPage} of {alertsData.pagination.pages}
          </span>
          <Button
            variant="outline"
            onClick={() => setCurrentPage(prev => Math.min(alertsData.pagination.pages, prev + 1))}
            disabled={currentPage === alertsData.pagination.pages}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}

// Alert Card Component
interface StaffAlertCardProps {
  alert: StaffAlert;
  isSelected: boolean;
  onSelect: () => void;
  onAcknowledge: () => void;
  onStartWorking: () => void;
  onResolve: (resolution: string, notes?: string) => void;
  onDismiss: (reason: string) => void;
  onEscalate: (reason: string) => void;
}

function StaffAlertCard({
  alert,
  isSelected,
  onSelect,
  onAcknowledge,
  onStartWorking,
  onResolve,
  onDismiss,
  onEscalate
}: StaffAlertCardProps) {
  const [showActions, setShowActions] = useState(false);
  const actionsRef = useRef<HTMLDivElement>(null);
  const typeInfo = staffAlertService.getAlertTypeInfo(alert.type);

  // Close the actions dropdown when clicking outside
  useEffect(() => {
    if (!showActions) return;
    const handleOutsideClick = (e: MouseEvent) => {
      if (actionsRef.current && !actionsRef.current.contains(e.target as Node)) {
        setShowActions(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [showActions]);
  const priorityInfo = staffAlertService.getPriorityInfo(alert.priority);

  const getStatusColor = (status: string) => {
    const colors = {
      active: 'bg-red-100 text-red-800',
      acknowledged: 'bg-blue-100 text-blue-800',
      in_progress: 'bg-yellow-100 text-yellow-800',
      resolved: 'bg-green-100 text-green-800',
      dismissed: 'bg-gray-100 text-gray-800'
    };
    return colors[status as keyof typeof colors] || colors.active;
  };

  return (
    <Card className={`p-4 transition-all ${
      staffAlertService.requiresImmediate(alert) ? 'border-l-4 border-l-red-500 bg-red-50' :
      staffAlertService.isUrgent(alert) ? 'border-l-4 border-l-orange-500 bg-orange-50' :
      isSelected ? 'border-blue-300 bg-blue-50' : ''
    }`}>
      <div className="flex items-start space-x-4">
        {/* Checkbox */}
        <input
          type="checkbox"
          checked={isSelected}
          onChange={onSelect}
          className="mt-1 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
        />

        {/* Alert Icon */}
        <div className={`p-2 rounded-full ${typeInfo.color}`}>
          {staffAlertService.requiresImmediate(alert) ? (
            <Zap className="h-5 w-5" />
          ) : staffAlertService.isUrgent(alert) ? (
            <AlertTriangle className="h-5 w-5" />
          ) : (
            <Bell className="h-5 w-5" />
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-900">{alert.title}</h3>
              <p className="text-gray-600 mt-1">{alert.message}</p>
              
              {/* Metadata */}
              <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-2 text-sm text-gray-500">
                {alert.metadata?.roomNumber && (
                  <div>Room: {alert.metadata.roomNumber}</div>
                )}
                {alert.metadata?.guestName && (
                  <div>Guest: {alert.metadata.guestName}</div>
                )}
                {alert.assignedTo && (
                  <div>Assigned: {alert.assignedTo.name}</div>
                )}
                <div>Created: {staffAlertService.formatTimeAgo(alert.createdAt)}</div>
              </div>

              {/* Badges */}
              <div className="mt-3 flex items-center space-x-2">
                <span className={`px-2 py-1 text-xs font-medium rounded-full ${priorityInfo.bgColor} ${priorityInfo.color}`}>
                  {alert.priority.toUpperCase()}
                </span>
                <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(alert.status)}`}>
                  {alert.status.replace('_', ' ').toUpperCase()}
                </span>
                <span className={`px-2 py-1 text-xs font-medium rounded-full ${typeInfo.color}`}>
                  {typeInfo.label}
                </span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center space-x-2 ml-4">
              {alert.status === 'active' && (
                <>
                  <Button size="sm" variant="outline" onClick={onAcknowledge}>
                    <Check className="h-4 w-4 mr-1" />
                    Acknowledge
                  </Button>
                  <Button size="sm" onClick={onStartWorking}>
                    <Play className="h-4 w-4 mr-1" />
                    Start
                  </Button>
                </>
              )}

              {(alert.status === 'in_progress' || alert.status === 'acknowledged') && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const resolution = window.prompt('Resolution summary (required):');
                    if (resolution && resolution.trim()) {
                      onResolve(resolution.trim(), undefined);
                    }
                  }}
                >
                  <CheckCircle className="h-4 w-4 mr-1" />
                  Resolve
                </Button>
              )}

              {/* More actions dropdown */}
              {alert.status !== 'resolved' && alert.status !== 'dismissed' && (
                <div className="relative" ref={actionsRef}>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setShowActions(!showActions)}
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>

                  {showActions && (
                    <div className="absolute right-0 top-8 z-20 bg-white rounded-md shadow-lg border py-1 min-w-[140px]">
                      <button
                        onClick={() => {
                          const reason = window.prompt('Escalation reason (required):');
                          if (reason && reason.trim()) {
                            onEscalate(reason.trim());
                            setShowActions(false);
                          }
                        }}
                        className="w-full text-left px-4 py-2 text-sm text-orange-600 hover:bg-gray-100 flex items-center"
                      >
                        <ArrowUp className="h-4 w-4 mr-2" />
                        Escalate
                      </button>
                      <button
                        onClick={() => {
                          const reason = window.prompt('Dismiss reason (required):');
                          if (reason && reason.trim()) {
                            onDismiss(reason.trim());
                            setShowActions(false);
                          }
                        }}
                        className="w-full text-left px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 flex items-center"
                      >
                        <XCircle className="h-4 w-4 mr-2" />
                        Dismiss
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}

export default withErrorBoundary(StaffAlertCenter);
