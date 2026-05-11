import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import posReportsService, { 
  SalesSummaryResponse, 
  OutletPerformanceResponse,
  PaymentMethodsResponse,
  TopItemsResponse,
  StaffPerformanceResponse,
  PeakHoursResponse 
} from '../../services/posReportsService';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { 
  TrendingUp, 
  IndianRupee, 
  ShoppingCart, 
  Users, 
  Clock, 
  Receipt,
  BarChart3,
  PieChart,
  Download,
  Calendar,
  Filter,
  RefreshCw,
  Star,
  CreditCard,
  Building,
  AlertCircle
} from 'lucide-react';
import { toast } from 'sonner';
import { withErrorBoundary } from '../ErrorBoundary';

// Metric Card Component
const MetricCard = ({ 
  title, 
  value, 
  icon, 
  trend, 
  color = 'blue',
  loading = false,
  formatter = (val: unknown) => val?.toString() || '0'
}: {
  title: string;
  value: unknown;
  icon: React.ReactNode;
  trend?: { direction: 'up' | 'down'; value: string };
  color?: 'blue' | 'green' | 'red' | 'yellow' | 'purple';
  loading?: boolean;
  formatter?: (val: unknown) => string;
}) => {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-600 border-blue-200',
    green: 'bg-green-50 text-green-600 border-green-200', 
    red: 'bg-red-50 text-red-600 border-red-200',
    yellow: 'bg-yellow-50 text-yellow-600 border-yellow-200',
    purple: 'bg-purple-50 text-purple-600 border-purple-200'
  };

  return (
    <Card className="relative overflow-hidden">
      <CardContent className="p-6">
        {loading && (
          <div className="absolute inset-0 bg-white/50 flex items-center justify-center">
            <RefreshCw className="w-4 h-4 animate-spin" />
          </div>
        )}
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <p className="text-sm font-medium text-gray-600">{title}</p>
            <p className="text-2xl font-bold text-gray-900">{formatter(value)}</p>
            {trend && (
              <div className={`flex items-center text-sm ${
                trend.direction === 'up' ? 'text-green-600' : 'text-red-600'
              }`}>
                <TrendingUp className={`w-4 h-4 mr-1 ${trend.direction === 'down' ? 'rotate-180' : ''}`} />
                {trend.value}
              </div>
            )}
          </div>
          <div className={`p-3 rounded-full border ${colorClasses[color]}`}>
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

// Simple Chart Component (since we don't have recharts, using CSS bars)
const SimpleBarChart = ({ 
  data, 
  title,
  valueKey,
  labelKey,
  color = '#3b82f6'
}: {
  data: unknown[];
  title: string;
  valueKey: string;
  labelKey: string;
  color?: string;
}) => {
  const maxValue = Math.max(...data.map(item => item[valueKey] || 0));
  
  return (
    <div className="space-y-4">
      <h4 className="font-medium text-gray-900">{title}</h4>
      <div className="space-y-3">
        {data.slice(0, 8).map((item, index) => (
          <div key={`item-${index}`} className="flex items-center space-x-3">
            <div className="w-24 text-sm text-gray-600 truncate">
              {item[labelKey]}
            </div>
            <div className="flex-1 bg-gray-200 rounded-full h-2">
              <div 
                className="h-2 rounded-full transition-all duration-500"
                style={{ 
                  width: `${((item[valueKey] || 0) / maxValue) * 100}%`,
                  backgroundColor: color
                }}
              />
            </div>
            <div className="w-20 text-sm font-medium text-right">
              {typeof item[valueKey] === 'number' && item[valueKey] > 1000 
                ? posReportsService.formatCurrency(item[valueKey])
                : item[valueKey]}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// Main POS Reports Component
const POSReports: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
  const [dateRange, setDateRange] = useState('last7Days');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(false);

  // Data states
  const [salesData, setSalesData] = useState<SalesSummaryResponse | null>(null);
  const [outletData, setOutletData] = useState<OutletPerformanceResponse | null>(null);
  const [paymentData, setPaymentData] = useState<PaymentMethodsResponse | null>(null);
  const [topItemsData, setTopItemsData] = useState<TopItemsResponse | null>(null);
  const [staffData, setStaffData] = useState<StaffPerformanceResponse | null>(null);
  const [peakHoursData, setPeakHoursData] = useState<PeakHoursResponse | null>(null);

  // Get date ranges
  const dateRanges = posReportsService.getDateRanges();
  const currentRange = dateRange === 'custom' 
    ? { startDate: customStartDate, endDate: customEndDate }
    : dateRanges[dateRange as keyof typeof dateRanges];

  // Load data
  const loadData = async () => {
    if (!currentRange.startDate || !currentRange.endDate) return;
    
    try {
      setLoading(true);
      const hotelId = user?.hotelId;

      const results = await Promise.allSettled([
        posReportsService.getSalesSummary({
          startDate: currentRange.startDate,
          endDate: currentRange.endDate,
          groupBy: 'day',
          hotelId
        }),
        posReportsService.getOutletPerformance({
          startDate: currentRange.startDate,
          endDate: currentRange.endDate,
          hotelId
        }),
        posReportsService.getPaymentMethods({
          startDate: currentRange.startDate,
          endDate: currentRange.endDate,
          hotelId
        }),
        posReportsService.getTopItems({
          startDate: currentRange.startDate,
          endDate: currentRange.endDate,
          limit: 10,
          hotelId
        }),
        posReportsService.getStaffPerformance({
          startDate: currentRange.startDate,
          endDate: currentRange.endDate,
          hotelId
        }),
        posReportsService.getPeakHours({
          startDate: currentRange.startDate,
          endDate: currentRange.endDate,
          hotelId
        })
      ]);

      if (results[0].status === 'fulfilled') setSalesData(results[0].value);
      if (results[1].status === 'fulfilled') setOutletData(results[1].value);
      if (results[2].status === 'fulfilled') setPaymentData(results[2].value);
      if (results[3].status === 'fulfilled') setTopItemsData(results[3].value);
      if (results[4].status === 'fulfilled') setStaffData(results[4].value);
      if (results[5].status === 'fulfilled') setPeakHoursData(results[5].value);

      const failedCount = results.filter(r => r.status === 'rejected').length;
      if (failedCount > 0) {
        toast.error(`${failedCount} report section(s) failed to load`);
      }
    } catch (error) {
      toast.error('Failed to load reports data');
    } finally {
      setLoading(false);
    }
  };

  // Load data on mount and when date range changes
  useEffect(() => {
    loadData();
  }, [currentRange.startDate, currentRange.endDate, user?.hotelId]);

  // Auto refresh
  useEffect(() => {
    if (!autoRefresh) return;
    
    const interval = setInterval(loadData, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, [autoRefresh, currentRange]);

  const formatCurrency = posReportsService.formatCurrency;

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">POS Reports & Analytics</h1>
          <p className="text-gray-600 mt-1">Comprehensive point-of-sale performance insights</p>
        </div>
        <div className="flex items-center space-x-3">
          <Button
            variant={autoRefresh ? 'default' : 'outline'}
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${autoRefresh ? 'animate-spin' : ''}`} />
            {autoRefresh ? 'Auto-refresh ON' : 'Auto-refresh OFF'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={loadData}
            disabled={loading}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button variant="outline" size="sm">
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Date Range Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Report Period
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2 mb-4">
            {Object.entries(dateRanges).map(([key, range]) => (
              <Button
                key={key}
                variant={dateRange === key ? 'default' : 'outline'}
                size="sm"
                onClick={() => setDateRange(key)}
              >
                {key === 'today' ? 'Today' :
                 key === 'yesterday' ? 'Yesterday' :
                 key === 'last7Days' ? 'Last 7 Days' :
                 key === 'last30Days' ? 'Last 30 Days' :
                 key === 'thisMonth' ? 'This Month' :
                 key === 'lastMonth' ? 'Last Month' : key}
              </Button>
            ))}
            <Button
              variant={dateRange === 'custom' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setDateRange('custom')}
            >
              Custom Range
            </Button>
          </div>
          
          {dateRange === 'custom' && (
            <div className="flex items-center space-x-3">
              <Input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="w-40"
              />
              <span className="text-gray-500">to</span>
              <Input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="w-40"
              />
            </div>
          )}
          
          <div className="mt-3 text-sm text-gray-600">
            Selected period: {currentRange.startDate} to {currentRange.endDate}
          </div>
        </CardContent>
      </Card>

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="sales">Sales</TabsTrigger>
          <TabsTrigger value="outlets">Outlets</TabsTrigger>
          <TabsTrigger value="payments">Payments</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="insights">Insights</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          {/* Key Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <MetricCard
              title="Total Sales"
              value={salesData?.data?.summary?.totalSales ?? 0}
              icon={<IndianRupee className="w-6 h-6" />}
              color="green"
              loading={loading}
              formatter={formatCurrency}
            />
            <MetricCard
              title="Transactions"
              value={salesData?.data?.summary?.totalTransactions ?? 0}
              icon={<Receipt className="w-6 h-6" />}
              color="blue"
              loading={loading}
            />
            <MetricCard
              title="Avg Transaction Value"
              value={salesData?.data?.summary?.averageTransactionValue ?? 0}
              icon={<TrendingUp className="w-6 h-6" />}
              color="purple"
              loading={loading}
              formatter={formatCurrency}
            />
            <MetricCard
              title="Top Outlet"
              value={outletData?.data.summary.topPerformer || 'N/A'}
              icon={<Building className="w-6 h-6" />}
              color="yellow"
              loading={loading}
            />
          </div>

          {/* Quick Insights */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Top Outlets by Revenue</CardTitle>
              </CardHeader>
              <CardContent>
                {outletData ? (
                  <SimpleBarChart
                    data={outletData.data.outlets}
                    title=""
                    valueKey="totalRevenue"
                    labelKey="outlet"
                    color="#10b981"
                  />
                ) : (
                  <div className="flex items-center justify-center py-8">
                    <div className="text-gray-500">Loading outlet data...</div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Payment Methods</CardTitle>
              </CardHeader>
              <CardContent>
                {paymentData ? (
                  <div className="space-y-4">
                    {paymentData.data.paymentMethods.map((method, index) => (
                      <div key={`paymentData-data-paymentMethods-${index}-${method.method}`} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center space-x-3">
                          <CreditCard className="w-5 h-5 text-gray-600" />
                          <span className="font-medium capitalize">{method.method.replace('_', ' ')}</span>
                        </div>
                        <div className="text-right">
                          <div className="font-bold">{formatCurrency(method.totalAmount)}</div>
                          <div className="text-sm text-gray-600">{method.transactionCount} transactions</div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center justify-center py-8">
                    <div className="text-gray-500">Loading payment data...</div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Sales Tab */}
        <TabsContent value="sales" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Sales Summary */}
            <Card>
              <CardHeader>
                <CardTitle>Sales Summary</CardTitle>
              </CardHeader>
              <CardContent>
                {salesData ? (
                  <div className="space-y-4">
                    <div className="text-center">
                      <div className="text-3xl font-bold text-green-600">
                        {formatCurrency(salesData.data.summary.totalSales)}
                      </div>
                      <div className="text-sm text-gray-600">Total Sales</div>
                    </div>
                    
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Transactions:</span>
                        <span className="font-semibold">{salesData.data.summary.totalTransactions}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Average Value:</span>
                        <span className="font-semibold">{formatCurrency(salesData.data.summary.averageTransactionValue)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Total Tax:</span>
                        <span className="font-semibold">{formatCurrency(salesData.data.summary.totalTax)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Total Discounts:</span>
                        <span className="font-semibold">{formatCurrency(salesData.data.summary.totalDiscount)}</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-center py-8">
                    <RefreshCw className="w-6 h-6 animate-spin" />
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Daily Breakdown */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Daily Sales Breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                {salesData ? (
                  <div className="space-y-3">
                    {salesData.data.breakdown.slice(0, 10).map((day, index) => (
                      <div key={`-${index}-${day.date}`} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center space-x-4">
                          <Badge variant="outline">{day.date}</Badge>
                          <span className="text-sm text-gray-600">{day.transactionCount} transactions</span>
                        </div>
                        <div className="text-right">
                          <div className="font-bold">{formatCurrency(day.totalSales)}</div>
                          <div className="text-sm text-gray-600">
                            Avg: {formatCurrency(day.averageTransactionValue)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center justify-center py-8">
                    <div className="text-gray-500">Loading sales breakdown...</div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Outlets Tab */}
        <TabsContent value="outlets" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Outlet Performance</CardTitle>
              </CardHeader>
              <CardContent>
                {outletData ? (
                  <div className="space-y-4">
                    {outletData.data.outlets.map((outlet, index) => (
                      <div key={`outletData-data-outlets-${index}`} className="p-4 border rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-semibold">{outlet.outlet}</h4>
                          <Badge variant="outline">{outlet.outletType}</Badge>
                        </div>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="text-gray-600">Revenue:</span>
                            <div className="font-bold">{formatCurrency(outlet.totalRevenue)}</div>
                          </div>
                          <div>
                            <span className="text-gray-600">Items Sold:</span>
                            <div className="font-bold">{outlet.totalItems}</div>
                          </div>
                          <div>
                            <span className="text-gray-600">Transactions:</span>
                            <div className="font-bold">{outlet.transactionCount}</div>
                          </div>
                          <div>
                            <span className="text-gray-600">Avg Item Price:</span>
                            <div className="font-bold">{formatCurrency(outlet.averageItemPrice)}</div>
                          </div>
                        </div>
                        <div className="mt-2 text-xs text-gray-600">
                          {outlet.revenuePercentage}% of total revenue
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center justify-center py-8">
                    <RefreshCw className="w-6 h-6 animate-spin" />
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Revenue Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                {outletData && (
                  <SimpleBarChart
                    data={outletData.data.outlets}
                    title=""
                    valueKey="totalRevenue"
                    labelKey="outlet"
                    color="#3b82f6"
                  />
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Payments Tab */}
        <TabsContent value="payments" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Payment Method Analysis</CardTitle>
              </CardHeader>
              <CardContent>
                {paymentData ? (
                  <div className="space-y-4">
                    <div className="text-center mb-6">
                      <div className="text-3xl font-bold text-blue-600">
                        {formatCurrency(paymentData.data.summary.totalRevenue)}
                      </div>
                      <div className="text-sm text-gray-600">Total Payment Volume</div>
                    </div>
                    
                    {paymentData.data.paymentMethods.map((method, index) => (
                      <div key={`paymentData-data-paymentMethods-${index}-${method.method}`} className="p-4 border rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-semibold capitalize">{method.method.replace('_', ' ')}</h4>
                          <Badge>{method.revenuePercentage}%</Badge>
                        </div>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="text-gray-600">Amount:</span>
                            <div className="font-bold">{formatCurrency(method.totalAmount)}</div>
                          </div>
                          <div>
                            <span className="text-gray-600">Count:</span>
                            <div className="font-bold">{method.transactionCount}</div>
                          </div>
                        </div>
                        <div className="mt-2">
                          <div className="text-xs text-gray-600 mb-1">Transaction volume</div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div 
                              className="bg-blue-600 h-2 rounded-full"
                              style={{ width: `${method.revenuePercentage}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center justify-center py-8">
                    <RefreshCw className="w-6 h-6 animate-spin" />
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Payment Trends</CardTitle>
              </CardHeader>
              <CardContent>
                {paymentData && (
                  <SimpleBarChart
                    data={paymentData.data.paymentMethods}
                    title=""
                    valueKey="totalAmount"
                    labelKey="method"
                    color="#ef4444"
                  />
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Performance Tab */}
        <TabsContent value="performance" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top Items */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Star className="w-5 h-5" />
                  Top Selling Items
                </CardTitle>
              </CardHeader>
              <CardContent>
                {topItemsData ? (
                  <div className="space-y-3">
                    {topItemsData.data.items.slice(0, 8).map((item, index) => (
                      <div key={`-${index}-${item.name}`} className="flex items-center space-x-3 p-2 hover:bg-gray-50 rounded">
                        <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                          <span className="text-sm font-bold text-blue-600">#{item.rank}</span>
                        </div>
                        <div className="flex-1">
                          <div className="font-medium text-sm">{item.name}</div>
                          <div className="text-xs text-gray-500">{item.category} • {item.outlet}</div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-sm">{item.totalQuantity} sold</div>
                          <div className="text-xs text-gray-600">{formatCurrency(item.totalRevenue)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center justify-center py-8">
                    <RefreshCw className="w-6 h-6 animate-spin" />
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Staff Performance */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  Staff Performance
                </CardTitle>
              </CardHeader>
              <CardContent>
                {staffData ? (
                  <div className="space-y-3">
                    {staffData.data.staff.slice(0, 6).map((staff, index) => (
                      <div key={`staff-${index}`} className="flex items-center space-x-3 p-3 border rounded-lg">
                        <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                          <span className="text-sm font-bold text-green-600">#{staff.rank}</span>
                        </div>
                        <div className="flex-1">
                          <div className="font-medium">{staff.staffName}</div>
                          <div className="text-sm text-gray-500">{staff.transactionCount} transactions</div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold">{formatCurrency(staff.totalRevenue)}</div>
                          <div className="text-sm text-gray-600">{staff.revenuePercentage}%</div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center justify-center py-8">
                    <RefreshCw className="w-6 h-6 animate-spin" />
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Insights Tab */}
        <TabsContent value="insights" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Peak Hours */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="w-5 h-5" />
                  Peak Hours Analysis
                </CardTitle>
              </CardHeader>
              <CardContent>
                {peakHoursData ? (
                  <div className="space-y-4">
                    <div className="p-4 bg-blue-50 rounded-lg">
                      <h4 className="font-semibold text-blue-900">Peak Hour</h4>
                      <div className="text-2xl font-bold text-blue-600">
                        {peakHoursData.data.insights.peakHour.hourFormatted}
                      </div>
                      <div className="text-sm text-blue-700">
                        {peakHoursData.data.insights.peakHour.transactions} transactions
                      </div>
                    </div>
                    
                    <div className="p-4 bg-green-50 rounded-lg">
                      <h4 className="font-semibold text-green-900">Peak Day</h4>
                      <div className="text-2xl font-bold text-green-600">
                        {peakHoursData.data.insights.peakDay.dayName}
                      </div>
                      <div className="text-sm text-green-700">
                        {peakHoursData.data.insights.peakDay.transactions} transactions
                      </div>
                    </div>

                    <div className="space-y-2">
                      <h4 className="font-medium">Hourly Distribution</h4>
                      {peakHoursData.data.hourlyAnalysis
                        .filter(hour => hour.transactionCount > 0)
                        .slice(0, 6)
                        .map((hour, index) => (
                        <div key={`hour-${index}`} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                          <span className="font-medium">{hour.hourFormatted}</span>
                          <span className="text-sm text-gray-600">{hour.transactionCount} transactions</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-center py-8">
                    <RefreshCw className="w-6 h-6 animate-spin" />
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Key Insights */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertCircle className="w-5 h-5" />
                  Key Insights
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {salesData && outletData && paymentData && (
                    <>
                      <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                        <div className="font-medium text-yellow-800">Revenue Insight</div>
                        <div className="text-sm text-yellow-700">
                          Average transaction value is {formatCurrency(salesData.data.summary.averageTransactionValue)}
                        </div>
                      </div>
                      
                      <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                        <div className="font-medium text-blue-800">Payment Preference</div>
                        <div className="text-sm text-blue-700">
                          Most popular payment method: {
                            paymentData.data.paymentMethods.sort((a, b) => b.transactionCount - a.transactionCount)[0]?.method.replace('_', ' ') || 'N/A'
                          }
                        </div>
                      </div>

                      <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                        <div className="font-medium text-green-800">Top Performer</div>
                        <div className="text-sm text-green-700">
                          Best outlet: {outletData.data.summary.topPerformer} with {
                            formatCurrency(outletData.data.outlets[0]?.totalRevenue || 0)
                          }
                        </div>
                      </div>

                      {topItemsData && topItemsData.data.items.length > 0 && (
                        <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg">
                          <div className="font-medium text-purple-800">Best Seller</div>
                          <div className="text-sm text-purple-700">
                            Top item: {topItemsData.data.items[0].name} ({topItemsData.data.items[0].totalQuantity} sold)
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default withErrorBoundary(POSReports, { level: 'component' });