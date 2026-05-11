import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { toast } from 'react-hot-toast';

interface CustomField {
  _id: string;
  name: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'dropdown' | 'checkbox' | 'multiselect' | 'textarea' | 'email' | 'phone' | 'url';
  category: string;
  description?: string;
  isRequired: boolean;
  validation: {
    minLength?: number;
    maxLength?: number;
    min?: number;
    max?: number;
    pattern?: string;
    options?: string[];
  };
  defaultValue?: string;
  helpText?: string;
  group?: string;
}

interface DynamicGuestFormProps {
  guestId?: string;
  category?: string;
  onSave?: (data: Record<string, unknown>) => void;
  onCancel?: () => void;
  showOnlyVisible?: boolean;
  showOnlyEditable?: boolean;
}

const DynamicGuestForm: React.FC<DynamicGuestFormProps> = ({
  guestId,
  category,
  onSave,
  onCancel,
  showOnlyVisible = true,
  showOnlyEditable = true
}) => {
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [formData, setFormData] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<{ [key: string]: string[] }>({});

  useEffect(() => {
    fetchCustomFields();
    if (guestId) {
      fetchGuestData();
    }
  }, [guestId, category]);

  const fetchCustomFields = async () => {
    try {
      const params: Record<string, unknown> = { isActive: 'true' };
      if (showOnlyVisible) params.isVisible = 'true';
      if (showOnlyEditable) params.isEditable = 'true';
      if (category) params.category = category;

      const { data } = await api.get('/custom-fields/active', { params });
      setCustomFields(data.data.fields);
    } catch (error) {
      toast.error('Failed to load form fields');
    } finally {
      setLoading(false);
    }
  };

  const fetchGuestData = async () => {
    if (!guestId) return;

    try {
      const { data } = await api.get(`/custom-fields/guest/${guestId}/data`);
      const guestData: Record<string, unknown> = {};

      data.data.customData.forEach((item: Record<string, unknown>) => {
        guestData[item.fieldId._id] = item.rawValue || item.value;
      });

      setFormData(guestData);
    } catch {
      // Error handled silently
    }
  };

  const handleInputChange = (fieldId: string, value: unknown) => {
    setFormData(prev => ({
      ...prev,
      [fieldId]: value
    }));

    // Clear error for this field
    if (errors[fieldId]) {
      setErrors(prev => ({
        ...prev,
        [fieldId]: []
      }));
    }
  };

  const validateField = (field: CustomField, value: unknown): string[] => {
    const fieldErrors: string[] = [];

    // Check required
    if (field.isRequired && (!value || value.toString().trim() === '')) {
      fieldErrors.push(`${field.label} is required`);
      return fieldErrors;
    }

    // Skip validation if value is empty and not required
    if (!value || value.toString().trim() === '') {
      return fieldErrors;
    }

    // Type-specific validation
    switch (field.type) {
      case 'text':
      case 'textarea':
        if (field.validation.minLength && value.length < field.validation.minLength) {
          fieldErrors.push(`${field.label} must be at least ${field.validation.minLength} characters`);
        }
        if (field.validation.maxLength && value.length > field.validation.maxLength) {
          fieldErrors.push(`${field.label} must be no more than ${field.validation.maxLength} characters`);
        }
        if (field.validation.pattern && !new RegExp(field.validation.pattern).test(value)) {
          fieldErrors.push(`${field.label} format is invalid`);
        }
        break;

      case 'number':
        const numValue = parseFloat(value);
        if (isNaN(numValue)) {
          fieldErrors.push(`${field.label} must be a valid number`);
        } else {
          if (field.validation.min !== undefined && numValue < field.validation.min) {
            fieldErrors.push(`${field.label} must be at least ${field.validation.min}`);
          }
          if (field.validation.max !== undefined && numValue > field.validation.max) {
            fieldErrors.push(`${field.label} must be no more than ${field.validation.max}`);
          }
        }
        break;

      case 'email':
        const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailPattern.test(value)) {
          fieldErrors.push(`${field.label} must be a valid email address`);
        }
        break;

      case 'phone':
        const phonePattern = /^[\+]?[1-9][\d]{0,15}$/;
        if (!phonePattern.test(value.replace(/[\s\-\(\)]/g, ''))) {
          fieldErrors.push(`${field.label} must be a valid phone number`);
        }
        break;

      case 'url':
        try {
          new URL(value);
        } catch {
          fieldErrors.push(`${field.label} must be a valid URL`);
        }
        break;

      case 'date':
        const dateValue = new Date(value);
        if (isNaN(dateValue.getTime())) {
          fieldErrors.push(`${field.label} must be a valid date`);
        }
        break;

      case 'dropdown':
        if (!field.validation.options?.includes(value)) {
          fieldErrors.push(`${field.label} must be one of the allowed values`);
        }
        break;

      case 'multiselect':
        if (Array.isArray(value)) {
          const invalidValues = value.filter(v => !field.validation.options?.includes(v));
          if (invalidValues.length > 0) {
            fieldErrors.push(`${field.label} contains invalid values`);
          }
        } else {
          fieldErrors.push(`${field.label} must be an array of values`);
        }
        break;

      case 'checkbox':
        if (typeof value !== 'boolean') {
          fieldErrors.push(`${field.label} must be true or false`);
        }
        break;
    }

    return fieldErrors;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!guestId) {
      toast.error('Guest ID is required');
      return;
    }

    // Validate all fields
    const newErrors: { [key: string]: string[] } = {};
    let hasErrors = false;

    customFields.forEach(field => {
      const value = formData[field._id];
      const fieldErrors = validateField(field, value);
      
      if (fieldErrors.length > 0) {
        newErrors[field._id] = fieldErrors;
        hasErrors = true;
      }
    });

    setErrors(newErrors);

    if (hasErrors) {
      toast.error('Please fix the validation errors');
      return;
    }

    setSaving(true);

    try {
      await api.patch(`/custom-fields/guest/${guestId}/data`, { dataUpdates: formData });

      toast.success('Custom data saved successfully');
      if (onSave) {
        onSave(formData);
      }
    } catch (error) {
      toast.error('Failed to save custom data');
    } finally {
      setSaving(false);
    }
  };

  const renderField = (field: CustomField) => {
    const value = formData[field._id] || field.defaultValue || '';
    const fieldErrors = errors[field._id] || [];

    const baseInputClasses = `w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
      fieldErrors.length > 0 ? 'border-red-300' : 'border-gray-300'
    }`;

    switch (field.type) {
      case 'text':
      case 'email':
      case 'phone':
      case 'url':
        return (
          <input
            type={field.type === 'email' ? 'email' : field.type === 'phone' ? 'tel' : field.type === 'url' ? 'url' : 'text'}
            value={value}
            onChange={(e) => handleInputChange(field._id, e.target.value)}
            placeholder={field.helpText}
            className={baseInputClasses}
            required={field.isRequired}
          />
        );

      case 'number':
        return (
          <input
            type="number"
            value={value}
            onChange={(e) => handleInputChange(field._id, parseFloat(e.target.value) || '')}
            min={field.validation.min}
            max={field.validation.max}
            placeholder={field.helpText}
            className={baseInputClasses}
            required={field.isRequired}
          />
        );

      case 'date':
        return (
          <input
            type="date"
            value={value}
            onChange={(e) => handleInputChange(field._id, e.target.value)}
            className={baseInputClasses}
            required={field.isRequired}
          />
        );

      case 'textarea':
        return (
          <textarea
            value={value}
            onChange={(e) => handleInputChange(field._id, e.target.value)}
            rows={3}
            placeholder={field.helpText}
            className={baseInputClasses}
            required={field.isRequired}
          />
        );

      case 'dropdown':
        return (
          <select
            value={value}
            onChange={(e) => handleInputChange(field._id, e.target.value)}
            className={baseInputClasses}
            required={field.isRequired}
          >
            <option value="">Select an option...</option>
            {field.validation.options?.map(option => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        );

      case 'multiselect':
        const selectedValues = Array.isArray(value) ? value : [];
        return (
          <div className="space-y-2">
            {field.validation.options?.map(option => (
              <label key={option} className="flex items-center">
                <input
                  type="checkbox"
                  checked={selectedValues.includes(option)}
                  onChange={(e) => {
                    const newValues = e.target.checked
                      ? [...selectedValues, option]
                      : selectedValues.filter(v => v !== option);
                    handleInputChange(field._id, newValues);
                  }}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <span className="ml-2 text-sm text-gray-700">{option}</span>
              </label>
            ))}
          </div>
        );

      case 'checkbox':
        return (
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={Boolean(value)}
              onChange={(e) => handleInputChange(field._id, e.target.checked)}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <span className="ml-2 text-sm text-gray-700">{field.helpText || 'Check this option'}</span>
          </label>
        );

      default:
        return (
          <input
            type="text"
            value={value}
            onChange={(e) => handleInputChange(field._id, e.target.value)}
            className={baseInputClasses}
            required={field.isRequired}
          />
        );
    }
  };

  const groupedFields = customFields.reduce((groups, field) => {
    const group = field.group || 'General';
    if (!groups[group]) {
      groups[group] = [];
    }
    groups[group].push(field);
    return groups;
  }, {} as { [key: string]: CustomField[] });

  if (loading) {
    return (
      <div className="flex justify-center items-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2 text-gray-600">Loading form...</span>
      </div>
    );
  }

  if (customFields.length === 0) {
    return (
      <div className="text-center p-8">
        <p className="text-gray-500">No custom fields available</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {Object.entries(groupedFields).map(([groupName, fields]) => (
        <div key={groupName} className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">{groupName}</h3>
          <div className="space-y-4">
            {fields.map(field => (
              <div key={field._id}>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {field.label}
                  {field.isRequired && <span className="text-red-500 ml-1">*</span>}
                </label>
                
                {field.description && (
                  <p className="text-xs text-gray-500 mb-2">{field.description}</p>
                )}

                {renderField(field)}

                {errors[field._id] && (
                  <div className="mt-1">
                    {errors[field._id].map((error, index) => (
                      <p key={`-${index}-${error}`} className="text-sm text-red-600">{error}</p>
                    ))}
                  </div>
                )}

                {field.helpText && !field.description && (
                  <p className="text-xs text-gray-500 mt-1">{field.helpText}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}

      <div className="flex justify-end space-x-3">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Cancel
          </button>
        )}
        <button aria-label="Save"
          type="submit"
          disabled={saving}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save Custom Data'}
        </button>
      </div>
    </form>
  );
};

export default DynamicGuestForm;
