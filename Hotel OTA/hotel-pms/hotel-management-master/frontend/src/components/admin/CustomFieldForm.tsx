import React, { useState, useEffect } from 'react';
import { XMarkIcon, CogIcon } from '@heroicons/react/24/outline';
import { toast } from 'react-hot-toast';
import { api } from '../../services/api';

interface CustomField {
  _id: string;
  name: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'dropdown' | 'checkbox' | 'multiselect' | 'textarea' | 'email' | 'phone' | 'url';
  category: 'personal' | 'preferences' | 'contact' | 'business' | 'special' | 'other';
  description?: string;
  isRequired: boolean;
  isActive: boolean;
  isVisible: boolean;
  isEditable: boolean;
  validation: {
    minLength?: number;
    maxLength?: number;
    min?: number;
    max?: number;
    pattern?: string;
    options?: string[];
  };
  displayOrder: number;
  defaultValue?: string;
  helpText?: string;
  group?: string;
  tags: string[];
}

interface CustomFieldFormProps {
  field?: CustomField | null;
  onClose: () => void;
  onSuccess: () => void;
}

const CustomFieldForm: React.FC<CustomFieldFormProps> = ({
  field,
  onClose,
  onSuccess
}) => {
  const [formData, setFormData] = useState({
    name: '',
    label: '',
    type: 'text' as const,
    category: 'personal' as const,
    description: '',
    isRequired: false,
    isActive: true,
    isVisible: true,
    isEditable: true,
    validation: {
      minLength: undefined as number | undefined,
      maxLength: undefined as number | undefined,
      min: undefined as number | undefined,
      max: undefined as number | undefined,
      pattern: '',
      options: [] as string[]
    },
    displayOrder: 0,
    defaultValue: '',
    helpText: '',
    group: '',
    tags: [] as string[]
  });
  const [loading, setLoading] = useState(false);
  const [newOption, setNewOption] = useState('');
  const [newTag, setNewTag] = useState('');

  const fieldTypes = [
    { value: 'text', label: 'Text', icon: '📝', description: 'Single line text input' },
    { value: 'textarea', label: 'Text Area', icon: '📄', description: 'Multi-line text input' },
    { value: 'number', label: 'Number', icon: '🔢', description: 'Numeric input' },
    { value: 'date', label: 'Date', icon: '📅', description: 'Date picker' },
    { value: 'email', label: 'Email', icon: '📧', description: 'Email address input' },
    { value: 'phone', label: 'Phone', icon: '📞', description: 'Phone number input' },
    { value: 'url', label: 'URL', icon: '🔗', description: 'Website URL input' },
    { value: 'dropdown', label: 'Dropdown', icon: '📋', description: 'Single selection from options' },
    { value: 'multiselect', label: 'Multi-select', icon: '☑️☑️', description: 'Multiple selection from options' },
    { value: 'checkbox', label: 'Checkbox', icon: '☑️', description: 'True/false checkbox' }
  ];

  const categories = [
    { value: 'personal', label: 'Personal', description: 'Personal information fields' },
    { value: 'preferences', label: 'Preferences', description: 'Guest preference fields' },
    { value: 'contact', label: 'Contact', description: 'Contact information fields' },
    { value: 'business', label: 'Business', description: 'Business-related fields' },
    { value: 'special', label: 'Special', description: 'Special requirements fields' },
    { value: 'other', label: 'Other', description: 'Other miscellaneous fields' }
  ];

  useEffect(() => {
    if (field) {
      setFormData({
        name: field.name,
        label: field.label,
        type: field.type,
        category: field.category,
        description: field.description || '',
        isRequired: field.isRequired,
        isActive: field.isActive,
        isVisible: field.isVisible,
        isEditable: field.isEditable,
        validation: {
          minLength: field.validation.minLength,
          maxLength: field.validation.maxLength,
          min: field.validation.min,
          max: field.validation.max,
          pattern: field.validation.pattern || '',
          options: field.validation.options || []
        },
        displayOrder: field.displayOrder,
        defaultValue: field.defaultValue || '',
        helpText: field.helpText || '',
        group: field.group || '',
        tags: field.tags || []
      });
    }
  }, [field]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || !formData.label) {
      toast.error('Name and label are required');
      return;
    }

    // Validate field-specific requirements
    if ((formData.type === 'dropdown' || formData.type === 'multiselect') && 
        formData.validation.options.length === 0) {
      toast.error('Options are required for dropdown and multiselect fields');
      return;
    }

    setLoading(true);

    try {
      if (field) {
        await api.patch(`/custom-fields/${field._id}`, formData);
      } else {
        await api.post('/custom-fields', formData);
      }

      toast.success(field ? 'Custom field updated successfully' : 'Custom field created successfully');
      onSuccess();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save custom field');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    
    if (name.startsWith('validation.')) {
      const validationKey = name.split('.')[1];
      setFormData(prev => ({
        ...prev,
        validation: {
          ...prev.validation,
          [validationKey]: type === 'number' ? (value ? parseFloat(value) : undefined) : value
        }
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
      }));
    }
  };

  const handleAddOption = () => {
    if (newOption.trim()) {
      setFormData(prev => ({
        ...prev,
        validation: {
          ...prev.validation,
          options: [...prev.validation.options, newOption.trim()]
        }
      }));
      setNewOption('');
    }
  };

  const handleRemoveOption = (index: number) => {
    setFormData(prev => ({
      ...prev,
      validation: {
        ...prev.validation,
        options: prev.validation.options.filter((_, i) => i !== index)
      }
    }));
  };

  const handleAddTag = () => {
    if (newTag.trim()) {
      setFormData(prev => ({
        ...prev,
        tags: [...prev.tags, newTag.trim()]
      }));
      setNewTag('');
    }
  };

  const handleRemoveTag = (index: number) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter((_, i) => i !== index)
    }));
  };

  const getSelectedType = () => {
    return fieldTypes.find(t => t.value === formData.type);
  };

  const showValidationFields = () => {
    return ['text', 'textarea', 'number', 'email', 'phone', 'url'].includes(formData.type);
  };

  const showOptionsFields = () => {
    return ['dropdown', 'multiselect'].includes(formData.type);
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-10 mx-auto p-5 border w-11/12 md:w-4/5 lg:w-3/4 shadow-lg rounded-md bg-white">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center">
            <CogIcon className="w-6 h-6 text-blue-600 mr-2" />
            <h3 className="text-lg font-medium text-gray-900">
              {field ? 'Edit Custom Field' : 'Create Custom Field'}
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
          {/* Basic Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Field Name *
              </label>
              <input
                type="text"
                required
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                placeholder="e.g., dietary_preferences"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-500 mt-1">Internal field name (no spaces)</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Display Label *
              </label>
              <input
                type="text"
                required
                name="label"
                value={formData.label}
                onChange={handleInputChange}
                placeholder="e.g., Dietary Preferences"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-500 mt-1">Label shown to users</p>
            </div>
          </div>

          {/* Field Type and Category */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Field Type *
              </label>
              <select
                name="type"
                value={formData.type}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              >
                {fieldTypes.map(type => (
                  <option key={type.value} value={type.value}>
                    {type.icon} {type.label}
                  </option>
                ))}
              </select>
              {getSelectedType() && (
                <p className="text-xs text-gray-500 mt-1">{getSelectedType()?.description}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Category *
              </label>
              <select
                name="category"
                value={formData.category}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              >
                {categories.map(category => (
                  <option key={category.value} value={category.value}>
                    {category.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              rows={3}
              placeholder="Describe what this field is for..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Validation Rules */}
          {showValidationFields() && (
            <div className="bg-gray-50 p-4 rounded-lg">
              <h4 className="text-sm font-medium text-gray-900 mb-3">Validation Rules</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {(formData.type === 'text' || formData.type === 'textarea') && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Min Length
                      </label>
                      <input
                        type="number"
                        name="validation.minLength"
                        value={formData.validation.minLength || ''}
                        onChange={handleInputChange}
                        min="0"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Max Length
                      </label>
                      <input
                        type="number"
                        name="validation.maxLength"
                        value={formData.validation.maxLength || ''}
                        onChange={handleInputChange}
                        min="0"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </>
                )}
                
                {formData.type === 'number' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Min Value
                      </label>
                      <input
                        type="number"
                        name="validation.min"
                        value={formData.validation.min || ''}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Max Value
                      </label>
                      <input
                        type="number"
                        name="validation.max"
                        value={formData.validation.max || ''}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </>
                )}

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Pattern (Regex)
                  </label>
                  <input
                    type="text"
                    name="validation.pattern"
                    value={formData.validation.pattern}
                    onChange={handleInputChange}
                    placeholder="e.g., ^[A-Za-z]+$"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">Optional regex pattern for validation</p>
                </div>
              </div>
            </div>
          )}

          {/* Options for Dropdown/Multiselect */}
          {showOptionsFields() && (
            <div className="bg-gray-50 p-4 rounded-lg">
              <h4 className="text-sm font-medium text-gray-900 mb-3">Options</h4>
              <div className="space-y-2">
                {formData.validation.options.map((option, index) => (
                  <div key={`formData-validation-options-${index}-${option}`} className="flex items-center justify-between bg-white p-2 rounded border">
                    <span className="text-sm text-gray-700">{option}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveOption(index)}
                      className="text-red-600 hover:text-red-800"
                    >
                      Remove
                    </button>
                  </div>
                ))}
                <div className="flex space-x-2">
                  <input
                    type="text"
                    value={newOption}
                    onChange={(e) => setNewOption(e.target.value)}
                    placeholder="Add new option..."
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    type="button"
                    onClick={handleAddOption}
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700"
                  >
                    Add
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Field Properties */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <h4 className="text-sm font-medium text-gray-900 mb-3">Field Properties</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    name="isRequired"
                    checked={formData.isRequired}
                    onChange={handleInputChange}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <span className="ml-2 text-sm text-gray-700">Required field</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    name="isActive"
                    checked={formData.isActive}
                    onChange={handleInputChange}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <span className="ml-2 text-sm text-gray-700">Active</span>
                </label>
              </div>
              <div className="space-y-3">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    name="isVisible"
                    checked={formData.isVisible}
                    onChange={handleInputChange}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <span className="ml-2 text-sm text-gray-700">Visible to guests</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    name="isEditable"
                    checked={formData.isEditable}
                    onChange={handleInputChange}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <span className="ml-2 text-sm text-gray-700">Editable by guests</span>
                </label>
              </div>
            </div>
          </div>

          {/* Additional Settings */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Display Order
              </label>
              <input
                type="number"
                name="displayOrder"
                value={formData.displayOrder}
                onChange={handleInputChange}
                min="0"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Group
              </label>
              <input
                type="text"
                name="group"
                value={formData.group}
                onChange={handleInputChange}
                placeholder="e.g., Personal Info"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Default Value
            </label>
            <input
              type="text"
              name="defaultValue"
              value={formData.defaultValue}
              onChange={handleInputChange}
              placeholder="Default value for this field"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Help Text
            </label>
            <input
              type="text"
              name="helpText"
              value={formData.helpText}
              onChange={handleInputChange}
              placeholder="Help text shown to users"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Tags */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tags
            </label>
            <div className="space-y-2">
              {formData.tags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {formData.tags.map((tag, index) => (
                    <span
                      key={`formData-tags-${index}-${tag}`}
                      className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                    >
                      {tag}
                      <button aria-label="Delete"
                        type="button"
                        onClick={() => handleRemoveTag(index)}
                        className="ml-1 text-blue-600 hover:text-blue-800"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  placeholder="Add tag..."
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  type="button"
                  onClick={handleAddTag}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700"
                >
                  Add Tag
                </button>
              </div>
            </div>
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Cancel
            </button>
            <button aria-label="Close"
              type="submit"
              disabled={loading}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Saving...' : (field ? 'Update Field' : 'Create Field')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CustomFieldForm;
