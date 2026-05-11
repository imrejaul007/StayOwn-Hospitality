import React, { useState, useEffect, useCallback } from 'react';
import {
  Users,
  Banknote,
  TrendingUp,
  Calendar,
  AlertCircle,
  CheckCircle,
  XCircle,
  Clock,
  Download,
  Search,
  Plus,
  Edit,
  Eye,
  Ban,
  Award,
  BarChart3,
  Activity,
  Target,
  Zap
} from 'lucide-react';
import { motion } from 'framer-motion';
import { format, subMonths } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { travelAgentService, TravelAgent, TravelDashboardOverview } from '../../services/travelAgentService';
import { toast } from 'sonner';
import { useProperty } from '../../context/PropertyContext';
import { PropertyBreadcrumb } from '../../components/common/PropertyBreadcrumb';
import DateRangeSelector, { DateRange } from '../../components/filters/DateRangeSelector';
import MultiCriteriaFilter, { FilterCriteria, FilterField } from '../../components/filters/MultiCriteriaFilter';
import SavedFiltersManager, { SavedFilter } from '../../components/filters/SavedFiltersManager';
import ExportOptionsModal, { ExportOptions } from '../../components/filters/ExportOptionsModal';
import { withErrorBoundary } from '../../components/ErrorBoundary';

const AdminTravelDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { selectedPropertyId, viewMode } = useProperty();
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState<TravelDashboardOverview | null>(null);
  const [agents, setAgents] = useState<TravelAgent[]>([]);
  const [selectedTab, setSelectedTab] = useState<'overview' | 'agents' | 'commissions' | 'analytics' | 'comparative'>('overview');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [dateRange, setDateRange] = useState<DateRange>({
    start: format(subMonths(new Date(), 1), 'yyyy-MM-dd'),
    end: format(new Date(), 'yyyy-MM-dd'),
    label: 'Last month'
  });
  const [timeRange, setTimeRange] = useState<'week' | 'month' | 'quarter' | 'year'>('month');
  const [analytics, setAnalytics] = useState<Record<string, unknown> | null>(null);
  const [pendingCommissions, setPendingCommissions] = useState<Record<string, unknown> | null>(null);
  const [comparativeData, setComparativeData] = useState<{
    agentPerformance: Array<{
      agentId: string;
      agentName: string;
      bookingCount: number;
      revenue: number;
      commission: number;
      averageBookingValue: number;
      performanceScore: number;
    }>;
  }>({
    agentPerformance: []
  });
  const [filterCriteria, setFilterCriteria] = useState<FilterCriteria[]>([]);
  const [savedFilters, setSavedFilters] = useState<SavedFilter[]>([]);
  const [showExportModal, setShowExportModal] = useState(false);
  const [realTimeEnabled, setRealTimeEnabled] = useState(false);
  const [agentPage, setAgentPage] = useState(1);
  const [agentTotalPages, setAgentTotalPages] = useState(1);
  const [agentTotal, setAgentTotal] = useState(0);
  const AGENTS_PER_PAGE = 20;
  const [selectedAgents, setSelectedAgents] = useState<string[]>([]);
  const [bulkOperationMode, setBulkOperationMode] = useState(false);


  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true);

      // Fetch overview
      const dashboardOverview = await travelAgentService.getTravelDashboardOverview();
      setOverview(dashboardOverview);

      // Fetch agents list with pagination
      const agentsData = await travelAgentService.getAllTravelAgents({
        status: filterStatus !== 'all' ? filterStatus : undefined,
        search: searchTerm || undefined,
        sortBy: 'createdAt'
      });
      setAgents(agentsData?.travelAgents || []);
      setAgentTotal(agentsData?.total || agentsData?.travelAgents?.length || 0);
      setAgentTotalPages(Math.max(1, Math.ceil((agentsData?.total || agentsData?.travelAgents?.length || 0) / AGENTS_PER_PAGE)));

      // Fetch analytics if on analytics tab
      if (selectedTab === 'analytics') {
        const analyticsData = await travelAgentService.getTravelAnalytics({
          startDate: dateRange.start,
          endDate: dateRange.end
        });
        setAnalytics(analyticsData as Record<string, unknown>);
      }

      // Fetch pending commissions if on commissions tab
      if (selectedTab === 'commissions') {
        const commissionsData = await travelAgentService.getPendingCommissions();
        setPendingCommissions(commissionsData as Record<string, unknown>);
      }
    } catch (error) {
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  }, [selectedTab, dateRange, filterStatus, searchTerm]);

  useEffect(() => {
    fetchDashboardData();
    loadSavedFilters();
  }, [fetchDashboardData]);

  useEffect(() => {
    if (selectedTab === 'comparative' && !loading) {
      fetchComparativeData();
    }
  }, [selectedTab, selectedAgents, timeRange, dateRange]);

  const handleStatusUpdate = async (agentId: string, status: string) => {
    try {
      await travelAgentService.updateTravelAgentStatus(agentId, status);
      toast.success('Agent status updated successfully');
      fetchDashboardData();
    } catch (error) {
      toast.error('Failed to update agent status');
    }
  };

  const fetchComparativeData = async () => {
    try {
      // Build comparative data from real agent performance metrics
      const filteredForComparison = selectedAgents.length > 0
        ? agents.filter(a => selectedAgents.includes(a._id))
        : agents;

      const agentPerformance = filteredForComparison.map(agent => {
        const bookings = agent.performanceMetrics?.totalBookings || 0;
        const revenue = agent.performanceMetrics?.totalRevenue || 0;
        const commission = agent.performanceMetrics?.totalCommissionEarned || 0;
        const avgBookingValue = agent.performanceMetrics?.averageBookingValue || 0;
        // Weighted score: 40% bookings (normalized), 40% revenue (normalized), 20% avg value
        const maxBookings = Math.max(...filteredForComparison.map(a => a.performanceMetrics?.totalBookings || 0), 1);
        const maxRevenue = Math.max(...filteredForComparison.map(a => a.performanceMetrics?.totalRevenue || 0), 1);
        const performanceScore = Math.round(
          ((bookings / maxBookings) * 40) +
          ((revenue / maxRevenue) * 40) +
          (Math.min(avgBookingValue / 10000, 1) * 20)
        );

        return {
          agentId: agent._id,
          agentName: agent.companyName || 'Unknown',
          bookingCount: bookings,
          revenue,
          commission,
          averageBookingValue: avgBookingValue,
          performanceScore
        };
      });

      setComparativeData({
        agentPerformance
      });
    } catch (error) {
      toast.error('Failed to load comparative data');
    }
  };

  const loadSavedFilters = async () => {
    try {
      // Saved filters are stored in local component state for now.
      // Persisted filters could be stored via a user-preferences API in the future.
      setSavedFilters([]);
    } catch {
      // Silently ignore — saved filters are non-critical
    }
  };

  // Notification system removed — will be re-added when NotificationCenter component is ready

  const handleExportData = async (options: ExportOptions) => {
    try {
      setShowExportModal(false);
      toast.success(`Exporting data as ${options.format.toUpperCase()}...`);

      const blob = await travelAgentService.exportTravelData({
        type: 'agents',
        format: (options.format === 'csv' ? 'csv' : options.format === 'pdf' ? 'pdf' : 'excel') as 'csv' | 'excel' | 'pdf',
        startDate: dateRange.start,
        endDate: dateRange.end
      });

      // Download the blob
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${options.fileName || 'travel-export'}.${options.format === 'csv' ? 'csv' : options.format === 'pdf' ? 'pdf' : 'json'}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast.success('Export completed successfully!');
    } catch (error) {
      toast.error('Export failed');
    }
  };

  const handleBulkStatusUpdate = async (agentIds: string[], newStatus: string) => {
    try {
      await Promise.all(agentIds.map(id =>
        travelAgentService.updateTravelAgentStatus(id, newStatus)
      ));
      toast.success(`Updated ${agentIds.length} agents successfully`);
      setSelectedAgents([]);
      setBulkOperationMode(false);
      fetchDashboardData();
    } catch (error) {
      toast.error('Failed to update agent statuses');
    }
  };

  const handleSaveFilter = (filter: Omit<SavedFilter, 'id' | 'createdAt' | 'useCount'>) => {
    const newFilter: SavedFilter = {
      ...filter,
      id: Date.now().toString(),
      createdAt: new Date().toISOString(),
      useCount: 0
    };
    setSavedFilters(prev => [...prev, newFilter]);
    toast.success('Filter saved successfully!');
  };

  const handleLoadFilter = (filter: SavedFilter) => {
    setFilterCriteria(filter.criteria);
    if (filter.dateRange) {
      setDateRange(filter.dateRange);
    }
    toast.success('Filter loaded successfully!');
  };

  const handleUpdateFilter = (id: string, updates: Partial<SavedFilter>) => {
    setSavedFilters(prev => prev.map(f => f.id === id ? { ...f, ...updates } : f));
  };

  const handleDeleteFilter = (id: string) => {
    setSavedFilters(prev => prev.filter(f => f.id !== id));
    toast.success('Filter deleted successfully!');
  };


  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'suspended':
        return <XCircle className="h-4 w-4 text-red-600" />;
      case 'pending_approval':
        return <Clock className="h-4 w-4 text-yellow-600" />;
      default:
        return <AlertCircle className="h-4 w-4 text-gray-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'suspended':
        return 'bg-red-100 text-red-800';
      case 'pending_approval':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  // Filter field definitions for agents
  const agentFilterFields: FilterField[] = [
    {
      key: 'companyName',
      label: 'Company Name',
      type: 'text',
      operators: ['contains', 'equals']
    },
    {
      key: 'agentCode',
      label: 'Agent Code',
      type: 'text',
      operators: ['contains', 'equals']
    },
    {
      key: 'contactPerson',
      label: 'Contact Person',
      type: 'text',
      operators: ['contains', 'equals']
    },
    {
      key: 'status',
      label: 'Status',
      type: 'select',
      options: [
        { value: 'active', label: 'Active' },
        { value: 'inactive', label: 'Inactive' },
        { value: 'suspended', label: 'Suspended' },
        { value: 'pending_approval', label: 'Pending Approval' }
      ]
    },
    {
      key: 'totalRevenue',
      label: 'Total Revenue',
      type: 'number',
      operators: ['equals', 'greater_than', 'less_than', 'between']
    },
    {
      key: 'commissionRate',
      label: 'Commission Rate',
      type: 'number',
      operators: ['equals', 'greater_than', 'less_than', 'between']
    }
  ];

  const applyAgentFilters = (agents: TravelAgent[]) => {
    if (!agents || !Array.isArray(agents)) {
      return [];
    }

    return agents.filter(agent => {
      if (!agent) return false;

      // Basic search
      const matchesSearch = !searchTerm ||
        (agent.companyName && agent.companyName.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (agent.agentCode && agent.agentCode.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (agent.contactPerson && agent.contactPerson.toLowerCase().includes(searchTerm.toLowerCase()));

      // Status filter
      const matchesStatus = filterStatus === 'all' || agent.status === filterStatus;

      // Advanced criteria filters
      const matchesCriteria = !filterCriteria || filterCriteria.every(criteria => {
        if (!criteria.value) return true;

        switch (criteria.field) {
          case 'companyName':
            if (!agent.companyName) return false;
            const companyName = agent.companyName.toLowerCase();
            if (criteria.operator === 'contains') {
              return companyName.includes(criteria.value.toLowerCase());
            } else if (criteria.operator === 'equals') {
              return companyName === criteria.value.toLowerCase();
            }
            break;

          case 'agentCode':
            if (!agent.agentCode) return false;
            const agentCode = agent.agentCode.toLowerCase();
            if (criteria.operator === 'contains') {
              return agentCode.includes(criteria.value.toLowerCase());
            } else if (criteria.operator === 'equals') {
              return agentCode === criteria.value.toLowerCase();
            }
            break;

          case 'contactPerson':
            if (!agent.contactPerson) return false;
            const contactPerson = agent.contactPerson.toLowerCase();
            if (criteria.operator === 'contains') {
              return contactPerson.includes(criteria.value.toLowerCase());
            } else if (criteria.operator === 'equals') {
              return contactPerson === criteria.value.toLowerCase();
            }
            break;

          case 'status':
            return criteria.operator === 'equals' && agent.status === criteria.value;

          case 'totalRevenue':
            if (!agent.performanceMetrics || typeof agent.performanceMetrics.totalRevenue !== 'number') return false;
            const revenue = agent.performanceMetrics.totalRevenue;
            if (criteria.operator === 'equals') {
              return revenue === parseFloat(criteria.value);
            } else if (criteria.operator === 'greater_than') {
              return revenue > parseFloat(criteria.value);
            } else if (criteria.operator === 'less_than') {
              return revenue < parseFloat(criteria.value);
            } else if (criteria.operator === 'between') {
              const [min, max] = criteria.value;
              return revenue >= parseFloat(min) && revenue <= parseFloat(max);
            }
            break;

          case 'commissionRate':
            if (!agent.commissionStructure || typeof agent.commissionStructure.defaultRate !== 'number') return false;
            const rate = agent.commissionStructure.defaultRate;
            if (criteria.operator === 'equals') {
              return rate === parseFloat(criteria.value);
            } else if (criteria.operator === 'greater_than') {
              return rate > parseFloat(criteria.value);
            } else if (criteria.operator === 'less_than') {
              return rate < parseFloat(criteria.value);
            } else if (criteria.operator === 'between') {
              const [min, max] = criteria.value;
              return rate >= parseFloat(min) && rate <= parseFloat(max);
            }
            break;
        }
        return true;
      });

      return matchesSearch && matchesStatus && matchesCriteria;
    });
  };

  const filteredAgents = applyAgentFilters(agents);

  if (!selectedPropertyId && viewMode === 'single') {
    return (
      <div className="min-h-screen bg-gray-50 py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <PropertyBreadcrumb items={['Travel Dashboard']} />
          <div className="text-center py-12">
            <Users className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Property Selected</h3>
            <p className="text-gray-500">Please select a property to view travel agent management.</p>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-6">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <PropertyBreadcrumb items={['Travel Dashboard']} />
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Travel Agent Management</h1>
              <p className="text-gray-600 mt-2">
                Manage travel agents, commissions, and performance
              </p>
            </div>
            <div className="flex items-center gap-3">
              {bulkOperationMode && selectedAgents.length > 0 && (
                <div className="flex items-center gap-2 px-3 py-2 bg-indigo-50 border border-indigo-200 rounded-lg">
                  <span className="text-sm text-indigo-700">
                    {selectedAgents.length} selected
                  </span>
                  <button
                    onClick={() => handleBulkStatusUpdate(selectedAgents, 'active')}
                    className="text-sm text-green-600 hover:text-green-800 font-medium"
                  >
                    Activate
                  </button>
                  <button
                    onClick={() => handleBulkStatusUpdate(selectedAgents, 'suspended')}
                    className="text-sm text-red-600 hover:text-red-800 font-medium"
                  >
                    Suspend
                  </button>
                  <button
                    onClick={() => {
                      setSelectedAgents([]);
                      setBulkOperationMode(false);
                    }}
                    className="text-sm text-gray-600 hover:text-gray-800"
                  >
                    Cancel
                  </button>
                </div>
              )}
              <button
                onClick={() => setBulkOperationMode(!bulkOperationMode)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                  bulkOperationMode
                    ? 'bg-indigo-100 text-indigo-700 border border-indigo-200'
                    : 'border border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
              >
                <Zap className="h-5 w-5" />
                Bulk Actions
              </button>
              <button
                onClick={() => setShowExportModal(true)}
                className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <Download className="h-5 w-5" />
                Export
              </button>
              <button
                onClick={() => navigate('/admin/travel-agents/new')}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
              >
                <Plus className="h-5 w-5" />
                Add Agent
              </button>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow-sm mb-6">
          <div className="border-b border-gray-200">
            <nav className="flex -mb-px">
              {(['overview', 'agents', 'commissions', 'analytics', 'comparative'] as const).map((tab) => (
                <button
                  aria-label={`Switch to ${tab} tab`}
                  key={tab}
                  onClick={() => setSelectedTab(tab)}
                  className={`px-6 py-3 text-sm font-medium capitalize flex items-center gap-2 ${
                    selectedTab === tab
                      ? 'text-indigo-600 border-b-2 border-indigo-600'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {tab === 'analytics' && <BarChart3 className="h-4 w-4" />}
                  {tab === 'comparative' && <Target className="h-4 w-4" />}
                  {tab}
                </button>
              ))}
            </nav>
          </div>
        </div>

        {/* Overview Tab */}
        {selectedTab === 'overview' && overview && (
          <div className="space-y-6">
            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white p-6 rounded-lg shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-600 text-sm">Total Agents</p>
                    <p className="text-3xl font-bold text-gray-900 mt-2">
                      {overview?.overview?.totalAgents || 0}
                    </p>
                    <p className="text-sm text-green-600 mt-2">
                      {overview?.overview?.activeAgents || 0} active
                    </p>
                  </div>
                  <div className="p-3 bg-indigo-100 rounded-full">
                    <Users className="h-8 w-8 text-indigo-600" />
                  </div>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="bg-white p-6 rounded-lg shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-600 text-sm">Total Bookings</p>
                    <p className="text-3xl font-bold text-gray-900 mt-2">
                      {overview?.overview?.totalBookings || 0}
                    </p>
                    <p className="text-sm text-gray-600 mt-2">
                      This month
                    </p>
                  </div>
                  <div className="p-3 bg-green-100 rounded-full">
                    <Calendar className="h-8 w-8 text-green-600" />
                  </div>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="bg-white p-6 rounded-lg shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-600 text-sm">Total Revenue</p>
                    <p className="text-3xl font-bold text-gray-900 mt-2">
                      ₹{overview?.revenue?.totalRevenue?.toLocaleString() || '0'}
                    </p>
                    <p className={`text-sm mt-2 ${(overview?.overview?.revenueGrowth ?? 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {(overview?.overview?.revenueGrowth ?? 0) >= 0 ? '+' : ''}{overview?.overview?.revenueGrowth?.toFixed(1) ?? '0'}% vs last period
                    </p>
                  </div>
                  <div className="p-3 bg-green-100 rounded-full">
                    <Banknote className="h-8 w-8 text-green-600" />
                  </div>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="bg-white p-6 rounded-lg shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-600 text-sm">Pending Commissions</p>
                    <p className="text-3xl font-bold text-gray-900 mt-2">
                      ₹{overview?.commission?.pendingCommission?.toLocaleString() || '0'}
                    </p>
                    <p className="text-sm text-yellow-600 mt-2">
                      {overview?.overview?.pendingApprovals || 0} pending approvals
                    </p>
                  </div>
                  <div className="p-3 bg-yellow-100 rounded-full">
                    <Clock className="h-8 w-8 text-yellow-600" />
                  </div>
                </div>
              </motion.div>
            </div>

            {/* Top Performing Agents */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold text-gray-900">Top Performing Agents</h2>
                <button onClick={() => setSelectedTab('agents')} className="text-indigo-600 hover:text-indigo-700 text-sm font-medium">
                  View All
                </button>
              </div>
              <div className="space-y-4">
                {(!overview?.topPerformers || overview.topPerformers.length === 0) && (
                  <div className="text-center py-6 text-gray-500 text-sm">No agent performance data yet</div>
                )}
                {(overview?.topPerformers || []).map((agent, index) => (
                  <div key={agent._id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center justify-center w-10 h-10 bg-indigo-100 rounded-full">
                        <span className="text-indigo-600 font-semibold">#{index + 1}</span>
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">Agent {agent._id}</p>
                        <p className="text-sm text-gray-600">
                          {agent.totalBookings} bookings
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-gray-900">
                        ₹{agent.totalRevenue?.toLocaleString() || '0'}
                      </p>
                      <p className="text-sm text-gray-600">Revenue</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Recent Bookings */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold text-gray-900">Recent Agent Bookings</h2>
                <button
                  onClick={() => setSelectedTab('agents')}
                  className="text-indigo-600 hover:text-indigo-700 text-sm font-medium"
                >
                  View All
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Confirmation
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Agent
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Guest
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Amount
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Commission
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {(!overview?.recentBookings || overview.recentBookings.length === 0) && (
                      <tr><td colSpan={6} className="px-6 py-8 text-center text-gray-500 text-sm">No recent agent bookings</td></tr>
                    )}
                    {(overview?.recentBookings || []).slice(0, 5).map((booking) => {
                      // travelAgentId may be populated to an object by the backend
                      const agentRef = booking.travelAgentId as unknown as (string | { _id?: string; companyName?: string });
                      const agentName = typeof agentRef === 'object' && agentRef?.companyName
                        ? agentRef.companyName
                        : agents.find(a => a._id === (typeof agentRef === 'string' ? agentRef : agentRef?._id))?.companyName || 'N/A';
                      const commissionAmt = ((booking.commission as Record<string, unknown>)?.totalCommission as number) || booking.commission?.amount || 0;
                      const bookingStatus = (booking as unknown as Record<string, unknown>).status as string || booking.bookingStatus || 'unknown';

                      return (
                        <tr key={booking._id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {booking.confirmationNumber || 'N/A'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {agentName}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {booking.guestDetails?.primaryGuest?.name || 'N/A'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            ₹{booking.pricing?.totalAmount?.toLocaleString() || '0'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            ₹{commissionAmt.toLocaleString()}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-2 py-1 text-xs rounded-full ${
                              bookingStatus === 'confirmed' ? 'bg-green-100 text-green-800' :
                              bookingStatus === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {bookingStatus}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Agents Tab */}
        {selectedTab === 'agents' && (
          <div className="bg-white rounded-lg shadow-sm p-6">
            {/* Enhanced Search and Filters */}
            <div className="space-y-4 mb-6">
              <div className="flex flex-col lg:flex-row gap-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search agents..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-600 focus:border-transparent"
                  />
                </div>
                <DateRangeSelector
                  value={dateRange}
                  onChange={setDateRange}
                  className="w-full lg:w-auto"
                />
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-600 focus:border-transparent"
                >
                  <option value="all">All Status</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="suspended">Suspended</option>
                  <option value="pending_approval">Pending Approval</option>
                </select>
              </div>

              <div className="flex flex-wrap gap-2">
                <MultiCriteriaFilter
                  fields={agentFilterFields}
                  criteria={filterCriteria}
                  onChange={setFilterCriteria}
                />
                <SavedFiltersManager
                  savedFilters={savedFilters}
                  onLoad={handleLoadFilter}
                  onSave={handleSaveFilter}
                  onUpdate={handleUpdateFilter}
                  onDelete={handleDeleteFilter}
                  currentCriteria={filterCriteria}
                  currentDateRange={dateRange}
                />
                <button aria-label="Toggle real-time updates"
                  onClick={() => setRealTimeEnabled(!realTimeEnabled)}
                  className={`flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition-colors ${
                    realTimeEnabled
                      ? 'bg-green-100 text-green-700 border border-green-200'
                      : 'bg-gray-100 text-gray-600 border border-gray-200'
                  }`}
                >
                  <Activity className="h-4 w-4" />
                  {realTimeEnabled ? 'Live' : 'Manual'}
                </button>
              </div>
            </div>

            {/* Agents Table */}
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    {bulkOperationMode && (
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        <input
                          type="checkbox"
                          checked={selectedAgents.length === filteredAgents.length && filteredAgents.length > 0}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedAgents(filteredAgents.map(a => a._id));
                            } else {
                              setSelectedAgents([]);
                            }
                          }}
                          className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                        />
                      </th>
                    )}
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Agent
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Code
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Contact
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Performance
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Commission Rate
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredAgents.length === 0 && (
                    <tr>
                      <td colSpan={bulkOperationMode ? 8 : 7} className="px-6 py-12 text-center">
                        <div className="text-gray-400 mb-2">
                          <Users className="h-10 w-10 mx-auto" />
                        </div>
                        <p className="text-gray-500 font-medium">No travel agents found</p>
                        <p className="text-gray-400 text-sm mt-1">
                          {searchTerm || filterStatus !== 'all' ? 'Try adjusting your filters' : 'Get started by adding your first travel agent'}
                        </p>
                        {!searchTerm && filterStatus === 'all' && (
                          <button onClick={() => navigate('/admin/travel-agents/new')} className="mt-3 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700">
                            + Add Agent
                          </button>
                        )}
                      </td>
                    </tr>
                  )}
                  {filteredAgents.map((agent) => (
                    <tr
                      key={agent._id}
                      className={`hover:bg-gray-50 ${
                        selectedAgents.includes(agent._id) ? 'bg-indigo-50' : ''
                      }`}
                    >
                      {bulkOperationMode && (
                        <td className="px-6 py-4 whitespace-nowrap">
                          <input
                            type="checkbox"
                            checked={selectedAgents.includes(agent._id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedAgents(prev => [...prev, agent._id]);
                              } else {
                                setSelectedAgents(prev => prev.filter(id => id !== agent._id));
                              }
                            }}
                            className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                          />
                        </td>
                      )}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            {agent.companyName}
                          </p>
                          <p className="text-sm text-gray-500">
                            {agent.contactPerson}
                          </p>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="font-mono text-sm text-gray-900">
                          {agent.agentCode}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <p className="text-sm text-gray-900">{agent.email}</p>
                          <p className="text-sm text-gray-500">{agent.phone}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            {agent.performanceMetrics?.totalBookings || 0} bookings
                          </p>
                          <p className="text-sm text-gray-500">
                            ₹{agent.performanceMetrics?.totalRevenue?.toLocaleString() || '0'} revenue
                          </p>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <p className="text-sm font-medium text-gray-900">
                          {agent.commissionStructure?.defaultRate ?? 0}%
                        </p>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(agent.status)}`}>
                          {getStatusIcon(agent.status)}
                          <span className="ml-1">{(agent.status || 'unknown').replace(/_/g, ' ')}</span>
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex items-center gap-2">
                          <button aria-label="View"
                            onClick={() => navigate(`/admin/travel-agents/${agent._id}`)}
                            className="text-indigo-600 hover:text-indigo-900"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          <button aria-label="Edit"
                            onClick={() => navigate(`/admin/travel-agents/${agent._id}/edit`)}
                            className="text-gray-600 hover:text-gray-900"
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                          {agent.status === 'active' ? (
                            <button aria-label="Suspend agent"
                              onClick={() => handleStatusUpdate(agent._id, 'suspended')}
                              className="text-red-600 hover:text-red-900"
                            >
                              <Ban className="h-4 w-4" />
                            </button>
                          ) : (
                            <button aria-label="Activate agent"
                              onClick={() => handleStatusUpdate(agent._id, 'active')}
                              className="text-green-600 hover:text-green-900"
                            >
                              <CheckCircle className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Commissions Tab */}
        {selectedTab === 'commissions' && pendingCommissions && (
          <div className="space-y-6">
            {/* Commission Summary */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Commission Overview</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="text-center p-4 border border-gray-200 rounded-lg">
                  <p className="text-gray-600 text-sm">Total Pending</p>
                  <p className="text-2xl font-bold text-gray-900 mt-2">
                    ₹{((pendingCommissions?.summary as Record<string, unknown>)?.totalPendingAmount as number || 0).toLocaleString()}
                  </p>
                </div>
                <div className="text-center p-4 border border-yellow-200 rounded-lg bg-yellow-50">
                  <p className="text-gray-600 text-sm">Bookings with Pending</p>
                  <p className="text-2xl font-bold text-yellow-600 mt-2">
                    {(pendingCommissions?.summary as Record<string, unknown>)?.totalBookings as number || (pendingCommissions?.commissions as unknown[])?.length || 0}
                  </p>
                </div>
                <div className="text-center p-4 border border-blue-200 rounded-lg bg-blue-50">
                  <p className="text-gray-600 text-sm">Average Commission</p>
                  <p className="text-2xl font-bold text-blue-600 mt-2">
                    ₹{Math.round((pendingCommissions?.summary as Record<string, unknown>)?.averageCommission as number || 0).toLocaleString()}
                  </p>
                </div>
              </div>
            </div>

            {/* Pending Commissions List */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold text-gray-900">Pending Commission Payments</h2>
                <button
                  onClick={() => handleExportData({ format: 'csv', includeCharts: false, includeRawData: true, includeSummary: true, fileName: 'commission-report' })}
                  className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  <Download className="h-5 w-5" />
                  Export
                </button>
              </div>
              <div className="space-y-4">
                {(!pendingCommissions?.commissions || (pendingCommissions.commissions as unknown[]).length === 0) && (
                  <div className="text-center py-8 text-gray-500">
                    <p className="font-medium">No pending commissions</p>
                    <p className="text-sm mt-1">All commission payments are up to date.</p>
                  </div>
                )}
                {(pendingCommissions?.commissions as Array<Record<string, unknown>> || []).map((commission: Record<string, unknown>) => {
                  const bookingId = (commission._id || commission.agentId || '') as string;
                  const agentInfo = commission.travelAgentId as Record<string, unknown> | undefined;
                  const agentName = (agentInfo?.companyName || commission.agentName || 'Unknown Agent') as string;
                  const commissionObj = (commission.commission || {}) as Record<string, unknown>;
                  const commissionAmount = (commissionObj.totalCommission || commission.totalAmount || 0) as number;
                  const createdAt = commission.createdAt as string | undefined;

                  return (
                    <div key={bookingId} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-medium text-gray-900">{agentName}</p>
                          <p className="text-sm text-gray-600 mt-1">
                            Booking: {(commission.confirmationNumber || bookingId) as string}
                          </p>
                          {createdAt && (
                            <p className="text-sm text-gray-600">
                              Created: {format(new Date(createdAt), 'MMM dd, yyyy')}
                            </p>
                          )}
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-semibold text-gray-900">
                            ₹{commissionAmount.toLocaleString()}
                          </p>
                          <button
                            onClick={async () => {
                              if (window.confirm(`Process ₹${commissionAmount.toLocaleString()} commission for ${agentName}?`)) {
                                try {
                                  await travelAgentService.updateBookingCommissionStatus(bookingId, 'paid');
                                  toast.success(`Commission payment processed for ${agentName}`);
                                  fetchDashboardData();
                                } catch {
                                  toast.error(`Failed to process commission for ${agentName}`);
                                }
                              }
                            }}
                            className="mt-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm"
                          >
                            Process Payment
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Analytics Tab */}
        {selectedTab === 'analytics' && (
          <div className="space-y-6">
            {/* Analytics Header */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                    <BarChart3 className="h-5 w-5" />
                    System-wide Analytics
                  </h2>
                  <p className="text-gray-600 mt-1">
                    Comprehensive insights across all travel agents and bookings
                  </p>
                </div>
                <div className="flex gap-2">
                  <DateRangeSelector
                    value={dateRange}
                    onChange={setDateRange}
                  />
                  <button aria-label="Toggle live updates"
                    onClick={() => setRealTimeEnabled(!realTimeEnabled)}
                    className={`px-3 py-2 text-sm rounded-lg transition-colors ${
                      realTimeEnabled
                        ? 'bg-green-100 text-green-700 border border-green-200'
                        : 'bg-gray-100 text-gray-600 border border-gray-200'
                    }`}
                  >
                    {realTimeEnabled ? 'Live Updates On' : 'Live Updates Off'}
                  </button>
                  <button
                    onClick={() => setShowExportModal(true)}
                    className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <Download className="h-4 w-4" />
                    Export Analytics
                  </button>
                </div>
              </div>
            </div>

            {/* Analytics Cards */}
            {(() => {
              const bookingBreakdown = (analytics?.bookingStatusBreakdown || []) as Array<{ _id: string; count: number; revenue: number }>;
              const commissionTiers = (analytics?.commissionTiers || []) as Array<{ _id: string; count: number; totalCommission: number; avgRate: number }>;
              const stayMetrics = (analytics?.averageStayMetrics || { avgNights: 0, avgRooms: 0, avgGuests: 0 }) as { avgNights: number; avgRooms: number; avgGuests: number };
              const totalBookings = bookingBreakdown.reduce((sum, s) => sum + (s.count || 0), 0);
              const confirmedBookings = bookingBreakdown.find(s => s._id === 'confirmed')?.count || 0;
              const avgCommission = commissionTiers.length > 0
                ? commissionTiers.reduce((sum, t) => sum + (t.avgRate || 0), 0) / commissionTiers.length
                : 0;

              return (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <div className="bg-white p-6 rounded-lg shadow-sm">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-gray-600 text-sm">Total Bookings</p>
                        <p className="text-2xl font-bold text-gray-900 mt-2">
                          {totalBookings}
                        </p>
                        <p className="text-sm text-green-600 mt-1">last 30 days</p>
                      </div>
                      <TrendingUp className="h-8 w-8 text-green-600" />
                    </div>
                  </div>

                  <div className="bg-white p-6 rounded-lg shadow-sm">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-gray-600 text-sm">Average Commission</p>
                        <p className="text-2xl font-bold text-gray-900 mt-2">
                          {avgCommission.toFixed(1)}%
                        </p>
                        <p className="text-sm text-gray-600 mt-1">across all agents</p>
                      </div>
                      <Award className="h-8 w-8 text-purple-600" />
                    </div>
                  </div>

                  <div className="bg-white p-6 rounded-lg shadow-sm">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-gray-600 text-sm">Confirmed Bookings</p>
                        <p className="text-2xl font-bold text-gray-900 mt-2">
                          {confirmedBookings}
                        </p>
                        <p className="text-sm text-blue-600 mt-1">confirmed status</p>
                      </div>
                      <BarChart3 className="h-8 w-8 text-blue-600" />
                    </div>
                  </div>

                  <div className="bg-white p-6 rounded-lg shadow-sm">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-gray-600 text-sm">Avg Stay Duration</p>
                        <p className="text-2xl font-bold text-gray-900 mt-2">
                          {(stayMetrics.avgNights || 0).toFixed(1)} nights
                        </p>
                        <p className="text-sm text-indigo-600 mt-1">average stay</p>
                      </div>
                      <Users className="h-8 w-8 text-indigo-600" />
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* System Performance Chart */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">System Performance Overview</h2>
              
              {analytics ? (
                (() => {
                  const bookingBreakdown = (analytics.bookingStatusBreakdown || []) as Array<{ _id: string; count: number; revenue: number }>;
                  const paymentBreakdown = (analytics.paymentStatusBreakdown || []) as Array<{ _id: string; count: number; amount: number }>;
                  const seasonality = (analytics.seasonalityAnalysis || []) as Array<{ _id: string; count: number; revenue: number; avgCommission: number }>;
                  const leadTimes = (analytics.leadTimeAnalysis || []) as Array<{ _id: string; count: number; avgLeadTime: number }>;

                  return (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Booking Status Breakdown */}
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h3 className="text-md font-semibold text-gray-900 mb-3">Booking Status Breakdown</h3>
                    <div className="space-y-2">
                      {bookingBreakdown.length === 0 && (
                        <p className="text-sm text-gray-500">No booking data available</p>
                      )}
                      {bookingBreakdown.map((status) => (
                        <div key={status._id || 'unknown'} className="flex justify-between items-center">
                          <span className="text-sm text-gray-600 capitalize">{status._id || 'unknown'}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-gray-900">{status.count ?? 0}</span>
                            <span className="text-xs text-gray-500">₹{(status.revenue ?? 0).toLocaleString()}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Payment Status Breakdown */}
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h3 className="text-md font-semibold text-gray-900 mb-3">Payment Status Breakdown</h3>
                    <div className="space-y-2">
                      {paymentBreakdown.length === 0 && (
                        <p className="text-sm text-gray-500">No payment data available</p>
                      )}
                      {paymentBreakdown.map((payment) => (
                        <div key={payment._id || 'unknown'} className="flex justify-between items-center">
                          <span className="text-sm text-gray-600 capitalize">{payment._id || 'unknown'}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-gray-900">{payment.count ?? 0}</span>
                            <span className="text-xs text-gray-500">₹{(payment.amount ?? 0).toLocaleString()}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Seasonality Analysis */}
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h3 className="text-md font-semibold text-gray-900 mb-3">Seasonality Analysis</h3>
                    <div className="space-y-2">
                      {seasonality.length === 0 && (
                        <p className="text-sm text-gray-500">No seasonality data available</p>
                      )}
                      {seasonality.map((season) => (
                        <div key={season._id || 'unknown'} className="flex justify-between items-center">
                          <span className="text-sm text-gray-600 capitalize">{season._id || 'unknown'}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-gray-900">{season.count ?? 0}</span>
                            <span className="text-xs text-gray-500">₹{(season.revenue ?? 0).toLocaleString()}</span>
                            <span className="text-xs text-blue-600">{(season.avgCommission ?? 0).toFixed(1)}%</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Lead Time Analysis */}
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h3 className="text-md font-semibold text-gray-900 mb-3">Lead Time Analysis</h3>
                    <div className="space-y-2">
                      {leadTimes.length === 0 && (
                        <p className="text-sm text-gray-500">No lead time data available</p>
                      )}
                      {leadTimes.map((leadTime) => (
                        <div key={leadTime._id || 'unknown'} className="flex justify-between items-center">
                          <span className="text-sm text-gray-600">{leadTime._id || 'unknown'}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-gray-900">{leadTime.count ?? 0}</span>
                            <span className="text-xs text-gray-500">{(leadTime.avgLeadTime ?? 0).toFixed(1)} days avg</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                  );
                })()
              ) : (
                <div className="h-80 flex items-center justify-center bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                  <div className="text-center">
                    <BarChart3 className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500 text-lg font-medium">Loading Analytics...</p>
                    <p className="text-gray-400 text-sm mt-2">
                      Fetching system-wide performance metrics
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Comparative Analytics Tab */}
        {selectedTab === 'comparative' && (
          <div className="space-y-6">
            {/* Comparative Header */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                    <Target className="h-5 w-5" />
                    Agent Performance Comparison
                  </h2>
                  <p className="text-gray-600 mt-1">
                    Compare performance metrics across different travel agents
                  </p>
                </div>
                <div className="flex gap-2">
                  <select
                    multiple
                    value={selectedAgents}
                    onChange={(e) => {
                      const values = Array.from(e.target.selectedOptions, option => option.value);
                      setSelectedAgents(values);
                    }}
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 min-w-48"
                    size={4}
                  >
                    {(agents || []).map(agent => (
                      <option key={agent._id} value={agent._id}>
                        {agent.companyName}
                      </option>
                    ))}
                  </select>
                  <div className="flex flex-col gap-2">
                    <button
                      onClick={() => setTimeRange('month')}
                      className={`px-3 py-1 text-sm rounded transition-colors ${
                        timeRange === 'month' ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-700'
                      }`}
                    >
                      Month
                    </button>
                    <button
                      onClick={() => setTimeRange('quarter')}
                      className={`px-3 py-1 text-sm rounded transition-colors ${
                        timeRange === 'quarter' ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-700'
                      }`}
                    >
                      Quarter
                    </button>
                    <button
                      onClick={() => setTimeRange('year')}
                      className={`px-3 py-1 text-sm rounded transition-colors ${
                        timeRange === 'year' ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-700'
                      }`}
                    >
                      Year
                    </button>
                  </div>
                </div>
              </div>
              {selectedAgents.length === 0 && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-blue-800 text-sm">
                    Select one or more agents from the dropdown to view comparative analytics
                  </p>
                </div>
              )}
            </div>

            {/* Agent Performance Leaderboard */}
            {comparativeData.agentPerformance.length > 0 && (
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Performance Leaderboard</h3>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    {comparativeData.agentPerformance
                      .sort((a, b) => b.performanceScore - a.performanceScore)
                      .slice(0, 5)
                      .map((agent, index) => (
                        <div key={agent.agentId} className="flex items-center gap-4 p-4 border border-gray-200 rounded-lg">
                          <div className={`flex items-center justify-center w-8 h-8 rounded-full font-bold ${
                            index === 0 ? 'bg-yellow-100 text-yellow-800' :
                            index === 1 ? 'bg-gray-100 text-gray-800' :
                            index === 2 ? 'bg-orange-100 text-orange-800' :
                            'bg-blue-100 text-blue-800'
                          }`}>
                            #{index + 1}
                          </div>
                          <div className="flex-1">
                            <p className="font-medium text-gray-900">{agent.agentName}</p>
                            <p className="text-sm text-gray-600">
                              {agent.bookingCount} bookings • ₹{agent.revenue.toLocaleString()} revenue
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold text-gray-900">{agent.performanceScore}</p>
                            <p className="text-sm text-gray-600">Score</p>
                          </div>
                        </div>
                      ))}
                  </div>

                  {/* Performance Metrics Chart */}
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h3 className="text-md font-semibold text-gray-900 mb-3">Performance Comparison Chart</h3>
                    <div className="space-y-3">
                      {comparativeData.agentPerformance
                        .sort((a, b) => b.revenue - a.revenue)
                        .slice(0, 5)
                        .map((agent, index) => (
                          <div key={agent.agentId} className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className={`w-3 h-3 rounded-full ${
                                index === 0 ? 'bg-yellow-500' :
                                index === 1 ? 'bg-gray-400' :
                                index === 2 ? 'bg-orange-500' :
                                'bg-blue-500'
                              }`}></div>
                              <span className="text-sm font-medium text-gray-900">{agent.agentName}</span>
                            </div>
                            <div className="flex items-center gap-4 text-sm">
                              <span className="text-gray-600">{agent.bookingCount} bookings</span>
                              <span className="text-gray-600">₹{agent.revenue.toLocaleString()}</span>
                              <span className="text-gray-600">{agent.performanceScore} score</span>
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Export Modal */}
        <ExportOptionsModal
          isOpen={showExportModal}
          onClose={() => setShowExportModal(false)}
          onExport={handleExportData}
          availableFields={[
            { key: 'agentCode', label: 'Agent Code' },
            { key: 'companyName', label: 'Company Name' },
            { key: 'contactPerson', label: 'Contact Person' },
            { key: 'email', label: 'Email' },
            { key: 'phone', label: 'Phone' },
            { key: 'status', label: 'Status' },
            { key: 'totalBookings', label: 'Total Bookings' },
            { key: 'totalRevenue', label: 'Total Revenue' },
            { key: 'commissionRate', label: 'Commission Rate' },
            { key: 'performance', label: 'Performance Metrics' }
          ]}
          currentFilters={filterCriteria}
          currentDateRange={dateRange}
        />
      </div>
    </div>
  );
};

export default withErrorBoundary(AdminTravelDashboard, { level: 'page' });