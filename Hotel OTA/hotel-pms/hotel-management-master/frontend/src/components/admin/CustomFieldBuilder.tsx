import React, { useState } from 'react';
import { XMarkIcon, CogIcon, PlusIcon, TrashIcon, EyeIcon } from '@heroicons/react/24/outline';
import { toast } from 'react-hot-toast';
import { api } from '../../services/api';

interface CustomFieldBuilderProps {
  onClose: () => void;
  onSuccess: () => void;
}

interface FieldTemplate {
  id: string;
  name: string;
  label: string;
  type: string;
  category: string;
  description: string;
  isRequired: boolean;
  validation: unknown;
  group: string;
}

const CustomFieldBuilder: React.FC<CustomFieldBuilderProps> = ({
  onClose,
  onSuccess
}) => {
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [customFields, setCustomFields] = useState<FieldTemplate[]>([]);
  const [loading, setLoading] = useState(false);

  const fieldTemplates = [
    {
      id: 'personal_info',
      name: 'Personal Information',
      fields: [
        { name: 'emergency_contact', label: 'Emergency Contact', type: 'text', category: 'personal', description: 'Emergency contact person', isRequired: true, validation: {}, group: 'Emergency Info' },
        { name: 'emergency_phone', label: 'Emergency Phone', type: 'phone', category: 'personal', description: 'Emergency contact phone number', isRequired: true, validation: {}, group: 'Emergency Info' },
        { name: 'date_of_birth', label: 'Date of Birth', type: 'date', category: 'personal', description: 'Guest date of birth', isRequired: false, validation: {}, group: 'Personal Details' },
        { name: 'nationality', label: 'Nationality', type: 'text', category: 'personal', description: 'Guest nationality', isRequired: false, validation: {}, group: 'Personal Details' },
        { name: 'passport_number', label: 'Passport Number', type: 'text', category: 'personal', description: 'Passport or ID number', isRequired: false, validation: {}, group: 'Identification' }
      ]
    },
    {
      id: 'preferences',
      name: 'Guest Preferences',
      fields: [
        { name: 'dietary_restrictions', label: 'Dietary Restrictions', type: 'multiselect', category: 'preferences', description: 'Dietary restrictions and allergies', isRequired: false, validation: { options: ['Vegetarian', 'Vegan', 'Gluten-Free', 'Nut Allergy', 'Dairy-Free', 'Halal', 'Kosher', 'Other'] }, group: 'Dining' },
        { name: 'room_preference', label: 'Room Preference', type: 'dropdown', category: 'preferences', description: 'Preferred room type', isRequired: false, validation: { options: ['Standard', 'Deluxe', 'Suite', 'Pool View', 'Garden View', 'City View'] }, group: 'Accommodation' },
        { name: 'bed_type', label: 'Bed Type', type: 'dropdown', category: 'preferences', description: 'Preferred bed configuration', isRequired: false, validation: { options: ['Single', 'Double', 'Twin', 'Queen', 'King'] }, group: 'Accommodation' },
        { name: 'smoking_preference', label: 'Smoking Preference', type: 'dropdown', category: 'preferences', description: 'Smoking or non-smoking room', isRequired: false, validation: { options: ['Non-Smoking', 'Smoking', 'No Preference'] }, group: 'Accommodation' },
        { name: 'floor_preference', label: 'Floor Preference', type: 'dropdown', category: 'preferences', description: 'Preferred floor level', isRequired: false, validation: { options: ['Ground Floor', 'Lower Floors (1-3)', 'Middle Floors (4-7)', 'Upper Floors (8+)', 'No Preference'] }, group: 'Accommodation' }
      ]
    },
    {
      id: 'business',
      name: 'Business Information',
      fields: [
        { name: 'company_name', label: 'Company Name', type: 'text', category: 'business', description: 'Company or organization name', isRequired: false, validation: {}, group: 'Company Details' },
        { name: 'job_title', label: 'Job Title', type: 'text', category: 'business', description: 'Professional title or position', isRequired: false, validation: {}, group: 'Company Details' },
        { name: 'business_purpose', label: 'Business Purpose', type: 'dropdown', category: 'business', description: 'Purpose of visit', isRequired: false, validation: { options: ['Meeting', 'Conference', 'Training', 'Sales', 'Other'] }, group: 'Visit Details' },
        { name: 'expense_account', label: 'Expense Account', type: 'text', category: 'business', description: 'Company expense account code', isRequired: false, validation: {}, group: 'Billing' }
      ]
    },
    {
      id: 'special_requests',
      name: 'Special Requests',
      fields: [
        { name: 'accessibility_needs', label: 'Accessibility Needs', type: 'multiselect', category: 'special', description: 'Accessibility requirements', isRequired: false, validation: { options: ['Wheelchair Access', 'Hearing Impaired', 'Visual Impaired', 'Mobility Assistance', 'Other'] }, group: 'Accessibility' },
        { name: 'special_occasions', label: 'Special Occasions', type: 'dropdown', category: 'special', description: 'Special occasions during stay', isRequired: false, validation: { options: ['Birthday', 'Anniversary', 'Honeymoon', 'Business Celebration', 'Family Reunion', 'Other'] }, group: 'Celebrations' },
        { name: 'transportation_needs', label: 'Transportation Needs', type: 'multiselect', category: 'special', description: 'Transportation requirements', isRequired: false, validation: { options: ['Airport Pickup', 'Airport Dropoff', 'Local Transportation', 'Car Rental', 'Taxi Service', 'Public Transport'] }, group: 'Transportation' },
        { name: 'pet_accommodation', label: 'Pet Accommodation', type: 'checkbox', category: 'special', description: 'Traveling with pets', isRequired: false, validation: {}, group: 'Pets' }
      ]
    },
    {
      id: 'communication',
      name: 'Communication Preferences',
      fields: [
        { name: 'preferred_language', label: 'Preferred Language', type: 'dropdown', category: 'preferences', description: 'Preferred communication language', isRequired: false, validation: { options: ['English', 'Spanish', 'French', 'German', 'Italian', 'Portuguese', 'Chinese', 'Japanese', 'Korean', 'Arabic', 'Other'] }, group: 'Language' },
        { name: 'communication_method', label: 'Communication Method', type: 'multiselect', category: 'preferences', description: 'Preferred communication methods', isRequired: false, validation: { options: ['Email', 'Phone', 'SMS', 'WhatsApp', 'In-App Messages'] }, group: 'Contact Methods' },
        { name: 'marketing_consent', label: 'Marketing Consent', type: 'checkbox', category: 'preferences', description: 'Consent to receive marketing communications', isRequired: false, validation: {}, group: 'Marketing' }
      ]
    }
  ];

  const handleTemplateSelect = (templateId: string) => {
    setSelectedTemplate(templateId);
    const template = fieldTemplates.find(t => t.id === templateId);
    if (template) {
      setCustomFields(template.fields);
    }
  };

  const handleAddField = () => {
    const newField: FieldTemplate = {
      id: `field_${Date.now()}`,
      name: '',
      label: '',
      type: 'text',
      category: 'personal',
      description: '',
      isRequired: false,
      validation: {},
      group: ''
    };
    setCustomFields([...customFields, newField]);
  };

  const handleRemoveField = (index: number) => {
    setCustomFields(customFields.filter((_, i) => i !== index));
  };

  const handleFieldChange = (index: number, field: string, value: unknown) => {
    const updatedFields = [...customFields];
    updatedFields[index] = { ...updatedFields[index], [field]: value };
    setCustomFields(updatedFields);
  };

  const handleSubmit = async () => {
    if (customFields.length === 0) {
      toast.error('Please add at least one field');
      return;
    }

    // Validate fields
    for (const field of customFields) {
      if (!field.name || !field.label) {
        toast.error('All fields must have a name and label');
        return;
      }
    }

    setLoading(true);

    try {
      const { data } = await api.post('/custom-fields/import', { fieldsData: customFields });
      toast.success(`Successfully created ${data.data.created} custom fields`);
      onSuccess();
    } catch (error) {
      toast.error('Failed to create custom fields');
    } finally {
      setLoading(false);
    }
  };

  const fieldTypes = [
    { value: 'text', label: 'Text', icon: '📝' },
    { value: 'textarea', label: 'Text Area', icon: '📄' },
    { value: 'number', label: 'Number', icon: '🔢' },
    { value: 'date', label: 'Date', icon: '📅' },
    { value: 'email', label: 'Email', icon: '📧' },
    { value: 'phone', label: 'Phone', icon: '📞' },
    { value: 'dropdown', label: 'Dropdown', icon: '📋' },
    { value: 'multiselect', label: 'Multi-select', icon: '☑️☑️' },
    { value: 'checkbox', label: 'Checkbox', icon: '☑️' }
  ];

  const categories = [
    { value: 'personal', label: 'Personal' },
    { value: 'preferences', label: 'Preferences' },
    { value: 'contact', label: 'Contact' },
    { value: 'business', label: 'Business' },
    { value: 'special', label: 'Special' },
    { value: 'other', label: 'Other' }
  ];

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-10 mx-auto p-5 border w-11/12 md:w-4/5 lg:w-3/4 shadow-lg rounded-md bg-white">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center">
            <CogIcon className="w-6 h-6 text-blue-600 mr-2" />
            <h3 className="text-lg font-medium text-gray-900">Custom Field Builder</h3>
          </div>
          <button aria-label="Close"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        <div className="space-y-6">
          {/* Template Selection */}
          <div>
            <h4 className="text-sm font-medium text-gray-900 mb-3">Choose a Template</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {fieldTemplates.map(template => (
                <div role="button" tabIndex={0}
                  key={template.id}
                  onClick={() => handleTemplateSelect(template.id)}
                  className={`p-4 border-2 rounded-lg cursor-pointer transition-colors ${
                    selectedTemplate === template.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                 onKeyDown={(e: React.KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); const clickHandler = () => handleTemplateSelect(template.id); if (typeof clickHandler === 'function') { clickHandler(e as any); } } }}>
                  <h5 className="font-medium text-gray-900">{template.name}</h5>
                  <p className="text-sm text-gray-500 mt-1">
                    {template.fields.length} fields
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Custom Fields */}
          <div>
            <div className="flex justify-between items-center mb-3">
              <h4 className="text-sm font-medium text-gray-900">Custom Fields</h4>
              <button
                onClick={handleAddField}
                className="flex items-center px-3 py-1 text-sm font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100"
              >
                <PlusIcon className="w-4 h-4 mr-1" />
                Add Field
              </button>
            </div>

            <div className="space-y-4">
              {customFields.map((field, index) => (
                <div key={field.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex justify-between items-start mb-3">
                    <h5 className="font-medium text-gray-900">Field {index + 1}</h5>
                    <button aria-label="Delete"
                      onClick={() => handleRemoveField(index)}
                      className="text-red-600 hover:text-red-800"
                    >
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Field Name
                      </label>
                      <input
                        type="text"
                        value={field.name}
                        onChange={(e) => handleFieldChange(index, 'name', e.target.value)}
                        placeholder="e.g., dietary_preferences"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Display Label
                      </label>
                      <input
                        type="text"
                        value={field.label}
                        onChange={(e) => handleFieldChange(index, 'label', e.target.value)}
                        placeholder="e.g., Dietary Preferences"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Field Type
                      </label>
                      <select
                        value={field.type}
                        onChange={(e) => handleFieldChange(index, 'type', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        required
                      >
                        {fieldTypes.map(type => (
                          <option key={type.value} value={type.value}>
                            {type.icon} {type.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Category
                      </label>
                      <select
                        value={field.category}
                        onChange={(e) => handleFieldChange(index, 'category', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        {categories.map(category => (
                          <option key={category.value} value={category.value}>
                            {category.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Description
                      </label>
                      <input
                        type="text"
                        value={field.description}
                        onChange={(e) => handleFieldChange(index, 'description', e.target.value)}
                        placeholder="Describe what this field is for..."
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Group
                      </label>
                      <input
                        type="text"
                        value={field.group}
                        onChange={(e) => handleFieldChange(index, 'group', e.target.value)}
                        placeholder="e.g., Personal Info"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div className="flex items-center">
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={field.isRequired}
                          onChange={(e) => handleFieldChange(index, 'isRequired', e.target.checked)}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <span className="ml-2 text-sm text-gray-700">Required field</span>
                      </label>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Preview */}
          {customFields.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-gray-900 mb-3">Preview</h4>
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="space-y-3">
                  {customFields.map((field, index) => (
                    <div key={field.id} className="bg-white p-3 rounded border">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        {field.label || 'Field Label'} {field.isRequired && <span className="text-red-500">*</span>}
                      </label>
                      {field.description && (
                        <p className="text-xs text-gray-500 mb-2">{field.description}</p>
                      )}
                      <div className="text-sm text-gray-400">
                        {fieldTypes.find(t => t.value === field.type)?.icon} {fieldTypes.find(t => t.value === field.type)?.label}
                        {field.group && ` • Group: ${field.group}`}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end space-x-3 pt-4">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={loading || customFields.length === 0}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Creating...' : `Create ${customFields.length} Fields`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CustomFieldBuilder;
