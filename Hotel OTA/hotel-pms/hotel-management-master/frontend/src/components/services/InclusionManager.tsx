import React, { useState, useEffect } from 'react';
import {
  Plus,
  Search,
  Edit,
  Eye,
  X,
  Award,
  IndianRupee,
  Filter
} from 'lucide-react';
import { api } from '../../services/api';
import { useToast } from '../../hooks/useToast';
import { useProperty } from '../../context/PropertyContext';

interface Inclusion {
  _id: string;
  name: string;
  description?: string;
  type: string;
  category: string;
  value: {
    basePrice: number;
    baseCurrency: string;
  };
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface InclusionFormData {
  name: string;
  description: string;
  type: string;
  category: string;
  value: {
    basePrice: number;
    baseCurrency: string;
  };
  isActive: boolean;
}

interface InclusionManagerProps {
  onUpdate?: () => void;
}

const TYPES = [
  'service',
  'amenity',
  'meal',
  'activity',
  'transport',
  'access',
  'discount',
  'upgrade',
  'credit',
  'other'
];

const defaultFormData: InclusionFormData = {
  name: '',
  description: '',
  type: 'service',
  category: '',
  value: { basePrice: 0, baseCurrency: 'INR' },
  isActive: true
};

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && error !== null && 'message' in error)
    return String((error as Record<string, unknown>).message);
  return 'An unexpected error occurred';
};

const InclusionManager: React.FC<InclusionManagerProps> = ({ onUpdate }) => {
  const { selectedPropertyId } = useProperty();
  const { showToast } = useToast();
  const [inclusions, setInclusions] = useState<Inclusion[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [showModal, setShowModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedInclusion, setSelectedInclusion] = useState<Inclusion | null>(null);
  const [formData, setFormData] = useState<InclusionFormData>(defaultFormData);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchInclusions();
  }, [selectedPropertyId]);

  const fetchInclusions = async () => {
    try {
      setLoading(true);
      const params: Record<string, string | number> = { page: 1, limit: 100 };
      if (selectedPropertyId) params.propertyId = selectedPropertyId;
      const response = await api.get('/add-on-services/inclusions/list', { params });
      const data = response.data?.data || response.data;
      const list = Array.isArray(data) ? data : (data?.inclusions || []);
      setInclusions(list);
    } catch {
      showToast('Error loading inclusions', 'error');
      setInclusions([]);
    } finally {
      setLoading(false);
    }
  };

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};
    if (!formData.name.trim()) errors.name = 'Name is required';
    if (!formData.type) errors.type = 'Type is required';
    if (!formData.category.trim()) errors.category = 'Category is required';
    if (formData.value.basePrice < 0) errors.basePrice = 'Value must be 0 or greater';
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleCreate = () => {
    setSelectedInclusion(null);
    setFormData(defaultFormData);
    setFormErrors({});
    setShowModal(true);
  };

  const handleEdit = (inclusion: Inclusion) => {
    setSelectedInclusion(inclusion);
    setFormData({
      name: inclusion.name,
      description: inclusion.description || '',
      type: inclusion.type,
      category: inclusion.category,
      value: {
        basePrice: inclusion.value.basePrice,
        baseCurrency: inclusion.value.baseCurrency || 'INR'
      },
      isActive: inclusion.isActive
    });
    setFormErrors({});
    setShowModal(true);
  };

  const handleView = (inclusion: Inclusion) => {
    setSelectedInclusion(inclusion);
    setShowViewModal(true);
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    setSubmitting(true);
    try {
      if (selectedInclusion) {
        await api.put(`/add-on-services/inclusions/${selectedInclusion._id}`, formData);
        showToast('Inclusion updated successfully', 'success');
      } else {
        await api.post('/add-on-services/inclusions', formData);
        showToast('Inclusion created successfully', 'success');
      }
      setShowModal(false);
      setSelectedInclusion(null);
      fetchInclusions();
      onUpdate?.();
    } catch (error: unknown) {
      showToast(getErrorMessage(error), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const getTypeColor = (type: string): string => {
    const colors: Record<string, string> = {
      service: 'bg-blue-100 text-blue-800',
      amenity: 'bg-green-100 text-green-800',
      meal: 'bg-orange-100 text-orange-800',
      activity: 'bg-purple-100 text-purple-800',
      transport: 'bg-yellow-100 text-yellow-800',
      access: 'bg-teal-100 text-teal-800',
      discount: 'bg-red-100 text-red-800',
      upgrade: 'bg-indigo-100 text-indigo-800',
      credit: 'bg-pink-100 text-pink-800',
      other: 'bg-gray-100 text-gray-800'
    };
    return colors[type] || 'bg-gray-100 text-gray-800';
  };

  const formatType = (type: string): string => {
    return type.charAt(0).toUpperCase() + type.slice(1);
  };

  const filteredInclusions = inclusions.filter((inc) => {
    if (typeFilter !== 'all' && inc.type !== typeFilter) return false;
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      inc.name.toLowerCase().includes(term) ||
      inc.category.toLowerCase().includes(term) ||
      inc.type.toLowerCase().includes(term) ||
      (inc.description && inc.description.toLowerCase().includes(term))
    );
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Inclusions Management</h3>
          <p className="text-sm text-gray-600">
            Manage service inclusions for room types and packages
          </p>
        </div>
        <button
          onClick={handleCreate}
          className="flex items-center space-x-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700"
        >
          <Plus className="h-4 w-4" />
          <span>Add Inclusion</span>
        </button>
      </div>

      {/* Search and Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <input
            type="text"
            placeholder="Search inclusions..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>
        <div className="flex items-center space-x-2">
          <Filter className="h-4 w-4 text-gray-400" />
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm"
          >
            <option value="all">All Types</option>
            {TYPES.map((t) => (
              <option key={t} value={t}>
                {formatType(t)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      {filteredInclusions.length > 0 ? (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Category
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Value
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredInclusions.map((inclusion) => (
                  <tr key={inclusion._id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="font-medium text-gray-900">{inclusion.name}</div>
                      {inclusion.description && (
                        <div className="text-sm text-gray-500 truncate max-w-xs">
                          {inclusion.description}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 py-1 text-xs font-medium rounded-full ${getTypeColor(inclusion.type)}`}
                      >
                        {formatType(inclusion.type)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                      {inclusion.category}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center space-x-1 text-sm font-medium text-gray-900">
                        <IndianRupee className="h-3.5 w-3.5" />
                        <span>{inclusion.value.basePrice.toLocaleString()}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 py-1 text-xs font-medium rounded-full ${
                          inclusion.isActive
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {inclusion.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="flex items-center justify-end space-x-2">
                        <button
                          onClick={() => handleView(inclusion)}
                          className="p-1.5 text-gray-400 hover:text-blue-600 rounded"
                          title="View"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleEdit(inclusion)}
                          className="p-1.5 text-gray-400 hover:text-indigo-600 rounded"
                          title="Edit"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Empty State */
        <div className="text-center py-12 bg-white border border-gray-200 rounded-lg">
          <Award className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No inclusions found</h3>
          <p className="text-gray-600 mb-4">
            {searchTerm || typeFilter !== 'all'
              ? 'Try adjusting your search or filter criteria.'
              : 'Get started by adding your first inclusion.'}
          </p>
          {!searchTerm && typeFilter === 'all' && (
            <button
              onClick={handleCreate}
              className="inline-flex items-center space-x-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700"
            >
              <Plus className="h-4 w-4" />
              <span>Add Inclusion</span>
            </button>
          )}
        </div>
      )}

      {/* Create / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b">
              <h3 className="text-lg font-semibold text-gray-900">
                {selectedInclusion ? 'Edit Inclusion' : 'Create Inclusion'}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="p-1 text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 ${
                    formErrors.name ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="e.g., Complimentary Breakfast"
                />
                {formErrors.name && (
                  <p className="mt-1 text-sm text-red-500">{formErrors.name}</p>
                )}
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  rows={3}
                  placeholder="Describe the inclusion..."
                />
              </div>

              {/* Type and Category */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Type <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 ${
                      formErrors.type ? 'border-red-500' : 'border-gray-300'
                    }`}
                  >
                    {TYPES.map((t) => (
                      <option key={t} value={t}>
                        {formatType(t)}
                      </option>
                    ))}
                  </select>
                  {formErrors.type && (
                    <p className="mt-1 text-sm text-red-500">{formErrors.type}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Category <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 ${
                      formErrors.category ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="e.g., dining, wellness"
                  />
                  {formErrors.category && (
                    <p className="mt-1 text-sm text-red-500">{formErrors.category}</p>
                  )}
                </div>
              </div>

              {/* Value */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Base Price
                  </label>
                  <div className="relative">
                    <IndianRupee className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                    <input
                      type="number"
                      value={formData.value.basePrice}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          value: { ...formData.value, basePrice: parseFloat(e.target.value) || 0 }
                        })
                      }
                      className={`w-full pl-9 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 ${
                        formErrors.basePrice ? 'border-red-500' : 'border-gray-300'
                      }`}
                      min="0"
                      step="0.01"
                    />
                  </div>
                  {formErrors.basePrice && (
                    <p className="mt-1 text-sm text-red-500">{formErrors.basePrice}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Currency
                  </label>
                  <select
                    value={formData.value.baseCurrency}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        value: { ...formData.value, baseCurrency: e.target.value }
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  >
                    <option value="INR">INR</option>
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                    <option value="GBP">GBP</option>
                  </select>
                </div>
              </div>

              {/* Active Toggle */}
              <div className="flex items-center space-x-3">
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.isActive}
                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                </label>
                <span className="text-sm font-medium text-gray-700">Active</span>
              </div>
            </div>

            <div className="flex justify-end space-x-3 p-6 border-t">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
              >
                {submitting
                  ? 'Saving...'
                  : selectedInclusion
                    ? 'Update'
                    : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Modal */}
      {showViewModal && selectedInclusion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between p-6 border-b">
              <h3 className="text-lg font-semibold text-gray-900">Inclusion Details</h3>
              <button
                onClick={() => setShowViewModal(false)}
                className="p-1 text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <p className="text-sm text-gray-500">Name</p>
                <p className="font-medium text-gray-900">{selectedInclusion.name}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Description</p>
                <p className="text-gray-700">
                  {selectedInclusion.description || 'No description'}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Type</p>
                  <span
                    className={`inline-block px-2 py-1 text-xs font-medium rounded-full ${getTypeColor(selectedInclusion.type)}`}
                  >
                    {formatType(selectedInclusion.type)}
                  </span>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Category</p>
                  <p className="text-gray-700">{selectedInclusion.category}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Value</p>
                  <p className="font-medium text-gray-900">
                    {selectedInclusion.value.baseCurrency === 'INR' ? '\u20B9' : selectedInclusion.value.baseCurrency}{' '}
                    {selectedInclusion.value.basePrice.toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Status</p>
                  <span
                    className={`inline-block px-2 py-1 text-xs font-medium rounded-full ${
                      selectedInclusion.isActive
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {selectedInclusion.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </div>
              <div>
                <p className="text-sm text-gray-500">Created</p>
                <p className="text-gray-700">
                  {new Date(selectedInclusion.createdAt).toLocaleDateString()}
                </p>
              </div>
            </div>

            <div className="flex justify-end space-x-3 p-6 border-t">
              <button
                onClick={() => setShowViewModal(false)}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Close
              </button>
              <button
                onClick={() => {
                  setShowViewModal(false);
                  handleEdit(selectedInclusion);
                }}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
              >
                Edit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InclusionManager;
