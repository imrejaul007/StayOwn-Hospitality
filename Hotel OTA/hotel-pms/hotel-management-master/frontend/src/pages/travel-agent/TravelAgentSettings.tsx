import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../hooks/useToast';
import { travelAgentService } from '../../services/travelAgentService';
import { withErrorBoundary } from '../../components/ErrorBoundary';

interface BookingPreferences {
  autoConfirm: boolean;
  defaultCommission: number;
  preferredRoomTypes: string[];
  paymentTerms: string;
  minimumStayRequirement: number;
  blackoutDates: string[];
}

interface BusinessInfo {
  companyName: string;
  licenseNumber: string;
  taxId: string;
  address: string;
  website: string;
  description: string;
  businessType: string;
}

interface NotificationSettings {
  commissionUpdates: boolean;
  rateChanges: boolean;
  bookingConfirmations: boolean;
  cancellationAlerts: boolean;
  paymentNotifications: boolean;
  promotionalOffers: boolean;
  systemMaintenance: boolean;
}

interface TravelAgentFormData {
  profile: {
    name: string;
    email: string;
    phone: string;
    language: string;
    timezone: string;
  };
  businessInfo: BusinessInfo;
  bookingPreferences: BookingPreferences;
  notifications: NotificationSettings;
  communicationChannel: string;
}

const TravelAgentSettings: React.FC = () => {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('profile');
  const [selectedRoomTypes, setSelectedRoomTypes] = useState<string[]>([]);

  const { register, handleSubmit, formState: { errors }, setValue, watch } = useForm<TravelAgentFormData>();

  useEffect(() => {
    const loadSettings = async () => {
      if (!user) return;

      setValue('profile.name', user.name || '');
      setValue('profile.email', user.email || '');
      setValue('profile.phone', user.phone || '');
      setValue('profile.language', 'en');
      setValue('profile.timezone', 'UTC');

      try {
        const profile = await travelAgentService.getMyTravelAgentProfile();
        setValue('businessInfo.companyName', profile.companyName || '');
        setValue('businessInfo.licenseNumber', profile.businessDetails?.licenseNumber || '');
        setValue('businessInfo.taxId', profile.businessDetails?.gstNumber || '');
        setValue(
          'businessInfo.address',
          [profile.address?.street, profile.address?.city, profile.address?.state, profile.address?.country]
            .filter(Boolean)
            .join(', ')
        );
        setValue('businessInfo.businessType', profile.businessDetails?.businessType || '');
        setValue('bookingPreferences.defaultCommission', profile.commissionStructure?.defaultRate || 10);
        setValue(
          'bookingPreferences.paymentTerms',
          profile.paymentTerms?.preferredPaymentMethod === 'bank_transfer' ? 'net_30' : 'immediate'
        );
      } catch {
        // Keep auth defaults if profile fetch fails.
      }
    };

    loadSettings();
  }, [user, setValue]);

  const onSubmit = async (data: TravelAgentFormData) => {
    setIsLoading(true);
    try {
      await travelAgentService.updateAgentProfile({
        companyName: data.businessInfo.companyName || data.profile.name,
        contactPerson: data.profile.name,
        email: data.profile.email,
        phone: data.profile.phone,
        businessDetails: {
          licenseNumber: data.businessInfo.licenseNumber,
          gstNumber: data.businessInfo.taxId,
          businessType: (data.businessInfo.businessType as 'domestic' | 'international' | 'both') || 'domestic'
        },
        notes: [
          data.businessInfo.description?.trim(),
          data.businessInfo.website?.trim() ? `Website: ${data.businessInfo.website.trim()}` : '',
          selectedRoomTypes.length ? `Preferred room types: ${selectedRoomTypes.join(', ')}` : '',
          data.communicationChannel ? `Preferred channel: ${data.communicationChannel}` : ''
        ]
          .filter(Boolean)
          .join('\n')
      });

      showToast('Settings updated successfully', 'success');
    } catch (error) {
      showToast('Failed to update settings', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleRoomType = (roomType: string) => {
    setSelectedRoomTypes(prev =>
      prev.includes(roomType)
        ? prev.filter(type => type !== roomType)
        : [...prev, roomType]
    );
  };

  const availableRoomTypes = [
    'Standard', 'Deluxe', 'Suite', 'Executive', 'Presidential',
    'Family', 'Connecting', 'Accessible', 'Ocean View', 'City View'
  ];

  const tabs = [
    { id: 'profile', name: 'Profile', icon: '👤' },
    { id: 'business', name: 'Business Info', icon: '🏢' },
    { id: 'preferences', name: 'Booking Preferences', icon: '⚙️' },
    { id: 'notifications', name: 'Notifications', icon: '🔔' }
  ];

  return (
    <div className="max-w-6xl mx-auto p-6 bg-white rounded-lg shadow-sm">
      <div className="border-b border-gray-200 mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Travel Agent Settings</h1>
        <p className="text-gray-600">Manage your travel agency profile, booking preferences, and business settings</p>
      </div>

      {/* Tab Navigation */}
      <div className="flex space-x-1 mb-6">
        {tabs.map((tab) => (
          <button
            aria-label={tab.name}
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-md font-medium transition-colors flex items-center space-x-2 ${
              activeTab === tab.id
                ? 'bg-blue-100 text-blue-700'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <span>{tab.icon}</span>
            <span>{tab.name}</span>
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {activeTab === 'profile' && (
          <div className="space-y-6">
            <div className="bg-blue-50 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Personal Information</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    {...register('profile.name', { required: 'Name is required' })}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                  {errors.profile?.name && (
                    <p className="mt-1 text-sm text-red-600">{errors.profile.name.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email Address *
                  </label>
                  <input
                    type="email"
                    {...register('profile.email', {
                      required: 'Email is required',
                      pattern: {
                        value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                        message: 'Invalid email address'
                      }
                    })}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                  {errors.profile?.email && (
                    <p className="mt-1 text-sm text-red-600">{errors.profile.email.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    {...register('profile.phone')}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Language
                  </label>
                  <select
                    {...register('profile.language')}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="en">English</option>
                    <option value="es">Español</option>
                    <option value="fr">Français</option>
                    <option value="de">Deutsch</option>
                    <option value="it">Italiano</option>
                    <option value="pt">Português</option>
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Timezone
                  </label>
                  <select
                    {...register('profile.timezone')}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="UTC">UTC (GMT+0)</option>
                    <option value="America/New_York">Eastern Time (GMT-5)</option>
                    <option value="America/Chicago">Central Time (GMT-6)</option>
                    <option value="America/Los_Angeles">Pacific Time (GMT-8)</option>
                    <option value="Europe/London">London (GMT+0)</option>
                    <option value="Europe/Paris">Paris (GMT+1)</option>
                    <option value="Asia/Tokyo">Tokyo (GMT+9)</option>
                    <option value="Asia/Singapore">Singapore (GMT+8)</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'business' && (
          <div className="space-y-6">
            <div className="bg-green-50 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Business Information</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Company Name *
                  </label>
                  <input
                    type="text"
                    {...register('businessInfo.companyName', { required: 'Company name is required' })}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                  {errors.businessInfo?.companyName && (
                    <p className="mt-1 text-sm text-red-600">{errors.businessInfo.companyName.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Business Type
                  </label>
                  <select
                    {...register('businessInfo.businessType')}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Select business type</option>
                    <option value="travel_agency">Travel Agency</option>
                    <option value="tour_operator">Tour Operator</option>
                    <option value="corporate_travel">Corporate Travel Management</option>
                    <option value="online_platform">Online Travel Platform</option>
                    <option value="consultant">Travel Consultant</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    License Number
                  </label>
                  <input
                    type="text"
                    {...register('businessInfo.licenseNumber')}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Tax ID
                  </label>
                  <input
                    type="text"
                    {...register('businessInfo.taxId')}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Website
                  </label>
                  <input
                    type="url"
                    {...register('businessInfo.website')}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    placeholder="https://www.example.com"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Business Address
                  </label>
                  <textarea
                    {...register('businessInfo.address')}
                    rows={3}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Business Description
                  </label>
                  <textarea
                    {...register('businessInfo.description')}
                    rows={4}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Describe your travel agency, services, and specializations..."
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'preferences' && (
          <div className="space-y-6">
            <div className="bg-purple-50 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Booking Preferences</h3>

              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Default Commission (%)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="50"
                      step="0.5"
                      {...register('bookingPreferences.defaultCommission', {
                        valueAsNumber: true,
                        min: { value: 0, message: 'Minimum commission is 0%' },
                        max: { value: 50, message: 'Maximum commission is 50%' }
                      })}
                      className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Payment Terms
                    </label>
                    <select
                      {...register('bookingPreferences.paymentTerms')}
                      className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="immediate">Immediate Payment</option>
                      <option value="net_15">Net 15 Days</option>
                      <option value="net_30">Net 30 Days</option>
                      <option value="monthly">Monthly Billing</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Minimum Stay Requirement
                    </label>
                    <input
                      type="number"
                      min="1"
                      {...register('bookingPreferences.minimumStayRequirement', {
                        valueAsNumber: true,
                        min: { value: 1, message: 'Minimum stay must be at least 1 night' }
                      })}
                      className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center space-x-3 mb-4">
                    <input
                      type="checkbox"
                      {...register('bookingPreferences.autoConfirm')}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <label className="text-sm font-medium text-gray-700">
                      Auto-confirm bookings within commission range
                    </label>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    Preferred Room Types
                  </label>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    {availableRoomTypes.map((roomType) => (
                      <label key={roomType} className="flex items-center space-x-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedRoomTypes.includes(roomType)}
                          onChange={() => toggleRoomType(roomType)}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <span className="text-sm text-gray-700">{roomType}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'notifications' && (
          <div className="space-y-6">
            <div className="bg-yellow-50 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Notification Preferences</h3>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-sm font-medium text-gray-700">
                      Commission Updates
                    </label>
                    <p className="text-sm text-gray-500">Get notified about commission changes and payouts</p>
                  </div>
                  <input
                    type="checkbox"
                    {...register('notifications.commissionUpdates')}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-sm font-medium text-gray-700">
                      Rate Changes
                    </label>
                    <p className="text-sm text-gray-500">Receive alerts when room rates or availability changes</p>
                  </div>
                  <input
                    type="checkbox"
                    {...register('notifications.rateChanges')}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-sm font-medium text-gray-700">
                      Booking Confirmations
                    </label>
                    <p className="text-sm text-gray-500">Get instant notifications for new bookings and confirmations</p>
                  </div>
                  <input
                    type="checkbox"
                    {...register('notifications.bookingConfirmations')}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-sm font-medium text-gray-700">
                      Cancellation Alerts
                    </label>
                    <p className="text-sm text-gray-500">Be notified immediately about booking cancellations</p>
                  </div>
                  <input
                    type="checkbox"
                    {...register('notifications.cancellationAlerts')}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-sm font-medium text-gray-700">
                      Payment Notifications
                    </label>
                    <p className="text-sm text-gray-500">Receive updates about payment processing and issues</p>
                  </div>
                  <input
                    type="checkbox"
                    {...register('notifications.paymentNotifications')}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-sm font-medium text-gray-700">
                      Promotional Offers
                    </label>
                    <p className="text-sm text-gray-500">Get notified about special deals and promotional rates</p>
                  </div>
                  <input
                    type="checkbox"
                    {...register('notifications.promotionalOffers')}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-sm font-medium text-gray-700">
                      System Maintenance
                    </label>
                    <p className="text-sm text-gray-500">Receive advance notice of scheduled system maintenance</p>
                  </div>
                  <input
                    type="checkbox"
                    {...register('notifications.systemMaintenance')}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                </div>
              </div>

              <div className="mt-6 pt-6 border-t">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Preferred Communication Channel
                </label>
                <select
                  {...register('communicationChannel')}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="email">Email</option>
                  <option value="sms">SMS</option>
                  <option value="in_app">In-App Notifications</option>
                  <option value="whatsapp">WhatsApp Business</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Save Button */}
        <div className="flex justify-end space-x-4 pt-6 border-t">
          <button
            type="button"
            onClick={() => {
              setValue('bookingPreferences.autoConfirm', false);
              setValue('bookingPreferences.defaultCommission', 10);
              setValue('bookingPreferences.paymentTerms', 'immediate');
              setValue('bookingPreferences.minimumStayRequirement', 1);
              setSelectedRoomTypes([]);
              setValue('notifications.commissionUpdates', true);
              setValue('notifications.rateChanges', true);
              setValue('notifications.bookingConfirmations', true);
              setValue('notifications.cancellationAlerts', true);
              setValue('notifications.paymentNotifications', true);
              setValue('notifications.promotionalOffers', false);
              setValue('notifications.systemMaintenance', true);
              setValue('communicationChannel', 'email');
            }}
            className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
          >
            Reset to Defaults
          </button>
          <button aria-label="Save settings"
            type="submit"
            disabled={isLoading}
            className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default withErrorBoundary(TravelAgentSettings);