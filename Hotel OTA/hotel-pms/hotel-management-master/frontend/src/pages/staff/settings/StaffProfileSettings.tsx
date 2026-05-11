import React, { useState, useEffect } from 'react';
import { api } from '../../../services/api';
import { useForm } from 'react-hook-form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  User,
  Camera,
  Save,
  Loader2,
  Phone,
  Mail,
  Badge,
  Building
} from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { useAuth } from '../../../context/AuthContext';
import toast from 'react-hot-toast';
import { withErrorBoundary } from '../../../components/ErrorBoundary';

interface StaffProfileFormData {
  name: string;
  email: string;
  phone: string;
  department: string;
  employeeId: string;
  avatar?: string;
}

interface StaffProfileSettingsProps {
  onSettingsChange?: (hasChanges: boolean) => void;
}

function StaffProfileSettings({ onSettingsChange }: StaffProfileSettingsProps = {}) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isDirty }
  } = useForm<StaffProfileFormData>({
    defaultValues: {
      name: user?.name || '',
      email: user?.email || '',
      phone: user?.phone || '',
      department: user?.department || 'Housekeeping',
      employeeId: user?.employeeId || '',
      avatar: user?.avatar || ''
    }
  });

  useEffect(() => {
    const loadProfileData = async () => {
      try {
        const [{ data: authData }, { data: staffData }, { data: profilePrefsData }] = await Promise.all([
          api.get('/auth/me'),
          api.get('/user-preferences/staff'),
          api.get('/user-preferences/profile')
        ]);

        const currentUser = authData?.user;
        const staffPrefs = staffData?.data?.staff || {};
        const profilePrefs = profilePrefsData?.data?.profile || {};

        setValue('name', currentUser?.name || user?.name || '', { shouldDirty: false });
        setValue('email', currentUser?.email || user?.email || '', { shouldDirty: false });
        setValue('phone', currentUser?.phone || user?.phone || '', { shouldDirty: false });
        setValue('department', staffPrefs.department || user?.department || 'Housekeeping', { shouldDirty: false });
        setValue('employeeId', staffPrefs.employeeId || user?.employeeId || '', { shouldDirty: false });
        setValue('avatar', profilePrefs.avatar || user?.avatar || '', { shouldDirty: false });
      } catch {
        // Fallback to AuthContext default values
      }
    };

    loadProfileData();
  }, [setValue, user]);

  // Watch for form changes
  useEffect(() => {
    if (onSettingsChange) {
      onSettingsChange(isDirty);
    }
  }, [isDirty, onSettingsChange]);

  // Departments list
  const departments = [
    { value: 'Housekeeping', label: 'Housekeeping' },
    { value: 'Maintenance', label: 'Maintenance' },
    { value: 'Front Desk', label: 'Front Desk' },
    { value: 'Guest Services', label: 'Guest Services' },
    { value: 'Kitchen', label: 'Kitchen' },
    { value: 'Security', label: 'Security' },
    { value: 'Management', label: 'Management' }
  ];

  // Save profile mutation
  const saveProfileMutation = useMutation({
    mutationFn: async (data: StaffProfileFormData) => {
      const profileResponse = await api.patch('/auth/profile', {
        name: data.name,
        phone: data.phone
      });
      await api.put('/user-preferences/staff', {
        department: data.department,
        employeeId: data.employeeId
      });
      await api.put('/user-preferences/profile', {
        avatar: data.avatar || ''
      });
      return { profileData: profileResponse.data, formData: data };
    },
    onSuccess: ({ formData }) => {
      // Reset form with saved values so isDirty returns to false
      reset(formData);
      // Clear avatar preview now that the value is persisted in form state
      setAvatarPreview(null);
      // Invalidate the auth query so the header/context reflects updated name/avatar
      queryClient.invalidateQueries({ queryKey: ['authMe'] });
      toast.success('Profile updated successfully');
      if (onSettingsChange) {
        onSettingsChange(false);
      }
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update profile');
    }
  });

  const onSubmit = (data: StaffProfileFormData) => {
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

        // Update localStorage immediately
        const storedUser = localStorage.getItem('user');
        if (storedUser) {
          try {
            const parsedUser = JSON.parse(storedUser);
            const updatedUser = { ...parsedUser, avatar: data.data.avatarUrl };
            localStorage.setItem('user', JSON.stringify(updatedUser));
          } catch {
            // Error handled silently
          }
        }

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
            <span>Staff Profile</span>
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            Manage your personal information and work details
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Avatar */}
          <div className="flex items-center space-x-6">
            <div className="relative">
              <div className="h-20 w-20 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden">
                {(() => {
                  const savedAvatar = watch('avatar');
                  const displaySrc = avatarPreview || savedAvatar || user?.avatar;
                  if (displaySrc) {
                    const src = displaySrc.startsWith('/')
                      ? `${window.location.origin}${displaySrc}`
                      : displaySrc;
                    return <img src={src} alt="Avatar" className="h-full w-full object-cover" />;
                  }
                  return <User className="h-8 w-8 text-gray-400" />;
                })()}
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

          {/* Personal Information */}
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
                {...register('email', {
                  required: 'Email is required',
                  pattern: {
                    value: /^\S+@\S+$/i,
                    message: 'Invalid email format'
                  }
                })}
                type="email"
                disabled
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {errors.email && (
                <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>
              )}
              <p className="text-xs text-gray-500 mt-1">Email updates are managed by administrators.</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Phone className="h-4 w-4 inline mr-1" />
                Phone Number
              </label>
              <input
                {...register('phone', {
                  pattern: {
                    value: /^\+?[\d\s\-()]{7,20}$/,
                    message: 'Please enter a valid phone number'
                  }
                })}
                type="tel"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {errors.phone && (
                <p className="text-red-500 text-xs mt-1">{errors.phone.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Badge className="h-4 w-4 inline mr-1" />
                Employee ID
              </label>
              <input
                {...register('employeeId', { required: 'Employee ID is required' })}
                type="text"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {errors.employeeId && (
                <p className="text-red-500 text-xs mt-1">{errors.employeeId.message}</p>
              )}
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Building className="h-4 w-4 inline mr-1" />
                Department
              </label>
              <select
                {...register('department', { required: 'Department is required' })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {departments.map(dept => (
                  <option key={dept.value} value={dept.value}>
                    {dept.label}
                  </option>
                ))}
              </select>
              {errors.department && (
                <p className="text-red-500 text-xs mt-1">{errors.department.message}</p>
              )}
            </div>
          </div>

          {/* Work Information */}
          <div>
            <h3 className="text-md font-medium text-gray-900 mb-4">Work Information</h3>
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium text-gray-700">Role:</span>
                  <span className="ml-2 text-gray-900 capitalize">{user?.role}</span>
                </div>
                <div>
                  <span className="font-medium text-gray-700">Hotel:</span>
                  <span className="ml-2 text-gray-900">{user?.hotelName || 'THE PENTOUZ Hotel'}</span>
                </div>
                <div>
                  <span className="font-medium text-gray-700">Join Date:</span>
                  <span className="ml-2 text-gray-900">
                    {user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A'}
                  </span>
                </div>
                <div>
                  <span className="font-medium text-gray-700">Status:</span>
                  <span className="ml-2">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      user?.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {user?.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </span>
                </div>
              </div>
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

export default withErrorBoundary(StaffProfileSettings);
