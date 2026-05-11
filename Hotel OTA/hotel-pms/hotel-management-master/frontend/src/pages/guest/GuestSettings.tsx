import React, { useState } from 'react';
import { api } from '../../services/api';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { useMutation } from '@tanstack/react-query';
import {
  User,
  Bell,
  Shield,
  Globe,
  Camera,
  Phone,
  Mail,
  Calendar,
  MapPin,
  Utensils,
  Bed,
  MessageSquare,
  Save,
  Loader2,
  ArrowLeft
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';
import { withErrorBoundary } from '../../components/ErrorBoundary';

const MAX_AVATAR_SIZE_MB = 2;
const MAX_AVATAR_SIZE_BYTES = MAX_AVATAR_SIZE_MB * 1024 * 1024;

interface GuestSettingsFormData {
  // Profile
  name: string;
  email: string;
  phone: string;
  avatar?: string;

  // Preferences
  roomType: string;
  floor: string;
  bedType: string;
  smoking: boolean;
  dietaryRestrictions: string[];

  // Notifications
  bookingUpdates: boolean;
  serviceAlerts: boolean;
  promotions: boolean;
  loyaltyUpdates: boolean;
  reviewRequests: boolean;

  // Communication
  language: string;
  preferredChannel: 'email' | 'sms' | 'whatsapp' | 'in_app';
  marketingConsent: boolean;

  // Privacy
  dataSharing: boolean;
  locationTracking: boolean;
  analyticsTracking: boolean;
}

function GuestSettings() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isDirty }
  } = useForm<GuestSettingsFormData>({
    defaultValues: {
      name: user?.name || '',
      email: user?.email || '',
      phone: user?.phone || '',
      avatar: user?.avatar || '',
      roomType: 'Deluxe',
      floor: 'Any',
      bedType: 'Double',
      smoking: false,
      dietaryRestrictions: [],
      bookingUpdates: true,
      serviceAlerts: true,
      promotions: true,
      loyaltyUpdates: true,
      reviewRequests: true,
      language: 'en',
      preferredChannel: 'email',
      marketingConsent: false,
      dataSharing: false,
      locationTracking: true,
      analyticsTracking: false
    }
  });

  const watchedValues = watch();

  // Save settings mutation
  const saveSettingsMutation = useMutation({
    mutationFn: async (data: GuestSettingsFormData) => {
      // Map form data to the backend's expected guest preferences structure
      const guestPreferences = {
        stayPreferences: {
          roomType: data.roomType,
          floor: data.floor,
          bedType: data.bedType,
          smoking: data.smoking,
          dietaryRestrictions: data.dietaryRestrictions,
        },
        communication: {
          preferredChannel: data.preferredChannel,
          marketingConsent: data.marketingConsent,
        },
        privacy: {
          dataSharing: data.dataSharing,
          locationTracking: data.locationTracking,
          analyticsTracking: data.analyticsTracking,
        },
      };

      // Save both profile and preferences
      const profileFields = { name: data.name?.trim(), phone: data.phone?.trim() };
      const hasProfileChanges = profileFields.name || profileFields.phone;

      const [prefsResult] = await Promise.all([
        // Save preferences
        api.put('/user-preferences/guest', guestPreferences),
        // Save profile fields (name, phone) if present
        ...(hasProfileChanges ? [api.patch('/auth/profile', profileFields)] : [])
      ]);
      return prefsResult.data;
    },
    onSuccess: () => {
      toast.success('Settings updated successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update settings');
    }
  });

  const onSubmit = (data: GuestSettingsFormData) => {
    saveSettingsMutation.mutate(data);
  };

  const handleAvatarChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Please upload a valid image file (JPEG, PNG, GIF, or WebP)');
      event.target.value = '';
      return;
    }

    // Validate file size
    if (file.size > MAX_AVATAR_SIZE_BYTES) {
      toast.error(`Image must be smaller than ${MAX_AVATAR_SIZE_MB}MB`);
      event.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setAvatarPreview(reader.result as string);
      setValue('avatar', reader.result as string, { shouldDirty: true });
    };
    reader.readAsDataURL(file);
  };

  const languages = [
    { value: 'en', label: 'English' },
    { value: 'es', label: 'Spanish' },
    { value: 'fr', label: 'French' },
    { value: 'hi', label: 'Hindi' }
  ];

  const countries = [
    { value: 'India', label: 'India' },
    { value: 'USA', label: 'United States' },
    { value: 'UK', label: 'United Kingdom' },
    { value: 'Canada', label: 'Canada' },
    { value: 'Australia', label: 'Australia' }
  ];

  const roomTypes = [
    { value: 'Standard', label: 'Standard Room' },
    { value: 'Deluxe', label: 'Deluxe Room' },
    { value: 'Suite', label: 'Suite' },
    { value: 'Executive', label: 'Executive Room' }
  ];

  const dietaryOptions = [
    { id: 'vegetarian', label: 'Vegetarian' },
    { id: 'vegan', label: 'Vegan' },
    { id: 'gluten-free', label: 'Gluten Free' },
    { id: 'dairy-free', label: 'Dairy Free' },
    { id: 'halal', label: 'Halal' },
    { id: 'kosher', label: 'Kosher' }
  ];

  const handleDietaryChange = (restriction: string) => {
    const current = watchedValues.dietaryRestrictions || [];
    const updated = current.includes(restriction)
      ? current.filter(r => r !== restriction)
      : [...current, restriction];
    setValue('dietaryRestrictions', updated, { shouldDirty: true });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between py-4">
            <div className="flex items-center space-x-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/app')}
                className="flex items-center space-x-2"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>Back</span>
              </Button>
              <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white shadow-sm rounded-lg">
          <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-8">
            {/* Profile Section */}
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center space-x-2">
                <User className="h-5 w-5" />
                <span>Profile Information</span>
              </h2>

              {/* Avatar */}
              <div className="flex items-center space-x-6 mb-6">
                <div className="relative">
                  <div className="h-20 w-20 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden">
                    {avatarPreview || user?.avatar ? (
                      <img
                        src={avatarPreview || user?.avatar}
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
                  <p className="text-xs text-gray-500">Upload a profile picture (max {MAX_AVATAR_SIZE_MB}MB, JPEG/PNG/GIF/WebP)</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <User className="h-4 w-4 inline mr-1" />
                    Full Name *
                  </label>
                  <input
                    {...register('name', {
                      required: 'Name is required',
                      minLength: { value: 2, message: 'Name must be at least 2 characters' },
                      maxLength: { value: 100, message: 'Name cannot exceed 100 characters' }
                    })}
                    type="text"
                    className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      errors.name ? 'border-red-300' : 'border-gray-300'
                    }`}
                  />
                  {errors.name && (
                    <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <Mail className="h-4 w-4 inline mr-1" />
                    Email
                  </label>
                  <input
                    {...register('email')}
                    type="email"
                    readOnly
                    disabled
                    className="w-full px-3 py-2 border border-gray-200 rounded-md bg-gray-50 text-gray-500 cursor-not-allowed"
                  />
                  <p className="text-xs text-gray-500 mt-1">Email cannot be changed. Contact support if you need to update it.</p>
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
                    placeholder="+1 234 567 8900"
                  />
                  {errors.phone && (
                    <p className="mt-1 text-sm text-red-600">{errors.phone.message}</p>
                  )}
                </div>

                {/* Date of birth and nationality editing not supported by the backend */}
              </div>
            </div>

            {/* Stay Preferences */}
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center space-x-2">
                <Bed className="h-5 w-5" />
                <span>Stay Preferences</span>
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Room Type
                  </label>
                  <select
                    {...register('roomType')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {roomTypes.map(type => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Floor Preference
                  </label>
                  <select
                    {...register('floor')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="Any">Any Floor</option>
                    <option value="High">High Floor</option>
                    <option value="Low">Low Floor</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Bed Type
                  </label>
                  <select
                    {...register('bedType')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="Single">Single</option>
                    <option value="Double">Double</option>
                    <option value="Twin">Twin</option>
                    <option value="King">King</option>
                  </select>
                </div>
              </div>

              <div className="mt-4">
                <label className="flex items-center space-x-3">
                  <input
                    {...register('smoking')}
                    type="checkbox"
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium text-gray-900">Smoking Room</span>
                </label>
              </div>

              <div className="mt-6">
                <h3 className="text-sm font-medium text-gray-900 mb-3 flex items-center space-x-2">
                  <Utensils className="h-4 w-4" />
                  <span>Dietary Restrictions</span>
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {dietaryOptions.map(option => (
                    <label key={option.id} className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={(watchedValues.dietaryRestrictions || []).includes(option.id)}
                        onChange={() => handleDietaryChange(option.id)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700">{option.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            {/* Notifications */}
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center space-x-2">
                <Bell className="h-5 w-5" />
                <span>Notifications</span>
              </h2>
              <div className="space-y-3">
                <label className="flex items-center space-x-3">
                  <input
                    {...register('bookingUpdates')}
                    type="checkbox"
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-900">Booking updates and confirmations</span>
                </label>
                <label className="flex items-center space-x-3">
                  <input
                    {...register('serviceAlerts')}
                    type="checkbox"
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-900">Service alerts and room status</span>
                </label>
                <label className="flex items-center space-x-3">
                  <input
                    {...register('promotions')}
                    type="checkbox"
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-900">Promotions and special offers</span>
                </label>
                <label className="flex items-center space-x-3">
                  <input
                    {...register('loyaltyUpdates')}
                    type="checkbox"
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-900">Loyalty program updates</span>
                </label>
              </div>
            </div>

            {/* Communication Preferences */}
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center space-x-2">
                <MessageSquare className="h-5 w-5" />
                <span>Communication</span>
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Preferred Contact Method
                  </label>
                  <select
                    {...register('preferredChannel')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="email">Email</option>
                    <option value="sms">SMS</option>
                    <option value="whatsapp">WhatsApp</option>
                    <option value="in_app">In-App Only</option>
                  </select>
                </div>
              </div>

              <div className="mt-4">
                <label className="flex items-center space-x-3">
                  <input
                    {...register('marketingConsent')}
                    type="checkbox"
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-900">I agree to receive marketing communications</span>
                </label>
              </div>
            </div>

            {/* Privacy Settings */}
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center space-x-2">
                <Shield className="h-5 w-5" />
                <span>Privacy</span>
              </h2>
              <div className="space-y-3">
                <label className="flex items-center space-x-3">
                  <input
                    {...register('dataSharing')}
                    type="checkbox"
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-900">Share data with partner hotels for better service</span>
                </label>
                <label className="flex items-center space-x-3">
                  <input
                    {...register('locationTracking')}
                    type="checkbox"
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-900">Enable location tracking for personalized experiences</span>
                </label>
                <label className="flex items-center space-x-3">
                  <input
                    {...register('analyticsTracking')}
                    type="checkbox"
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-900">Allow analytics tracking to improve our services</span>
                </label>
              </div>
            </div>

            {/* Save Button */}
            <div className="flex justify-end pt-4 border-t border-gray-200">
              <Button
                type="submit"
                disabled={!isDirty || saveSettingsMutation.isPending}
                className="flex items-center space-x-2"
              >
                {saveSettingsMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                <span>Save Settings</span>
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default withErrorBoundary(GuestSettings);
