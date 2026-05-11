import React, { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle
} from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { DataTable } from '../../components/dashboard/DataTable';
import { PropertyBreadcrumb } from '../../components/common/PropertyBreadcrumb';
import { useProperty } from '../../context/PropertyContext';
import { api } from '../../services/api';
import { queryKeys } from '../../config/reactQuery';
import { withErrorBoundary } from '../../components/ErrorBoundary';
import {
  Download,
  RefreshCw,
  Search,
  Filter,
  ChevronDown,
  ChevronRight,
  Clock,
  User,
  Settings,
  CheckCircle,
  XCircle,
  AlertCircle
} from 'lucide-react';

interface AuditLog {
  _id: string;
  timestamp: string;
  userId?: {
    _id: string;
    name: string;
    email: string;
    role?: string;
  };
  userName?: string;
  userEmail?: string;
  action: string;
  scope: 'single' | 'group' | 'all';
  settingType: string;
  settingName?: string;
  propertyId?: {
    _id: string;
    name: string;
    code?: string;
  };
  groupId?: {
    _id: string;
    name: string;
  };
  propertiesAffected: number;
  affectedPropertyIds?: string[];
  status: 'success' | 'failed' | 'partial';
  duration?: number;
  previousValues?: unknown;
  newValues?: unknown;
  changesSummary?: unknown;
  ipAddress?: string;
  userAgent?: string;
  errorMessage?: string;
}

interface AuditLogFilters {
  userId?: string;
  propertyId?: string;
  groupId?: string;
  settingType?: string;
  action?: string;
  scope?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
  page: number;
  limit: number;
}

function AuditLog() {
  const { selectedPropertyId } = useProperty();

  const [filters, setFilters] = useState<AuditLogFilters>({
    page: 1,
    limit: 50
  });
  const [showFilters, setShowFilters] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [searchInput, setSearchInput] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  // Debounce search input — wait 400ms after typing stops before hitting API
  useEffect(() => {
    debounceRef.current = setTimeout(() => {
      setFilters(prev => ({ ...prev, search: searchInput || undefined, page: 1 }));
    }, 400);
    return () => clearTimeout(debounceRef.current);
  }, [searchInput]);

  // Fetch audit logs
  const {
    data: auditLogsData,
    isLoading,
    isError,
    refetch
  } = useQuery({
    queryKey: queryKeys.auditLogs.list({ ...filters, selectedPropertyId }),
    queryFn: async () => {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          params.append(key, value.toString());
        }
      });
      if (selectedPropertyId) {
        params.append('propertyId', selectedPropertyId);
      }

      const response = await api.get(`/audit-log?${params.toString()}`);
      return response.data.data;
    },
    refetchInterval: autoRefresh ? 30000 : false
  });

  const logs = auditLogsData?.logs || [];
  const rawPagination = auditLogsData?.pagination || {};
  const pagination = {
    current: rawPagination.page || 1,
    pages: rawPagination.totalPages || 1,
    total: rawPagination.totalCount ?? 0
  };

  // Toggle row expansion
  const toggleRowExpansion = (logId: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(logId)) {
      newExpanded.delete(logId);
    } else {
      newExpanded.add(logId);
    }
    setExpandedRows(newExpanded);
  };

  // Export to CSV
  const handleExport = async (format: 'csv' | 'json' = 'csv') => {
    try {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value && key !== 'page' && key !== 'limit') {
          params.append(key, value.toString());
        }
      });
      if (selectedPropertyId) {
        params.append('hotelId', selectedPropertyId);
        params.append('propertyId', selectedPropertyId);
      }
      params.append('format', format);

      const response = await api.get(`/audit-log/export?${params.toString()}`, {
        responseType: 'blob'
      });

      // Create download link and clean up
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `audit-log-${Date.now()}.${format}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      toast.error('Failed to export audit log. Please try again.');
    }
  };

  // Get status badge
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'success':
        return (
          <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
            <CheckCircle className="h-3 w-3 mr-1" />
            Success
          </Badge>
        );
      case 'failed':
        return (
          <Badge className="bg-red-100 text-red-800 hover:bg-red-100">
            <XCircle className="h-3 w-3 mr-1" />
            Failed
          </Badge>
        );
      case 'partial':
        return (
          <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">
            <AlertCircle className="h-3 w-3 mr-1" />
            Partial
          </Badge>
        );
      default:
        return <Badge variant="outline">{status || '-'}</Badge>;
    }
  };

  // Get scope badge
  const getScopeBadge = (scope: string) => {
    switch (scope) {
      case 'single':
        return <Badge variant="outline" className="text-blue-700 border-blue-300">Single Property</Badge>;
      case 'group':
        return <Badge variant="outline" className="text-purple-700 border-purple-300">Property Group</Badge>;
      case 'all':
        return <Badge variant="outline" className="text-orange-700 border-orange-300">All Properties</Badge>;
      default:
        return <Badge variant="outline">{scope || '-'}</Badge>;
    }
  };

  // Table columns
  const columns = [
    {
      key: 'expand',
      header: '',
      render: (_: unknown, row: AuditLog) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => toggleRowExpansion(row._id)}
          className="p-0 h-6 w-6"
        >
          {expandedRows.has(row._id) ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </Button>
      ),
      width: '50px'
    },
    {
      key: 'timestamp',
      header: 'Timestamp',
      render: (value: string) => {
        if (!value) return <span className="text-sm text-gray-400">-</span>;
        const date = new Date(value);
        if (isNaN(date.getTime())) return <span className="text-sm text-gray-400">Invalid date</span>;
        return (
          <div className="flex flex-col">
            <span className="text-sm font-medium">
              {format(date, 'MMM dd, yyyy')}
            </span>
            <span className="text-xs text-gray-500">
              {format(date, 'HH:mm:ss')}
            </span>
          </div>
        );
      }
    },
    {
      key: 'userId',
      header: 'User',
      render: (value: any) => (
        <div className="flex items-center space-x-2">
          <User className="h-4 w-4 text-gray-400" />
          <div className="flex flex-col">
            <span className="text-sm font-medium">{value?.name || 'Unknown'}</span>
            <span className="text-xs text-gray-500">{value?.email || ''}</span>
          </div>
        </div>
      )
    },
    {
      key: 'action',
      header: 'Action',
      render: (value: string) => (
        <span className="text-sm capitalize">{value?.replace(/_/g, ' ') || '-'}</span>
      )
    },
    {
      key: 'scope',
      header: 'Scope',
      render: (value: string) => getScopeBadge(value)
    },
    {
      key: 'settingType',
      header: 'Setting Type',
      render: (value: string) => (
        <div className="flex items-center space-x-2">
          <Settings className="h-4 w-4 text-gray-400" />
          <span className="text-sm capitalize">{value?.replace(/[-_]/g, ' ') || '-'}</span>
        </div>
      )
    },
    {
      key: 'propertiesAffected',
      header: 'Properties',
      render: (value: number) => (
        <Badge variant="secondary">
          {value || 0} {value === 1 ? 'property' : 'properties'}
        </Badge>
      ),
      align: 'center' as const
    },
    {
      key: 'status',
      header: 'Status',
      render: (value: string) => getStatusBadge(value)
    },
    {
      key: 'duration',
      header: 'Duration',
      render: (value: number) => (
        <div className="flex items-center space-x-1 text-sm text-gray-600">
          <Clock className="h-3 w-3" />
          <span>{value ? `${value}ms` : '-'}</span>
        </div>
      ),
      align: 'right' as const
    }
  ];

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Breadcrumb */}
      <PropertyBreadcrumb items={['Audit Log']} />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Audit Log</h1>
          <p className="text-gray-600 mt-1">Track all settings changes across your properties</p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={autoRefresh ? 'border-green-500 text-green-700' : ''}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${autoRefresh ? 'animate-spin' : ''}`} />
            {autoRefresh ? 'Auto-refresh ON' : 'Auto-refresh OFF'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleExport('csv')}
          >
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Filters</CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
            >
              <Filter className="h-4 w-4 mr-2" />
              {showFilters ? 'Hide' : 'Show'} Filters
            </Button>
          </div>
        </CardHeader>
        {showFilters && (
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Search */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Search
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <Input
                    type="text"
                    placeholder="Search logs..."
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              {/* Action */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Action
                </label>
                <select
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                  value={filters.action || ''}
                  onChange={(e) => setFilters({ ...filters, action: e.target.value || undefined, page: 1 })}
                >
                  <option value="">All Actions</option>
                  <option value="create">Create</option>
                  <option value="update">Update</option>
                  <option value="delete">Delete</option>
                  <option value="rollback">Rollback</option>
                  <option value="schedule">Schedule</option>
                  <option value="cancel">Cancel</option>
                </select>
              </div>

              {/* Scope */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Scope
                </label>
                <select
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                  value={filters.scope || ''}
                  onChange={(e) => setFilters({ ...filters, scope: e.target.value || undefined, page: 1 })}
                >
                  <option value="">All Scopes</option>
                  <option value="single">Single Property</option>
                  <option value="group">Property Group</option>
                  <option value="all">All Properties</option>
                </select>
              </div>

              {/* Status */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Status
                </label>
                <select
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                  value={filters.status || ''}
                  onChange={(e) => setFilters({ ...filters, status: e.target.value || undefined, page: 1 })}
                >
                  <option value="">All Status</option>
                  <option value="success">Success</option>
                  <option value="failed">Failed</option>
                  <option value="partial">Partial</option>
                </select>
              </div>

              {/* Setting Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Setting Type
                </label>
                <select
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                  value={filters.settingType || ''}
                  onChange={(e) => setFilters({ ...filters, settingType: e.target.value || undefined, page: 1 })}
                >
                  <option value="">All Types</option>
                  <option value="check-in-out">Check-in/out</option>
                  <option value="currency">Currency</option>
                  <option value="timezone">Timezone</option>
                  <option value="payment-gateway">Payment Gateway</option>
                  <option value="taxes">Taxes</option>
                  <option value="room-types">Room Types</option>
                  <option value="cancellation-policy">Cancellation Policy</option>
                  <option value="security">Security</option>
                </select>
              </div>

              {/* Start Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Start Date
                </label>
                <Input
                  type="date"
                  value={filters.startDate || ''}
                  onChange={(e) => setFilters({ ...filters, startDate: e.target.value || undefined, page: 1 })}
                />
              </div>

              {/* End Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  End Date
                </label>
                <Input
                  type="date"
                  value={filters.endDate || ''}
                  onChange={(e) => setFilters({ ...filters, endDate: e.target.value || undefined, page: 1 })}
                />
              </div>

              {/* Clear Filters */}
              <div className="flex items-end">
                <Button
                  variant="outline"
                  onClick={() => { setSearchInput(''); setFilters({ page: 1, limit: 50 }); }}
                  className="w-full"
                >
                  Clear Filters
                </Button>
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Error State */}
      {isError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800 text-sm">
          Failed to load audit logs. Please try refreshing.
        </div>
      )}

      {/* Results Info */}
      <div className="flex items-center justify-between text-sm text-gray-600">
        <span>
          {pagination.total > 0
            ? `Showing ${((filters.page - 1) * filters.limit) + 1} to ${Math.min(filters.page * filters.limit, pagination.total)} of ${pagination.total} logs`
            : 'No logs found'}
        </span>
        <span>
          Page {pagination.current} of {pagination.pages}
        </span>
      </div>

      {/* Audit Logs Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <DataTable
          title=""
          data={logs}
          columns={columns}
          loading={isLoading}
          searchable={false}
          pagination={false}
          emptyMessage="No audit logs found"
        />

        {/* Expanded Row Details */}
        {logs.map((log: AuditLog) =>
          expandedRows.has(log._id) ? (
            <div key={`expanded-${log._id}`} className="border-t border-gray-200 bg-gray-50 p-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Left Column */}
                <div className="space-y-4">
                  <div>
                    <h4 className="text-sm font-semibold text-gray-900 mb-2">Details</h4>
                    <div className="space-y-2 text-sm">
                      {log.propertyId && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">Property:</span>
                          <span className="font-medium">{log.propertyId.name}</span>
                        </div>
                      )}
                      {log.groupId && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">Group:</span>
                          <span className="font-medium">{log.groupId.name}</span>
                        </div>
                      )}
                      {log.ipAddress && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">IP Address:</span>
                          <span className="font-mono text-xs">{log.ipAddress}</span>
                        </div>
                      )}
                      {log.userAgent && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">User Agent:</span>
                          <span className="font-mono text-xs truncate max-w-xs">
                            {log.userAgent}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {log.errorMessage && (
                    <div>
                      <h4 className="text-sm font-semibold text-red-900 mb-2">Error Message</h4>
                      <div className="bg-red-50 border border-red-200 rounded p-3 text-sm text-red-800">
                        {log.errorMessage}
                      </div>
                    </div>
                  )}
                </div>

                {/* Right Column - Changes */}
                {(log.previousValues || log.newValues) && (
                  <div>
                    <h4 className="text-sm font-semibold text-gray-900 mb-2">Changes</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <span className="text-xs text-gray-600 uppercase tracking-wide">Before</span>
                        <pre className="mt-1 bg-white border border-gray-200 rounded p-3 text-xs overflow-x-auto">
                          {JSON.stringify(log.previousValues, null, 2)}
                        </pre>
                      </div>
                      <div>
                        <span className="text-xs text-gray-600 uppercase tracking-wide">After</span>
                        <pre className="mt-1 bg-white border border-gray-200 rounded p-3 text-xs overflow-x-auto">
                          {JSON.stringify(log.newValues, null, 2)}
                        </pre>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : null
        )}
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setFilters({ ...filters, page: Math.max(1, filters.page - 1) })}
          disabled={pagination.current === 1}
        >
          Previous
        </Button>

        {[...Array(Math.max(0, Math.min(5, pagination.pages || 0)))].map((_, i) => {
          const pageNum = Math.max(1, pagination.current - 2) + i;
          if (pageNum > pagination.pages) return null;

          return (
            <Button
              key={pageNum}
              variant={pageNum === pagination.current ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilters({ ...filters, page: pageNum })}
            >
              {pageNum}
            </Button>
          );
        })}

        {pagination.pages > 5 && pagination.current < pagination.pages - 2 && (
          <>
            <span className="text-gray-400">...</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setFilters({ ...filters, page: pagination.pages })}
            >
              {pagination.pages}
            </Button>
          </>
        )}

        <Button
          variant="outline"
          size="sm"
          onClick={() => setFilters({ ...filters, page: Math.min(pagination.pages, filters.page + 1) })}
          disabled={pagination.current === pagination.pages}
        >
          Next
        </Button>
      </div>
    </div>
  );
}

export default withErrorBoundary(AuditLog);
