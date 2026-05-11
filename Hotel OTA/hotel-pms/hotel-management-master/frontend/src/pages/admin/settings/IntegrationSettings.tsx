import React, { useState, useEffect, useRef} from 'react';
import { useForm } from 'react-hook-form';
import {
  Globe,
  CreditCard,
  BarChart,
  Key,
  Eye,
  EyeOff,
  Save,
  Loader2,
  CheckCircle,
  XCircle
} from 'lucide-react';
import { Button } from '../../../components/ui/button';
import toast from 'react-hot-toast';
import { ApplyToSelector, ApplyToConfirmation, ApplyToScope } from '../../../components/settings/ApplyToSelector';
import { useSettingsInheritance, useAffectedPropertiesCount } from '../../../hooks/useSettingsInheritance';
import { useProperty } from '../../../context/PropertyContext';
import { api } from '../../../services/api';
import { withErrorBoundary } from '../../../components/ErrorBoundary';

interface IntegrationFormData {
  payment: {
    stripe: {
      enabled: boolean;
      publicKey: string;
      secretKey: string;
    };
    razorpay: {
      enabled: boolean;
      keyId: string;
      keySecret: string;
    };
  };
  ota: {
    booking: {
      enabled: boolean;
      apiKey: string;
      hotelId: string;
    };
    expedia: {
      enabled: boolean;
      apiKey: string;
      hotelId: string;
    };
  };
  analytics: {
    googleAnalytics: {
      enabled: boolean;
      trackingId: string;
    };
    mixpanel: {
      enabled: boolean;
      token: string;
    };
  };
}

interface IntegrationSettingsProps {
  onSettingsChange?: (hasChanges: boolean) => void;
}

const DEFAULT_INTEGRATION_VALUES: IntegrationFormData = {
  payment: {
    stripe: {
      enabled: false,
      publicKey: '',
      secretKey: ''
    },
    razorpay: {
      enabled: false,
      keyId: '',
      keySecret: ''
    }
  },
  ota: {
    booking: {
      enabled: false,
      apiKey: '',
      hotelId: ''
    },
    expedia: {
      enabled: false,
      apiKey: '',
      hotelId: ''
    }
  },
  analytics: {
    googleAnalytics: {
      enabled: false,
      trackingId: ''
    },
    mixpanel: {
      enabled: false,
      token: ''
    }
  }
};

function IntegrationSettings({ onSettingsChange }: IntegrationSettingsProps = {}) {
  const { selectedPropertyId } = useProperty();
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [applyToScope, setApplyToScope] = useState<ApplyToScope>('single');
  const [showSuccess, setShowSuccess] = useState(false);

  // Settings inheritance hook
  const {
    useInheritanceStatus,
    applySettings,
    isUpdating,
    updateError,
    showConfirmation,
    confirmBulkUpdate,
    cancelBulkUpdate,
  } = useSettingsInheritance();

  // Fetch inheritance status
  const { data: inheritanceStatus } = useInheritanceStatus(selectedPropertyId);

  // Get affected properties count
  const affectedCount = useAffectedPropertiesCount(
    applyToScope,
    inheritanceStatus?.groupPropertyCount || 0
  );

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { isDirty }
  } = useForm<IntegrationFormData>({
    defaultValues: DEFAULT_INTEGRATION_VALUES
  });

  const watchedValues = watch();

  // Load existing integration settings on mount
  const successTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (successTimerRef.current) clearTimeout(successTimerRef.current);
    };
  }, []);

  useEffect(() => {
    const loadIntegrationSettings = async () => {
      try {
        setIsLoading(true);
        const { data } = await api.get('/hotel-settings/integrations');
        reset(data?.data?.integrations || DEFAULT_INTEGRATION_VALUES);
      } catch (error) {
        toast.error('Failed to load integration settings');
      } finally {
        setIsLoading(false);
      }
    };

    loadIntegrationSettings();
  }, [reset, selectedPropertyId]);

  // Watch for form changes
  useEffect(() => {
    if (onSettingsChange) {
      onSettingsChange(isDirty);
    }
  }, [isDirty, onSettingsChange]);

  const onSubmit = async (data: IntegrationFormData) => {
    try {
      // Use multi-property settings inheritance for integrations
      const result = await applySettings({
        scope: applyToScope,
        propertyId: selectedPropertyId,
        settingUpdates: data,
        settingType: 'integrations',
      });

      // If confirmation dialog was shown, return early
      if (!result) {
        return;
      }

      setShowSuccess(true);
      if (successTimerRef.current) clearTimeout(successTimerRef.current);
      successTimerRef.current = setTimeout(() => setShowSuccess(false), 3000);

      toast.success(`Integration settings updated successfully${
        applyToScope !== 'single' ? ` for ${result.propertiesUpdated} properties` : ''
      }`);

      if (onSettingsChange) {
        onSettingsChange(false);
      }
    } catch (error) {
      toast.error('Failed to update integration settings');
    }
  };

  // Handle confirmation dialog confirm
  const handleConfirm = async () => {
    try {
      const result = await confirmBulkUpdate();

      if (result) {
        setShowSuccess(true);
        if (successTimerRef.current) clearTimeout(successTimerRef.current);
        successTimerRef.current = setTimeout(() => setShowSuccess(false), 3000);

        toast.success(`Integration settings updated for ${result.propertiesUpdated} properties`);

        if (onSettingsChange) {
          onSettingsChange(false);
        }
      }
    } catch (error) {
      toast.error('Failed to update settings');
    }
  };

  const toggleShowSecret = (key: string) => {
    setShowSecrets(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const renderSecretField = (name: string, label: string, secretKey: string, placeholder: string = '') => (
    <div className="relative">
      <label className="block text-sm font-medium text-gray-700 mb-2">
        <Key className="h-4 w-4 inline mr-1" />
        {label}
      </label>
      <div className="relative">
        <input
          {...register(name as keyof IntegrationFormData | `payment.${string}` | `ota.${string}` | `analytics.${string}`)}
          type={showSecrets[secretKey] ? 'text' : 'password'}
          placeholder={placeholder}
          className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button aria-label="Toggle"
          type="button"
          onClick={() => toggleShowSecret(secretKey)}
          className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
        >
          {showSecrets[secretKey] ? (
            <EyeOff className="h-4 w-4" />
          ) : (
            <Eye className="h-4 w-4" />
          )}
        </button>
      </div>
    </div>
  );

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="max-w-4xl">
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            <span className="ml-2 text-gray-600">Loading integration settings...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="max-w-4xl">
        {/* Header */}
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center space-x-2">
            <Globe className="h-5 w-5" />
            <span>Integration Settings</span>
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            Connect with third-party services and configure API integrations
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
          {/* Payment Gateways */}
          <div>
            <h3 className="text-md font-medium text-gray-900 mb-4 flex items-center space-x-2">
              <CreditCard className="h-4 w-4" />
              <span>Payment Gateways</span>
            </h3>

            {/* Stripe */}
            <div className="border border-gray-200 rounded-lg p-6 mb-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-purple-100 rounded flex items-center justify-center">
                    <CreditCard className="h-4 w-4 text-purple-600" />
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-900">Stripe</h4>
                    <p className="text-sm text-gray-500">Accept credit cards and digital payments</p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  {watchedValues.payment?.stripe?.enabled ? (
                    <CheckCircle className="h-5 w-5 text-green-500" />
                  ) : (
                    <XCircle className="h-5 w-5 text-gray-400" />
                  )}
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      {...register('payment.stripe.enabled')}
                      type="checkbox"
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>
              </div>

              {watchedValues.payment?.stripe?.enabled && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Publishable Key
                    </label>
                    <input
                      {...register('payment.stripe.publicKey')}
                      type="text"
                      placeholder="pk_live_..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  {renderSecretField('payment.stripe.secretKey', 'Secret Key', 'stripe_secret', 'sk_live_...')}
                </div>
              )}
            </div>

            {/* Razorpay */}
            <div className="border border-gray-200 rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-blue-100 rounded flex items-center justify-center">
                    <CreditCard className="h-4 w-4 text-blue-600" />
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-900">Razorpay</h4>
                    <p className="text-sm text-gray-500">Indian payment gateway for UPI, cards, and more</p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  {watchedValues.payment?.razorpay?.enabled ? (
                    <CheckCircle className="h-5 w-5 text-green-500" />
                  ) : (
                    <XCircle className="h-5 w-5 text-gray-400" />
                  )}
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      {...register('payment.razorpay.enabled')}
                      type="checkbox"
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>
              </div>

              {watchedValues.payment?.razorpay?.enabled && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Key ID
                    </label>
                    <input
                      {...register('payment.razorpay.keyId')}
                      type="text"
                      placeholder="rzp_live_..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  {renderSecretField('payment.razorpay.keySecret', 'Key Secret', 'razorpay_secret')}
                </div>
              )}
            </div>
          </div>

          {/* Analytics */}
          <div>
            <h3 className="text-md font-medium text-gray-900 mb-4 flex items-center space-x-2">
              <BarChart className="h-4 w-4" />
              <span>Analytics</span>
            </h3>

            {/* Google Analytics */}
            <div className="border border-gray-200 rounded-lg p-6 mb-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-yellow-100 rounded flex items-center justify-center">
                    <BarChart className="h-4 w-4 text-yellow-600" />
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-900">Google Analytics</h4>
                    <p className="text-sm text-gray-500">Track website usage and visitor behavior</p>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    {...register('analytics.googleAnalytics.enabled')}
                    type="checkbox"
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>

              {watchedValues.analytics?.googleAnalytics?.enabled && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Tracking ID
                  </label>
                  <input
                    {...register('analytics.googleAnalytics.trackingId')}
                    type="text"
                    placeholder="GA-XXXXXXXX-X or G-XXXXXXXXXX"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Multi-Property Scope Selector */}
          <div className="pt-6 border-t border-gray-200">
            <ApplyToSelector
              value={applyToScope}
              onChange={setApplyToScope}
              isInGroup={inheritanceStatus?.hasGroup || false}
              groupName={inheritanceStatus?.groupName}
              totalProperties={inheritanceStatus?.groupPropertyCount || 0}
              showWarning={true}
              warningMessage="These integration settings (payment gateways, analytics, APIs) will be applied to all selected properties. Make sure API keys and credentials are suitable for multi-property use."
            />
          </div>

          {/* Success Message */}
          {showSuccess && (
            <div className="flex items-center space-x-2 p-3 bg-green-50 border border-green-200 rounded-lg">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <p className="text-sm text-green-800">
                Integration settings updated successfully!
              </p>
            </div>
          )}

          {/* Error Message */}
          {updateError && (
            <div className="flex items-start space-x-2 p-3 bg-red-50 border border-red-200 rounded-lg">
              <XCircle className="h-5 w-5 text-red-600 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-red-900 mb-1">Update Failed</p>
                <p className="text-xs text-red-800">
                  {updateError instanceof Error ? updateError.message : 'An error occurred while updating integration settings'}
                </p>
              </div>
            </div>
          )}

          {/* Save Button */}
          <div className="flex justify-end pt-4 border-t border-gray-200">
            <Button
              type="submit"
              disabled={!isDirty || isUpdating}
              className="flex items-center space-x-2"
            >
              {isUpdating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              <span>{isUpdating ? 'Saving...' : 'Save Changes'}</span>
            </Button>
          </div>
        </form>

        {/* Inheritance Info Card */}
        {inheritanceStatus?.hasGroup && inheritanceStatus.inheritanceEnabled && (
          <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-start space-x-3">
              <div className="h-5 w-5 rounded-full bg-blue-100 flex items-center justify-center mt-0.5">
                <svg className="h-3 w-3 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-blue-900 mb-1">
                  Group Inheritance Enabled
                </p>
                <p className="text-xs text-blue-800">
                  This property is part of "{inheritanceStatus.groupName}" group and inherits integration settings automatically.
                  {inheritanceStatus.lastSyncAt && (
                    <span className="block mt-1">
                      Last synced: {new Date(inheritanceStatus.lastSyncAt).toLocaleString()}
                    </span>
                  )}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Confirmation Dialog for Bulk Updates */}
      <ApplyToConfirmation
        isOpen={showConfirmation}
        scope={applyToScope}
        affectedCount={affectedCount}
        settingName="integration settings"
        groupName={inheritanceStatus?.groupName}
        onConfirm={handleConfirm}
        onCancel={cancelBulkUpdate}
      />
    </div>
  );
}

export default withErrorBoundary(IntegrationSettings);
