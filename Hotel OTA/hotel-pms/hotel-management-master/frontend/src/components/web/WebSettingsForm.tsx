import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { 
  Save, 
  TestTube, 
  Plus, 
  Trash2, 
  Info, 
  CheckCircle, 
  AlertTriangle,
  Globe,
  Mail,
  Phone,
  MapPin,
  Clock,
  CreditCard,
  Search,
  Palette,
  Shield,
  Settings
} from 'lucide-react';
import { WebSettings } from '@/services/webSettingsService';
import { withErrorBoundary } from '../ErrorBoundary';

interface WebSettingsFormProps {
  settings: WebSettings;
  section: 'general' | 'booking' | 'payment' | 'seo' | 'integrations' | 'theme' | 'advanced' | 'maintenance';
  onSave: (data: Record<string, unknown>) => void;
  onTest?: (type: string, config: Record<string, unknown>) => void;
  testResults?: Record<string, unknown>;
  onChange?: () => void;
}

function WebSettingsForm({ 
  settings, 
  section, 
  onSave, 
  onTest, 
  testResults, 
  onChange 
}: WebSettingsFormProps) {
  const [formData, setFormData] = useState<unknown>({});
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    setFormData(settings[section] || {});
    setHasChanges(false);
  }, [settings, section]);

  const handleChange = (field: string, value: unknown) => {
    const updatedData = { ...formData };
    
    // Handle nested field updates
    if (field.includes('.')) {
      const fields = field.split('.');
      let current = updatedData;
      
      for (let i = 0; i < fields.length - 1; i++) {
        if (!current[fields[i]]) {
          current[fields[i]] = {};
        }
        current = current[fields[i]];
      }
      
      current[fields[fields.length - 1]] = value;
    } else {
      updatedData[field] = value;
    }

    setFormData(updatedData);
    setHasChanges(true);
    onChange?.();
  };

  const handleSave = () => {
    onSave(formData);
    setHasChanges(false);
  };

  const renderGeneralSettings = () => (
    <div className="space-y-4 sm:space-y-6">
      {/* Hotel Information */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center text-sm sm:text-base">
            <Globe className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
            Hotel Information
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0 space-y-3 sm:space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div>
              <Label htmlFor="hotelName" className="text-xs sm:text-sm">Hotel Name *</Label>
              <Input
                id="hotelName"
                value={formData.hotelName || ''}
                onChange={(e) => handleChange('hotelName', e.target.value)}
                placeholder="Enter hotel name"
                required
                className="text-sm"
              />
            </div>
            
            <div>
              <Label htmlFor="timezone" className="text-xs sm:text-sm">Timezone</Label>
              <Select value={formData.timezone || 'UTC'} onValueChange={(value) => handleChange('timezone', value)}>
                <SelectTrigger className="text-sm">
                  <SelectValue placeholder="Select timezone" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="UTC">UTC</SelectItem>
                  <SelectItem value="America/New_York">Eastern Time</SelectItem>
                  <SelectItem value="America/Chicago">Central Time</SelectItem>
                  <SelectItem value="America/Denver">Mountain Time</SelectItem>
                  <SelectItem value="America/Los_Angeles">Pacific Time</SelectItem>
                  <SelectItem value="Europe/London">London</SelectItem>
                  <SelectItem value="Europe/Paris">Paris</SelectItem>
                  <SelectItem value="Asia/Tokyo">Tokyo</SelectItem>
                  <SelectItem value="Asia/Shanghai">Shanghai</SelectItem>
                  <SelectItem value="Asia/Kolkata">Mumbai</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label htmlFor="description" className="text-xs sm:text-sm">Description</Label>
            <Textarea
              id="description"
              value={formData.description || ''}
              onChange={(e) => handleChange('description', e.target.value)}
              placeholder="Brief description of your hotel"
              rows={3}
              maxLength={1000}
              className="text-sm"
            />
          </div>
        </CardContent>
      </Card>

      {/* Address */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center text-sm sm:text-base">
            <MapPin className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
            Hotel Address
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0 space-y-3 sm:space-y-4">
          <div>
            <Label className="text-xs sm:text-sm">Street Address</Label>
            <Input
              value={formData.address?.street || ''}
              onChange={(e) => handleChange('address.street', e.target.value)}
              placeholder="123 Main Street"
              className="text-sm"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <div>
              <Label className="text-xs sm:text-sm">City</Label>
              <Input
                value={formData.address?.city || ''}
                onChange={(e) => handleChange('address.city', e.target.value)}
                placeholder="City"
                className="text-sm"
              />
            </div>
            <div>
              <Label className="text-xs sm:text-sm">State</Label>
              <Input
                value={formData.address?.state || ''}
                onChange={(e) => handleChange('address.state', e.target.value)}
                placeholder="State"
                className="text-sm"
              />
            </div>
            <div>
              <Label className="text-xs sm:text-sm">Country</Label>
              <Input
                value={formData.address?.country || ''}
                onChange={(e) => handleChange('address.country', e.target.value)}
                placeholder="Country"
                className="text-sm"
              />
            </div>
            <div>
              <Label className="text-xs sm:text-sm">Postal Code</Label>
              <Input
                value={formData.address?.postalCode || ''}
                onChange={(e) => handleChange('address.postalCode', e.target.value)}
                placeholder="12345"
                className="text-sm"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Contact Information */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center text-sm sm:text-base">
            <Phone className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
            Contact Information
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0 space-y-3 sm:space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div>
              <Label htmlFor="email" className="text-xs sm:text-sm">Email Address</Label>
              <Input
                id="email"
                type="email"
                required
                value={formData.contact?.email || ''}
                onChange={(e) => handleChange('contact.email', e.target.value)}
                placeholder="hotel@example.com"
                className="text-sm"
              />
            </div>
            
            <div>
              <Label htmlFor="phone" className="text-xs sm:text-sm">Phone Number</Label>
              <Input
                id="phone"
                type="tel"
                value={formData.contact?.phone || ''}
                onChange={(e) => handleChange('contact.phone', e.target.value)}
                placeholder="+1 (555) 123-4567"
                className="text-sm"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="website" className="text-xs sm:text-sm">Website</Label>
            <Input
              id="website"
              type="url"
              value={formData.contact?.website || ''}
              onChange={(e) => handleChange('contact.website', e.target.value)}
              placeholder="https://www.yourhotel.com"
              className="text-sm"
            />
          </div>
        </CardContent>
      </Card>

      {/* Currency Settings */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center text-sm sm:text-base">
            <CreditCard className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
            Currency Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0 space-y-3 sm:space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            <div>
              <Label htmlFor="currencyCode" className="text-xs sm:text-sm">Currency Code</Label>
              <Select 
                value={formData.currency?.code || 'USD'} 
                onValueChange={(value) => handleChange('currency.code', value)}
              >
                <SelectTrigger className="text-sm">
                  <SelectValue placeholder="Select currency" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="USD">USD - US Dollar</SelectItem>
                  <SelectItem value="EUR">EUR - Euro</SelectItem>
                  <SelectItem value="GBP">GBP - British Pound</SelectItem>
                  <SelectItem value="JPY">JPY - Japanese Yen</SelectItem>
                  <SelectItem value="AUD">AUD - Australian Dollar</SelectItem>
                  <SelectItem value="CAD">CAD - Canadian Dollar</SelectItem>
                  <SelectItem value="CHF">CHF - Swiss Franc</SelectItem>
                  <SelectItem value="INR">INR - Indian Rupee</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label htmlFor="currencySymbol" className="text-xs sm:text-sm">Currency Symbol</Label>
              <Input
                id="currencySymbol"
                value={formData.currency?.symbol || '$'}
                onChange={(e) => handleChange('currency.symbol', e.target.value)}
                placeholder="$"
                maxLength={3}
                className="text-sm"
              />
            </div>
            
            <div>
              <Label htmlFor="currencyPosition" className="text-xs sm:text-sm">Symbol Position</Label>
              <Select 
                value={formData.currency?.position || 'before'} 
                onValueChange={(value) => handleChange('currency.position', value)}
              >
                <SelectTrigger className="text-sm">
                  <SelectValue placeholder="Select position" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="before">Before ($100)</SelectItem>
                  <SelectItem value="after">After (100$)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderBookingSettings = () => (
    <div className="space-y-4 sm:space-y-6">
      {/* Stay Restrictions */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center text-sm sm:text-base">
            <Clock className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
            Stay Restrictions
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0 space-y-3 sm:space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            <div>
              <Label htmlFor="minimumStay" className="text-xs sm:text-sm">Minimum Stay (nights)</Label>
              <Input
                id="minimumStay"
                type="number"
                min="1"
                max="365"
                value={formData.minimumStay || 1}
                onChange={(e) => handleChange('minimumStay', parseInt(e.target.value))}
                className="text-sm"
              />
            </div>
            
            <div>
              <Label htmlFor="maximumStay" className="text-xs sm:text-sm">Maximum Stay (nights)</Label>
              <Input
                id="maximumStay"
                type="number"
                min="1"
                max="365"
                value={formData.maximumStay || 30}
                onChange={(e) => handleChange('maximumStay', parseInt(e.target.value))}
                className="text-sm"
              />
            </div>
            
            <div>
              <Label htmlFor="advanceBookingLimit" className="text-xs sm:text-sm">Advance Booking Limit (days)</Label>
              <Input
                id="advanceBookingLimit"
                type="number"
                min="1"
                max="1095"
                value={formData.advanceBookingLimit || 365}
                onChange={(e) => handleChange('advanceBookingLimit', parseInt(e.target.value))}
                className="text-sm"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Check-in/out Times */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm sm:text-base">Check-in/out Times</CardTitle>
        </CardHeader>
        <CardContent className="pt-0 space-y-3 sm:space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div>
              <Label htmlFor="checkInTime" className="text-xs sm:text-sm">Check-in Time</Label>
              <Input
                id="checkInTime"
                type="time"
                value={formData.checkInTime || '15:00'}
                onChange={(e) => handleChange('checkInTime', e.target.value)}
                className="text-sm"
              />
            </div>
            
            <div>
              <Label htmlFor="checkOutTime" className="text-xs sm:text-sm">Check-out Time</Label>
              <Input
                id="checkOutTime"
                type="time"
                value={formData.checkOutTime || '11:00'}
                onChange={(e) => handleChange('checkOutTime', e.target.value)}
                className="text-sm"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Booking Options */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm sm:text-base">Booking Options</CardTitle>
        </CardHeader>
        <CardContent className="pt-0 space-y-3 sm:space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex-1">
              <Label className="text-xs sm:text-sm">Instant Confirmation</Label>
              <p className="text-xs sm:text-sm text-gray-600">Automatically confirm bookings without manual approval</p>
            </div>
            <Switch
              checked={formData.instantConfirmation !== false}
              onCheckedChange={(checked) => handleChange('instantConfirmation', checked)}
            />
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex-1">
              <Label className="text-xs sm:text-sm">Requires Approval</Label>
              <p className="text-xs sm:text-sm text-gray-600">All bookings require manual approval</p>
            </div>
            <Switch
              checked={formData.requiresApproval || false}
              onCheckedChange={(checked) => handleChange('requiresApproval', checked)}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderPaymentSettings = () => (
    <div className="space-y-4 sm:space-y-6">
      {/* Payment Gateways */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <span className="flex items-center text-sm sm:text-base">
              <CreditCard className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
              Payment Gateways
            </span>
            <Button 
              size="sm" 
              variant="outline" 
              onClick={() => handleChange('gateways', [...(formData.gateways || []), { name: 'stripe', isActive: false, configuration: {}, fees: { percentage: 0, fixed: 0 } }])}
              className="w-full sm:w-auto text-xs sm:text-sm"
            >
              <Plus className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
              <span className="hidden sm:inline">Add Gateway</span>
              <span className="sm:hidden">Add</span>
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0 space-y-3 sm:space-y-4">
          {(formData.gateways || []).map((gateway: Record<string, unknown>, index: number) => (
            <div key={`item-${index}`} className="border rounded-lg p-3 sm:p-4 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <Select
                  value={gateway.name}
                  onValueChange={(value) => {
                    const updated = [...formData.gateways];
                    updated[index].name = value;
                    handleChange('gateways', updated);
                  }}
                >
                  <SelectTrigger className="w-full sm:w-48 text-sm">
                    <SelectValue placeholder="Select gateway" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="stripe">Stripe</SelectItem>
                    <SelectItem value="paypal">PayPal</SelectItem>
                    <SelectItem value="razorpay">Razorpay</SelectItem>
                    <SelectItem value="square">Square</SelectItem>
                    <SelectItem value="authorize_net">Authorize.Net</SelectItem>
                    <SelectItem value="braintree">Braintree</SelectItem>
                  </SelectContent>
                </Select>

                <div className="flex items-center justify-between sm:justify-end space-x-2">
                  <div className="flex items-center space-x-2">
                    <span className="text-xs sm:text-sm text-gray-600">Active</span>
                    <Switch
                      checked={gateway.isActive}
                      onCheckedChange={(checked) => {
                        const updated = [...formData.gateways];
                        updated[index].isActive = checked;
                        handleChange('gateways', updated);
                      }}
                    />
                  </div>
                  <div className="flex items-center space-x-1">
                    {onTest && (
                      <Button size="sm" variant="outline" onClick={() => onTest('payment_gateway', gateway)} className="p-2">
                        <TestTube className="w-3 h-3 sm:w-4 sm:h-4" />
                      </Button>
                    )}
                    <Button 
                      size="sm" 
                      variant="destructive"
                      onClick={() => {
                        const updated = formData.gateways.filter((_: unknown, i: number) => i !== index);
                        handleChange('gateways', updated);
                      }}
                      className="p-2"
                    >
                      <Trash2 className="w-3 h-3 sm:w-4 sm:h-4" />
                    </Button>
                  </div>
                </div>
              </div>

              {/* API Configuration */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs sm:text-sm">API Key / Public Key</Label>
                  <Input
                    type="password"
                    value={gateway.configuration?.apiKey || ''}
                    onChange={(e) => {
                      const updated = [...formData.gateways];
                      updated[index].configuration = { ...updated[index].configuration, apiKey: e.target.value };
                      handleChange('gateways', updated);
                    }}
                    placeholder={`Enter ${gateway.name || 'gateway'} API key`}
                    className="text-sm"
                  />
                </div>
                <div>
                  <Label className="text-xs sm:text-sm">Secret Key</Label>
                  <Input
                    type="password"
                    value={gateway.configuration?.secretKey || ''}
                    onChange={(e) => {
                      const updated = [...formData.gateways];
                      updated[index].configuration = { ...updated[index].configuration, secretKey: e.target.value };
                      handleChange('gateways', updated);
                    }}
                    placeholder={`Enter ${gateway.name || 'gateway'} secret key`}
                    className="text-sm"
                  />
                </div>
              </div>

              {/* Fees */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs sm:text-sm">Fee Percentage (%)</Label>
                  <Input
                    type="number"
                    min="0"
                    max="10"
                    step="0.1"
                    value={gateway.fees?.percentage || 0}
                    onChange={(e) => {
                      const updated = [...formData.gateways];
                      updated[index].fees = { ...updated[index].fees, percentage: parseFloat(e.target.value) };
                      handleChange('gateways', updated);
                    }}
                    className="text-sm"
                  />
                </div>
                
                <div>
                  <Label className="text-xs sm:text-sm">Fixed Fee ({formData.currency?.symbol || '₹'})</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={gateway.fees?.fixed || 0}
                    onChange={(e) => {
                      const updated = [...formData.gateways];
                      updated[index].fees = { ...updated[index].fees, fixed: parseFloat(e.target.value) };
                      handleChange('gateways', updated);
                    }}
                    className="text-sm"
                  />
                </div>
              </div>

              {testResults?.[`payment_gateway_${index}`] && (
                <Alert className={testResults[`payment_gateway_${index}`].success ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}>
                  <div className="flex items-center">
                    {testResults[`payment_gateway_${index}`].success ? (
                      <CheckCircle className="w-4 h-4 text-green-600 mr-2" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-red-600 mr-2" />
                    )}
                    <AlertDescription>
                      {testResults[`payment_gateway_${index}`].message}
                    </AlertDescription>
                  </div>
                </Alert>
              )}
            </div>
          ))}

          {(!formData.gateways || formData.gateways.length === 0) && (
            <div className="text-center py-6 text-gray-500">
              No payment gateways configured. Add one to start accepting payments.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Deposit Settings */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm sm:text-base">Deposit Settings</CardTitle>
        </CardHeader>
        <CardContent className="pt-0 space-y-3 sm:space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex-1">
              <Label className="text-xs sm:text-sm">Require Deposit</Label>
              <p className="text-xs sm:text-sm text-gray-600">Require guests to pay a deposit when booking</p>
            </div>
            <Switch
              checked={formData.depositRequired || false}
              onCheckedChange={(checked) => handleChange('depositRequired', checked)}
            />
          </div>

          {formData.depositRequired && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div>
                <Label className="text-xs sm:text-sm">Deposit Type</Label>
                <Select
                  value={formData.depositAmount?.type || 'percentage'}
                  onValueChange={(value) => handleChange('depositAmount.type', value)}
                >
                  <SelectTrigger className="text-sm">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">Percentage</SelectItem>
                    <SelectItem value="fixed">Fixed Amount</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label className="text-xs sm:text-sm">
                  Deposit Amount ({formData.depositAmount?.type === 'percentage' ? '%' : formData.currency?.symbol || '₹'})
                </Label>
                <Input
                  type="number"
                  min="0"
                  max={formData.depositAmount?.type === 'percentage' ? '100' : undefined}
                  step={formData.depositAmount?.type === 'percentage' ? '1' : '0.01'}
                  value={formData.depositAmount?.value || 0}
                  onChange={(e) => handleChange('depositAmount.value', parseFloat(e.target.value))}
                  className="text-sm"
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );

  const renderSEOSettings = () => (
    <div className="space-y-4 sm:space-y-6">
      {/* Meta Tags */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center text-sm sm:text-base">
            <Search className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
            Meta Tags
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0 space-y-3 sm:space-y-4">
          <div>
            <Label htmlFor="metaTitle" className="text-xs sm:text-sm">SEO Title</Label>
            <Input
              id="metaTitle"
              value={formData.metaTags?.title || ''}
              onChange={(e) => handleChange('metaTags.title', e.target.value)}
              placeholder="Your Hotel Name - Best Hotel in City"
              maxLength={60}
              className="text-sm"
            />
            <p className="text-xs text-gray-500 mt-1">
              {(formData.metaTags?.title || '').length}/60 characters
            </p>
          </div>

          <div>
            <Label htmlFor="metaDescription" className="text-xs sm:text-sm">SEO Description</Label>
            <Textarea
              id="metaDescription"
              value={formData.metaTags?.description || ''}
              onChange={(e) => handleChange('metaTags.description', e.target.value)}
              placeholder="Book your stay at our luxury hotel. Experience comfort and convenience in the heart of the city."
              maxLength={160}
              rows={3}
              className="text-sm"
            />
            <p className="text-xs text-gray-500 mt-1">
              {(formData.metaTags?.description || '').length}/160 characters
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Robots & Indexing */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm sm:text-base">Search Engine Settings</CardTitle>
        </CardHeader>
        <CardContent className="pt-0 space-y-3 sm:space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex-1">
              <Label className="text-xs sm:text-sm">Allow Search Engine Indexing</Label>
              <p className="text-xs sm:text-sm text-gray-600">Allow search engines to index your website</p>
            </div>
            <Switch
              checked={formData.robots?.index !== false}
              onCheckedChange={(checked) => handleChange('robots.index', checked)}
            />
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex-1">
              <Label className="text-xs sm:text-sm">Follow Links</Label>
              <p className="text-xs sm:text-sm text-gray-600">Allow search engines to follow links on your website</p>
            </div>
            <Switch
              checked={formData.robots?.follow !== false}
              onCheckedChange={(checked) => handleChange('robots.follow', checked)}
            />
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex-1">
              <Label className="text-xs sm:text-sm">Auto-generate Sitemap</Label>
              <p className="text-xs sm:text-sm text-gray-600">Automatically generate and update XML sitemap</p>
            </div>
            <Switch
              checked={formData.sitemap?.autoGenerate !== false}
              onCheckedChange={(checked) => handleChange('sitemap.autoGenerate', checked)}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderIntegrationSettings = () => (
    <div className="space-y-4 sm:space-y-6">
      {/* Google Analytics */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <span className="text-sm sm:text-base">Google Analytics</span>
            <div className="flex items-center space-x-2">
              {onTest && (
                <Button size="sm" variant="outline" onClick={() => onTest('google_analytics', formData.googleAnalytics)} className="p-2">
                  <TestTube className="w-3 h-3 sm:w-4 sm:h-4" />
                </Button>
              )}
              <Switch
                checked={formData.googleAnalytics?.isActive || false}
                onCheckedChange={(checked) => handleChange('googleAnalytics.isActive', checked)}
              />
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0 space-y-3 sm:space-y-4">
          <div>
            <Label htmlFor="trackingId" className="text-xs sm:text-sm">Tracking ID</Label>
            <Input
              id="trackingId"
              value={formData.googleAnalytics?.trackingId || ''}
              onChange={(e) => handleChange('googleAnalytics.trackingId', e.target.value)}
              placeholder="UA-XXXXXXXXX-X or G-XXXXXXXXXX"
              disabled={!formData.googleAnalytics?.isActive}
              className="text-sm"
            />
          </div>
        </CardContent>
      </Card>

      {/* Google Tag Manager */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <span className="text-sm sm:text-base">Google Tag Manager</span>
            <Switch
              checked={formData.googleTagManager?.isActive || false}
              onCheckedChange={(checked) => handleChange('googleTagManager.isActive', checked)}
            />
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0 space-y-3 sm:space-y-4">
          <div>
            <Label htmlFor="gtmContainerId" className="text-xs sm:text-sm">Container ID</Label>
            <Input
              id="gtmContainerId"
              value={formData.googleTagManager?.containerId || ''}
              onChange={(e) => handleChange('googleTagManager.containerId', e.target.value)}
              placeholder="GTM-XXXXXXX"
              disabled={!formData.googleTagManager?.isActive}
              className="text-sm"
            />
          </div>
        </CardContent>
      </Card>

      {/* Facebook Pixel */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <span className="text-sm sm:text-base">Facebook Pixel</span>
            <Switch
              checked={formData.facebookPixel?.isActive || false}
              onCheckedChange={(checked) => handleChange('facebookPixel.isActive', checked)}
            />
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0 space-y-3 sm:space-y-4">
          <div>
            <Label htmlFor="pixelId" className="text-xs sm:text-sm">Pixel ID</Label>
            <Input
              id="pixelId"
              value={formData.facebookPixel?.pixelId || ''}
              onChange={(e) => handleChange('facebookPixel.pixelId', e.target.value)}
              placeholder="123456789012345"
              disabled={!formData.facebookPixel?.isActive}
              className="text-sm"
            />
          </div>
        </CardContent>
      </Card>

      {/* Email Marketing */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <span className="text-sm sm:text-base">Email Marketing</span>
            <Switch
              checked={formData.emailMarketing?.enabled || false}
              onCheckedChange={(checked) => handleChange('emailMarketing.enabled', checked)}
            />
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0 space-y-3 sm:space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs sm:text-sm">Provider</Label>
              <Select
                value={formData.emailMarketing?.provider || 'mailchimp'}
                onValueChange={(value) => handleChange('emailMarketing.provider', value)}
              >
                <SelectTrigger className="text-sm">
                  <SelectValue placeholder="Select provider" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mailchimp">Mailchimp</SelectItem>
                  <SelectItem value="sendgrid">SendGrid</SelectItem>
                  <SelectItem value="mailgun">Mailgun</SelectItem>
                  <SelectItem value="ses">Amazon SES</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs sm:text-sm">API Key</Label>
              <Input
                type="password"
                value={formData.emailMarketing?.apiKey || ''}
                onChange={(e) => handleChange('emailMarketing.apiKey', e.target.value)}
                placeholder="Enter API key"
                disabled={!formData.emailMarketing?.enabled}
                className="text-sm"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Chat Widget */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <span className="text-sm sm:text-base">Chat Widget</span>
            <Switch
              checked={formData.chatWidget?.enabled || false}
              onCheckedChange={(checked) => handleChange('chatWidget.enabled', checked)}
            />
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0 space-y-3 sm:space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs sm:text-sm">Provider</Label>
              <Select
                value={formData.chatWidget?.provider || 'tawk'}
                onValueChange={(value) => handleChange('chatWidget.provider', value)}
              >
                <SelectTrigger className="text-sm">
                  <SelectValue placeholder="Select provider" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="tawk">Tawk.to</SelectItem>
                  <SelectItem value="intercom">Intercom</SelectItem>
                  <SelectItem value="crisp">Crisp</SelectItem>
                  <SelectItem value="zendesk">Zendesk Chat</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs sm:text-sm">Widget ID</Label>
              <Input
                value={formData.chatWidget?.widgetId || ''}
                onChange={(e) => handleChange('chatWidget.widgetId', e.target.value)}
                placeholder="Enter widget ID"
                disabled={!formData.chatWidget?.enabled}
                className="text-sm"
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderThemeSettings = () => (
    <div className="space-y-4 sm:space-y-6">
      {/* Color Scheme */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center text-sm sm:text-base">
            <Palette className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
            Color Scheme
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0 space-y-3 sm:space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {[
              { key: 'primary', label: 'Primary', description: 'Main brand color' },
              { key: 'secondary', label: 'Secondary', description: 'Secondary color' },
              { key: 'accent', label: 'Accent', description: 'Highlight color' },
              { key: 'background', label: 'Background', description: 'Page background' }
            ].map(({ key, label, description }) => (
              <div key={key}>
                <Label className="text-xs sm:text-sm">{label}</Label>
                <p className="text-xs text-gray-500 mb-2">{description}</p>
                <div className="flex items-center space-x-2">
                  <Input
                    type="color"
                    value={formData.colorScheme?.[key] || '#2563eb'}
                    onChange={(e) => handleChange(`colorScheme.${key}`, e.target.value)}
                    className="w-12 h-8 sm:w-16"
                  />
                  <Input
                    type="text"
                    value={formData.colorScheme?.[key] || '#2563eb'}
                    onChange={(e) => handleChange(`colorScheme.${key}`, e.target.value)}
                    className="flex-1 text-sm"
                    placeholder="#2563eb"
                  />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Typography */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm sm:text-base">Typography</CardTitle>
        </CardHeader>
        <CardContent className="pt-0 space-y-3 sm:space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div>
              <Label className="text-xs sm:text-sm">Primary Font</Label>
              <Select
                value={formData.typography?.primaryFont || 'Inter'}
                onValueChange={(value) => handleChange('typography.primaryFont', value)}
              >
                <SelectTrigger className="text-sm">
                  <SelectValue placeholder="Select font" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Inter">Inter</SelectItem>
                  <SelectItem value="Roboto">Roboto</SelectItem>
                  <SelectItem value="Open Sans">Open Sans</SelectItem>
                  <SelectItem value="Lato">Lato</SelectItem>
                  <SelectItem value="Montserrat">Montserrat</SelectItem>
                  <SelectItem value="Poppins">Poppins</SelectItem>
                  <SelectItem value="Nunito">Nunito</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs sm:text-sm">Base Font Size</Label>
              <Select
                value={formData.typography?.fontSize?.base || '16px'}
                onValueChange={(value) => handleChange('typography.fontSize.base', value)}
              >
                <SelectTrigger className="text-sm">
                  <SelectValue placeholder="Select size" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="14px">14px - Small</SelectItem>
                  <SelectItem value="16px">16px - Medium</SelectItem>
                  <SelectItem value="18px">18px - Large</SelectItem>
                  <SelectItem value="20px">20px - Extra Large</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderAdvancedSettings = () => (
    <div className="space-y-4 sm:space-y-6">
      {/* Caching */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center text-sm sm:text-base">
            <Shield className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
            Performance & Security
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0 space-y-3 sm:space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex-1">
              <Label className="text-xs sm:text-sm">Enable Caching</Label>
              <p className="text-xs sm:text-sm text-gray-600">Improve website performance with caching</p>
            </div>
            <Switch
              checked={formData.caching?.enabled !== false}
              onCheckedChange={(checked) => handleChange('caching.enabled', checked)}
            />
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex-1">
              <Label className="text-xs sm:text-sm">Enable Compression</Label>
              <p className="text-xs sm:text-sm text-gray-600">Compress files to reduce load times</p>
            </div>
            <Switch
              checked={formData.compression?.enabled !== false}
              onCheckedChange={(checked) => handleChange('compression.enabled', checked)}
            />
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex-1">
              <Label className="text-xs sm:text-sm">CSRF Protection</Label>
              <p className="text-xs sm:text-sm text-gray-600">Enable cross-site request forgery protection</p>
            </div>
            <Switch
              checked={formData.security?.csrfProtection !== false}
              onCheckedChange={(checked) => handleChange('security.csrfProtection', checked)}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderMaintenanceSettings = () => (
    <div className="space-y-4 sm:space-y-6">
      {/* Maintenance Mode */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center text-sm sm:text-base">
            <Settings className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
            Maintenance Mode
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0 space-y-3 sm:space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex-1">
              <Label className="text-xs sm:text-sm">Enable Maintenance Mode</Label>
              <p className="text-xs sm:text-sm text-gray-600">Show maintenance page to visitors</p>
            </div>
            <Switch
              checked={formData.isMaintenanceMode || false}
              onCheckedChange={(checked) => handleChange('isMaintenanceMode', checked)}
            />
          </div>

          {formData.isMaintenanceMode && (
            <div>
              <Label htmlFor="maintenanceMessage" className="text-xs sm:text-sm">Maintenance Message</Label>
              <Textarea
                id="maintenanceMessage"
                value={formData.maintenanceMessage || 'We are currently performing maintenance. Please check back soon.'}
                onChange={(e) => handleChange('maintenanceMessage', e.target.value)}
                placeholder="Enter maintenance message for visitors"
                rows={3}
                maxLength={500}
                className="text-sm"
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Backup Settings */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm sm:text-base">Backup Settings</CardTitle>
        </CardHeader>
        <CardContent className="pt-0 space-y-3 sm:space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex-1">
              <Label className="text-xs sm:text-sm">Auto Backup</Label>
              <p className="text-xs sm:text-sm text-gray-600">Automatically backup settings</p>
            </div>
            <Switch
              checked={formData.autoBackup?.enabled !== false}
              onCheckedChange={(checked) => handleChange('autoBackup.enabled', checked)}
            />
          </div>

          {formData.autoBackup?.enabled !== false && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div>
                <Label className="text-xs sm:text-sm">Backup Frequency</Label>
                <Select
                  value={formData.autoBackup?.frequency || 'weekly'}
                  onValueChange={(value) => handleChange('autoBackup.frequency', value)}
                >
                  <SelectTrigger className="text-sm">
                    <SelectValue placeholder="Select frequency" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs sm:text-sm">Retention (days)</Label>
                <Input
                  type="number"
                  min="1"
                  max="365"
                  value={formData.autoBackup?.retention || 30}
                  onChange={(e) => handleChange('autoBackup.retention', parseInt(e.target.value))}
                  className="text-sm"
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );

  const getSectionContent = () => {
    switch (section) {
      case 'general': return renderGeneralSettings();
      case 'booking': return renderBookingSettings();
      case 'payment': return renderPaymentSettings();
      case 'seo': return renderSEOSettings();
      case 'integrations': return renderIntegrationSettings();
      case 'theme': return renderThemeSettings();
      case 'advanced': return renderAdvancedSettings();
      case 'maintenance': return renderMaintenanceSettings();
      default: return <div>Section not found</div>;
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {getSectionContent()}
      
      {/* Save Button */}
      <div className="flex justify-end pt-3 sm:pt-4 border-t">
        <Button 
          onClick={handleSave} 
          disabled={!hasChanges}
          className="flex items-center w-full sm:w-auto text-xs sm:text-sm"
        >
          <Save className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
          <span className="hidden sm:inline">Save {section.charAt(0).toUpperCase() + section.slice(1)} Settings</span>
          <span className="sm:hidden">Save Settings</span>
        </Button>
      </div>
    </div>
  );
}

export default withErrorBoundary(WebSettingsForm, { level: 'component' });