import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import {
  X,
  AlertTriangle,
  Shield,
  Clock,
  User,
  Globe,
  Monitor,
  Smartphone,
  Tablet,
  Filter,
  Search,
  Download,
  RefreshCw,
  Eye,
  CheckCircle,
  XCircle,
  AlertCircle,
  Info
} from 'lucide-react';
import { toast } from 'react-hot-toast';

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
  metadata?: {
    device?: string;
    browser?: string;
    os?: string;
    location?: string;
  };
}

interface SecurityAlertsProps {
  alerts: SecurityAlert[];
  onClose: () => void;
}

const SecurityAlerts: React.FC<SecurityAlertsProps> = ({
  alerts: initialAlerts,
  onClose
}) => {
  const [alerts, setAlerts] = useState<SecurityAlert[]>(initialAlerts);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
    severity: 'all',
    action: 'all',
    search: '',
    dateRange: ''
  });
  const [selectedAlert, setSelectedAlert] = useState<SecurityAlert | null>(null);

  useEffect(() => {
    fetchAlerts();
  }, [filters]);

  const fetchAlerts = async () => {
    try {
      setLoading(true);
      const queryParams = new URLSearchParams();
      
      if (filters.severity !== 'all') queryParams.append('severity', filters.severity);
      if (filters.dateRange) queryParams.append('dateRange', filters.dateRange);

      const { data } = await api.get(`/login-activity/alerts?${queryParams}`);
      setAlerts(data.data.alerts);
    } catch (error) {
      toast.error('Failed to fetch security alerts');
    } finally {
      setLoading(false);
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'high': return <AlertTriangle className="w-5 h-5 text-red-500" />;
      case 'medium': return <AlertCircle className="w-5 h-5 text-yellow-500" />;
      case 'low': return <Info className="w-5 h-5 text-blue-500" />;
      default: return <AlertTriangle className="w-5 h-5 text-gray-500" />;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high': return 'bg-red-100 text-red-800 border-red-200';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low': return 'bg-blue-100 text-blue-800 border-blue-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getActionIcon = (action: string) => {
    const icons = {
      'security_alert': <Shield className="w-4 h-4" />,
      'suspicious_activity': <AlertTriangle className="w-4 h-4" />,
      'failed_login': <XCircle className="w-4 h-4" />,
      'privilege_escalation': <User className="w-4 h-4" />,
      'data_breach_attempt': <AlertTriangle className="w-4 h-4" />,
      'bot_detected': <Monitor className="w-4 h-4" />,
      'vpn_detected': <Globe className="w-4 h-4" />,
      'tor_detected': <Globe className="w-4 h-4" />,
      'unusual_location': <Globe className="w-4 h-4" />,
      'multiple_devices': <Smartphone className="w-4 h-4" />,
      'rapid_logins': <Clock className="w-4 h-4" />,
      'default': <AlertTriangle className="w-4 h-4" />
    };
    return icons[action as keyof typeof icons] || icons.default;
  };

  const getDeviceIcon = (userAgent?: string) => {
    if (!userAgent) return <Monitor className="w-4 h-4" />;
    
    const ua = userAgent.toLowerCase();
    if (ua.includes('mobile') || ua.includes('android') || ua.includes('iphone')) {
      return <Smartphone className="w-4 h-4" />;
    }
    if (ua.includes('tablet') || ua.includes('ipad')) {
      return <Tablet className="w-4 h-4" />;
    }
    return <Monitor className="w-4 h-4" />;
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return {
      date: date.toLocaleDateString(),
      time: date.toLocaleTimeString(),
      relative: getRelativeTime(date)
    };
  };

  const getRelativeTime = (date: Date) => {
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
    if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 86400)} days ago`;
    return date.toLocaleDateString();
  };

  const filteredAlerts = alerts.filter(alert => {
    if (filters.severity !== 'all' && alert.severity !== filters.severity) return false;
    if (filters.action !== 'all' && alert.action !== filters.action) return false;
    if (filters.search && !alert.details.toLowerCase().includes(filters.search.toLowerCase()) &&
        !alert.user.name.toLowerCase().includes(filters.search.toLowerCase()) &&
        !alert.user.email.toLowerCase().includes(filters.search.toLowerCase())) return false;
    return true;
  });

  const severityOptions = [
    { value: 'all', label: 'All Severities' },
    { value: 'high', label: 'High' },
    { value: 'medium', label: 'Medium' },
    { value: 'low', label: 'Low' }
  ];

  const actionOptions = [
    { value: 'all', label: 'All Actions' },
    { value: 'security_alert', label: 'Security Alert' },
    { value: 'suspicious_activity', label: 'Suspicious Activity' },
    { value: 'failed_login', label: 'Failed Login' },
    { value: 'privilege_escalation', label: 'Privilege Escalation' },
    { value: 'data_breach_attempt', label: 'Data Breach Attempt' },
    { value: 'bot_detected', label: 'Bot Detected' },
    { value: 'vpn_detected', label: 'VPN Detected' },
    { value: 'tor_detected', label: 'Tor Detected' },
    { value: 'unusual_location', label: 'Unusual Location' },
    { value: 'multiple_devices', label: 'Multiple Devices' },
    { value: 'rapid_logins', label: 'Rapid Logins' }
  ];

  const dateRangeOptions = [
    { value: '', label: 'All Time' },
    { value: '{"start":"2024-01-01","end":"2024-12-31"}', label: '2024' },
    { value: '{"start":"2024-11-01","end":"2024-11-30"}', label: 'Last 30 Days' },
    { value: '{"start":"2024-11-25","end":"2024-12-01"}', label: 'Last 7 Days' },
    { value: '{"start":"2024-11-30","end":"2024-12-01"}', label: 'Last 24 Hours' }
  ];

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-10 mx-auto p-5 border w-11/12 md:w-4/5 lg:w-3/4 shadow-lg rounded-md bg-white">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center">
            <AlertTriangle className="w-6 h-6 text-red-600 mr-2" />
            <h3 className="text-lg font-medium text-gray-900">Security Alerts</h3>
            <span className="ml-2 text-sm text-gray-500">({filteredAlerts.length} alerts)</span>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={fetchAlerts}
              disabled={loading}
              className="flex items-center px-3 py-1 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button aria-label="Close"
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-gray-50 p-4 rounded-lg mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Severity
              </label>
              <select
                value={filters.severity}
                onChange={(e) => setFilters({ ...filters, severity: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {severityOptions.map(option => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Action Type
              </label>
              <select
                value={filters.action}
                onChange={(e) => setFilters({ ...filters, action: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {actionOptions.map(option => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Date Range
              </label>
              <select
                value={filters.dateRange}
                onChange={(e) => setFilters({ ...filters, dateRange: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {dateRangeOptions.map(option => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Search
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  value={filters.search}
                  onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                  placeholder="Search alerts..."
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Alerts List */}
        <div className="bg-white rounded-lg shadow-sm border">
          {loading ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-2 text-gray-600">Loading alerts...</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {filteredAlerts.length === 0 ? (
                <div className="p-8 text-center">
                  <AlertTriangle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500">No security alerts found</p>
                </div>
              ) : (
                filteredAlerts.map((alert) => {
                  const timestamp = formatTimestamp(alert.timestamp);
                  return (
                    <div key={alert._id} className="p-6 hover:bg-gray-50">
                      <div className="flex items-start">
                        <div className="flex-shrink-0">
                          <div className="flex items-center justify-center w-10 h-10 bg-gray-100 rounded-full">
                            {getSeverityIcon(alert.severity)}
                          </div>
                        </div>
                        <div className="ml-4 flex-1">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                              <span className="text-sm font-medium text-gray-900">
                                {alert.action.replace('_', ' ')}
                              </span>
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getSeverityColor(alert.severity)}`}>
                                {alert.severity}
                              </span>
                              <span className="text-sm text-gray-500">{timestamp.relative}</span>
                            </div>
                            <div className="flex items-center space-x-2 text-xs text-gray-500">
                              <span>{timestamp.date}</span>
                              <span>{timestamp.time}</span>
                            </div>
                          </div>
                          
                          <p className="mt-2 text-sm text-gray-700">{alert.details}</p>
                          
                          <div className="mt-3 flex items-center space-x-4 text-xs text-gray-500">
                            <div className="flex items-center">
                              <User className="w-3 h-3 mr-1" />
                              <span>{alert.user.name} ({alert.user.email})</span>
                            </div>
                            <div className="flex items-center">
                              <Globe className="w-3 h-3 mr-1" />
                              <span>{alert.ipAddress}</span>
                            </div>
                            <div className="flex items-center">
                              {getDeviceIcon(alert.userAgent)}
                              <span className="ml-1">Device</span>
                            </div>
                            <button aria-label="View"
                              onClick={() => setSelectedAlert(alert)}
                              className="text-blue-600 hover:text-blue-900"
                            >
                              <Eye className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>

        {/* Alert Details Modal */}
        {selectedAlert && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-60">
            <div className="relative top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 p-5 border w-11/12 md:w-2/3 shadow-lg rounded-md bg-white">
              <div className="flex justify-between items-center mb-4">
                <div className="flex items-center">
                  {getSeverityIcon(selectedAlert.severity)}
                  <h3 className="text-lg font-medium text-gray-900 ml-2">Alert Details</h3>
                </div>
                <button aria-label="Close"
                  onClick={() => setSelectedAlert(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Action</label>
                    <p className="text-sm text-gray-900">{selectedAlert.action.replace('_', ' ')}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Severity</label>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getSeverityColor(selectedAlert.severity)}`}>
                      {selectedAlert.severity}
                    </span>
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700">Details</label>
                  <p className="text-sm text-gray-900">{selectedAlert.details}</p>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">User</label>
                    <p className="text-sm text-gray-900">{selectedAlert.user.name} ({selectedAlert.user.email})</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Role</label>
                    <p className="text-sm text-gray-900">{selectedAlert.user.role}</p>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">IP Address</label>
                    <p className="text-sm text-gray-900">{selectedAlert.ipAddress}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Timestamp</label>
                    <p className="text-sm text-gray-900">{formatTimestamp(selectedAlert.timestamp).date} {formatTimestamp(selectedAlert.timestamp).time}</p>
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700">User Agent</label>
                  <p className="text-sm text-gray-900 font-mono break-all">{selectedAlert.userAgent}</p>
                </div>
              </div>

              <div className="flex justify-end space-x-3 mt-6">
                <button
                  onClick={() => setSelectedAlert(null)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SecurityAlerts;
