import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, Area, AreaChart, ScatterChart, Scatter
} from 'recharts';
import {
  IndianRupee, Globe, Users, Download, RefreshCw, AlertTriangle, CheckCircle,
  Target, Zap, BarChart3, Activity, Languages, Clock, ArrowUpRight, ArrowDownRight
} from 'lucide-react';
import { Button } from '../ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Progress } from '../ui/progress';
import { api } from '../../services/api';

/** Coerce any value to a finite number, defaulting to 0 */
function safeNum(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/** Sanitize an array of chart data objects: coerce specified keys to safe numbers */
function sanitizeChartData<T extends Record<string, unknown>>(
  data: T[],
  numericKeys: string[]
): T[] {
  return data.map(item => {
    const row = { ...item };
    for (const key of numericKeys) {
      (row as Record<string, unknown>)[key] = safeNum(row[key]);
    }
    return row;
  });
}

interface RevenueData {
  period: string;
  revenue: number;
  occupancy: number;
  adr: number;
  revpar: number;
  previousRevenue?: number;
  currency: string;
}

interface RegionalData {
  region: string;
  regionName: string;
  revenue: number;
  growth: number;
  marketShare: number;
  currency: string;
  performance: 'high' | 'medium' | 'low';
}

interface LanguageData {
  language: string;
  languageName: string;
  revenue: number;
  bookings: number;
  conversionRate: number;
  satisfaction: number;
  translationQuality: number;
}

interface ChannelData {
  channel: string;
  revenue: number;
  bookings: number;
  commission: number;
  profitability: number;
  growth: number;
}

interface DashboardProps {
  hotelId: string;
  className?: string;
}

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4', '#84CC16', '#F97316'];

const CURRENCY_SYMBOLS = {
  USD: '$',
  EUR: '€',
  GBP: '£',
  JPY: '¥',
  CAD: 'C$',
  AUD: 'A$',
  CNY: '¥',
  INR: '₹'
};

interface RevenueApiResponse {
  revenueData?: RevenueData[];
  regionalData?: RegionalData[];
  languageData?: LanguageData[];
  channelData?: ChannelData[];
  kpis?: {
    totalRevenue?: number;
    revenueChange?: number;
    occupancyRate?: number;
    occupancyChange?: number;
    adr?: number;
    adrChange?: number;
    revpar?: number;
    revparChange?: number;
  };
}

export const RevenueAnalyticsDashboard: React.FC<DashboardProps> = ({ hotelId, className = '' }) => {
  const [timeRange, setTimeRange] = useState('30d');
  const [currency, setCurrency] = useState('INR');
  const [activeTab, setActiveTab] = useState('overview');
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [error, setError] = useState<string | null>(null);
  const [revenueData, setRevenueData] = useState<RevenueData[]>([]);
  const [regionalData, setRegionalData] = useState<RegionalData[]>([]);
  const [languageData, setLanguageData] = useState<LanguageData[]>([]);
  const [channelData, setChannelData] = useState<ChannelData[]>([]);
  const [apiKpis, setApiKpis] = useState<RevenueApiResponse['kpis']>(undefined);
  const isMountedRef = useRef(true);

  useEffect(() => {
    return () => { isMountedRef.current = false; };
  }, []);

  const fetchRevenueData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await api.get('/analytics/reports/revenue-analysis', {
        params: { timeRange, currency, hotelId }
      });
      if (!isMountedRef.current) return;
      const data = response.data?.data || response.data || {};
      setRevenueData(data.revenueData || []);
      setRegionalData(data.regionalData || []);
      setLanguageData(data.languageData || []);
      setChannelData(data.channelData || []);
      setApiKpis(data.kpis || undefined);
      setLastUpdated(new Date());
    } catch (err) {
      if (!isMountedRef.current) return;
      setError('Failed to load revenue data. Please try again later.');
      setRevenueData([]);
      setRegionalData([]);
      setLanguageData([]);
      setChannelData([]);
      setApiKpis(undefined);
    } finally {
      if (isMountedRef.current) setIsLoading(false);
    }
  }, [timeRange, currency, hotelId]);

  useEffect(() => {
    fetchRevenueData();
  }, [fetchRevenueData]);

  const kpiCards = useMemo(() => {
    const sym = CURRENCY_SYMBOLS[currency as keyof typeof CURRENCY_SYMBOLS] || '$';
    const totalRevenue = apiKpis?.totalRevenue;
    const occupancy = apiKpis?.occupancyRate;
    const adr = apiKpis?.adr;
    const revpar = apiKpis?.revpar;

    const fmtValue = (v: number | undefined, prefix: string, suffix = '') =>
      v != null ? `${prefix}${v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v.toFixed(0)}${suffix}` : '--';
    const fmtChange = (v: number | undefined) =>
      v != null ? `${v >= 0 ? '+' : ''}${v.toFixed(1)}%` : '--';
    const trend = (v: number | undefined) => (v != null && v >= 0 ? 'up' : 'down');

    return [
      {
        title: 'Total Revenue',
        value: fmtValue(totalRevenue, sym),
        change: fmtChange(apiKpis?.revenueChange),
        trend: trend(apiKpis?.revenueChange),
        icon: IndianRupee,
        color: 'text-green-600',
        bgColor: 'bg-green-50'
      },
      {
        title: 'Occupancy Rate',
        value: occupancy != null ? `${occupancy.toFixed(1)}%` : '--',
        change: fmtChange(apiKpis?.occupancyChange),
        trend: trend(apiKpis?.occupancyChange),
        icon: Users,
        color: 'text-blue-600',
        bgColor: 'bg-blue-50'
      },
      {
        title: 'ADR',
        value: adr != null ? `${sym}${adr.toFixed(0)}` : '--',
        change: fmtChange(apiKpis?.adrChange),
        trend: trend(apiKpis?.adrChange),
        icon: TrendingUp,
        color: 'text-purple-600',
        bgColor: 'bg-purple-50'
      },
      {
        title: 'RevPAR',
        value: revpar != null ? `${sym}${revpar.toFixed(0)}` : '--',
        change: fmtChange(apiKpis?.revparChange),
        trend: trend(apiKpis?.revparChange),
        icon: Target,
        color: 'text-orange-600',
        bgColor: 'bg-orange-50'
      }
    ];
  }, [currency, apiKpis]);

  const handleRefresh = async () => {
    await fetchRevenueData();
  };

  const formatCurrency = (value: number, currencyCode: string = currency) => {
    const v = safeNum(value);
    return new Intl.NumberFormat(currencyCode === 'INR' ? 'en-IN' : 'en-US', {
      style: 'currency',
      currency: currencyCode
    }).format(v);
  };

  const formatPercentage = (value: number) => {
    const v = safeNum(value);
    return `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`;
  };

  const CustomTooltip = ({ active, payload, label }: Record<string, unknown>) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border rounded-lg shadow-lg">
          <p className="font-medium">{`${label}`}</p>
          {payload.map((entry: Record<string, unknown>, index: number) => {
            const key = String(entry.dataKey ?? '');
            const val = safeNum(entry.value);
            return (
              <p key={`tooltip-${key || index}`} style={{ color: entry.color }}>
                {`${key}: ${key.includes('revenue') ? formatCurrency(val) : val.toLocaleString()}`}
              </p>
            );
          })}
        </div>
      );
    }
    return null;
  };

  return (
    <div className={`p-6 space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Revenue Analytics</h1>
          <p className="text-gray-600 mt-1">
            Multi-currency revenue performance and optimization insights
          </p>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-gray-400" />
            <span className="text-sm text-gray-500">
              Updated {lastUpdated.toLocaleTimeString()}
            </span>
          </div>
          
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
              <SelectItem value="1y">Last year</SelectItem>
            </SelectContent>
          </Select>
          
          <Select value={currency} onValueChange={setCurrency}>
            <SelectTrigger className="w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="USD">USD</SelectItem>
              <SelectItem value="EUR">EUR</SelectItem>
              <SelectItem value="GBP">GBP</SelectItem>
              <SelectItem value="JPY">JPY</SelectItem>
              <SelectItem value="CAD">CAD</SelectItem>
            </SelectContent>
          </Select>
          
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleRefresh}
            disabled={isLoading}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          
          <Button variant="outline" size="sm">
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Error / Empty State */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm">
          {error}
        </div>
      )}

      {!isLoading && !error && revenueData.length === 0 && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center text-gray-500">
          No revenue data available for the selected period.
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {kpiCards.map((kpi, index) => (
          <Card key={`kpiCards-${index}-${kpi.title}`}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">{kpi.title}</p>
                  <p className="text-2xl font-bold text-gray-900 mt-2">{kpi.value}</p>
                  <div className="flex items-center mt-2">
                    {kpi.trend === 'up' ? (
                      <ArrowUpRight className="w-4 h-4 text-green-500 mr-1" />
                    ) : (
                      <ArrowDownRight className="w-4 h-4 text-red-500 mr-1" />
                    )}
                    <span className={`text-sm font-medium ${kpi.trend === 'up' ? 'text-green-600' : 'text-red-600'}`}>
                      {kpi.change}
                    </span>
                    <span className="text-sm text-gray-500 ml-1">vs last period</span>
                  </div>
                </div>
                <div className={`p-3 rounded-lg ${kpi.bgColor}`}>
                  <kpi.icon className={`w-6 h-6 ${kpi.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Main Analytics Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview" className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="regional" className="flex items-center gap-2">
            <Globe className="w-4 h-4" />
            Regional
          </TabsTrigger>
          <TabsTrigger value="languages" className="flex items-center gap-2">
            <Languages className="w-4 h-4" />
            Languages
          </TabsTrigger>
          <TabsTrigger value="channels" className="flex items-center gap-2">
            <Activity className="w-4 h-4" />
            Channels
          </TabsTrigger>
          <TabsTrigger value="optimization" className="flex items-center gap-2">
            <Zap className="w-4 h-4" />
            Optimization
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6 mt-6">
          {/* Revenue Trend Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Revenue Performance Trend</CardTitle>
              <CardDescription>Monthly revenue, occupancy, and key metrics</CardDescription>
            </CardHeader>
            <CardContent>
              {revenueData.length === 0 ? (
                <div className="flex items-center justify-center h-[400px] text-gray-500">No revenue data available</div>
              ) : (
              <ResponsiveContainer width="100%" height={400}>
                <AreaChart data={sanitizeChartData(revenueData, ['revenue', 'occupancy', 'adr', 'revpar', 'previousRevenue'])}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="period" />
                  <YAxis yAxisId="left" />
                  <YAxis yAxisId="right" orientation="right" />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <Area
                    yAxisId="left"
                    type="monotone"
                    dataKey="revenue"
                    stackId="1"
                    stroke="#3B82F6"
                    fill="#3B82F6"
                    fillOpacity={0.6}
                    name="Revenue"
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="occupancy"
                    stroke="#10B981"
                    strokeWidth={3}
                    name="Occupancy (%)"
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="adr"
                    stroke="#F59E0B"
                    strokeWidth={2}
                    name="ADR"
                  />
                </AreaChart>
              </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Performance Metrics */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Monthly Comparison</CardTitle>
                <CardDescription>Current vs previous period</CardDescription>
              </CardHeader>
              <CardContent>
                {revenueData.length === 0 ? (
                  <div className="flex items-center justify-center h-[300px] text-gray-500">No comparison data available</div>
                ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={sanitizeChartData(revenueData, ['revenue', 'previousRevenue'])}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="period" />
                    <YAxis />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                    <Bar dataKey="revenue" fill="#3B82F6" name="Current Revenue" />
                    <Bar dataKey="previousRevenue" fill="#94A3B8" name="Previous Revenue" />
                  </BarChart>
                </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Key Performance Indicators</CardTitle>
                <CardDescription>Real-time performance metrics</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {(() => {
                  const occupancyPct = apiKpis?.occupancyRate ?? 0;
                  const revenueChange = apiKpis?.revenueChange ?? 0;
                  const revpar = apiKpis?.revpar ?? 0;
                  const adr = apiKpis?.adr ?? 0;
                  const revparTarget = adr > 0 ? Math.min(Math.round((revpar / adr) * 100), 100) : 0;
                  const kpiItems = [
                    { label: 'Occupancy vs Capacity', value: Math.round(occupancyPct) },
                    { label: 'RevPAR Efficiency', value: revparTarget },
                    { label: 'Revenue Growth', value: Math.min(Math.max(Math.round(revenueChange + 50), 0), 100) },
                  ];
                  return kpiItems.map((item) => (
                    <div key={item.label} className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm font-medium">{item.label}</span>
                        <span className="text-sm text-gray-500">{item.value}%</span>
                      </div>
                      <Progress value={item.value} className="h-2" />
                    </div>
                  ));
                })()}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="regional" className="space-y-6 mt-6">
          {regionalData.length === 0 && !isLoading ? (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center text-gray-500">
              No regional data available for the selected period.
            </div>
          ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Regional Revenue Distribution */}
            <Card>
              <CardHeader>
                <CardTitle>Revenue by Region</CardTitle>
                <CardDescription>Geographic performance breakdown</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={sanitizeChartData(regionalData, ['revenue', 'growth', 'marketShare'])}
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="revenue"
                      label={({ regionName, revenue }) => `${regionName}: ${formatCurrency(safeNum(revenue))}`}
                    >
                      {regionalData.map((_entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Regional Performance Table */}
            <Card>
              <CardHeader>
                <CardTitle>Regional Performance</CardTitle>
                <CardDescription>Growth and market share analysis</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {regionalData.map((region, index) => (
                    <div key={region.region} className="flex items-center justify-between p-3 rounded-lg border">
                      <div className="flex items-center gap-3">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                        <div>
                          <p className="font-medium">{region.regionName}</p>
                          <p className="text-sm text-gray-500">Market Share: {region.marketShare}%</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">{formatCurrency(safeNum(region.revenue), region.currency)}</p>
                        <div className="flex items-center gap-1">
                          <Badge variant={safeNum(region.growth) >= 15 ? "default" : safeNum(region.growth) >= 10 ? "secondary" : "outline"}>
                            {formatPercentage(safeNum(region.growth))}
                          </Badge>
                          <Badge variant={region.performance === 'high' ? "default" : region.performance === 'medium' ? "secondary" : "outline"}>
                            {region.performance}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
          )}
        </TabsContent>

        <TabsContent value="languages" className="space-y-6 mt-6">
          {languageData.length === 0 && !isLoading ? (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center text-gray-500">
              No language data available for the selected period.
            </div>
          ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Language Revenue Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Revenue by Language</CardTitle>
                <CardDescription>Multi-language performance analysis</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={sanitizeChartData(languageData, ['revenue', 'bookings', 'conversionRate', 'satisfaction', 'translationQuality'])} layout="horizontal">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis dataKey="languageName" type="category" width={80} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="revenue" fill="#3B82F6" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Language Quality vs Performance */}
            <Card>
              <CardHeader>
                <CardTitle>Translation Quality vs Revenue</CardTitle>
                <CardDescription>Quality impact on performance</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <ScatterChart data={sanitizeChartData(languageData, ['revenue', 'translationQuality', 'conversionRate'])}>
                    <CartesianGrid />
                    <XAxis dataKey="translationQuality" name="Translation Quality" unit="%" />
                    <YAxis dataKey="revenue" name="Revenue" unit="$" />
                    <Tooltip 
                      cursor={{ strokeDasharray: '3 3' }}
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          return (
                            <div className="bg-white p-3 border rounded-lg shadow-lg">
                              <p className="font-medium">{data.languageName}</p>
                              <p>Revenue: {formatCurrency(data.revenue)}</p>
                              <p>Quality: {data.translationQuality}%</p>
                              <p>Conversion: {data.conversionRate}%</p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Scatter dataKey="revenue" fill="#8884d8" />
                  </ScatterChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Language Performance Table */}
          <Card>
            <CardHeader>
              <CardTitle>Language Performance Details</CardTitle>
              <CardDescription>Comprehensive language-specific metrics</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2">Language</th>
                      <th className="text-right p-2">Revenue</th>
                      <th className="text-right p-2">Bookings</th>
                      <th className="text-right p-2">Conversion</th>
                      <th className="text-right p-2">Satisfaction</th>
                      <th className="text-right p-2">Translation Quality</th>
                    </tr>
                  </thead>
                  <tbody>
                    {languageData.map((lang) => (
                      <tr key={lang.language} className="border-b">
                        <td className="p-2">
                          <div className="font-medium">{lang.languageName}</div>
                          <div className="text-sm text-gray-500">{lang.language.toUpperCase()}</div>
                        </td>
                        <td className="text-right p-2 font-medium">{formatCurrency(safeNum(lang.revenue))}</td>
                        <td className="text-right p-2">{safeNum(lang.bookings).toLocaleString()}</td>
                        <td className="text-right p-2">{safeNum(lang.conversionRate)}%</td>
                        <td className="text-right p-2">{safeNum(lang.satisfaction)}/5.0</td>
                        <td className="text-right p-2">
                          <div className="flex items-center justify-end gap-2">
                            <Progress value={lang.translationQuality} className="w-16 h-2" />
                            <span className="text-sm">{lang.translationQuality}%</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
          )}
        </TabsContent>

        <TabsContent value="channels" className="space-y-6 mt-6">
          {channelData.length === 0 && !isLoading ? (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center text-gray-500">
              No channel data available for the selected period.
            </div>
          ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Channel Performance Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Channel Revenue Performance</CardTitle>
                <CardDescription>Revenue distribution across channels</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={sanitizeChartData(channelData, ['revenue', 'bookings', 'commission', 'profitability', 'growth'])}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="channel" />
                    <YAxis />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                    <Bar dataKey="revenue" fill="#3B82F6" name="Revenue" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Channel Profitability */}
            <Card>
              <CardHeader>
                <CardTitle>Channel Profitability vs Growth</CardTitle>
                <CardDescription>Profitability analysis and growth rates</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <ScatterChart data={sanitizeChartData(channelData, ['profitability', 'growth', 'revenue', 'commission'])}>
                    <CartesianGrid />
                    <XAxis dataKey="profitability" name="Profitability" unit="%" />
                    <YAxis dataKey="growth" name="Growth" unit="%" />
                    <Tooltip 
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          return (
                            <div className="bg-white p-3 border rounded-lg shadow-lg">
                              <p className="font-medium">{data.channel}</p>
                              <p>Profitability: {data.profitability}%</p>
                              <p>Growth: {formatPercentage(data.growth)}</p>
                              <p>Commission: {data.commission}%</p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Scatter dataKey="growth" fill="#10B981" />
                  </ScatterChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
          )}
        </TabsContent>

        <TabsContent value="optimization" className="space-y-6 mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Optimization Opportunities */}
            <Card>
              <CardHeader>
                <CardTitle>Revenue Optimization Opportunities</CardTitle>
                <CardDescription>Data-driven recommendations</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {(() => {
                  const occupancy = apiKpis?.occupancyRate ?? 0;
                  const revenueChange = apiKpis?.revenueChange ?? 0;
                  const recommendations: { icon: typeof CheckCircle; color: string; bg: string; textColor: string; title: string; description: string; badge: string; badgeVariant?: 'secondary' | 'outline' }[] = [];

                  if (occupancy < 60) {
                    recommendations.push({
                      icon: Target, color: 'text-blue-600', bg: 'bg-blue-50', textColor: 'text-blue-700',
                      title: 'Improve Occupancy Rate',
                      description: `Current occupancy is ${occupancy.toFixed(1)}%. Consider promotional pricing or channel marketing to increase bookings.`,
                      badge: 'High Impact',
                    });
                  }
                  if (revenueChange < 0) {
                    recommendations.push({
                      icon: AlertTriangle, color: 'text-orange-600', bg: 'bg-orange-50', textColor: 'text-orange-700',
                      title: 'Revenue Decline Detected',
                      description: `Revenue has declined ${Math.abs(revenueChange).toFixed(1)}% compared to the previous period. Review pricing strategy and demand patterns.`,
                      badge: 'Action Required', badgeVariant: 'outline',
                    });
                  }
                  if (occupancy > 85) {
                    recommendations.push({
                      icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-50', textColor: 'text-green-700',
                      title: 'Dynamic Pricing Opportunity',
                      description: `High occupancy (${occupancy.toFixed(1)}%) suggests room for rate increases. Consider implementing dynamic pricing to maximize RevPAR.`,
                      badge: 'High Impact',
                    });
                  }
                  if (recommendations.length === 0) {
                    recommendations.push({
                      icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-50', textColor: 'text-green-700',
                      title: 'Performance On Track',
                      description: 'Key metrics are within healthy ranges. Continue monitoring for optimization opportunities.',
                      badge: 'Good', badgeVariant: 'secondary',
                    });
                  }

                  return recommendations.map((rec, idx) => (
                    <div key={idx} className={`p-4 rounded-lg border ${rec.bg}`}>
                      <div className="flex items-start gap-3">
                        <rec.icon className={`w-5 h-5 ${rec.color} mt-0.5`} />
                        <div>
                          <h4 className="font-medium">{rec.title}</h4>
                          <p className={`text-sm ${rec.textColor} mt-1`}>{rec.description}</p>
                          <Badge variant={rec.badgeVariant} className="mt-2">{rec.badge}</Badge>
                        </div>
                      </div>
                    </div>
                  ));
                })()}
              </CardContent>
            </Card>

            {/* Performance Summary */}
            <Card>
              <CardHeader>
                <CardTitle>Performance Summary</CardTitle>
                <CardDescription>Current period metrics overview</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {(() => {
                  const occupancy = apiKpis?.occupancyRate ?? 0;
                  const revenueChange = apiKpis?.revenueChange ?? 0;
                  const adr = apiKpis?.adr ?? 0;
                  const revpar = apiKpis?.revpar ?? 0;
                  const revparEfficiency = adr > 0 ? Math.round((revpar / adr) * 100) : 0;
                  const metrics = [
                    { label: 'Occupancy Rate', value: Math.round(occupancy), suffix: '%' },
                    { label: 'RevPAR Efficiency', value: revparEfficiency, suffix: '%' },
                    { label: 'Revenue Trend', value: Math.min(Math.max(Math.round(revenueChange + 50), 0), 100), suffix: `% (${revenueChange >= 0 ? '+' : ''}${revenueChange.toFixed(1)}%)` },
                  ];
                  return metrics.map((metric) => (
                    <div key={metric.label}>
                      <div className="flex justify-between mb-2">
                        <span className="text-sm font-medium">{metric.label}</span>
                        <span className="text-sm text-gray-500">{metric.value}{metric.suffix}</span>
                      </div>
                      <Progress value={metric.value} className="h-2" />
                    </div>
                  ));
                })()}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default RevenueAnalyticsDashboard;