import React, { useState } from 'react';
import { XMarkIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { toast } from 'react-hot-toast';
import { api } from '../../services/api';

interface GuestAdvancedSearchProps {
  onClose: () => void;
  onSearch: (results: unknown[]) => void;
}

const GuestAdvancedSearch: React.FC<GuestAdvancedSearchProps> = ({
  onClose,
  onSearch
}) => {
  const [searchCriteria, setSearchCriteria] = useState({
    text: '',
    loyaltyTier: '',
    guestType: '',
    hasBookings: '',
    hasReviews: '',
    lastStayDate: '',
    registrationDateRange: {
      from: '',
      to: ''
    },
    totalSpentRange: {
      min: '',
      max: ''
    },
    averageRatingRange: {
      min: '',
      max: ''
    }
  });
  const [loading, setLoading] = useState(false);

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

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    
    if (name.includes('.')) {
      const [parent, child] = name.split('.');
      setSearchCriteria(prev => ({
        ...prev,
        [parent]: {
          ...prev[parent as keyof typeof prev],
          [child]: value
        }
      }));
    } else {
      setSearchCriteria(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data } = await api.post('/guests/search', {
        query: searchCriteria.text,
        filters: {
          loyaltyTier: searchCriteria.loyaltyTier || undefined,
          guestType: searchCriteria.guestType || undefined,
          hasBookings: searchCriteria.hasBookings ? searchCriteria.hasBookings === 'true' : undefined,
          hasReviews: searchCriteria.hasReviews ? searchCriteria.hasReviews === 'true' : undefined,
          lastStayDate: searchCriteria.lastStayDate || undefined,
          registrationDateRange: searchCriteria.registrationDateRange.from || searchCriteria.registrationDateRange.to ? searchCriteria.registrationDateRange : undefined,
          totalSpentRange: searchCriteria.totalSpentRange.min || searchCriteria.totalSpentRange.max ? searchCriteria.totalSpentRange : undefined,
          averageRatingRange: searchCriteria.averageRatingRange.min || searchCriteria.averageRatingRange.max ? searchCriteria.averageRatingRange : undefined
        }
      });
      onSearch(data.data.guests);
    } catch (error) {
      toast.error('Failed to search guests');
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setSearchCriteria({
      text: '',
      loyaltyTier: '',
      guestType: '',
      hasBookings: '',
      hasReviews: '',
      lastStayDate: '',
      registrationDateRange: {
        from: '',
        to: ''
      },
      totalSpentRange: {
        min: '',
        max: ''
      },
      averageRatingRange: {
        min: '',
        max: ''
      }
    });
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-10 mx-auto p-5 border w-11/12 md:w-4/5 lg:w-3/4 shadow-lg rounded-md bg-white">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center">
            <MagnifyingGlassIcon className="w-6 h-6 text-blue-600 mr-2" />
            <h3 className="text-lg font-medium text-gray-900">Advanced Guest Search</h3>
          </div>
          <button aria-label="Close"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSearch} className="space-y-6">
          {/* Basic Search */}
          <div className="border-b border-gray-200 pb-6">
            <h4 className="text-md font-medium text-gray-900 mb-4">Basic Search</h4>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Search Text
              </label>
              <input
                type="text"
                name="text"
                value={searchCriteria.text}
                onChange={handleInputChange}
                placeholder="Search by name, email, or phone..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Filters */}
          <div className="border-b border-gray-200 pb-6">
            <h4 className="text-md font-medium text-gray-900 mb-4">Filters</h4>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Loyalty Tier
                </label>
                <select
                  name="loyaltyTier"
                  value={searchCriteria.loyaltyTier}
                  onChange={handleInputChange}
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
                  name="guestType"
                  value={searchCriteria.guestType}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {guestTypes.map(type => (
                    <option key={type.value} value={type.value}>{type.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Last Stay Date
                </label>
                <input
                  type="date"
                  name="lastStayDate"
                  value={searchCriteria.lastStayDate}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Has Bookings
                </label>
                <select
                  name="hasBookings"
                  value={searchCriteria.hasBookings}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {bookingOptions.map(option => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Has Reviews
                </label>
                <select
                  name="hasReviews"
                  value={searchCriteria.hasReviews}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {reviewOptions.map(option => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Date Ranges */}
          <div className="border-b border-gray-200 pb-6">
            <h4 className="text-md font-medium text-gray-900 mb-4">Date Ranges</h4>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Registration Date From
                </label>
                <input
                  type="date"
                  name="registrationDateRange.from"
                  value={searchCriteria.registrationDateRange.from}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Registration Date To
                </label>
                <input
                  type="date"
                  name="registrationDateRange.to"
                  value={searchCriteria.registrationDateRange.to}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Financial Ranges */}
          <div className="border-b border-gray-200 pb-6">
            <h4 className="text-md font-medium text-gray-900 mb-4">Financial Ranges</h4>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Total Spent (Min)
                </label>
                <input
                  type="number"
                  name="totalSpentRange.min"
                  value={searchCriteria.totalSpentRange.min}
                  onChange={handleInputChange}
                  placeholder="0"
                  min="0"
                  step="0.01"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Total Spent (Max)
                </label>
                <input
                  type="number"
                  name="totalSpentRange.max"
                  value={searchCriteria.totalSpentRange.max}
                  onChange={handleInputChange}
                  placeholder="No limit"
                  min="0"
                  step="0.01"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Rating Ranges */}
          <div>
            <h4 className="text-md font-medium text-gray-900 mb-4">Rating Ranges</h4>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Average Rating (Min)
                </label>
                <input
                  type="number"
                  name="averageRatingRange.min"
                  value={searchCriteria.averageRatingRange.min}
                  onChange={handleInputChange}
                  placeholder="0"
                  min="0"
                  max="5"
                  step="0.1"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Average Rating (Max)
                </label>
                <input
                  type="number"
                  name="averageRatingRange.max"
                  value={searchCriteria.averageRatingRange.max}
                  onChange={handleInputChange}
                  placeholder="5"
                  min="0"
                  max="5"
                  step="0.1"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={handleClear}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Clear All
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Cancel
            </button>
            <button aria-label="Search"
              type="submit"
              disabled={loading}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Searching...' : 'Search'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default GuestAdvancedSearch;
