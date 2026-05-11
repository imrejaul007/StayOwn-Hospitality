import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription
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
import { Textarea } from '../../components/ui/textarea';
import { Label } from '../../components/ui/label';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { api } from '../../services/api';
import {
  History,
  Filter,
  Download,
  RotateCcw,
  MoreVertical,
  Search,
  ChevronLeft,
  ChevronRight,
  Loader2,
  AlertCircle,
  CheckCircle,
  Building2,
  User,
  Calendar,
  Eye
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useProperty } from '../../context/PropertyContext';
import { withErrorBoundary } from '../../components/ErrorBoundary';

interface AuditLogEntry {
  _id: string;
  propertyId: string;
  propertyName: string;
  settingType: string;
  action: 'update' | 'rollback';
  oldValues: Record<string, unknown>;
  newValues: Record<string, unknown>;
  userId: string;
  userName: string;
  scope: 'single' | 'group' | 'all';
  propertiesAffected: number;
  isRolledBack: boolean;
  createdAt: string;
}

interface Filters {
  propertyIds: string[];
  settingTypes: string[];
  userIds: string[];
  status: 'all' | 'applied' | 'rolled_back';
  startDate: Date | null;
  endDate: Date | null;
  search: string;
}

const SETTING_TYPES = [
  'booking_rules',
  'room_types',
  'message_templates',
  'payment_methods',
  'tax_configuration',
  'cancellation_policy',
  'check_in_out',
  'currency',
  'timezone',
  'language',
  'integration_settings',
  'security_settings',
  'notification_settings'
];

function SettingsHistory() {
  const queryClient = useQueryClient();
  const { properties } = useProperty();

  // State
  const [page, setPage] = useState(1);
  const [pageSize] = useState(50);
  const [selectedEntries, setSelectedEntries] = useState<Set<string>>(new Set());
  const [filters, setFilters] = useState<Filters>({
    propertyIds: [],
    settingTypes: [],
    userIds: [],
    status: 'all',
    startDate: null,
    endDate: null,
    search: ''
  });
  const [bulkRollbackDialogOpen, setBulkRollbackDialogOpen] = useState(false);
  const [rollbackReason, setRollbackReason] = useState('');
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<AuditLogEntry | null>(null);

  // Fetch audit log
  const {
    data,
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey: ['settings-history', page, pageSize, filters],
    queryFn: async () => {
      const params: Record<string, unknown> = {
        page,
        limit: pageSize,
        search: filters.search || undefined
      };

      if (filters.propertyIds.length > 0) {
        params.propertyIds = filters.propertyIds.join(',');
      }

      if (filters.settingTypes.length > 0) {
        params.settingTypes = filters.settingTypes.join(',');
      }

      if (filters.userIds.length > 0) {
        params.userIds = filters.userIds.join(',');
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

      const response = await api.get('/audit-log', { params });
      return response.data.data;
    },
    refetchInterval: 60000 // Refetch every 60 seconds
  });

  // Bulk rollback mutation
  const bulkRollbackMutation = useMutation({
    mutationFn: async (data: { propertyIds: string[]; historyIds: string[]; reason: string }) => {
      const response = await api.post('/settings/bulk-rollback', {
        propertyIds: data.propertyIds,
        historyIds: data.historyIds,
        reason: data.reason
      });
      return response.data;
    },
    onSuccess: (data) => {
      toast.success(`Rolled back ${data.data.successful} of ${data.data.total} changes`);
      setBulkRollbackDialogOpen(false);
      setRollbackReason('');
      setSelectedEntries(new Set());
      queryClient.invalidateQueries({ queryKey: ['settings-history'] });
      refetch();
    },
    onError: (error: unknown) => {
      const axiosErr = error as { response?: { data?: { message?: string } } };
      toast.error(axiosErr?.response?.data?.message || 'Failed to rollback changes');
    }
  });

  // Handlers
  const handleSelectEntry = (entryId: string) => {
    const newSelected = new Set(selectedEntries);
    if (newSelected.has(entryId)) {
      newSelected.delete(entryId);
    } else {
      newSelected.add(entryId);
    }
    setSelectedEntries(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedEntries.size === entries.length) {
      setSelectedEntries(new Set());
    } else {
      setSelectedEntries(new Set(entries.map(e => e._id)));
    }
  };

  const handleBulkRollback = () => {
    if (selectedEntries.size === 0) {
      toast.error('Please select at least one entry to rollback');
      return;
    }

    setBulkRollbackDialogOpen(true);
  };

  const confirmBulkRollback = () => {
    if (!rollbackReason.trim()) {
      toast.error('Please provide a reason for rollback');
      return;
    }

    const selectedEntriesArray = Array.from(selectedEntries);
    const propertyIds = [...new Set(
      entries
        .filter(e => selectedEntriesArray.includes(e._id))
        .map(e => e.propertyId)
    )];

    bulkRollbackMutation.mutate({
      propertyIds,
      historyIds: selectedEntriesArray,
      reason: rollbackReason
    });
  };

  const handleViewDetails = (entry: AuditLogEntry) => {
    setSelectedEntry(entry);
    setDetailsDialogOpen(true);
  };

  const handleExportCSV = () => {
    if (!entries || entries.length === 0) {
      toast.error('No data to export');
      return;
    }

    const rows: string[][] = [
      ['Timestamp', 'Property', 'Setting Type', 'User', 'Scope', 'Properties Affected', 'Status', 'Changes']
    ];

    entries.forEach((entry) => {
      const changes = Object.keys(entry.oldValues || {}).map(key => {
        return `${key}: ${JSON.stringify(entry.oldValues[key])} → ${JSON.stringify(entry.newValues[key])}`;
      }).join('; ');

      rows.push([
        new Date(entry.createdAt).toLocaleString(),
        entry.propertyName,
        entry.settingType,
        entry.userName,
        entry.scope,
        entry.propertiesAffected?.toString() || '1',
        entry.isRolledBack ? 'Rolled Back' : 'Applied',
        changes
      ]);
    });

    const csvContent = rows.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `settings-history-${Date.now()}.csv`;
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

  const getStatusBadge = (isRolledBack: boolean) => {
    if (isRolledBack) {
      return (
        <Badge className="bg-red-100 text-red-800">
          <RotateCcw className="h-3 w-3 mr-1" />
          Rolled Back
        </Badge>
      );
    }
    return (
      <Badge className="bg-green-100 text-green-800">
        <CheckCircle className="h-3 w-3 mr-1" />
        Applied
      </Badge>
    );
  };

  const entries: AuditLogEntry[] = data?.entries || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / pageSize);

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-red-600" />
            <p className="text-red-800">Failed to load settings history: {(error as Error).message}</p>
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
            <History className="h-8 w-8" />
            Settings History
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            View and manage settings changes across all properties
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={handleExportCSV}
            disabled={entries.length === 0}
          >
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
          {selectedEntries.size > 0 && (
            <Button
              onClick={handleBulkRollback}
              className="bg-red-600 hover:bg-red-700"
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Bulk Rollback ({selectedEntries.size})
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
                  placeholder="Search changes..."
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
                value={filters.propertyIds[0] || 'all'}
                onChange={(e) => {
                  const value = e.target.value;
                  setFilters({
                    ...filters,
                    propertyIds: value === 'all' ? [] : [value]
                  });
                }}
              >
                <option value="all">All Properties</option>
                {properties.map((property) => (
                  <option key={property._id} value={property._id}>
                    {property.name}
                  </option>
                ))}
              </Select>
            </div>

            {/* Setting Type Filter */}
            <div>
              <Label>Setting Type</Label>
              <Select
                value={filters.settingTypes[0] || 'all'}
                onChange={(e) => {
                  const value = e.target.value;
                  setFilters({
                    ...filters,
                    settingTypes: value === 'all' ? [] : [value]
                  });
                }}
              >
                <option value="all">All Types</option>
                {SETTING_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </option>
                ))}
              </Select>
            </div>

            {/* Status Filter */}
            <div>
              <Label>Status</Label>
              <Select
                value={filters.status}
                onChange={(e) => setFilters({ ...filters, status: e.target.value as string })}
              >
                <option value="all">All</option>
                <option value="applied">Applied</option>
                <option value="rolled_back">Rolled Back</option>
              </Select>
            </div>

            {/* Date Range Filter */}
            <div className="col-span-1 md:col-span-2 lg:col-span-3">
              <Label>Date Range</Label>
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
              {total} {total === 1 ? 'Entry' : 'Entries'} Found
            </CardTitle>
            <div className="flex items-center gap-2">
              {entries.length > 0 && (
                <label className="flex items-center gap-2 cursor-pointer text-sm">
                  <Checkbox
                    checked={selectedEntries.size === entries.length}
                    onCheckedChange={handleSelectAll}
                  />
                  Select All
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
          ) : entries.length === 0 ? (
            <div className="text-center py-12">
              <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 dark:text-gray-400">No settings history found</p>
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
                          checked={selectedEntries.size === entries.length}
                          onCheckedChange={handleSelectAll}
                        />
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900 dark:text-gray-100">
                        Timestamp
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900 dark:text-gray-100">
                        Property
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900 dark:text-gray-100">
                        Setting Type
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900 dark:text-gray-100">
                        User
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900 dark:text-gray-100">
                        Scope
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900 dark:text-gray-100">
                        Affected
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
                    {entries.map((entry) => (
                      <tr key={entry._id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                        <td className="px-4 py-3">
                          <Checkbox
                            checked={selectedEntries.has(entry._id)}
                            onCheckedChange={() => handleSelectEntry(entry._id)}
                            disabled={entry.isRolledBack}
                          />
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-gray-400" />
                            <div>
                              <div>{formatDistanceToNow(new Date(entry.createdAt), { addSuffix: true })}</div>
                              <div className="text-xs text-gray-500">
                                {new Date(entry.createdAt).toLocaleString()}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                          <div className="flex items-center gap-2">
                            <Building2 className="h-4 w-4 text-gray-400" />
                            {entry.propertyName}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100 capitalize">
                          {entry.settingType.replace(/_/g, ' ')}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-gray-400" />
                            {entry.userName}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {getScopeBadge(entry.scope)}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                          {entry.propertiesAffected || 1}
                        </td>
                        <td className="px-4 py-3">
                          {getStatusBadge(entry.isRolledBack)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleViewDetails(entry)}>
                                <Eye className="h-4 w-4 mr-2" />
                                View Details
                              </DropdownMenuItem>
                              {!entry.isRolledBack && (
                                <DropdownMenuItem
                                  onClick={() => {
                                    setSelectedEntry(entry);
                                    setSelectedEntries(new Set([entry._id]));
                                    setBulkRollbackDialogOpen(true);
                                  }}
                                  className="text-red-600"
                                >
                                  <RotateCcw className="h-4 w-4 mr-2" />
                                  Rollback
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
                    Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, total)} of {total} entries
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

      {/* Bulk Rollback Dialog */}
      <Dialog open={bulkRollbackDialogOpen} onOpenChange={setBulkRollbackDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Confirm Bulk Rollback</DialogTitle>
            <DialogDescription>
              Are you sure you want to rollback {selectedEntries.size} {selectedEntries.size === 1 ? 'change' : 'changes'}?
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-amber-800 dark:text-amber-200">
                  <p className="font-medium mb-1">Warning</p>
                  <p>This will restore previous settings for the selected changes. This action cannot be undone.</p>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="bulk-rollback-reason">
                Reason for Rollback <span className="text-red-500">*</span>
              </Label>
              <Textarea
                id="bulk-rollback-reason"
                value={rollbackReason}
                onChange={(e) => setRollbackReason(e.target.value)}
                placeholder="Please provide a reason for rolling back these changes..."
                rows={4}
                className="resize-none"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setBulkRollbackDialogOpen(false);
                setRollbackReason('');
              }}
              disabled={bulkRollbackMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={confirmBulkRollback}
              disabled={bulkRollbackMutation.isPending || !rollbackReason.trim()}
              className="bg-red-600 hover:bg-red-700"
            >
              {bulkRollbackMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Rolling Back...
                </>
              ) : (
                <>
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Confirm Rollback
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
            <DialogTitle>Change Details</DialogTitle>
          </DialogHeader>

          {selectedEntry && (
            <div className="space-y-4">
              {/* Metadata */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-gray-500">Property</Label>
                  <p className="text-sm font-medium">{selectedEntry.propertyName}</p>
                </div>
                <div>
                  <Label className="text-xs text-gray-500">Setting Type</Label>
                  <p className="text-sm font-medium capitalize">{selectedEntry.settingType.replace(/_/g, ' ')}</p>
                </div>
                <div>
                  <Label className="text-xs text-gray-500">User</Label>
                  <p className="text-sm font-medium">{selectedEntry.userName}</p>
                </div>
                <div>
                  <Label className="text-xs text-gray-500">Timestamp</Label>
                  <p className="text-sm font-medium">{new Date(selectedEntry.createdAt).toLocaleString()}</p>
                </div>
                <div>
                  <Label className="text-xs text-gray-500">Scope</Label>
                  <div className="mt-1">{getScopeBadge(selectedEntry.scope)}</div>
                </div>
                <div>
                  <Label className="text-xs text-gray-500">Status</Label>
                  <div className="mt-1">{getStatusBadge(selectedEntry.isRolledBack)}</div>
                </div>
              </div>

              {/* Changes */}
              <div>
                <Label className="text-sm font-semibold mb-2 block">Changes</Label>
                <div className="space-y-2">
                  {Object.keys(selectedEntry.oldValues || {}).map((key) => (
                    <div
                      key={key}
                      className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700"
                    >
                      <div className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2 capitalize">
                        {key.replace(/_/g, ' ')}
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <div className="text-xs text-gray-500 uppercase mb-1">Old Value</div>
                          <div className="text-sm bg-white dark:bg-gray-900 rounded p-2 font-mono">
                            {JSON.stringify(selectedEntry.oldValues[key], null, 2)}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-500 uppercase mb-1">New Value</div>
                          <div className="text-sm bg-white dark:bg-gray-900 rounded p-2 font-mono">
                            {JSON.stringify(selectedEntry.newValues[key], null, 2)}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDetailsDialogOpen(false)}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}


export default withErrorBoundary(SettingsHistory, { level: 'page' });