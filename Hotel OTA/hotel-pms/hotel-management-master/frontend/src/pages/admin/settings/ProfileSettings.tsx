import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  User,
  Camera,
  Save,
  Loader2,
  MapPin,
  Phone,
  Mail,
  Globe,
  Clock
} from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { useAuth } from '../../../context/AuthContext';
import toast from 'react-hot-toast';
import { api } from '../../../services/api';
import { withErrorBoundary } from '../../../components/ErrorBoundary';

interface ProfileFormData {
  name: string;
  email: string;
  phone: string;
  timezone: string;
  language: string;
  avatar?: string;
}

interface ProfileSettingsProps {
  onSettingsChange?: (hasChanges: boolean) => void;
}

function ProfileSettings({ onSettingsChange }: ProfileSettingsProps = {}) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isDirty }
  } = useForm<ProfileFormData>({
    defaultValues: {
      name: user?.name || '',
      email: user?.email || '',
      phone: user?.phone || '',
      timezone: user?.timezone || 'Asia/Kolkata',
      language: user?.language || 'en',
      avatar: user?.avatar || ''
    }
  });

  // Load profile preferences stored in user-preferences/profile
  useEffect(() => {
    const loadProfilePreferences = async () => {
      try {
        const { data } = await api.get('/user-preferences/profile');
        const profilePrefs = data?.data?.profile || {};
        setValue('timezone', profilePrefs.timezone || user?.timezone || 'Asia/Kolkata', { shouldDirty: false });
        setValue('language', profilePrefs.language || user?.language || 'en', { shouldDirty: false });
        setValue('avatar', profilePrefs.avatar || user?.avatar || '', { shouldDirty: false });
      } catch {
        // Keep default values from auth context
      }
    };
    loadProfilePreferences();
  }, [setValue, user]);

  // Watch for form changes
  useEffect(() => {
    if (onSettingsChange) {
      onSettingsChange(isDirty);
    }
  }, [isDirty, onSettingsChange]);

  // Timezones list
  const timezones = [
    { value: 'Asia/Kolkata', label: 'Asia/Kolkata (GMT+5:30)' },
    { value: 'America/New_York', label: 'America/New_York (GMT-5)' },
    { value: 'America/Los_Angeles', label: 'America/Los_Angeles (GMT-8)' },
    { value: 'Europe/London', label: 'Europe/London (GMT+0)' },
    { value: 'Europe/Paris', label: 'Europe/Paris (GMT+1)' },
    { value: 'Asia/Tokyo', label: 'Asia/Tokyo (GMT+9)' },
    { value: 'Australia/Sydney', label: 'Australia/Sydney (GMT+10)' }
  ];

  // Languages list
  const languages = [
    { value: 'en', label: 'English' },
    { value: 'es', label: 'Spanish' },
    { value: 'fr', label: 'French' },
    { value: 'de', label: 'German' },
    { value: 'hi', label: 'Hindi' },
    { value: 'ja', label: 'Japanese' },
    { value: 'zh', label: 'Chinese' }
  ];

  // Save profile mutation
  const saveProfileMutation = useMutation({
    mutationFn: async (data: ProfileFormData) => {

      const { data: responseData } = await api.patch('/auth/profile', {
        name: data.name,
        phone: data.phone,
      });
      // Also update timezone/language in user preferences
      await api.put('/user-preferences/profile', {
        timezone: data.timezone,
        language: data.language,
        avatar: data.avatar,
      });
      return responseData;
    },
    onSuccess: () => {
      toast.success('Profile updated successfully');
      queryClient.invalidateQueries({ queryKey: ['user'] });
      if (onSettingsChange) {
        onSettingsChange(false);
      }
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update profile');
    }
  });

  const onSubmit = (data: ProfileFormData) => {
    saveProfileMutation.mutate(data);
  };

  const handleAvatarChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Check file size
      if (file.size > 2 * 1024 * 1024) {
        toast.error('File size must be less than 2MB');
        return;
      }

      // Show preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarPreview(reader.result as string);
      };
      reader.readAsDataURL(file);

      // Upload file
      const formData = new FormData();
      formData.append('avatar', file);

      try {
        const { data } = await api.post('/upload/avatar', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        setValue('avatar', data.data.avatarUrl, { shouldDirty: true });

        // Update the user context and localStorage immediately
        queryClient.setQueryData(['user'], (oldData: Record<string, unknown>) => {
          if (oldData && oldData.user) {
            const updatedUser = {
              ...oldData.user,
              avatar: data.data.avatarUrl
            };
            localStorage.setItem('user', JSON.stringify(updatedUser));
            return {
              ...oldData,
              user: updatedUser
            };
          }
          return oldData;
        });

        // Also refresh the user data from server to ensure consistency
        queryClient.invalidateQueries({ queryKey: ['user'] });

        toast.success('Avatar uploaded successfully');
      } catch (error) {
        toast.error('Failed to upload avatar');
      }
    }
  };

  return (
    <div className="p-6">
      <div className="max-w-2xl">
        {/* Header */}
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center space-x-2">
            <User className="h-5 w-5" />
            <span>Profile Settings</span>
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            Manage your personal information and preferences
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Avatar */}
          <div className="flex items-center space-x-6">
            <div className="relative">
              <div className="h-20 w-20 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden">
                {avatarPreview || user?.avatar ? (
                  <img
                    src={avatarPreview || (user?.avatar?.startsWith('/') ? `${window.location.origin}${user?.avatar}` : user?.avatar)}
                    alt="Avatar"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <User className="h-8 w-8 text-gray-400" />
                )}
              </div>
              <label
                htmlFor="avatar-upload"
                className="absolute -bottom-1 -right-1 bg-blue-600 rounded-full p-1.5 cursor-pointer hover:bg-blue-700 transition-colors"
              >
                <Camera className="h-3 w-3 text-white" />
              </label>
              <input
                id="avatar-upload"
                type="file"
                accept="image/*"
                onChange={handleAvatarChange}
                className="hidden"
              />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">Profile Picture</p>
              <p className="text-xs text-gray-500">
                Upload a new profile picture (JPG, PNG up to 2MB)
              </p>
            </div>
          </div>

          {/* Basic Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <User className="h-4 w-4 inline mr-1" />
                Full Name
              </label>
              <input
                {...register('name', { required: 'Name is required' })}
                type="text"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {errors.name && (
                <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Mail className="h-4 w-4 inline mr-1" />
                Email Address
              </label>
              <input
                {...register('email')}
                type="email"
                readOnly
                className="w-full px-3 py-2 border border-gray-200 rounded-md bg-gray-50 text-gray-500 cursor-not-allowed"
              />
              <p className="text-gray-400 text-xs mt-1">Email cannot be changed from this form. Contact your administrator.</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Phone className="h-4 w-4 inline mr-1" />
                Phone Number
              </label>
              <input
                {...register('phone')}
                type="tel"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Clock className="h-4 w-4 inline mr-1" />
                Timezone
              </label>
              <select
                {...register('timezone')}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {timezones.map(tz => (
                  <option key={tz.value} value={tz.value}>
                    {tz.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Globe className="h-4 w-4 inline mr-1" />
                Language
              </label>
              <select
                {...register('language')}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {languages.map(lang => (
                  <option key={lang.value} value={lang.value}>
                    {lang.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Save Button */}
          <div className="flex justify-end pt-4 border-t border-gray-200">
            <Button
              type="submit"
              disabled={!isDirty || saveProfileMutation.isPending}
              className="flex items-center space-x-2"
            >
              {saveProfileMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              <span>Save Changes</span>
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default withErrorBoundary(ProfileSettings);
