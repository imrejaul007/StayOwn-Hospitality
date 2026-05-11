import React, { useState, useEffect, useRef} from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
// Select imports available for future rule creation UI
// import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { toast } from '@/utils/toast';
import { formatCurrency } from '@/utils/currencyUtils';
import revenueManagementService from '@/services/revenueManagementService';
import {
  TrendingUp, TrendingDown, Target, BarChart3, Zap,
  Settings, Eye, AlertTriangle, CheckCircle, DollarSign,
  Users, Calendar, MapPin, ThermometerSun,
  Building2, Star, Trophy, Activity, Lightbulb, Sparkles,
  Loader2
} from 'lucide-react';
import { format } from 'date-fns';
import { withErrorBoundary } from '../ErrorBoundary';

// Dynamic Pricing Interfaces
interface PricingRule {
  id: string;
  name: string;
  type: 'occupancy' | 'demand' | 'competitor' | 'seasonal' | 'event' | 'weather';
  condition: string;
  adjustment: number; // Percentage adjustment
  priority: number;
  isActive: boolean;
  lastTriggered?: string;
}

interface MarketIntelligence {
  competitorRates: {
    hotelName: string;
    rating: number;
    distance: string;
    rate: number;
    availability: boolean;
    source: string;
  }[];
  localEvents: {
    name: string;
    date: string;
    impact: 'high' | 'medium' | 'low';
    demandMultiplier: number;
  }[];
  weatherForecast: {
    date: string;
    condition: string;
    temperature: number;
    precipitation: number;
    impact: 'positive' | 'negative' | 'neutral';
  }[];
  marketTrends: {
    bookingVelocity: number;
    priceElasticity: number;
    demandIndex: number;
    competitivePosition: 'above' | 'at' | 'below';
  };
}

interface OptimalPricing {
  roomType: string;
  date: string;
  currentRate: number;
  optimalRate: number;
  confidence: number;
  reasoning: string[];
  projectedRevenue: number;
  demandLevel: 'high' | 'medium' | 'low';
  competitivePosition: string;
}

interface DynamicPricingEngineProps {}

export const DynamicPricingEngine: React.FC<DynamicPricingEngineProps> = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [pricingRules, setPricingRules] = useState<PricingRule[]>([]);
  const [marketData, setMarketData] = useState<MarketIntelligence | null>(null);
  const [optimalPricing, setOptimalPricing] = useState<OptimalPricing[]>([]);
  const [autoOptimization, setAutoOptimization] = useState(true);
  const [loading, setLoading] = useState(false);
  const [rulesLoading, setRulesLoading] = useState(false);
  const [marketLoading, setMarketLoading] = useState(false);
  const [optimizationLoading, setOptimizationLoading] = useState(false);
  const [analyticsData, setAnalyticsData] = useState<{
    revPAR: number;
    adr: number;
    revenueGrowth: number;
    marketShare: number;
    pricingAccuracy: number;
    rateOptimizationImpact: number;
  } | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [togglingRuleId, setTogglingRuleId] = useState<string | null>(null);

  const isMountedRef = useRef(true);

  useEffect(() => {
    return () => { isMountedRef.current = false; };
  }, []);

  useEffect(() => {
    fetchPricingRules();
    fetchMarketIntelligence();
    fetchOptimalPricing();
    fetchAnalyticsData();
  }, []);

  const fetchPricingRules = async () => {
    setRulesLoading(true);
    try {
      const rules = await revenueManagementService.getPricingRules();
      if (!isMountedRef.current) return;
      // Map API response to component interface
      const mapped: PricingRule[] = (rules as Record<string, unknown>[]).map((rule: Record<string, unknown>) => ({
        id: (rule._id as string) || (rule.id as string) || '',
        name: (rule.name as string) || '',
        type: (rule.type as PricingRule['type']) || 'demand',
        condition: (rule.condition as string) || (rule.description as string) || '',
        adjustment: (rule.adjustment as number) || (rule.rateAdjustment as number) || 0,
        priority: (rule.priority as number) || 5,
        isActive: rule.isActive !== undefined ? (rule.isActive as boolean) : true,
        lastTriggered: (rule.lastTriggered as string) || (rule.updatedAt as string) || undefined,
      }));
      setPricingRules(mapped);
    } catch (error) {
      if (!isMountedRef.current) return;
      toast.error('Failed to load pricing rules');
    } finally {
      if (isMountedRef.current) setRulesLoading(false);
    }
  };

  const fetchMarketIntelligence = async () => {
    setMarketLoading(true);
    try {
      const [competitorRatesRaw, demandForecastRaw, revenueSummaryRaw] = await Promise.all([
        revenueManagementService.getCompetitorRates(),
        revenueManagementService.getDemandForecast(),
        revenueManagementService.getRevenueSummary(),
      ]);
      if (!isMountedRef.current) return;

      // Map competitor rates
      const competitorRates = (competitorRatesRaw || []).map((c: Record<string, unknown>) => ({
        hotelName: (c.hotelName as string) || '',
        rating: (c.rating as number) || 3,
        distance: (c.distance as string) || 'N/A',
        rate: (c.currentRate as number) || (c.rate as number) || 0,
        availability: c.availability !== undefined
          ? (typeof c.availability === 'boolean' ? c.availability : (c.availability as number) > 0)
          : true,
        source: (c.source as string) || 'API',
      }));

      // Map demand forecast to local events
      const localEvents = (demandForecastRaw || [])
        .filter((f: Record<string, unknown>) =>
          f.demandLevel === 'high' || f.demandLevel === 'peak' || ((f.factors as string[]) || []).length > 0
        )
        .slice(0, 5)
        .map((f: Record<string, unknown>) => ({
          name: ((f.factors as string[]) || [])[0] || `${(f.demandLevel as string || 'medium').charAt(0).toUpperCase() + (f.demandLevel as string || 'medium').slice(1)} demand period`,
          date: (f.date as string) || '',
          impact: ((f.demandLevel as string) === 'peak' ? 'high' : (f.demandLevel as string)) as 'high' | 'medium' | 'low',
          demandMultiplier: 1 + ((f.recommendedRateChange as number) || 0) / 100,
        }));

      // Static weather forecast (no weather API backend)
      const weatherForecast = [
        { date: format(new Date(), 'yyyy-MM-dd'), condition: 'Data unavailable', temperature: 0, precipitation: 0, impact: 'neutral' as const },
      ];

      // Map revenue summary to market trends
      const summary = revenueSummaryRaw as Record<string, unknown> | null;
      const marketTrends = {
        bookingVelocity: (summary?.bookingVelocity as number) || 100,
        priceElasticity: (summary?.priceElasticity as number) || 1.0,
        demandIndex: (summary?.demandIndex as number) || 5.0,
        competitivePosition: ((summary?.competitivePosition as string) || 'at') as 'above' | 'at' | 'below',
      };

      setMarketData({
        competitorRates,
        localEvents,
        weatherForecast,
        marketTrends,
      });
    } catch (error) {
      if (!isMountedRef.current) return;
      toast.error('Failed to load market intelligence');
    } finally {
      if (isMountedRef.current) setMarketLoading(false);
    }
  };

  const fetchOptimalPricing = async () => {
    setOptimizationLoading(true);
    try {
      const recommendations = await revenueManagementService.getOptimizationRecommendations();
      if (!isMountedRef.current) return;

      // Map API recommendations to OptimalPricing interface
      const recsArray = Array.isArray(recommendations)
        ? recommendations
        : (recommendations as Record<string, unknown>)?.recommendations
          ? ((recommendations as Record<string, unknown>).recommendations as unknown[])
          : [];

      const mapped: OptimalPricing[] = (recsArray as Record<string, unknown>[]).map((rec: Record<string, unknown>) => ({
        roomType: (rec.roomType as string) || (rec.roomTypeName as string) || 'Room',
        date: (rec.date as string) || format(new Date(), 'yyyy-MM-dd'),
        currentRate: (rec.currentRate as number) || 0,
        optimalRate: (rec.optimalRate as number) || (rec.recommendedRate as number) || (rec.suggestedRate as number) || 0,
        confidence: Math.round((rec.confidence as number) || 80),
        reasoning: (rec.reasoning as string[]) || (rec.factors as string[]) || [],
        projectedRevenue: (rec.projectedRevenue as number) || (rec.estimatedRevenue as number) || 0,
        demandLevel: ((rec.demandLevel as string) || 'medium') as 'high' | 'medium' | 'low',
        competitivePosition: (rec.competitivePosition as string) || 'Competitive with market',
      }));

      setOptimalPricing(mapped);
    } catch (error) {
      if (!isMountedRef.current) return;
      toast.error('Failed to load optimization recommendations');
    } finally {
      if (isMountedRef.current) setOptimizationLoading(false);
    }
  };

  const fetchAnalyticsData = async () => {
    setAnalyticsLoading(true);
    try {
      const dashboardMetrics = await revenueManagementService.getDashboardMetrics();
      if (!isMountedRef.current) return;

      const metrics = dashboardMetrics?.metrics;
      const perf = dashboardMetrics?.performanceMetrics;
      setAnalyticsData({
        revPAR: metrics?.revPAR || 0,
        adr: metrics?.adr || 0,
        revenueGrowth: perf?.revenueGrowth || 0,
        marketShare: perf?.marketShare || 0,
        pricingAccuracy: perf?.rateOptimization || 0,
        rateOptimizationImpact: metrics?.rateOptimizationImpact || 0,
      });
    } catch (error) {
      if (!isMountedRef.current) return;
      toast.error('Failed to load analytics data');
    } finally {
      if (isMountedRef.current) setAnalyticsLoading(false);
    }
  };

  const handleApplyOptimalPricing = async () => {
    if (optimalPricing.length === 0) {
      toast.error('No optimization recommendations available to apply');
      return;
    }
    setLoading(true);
    try {
      const updates = optimalPricing.map(p => ({
        id: p.roomType,
        currentRate: p.optimalRate,
      }));
      await revenueManagementService.bulkUpdateRoomTypeRates(updates);
      if (!isMountedRef.current) return;

      toast.success('Optimal pricing applied to all room types');

      // Refresh data after applying
      fetchPricingRules();
      fetchOptimalPricing();
    } catch (error) {
      if (!isMountedRef.current) return;
      toast.error('Failed to apply optimal pricing');
    } finally {
      if (isMountedRef.current) setLoading(false);
    }
  };

  const toggleRule = async (ruleId: string) => {
    const rule = pricingRules.find(r => r.id === ruleId);
    if (!rule) return;

    setTogglingRuleId(ruleId);
    // Optimistic update
    setPricingRules(prev => prev.map(r =>
      r.id === ruleId ? { ...r, isActive: !r.isActive } : r
    ));

    try {
      await revenueManagementService.updatePricingRule(ruleId, {
        isActive: !rule.isActive,
      });
      if (!isMountedRef.current) return;
      toast.success(`Rule "${rule.name}" ${!rule.isActive ? 'enabled' : 'disabled'}`);
    } catch (error) {
      if (!isMountedRef.current) return;
      // Revert optimistic update
      setPricingRules(prev => prev.map(r =>
        r.id === ruleId ? { ...r, isActive: rule.isActive } : r
      ));
      toast.error(`Failed to update rule "${rule.name}"`);
    } finally {
      if (isMountedRef.current) setTogglingRuleId(null);
    }
  };

  const getDemandColor = (level: string) => {
    switch (level) {
      case 'high': return 'text-red-600 bg-red-50';
      case 'medium': return 'text-yellow-600 bg-yellow-50';
      case 'low': return 'text-green-600 bg-green-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getImpactIcon = (impact: string) => {
    switch (impact) {
      case 'positive': return <TrendingUp className="h-4 w-4 text-green-500" />;
      case 'negative': return <TrendingDown className="h-4 w-4 text-red-500" />;
      default: return <Activity className="h-4 w-4 text-gray-500" />;
    }
  };

  const getTrendIcon = (type: string) => {
    switch (type) {
      case 'occupancy': return <Users className="h-4 w-4" />;
      case 'demand': return <TrendingUp className="h-4 w-4" />;
      case 'competitor': return <Target className="h-4 w-4" />;
      case 'seasonal': return <Calendar className="h-4 w-4" />;
      case 'event': return <MapPin className="h-4 w-4" />;
      case 'weather': return <ThermometerSun className="h-4 w-4" />;
      default: return <BarChart3 className="h-4 w-4" />;
    }
  };

  const LoadingSpinner = ({ text = 'Loading...' }: { text?: string }) => (
    <div className="flex items-center justify-center py-12">
      <Loader2 className="h-6 w-6 animate-spin text-purple-600 mr-2" />
      <span className="text-sm text-gray-500">{text}</span>
    </div>
  );

  const EmptyState = ({ message }: { message: string }) => (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <AlertTriangle className="h-8 w-8 text-gray-400 mb-2" />
      <p className="text-sm text-gray-500">{message}</p>
    </div>
  );

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="relative bg-gradient-to-r from-purple-50 to-indigo-50 border-purple-200 hover:from-purple-100 hover:to-indigo-100 transition-all duration-200"
        >
          <DollarSign className="h-4 w-4 mr-2 text-purple-600" />
          Dynamic Pricing
          <Badge
            variant="secondary"
            className="ml-2 bg-gradient-to-r from-green-500 to-emerald-500 text-white border-0"
          >
            AI
          </Badge>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-7xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gradient-to-r from-purple-500 to-indigo-500">
              <DollarSign className="h-5 w-5 text-white" />
            </div>
            Dynamic Pricing & Revenue Management
            <Badge className="bg-gradient-to-r from-amber-500 to-orange-500 text-white">
              AI-Powered
            </Badge>
          </DialogTitle>
          <DialogDescription>
            Intelligent rate optimization using machine learning, market analysis, and competitor monitoring
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="dashboard" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Dashboard
            </TabsTrigger>
            <TabsTrigger value="rules" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Pricing Rules
            </TabsTrigger>
            <TabsTrigger value="market" className="flex items-center gap-2">
              <Eye className="h-4 w-4" />
              Market Intel
            </TabsTrigger>
            <TabsTrigger value="optimization" className="flex items-center gap-2">
              <Target className="h-4 w-4" />
              Optimization
            </TabsTrigger>
            <TabsTrigger value="analytics" className="flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              AI Insights
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {/* Key Metrics */}
              <Card className="bg-gradient-to-r from-green-50 to-emerald-50 border-green-200">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600">Revenue Impact</p>
                      <p className="text-2xl font-bold text-green-700">
                        {analyticsData ? `+${analyticsData.rateOptimizationImpact.toFixed(1)}%` : '--'}
                      </p>
                    </div>
                    <DollarSign className="h-8 w-8 text-green-600" />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">vs manual pricing</p>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-r from-blue-50 to-cyan-50 border-blue-200">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600">Optimal Pricing</p>
                      <p className="text-2xl font-bold text-blue-700">
                        {analyticsData ? `${analyticsData.pricingAccuracy.toFixed(1)}%` : '--'}
                      </p>
                    </div>
                    <Target className="h-8 w-8 text-blue-600" />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">accuracy rate</p>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-r from-purple-50 to-indigo-50 border-purple-200">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600">Active Rules</p>
                      <p className="text-2xl font-bold text-purple-700">
                        {pricingRules.filter(r => r.isActive).length}
                      </p>
                    </div>
                    <Zap className="h-8 w-8 text-purple-600" />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">auto adjustments</p>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-r from-orange-50 to-red-50 border-orange-200">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600">Market Position</p>
                      <p className="text-2xl font-bold text-orange-700">
                        {marketData?.marketTrends.competitivePosition.toUpperCase() || '--'}
                      </p>
                    </div>
                    <Trophy className="h-8 w-8 text-orange-600" />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">vs competitors</p>
                </CardContent>
              </Card>
            </div>

            {/* Recent Auto-Adjustments */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5 text-blue-600" />
                  Recent Auto-Adjustments
                </CardTitle>
              </CardHeader>
              <CardContent>
                {rulesLoading ? (
                  <LoadingSpinner text="Loading adjustments..." />
                ) : pricingRules.filter(rule => rule.lastTriggered).length === 0 ? (
                  <EmptyState message="No recent auto-adjustments recorded." />
                ) : (
                <div className="space-y-3">
                  {pricingRules
                    .filter(rule => rule.lastTriggered)
                    .slice(0, 5)
                    .map((rule, index) => (
                      <div key={rule.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-3">
                          {getTrendIcon(rule.type)}
                          <div>
                            <p className="font-medium text-sm">{rule.name}</p>
                            <p className="text-xs text-gray-500">
                              {format(new Date(rule.lastTriggered!), 'MMM dd, HH:mm')}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <Badge
                            className={`${rule.adjustment > 0 ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}
                          >
                            {rule.adjustment > 0 ? '+' : ''}{rule.adjustment}%
                          </Badge>
                        </div>
                      </div>
                    ))
                  }
                </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="rules" className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Pricing Rules Configuration</h3>
              <Button size="sm" className="bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600">
                <Lightbulb className="h-4 w-4 mr-2" />
                Add Rule
              </Button>
            </div>

            {rulesLoading ? (
              <LoadingSpinner text="Loading pricing rules..." />
            ) : pricingRules.length === 0 ? (
              <EmptyState message="No pricing rules configured. Click 'Add Rule' to create one." />
            ) : (
            <div className="grid gap-4">
              {pricingRules.map((rule) => (
                <Card key={rule.id} className={`transition-all ${rule.isActive ? 'border-green-200 bg-green-50/30' : 'border-gray-200'}`}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2">
                          {getTrendIcon(rule.type)}
                          <div>
                            <h4 className="font-medium">{rule.name}</h4>
                            <p className="text-sm text-gray-600">{rule.condition}</p>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <Badge className={`${rule.adjustment > 0 ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                          {rule.adjustment > 0 ? '+' : ''}{rule.adjustment}%
                        </Badge>
                        <Badge variant={rule.isActive ? 'default' : 'secondary'}>
                          Priority {rule.priority}
                        </Badge>
                        <Button
                          variant={rule.isActive ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => toggleRule(rule.id)}
                          disabled={togglingRuleId === rule.id}
                          className={rule.isActive ? 'bg-green-600 hover:bg-green-700' : ''}
                        >
                          {togglingRuleId === rule.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : rule.isActive ? (
                            <CheckCircle className="h-4 w-4" />
                          ) : (
                            <AlertTriangle className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                    {rule.lastTriggered && (
                      <p className="text-xs text-gray-500 mt-2">
                        Last triggered: {format(new Date(rule.lastTriggered), 'MMM dd, yyyy HH:mm')}
                      </p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
            )}
          </TabsContent>

          <TabsContent value="market" className="space-y-6">
            {marketLoading ? (
              <LoadingSpinner text="Loading market intelligence..." />
            ) : !marketData ? (
              <EmptyState message="Market intelligence data is unavailable." />
            ) : (
              <>
                {/* Competitor Analysis */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Building2 className="h-5 w-5 text-blue-600" />
                      Competitor Rate Analysis
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {marketData.competitorRates.length === 0 ? (
                      <EmptyState message="No competitor rate data available." />
                    ) : (
                    <div className="space-y-3">
                      {marketData.competitorRates.map((competitor, index) => (
                        <div key={`marketData-competitorRates-${index}`} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <div className="flex items-center gap-3">
                            <div className="flex items-center gap-1">
                              {Array.from({length: competitor.rating}).map((_, i) => (
                                <Star key={i} className="h-4 w-4 text-yellow-500 fill-current" />
                              ))}
                            </div>
                            <div>
                              <p className="font-medium text-sm">{competitor.hotelName}</p>
                              <p className="text-xs text-gray-500">{competitor.distance} • {competitor.source}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="font-bold text-lg">{formatCurrency(competitor.rate)}</span>
                            <Badge variant={competitor.availability ? 'default' : 'secondary'}>
                              {competitor.availability ? 'Available' : 'Sold Out'}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                    )}
                  </CardContent>
                </Card>

                {/* Local Events */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <MapPin className="h-5 w-5 text-green-600" />
                      Upcoming Local Events
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {marketData.localEvents.length === 0 ? (
                      <EmptyState message="No upcoming events affecting demand." />
                    ) : (
                    <div className="space-y-3">
                      {marketData.localEvents.map((event, index) => (
                        <div key={`marketData-localEvents-${index}-${event.name}`} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <div>
                            <p className="font-medium text-sm">{event.name}</p>
                            <p className="text-xs text-gray-500">{format(new Date(event.date), 'MMM dd, yyyy')}</p>
                          </div>
                          <div className="flex items-center gap-3">
                            <Badge className={`${
                              event.impact === 'high' ? 'bg-red-100 text-red-700' :
                              event.impact === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                              'bg-green-100 text-green-700'
                            }`}>
                              {event.impact.toUpperCase()} Impact
                            </Badge>
                            <span className="text-sm font-medium">
                              {event.demandMultiplier.toFixed(1)}x Demand
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                    )}
                  </CardContent>
                </Card>

                {/* Weather Forecast */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <ThermometerSun className="h-5 w-5 text-orange-600" />
                      Weather Impact Forecast
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {marketData.weatherForecast.map((weather, index) => (
                        <Card key={`marketData-weatherForecast-${index}-${weather.date}`} className="p-3">
                          <div className="text-center">
                            <p className="font-medium text-sm">
                              {format(new Date(weather.date), 'MMM dd')}
                            </p>
                            <div className="flex items-center justify-center gap-1 my-2">
                              {getImpactIcon(weather.impact)}
                              <span className="text-lg font-bold">{weather.temperature > 0 ? `${weather.temperature}\u00B0C` : 'N/A'}</span>
                            </div>
                            <p className="text-xs text-gray-600">{weather.condition}</p>
                            <p className="text-xs text-gray-500">{weather.precipitation}% rain</p>
                          </div>
                        </Card>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>

          <TabsContent value="optimization" className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">AI-Powered Rate Optimization</h3>
              <Button
                onClick={handleApplyOptimalPricing}
                disabled={loading || optimalPricing.length === 0}
                className="bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                    Applying...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Apply Optimal Pricing
                  </>
                )}
              </Button>
            </div>

            {optimizationLoading ? (
              <LoadingSpinner text="Loading optimization recommendations..." />
            ) : optimalPricing.length === 0 ? (
              <EmptyState message="No optimization recommendations available at this time." />
            ) : (
            <div className="grid gap-4">
              {optimalPricing.slice(0, 8).map((pricing, index) => (
                <Card key={`-${index}-${pricing.date}`} className="transition-all hover:shadow-md">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div>
                          <h4 className="font-medium">{pricing.roomType}</h4>
                          <p className="text-sm text-gray-600">
                            {format(new Date(pricing.date), 'MMM dd, yyyy')}
                          </p>
                        </div>
                        <Badge className={getDemandColor(pricing.demandLevel)}>
                          {pricing.demandLevel.toUpperCase()} Demand
                        </Badge>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-gray-500 line-through">
                              {formatCurrency(pricing.currentRate)}
                            </span>
                            <span className="text-lg font-bold text-green-600">
                              {formatCurrency(pricing.optimalRate)}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Progress value={pricing.confidence} className="w-16 h-2" />
                            <span className="text-xs text-gray-500">{Math.round(pricing.confidence)}% confidence</span>
                          </div>
                        </div>

                        <div className="text-right">
                          <p className="text-sm font-medium text-green-600">
                            {formatCurrency(pricing.projectedRevenue)}
                          </p>
                          <p className="text-xs text-gray-500">projected revenue</p>
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-1">
                      {pricing.reasoning.map((reason, i) => (
                        <Badge key={i} variant="outline" className="text-xs">
                          {reason}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
            )}
          </TabsContent>

          <TabsContent value="analytics" className="space-y-6">
            {analyticsLoading ? (
              <LoadingSpinner text="Loading analytics data..." />
            ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* AI Insights */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <DollarSign className="h-5 w-5 text-purple-600" />
                    AI Revenue Insights
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
                    <div className="flex items-center gap-2 mb-2">
                      <Lightbulb className="h-4 w-4 text-blue-600" />
                      <span className="font-medium text-blue-900">Smart Recommendation</span>
                    </div>
                    <p className="text-sm text-blue-800">
                      Increase weekend rates by 8-12% for Executive Suites. Competitor analysis shows 15% pricing gap with similar properties.
                    </p>
                  </div>

                  <div className="p-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg border border-green-200">
                    <div className="flex items-center gap-2 mb-2">
                      <TrendingUp className="h-4 w-4 text-green-600" />
                      <span className="font-medium text-green-900">Demand Forecast</span>
                    </div>
                    <p className="text-sm text-green-800">
                      High demand predicted for Oct 5-8. Consider implementing 20% surge pricing 3 days before event.
                    </p>
                  </div>

                  <div className="p-4 bg-gradient-to-r from-orange-50 to-red-50 rounded-lg border border-orange-200">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertTriangle className="h-4 w-4 text-orange-600" />
                      <span className="font-medium text-orange-900">Risk Alert</span>
                    </div>
                    <p className="text-sm text-orange-800">
                      Standard rooms showing 15% booking velocity decline. Consider promotional pricing or package deals.
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Performance Metrics */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 text-green-600" />
                    Performance Metrics
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Revenue Per Available Room</span>
                      <span className="font-bold">{analyticsData ? formatCurrency(analyticsData.revPAR) : '--'}</span>
                    </div>
                    <Progress value={analyticsData ? Math.min(Math.round((analyticsData.revPAR / 20000) * 100), 100) : 0} className="h-2" />

                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Average Daily Rate</span>
                      <span className="font-bold">{analyticsData ? formatCurrency(analyticsData.adr) : '--'}</span>
                    </div>
                    <Progress value={analyticsData ? Math.min(Math.round((analyticsData.adr / 25000) * 100), 100) : 0} className="h-2" />

                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Pricing Accuracy</span>
                      <span className="font-bold">{analyticsData ? `${analyticsData.pricingAccuracy.toFixed(1)}%` : '--'}</span>
                    </div>
                    <Progress value={analyticsData?.pricingAccuracy || 0} className="h-2" />

                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Market Share</span>
                      <span className="font-bold">{analyticsData ? `${analyticsData.marketShare.toFixed(1)}%` : '--'}</span>
                    </div>
                    <Progress value={analyticsData?.marketShare || 0} className="h-2" />
                  </div>

                  <Separator />

                  <div className="grid grid-cols-2 gap-4 text-center">
                    <div>
                      <p className="text-2xl font-bold text-green-600">
                        {analyticsData ? `+${analyticsData.revenueGrowth.toFixed(1)}%` : '--'}
                      </p>
                      <p className="text-xs text-gray-500">Revenue Growth</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-blue-600">
                        {analyticsData ? `${analyticsData.rateOptimizationImpact > 0 ? '-' : ''}${Math.abs(analyticsData.rateOptimizationImpact).toFixed(1)}%` : '--'}
                      </p>
                      <p className="text-xs text-gray-500">Cost Reduction</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
            )}

            {/* AI Learning Status */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-purple-600" />
                  AI Learning & Model Status
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="text-center">
                    <div className="p-4 bg-gradient-to-r from-purple-50 to-indigo-50 rounded-lg border border-purple-200">
                      <DollarSign className="h-8 w-8 text-purple-600 mx-auto mb-2" />
                      <p className="font-bold text-lg">15,847</p>
                      <p className="text-sm text-gray-600">Training Data Points</p>
                    </div>
                  </div>

                  <div className="text-center">
                    <div className="p-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg border border-green-200">
                      <Target className="h-8 w-8 text-green-600 mx-auto mb-2" />
                      <p className="font-bold text-lg">{analyticsData ? `${analyticsData.pricingAccuracy.toFixed(1)}%` : '--'}</p>
                      <p className="text-sm text-gray-600">Model Accuracy</p>
                    </div>
                  </div>

                  <div className="text-center">
                    <div className="p-4 bg-gradient-to-r from-blue-50 to-cyan-50 rounded-lg border border-blue-200">
                      <Activity className="h-8 w-8 text-blue-600 mx-auto mb-2" />
                      <p className="font-bold text-lg">Live</p>
                      <p className="text-sm text-gray-600">Learning Status</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default withErrorBoundary(DynamicPricingEngine, { level: 'component' });
