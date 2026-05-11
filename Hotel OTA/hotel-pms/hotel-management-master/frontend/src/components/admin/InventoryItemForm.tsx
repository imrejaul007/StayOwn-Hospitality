import React, { useState, useEffect } from 'react';
import { TemplateInventoryItem } from '../../services/dailyRoutineCheckService';

interface InventoryItemFormProps {
  item?: TemplateInventoryItem;
  type: 'fixed' | 'daily';
  onSave: (item: TemplateInventoryItem) => void;
  onCancel: () => void;
  isEditing?: boolean;
}

const FIXED_CATEGORIES = [
  { value: 'electronics', label: 'Electronics' },
  { value: 'furniture', label: 'Furniture' },
  { value: 'appliances', label: 'Appliances' },
  { value: 'fixtures', label: 'Fixtures' },
  { value: 'other', label: 'Other' }
];

const DAILY_CATEGORIES = [
  { value: 'bathroom', label: 'Bathroom' },
  { value: 'bedroom', label: 'Bedroom' },
  { value: 'kitchen', label: 'Kitchen' },
  { value: 'amenities', label: 'Amenities' },
  { value: 'other', label: 'Other' }
];

const FIXED_CONDITIONS = [
  { value: 'working', label: 'Working' },
  { value: 'clean', label: 'Clean' },
  { value: 'undamaged', label: 'Undamaged' },
  { value: 'functional', label: 'Functional' }
];

const DAILY_CONDITIONS = [
  { value: 'clean', label: 'Clean' },
  { value: 'fresh', label: 'Fresh' },
  { value: 'undamaged', label: 'Undamaged' },
  { value: 'adequate', label: 'Adequate' }
];

export const InventoryItemForm: React.FC<InventoryItemFormProps> = ({
  item,
  type,
  onSave,
  onCancel,
  isEditing = false
}) => {
  const [formData, setFormData] = useState<TemplateInventoryItem>({
    name: '',
    category: '',
    description: '',
    unitPrice: 0,
    standardQuantity: 1,
    checkInstructions: '',
    expectedCondition: type === 'fixed' ? 'working' : 'clean',
    ...item
  });

  const [errors, setErrors] = useState<Partial<Record<keyof TemplateInventoryItem, string>>>({});

  const categories = type === 'fixed' ? FIXED_CATEGORIES : DAILY_CATEGORIES;
  const conditions = type === 'fixed' ? FIXED_CONDITIONS : DAILY_CONDITIONS;

  const validateForm = () => {
    const newErrors: Partial<Record<keyof TemplateInventoryItem, string>> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Item name is required';
    }

    if (!formData.category) {
      newErrors.category = 'Category is required';
    }

    if (formData.unitPrice !== undefined && formData.unitPrice < 0) {
      newErrors.unitPrice = 'Unit price cannot be negative';
    }

    if (formData.standardQuantity !== undefined && formData.standardQuantity <= 0) {
      newErrors.standardQuantity = 'Quantity must be greater than 0';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (validateForm()) {
      onSave(formData);
    }
  };

  const handleInputChange = (field: keyof TemplateInventoryItem, value: unknown) => {
    setFormData(prev => ({ ...prev, [field]: value }));

    // Clear error for this field
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  return (
    <div className="bg-white rounded-lg border">
      <div className="p-4 border-b">
        <h3 className="text-lg font-medium text-gray-900">
          {isEditing ? 'Edit' : 'Add'} {type === 'fixed' ? 'Fixed' : 'Daily'} Inventory Item
        </h3>
      </div>

      <form onSubmit={handleSubmit} className="p-4 space-y-4">
        {/* Item Name */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Item Name *
          </label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => handleInputChange('name', e.target.value)}
            className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              errors.name ? 'border-red-500' : 'border-gray-300'
            }`}
            placeholder="Enter item name"
          />
          {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name}</p>}
        </div>

        {/* Category */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Category *
          </label>
          <select
            value={formData.category}
            onChange={(e) => handleInputChange('category', e.target.value)}
            className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              errors.category ? 'border-red-500' : 'border-gray-300'
            }`}
          >
            <option value="">Select category</option>
            {categories.map(cat => (
              <option key={cat.value} value={cat.value}>{cat.label}</option>
            ))}
          </select>
          {errors.category && <p className="mt-1 text-sm text-red-600">{errors.category}</p>}
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Description
          </label>
          <textarea
            value={formData.description || ''}
            onChange={(e) => handleInputChange('description', e.target.value)}
            rows={2}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Enter item description"
          />
        </div>

        {/* Unit Price and Quantity */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Unit Price (₹)
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={formData.unitPrice || 0}
              onChange={(e) => handleInputChange('unitPrice', parseFloat(e.target.value) || 0)}
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.unitPrice ? 'border-red-500' : 'border-gray-300'
              }`}
            />
            {errors.unitPrice && <p className="mt-1 text-sm text-red-600">{errors.unitPrice}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Standard Quantity
            </label>
            <input
              type="number"
              min="1"
              value={formData.standardQuantity || 1}
              onChange={(e) => handleInputChange('standardQuantity', parseInt(e.target.value) || 1)}
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.standardQuantity ? 'border-red-500' : 'border-gray-300'
              }`}
            />
            {errors.standardQuantity && <p className="mt-1 text-sm text-red-600">{errors.standardQuantity}</p>}
          </div>
        </div>

        {/* Check Instructions */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Check Instructions
          </label>
          <textarea
            value={formData.checkInstructions || ''}
            onChange={(e) => handleInputChange('checkInstructions', e.target.value)}
            rows={2}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Enter check instructions for staff"
          />
        </div>

        {/* Expected Condition */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Expected Condition
          </label>
          <select
            value={formData.expectedCondition || ''}
            onChange={(e) => handleInputChange('expectedCondition', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {conditions.map(condition => (
              <option key={condition.value} value={condition.value}>
                {condition.label}
              </option>
            ))}
          </select>
        </div>

        {/* Form Actions */}
        <div className="flex justify-end space-x-3 pt-4 border-t">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            {isEditing ? 'Update' : 'Add'} Item
          </button>
        </div>
      </form>
    </div>
  );
};