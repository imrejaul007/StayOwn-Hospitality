import React, { useState } from 'react';
import { 
  X, 
  Shield, 
  Clock, 
  MapPin, 
  Monitor, 
  Smartphone,
  Tablet,
  Globe,
  AlertTriangle,
  CheckCircle,
  XCircle,
  User,
  Activity,
  Flag,
  Power,
  Save,
  RefreshCw
} from 'lucide-react';
import { toast } from 'react-hot-toast';

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
    coordinates?: {
      latitude: number;
      longitude: number;
    };
  };
  isActive: boolean;
  lastActivity: string;
  activityCount: number;
  securityFlags: string[];
  riskScore: number;
  mfaUsed: boolean;
  sessionDuration: number;
}

interface SessionManagerProps {
  session: LoginSession;
  onClose: () => void;
  onEndSession: (sessionId: string) => void;
  onUpdateRiskScore: (sessionId: string, riskScore: number, reason: string) => void;
}

const SessionManager: React.FC<SessionManagerProps> = ({
  session,
  onClose,
  onEndSession,
  onUpdateRiskScore
}) => {
  const [riskScore, setRiskScore] = useState(session.riskScore);
  const [reason, setReason] = useState('');
  const [showRiskUpdate, setShowRiskUpdate] = useState(false);
  const [loading, setLoading] = useState(false);

  const getDeviceIcon = (deviceType: string) => {
    switch (deviceType) {
      case 'mobile': return <Smartphone className="w-5 h-5" />;
      case 'tablet': return <Tablet className="w-5 h-5" />;
      default: return <Monitor className="w-5 h-5" />;
    }
  };

  const getRiskColor = (riskScore: number) => {
    if (riskScore > 70) return 'text-red-600 bg-red-100';
    if (riskScore > 30) return 'text-yellow-600 bg-yellow-100';
    return 'text-green-600 bg-green-100';
  };

  const getRiskLevel = (riskScore: number) => {
    if (riskScore > 70) return 'High Risk';
    if (riskScore > 30) return 'Medium Risk';
    return 'Low Risk';
  };

  const getSecurityFlagColor = (flag: string) => {
    const flagColors = {
      'suspicious_ip': 'bg-red-100 text-red-800',
      'unusual_location': 'bg-orange-100 text-orange-800',
      'multiple_devices': 'bg-yellow-100 text-yellow-800',
      'rapid_logins': 'bg-red-100 text-red-800',
      'failed_attempts': 'bg-red-100 text-red-800',
      'privilege_escalation': 'bg-purple-100 text-purple-800',
      'data_breach_attempt': 'bg-red-100 text-red-800',
      'bot_detected': 'bg-gray-100 text-gray-800',
      'vpn_detected': 'bg-blue-100 text-blue-800',
      'tor_detected': 'bg-gray-100 text-gray-800',
      'manual_review': 'bg-indigo-100 text-indigo-800'
    };
    return flagColors[flag as keyof typeof flagColors] || 'bg-gray-100 text-gray-800';
  };

  const formatDuration = (duration: number) => {
    const hours = Math.floor(duration / (1000 * 60 * 60));
    const minutes = Math.floor((duration % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((duration % (1000 * 60)) / 1000);
    return `${hours}h ${minutes}m ${seconds}s`;
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  };

  const handleUpdateRiskScore = async () => {
    if (riskScore < 0 || riskScore > 100) {
      toast.error('Risk score must be between 0 and 100');
      return;
    }

    setLoading(true);
    try {
      await onUpdateRiskScore(session.sessionId, riskScore, reason);
      setShowRiskUpdate(false);
      setReason('');
    } catch {
      // Error handled silently
    } finally {
      setLoading(false);
    }
  };

  const handleEndSession = async () => {
    if (window.confirm('Are you sure you want to end this session?')) {
      setLoading(true);
      try {
        await onEndSession(session.sessionId);
        onClose();
      } catch {
        // Error handled silently
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-10 mx-auto p-5 border w-11/12 md:w-4/5 lg:w-3/4 shadow-lg rounded-md bg-white">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center">
            <Shield className="w-6 h-6 text-blue-600 mr-2" />
            <h3 className="text-lg font-medium text-gray-900">Session Management</h3>
          </div>
          <button aria-label="Close"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Session Overview */}
        <div className="bg-gray-50 p-6 rounded-lg mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* User Info */}
            <div>
              <h4 className="text-lg font-medium text-gray-900 mb-4">User Information</h4>
              <div className="space-y-3">
                <div className="flex items-center">
                  <User className="w-4 h-4 text-gray-500 mr-2" />
                  <span className="text-sm text-gray-600">Name:</span>
                  <span className="ml-2 text-sm font-medium text-gray-900">{session.userId.name}</span>
                </div>
                <div className="flex items-center">
                  <span className="text-sm text-gray-600">Email:</span>
                  <span className="ml-2 text-sm font-medium text-gray-900">{session.userId.email}</span>
                </div>
                <div className="flex items-center">
                  <span className="text-sm text-gray-600">Role:</span>
                  <span className="ml-2 text-sm font-medium text-gray-900">{session.userId.role}</span>
                </div>
                <div className="flex items-center">
                  <span className="text-sm text-gray-600">Session ID:</span>
                  <span className="ml-2 text-sm font-mono text-gray-900">{session.sessionId}</span>
                </div>
              </div>
            </div>

            {/* Session Status */}
            <div>
              <h4 className="text-lg font-medium text-gray-900 mb-4">Session Status</h4>
              <div className="space-y-3">
                <div className="flex items-center">
                  <span className="text-sm text-gray-600">Status:</span>
                  <span className={`ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    session.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                  }`}>
                    {session.isActive ? (
                      <>
                        <CheckCircle className="w-3 h-3 mr-1" />
                        Active
                      </>
                    ) : (
                      <>
                        <XCircle className="w-3 h-3 mr-1" />
                        Ended
                      </>
                    )}
                  </span>
                </div>
                <div className="flex items-center">
                  <Clock className="w-4 h-4 text-gray-500 mr-2" />
                  <span className="text-sm text-gray-600">Duration:</span>
                  <span className="ml-2 text-sm font-medium text-gray-900">{formatDuration(session.sessionDuration)}</span>
                </div>
                <div className="flex items-center">
                  <Activity className="w-4 h-4 text-gray-500 mr-2" />
                  <span className="text-sm text-gray-600">Activities:</span>
                  <span className="ml-2 text-sm font-medium text-gray-900">{session.activityCount}</span>
                </div>
                <div className="flex items-center">
                  <span className="text-sm text-gray-600">MFA Used:</span>
                  <span className={`ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    session.mfaUsed ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                  }`}>
                    {session.mfaUsed ? 'Yes' : 'No'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Risk Assessment */}
        <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h4 className="text-lg font-medium text-gray-900">Risk Assessment</h4>
            <button
              onClick={() => setShowRiskUpdate(true)}
              className="flex items-center px-3 py-1 text-sm font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100"
            >
              <Flag className="w-4 h-4 mr-1" />
              Update Risk
            </button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">Risk Score</span>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getRiskColor(session.riskScore)}`}>
                  {session.riskScore}/100
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className={`h-2 rounded-full ${
                    session.riskScore > 70 ? 'bg-red-500' :
                    session.riskScore > 30 ? 'bg-yellow-500' : 'bg-green-500'
                  }`}
                  style={{ width: `${session.riskScore}%` }}
                ></div>
              </div>
              <p className="text-sm text-gray-600 mt-1">{getRiskLevel(session.riskScore)}</p>
            </div>

            <div>
              <h5 className="text-sm font-medium text-gray-700 mb-2">Security Flags</h5>
              <div className="flex flex-wrap gap-2">
                {session.securityFlags.length > 0 ? (
                  session.securityFlags.map((flag) => (
                    <span
                      key={flag}
                      className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getSecurityFlagColor(flag)}`}
                    >
                      <AlertTriangle className="w-3 h-3 mr-1" />
                      {flag.replace('_', ' ')}
                    </span>
                  ))
                ) : (
                  <span className="text-sm text-gray-500">No security flags</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Device & Location Info */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {/* Device Information */}
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h4 className="text-lg font-medium text-gray-900 mb-4">Device Information</h4>
            <div className="space-y-3">
              <div className="flex items-center">
                {getDeviceIcon(session.deviceInfo.deviceType)}
                <span className="ml-2 text-sm text-gray-600">Type:</span>
                <span className="ml-2 text-sm font-medium text-gray-900 capitalize">{session.deviceInfo.deviceType}</span>
              </div>
              <div className="flex items-center">
                <span className="text-sm text-gray-600">Browser:</span>
                <span className="ml-2 text-sm font-medium text-gray-900">{session.deviceInfo.browser}</span>
              </div>
              <div className="flex items-center">
                <span className="text-sm text-gray-600">OS:</span>
                <span className="ml-2 text-sm font-medium text-gray-900">{session.deviceInfo.os}</span>
              </div>
              <div className="flex items-center">
                <span className="text-sm text-gray-600">Version:</span>
                <span className="ml-2 text-sm font-medium text-gray-900">{session.deviceInfo.version}</span>
              </div>
              <div className="text-xs text-gray-500 mt-2 font-mono break-all">
                {session.userAgent}
              </div>
            </div>
          </div>

          {/* Location Information */}
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h4 className="text-lg font-medium text-gray-900 mb-4">Location Information</h4>
            <div className="space-y-3">
              <div className="flex items-center">
                <MapPin className="w-4 h-4 text-gray-500 mr-2" />
                <span className="text-sm text-gray-600">Location:</span>
                <span className="ml-2 text-sm font-medium text-gray-900">
                  {session.locationInfo.city}, {session.locationInfo.country}
                </span>
              </div>
              <div className="flex items-center">
                <span className="text-sm text-gray-600">Region:</span>
                <span className="ml-2 text-sm font-medium text-gray-900">{session.locationInfo.region}</span>
              </div>
              <div className="flex items-center">
                <span className="text-sm text-gray-600">Timezone:</span>
                <span className="ml-2 text-sm font-medium text-gray-900">{session.locationInfo.timezone}</span>
              </div>
              <div className="flex items-center">
                <Globe className="w-4 h-4 text-gray-500 mr-2" />
                <span className="text-sm text-gray-600">IP Address:</span>
                <span className="ml-2 text-sm font-medium text-gray-900">{session.ipAddress}</span>
              </div>
              {session.locationInfo.coordinates && (
                <div className="text-xs text-gray-500 mt-2">
                  Coordinates: {session.locationInfo.coordinates.latitude}, {session.locationInfo.coordinates.longitude}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Session Timeline */}
        <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
          <h4 className="text-lg font-medium text-gray-900 mb-4">Session Timeline</h4>
          <div className="space-y-4">
            <div className="flex items-center">
              <div className="flex-shrink-0 w-3 h-3 bg-green-500 rounded-full"></div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-900">Session Started</p>
                <p className="text-sm text-gray-500">{formatTimestamp(session.loginTime)}</p>
              </div>
            </div>
            <div className="flex items-center">
              <div className="flex-shrink-0 w-3 h-3 bg-blue-500 rounded-full"></div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-900">Last Activity</p>
                <p className="text-sm text-gray-500">{formatTimestamp(session.lastActivity)}</p>
              </div>
            </div>
            {session.logoutTime && (
              <div className="flex items-center">
                <div className="flex-shrink-0 w-3 h-3 bg-red-500 rounded-full"></div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-900">Session Ended</p>
                  <p className="text-sm text-gray-500">{formatTimestamp(session.logoutTime)}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Close
          </button>
          {session.isActive && (
            <button aria-label="Close"
              onClick={handleEndSession}
              disabled={loading}
              className="flex items-center px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-md hover:bg-red-700 disabled:opacity-50"
            >
              <Power className="w-4 h-4 mr-2" />
              {loading ? 'Ending...' : 'End Session'}
            </button>
          )}
        </div>

        {/* Risk Update Modal */}
        {showRiskUpdate && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-60">
            <div className="relative top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 p-5 border w-11/12 md:w-1/2 shadow-lg rounded-md bg-white">
              <div className="flex items-center mb-4">
                <Flag className="w-6 h-6 text-blue-500 mr-2" />
                <h3 className="text-lg font-medium text-gray-900">Update Risk Score</h3>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Risk Score (0-100)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={riskScore}
                    onChange={(e) => setRiskScore(parseInt(e.target.value) || 0)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Reason (Optional)
                  </label>
                  <textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter reason for risk score update..."
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-3 mt-6">
                <button
                  onClick={() => {
                    setShowRiskUpdate(false);
                    setRiskScore(session.riskScore);
                    setReason('');
                  }}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button aria-label="Save"
                  onClick={handleUpdateRiskScore}
                  disabled={loading}
                  className="flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                  <Save className="w-4 h-4 mr-2" />
                  {loading ? 'Updating...' : 'Update Risk Score'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SessionManager;
