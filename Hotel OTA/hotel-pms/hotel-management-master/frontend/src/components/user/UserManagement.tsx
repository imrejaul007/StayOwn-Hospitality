import React, { useState, useEffect } from 'react';
import {
  UserIcon,
  CreditCardIcon,
  PencilIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';
import { toast } from 'react-hot-toast';
import { api } from '../../services/api';
import UserProfileForm from './UserProfileForm';
import UserBillingForm from './UserBillingForm';

interface BillingDetails {
  gstNumber?: string;
  companyName?: string;
  billingAddress?: {
    street?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
  };
  panNumber?: string;
  billingContactPerson?: string;
  billingEmail?: string;
  billingPhone?: string;
}

interface User {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  role: string;
  guestType: string;
  billingDetails?: BillingDetails;
  hasCompleteBillingInfo?: boolean;
  formattedBillingAddress?: string;
}

interface UserManagementProps {
  userId: string;
  currentUser?: unknown; // From auth context
  onUserUpdate?: () => void;
}

const UserManagement: React.FC<UserManagementProps> = ({
  userId,
  currentUser,
  onUserUpdate
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [showProfileForm, setShowProfileForm] = useState(false);
  const [showBillingForm, setShowBillingForm] = useState(false);

  useEffect(() => {
    fetchUserDetails();
  }, [userId]);

  const fetchUserDetails = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/users/${userId}/profile`);
      setUser(response.data.data.user);
    } catch (error: unknown) {
      toast.error(error.response?.data?.message || 'Failed to fetch user details');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateSuccess = () => {
    fetchUserDetails();
    if (onUserUpdate) {
      onUserUpdate();
    }
  };

  const canEditProfile = () => {
    // Users can edit their own profile, staff/admin can edit guests and users in their hotel
    return currentUser?.role === 'guest'
      ? currentUser._id === userId
      : currentUser?.role === 'staff' || currentUser?.role === 'admin';
  };

  const canEditBilling = () => {
    // Only staff and admin can edit billing details for security and business compliance
    return currentUser?.role === 'staff' || currentUser?.role === 'admin';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="text-center p-8">
        <p className="text-gray-500">User not found</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* User Profile Section */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <UserIcon className="w-5 h-5 text-gray-400 mr-2" />
              <h3 className="text-lg font-medium text-gray-900">Profile Information</h3>
            </div>
            {canEditProfile() && (
              <button
                onClick={() => setShowProfileForm(true)}
                className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                <PencilIcon className="w-4 h-4 mr-1" />
                Edit Profile
              </button>
            )}
          </div>
        </div>
        <div className="px-6 py-4">
          <dl className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2">
            <div>
              <dt className="text-sm font-medium text-gray-500">Full Name</dt>
              <dd className="mt-1 text-sm text-gray-900">{user.name}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Email</dt>
              <dd className="mt-1 text-sm text-gray-900">{user.email}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Phone</dt>
              <dd className="mt-1 text-sm text-gray-900">{user.phone || 'Not provided'}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Guest Type</dt>
              <dd className="mt-1 text-sm text-gray-900">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  user.guestType === 'corporate'
                    ? 'bg-blue-100 text-blue-800'
                    : 'bg-gray-100 text-gray-800'
                }`}>
                  {user.guestType === 'corporate' ? 'Corporate' : 'Individual'}
                </span>
              </dd>
            </div>
          </dl>
        </div>
      </div>

      {/* Billing Information Section */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <CreditCardIcon className="w-5 h-5 text-gray-400 mr-2" />
              <h3 className="text-lg font-medium text-gray-900">Billing Information</h3>
              {user.hasCompleteBillingInfo && (
                <CheckCircleIcon className="w-5 h-5 text-green-500 ml-2" />
              )}
              {!user.hasCompleteBillingInfo && user.billingDetails?.gstNumber && (
                <ExclamationTriangleIcon className="w-5 h-5 text-yellow-500 ml-2" />
              )}
            </div>
            {canEditBilling() && (
              <button aria-label="Edit"
                onClick={() => setShowBillingForm(true)}
                className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                <PencilIcon className="w-4 h-4 mr-1" />
                {user.billingDetails?.gstNumber ? 'Edit Billing' : 'Add Billing Details'}
              </button>
            )}
          </div>
        </div>
        <div className="px-6 py-4">
          {!user.billingDetails?.gstNumber && !user.billingDetails?.companyName ? (
            <div className="text-center py-8">
              <CreditCardIcon className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">No billing information added yet</p>
              {canEditBilling() && (
                <button
                  onClick={() => setShowBillingForm(true)}
                  className="mt-2 text-sm text-blue-600 hover:text-blue-500"
                >
                  Add billing details
                </button>
              )}
            </div>
          ) : (
            <dl className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2">
              {user.billingDetails?.gstNumber && (
                <div>
                  <dt className="text-sm font-medium text-gray-500">GST Number</dt>
                  <dd className="mt-1 text-sm text-gray-900 font-mono">
                    {user.billingDetails.gstNumber}
                  </dd>
                </div>
              )}
              {user.billingDetails?.companyName && (
                <div>
                  <dt className="text-sm font-medium text-gray-500">Company Name</dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    {user.billingDetails.companyName}
                  </dd>
                </div>
              )}
              {user.billingDetails?.panNumber && (
                <div>
                  <dt className="text-sm font-medium text-gray-500">PAN Number</dt>
                  <dd className="mt-1 text-sm text-gray-900 font-mono">
                    {user.billingDetails.panNumber}
                  </dd>
                </div>
              )}
              {user.billingDetails?.billingContactPerson && (
                <div>
                  <dt className="text-sm font-medium text-gray-500">Contact Person</dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    {user.billingDetails.billingContactPerson}
                  </dd>
                </div>
              )}
              {user.billingDetails?.billingEmail && (
                <div>
                  <dt className="text-sm font-medium text-gray-500">Billing Email</dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    {user.billingDetails.billingEmail}
                  </dd>
                </div>
              )}
              {user.billingDetails?.billingPhone && (
                <div>
                  <dt className="text-sm font-medium text-gray-500">Billing Phone</dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    {user.billingDetails.billingPhone}
                  </dd>
                </div>
              )}
              {user.formattedBillingAddress && (
                <div className="sm:col-span-2">
                  <dt className="text-sm font-medium text-gray-500">Billing Address</dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    {user.formattedBillingAddress}
                  </dd>
                </div>
              )}
            </dl>
          )}

          {!user.hasCompleteBillingInfo && (user.billingDetails?.gstNumber || user.billingDetails?.companyName) && (
            <div className="mt-4 p-3 bg-yellow-50 rounded-md">
              <div className="flex">
                <ExclamationTriangleIcon className="w-5 h-5 text-yellow-400 mr-2" />
                <p className="text-sm text-yellow-700">
                  Billing information is incomplete. Please add GST number and company name for complete billing setup.
                </p>
              </div>
            </div>
          )}

          {currentUser?.role === 'guest' && (
            <div className="mt-4 p-3 bg-blue-50 rounded-md">
              <p className="text-sm text-blue-700">
                <strong>Note:</strong> Billing details can only be modified by hotel staff or administrators for security and compliance reasons.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Forms */}
      {showProfileForm && (
        <UserProfileForm
          user={user}
          onClose={() => setShowProfileForm(false)}
          onSuccess={handleUpdateSuccess}
        />
      )}

      {showBillingForm && (
        <UserBillingForm
          user={user}
          onClose={() => setShowBillingForm(false)}
          onSuccess={handleUpdateSuccess}
        />
      )}
    </div>
  );
};

export default UserManagement;