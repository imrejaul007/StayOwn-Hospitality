import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import {
  X,
  Clock,
  User,
  Activity,
  Calendar,
  MapPin,
  Monitor,
  Smartphone,
  Tablet,
  Globe,
  Filter,
  Download,
  RefreshCw
} from 'lucide-react';
import { toast } from 'react-hot-toast';

interface User {
  _id: string;
  name: string;
  email: string;
  role: string;
  phone?: string;
  createdAt: string;
  lastLogin?: string;
}

interface Activity {
  _id: string;
  action: string;
  timestamp: string;
  ipAddress?: string;
  userAgent?: string;
  details?: string;
  user: User;
  metadata?: {
    device?: string;
    browser?: string;
    os?: string;
    location?: string;
  };
}

interface UserActivityTimelineProps {
  user: User;
  onClose: () => void;
}

const UserActivityTimeline: React.FC<UserActivityTimelineProps> = ({
  user,
  onClose
}) => {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    dateRange: '',
    action: 'all',
    limit: 50
  });

  useEffect(() => {
    fetchActivities();
  }, [filters]);

  const fetchActivities = async () => {
    try {
      setLoading(true);
      const queryParams = new URLSearchParams();
      
      queryParams.append('userId', user._id);
      queryParams.append('limit', filters.limit.toString());
      
      if (filters.dateRange) queryParams.append('dateRange', filters.dateRange);
      if (filters.action !== 'all') queryParams.append('action', filters.action);

      const { data } = await api.get(`/user-management/activity-timeline?${queryParams}`);
      setActivities(data.data.activities);
    } catch (error) {
      toast.error('Failed to fetch user activities');
    } finally {
      setLoading(false);
    }
  };

  const getActionIcon = (action: string) => {
    const icons = {
      login: '🔐',
      logout: '🚪',
      profile_update: '✏️',
      password_change: '🔑',
      booking_create: '📅',
      booking_update: '📝',
      booking_cancel: '❌',
      payment_made: '💳',
      review_submitted: '⭐',
      support_request: '🆘',
      system_access: '🖥️',
      data_export: '📤',
      data_import: '📥',
      settings_change: '⚙️',
      default: '📋'
    };
    return icons[action as keyof typeof icons] || icons.default;
  };

  const getActionColor = (action: string) => {
    const colors = {
      login: 'bg-green-100 text-green-800',
      logout: 'bg-gray-100 text-gray-800',
      profile_update: 'bg-blue-100 text-blue-800',
      password_change: 'bg-yellow-100 text-yellow-800',
      booking_create: 'bg-purple-100 text-purple-800',
      booking_update: 'bg-indigo-100 text-indigo-800',
      booking_cancel: 'bg-red-100 text-red-800',
      payment_made: 'bg-green-100 text-green-800',
      review_submitted: 'bg-yellow-100 text-yellow-800',
      support_request: 'bg-orange-100 text-orange-800',
      system_access: 'bg-blue-100 text-blue-800',
      data_export: 'bg-purple-100 text-purple-800',
      data_import: 'bg-indigo-100 text-indigo-800',
      settings_change: 'bg-gray-100 text-gray-800',
      default: 'bg-gray-100 text-gray-800'
    };
    return colors[action as keyof typeof colors] || colors.default;
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

  const getBrowserInfo = (userAgent?: string) => {
    if (!userAgent) return 'Unknown';
    
    const ua = userAgent.toLowerCase();
    if (ua.includes('chrome')) return 'Chrome';
    if (ua.includes('firefox')) return 'Firefox';
    if (ua.includes('safari')) return 'Safari';
    if (ua.includes('edge')) return 'Edge';
    if (ua.includes('opera')) return 'Opera';
    return 'Unknown';
  };

  const getOSInfo = (userAgent?: string) => {
    if (!userAgent) return 'Unknown';
    
    const ua = userAgent.toLowerCase();
    if (ua.includes('windows')) return 'Windows';
    if (ua.includes('mac')) return 'macOS';
    if (ua.includes('linux')) return 'Linux';
    if (ua.includes('android')) return 'Android';
    if (ua.includes('ios') || ua.includes('iphone') || ua.includes('ipad')) return 'iOS';
    return 'Unknown';
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

  const actionOptions = [
    { value: 'all', label: 'All Actions' },
    { value: 'login', label: 'Login' },
    { value: 'logout', label: 'Logout' },
    { value: 'profile_update', label: 'Profile Update' },
    { value: 'password_change', label: 'Password Change' },
    { value: 'booking_create', label: 'Booking Create' },
    { value: 'booking_update', label: 'Booking Update' },
    { value: 'booking_cancel', label: 'Booking Cancel' },
    { value: 'payment_made', label: 'Payment Made' },
    { value: 'review_submitted', label: 'Review Submitted' },
    { value: 'support_request', label: 'Support Request' },
    { value: 'system_access', label: 'System Access' },
    { value: 'data_export', label: 'Data Export' },
    { value: 'data_import', label: 'Data Import' },
    { value: 'settings_change', label: 'Settings Change' }
  ];

  const dateRangeOptions = [
    { value: '', label: 'All Time' },
    { value: '{"start":"2024-01-01","end":"2024-12-31"}', label: '2024' },
    { value: '{"start":"2024-01-01","end":"2024-03-31"}', label: 'Q1 2024' },
    { value: '{"start":"2024-04-01","end":"2024-06-30"}', label: 'Q2 2024' },
    { value: '{"start":"2024-07-01","end":"2024-09-30"}', label: 'Q3 2024' },
    { value: '{"start":"2024-10-01","end":"2024-12-31"}', label: 'Q4 2024' },
    { value: '{"start":"2024-11-01","end":"2024-11-30"}', label: 'Last 30 Days' },
    { value: '{"start":"2024-11-25","end":"2024-12-01"}', label: 'Last 7 Days' }
  ];

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-10 mx-auto p-5 border w-11/12 md:w-4/5 lg:w-3/4 shadow-lg rounded-md bg-white">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center">
            <Activity className="w-6 h-6 text-blue-600 mr-2" />
            <div>
              <h3 className="text-lg font-medium text-gray-900">User Activity Timeline</h3>
              <p className="text-sm text-gray-500">{user.name} ({user.email})</p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={fetchActivities}
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

        {/* User Info */}
        <div className="bg-gray-50 p-4 rounded-lg mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="h-12 w-12 rounded-full bg-gray-300 flex items-center justify-center mr-4">
                <span className="text-lg font-medium text-gray-700">
                  {user.name.charAt(0).toUpperCase()}
                </span>
              </div>
              <div>
                <h4 className="text-lg font-medium text-gray-900">{user.name}</h4>
                <p className="text-sm text-gray-500">{user.email}</p>
                <p className="text-xs text-gray-400">
                  {user.role} • Member since {new Date(user.createdAt).toLocaleDateString()}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-500">Last Login</p>
              <p className="text-sm font-medium text-gray-900">
                {user.lastLogin ? new Date(user.lastLogin).toLocaleDateString() : 'Never'}
              </p>
            </div>
          </div>
        </div>

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
                {dateRangeOptions.map(option => (
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
                Limit
              </label>
              <select
                value={filters.limit}
                onChange={(e) => setFilters({ ...filters, limit: parseInt(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value={25}>25 activities</option>
                <option value={50}>50 activities</option>
                <option value={100}>100 activities</option>
                <option value={200}>200 activities</option>
              </select>
            </div>
            <div className="flex items-end">
              <button
                onClick={() => setFilters({ dateRange: '', action: 'all', limit: 50 })}
                className="w-full flex items-center justify-center px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200"
              >
                <Filter className="w-4 h-4 mr-2" />
                Clear Filters
              </button>
            </div>
          </div>
        </div>

        {/* Activity Timeline */}
        <div className="bg-white rounded-lg shadow-sm border">
          {loading ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-2 text-gray-600">Loading activities...</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {activities.length === 0 ? (
                <div className="p-8 text-center">
                  <Activity className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500">No activities found</p>
                </div>
              ) : (
                activities.map((activity, index) => {
                  const timestamp = formatTimestamp(activity.timestamp);
                  return (
                    <div key={activity._id} className="p-6 hover:bg-gray-50">
                      <div className="flex items-start">
                        <div className="flex-shrink-0">
                          <div className="flex items-center justify-center w-10 h-10 bg-gray-100 rounded-full">
                            <span className="text-lg">{getActionIcon(activity.action)}</span>
                          </div>
                        </div>
                        <div className="ml-4 flex-1">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getActionColor(activity.action)}`}>
                                {activity.action.replace('_', ' ')}
                              </span>
                              <span className="text-sm text-gray-500">{timestamp.relative}</span>
                            </div>
                            <div className="flex items-center space-x-2 text-xs text-gray-500">
                              <span>{timestamp.date}</span>
                              <span>{timestamp.time}</span>
                            </div>
                          </div>
                          
                          {activity.details && (
                            <p className="mt-2 text-sm text-gray-700">{activity.details}</p>
                          )}
                          
                          <div className="mt-3 flex items-center space-x-4 text-xs text-gray-500">
                            {activity.ipAddress && (
                              <div className="flex items-center">
                                <Globe className="w-3 h-3 mr-1" />
                                <span>{activity.ipAddress}</span>
                              </div>
                            )}
                            {activity.userAgent && (
                              <div className="flex items-center">
                                {getDeviceIcon(activity.userAgent)}
                                <span className="ml-1">
                                  {getBrowserInfo(activity.userAgent)} on {getOSInfo(activity.userAgent)}
                                </span>
                              </div>
                            )}
                            {activity.metadata?.location && (
                              <div className="flex items-center">
                                <MapPin className="w-3 h-3 mr-1" />
                                <span>{activity.metadata.location}</span>
                              </div>
                            )}
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

        {/* Summary */}
        {activities.length > 0 && (
          <div className="mt-6 bg-gray-50 p-4 rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <Clock className="w-4 h-4 text-gray-500 mr-2" />
                <span className="text-sm text-gray-700">
                  Showing {activities.length} activities
                </span>
              </div>
              <div className="text-sm text-gray-500">
                {activities.length > 0 && (
                  <span>
                    From {formatTimestamp(activities[activities.length - 1].timestamp).date} to{' '}
                    {formatTimestamp(activities[0].timestamp).date}
                  </span>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default UserActivityTimeline;
