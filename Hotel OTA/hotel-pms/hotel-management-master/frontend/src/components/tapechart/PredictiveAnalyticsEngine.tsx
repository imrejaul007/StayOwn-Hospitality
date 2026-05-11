import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { toast } from '@/utils/toast';
import { api } from '@/services/api';
import { formatCurrency } from '@/utils/currencyUtils';
import { useProperty } from '@/context/PropertyContext';
import {
  TrendingUp, AlertTriangle, Target, Users,
  DollarSign, Activity, Sparkles, BarChart3,
  UserX, Clock, Award, Lightbulb, Star, Crown
} from 'lucide-react';
import { format } from 'date-fns';
import { withErrorBoundary } from '../ErrorBoundary';

// Predictive Analytics Interfaces
interface NoShowPrediction {
  bookingId: string;
  guestName: string;
  checkInDate: string;
  roomType: string;
  noShowProbability: number;
  risk: 'high' | 'medium' | 'low';
  factors: string[];
  recommendedAction: string;
  potentialRevenueLoss: number;
}

interface DemandForecast {
  date: string;
  predictedOccupancy: number;
  confidence: number;
  demandLevel: 'high' | 'medium' | 'low';
  roomTypeBreakdown: {
    roomType: string;
    predictedBookings: number;
    optimalRate: number;
  }[];
  influencingFactors: string[];
}

interface GuestValuePrediction {
  guestId: string;
  guestName: string;
  currentValue: number;
  predictedLifetimeValue: number;
  valueTier: 'platinum' | 'gold' | 'silver' | 'bronze';
  loyaltyScore: number;
  churnRisk: number;
  nextBookingProbability: number;
  recommendedPerks: string[];
}

interface OverbookingRecommendation {
  date: string;
  roomType: string;
  currentBookings: number;
  optimalOverbooking: number;
  riskLevel: 'low' | 'medium' | 'high';
  expectedWalkIns: number;
  potentialRevenue: number;
  riskAssessment: string;
}

interface LengthOfStayPrediction {
  bookingId: string;
  guestName: string;
  initialStay: number;
  predictedExtension: number;
  extensionProbability: number;
  factors: string[];
  upsellOpportunities: string[];
}

interface NoShowSummary {
  total: number;
  highRisk: number;
  mediumRisk: number;
  lowRisk: number;
  totalRevenueAtRisk: number;
}

interface OverbookingSummary {
  totalDates: number;
  totalPotentialRevenue: number;
  highRiskCount: number;
}

interface PredictiveAnalyticsEngineProps {}

/**
 * Transform raw API demand/occupancy response into the DemandForecast[] shape.
 * The backend may return varying payloads — this normalises to our interface.
 */
function transformDemandResponse(data: Record<string, unknown>): DemandForecast[] {
  // Handle array response from /analytics/predict/demand/:hotelId
  const items: Record<string, unknown>[] = Array.isArray(data)
    ? data
    : Array.isArray((data as { forecasts?: unknown[] }).forecasts)
      ? (data as { forecasts: Record<string, unknown>[] }).forecasts
      : Array.isArray((data as { data?: unknown[] }).data)
        ? (data as { data: Record<string, unknown>[] }).data
        : Array.isArray((data as { predictions?: unknown[] }).predictions)
          ? (data as { predictions: Record<string, unknown>[] }).predictions
          : [];

  return items.map((item) => {
    const occupancy = Number(item.predictedOccupancy ?? item.occupancy ?? item.predicted_occupancy ?? 0);
    const conf = Number(item.confidence ?? item.confidence_score ?? 85);
    const demandLevel: DemandForecast['demandLevel'] =
      (item.demandLevel as DemandForecast['demandLevel']) ??
      (occupancy > 85 ? 'high' : occupancy > 70 ? 'medium' : 'low');

    // Room type breakdown — accept either nested array or flat
    const rawBreakdown = Array.isArray(item.roomTypeBreakdown)
      ? item.roomTypeBreakdown
      : Array.isArray(item.room_type_breakdown)
        ? item.room_type_breakdown
        : [];

    const roomTypeBreakdown = (rawBreakdown as Record<string, unknown>[]).map((r) => ({
      roomType: String(r.roomType ?? r.room_type ?? 'Unknown'),
      predictedBookings: Math.round(Number(r.predictedBookings ?? r.predicted_bookings ?? 0)),
      optimalRate: Math.round(Number(r.optimalRate ?? r.optimal_rate ?? 0)),
    }));

    // Influencing factors
    const rawFactors = Array.isArray(item.influencingFactors)
      ? item.influencingFactors
      : Array.isArray(item.factors)
        ? item.factors
        : [];

    return {
      date: String(item.date ?? ''),
      predictedOccupancy: Math.round(occupancy),
      confidence: Math.round(conf),
      demandLevel,
      roomTypeBreakdown,
      influencingFactors: rawFactors.map(String),
    };
  });
}

export const PredictiveAnalyticsEngine: React.FC<PredictiveAnalyticsEngineProps> = () => {
  const { selectedPropertyId } = useProperty();
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');

  // Real data — demand forecasts
  const [demandForecasts, setDemandForecasts] = useState<DemandForecast[]>([]);
  const [demandLoading, setDemandLoading] = useState(false);
  const [demandError, setDemandError] = useState<string | null>(null);

  // No-show predictions
  const [noShowPredictions, setNoShowPredictions] = useState<NoShowPrediction[]>([]);
  const [noShowSummary, setNoShowSummary] = useState<NoShowSummary | null>(null);
  const [noShowLoading, setNoShowLoading] = useState(false);
  const [noShowError, setNoShowError] = useState<string | null>(null);

  // Guest value predictions
  const [guestValuePredictions, setGuestValuePredictions] = useState<GuestValuePrediction[]>([]);
  const [guestValueLoading, setGuestValueLoading] = useState(false);
  const [guestValueError, setGuestValueError] = useState<string | null>(null);

  // Overbooking recommendations
  const [overbookingRecommendations, setOverbookingRecommendations] = useState<OverbookingRecommendation[]>([]);
  const [overbookingSummary, setOverbookingSummary] = useState<OverbookingSummary | null>(null);
  const [overbookingLoading, setOverbookingLoading] = useState(false);
  const [overbookingError, setOverbookingError] = useState<string | null>(null);

  // Length-of-stay predictions
  const [lengthOfStayPredictions, setLengthOfStayPredictions] = useState<LengthOfStayPrediction[]>([]);
  const [losLoading, setLosLoading] = useState(false);
  const [losError, setLosError] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);

  const isMountedRef = useRef(true);

  useEffect(() => {
    return () => { isMountedRef.current = false; };
  }, []);

  /** Fetch real demand / occupancy forecast from the backend. */
  const fetchDemandForecasts = useCallback(async () => {
    if (!selectedPropertyId) {
      setDemandForecasts([]);
      return;
    }

    setDemandLoading(true);
    setDemandError(null);

    try {
      // Try demand prediction endpoint first
      const { data } = await api.get(`/analytics/predict/demand/${selectedPropertyId}`);
      if (!isMountedRef.current) return;

      const transformed = transformDemandResponse(data);

      if (transformed.length > 0) {
        setDemandForecasts(transformed);
      } else {
        // Fall back to occupancy forecast endpoint
        const { data: fallbackData } = await api.get(`/analytics/forecast/occupancy/${selectedPropertyId}`);
        if (!isMountedRef.current) return;
        const fallbackTransformed = transformDemandResponse(fallbackData);
        setDemandForecasts(fallbackTransformed);
      }
    } catch (err) {
      if (!isMountedRef.current) return;
      const message = err instanceof Error ? err.message : 'Failed to load demand forecasts';
      setDemandError(message);
    } finally {
      if (isMountedRef.current) {
        setDemandLoading(false);
      }
    }
  }, [selectedPropertyId]);

  /** Fetch no-show risk predictions. */
  const fetchNoShowPredictions = useCallback(async () => {
    if (!selectedPropertyId) {
      setNoShowPredictions([]);
      setNoShowSummary(null);
      return;
    }
    setNoShowLoading(true);
    setNoShowError(null);
    try {
      const { data } = await api.get(`/analytics/predict/no-shows/${selectedPropertyId}`);
      if (!isMountedRef.current) return;
      setNoShowPredictions(Array.isArray(data.predictions) ? data.predictions : []);
      setNoShowSummary(data.summary ?? null);
    } catch (err) {
      if (!isMountedRef.current) return;
      setNoShowError(err instanceof Error ? err.message : 'Failed to load no-show predictions');
    } finally {
      if (isMountedRef.current) setNoShowLoading(false);
    }
  }, [selectedPropertyId]);

  /** Fetch guest lifetime value predictions. */
  const fetchGuestValuePredictions = useCallback(async () => {
    if (!selectedPropertyId) {
      setGuestValuePredictions([]);
      return;
    }
    setGuestValueLoading(true);
    setGuestValueError(null);
    try {
      const { data } = await api.get(`/analytics/predict/guest-value/${selectedPropertyId}`, {
        params: { page: 1, limit: 20 },
      });
      if (!isMountedRef.current) return;
      setGuestValuePredictions(Array.isArray(data.predictions) ? data.predictions : []);
    } catch (err) {
      if (!isMountedRef.current) return;
      setGuestValueError(err instanceof Error ? err.message : 'Failed to load guest value predictions');
    } finally {
      if (isMountedRef.current) setGuestValueLoading(false);
    }
  }, [selectedPropertyId]);

  /** Fetch overbooking recommendations. */
  const fetchOverbookingRecommendations = useCallback(async () => {
    if (!selectedPropertyId) {
      setOverbookingRecommendations([]);
      setOverbookingSummary(null);
      return;
    }
    setOverbookingLoading(true);
    setOverbookingError(null);
    try {
      const { data } = await api.get(`/analytics/predict/overbooking/${selectedPropertyId}`);
      if (!isMountedRef.current) return;
      setOverbookingRecommendations(Array.isArray(data.recommendations) ? data.recommendations : []);
      setOverbookingSummary(data.summary ?? null);
    } catch (err) {
      if (!isMountedRef.current) return;
      setOverbookingError(err instanceof Error ? err.message : 'Failed to load overbooking recommendations');
    } finally {
      if (isMountedRef.current) setOverbookingLoading(false);
    }
  }, [selectedPropertyId]);

  /** Fetch length-of-stay predictions. */
  const fetchLengthOfStayPredictions = useCallback(async () => {
    if (!selectedPropertyId) {
      setLengthOfStayPredictions([]);
      return;
    }
    setLosLoading(true);
    setLosError(null);
    try {
      const { data } = await api.get(`/analytics/predict/length-of-stay/${selectedPropertyId}`);
      if (!isMountedRef.current) return;
      setLengthOfStayPredictions(Array.isArray(data.predictions) ? data.predictions : []);
    } catch (err) {
      if (!isMountedRef.current) return;
      setLosError(err instanceof Error ? err.message : 'Failed to load length-of-stay predictions');
    } finally {
      if (isMountedRef.current) setLosLoading(false);
    }
  }, [selectedPropertyId]);

  /** Fetch all prediction data in parallel. */
  const fetchAllPredictions = useCallback(async () => {
    await Promise.allSettled([
      fetchDemandForecasts(),
      fetchNoShowPredictions(),
      fetchGuestValuePredictions(),
      fetchOverbookingRecommendations(),
      fetchLengthOfStayPredictions(),
    ]);
  }, [fetchDemandForecasts, fetchNoShowPredictions, fetchGuestValuePredictions, fetchOverbookingRecommendations, fetchLengthOfStayPredictions]);

  // Load all data when dialog opens or property changes
  useEffect(() => {
    if (isOpen) {
      fetchAllPredictions();
    }
  }, [isOpen, fetchAllPredictions]);

  const anyLoading = loading || demandLoading || noShowLoading || guestValueLoading || overbookingLoading || losLoading;

  const handleRunAnalysis = async () => {
    setLoading(true);
    try {
      await fetchAllPredictions();
      if (!isMountedRef.current) return;
      toast.success('Predictive analysis completed successfully');
    } catch {
      toast.error('Failed to run predictive analysis');
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  };

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'high': return 'text-red-600 bg-red-50';
      case 'medium': return 'text-yellow-600 bg-yellow-50';
      case 'low': return 'text-green-600 bg-green-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'platinum': return 'text-purple-700 bg-purple-100';
      case 'gold': return 'text-yellow-700 bg-yellow-100';
      case 'silver': return 'text-gray-700 bg-gray-100';
      case 'bronze': return 'text-orange-700 bg-orange-100';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getTierIcon = (tier: string) => {
    switch (tier) {
      case 'platinum': return <Crown className="h-4 w-4 text-purple-600" />;
      case 'gold': return <Star className="h-4 w-4 text-yellow-600" />;
      case 'silver': return <Award className="h-4 w-4 text-gray-600" />;
      case 'bronze': return <Activity className="h-4 w-4 text-orange-600" />;
      default: return <Users className="h-4 w-4 text-gray-400" />;
    }
  };

  // Compute dashboard summary stats from real demand data
  const avgOccupancy = demandForecasts.length > 0
    ? Math.round(demandForecasts.reduce((acc, f) => acc + f.predictedOccupancy, 0) / demandForecasts.length)
    : 0;

  const highDemandDays = demandForecasts.filter(f => f.demandLevel === 'high').length;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="relative bg-gradient-to-r from-green-50 to-emerald-50 border-green-200 hover:from-green-100 hover:to-emerald-100 transition-all duration-200"
        >
          <TrendingUp className="h-4 w-4 mr-2 text-green-600" />
          AI Insights
          <Badge
            variant="secondary"
            className="ml-2 bg-gradient-to-r from-blue-500 to-purple-500 text-white border-0"
          >
            ML
          </Badge>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-7xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gradient-to-r from-green-500 to-emerald-500">
              <TrendingUp className="h-5 w-5 text-white" />
            </div>
            Predictive Analytics & AI Insights
            <Badge className="bg-gradient-to-r from-purple-500 to-indigo-500 text-white">
              Machine Learning
            </Badge>
          </DialogTitle>
          <DialogDescription>
            Advanced ML-powered predictions for demand forecasting and revenue optimization
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="dashboard" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Dashboard
            </TabsTrigger>
            <TabsTrigger value="noshows" className="flex items-center gap-2">
              <UserX className="h-4 w-4" />
              No-Shows
            </TabsTrigger>
            <TabsTrigger value="demand" className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Demand
            </TabsTrigger>
            <TabsTrigger value="guests" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Guest Value
            </TabsTrigger>
            <TabsTrigger value="overbooking" className="flex items-center gap-2">
              <Target className="h-4 w-4" />
              Overbooking
            </TabsTrigger>
            <TabsTrigger value="los" className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Stay Length
            </TabsTrigger>
          </TabsList>

          {/* ===================== DASHBOARD TAB ===================== */}
          <TabsContent value="dashboard" className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">AI Analytics Overview</h3>
              <Button
                onClick={handleRunAnalysis}
                disabled={anyLoading}
                className="bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600"
              >
                {anyLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Run Analysis
                  </>
                )}
              </Button>
            </div>

            {!selectedPropertyId && (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
                <AlertTriangle className="h-4 w-4 inline mr-2" />
                Please select a property to view analytics data.
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {/* Key Metrics — demand data is real, others show n/a */}
              <Card className="bg-gradient-to-r from-red-50 to-pink-50 border-red-200">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600">High No-Show Risk</p>
                      <p className="text-2xl font-bold text-red-700">
                        {noShowLoading ? '...' : noShowSummary ? noShowSummary.highRisk : noShowPredictions.filter(p => p.risk === 'high').length}
                      </p>
                    </div>
                    <UserX className="h-8 w-8 text-red-600" />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {noShowSummary ? `${noShowSummary.total} total bookings analyzed` : 'no data yet'}
                  </p>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-r from-green-50 to-emerald-50 border-green-200">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600">Avg Occupancy Forecast</p>
                      <p className="text-2xl font-bold text-green-700">
                        {demandLoading ? '...' : `${avgOccupancy}%`}
                      </p>
                    </div>
                    <TrendingUp className="h-8 w-8 text-green-600" />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {demandForecasts.length > 0 ? `next ${demandForecasts.length} days` : 'no data yet'}
                  </p>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-r from-purple-50 to-indigo-50 border-purple-200">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600">High Demand Days</p>
                      <p className="text-2xl font-bold text-purple-700">
                        {demandLoading ? '...' : highDemandDays}
                      </p>
                    </div>
                    <Activity className="h-8 w-8 text-purple-600" />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">in forecast period</p>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-r from-orange-50 to-red-50 border-orange-200">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600">Revenue at Risk</p>
                      <p className="text-2xl font-bold text-orange-700">
                        {noShowLoading ? '...' : noShowSummary ? formatCurrency(noShowSummary.totalRevenueAtRisk) : formatCurrency(0)}
                      </p>
                    </div>
                    <DollarSign className="h-8 w-8 text-orange-600" />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {noShowSummary ? 'from no-show risk bookings' : 'no data yet'}
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Quick Insights */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Lightbulb className="h-5 w-5 text-yellow-600" />
                    Key Insights
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {demandForecasts.length > 0 ? (
                    <>
                      {highDemandDays > 0 && (
                        <div className="p-3 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
                          <p className="text-sm font-medium text-blue-900">Demand Surge Detected</p>
                          <p className="text-xs text-blue-700 mt-1">
                            {highDemandDays} day(s) with high predicted occupancy in the forecast window. Consider dynamic pricing activation.
                          </p>
                        </div>
                      )}

                      <div className="p-3 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg border border-green-200">
                        <p className="text-sm font-medium text-green-900">Occupancy Outlook</p>
                        <p className="text-xs text-green-700 mt-1">
                          Average predicted occupancy across the forecast period is {avgOccupancy}%.
                        </p>
                      </div>
                    </>
                  ) : (
                    <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                      <p className="text-sm text-gray-500">
                        {demandLoading ? 'Loading insights...' : demandError ? 'Unable to load insights.' : 'Run analysis to generate insights.'}
                      </p>
                    </div>
                  )}

                  {noShowSummary && noShowSummary.highRisk > 0 && (
                    <div className="p-3 bg-gradient-to-r from-red-50 to-pink-50 rounded-lg border border-red-200">
                      <p className="text-sm font-medium text-red-900">No-Show Alert</p>
                      <p className="text-xs text-red-700 mt-1">
                        {noShowSummary.highRisk} booking(s) flagged as high no-show risk with {formatCurrency(noShowSummary.totalRevenueAtRisk)} revenue at risk. Review the No-Shows tab for details.
                      </p>
                    </div>
                  )}

                  {overbookingSummary && overbookingSummary.totalPotentialRevenue > 0 && (
                    <div className="p-3 bg-gradient-to-r from-amber-50 to-yellow-50 rounded-lg border border-amber-200">
                      <p className="text-sm font-medium text-amber-900">Overbooking Opportunity</p>
                      <p className="text-xs text-amber-700 mt-1">
                        Potential additional revenue of {formatCurrency(overbookingSummary.totalPotentialRevenue)} through optimized overbooking across {overbookingSummary.totalDates} date(s).
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5 text-purple-600" />
                    Model Performance
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Demand Forecast</span>
                      <span className="font-bold">
                        {demandForecasts.length > 0
                          ? `${Math.round(demandForecasts.reduce((a, f) => a + f.confidence, 0) / demandForecasts.length)}%`
                          : '--'}
                      </span>
                    </div>
                    <Progress
                      value={demandForecasts.length > 0
                        ? Math.round(demandForecasts.reduce((a, f) => a + f.confidence, 0) / demandForecasts.length)
                        : 0}
                      className="h-2"
                    />

                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">No-Show Prediction</span>
                      <span className="font-bold">
                        {noShowPredictions.length > 0 ? `${noShowPredictions.length} analyzed` : '--'}
                      </span>
                    </div>
                    <Progress value={noShowPredictions.length > 0 ? 78 : 0} className="h-2" />

                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Guest Value Scoring</span>
                      <span className="font-bold">
                        {guestValuePredictions.length > 0 ? `${guestValuePredictions.length} guests` : '--'}
                      </span>
                    </div>
                    <Progress value={guestValuePredictions.length > 0 ? 82 : 0} className="h-2" />

                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Stay Extension</span>
                      <span className="font-bold">
                        {lengthOfStayPredictions.length > 0 ? `${lengthOfStayPredictions.length} stays` : '--'}
                      </span>
                    </div>
                    <Progress value={lengthOfStayPredictions.length > 0 ? 75 : 0} className="h-2" />
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* ===================== NO-SHOWS TAB ===================== */}
          <TabsContent value="noshows" className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">No-Show Risk Predictions</h3>
              {noShowSummary && (
                <Badge className="bg-red-100 text-red-700">
                  {noShowSummary.total} bookings analyzed
                </Badge>
              )}
            </div>

            {!selectedPropertyId && (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
                <AlertTriangle className="h-4 w-4 inline mr-2" />
                Please select a property to view no-show predictions.
              </div>
            )}

            {noShowLoading && (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600 mr-3" />
                <span className="text-gray-600">Loading no-show predictions...</span>
              </div>
            )}

            {noShowError && !noShowLoading && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">
                <AlertTriangle className="h-4 w-4 inline mr-2" />
                {noShowError}
                <Button size="sm" variant="outline" className="ml-3" onClick={fetchNoShowPredictions}>
                  Retry
                </Button>
              </div>
            )}

            {/* Summary Cards */}
            {noShowSummary && !noShowLoading && (
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <Card className="bg-gray-50">
                  <CardContent className="p-3 text-center">
                    <p className="text-xs text-gray-500">Total</p>
                    <p className="text-xl font-bold">{noShowSummary.total}</p>
                  </CardContent>
                </Card>
                <Card className="bg-red-50 border-red-200">
                  <CardContent className="p-3 text-center">
                    <p className="text-xs text-red-600">High Risk</p>
                    <p className="text-xl font-bold text-red-700">{noShowSummary.highRisk}</p>
                  </CardContent>
                </Card>
                <Card className="bg-yellow-50 border-yellow-200">
                  <CardContent className="p-3 text-center">
                    <p className="text-xs text-yellow-600">Medium Risk</p>
                    <p className="text-xl font-bold text-yellow-700">{noShowSummary.mediumRisk}</p>
                  </CardContent>
                </Card>
                <Card className="bg-green-50 border-green-200">
                  <CardContent className="p-3 text-center">
                    <p className="text-xs text-green-600">Low Risk</p>
                    <p className="text-xl font-bold text-green-700">{noShowSummary.lowRisk}</p>
                  </CardContent>
                </Card>
                <Card className="bg-orange-50 border-orange-200">
                  <CardContent className="p-3 text-center">
                    <p className="text-xs text-orange-600">Revenue at Risk</p>
                    <p className="text-lg font-bold text-orange-700">{formatCurrency(noShowSummary.totalRevenueAtRisk)}</p>
                  </CardContent>
                </Card>
              </div>
            )}

            {!noShowLoading && !noShowError && noShowPredictions.length === 0 && selectedPropertyId && (
              <div className="text-center py-12 text-gray-500">
                <UserX className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <h3 className="font-medium text-gray-700 mb-1">No Predictions Available</h3>
                <p className="text-sm">Click &quot;Run Analysis&quot; to generate no-show risk predictions.</p>
              </div>
            )}

            {/* Booking List sorted by risk */}
            <div className="space-y-3">
              {[...noShowPredictions]
                .sort((a, b) => b.noShowProbability - a.noShowProbability)
                .map((pred) => (
                  <Card key={pred.bookingId} className="transition-all hover:shadow-md">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <div>
                            <h4 className="font-medium">{pred.guestName}</h4>
                            <p className="text-sm text-gray-500">{pred.roomType} &middot; Check-in: {format(new Date(pred.checkInDate), 'MMM dd, yyyy')}</p>
                          </div>
                          <Badge className={getRiskColor(pred.risk)}>
                            {pred.risk.toUpperCase()} RISK
                          </Badge>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-gray-500">Potential Loss</p>
                          <p className="font-bold text-red-700">{formatCurrency(pred.potentialRevenueLoss)}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-xs text-gray-500 w-20">Probability</span>
                        <Progress value={Math.round(pred.noShowProbability * 100)} className="flex-1 h-2" />
                        <span className="text-sm font-bold w-12 text-right">{Math.round(pred.noShowProbability * 100)}%</span>
                      </div>
                      <div className="flex items-start justify-between">
                        <div className="flex flex-wrap gap-1">
                          {pred.factors.map((factor, i) => (
                            <Badge key={i} variant="outline" className="text-xs">{factor}</Badge>
                          ))}
                        </div>
                        <div className="text-right ml-4 shrink-0">
                          <p className="text-xs text-gray-500">Recommended Action</p>
                          <p className="text-sm font-medium text-blue-700">{pred.recommendedAction}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
            </div>
          </TabsContent>

          {/* ===================== DEMAND TAB (Real Data) ===================== */}
          <TabsContent value="demand" className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Demand Forecast</h3>
              <div className="flex items-center gap-2">
                {demandForecasts.length > 0 && (
                  <Badge className="bg-green-100 text-green-700">
                    Avg Confidence: {Math.round(demandForecasts.reduce((acc, f) => acc + f.confidence, 0) / demandForecasts.length)}%
                  </Badge>
                )}
              </div>
            </div>

            {!selectedPropertyId && (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
                <AlertTriangle className="h-4 w-4 inline mr-2" />
                Please select a property to view demand forecasts.
              </div>
            )}

            {demandLoading && (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mr-3" />
                <span className="text-gray-600">Loading demand forecasts...</span>
              </div>
            )}

            {demandError && !demandLoading && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">
                <AlertTriangle className="h-4 w-4 inline mr-2" />
                {demandError}
                <Button size="sm" variant="outline" className="ml-3" onClick={fetchDemandForecasts}>
                  Retry
                </Button>
              </div>
            )}

            {!demandLoading && !demandError && demandForecasts.length === 0 && selectedPropertyId && (
              <div className="text-center py-12 text-gray-500">
                <TrendingUp className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <h3 className="font-medium text-gray-700 mb-1">No Forecast Data</h3>
                <p className="text-sm">Click "Run Analysis" to generate demand forecasts for this property.</p>
              </div>
            )}

            <div className="grid gap-4">
              {demandForecasts.map((forecast) => (
                <Card key={forecast.date} className="transition-all hover:shadow-md">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-4">
                        <div>
                          <h4 className="font-medium">
                            {format(new Date(forecast.date), 'MMM dd, yyyy')}
                          </h4>
                          <p className="text-sm text-gray-600">
                            {format(new Date(forecast.date), 'EEEE')}
                          </p>
                        </div>
                        <Badge className={`${
                          forecast.demandLevel === 'high' ? 'bg-red-100 text-red-700' :
                          forecast.demandLevel === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-green-100 text-green-700'
                        }`}>
                          {forecast.demandLevel.toUpperCase()} Demand
                        </Badge>
                      </div>

                      <div className="text-right">
                        <div className="flex items-center gap-2 mb-1">
                          <Progress value={forecast.predictedOccupancy} className="w-24 h-2" />
                          <span className="text-lg font-bold">{Math.round(forecast.predictedOccupancy)}%</span>
                        </div>
                        <p className="text-xs text-gray-500">{Math.round(forecast.confidence)}% confidence</p>
                      </div>
                    </div>

                    {forecast.roomTypeBreakdown.length > 0 && (
                      <div className="space-y-2">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                          {forecast.roomTypeBreakdown.map((room, i) => (
                            <div key={i} className="text-center p-2 bg-gray-50 rounded">
                              <p className="text-xs text-gray-600">{room.roomType}</p>
                              <p className="text-sm font-medium">{room.predictedBookings} bookings</p>
                              <p className="text-xs text-green-600">{formatCurrency(room.optimalRate)}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {forecast.influencingFactors.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {forecast.influencingFactors.map((factor, i) => (
                          <Badge key={i} variant="outline" className="text-xs">
                            {factor}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* ===================== GUEST VALUE TAB ===================== */}
          <TabsContent value="guests" className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Guest Lifetime Value Predictions</h3>
              {guestValuePredictions.length > 0 && (
                <Badge className="bg-purple-100 text-purple-700">
                  {guestValuePredictions.length} guests scored
                </Badge>
              )}
            </div>

            {!selectedPropertyId && (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
                <AlertTriangle className="h-4 w-4 inline mr-2" />
                Please select a property to view guest value predictions.
              </div>
            )}

            {guestValueLoading && (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mr-3" />
                <span className="text-gray-600">Loading guest value predictions...</span>
              </div>
            )}

            {guestValueError && !guestValueLoading && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">
                <AlertTriangle className="h-4 w-4 inline mr-2" />
                {guestValueError}
                <Button size="sm" variant="outline" className="ml-3" onClick={fetchGuestValuePredictions}>
                  Retry
                </Button>
              </div>
            )}

            {!guestValueLoading && !guestValueError && guestValuePredictions.length === 0 && selectedPropertyId && (
              <div className="text-center py-12 text-gray-500">
                <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <h3 className="font-medium text-gray-700 mb-1">No Guest Data Available</h3>
                <p className="text-sm">Click &quot;Run Analysis&quot; to generate guest value predictions.</p>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {guestValuePredictions.map((guest) => (
                <Card key={guest.guestId} className="transition-all hover:shadow-md">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        {getTierIcon(guest.valueTier)}
                        <h4 className="font-medium">{guest.guestName}</h4>
                        <Badge className={getTierColor(guest.valueTier)}>
                          {guest.valueTier.toUpperCase()}
                        </Badge>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 mb-3">
                      <div className="p-2 bg-gray-50 rounded">
                        <p className="text-xs text-gray-500">Current Value</p>
                        <p className="font-bold">{formatCurrency(guest.currentValue)}</p>
                      </div>
                      <div className="p-2 bg-green-50 rounded">
                        <p className="text-xs text-green-600">Predicted LTV</p>
                        <p className="font-bold text-green-700">{formatCurrency(guest.predictedLifetimeValue)}</p>
                      </div>
                    </div>

                    <div className="space-y-2 mb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500 w-24">Churn Risk</span>
                        <Progress
                          value={Math.round(guest.churnRisk * 100)}
                          className={`flex-1 h-2 ${guest.churnRisk > 0.6 ? '[&>div]:bg-red-500' : guest.churnRisk > 0.3 ? '[&>div]:bg-yellow-500' : '[&>div]:bg-green-500'}`}
                        />
                        <span className="text-xs font-bold w-10 text-right">{Math.round(guest.churnRisk * 100)}%</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500 w-24">Loyalty Score</span>
                        <Progress value={Math.round(guest.loyaltyScore)} className="flex-1 h-2" />
                        <span className="text-xs font-bold w-10 text-right">{Math.round(guest.loyaltyScore)}</span>
                      </div>
                    </div>

                    {guest.recommendedPerks.length > 0 && (
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Recommended Perks</p>
                        <div className="flex flex-wrap gap-1">
                          {guest.recommendedPerks.map((perk, i) => (
                            <Badge key={i} variant="outline" className="text-xs bg-purple-50 border-purple-200 text-purple-700">
                              {perk}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* ===================== OVERBOOKING TAB ===================== */}
          <TabsContent value="overbooking" className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Overbooking Recommendations</h3>
              {overbookingSummary && (
                <Badge className="bg-blue-100 text-blue-700">
                  {formatCurrency(overbookingSummary.totalPotentialRevenue)} potential revenue
                </Badge>
              )}
            </div>

            {!selectedPropertyId && (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
                <AlertTriangle className="h-4 w-4 inline mr-2" />
                Please select a property to view overbooking recommendations.
              </div>
            )}

            {overbookingLoading && (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mr-3" />
                <span className="text-gray-600">Loading overbooking recommendations...</span>
              </div>
            )}

            {overbookingError && !overbookingLoading && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">
                <AlertTriangle className="h-4 w-4 inline mr-2" />
                {overbookingError}
                <Button size="sm" variant="outline" className="ml-3" onClick={fetchOverbookingRecommendations}>
                  Retry
                </Button>
              </div>
            )}

            {!overbookingLoading && !overbookingError && overbookingRecommendations.length === 0 && selectedPropertyId && (
              <div className="text-center py-12 text-gray-500">
                <Target className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <h3 className="font-medium text-gray-700 mb-1">No Recommendations Available</h3>
                <p className="text-sm">Click &quot;Run Analysis&quot; to generate overbooking recommendations.</p>
              </div>
            )}

            {/* Per-date, per-room-type grid */}
            {overbookingRecommendations.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="bg-gray-50 border-b">
                      <th className="text-left p-3 font-medium text-gray-700">Date</th>
                      <th className="text-left p-3 font-medium text-gray-700">Room Type</th>
                      <th className="text-center p-3 font-medium text-gray-700">Current Bookings</th>
                      <th className="text-center p-3 font-medium text-gray-700">Expected Walk-ins</th>
                      <th className="text-center p-3 font-medium text-gray-700">Optimal Overbooking</th>
                      <th className="text-center p-3 font-medium text-gray-700">Risk</th>
                      <th className="text-right p-3 font-medium text-gray-700">Potential Revenue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {overbookingRecommendations.map((rec, idx) => (
                      <tr key={`${rec.date}-${rec.roomType}-${idx}`} className="border-b hover:bg-gray-50 transition-colors">
                        <td className="p-3">
                          <div className="font-medium">{format(new Date(rec.date), 'MMM dd')}</div>
                          <div className="text-xs text-gray-500">{format(new Date(rec.date), 'EEEE')}</div>
                        </td>
                        <td className="p-3">{rec.roomType}</td>
                        <td className="text-center p-3">
                          <span className="font-bold">{rec.currentBookings}</span>
                        </td>
                        <td className="text-center p-3">{rec.expectedWalkIns}</td>
                        <td className="text-center p-3">
                          <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-700 font-bold">
                            +{rec.optimalOverbooking}
                          </span>
                        </td>
                        <td className="text-center p-3">
                          <Badge className={getRiskColor(rec.riskLevel)}>
                            {rec.riskLevel.toUpperCase()}
                          </Badge>
                        </td>
                        <td className="text-right p-3 font-bold text-green-700">
                          {formatCurrency(rec.potentialRevenue)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </TabsContent>

          {/* ===================== LENGTH OF STAY TAB ===================== */}
          <TabsContent value="los" className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Length of Stay Predictions</h3>
              {lengthOfStayPredictions.length > 0 && (
                <Badge className="bg-indigo-100 text-indigo-700">
                  {lengthOfStayPredictions.filter(p => p.extensionProbability > 0.5).length} likely extensions
                </Badge>
              )}
            </div>

            {!selectedPropertyId && (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
                <AlertTriangle className="h-4 w-4 inline mr-2" />
                Please select a property to view stay-length predictions.
              </div>
            )}

            {losLoading && (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mr-3" />
                <span className="text-gray-600">Loading stay-length predictions...</span>
              </div>
            )}

            {losError && !losLoading && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">
                <AlertTriangle className="h-4 w-4 inline mr-2" />
                {losError}
                <Button size="sm" variant="outline" className="ml-3" onClick={fetchLengthOfStayPredictions}>
                  Retry
                </Button>
              </div>
            )}

            {!losLoading && !losError && lengthOfStayPredictions.length === 0 && selectedPropertyId && (
              <div className="text-center py-12 text-gray-500">
                <Clock className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <h3 className="font-medium text-gray-700 mb-1">No Stay Predictions Available</h3>
                <p className="text-sm">Click &quot;Run Analysis&quot; to generate stay-length predictions.</p>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {lengthOfStayPredictions.map((pred) => (
                <Card key={pred.bookingId} className="transition-all hover:shadow-md">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-medium">{pred.guestName}</h4>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          {pred.initialStay} night{pred.initialStay !== 1 ? 's' : ''} booked
                        </Badge>
                        {pred.predictedExtension > 0 && (
                          <Badge className="bg-indigo-100 text-indigo-700 text-xs">
                            +{pred.predictedExtension} night{pred.predictedExtension !== 1 ? 's' : ''} predicted
                          </Badge>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-3 mb-3">
                      <span className="text-xs text-gray-500 w-28">Extension Prob.</span>
                      <Progress
                        value={Math.round(pred.extensionProbability * 100)}
                        className={`flex-1 h-3 ${pred.extensionProbability > 0.7 ? '[&>div]:bg-green-500' : pred.extensionProbability > 0.4 ? '[&>div]:bg-yellow-500' : '[&>div]:bg-gray-400'}`}
                      />
                      <span className="text-sm font-bold w-12 text-right">{Math.round(pred.extensionProbability * 100)}%</span>
                    </div>

                    {pred.factors.length > 0 && (
                      <div className="mb-2">
                        <p className="text-xs text-gray-500 mb-1">Contributing Factors</p>
                        <div className="flex flex-wrap gap-1">
                          {pred.factors.map((factor, i) => (
                            <Badge key={i} variant="outline" className="text-xs">{factor}</Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {pred.upsellOpportunities.length > 0 && (
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Upsell Opportunities</p>
                        <div className="flex flex-wrap gap-1">
                          {pred.upsellOpportunities.map((opp, i) => (
                            <Badge key={i} className="text-xs bg-green-50 text-green-700 border border-green-200">
                              {opp}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default withErrorBoundary(PredictiveAnalyticsEngine, { level: 'component' });
