import React, { useState, useEffect, useRef} from 'react';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Shield,
  Key,
  Clock,
  Database,
  Download,
  Trash2,
  Save,
  Loader2,
  Plus,
  Copy,
  Eye,
  EyeOff,
  AlertTriangle,
  CheckCircle,
  Users,
  UserPlus,
  ExternalLink
} from 'lucide-react';
import { Button } from '../../../components/ui/button';
import toast from 'react-hot-toast';
import { ApplyToSelector, ApplyToConfirmation, ApplyToScope } from '../../../components/settings/ApplyToSelector';
import { useSettingsInheritance, useAffectedPropertiesCount } from '../../../hooks/useSettingsInheritance';
import { useProperty } from '../../../context/PropertyContext';
import { CreateUserModal } from '../../../components/user/CreateUserModal';
import { useNavigate } from 'react-router-dom';
import { api } from '../../../services/api';
import { withErrorBoundary } from '../../../components/ErrorBoundary';

interface SystemFormData {
  twoFactorAuth: boolean;
  sessionTimeout: number;
  backupSchedule: string;
  dataRetention: number;
  autoLogout: boolean;
  passwordExpiry: number;
  loginAttempts: number;
}

interface APIKey {
  _id: string;
  name: string;
  description?: string;
  keyId: string;
  keyPrefix: string;
  type: string;
  environment: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  hotelId: string;
  createdBy: {
    _id: string;
    name: string;
    email: string;
  };
  permissions: Array<{
    resource: string;
    actions: string[];
    _id: string;
  }>;
  rateLimit: {
    requestsPerMinute: number;
    requestsPerHour: number;
    requestsPerDay: number;
  };
  usage: {
    totalRequests: number;
    lastUsed?: string;
  };
  rateLimitUsage: {
    today: { requests: number };
    thisHour: { requests: number };
    thisMinute: { requests: number };
  };
  allowedIPs: string[];
  allowedDomains: string[];
  tags: string[];
}

interface SystemSettingsProps {
  onSettingsChange?: (hasChanges: boolean) => void;
}

function SystemSettings({ onSettingsChange }: SystemSettingsProps = {}) {
  const { selectedPropertyId } = useProperty();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [apiKeys, setApiKeys] = useState<APIKey[]>([]);
  const [showNewKeyForm, setShowNewKeyForm] = useState(false);
  const [newKeyData, setNewKeyData] = useState({
    name: '',
    description: '',
    type: 'read',
    permissions: []
  });
  const [applyToScope, setApplyToScope] = useState<ApplyToScope>('single');
  const [showSuccess, setShowSuccess] = useState(false);
  const [showCreateUserModal, setShowCreateUserModal] = useState(false);

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
    setValue,
    formState: { errors, isDirty }
  } = useForm<SystemFormData>({
    defaultValues: {
      twoFactorAuth: false,
      sessionTimeout: 60,
      backupSchedule: 'daily',
      dataRetention: 365,
      autoLogout: true,
      passwordExpiry: 90,
      loginAttempts: 5
    }
  });

  // Fetch system settings from hotel-settings (security + maintenance)
  const { data: systemSettings, isLoading: settingsLoading } = useQuery({
    queryKey: ['system-settings', selectedPropertyId],
    queryFn: async () => {
      // Fetch both security and maintenance settings
      const [securityResponse, maintenanceResponse] = await Promise.all([
        api.get('/hotel-settings/security'),
        api.get('/hotel-settings/maintenance')
      ]);

      const security = securityResponse.data.data.security || {};
      const maintenance = maintenanceResponse.data.data.maintenance || {};

      return { security, maintenance };
    }
  });

  // Update form values when system settings data changes
  const successTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (successTimerRef.current) clearTimeout(successTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (systemSettings) {
      const { security, maintenance } = systemSettings;

      // Security settings
      setValue('twoFactorAuth', security.requireTwoFactor || false, { shouldDirty: false });
      setValue('sessionTimeout', security.sessionSettings?.timeout || 60, { shouldDirty: false });
      setValue('autoLogout', true, { shouldDirty: false });
      setValue('passwordExpiry', security.passwordPolicy?.expireDays || 90, { shouldDirty: false });
      setValue('loginAttempts', security.maxLoginAttempts || 5, { shouldDirty: false });

      // Maintenance/Backup settings
      setValue('backupSchedule', maintenance.backupSchedule || 'daily', { shouldDirty: false });
      setValue('dataRetention', maintenance.backupRetention || 365, { shouldDirty: false });
    }
  }, [systemSettings, setValue]);

  // Fetch API keys
  const { data: apiKeysData, refetch: refetchApiKeys } = useQuery({
    queryKey: ['api-keys', selectedPropertyId],
    queryFn: async () => {
      const { data } = await api.get('/api-management/api-keys');
      return data.data;
    },
    // Disable cache for API keys to ensure fresh data
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    staleTime: 0 // Always consider data stale
  });

  // Update API keys state when data changes
  useEffect(() => {
    if (apiKeysData && apiKeysData.apiKeys) {
      setApiKeys(apiKeysData.apiKeys);
    }
  }, [apiKeysData]);

  // Fetch user statistics
  const { data: userStats } = useQuery({
    queryKey: ['user-stats', selectedPropertyId],
    queryFn: async () => {
      const [allUsersRes, activeRes, adminsRes, staffRes, managersRes, recentRes] = await Promise.all([
        api.get('/users', { params: { page: 1, limit: 1 } }),
        api.get('/users', { params: { isActive: true, page: 1, limit: 1 } }),
        api.get('/users', { params: { role: 'admin', page: 1, limit: 1 } }),
        api.get('/users', { params: { role: 'staff', page: 1, limit: 1 } }),
        api.get('/users', { params: { role: 'manager', page: 1, limit: 1 } }),
        api.get('/users', { params: { page: 1, limit: 5, sortBy: 'createdAt', sortOrder: 'desc' } }),
      ]);

      const total = allUsersRes.data?.pagination?.total || 0;
      const active = activeRes.data?.pagination?.total || 0;
      const admins = adminsRes.data?.pagination?.total || 0;
      const staff = (staffRes.data?.pagination?.total || 0) + (managersRes.data?.pagination?.total || 0);
      const recentUsers = recentRes.data?.data?.users || [];

      return {
        total,
        active,
        admins,
        staff,
        recentUsers
      };
    },
    enabled: !!selectedPropertyId
  });

  // Watch for form changes
  useEffect(() => {
    if (onSettingsChange) {
      onSettingsChange(isDirty);
    }
  }, [isDirty, onSettingsChange]);

  // Save system settings mutation
  const saveSystemMutation = useMutation({
    mutationFn: async (data: SystemFormData) => {
      // Update both security and maintenance settings
      const securityPayload = {
        requireTwoFactor: data.twoFactorAuth,
        sessionSettings: {
          timeout: data.sessionTimeout,
          maxConcurrentSessions: 5
        },
        passwordPolicy: {
          expireDays: data.passwordExpiry,
          minLength: 8,
          requireNumbers: true,
          requireUppercase: true,
          requireSymbols: false
        },
        maxLoginAttempts: data.loginAttempts
      };

      const maintenancePayload = {
        backupSchedule: data.backupSchedule,
        backupRetention: data.dataRetention,
        autoBackup: true
      };

      // Update both settings in parallel
      const [securityResponse, maintenanceResponse] = await Promise.all([
        api.put('/hotel-settings/security', securityPayload),
        api.put('/hotel-settings/maintenance', maintenancePayload)
      ]);

      return { security: securityResponse.data, maintenance: maintenanceResponse.data };
    },
    onSuccess: () => {
      toast.success('System settings updated successfully');

      // Invalidate and refetch the system settings query
      queryClient.invalidateQueries({ queryKey: ['system-settings'] });

      // Reset form dirty state
      const currentValues = watch();
      Object.keys(currentValues).forEach(key => {
        setValue(key as keyof SystemFormData, currentValues[key], { shouldDirty: false });
      });

      if (onSettingsChange) {
        onSettingsChange(false);
      }
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update system settings');
    }
  });

  // Create API key mutation
  const createApiKeyMutation = useMutation({
    mutationFn: async (keyData: Record<string, unknown>) => {
      const { data } = await api.post('/api-management/api-keys', keyData);
      return data;
    },
    onSuccess: (data) => {
      toast.success('API key created successfully');
      setShowNewKeyForm(false);
      setNewKeyData({ name: '', description: '', type: 'read', permissions: [] });
      // Invalidate cache and refetch to sync with database state
      queryClient.invalidateQueries({ queryKey: ['api-keys'] });
      refetchApiKeys();

      // Show the generated key once
      if (data.data.key) {
        toast.success(`New API Key: ${data.data.key}`, { duration: 10000 });
      }
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to create API key');
    }
  });

  // Delete API key mutation
  const deleteApiKeyMutation = useMutation({
    mutationFn: async (keyId: string) => {
      try {
        const { data } = await api.delete(`/api-management/api-keys/${keyId}`);
        return data;
      } catch (error: unknown) {
        const axiosError = error as { response?: { status?: number } };
        if (axiosError.response?.status === 404) {
          return { success: true, alreadyDeleted: true };
        }
        throw error;
      }
    },
    onSuccess: (data) => {
      if (data.alreadyDeleted) {
        toast.success('API key was already removed');
      } else {
        toast.success('API key deleted successfully');
      }
      // Invalidate cache and refetch to sync with database state
      queryClient.invalidateQueries({ queryKey: ['api-keys'] });
      refetchApiKeys();
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to delete API key');
      // Even on error, invalidate cache and refetch to sync state
      queryClient.invalidateQueries({ queryKey: ['api-keys'] });
      refetchApiKeys();
    }
  });

  // Download backup mutation
  const downloadBackupMutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.get('/hotel-settings/backup');
      return data;
    },
    onSuccess: (data) => {
      // Create and download the backup file
      const backupData = JSON.stringify(data.data, null, 2);
      const blob = new Blob([backupData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `hotel-backup-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success('Backup downloaded successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to create backup');
    }
  });

  const onSubmit = async (data: SystemFormData) => {
    try {
      // Use multi-property settings inheritance for system settings
      const result = await applySettings({
        scope: applyToScope,
        propertyId: selectedPropertyId,
        settingUpdates: {
          security: {
            requireTwoFactor: data.twoFactorAuth,
            sessionSettings: {
              timeout: data.sessionTimeout,
              maxConcurrentSessions: 5
            },
            passwordPolicy: {
              expireDays: data.passwordExpiry,
              minLength: 8,
              requireNumbers: true,
              requireUppercase: true,
              requireSymbols: false
            },
            maxLoginAttempts: data.loginAttempts
          },
          maintenance: {
            backupSchedule: data.backupSchedule,
            backupRetention: data.dataRetention,
            autoBackup: true
          }
        },
        settingType: 'system',
      });

      // If confirmation dialog was shown, return early
      if (!result) {
        return;
      }

      setShowSuccess(true);
      if (successTimerRef.current) clearTimeout(successTimerRef.current);
      successTimerRef.current = setTimeout(() => setShowSuccess(false), 3000);

      toast.success(`System settings updated successfully${
        applyToScope !== 'single' ? ` for ${result.propertiesUpdated} properties` : ''
      }`);

      // Invalidate and refetch the system settings query
      queryClient.invalidateQueries({ queryKey: ['system-settings'] });

      if (onSettingsChange) {
        onSettingsChange(false);
      }
    } catch (error) {
      toast.error('Failed to update system settings');
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

        toast.success(`System settings updated for ${result.propertiesUpdated} properties`);

        queryClient.invalidateQueries({ queryKey: ['system-settings'] });

        if (onSettingsChange) {
          onSettingsChange(false);
        }
      }
    } catch (error) {
      toast.error('Failed to update settings');
    }
  };

  const handleCreateApiKey = () => {
    if (!newKeyData.name || !newKeyData.description) {
      toast.error('Please fill in all required fields');
      return;
    }
    createApiKeyMutation.mutate(newKeyData);
  };

  const handleDeleteApiKey = (keyId: string, keyName: string) => {
    if (window.confirm(`Are you sure you want to delete the API key "${keyName}"? This action cannot be undone.`)) {
      deleteApiKeyMutation.mutate(keyId);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  if (settingsLoading) {
    return (
      <div className="p-6 bg-white dark:bg-gray-800 transition-colors">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-white dark:bg-gray-800 transition-colors">
      <div className="max-w-4xl">
        {/* Header */}
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center space-x-2">
            <Shield className="h-5 w-5" />
            <span>System Settings</span>
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Configure security, backup, and system-wide settings
          </p>
        </div>

        {/* User Management Section */}
        <div className="mb-8 p-6 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-md font-medium text-gray-900 dark:text-gray-100 flex items-center space-x-2">
                <Users className="h-4 w-4" />
                <span>User Management</span>
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Manage system users and permissions
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => navigate('/admin/user-management')}
                className="flex items-center space-x-2"
              >
                <ExternalLink className="h-4 w-4" />
                <span>View All Users</span>
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => setShowCreateUserModal(true)}
                className="flex items-center space-x-2"
              >
                <UserPlus className="h-4 w-4" />
                <span>Create User</span>
              </Button>
            </div>
          </div>

          {/* User Statistics */}
          {userStats && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
              <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-600">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Users</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{userStats.total}</p>
                  </div>
                  <Users className="h-8 w-8 text-blue-600 dark:text-blue-400" />
                </div>
              </div>

              <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-600">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Active Users</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{userStats.active}</p>
                  </div>
                  <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400" />
                </div>
              </div>

              <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-600">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Admins</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{userStats.admins}</p>
                  </div>
                  <Shield className="h-8 w-8 text-purple-600 dark:text-purple-400" />
                </div>
              </div>

              <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-600">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Staff</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{userStats.staff}</p>
                  </div>
                  <Users className="h-8 w-8 text-orange-600 dark:text-orange-400" />
                </div>
              </div>
            </div>
          )}

          {/* Recent Activity */}
          {userStats && userStats.recentUsers.length > 0 && (
            <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-600">
              <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">Recent Users</h4>
              <div className="space-y-2">
                {userStats.recentUsers.map((user: Record<string, unknown>) => (
                  <div key={String(user._id)} className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-700 last:border-0">
                    <div className="flex items-center space-x-3">
                      <div className="h-8 w-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                        <span className="text-sm font-medium text-blue-600 dark:text-blue-300">
                          {String(user.name || '?').charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{String(user.name || '')}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{String(user.email || '')}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-medium text-gray-600 dark:text-gray-400 capitalize">{String(user.role || '')}</p>
                      <p className={`text-xs ${user.isActive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                        {user.isActive ? 'Active' : 'Inactive'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
          {/* Security Settings */}
          <div>
            <h3 className="text-md font-medium text-gray-900 dark:text-gray-100 mb-4 flex items-center space-x-2">
              <Shield className="h-4 w-4" />
              <span>Security Settings</span>
            </h3>
            <div className="space-y-4">
              <label className="flex items-center space-x-3">
                <input
                  {...register('twoFactorAuth')}
                  type="checkbox"
                  className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
                />
                <span className="font-medium text-gray-900 dark:text-gray-100">Enable Two-Factor Authentication</span>
              </label>

              <label className="flex items-center space-x-3">
                <input
                  {...register('autoLogout')}
                  type="checkbox"
                  className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
                />
                <span className="font-medium text-gray-900 dark:text-gray-100">Auto logout on inactivity</span>
              </label>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    <Clock className="h-4 w-4 inline mr-1" />
                    Session Timeout (minutes)
                  </label>
                  <input
                    {...register('sessionTimeout', { min: 5, max: 480, required: 'Session timeout is required' })}
                    type="number"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  {errors.sessionTimeout && (
                    <p className="text-red-500 text-xs mt-1">{errors.sessionTimeout.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Password Expiry (days)
                  </label>
                  <input
                    {...register('passwordExpiry', { min: 30, max: 365, required: 'Password expiry is required' })}
                    type="number"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  {errors.passwordExpiry && (
                    <p className="text-red-500 text-xs mt-1">{errors.passwordExpiry.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Max Login Attempts
                  </label>
                  <input
                    {...register('loginAttempts', { min: 3, max: 10, required: 'Max login attempts is required' })}
                    type="number"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  {errors.loginAttempts && (
                    <p className="text-red-500 text-xs mt-1">{errors.loginAttempts.message}</p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* API Keys Management */}
          <div>
            <h3 className="text-md font-medium text-gray-900 dark:text-gray-100 mb-4 flex items-center space-x-2">
              <Key className="h-4 w-4" />
              <span>API Keys</span>
            </h3>
            <div className="space-y-4">
              {apiKeys.map((apiKey) => (
                <div key={apiKey._id} className="border border-gray-200 dark:border-gray-600 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium text-gray-900 dark:text-gray-100">{apiKey.name}</h4>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {apiKey.keyId ? `${apiKey.keyId.substring(0, 10)}...` : 'Key hidden'}
                      </p>
                      <div className="flex items-center space-x-4 text-xs text-gray-400 dark:text-gray-500 mt-1">
                        <span>Created: {new Date(apiKey.createdAt).toLocaleDateString()}</span>
                        {apiKey.usage?.lastUsed && (
                          <span>Last used: {new Date(apiKey.usage.lastUsed).toLocaleDateString()}</span>
                        )}
                        <span className={`px-2 py-1 rounded-full ${apiKey.isActive ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'}`}>
                          {apiKey.isActive ? 'Active' : 'Inactive'}
                        </span>
                        <span className="px-2 py-1 bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 rounded-full">
                          {apiKey.type}
                        </span>
                      </div>
                      {apiKey.usage && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          Total requests: {apiKey.usage.totalRequests || 0}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => copyToClipboard(apiKey.keyId || '')}
                        disabled={!apiKey.keyId}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-red-600 hover:text-red-700"
                        onClick={() => handleDeleteApiKey(apiKey._id, apiKey.name)}
                        disabled={deleteApiKeyMutation.isPending}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}

              {showNewKeyForm && (
                <div className="border border-gray-200 dark:border-gray-600 rounded-lg p-4 bg-gray-50 dark:bg-gray-700">
                  <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-3">Create New API Key</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Name *
                      </label>
                      <input
                        type="text"
                        value={newKeyData.name}
                        onChange={(e) => setNewKeyData({...newKeyData, name: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="e.g., Mobile App API Key"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Type
                      </label>
                      <select
                        value={newKeyData.type}
                        onChange={(e) => setNewKeyData({...newKeyData, type: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="read">Read Only</option>
                        <option value="write">Read & Write</option>
                        <option value="admin">Admin</option>
                      </select>
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Description *
                      </label>
                      <textarea
                        value={newKeyData.description}
                        onChange={(e) => setNewKeyData({...newKeyData, description: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Describe what this API key will be used for..."
                        rows={2}
                      />
                    </div>
                  </div>
                  <div className="flex justify-end space-x-2 mt-4">
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => setShowNewKeyForm(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      onClick={handleCreateApiKey}
                      disabled={createApiKeyMutation.isPending}
                    >
                      {createApiKeyMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <Plus className="h-4 w-4 mr-2" />
                      )}
                      Create Key
                    </Button>
                  </div>
                </div>
              )}

              <Button
                type="button"
                variant="outline"
                onClick={() => setShowNewKeyForm(!showNewKeyForm)}
                className="flex items-center space-x-2"
                disabled={showNewKeyForm}
              >
                <Plus className="h-4 w-4" />
                <span>Generate New API Key</span>
              </Button>
            </div>
          </div>

          {/* Backup Settings */}
          <div>
            <h3 className="text-md font-medium text-gray-900 dark:text-gray-100 mb-4 flex items-center space-x-2">
              <Database className="h-4 w-4" />
              <span>Backup & Data Retention</span>
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Backup Schedule
                </label>
                <select
                  {...register('backupSchedule')}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="hourly">Hourly</option>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Data Retention (days)
                </label>
                <input
                  {...register('dataRetention', { min: 30, max: 2555, required: 'Data retention is required' })}
                  type="number"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {errors.dataRetention && (
                  <p className="text-red-500 text-xs mt-1">{errors.dataRetention.message}</p>
                )}
              </div>
            </div>

            <div className="mt-4 flex space-x-3">
              <Button
                type="button"
                variant="outline"
                className="flex items-center space-x-2"
                onClick={() => downloadBackupMutation.mutate()}
                disabled={downloadBackupMutation.isPending}
              >
                {downloadBackupMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
                <span>Download Backup</span>
              </Button>
              <Button type="button" variant="outline" className="flex items-center space-x-2">
                <Database className="h-4 w-4" />
                <span>Restore from Backup</span>
              </Button>
            </div>
          </div>

          {/* Multi-Property Scope Selector */}
          <div className="pt-6 border-t border-gray-200 dark:border-gray-600">
            <ApplyToSelector
              value={applyToScope}
              onChange={setApplyToScope}
              isInGroup={inheritanceStatus?.hasGroup || false}
              groupName={inheritanceStatus?.groupName}
              totalProperties={inheritanceStatus?.groupPropertyCount || 0}
              showWarning={true}
              warningMessage="These system settings (security policies, backup schedules) will be applied to all selected properties. Ensure these settings are appropriate for all properties."
            />
          </div>

          {/* Success Message */}
          {showSuccess && (
            <div className="flex items-center space-x-2 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
              <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
              <p className="text-sm text-green-800 dark:text-green-400">
                System settings updated successfully!
              </p>
            </div>
          )}

          {/* Error Message */}
          {updateError && (
            <div className="flex items-start space-x-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-red-900 dark:text-red-400 mb-1">Update Failed</p>
                <p className="text-xs text-red-800 dark:text-red-500">
                  {updateError instanceof Error ? updateError.message : 'An error occurred while updating system settings'}
                </p>
              </div>
            </div>
          )}

          {/* Save Button */}
          <div className="flex justify-end pt-4 border-t border-gray-200 dark:border-gray-600">
            <Button
              type="submit"
              disabled={!isDirty || saveSystemMutation.isPending || isUpdating}
              className="flex items-center space-x-2"
            >
              {(saveSystemMutation.isPending || isUpdating) ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              <span>{(saveSystemMutation.isPending || isUpdating) ? 'Saving...' : 'Save Changes'}</span>
            </Button>
          </div>
        </form>

        {/* Inheritance Info Card */}
        {inheritanceStatus?.hasGroup && inheritanceStatus.inheritanceEnabled && (
          <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            <div className="flex items-start space-x-3">
              <div className="h-5 w-5 rounded-full bg-blue-100 dark:bg-blue-800 flex items-center justify-center mt-0.5">
                <Shield className="h-3 w-3 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-blue-900 dark:text-blue-400 mb-1">
                  Group Inheritance Enabled
                </p>
                <p className="text-xs text-blue-800 dark:text-blue-500">
                  This property is part of "{inheritanceStatus.groupName}" group and inherits system settings automatically.
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
        settingName="system settings"
        groupName={inheritanceStatus?.groupName}
        onConfirm={handleConfirm}
        onCancel={cancelBulkUpdate}
      />

      {/* Create User Modal */}
      <CreateUserModal
        isOpen={showCreateUserModal}
        onClose={() => setShowCreateUserModal(false)}
        onSuccess={() => {
          setShowCreateUserModal(false);
          queryClient.invalidateQueries({ queryKey: ['user-stats'] });
          toast.success('User created successfully');
        }}
      />
    </div>
  );
}

export default withErrorBoundary(SystemSettings, { level: 'page' });