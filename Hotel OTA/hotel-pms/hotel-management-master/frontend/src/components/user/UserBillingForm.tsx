import React, { useState, useEffect } from 'react';
import { XMarkIcon, CheckIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { toast } from 'react-hot-toast';
import { api } from '../../services/api';

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

interface UserBillingFormProps {
  user?: User | null;
  onClose: () => void;
  onSuccess: () => void;
}

const UserBillingForm: React.FC<UserBillingFormProps> = ({
  user,
  onClose,
  onSuccess
}) => {
  const [formData, setFormData] = useState<BillingDetails>({
    gstNumber: '',
    companyName: '',
    billingAddress: {
      street: '',
      city: '',
      state: '',
      postalCode: '',
      country: 'India'
    },
    panNumber: '',
    billingContactPerson: '',
    billingEmail: '',
    billingPhone: ''
  });

  const [loading, setLoading] = useState(false);
  const [validatingGST, setValidatingGST] = useState(false);
  const [gstValid, setGstValid] = useState<boolean | null>(null);

  useEffect(() => {
    if (user?.billingDetails) {
      setFormData({
        gstNumber: user.billingDetails.gstNumber || '',
        companyName: user.billingDetails.companyName || '',
        billingAddress: {
          street: user.billingDetails.billingAddress?.street || '',
          city: user.billingDetails.billingAddress?.city || '',
          state: user.billingDetails.billingAddress?.state || '',
          postalCode: user.billingDetails.billingAddress?.postalCode || '',
          country: user.billingDetails.billingAddress?.country || 'India'
        },
        panNumber: user.billingDetails.panNumber || '',
        billingContactPerson: user.billingDetails.billingContactPerson || '',
        billingEmail: user.billingDetails.billingEmail || '',
        billingPhone: user.billingDetails.billingPhone || ''
      });
    }
  }, [user]);

  const validateGSTNumber = async (gstNumber: string) => {
    if (!gstNumber || gstNumber.length < 15) {
      setGstValid(null);
      return;
    }

    setValidatingGST(true);
    try {
      const response = await api.post('/users/validate-gst', { gstNumber });
      setGstValid(response.data.data.isValid);
    } catch (error) {
      setGstValid(false);
    } finally {
      setValidatingGST(false);
    }
  };

  const handleInputChange = (field: string, value: string, subField?: string) => {
    if (subField) {
      setFormData(prev => ({
        ...prev,
        [field]: {
          ...(prev[field as keyof BillingDetails] as unknown),
          [subField]: value
        }
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [field]: value
      }));

      // Validate GST number on change
      if (field === 'gstNumber') {
        validateGSTNumber(value);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Validate GST if provided
      if (formData.gstNumber && !gstValid) {
        toast.error('Please enter a valid GST number');
        setLoading(false);
        return;
      }

      // Clean up the form data - remove empty strings to avoid validation errors
      const cleanedFormData = {
        ...formData,
        panNumber: formData.panNumber?.trim() || undefined,
        billingPhone: formData.billingPhone?.trim() || undefined,
        billingEmail: formData.billingEmail?.trim() || undefined,
        billingContactPerson: formData.billingContactPerson?.trim() || undefined,
        gstNumber: formData.gstNumber?.trim() || undefined,
        companyName: formData.companyName?.trim() || undefined,
        billingAddress: {
          street: formData.billingAddress?.street?.trim() || undefined,
          city: formData.billingAddress?.city?.trim() || undefined,
          state: formData.billingAddress?.state?.trim() || undefined,
          postalCode: formData.billingAddress?.postalCode?.trim() || undefined,
          country: formData.billingAddress?.country?.trim() || 'India'
        }
      };

      // Remove undefined values to send only fields with actual data
      const filteredData = Object.fromEntries(
        Object.entries(cleanedFormData).filter(([_, value]) => {
          if (value === undefined || value === null) return false;
          if (typeof value === 'string' && value.length === 0) return false;
          if (typeof value === 'object' && value !== null) {
            // For billingAddress, check if it has any meaningful data
            const hasData = Object.values(value).some(v => v && v.length > 0);
            return hasData;
          }
          return true;
        })
      );

      await api.put(`/users/${user?._id}/billing`, filteredData);
      toast.success('Billing details updated successfully');
      onSuccess();
      onClose();
    } catch (error: unknown) {
      toast.error(error.response?.data?.message || 'Failed to update billing details');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        <div aria-hidden="true" className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75" onClick={onClose} />

        <div className="inline-block w-full max-w-2xl p-6 my-8 overflow-hidden text-left align-middle transition-all transform bg-white shadow-xl rounded-lg">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-medium text-gray-900">
              Update Billing Details - {user?.name}
            </h3>
            <button aria-label="Close"
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <XMarkIcon className="w-6 h-6" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* GST Number */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                GST Number
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={formData.gstNumber}
                  onChange={(e) => handleInputChange('gstNumber', e.target.value.toUpperCase())}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="22AAAAA0000A1Z5"
                  maxLength={15}
                />
                {formData.gstNumber && (
                  <div className="absolute right-3 top-2">
                    {validatingGST ? (
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                    ) : gstValid === true ? (
                      <CheckIcon className="w-5 h-5 text-green-500" />
                    ) : gstValid === false ? (
                      <ExclamationTriangleIcon className="w-5 h-5 text-red-500" />
                    ) : null}
                  </div>
                )}
              </div>
              {gstValid === false && (
                <p className="mt-1 text-sm text-red-600">Invalid GST number format</p>
              )}
              <p className="mt-1 text-sm text-gray-500">Format: 22AAAAA0000A1Z5</p>
            </div>

            {/* Company Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Company Name
              </label>
              <input
                type="text"
                value={formData.companyName}
                onChange={(e) => handleInputChange('companyName', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter company name"
                required
              />
            </div>

            {/* PAN Number */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                PAN Number
              </label>
              <input
                type="text"
                value={formData.panNumber}
                onChange={(e) => handleInputChange('panNumber', e.target.value.toUpperCase())}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="AAAAA0000A"
                maxLength={10}
              />
              <p className="mt-1 text-sm text-gray-500">Format: AAAAA0000A</p>
            </div>

            {/* Billing Address */}
            <div className="space-y-4">
              <h4 className="text-sm font-medium text-gray-700">Billing Address</h4>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Street Address
                </label>
                <input
                  type="text"
                  value={formData.billingAddress?.street}
                  onChange={(e) => handleInputChange('billingAddress', e.target.value, 'street')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter street address"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    City
                  </label>
                  <input
                    type="text"
                    value={formData.billingAddress?.city}
                    onChange={(e) => handleInputChange('billingAddress', e.target.value, 'city')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter city"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    State
                  </label>
                  <input
                    type="text"
                    value={formData.billingAddress?.state}
                    onChange={(e) => handleInputChange('billingAddress', e.target.value, 'state')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter state"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Postal Code
                  </label>
                  <input
                    type="text"
                    value={formData.billingAddress?.postalCode}
                    onChange={(e) => handleInputChange('billingAddress', e.target.value, 'postalCode')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter postal code"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Country
                  </label>
                  <input
                    type="text"
                    value={formData.billingAddress?.country}
                    onChange={(e) => handleInputChange('billingAddress', e.target.value, 'country')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter country"
                  />
                </div>
              </div>
            </div>

            {/* Contact Information */}
            <div className="space-y-4">
              <h4 className="text-sm font-medium text-gray-700">Billing Contact Information</h4>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Contact Person
                </label>
                <input
                  type="text"
                  value={formData.billingContactPerson}
                  onChange={(e) => handleInputChange('billingContactPerson', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter contact person name"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Billing Email
                  </label>
                  <input
                    type="email"
                    value={formData.billingEmail}
                    onChange={(e) => handleInputChange('billingEmail', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter billing email"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Billing Phone
                  </label>
                  <input
                    type="tel"
                    value={formData.billingPhone}
                    onChange={(e) => handleInputChange('billingPhone', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter billing phone"
                  />
                </div>
              </div>
            </div>

            {/* Submit Buttons */}
            <div className="flex justify-end space-x-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
              >
                Cancel
              </button>
              <button aria-label="Close"
                type="submit"
                disabled={loading || (formData.gstNumber && !gstValid)}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Updating...' : 'Update Billing Details'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default UserBillingForm;