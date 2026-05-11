import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Badge } from '../ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { ScrollArea } from '../ui/scroll-area';
import { Pagination } from '../ui/Pagination';
import OptimizedSearch from '../ui/OptimizedSearch';
import {
  Calendar,
  FileText,
  User,
  Clock,
  Shield,
  AlertCircle,
  CheckCircle,
  XCircle,
  Eye,
  Download,
  Filter,
  RefreshCw,
  Activity,
  Loader2
} from 'lucide-react';
import { format } from 'date-fns';
import { api } from '../../services/api';

interface AuditLogEntry {
  id: string;
  timestamp: Date;
  userId: string;
  userName: string;
  userEmail: string;
  action: string;
  resourceType: 'property' | 'group' | 'user' | 'booking' | 'system';
  resourceId: string;
  resourceName: string;
  changes: {
    field: string;
    oldValue: unknown;
    newValue: unknown;
  }[];
  ipAddress: string;
  userAgent: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'success' | 'failed' | 'pending';
  metadata?: Record<string, unknown>;
}

interface AuditLogViewerProps {
  propertyGroupId?: string;
  onExport?: (filters: Record<string, unknown>) => void;
}

// Audit log data is fetched from the API inside the component

const getSeverityColor = (severity: string) => {
  switch (severity) {
    case 'critical': return 'text-red-600 bg-red-50 border-red-200';
    case 'high': return 'text-orange-600 bg-orange-50 border-orange-200';
    case 'medium': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    case 'low': return 'text-blue-600 bg-blue-50 border-blue-200';
    default: return 'text-gray-600 bg-gray-50 border-gray-200';
  }
};

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'success': return <CheckCircle className="h-4 w-4 text-green-500" />;
    case 'failed': return <XCircle className="h-4 w-4 text-red-500" />;
    case 'pending': return <Clock className="h-4 w-4 text-yellow-500" />;
    default: return <AlertCircle className="h-4 w-4 text-gray-500" />;
  }
};

const getActionIcon = (action: string) => {
  switch (action) {
    case 'CREATE': return <CheckCircle className="h-4 w-4 text-green-500" />;
    case 'UPDATE': return <Activity className="h-4 w-4 text-blue-500" />;
    case 'DELETE': return <XCircle className="h-4 w-4 text-red-500" />;
    case 'LOGIN': return <User className="h-4 w-4 text-blue-500" />;
    case 'LOGIN_FAILED': return <Shield className="h-4 w-4 text-red-500" />;
    default: return <FileText className="h-4 w-4 text-gray-500" />;
  }
};

export const AuditLogViewer: React.FC<AuditLogViewerProps> = ({
  propertyGroupId,
  onExport
}) => {
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [actionFilter, setActionFilter] = useState('all');
  const [resourceFilter, setResourceFilter] = useState('all');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedEntry, setSelectedEntry] = useState<AuditLogEntry | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [totalCount, setTotalCount] = useState(0);
  const isMountedRef = useRef(true);

  useEffect(() => {
    return () => { isMountedRef.current = false; };
  }, []);

  const fetchAuditLogs = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params: Record<string, unknown> = {
        page: currentPage,
        limit: itemsPerPage,
      };
      if (searchTerm) params.search = searchTerm;
      if (actionFilter !== 'all') params.action = actionFilter;
      if (resourceFilter !== 'all') params.resourceType = resourceFilter;
      if (severityFilter !== 'all') params.severity = severityFilter;
      if (statusFilter !== 'all') params.status = statusFilter;
      if (dateFrom) params.dateFrom = dateFrom;
      if (dateTo) params.dateTo = dateTo;
      if (propertyGroupId) params.propertyGroupId = propertyGroupId;

      const response = await api.get('/audit-trail', { params });
      if (!isMountedRef.current) return;

      const responseData = response.data?.data || response.data;
      const logs = Array.isArray(responseData)
        ? responseData
        : (responseData?.logs || responseData?.auditLogs || []);

      // Parse timestamps to Date objects
      const parsedLogs: AuditLogEntry[] = logs.map((log: Record<string, unknown>) => ({
        ...log,
        id: (log._id || log.id) as string,
        timestamp: new Date(log.timestamp as string || log.createdAt as string),
        changes: Array.isArray(log.changes) ? log.changes : [],
      }));

      setAuditLogs(parsedLogs);
      setTotalCount(response.data?.totalCount || response.data?.total || parsedLogs.length);
    } catch {
      if (isMountedRef.current) {
        setError('Failed to load audit logs. Please try again.');
        setAuditLogs([]);
      }
    } finally {
      if (isMountedRef.current) setIsLoading(false);
    }
  }, [currentPage, itemsPerPage, searchTerm, actionFilter, resourceFilter, severityFilter, statusFilter, dateFrom, dateTo, propertyGroupId]);

  useEffect(() => {
    fetchAuditLogs();
  }, [fetchAuditLogs]);

  // Client-side filtering is no longer needed since we pass filters to the API,
  // but we keep filtering logic for any extra client-side refinement
  const filteredLogs = auditLogs;

  // Pagination is now server-side
  const paginatedLogs = filteredLogs;

  const totalPages = Math.max(1, Math.ceil(totalCount / itemsPerPage));

  const handleExport = () => {
    const filters = {
      searchTerm,
      actionFilter,
      resourceFilter,
      severityFilter,
      statusFilter,
      dateFrom,
      dateTo,
      propertyGroupId
    };

    if (onExport) {
      onExport(filters);
    } else {
      // Default export logic
      const csvData = filteredLogs.map(log => ({
        timestamp: format(log.timestamp, 'yyyy-MM-dd HH:mm:ss'),
        user: log.userName,
        action: log.action,
        resource: `${log.resourceType}:${log.resourceName}`,
        severity: log.severity,
        status: log.status,
        ipAddress: log.ipAddress
      }));

    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Audit Log Viewer
          <Badge variant="secondary" className="ml-2">
            {filteredLogs.length} entries
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="logs" className="space-y-4">
          <TabsList>
            <TabsTrigger value="logs">Audit Logs</TabsTrigger>
            <TabsTrigger value="filters">Advanced Filters</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
          </TabsList>

          <TabsContent value="logs" className="space-y-4">
            {/* Quick Filters and Actions */}
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <OptimizedSearch
                  placeholder="Search by user, action, or resource..."
                  onSearch={setSearchTerm}
                  initialValue={searchTerm}
                />
              </div>

              <div className="flex gap-2">
                <Button variant="outline" onClick={handleExport}>
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </Button>
                <Button variant="outline" onClick={fetchAuditLogs} disabled={isLoading}>
                  <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
              </div>
            </div>

            {/* Quick Filter Badges */}
            <div className="flex flex-wrap gap-2">
              <Select value={actionFilter} onValueChange={setActionFilter}>
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="Action" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Actions</SelectItem>
                  <SelectItem value="CREATE">Create</SelectItem>
                  <SelectItem value="UPDATE">Update</SelectItem>
                  <SelectItem value="DELETE">Delete</SelectItem>
                  <SelectItem value="LOGIN">Login</SelectItem>
                  <SelectItem value="LOGIN_FAILED">Login Failed</SelectItem>
                </SelectContent>
              </Select>

              <Select value={severityFilter} onValueChange={setSeverityFilter}>
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="Severity" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Severity</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                </SelectContent>
              </Select>

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="success">Success</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Loading / Error / Empty States */}
            {isLoading && (
              <div className="flex items-center justify-center py-8 text-gray-500">
                <Loader2 className="h-5 w-5 animate-spin mr-2" />
                Loading audit logs...
              </div>
            )}

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm">
                {error}
              </div>
            )}

            {!isLoading && !error && paginatedLogs.length === 0 && (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center text-gray-500">
                No audit log entries found.
              </div>
            )}

            {/* Audit Log Entries */}
            <div className="space-y-2">
              {paginatedLogs.map((log) => (
                <Card key={log.id} className="hover:shadow-md transition-shadow cursor-pointer"
                      onClick={() => setSelectedEntry(log)}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3 flex-1">
                        {getActionIcon(log.action)}

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium">{log.action}</span>
                            <Badge className={`${getSeverityColor(log.severity)} border text-xs`}>
                              {log.severity}
                            </Badge>
                            {getStatusIcon(log.status)}
                          </div>

                          <p className="text-sm text-muted-foreground mb-2">
                            <strong>{log.userName}</strong> performed <strong>{log.action}</strong> on {log.resourceType}
                            "<strong>{log.resourceName}</strong>"
                          </p>

                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {format(log.timestamp, 'MMM dd, yyyy HH:mm')}
                            </span>
                            <span>IP: {log.ipAddress}</span>
                            {log.changes.length > 0 && (
                              <span>{log.changes.length} changes</span>
                            )}
                          </div>
                        </div>
                      </div>

                      <Button variant="ghost" size="sm">
                        <Eye className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={filteredLogs.length}
                itemsPerPage={itemsPerPage}
                onPageChange={setCurrentPage}
                onItemsPerPageChange={setItemsPerPage}
              />
            )}
          </TabsContent>

          <TabsContent value="filters" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="dateFrom">Date From</Label>
                <Input
                  id="dateFrom"
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                />
              </div>

              <div>
                <Label htmlFor="dateTo">Date To</Label>
                <Input
                  id="dateTo"
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                />
              </div>

              <div>
                <Label>Resource Type</Label>
                <Select value={resourceFilter} onValueChange={setResourceFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select resource type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Resources</SelectItem>
                    <SelectItem value="property">Property</SelectItem>
                    <SelectItem value="group">Group</SelectItem>
                    <SelectItem value="user">User</SelectItem>
                    <SelectItem value="booking">Booking</SelectItem>
                    <SelectItem value="system">System</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="analytics" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardContent className="p-4 text-center">
                  <div className="text-2xl font-bold text-blue-600">
                    {filteredLogs.filter(l => l.status === 'success').length}
                  </div>
                  <div className="text-sm text-muted-foreground">Successful Actions</div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4 text-center">
                  <div className="text-2xl font-bold text-red-600">
                    {filteredLogs.filter(l => l.status === 'failed').length}
                  </div>
                  <div className="text-sm text-muted-foreground">Failed Actions</div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4 text-center">
                  <div className="text-2xl font-bold text-orange-600">
                    {filteredLogs.filter(l => l.severity === 'high' || l.severity === 'critical').length}
                  </div>
                  <div className="text-sm text-muted-foreground">High/Critical Issues</div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>

        {/* Detailed Entry Modal */}
        {selectedEntry && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <Card className="w-full max-w-2xl max-h-[80vh] overflow-y-auto">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Audit Log Details</span>
                  <Button variant="ghost" size="sm" onClick={() => setSelectedEntry(null)}>
                    ×
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div><strong>Timestamp:</strong> {format(selectedEntry.timestamp, 'PPpp')}</div>
                  <div><strong>User:</strong> {selectedEntry.userName}</div>
                  <div><strong>Action:</strong> {selectedEntry.action}</div>
                  <div><strong>Resource:</strong> {selectedEntry.resourceType}:{selectedEntry.resourceName}</div>
                  <div><strong>IP Address:</strong> {selectedEntry.ipAddress}</div>
                  <div><strong>Status:</strong> {selectedEntry.status}</div>
                </div>

                {selectedEntry.changes.length > 0 && (
                  <div>
                    <h4 className="font-medium mb-2">Changes Made:</h4>
                    <div className="space-y-2">
                      {selectedEntry.changes.map((change, index) => (
                        <div key={`selectedEntry-changes-${change.field}`} className="p-2 bg-muted rounded text-sm">
                          <div><strong>Field:</strong> {change.field}</div>
                          <div><strong>Old Value:</strong> {JSON.stringify(change.oldValue)}</div>
                          <div><strong>New Value:</strong> {JSON.stringify(change.newValue)}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {selectedEntry.metadata && (
                  <div>
                    <h4 className="font-medium mb-2">Additional Information:</h4>
                    <pre className="p-2 bg-muted rounded text-xs overflow-auto">
                      {JSON.stringify(selectedEntry.metadata, null, 2)}
                    </pre>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </CardContent>
    </Card>
  );
};