import React, { useState, useEffect } from 'react';
import { XMarkIcon, SparklesIcon as CrownIcon, StarIcon } from '@heroicons/react/24/outline';
import { toast } from 'react-hot-toast';
import { api } from '../../services/api';

interface VIPGuest {
  _id: string;
  guestId: {
    _id: string;
    name: string;
    email: string;
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
  assignedConcierge?: string;
  specialRequests: string[];
  notes?: string;
  anniversaryDate?: string;
  expiryDate?: string;
}

interface VIPFormProps {
  guest?: VIPGuest | null;
  onClose: () => void;
  onSuccess: () => void;
}

const VIPForm: React.FC<VIPFormProps> = ({
  guest,
  onClose,
  onSuccess
}) => {
  const [formData, setFormData] = useState({
    guestId: '',
    vipLevel: 'bronze' as const,
    status: 'active' as const,
    benefits: {
      roomUpgrade: false,
      lateCheckout: false,
      earlyCheckin: false,
      complimentaryBreakfast: false,
      spaAccess: false,
      conciergeService: false,
      priorityReservation: false,
      welcomeAmenities: false,
      airportTransfer: false,
      diningDiscount: 0,
      spaDiscount: 0
    },
    qualificationCriteria: {
      totalStays: 0,
      totalNights: 0,
      totalSpent: 0,
      averageRating: 0,
      lastStayDate: ''
    },
    assignedConcierge: '',
    specialRequests: [] as string[],
    notes: '',
    anniversaryDate: '',
    expiryDate: ''
  });
  const [loading, setLoading] = useState(false);
  const [guestSearch, setGuestSearch] = useState('');
  const [guestSuggestions, setGuestSuggestions] = useState<unknown[]>([]);
  const [selectedGuest, setSelectedGuest] = useState<unknown>(null);
  const [conciergeStaff, setConciergeStaff] = useState<unknown[]>([]);
  const [newSpecialRequest, setNewSpecialRequest] = useState('');

  const vipLevels = [
    { value: 'bronze', label: 'Bronze', icon: '🥉', color: 'bg-amber-100 text-amber-800' },
    { value: 'silver', label: 'Silver', icon: '🥈', color: 'bg-gray-100 text-gray-800' },
    { value: 'gold', label: 'Gold', icon: '🥇', color: 'bg-yellow-100 text-yellow-800' },
    { value: 'platinum', label: 'Platinum', icon: '💎', color: 'bg-blue-100 text-blue-800' },
    { value: 'diamond', label: 'Diamond', icon: '💠', color: 'bg-purple-100 text-purple-800' }
  ];

  const statuses = [
    { value: 'active', label: 'Active', color: 'bg-green-100 text-green-800' },
    { value: 'inactive', label: 'Inactive', color: 'bg-gray-100 text-gray-800' },
    { value: 'suspended', label: 'Suspended', color: 'bg-red-100 text-red-800' },
    { value: 'pending', label: 'Pending', color: 'bg-yellow-100 text-yellow-800' }
  ];

  useEffect(() => {
    if (guest) {
      setFormData({
        guestId: guest.guestId._id,
        vipLevel: guest.vipLevel,
        status: guest.status,
        benefits: guest.benefits,
        qualificationCriteria: {
          ...guest.qualificationCriteria,
          lastStayDate: guest.qualificationCriteria.lastStayDate ? guest.qualificationCriteria.lastStayDate.split('T')[0] : ''
        },
        assignedConcierge: guest.assignedConcierge || '',
        specialRequests: guest.specialRequests,
        notes: guest.notes || '',
        anniversaryDate: guest.anniversaryDate ? guest.anniversaryDate.split('T')[0] : '',
        expiryDate: guest.expiryDate ? guest.expiryDate.split('T')[0] : ''
      });
      setSelectedGuest(guest.guestId);
    }
    fetchConciergeStaff();
  }, [guest]);

  useEffect(() => {
    if (guestSearch.length >= 2) {
      searchGuests();
    } else {
      setGuestSuggestions([]);
    }
  }, [guestSearch]);

  const fetchConciergeStaff = async () => {
    try {
      const { data: data } = await api.get('/vip/concierge-staff');
      setConciergeStaff(data.data.conciergeStaff);
    } catch {
      // Error handled silently
    }
  };

  const searchGuests = async () => {
    try {
      const { data } = await api.get(`/guests?search=${encodeURIComponent(guestSearch)}&limit=10`);
      setGuestSuggestions(data.data.guests);
    } catch {
      // Error handled silently
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.guestId) {
      toast.error('Please select a guest');
      return;
    }

    setLoading(true);

    try {
      if (guest) {
        await api.patch(`/vip/${guest._id}`, formData);
      } else {
        await api.post('/vip', formData);
      }

      toast.success(guest ? 'VIP guest updated successfully' : 'Guest added to VIP program successfully');
      onSuccess();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save VIP guest');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    
    if (name.startsWith('benefits.')) {
      const benefitName = name.split('.')[1];
      setFormData(prev => ({
        ...prev,
        benefits: {
          ...prev.benefits,
          [benefitName]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : parseInt(value) || 0
        }
      }));
    } else if (name.startsWith('qualificationCriteria.')) {
      const criteriaName = name.split('.')[1];
      setFormData(prev => ({
        ...prev,
        qualificationCriteria: {
          ...prev.qualificationCriteria,
          [criteriaName]: type === 'number' ? parseFloat(value) || 0 : value
        }
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
    }
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

  const handleAddSpecialRequest = () => {
    if (newSpecialRequest.trim()) {
      setFormData(prev => ({
        ...prev,
        specialRequests: [...prev.specialRequests, newSpecialRequest.trim()]
      }));
      setNewSpecialRequest('');
    }
  };

  const handleRemoveSpecialRequest = (index: number) => {
    setFormData(prev => ({
      ...prev,
      specialRequests: prev.specialRequests.filter((_, i) => i !== index)
    }));
  };

  const getVIPLevelRequirements = () => {
    const requirements = {
      bronze: { totalSpent: 2000, totalStays: 2, averageRating: 0 },
      silver: { totalSpent: 5000, totalStays: 5, averageRating: 3.0 },
      gold: { totalSpent: 10000, totalStays: 10, averageRating: 3.5 },
      platinum: { totalSpent: 25000, totalStays: 15, averageRating: 4.0 },
      diamond: { totalSpent: 50000, totalStays: 20, averageRating: 4.5 }
    };
    return requirements[formData.vipLevel];
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-10 mx-auto p-5 border w-11/12 md:w-4/5 lg:w-3/4 shadow-lg rounded-md bg-white">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center">
            <CrownIcon className="w-6 h-6 text-purple-600 mr-2" />
            <h3 className="text-lg font-medium text-gray-900">
              {guest ? 'Edit VIP Guest' : 'Add Guest to VIP Program'}
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
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
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

          {/* VIP Level and Status */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                VIP Level *
              </label>
              <select
                name="vipLevel"
                value={formData.vipLevel}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                required
              >
                {vipLevels.map(level => (
                  <option key={level.value} value={level.value}>
                    {level.icon} {level.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Status *
              </label>
              <select
                name="status"
                value={formData.status}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                required
              >
                {statuses.map(status => (
                  <option key={status.value} value={status.value}>{status.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* VIP Level Requirements */}
          <div className="bg-blue-50 p-4 rounded-lg">
            <h4 className="text-sm font-medium text-blue-900 mb-2">VIP Level Requirements</h4>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-blue-700">Total Spent:</span>
                <span className="ml-2 font-medium">${getVIPLevelRequirements().totalSpent.toLocaleString()}</span>
              </div>
              <div>
                <span className="text-blue-700">Total Stays:</span>
                <span className="ml-2 font-medium">{getVIPLevelRequirements().totalStays}</span>
              </div>
              <div>
                <span className="text-blue-700">Avg Rating:</span>
                <span className="ml-2 font-medium">{getVIPLevelRequirements().averageRating}</span>
              </div>
            </div>
          </div>

          {/* Qualification Criteria */}
          <div>
            <h4 className="text-sm font-medium text-gray-900 mb-3">Qualification Criteria</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Total Stays
                </label>
                <input
                  type="number"
                  name="qualificationCriteria.totalStays"
                  value={formData.qualificationCriteria.totalStays}
                  onChange={handleInputChange}
                  min="0"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Total Nights
                </label>
                <input
                  type="number"
                  name="qualificationCriteria.totalNights"
                  value={formData.qualificationCriteria.totalNights}
                  onChange={handleInputChange}
                  min="0"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Total Spent ($)
                </label>
                <input
                  type="number"
                  name="qualificationCriteria.totalSpent"
                  value={formData.qualificationCriteria.totalSpent}
                  onChange={handleInputChange}
                  min="0"
                  step="0.01"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Average Rating
                </label>
                <input
                  type="number"
                  name="qualificationCriteria.averageRating"
                  value={formData.qualificationCriteria.averageRating}
                  onChange={handleInputChange}
                  min="0"
                  max="5"
                  step="0.1"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Last Stay Date
                </label>
                <input
                  type="date"
                  name="qualificationCriteria.lastStayDate"
                  value={formData.qualificationCriteria.lastStayDate}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
            </div>
          </div>

          {/* Benefits */}
          <div>
            <h4 className="text-sm font-medium text-gray-900 mb-3">VIP Benefits</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                {Object.entries(formData.benefits).map(([key, value]) => {
                  if (typeof value === 'boolean') {
                    return (
                      <label key={key} className="flex items-center">
                        <input
                          type="checkbox"
                          name={`benefits.${key}`}
                          checked={value}
                          onChange={handleInputChange}
                          className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
                        />
                        <span className="ml-2 text-sm text-gray-700 capitalize">
                          {key.replace(/([A-Z])/g, ' $1').trim()}
                        </span>
                      </label>
                    );
                  }
                  return null;
                })}
              </div>
              <div className="space-y-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Dining Discount (%)
                  </label>
                  <input
                    type="number"
                    name="benefits.diningDiscount"
                    value={formData.benefits.diningDiscount}
                    onChange={handleInputChange}
                    min="0"
                    max="100"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Spa Discount (%)
                  </label>
                  <input
                    type="number"
                    name="benefits.spaDiscount"
                    value={formData.benefits.spaDiscount}
                    onChange={handleInputChange}
                    min="0"
                    max="100"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Concierge Assignment */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Assigned Concierge
            </label>
            <select
              name="assignedConcierge"
              value={formData.assignedConcierge}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="">Select Concierge</option>
              {conciergeStaff.map(staff => (
                <option key={staff._id} value={staff._id}>
                  {staff.name} ({staff.role})
                </option>
              ))}
            </select>
          </div>

          {/* Special Requests */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Special Requests
            </label>
            <div className="flex space-x-2 mb-2">
              <input
                type="text"
                value={newSpecialRequest}
                onChange={(e) => setNewSpecialRequest(e.target.value)}
                placeholder="Add special request..."
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
              <button
                type="button"
                onClick={handleAddSpecialRequest}
                className="px-4 py-2 text-sm font-medium text-white bg-purple-600 border border-transparent rounded-md hover:bg-purple-700"
              >
                Add
              </button>
            </div>
            {formData.specialRequests.length > 0 && (
              <div className="space-y-1">
                {formData.specialRequests.map((request, index) => (
                  <div key={`formData-specialRequests-${index}-${request}`} className="flex items-center justify-between bg-gray-50 p-2 rounded">
                    <span className="text-sm text-gray-700">{request}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveSpecialRequest(index)}
                      className="text-red-600 hover:text-red-800"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Dates */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Anniversary Date
              </label>
              <input
                type="date"
                name="anniversaryDate"
                value={formData.anniversaryDate}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Expiry Date
              </label>
              <input
                type="date"
                name="expiryDate"
                value={formData.expiryDate}
                onChange={handleInputChange}
                min={formData.anniversaryDate}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notes
            </label>
            <textarea
              name="notes"
              value={formData.notes}
              onChange={handleInputChange}
              rows={3}
              placeholder="Additional notes about this VIP guest..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>

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
              className="px-4 py-2 text-sm font-medium text-white bg-purple-600 border border-transparent rounded-md hover:bg-purple-700 disabled:opacity-50"
            >
              {loading ? 'Saving...' : (guest ? 'Update VIP Guest' : 'Add to VIP Program')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default VIPForm;
