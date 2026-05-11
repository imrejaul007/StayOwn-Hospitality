import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { api } from '@/services/api';
import { BarChart, LineChart, PieChart, TrendingUp, Users, MousePointer, Target, Globe, Smartphone, Monitor, Tablet } from 'lucide-react';

interface WidgetPerformance {
  widgetId: string;
  impressions: number;
  clicks: number;
  conversions: number;
  conversionRate: number;
  totalRevenue: number;
  averageValue: number;
}

interface WidgetAnalytics {
  performance: WidgetPerformance;
  funnel: {
    totalSessions: number;
    impressions: number;
    clicks: number;
    conversions: number;
  };
  timeSeries: Array<{
    _id: string;
    events: Array<{ event: string; count: number }>;
  }>;
  geographic: Array<{
    _id: string;
    impressions: number;
    conversions: number;
  }>;
  devices: Array<{
    _id: { deviceType: string; browser: string };
    impressions: number;
    conversions: number;
  }>;
}

interface Widget {
  _id: string;
  widgetId: string;
  name: string;
  type: string;
  isActive: boolean;
  performance: {
    impressions: number;
    clicks: number;
    conversions: number;
    conversionRate: number;
    averageBookingValue: number;
  };
}

interface PerformanceSummary {
  totalImpressions: number;
  totalClicks: number;
  totalConversions: number;
  totalRevenue: number;
  overallConversionRate: number;
}

const WidgetAnalyticsDashboard: React.FC = () => {
  const [widgets, setWidgets] = useState<Widget[]>([]);
  const [selectedWidget, setSelectedWidget] = useState<string | null>(null);
  const [analytics, setAnalytics] = useState<WidgetAnalytics | null>(null);
  const [summary, setSummary] = useState<PerformanceSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState(7);

  useEffect(() => {
    loadData();
  }, [dateRange]);

  const loadData = async () => {
    try {
      setLoading(true);

      // Load widgets and performance summary
      const [widgetsResponse, summaryResponse] = await Promise.all([
        api.get('/booking-engine/widgets'),
        api.get(`/booking-engine/widgets/performance/summary?dateRange=${dateRange}`)
      ]);

      setWidgets(widgetsResponse.data.data || []);
      setSummary(summaryResponse.data.data?.summary || null);

      // Auto-select first widget
      if (widgetsResponse.data.data?.length > 0 && !selectedWidget) {
        const firstWidget = widgetsResponse.data.data[0];
        setSelectedWidget(firstWidget.widgetId);
        loadWidgetAnalytics(firstWidget.widgetId);
      }
    } catch {
      // Error handled silently
    } finally {
      setLoading(false);
    }
  };

  const loadWidgetAnalytics = async (widgetId: string) => {
    try {
      const response = await api.get(`/booking-engine/widgets/${widgetId}/analytics?dateRange=${dateRange}`);
      setAnalytics(response.data.data);
    } catch {
      // Error handled silently
    }
  };

  const handleWidgetSelect = (widgetId: string) => {
    setSelectedWidget(widgetId);
    loadWidgetAnalytics(widgetId);
  };

  const formatNumber = (num: number): string => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  };

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const getDeviceIcon = (deviceType: string) => {
    switch (deviceType?.toLowerCase()) {
      case 'mobile': return <Smartphone className="w-4 h-4" />;
      case 'tablet': return <Tablet className="w-4 h-4" />;
      case 'desktop': return <Monitor className="w-4 h-4" />;
      default: return <Monitor className="w-4 h-4" />;
    }
  };

  const selectedWidgetData = widgets.find(w => w.widgetId === selectedWidget);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading widget analytics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Widget Analytics</h1>
          <p className="text-gray-600 mt-1">Track performance and optimize your booking widgets</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={dateRange}
            onChange={(e) => setDateRange(Number(e.target.value))}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
          </select>
          <Button onClick={loadData} variant="outline" size="sm">
            Refresh
          </Button>
        </div>
      </div>

      {/* Overall Performance Summary */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Impressions</p>
                  <p className="text-2xl font-bold text-gray-900">{formatNumber(summary.totalImpressions)}</p>
                </div>
                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                  <BarChart className="w-4 h-4 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Clicks</p>
                  <p className="text-2xl font-bold text-gray-900">{formatNumber(summary.totalClicks)}</p>
                </div>
                <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                  <MousePointer className="w-4 h-4 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Conversions</p>
                  <p className="text-2xl font-bold text-gray-900">{formatNumber(summary.totalConversions)}</p>
                </div>
                <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                  <Target className="w-4 h-4 text-purple-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Conversion Rate</p>
                  <p className="text-2xl font-bold text-gray-900">{summary.overallConversionRate.toFixed(2)}%</p>
                </div>
                <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center">
                  <TrendingUp className="w-4 h-4 text-orange-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Revenue</p>
                  <p className="text-2xl font-bold text-gray-900">{formatCurrency(summary.totalRevenue)}</p>
                </div>
                <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center">
                  <Users className="w-4 h-4 text-indigo-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Widget Selection */}
      <Card>
        <CardHeader>
          <CardTitle>Active Widgets</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {widgets.map((widget) => (
              <div role="button" tabIndex={0}
                key={widget._id}
                onClick={() => handleWidgetSelect(widget.widgetId)}
                className={`p-4 border rounded-lg cursor-pointer transition-all ${
                  selectedWidget === widget.widgetId
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
               onKeyDown={(e: React.KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); const clickHandler = () => handleWidgetSelect(widget.widgetId); if (typeof clickHandler === 'function') { clickHandler(e as any); } } }}>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-medium text-gray-900">{widget.name}</h3>
                  <Badge variant={widget.isActive ? 'default' : 'secondary'}>
                    {widget.type}
                  </Badge>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <p className="text-gray-600">Impressions</p>
                    <p className="font-semibold">{formatNumber(widget.performance?.impressions || 0)}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Conversions</p>
                    <p className="font-semibold">{widget.performance?.conversions || 0}</p>
                  </div>
                </div>
                <div className="mt-2">
                  <p className="text-gray-600 text-sm">Conversion Rate</p>
                  <p className="font-semibold text-lg">
                    {(widget.performance?.conversionRate || 0).toFixed(2)}%
                  </p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Detailed Analytics */}
      {selectedWidget && analytics && selectedWidgetData && (
        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="funnel">Conversion Funnel</TabsTrigger>
            <TabsTrigger value="geographic">Geographic</TabsTrigger>
            <TabsTrigger value="devices">Devices</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>{selectedWidgetData.name} - Performance Overview</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <p className="text-sm font-medium text-gray-600">Impressions</p>
                    <p className="text-3xl font-bold text-gray-900">
                      {formatNumber(analytics.performance.impressions)}
                    </p>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <p className="text-sm font-medium text-gray-600">Clicks</p>
                    <p className="text-3xl font-bold text-gray-900">
                      {formatNumber(analytics.performance.clicks)}
                    </p>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <p className="text-sm font-medium text-gray-600">Conversions</p>
                    <p className="text-3xl font-bold text-gray-900">
                      {analytics.performance.conversions}
                    </p>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <p className="text-sm font-medium text-gray-600">Avg. Booking Value</p>
                    <p className="text-3xl font-bold text-gray-900">
                      {formatCurrency(analytics.performance.averageValue)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="funnel" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Conversion Funnel</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {[
                    { label: 'Sessions', value: analytics.funnel.totalSessions, color: 'bg-blue-500' },
                    { label: 'Impressions', value: analytics.funnel.impressions, color: 'bg-green-500' },
                    { label: 'Clicks', value: analytics.funnel.clicks, color: 'bg-yellow-500' },
                    { label: 'Conversions', value: analytics.funnel.conversions, color: 'bg-purple-500' }
                  ].map((step, index) => (
                    <div key={step.label} className="relative">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-700">{step.label}</span>
                        <span className="text-sm font-bold text-gray-900">{step.value}</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-3">
                        <div
                          className={`h-3 rounded-full ${step.color}`}
                          style={{
                            width: `${index === 0 ? 100 : (step.value / analytics.funnel.totalSessions) * 100}%`
                          }}
                        ></div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="geographic" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Geographic Performance</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {analytics.geographic.map((geo, index) => (
                    <div key={geo._id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <Globe className="w-4 h-4 text-gray-600" />
                        <span className="font-medium">{geo._id || 'Unknown'}</span>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-gray-600">
                          {formatNumber(geo.impressions)} impressions • {geo.conversions} conversions
                        </p>
                        <p className="text-xs text-gray-500">
                          {geo.impressions > 0 ? ((geo.conversions / geo.impressions) * 100).toFixed(2) : 0}% conversion rate
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="devices" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Device & Browser Performance</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {analytics.devices.map((device, index) => (
                    <div key={device._id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        {getDeviceIcon(device._id.deviceType)}
                        <div>
                          <p className="font-medium capitalize">{device._id.deviceType || 'Unknown'}</p>
                          <p className="text-sm text-gray-600">{device._id.browser || 'Unknown Browser'}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-gray-600">
                          {formatNumber(device.impressions)} impressions • {device.conversions} conversions
                        </p>
                        <p className="text-xs text-gray-500">
                          {device.impressions > 0 ? ((device.conversions / device.impressions) * 100).toFixed(2) : 0}% conversion rate
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}

      {/* Widget Code Generator */}
      {selectedWidget && selectedWidgetData && (
        <Card>
          <CardHeader>
            <CardTitle>Widget Embed Code</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
              <pre className="text-sm whitespace-pre-wrap">
{`<!-- ${selectedWidgetData.name} -->
<div id="booking-widget-${selectedWidget}"></div>
<script>
  (function() {
    var script = document.createElement('script');
    script.src = '${window.location.origin}/widget.js';
    script.async = true;
    script.onload = function() {
      HotelBookingWidget.init({
        widgetId: '${selectedWidget}',
        type: '${selectedWidgetData.type}',
        theme: {
          primaryColor: '#3b82f6',
          secondaryColor: '#f3f4f6',
          textColor: '#1f2937'
        }
      });
    };
    document.head.appendChild(script);
  })();
</script>
<!-- End Hotel Booking Widget -->`}
              </pre>
            </div>
            <Button
              onClick={() => navigator.clipboard.writeText(`<!-- ${selectedWidgetData.name} -->
<div id="booking-widget-${selectedWidget}"></div>
<script>
  (function() {
    var script = document.createElement('script');
    script.src = '${window.location.origin}/widget.js';
    script.async = true;
    script.onload = function() {
      HotelBookingWidget.init({
        widgetId: '${selectedWidget}',
        type: '${selectedWidgetData.type}',
        theme: {
          primaryColor: '#3b82f6',
          secondaryColor: '#f3f4f6',
          textColor: '#1f2937'
        }
      });
    };
    document.head.appendChild(script);
  })();
</script>
<!-- End Hotel Booking Widget -->`)}
              className="mt-3"
              variant="outline"
              size="sm"
            >
              Copy Embed Code
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default WidgetAnalyticsDashboard;