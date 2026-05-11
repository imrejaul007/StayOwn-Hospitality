import React, { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Checkbox } from '../ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Badge } from '../ui/badge';
import { Calendar, AlertCircle, Info } from 'lucide-react';
import { toast } from '../../hooks/use-toast';
import { api } from '../../services/api';

interface RoomType {
  _id: string;
  name: string;
  code: string;
  category: string;
}

interface RoomTaxFormProps {
  tax?: unknown;
  hotelId: string;
  onSubmit: () => void;
  onCancel: () => void;
}

interface FormData {
  taxName: string;
  taxType: string;
  taxCategory: string;
  taxRate: number;
  isPercentage: boolean;
  fixedAmount: number;
  calculationMethod: string;
  roundingRule: string;
  isCompoundTax: boolean;
  compoundOrder: number;
  applicableRoomTypes: string[];
  applicableChannels: string[];
  validFrom: string;
  validTo: string;
  description: string;
  legalReference: string;
  accountingCode: string;
  exemptionRules: {
    minimumStayNights: number;
    maximumStayNights: number;
    exemptGuestTypes: string[];
    exemptCountries: string[];
  };
}

const RoomTaxForm: React.FC<RoomTaxFormProps> = ({
  tax,
  hotelId,
  onSubmit,
  onCancel
}) => {
  const [formData, setFormData] = useState<FormData>({
    taxName: '',
    taxType: 'VAT',
    taxCategory: 'room_charge',
    taxRate: 0,
    isPercentage: true,
    fixedAmount: 0,
    calculationMethod: 'per_room',
    roundingRule: 'round_nearest',
    isCompoundTax: false,
    compoundOrder: 0,
    applicableRoomTypes: [],
    applicableChannels: ['all'],
    validFrom: new Date().toISOString().split('T')[0],
    validTo: '',
    description: '',
    legalReference: '',
    accountingCode: '',
    exemptionRules: {
      minimumStayNights: 0,
      maximumStayNights: 0,
      exemptGuestTypes: [],
      exemptCountries: []
    }
  });

  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const taxTypes = [
    { value: 'VAT', label: 'VAT (Value Added Tax)' },
    { value: 'GST', label: 'GST (Goods & Services Tax)' },
    { value: 'service_tax', label: 'Service Tax' },
    { value: 'luxury_tax', label: 'Luxury Tax' },
    { value: 'city_tax', label: 'City Tax' },
    { value: 'tourism_tax', label: 'Tourism Tax' },
    { value: 'occupancy_tax', label: 'Occupancy Tax' },
    { value: 'resort_fee', label: 'Resort Fee' },
    { value: 'facility_tax', label: 'Facility Tax' },
    { value: 'custom', label: 'Custom Tax' }
  ];

  const taxCategories = [
    { value: 'room_charge', label: 'Room Charge' },
    { value: 'service_charge', label: 'Service Charge' },
    { value: 'additional_service', label: 'Additional Service' },
    { value: 'government', label: 'Government' },
    { value: 'local_authority', label: 'Local Authority' },
    { value: 'facility', label: 'Facility' }
  ];

  const calculationMethods = [
    { value: 'per_room', label: 'Per Room' },
    { value: 'per_guest', label: 'Per Guest' },
    { value: 'per_night', label: 'Per Night' },
    { value: 'per_booking', label: 'Per Booking' }
  ];

  const roundingRules = [
    { value: 'round_up', label: 'Round Up' },
    { value: 'round_down', label: 'Round Down' },
    { value: 'round_nearest', label: 'Round to Nearest' },
    { value: 'no_rounding', label: 'No Rounding' }
  ];

  const channels = [
    { value: 'all', label: 'All Channels' },
    { value: 'direct', label: 'Direct Booking' },
    { value: 'booking_com', label: 'Booking.com' },
    { value: 'expedia', label: 'Expedia' },
    { value: 'airbnb', label: 'Airbnb' },
    { value: 'agoda', label: 'Agoda' }
  ];

  const guestTypes = [
    { value: 'VIP', label: 'VIP' },
    { value: 'corporate', label: 'Corporate' },
    { value: 'government', label: 'Government' },
    { value: 'senior_citizen', label: 'Senior Citizen' },
    { value: 'military', label: 'Military' }
  ];

  useEffect(() => {
    fetchRoomTypes();
    if (tax) {
      populateForm();
    }
  }, [tax]);

  const fetchRoomTypes = async () => {
    try {
      const { data } = await api.get(`/room-types?hotelId=${hotelId}`);
      setRoomTypes(data.data.roomTypes || []);
    } catch {
      // Error handled silently
    }
  };

  const populateForm = () => {
    if (!tax) return;

    setFormData({
      taxName: tax.taxName || '',
      taxType: tax.taxType || 'VAT',
      taxCategory: tax.taxCategory || 'room_charge',
      taxRate: tax.taxRate || 0,
      isPercentage: tax.isPercentage !== false,
      fixedAmount: tax.fixedAmount || 0,
      calculationMethod: tax.calculationMethod || 'per_room',
      roundingRule: tax.roundingRule || 'round_nearest',
      isCompoundTax: tax.isCompoundTax || false,
      compoundOrder: tax.compoundOrder || 0,
      applicableRoomTypes: tax.applicableRoomTypes?.map((rt: unknown) => rt._id || rt) || [],
      applicableChannels: tax.applicableChannels || ['all'],
      validFrom: tax.validFrom ? new Date(tax.validFrom).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
      validTo: tax.validTo ? new Date(tax.validTo).toISOString().split('T')[0] : '',
      description: tax.description || '',
      legalReference: tax.legalReference || '',
      accountingCode: tax.accountingCode || '',
      exemptionRules: {
        minimumStayNights: tax.exemptionRules?.minimumStayNights || 0,
        maximumStayNights: tax.exemptionRules?.maximumStayNights || 0,
        exemptGuestTypes: tax.exemptionRules?.exemptGuestTypes || [],
        exemptCountries: tax.exemptionRules?.exemptCountries || []
      }
    });
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.taxName.trim()) {
      newErrors.taxName = 'Tax name is required';
    }

    if (formData.isPercentage) {
      if (formData.taxRate <= 0 || formData.taxRate > 100) {
        newErrors.taxRate = 'Tax rate must be between 0.01 and 100';
      }
    } else {
      if (formData.fixedAmount <= 0) {
        newErrors.fixedAmount = 'Fixed amount must be greater than 0';
      }
    }

    if (formData.validTo && new Date(formData.validTo) <= new Date(formData.validFrom)) {
      newErrors.validTo = 'Valid to date must be after valid from date';
    }

    if (formData.isCompoundTax && formData.compoundOrder <= 0) {
      newErrors.compoundOrder = 'Compound order must be greater than 0';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      if (tax) {
        await api.put(`/room-taxes/${tax._id}`, formData);
      } else {
        await api.post(`/room-taxes/hotels/${hotelId}`, formData);
      }

      toast({
        title: "Success",
        description: `Tax ${tax ? 'updated' : 'created'} successfully`,
      });

      onSubmit();
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : 'Failed to save tax',
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: string, value: unknown) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));

    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: ''
      }));
    }
  };

  const handleExemptionChange = (field: string, value: unknown) => {
    setFormData(prev => ({
      ...prev,
      exemptionRules: {
        ...prev.exemptionRules,
        [field]: value
      }
    }));
  };

  const handleRoomTypeSelection = (roomTypeId: string, checked: boolean) => {
    const updatedRoomTypes = checked
      ? [...formData.applicableRoomTypes, roomTypeId]
      : formData.applicableRoomTypes.filter(id => id !== roomTypeId);
    
    handleInputChange('applicableRoomTypes', updatedRoomTypes);
  };

  const handleChannelSelection = (channelId: string, checked: boolean) => {
    let updatedChannels = [...formData.applicableChannels];
    
    if (channelId === 'all') {
      updatedChannels = checked ? ['all'] : [];
    } else {
      if (checked) {
        updatedChannels = updatedChannels.filter(c => c !== 'all');
        updatedChannels.push(channelId);
      } else {
        updatedChannels = updatedChannels.filter(c => c !== channelId);
      }
    }
    
    handleInputChange('applicableChannels', updatedChannels);
  };

  const handleGuestTypeExemption = (guestType: string, checked: boolean) => {
    const updatedTypes = checked
      ? [...formData.exemptionRules.exemptGuestTypes, guestType]
      : formData.exemptionRules.exemptGuestTypes.filter(type => type !== guestType);
    
    handleExemptionChange('exemptGuestTypes', updatedTypes);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Tabs defaultValue="basic" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="basic">Basic Info</TabsTrigger>
          <TabsTrigger value="calculation">Calculation</TabsTrigger>
          <TabsTrigger value="applicability">Applicability</TabsTrigger>
          <TabsTrigger value="exemptions">Exemptions</TabsTrigger>
        </TabsList>

        {/* Basic Information */}
        <TabsContent value="basic" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Basic Tax Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="taxName">Tax Name *</Label>
                  <Input
                    id="taxName"
                    value={formData.taxName}
                    onChange={(e) => handleInputChange('taxName', e.target.value)}
                    placeholder="e.g., City Tax, VAT"
                    className={errors.taxName ? 'border-red-500' : ''}
                  />
                  {errors.taxName && (
                    <p className="text-red-500 text-sm mt-1">{errors.taxName}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="taxType">Tax Type *</Label>
                  <Select value={formData.taxType} onValueChange={(value) => handleInputChange('taxType', value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {taxTypes.map(type => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="taxCategory">Tax Category *</Label>
                  <Select value={formData.taxCategory} onValueChange={(value) => handleInputChange('taxCategory', value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {taxCategories.map(category => (
                        <SelectItem key={category.value} value={category.value}>
                          {category.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="accountingCode">Accounting Code</Label>
                  <Input
                    id="accountingCode"
                    value={formData.accountingCode}
                    onChange={(e) => handleInputChange('accountingCode', e.target.value)}
                    placeholder="e.g., TAX001"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  placeholder="Detailed description of the tax"
                  rows={3}
                />
              </div>

              <div>
                <Label htmlFor="legalReference">Legal Reference</Label>
                <Input
                  id="legalReference"
                  value={formData.legalReference}
                  onChange={(e) => handleInputChange('legalReference', e.target.value)}
                  placeholder="Legal act or regulation reference"
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Calculation Settings */}
        <TabsContent value="calculation" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Tax Calculation</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="isPercentage"
                  checked={formData.isPercentage}
                  onCheckedChange={(checked) => handleInputChange('isPercentage', checked)}
                />
                <Label htmlFor="isPercentage">Percentage-based tax</Label>
              </div>

              {formData.isPercentage ? (
                <div>
                  <Label htmlFor="taxRate">Tax Rate (%) *</Label>
                  <Input
                    id="taxRate"
                    type="number"
                    min="0.01"
                    max="100"
                    step="0.01"
                    value={formData.taxRate}
                    onChange={(e) => handleInputChange('taxRate', parseFloat(e.target.value) || 0)}
                    className={errors.taxRate ? 'border-red-500' : ''}
                  />
                  {errors.taxRate && (
                    <p className="text-red-500 text-sm mt-1">{errors.taxRate}</p>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="fixedAmount">Fixed Amount *</Label>
                    <Input
                      id="fixedAmount"
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={formData.fixedAmount}
                      onChange={(e) => handleInputChange('fixedAmount', parseFloat(e.target.value) || 0)}
                      className={errors.fixedAmount ? 'border-red-500' : ''}
                    />
                    {errors.fixedAmount && (
                      <p className="text-red-500 text-sm mt-1">{errors.fixedAmount}</p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="calculationMethod">Calculation Method</Label>
                    <Select value={formData.calculationMethod} onValueChange={(value) => handleInputChange('calculationMethod', value)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {calculationMethods.map(method => (
                          <SelectItem key={method.value} value={method.value}>
                            {method.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              <div>
                <Label htmlFor="roundingRule">Rounding Rule</Label>
                <Select value={formData.roundingRule} onValueChange={(value) => handleInputChange('roundingRule', value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {roundingRules.map(rule => (
                      <SelectItem key={rule.value} value={rule.value}>
                        {rule.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="border-t pt-4">
                <div className="flex items-center space-x-2 mb-4">
                  <Checkbox
                    id="isCompoundTax"
                    checked={formData.isCompoundTax}
                    onCheckedChange={(checked) => handleInputChange('isCompoundTax', checked)}
                  />
                  <Label htmlFor="isCompoundTax">Compound Tax</Label>
                  <div className="flex items-center text-sm text-gray-500">
                    <Info className="h-4 w-4 mr-1" />
                    Applied on top of other taxes
                  </div>
                </div>

                {formData.isCompoundTax && (
                  <div>
                    <Label htmlFor="compoundOrder">Compound Order *</Label>
                    <Input
                      id="compoundOrder"
                      type="number"
                      min="1"
                      value={formData.compoundOrder}
                      onChange={(e) => handleInputChange('compoundOrder', parseInt(e.target.value) || 0)}
                      className={errors.compoundOrder ? 'border-red-500' : ''}
                    />
                    {errors.compoundOrder && (
                      <p className="text-red-500 text-sm mt-1">{errors.compoundOrder}</p>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Applicability */}
        <TabsContent value="applicability" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Tax Applicability</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Valid Period */}
              <div>
                <h4 className="font-medium mb-3">Valid Period</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="validFrom">Valid From *</Label>
                    <Input
                      id="validFrom"
                      type="date"
                      value={formData.validFrom}
                      onChange={(e) => handleInputChange('validFrom', e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="validTo">Valid To</Label>
                    <Input
                      id="validTo"
                      type="date"
                      value={formData.validTo}
                      onChange={(e) => handleInputChange('validTo', e.target.value)}
                      className={errors.validTo ? 'border-red-500' : ''}
                    />
                    {errors.validTo && (
                      <p className="text-red-500 text-sm mt-1">{errors.validTo}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Room Types */}
              <div>
                <h4 className="font-medium mb-3">Applicable Room Types</h4>
                <div className="text-sm text-gray-600 mb-3">
                  Leave empty to apply to all room types
                </div>
                <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                  {roomTypes.map(roomType => (
                    <label key={roomType._id} className="flex items-center space-x-2">
                      <Checkbox
                        checked={formData.applicableRoomTypes.includes(roomType._id)}
                        onCheckedChange={(checked) => handleRoomTypeSelection(roomType._id, checked as boolean)}
                      />
                      <span className="text-sm">{roomType.name} ({roomType.code})</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Channels */}
              <div>
                <h4 className="font-medium mb-3">Applicable Channels</h4>
                <div className="grid grid-cols-2 gap-2">
                  {channels.map(channel => (
                    <label key={channel.value} className="flex items-center space-x-2">
                      <Checkbox
                        checked={formData.applicableChannels.includes(channel.value)}
                        onCheckedChange={(checked) => handleChannelSelection(channel.value, checked as boolean)}
                      />
                      <span className="text-sm">{channel.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Exemptions */}
        <TabsContent value="exemptions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Tax Exemptions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Stay Duration Exemptions */}
              <div>
                <h4 className="font-medium mb-3">Stay Duration Exemptions</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="minimumStayNights">Minimum Stay (nights)</Label>
                    <Input
                      id="minimumStayNights"
                      type="number"
                      min="0"
                      value={formData.exemptionRules.minimumStayNights}
                      onChange={(e) => handleExemptionChange('minimumStayNights', parseInt(e.target.value) || 0)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="maximumStayNights">Maximum Stay (nights)</Label>
                    <Input
                      id="maximumStayNights"
                      type="number"
                      min="0"
                      value={formData.exemptionRules.maximumStayNights}
                      onChange={(e) => handleExemptionChange('maximumStayNights', parseInt(e.target.value) || 0)}
                    />
                  </div>
                </div>
              </div>

              {/* Guest Type Exemptions */}
              <div>
                <h4 className="font-medium mb-3">Exempt Guest Types</h4>
                <div className="grid grid-cols-2 gap-2">
                  {guestTypes.map(guestType => (
                    <label key={guestType.value} className="flex items-center space-x-2">
                      <Checkbox
                        checked={formData.exemptionRules.exemptGuestTypes.includes(guestType.value)}
                        onCheckedChange={(checked) => handleGuestTypeExemption(guestType.value, checked as boolean)}
                      />
                      <span className="text-sm">{guestType.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Country Exemptions */}
              <div>
                <h4 className="font-medium mb-3">Exempt Countries</h4>
                <Input
                  placeholder="Enter country codes separated by commas (e.g., US, CA, GB)"
                  value={formData.exemptionRules.exemptCountries.join(', ')}
                  onChange={(e) => {
                    const countries = e.target.value.split(',').map(c => c.trim()).filter(Boolean);
                    handleExemptionChange('exemptCountries', countries);
                  }}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Action Buttons */}
      <div className="flex justify-end gap-4 pt-6 border-t">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={loading}>
          {loading ? 'Saving...' : (tax ? 'Update Tax' : 'Create Tax')}
        </Button>
      </div>
    </form>
  );
};

export default RoomTaxForm;