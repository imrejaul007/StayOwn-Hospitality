import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { TrendingUp, TrendingDown, IndianRupee, Users, Home, Star, AlertTriangle, Activity, BarChart3, Calculator, Clock } from 'lucide-react';
import { withErrorBoundary } from '../ErrorBoundary';

interface BusinessIntelligenceProps {
  hotelId: string;
  month?: number;
  year?: number;
}

interface KPIData {
  overview: {
    performanceScore: number;
    period: {
      month: number;
      year: number;
      monthName: string;
    };
  };
  revenue: {
    roomRevenue: number;
    adr: number;
    revpar: number;
    totalRevenue: number;
    averageRoomProfit: number;
    breakdown: {
      roomRevenue: number;
      nonRoomRevenue: number;
      addOns: number;
      discounts: number;
      taxes: number;
    };
  } | null;
  occupancy: {
    occupancyRate: number;
    roomNightsSold: number;
    availableRoomNights: number;
  } | null;
  profitability: {
    gop: number;
    goppar: number;
    cpor: number;
    marginPercent: number;
  } | null;
  productivity: {
    housekeeping: {
      cleanedRoomsPerHour: number;
      cleanedRooms: number;
      efficiency: string;
    };
    maintenance: {
      workOrdersPerHour: number;
      workOrdersClosed: number;
      efficiency: string;
    };
    frontDesk: {
      transactionsPerHour: number;
      totalTransactions: number;
      efficiency: string;
    };
  } | null;
  risk: {
    noShowRate: number;
    cancellationRate: number;
    guestSatisfaction: number;
    npsScore: number;
    fiveStarPercentage: number;
  } | null;
  floorMetrics: Array<{
    floor: number;
    profit: number;
    revenue: number;
    profitMargin: number;
  }>;
  trends: {
    adr: Array<{ date: string; value: number }>;
    occupancy: Array<{ date: string; value: number }>;
    revenue: Array<{ date: string; value: number }>;
    satisfaction: Array<{ date: string; value: number }>;
  };
  insights: string[];
  recommendations: string[];
}

const CHART_COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#00ff00'];

function BusinessIntelligenceDashboard({ hotelId, month, year }: BusinessIntelligenceProps) {
  const [data, setData] = useState<KPIData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchBusinessIntelligence = async () => {
    try {
      setRefreshing(true);
      const { data: result } = await api.get(`/reports/business-intelligence?hotelId=${hotelId}${month ? `&month=${month}` : ''}${year ? `&year=${year}` : ''}`);
      setData(result.data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchBusinessIntelligence();
  }, [hotelId, month, year]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(value);
  };

  const formatPercentage = (value: number) => {
    return `${value.toFixed(1)}%`;
  };

  const getPerformanceColor = (score: number) => {
    if (score >= 80) return 'bg-green-500';
    if (score >= 60) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const getEfficiencyColor = (efficiency: string) => {
    switch (efficiency) {
      case 'High': return 'bg-green-100 text-green-800';
      case 'Medium': return 'bg-yellow-100 text-yellow-800';
      case 'Low': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getTrendIcon = (value: number) => {
    return value > 0 ? <TrendingUp className="w-4 h-4 text-green-500" /> : <TrendingDown className="w-4 h-4 text-red-500" />;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2 text-gray-600">Loading business intelligence...</span>
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">
            <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Failed to Load Data</h3>
            <p className="text-gray-600 mb-4">{error}</p>
            <Button onClick={fetchBusinessIntelligence}>
              Try Again
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-gray-600">
            No business intelligence data available for the selected period.
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Performance Score */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-2xl font-bold">Business Intelligence Dashboard</CardTitle>
              <p className="text-gray-600 mt-1">
                {data.overview.period.monthName} {data.overview.period.year} Performance
              </p>
            </div>
            <div className="text-center">
              <div className={`inline-flex items-center justify-center w-16 h-16 rounded-full text-white text-xl font-bold ${getPerformanceColor(data.overview.performanceScore)}`}>
                {data.overview.performanceScore}
              </div>
              <div className="text-sm text-gray-600 mt-1">Performance Score</div>
            </div>
          </div>
        </CardHeader>
      </Card>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="revenue">Revenue</TabsTrigger>
          <TabsTrigger value="occupancy">Occupancy</TabsTrigger>
          <TabsTrigger value="productivity">Productivity</TabsTrigger>
          <TabsTrigger value="quality">Quality</TabsTrigger>
          <TabsTrigger value="insights">Insights</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
            {/* Revenue Overview */}
            {data.revenue && (
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Total Revenue</p>
                      <p className="text-2xl font-bold text-gray-900">{formatCurrency(data.revenue.totalRevenue)}</p>
                      <div className="flex items-center mt-2 text-sm">
                        <IndianRupee className="w-4 h-4 text-gray-500 mr-1" />
                        <span className="text-gray-600">ADR: {formatCurrency(data.revenue.adr)}</span>
                      </div>
                    </div>
                    <IndianRupee className="w-8 h-8 text-blue-500" />
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Occupancy Overview */}
            {data.occupancy && (
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Occupancy Rate</p>
                      <p className="text-2xl font-bold text-gray-900">{formatPercentage(data.occupancy.occupancyRate)}</p>
                      <div className="flex items-center mt-2 text-sm">
                        <Home className="w-4 h-4 text-gray-500 mr-1" />
                        <span className="text-gray-600">{data.occupancy.roomNightsSold} nights sold</span>
                      </div>
                    </div>
                    <Home className="w-8 h-8 text-green-500" />
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Profitability Overview */}
            {data.profitability && (
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">GOP Margin</p>
                      <p className="text-2xl font-bold text-gray-900">{formatPercentage(data.profitability.marginPercent)}</p>
                      <div className="flex items-center mt-2 text-sm">
                        <BarChart3 className="w-4 h-4 text-gray-500 mr-1" />
                        <span className="text-gray-600">GOP: {formatCurrency(data.profitability.gop)}</span>
                      </div>
                    </div>
                    <BarChart3 className="w-8 h-8 text-purple-500" />
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Guest Satisfaction Overview */}
            {data.risk && (
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Guest Satisfaction</p>
                      <p className="text-2xl font-bold text-gray-900">{data.risk.guestSatisfaction.toFixed(1)}/5</p>
                      <div className="flex items-center mt-2 text-sm">
                        <Star className="w-4 h-4 text-gray-500 mr-1" />
                        <span className="text-gray-600">NPS: {data.risk.npsScore.toFixed(0)}</span>
                      </div>
                    </div>
                    <Star className="w-8 h-8 text-yellow-500" />
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Key Trends Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Key Performance Trends</CardTitle>
            </CardHeader>
            <CardContent>
              {data.trends.revenue.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={data.trends.revenue.slice(-30)}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip formatter={(value: number) => formatCurrency(value)} />
                    <Legend />
                    <Line type="monotone" dataKey="value" stroke="#8884d8" strokeWidth={2} name="Revenue" />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-60 text-gray-500">
                  <div className="text-center">
                    <BarChart3 className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                    <p className="text-lg font-medium mb-2">No Trend Data Available</p>
                    <p className="text-sm">Revenue trend data will appear here once more data is collected over time.</p>
                  </div>
                </div>
              )}</CardContent>
          </Card>
        </TabsContent>

        {/* Revenue Tab */}
        <TabsContent value="revenue">
          {data.revenue ? (
            <div className="space-y-6">
              {/* Revenue Metrics Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <Card>
                  <CardContent className="p-6">
                    <p className="text-sm font-medium text-gray-600">Room Revenue</p>
                    <p className="text-2xl font-bold text-gray-900">{formatCurrency(data.revenue.roomRevenue)}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-6">
                    <p className="text-sm font-medium text-gray-600">ADR</p>
                    <p className="text-2xl font-bold text-gray-900">{formatCurrency(data.revenue.adr)}</p>
                    <p className="text-xs text-gray-500 mt-1">Average Daily Rate</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-6">
                    <p className="text-sm font-medium text-gray-600">RevPAR</p>
                    <p className="text-2xl font-bold text-gray-900">{formatCurrency(data.revenue.revpar)}</p>
                    <p className="text-xs text-gray-500 mt-1">Revenue per Available Room</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-6">
                    <p className="text-sm font-medium text-gray-600">Avg Room Profit</p>
                    <p className="text-2xl font-bold text-gray-900">{formatCurrency(data.revenue.averageRoomProfit)}</p>
                    <p className="text-xs text-gray-500 mt-1">Per room night</p>
                  </CardContent>
                </Card>
              </div>

              {/* Revenue Breakdown Chart */}
              <Card>
                <CardHeader>
                  <CardTitle>Revenue Breakdown</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={[
                          { name: 'Room Revenue', value: data.revenue.breakdown.roomRevenue },
                          { name: 'Add-ons', value: data.revenue.breakdown.addOns },
                          { name: 'Taxes', value: data.revenue.breakdown.taxes },
                          { name: 'Non-Room Revenue', value: data.revenue.breakdown.nonRoomRevenue }
                        ].filter(item => item.value > 0)}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {CHART_COLORS.map((color, index) => (
                          <Cell key={`cell-${index}`} fill={color} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: number) => formatCurrency(value)} />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Revenue Trend */}
              <Card>
                <CardHeader>
                  <CardTitle>Revenue Trend</CardTitle>
                </CardHeader>
                <CardContent>
                  {data.trends.revenue.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={data.trends.revenue.slice(-30)}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" />
                        <YAxis />
                        <Tooltip formatter={(value: number) => formatCurrency(value)} />
                        <Line type="monotone" dataKey="value" stroke="#8884d8" strokeWidth={2} />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-60 text-gray-500">
                      <div className="text-center">
                        <IndianRupee className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                        <p className="text-lg font-medium mb-2">No Revenue Trend Data</p>
                        <p className="text-sm">Historical revenue data will be displayed here.</p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          ) : (
            <Card>
              <CardContent className="p-6">
                <div className="text-center text-gray-600">
                  No revenue data available for the selected period.
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Occupancy Tab */}
        <TabsContent value="occupancy">
          {data.occupancy ? (
            <div className="space-y-6">
              {/* Occupancy Metrics */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card>
                  <CardContent className="p-6">
                    <p className="text-sm font-medium text-gray-600">Occupancy Rate</p>
                    <p className="text-3xl font-bold text-gray-900">{formatPercentage(data.occupancy.occupancyRate)}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-6">
                    <p className="text-sm font-medium text-gray-600">Nights Sold</p>
                    <p className="text-3xl font-bold text-gray-900">{data.occupancy.roomNightsSold}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-6">
                    <p className="text-sm font-medium text-gray-600">Available Nights</p>
                    <p className="text-3xl font-bold text-gray-900">{data.occupancy.availableRoomNights}</p>
                  </CardContent>
                </Card>
              </div>

              {/* Occupancy Trend */}
              <Card>
                <CardHeader>
                  <CardTitle>Occupancy Trend</CardTitle>
                </CardHeader>
                <CardContent>
                  {data.trends.occupancy.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={data.trends.occupancy.slice(-30)}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" />
                        <YAxis />
                        <Tooltip formatter={(value: number) => formatPercentage(value)} />
                        <Line type="monotone" dataKey="value" stroke="#82ca9d" strokeWidth={2} />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-60 text-gray-500">
                      <div className="text-center">
                        <Home className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                        <p className="text-lg font-medium mb-2">No Occupancy Trend Data</p>
                        <p className="text-sm">Historical occupancy data will be displayed here.</p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Floor Performance */}
              {data.floorMetrics.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Floor-wise Performance</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={data.floorMetrics}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="floor" />
                        <YAxis />
                        <Tooltip formatter={(value: number) => formatCurrency(value)} />
                        <Legend />
                        <Bar dataKey="revenue" fill="#8884d8" name="Revenue" />
                        <Bar dataKey="profit" fill="#82ca9d" name="Profit" />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              )}
            </div>
          ) : (
            <Card>
              <CardContent className="p-6">
                <div className="text-center text-gray-600">
                  No occupancy data available for the selected period.
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Productivity Tab */}
        <TabsContent value="productivity">
          {data.productivity ? (
            <div className="space-y-6">
              {/* Productivity Overview */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <Activity className="w-5 h-5 mr-2" />
                      Housekeeping
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div>
                        <p className="text-sm text-gray-600">Rooms Cleaned Per Hour</p>
                        <p className="text-2xl font-bold">{data.productivity.housekeeping.cleanedRoomsPerHour.toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Total Rooms Cleaned</p>
                        <p className="text-lg font-semibold">{data.productivity.housekeeping.cleanedRooms}</p>
                      </div>
                      <Badge className={getEfficiencyColor(data.productivity.housekeeping.efficiency)}>
                        {data.productivity.housekeeping.efficiency} Efficiency
                      </Badge>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <Clock className="w-5 h-5 mr-2" />
                      Maintenance
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div>
                        <p className="text-sm text-gray-600">Work Orders Per Hour</p>
                        <p className="text-2xl font-bold">{data.productivity.maintenance.workOrdersPerHour.toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Work Orders Closed</p>
                        <p className="text-lg font-semibold">{data.productivity.maintenance.workOrdersClosed}</p>
                      </div>
                      <Badge className={getEfficiencyColor(data.productivity.maintenance.efficiency)}>
                        {data.productivity.maintenance.efficiency} Efficiency
                      </Badge>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <Users className="w-5 h-5 mr-2" />
                      Front Desk
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div>
                        <p className="text-sm text-gray-600">Transactions Per Hour</p>
                        <p className="text-2xl font-bold">{data.productivity.frontDesk.transactionsPerHour.toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Total Transactions</p>
                        <p className="text-lg font-semibold">{data.productivity.frontDesk.totalTransactions}</p>
                      </div>
                      <Badge className={getEfficiencyColor(data.productivity.frontDesk.efficiency)}>
                        {data.productivity.frontDesk.efficiency} Efficiency
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          ) : (
            <Card>
              <CardContent className="p-6">
                <div className="text-center text-gray-600">
                  No productivity data available for the selected period.
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Quality Tab */}
        <TabsContent value="quality">
          {data.risk ? (
            <div className="space-y-6">
              {/* Risk Metrics */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <Card>
                  <CardContent className="p-6">
                    <p className="text-sm font-medium text-gray-600">No-Show Rate</p>
                    <p className="text-2xl font-bold text-red-600">{formatPercentage(data.risk.noShowRate)}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-6">
                    <p className="text-sm font-medium text-gray-600">Cancellation Rate</p>
                    <p className="text-2xl font-bold text-orange-600">{formatPercentage(data.risk.cancellationRate)}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-6">
                    <p className="text-sm font-medium text-gray-600">Guest Satisfaction</p>
                    <p className="text-2xl font-bold text-green-600">{data.risk.guestSatisfaction.toFixed(1)}/5</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-6">
                    <p className="text-sm font-medium text-gray-600">5-Star Reviews</p>
                    <p className="text-2xl font-bold text-yellow-600">{formatPercentage(data.risk.fiveStarPercentage)}</p>
                  </CardContent>
                </Card>
              </div>

              {/* Guest Satisfaction Trend */}
              <Card>
                <CardHeader>
                  <CardTitle>Guest Satisfaction Trend</CardTitle>
                </CardHeader>
                <CardContent>
                  {data.trends.satisfaction.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={data.trends.satisfaction.slice(-30)}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" />
                        <YAxis domain={[0, 5]} />
                        <Tooltip />
                        <Line type="monotone" dataKey="value" stroke="#ffc658" strokeWidth={2} />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-60 text-gray-500">
                      <div className="text-center">
                        <Star className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                        <p className="text-lg font-medium mb-2">No Satisfaction Trend Data</p>
                        <p className="text-sm">Guest satisfaction trends will be displayed here.</p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          ) : (
            <Card>
              <CardContent className="p-6">
                <div className="text-center text-gray-600">
                  No quality data available for the selected period.
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Insights Tab */}
        <TabsContent value="insights">
          <div className="space-y-6">
            {/* Key Insights */}
            <Card>
              <CardHeader>
                <CardTitle>Key Insights</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {data.insights.length > 0 ? (
                    data.insights.map((insight, index) => (
                      <div key={`data-insights-${index}-${insight}`} className="flex items-start space-x-3 p-3 bg-blue-50 rounded-lg">
                        <BarChart3 className="w-5 h-5 text-blue-500 mt-0.5" />
                        <p className="text-gray-700">{insight}</p>
                      </div>
                    ))
                  ) : (
                    <p className="text-gray-600">No insights available for the selected period.</p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Recommendations */}
            <Card>
              <CardHeader>
                <CardTitle>Recommendations</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {data.recommendations.length > 0 ? (
                    data.recommendations.map((recommendation, index) => (
                      <div key={`data-recommendations-${index}-${recommendation}`} className="flex items-start space-x-3 p-3 bg-green-50 rounded-lg">
                        <TrendingUp className="w-5 h-5 text-green-500 mt-0.5" />
                        <p className="text-gray-700">{recommendation}</p>
                      </div>
                    ))
                  ) : (
                    <p className="text-gray-600">No specific recommendations at this time. Keep up the good work!</p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Action Items */}
            <Card>
              <CardHeader>
                <CardTitle>Suggested Actions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-start space-x-3 p-3 bg-yellow-50 rounded-lg">
                    <Calculator className="w-5 h-5 text-yellow-500 mt-0.5" />
                    <div>
                      <p className="font-medium text-gray-900">Review KPI Calculations</p>
                      <p className="text-gray-600">Verify all revenue and cost calculations are accurate</p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-3 p-3 bg-purple-50 rounded-lg">
                    <Activity className="w-5 h-5 text-purple-500 mt-0.5" />
                    <div>
                      <p className="font-medium text-gray-900">Staff Performance Review</p>
                      <p className="text-gray-600">Analyze productivity metrics and provide feedback</p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-3 p-3 bg-red-50 rounded-lg">
                    <AlertTriangle className="w-5 h-5 text-red-500 mt-0.5" />
                    <div>
                      <p className="font-medium text-gray-900">Address Risk Factors</p>
                      <p className="text-gray-600">Focus on reducing no-shows and cancellations</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Refresh Button */}
      <div className="flex justify-center">
        <Button onClick={fetchBusinessIntelligence} disabled={refreshing}>
          {refreshing ? 'Refreshing...' : 'Refresh Data'}
        </Button>
      </div>
    </div>
  );
}

export default withErrorBoundary(BusinessIntelligenceDashboard, { level: 'component' });