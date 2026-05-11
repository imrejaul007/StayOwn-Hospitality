import React, { useState } from 'react';
import {
  Search,
  ChevronDown,
  ChevronUp,
  Mail,
  Bell,
  Smartphone,
  MessageSquare,
  Eye,
  Play,
  Settings,
  X
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../context/AuthContext';
import { apiRequest } from '../../services/api';

interface TemplateVariable {
  name: string;
  description: string;
  type: 'string' | 'number' | 'date' | 'boolean' | 'currency';
  required: boolean;
  defaultValue?: string;
}

interface NotificationTemplate {
  _id: string;
  name: string;
  description: string;
  category: string;
  type: string;
  subject: string;
  title: string;
  message: string;
  channels: string[];
  priority: 'low' | 'medium' | 'high' | 'urgent';
  variables: TemplateVariable[];
  routing: {
    targetRoles: string[];
    departments?: string[];
  };
  usage: {
    timesUsed: number;
    avgDeliveryRate: number;
    avgReadRate: number;
  };
  metadata: {
    isSystem: boolean;
  };
}

interface TemplateSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTemplate: (template: NotificationTemplate, variables?: Record<string, unknown>) => void;
  category?: string;
  type?: string;
  targetRole?: string;
  className?: string;
}

export const TemplateSelector: React.FC<TemplateSelectorProps> = ({
  isOpen,
  onClose,
  onSelectTemplate,
  category,
  type,
  targetRole,
  className = ''
}) => {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState(category || '');
  const [expandedTemplate, setExpandedTemplate] = useState<string | null>(null);
  const [templateVariables, setTemplateVariables] = useState<Record<string, Record<string, unknown>>>({});

  // Fetch templates
  const { data: templatesData, isLoading } = useQuery({
    queryKey: ['notification-templates-selector', searchQuery, categoryFilter, type, targetRole],
    queryFn: async () => {
      const params = new URLSearchParams({
        limit: '50' // Get more templates for selection
      });

      if (searchQuery) params.append('search', searchQuery);
      if (categoryFilter) params.append('category', categoryFilter);
      if (type) params.append('type', type);

      const response = await apiRequest(`/api/v1/notifications/templates?${params}`);
      let templates = response.data.templates;

      // Filter by target role if specified
      if (targetRole) {
        templates = templates.filter((template: NotificationTemplate) =>
          template.routing.targetRoles.includes(targetRole)
        );
      }

      return templates;
    },
    enabled: isOpen,
    staleTime: 30000
  });

  const handleTemplateSelect = (template: NotificationTemplate) => {
    if (template.variables && template.variables.length > 0) {
      // Expand to show variable inputs
      setExpandedTemplate(expandedTemplate === template._id ? null : template._id);
    } else {
      // No variables needed, select immediately
      onSelectTemplate(template);
    }
  };

  const handleVariableChange = (templateId: string, variableName: string, value: unknown) => {
    setTemplateVariables(prev => ({
      ...prev,
      [templateId]: {
        ...prev[templateId],
        [variableName]: value
      }
    }));
  };

  const handleUseTemplate = (template: NotificationTemplate) => {
    const variables = templateVariables[template._id] || {};
    onSelectTemplate(template, variables);
  };

  const getChannelIcon = (channel: string) => {
    switch (channel) {
      case 'email': return <Mail className="w-3 h-3" />;
      case 'in_app': return <Bell className="w-3 h-3" />;
      case 'push': return <Smartphone className="w-3 h-3" />;
      case 'sms': return <MessageSquare className="w-3 h-3" />;
      case 'browser': return <Eye className="w-3 h-3" />;
      default: return <Bell className="w-3 h-3" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-red-100 text-red-800';
      case 'high': return 'bg-orange-100 text-orange-800';
      case 'medium': return 'bg-blue-100 text-blue-800';
      case 'low': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const categories = [
    'booking', 'payment', 'service', 'maintenance', 'inventory',
    'system', 'security', 'promotional', 'emergency', 'staff',
    'guest_experience', 'loyalty', 'review'
  ];

  const templates = templatesData || [];

  if (!isOpen) return null;

  return (
    <div className={`fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 ${className}`}>
      <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[85vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Select Notification Template</h3>
              <p className="text-sm text-gray-600">Choose a template to customize your notification</p>
            </div>
            <button aria-label="Close"
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search templates..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">All Categories</option>
              {categories.map(cat => (
                <option key={cat} value={cat}>
                  {cat.charAt(0).toUpperCase() + cat.slice(1).replace('_', ' ')}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Templates List */}
        <div className="px-6 py-4 max-h-96 overflow-y-auto">
          {isLoading ? (
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="animate-pulse p-4 border border-gray-200 rounded-lg">
                  <div className="flex items-center justify-between mb-3">
                    <div className="h-4 bg-gray-200 rounded w-1/4"></div>
                    <div className="h-6 bg-gray-200 rounded w-16"></div>
                  </div>
                  <div className="h-3 bg-gray-200 rounded w-3/4 mb-3"></div>
                  <div className="flex items-center gap-4">
                    <div className="h-3 bg-gray-200 rounded w-20"></div>
                    <div className="h-3 bg-gray-200 rounded w-16"></div>
                  </div>
                </div>
              ))}
            </div>
          ) : templates.length === 0 ? (
            <div className="text-center py-8">
              <Settings className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-600">No templates found</p>
              <p className="text-sm text-gray-500">
                {searchQuery || categoryFilter
                  ? 'Try adjusting your search filters'
                  : 'Create some templates first to use them here'
                }
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {templates.map((template: NotificationTemplate) => (
                <div
                  key={template._id}
                  className="border border-gray-200 rounded-lg hover:shadow-sm transition-shadow"
                >
                  <div className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-2">
                          <h4 className="text-base font-medium text-gray-900 truncate">
                            {template.name}
                          </h4>

                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getPriorityColor(template.priority)}`}>
                            {template.priority}
                          </span>

                          {template.metadata.isSystem && (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                              System
                            </span>
                          )}
                        </div>

                        <p className="text-sm text-gray-600 mb-3">
                          {template.description || 'No description provided'}
                        </p>

                        <div className="flex items-center gap-6 text-xs text-gray-500 mb-3">
                          <div className="flex items-center gap-1">
                            <span className="font-medium">Category:</span>
                            <span className="capitalize">{template.category.replace('_', ' ')}</span>
                          </div>

                          <div className="flex items-center gap-2">
                            <span className="font-medium">Channels:</span>
                            <div className="flex items-center gap-1">
                              {template.channels.map((channel, index) => (
                                <div
                                  key={`template-channels-${index}-${channel}`}
                                  className="w-5 h-5 bg-gray-100 rounded flex items-center justify-center"
                                  title={channel}
                                >
                                  {getChannelIcon(channel)}
                                </div>
                              ))}
                            </div>
                          </div>

                          {template.variables && template.variables.length > 0 && (
                            <div className="flex items-center gap-1">
                              <Settings className="w-3 h-3" />
                              <span>{template.variables.length} variable{template.variables.length !== 1 ? 's' : ''}</span>
                            </div>
                          )}
                        </div>

                        <div className="text-sm text-gray-700 bg-gray-50 p-2 rounded">
                          <strong>Preview:</strong> {template.subject}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 ml-4">
                        <button aria-label="Settings"
                          onClick={() => handleTemplateSelect(template)}
                          className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                        >
                          {template.variables && template.variables.length > 0 ? (
                            <>
                              <Settings className="w-4 h-4" />
                              Configure
                            </>
                          ) : (
                            <>
                              <Play className="w-4 h-4" />
                              Use Template
                            </>
                          )}
                        </button>

                        {template.variables && template.variables.length > 0 && (
                          <button aria-label="Expand"
                            onClick={() => setExpandedTemplate(expandedTemplate === template._id ? null : template._id)}
                            className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                          >
                            {expandedTemplate === template._id ? (
                              <ChevronUp className="w-4 h-4" />
                            ) : (
                              <ChevronDown className="w-4 h-4" />
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Variable Configuration */}
                  {expandedTemplate === template._id && template.variables && (
                    <div className="border-t border-gray-200 px-4 py-4 bg-gray-50">
                      <h5 className="text-sm font-medium text-gray-900 mb-3">Configure Variables</h5>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                        {template.variables.map((variable, index) => (
                          <div key={`template-variables-${index}-${variable.name}`}>
                            <label className="block text-xs font-medium text-gray-700 mb-1">
                              {variable.name}
                              {variable.required && <span className="text-red-500 ml-1">*</span>}
                            </label>
                            <input
                              type={
                                variable.type === 'number' ? 'number' :
                                variable.type === 'date' ? 'date' :
                                variable.type === 'boolean' ? 'checkbox' :
                                'text'
                              }
                              placeholder={variable.description}
                              defaultValue={variable.defaultValue}
                              onChange={(e) => handleVariableChange(
                                template._id,
                                variable.name,
                                variable.type === 'boolean' ? e.target.checked : e.target.value
                              )}
                              className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                          </div>
                        ))}
                      </div>

                      <div className="flex justify-end">
                        <button
                          onClick={() => handleUseTemplate(template)}
                          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                        >
                          <Play className="w-4 h-4" />
                          Use Template
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
          <div className="flex justify-between items-center">
            <p className="text-sm text-gray-600">
              {templates.length} template{templates.length !== 1 ? 's' : ''} available
            </p>
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TemplateSelector;