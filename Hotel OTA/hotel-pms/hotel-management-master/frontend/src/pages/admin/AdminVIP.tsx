import React, { useState, useEffect } from 'react';
import { 
  PlusIcon, 
  PencilIcon, 
  TrashIcon, 
  EyeIcon,
  FunnelIcon,
  StarIcon,
  UserGroupIcon,
  SparklesIcon,
  GiftIcon,
  UserPlusIcon,
  UserMinusIcon
} from '@heroicons/react/24/outline';
import { toast } from 'react-hot-toast';
import VIPForm from '../../components/admin/VIPForm';
import VIPStatistics from '../../components/admin/VIPStatistics';
import VIPBenefits from '../../components/admin/VIPBenefits';
import { useProperty } from '../../context/PropertyContext';
import { PropertyBreadcrumb } from '../../components/common/PropertyBreadcrumb';
import { api } from '../../services/api';
import { withErrorBoundary } from '../../components/ErrorBoundary';

interface VIPGuest {
  _id: string;
  guestId: {
    _id: string;
    name: string;
    email: string;
    phone?: string;
  };
  vipLevel: 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond';
  status: 'active' | 'inactive' | 'suspended' | 'pending';
  benefits: {
    roomUpgrade: boolean;
    lateCheckout: boolean;
    earlyCheckin: boolean;
    complimentaryBreakfast: boolean;
    spaAccess: boolean;
    conciergeService: boolean;
    priorityReservation: boolean;
    welcomeAmenities: boolean;
    airportTransfer: boolean;
    diningDiscount: number;
    spaDiscount: number;
  };
  qualificationCriteria: {
    totalStays: number;
    totalNights: number;
    totalSpent: number;
    averageRating: number;
    lastStayDate?: string;
  };
  assignedConcierge?: {
    _id: string;
    name: string;
    email: string;
  };
  specialRequests: string[];
  notes?: string;
  anniversaryDate?: string;
  expiryDate?: string;
  createdBy: {
    _id: string;
    name: string;
  };
  createdAt: string;
}

const AdminVIP: React.FC = () => {
  const { selectedPropertyId, selectedProperty, viewMode } = useProperty();
  const [vipGuests, setVipGuests] = useState<VIPGuest[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showStatistics, setShowStatistics] = useState(false);
  const [showBenefits, setShowBenefits] = useState(false);
  const [editingGuest, setEditingGuest] = useState<VIPGuest | null>(null);
  const [selectedGuests, setSelectedGuests] = useState<string[]>([]);
  const [filters, setFilters] = useState({
    search: '',
    status: '',
    vipLevel: '',
    sortBy: 'createdAt',
    sortOrder: 'desc'
  });
  const [pagination, setPagination] = useState({
    current: 1,
    pages: 1,
    total: 0
  });

  const vipLevels = [
    { value: '', label: 'All Levels' },
    { value: 'bronze', label: 'Bronze', color: 'bg-amber-100 text-amber-800' },
    { value: 'silver', label: 'Silver', color: 'bg-gray-100 text-gray-800' },
    { value: 'gold', label: 'Gold', color: 'bg-yellow-100 text-yellow-800' },
    { value: 'platinum', label: 'Platinum', color: 'bg-blue-100 text-blue-800' },
    { value: 'diamond', label: 'Diamond', color: 'bg-purple-100 text-purple-800' }
  ];

  const statuses = [
    { value: '', label: 'All Status' },
    { value: 'active', label: 'Active', color: 'bg-green-100 text-green-800' },
    { value: 'inactive', label: 'Inactive', color: 'bg-gray-100 text-gray-800' },
    { value: 'suspended', label: 'Suspended', color: 'bg-red-100 text-red-800' },
    { value: 'pending', label: 'Pending', color: 'bg-yellow-100 text-yellow-800' }
  ];

  useEffect(() => {
    if (selectedPropertyId || viewMode === 'portfolio') {
      fetchVIPGuests();
    }
  }, [filters, pagination.current, selectedPropertyId]);

  const fetchVIPGuests = async () => {
    if (!selectedPropertyId && viewMode === 'single') return;

    try {
      setLoading(true);
      const queryParams = new URLSearchParams();

      queryParams.append('page', pagination.current.toString());
      queryParams.append('limit', '20');
      if (selectedPropertyId) queryParams.append('propertyId', selectedPropertyId);

      if (filters.search) queryParams.append('search', filters.search);
      if (filters.status) queryParams.append('status', filters.status);
      if (filters.vipLevel) queryParams.append('vipLevel', filters.vipLevel);
      if (filters.sortBy) queryParams.append('sortBy', filters.sortBy);
      if (filters.sortOrder) queryParams.append('sortOrder', filters.sortOrder);

      const { data } = await api.get(`/vip?${queryParams}`);
      setVipGuests(data.data.vipGuests);
      setPagination(data.pagination);
    } catch (error) {
      toast.error('Failed to fetch VIP guests');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingGuest(null);
    setShowForm(true);
  };

  const handleEdit = (guest: VIPGuest) => {
    setEditingGuest(guest);
    setShowForm(true);
  };

  const handleRemove = async (id: string) => {
    if (!window.confirm('Are you sure you want to remove this guest from VIP program?')) {
      return;
    }

    try {
      await api.delete(`/vip/${id}`, { data: { reason: 'Manually removed by admin' } });

      toast.success('Guest removed from VIP program successfully');
      fetchVIPGuests();
    } catch (error) {
      toast.error('Failed to remove guest from VIP program');
    }
  };

  const handleAutoExpire = async () => {
    try {
      const { data } = await api.post('/vip/auto-expire');
      toast.success(data.data.message);
      fetchVIPGuests();
    } catch (error) {
      toast.error('Failed to auto-expire VIP statuses');
    }
  };

  const handleExport = async () => {
    try {
      const response = await api.get('/vip/export', { params: { format: 'csv' }, responseType: 'blob' });
      const blob = response.data;
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'vip_guests.csv';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success('VIP data exported successfully');
    } catch (error) {
      toast.error('Failed to export VIP data');
    }
  };

  const handleSelectGuest = (guestId: string) => {
    setSelectedGuests(prev => 
      prev.includes(guestId) 
        ? prev.filter(id => id !== guestId)
        : [...prev, guestId]
    );
  };

  const handleSelectAll = () => {
    if (selectedGuests.length === vipGuests.length) {
      setSelectedGuests([]);
    } else {
      setSelectedGuests(vipGuests.map(guest => guest._id));
    }
  };

  const handleFormClose = () => {
    setShowForm(false);
    setEditingGuest(null);
  };

  const handleFormSuccess = () => {
    setShowForm(false);
    setEditingGuest(null);
    fetchVIPGuests();
  };

  const getVIPLevelColor = (level: string) => {
    const levelConfig = vipLevels.find(l => l.value === level);
    return levelConfig?.color || 'bg-gray-100 text-gray-800';
  };

  const getStatusColor = (status: string) => {
    const statusConfig = statuses.find(s => s.value === status);
    return statusConfig?.color || 'bg-gray-100 text-gray-800';
  };

  const getVIPLevelIcon = (level: string) => {
    switch (level) {
      case 'bronze': return '🥉';
      case 'silver': return '🥈';
      case 'gold': return '🥇';
      case 'platinum': return '💎';
      case 'diamond': return '💠';
      default: return '⭐';
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  if (!selectedPropertyId && viewMode === 'single') {
    return (
      <div className="p-6">
        <PropertyBreadcrumb items={['VIP Management']} />
        <div className="text-center py-12">
          <SparklesIcon className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Property Selected</h3>
          <p className="text-gray-500">Please select a property to view VIP guests.</p>
        </div>
      </div>
    );
  }

  if (showForm) {
    return (
      <VIPForm
        guest={editingGuest}
        onClose={handleFormClose}
        onSuccess={handleFormSuccess}
      />
    );
  }

  if (showStatistics) {
    return (
      <VIPStatistics
        onClose={() => setShowStatistics(false)}
      />
    );
  }

  if (showBenefits) {
    return (
      <VIPBenefits
        onClose={() => setShowBenefits(false)}
      />
    );
  }

  return (
    <div className="p-6">
      <PropertyBreadcrumb items={['VIP Management']} />
      <div className="mb-6">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">VIP Guest Management</h1>
            <p className="text-gray-600">Manage VIP guests and premium services</p>
          </div>
          <div className="flex space-x-3">
            <button
              onClick={() => setShowBenefits(true)}
              className="flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              <GiftIcon className="w-4 h-4 mr-2" />
              Benefits
            </button>
            <button
              onClick={() => setShowStatistics(true)}
              className="flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              <SparklesIcon className="w-4 h-4 mr-2" />
              Statistics
            </button>
            <button
              onClick={handleAutoExpire}
              className="flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              <UserMinusIcon className="w-4 h-4 mr-2" />
              Auto-Expire
            </button>
            <button
              onClick={handleExport}
              className="flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              <UserGroupIcon className="w-4 h-4 mr-2" />
              Export
            </button>
            <button
              onClick={handleCreate}
              className="flex items-center px-4 py-2 text-sm font-medium text-white bg-purple-600 border border-transparent rounded-md hover:bg-purple-700"
            >
              <PlusIcon className="w-4 h-4 mr-2" />
              Add VIP Guest
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
                placeholder="Search VIP guests..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                VIP Level
              </label>
              <select
                value={filters.vipLevel}
                onChange={(e) => setFilters({ ...filters, vipLevel: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                {vipLevels.map(level => (
                  <option key={level.value} value={level.value}>{level.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Status
              </label>
              <select
                value={filters.status}
                onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                {statuses.map(status => (
                  <option key={status.value} value={status.value}>{status.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Sort By
              </label>
              <select
                value={filters.sortBy}
                onChange={(e) => setFilters({ ...filters, sortBy: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="createdAt">Created Date</option>
                <option value="vipLevel">VIP Level</option>
                <option value="qualificationCriteria.totalSpent">Total Spent</option>
                <option value="qualificationCriteria.totalStays">Total Stays</option>
              </select>
            </div>
            <div className="flex items-end">
              <button
                onClick={() => setFilters({ 
                  search: '', 
                  status: '', 
                  vipLevel: '',
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

      {/* VIP Guests Table */}
      <div className="bg-white shadow-sm rounded-lg border">
        {loading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto"></div>
            <p className="mt-2 text-gray-600">Loading VIP guests...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left">
                    <input
                      type="checkbox"
                      checked={selectedGuests.length === vipGuests.length && vipGuests.length > 0}
                      onChange={handleSelectAll}
                      className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
                    />
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Guest
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    VIP Level
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Qualification
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Concierge
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {vipGuests.map((guest) => (
                  <tr key={guest._id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={selectedGuests.includes(guest._id)}
                        onChange={() => handleSelectGuest(guest._id)}
                        className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
                      />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {guest.guestId.name}
                        </div>
                        <div className="text-sm text-gray-500">
                          {guest.guestId.email}
                        </div>
                        {guest.guestId.phone && (
                          <div className="text-sm text-gray-500">
                            {guest.guestId.phone}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <span className="text-lg mr-2">{getVIPLevelIcon(guest.vipLevel)}</span>
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getVIPLevelColor(guest.vipLevel)}`}>
                          {guest.vipLevel.toUpperCase()}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(guest.status)}`}>
                        {guest.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <div>
                        <div>{guest.qualificationCriteria.totalStays} stays</div>
                        <div>{formatCurrency(guest.qualificationCriteria.totalSpent)}</div>
                        <div className="flex items-center">
                          <StarIcon className="w-3 h-3 text-yellow-400 mr-1" />
                          {guest.qualificationCriteria.averageRating.toFixed(1)}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {guest.assignedConcierge ? (
                        <div>
                          <div className="font-medium">{guest.assignedConcierge.name}</div>
                          <div className="text-gray-500">{guest.assignedConcierge.email}</div>
                        </div>
                      ) : (
                        <span className="text-gray-400">Not assigned</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex space-x-2">
                        <button aria-label="Edit"
                          onClick={() => handleEdit(guest)}
                          className="text-blue-600 hover:text-blue-900"
                        >
                          <PencilIcon className="w-4 h-4" />
                        </button>
                        <button aria-label="Delete"
                          onClick={() => handleRemove(guest._id)}
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

        {!loading && vipGuests.length === 0 && (
          <div className="p-8 text-center">
            <SparklesIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">No VIP guests found</p>
            <button
              onClick={handleCreate}
              className="mt-2 text-purple-600 hover:text-purple-800"
            >
              Add first VIP guest
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
                  <span className="font-medium">{pagination.pages}</span> ({pagination.total} total VIP guests)
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

export default withErrorBoundary(AdminVIP);
