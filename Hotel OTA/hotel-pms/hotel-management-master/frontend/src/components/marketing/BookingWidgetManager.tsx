import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Edit, Code, Eye, MousePointer, ShoppingCart, Settings } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { bookingEngineService, BookingWidget, CreateWidgetData } from '@/services/bookingEngineService';


const BookingWidgetManager: React.FC = () => {
  const [widgets, setWidgets] = useState<BookingWidget[]>([]);
  const [selectedWidget, setSelectedWidget] = useState<BookingWidget | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isCodeModalOpen, setIsCodeModalOpen] = useState(false);
  const [widgetCode, setWidgetCode] = useState('');
  const [loading, setLoading] = useState(true);

  const [formData, setFormData] = useState<CreateWidgetData>({
    name: '',
    type: 'inline',
    config: {
      theme: {
        primaryColor: '#3b82f6',
        secondaryColor: '#f3f4f6',
        textColor: '#1f2937',
        borderRadius: '8px',
        fontFamily: 'Inter'
      },
      layout: {
        showImages: true,
        showPrices: true,
        showAmenities: true,
        showReviews: true,
        columns: 1,
        maxRooms: 10
      },
      behavior: {
        autoSearch: false,
        showAvailabilityCalendar: true,
        enableGuestSelection: true,
        minStayNights: 1,
        maxStayNights: 30,
        advanceBookingDays: 365
      }
    },
    domains: [{ domain: '', isActive: true, sslEnabled: true }],
    languages: [{ code: 'en', name: 'English', isDefault: true }]
  });

  useEffect(() => {
    fetchWidgets();
  }, []);

  const fetchWidgets = async () => {
    try {
      setLoading(true);
      const data = await bookingEngineService.getBookingWidgets();
      setWidgets(data);
    } catch (error) {
      console.error('Failed to load booking widgets:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateWidget = async () => {
    try {
      await bookingEngineService.createBookingWidget(formData);
      fetchWidgets();
      setIsCreateModalOpen(false);
      resetForm();
    } catch (error) {
      console.error('Error creating widget:', error);
    }
  };

  const handleUpdateWidget = async () => {
    if (!selectedWidget) return;

    try {
      await bookingEngineService.updateBookingWidget(selectedWidget._id, formData);
      fetchWidgets();
      setIsEditModalOpen(false);
      setSelectedWidget(null);
      resetForm();
    } catch (error) {
      console.error('Error updating widget:', error);
    }
  };

  const handleGetWidgetCode = async (widgetId: string) => {
    try {
      const data = await bookingEngineService.getWidgetCode(widgetId);
      setWidgetCode(data.code);
      setIsCodeModalOpen(true);
    } catch (error) {
      console.error('Error getting widget code:', error);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      type: 'inline',
      config: {
        theme: {
          primaryColor: '#3b82f6',
          secondaryColor: '#f3f4f6',
          textColor: '#1f2937',
          borderRadius: '8px',
          fontFamily: 'Inter'
        },
        layout: {
          showImages: true,
          showPrices: true,
          showAmenities: true,
          showReviews: true,
          columns: 1,
          maxRooms: 10
        },
        behavior: {
          autoSearch: false,
          showAvailabilityCalendar: true,
          enableGuestSelection: true,
          minStayNights: 1,
          maxStayNights: 30,
          advanceBookingDays: 365
        }
      },
      domains: [{ domain: '', isActive: true, sslEnabled: true }],
      languages: [{ code: 'en', name: 'English', isDefault: true }]
    });
  };

  const openEditModal = (widget: BookingWidget) => {
    setSelectedWidget(widget);
    setFormData({
      name: widget.name,
      type: widget.type,
      config: widget.config,
      domains: [{ domain: '', isActive: true, sslEnabled: true }],
      languages: [{ code: 'en', name: 'English', isDefault: true }]
    });
    setIsEditModalOpen(true);
  };

  const getWidgetTypeColor = (type: string) => {
    const colors = {
      inline: 'bg-blue-100 text-blue-800',
      popup: 'bg-green-100 text-green-800',
      sidebar: 'bg-purple-100 text-purple-800',
      floating: 'bg-orange-100 text-orange-800',
      iframe: 'bg-gray-100 text-gray-800'
    };
    return colors[type as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  const formatWidgetType = (type: string) => {
    return type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Booking Widget Manager</h1>
        <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Create Widget
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create Booking Widget</DialogTitle>
            </DialogHeader>
            <WidgetForm
              formData={formData}
              setFormData={setFormData}
              onSubmit={handleCreateWidget}
              onCancel={() => setIsCreateModalOpen(false)}
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* Widgets Grid */}
      {loading ? (
        <div className="flex justify-center py-8">
          <div className="text-lg">Loading widgets...</div>
        </div>
      ) : (
        <div className="grid gap-6">
          {widgets.map((widget) => (
            <Card key={widget._id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-lg flex items-center space-x-2">
                      <span>{widget.name}</span>
                      <Badge className={getWidgetTypeColor(widget.type)}>
                        {formatWidgetType(widget.type)}
                      </Badge>
                    </CardTitle>
                    <p className="text-sm text-gray-600">Widget ID: {widget.widgetId}</p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Badge variant={widget.isActive ? "default" : "secondary"}>
                      {widget.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleGetWidgetCode(widget.widgetId)}
                    >
                      <Code className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openEditModal(widget)}
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                  <div className="flex items-center">
                    <Eye className="w-4 h-4 text-blue-600 mr-2" />
                    <div>
                      <p className="text-sm text-gray-600">Impressions</p>
                      <p className="font-semibold">{widget.performance.impressions.toLocaleString()}</p>
                    </div>
                  </div>
                  <div className="flex items-center">
                    <MousePointer className="w-4 h-4 text-green-600 mr-2" />
                    <div>
                      <p className="text-sm text-gray-600">Clicks</p>
                      <p className="font-semibold">{widget.performance.clicks.toLocaleString()}</p>
                    </div>
                  </div>
                  <div className="flex items-center">
                    <ShoppingCart className="w-4 h-4 text-purple-600 mr-2" />
                    <div>
                      <p className="text-sm text-gray-600">Conversions</p>
                      <p className="font-semibold">{widget.performance.conversions}</p>
                    </div>
                  </div>
                  <div className="flex items-center">
                    <Settings className="w-4 h-4 text-orange-600 mr-2" />
                    <div>
                      <p className="text-sm text-gray-600">Conversion Rate</p>
                      <p className="font-semibold">{widget.performance.conversionRate.toFixed(2)}%</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <div>
                    <h4 className="font-semibold text-sm">Configuration:</h4>
                    <div className="flex flex-wrap gap-2 mt-1">
                      <Badge variant="outline">
                        {widget.config.layout.columns} column{widget.config.layout.columns !== 1 ? 's' : ''}
                      </Badge>
                      {widget.config.layout.showImages && <Badge variant="outline">Images</Badge>}
                      {widget.config.layout.showPrices && <Badge variant="outline">Prices</Badge>}
                      {widget.config.behavior.autoSearch && <Badge variant="outline">Auto Search</Badge>}
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="font-semibold text-sm">Theme:</h4>
                    <div className="flex items-center space-x-2 mt-1">
                      <div 
                        className="w-4 h-4 rounded"
                        style={{ backgroundColor: widget.config.theme.primaryColor }}
                      ></div>
                      <span className="text-xs text-gray-600">{widget.config.theme.primaryColor}</span>
                      <span className="text-xs text-gray-400">•</span>
                      <span className="text-xs text-gray-600">
                        {widget.config.theme.borderRadius} radius
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          
          {widgets.length === 0 && (
            <Card>
              <CardContent className="text-center py-8">
                <Code className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">No booking widgets found</p>
                <p className="text-sm text-gray-400">Create your first widget to start converting visitors</p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Edit Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Booking Widget</DialogTitle>
          </DialogHeader>
          <WidgetForm
            formData={formData}
            setFormData={setFormData}
            onSubmit={handleUpdateWidget}
            onCancel={() => setIsEditModalOpen(false)}
            isEdit
          />
        </DialogContent>
      </Dialog>

      {/* Widget Code Modal */}
      <Dialog open={isCodeModalOpen} onOpenChange={setIsCodeModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Widget Embed Code</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Copy and paste this code into your website where you want the booking widget to appear:
            </p>
            <div className="relative">
              <Textarea
                value={widgetCode}
                readOnly
                className="min-h-[200px] font-mono text-xs"
              />
              <Button
                size="sm"
                className="absolute top-2 right-2"
                onClick={() => copyToClipboard(widgetCode)}
              >
                Copy Code
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

const WidgetForm: React.FC<{
  formData: Record<string, unknown>;
  setFormData: (data: Record<string, unknown>) => void;
  onSubmit: () => void;
  onCancel: () => void;
  isEdit?: boolean;
}> = ({ formData, setFormData, onSubmit, onCancel, isEdit }) => {
  
  return (
    <Tabs defaultValue="basic" className="w-full">
      <TabsList>
        <TabsTrigger value="basic">Basic Settings</TabsTrigger>
        <TabsTrigger value="theme">Theme & Layout</TabsTrigger>
        <TabsTrigger value="behavior">Behavior</TabsTrigger>
      </TabsList>

      <TabsContent value="basic" className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="name">Widget Name</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Enter widget name"
            />
          </div>

          <div>
            <Label htmlFor="type">Widget Type</Label>
            <Select value={formData.type} onValueChange={(value) => setFormData({ ...formData, type: value })}>
              <SelectTrigger>
                <SelectValue placeholder="Select widget type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="inline">Inline</SelectItem>
                <SelectItem value="popup">Popup</SelectItem>
                <SelectItem value="sidebar">Sidebar</SelectItem>
                <SelectItem value="floating">Floating</SelectItem>
                <SelectItem value="iframe">iFrame</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </TabsContent>

      <TabsContent value="theme" className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="primaryColor">Primary Color</Label>
            <Input
              id="primaryColor"
              type="color"
              value={formData.config.theme.primaryColor}
              onChange={(e) => setFormData({
                ...formData,
                config: {
                  ...formData.config,
                  theme: { ...formData.config.theme, primaryColor: e.target.value }
                }
              })}
            />
          </div>

          <div>
            <Label htmlFor="secondaryColor">Secondary Color</Label>
            <Input
              id="secondaryColor"
              type="color"
              value={formData.config.theme.secondaryColor}
              onChange={(e) => setFormData({
                ...formData,
                config: {
                  ...formData.config,
                  theme: { ...formData.config.theme, secondaryColor: e.target.value }
                }
              })}
            />
          </div>

          <div>
            <Label htmlFor="borderRadius">Border Radius</Label>
            <Input
              id="borderRadius"
              value={formData.config.theme.borderRadius}
              onChange={(e) => setFormData({
                ...formData,
                config: {
                  ...formData.config,
                  theme: { ...formData.config.theme, borderRadius: e.target.value }
                }
              })}
              placeholder="8px"
            />
          </div>

          <div>
            <Label htmlFor="columns">Layout Columns</Label>
            <Select 
              value={formData.config.layout.columns.toString()} 
              onValueChange={(value) => setFormData({
                ...formData,
                config: {
                  ...formData.config,
                  layout: { ...formData.config.layout, columns: parseInt(value) }
                }
              })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1 Column</SelectItem>
                <SelectItem value="2">2 Columns</SelectItem>
                <SelectItem value="3">3 Columns</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={formData.config.layout.showImages}
              onChange={(e) => setFormData({
                ...formData,
                config: {
                  ...formData.config,
                  layout: { ...formData.config.layout, showImages: e.target.checked }
                }
              })}
            />
            <Label>Show Room Images</Label>
          </div>

          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={formData.config.layout.showPrices}
              onChange={(e) => setFormData({
                ...formData,
                config: {
                  ...formData.config,
                  layout: { ...formData.config.layout, showPrices: e.target.checked }
                }
              })}
            />
            <Label>Show Prices</Label>
          </div>

          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={formData.config.layout.showAmenities}
              onChange={(e) => setFormData({
                ...formData,
                config: {
                  ...formData.config,
                  layout: { ...formData.config.layout, showAmenities: e.target.checked }
                }
              })}
            />
            <Label>Show Amenities</Label>
          </div>
        </div>
      </TabsContent>

      <TabsContent value="behavior" className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="minStay">Minimum Stay (nights)</Label>
            <Input
              id="minStay"
              type="number"
              value={formData.config.behavior.minStayNights}
              onChange={(e) => setFormData({
                ...formData,
                config: {
                  ...formData.config,
                  behavior: { ...formData.config.behavior, minStayNights: parseInt(e.target.value) }
                }
              })}
            />
          </div>

          <div>
            <Label htmlFor="maxStay">Maximum Stay (nights)</Label>
            <Input
              id="maxStay"
              type="number"
              value={formData.config.behavior.maxStayNights}
              onChange={(e) => setFormData({
                ...formData,
                config: {
                  ...formData.config,
                  behavior: { ...formData.config.behavior, maxStayNights: parseInt(e.target.value) }
                }
              })}
            />
          </div>

          <div>
            <Label htmlFor="maxRooms">Maximum Rooms to Display</Label>
            <Input
              id="maxRooms"
              type="number"
              value={formData.config.layout.maxRooms}
              onChange={(e) => setFormData({
                ...formData,
                config: {
                  ...formData.config,
                  layout: { ...formData.config.layout, maxRooms: parseInt(e.target.value) }
                }
              })}
            />
          </div>

          <div>
            <Label htmlFor="advanceBooking">Advance Booking (days)</Label>
            <Input
              id="advanceBooking"
              type="number"
              value={formData.config.behavior.advanceBookingDays}
              onChange={(e) => setFormData({
                ...formData,
                config: {
                  ...formData.config,
                  behavior: { ...formData.config.behavior, advanceBookingDays: parseInt(e.target.value) }
                }
              })}
            />
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={formData.config.behavior.autoSearch}
              onChange={(e) => setFormData({
                ...formData,
                config: {
                  ...formData.config,
                  behavior: { ...formData.config.behavior, autoSearch: e.target.checked }
                }
              })}
            />
            <Label>Enable Auto Search</Label>
          </div>

          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={formData.config.behavior.showAvailabilityCalendar}
              onChange={(e) => setFormData({
                ...formData,
                config: {
                  ...formData.config,
                  behavior: { ...formData.config.behavior, showAvailabilityCalendar: e.target.checked }
                }
              })}
            />
            <Label>Show Availability Calendar</Label>
          </div>

          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={formData.config.behavior.enableGuestSelection}
              onChange={(e) => setFormData({
                ...formData,
                config: {
                  ...formData.config,
                  behavior: { ...formData.config.behavior, enableGuestSelection: e.target.checked }
                }
              })}
            />
            <Label>Enable Guest Selection</Label>
          </div>
        </div>
      </TabsContent>

      <div className="flex justify-end space-x-2 mt-6">
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={onSubmit}>
          {isEdit ? 'Update' : 'Create'} Widget
        </Button>
      </div>
    </Tabs>
  );
};

export default BookingWidgetManager;