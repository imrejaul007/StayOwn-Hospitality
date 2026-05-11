import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import {
  Wifi,
  Server,
  Link,
  TestTube,
  Save,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Settings,
  Clock,
  Shield,
  Zap
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { IntegrationSettings, HotelAllotmentSettings, TestResult } from '@/services/allotmentSettingsService';
import allotmentSettingsService from '@/services/allotmentSettingsService';
import { withErrorBoundary } from '../../ErrorBoundary';

interface IntegrationSettingsFormProps {
  settings: HotelAllotmentSettings | null;
  onSave: (settings: { integrationSettings: IntegrationSettings }) => Promise<void>;
  onChange?: () => void;
  loading?: boolean;
}

function IntegrationSettingsForm({
  settings,
  onSave,
  onChange,
  loading = false
}: IntegrationSettingsFormProps) {
  const [formData, setFormData] = useState<IntegrationSettings>({
    channelManager: {
      provider: 'none',
      isConnected: false,
      connectionSettings: {},
      syncSettings: {
        syncFrequency: 15,
        autoSync: true,
        syncInventory: true,
        syncRates: true,
        syncRestrictions: true
      },
      errorLog: []
    },
    pms: {
      provider: 'none',
      isConnected: false,
      connectionSettings: {},
      roomTypeMapping: {},
      syncSettings: {
        realTimeSync: false,
        syncFrequency: 60,
        syncBookings: true,
        syncInventory: true
      }
    },
    webhooks: []
  });

  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [testingStatus, setTestingStatus] = useState<{ [key: string]: boolean }>({});
  const [testResults, setTestResults] = useState<{ [key: string]: TestResult }>({});
  const [activeTab, setActiveTab] = useState('channel_manager');

  useEffect(() => {
    if (settings?.integrationSettings) {
      // Merge with default values to ensure all required properties exist
      setFormData(prev => ({
        ...prev,
        ...settings.integrationSettings,
        channelManager: {
          ...prev.channelManager,
          ...settings.integrationSettings.channelManager
        },
        pms: {
          ...prev.pms,
          ...settings.integrationSettings.pms
        },
        webhooks: settings.integrationSettings.webhooks || []
      }));
    }
  }, [settings]);

  const handleInputChange = (section: string, field: string, value: unknown) => {
    setFormData(prev => ({
      ...prev,
      [section]: {
        ...prev[section as keyof typeof prev],
        [field]: value
      }
    }));
    setHasChanges(true);
    onChange?.();
  };

  const handleNestedInputChange = (section: string, subsection: string, field: string, value: unknown) => {
    setFormData(prev => ({
      ...prev,
      [section]: {
        ...prev[section as keyof typeof prev],
        [subsection]: {
          ...prev[section as keyof typeof prev][subsection as string],
          [field]: value
        }
      }
    }));
    setHasChanges(true);
    onChange?.();
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await onSave({ integrationSettings: formData });
      setHasChanges(false);
      toast.success('Integration settings saved successfully');
    } catch (error) {
      toast.error('Failed to save integration settings');
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async (type: 'channel_manager' | 'pms' | 'webhook', config?: Record<string, unknown>) => {
    try {
      setTestingStatus(prev => ({ ...prev, [type]: true }));

      let testConfig = config;
      if (!testConfig) {
        testConfig = type === 'channel_manager' ? formData.channelManager : formData.pms;
      }

      const result = await allotmentSettingsService.testIntegration(type, testConfig);
      setTestResults(prev => ({ ...prev, [type]: result }));

      if (result.success) {
        toast.success(result.message);
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      toast.error(`Failed to test ${type} connection`);
    } finally {
      setTestingStatus(prev => ({ ...prev, [type]: false }));
    }
  };

  const addWebhook = () => {
    const newWebhook = {
      name: 'New Webhook',
      url: '',
      events: [{ type: 'inventory_update' as const }],
      isActive: true,
      retryPolicy: {
        maxRetries: 3,
        retryDelay: 300
      }
    };

    setFormData(prev => ({
      ...prev,
      webhooks: [...prev.webhooks, newWebhook]
    }));
    setHasChanges(true);
    onChange?.();
  };

  const removeWebhook = (index: number) => {
    setFormData(prev => ({
      ...prev,
      webhooks: prev.webhooks.filter((_, i) => i !== index)
    }));
    setHasChanges(true);
    onChange?.();
  };

  const getConnectionStatus = (type: 'channel_manager' | 'pms') => {
    const isConnected = formData[type]?.isConnected || false;
    const testResult = testResults[type];

    if (testingStatus[type]) {
      return { status: 'testing', color: 'blue', message: 'Testing...' };
    }

    if (testResult) {
      if (testResult.success) {
        return { status: 'connected', color: 'green', message: 'Connected' };
      } else {
        return { status: 'error', color: 'red', message: 'Connection Failed' };
      }
    }

    if (isConnected) {
      return { status: 'connected', color: 'green', message: 'Connected' };
    }

    return { status: 'disconnected', color: 'gray', message: 'Not Connected' };
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center">
            <Wifi className="w-6 h-6 mr-2" />
            Integration Settings
          </h2>
          <p className="text-gray-600 mt-1">
            Configure channel manager, PMS, and webhook integrations
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <Badge
            variant={hasChanges ? 'secondary' : 'default'}
            className="flex items-center"
          >
            {hasChanges ? (
              <>
                <AlertCircle className="w-3 h-3 mr-1" />
                Unsaved Changes
              </>
            ) : (
              <>
                <CheckCircle className="w-3 h-3 mr-1" />
                Saved
              </>
            )}
          </Badge>

          <Button
            onClick={handleSave}
            disabled={saving || !hasChanges || loading}
            className="flex items-center"
          >
            {saving ? (
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            Save Settings
          </Button>
        </div>
      </div>

      {/* Integration Tabs */}
      <Card>
        <CardHeader>
          <CardTitle>Integration Configuration</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="channel_manager" className="flex items-center">
                <Server className="w-4 h-4 mr-1" />
                Channel Manager
              </TabsTrigger>
              <TabsTrigger value="pms" className="flex items-center">
                <Settings className="w-4 h-4 mr-1" />
                PMS
              </TabsTrigger>
              <TabsTrigger value="webhooks" className="flex items-center">
                <Link className="w-4 h-4 mr-1" />
                Webhooks
              </TabsTrigger>
            </TabsList>

            {/* Channel Manager Settings */}
            <TabsContent value="channel_manager" className="space-y-6 mt-6">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label>Provider</Label>
                      <Select
                        value={formData.channelManager.provider}
                        onValueChange={(value) => handleInputChange('channelManager', 'provider', value)}
                      >
                        <SelectTrigger className="mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">No Provider</SelectItem>
                          <SelectItem value="siteminder">SiteMinder</SelectItem>
                          <SelectItem value="cloudbeds">Cloudbeds</SelectItem>
                          <SelectItem value="rentals_united">Rentals United</SelectItem>
                          <SelectItem value="channex">Channex</SelectItem>
                          <SelectItem value="custom">Custom Integration</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex items-center space-x-2">
                      <div className="flex-1">
                        <Label>Connection Status</Label>
                        <div className="mt-1">
                          <Badge variant={getConnectionStatus('channel_manager').color as unknown}>
                            {getConnectionStatus('channel_manager').message}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </div>

                  {formData.channelManager.provider !== 'none' && (
                    <div className="space-y-4">
                      <h4 className="font-medium text-lg">Connection Settings</h4>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="cm-api-url">API URL</Label>
                          <Input
                            id="cm-api-url"
                            placeholder="https://api.example.com/v1"
                            value={formData.channelManager?.connectionSettings?.apiUrl || ''}
                            onChange={(e) => handleNestedInputChange('channelManager', 'connectionSettings', 'apiUrl', e.target.value)}
                            className="mt-1"
                          />
                        </div>

                        <div>
                          <Label htmlFor="cm-api-key">API Key</Label>
                          <Input
                            id="cm-api-key"
                            type="password"
                            placeholder="Enter API key"
                            value={formData.channelManager?.connectionSettings?.apiKey || ''}
                            onChange={(e) => handleNestedInputChange('channelManager', 'connectionSettings', 'apiKey', e.target.value)}
                            className="mt-1"
                          />
                        </div>

                        <div>
                          <Label htmlFor="cm-property-id">Property ID</Label>
                          <Input
                            id="cm-property-id"
                            placeholder="Property identifier"
                            value={formData.channelManager?.connectionSettings?.propertyId || ''}
                            onChange={(e) => handleNestedInputChange('channelManager', 'connectionSettings', 'propertyId', e.target.value)}
                            className="mt-1"
                          />
                        </div>

                        <div>
                          <Label htmlFor="cm-username">Username</Label>
                          <Input
                            id="cm-username"
                            placeholder="Username (if required)"
                            value={formData.channelManager?.connectionSettings?.username || ''}
                            onChange={(e) => handleNestedInputChange('channelManager', 'connectionSettings', 'username', e.target.value)}
                            className="mt-1"
                          />
                        </div>
                      </div>

                      <div className="space-y-4">
                        <h4 className="font-medium text-lg">Sync Settings</h4>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <Label htmlFor="cm-sync-frequency">Sync Frequency (minutes)</Label>
                            <Input
                              id="cm-sync-frequency"
                              type="number"
                              min="5"
                              max="1440"
                              value={formData.channelManager?.syncSettings?.syncFrequency}
                              onChange={(e) => handleNestedInputChange('channelManager', 'syncSettings', 'syncFrequency', parseInt(e.target.value))}
                              className="mt-1"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="flex items-center justify-between">
                            <Label>Auto Sync</Label>
                            <Switch
                              checked={formData.channelManager?.syncSettings?.autoSync}
                              onCheckedChange={(checked) => handleNestedInputChange('channelManager', 'syncSettings', 'autoSync', checked)}
                            />
                          </div>

                          <div className="flex items-center justify-between">
                            <Label>Sync Inventory</Label>
                            <Switch
                              checked={formData.channelManager?.syncSettings?.syncInventory}
                              onCheckedChange={(checked) => handleNestedInputChange('channelManager', 'syncSettings', 'syncInventory', checked)}
                            />
                          </div>

                          <div className="flex items-center justify-between">
                            <Label>Sync Rates</Label>
                            <Switch
                              checked={formData.channelManager?.syncSettings?.syncRates}
                              onCheckedChange={(checked) => handleNestedInputChange('channelManager', 'syncSettings', 'syncRates', checked)}
                            />
                          </div>

                          <div className="flex items-center justify-between">
                            <Label>Sync Restrictions</Label>
                            <Switch
                              checked={formData.channelManager?.syncSettings?.syncRestrictions}
                              onCheckedChange={(checked) => handleNestedInputChange('channelManager', 'syncSettings', 'syncRestrictions', checked)}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">Connection Test</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <Button
                        onClick={() => handleTestConnection('channel_manager')}
                        disabled={testingStatus.channel_manager || formData.channelManager.provider === 'none'}
                        variant="outline"
                        className="w-full"
                      >
                        {testingStatus.channel_manager ? (
                          <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <TestTube className="w-4 h-4 mr-2" />
                        )}
                        Test Connection
                      </Button>

                      {testResults.channel_manager && (
                        <Alert variant={testResults.channel_manager.success ? 'default' : 'destructive'}>
                          <AlertCircle className="w-4 h-4" />
                          <AlertDescription className="text-sm">
                            {testResults.channel_manager.message}
                          </AlertDescription>
                        </Alert>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">Sync Status</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span>Last Sync:</span>
                        <span className="text-gray-500">
                          {formData.channelManager?.lastSync
                            ? new Date(formData.channelManager.lastSync).toLocaleString()
                            : 'Never'
                          }
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span>Error Count:</span>
                        <Badge variant="secondary">
                          {(formData.channelManager?.errorLog || []).filter(log => !log.resolved).length}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </TabsContent>

            {/* PMS Settings */}
            <TabsContent value="pms" className="space-y-6 mt-6">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label>Provider</Label>
                      <Select
                        value={formData.pms.provider}
                        onValueChange={(value) => handleInputChange('pms', 'provider', value)}
                      >
                        <SelectTrigger className="mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">No Provider</SelectItem>
                          <SelectItem value="opera">Opera</SelectItem>
                          <SelectItem value="protel">Protel</SelectItem>
                          <SelectItem value="mews">Mews</SelectItem>
                          <SelectItem value="cloudbeds">Cloudbeds</SelectItem>
                          <SelectItem value="custom">Custom Integration</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex items-center space-x-2">
                      <div className="flex-1">
                        <Label>Connection Status</Label>
                        <div className="mt-1">
                          <Badge variant={getConnectionStatus('pms').color as unknown}>
                            {getConnectionStatus('pms').message}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </div>

                  {formData.pms.provider !== 'none' && (
                    <div className="space-y-4">
                      <h4 className="font-medium text-lg">Connection Settings</h4>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="pms-api-url">API URL</Label>
                          <Input
                            id="pms-api-url"
                            placeholder="https://pms.example.com/api"
                            value={formData.pms?.connectionSettings?.apiUrl || ''}
                            onChange={(e) => handleNestedInputChange('pms', 'connectionSettings', 'apiUrl', e.target.value)}
                            className="mt-1"
                          />
                        </div>

                        <div>
                          <Label htmlFor="pms-api-key">API Key</Label>
                          <Input
                            id="pms-api-key"
                            type="password"
                            placeholder="Enter API key"
                            value={formData.pms?.connectionSettings?.apiKey || ''}
                            onChange={(e) => handleNestedInputChange('pms', 'connectionSettings', 'apiKey', e.target.value)}
                            className="mt-1"
                          />
                        </div>

                        <div>
                          <Label htmlFor="pms-property-code">Property Code</Label>
                          <Input
                            id="pms-property-code"
                            placeholder="Property code in PMS"
                            value={formData.pms?.connectionSettings?.propertyCode || ''}
                            onChange={(e) => handleNestedInputChange('pms', 'connectionSettings', 'propertyCode', e.target.value)}
                            className="mt-1"
                          />
                        </div>
                      </div>

                      <div className="space-y-4">
                        <h4 className="font-medium text-lg">Sync Settings</h4>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="flex items-center justify-between">
                            <Label>Real-time Sync</Label>
                            <Switch
                              checked={formData.pms?.syncSettings?.realTimeSync}
                              onCheckedChange={(checked) => handleNestedInputChange('pms', 'syncSettings', 'realTimeSync', checked)}
                            />
                          </div>

                          {!formData.pms?.syncSettings?.realTimeSync && (
                            <div>
                              <Label htmlFor="pms-sync-frequency">Sync Frequency (minutes)</Label>
                              <Input
                                id="pms-sync-frequency"
                                type="number"
                                min="15"
                                max="1440"
                                value={formData.pms?.syncSettings?.syncFrequency}
                                onChange={(e) => handleNestedInputChange('pms', 'syncSettings', 'syncFrequency', parseInt(e.target.value))}
                                className="mt-1"
                              />
                            </div>
                          )}

                          <div className="flex items-center justify-between">
                            <Label>Sync Bookings</Label>
                            <Switch
                              checked={formData.pms?.syncSettings?.syncBookings}
                              onCheckedChange={(checked) => handleNestedInputChange('pms', 'syncSettings', 'syncBookings', checked)}
                            />
                          </div>

                          <div className="flex items-center justify-between">
                            <Label>Sync Inventory</Label>
                            <Switch
                              checked={formData.pms?.syncSettings?.syncInventory}
                              onCheckedChange={(checked) => handleNestedInputChange('pms', 'syncSettings', 'syncInventory', checked)}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">Connection Test</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <Button
                        onClick={() => handleTestConnection('pms')}
                        disabled={testingStatus.pms || formData.pms.provider === 'none'}
                        variant="outline"
                        className="w-full"
                      >
                        {testingStatus.pms ? (
                          <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <TestTube className="w-4 h-4 mr-2" />
                        )}
                        Test Connection
                      </Button>

                      {testResults.pms && (
                        <Alert variant={testResults.pms.success ? 'default' : 'destructive'}>
                          <AlertCircle className="w-4 h-4" />
                          <AlertDescription className="text-sm">
                            {testResults.pms.message}
                          </AlertDescription>
                        </Alert>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">Sync Status</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span>Last Sync:</span>
                        <span className="text-gray-500">
                          {formData.pms?.lastSync
                            ? new Date(formData.pms.lastSync).toLocaleString()
                            : 'Never'
                          }
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span>Sync Mode:</span>
                        <Badge variant="secondary">
                          {formData.pms?.syncSettings?.realTimeSync ? 'Real-time' : 'Batch'}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </TabsContent>

            {/* Webhooks Settings */}
            <TabsContent value="webhooks" className="space-y-6 mt-6">
              <div className="flex items-center justify-between">
                <h4 className="font-medium text-lg">Webhook Endpoints</h4>
                <Button onClick={addWebhook} variant="outline" size="sm">
                  <Link className="w-4 h-4 mr-2" />
                  Add Webhook
                </Button>
              </div>

              <div className="space-y-4">
                {formData.webhooks.length === 0 ? (
                  <Alert>
                    <AlertCircle className="w-4 h-4" />
                    <AlertDescription>
                      No webhooks configured. Click "Add Webhook" to create your first webhook endpoint.
                    </AlertDescription>
                  </Alert>
                ) : (
                  formData.webhooks.map((webhook, index) => (
                    <Card key={`formData-webhooks-${index}`}>
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-base">Webhook {index + 1}</CardTitle>
                          <div className="flex items-center space-x-2">
                            <Switch
                              checked={webhook.isActive}
                              onCheckedChange={(checked) => {
                                const updatedWebhooks = [...formData.webhooks];
                                updatedWebhooks[index] = { ...webhook, isActive: checked };
                                setFormData(prev => ({ ...prev, webhooks: updatedWebhooks }));
                                setHasChanges(true);
                                onChange?.();
                              }}
                            />
                            <Button
                              onClick={() => removeWebhook(index)}
                              variant="outline"
                              size="sm"
                              className="text-red-600"
                            >
                              Remove
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <Label>Name</Label>
                            <Input
                              placeholder="Webhook name"
                              value={webhook.name}
                              onChange={(e) => {
                                const updatedWebhooks = [...formData.webhooks];
                                updatedWebhooks[index] = { ...webhook, name: e.target.value };
                                setFormData(prev => ({ ...prev, webhooks: updatedWebhooks }));
                                setHasChanges(true);
                                onChange?.();
                              }}
                              className="mt-1"
                            />
                          </div>

                          <div>
                            <Label>URL</Label>
                            <Input
                              placeholder="https://example.com/webhook"
                              value={webhook.url}
                              onChange={(e) => {
                                const updatedWebhooks = [...formData.webhooks];
                                updatedWebhooks[index] = { ...webhook, url: e.target.value };
                                setFormData(prev => ({ ...prev, webhooks: updatedWebhooks }));
                                setHasChanges(true);
                                onChange?.();
                              }}
                              className="mt-1"
                            />
                          </div>
                        </div>

                        <div>
                          <Label>Events</Label>
                          <div className="grid grid-cols-2 gap-2 mt-2">
                            {['inventory_update', 'booking_created', 'booking_cancelled', 'rate_changed'].map((event) => (
                              <label key={event} className="flex items-center space-x-2 text-sm">
                                <input
                                  type="checkbox"
                                  checked={webhook.events.some(e => e.type === event)}
                                  onChange={(e) => {
                                    const updatedWebhooks = [...formData.webhooks];
                                    if (e.target.checked) {
                                      updatedWebhooks[index].events.push({ type: event as string });
                                    } else {
                                      updatedWebhooks[index].events = updatedWebhooks[index].events.filter(ev => ev.type !== event);
                                    }
                                    setFormData(prev => ({ ...prev, webhooks: updatedWebhooks }));
                                    setHasChanges(true);
                                    onChange?.();
                                  }}
                                  className="rounded border-gray-300"
                                />
                                <span className="capitalize">{event.replace('_', ' ')}</span>
                              </label>
                            ))}
                          </div>
                        </div>

                        <div className="flex items-center justify-end">
                          <Button
                            onClick={() => handleTestConnection('webhook', webhook)}
                            disabled={testingStatus[`webhook_${index}`] || !webhook.url}
                            variant="outline"
                            size="sm"
                          >
                            {testingStatus[`webhook_${index}`] ? (
                              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                            ) : (
                              <TestTube className="w-4 h-4 mr-2" />
                            )}
                            Test Webhook
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}

export default withErrorBoundary(IntegrationSettingsForm, { level: 'component' });