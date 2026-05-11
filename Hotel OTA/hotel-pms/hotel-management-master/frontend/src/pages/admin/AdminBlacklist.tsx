import React, { useState, useEffect } from 'react';
import { withErrorBoundary } from '../../components/ErrorBoundary';
import { useProperty } from '../../context/PropertyContext';
import { PropertyBreadcrumb } from '../../components/common/PropertyBreadcrumb';
import {
  PlusIcon,
  PencilIcon,
  TrashIcon,
  EyeIcon,
  FunnelIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  UserMinusIcon,
  UserPlusIcon
} from '@heroicons/react/24/outline';
import { toast } from 'react-hot-toast';
import BlacklistForm from '../../components/admin/BlacklistForm';
import BlacklistAlert from '../../components/admin/BlacklistAlert';
import BlacklistStatistics from '../../components/admin/BlacklistStatistics';
import { api } from '../../services/api';

interface BlacklistEntry {
  _id: string;
  guestId: {
    _id: string;
    name: string;
    email: string;
    phone?: string;
  };
  reason: string;
  type: 'temporary' | 'permanent' | 'conditional';
  category: 'non_payment' | 'damage' | 'misconduct' | 'security' | 'policy_violation' | 'other';
  description: string;
  incidentDate: string;
  expiryDate?: string;
  conditions?: string;
  isActive: boolean;
  appealStatus: 'none' | 'pending' | 'approved' | 'rejected';
  appealDate?: string;
  appealNotes?: string;
  createdBy: {
    _id: string;
    name: string;
  };
  createdAt: string;
}

const AdminBlacklist: React.FC = () => {
  const { selectedPropertyId, selectedProperty, viewMode } = useProperty();
  const [blacklistEntries, setBlacklistEntries] = useState<BlacklistEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showAlert, setShowAlert] = useState(false);
  const [showStatistics, setShowStatistics] = useState(false);
  const [editingEntry, setEditingEntry] = useState<BlacklistEntry | null>(null);
  const [selectedEntries, setSelectedEntries] = useState<string[]>([]);
  const [filters, setFilters] = useState({
    search: '',
    isActive: '',
    type: '',
    category: '',
    appealStatus: '',
    sortBy: 'createdAt',
    sortOrder: 'desc'
  });
  const [pagination, setPagination] = useState({
    current: 1,
    pages: 1,
    total: 0
  });

  const types = [
    { value: '', label: 'All Types' },
    { value: 'temporary', label: 'Temporary' },
    { value: 'permanent', label: 'Permanent' },
    { value: 'conditional', label: 'Conditional' }
  ];

  const categories = [
    { value: '', label: 'All Categories' },
    { value: 'non_payment', label: 'Non-Payment' },
    { value: 'damage', label: 'Damage' },
    { value: 'misconduct', label: 'Misconduct' },
    { value: 'security', label: 'Security' },
    { value: 'policy_violation', label: 'Policy Violation' },
    { value: 'other', label: 'Other' }
  ];

  const appealStatuses = [
    { value: '', label: 'All Appeals' },
    { value: 'none', label: 'No Appeal' },
    { value: 'pending', label: 'Pending' },
    { value: 'approved', label: 'Approved' },
    { value: 'rejected', label: 'Rejected' }
  ];

  const statusOptions = [
    { value: '', label: 'All Status' },
    { value: 'true', label: 'Active' },
    { value: 'false', label: 'Inactive' }
  ];

  useEffect(() => {
    if (selectedPropertyId) {
      fetchBlacklistEntries();
    }
  }, [selectedPropertyId, filters, pagination.current]);

  const fetchBlacklistEntries = async () => {
    try {
      setLoading(true);
      const queryParams = new URLSearchParams();

      queryParams.append('page', pagination.current.toString());
      queryParams.append('limit', '20');
      queryParams.append('propertyId', selectedPropertyId || '');

      if (filters.search) queryParams.append('search', filters.search);
      if (filters.isActive) queryParams.append('isActive', filters.isActive);
      if (filters.type) queryParams.append('type', filters.type);
      if (filters.category) queryParams.append('category', filters.category);
      if (filters.appealStatus) queryParams.append('appealStatus', filters.appealStatus);
      if (filters.sortBy) queryParams.append('sortBy', filters.sortBy);
      if (filters.sortOrder) queryParams.append('sortOrder', filters.sortOrder);

      const { data } = await api.get(`/blacklist?${queryParams}`);
      setBlacklistEntries(data.data.blacklistEntries);
      setPagination(data.pagination);
    } catch (error) {
      toast.error('Failed to fetch blacklist entries');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingEntry(null);
    setShowForm(true);
  };

  const handleEdit = (entry: BlacklistEntry) => {
    setEditingEntry(entry);
    setShowForm(true);
  };

  const handleRemove = async (id: string) => {
    if (!window.confirm('Are you sure you want to remove this guest from the blacklist?')) {
      return;
    }

    try {
      await api.delete(`/blacklist/${id}`, { data: { reason: 'Manually removed by admin' } });

      toast.success('Guest removed from blacklist successfully');
      fetchBlacklistEntries();
    } catch (error) {
      toast.error('Failed to remove guest from blacklist');
    }
  };

  const handleAppealReview = async (id: string, status: 'approved' | 'rejected', notes?: string) => {
    try {
      await api.patch(`/blacklist/${id}/appeal`, { status, notes });

      toast.success(`Appeal ${status} successfully`);
      fetchBlacklistEntries();
    } catch (error) {
      toast.error('Failed to review appeal');
    }
  };

  const handleAutoExpire = async () => {
    try {
      const { data } = await api.post('/blacklist/auto-expire');
      toast.success(data.data.message);
      fetchBlacklistEntries();
    } catch (error) {
      toast.error('Failed to auto-expire blacklists');
    }
  };

  const handleExport = async () => {
    try {
      const response = await api.get('/blacklist/export', { params: { format: 'csv' }, responseType: 'blob' });
      const blob = response.data;
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'blacklist.csv';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success('Blacklist exported successfully');
    } catch (error) {
      toast.error('Failed to export blacklist');
    }
  };

  const handleSelectEntry = (entryId: string) => {
    setSelectedEntries(prev => 
      prev.includes(entryId) 
        ? prev.filter(id => id !== entryId)
        : [...prev, entryId]
    );
  };

  const handleSelectAll = () => {
    if (selectedEntries.length === blacklistEntries.length) {
      setSelectedEntries([]);
    } else {
      setSelectedEntries(blacklistEntries.map(entry => entry._id));
    }
  };

  const handleFormClose = () => {
    setShowForm(false);
    setEditingEntry(null);
  };

  const handleFormSuccess = () => {
    setShowForm(false);
    setEditingEntry(null);
    fetchBlacklistEntries();
  };

  const getTypeColor = (type: string) => {
    const colors = {
      temporary: 'bg-yellow-100 text-yellow-800',
      permanent: 'bg-red-100 text-red-800',
      conditional: 'bg-orange-100 text-orange-800'
    };
    return colors[type as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  const getCategoryColor = (category: string) => {
    const colors = {
      non_payment: 'bg-red-100 text-red-800',
      damage: 'bg-orange-100 text-orange-800',
      misconduct: 'bg-purple-100 text-purple-800',
      security: 'bg-red-100 text-red-800',
      policy_violation: 'bg-blue-100 text-blue-800',
      other: 'bg-gray-100 text-gray-800'
    };
    return colors[category as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  const getAppealStatusColor = (status: string) => {
    const colors = {
      none: 'bg-gray-100 text-gray-800',
      pending: 'bg-yellow-100 text-yellow-800',
      approved: 'bg-green-100 text-green-800',
      rejected: 'bg-red-100 text-red-800'
    };
    return colors[status as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  const isExpired = (expiryDate?: string) => {
    if (!expiryDate) return false;
    return new Date(expiryDate) < new Date();
  };

  if (showForm) {
    return (
      <BlacklistForm
        entry={editingEntry}
        onClose={handleFormClose}
        onSuccess={handleFormSuccess}
      />
    );
  }

  if (showAlert) {
    return (
      <BlacklistAlert
        onClose={() => setShowAlert(false)}
      />
    );
  }

  if (showStatistics) {
    return (
      <BlacklistStatistics
        onClose={() => setShowStatistics(false)}
      />
    );
  }

  if (!selectedPropertyId && viewMode === 'single') {
    return (
      <div className="p-6">
        <PropertyBreadcrumb items={['Compliance', 'Blacklist']} />
        <div className="mt-8 text-center">
          <p className="text-gray-500">Please select a property to manage blacklist</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <PropertyBreadcrumb items={['Compliance', 'Blacklist']} />

      <div className="mb-6">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Blacklist Management</h1>
            <p className="text-gray-600">Manage guest blacklist and security restrictions</p>
          </div>
          <div className="flex space-x-3">
            <button
              onClick={() => setShowStatistics(true)}
              className="flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              <ExclamationTriangleIcon className="w-4 h-4 mr-2" />
              Statistics
            </button>
            <button
              onClick={handleAutoExpire}
              className="flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              <ClockIcon className="w-4 h-4 mr-2" />
              Auto-Expire
            </button>
            <button
              onClick={handleExport}
              className="flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              <UserMinusIcon className="w-4 h-4 mr-2" />
              Export
            </button>
            <button
              onClick={handleCreate}
              className="flex items-center px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-md hover:bg-red-700"
            >
              <PlusIcon className="w-4 h-4 mr-2" />
              Add to Blacklist
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white p-4 rounded-lg shadow-sm border">
          <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Search
              </label>
              <input
                type="text"
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                placeholder="Search guests..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Type
              </label>
              <select
                value={filters.type}
                onChange={(e) => setFilters({ ...filters, type: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {types.map(type => (
                  <option key={type.value} value={type.value}>{type.label}</option>
                ))}
              </select>
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
                {categories.map(category => (
                  <option key={category.value} value={category.value}>{category.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Appeal Status
              </label>
              <select
                value={filters.appealStatus}
                onChange={(e) => setFilters({ ...filters, appealStatus: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {appealStatuses.map(status => (
                  <option key={status.value} value={status.value}>{status.label}</option>
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
                onClick={() => setFilters({ 
                  search: '', 
                  isActive: '', 
                  type: '', 
                  category: '', 
                  appealStatus: '',
                  sortBy: 'createdAt',
                  sortOrder: 'desc'
                })}
                className="w-full flex items-center justify-center px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200"
              >
                <FunnelIcon className="w-4 h-4 mr-2" />
                Clear
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Blacklist Entries Table */}
      <div className="bg-white shadow-sm rounded-lg border">
        {loading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600 mx-auto"></div>
            <p className="mt-2 text-gray-600">Loading blacklist entries...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left">
                    <input
                      type="checkbox"
                      checked={selectedEntries.length === blacklistEntries.length && blacklistEntries.length > 0}
                      onChange={handleSelectAll}
                      className="h-4 w-4 text-red-600 focus:ring-red-500 border-gray-300 rounded"
                    />
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Guest
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Reason
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Category
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Incident Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Appeal Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {blacklistEntries.map((entry) => (
                  <tr key={entry._id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={selectedEntries.includes(entry._id)}
                        onChange={() => handleSelectEntry(entry._id)}
                        className="h-4 w-4 text-red-600 focus:ring-red-500 border-gray-300 rounded"
                      />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {entry.guestId.name}
                        </div>
                        <div className="text-sm text-gray-500">
                          {entry.guestId.email}
                        </div>
                        {entry.guestId.phone && (
                          <div className="text-sm text-gray-500">
                            {entry.guestId.phone}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900 max-w-xs truncate">
                        {entry.reason}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getTypeColor(entry.type)}`}>
                        {entry.type}
                      </span>
                      {entry.type === 'temporary' && entry.expiryDate && (
                        <div className="text-xs text-gray-500 mt-1">
                          {isExpired(entry.expiryDate) ? 'Expired' : `Expires: ${new Date(entry.expiryDate).toLocaleDateString()}`}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getCategoryColor(entry.category)}`}>
                        {entry.category.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {new Date(entry.incidentDate).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getAppealStatusColor(entry.appealStatus)}`}>
                        {entry.appealStatus}
                      </span>
                      {entry.appealStatus === 'pending' && (
                        <div className="mt-1">
                          <button
                            onClick={() => handleAppealReview(entry._id, 'approved')}
                            className="text-xs text-green-600 hover:text-green-800 mr-2"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => handleAppealReview(entry._id, 'rejected')}
                            className="text-xs text-red-600 hover:text-red-800"
                          >
                            Reject
                          </button>
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex space-x-2">
                        <button aria-label="Edit"
                          onClick={() => handleEdit(entry)}
                          className="text-blue-600 hover:text-blue-900"
                        >
                          <PencilIcon className="w-4 h-4" />
                        </button>
                        <button aria-label="Delete"
                          onClick={() => handleRemove(entry._id)}
                          className="text-green-600 hover:text-green-900"
                        >
                          <UserPlusIcon className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!loading && blacklistEntries.length === 0 && (
          <div className="p-8 text-center">
            <p className="text-gray-500">No blacklist entries found</p>
            <button
              onClick={handleCreate}
              className="mt-2 text-red-600 hover:text-red-800"
            >
              Add first blacklist entry
            </button>
          </div>
        )}

        {/* Pagination */}
        {pagination.pages > 1 && (
          <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
            <div className="flex-1 flex justify-between sm:hidden">
              <button
                onClick={() => setPagination({ ...pagination, current: pagination.current - 1 })}
                disabled={pagination.current === 1}
                className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
              >
                Previous
              </button>
              <button
                onClick={() => setPagination({ ...pagination, current: pagination.current + 1 })}
                disabled={pagination.current === pagination.pages}
                className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
              >
                Next
              </button>
            </div>
            <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-gray-700">
                  Showing page <span className="font-medium">{pagination.current}</span> of{' '}
                  <span className="font-medium">{pagination.pages}</span> ({pagination.total} total entries)
                </p>
              </div>
              <div>
                <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                  <button
                    onClick={() => setPagination({ ...pagination, current: pagination.current - 1 })}
                    disabled={pagination.current === 1}
                    className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setPagination({ ...pagination, current: pagination.current + 1 })}
                    disabled={pagination.current === pagination.pages}
                    className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                  >
                    Next
                  </button>
                </nav>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default withErrorBoundary(AdminBlacklist);
