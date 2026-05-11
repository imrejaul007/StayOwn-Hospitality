import React, { useState, useEffect } from 'react';
import { X, Eye, EyeOff, RefreshCw } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { Modal } from '../ui/Modal';
import userManagementService, { UpdateUserData } from '../../services/userManagementService';
import { useProperty } from '../../context/PropertyContext';
import { useQuery } from '@tanstack/react-query';
import { adminService } from '../../services/adminService';

interface User {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  role: 'admin' | 'manager' | 'staff' | 'frontdesk' | 'housekeeping';
  department?: string;
  employeeId?: string;
  isActive: boolean;
  properties?: Array<{ _id: string; name: string }> | string[];
  primaryProperty?: string | { _id: string; name: string };
  multiPropertyAccess?: {
    enabled: boolean;
    restrictions?: {
      canCreateProperties: boolean;
      canDeleteProperties: boolean;
      canManageGroups: boolean;
    };
  };
}

interface EditUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  user: User;
}

export function EditUserModal({ isOpen, onClose, onSuccess, user }: EditUserModalProps) {
  // Fetch ALL properties (not filtered by user access) for admin user management
  const { data: allPropertiesData } = useQuery({
    queryKey: ['all-properties-admin'],
    queryFn: async () => {
      const response = await adminService.getHotels();
      return response.data.hotels;
    },
    enabled: isOpen, // Only fetch when modal is open
    staleTime: 0, // Always refetch to ensure new properties appear
    refetchOnMount: true, // Refetch when modal opens
  });

  const properties = allPropertiesData || [];

  const [formData, setFormData] = useState<UpdateUserData>({
    name: '',
    email: '',
    phone: '',
    role: 'staff',
    department: '',
    employeeId: '',
    isActive: true,
    properties: [],
    multiPropertyAccess: {
      enabled: false,
      canCreateProperties: false,
      canDeleteProperties: false,
      canManageGroups: false
    }
  });

  const [showPassword, setShowPassword] = useState(false);
  const [changePassword, setChangePassword] = useState(false);
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedProperties, setSelectedProperties] = useState<string[]>([]);

  // Pre-fill form when user data changes
  useEffect(() => {
    if (user) {
      // Extract property IDs
      const propertyIds = user.properties?.map(p =>
        typeof p === 'string' ? p : p._id
      ) || [];

      const primaryPropertyId = user.primaryProperty
        ? (typeof user.primaryProperty === 'string' ? user.primaryProperty : user.primaryProperty._id)
        : undefined;

      setFormData({
        name: user.name,
        email: user.email,
        phone: user.phone || '',
        role: user.role,
        department: user.department || '',
        employeeId: user.employeeId || '',
        isActive: user.isActive,
        properties: propertyIds,
        primaryProperty: primaryPropertyId,
        multiPropertyAccess: {
          enabled: user.multiPropertyAccess?.enabled || false,
          canCreateProperties: user.multiPropertyAccess?.restrictions?.canCreateProperties || false,
          canDeleteProperties: user.multiPropertyAccess?.restrictions?.canDeleteProperties || false,
          canManageGroups: user.multiPropertyAccess?.restrictions?.canManageGroups || false
        }
      });

      setSelectedProperties(propertyIds);
      setChangePassword(false);
      setPassword('');
    }
  }, [user]);

  const handleGeneratePassword = async () => {
    try {
      const newPassword = await userManagementService.generatePassword();
      setPassword(newPassword);
      toast.success('Password generated');
    } catch (error) {
      toast.error('Failed to generate password');
    }
  };

  const handlePropertyToggle = (propertyId: string) => {
    setSelectedProperties(prev => {
      if (prev.includes(propertyId)) {
        return prev.filter(id => id !== propertyId);
      } else {
        return [...prev, propertyId];
      }
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!formData.name || !formData.email) {
      toast.error('Please fill in all required fields');
      return;
    }

    // Email validation - more permissive pattern supporting modern TLDs
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(formData.email)) {
      toast.error('Please enter a valid email address');
      return;
    }

    // Password validation if changing
    if (changePassword && password) {
      if (password.length < 8) {
        toast.error('Password must be at least 8 characters');
        return;
      }
    }

    try {
      setLoading(true);

      const updateData: UpdateUserData = {
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        role: formData.role,
        department: formData.department,
        employeeId: formData.employeeId,
        isActive: formData.isActive,
        properties: selectedProperties.length > 0 ? selectedProperties : undefined,
        primaryProperty: formData.primaryProperty,
        multiPropertyAccess: selectedProperties.length > 1 ? {
          enabled: true,
          allowedProperties: selectedProperties,
          restrictions: {
            canCreateProperties: formData.multiPropertyAccess?.canCreateProperties || false,
            canDeleteProperties: formData.multiPropertyAccess?.canDeleteProperties || false,
            canManageGroups: formData.multiPropertyAccess?.canManageGroups || false,
          }
        } : undefined
      };

      // Only include password if changing
      if (changePassword && password) {
        updateData.password = password;
      }

      await userManagementService.updateUser(user._id, updateData);

      toast.success('User updated successfully');
      onSuccess();
      onClose();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } }; message?: string };
      toast.error(err.response?.data?.message || err.message || 'Failed to update user');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Edit User" size="xl">
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Information */}
        <div>
          <h3 className="text-lg font-medium mb-4">Basic Information</h3>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="John Doe"
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="john@example.com"
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Phone
              </label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="+91 98765 43210"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Change Password Option */}
            <div>
              <label className="flex items-center space-x-2 mb-2">
                <input
                  type="checkbox"
                  checked={changePassword}
                  onChange={(e) => {
                    setChangePassword(e.target.checked);
                    if (!e.target.checked) {
                      setPassword('');
                    }
                  }}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm font-medium text-gray-700">Change Password</span>
              </label>

              {changePassword && (
                <>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    New Password
                  </label>
                  <div className="flex gap-2">
                    <div className="flex-1 relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Enter new password"
                        className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <button aria-label="View"
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={handleGeneratePassword}
                      className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 flex items-center gap-2"
                    >
                      <RefreshCw className="w-4 h-4" />
                      Generate
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Leave blank to keep current password
                  </p>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Role & Permissions */}
        <div>
          <h3 className="text-lg font-medium mb-4">Role & Permissions</h3>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Role <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value as string })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="staff">Staff - General operational access</option>
                <option value="housekeeping">Housekeeping - Room cleaning tasks</option>
                <option value="frontdesk">Front Desk - Guest check-in/out</option>
                <option value="manager">Manager - Property management access</option>
                <option value="admin">Admin - Full system access</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Department
              </label>
              <input
                type="text"
                value={formData.department}
                onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                placeholder="e.g., Front Desk, Housekeeping"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Employee ID
              </label>
              <input
                type="text"
                value={formData.employeeId}
                onChange={(e) => setFormData({ ...formData, employeeId: e.target.value })}
                placeholder="e.g., EMP001"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Property Access */}
        {properties.length > 0 && (
          <div>
            <h3 className="text-lg font-medium mb-4">Property Access</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Primary Property <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.primaryProperty || ''}
                  onChange={(e) => {
                    setFormData({ ...formData, primaryProperty: e.target.value });
                    if (e.target.value && !selectedProperties.includes(e.target.value)) {
                      setSelectedProperties([...selectedProperties, e.target.value]);
                    }
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="" disabled>Select a property</option>
                  {properties.map(p => (
                    <option key={p._id} value={p._id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              {properties.length > 1 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Additional Properties
                  </label>
                  <div className="space-y-2 max-h-40 overflow-y-auto border rounded-md p-3">
                    {properties.map(property => (
                      <label key={property._id} className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={selectedProperties.includes(property._id)}
                          onChange={() => handlePropertyToggle(property._id)}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm">{property.name}</span>
                      </label>
                    ))}
                  </div>

                  {selectedProperties.length > 1 && (
                    <div className="mt-4 p-3 bg-blue-50 rounded-md">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Multi-Property Permissions
                      </label>
                      <div className="space-y-2">
                        <label className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            checked={formData.multiPropertyAccess?.canCreateProperties}
                            onChange={(e) => setFormData({
                              ...formData,
                              multiPropertyAccess: {
                                ...formData.multiPropertyAccess!,
                                enabled: true,
                                canCreateProperties: e.target.checked
                              }
                            })}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="text-sm">Can create new properties</span>
                        </label>
                        <label className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            checked={formData.multiPropertyAccess?.canDeleteProperties}
                            onChange={(e) => setFormData({
                              ...formData,
                              multiPropertyAccess: {
                                ...formData.multiPropertyAccess!,
                                enabled: true,
                                canDeleteProperties: e.target.checked
                              }
                            })}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="text-sm">Can delete properties</span>
                        </label>
                        <label className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            checked={formData.multiPropertyAccess?.canManageGroups}
                            onChange={(e) => setFormData({
                              ...formData,
                              multiPropertyAccess: {
                                ...formData.multiPropertyAccess!,
                                enabled: true,
                                canManageGroups: e.target.checked
                              }
                            })}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="text-sm">Can manage property groups</span>
                        </label>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Account Status */}
        <div>
          <h3 className="text-lg font-medium mb-4">Account Status</h3>

          <div className="space-y-3">
            <div className="flex items-center space-x-4">
              <label className="flex items-center space-x-2">
                <input
                  type="radio"
                  checked={formData.isActive}
                  onChange={() => setFormData({ ...formData, isActive: true })}
                  className="text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm">Active (User can log in)</span>
              </label>
              <label className="flex items-center space-x-2">
                <input
                  type="radio"
                  checked={!formData.isActive}
                  onChange={() => setFormData({ ...formData, isActive: false })}
                  className="text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm">Inactive (User cannot log in)</span>
              </label>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end gap-3 pt-4 border-t">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Cancel
          </button>
          <button aria-label="Update User"
            type="submit"
            disabled={loading}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Updating...' : 'Update User'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
