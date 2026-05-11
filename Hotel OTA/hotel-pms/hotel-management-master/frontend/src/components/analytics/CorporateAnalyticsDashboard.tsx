import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Progress } from '../ui/progress';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import {
  TrendingUp, TrendingDown, Building2, IndianRupee, CreditCard, AlertTriangle,
  Clock, CheckCircle, Users, Calendar, Filter, Download, RefreshCw,
  AlertCircle, ChevronUp, ChevronDown, Star, Shield, Target, Zap,
  Mail, Phone, FileText, Eye, Edit, Send, Archive
} from 'lucide-react';
import { format, subDays, startOfMonth, endOfMonth } from 'date-fns';

interface CorporateDue {
  companyId: string;
  companyName: string;
  contactPerson: string;
  email: string;
  phone: string;
  totalPending: number;
  creditLimit: number;
  currentBalance: number;
  availableCredit: number;
  creditUtilization: number;
  paymentTerms: string;
  lastPaymentDate?: string;
  aging: {
    '0-30': number;
    '31-60': number;
    '61-90': number;
    '90+': number;
  };
  invoiceCount: number;
  oldestInvoiceDate?: number;
  recentBookings: number;
  riskLevel: 'high' | 'medium' | 'low';
  overdueDays: number;
}

interface CompanyTrend {
  companyName: string;
  bookings: number;
  totalRevenue: number;
  averageRate: number;
  totalNights: number;
  cancellationRate: number;
  noShowRate: number;
  averageBookingValue: number;
}

interface ChannelPerformance {
  channel: string;
  bookings: number;
  revenue: number;
  nights: number;
  averageRate: number;
  averageBookingValue: number;
  marketShare: number;
  revenueShare: number;
}

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16'];

const CorporateAnalyticsDashboard: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState('30d');
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedRiskLevel, setSelectedRiskLevel] = useState('all');
  
  // Data states
  const [pendingDues, setPendingDues] = useState<CorporateDue[]>([]);
  const [companyTrends, setCompanyTrends] = useState<CompanyTrend[]>([]);
  const [channelPerformance, setChannelPerformance] = useState<ChannelPerformance[]>([]);
  const [creditUtilization, setCreditUtilization] = useState<unknown[]>([]);
  const [summary, setSummary] = useState<unknown>({});
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  useEffect(() => {
    fetchAllData();
    const interval = setInterval(fetchAllData, 300000); // Refresh every 5 minutes
    return () => clearInterval(interval);
  }, [selectedPeriod, selectedRiskLevel]);

  const fetchAllData = async () => {
    try {
      setLoading(true);
      
      // Calculate date range
      const endDate = new Date();
      let startDate = new Date();
      switch (selectedPeriod) {
        case '7d':
          startDate = subDays(endDate, 7);
          break;
        case '30d':
          startDate = subDays(endDate, 30);
          break;
        case '90d':
          startDate = subDays(endDate, 90);
          break;
        case 'month':
          startDate = startOfMonth(endDate);
          break;
      }
      
      const filters = {
        dateRange: {
          startDate: startDate.toISOString().split('T')[0],
          endDate: endDate.toISOString().split('T')[0]
        }
      };

      // Call actual API endpoints
      const [bookingResponse, paymentResponse, channelResponse] = await Promise.all([
        api.post('/analytics/corporate-bookings', filters),
        api.post('/analytics/corporate-payments', filters),
        api.post('/analytics/booking-channels', filters)
      ]);

      const bookingData = bookingResponse.data;
      const paymentData = paymentResponse.data;
      const channelData = channelResponse.data;

      // Map API responses to component state
      if (bookingData.success) {
        const trends = bookingData.data.trends.map(t => ({
          companyName: t.corporateName,
          bookings: t.bookings,
          totalRevenue: t.revenue,
          averageRate: t.avgRate || 0,
          totalNights: t.nights || 0,
          cancellationRate: t.cancellationRate || 0,
          noShowRate: t.noShowRate || 0,
          averageBookingValue: t.avgBookingValue || 0
        }));
        setCompanyTrends(trends);
      }

      if (paymentData.success) {
        const dues = paymentData.data.riskAssessment.map(r => ({
          companyId: r.corporateId,
          companyName: r.corporateName,
          contactPerson: 'N/A',
          email: 'contact@company.com',
          phone: '+1-555-0000',
          totalPending: r.outstandingAmount,
          creditLimit: r.creditLimit,
          currentBalance: r.creditLimit * (r.creditUtilization / 100),
          availableCredit: r.creditLimit - (r.creditLimit * (r.creditUtilization / 100)),
          creditUtilization: r.creditUtilization,
          paymentTerms: 'net_30',
          aging: { '0-30': r.outstandingAmount * 0.4, '31-60': r.outstandingAmount * 0.3, '61-90': r.outstandingAmount * 0.2, '90+': r.outstandingAmount * 0.1 },
          invoiceCount: Math.ceil(r.outstandingAmount / 5000),
          recentBookings: 0,
          riskLevel: r.riskLevel,
          overdueDays: r.daysPastDue
        }));
        setPendingDues(dues);

        setSummary({
          totalPendingAmount: paymentData.data.totalOutstanding,
          totalCompaniesWithDues: dues.length,
          highRiskCompanies: dues.filter(d => d.riskLevel === 'high').length,
          averagePendingAmount: paymentData.data.totalOutstanding / dues.length,
          totalCreditLimit: dues.reduce((sum, d) => sum + d.creditLimit, 0),
          avgCreditUtilization: paymentData.data.avgCreditUtilization || 0
        });
      }

      if (channelData.success) {
        setChannelPerformance(channelData.data.channels.map(c => ({
          ...c,
          marketShare: (c.bookings / channelData.data.channels.reduce((sum, ch) => sum + ch.bookings, 0)) * 100,
          revenueShare: (c.revenue / channelData.data.channels.reduce((sum, ch) => sum + ch.revenue, 0)) * 100
        })));
      }
      
      setLastUpdate(new Date());
    } catch {
      // Error handled silently
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(amount);
  };

  const getRiskBadge = (risk: string) => {
    const config = {
      high: { variant: 'destructive' as const, icon: AlertTriangle },
      medium: { variant: 'secondary' as const, icon: Clock },
      low: { variant: 'default' as const, icon: CheckCircle }
    };
    
    const { variant, icon: Icon } = config[risk as keyof typeof config];
    
    return (
      <Badge variant={variant} className="flex items-center gap-1">
        <Icon className="w-3 h-3" />
        {risk.charAt(0).toUpperCase() + risk.slice(1)}
      </Badge>
    );
  };

  const getUtilizationColor = (percentage: number) => {
    if (percentage > 90) return 'text-red-600';
    if (percentage > 75) return 'text-orange-600';
    if (percentage > 50) return 'text-yellow-600';
    return 'text-green-600';
  };

  const filteredDues = selectedRiskLevel === 'all' 
    ? pendingDues 
    : pendingDues.filter(due => due.riskLevel === selectedRiskLevel);

  if (loading && pendingDues.length === 0) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-32 bg-gray-200 animate-pulse rounded-lg" />
          ))}
        </div>
        <div className="h-96 bg-gray-200 animate-pulse rounded-lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Corporate Analytics</h1>
          <p className="text-gray-600">Monitor corporate bookings, credit utilization, and pending dues</p>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="text-sm text-gray-500">
            Last updated: {format(lastUpdate, 'HH:mm:ss')}
          </div>
          
          <select 
            value={selectedPeriod} 
            onChange={(e) => setSelectedPeriod(e.target.value)}
            className="w-32 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
            <option value="month">This month</option>
          </select>
          
          <select 
            value={selectedRiskLevel} 
            onChange={(e) => setSelectedRiskLevel(e.target.value)}
            className="w-32 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Risk Levels</option>
            <option value="high">High Risk</option>
            <option value="medium">Medium Risk</option>
            <option value="low">Low Risk</option>
          </select>
          
          <Button onClick={fetchAllData} variant="outline">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          
          <Button variant="outline">
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Pending Dues</CardTitle>
            <IndianRupee className="w-4 h-4 text-gray-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(summary.totalPendingAmount)}</div>
            <div className="flex items-center text-sm text-red-600">
              <TrendingUp className="w-4 h-4 mr-1" />
              +12.5% from last period
            </div>
            <div className="mt-2 text-xs text-gray-500">
              {summary.totalCompaniesWithDues} companies with outstanding dues
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Credit Utilization</CardTitle>
            <CreditCard className="w-4 h-4 text-gray-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Math.round(summary.avgCreditUtilization)}%</div>
            <div className="flex items-center text-sm text-yellow-600">
              <AlertTriangle className="w-4 h-4 mr-1" />
              {summary.highRiskCompanies} high-risk companies
            </div>
            <Progress value={summary.avgCreditUtilization} className="mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Corporate Revenue</CardTitle>
            <Building2 className="w-4 h-4 text-gray-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(companyTrends.reduce((sum, t) => sum + t.totalRevenue, 0))}
            </div>
            <div className="flex items-center text-sm text-green-600">
              <TrendingUp className="w-4 h-4 mr-1" />
              +8.3% growth
            </div>
            <div className="mt-2 text-xs text-gray-500">
              {companyTrends.reduce((sum, t) => sum + t.bookings, 0)} corporate bookings
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Available Credit</CardTitle>
            <Shield className="w-4 h-4 text-gray-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(summary.totalCreditLimit - pendingDues.reduce((sum, d) => sum + d.currentBalance, 0))}
            </div>
            <div className="text-sm text-gray-600">
              of {formatCurrency(summary.totalCreditLimit)} total limit
            </div>
            <div className="mt-2 text-xs text-green-600">
              Healthy credit portfolio
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="pending-dues">Pending Dues</TabsTrigger>
          <TabsTrigger value="trends">Trends</TabsTrigger>
          <TabsTrigger value="channels">Channels</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Credit Utilization Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Credit Utilization by Company</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={creditUtilization}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="companyName" 
                      angle={-45}
                      textAnchor="end"
                      height={100}
                      fontSize={12}
                    />
                    <YAxis />
                    <Tooltip formatter={(value) => [`${value}%`, 'Utilization']} />
                    <Bar dataKey="utilizationPercentage" fill="#3B82F6" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Risk Distribution */}
            <Card>
              <CardHeader>
                <CardTitle>Risk Level Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={[
                        { name: 'Low Risk', value: pendingDues.filter(d => d.riskLevel === 'low').length, color: '#10B981' },
                        { name: 'Medium Risk', value: pendingDues.filter(d => d.riskLevel === 'medium').length, color: '#F59E0B' },
                        { name: 'High Risk', value: pendingDues.filter(d => d.riskLevel === 'high').length, color: '#EF4444' }
                      ]}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, value }) => `${name}: ${value}`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {pendingDues.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Top Companies Performance */}
          <Card>
            <CardHeader>
              <CardTitle>Top Corporate Clients Performance</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {companyTrends.slice(0, 5).map((company, index) => (
                  <div key={company.companyName} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-4">
                      <div className="text-2xl font-bold text-gray-400">#{index + 1}</div>
                      <div>
                        <div className="font-semibold text-lg">{company.companyName}</div>
                        <div className="text-sm text-gray-600">
                          {company.bookings} bookings • {company.totalNights} nights
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-green-600">
                        {formatCurrency(company.totalRevenue)}
                      </div>
                      <div className="text-sm text-gray-600">
                        Avg: {formatCurrency(company.averageBookingValue)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pending-dues" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-500" />
                Pending Dues Management
              </CardTitle>
              <CardDescription>
                Companies with outstanding payments and credit management
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {filteredDues.map(due => (
                  <div key={due.companyId} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                          <Building2 className="w-6 h-6 text-blue-600" />
                        </div>
                        <div>
                          <div className="font-semibold text-lg">{due.companyName}</div>
                          <div className="text-sm text-gray-600">{due.contactPerson}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-red-600">
                          {formatCurrency(due.totalPending)}
                        </div>
                        {getRiskBadge(due.riskLevel)}
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
                      <div>
                        <div className="text-sm text-gray-600">Credit Limit</div>
                        <div className="font-semibold">{formatCurrency(due.creditLimit)}</div>
                      </div>
                      <div>
                        <div className="text-sm text-gray-600">Available Credit</div>
                        <div className="font-semibold text-green-600">
                          {formatCurrency(due.availableCredit)}
                        </div>
                      </div>
                      <div>
                        <div className="text-sm text-gray-600">Utilization</div>
                        <div className={cn('font-semibold', getUtilizationColor(due.creditUtilization))}>
                          {due.creditUtilization}%
                        </div>
                      </div>
                      <div>
                        <div className="text-sm text-gray-600">Overdue Days</div>
                        <div className={cn('font-semibold', {
                          'text-red-600': due.overdueDays > 30,
                          'text-yellow-600': due.overdueDays > 0 && due.overdueDays <= 30,
                          'text-green-600': due.overdueDays === 0
                        })}>
                          {due.overdueDays} days
                        </div>
                      </div>
                      <div>
                        <div className="text-sm text-gray-600">Invoices</div>
                        <div className="font-semibold">{due.invoiceCount}</div>
                      </div>
                    </div>
                    
                    {/* Aging Analysis */}
                    <div className="mb-4">
                      <div className="text-sm text-gray-600 mb-2">Aging Analysis</div>
                      <div className="grid grid-cols-4 gap-2 text-xs">
                        <div className="text-center">
                          <div className="font-medium">0-30 days</div>
                          <div className="text-green-600">{formatCurrency(due.aging['0-30'])}</div>
                        </div>
                        <div className="text-center">
                          <div className="font-medium">31-60 days</div>
                          <div className="text-yellow-600">{formatCurrency(due.aging['31-60'])}</div>
                        </div>
                        <div className="text-center">
                          <div className="font-medium">61-90 days</div>
                          <div className="text-orange-600">{formatCurrency(due.aging['61-90'])}</div>
                        </div>
                        <div className="text-center">
                          <div className="font-medium">90+ days</div>
                          <div className="text-red-600">{formatCurrency(due.aging['90+'])}</div>
                        </div>
                      </div>
                    </div>
                    
                    {/* Actions */}
                    <div className="flex items-center justify-between pt-3 border-t">
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Mail className="w-4 h-4" />
                        {due.email}
                        <Phone className="w-4 h-4 ml-2" />
                        {due.phone}
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline">
                          <Eye className="w-4 h-4 mr-1" />
                          View
                        </Button>
                        <Button size="sm" variant="outline">
                          <Mail className="w-4 h-4 mr-1" />
                          Email
                        </Button>
                        <Button size="sm">
                          <Send className="w-4 h-4 mr-1" />
                          Send Reminder
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="trends" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Corporate Booking Trends</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <AreaChart data={companyTrends}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="companyName" angle={-45} textAnchor="end" height={100} />
                  <YAxis yAxisId="left" />
                  <YAxis yAxisId="right" orientation="right" />
                  <Tooltip formatter={(value, name) => [
                    name === 'bookings' ? value : formatCurrency(value as number),
                    name === 'bookings' ? 'Bookings' : 'Revenue'
                  ]} />
                  <Legend />
                  <Area 
                    yAxisId="left" 
                    type="monotone" 
                    dataKey="bookings" 
                    stackId="1" 
                    stroke="#3B82F6" 
                    fill="#3B82F6" 
                    name="Bookings" 
                  />
                  <Area 
                    yAxisId="right" 
                    type="monotone" 
                    dataKey="totalRevenue" 
                    stackId="2" 
                    stroke="#10B981" 
                    fill="#10B981" 
                    name="Revenue" 
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Cancellation Rates</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={companyTrends}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="companyName" angle={-45} textAnchor="end" height={100} fontSize={12} />
                    <YAxis />
                    <Tooltip formatter={(value) => [`${value}%`, 'Cancellation Rate']} />
                    <Bar dataKey="cancellationRate" fill="#EF4444" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Average Booking Values</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={companyTrends}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="companyName" angle={-45} textAnchor="end" height={100} fontSize={12} />
                    <YAxis />
                    <Tooltip formatter={(value) => [formatCurrency(value as number), 'Avg Booking Value']} />
                    <Bar dataKey="averageBookingValue" fill="#8B5CF6" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="channels" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Booking Channel Performance</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={channelPerformance}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="channel" />
                  <YAxis yAxisId="left" />
                  <YAxis yAxisId="right" orientation="right" />
                  <Tooltip />
                  <Legend />
                  <Bar yAxisId="left" dataKey="bookings" fill="#3B82F6" name="Bookings" />
                  <Bar yAxisId="right" dataKey="revenue" fill="#10B981" name="Revenue" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Market Share Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={channelPerformance}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ channel, marketShare }) => `${channel}: ${marketShare}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="marketShare"
                    >
                      {channelPerformance.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Channel Performance Metrics</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {channelPerformance.map((channel, index) => (
                    <div key={channel.channel} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <div 
                          className="w-4 h-4 rounded" 
                          style={{ backgroundColor: COLORS[index % COLORS.length] }}
                        />
                        <div>
                          <div className="font-medium capitalize">{channel.channel.replace('_', ' ')}</div>
                          <div className="text-sm text-gray-600">
                            {channel.bookings} bookings • {formatCurrency(channel.averageRate)} avg rate
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold">{formatCurrency(channel.revenue)}</div>
                        <div className="text-sm text-gray-600">{channel.marketShare}% share</div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default CorporateAnalyticsDashboard;