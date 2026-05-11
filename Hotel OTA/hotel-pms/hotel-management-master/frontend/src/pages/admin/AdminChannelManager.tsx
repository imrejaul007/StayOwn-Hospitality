/**
 * Admin Channel Manager
 *
 * Configure and manage channel manager integrations (SiteMinder, STAAH, RateGain)
 * for inventory synchronization across OTAs.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { withErrorBoundary } from '../../components/ErrorBoundary';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { Modal } from '../../components/ui/Modal';
import EmptyState from '../../components/ui/EmptyState';
import toast from 'react-hot-toast';
import {
  Globe,
  RefreshCw,
  Settings,
  CheckCircle,
  XCircle,
  ChevronRight,
  Link,
  Unlink,
  Clock,
  AlertCircle,
} from 'lucide-react';

type ChannelProvider = 'siteminder' | 'staah' | 'rategain' | 'custom';

interface ChannelConfig {
  id: string;
  provider: ChannelProvider;
  hotelId: string;
  apiUrl: string;
  apiKey?: string;
  apiSecret?: string;
  propertyId?: string;
  isActive: boolean;
  lastSyncAt?: string;
  lastError?: string;
  syncStatus: 'idle' | 'syncing' | 'error';
}

interface SyncLog {
  id: string;
  channelConfigId: string;
  direction: 'inbound' | 'outbound';
  event: string;
  status: 'success' | 'error';
  message: string;
  createdAt: string;
}

const providerLabels: Record<ChannelProvider, string> = {
  siteminder: 'SiteMinder',
  staah: 'STAAH',
  rategain: 'RateGain',
  custom: 'Custom API',
};

const providerIcons: Record<ChannelProvider, string> = {
  siteminder: '🏨',
  staah: '📡',
  rategain: '📊',
  custom: '⚙️',
};

const AdminChannelManager: React.FC = () => {
  const [configs, setConfigs] = useState<ChannelConfig[]>([]);
  const [logs, setLogs] = useState<SyncLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [showLogsModal, setShowLogsModal] = useState(false);
  const [editingConfig, setEditingConfig] = useState<ChannelConfig | null>(null);
  const [formData, setFormData] = useState({
    provider: 'siteminder' as ChannelProvider,
    apiUrl: '',
    apiKey: '',
    apiSecret: '',
    propertyId: '',
  });

  // Fetch channel configs
  const fetchConfigs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/v1/channel-manager/configs', {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('ota_access_token')}`,
        },
      });
      if (res.ok) {
        const data = await res.json();
        setConfigs(data.configs || []);
      }
    } catch (error) {
      console.error('Failed to fetch channel configs:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch sync logs
  const fetchLogs = useCallback(async () => {
    try {
      const res = await fetch('/v1/channel-manager/logs?limit=50', {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('ota_access_token')}`,
        },
      });
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs || []);
      }
    } catch (error) {
      console.error('Failed to fetch sync logs:', error);
    }
  }, []);

  useEffect(() => {
    fetchConfigs();
    fetchLogs();
  }, [fetchConfigs, fetchLogs]);

  // Configure channel
  const handleConfigure = async () => {
    try {
      const res = await fetch('/v1/channel-manager/configure', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('ota_access_token')}`,
        },
        body: JSON.stringify(formData),
      });
      if (res.ok) {
        toast.success('Channel configured successfully');
        setShowConfigModal(false);
        setEditingConfig(null);
        setFormData({
          provider: 'siteminder',
          apiUrl: '',
          apiKey: '',
          apiSecret: '',
          propertyId: '',
        });
        fetchConfigs();
      } else {
        const data = await res.json();
        toast.error(data.message || 'Failed to configure channel');
      }
    } catch (error) {
      toast.error('Failed to configure channel');
    }
  };

  // Trigger sync
  const handleSync = async (configId: string) => {
    setSyncing(configId);
    try {
      const res = await fetch('/v1/channel-manager/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('ota_access_token')}`,
        },
        body: JSON.stringify({ configId }),
      });
      if (res.ok) {
        toast.success('Sync started');
        fetchConfigs();
        fetchLogs();
      } else {
        toast.error('Sync failed');
      }
    } catch (error) {
      toast.error('Sync failed');
    } finally {
      setSyncing(null);
    }
  };

  // Toggle active status
  const handleToggle = async (configId: string, isActive: boolean) => {
    try {
      const res = await fetch(`/v1/channel-manager/configs/${configId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('ota_access_token')}`,
        },
        body: JSON.stringify({ isActive }),
      });
      if (res.ok) {
        toast.success(isActive ? 'Channel activated' : 'Channel deactivated');
        fetchConfigs();
      }
    } catch (error) {
      toast.error('Failed to update channel');
    }
  };

  // Format date
  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'Never';
    return new Date(dateStr).toLocaleString();
  };

  // Get time since last sync
  const getTimeSince = (dateStr?: string) => {
    if (!dateStr) return '';
    const diff = Date.now() - new Date(dateStr).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Channel Manager</h1>
          <p className="text-gray-500 mt-1">
            Manage OTA integrations (SiteMinder, STAAH, RateGain)
          </p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => { fetchLogs(); setShowLogsModal(true); }}>
            <Clock className="w-4 h-4 mr-2" />
            View Logs
          </Button>
          <Button onClick={() => setShowConfigModal(true)}>
            <Link className="w-4 h-4 mr-2" />
            Add Channel
          </Button>
        </div>
      </div>

      {/* Channel List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : configs.length === 0 ? (
        <EmptyState
          icon={Globe}
          title="No channels configured"
          description="Add your first channel manager to sync inventory across OTAs"
          action={
            <Button onClick={() => setShowConfigModal(true)}>
              <Link className="w-4 h-4 mr-2" />
              Add Channel
            </Button>
          }
        />
      ) : (
        <div className="space-y-4">
          {configs.map((config) => (
            <Card key={config.id} className={!config.isActive ? 'opacity-60' : ''}>
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  {/* Channel Info */}
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center text-2xl">
                      {providerIcons[config.provider]}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-lg">{providerLabels[config.provider]}</h3>
                        <Badge variant={config.isActive ? 'success' : 'default'}>
                          {config.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                        {config.syncStatus === 'syncing' && (
                          <Badge variant="warning">
                            <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
                            Syncing
                          </Badge>
                        )}
                        {config.syncStatus === 'error' && (
                          <Badge variant="danger">
                            <AlertCircle className="w-3 h-3 mr-1" />
                            Error
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-gray-500 mb-2">
                        {config.apiUrl || 'No URL configured'}
                      </p>
                      {config.lastSyncAt && (
                        <p className="text-xs text-gray-400">
                          Last sync: {getTimeSince(config.lastSyncAt)}
                        </p>
                      )}
                      {config.lastError && (
                        <p className="text-xs text-red-500 mt-1">
                          Error: {config.lastError}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleSync(config.id)}
                      disabled={syncing === config.id || !config.isActive}
                    >
                      <RefreshCw className={`w-4 h-4 mr-1 ${syncing === config.id ? 'animate-spin' : ''}`} />
                      {syncing === config.id ? 'Syncing...' : 'Sync Now'}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setEditingConfig(config);
                        setFormData({
                          provider: config.provider,
                          apiUrl: config.apiUrl,
                          apiKey: config.apiKey || '',
                          apiSecret: config.apiSecret || '',
                          propertyId: config.propertyId || '',
                        });
                        setShowConfigModal(true);
                      }}
                    >
                      <Settings className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleToggle(config.id, !config.isActive)}
                    >
                      {config.isActive ? <Unlink className="w-4 h-4 text-red-500" /> : <Link className="w-4 h-4 text-green-500" />}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Config Modal */}
      <Modal
        isOpen={showConfigModal}
        onClose={() => {
          setShowConfigModal(false);
          setEditingConfig(null);
          setFormData({
            provider: 'siteminder',
            apiUrl: '',
            apiKey: '',
            apiSecret: '',
            propertyId: '',
          });
        }}
        title={editingConfig ? `Edit ${providerLabels[editingConfig.provider]}` : 'Configure Channel'}
      >
        <div className="space-y-4">
          {/* Provider Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Channel Provider</label>
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(providerLabels) as ChannelProvider[]).map((provider) => (
                <button
                  key={provider}
                  type="button"
                  onClick={() => setFormData({ ...formData, provider })}
                  className={`p-3 border rounded-lg text-left transition-colors ${
                    formData.provider === provider
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <span className="text-lg mr-2">{providerIcons[provider]}</span>
                  <span className="font-medium">{providerLabels[provider]}</span>
                </button>
              ))}
            </div>
          </div>

          {/* API URL */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">API URL</label>
            <Input
              value={formData.apiUrl}
              onChange={(e) => setFormData({ ...formData, apiUrl: e.target.value })}
              placeholder="https://api.siteminder.com/v1"
            />
          </div>

          {/* Property ID */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Property ID</label>
            <Input
              value={formData.propertyId}
              onChange={(e) => setFormData({ ...formData, propertyId: e.target.value })}
              placeholder="PROP12345"
            />
          </div>

          {/* API Key */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">API Key</label>
            <Input
              type="password"
              value={formData.apiKey}
              onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
              placeholder="Your API key"
            />
          </div>

          {/* API Secret */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">API Secret</label>
            <Input
              type="password"
              value={formData.apiSecret}
              onChange={(e) => setFormData({ ...formData, apiSecret: e.target.value })}
              placeholder="Your API secret"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button
              variant="outline"
              onClick={() => {
                setShowConfigModal(false);
                setEditingConfig(null);
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleConfigure}>
              {editingConfig ? 'Save Changes' : 'Configure'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Logs Modal */}
      <Modal
        isOpen={showLogsModal}
        onClose={() => setShowLogsModal(false)}
        title="Sync Logs"
      >
        <div className="max-h-96 overflow-y-auto space-y-2">
          {logs.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No sync logs yet</p>
          ) : (
            logs.map((log) => (
              <div
                key={log.id}
                className={`p-3 rounded-lg ${
                  log.status === 'success' ? 'bg-green-50' : 'bg-red-50'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    {log.status === 'success' ? (
                      <CheckCircle className="w-4 h-4 text-green-600" />
                    ) : (
                      <XCircle className="w-4 h-4 text-red-600" />
                    )}
                    <span className="font-medium text-sm">{log.event}</span>
                    <Badge variant={log.direction === 'inbound' ? 'info' : 'default'}>
                      {log.direction}
                    </Badge>
                  </div>
                  <span className="text-xs text-gray-500">
                    {new Date(log.createdAt).toLocaleString()}
                  </span>
                </div>
                <p className="text-sm text-gray-600 ml-6">{log.message}</p>
              </div>
            ))
          )}
        </div>
      </Modal>
    </div>
  );
};

export default withErrorBoundary(AdminChannelManager);
