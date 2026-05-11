import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, 
  Users, 
  Bed, 
  IndianRupee, 
  Calendar,
  BarChart3,
  PieChart,
  Activity,
  RefreshCw,
  Download,
  Filter,
  AlertCircle,
  FileText,
  FileSpreadsheet
} from 'lucide-react';
import { api } from '../../services/api';

interface KPIMetric {
  label: string;
  value: number | string;
  change: number;
  changeType: 'increase' | 'decrease' | 'neutral';
  format: 'currency' | 'percentage' | 'number' | 'decimal';
}

interface DashboardData {
  kpis: {
    revenue: KPIMetric;
    occupancy: KPIMetric;
    adr: KPIMetric;
    revpar: KPIMetric;
    bookings: KPIMetric;
    cancellations: KPIMetric;
  };
  revenueByChannel: Array<{
    channel: string;
    revenue: number;
    percentage: number;
  }>;
  occupancyTrends: Array<{
    date: string;
    occupancy: number;
    revenue: number;
  }>;
  guestSegmentation: Array<{
    segment: string;
    count: number;
    revenue: number;
  }>;
  topPerformingRooms: Array<{
    roomType: string;
    revenue: number;
    occupancy: number;
  }>;
  alerts: Array<{
    id: string;
    type: 'warning' | 'error' | 'info';
    message: string;
    timestamp: string;
  }>;
  trends?: {
    revenue: Array<{date: string, value: number}>;
    occupancy: Array<{date: string, value: number}>;
    adr: Array<{date: string, value: number}>;
  };
  forecasts?: {
    revenue: {nextWeek: number, nextMonth: number};
    occupancy: {nextWeek: number, nextMonth: number};
  };
  comparisons?: {
    previousPeriod: {
      revenue: number;
      occupancy: number;
      adr: number;
    };
    yearOverYear: {
      revenue: number;
      occupancy: number;
      adr: number;
    };
  };
  operationalMetrics?: {
    todaysCheckins: number;
    currentOccupancy: number;
    todaysCheckouts: number;
    todaysRevenue: number;
    availableRooms: number;
  };
}

const ExecutiveDashboard: React.FC = () => {
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState('30d');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [cacheStatus, setCacheStatus] = useState<{cached: boolean, cacheAge?: number}>({cached: false});
  const [userRole, setUserRole] = useState<string>('admin');

  const [notifications, setNotifications] = useState<Array<{id: string, message: string, type: string, timestamp: Date}>>([]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await api.get(`/analytics/dashboard/metrics?period=${selectedPeriod}`);

      if (response.data && response.data.success) {
        const result = response.data;

        setDashboardData(result.data);
        setLastUpdated(new Date());

        // Update cache status
        if (result.metadata) {
          setCacheStatus({
            cached: result.metadata.cached || false,
            cacheAge: result.metadata.cacheAge
          });
        }
      }
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } }; message?: string };
      setError(err.response?.data?.message || err.message || 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const fetchRealtimeKPIs = async () => {
    try {
      const { data: result } = await api.get('/analytics/kpis/realtime');
      if (result.success && result.data) {
        // Update only the real-time metrics without full reload
        if (dashboardData) {
          setDashboardData(prev => ({
            ...prev!,
            kpis: {
              ...prev!.kpis,
              revenue: {
                ...prev!.kpis.revenue,
                value: result.data.today.revenue
              },
              occupancy: {
                ...prev!.kpis.occupancy,
                value: result.data.today.occupancy.occupancy_rate
              },
              adr: {
                ...prev!.kpis.adr,
                value: result.data.today.adr
              },
              revpar: {
                ...prev!.kpis.revpar,
                value: result.data.today.revpar
              }
            }
          }));
        }
      }
    } catch (error) {
      // Don't log real-time KPI errors to avoid noise
      // Don't set error state for real-time updates to avoid disrupting main dashboard
    }
  };

  useEffect(() => {
    fetchDashboardData();

    // Get user role from localStorage or context
    const storedUser = localStorage.getItem('user');

    if (storedUser) {
      try {
        const user = JSON.parse(storedUser);
        setUserRole(user.role || 'staff');
      } catch (error) {
        setUserRole('staff');
      }
    }
  }, [selectedPeriod]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (autoRefresh) {
      // Refresh real-time KPIs every 5 minutes
      interval = setInterval(fetchRealtimeKPIs, 5 * 60 * 1000);
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoRefresh, dashboardData]);

  const formatValue = (value: number | string, format: string): string => {
    // Handle null, undefined, or invalid values
    if (value === null || value === undefined || value === '') {
      return format === 'currency' ? '₹0' : format === 'percentage' ? '0.0%' : '0';
    }
    
    if (typeof value === 'string') {
      const numValue = parseFloat(value);
      if (isNaN(numValue)) return '0';
      value = numValue;
    }
    
    // Ensure value is a number
    if (typeof value !== 'number' || isNaN(value)) {
      return format === 'currency' ? '₹0' : format === 'percentage' ? '0.0%' : '0';
    }
    
    switch (format) {
      case 'currency':
        return new Intl.NumberFormat('en-IN', {
          style: 'currency',
          currency: 'INR',
          minimumFractionDigits: 0,
          maximumFractionDigits: 0
        }).format(value);
      case 'percentage':
        return `${Math.max(0, Math.min(100, value)).toFixed(1)}%`;
      case 'decimal':
        return value.toFixed(2);
      default:
        return value.toString();
    }
  };

  const getChangeIcon = (changeType: string) => {
    switch (changeType) {
      case 'increase':
        return <TrendingUp className="h-4 w-4 text-green-500" />;
      case 'decrease':
        return <TrendingUp className="h-4 w-4 text-red-500 rotate-180" />;
      default:
        return <Activity className="h-4 w-4 text-gray-400" />;
    }
  };

  const exportReport = async (format: 'pdf' | 'csv' | 'excel' = 'pdf') => {
    try {
      setLoading(true);
      
      const response = await api.post('/analytics/reports/executive-summary', {
          parameters: {
            period: selectedPeriod,
            export_format: format,
            include_charts: format === 'pdf',
            include_raw_data: format !== 'pdf'
          }
        }, { responseType: 'blob' });

      const blob = response.data;
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `executive-dashboard-${selectedPeriod}-${new Date().toISOString().split('T')[0]}.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error: unknown) {
      setError(`Failed to export report: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  if (loading && !dashboardData) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-blue-600" />
        <span className="ml-2 text-gray-600">Loading dashboard...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6 p-6">
        <div className="bg-red-50 border-l-4 border-red-400 p-4 rounded-md">
          <div className="flex">
            <AlertCircle className="h-5 w-5 text-red-400" />
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">
                Error Loading Dashboard
              </h3>
              <div className="mt-2 text-sm text-red-700">
                <p>{error}</p>
              </div>
              <div className="mt-4">
                <button
                  onClick={fetchDashboardData}
                  className="bg-red-100 hover:bg-red-200 text-red-800 px-4 py-2 rounded-md text-sm font-medium"
                >
                  Try Again
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Executive Dashboard</h1>
          <p className="text-gray-600 mt-1 flex items-center space-x-4">
            <span>Last updated: {lastUpdated.toLocaleTimeString()}</span>
            {cacheStatus.cached && (
              <span className="flex items-center text-green-600">
                <Activity className="h-3 w-3 mr-1" />
                Cached ({Math.round((cacheStatus.cacheAge || 0) / 1000)}s ago)
              </span>
            )}
          </p>
        </div>
        
        <div className="flex items-center space-x-4">
          <select
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
            <option value="1y">Last year</option>
          </select>
          
          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700">Auto-refresh</span>
          </label>
          
          <button
            onClick={fetchDashboardData}
            disabled={loading}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          
          <div className="relative group">
            <button
              onClick={() => exportReport('pdf')}
              className="flex items-center px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
            >
              <Download className="h-4 w-4 mr-2" />
              Export
            </button>
            
            {/* Export format dropdown */}
            <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg z-10 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200">
              <div className="py-1">
                <button
                  onClick={() => exportReport('pdf')}
                  className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                >
                  <FileText className="h-4 w-4 mr-2" />
                  Export as PDF
                </button>
                <button
                  onClick={() => exportReport('csv')}
                  className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                >
                  <FileSpreadsheet className="h-4 w-4 mr-2" />
                  Export as CSV
                </button>
                <button
                  onClick={() => exportReport('excel')}
                  className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                >
                  <FileSpreadsheet className="h-4 w-4 mr-2" />
                  Export as Excel
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Alerts */}
      {dashboardData?.alerts && dashboardData.alerts.length > 0 && (
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-md">
          <div className="flex">
            <AlertCircle className="h-5 w-5 text-yellow-400" />
            <div className="ml-3">
              <h3 className="text-sm font-medium text-yellow-800">
                System Alerts ({dashboardData.alerts.length})
              </h3>
              <div className="mt-2 text-sm text-yellow-700">
                {dashboardData.alerts.slice(0, 3).map((alert) => (
                  <div key={alert.id} className="mt-1">
                    • {alert.message}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6">
        {dashboardData?.kpis && Object.entries(dashboardData.kpis).map(([key, metric]) => (
          <div key={key} className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-600 uppercase tracking-wide">
                  {metric.label}
                </p>
                <p className="text-2xl font-bold text-gray-900 mt-2">
                  {formatValue(metric.value, metric.format)}
                </p>
                <div className="flex items-center mt-2">
                  {getChangeIcon(metric.changeType)}
                  <span className={`ml-1 text-sm font-medium ${
                    metric.changeType === 'increase' ? 'text-green-600' : 
                    metric.changeType === 'decrease' ? 'text-red-600' : 'text-gray-600'
                  }`}>
                    {Math.abs(metric.change)}% vs last period
                  </span>
                </div>
              </div>
              <div className="ml-4">
                {key === 'revenue' && <IndianRupee className="h-8 w-8 text-green-500" />}
                {key === 'occupancy' && <Bed className="h-8 w-8 text-blue-500" />}
                {key === 'adr' && <TrendingUp className="h-8 w-8 text-purple-500" />}
                {key === 'revpar' && <BarChart3 className="h-8 w-8 text-orange-500" />}
                {key === 'bookings' && <Users className="h-8 w-8 text-indigo-500" />}
                {key === 'cancellations' && <Calendar className="h-8 w-8 text-red-500" />}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue by Channel */}
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Revenue by Channel</h3>
            <PieChart className="h-5 w-5 text-gray-400" />
          </div>
          <div className="space-y-4">
            {dashboardData?.revenueByChannel?.map((channel, index) => (
              <div key={channel.channel} className="flex items-center justify-between">
                <div className="flex items-center">
                  <div 
                    className="w-3 h-3 rounded-full mr-3"
                    style={{ backgroundColor: `hsl(${index * 60}, 70%, 50%)` }}
                  ></div>
                  <span className="text-sm font-medium text-gray-700 capitalize">
                    {channel.channel}
                  </span>
                </div>
                <div className="text-right">
                  <div className="text-sm font-semibold text-gray-900">
                    {formatValue(channel.revenue, 'currency')}
                  </div>
                  <div className="text-xs text-gray-500">
                    {channel.percentage?.toFixed(1) || '0.0'}%
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Guest Segmentation */}
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Guest Segmentation</h3>
            <Users className="h-5 w-5 text-gray-400" />
          </div>
          <div className="space-y-4">
            {dashboardData?.guestSegmentation?.map((segment, index) => (
              <div key={segment.segment} className="flex items-center justify-between">
                <div className="flex items-center">
                  <div 
                    className="w-3 h-3 rounded-full mr-3"
                    style={{ backgroundColor: `hsl(${index * 90}, 70%, 60%)` }}
                  ></div>
                  <span className="text-sm font-medium text-gray-700 capitalize">
                    {segment.segment}
                  </span>
                </div>
                <div className="text-right">
                  <div className="text-sm font-semibold text-gray-900">
                    {segment.count} guests
                  </div>
                  <div className="text-xs text-gray-500">
                    {formatValue(segment.revenue, 'currency')}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Performance Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Top Performing Room Types</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Room Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Revenue
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Occupancy Rate
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Performance
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {dashboardData?.topPerformingRooms?.map((room, index) => (
                <tr key={room.roomType}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {room.roomType}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatValue(room.revenue, 'currency')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatValue(room.occupancy, 'percentage')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-1 bg-gray-200 rounded-full h-2 mr-2">
                        <div
                          className="bg-gradient-to-r from-green-400 to-blue-500 h-2 rounded-full"
                          style={{ width: `${Math.min(room.occupancy, 100)}%` }}
                        ></div>
                      </div>
                      <span className="text-sm text-gray-600">
                        {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : ''}
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Advanced Analytics Section - Admin/Manager Only */}
      {dashboardData?.trends && (userRole === 'admin' || userRole === 'manager') && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Trend Analysis</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-blue-50 rounded-lg">
              <h4 className="font-medium text-blue-900 mb-2">Revenue Trend</h4>
              <div className="text-2xl font-bold text-blue-600">
                {dashboardData?.trends?.revenue && dashboardData.trends.revenue.length > 0 && 
                  formatValue(dashboardData.trends.revenue[dashboardData.trends.revenue.length - 1].value, 'currency')
                }
              </div>
              <p className="text-sm text-blue-700">Last 7 days</p>
            </div>
            <div className="p-4 bg-green-50 rounded-lg">
              <h4 className="font-medium text-green-900 mb-2">Occupancy Trend</h4>
              <div className="text-2xl font-bold text-green-600">
                {dashboardData?.trends?.occupancy && dashboardData.trends.occupancy.length > 0 && 
                  `${dashboardData.trends.occupancy[dashboardData.trends.occupancy.length - 1]?.value?.toFixed(1) || '0.0'}%`
                }
              </div>
              <p className="text-sm text-green-700">Last 7 days</p>
            </div>
            <div className="p-4 bg-purple-50 rounded-lg">
              <h4 className="font-medium text-purple-900 mb-2">ADR Trend</h4>
              <div className="text-2xl font-bold text-purple-600">
                {dashboardData?.trends?.adr && dashboardData.trends.adr.length > 0 && 
                  formatValue(dashboardData.trends.adr[dashboardData.trends.adr.length - 1].value, 'currency')
                }
              </div>
              <p className="text-sm text-purple-700">Last 7 days</p>
            </div>
          </div>
        </div>
      )}

      {/* Forecasting Section - Admin/Manager Only */}
      {dashboardData?.forecasts && (userRole === 'admin' || userRole === 'manager') && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Forecasting</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg">
              <h4 className="font-medium text-gray-900 mb-3">Revenue Forecast</h4>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Next Week:</span>
                  <span className="font-semibold text-blue-600">
                    {dashboardData?.forecasts?.revenue && formatValue(dashboardData.forecasts.revenue.nextWeek, 'currency')}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Next Month:</span>
                  <span className="font-semibold text-blue-600">
                    {dashboardData?.forecasts?.revenue && formatValue(dashboardData.forecasts.revenue.nextMonth, 'currency')}
                  </span>
                </div>
              </div>
            </div>
            <div className="p-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg">
              <h4 className="font-medium text-gray-900 mb-3">Occupancy Forecast</h4>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Next Week:</span>
                  <span className="font-semibold text-green-600">
                    {dashboardData?.forecasts?.occupancy?.nextWeek?.toFixed(1) || '0.0'}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Next Month:</span>
                  <span className="font-semibold text-green-600">
                    {dashboardData?.forecasts?.occupancy?.nextMonth?.toFixed(1) || '0.0'}%
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Comparative Analysis - Admin/Manager Only */}
      {dashboardData?.comparisons && (userRole === 'admin' || userRole === 'manager') && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Comparative Analysis</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-4 bg-gray-50 rounded-lg">
              <h4 className="font-medium text-gray-900 mb-3">Previous Period Comparison</h4>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Revenue Change:</span>
                  <span className={`font-semibold ${dashboardData?.comparisons?.previousPeriod?.revenue && dashboardData.comparisons.previousPeriod.revenue >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {dashboardData?.comparisons?.previousPeriod?.revenue && dashboardData.comparisons.previousPeriod.revenue >= 0 ? '+' : ''}{dashboardData?.comparisons?.previousPeriod?.revenue?.toFixed(1) || '0.0'}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Occupancy Change:</span>
                  <span className={`font-semibold ${dashboardData?.comparisons?.previousPeriod?.occupancy && dashboardData.comparisons.previousPeriod.occupancy >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {dashboardData?.comparisons?.previousPeriod?.occupancy && dashboardData.comparisons.previousPeriod.occupancy >= 0 ? '+' : ''}{dashboardData?.comparisons?.previousPeriod?.occupancy?.toFixed(1) || '0.0'}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">ADR Change:</span>
                  <span className={`font-semibold ${dashboardData?.comparisons?.previousPeriod?.adr && dashboardData.comparisons.previousPeriod.adr >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {dashboardData?.comparisons?.previousPeriod?.adr && dashboardData.comparisons.previousPeriod.adr >= 0 ? '+' : ''}{dashboardData?.comparisons?.previousPeriod?.adr?.toFixed(1) || '0.0'}%
                  </span>
                </div>
              </div>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <h4 className="font-medium text-gray-900 mb-3">Year Over Year</h4>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Revenue Change:</span>
                  <span className={`font-semibold ${dashboardData?.comparisons?.yearOverYear?.revenue && dashboardData.comparisons.yearOverYear.revenue >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {dashboardData?.comparisons?.yearOverYear?.revenue && dashboardData.comparisons.yearOverYear.revenue >= 0 ? '+' : ''}{dashboardData?.comparisons?.yearOverYear?.revenue?.toFixed(1) || '0.0'}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Occupancy Change:</span>
                  <span className={`font-semibold ${dashboardData?.comparisons?.yearOverYear?.occupancy && dashboardData.comparisons.yearOverYear.occupancy >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {dashboardData?.comparisons?.yearOverYear?.occupancy && dashboardData.comparisons.yearOverYear.occupancy >= 0 ? '+' : ''}{dashboardData?.comparisons?.yearOverYear?.occupancy?.toFixed(1) || '0.0'}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">ADR Change:</span>
                  <span className={`font-semibold ${dashboardData?.comparisons?.yearOverYear?.adr && dashboardData.comparisons.yearOverYear.adr >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {dashboardData?.comparisons?.yearOverYear?.adr && dashboardData.comparisons.yearOverYear.adr >= 0 ? '+' : ''}{dashboardData?.comparisons?.yearOverYear?.adr?.toFixed(1) || '0.0'}%
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Staff-Specific Operational Metrics */}
      {userRole === 'staff' && dashboardData?.operationalMetrics && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Operational Overview</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 bg-blue-50 rounded-lg">
              <h4 className="font-medium text-blue-900 mb-2">Today's Check-ins</h4>
              <div className="text-2xl font-bold text-blue-600">
                {dashboardData?.operationalMetrics?.todaysCheckins}
              </div>
              <p className="text-sm text-blue-700">Expected arrivals</p>
            </div>
            <div className="p-4 bg-green-50 rounded-lg">
              <h4 className="font-medium text-green-900 mb-2">Current Occupancy</h4>
              <div className="text-2xl font-bold text-green-600">
                {dashboardData?.operationalMetrics?.currentOccupancy && formatValue(dashboardData.operationalMetrics.currentOccupancy, 'percentage')}
              </div>
              <p className="text-sm text-green-700">Rooms occupied</p>
            </div>
            <div className="p-4 bg-yellow-50 rounded-lg">
              <h4 className="font-medium text-yellow-900 mb-2">Check-outs Today</h4>
              <div className="text-2xl font-bold text-yellow-600">
                {dashboardData?.operationalMetrics?.todaysCheckouts}
              </div>
              <p className="text-sm text-yellow-700">Expected departures</p>
            </div>
            <div className="p-4 bg-purple-50 rounded-lg">
              <h4 className="font-medium text-purple-900 mb-2">Available Rooms</h4>
              <div className="text-2xl font-bold text-purple-600">
                {dashboardData?.operationalMetrics?.availableRooms}
              </div>
              <p className="text-sm text-purple-700">Ready for check-in</p>
            </div>
          </div>
          
          <div className="mt-6 p-4 bg-gray-50 rounded-lg">
            <h4 className="font-medium text-gray-900 mb-3">Quick Actions</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <button className="p-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                View Check-ins
              </button>
              <button className="p-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors">
                Room Status
              </button>
              <button className="p-3 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors">
                Check-outs
              </button>
              <button className="p-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors">
                Reports
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExecutiveDashboard;