import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription
} from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Alert, AlertDescription } from '../ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Textarea } from '../ui/textarea';
import { Label } from '../ui/label';
import { api } from '../../services/api';
import {
  Clock,
  User,
  Building2,
  RotateCcw,
  Download,
  Loader2,
  CheckCircle,
  AlertCircle,
  ArrowRight,
  Filter,
  Calendar
} from 'lucide-react';
import { toast } from 'react-hot-toast';

interface ChangeHistoryProps {
  /**
   * Property ID to show history for
   */
  propertyId: string;

  /**
   * Setting type to filter by
   */
  settingType: string;

  /**
   * Additional CSS classes
   */
  className?: string;
}

interface ChangeHistoryEntry {
  _id: string;
  propertyId: string;
  propertyName: string;
  settingType: string;
  oldValues: Record<string, unknown>;
  newValues: Record<string, unknown>;
  changedBy: {
    userId: string;
    userName: string;
    userAvatar?: string;
  };
  changedAt: string;
  scope: 'single' | 'group' | 'all';
  propertiesAffected: number;
  isRolledBack: boolean;
  rolledBackAt?: string;
  rolledBackBy?: {
    userId: string;
    userName: string;
  };
  rollbackReason?: string;
}

export function ChangeHistory({
  propertyId,
  settingType,
  className = ''
}: ChangeHistoryProps) {
  const queryClient = useQueryClient();
  const [selectedEntry, setSelectedEntry] = useState<ChangeHistoryEntry | null>(null);
  const [rollbackDialogOpen, setRollbackDialogOpen] = useState(false);
  const [rollbackReason, setRollbackReason] = useState('');
  const [includeRolledBack, setIncludeRolledBack] = useState(false);
  const [limit, setLimit] = useState(25);

  // Fetch change history
  const {
    data: historyData,
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey: ['change-history', propertyId, settingType, limit, includeRolledBack],
    queryFn: async () => {
      const response = await api.get(
        `/settings/change-history/${propertyId}/${settingType}`,
        {
          params: {
            limit,
            includeRolledBack
          }
        }
      );
      return response.data.data.history as ChangeHistoryEntry[];
    },
    refetchInterval: 60000 // Refetch every 60 seconds
  });

  // Rollback mutation
  const rollbackMutation = useMutation({
    mutationFn: async (data: { historyId: string; reason: string }) => {
      const response = await api.post('/settings/rollback', {
        propertyId,
        settingType,
        historyId: data.historyId,
        reason: data.reason
      });
      return response.data;
    },
    onSuccess: () => {
      toast.success('Settings rolled back successfully');
      setRollbackDialogOpen(false);
      setSelectedEntry(null);
      setRollbackReason('');
      queryClient.invalidateQueries({ queryKey: ['change-history'] });
      refetch();
    },
    onError: (error: unknown) => {
      toast.error(error.response?.data?.message || 'Failed to rollback settings');
    }
  });

  // Handle rollback click
  const handleRollbackClick = (entry: ChangeHistoryEntry) => {
    setSelectedEntry(entry);
    setRollbackDialogOpen(true);
  };

  // Confirm rollback
  const handleConfirmRollback = () => {
    if (!selectedEntry) return;

    if (!rollbackReason.trim()) {
      toast.error('Please provide a reason for rollback');
      return;
    }

    rollbackMutation.mutate({
      historyId: selectedEntry._id,
      reason: rollbackReason
    });
  };

  // Check if entry can be rolled back
  const canRollback = (entry: ChangeHistoryEntry): boolean => {
    if (entry.isRolledBack) return false;

    // Check if within 30-day window
    const changedAt = new Date(entry.changedAt);
    const now = new Date();
    const daysSinceChange = Math.floor((now.getTime() - changedAt.getTime()) / (1000 * 60 * 60 * 24));

    return daysSinceChange <= 30;
  };

  // Get status badge
  const getStatusBadge = (entry: ChangeHistoryEntry) => {
    if (entry.isRolledBack) {
      return (
        <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
          <RotateCcw className="h-3 w-3 mr-1" />
          Rolled Back
        </Badge>
      );
    }

    const canRollbackEntry = canRollback(entry);
    if (!canRollbackEntry) {
      const changedAt = new Date(entry.changedAt);
      const now = new Date();
      const daysSinceChange = Math.floor((now.getTime() - changedAt.getTime()) / (1000 * 60 * 60 * 24));

      return (
        <Badge variant="outline" className="bg-gray-50 text-gray-600 border-gray-200">
          Expired ({daysSinceChange}d old)
        </Badge>
      );
    }

    return (
      <Badge className="bg-green-50 text-green-700 border-green-200">
        <CheckCircle className="h-3 w-3 mr-1" />
        Applied
      </Badge>
    );
  };

  // Get scope badge
  const getScopeBadge = (scope: 'single' | 'group' | 'all') => {
    const badges = {
      single: { label: 'Single Property', color: 'bg-blue-100 text-blue-800' },
      group: { label: 'Property Group', color: 'bg-purple-100 text-purple-800' },
      all: { label: 'All Properties', color: 'bg-amber-100 text-amber-800' }
    };

    const badge = badges[scope];
    return (
      <Badge variant="outline" className={badge.color}>
        {badge.label}
      </Badge>
    );
  };

  // Format value for display
  const formatValue = (value: Record<string, unknown>): string => {
    if (value === null || value === undefined) return '-';
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    if (typeof value === 'object') return JSON.stringify(value, null, 2);
    return String(value);
  };

  // Export to CSV
  const handleExport = () => {
    if (!historyData || historyData.length === 0) return;

    const rows: string[][] = [
      ['Date', 'User', 'Scope', 'Properties Affected', 'Status', 'Changes']
    ];

    historyData.forEach((entry) => {
      const changes = Object.keys(entry.oldValues).map(key => {
        return `${key}: ${formatValue(entry.oldValues[key])} → ${formatValue(entry.newValues[key])}`;
      }).join('; ');

      rows.push([
        new Date(entry.changedAt).toLocaleString(),
        entry.changedBy.userName,
        entry.scope,
        entry.propertiesAffected.toString(),
        entry.isRolledBack ? 'Rolled Back' : 'Applied',
        changes
      ]);
    });

    const csvContent = rows.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `change-history-${propertyId}-${settingType}-${Date.now()}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  if (isLoading) {
    return (
      <Card className={className}>
        <CardContent className="py-12">
          <div className="flex flex-col items-center justify-center">
            <Loader2 className="h-12 w-12 text-blue-600 animate-spin mb-4" />
            <p className="text-gray-600">Loading change history...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive" className={className}>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Failed to load change history: {(error as Error).message}
        </AlertDescription>
      </Alert>
    );
  }

  const history = historyData || [];

  return (
    <>
      <Card className={className}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Change History</CardTitle>
              <CardDescription className="mt-1">
                View and rollback previous changes (30-day window)
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleExport}
                disabled={history.length === 0}
              >
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {/* Filter Controls */}
          <div className="flex items-center gap-4 mb-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-gray-500" />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Filters:</span>
            </div>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={includeRolledBack}
                onChange={(e) => setIncludeRolledBack(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">Include rolled back</span>
            </label>

            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-700 dark:text-gray-300">Show:</span>
              <select
                value={limit}
                onChange={(e) => setLimit(parseInt(e.target.value))}
                className="text-sm border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600"
              >
                <option value="10">10</option>
                <option value="25">25</option>
                <option value="50">50</option>
                <option value="100">100</option>
              </select>
            </div>
          </div>

          {/* Timeline */}
          {history.length === 0 ? (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                No change history found for this setting type.
              </AlertDescription>
            </Alert>
          ) : (
            <div className="relative">
              {/* Vertical Timeline Line */}
              <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gray-200 dark:bg-gray-700" />

              {/* Timeline Entries */}
              <div className="space-y-6">
                {history.map((entry, index) => (
                  <div key={entry._id} className="relative pl-14">
                    {/* Timeline Dot */}
                    <div className={`absolute left-4 top-2 w-4 h-4 rounded-full border-2 border-white dark:border-gray-900 ${
                      entry.isRolledBack
                        ? 'bg-red-500'
                        : canRollback(entry)
                        ? 'bg-green-500'
                        : 'bg-gray-400'
                    }`} />

                    {/* Entry Card */}
                    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:shadow-md transition-shadow">
                      {/* Header */}
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <Clock className="h-4 w-4 text-gray-400" />
                            <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                              {formatDistanceToNow(new Date(entry.changedAt), { addSuffix: true })}
                            </span>
                            <span className="text-xs text-gray-500">
                              ({new Date(entry.changedAt).toLocaleString()})
                            </span>
                          </div>

                          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                            <User className="h-4 w-4" />
                            <span>Changed by <strong>{entry.changedBy.userName}</strong></span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          {getStatusBadge(entry)}
                          {getScopeBadge(entry.scope)}
                        </div>
                      </div>

                      {/* Properties Affected */}
                      {entry.scope !== 'single' && (
                        <div className="flex items-center gap-2 mb-3 text-sm text-gray-600 dark:text-gray-400">
                          <Building2 className="h-4 w-4" />
                          <span>
                            Affected {entry.propertiesAffected} {entry.propertiesAffected === 1 ? 'property' : 'properties'}
                          </span>
                        </div>
                      )}

                      {/* Changes */}
                      <div className="space-y-2 mb-3">
                        {Object.keys(entry.oldValues).map((key) => (
                          <div
                            key={key}
                            className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3 border border-gray-200 dark:border-gray-700"
                          >
                            <div className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2 capitalize">
                              {key.replace(/_/g, ' ')}
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                              <div>
                                <div className="text-xs text-gray-500 uppercase mb-1">Before</div>
                                <div className="text-sm bg-white dark:bg-gray-800 rounded p-2 font-mono">
                                  {formatValue(entry.oldValues[key])}
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <ArrowRight className="h-4 w-4 text-gray-400 hidden md:block" />
                                <div className="flex-1">
                                  <div className="text-xs text-gray-500 uppercase mb-1">After</div>
                                  <div className="text-sm bg-white dark:bg-gray-800 rounded p-2 font-mono">
                                    {formatValue(entry.newValues[key])}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Rollback Info */}
                      {entry.isRolledBack && (
                        <Alert className="mb-3">
                          <AlertCircle className="h-4 w-4" />
                          <AlertDescription>
                            <strong>Rolled back</strong> {entry.rolledBackAt && formatDistanceToNow(new Date(entry.rolledBackAt), { addSuffix: true })}
                            {entry.rolledBackBy && ` by ${entry.rolledBackBy.userName}`}
                            {entry.rollbackReason && (
                              <div className="mt-1 text-xs">Reason: {entry.rollbackReason}</div>
                            )}
                          </AlertDescription>
                        </Alert>
                      )}

                      {/* Rollback Button */}
                      {!entry.isRolledBack && canRollback(entry) && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRollbackClick(entry)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <RotateCcw className="h-4 w-4 mr-2" />
                          Rollback This Change
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Rollback Confirmation Dialog */}
      <Dialog open={rollbackDialogOpen} onOpenChange={setRollbackDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Confirm Rollback</DialogTitle>
            <DialogDescription>
              Are you sure you want to rollback this change? This will restore the previous settings.
            </DialogDescription>
          </DialogHeader>

          {selectedEntry && (
            <div className="space-y-4">
              {/* What will be restored */}
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                  <div className="text-sm">
                    <p className="font-medium text-amber-900 dark:text-amber-100 mb-2">
                      This will restore settings to:
                    </p>
                    <div className="space-y-1 text-amber-800 dark:text-amber-200">
                      {Object.keys(selectedEntry.oldValues).map((key) => (
                        <div key={key} className="font-mono text-xs">
                          {key}: {formatValue(selectedEntry.oldValues[key])}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Reason Input */}
              <div className="space-y-2">
                <Label htmlFor="rollback-reason">
                  Reason for Rollback <span className="text-red-500">*</span>
                </Label>
                <Textarea
                  id="rollback-reason"
                  value={rollbackReason}
                  onChange={(e) => setRollbackReason(e.target.value)}
                  placeholder="Please provide a reason for rolling back this change..."
                  rows={4}
                  className="resize-none"
                />
                <p className="text-xs text-gray-500">
                  This will be logged in the change history.
                </p>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setRollbackDialogOpen(false);
                setRollbackReason('');
                setSelectedEntry(null);
              }}
              disabled={rollbackMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirmRollback}
              disabled={rollbackMutation.isPending || !rollbackReason.trim()}
              className="bg-red-600 hover:bg-red-700"
            >
              {rollbackMutation.isPending ? (
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
    </>
  );
}

export default ChangeHistory;
