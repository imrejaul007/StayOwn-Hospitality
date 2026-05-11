import React, { useState, useEffect } from 'react';
import { 
  Copy, 
  Edit, 
  Trash2, 
  Plus, 
  Save, 
  X, 
  Package, 
  Settings,
  Search,
  Filter,
  ChevronDown,
  ChevronRight
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LoadingSpinner } from '../LoadingSpinner';
import { formatCurrency } from '../../utils/formatters';
import { api } from '../../services/api';

interface InventoryItem {
  _id: string;
  name: string;
  category: string;
  unitPrice: number;
  replacementPrice: number;
  guestPrice: number;
  stockThreshold: number;
  isComplimentary: boolean;
  maxComplimentary: number;
}

interface TemplateItem {
  itemId: string;
  item?: InventoryItem;
  expectedQuantity: number;
  priority: 'low' | 'medium' | 'high' | 'critical';
  isRequired: boolean;
  notes?: string;
}

interface RoomInventoryTemplate {
  _id?: string;
  name: string;
  description: string;
  roomType: string;
  category: 'standard' | 'deluxe' | 'suite' | 'custom';
  items: TemplateItem[];
  isActive: boolean;
  isDefault: boolean;
  createdBy?: string;
  hotelId?: string;
  totalItems: number;
  totalValue: number;
}

export function InventoryTemplateManagement() {
  const [templates, setTemplates] = useState<RoomInventoryTemplate[]>([]);
  const [availableItems, setAvailableItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<RoomInventoryTemplate | null>(null);
  const [expandedTemplates, setExpandedTemplates] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');

  useEffect(() => {
    fetchTemplates();
    fetchAvailableItems();
  }, []);

  const fetchTemplates = async () => {
    try {
      const { data: data } = await api.get('/room-inventory/templates');
      setTemplates(data.data.templates);
    } catch {
      // Error handled silently
    }
  };

  const fetchAvailableItems = async () => {
    try {
      const { data: data } = await api.get('/room-inventory/items');
      setAvailableItems(data.data.items);
    } catch {
      // Error handled silently
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTemplate = () => {
    const newTemplate: RoomInventoryTemplate = {
      name: '',
      description: '',
      roomType: 'standard',
      category: 'custom',
      items: [],
      isActive: true,
      isDefault: false,
      totalItems: 0,
      totalValue: 0
    };
    setEditingTemplate(newTemplate);
    setShowCreateModal(true);
  };

  const handleEditTemplate = (template: RoomInventoryTemplate) => {
    setEditingTemplate({ ...template });
    setShowCreateModal(true);
  };

  const handleSaveTemplate = async (template: RoomInventoryTemplate) => {
    try {
      const method = template._id ? 'PATCH' : 'POST';
      const url = template._id 
        ? `/api/v1/room-inventory/templates/${template._id}`
        : '/api/v1/room-inventory/templates';

      const response = template._id
        ? await api.patch(`/room-inventory/templates/${template._id}`, template)
        : await api.post('/room-inventory/templates', template);
      await fetchTemplates();
      setShowCreateModal(false);
      setEditingTemplate(null);
    } catch {
      // Error handled silently
    }
  };

  const handleDeleteTemplate = async (templateId: string) => {
    if (!confirm('Are you sure you want to delete this template?')) return;

    try {
      await api.delete(`/room-inventory/templates/${templateId}`);
      await fetchTemplates();
    } catch {
      // Error handled silently
    }
  };

  const handleDuplicateTemplate = async (template: RoomInventoryTemplate) => {
    const duplicatedTemplate = {
      ...template,
      _id: undefined,
      name: `${template.name} (Copy)`,
      isDefault: false
    };
    setEditingTemplate(duplicatedTemplate);
    setShowCreateModal(true);
  };

  const toggleTemplateExpansion = (templateId: string) => {
    const newExpanded = new Set(expandedTemplates);
    if (newExpanded.has(templateId)) {
      newExpanded.delete(templateId);
    } else {
      newExpanded.add(templateId);
    }
    setExpandedTemplates(newExpanded);
  };

  const filteredTemplates = templates.filter(template => {
    const matchesSearch = template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         template.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = filterCategory === 'all' || template.category === filterCategory;
    return matchesSearch && matchesCategory;
  });

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'standard': return 'bg-blue-100 text-blue-800';
      case 'deluxe': return 'bg-green-100 text-green-800';
      case 'suite': return 'bg-purple-100 text-purple-800';
      case 'custom': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Room Inventory Templates</h1>
          <p className="text-gray-600 mt-1">Create and manage standard inventory configurations for different room types</p>
        </div>
        <Button onClick={handleCreateTemplate}>
          <Plus className="w-4 h-4 mr-2" />
          Create Template
        </Button>
      </div>

      {/* Search and Filter */}
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search templates..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div className="flex items-center space-x-2">
            <Filter className="w-4 h-4 text-gray-500" />
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">All Categories</option>
              <option value="standard">Standard</option>
              <option value="deluxe">Deluxe</option>
              <option value="suite">Suite</option>
              <option value="custom">Custom</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Templates List */}
      <div className="space-y-4">
        {filteredTemplates.length === 0 ? (
          <Card className="p-8 text-center">
            <Package className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No templates found</h3>
            <p className="text-gray-600 mb-4">
              {searchQuery || filterCategory !== 'all' 
                ? 'No templates match your search criteria.' 
                : 'Get started by creating your first inventory template.'
              }
            </p>
            <Button onClick={handleCreateTemplate}>
              <Plus className="w-4 h-4 mr-2" />
              Create Template
            </Button>
          </Card>
        ) : (
          filteredTemplates.map((template) => {
            const isExpanded = expandedTemplates.has(template._id || '');
            
            return (
              <Card key={template._id} className="overflow-hidden">
                <div className="p-6">
                  {/* Template Header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <button aria-label="Toggle"
                        onClick={() => toggleTemplateExpansion(template._id || '')}
                        className="p-1 hover:bg-gray-100 rounded"
                      >
                        {isExpanded ? (
                          <ChevronDown className="w-4 h-4" />
                        ) : (
                          <ChevronRight className="w-4 h-4" />
                        )}
                      </button>
                      
                      <div>
                        <div className="flex items-center space-x-3">
                          <h3 className="text-xl font-semibold text-gray-900">{template.name}</h3>
                          <Badge variant="secondary" className={getCategoryColor(template.category)}>
                            {template.category}
                          </Badge>
                          {template.isDefault && (
                            <Badge variant="primary">Default</Badge>
                          )}
                          {!template.isActive && (
                            <Badge variant="secondary" className="bg-red-100 text-red-800">
                              Inactive
                            </Badge>
                          )}
                        </div>
                        <p className="text-gray-600 mt-1">{template.description}</p>
                        <div className="flex items-center space-x-4 mt-2 text-sm text-gray-500">
                          <span>Room Type: {template.roomType}</span>
                          <span>Items: {template.totalItems}</span>
                          <span>Est. Value: {formatCurrency(template.totalValue)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleDuplicateTemplate(template)}
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleEditTemplate(template)}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleDeleteTemplate(template._id || '')}
                        className="text-red-600 hover:bg-red-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Expanded Template Items */}
                  {isExpanded && (
                    <div className="mt-6 pt-6 border-t border-gray-200">
                      <h4 className="font-semibold text-gray-900 mb-4">Template Items ({template.items.length})</h4>
                      {template.items.length === 0 ? (
                        <p className="text-gray-500 text-center py-4">No items in this template</p>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {template.items.map((templateItem, index) => {
                            const item = availableItems.find(i => i._id === templateItem.itemId);
                            return (
                              <div key={`template-items-${index}`} className="p-3 bg-gray-50 rounded-lg">
                                <div className="flex items-center justify-between mb-2">
                                  <span className="font-medium text-gray-900">
                                    {item?.name || 'Unknown Item'}
                                  </span>
                                  <Badge variant="secondary" className="text-xs">
                                    {templateItem.priority}
                                  </Badge>
                                </div>
                                <div className="text-sm text-gray-600 space-y-1">
                                  <p>Category: {item?.category}</p>
                                  <p>Quantity: {templateItem.expectedQuantity}</p>
                                  <p>Unit Price: {formatCurrency(item?.unitPrice || 0)}</p>
                                  {templateItem.isRequired && (
                                    <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 text-xs">
                                      Required
                                    </Badge>
                                  )}
                                </div>
                                {templateItem.notes && (
                                  <p className="text-xs text-gray-500 mt-2">{templateItem.notes}</p>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </Card>
            );
          })
        )}
      </div>

      {/* Create/Edit Template Modal */}
      {showCreateModal && editingTemplate && (
        <TemplateModal
          template={editingTemplate}
          availableItems={availableItems}
          onSave={handleSaveTemplate}
          onClose={() => {
            setShowCreateModal(false);
            setEditingTemplate(null);
          }}
        />
      )}
    </div>
  );
}

// Template Creation/Editing Modal Component
interface TemplateModalProps {
  template: RoomInventoryTemplate;
  availableItems: InventoryItem[];
  onSave: (template: RoomInventoryTemplate) => void;
  onClose: () => void;
}

function TemplateModal({ template, availableItems, onSave, onClose }: TemplateModalProps) {
  const [formData, setFormData] = useState<RoomInventoryTemplate>(template);
  const [searchItems, setSearchItems] = useState('');

  const handleAddItem = (item: InventoryItem) => {
    const newTemplateItem: TemplateItem = {
      itemId: item._id,
      item,
      expectedQuantity: 1,
      priority: 'medium',
      isRequired: false,
      notes: ''
    };

    setFormData(prev => ({
      ...prev,
      items: [...prev.items, newTemplateItem],
      totalItems: prev.totalItems + 1,
      totalValue: prev.totalValue + item.unitPrice
    }));
  };

  const handleRemoveItem = (index: number) => {
    const removedItem = formData.items[index];
    const item = availableItems.find(i => i._id === removedItem.itemId);
    
    setFormData(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index),
      totalItems: prev.totalItems - 1,
      totalValue: prev.totalValue - (item?.unitPrice || 0)
    }));
  };

  const handleItemChange = (index: number, field: keyof TemplateItem, value: unknown) => {
    const newItems = [...formData.items];
    newItems[index] = { ...newItems[index], [field]: value };
    
    // Recalculate total value if quantity changed
    if (field === 'expectedQuantity') {
      const item = availableItems.find(i => i._id === newItems[index].itemId);
      const oldQuantity = formData.items[index].expectedQuantity;
      const quantityDiff = value - oldQuantity;
      const valueDiff = quantityDiff * (item?.unitPrice || 0);
      
      setFormData(prev => ({
        ...prev,
        items: newItems,
        totalValue: prev.totalValue + valueDiff
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        items: newItems
      }));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  const filteredAvailableItems = availableItems.filter(item => 
    !formData.items.some(templateItem => templateItem.itemId === item._id) &&
    item.name.toLowerCase().includes(searchItems.toLowerCase())
  );

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-gray-900">
              {template._id ? 'Edit Template' : 'Create New Template'}
            </h2>
            <button aria-label="Close" onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        <div className="overflow-y-auto max-h-[calc(90vh-140px)]">
          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {/* Basic Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Template Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g. Standard Double Room"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Room Type
                </label>
                <input
                  type="text"
                  value={formData.roomType}
                  onChange={(e) => setFormData(prev => ({ ...prev, roomType: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g. Deluxe Double"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Describe what this template is for..."
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Category
                </label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData(prev => ({ 
                    ...prev, 
                    category: e.target.value as RoomInventoryTemplate['category'] 
                  }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="standard">Standard</option>
                  <option value="deluxe">Deluxe</option>
                  <option value="suite">Suite</option>
                  <option value="custom">Custom</option>
                </select>
              </div>
              
              <div className="flex items-center">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.isActive}
                    onChange={(e) => setFormData(prev => ({ ...prev, isActive: e.target.checked }))}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">Active</span>
                </label>
              </div>
              
              <div className="flex items-center">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.isDefault}
                    onChange={(e) => setFormData(prev => ({ ...prev, isDefault: e.target.checked }))}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">Set as Default</span>
                </label>
              </div>
            </div>

            {/* Template Items */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Template Items ({formData.items.length})
              </h3>
              
              {/* Add Items Section */}
              <Card className="p-4 mb-4">
                <h4 className="font-medium text-gray-900 mb-3">Add Items</h4>
                <div className="mb-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <input
                      type="text"
                      placeholder="Search available items..."
                      value={searchItems}
                      onChange={(e) => setSearchItems(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>
                
                <div className="max-h-40 overflow-y-auto">
                  {filteredAvailableItems.length === 0 ? (
                    <p className="text-gray-500 text-center py-4">
                      {searchItems ? 'No items match your search' : 'All items have been added'}
                    </p>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {filteredAvailableItems.slice(0, 10).map((item) => (
                        <button
                          key={item._id}
                          type="button"
                          onClick={() => handleAddItem(item)}
                          className="flex items-center justify-between p-2 bg-gray-50 rounded-md hover:bg-gray-100 transition-colors"
                        >
                          <div className="text-left">
                            <p className="font-medium text-gray-900">{item.name}</p>
                            <p className="text-sm text-gray-600">{item.category} - {formatCurrency(item.unitPrice)}</p>
                          </div>
                          <Plus className="w-4 h-4 text-blue-600" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </Card>

              {/* Selected Items */}
              {formData.items.length === 0 ? (
                <Card className="p-8 text-center">
                  <Package className="mx-auto h-8 w-8 text-gray-400 mb-2" />
                  <p className="text-gray-500">No items added to template yet</p>
                </Card>
              ) : (
                <div className="space-y-3">
                  {formData.items.map((templateItem, index) => {
                    const item = availableItems.find(i => i._id === templateItem.itemId);
                    return (
                      <Card key={`formData-items-${index}`} className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex-1 grid grid-cols-1 md:grid-cols-6 gap-4 items-center">
                            <div className="md:col-span-2">
                              <p className="font-medium text-gray-900">{item?.name}</p>
                              <p className="text-sm text-gray-600">{item?.category}</p>
                            </div>
                            
                            <div>
                              <label className="block text-xs text-gray-600 mb-1">Quantity</label>
                              <input
                                type="number"
                                min="1"
                                value={templateItem.expectedQuantity}
                                onChange={(e) => handleItemChange(index, 'expectedQuantity', parseInt(e.target.value))}
                                className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                              />
                            </div>
                            
                            <div>
                              <label className="block text-xs text-gray-600 mb-1">Priority</label>
                              <select
                                value={templateItem.priority}
                                onChange={(e) => handleItemChange(index, 'priority', e.target.value)}
                                className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                              >
                                <option value="low">Low</option>
                                <option value="medium">Medium</option>
                                <option value="high">High</option>
                                <option value="critical">Critical</option>
                              </select>
                            </div>
                            
                            <div className="flex items-center">
                              <label className="flex items-center">
                                <input
                                  type="checkbox"
                                  checked={templateItem.isRequired}
                                  onChange={(e) => handleItemChange(index, 'isRequired', e.target.checked)}
                                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                />
                                <span className="ml-2 text-xs text-gray-700">Required</span>
                              </label>
                            </div>
                            
                            <div>
                              <input
                                type="text"
                                placeholder="Notes..."
                                value={templateItem.notes || ''}
                                onChange={(e) => handleItemChange(index, 'notes', e.target.value)}
                                className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                              />
                            </div>
                          </div>
                          
                          <button aria-label="Delete"
                            type="button"
                            onClick={() => handleRemoveItem(index)}
                            className="ml-4 text-red-600 hover:text-red-800"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Summary */}
            <Card className="p-4 bg-blue-50">
              <h4 className="font-medium text-gray-900 mb-2">Template Summary</h4>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="text-gray-600">Total Items:</span>
                  <span className="ml-2 font-semibold">{formData.totalItems}</span>
                </div>
                <div>
                  <span className="text-gray-600">Estimated Value:</span>
                  <span className="ml-2 font-semibold">{formatCurrency(formData.totalValue)}</span>
                </div>
                <div>
                  <span className="text-gray-600">Required Items:</span>
                  <span className="ml-2 font-semibold">
                    {formData.items.filter(item => item.isRequired).length}
                  </span>
                </div>
              </div>
            </Card>
          </form>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 flex justify-end space-x-3">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit}>
            <Save className="w-4 h-4 mr-2" />
            {template._id ? 'Update Template' : 'Create Template'}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default InventoryTemplateManagement;