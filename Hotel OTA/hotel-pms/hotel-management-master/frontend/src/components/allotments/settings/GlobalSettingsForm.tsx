import React, { useState, useEffect, useRef} from 'react';
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
  Settings,
  Save,
  RefreshCw,
  AlertCircle,
  Info,
  CheckCircle,
  Clock,
  Zap,
  Globe,
  IndianRupee
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { GlobalDefaults, DefaultChannel, HotelAllotmentSettings } from '@/services/allotmentSettingsService';
import { ApplyToSelector, ApplyToConfirmation, ApplyToScope } from '@/components/settings/ApplyToSelector';
import { useSettingsInheritance, useAffectedPropertiesCount } from '@/hooks/useSettingsInheritance';
import { useProperty } from '@/context/PropertyContext';

interface GlobalSettingsFormProps {
  settings: HotelAllotmentSettings | null;
  onSave: (settings: Partial<HotelAllotmentSettings>) => Promise<void>;
  onChange?: () => void;
  loading?: boolean;
}

export default function GlobalSettingsForm({
  settings,
  onSave,
  onChange,
  loading = false
}: GlobalSettingsFormProps) {
  const [formData, setFormData] = useState<{
    globalDefaults: GlobalDefaults;
    defaultChannels: DefaultChannel[];
    uiPreferences: unknown;
  }>({
    globalDefaults: {
      totalInventory: 10,
      defaultAllocationMethod: 'percentage',
      overbookingAllowed: false,
      overbookingLimit: 0,
      releaseWindow: 24,
      autoRelease: true,
      blockPeriod: 0,
      currency: 'INR',
      timezone: 'UTC'
    },
    defaultChannels: [],
    uiPreferences: {
      defaultView: 'overview',
      calendarView: 'month',
      showChannelColors: true,
      compactMode: false,
      autoRefresh: true,
      refreshInterval: 300
    }
  });

  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState('inventory');

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

  const successTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (successTimerRef.current) clearTimeout(successTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (settings) {
      setFormData({
        globalDefaults: settings.globalDefaults,
        defaultChannels: settings.defaultChannels,
        uiPreferences: settings.uiPreferences
      });
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

  const validateForm = (): boolean => {
    const errors: string[] = [];

    if (formData.globalDefaults.totalInventory < 1 || formData.globalDefaults.totalInventory > 1000) {
      errors.push('Total inventory must be between 1 and 1000');
    }

    if (formData.globalDefaults.overbookingLimit < 0 || formData.globalDefaults.overbookingLimit > 50) {
      errors.push('Overbooking limit must be between 0 and 50');
    }

    if (formData.globalDefaults.releaseWindow < 1 || formData.globalDefaults.releaseWindow > 168) {
      errors.push('Release window must be between 1 and 168 hours (1 week)');
    }

    setValidationErrors(errors);
    return errors.length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) {
      toast.error('Please fix validation errors before saving');
      return;
    }

    try {
      setSaving(true);

      // If multi-property update, use applySettings
      if (applyToScope !== 'single') {
        const result = await applySettings({
          scope: applyToScope,
          propertyId: selectedPropertyId,
          settingUpdates: formData,
          settingType: 'allotment_global_settings',
        });

        if (!result) {
          setSaving(false);
          return; // Confirmation dialog shown
        }

        setShowSuccess(true);
        if (successTimerRef.current) clearTimeout(successTimerRef.current);
        successTimerRef.current = setTimeout(() => setShowSuccess(false), 3000);
        toast.success(`Global settings saved successfully${
          applyToScope !== 'single' ? ` for ${result.propertiesUpdated} properties` : ''
        }`);
        setApplyToScope('single');
      } else {
        // Single property update
        await onSave(formData);
        toast.success('Global settings saved successfully');
      }

      setHasChanges(false);
    } catch (error) {
      toast.error('Failed to save global settings');
    } finally {
      setSaving(false);
    }
  };

  const handleConfirm = async () => {
    if (pendingUpdate) {
      setSaving(true);
      const result = await confirmBulkUpdate();
      if (result) {
        setShowSuccess(true);
        if (successTimerRef.current) clearTimeout(successTimerRef.current);
        successTimerRef.current = setTimeout(() => setShowSuccess(false), 3000);
        toast.success(`Settings updated for ${result.propertiesUpdated} properties`);
        setApplyToScope('single');
        setHasChanges(false);
      }
      setSaving(false);
    }
  };

  const getInventoryHealthStatus = () => {
    const inventory = formData.globalDefaults.totalInventory;
    if (inventory >= 50) return { status: 'excellent', color: 'green', message: 'High inventory capacity' };
    if (inventory >= 20) return { status: 'good', color: 'blue', message: 'Good inventory capacity' };
    if (inventory >= 10) return { status: 'moderate', color: 'yellow', message: 'Moderate inventory capacity' };
    return { status: 'low', color: 'red', message: 'Low inventory capacity' };
  };

  const inventoryStatus = getInventoryHealthStatus();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center">
            <Settings className="w-6 h-6 mr-2" />
            Global Settings
          </h2>
          <p className="text-gray-600 mt-1">
            Configure default settings that apply to new allotments
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

      {/* Success Message */}
      {showSuccess && (
        <Alert>
          <CheckCircle className="w-4 h-4" />
          <AlertDescription>
            <p className="font-medium">Global settings updated successfully!</p>
            {applyToScope !== 'single' && affectedCount > 1 && (
              <p className="text-sm mt-1">Changes applied to {affectedCount} properties</p>
            )}
          </AlertDescription>
        </Alert>
      )}

      {/* Error Message */}
      {updateError && (
        <Alert variant="destructive">
          <AlertCircle className="w-4 h-4" />
          <AlertDescription>
            Error: {updateError}
          </AlertDescription>
        </Alert>
      )}

      {/* Inheritance Status Card */}
      {inheritanceStatus?.isInheriting && inheritanceStatus?.hasGroup && (
        <Alert>
          <Info className="w-4 h-4" />
          <AlertDescription>
            <p className="font-medium">This property is part of: {inheritanceStatus.groupName}</p>
            <p className="text-sm mt-1">
              Allotment settings are inherited from the property group.
              {inheritanceStatus.lastSyncedAt && (
                <span className="ml-1">
                  Last synced: {new Date(inheritanceStatus.lastSyncedAt).toLocaleString()}
                </span>
              )}
            </p>
          </AlertDescription>
        </Alert>
      )}

      {/* Validation Errors */}
      {validationErrors.length > 0 && (
        <Alert variant="destructive">
          <AlertCircle className="w-4 h-4" />
          <AlertDescription>
            <ul className="list-disc list-inside space-y-1">
              {validationErrors.map((error, index) => (
                <li key={`validationErrors-${index}-${error}`}>{error}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {/* Settings Tabs */}
      <Card>
        <CardHeader>
          <CardTitle>Default Configuration</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="inventory" className="flex items-center">
                <IndianRupee className="w-4 h-4 mr-1" />
                Inventory
              </TabsTrigger>
              <TabsTrigger value="allocation" className="flex items-center">
                <Zap className="w-4 h-4 mr-1" />
                Allocation
              </TabsTrigger>
              <TabsTrigger value="operational" className="flex items-center">
                <Clock className="w-4 h-4 mr-1" />
                Operational
              </TabsTrigger>
              <TabsTrigger value="preferences" className="flex items-center">
                <Globe className="w-4 h-4 mr-1" />
                Preferences
              </TabsTrigger>
            </TabsList>

            {/* Inventory Settings */}
            <TabsContent value="inventory" className="space-y-6 mt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="totalInventory">Default Total Inventory</Label>
                    <Input
                      id="totalInventory"
                      type="number"
                      min="1"
                      max="1000"
                      value={formData.globalDefaults.totalInventory}
                      onChange={(e) => handleInputChange('globalDefaults', 'totalInventory', parseInt(e.target.value))}
                      className="mt-1"
                    />
                    <p className="text-sm text-gray-500 mt-1">
                      Default number of rooms for new allotments
                    </p>
                  </div>

                  <div>
                    <Label htmlFor="currency">Currency</Label>
                    <Select
                      value={formData.globalDefaults.currency}
                      onValueChange={(value) => handleInputChange('globalDefaults', 'currency', value)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="USD">USD - US Dollar</SelectItem>
                        <SelectItem value="EUR">EUR - Euro</SelectItem>
                        <SelectItem value="GBP">GBP - British Pound</SelectItem>
                        <SelectItem value="INR">INR - Indian Rupee</SelectItem>
                        <SelectItem value="CAD">CAD - Canadian Dollar</SelectItem>
                        <SelectItem value="AUD">AUD - Australian Dollar</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <h4 className="font-medium flex items-center mb-2">
                      <Info className="w-4 h-4 mr-2" />
                      Inventory Status
                    </h4>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Current Capacity:</span>
                      <Badge variant={inventoryStatus.color as unknown}>
                        {inventoryStatus.message}
                      </Badge>
                    </div>
                    <div className="mt-2">
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full transition-all duration-300 ${
                            inventoryStatus.color === 'green' ? 'bg-green-500' :
                            inventoryStatus.color === 'blue' ? 'bg-blue-500' :
                            inventoryStatus.color === 'yellow' ? 'bg-yellow-500' :
                            'bg-red-500'
                          }`}
                          style={{ width: `${Math.min((formData.globalDefaults.totalInventory / 100) * 100, 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* Allocation Settings */}
            <TabsContent value="allocation" className="space-y-6 mt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <Label>Default Allocation Method</Label>
                    <Select
                      value={formData.globalDefaults.defaultAllocationMethod}
                      onValueChange={(value) => handleInputChange('globalDefaults', 'defaultAllocationMethod', value)}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="percentage">Percentage-based</SelectItem>
                        <SelectItem value="fixed">Fixed allocation</SelectItem>
                        <SelectItem value="dynamic">Dynamic allocation</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-sm text-gray-500 mt-1">
                      How rooms are allocated across channels by default
                    </p>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <Label>Overbooking Allowed</Label>
                      <p className="text-sm text-gray-500">
                        Allow accepting bookings beyond inventory
                      </p>
                    </div>
                    <Switch
                      checked={formData.globalDefaults.overbookingAllowed}
                      onCheckedChange={(checked) => handleInputChange('globalDefaults', 'overbookingAllowed', checked)}
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  {formData.globalDefaults.overbookingAllowed && (
                    <div>
                      <Label htmlFor="overbookingLimit">Overbooking Limit (%)</Label>
                      <Input
                        id="overbookingLimit"
                        type="number"
                        min="0"
                        max="50"
                        value={formData.globalDefaults.overbookingLimit}
                        onChange={(e) => handleInputChange('globalDefaults', 'overbookingLimit', parseInt(e.target.value))}
                        className="mt-1"
                      />
                      <p className="text-sm text-gray-500 mt-1">
                        Maximum overbooking as percentage of inventory
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>

            {/* Operational Settings */}
            <TabsContent value="operational" className="space-y-6 mt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="releaseWindow">Release Window (hours)</Label>
                    <Input
                      id="releaseWindow"
                      type="number"
                      min="1"
                      max="168"
                      value={formData.globalDefaults.releaseWindow}
                      onChange={(e) => handleInputChange('globalDefaults', 'releaseWindow', parseInt(e.target.value))}
                      className="mt-1"
                    />
                    <p className="text-sm text-gray-500 mt-1">
                      Hours before check-in to release unconfirmed bookings
                    </p>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <Label>Auto Release</Label>
                      <p className="text-sm text-gray-500">
                        Automatically release rooms when release window expires
                      </p>
                    </div>
                    <Switch
                      checked={formData.globalDefaults.autoRelease}
                      onCheckedChange={(checked) => handleInputChange('globalDefaults', 'autoRelease', checked)}
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <Label htmlFor="blockPeriod">Block Period (days)</Label>
                    <Input
                      id="blockPeriod"
                      type="number"
                      min="0"
                      max="30"
                      value={formData.globalDefaults.blockPeriod}
                      onChange={(e) => handleInputChange('globalDefaults', 'blockPeriod', parseInt(e.target.value))}
                      className="mt-1"
                    />
                    <p className="text-sm text-gray-500 mt-1">
                      Days to block rooms after no-show (0 = no blocking)
                    </p>
                  </div>

                  <div>
                    <Label>Timezone</Label>
                    <Select
                      value={formData.globalDefaults.timezone}
                      onValueChange={(value) => handleInputChange('globalDefaults', 'timezone', value)}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="UTC">UTC</SelectItem>
                        <SelectItem value="America/New_York">Eastern Time (ET)</SelectItem>
                        <SelectItem value="America/Chicago">Central Time (CT)</SelectItem>
                        <SelectItem value="America/Denver">Mountain Time (MT)</SelectItem>
                        <SelectItem value="America/Los_Angeles">Pacific Time (PT)</SelectItem>
                        <SelectItem value="Europe/London">London (GMT)</SelectItem>
                        <SelectItem value="Europe/Paris">Paris (CET)</SelectItem>
                        <SelectItem value="Asia/Tokyo">Tokyo (JST)</SelectItem>
                        <SelectItem value="Asia/Kolkata">India (IST)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* UI Preferences */}
            <TabsContent value="preferences" className="space-y-6 mt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <Label>Default View</Label>
                    <Select
                      value={formData.uiPreferences?.defaultView}
                      onValueChange={(value) => handleInputChange('uiPreferences', 'defaultView', value)}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="overview">Overview</SelectItem>
                        <SelectItem value="dashboard">Dashboard</SelectItem>
                        <SelectItem value="calendar">Calendar</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Calendar View</Label>
                    <Select
                      value={formData.uiPreferences?.calendarView}
                      onValueChange={(value) => handleInputChange('uiPreferences', 'calendarView', value)}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="week">Week View</SelectItem>
                        <SelectItem value="month">Month View</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <Label>Show Channel Colors</Label>
                      <p className="text-sm text-gray-500">
                        Display channel-specific colors in calendar
                      </p>
                    </div>
                    <Switch
                      checked={formData.uiPreferences?.showChannelColors}
                      onCheckedChange={(checked) => handleInputChange('uiPreferences', 'showChannelColors', checked)}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <Label>Compact Mode</Label>
                      <p className="text-sm text-gray-500">
                        Use compact layout to show more information
                      </p>
                    </div>
                    <Switch
                      checked={formData.uiPreferences?.compactMode}
                      onCheckedChange={(checked) => handleInputChange('uiPreferences', 'compactMode', checked)}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <Label>Auto Refresh</Label>
                      <p className="text-sm text-gray-500">
                        Automatically refresh data periodically
                      </p>
                    </div>
                    <Switch
                      checked={formData.uiPreferences?.autoRefresh}
                      onCheckedChange={(checked) => handleInputChange('uiPreferences', 'autoRefresh', checked)}
                    />
                  </div>

                  {formData.uiPreferences?.autoRefresh && (
                    <div>
                      <Label htmlFor="refreshInterval">Refresh Interval (seconds)</Label>
                      <Input
                        id="refreshInterval"
                        type="number"
                        min="30"
                        max="1800"
                        step="30"
                        value={formData.uiPreferences?.refreshInterval}
                        onChange={(e) => handleInputChange('uiPreferences', 'refreshInterval', parseInt(e.target.value))}
                        className="mt-1"
                      />
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Multi-property selector */}
      <Card>
        <CardContent className="pt-6">
          <ApplyToSelector
            value={applyToScope}
            onChange={setApplyToScope}
            isInGroup={inheritanceStatus?.hasGroup || false}
            groupName={inheritanceStatus?.groupName}
            totalProperties={inheritanceStatus?.groupPropertyCount || 0}
            showWarning={true}
            warningMessage="These allotment settings will be applied to all selected properties. Ensure inventory limits, allocation methods, and operational settings are appropriate for all properties."
          />
        </CardContent>
      </Card>

      {/* Help Information */}
      <Alert>
        <Info className="w-4 h-4" />
        <AlertDescription>
          These settings will be used as defaults when creating new room type allotments.
          Existing allotments will not be affected by these changes.
        </AlertDescription>
      </Alert>

      {/* Confirmation Dialog */}
      <ApplyToConfirmation
        isOpen={showConfirmation}
        scope={applyToScope}
        affectedCount={affectedCount}
        settingName="Allotment Global Settings"
        groupName={inheritanceStatus?.groupName}
        onConfirm={handleConfirm}
        onCancel={cancelBulkUpdate}
      />
    </div>
  );
}