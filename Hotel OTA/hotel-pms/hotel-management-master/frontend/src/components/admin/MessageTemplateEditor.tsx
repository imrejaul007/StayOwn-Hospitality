import React, { useState, useEffect, useRef} from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import {
  FileText,
  Plus,
  Trash2,
  Save,
  X,
  Eye,
  AlertTriangle,
  CheckCircle,
  Code,
  Settings,
  Zap,
  Calendar,
  Palette
} from 'lucide-react';
import { ApplyToSelector, ApplyToConfirmation, ApplyToScope } from '../settings/ApplyToSelector';
import { useSettingsInheritance, useAffectedPropertiesCount } from '../../hooks/useSettingsInheritance';
import { useProperty } from '../../context/PropertyContext';
import { api } from '../../services/api';
import { withErrorBoundary } from '../ErrorBoundary';

interface BillMessage {
  _id?: string;
  messageName: string;
  messageCode: string;
  description?: string;
  messageType: string;
  category: string;
  messageTemplate: string;
  templateVariables: Array<{
    name: string;
    displayName: string;
    dataType: string;
    required: boolean;
    defaultValue?: unknown;
    format?: string;
    description?: string;
  }>;
  applicableRoomTypes: string[];
  applicableChannels: string[];
  applicableGuestTypes: string[];
  triggerConditions: {
    automaticTrigger: boolean;
    triggerEvents: string[];
    triggerDelay: {
      amount: number;
      unit: string;
    };
    conditions: {
      minAmount?: number;
      maxAmount?: number;
      requiresApproval: boolean;
      approvalThreshold?: number;
      weekdayOnly: boolean;
      weekendOnly: boolean;
      specificDates: string[];
      excludeDates: string[];
    };
  };
  formatting: {
    fontSize: string;
    fontStyle: string;
    alignment: string;
    includeHeader: boolean;
    includeFooter: boolean;
    headerText?: string;
    footerText?: string;
    backgroundColor: string;
    textColor: string;
  };
  language: string;
  translations: Array<{
    language: string;
    messageTemplate: string;
    headerText?: string;
    footerText?: string;
  }>;
  isActive: boolean;
  isDefault: boolean;
  priority: number;
  integrationSettings: {
    printAutomatically: boolean;
    emailCopy: boolean;
    emailAddresses: string[];
    attachToFolio: boolean;
    chargeCode?: string;
    requireSignature: boolean;
    generatePDF: boolean;
  };
  scheduling: {
    scheduledDate?: string;
    recurringSchedule: {
      enabled: boolean;
      frequency?: string;
      interval: number;
      endDate?: string;
      maxOccurrences?: number;
    };
  };
  notes?: string;
  internalNotes?: string;
}

interface MessageTemplateEditorProps {
  message?: BillMessage | null;
  options?: {
    messageTypes: string[];
    categories: string[];
    triggerEvents: string[];
    channels: string[];
    guestTypes: string[];
    dataTypes: string[];
  } | null;
  onClose: () => void;
  onSuccess: () => void;
}

const MessageTemplateEditor: React.FC<MessageTemplateEditorProps> = ({ 
  message, 
  options,
  onClose, 
  onSuccess 
}) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [validationWarnings, setValidationWarnings] = useState<string[]>([]);

  // Multi-property support
  const { selectedProperty, selectedPropertyId } = useProperty();
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
  
  // Form data
  const [formData, setFormData] = useState<BillMessage>({
    messageName: '',
    messageCode: '',
    description: '',
    messageType: 'welcome',
    category: 'billing',
    messageTemplate: '',
    templateVariables: [],
    applicableRoomTypes: [],
    applicableChannels: [],
    applicableGuestTypes: [],
    triggerConditions: {
      automaticTrigger: false,
      triggerEvents: [],
      triggerDelay: {
        amount: 0,
        unit: 'hours'
      },
      conditions: {
        requiresApproval: false,
        weekdayOnly: false,
        weekendOnly: false,
        specificDates: [],
        excludeDates: []
      }
    },
    formatting: {
      fontSize: 'medium',
      fontStyle: 'normal',
      alignment: 'left',
      includeHeader: true,
      includeFooter: true,
      headerText: '',
      footerText: '',
      backgroundColor: '#ffffff',
      textColor: '#000000'
    },
    language: 'en',
    translations: [],
    isActive: true,
    isDefault: false,
    priority: 0,
    integrationSettings: {
      printAutomatically: false,
      emailCopy: false,
      emailAddresses: [],
      attachToFolio: true,
      chargeCode: '',
      requireSignature: false,
      generatePDF: false
    },
    scheduling: {
      recurringSchedule: {
        enabled: false,
        interval: 1
      }
    },
    notes: '',
    internalNotes: ''
  });

  // Form state
  const [activeTab, setActiveTab] = useState('basic');
  const [previewMode, setPreviewMode] = useState(false);

  const successTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (successTimerRef.current) clearTimeout(successTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (message) {
      setFormData({
        ...message,
        templateVariables: message.templateVariables || [],
        applicableRoomTypes: message.applicableRoomTypes || [],
        applicableChannels: message.applicableChannels || [],
        applicableGuestTypes: message.applicableGuestTypes || [],
        triggerConditions: {
          ...message.triggerConditions,
          triggerDelay: message.triggerConditions?.triggerDelay || { amount: 0, unit: 'hours' },
          conditions: {
            ...message.triggerConditions?.conditions,
            requiresApproval: message.triggerConditions?.conditions?.requiresApproval || false,
            weekdayOnly: message.triggerConditions?.conditions?.weekdayOnly || false,
            weekendOnly: message.triggerConditions?.conditions?.weekendOnly || false,
            specificDates: message.triggerConditions?.conditions?.specificDates || [],
            excludeDates: message.triggerConditions?.conditions?.excludeDates || []
          }
        },
        formatting: {
          ...message.formatting,
          backgroundColor: message.formatting?.backgroundColor || '#ffffff',
          textColor: message.formatting?.textColor || '#000000'
        },
        translations: message.translations || [],
        integrationSettings: {
          ...message.integrationSettings,
          emailAddresses: message.integrationSettings?.emailAddresses || []
        },
        scheduling: {
          ...message.scheduling,
          recurringSchedule: {
            ...message.scheduling?.recurringSchedule,
            enabled: message.scheduling?.recurringSchedule?.enabled || false,
            interval: message.scheduling?.recurringSchedule?.interval || 1
          }
        }
      });
    }
  }, [message]);

  const validateTemplate = async () => {
    try {
      const response = await api.post('/bill-messages/validate-template', {
        template: formData.messageTemplate,
        variables: formData.templateVariables
      });

      const validation = response.data;
      setValidationErrors(validation.data.errors || []);
      setValidationWarnings(validation.data.warnings || []);
      return validation.data.isValid;
    } catch {
      // Error handled silently
    }
    return true;
  };

  useEffect(() => {
    if (formData.messageTemplate) {
      const debounceTimer = setTimeout(() => {
        validateTemplate();
      }, 500);

      return () => clearTimeout(debounceTimer);
    }
  }, [formData.messageTemplate, formData.templateVariables]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      // If multi-property update, use applySettings
      if (applyToScope !== 'single') {
        const result = await applySettings({
          scope: applyToScope,
          propertyId: selectedPropertyId,
          settingUpdates: {
            ...formData,
            messageId: message?._id,
            operation: message ? 'update' : 'create'
          },
          settingType: 'message_templates',
        });

        if (!result) {
          setSaving(false);
          return; // Confirmation dialog shown
        }

        setShowSuccess(true);
        if (successTimerRef.current) clearTimeout(successTimerRef.current);
        successTimerRef.current = setTimeout(() => setShowSuccess(false), 3000);
        toast({
          title: 'Success',
          description: `Message template ${message ? 'updated' : 'created'} successfully${
            applyToScope !== 'single' ? ` for ${result.propertiesUpdated} properties` : ''
          }`
        });
        setApplyToScope('single');
        onSuccess();
      } else {
        // Single property update
        const hotelId = localStorage.getItem('currentHotelId') || 'default-hotel-id';

        const url = message
          ? `/api/v1/bill-messages/${message._id}`
          : `/api/v1/bill-messages/hotels/${hotelId}`;

        const method = message ? 'PUT' : 'POST';

        const { data: result } = message
          ? await api.put(`/bill-messages/${message._id}`, formData)
          : await api.post(`/bill-messages/hotels/${hotelId}`, formData);
        toast({
          title: 'Success',
          description: result.message || `Message ${message ? 'updated' : 'created'} successfully`
        });
        onSuccess();
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to save message',
        variant: 'destructive'
      });
    } finally {
      setSaving(false);
    }
  };

  const handleConfirm = async () => {
    if (pendingUpdate) {
      setSaving(true);
      const result = await confirmBulkUpdate();
      if (result) {
        setShowSuccess(true);
        if (successTimerRef.current) clearTimeout(successTimerRef.current);
        successTimerRef.current = setTimeout(() => setShowSuccess(false), 3000);
        toast({
          title: 'Success',
          description: `Settings updated for ${result.propertiesUpdated} properties`
        });
        setApplyToScope('single');
        onSuccess();
      }
      setSaving(false);
    }
  };

  const handleAddVariable = () => {
    setFormData(prev => ({
      ...prev,
      templateVariables: [
        ...prev.templateVariables,
        {
          name: '',
          displayName: '',
          dataType: 'string',
          required: false,
          description: ''
        }
      ]
    }));
  };

  const handleRemoveVariable = (index: number) => {
    setFormData(prev => ({
      ...prev,
      templateVariables: prev.templateVariables.filter((_, i) => i !== index)
    }));
  };

  const handleVariableChange = (index: number, field: string, value: unknown) => {
    setFormData(prev => ({
      ...prev,
      templateVariables: prev.templateVariables.map((variable, i) => 
        i === index ? { ...variable, [field]: value } : variable
      )
    }));
  };

  const handleAddTranslation = () => {
    setFormData(prev => ({
      ...prev,
      translations: [
        ...prev.translations,
        {
          language: '',
          messageTemplate: '',
          headerText: '',
          footerText: ''
        }
      ]
    }));
  };

  const handleRemoveTranslation = (index: number) => {
    setFormData(prev => ({
      ...prev,
      translations: prev.translations.filter((_, i) => i !== index)
    }));
  };

  const handleTranslationChange = (index: number, field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      translations: prev.translations.map((translation, i) => 
        i === index ? { ...translation, [field]: value } : translation
      )
    }));
  };

  const handleAddEmailAddress = () => {
    setFormData(prev => ({
      ...prev,
      integrationSettings: {
        ...prev.integrationSettings,
        emailAddresses: [...prev.integrationSettings.emailAddresses, '']
      }
    }));
  };

  const handleRemoveEmailAddress = (index: number) => {
    setFormData(prev => ({
      ...prev,
      integrationSettings: {
        ...prev.integrationSettings,
        emailAddresses: prev.integrationSettings.emailAddresses.filter((_, i) => i !== index)
      }
    }));
  };

  const handleEmailAddressChange = (index: number, value: string) => {
    setFormData(prev => ({
      ...prev,
      integrationSettings: {
        ...prev.integrationSettings,
        emailAddresses: prev.integrationSettings.emailAddresses.map((email, i) => 
          i === index ? value : email
        )
      }
    }));
  };

  const insertVariable = (variableName: string) => {
    const placeholder = `{{${variableName}}}`;
    const textarea = document.getElementById('messageTemplate') as HTMLTextAreaElement;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const newValue = formData.messageTemplate.substring(0, start) + 
                      placeholder + 
                      formData.messageTemplate.substring(end);
      
      setFormData(prev => ({ ...prev, messageTemplate: newValue }));
      
      // Set cursor position after inserted placeholder
      if (successTimerRef.current) clearTimeout(successTimerRef.current);
      successTimerRef.current = setTimeout(() => {
        textarea.setSelectionRange(start + placeholder.length, start + placeholder.length);
        textarea.focus();
      }, 0);
    }
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            {message ? 'Edit Message Template' : 'Create Message Template'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Success Message */}
          {showSuccess && (
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-800 dark:text-green-200 px-4 py-3 rounded-lg">
              <p className="font-medium flex items-center gap-2">
                <CheckCircle className="w-4 h-4" />
                Message template {message ? 'updated' : 'created'} successfully!
              </p>
              {applyToScope !== 'single' && affectedCount > 1 && (
                <p className="text-sm mt-1">Changes applied to {affectedCount} properties</p>
              )}
            </div>
          )}

          {/* Error Message */}
          {updateError && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-200 px-4 py-3 rounded-lg">
              <p className="font-medium flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                Error: {updateError}
              </p>
            </div>
          )}

          {/* Inheritance Status Card */}
          {inheritanceStatus?.isInheriting && inheritanceStatus?.hasGroup && (
            <Card className="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
              <CardContent className="p-4">
                <div className="flex items-start">
                  <AlertTriangle className="w-5 h-5 text-blue-600 dark:text-blue-400 mr-3 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                      This property is part of: {inheritanceStatus.groupName}
                    </p>
                    <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                      Message templates are inherited from the property group.
                      {inheritanceStatus.lastSyncedAt && (
                        <span className="ml-1">
                          Last synced: {new Date(inheritanceStatus.lastSyncedAt).toLocaleString()}
                        </span>
                      )}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid grid-cols-6 w-full">
              <TabsTrigger value="basic">Basic</TabsTrigger>
              <TabsTrigger value="template">Template</TabsTrigger>
              <TabsTrigger value="triggers">Triggers</TabsTrigger>
              <TabsTrigger value="formatting">Formatting</TabsTrigger>
              <TabsTrigger value="advanced">Advanced</TabsTrigger>
              <TabsTrigger value="settings">Settings</TabsTrigger>
            </TabsList>

            <TabsContent value="basic" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="messageName">Message Name *</Label>
                  <Input
                    id="messageName"
                    value={formData.messageName}
                    onChange={(e) => setFormData(prev => ({ 
                      ...prev, 
                      messageName: e.target.value 
                    }))}
                    placeholder="e.g., Welcome Message"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="messageCode">Message Code *</Label>
                  <Input
                    id="messageCode"
                    value={formData.messageCode}
                    onChange={(e) => setFormData(prev => ({ 
                      ...prev, 
                      messageCode: e.target.value.toUpperCase()
                    }))}
                    placeholder="e.g., WELCOME_MSG"
                    required
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description || ''}
                  onChange={(e) => setFormData(prev => ({ 
                    ...prev, 
                    description: e.target.value 
                  }))}
                  placeholder="Optional description..."
                  rows={2}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="messageType">Message Type *</Label>
                  <Select
                    value={formData.messageType}
                    onValueChange={(value) => setFormData(prev => ({ 
                      ...prev, 
                      messageType: value 
                    }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {options?.messageTypes.map(type => (
                        <SelectItem key={type} value={type}>
                          {type.replace('_', ' ')}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="category">Category *</Label>
                  <Select
                    value={formData.category}
                    onValueChange={(value) => setFormData(prev => ({ 
                      ...prev, 
                      category: value 
                    }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {options?.categories.map(category => (
                        <SelectItem key={category} value={category}>
                          {category}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="flex items-center space-x-2">
                  <Switch
                    id="isActive"
                    checked={formData.isActive}
                    onCheckedChange={(checked) => setFormData(prev => ({ 
                      ...prev, 
                      isActive: checked 
                    }))}
                  />
                  <Label htmlFor="isActive">Active</Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    id="isDefault"
                    checked={formData.isDefault}
                    onCheckedChange={(checked) => setFormData(prev => ({ 
                      ...prev, 
                      isDefault: checked 
                    }))}
                  />
                  <Label htmlFor="isDefault">Default Template</Label>
                </div>

                <div>
                  <Label htmlFor="priority">Priority (0-100)</Label>
                  <Input
                    id="priority"
                    type="number"
                    min="0"
                    max="100"
                    value={formData.priority}
                    onChange={(e) => setFormData(prev => ({ 
                      ...prev, 
                      priority: parseInt(e.target.value) || 0 
                    }))}
                  />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="template" className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2">
                  <Label htmlFor="messageTemplate">Message Template *</Label>
                  <Textarea
                    id="messageTemplate"
                    value={formData.messageTemplate}
                    onChange={(e) => setFormData(prev => ({ 
                      ...prev, 
                      messageTemplate: e.target.value 
                    }))}
                    placeholder="Enter your message template here. Use {{variable}} for dynamic content."
                    rows={10}
                    required
                  />
                  
                  {/* Validation feedback */}
                  {validationErrors.length > 0 && (
                    <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded">
                      <div className="flex items-center gap-2 text-red-600 font-medium">
                        <AlertTriangle className="w-4 h-4" />
                        Template Errors:
                      </div>
                      <ul className="mt-1 text-sm text-red-600 list-disc list-inside">
                        {validationErrors.map((error, index) => (
                          <li key={`validationErrors-${index}-${error}`}>{error}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {validationWarnings.length > 0 && (
                    <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded">
                      <div className="flex items-center gap-2 text-yellow-600 font-medium">
                        <AlertTriangle className="w-4 h-4" />
                        Template Warnings:
                      </div>
                      <ul className="mt-1 text-sm text-yellow-600 list-disc list-inside">
                        {validationWarnings.map((warning, index) => (
                          <li key={`validationWarnings-${index}-${warning}`}>{warning}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                <div>
                  <Label>Template Variables</Label>
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {formData.templateVariables.map((variable, index) => (
                      <div key={`formData-templateVariables-${index}-${variable.name}`} className="p-2 border rounded">
                        <div className="flex items-center justify-between mb-2">
                          <Badge 
                            variant="outline" 
                            className="cursor-pointer"
                            onClick={() => insertVariable(variable.name)}
                          >
                            {variable.name || `Variable ${index + 1}`}
                          </Badge>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveVariable(index)}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                        
                        <div className="space-y-2 text-xs">
                          <Input
                            placeholder="Variable name (e.g., guestName)"
                            value={variable.name}
                            onChange={(e) => handleVariableChange(index, 'name', e.target.value)}
                            className="h-8"
                          />
                          <Input
                            placeholder="Display name"
                            value={variable.displayName}
                            onChange={(e) => handleVariableChange(index, 'displayName', e.target.value)}
                            className="h-8"
                          />
                          <Select
                            value={variable.dataType}
                            onValueChange={(value) => handleVariableChange(index, 'dataType', value)}
                          >
                            <SelectTrigger className="h-8">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {options?.dataTypes.map(type => (
                                <SelectItem key={type} value={type}>
                                  {type}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <div className="flex items-center space-x-2">
                            <Switch
                              checked={variable.required}
                              onCheckedChange={(checked) => handleVariableChange(index, 'required', checked)}
                            />
                            <span>Required</span>
                          </div>
                        </div>
                      </div>
                    ))}
                    
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleAddVariable}
                      className="w-full"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Add Variable
                    </Button>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="triggers" className="space-y-4">
              <div className="flex items-center space-x-2">
                <Switch
                  id="automaticTrigger"
                  checked={formData.triggerConditions.automaticTrigger}
                  onCheckedChange={(checked) => setFormData(prev => ({
                    ...prev,
                    triggerConditions: {
                      ...prev.triggerConditions,
                      automaticTrigger: checked
                    }
                  }))}
                />
                <Label htmlFor="automaticTrigger">
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4" />
                    Enable Automatic Triggering
                  </div>
                </Label>
              </div>

              {formData.triggerConditions.automaticTrigger && (
                <div className="space-y-4 pl-6 border-l-2 border-blue-200">
                  <div>
                    <Label>Trigger Events</Label>
                    <div className="grid grid-cols-3 gap-2 mt-2">
                      {options?.triggerEvents.map(event => (
                        <label key={event} className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            checked={formData.triggerConditions.triggerEvents.includes(event)}
                            onChange={(e) => {
                              const events = e.target.checked
                                ? [...formData.triggerConditions.triggerEvents, event]
                                : formData.triggerConditions.triggerEvents.filter(e => e !== event);
                              
                              setFormData(prev => ({
                                ...prev,
                                triggerConditions: {
                                  ...prev.triggerConditions,
                                  triggerEvents: events
                                }
                              }));
                            }}
                          />
                          <span className="text-sm">{event.replace('_', ' ')}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="delayAmount">Trigger Delay</Label>
                      <div className="flex gap-2">
                        <Input
                          id="delayAmount"
                          type="number"
                          min="0"
                          value={formData.triggerConditions.triggerDelay.amount}
                          onChange={(e) => setFormData(prev => ({
                            ...prev,
                            triggerConditions: {
                              ...prev.triggerConditions,
                              triggerDelay: {
                                ...prev.triggerConditions.triggerDelay,
                                amount: parseInt(e.target.value) || 0
                              }
                            }
                          }))}
                        />
                        <Select
                          value={formData.triggerConditions.triggerDelay.unit}
                          onValueChange={(value) => setFormData(prev => ({
                            ...prev,
                            triggerConditions: {
                              ...prev.triggerConditions,
                              triggerDelay: {
                                ...prev.triggerConditions.triggerDelay,
                                unit: value
                              }
                            }
                          }))}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="minutes">Minutes</SelectItem>
                            <SelectItem value="hours">Hours</SelectItem>
                            <SelectItem value="days">Days</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <Switch
                          checked={formData.triggerConditions.conditions.requiresApproval}
                          onCheckedChange={(checked) => setFormData(prev => ({
                            ...prev,
                            triggerConditions: {
                              ...prev.triggerConditions,
                              conditions: {
                                ...prev.triggerConditions.conditions,
                                requiresApproval: checked
                              }
                            }
                          }))}
                        />
                        <Label>Requires Approval</Label>
                      </div>

                      {formData.triggerConditions.conditions.requiresApproval && (
                        <Input
                          type="number"
                          placeholder="Approval threshold amount"
                          value={formData.triggerConditions.conditions.approvalThreshold || ''}
                          onChange={(e) => setFormData(prev => ({
                            ...prev,
                            triggerConditions: {
                              ...prev.triggerConditions,
                              conditions: {
                                ...prev.triggerConditions.conditions,
                                approvalThreshold: parseFloat(e.target.value) || undefined
                              }
                            }
                          }))}
                        />
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Amount Conditions</Label>
                      <div className="flex gap-2">
                        <Input
                          type="number"
                          placeholder="Min amount"
                          value={formData.triggerConditions.conditions.minAmount || ''}
                          onChange={(e) => setFormData(prev => ({
                            ...prev,
                            triggerConditions: {
                              ...prev.triggerConditions,
                              conditions: {
                                ...prev.triggerConditions.conditions,
                                minAmount: parseFloat(e.target.value) || undefined
                              }
                            }
                          }))}
                        />
                        <Input
                          type="number"
                          placeholder="Max amount"
                          value={formData.triggerConditions.conditions.maxAmount || ''}
                          onChange={(e) => setFormData(prev => ({
                            ...prev,
                            triggerConditions: {
                              ...prev.triggerConditions,
                              conditions: {
                                ...prev.triggerConditions.conditions,
                                maxAmount: parseFloat(e.target.value) || undefined
                              }
                            }
                          }))}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <Switch
                          checked={formData.triggerConditions.conditions.weekdayOnly}
                          onCheckedChange={(checked) => setFormData(prev => ({
                            ...prev,
                            triggerConditions: {
                              ...prev.triggerConditions,
                              conditions: {
                                ...prev.triggerConditions.conditions,
                                weekdayOnly: checked,
                                weekendOnly: checked ? false : prev.triggerConditions.conditions.weekendOnly
                              }
                            }
                          }))}
                        />
                        <Label>Weekdays Only</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Switch
                          checked={formData.triggerConditions.conditions.weekendOnly}
                          onCheckedChange={(checked) => setFormData(prev => ({
                            ...prev,
                            triggerConditions: {
                              ...prev.triggerConditions,
                              conditions: {
                                ...prev.triggerConditions.conditions,
                                weekendOnly: checked,
                                weekdayOnly: checked ? false : prev.triggerConditions.conditions.weekdayOnly
                              }
                            }
                          }))}
                        />
                        <Label>Weekends Only</Label>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="formatting" className="space-y-4">
              <div className="grid grid-cols-4 gap-4">
                <div>
                  <Label>Font Size</Label>
                  <Select
                    value={formData.formatting.fontSize}
                    onValueChange={(value) => setFormData(prev => ({
                      ...prev,
                      formatting: {
                        ...prev.formatting,
                        fontSize: value
                      }
                    }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="small">Small</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="large">Large</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Font Style</Label>
                  <Select
                    value={formData.formatting.fontStyle}
                    onValueChange={(value) => setFormData(prev => ({
                      ...prev,
                      formatting: {
                        ...prev.formatting,
                        fontStyle: value
                      }
                    }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="normal">Normal</SelectItem>
                      <SelectItem value="bold">Bold</SelectItem>
                      <SelectItem value="italic">Italic</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Alignment</Label>
                  <Select
                    value={formData.formatting.alignment}
                    onValueChange={(value) => setFormData(prev => ({
                      ...prev,
                      formatting: {
                        ...prev.formatting,
                        alignment: value
                      }
                    }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="left">Left</SelectItem>
                      <SelectItem value="center">Center</SelectItem>
                      <SelectItem value="right">Right</SelectItem>
                      <SelectItem value="justify">Justify</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Language</Label>
                  <Input
                    value={formData.language}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      language: e.target.value
                    }))}
                    placeholder="e.g., en"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center space-x-2">
                  <Switch
                    checked={formData.formatting.includeHeader}
                    onCheckedChange={(checked) => setFormData(prev => ({
                      ...prev,
                      formatting: {
                        ...prev.formatting,
                        includeHeader: checked
                      }
                    }))}
                  />
                  <Label>Include Header</Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    checked={formData.formatting.includeFooter}
                    onCheckedChange={(checked) => setFormData(prev => ({
                      ...prev,
                      formatting: {
                        ...prev.formatting,
                        includeFooter: checked
                      }
                    }))}
                  />
                  <Label>Include Footer</Label>
                </div>
              </div>

              {formData.formatting.includeHeader && (
                <div>
                  <Label>Header Text</Label>
                  <Input
                    value={formData.formatting.headerText || ''}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      formatting: {
                        ...prev.formatting,
                        headerText: e.target.value
                      }
                    }))}
                    placeholder="Header text..."
                  />
                </div>
              )}

              {formData.formatting.includeFooter && (
                <div>
                  <Label>Footer Text</Label>
                  <Input
                    value={formData.formatting.footerText || ''}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      formatting: {
                        ...prev.formatting,
                        footerText: e.target.value
                      }
                    }))}
                    placeholder="Footer text..."
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Background Color</Label>
                  <Input
                    type="color"
                    value={formData.formatting.backgroundColor}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      formatting: {
                        ...prev.formatting,
                        backgroundColor: e.target.value
                      }
                    }))}
                  />
                </div>

                <div>
                  <Label>Text Color</Label>
                  <Input
                    type="color"
                    value={formData.formatting.textColor}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      formatting: {
                        ...prev.formatting,
                        textColor: e.target.value
                      }
                    }))}
                  />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="advanced" className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <Label>Message Translations</Label>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleAddTranslation}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Translation
                  </Button>
                </div>

                <div className="space-y-4">
                  {formData.translations.map((translation, index) => (
                    <Card key={`formData-translations-${index}`}>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="font-medium">Translation {index + 1}</h4>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveTranslation(index)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>

                        <div className="space-y-3">
                          <Input
                            placeholder="Language code (e.g., es, fr)"
                            value={translation.language}
                            onChange={(e) => handleTranslationChange(index, 'language', e.target.value)}
                          />
                          <Textarea
                            placeholder="Translated message template"
                            value={translation.messageTemplate}
                            onChange={(e) => handleTranslationChange(index, 'messageTemplate', e.target.value)}
                            rows={4}
                          />
                          <div className="grid grid-cols-2 gap-2">
                            <Input
                              placeholder="Translated header text"
                              value={translation.headerText || ''}
                              onChange={(e) => handleTranslationChange(index, 'headerText', e.target.value)}
                            />
                            <Input
                              placeholder="Translated footer text"
                              value={translation.footerText || ''}
                              onChange={(e) => handleTranslationChange(index, 'footerText', e.target.value)}
                            />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="settings" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Settings className="w-5 h-5" />
                    Integration Settings
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-center space-x-2">
                      <Switch
                        checked={formData.integrationSettings.printAutomatically}
                        onCheckedChange={(checked) => setFormData(prev => ({
                          ...prev,
                          integrationSettings: {
                            ...prev.integrationSettings,
                            printAutomatically: checked
                          }
                        }))}
                      />
                      <Label>Print Automatically</Label>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Switch
                        checked={formData.integrationSettings.emailCopy}
                        onCheckedChange={(checked) => setFormData(prev => ({
                          ...prev,
                          integrationSettings: {
                            ...prev.integrationSettings,
                            emailCopy: checked
                          }
                        }))}
                      />
                      <Label>Email Copy</Label>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Switch
                        checked={formData.integrationSettings.attachToFolio}
                        onCheckedChange={(checked) => setFormData(prev => ({
                          ...prev,
                          integrationSettings: {
                            ...prev.integrationSettings,
                            attachToFolio: checked
                          }
                        }))}
                      />
                      <Label>Attach to Folio</Label>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Switch
                        checked={formData.integrationSettings.requireSignature}
                        onCheckedChange={(checked) => setFormData(prev => ({
                          ...prev,
                          integrationSettings: {
                            ...prev.integrationSettings,
                            requireSignature: checked
                          }
                        }))}
                      />
                      <Label>Require Signature</Label>
                    </div>
                  </div>

                  {formData.integrationSettings.emailCopy && (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <Label>Email Addresses</Label>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={handleAddEmailAddress}
                        >
                          <Plus className="w-4 h-4 mr-2" />
                          Add Email
                        </Button>
                      </div>
                      <div className="space-y-2">
                        {formData.integrationSettings.emailAddresses.map((email, index) => (
                          <div key={`formData-integrationSettings-emailAddresses-${index}-${email}`} className="flex gap-2">
                            <Input
                              type="email"
                              placeholder="email@example.com"
                              value={email}
                              onChange={(e) => handleEmailAddressChange(index, e.target.value)}
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemoveEmailAddress(index)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div>
                    <Label>Charge Code</Label>
                    <Input
                      value={formData.integrationSettings.chargeCode || ''}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        integrationSettings: {
                          ...prev.integrationSettings,
                          chargeCode: e.target.value
                        }
                      }))}
                      placeholder="Optional charge code"
                    />
                  </div>
                </CardContent>
              </Card>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Notes</Label>
                  <Textarea
                    value={formData.notes || ''}
                    onChange={(e) => setFormData(prev => ({ 
                      ...prev, 
                      notes: e.target.value 
                    }))}
                    placeholder="Public notes..."
                    rows={3}
                  />
                </div>

                <div>
                  <Label>Internal Notes</Label>
                  <Textarea
                    value={formData.internalNotes || ''}
                    onChange={(e) => setFormData(prev => ({ 
                      ...prev, 
                      internalNotes: e.target.value 
                    }))}
                    placeholder="Internal notes..."
                    rows={3}
                  />
                </div>
              </div>
            </TabsContent>
          </Tabs>

          {/* Multi-property selector */}
          <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mt-4">
            <ApplyToSelector
              value={applyToScope}
              onChange={setApplyToScope}
              isInGroup={inheritanceStatus?.hasGroup || false}
              groupName={inheritanceStatus?.groupName}
              totalProperties={inheritanceStatus?.groupPropertyCount || 0}
              showWarning={true}
              warningMessage="This message template will be applied to all selected properties. Ensure the template content, formatting, and trigger conditions are appropriate for all properties."
            />
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button type="button" variant="outline" onClick={onClose}>
              <X className="w-4 h-4 mr-2" />
              Cancel
            </Button>
            <Button type="submit" disabled={saving || validationErrors.length > 0 || isUpdating}>
              {saving || isUpdating ? (
                'Saving...'
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  {message ? 'Update Message' : 'Create Message'}
                </>
              )}
            </Button>
          </div>
        </form>

        {/* Confirmation Dialog */}
        <ApplyToConfirmation
          isOpen={showConfirmation}
          scope={applyToScope}
          affectedCount={affectedCount}
          settingName="Message Template"
          groupName={inheritanceStatus?.groupName}
          onConfirm={handleConfirm}
          onCancel={cancelBulkUpdate}
        />
      </DialogContent>
    </Dialog>
  );
};

export default withErrorBoundary(MessageTemplateEditor, { level: 'component' });