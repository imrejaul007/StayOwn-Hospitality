import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { useForm } from 'react-hook-form';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../hooks/useToast';
import { withErrorBoundary } from '../../components/ErrorBoundary';

interface PrivacyFormData {
  dataSharing: boolean;
  locationTracking: boolean;
  analyticsTracking: boolean;
}

interface DataDownloadRequest {
  requestDate: string;
  status: 'pending' | 'processing' | 'ready' | 'expired';
  downloadUrl?: string;
}

const PrivacySettings: React.FC = () => {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [dataDownloadRequest, setDataDownloadRequest] = useState<DataDownloadRequest | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  const { register, handleSubmit, setValue } = useForm<PrivacyFormData>();

  useEffect(() => {
    // Load existing privacy settings from user preferences
    const loadPrivacySettings = async () => {
      try {
        const { data } = await api.get('/user-preferences/guest');
        const privacy = data?.data?.guest?.privacy;
        if (privacy) {
          setValue('dataSharing', privacy.dataSharing ?? false);
          setValue('locationTracking', privacy.locationTracking ?? false);
          setValue('analyticsTracking', privacy.analyticsTracking ?? false);
        } else {
          setValue('dataSharing', false);
          setValue('locationTracking', false);
          setValue('analyticsTracking', false);
        }
      } catch {
        // Fall back to defaults if preferences not yet created
        setValue('dataSharing', false);
        setValue('locationTracking', false);
        setValue('analyticsTracking', false);
      }
    };

    loadPrivacySettings();

  }, [user, setValue]);

  const fetchDataDownloadRequest = async () => {
    try {
      // No persisted async export job currently; keep this nullable state clear.
      setDataDownloadRequest(null);
    } catch {
      // No existing data download request -- this is expected for new users
    }
  };

  const onSubmit = async (data: PrivacyFormData) => {
    setIsLoading(true);
    try {
      // Save privacy-related settings under the guest preferences privacy section
      const guestPreferences = {
        privacy: {
          dataSharing: data.dataSharing,
          locationTracking: data.locationTracking,
          analyticsTracking: data.analyticsTracking,
        },
      };

      await api.put('/user-preferences/guest', guestPreferences);

      showToast('Privacy settings updated successfully', 'success');
    } catch (error) {
      showToast('Failed to update privacy settings', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const requestDataDownload = async () => {
    try {
      // Export comprehensive personal data (GDPR Article 15)
      const [prefsResponse, profileResponse] = await Promise.all([
        api.get('/user-preferences/export'),
        api.get('/auth/profile')
      ]);

      const exportPayload = {
        exportDate: new Date().toISOString(),
        profile: profileResponse.data?.user || profileResponse.data,
        preferences: prefsResponse.data?.data || prefsResponse.data,
      };

      const blob = new Blob([JSON.stringify(exportPayload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `my-data-export-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);

      setDataDownloadRequest({
        requestDate: new Date().toISOString(),
        status: 'ready',
      });
      showToast('Data exported successfully', 'success');
    } catch (error) {
      showToast('Failed to export data. Please try again.', 'error');
    }
  };

  const deleteAccount = async () => {
    setShowDeleteModal(false);
    try {
      await api.post('/data-privacy/erasure-request', {
        reason: 'User requested account deletion',
        confirmation: true
      });
      showToast('Account deletion request submitted. Your data will be removed within 30 days as per our privacy policy.', 'success');
    } catch (error) {
      showToast('Failed to submit deletion request. Please contact support.', 'error');
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 bg-white rounded-lg shadow-sm">
      <div className="border-b border-gray-200 mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Privacy Settings</h1>
        <p className="text-gray-600">Control how your data is collected, used, and shared</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
        {/* Data Collection */}
        <div className="bg-blue-50 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <svg className="w-5 h-5 mr-2 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            Data Collection Preferences
          </h3>

          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <label className="text-sm font-medium text-gray-700">
                  Analytics & Usage Data
                </label>
                <p className="text-sm text-gray-500 mt-1">
                  Help improve our services by sharing anonymous usage statistics and analytics data.
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer ml-4">
                <input
                  type="checkbox"
                  {...register('analyticsTracking')}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex-1">
                <label className="text-sm font-medium text-gray-700">
                  Location Tracking
                </label>
                <p className="text-sm text-gray-500 mt-1">
                  Allow us to collect your location data to provide location-based services and recommendations.
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer ml-4">
                <input
                  type="checkbox"
                  {...register('locationTracking')}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex-1">
                <label className="text-sm font-medium text-gray-700">
                  Personalized Experience
                </label>
                <p className="text-sm text-gray-500 mt-1">
                  Personalization follows your analytics and location preferences above.
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer ml-4">
                <input
                  type="checkbox"
                  disabled
                  checked={false}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
          </div>
        </div>

        {/* Data Sharing */}
        <div className="bg-yellow-50 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <svg className="w-5 h-5 mr-2 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Data Sharing Preferences
          </h3>

          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <label className="text-sm font-medium text-gray-700">
                  Third-Party Data Sharing
                </label>
                <p className="text-sm text-gray-500 mt-1">
                  Third-party sharing is controlled by the core data-sharing toggle.
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer ml-4">
                <input
                  type="checkbox"
                  disabled
                  checked={false}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-yellow-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-yellow-600"></div>
              </label>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex-1">
                <label className="text-sm font-medium text-gray-700">
                  Marketing Communications
                </label>
                <p className="text-sm text-gray-500 mt-1">
                  Marketing consent is managed in your preferences settings.
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer ml-4">
                <input
                  type="checkbox"
                  disabled
                  checked={false}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-yellow-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-yellow-600"></div>
              </label>
            </div>
          </div>
        </div>

        {/* Profile Visibility */}
        <div className="bg-purple-50 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <svg className="w-5 h-5 mr-2 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            Profile Visibility
          </h3>

          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <label className="text-sm font-medium text-gray-700">
                  Public Profile Visibility
                </label>
                <p className="text-sm text-gray-500 mt-1">
                  Profile visibility controls are currently managed by hotel staff policy.
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer ml-4">
                <input
                  type="checkbox"
                  disabled
                  checked={false}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
              </label>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex-1">
                <label className="text-sm font-medium text-gray-700">
                  Booking History Visibility
                </label>
                <p className="text-sm text-gray-500 mt-1">
                  Booking history visibility follows role-based access controls.
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer ml-4">
                <input
                  type="checkbox"
                  disabled
                  checked={true}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
              </label>
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end space-x-4 pt-6 border-t">
          <button
            type="button"
            onClick={() => {
              setValue('analyticsTracking', false);
              setValue('locationTracking', false);
              setValue('dataSharing', false);
            }}
            className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
          >
            Reset to Defaults
          </button>
          <button aria-label="Save privacy settings"
            type="submit"
            disabled={isLoading}
            className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? 'Saving...' : 'Save Privacy Settings'}
          </button>
        </div>
      </form>

      {/* Data Management */}
      <div className="mt-12 border-t pt-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-6">Data Management</h2>

        <div className="space-y-6">
          {/* Download Data */}
          <div className="bg-green-50 rounded-lg p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-2 flex items-center">
              <svg className="w-5 h-5 mr-2 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Download Your Data
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              Request a copy of all personal data we have collected about you.
            </p>

            {dataDownloadRequest ? (
              <div className="bg-white rounded-md p-4 border">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-700">
                      Status: <span className="capitalize">{dataDownloadRequest.status}</span>
                    </p>
                    <p className="text-sm text-gray-500">
                      Requested: {new Date(dataDownloadRequest.requestDate).toLocaleDateString()}
                    </p>
                  </div>
                  {dataDownloadRequest.status === 'ready' && dataDownloadRequest.downloadUrl && (
                    <a
                      href={dataDownloadRequest.downloadUrl}
                      className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
                    >
                      Download
                    </a>
                  )}
                </div>
              </div>
            ) : (
              <button
                onClick={requestDataDownload}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
              >
                Request Data Download
              </button>
            )}
          </div>

          {/* Delete Account */}
          <div className="bg-red-50 rounded-lg p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-2 flex items-center">
              <svg className="w-5 h-5 mr-2 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Delete Account
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              Permanently delete your account and all associated data. This action cannot be undone.
            </p>
            <button
              onClick={() => setShowDeleteModal(true)}
              className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
            >
              Delete My Account
            </button>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Confirm Account Deletion</h3>
            <p className="text-sm text-gray-600 mb-4">
              Are you sure you want to delete your account? This action is permanent and cannot be undone.
              All your data, bookings, and preferences will be permanently removed.
            </p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Type <span className="font-bold">DELETE</span> to confirm:
              </label>
              <input
                type="text"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
                placeholder="Type DELETE here"
                autoComplete="off"
              />
            </div>
            <div className="flex space-x-4">
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setDeleteConfirmText('');
                }}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={deleteAccount}
                disabled={deleteConfirmText !== 'DELETE'}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Delete Account
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default withErrorBoundary(PrivacySettings);