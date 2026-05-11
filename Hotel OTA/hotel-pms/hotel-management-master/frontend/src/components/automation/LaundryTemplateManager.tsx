import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Button } from '../../ui/button';
import { Badge } from '../../ui/Badge';
import { Input } from '../../ui/Input';
import { Label } from '../../ui/Label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/Select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '../../ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../ui/Tabs';
import { Switch } from '../../ui/Switch';
import { Textarea } from '../../ui/Textarea';
import {
  Plus,
  Edit,
  Trash2,
  Copy,
  Settings,
  TestTube,
  BarChart3,
  Shirt,
  Star,
  Clock,
  Users,
  Package,
  RefreshCw,
  Save,
  X
} from 'lucide-react';
import { toast } from '../../utils/toast';

interface LaundryTemplate {
  id: string;
  templateName: string;
  roomType: string;
  description: string;
  isDefault: boolean;
  isActive: boolean;
  items: LaundryTemplateItem[];
  guestCountAdjustments: {
    single: number;
    double: number;
    triple: number;
    quadPlus: number;
  };
  seasonalAdjustments: {
    summer: number;
    winter: number;
    monsoon: number;
  };
  usageStats: {
    timesUsed: number;
    averageProcessingTime: number;
    lastUsed: string;
  };
  estimatedTotalCost: number;
  createdAt: string;
  updatedAt: string;
}

interface LaundryTemplateItem {
  itemId: string;
  itemName: string;
  category: string;
  baseQuantity: number;
  guestMultiplier: number;
  isRequired: boolean;
  defaultReturnDays: number;
  specialInstructions: string;
  costPerItem: number;
  priority: 'low' | 'medium' | 'high' | 'urgent';
}

const LaundryTemplateManager: React.FC = () => {
  const [templates, setTemplates] = useState<LaundryTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTemplate, setSelectedTemplate] = useState<LaundryTemplate | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isTestDialogOpen, setIsTestDialogOpen] = useState(false);
  const [testResults, setTestResults] = useState<unknown>(null);

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      setLoading(true);
      const { data } = await api.get('/laundry-templates');
      setTemplates(data.data.templates);
    } catch (error) {
      toast.error('Failed to fetch laundry templates');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTemplate = async (templateData: Partial<LaundryTemplate>) => {
    try {
      await api.post('/laundry-templates', templateData);
      await fetchTemplates();
      setIsCreateDialogOpen(false);
      toast.success('Template created successfully');
    } catch (error) {
      toast.error('Failed to create template');
    }
  };

  const handleUpdateTemplate = async (templateId: string, templateData: Partial<LaundryTemplate>) => {
    try {
      await api.put(`/laundry-templates/${templateId}`, templateData);
      await fetchTemplates();
      setIsEditDialogOpen(false);
      toast.success('Template updated successfully');
    } catch (error) {
      toast.error('Failed to update template');
    }
  };

  const handleDeleteTemplate = async (templateId: string) => {
    if (!confirm('Are you sure you want to delete this template?')) return;

    try {
      await api.delete(`/laundry-templates/${templateId}`);
      await fetchTemplates();
      toast.success('Template deleted successfully');
    } catch (error) {
      toast.error('Failed to delete template');
    }
  };

  const handleSetDefault = async (templateId: string) => {
    try {
      await api.post(`/laundry-templates/${templateId}/set-default`);
      await fetchTemplates();
      toast.success('Template set as default successfully');
    } catch (error) {
      toast.error('Failed to set default template');
    }
  };

  const handleTestTemplate = async (templateId: string, testParams: Record<string, unknown>) => {
    try {
      const { data } = await api.post(`/laundry-templates/${templateId}/test`, testParams);
      setTestResults(data.data);
      setIsTestDialogOpen(true);
    } catch (error) {
      toast.error('Failed to test template');
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-red-100 text-red-800';
      case 'high': return 'bg-orange-100 text-orange-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'low': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Laundry Templates</h1>
          <p className="text-gray-600">Manage laundry processing templates for different room types</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchTemplates}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Create Template
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl">
              <DialogHeader>
                <DialogTitle>Create Laundry Template</DialogTitle>
                <DialogDescription>
                  Create a new laundry template for automated processing
                </DialogDescription>
              </DialogHeader>
              <CreateTemplateForm
                onSubmit={handleCreateTemplate}
                onCancel={() => setIsCreateDialogOpen(false)}
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Templates Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {templates.map((template) => (
          <Card key={template.id} className="relative">
            {template.isDefault && (
              <div className="absolute top-2 right-2">
                <Badge className="bg-yellow-100 text-yellow-800">
                  <Star className="h-3 w-3 mr-1" />
                  Default
                </Badge>
              </div>
            )}
            
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">{template.templateName}</CardTitle>
                <Badge variant={template.isActive ? "default" : "secondary"}>
                  {template.isActive ? 'Active' : 'Inactive'}
                </Badge>
              </div>
              <p className="text-sm text-gray-600">{template.description}</p>
            </CardHeader>
            
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2">
                <Package className="h-4 w-4 text-gray-500" />
                <span className="text-sm">Room Type: {template.roomType}</span>
              </div>
              
              <div className="flex items-center gap-2">
                <Shirt className="h-4 w-4 text-gray-500" />
                <span className="text-sm">{template.items.length} items</span>
              </div>
              
              <div className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-gray-500" />
                <span className="text-sm">Used {template.usageStats.timesUsed} times</span>
              </div>
              
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-gray-500" />
                <span className="text-sm">Avg. {template.usageStats.averageProcessingTime}min</span>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Est. Cost: ₹{template.estimatedTotalCost}</span>
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleTestTemplate(template.id, { guestCount: 2, season: 'normal', roomCondition: 'normal' })}
                >
                  <TestTube className="h-4 w-4 mr-1" />
                  Test
                </Button>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSelectedTemplate(template);
                    setIsEditDialogOpen(true);
                  }}
                >
                  <Edit className="h-4 w-4 mr-1" />
                  Edit
                </Button>
                
                {!template.isDefault && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleSetDefault(template.id)}
                  >
                    <Star className="h-4 w-4 mr-1" />
                    Set Default
                  </Button>
                )}
                
                {!template.isDefault && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDeleteTemplate(template.id)}
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    Delete
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Edit Laundry Template</DialogTitle>
            <DialogDescription>
              Modify the laundry template settings
            </DialogDescription>
          </DialogHeader>
          {selectedTemplate && (
            <EditTemplateForm
              template={selectedTemplate}
              onSubmit={(data) => handleUpdateTemplate(selectedTemplate.id, data)}
              onCancel={() => setIsEditDialogOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Test Results Dialog */}
      <Dialog open={isTestDialogOpen} onOpenChange={setIsTestDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Template Test Results</DialogTitle>
            <DialogDescription>
              Results of the template test with specified parameters
            </DialogDescription>
          </DialogHeader>
          {testResults && (
            <TestResultsDisplay results={testResults} />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

// Create Template Form Component
const CreateTemplateForm: React.FC<{
  onSubmit: (data: Partial<LaundryTemplate>) => void;
  onCancel: () => void;
}> = ({ onSubmit, onCancel }) => {
  const [formData, setFormData] = useState({
    templateName: '',
    roomType: '',
    description: '',
    isDefault: false,
    isActive: true,
    items: [] as LaundryTemplateItem[]
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="templateName">Template Name</Label>
          <Input
            id="templateName"
            value={formData.templateName}
            onChange={(e) => setFormData({ ...formData, templateName: e.target.value })}
            required
          />
        </div>
        <div>
          <Label htmlFor="roomType">Room Type</Label>
          <Select value={formData.roomType} onValueChange={(value) => setFormData({ ...formData, roomType: value })}>
            <SelectTrigger>
              <SelectValue placeholder="Select room type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="standard">Standard</SelectItem>
              <SelectItem value="deluxe">Deluxe</SelectItem>
              <SelectItem value="suite">Suite</SelectItem>
              <SelectItem value="presidential">Presidential</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
        />
      </div>

      <div className="flex items-center space-x-2">
        <Switch
          id="isDefault"
          checked={formData.isDefault}
          onCheckedChange={(checked) => setFormData({ ...formData, isDefault: checked })}
        />
        <Label htmlFor="isDefault">Set as default template</Label>
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit">
          <Save className="h-4 w-4 mr-2" />
          Create Template
        </Button>
      </div>
    </form>
  );
};

// Edit Template Form Component
const EditTemplateForm: React.FC<{
  template: LaundryTemplate;
  onSubmit: (data: Partial<LaundryTemplate>) => void;
  onCancel: () => void;
}> = ({ template, onSubmit, onCancel }) => {
  const [formData, setFormData] = useState(template);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="templateName">Template Name</Label>
          <Input
            id="templateName"
            value={formData.templateName}
            onChange={(e) => setFormData({ ...formData, templateName: e.target.value })}
            required
          />
        </div>
        <div>
          <Label htmlFor="roomType">Room Type</Label>
          <Select value={formData.roomType} onValueChange={(value) => setFormData({ ...formData, roomType: value })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="standard">Standard</SelectItem>
              <SelectItem value="deluxe">Deluxe</SelectItem>
              <SelectItem value="suite">Suite</SelectItem>
              <SelectItem value="presidential">Presidential</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
        />
      </div>

      <div className="flex items-center space-x-2">
        <Switch
          id="isActive"
          checked={formData.isActive}
          onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
        />
        <Label htmlFor="isActive">Active</Label>
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit">
          <Save className="h-4 w-4 mr-2" />
          Update Template
        </Button>
      </div>
    </form>
  );
};

// Test Results Display Component
const TestResultsDisplay: React.FC<{ results: unknown }> = ({ results }) => {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Test Parameters</Label>
          <div className="text-sm text-gray-600">
            <p>Guest Count: {results.testParameters.guestCount}</p>
            <p>Season: {results.testParameters.season}</p>
            <p>Room Condition: {results.testParameters.roomCondition}</p>
          </div>
        </div>
        <div>
          <Label>Results Summary</Label>
          <div className="text-sm text-gray-600">
            <p>Total Items: {results.summary.totalItems}</p>
            <p>Total Quantity: {results.summary.totalQuantity}</p>
            <p>Total Cost: ₹{results.summary.totalCost}</p>
            <p>Categories: {results.summary.categories.join(', ')}</p>
          </div>
        </div>
      </div>

      <div>
        <Label>Detailed Results</Label>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Item</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Quantity</TableHead>
              <TableHead>Cost</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {results.results.map((item: Record<string, unknown>, index: number) => (
              <TableRow key={`item-${index}`}>
                <TableCell>{item.itemName}</TableCell>
                <TableCell>{item.category}</TableCell>
                <TableCell>{item.quantity}</TableCell>
                <TableCell>₹{item.estimatedCost}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default LaundryTemplateManager;
