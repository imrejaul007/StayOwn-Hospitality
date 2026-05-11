import React, { useState, useEffect } from 'react';
import { XMarkIcon, UserMinusIcon } from '@heroicons/react/24/outline';
import { toast } from 'react-hot-toast';
import { api } from '../../services/api';

interface BlacklistEntry {
  _id: string;
  guestId: {
    _id: string;
    name: string;
    email: string;
  };
  reason: string;
  type: 'temporary' | 'permanent' | 'conditional';
  category: 'non_payment' | 'damage' | 'misconduct' | 'security' | 'policy_violation' | 'other';
  description: string;
  incidentDate: string;
  expiryDate?: string;
  conditions?: string;
  isActive: boolean;
}

interface BlacklistFormProps {
  entry?: BlacklistEntry | null;
  onClose: () => void;
  onSuccess: () => void;
}

const BlacklistForm: React.FC<BlacklistFormProps> = ({
  entry,
  onClose,
  onSuccess
}) => {
  const [formData, setFormData] = useState({
    guestId: '',
    reason: '',
    type: 'temporary' as const,
    category: 'other' as const,
    description: '',
    incidentDate: '',
    expiryDate: '',
    conditions: ''
  });
  const [loading, setLoading] = useState(false);
  const [guestSearch, setGuestSearch] = useState('');
  const [guestSuggestions, setGuestSuggestions] = useState<unknown[]>([]);
  const [selectedGuest, setSelectedGuest] = useState<unknown>(null);

  const types = [
    { value: 'temporary', label: 'Temporary' },
    { value: 'permanent', label: 'Permanent' },
    { value: 'conditional', label: 'Conditional' }
  ];

  const categories = [
    { value: 'non_payment', label: 'Non-Payment' },
    { value: 'damage', label: 'Damage' },
    { value: 'misconduct', label: 'Misconduct' },
    { value: 'security', label: 'Security' },
    { value: 'policy_violation', label: 'Policy Violation' },
    { value: 'other', label: 'Other' }
  ];

  useEffect(() => {
    if (entry) {
      setFormData({
        guestId: entry.guestId._id,
        reason: entry.reason,
        type: entry.type,
        category: entry.category,
        description: entry.description,
        incidentDate: entry.incidentDate.split('T')[0],
        expiryDate: entry.expiryDate ? entry.expiryDate.split('T')[0] : '',
        conditions: entry.conditions || ''
      });
      setSelectedGuest(entry.guestId);
    }
  }, [entry]);

  useEffect(() => {
    if (guestSearch.length >= 2) {
      searchGuests();
    } else {
      setGuestSuggestions([]);
    }
  }, [guestSearch]);

  const searchGuests = async () => {
    try {
      const { data } = await api.get('/guests', { params: { search: guestSearch, limit: 10 } });
      setGuestSuggestions(data.data.guests);
    } catch {
      // Error handled silently
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.guestId || !formData.reason || !formData.description || !formData.incidentDate) {
      toast.error('Please fill in all required fields');
      return;
    }

    if (formData.type === 'temporary' && !formData.expiryDate) {
      toast.error('Expiry date is required for temporary blacklists');
      return;
    }

    if (formData.type === 'conditional' && !formData.conditions) {
      toast.error('Conditions are required for conditional blacklists');
      return;
    }

    setLoading(true);

    try {
      if (entry) {
        await api.patch(`/blacklist/${entry._id}`, formData);
      } else {
        await api.post('/blacklist', formData);
      }

      toast.success(entry ? 'Blacklist entry updated successfully' : 'Guest added to blacklist successfully');
      onSuccess();
    } catch (error: unknown) {
      toast.error(error.response?.data?.message || 'Failed to save blacklist entry');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleGuestSelect = (guest: Record<string, unknown>) => {
    setSelectedGuest(guest);
    setFormData(prev => ({
      ...prev,
      guestId: guest._id
    }));
    setGuestSearch(guest.name);
    setGuestSuggestions([]);
  };

  const handleGuestSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setGuestSearch(e.target.value);
    if (!e.target.value) {
      setSelectedGuest(null);
      setFormData(prev => ({
        ...prev,
        guestId: ''
      }));
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-10 mx-auto p-5 border w-11/12 md:w-2/3 lg:w-1/2 shadow-lg rounded-md bg-white">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center">
            <UserMinusIcon className="w-6 h-6 text-red-600 mr-2" />
            <h3 className="text-lg font-medium text-gray-900">
              {entry ? 'Edit Blacklist Entry' : 'Add Guest to Blacklist'}
            </h3>
          </div>
          <button aria-label="Close"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Guest Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Guest *
            </label>
            <div className="relative">
              <input
                type="text"
                value={guestSearch}
                onChange={handleGuestSearchChange}
                placeholder="Search for guest by name or email..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                required
              />
              {guestSuggestions.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                  {guestSuggestions.map((guest) => (
                    <div role="button" tabIndex={0}
                      key={guest._id}
                      onClick={() => handleGuestSelect(guest)}
                      className="px-4 py-2 hover:bg-gray-100 cursor-pointer border-b border-gray-200 last:border-b-0"
                     onKeyDown={(e: React.KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); const clickHandler = () => handleGuestSelect(guest); if (typeof clickHandler === 'function') { clickHandler(e as any); } } }}>
                      <div className="font-medium text-gray-900">{guest.name}</div>
                      <div className="text-sm text-gray-500">{guest.email}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {selectedGuest && (
              <div className="mt-2 p-2 bg-gray-50 rounded-md">
                <div className="text-sm font-medium text-gray-900">Selected: {selectedGuest.name}</div>
                <div className="text-sm text-gray-500">{selectedGuest.email}</div>
              </div>
            )}
          </div>

          {/* Basic Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Blacklist Type *
              </label>
              <select
                name="type"
                value={formData.type}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                required
              >
                {types.map(type => (
                  <option key={type.value} value={type.value}>{type.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Category *
              </label>
              <select
                name="category"
                value={formData.category}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                required
              >
                {categories.map(category => (
                  <option key={category.value} value={category.value}>{category.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Reason *
            </label>
            <input
              type="text"
              name="reason"
              value={formData.reason}
              onChange={handleInputChange}
              placeholder="Brief reason for blacklisting"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description *
            </label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              rows={4}
              placeholder="Detailed description of the incident..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Incident Date *
            </label>
            <input
              type="date"
              name="incidentDate"
              value={formData.incidentDate}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
              required
            />
          </div>

          {/* Conditional Fields */}
          {formData.type === 'temporary' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Expiry Date *
              </label>
              <input
                type="date"
                name="expiryDate"
                value={formData.expiryDate}
                onChange={handleInputChange}
                min={formData.incidentDate}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                required
              />
            </div>
          )}

          {formData.type === 'conditional' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Conditions *
              </label>
              <textarea
                name="conditions"
                value={formData.conditions}
                onChange={handleInputChange}
                rows={3}
                placeholder="Specify the conditions for this blacklist..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                required
              />
            </div>
          )}

          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Cancel
            </button>
            <button aria-label="Add"
              type="submit"
              disabled={loading}
              className="px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-md hover:bg-red-700 disabled:opacity-50"
            >
              {loading ? 'Saving...' : (entry ? 'Update' : 'Add to Blacklist')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default BlacklistForm;
