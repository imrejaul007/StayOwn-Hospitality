import React, { useState, useEffect } from 'react';
import {
  Activity,
  Clock,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  Server,
  Database,
  Zap,
  Users,
  RefreshCw,
  Settings,
  BarChart3,
  Gauge
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../context/AuthContext';
import { apiRequest } from '../../services/api';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, PieChart, Pie, Cell } from 'recharts';

interface MonitoringProps {
  className?: string;
}

export const NotificationMonitoring: React.FC<MonitoringProps> = ({
  className = ''
}) => {
  const { user } = useAuth();
  const [refreshInterval, setRefreshInterval] = useState(30000); // 30 seconds
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Fetch monitoring data
  const { data: monitoringData, isLoading, refetch } = useQuery({
    queryKey: ['notification-monitoring'],
    queryFn: async () => {
      const response = await apiRequest('/api/v1/notifications/monitoring/health');
      return response.data;
    },
    refetchInterval: autoRefresh ? refreshInterval : false,
    staleTime: 10000
  });

  // Fetch performance metrics
  const { data: performanceData } = useQuery({
    queryKey: ['notification-performance'],
    queryFn: async () => {
      const response = await apiRequest('/api/v1/notifications/monitoring/performance');
      return response.data;
    },
    refetchInterval: autoRefresh ? refreshInterval : false,
    staleTime: 15000
  });

  // Fetch rate limit status
  const { data: rateLimitData } = useQuery({
    queryKey: ['rate-limit-status'],
    queryFn: async () => {
      const response = await apiRequest('/api/v1/notifications/monitoring/rate-limits');
      return response.data;
    },
    refetchInterval: autoRefresh ? refreshInterval : false,
    staleTime: 5000
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'text-green-600 bg-green-100';
      case 'warning': return 'text-yellow-600 bg-yellow-100';
      case 'error': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy': return <CheckCircle className="w-4 h-4" />;
      case 'warning': return <AlertTriangle className="w-4 h-4" />;
      case 'error': return <AlertTriangle className="w-4 h-4" />;
      default: return <Activity className="w-4 h-4" />;
    }
  };

  const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];

  if (user?.role !== 'admin' && user?.role !== 'manager') {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-orange-500 mx-auto mb-3" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Access Restricted</h3>
          <p className="text-gray-600">You don't have permission to view monitoring data.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Notification System Monitoring</h2>
          <p className="text-gray-600">Real-time monitoring and performance metrics</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="auto-refresh"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <label htmlFor="auto-refresh" className="text-sm text-gray-700">Auto-refresh</label>
          </div>

          <select
            value={refreshInterval}
            onChange={(e) => setRefreshInterval(Number(e.target.value))}
            disabled={!autoRefresh}
            className="px-3 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value={10000}>10s</option>
            <option value={30000}>30s</option>
            <option value={60000}>1m</option>
            <option value={300000}>5m</option>
          </select>

          <button
            onClick={() => refetch()}
            className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-1/2 mb-4"></div>
                <div className="h-8 bg-gray-200 rounded w-1/3 mb-2"></div>
                <div className="h-3 bg-gray-200 rounded w-3/4"></div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <>
          {/* System Health Overview */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Service Status */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Service Status</h3>
                <Server className="w-6 h-6 text-blue-600" />
              </div>

              <div className="space-y-3">
                <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${getStatusColor(monitoringData?.service?.status || 'unknown')}`}>
                  {getStatusIcon(monitoringData?.service?.status || 'unknown')}
                  <span className="font-medium">
                    {monitoringData?.service?.status?.toUpperCase() || 'UNKNOWN'}
                  </span>
                </div>

                <div className="text-sm text-gray-600">
                  Queue Size: {monitoringData?.queue?.size || 0}
                </div>
                <div className="text-sm text-gray-600">
                  Processing: {monitoringData?.queue?.processing ? 'Yes' : 'No'}
                </div>
              </div>
            </div>

            {/* Cache Status */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Cache Status</h3>
                <Database className="w-6 h-6 text-green-600" />
              </div>

              <div className="space-y-3">
                <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${getStatusColor(monitoringData?.cache?.status || 'unknown')}`}>
                  {getStatusIcon(monitoringData?.cache?.status || 'unknown')}
                  <span className="font-medium">
                    {monitoringData?.cache?.connected ? 'CONNECTED' : 'DISCONNECTED'}
                  </span>
                </div>

                {monitoringData?.cache?.latency && (
                  <div className="text-sm text-gray-600">
                    Latency: {monitoringData.cache.latency}ms
                  </div>
                )}
                {monitoringData?.cache?.memory?.keys && (
                  <div className="text-sm text-gray-600">
                    Keys: {monitoringData.cache.memory.keys}
                  </div>
                )}
              </div>
            </div>

            {/* Statistics */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Statistics</h3>
                <BarChart3 className="w-6 h-6 text-purple-600" />
              </div>

              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Sent:</span>
                  <span className="font-semibold text-green-600">
                    {monitoringData?.statistics?.sent || 0}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Failed:</span>
                  <span className="font-semibold text-red-600">
                    {monitoringData?.statistics?.failed || 0}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Rate Limited:</span>
                  <span className="font-semibold text-orange-600">
                    {monitoringData?.statistics?.rateLimited || 0}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Cached:</span>
                  <span className="font-semibold text-blue-600">
                    {monitoringData?.statistics?.cached || 0}
                  </span>
                </div>
              </div>
            </div>

            {/* Rate Limits */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Rate Limits</h3>
                <Gauge className="w-6 h-6 text-orange-600" />
              </div>

              <div className="space-y-3">
                {rateLimitData?.hotel && (
                  <>
                    <div className="text-xs text-gray-500">HOTEL - MINUTE</div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full"
                        style={{
                          width: `${Math.min((rateLimitData.hotel.minute.current / rateLimitData.hotel.minute.limit) * 100, 100)}%`
                        }}
                      ></div>
                    </div>
                    <div className="text-xs text-gray-600">
                      {rateLimitData.hotel.minute.current} / {rateLimitData.hotel.minute.limit}
                    </div>

                    <div className="text-xs text-gray-500 mt-2">HOTEL - HOUR</div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-green-600 h-2 rounded-full"
                        style={{
                          width: `${Math.min((rateLimitData.hotel.hour.current / rateLimitData.hotel.hour.limit) * 100, 100)}%`
                        }}
                      ></div>
                    </div>
                    <div className="text-xs text-gray-600">
                      {rateLimitData.hotel.hour.current} / {rateLimitData.hotel.hour.limit}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Performance Charts */}
          {performanceData && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Notification Volume Chart */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Notification Volume (24h)</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={performanceData.volumeData || []}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="time" />
                    <YAxis />
                    <Tooltip />
                    <Area type="monotone" dataKey="sent" stroke="#3B82F6" fill="#3B82F6" fillOpacity={0.3} />
                    <Area type="monotone" dataKey="delivered" stroke="#10B981" fill="#10B981" fillOpacity={0.3} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* Success Rate Chart */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Delivery Success Rate</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={performanceData.successRateData || []}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="time" />
                    <YAxis domain={[0, 100]} />
                    <Tooltip formatter={(value) => [`${value}%`, 'Success Rate']} />
                    <Line type="monotone" dataKey="rate" stroke="#10B981" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Channel Distribution */}
          {performanceData?.channelData && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-6">Channel Distribution</h3>
              <div className="flex items-center justify-center">
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={performanceData.channelData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {performanceData.channelData.map((entry: Record<string, unknown>, index: number) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Recent Activity */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h3>
            <div className="space-y-3">
              {performanceData?.recentActivity?.map((activity: Record<string, unknown>, index: number) => (
                <div key={`item-${index}`} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${
                      activity.status === 'success' ? 'bg-green-500' :
                      activity.status === 'failed' ? 'bg-red-500' :
                      'bg-yellow-500'
                    }`}></div>
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {activity.type} notification
                      </div>
                      <div className="text-xs text-gray-600">
                        {activity.template} • {activity.channel}
                      </div>
                    </div>
                  </div>
                  <div className="text-xs text-gray-500">
                    {new Date(activity.timestamp).toLocaleTimeString()}
                  </div>
                </div>
              )) || (
                <div className="text-center py-8 text-gray-500">
                  <Activity className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                  <p>No recent activity</p>
                </div>
              )}
            </div>
          </div>

          {/* System Resources */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Memory Usage</h3>
                <Database className="w-5 h-5 text-blue-600" />
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Used:</span>
                  <span className="font-medium">{monitoringData?.cache?.memory?.used || 'N/A'}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Peak:</span>
                  <span className="font-medium">{monitoringData?.cache?.memory?.peak || 'N/A'}</span>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Queue Status</h3>
                <Clock className="w-5 h-5 text-orange-600" />
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Size:</span>
                  <span className="font-medium">{monitoringData?.queue?.size || 0}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Processing:</span>
                  <span className={`font-medium ${monitoringData?.queue?.processing ? 'text-green-600' : 'text-gray-600'}`}>
                    {monitoringData?.queue?.processing ? 'Yes' : 'No'}
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Batches</h3>
                <Zap className="w-5 h-5 text-purple-600" />
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Processed:</span>
                  <span className="font-medium">{monitoringData?.statistics?.batchesProcessed || 0}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Success Rate:</span>
                  <span className="font-medium text-green-600">
                    {monitoringData?.statistics?.sent && monitoringData?.statistics?.failed
                      ? Math.round((monitoringData.statistics.sent / (monitoringData.statistics.sent + monitoringData.statistics.failed)) * 100)
                      : 0}%
                  </span>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default NotificationMonitoring;