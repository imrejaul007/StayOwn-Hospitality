import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from '@/utils/toast';
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar, RadarChart, Radar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PolarGrid, PolarAngleAxis, PolarRadiusAxis, Cell, PieChart, Pie,
  ScatterChart, Scatter, ComposedChart
} from 'recharts';
import {
  Brain, TrendingUp, TrendingDown, IndianRupee, Target, AlertTriangle,
  Zap, Eye, Settings, RefreshCw, Download, Calendar, Users, Building2,
  BarChart3, PieChart as PieChartIcon, Activity, Award, Shield, Clock,
  Lightbulb, Sparkles, Bot, Cpu, Database, Wifi, WifiOff, CheckCircle,
  AlertCircle, Star, ArrowUp, ArrowDown, Equal, ChevronRight, Info
} from 'lucide-react';
import { format, addDays, subDays } from 'date-fns';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/utils/currencyUtils';
import { withErrorBoundary } from '../ErrorBoundary';
import { api } from '../../services/api';

interface AIInsight {
  id: string;
  type: 'demand' | 'pricing' | 'revenue' | 'risk' | 'opportunity';
  severity: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  confidence: number;
  impact: number;
  actionRequired: boolean;
  recommendation: string;
  data: unknown;
  timestamp: Date;
}

interface ForecastData {
  date: string;
  demandScore: number;
  expectedOccupancy: number;
  confidence: number;
  basePrice: number;
  optimizedPrice: number;
  projectedRevenue: number;
  factors: {
    seasonal: number;
    events: number;
    competition: number;
    historical: number;
  };
}

interface PricingRecommendation {
  roomType: string;
  currentPrice: number;
  recommendedPrice: number;
  priceChange: number;
  revenueImpact: number;
  confidence: number;
  strategy: string;
  riskLevel: string;
}

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];

const AIDashboard: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [timeframe, setTimeframe] = useState('30d');
  const [refreshing, setRefreshing] = useState(false);
  const [notConfigured, setNotConfigured] = useState(false);

  // AI Data States
  const [aiInsights, setAiInsights] = useState<AIInsight[]>([]);
  const [forecastData, setForecastData] = useState<ForecastData[]>([]);
  const [pricingRecommendations, setPricingRecommendations] = useState<PricingRecommendation[]>([]);
  const [performanceMetrics, setPerformanceMetrics] = useState<unknown>({});
  const [modelHealth, setModelHealth] = useState<unknown>({});

  // UI States
  const [selectedInsight, setSelectedInsight] = useState<AIInsight | null>(null);
  const [showPredictionDetails, setShowPredictionDetails] = useState(false);

  useEffect(() => {
    loadAIDashboardData();
  }, [timeframe]);

  const loadAIDashboardData = async () => {
    try {
      setRefreshing(true);

      // Call real backend AI endpoints
      const [dashboardRes, insightsRes, demandRes, pricingRes, healthRes] = await Promise.allSettled([
        api.get('/ai/dashboard', { params: { timeframe } }),
        api.get('/ai/insights', { params: { timeframe } }),
        api.get('/ai/forecast/demand', { params: { timeframe } }),
        api.get('/ai/pricing/recommendations', { params: { timeframe } }),
        api.get('/ai/model/health')
      ]);

      // Check if all returned 501 (not implemented)
      const allNotImplemented = [dashboardRes, insightsRes, demandRes, pricingRes, healthRes].every(
        r => r.status === 'rejected' && (r.reason?.response?.status === 501 || r.reason?.response?.status === 404)
      );

      if (allNotImplemented) {
        setNotConfigured(true);
        setAiInsights([]);
        setForecastData([]);
        setPricingRecommendations([]);
        setPerformanceMetrics({});
        setModelHealth({});
        return;
      }

      setNotConfigured(false);

      // Process insights
      if (insightsRes.status === 'fulfilled' && insightsRes.value.data?.data) {
        const rawInsights = Array.isArray(insightsRes.value.data.data)
          ? insightsRes.value.data.data
          : insightsRes.value.data.data.insights || [];
        setAiInsights(rawInsights.map((i: Record<string, unknown>) => ({
          ...i,
          timestamp: i.timestamp ? new Date(i.timestamp as string) : new Date()
        })));
      } else {
        setAiInsights([]);
      }

      // Process forecast data
      if (demandRes.status === 'fulfilled' && demandRes.value.data?.data) {
        const rawForecast = Array.isArray(demandRes.value.data.data)
          ? demandRes.value.data.data
          : demandRes.value.data.data.forecasts || [];
        setForecastData(rawForecast);
      } else {
        setForecastData([]);
      }

      // Process pricing recommendations
      if (pricingRes.status === 'fulfilled' && pricingRes.value.data?.data) {
        const rawPricing = Array.isArray(pricingRes.value.data.data)
          ? pricingRes.value.data.data
          : pricingRes.value.data.data.recommendations || [];
        setPricingRecommendations(rawPricing);
      } else {
        setPricingRecommendations([]);
      }

      // Process dashboard / performance metrics
      if (dashboardRes.status === 'fulfilled' && dashboardRes.value.data?.data) {
        setPerformanceMetrics(dashboardRes.value.data.data.performanceMetrics || dashboardRes.value.data.data);
      } else {
        setPerformanceMetrics({});
      }

      // Process model health
      if (healthRes.status === 'fulfilled' && healthRes.value.data?.data) {
        setModelHealth(healthRes.value.data.data);
      } else {
        setModelHealth({});
      }
    } catch (error) {
      toast.error('Failed to load AI dashboard data');
      setNotConfigured(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const getInsightIcon = (type: string) => {
    switch (type) {
      case 'demand': return <TrendingUp className="w-4 h-4" />;
      case 'pricing': return <IndianRupee className="w-4 h-4" />;
      case 'revenue': return <Target className="w-4 h-4" />;
      case 'risk': return <AlertTriangle className="w-4 h-4" />;
      case 'opportunity': return <Lightbulb className="w-4 h-4" />;
      default: return <Info className="w-4 h-4" />;
    }
  };

  const getInsightColor = (severity: string) => {
    switch (severity) {
      case 'high': return 'border-red-300 bg-red-50';
      case 'medium': return 'border-yellow-300 bg-yellow-50';
      case 'low': return 'border-blue-300 bg-blue-50';
      default: return 'border-gray-300 bg-gray-50';
    }
  };

  const getSeverityBadge = (severity: string) => {
    const config = {
      high: { color: 'bg-red-100 text-red-800', icon: AlertTriangle },
      medium: { color: 'bg-yellow-100 text-yellow-800', icon: AlertCircle },
      low: { color: 'bg-blue-100 text-blue-800', icon: Info }
    };
    
    const { color, icon: Icon } = config[severity as keyof typeof config];
    
    return (
      <Badge className={cn('flex items-center gap-1', color)}>
        <Icon className="w-3 h-3" />
        {severity.toUpperCase()}
      </Badge>
    );
  };

  const getModelStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy': return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'warning': return <AlertTriangle className="w-4 h-4 text-yellow-600" />;
      case 'error': return <AlertCircle className="w-4 h-4 text-red-600" />;
      case 'training': return <RefreshCw className="w-4 h-4 text-blue-600 animate-spin" />;
      default: return <Activity className="w-4 h-4 text-gray-600" />;
    }
  };

  const getPriceChangeIcon = (change: number) => {
    if (change > 0) return <ArrowUp className="w-4 h-4 text-green-600" />;
    if (change < 0) return <ArrowDown className="w-4 h-4 text-red-600" />;
    return <Equal className="w-4 h-4 text-gray-600" />;
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (notConfigured) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
              <div className="p-2 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg">
                <Brain className="w-6 h-6 text-white" />
              </div>
              AI-Powered Analytics
            </h1>
          </div>
        </div>
        <Card className="border-dashed">
          <CardContent className="p-12 text-center">
            <WifiOff className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-800 mb-2">AI Insights Not Configured</h2>
            <p className="text-gray-600 max-w-md mx-auto mb-6">
              AI-powered insights are not yet configured for your property.
              Contact support to enable demand forecasting, pricing optimization, and intelligent recommendations.
            </p>
            <Button onClick={loadAIDashboardData} variant="outline">
              <RefreshCw className="w-4 h-4 mr-2" />
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
            <div className="p-2 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg">
              <Brain className="w-6 h-6 text-white" />
            </div>
            AI-Powered Analytics
          </h1>
          <p className="text-gray-600">Intelligent insights and recommendations for revenue optimization</p>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            {refreshing ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Updating insights...
              </>
            ) : (
              <>
                <Bot className="w-4 h-4 text-green-600" />
                AI models active
              </>
            )}
          </div>
          
          <Select value={timeframe} onValueChange={setTimeframe}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">7 days</SelectItem>
              <SelectItem value="14d">14 days</SelectItem>
              <SelectItem value="30d">30 days</SelectItem>
              <SelectItem value="90d">90 days</SelectItem>
            </SelectContent>
          </Select>
          
          <Button onClick={loadAIDashboardData} variant="outline" disabled={refreshing}>
            <RefreshCw className={cn('w-4 h-4 mr-2', refreshing && 'animate-spin')} />
            Refresh
          </Button>
          
          <Button variant="outline">
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Key AI Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="border-l-4 border-l-green-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Revenue Optimization</CardTitle>
            <div className="p-2 bg-green-100 rounded-full">
              <IndianRupee className="w-4 h-4 text-green-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              +{formatCurrency(performanceMetrics.totalRevenueIncrease)}
            </div>
            <div className="flex items-center text-sm text-gray-600 mt-1">
              <TrendingUp className="w-4 h-4 mr-1" />
              {performanceMetrics.revenueOptimizationScore}% efficiency
            </div>
            <Progress value={performanceMetrics.revenueOptimizationScore} className="mt-2" />
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Prediction Accuracy</CardTitle>
            <div className="p-2 bg-blue-100 rounded-full">
              <Target className="w-4 h-4 text-blue-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {performanceMetrics.avgAccuracyScore}%
            </div>
            <div className="text-sm text-gray-600 mt-1">
              {performanceMetrics.predictionsGenerated} predictions generated
            </div>
            <div className="flex gap-1 mt-2">
              <div className="text-xs">
                <div>Demand: {performanceMetrics.demandForecastAccuracy}%</div>
                <div>Pricing: {performanceMetrics.pricingOptimizationAccuracy}%</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-purple-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Insights</CardTitle>
            <div className="p-2 bg-purple-100 rounded-full">
              <Lightbulb className="w-4 h-4 text-purple-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">
              {aiInsights.length}
            </div>
            <div className="text-sm text-gray-600 mt-1">
              {aiInsights.filter(i => i.actionRequired).length} require action
            </div>
            <div className="flex gap-1 mt-2">
              <Badge className="bg-red-100 text-red-800 text-xs px-1">
                {aiInsights.filter(i => i.severity === 'high').length} High
              </Badge>
              <Badge className="bg-yellow-100 text-yellow-800 text-xs px-1">
                {aiInsights.filter(i => i.severity === 'medium').length} Med
              </Badge>
              <Badge className="bg-blue-100 text-blue-800 text-xs px-1">
                {aiInsights.filter(i => i.severity === 'low').length} Low
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-orange-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Model Health</CardTitle>
            <div className="p-2 bg-orange-100 rounded-full">
              <Cpu className="w-4 h-4 text-orange-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {Object.values(modelHealth).filter((m: unknown) => m.status === 'healthy').length}/
              {Object.keys(modelHealth).length}
            </div>
            <div className="text-sm text-gray-600 mt-1">
              Models operational
            </div>
            <div className="flex items-center gap-1 mt-2 text-xs">
              {Object.entries(modelHealth).map(([name, health]: [string, unknown]) => (
                <div key={name} className="flex items-center">
                  {getModelStatusIcon(health.status)}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Dashboard */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="insights">Insights</TabsTrigger>
          <TabsTrigger value="forecasting">Forecasting</TabsTrigger>
          <TabsTrigger value="pricing">Pricing AI</TabsTrigger>
          <TabsTrigger value="models">Model Health</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Forecast Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="w-5 h-5" />
                30-Day Demand & Revenue Forecast
              </CardTitle>
              <CardDescription>
                AI-powered predictions with confidence intervals
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <ComposedChart data={forecastData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="date" 
                    tickFormatter={(date) => format(new Date(date), 'MMM dd')}
                  />
                  <YAxis yAxisId="left" />
                  <YAxis yAxisId="right" orientation="right" />
                  <Tooltip 
                    labelFormatter={(date) => format(new Date(date), 'MMM dd, yyyy')}
                    formatter={(value, name) => [
                      name === 'projectedRevenue' ? formatCurrency(value as number) : value,
                      name === 'demandScore' ? 'Demand Score' :
                      name === 'expectedOccupancy' ? 'Expected Occupancy (%)' :
                      name === 'projectedRevenue' ? 'Projected Revenue' : name
                    ]}
                  />
                  <Legend />
                  <Area 
                    yAxisId="left"
                    type="monotone" 
                    dataKey="demandScore" 
                    stackId="1" 
                    stroke="#3B82F6" 
                    fill="#3B82F6" 
                    fillOpacity={0.3}
                    name="Demand Score"
                  />
                  <Bar 
                    yAxisId="left"
                    dataKey="expectedOccupancy" 
                    fill="#10B981" 
                    fillOpacity={0.6}
                    name="Expected Occupancy (%)"
                  />
                  <Line 
                    yAxisId="right"
                    type="monotone" 
                    dataKey="projectedRevenue" 
                    stroke="#F59E0B" 
                    strokeWidth={3}
                    name="Projected Revenue"
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Key Insights Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top Opportunities */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-yellow-500" />
                  Top Opportunities
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {aiInsights.filter(i => i.type === 'opportunity').slice(0, 3).map(insight => (
                    <div role="button" tabIndex={0} 
                      key={insight.id} 
                      className="flex items-center justify-between p-3 border rounded-lg cursor-pointer hover:bg-gray-50"
                      onClick={() => setSelectedInsight(insight)}
                     onKeyDown={(e: React.KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); const clickHandler = () => setSelectedInsight(insight); if (typeof clickHandler === 'function') { clickHandler(e as any); } } }}>
                      <div className="flex-1">
                        <div className="font-medium">{insight.title}</div>
                        <div className="text-sm text-gray-600">{insight.description}</div>
                        <div className="flex items-center gap-2 mt-2">
                          <Badge className="bg-green-100 text-green-800 text-xs">
                            {formatCurrency(insight.impact)} impact
                          </Badge>
                          <Badge className="bg-blue-100 text-blue-800 text-xs">
                            {insight.confidence}% confidence
                          </Badge>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-gray-400" />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Risk Alerts */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="w-5 h-5 text-red-500" />
                  Risk Alerts
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {aiInsights.filter(i => i.type === 'risk').map(insight => (
                    <div role="button" tabIndex={0} 
                      key={insight.id} 
                      className={cn(
                        'flex items-center justify-between p-3 border rounded-lg cursor-pointer hover:bg-gray-50',
                        getInsightColor(insight.severity)
                      )}
                      onClick={() => setSelectedInsight(insight)}
                     onKeyDown={(e: React.KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); const clickHandler = () => setSelectedInsight(insight); if (typeof clickHandler === 'function') { clickHandler(e as any); } } }}>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          {getInsightIcon(insight.type)}
                          <span className="font-medium">{insight.title}</span>
                          {getSeverityBadge(insight.severity)}
                        </div>
                        <div className="text-sm text-gray-600">{insight.description}</div>
                        <div className="text-xs text-gray-500 mt-1">
                          Confidence: {insight.confidence}%
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-gray-400" />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="insights" className="space-y-6">
          <div className="grid grid-cols-1 gap-4">
            {aiInsights.map(insight => (
              <Card key={insight.id} className={cn('cursor-pointer hover:shadow-md transition-shadow', getInsightColor(insight.severity))}>
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-3">
                        <div className={cn('p-2 rounded-full', 
                          insight.type === 'opportunity' ? 'bg-green-100' :
                          insight.type === 'risk' ? 'bg-red-100' :
                          insight.type === 'demand' ? 'bg-blue-100' :
                          insight.type === 'pricing' ? 'bg-yellow-100' : 'bg-gray-100'
                        )}>
                          {getInsightIcon(insight.type)}
                        </div>
                        <div>
                          <h3 className="font-semibold text-lg">{insight.title}</h3>
                          <div className="flex items-center gap-2 mt-1">
                            {getSeverityBadge(insight.severity)}
                            <Badge className="bg-gray-100 text-gray-800 text-xs">
                              {insight.confidence}% confidence
                            </Badge>
                            {insight.actionRequired && (
                              <Badge className="bg-orange-100 text-orange-800 text-xs">
                                Action Required
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      <p className="text-gray-700 mb-4">{insight.description}</p>
                      
                      <div className="bg-blue-50 border-l-4 border-blue-400 p-4 mb-4">
                        <div className="flex items-start">
                          <Lightbulb className="w-5 h-5 text-blue-600 mr-2 mt-0.5" />
                          <div>
                            <div className="font-medium text-blue-900">Recommendation</div>
                            <div className="text-blue-800">{insight.recommendation}</div>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between text-sm text-gray-500">
                        <span>Impact: {formatCurrency(Math.abs(insight.impact))}</span>
                        <span>{format(insight.timestamp, 'MMM dd, HH:mm')}</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="forecasting" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Demand Factors */}
            <Card>
              <CardHeader>
                <CardTitle>Demand Influencing Factors</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <RadarChart data={forecastData.slice(0, 7)}>
                    <PolarGrid />
                    <PolarAngleAxis dataKey="date" />
                    <PolarRadiusAxis angle={90} domain={[0, 1]} />
                    <Radar name="Seasonal" dataKey="factors.seasonal" stroke="#3B82F6" fill="#3B82F6" fillOpacity={0.3} />
                    <Radar name="Events" dataKey="factors.events" stroke="#10B981" fill="#10B981" fillOpacity={0.3} />
                    <Radar name="Competition" dataKey="factors.competition" stroke="#F59E0B" fill="#F59E0B" fillOpacity={0.3} />
                    <Radar name="Historical" dataKey="factors.historical" stroke="#EF4444" fill="#EF4444" fillOpacity={0.3} />
                    <Legend />
                  </RadarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Confidence Trends */}
            <Card>
              <CardHeader>
                <CardTitle>Prediction Confidence</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={forecastData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" tickFormatter={(date) => format(new Date(date), 'MMM dd')} />
                    <YAxis domain={[60, 100]} />
                    <Tooltip labelFormatter={(date) => format(new Date(date), 'MMM dd, yyyy')} />
                    <Line type="monotone" dataKey="confidence" stroke="#8B5CF6" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Forecast Table */}
          <Card>
            <CardHeader>
              <CardTitle>Detailed Forecast</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2">Date</th>
                      <th className="text-center p-2">Demand</th>
                      <th className="text-center p-2">Occupancy</th>
                      <th className="text-center p-2">Revenue</th>
                      <th className="text-center p-2">Confidence</th>
                      <th className="text-center p-2">Key Factors</th>
                    </tr>
                  </thead>
                  <tbody>
                    {forecastData.slice(0, 10).map((forecast, index) => (
                      <tr key={`-${index}-${forecast.date}`} className="border-b hover:bg-gray-50">
                        <td className="p-2">
                          <div className="font-medium">{format(new Date(forecast.date), 'MMM dd')}</div>
                          <div className="text-xs text-gray-500">{format(new Date(forecast.date), 'EEEE')}</div>
                        </td>
                        <td className="text-center p-2">
                          <div className="flex items-center justify-center">
                            <div className={cn('w-3 h-3 rounded-full mr-2', 
                              forecast.demandScore > 0.7 ? 'bg-green-500' :
                              forecast.demandScore > 0.4 ? 'bg-yellow-500' : 'bg-red-500'
                            )} />
                            {Math.round(forecast.demandScore * 100)}%
                          </div>
                        </td>
                        <td className="text-center p-2">{forecast.expectedOccupancy}%</td>
                        <td className="text-center p-2">{formatCurrency(forecast.projectedRevenue)}</td>
                        <td className="text-center p-2">
                          <Progress value={forecast.confidence} className="w-16" />
                          <span className="text-xs">{forecast.confidence}%</span>
                        </td>
                        <td className="text-center p-2">
                          <div className="flex justify-center gap-1">
                            {forecast.factors.events > 0.2 && <Badge className="bg-purple-100 text-purple-800 text-xs">Events</Badge>}
                            {forecast.factors.seasonal > 0.7 && <Badge className="bg-blue-100 text-blue-800 text-xs">Seasonal</Badge>}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pricing" className="space-y-6">
          {/* Pricing Recommendations */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <IndianRupee className="w-5 h-5" />
                AI Pricing Recommendations
              </CardTitle>
              <CardDescription>
                Dynamic pricing suggestions based on demand forecast and competitor analysis
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {pricingRecommendations.map((rec, index) => (
                  <div key={`pricingRecommendations-${index}`} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h3 className="font-semibold text-lg">{rec.roomType}</h3>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge className="capitalize text-xs">{rec.strategy.replace('_', ' ')}</Badge>
                          <Badge className={cn('text-xs',
                            rec.riskLevel === 'low' ? 'bg-green-100 text-green-800' :
                            rec.riskLevel === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-red-100 text-red-800'
                          )}>
                            {rec.riskLevel} risk
                          </Badge>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-green-600">
                          {formatCurrency(rec.recommendedPrice)}
                        </div>
                        <div className="text-sm text-gray-600">
                          vs {formatCurrency(rec.currentPrice)}
                        </div>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-4 gap-4">
                      <div>
                        <div className="text-sm text-gray-600">Price Change</div>
                        <div className="flex items-center gap-1">
                          {getPriceChangeIcon(rec.priceChange)}
                          <span className={cn('font-medium',
                            rec.priceChange > 0 ? 'text-green-600' : 
                            rec.priceChange < 0 ? 'text-red-600' : 'text-gray-600'
                          )}>
                            {rec.priceChange > 0 ? '+' : ''}{rec.priceChange.toFixed(1)}%
                          </span>
                        </div>
                      </div>
                      
                      <div>
                        <div className="text-sm text-gray-600">Revenue Impact</div>
                        <div className={cn('font-medium',
                          rec.revenueImpact > 0 ? 'text-green-600' : 'text-red-600'
                        )}>
                          {rec.revenueImpact > 0 ? '+' : ''}{formatCurrency(rec.revenueImpact)}
                        </div>
                      </div>
                      
                      <div>
                        <div className="text-sm text-gray-600">Confidence</div>
                        <div className="flex items-center gap-2">
                          <Progress value={rec.confidence} className="w-12" />
                          <span className="text-sm font-medium">{rec.confidence}%</span>
                        </div>
                      </div>
                      
                      <div className="text-right">
                        <Button size="sm" className="bg-blue-600 hover:bg-blue-700">
                          Apply Pricing
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Revenue Impact Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Revenue Impact Analysis</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={pricingRecommendations}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="roomType" />
                  <YAxis />
                  <Tooltip formatter={(value) => formatCurrency(value as number)} />
                  <Legend />
                  <Bar dataKey="revenueImpact" fill="#10B981" name="Revenue Impact" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="models" className="space-y-6">
          {/* Model Health Overview */}
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {Object.entries(modelHealth).map(([modelName, health]: [string, unknown]) => (
              <Card key={modelName} className={cn('border-l-4',
                health.status === 'healthy' ? 'border-l-green-500' :
                health.status === 'warning' ? 'border-l-yellow-500' :
                health.status === 'error' ? 'border-l-red-500' :
                'border-l-blue-500'
              )}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base capitalize">
                      {modelName.replace(/([A-Z])/g, ' $1').trim()}
                    </CardTitle>
                    {getModelStatusIcon(health.status)}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div>
                      <div className="text-sm text-gray-600">Accuracy</div>
                      <div className="flex items-center gap-2">
                        <Progress value={health.accuracy} className="flex-1" />
                        <span className="text-sm font-medium">{health.accuracy}%</span>
                      </div>
                    </div>
                    
                    <div>
                      <div className="text-sm text-gray-600">Data Quality</div>
                      <div className="flex items-center gap-2">
                        <Progress value={health.dataQuality} className="flex-1" />
                        <span className="text-sm font-medium">{health.dataQuality}%</span>
                      </div>
                    </div>
                    
                    <div className="pt-2 border-t">
                      <div className="text-xs text-gray-500">
                        Last trained: {format(new Date(health.lastTrained), 'MMM dd, yyyy')}
                      </div>
                      <div className="text-xs text-gray-500">
                        Status: <span className="capitalize">{health.status}</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Model Performance Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Model Performance Comparison</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={Object.entries(modelHealth).map(([name, health]: [string, unknown]) => ({
                  name: name.replace(/([A-Z])/g, ' $1').trim(),
                  accuracy: health.accuracy,
                  dataQuality: health.dataQuality
                }))}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} />
                  <YAxis domain={[0, 100]} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="accuracy" fill="#3B82F6" name="Accuracy %" />
                  <Bar dataKey="dataQuality" fill="#10B981" name="Data Quality %" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Insight Detail Modal */}
      <Dialog open={!!selectedInsight} onOpenChange={() => setSelectedInsight(null)}>
        <DialogContent className="max-w-2xl">
          {selectedInsight && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {getInsightIcon(selectedInsight.type)}
                  {selectedInsight.title}
                </DialogTitle>
                <DialogDescription>
                  {selectedInsight.description}
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  {getSeverityBadge(selectedInsight.severity)}
                  <Badge className="bg-blue-100 text-blue-800">
                    {selectedInsight.confidence}% confidence
                  </Badge>
                  <Badge className={cn(
                    selectedInsight.impact > 0 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                  )}>
                    {formatCurrency(Math.abs(selectedInsight.impact))} impact
                  </Badge>
                </div>
                
                <div className="bg-blue-50 border-l-4 border-blue-400 p-4">
                  <div className="flex items-start">
                    <Lightbulb className="w-5 h-5 text-blue-600 mr-2 mt-0.5" />
                    <div>
                      <div className="font-medium text-blue-900">AI Recommendation</div>
                      <div className="text-blue-800">{selectedInsight.recommendation}</div>
                    </div>
                  </div>
                </div>
                
                {selectedInsight.actionRequired && (
                  <div className="flex gap-2">
                    <Button className="flex-1">Implement Recommendation</Button>
                    <Button variant="outline">Schedule for Later</Button>
                    <Button variant="outline">Dismiss</Button>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default withErrorBoundary(AIDashboard, { level: 'component' });