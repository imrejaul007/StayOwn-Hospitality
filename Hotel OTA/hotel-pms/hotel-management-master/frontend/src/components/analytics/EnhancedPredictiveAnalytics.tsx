import React, { useState, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Progress } from '../ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import {
  TrendingUp,
  TrendingDown,
  Calendar,
  IndianRupee,
  Users,
  AlertTriangle,
  CheckCircle,
  Clock,
  Target,
  BarChart3,
  Activity,
  Zap,
  Brain,
  ChevronRight
} from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';

interface Property {
  id: string;
  name: string;
  brand: string;
  type: 'hotel' | 'resort' | 'aparthotel' | 'hostel' | 'boutique';
  location: {
    address: string;
    city: string;
    country: string;
    coordinates: { lat: number; lng: number };
  };
  contact: {
    phone: string;
    email: string;
    manager: string;
  };
  rooms: {
    total: number;
    occupied: number;
    available: number;
    outOfOrder: number;
  };
  performance: {
    occupancyRate: number;
    adr: number;
    revpar: number;
    revenue: number;
    lastMonth: {
      occupancyRate: number;
      adr: number;
      revpar: number;
      revenue: number;
    };
  };
  amenities: string[];
  rating: number;
  status: 'active' | 'inactive' | 'maintenance';
  features: {
    pms: boolean;
    pos: boolean;
    spa: boolean;
    restaurant: boolean;
    parking: boolean;
    wifi: boolean;
    fitness: boolean;
    pool: boolean;
  };
  operationalHours: {
    checkIn: string;
    checkOut: string;
    frontDesk: string;
  };
}

interface EnhancedPredictiveAnalyticsProps {
  properties: Property[];
  selectedProperty?: Property | null;
}

interface Forecast {
  period: string;
  revenue: number;
  occupancy: number;
  adr: number;
  confidence: number;
}

interface Insight {
  id: string;
  title: string;
  description: string;
  type: 'opportunity' | 'risk' | 'trend';
  impact: 'high' | 'medium' | 'low';
  confidence: number;
  timeframe: string;
  value: number;
  unit: string;
}

export const EnhancedPredictiveAnalytics: React.FC<EnhancedPredictiveAnalyticsProps> = ({
  properties,
  selectedProperty
}) => {
  const [timeRange, setTimeRange] = useState<'30d' | '90d' | '180d'>('90d');
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>(
    selectedProperty?.id || (properties.length > 0 ? properties[0].id : '')
  );

  const currentProperty = selectedProperty ||
                         properties.find(p => p.id === selectedPropertyId) ||
                         (properties.length > 0 ? properties[0] : null);

  // Generate forecast data based on historical trends
  const generateForecast = (): Forecast[] => {
    if (!currentProperty) return [];

    const periods = timeRange === '30d' ? 4 : timeRange === '90d' ? 12 : 24;
    const forecast: Forecast[] = [];

    // Base values
    const baseRevenue = currentProperty.performance.revenue;
    const baseOccupancy = currentProperty.performance.occupancyRate;
    const baseADR = currentProperty.performance.adr;

    // Calculate growth trends
    const revenueGrowth = ((currentProperty.performance.revenue - currentProperty.performance.lastMonth.revenue) / currentProperty.performance.lastMonth.revenue) || 0;
    const occupancyGrowth = ((currentProperty.performance.occupancyRate - currentProperty.performance.lastMonth.occupancyRate) / currentProperty.performance.lastMonth.occupancyRate) || 0;
    const adrGrowth = ((currentProperty.performance.adr - currentProperty.performance.lastMonth.adr) / currentProperty.performance.lastMonth.adr) || 0;

    for (let i = 1; i <= periods; i++) {
      const periodName = timeRange === '30d' ? `Week ${i}` :
                        timeRange === '90d' ? `Month ${i}` :
                        `Month ${i}`;

      // Apply seasonal variations and growth trends
      const seasonalFactor = 1 + (Math.sin((i / periods) * Math.PI * 2) * 0.15); // ±15% seasonal variation
      const trendFactor = 1 + (revenueGrowth * i * 0.1); // Trend continuation with dampening

      const projectedRevenue = baseRevenue * seasonalFactor * trendFactor;
      const projectedOccupancy = Math.min(100, Math.max(30, baseOccupancy * seasonalFactor * (1 + occupancyGrowth * i * 0.05)));
      const projectedADR = baseADR * (1 + adrGrowth * i * 0.02);

      forecast.push({
        period: periodName,
        revenue: Math.round(projectedRevenue),
        occupancy: Math.round(projectedOccupancy * 10) / 10,
        adr: Math.round(projectedADR),
        confidence: Math.max(60, 95 - (i * 2)) // Decreasing confidence over time
      });
    }

    return forecast;
  };

  // Generate AI insights based on data patterns
  const generateInsights = (): Insight[] => {
    if (!currentProperty) return [];

    const insights: Insight[] = [];
    const portfolio = properties.filter(p => p.status === 'active');
    const portfolioAvgRevenue = portfolio.reduce((sum, p) => sum + p.performance.revenue, 0) / portfolio.length;
    const portfolioAvgOccupancy = portfolio.reduce((sum, p) => sum + p.performance.occupancyRate, 0) / portfolio.length;

    // Revenue opportunity
    if (currentProperty.performance.revenue < portfolioAvgRevenue * 0.9) {
      insights.push({
        id: 'revenue-opportunity',
        title: 'Revenue Growth Opportunity',
        description: 'Property revenue is below portfolio average. Implementing dynamic pricing could increase revenue by 15-25%.',
        type: 'opportunity',
        impact: 'high',
        confidence: 82,
        timeframe: '30-60 days',
        value: (portfolioAvgRevenue - currentProperty.performance.revenue) * 0.2,
        unit: '₹'
      });
    }

    // Occupancy trend
    const occupancyTrend = currentProperty.performance.occupancyRate - currentProperty.performance.lastMonth.occupancyRate;
    if (occupancyTrend < -5) {
      insights.push({
        id: 'occupancy-decline',
        title: 'Declining Occupancy Trend',
        description: 'Occupancy rate has decreased significantly. Market analysis and promotional campaigns recommended.',
        type: 'risk',
        impact: 'high',
        confidence: 89,
        timeframe: 'Next 30 days',
        value: Math.abs(occupancyTrend),
        unit: '% decline'
      });
    } else if (occupancyTrend > 5) {
      insights.push({
        id: 'occupancy-growth',
        title: 'Strong Occupancy Growth',
        description: 'Positive occupancy trend detected. Consider rate optimization to maximize revenue.',
        type: 'opportunity',
        impact: 'medium',
        confidence: 76,
        timeframe: 'Next 45 days',
        value: occupancyTrend,
        unit: '% growth'
      });
    }

    // Seasonal prediction
    const currentMonth = new Date().getMonth();
    const peakMonths = [5, 6, 7, 11, 0]; // June, July, August, December, January
    if (peakMonths.includes(currentMonth)) {
      insights.push({
        id: 'seasonal-demand',
        title: 'Peak Season Demand Forecast',
        description: 'High demand period approaching. Optimal time for rate increases and inventory management.',
        type: 'opportunity',
        impact: 'high',
        confidence: 91,
        timeframe: 'Next 60 days',
        value: 25,
        unit: '% rate increase potential'
      });
    }

    // Competitive analysis
    const similarProperties = portfolio.filter(p => p.type === currentProperty.type && p.id !== currentProperty.id);
    if (similarProperties.length > 0) {
      const avgSimilarRevenue = similarProperties.reduce((sum, p) => sum + p.performance.revenue, 0) / similarProperties.length;
      if (currentProperty.performance.revenue > avgSimilarRevenue * 1.1) {
        insights.push({
          id: 'market-leader',
          title: 'Market Leadership Position',
          description: 'Property outperforms similar properties in portfolio. Strong position for market expansion.',
          type: 'trend',
          impact: 'medium',
          confidence: 78,
          timeframe: 'Ongoing',
          value: ((currentProperty.performance.revenue / avgSimilarRevenue) - 1) * 100,
          unit: '% above average'
        });
      }
    }

    return insights;
  };

  const forecast = generateForecast();
  const insights = generateInsights();

  const getInsightIcon = (type: string) => {
    switch (type) {
      case 'opportunity': return <TrendingUp className="h-4 w-4 text-green-500" />;
      case 'risk': return <AlertTriangle className="h-4 w-4 text-red-500" />;
      case 'trend': return <Activity className="h-4 w-4 text-blue-500" />;
      default: return <BarChart3 className="h-4 w-4" />;
    }
  };

  const getInsightColor = (type: string) => {
    switch (type) {
      case 'opportunity': return 'bg-green-100 text-green-800';
      case 'risk': return 'bg-red-100 text-red-800';
      case 'trend': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  if (!currentProperty) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="text-center">
            <Brain className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-4 text-lg font-semibold">No Property Selected</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Select a property to view predictive analytics and forecasts.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Predictive Analytics</h2>
          <p className="text-gray-600">
            AI-powered forecasts and insights • {currentProperty.name}
          </p>
        </div>
        <div className="flex items-center space-x-3">
          {properties.length > 1 && (
            <Select value={selectedPropertyId} onValueChange={setSelectedPropertyId}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Select property" />
              </SelectTrigger>
              <SelectContent>
                {properties.map((property) => (
                  <SelectItem key={property.id} value={property.id}>
                    {property.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <Select value={timeRange} onValueChange={(value: Record<string, unknown>) => setTimeRange(value)}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="30d">30 Days</SelectItem>
              <SelectItem value="90d">90 Days</SelectItem>
              <SelectItem value="180d">180 Days</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Key Forecast Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {forecast.length > 0 && (
          <>
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Forecast Revenue</p>
                    <p className="text-2xl font-bold">{formatCurrency(forecast[forecast.length - 1].revenue)}</p>
                    <p className="text-xs text-green-600">
                      {forecast[forecast.length - 1].confidence}% confidence
                    </p>
                  </div>
                  <IndianRupee className="h-8 w-8 text-blue-500" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Forecast Occupancy</p>
                    <p className="text-2xl font-bold">{forecast[forecast.length - 1].occupancy}%</p>
                    <p className="text-xs text-green-600">
                      {forecast[forecast.length - 1].confidence}% confidence
                    </p>
                  </div>
                  <Users className="h-8 w-8 text-green-500" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Forecast ADR</p>
                    <p className="text-2xl font-bold">{formatCurrency(forecast[forecast.length - 1].adr)}</p>
                    <p className="text-xs text-green-600">
                      {forecast[forecast.length - 1].confidence}% confidence
                    </p>
                  </div>
                  <Target className="h-8 w-8 text-purple-500" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">AI Insights</p>
                    <p className="text-2xl font-bold">{insights.length}</p>
                    <p className="text-xs text-blue-600">Active recommendations</p>
                  </div>
                  <Brain className="h-8 w-8 text-orange-500" />
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Tabs for different views */}
      <Tabs defaultValue="forecast" className="space-y-6">
        <TabsList>
          <TabsTrigger value="forecast">Revenue Forecast</TabsTrigger>
          <TabsTrigger value="insights">AI Insights</TabsTrigger>
          <TabsTrigger value="trends">Market Trends</TabsTrigger>
        </TabsList>

        <TabsContent value="forecast">
          <Card>
            <CardHeader>
              <CardTitle>Revenue & Occupancy Forecast</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={forecast}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="period" />
                    <YAxis />
                    <Tooltip
                      formatter={(value, name) => [
                        name === 'revenue' ? formatCurrency(value as number) :
                        name === 'occupancy' ? `${value}%` :
                        formatCurrency(value as number),
                        name === 'revenue' ? 'Revenue' :
                        name === 'occupancy' ? 'Occupancy' : 'ADR'
                      ]}
                    />
                    <Area type="monotone" dataKey="revenue" stackId="1" stroke="#3B82F6" fill="#3B82F6" fillOpacity={0.6} />
                    <Area type="monotone" dataKey="occupancy" stackId="2" stroke="#10B981" fill="#10B981" fillOpacity={0.6} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="insights">
          <div className="space-y-4">
            {insights.map((insight) => (
              <Card key={insight.id}>
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-4 flex-1">
                      {getInsightIcon(insight.type)}
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-2">
                          <h3 className="font-semibold">{insight.title}</h3>
                          <Badge className={getInsightColor(insight.type)}>
                            {insight.type}
                          </Badge>
                          <Badge variant="outline">
                            {insight.impact} impact
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mb-3">{insight.description}</p>
                        <div className="flex items-center space-x-4 text-sm">
                          <div className="flex items-center space-x-1">
                            <Clock className="h-4 w-4" />
                            <span>{insight.timeframe}</span>
                          </div>
                          <div className="flex items-center space-x-1">
                            <CheckCircle className="h-4 w-4 text-green-500" />
                            <span>{insight.confidence}% confidence</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold">
                        {insight.unit === '₹' ? formatCurrency(insight.value) : `${insight.value.toFixed(1)}${insight.unit}`}
                      </div>
                      <div className="text-xs text-muted-foreground">Potential Impact</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}

            {insights.length === 0 && (
              <Card>
                <CardContent className="py-12">
                  <div className="text-center">
                    <CheckCircle className="mx-auto h-12 w-12 text-green-500" />
                    <h3 className="mt-4 text-lg font-semibold">No Critical Insights</h3>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Your property is performing well. Continue monitoring for new opportunities.
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="trends">
          <Card>
            <CardHeader>
              <CardTitle>Market Trends Analysis</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h4 className="font-medium">Performance Trends</h4>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                      <div>
                        <div className="font-medium">Revenue Trend</div>
                        <div className="text-sm text-muted-foreground">Month-over-month</div>
                      </div>
                      <div className="flex items-center space-x-2">
                        {currentProperty.performance.revenue > currentProperty.performance.lastMonth.revenue ? (
                          <TrendingUp className="h-4 w-4 text-green-500" />
                        ) : (
                          <TrendingDown className="h-4 w-4 text-red-500" />
                        )}
                        <span className="font-medium">
                          {(((currentProperty.performance.revenue - currentProperty.performance.lastMonth.revenue) / currentProperty.performance.lastMonth.revenue) * 100).toFixed(1)}%
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                      <div>
                        <div className="font-medium">Occupancy Trend</div>
                        <div className="text-sm text-muted-foreground">Month-over-month</div>
                      </div>
                      <div className="flex items-center space-x-2">
                        {currentProperty.performance.occupancyRate > currentProperty.performance.lastMonth.occupancyRate ? (
                          <TrendingUp className="h-4 w-4 text-green-500" />
                        ) : (
                          <TrendingDown className="h-4 w-4 text-red-500" />
                        )}
                        <span className="font-medium">
                          {(currentProperty.performance.occupancyRate - currentProperty.performance.lastMonth.occupancyRate).toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="font-medium">Market Position</h4>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 bg-purple-50 rounded-lg">
                      <div>
                        <div className="font-medium">Portfolio Rank</div>
                        <div className="text-sm text-muted-foreground">By RevPAR</div>
                      </div>
                      <div className="text-lg font-bold">
                        #{properties.sort((a, b) => b.performance.revpar - a.performance.revpar).findIndex(p => p.id === currentProperty.id) + 1}
                      </div>
                    </div>

                    <div className="flex items-center justify-between p-3 bg-orange-50 rounded-lg">
                      <div>
                        <div className="font-medium">Type Average</div>
                        <div className="text-sm text-muted-foreground">vs. {currentProperty.type} properties</div>
                      </div>
                      <div className="text-lg font-bold text-green-600">
                        +{(((currentProperty.performance.revpar / (properties.filter(p => p.type === currentProperty.type).reduce((sum, p) => sum + p.performance.revpar, 0) / properties.filter(p => p.type === currentProperty.type).length)) - 1) * 100).toFixed(1)}%
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};