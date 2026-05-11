import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  BarChart3,
  Brain,
  RefreshCw,
  AlertCircle,
  Lightbulb,
  Target,
  PieChart
} from 'lucide-react';
import { api } from '../../services/api';

interface RevenueTrend {
  totalRevenue: number;
  growthRate: number;
  averageBookingValue: number;
  periodLabel?: string;
}

interface BusinessInsight {
  key: string;
  title: string;
  value: string;
  trend?: 'up' | 'down' | 'neutral';
  description?: string;
}

interface FinancialTrendsResponse {
  totalRevenue: number;
  growthRate: number;
  averageBookingValue: number;
  periodLabel?: string;
}

interface BusinessIntelligenceResponse {
  insights: BusinessInsight[];
}

export default function AdvancedAnalytics() {
  const [revenueTrends, setRevenueTrends] = useState<RevenueTrend | null>(null);
  const [businessInsights, setBusinessInsights] = useState<BusinessInsight[]>([]);

  const [revenueLoading, setRevenueLoading] = useState(true);
  const [insightsLoading, setInsightsLoading] = useState(true);

  const [revenueError, setRevenueError] = useState<string | null>(null);
  const [insightsError, setInsightsError] = useState<string | null>(null);

  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);

  const fetchRevenueTrends = async () => {
    setRevenueLoading(true);
    setRevenueError(null);
    try {
      const { data } = await api.get('/enhanced-analytics/financial-trends', {
        params: { startDate, endDate, page: 1, limit: 20 },
      });
      if (data.success && data.data) {
        const d = data.data as FinancialTrendsResponse;
        setRevenueTrends({
          totalRevenue: d.totalRevenue ?? 0,
          growthRate: d.growthRate ?? 0,
          averageBookingValue: d.averageBookingValue ?? 0,
          periodLabel: d.periodLabel,
        });
      } else {
        setRevenueTrends(null);
      }
    } catch {
      setRevenueTrends(null);
      setRevenueError('Unable to load financial trends.');
    } finally {
      setRevenueLoading(false);
    }
  };

  const fetchBusinessIntelligence = async () => {
    setInsightsLoading(true);
    setInsightsError(null);
    try {
      const { data } = await api.get('/enhanced-analytics/business-intelligence', {
        params: { startDate, endDate, page: 1, limit: 20 },
      });
      if (data.success && data.data) {
        const d = data.data as BusinessIntelligenceResponse;
        setBusinessInsights(Array.isArray(d.insights) ? d.insights : []);
      } else {
        setBusinessInsights([]);
      }
    } catch {
      setBusinessInsights([]);
      setInsightsError('Unable to load business intelligence data.');
    } finally {
      setInsightsLoading(false);
    }
  };

  useEffect(() => {
    fetchRevenueTrends();
    fetchBusinessIntelligence();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate, endDate]);

  const handleRefresh = () => {
    fetchRevenueTrends();
    fetchBusinessIntelligence();
  };

  const isLoading = revenueLoading || insightsLoading;

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(value);

  const renderSkeleton = (count: number) => (
    <div className={`grid grid-cols-1 sm:grid-cols-${count} gap-4`}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="animate-pulse">
          <div className="h-24 bg-gray-200 rounded-lg" />
        </div>
      ))}
    </div>
  );

  const renderEmptyState = (message: string) => (
    <div className="flex flex-col items-center justify-center py-8 text-gray-400">
      <AlertCircle className="w-10 h-10 mb-2" />
      <p className="text-sm">{message}</p>
    </div>
  );

  const renderErrorState = (message: string) => (
    <div className="flex flex-col items-center justify-center py-8 text-red-400">
      <AlertCircle className="w-10 h-10 mb-2" />
      <p className="text-sm">{message}</p>
    </div>
  );

  const getTrendIcon = (trend?: 'up' | 'down' | 'neutral') => {
    if (trend === 'up') return <TrendingUp className="w-4 h-4 text-green-500" />;
    if (trend === 'down') return <TrendingDown className="w-4 h-4 text-red-500" />;
    return <Target className="w-4 h-4 text-gray-400" />;
  };

  const getTrendColor = (trend?: 'up' | 'down' | 'neutral') => {
    if (trend === 'up') return 'text-green-600';
    if (trend === 'down') return 'text-red-600';
    return 'text-gray-600';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Advanced Analytics</h2>
          <p className="text-sm text-gray-500 mt-1">
            Financial trends and business intelligence insights
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-40 text-sm"
            />
            <span className="text-gray-400">to</span>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-40 text-sm"
            />
          </div>
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isLoading}>
            <RefreshCw className={`w-4 h-4 mr-1 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Revenue Trends Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-green-600" />
            Revenue Trends
          </CardTitle>
        </CardHeader>
        <CardContent>
          {revenueLoading ? (
            renderSkeleton(3)
          ) : revenueError ? (
            renderErrorState(revenueError)
          ) : !revenueTrends ? (
            renderEmptyState('No analytics data available for the selected period.')
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-green-50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-1">
                  <DollarSign className="w-4 h-4 text-green-600" />
                  <span className="text-xs font-medium text-green-600 uppercase">Total Revenue</span>
                </div>
                <p className="text-2xl font-bold text-gray-900">{formatCurrency(revenueTrends.totalRevenue)}</p>
                {revenueTrends.periodLabel && (
                  <p className="text-xs text-gray-500 mt-1">{revenueTrends.periodLabel}</p>
                )}
              </div>
              <div className="bg-blue-50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-1">
                  {revenueTrends.growthRate >= 0 ? (
                    <TrendingUp className="w-4 h-4 text-blue-600" />
                  ) : (
                    <TrendingDown className="w-4 h-4 text-red-600" />
                  )}
                  <span className="text-xs font-medium text-blue-600 uppercase">Growth Rate</span>
                </div>
                <p className={`text-2xl font-bold ${revenueTrends.growthRate >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                  {revenueTrends.growthRate >= 0 ? '+' : ''}{revenueTrends.growthRate.toFixed(1)}%
                </p>
              </div>
              <div className="bg-purple-50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-1">
                  <BarChart3 className="w-4 h-4 text-purple-600" />
                  <span className="text-xs font-medium text-purple-600 uppercase">Avg Booking Value</span>
                </div>
                <p className="text-2xl font-bold text-gray-900">
                  {formatCurrency(revenueTrends.averageBookingValue)}
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Business Intelligence Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="w-5 h-5 text-indigo-600" />
            Business Intelligence
          </CardTitle>
        </CardHeader>
        <CardContent>
          {insightsLoading ? (
            renderSkeleton(3)
          ) : insightsError ? (
            renderErrorState(insightsError)
          ) : businessInsights.length === 0 ? (
            renderEmptyState('No analytics data available for the selected period.')
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {businessInsights.map((insight) => (
                <div
                  key={insight.key}
                  className="border border-gray-200 rounded-lg p-4 hover:border-indigo-300 transition-colors"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Lightbulb className="w-4 h-4 text-indigo-500" />
                      <span className="text-sm font-medium text-gray-700">{insight.title}</span>
                    </div>
                    {getTrendIcon(insight.trend)}
                  </div>
                  <p className={`text-xl font-bold ${getTrendColor(insight.trend)}`}>
                    {insight.value}
                  </p>
                  {insight.description && (
                    <p className="text-xs text-gray-500 mt-1">{insight.description}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
