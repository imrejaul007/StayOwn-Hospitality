import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Moon,
  Calendar,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  Clock,
  Lock,
  DollarSign,
  Users,
  Bed,
  Info,
  ChevronLeft,
  ChevronRight,
  FileText,
  XCircle,
  AlertCircle,
} from 'lucide-react';
import { cn } from '../../utils/cn';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { api } from '../../services/api';
import { useProperty } from '../../context/PropertyContext';
import { withErrorBoundary } from '../../components/ErrorBoundary';

interface NightAuditSummary {
  roomInventory: {
    totalRooms: number;
    occupied: number;
    vacant: number;
    outOfOrder: number;
    discrepancies: number;
  };
  bookingReconciliation: {
    totalBookings: number;
    confirmedArrivals: number;
    actualArrivals: number;
    noShows: number;
    cancellations: number;
    departures: number;
    stayovers: number;
  };
  revenue: {
    roomRevenue: number;
    totalRevenue: number;
    journalEntriesCreated: number;
  };
  noShowProcessing: {
    detected: number;
    processed: number;
    chargesApplied: number;
  };
  settlement: {
    totalPaymentsReceived: number;
    totalChargesPosted: number;
    variance: number;
    unreconciledItems: number;
  };
}

interface AuditStep {
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  startedAt?: string;
  completedAt?: string;
  errors?: string[];
  warnings?: string[];
}

interface NightAuditRecord {
  _id: string;
  hotelId: string;
  auditDate: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'partially_completed';
  startedAt?: string;
  completedAt?: string;
  initiatedBy: 'manual' | 'scheduled';
  initiatedByUser?: { _id: string; name: string };
  steps?: AuditStep[];
  summary?: NightAuditSummary;
  locked: boolean;
  lockedAt?: string;
  lockedBy?: { _id: string; name: string };
  createdAt: string;
  updatedAt: string;
}

interface AuditListResponse {
  audits: NightAuditRecord[];
}

interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  pages: number;
}

const fetchAuditHistory = async (
  hotelId: string,
  page: number,
  limit: number
): Promise<{ audits: NightAuditRecord[]; pagination: PaginationMeta }> => {
  const { data } = await api.get('/night-audit', {
    params: { hotelId, page, limit },
  });
  return {
    audits: data.data?.audits || [],
    pagination: data.pagination || { total: 0, page, limit, pages: 0 },
  };
};

const fetchAuditByDate = async (
  hotelId: string,
  date: string
): Promise<NightAuditRecord | null> => {
  try {
    const { data } = await api.get(`/night-audit/${date}`, {
      params: { hotelId },
    });
    return data.data?.audit || null;
  } catch {
    return null;
  }
};

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(amount || 0);
};

const formatDate = (dateStr: string): string => {
  return new Date(dateStr).toLocaleDateString('en-US', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

const formatDateTime = (dateStr: string): string => {
  return new Date(dateStr).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const getStatusBadge = (status: string) => {
  switch (status) {
    case 'completed':
      return (
        <Badge className="bg-green-100 text-green-800 border-green-200">
          <CheckCircle className="w-3 h-3 mr-1" />
          Completed
        </Badge>
      );
    case 'in_progress':
      return (
        <Badge className="bg-blue-100 text-blue-800 border-blue-200">
          <Clock className="w-3 h-3 mr-1" />
          In Progress
        </Badge>
      );
    case 'failed':
      return (
        <Badge className="bg-red-100 text-red-800 border-red-200">
          <XCircle className="w-3 h-3 mr-1" />
          Failed
        </Badge>
      );
    case 'partially_completed':
      return (
        <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">
          <AlertTriangle className="w-3 h-3 mr-1" />
          Partial
        </Badge>
      );
    default:
      return (
        <Badge className="bg-gray-100 text-gray-800 border-gray-200">
          <Clock className="w-3 h-3 mr-1" />
          Pending
        </Badge>
      );
  }
};

function FrontDeskNightAudit() {
  const { selectedProperty } = useProperty();
  const [page, setPage] = useState(1);
  const [selectedAuditDate, setSelectedAuditDate] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const limit = 10;

  const {
    data: historyData,
    isLoading: historyLoading,
    error: historyError,
    refetch: refetchHistory,
  } = useQuery({
    queryKey: ['frontdesk-night-audit-history', selectedProperty?._id, page],
    queryFn: () => fetchAuditHistory(selectedProperty!._id, page, limit),
    enabled: !!selectedProperty,
    keepPreviousData: true,
  });

  const {
    data: selectedAudit,
    isLoading: detailLoading,
  } = useQuery({
    queryKey: ['frontdesk-night-audit-detail', selectedProperty?._id, selectedAuditDate],
    queryFn: () => fetchAuditByDate(selectedProperty!._id, selectedAuditDate!),
    enabled: !!selectedProperty && !!selectedAuditDate,
  });

  const handleRefresh = () => {
    setRefreshing(true);
    refetchHistory().finally(() => setTimeout(() => setRefreshing(false), 500));
  };

  const audits = historyData?.audits || [];
  const pagination = historyData?.pagination || { total: 0, page: 1, limit, pages: 0 };

  // Property guard
  if (!selectedProperty) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Night Audit Reports</h1>
          <p className="text-gray-600">View night audit reports and history</p>
        </div>
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-lg">
          <div className="flex items-center">
            <AlertCircle className="h-5 w-5 text-yellow-400 mr-3" />
            <p className="text-sm font-medium text-yellow-800">
              Please select a property to view night audit reports.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (historyLoading && !historyData) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <LoadingSpinner size="large" />
      </div>
    );
  }

  if (historyError) {
    return (
      <div className="text-center py-12">
        <AlertTriangle className="mx-auto h-12 w-12 text-red-500 mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">Failed to load night audit data</h3>
        <p className="text-gray-500 mb-4">There was an error loading the audit reports.</p>
        <Button onClick={() => refetchHistory()}>Try Again</Button>
      </div>
    );
  }

  const occupancyRate =
    selectedAudit?.summary?.roomInventory?.totalRooms
      ? ((selectedAudit.summary.roomInventory.occupied / selectedAudit.summary.roomInventory.totalRooms) * 100).toFixed(1)
      : '0.0';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Night Audit Reports</h1>
          <p className="text-gray-600">View nightly audit summaries and reconciliation data</p>
        </div>
        <Button
          onClick={handleRefresh}
          disabled={refreshing}
          variant="outline"
          className="flex items-center"
        >
          <RefreshCw className={cn('w-4 h-4 mr-2', refreshing && 'animate-spin')} />
          Refresh
        </Button>
      </div>

      {/* Info Notice */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-800 flex items-start gap-2">
          <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span>
            <strong>Front Desk Access:</strong> You can view night audit reports and browse audit
            history. Running or locking audits is restricted to administrators and managers.
          </span>
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Audit History List */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                Audit History
              </CardTitle>
            </CardHeader>
            <CardContent>
              {audits.length === 0 ? (
                <div className="text-center py-8">
                  <Moon className="mx-auto h-8 w-8 text-gray-400 mb-2" />
                  <p className="text-sm text-gray-500">No audit reports found</p>
                  <p className="text-xs text-gray-400 mt-1">
                    Night audits are generated automatically or by administrators.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {audits.map((audit) => (
                    <button
                      key={audit._id}
                      onClick={() => setSelectedAuditDate(audit.auditDate.split('T')[0])}
                      className={cn(
                        'w-full text-left p-3 rounded-lg border transition-colors',
                        selectedAuditDate === audit.auditDate.split('T')[0]
                          ? 'bg-blue-50 border-blue-300'
                          : 'bg-gray-50 border-gray-100 hover:bg-gray-100'
                      )}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-gray-900">
                          {formatDate(audit.auditDate)}
                        </span>
                        {audit.locked && <Lock className="w-3.5 h-3.5 text-gray-500" />}
                      </div>
                      <div className="flex items-center justify-between">
                        {getStatusBadge(audit.status)}
                        <span className="text-xs text-gray-500">
                          {audit.initiatedBy === 'manual' ? 'Manual' : 'Scheduled'}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {/* Pagination Controls */}
              {pagination.pages > 1 && (
                <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-200">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <span className="text-sm text-gray-600">
                    Page {pagination.page} of {pagination.pages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.min(pagination.pages, p + 1))}
                    disabled={page >= pagination.pages}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right: Audit Detail */}
        <div className="lg:col-span-2 space-y-6">
          {!selectedAuditDate ? (
            <Card>
              <CardContent className="py-12">
                <div className="text-center">
                  <FileText className="mx-auto h-12 w-12 text-gray-300 mb-3" />
                  <h3 className="text-lg font-medium text-gray-900 mb-1">Select an Audit Report</h3>
                  <p className="text-sm text-gray-500">
                    Choose an audit date from the list to view its details.
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : detailLoading ? (
            <div className="flex justify-center items-center min-h-[300px]">
              <LoadingSpinner size="large" />
            </div>
          ) : !selectedAudit ? (
            <Card>
              <CardContent className="py-12">
                <div className="text-center">
                  <AlertTriangle className="mx-auto h-10 w-10 text-yellow-500 mb-3" />
                  <h3 className="text-lg font-medium text-gray-900 mb-1">Audit Not Found</h3>
                  <p className="text-sm text-gray-500">
                    No audit data was found for the selected date.
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Audit Header */}
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between flex-wrap gap-3">
                    <div>
                      <h2 className="text-lg font-semibold text-gray-900">
                        Audit: {formatDate(selectedAudit.auditDate)}
                      </h2>
                      <p className="text-sm text-gray-500">
                        {selectedAudit.initiatedBy === 'manual' ? 'Manually triggered' : 'Scheduled run'}
                        {selectedAudit.initiatedByUser && (
                          <> by {selectedAudit.initiatedByUser.name}</>
                        )}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      {getStatusBadge(selectedAudit.status)}
                      {selectedAudit.locked && (
                        <Badge className="bg-gray-100 text-gray-700 border-gray-300">
                          <Lock className="w-3 h-3 mr-1" />
                          Locked
                          {selectedAudit.lockedBy && <> by {selectedAudit.lockedBy.name}</>}
                        </Badge>
                      )}
                    </div>
                  </div>
                  {(selectedAudit.startedAt || selectedAudit.completedAt) && (
                    <div className="mt-2 flex gap-4 text-xs text-gray-500">
                      {selectedAudit.startedAt && (
                        <span>Started: {formatDateTime(selectedAudit.startedAt)}</span>
                      )}
                      {selectedAudit.completedAt && (
                        <span>Completed: {formatDateTime(selectedAudit.completedAt)}</span>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Revenue Summary */}
              {selectedAudit.summary && (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <Card>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm text-gray-500">Room Revenue</p>
                            <p className="text-xl font-bold text-gray-900">
                              {formatCurrency(selectedAudit.summary.revenue?.roomRevenue)}
                            </p>
                          </div>
                          <DollarSign className="w-8 h-8 text-green-500 opacity-70" />
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm text-gray-500">Total Revenue</p>
                            <p className="text-xl font-bold text-gray-900">
                              {formatCurrency(selectedAudit.summary.revenue?.totalRevenue)}
                            </p>
                          </div>
                          <DollarSign className="w-8 h-8 text-blue-500 opacity-70" />
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm text-gray-500">Occupancy Rate</p>
                            <p className="text-xl font-bold text-gray-900">{occupancyRate}%</p>
                          </div>
                          <Bed className="w-8 h-8 text-purple-500 opacity-70" />
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm text-gray-500">No-Shows</p>
                            <p className="text-xl font-bold text-gray-900">
                              {selectedAudit.summary.bookingReconciliation?.noShows ?? 0}
                            </p>
                          </div>
                          <Users className="w-8 h-8 text-red-500 opacity-70" />
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Room Inventory */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Bed className="w-5 h-5" />
                        Room Inventory
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                        <div className="bg-gray-50 rounded-lg p-3 text-center">
                          <p className="text-xs text-gray-500 font-medium">Total Rooms</p>
                          <p className="text-2xl font-bold text-gray-900">
                            {selectedAudit.summary.roomInventory?.totalRooms ?? 0}
                          </p>
                        </div>
                        <div className="bg-blue-50 rounded-lg p-3 text-center">
                          <p className="text-xs text-blue-600 font-medium">Occupied</p>
                          <p className="text-2xl font-bold text-blue-800">
                            {selectedAudit.summary.roomInventory?.occupied ?? 0}
                          </p>
                        </div>
                        <div className="bg-green-50 rounded-lg p-3 text-center">
                          <p className="text-xs text-green-600 font-medium">Vacant</p>
                          <p className="text-2xl font-bold text-green-800">
                            {selectedAudit.summary.roomInventory?.vacant ?? 0}
                          </p>
                        </div>
                        <div className="bg-orange-50 rounded-lg p-3 text-center">
                          <p className="text-xs text-orange-600 font-medium">Out of Order</p>
                          <p className="text-2xl font-bold text-orange-800">
                            {selectedAudit.summary.roomInventory?.outOfOrder ?? 0}
                          </p>
                        </div>
                        <div className="bg-red-50 rounded-lg p-3 text-center">
                          <p className="text-xs text-red-600 font-medium">Discrepancies</p>
                          <p className="text-2xl font-bold text-red-800">
                            {selectedAudit.summary.roomInventory?.discrepancies ?? 0}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Booking Reconciliation */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Users className="w-5 h-5" />
                        Booking Reconciliation
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {[
                          { label: 'Total Bookings', value: selectedAudit.summary.bookingReconciliation?.totalBookings, bg: 'bg-gray-50', color: 'text-gray-900' },
                          { label: 'Confirmed Arrivals', value: selectedAudit.summary.bookingReconciliation?.confirmedArrivals, bg: 'bg-blue-50', color: 'text-blue-800' },
                          { label: 'Actual Arrivals', value: selectedAudit.summary.bookingReconciliation?.actualArrivals, bg: 'bg-green-50', color: 'text-green-800' },
                          { label: 'No-Shows', value: selectedAudit.summary.bookingReconciliation?.noShows, bg: 'bg-red-50', color: 'text-red-800' },
                          { label: 'Cancellations', value: selectedAudit.summary.bookingReconciliation?.cancellations, bg: 'bg-orange-50', color: 'text-orange-800' },
                          { label: 'Departures', value: selectedAudit.summary.bookingReconciliation?.departures, bg: 'bg-purple-50', color: 'text-purple-800' },
                          { label: 'Stayovers', value: selectedAudit.summary.bookingReconciliation?.stayovers, bg: 'bg-teal-50', color: 'text-teal-800' },
                        ].map((item) => (
                          <div key={item.label} className={cn('rounded-lg p-3 text-center', item.bg)}>
                            <p className="text-xs text-gray-500 font-medium">{item.label}</p>
                            <p className={cn('text-2xl font-bold', item.color)}>
                              {item.value ?? 0}
                            </p>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Settlement / Outstanding Balances */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <DollarSign className="w-5 h-5" />
                        Settlement Summary
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="bg-green-50 rounded-lg p-3 text-center">
                          <p className="text-xs text-green-600 font-medium">Payments Received</p>
                          <p className="text-lg font-bold text-green-800">
                            {formatCurrency(selectedAudit.summary.settlement?.totalPaymentsReceived)}
                          </p>
                        </div>
                        <div className="bg-blue-50 rounded-lg p-3 text-center">
                          <p className="text-xs text-blue-600 font-medium">Charges Posted</p>
                          <p className="text-lg font-bold text-blue-800">
                            {formatCurrency(selectedAudit.summary.settlement?.totalChargesPosted)}
                          </p>
                        </div>
                        <div
                          className={cn(
                            'rounded-lg p-3 text-center',
                            (selectedAudit.summary.settlement?.variance ?? 0) !== 0
                              ? 'bg-red-50'
                              : 'bg-gray-50'
                          )}
                        >
                          <p className="text-xs text-gray-600 font-medium">Variance</p>
                          <p
                            className={cn(
                              'text-lg font-bold',
                              (selectedAudit.summary.settlement?.variance ?? 0) !== 0
                                ? 'text-red-800'
                                : 'text-gray-900'
                            )}
                          >
                            {formatCurrency(selectedAudit.summary.settlement?.variance)}
                          </p>
                        </div>
                        <div
                          className={cn(
                            'rounded-lg p-3 text-center',
                            (selectedAudit.summary.settlement?.unreconciledItems ?? 0) > 0
                              ? 'bg-yellow-50'
                              : 'bg-gray-50'
                          )}
                        >
                          <p className="text-xs text-gray-600 font-medium">Unreconciled Items</p>
                          <p
                            className={cn(
                              'text-lg font-bold',
                              (selectedAudit.summary.settlement?.unreconciledItems ?? 0) > 0
                                ? 'text-yellow-800'
                                : 'text-gray-900'
                            )}
                          >
                            {selectedAudit.summary.settlement?.unreconciledItems ?? 0}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* No-Show Processing */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5" />
                        No-Show Processing
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-3 gap-4">
                        <div className="bg-red-50 rounded-lg p-3 text-center">
                          <p className="text-xs text-red-600 font-medium">Detected</p>
                          <p className="text-2xl font-bold text-red-800">
                            {selectedAudit.summary.noShowProcessing?.detected ?? 0}
                          </p>
                        </div>
                        <div className="bg-orange-50 rounded-lg p-3 text-center">
                          <p className="text-xs text-orange-600 font-medium">Processed</p>
                          <p className="text-2xl font-bold text-orange-800">
                            {selectedAudit.summary.noShowProcessing?.processed ?? 0}
                          </p>
                        </div>
                        <div className="bg-yellow-50 rounded-lg p-3 text-center">
                          <p className="text-xs text-yellow-600 font-medium">Charges Applied</p>
                          <p className="text-2xl font-bold text-yellow-800">
                            {formatCurrency(selectedAudit.summary.noShowProcessing?.chargesApplied)}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </>
              )}

              {/* Audit Steps */}
              {selectedAudit.steps && selectedAudit.steps.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <FileText className="w-5 h-5" />
                      Audit Steps
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {selectedAudit.steps.map((step, index) => (
                        <div
                          key={index}
                          className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-100"
                        >
                          <div className="flex items-center gap-3">
                            {step.status === 'completed' ? (
                              <CheckCircle className="w-4 h-4 text-green-500" />
                            ) : step.status === 'failed' ? (
                              <XCircle className="w-4 h-4 text-red-500" />
                            ) : step.status === 'running' ? (
                              <Clock className="w-4 h-4 text-blue-500" />
                            ) : step.status === 'skipped' ? (
                              <AlertTriangle className="w-4 h-4 text-yellow-500" />
                            ) : (
                              <Clock className="w-4 h-4 text-gray-400" />
                            )}
                            <div>
                              <p className="text-sm font-medium text-gray-900">
                                {step.name.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                              </p>
                              {step.errors && step.errors.length > 0 && (
                                <p className="text-xs text-red-500 mt-0.5">{step.errors[0]}</p>
                              )}
                              {step.warnings && step.warnings.length > 0 && (
                                <p className="text-xs text-yellow-600 mt-0.5">{step.warnings[0]}</p>
                              )}
                            </div>
                          </div>
                          <Badge
                            className={cn(
                              'text-xs',
                              step.status === 'completed'
                                ? 'bg-green-100 text-green-800'
                                : step.status === 'failed'
                                ? 'bg-red-100 text-red-800'
                                : step.status === 'skipped'
                                ? 'bg-yellow-100 text-yellow-800'
                                : 'bg-gray-100 text-gray-800'
                            )}
                          >
                            {step.status}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default withErrorBoundary(FrontDeskNightAudit);
