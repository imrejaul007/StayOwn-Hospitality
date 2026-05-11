import React, { useState, useEffect } from 'react';
import { 
  BarChart3, 
  TrendingUp, 
  Users, 
  Activity, 
  Target, 
  Zap, 
  Clock, 
  Award,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Download,
  RefreshCw,
  Filter,
  Calendar,
  Eye,
  Brain,
  PieChart,
  LineChart
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import UserEngagementChart from '../../components/analytics/UserEngagementChart';
import UserSegmentation from '../../components/analytics/UserSegmentation';
import PredictiveAnalytics from '../../components/analytics/PredictiveAnalytics';
import { useProperty } from '../../context/PropertyContext';
import { PropertyBreadcrumb } from '../../components/common/PropertyBreadcrumb';
import { api } from '../../services/api';
import { withErrorBoundary } from '../../components/ErrorBoundary';

interface UserAnalytics {
  totalUserCount: number;
  averageEngagementScore: number;
  averageChurnRisk: number;
  averageRetentionScore: number;
  highEngagementUsers: number;
  mediumEngagementUsers: number;
  lowEngagementUsers: number;
  atRiskUsers: number;
  newUsers: number;
  activeUsers: number;
  engagedUsers: number;
  churnedUsers: number;
  engagementRate: number;
  churnRate: number;
  engagementTrends: Array<{
    _id: { year: number; month: number; day: number };
    averageEngagement: number;
    uniqueUserCount: number;
    highEngagementCount: number;
    atRiskCount: number;
  }>;
  topPerformers: Array<{
    _id: string;
    user: { name: string; email: string; role: string };
    averageEngagementScore: number;
    averageChurnRisk: number;
    totalLogins: number;
    totalActions: number;
    segmentTags: string[][];
    lifecycleStage: string;
    engagementLevel: string;
  }>;
  segmentDistribution: Array<{
    segment: string;
    count: number;
    averageEngagement: number;
    averageChurnRisk: number;
  }>;
  lifecycleDistribution: Array<{
    stage: string;
    count: number;
    averageEngagement: number;
  }>;
}

interface BehaviorAnalysis {
  users: Array<{
    _id: string;
    user: { name: string; email: string; role: string };
    averageEngagementScore: number;
    averageChurnRisk: number;
    totalLogins: number;
    totalPageViews: number;
    totalActions: number;
    averageSessionDuration: number;
    behaviorScore: number;
    activityLevel: string;
  }>;
  totalUsers: number;
  averageBehaviorScore: number;
  activityDistribution: {
    high: number;
    medium: number;
    low: number;
  };
}

interface PerformanceMetrics {
  totalUserCount: number;
  averageEfficiencyScore: number;
  averageProductivityScore: number;
  averageAccuracyRate: number;
  averageTaskCompletionRate: number;
  averageResponseTime: number;
  averageErrorRate: number;
  overallPerformanceScore: number;
  performanceTrends: Array<{
    _id: { year: number; month: number; day: number };
    averageEfficiency: number;
    averageProductivity: number;
    averageAccuracy: number;
    averageResponseTime: number;
    averageErrorRate: number;
  }>;
  rolePerformance: Array<{
    role: string;
    count: number;
    averageEfficiency: number;
    averageProductivity: number;
    averageAccuracy: number;
    overallScore: number;
  }>;
  topPerformers: Array<{
    userId: string;
    user: { name: string; email: string; role: string };
    efficiencyScore: number;
    productivityScore: number;
    accuracyRate: number;
    engagementScore: number;
  }>;
}

interface LifecycleAnalysis {
  stages: Array<{
    _id: string;
    users: Array<{ name: string; email: string; role: string }>;
    averageEngagementScore: number;
    averageChurnRisk: number;
    averageRetentionScore: number;
    count: number;
    userCount: number;
  }>;
  transitions: Array<{
    _id: { from: string; to: string };
    count: number;
    averageTransitionTime: string;
  }>;
  totalUsers: number;
  stageDistribution: Array<{
    _id: string;
    userCount: number;
    percentage: number;
  }>;
}

const AdminUserAnalytics: React.FC = () => {
  const { selectedPropertyId, selectedProperty, viewMode } = useProperty();
  const [analytics, setAnalytics] = useState<UserAnalytics | null>(null);
  const [behaviorAnalysis, setBehaviorAnalysis] = useState<BehaviorAnalysis | null>(null);
  const [performanceMetrics, setPerformanceMetrics] = useState<PerformanceMetrics | null>(null);
  const [lifecycleAnalysis, setLifecycleAnalysis] = useState<LifecycleAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'engagement' | 'behavior' | 'performance' | 'lifecycle' | 'predictive'>('overview');
  const [showEngagementChart, setShowEngagementChart] = useState(false);
  const [showSegmentation, setShowSegmentation] = useState(false);
  const [showPredictiveAnalytics, setShowPredictiveAnalytics] = useState(false);

  const [filters, setFilters] = useState({
    dateRange: '',
    userId: '',
    role: '',
    segmentTags: ''
  });

  useEffect(() => {
    if (selectedPropertyId || viewMode === 'all') {
      fetchData();
      const interval = setInterval(fetchData, 60000); // Refresh every minute
      return () => clearInterval(interval);
    }
  }, [filters, selectedPropertyId, viewMode]);

  const fetchData = async () => {
    try {
      setLoading(true);

      const queryParams = new URLSearchParams();
      if (filters.dateRange) queryParams.append('dateRange', filters.dateRange);
      if (filters.userId) queryParams.append('userId', filters.userId);
      if (filters.role) queryParams.append('role', filters.role);
      if (filters.segmentTags) queryParams.append('segmentTags', filters.segmentTags);
      if (selectedPropertyId) queryParams.append('hotelId', selectedPropertyId);

      const [analyticsRes, behaviorRes, performanceRes, lifecycleRes] = await Promise.all([
        api.get(`/user-analytics/engagement?${queryParams}`),
        api.get(`/user-analytics/behavior?${queryParams}`),
        api.get(`/user-analytics/performance?${queryParams}`),
        api.get(`/user-analytics/lifecycle?${queryParams}`)
      ]);

      setAnalytics(analyticsRes.data.data);
      setBehaviorAnalysis(behaviorRes.data.data);

      setPerformanceMetrics(performanceRes.data.data);
      setLifecycleAnalysis(lifecycleRes.data.data);
    } catch (error) {
      toast.error('Failed to fetch user analytics data');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    try {
      const queryParams = new URLSearchParams();
      queryParams.append('format', 'csv');
      if (filters.dateRange) queryParams.append('dateRange', filters.dateRange);

      const response = await api.get(`/user-analytics/export?${queryParams}`, { responseType: 'blob' });
      const blob = response.data;
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

  const getEngagementColor = (score: number) => {
    if (score >= 80) return 'text-green-600 bg-green-100';
    if (score >= 60) return 'text-yellow-600 bg-yellow-100';
    if (score >= 40) return 'text-orange-600 bg-orange-100';
    return 'text-red-600 bg-red-100';
  };

  const getChurnRiskColor = (risk: number) => {
    if (risk >= 70) return 'text-red-600 bg-red-100';
    if (risk >= 40) return 'text-yellow-600 bg-yellow-100';
    return 'text-green-600 bg-green-100';
  };

  const getPerformanceColor = (score: number) => {
    if (score >= 90) return 'text-green-600 bg-green-100';
    if (score >= 80) return 'text-blue-600 bg-blue-100';
    if (score >= 70) return 'text-yellow-600 bg-yellow-100';
    if (score >= 60) return 'text-orange-600 bg-orange-100';
    return 'text-red-600 bg-red-100';
  };

  const getLifecycleColor = (stage: string) => {
    const colors = {
      'new': 'text-blue-600 bg-blue-100',
      'active': 'text-green-600 bg-green-100',
      'engaged': 'text-purple-600 bg-purple-100',
      'at_risk': 'text-yellow-600 bg-yellow-100',
      'churned': 'text-red-600 bg-red-100'
    };
    return colors[stage as keyof typeof colors] || 'text-gray-600 bg-gray-100';
  };

  if (showEngagementChart) {
    return (
      <UserEngagementChart
        analytics={analytics}
        onClose={() => setShowEngagementChart(false)}
      />
    );
  }

  if (showSegmentation) {
    return (
      <UserSegmentation
        analytics={analytics}
        onClose={() => setShowSegmentation(false)}
      />
    );
  }

  if (showPredictiveAnalytics) {
    return (
      <PredictiveAnalytics
        analytics={analytics}
        onClose={() => setShowPredictiveAnalytics(false)}
      />
    );
  }

  // If in single mode and no property selected, show selection prompt
  if (!selectedPropertyId && viewMode === 'single') {
    return (
      <div className="p-6">
        <PropertyBreadcrumb items={['Analytics', 'User Analytics']} />
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <p className="text-gray-600 text-lg">Please select a property to view user analytics</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <PropertyBreadcrumb items={['Analytics', 'User Analytics']} />
      <div className="mb-6 mt-4">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">User Performance & Engagement Analytics</h1>
            <p className="text-gray-600">
              Comprehensive user analytics and performance insights
              {selectedProperty && ` - ${selectedProperty.name}`}
            </p>
          </div>
          <div className="flex space-x-3">
            <button
              onClick={() => setShowEngagementChart(true)}
              className="flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              <LineChart className="w-4 h-4 mr-2" />
              Engagement Chart
            </button>
            <button
              onClick={() => setShowSegmentation(true)}
              className="flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              <PieChart className="w-4 h-4 mr-2" />
              Segmentation
            </button>
            <button
              onClick={() => setShowPredictiveAnalytics(true)}
              className="flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              <Brain className="w-4 h-4 mr-2" />
              Predictive Analytics
            </button>
            <button
              onClick={handleExport}
              className="flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              <Download className="w-4 h-4 mr-2" />
              Export
            </button>
            <button
              onClick={fetchData}
              disabled={loading}
              className="flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        {/* Analytics Overview */}
        {analytics && (
          <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-6">
            <div className="bg-white p-4 rounded-lg shadow-sm border">
              <div className="flex items-center">
                <Users className="w-8 h-8 text-blue-600" />
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-600">Total Users</p>
                  <p className="text-2xl font-bold text-gray-900">{analytics.totalUserCount}</p>
                </div>
              </div>
            </div>
            <div className="bg-white p-4 rounded-lg shadow-sm border">
              <div className="flex items-center">
                <TrendingUp className="w-8 h-8 text-green-600" />
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-600">Engagement Rate</p>
                  <p className="text-2xl font-bold text-gray-900">{analytics.engagementRate.toFixed(1)}%</p>
                </div>
              </div>
            </div>
            <div className="bg-white p-4 rounded-lg shadow-sm border">
              <div className="flex items-center">
                <AlertTriangle className="w-8 h-8 text-red-600" />
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-600">Churn Rate</p>
                  <p className="text-2xl font-bold text-gray-900">{analytics.churnRate.toFixed(1)}%</p>
                </div>
              </div>
            </div>
            <div className="bg-white p-4 rounded-lg shadow-sm border">
              <div className="flex items-center">
                <Award className="w-8 h-8 text-purple-600" />
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-600">Avg Engagement</p>
                  <p className="text-2xl font-bold text-gray-900">{analytics.averageEngagementScore.toFixed(1)}</p>
                </div>
              </div>
            </div>
            <div className="bg-white p-4 rounded-lg shadow-sm border">
              <div className="flex items-center">
                <Target className="w-8 h-8 text-orange-600" />
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-600">Avg Performance</p>
                  <p className="text-2xl font-bold text-gray-900">{performanceMetrics?.overallPerformanceScore.toFixed(1) || 0}</p>
                </div>
              </div>
            </div>
            <div className="bg-white p-4 rounded-lg shadow-sm border">
              <div className="flex items-center">
                <CheckCircle className="w-8 h-8 text-indigo-600" />
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-600">Retention Score</p>
                  <p className="text-2xl font-bold text-gray-900">{analytics.averageRetentionScore.toFixed(1)}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="bg-white p-4 rounded-lg shadow-sm border mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Date Range
              </label>
              <select
                value={filters.dateRange}
                onChange={(e) => setFilters({ ...filters, dateRange: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Time</option>
                <option value="365d">Last Year</option>
                <option value="30d">Last 30 Days</option>
                <option value="7d">Last 7 Days</option>
                <option value="1d">Last 24 Hours</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Role
              </label>
              <select
                value={filters.role}
                onChange={(e) => setFilters({ ...filters, role: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Roles</option>
                <option value="admin">Admin</option>
                <option value="manager">Manager</option>
                <option value="staff">Staff</option>
                <option value="guest">Guest</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Segment Tags
              </label>
              <select
                value={filters.segmentTags}
                onChange={(e) => setFilters({ ...filters, segmentTags: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Segments</option>
                <option value='["high_value"]'>High Value</option>
                <option value='["frequent_user"]'>Frequent User</option>
                <option value='["power_user"]'>Power User</option>
                <option value='["at_risk"]'>At Risk</option>
                <option value='["new_user"]'>New User</option>
              </select>
            </div>
            <div className="flex items-end">
              <button
                onClick={() => setFilters({ dateRange: '', userId: '', role: '', segmentTags: '' })}
                className="w-full flex items-center justify-center px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200"
              >
                <Filter className="w-4 h-4 mr-2" />
                Clear
              </button>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="mb-6">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              {[
                { id: 'overview', label: 'Overview', icon: BarChart3 },
                { id: 'engagement', label: 'Engagement', icon: TrendingUp },
                { id: 'behavior', label: 'Behavior', icon: Activity },
                { id: 'performance', label: 'Performance', icon: Target },
                { id: 'lifecycle', label: 'Lifecycle', icon: Clock },
                { id: 'predictive', label: 'Predictive', icon: Brain }
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
            {/* Engagement Distribution */}
            <div className="bg-white shadow-sm rounded-lg border">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-medium text-gray-900">Engagement Distribution</h3>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="text-center">
                    <div className="text-3xl font-bold text-green-600">{analytics.highEngagementUsers}</div>
                    <div className="text-sm text-gray-500">High Engagement</div>
                    <div className="text-xs text-gray-400">
                      {analytics.totalUserCount > 0 ? ((analytics.highEngagementUsers / analytics.totalUserCount) * 100).toFixed(1) : 0}%
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-yellow-600">{analytics.mediumEngagementUsers}</div>
                    <div className="text-sm text-gray-500">Medium Engagement</div>
                    <div className="text-xs text-gray-400">
                      {analytics.totalUserCount > 0 ? ((analytics.mediumEngagementUsers / analytics.totalUserCount) * 100).toFixed(1) : 0}%
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-red-600">{analytics.lowEngagementUsers}</div>
                    <div className="text-sm text-gray-500">Low Engagement</div>
                    <div className="text-xs text-gray-400">
                      {analytics.totalUserCount > 0 ? ((analytics.lowEngagementUsers / analytics.totalUserCount) * 100).toFixed(1) : 0}%
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Lifecycle Distribution */}
            <div className="bg-white shadow-sm rounded-lg border">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-medium text-gray-900">User Lifecycle Distribution</h3>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                  {analytics.lifecycleDistribution.map((stage) => (
                    <div key={stage.stage} className="text-center">
                      <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getLifecycleColor(stage.stage)}`}>
                        {stage.stage.replace('_', ' ')}
                      </div>
                      <div className="text-2xl font-bold text-gray-900 mt-2">{stage.count}</div>
                      <div className="text-xs text-gray-500">
                        {analytics.totalUserCount > 0 ? ((stage.count / analytics.totalUserCount) * 100).toFixed(1) : 0}%
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Top Performers */}
            <div className="bg-white shadow-sm rounded-lg border">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-medium text-gray-900">Top Engaged Users</h3>
              </div>
              <div className="divide-y divide-gray-200">
                {analytics.topPerformers.slice(0, 10).map((user, index) => (
                  <div key={user._id} className="p-6 hover:bg-gray-50">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center mr-3">
                          <span className="text-sm font-bold text-blue-600">#{index + 1}</span>
                        </div>
                        <div>
                          <div className="text-sm font-medium text-gray-900">{user.user.name}</div>
                          <div className="text-sm text-gray-500">{user.user.email}</div>
                          <div className="text-xs text-gray-400">{user.user.role}</div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-4">
                        <div className="text-right">
                          <p className="text-sm font-medium text-gray-900">{user.totalLogins} logins</p>
                          <p className="text-xs text-gray-500">{user.totalActions} actions</p>
                        </div>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getEngagementColor(user.averageEngagementScore)}`}>
                          {user.averageEngagementScore.toFixed(1)}
                        </span>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getChurnRiskColor(user.averageChurnRisk)}`}>
                          Risk: {user.averageChurnRisk.toFixed(1)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Engagement Tab */}
        {activeTab === 'engagement' && analytics && (
          <div className="space-y-6">
            {/* Engagement Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white p-6 rounded-lg shadow-sm border">
                <h4 className="text-lg font-medium text-gray-900 mb-4">Engagement Score Distribution</h4>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">High (80-100)</span>
                    <span className="text-sm font-medium text-gray-900">{analytics.highEngagementUsers}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Medium (60-79)</span>
                    <span className="text-sm font-medium text-gray-900">{analytics.mediumEngagementUsers}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Low (0-59)</span>
                    <span className="text-sm font-medium text-gray-900">{analytics.lowEngagementUsers}</span>
                  </div>
                </div>
              </div>
              <div className="bg-white p-6 rounded-lg shadow-sm border">
                <h4 className="text-lg font-medium text-gray-900 mb-4">Segment Performance</h4>
                <div className="space-y-3">
                  {analytics.segmentDistribution.slice(0, 5).map((segment) => (
                    <div key={segment.segment} className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">{segment.segment.replace('_', ' ')}</span>
                      <div className="flex items-center space-x-2">
                        <span className="text-sm font-medium text-gray-900">{segment.count}</span>
                        <span className={`text-xs px-2 py-1 rounded ${getEngagementColor(segment.averageEngagement)}`}>
                          {segment.averageEngagement.toFixed(1)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Behavior Tab */}
        {activeTab === 'behavior' && behaviorAnalysis && (
          <div className="space-y-6">
            {/* Behavior Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white p-6 rounded-lg shadow-sm border">
                <h4 className="text-lg font-medium text-gray-900 mb-4">Activity Distribution</h4>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">High Activity</span>
                    <span className="text-sm font-medium text-gray-900">{behaviorAnalysis.activityDistribution.high}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Medium Activity</span>
                    <span className="text-sm font-medium text-gray-900">{behaviorAnalysis.activityDistribution.medium}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Low Activity</span>
                    <span className="text-sm font-medium text-gray-900">{behaviorAnalysis.activityDistribution.low}</span>
                  </div>
                </div>
              </div>
              <div className="bg-white p-6 rounded-lg shadow-sm border">
                <h4 className="text-lg font-medium text-gray-900 mb-4">Average Behavior Score</h4>
                <div className="text-center">
                  <div className="text-3xl font-bold text-blue-600">{behaviorAnalysis.averageBehaviorScore.toFixed(1)}</div>
                  <div className="text-sm text-gray-500">Out of 100</div>
                </div>
              </div>
              <div className="bg-white p-6 rounded-lg shadow-sm border">
                <h4 className="text-lg font-medium text-gray-900 mb-4">Total Users Analyzed</h4>
                <div className="text-center">
                  <div className="text-3xl font-bold text-gray-900">{behaviorAnalysis.totalUsers}</div>
                  <div className="text-sm text-gray-500">Users</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Performance Tab */}
        {activeTab === 'performance' && performanceMetrics && (
          <div className="space-y-6">
            {/* Performance Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white p-6 rounded-lg shadow-sm border">
                <h4 className="text-lg font-medium text-gray-900 mb-4">Overall Performance</h4>
                <div className="text-center">
                  <div className="text-3xl font-bold text-blue-600">{performanceMetrics.overallPerformanceScore.toFixed(1)}</div>
                  <div className="text-sm text-gray-500">Out of 100</div>
                </div>
              </div>
              <div className="bg-white p-6 rounded-lg shadow-sm border">
                <h4 className="text-lg font-medium text-gray-900 mb-4">Average Efficiency</h4>
                <div className="text-center">
                  <div className="text-3xl font-bold text-green-600">{performanceMetrics.averageEfficiencyScore.toFixed(1)}</div>
                  <div className="text-sm text-gray-500">Efficiency Score</div>
                </div>
              </div>
              <div className="bg-white p-6 rounded-lg shadow-sm border">
                <h4 className="text-lg font-medium text-gray-900 mb-4">Average Accuracy</h4>
                <div className="text-center">
                  <div className="text-3xl font-bold text-purple-600">{performanceMetrics.averageAccuracyRate.toFixed(1)}</div>
                  <div className="text-sm text-gray-500">Accuracy Rate</div>
                </div>
              </div>
            </div>

            {/* Role Performance */}
            <div className="bg-white shadow-sm rounded-lg border">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-medium text-gray-900">Performance by Role</h3>
              </div>
              <div className="divide-y divide-gray-200">
                {performanceMetrics.rolePerformance.map((role) => (
                  <div key={role.role} className="p-6 hover:bg-gray-50">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-medium text-gray-900 capitalize">{role.role}</div>
                        <div className="text-sm text-gray-500">{role.count} users</div>
                      </div>
                      <div className="flex items-center space-x-4">
                        <div className="text-right">
                          <p className="text-sm text-gray-500">Efficiency</p>
                          <p className="text-sm font-medium text-gray-900">{role.averageEfficiency.toFixed(1)}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-gray-500">Productivity</p>
                          <p className="text-sm font-medium text-gray-900">{role.averageProductivity.toFixed(1)}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-gray-500">Accuracy</p>
                          <p className="text-sm font-medium text-gray-900">{role.averageAccuracy.toFixed(1)}</p>
                        </div>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getPerformanceColor(role.overallScore)}`}>
                          {role.overallScore.toFixed(1)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Lifecycle Tab */}
        {activeTab === 'lifecycle' && lifecycleAnalysis && (
          <div className="space-y-6">
            {/* Lifecycle Stages */}
            <div className="bg-white shadow-sm rounded-lg border">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-medium text-gray-900">User Lifecycle Stages</h3>
              </div>
              <div className="divide-y divide-gray-200">
                {lifecycleAnalysis.stages.map((stage) => (
                  <div key={stage._id} className="p-6 hover:bg-gray-50">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getLifecycleColor(stage._id)}`}>
                          {stage._id.replace('_', ' ')}
                        </span>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">{stage.userCount} users</div>
                          <div className="text-sm text-gray-500">
                            {lifecycleAnalysis.totalUsers > 0 ? ((stage.userCount / lifecycleAnalysis.totalUsers) * 100).toFixed(1) : 0}% of total
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-4">
                        <div className="text-right">
                          <p className="text-sm text-gray-500">Avg Engagement</p>
                          <p className="text-sm font-medium text-gray-900">{stage.averageEngagementScore.toFixed(1)}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-gray-500">Avg Churn Risk</p>
                          <p className="text-sm font-medium text-gray-900">{stage.averageChurnRisk.toFixed(1)}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-gray-500">Avg Retention</p>
                          <p className="text-sm font-medium text-gray-900">{stage.averageRetentionScore.toFixed(1)}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Predictive Tab */}
        {activeTab === 'predictive' && (
          <div className="space-y-6">
            <div className="bg-white shadow-sm rounded-lg border">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-medium text-gray-900">Predictive Analytics</h3>
              </div>
              <div className="p-6">
                <div className="text-center">
                  <Brain className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500">Click "Predictive Analytics" button to view detailed predictive insights</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {loading && (
          <div className="flex justify-center items-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-2 text-gray-600">Loading...</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default withErrorBoundary(AdminUserAnalytics, { level: 'page' });
