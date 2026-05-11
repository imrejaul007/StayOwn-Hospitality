import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow, differenceInSeconds } from 'date-fns';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle
} from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/Badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog';
import { Checkbox } from '../../components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../../components/ui/dropdown-menu';
import { DateRangePicker } from '../../components/ui/DateRangePicker';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Label } from '../../components/ui/label';
import { api } from '../../services/api';
import {
  Calendar,
  Clock,
  Filter,
  Download,
  MoreVertical,
  Search,
  ChevronLeft,
  ChevronRight,
  Loader2,
  AlertCircle,
  Building2,
  User,
  Eye,
  X,
  Play,
  RotateCcw,
  Plus,
  FileText
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useProperty } from '../../context/PropertyContext';
import { ScheduledUpdateDialog } from '../../components/settings/ScheduledUpdateDialog';
import { withErrorBoundary } from '../../components/ErrorBoundary';

interface ScheduledUpdate {
  _id: string;
  scheduledFor: string;
  settingName: string;
  settingType: string;
  scope: 'single' | 'group' | 'all';
  propertiesAffected: number;
  propertyId?: string;
  propertyName?: string;
  groupId?: string;
  groupName?: string;
  createdBy: {
    userId: string;
    userName: string;
  };
  status: 'pending' | 'executing' | 'completed' | 'failed' | 'cancelled';
  executionResult?: {
    success: boolean;
    propertiesUpdated: number;
    errors?: string[];
  };
  createdAt: string;
  updatedAt: string;
}

const STATUS_COLORS = {
  pending: 'bg-blue-100 text-blue-800',
  executing: 'bg-yellow-100 text-yellow-800',
  completed: 'bg-green-100 text-green-800',
  failed: 'bg-red-100 text-red-800',
  cancelled: 'bg-gray-100 text-gray-800'
};

const STATUS_ICONS = {
  pending: Clock,
  executing: Loader2,
  completed: Building2,
  failed: AlertCircle,
  cancelled: X
};

function ScheduledUpdates() {
  const queryClient = useQueryClient();
  const { properties } = useProperty();

  // State
  const [page, setPage] = useState(1);
  const [pageSize] = useState(50);
  const [selectedUpdates, setSelectedUpdates] = useState<Set<string>>(new Set());
  const [filters, setFilters] = useState({
    propertyId: '',
    status: 'all',
    startDate: null as Date | null,
    endDate: null as Date | null,
    search: ''
  });
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [selectedUpdate, setSelectedUpdate] = useState<ScheduledUpdate | null>(null);
  const [bulkCancelDialogOpen, setBulkCancelDialogOpen] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [countdowns, setCountdowns] = useState<Record<string, string>>({});

  // Fetch scheduled updates
  const {
    data,
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey: ['scheduled-updates', page, pageSize, filters],
    queryFn: async () => {
      const params: Record<string, unknown> = {
        limit: pageSize,
        skip: (page - 1) * pageSize,
        search: filters.search || undefined
      };

      if (filters.propertyId && filters.propertyId !== 'all') {
        params.propertyId = filters.propertyId;
      }

      if (filters.status !== 'all') {
        params.status = filters.status;
      }

      if (filters.startDate) {
        params.startDate = filters.startDate.toISOString();
      }

      if (filters.endDate) {
        params.endDate = filters.endDate.toISOString();
      }

      const response = await api.get('/scheduled-updates', { params });
      return response.data.data;
    },
    refetchInterval: 30000 // Refetch every 30 seconds
  });

  // Update countdowns every second
  useEffect(() => {
    const updateCountdowns = () => {
      const newCountdowns: Record<string, string> = {};

      (data?.updates || []).forEach((update: ScheduledUpdate) => {
        if (update.status === 'pending') {
          const scheduledTime = new Date(update.scheduledFor);
          const now = new Date();
          const seconds = differenceInSeconds(scheduledTime, now);

          if (seconds > 0) {
            const hours = Math.floor(seconds / 3600);
            const minutes = Math.floor((seconds % 3600) / 60);
            const secs = seconds % 60;

            if (hours > 24) {
              const days = Math.floor(hours / 24);
              newCountdowns[update._id] = `in ${days}d ${hours % 24}h`;
            } else if (hours > 0) {
              newCountdowns[update._id] = `in ${hours}h ${minutes}m`;
            } else if (minutes > 0) {
              newCountdowns[update._id] = `in ${minutes}m ${secs}s`;
            } else {
              newCountdowns[update._id] = `in ${secs}s`;
            }
          } else {
            newCountdowns[update._id] = 'executing soon...';
          }
        }
      });

      setCountdowns(newCountdowns);
    };

    updateCountdowns();
    const interval = setInterval(updateCountdowns, 1000);

    return () => clearInterval(interval);
  }, [data]);

  // Cancel mutation
  const cancelMutation = useMutation({
    mutationFn: async (updateId: string) => {
      const response = await api.delete(`/scheduled-updates/${updateId}`, {
        data: { reason: 'Cancelled by user' }
      });
      return response.data;
    },
    onSuccess: () => {
      toast.success('Update cancelled successfully');
      queryClient.invalidateQueries({ queryKey: ['scheduled-updates'] });
      refetch();
    },
    onError: (error: unknown) => {
      const axiosErr = error as { response?: { data?: { message?: string } } };
      toast.error(axiosErr?.response?.data?.message || 'Failed to cancel update');
    }
  });

  // Bulk cancel mutation
  const bulkCancelMutation = useMutation({
    mutationFn: async (updateIds: string[]) => {
      const promises = updateIds.map(id =>
        api.delete(`/scheduled-updates/${id}`, {
          data: { reason: 'Bulk cancellation' }
        })
      );
      return Promise.all(promises);
    },
    onSuccess: () => {
      toast.success('Updates cancelled successfully');
      setSelectedUpdates(new Set());
      setBulkCancelDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ['scheduled-updates'] });
      refetch();
    },
    onError: (_error: unknown) => {
      toast.error('Failed to cancel some updates');
    }
  });

  // Execute now mutation
  const executeNowMutation = useMutation({
    mutationFn: async (updateId: string) => {
      const response = await api.post(`/scheduled-updates/${updateId}/execute`);
      return response.data;
    },
    onSuccess: () => {
      toast.success('Update executed successfully');
      queryClient.invalidateQueries({ queryKey: ['scheduled-updates'] });
      refetch();
    },
    onError: (error: unknown) => {
      const axiosErr = error as { response?: { data?: { message?: string } } };
      toast.error(axiosErr?.response?.data?.message || 'Failed to execute update');
    }
  });

  // Reschedule mutation
  const rescheduleMutation = useMutation({
    mutationFn: async ({ updateId, scheduledFor }: { updateId: string; scheduledFor: string }) => {
      const response = await api.put(`/scheduled-updates/${updateId}/reschedule`, {
        scheduledFor
      });
      return response.data;
    },
    onSuccess: () => {
      toast.success('Update rescheduled successfully');
      queryClient.invalidateQueries({ queryKey: ['scheduled-updates'] });
      refetch();
    },
    onError: (error: unknown) => {
      const axiosErr = error as { response?: { data?: { message?: string } } };
      toast.error(axiosErr?.response?.data?.message || 'Failed to reschedule update');
    }
  });

  // Handlers
  const handleSelectUpdate = (updateId: string) => {
    const newSelected = new Set(selectedUpdates);
    if (newSelected.has(updateId)) {
      newSelected.delete(updateId);
    } else {
      newSelected.add(updateId);
    }
    setSelectedUpdates(newSelected);
  };

  const handleSelectAll = () => {
    const pendingUpdates = (data?.updates || []).filter((u: ScheduledUpdate) => u.status === 'pending');
    if (selectedUpdates.size === pendingUpdates.length) {
      setSelectedUpdates(new Set());
    } else {
      setSelectedUpdates(new Set(pendingUpdates.map((u: ScheduledUpdate) => u._id)));
    }
  };

  const handleViewDetails = (update: ScheduledUpdate) => {
    setSelectedUpdate(update);
    setDetailsDialogOpen(true);
  };

  const handleExportCSV = () => {
    if (!data?.updates || data.updates.length === 0) {
      toast.error('No data to export');
      return;
    }

    const rows: string[][] = [
      ['Scheduled Time', 'Setting Name', 'Scope', 'Properties', 'Created By', 'Status', 'Countdown']
    ];

    data.updates.forEach((update: ScheduledUpdate) => {
      rows.push([
        new Date(update.scheduledFor).toLocaleString(),
        update.settingName,
        update.scope,
        update.propertiesAffected?.toString() || '1',
        update.createdBy.userName,
        update.status,
        countdowns[update._id] || '-'
      ]);
    });

    const csvContent = rows.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `scheduled-updates-${Date.now()}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const getScopeBadge = (scope: 'single' | 'group' | 'all') => {
    const badges = {
      single: { label: 'Single', color: 'bg-blue-100 text-blue-800' },
      group: { label: 'Group', color: 'bg-purple-100 text-purple-800' },
      all: { label: 'All', color: 'bg-amber-100 text-amber-800' }
    };
    const badge = badges[scope];
    return <Badge className={badge.color}>{badge.label}</Badge>;
  };

  const getStatusBadge = (status: ScheduledUpdate['status']) => {
    const Icon = STATUS_ICONS[status];
    return (
      <Badge className={STATUS_COLORS[status]}>
        <Icon className={`h-3 w-3 mr-1 ${status === 'executing' ? 'animate-spin' : ''}`} />
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  const updates: ScheduledUpdate[] = data?.updates || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / pageSize);

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-red-600" />
            <p className="text-red-800">Failed to load scheduled updates: {(error as Error).message}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-3">
            <Calendar className="h-8 w-8" />
            Scheduled Updates
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Manage scheduled settings updates across properties
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={handleExportCSV}
            disabled={updates.length === 0}
          >
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
          <Button
            onClick={() => setCreateDialogOpen(true)}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Plus className="h-4 w-4 mr-2" />
            Schedule New
          </Button>
          {selectedUpdates.size > 0 && (
            <Button
              onClick={() => setBulkCancelDialogOpen(true)}
              className="bg-red-600 hover:bg-red-700"
            >
              <X className="h-4 w-4 mr-2" />
              Cancel ({selectedUpdates.size})
            </Button>
          )}
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            <CardTitle>Filters</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Search */}
            <div className="col-span-1 md:col-span-2">
              <Label htmlFor="search">Search</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  id="search"
                  type="text"
                  placeholder="Search updates..."
                  value={filters.search}
                  onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                  className="pl-10"
                />
              </div>
            </div>

            {/* Property Filter */}
            <div>
              <Label>Property</Label>
              <Select
                value={filters.propertyId}
                onChange={(e) => setFilters({ ...filters, propertyId: e.target.value })}
              >
                <option value="all">All Properties</option>
                {properties.map((property) => (
                  <option key={property._id} value={property._id}>
                    {property.name}
                  </option>
                ))}
              </Select>
            </div>

            {/* Status Filter */}
            <div>
              <Label>Status</Label>
              <Select
                value={filters.status}
                onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              >
                <option value="all">All</option>
                <option value="pending">Pending</option>
                <option value="executing">Executing</option>
                <option value="completed">Completed</option>
                <option value="failed">Failed</option>
                <option value="cancelled">Cancelled</option>
              </Select>
            </div>

            {/* Date Range Filter */}
            <div className="col-span-1 md:col-span-2 lg:col-span-4">
              <Label>Scheduled Date Range</Label>
              <DateRangePicker
                startDate={filters.startDate}
                endDate={filters.endDate}
                onStartDateChange={(date) => setFilters({ ...filters, startDate: date })}
                onEndDateChange={(date) => setFilters({ ...filters, endDate: date })}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>
              {total} {total === 1 ? 'Update' : 'Updates'} Scheduled
            </CardTitle>
            <div className="flex items-center gap-2">
              {updates.filter(u => u.status === 'pending').length > 0 && (
                <label className="flex items-center gap-2 cursor-pointer text-sm">
                  <Checkbox
                    checked={selectedUpdates.size === updates.filter(u => u.status === 'pending').length}
                    onCheckedChange={handleSelectAll}
                  />
                  Select All Pending
                </label>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-12 w-12 text-blue-600 animate-spin" />
            </div>
          ) : updates.length === 0 ? (
            <div className="text-center py-12">
              <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 dark:text-gray-400">No scheduled updates found</p>
              <Button
                onClick={() => setCreateDialogOpen(true)}
                className="mt-4"
                variant="outline"
              >
                <Plus className="h-4 w-4 mr-2" />
                Schedule Your First Update
              </Button>
            </div>
          ) : (
            <>
              {/* Table */}
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 dark:bg-gray-800">
                    <tr>
                      <th className="w-12 px-4 py-3 text-left">
                        <Checkbox
                          checked={selectedUpdates.size === updates.filter(u => u.status === 'pending').length && updates.filter(u => u.status === 'pending').length > 0}
                          onCheckedChange={handleSelectAll}
                        />
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900 dark:text-gray-100">
                        Scheduled Time
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900 dark:text-gray-100">
                        Setting Name
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900 dark:text-gray-100">
                        Scope
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900 dark:text-gray-100">
                        Properties
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900 dark:text-gray-100">
                        Created By
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900 dark:text-gray-100">
                        Status
                      </th>
                      <th className="px-4 py-3 text-right text-sm font-semibold text-gray-900 dark:text-gray-100">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {updates.map((update) => (
                      <tr
                        key={update._id}
                        className={`hover:bg-gray-50 dark:hover:bg-gray-800 ${
                          update.status === 'pending' && differenceInSeconds(new Date(update.scheduledFor), new Date()) < 300
                            ? 'bg-blue-50 dark:bg-blue-900/10'
                            : ''
                        }`}
                      >
                        <td className="px-4 py-3">
                          <Checkbox
                            checked={selectedUpdates.has(update._id)}
                            onCheckedChange={() => handleSelectUpdate(update._id)}
                            disabled={update.status !== 'pending'}
                          />
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 text-gray-400" />
                            <div>
                              <div className="font-medium">
                                {new Date(update.scheduledFor).toLocaleString()}
                              </div>
                              {update.status === 'pending' && countdowns[update._id] && (
                                <div className="text-xs text-blue-600 font-semibold">
                                  {countdowns[update._id]}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                          {update.settingName}
                        </td>
                        <td className="px-4 py-3">
                          {getScopeBadge(update.scope)}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                          <div className="flex items-center gap-2">
                            <Building2 className="h-4 w-4 text-gray-400" />
                            {update.propertiesAffected || 1}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-gray-400" />
                            {update.createdBy.userName}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {getStatusBadge(update.status)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleViewDetails(update)}>
                                <Eye className="h-4 w-4 mr-2" />
                                View Details
                              </DropdownMenuItem>
                              {update.status === 'pending' && (
                                <>
                                  <DropdownMenuItem
                                    onClick={() => executeNowMutation.mutate(update._id)}
                                  >
                                    <Play className="h-4 w-4 mr-2" />
                                    Execute Now
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => cancelMutation.mutate(update._id)}
                                    className="text-red-600"
                                  >
                                    <X className="h-4 w-4 mr-2" />
                                    Cancel
                                  </DropdownMenuItem>
                                </>
                              )}
                              {(update.status === 'completed' || update.status === 'failed') && (
                                <DropdownMenuItem onClick={() => handleViewDetails(update)}>
                                  <FileText className="h-4 w-4 mr-2" />
                                  View Logs
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-6 pt-6 border-t">
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, total)} of {total} updates
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(page - 1)}
                      disabled={page === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      Page {page} of {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(page + 1)}
                      disabled={page === totalPages}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Bulk Cancel Dialog */}
      <Dialog open={bulkCancelDialogOpen} onOpenChange={setBulkCancelDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Bulk Cancellation</DialogTitle>
            <DialogDescription>
              Are you sure you want to cancel {selectedUpdates.size} scheduled {selectedUpdates.size === 1 ? 'update' : 'updates'}?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setBulkCancelDialogOpen(false)}
              disabled={bulkCancelMutation.isPending}
            >
              No, Keep Them
            </Button>
            <Button
              onClick={() => bulkCancelMutation.mutate(Array.from(selectedUpdates))}
              disabled={bulkCancelMutation.isPending}
              className="bg-red-600 hover:bg-red-700"
            >
              {bulkCancelMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Cancelling...
                </>
              ) : (
                <>
                  <X className="h-4 w-4 mr-2" />
                  Yes, Cancel Them
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Details Dialog */}
      <Dialog open={detailsDialogOpen} onOpenChange={setDetailsDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Scheduled Update Details</DialogTitle>
          </DialogHeader>

          {selectedUpdate && (
            <div className="space-y-4">
              {/* Metadata */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-gray-500">Scheduled For</Label>
                  <p className="text-sm font-medium">{new Date(selectedUpdate.scheduledFor).toLocaleString()}</p>
                </div>
                <div>
                  <Label className="text-xs text-gray-500">Setting Name</Label>
                  <p className="text-sm font-medium">{selectedUpdate.settingName}</p>
                </div>
                <div>
                  <Label className="text-xs text-gray-500">Created By</Label>
                  <p className="text-sm font-medium">{selectedUpdate.createdBy.userName}</p>
                </div>
                <div>
                  <Label className="text-xs text-gray-500">Created At</Label>
                  <p className="text-sm font-medium">{new Date(selectedUpdate.createdAt).toLocaleString()}</p>
                </div>
                <div>
                  <Label className="text-xs text-gray-500">Scope</Label>
                  <div className="mt-1">{getScopeBadge(selectedUpdate.scope)}</div>
                </div>
                <div>
                  <Label className="text-xs text-gray-500">Status</Label>
                  <div className="mt-1">{getStatusBadge(selectedUpdate.status)}</div>
                </div>
              </div>

              {/* Execution Results */}
              {selectedUpdate.executionResult && (
                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                  <h4 className="text-sm font-semibold mb-2">Execution Results</h4>
                  <div className="space-y-1 text-sm">
                    <p>
                      <span className="text-gray-600 dark:text-gray-400">Success:</span>{' '}
                      {selectedUpdate.executionResult.success ? 'Yes' : 'No'}
                    </p>
                    <p>
                      <span className="text-gray-600 dark:text-gray-400">Properties Updated:</span>{' '}
                      {selectedUpdate.executionResult.propertiesUpdated}
                    </p>
                    {selectedUpdate.executionResult.errors && selectedUpdate.executionResult.errors.length > 0 && (
                      <div>
                        <span className="text-gray-600 dark:text-gray-400">Errors:</span>
                        <ul className="list-disc list-inside text-red-600 mt-1">
                          {selectedUpdate.executionResult.errors.map((error, i) => (
                            <li key={i}>{error}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailsDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Dialog - Placeholder */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Schedule New Update</DialogTitle>
            <DialogDescription>
              To schedule a new update, please go to the specific settings page and use the "Schedule for Later" option.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setCreateDialogOpen(false)}>
              Got It
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}


export default withErrorBoundary(ScheduledUpdates, { level: 'page' });