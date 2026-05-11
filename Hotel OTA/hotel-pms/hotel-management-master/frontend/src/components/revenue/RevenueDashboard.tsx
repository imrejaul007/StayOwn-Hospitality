import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TrendingUp, TrendingDown, IndianRupee, Target, Calendar, AlertTriangle } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { currencyFormatter } from '@/utils/currencyUtils';

interface RevenueSummary {
  totalRevenue: number;
  avgADR: number;
  avgRevPAR: number;
  avgOccupancy: number;
  totalRoomsSold: number;
  totalRoomsAvailable: number;
}

interface Recommendation {
  type: string;
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  action: string;
}

interface RevenueMetrics {
  _id: string;
  totalRevenue: number;
  avgADR: number;
  avgRevPAR: number;
  avgOccupancy: number;
  totalRoomsSold: number;
}

const RevenueDashboard: React.FC = () => {
  const [summary, setSummary] = useState<RevenueSummary | null>(null);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [revenueData, setRevenueData] = useState<RevenueMetrics[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRevenueDashboard();
  }, []);

  const fetchRevenueDashboard = async () => {
    try {
      setLoading(true);

      // Fetch revenue summary
      const { data: summaryData } = await api.get('/revenue-management/analytics/summary');
      if (summaryData.success) {
        setSummary(summaryData.data);
      }

      // Fetch optimization recommendations
      const { data: recData } = await api.get('/revenue-management/optimization/recommendations');
      if (recData.success) {
        setRecommendations(recData.data.recommendations || []);
      }

      // Fetch revenue analytics for chart
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(endDate.getDate() - 30);

      const { data: analyticsData } = await api.get('/revenue-management/analytics', {
        params: { startDate: startDate.toISOString(), endDate: endDate.toISOString() }
      });
      if (analyticsData.success) {
        setRevenueData(analyticsData.data.map((item: Record<string, unknown>) => ({
          ...item,
          date: new Date(item._id).toLocaleDateString()
        })));
      }

    } catch {
      // Error handled silently
    } finally {
      setLoading(false);
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'low': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'high': return <AlertTriangle className="w-4 h-4" />;
      case 'medium': return <Target className="w-4 h-4" />;
      default: return <TrendingUp className="w-4 h-4" />;
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-lg">Loading revenue dashboard...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Revenue Management Dashboard</h1>
        <Button onClick={fetchRevenueDashboard}>
          Refresh Data
        </Button>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardContent className="flex items-center p-6">
            <IndianRupee className="w-8 h-8 text-green-600 mr-4" />
            <div>
              <p className="text-sm font-medium text-gray-600">Total Revenue</p>
              <p className="text-2xl font-bold">{currencyFormatter(summary?.totalRevenue || 0)}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center p-6">
            <TrendingUp className="w-8 h-8 text-blue-600 mr-4" />
            <div>
              <p className="text-sm font-medium text-gray-600">Average ADR</p>
              <p className="text-2xl font-bold">{currencyFormatter(summary?.avgADR || 0)}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center p-6">
            <Target className="w-8 h-8 text-purple-600 mr-4" />
            <div>
              <p className="text-sm font-medium text-gray-600">Average RevPAR</p>
              <p className="text-2xl font-bold">{currencyFormatter(summary?.avgRevPAR || 0)}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center p-6">
            <Calendar className="w-8 h-8 text-orange-600 mr-4" />
            <div>
              <p className="text-sm font-medium text-gray-600">Average Occupancy</p>
              <p className="text-2xl font-bold">{(summary?.avgOccupancy || 0).toFixed(1)}%</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="analytics" className="w-full">
        <TabsList>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="recommendations">Recommendations ({recommendations.length})</TabsTrigger>
          <TabsTrigger value="forecast">Demand Forecast</TabsTrigger>
        </TabsList>

        <TabsContent value="analytics">
          <Card>
            <CardHeader>
              <CardTitle>Revenue Trends (Last 30 Days)</CardTitle>
            </CardHeader>
            <CardContent>
              {revenueData.length > 0 ? (
                <div className="space-y-6">
                  {/* Revenue Chart */}
                  <div>
                    <h3 className="text-lg font-semibold mb-4">Daily Revenue</h3>
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={revenueData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" />
                        <YAxis />
                        <Tooltip 
                          formatter={(value: number) => [currencyFormatter(value), 'Revenue']}
                        />
                        <Line 
                          type="monotone" 
                          dataKey="totalRevenue" 
                          stroke="#10b981" 
                          strokeWidth={2}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>

                  {/* ADR and Occupancy Chart */}
                  <div>
                    <h3 className="text-lg font-semibold mb-4">ADR vs Occupancy</h3>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={revenueData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" />
                        <YAxis yAxisId="left" orientation="left" />
                        <YAxis yAxisId="right" orientation="right" />
                        <Tooltip />
                        <Bar yAxisId="left" dataKey="avgADR" fill="#3b82f6" name="ADR" />
                        <Bar yAxisId="right" dataKey="avgOccupancy" fill="#f59e0b" name="Occupancy %" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              ) : (
                <p className="text-center text-gray-500 py-8">No revenue data available</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="recommendations">
          <Card>
            <CardHeader>
              <CardTitle>Optimization Recommendations</CardTitle>
            </CardHeader>
            <CardContent>
              {recommendations.length > 0 ? (
                <div className="space-y-4">
                  {recommendations.map((rec, index) => (
                    <div key={`recommendations-${index}-${rec.title}`} className="p-4 border rounded-lg">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-2">
                            {getPriorityIcon(rec.priority)}
                            <h3 className="font-semibold">{rec.title}</h3>
                            <Badge className={getPriorityColor(rec.priority)}>
                              {rec.priority.toUpperCase()}
                            </Badge>
                          </div>
                          <p className="text-gray-600 mb-2">{rec.description}</p>
                          <p className="text-sm font-medium text-blue-600">{rec.action}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <TrendingUp className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500">No recommendations available</p>
                  <p className="text-sm text-gray-400">Check back after more data is collected</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="forecast">
          <Card>
            <CardHeader>
              <CardTitle>Demand Forecast</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8">
                <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">Demand forecasting features</p>
                <p className="text-sm text-gray-400">Generate forecasts to optimize future pricing</p>
                <Button className="mt-4">Generate Forecast</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default RevenueDashboard;