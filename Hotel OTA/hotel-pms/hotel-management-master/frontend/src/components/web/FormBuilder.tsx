import React, { useState, useEffect, useCallback } from 'react';
import { DndProvider, useDrag, useDrop } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import {
  Save,
  Eye,
  Type,
  Mail,
  Phone,
  Hash,
  Calendar,
  Clock,
  AlignLeft,
  List,
  Circle,
  CheckSquare,
  Upload,
  Minus,
  Code,
  Plus,
  Trash2,
  Move,
  Copy
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Switch } from '../ui/switch';
import { Badge } from '../ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Separator } from '../ui/separator';
import FormPreview from './FormPreview';
import { BookingFormTemplate, FormField, FormStyling, FormSettings } from '../../services/bookingFormService';
import { bookingFormService } from '../../services/bookingFormService';
import { withErrorBoundary } from '../ErrorBoundary';

interface FormBuilderProps {
  template?: BookingFormTemplate | null;
  onSave: (template: BookingFormTemplate) => void;
  onCancel: () => void;
}

const fieldTypes = [
  { type: 'text', icon: Type, label: 'Text Input', color: 'blue' },
  { type: 'email', icon: Mail, label: 'Email', color: 'green' },
  { type: 'tel', icon: Phone, label: 'Phone', color: 'purple' },
  { type: 'number', icon: Hash, label: 'Number', color: 'orange' },
  { type: 'date', icon: Calendar, label: 'Date', color: 'red' },
  { type: 'time', icon: Clock, label: 'Time', color: 'indigo' },
  { type: 'textarea', icon: AlignLeft, label: 'Textarea', color: 'gray' },
  { type: 'select', icon: List, label: 'Select', color: 'yellow' },
  { type: 'radio', icon: Circle, label: 'Radio', color: 'pink' },
  { type: 'checkbox', icon: CheckSquare, label: 'Checkbox', color: 'teal' },
  { type: 'file', icon: Upload, label: 'File Upload', color: 'cyan' },
  { type: 'divider', icon: Minus, label: 'Divider', color: 'gray' },
  { type: 'html', icon: Code, label: 'HTML', color: 'violet' }
];

const getColorClass = (color: string) => {
  const colorMap: Record<string, string> = {
    blue: 'bg-blue-100 text-blue-800 border-blue-200',
    green: 'bg-green-100 text-green-800 border-green-200',
    purple: 'bg-purple-100 text-purple-800 border-purple-200',
    orange: 'bg-orange-100 text-orange-800 border-orange-200',
    red: 'bg-red-100 text-red-800 border-red-200',
    indigo: 'bg-indigo-100 text-indigo-800 border-indigo-200',
    gray: 'bg-gray-100 text-gray-800 border-gray-200',
    yellow: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    pink: 'bg-pink-100 text-pink-800 border-pink-200',
    teal: 'bg-teal-100 text-teal-800 border-teal-200',
    cyan: 'bg-cyan-100 text-cyan-800 border-cyan-200',
    violet: 'bg-violet-100 text-violet-800 border-violet-200'
  };
  return colorMap[color] || colorMap.gray;
};

const DraggableField: React.FC<{ fieldType: { type: string; icon: React.ElementType; label: string; color: string }; onAddField: (type: string) => void }> = ({ fieldType, onAddField }) => {
  const [{ isDragging }, drag] = useDrag({
    type: 'field',
    item: { type: fieldType.type },
    collect: (monitor) => ({
      isDragging: monitor.isDragging()
    })
  });

  const IconComponent = fieldType.icon;

  return (
    <div role="button" tabIndex={0}
      ref={drag}
      className={`p-3 border rounded-lg cursor-grab hover:shadow-md transition-all ${
        isDragging ? 'opacity-50' : ''
      } ${getColorClass(fieldType.color)}`}
      onClick={() => onAddField(fieldType.type)}
     onKeyDown={(e: React.KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onAddField(fieldType.type); } }}>
      <div className="flex items-center gap-2">
        <IconComponent className="w-4 h-4" />
        <span className="text-sm font-medium">{fieldType.label}</span>
      </div>
    </div>
  );
};

const FormFieldEditor: React.FC<{
  field: FormField;
  onUpdate: (field: FormField) => void;
  onDelete: () => void;
  onDuplicate: () => void;
}> = ({ field, onUpdate, onDelete, onDuplicate }) => {
  const [localField, setLocalField] = useState<FormField>(field);

  useEffect(() => {
    setLocalField(field);
  }, [field]);

  const handleUpdate = (updates: Partial<FormField>) => {
    const updatedField = { ...localField, ...updates };
    setLocalField(updatedField);
    onUpdate(updatedField);
  };

  const addOption = () => {
    const options = localField.options || [];
    handleUpdate({
      options: [...options, { value: '', label: '' }]
    });
  };

  const updateOption = (index: number, updates: Partial<{ value: string; label: string; selected: boolean }>) => {
    const options = [...(localField.options || [])];
    options[index] = { ...options[index], ...updates };
    handleUpdate({ options });
  };

  const removeOption = (index: number) => {
    const options = [...(localField.options || [])];
    options.splice(index, 1);
    handleUpdate({ options });
  };

  return (
    <Card className="mb-4">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">{localField.label || 'New Field'}</CardTitle>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={onDuplicate}>
              <Copy className="w-3 h-3" />
            </Button>
            <Button size="sm" variant="outline" onClick={onDelete} className="text-red-600 hover:text-red-700">
              <Trash2 className="w-3 h-3" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Basic Settings */}
          <div className="space-y-3">
            <div>
              <Label htmlFor={`label-${field.id}`}>Field Label</Label>
              <Input
                id={`label-${field.id}`}
                value={localField.label}
                onChange={(e) => handleUpdate({ label: e.target.value })}
                placeholder="Enter field label"
              />
            </div>

            <div>
              <Label htmlFor={`placeholder-${field.id}`}>Placeholder</Label>
              <Input
                id={`placeholder-${field.id}`}
                value={localField.placeholder || ''}
                onChange={(e) => handleUpdate({ placeholder: e.target.value })}
                placeholder="Enter placeholder text"
              />
            </div>

            <div>
              <Label htmlFor={`helpText-${field.id}`}>Help Text</Label>
              <Textarea
                id={`helpText-${field.id}`}
                value={localField.helpText || ''}
                onChange={(e) => handleUpdate({ helpText: e.target.value })}
                placeholder="Enter help text"
                rows={2}
              />
            </div>
          </div>

          {/* Advanced Settings */}
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <Switch
                id={`required-${field.id}`}
                checked={localField.required || false}
                onCheckedChange={(required) => handleUpdate({ required })}
              />
              <Label htmlFor={`required-${field.id}`}>Required Field</Label>
            </div>

            <div>
              <Label htmlFor={`width-${field.id}`}>Field Width</Label>
              <Select value={localField.width || '100'} onValueChange={(width) => handleUpdate({ width })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="25">25%</SelectItem>
                  <SelectItem value="33">33%</SelectItem>
                  <SelectItem value="50">50%</SelectItem>
                  <SelectItem value="66">66%</SelectItem>
                  <SelectItem value="75">75%</SelectItem>
                  <SelectItem value="100">100%</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Options for select/radio/checkbox fields */}
        {(['select', 'radio', 'checkbox'].includes(localField.type)) && (
          <div className="mt-6">
            <div className="flex items-center justify-between mb-3">
              <Label>Options</Label>
              <Button size="sm" variant="outline" onClick={addOption}>
                <Plus className="w-3 h-3 mr-1" />
                Add Option
              </Button>
            </div>
            
            <div className="space-y-2">
              {localField.options?.map((option, index) => (
                <div key={`option-${index}-${option.value}`} className="flex gap-2 items-center">
                  <Input
                    value={option.value}
                    onChange={(e) => updateOption(index, { value: e.target.value })}
                    placeholder="Value"
                    className="flex-1"
                  />
                  <Input
                    value={option.label}
                    onChange={(e) => updateOption(index, { label: e.target.value })}
                    placeholder="Label"
                    className="flex-1"
                  />
                  {localField.type === 'checkbox' && (
                    <Switch
                      checked={option.selected || false}
                      onCheckedChange={(selected) => updateOption(index, { selected })}
                    />
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => removeOption(index)}
                    className="text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              )) || []}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

const DropZone: React.FC<{
  fields: FormField[];
  onFieldDrop: (type: string, index: number) => void;
  onFieldMove: (dragIndex: number, hoverIndex: number) => void;
  selectedField: string | null;
  onFieldSelect: (fieldId: string | null) => void;
}> = ({ fields, onFieldDrop, onFieldMove, selectedField, onFieldSelect }) => {
  const [{ isOver }, drop] = useDrop({
    accept: 'field',
    drop: (item: { type: string }) => {
      onFieldDrop(item.type, fields.length);
    },
    collect: (monitor) => ({
      isOver: monitor.isOver()
    })
  });

  return (
    <div
      ref={drop}
      className={`min-h-[400px] p-4 border-2 border-dashed rounded-lg transition-colors ${
        isOver ? 'border-blue-400 bg-blue-50' : 'border-gray-300'
      }`}
    >
      {fields.length === 0 ? (
        <div className="flex items-center justify-center h-64 text-gray-500">
          <div className="text-center">
            <Type className="w-12 h-12 mx-auto mb-4 text-gray-400" />
            <p className="text-lg">Drop form fields here</p>
            <p className="text-sm">Drag fields from the sidebar or click on them to add</p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {fields.map((field, index) => (
            <FieldPreview
              key={field.id}
              field={field}
              index={index}
              isSelected={selectedField === field.id}
              onSelect={() => onFieldSelect(field.id)}
              onMove={onFieldMove}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const FieldPreview: React.FC<{
  field: FormField;
  index: number;
  isSelected: boolean;
  onSelect: () => void;
  onMove: (dragIndex: number, hoverIndex: number) => void;
}> = ({ field, index, isSelected, onSelect, onMove }) => {
  const [{ isDragging }, drag, preview] = useDrag({
    type: 'form-field',
    item: { index },
    collect: (monitor) => ({
      isDragging: monitor.isDragging()
    })
  });

  const [, drop] = useDrop({
    accept: 'form-field',
    hover: (draggedItem: { index: number }) => {
      if (draggedItem.index !== index) {
        onMove(draggedItem.index, index);
        draggedItem.index = index;
      }
    }
  });

  const fieldTypeInfo = fieldTypes.find(ft => ft.type === field.type);
  const IconComponent = fieldTypeInfo?.icon || Type;

  return (
    <div ref={(node) => drag(drop(node))}>
      <div role="button" tabIndex={0}
        className={`p-4 border rounded-lg cursor-pointer transition-all ${
          isSelected ? 'border-blue-400 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
        } ${isDragging ? 'opacity-50' : ''}`}
        onClick={onSelect}
       onKeyDown={(e: React.KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(); } }}>
        <div className="flex items-center gap-3">
          <Move className="w-4 h-4 text-gray-400 cursor-grab" />
          <IconComponent className="w-4 h-4 text-gray-600" />
          <div className="flex-1">
            <div className="font-medium">{field.label}</div>
            <div className="text-sm text-gray-500">{fieldTypeInfo?.label}</div>
          </div>
          {field.required && (
            <Badge variant="secondary" className="text-red-600">Required</Badge>
          )}
          <Badge variant="outline">{field.width || '100'}%</Badge>
        </div>
      </div>
    </div>
  );
};

const FormBuilder: React.FC<FormBuilderProps> = ({ template, onSave, onCancel }) => {
  const [formData, setFormData] = useState<Partial<BookingFormTemplate>>({
    name: '',
    description: '',
    category: 'booking',
    fields: [],
    styling: {
      theme: {
        colors: {
          primary: '#3b82f6',
          secondary: '#64748b',
          accent: '#06b6d4',
          background: '#ffffff',
          text: '#1f2937',
          error: '#ef4444'
        },
        fonts: {
          heading: 'Inter, sans-serif',
          body: 'Inter, sans-serif'
        },
        spacing: {
          small: '0.5rem',
          medium: '1rem',
          large: '2rem'
        }
      },
      layout: {
        maxWidth: '600px',
        padding: '2rem',
        borderRadius: '0.5rem',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
      },
      fields: {
        height: '2.5rem',
        borderRadius: '0.375rem',
        borderWidth: '1px',
        borderColor: '#d1d5db',
        focusBorderColor: '#3b82f6',
        backgroundColor: '#ffffff'
      },
      buttons: {
        height: '2.5rem',
        borderRadius: '0.375rem',
        fontSize: '0.875rem',
        fontWeight: '500'
      }
    },
    settings: {
      method: 'POST',
      successMessage: 'Thank you! Your form has been submitted successfully.',
      errorMessage: 'There was an error submitting your form. Please try again.',
      enableProgressBar: false,
      enableSaveProgress: false,
      allowFileUploads: false,
      maxFileSize: 5242880, // 5MB
      allowedFileTypes: ['image/jpeg', 'image/png', 'application/pdf'],
      enableCaptcha: false,
      enableAnalytics: true
    },
    status: 'draft'
  });

  const [selectedField, setSelectedField] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('builder');
  const [showPreview, setShowPreview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    if (template) {
      setFormData({
        ...template,
        fields: template.fields || []
      });
      setIsDirty(false);
    }
  }, [template]);


  const generateFieldId = () => {
    return `field_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  };

  const addField = useCallback((type: string) => {
    const fieldId = generateFieldId();
    const newField: FormField = {
      id: fieldId,
      type: type as FormField['type'],
      label: `New ${type} field`,
      placeholder: '',
      required: false,
      order: 0, // Will be set from prev state
      width: '100'
    };

    // Add default options for select/radio/checkbox fields
    if (['select', 'radio', 'checkbox'].includes(type)) {
      newField.options = [
        { value: 'option1', label: 'Option 1' },
        { value: 'option2', label: 'Option 2' }
      ];
    }

    setIsDirty(true);
    setFormData(prev => {
      newField.order = (prev.fields?.length || 0) + 1;
      return {
        ...prev,
        fields: [...(prev.fields || []), newField]
      };
    });

    setSelectedField(fieldId);
  }, []);

  const updateField = useCallback((fieldId: string, updates: Partial<FormField>) => {
    setIsDirty(true);
    setFormData(prev => ({
      ...prev,
      fields: prev.fields?.map(field =>
        field.id === fieldId ? { ...field, ...updates } : field
      ) || []
    }));
  }, []);

  const deleteField = useCallback((fieldId: string) => {
    setIsDirty(true);
    setFormData(prev => ({
      ...prev,
      fields: prev.fields?.filter(field => field.id !== fieldId) || []
    }));
    setSelectedField(null);
  }, []);

  const duplicateField = useCallback((fieldId: string) => {
    const newId = generateFieldId();
    setIsDirty(true);
    setFormData(prev => {
      const field = prev.fields?.find(f => f.id === fieldId);
      if (!field) return prev;

      const duplicatedField: FormField = {
        ...field,
        id: newId,
        label: `${field.label} (Copy)`,
        order: (prev.fields?.length || 0) + 1
      };

      return {
        ...prev,
        fields: [...(prev.fields || []), duplicatedField]
      };
    });

    setSelectedField(newId);
  }, []);

  const moveField = useCallback((dragIndex: number, hoverIndex: number) => {
    setIsDirty(true);
    setFormData(prev => {
      const fields = [...(prev.fields || [])];
      const draggedField = fields[dragIndex];

      fields.splice(dragIndex, 1);
      fields.splice(hoverIndex, 0, draggedField);

      // Update order immutably
      const reorderedFields = fields.map((field, index) => ({
        ...field,
        order: index + 1
      }));

      return { ...prev, fields: reorderedFields };
    });
  }, []);

  const handleSave = async () => {
    if (!formData.name || !formData.name.trim()) {
      toast.error('Please enter a form name');
      return;
    }

    if (!formData.fields || formData.fields.length === 0) {
      toast.error('Please add at least one field to the form');
      return;
    }

    const emptyLabelField = formData.fields.find(f =>
      !['divider', 'html'].includes(f.type) && (!f.label || !f.label.trim())
    );
    if (emptyLabelField) {
      toast.error(`Field "${emptyLabelField.type}" is missing a label`);
      setSelectedField(emptyLabelField.id);
      return;
    }

    try {
      setSaving(true);
      
      let response;
      if (template?._id) {
        response = await bookingFormService.updateTemplate(template._id, formData);
      } else {
        response = await bookingFormService.createTemplate(formData);
      }

      if (response.success) {
        onSave(response.data);
      } else {
        toast.error(response.error || 'Failed to save form template');
      }
    } catch (error) {
      toast.error('Failed to save form template');
    } finally {
      setSaving(false);
    }
  };

  const selectedFieldData = formData.fields?.find(f => f.id === selectedField);

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="flex h-screen bg-gray-50">
        {/* Sidebar */}
        <div className="w-80 bg-white border-r border-gray-200 flex flex-col overflow-y-auto">
          <div className="p-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold mb-4">Form Builder</h2>
            
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="builder">Builder</TabsTrigger>
                <TabsTrigger value="settings">Settings</TabsTrigger>
              </TabsList>

              <TabsContent value="builder" className="mt-4">
                <div className="space-y-4">
                  <div>
                    <Label>Form Name</Label>
                    <Input
                      value={formData.name}
                      onChange={(e) => { setIsDirty(true); setFormData(prev => ({ ...prev, name: e.target.value })); }}
                      placeholder="Enter form name"
                    />
                  </div>

                  <div>
                    <Label>Description</Label>
                    <Textarea
                      value={formData.description || ''}
                      onChange={(e) => { setIsDirty(true); setFormData(prev => ({ ...prev, description: e.target.value })); }}
                      placeholder="Enter form description"
                      rows={3}
                    />
                  </div>

                  <div>
                    <Label>Category</Label>
                    <Select 
                      value={formData.category} 
                      onValueChange={(category: string) => { setIsDirty(true); setFormData(prev => ({ ...prev, category })); }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="booking">Booking</SelectItem>
                        <SelectItem value="inquiry">Inquiry</SelectItem>
                        <SelectItem value="registration">Registration</SelectItem>
                        <SelectItem value="survey">Survey</SelectItem>
                        <SelectItem value="custom">Custom</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <Separator />

                  <div>
                    <Label className="text-sm font-medium mb-3 block">Field Types</Label>
                    <div className="grid grid-cols-2 gap-2">
                      {fieldTypes.map((fieldType) => (
                        <DraggableField
                          key={fieldType.type}
                          fieldType={fieldType}
                          onAddField={addField}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="settings" className="mt-4">
                <div className="space-y-4">
                  <div>
                    <Label>Form Status</Label>
                    <Select
                      value={formData.status || 'draft'}
                      onValueChange={(status: string) => { setIsDirty(true); setFormData(prev => ({ ...prev, status })); }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="draft">Draft</SelectItem>
                        <SelectItem value="active">Active (Published)</SelectItem>
                        <SelectItem value="archived">Archived</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-gray-500 mt-1">Only active forms can receive public submissions.</p>
                  </div>

                  <Separator />

                  <div>
                    <Label>Success Message</Label>
                    <Textarea
                      value={formData.settings?.successMessage || ''}
                      onChange={(e) => { setIsDirty(true); setFormData(prev => ({
                        ...prev,
                        settings: { ...prev.settings, successMessage: e.target.value }
                      })); }}
                      rows={2}
                    />
                  </div>

                  <div>
                    <Label>Error Message</Label>
                    <Textarea
                      value={formData.settings?.errorMessage || ''}
                      onChange={(e) => { setIsDirty(true); setFormData(prev => ({
                        ...prev,
                        settings: { ...prev.settings, errorMessage: e.target.value }
                      })); }}
                      rows={2}
                    />
                  </div>

                  <div className="flex items-center space-x-2">
                    <Switch
                      checked={formData.settings?.enableProgressBar || false}
                      onCheckedChange={(checked) => { setIsDirty(true); setFormData(prev => ({
                        ...prev,
                        settings: { ...prev.settings, enableProgressBar: checked }
                      })); }}
                    />
                    <Label>Enable Progress Bar</Label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Switch
                      checked={formData.settings?.allowFileUploads || false}
                      onCheckedChange={(checked) => { setIsDirty(true); setFormData(prev => ({
                        ...prev,
                        settings: { ...prev.settings, allowFileUploads: checked }
                      })); }}
                    />
                    <Label>Allow File Uploads</Label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Switch
                      checked={formData.settings?.enableCaptcha || false}
                      onCheckedChange={(checked) => { setIsDirty(true); setFormData(prev => ({
                        ...prev,
                        settings: { ...prev.settings, enableCaptcha: checked }
                      })); }}
                    />
                    <Label>Enable Captcha</Label>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col">
          {/* Header */}
          <div className="bg-white border-b border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-xl font-semibold">
                  {template ? 'Edit Form' : 'Create Form'}: {formData.name || 'Untitled Form'}
                </h1>
                <p className="text-sm text-gray-600">
                  {formData.fields?.length || 0} {(formData.fields?.length || 0) === 1 ? 'field' : 'fields'}
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setShowPreview(true)}>
                  <Eye className="w-4 h-4 mr-2" />
                  Preview
                </Button>
                <Button onClick={handleSave} disabled={saving}>
                  <Save className="w-4 h-4 mr-2" />
                  {saving ? 'Saving...' : 'Save'}
                </Button>
                <Button variant="outline" onClick={() => {
                  if (isDirty && !window.confirm('You have unsaved changes. Are you sure you want to leave?')) return;
                  onCancel();
                }}>
                  Cancel
                </Button>
              </div>
            </div>
          </div>

          {/* Form Builder */}
          <div className="flex-1 flex">
            {/* Drop Zone */}
            <div className="flex-1 p-6">
              <DropZone
                fields={formData.fields || []}
                onFieldDrop={addField}
                onFieldMove={moveField}
                selectedField={selectedField}
                onFieldSelect={setSelectedField}
              />
            </div>

            {/* Field Editor */}
            {selectedFieldData && (
              <div className="w-80 bg-white border-l border-gray-200 p-4 overflow-y-auto">
                <h3 className="text-lg font-semibold mb-4">Field Settings</h3>
                <FormFieldEditor
                  field={selectedFieldData}
                  onUpdate={(updatedField) => updateField(selectedFieldData.id, updatedField)}
                  onDelete={() => deleteField(selectedFieldData.id)}
                  onDuplicate={() => duplicateField(selectedFieldData.id)}
                />
              </div>
            )}
          </div>
        </div>

        {/* Preview Modal */}
        <Dialog open={showPreview} onOpenChange={setShowPreview}>
          <DialogContent className="max-w-4xl h-[80vh] overflow-hidden">
            <DialogHeader>
              <DialogTitle>Form Preview</DialogTitle>
            </DialogHeader>
            <div className="flex-1 overflow-auto">
              <FormPreview template={formData as BookingFormTemplate} />
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DndProvider>
  );
};

export default withErrorBoundary(FormBuilder, { level: 'component' });