import React, { useState, useEffect, useCallback, useRef } from 'react';
import { format, parseISO } from 'date-fns';
import {
  Package,
  Clock,
  CheckCircle,
  AlertCircle,
  Filter,
  Eye,
  User,
  MessageSquare,
  RefreshCw,
  UserCheck,
  Play,
  CheckSquare,
  TrendingUp,
  Activity,
  Zap,
  Package2,
  Users,
  AlertTriangle,
  CheckCheck,
  XCircle,
  Download,
  Search,
  History,
  CheckCircle2,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/Modal';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import ErrorBoundary from '../../components/ErrorBoundary';
import toast from 'react-hot-toast';
import { adminGuestServicesService, GuestService, GuestServiceFilters } from '../../services/adminGuestServicesService';
import { api } from '../../services/api';
import '../../styles/inventory-requests-animations.css';
import { useProperty } from '../../context/PropertyContext';
import { PropertyBreadcrumb } from '../../components/common/PropertyBreadcrumb';
import { useRealTime } from '../../services/realTimeService';

interface InventoryRequest extends GuestService {
  items?: Array<{
    name: string;
    quantity: number;
    price: number;
  }>;
  specialInstructions?: string;
}

interface InventoryStats {
  total: number;
  pending: number;
  assigned: number;
  inProgress: number;
  completed: number;
  cancelled: number;
  urgent: number;
  avgCompletionTime: number;
}

interface AuditLogEntry {
  _id: string;
  action: string;
  userId: {
    name: string;
    email: string;
  };
  changes: {
    field: string;
    oldValue: unknown;
    newValue: unknown;
  }[];
  timestamp: string;
}

interface BulkOperationData {
  operation: 'assign' | 'updateStatus';
  requestIds: string[];
  assignedTo?: string;
  status?: string;
  notes?: string;
}

/** Safe date formatting helper -- returns fallback string when the value is missing or invalid */
function safeFormatDate(dateStr: string | undefined | null, formatStr: string): string {
  if (!dateStr) return 'N/A';
  try {
    return format(parseISO(dateStr), formatStr);
  } catch {
    return 'N/A';
  }
}

export default function AdminInventoryRequests() {
  const { selectedPropertyId, viewMode } = useProperty();
  const { on, off } = useRealTime();
  const [requests, setRequests] = useState<InventoryRequest[]>([]);
  const [stats, setStats] = useState<InventoryStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [filters, setFilters] = useState<GuestServiceFilters>({ 
    serviceType: 'other',
    serviceVariation: 'inventory_request',
    page: 1, 
    limit: 20 
  });
  const [pagination, setPagination] = useState({ total: 0, pages: 0 });
  const [availableStaff, setAvailableStaff] = useState<Array<{ _id: string; name: string; email: string; department: string }>>([]);

  // Search and bulk operations state
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRequests, setSelectedRequests] = useState<Set<string>>(new Set());
  const [showBulkActions, setShowBulkActions] = useState(false);
  const [bulkActionData, setBulkActionData] = useState<BulkOperationData>({ operation: 'assign', requestIds: [] });
  const [showAuditModal, setShowAuditModal] = useState(false);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [loadingAudit, setLoadingAudit] = useState(false);

  // Debounced search
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Modal states
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<InventoryRequest | null>(null);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignData, setAssignData] = useState({
    assignedTo: '',
    notes: '',
    scheduledTime: ''
  });

  const fetchRequests = async () => {
    try {
      setLoading(true);
      const response = await adminGuestServicesService.getServices({
        ...filters,
        hotelId: selectedPropertyId
      } as GuestServiceFilters & { hotelId?: string });
      let inventoryRequests = response.data.serviceRequests || [];

      // Apply search filter if search term exists
      if (searchTerm.trim()) {
        const searchLower = searchTerm.toLowerCase();
        inventoryRequests = inventoryRequests.filter(request => {
          const guestName = request.userId?.name?.toLowerCase() || '';
          const roomNumber = request.bookingId?.rooms?.[0]?.roomId?.roomNumber?.toString() || '';
          const title = request.title?.toLowerCase() || '';
          const description = request.description?.toLowerCase() || '';
          const itemNames = request.items?.map(item => item.name?.toLowerCase()).join(' ') || '';

          return guestName.includes(searchLower) ||
                 roomNumber.includes(searchLower) ||
                 title.includes(searchLower) ||
                 description.includes(searchLower) ||
                 itemNames.includes(searchLower);
        });
      }

      setRequests(inventoryRequests);
      setPagination({
        total: response.data.pagination?.total || inventoryRequests.length,
        pages: response.data.pagination?.pages || 1
      });
    } catch (error) {
      toast.error('Failed to load inventory requests');
    } finally {
      setLoading(false);
    }
  };

  const computeStats = useCallback((reqs: InventoryRequest[]) => {
    const inventoryStats: InventoryStats = {
      total: reqs.length,
      pending: reqs.filter(r => r.status === 'pending').length,
      assigned: reqs.filter(r => r.status === 'assigned').length,
      inProgress: reqs.filter(r => r.status === 'in_progress').length,
      completed: reqs.filter(r => r.status === 'completed').length,
      cancelled: reqs.filter(r => r.status === 'cancelled').length,
      urgent: reqs.filter(r => r.priority === 'urgent' || r.priority === 'high').length,
      avgCompletionTime: 0
    };
    setStats(inventoryStats);
  }, []);

  const fetchAvailableStaff = async () => {
    try {
      const response = await adminGuestServicesService.getAvailableStaff(selectedPropertyId);
      setAvailableStaff(response.data || []);
    } catch {
      setAvailableStaff([]);
    }
  };

  // Debounced search function
  const debouncedSearch = useCallback((term: string) => {
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }
    debounceTimeoutRef.current = setTimeout(() => {
      setSearchTerm(term);
    }, 300);
  }, []);

  // Export functionality
  const exportToCSV = useCallback(() => {
    const headers = [
      'Request Title',
      'Description',
      'Guest Name',
      'Room Number',
      'Priority',
      'Status',
      'Assigned To',
      'Items',
      'Created Date',
      'Completed Date'
    ];

    const csvData = requests.map(request => [
      request.title || '',
      request.description || '',
      request.userId?.name || '',
      request.bookingId?.rooms?.[0]?.roomId?.roomNumber || '',
      request.priority || '',
      request.status || '',
      request.assignedTo?.name || 'Unassigned',
      getItemsSummary(request.items),
      safeFormatDate(request.createdAt, 'yyyy-MM-dd HH:mm'),
      request.completedTime ? safeFormatDate(request.completedTime, 'yyyy-MM-dd HH:mm') : ''
    ]);

    const csvContent = [headers, ...csvData]
      .map(row => row.map(field => `"${field.toString().replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `inventory-requests-${format(new Date(), 'yyyy-MM-dd')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Inventory requests exported to CSV successfully');
  }, [requests]);

  // Bulk operations
  const handleSelectAll = useCallback(() => {
    if (selectedRequests.size === requests.length) {
      setSelectedRequests(new Set());
    } else {
      setSelectedRequests(new Set(requests.map(r => r._id)));
    }
  }, [requests, selectedRequests.size]);

  const handleSelectRequest = useCallback((requestId: string) => {
    const newSelected = new Set(selectedRequests);
    if (newSelected.has(requestId)) {
      newSelected.delete(requestId);
    } else {
      newSelected.add(requestId);
    }
    setSelectedRequests(newSelected);
  }, [selectedRequests]);

  const handleBulkOperation = async () => {
    if (selectedRequests.size === 0) {
      toast.error('Please select at least one request');
      return;
    }

    try {
      setUpdating(true);
      const requestIds = Array.from(selectedRequests);

      if (bulkActionData.operation === 'assign' && bulkActionData.assignedTo) {
        for (const requestId of requestIds) {
          await adminGuestServicesService.assignService(requestId, {
            assignedTo: bulkActionData.assignedTo,
            notes: bulkActionData.notes || ''
          });
        }
        toast.success(`${requestIds.length} requests assigned successfully`);
      } else if (bulkActionData.operation === 'updateStatus' && bulkActionData.status) {
        for (const requestId of requestIds) {
          await adminGuestServicesService.updateStatus(requestId, bulkActionData.status);
        }
        toast.success(`${requestIds.length} requests updated successfully`);
      }

      await fetchRequests();
      setSelectedRequests(new Set());
      setShowBulkActions(false);
      setBulkActionData({ operation: 'assign', requestIds: [] });
    } catch (error) {
      toast.error('Failed to perform bulk operation');
    } finally {
      setUpdating(false);
    }
  };

  // Fetch audit trail from real API
  const fetchAuditTrail = async (_requestId: string) => {
    try {
      setLoadingAudit(true);
      const { data } = await api.get('/audit-log', {
        params: {
          search: _requestId,
          limit: 50,
          sortBy: 'timestamp',
          sortOrder: 'desc'
        }
      });
      if (data.status === 'success' && data.data?.logs) {
        const mappedLogs: AuditLogEntry[] = data.data.logs.map((log: Record<string, unknown>) => ({
          _id: log._id as string,
          action: log.action as string || 'Unknown',
          userId: {
            name: (log.userId as Record<string, unknown>)?.name as string || 'Unknown',
            email: (log.userId as Record<string, unknown>)?.email as string || ''
          },
          changes: Array.isArray(log.changes) ? log.changes : [],
          timestamp: log.timestamp as string || log.createdAt as string
        }));
        setAuditLogs(mappedLogs);
      } else {
        setAuditLogs([]);
      }
    } catch {
      setAuditLogs([]);
    } finally {
      setLoadingAudit(false);
    }
  };

  useEffect(() => {
    if (selectedPropertyId) {
      fetchRequests();
      fetchAvailableStaff();
    }

    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, [filters, selectedPropertyId]);

  // Trigger search when searchTerm changes
  useEffect(() => {
    fetchRequests();
  }, [searchTerm]);

  useEffect(() => {
    computeStats(requests);
  }, [requests, computeStats]);

  // Real-time WebSocket listeners for guest service / inventory events
  useEffect(() => {
    const handleServiceEvent = () => {
      fetchRequests();
    };
    on('guest-services:created', handleServiceEvent);
    on('guest-services:updated', handleServiceEvent);
    on('guest-services:status_changed', handleServiceEvent);
    on('guest-services:assigned', handleServiceEvent);
    return () => {
      off('guest-services:created', handleServiceEvent);
      off('guest-services:updated', handleServiceEvent);
      off('guest-services:status_changed', handleServiceEvent);
      off('guest-services:assigned', handleServiceEvent);
    };
  }, [on, off]);

  // Handle status update
  const handleStatusUpdate = async (requestId: string, newStatus: 'assigned' | 'in_progress' | 'completed' | 'cancelled') => {
    try {
      setUpdating(true);
      await adminGuestServicesService.updateStatus(requestId, newStatus);
      
      await fetchRequests();
      toast.success('Inventory request status updated successfully');
    } catch (error) {
      toast.error('Failed to update inventory request status');
    } finally {
      setUpdating(false);
    }
  };

  // Handle assignment
  const handleAssignRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRequest) return;

    try {
      setUpdating(true);
      await adminGuestServicesService.assignService(selectedRequest._id, assignData);
      
      await fetchRequests();
      setShowAssignModal(false);
      setAssignData({ assignedTo: '', notes: '', scheduledTime: '' });
      toast.success('Inventory request assigned successfully');
    } catch (error) {
      toast.error('Failed to assign inventory request');
    } finally {
      setUpdating(false);
    }
  };

  const handleViewRequest = (request: InventoryRequest) => {
    setSelectedRequest(request);
    setShowViewModal(true);
  };

  const openAssignModal = (request: InventoryRequest) => {
    setSelectedRequest(request);
    setShowAssignModal(true);
  };

  const getItemsSummary = (items?: Array<{ name: string; quantity: number; price: number }>) => {
    if (!items || items.length === 0) return 'No specific items listed';
    
    const summary = items.map(item => `${item.quantity}x ${item.name}`).join(', ');
    return summary.length > 50 ? `${summary.substring(0, 50)}...` : summary;
  };

  // Early return if no property selected in single property mode
  if (!selectedPropertyId && viewMode === 'single') {
    return (
      <div className="p-6">
        <PropertyBreadcrumb items={['Inventory', 'Requests']} />
        <div className="text-center py-12">
          <p className="text-gray-600">Please select a property to view inventory requests</p>
        </div>
      </div>
    );
  }

  if (loading && !requests.length) {
    return (
      <div className="min-h-screen relative overflow-hidden">
        {/* Animated Background */}
        <div className="fixed inset-0 bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
          {/* Floating Background Elements */}
          <div className="floating-bg-element floating-element-1 w-64 h-64 bg-blue-200 rounded-full opacity-20"></div>
          <div className="floating-bg-element floating-element-2 w-48 h-48 bg-purple-200 rounded-full opacity-15"></div>
          <div className="floating-bg-element floating-element-3 w-56 h-56 bg-green-200 rounded-full opacity-10"></div>
        </div>

        <div className="relative z-10 flex items-center justify-center h-screen">
          <div className="glass-effect-strong rounded-2xl p-12 text-center animate-scale-grow shadow-2xl">
            <div className="p-6 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 animate-icon-float shadow-lg mx-auto w-fit mb-6">
              <Package2 className="h-12 w-12 text-white" />
            </div>
            <LoadingSpinner size="lg" className="mb-6 border-blue-600" />
            <h2 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-2">
              Loading Inventory Requests
            </h2>
            <p className="text-gray-600">Please wait while we fetch the latest data...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary level="page" onError={(error, errorInfo) => {
      toast.error('An error occurred in the inventory requests management page');
    }}>
      <div className="space-y-6">
        {/* Property Breadcrumb */}
        <PropertyBreadcrumb items={['Inventory', 'Requests']} />

        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Inventory Requests Management</h1>
            <p className="text-gray-600 mt-1 text-sm sm:text-base">Monitor and manage guest inventory requests for missing or damaged items</p>
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
            <Button
              onClick={exportToCSV}
              size="sm"
              variant="outline"
              className="flex items-center gap-2"
              disabled={requests.length === 0}
            >
              <Download className="w-4 h-4" />
              Export
            </Button>
              <Button
                onClick={fetchRequests}
                size="sm"
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white"
                disabled={loading}
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
          </div>
        </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">
          <Card className="bg-gradient-to-br from-white to-blue-50 border-0 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
            <CardContent className="p-3 sm:p-4 lg:p-6">
              <div className="flex items-center">
                <div className="p-2 sm:p-3 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-md">
                  <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 lg:h-6 lg:w-6 text-white" />
                </div>
                <div className="ml-2 sm:ml-3 lg:ml-4">
                  <p className="text-xs sm:text-sm font-semibold text-gray-600">Total Requests</p>
                  <p className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900">{stats.total}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-white to-yellow-50 border-0 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
            <CardContent className="p-3 sm:p-4 lg:p-6">
              <div className="flex items-center">
                <div className="p-2 sm:p-3 bg-gradient-to-br from-yellow-500 to-orange-500 rounded-xl shadow-md">
                  <Clock className="h-4 w-4 sm:h-5 sm:w-5 lg:h-6 lg:w-6 text-white" />
                </div>
                <div className="ml-2 sm:ml-3 lg:ml-4">
                  <p className="text-xs sm:text-sm font-semibold text-gray-600">Pending</p>
                  <p className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900">{stats.pending}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-white to-purple-50 border-0 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
            <CardContent className="p-3 sm:p-4 lg:p-6">
              <div className="flex items-center">
                <div className="p-2 sm:p-3 bg-gradient-to-br from-purple-500 to-indigo-500 rounded-xl shadow-md">
                  <UserCheck className="h-4 w-4 sm:h-5 sm:w-5 lg:h-6 lg:w-6 text-white" />
                </div>
                <div className="ml-2 sm:ml-3 lg:ml-4">
                  <p className="text-xs sm:text-sm font-semibold text-gray-600">Assigned</p>
                  <p className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900">{stats.assigned}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-white to-orange-50 border-0 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
            <CardContent className="p-3 sm:p-4 lg:p-6">
              <div className="flex items-center">
                <div className="p-2 sm:p-3 bg-gradient-to-br from-orange-500 to-red-500 rounded-xl shadow-md">
                  <Activity className="h-4 w-4 sm:h-5 sm:w-5 lg:h-6 lg:w-6 text-white" />
                </div>
                <div className="ml-2 sm:ml-3 lg:ml-4">
                  <p className="text-xs sm:text-sm font-semibold text-gray-600">In Progress</p>
                  <p className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900">{stats.inProgress}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-white to-green-50 border-0 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
            <CardContent className="p-3 sm:p-4 lg:p-6">
              <div className="flex items-center">
                <div className="p-2 sm:p-3 bg-gradient-to-br from-green-500 to-emerald-500 rounded-xl shadow-md">
                  <CheckCheck className="h-4 w-4 sm:h-5 sm:w-5 lg:h-6 lg:w-6 text-white" />
                </div>
                <div className="ml-2 sm:ml-3 lg:ml-4">
                  <p className="text-xs sm:text-sm font-semibold text-gray-600">Completed</p>
                  <p className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900">{stats.completed}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-white to-red-50 border-0 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 border-l-4 border-red-500">
            <CardContent className="p-3 sm:p-4 lg:p-6">
              <div className="flex items-center">
                <div className="p-2 sm:p-3 bg-gradient-to-br from-red-500 to-red-600 rounded-xl shadow-md">
                  <AlertTriangle className="h-4 w-4 sm:h-5 sm:w-5 lg:h-6 lg:w-6 text-white" />
                </div>
                <div className="ml-2 sm:ml-3 lg:ml-4">
                  <p className="text-xs sm:text-sm font-semibold text-gray-600">Urgent</p>
                  <p className="text-lg sm:text-xl lg:text-2xl font-bold text-red-600">{stats.urgent}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-white to-gray-50 border-0 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
            <CardContent className="p-3 sm:p-4 lg:p-6">
              <div className="flex items-center">
                <div className="p-2 sm:p-3 bg-gradient-to-br from-gray-500 to-gray-600 rounded-xl shadow-md">
                  <XCircle className="h-4 w-4 sm:h-5 sm:w-5 lg:h-6 lg:w-6 text-white" />
                </div>
                <div className="ml-2 sm:ml-3 lg:ml-4">
                  <p className="text-xs sm:text-sm font-semibold text-gray-600">Cancelled</p>
                  <p className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900">{stats.cancelled}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

        {/* Enhanced Filters */}
        <div className="glass-effect-strong rounded-2xl p-6 mb-8 animate-slide-in-up shadow-xl">
          <div className="flex items-center mb-6">
            <div className="p-3 rounded-xl bg-gradient-to-r from-purple-500 to-blue-600 animate-icon-float shadow-lg">
              <Filter className="h-6 w-6 text-white" />
            </div>
            <h2 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent ml-4">
              Smart Filters
            </h2>
          </div>

          {/* Advanced Search */}
          <div className="mb-6 animate-slide-in-up animate-stagger-1">
            <label className="block text-sm font-bold text-gray-700 mb-3">Advanced Search</label>
            <div className="relative">
              <input
                type="text"
                placeholder="Search by guest name, room number, item names, or description..."
                className="w-full glass-effect border-2 border-blue-200 rounded-xl px-4 py-3 pl-12 text-gray-700 font-medium focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all duration-300"
                onChange={(e) => debouncedSearch(e.target.value)}
              />
              <div className="absolute left-4 top-3 pointer-events-none">
                <Search className="h-5 w-5 text-blue-500" />
              </div>
              {searchTerm && (
                <div className="absolute right-4 top-3">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setSearchTerm('');
                      const input = document.querySelector('input[placeholder*="Search by guest"]') as HTMLInputElement;
                      if (input) input.value = '';
                    }}
                    className="p-1 h-auto"
                  >
                    <XCircle className="h-4 w-4 text-gray-400 hover:text-gray-600" />
                  </Button>
                </div>
              )}
            </div>
            {searchTerm && (
              <div className="mt-2 text-sm text-blue-600 font-medium">
                Searching for: "{searchTerm}" - {requests.length} results found
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="animate-slide-in-left animate-stagger-1">
              <label className="block text-sm font-bold text-gray-700 mb-2">Status</label>
              <div className="relative">
                <select
                  className="w-full glass-effect border-2 border-purple-200 rounded-xl px-4 py-3 text-gray-700 font-medium focus:border-purple-500 focus:ring-2 focus:ring-purple-200 transition-all duration-300"
                  value={filters.status || ''}
                  onChange={(e) => setFilters({ ...filters, status: e.target.value || undefined, page: 1 })}
                >
                  <option value="">All Statuses</option>
                  <option value="pending">Pending</option>
                  <option value="assigned">Assigned</option>
                  <option value="in_progress">In Progress</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
            </div>

            <div className="animate-slide-in-left animate-stagger-2">
              <label className="block text-sm font-bold text-gray-700 mb-2">Priority</label>
              <div className="relative">
                <select
                  className="w-full glass-effect border-2 border-blue-200 rounded-xl px-4 py-3 text-gray-700 font-medium focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all duration-300"
                  value={filters.priority || ''}
                  onChange={(e) => setFilters({ ...filters, priority: e.target.value || undefined, page: 1 })}
                >
                  <option value="">All Priorities</option>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
            </div>

            <div className="animate-slide-in-left animate-stagger-3">
              <label className="block text-sm font-bold text-gray-700 mb-2">Assigned To</label>
              <div className="relative">
                <select
                  className="w-full glass-effect border-2 border-green-200 rounded-xl px-4 py-3 text-gray-700 font-medium focus:border-green-500 focus:ring-2 focus:ring-green-200 transition-all duration-300"
                  value={filters.assignedTo || ''}
                  onChange={(e) => setFilters({ ...filters, assignedTo: e.target.value || undefined, page: 1 })}
                >
                  <option value="">All Staff</option>
                  {availableStaff.map((staff) => (
                    <option key={staff._id} value={staff._id}>
                      {staff.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-end animate-slide-in-left animate-stagger-4">
              <Button
                onClick={() => setFilters({ serviceType: 'other', serviceVariation: 'inventory_request', page: 1, limit: 20 })}
                className="w-full bg-gradient-to-r from-gray-500 to-gray-700 hover:from-gray-600 hover:to-gray-800 text-white font-bold py-3 px-6 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Reset Filters
              </Button>
            </div>
          </div>
        </div>

        {/* Enhanced Requests Display */}
        <div className="glass-effect-strong rounded-2xl p-6 shadow-2xl animate-slide-in-up">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center">
              <div className="p-3 rounded-xl bg-gradient-to-r from-blue-500 to-purple-600 animate-icon-bounce shadow-lg">
                <Package className="h-6 w-6 text-white" />
              </div>
              <h2 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent ml-4">
                Inventory Requests ({pagination.total})
              </h2>
            </div>

            {/* Bulk Actions Header */}
            <div className="flex items-center space-x-4">
              {requests.length > 0 && (
                <div className="flex items-center space-x-2">
                  <div className="glass-effect rounded-lg p-2">
                    <label className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedRequests.size === requests.length && requests.length > 0}
                        onChange={handleSelectAll}
                        className="rounded border-2 border-blue-300 text-blue-600 focus:ring-blue-500 focus:ring-2"
                      />
                      <span className="text-sm font-medium text-gray-700">Select All</span>
                    </label>
                  </div>
                  {selectedRequests.size > 0 && (
                    <div className="flex items-center space-x-2">
                      <div className="glass-effect rounded-lg px-3 py-2 bg-blue-50">
                        <span className="text-sm font-bold text-blue-700">
                          {selectedRequests.size} selected
                        </span>
                      </div>
                      <Button
                        onClick={() => setShowBulkActions(true)}
                        className="bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white font-medium px-4 py-2 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105"
                        size="sm"
                      >
                        <CheckCircle2 className="w-4 h-4 mr-2" />
                        Bulk Actions
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <ErrorBoundary level="component" fallback={
            <div className="glass-effect rounded-xl p-8 text-center text-gray-500 animate-pulse">
              <AlertCircle className="h-12 w-12 mx-auto mb-4 text-gray-400" />
              Failed to load inventory requests table
            </div>
          }>
            {/* Custom Card-based Display */}
            <div className="space-y-4">
              {requests.map((request, index) => (
                <div
                  key={request._id}
                  className={`glass-effect rounded-xl p-6 interactive-card animate-slide-in-left shadow-lg border-l-4 ${
                    selectedRequests.has(request._id) ? 'ring-2 ring-blue-500 border-blue-500' :
                    request.priority === 'urgent' ? 'priority-urgent border-red-500' :
                    request.priority === 'high' ? 'priority-high border-orange-500' :
                    request.priority === 'medium' ? 'priority-medium border-yellow-500' :
                    'priority-low border-gray-500'
                  }`}
                  style={{animationDelay: `${index * 0.1}s`}}
                >
                  <div className="flex items-center justify-between">
                    {/* Checkbox */}
                    <div className="mr-4">
                      <input
                        type="checkbox"
                        checked={selectedRequests.has(request._id)}
                        onChange={() => handleSelectRequest(request._id)}
                        className="rounded border-2 border-blue-300 text-blue-600 focus:ring-blue-500 focus:ring-2 w-5 h-5"
                      />
                    </div>

                    <div className="flex items-center space-x-4 flex-1">
                      {/* Request Info */}
                      <div className="p-3 rounded-xl bg-gradient-to-br from-blue-100 to-purple-100 animate-icon-float">
                        <Package className="h-6 w-6 text-blue-600" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-start justify-between">
                          <div>
                            <h3 className="font-bold text-gray-900 text-lg">{request.title}</h3>
                            <p className="text-gray-600 mt-1">{request.description}</p>
                            <div className="text-sm text-gray-500 mt-2">
                              {getItemsSummary(request.items)}
                            </div>
                          </div>

                          {/* Priority Badge */}
                          <div className="ml-4">
                            <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold animate-pulse ${
                              request.priority === 'urgent' ? 'bg-red-100 text-red-800 animate-pulse-glow-red' :
                              request.priority === 'high' ? 'bg-orange-100 text-orange-800 animate-pulse-glow-orange' :
                              request.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {request.priority === 'urgent' && <Zap className="h-3 w-3 mr-1" />}
                              {request.priority}
                            </span>
                          </div>
                        </div>

                        {/* Guest and Room Info */}
                        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div className="glass-effect rounded-lg p-3">
                            <div className="flex items-center space-x-2">
                              <User className="h-4 w-4 text-blue-500" />
                              <div>
                                <div className="font-medium text-sm">{request.userId?.name || 'Unknown Guest'}</div>
                                <div className="text-xs text-gray-500">Room {request.bookingId?.rooms?.[0]?.roomId?.roomNumber || 'N/A'}</div>
                              </div>
                            </div>
                          </div>

                          <div className="glass-effect rounded-lg p-3">
                            <div className="flex items-center space-x-2">
                              {request.assignedTo ? (
                                <>
                                  <UserCheck className="h-4 w-4 text-green-500" />
                                  <div>
                                    <div className="font-medium text-sm">{request.assignedTo.name}</div>
                                    <div className="text-xs text-gray-500">{request.assignedTo.email}</div>
                                  </div>
                                </>
                              ) : (
                                <>
                                  <AlertCircle className="h-4 w-4 text-yellow-500" />
                                  <span className="text-sm text-gray-500">Unassigned</span>
                                </>
                              )}
                            </div>
                          </div>

                          <div className="glass-effect rounded-lg p-3">
                            <div className="flex items-center space-x-2">
                              <Clock className="h-4 w-4 text-purple-500" />
                              <div className="text-sm text-gray-600">
                                {safeFormatDate(request.createdAt, 'MMM dd, HH:mm')}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Status and Actions */}
                    <div className="flex items-center space-x-4 ml-6">
                      {/* Status Badge */}
                      <div className={`px-4 py-2 rounded-xl font-bold text-sm ${
                        request.status === 'pending' ? 'bg-yellow-100 text-yellow-800 animate-status-pending' :
                        request.status === 'assigned' ? 'bg-blue-100 text-blue-800' :
                        request.status === 'in_progress' ? 'bg-orange-100 text-orange-800 animate-status-in-progress' :
                        request.status === 'completed' ? 'bg-green-100 text-green-800 animate-status-completed' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {(request.status || 'unknown').replace('_', ' ').toUpperCase()}
                      </div>

                      {/* Action Buttons */}
                      <div className="flex items-center space-x-2">
                        <Button
                          size="sm"
                          onClick={() => handleViewRequest(request)}
                          className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>

                        <Button
                          size="sm"
                          onClick={() => {
                            setSelectedRequest(request);
                            fetchAuditTrail(request._id);
                            setShowAuditModal(true);
                          }}
                          className="bg-gradient-to-r from-gray-500 to-gray-700 hover:from-gray-600 hover:to-gray-800 text-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105"
                        >
                          <History className="h-4 w-4" />
                        </Button>

                        {request.status === 'pending' && (
                          <Button
                            size="sm"
                            onClick={() => openAssignModal(request)}
                            disabled={updating}
                            className="bg-gradient-to-r from-green-500 to-blue-600 hover:from-green-600 hover:to-blue-700 text-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105"
                          >
                            <UserCheck className="h-4 w-4" />
                          </Button>
                        )}

                        {request.status === 'assigned' && (
                          <Button
                            size="sm"
                            onClick={() => handleStatusUpdate(request._id, 'in_progress')}
                            disabled={updating}
                            className="bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105"
                          >
                            <Play className="h-4 w-4" />
                          </Button>
                        )}

                        {(request.status === 'in_progress' || request.status === 'assigned') && (
                          <Button
                            size="sm"
                            onClick={() => handleStatusUpdate(request._id, 'completed')}
                            disabled={updating}
                            className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 animate-pulse-glow-green"
                          >
                            <CheckSquare className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              {loading && requests.length > 0 && (
                <div className="glass-effect rounded-xl p-8 text-center animate-pulse mb-4">
                  <div className="flex items-center justify-center space-x-3">
                    <LoadingSpinner size="md" className="border-blue-600" />
                    <span className="text-lg font-medium text-gray-700">Updating inventory requests...</span>
                  </div>
                </div>
              )}

              {requests.length === 0 && !loading && (
                <div className="glass-effect rounded-xl p-12 text-center animate-scale-grow">
                  <Package className="h-16 w-16 mx-auto mb-4 text-gray-400 animate-icon-float" />
                  <h3 className="text-xl font-semibold text-gray-600 mb-2">No Inventory Requests Found</h3>
                  <p className="text-gray-500">There are no inventory requests matching your current filters.</p>
                </div>
              )}
            </div>
          </ErrorBoundary>
        
          {/* Enhanced Pagination */}
          {pagination.pages > 1 && (
            <div className="glass-effect-strong rounded-2xl p-6 mt-6 animate-slide-in-up shadow-xl">
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium text-gray-700 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  Showing {((filters.page || 1) - 1) * (filters.limit || 20) + 1} to{' '}
                  {Math.min((filters.page || 1) * (filters.limit || 20), pagination.total)} of{' '}
                  {pagination.total} results
                </div>
                <div className="flex items-center space-x-4">
                  <Button
                    disabled={(filters.page || 1) <= 1}
                    onClick={() => setFilters({ ...filters, page: (filters.page || 1) - 1 })}
                    className="bg-gradient-to-r from-gray-500 to-gray-700 hover:from-gray-600 hover:to-gray-800 text-white font-medium px-6 py-2 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                    size="sm"
                  >
                    Previous
                  </Button>
                  <div className="glass-effect rounded-lg px-4 py-2">
                    <span className="text-sm font-bold text-gray-700">
                      Page {filters.page || 1} of {pagination.pages}
                    </span>
                  </div>
                  <Button
                    disabled={(filters.page || 1) >= pagination.pages}
                    onClick={() => setFilters({ ...filters, page: (filters.page || 1) + 1 })}
                    className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-medium px-6 py-2 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                    size="sm"
                  >
                    Next
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Enhanced View Request Modal */}
        {selectedRequest && (
          <Modal
            isOpen={showViewModal}
            onClose={() => setShowViewModal(false)}
            title=""
          >
            <div className="glass-effect-strong rounded-2xl p-0 max-w-4xl max-h-[90vh] overflow-auto">
              {/* Modal Header */}
              <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-t-2xl p-6 text-white">
                <div className="flex items-center">
                  <div className="p-3 rounded-xl bg-white/20 animate-icon-float">
                    <Package className="h-8 w-8 text-white" />
                  </div>
                  <div className="ml-4">
                    <h2 className="text-2xl font-bold">Inventory Request Details</h2>
                    <p className="text-blue-100 mt-1">Complete request information and management</p>
                  </div>
                </div>
              </div>

              <div className="p-6">
                <div className="space-y-6">
                  {/* Request Header */}
                  <div className="glass-effect rounded-xl p-6 animate-slide-in-up">
                    <div className="flex items-start space-x-4">
                      <div className="p-3 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 animate-icon-float shadow-lg">
                        <Package className="h-6 w-6 text-white" />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                          {selectedRequest.title}
                        </h3>
                        <p className="text-gray-600 mt-2 text-lg">{selectedRequest.description}</p>
                      </div>
                    </div>
                  </div>

                  {/* Priority and Status */}
                  <div className="grid grid-cols-2 gap-6">
                    <div className="glass-effect rounded-xl p-4 animate-slide-in-left">
                      <label className="block text-sm font-bold text-gray-700 mb-2">Priority Level</label>
                      <div className="flex items-center space-x-2">
                        {selectedRequest.priority === 'urgent' && <Zap className="h-5 w-5 text-red-500 animate-pulse" />}
                        <span className={`inline-flex items-center px-4 py-2 rounded-xl text-sm font-bold animate-pulse ${
                          selectedRequest.priority === 'urgent' ? 'bg-red-100 text-red-800 animate-pulse-glow-red' :
                          selectedRequest.priority === 'high' ? 'bg-orange-100 text-orange-800 animate-pulse-glow-orange' :
                          selectedRequest.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {(selectedRequest.priority || 'unknown').toUpperCase()}
                        </span>
                      </div>
                    </div>
                    <div className="glass-effect rounded-xl p-4 animate-slide-in-right">
                      <label className="block text-sm font-bold text-gray-700 mb-2">Current Status</label>
                      <div className={`inline-flex items-center px-4 py-2 rounded-xl text-sm font-bold ${
                        selectedRequest.status === 'pending' ? 'bg-yellow-100 text-yellow-800 animate-status-pending' :
                        selectedRequest.status === 'assigned' ? 'bg-blue-100 text-blue-800' :
                        selectedRequest.status === 'in_progress' ? 'bg-orange-100 text-orange-800 animate-status-in-progress' :
                        selectedRequest.status === 'completed' ? 'bg-green-100 text-green-800 animate-status-completed' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {(selectedRequest.status || 'unknown').replace('_', ' ').toUpperCase()}
                      </div>
                    </div>
                  </div>

                  {/* Guest and Room Information */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="glass-effect rounded-xl p-6 animate-slide-in-left animate-stagger-1">
                      <div className="flex items-center mb-4">
                        <div className="p-2 rounded-lg bg-gradient-to-br from-green-400 to-blue-500 text-white">
                          <User className="h-5 w-5" />
                        </div>
                        <label className="block text-sm font-bold text-gray-700 ml-3">Guest Information</label>
                      </div>
                      <div className="space-y-2">
                        <div className="font-bold text-lg text-gray-900">{selectedRequest.userId?.name || 'Unknown Guest'}</div>
                        <div className="text-sm text-gray-600">{selectedRequest.userId?.email || 'N/A'}</div>
                        {selectedRequest.userId?.phone && (
                          <div className="text-sm text-gray-600">{selectedRequest.userId.phone}</div>
                        )}
                      </div>
                    </div>

                    <div className="glass-effect rounded-xl p-6 animate-slide-in-right animate-stagger-2">
                      <div className="flex items-center mb-4">
                        <div className="p-2 rounded-lg bg-gradient-to-br from-purple-400 to-pink-500 text-white">
                          <Package2 className="h-5 w-5" />
                        </div>
                        <label className="block text-sm font-bold text-gray-700 ml-3">Room & Booking</label>
                      </div>
                      <div className="space-y-2">
                        <div className="font-bold text-lg text-gray-900">
                          Room {selectedRequest.bookingId?.rooms?.[0]?.roomId?.roomNumber || 'N/A'}
                        </div>
                        <div className="text-sm text-gray-600">
                          Booking: {selectedRequest.bookingId?.bookingNumber || 'N/A'}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Assignment Information */}
                  {selectedRequest.assignedTo && (
                    <div className="glass-effect rounded-xl p-6 animate-slide-in-up">
                      <div className="flex items-center mb-4">
                        <div className="p-2 rounded-lg bg-gradient-to-br from-emerald-400 to-cyan-500 text-white animate-icon-float">
                          <UserCheck className="h-5 w-5" />
                        </div>
                        <label className="block text-sm font-bold text-gray-700 ml-3">Staff Assignment</label>
                      </div>
                      <div className="space-y-2">
                        <div className="font-bold text-lg text-gray-900">{selectedRequest.assignedTo.name}</div>
                        <div className="text-sm text-gray-600">{selectedRequest.assignedTo.email}</div>
                      </div>
                    </div>
                  )}

                  {/* Requested Items */}
                  {selectedRequest.items && selectedRequest.items.length > 0 && (
                    <div className="glass-effect rounded-xl p-6 animate-slide-in-up">
                      <div className="flex items-center mb-4">
                        <div className="p-2 rounded-lg bg-gradient-to-br from-orange-400 to-red-500 text-white animate-icon-bounce">
                          <Package className="h-5 w-5" />
                        </div>
                        <label className="block text-sm font-bold text-gray-700 ml-3">Requested Items</label>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {selectedRequest.items.map((item, index) => (
                          <div key={`selectedRequest-items-${index}-${item.name}`} className="glass-effect rounded-lg p-4 flex justify-between items-center animate-scale-grow" style={{animationDelay: `${index * 0.1}s`}}>
                            <span className="font-bold text-gray-900">{item.name}</span>
                            <div className="bg-gradient-to-r from-blue-500 to-purple-600 text-white px-3 py-1 rounded-full text-sm font-bold">
                              Qty: {item.quantity}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Special Instructions */}
                  {selectedRequest.specialInstructions && (
                    <div className="glass-effect rounded-xl p-6 animate-slide-in-up">
                      <div className="flex items-center mb-4">
                        <div className="p-2 rounded-lg bg-gradient-to-br from-yellow-400 to-orange-500 text-white animate-icon-float">
                          <MessageSquare className="h-5 w-5" />
                        </div>
                        <label className="block text-sm font-bold text-gray-700 ml-3">Special Instructions</label>
                      </div>
                      <div className="bg-gradient-to-br from-blue-50 to-purple-50 p-4 rounded-xl border-l-4 border-blue-500">
                        <p className="text-gray-900 font-medium">{selectedRequest.specialInstructions}</p>
                      </div>
                    </div>
                  )}

                  {/* Timestamps */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="glass-effect rounded-xl p-6 animate-slide-in-left">
                      <div className="flex items-center mb-3">
                        <div className="p-2 rounded-lg bg-gradient-to-br from-indigo-400 to-purple-500 text-white">
                          <Clock className="h-5 w-5" />
                        </div>
                        <label className="block text-sm font-bold text-gray-700 ml-3">Created</label>
                      </div>
                      <div className="text-lg font-bold text-gray-900">
                        {safeFormatDate(selectedRequest.createdAt, 'MMM dd, yyyy HH:mm')}
                      </div>
                    </div>

                    {selectedRequest.completedTime && (
                      <div className="glass-effect rounded-xl p-6 animate-slide-in-right">
                        <div className="flex items-center mb-3">
                          <div className="p-2 rounded-lg bg-gradient-to-br from-green-400 to-emerald-500 text-white animate-icon-bounce">
                            <CheckCircle className="h-5 w-5" />
                          </div>
                          <label className="block text-sm font-bold text-gray-700 ml-3">Completed</label>
                        </div>
                        <div className="text-lg font-bold text-gray-900">
                          {safeFormatDate(selectedRequest.completedTime, 'MMM dd, yyyy HH:mm')}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Staff Notes */}
                  {selectedRequest.notes && (
                    <div className="glass-effect rounded-xl p-6 animate-slide-in-up">
                      <div className="flex items-center mb-4">
                        <div className="p-2 rounded-lg bg-gradient-to-br from-gray-400 to-gray-600 text-white animate-icon-float">
                          <MessageSquare className="h-5 w-5" />
                        </div>
                        <label className="block text-sm font-bold text-gray-700 ml-3">Staff Notes</label>
                      </div>
                      <div className="bg-gradient-to-br from-gray-50 to-gray-100 p-4 rounded-xl border-l-4 border-gray-500">
                        <p className="text-gray-900 font-medium">{selectedRequest.notes}</p>
                      </div>
                    </div>
                  )}
                </div>

              </div>

              {/* Modal Footer */}
              <div className="glass-effect-strong border-t border-gray-200 p-6 rounded-b-2xl">
                <div className="flex items-center justify-end space-x-4">
                  <Button
                    onClick={() => setShowViewModal(false)}
                    className="bg-gradient-to-r from-gray-500 to-gray-700 hover:from-gray-600 hover:to-gray-800 text-white font-bold px-6 py-3 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105"
                  >
                    Close
                  </Button>

                  {selectedRequest.status !== 'completed' && selectedRequest.status !== 'cancelled' && (
                    <>
                      {selectedRequest.status === 'pending' && (
                        <Button
                          onClick={() => {
                            setShowViewModal(false);
                            openAssignModal(selectedRequest);
                          }}
                          className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-bold px-6 py-3 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 animate-pulse-glow-green"
                        >
                          <UserCheck className="h-5 w-5 mr-2" />
                          Assign Staff
                        </Button>
                      )}

                      {selectedRequest.status !== 'pending' && (
                        <Button
                          onClick={() => {
                            const nextStatus: 'in_progress' | 'completed' = selectedRequest.status === 'assigned' ? 'in_progress' : 'completed';
                            handleStatusUpdate(selectedRequest._id, nextStatus);
                            setShowViewModal(false);
                          }}
                          disabled={updating}
                          className={`font-bold px-6 py-3 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 ${
                            selectedRequest.status === 'assigned'
                              ? 'bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white'
                              : 'bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white animate-pulse-glow-green'
                          }`}
                        >
                          {selectedRequest.status === 'assigned' && (
                            <>
                              <Play className="h-5 w-5 mr-2" />
                              Start Processing
                            </>
                          )}
                          {selectedRequest.status === 'in_progress' && (
                            <>
                              <CheckSquare className="h-5 w-5 mr-2" />
                              Mark Complete
                            </>
                          )}
                        </Button>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          </Modal>
        )}

        {/* Enhanced Assign Request Modal */}
        {showAssignModal && (
          <Modal
            isOpen={showAssignModal}
            onClose={() => setShowAssignModal(false)}
            title=""
          >
          <div className="glass-effect-strong rounded-2xl p-0 max-w-2xl">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-green-600 to-emerald-600 rounded-t-2xl p-6 text-white">
              <div className="flex items-center">
                <div className="p-3 rounded-xl bg-white/20 animate-icon-float">
                  <UserCheck className="h-8 w-8 text-white" />
                </div>
                <div className="ml-4">
                  <h2 className="text-2xl font-bold">Assign Inventory Request</h2>
                  <p className="text-green-100 mt-1">Assign staff member to handle this request</p>
                </div>
              </div>
            </div>
            <form onSubmit={handleAssignRequest} className="p-6 space-y-6">
              {/* Staff Selection */}
              <div className="animate-slide-in-up animate-stagger-1">
                <label className="block text-sm font-bold text-gray-700 mb-3">Assign To Staff Member</label>
                <div className="relative">
                  <select
                    className="w-full glass-effect border-2 border-green-200 rounded-xl px-4 py-3 text-gray-700 font-medium focus:border-green-500 focus:ring-2 focus:ring-green-200 transition-all duration-300"
                    value={assignData.assignedTo}
                    onChange={(e) => setAssignData({ ...assignData, assignedTo: e.target.value })}
                    required
                  >
                    <option value="">Select Staff Member</option>
                    {availableStaff.map((staff) => (
                      <option key={staff._id} value={staff._id}>
                        {staff.name} - {staff.department}
                      </option>
                    ))}
                  </select>
                  <div className="absolute right-3 top-3 pointer-events-none">
                    <Users className="h-5 w-5 text-green-500" />
                  </div>
                </div>
              </div>

              {/* Scheduled Time */}
              <div className="animate-slide-in-up animate-stagger-2">
                <label className="block text-sm font-bold text-gray-700 mb-3">Scheduled Time (Optional)</label>
                <div className="relative">
                  <input
                    type="datetime-local"
                    className="w-full glass-effect border-2 border-blue-200 rounded-xl px-4 py-3 text-gray-700 font-medium focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all duration-300"
                    value={assignData.scheduledTime}
                    onChange={(e) => setAssignData({ ...assignData, scheduledTime: e.target.value })}
                  />
                  <div className="absolute right-3 top-3 pointer-events-none">
                    <Clock className="h-5 w-5 text-blue-500" />
                  </div>
                </div>
              </div>

              {/* Assignment Notes */}
              <div className="animate-slide-in-up animate-stagger-3">
                <label className="block text-sm font-bold text-gray-700 mb-3">Assignment Notes</label>
                <div className="relative">
                  <textarea
                    className="w-full glass-effect border-2 border-purple-200 rounded-xl px-4 py-3 text-gray-700 font-medium focus:border-purple-500 focus:ring-2 focus:ring-purple-200 transition-all duration-300 resize-none h-32"
                    value={assignData.notes}
                    onChange={(e) => setAssignData({ ...assignData, notes: e.target.value })}
                    placeholder="Add any special instructions for handling this inventory request"
                  />
                  <div className="absolute right-3 top-3 pointer-events-none">
                    <MessageSquare className="h-5 w-5 text-purple-500" />
                  </div>
                </div>
              </div>

              {/* Form Actions */}
              <div className="flex items-center justify-end space-x-4 pt-6 border-t border-gray-200 animate-slide-in-up animate-stagger-4">
                <Button
                  type="button"
                  onClick={() => setShowAssignModal(false)}
                  className="bg-gradient-to-r from-gray-500 to-gray-700 hover:from-gray-600 hover:to-gray-800 text-white font-bold px-6 py-3 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={updating}
                  className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-bold px-6 py-3 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 animate-pulse-glow-green disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {updating ? (
                    <>
                      <RefreshCw className="h-5 w-5 mr-2 animate-spin" />
                      Assigning...
                    </>
                  ) : (
                    <>
                      <UserCheck className="h-5 w-5 mr-2" />
                      Assign Request
                    </>
                  )}
                </Button>
              </div>
            </form>
          </div>
          </Modal>
        )}

        {/* Bulk Actions Modal */}
        {showBulkActions && (
          <Modal
            isOpen={showBulkActions}
            onClose={() => setShowBulkActions(false)}
            title=""
          >
            <div className="glass-effect-strong rounded-2xl p-0 max-w-2xl">
              {/* Modal Header */}
              <div className="bg-gradient-to-r from-orange-600 to-red-600 rounded-t-2xl p-6 text-white">
                <div className="flex items-center">
                  <div className="p-3 rounded-xl bg-white/20 animate-icon-float">
                    <CheckCircle2 className="h-8 w-8 text-white" />
                  </div>
                  <div className="ml-4">
                    <h2 className="text-2xl font-bold">Bulk Actions</h2>
                    <p className="text-orange-100 mt-1">Perform actions on {selectedRequests.size} selected requests</p>
                  </div>
                </div>
              </div>

              <div className="p-6 space-y-6">
                {/* Operation Type */}
                <div className="animate-slide-in-up animate-stagger-1">
                  <label className="block text-sm font-bold text-gray-700 mb-3">Select Operation</label>
                  <div className="space-y-3">
                    <label className="flex items-center space-x-3 cursor-pointer">
                      <input
                        type="radio"
                        name="operation"
                        value="assign"
                        checked={bulkActionData.operation === 'assign'}
                        onChange={(e) => setBulkActionData({ ...bulkActionData, operation: e.target.value as 'assign' })}
                        className="text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-gray-700 font-medium">Assign to Staff Member</span>
                    </label>
                    <label className="flex items-center space-x-3 cursor-pointer">
                      <input
                        type="radio"
                        name="operation"
                        value="updateStatus"
                        checked={bulkActionData.operation === 'updateStatus'}
                        onChange={(e) => setBulkActionData({ ...bulkActionData, operation: e.target.value as 'updateStatus' })}
                        className="text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-gray-700 font-medium">Update Status</span>
                    </label>
                  </div>
                </div>

                {/* Staff Selection (if assign operation) */}
                {bulkActionData.operation === 'assign' && (
                  <div className="animate-slide-in-up animate-stagger-2">
                    <label className="block text-sm font-bold text-gray-700 mb-3">Assign to Staff Member</label>
                    <select
                      className="w-full glass-effect border-2 border-green-200 rounded-xl px-4 py-3 text-gray-700 font-medium focus:border-green-500 focus:ring-2 focus:ring-green-200 transition-all duration-300"
                      value={bulkActionData.assignedTo || ''}
                      onChange={(e) => setBulkActionData({ ...bulkActionData, assignedTo: e.target.value })}
                      required
                    >
                      <option value="">Select Staff Member</option>
                      {availableStaff.map((staff) => (
                        <option key={staff._id} value={staff._id}>
                          {staff.name} - {staff.department}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Status Selection (if update status operation) */}
                {bulkActionData.operation === 'updateStatus' && (
                  <div className="animate-slide-in-up animate-stagger-2">
                    <label className="block text-sm font-bold text-gray-700 mb-3">New Status</label>
                    <select
                      className="w-full glass-effect border-2 border-blue-200 rounded-xl px-4 py-3 text-gray-700 font-medium focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all duration-300"
                      value={bulkActionData.status || ''}
                      onChange={(e) => setBulkActionData({ ...bulkActionData, status: e.target.value })}
                      required
                    >
                      <option value="">Select Status</option>
                      <option value="assigned">Assigned</option>
                      <option value="in_progress">In Progress</option>
                      <option value="completed">Completed</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </div>
                )}

                {/* Notes */}
                <div className="animate-slide-in-up animate-stagger-3">
                  <label className="block text-sm font-bold text-gray-700 mb-3">Notes (Optional)</label>
                  <textarea
                    className="w-full glass-effect border-2 border-purple-200 rounded-xl px-4 py-3 text-gray-700 font-medium focus:border-purple-500 focus:ring-2 focus:ring-purple-200 transition-all duration-300 resize-none h-24"
                    value={bulkActionData.notes || ''}
                    onChange={(e) => setBulkActionData({ ...bulkActionData, notes: e.target.value })}
                    placeholder="Add notes for this bulk operation"
                  />
                </div>

                {/* Form Actions */}
                <div className="flex items-center justify-end space-x-4 pt-6 border-t border-gray-200 animate-slide-in-up animate-stagger-4">
                  <Button
                    type="button"
                    onClick={() => {
                      setShowBulkActions(false);
                      setBulkActionData({ operation: 'assign', requestIds: [] });
                    }}
                    className="bg-gradient-to-r from-gray-500 to-gray-700 hover:from-gray-600 hover:to-gray-800 text-white font-bold px-6 py-3 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleBulkOperation}
                    disabled={updating || (
                      (bulkActionData.operation === 'assign' && !bulkActionData.assignedTo) ||
                      (bulkActionData.operation === 'updateStatus' && !bulkActionData.status)
                    )}
                    className="bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white font-bold px-6 py-3 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {updating ? (
                      <>
                        <RefreshCw className="h-5 w-5 mr-2 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="h-5 w-5 mr-2" />
                        Apply to {selectedRequests.size} Requests
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </Modal>
        )}

        {/* Audit Trail Modal */}
        {showAuditModal && selectedRequest && (
          <Modal
            isOpen={showAuditModal}
            onClose={() => setShowAuditModal(false)}
            title=""
          >
            <div className="glass-effect-strong rounded-2xl p-0 max-w-4xl max-h-[90vh] overflow-auto">
              {/* Modal Header */}
              <div className="bg-gradient-to-r from-gray-600 to-gray-800 rounded-t-2xl p-6 text-white">
                <div className="flex items-center">
                  <div className="p-3 rounded-xl bg-white/20 animate-icon-float">
                    <History className="h-8 w-8 text-white" />
                  </div>
                  <div className="ml-4">
                    <h2 className="text-2xl font-bold">Audit Trail</h2>
                    <p className="text-gray-100 mt-1">Change history for "{selectedRequest.title}"</p>
                  </div>
                </div>
              </div>

              <div className="p-6">
                {loadingAudit ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="glass-effect rounded-xl p-8 text-center">
                      <RefreshCw className="h-8 w-8 mx-auto mb-4 text-gray-400 animate-spin" />
                      <p className="text-gray-600">Loading audit trail...</p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {auditLogs.map((log, index) => (
                      <div key={log._id} className="glass-effect rounded-xl p-4 animate-slide-in-up" style={{animationDelay: `${index * 0.1}s`}}>
                        <div className="flex items-start space-x-4">
                          <div className="p-2 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 text-white flex-shrink-0">
                            <Activity className="h-4 w-4" />
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center justify-between mb-2">
                              <h4 className="font-bold text-gray-900">{log.action}</h4>
                              <span className="text-sm text-gray-500">
                                {safeFormatDate(log.timestamp, 'MMM dd, yyyy HH:mm')}
                              </span>
                            </div>
                            <div className="text-sm text-gray-600 mb-2">
                              By: <span className="font-medium">{log.userId.name}</span> ({log.userId.email})
                            </div>
                            {log.changes.length > 0 && (
                              <div className="space-y-1">
                                {log.changes.map((change, changeIndex) => (
                                  <div key={changeIndex} className="text-sm bg-gray-50 rounded-lg p-2">
                                    <span className="font-medium text-gray-700">{change.field}:</span>
                                    <span className="text-red-600 mx-2">{change.oldValue != null ? String(change.oldValue) : 'null'}</span>
                                    <span className="text-gray-400">→</span>
                                    <span className="text-green-600 mx-2">{change.newValue != null ? String(change.newValue) : 'null'}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}

                    {auditLogs.length === 0 && (
                      <div className="glass-effect rounded-xl p-12 text-center">
                        <History className="h-16 w-16 mx-auto mb-4 text-gray-400" />
                        <h3 className="text-xl font-semibold text-gray-600 mb-2">No Audit Trail Found</h3>
                        <p className="text-gray-500">No change history is available for this request.</p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="glass-effect-strong border-t border-gray-200 p-6 rounded-b-2xl">
                <div className="flex items-center justify-end">
                  <Button
                    onClick={() => setShowAuditModal(false)}
                    className="bg-gradient-to-r from-gray-500 to-gray-700 hover:from-gray-600 hover:to-gray-800 text-white font-bold px-6 py-3 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105"
                  >
                    Close
                  </Button>
                </div>
              </div>
            </div>
          </Modal>
        )}
    </ErrorBoundary>
  );
}