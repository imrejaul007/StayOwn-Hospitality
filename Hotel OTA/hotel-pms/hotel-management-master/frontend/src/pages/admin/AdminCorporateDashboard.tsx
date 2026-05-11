import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Building2,
  Users,
  CreditCard,
  TrendingUp,
  AlertTriangle,
  Calendar,
  IndianRupee,
  FileText,
  Clock,
  Target,
  BarChart3,
  PieChart,
  RefreshCw,
  Settings,
  CalendarDays,
  Receipt
} from 'lucide-react';
import { useProperty } from '../../context/PropertyContext';
import { PropertyBreadcrumb } from '../../components/common/PropertyBreadcrumb';
import { cn } from '../../utils/cn';
import { formatCurrency, formatPercentage } from '../../utils/dashboardUtils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LineChart, DonutChart, BarChart } from '../../components/dashboard';
import { MetricCard } from '../../components/dashboard';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { Tabs } from '@/components/ui/tabs';
import CorporateCompanyManagement from '../../components/admin/CorporateCompanyManagement';
import GroupBookingManagement from '../../components/admin/GroupBookingManagement';
import CorporateCreditManagement from '../../components/admin/CorporateCreditManagement';
import GSTManagement from '../../components/admin/GSTManagement';
import { api } from '../../services/api';
import { withErrorBoundary } from '../../components/ErrorBoundary';

interface CorporateOverviewData {
  companies: {
    total: number;
    newThisMonth: number;
  };
  bookings: {
    totalYearly: number;
    thisMonth: number;
  };
  revenue: {
    monthly: number;
    yearly: number;
    averageBookingValue: number;
  };
  groupBookings: {
    active: number;
    upcoming: number;
  };
  credit: {
    totalExposure: number;
    overdueAmount: number;
  };
}

interface TopCompany {
  _id: string;
  companyName: string;
  totalBookings: number;
  totalRevenue: number;
  averageBookingValue: number;
}

interface MonthlyTrend {
  year: number;
  month: number;
  monthName: string;
  totalBookings: number;
  totalRevenue: number;
  averageRevenue: number;
  uniqueCompaniesCount: number;
}

// API functions
const fetchCorporateOverview = async (propertyId?: string): Promise<{ overview: CorporateOverviewData; topCompanies: TopCompany[] }> => {
  try {
    const response = await api.get('/corporate/admin/dashboard-overview', { params: { propertyId } });
    return response.data.data;
  } catch (error: unknown) {
    throw error instanceof Error ? error : new Error('Failed to fetch corporate overview');
  }
};

const fetchMonthlyTrends = async (months: number = 12, propertyId?: string): Promise<{ trends: MonthlyTrend[] }> => {
  try {
    const response = await api.get(`/corporate/admin/monthly-trends?months=${months}`, { params: { propertyId } });
    return response.data.data;
  } catch (error: unknown) {
    throw error instanceof Error ? error : new Error('Failed to fetch monthly trends');
  }
};

function AdminCorporateDashboard() {
  const { selectedPropertyId, selectedProperty, viewMode } = useProperty();
  const [refreshing, setRefreshing] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<6 | 12>(12);
  const [activeTab, setActiveTab] = useState('overview');

  // Fetch corporate overview data
  const {
    data: overviewData,
    isLoading: overviewLoading,
    error: overviewError,
    refetch: refetchOverview
  } = useQuery({
    queryKey: ['corporate-overview', selectedPropertyId],
    queryFn: () => fetchCorporateOverview(selectedPropertyId),
    refetchInterval: 5 * 60 * 1000, // Refresh every 5 minutes
    enabled: !!selectedPropertyId || viewMode === 'portfolio'
  });

  // Fetch monthly trends
  const {
    data: trendsData,
    isLoading: trendsLoading,
    refetch: refetchTrends
  } = useQuery({
    queryKey: ['corporate-monthly-trends', selectedPeriod, selectedPropertyId],
    queryFn: () => fetchMonthlyTrends(selectedPeriod, selectedPropertyId),
    refetchInterval: 5 * 60 * 1000,
    enabled: !!selectedPropertyId || viewMode === 'portfolio'
  });

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refetchOverview(), refetchTrends()]);
    setRefreshing(false);
  };

  if (!selectedPropertyId && viewMode === 'single') {
    return (
      <div className="p-6">
        <PropertyBreadcrumb items={['Corporate Dashboard']} />
        <div className="text-center py-12">
          <Building2 className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Property Selected</h3>
          <p className="text-gray-500">Please select a property to view corporate dashboard.</p>
        </div>
      </div>
    );
  }

  if (overviewLoading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <LoadingSpinner size="large" />
      </div>
    );
  }

  if (overviewError) {
    return (
      <div className="text-center py-12">
        <AlertTriangle className="mx-auto h-12 w-12 text-red-500 mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">Failed to load corporate data</h3>
        <p className="text-gray-500 mb-4">There was an error loading the corporate dashboard data.</p>
        <Button onClick={handleRefresh}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Try Again
        </Button>
      </div>
    );
  }

  const { overview, topCompanies } = overviewData || { overview: null, topCompanies: [] };

  if (!overview) {
    return (
      <div className="text-center py-12">
        <Building2 className="mx-auto h-12 w-12 text-gray-400 mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">No Corporate Data</h3>
        <p className="text-gray-500">No corporate booking data available yet.</p>
      </div>
    );
  }

  // Prepare chart data with safe fallbacks
  const revenueChartData = trendsData?.trends?.map(trend => ({
    month: trend.monthName,
    revenue: trend.totalRevenue || 0,
    bookings: trend.totalBookings || 0,
  })) || [];

  const companyDistributionData = topCompanies?.length > 0 
    ? topCompanies.slice(0, 5).map(company => ({
        name: company.companyName || 'Unknown Company',
        value: company.totalRevenue || 0,
      }))
    : [];

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <PropertyBreadcrumb items={['Corporate Dashboard']} />

      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Corporate Dashboard</h1>
          <p className="text-gray-600">Monitor corporate bookings, revenue, and company performance</p>
        </div>
        <div className="flex items-center space-x-3">
          <select
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(Number(e.target.value) as 6 | 12)}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          >
            <option value={6}>Last 6 months</option>
            <option value={12}>Last 12 months</option>
          </select>
          <Button
            onClick={handleRefresh}
            disabled={refreshing}
            variant="outline"
            className="flex items-center"
          >
            <RefreshCw className={cn("w-4 h-4 mr-2", refreshing && "animate-spin")} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="border-b border-gray-200">
          <div className="flex space-x-8">
            <button
              onClick={() => setActiveTab('overview')}
              className={cn(
                "py-2 px-1 border-b-2 font-medium text-sm whitespace-nowrap",
                activeTab === 'overview'
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              )}
            >
              <BarChart3 className="w-4 h-4 inline mr-2" />
              Overview & Analytics
            </button>
            <button
              onClick={() => setActiveTab('companies')}
              className={cn(
                "py-2 px-1 border-b-2 font-medium text-sm whitespace-nowrap",
                activeTab === 'companies'
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              )}
            >
              <Building2 className="w-4 h-4 inline mr-2" />
              Company Management
            </button>
            <button
              onClick={() => setActiveTab('bookings')}
              className={cn(
                "py-2 px-1 border-b-2 font-medium text-sm whitespace-nowrap",
                activeTab === 'bookings'
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              )}
            >
              <CalendarDays className="w-4 h-4 inline mr-2" />
              Group Bookings
            </button>
            <button
              onClick={() => setActiveTab('credit')}
              className={cn(
                "py-2 px-1 border-b-2 font-medium text-sm whitespace-nowrap",
                activeTab === 'credit'
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              )}
            >
              <CreditCard className="w-4 h-4 inline mr-2" />
              Credit Management
            </button>
            <button
              onClick={() => setActiveTab('gst')}
              className={cn(
                "py-2 px-1 border-b-2 font-medium text-sm whitespace-nowrap",
                activeTab === 'gst'
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              )}
            >
              <Receipt className="w-4 h-4 inline mr-2" />
              GST & Invoicing
            </button>
          </div>
        </div>

        {/* Tab Content */}
        <div className="mt-6">
          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <OverviewContent
              overview={overview}
              topCompanies={topCompanies}
              revenueChartData={revenueChartData}
              companyDistributionData={companyDistributionData}
              trendsLoading={trendsLoading}
            />
          )}

          {/* Companies Tab */}
          {activeTab === 'companies' && (
            <CorporateCompanyManagement />
          )}

          {/* Bookings Tab */}
          {activeTab === 'bookings' && (
            <GroupBookingManagement />
          )}

          {/* Credit Tab */}
          {activeTab === 'credit' && (
            <CorporateCreditManagement />
          )}

          {/* GST Tab */}
          {activeTab === 'gst' && (
            <GSTManagement />
          )}
        </div>
      </Tabs>
    </div>
  );
}

// Overview Content Component
interface OverviewContentProps {
  overview: CorporateOverviewData | null;
  topCompanies: TopCompany[];
  revenueChartData: unknown[];
  companyDistributionData: unknown[];
  trendsLoading: boolean;
}

function OverviewContent({ overview, topCompanies, revenueChartData, companyDistributionData, trendsLoading }: OverviewContentProps) {
  if (!overview) {
    return (
      <div className="text-center py-12">
        <Building2 className="mx-auto h-12 w-12 text-gray-400 mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">No Corporate Data</h3>
        <p className="text-gray-500">No corporate booking data available yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                 <MetricCard
           title="Corporate Companies"
           value={overview.companies.total}
           type="number"
           icon={<Building2 className="w-5 h-5" />}
           trend={overview.companies.newThisMonth > 0 ? {
             value: overview.companies.newThisMonth,
             label: 'new this month',
             direction: 'up'
           } : undefined}
           className="bg-blue-50 border-blue-200"
         />
         
         <MetricCard
           title="Monthly Bookings"
           value={overview.bookings.thisMonth}
           type="number"
           icon={<Calendar className="w-5 h-5" />}
           trend={{
             value: overview.bookings.totalYearly,
             label: 'total this year',
             direction: 'neutral'
           }}
           className="bg-green-50 border-green-200"
         />
        
                 <MetricCard
           title="Monthly Revenue"
           value={overview.revenue.monthly}
           type="currency"
           icon={<IndianRupee className="w-5 h-5" />}
           trend={{
             value: overview.revenue.yearly,
             label: 'total this year',
             direction: 'up'
           }}
           className="bg-purple-50 border-purple-200"
         />
         
         <MetricCard
           title="Credit Exposure"
           value={overview.credit.totalExposure}
           type="currency"
           icon={<CreditCard className="w-5 h-5" />}
           trend={overview.credit.overdueAmount > 0 ? {
             value: overview.credit.overdueAmount,
             label: 'overdue amount',
             direction: 'down'
           } : undefined}
           className={cn(
             "border-2",
             overview.credit.overdueAmount > 50000 ? "bg-red-50 border-red-200" : "bg-yellow-50 border-yellow-200"
           )}
         />
      </div>

      {/* Additional Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Average Booking Value</p>
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(overview.revenue.averageBookingValue)}</p>
            </div>
            <div className="p-3 bg-indigo-100 rounded-lg">
              <Target className="h-6 w-6 text-indigo-600" />
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Active Group Bookings</p>
              <p className="text-2xl font-bold text-gray-900">{overview.groupBookings.active}</p>
              {overview.groupBookings.upcoming > 0 && (
                <p className="text-sm text-gray-500 mt-1">
                  {overview.groupBookings.upcoming} upcoming
                </p>
              )}
            </div>
            <div className="p-3 bg-orange-100 rounded-lg">
              <Users className="h-6 w-6 text-orange-600" />
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Credit Utilization</p>
              <p className="text-2xl font-bold text-gray-900">
                {overview.credit.totalExposure > 0 ? 
                  formatPercentage((overview.credit.totalExposure - overview.credit.overdueAmount) / overview.credit.totalExposure * 100) 
                  : '0%'
                }
              </p>
              <p className="text-sm text-gray-500 mt-1">
                of total exposure
              </p>
            </div>
            <div className="p-3 bg-teal-100 rounded-lg">
              <PieChart className="h-6 w-6 text-teal-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue Trends */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Revenue Trends</h3>
            <BarChart3 className="h-5 w-5 text-gray-400" />
          </div>
          
          {trendsLoading ? (
            <div className="h-64 flex items-center justify-center">
              <LoadingSpinner />
            </div>
          ) : (
            <div className="h-64">
              {revenueChartData && revenueChartData.length > 0 ? (
                <LineChart
                  data={revenueChartData}
                  xDataKey="month"
                  lines={[
                    {
                      dataKey: "revenue",
                      name: "Revenue",
                      color: "#3B82F6",
                      strokeWidth: 2
                    }
                  ]}
                />
              ) : (
                <div className="h-64 flex items-center justify-center text-gray-500">
                  <div className="text-center">
                    <BarChart3 className="mx-auto h-12 w-12 text-gray-300 mb-2" />
                    <p>No revenue data available</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Top Companies */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Top Companies by Revenue</h3>
            <Building2 className="h-5 w-5 text-gray-400" />
          </div>
          
          {companyDistributionData.length > 0 ? (
            <div className="h-64">
              <DonutChart
                data={companyDistributionData}
                height={200}
                showLegend={true}
                showTooltip={true}
              />
            </div>
          ) : (
            <div className="h-64 flex items-center justify-center text-gray-500">
              <div className="text-center">
                <Building2 className="mx-auto h-12 w-12 text-gray-300 mb-2" />
                <p>No company data available</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Top Companies Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Top Performing Companies</h3>
        </div>
        
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Company
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Total Bookings
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Total Revenue
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Avg. Booking Value
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {topCompanies.length > 0 ? topCompanies.map((company, index) => (
                <tr key={company._id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-8 w-8 bg-blue-100 rounded-full flex items-center justify-center">
                        <span className="text-sm font-medium text-blue-600">{index + 1}</span>
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">
                          {company.companyName}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <Badge variant="outline">{company.totalBookings}</Badge>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {formatCurrency(company.totalRevenue)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatCurrency(company.averageBookingValue)}
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-gray-500">
                    <Building2 className="mx-auto h-12 w-12 text-gray-300 mb-4" />
                    <p>No corporate companies found</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Action Items */}
      {overview.credit.overdueAmount > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <div className="flex items-center">
            <AlertTriangle className="h-5 w-5 text-red-500 mr-3" />
            <div className="flex-1">
              <h3 className="text-sm font-medium text-red-800">
                Overdue Payments Detected
              </h3>
              <p className="text-sm text-red-700 mt-1">
                {formatCurrency(overview.credit.overdueAmount)} in overdue payments requires attention.
              </p>
            </div>
            <Button variant="outline" size="sm" className="border-red-300 text-red-700 hover:bg-red-100">
              View Details
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default withErrorBoundary(AdminCorporateDashboard);
