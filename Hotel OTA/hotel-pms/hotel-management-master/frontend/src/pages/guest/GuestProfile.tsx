import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { userService } from '../../services/userService';
import {
  User,
  Mail,
  Phone,
  Lock,
  Bed,
  Building,
  Save,
  Edit3,
  X,
  CheckCircle,
  AlertCircle,
  Eye,
  EyeOff
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import toast from 'react-hot-toast';
import { withErrorBoundary } from '../../components/ErrorBoundary';

interface ProfileFormData {
  name: string;
  phone: string;
  preferences: {
    bedType: string;
    floor: string;
    smokingAllowed: boolean;
    other: string;
  };
}

interface PasswordFormData {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

interface FormErrors {
  name?: string;
  phone?: string;
}

const PHONE_REGEX = /^\+?[\d\s\-()]{7,20}$/;

const formatPreference = (value?: string) => {
  if (!value) return 'Not specified';
  return value.charAt(0).toUpperCase() + value.slice(1);
};

const formatMemberSince = (date?: string) => {
  if (!date) return 'N/A';
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return 'N/A';
  return parsed.toLocaleDateString('en-GB');
};

function GuestProfile() {
  const { user, updateUser, isLoading: authLoading } = useAuth();
  const [saving, setSaving] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [editing, setEditing] = useState(false);
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);

  const [profileData, setProfileData] = useState<ProfileFormData>({
    name: '',
    phone: '',
    preferences: {
      bedType: '',
      floor: '',
      smokingAllowed: false,
      other: ''
    }
  });

  const [passwordData, setPasswordData] = useState<PasswordFormData>({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  useEffect(() => {
    if (user) {
      setProfileData({
        name: user.name || '',
        phone: user.phone || '',
        preferences: {
          bedType: user.preferences?.bedType || '',
          floor: user.preferences?.floor || '',
          smokingAllowed: user.preferences?.smokingAllowed || false,
          other: user.preferences?.other || ''
        }
      });
    }
  }, [user]);

  const handleProfileChange = (field: string, value: unknown) => {
    if (field.includes('.')) {
      const [parent, child] = field.split('.');
      setProfileData(prev => ({
        ...prev,
        [parent]: {
          ...(prev[parent as keyof ProfileFormData] as Record<string, unknown>),
          [child]: value
        }
      }));
    } else {
      setProfileData(prev => ({
        ...prev,
        [field]: value
      }));
    }
  };

  const handlePasswordFieldChange = (field: keyof PasswordFormData, value: string) => {
    setPasswordData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const validateProfileForm = (): boolean => {
    const errors: FormErrors = {};

    if (!profileData.name.trim()) {
      errors.name = 'Name is required';
    } else if (profileData.name.trim().length < 2) {
      errors.name = 'Name must be at least 2 characters';
    } else if (profileData.name.trim().length > 100) {
      errors.name = 'Name cannot exceed 100 characters';
    }

    if (profileData.phone && !PHONE_REGEX.test(profileData.phone)) {
      errors.phone = 'Please enter a valid phone number';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleProfileSave = async () => {
    if (saving) return; // Prevent double-submit

    if (!validateProfileForm()) {
      return;
    }

    try {
      setSaving(true);
      const response = await userService.updateProfile({
        name: profileData.name.trim(),
        phone: profileData.phone.trim(),
        preferences: profileData.preferences
      });

      updateUser(response.user);
      setEditing(false);
      setFormErrors({});
      toast.success('Profile updated successfully');
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err?.response?.data?.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordChange = async () => {
    if (changingPassword) return; // Prevent double-submit

    if (!passwordData.currentPassword) {
      toast.error('Current password is required');
      return;
    }

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }

    if (passwordData.newPassword.length < 8) {
      toast.error('New password must be at least 8 characters');
      return;
    }

    if (!/[A-Z]/.test(passwordData.newPassword)) {
      toast.error('New password must contain at least one uppercase letter');
      return;
    }

    if (!/[0-9]/.test(passwordData.newPassword)) {
      toast.error('New password must contain at least one number');
      return;
    }

    if (!/[!@#$%^&*(),.?":{}|<>]/.test(passwordData.newPassword)) {
      toast.error('New password must contain at least one special character');
      return;
    }

    try {
      setChangingPassword(true);
      await userService.changePassword({
        currentPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword
      });

      setPasswordData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      });
      setShowPasswordForm(false);
      toast.success('Password changed successfully');
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err?.response?.data?.message || 'Failed to change password');
    } finally {
      setChangingPassword(false);
    }
  };

  const getLoyaltyTierColor = (tier: string) => {
    switch (tier?.toLowerCase()) {
      case 'platinum': return 'text-purple-600 bg-purple-100';
      case 'gold': return 'text-yellow-600 bg-yellow-100';
      case 'silver': return 'text-gray-600 bg-gray-100';
      default: return 'text-orange-600 bg-orange-100';
    }
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <Card className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Unable to load profile</h2>
          <p className="text-sm text-gray-600 mb-4">
            Your session may have expired. Please sign in again and retry.
          </p>
          <Button onClick={() => window.location.assign('/login')}>Go to login</Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold tracking-tight text-gray-900">My Profile</h1>
        <p className="text-gray-600">Manage your personal information and preferences</p>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.75fr)_320px]">
        {/* Profile Information */}
        <div>
          <Card className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-900">Personal Information</h2>
              {!editing ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setEditing(true)}
                  className="text-gray-600 hover:text-gray-900"
                >
                  <Edit3 className="w-4 h-4 mr-2" />
                  Edit
                </Button>
              ) : (
                <div className="flex space-x-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setEditing(false);
                      // Reset form data
                      if (user) {
                        setProfileData({
                          name: user.name || '',
                          phone: user.phone || '',
                          preferences: {
                            bedType: user.preferences?.bedType || '',
                            floor: user.preferences?.floor || '',
                            smokingAllowed: user.preferences?.smokingAllowed || false,
                            other: user.preferences?.other || ''
                          }
                        });
                      }
                    }}
                  >
                    <X className="w-4 h-4 mr-2" />
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={handleProfileSave}
                    loading={saving}
                  >
                    <Save className="w-4 h-4 mr-2" />
                    Save
                  </Button>
                </div>
              )}
            </div>

            <div className="space-y-5">
              {/* Name */}
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Full Name *
                </label>
                {editing ? (
                  <div>
                    <input
                      type="text"
                      value={profileData.name}
                      onChange={(e) => {
                        handleProfileChange('name', e.target.value);
                        if (formErrors.name) setFormErrors(prev => ({ ...prev, name: undefined }));
                      }}
                      className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                        formErrors.name ? 'border-red-300' : 'border-gray-300'
                      }`}
                      placeholder="Enter your full name"
                      maxLength={100}
                    />
                    {formErrors.name && (
                      <p className="mt-1 text-sm text-red-600">{formErrors.name}</p>
                    )}
                  </div>
                ) : (
                  <div className="flex min-h-12 items-center gap-3 rounded-xl bg-gray-50 px-4 py-3 text-sm text-gray-900">
                    <User className="h-4 w-4 text-gray-400" />
                    <span className="text-gray-900">{user?.name || 'Not provided'}</span>
                  </div>
                )}
              </div>

              {/* Email */}
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Email Address
                </label>
                <div className="flex min-h-12 items-center gap-3 rounded-xl bg-gray-50 px-4 py-3 text-sm text-gray-900">
                  <Mail className="h-4 w-4 text-gray-400" />
                  <span className="text-gray-900">{user?.email || 'Not provided'}</span>
                </div>
                <p className="text-xs text-gray-500 mt-1">Email cannot be changed</p>
              </div>

              {/* Phone */}
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Phone Number
                </label>
                {editing ? (
                  <div>
                    <input
                      type="tel"
                      value={profileData.phone}
                      onChange={(e) => {
                        handleProfileChange('phone', e.target.value);
                        if (formErrors.phone) setFormErrors(prev => ({ ...prev, phone: undefined }));
                      }}
                      className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                        formErrors.phone ? 'border-red-300' : 'border-gray-300'
                      }`}
                      placeholder="Enter your phone number (e.g. +1 234 567 8900)"
                    />
                    {formErrors.phone && (
                      <p className="mt-1 text-sm text-red-600">{formErrors.phone}</p>
                    )}
                  </div>
                ) : (
                  <div className="flex min-h-12 items-center gap-3 rounded-xl bg-gray-50 px-4 py-3 text-sm text-gray-900">
                    <Phone className="h-4 w-4 text-gray-400" />
                    <span className="text-gray-900">{user?.phone || 'Not provided'}</span>
                  </div>
                )}
              </div>

              {/* Preferences */}
              <div>
                <h3 className="mb-4 text-lg font-semibold text-gray-900">Room Preferences</h3>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {/* Bed Type */}
                  <div>
                    <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Preferred Bed Type
                    </label>
                    {editing ? (
                      <select
                        value={profileData.preferences.bedType}
                        onChange={(e) => handleProfileChange('preferences.bedType', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="">Select bed type</option>
                        <option value="single">Single</option>
                        <option value="double">Double</option>
                        <option value="queen">Queen</option>
                        <option value="king">King</option>
                      </select>
                    ) : (
                      <div className="flex min-h-12 items-center gap-3 rounded-xl bg-gray-50 px-4 py-3 text-sm text-gray-900">
                        <Bed className="h-4 w-4 text-gray-400" />
                        <span className="text-gray-900">{formatPreference(user?.preferences?.bedType)}</span>
                      </div>
                    )}
                  </div>

                  {/* Floor Preference */}
                  <div>
                    <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Floor Preference
                    </label>
                    {editing ? (
                      <input
                        type="text"
                        value={profileData.preferences.floor}
                        onChange={(e) => handleProfileChange('preferences.floor', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="e.g., High floor, Low floor"
                      />
                    ) : (
                      <div className="flex min-h-12 items-center gap-3 rounded-xl bg-gray-50 px-4 py-3 text-sm text-gray-900">
                        <Building className="h-4 w-4 text-gray-400" />
                        <span className="text-gray-900">{user?.preferences?.floor || 'Not specified'}</span>
                      </div>
                    )}
                  </div>

                  {/* Smoking Preference */}
                  <div className="md:col-span-2">
                    <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Smoking Preference
                    </label>
                    <div className="rounded-xl bg-gray-50 px-4 py-3">
                      {editing ? (
                        <label className="flex items-center gap-3 text-sm font-medium text-gray-700">
                          <input
                            type="checkbox"
                            checked={profileData.preferences.smokingAllowed}
                            onChange={(e) => handleProfileChange('preferences.smokingAllowed', e.target.checked)}
                            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          Smoking Allowed
                        </label>
                      ) : (
                        <div className="flex items-center gap-2 text-sm text-gray-900">
                          <AlertCircle className="h-4 w-4 text-gray-400" />
                          <span className="font-medium text-gray-700">Smoking Allowed</span>
                          {user?.preferences?.smokingAllowed ? (
                            <CheckCircle className="h-4 w-4 text-green-500" />
                          ) : (
                            <X className="h-4 w-4 text-red-500" />
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Other Preferences */}
                  <div className="md:col-span-2">
                    <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Other Preferences
                    </label>
                    {editing ? (
                      <textarea
                        value={profileData.preferences.other}
                        onChange={(e) => handleProfileChange('preferences.other', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        rows={3}
                        placeholder="Any other preferences or special requirements..."
                      />
                    ) : (
                      <div className="rounded-xl bg-gray-50 px-4 py-3 text-sm text-gray-900">
                        <span className="text-gray-900">
                          {user?.preferences?.other || 'No additional preferences'}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Loyalty Status */}
          <Card className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <h3 className="mb-4 text-lg font-semibold text-gray-900">Loyalty Status</h3>
            <div className="text-center">
              <div className={`mb-4 inline-flex items-center rounded-full px-3 py-1 text-sm font-medium ${getLoyaltyTierColor(user?.loyalty?.tier || 'bronze')}`}>
                {formatPreference(user?.loyalty?.tier || 'bronze')} Member
              </div>
              <p className="mb-1 text-3xl font-bold text-gray-900">
                {user?.loyalty?.points || 0} Points
              </p>
              <p className="text-sm text-gray-600">
                Member since {formatMemberSince(user?.createdAt)}
              </p>
            </div>
          </Card>

          {/* Security */}
          <Card className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <h3 className="mb-4 text-lg font-semibold text-gray-900">Security</h3>
            <Button
              variant="ghost"
              className="w-full justify-start rounded-xl border border-transparent px-3 py-2 text-gray-700 hover:border-gray-200 hover:bg-gray-50"
              onClick={() => setShowPasswordForm(!showPasswordForm)}
            >
              <Lock className="w-4 h-4 mr-2" />
              Change Password
            </Button>
          </Card>

          {/* Password Change Form */}
          {showPasswordForm && (
            <Card className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <h3 className="mb-4 text-lg font-semibold text-gray-900">Change Password</h3>
              <div className="space-y-4">
                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Current Password *
                  </label>
                  <div className="relative">
                    <input
                      type={showCurrentPassword ? 'text' : 'password'}
                      value={passwordData.currentPassword}
                      onChange={(e) => handlePasswordFieldChange('currentPassword', e.target.value)}
                      className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Enter current password"
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                    >
                      {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                    New Password *
                  </label>
                  <div className="relative">
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      value={passwordData.newPassword}
                      onChange={(e) => handlePasswordFieldChange('newPassword', e.target.value)}
                      className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Enter new password"
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                    >
                      {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {passwordData.newPassword && (
                    <div className="mt-2 space-y-1">
                      <p className={`text-xs ${passwordData.newPassword.length >= 8 ? 'text-green-600' : 'text-gray-500'}`}>
                        {passwordData.newPassword.length >= 8 ? <CheckCircle className="w-3 h-3 inline mr-1" /> : <AlertCircle className="w-3 h-3 inline mr-1" />}
                        At least 8 characters
                      </p>
                      <p className={`text-xs ${/[A-Z]/.test(passwordData.newPassword) ? 'text-green-600' : 'text-gray-500'}`}>
                        {/[A-Z]/.test(passwordData.newPassword) ? <CheckCircle className="w-3 h-3 inline mr-1" /> : <AlertCircle className="w-3 h-3 inline mr-1" />}
                        At least one uppercase letter
                      </p>
                      <p className={`text-xs ${/[0-9]/.test(passwordData.newPassword) ? 'text-green-600' : 'text-gray-500'}`}>
                        {/[0-9]/.test(passwordData.newPassword) ? <CheckCircle className="w-3 h-3 inline mr-1" /> : <AlertCircle className="w-3 h-3 inline mr-1" />}
                        At least one number
                      </p>
                      <p className={`text-xs ${/[!@#$%^&*(),.?":{}|<>]/.test(passwordData.newPassword) ? 'text-green-600' : 'text-gray-500'}`}>
                        {/[!@#$%^&*(),.?":{}|<>]/.test(passwordData.newPassword) ? <CheckCircle className="w-3 h-3 inline mr-1" /> : <AlertCircle className="w-3 h-3 inline mr-1" />}
                        At least one special character
                      </p>
                    </div>
                  )}
                </div>
                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Confirm New Password *
                  </label>
                  <input
                    type="password"
                    value={passwordData.confirmPassword}
                    onChange={(e) => handlePasswordFieldChange('confirmPassword', e.target.value)}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                      passwordData.confirmPassword && passwordData.newPassword !== passwordData.confirmPassword
                        ? 'border-red-300'
                        : 'border-gray-300'
                    }`}
                    placeholder="Confirm new password"
                    autoComplete="new-password"
                  />
                  {passwordData.confirmPassword && passwordData.newPassword !== passwordData.confirmPassword && (
                    <p className="mt-1 text-xs text-red-600">Passwords do not match</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setShowPasswordForm(false);
                      setPasswordData({
                        currentPassword: '',
                        newPassword: '',
                        confirmPassword: ''
                      });
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={handlePasswordChange}
                    loading={changingPassword}
                    disabled={changingPassword}
                  >
                    {changingPassword ? 'Updating...' : 'Update Password'}
                  </Button>
                </div>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

export default withErrorBoundary(GuestProfile);
