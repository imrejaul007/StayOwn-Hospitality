import React, { useState, useEffect } from 'react';
import {
  Calendar,
  Users,
  Banknote,
  TrendingUp,
  Building,
  CreditCard,
  FileText,
  Plus,
  Search,
  Filter,
  Download,
  Eye,
  Edit,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  BarChart3,
  PieChart,
  Activity,
  Bell
} from 'lucide-react';
import { motion } from 'framer-motion';
import { format, subDays, subMonths } from 'date-fns';
import { useNavigate, useLocation } from 'react-router-dom';
import { travelAgentService, TravelAgentBooking, TravelAgent } from '../../services/travelAgentService';
import { toast } from 'sonner';
import BookingTrendsChart, { BookingTrend } from '../../components/analytics/BookingTrendsChart';
import CommissionChart, { CommissionData } from '../../components/analytics/CommissionChart';
import RevenueChart, { RevenueData } from '../../components/analytics/RevenueChart';
import DateRangeSelector, { DateRange } from '../../components/filters/DateRangeSelector';
import MultiCriteriaFilter, { FilterCriteria, FilterField } from '../../components/filters/MultiCriteriaFilter';
import SavedFiltersManager, { SavedFilter } from '../../components/filters/SavedFiltersManager';
import ExportOptionsModal, { ExportOptions } from '../../components/filters/ExportOptionsModal';
import RealTimeUpdater from '../../components/realtime/RealTimeUpdater';
import NotificationCenter, { Notification } from '../../components/realtime/NotificationCenter';
import { withErrorBoundary } from '../../components/ErrorBoundary';

const TravelAgentDashboard: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<TravelAgent | null>(null);
  const [bookings, setBookings] = useState<TravelAgentBooking[]>([]);
  const [stats, setStats] = useState({
    totalBookings: 0,
    totalRevenue: 0,
    pendingCommission: 0,
    paidCommission: 0,
    activeBookings: 0,
    completedBookings: 0
  });
  
  // Determine initial tab based on current URL
  const getInitialTab = (): 'overview' | 'bookings' | 'commission' | 'analytics' | 'profile' => {
    // Check for tab query parameter
    const urlParams = new URLSearchParams(location.search);
    const tabParam = urlParams.get('tab');
    if (tabParam && ['overview', 'bookings', 'commission', 'analytics', 'profile'].includes(tabParam)) {
      return tabParam as unknown;
    }
    
    return 'overview';
  };
  
  const [selectedTab, setSelectedTab] = useState<'overview' | 'bookings' | 'commission' | 'analytics' | 'profile'>(getInitialTab());
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [dateRange, setDateRange] = useState<DateRange>({
    start: format(subDays(new Date(), 30), 'yyyy-MM-dd'),
    end: format(new Date(), 'yyyy-MM-dd'),
    label: 'Last 30 days'
  });
  const [timeRange, setTimeRange] = useState<'week' | 'month' | 'quarter' | 'year'>('month');
  const [analyticsData, setAnalyticsData] = useState({
    bookingTrends: [] as BookingTrend[],
    commissionData: [] as CommissionData[],
    revenueData: [] as RevenueData[]
  });
  const [filterCriteria, setFilterCriteria] = useState<FilterCriteria[]>([]);
  const [savedFilters, setSavedFilters] = useState<SavedFilter[]>([]);
  const [showExportModal, setShowExportModal] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [realTimeEnabled, setRealTimeEnabled] = useState(true);

  useEffect(() => {
    fetchDashboardData();
    loadSavedFilters();
    initializeNotifications();
  }, []);

  // Update tab when URL changes
  useEffect(() => {
    const newTab = getInitialTab();
    setSelectedTab(newTab);
  }, [location.pathname]);

  useEffect(() => {
    if (selectedTab === 'analytics') {
      fetchAnalyticsData();
    }
  }, [selectedTab, timeRange, dateRange]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);

      // Fetch agent profile
      const agentProfile = await travelAgentService.getMyTravelAgentProfile();
      setProfile(agentProfile);

      // Fetch bookings
      const bookingsData = await travelAgentService.getMyBookings();
      const safeBookings = bookingsData?.bookings || [];
      setBookings(safeBookings);

      // Calculate stats with safe data
      calculateStats(safeBookings, agentProfile || null);
    } catch (error) {
      toast.error('Failed to load dashboard data');
      
      // Set default values on error
      setBookings([]);
      setProfile(null);
      setStats({
        totalBookings: 0,
        totalRevenue: 0,
        pendingCommission: 0,
        paidCommission: 0,
        activeBookings: 0,
        completedBookings: 0
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchAnalyticsData = async () => {
    try {
      const analyticsResult = await travelAgentService.getTravelAnalytics({
        startDate: dateRange.start,
        endDate: dateRange.end,
      });

      if (analyticsResult) {
        const raw = analyticsResult as Record<string, unknown>;
        setAnalyticsData({
          bookingTrends: (raw.bookingTrends as BookingTrend[]) || [],
          commissionData: (raw.commissionData as CommissionData[]) || [],
          revenueData: (raw.revenueData as RevenueData[]) || []
        });
      } else {
        setAnalyticsData({ bookingTrends: [], commissionData: [], revenueData: [] });
      }
    } catch (error) {
      // On error, show empty data rather than fabricated data
      setAnalyticsData({ bookingTrends: [], commissionData: [], revenueData: [] });
    }
  };

  const calculateStats = (bookings: TravelAgentBooking[], agent: TravelAgent | null) => {
    // Add null checks to prevent errors
    const safeBookings = bookings || [];
    
    const stats = {
      totalBookings: safeBookings.length,
      totalRevenue: safeBookings.reduce((sum, b) => sum + (b.pricing?.totalAmount || 0), 0),
      pendingCommission: safeBookings
        .filter(b => b.commission?.paymentStatus === 'pending')
        .reduce((sum, b) => sum + (b.commission?.amount || 0) + (b.commission?.bonusAmount || 0), 0),
      paidCommission: safeBookings
        .filter(b => b.commission?.paymentStatus === 'paid')
        .reduce((sum, b) => sum + (b.commission?.amount || 0) + (b.commission?.bonusAmount || 0), 0),
      activeBookings: safeBookings.filter(b => b.bookingStatus === 'confirmed').length,
      completedBookings: safeBookings.filter(b => b.bookingStatus === 'completed').length
    };
    setStats(stats);
  };

  const loadSavedFilters = async () => {
    try {
      // Mock saved filters - replace with actual API call
      setSavedFilters([]);
    } catch {
      // Error handled silently
    }
  };

  const initializeNotifications = () => {
    // No fake notifications - start empty; real notifications come via real-time updates
    setNotifications([]);
  };

  const handleExport = async (format: string, selectedFields: string[]) => {
    try {
      // Mock export functionality - replace with actual API call
      toast.success(`Bookings exported successfully as ${format.toUpperCase()}`);
      setShowExportModal(false);
    } catch (error) {
      toast.error('Failed to export bookings');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed':
      case 'paid':
        return 'text-green-600 bg-green-100';
      case 'pending':
        return 'text-yellow-600 bg-yellow-100';
      case 'cancelled':
        return 'text-red-600 bg-red-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const filteredBookings = (bookings || []).filter(booking => {
    const matchesSearch =
      booking.guestDetails?.primaryGuest?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      booking.confirmationNumber?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = filterStatus === 'all' || booking.bookingStatus === filterStatus;

    return matchesSearch && matchesStatus;
  });

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-6">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Travel Agent Dashboard</h1>
              <p className="text-gray-600 mt-2">
                Welcome back, {profile?.companyName} ({profile?.agentCode})
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => navigate('/travel-agent/booking/new')}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
              >
                <Plus className="h-5 w-5" />
                New Booking
              </button>
              <button
                onClick={() => navigate('/travel-agent/multi-booking')}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
              >
                <Users className="h-5 w-5" />
                Multi-Booking
              </button>
              <button
                onClick={() => navigate('/travel-agent/rates')}
                className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <FileText className="h-5 w-5" />
                View Rates
              </button>
            </div>
          </div>

          {/* Status Badge */}
          <div className="mt-4">
            <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
              profile?.status === 'active' ? 'bg-green-100 text-green-800' :
              profile?.status === 'suspended' ? 'bg-red-100 text-red-800' :
              'bg-yellow-100 text-yellow-800'
            }`}>
              {profile?.status === 'active' ? <CheckCircle className="h-4 w-4 mr-1" /> :
               profile?.status === 'suspended' ? <XCircle className="h-4 w-4 mr-1" /> :
               <AlertCircle className="h-4 w-4 mr-1" />}
              {profile?.status?.toUpperCase()}
            </span>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow-sm mb-6">
          <div className="border-b border-gray-200">
            <nav className="flex -mb-px">
              {['overview', 'bookings', 'commission', 'profile'].map((tab) => (
                <button aria-label="View"
                  key={tab}
                  onClick={() => {
                    setSelectedTab(tab as unknown);
                    // Navigate to appropriate URL
                    navigate(tab === 'overview' ? '/travel-agent' : `/travel-agent?tab=${tab}`);
                  }}
                  className={`px-6 py-3 text-sm font-medium capitalize ${
                    selectedTab === tab
                      ? 'text-indigo-600 border-b-2 border-indigo-600'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </nav>
          </div>
        </div>

        {/* Overview Tab */}
        {selectedTab === 'overview' && (
          <div className="space-y-6">
            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white p-6 rounded-lg shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-600 text-sm">Total Bookings</p>
                    <p className="text-3xl font-bold text-gray-900 mt-2">{stats.totalBookings}</p>
                    <p className="text-sm text-green-600 mt-2">
                      {stats.activeBookings} active
                    </p>
                  </div>
                  <div className="p-3 bg-indigo-100 rounded-full">
                    <Calendar className="h-8 w-8 text-indigo-600" />
                  </div>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="bg-white p-6 rounded-lg shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-600 text-sm">Total Revenue</p>
                    <p className="text-3xl font-bold text-gray-900 mt-2">
                      ₹{stats.totalRevenue.toLocaleString()}
                    </p>
                    <p className="text-sm text-gray-600 mt-2">
                      All time
                    </p>
                  </div>
                  <div className="p-3 bg-green-100 rounded-full">
                    <Banknote className="h-8 w-8 text-green-600" />
                  </div>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="bg-white p-6 rounded-lg shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-600 text-sm">Pending Commission</p>
                    <p className="text-3xl font-bold text-gray-900 mt-2">
                      ₹{stats.pendingCommission.toLocaleString()}
                    </p>
                    <p className="text-sm text-yellow-600 mt-2">
                      Awaiting payment
                    </p>
                  </div>
                  <div className="p-3 bg-yellow-100 rounded-full">
                    <Clock className="h-8 w-8 text-yellow-600" />
                  </div>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="bg-white p-6 rounded-lg shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-600 text-sm">Paid Commission</p>
                    <p className="text-3xl font-bold text-gray-900 mt-2">
                      ₹{stats.paidCommission.toLocaleString()}
                    </p>
                    <p className="text-sm text-green-600 mt-2">
                      Successfully paid
                    </p>
                  </div>
                  <div className="p-3 bg-green-100 rounded-full">
                    <CheckCircle className="h-8 w-8 text-green-600" />
                  </div>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="bg-white p-6 rounded-lg shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-600 text-sm">Commission Rate</p>
                    <p className="text-3xl font-bold text-gray-900 mt-2">
                      {profile?.commissionStructure.defaultRate}%
                    </p>
                    <p className="text-sm text-gray-600 mt-2">
                      Default rate
                    </p>
                  </div>
                  <div className="p-3 bg-purple-100 rounded-full">
                    <TrendingUp className="h-8 w-8 text-purple-600" />
                  </div>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="bg-white p-6 rounded-lg shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-600 text-sm">Credit Limit</p>
                    <p className="text-3xl font-bold text-gray-900 mt-2">
                      ₹{profile?.paymentTerms?.creditLimit?.toLocaleString() || 0}
                    </p>
                    <p className="text-sm text-gray-600 mt-2">
                      Available credit
                    </p>
                  </div>
                  <div className="p-3 bg-blue-100 rounded-full">
                    <CreditCard className="h-8 w-8 text-blue-600" />
                  </div>
                </div>
              </motion.div>
            </div>

            {/* Multi-Booking Overview */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Multi-Booking Center
                </h2>
                <button
                  onClick={() => navigate('/travel-agent/multi-booking')}
                  className="text-purple-600 hover:text-purple-800 text-sm font-medium"
                >
                  Create Multi-Booking →
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div className="bg-purple-50 p-4 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Building className="h-5 w-5 text-purple-600" />
                    <span className="font-medium text-purple-800">Group Bookings</span>
                  </div>
                  <div className="text-2xl font-bold text-purple-600">0</div>
                  <div className="text-sm text-purple-700">This month</div>
                </div>

                <div className="bg-green-50 p-4 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Banknote className="h-5 w-5 text-green-600" />
                    <span className="font-medium text-green-800">Bulk Discounts</span>
                  </div>
                  <div className="text-2xl font-bold text-green-600">₹0</div>
                  <div className="text-sm text-green-700">Total saved</div>
                </div>

                <div className="bg-blue-50 p-4 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp className="h-5 w-5 text-blue-600" />
                    <span className="font-medium text-blue-800">Bonus Commission</span>
                  </div>
                  <div className="text-2xl font-bold text-blue-600">₹0</div>
                  <div className="text-sm text-blue-700">From group bookings</div>
                </div>
              </div>

              <div className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white p-4 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold mb-1">Unlock Group Booking Benefits</h3>
                    <p className="text-purple-100 text-sm">
                      Book 3+ rooms together to earn bulk discounts and bonus commissions
                    </p>
                  </div>
                  <button
                    onClick={() => navigate('/travel-agent/multi-booking')}
                    className="bg-white text-purple-600 px-4 py-2 rounded-lg font-medium hover:bg-purple-50 transition-colors"
                  >
                    Start Now
                  </button>
                </div>
              </div>
            </div>

            {/* Recent Bookings */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Bookings</h2>
              <div className="space-y-4">
                {bookings.slice(0, 5).map((booking) => (
                  <div key={booking._id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <p className="font-medium text-gray-900">
                          {booking.guestDetails.primaryGuest.name}
                        </p>
                        <span className={`px-2 py-1 text-xs rounded-full ${getStatusColor(booking.bookingStatus)}`}>
                          {booking.bookingStatus}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mt-1">
                        {format(new Date(booking.bookingDetails.checkIn), 'MMM dd')} - {format(new Date(booking.bookingDetails.checkOut), 'MMM dd, yyyy')}
                      </p>
                      <p className="text-sm text-gray-600">
                        Confirmation: {booking.confirmationNumber}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-gray-900">
                        ₹{booking.pricing.totalAmount.toLocaleString()}
                      </p>
                      <p className="text-sm text-gray-600">
                        Commission: ₹{(booking.commission.amount + (booking.commission.bonusAmount || 0)).toLocaleString()}
                      </p>
                    </div>
                    <button
                      type="button"
                      className="ml-4 p-2 text-gray-400 cursor-not-allowed"
                      title="Booking detail page is not available in travel-agent routes"
                    >
                      <Eye className="h-5 w-5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Bookings Tab */}
        {selectedTab === 'bookings' && (
          <div className="bg-white rounded-lg shadow-sm p-6">
            {/* Search and Filters */}
            <div className="flex flex-col sm:flex-row gap-4 mb-6">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search bookings..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-600 focus:border-transparent"
                />
              </div>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-600 focus:border-transparent"
              >
                <option value="all">All Status</option>
                <option value="confirmed">Confirmed</option>
                <option value="pending">Pending</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
              <button className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
                <Filter className="h-5 w-5" />
                More Filters
              </button>
            </div>

            {/* Bookings Table */}
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Guest
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Dates
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Rooms
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Amount
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Commission
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredBookings.map((booking) => (
                    <tr key={booking._id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            {booking.guestDetails.primaryGuest.name}
                          </p>
                          <p className="text-sm text-gray-500">
                            {booking.guestDetails.primaryGuest.email}
                          </p>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <p className="text-sm text-gray-900">
                            {format(new Date(booking.bookingDetails.checkIn), 'MMM dd, yyyy')}
                          </p>
                          <p className="text-sm text-gray-500">
                            {booking.bookingDetails.nights} nights
                          </p>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <p className="text-sm text-gray-900">
                          {booking.guestDetails.totalRooms} room(s)
                        </p>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <p className="text-sm font-medium text-gray-900">
                          ₹{booking.pricing.totalAmount.toLocaleString()}
                        </p>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            ₹{(booking.commission.amount + (booking.commission.bonusAmount || 0)).toLocaleString()}
                          </p>
                          <span className={`inline-flex px-2 py-1 text-xs rounded-full ${
                            booking.commission.paymentStatus === 'paid'
                              ? 'bg-green-100 text-green-800'
                              : 'bg-yellow-100 text-yellow-800'
                          }`}>
                            {booking.commission.paymentStatus}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs rounded-full ${getStatusColor(booking.bookingStatus)}`}>
                          {booking.bookingStatus}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <span className="text-gray-400 mr-4" title="Booking detail page is not available in travel-agent routes">
                          View
                        </span>
                        <button aria-label="Download" className="text-gray-600 hover:text-gray-900">
                          <Download className="h-4 w-4 inline" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Commission Tab */}
        {selectedTab === 'commission' && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Commission Summary</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="text-center p-4 border border-gray-200 rounded-lg">
                  <p className="text-gray-600 text-sm">Total Earned</p>
                  <p className="text-2xl font-bold text-gray-900 mt-2">
                    ₹{(stats.pendingCommission + stats.paidCommission).toLocaleString()}
                  </p>
                </div>
                <div className="text-center p-4 border border-yellow-200 rounded-lg bg-yellow-50">
                  <p className="text-gray-600 text-sm">Pending Payment</p>
                  <p className="text-2xl font-bold text-yellow-600 mt-2">
                    ₹{stats.pendingCommission.toLocaleString()}
                  </p>
                </div>
                <div className="text-center p-4 border border-green-200 rounded-lg bg-green-50">
                  <p className="text-gray-600 text-sm">Paid Out</p>
                  <p className="text-2xl font-bold text-green-600 mt-2">
                    ₹{stats.paidCommission.toLocaleString()}
                  </p>
                </div>
              </div>
            </div>

            {/* Commission Details */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Commission Details</h2>
              <div className="space-y-4">
                {bookings.map((booking) => (
                  <div key={booking._id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium text-gray-900">
                          {booking.confirmationNumber}
                        </p>
                        <p className="text-sm text-gray-600 mt-1">
                          Guest: {booking.guestDetails.primaryGuest.name}
                        </p>
                        <p className="text-sm text-gray-600">
                          Booking Date: {format(new Date(booking.createdAt), 'MMM dd, yyyy')}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-semibold text-gray-900">
                          ₹{(booking.commission.amount + (booking.commission.bonusAmount || 0)).toLocaleString()}
                        </p>
                        <p className="text-sm text-gray-600">
                          {booking.commission.rate}% + {booking.commission.bonusRate || 0}% bonus
                        </p>
                        <span className={`inline-flex px-2 py-1 text-xs rounded-full mt-2 ${
                          booking.commission.paymentStatus === 'paid'
                            ? 'bg-green-100 text-green-800'
                            : booking.commission.paymentStatus === 'processing'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {booking.commission.paymentStatus}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Profile Tab */}
        {selectedTab === 'profile' && profile && (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-6">Agent Profile</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-4">Company Information</h3>
                <div className="space-y-3">
                  <div>
                    <p className="text-sm text-gray-600">Company Name</p>
                    <p className="font-medium">{profile.companyName}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Agent Code</p>
                    <p className="font-medium">{profile.agentCode}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Contact Person</p>
                    <p className="font-medium">{profile.contactPerson}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Email</p>
                    <p className="font-medium">{profile.email}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Phone</p>
                    <p className="font-medium">{profile.phone}</p>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-4">Business Details</h3>
                <div className="space-y-3">
                  <div>
                    <p className="text-sm text-gray-600">Business Type</p>
                    <p className="font-medium capitalize">{profile.businessDetails.businessType}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">License Number</p>
                    <p className="font-medium">{profile.businessDetails.licenseNumber || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">GST Number</p>
                    <p className="font-medium">{profile.businessDetails.gstNumber || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Established Year</p>
                    <p className="font-medium">{profile.businessDetails.establishedYear}</p>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-4">Commission Structure</h3>
                <div className="space-y-3">
                  <div>
                    <p className="text-sm text-gray-600">Default Rate</p>
                    <p className="font-medium">{profile.commissionStructure.defaultRate}%</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Seasonal Rates</p>
                    <p className="font-medium">
                      {profile.commissionStructure.seasonalRates?.length || 0} configured
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-4">Booking Limits</h3>
                <div className="space-y-3">
                  <div>
                    <p className="text-sm text-gray-600">Max Bookings Per Day</p>
                    <p className="font-medium">{profile.bookingLimits?.maxBookingsPerDay || 'Unlimited'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Max Rooms Per Booking</p>
                    <p className="font-medium">{profile.bookingLimits?.maxRoomsPerBooking || 'Unlimited'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Max Advance Booking Days</p>
                    <p className="font-medium">{profile.bookingLimits?.maxAdvanceBookingDays || 'Unlimited'}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 pt-6 border-t border-gray-200">
              <button
                onClick={() => navigate('/travel-agent/profile/edit')}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
              >
                <Edit className="h-5 w-5" />
                Edit Profile
              </button>
            </div>
          </div>
        )}

        {/* Analytics Tab */}
        {selectedTab === 'analytics' && (
          <div className="space-y-6">
            {/* Analytics Header */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                    <Activity className="h-5 w-5" />
                    Performance Analytics
                  </h2>
                  <p className="text-gray-600 mt-1">
                    Detailed insights into your booking performance and commission trends
                  </p>
                </div>
                <div className="flex gap-2">
                  <button aria-label="Close"
                    onClick={() => setRealTimeEnabled(!realTimeEnabled)}
                    className={`px-3 py-2 text-sm rounded-lg transition-colors ${
                      realTimeEnabled
                        ? 'bg-green-100 text-green-700 border border-green-200'
                        : 'bg-gray-100 text-gray-600 border border-gray-200'
                    }`}
                  >
                    {realTimeEnabled ? 'Live Updates On' : 'Live Updates Off'}
                  </button>
                  <button
                    onClick={() => setShowExportModal(true)}
                    className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <Download className="h-4 w-4" />
                    Export Analytics
                  </button>
                </div>
              </div>
            </div>

            {/* Booking Trends Chart */}
            <BookingTrendsChart
              data={analyticsData.bookingTrends}
              timeRange={timeRange}
              onTimeRangeChange={setTimeRange}
              loading={loading}
            />

            {/* Commission and Revenue Charts */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              <CommissionChart
                data={analyticsData.commissionData}
                agentName={profile?.companyName}
                timeRange={timeRange}
                onTimeRangeChange={setTimeRange}
                loading={loading}
              />

              <RevenueChart
                data={analyticsData.revenueData}
                timeRange={timeRange}
                onTimeRangeChange={setTimeRange}
                loading={loading}
              />
            </div>
          </div>
        )}

        {/* Export Modal */}
        <ExportOptionsModal
          isOpen={showExportModal}
          onClose={() => setShowExportModal(false)}
          onExport={handleExport}
          availableFields={[
            { key: 'confirmationNumber', label: 'Confirmation Number' },
            { key: 'guestName', label: 'Guest Name' },
            { key: 'checkIn', label: 'Check-in Date' },
            { key: 'checkOut', label: 'Check-out Date' },
            { key: 'totalAmount', label: 'Total Amount' },
            { key: 'commission', label: 'Commission' },
            { key: 'status', label: 'Status' }
          ]}
          currentFilters={filterCriteria}
          currentDateRange={dateRange}
        />
      </div>
    </div>
  );
};

export default withErrorBoundary(TravelAgentDashboard, { level: 'page' });