import React, { useState, useEffect, useRef} from 'react';
import {
  PlusIcon,
  PencilIcon,
  TrashIcon,
  EyeIcon,
  FunnelIcon,
  ArrowPathIcon,
  ChartBarIcon,
  ExclamationCircleIcon
} from '@heroicons/react/24/outline';
import { toast } from 'react-hot-toast';
import SalutationForm from '../../components/admin/SalutationForm';
import SalutationStats from '../../components/admin/SalutationStats';
import { ApplyToSelector, ApplyToConfirmation, ApplyToScope } from '../../components/settings/ApplyToSelector';
import { useSettingsInheritance, useAffectedPropertiesCount } from '../../hooks/useSettingsInheritance';
import { useProperty } from '../../context/PropertyContext';
import { api } from '../../services/api';
import { withErrorBoundary } from '../../components/ErrorBoundary';

interface Salutation {
  _id: string;
  title: string;
  fullForm?: string;
  category: 'personal' | 'professional' | 'religious' | 'cultural' | 'academic';
  gender: 'male' | 'female' | 'neutral' | 'any';
  language: string;
  region?: string;
  sortOrder: number;
  isActive: boolean;
  createdBy: {
    _id: string;
    name: string;
  };
  updatedBy?: {
    _id: string;
    name: string;
  };
  createdAt: string;
  updatedAt: string;
}

const AdminSalutations: React.FC = () => {
  const [salutations, setSalutations] = useState<Salutation[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingSalutation, setEditingSalutation] = useState<Salutation | null>(null);
  const [showStats, setShowStats] = useState(false);
  const [filters, setFilters] = useState({
    category: '',
    gender: '',
    isActive: '',
    search: ''
  });
  const [pagination, setPagination] = useState({
    current: 1,
    pages: 1,
    total: 0
  });

  // Multi-property support
  const { selectedProperty, selectedPropertyId } = useProperty();
  const [applyToScope, setApplyToScope] = useState<ApplyToScope>('single');
  const [showSuccess, setShowSuccess] = useState(false);

  const {
    useInheritanceStatus,
    applySettings,
    isUpdating,
    updateError,
    showConfirmation,
    pendingUpdate,
    confirmBulkUpdate,
    cancelBulkUpdate,
  } = useSettingsInheritance();

  const { data: inheritanceStatus } = useInheritanceStatus(selectedPropertyId);
  const affectedCount = useAffectedPropertiesCount(
    applyToScope,
    inheritanceStatus?.groupPropertyCount || 0
  );

  const categories = [
    { value: '', label: 'All Categories' },
    { value: 'personal', label: 'Personal' },
    { value: 'professional', label: 'Professional' },
    { value: 'religious', label: 'Religious' },
    { value: 'cultural', label: 'Cultural' },
    { value: 'academic', label: 'Academic' }
  ];

  const genders = [
    { value: '', label: 'All Genders' },
    { value: 'male', label: 'Male' },
    { value: 'female', label: 'Female' },
    { value: 'neutral', label: 'Neutral' },
    { value: 'any', label: 'Any' }
  ];

  const statusOptions = [
    { value: '', label: 'All Status' },
    { value: 'true', label: 'Active' },
    { value: 'false', label: 'Inactive' }
  ];

  const successTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (successTimerRef.current) clearTimeout(successTimerRef.current);
    };
  }, []);

  useEffect(() => {
    // Reset to page 1 when filters change
    setPagination(prev => ({ ...prev, current: 1 }));
  }, [filters.category, filters.gender, filters.isActive, filters.search]);

  useEffect(() => {
    fetchSalutations();
  }, [filters, pagination.current]);

  const fetchSalutations = async () => {
    try {
      setLoading(true);
      const queryParams = new URLSearchParams();

      queryParams.append('page', pagination.current.toString());
      queryParams.append('limit', '50');

      if (filters.category) queryParams.append('category', filters.category);
      if (filters.gender) queryParams.append('gender', filters.gender);
      if (filters.isActive) queryParams.append('isActive', filters.isActive);
      if (filters.search) queryParams.append('search', filters.search);

      const { data } = await api.get(`/salutations?${queryParams}`);
      setSalutations(data.data.salutations);
      if (data.pagination) {
        setPagination({
          current: data.pagination.page,
          pages: data.pagination.pages,
          total: data.pagination.total
        });
      }
    } catch (error) {
      toast.error('Failed to fetch salutations');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingSalutation(null);
    setShowForm(true);
  };

  const handleEdit = (salutation: Salutation) => {
    setEditingSalutation(salutation);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this salutation?')) {
      return;
    }

    try {
      if (applyToScope !== 'single') {
        const result = await applySettings({
          scope: applyToScope,
          propertyId: selectedPropertyId,
          settingUpdates: { id, action: 'delete' },
          settingType: 'salutations',
        });

        if (!result) return;

        setShowSuccess(true);
        if (successTimerRef.current) clearTimeout(successTimerRef.current);
        successTimerRef.current = setTimeout(() => setShowSuccess(false), 3000);
        setApplyToScope('single');
        fetchSalutations();
      } else {
        await api.delete(`/salutations/${id}`);

        toast.success('Salutation deleted successfully');
        fetchSalutations();
      }
    } catch (error) {
      toast.error('Failed to delete salutation');
    }
  };

  const handleToggleStatus = async (id: string, currentStatus: boolean) => {
    try {
      if (applyToScope !== 'single') {
        const result = await applySettings({
          scope: applyToScope,
          propertyId: selectedPropertyId,
          settingUpdates: { id, currentStatus },
          settingType: 'salutations',
        });

        if (!result) return;

        setShowSuccess(true);
        if (successTimerRef.current) clearTimeout(successTimerRef.current);
        successTimerRef.current = setTimeout(() => setShowSuccess(false), 3000);
        setApplyToScope('single');
        fetchSalutations();
      } else {
        await api.patch(`/salutations/${id}/toggle-status`);

        toast.success(`Salutation ${currentStatus ? 'deactivated' : 'activated'} successfully`);
        fetchSalutations();
      }
    } catch (error) {
      toast.error('Failed to toggle salutation status');
    }
  };

  const handleConfirm = async () => {
    if (pendingUpdate) {
      const result = await confirmBulkUpdate();
      if (result) {
        setShowSuccess(true);
        if (successTimerRef.current) clearTimeout(successTimerRef.current);
        successTimerRef.current = setTimeout(() => setShowSuccess(false), 3000);
        setApplyToScope('single');
        fetchSalutations();
      }
    }
  };

  const handleSeedDefaults = async () => {
    if (!window.confirm('This will create default salutations. Continue?')) {
      return;
    }

    try {
      const { data } = await api.post('/salutations/seed-defaults');
      toast.success(`Created ${data.data.count} default salutations`);
      fetchSalutations();
    } catch (error) {
      toast.error('Failed to seed default salutations');
    }
  };

  const handleFormClose = () => {
    setShowForm(false);
    setEditingSalutation(null);
  };

  const handleFormSuccess = () => {
    setShowForm(false);
    setEditingSalutation(null);
    fetchSalutations();
  };

  const getCategoryColor = (category: string) => {
    const colors = {
      personal: 'bg-blue-100 text-blue-800',
      professional: 'bg-green-100 text-green-800',
      religious: 'bg-purple-100 text-purple-800',
      cultural: 'bg-orange-100 text-orange-800',
      academic: 'bg-indigo-100 text-indigo-800'
    };
    return colors[category as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  const getGenderColor = (gender: string) => {
    const colors = {
      male: 'bg-blue-100 text-blue-800',
      female: 'bg-pink-100 text-pink-800',
      neutral: 'bg-gray-100 text-gray-800',
      any: 'bg-yellow-100 text-yellow-800'
    };
    return colors[gender as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  if (showForm) {
    return (
      <SalutationForm
        salutation={editingSalutation}
        onClose={handleFormClose}
        onSuccess={handleFormSuccess}
      />
    );
  }

  if (showStats) {
    return (
      <SalutationStats
        onClose={() => setShowStats(false)}
      />
    );
  }

  return (
    <div className="p-6">
      {/* Success Message */}
      {showSuccess && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-800 dark:text-green-200 px-4 py-3 rounded-lg mb-4">
          <p className="font-medium">Settings updated successfully!</p>
          {applyToScope !== 'single' && affectedCount > 1 && (
            <p className="text-sm mt-1">Changes applied to {affectedCount} properties</p>
          )}
        </div>
      )}

      {/* Error Message */}
      {updateError && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-200 px-4 py-3 rounded-lg mb-4">
          <p className="font-medium">Error: {updateError}</p>
        </div>
      )}

      {/* Inheritance Status */}
      {inheritanceStatus?.isInheriting && inheritanceStatus?.hasGroup && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-4">
          <div className="flex items-start">
            <ExclamationCircleIcon className="w-5 h-5 text-blue-600 dark:text-blue-400 mr-3 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                This property is part of: {inheritanceStatus.groupName}
              </p>
              <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                Settings are inherited from the property group.
                {inheritanceStatus.lastSyncedAt && (
                  <span className="ml-1">
                    Last synced: {new Date(inheritanceStatus.lastSyncedAt).toLocaleString()}
                  </span>
                )}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="mb-6">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Salutations Management</h1>
            <p className="text-gray-600">Manage guest salutations and titles</p>
          </div>
          <div className="flex space-x-3">
            <button
              onClick={() => setShowStats(true)}
              className="flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              <ChartBarIcon className="w-4 h-4 mr-2" />
              Statistics
            </button>
            <button
              onClick={handleSeedDefaults}
              className="flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700"
            >
              <ArrowPathIcon className="w-4 h-4 mr-2" />
              Seed Defaults
            </button>
            <button
              onClick={handleCreate}
              className="flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700"
            >
              <PlusIcon className="w-4 h-4 mr-2" />
              Add Salutation
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white p-4 rounded-lg shadow-sm border">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Search
              </label>
              <input
                type="text"
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                placeholder="Search salutations..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Category
              </label>
              <select
                value={filters.category}
                onChange={(e) => setFilters({ ...filters, category: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {categories.map(cat => (
                  <option key={cat.value} value={cat.value}>{cat.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Gender
              </label>
              <select
                value={filters.gender}
                onChange={(e) => setFilters({ ...filters, gender: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {genders.map(gender => (
                  <option key={gender.value} value={gender.value}>{gender.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Status
              </label>
              <select
                value={filters.isActive}
                onChange={(e) => setFilters({ ...filters, isActive: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {statusOptions.map(status => (
                  <option key={status.value} value={status.value}>{status.label}</option>
                ))}
              </select>
            </div>
            <div className="flex items-end">
              <button
                onClick={() => setFilters({ category: '', gender: '', isActive: '', search: '' })}
                className="w-full flex items-center justify-center px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200"
              >
                <FunnelIcon className="w-4 h-4 mr-2" />
                Clear Filters
              </button>
            </div>
          </div>
        </div>

        {/* Multi-property selector */}
        <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mt-4">
          <ApplyToSelector
            value={applyToScope}
            onChange={setApplyToScope}
            isInGroup={inheritanceStatus?.hasGroup || false}
            groupName={inheritanceStatus?.groupName}
            totalProperties={inheritanceStatus?.groupPropertyCount || 0}
            showWarning={true}
            warningMessage="These salutation options will be applied to all selected properties. Ensure options are culturally appropriate for all properties."
          />
        </div>
      </div>

      {/* Salutations Table */}
      <div className="bg-white shadow-sm rounded-lg border">
        {loading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-2 text-gray-600">Loading salutations...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Title
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Full Form
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Category
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Gender
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Language/Region
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {salutations.map((salutation) => (
                  <tr key={salutation._id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {salutation.title}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {salutation.fullForm || '-'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getCategoryColor(salutation.category)}`}>
                        {salutation.category}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getGenderColor(salutation.gender)}`}>
                        {salutation.gender}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {salutation.language}
                      {salutation.region && ` (${salutation.region})`}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <button aria-label="Toggle"
                        onClick={() => handleToggleStatus(salutation._id, salutation.isActive)}
                        className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          salutation.isActive 
                            ? 'bg-green-100 text-green-800 hover:bg-green-200' 
                            : 'bg-red-100 text-red-800 hover:bg-red-200'
                        }`}
                      >
                        {salutation.isActive ? 'Active' : 'Inactive'}
                      </button>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex space-x-2">
                        <button aria-label="Edit"
                          onClick={() => handleEdit(salutation)}
                          className="text-blue-600 hover:text-blue-900"
                        >
                          <PencilIcon className="w-4 h-4" />
                        </button>
                        <button aria-label="Delete"
                          onClick={() => handleDelete(salutation._id)}
                          className="text-red-600 hover:text-red-900"
                        >
                          <TrashIcon className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!loading && salutations.length === 0 && (
          <div className="p-8 text-center">
            <p className="text-gray-500">No salutations found</p>
            <button
              onClick={handleCreate}
              className="mt-2 text-blue-600 hover:text-blue-800"
            >
              Create your first salutation
            </button>
          </div>
        )}

        {/* Pagination */}
        {pagination.pages > 1 && (
          <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
            <div className="text-sm text-gray-700">
              Page {pagination.current} of {pagination.pages} ({pagination.total} total)
            </div>
            <div className="flex space-x-2">
              <button
                onClick={() => setPagination(prev => ({ ...prev, current: Math.max(1, prev.current - 1) }))}
                disabled={pagination.current <= 1}
                className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
              >
                Previous
              </button>
              <button
                onClick={() => setPagination(prev => ({ ...prev, current: Math.min(prev.pages, prev.current + 1) }))}
                disabled={pagination.current >= pagination.pages}
                className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Confirmation Dialog */}
      <ApplyToConfirmation
        isOpen={showConfirmation}
        scope={applyToScope}
        affectedCount={affectedCount}
        settingName="Salutation Options"
        groupName={inheritanceStatus?.groupName}
        onConfirm={handleConfirm}
        onCancel={cancelBulkUpdate}
      />
    </div>
  );
};

export default withErrorBoundary(AdminSalutations);
