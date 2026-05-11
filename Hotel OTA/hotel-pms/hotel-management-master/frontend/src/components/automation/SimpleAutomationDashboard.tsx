import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { api } from '../../services/api';
import { toast } from '../../utils/toast';
import {
  Zap,
  Clock,
  CheckCircle,
  AlertTriangle,
  Activity,
  TrendingUp,
  Play,
  Pause,
  RefreshCw,
  Loader2
} from 'lucide-react';

interface DashboardStatistics {
  totalAutomations: number;
  successRate: number;
  avgProcessingTime: number;
  statusBreakdown: Array<{
    status: string;
    count: number;
    avgProcessingTime: number;
  }>;
}

interface AutomationConfig {
  isEnabled: boolean;
  isLaundryAutomationEnabled: boolean;
  isInventoryAutomationEnabled: boolean;
  isHousekeepingAutomationEnabled: boolean;
}

interface RecentLog {
  _id: string;
  bookingId?: { _id: string; bookingNumber?: string } | string;
  roomId?: { _id: string; roomNumber?: string } | string;
  automationType: string;
  status: string;
  processedAt: string;
  completedAt?: string;
  processingTime?: number;
  initiatedBy?: { _id: string; name?: string; email?: string } | string;
}

interface PendingAutomation {
  _id: string;
  bookingNumber?: string;
  automationStatus: string;
  automationTriggeredAt?: string;
}

interface DashboardData {
  period: string;
  dateRange: { start: string; end: string };
  statistics: DashboardStatistics;
  recentLogs: RecentLog[];
  failedAutomations: RecentLog[];
  pendingAutomations: PendingAutomation[];
}

const SimpleAutomationDashboard: React.FC = () => {
  const queryClient = useQueryClient();
  const [period, setPeriod] = useState<'today' | 'week' | 'month'>('today');

  // Fetch automation config
  const {
    data: configData,
    isLoading: configLoading,
    error: configError,
  } = useQuery({
    queryKey: ['checkout-automation-config'],
    queryFn: async () => {
      const response = await api.get('/checkout-automation/config');
      return response.data?.data?.config as AutomationConfig;
    },
    staleTime: 30_000,
    retry: 1,
  });

  // Fetch dashboard data
  const {
    data: dashboardData,
    isLoading: dashboardLoading,
    error: dashboardError,
  } = useQuery({
    queryKey: ['checkout-automation-dashboard', period],
    queryFn: async () => {
      const response = await api.get('/checkout-automation/dashboard', {
        params: { period },
      });
      return response.data?.data as DashboardData;
    },
    staleTime: 30_000,
    placeholderData: keepPreviousData,
    retry: 1,
  });

  // Toggle automation mutation
  const toggleMutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      const response = await api.post('/checkout-automation/toggle', { enabled });
      return response.data;
    },
    onSuccess: (_data, enabled) => {
      queryClient.invalidateQueries({ queryKey: ['checkout-automation-config'] });
      queryClient.invalidateQueries({ queryKey: ['checkout-automation-dashboard'] });
      toast.success(`Automation ${enabled ? 'enabled' : 'disabled'} successfully`);
    },
    onError: () => {
      toast.error('Failed to toggle automation');
    },
  });

  const isLoading = configLoading || dashboardLoading;
  const error = configError || dashboardError;
  const isEnabled = configData?.isEnabled ?? false;
  const stats = dashboardData?.statistics ?? {
    totalAutomations: 0,
    successRate: 0,
    avgProcessingTime: 0,
    statusBreakdown: [],
  };
  const recentLogs = dashboardData?.recentLogs ?? [];
  const pendingAutomations = dashboardData?.pendingAutomations ?? [];
  const failedAutomations = dashboardData?.failedAutomations ?? [];

  const avgTimeSeconds =
    stats.totalAutomations > 0
      ? Math.round((stats.avgProcessingTime ?? 0) / 1000)
      : 0;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'text-green-600 bg-green-100';
      case 'started':
      case 'in_progress':
        return 'text-blue-600 bg-blue-100';
      case 'partial_success':
        return 'text-yellow-600 bg-yellow-100';
      case 'failed':
        return 'text-red-600 bg-red-100';
      case 'cancelled':
        return 'text-gray-600 bg-gray-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4" />;
      case 'started':
      case 'in_progress':
        return <Clock className="h-4 w-4" />;
      case 'partial_success':
      case 'failed':
        return <AlertTriangle className="h-4 w-4" />;
      default:
        return <Clock className="h-4 w-4" />;
    }
  };

  const formatLogLabel = (log: RecentLog): { booking: string; room: string } => {
    const booking =
      typeof log.bookingId === 'object' && log.bookingId !== null
        ? log.bookingId.bookingNumber ?? log.bookingId._id
        : (log.bookingId as string) ?? 'N/A';
    const room =
      typeof log.roomId === 'object' && log.roomId !== null
        ? log.roomId.roomNumber ?? log.roomId._id
        : (log.roomId as string) ?? 'N/A';
    return { booking, room };
  };

  const formatTime = (dateStr?: string) => {
    if (!dateStr) return 'N/A';
    try {
      const d = new Date(dateStr);
      const now = new Date();
      const diffMs = now.getTime() - d.getTime();
      const diffMin = Math.floor(diffMs / 60000);
      if (diffMin < 1) return 'Just now';
      if (diffMin < 60) return `${diffMin}m ago`;
      const diffHours = Math.floor(diffMin / 60);
      if (diffHours < 24) return `${diffHours}h ago`;
      const diffDays = Math.floor(diffHours / 24);
      return `${diffDays}d ago`;
    } catch {
      return 'N/A';
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/30 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-10 w-10 animate-spin text-blue-500 mx-auto mb-4" />
          <p className="text-gray-600">Loading automation data...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/30 flex items-center justify-center">
        <div className="text-center max-w-md">
          <AlertTriangle className="h-10 w-10 text-red-500 mx-auto mb-4" />
          <p className="text-gray-900 font-semibold text-lg mb-2">Failed to load automation data</p>
          <p className="text-gray-600 text-sm mb-4">
            {(error as Error)?.message || 'An unexpected error occurred.'}
          </p>
          <button
            onClick={() => {
              queryClient.invalidateQueries({ queryKey: ['checkout-automation-config'] });
              queryClient.invalidateQueries({ queryKey: ['checkout-automation-dashboard'] });
            }}
            className="px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors text-sm"
          >
            <RefreshCw className="h-4 w-4 mr-2 inline" />
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/30">
      <div className="p-3 sm:p-4 md:p-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="relative mb-8">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-600/10 via-indigo-600/10 to-purple-600/10 rounded-3xl blur-3xl"></div>
          <div className="relative bg-white/80 backdrop-blur-sm border border-white/20 rounded-3xl p-4 sm:p-6 lg:p-8 shadow-xl">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 sm:gap-6">
              <div className="flex-1">
                <div className="flex items-center gap-3 sm:gap-4 mb-4">
                  <div className="p-2 sm:p-3 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-2xl">
                    <Zap className="h-6 w-6 sm:h-8 sm:w-8 text-white" />
                  </div>
                  <div>
                    <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent">
                      Automation Dashboard
                    </h1>
                    <p className="text-gray-600 text-sm sm:text-base mt-2">
                      Monitor and control automatic checkout processing
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4">
                {/* Period selector */}
                <select
                  value={period}
                  onChange={(e) => setPeriod(e.target.value as 'today' | 'week' | 'month')}
                  className="px-3 py-2 rounded-xl border border-gray-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                  aria-label="Select time period"
                >
                  <option value="today">Today</option>
                  <option value="week">This Week</option>
                  <option value="month">This Month</option>
                </select>

                <button
                  aria-label="Toggle automation"
                  onClick={() => toggleMutation.mutate(!isEnabled)}
                  disabled={toggleMutation.isPending}
                  className={`px-4 sm:px-6 py-2 sm:py-3 rounded-2xl font-semibold transition-all duration-200 transform hover:scale-105 text-xs sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed ${
                    isEnabled
                      ? 'bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white shadow-lg'
                      : 'bg-gradient-to-r from-gray-500 to-gray-600 hover:from-gray-600 hover:to-gray-700 text-white shadow-lg'
                  }`}
                >
                  {toggleMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin inline mr-2" />
                  ) : isEnabled ? (
                    <Pause className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2 inline" />
                  ) : (
                    <Play className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2 inline" />
                  )}
                  {isEnabled ? 'Disable Automation' : 'Enable Automation'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Metrics Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6 mb-6 sm:mb-8">
          {/* Status Card */}
          <div className="bg-white/90 backdrop-blur-sm border-0 shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:scale-[1.02] rounded-3xl p-4 sm:p-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-blue-500/20 to-indigo-500/20 rounded-full -translate-y-10 translate-x-10"></div>
            <div className="relative">
              <div className="flex items-center justify-between mb-4">
                <div className="p-2 sm:p-3 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-2xl">
                  <Zap className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                </div>
                <div className="text-right">
                  <div
                    className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold ${
                      isEnabled ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}
                  >
                    <div
                      className={`w-2 h-2 rounded-full mr-2 ${
                        isEnabled ? 'bg-green-500 animate-pulse' : 'bg-red-500'
                      }`}
                    ></div>
                    {isEnabled ? 'Active' : 'Inactive'}
                  </div>
                </div>
              </div>
              <p className="text-xs sm:text-sm font-semibold text-gray-600">System Status</p>
              <p className="text-xs text-gray-500 mt-1">Real-time monitoring</p>
            </div>
          </div>

          {/* Total Processed Card */}
          <div className="bg-white/90 backdrop-blur-sm border-0 shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:scale-[1.02] rounded-3xl p-4 sm:p-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-green-500/20 to-emerald-500/20 rounded-full -translate-y-10 translate-x-10"></div>
            <div className="relative">
              <div className="flex items-center justify-between mb-4">
                <div className="p-2 sm:p-3 bg-gradient-to-br from-green-500 to-emerald-500 rounded-2xl">
                  <CheckCircle className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                </div>
                <div className="text-right">
                  <p className="text-lg sm:text-2xl font-bold text-gray-900">
                    {stats.totalAutomations}
                  </p>
                </div>
              </div>
              <p className="text-xs sm:text-sm font-semibold text-gray-600">Total Processed</p>
              <p className="text-xs text-gray-500 mt-1">{period === 'today' ? 'Today' : period === 'week' ? 'This week' : 'This month'}</p>
            </div>
          </div>

          {/* Success Rate Card */}
          <div className="bg-white/90 backdrop-blur-sm border-0 shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:scale-[1.02] rounded-3xl p-4 sm:p-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-yellow-500/20 to-amber-500/20 rounded-full -translate-y-10 translate-x-10"></div>
            <div className="relative">
              <div className="flex items-center justify-between mb-4">
                <div className="p-2 sm:p-3 bg-gradient-to-br from-yellow-500 to-amber-500 rounded-2xl">
                  <TrendingUp className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                </div>
                <div className="text-right">
                  <p className="text-lg sm:text-2xl font-bold text-gray-900">
                    {typeof stats.successRate === 'number' && !isNaN(stats.successRate)
                      ? `${Math.round(stats.successRate)}%`
                      : '0%'}
                  </p>
                </div>
              </div>
              <p className="text-xs sm:text-sm font-semibold text-gray-600">Success Rate</p>
              <p className="text-xs text-gray-500 mt-1">Performance metric</p>
            </div>
          </div>

          {/* Average Time Card */}
          <div className="bg-white/90 backdrop-blur-sm border-0 shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:scale-[1.02] rounded-3xl p-4 sm:p-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-purple-500/20 to-violet-500/20 rounded-full -translate-y-10 translate-x-10"></div>
            <div className="relative">
              <div className="flex items-center justify-between mb-4">
                <div className="p-2 sm:p-3 bg-gradient-to-br from-purple-500 to-violet-500 rounded-2xl">
                  <Clock className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                </div>
                <div className="text-right">
                  <p className="text-lg sm:text-2xl font-bold text-gray-900">{avgTimeSeconds}s</p>
                </div>
              </div>
              <p className="text-xs sm:text-sm font-semibold text-gray-600">Avg. Time</p>
              <p className="text-xs text-gray-500 mt-1">Processing duration</p>
            </div>
          </div>
        </div>

        {/* Status Breakdown */}
        {stats.statusBreakdown.length > 0 && (
          <div className="bg-white/90 backdrop-blur-sm border-0 shadow-xl rounded-3xl overflow-hidden mb-6 sm:mb-8">
            <div className="bg-gradient-to-r from-blue-500 to-indigo-500 p-4 sm:p-6">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="p-2 bg-white/20 rounded-xl">
                  <Activity className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
                </div>
                <div>
                  <h2 className="text-lg sm:text-xl font-bold text-white">Status Breakdown</h2>
                  <p className="text-white/80 mt-1 text-sm sm:text-base">
                    Automation results for selected period
                  </p>
                </div>
              </div>
            </div>
            <div className="p-4 sm:p-6">
              <div className="space-y-3 sm:space-y-4">
                {stats.statusBreakdown.map((item) => {
                  const percentage =
                    stats.totalAutomations > 0
                      ? Math.round((item.count / stats.totalAutomations) * 100)
                      : 0;
                  return (
                    <div
                      key={item.status}
                      className="bg-gradient-to-r from-gray-50 to-gray-100/50 rounded-2xl p-3 sm:p-4 border border-gray-200/50 hover:shadow-lg transition-all duration-200 relative overflow-hidden"
                    >
                      {/* Progress indicator */}
                      <div className="absolute top-0 left-0 h-1 w-full bg-gray-200">
                        <div
                          className={`h-full transition-all duration-1000 ${
                            item.status === 'completed'
                              ? 'bg-gradient-to-r from-green-500 to-emerald-500'
                              : item.status === 'partial_success'
                              ? 'bg-gradient-to-r from-yellow-500 to-amber-500'
                              : item.status === 'failed'
                              ? 'bg-gradient-to-r from-red-500 to-rose-500'
                              : 'bg-gradient-to-r from-blue-500 to-indigo-500'
                          }`}
                          style={{ width: `${percentage}%` }}
                        ></div>
                      </div>

                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-0 pt-2">
                        <div className="flex items-center">
                          <div className={`p-2 sm:p-3 rounded-xl ${getStatusColor(item.status)}`}>
                            {getStatusIcon(item.status)}
                          </div>
                          <div className="ml-3 sm:ml-4">
                            <div className="flex items-center gap-2">
                              <h3 className="font-bold text-gray-900 text-sm sm:text-base capitalize">
                                {item.status.replace(/_/g, ' ')}
                              </h3>
                              <span
                                className={`px-2 py-1 rounded-full text-xs font-semibold ${getStatusColor(
                                  item.status
                                )}`}
                              >
                                {item.count} runs
                              </span>
                            </div>
                            <p className="text-xs sm:text-sm text-gray-600">
                              {percentage}% of total automations
                            </p>
                          </div>
                        </div>
                        <div className="text-left sm:text-right">
                          <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4 text-gray-400" />
                            <p className="text-base sm:text-lg font-bold text-gray-900">
                              {item.avgProcessingTime != null && !isNaN(item.avgProcessingTime)
                                ? `${Math.round(item.avgProcessingTime / 1000)}s`
                                : 'N/A'}
                            </p>
                          </div>
                          <p className="text-xs text-gray-500">Avg. duration</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Pending Automations */}
        {pendingAutomations.length > 0 && (
          <div className="bg-white/90 backdrop-blur-sm border-0 shadow-xl rounded-3xl overflow-hidden mb-6 sm:mb-8">
            <div className="bg-gradient-to-r from-yellow-500 to-amber-500 p-4 sm:p-6">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="p-2 bg-white/20 rounded-xl">
                  <Clock className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
                </div>
                <div>
                  <h2 className="text-lg sm:text-xl font-bold text-white">Pending Automations</h2>
                  <p className="text-white/80 mt-1 text-sm sm:text-base">
                    {pendingAutomations.length} automation{pendingAutomations.length !== 1 ? 's' : ''} waiting to complete
                  </p>
                </div>
              </div>
            </div>
            <div className="p-4 sm:p-6">
              <div className="space-y-3">
                {pendingAutomations.map((pa) => (
                  <div
                    key={pa._id}
                    className="bg-gradient-to-r from-yellow-50 to-amber-50/50 rounded-2xl p-3 sm:p-4 border border-yellow-200/50"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-yellow-100 text-yellow-600">
                          <Clock className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900 text-sm">
                            Booking {pa.bookingNumber ?? pa._id}
                          </p>
                          <p className="text-xs text-gray-500 capitalize">
                            {pa.automationStatus?.replace(/_/g, ' ') ?? 'Pending'}
                          </p>
                        </div>
                      </div>
                      <span className="text-xs text-gray-500">
                        {formatTime(pa.automationTriggeredAt)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Failed Automations */}
        {failedAutomations.length > 0 && (
          <div className="bg-white/90 backdrop-blur-sm border-0 shadow-xl rounded-3xl overflow-hidden mb-6 sm:mb-8">
            <div className="bg-gradient-to-r from-red-500 to-rose-500 p-4 sm:p-6">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="p-2 bg-white/20 rounded-xl">
                  <AlertTriangle className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
                </div>
                <div>
                  <h2 className="text-lg sm:text-xl font-bold text-white">Failed Automations</h2>
                  <p className="text-white/80 mt-1 text-sm sm:text-base">
                    {failedAutomations.length} failed in the last 24 hours
                  </p>
                </div>
              </div>
            </div>
            <div className="p-4 sm:p-6">
              <div className="space-y-3">
                {failedAutomations.map((log) => {
                  const labels = formatLogLabel(log);
                  return (
                    <div
                      key={log._id}
                      className="bg-gradient-to-r from-red-50 to-rose-50/50 rounded-2xl p-3 sm:p-4 border border-red-200/50"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-xl bg-red-100 text-red-600">
                            <AlertTriangle className="h-4 w-4" />
                          </div>
                          <div>
                            <p className="font-semibold text-gray-900 text-sm">
                              Booking {labels.booking}
                            </p>
                            <p className="text-xs text-gray-500">Room {labels.room}</p>
                          </div>
                        </div>
                        <span className="text-xs text-gray-500">
                          {formatTime(log.processedAt)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Recent Activity */}
        <div className="bg-white/90 backdrop-blur-sm border-0 shadow-xl rounded-3xl overflow-hidden">
          <div className="bg-gradient-to-r from-green-500 to-emerald-500 p-4 sm:p-6">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="p-2 bg-white/20 rounded-xl">
                <Clock className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
              </div>
              <div>
                <h2 className="text-lg sm:text-xl font-bold text-white">Recent Activity</h2>
                <p className="text-white/80 mt-1 text-sm sm:text-base">Latest automation events</p>
              </div>
            </div>
          </div>
          <div className="p-4 sm:p-6">
            {recentLogs.length === 0 ? (
              <div className="text-center py-12">
                <Activity className="h-10 w-10 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 font-medium">No recent automation activity</p>
                <p className="text-gray-400 text-sm mt-1">
                  Automation logs will appear here after checkouts are processed
                </p>
              </div>
            ) : (
              <div className="space-y-3 sm:space-y-4">
                {recentLogs.map((log, index) => {
                  const labels = formatLogLabel(log);
                  const processingTimeSec =
                    log.processingTime != null && !isNaN(log.processingTime)
                      ? Math.round(log.processingTime / 1000)
                      : null;
                  return (
                    <div
                      key={log._id}
                      className="bg-gradient-to-r from-gray-50 to-gray-100/50 rounded-2xl p-3 sm:p-4 border border-gray-200/50 hover:shadow-lg transition-all duration-200 relative overflow-hidden group"
                    >
                      {/* Timeline indicator */}
                      <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gradient-to-b from-green-500 to-transparent"></div>
                      {index < recentLogs.length - 1 && (
                        <div className="absolute left-6 top-12 bottom-0 w-0.5 bg-gray-200"></div>
                      )}

                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-0">
                        <div className="flex items-center">
                          <div className="relative">
                            <div
                              className={`p-2 sm:p-3 rounded-xl shadow-lg ${getStatusColor(
                                log.status
                              )}`}
                            >
                              {getStatusIcon(log.status)}
                            </div>
                          </div>
                          <div className="ml-3 sm:ml-4">
                            <div className="flex items-center gap-2">
                              <h3 className="font-bold text-gray-900 text-sm sm:text-base">
                                Booking {labels.booking}
                              </h3>
                              <span className="px-2 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">
                                Room {labels.room}
                              </span>
                            </div>
                            <p className="text-xs sm:text-sm text-gray-600 capitalize">
                              {log.automationType?.replace(/_/g, ' ') ?? 'Checkout processing'} -{' '}
                              {log.status?.replace(/_/g, ' ') ?? 'unknown'}
                            </p>
                          </div>
                        </div>
                        <div className="text-left sm:text-right">
                          {processingTimeSec !== null && (
                            <div className="flex items-center gap-2 justify-start sm:justify-end">
                              <Clock className="w-4 h-4 text-gray-400" />
                              <p className="text-base sm:text-lg font-bold text-gray-900">
                                {processingTimeSec}s
                              </p>
                            </div>
                          )}
                          <p className="text-xs text-gray-500">{formatTime(log.processedAt)}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SimpleAutomationDashboard;
