import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts';
import { Calendar, TrendingUp, TrendingDown, Users, Package, Clock, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { api } from '../../services/api';
import { formatCurrency } from '../../utils/currencyUtils';
import { toast } from 'react-hot-toast';

interface StaffEfficiency {
  staffId: string;
  staffName: string;
  avgEfficiency: number;
  efficiencyRating: string;
  totalTasks: number;
  totalCost: number;
  costPerTask: number;
  quantityPerTask: number;
  uniqueRoomsServiced: number;
}

interface ConsumptionTrend {
  date: unknown;
  totalQuantity: number;
  totalCost: number;
  avgEfficiency: number;
  uniqueItems: number;
  consumptionCount: number;
}

interface TopConsumingItem {
  item: {
    name: string;
    category: string;
    unitPrice: number;
  };
  totalQuantity: number;
  totalCost: number;
  consumptionCount: number;
  avgEfficiency: number;
}

interface DashboardData {
  staffAnalytics: StaffEfficiency[];
  departmentSummary: {
    averageEfficiency: number;
    totalStaff: number;
    totalCost: number;
    totalTasks: number;
    avgCostPerTask: number;
  };
  trends: ConsumptionTrend[];
  topConsumingItems: TopConsumingItem[];
  peakHours: Array<{
    hour: number;
    count: number;
    totalQuantity: number;
    avgEfficiency: number;
  }>;
}

const HousekeepingInventoryDashboard: React.FC = () => {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedStaff, setSelectedStaff] = useState<string>('');
  const [dateRange, setDateRange] = useState({
    startDate: format(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'),
    endDate: format(new Date(), 'yyyy-MM-dd')
  });
  const [selectedRoomType, setSelectedRoomType] = useState<string>('');

  useEffect(() => {
    fetchDashboardData();
  }, [dateRange, selectedStaff, selectedRoomType]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);

      const params = new URLSearchParams({
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
        ...(selectedStaff && { staffId: selectedStaff }),
        ...(selectedRoomType && { roomType: selectedRoomType })
      });

      const [analyticsRes, trendsRes] = await Promise.all([
        api.get(`/inventory/consumption/housekeeping/analytics?${params}`),
        api.get(`/inventory/consumption/housekeeping/trends?${params}&period=daily&days=30`)
      ]);

      const analyticsData = analyticsRes.data;
      const trendsData = trendsRes.data;

      if (analyticsData.success && trendsData.success) {
        setData({
          ...analyticsData.data,
          trends: trendsData.data.trends,
          topConsumingItems: trendsData.data.topConsumingItems,
          peakHours: trendsData.data.peakHours
        });
      }
    } catch (error: unknown) {
      toast.error('Failed to load inventory dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const getEfficiencyColor = (rating: string) => {
    switch (rating) {
      case 'Excellent': return 'bg-green-500';
      case 'Good': return 'bg-blue-500';
      case 'Average': return 'bg-yellow-500';
      case 'Below Average': return 'bg-orange-500';
      case 'Needs Improvement': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getEfficiencyIcon = (efficiency: number) => {
    if (efficiency >= 95) return <TrendingUp className="h-4 w-4 text-green-500" />;
    if (efficiency >= 75) return <TrendingUp className="h-4 w-4 text-blue-500" />;
    return <TrendingDown className="h-4 w-4 text-red-500" />;
  };

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">No data available</p>
        <Button onClick={fetchDashboardData} className="mt-4">
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Housekeeping Inventory Dashboard</h1>
        <div className="flex gap-4">
          <Input
            type="date"
            value={dateRange.startDate}
            onChange={(e) => setDateRange({ ...dateRange, startDate: e.target.value })}
            className="w-40"
          />
          <Input
            type="date"
            value={dateRange.endDate}
            onChange={(e) => setDateRange({ ...dateRange, endDate: e.target.value })}
            className="w-40"
          />
          <Button onClick={fetchDashboardData}>
            <Calendar className="h-4 w-4 mr-2" />
            Update
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Average Efficiency</p>
                <p className="text-2xl font-bold">
                  {(data.departmentSummary?.totalTasks > 0
                    ? data.departmentSummary.averageEfficiency
                    : 0
                  ).toFixed(1)}%
                </p>
              </div>
              {getEfficiencyIcon(data.departmentSummary?.averageEfficiency ?? 0)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Staff</p>
                <p className="text-2xl font-bold">{data.departmentSummary?.totalStaff ?? 0}</p>
              </div>
              <Users className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Cost</p>
                <p className="text-2xl font-bold">{formatCurrency(data.departmentSummary?.totalCost ?? 0)}</p>
              </div>
              <Package className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Avg Cost/Task</p>
                <p className="text-2xl font-bold">{formatCurrency(data.departmentSummary?.avgCostPerTask ?? 0)}</p>
              </div>
              <Clock className="h-8 w-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs defaultValue="staff" className="space-y-6">
        <TabsList>
          <TabsTrigger value="staff">Staff Performance</TabsTrigger>
          <TabsTrigger value="trends">Consumption Trends</TabsTrigger>
          <TabsTrigger value="items">Top Items</TabsTrigger>
          <TabsTrigger value="analysis">Peak Analysis</TabsTrigger>
        </TabsList>

        <TabsContent value="staff" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Staff Efficiency Analytics</CardTitle>
            </CardHeader>
            <CardContent>
              {data.staffAnalytics.length === 0 ? (
                <div className="text-center py-8">
                  <Users className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500 text-sm">No staff efficiency data available. Assign housekeeping tasks to see performance metrics.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {data.staffAnalytics.map((staff) => (
                    <div key={staff.staffId} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center space-x-4">
                        <div>
                          <h3 className="font-medium">{staff.staffName}</h3>
                          <p className="text-sm text-gray-600">
                            {staff.totalTasks} tasks • {staff.uniqueRoomsServiced} rooms serviced
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center space-x-4">
                        <div className="text-right">
                          <p className="text-sm font-medium">{staff.avgEfficiency.toFixed(1)}% Efficiency</p>
                          <p className="text-sm text-gray-600">{formatCurrency(staff.costPerTask)}/task</p>
                        </div>

                        <Badge className={`${getEfficiencyColor(staff.efficiencyRating)} text-white`}>
                          {staff.efficiencyRating}
                        </Badge>

                        {getEfficiencyIcon(staff.avgEfficiency)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Staff Efficiency Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Efficiency Comparison</CardTitle>
            </CardHeader>
            <CardContent>
              {data.staffAnalytics.length === 0 ? (
                <div className="text-center py-8">
                  <TrendingUp className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500 text-sm">No efficiency comparison data available. Staff performance data will appear here once tasks are completed.</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={data.staffAnalytics}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="staffName" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="avgEfficiency" fill="#8884d8" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="trends" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Consumption Trends (Last 30 Days)</CardTitle>
            </CardHeader>
            <CardContent>
              {(!data.trends || data.trends.length === 0) ? (
                <div className="text-center py-8">
                  <TrendingUp className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500 text-sm">No consumption trend data available for the selected period.</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={400}>
                  <LineChart data={data.trends}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="date"
                      tickFormatter={(value) => {
                        if (value && value.day) {
                          return `${value.month}/${value.day}`;
                        }
                        return '';
                      }}
                    />
                    <YAxis yAxisId="left" />
                    <YAxis yAxisId="right" orientation="right" />
                    <Tooltip />
                    <Line
                      yAxisId="left"
                      type="monotone"
                      dataKey="totalQuantity"
                      stroke="#8884d8"
                      name="Quantity"
                    />
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="avgEfficiency"
                      stroke="#82ca9d"
                      name="Efficiency %"
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Cost Trends</CardTitle>
            </CardHeader>
            <CardContent>
              {(!data.trends || data.trends.length === 0) ? (
                <div className="text-center py-8">
                  <Package className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500 text-sm">No cost trend data available for the selected period.</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={data.trends}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="date"
                      tickFormatter={(value) => {
                        if (value && value.day) {
                          return `${value.month}/${value.day}`;
                        }
                        return '';
                      }}
                    />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="totalCost" fill="#FF8042" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="items" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Top Consuming Items</CardTitle>
            </CardHeader>
            <CardContent>
              {(!data.topConsumingItems || data.topConsumingItems.length === 0) ? (
                <div className="text-center py-8">
                  <Package className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500 text-sm">No inventory consumption data available. Items will appear here once housekeeping tasks consume inventory.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {data.topConsumingItems.map((item, index) => (
                    <div key={`data-topConsumingItems-${index}-${item?.item?.name}`} className="flex items-center justify-between p-4 border rounded-lg">
                      <div>
                        <h3 className="font-medium">{item?.item?.name}</h3>
                        <p className="text-sm text-gray-600">
                          Category: {item?.item?.category} • Unit Price: {formatCurrency(item?.item?.unitPrice ?? 0)}
                        </p>
                      </div>

                      <div className="text-right">
                        <p className="text-lg font-bold">{item.totalQuantity} units</p>
                        <p className="text-sm text-gray-600">
                          {formatCurrency(item.totalCost)} total • {item.avgEfficiency.toFixed(1)}% efficiency
                        </p>
                        <p className="text-sm text-gray-500">{item.consumptionCount} uses</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Items Distribution */}
          <Card>
            <CardHeader>
              <CardTitle>Items Distribution by Quantity</CardTitle>
            </CardHeader>
            <CardContent>
              {(!data.topConsumingItems || data.topConsumingItems.length === 0) ? (
                <div className="text-center py-8">
                  <Package className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500 text-sm">No item distribution data available yet.</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={data.topConsumingItems.slice(0, 5)}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ item, totalQuantity }) => `${item?.name}: ${totalQuantity}`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="totalQuantity"
                    >
                      {data.topConsumingItems.slice(0, 5).map((_entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analysis" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Peak Hours Analysis</CardTitle>
            </CardHeader>
            <CardContent>
              {(!data.peakHours || data.peakHours.length === 0) ? (
                <div className="text-center py-8">
                  <Clock className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500 text-sm">No peak hours data available. Data will populate as housekeeping tasks are completed throughout the day.</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={data.peakHours}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="hour"
                      tickFormatter={(hour) => `${hour}:00`}
                    />
                    <YAxis />
                    <Tooltip
                      formatter={(value, name) => [value, name === 'totalQuantity' ? 'Total Quantity' : 'Task Count']}
                      labelFormatter={(hour) => `Hour: ${hour}:00`}
                    />
                    <Bar dataKey="totalQuantity" fill="#8884d8" />
                    <Bar dataKey="count" fill="#82ca9d" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Peak Performance Hours</CardTitle>
              </CardHeader>
              <CardContent>
                {(!data.peakHours || data.peakHours.length === 0) ? (
                  <div className="text-center py-8">
                    <Clock className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500 text-sm">No performance data available yet.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {data.peakHours.slice(0, 5).map((hour) => (
                      <div key={hour.hour} className="flex justify-between items-center">
                        <span className="font-medium">{hour.hour}:00</span>
                        <div className="text-right">
                          <p className="text-sm">{hour.totalQuantity} items</p>
                          <p className="text-xs text-gray-600">{hour.avgEfficiency.toFixed(1)}% efficiency</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Recommendations</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {(data.departmentSummary?.averageEfficiency ?? 0) < 80 && (
                    <div className="flex items-start space-x-2 p-3 bg-red-50 rounded">
                      <AlertTriangle className="h-5 w-5 text-red-500 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-red-800">Low Efficiency Alert</p>
                        <p className="text-xs text-red-600">Department efficiency is below 80%. Consider training or process optimization.</p>
                      </div>
                    </div>
                  )}

                  {(data.departmentSummary?.avgCostPerTask ?? 0) > 50 && (
                    <div className="flex items-start space-x-2 p-3 bg-yellow-50 rounded">
                      <AlertTriangle className="h-5 w-5 text-yellow-500 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-yellow-800">High Cost per Task</p>
                        <p className="text-xs text-yellow-600">Average cost per task is high. Review inventory allocation strategies.</p>
                      </div>
                    </div>
                  )}

                  <div className="p-3 bg-blue-50 rounded">
                    <p className="text-sm font-medium text-blue-800">Optimization Tip</p>
                    <p className="text-xs text-blue-600">
                      {data.peakHours && data.peakHours.length > 0
                        ? `Peak hours are from ${data.peakHours[0]?.hour}:00. Consider scheduling more staff during these times.`
                        : 'Complete more housekeeping tasks to generate peak hour recommendations.'}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default HousekeepingInventoryDashboard;