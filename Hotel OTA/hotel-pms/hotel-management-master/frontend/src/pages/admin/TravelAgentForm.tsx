import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Save, Building2 } from 'lucide-react';
import { useProperty } from '../../context/PropertyContext';
import { PropertyBreadcrumb } from '../../components/common/PropertyBreadcrumb';
import { travelAgentService } from '../../services/travelAgentService';
import toast from 'react-hot-toast';
import { withErrorBoundary } from '../../components/ErrorBoundary';

interface AgentFormData {
  companyName: string;
  contactPerson: string;
  phone: string;
  email: string;
  address: { street: string; city: string; state: string; country: string; zipCode: string };
  businessDetails: { licenseNumber: string; gstNumber: string; businessType: string; establishedYear: number };
  commissionStructure: { defaultRate: number };
  bookingLimits: { maxBookingsPerDay: number; maxRoomsPerBooking: number; maxAdvanceBookingDays: number };
  paymentTerms: { creditLimit: number; paymentDueDays: number; preferredPaymentMethod: string };
}

const defaultForm: AgentFormData = {
  companyName: '',
  contactPerson: '',
  phone: '',
  email: '',
  address: { street: '', city: '', state: '', country: 'India', zipCode: '' },
  businessDetails: { licenseNumber: '', gstNumber: '', businessType: 'domestic', establishedYear: new Date().getFullYear() },
  commissionStructure: { defaultRate: 10 },
  bookingLimits: { maxBookingsPerDay: 50, maxRoomsPerBooking: 10, maxAdvanceBookingDays: 365 },
  paymentTerms: { creditLimit: 0, paymentDueDays: 30, preferredPaymentMethod: 'bank_transfer' },
};

function TravelAgentForm() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { selectedPropertyId } = useProperty();
  const isEditMode = !!id;

  const [form, setForm] = useState<AgentFormData>(defaultForm);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(isEditMode);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (isEditMode && id) {
      loadAgent(id);
    }
  }, [id]);

  const loadAgent = async (agentId: string) => {
    try {
      setFetching(true);
      const agent = await travelAgentService.getTravelAgentById(agentId);
      if (agent) {
        setForm({
          companyName: agent.companyName || '',
          contactPerson: agent.contactPerson || '',
          phone: agent.phone || '',
          email: agent.email || '',
          address: { ...defaultForm.address, ...agent.address },
          businessDetails: { ...defaultForm.businessDetails, ...agent.businessDetails },
          commissionStructure: { ...defaultForm.commissionStructure, ...agent.commissionStructure },
          bookingLimits: { ...defaultForm.bookingLimits, ...agent.bookingLimits },
          paymentTerms: { ...defaultForm.paymentTerms, ...agent.paymentTerms },
        });
      }
    } catch {
      toast.error('Failed to load agent details');
      navigate('/admin/travel-dashboard');
    } finally {
      setFetching(false);
    }
  };

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!form.companyName.trim()) e.companyName = 'Company name is required';
    if (!form.contactPerson.trim()) e.contactPerson = 'Contact person is required';
    if (!form.phone.trim()) e.phone = 'Phone is required';
    if (!form.email.trim()) e.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Invalid email format';
    if (form.commissionStructure.defaultRate < 0 || form.commissionStructure.defaultRate > 50)
      e.defaultRate = 'Commission rate must be 0-50%';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    try {
      setLoading(true);
      if (isEditMode && id) {
        // Edit: send form data only, don't override hotelId
        await travelAgentService.updateTravelAgent(id, form);
        toast.success('Travel agent updated successfully');
      } else {
        // Create: include hotelId from selected property
        await travelAgentService.registerTravelAgent({ ...form, hotelId: selectedPropertyId });
        toast.success('Travel agent created successfully');
      }
      navigate('/admin/travel-dashboard');
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } }; message?: string };
      const message = axiosErr?.response?.data?.message || axiosErr?.message || 'Failed to save travel agent';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const updateField = (path: string, value: unknown) => {
    setForm(prev => {
      const parts = path.split('.');
      if (parts.length === 1) return { ...prev, [parts[0]]: value };
      const section = parts[0] as keyof AgentFormData;
      return { ...prev, [section]: { ...(prev[section] as Record<string, unknown>), [parts[1]]: value } };
    });
  };

  if (fetching) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <PropertyBreadcrumb items={['Travel Agents', isEditMode ? 'Edit Agent' : 'Add Agent']} />

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={() => navigate('/admin/travel-dashboard')}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </Button>
          <h1 className="text-2xl font-bold text-gray-900">
            {isEditMode ? 'Edit Travel Agent' : 'Add New Travel Agent'}
          </h1>
        </div>
      </div>

      {/* Basic Information */}
      <Card>
        <CardHeader><CardTitle>Basic Information</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Company Name *</label>
              <Input value={form.companyName} onChange={e => updateField('companyName', e.target.value)} placeholder="e.g., ABC Travel Agency" />
              {errors.companyName && <p className="text-red-500 text-xs mt-1">{errors.companyName}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Contact Person *</label>
              <Input value={form.contactPerson} onChange={e => updateField('contactPerson', e.target.value)} placeholder="e.g., John Smith" />
              {errors.contactPerson && <p className="text-red-500 text-xs mt-1">{errors.contactPerson}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
              <Input type="email" value={form.email} onChange={e => updateField('email', e.target.value)} placeholder="e.g., agent@company.com" />
              {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone *</label>
              <Input value={form.phone} onChange={e => updateField('phone', e.target.value)} placeholder="e.g., +91 98765 43210" />
              {errors.phone && <p className="text-red-500 text-xs mt-1">{errors.phone}</p>}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Address */}
      <Card>
        <CardHeader><CardTitle>Address</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Street</label>
            <Input value={form.address.street} onChange={e => updateField('address.street', e.target.value)} placeholder="Street address" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
              <Input value={form.address.city} onChange={e => updateField('address.city', e.target.value)} placeholder="City" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
              <Input value={form.address.state} onChange={e => updateField('address.state', e.target.value)} placeholder="State" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">ZIP Code</label>
              <Input value={form.address.zipCode} onChange={e => updateField('address.zipCode', e.target.value)} placeholder="ZIP" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Business Details */}
      <Card>
        <CardHeader><CardTitle>Business Details</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">License Number</label>
              <Input value={form.businessDetails.licenseNumber} onChange={e => updateField('businessDetails.licenseNumber', e.target.value)} placeholder="License number" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">GST Number</label>
              <Input value={form.businessDetails.gstNumber} onChange={e => updateField('businessDetails.gstNumber', e.target.value)} placeholder="GST number" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Business Type</label>
              <select className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" value={form.businessDetails.businessType} onChange={e => updateField('businessDetails.businessType', e.target.value)}>
                <option value="domestic">Domestic</option>
                <option value="international">International</option>
                <option value="both">Both</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Established Year</label>
              <Input type="number" min={1900} max={new Date().getFullYear()} value={form.businessDetails.establishedYear} onChange={e => updateField('businessDetails.establishedYear', parseInt(e.target.value) || 2020)} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Commission & Limits */}
      <Card>
        <CardHeader><CardTitle>Commission & Booking Limits</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Default Commission Rate (%)</label>
              <Input type="number" min={0} max={50} value={form.commissionStructure.defaultRate} onChange={e => updateField('commissionStructure.defaultRate', parseFloat(e.target.value) || 0)} />
              {errors.defaultRate && <p className="text-red-500 text-xs mt-1">{errors.defaultRate}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Max Bookings/Day</label>
              <Input type="number" min={1} value={form.bookingLimits.maxBookingsPerDay} onChange={e => updateField('bookingLimits.maxBookingsPerDay', parseInt(e.target.value) || 50)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Max Rooms/Booking</label>
              <Input type="number" min={1} value={form.bookingLimits.maxRoomsPerBooking} onChange={e => updateField('bookingLimits.maxRoomsPerBooking', parseInt(e.target.value) || 10)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Credit Limit (₹)</label>
              <Input type="number" min={0} value={form.paymentTerms.creditLimit} onChange={e => updateField('paymentTerms.creditLimit', parseFloat(e.target.value) || 0)} />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Payment Due (Days)</label>
              <Input type="number" min={0} value={form.paymentTerms.paymentDueDays} onChange={e => updateField('paymentTerms.paymentDueDays', parseInt(e.target.value) || 30)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Payment Method</label>
              <select className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" value={form.paymentTerms.preferredPaymentMethod} onChange={e => updateField('paymentTerms.preferredPaymentMethod', e.target.value)}>
                <option value="bank_transfer">Bank Transfer</option>
                <option value="cheque">Cheque</option>
                <option value="online">Online</option>
                <option value="cash">Cash</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex justify-end gap-3 pb-8">
        <Button variant="outline" onClick={() => navigate('/admin/travel-dashboard')}>Cancel</Button>
        <Button onClick={handleSubmit} disabled={loading} className="bg-indigo-600 hover:bg-indigo-700">
          <Save className="h-4 w-4 mr-2" />
          {loading ? 'Saving...' : isEditMode ? 'Update Agent' : 'Create Agent'}
        </Button>
      </div>
    </div>
  );
}

export default withErrorBoundary(TravelAgentForm);
