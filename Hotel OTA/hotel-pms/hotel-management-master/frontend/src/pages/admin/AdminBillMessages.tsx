import React, { useState, useEffect } from 'react';
import { useProperty } from '../../context/PropertyContext';
import { PropertyBreadcrumb } from '../../components/common/PropertyBreadcrumb';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Plus, Edit, Trash2, MessageSquare, Eye, Globe, Clock, RefreshCw, FileText, Settings
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { api } from '../../services/api';
import { withErrorBoundary } from '../../components/ErrorBoundary';

interface BillMessage {
  _id: string;
  messageId: string;
  name: string;
  title: string;
  description?: string;
  messageType: string;
  content: string;
  htmlContent?: string;
  isActive: boolean;
  usageCount: number;
  lastUsed?: string;
  category: string;
  priority: number;
  sortOrder: number;
  formattedDisplay: string;
  isCurrentlyValid: boolean;
  localization: {
    language: string;
    region: string;
    translations: Array<{
      language: string;
      content: string;
      title?: string;
    }>;
  };
  scheduling: {
    enabled: boolean;
    validFrom: string;
    validTo?: string;
  };
}

const AdminBillMessages: React.FC = () => {
  const { selectedPropertyId, selectedProperty, viewMode } = useProperty();
  const [messages, setMessages] = useState<BillMessage[]>([]);
  const [selectedMessage, setSelectedMessage] = useState<BillMessage | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [previewContent, setPreviewContent] = useState('');
  
  const [formData, setFormData] = useState({
    name: '',
    title: '',
    description: '',
    messageType: '',
    content: '',
    htmlContent: '',
    category: 'STANDARD',
    priority: 100,
    sortOrder: 0,
    displayConfig: {
      position: 'BOTTOM',
      alignment: 'CENTER',
      fontSize: 'MEDIUM',
      fontWeight: 'NORMAL'
    },
    scheduling: {
      enabled: false,
      validFrom: new Date().toISOString().split('T')[0],
      validTo: ''
    },
    localization: {
      language: 'en',
      region: 'US',
      translations: [] as Array<{ language: string; content: string; title?: string }>
    },
    posIntegration: {
      applicableOutlets: [],
      applicableCategories: [],
      minOrderAmount: 0,
      maxOrderAmount: null,
      customerTypes: []
    }
  });

  const messageTypes = [
    { value: 'HEADER', label: 'Header', icon: FileText },
    { value: 'FOOTER', label: 'Footer', icon: FileText },
    { value: 'PROMOTIONAL', label: 'Promotional', icon: MessageSquare },
    { value: 'THANK_YOU', label: 'Thank You', icon: MessageSquare },
    { value: 'TERMS_CONDITIONS', label: 'Terms & Conditions', icon: Settings },
    { value: 'DISCLAIMER', label: 'Disclaimer', icon: Settings },
    { value: 'CONTACT_INFO', label: 'Contact Info', icon: MessageSquare },
    { value: 'SOCIAL_MEDIA', label: 'Social Media', icon: Globe },
    { value: 'CUSTOM', label: 'Custom', icon: Settings }
  ];

  const categories = [
    { value: 'STANDARD', label: 'Standard' },
    { value: 'PROMOTIONAL', label: 'Promotional' },
    { value: 'LEGAL', label: 'Legal' },
    { value: 'CONTACT', label: 'Contact' },
    { value: 'SOCIAL', label: 'Social' },
    { value: 'CUSTOM', label: 'Custom' }
  ];

  const positions = [
    { value: 'TOP', label: 'Top' },
    { value: 'BOTTOM', label: 'Bottom' },
    { value: 'CENTER', label: 'Center' },
    { value: 'CUSTOM', label: 'Custom' }
  ];

  const alignments = [
    { value: 'LEFT', label: 'Left' },
    { value: 'CENTER', label: 'Center' },
    { value: 'RIGHT', label: 'Right' },
    { value: 'JUSTIFY', label: 'Justify' }
  ];

  const fontSizes = [
    { value: 'SMALL', label: 'Small' },
    { value: 'MEDIUM', label: 'Medium' },
    { value: 'LARGE', label: 'Large' },
    { value: 'EXTRA_LARGE', label: 'Extra Large' }
  ];

  const fontWeights = [
    { value: 'NORMAL', label: 'Normal' },
    { value: 'BOLD', label: 'Bold' },
    { value: 'LIGHT', label: 'Light' }
  ];

  useEffect(() => {
    if (selectedPropertyId) {
      fetchMessages();
    }
  }, [selectedPropertyId]);

  const fetchMessages = async () => {
    try {
      setLoading(true);
      const response = await api.get('/pos/bill-messages', {
        params: { propertyId: selectedPropertyId, page: 1, limit: 100 }
      });
      if (response.data.status === 'success') {
        setMessages(response.data.data.messages);
      }
    } catch (error) {
      toast.error('Failed to fetch bill messages');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateMessage = async () => {
    if (!formData.name.trim() || !formData.messageType || !formData.content.trim()) {
      toast.error('Message name, type, and content are required');
      return;
    }
    try {
      const response = await api.post('/pos/bill-messages', formData);
      if (response.data.status === 'success') {
        toast.success('Bill message created successfully');
        fetchMessages();
        setIsCreateModalOpen(false);
        resetForm();
      }
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } }; message?: string };
      toast.error(err.response?.data?.message || 'Failed to create message');
    }
  };

  const handleUpdateMessage = async () => {
    if (!selectedMessage) return;
    if (!formData.name.trim() || !formData.messageType || !formData.content.trim()) {
      toast.error('Message name, type, and content are required');
      return;
    }
    try {
      const response = await api.put(`/pos/bill-messages/${selectedMessage._id}`, formData);
      if (response.data.status === 'success') {
        toast.success('Bill message updated successfully');
        fetchMessages();
        setIsEditModalOpen(false);
        setSelectedMessage(null);
        resetForm();
      }
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } }; message?: string };
      toast.error(err.response?.data?.message || 'Failed to update message');
    }
  };

  const handleDeleteMessage = async (message: BillMessage) => {
    if (!confirm(`Are you sure you want to ${message.usageCount > 0 ? 'deactivate' : 'delete'} this message?`)) {
      return;
    }

    try {
      const response = await api.delete(`/pos/bill-messages/${message._id}`);
      if (response.data.status === 'success') {
        toast.success(response.data.message);
        fetchMessages();
      }
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } }; message?: string };
      toast.error(err.response?.data?.message || 'Failed to delete message');
    }
  };

  const handlePreviewMessage = async (message: BillMessage) => {
    try {
      const context = {
        customerName: 'John Doe',
        orderAmount: 150.00,
        outletName: 'Main Restaurant',
        currentDate: new Date().toLocaleDateString(),
        currentTime: new Date().toLocaleTimeString()
      };

      const response = await api.post(`/pos/bill-messages/${message._id}/preview`, context);
      if (response.data.status === 'success') {
        setPreviewContent(response.data.data.preview.processedContent);
        setSelectedMessage(message);
        setIsPreviewModalOpen(true);
      }
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } }; message?: string };
      toast.error(err.response?.data?.message || 'Failed to preview message');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      title: '',
      description: '',
      messageType: '',
      content: '',
      htmlContent: '',
      category: 'STANDARD',
      priority: 100,
      sortOrder: 0,
      displayConfig: {
        position: 'BOTTOM',
        alignment: 'CENTER',
        fontSize: 'MEDIUM',
        fontWeight: 'NORMAL'
      },
      scheduling: {
        enabled: false,
        validFrom: new Date().toISOString().split('T')[0],
        validTo: ''
      },
      localization: {
        language: 'en',
        region: 'US',
        translations: [] as Array<{ language: string; content: string; title?: string }>
      },
      posIntegration: {
        applicableOutlets: [],
        applicableCategories: [],
        minOrderAmount: 0,
        maxOrderAmount: null,
        customerTypes: []
      }
    });
  };

  const openEditModal = (message: BillMessage) => {
    setSelectedMessage(message);
    setFormData({
      name: message.name,
      title: message.title,
      description: message.description || '',
      messageType: message.messageType,
      content: message.content,
      htmlContent: message.htmlContent || '',
      category: message.category,
      priority: message.priority,
      sortOrder: message.sortOrder,
      displayConfig: {
        position: 'BOTTOM',
        alignment: 'CENTER',
        fontSize: 'MEDIUM',
        fontWeight: 'NORMAL'
      },
      scheduling: {
        enabled: message.scheduling.enabled,
        validFrom: message.scheduling.validFrom.split('T')[0],
        validTo: message.scheduling.validTo ? message.scheduling.validTo.split('T')[0] : ''
      },
      localization: {
        language: message.localization.language,
        region: message.localization.region,
        translations: message.localization.translations
      },
      posIntegration: {
        applicableOutlets: [],
        applicableCategories: [],
        minOrderAmount: 0,
        maxOrderAmount: null,
        customerTypes: []
      }
    });
    setIsEditModalOpen(true);
  };

  const getMessageTypeColor = (type: string) => {
    const colors = {
      HEADER: 'bg-blue-100 text-blue-800',
      FOOTER: 'bg-gray-100 text-gray-800',
      PROMOTIONAL: 'bg-green-100 text-green-800',
      THANK_YOU: 'bg-purple-100 text-purple-800',
      TERMS_CONDITIONS: 'bg-orange-100 text-orange-800',
      DISCLAIMER: 'bg-red-100 text-red-800',
      CONTACT_INFO: 'bg-indigo-100 text-indigo-800',
      SOCIAL_MEDIA: 'bg-pink-100 text-pink-800',
      CUSTOM: 'bg-yellow-100 text-yellow-800'
    };
    return colors[type as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  const getCategoryColor = (category: string) => {
    const colors = {
      STANDARD: 'bg-blue-100 text-blue-800',
      PROMOTIONAL: 'bg-green-100 text-green-800',
      LEGAL: 'bg-red-100 text-red-800',
      CONTACT: 'bg-indigo-100 text-indigo-800',
      SOCIAL: 'bg-pink-100 text-pink-800',
      CUSTOM: 'bg-gray-100 text-gray-800'
    };
    return colors[category as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  if (!selectedPropertyId && viewMode === 'single') {
    return (
      <div className="p-6">
        <PropertyBreadcrumb items={['Compliance', 'Bill Messages']} />
        <div className="mt-8 text-center">
          <p className="text-gray-500">Please select a property to manage bill messages</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <PropertyBreadcrumb items={['Compliance', 'Bill Messages']} />

      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Bill Messages</h1>
        <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Create Message
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create New Bill Message</DialogTitle>
            </DialogHeader>
            <MessageForm
              formData={formData}
              setFormData={setFormData}
              onSubmit={handleCreateMessage}
              onCancel={() => setIsCreateModalOpen(false)}
              messageTypes={messageTypes}
              categories={categories}
              positions={positions}
              alignments={alignments}
              fontSizes={fontSizes}
              fontWeights={fontWeights}
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* Message Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardContent className="flex items-center p-6">
            <MessageSquare className="w-8 h-8 text-blue-600 mr-4" />
            <div>
              <p className="text-sm font-medium text-gray-600">Total Messages</p>
              <p className="text-2xl font-bold">{messages.length}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center p-6">
            <Settings className="w-8 h-8 text-green-600 mr-4" />
            <div>
              <p className="text-sm font-medium text-gray-600">Active Messages</p>
              <p className="text-2xl font-bold">{messages.filter(m => m.isActive).length}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center p-6">
            <Clock className="w-8 h-8 text-purple-600 mr-4" />
            <div>
              <p className="text-sm font-medium text-gray-600">Scheduled Messages</p>
              <p className="text-2xl font-bold">{messages.filter(m => m.scheduling.enabled).length}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center p-6">
            <Globe className="w-8 h-8 text-orange-600 mr-4" />
            <div>
              <p className="text-sm font-medium text-gray-600">Multi-language</p>
              <p className="text-2xl font-bold">{messages.filter(m => m.localization.translations.length > 0).length}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Messages Table */}
      <Card>
        <CardHeader>
          <CardTitle>Bill Messages</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Message ID</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Usage</TableHead>
                <TableHead>Language</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {messages.map((message) => (
                <TableRow key={message._id}>
                  <TableCell className="font-mono">{message.messageId}</TableCell>
                  <TableCell>
                    <div>
                      <p className="font-semibold">{message.title}</p>
                      <p className="text-sm text-gray-600">{message.name}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge className={getMessageTypeColor(message.messageType)}>
                      {message.messageType}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge className={getCategoryColor(message.category)}>
                      {message.category}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-2">
                      <Badge variant={message.isActive ? "default" : "secondary"}>
                        {message.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                      {message.scheduling.enabled && (
                        <Badge variant="outline">
                          <Clock className="w-3 h-3 mr-1" />
                          Scheduled
                        </Badge>
                      )}
                      {message.localization.translations.length > 0 && (
                        <Badge variant="outline">
                          <Globe className="w-3 h-3 mr-1" />
                          Multi-lang
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div>
                      <p className="font-semibold">{message.usageCount}</p>
                      {message.lastUsed && (
                        <p className="text-sm text-gray-600">
                          {new Date(message.lastUsed).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{message.localization.language.toUpperCase()}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex space-x-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handlePreviewMessage(message)}
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openEditModal(message)}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDeleteMessage(message)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Edit Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Bill Message</DialogTitle>
          </DialogHeader>
          <MessageForm
            formData={formData}
            setFormData={setFormData}
            onSubmit={handleUpdateMessage}
            onCancel={() => setIsEditModalOpen(false)}
            isEdit
            messageTypes={messageTypes}
            categories={categories}
            positions={positions}
            alignments={alignments}
            fontSizes={fontSizes}
            fontWeights={fontWeights}
          />
        </DialogContent>
      </Dialog>

      {/* Preview Modal */}
      <Dialog open={isPreviewModalOpen} onOpenChange={setIsPreviewModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Message Preview</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-4 border rounded-md bg-gray-50">
              <h3 className="font-semibold mb-2">Preview Content:</h3>
              <div className="whitespace-pre-wrap">{previewContent}</div>
            </div>
            <div className="flex justify-end">
              <Button variant="outline" onClick={() => setIsPreviewModalOpen(false)}>
                Close
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// Message Form Component
const MessageForm: React.FC<{
  formData: Record<string, unknown>;
  setFormData: (data: Record<string, unknown>) => void;
  onSubmit: () => void;
  onCancel: () => void;
  isEdit?: boolean;
  messageTypes: Array<{ value: string; label: string; icon: React.ComponentType<{ className?: string }> }>;
  categories: Array<{ value: string; label: string }>;
  positions: Array<{ value: string; label: string }>;
  alignments: Array<{ value: string; label: string }>;
  fontSizes: Array<{ value: string; label: string }>;
  fontWeights: Array<{ value: string; label: string }>;
}> = ({ formData, setFormData, onSubmit, onCancel, isEdit, messageTypes, categories, positions, alignments, fontSizes, fontWeights }) => {
  const [activeTab, setActiveTab] = useState('basic');

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
      <TabsList>
        <TabsTrigger value="basic">Basic Info</TabsTrigger>
        <TabsTrigger value="content">Content</TabsTrigger>
        <TabsTrigger value="display">Display</TabsTrigger>
        <TabsTrigger value="scheduling">Scheduling</TabsTrigger>
      </TabsList>

      <TabsContent value="basic" className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="name">Message Name</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Enter message name"
            />
          </div>

          <div>
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="Enter message title"
            />
          </div>

          <div>
            <Label htmlFor="messageType">Message Type</Label>
            <Select value={formData.messageType} onValueChange={(value) => setFormData({ ...formData, messageType: value })}>
              <SelectTrigger>
                <SelectValue placeholder="Select message type" />
              </SelectTrigger>
              <SelectContent>
                {messageTypes.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="category">Category</Label>
            <Select value={formData.category} onValueChange={(value) => setFormData({ ...formData, category: value })}>
              <SelectTrigger>
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((category) => (
                  <SelectItem key={category.value} value={category.value}>
                    {category.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="priority">Priority</Label>
            <Input
              id="priority"
              type="number"
              min="1"
              max="1000"
              value={formData.priority}
              onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) || 100 })}
            />
          </div>

          <div>
            <Label htmlFor="sortOrder">Sort Order</Label>
            <Input
              id="sortOrder"
              type="number"
              min="0"
              value={formData.sortOrder}
              onChange={(e) => setFormData({ ...formData, sortOrder: parseInt(e.target.value) || 0 })}
            />
          </div>

          <div className="col-span-2">
            <Label htmlFor="description">Description</Label>
            <Input
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Enter message description"
            />
          </div>
        </div>
      </TabsContent>

      <TabsContent value="content" className="space-y-4">
        <div className="space-y-4">
          <div>
            <Label htmlFor="content">Message Content</Label>
            <textarea
              id="content"
              className="w-full p-3 border rounded-md min-h-[200px]"
              value={formData.content}
              onChange={(e) => setFormData({ ...formData, content: e.target.value })}
              placeholder="Enter message content. Use {{variable_name}} for dynamic content."
              required
            />
            <p className="text-sm text-gray-600 mt-1">
              Use variables like {'{{customerName}}'}, {'{{orderAmount}}'}, {'{{currentDate}}'} for dynamic content
            </p>
          </div>

          <div>
            <Label htmlFor="htmlContent">HTML Content (Optional)</Label>
            <textarea
              id="htmlContent"
              className="w-full p-3 border rounded-md min-h-[150px]"
              value={formData.htmlContent}
              onChange={(e) => setFormData({ ...formData, htmlContent: e.target.value })}
              placeholder="Enter HTML content for rich formatting"
            />
          </div>
        </div>
      </TabsContent>

      <TabsContent value="display" className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="position">Position</Label>
            <Select value={formData.displayConfig.position} onValueChange={(value) => setFormData({ ...formData, displayConfig: { ...formData.displayConfig, position: value } })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {positions.map((position) => (
                  <SelectItem key={position.value} value={position.value}>
                    {position.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="alignment">Alignment</Label>
            <Select value={formData.displayConfig.alignment} onValueChange={(value) => setFormData({ ...formData, displayConfig: { ...formData.displayConfig, alignment: value } })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {alignments.map((alignment) => (
                  <SelectItem key={alignment.value} value={alignment.value}>
                    {alignment.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="fontSize">Font Size</Label>
            <Select value={formData.displayConfig.fontSize} onValueChange={(value) => setFormData({ ...formData, displayConfig: { ...formData.displayConfig, fontSize: value } })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {fontSizes.map((size) => (
                  <SelectItem key={size.value} value={size.value}>
                    {size.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="fontWeight">Font Weight</Label>
            <Select value={formData.displayConfig.fontWeight} onValueChange={(value) => setFormData({ ...formData, displayConfig: { ...formData.displayConfig, fontWeight: value } })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {fontWeights.map((weight) => (
                  <SelectItem key={weight.value} value={weight.value}>
                    {weight.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </TabsContent>

      <TabsContent value="scheduling" className="space-y-4">
        <div className="space-y-4">
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="schedulingEnabled"
              checked={formData.scheduling.enabled}
              onChange={(e) => setFormData({
                ...formData,
                scheduling: { ...formData.scheduling, enabled: e.target.checked }
              })}
            />
            <Label htmlFor="schedulingEnabled">Enable Scheduling</Label>
          </div>

          {formData.scheduling.enabled && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="validFrom">Valid From</Label>
                <Input
                  id="validFrom"
                  type="date"
                  value={formData.scheduling.validFrom}
                  onChange={(e) => setFormData({
                    ...formData,
                    scheduling: { ...formData.scheduling, validFrom: e.target.value }
                  })}
                />
              </div>

              <div>
                <Label htmlFor="validTo">Valid To (Optional)</Label>
                <Input
                  id="validTo"
                  type="date"
                  value={formData.scheduling.validTo}
                  onChange={(e) => setFormData({
                    ...formData,
                    scheduling: { ...formData.scheduling, validTo: e.target.value }
                  })}
                />
              </div>
            </div>
          )}
        </div>
      </TabsContent>

      <div className="flex justify-end space-x-2 mt-6">
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={onSubmit}>
          {isEdit ? 'Update' : 'Create'} Message
        </Button>
      </div>
    </Tabs>
  );
};

export default withErrorBoundary(AdminBillMessages, { level: 'page' });