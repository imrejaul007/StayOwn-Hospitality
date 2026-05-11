import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { LoadingSpinner } from '../LoadingSpinner';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DataTable } from '../dashboard/DataTable';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { api } from '../../services/api';
import { withErrorBoundary } from '../ErrorBoundary';

interface GSTCalculationResult {
  baseAmount: number;
  gstRate: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  totalGstAmount: number;
  totalAmount: number;
  isInterstate: boolean;
}

interface InvoiceItem {
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

interface GSTDetails {
  gstRate: number;
  placeOfSupply: string;
  companyState: string;
  isGstApplicable: boolean;
}

interface InvoiceData {
  invoiceNumber: string;
  invoiceDate: string;
  billingDetails: {
    company: unknown;
    hotel: unknown;
  };
  items: InvoiceItem[];
  gstCalculation: GSTCalculationResult;
  totalAmount: number;
}

interface StateCode {
  code: string;
  name: string;
}

const GSTManagement: React.FC = () => {
  const [selectedTab, setSelectedTab] = useState('calculator');
  const [showCalculatorModal, setShowCalculatorModal] = useState(false);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [calculationResult, setCalculationResult] = useState<GSTCalculationResult | null>(null);
  const [invoiceData, setInvoiceData] = useState<InvoiceData | null>(null);

  // Calculator form state
  const [calculatorForm, setCalculatorForm] = useState({
    amount: '',
    gstRate: '18',
    placeOfSupply: 'Maharashtra',
    companyState: 'Maharashtra',
    calculationType: 'forward' // forward or reverse
  });

  // Booking GST form state
  const [bookingItems, setBookingItems] = useState<InvoiceItem[]>([
    { description: '', quantity: 1, unitPrice: 0, amount: 0 }
  ]);
  const [bookingGSTDetails, setBookingGSTDetails] = useState<GSTDetails>({
    gstRate: 18,
    placeOfSupply: 'Maharashtra',
    companyState: 'Maharashtra',
    isGstApplicable: true
  });

  // GST validation form state
  const [gstValidationForm, setGstValidationForm] = useState({
    gstNumber: '',
    validationResult: null as unknown
  });

  const queryClient = useQueryClient();

  // Fetch state codes
  const { data: stateCodes, isLoading: stateCodesLoading } = useQuery<{ data: { stateCodes: StateCode[] } }>({
    queryKey: ['stateCodes'],
    queryFn: async () => {
      const response = await api.get('/corporate/gst/state-codes');
      return response.data;
    }
  });

  // Fetch bookings for invoice generation
  const { data: bookings } = useQuery({
    queryKey: ['corporateBookings'],
    queryFn: async () => {
      const response = await api.get('/bookings?type=corporate&limit=100');
      return response.data;
    }
  });

  // Calculate GST mutation
  const calculateGSTMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const endpoint = data.calculationType === 'reverse' 
        ? '/api/v1/corporate/gst/reverse-calculate'
        : '/api/v1/corporate/gst/calculate';
      
      const payload = data.calculationType === 'reverse'
        ? { totalAmount: parseFloat(data.amount), gstRate: parseFloat(data.gstRate) }
        : { 
            amount: parseFloat(data.amount), 
            gstRate: parseFloat(data.gstRate),
            placeOfSupply: data.placeOfSupply,
            companyState: data.companyState
          };

      const response = await api.post(endpoint.replace('/api/v1', ''), payload);
      return response.data;
    },
    onSuccess: (result) => {
      const calculation = calculatorForm.calculationType === 'reverse' 
        ? result.data.reverseCalculation 
        : result.data.gstCalculation;
      setCalculationResult(calculation);
      toast.success('GST calculated successfully');
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Failed to calculate GST');
    }
  });

  // Calculate booking GST mutation
  const calculateBookingGSTMutation = useMutation({
    mutationFn: async ({ items, gstDetails }: { items: InvoiceItem[]; gstDetails: GSTDetails }) => {
      const response = await api.post('/corporate/gst/calculate-booking', { items, gstDetails });
      return response.data;
    },
    onSuccess: (result) => {
      setCalculationResult(result.data.gstCalculation);
      toast.success('Booking GST calculated successfully');
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Failed to calculate booking GST');
    }
  });

  // Validate GST number mutation
  const validateGSTMutation = useMutation({
    mutationFn: async (gstNumber: string) => {
      const response = await api.post('/corporate/gst/validate-number', { gstNumber });
      return response.data;
    },
    onSuccess: (result) => {
      setGstValidationForm(prev => ({ ...prev, validationResult: result.data }));
      const status = result.data.isValid ? 'valid' : 'invalid';
      toast.success(`GST number is ${status}${result.data.stateName ? ` (${result.data.stateName})` : ''}`);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Failed to validate GST number');
    }
  });

  // Generate invoice data mutation
  const generateInvoiceMutation = useMutation({
    mutationFn: async (bookingId: string) => {
      const response = await api.get(`/corporate/gst/generate-invoice-data/${bookingId}`);
      return response.data;
    },
    onSuccess: (result) => {
      setInvoiceData(result.data);
      setShowInvoiceModal(true);
      toast.success('Invoice data generated successfully');
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Failed to generate invoice data');
    }
  });

  // Update booking GST details mutation
  const updateBookingGSTMutation = useMutation({
    mutationFn: async ({ bookingId, gstDetails }: { bookingId: string; gstDetails: Record<string, unknown> }) => {
      const response = await api.patch(`/corporate/gst/update-booking-gst/${bookingId}`, gstDetails);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['corporateBookings'] });
      toast.success('Booking GST details updated successfully');
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Failed to update booking GST details');
    }
  });

  // Helper functions
  const addBookingItem = () => {
    setBookingItems([...bookingItems, { description: '', quantity: 1, unitPrice: 0, amount: 0 }]);
  };

  const removeBookingItem = (index: number) => {
    setBookingItems(bookingItems.filter((_, i) => i !== index));
  };

  const updateBookingItem = (index: number, field: keyof InvoiceItem, value: string | number) => {
    const updatedItems = bookingItems.map((item, i) => {
      if (i === index) {
        const updatedItem = { ...item, [field]: value };
        if (field === 'quantity' || field === 'unitPrice') {
          updatedItem.amount = updatedItem.quantity * updatedItem.unitPrice;
        }
        return updatedItem;
      }
      return item;
    });
    setBookingItems(updatedItems);
  };

  const calculateGST = () => {
    if (!calculatorForm.amount) {
      toast.error('Please enter an amount');
      return;
    }
    calculateGSTMutation.mutate(calculatorForm);
  };

  const calculateBookingGST = () => {
    const validItems = bookingItems.filter(item => 
      item.description && item.quantity > 0 && item.unitPrice > 0
    );
    
    if (validItems.length === 0) {
      toast.error('Please add at least one valid item');
      return;
    }
    
    calculateBookingGSTMutation.mutate({ 
      items: validItems, 
      gstDetails: bookingGSTDetails 
    });
  };

  const validateGSTNumber = () => {
    if (!gstValidationForm.gstNumber) {
      toast.error('Please enter a GST number');
      return;
    }
    validateGSTMutation.mutate(gstValidationForm.gstNumber);
  };

  if (stateCodesLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner />
      </div>
    );
  }

  const stateOptions = stateCodes?.data?.stateCodes || [];

  const bookingColumns = [
    {
      key: 'bookingNumber',
      header: 'Booking Number',
      render: (value: unknown, booking: Record<string, unknown>) => (
        <span className="font-medium text-gray-900">{booking.bookingNumber || 'N/A'}</span>
      )
    },
    {
      key: 'company',
      header: 'Company',
      render: (value: unknown, booking: Record<string, unknown>) => (
        <span className="text-gray-700">{booking.corporateBooking?.corporateCompanyId?.name || 'N/A'}</span>
      )
    },
    {
      key: 'amount',
      header: 'Amount',
      render: (value: unknown, booking: Record<string, unknown>) => (
        <span className="font-semibold text-gray-900">{formatCurrency(booking.totalAmount || 0)}</span>
      )
    },
    {
      key: 'gstStatus',
      header: 'GST Status',
      render: (value: unknown, booking: Record<string, unknown>) => (
        <Badge className={booking.gstDetails?.isGstApplicable ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}>
          {booking.gstDetails?.isGstApplicable ? 'GST Applied' : 'No GST'}
        </Badge>
      )
    },
    {
      key: 'date',
      header: 'Date',
      render: (value: unknown, booking: Record<string, unknown>) => (
        <span className="text-sm text-gray-600">{formatDate(booking.createdAt)}</span>
      )
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (value: unknown, booking: Record<string, unknown>) => (
        <div className="flex space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => generateInvoiceMutation.mutate(booking._id)}
            disabled={generateInvoiceMutation.isPending}
          >
            Generate Invoice
          </Button>
        </div>
      )
    }
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">GST Management</h1>
        <Button onClick={() => setShowCalculatorModal(true)}>
          Quick GST Calculator
        </Button>
      </div>

      <Tabs value={selectedTab} onValueChange={setSelectedTab}>
        <TabsList>
          <TabsTrigger value="calculator">GST Calculator</TabsTrigger>
          <TabsTrigger value="booking-calculator">Booking GST</TabsTrigger>
          <TabsTrigger value="validator">GST Validator</TabsTrigger>
          <TabsTrigger value="invoices">Invoice Generation</TabsTrigger>
        </TabsList>

        <TabsContent value="calculator" className="space-y-6">
          <Card className="shadow-sm">
            <CardHeader className="bg-gray-50 border-b">
              <CardTitle className="text-xl font-semibold text-gray-900">GST Calculator</CardTitle>
              <p className="text-sm text-gray-600 mt-1">Calculate GST amounts for forward and reverse calculations</p>
            </CardHeader>
            <CardContent className="space-y-6 p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Calculation Type</label>
                  <select
                    value={calculatorForm.calculationType}
                    onChange={(e) => setCalculatorForm(prev => ({ ...prev, calculationType: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                  >
                    <option value="forward">Forward (Base Amount → Total)</option>
                    <option value="reverse">Reverse (Total Amount → Base)</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {calculatorForm.calculationType === 'forward' ? 'Base Amount' : 'Total Amount (Inc. GST)'}
                  </label>
                  <Input
                    type="number"
                    step="0.01"
                    value={calculatorForm.amount}
                    onChange={(e) => setCalculatorForm(prev => ({ ...prev, amount: e.target.value }))}
                    placeholder="Enter amount"
                    className="w-full"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">GST Rate (%)</label>
                  <select
                    value={calculatorForm.gstRate}
                    onChange={(e) => setCalculatorForm(prev => ({ ...prev, gstRate: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                  >
                    <option value="5">5%</option>
                    <option value="12">12%</option>
                    <option value="18">18%</option>
                    <option value="28">28%</option>
                  </select>
                </div>

                {calculatorForm.calculationType === 'forward' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Place of Supply</label>
                      <select
                        value={calculatorForm.placeOfSupply}
                        onChange={(e) => setCalculatorForm(prev => ({ ...prev, placeOfSupply: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                      >
                        {stateOptions.map((state) => (
                          <option key={state.code} value={state.name}>
                            {state.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Company State</label>
                      <select
                        value={calculatorForm.companyState}
                        onChange={(e) => setCalculatorForm(prev => ({ ...prev, companyState: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                      >
                        {stateOptions.map((state) => (
                          <option key={state.code} value={state.name}>
                            {state.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </>
                )}
              </div>

              <div className="flex justify-center mt-6">
                <Button
                  onClick={calculateGST}
                  disabled={calculateGSTMutation.isPending}
                  className="w-full md:w-auto px-8 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-md shadow-sm"
                >
                  {calculateGSTMutation.isPending ? 'Calculating...' : 'Calculate GST'}
                </Button>
              </div>

              {calculationResult && (
                <div className="mt-6 p-6 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
                  <h3 className="text-lg font-semibold mb-4 text-gray-900">📊 GST Calculation Result</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <div className="text-sm text-gray-600">Base Amount</div>
                      <div className="text-lg font-semibold">{formatCurrency(calculationResult.baseAmount)}</div>
                    </div>
                    {calculationResult.cgstAmount > 0 && (
                      <div>
                        <div className="text-sm text-gray-600">CGST ({calculationResult.gstRate/2}%)</div>
                        <div className="text-lg font-semibold">{formatCurrency(calculationResult.cgstAmount)}</div>
                      </div>
                    )}
                    {calculationResult.sgstAmount > 0 && (
                      <div>
                        <div className="text-sm text-gray-600">SGST ({calculationResult.gstRate/2}%)</div>
                        <div className="text-lg font-semibold">{formatCurrency(calculationResult.sgstAmount)}</div>
                      </div>
                    )}
                    {calculationResult.igstAmount > 0 && (
                      <div>
                        <div className="text-sm text-gray-600">IGST ({calculationResult.gstRate}%)</div>
                        <div className="text-lg font-semibold">{formatCurrency(calculationResult.igstAmount)}</div>
                      </div>
                    )}
                    <div>
                      <div className="text-sm text-gray-600">Total GST</div>
                      <div className="text-lg font-semibold text-blue-600">{formatCurrency(calculationResult.totalGstAmount)}</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-600">Total Amount</div>
                      <div className="text-xl font-bold text-green-600">{formatCurrency(calculationResult.totalAmount)}</div>
                    </div>
                  </div>
                  <div className="mt-3 text-sm text-gray-600">
                    Tax Type: {calculationResult.isInterstate ? 'Interstate (IGST)' : 'Intrastate (CGST + SGST)'}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="booking-calculator" className="space-y-6">
          <Card className="shadow-sm">
            <CardHeader className="bg-gray-50 border-b">
              <CardTitle className="text-xl font-semibold text-gray-900">Booking GST Calculator</CardTitle>
              <p className="text-sm text-gray-600 mt-1">Calculate GST for multiple booking items and generate detailed invoices</p>
            </CardHeader>
            <CardContent className="space-y-6 p-6">
              <div className="space-y-4">
                <h4 className="font-semibold text-gray-900 text-lg">📝 Invoice Items</h4>
                {bookingItems.map((item, index) => (
                  <div key={`bookingItems-${index}`} className="grid grid-cols-1 md:grid-cols-5 gap-4 p-4 border rounded-lg">
                    <div className="md:col-span-2">
                      <Input
                        placeholder="Item description"
                        value={item.description}
                        onChange={(e) => updateBookingItem(index, 'description', e.target.value)}
                      />
                    </div>
                    <div>
                      <Input
                        type="number"
                        placeholder="Quantity"
                        value={item.quantity}
                        onChange={(e) => updateBookingItem(index, 'quantity', parseInt(e.target.value) || 0)}
                      />
                    </div>
                    <div>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="Unit price"
                        value={item.unitPrice}
                        onChange={(e) => updateBookingItem(index, 'unitPrice', parseFloat(e.target.value) || 0)}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="font-medium">{formatCurrency(item.amount)}</div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => removeBookingItem(index)}
                        disabled={bookingItems.length === 1}
                      >
                        Remove
                      </Button>
                    </div>
                  </div>
                ))}
                
                <Button variant="outline" onClick={addBookingItem}>
                  Add Item
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">GST Rate (%)</label>
                  <select
                    value={bookingGSTDetails.gstRate.toString()}
                    onChange={(e) => setBookingGSTDetails(prev => ({ ...prev, gstRate: parseFloat(e.target.value) }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                  >
                    <option value="5">5%</option>
                    <option value="12">12%</option>
                    <option value="18">18%</option>
                    <option value="28">28%</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Place of Supply</label>
                  <select
                    value={bookingGSTDetails.placeOfSupply}
                    onChange={(e) => setBookingGSTDetails(prev => ({ ...prev, placeOfSupply: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                  >
                    {stateOptions.map((state) => (
                      <option key={state.code} value={state.name}>
                        {state.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Company State</label>
                  <select
                    value={bookingGSTDetails.companyState}
                    onChange={(e) => setBookingGSTDetails(prev => ({ ...prev, companyState: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                  >
                    {stateOptions.map((state) => (
                      <option key={state.code} value={state.name}>
                        {state.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="gstApplicable"
                  checked={bookingGSTDetails.isGstApplicable}
                  onChange={(e) => setBookingGSTDetails(prev => ({ ...prev, isGstApplicable: e.target.checked }))}
                  className="rounded"
                />
                <label htmlFor="gstApplicable" className="text-sm">GST Applicable</label>
              </div>

              <div className="flex justify-center mt-6">
                <Button
                  onClick={calculateBookingGST}
                  disabled={calculateBookingGSTMutation.isPending}
                  className="w-full md:w-auto px-8 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-md shadow-sm"
                >
                  {calculateBookingGSTMutation.isPending ? 'Calculating...' : 'Calculate Booking GST'}
                </Button>
              </div>

              {calculationResult && (
                <div className="mt-6 p-4 bg-green-50 rounded-lg">
                  <h3 className="text-lg font-semibold mb-4">Booking GST Calculation</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <div className="text-sm text-gray-600">Subtotal</div>
                      <div className="text-lg font-semibold">{formatCurrency(calculationResult.baseAmount)}</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-600">Total GST</div>
                      <div className="text-lg font-semibold text-blue-600">{formatCurrency(calculationResult.totalGstAmount)}</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-600">Grand Total</div>
                      <div className="text-xl font-bold text-green-600">{formatCurrency(calculationResult.totalAmount)}</div>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="validator" className="space-y-6">
          <Card className="shadow-sm">
            <CardHeader className="bg-gray-50 border-b">
              <CardTitle className="text-xl font-semibold text-gray-900">GST Number Validator</CardTitle>
              <p className="text-sm text-gray-600 mt-1">Validate GST numbers and retrieve company information</p>
            </CardHeader>
            <CardContent className="space-y-6 p-6">
              <div className="flex space-x-4">
                <div className="flex-1">
                  <Input
                    placeholder="Enter GST Number (e.g., 27AAAAA0000A1Z5)"
                    value={gstValidationForm.gstNumber}
                    onChange={(e) => setGstValidationForm(prev => ({ ...prev, gstNumber: e.target.value.toUpperCase() }))}
                    className="font-mono"
                  />
                </div>
                <Button 
                  onClick={validateGSTNumber} 
                  disabled={validateGSTMutation.isPending}
                >
                  {validateGSTMutation.isPending ? 'Validating...' : 'Validate'}
                </Button>
              </div>

              {gstValidationForm.validationResult && (
                <div className={`p-4 rounded-lg ${
                  gstValidationForm.validationResult.isValid 
                    ? 'bg-green-50 border border-green-200' 
                    : 'bg-red-50 border border-red-200'
                }`}>
                  <div className="flex items-center space-x-2 mb-2">
                    <div className={`w-3 h-3 rounded-full ${
                      gstValidationForm.validationResult.isValid ? 'bg-green-500' : 'bg-red-500'
                    }`}></div>
                    <span className={`font-medium ${
                      gstValidationForm.validationResult.isValid ? 'text-green-800' : 'text-red-800'
                    }`}>
                      {gstValidationForm.validationResult.isValid ? 'Valid GST Number' : 'Invalid GST Number'}
                    </span>
                  </div>
                  
                  {gstValidationForm.validationResult.isValid && (
                    <div className="text-sm text-gray-600 space-y-1">
                      <div>GST Number: <span className="font-mono font-medium">{gstValidationForm.validationResult.gstNumber}</span></div>
                      {gstValidationForm.validationResult.stateName && (
                        <>
                          <div>State: {gstValidationForm.validationResult.stateName}</div>
                          <div>State Code: {gstValidationForm.validationResult.stateCode}</div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}

              <div className="mt-6">
                <h4 className="text-sm font-medium text-gray-700 mb-2">GST Number Format Guide:</h4>
                <div className="text-xs text-gray-600 space-y-1">
                  <div>• Total 15 characters</div>
                  <div>• First 2 digits: State Code (e.g., 27 for Maharashtra)</div>
                  <div>• Next 10 characters: Company PAN</div>
                  <div>• 13th character: Entity Number</div>
                  <div>• 14th character: Z (default)</div>
                  <div>• 15th character: Check Sum Digit</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="invoices" className="space-y-6">
          <Card className="shadow-sm">
            <CardHeader className="bg-gray-50 border-b">
              <CardTitle className="text-xl font-semibold text-gray-900">Corporate Bookings - Invoice Generation</CardTitle>
              <p className="text-sm text-gray-600 mt-1">Generate GST invoices for corporate bookings</p>
            </CardHeader>
            <CardContent className="p-0">
              <DataTable
                columns={bookingColumns}
                data={bookings?.data?.filter((booking: Record<string, unknown>) => 
                  booking.corporateBooking?.corporateCompanyId
                ) || []}
                searchPlaceholder="Search bookings..."
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Quick Calculator Modal */}
      <Modal isOpen={showCalculatorModal} onClose={() => setShowCalculatorModal(false)} title="Quick GST Calculator">
        <div className="space-y-4">
          <Input
            type="number"
            step="0.01"
            placeholder="Enter base amount"
            value={calculatorForm.amount}
            onChange={(e) => setCalculatorForm(prev => ({ ...prev, amount: e.target.value }))}
          />
          <div className="flex justify-end space-x-3">
            <Button variant="outline" onClick={() => setShowCalculatorModal(false)}>
              Close
            </Button>
            <Button onClick={() => {
              calculateGST();
              setShowCalculatorModal(false);
            }}>
              Calculate
            </Button>
          </div>
        </div>
      </Modal>

      {/* Invoice Preview Modal */}
      <Modal 
        isOpen={showInvoiceModal} 
        onClose={() => setShowInvoiceModal(false)} 
        title="Invoice Preview"
        size="lg"
      >
        {invoiceData && (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-2xl font-bold">GST Invoice</h2>
              <div className="text-sm text-gray-600 mt-1">
                Invoice #: {invoiceData.invoiceNumber} | Date: {formatDate(invoiceData.invoiceDate)}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div>
                <h3 className="font-semibold text-gray-800 mb-2">Billed To:</h3>
                <div className="text-sm space-y-1">
                  <div className="font-medium">{invoiceData.billingDetails?.company?.name}</div>
                  <div>{invoiceData.billingDetails?.company?.address}</div>
                  <div>GST: {invoiceData.billingDetails?.company?.gstNumber}</div>
                </div>
              </div>
              <div>
                <h3 className="font-semibold text-gray-800 mb-2">Billed From:</h3>
                <div className="text-sm space-y-1">
                  <div className="font-medium">{invoiceData.billingDetails?.hotel?.name}</div>
                  <div>{invoiceData.billingDetails?.hotel?.address}</div>
                  <div>GST: {invoiceData.billingDetails?.hotel?.gstNumber}</div>
                </div>
              </div>
            </div>

            <div>
              <h3 className="font-semibold text-gray-800 mb-3">Invoice Items:</h3>
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left p-3 text-sm font-medium">Description</th>
                      <th className="text-right p-3 text-sm font-medium">Qty</th>
                      <th className="text-right p-3 text-sm font-medium">Rate</th>
                      <th className="text-right p-3 text-sm font-medium">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoiceData.items?.map((item, index) => (
                      <tr key={`invoice-item-${index}-${item.description}`} className="border-t">
                        <td className="p-3 text-sm">{item.description}</td>
                        <td className="p-3 text-sm text-right">{item.quantity}</td>
                        <td className="p-3 text-sm text-right">{formatCurrency(item.unitPrice)}</td>
                        <td className="p-3 text-sm text-right">{formatCurrency(item.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="border-t pt-4">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span>{formatCurrency(invoiceData.gstCalculation?.baseAmount || 0)}</span>
                </div>
                {invoiceData.gstCalculation?.cgstAmount > 0 && (
                  <div className="flex justify-between">
                    <span>CGST ({invoiceData.gstCalculation.gstRate/2}%):</span>
                    <span>{formatCurrency(invoiceData.gstCalculation.cgstAmount)}</span>
                  </div>
                )}
                {invoiceData.gstCalculation?.sgstAmount > 0 && (
                  <div className="flex justify-between">
                    <span>SGST ({invoiceData.gstCalculation.gstRate/2}%):</span>
                    <span>{formatCurrency(invoiceData.gstCalculation.sgstAmount)}</span>
                  </div>
                )}
                {invoiceData.gstCalculation?.igstAmount > 0 && (
                  <div className="flex justify-between">
                    <span>IGST ({invoiceData.gstCalculation.gstRate}%):</span>
                    <span>{formatCurrency(invoiceData.gstCalculation.igstAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-lg border-t pt-2">
                  <span>Total Amount:</span>
                  <span>{formatCurrency(invoiceData.totalAmount || 0)}</span>
                </div>
              </div>
            </div>

            <div className="flex justify-end space-x-3">
              <Button variant="outline" onClick={() => setShowInvoiceModal(false)}>
                Close
              </Button>
              <Button onClick={() => window.print()}>
                Print Invoice
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default withErrorBoundary(GSTManagement, { level: 'component' });