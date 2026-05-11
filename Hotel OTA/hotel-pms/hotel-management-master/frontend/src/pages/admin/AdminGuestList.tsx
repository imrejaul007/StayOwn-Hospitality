import React, { useState, useEffect } from 'react';
import { withErrorBoundary } from '../../components/ErrorBoundary';
import {
  PlusIcon,
  PencilIcon,
  TrashIcon,
  EyeIcon,
  FunnelIcon,
  MagnifyingGlassIcon,
  ArrowDownTrayIcon,
  ChartBarIcon,
  UserGroupIcon
} from '@heroicons/react/24/outline';
import { toast } from 'react-hot-toast';
import { useProperty } from '../../context/PropertyContext';
import { PropertyBreadcrumb } from '../../components/common/PropertyBreadcrumb';
import GuestForm from '../../components/admin/GuestForm';
import GuestAdvancedSearch from '../../components/admin/GuestAdvancedSearch';
import GuestBulkOperations from '../../components/admin/GuestBulkOperations';
import GuestAnalytics from '../../components/admin/GuestAnalytics';
import { api } from '../../services/api';
import EmptyState from '../../components/ui/EmptyState';

interface Guest {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  salutationId?: {
    _id: string;
    title: string;
    fullForm?: string;
  };
  loyalty: {
    tier: string;
    points: number;
  };
  guestType: string;
  stats: {
    bookings: {
      totalBookings: number;
      totalSpent: number;
      lastStay?: string;
    };
    reviews: {
      totalReviews: number;
      averageRating: number;
    };
  };
  createdAt: string;
}

const getLoyaltyTierColor = (tier: string) => {
  const colors: Record<string, string> = {
    bronze: 'bg-orange-100 text-orange-800',
    silver: 'bg-gray-100 text-gray-800',
    gold: 'bg-yellow-100 text-yellow-800',
    platinum: 'bg-purple-100 text-purple-800'
  };
  return colors[tier] || 'bg-gray-100 text-gray-800';
};

const getGuestTypeColor = (type: string) => {
  const colors: Record<string, string> = {
    normal: 'bg-blue-100 text-blue-800',
    corporate: 'bg-green-100 text-green-800'
  };
  return colors[type] || 'bg-gray-100 text-gray-800';
};

const GuestRow = React.memo(({ guest, isSelected, onSelect, onEdit, onDelete }: {
  guest: Guest;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onEdit: (guest: Guest) => void;
  onDelete: (id: string) => void;
}) => (
  <tr className="hover:bg-gray-50">
    <td className="px-6 py-4 whitespace-nowrap">
      <input
        type="checkbox"
        checked={isSelected}
        onChange={() => onSelect(guest._id)}
        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
      />
    </td>
    <td className="px-6 py-4 whitespace-nowrap">
      <div className="flex items-center">
        <div className="flex-shrink-0 h-10 w-10">
          <div className="h-10 w-10 rounded-full bg-gray-300 flex items-center justify-center">
            <UserGroupIcon className="h-6 w-6 text-gray-600" />
          </div>
        </div>
        <div className="ml-4">
          <div className="text-sm font-medium text-gray-900">
            {guest.salutationId?.title && `${guest.salutationId.title} `}{guest.name}
          </div>
          <div className="text-sm text-gray-500">
            ID: {guest._id.slice(-8)}
          </div>
        </div>
      </div>
    </td>
    <td className="px-6 py-4 whitespace-nowrap">
      <div className="text-sm text-gray-900">{guest.email}</div>
      <div className="text-sm text-gray-500">{guest.phone || 'No phone'}</div>
    </td>
    <td className="px-6 py-4 whitespace-nowrap">
      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getLoyaltyTierColor(guest.loyalty.tier)}`}>
        {guest.loyalty.tier}
      </span>
      <div className="text-xs text-gray-500">
        {guest.loyalty.points} points
      </div>
    </td>
    <td className="px-6 py-4 whitespace-nowrap">
      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getGuestTypeColor(guest.guestType)}`}>
        {guest.guestType}
      </span>
    </td>
    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
      <div>{guest.stats.bookings.totalBookings} bookings</div>
      <div className="text-xs text-gray-500">
        ${guest.stats.bookings.totalSpent?.toFixed(2) || '0.00'} spent
      </div>
    </td>
    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
      <div>{guest.stats.reviews.totalReviews} reviews</div>
      <div className="text-xs text-gray-500">
        {guest.stats.reviews.averageRating?.toFixed(1) || '0.0'} avg rating
      </div>
    </td>
    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
      <div className="flex space-x-2">
        <button aria-label="Edit"
          onClick={() => onEdit(guest)}
          className="text-blue-600 hover:text-blue-900"
        >
          <PencilIcon className="w-4 h-4" />
        </button>
        <button aria-label="Delete"
          onClick={() => onDelete(guest._id)}
          className="text-red-600 hover:text-red-900"
        >
          <TrashIcon className="w-4 h-4" />
        </button>
      </div>
    </td>
  </tr>
));
GuestRow.displayName = 'GuestRow';

const AdminGuestList: React.FC = () => {
  const { selectedPropertyId, selectedProperty, viewMode } = useProperty();
  const [guests, setGuests] = useState<Guest[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [showBulkOps, setShowBulkOps] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [editingGuest, setEditingGuest] = useState<Guest | null>(null);
  const [selectedGuests, setSelectedGuests] = useState<string[]>([]);
  const [filters, setFilters] = useState({
    search: '',
    loyaltyTier: '',
    guestType: '',
    hasBookings: '',
    hasReviews: '',
    sortBy: 'createdAt',
    sortOrder: 'desc'
  });
  const [pagination, setPagination] = useState({
    current: 1,
    pages: 1,
    total: 0
  });

  const loyaltyTiers = [
    { value: '', label: 'All Tiers' },
    { value: 'bronze', label: 'Bronze' },
    { value: 'silver', label: 'Silver' },
    { value: 'gold', label: 'Gold' },
    { value: 'platinum', label: 'Platinum' }
  ];

  const guestTypes = [
    { value: '', label: 'All Types' },
    { value: 'normal', label: 'Normal' },
    { value: 'corporate', label: 'Corporate' }
  ];

  const bookingOptions = [
    { value: '', label: 'All Guests' },
    { value: 'true', label: 'Has Bookings' },
    { value: 'false', label: 'No Bookings' }
  ];

  const reviewOptions = [
    { value: '', label: 'All Guests' },
    { value: 'true', label: 'Has Reviews' },
    { value: 'false', label: 'No Reviews' }
  ];

  const sortOptions = [
    { value: 'createdAt', label: 'Registration Date' },
    { value: 'name', label: 'Name' },
    { value: 'email', label: 'Email' },
    { value: 'loyalty.tier', label: 'Loyalty Tier' }
  ];

  useEffect(() => {
    if (selectedPropertyId) {
      fetchGuests();
    }
  }, [filters, pagination.current, selectedPropertyId]);

  const fetchGuests = async () => {
    if (!selectedPropertyId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const queryParams = new URLSearchParams();

      queryParams.append('page', pagination.current.toString());
      queryParams.append('limit', '20');
      queryParams.append('hotelId', selectedPropertyId);

      if (filters.search) queryParams.append('search', filters.search);
      if (filters.loyaltyTier) queryParams.append('loyaltyTier', filters.loyaltyTier);
      if (filters.guestType) queryParams.append('guestType', filters.guestType);
      if (filters.hasBookings) queryParams.append('hasBookings', filters.hasBookings);
      if (filters.hasReviews) queryParams.append('hasReviews', filters.hasReviews);
      if (filters.sortBy) queryParams.append('sortBy', filters.sortBy);
      if (filters.sortOrder) queryParams.append('sortOrder', filters.sortOrder);

      const { data } = await api.get(`/guests?${queryParams}`);
      setGuests(data.data.guests);
      setPagination(data.pagination);
    } catch (error) {
      toast.error('Failed to fetch guests');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingGuest(null);
    setShowForm(true);
  };

  const handleEdit = (guest: Guest) => {
    setEditingGuest(guest);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this guest?')) {
      return;
    }

    try {
      await api.delete(`/guests/${id}`);

      toast.success('Guest deleted successfully');
      fetchGuests();
    } catch (error) {
      toast.error('Failed to delete guest');
    }
  };

  const handleExport = async () => {
    try {
      const queryParams = new URLSearchParams();
      queryParams.append('format', 'csv');
      
      if (filters.loyaltyTier) queryParams.append('loyaltyTier', filters.loyaltyTier);
      if (filters.guestType) queryParams.append('guestType', filters.guestType);

      const response = await api.get(`/guests/export?${queryParams}`, { responseType: 'blob' });
      const blob = response.data;
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'guests.csv';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success('Guests exported successfully');
    } catch (error) {
      toast.error('Failed to export guests');
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
    if (selectedGuests.length === guests.length) {
      setSelectedGuests([]);
    } else {
      setSelectedGuests(guests.map(guest => guest._id));
    }
  };

  const handleFormClose = () => {
    setShowForm(false);
    setEditingGuest(null);
  };

  const handleFormSuccess = () => {
    setShowForm(false);
    setEditingGuest(null);
    fetchGuests();
  };

  // getLoyaltyTierColor and getGuestTypeColor moved outside component for GuestRow memo

  if (showForm) {
    return (
      <GuestForm
        guest={editingGuest}
        onClose={handleFormClose}
        onSuccess={handleFormSuccess}
      />
    );
  }

  if (showSearch) {
    return (
      <GuestAdvancedSearch
        onClose={() => setShowSearch(false)}
        onSearch={(results) => {
          setGuests(results);
          setShowSearch(false);
        }}
      />
    );
  }

  if (showBulkOps) {
    return (
      <GuestBulkOperations
        selectedGuests={selectedGuests}
        onClose={() => setShowBulkOps(false)}
        onSuccess={() => {
          setSelectedGuests([]);
          setShowBulkOps(false);
          fetchGuests();
        }}
      />
    );
  }

  if (showAnalytics) {
    return (
      <GuestAnalytics
        onClose={() => setShowAnalytics(false)}
      />
    );
  }

  return (
    <div className="p-6">
      <PropertyBreadcrumb items={['Guests']} />

      <div className="mb-6">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Guest Management</h1>
            <p className="text-gray-600">Manage hotel guests and their information</p>
          </div>
          <div className="flex space-x-3">
            <button
              onClick={() => setShowAnalytics(true)}
              className="flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              <ChartBarIcon className="w-4 h-4 mr-2" />
              Analytics
            </button>
            <button
              onClick={handleExport}
              className="flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              <ArrowDownTrayIcon className="w-4 h-4 mr-2" />
              Export
            </button>
            <button
              onClick={() => setShowSearch(true)}
              className="flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              <MagnifyingGlassIcon className="w-4 h-4 mr-2" />
              Advanced Search
            </button>
            <button
              onClick={handleCreate}
              className="flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700"
            >
              <PlusIcon className="w-4 h-4 mr-2" />
              Add Guest
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
                Loyalty Tier
              </label>
              <select
                value={filters.loyaltyTier}
                onChange={(e) => setFilters({ ...filters, loyaltyTier: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {loyaltyTiers.map(tier => (
                  <option key={tier.value} value={tier.value}>{tier.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Guest Type
              </label>
              <select
                value={filters.guestType}
                onChange={(e) => setFilters({ ...filters, guestType: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {guestTypes.map(type => (
                  <option key={type.value} value={type.value}>{type.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Bookings
              </label>
              <select
                value={filters.hasBookings}
                onChange={(e) => setFilters({ ...filters, hasBookings: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {bookingOptions.map(option => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Reviews
              </label>
              <select
                value={filters.hasReviews}
                onChange={(e) => setFilters({ ...filters, hasReviews: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {reviewOptions.map(option => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
            <div className="flex items-end">
              <button
                onClick={() => setFilters({ 
                  search: '', 
                  loyaltyTier: '', 
                  guestType: '', 
                  hasBookings: '', 
                  hasReviews: '',
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

      {/* Bulk Operations Bar */}
      {selectedGuests.length > 0 && (
        <div className="mb-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-blue-800">
              {selectedGuests.length} guest(s) selected
            </span>
            <div className="flex space-x-2">
              <button
                onClick={() => setShowBulkOps(true)}
                className="px-3 py-1 text-sm font-medium text-blue-700 bg-blue-100 rounded-md hover:bg-blue-200"
              >
                Bulk Operations
              </button>
              <button
                onClick={() => setSelectedGuests([])}
                className="px-3 py-1 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
              >
                Clear Selection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Guests Table */}
      <div className="bg-white shadow-sm rounded-lg border">
        {loading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-2 text-gray-600">Loading guests...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left">
                    <input
                      type="checkbox"
                      checked={selectedGuests.length === guests.length && guests.length > 0}
                      onChange={handleSelectAll}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Guest
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Contact
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Loyalty
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Bookings
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Reviews
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {guests.map((guest) => (
                  <GuestRow
                    key={guest._id}
                    guest={guest}
                    isSelected={selectedGuests.includes(guest._id)}
                    onSelect={handleSelectGuest}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!loading && guests.length === 0 && (
          <EmptyState
            title="No guests found"
            description="No guests match your current filters. Try adjusting your search criteria or add a new guest."
            icon={<UserGroupIcon className="w-16 h-16" />}
            action={{ label: 'Add Guest', onClick: handleCreate }}
          />
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
                  <span className="font-medium">{pagination.pages}</span> ({pagination.total} total guests)
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

export default withErrorBoundary(AdminGuestList);
