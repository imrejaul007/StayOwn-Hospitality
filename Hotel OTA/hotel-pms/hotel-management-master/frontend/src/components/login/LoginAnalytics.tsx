import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import {
  X,
  BarChart3,
  TrendingUp,
  Shield,
  Activity,
  Clock,
  MapPin,
  Monitor,
  Smartphone,
  Tablet,
  Globe,
  AlertTriangle,
  CheckCircle,
  Download,
  Filter,
  Calendar
} from 'lucide-react';
import { toast } from 'react-hot-toast';

interface LoginAnalyticsProps {
  onClose: () => void;
}

interface LoginAnalyticsData {
  totalLogins: number;
  activeSessions: number;
  endedSessions: number;
  uniqueUserCount: number;
  uniqueIPCount: number;
  averageSessionDuration: number;
  highRiskSessions: number;
  mediumRiskSessions: number;
  mfaSessions: number;
  mfaRate: number;
  riskRate: number;
  hourlyPatterns: Array<{ hour: number; count: number; uniqueUsers: number }>;
  deviceDistribution: Array<{ device: string; count: number }>;
  locationDistribution: Array<{ location: string; count: number }>;
  recentLogins: Array<{
    _id: string;
    userId: { name: string; email: string; role: string };
    loginTime: string;
    ipAddress: string;
    riskScore: number;
    deviceInfo: { deviceType: string; browser: string };
    locationInfo: { country: string; city: string };
  }>;
  topUsers: Array<{
    _id: string;
    user: { name: string; email: string; role: string };
    loginCount: number;
    averageRiskScore: number;
    lastLogin: string;
    uniqueIPCount: number;
    uniqueDeviceCount: number;
  }>;
}

interface LoginPatterns {
  patternType: string;
  patterns: Array<{
    _id: unknown;
    count: number;
    uniqueUserCount: number;
    averageRisk: number;
  }>;
}

interface SecurityMetrics {
  totalSessions: number;
  highRiskSessions: number;
  mediumRiskSessions: number;
  suspiciousIPSessions: number;
  unusualLocationSessions: number;
  multipleDeviceSessions: number;
  rapidLoginSessions: number;
  failedAttemptSessions: number;
  botDetectedSessions: number;
  vpnDetectedSessions: number;
  torDetectedSessions: number;
  mfaSessions: number;
  averageRiskScore: number;
  securityScore: number;
  riskDistribution: {
    high: number;
    medium: number;
    low: number;
  };
  threatTrends: Array<{
    _id: { year: number; month: number; day: number };
    highRiskCount: number;
    suspiciousCount: number;
    totalCount: number;
  }>;
}

const LoginAnalytics: React.FC<LoginAnalyticsProps> = ({ onClose }) => {
  const [analytics, setAnalytics] = useState<LoginAnalyticsData | null>(null);
  const [patterns, setPatterns] = useState<LoginPatterns | null>(null);
  const [securityMetrics, setSecurityMetrics] = useState<SecurityMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'patterns' | 'security'>('overview');
  const [dateRange, setDateRange] = useState('');
  const [patternType, setPatternType] = useState('hourly');

  useEffect(() => {
    fetchAnalytics();
  }, [dateRange, patternType]);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      
      const queryParams = new URLSearchParams();
      if (dateRange) queryParams.append('dateRange', dateRange);

      const [analyticsRes, patternsRes, securityRes] = await Promise.all([
        api.get(`/login-activity/analytics?${queryParams}`),
        api.get(`/login-activity/analytics/patterns?${queryParams}&patternType=${patternType}`),
        api.get(`/login-activity/analytics/security?${queryParams}`)
      ]);

      setAnalytics(analyticsRes.data.data);
      setPatterns(patternsRes.data.data);
      setSecurityMetrics(securityRes.data.data);
    } catch (error) {
      toast.error('Failed to fetch login analytics data');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    try {
      const queryParams = new URLSearchParams();
      queryParams.append('format', 'csv');
      if (dateRange) queryParams.append('dateRange', dateRange);

      const { data: blob } = await api.get(`/login-activity/analytics/export?${queryParams}`, {
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'login_analytics.csv';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success('Analytics exported successfully');
    } catch (error) {
      toast.error('Failed to export analytics');
    }
  };

  const getDeviceIcon = (deviceType: string) => {
    switch (deviceType) {
      case 'mobile': return <Smartphone className="w-4 h-4" />;
      case 'tablet': return <Tablet className="w-4 h-4" />;
      default: return <Monitor className="w-4 h-4" />;
    }
  };

  const getRiskColor = (riskScore: number) => {
    if (riskScore > 70) return 'bg-red-500';
    if (riskScore > 30) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const formatDuration = (duration: number) => {
    const hours = Math.floor(duration / (1000 * 60 * 60));
    const minutes = Math.floor((duration % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
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
            <h3 className="text-lg font-medium text-gray-900">Login Analytics Dashboard</h3>
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
                { id: 'patterns', label: 'Patterns', icon: TrendingUp },
                { id: 'security', label: 'Security', icon: Shield }
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
                  <Activity className="w-8 h-8 text-blue-600" />
                  <div className="ml-3">
                    <p className="text-sm font-medium text-blue-600">Total Logins</p>
                    <p className="text-2xl font-bold text-blue-900">{analytics.totalLogins}</p>
                  </div>
                </div>
              </div>
              <div className="bg-green-50 p-4 rounded-lg">
                <div className="flex items-center">
                  <CheckCircle className="w-8 h-8 text-green-600" />
                  <div className="ml-3">
                    <p className="text-sm font-medium text-green-600">Active Sessions</p>
                    <p className="text-2xl font-bold text-green-900">{analytics.activeSessions}</p>
                  </div>
                </div>
              </div>
              <div className="bg-purple-50 p-4 rounded-lg">
                <div className="flex items-center">
                  <Shield className="w-8 h-8 text-purple-600" />
                  <div className="ml-3">
                    <p className="text-sm font-medium text-purple-600">MFA Rate</p>
                    <p className="text-2xl font-bold text-purple-900">{analytics.mfaRate.toFixed(1)}%</p>
                  </div>
                </div>
              </div>
              <div className="bg-orange-50 p-4 rounded-lg">
                <div className="flex items-center">
                  <AlertTriangle className="w-8 h-8 text-orange-600" />
                  <div className="ml-3">
                    <p className="text-sm font-medium text-orange-600">Risk Rate</p>
                    <p className="text-2xl font-bold text-orange-900">{analytics.riskRate.toFixed(1)}%</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Hourly Patterns */}
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h4 className="text-lg font-medium text-gray-900 mb-4">Login Patterns by Hour</h4>
              <div className="grid grid-cols-12 gap-2">
                {analytics.hourlyPatterns.map((pattern) => (
                  <div key={pattern.hour} className="text-center">
                    <div className="text-xs text-gray-500 mb-1">{pattern.hour}:00</div>
                    <div className="bg-gray-200 rounded h-20 flex items-end">
                      <div
                        className={`w-full rounded ${getRiskColor(pattern.count / Math.max(...analytics.hourlyPatterns.map(p => p.count)) * 100)}`}
                        style={{ height: `${(pattern.count / Math.max(...analytics.hourlyPatterns.map(p => p.count))) * 100}%` }}
                      ></div>
                    </div>
                    <div className="text-xs text-gray-600 mt-1">{pattern.count}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Device Distribution */}
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h4 className="text-lg font-medium text-gray-900 mb-4">Device Distribution</h4>
              <div className="space-y-3">
                {analytics.deviceDistribution.map(({ device, count }) => {
                  const percentage = analytics.totalLogins > 0 ? (count / analytics.totalLogins) * 100 : 0;
                  const [deviceType, browser] = device.split('-');
                  return (
                    <div key={device} className="flex items-center justify-between">
                      <div className="flex items-center">
                        {getDeviceIcon(deviceType)}
                        <span className="ml-2 text-sm font-medium text-gray-700">
                          {deviceType} - {browser}
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

            {/* Top Users */}
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h4 className="text-lg font-medium text-gray-900 mb-4">Most Active Users</h4>
              <div className="space-y-3">
                {analytics.topUsers.slice(0, 10).map((user, index) => (
                  <div key={user._id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center mr-3">
                        <span className="text-sm font-bold text-blue-600">#{index + 1}</span>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">{user.user.name}</p>
                        <p className="text-xs text-gray-500">{user.user.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-4">
                      <div className="text-right">
                        <p className="text-sm font-medium text-gray-900">{user.loginCount} logins</p>
                        <p className="text-xs text-gray-500">{user.uniqueIPCount} IPs, {user.uniqueDeviceCount} devices</p>
                      </div>
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getRiskColor(user.averageRiskScore)} text-white`}>
                        Risk: {Math.round(user.averageRiskScore)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Patterns Tab */}
        {activeTab === 'patterns' && patterns && (
          <div className="space-y-6">
            {/* Pattern Type Selector */}
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="flex items-center space-x-4">
                <label className="text-sm font-medium text-gray-700">Pattern Type:</label>
                <select
                  value={patternType}
                  onChange={(e) => setPatternType(e.target.value)}
                  className="px-3 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="hourly">Hourly</option>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                </select>
              </div>
            </div>

            {/* Patterns Chart */}
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h4 className="text-lg font-medium text-gray-900 mb-4">
                Login {patternType.charAt(0).toUpperCase() + patternType.slice(1)} Patterns
              </h4>
              <div className="space-y-4">
                {patterns.patterns.map((pattern, index) => {
                  const maxCount = Math.max(...patterns.patterns.map(p => p.count));
                  const percentage = maxCount > 0 ? (pattern.count / maxCount) * 100 : 0;
                  
                  return (
                    <div key={`pattern-${index}-${pattern._id?.hour || pattern._id?.day || pattern._id?.week || ''}`} className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <span className="text-sm font-medium text-gray-700 w-20">
                          {patternType === 'hourly' ? `${pattern._id.hour}:00` :
                           patternType === 'daily' ? `${pattern._id.day}/${pattern._id.month}` :
                           `Week ${pattern._id.week}`}
                        </span>
                        <div className="text-sm text-gray-500">
                          {pattern.uniqueUserCount} users
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="text-sm text-gray-500">{pattern.count}</span>
                        <div className="w-48 bg-gray-200 rounded-full h-4">
                          <div
                            className="bg-blue-500 h-4 rounded-full"
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
          </div>
        )}

        {/* Security Tab */}
        {activeTab === 'security' && securityMetrics && (
          <div className="space-y-6">
            {/* Security Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-red-50 p-4 rounded-lg">
                <div className="flex items-center">
                  <AlertTriangle className="w-8 h-8 text-red-600" />
                  <div className="ml-3">
                    <p className="text-sm font-medium text-red-600">High Risk</p>
                    <p className="text-2xl font-bold text-red-900">{securityMetrics.highRiskSessions}</p>
                  </div>
                </div>
              </div>
              <div className="bg-yellow-50 p-4 rounded-lg">
                <div className="flex items-center">
                  <Shield className="w-8 h-8 text-yellow-600" />
                  <div className="ml-3">
                    <p className="text-sm font-medium text-yellow-600">Medium Risk</p>
                    <p className="text-2xl font-bold text-yellow-900">{securityMetrics.mediumRiskSessions}</p>
                  </div>
                </div>
              </div>
              <div className="bg-blue-50 p-4 rounded-lg">
                <div className="flex items-center">
                  <CheckCircle className="w-8 h-8 text-blue-600" />
                  <div className="ml-3">
                    <p className="text-sm font-medium text-blue-600">Security Score</p>
                    <p className="text-2xl font-bold text-blue-900">{Math.round(securityMetrics.securityScore)}</p>
                  </div>
                </div>
              </div>
              <div className="bg-purple-50 p-4 rounded-lg">
                <div className="flex items-center">
                  <Activity className="w-8 h-8 text-purple-600" />
                  <div className="ml-3">
                    <p className="text-sm font-medium text-purple-600">Avg Risk</p>
                    <p className="text-2xl font-bold text-purple-900">{Math.round(securityMetrics.averageRiskScore)}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Risk Distribution */}
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h4 className="text-lg font-medium text-gray-900 mb-4">Risk Distribution</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                  { level: 'High', count: securityMetrics.riskDistribution.high, color: 'bg-red-500' },
                  { level: 'Medium', count: securityMetrics.riskDistribution.medium, color: 'bg-yellow-500' },
                  { level: 'Low', count: securityMetrics.riskDistribution.low, color: 'bg-green-500' }
                ].map(({ level, count, color }) => {
                  const percentage = securityMetrics.totalSessions > 0 ? (count / securityMetrics.totalSessions) * 100 : 0;
                  return (
                    <div key={level} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h5 className="text-sm font-medium text-gray-900">{level} Risk</h5>
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

            {/* Security Flags */}
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h4 className="text-lg font-medium text-gray-900 mb-4">Security Flags</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  { flag: 'Suspicious IP', count: securityMetrics.suspiciousIPSessions },
                  { flag: 'Unusual Location', count: securityMetrics.unusualLocationSessions },
                  { flag: 'Multiple Devices', count: securityMetrics.multipleDeviceSessions },
                  { flag: 'Rapid Logins', count: securityMetrics.rapidLoginSessions },
                  { flag: 'Failed Attempts', count: securityMetrics.failedAttemptSessions },
                  { flag: 'Bot Detected', count: securityMetrics.botDetectedSessions },
                  { flag: 'VPN Detected', count: securityMetrics.vpnDetectedSessions },
                  { flag: 'Tor Detected', count: securityMetrics.torDetectedSessions }
                ].map(({ flag, count }) => {
                  const percentage = securityMetrics.totalSessions > 0 ? (count / securityMetrics.totalSessions) * 100 : 0;
                  return (
                    <div key={flag} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <span className="text-sm font-medium text-gray-700">{flag}</span>
                      <div className="flex items-center space-x-2">
                        <span className="text-sm text-gray-500">{count}</span>
                        <div className="w-20 bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-red-500 h-2 rounded-full"
                            style={{ width: `${Math.min(percentage * 2, 100)}%` }}
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
          </div>
        )}
      </div>
    </div>
  );
};

export default LoginAnalytics;
