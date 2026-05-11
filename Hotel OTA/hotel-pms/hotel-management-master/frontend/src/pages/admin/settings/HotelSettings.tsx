import React, { useState, useEffect, useRef} from 'react';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  Building,
  MapPin,
  Phone,
  Mail,
  Globe,
  Clock,
  FileText,
  DollarSign,
  Save,
  Loader2,
  Users
} from 'lucide-react';
import { Button } from '../../../components/ui/button';
import toast from 'react-hot-toast';
import { ApplyToSelector, ApplyToConfirmation, ApplyToScope } from '../../../components/settings/ApplyToSelector';
import { useSettingsInheritance, useAffectedPropertiesCount } from '../../../hooks/useSettingsInheritance';
import { useProperty } from '../../../context/PropertyContext';
import { api } from '../../../services/api';
import { withErrorBoundary } from '../../../components/ErrorBoundary';

interface HotelFormData {
  basicInfo: {
    name: string;
    address: {
      street: string;
      city: string;
      state: string;
      country: string;
      postalCode: string;
    };
    contact: {
      phone: string;
      email: string;
      website: string;
    };
  };
  operations: {
    checkInTime: string;
    checkOutTime: string;
    currency: string;
    timezone: string;
  };
  policies: {
    cancellation: string;
    child: string;
    pet: string;
    smoking: string;
    extraBed: string;
  };
  taxes: {
    gst: number;
    serviceCharge: number;
    localTax: number;
    tourismTax: number;
  };
}

interface HotelSettingsProps {
  onSettingsChange?: (hasChanges: boolean) => void;
}

type GuestMeetUpPolicyPayload = {
  meetUpsEnabled: boolean;
  meetUpsEmailNotify: boolean;
  maxPendingInvitesPerGuest: number;
  quietHoursStart: string;
  quietHoursEnd: string;
  blockUrlsInMeetUpText: boolean;
  profanityAction: 'none' | 'block' | 'sanitize';
};

function GuestMeetUpPolicyPanel({
  selectedPropertyId,
  guestExperience,
  isSaving,
  onSave
}: {
  selectedPropertyId: string | null | undefined;
  guestExperience?: {
    meetUpsEnabled: boolean;
    meetUpsEmailNotify?: boolean;
    maxPendingInvitesPerGuest?: number;
    quietHoursStart?: string | null;
    quietHoursEnd?: string | null;
    blockUrlsInMeetUpText?: boolean;
    profanityAction?: 'none' | 'block' | 'sanitize';
  };
  isSaving: boolean;
  onSave: (payload: GuestMeetUpPolicyPayload) => void;
}) {
  const [draft, setDraft] = useState<GuestMeetUpPolicyPayload>({
    meetUpsEnabled: true,
    meetUpsEmailNotify: true,
    maxPendingInvitesPerGuest: 10,
    quietHoursStart: '',
    quietHoursEnd: '',
    blockUrlsInMeetUpText: true,
    profanityAction: 'sanitize'
  });

  useEffect(() => {
    if (!guestExperience) return;
    setDraft({
      meetUpsEnabled: guestExperience.meetUpsEnabled !== false,
      meetUpsEmailNotify: guestExperience.meetUpsEmailNotify !== false,
      maxPendingInvitesPerGuest: Math.min(
        100,
        Math.max(1, guestExperience.maxPendingInvitesPerGuest ?? 10)
      ),
      quietHoursStart: guestExperience.quietHoursStart || '',
      quietHoursEnd: guestExperience.quietHoursEnd || '',
      blockUrlsInMeetUpText: guestExperience.blockUrlsInMeetUpText !== false,
      profanityAction: guestExperience.profanityAction || 'sanitize'
    });
  }, [guestExperience]);

  return (
    <div className="border border-gray-200 dark:border-gray-600 rounded-lg p-6 space-y-4">
      <h3 className="text-md font-medium text-gray-900 dark:text-gray-100 mb-1 flex items-center gap-2">
        <Users className="h-4 w-4" />
        <span>Guest meet-ups & safety</span>
      </h3>
      <p className="text-sm text-gray-600 dark:text-gray-400">
        Controls discoverability, invite limits, quiet hours (hotel timezone from Operations), and text moderation for
        guest-created meet-ups. Saving applies only to this section.
      </p>

      <label className="flex items-center gap-3 cursor-pointer select-none">
        <input
          type="checkbox"
          className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          checked={draft.meetUpsEnabled}
          onChange={(e) => setDraft((d) => ({ ...d, meetUpsEnabled: e.target.checked }))}
        />
        <span className="text-sm text-gray-800 dark:text-gray-200">Enable guest meet-ups</span>
      </label>

      <label className="flex items-center gap-3 cursor-pointer select-none">
        <input
          type="checkbox"
          className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          checked={draft.meetUpsEmailNotify}
          onChange={(e) => setDraft((d) => ({ ...d, meetUpsEmailNotify: e.target.checked }))}
        />
        <span className="text-sm text-gray-800 dark:text-gray-200">Email guests for meet-up events (when SMTP is configured)</span>
      </label>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Max pending invites per guest
        </label>
        <input
          type="number"
          min={1}
          max={100}
          className="w-full max-w-xs px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
          value={draft.maxPendingInvitesPerGuest}
          onChange={(e) =>
            setDraft((d) => ({
              ...d,
              maxPendingInvitesPerGuest: Math.min(100, Math.max(1, parseInt(e.target.value, 10) || 1))
            }))
          }
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Quiet hours start (HH:mm, hotel time)
          </label>
          <input
            type="time"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            value={draft.quietHoursStart}
            onChange={(e) => setDraft((d) => ({ ...d, quietHoursStart: e.target.value }))}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Quiet hours end (HH:mm)
          </label>
          <input
            type="time"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            value={draft.quietHoursEnd}
            onChange={(e) => setDraft((d) => ({ ...d, quietHoursEnd: e.target.value }))}
          />
        </div>
      </div>
      <p className="text-xs text-gray-500">
        Leave both times empty to disable. New invites only are blocked during this window.
      </p>

      <label className="flex items-center gap-3 cursor-pointer select-none">
        <input
          type="checkbox"
          className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          checked={draft.blockUrlsInMeetUpText}
          onChange={(e) => setDraft((d) => ({ ...d, blockUrlsInMeetUpText: e.target.checked }))}
        />
        <span className="text-sm text-gray-800 dark:text-gray-200">Strip links from meet-up title, description, and location text</span>
      </label>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Profanity policy</label>
        <select
          className="w-full max-w-md px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
          value={draft.profanityAction}
          onChange={(e) =>
            setDraft((d) => ({ ...d, profanityAction: e.target.value as GuestMeetUpPolicyPayload['profanityAction'] }))
          }
        >
          <option value="sanitize">Mask words (default)</option>
          <option value="block">Reject message if profanity detected</option>
          <option value="none">No profanity filter</option>
        </select>
      </div>

      <div className="pt-2">
        <Button
          type="button"
          disabled={!selectedPropertyId || isSaving}
          className="flex items-center gap-2"
          onClick={() =>
            onSave({
              ...draft,
              quietHoursStart: draft.quietHoursStart || '',
              quietHoursEnd: draft.quietHoursEnd || ''
            })
          }
        >
          {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save meet-up policies
        </Button>
      </div>
    </div>
  );
}

function HotelSettings({ onSettingsChange }: HotelSettingsProps = {}) {
  const { selectedPropertyId } = useProperty();

  // Multi-property state
  const [showSuccess, setShowSuccess] = useState(false);
  const [operationsScope, setOperationsScope] = useState<ApplyToScope>('single');
  const [policiesScope, setPoliciesScope] = useState<ApplyToScope>('single');
  const [showPoliciesSuccess, setShowPoliciesSuccess] = useState(false);

  // Settings inheritance hook
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

  // Fetch inheritance status
  const { data: inheritanceStatus } = useInheritanceStatus(selectedPropertyId);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isDirty }
  } = useForm<HotelFormData>({
    defaultValues: {
      basicInfo: {
        name: 'THE PENTOUZ Hotel',
        address: {
          street: '123 Main Street',
          city: 'Mumbai',
          state: 'Maharashtra',
          country: 'India',
          postalCode: '400001'
        },
        contact: {
          phone: '+91-9876543210',
          email: 'info@thepentouz.com',
          website: 'https://thepentouz.com'
        }
      },
      operations: {
        checkInTime: '15:00',
        checkOutTime: '11:00',
        currency: 'INR',
        timezone: 'Asia/Kolkata'
      },
      policies: {
        cancellation: '24 hours before check-in',
        child: 'Children under 12 stay free with parents',
        pet: 'Pets are not allowed',
        smoking: 'Smoking is not allowed in rooms',
        extraBed: 'Extra bed available on request'
      },
      taxes: {
        gst: 12,
        serviceCharge: 10,
        localTax: 0,
        tourismTax: 0
      }
    }
  });

  // Get affected properties count
  const affectedCount = useAffectedPropertiesCount(
    operationsScope,
    inheritanceStatus?.groupPropertyCount || 0
  );

  const affectedPoliciesCount = useAffectedPropertiesCount(
    policiesScope,
    inheritanceStatus?.groupPropertyCount || 0
  );

  // Fetch hotel settings
  const { data: hotelSettings, isLoading } = useQuery({
    queryKey: ['hotel-settings', selectedPropertyId],
    queryFn: async () => {
      const { data } = await api.get('/hotel-settings');
      return data.data.settings;
    },
    enabled: !!selectedPropertyId
  });

  // Populate form when data loads (onSuccess removed in TanStack Query v5)
  useEffect(() => {
    if (hotelSettings) {
      setValue('basicInfo', hotelSettings.basicInfo || {}, { shouldDirty: false });
      setValue('operations', hotelSettings.operations || {}, { shouldDirty: false });
      setValue('policies', hotelSettings.policies || {}, { shouldDirty: false });
      setValue('taxes', hotelSettings.taxes || {}, { shouldDirty: false });
    }
  }, [hotelSettings, setValue]);

  const { data: guestExperience, refetch: refetchGuestExp } = useQuery({
    queryKey: ['hotel-settings-guest-experience', selectedPropertyId],
    queryFn: async () => {
      const { data } = await api.get('/hotel-settings/guest-experience', {
        params: { propertyId: selectedPropertyId }
      });
      return data.data.guestExperience as {
        meetUpsEnabled: boolean;
        meetUpsEmailNotify?: boolean;
        maxPendingInvitesPerGuest?: number;
        quietHoursStart?: string | null;
        quietHoursEnd?: string | null;
        blockUrlsInMeetUpText?: boolean;
        profanityAction?: 'none' | 'block' | 'sanitize';
      };
    },
    enabled: !!selectedPropertyId
  });

  const saveGuestExperienceMutation = useMutation({
    mutationFn: async (payload: {
      meetUpsEnabled: boolean;
      meetUpsEmailNotify: boolean;
      maxPendingInvitesPerGuest: number;
      quietHoursStart: string;
      quietHoursEnd: string;
      blockUrlsInMeetUpText: boolean;
      profanityAction: 'none' | 'block' | 'sanitize';
    }) => {
      const { data } = await api.put('/hotel-settings/guest-experience', payload, {
        params: { propertyId: selectedPropertyId }
      });
      return data;
    },
    onSuccess: () => {
      toast.success('Guest meet-up policies saved');
      void refetchGuestExp();
    },
    onError: () => {
      toast.error('Failed to save guest meet-up policies');
    }
  });

  // Watch for form changes
  const successTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const policiesSuccessTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (successTimerRef.current) clearTimeout(successTimerRef.current);
      if (policiesSuccessTimerRef.current) clearTimeout(policiesSuccessTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (onSettingsChange) {
      onSettingsChange(isDirty);
    }
  }, [isDirty, onSettingsChange]);

  // Save basic info mutation
  const saveBasicInfoMutation = useMutation({
    mutationFn: async (data: HotelFormData['basicInfo']) => {
      const response = await api.put('/hotel-settings/basic-info', data);
      return response.data;
    }
  });

  // Save taxes mutation
  const saveTaxesMutation = useMutation({
    mutationFn: async (data: HotelFormData['taxes']) => {
      const response = await api.put('/hotel-settings/taxes', data);
      return response.data;
    }
  });

  const onSubmit = async (data: HotelFormData) => {
    try {
      // Basic info and contact are always single-property (property-specific)
      await Promise.all([
        saveBasicInfoMutation.mutateAsync(data.basicInfo),
        saveTaxesMutation.mutateAsync(data.taxes)
      ]);

      // Policies settings use multi-property support
      const policiesResult = await applySettings({
        scope: policiesScope,
        propertyId: selectedPropertyId,
        settingUpdates: {
          cancellation: data.policies.cancellation,
          child: data.policies.child,
          pet: data.policies.pet,
          smoking: data.policies.smoking,
          extraBed: data.policies.extraBed
        },
        settingType: 'cancellation_policies',
      });

      // If confirmation dialog was shown for policies, return early
      if (!policiesResult) {
        return;
      }

      // Operations settings use multi-property support
      const operationsResult = await applySettings({
        scope: operationsScope,
        propertyId: selectedPropertyId,
        settingUpdates: {
          checkInTime: data.operations.checkInTime,
          checkOutTime: data.operations.checkOutTime,
          currency: data.operations.currency,
          timezone: data.operations.timezone
        },
        settingType: 'operations',
      });

      // If confirmation dialog was shown for operations, return early
      if (!operationsResult) {
        return;
      }

      setShowSuccess(true);
      if (successTimerRef.current) clearTimeout(successTimerRef.current);
      successTimerRef.current = setTimeout(() => setShowSuccess(false), 3000);

      if (policiesScope !== 'single') {
        setShowPoliciesSuccess(true);
        if (policiesSuccessTimerRef.current) clearTimeout(policiesSuccessTimerRef.current);
        policiesSuccessTimerRef.current = setTimeout(() => setShowPoliciesSuccess(false), 3000);
      }

      const totalUpdated = Math.max(
        policiesResult.propertiesUpdated || 1,
        operationsResult.propertiesUpdated || 1
      );

      toast.success(`Hotel settings updated successfully${
        (operationsScope !== 'single' || policiesScope !== 'single') ? ` for ${totalUpdated} properties` : ''
      }`);

      // Reset scopes
      setPoliciesScope('single');
      setOperationsScope('single');

      // Reset form dirty state
      const currentValues = watch();
      Object.keys(currentValues).forEach(key => {
        setValue(key as keyof HotelFormData, currentValues[key], { shouldDirty: false });
      });

      if (onSettingsChange) {
        onSettingsChange(false);
      }
    } catch (error) {
      toast.error('Failed to update hotel settings');
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

        toast.success(`Settings updated for ${result.propertiesUpdated} properties`);

        // Reset form dirty state
        const currentValues = watch();
        Object.keys(currentValues).forEach(key => {
          setValue(key as keyof HotelFormData, currentValues[key], { shouldDirty: false });
        });

        if (onSettingsChange) {
          onSettingsChange(false);
        }
      }
    } catch (error) {
      toast.error('Failed to update settings');
    }
  };

  const isAnyLoading = saveBasicInfoMutation.isPending ||
                     saveTaxesMutation.isPending;

  if (isLoading) {
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
            <Building className="h-5 w-5" />
            <span>Hotel Settings</span>
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Configure your hotel's basic information, policies, and pricing
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
          {/* Basic Information */}
          <div>
            <h3 className="text-md font-medium text-gray-900 dark:text-gray-100 mb-4 flex items-center space-x-2">
              <Building className="h-4 w-4" />
              <span>Basic Information</span>
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Hotel Name
                </label>
                <input
                  {...register('basicInfo.name', { required: 'Hotel name is required' })}
                  type="text"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {errors.basicInfo?.name && (
                  <p className="text-red-500 text-xs mt-1">{errors.basicInfo.name.message}</p>
                )}
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  <MapPin className="h-4 w-4 inline mr-1" />
                  Street Address
                </label>
                <input
                  {...register('basicInfo.address.street', { required: 'Address is required' })}
                  type="text"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {errors.basicInfo?.address?.street && (
                  <p className="text-red-500 text-xs mt-1">{errors.basicInfo.address.street.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  City
                </label>
                <input
                  {...register('basicInfo.address.city', { required: 'City is required' })}
                  type="text"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  State/Province
                </label>
                <input
                  {...register('basicInfo.address.state', { required: 'State is required' })}
                  type="text"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Country
                </label>
                <input
                  {...register('basicInfo.address.country', { required: 'Country is required' })}
                  type="text"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Postal Code
                </label>
                <input
                  {...register('basicInfo.address.postalCode')}
                  type="text"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Contact Information */}
          <div>
            <h3 className="text-md font-medium text-gray-900 dark:text-gray-100 mb-4 flex items-center space-x-2">
              <Phone className="h-4 w-4" />
              <span>Contact Information</span>
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  <Phone className="h-4 w-4 inline mr-1" />
                  Phone Number
                </label>
                <input
                  {...register('basicInfo.contact.phone', { required: 'Phone is required' })}
                  type="tel"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  <Mail className="h-4 w-4 inline mr-1" />
                  Email Address
                </label>
                <input
                  {...register('basicInfo.contact.email', {
                    required: 'Email is required',
                    pattern: {
                      value: /^\S+@\S+$/i,
                      message: 'Invalid email format'
                    }
                  })}
                  type="email"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  <Globe className="h-4 w-4 inline mr-1" />
                  Website
                </label>
                <input
                  {...register('basicInfo.contact.website')}
                  type="url"
                  placeholder="https://"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Operational Settings */}
          <div>
            <h3 className="text-md font-medium text-gray-900 dark:text-gray-100 mb-4 flex items-center space-x-2">
              <Clock className="h-4 w-4" />
              <span>Operational Settings</span>
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Check-in Time
                </label>
                <input
                  {...register('operations.checkInTime', { required: 'Check-in time is required' })}
                  type="time"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Check-out Time
                </label>
                <input
                  {...register('operations.checkOutTime', { required: 'Check-out time is required' })}
                  type="time"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Currency
                </label>
                <select
                  {...register('operations.currency')}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="INR">INR - Indian Rupee</option>
                  <option value="USD">USD - US Dollar</option>
                  <option value="EUR">EUR - Euro</option>
                  <option value="GBP">GBP - British Pound</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Timezone
                </label>
                <select
                  {...register('operations.timezone')}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="Asia/Kolkata">Asia/Kolkata (IST)</option>
                  <option value="America/New_York">America/New_York (EST)</option>
                  <option value="Europe/London">Europe/London (GMT)</option>
                  <option value="Asia/Tokyo">Asia/Tokyo (JST)</option>
                </select>
              </div>
            </div>

            {/* Multi-Property Scope Selector for Operations */}
            <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-600">
              <ApplyToSelector
                value={operationsScope}
                onChange={setOperationsScope}
                isInGroup={inheritanceStatus?.hasGroup || false}
                groupName={inheritanceStatus?.groupName}
                totalProperties={inheritanceStatus?.groupPropertyCount || 0}
                showWarning={true}
                warningMessage="These operational settings (check-in/out times, currency, timezone) will be applied to all selected properties. This affects booking availability, pricing display, and guest communications."
              />
            </div>
          </div>

          {/* Policies */}
          <div>
            <h3 className="text-md font-medium text-gray-900 dark:text-gray-100 mb-4 flex items-center space-x-2">
              <FileText className="h-4 w-4" />
              <span>Hotel Policies</span>
            </h3>

            {/* Policies Success Message */}
            {showPoliciesSuccess && (
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-800 dark:text-green-200 px-4 py-3 rounded-lg mb-4">
                <p className="font-medium">Cancellation policies updated successfully!</p>
                {policiesScope !== 'single' && affectedPoliciesCount > 1 && (
                  <p className="text-sm mt-1">Changes applied to {affectedPoliciesCount} properties</p>
                )}
              </div>
            )}

            {/* Policies Error Message */}
            {updateError && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-200 px-4 py-3 rounded-lg mb-4">
                <p className="font-medium">Error: {updateError}</p>
              </div>
            )}

            {/* Policies Inheritance Status Card */}
            {inheritanceStatus?.isInheriting && inheritanceStatus?.hasGroup && (
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-4 rounded-lg mb-4">
                <div className="flex items-start">
                  <div className="h-5 w-5 rounded-full bg-blue-100 dark:bg-blue-800 flex items-center justify-center mt-0.5 mr-3">
                    <svg className="h-3 w-3 text-blue-600 dark:text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                      <path
                        fillRule="evenodd"
                        d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                      This property is part of: {inheritanceStatus.groupName}
                    </p>
                    <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                      Cancellation policies are inherited from the property group.
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

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Cancellation Policy
                </label>
                <textarea
                  {...register('policies.cancellation')}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Describe your cancellation policy..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Child Policy
                </label>
                <textarea
                  {...register('policies.child')}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Describe your policy for children..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Pet Policy
                </label>
                <textarea
                  {...register('policies.pet')}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Describe your policy for pets..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Smoking Policy
                </label>
                <textarea
                  {...register('policies.smoking')}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Describe your smoking policy..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Extra Bed Policy
                </label>
                <textarea
                  {...register('policies.extraBed')}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Describe your extra bed policy..."
                />
              </div>
            </div>

            {/* Multi-Property Scope Selector for Cancellation Policies */}
            <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
              <ApplyToSelector
                value={policiesScope}
                onChange={setPoliciesScope}
                isInGroup={inheritanceStatus?.hasGroup || false}
                groupName={inheritanceStatus?.groupName}
                totalProperties={inheritanceStatus?.groupPropertyCount || 0}
                showWarning={true}
                warningMessage="These cancellation policies will be applied to all selected properties. Ensure the policies comply with local regulations for all properties."
              />
            </div>
          </div>

          {/* Taxes and Charges */}
          <div>
            <h3 className="text-md font-medium text-gray-900 dark:text-gray-100 mb-4 flex items-center space-x-2">
              <DollarSign className="h-4 w-4" />
              <span>Taxes & Charges (%)</span>
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  GST/VAT Rate
                </label>
                <input
                  {...register('taxes.gst', {
                    required: 'GST rate is required',
                    min: { value: 0, message: 'Rate must be 0 or greater' },
                    max: { value: 100, message: 'Rate cannot exceed 100%' }
                  })}
                  type="number"
                  step="0.01"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Service Charge
                </label>
                <input
                  {...register('taxes.serviceCharge', {
                    min: { value: 0, message: 'Rate must be 0 or greater' },
                    max: { value: 100, message: 'Rate cannot exceed 100%' }
                  })}
                  type="number"
                  step="0.01"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Local Tax
                </label>
                <input
                  {...register('taxes.localTax', {
                    min: { value: 0, message: 'Rate must be 0 or greater' },
                    max: { value: 100, message: 'Rate cannot exceed 100%' }
                  })}
                  type="number"
                  step="0.01"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Tourism Tax
                </label>
                <input
                  {...register('taxes.tourismTax', {
                    min: { value: 0, message: 'Rate must be 0 or greater' },
                    max: { value: 100, message: 'Rate cannot exceed 100%' }
                  })}
                  type="number"
                  step="0.01"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Guest meet-ups & safety (saved on button) */}
          <GuestMeetUpPolicyPanel
            selectedPropertyId={selectedPropertyId}
            guestExperience={guestExperience}
            isSaving={saveGuestExperienceMutation.isPending}
            onSave={(payload) => saveGuestExperienceMutation.mutate(payload)}
          />

          {/* Success Message */}
          {showSuccess && (
            <div className="flex items-center space-x-2 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
              <div className="h-5 w-5 rounded-full bg-green-100 dark:bg-green-800 flex items-center justify-center">
                <svg className="h-3 w-3 text-green-600 dark:text-green-400" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <p className="text-sm text-green-800 dark:text-green-400">
                Settings updated successfully!
              </p>
            </div>
          )}

          {/* Error Message */}
          {updateError && (
            <div className="flex items-start space-x-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <div className="h-5 w-5 rounded-full bg-red-100 dark:bg-red-800 flex items-center justify-center mt-0.5">
                <svg className="h-3 w-3 text-red-600 dark:text-red-400" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-red-900 dark:text-red-400 mb-1">Update Failed</p>
                <p className="text-xs text-red-800 dark:text-red-500">
                  {updateError instanceof Error ? updateError.message : 'An error occurred while updating settings'}
                </p>
              </div>
            </div>
          )}

          {/* Save Button */}
          <div className="flex justify-end pt-4 border-t border-gray-200 dark:border-gray-600">
            <Button
              type="submit"
              disabled={!isDirty || isAnyLoading || isUpdating}
              className="flex items-center space-x-2"
            >
              {(isAnyLoading || isUpdating) ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              <span>{(isAnyLoading || isUpdating) ? 'Saving...' : 'Save Changes'}</span>
            </Button>
          </div>
        </form>

        {/* Inheritance Info Card (if applicable) */}
        {inheritanceStatus?.hasGroup && inheritanceStatus.inheritanceEnabled && (
          <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            <div className="flex items-start space-x-3">
              <div className="h-5 w-5 rounded-full bg-blue-100 dark:bg-blue-800 flex items-center justify-center mt-0.5">
                <svg className="h-3 w-3 text-blue-600 dark:text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-blue-900 dark:text-blue-400 mb-1">
                  Group Inheritance Enabled
                </p>
                <p className="text-xs text-blue-800 dark:text-blue-500">
                  This property is part of "{inheritanceStatus.groupName}" group and inherits settings automatically.
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
        scope={pendingUpdate?.scope || 'single'}
        affectedCount={pendingUpdate?.scope === policiesScope ? affectedPoliciesCount : affectedCount}
        settingName={pendingUpdate?.settingType === 'cancellation_policies' ? 'Cancellation Policies' : 'operational settings'}
        groupName={inheritanceStatus?.groupName}
        onConfirm={handleConfirm}
        onCancel={cancelBulkUpdate}
      />
    </div>
  );
}

export default withErrorBoundary(HotelSettings, { level: 'page' });