import React, { useState, useEffect } from 'react';
import {
  Edit3,
  Save,
  X,
  Plus,
  Trash2,
  Eye,
  Copy,
  Settings,
  AlertTriangle,
  CheckCircle,
  Info,
  Zap
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../context/AuthContext';
import { apiRequest } from '../../services/api';
import { ApplyToSelector, ApplyToConfirmation, ApplyToScope } from '../settings/ApplyToSelector';
import { useSettingsInheritance, useAffectedPropertiesCount } from '../../hooks/useSettingsInheritance';
import { useProperty } from '../../context/PropertyContext';
import toast from 'react-hot-toast';
import { withErrorBoundary } from '../ErrorBoundary';

interface TemplateVariable {
  name: string;
  description: string;
  type: 'string' | 'number' | 'date' | 'boolean' | 'currency';
  required: boolean;
  defaultValue?: string;
}

interface NotificationTemplate {
  _id?: string;
  name: string;
  description: string;
  category: string;
  type: string;
  subject: string;
  title: string;
  message: string;
  htmlContent?: string;
  variables: TemplateVariable[];
  channels: string[];
  priority: 'low' | 'medium' | 'high' | 'urgent';
  routing: {
    targetRoles: string[];
    departments?: string[];
    conditions?: unknown[];
  };
  scheduling: {
    immediate: boolean;
    delay: number;
    respectQuietHours: boolean;
  };
  localization?: unknown[];
  metadata: {
    isSystem: boolean;
    version: number;
    createdBy?: unknown;
    updatedBy?: unknown;
  };
}

interface TemplateEditorProps {
  templateId?: string;
  isOpen: boolean;
  onClose: () => void;
  onSaved?: (template: NotificationTemplate) => void;
  className?: string;
}

export const TemplateEditor: React.FC<TemplateEditorProps> = ({
  templateId,
  isOpen,
  onClose,
  onSaved,
  className = ''
}) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'basic' | 'content' | 'variables' | 'routing' | 'preview'>('basic');
  const [previewVariables, setPreviewVariables] = useState<Record<string, unknown>>({});

  // Multi-property support
  const { selectedPropertyId } = useProperty();
  const [applyToScope, setApplyToScope] = useState<ApplyToScope>('single');
  const [showSuccess, setShowSuccess] = useState(false);

  const {
    useInheritanceStatus,
    applySettings,
    isUpdating,
    updateError,
    showConfirmation,
    pendingUpdate,
    confirmBulkUpdate,
    cancelBulkUpdate,
  } = useSettingsInheritance();

  const { data: inheritanceStatus } = useInheritanceStatus(selectedPropertyId);
  const affectedCount = useAffectedPropertiesCount(
    applyToScope,
    inheritanceStatus?.groupPropertyCount || 0
  );

  // Form state
  const [formData, setFormData] = useState<Partial<NotificationTemplate>>({
    name: '',
    description: '',
    category: 'booking',
    type: 'booking_confirmation',
    subject: '',
    title: '',
    message: '',
    htmlContent: '',
    variables: [],
    channels: ['in_app', 'email'],
    priority: 'medium',
    routing: {
      targetRoles: ['guest'],
      departments: [],
      conditions: []
    },
    scheduling: {
      immediate: true,
      delay: 0,
      respectQuietHours: true
    },
    localization: [],
    metadata: {
      isSystem: false,
      version: 1
    }
  });

  // Load existing template
  const { data: template, isLoading } = useQuery({
    queryKey: ['notification-template', templateId],
    queryFn: async () => {
      if (!templateId) return null;
      const response = await apiRequest(`/api/v1/notifications/templates/${templateId}`);
      return response.data.template;
    },
    enabled: !!templateId && isOpen
  });

  // Save template mutation
  const saveTemplateMutation = useMutation({
    mutationFn: async (data: Partial<NotificationTemplate>) => {
      const url = templateId
        ? `/api/v1/notifications/templates/${templateId}`
        : '/api/v1/notifications/templates';

      const response = await apiRequest(url, {
        method: templateId ? 'PATCH' : 'POST',
        body: JSON.stringify(data)
      });

      return response.data.template;
    },
    onSuccess: (savedTemplate) => {
      queryClient.invalidateQueries({ queryKey: ['notification-templates'] });
      onSaved?.(savedTemplate);
      onClose();
    }
  });

  // Preview template mutation
  const previewMutation = useMutation({
    mutationFn: async (variables: Record<string, unknown>) => {
      if (!templateId) return null;
      const response = await apiRequest(`/api/v1/notifications/templates/${templateId}/preview`, {
        method: 'POST',
        body: JSON.stringify({ variables })
      });
      return response.data.preview;
    }
  });

  // Load template data into form
  useEffect(() => {
    if (template) {
      setFormData(template);
      // Initialize preview variables with default values
      const defaultVariables: Record<string, unknown> = {};
      template.variables?.forEach((variable: TemplateVariable) => {
        if (variable.defaultValue) {
          defaultVariables[variable.name] = variable.defaultValue;
        }
      });
      setPreviewVariables(defaultVariables);
    }
  }, [template]);

  const handleInputChange = (field: string, value: unknown) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleNestedInputChange = (parent: string, field: string, value: unknown) => {
    setFormData(prev => ({
      ...prev,
      [parent]: {
        ...prev[parent as keyof typeof prev],
        [field]: value
      }
    }));
  };

  const handleVariableChange = (index: number, field: string, value: unknown) => {
    const updatedVariables = [...(formData.variables || [])];
    updatedVariables[index] = {
      ...updatedVariables[index],
      [field]: value
    };
    setFormData(prev => ({
      ...prev,
      variables: updatedVariables
    }));
  };

  const addVariable = () => {
    const newVariable: TemplateVariable = {
      name: '',
      description: '',
      type: 'string',
      required: false,
      defaultValue: ''
    };
    setFormData(prev => ({
      ...prev,
      variables: [...(prev.variables || []), newVariable]
    }));
  };

  const removeVariable = (index: number) => {
    const updatedVariables = (formData.variables || []).filter((_, i) => i !== index);
    setFormData(prev => ({
      ...prev,
      variables: updatedVariables
    }));
  };

  const handleSave = () => {
    saveTemplateMutation.mutate(formData);
  };

  const handlePreview = () => {
    if (templateId) {
      previewMutation.mutate(previewVariables);
    }
  };

  const categories = [
    'booking', 'payment', 'service', 'maintenance', 'inventory',
    'system', 'security', 'promotional', 'emergency', 'staff',
    'guest_experience', 'loyalty', 'review'
  ];

  const types = [
    'booking_confirmation', 'booking_reminder', 'booking_cancellation',
    'payment_success', 'payment_failed', 'payment_reminder',
    'service_booking', 'service_reminder', 'service_completed',
    'maintenance_request', 'maintenance_completed',
    'inventory_alert', 'inventory_low_stock',
    'system_alert', 'security_alert',
    'staff_assignment', 'staff_reminder',
    'guest_welcome', 'guest_checkout', 'guest_request',
    'promotional_offer', 'loyalty_reward', 'review_request',
    'emergency_alert', 'custom'
  ];

  const channels = [
    { value: 'in_app', label: 'In-App' },
    { value: 'email', label: 'Email' },
    { value: 'sms', label: 'SMS' },
    { value: 'push', label: 'Push' },
    { value: 'browser', label: 'Browser' }
  ];

  const roles = [
    { value: 'admin', label: 'Admin' },
    { value: 'staff', label: 'Staff' },
    { value: 'guest', label: 'Guest' },
    { value: 'travel_agent', label: 'Travel Agent' }
  ];

  if (!isOpen) return null;

  return (
    <div className={`fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 ${className}`}>
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Edit3 className="w-6 h-6 text-blue-600" />
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  {templateId ? 'Edit Template' : 'Create New Template'}
                </h3>
                <p className="text-sm text-gray-600">
                  {templateId ? 'Modify notification template' : 'Create a reusable notification template'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleSave}
                disabled={saveTemplateMutation.isPending}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {saveTemplateMutation.isPending ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                Save
              </button>
              <button aria-label="Close"
                onClick={onClose}
                className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="px-6 py-3 border-b border-gray-200">
          <div className="flex space-x-6">
            {[
              { key: 'basic', label: 'Basic Info', icon: Info },
              { key: 'content', label: 'Content', icon: Edit3 },
              { key: 'variables', label: 'Variables', icon: Settings },
              { key: 'routing', label: 'Routing', icon: Zap },
              { key: 'preview', label: 'Preview', icon: Eye }
            ].map(({ key, label, icon: Icon }) => (
              <button aria-label="Close"
                key={key}
                onClick={() => setActiveTab(key as unknown)}
                className={`flex items-center gap-2 pb-2 border-b-2 transition-colors ${
                  activeTab === key
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-600 hover:text-gray-800'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="text-sm font-medium">{label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-4 max-h-[60vh] overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <>
              {/* Basic Info Tab */}
              {activeTab === 'basic' && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Template Name *
                      </label>
                      <input
                        type="text"
                        value={formData.name || ''}
                        onChange={(e) => handleInputChange('name', e.target.value)}
                        placeholder="e.g., Booking Confirmation"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Category *
                      </label>
                      <select
                        value={formData.category || ''}
                        onChange={(e) => handleInputChange('category', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        {categories.map(category => (
                          <option key={category} value={category}>
                            {category.charAt(0).toUpperCase() + category.slice(1).replace('_', ' ')}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Type *
                      </label>
                      <select
                        value={formData.type || ''}
                        onChange={(e) => handleInputChange('type', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        {types.map(type => (
                          <option key={type} value={type}>
                            {type.charAt(0).toUpperCase() + type.slice(1).replace(/_/g, ' ')}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Priority
                      </label>
                      <select
                        value={formData.priority || 'medium'}
                        onChange={(e) => handleInputChange('priority', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                        <option value="urgent">Urgent</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Description
                    </label>
                    <textarea
                      value={formData.description || ''}
                      onChange={(e) => handleInputChange('description', e.target.value)}
                      placeholder="Brief description of what this template is used for..."
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-3">
                      Delivery Channels *
                    </label>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                      {channels.map(channel => (
                        <label key={channel.value} className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            checked={formData.channels?.includes(channel.value) || false}
                            onChange={(e) => {
                              const updatedChannels = e.target.checked
                                ? [...(formData.channels || []), channel.value]
                                : (formData.channels || []).filter(c => c !== channel.value);
                              handleInputChange('channels', updatedChannels);
                            }}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="text-sm text-gray-700">{channel.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Content Tab */}
              {activeTab === 'content' && (
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Subject Line *
                    </label>
                    <input
                      type="text"
                      value={formData.subject || ''}
                      onChange={(e) => handleInputChange('subject', e.target.value)}
                      placeholder="e.g., Booking Confirmed - {{bookingNumber}}"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Use {{`variableName`}} for dynamic content
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Title *
                    </label>
                    <input
                      type="text"
                      value={formData.title || ''}
                      onChange={(e) => handleInputChange('title', e.target.value)}
                      placeholder="e.g., Booking Confirmed"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Message *
                    </label>
                    <textarea
                      value={formData.message || ''}
                      onChange={(e) => handleInputChange('message', e.target.value)}
                      placeholder="Your notification message with {{variables}}..."
                      rows={6}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      HTML Content (Optional)
                    </label>
                    <textarea
                      value={formData.htmlContent || ''}
                      onChange={(e) => handleInputChange('htmlContent', e.target.value)}
                      placeholder="Rich HTML content for emails..."
                      rows={8}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                    />
                  </div>
                </div>
              )}

              {/* Variables Tab */}
              {activeTab === 'variables' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-lg font-medium text-gray-900">Template Variables</h4>
                      <p className="text-sm text-gray-600">Define dynamic content placeholders</p>
                    </div>
                    <button
                      onClick={addVariable}
                      className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                      Add Variable
                    </button>
                  </div>

                  <div className="space-y-4">
                    {formData.variables?.map((variable, index) => (
                      <div key={`-${index}-${variable.name}`} className="p-4 border border-gray-200 rounded-lg">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Variable Name *
                            </label>
                            <input
                              type="text"
                              value={variable.name}
                              onChange={(e) => handleVariableChange(index, 'name', e.target.value)}
                              placeholder="e.g., guestName"
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Type *
                            </label>
                            <select
                              value={variable.type}
                              onChange={(e) => handleVariableChange(index, 'type', e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            >
                              <option value="string">String</option>
                              <option value="number">Number</option>
                              <option value="date">Date</option>
                              <option value="boolean">Boolean</option>
                              <option value="currency">Currency</option>
                            </select>
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Description *
                            </label>
                            <input
                              type="text"
                              value={variable.description}
                              onChange={(e) => handleVariableChange(index, 'description', e.target.value)}
                              placeholder="e.g., Guest's full name"
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Default Value
                            </label>
                            <input
                              type="text"
                              value={variable.defaultValue || ''}
                              onChange={(e) => handleVariableChange(index, 'defaultValue', e.target.value)}
                              placeholder="Optional default value"
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                          </div>
                        </div>

                        <div className="flex items-center justify-between mt-4">
                          <label className="flex items-center space-x-2">
                            <input
                              type="checkbox"
                              checked={variable.required}
                              onChange={(e) => handleVariableChange(index, 'required', e.target.checked)}
                              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                            <span className="text-sm text-gray-700">Required</span>
                          </label>

                          <button
                            onClick={() => removeVariable(index)}
                            className="flex items-center gap-2 px-3 py-1 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                            Remove
                          </button>
                        </div>
                      </div>
                    ))}

                    {(!formData.variables || formData.variables.length === 0) && (
                      <div className="text-center py-8 text-gray-500">
                        <Settings className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                        <p>No variables defined yet</p>
                        <p className="text-sm">Click "Add Variable" to create dynamic content placeholders</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Routing Tab */}
              {activeTab === 'routing' && (
                <div className="space-y-6">
                  <div>
                    <h4 className="text-lg font-medium text-gray-900 mb-4">Notification Routing</h4>

                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-3">
                          Target Roles *
                        </label>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          {roles.map(role => (
                            <label key={role.value} className="flex items-center space-x-2">
                              <input
                                type="checkbox"
                                checked={formData.routing?.targetRoles?.includes(role.value) || false}
                                onChange={(e) => {
                                  const currentRoles = formData.routing?.targetRoles || [];
                                  const updatedRoles = e.target.checked
                                    ? [...currentRoles, role.value]
                                    : currentRoles.filter(r => r !== role.value);
                                  handleNestedInputChange('routing', 'targetRoles', updatedRoles);
                                }}
                                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                              />
                              <span className="text-sm text-gray-700">{role.label}</span>
                            </label>
                          ))}
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Departments (Optional)
                        </label>
                        <input
                          type="text"
                          value={formData.routing?.departments?.join(', ') || ''}
                          onChange={(e) => {
                            const departments = e.target.value.split(',').map(d => d.trim()).filter(Boolean);
                            handleNestedInputChange('routing', 'departments', departments);
                          }}
                          placeholder="e.g., Housekeeping, Maintenance, Front Desk"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          Comma-separated department names for staff filtering
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-gray-200 pt-6">
                    <h5 className="font-medium text-gray-900 mb-4">Scheduling Options</h5>

                    <div className="space-y-4">
                      <label className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={formData.scheduling?.immediate || false}
                          onChange={(e) => handleNestedInputChange('scheduling', 'immediate', e.target.checked)}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-700">Send immediately</span>
                      </label>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Delay (minutes)
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={formData.scheduling?.delay || 0}
                          onChange={(e) => handleNestedInputChange('scheduling', 'delay', parseInt(e.target.value) || 0)}
                          className="w-32 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>

                      <label className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={formData.scheduling?.respectQuietHours || false}
                          onChange={(e) => handleNestedInputChange('scheduling', 'respectQuietHours', e.target.checked)}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-700">Respect quiet hours</span>
                      </label>
                    </div>
                  </div>
                </div>
              )}

              {/* Preview Tab */}
              {activeTab === 'preview' && (
                <div className="space-y-6">
                  <div>
                    <h4 className="text-lg font-medium text-gray-900 mb-4">Template Preview</h4>

                    {formData.variables && formData.variables.length > 0 && (
                      <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                        <h5 className="font-medium text-gray-900 mb-3">Test Variables</h5>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {formData.variables.map((variable, index) => (
                            <div key={`formData-variables-${index}-${variable.name}`}>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                {variable.name} {variable.required && '*'}
                              </label>
                              <input
                                type={variable.type === 'number' ? 'number' :
                                      variable.type === 'date' ? 'date' : 'text'}
                                value={previewVariables[variable.name] || ''}
                                onChange={(e) => setPreviewVariables(prev => ({
                                  ...prev,
                                  [variable.name]: e.target.value
                                }))}
                                placeholder={variable.description}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              />
                            </div>
                          ))}
                        </div>

                        {templateId && (
                          <button
                            onClick={handlePreview}
                            disabled={previewMutation.isPending}
                            className="mt-4 flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                          >
                            {previewMutation.isPending ? (
                              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            ) : (
                              <Eye className="w-4 h-4" />
                            )}
                            Generate Preview
                          </button>
                        )}
                      </div>
                    )}

                    <div className="space-y-4">
                      <div className="p-4 border border-gray-200 rounded-lg">
                        <h6 className="font-medium text-gray-900 mb-2">Subject Line</h6>
                        <p className="text-sm text-gray-700 bg-gray-50 p-2 rounded">
                          {formData.subject || 'No subject defined'}
                        </p>
                      </div>

                      <div className="p-4 border border-gray-200 rounded-lg">
                        <h6 className="font-medium text-gray-900 mb-2">Title</h6>
                        <p className="text-sm text-gray-700 bg-gray-50 p-2 rounded">
                          {formData.title || 'No title defined'}
                        </p>
                      </div>

                      <div className="p-4 border border-gray-200 rounded-lg">
                        <h6 className="font-medium text-gray-900 mb-2">Message</h6>
                        <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded whitespace-pre-wrap">
                          {formData.message || 'No message defined'}
                        </p>
                      </div>

                      {previewMutation.data && (
                        <div className="p-4 border-2 border-blue-200 bg-blue-50 rounded-lg">
                          <h6 className="font-medium text-blue-900 mb-3 flex items-center gap-2">
                            <CheckCircle className="w-5 h-5" />
                            Live Preview
                          </h6>

                          <div className="space-y-3">
                            <div>
                              <span className="text-xs font-medium text-blue-800">SUBJECT:</span>
                              <p className="text-sm text-blue-900 font-medium">
                                {previewMutation.data.subject}
                              </p>
                            </div>

                            <div>
                              <span className="text-xs font-medium text-blue-800">TITLE:</span>
                              <p className="text-sm text-blue-900 font-medium">
                                {previewMutation.data.title}
                              </p>
                            </div>

                            <div>
                              <span className="text-xs font-medium text-blue-800">MESSAGE:</span>
                              <p className="text-sm text-blue-900 whitespace-pre-wrap">
                                {previewMutation.data.message}
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
          <div className="flex justify-between items-center">
            <div className="text-sm text-gray-600">
              {saveTemplateMutation.error && (
                <span className="flex items-center gap-2 text-red-600">
                  <AlertTriangle className="w-4 h-4" />
                  Error saving template
                </span>
              )}
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={onClose}
                className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button aria-label="Save"
                onClick={handleSave}
                disabled={saveTemplateMutation.isPending || !formData.name || !formData.subject || !formData.message}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saveTemplateMutation.isPending ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                {templateId ? 'Update Template' : 'Create Template'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default withErrorBoundary(TemplateEditor, { level: 'component' });