import React, { useState, useEffect } from 'react';
import { withErrorBoundary } from '../../components/ErrorBoundary';
import {
  Shield,
  Activity, 
  AlertTriangle, 
  Users, 
  Clock, 
  MapPin, 
  Monitor, 
  Smartphone,
  Tablet,
  Globe,
  Eye,
  X,
  RefreshCw,
  Download,
  Filter,
  Calendar,
  TrendingUp,
  TrendingDown,
  CheckCircle,
  XCircle,
  AlertCircle
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import LoginAnalytics from '../../components/login/LoginAnalytics';
import SessionManager from '../../components/login/SessionManager';
import SecurityAlerts from '../../components/login/SecurityAlerts';
import { useProperty } from '../../context/PropertyContext';
import { PropertyBreadcrumb } from '../../components/common/PropertyBreadcrumb';
import { api } from '../../services/api';
import EmptyState from '../../components/ui/EmptyState';

interface LoginSession {
  _id: string;
  sessionId: string;
  userId: {
    _id: string;
    name: string;
    email: string;
    role: string;
  };
  loginTime: string;
  logoutTime?: string;
  ipAddress: string;
  userAgent: string;
  deviceInfo: {
    deviceType: string;
    browser: string;
    os: string;
    version: string;
  };
  locationInfo: {
    country: string;
    city: string;
    region: string;
    timezone: string;
  };
  isActive: boolean;
  lastActivity: string;
  activityCount: number;
  securityFlags: string[];
  riskScore: number;
  mfaUsed: boolean;
  sessionDuration: number;
}

interface LoginAnalytics {
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
  recentLogins: LoginSession[];
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

interface SecurityAlert {
  _id: string;
  action: string;
  details: string;
  timestamp: string;
  severity: string;
  user: {
    _id: string;
    name: string;
    email: string;
    role: string;
  };
  ipAddress: string;
  userAgent: string;
}

function getDateRangeOptions(): Array<{ label: string; value: string }> {
  const today = new Date();
  const formatDate = (d: Date) => d.toISOString().split('T')[0];
  const todayStr = formatDate(today);

  const daysAgo = (n: number) => {
    const d = new Date(today);
    d.setDate(d.getDate() - n);
    return formatDate(d);
  };

  return [
    { label: 'All Time', value: '' },
    { label: 'Last 24 Hours', value: JSON.stringify({ start: daysAgo(1), end: todayStr }) },
    { label: 'Last 7 Days', value: JSON.stringify({ start: daysAgo(7), end: todayStr }) },
    { label: 'Last 30 Days', value: JSON.stringify({ start: daysAgo(30), end: todayStr }) },
    { label: 'Last 90 Days', value: JSON.stringify({ start: daysAgo(90), end: todayStr }) },
  ];
}

function DateRangeSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const options = getDateRangeOptions();
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
    >
      {options.map((opt) => (
        <option key={opt.label} value={opt.value}>{opt.label}</option>
      ))}
    </select>
  );
}

const AdminLoginActivity: React.FC = () => {
  const { selectedPropertyId, selectedProperty, viewMode } = useProperty();
  const [analytics, setAnalytics] = useState<LoginAnalytics | null>(null);
  const [activeSessions, setActiveSessions] = useState<LoginSession[]>([]);
  const [suspiciousSessions, setSuspiciousSessions] = useState<LoginSession[]>([]);
  const [securityAlerts, setSecurityAlerts] = useState<SecurityAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'sessions' | 'alerts' | 'analytics'>('overview');
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [showSessionManager, setShowSessionManager] = useState(false);
  const [showSecurityAlerts, setShowSecurityAlerts] = useState(false);
  const [selectedSession, setSelectedSession] = useState<LoginSession | null>(null);

  const [filters, setFilters] = useState({
    dateRange: '',
    riskLevel: 'all',
    deviceType: 'all',
    country: 'all'
  });

  useEffect(() => {
    if (selectedPropertyId || viewMode === 'all') {
      fetchData();
      const interval = setInterval(fetchData, 30000); // Refresh every 30 seconds
      return () => clearInterval(interval);
    }
  }, [filters, selectedPropertyId, viewMode]);

  const fetchData = async () => {
    try {
      setLoading(true);

      const queryParams = new URLSearchParams();
      if (filters.dateRange) queryParams.append('dateRange', filters.dateRange);
      if (selectedPropertyId) queryParams.append('hotelId', selectedPropertyId);

      const [analyticsRes, activeSessionsRes, suspiciousRes, alertsRes] = await Promise.all([
        api.get(`/login-activity/analytics?${queryParams}`),
        api.get(`/login-activity/sessions/active?${queryParams}`),
        api.get(`/login-activity/sessions/suspicious?${queryParams}`),
        api.get(`/login-activity/alerts?${queryParams}`)
      ]);

      setAnalytics(analyticsRes.data.data);
      setActiveSessions(activeSessionsRes.data.data.sessions);
      setSuspiciousSessions(suspiciousRes.data.data.sessions);
      setSecurityAlerts(alertsRes.data.data.alerts);
    } catch (error) {
      toast.error('Failed to fetch login activity data');
    } finally {
      setLoading(false);
    }
  };

  const handleEndSession = async (sessionId: string) => {
    try {
      await api.post(`/login-activity/sessions/${sessionId}/end`);

      toast.success('Session ended successfully');
      fetchData();
    } catch (error) {
      toast.error('Failed to end session');
    }
  };

  const handleUpdateRiskScore = async (sessionId: string, riskScore: number, reason: string) => {
    try {
      await api.patch(`/login-activity/sessions/${sessionId}`, { riskScore, reason });

      toast.success('Risk score updated successfully');
      fetchData();
    } catch (error) {
      toast.error('Failed to update risk score');
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
    if (riskScore > 70) return 'text-red-600 bg-red-100';
    if (riskScore > 30) return 'text-yellow-600 bg-yellow-100';
    return 'text-green-600 bg-green-100';
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high': return 'text-red-600 bg-red-100';
      case 'medium': return 'text-yellow-600 bg-yellow-100';
      case 'low': return 'text-blue-600 bg-blue-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const formatDuration = (duration: number) => {
    const hours = Math.floor(duration / (1000 * 60 * 60));
    const minutes = Math.floor((duration % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  };

  if (showAnalytics) {
    return (
      <LoginAnalytics
        onClose={() => setShowAnalytics(false)}
      />
    );
  }

  if (showSessionManager && selectedSession) {
    return (
      <SessionManager
        session={selectedSession}
        onClose={() => {
          setShowSessionManager(false);
          setSelectedSession(null);
        }}
        onEndSession={handleEndSession}
        onUpdateRiskScore={handleUpdateRiskScore}
      />
    );
  }

  if (showSecurityAlerts) {
    return (
      <SecurityAlerts
        alerts={securityAlerts}
        onClose={() => setShowSecurityAlerts(false)}
      />
    );
  }

  // If in single mode and no property selected, show selection prompt
  if (!selectedPropertyId && viewMode === 'single') {
    return (
      <div className="p-6">
        <PropertyBreadcrumb items={['Analytics', 'Login Activity']} />
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <p className="text-gray-600 text-lg">Please select a property to view login activity</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <PropertyBreadcrumb items={['Analytics', 'Login Activity']} />
      <div className="mb-6 mt-4">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Login Activity Monitoring</h1>
            <p className="text-gray-600">
              Real-time login monitoring and security analytics
              {selectedProperty && ` - ${selectedProperty.name}`}
            </p>
          </div>
          <div className="flex space-x-3">
            <button
              onClick={() => setShowAnalytics(true)}
              className="flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              <TrendingUp className="w-4 h-4 mr-2" />
              Analytics
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
                <Activity className="w-8 h-8 text-blue-600" />
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-600">Total Logins</p>
                  <p className="text-2xl font-bold text-gray-900">{analytics.totalLogins}</p>
                </div>
              </div>
            </div>
            <div className="bg-white p-4 rounded-lg shadow-sm border">
              <div className="flex items-center">
                <Users className="w-8 h-8 text-green-600" />
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-600">Active Sessions</p>
                  <p className="text-2xl font-bold text-gray-900">{analytics.activeSessions}</p>
                </div>
              </div>
            </div>
            <div className="bg-white p-4 rounded-lg shadow-sm border">
              <div className="flex items-center">
                <Shield className="w-8 h-8 text-purple-600" />
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-600">MFA Rate</p>
                  <p className="text-2xl font-bold text-gray-900">{analytics.mfaRate.toFixed(1)}%</p>
                </div>
              </div>
            </div>
            <div className="bg-white p-4 rounded-lg shadow-sm border">
              <div className="flex items-center">
                <AlertTriangle className="w-8 h-8 text-red-600" />
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-600">High Risk</p>
                  <p className="text-2xl font-bold text-gray-900">{analytics.highRiskSessions}</p>
                </div>
              </div>
            </div>
            <div className="bg-white p-4 rounded-lg shadow-sm border">
              <div className="flex items-center">
                <Globe className="w-8 h-8 text-orange-600" />
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-600">Unique IPs</p>
                  <p className="text-2xl font-bold text-gray-900">{analytics.uniqueIPCount}</p>
                </div>
              </div>
            </div>
            <div className="bg-white p-4 rounded-lg shadow-sm border">
              <div className="flex items-center">
                <Clock className="w-8 h-8 text-indigo-600" />
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-600">Avg Duration</p>
                  <p className="text-2xl font-bold text-gray-900">{formatDuration(analytics.averageSessionDuration)}</p>
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
              <DateRangeSelect
                value={filters.dateRange}
                onChange={(value) => setFilters({ ...filters, dateRange: value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Risk Level
              </label>
              <select
                value={filters.riskLevel}
                onChange={(e) => setFilters({ ...filters, riskLevel: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Risk Levels</option>
                <option value="high">High Risk (&gt;70)</option>
                <option value="medium">Medium Risk (30-70)</option>
                <option value="low">Low Risk (&lt;30)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Device Type
              </label>
              <select
                value={filters.deviceType}
                onChange={(e) => setFilters({ ...filters, deviceType: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Devices</option>
                <option value="desktop">Desktop</option>
                <option value="mobile">Mobile</option>
                <option value="tablet">Tablet</option>
              </select>
            </div>
            <div className="flex items-end">
              <button
                onClick={() => setFilters({ dateRange: '', riskLevel: 'all', deviceType: 'all', country: 'all' })}
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
                { id: 'overview', label: 'Overview', icon: Activity },
                { id: 'sessions', label: 'Active Sessions', icon: Users },
                { id: 'alerts', label: 'Security Alerts', icon: AlertTriangle }
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
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Recent Logins */}
            <div className="bg-white shadow-sm rounded-lg border">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-medium text-gray-900">Recent Logins</h3>
              </div>
              <div className="divide-y divide-gray-200">
                {analytics?.recentLogins.slice(0, 10).map((session) => (
                  <div key={session._id} className="p-6 hover:bg-gray-50">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10">
                          <div className="h-10 w-10 rounded-full bg-gray-300 flex items-center justify-center">
                            <span className="text-sm font-medium text-gray-700">
                              {session.userId.name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">{session.userId.name}</div>
                          <div className="text-sm text-gray-500">{session.userId.email}</div>
                          <div className="flex items-center mt-1 text-xs text-gray-400">
                            <MapPin className="w-3 h-3 mr-1" />
                            {session.locationInfo.city}, {session.locationInfo.country}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-4">
                        <div className="flex items-center">
                          {getDeviceIcon(session.deviceInfo.deviceType)}
                          <span className="ml-1 text-sm text-gray-500">{session.deviceInfo.browser}</span>
                        </div>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getRiskColor(session.riskScore)}`}>
                          Risk: {session.riskScore}
                        </span>
                        <span className="text-sm text-gray-500">{formatTimestamp(session.loginTime)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Top Users */}
            <div className="bg-white shadow-sm rounded-lg border">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-medium text-gray-900">Most Active Users</h3>
              </div>
              <div className="divide-y divide-gray-200">
                {analytics?.topUsers.slice(0, 10).map((user, index) => (
                  <div key={user._id} className="p-6 hover:bg-gray-50">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center mr-3">
                          <span className="text-sm font-bold text-blue-600">#{index + 1}</span>
                        </div>
                        <div>
                          <div className="text-sm font-medium text-gray-900">{user.user.name}</div>
                          <div className="text-sm text-gray-500">{user.user.email}</div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-4">
                        <div className="text-right">
                          <p className="text-sm font-medium text-gray-900">{user.loginCount} logins</p>
                          <p className="text-xs text-gray-500">{user.uniqueIPCount} IPs, {user.uniqueDeviceCount} devices</p>
                        </div>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getRiskColor(user.averageRiskScore)}`}>
                          Avg Risk: {Math.round(user.averageRiskScore)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Active Sessions Tab */}
        {activeTab === 'sessions' && (
          <div className="bg-white shadow-sm rounded-lg border">
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium text-gray-900">Active Sessions</h3>
                <span className="text-sm text-gray-500">{activeSessions.length} active sessions</span>
              </div>
            </div>
            <div className="divide-y divide-gray-200">
              {activeSessions.length === 0 ? (
                <EmptyState
                  title="No active sessions"
                  description="There are no active login sessions at this time."
                />
              ) : activeSessions.map((session) => (
                <div key={session._id} className="p-6 hover:bg-gray-50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-10 w-10">
                        <div className="h-10 w-10 rounded-full bg-gray-300 flex items-center justify-center">
                          <span className="text-sm font-medium text-gray-700">
                            {session.userId.name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">{session.userId.name}</div>
                        <div className="text-sm text-gray-500">{session.userId.email}</div>
                        <div className="flex items-center mt-1 text-xs text-gray-400">
                          <Globe className="w-3 h-3 mr-1" />
                          {session.ipAddress}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-4">
                      <div className="flex items-center">
                        {getDeviceIcon(session.deviceInfo.deviceType)}
                        <span className="ml-1 text-sm text-gray-500">{session.deviceInfo.browser}</span>
                      </div>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getRiskColor(session.riskScore)}`}>
                        Risk: {session.riskScore}
                      </span>
                      <span className="text-sm text-gray-500">
                        {formatDuration(session.sessionDuration)}
                      </span>
                      <button aria-label="View"
                        onClick={() => {
                          setSelectedSession(session);
                          setShowSessionManager(true);
                        }}
                        className="text-blue-600 hover:text-blue-900"
                        title="Manage Session"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Security Alerts Tab */}
        {activeTab === 'alerts' && (
          <div className="bg-white shadow-sm rounded-lg border">
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium text-gray-900">Security Alerts</h3>
                <button
                  onClick={() => setShowSecurityAlerts(true)}
                  className="text-sm text-blue-600 hover:text-blue-900"
                >
                  View All Alerts
                </button>
              </div>
            </div>
            <div className="divide-y divide-gray-200">
              {securityAlerts.slice(0, 10).map((alert) => (
                <div key={alert._id} className="p-6 hover:bg-gray-50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <AlertCircle className="w-5 h-5 text-red-500" />
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">{alert.action.replace('_', ' ')}</div>
                        <div className="text-sm text-gray-500">{alert.details}</div>
                        <div className="flex items-center mt-1 text-xs text-gray-400">
                          <span>{alert.user.name} ({alert.user.email})</span>
                          <span className="mx-2">•</span>
                          <Globe className="w-3 h-3 mr-1" />
                          <span>{alert.ipAddress}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getSeverityColor(alert.severity)}`}>
                        {alert.severity}
                      </span>
                      <span className="text-sm text-gray-500">{formatTimestamp(alert.timestamp)}</span>
                    </div>
                  </div>
                </div>
              ))}
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

export default AdminLoginActivity;
