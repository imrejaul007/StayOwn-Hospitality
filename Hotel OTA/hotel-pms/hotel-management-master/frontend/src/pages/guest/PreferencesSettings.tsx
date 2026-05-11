import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { useForm } from 'react-hook-form';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../hooks/useToast';
import { withErrorBoundary } from '../../components/ErrorBoundary';

interface StayPreferences {
  roomType: string;
  floor: string;
  bedType: string;
  smoking: boolean;
  dietaryRestrictions: string[];
}

interface CommunicationPreferences {
  preferredChannel: string;
  marketingConsent: boolean;
}

interface PreferencesFormData {
  stay: StayPreferences;
  communication: CommunicationPreferences;
  specialRequests: string;
}

const PreferencesSettings: React.FC = () => {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [dietaryOptions, setDietaryOptions] = useState<string[]>([]);

  const { register, handleSubmit, formState: { errors }, setValue, watch } = useForm<PreferencesFormData>();

  useEffect(() => {
    // Load existing preferences from user data or API
    if (user?.preferences) {
      setValue('stay.roomType', user.preferences.roomType || '');
      setValue('stay.floor', user.preferences.floor || '');
      setValue('stay.bedType', user.preferences.bedType || '');
      setValue('stay.smoking', user.preferences.smoking || false);
      setValue('communication.preferredChannel', user.preferences.preferredChannel || 'email');
      setValue('communication.marketingConsent', user.preferences.marketingConsent || false);
      if (user.preferences.dietaryRestrictions) {
        setDietaryOptions(user.preferences.dietaryRestrictions);
      }
    }
  }, [user, setValue]);

  const onSubmit = async (data: PreferencesFormData) => {
    setIsLoading(true);
    try {
      const guestPreferences = {
        stayPreferences: {
          roomType: data.stay.roomType,
          floor: data.stay.floor,
          bedType: data.stay.bedType,
          smoking: data.stay.smoking,
          dietaryRestrictions: dietaryOptions,
        },
        communication: {
          preferredChannel: data.communication.preferredChannel,
          marketingConsent: data.communication.marketingConsent,
        },
      };

      await api.put('/user-preferences/guest', guestPreferences);

      showToast('Preferences updated successfully', 'success');
    } catch (error) {
      showToast('Failed to update preferences', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleDietaryRestriction = (restriction: string) => {
    setDietaryOptions(prev =>
      prev.includes(restriction)
        ? prev.filter(item => item !== restriction)
        : [...prev, restriction]
    );
  };

  // Values must match backend Joi schema (lowercase)
  const availableDietaryRestrictions = [
    { value: 'vegetarian', label: 'Vegetarian' },
    { value: 'vegan', label: 'Vegan' },
    { value: 'gluten-free', label: 'Gluten-Free' },
    { value: 'dairy-free', label: 'Dairy-Free' },
    { value: 'halal', label: 'Halal' },
    { value: 'kosher', label: 'Kosher' },
  ];

  return (
    <div className="max-w-4xl mx-auto p-6 bg-white rounded-lg shadow-sm">
      <div className="border-b border-gray-200 mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Stay Preferences</h1>
        <p className="text-gray-600">Set your preferences for a personalized stay experience</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
        {/* Room Preferences */}
        <div className="bg-gray-50 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <svg className="w-5 h-5 mr-2 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z" />
            </svg>
            Room Preferences
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Preferred Room Type
              </label>
              <select
                {...register('stay.roomType')}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">No preference</option>
                <option value="Standard">Standard Room</option>
                <option value="Deluxe">Deluxe Room</option>
                <option value="Suite">Suite</option>
                <option value="Executive">Executive Room</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Preferred Floor
              </label>
              <select
                {...register('stay.floor')}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="Any">Any Floor</option>
                <option value="High">Higher Floors</option>
                <option value="Low">Lower Floors</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Bed Type
              </label>
              <select
                {...register('stay.bedType')}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">No preference</option>
                <option value="Single">Single Bed</option>
                <option value="Double">Double Bed</option>
                <option value="Twin">Twin Beds</option>
                <option value="King">King Bed</option>
              </select>
            </div>
          </div>

          <div className="mt-6">
            <div className="flex items-center">
              <input
                type="checkbox"
                {...register('stay.smoking')}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label className="ml-2 text-sm text-gray-700">
                Smoking room preferred
              </label>
            </div>
          </div>
        </div>

        {/* Dietary Restrictions */}
        <div className="bg-gray-50 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <svg className="w-5 h-5 mr-2 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
            Dietary Restrictions
          </h3>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {availableDietaryRestrictions.map((restriction) => (
              <label key={restriction.value} className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={dietaryOptions.includes(restriction.value)}
                  onChange={() => toggleDietaryRestriction(restriction.value)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <span className="text-sm text-gray-700">{restriction.label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Communication Preferences */}
        <div className="bg-gray-50 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <svg className="w-5 h-5 mr-2 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            Communication Preferences
          </h3>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Preferred Communication Channel
              </label>
              <select
                {...register('communication.preferredChannel')}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="email">Email</option>
                <option value="sms">SMS</option>
                <option value="whatsapp">WhatsApp</option>
                <option value="in_app">In-App Notifications</option>
              </select>
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                {...register('communication.marketingConsent')}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label className="ml-2 text-sm text-gray-700">
                I agree to receive marketing communications and special offers
              </label>
            </div>
          </div>
        </div>

        {/* Special Requests */}
        <div className="bg-gray-50 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <svg className="w-5 h-5 mr-2 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            Special Requests & Notes
          </h3>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Additional Requests
            </label>
            <textarea
              {...register('specialRequests')}
              rows={4}
              className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              placeholder="Please share any special requests, accessibility needs, or additional information that will help us provide you with the best possible stay..."
            />
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end space-x-4 pt-6 border-t">
          <button
            type="button"
            onClick={() => {
              setValue('stay.roomType', '');
              setValue('stay.floor', 'Any');
              setValue('stay.bedType', '');
              setValue('stay.smoking', false);
              setDietaryOptions([]);
              setValue('communication.preferredChannel', 'email');
              setValue('communication.marketingConsent', false);
              setValue('specialRequests', '');
            }}
            className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
          >
            Reset to Defaults
          </button>
          <button aria-label="Save preferences"
            type="submit"
            disabled={isLoading}
            className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? 'Saving...' : 'Save Preferences'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default withErrorBoundary(PreferencesSettings);