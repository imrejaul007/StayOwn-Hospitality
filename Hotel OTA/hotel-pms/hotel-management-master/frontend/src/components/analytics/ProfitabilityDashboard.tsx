import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  TrendingUp,
  TrendingDown,
  IndianRupee,
  BarChart3,
  PieChart,
  Target,
  Calendar,
  Users,
  Bed,
  Building,
  ArrowUpRight,
  ArrowDownRight,
  Brain,
  AlertTriangle,
  Zap,
  RefreshCw
} from 'lucide-react';
import { formatCurrency } from '@/utils/currencyUtils';
import analyticsService, { ProfitabilityData } from '@/services/analyticsService';

interface ProfitabilityMetrics {
  totalRevenue: number;
  totalCosts: number;
  grossProfit: number;
  netProfit: number;
  profitMargin: number;
  revenuePerRoom: number;
  costPerRoom: number;
  occupancyRate: number;
  averageDailyRate: number;
  revenuePAR: number;
  previousPeriodComparison: {
    revenue: number;
    profit: number;
    occupancy: number;
  };
}

interface RoomTypeProfitability {
  roomType: string;
  revenue: number;
  costs: number;
  profit: number;
  profitMargin: number;
  occupancyRate: number;
  averageRate: number;
  roomCount: number;
}

interface ForecastData {
  date: string;
  predictedRevenue: number;
  predictedOccupancy: number;
  confidence: number;
  factors: string[];
}

interface ProfitabilityDashboardProps {
  className?: string;
}

interface Recommendation {
  title: string;
  description: string;
  potential?: string;
  savings?: string;
  type: string;
}

interface SmartRecommendations {
  revenueOpportunities: Recommendation[];
  costOptimizations: Recommendation[];
}

const ProfitabilityDashboard: React.FC<ProfitabilityDashboardProps> = ({ className = '' }) => {
  const [selectedPeriod, setSelectedPeriod] = useState('30d');
  const [metrics, setMetrics] = useState<ProfitabilityMetrics | null>(null);
  const [roomTypeProfitability, setRoomTypeProfitability] = useState<RoomTypeProfitability[]>([]);
  const [forecast, setForecast] = useState<ForecastData[]>([]);
  const [recommendations, setRecommendations] = useState<SmartRecommendations | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    fetchAnalyticsData();
  }, [selectedPeriod]);

  const fetchAnalyticsData = async () => {
    setIsLoading(true);
    try {
      const data: ProfitabilityData = await analyticsService.getProfitabilityMetrics(selectedPeriod);


      // Set all data from the single API call
      setMetrics(data);
      setRoomTypeProfitability(data.roomTypeProfitability || []);
      setForecast(data.forecast || []);
      setRecommendations(data.recommendations || { revenueOpportunities: [], costOptimizations: [] });

    } catch (error) {
      // Show empty state instead of fake data
      setMetrics(null);
      setRoomTypeProfitability([]);
      setForecast([]);
      setRecommendations({ revenueOpportunities: [], costOptimizations: [] });
      setFetchError('Unable to load profitability data. Please try again later.');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchRoomTypeProfitability = async () => {
    try {
      const { data } = await api.get('/analytics/room-type-profitability', { params: { period: selectedPeriod } });
      if (data.success && data.data && data.data.length > 0) {
        setRoomTypeProfitability(data.data);
      } else {
        setRoomTypeProfitability([]);
      }
    } catch (error) {
      setRoomTypeProfitability([]);
    }
  };

  const fetchForecastData = async () => {
    try {
      const { data } = await api.get('/analytics/revenue-forecast', { params: { days: 7 } });
      if (data.success && data.data && data.data.length > 0) {
        setForecast(data.data);
      } else {
        setForecast([]);
      }
    } catch (error) {
      setForecast([]);
    }
  };

  const fetchRecommendations = async () => {
    try {
      const { data } = await api.get('/analytics/smart-recommendations', { params: { period: selectedPeriod } });
      if (data.success && data.data) {
        setRecommendations(data.data);
      }
    } catch {
      // Error handled silently
    }
  };

  const getRoomTypeName = (roomNumber: string) => {
    // Convert room numbers to room types
    const roomNum = parseInt(roomNumber);
    if (roomNum >= 1001) return 'Presidential Suite';
    if (roomNum >= 801) return 'Executive Suite';
    if (roomNum >= 501) return 'Deluxe Suite';
    return 'Standard Suite';
  };

  const getChangeIcon = (change: number) => {
    if (change > 0) return <TrendingUp className="w-4 h-4 text-green-500" />;
    if (change < 0) return <TrendingDown className="w-4 h-4 text-red-500" />;
    return <div className="w-4 h-4" />;
  };

  const getChangeColor = (change: number) => {
    if (change > 0) return 'text-green-600';
    if (change < 0) return 'text-red-600';
    return 'text-gray-600';
  };

  const calculateTotalProfit = () => {
    return roomTypeProfitability.reduce((sum, room) => sum + room.profit, 0);
  };

  const getMostProfitableRoomType = () => {
    return roomTypeProfitability.reduce((best, current) => 
      current.profitMargin > best.profitMargin ? current : best,
      roomTypeProfitability[0]
    );
  };

  if (isLoading) {
    return (
      <div className={`space-y-4 ${className}`}>
        <div className="animate-pulse space-y-4">
          <div className="h-32 bg-gray-200 rounded"></div>
          <div className="grid grid-cols-4 gap-4">
            <div className="h-24 bg-gray-200 rounded"></div>
            <div className="h-24 bg-gray-200 rounded"></div>
            <div className="h-24 bg-gray-200 rounded"></div>
            <div className="h-24 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Error Banner */}
      {fetchError && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0" />
          <p className="text-red-700 text-sm">{fetchError}</p>
          <Button variant="outline" size="sm" className="ml-auto" onClick={() => { setFetchError(null); fetchAnalyticsData(); }}>
            <RefreshCw className="w-4 h-4 mr-1" />
            Retry
          </Button>
        </div>
      )}
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Profitability Analytics</h2>
          <p className="text-gray-600">AI-powered revenue insights and forecasting</p>
        </div>
        
        <div className="flex items-center gap-3">
          <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
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
          
          <Button variant="outline" size="sm">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      {metrics && (
        <div className="grid grid-cols-5 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Revenue</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {formatCurrency(metrics.totalRevenue)}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  {getChangeIcon(metrics.previousPeriodComparison.revenue)}
                  <span className={`text-sm font-medium ${getChangeColor(metrics.previousPeriodComparison.revenue)}`}>
                    {Math.abs(metrics.previousPeriodComparison.revenue)}%
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Net Profit</p>
                  <p className="text-2xl font-bold text-green-600">
                    {formatCurrency(metrics.netProfit)}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  {getChangeIcon(metrics.previousPeriodComparison.profit)}
                  <span className={`text-sm font-medium ${getChangeColor(metrics.previousPeriodComparison.profit)}`}>
                    {Math.abs(metrics.previousPeriodComparison.profit)}%
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Profit Margin</p>
                  <p className="text-2xl font-bold text-blue-600">
                    {metrics.profitMargin}%
                  </p>
                </div>
                <Badge variant="secondary" className="text-xs">
                  Target: 35%
                </Badge>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">RevPAR</p>
                  <p className="text-2xl font-bold text-purple-600">
                    {formatCurrency(metrics.revenuePAR)}
                  </p>
                </div>
                <div className="text-xs text-gray-500">
                  Revenue per Available Room
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Occupancy</p>
                  <p className="text-2xl font-bold text-orange-600">
                    {metrics.occupancyRate}%
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  {getChangeIcon(metrics.previousPeriodComparison.occupancy)}
                  <span className={`text-sm font-medium ${getChangeColor(metrics.previousPeriodComparison.occupancy)}`}>
                    {Math.abs(metrics.previousPeriodComparison.occupancy)}%
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs defaultValue="room-analysis" className="space-y-4">
        <TabsList>
          <TabsTrigger value="room-analysis">Room Type Analysis</TabsTrigger>
          <TabsTrigger value="forecasting">AI Forecasting</TabsTrigger>
          <TabsTrigger value="recommendations">Smart Recommendations</TabsTrigger>
        </TabsList>

        <TabsContent value="room-analysis" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5" />
                Room Type Profitability
              </CardTitle>
            </CardHeader>
            <CardContent>
              {roomTypeProfitability.length > 0 ? (
                <div className="space-y-4">
                  {roomTypeProfitability.map((room, index) => (
                    <div key={`roomTypeProfitability-${index}`} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <h4 className="font-medium">{room.roomType}</h4>
                          <Badge variant="outline" className="text-xs">
                            {room.roomCount} rooms
                          </Badge>
                          <Badge
                            className={`text-xs ${
                              room.profitMargin > 45 ? 'bg-green-100 text-green-700' :
                              room.profitMargin > 30 ? 'bg-yellow-100 text-yellow-700' :
                              'bg-red-100 text-red-700'
                            }`}
                          >
                            {room.profitMargin}% margin
                          </Badge>
                        </div>

                        <div className="grid grid-cols-4 gap-4 mt-3 text-sm text-gray-600">
                          <div>
                            <span className="block text-xs text-gray-500">Revenue</span>
                            <span className="font-medium">{formatCurrency(room.revenue)}</span>
                          </div>
                          <div>
                            <span className="block text-xs text-gray-500">Profit</span>
                            <span className="font-medium text-green-600">{formatCurrency(room.profit)}</span>
                          </div>
                          <div>
                            <span className="block text-xs text-gray-500">Occupancy</span>
                            <span className="font-medium">{room.occupancyRate}%</span>
                          </div>
                          <div>
                            <span className="block text-xs text-gray-500">Avg Rate</span>
                            <span className="font-medium">{formatCurrency(room.averageRate)}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-full ${
                          room.profitMargin > 45 ? 'bg-green-500' :
                          room.profitMargin > 30 ? 'bg-yellow-500' :
                          'bg-red-500'
                        }`} />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <BarChart3 className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>No room type profitability data available</p>
                  <p className="text-xs mt-1">Data will appear once bookings are recorded</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="forecasting" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Brain className="w-5 h-5" />
                AI Revenue Forecasting
              </CardTitle>
            </CardHeader>
            <CardContent>
              {forecast.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Brain className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>No forecast data available</p>
                  <p className="text-xs mt-1">Forecast data will appear once sufficient booking history is available</p>
                </div>
              ) : (
              <div className="space-y-4">
                {forecast.map((day, index) => (
                  <div key={`forecast-${index}-${day.date}`} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-4">
                      <div className="text-center">
                        <div className="text-sm font-medium">{new Date(day.date).toLocaleDateString('en-US', { weekday: 'short' })}</div>
                        <div className="text-xs text-gray-500">{new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>
                      </div>
                      
                      <div className="space-y-1">
                        <div className="flex items-center gap-3">
                          <span className="text-lg font-bold text-green-600">
                            {formatCurrency(day.predictedRevenue)}
                          </span>
                          <span className="text-sm text-gray-600">
                            {day.predictedOccupancy}% occupancy
                          </span>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="text-xs">
                            {Math.round(day.confidence)}% confidence
                          </Badge>
                          {day.factors.map((factor, idx) => (
                            <span key={idx} className="text-xs text-gray-500 bg-white px-2 py-1 rounded">
                              {factor}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                    
                    <div className={`w-3 h-3 rounded-full ${
                      day.confidence > 90 ? 'bg-green-500' :
                      day.confidence > 80 ? 'bg-yellow-500' :
                      'bg-red-500'
                    }`} />
                  </div>
                ))}
              </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="recommendations" className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-green-600">
                  <Target className="w-5 h-5" />
                  Revenue Opportunities
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {recommendations && recommendations.revenueOpportunities.length > 0 ? (
                  recommendations.revenueOpportunities.map((opportunity, index) => (
                    <div key={`recommendations-revenueOpportunities-${index}-${opportunity.title}`} className="p-3 bg-green-50 rounded-lg">
                      <div className="flex items-center gap-2 mb-1">
                        <ArrowUpRight className="w-4 h-4 text-green-600" />
                        <span className="font-medium text-green-800">{opportunity.title}</span>
                      </div>
                      <p className="text-sm text-green-700">{opportunity.description}</p>
                      <div className="text-xs text-green-600 mt-1">Potential: {opportunity.potential}</div>
                    </div>
                  ))
                ) : (
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-2 mb-1">
                      <Brain className="w-4 h-4 text-gray-600" />
                      <span className="font-medium text-gray-700">Analyzing data...</span>
                    </div>
                    <p className="text-sm text-gray-600">No specific revenue opportunities identified based on current data. System is analyzing performance patterns.</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-orange-600">
                  <AlertTriangle className="w-5 h-5" />
                  Cost Optimization
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {recommendations && recommendations.costOptimizations.length > 0 ? (
                  recommendations.costOptimizations.map((optimization, index) => (
                    <div key={`recommendations-costOptimizations-${index}-${optimization.title}`} className="p-3 bg-orange-50 rounded-lg">
                      <div className="flex items-center gap-2 mb-1">
                        <ArrowDownRight className="w-4 h-4 text-orange-600" />
                        <span className="font-medium text-orange-800">{optimization.title}</span>
                      </div>
                      <p className="text-sm text-orange-700">{optimization.description}</p>
                      <div className="text-xs text-orange-600 mt-1">Savings: {optimization.savings}</div>
                    </div>
                  ))
                ) : (
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-2 mb-1">
                      <Zap className="w-4 h-4 text-gray-600" />
                      <span className="font-medium text-gray-700">Operations optimized</span>
                    </div>
                    <p className="text-sm text-gray-600">No critical cost optimization opportunities found. Current operations appear to be running efficiently.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ProfitabilityDashboard;