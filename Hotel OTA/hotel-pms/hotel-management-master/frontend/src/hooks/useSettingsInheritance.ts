import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useProperty } from '../context/PropertyContext';
import { api } from '../services/api';
import { ApplyToScope } from '../components/settings/ApplyToSelector';

/**
 * Settings Inheritance Status
 */
interface InheritanceStatus {
  propertyId: string;
  propertyName: string;
  hasGroup: boolean;
  groupId?: string;
  groupName?: string;
  inheritanceEnabled: boolean;
  lastSyncAt?: string;
  canOverride: boolean;
}

/**
 * Settings Update Result
 */
interface SettingsUpdateResult {
  success: boolean;
  message: string;
  propertiesUpdated: number;
  propertyIds?: string[];
  appliedSettings?: string[];
  property?: Record<string, unknown>;
}

/**
 * Settings Update Options
 */
interface SettingsUpdateOptions {
  /** The scope of the update */
  scope: ApplyToScope;

  /** The property ID (required unless scope is 'all') */
  propertyId?: string;

  /** Setting updates to apply */
  settingUpdates: Record<string, unknown>;

  /** Type of setting being updated */
  settingType?: string;

  /** Whether to show confirmation dialog */
  skipConfirmation?: boolean;
}

interface ResolvedSettingsPayload {
  settingType: string;
  settingUpdates: Record<string, unknown>;
}

/**
 * Custom hook for managing settings inheritance
 *
 * Provides functionality for:
 * - Fetching inheritance status
 * - Applying settings with different scopes
 * - Managing confirmation dialogs
 * - Error handling and loading states
 */
export function useSettingsInheritance() {
  const resolveSettingsPayload = useCallback(
    (settingType: string | undefined, settingUpdates: Record<string, unknown>): ResolvedSettingsPayload => {
      switch (settingType) {
        case 'system':
          return {
            settingType: 'hotel_settings',
            settingUpdates,
          };
        case 'integrations':
          return {
            settingType: 'hotel_settings',
            settingUpdates: { integrations: settingUpdates },
          };
        case 'operations':
          return {
            settingType: 'hotel_settings',
            settingUpdates: { operations: settingUpdates },
          };
        case 'cancellation_policies':
          return {
            settingType: 'hotel_settings',
            settingUpdates: { policies: settingUpdates },
          };
        default:
          return {
            settingType: settingType || 'hotel_settings',
            settingUpdates,
          };
      }
    },
    []
  );

  const { selectedPropertyId } = useProperty();
  const queryClient = useQueryClient();

  const [showConfirmation, setShowConfirmation] = useState(false);
  const [pendingUpdate, setPendingUpdate] = useState<SettingsUpdateOptions | null>(null);

  /**
   * Fetch inheritance status for a property
   */
  const useInheritanceStatus = (propertyId?: string) => {
    const id = propertyId || selectedPropertyId;

    return useQuery<InheritanceStatus>({
      queryKey: ['settings', 'inheritance-status', id],
      queryFn: async () => {
        if (!id) throw new Error('No property ID provided');

        const response = await api.get(`/settings/inheritance-status/${id}`);
        return response.data.data;
      },
      enabled: !!id,
      staleTime: 5 * 60 * 1000, // 5 minutes
    });
  };

  /**
   * Apply group settings to a property
   */
  const applyGroupSettingsMutation = useMutation({
    mutationFn: async ({ propertyId, groupId }: { propertyId: string; groupId?: string }) => {
      const response = await api.post('/settings/apply-group-settings', {
        propertyId,
        groupId,
      });
      return response.data.data;
    },
    onSuccess: () => {
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      queryClient.invalidateQueries({ queryKey: ['properties'] });
    },
  });

  /**
   * Toggle inheritance for a property
   */
  const toggleInheritanceMutation = useMutation({
    mutationFn: async ({
      propertyId,
      inheritSettings,
    }: {
      propertyId: string;
      inheritSettings: boolean;
    }) => {
      try {
        const response = await api.put(`/settings/toggle-inheritance/${propertyId}`, {
          inheritSettings,
        });
        return response.data.data;
      } catch (error: unknown) {
        throw error instanceof Error ? error : new Error('Failed to toggle inheritance');
      }
    },
    onSuccess: (_, variables) => {
      // Invalidate inheritance status
      queryClient.invalidateQueries({
        queryKey: ['settings', 'inheritance-status', variables.propertyId],
      });
    },
  });

  /**
   * Generic settings update mutation
   */
  const updateSettingsMutation = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      try {
        const response = await api.post('/settings/apply', payload);
        return response.data.data as SettingsUpdateResult;
      } catch (error: unknown) {
        throw error instanceof Error ? error : new Error('Failed to update settings');
      }
    },
    onSuccess: () => {
      // Invalidate all settings queries
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      queryClient.invalidateQueries({ queryKey: ['properties'] });
    },
  });

  /**
   * Apply settings with the specified scope
   */
  const applySettings = useCallback(
    async (options: SettingsUpdateOptions) => {
      const { scope, propertyId, settingUpdates, settingType, skipConfirmation } = options;

      // If bulk update and confirmation needed, show dialog
      if (scope !== 'single' && !skipConfirmation) {
        setPendingUpdate(options);
        setShowConfirmation(true);
        return null;
      }

      const effectivePropertyId = propertyId || selectedPropertyId;
      if (!effectivePropertyId) {
        throw new Error('Property ID is required');
      }

      const resolved = resolveSettingsPayload(settingType, settingUpdates);

      return updateSettingsMutation.mutateAsync({
        scope,
        propertyId: effectivePropertyId,
        settingType: resolved.settingType,
        settingUpdates: resolved.settingUpdates,
      });
    },
    [selectedPropertyId, updateSettingsMutation, resolveSettingsPayload]
  );

  /**
   * Confirm pending bulk update
   */
  const confirmBulkUpdate = useCallback(async () => {
    if (!pendingUpdate) return null;

    setShowConfirmation(false);

    try {
      const result = await applySettings({
        ...pendingUpdate,
        skipConfirmation: true,
      });

      setPendingUpdate(null);
      return result;
    } catch (error) {
      setPendingUpdate(null);
      throw error;
    }
  }, [pendingUpdate, applySettings]);

  /**
   * Cancel pending bulk update
   */
  const cancelBulkUpdate = useCallback(() => {
    setShowConfirmation(false);
    setPendingUpdate(null);
  }, []);

  /**
   * Update check-in/out times
   */
  const updateCheckInOut = useCallback(
    async (checkInTime: string, checkOutTime: string, scope: ApplyToScope = 'single') => {
      return applySettings({
        scope,
        propertyId: selectedPropertyId,
        settingUpdates: { checkInTime, checkOutTime },
        settingType: 'checkInOut',
      });
    },
    [selectedPropertyId, applySettings]
  );

  /**
   * Update currency
   */
  const updateCurrency = useCallback(
    async (currency: string, scope: ApplyToScope = 'single') => {
      return applySettings({
        scope,
        propertyId: selectedPropertyId,
        settingUpdates: { currency },
        settingType: 'currency',
      });
    },
    [selectedPropertyId, applySettings]
  );

  /**
   * Update timezone
   */
  const updateTimezone = useCallback(
    async (timezone: string, scope: ApplyToScope = 'single') => {
      return applySettings({
        scope,
        propertyId: selectedPropertyId,
        settingUpdates: { timezone },
        settingType: 'timezone',
      });
    },
    [selectedPropertyId, applySettings]
  );

  /**
   * Update cancellation policy
   */
  const updateCancellationPolicy = useCallback(
    async (cancellationPolicy: Record<string, unknown>, scope: ApplyToScope = 'single') => {
      return applySettings({
        scope,
        propertyId: selectedPropertyId,
        settingUpdates: { cancellationPolicy },
        settingType: 'cancellationPolicy',
      });
    },
    [selectedPropertyId, applySettings]
  );

  return {
    // Queries
    useInheritanceStatus,

    // Mutations
    applyGroupSettings: applyGroupSettingsMutation.mutate,
    applyGroupSettingsAsync: applyGroupSettingsMutation.mutateAsync,
    toggleInheritance: toggleInheritanceMutation.mutate,
    toggleInheritanceAsync: toggleInheritanceMutation.mutateAsync,
    applySettings,

    // Confirmation dialog state
    showConfirmation,
    pendingUpdate,
    confirmBulkUpdate,
    cancelBulkUpdate,

    // Helper methods
    updateCheckInOut,
    updateCurrency,
    updateTimezone,
    updateCancellationPolicy,

    // Loading states
    isUpdating: updateSettingsMutation.isPending,
    isApplyingGroupSettings: applyGroupSettingsMutation.isPending,
    isTogglingInheritance: toggleInheritanceMutation.isPending,

    // Error states
    updateError: updateSettingsMutation.error,
    applyGroupSettingsError: applyGroupSettingsMutation.error,
    toggleInheritanceError: toggleInheritanceMutation.error,
  };
}

/**
 * Get the number of properties that will be affected by a scope
 */
export function useAffectedPropertiesCount(
  scope: ApplyToScope,
  groupPropertyCount?: number
): number {
  const { properties } = useProperty();

  if (scope === 'single') return 1;
  if (scope === 'group') return groupPropertyCount || 0;
  if (scope === 'all') return properties.length;

  return 0;
}

export default useSettingsInheritance;
