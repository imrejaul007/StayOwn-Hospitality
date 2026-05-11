import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Edit, Building2, Phone, Mail, MapPin, TrendingUp, IndianRupee, Calendar, Users } from 'lucide-react';
import { PropertyBreadcrumb } from '../../components/common/PropertyBreadcrumb';
import { travelAgentService } from '../../services/travelAgentService';
import toast from 'react-hot-toast';
import { withErrorBoundary } from '../../components/ErrorBoundary';

function TravelAgentDetail() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [agent, setAgent] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) loadAgent(id);
  }, [id]);

  const loadAgent = async (agentId: string) => {
    try {
      setLoading(true);
      const data = await travelAgentService.getTravelAgentById(agentId);
      setAgent(data);
    } catch {
      toast.error('Failed to load agent details');
      navigate('/admin/travel-dashboard');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!id) return;
    const confirmed = window.confirm(`Change agent status to "${newStatus}"?`);
    if (!confirmed) return;
    try {
      await travelAgentService.updateTravelAgentStatus(id, newStatus);
      toast.success(`Agent status updated to ${newStatus}`);
      loadAgent(id);
    } catch {
      toast.error('Failed to update status');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'inactive': return 'bg-gray-100 text-gray-800';
      case 'suspended': return 'bg-red-100 text-red-800';
      case 'pending_approval': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Agent not found</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate('/admin/travel-dashboard')}>
          Back to Dashboard
        </Button>
      </div>
    );
  }

  const perf = (agent.performanceMetrics || {}) as Record<string, unknown>;
  const address = (agent.address || {}) as Record<string, unknown>;
  const business = (agent.businessDetails || {}) as Record<string, unknown>;
  const commission = (agent.commissionStructure || {}) as Record<string, unknown>;
  const limits = (agent.bookingLimits || {}) as Record<string, unknown>;
  const payment = (agent.paymentTerms || {}) as Record<string, unknown>;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <PropertyBreadcrumb items={['Travel Agents', String(agent.companyName || 'Agent')]} />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={() => navigate('/admin/travel-dashboard')}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{String(agent.companyName)}</h1>
            <div className="flex items-center gap-2 mt-1">
              {agent.agentCode && <Badge variant="outline" className="font-mono">{String(agent.agentCode)}</Badge>}
              <Badge className={getStatusColor(String(agent.status || 'pending_approval'))}>
                {String(agent.status || 'pending_approval').replace(/_/g, ' ')}
              </Badge>
            </div>
          </div>
        </div>
        <Button onClick={() => navigate(`/admin/travel-agents/${id}/edit`)} className="bg-indigo-600 hover:bg-indigo-700">
          <Edit className="h-4 w-4 mr-2" /> Edit Agent
        </Button>
      </div>

      {/* Contact & Address */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-base">Contact Information</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2 text-sm">
              <Users className="h-4 w-4 text-gray-400" />
              <span className="font-medium">{String(agent.contactPerson || 'N/A')}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Mail className="h-4 w-4 text-gray-400" />
              <span>{String(agent.email || 'N/A')}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Phone className="h-4 w-4 text-gray-400" />
              <span>{String(agent.phone || 'N/A')}</span>
            </div>
            {address.city && (
              <div className="flex items-center gap-2 text-sm">
                <MapPin className="h-4 w-4 text-gray-400" />
                <span>{[address.street, address.city, address.state, address.country].filter(Boolean).join(', ')}</span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Business Details</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Business Type</span>
              <span className="font-medium capitalize">{String(business.businessType || 'N/A')}</span>
            </div>
            {business.licenseNumber && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">License</span>
                <span className="font-medium">{String(business.licenseNumber)}</span>
              </div>
            )}
            {business.gstNumber && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">GST</span>
                <span className="font-medium">{String(business.gstNumber)}</span>
              </div>
            )}
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Default Commission</span>
              <span className="font-medium text-green-700">{Number(commission.defaultRate || 10)}%</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Performance Metrics */}
      <Card>
        <CardHeader><CardTitle className="text-base">Performance Metrics</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <Calendar className="h-5 w-5 text-blue-600 mx-auto mb-1" />
              <div className="text-xl font-bold text-blue-700">{Number(perf.totalBookings || 0)}</div>
              <div className="text-xs text-blue-600">Total Bookings</div>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <IndianRupee className="h-5 w-5 text-green-600 mx-auto mb-1" />
              <div className="text-xl font-bold text-green-700">₹{Number(perf.totalRevenue || 0).toLocaleString('en-IN')}</div>
              <div className="text-xs text-green-600">Total Revenue</div>
            </div>
            <div className="text-center p-4 bg-purple-50 rounded-lg">
              <TrendingUp className="h-5 w-5 text-purple-600 mx-auto mb-1" />
              <div className="text-xl font-bold text-purple-700">₹{Number(perf.totalCommissionEarned || 0).toLocaleString('en-IN')}</div>
              <div className="text-xs text-purple-600">Commission Earned</div>
            </div>
            <div className="text-center p-4 bg-orange-50 rounded-lg">
              <IndianRupee className="h-5 w-5 text-orange-600 mx-auto mb-1" />
              <div className="text-xl font-bold text-orange-700">₹{Number(perf.averageBookingValue || 0).toLocaleString('en-IN')}</div>
              <div className="text-xs text-orange-600">Avg Booking Value</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Booking Limits & Payment Terms */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-base">Booking Limits</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between text-sm"><span className="text-gray-600">Max Bookings/Day</span><span className="font-medium">{Number(limits.maxBookingsPerDay || 50)}</span></div>
            <div className="flex justify-between text-sm"><span className="text-gray-600">Max Rooms/Booking</span><span className="font-medium">{Number(limits.maxRoomsPerBooking || 10)}</span></div>
            <div className="flex justify-between text-sm"><span className="text-gray-600">Max Advance Days</span><span className="font-medium">{Number(limits.maxAdvanceBookingDays || 365)}</span></div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Payment Terms</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between text-sm"><span className="text-gray-600">Credit Limit</span><span className="font-medium">₹{Number(payment.creditLimit || 0).toLocaleString('en-IN')}</span></div>
            <div className="flex justify-between text-sm"><span className="text-gray-600">Payment Due</span><span className="font-medium">{Number(payment.paymentDueDays || 30)} days</span></div>
            <div className="flex justify-between text-sm"><span className="text-gray-600">Payment Method</span><span className="font-medium capitalize">{String(payment.preferredPaymentMethod || 'bank_transfer').replace(/_/g, ' ')}</span></div>
          </CardContent>
        </Card>
      </div>

      {/* Status Actions */}
      <Card>
        <CardHeader><CardTitle className="text-base">Status Management</CardTitle></CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            {agent.status !== 'active' && (
              <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => handleStatusChange('active')}>Activate</Button>
            )}
            {agent.status !== 'suspended' && agent.status !== 'inactive' && (
              <Button size="sm" variant="outline" className="text-orange-600 border-orange-300 hover:bg-orange-50" onClick={() => handleStatusChange('suspended')}>Suspend</Button>
            )}
            {agent.status !== 'inactive' && (
              <Button size="sm" variant="outline" className="text-red-600 border-red-300 hover:bg-red-50" onClick={() => handleStatusChange('inactive')}>Deactivate</Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default withErrorBoundary(TravelAgentDetail);
