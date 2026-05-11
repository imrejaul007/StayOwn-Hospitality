import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Mail, Globe, Users, Star, Eye, MousePointer, ShoppingCart, Target } from 'lucide-react';
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar } from 'recharts';
import { formatCurrency } from '@/utils/currencyUtils';
import { bookingEngineService, MarketingDashboardData } from '@/services/bookingEngineService';

interface MarketingStats {
  widgetPerformance: {
    totalImpressions: number;
    totalClicks: number;
    totalConversions: number;
    conversionRate: number;
  };
  emailMarketing: {
    totalSent: number;
    totalOpens: number;
    totalClicks: number;
    totalConversions: number;
    openRate: number;
    clickRate: number;
  };
  guestSegmentation: Array<{
    _id: string;
    count: number;
    averageLTV: number;
  }>;
  reviewSummary: {
    totalReviews: number;
    averageRating: number;
    positiveReviews: number;
  };
  ratingDistribution?: Record<number, number>;
  totalWidgets: number;
  activeCampaigns: number;
}

const MarketingDashboard: React.FC = () => {
  const [stats, setStats] = useState<MarketingStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const data = await bookingEngineService.getMarketingDashboard();
      setStats(data);
    } catch (error) {
      console.error('Failed to load marketing dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-lg">Loading marketing dashboard...</div>
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="p-6">
        <div className="text-center text-gray-500">Failed to load marketing data</div>
      </div>
    );
  }

  const segmentColors = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6'];

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Marketing Dashboard</h1>
        <Button onClick={fetchDashboardData}>
          Refresh Data
        </Button>
      </div>

      {/* Key Performance Indicators */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardContent className="flex items-center p-6">
            <Eye className="w-8 h-8 text-blue-600 mr-4" />
            <div>
              <p className="text-sm font-medium text-gray-600">Widget Impressions</p>
              <p className="text-2xl font-bold">{stats.widgetPerformance.totalImpressions.toLocaleString()}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center p-6">
            <MousePointer className="w-8 h-8 text-green-600 mr-4" />
            <div>
              <p className="text-sm font-medium text-gray-600">Widget Clicks</p>
              <p className="text-2xl font-bold">{stats.widgetPerformance.totalClicks.toLocaleString()}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center p-6">
            <ShoppingCart className="w-8 h-8 text-purple-600 mr-4" />
            <div>
              <p className="text-sm font-medium text-gray-600">Conversions</p>
              <p className="text-2xl font-bold">{stats.widgetPerformance.totalConversions.toLocaleString()}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center p-6">
            <Target className="w-8 h-8 text-orange-600 mr-4" />
            <div>
              <p className="text-sm font-medium text-gray-600">Conversion Rate</p>
              <p className="text-2xl font-bold">{stats.widgetPerformance.conversionRate.toFixed(2)}%</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="widgets" className="w-full">
        <TabsList>
          <TabsTrigger value="widgets">Booking Widgets</TabsTrigger>
          <TabsTrigger value="email">Email Marketing</TabsTrigger>
          <TabsTrigger value="guests">Guest Segmentation</TabsTrigger>
          <TabsTrigger value="reviews">Reviews</TabsTrigger>
        </TabsList>

        <TabsContent value="widgets">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Globe className="w-5 h-5 mr-2" />
                  Widget Performance Overview
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Total Active Widgets</span>
                    <Badge variant="secondary">{stats.totalWidgets}</Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Total Impressions</span>
                    <span className="font-semibold">{stats.widgetPerformance.totalImpressions.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Click-through Rate</span>
                    <span className="font-semibold">
                      {stats.widgetPerformance.totalImpressions > 0 
                        ? ((stats.widgetPerformance.totalClicks / stats.widgetPerformance.totalImpressions) * 100).toFixed(2)
                        : 0}%
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Conversion Rate</span>
                    <span className="font-semibold">{stats.widgetPerformance.conversionRate.toFixed(2)}%</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Widget Funnel</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="relative">
                    <div className="flex justify-between text-sm mb-1">
                      <span>Impressions</span>
                      <span>{stats.widgetPerformance.totalImpressions.toLocaleString()}</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-6">
                      <div className="bg-blue-500 h-6 rounded-full" style={{ width: '100%' }}></div>
                    </div>
                  </div>
                  <div className="relative">
                    <div className="flex justify-between text-sm mb-1">
                      <span>Clicks</span>
                      <span>{stats.widgetPerformance.totalClicks.toLocaleString()}</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-6">
                      <div 
                        className="bg-green-500 h-6 rounded-full" 
                        style={{ 
                          width: stats.widgetPerformance.totalImpressions > 0 
                            ? `${(stats.widgetPerformance.totalClicks / stats.widgetPerformance.totalImpressions) * 100}%`
                            : '0%'
                        }}
                      ></div>
                    </div>
                  </div>
                  <div className="relative">
                    <div className="flex justify-between text-sm mb-1">
                      <span>Conversions</span>
                      <span>{stats.widgetPerformance.totalConversions.toLocaleString()}</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-6">
                      <div 
                        className="bg-purple-500 h-6 rounded-full" 
                        style={{ 
                          width: stats.widgetPerformance.totalClicks > 0 
                            ? `${(stats.widgetPerformance.totalConversions / stats.widgetPerformance.totalClicks) * 100}%`
                            : '0%'
                        }}
                      ></div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="email">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Mail className="w-5 h-5 mr-2" />
                  Email Campaign Performance
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Active Campaigns</span>
                    <Badge variant="secondary">{stats.activeCampaigns}</Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Total Emails Sent</span>
                    <span className="font-semibold">{stats.emailMarketing.totalSent.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Open Rate</span>
                    <span className="font-semibold">{stats.emailMarketing.openRate.toFixed(2)}%</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Click Rate</span>
                    <span className="font-semibold">{stats.emailMarketing.clickRate.toFixed(2)}%</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Total Conversions</span>
                    <span className="font-semibold">{stats.emailMarketing.totalConversions.toLocaleString()}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Email Marketing Metrics</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={[
                    { name: 'Sent', value: stats.emailMarketing.totalSent, color: '#3b82f6' },
                    { name: 'Opened', value: stats.emailMarketing.totalOpens, color: '#10b981' },
                    { name: 'Clicked', value: stats.emailMarketing.totalClicks, color: '#f59e0b' },
                    { name: 'Converted', value: stats.emailMarketing.totalConversions, color: '#8b5cf6' }
                  ]}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="value" fill="#3b82f6" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="guests">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Users className="w-5 h-5 mr-2" />
                  Guest Segmentation
                </CardTitle>
              </CardHeader>
              <CardContent>
                {stats.guestSegmentation.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={stats.guestSegmentation}
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        dataKey="count"
                        nameKey="_id"
                      >
                        {stats.guestSegmentation.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={segmentColors[index % segmentColors.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="text-center text-gray-500 py-8">
                    No guest segmentation data available
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Segment Details</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {stats.guestSegmentation.map((segment, index) => (
                    <div key={segment._id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center">
                        <div 
                          className="w-4 h-4 rounded-full mr-3"
                          style={{ backgroundColor: segmentColors[index % segmentColors.length] }}
                        ></div>
                        <div>
                          <p className="font-medium capitalize">{segment._id || 'Unknown'}</p>
                          <p className="text-sm text-gray-600">{segment.count} guests</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">{formatCurrency(segment.averageLTV)}</p>
                        <p className="text-xs text-gray-500">Avg LTV</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="reviews">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Star className="w-5 h-5 mr-2" />
                  Review Summary
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Total Reviews</span>
                    <span className="font-semibold">{stats.reviewSummary.totalReviews}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Average Rating</span>
                    <div className="flex items-center">
                      <span className="font-semibold mr-1">{stats.reviewSummary.averageRating.toFixed(1)}</span>
                      <Star className="w-4 h-4 text-yellow-400 fill-current" />
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Positive Reviews</span>
                    <span className="font-semibold">{stats.reviewSummary.positiveReviews}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Satisfaction Rate</span>
                    <span className="font-semibold">
                      {stats.reviewSummary.totalReviews > 0 
                        ? ((stats.reviewSummary.positiveReviews / stats.reviewSummary.totalReviews) * 100).toFixed(1)
                        : 0}%
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Review Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {[5, 4, 3, 2, 1].map((rating) => {
                    const dist = stats.ratingDistribution || {};
                    const count = dist[rating] || 0;
                    const total = stats.reviewSummary.totalReviews || 1;
                    const pct = (count / total) * 100;
                    return (
                      <div key={rating} className="flex items-center space-x-2">
                        <span className="text-sm w-6">{rating}</span>
                        <Star className="w-4 h-4 text-yellow-400 fill-current" />
                        <div className="flex-1 bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-yellow-400 h-2 rounded-full"
                            style={{ width: `${pct}%` }}
                          ></div>
                        </div>
                        <span className="text-sm text-gray-600 w-8">{count}</span>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default MarketingDashboard;