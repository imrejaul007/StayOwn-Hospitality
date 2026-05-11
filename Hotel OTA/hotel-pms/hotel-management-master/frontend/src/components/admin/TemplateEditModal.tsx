import React, { useState, useEffect } from 'react';
import { X, Plus, Edit, Trash2, Settings } from 'lucide-react';
import { InventoryTemplate, TemplateInventoryItem, dailyRoutineCheckService } from '../../services/dailyRoutineCheckService';
import { InventoryItemForm } from './InventoryItemForm';

interface TemplateEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  roomType: 'single' | 'double' | 'deluxe' | 'suite' | null;
  onSave: () => void;
}

type ActiveForm = {
  type: 'fixed' | 'daily';
  mode: 'add' | 'edit';
  item?: TemplateInventoryItem;
  index?: number;
} | null;

export const TemplateEditModal: React.FC<TemplateEditModalProps> = ({
  isOpen,
  onClose,
  roomType,
  onSave
}) => {
  const [template, setTemplate] = useState<InventoryTemplate | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeForm, setActiveForm] = useState<ActiveForm>(null);
  const [estimatedDuration, setEstimatedDuration] = useState(15);

  useEffect(() => {
    if (isOpen) {
      loadTemplate();
    }
  }, [isOpen, roomType]);

  const loadTemplate = async () => {
    if (!roomType) return;
    try {
      setLoading(true);
      setError(null);

      const response = await dailyRoutineCheckService.getInventoryTemplates();
      const existingTemplate = response.data?.templates?.find(t => t.roomType === roomType);

      if (existingTemplate) {
        setTemplate(existingTemplate);
        setEstimatedDuration(existingTemplate.estimatedCheckDuration || 15);
      } else {
        // Create a new template structure
        setTemplate({
          roomType,
          fixedInventory: [],
          dailyInventory: [],
          estimatedCheckDuration: 15
        });
        setEstimatedDuration(15);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load template');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveTemplate = async () => {
    if (!template || !roomType) return;

    try {
      setSaving(true);
      setError(null);

      const templateData = {
        ...template,
        estimatedCheckDuration: estimatedDuration
      };

      // Check if this is an existing template by looking for templates with the same roomType
      const existingTemplates = await dailyRoutineCheckService.getInventoryTemplates();
      const existingTemplate = existingTemplates.data?.templates?.find(t => t.roomType === roomType);

      if (existingTemplate) {
        // Update existing template
        await dailyRoutineCheckService.updateInventoryTemplate(roomType, {
          fixedInventory: templateData.fixedInventory,
          dailyInventory: templateData.dailyInventory,
          estimatedCheckDuration: templateData.estimatedCheckDuration
        });
      } else {
        // Create new template
        await dailyRoutineCheckService.createInventoryTemplate(templateData);
      }

      onSave();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save template');
    } finally {
      setSaving(false);
    }
  };

  const handleAddItem = (type: 'fixed' | 'daily') => {
    setActiveForm({ type, mode: 'add' });
  };

  const handleEditItem = (type: 'fixed' | 'daily', item: TemplateInventoryItem, index: number) => {
    setActiveForm({ type, mode: 'edit', item, index });
  };

  const handleDeleteItem = (type: 'fixed' | 'daily', index: number) => {
    if (!template) return;

    const confirmDelete = window.confirm('Are you sure you want to delete this item?');
    if (!confirmDelete) return;

    setTemplate({
      ...template,
      fixedInventory: type === 'fixed'
        ? template.fixedInventory.filter((_, i) => i !== index)
        : [...template.fixedInventory],
      dailyInventory: type === 'daily'
        ? template.dailyInventory.filter((_, i) => i !== index)
        : [...template.dailyInventory],
    });
  };

  const handleSaveItem = (item: TemplateInventoryItem) => {
    if (!template || !activeForm) return;

    const updatedTemplate = {
      ...template,
      fixedInventory: [...template.fixedInventory],
      dailyInventory: [...template.dailyInventory],
    };

    if (activeForm.mode === 'add') {
      if (activeForm.type === 'fixed') {
        updatedTemplate.fixedInventory = [...updatedTemplate.fixedInventory, item];
      } else {
        updatedTemplate.dailyInventory = [...updatedTemplate.dailyInventory, item];
      }
    } else if (activeForm.mode === 'edit' && activeForm.index !== undefined) {
      if (activeForm.type === 'fixed') {
        updatedTemplate.fixedInventory = updatedTemplate.fixedInventory.map((existing, i) =>
          i === activeForm.index ? item : existing
        );
      } else {
        updatedTemplate.dailyInventory = updatedTemplate.dailyInventory.map((existing, i) =>
          i === activeForm.index ? item : existing
        );
      }
    }

    setTemplate(updatedTemplate);
    setActiveForm(null);
  };

  const handleCancelForm = () => {
    setActiveForm(null);
  };

  const renderInventorySection = (type: 'fixed' | 'daily', items: TemplateInventoryItem[], title: string) => (
    <div className="border rounded-lg">
      <div className="p-4 border-b bg-gray-50">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium text-gray-900">{title}</h3>
          <button
            onClick={() => handleAddItem(type)}
            className="inline-flex items-center px-3 py-2 text-sm font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <Plus className="w-4 h-4 mr-1" />
            Add Item
          </button>
        </div>
        <p className="text-sm text-gray-500 mt-1">
          {type === 'fixed'
            ? 'Permanent items that remain in the room (furniture, appliances, fixtures)'
            : 'Daily consumables and amenities that need regular replenishment'
          }
        </p>
      </div>

      <div className="p-4">
        {items.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Settings className="w-8 h-8 mx-auto mb-2 text-gray-400" />
            <p>No {type} inventory items added yet</p>
            <p className="text-sm">Click "Add Item" to get started</p>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((item, index) => (
              <div
                key={`items-${index}-${item.name}`}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border"
              >
                <div className="flex-1">
                  <div className="flex items-center space-x-3">
                    <h4 className="font-medium text-gray-900">{item.name}</h4>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      {item.category}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 mt-1">{item.description || 'No description'}</p>
                  <div className="flex items-center space-x-4 mt-2 text-xs text-gray-500">
                    <span>Qty: {item.standardQuantity || 1}</span>
                    <span>Price: ₹{item.unitPrice || 0}</span>
                    <span>Condition: {item.expectedCondition || 'N/A'}</span>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <button aria-label="Edit"
                    onClick={() => handleEditItem(type, item, index)}
                    className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-md"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button aria-label="Delete"
                    onClick={() => handleDeleteItem(type, index)}
                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  if (!isOpen || !roomType) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        <div aria-hidden="true" className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75" onClick={onClose} />

        <div className="inline-block w-full max-w-4xl my-8 overflow-hidden text-left align-middle transition-all transform bg-white shadow-xl rounded-lg">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                Edit Template - {roomType.charAt(0).toUpperCase() + roomType.slice(1)} Room
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                Manage inventory items and check duration for {roomType} rooms
              </p>
            </div>
            <button aria-label="Close"
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 max-h-[70vh] overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <span className="ml-2 text-gray-600">Loading template...</span>
              </div>
            ) : error ? (
              <div className="text-center py-12">
                <div className="text-red-600 mb-2">Error loading template</div>
                <p className="text-gray-600">{error}</p>
                <button
                  onClick={loadTemplate}
                  className="mt-4 px-4 py-2 text-sm font-medium text-blue-600 hover:text-blue-800"
                >
                  Try Again
                </button>
              </div>
            ) : activeForm ? (
              <InventoryItemForm
                item={activeForm.item}
                type={activeForm.type}
                onSave={handleSaveItem}
                onCancel={handleCancelForm}
                isEditing={activeForm.mode === 'edit'}
              />
            ) : template ? (
              <div className="space-y-6">
                {/* Estimated Duration */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Estimated Check Duration (minutes)
                  </label>
                  <input
                    type="number"
                    min="5"
                    max="120"
                    value={estimatedDuration}
                    onChange={(e) => setEstimatedDuration(parseInt(e.target.value) || 15)}
                    className="w-32 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-sm text-gray-600 mt-1">
                    Average time required to complete daily check for this room type
                  </p>
                </div>

                {/* Fixed Inventory */}
                {renderInventorySection('fixed', template.fixedInventory, 'Fixed Inventory')}

                {/* Daily Inventory */}
                {renderInventorySection('daily', template.dailyInventory, 'Daily Inventory')}
              </div>
            ) : null}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-6 py-4 border-t bg-gray-50">
            <div className="text-sm text-gray-600">
              {template && (
                <>
                  Fixed Items: {template.fixedInventory.length} •
                  Daily Items: {template.dailyInventory.length}
                </>
              )}
            </div>
            <div className="flex items-center space-x-3">
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Cancel
              </button>
              <button aria-label="Save"
                onClick={handleSaveTemplate}
                disabled={saving || activeForm !== null}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center"
              >
                {saving && <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>}
                {saving ? 'Saving...' : 'Save Template'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};