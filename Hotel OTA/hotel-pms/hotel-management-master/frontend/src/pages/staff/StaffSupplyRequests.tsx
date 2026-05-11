import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { format, parseISO } from 'date-fns';
import {
  Package,
  Plus,
  Clock,
  CheckCircle,
  AlertTriangle,
  Filter,
  Eye,
  Edit,
  IndianRupee,
  Calendar,
  RefreshCw,
  Trash2,
  FileText,
  User,
  MapPin,
  Wallet,
  TrendingUp,
  TrendingDown,
  BarChart3,
  PieChart,
  Lightbulb,
  Target
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/Modal';
import { DataTable } from '../../components/dashboard/DataTable';
import { StatusBadge } from '../../components/dashboard/StatusBadge';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import ErrorBoundary from '../../components/ui/ErrorBoundary';
import { formatCurrency } from '../../utils/formatters';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import {
  staffSupplyRequestsService,
  SupplyRequest,
  SupplyRequestItem,
  CreateSupplyRequestData,
  StaffSupplyRequestStats,
  DepartmentBudget,
  Vendor,
  RequestTemplate,
  RequestCategory
} from '../../services/staffSupplyRequestsService';
import BudgetDashboard from '../../components/staff/BudgetDashboard';
import { useRealTime } from '../../services/realTimeService';

// Interfaces imported from service

interface AnalyticsData {
  departmentBreakdown: Record<string, number>;
  statusBreakdown: Record<string, number>;
  priorityBreakdown: Record<string, number>;
  costAnalysis: {
    total: number;
    average: number;
    byMonth: Record<string, number>;
  };
  requestTrends: {
    thisMonth: number;
    lastMonth: number;
  };
  recentActivity: number;
}

interface CostOptimizationSuggestion {
  type: string;
  item: string;
  message: string;
  savings: number;
  action: string;
}

interface CostOptimizations {
  suggestions: CostOptimizationSuggestion[];
  totalPotentialSavings: number;
  optimizationScore: number;
}

export default function StaffSupplyRequests() {
  const { user } = useAuth();
  const { on, off, isConnected } = useRealTime();
  const [requests, setRequests] = useState<SupplyRequest[]>([]);
  // Keep a ref to current requests so polling callback always sees latest values
  const requestsRef = useRef<SupplyRequest[]>([]);
  const [stats, setStats] = useState<StaffSupplyRequestStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    page: 1,
    limit: 10,
    status: '',
    priority: '',
    search: '',
    startDate: '',
    endDate: '',
    overdue: false
  });
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [pagination, setPagination] = useState({ total: 0, pages: 0 });

  // Budget tracking state
  const [currentBudget, setCurrentBudget] = useState<DepartmentBudget | null>(null);
  const [showBudgetDashboard, setShowBudgetDashboard] = useState(false);

  // Vendor management state
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [preferredVendors, setPreferredVendors] = useState<Vendor[]>([]);
  const [showVendorDashboard, setShowVendorDashboard] = useState(false);

  // Analytics state
  const [showAnalyticsDashboard, setShowAnalyticsDashboard] = useState(false);
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);

  // Template and category state
  const [templates, setTemplates] = useState<RequestTemplate[]>([]);
  const [categories, setCategories] = useState<RequestCategory[]>([]);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<RequestTemplate | null>(null);

  // Cost optimization state
  const [costOptimizations, setCostOptimizations] = useState<CostOptimizations | null>(null);
  const [showOptimizations, setShowOptimizations] = useState(false);

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<SupplyRequest | null>(null);

  // Form state for new request
  const [newRequest, setNewRequest] = useState({
    title: '',
    description: '',
    department: user?.department || 'housekeeping',
    priority: 'medium' as const,
    neededBy: '',
    justification: '',
    items: [] as SupplyRequestItem[]
  });

  // Single item form for adding to request
  const [newItem, setNewItem] = useState({
    name: '',
    description: '',
    category: '',
    quantity: 1,
    unit: 'pcs',
    estimatedCost: 0,
    supplier: '',
    customSupplier: ''
  });

  // Optimized API calls with useCallback
  const fetchMyRequests = useCallback(async () => {
    try {
      setLoading(true);
      const response = await staffSupplyRequestsService.getMyRequests(filters);
      requestsRef.current = response.data.requests;
      setRequests(response.data.requests);
      setPagination(response.data.pagination);
    } catch (error) {
      toast.error('Failed to load supply requests');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  const fetchMyStats = useCallback(async () => {
    try {
      const response = await staffSupplyRequestsService.getMyStats();
      setStats(response.data);
    } catch (error) {
      // Don't show error toast for stats as it's not critical
    }
  }, []);

  // Notification system for status changes — uses the same filters/page as current view.
  // Uses requestsRef so the callback always reads the latest snapshot without
  // including `requests` in the dependency array (which would cause an infinite re-subscribe loop).
  const checkForStatusUpdates = useCallback(async () => {
    try {
      const response = await staffSupplyRequestsService.getMyRequests(filters);
      const newRequests = response.data.requests;

      // Compare with existing requests to detect status changes
      const currentRequests = requestsRef.current;
      if (currentRequests.length > 0) {
        newRequests.forEach(updatedRequest => {
          const existingRequest = currentRequests.find(r => r._id === updatedRequest._id);
          if (existingRequest && existingRequest.status !== updatedRequest.status) {
            const statusMessages: Record<string, string> = {
              approved: 'Your supply request has been approved!',
              rejected: 'Your supply request was rejected',
              ordered: 'Your request has been ordered',
              partial_received: 'Some items have been received',
              received: 'All items have been received',
              cancelled: 'Your supply request has been cancelled'
            };
            const message = statusMessages[updatedRequest.status];
            if (message) {
              const isPositive = ['approved', 'ordered', 'partial_received', 'received'].includes(updatedRequest.status);
              if (isPositive) {
                toast.success(`${message} — Request: ${updatedRequest.requestNumber}`);
              } else {
                toast.error(`${message} — Request: ${updatedRequest.requestNumber}`);
              }
            }
          }
        });
      }

      requestsRef.current = newRequests;
      setRequests(newRequests);
      setPagination(response.data.pagination);
    } catch {
      // Error handled silently
    }
  }, [filters]);

  const createRequest = async () => {
    try {
      // Validate form data
      const validation = staffSupplyRequestsService.validateRequestData(newRequest);
      if (!validation.isValid) {
        toast.error(validation.errors[0]);
        return;
      }

      // Check budget availability
      const requestTotal = totalEstimatedCost;
      const budgetCheck = await staffSupplyRequestsService.checkBudgetAvailability(requestTotal);

      if (budgetCheck.success && budgetCheck.data?.wouldExceed) {
        const proceed = window.confirm(
          `This request (${formatCurrency(requestTotal)}) would exceed your remaining budget (${formatCurrency(budgetCheck.data.available)}). Do you want to proceed anyway? It will require additional approval.`
        );
        if (!proceed) return;
      }

      const response = await staffSupplyRequestsService.createRequest(newRequest);
      await fetchMyRequests();
      await fetchMyStats();
      setShowCreateModal(false);
      resetNewRequestForm();

      if (budgetCheck.success && budgetCheck.data?.wouldExceed) {
        toast.success(`${response.message} (Flagged for budget review)`);
      } else {
        toast.success(response.message);
      }

    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Failed to create supply request');
    }
  };

  const resetNewRequestForm = () => {
    setNewRequest({
      title: '',
      description: '',
      department: user?.department || 'housekeeping',
      priority: 'medium',
      neededBy: '',
      justification: '',
      items: []
    });
    setNewItem({
      name: '',
      description: '',
      category: '',
      quantity: 1,
      unit: 'pcs',
      estimatedCost: 0,
      supplier: '',
      customSupplier: ''
    });
  };

  const addItemToRequest = () => {
    if (!newItem.name || !newItem.category || newItem.estimatedCost <= 0) {
      toast.error('Please fill in all item details');
      return;
    }

    // Handle vendor selection logic
    const finalSupplier = newItem.supplier === 'other' ? newItem.customSupplier : newItem.supplier;

    const itemToAdd = {
      ...newItem,
      supplier: finalSupplier
    };

    setNewRequest(prev => ({
      ...prev,
      items: [...prev.items, itemToAdd]
    }));

    setNewItem({
      name: '',
      description: '',
      category: '',
      quantity: 1,
      unit: 'pcs',
      estimatedCost: 0,
      supplier: '',
      customSupplier: ''
    });
  };

  const removeItemFromRequest = (index: number) => {
    setNewRequest(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index)
    }));
  };

  // Refetch requests and stats whenever filters change
  useEffect(() => {
    fetchMyRequests();
    fetchMyStats();
  }, [filters, fetchMyRequests, fetchMyStats]);

  // Fetch static data (vendors, templates) only on mount
  useEffect(() => {
    fetchVendors();
    fetchTemplates();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchVendors = async () => {
    try {
      const [allVendors, preferred] = await Promise.all([
        staffSupplyRequestsService.getVendors(),
        staffSupplyRequestsService.getPreferredVendors()
      ]);
      setVendors(allVendors.data);
      setPreferredVendors(preferred.data);
    } catch {
      // Error handled silently
    }
  };

  const fetchTemplates = async () => {
    try {
      const [templatesResponse, categoriesResponse] = await Promise.all([
        staffSupplyRequestsService.getRequestTemplates(user?.department),
        staffSupplyRequestsService.getRequestCategories(user?.department)
      ]);
      setTemplates(templatesResponse.data);
      setCategories(categoriesResponse.data);
    } catch {
      // Error handled silently
    }
  };

  const createRequestFromTemplate = async (template: RequestTemplate) => {
    try {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      await staffSupplyRequestsService.createRequestFromTemplate(template._id, {
        neededBy: tomorrow.toISOString().split('T')[0]
      });

      toast.success(`Request created from template: ${template.name}`);
      setShowTemplateModal(false);
      setSelectedTemplate(null);
      fetchMyRequests();
      fetchMyStats();
    } catch (error) {
      toast.error('Failed to create request from template');
    }
  };

  const checkCostOptimizations = useCallback(async (items: SupplyRequestItem[]) => {
    if (items.length === 0) {
      setCostOptimizations(null);
      return;
    }

    try {
      const response = await staffSupplyRequestsService.getCostOptimizationSuggestions(items);
      setCostOptimizations(response.data);
    } catch {
      // Error handled silently
    }
  }, []);

  // Check for cost optimizations when items change
  useEffect(() => {
    if (newRequest.items.length > 0) {
      checkCostOptimizations(newRequest.items);
    }
  }, [newRequest.items, checkCostOptimizations]);

  // Calculate analytics data from requests
  const calculateAnalytics = useCallback((): AnalyticsData | null => {
    if (!requests.length) return null;

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const recentRequests = requests.filter(r => new Date(r.createdAt) >= thirtyDaysAgo);

    // Department breakdown
    const departmentBreakdown = requests.reduce((acc, r) => {
      acc[r.department] = (acc[r.department] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Status distribution
    const statusBreakdown = requests.reduce((acc, r) => {
      acc[r.status] = (acc[r.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Cost analysis
    const totalCost = requests.reduce((sum, r) => sum + r.totalEstimatedCost, 0);
    const avgCost = totalCost / requests.length;
    const costByMonth = requests.reduce((acc, r) => {
      const month = format(parseISO(r.createdAt), 'MMM yyyy');
      acc[month] = (acc[month] || 0) + r.totalEstimatedCost;
      return acc;
    }, {} as Record<string, number>);

    // Priority distribution
    const priorityBreakdown = requests.reduce((acc, r) => {
      acc[r.priority] = (acc[r.priority] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Request trends
    const requestTrends = {
      thisMonth: recentRequests.length,
      lastMonth: requests.filter(r => {
        const reqDate = new Date(r.createdAt);
        const lastMonth = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
        return reqDate >= lastMonth && reqDate < thirtyDaysAgo;
      }).length,
    };

    return {
      departmentBreakdown,
      statusBreakdown,
      priorityBreakdown,
      costAnalysis: {
        total: totalCost,
        average: avgCost,
        byMonth: costByMonth
      },
      requestTrends,
      recentActivity: recentRequests.length
    };
  }, [requests]);

  // Update analytics when requests change
  useEffect(() => {
    const analytics = calculateAnalytics();
    setAnalyticsData(analytics);
  }, [requests, calculateAnalytics]);

  // Real-time WebSocket listeners for supply-request events
  // These fire immediately when the manager approves/rejects, giving instant feedback
  // instead of waiting for the 30-second polling interval.
  useEffect(() => {
    const handleSupplyRequestEvent = (data: Record<string, unknown>) => {
      const supplyRequest = data.supplyRequest as { requestNumber?: string; status?: string; requestedBy?: string } | undefined;
      const newStatus = (data.status as string | undefined) || supplyRequest?.status;

      if (supplyRequest && newStatus) {
        const statusMessages: Record<string, string> = {
          approved: 'Your supply request has been approved!',
          rejected: 'Your supply request was rejected',
          ordered: 'Your request has been ordered',
          partial_received: 'Some items have been received',
          received: 'All items have been received',
          cancelled: 'Your supply request has been cancelled'
        };
        const message = statusMessages[newStatus];
        if (message && supplyRequest.requestNumber) {
          const isPositive = ['approved', 'ordered', 'partial_received', 'received'].includes(newStatus);
          if (isPositive) {
            toast.success(`${message} — Request: ${supplyRequest.requestNumber}`);
          } else {
            toast.error(`${message} — Request: ${supplyRequest.requestNumber}`);
          }
        }
      }
      // Refresh to get the latest data
      fetchMyRequests();
      fetchMyStats();
    };

    on('supply-requests:status_changed', handleSupplyRequestEvent);
    on('supply-requests:created', fetchMyRequests);
    on('supply-requests:updated', fetchMyRequests);

    return () => {
      off('supply-requests:status_changed', handleSupplyRequestEvent);
      off('supply-requests:created', fetchMyRequests);
      off('supply-requests:updated', fetchMyRequests);
    };
  }, [on, off, fetchMyRequests, fetchMyStats]);

  // Fallback polling: only when WebSocket is not connected, to avoid redundant requests
  useEffect(() => {
    if (isConnected) return; // Real-time updates handle this when WS is live

    const interval = setInterval(() => {
      if (!loading) {
        checkForStatusUpdates();
      }
    }, 30000); // Check every 30 seconds as a fallback

    return () => clearInterval(interval);
  }, [checkForStatusUpdates, loading, isConnected]);

  // Helper functions using service utilities
  const getDepartmentColor = useCallback((department: string) => {
    const colors: Record<string, string> = {
      housekeeping: 'bg-green-100 text-green-800',
      maintenance: 'bg-orange-100 text-orange-800',
      front_desk: 'bg-blue-100 text-blue-800',
      food_beverage: 'bg-purple-100 text-purple-800',
      spa: 'bg-pink-100 text-pink-800',
      other: 'bg-gray-100 text-gray-800'
    };
    return colors[department] || 'bg-gray-100 text-gray-800';
  }, []);

  const getPriorityColor = useCallback((priority: string) =>
    staffSupplyRequestsService.getPriorityColorClass(priority), []);

  const isOverdue = useCallback((request: SupplyRequest) =>
    staffSupplyRequestsService.isOverdue(request.neededBy, request.status), []);

  const canEdit = useCallback((request: SupplyRequest) =>
    staffSupplyRequestsService.canEdit(request, user?._id || ''), [user?._id]);

  // Memoized computed values for performance
  const columns = useMemo(() => [
    {
      key: 'requestNumber',
      header: 'Request #',
      render: (value: string) => (
        <span className="font-medium text-blue-600">{value}</span>
      )
    },
    {
      key: 'title',
      header: 'Title',
      render: (value: string, row: SupplyRequest) => (
        <div>
          <div className="font-medium text-gray-900">{value}</div>
          <div className="text-sm text-gray-500">{row.items.length} items</div>
        </div>
      )
    },
    {
      key: 'department',
      header: 'Department',
      render: (value: string) => (
        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getDepartmentColor(value)}`}>
          {value.replace('_', ' ')}
        </span>
      )
    },
    {
      key: 'priority',
      header: 'Priority',
      render: (value: string) => (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getPriorityColor(value)}`}>
          {value}
        </span>
      )
    },
    {
      key: 'status',
      header: 'Status',
      render: (value: string, row: SupplyRequest) => (
        <div className="flex items-center">
          <StatusBadge status={value} />
          {isOverdue(row) && (
            <span className="ml-2 text-xs text-red-600 font-medium">OVERDUE</span>
          )}
        </div>
      )
    },
    {
      key: 'totalEstimatedCost',
      header: 'Cost',
      render: (value: number) => (
        <span className="font-medium text-gray-900">{formatCurrency(value)}</span>
      )
    },
    {
      key: 'neededBy',
      header: 'Needed By',
      render: (value: string) => (
        <span className="text-sm text-gray-600">
          {value ? format(parseISO(value), 'MMM dd, yyyy') : 'N/A'}
        </span>
      )
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (value: unknown, row: SupplyRequest) => (
        <div className="flex items-center space-x-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              setSelectedRequest(row);
              setShowViewModal(true);
            }}
            className="text-xs"
          >
            <Eye className="h-3 w-3 mr-1" />
            View
          </Button>
          {canEdit(row) && (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                setSelectedRequest(row);
                setShowEditModal(true);
              }}
              className="text-xs"
            >
              <Edit className="h-3 w-3 mr-1" />
              Edit
            </Button>
          )}
        </div>
      )
    }
  ], [getDepartmentColor, getPriorityColor, isOverdue, canEdit]);
  const totalEstimatedCost = useMemo(() =>
    newRequest.items.reduce((sum, item) => sum + (item.estimatedCost * item.quantity), 0),
    [newRequest.items]
  );


  if (loading && !requests.length) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <ErrorBoundary level="page">
      <div className="p-3 sm:p-6 max-w-7xl mx-auto">
        {/* Enhanced Mobile Header */}
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-4 sm:p-6 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl shadow-md">
                <Package className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
                  My Supply Requests
                </h1>
                <p className="text-gray-600 mt-1 text-sm sm:text-base">
                  Create and track your supply requests
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <Button
                onClick={() => setShowCreateModal(true)}
                className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 sm:px-6 sm:py-3 text-sm sm:text-base font-medium"
              >
                <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
                <span className="hidden sm:inline">New Request</span>
                <span className="sm:hidden">New</span>
              </Button>

              {/* Budget & Status Indicators */}
              {currentBudget && (
                <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${
                  currentBudget.utilizationPercentage > 90
                    ? 'bg-red-100 border-red-200 text-red-800'
                    : currentBudget.utilizationPercentage > 75
                    ? 'bg-orange-100 border-orange-200 text-orange-800'
                    : 'bg-green-100 border-green-200 text-green-800'
                }`}>
                  <Wallet className="w-4 h-4" />
                  <span className="text-sm font-medium">
                    Budget: {currentBudget.utilizationPercentage.toFixed(1)}%
                  </span>
                </div>
              )}

              {stats && stats.pending > 0 && (
                <div className="flex items-center gap-2 bg-yellow-100 border border-yellow-200 rounded-lg px-3 py-2">
                  <Clock className="w-4 h-4 text-yellow-600" />
                  <span className="text-sm font-medium text-yellow-800">
                    {stats.pending} pending approval
                  </span>
                </div>
              )}

              <Button
                onClick={() => setShowBudgetDashboard(!showBudgetDashboard)}
                variant="secondary"
                size="sm"
                className="flex items-center gap-2"
              >
                <Wallet className="w-4 h-4" />
                Budget
              </Button>

              <Button
                onClick={() => setShowVendorDashboard(!showVendorDashboard)}
                variant="secondary"
                size="sm"
                className="flex items-center gap-2"
              >
                <Package className="w-4 h-4" />
                Vendors
              </Button>

              <Button
                onClick={() => setShowAnalyticsDashboard(!showAnalyticsDashboard)}
                variant="secondary"
                size="sm"
                className="flex items-center gap-2"
              >
                <BarChart3 className="w-4 h-4" />
                Analytics
              </Button>

              <Button
                onClick={() => setShowTemplateModal(true)}
                variant="secondary"
                size="sm"
                className="flex items-center gap-2"
              >
                <FileText className="w-4 h-4" />
                Templates
              </Button>

              <Button
                onClick={() => {
                  fetchMyRequests();
                  fetchMyStats();
                }}
                variant="secondary"
                size="sm"
                disabled={loading}
                className="flex items-center gap-2"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
          </div>
        </div>

        {/* Enhanced Mobile Stats Cards */}
        {stats && (
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4 mb-6">
            <Card className="bg-gradient-to-br from-white to-blue-50 border-0 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-center">
                  <div className="p-2 sm:p-3 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-md">
                    <FileText className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
                  </div>
                  <div className="ml-2 sm:ml-3">
                    <p className="text-xs sm:text-sm font-semibold text-gray-600">Total</p>
                    <p className="text-lg sm:text-xl font-bold text-gray-900">{stats.total}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-white to-yellow-50 border-0 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-center">
                  <div className="p-2 sm:p-3 bg-gradient-to-br from-yellow-500 to-orange-500 rounded-xl shadow-md">
                    <Clock className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
                  </div>
                  <div className="ml-2 sm:ml-3">
                    <p className="text-xs sm:text-sm font-semibold text-gray-600">Pending</p>
                    <p className="text-lg sm:text-xl font-bold text-gray-900">{stats.pending}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-white to-green-50 border-0 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-center">
                  <div className="p-2 sm:p-3 bg-gradient-to-br from-green-500 to-emerald-500 rounded-xl shadow-md">
                    <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
                  </div>
                  <div className="ml-2 sm:ml-3">
                    <p className="text-xs sm:text-sm font-semibold text-gray-600">Approved</p>
                    <p className="text-lg sm:text-xl font-bold text-gray-900">{stats.approved}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-white to-red-50 border-0 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-center">
                  <div className="p-2 sm:p-3 bg-gradient-to-br from-red-500 to-red-600 rounded-xl shadow-md">
                    <AlertTriangle className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
                  </div>
                  <div className="ml-2 sm:ml-3">
                    <p className="text-xs sm:text-sm font-semibold text-gray-600">Rejected</p>
                    <p className="text-lg sm:text-xl font-bold text-gray-900">{stats.rejected}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-white to-purple-50 border-0 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 col-span-2 lg:col-span-1">
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-center">
                  <div className="p-2 sm:p-3 bg-gradient-to-br from-purple-500 to-indigo-500 rounded-xl shadow-md">
                    <IndianRupee className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
                  </div>
                  <div className="ml-2 sm:ml-3">
                    <p className="text-xs sm:text-sm font-semibold text-gray-600">Total Value</p>
                    <p className="text-lg sm:text-xl font-bold text-gray-900">{formatCurrency(stats.totalValue)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Budget Dashboard */}
        {showBudgetDashboard && (
          <BudgetDashboard onBudgetLoad={setCurrentBudget} />
        )}

        {/* Vendor Dashboard */}
        {showVendorDashboard && (
          <Card className="bg-white rounded-xl shadow-lg border border-gray-200 mb-6">
            <CardHeader className="border-b border-gray-200">
              <CardTitle className="text-xl font-bold text-gray-900 flex items-center">
                <Package className="h-6 w-6 mr-2 text-purple-600" />
                Vendor Analytics
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Preferred Vendors */}
                <div className="bg-purple-50 p-4 rounded-lg">
                  <h3 className="text-lg font-semibold text-purple-900 mb-3">Preferred Vendors</h3>
                  <div className="space-y-2">
                    {preferredVendors.slice(0, 3).map(vendor => (
                      <div key={vendor._id} className="flex items-center justify-between">
                        <span className="text-sm font-medium text-purple-800">{vendor.name}</span>
                        <span className="text-xs text-purple-600 bg-purple-100 px-2 py-1 rounded">
                          {vendor.category}
                        </span>
                      </div>
                    ))}
                    {preferredVendors.length > 3 && (
                      <div className="text-xs text-purple-600 text-center">
                        +{preferredVendors.length - 3} more
                      </div>
                    )}
                  </div>
                </div>

                {/* All Vendors */}
                <div className="bg-blue-50 p-4 rounded-lg">
                  <h3 className="text-lg font-semibold text-blue-900 mb-3">All Vendors</h3>
                  <div className="text-2xl font-bold text-blue-900 mb-2">
                    {vendors.length}
                  </div>
                  <div className="text-sm text-blue-600">
                    Total registered vendors
                  </div>
                  <div className="mt-3 space-y-1">
                    {Object.entries(
                      vendors.reduce((acc, vendor) => {
                        acc[vendor.category] = (acc[vendor.category] || 0) + 1;
                        return acc;
                      }, {} as Record<string, number>)
                    ).slice(0, 3).map(([category, count]) => (
                      <div key={category} className="flex justify-between text-xs">
                        <span className="text-blue-700 capitalize">{category}</span>
                        <span className="text-blue-600 font-medium">{count}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Vendor Performance */}
                <div className="bg-green-50 p-4 rounded-lg">
                  <h3 className="text-lg font-semibold text-green-900 mb-3">Performance</h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-green-700">Avg. Rating</span>
                      <div className="flex items-center">
                        <span className="text-lg font-bold text-green-900">4.2</span>
                        <span className="text-sm text-green-600 ml-1">/5.0</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-green-700">On-time Delivery</span>
                      <span className="text-sm font-medium text-green-900">94%</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-green-700">Cost Savings</span>
                      <span className="text-sm font-medium text-green-900">₹12,340</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-6 flex justify-end">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setShowVendorDashboard(false)}
                  className="text-xs"
                >
                  Hide Vendor Analytics
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Analytics Dashboard */}
        {showAnalyticsDashboard && analyticsData && (
          <Card className="bg-white rounded-xl shadow-lg border border-gray-200 mb-6">
            <CardHeader className="border-b border-gray-200">
              <CardTitle className="text-xl font-bold text-gray-900 flex items-center">
                <BarChart3 className="h-6 w-6 mr-2 text-blue-600" />
                Request Analytics & Insights
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              {/* KPI Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-blue-700">Total Requests</span>
                    <FileText className="h-4 w-4 text-blue-600" />
                  </div>
                  <div className="text-2xl font-bold text-blue-900">{requests.length}</div>
                  <div className="text-xs text-blue-600">All time</div>
                </div>

                <div className="bg-green-50 p-4 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-green-700">Total Value</span>
                    <IndianRupee className="h-4 w-4 text-green-600" />
                  </div>
                  <div className="text-2xl font-bold text-green-900">
                    {formatCurrency(analyticsData.costAnalysis.total)}
                  </div>
                  <div className="text-xs text-green-600">
                    Avg: {formatCurrency(analyticsData.costAnalysis.average)}
                  </div>
                </div>

                <div className="bg-orange-50 p-4 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-orange-700">Recent Activity</span>
                    <Clock className="h-4 w-4 text-orange-600" />
                  </div>
                  <div className="text-2xl font-bold text-orange-900">
                    {analyticsData.recentActivity}
                  </div>
                  <div className="text-xs text-orange-600">Last 30 days</div>
                </div>

                <div className="bg-purple-50 p-4 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-purple-700">Trend</span>
                    {analyticsData.requestTrends.thisMonth >= analyticsData.requestTrends.lastMonth ? (
                      <TrendingUp className="h-4 w-4 text-green-600" />
                    ) : (
                      <TrendingDown className="h-4 w-4 text-red-600" />
                    )}
                  </div>
                  <div className="text-2xl font-bold text-purple-900">
                    {analyticsData.requestTrends.thisMonth >= analyticsData.requestTrends.lastMonth ? '+' : ''}
                    {((analyticsData.requestTrends.thisMonth - analyticsData.requestTrends.lastMonth) / Math.max(analyticsData.requestTrends.lastMonth, 1) * 100).toFixed(0)}%
                  </div>
                  <div className="text-xs text-purple-600">vs last month</div>
                </div>
              </div>

              {/* Charts Section */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Status Breakdown */}
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                    <PieChart className="h-5 w-5 mr-2 text-blue-600" />
                    Status Distribution
                  </h3>
                  <div className="space-y-3">
                    {Object.entries(analyticsData.statusBreakdown).map(([status, count]) => {
                      const percentage = (count / requests.length * 100).toFixed(1);
                      const colorMap: Record<string, string> = {
                        pending: 'bg-yellow-500',
                        approved: 'bg-green-500',
                        rejected: 'bg-red-500',
                        ordered: 'bg-blue-500',
                        received: 'bg-purple-500',
                        cancelled: 'bg-gray-500'
                      };
                      return (
                        <div key={status} className="flex items-center justify-between">
                          <div className="flex items-center">
                            <div className={`w-3 h-3 rounded-full mr-2 ${colorMap[status] || 'bg-gray-400'}`} />
                            <span className="text-sm font-medium capitalize">{status}</span>
                          </div>
                          <div className="flex items-center">
                            <span className="text-sm text-gray-600 mr-2">{count}</span>
                            <span className="text-xs text-gray-500">({percentage}%)</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Priority Breakdown */}
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                    <AlertTriangle className="h-5 w-5 mr-2 text-orange-600" />
                    Priority Analysis
                  </h3>
                  <div className="space-y-3">
                    {Object.entries(analyticsData.priorityBreakdown).map(([priority, count]) => {
                      const percentage = (count / requests.length * 100).toFixed(1);
                      const colorMap: Record<string, string> = {
                        low: 'bg-green-500',
                        medium: 'bg-yellow-500',
                        high: 'bg-orange-500',
                        urgent: 'bg-red-500',
                        emergency: 'bg-red-600'
                      };
                      return (
                        <div key={priority} className="flex items-center justify-between">
                          <div className="flex items-center">
                            <div className={`w-3 h-3 rounded-full mr-2 ${colorMap[priority] || 'bg-gray-400'}`} />
                            <span className="text-sm font-medium capitalize">{priority}</span>
                          </div>
                          <div className="flex items-center">
                            <span className="text-sm text-gray-600 mr-2">{count}</span>
                            <span className="text-xs text-gray-500">({percentage}%)</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="mt-6 flex justify-end">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setShowAnalyticsDashboard(false)}
                  className="text-xs"
                >
                  Hide Analytics
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Enhanced Filters with Quick Actions */}
        <Card className="bg-white rounded-xl shadow-lg border border-gray-200 p-4 sm:p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center">
              <div className="p-2 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg shadow-md">
                <Filter className="h-4 w-4 text-white" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 ml-3">Filter & Quick Actions</h3>
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              className="text-xs"
            >
              Advanced
            </Button>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex flex-wrap gap-2 mb-4">
            <Button
              size="sm"
              variant={filters.status === '' ? "default" : "secondary"}
              onClick={() => setFilters({ ...filters, status: '', page: 1 })}
              className="text-xs"
            >
              All Requests
            </Button>
            <Button
              size="sm"
              variant={filters.status === 'pending' ? "default" : "secondary"}
              onClick={() => setFilters({ ...filters, status: 'pending', page: 1 })}
              className="text-xs bg-yellow-100 hover:bg-yellow-200 text-yellow-800"
            >
              Pending ({stats?.pending || 0})
            </Button>
            <Button
              size="sm"
              variant={filters.status === 'approved' ? "default" : "secondary"}
              onClick={() => setFilters({ ...filters, status: 'approved', page: 1 })}
              className="text-xs bg-green-100 hover:bg-green-200 text-green-800"
            >
              Approved ({stats?.approved || 0})
            </Button>
            <Button
              size="sm"
              variant={filters.overdue ? "default" : "secondary"}
              onClick={() => setFilters({ ...filters, overdue: !filters.overdue, page: 1 })}
              className="text-xs bg-red-100 hover:bg-red-200 text-red-800"
            >
              <AlertTriangle className="w-3 h-3 mr-1" />
              Overdue
            </Button>
          </div>

          {/* Basic Filters */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Status</label>
              <select
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                value={filters.status}
                onChange={(e) => setFilters({ ...filters, status: e.target.value, page: 1 })}
              >
                <option value="">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
                <option value="ordered">Ordered</option>
                <option value="partial_received">Partially Received</option>
                <option value="received">Received</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Priority</label>
              <select
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                value={filters.priority}
                onChange={(e) => setFilters({ ...filters, priority: e.target.value, page: 1 })}
              >
                <option value="">All Priorities</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
                <option value="emergency">Emergency</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Search</label>
              <Input
                placeholder="Search requests..."
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value, page: 1 })}
                className="focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div className="flex items-end">
              <Button
                variant="secondary"
                onClick={() => setFilters({ page: 1, limit: 10, status: '', priority: '', search: '', startDate: '', endDate: '', overdue: false })}
                className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700"
              >
                Reset All
              </Button>
            </div>
          </div>

          {/* Advanced Filters */}
          {showAdvancedFilters && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">From Date</label>
                  <Input
                    type="date"
                    value={filters.startDate}
                    onChange={(e) => setFilters({ ...filters, startDate: e.target.value, page: 1 })}
                    className="focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">To Date</label>
                  <Input
                    type="date"
                    value={filters.endDate}
                    onChange={(e) => setFilters({ ...filters, endDate: e.target.value, page: 1 })}
                    className="focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div className="flex items-end">
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="overdue"
                      checked={filters.overdue}
                      onChange={(e) => setFilters({ ...filters, overdue: e.target.checked, page: 1 })}
                      className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <label htmlFor="overdue" className="text-sm font-semibold text-gray-700">
                      Show only overdue requests
                    </label>
                  </div>
                </div>
              </div>
            </div>
          )}
        </Card>

        {/* Enhanced Mobile Requests Table */}
        <Card className="bg-white rounded-xl shadow-lg border border-gray-200">
          <CardHeader className="border-b border-gray-200">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <CardTitle className="text-xl font-bold text-gray-900">
                My Requests ({pagination.total})
              </CardTitle>

              {/* Enhanced Quick Actions */}
              <div className="flex items-center gap-2">
                <div className="text-sm text-gray-500">
                  {requests.length > 0 && (
                    <span>{requests.filter(r => r.status === 'pending').length} pending</span>
                  )}
                </div>

                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => setFilters({ ...filters, status: 'pending', page: 1 })}
                    className="text-xs px-2 py-1"
                  >
                    Pending
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => setFilters({ ...filters, priority: 'urgent', page: 1 })}
                    className="text-xs px-2 py-1 bg-orange-100 text-orange-800 hover:bg-orange-200"
                  >
                    Urgent
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => setFilters({ ...filters, overdue: true, page: 1 })}
                    className="text-xs px-2 py-1 bg-red-100 text-red-800 hover:bg-red-200"
                  >
                    Overdue
                  </Button>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {/* Mobile-Optimized View */}
            <div className="block sm:hidden">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <LoadingSpinner />
                </div>
              ) : requests.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Package className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p>No supply requests found</p>
                  <Button
                    onClick={() => setShowCreateModal(true)}
                    className="mt-4 bg-blue-600 hover:bg-blue-700"
                  >
                    Create Your First Request
                  </Button>
                </div>
              ) : (
                <div className="divide-y divide-gray-200">
                  {requests.map((request) => (
                    <div key={request._id} className="p-4 hover:bg-gray-50">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <div className="font-medium text-gray-900">{request.requestNumber}</div>
                          <div className="text-sm text-gray-600 truncate max-w-40">{request.title}</div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <StatusBadge status={request.status} />
                          {isOverdue(request) && (
                            <span className="text-xs text-red-600 font-medium">OVERDUE</span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-sm mb-3">
                        <div className="flex items-center space-x-4">
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getDepartmentColor(request.department)}`}>
                            {request.department.replace('_', ' ')}
                          </span>
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getPriorityColor(request.priority)}`}>
                            {request.priority}
                          </span>
                        </div>
                        <div className="text-gray-500">
                          {formatCurrency(request.totalEstimatedCost)}
                        </div>
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="text-xs text-gray-500">
                          Needed by {request.neededBy ? format(parseISO(request.neededBy), 'MMM dd') : 'N/A'}
                        </div>
                        <div className="flex items-center space-x-2">
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => {
                              setSelectedRequest(request);
                              setShowViewModal(true);
                            }}
                            className="text-xs"
                          >
                            View
                          </Button>
                          {canEdit(request) && (
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => {
                                setSelectedRequest(request);
                                setShowEditModal(true);
                              }}
                              className="text-xs"
                            >
                              Edit
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Desktop Table View */}
            <div className="hidden sm:block">
              <DataTable
                data={requests}
                columns={columns}
                loading={loading}
              />
            </div>

            {/* Pagination Controls */}
            {pagination.pages > 1 && (
              <div className="flex items-center justify-between p-4 border-t border-gray-200">
                <p className="text-sm text-gray-600">
                  Showing {requests.length} of {pagination.total} requests
                </p>
                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setFilters(f => ({ ...f, page: Math.max(1, (f.page || 1) - 1) }))}
                    disabled={filters.page === 1 || loading}
                  >
                    Previous
                  </Button>
                  <span className="text-sm text-gray-700 px-2">
                    Page {filters.page} of {pagination.pages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setFilters(f => ({ ...f, page: Math.min(pagination.pages, (f.page || 1) + 1) }))}
                    disabled={filters.page === pagination.pages || loading}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Create Request Modal */}
        <Modal
          isOpen={showCreateModal}
          onClose={() => {
            setShowCreateModal(false);
            resetNewRequestForm();
          }}
          title="Create Supply Request"
          size="lg"
        >
          <div className="space-y-6">
            {/* Basic Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
                <Input
                  placeholder="Brief title for the request"
                  value={newRequest.title}
                  onChange={(e) => setNewRequest({ ...newRequest, title: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
                <select
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                  value={newRequest.department}
                  onChange={(e) => setNewRequest({ ...newRequest, department: e.target.value })}
                >
                  <option value="housekeeping">Housekeeping</option>
                  <option value="maintenance">Maintenance</option>
                  <option value="front_desk">Front Desk</option>
                  <option value="food_beverage">Food &amp; Beverage</option>
                  <option value="spa">Spa</option>
                  <option value="laundry">Laundry</option>
                  <option value="kitchen">Kitchen</option>
                  <option value="bar">Bar</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea
                className="w-full border border-gray-300 rounded-md px-3 py-2 h-20 resize-none"
                placeholder="Detailed description of what you need"
                value={newRequest.description}
                onChange={(e) => setNewRequest({ ...newRequest, description: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                <select
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                  value={newRequest.priority}
                  onChange={(e) => setNewRequest({ ...newRequest, priority: e.target.value as CreateSupplyRequestData['priority'] })}
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                  <option value="emergency">Emergency</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Needed By *</label>
                <Input
                  type="date"
                  value={newRequest.neededBy}
                  onChange={(e) => setNewRequest({ ...newRequest, neededBy: e.target.value })}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Justification</label>
              <textarea
                className="w-full border border-gray-300 rounded-md px-3 py-2 h-16 resize-none"
                placeholder="Why do you need these items?"
                value={newRequest.justification}
                onChange={(e) => setNewRequest({ ...newRequest, justification: e.target.value })}
              />
            </div>

            {/* Items Section */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium">Request Items</h3>
                <div className="flex flex-col items-end">
                  <div className="text-sm text-gray-600">
                    Total: <span className="font-medium">{formatCurrency(totalEstimatedCost)}</span>
                  </div>
                  {currentBudget && totalEstimatedCost > 0 && (
                    <div className={`text-xs mt-1 ${
                      totalEstimatedCost > currentBudget.remainingBudget
                        ? 'text-red-600 font-medium'
                        : 'text-green-600'
                    }`}>
                      {totalEstimatedCost > currentBudget.remainingBudget
                        ? `⚠️ Exceeds budget by ${formatCurrency(totalEstimatedCost - currentBudget.remainingBudget)}`
                        : `✓ Within budget (${formatCurrency(currentBudget.remainingBudget - totalEstimatedCost)} remaining)`
                      }
                    </div>
                  )}
                </div>
              </div>

              {/* Add Item Form */}
              <div className="bg-gray-50 p-4 rounded-lg mb-4">
                <h4 className="text-sm font-medium mb-3">Add Item</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
                  <Input
                    placeholder="Item name *"
                    value={newItem.name}
                    onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                  />
                  <select
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    value={newItem.category}
                    onChange={(e) => setNewItem({ ...newItem, category: e.target.value })}
                  >
                    <option value="">Select Category *</option>
                    <option value="cleaning">Cleaning</option>
                    <option value="toiletries">Toiletries</option>
                    <option value="linens">Linens</option>
                    <option value="food">Food</option>
                    <option value="beverage">Beverage</option>
                    <option value="office">Office</option>
                    <option value="maintenance">Maintenance</option>
                    <option value="technology">Technology</option>
                    <option value="furniture">Furniture</option>
                    <option value="other">Other</option>
                  </select>
                  <div>
                    <select
                      className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                      value={newItem.supplier}
                      onChange={(e) => setNewItem({ ...newItem, supplier: e.target.value })}
                    >
                      <option value="">Select Vendor (Optional)</option>
                      {preferredVendors.length > 0 && (
                        <optgroup label="Preferred Vendors">
                          {preferredVendors.map(vendor => (
                            <option key={vendor._id} value={vendor.name}>
                              {vendor.name} - {vendor.category}
                            </option>
                          ))}
                        </optgroup>
                      )}
                      {vendors.length > 0 && (
                        <optgroup label="All Vendors">
                          {vendors
                            .filter(vendor => !preferredVendors.some(pv => pv._id === vendor._id))
                            .map(vendor => (
                              <option key={vendor._id} value={vendor.name}>
                                {vendor.name} - {vendor.category}
                              </option>
                            ))
                          }
                        </optgroup>
                      )}
                      <option value="other">Other/Manual Entry</option>
                    </select>
                    {newItem.supplier === 'other' && (
                      <Input
                        className="mt-2"
                        placeholder="Enter vendor name manually"
                        value={newItem.customSupplier || ''}
                        onChange={(e) => setNewItem({ ...newItem, customSupplier: e.target.value })}
                      />
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-3">
                  <Input
                    type="number"
                    placeholder="Quantity *"
                    value={newItem.quantity}
                    onChange={(e) => setNewItem({ ...newItem, quantity: parseInt(e.target.value) || 1 })}
                  />
                  <Input
                    placeholder="Unit"
                    value={newItem.unit}
                    onChange={(e) => setNewItem({ ...newItem, unit: e.target.value })}
                  />
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="Cost per unit *"
                    value={newItem.estimatedCost}
                    onChange={(e) => setNewItem({ ...newItem, estimatedCost: parseFloat(e.target.value) || 0 })}
                  />
                  <Button onClick={addItemToRequest} size="sm">
                    Add Item
                  </Button>
                </div>
                <Input
                  placeholder="Description (optional)"
                  value={newItem.description}
                  onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
                />
              </div>

              {/* Items List */}
              {newRequest.items.length > 0 && (
                <div className="space-y-2">
                  {newRequest.items.map((item, index) => (
                    <div key={`newRequest-items-${index}-${item.name}`} className="flex items-center justify-between p-3 bg-white border rounded">
                      <div className="flex-1">
                        <div className="font-medium">{item.name}</div>
                        <div className="text-sm text-gray-500">
                          {item.quantity} {item.unit} • {item.category} • {formatCurrency(item.estimatedCost)} each
                        </div>
                        {item.description && (
                          <div className="text-sm text-gray-600">{item.description}</div>
                        )}
                      </div>
                      <div className="flex items-center space-x-2">
                        <div className="font-medium">{formatCurrency(item.estimatedCost * item.quantity)}</div>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => removeItemFromRequest(index)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {newRequest.items.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  No items added yet. Add items above to create your request.
                </div>
              )}
            </div>

            {/* Cost Optimization Suggestions */}
            {costOptimizations && costOptimizations.suggestions.length > 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center">
                    <Lightbulb className="h-5 w-5 text-yellow-600 mr-2" />
                    <h3 className="font-semibold text-yellow-800">Cost Optimization Suggestions</h3>
                  </div>
                  <div className="flex items-center text-sm">
                    <Target className="h-4 w-4 text-green-600 mr-1" />
                    <span className="text-green-700 font-medium">
                      Score: {costOptimizations.optimizationScore}%
                    </span>
                  </div>
                </div>

                <div className="space-y-2 mb-3">
                  {costOptimizations.suggestions.slice(0, showOptimizations ? undefined : 2).map((suggestion, index) => (
                    <div key={`cost-opt-${index}-${suggestion.type}`} className="flex items-start justify-between p-2 bg-white rounded border border-yellow-100">
                      <div className="flex-1">
                        <div className="text-sm font-medium text-gray-900">{suggestion.message}</div>
                        <div className="text-xs text-gray-600">{suggestion.action}</div>
                      </div>
                      <div className="flex items-center ml-2">
                        {suggestion.savings > 0 && (
                          <div className="flex items-center text-green-600">
                            <IndianRupee className="h-3 w-3 mr-1" />
                            <span className="text-xs font-medium">{formatCurrency(suggestion.savings)}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between">
                  <div className="text-sm">
                    {costOptimizations.totalPotentialSavings > 0 && (
                      <span className="text-green-700 font-medium">
                        Total potential savings: {formatCurrency(costOptimizations.totalPotentialSavings)}
                      </span>
                    )}
                  </div>
                  {costOptimizations.suggestions.length > 2 && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setShowOptimizations(!showOptimizations)}
                      className="text-xs"
                    >
                      {showOptimizations ? 'Show Less' : `Show ${costOptimizations.suggestions.length - 2} More`}
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center justify-end space-x-3 pt-6 border-t border-gray-200">
            <Button variant="secondary" onClick={() => {
              setShowCreateModal(false);
              resetNewRequestForm();
            }}>
              Cancel
            </Button>
            <Button
              onClick={createRequest}
              disabled={!newRequest.title || !newRequest.neededBy || newRequest.items.length === 0}
              className="bg-blue-600 hover:bg-blue-700"
            >
              Create Request
            </Button>
          </div>
        </Modal>

        {/* View Request Modal */}
        {selectedRequest && (
          <Modal
            isOpen={showViewModal}
            onClose={() => setShowViewModal(false)}
            title="Request Details"
            size="lg"
          >
            <div className="space-y-6">
              {/* Header Info */}
              <div className="border-b border-gray-200 pb-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">{selectedRequest.title}</h3>
                    <p className="text-sm text-gray-500 mt-1">Request #{selectedRequest.requestNumber}</p>
                  </div>
                  <div className="text-right">
                    <StatusBadge status={selectedRequest.status} />
                    {isOverdue(selectedRequest) && (
                      <div className="text-xs text-red-600 font-medium mt-1">OVERDUE</div>
                    )}
                  </div>
                </div>
                {selectedRequest.description && (
                  <p className="text-gray-600 mt-2">{selectedRequest.description}</p>
                )}
              </div>

              {/* Request Details */}
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Department & Priority</label>
                  <div className="mt-1">
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium mr-2 ${getDepartmentColor(selectedRequest.department)}`}>
                      {selectedRequest.department.replace('_', ' ')}
                    </span>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getPriorityColor(selectedRequest.priority)}`}>
                      {selectedRequest.priority}
                    </span>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Dates</label>
                  <div className="mt-1 text-sm text-gray-600">
                    <div>Created: {format(parseISO(selectedRequest.createdAt), 'MMM dd, yyyy')}</div>
                    <div className={isOverdue(selectedRequest) ? 'text-red-600 font-medium' : ''}>
                      Needed: {format(parseISO(selectedRequest.neededBy), 'MMM dd, yyyy')}
                    </div>
                  </div>
                </div>
              </div>

              {/* Items */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">Items</label>
                <div className="space-y-3">
                  {selectedRequest.items.map((item, index) => (
                    <div key={`selectedRequest-items-${index}-${item.name}`} className="flex items-start justify-between p-3 bg-gray-50 rounded">
                      <div className="flex-1">
                        <div className="font-medium text-gray-900">{item.name}</div>
                        <div className="text-sm text-gray-500">{item.description}</div>
                        <div className="text-sm text-gray-600 mt-1">
                          {item.quantity} {item.unit} • {item.category}
                          {item.supplier && <span className="ml-2">• {item.supplier}</span>}
                        </div>
                      </div>
                      <div className="text-right ml-4">
                        <div className="font-medium text-gray-900">
                          {formatCurrency(item.actualCost ? item.actualCost : item.estimatedCost)}
                        </div>
                        {item.actualCost && item.actualCost !== item.estimatedCost && (
                          <div className="text-sm text-gray-500">Est: {formatCurrency(item.estimatedCost)}</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="border-t border-gray-200 pt-3 mt-3">
                  <div className="flex justify-between items-center">
                    <span className="text-lg font-semibold text-gray-900">Total Cost:</span>
                    <span className="text-lg font-bold text-gray-900">
                      {formatCurrency(selectedRequest.totalActualCost > 0 ? selectedRequest.totalActualCost : selectedRequest.totalEstimatedCost)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Status specific info */}
              {selectedRequest.approvedBy && (
                <div>
                  <label className="block text-sm font-medium text-gray-700">Approval</label>
                  <div className="mt-1 bg-green-50 p-3 rounded-md text-sm">
                    <div className="font-medium">Approved by {selectedRequest.approvedBy.name}</div>
                    {selectedRequest.approvedAt && (
                      <div className="text-gray-600">
                        {format(parseISO(selectedRequest.approvedAt), 'MMM dd, yyyy HH:mm')}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {selectedRequest.status === 'rejected' && selectedRequest.rejectedReason && (
                <div>
                  <label className="block text-sm font-medium text-gray-700">Rejection Reason</label>
                  <div className="mt-1 bg-red-50 p-3 rounded-md text-sm text-red-800">
                    {selectedRequest.rejectedReason}
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end space-x-3 pt-6 border-t border-gray-200">
              <Button variant="secondary" onClick={() => setShowViewModal(false)}>
                Close
              </Button>
              {canEdit(selectedRequest) && (
                <Button
                  onClick={() => {
                    setShowViewModal(false);
                    setShowEditModal(true);
                  }}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  Edit Request
                </Button>
              )}
            </div>
          </Modal>
        )}

        {/* Edit Request Modal */}
        {selectedRequest && (
          <Modal
            isOpen={showEditModal}
            onClose={() => {
              setShowEditModal(false);
              setSelectedRequest(null);
            }}
            title="Edit Supply Request"
            size="lg"
          >
            <div className="space-y-6">
              <div className="text-sm text-gray-600 bg-blue-50 p-3 rounded-lg">
                <strong>Note:</strong> You can only edit requests that are in "Pending" status.
                Once approved or processed, requests cannot be modified.
              </div>

              {canEdit(selectedRequest) ? (
                <div className="space-y-4">
                  {/* Basic Request Info */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                      <Input
                        value={selectedRequest.title}
                        onChange={(e) => setSelectedRequest({
                          ...selectedRequest,
                          title: e.target.value
                        })}
                        placeholder="Brief title for the request"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                      <select
                        className="w-full border border-gray-300 rounded-md px-3 py-2"
                        value={selectedRequest.priority}
                        onChange={(e) => setSelectedRequest({
                          ...selectedRequest,
                          priority: e.target.value as SupplyRequest['priority']
                        })}
                      >
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                        <option value="urgent">Urgent</option>
                        <option value="emergency">Emergency</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                    <textarea
                      className="w-full border border-gray-300 rounded-md px-3 py-2 h-20 resize-none"
                      value={selectedRequest.description || ''}
                      onChange={(e) => setSelectedRequest({
                        ...selectedRequest,
                        description: e.target.value
                      })}
                      placeholder="Detailed description of what you need"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Needed By</label>
                      <Input
                        type="date"
                        value={selectedRequest.neededBy.split('T')[0]}
                        onChange={(e) => setSelectedRequest({
                          ...selectedRequest,
                          neededBy: e.target.value
                        })}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Current Status</label>
                      <div className="p-2 bg-gray-50 rounded-md">
                        <StatusBadge status={selectedRequest.status} />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Justification</label>
                    <textarea
                      className="w-full border border-gray-300 rounded-md px-3 py-2 h-16 resize-none"
                      value={selectedRequest.justification || ''}
                      onChange={(e) => setSelectedRequest({
                        ...selectedRequest,
                        justification: e.target.value
                      })}
                      placeholder="Why do you need these items?"
                    />
                  </div>

                  {/* Items List (Read-only for now) */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-3">Request Items</label>
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <div className="space-y-2">
                        {selectedRequest.items.map((item, index) => (
                          <div key={`selectedRequest-items-${index}-${item.name}`} className="flex items-center justify-between p-2 bg-white rounded border">
                            <div className="flex-1">
                              <div className="font-medium text-gray-900">{item.name}</div>
                              <div className="text-sm text-gray-500">
                                {item.quantity} {item.unit} • {item.category}
                                {item.supplier && <span className="ml-2">• {item.supplier}</span>}
                              </div>
                              {item.description && (
                                <div className="text-sm text-gray-600">{item.description}</div>
                              )}
                            </div>
                            <div className="font-medium text-gray-900">
                              {formatCurrency(item.estimatedCost * item.quantity)}
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="border-t border-gray-200 pt-2 mt-2">
                        <div className="flex justify-between font-semibold">
                          <span>Total Estimated Cost:</span>
                          <span>{formatCurrency(selectedRequest.totalEstimatedCost)}</span>
                        </div>
                      </div>
                      <div className="text-xs text-gray-500 mt-2">
                        Items cannot be modified after request creation. To change items, cancel this request and create a new one.
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-yellow-500" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Cannot Edit Request</h3>
                  <p className="text-gray-600">
                    This request cannot be edited because it has already been processed or is not in pending status.
                  </p>
                  <div className="mt-4">
                    <StatusBadge status={selectedRequest.status} />
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end space-x-3 pt-6 border-t border-gray-200">
              <Button variant="secondary" onClick={() => {
                setShowEditModal(false);
                setSelectedRequest(null);
              }}>
                Cancel
              </Button>
              {canEdit(selectedRequest) && (
                <Button
                  onClick={async () => {
                    try {
                      await staffSupplyRequestsService.updateRequest(selectedRequest._id, {
                        title: selectedRequest.title,
                        description: selectedRequest.description,
                        priority: selectedRequest.priority,
                        neededBy: selectedRequest.neededBy,
                        justification: selectedRequest.justification
                      });
                      toast.success('Request updated successfully');
                      setShowEditModal(false);
                      setSelectedRequest(null);
                      fetchMyRequests();
                    } catch (error) {
                      toast.error('Failed to update request');
                    }
                  }}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  Update Request
                </Button>
              )}
            </div>
          </Modal>
        )}

        {/* Template Modal */}
        <Modal
          isOpen={showTemplateModal}
          onClose={() => {
            setShowTemplateModal(false);
            setSelectedTemplate(null);
          }}
          title="Quick Start Templates"
          size="lg"
        >
          <div className="space-y-6">
            <div className="text-sm text-gray-600">
              Choose from pre-configured templates to quickly create supply requests based on common needs.
            </div>

            {/* Templates Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {templates.map((template) => (
                <div role="button" tabIndex={0}
                  key={template._id}
                  className="border border-gray-200 rounded-lg p-4 hover:border-blue-500 hover:shadow-md transition-all cursor-pointer"
                  onClick={() => setSelectedTemplate(template)}
                 onKeyDown={(e: React.KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); const clickHandler = () => setSelectedTemplate(template); if (typeof clickHandler === 'function') { clickHandler(e as any); } } }}>
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-semibold text-gray-900">{template.name}</h3>
                      <p className="text-sm text-gray-600 mt-1">{template.description}</p>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getPriorityColor(template.priority)}`}>
                        {template.priority}
                      </span>
                      <span className="text-xs text-gray-500 mt-1">Used {template.useCount}x</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-700">Items: {template.items.length}</span>
                      <span className="font-medium text-gray-900">
                        Est: {formatCurrency(template.estimatedBudget)}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {template.tags?.slice(0, 3).map((tag, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-700"
                        >
                          {tag}
                        </span>
                      ))}
                      {template.tags && template.tags.length > 3 && (
                        <span className="text-xs text-gray-500">+{template.tags.length - 3}</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {templates.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                <FileText className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <p>No templates available for your department</p>
              </div>
            )}

            {/* Selected Template Details */}
            {selectedTemplate && (
              <div className="border-t border-gray-200 pt-6">
                <h4 className="font-semibold text-gray-900 mb-3">Template Preview: {selectedTemplate.name}</h4>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <div className="space-y-2">
                    {selectedTemplate.items.map((item, index) => (
                      <div key={`selectedTemplate-items-${index}-${item.name}`} className="flex items-center justify-between text-sm">
                        <div>
                          <span className="font-medium">{item.name}</span>
                          <span className="text-gray-500 ml-2">
                            {item.quantity} {item.unit}
                          </span>
                        </div>
                        <span className="text-gray-700">
                          {formatCurrency(item.estimatedCost * item.quantity)}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="border-t border-gray-200 pt-2 mt-2">
                    <div className="flex justify-between font-semibold">
                      <span>Total Estimated Cost:</span>
                      <span>{formatCurrency(selectedTemplate.estimatedBudget)}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center justify-end space-x-3 pt-6 border-t border-gray-200">
            <Button variant="secondary" onClick={() => {
              setShowTemplateModal(false);
              setSelectedTemplate(null);
            }}>
              Cancel
            </Button>
            {selectedTemplate && (
              <Button
                onClick={() => createRequestFromTemplate(selectedTemplate)}
                className="bg-blue-600 hover:bg-blue-700"
              >
                Create from Template
              </Button>
            )}
          </div>
        </Modal>
      </div>
    </ErrorBoundary>
  );
}