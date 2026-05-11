import React, { useState, useEffect, useRef} from 'react';
import { useAutoTranslation } from '../../hooks/useAutoTranslation';
import { useLocalization } from '../../context/LocalizationContext';
import { cn } from '../../utils/cn';
import {
  Settings,
  Globe,
  IndianRupee,
  Activity,
  AlertTriangle,
  CheckCircle,
  Clock,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  Eye,
  Edit,
  Trash2,
  Plus,
  ExternalLink
} from 'lucide-react';
import { ApplyToSelector, ApplyToConfirmation, ApplyToScope } from '../settings/ApplyToSelector';
import { useSettingsInheritance, useAffectedPropertiesCount } from '../../hooks/useSettingsInheritance';
import { useProperty } from '../../context/PropertyContext';
import { api } from '../../services/api';

interface Channel {
  channelId: string;
  channelName: string;
  status: {
    isActive: boolean;
    connectionStatus: 'connected' | 'disconnected' | 'error' | 'testing';
    lastSync: {
      rates?: string;
      inventory?: string;
      content?: string;
    };
  };
  languageSettings: {
    primaryLanguage: string;
    supportedLanguages: Array<{
      languageCode: string;
      isActive: boolean;
      translationQuality: string;
    }>;
    autoTranslate: boolean;
  };
  currencySettings: {
    baseCurrency: string;
    supportedCurrencies: Array<{
      currencyCode: string;
      isActive: boolean;
      markup: number;
    }>;
    autoConvert: boolean;
  };
  performance: {
    averageResponseTime: number;
    uptimePercentage: number;
    translationAccuracy: number;
  };
  syncHealthScore: number;
}

interface DashboardData {
  summary: {
    channels: {
      total: number;
      connected: number;
      connectionRate: number;
    };
    sync: {
      totalSyncs: number;
      successRate: number;
      averageResponseTime: number;
    };
    translation: {
      totalTranslations: number;
      averageQuality: number;
    };
    errors: {
      total: number;
      critical: number;
      errorRate: number;
    };
  };
  channels: Channel[];
  alerts: Array<{
    type: string;
    severity: string;
    message: string;
    timestamp: string;
  }>;
}

interface OTAChannelManagerProps {
  hotelId: string;
  className?: string;
}

const CHANNEL_ICONS: Record<string, string> = {
  booking_com: '🏨',
  expedia: '✈️',
  airbnb: '🏠',
  agoda: '🌏',
  hotels_com: '🏩',
  trivago: '🔍',
  kayak: '🛶',
  priceline: '💰'
};

const STATUS_COLORS = {
  connected: 'text-green-600 bg-green-50',
  disconnected: 'text-gray-600 bg-gray-50',
  error: 'text-red-600 bg-red-50',
  testing: 'text-yellow-600 bg-yellow-50'
};

export const OTAChannelManager: React.FC<OTAChannelManagerProps> = ({
  hotelId,
  className
}) => {
  const { currentLanguage } = useLocalization();
  const { translateText } = useAutoTranslation();

  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'channels' | 'analytics'>('overview');
  const [refreshing, setRefreshing] = useState(false);

  // Multi-property support
  const { selectedProperty, selectedPropertyId } = useProperty();
  const [applyToScope, setApplyToScope] = useState<ApplyToScope>('single');
  const [showSuccess, setShowSuccess] = useState(false);

  const {
    useInheritanceStatus,
    applySettings,
    isUpdating,
    updateError,
    showConfirmation,
    pendingUpdate,
    confirmBulkUpdate,
    cancelBulkUpdate,
  } = useSettingsInheritance();

  const { data: inheritanceStatus } = useInheritanceStatus(selectedPropertyId);
  const affectedCount = useAffectedPropertiesCount(
    applyToScope,
    inheritanceStatus?.groupPropertyCount || 0
  );

  // Load dashboard data
  const successTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (successTimerRef.current) clearTimeout(successTimerRef.current);
    };
  }, []);

  useEffect(() => {
    loadDashboardData();
  }, [hotelId]);

  const loadDashboardData = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Simulate API call - replace with actual API
      const { data } = await api.get(`/hotels/${hotelId}/dashboard`);
      setDashboardData(data.data);
      
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadDashboardData();
    setRefreshing(false);
  };

  const handleChannelTest = async (channelId: string) => {
    try {
      await api.post(`/hotels/${hotelId}/channels/${channelId}/test`);

      // Refresh data after test
      await loadDashboardData();

    } catch {
      // Error handled silently
    }
  };

  const handleChannelUpdate = async (channelId: string, updateData: Record<string, unknown>) => {
    try {
      // Multi-property update
      if (applyToScope !== 'single') {
        const result = await applySettings({
          scope: applyToScope,
          propertyId: selectedPropertyId,
          settingUpdates: { channelId, ...updateData },
          settingType: 'ota_channel_configuration',
        });

        if (!result) return; // Confirmation dialog shown

        setShowSuccess(true);
        if (successTimerRef.current) clearTimeout(successTimerRef.current);
        successTimerRef.current = setTimeout(() => setShowSuccess(false), 3000);
        setApplyToScope('single');
      } else {
        // Single property update - existing logic
        await api.put(`/hotels/${hotelId}/channels/${channelId}`, updateData);
      }

      await loadDashboardData();

    } catch {
      // Error handled silently
    }
  };

  const handleConfirm = async () => {
    if (pendingUpdate) {
      const result = await confirmBulkUpdate();
      if (result) {
        setShowSuccess(true);
        if (successTimerRef.current) clearTimeout(successTimerRef.current);
        successTimerRef.current = setTimeout(() => setShowSuccess(false), 3000);
        setApplyToScope('single');
        await loadDashboardData();
      }
    }
  };

  const formatLastSync = (timestamp?: string) => {
    if (!timestamp) return 'Never';
    
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
    return `${Math.floor(diffMins / 1440)}d ago`;
  };

  const renderOverview = () => {
    if (!dashboardData) return null;

    const { summary, alerts } = dashboardData;

    return (
      <div className="space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-6 rounded-lg border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Channels Connected</p>
                <p className="text-2xl font-bold text-gray-900">
                  {summary.channels.connected}/{summary.channels.total}
                </p>
              </div>
              <div className="p-3 bg-blue-50 rounded-full">
                <Globe className="w-6 h-6 text-blue-600" />
              </div>
            </div>
            <div className="mt-2">
              <span className={cn(
                "text-sm font-medium",
                summary.channels.connectionRate > 80 ? "text-green-600" : 
                summary.channels.connectionRate > 60 ? "text-yellow-600" : "text-red-600"
              )}>
                {summary.channels.connectionRate.toFixed(1)}% connected
              </span>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Sync Success Rate</p>
                <p className="text-2xl font-bold text-gray-900">
                  {summary.sync.successRate.toFixed(1)}%
                </p>
              </div>
              <div className="p-3 bg-green-50 rounded-full">
                <Activity className="w-6 h-6 text-green-600" />
              </div>
            </div>
            <div className="mt-2">
              <span className="text-sm text-gray-600">
                {summary.sync.totalSyncs} total syncs
              </span>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Translation Quality</p>
                <p className="text-2xl font-bold text-gray-900">
                  {summary.translation.averageQuality.toFixed(1)}%
                </p>
              </div>
              <div className="p-3 bg-purple-50 rounded-full">
                <Globe className="w-6 h-6 text-purple-600" />
              </div>
            </div>
            <div className="mt-2">
              <span className="text-sm text-gray-600">
                {summary.translation.totalTranslations} translations
              </span>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Error Rate</p>
                <p className="text-2xl font-bold text-gray-900">
                  {summary.errors.errorRate.toFixed(1)}%
                </p>
              </div>
              <div className="p-3 bg-red-50 rounded-full">
                <AlertTriangle className="w-6 h-6 text-red-600" />
              </div>
            </div>
            <div className="mt-2">
              <span className="text-sm text-red-600">
                {summary.errors.critical} critical errors
              </span>
            </div>
          </div>
        </div>

        {/* Alerts */}
        {alerts && alerts.length > 0 && (
          <div className="bg-white rounded-lg border">
            <div className="p-6 border-b">
              <h3 className="text-lg font-semibold text-gray-900">Active Alerts</h3>
            </div>
            <div className="p-6">
              <div className="space-y-3">
                {alerts.map((alert, index) => (
                  <div key={`alerts-${index}`} className={cn(
                    "flex items-start gap-3 p-3 rounded-lg",
                    alert.severity === 'critical' ? 'bg-red-50 border border-red-200' :
                    alert.severity === 'high' ? 'bg-orange-50 border border-orange-200' :
                    alert.severity === 'medium' ? 'bg-yellow-50 border border-yellow-200' :
                    'bg-blue-50 border border-blue-200'
                  )}>
                    <AlertTriangle className={cn(
                      "w-5 h-5 mt-0.5",
                      alert.severity === 'critical' ? 'text-red-500' :
                      alert.severity === 'high' ? 'text-orange-500' :
                      alert.severity === 'medium' ? 'text-yellow-500' :
                      'text-blue-500'
                    )} />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">{alert.message}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        {new Date(alert.timestamp).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderChannels = () => {
    if (!dashboardData) return null;

    return (
      <div className="space-y-4">
        {/* Multi-property selector */}
        <div className="border border-gray-200 rounded-lg p-4 bg-white">
          <ApplyToSelector
            value={applyToScope}
            onChange={setApplyToScope}
            isInGroup={inheritanceStatus?.hasGroup || false}
            groupName={inheritanceStatus?.groupName}
            totalProperties={inheritanceStatus?.groupPropertyCount || 0}
            showWarning={true}
            warningMessage="Changes to OTA channel settings will affect inventory and rate distribution across all properties in the selected scope."
          />
        </div>

        {dashboardData.channels.map((channel) => (
          <div key={channel.channelId} className="bg-white rounded-lg border">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">
                    {CHANNEL_ICONS[channel.channelId] || '📡'}
                  </span>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      {channel.channelName}
                    </h3>
                    <span className={cn(
                      "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium",
                      STATUS_COLORS[channel.status.connectionStatus]
                    )}>
                      {channel.status.connectionStatus}
                    </span>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <button aria-label="Close"
                    onClick={() => handleChannelTest(channel.channelId)}
                    className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
                    title="Test Connection"
                  >
                    <Activity className="w-4 h-4" />
                  </button>
                  <button aria-label="View"
                    onClick={() => setSelectedChannel(channel)}
                    className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
                    title="View Details"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                  <button aria-label="Edit"
                    className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
                    title="Edit Configuration"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="text-center p-3 bg-gray-50 rounded-lg">
                  <div className="text-lg font-semibold text-gray-900">
                    {channel.syncHealthScore}%
                  </div>
                  <div className="text-xs text-gray-600">Sync Health</div>
                </div>

                <div className="text-center p-3 bg-gray-50 rounded-lg">
                  <div className="text-lg font-semibold text-gray-900">
                    {channel.languageSettings.supportedLanguages.filter(l => l.isActive).length}
                  </div>
                  <div className="text-xs text-gray-600">Languages</div>
                </div>

                <div className="text-center p-3 bg-gray-50 rounded-lg">
                  <div className="text-lg font-semibold text-gray-900">
                    {channel.currencySettings.supportedCurrencies.filter(c => c.isActive).length}
                  </div>
                  <div className="text-xs text-gray-600">Currencies</div>
                </div>

                <div className="text-center p-3 bg-gray-50 rounded-lg">
                  <div className="text-lg font-semibold text-gray-900">
                    {channel.performance.averageResponseTime}ms
                  </div>
                  <div className="text-xs text-gray-600">Avg Response</div>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-gray-200">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Last Sync:</span>
                  <div className="flex items-center gap-4">
                    <span>Rates: {formatLastSync(channel.status.lastSync.rates)}</span>
                    <span>Inventory: {formatLastSync(channel.status.lastSync.inventory)}</span>
                    <span>Content: {formatLastSync(channel.status.lastSync.content)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderAnalytics = () => {
    return (
      <div className="bg-white rounded-lg border p-6">
        <div className="text-center py-12">
          <TrendingUp className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Advanced Analytics</h3>
          <p className="text-gray-600 mb-4">
            Detailed performance analytics and insights will be displayed here.
          </p>
          <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            View Full Analytics
          </button>
        </div>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className={cn("flex items-center justify-center py-12", className)}>
        <RefreshCw className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn("bg-red-50 border border-red-200 rounded-lg p-6 text-center", className)}>
        <AlertTriangle className="w-8 h-8 text-red-500 mx-auto mb-2" />
        <p className="text-red-700 font-medium">Failed to load OTA data</p>
        <p className="text-red-600 text-sm mt-1">{error}</p>
        <button 
          onClick={loadDashboardData}
          className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className={cn("space-y-6", className)}>
      {/* Success Message */}
      {showSuccess && (
        <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg">
          <p className="font-medium">Settings updated successfully!</p>
          {applyToScope !== 'single' && affectedCount > 1 && (
            <p className="text-sm mt-1">Changes applied to {affectedCount} properties</p>
          )}
        </div>
      )}

      {/* Error Message */}
      {updateError && (
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg">
          <p className="font-medium">Error: {updateError}</p>
        </div>
      )}

      {/* Inheritance Status Card */}
      {inheritanceStatus?.isInheriting && inheritanceStatus?.hasGroup && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start">
            <AlertTriangle className="w-5 h-5 text-blue-600 mr-3 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-blue-900">
                This property is part of: {inheritanceStatus.groupName}
              </p>
              <p className="text-xs text-blue-700 mt-1">
                OTA channel configurations can be managed centrally for all properties in this group.
                {inheritanceStatus.lastSyncedAt && (
                  <span className="ml-1">
                    Last synced: {new Date(inheritanceStatus.lastSyncedAt).toLocaleString()}
                  </span>
                )}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">OTA Channel Management</h2>
          <p className="text-gray-600">Manage your online travel agency integrations</p>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg"
          >
            <RefreshCw className={cn("w-4 h-4", refreshing && "animate-spin")} />
            Refresh
          </button>
          
          <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            <Plus className="w-4 h-4" />
            Add Channel
          </button>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-8">
          {[
            { id: 'overview', label: 'Overview', icon: Activity },
            { id: 'channels', label: 'Channels', icon: Globe },
            { id: 'analytics', label: 'Analytics', icon: TrendingUp }
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button aria-label="Close"
                key={tab.id}
                onClick={() => setActiveTab(tab.id as unknown)}
                className={cn(
                  "flex items-center gap-2 py-2 px-1 border-b-2 font-medium text-sm",
                  activeTab === tab.id
                    ? "border-blue-500 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                )}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Content */}
      {activeTab === 'overview' && renderOverview()}
      {activeTab === 'channels' && renderChannels()}
      {activeTab === 'analytics' && renderAnalytics()}

      {/* Confirmation Dialog */}
      <ApplyToConfirmation
        isOpen={showConfirmation}
        scope={applyToScope}
        affectedCount={affectedCount}
        settingName="OTA Channel Configuration"
        groupName={inheritanceStatus?.groupName}
        onConfirm={handleConfirm}
        onCancel={cancelBulkUpdate}
      />
    </div>
  );
};

export default OTAChannelManager;