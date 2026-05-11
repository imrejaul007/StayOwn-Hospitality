import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import {
  X,
  BarChart3,
  TrendingUp,
  Users,
  Activity,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Calendar,
  Download,
  Filter
} from 'lucide-react';
import { toast } from 'react-hot-toast';

interface UserAnalyticsProps {
  onClose: () => void;
}

interface AnalyticsData {
  totalUsers: number;
  activeUsers: number;
  inactiveUsers: number;
  guests: number;
  staff: number;
  admins: number;
  managers: number;
  engagementRate: number;
  loyaltyRate: number;
  monthlyTrends: Array<{
    month: string;
    total: number;
    active: number;
    byRole: { [key: string]: number };
  }>;
  recentUsers: Array<{
    _id: string;
    name: string;
    email: string;
    role: string;
    createdAt: string;
  }>;
  topUsers: Array<{
    _id: string;
    name: string;
    email: string;
    role: string;
    activityCount: number;
    lastActivity: string;
  }>;
}

interface ActivityMetrics {
  totalActivities: number;
  uniqueUserCount: number;
  loginActivities: number;
  logoutActivities: number;
  profileUpdates: number;
  averageActivitiesPerUser: number;
  hourlyPatterns: Array<{ hour: number; count: number }>;
  actionDistribution: Array<{ action: string; count: number }>;
  userEngagement: {
    totalUsers: number;
    highEngagement: number;
    mediumEngagement: number;
    lowEngagement: number;
    averageEngagement: number;
  };
}

interface PerformanceMetrics {
  totalUsers: number;
  activeUsers: number;
  highlyActiveUsers: number;
  averageActivityPerUser: number;
  averageLoginsPerUser: number;
  usersWithRecentActivity: number;
  usersWithOldActivity: number;
  activityRate: number;
  highActivityRate: number;
  recentActivityRate: number;
  rolePerformance: Record<string, unknown>;
  topPerformers: Array<{
    _id: string;
    name: string;
    email: string;
    role: string;
    loginCount: number;
    performanceScore: number;
  }>;
}

const UserAnalytics: React.FC<UserAnalyticsProps> = ({ onClose }) => {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [activityMetrics, setActivityMetrics] = useState<ActivityMetrics | null>(null);
  const [performanceMetrics, setPerformanceMetrics] = useState<PerformanceMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'activity' | 'performance'>('overview');
  const [dateRange, setDateRange] = useState('');

  useEffect(() => {
    fetchAnalytics();
  }, [dateRange]);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      
      const queryParams = new URLSearchParams();
      if (dateRange) {
        queryParams.append('dateRange', dateRange);
      }

      const [analyticsRes, activityRes, performanceRes] = await Promise.all([
        api.get(`/user-management/analytics?${queryParams}`),
        api.get(`/user-management/analytics/activity?${queryParams}`),
        api.get(`/user-management/analytics/performance?${queryParams}`)
      ]);

      setAnalytics(analyticsRes.data.data);
      setActivityMetrics(activityRes.data.data);
      setPerformanceMetrics(performanceRes.data.data);
    } catch (error) {
      toast.error('Failed to fetch analytics data');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    try {
      const queryParams = new URLSearchParams();
      queryParams.append('format', 'csv');
      if (dateRange) queryParams.append('dateRange', dateRange);

      const { data: blob } = await api.get(`/user-management/analytics/export?${queryParams}`, {
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'user_analytics.csv';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success('Analytics exported successfully');
    } catch (error) {
      toast.error('Failed to export analytics');
    }
  };

  const getRoleIcon = (role: string) => {
    const icons = {
      guest: '👤',
      staff: '👨‍💼',
      admin: '👑',
      manager: '🎯'
    };
    return icons[role as keyof typeof icons] || '👤';
  };

  const getRoleColor = (role: string) => {
    const colors = {
      guest: 'bg-blue-500',
      staff: 'bg-green-500',
      admin: 'bg-purple-500',
      manager: 'bg-orange-500'
    };
    return colors[role as keyof typeof colors] || 'bg-gray-500';
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
        <div className="relative top-20 mx-auto p-5 border w-11/12 md:w-4/5 lg:w-3/4 shadow-lg rounded-md bg-white">
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-2 text-gray-600">Loading analytics...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-10 mx-auto p-5 border w-11/12 md:w-4/5 lg:w-3/4 shadow-lg rounded-md bg-white">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center">
            <BarChart3 className="w-6 h-6 text-blue-600 mr-2" />
            <h3 className="text-lg font-medium text-gray-900">User Analytics Dashboard</h3>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={handleExport}
              className="flex items-center px-3 py-1 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              <Download className="w-4 h-4 mr-1" />
              Export
            </button>
            <button aria-label="Close"
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Date Range Filter */}
        <div className="mb-6">
          <div className="flex items-center space-x-4">
            <div className="flex items-center">
              <Calendar className="w-4 h-4 text-gray-500 mr-2" />
              <label className="text-sm font-medium text-gray-700">Date Range:</label>
            </div>
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="px-3 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Time</option>
              <option value='{"start":"2024-01-01","end":"2024-12-31"}'>2024</option>
              <option value='{"start":"2024-01-01","end":"2024-03-31"}'>Q1 2024</option>
              <option value='{"start":"2024-04-01","end":"2024-06-30"}'>Q2 2024</option>
              <option value='{"start":"2024-07-01","end":"2024-09-30"}'>Q3 2024</option>
              <option value='{"start":"2024-10-01","end":"2024-12-31"}'>Q4 2024</option>
            </select>
          </div>
        </div>

        {/* Tabs */}
        <div className="mb-6">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              {[
                { id: 'overview', label: 'Overview', icon: BarChart3 },
                { id: 'activity', label: 'Activity', icon: Activity },
                { id: 'performance', label: 'Performance', icon: TrendingUp }
              ].map((tab) => {
                const Icon = tab.icon;
                return (
                  <button aria-label="Close"
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as unknown)}
                    className={`flex items-center py-2 px-1 border-b-2 font-medium text-sm ${
                      activeTab === tab.id
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    <Icon className="w-4 h-4 mr-2" />
                    {tab.label}
                  </button>
                );
              })}
            </nav>
          </div>
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && analytics && (
          <div className="space-y-6">
            {/* Key Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-blue-50 p-4 rounded-lg">
                <div className="flex items-center">
                  <Users className="w-8 h-8 text-blue-600" />
                  <div className="ml-3">
                    <p className="text-sm font-medium text-blue-600">Total Users</p>
                    <p className="text-2xl font-bold text-blue-900">{analytics.totalUsers}</p>
                  </div>
                </div>
              </div>
              <div className="bg-green-50 p-4 rounded-lg">
                <div className="flex items-center">
                  <CheckCircle className="w-8 h-8 text-green-600" />
                  <div className="ml-3">
                    <p className="text-sm font-medium text-green-600">Active Users</p>
                    <p className="text-2xl font-bold text-green-900">{analytics.activeUsers}</p>
                  </div>
                </div>
              </div>
              <div className="bg-purple-50 p-4 rounded-lg">
                <div className="flex items-center">
                  <Activity className="w-8 h-8 text-purple-600" />
                  <div className="ml-3">
                    <p className="text-sm font-medium text-purple-600">Engagement Rate</p>
                    <p className="text-2xl font-bold text-purple-900">{analytics.engagementRate.toFixed(1)}%</p>
                  </div>
                </div>
              </div>
              <div className="bg-orange-50 p-4 rounded-lg">
                <div className="flex items-center">
                  <TrendingUp className="w-8 h-8 text-orange-600" />
                  <div className="ml-3">
                    <p className="text-sm font-medium text-orange-600">Loyalty Rate</p>
                    <p className="text-2xl font-bold text-orange-900">{analytics.loyaltyRate.toFixed(1)}%</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Role Distribution */}
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h4 className="text-lg font-medium text-gray-900 mb-4">User Role Distribution</h4>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {[
                  { role: 'guest', count: analytics.guests, label: 'Guests' },
                  { role: 'staff', count: analytics.staff, label: 'Staff' },
                  { role: 'admin', count: analytics.admins, label: 'Admins' },
                  { role: 'manager', count: analytics.managers, label: 'Managers' }
                ].map(({ role, count, label }) => {
                  const percentage = analytics.totalUsers > 0 ? (count / analytics.totalUsers) * 100 : 0;
                  return (
                    <div key={role} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center">
                          <span className="text-2xl mr-2">{getRoleIcon(role)}</span>
                          <h5 className="text-sm font-medium text-gray-900">{label}</h5>
                        </div>
                        <div className="text-sm text-gray-500">
                          {count} ({percentage.toFixed(1)}%)
                        </div>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${getRoleColor(role)}`}
                          style={{ width: `${percentage}%` }}
                        ></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Recent Users */}
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h4 className="text-lg font-medium text-gray-900 mb-4">Recent Users</h4>
              <div className="space-y-3">
                {analytics.recentUsers.slice(0, 5).map((user) => (
                  <div key={user._id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center">
                      <div className="h-8 w-8 rounded-full bg-gray-300 flex items-center justify-center mr-3">
                        <span className="text-sm font-medium text-gray-700">
                          {user.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">{user.name}</p>
                        <p className="text-xs text-gray-500">{user.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                        user.role === 'guest' ? 'bg-blue-100 text-blue-800' :
                        user.role === 'staff' ? 'bg-green-100 text-green-800' :
                        user.role === 'admin' ? 'bg-purple-100 text-purple-800' :
                        'bg-orange-100 text-orange-800'
                      }`}>
                        {getRoleIcon(user.role)} {user.role}
                      </span>
                      <span className="text-xs text-gray-500">
                        {new Date(user.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Activity Tab */}
        {activeTab === 'activity' && activityMetrics && (
          <div className="space-y-6">
            {/* Activity Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-blue-50 p-4 rounded-lg">
                <div className="flex items-center">
                  <Activity className="w-8 h-8 text-blue-600" />
                  <div className="ml-3">
                    <p className="text-sm font-medium text-blue-600">Total Activities</p>
                    <p className="text-2xl font-bold text-blue-900">{activityMetrics.totalActivities}</p>
                  </div>
                </div>
              </div>
              <div className="bg-green-50 p-4 rounded-lg">
                <div className="flex items-center">
                  <Users className="w-8 h-8 text-green-600" />
                  <div className="ml-3">
                    <p className="text-sm font-medium text-green-600">Active Users</p>
                    <p className="text-2xl font-bold text-green-900">{activityMetrics.uniqueUserCount}</p>
                  </div>
                </div>
              </div>
              <div className="bg-purple-50 p-4 rounded-lg">
                <div className="flex items-center">
                  <CheckCircle className="w-8 h-8 text-purple-600" />
                  <div className="ml-3">
                    <p className="text-sm font-medium text-purple-600">Logins</p>
                    <p className="text-2xl font-bold text-purple-900">{activityMetrics.loginActivities}</p>
                  </div>
                </div>
              </div>
              <div className="bg-orange-50 p-4 rounded-lg">
                <div className="flex items-center">
                  <TrendingUp className="w-8 h-8 text-orange-600" />
                  <div className="ml-3">
                    <p className="text-sm font-medium text-orange-600">Avg per User</p>
                    <p className="text-2xl font-bold text-orange-900">{activityMetrics.averageActivitiesPerUser.toFixed(1)}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Action Distribution */}
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h4 className="text-lg font-medium text-gray-900 mb-4">Action Distribution</h4>
              <div className="space-y-3">
                {activityMetrics.actionDistribution.map(({ action, count }) => {
                  const percentage = activityMetrics.totalActivities > 0 ? (count / activityMetrics.totalActivities) * 100 : 0;
                  return (
                    <div key={action} className="flex items-center justify-between">
                      <div className="flex items-center">
                        <span className="text-sm font-medium text-gray-700 capitalize">
                          {action.replace('_', ' ')}
                        </span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="text-sm text-gray-500">{count}</span>
                        <div className="w-32 bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-blue-500 h-2 rounded-full"
                            style={{ width: `${percentage}%` }}
                          ></div>
                        </div>
                        <span className="text-xs text-gray-500 w-8">
                          {percentage.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* User Engagement */}
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h4 className="text-lg font-medium text-gray-900 mb-4">User Engagement Levels</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                  { level: 'High', count: activityMetrics.userEngagement.highEngagement, color: 'bg-green-500' },
                  { level: 'Medium', count: activityMetrics.userEngagement.mediumEngagement, color: 'bg-yellow-500' },
                  { level: 'Low', count: activityMetrics.userEngagement.lowEngagement, color: 'bg-red-500' }
                ].map(({ level, count, color }) => {
                  const percentage = activityMetrics.userEngagement.totalUsers > 0 ? (count / activityMetrics.userEngagement.totalUsers) * 100 : 0;
                  return (
                    <div key={level} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h5 className="text-sm font-medium text-gray-900">{level} Engagement</h5>
                        <div className="text-sm text-gray-500">
                          {count} ({percentage.toFixed(1)}%)
                        </div>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${color}`}
                          style={{ width: `${percentage}%` }}
                        ></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Performance Tab */}
        {activeTab === 'performance' && performanceMetrics && (
          <div className="space-y-6">
            {/* Performance Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-blue-50 p-4 rounded-lg">
                <div className="flex items-center">
                  <Users className="w-8 h-8 text-blue-600" />
                  <div className="ml-3">
                    <p className="text-sm font-medium text-blue-600">Total Users</p>
                    <p className="text-2xl font-bold text-blue-900">{performanceMetrics.totalUsers}</p>
                  </div>
                </div>
              </div>
              <div className="bg-green-50 p-4 rounded-lg">
                <div className="flex items-center">
                  <Activity className="w-8 h-8 text-green-600" />
                  <div className="ml-3">
                    <p className="text-sm font-medium text-green-600">Activity Rate</p>
                    <p className="text-2xl font-bold text-green-900">{performanceMetrics.activityRate.toFixed(1)}%</p>
                  </div>
                </div>
              </div>
              <div className="bg-purple-50 p-4 rounded-lg">
                <div className="flex items-center">
                  <TrendingUp className="w-8 h-8 text-purple-600" />
                  <div className="ml-3">
                    <p className="text-sm font-medium text-purple-600">High Activity</p>
                    <p className="text-2xl font-bold text-purple-900">{performanceMetrics.highActivityRate.toFixed(1)}%</p>
                  </div>
                </div>
              </div>
              <div className="bg-orange-50 p-4 rounded-lg">
                <div className="flex items-center">
                  <Clock className="w-8 h-8 text-orange-600" />
                  <div className="ml-3">
                    <p className="text-sm font-medium text-orange-600">Recent Activity</p>
                    <p className="text-2xl font-bold text-orange-900">{performanceMetrics.recentActivityRate.toFixed(1)}%</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Top Performers */}
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h4 className="text-lg font-medium text-gray-900 mb-4">Top Performing Users</h4>
              <div className="space-y-3">
                {performanceMetrics.topPerformers.slice(0, 10).map((user, index) => (
                  <div key={user._id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center mr-3">
                        <span className="text-sm font-bold text-blue-600">#{index + 1}</span>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">{user.name}</p>
                        <p className="text-xs text-gray-500">{user.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-4">
                      <div className="text-right">
                        <p className="text-sm font-medium text-gray-900">{user.loginCount} logins</p>
                        <p className="text-xs text-gray-500">Score: {user.performanceScore.toFixed(1)}</p>
                      </div>
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                        user.role === 'guest' ? 'bg-blue-100 text-blue-800' :
                        user.role === 'staff' ? 'bg-green-100 text-green-800' :
                        user.role === 'admin' ? 'bg-purple-100 text-purple-800' :
                        'bg-orange-100 text-orange-800'
                      }`}>
                        {getRoleIcon(user.role)} {user.role}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Role Performance */}
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h4 className="text-lg font-medium text-gray-900 mb-4">Performance by Role</h4>
              <div className="space-y-4">
                {Object.entries(performanceMetrics.rolePerformance).map(([role, data]) => (
                  <div key={role} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center">
                        <span className="text-2xl mr-2">{getRoleIcon(role)}</span>
                        <h5 className="text-sm font-medium text-gray-900 capitalize">{role}</h5>
                      </div>
                      <div className="text-sm text-gray-500">
                        {data.total} users
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs text-gray-500">Avg Activity</p>
                        <p className="text-sm font-medium text-gray-900">{data.averageActivity.toFixed(1)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Avg Logins</p>
                        <p className="text-sm font-medium text-gray-900">{data.averageLogins.toFixed(1)}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default UserAnalytics;
