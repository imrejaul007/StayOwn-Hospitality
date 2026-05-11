import React, { useState } from 'react';
import { usePredictiveAnalytics, useFloorAnalytics } from '../../hooks/useWorkflow';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { 
  TrendingUp, 
  TrendingDown, 
  Calendar, 
  IndianRupee, 
  Users, 
  Wrench,
  AlertTriangle,
  CheckCircle,
  Clock,
  Target
} from 'lucide-react';

interface PredictiveAnalyticsDashboardProps {
  hotelId: string;
  selectedFloor?: number;
}

export const PredictiveAnalyticsDashboard: React.FC<PredictiveAnalyticsDashboardProps> = ({
  hotelId,
  selectedFloor
}) => {
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d'>('30d');
  const [activeTab, setActiveTab] = useState('overview');

  // Fetch predictive analytics data
  const { data: predictiveData, isLoading: predictiveLoading } = usePredictiveAnalytics(timeRange);
  
  // Fetch floor analytics if floor is selected
  const { data: floorData, isLoading: floorLoading } = useFloorAnalytics(selectedFloor || 1, {
    enabled: !!selectedFloor
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatPercentage = (value: number) => {
    return `${value.toFixed(1)}%`;
  };

  const getTrendIcon = (value: number) => {
    return value > 0 ? (
      <TrendingUp className="w-4 h-4 text-green-500" />
    ) : (
      <TrendingDown className="w-4 h-4 text-red-500" />
    );
  };

  const getPriorityColor = (priority: string) => {
    switch (priority.toLowerCase()) {
      case 'urgent': return 'bg-red-100 text-red-800';
      case 'high': return 'bg-orange-100 text-orange-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'low': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 80) return 'text-green-600';
    if (confidence >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Predictive Analytics</h2>
          <p className="text-gray-600">AI-powered insights and forecasting</p>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant={timeRange === '7d' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setTimeRange('7d')}
          >
            7 Days
          </Button>
          <Button
            variant={timeRange === '30d' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setTimeRange('30d')}
          >
            30 Days
          </Button>
          <Button
            variant={timeRange === '90d' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setTimeRange('90d')}
          >
            90 Days
          </Button>
        </div>
      </div>

      {/* Floor Analytics (if floor selected) */}
      {selectedFloor && floorData && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Target className="w-5 h-5" />
              <span>Floor {selectedFloor} Performance</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {formatPercentage(floorData.data.occupancyRate)}
                </div>
                <div className="text-sm text-gray-600">Occupancy Rate</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {floorData.data.averageStayDuration.toFixed(1)}
                </div>
                <div className="text-sm text-gray-600">Avg Stay (Days)</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">
                  {formatCurrency(floorData.data.revenuePerRoom)}
                </div>
                <div className="text-sm text-gray-600">Revenue/Room</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600">
                  {floorData.data.maintenanceRequests}
                </div>
                <div className="text-sm text-gray-600">Maintenance</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-indigo-600">
                  {formatPercentage(floorData.data.housekeepingEfficiency)}
                </div>
                <div className="text-sm text-gray-600">Housekeeping</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-pink-600">
                  {floorData.data.guestSatisfaction.toFixed(1)}★
                </div>
                <div className="text-sm text-gray-600">Satisfaction</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Analytics Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="occupancy">Occupancy</TabsTrigger>
          <TabsTrigger value="revenue">Revenue</TabsTrigger>
          <TabsTrigger value="maintenance">Maintenance</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Key Metrics */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">Next 7 Days Forecast</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {predictiveData?.data?.occupancyForecast?.slice(0, 3).map((forecast, index) => (
                    <div key={`-${index}-${forecast.date}`} className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Calendar className="w-4 h-4 text-gray-400" />
                        <span className="text-sm text-gray-600">
                          {new Date(forecast.date).toLocaleDateString('en-IN', { 
                            weekday: 'short', 
                            month: 'short', 
                            day: 'numeric' 
                          })}
                        </span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="font-semibold">{forecast.predictedOccupancy}%</span>
                        <Badge 
                          variant="secondary" 
                          className={`text-xs ${getConfidenceColor(forecast.confidence)}`}
                        >
                          {forecast.confidence.toFixed(0)}%
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Revenue Forecast */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">Revenue Forecast</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {predictiveData?.data?.revenueForecast?.slice(0, 3).map((forecast, index) => (
                    <div key={`-${index}-${forecast.date}`} className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <IndianRupee className="w-4 h-4 text-gray-400" />
                        <span className="text-sm text-gray-600">
                          {new Date(forecast.date).toLocaleDateString('en-IN', { 
                            weekday: 'short', 
                            month: 'short', 
                            day: 'numeric' 
                          })}
                        </span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="font-semibold">{formatCurrency(forecast.predictedRevenue)}</span>
                        <Badge 
                          variant="secondary" 
                          className={`text-xs ${getConfidenceColor(forecast.confidence)}`}
                        >
                          {forecast.confidence.toFixed(0)}%
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Maintenance Alerts */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">Maintenance Alerts</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {predictiveData?.data?.maintenancePredictions?.slice(0, 3).map((prediction, index) => (
                    <div key={prediction.roomId} className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Wrench className="w-4 h-4 text-orange-500" />
                        <span className="text-sm text-gray-600">Room {prediction.roomId.slice(-4)}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Badge className={getPriorityColor(prediction.issueType)}>
                          {prediction.issueType}
                        </Badge>
                        <span className="text-xs text-gray-500">
                          {prediction.probability.toFixed(0)}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Occupancy Tab */}
        <TabsContent value="occupancy" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Users className="w-5 h-5" />
                <span>Occupancy Forecast</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {predictiveData?.data?.occupancyForecast?.map((forecast, index) => (
                  <div key={`-${index}-${forecast.date}`} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                        <Calendar className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <div className="font-medium">
                          {new Date(forecast.date).toLocaleDateString('en-IN', { 
                            weekday: 'long', 
                            month: 'long', 
                            day: 'numeric' 
                          })}
                        </div>
                        <div className="text-sm text-gray-600">
                          Confidence: {forecast.confidence.toFixed(1)}%
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-blue-600">
                        {forecast.predictedOccupancy}%
                      </div>
                      <div className="text-sm text-gray-600">Predicted</div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Revenue Tab */}
        <TabsContent value="revenue" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <IndianRupee className="w-5 h-5" />
                <span>Revenue Forecast</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {predictiveData?.data?.revenueForecast?.map((forecast, index) => (
                  <div key={`-${index}-${forecast.date}`} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                        <IndianRupee className="w-5 h-5 text-green-600" />
                      </div>
                      <div>
                        <div className="font-medium">
                          {new Date(forecast.date).toLocaleDateString('en-IN', { 
                            weekday: 'long', 
                            month: 'long', 
                            day: 'numeric' 
                          })}
                        </div>
                        <div className="text-sm text-gray-600">
                          Confidence: {forecast.confidence.toFixed(1)}%
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-green-600">
                        {formatCurrency(forecast.predictedRevenue)}
                      </div>
                      <div className="text-sm text-gray-600">Predicted</div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Maintenance Tab */}
        <TabsContent value="maintenance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Wrench className="w-5 h-5" />
                <span>Maintenance Predictions</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {predictiveData?.data?.maintenancePredictions?.map((prediction, index) => (
                  <div key={prediction.roomId} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center">
                        <Wrench className="w-5 h-5 text-orange-600" />
                      </div>
                      <div>
                        <div className="font-medium">
                          Room {prediction.roomId.slice(-4)}
                        </div>
                        <div className="text-sm text-gray-600">
                          Expected: {new Date(prediction.estimatedDate).toLocaleDateString('en-IN')}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge className={getPriorityColor(prediction.issueType)}>
                        {prediction.issueType}
                      </Badge>
                      <div className="text-sm text-gray-600 mt-1">
                        {prediction.probability.toFixed(0)}% probability
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Loading State */}
      {(predictiveLoading || floorLoading) && (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-2 text-gray-600">Loading analytics...</span>
        </div>
      )}
    </div>
  );
};
