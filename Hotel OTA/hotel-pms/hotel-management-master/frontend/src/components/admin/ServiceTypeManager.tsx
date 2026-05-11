import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import {
  Plus,
  Edit2,
  Trash2,
  Save,
  X,
  Clock,
  DollarSign,
  Settings,
  Star,
  AlertCircle,
  CheckCircle,
  Package
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Modal } from '@/components/ui/Modal';
import { serviceTypeService, ServiceType, ServiceVariation, ServiceTemplate } from '../../services/serviceTypeService';
import { useAuth } from '../../context/AuthContext';
import { withErrorBoundary } from '../ErrorBoundary';

// Using imported types from serviceTypeService

const ServiceTypeCardInfo = React.memo(({ service }: { service: ServiceType }) => (
  <CardContent>
    <div className="space-y-3">
      <p className="text-sm text-gray-700">{service.description}</p>
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="flex items-center">
          <DollarSign className="w-4 h-4 text-green-600 mr-1" />
          <span>{'\u20B9'}{service.basePrice}</span>
        </div>
        <div className="flex items-center">
          <Clock className="w-4 h-4 text-blue-600 mr-1" />
          <span>{service.estimatedDuration}m</span>
        </div>
      </div>
      <div className="flex items-center text-sm">
        <AlertCircle className="w-4 h-4 text-orange-600 mr-1" />
        <span>SLA: {service.slaTime} minutes</span>
      </div>
      {service.variations.length > 0 && (
        <div>
          <p className="text-xs font-medium text-gray-700 mb-1">Variations:</p>
          <div className="flex flex-wrap gap-1">
            {service.variations.slice(0, 2).map((variation, index) => (
              <span
                key={`variation-${index}-${variation.name}`}
                className="inline-block px-2 py-1 bg-gray-100 text-xs rounded"
              >
                {variation.name}
              </span>
            ))}
            {service.variations.length > 2 && (
              <span className="inline-block px-2 py-1 bg-gray-100 text-xs rounded">
                +{service.variations.length - 2} more
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  </CardContent>
));
ServiceTypeCardInfo.displayName = 'ServiceTypeCardInfo';

interface ServiceTypeManagerProps {
  hotelId?: string;
}

const ServiceTypeManager: React.FC<ServiceTypeManagerProps> = ({ hotelId: propHotelId }) => {
  const { user } = useAuth();
  const [serviceTypes, setServiceTypes] = useState<ServiceType[]>([]);
  const [templates, setTemplates] = useState<ServiceTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingService, setEditingService] = useState<ServiceType | null>(null);
  const [editingTemplate, setEditingTemplate] = useState<ServiceTemplate | null>(null);
  const [showServiceModal, setShowServiceModal] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'types' | 'templates'>('types');

  // Use prop hotelId (from property context) or fall back to user's hotelId
  const resolvedHotelId = (() => {
    if (propHotelId) return propHotelId;
    const raw = user?.hotelId;
    if (!raw) return undefined;
    if (typeof raw === 'string') return raw;
    if (typeof raw === 'object' && raw !== null && '_id' in raw) return String((raw as { _id: string })._id);
    return String(raw);
  })();

  useEffect(() => {
    if (resolvedHotelId) {
      fetchServiceTypes();
    }
  }, [resolvedHotelId]);

  // Fetch templates when service types change
  useEffect(() => {
    if (serviceTypes.length > 0) {
      fetchTemplates();
    }
  }, [serviceTypes]);

  const fetchServiceTypes = async () => {
    try {
      setLoading(true);
      const response = await serviceTypeService.getServiceTypes({
        hotelId: resolvedHotelId,
        activeOnly: false
      });

      // If no service types exist, offer to create defaults
      if (response.serviceTypes.length === 0) {
        const shouldCreateDefaults = window.confirm(
          'No service types found. Would you like to create default service types for your hotel?'
        );

        if (shouldCreateDefaults && resolvedHotelId) {
          await createDefaultServiceTypes();
          return; // fetchServiceTypes will be called again after creation
        }
      }

      setServiceTypes(response.serviceTypes);
    } catch (error) {
      toast.error('Failed to load service types');
    } finally {
      setLoading(false);
    }
  };

  const createDefaultServiceTypes = async () => {
    try {
      if (!resolvedHotelId) {
        toast.error('Hotel ID not found');
        return;
      }

      setLoading(true);
      await serviceTypeService.createDefaultServiceTypes(resolvedHotelId);
      toast.success('Default service types created successfully');

      // Fetch the newly created service types
      await fetchServiceTypes();
    } catch (error) {
      toast.error('Failed to create default service types');
    }
  };

  const fetchTemplates = async () => {
    try {
      // Extract templates from all service types
      const allTemplates: ServiceTemplate[] = [];

      serviceTypes.forEach(serviceType => {
        if (serviceType.templates) {
          serviceType.templates.forEach(template => {
            allTemplates.push({
              ...template,
              services: template.services || [serviceType.name] // Use service names instead of types
            });
          });
        }
      });

      setTemplates(allTemplates);
    } catch (error) {
      toast.error('Failed to load service templates');
    }
  };

  // Helper function to format service type display
  const formatServiceTypeName = (type: string): string => {
    return type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const handleSaveServiceType = async (serviceType: ServiceType) => {
    try {
      if (serviceType._id) {
        // Update existing service type
        await serviceTypeService.updateServiceType(serviceType._id, serviceType);
        toast.success('Service type updated successfully');
      } else {
        // Create new service type
        await serviceTypeService.createServiceType({
          ...serviceType,
          hotelId: resolvedHotelId || '',
          variations: serviceType.variations || [],
          templates: serviceType.templates || []
        });
        toast.success('Service type created successfully');
      }

      // Refresh the list
      await fetchServiceTypes();
      setShowServiceModal(false);
      setEditingService(null);
    } catch (error) {
      toast.error('Failed to save service type');
    }
  };

  const handleDeleteServiceType = async (serviceId: string) => {
    if (window.confirm('Are you sure you want to delete this service type?')) {
      try {
        await serviceTypeService.deleteServiceType(serviceId);
        await fetchServiceTypes(); // Refresh the list
        toast.success('Service type deleted successfully');
      } catch (error) {
        toast.error('Failed to delete service type');
      }
    }
  };

  const handleSaveTemplate = async (template: ServiceTemplate & { serviceTypeId?: string }) => {
    try {
      if (!template.serviceTypeId) {
        toast.error('Please select a service type for this template');
        return;
      }

      const serviceType = serviceTypes.find(st => st._id === template.serviceTypeId);
      if (!serviceType) {
        toast.error('Service type not found');
        return;
      }

      // Prepare the template data for the API
      const templateData = {
        name: template.name,
        description: template.description,
        services: template.services,
        totalPrice: template.totalPrice || serviceType.basePrice,
        estimatedDuration: template.estimatedDuration || serviceType.estimatedDuration,
        priority: template.priority || 0
      };

      // Add template to the service type
      await serviceTypeService.addTemplate(template.serviceTypeId, templateData);

      // Refresh service types to get updated templates
      await fetchServiceTypes();

      toast.success('Template saved successfully');
      setShowTemplateModal(false);
      setEditingTemplate(null);
    } catch (error) {
      toast.error('Failed to save template');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Tab Navigation */}
      <div className="flex space-x-1 bg-gray-100 rounded-lg p-1">
        <button
          onClick={() => setActiveTab('types')}
          className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'types'
              ? 'bg-white text-blue-600 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <Settings className="w-4 h-4 inline mr-2" />
          Service Types
        </button>
        <button
          onClick={() => setActiveTab('templates')}
          className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'templates'
              ? 'bg-white text-blue-600 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <Package className="w-4 h-4 inline mr-2" />
          Service Templates
        </button>
      </div>

      {/* Service Types Tab */}
      {activeTab === 'types' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Service Types Configuration</h3>
              <p className="text-gray-600">Manage service categories, pricing, and SLA times</p>
            </div>
            <Button
              onClick={() => {
                setEditingService({
                  hotelId: resolvedHotelId || '',
                  type: 'room_service',
                  name: '',
                  description: '',
                  basePrice: 0,
                  estimatedDuration: 30,
                  slaTime: 60,
                  isActive: true,
                  variations: [],
                  templates: []
                });
                setShowServiceModal(true);
              }}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Service Type
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {serviceTypes.map((service) => (
              <Card key={service._id || service.type} className="hover:shadow-lg transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-lg">{service.name}</CardTitle>
                      <p className="text-sm text-gray-600">{formatServiceTypeName(service.type)}</p>
                    </div>
                    <div className="flex space-x-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setEditingService(service);
                          setShowServiceModal(true);
                        }}
                      >
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => service._id && handleDeleteServiceType(service._id)}
                      >
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <ServiceTypeCardInfo service={service} />
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Service Templates Tab */}
      {activeTab === 'templates' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Service Templates</h3>
              <p className="text-gray-600">Pre-configured service packages for quick requests</p>
            </div>
            <Button
              onClick={() => {
                setEditingTemplate({
                  name: '',
                  description: '',
                  services: [],
                  totalPrice: 0,
                  estimatedDuration: 30,
                  priority: 0,
                  isActive: true
                });
                setShowTemplateModal(true);
              }}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Template
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {templates.map((template) => (
              <Card key={template._id} className="hover:shadow-lg transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-lg">{template.name}</CardTitle>
                      <p className="text-sm text-gray-600">
                        ₹{template.totalPrice} • {template.estimatedDuration}min
                      </p>
                    </div>
                    <div className="flex space-x-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setEditingTemplate(template);
                          setShowTemplateModal(true);
                        }}
                      >
                        <Edit2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <p className="text-sm text-gray-700">{template.description}</p>

                    <div>
                      <p className="text-xs font-medium text-gray-700 mb-1">Included Services:</p>
                      <div className="flex flex-wrap gap-1">
                        {template.services.map((service, index) => (
                          <span
                            key={`template-services-${index}-${service}`}
                            className="inline-block px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded"
                          >
                            {service}
                          </span>
                        ))}
                      </div>
                    </div>

                    {template.priority !== undefined && template.priority > 0 && (
                      <div className="flex items-center">
                        <Star className="w-4 h-4 text-yellow-500 mr-1" />
                        <span className="text-xs text-gray-600">Priority: {template.priority}</span>
                      </div>
                    )}

                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        {template.isActive ? (
                          <CheckCircle className="w-4 h-4 text-green-600 mr-1" />
                        ) : (
                          <X className="w-4 h-4 text-red-600 mr-1" />
                        )}
                        <span className="text-xs">
                          {template.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Service Type Edit Modal */}
      {showServiceModal && editingService && (
        <ServiceTypeEditModal
          service={editingService}
          onSave={handleSaveServiceType}
          onClose={() => {
            setShowServiceModal(false);
            setEditingService(null);
          }}
        />
      )}

      {/* Template Edit Modal */}
      {showTemplateModal && editingTemplate && (
        <ServiceTemplateEditModal
          template={editingTemplate}
          availableServiceTypes={serviceTypes}
          onSave={handleSaveTemplate}
          onClose={() => {
            setShowTemplateModal(false);
            setEditingTemplate(null);
          }}
        />
      )}
    </div>
  );
};

// Service Type Edit Modal Component
const ServiceTypeEditModal: React.FC<{
  service: ServiceType;
  onSave: (service: ServiceType) => void;
  onClose: () => void;
}> = ({ service, onSave, onClose }) => {
  const [formData, setFormData] = useState<ServiceType>(service);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  const addVariation = () => {
    setFormData(prev => ({
      ...prev,
      variations: [
        ...prev.variations,
        { name: '', description: '', additionalPrice: 0, isActive: true }
      ]
    }));
  };

  const updateVariation = (index: number, field: keyof ServiceVariation, value: unknown) => {
    setFormData(prev => ({
      ...prev,
      variations: prev.variations.map((variation, i) =>
        i === index ? { ...variation, [field]: value } : variation
      )
    }));
  };

  const removeVariation = (index: number) => {
    setFormData(prev => ({
      ...prev,
      variations: prev.variations.filter((_, i) => i !== index)
    }));
  };

  return (
    <Modal isOpen={true} onClose={onClose} title="Edit Service Type">
      <form onSubmit={handleSubmit} className="space-y-6 max-h-96 overflow-y-auto">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Service Type</label>
            <select
              value={formData.type}
              onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value as ServiceType['type'] }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            >
              <option value="room_service">Room Service</option>
              <option value="housekeeping">Housekeeping</option>
              <option value="maintenance">Maintenance</option>
              <option value="concierge">Concierge</option>
              <option value="transport">Transport</option>
              <option value="spa">Spa</option>
              <option value="laundry">Laundry</option>
              <option value="other">Other</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Base Price (₹)</label>
            <input
              type="number"
              value={formData.basePrice}
              onChange={(e) => setFormData(prev => ({ ...prev, basePrice: parseInt(e.target.value) }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              min="0"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Duration (min)</label>
            <input
              type="number"
              value={formData.estimatedDuration}
              onChange={(e) => setFormData(prev => ({ ...prev, estimatedDuration: parseInt(e.target.value) }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              min="1"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">SLA (min)</label>
            <input
              type="number"
              value={formData.slaTime}
              onChange={(e) => setFormData(prev => ({ ...prev, slaTime: parseInt(e.target.value) }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              min="1"
              required
            />
          </div>
        </div>

        <div>
          <div className="flex justify-between items-center mb-3">
            <label className="block text-sm font-medium text-gray-700">Service Variations</label>
            <Button type="button" onClick={addVariation} size="sm" variant="outline">
              <Plus className="w-4 h-4 mr-1" />
              Add Variation
            </Button>
          </div>

          {formData.variations.map((variation, index) => (
            <div key={`formData-variations-${index}-${variation.name}`} className="border border-gray-200 rounded-md p-3 mb-2">
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="text"
                  required
                  placeholder="Variation name"
                  value={variation.name}
                  onChange={(e) => updateVariation(index, 'name', e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-md text-sm"
                />
                <input
                  type="number"
                  placeholder="Additional price"
                  value={variation.additionalPrice}
                  onChange={(e) => updateVariation(index, 'additionalPrice', parseInt(e.target.value) || 0)}
                  className="px-3 py-2 border border-gray-300 rounded-md text-sm"
                />
              </div>
              <div className="mt-2 flex justify-between items-center">
                <input
                  type="text"
                  placeholder="Description"
                  value={variation.description}
                  onChange={(e) => updateVariation(index, 'description', e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm"
                />
                <Button
                  type="button"
                  onClick={() => removeVariation(index)}
                  size="sm"
                  variant="ghost"
                  className="ml-2"
                >
                  <Trash2 className="w-4 h-4 text-red-500" />
                </Button>
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center">
          <input
            type="checkbox"
            checked={formData.isActive}
            onChange={(e) => setFormData(prev => ({ ...prev, isActive: e.target.checked }))}
            className="mr-2"
          />
          <label className="text-sm text-gray-700">Active</label>
        </div>

        <div className="flex justify-end space-x-3 pt-4 border-t">
          <Button type="button" onClick={onClose} variant="outline">
            Cancel
          </Button>
          <Button type="submit" className="bg-blue-600 hover:bg-blue-700">
            <Save className="w-4 h-4 mr-2" />
            Save Service Type
          </Button>
        </div>
      </form>
    </Modal>
  );
};

// Service Template Edit Modal Component
const ServiceTemplateEditModal: React.FC<{
  template: ServiceTemplate;
  availableServiceTypes: ServiceType[];
  onSave: (template: ServiceTemplate & { serviceTypeId?: string }) => void;
  onClose: () => void;
}> = ({ template, availableServiceTypes, onSave, onClose }) => {
  const [formData, setFormData] = useState<ServiceTemplate & { serviceTypeId?: string }>({
    ...template,
    serviceTypeId: '', // Will be selected by user
    totalPrice: template.totalPrice || 0,
    estimatedDuration: template.estimatedDuration || 30,
    priority: template.priority || 0
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  const addService = () => {
    setFormData(prev => ({
      ...prev,
      services: [...prev.services, '']
    }));
  };

  const updateService = (index: number, value: string) => {
    setFormData(prev => ({
      ...prev,
      services: prev.services.map((service, i) => i === index ? value : service)
    }));
  };

  const removeService = (index: number) => {
    setFormData(prev => ({
      ...prev,
      services: prev.services.filter((_, i) => i !== index)
    }));
  };

  return (
    <Modal isOpen={true} onClose={onClose} title="Create Service Template">
      <form onSubmit={handleSubmit} className="space-y-6 max-h-96 overflow-y-auto">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Service Type</label>
          <select
            value={formData.serviceTypeId}
            onChange={(e) => setFormData(prev => ({ ...prev, serviceTypeId: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          >
            <option value="">Select a service type</option>
            {availableServiceTypes.map((serviceType) => (
              <option key={serviceType._id} value={serviceType._id}>
                {serviceType.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Template Name</label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Total Price (₹)</label>
            <input
              type="number"
              value={formData.totalPrice}
              onChange={(e) => setFormData(prev => ({ ...prev, totalPrice: parseInt(e.target.value) }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              min="0"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Estimated Duration (minutes)</label>
            <input
              type="number"
              value={formData.estimatedDuration}
              onChange={(e) => setFormData(prev => ({ ...prev, estimatedDuration: parseInt(e.target.value) }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              min="1"
              required
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Priority (0-10)</label>
          <input
            type="number"
            value={formData.priority}
            onChange={(e) => setFormData(prev => ({ ...prev, priority: parseInt(e.target.value) }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            min="0"
            max="10"
          />
        </div>

        <div>
          <div className="flex justify-between items-center mb-3">
            <label className="block text-sm font-medium text-gray-700">Included Services</label>
            <Button
              type="button"
              onClick={addService}
              className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 text-sm"
            >
              <Plus className="w-4 h-4" />
            </Button>
          </div>
          <div className="space-y-2 max-h-32 overflow-y-auto">
            {formData.services.map((service, index) => (
              <div key={`formData-services-${index}-${service}`} className="flex gap-2">
                <input
                  type="text"
                  required
                  value={service}
                  onChange={(e) => updateService(index, e.target.value)}
                  placeholder="Service name (e.g., Welcome drink, Room setup)"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <Button
                  type="button"
                  onClick={() => removeService(index)}
                  className="bg-red-600 hover:bg-red-700 text-white px-2 py-1"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center">
          <input
            type="checkbox"
            checked={formData.isActive !== false}
            onChange={(e) => setFormData(prev => ({ ...prev, isActive: e.target.checked }))}
            className="mr-2"
          />
          <label className="text-sm text-gray-700">Active Template</label>
        </div>

        <div className="flex justify-end space-x-3 pt-4 border-t">
          <Button type="button" onClick={onClose} variant="outline">
            Cancel
          </Button>
          <Button type="submit" className="bg-blue-600 hover:bg-blue-700">
            <Save className="w-4 h-4 mr-2" />
            Save Template
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default withErrorBoundary(ServiceTypeManager, { level: 'component' });