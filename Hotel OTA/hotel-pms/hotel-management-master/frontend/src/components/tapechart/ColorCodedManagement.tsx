import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from '@/utils/toast';
import { withErrorBoundary } from '../ErrorBoundary';
import {
  Palette, Eye, Settings, Star, AlertTriangle,
  Users, Building, CreditCard, Calendar,
  Clock, Phone, Mail, MapPin, Plus,
  Edit, Trash2, RefreshCw, Download,
  CheckCircle, XCircle, Timer
} from 'lucide-react';

// Color Management Types
interface ColorScheme {
  id: string;
  name: string;
  description: string;
  isActive: boolean;
  colors: {
    [key: string]: string;
  };
  priority: number;
  category: 'status' | 'booking_type' | 'guest_tier' | 'payment' | 'priority' | 'custom';
}

interface BookingColorRule {
  id: string;
  name: string;
  condition: {
    field: string;
    operator: 'equals' | 'contains' | 'greater_than' | 'less_than' | 'in' | 'not_in';
    value: unknown;
  };
  color: string;
  backgroundColor: string;
  borderColor: string;
  priority: number;
  enabled: boolean;
  description: string;
}

interface CustomField {
  id: string;
  name: string;
  type: 'text' | 'number' | 'date' | 'select' | 'boolean';
  options?: string[];
  displayOnTapeChart: boolean;
  colorRule?: {
    enabled: boolean;
    colorMap: { [key: string]: string };
  };
}

interface VisualIndicator {
  id: string;
  name: string;
  icon: string;
  color: string;
  condition: string;
  position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center';
  size: 'small' | 'medium' | 'large';
  enabled: boolean;
}

interface ColorTheme {
  id: string;
  name: string;
  description: string;
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    success: string;
    warning: string;
    error: string;
    background: string;
    surface: string;
  };
  isDefault: boolean;
}

export const ColorCodedManagement: React.FC = () => {
  const [colorSchemes, setColorSchemes] = useState<ColorScheme[]>([]);
  const [bookingColorRules, setBookingColorRules] = useState<BookingColorRule[]>([]);
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [visualIndicators, setVisualIndicators] = useState<VisualIndicator[]>([]);
  const [colorThemes, setColorThemes] = useState<ColorTheme[]>([]);
  const [selectedTheme, setSelectedTheme] = useState('default');
  const [previewMode, setPreviewMode] = useState(false);

  useEffect(() => {
    loadColorManagementData();
  }, []);

  // Persist color settings to localStorage when they change
  useEffect(() => {
    if (colorSchemes.length > 0) {
      try {
        localStorage.setItem('tapechart-color-config', JSON.stringify({
          colorSchemes, bookingColorRules, customFields, visualIndicators, selectedTheme
        }));
      } catch { /* localStorage full — ignore */ }
    }
  }, [colorSchemes, bookingColorRules, customFields, visualIndicators, selectedTheme]);

  const loadColorManagementData = () => {
    // Try to load saved preferences from localStorage
    try {
      const saved = localStorage.getItem('tapechart-color-config');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.colorSchemes?.length) setColorSchemes(parsed.colorSchemes);
        if (parsed.bookingColorRules?.length) setBookingColorRules(parsed.bookingColorRules);
        if (parsed.customFields?.length) setCustomFields(parsed.customFields);
        if (parsed.visualIndicators?.length) setVisualIndicators(parsed.visualIndicators);
        if (parsed.selectedTheme) setSelectedTheme(parsed.selectedTheme);
        return; // Use saved data
      }
    } catch { /* Parse error — fall through to defaults */ }

    // Load default color schemes
    const defaultColorSchemes: ColorScheme[] = [
      {
        id: 'booking-status',
        name: 'Booking Status Colors',
        description: 'Colors based on booking confirmation status',
        isActive: true,
        colors: {
          confirmed: '#22C55E', // Green
          tentative: '#F59E0B', // Amber
          cancelled: '#EF4444', // Red
          no_show: '#8B5CF6', // Violet
          checked_in: '#3B82F6', // Blue
          checked_out: '#6B7280' // Gray
        },
        priority: 1,
        category: 'status'
      },
      {
        id: 'guest-tier',
        name: 'Guest Tier Colors',
        description: 'Colors based on guest VIP status and loyalty tier',
        isActive: true,
        colors: {
          diamond: '#8B5CF6', // Purple
          platinum: '#6B7280', // Gray
          gold: '#F59E0B', // Gold
          silver: '#9CA3AF', // Light Gray
          regular: '#3B82F6' // Blue
        },
        priority: 2,
        category: 'guest_tier'
      },
      {
        id: 'booking-type',
        name: 'Booking Type Colors',
        description: 'Colors to identify different booking types at a glance',
        isActive: true,
        colors: {
          individual: '#3B82F6', // Blue
          group: '#10B981', // Emerald
          corporate: '#8B5CF6', // Purple
          travel_agent: '#F59E0B', // Amber
          online: '#EC4899', // Pink
          phone: '#14B8A6' // Teal
        },
        priority: 3,
        category: 'booking_type'
      },
      {
        id: 'payment-status',
        name: 'Payment Status Colors',
        description: 'Visual indicators for payment and billing status',
        isActive: true,
        colors: {
          paid: '#22C55E', // Green
          partial: '#F59E0B', // Amber
          pending: '#3B82F6', // Blue
          overdue: '#EF4444', // Red
          refunded: '#6B7280' // Gray
        },
        priority: 4,
        category: 'payment'
      }
    ];

    // Load booking color rules
    const defaultBookingRules: BookingColorRule[] = [
      {
        id: 'rule-vip-guests',
        name: 'VIP Guests',
        condition: {
          field: 'guestTier',
          operator: 'in',
          value: ['diamond', 'platinum']
        },
        color: '#FFFFFF',
        backgroundColor: '#8B5CF6',
        borderColor: '#7C3AED',
        priority: 10,
        enabled: true,
        description: 'Highlight VIP guests with purple background'
      },
      {
        id: 'rule-late-checkin',
        name: 'Late Check-in',
        condition: {
          field: 'checkInTime',
          operator: 'greater_than',
          value: '15:00'
        },
        color: '#FFFFFF',
        backgroundColor: '#F59E0B',
        borderColor: '#D97706',
        priority: 8,
        enabled: true,
        description: 'Amber color for late check-ins after 3 PM'
      },
      {
        id: 'rule-special-requests',
        name: 'Special Requests',
        condition: {
          field: 'specialRequests',
          operator: 'not_in',
          value: ['', null]
        },
        color: '#1F2937',
        backgroundColor: '#FEF3C7',
        borderColor: '#F59E0B',
        priority: 6,
        enabled: true,
        description: 'Light yellow for bookings with special requests'
      },
      {
        id: 'rule-group-bookings',
        name: 'Group Bookings',
        condition: {
          field: 'bookingType',
          operator: 'equals',
          value: 'group'
        },
        color: '#FFFFFF',
        backgroundColor: '#10B981',
        borderColor: '#059669',
        priority: 7,
        enabled: true,
        description: 'Green background for group bookings'
      },
      {
        id: 'rule-overdue-payment',
        name: 'Overdue Payment',
        condition: {
          field: 'paymentStatus',
          operator: 'equals',
          value: 'overdue'
        },
        color: '#FFFFFF',
        backgroundColor: '#EF4444',
        borderColor: '#DC2626',
        priority: 9,
        enabled: true,
        description: 'Red background for overdue payments'
      }
    ];

    // Load custom fields
    const defaultCustomFields: CustomField[] = [
      {
        id: 'field-arrival-transport',
        name: 'Arrival Transport',
        type: 'select',
        options: ['Flight', 'Train', 'Car', 'Bus', 'Other'],
        displayOnTapeChart: true,
        colorRule: {
          enabled: true,
          colorMap: {
            'Flight': '#3B82F6',
            'Train': '#059669',
            'Car': '#8B5CF6',
            'Bus': '#F59E0B',
            'Other': '#6B7280'
          }
        }
      },
      {
        id: 'field-package-type',
        name: 'Package Type',
        type: 'select',
        options: ['Room Only', 'Breakfast', 'Half Board', 'Full Board', 'All Inclusive'],
        displayOnTapeChart: true,
        colorRule: {
          enabled: true,
          colorMap: {
            'All Inclusive': '#22C55E',
            'Full Board': '#10B981',
            'Half Board': '#F59E0B',
            'Breakfast': '#3B82F6',
            'Room Only': '#6B7280'
          }
        }
      },
      {
        id: 'field-guest-notes',
        name: 'Guest Notes',
        type: 'text',
        displayOnTapeChart: false
      }
    ];

    // Load visual indicators
    const defaultIndicators: VisualIndicator[] = [
      {
        id: 'indicator-birthday',
        name: 'Birthday Guest',
        icon: '🎂',
        color: '#EC4899',
        condition: 'isBirthday',
        position: 'top-right',
        size: 'small',
        enabled: true
      },
      {
        id: 'indicator-anniversary',
        name: 'Anniversary',
        icon: '💕',
        color: '#EF4444',
        condition: 'isAnniversary',
        position: 'top-right',
        size: 'small',
        enabled: true
      },
      {
        id: 'indicator-repeat-guest',
        name: 'Repeat Guest',
        icon: '⭐',
        color: '#F59E0B',
        condition: 'isRepeatGuest',
        position: 'top-left',
        size: 'small',
        enabled: true
      },
      {
        id: 'indicator-complimentary',
        name: 'Complimentary Stay',
        icon: '🎁',
        color: '#8B5CF6',
        condition: 'isComplimentary',
        position: 'bottom-left',
        size: 'small',
        enabled: true
      },
      {
        id: 'indicator-extended-stay',
        name: 'Extended Stay',
        icon: '📅',
        color: '#059669',
        condition: 'isExtendedStay',
        position: 'bottom-right',
        size: 'small',
        enabled: true
      }
    ];

    // Load color themes
    const defaultThemes: ColorTheme[] = [
      {
        id: 'default',
        name: 'Hotel Classic',
        description: 'Professional hotel management colors',
        colors: {
          primary: '#3B82F6',
          secondary: '#6B7280',
          accent: '#8B5CF6',
          success: '#22C55E',
          warning: '#F59E0B',
          error: '#EF4444',
          background: '#F9FAFB',
          surface: '#FFFFFF'
        },
        isDefault: true
      },
      {
        id: 'luxury',
        name: 'Luxury Gold',
        description: 'Elegant gold and black theme for luxury properties',
        colors: {
          primary: '#D97706',
          secondary: '#1F2937',
          accent: '#F59E0B',
          success: '#059669',
          warning: '#DC2626',
          error: '#7F1D1D',
          background: '#FFFBEB',
          surface: '#FEF3C7'
        },
        isDefault: false
      },
      {
        id: 'ocean',
        name: 'Ocean Blue',
        description: 'Calming blue theme inspired by ocean resorts',
        colors: {
          primary: '#0891B2',
          secondary: '#155E75',
          accent: '#06B6D4',
          success: '#059669',
          warning: '#D97706',
          error: '#DC2626',
          background: '#F0F9FF',
          surface: '#E0F7FA'
        },
        isDefault: false
      },
      {
        id: 'forest',
        name: 'Forest Green',
        description: 'Natural green theme for eco-friendly properties',
        colors: {
          primary: '#059669',
          secondary: '#064E3B',
          accent: '#10B981',
          success: '#22C55E',
          warning: '#F59E0B',
          error: '#DC2626',
          background: '#F0FDF4',
          surface: '#DCFCE7'
        },
        isDefault: false
      }
    ];

    setColorSchemes(defaultColorSchemes);
    setBookingColorRules(defaultBookingRules);
    setCustomFields(defaultCustomFields);
    setVisualIndicators(defaultIndicators);
    setColorThemes(defaultThemes);
  };

  const toggleColorScheme = (schemeId: string) => {
    setColorSchemes(prev =>
      prev.map(scheme =>
        scheme.id === schemeId ? { ...scheme, isActive: !scheme.isActive } : scheme
      )
    );
    toast.success('Color scheme updated');
  };

  const toggleBookingRule = (ruleId: string) => {
    setBookingColorRules(prev =>
      prev.map(rule =>
        rule.id === ruleId ? { ...rule, enabled: !rule.enabled } : rule
      )
    );
  };

  const toggleVisualIndicator = (indicatorId: string) => {
    setVisualIndicators(prev =>
      prev.map(indicator =>
        indicator.id === indicatorId ? { ...indicator, enabled: !indicator.enabled } : indicator
      )
    );
  };

  const addCustomColorRule = () => {
    const newRule: BookingColorRule = {
      id: `rule-${Date.now()}`,
      name: 'New Color Rule',
      condition: {
        field: 'status',
        operator: 'equals',
        value: 'confirmed'
      },
      color: '#1F2937',
      backgroundColor: '#F3F4F6',
      borderColor: '#D1D5DB',
      priority: 5,
      enabled: true,
      description: 'Custom color rule'
    };

    setBookingColorRules(prev => [...prev, newRule]);
    toast.success('New color rule added');
  };

  const deleteColorRule = (ruleId: string) => {
    setBookingColorRules(prev => prev.filter(rule => rule.id !== ruleId));
    toast.success('Color rule deleted');
  };

  const applyTheme = (themeId: string) => {
    setSelectedTheme(themeId);
    const theme = colorThemes.find(t => t.id === themeId);
    if (theme) {
      // Apply theme colors to CSS variables
      const root = document.documentElement;
      Object.entries(theme.colors).forEach(([key, value]) => {
        root.style.setProperty(`--color-${key}`, value);
      });
      toast.success(`Applied ${theme.name} theme`);
    }
  };

  const exportColorSettings = () => {
    const settings = {
      colorSchemes,
      bookingColorRules,
      customFields,
      visualIndicators,
      selectedTheme
    };

    const blob = new Blob([JSON.stringify(settings, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'color-settings.json';
    a.click();
    URL.revokeObjectURL(url);

    toast.success('Color settings exported');
  };

  const getPreviewStyle = (rule: BookingColorRule | undefined) => {
    if (!rule) {
      return {
        color: '#1F2937',
        backgroundColor: '#F3F4F6',
        borderColor: '#D1D5DB',
        borderWidth: '2px',
        borderStyle: 'solid'
      };
    }

    return {
      color: rule.color,
      backgroundColor: rule.backgroundColor,
      borderColor: rule.borderColor,
      borderWidth: '2px',
      borderStyle: 'solid'
    };
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Palette className="h-4 w-4" />
          Color-Coded Management
          <Badge className="bg-pink-100 text-pink-800">Phase 3</Badge>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-7xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Palette className="h-5 w-5" />
            Color-Coded Visual Management Enhancement
            <Badge className="bg-pink-100 text-pink-800">
              Innovation Leadership
            </Badge>
          </DialogTitle>
          <DialogDescription>
            Advanced color-coding system with custom reservation colors, booking type identification, and visual priority management
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Switch
                checked={previewMode}
                onCheckedChange={setPreviewMode}
                id="preview-mode"
              />
              <Label htmlFor="preview-mode">Preview Mode</Label>
            </div>
            <Select value={selectedTheme} onValueChange={applyTheme}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {colorThemes.map((theme) => (
                  <SelectItem key={theme.id} value={theme.id}>
                    {theme.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button size="sm" variant="outline" onClick={exportColorSettings}>
            <Download className="h-4 w-4 mr-1" />
            Export Settings
          </Button>
        </div>

        <Tabs defaultValue="schemes" className="w-full">
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="schemes">Color Schemes</TabsTrigger>
            <TabsTrigger value="rules">Booking Rules</TabsTrigger>
            <TabsTrigger value="indicators">Visual Indicators</TabsTrigger>
            <TabsTrigger value="fields">Custom Fields</TabsTrigger>
            <TabsTrigger value="themes">Themes</TabsTrigger>
            <TabsTrigger value="preview">Preview</TabsTrigger>
          </TabsList>

          <TabsContent value="schemes" className="space-y-4">
            {/* Color Schemes Management */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {colorSchemes.map((scheme) => (
                <Card key={scheme.id} className={`border ${scheme.isActive ? 'border-blue-300 bg-blue-50' : ''}`}>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      {scheme.name}
                      <div className="flex items-center gap-2">
                        <Badge className={`${scheme.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                          {scheme.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                        <Switch
                          checked={scheme.isActive}
                          onCheckedChange={() => toggleColorScheme(scheme.id)}
                        />
                      </div>
                    </CardTitle>
                    <div className="text-sm text-gray-600">{scheme.description}</div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-sm">
                        <Badge className="bg-blue-100 text-blue-800">
                          {scheme.category.replace('_', ' ').toUpperCase()}
                        </Badge>
                        <span className="text-gray-600">Priority: {scheme.priority}</span>
                      </div>

                      <div className="grid grid-cols-3 gap-2">
                        {Object.entries(scheme.colors).map(([key, color]) => (
                          <div key={key} className="text-center">
                            <div
                              className="w-full h-8 rounded border"
                              style={{ backgroundColor: color }}
                            />
                            <div className="text-xs text-gray-600 mt-1">
                              {key.replace('_', ' ')}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="rules" className="space-y-4">
            {/* Booking Color Rules */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  Booking Color Rules
                  <Button size="sm" variant="outline" onClick={addCustomColorRule}>
                    <Plus className="h-4 w-4 mr-1" />
                    Add Rule
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-96">
                  <div className="space-y-4">
                    {bookingColorRules
                      .sort((a, b) => b.priority - a.priority)
                      .map((rule) => (
                        <Card key={rule.id} className="border">
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between mb-3">
                              <div>
                                <div className="flex items-center gap-2 mb-1">
                                  <div className="font-medium">{rule.name}</div>
                                  <Badge className={rule.enabled ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}>
                                    {rule.enabled ? 'Enabled' : 'Disabled'}
                                  </Badge>
                                  <Badge variant="outline">
                                    Priority: {rule.priority}
                                  </Badge>
                                </div>
                                <div className="text-sm text-gray-600 mb-2">{rule.description}</div>
                              </div>
                              <div className="flex gap-2">
                                <Switch
                                  checked={rule.enabled}
                                  onCheckedChange={() => toggleBookingRule(rule.id)}
                                />
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => deleteColorRule(rule.id)}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4 mb-3">
                              <div>
                                <Label className="text-xs">Condition</Label>
                                <div className="text-sm">
                                  {rule.condition.field} {rule.condition.operator} {
                                    Array.isArray(rule.condition.value)
                                      ? rule.condition.value.join(', ')
                                      : rule.condition.value
                                  }
                                </div>
                              </div>

                              <div>
                                <Label className="text-xs">Preview</Label>
                                <div
                                  className="text-sm p-2 rounded border text-center"
                                  style={getPreviewStyle(rule)}
                                >
                                  Sample Booking
                                </div>
                              </div>
                            </div>

                            <div className="grid grid-cols-3 gap-2 text-xs">
                              <div className="text-center">
                                <div
                                  className="w-full h-6 rounded border"
                                  style={{ backgroundColor: rule.backgroundColor }}
                                />
                                <div className="mt-1">Background</div>
                              </div>

                              <div className="text-center">
                                <div
                                  className="w-full h-6 rounded border"
                                  style={{ backgroundColor: rule.color }}
                                />
                                <div className="mt-1">Text</div>
                              </div>

                              <div className="text-center">
                                <div
                                  className="w-full h-6 rounded"
                                  style={{
                                    backgroundColor: 'transparent',
                                    borderColor: rule.borderColor,
                                    borderWidth: '2px',
                                    borderStyle: 'solid'
                                  }}
                                />
                                <div className="mt-1">Border</div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="indicators" className="space-y-4">
            {/* Visual Indicators */}
            <Card>
              <CardHeader>
                <CardTitle>Visual Indicators</CardTitle>
                <div className="text-sm text-gray-600">
                  Icons and symbols to highlight special conditions and guest preferences
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {visualIndicators.map((indicator) => (
                    <Card key={indicator.id} className="border">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <span className="text-lg">{indicator.icon}</span>
                            <div>
                              <div className="font-medium">{indicator.name}</div>
                              <div className="text-xs text-gray-600">
                                {indicator.position} • {indicator.size}
                              </div>
                            </div>
                          </div>
                          <Switch
                            checked={indicator.enabled}
                            onCheckedChange={() => toggleVisualIndicator(indicator.id)}
                          />
                        </div>

                        <div className="space-y-2">
                          <div>
                            <Label className="text-xs">Condition</Label>
                            <div className="text-sm">{indicator.condition}</div>
                          </div>

                          <div>
                            <Label className="text-xs">Color</Label>
                            <div className="flex items-center gap-2">
                              <div
                                className="w-4 h-4 rounded border"
                                style={{ backgroundColor: indicator.color }}
                              />
                              <span className="text-sm">{indicator.color}</span>
                            </div>
                          </div>

                          <div className="mt-3 p-2 bg-gray-50 rounded text-center">
                            <div className="text-lg">{indicator.icon}</div>
                            <div className="text-xs text-gray-600">Preview</div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="fields" className="space-y-4">
            {/* Custom Fields */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  Custom Fields Display
                  <Button size="sm" variant="outline">
                    <Plus className="h-4 w-4 mr-1" />
                    Add Field
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {customFields.map((field) => (
                    <Card key={field.id} className="border">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <div className="font-medium">{field.name}</div>
                            <div className="text-sm text-gray-600">
                              Type: {field.type} • Display on Tape Chart: {field.displayOnTapeChart ? 'Yes' : 'No'}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={field.displayOnTapeChart}
                              onCheckedChange={() => {
                                setCustomFields(prev =>
                                  prev.map(f =>
                                    f.id === field.id ? { ...f, displayOnTapeChart: !f.displayOnTapeChart } : f
                                  )
                                );
                              }}
                            />
                          </div>
                        </div>

                        {field.type === 'select' && field.options && (
                          <div className="mb-3">
                            <Label className="text-xs">Options</Label>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {field.options.map((option) => (
                                <Badge key={option} variant="outline" className="text-xs">
                                  {option}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}

                        {field.colorRule?.enabled && field.colorRule.colorMap && (
                          <div>
                            <Label className="text-xs">Color Mapping</Label>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-1">
                              {Object.entries(field.colorRule.colorMap).map(([option, color]) => (
                                <div key={option} className="flex items-center gap-2 text-sm">
                                  <div
                                    className="w-4 h-4 rounded border"
                                    style={{ backgroundColor: color }}
                                  />
                                  <span>{option}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="themes" className="space-y-4">
            {/* Color Themes */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {colorThemes.map((theme) => (
                <Card
                  key={theme.id}
                  className={`border cursor-pointer transition-shadow hover:shadow-md ${
                    selectedTheme === theme.id ? 'border-blue-300 bg-blue-50' : ''
                  }`}
                  onClick={() => applyTheme(theme.id)}
                >
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      {theme.name}
                      <div className="flex items-center gap-2">
                        {theme.isDefault && (
                          <Badge className="bg-blue-100 text-blue-800">Default</Badge>
                        )}
                        {selectedTheme === theme.id && (
                          <CheckCircle className="h-4 w-4 text-green-600" />
                        )}
                      </div>
                    </CardTitle>
                    <div className="text-sm text-gray-600">{theme.description}</div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-4 gap-2">
                      {Object.entries(theme.colors).map(([key, color]) => (
                        <div key={key} className="text-center">
                          <div
                            className="w-full h-8 rounded border"
                            style={{ backgroundColor: color }}
                          />
                          <div className="text-xs text-gray-600 mt-1 capitalize">
                            {key}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="preview" className="space-y-4">
            {/* Preview Section */}
            <Card>
              <CardHeader>
                <CardTitle>Live Preview</CardTitle>
                <div className="text-sm text-gray-600">
                  See how your color settings will appear in the tape chart
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* Sample Tape Chart Preview */}
                  <div className="border rounded-lg p-4 bg-gray-50">
                    <div className="text-sm font-medium mb-3">Sample Tape Chart View</div>

                    <div className="grid grid-cols-7 gap-2">
                      {/* Sample bookings with different color rules applied */}
                      <div
                        className="p-2 rounded border text-center text-xs"
                        style={getPreviewStyle(bookingColorRules.find(r => r.id === 'rule-vip-guests') || bookingColorRules[0])}
                      >
                        <div className="font-medium">Mr. Smith</div>
                        <div>Room 301</div>
                        <div className="text-lg">⭐</div>
                      </div>

                      <div
                        className="p-2 rounded border text-center text-xs"
                        style={getPreviewStyle(bookingColorRules.find(r => r.id === 'rule-group-bookings') || bookingColorRules[0])}
                      >
                        <div className="font-medium">ABC Corp</div>
                        <div>Room 302</div>
                        <div className="text-lg">👥</div>
                      </div>

                      <div
                        className="p-2 rounded border text-center text-xs"
                        style={getPreviewStyle(bookingColorRules.find(r => r.id === 'rule-special-requests') || bookingColorRules[0])}
                      >
                        <div className="font-medium">Ms. Johnson</div>
                        <div>Room 303</div>
                        <div className="text-lg">🎂</div>
                      </div>

                      <div
                        className="p-2 rounded border text-center text-xs"
                        style={getPreviewStyle(bookingColorRules.find(r => r.id === 'rule-late-checkin') || bookingColorRules[0])}
                      >
                        <div className="font-medium">Dr. Brown</div>
                        <div>Room 304</div>
                        <div className="text-lg">⏰</div>
                      </div>

                      <div
                        className="p-2 rounded border text-center text-xs"
                        style={getPreviewStyle(bookingColorRules.find(r => r.id === 'rule-overdue-payment') || bookingColorRules[0])}
                      >
                        <div className="font-medium">Mr. Wilson</div>
                        <div>Room 305</div>
                        <div className="text-lg">💳</div>
                      </div>

                      <div className="p-2 rounded border text-center text-xs bg-white border-gray-300">
                        <div className="font-medium">Available</div>
                        <div>Room 306</div>
                      </div>

                      <div className="p-2 rounded border text-center text-xs bg-gray-200 border-gray-400">
                        <div className="font-medium">Maintenance</div>
                        <div>Room 307</div>
                        <div className="text-lg">🔧</div>
                      </div>
                    </div>
                  </div>

                  {/* Legend */}
                  <div className="border rounded-lg p-4">
                    <div className="text-sm font-medium mb-3">Color Legend</div>

                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {bookingColorRules
                        .filter(rule => rule.enabled)
                        .map((rule) => (
                          <div key={rule.id} className="flex items-center gap-2 text-sm">
                            <div
                              className="w-4 h-4 rounded border"
                              style={{ backgroundColor: rule.backgroundColor }}
                            />
                            <span>{rule.name}</span>
                          </div>
                        ))}
                    </div>
                  </div>

                  {/* Visual Indicators Legend */}
                  <div className="border rounded-lg p-4">
                    <div className="text-sm font-medium mb-3">Visual Indicators</div>

                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {visualIndicators
                        .filter(indicator => indicator.enabled)
                        .map((indicator) => (
                          <div key={indicator.id} className="flex items-center gap-2 text-sm">
                            <span className="text-lg">{indicator.icon}</span>
                            <span>{indicator.name}</span>
                          </div>
                        ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default withErrorBoundary(ColorCodedManagement, { level: 'component' });