import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  ClipboardList,
  Users,
  CreditCard,
  IndianRupee,
  Clock,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  Search,
  Eye,
  Package,
  Receipt,
  TrendingUp,
  Calendar,
  Wifi,
  WifiOff
} from 'lucide-react';
import { useProperty } from '../../context/PropertyContext';
import { PropertyBreadcrumb } from '../../components/common/PropertyBreadcrumb';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { checkoutInventoryService, CheckoutInventory } from '../../services/checkoutInventoryService';
import { useRealTime } from '../../services/realTimeService';
import { formatDate, formatCurrency } from '../../utils/formatters';
import toast from 'react-hot-toast';
import { CheckoutInventoryDetails } from '../../components/staff/CheckoutInventoryDetails';
import { withErrorBoundary } from '../../components/ErrorBoundary';

interface Staff {
  _id: string;
  name: string;
  email: string;
  role: string;
}

interface AdminOverview {
  totalChecks: number;
  pendingChecks: number;
  completedChecks: number;
  paidChecks: number;
  totalRevenue: number;
  pendingPayments: number;
  averageCheckValue: number;
  checksToday: number;
  recentChecks: CheckoutInventory[];
  staffPerformance: Array<{
    staff: Staff;
    totalChecks: number;
    totalRevenue: number;
    averageValue: number;
    recentActivity: string;
  }>;
}

function AdminCheckoutInventoryManagement() {
  const { selectedPropertyId, selectedProperty, viewMode } = useProperty();
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [allChecks, setAllChecks] = useState<CheckoutInventory[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterPayment, setFilterPayment] = useState('all');
  const [activeTab, setActiveTab] = useState<'overview' | 'checks' | 'analytics'>('overview');
  const [selectedCheck, setSelectedCheck] = useState<CheckoutInventory | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  // Real-time connection
  const { connectionState, connect, disconnect, on, off, isConnected } = useRealTime();

  useEffect(() => {
    if (!selectedPropertyId) return;
    fetchData();
    
    // Connect to real-time updates
    // Do NOT disconnect on unmount — realTimeService is a singleton shared across components
    connect().catch(() => { /* Error handled silently */ });
  }, [selectedPropertyId]);

  // Set up real-time event listeners
  useEffect(() => {
    if (!isConnected) return;
    
    const handleCheckoutInventoryCreated = (data: Record<string, unknown>) => {
      fetchData();
      toast.success(`New checkout inventory check created for Room ${data.roomNumber}`);
    };
    
    const handleCheckoutInventoryCompleted = (data: Record<string, unknown>) => {
      fetchData();
      toast.success(`Checkout inventory check completed for Room ${data.roomNumber}`);
    };
    
    const handlePaymentProcessed = (data: Record<string, unknown>) => {
      fetchData();
      toast.success(`Payment processed: ${formatCurrency(Number(data.amount) || 0)} for Room ${data.roomNumber || 'unknown'}`);
    };
    
    const handleCheckoutInventoryUpdated = (data: Record<string, unknown>) => {
      fetchData();
      toast.info(`Checkout inventory updated for Room ${data.roomNumber}`);
    };
    
    // Subscribe to checkout inventory events
    on('checkout-inventory:created', handleCheckoutInventoryCreated);
    on('checkout-inventory:completed', handleCheckoutInventoryCompleted);
    on('checkout-inventory:payment_processed', handlePaymentProcessed);
    on('checkout-inventory:updated', handleCheckoutInventoryUpdated);
    
    return () => {
      off('checkout-inventory:created', handleCheckoutInventoryCreated);
      off('checkout-inventory:completed', handleCheckoutInventoryCompleted);
      off('checkout-inventory:payment_processed', handlePaymentProcessed);
      off('checkout-inventory:updated', handleCheckoutInventoryUpdated);
    };
  }, [isConnected, on, off]);

  const fetchData = async () => {
    if (!selectedPropertyId) return;

    try {
      setLoading(true);

      // Fetch all checkout inventories and calculate overview data
      const response = await checkoutInventoryService.getCheckoutInventories({
        limit: 100,
        hotelId: selectedPropertyId
      });
      const checks = response.data.checkoutInventories || [];
      setAllChecks(checks);
      
      // Calculate overview statistics
      const totalChecks = checks.length;
      const pendingChecks = checks.filter(c => c.status === 'pending').length;
      const completedChecks = checks.filter(c => c.status === 'completed').length;
      const paidChecks = checks.filter(c => c.paymentStatus === 'paid').length;
      const totalRevenue = checks.reduce((sum, c) => sum + (c.paymentStatus === 'paid' ? c.totalAmount : 0), 0);
      const pendingPayments = checks.filter(c => c.status === 'completed' && c.paymentStatus === 'pending').length;
      const averageCheckValue = paidChecks > 0 ? totalRevenue / paidChecks : 0;
      
      const today = new Date().toDateString();
      const checksToday = checks.filter(c => new Date(c.checkedAt).toDateString() === today).length;
      
      const recentChecks = checks
        .sort((a, b) => new Date(b.checkedAt).getTime() - new Date(a.checkedAt).getTime())
        .slice(0, 10);
      
      // Calculate staff performance
      const staffMap = new Map();
      checks.forEach(check => {
        const staffId = check.checkedBy._id;
        if (!staffMap.has(staffId)) {
          staffMap.set(staffId, {
            staff: check.checkedBy,
            totalChecks: 0,
            totalRevenue: 0,
            recentActivity: check.checkedAt
          });
        }
        const staffData = staffMap.get(staffId);
        staffData.totalChecks += 1;
        staffData.totalRevenue += check.paymentStatus === 'paid' ? check.totalAmount : 0;
        if (new Date(check.checkedAt) > new Date(staffData.recentActivity)) {
          staffData.recentActivity = check.checkedAt;
        }
      });
      
      const staffPerformance = Array.from(staffMap.values()).map(staff => ({
        ...staff,
        averageValue: staff.totalChecks > 0 ? staff.totalRevenue / staff.totalChecks : 0
      })).sort((a, b) => b.totalRevenue - a.totalRevenue);
      
      setOverview({
        totalChecks,
        pendingChecks,
        completedChecks,
        paidChecks,
        totalRevenue,
        pendingPayments,
        averageCheckValue,
        checksToday,
        recentChecks,
        staffPerformance
      });
      
    } catch (error) {
      toast.error('Failed to load checkout inventory management data');
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetails = (check: CheckoutInventory) => {
    setSelectedCheck(check);
    setShowDetails(true);
  };

  const handleDetailsClose = () => {
    setShowDetails(false);
    setSelectedCheck(null);
    fetchData(); // Refresh data in case of updates
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-blue-100 text-blue-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'paid': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getPaymentStatusColor = (status: string) => {
    switch (status) {
      case 'paid': return 'bg-green-100 text-green-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'failed': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const filteredChecks = allChecks.filter(check => {
    const matchesSearch = 
      check.bookingId.bookingNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      check.roomId.roomNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      check.checkedBy.name.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = filterStatus === 'all' || check.status === filterStatus;
    const matchesPayment = filterPayment === 'all' || check.paymentStatus === filterPayment;
    
    return matchesSearch && matchesStatus && matchesPayment;
  });

  if (!selectedPropertyId && viewMode === 'single') {
    return <div className="p-6">Please select a property</div>;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/30">
      <div className="p-3 sm:p-4 md:p-6 max-w-7xl mx-auto">
        <PropertyBreadcrumb items={['Checkout Inventory Management']} />

        {/* Modern Header with Gradient */}
        <div className="relative mb-8">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-600/10 via-indigo-600/10 to-purple-600/10 rounded-3xl blur-3xl"></div>
          <div className="relative bg-white/80 backdrop-blur-sm border border-white/20 rounded-3xl p-4 sm:p-6 lg:p-8 shadow-xl">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 sm:gap-6">
              <div className="flex-1">
                <div className="flex items-center gap-3 sm:gap-4 mb-4">
                  <div className="p-2 sm:p-3 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-2xl">
                    <ClipboardList className="h-6 w-6 sm:h-8 sm:w-8 text-white" />
                  </div>
                  <div>
                    <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent">
                      Checkout Inventory Management
                    </h1>
                    <p className="text-gray-600 text-sm sm:text-base mt-2">
                      Oversee guest checkout inventory checks and billing administration
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4">
                {/* Real-time connection status */}
                <div className={`flex items-center px-3 sm:px-4 py-2 rounded-2xl text-xs sm:text-sm font-semibold transition-all duration-200 ${
                  isConnected 
                    ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white shadow-lg' 
                    : 'bg-gradient-to-r from-red-500 to-rose-500 text-white shadow-lg'
                }`}>
                  {isConnected ? (
                    <><Wifi className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" /> Live Updates</>
                  ) : (
                    <><WifiOff className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" /> Offline</>
                  )}
                </div>
                
                <Button 
                  onClick={fetchData} 
                  variant="outline" 
                  size="sm" 
                  disabled={loading}
                  className="bg-white/80 backdrop-blur-sm border-2 border-gray-200 hover:border-blue-300 rounded-2xl px-4 sm:px-6 py-2 font-semibold transition-all duration-200 transform hover:scale-105 text-xs sm:text-sm"
                >
                  <RefreshCw className={`w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2 ${loading ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Modern Tab Navigation */}
        <div className="mb-6 sm:mb-8">
          <div className="bg-white/60 backdrop-blur-sm border border-white/20 rounded-2xl p-1 sm:p-2 shadow-lg">
            <nav className="flex space-x-1 sm:space-x-2">
              {[
                { id: 'overview', label: 'Overview', icon: ClipboardList },
                { id: 'checks', label: 'All Checks', icon: Package },
                { id: 'analytics', label: 'Analytics', icon: TrendingUp }
              ].map(({ id, label, icon: Icon }) => (
                <button aria-label="Close"
                  key={id}
                  onClick={() => setActiveTab(id as unknown)}
                  className={`flex-1 py-2 sm:py-3 px-2 sm:px-4 rounded-xl font-semibold text-xs sm:text-sm flex items-center justify-center space-x-1 sm:space-x-2 transition-all duration-200 ${
                    activeTab === id
                      ? 'bg-gradient-to-r from-blue-500 to-indigo-500 text-white shadow-lg transform scale-105'
                      : 'text-gray-600 hover:text-gray-800 hover:bg-white/50'
                  }`}
                >
                  <Icon className="w-3 h-3 sm:w-4 sm:h-4" />
                  <span className="hidden xs:inline">{label}</span>
                  <span className="xs:hidden">{label.split(' ')[0]}</span>
                </button>
              ))}
            </nav>
          </div>
        </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && overview && (
        <div className="space-y-6">
          {/* Enhanced Metrics Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            {/* Total Checks Card */}
            <div className="bg-white rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 p-6 border border-gray-100">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="p-3 bg-blue-100 rounded-xl">
                    <ClipboardList className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-600">Total Checks</p>
                    <p className="text-2xl font-bold text-gray-900">{overview.totalChecks}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Total Revenue Card */}
            <div className="bg-white rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 p-6 border border-gray-100">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="p-3 bg-green-100 rounded-xl">
                    <IndianRupee className="w-6 h-6 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-600">Total Revenue</p>
                    <p className="text-2xl font-bold text-gray-900">{formatCurrency(overview.totalRevenue)}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Pending Payments Card */}
            <div className="bg-white rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 p-6 border border-gray-100">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="p-3 bg-yellow-100 rounded-xl">
                    <Clock className="w-6 h-6 text-yellow-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-600">Pending Payments</p>
                    <p className="text-2xl font-bold text-gray-900">{overview.pendingPayments}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Average Check Value Card */}
            <div className="bg-white rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 p-6 border border-gray-100">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="p-3 bg-purple-100 rounded-xl">
                    <TrendingUp className="w-6 h-6 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-600">Avg. Check Value</p>
                    <p className="text-2xl font-bold text-gray-900">{formatCurrency(overview.averageCheckValue)}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Recent Activity & Staff Performance */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Recent Checkout Checks */}
            <div className="bg-white/90 backdrop-blur-sm border-0 shadow-xl rounded-3xl overflow-hidden">
              <div className="bg-gradient-to-r from-blue-500 to-indigo-500 p-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white/20 rounded-xl">
                    <Receipt className="h-6 w-6 text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-white">Recent Checkout Checks</h3>
                </div>
              </div>
              <div className="p-6">
                <div className="space-y-4">
                  {overview.recentChecks.length > 0 ? (
                    overview.recentChecks.slice(0, 5).map((check) => (
                      <div key={check._id} className="bg-gradient-to-r from-gray-50 to-gray-100/50 rounded-2xl p-4 border border-gray-200/50 hover:shadow-lg transition-all duration-200">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <span className="font-bold text-gray-900">Room {check.roomId.roomNumber}</span>
                              <Badge className={`${getStatusColor(check.status)} rounded-full px-3 py-1 text-xs font-semibold`}>
                                {check.status}
                              </Badge>
                              <Badge className={`${getPaymentStatusColor(check.paymentStatus)} rounded-full px-3 py-1 text-xs font-semibold`}>
                                {check.paymentStatus}
                              </Badge>
                            </div>
                            <p className="text-sm text-gray-600 mb-1">
                              By <span className="font-semibold">{check.checkedBy.name}</span> • {formatDate(check.checkedAt)}
                            </p>
                            <p className="text-lg font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
                              {formatCurrency(check.totalAmount)}
                            </p>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleViewDetails(check)}
                            className="bg-white/80 backdrop-blur-sm border-2 border-gray-200 hover:border-blue-300 rounded-xl px-4 py-2 transition-all duration-200 transform hover:scale-105"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-12 text-gray-500">
                      <div className="p-4 bg-gray-100 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                        <Package className="h-8 w-8 text-gray-400" />
                      </div>
                      <p className="text-lg font-semibold">No checkout checks found</p>
                      <p className="text-sm">Recent activity will appear here</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Staff Performance */}
            <div className="bg-white/90 backdrop-blur-sm border-0 shadow-xl rounded-3xl overflow-hidden">
              <div className="bg-gradient-to-r from-purple-500 to-violet-500 p-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white/20 rounded-xl">
                    <Users className="h-6 w-6 text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-white">Staff Performance</h3>
                </div>
              </div>
              <div className="p-6">
                <div className="space-y-4">
                  {overview.staffPerformance.length > 0 ? (
                    overview.staffPerformance.slice(0, 5).map((staff, index) => (
                      <div key={staff.staff._id} className="bg-gradient-to-r from-gray-50 to-gray-100/50 rounded-2xl p-4 border border-gray-200/50 hover:shadow-lg transition-all duration-200">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <span className="font-bold text-gray-900">{staff.staff.name}</span>
                              <Badge className="bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-full px-3 py-1 text-xs font-semibold">
                                {staff.totalChecks} checks
                              </Badge>
                            </div>
                            <div className="grid grid-cols-2 gap-4 text-sm">
                              <div>
                                <p className="text-gray-600">Revenue</p>
                                <p className="font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
                                  {formatCurrency(staff.totalRevenue)}
                                </p>
                              </div>
                              <div>
                                <p className="text-gray-600">Average</p>
                                <p className="font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                                  {formatCurrency(staff.averageValue)}
                                </p>
                              </div>
                            </div>
                            <p className="text-xs text-gray-500 mt-2">Last activity: {formatDate(staff.recentActivity)}</p>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-12 text-gray-500">
                      <div className="p-4 bg-gray-100 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                        <Users className="h-8 w-8 text-gray-400" />
                      </div>
                      <p className="text-lg font-semibold">No staff performance data</p>
                      <p className="text-sm">Performance metrics will appear here</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* All Checks Tab */}
      {activeTab === 'checks' && (
        <div className="space-y-6">
            {/* Modern Search and Filters */}
            <div className="bg-white/90 backdrop-blur-sm border-0 shadow-xl rounded-3xl p-6">
              <div className="flex flex-col lg:flex-row gap-4">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                    <Input
                      placeholder="Search by booking, room, or staff..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-12 p-4 border-2 border-gray-200 rounded-2xl bg-white/80 backdrop-blur-sm focus:border-blue-300 focus:ring-0"
                    />
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-3">
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="p-4 border-2 border-gray-200 rounded-2xl bg-white/80 backdrop-blur-sm focus:border-blue-300 focus:ring-0 font-semibold"
                  >
                    <option value="all">All Status</option>
                    <option value="pending">Pending</option>
                    <option value="completed">Completed</option>
                  </select>
                  <select
                    value={filterPayment}
                    onChange={(e) => setFilterPayment(e.target.value)}
                    className="p-4 border-2 border-gray-200 rounded-2xl bg-white/80 backdrop-blur-sm focus:border-blue-300 focus:ring-0 font-semibold"
                  >
                    <option value="all">All Payments</option>
                    <option value="pending">Payment Pending</option>
                    <option value="paid">Paid</option>
                    <option value="failed">Failed</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Modern Checkout Checks List */}
            <div className="space-y-6">
              {filteredChecks.length > 0 ? (
                filteredChecks.map((check) => (
                  <div key={check._id} className="bg-white/90 backdrop-blur-sm border-0 shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:scale-[1.01] rounded-3xl overflow-hidden">
                    <div className="p-6">
                      <div className="flex flex-col lg:flex-row lg:justify-between lg:items-start gap-6">
                        <div className="flex-1">
                          <div className="flex flex-wrap items-center gap-3 mb-4">
                            <h3 className="text-xl font-bold text-gray-900">
                              Booking #{check.bookingId.bookingNumber}
                            </h3>
                            <Badge className={`${getStatusColor(check.status)} rounded-full px-4 py-2 text-sm font-semibold`}>
                              {check.status}
                            </Badge>
                            <Badge className={`${getPaymentStatusColor(check.paymentStatus)} rounded-full px-4 py-2 text-sm font-semibold`}>
                              {check.paymentStatus}
                            </Badge>
                          </div>
                          
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-4">
                            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-4">
                              <p className="text-sm font-semibold text-gray-600 mb-1">Room</p>
                              <p className="text-lg font-bold text-gray-900">{check.roomId.roomNumber}</p>
                              <p className="text-sm text-gray-500">({check.roomId.type})</p>
                            </div>
                            <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl p-4">
                              <p className="text-sm font-semibold text-gray-600 mb-1">Checked By</p>
                              <p className="text-lg font-bold text-gray-900">{check.checkedBy.name}</p>
                              <p className="text-sm text-gray-500">Staff Member</p>
                            </div>
                            <div className="bg-gradient-to-br from-purple-50 to-violet-50 rounded-2xl p-4">
                              <p className="text-sm font-semibold text-gray-600 mb-1">Items</p>
                              <p className="text-lg font-bold text-gray-900">{check.items.length} items</p>
                              <p className="text-sm text-gray-500">Inventory checked</p>
                            </div>
                            <div className="bg-gradient-to-br from-yellow-50 to-amber-50 rounded-2xl p-4">
                              <p className="text-sm font-semibold text-gray-600 mb-1">Total Amount</p>
                              <p className="text-lg font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
                                {formatCurrency(check.totalAmount)}
                              </p>
                              <p className="text-sm text-gray-500">Final bill</p>
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-6 text-sm text-gray-500 bg-gray-50 rounded-2xl p-4">
                            <div className="flex items-center gap-2">
                              <Calendar className="h-4 w-4" />
                              <span>Checked: {formatDate(check.checkedAt)}</span>
                            </div>
                            {check.paidAt && (
                              <div className="flex items-center gap-2">
                                <CreditCard className="h-4 w-4" />
                                <span>Paid: {formatDate(check.paidAt)}</span>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-col sm:flex-row gap-3">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleViewDetails(check)}
                            className="bg-white/80 backdrop-blur-sm border-2 border-gray-200 hover:border-blue-300 rounded-2xl px-6 py-3 font-semibold transition-all duration-200 transform hover:scale-105"
                          >
                            <Eye className="h-4 w-4 mr-2" />
                            View Details
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="bg-white/90 backdrop-blur-sm border-0 shadow-xl rounded-3xl p-12 text-center">
                  <div className="p-6 bg-gradient-to-br from-gray-100 to-gray-200 rounded-full w-24 h-24 mx-auto mb-6 flex items-center justify-center">
                    <Package className="h-12 w-12 text-gray-400" />
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-3">No checkout inventories found</h3>
                  <p className="text-gray-600 text-lg">
                    {searchTerm || filterStatus !== 'all' || filterPayment !== 'all' 
                      ? 'Try adjusting your search or filters'
                      : 'No checkout inventory checks have been created yet'
                    }
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Analytics Tab */}
        {activeTab === 'analytics' && overview && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Modern Quick Stats */}
              <div className="bg-white/90 backdrop-blur-sm border-0 shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:scale-[1.02] rounded-3xl p-6 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-blue-500/20 to-indigo-500/20 rounded-full -translate-y-10 translate-x-10"></div>
                <div className="relative text-center">
                  <div className="p-3 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-2xl w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                    <Calendar className="h-8 w-8 text-white" />
                  </div>
                  <p className="text-sm font-semibold text-gray-600 mb-2">Today's Checks</p>
                  <p className="text-3xl font-bold text-gray-900">{overview.checksToday}</p>
                </div>
              </div>
              
              <div className="bg-white/90 backdrop-blur-sm border-0 shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:scale-[1.02] rounded-3xl p-6 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-green-500/20 to-emerald-500/20 rounded-full -translate-y-10 translate-x-10"></div>
                <div className="relative text-center">
                  <div className="p-3 bg-gradient-to-br from-green-500 to-emerald-500 rounded-2xl w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                    <CheckCircle className="h-8 w-8 text-white" />
                  </div>
                  <p className="text-sm font-semibold text-gray-600 mb-2">Completion Rate</p>
                  <p className="text-3xl font-bold text-gray-900">
                    {overview.totalChecks > 0 ? Math.round((overview.completedChecks / overview.totalChecks) * 100) : 0}%
                  </p>
                </div>
              </div>
              
              <div className="bg-white/90 backdrop-blur-sm border-0 shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:scale-[1.02] rounded-3xl p-6 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-purple-500/20 to-violet-500/20 rounded-full -translate-y-10 translate-x-10"></div>
                <div className="relative text-center">
                  <div className="p-3 bg-gradient-to-br from-purple-500 to-violet-500 rounded-2xl w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                    <CreditCard className="h-8 w-8 text-white" />
                  </div>
                  <p className="text-sm font-semibold text-gray-600 mb-2">Payment Rate</p>
                  <p className="text-3xl font-bold text-gray-900">
                    {overview.completedChecks > 0 ? Math.round((overview.paidChecks / overview.completedChecks) * 100) : 0}%
                  </p>
                </div>
              </div>
            </div>

            {/* Modern Analytics placeholder */}
            <div className="bg-white/90 backdrop-blur-sm border-0 shadow-xl rounded-3xl overflow-hidden">
              <div className="bg-gradient-to-r from-indigo-500 to-purple-500 p-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white/20 rounded-xl">
                    <TrendingUp className="h-6 w-6 text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-white">Revenue Analytics</h3>
                </div>
              </div>
              <div className="p-12 text-center">
                <div className="p-6 bg-gradient-to-br from-gray-100 to-gray-200 rounded-full w-24 h-24 mx-auto mb-6 flex items-center justify-center">
                  <TrendingUp className="h-12 w-12 text-gray-400" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-3">Advanced Analytics</h3>
                <p className="text-gray-600 text-lg">Detailed revenue analytics and trends will be available here</p>
              </div>
            </div>
          </div>
        )}

        {/* Details Modal */}
        {showDetails && selectedCheck && (
          <CheckoutInventoryDetails
            inventory={selectedCheck}
            onSuccess={handleDetailsClose}
            onClose={handleDetailsClose}
          />
        )}
      </div>
    </div>
  );
}

export default withErrorBoundary(AdminCheckoutInventoryManagement, { level: 'page' });