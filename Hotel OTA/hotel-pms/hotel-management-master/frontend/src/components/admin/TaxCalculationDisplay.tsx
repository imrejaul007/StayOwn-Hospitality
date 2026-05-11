import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Badge } from '../ui/badge';
import { Separator } from '../ui/separator';
import { Calculator, IndianRupee, Percent, Info, Download } from 'lucide-react';
import { toast } from '../../hooks/use-toast';
import { api } from '../../services/api';

interface RoomType {
  _id: string;
  name: string;
  code: string;
  category: string;
}

interface TaxBreakdown {
  taxId: string;
  taxName: string;
  taxType: string;
  taxCategory: string;
  taxRate: number;
  isPercentage: boolean;
  fixedAmount: number;
  calculationMethod: string;
  baseAmount: number;
  taxAmount: number;
  isCompound: boolean;
  compoundOrder?: number;
}

interface CategoryBreakdown {
  [category: string]: {
    category: string;
    taxes: TaxBreakdown[];
    totalAmount: number;
  };
}

interface CalculationResult {
  totalTaxAmount: number;
  taxBreakdown: TaxBreakdown[];
  applicableTaxes: unknown[];
  calculation: {
    baseAmount: number;
    totalTaxAmount: number;
    totalAmount: number;
  };
  categoryBreakdown: CategoryBreakdown;
}

interface TaxCalculationDisplayProps {
  hotelId: string;
  onClose: () => void;
}

const TaxCalculationDisplay: React.FC<TaxCalculationDisplayProps> = ({
  hotelId,
  onClose
}) => {
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
  const [calculationParams, setCalculationParams] = useState({
    baseAmount: 100,
    roomTypeId: '',
    roomCount: 1,
    guestCount: 2,
    stayNights: 1,
    channel: 'direct',
    guestType: '',
    guestCountry: '',
    checkInDate: new Date().toISOString().split('T')[0]
  });
  const [calculationResult, setCalculationResult] = useState<CalculationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [autoCalculate, setAutoCalculate] = useState(true);

  const channels = [
    { value: 'direct', label: 'Direct Booking' },
    { value: 'booking_com', label: 'Booking.com' },
    { value: 'expedia', label: 'Expedia' },
    { value: 'airbnb', label: 'Airbnb' },
    { value: 'agoda', label: 'Agoda' }
  ];

  const guestTypes = [
    { value: '', label: 'Regular Guest' },
    { value: 'VIP', label: 'VIP' },
    { value: 'corporate', label: 'Corporate' },
    { value: 'government', label: 'Government' },
    { value: 'senior_citizen', label: 'Senior Citizen' },
    { value: 'military', label: 'Military' }
  ];

  useEffect(() => {
    fetchRoomTypes();
  }, []);

  useEffect(() => {
    if (autoCalculate && calculationParams.baseAmount > 0) {
      calculateTaxes();
    }
  }, [calculationParams, autoCalculate]);

  const fetchRoomTypes = async () => {
    try {
      const { data } = await api.get(`/room-types?hotelId=${hotelId}`);
      {
        setRoomTypes(data.data.roomTypes || []);
      }
    } catch {
      // Error handled silently
    }
  };

  const calculateTaxes = async () => {
    if (calculationParams.baseAmount <= 0) {
      return;
    }

    setLoading(true);

    try {
      const { data } = await api.post(`/room-taxes/hotels/${hotelId}/calculate`, calculationParams);
      setCalculationResult(data.data);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to calculate taxes",
        variant: "destructive",
      });
      setCalculationResult(null);
    } finally {
      setLoading(false);
    }
  };

  const handleParamChange = (field: string, value: unknown) => {
    setCalculationParams(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const getTaxTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      'VAT': 'bg-blue-100 text-blue-800',
      'GST': 'bg-green-100 text-green-800',
      'service_tax': 'bg-yellow-100 text-yellow-800',
      'luxury_tax': 'bg-purple-100 text-purple-800',
      'city_tax': 'bg-orange-100 text-orange-800',
      'tourism_tax': 'bg-pink-100 text-pink-800',
      'occupancy_tax': 'bg-indigo-100 text-indigo-800',
      'resort_fee': 'bg-teal-100 text-teal-800',
      'facility_tax': 'bg-gray-100 text-gray-800',
      'custom': 'bg-red-100 text-red-800'
    };
    return colors[type] || 'bg-gray-100 text-gray-800';
  };

  const formatCurrency = (amount: number) => {
    return `$${amount.toFixed(2)}`;
  };

  const exportCalculation = () => {
    if (!calculationResult) return;

    const exportData = {
      calculationDate: new Date().toISOString(),
      parameters: calculationParams,
      result: calculationResult
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tax-calculation-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({
      title: "Success",
      description: "Tax calculation exported successfully",
    });
  };

  return (
    <div className="space-y-6">
      {/* Calculation Parameters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Tax Calculation Parameters
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="baseAmount">Base Amount *</Label>
              <div className="relative">
                <IndianRupee className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  id="baseAmount"
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={calculationParams.baseAmount}
                  onChange={(e) => handleParamChange('baseAmount', parseFloat(e.target.value) || 0)}
                  className="pl-10"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="roomType">Room Type</Label>
              <Select value={calculationParams.roomTypeId} onValueChange={(value) => handleParamChange('roomTypeId', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select room type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Room Types</SelectItem>
                  {roomTypes.map(roomType => (
                    <SelectItem key={roomType._id} value={roomType._id}>
                      {roomType.name} ({roomType.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label htmlFor="roomCount">Rooms</Label>
              <Input
                id="roomCount"
                type="number"
                min="1"
                value={calculationParams.roomCount}
                onChange={(e) => handleParamChange('roomCount', parseInt(e.target.value) || 1)}
              />
            </div>

            <div>
              <Label htmlFor="guestCount">Guests</Label>
              <Input
                id="guestCount"
                type="number"
                min="1"
                value={calculationParams.guestCount}
                onChange={(e) => handleParamChange('guestCount', parseInt(e.target.value) || 1)}
              />
            </div>

            <div>
              <Label htmlFor="stayNights">Nights</Label>
              <Input
                id="stayNights"
                type="number"
                min="1"
                value={calculationParams.stayNights}
                onChange={(e) => handleParamChange('stayNights', parseInt(e.target.value) || 1)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="channel">Booking Channel</Label>
              <Select value={calculationParams.channel} onValueChange={(value) => handleParamChange('channel', value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {channels.map(channel => (
                    <SelectItem key={channel.value} value={channel.value}>
                      {channel.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="guestType">Guest Type</Label>
              <Select value={calculationParams.guestType} onValueChange={(value) => handleParamChange('guestType', value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {guestTypes.map(type => (
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
              <Label htmlFor="guestCountry">Guest Country</Label>
              <Input
                id="guestCountry"
                value={calculationParams.guestCountry}
                onChange={(e) => handleParamChange('guestCountry', e.target.value)}
                placeholder="e.g., US, CA, GB"
              />
            </div>

            <div>
              <Label htmlFor="checkInDate">Check-in Date</Label>
              <Input
                id="checkInDate"
                type="date"
                value={calculationParams.checkInDate}
                onChange={(e) => handleParamChange('checkInDate', e.target.value)}
              />
            </div>
          </div>

          <div className="flex gap-4">
            <Button
              onClick={calculateTaxes}
              disabled={loading || calculationParams.baseAmount <= 0}
              className="flex items-center gap-2"
            >
              {loading ? 'Calculating...' : 'Calculate Taxes'}
              <Calculator className="h-4 w-4" />
            </Button>

            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={autoCalculate}
                onChange={(e) => setAutoCalculate(e.target.checked)}
              />
              <span className="text-sm">Auto-calculate on change</span>
            </label>
          </div>
        </CardContent>
      </Card>

      {/* Calculation Results */}
      {calculationResult && (
        <>
          {/* Summary */}
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>Tax Calculation Summary</CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={exportCalculation}
                  className="flex items-center gap-2"
                >
                  <Download className="h-4 w-4" />
                  Export
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-6">
                <div className="text-center">
                  <div className="text-2xl font-bold text-gray-900">
                    {formatCurrency(calculationResult.calculation.baseAmount)}
                  </div>
                  <div className="text-sm text-gray-600">Base Amount</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-orange-600">
                    {formatCurrency(calculationResult.calculation.totalTaxAmount)}
                  </div>
                  <div className="text-sm text-gray-600">Total Tax</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {formatCurrency(calculationResult.calculation.totalAmount)}
                  </div>
                  <div className="text-sm text-gray-600">Final Amount</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Category Breakdown */}
          {Object.keys(calculationResult.categoryBreakdown).length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Tax by Category</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {Object.values(calculationResult.categoryBreakdown).map((category) => (
                    <div key={category.category} className="border rounded-lg p-4">
                      <div className="flex justify-between items-center mb-2">
                        <h4 className="font-medium capitalize">
                          {category.category.replace('_', ' ')}
                        </h4>
                        <div className="text-lg font-semibold">
                          {formatCurrency(category.totalAmount)}
                        </div>
                      </div>
                      <div className="space-y-2">
                        {category.taxes.map((tax, index) => (
                          <div key={`category-taxes-${index}`} className="flex justify-between items-center text-sm">
                            <div className="flex items-center gap-2">
                              <Badge className={getTaxTypeColor(tax.taxType)}>
                                {tax.taxType}
                              </Badge>
                              <span>{tax.taxName}</span>
                              {tax.isCompound && (
                                <Badge variant="secondary" className="text-xs">
                                  Compound
                                </Badge>
                              )}
                            </div>
                            <div>{formatCurrency(tax.taxAmount)}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Detailed Breakdown */}
          {calculationResult.taxBreakdown.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Detailed Tax Breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {calculationResult.taxBreakdown.map((tax, index) => (
                    <div key={`calculationResult-taxBreakdown-${index}`} className="border rounded-lg p-4">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-medium">{tax.taxName}</h4>
                            <Badge className={getTaxTypeColor(tax.taxType)}>
                              {tax.taxType}
                            </Badge>
                            {tax.isCompound && (
                              <Badge variant="secondary">
                                Compound ({tax.compoundOrder})
                              </Badge>
                            )}
                          </div>
                          <div className="text-sm text-gray-600 capitalize">
                            {tax.taxCategory.replace('_', ' ')}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-semibold">
                            {formatCurrency(tax.taxAmount)}
                          </div>
                          <div className="text-sm text-gray-600">
                            {tax.isPercentage ? (
                              <span className="flex items-center gap-1">
                                <Percent className="h-3 w-3" />
                                {tax.taxRate}%
                              </span>
                            ) : (
                              <span className="flex items-center gap-1">
                                <IndianRupee className="h-3 w-3" />
                                {tax.fixedAmount} {tax.calculationMethod.replace('_', ' ')}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <Separator className="my-2" />

                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-gray-600">Base Amount:</span>
                          <span className="ml-2 font-medium">
                            {formatCurrency(tax.baseAmount)}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-600">Calculation Method:</span>
                          <span className="ml-2 font-medium capitalize">
                            {tax.calculationMethod.replace('_', ' ')}
                          </span>
                        </div>
                      </div>

                      {tax.isPercentage && (
                        <div className="mt-2 text-sm text-gray-600">
                          Calculation: {formatCurrency(tax.baseAmount)} × {tax.taxRate}% = {formatCurrency(tax.taxAmount)}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* No Taxes Message */}
          {calculationResult.taxBreakdown.length === 0 && (
            <Card>
              <CardContent className="text-center py-8">
                <Info className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Applicable Taxes</h3>
                <p className="text-gray-600">
                  No taxes are applicable for the selected criteria.
                </p>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* No Results Message */}
      {!calculationResult && !loading && calculationParams.baseAmount > 0 && (
        <Card>
          <CardContent className="text-center py-8">
            <Calculator className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Ready to Calculate</h3>
            <p className="text-gray-600 mb-4">
              Click "Calculate Taxes" to see the tax breakdown for your parameters.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default TaxCalculationDisplay;