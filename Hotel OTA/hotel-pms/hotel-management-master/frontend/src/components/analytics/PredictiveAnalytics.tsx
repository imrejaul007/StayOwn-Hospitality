import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import {
  X,
  Brain,
  TrendingUp,
  TrendingDown,
  Users,
  AlertTriangle,
  Target,
  Clock,
  Download,
  RefreshCw,
  Filter,
  Calendar,
  Eye,
  BarChart3,
  PieChart,
  LineChart,
  Zap,
  Shield,
  Star
} from 'lucide-react';
import { toast } from 'react-hot-toast';

interface PredictiveAnalyticsProps {
  analytics: unknown;
  onClose: () => void;
}

interface PredictiveData {
  totalUsers: string[];
  highChurnRiskUsers: Array<{
    userId: string;
    userName: string;
    userEmail: string;
    churnRisk: number;
    engagementScore: number;
    lifecycleStage: string;
    recommendedActions: string[];
  }>;
  engagementTrends: Array<{
    userId: string;
    userName: string;
    engagementTrend: string;
    nextLoginPrediction: string;
  }>;
  averagePredictedLifetimeValue: number;
  totalUserCount: number;
  highChurnRiskCount: number;
}

interface ChurnPrediction {
  userId: string;
  userName: string;
  userEmail: string;
  churnRisk: number;
  engagementScore: number;
  lifecycleStage: string;
  recommendedActions: string[];
  predictedChurnDate?: string;
  confidence: number;
}

interface EngagementForecast {
  userId: string;
  userName: string;
  engagementTrend: string;
  nextLoginPrediction: string;
  predictedEngagementScore: number;
  confidence: number;
}

const PredictiveAnalytics: React.FC<PredictiveAnalyticsProps> = ({
  analytics,
  onClose
}) => {
  const [predictiveData, setPredictiveData] = useState<PredictiveData | null>(null);
  const [churnPredictions, setChurnPredictions] = useState<ChurnPrediction[]>([]);
  const [engagementForecasts, setEngagementForecasts] = useState<EngagementForecast[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'churn' | 'engagement' | 'recommendations'>('overview');
  const [dateRange, setDateRange] = useState('30');
  const [selectedMetric, setSelectedMetric] = useState<'churn' | 'engagement' | 'lifetime'>('churn');

  useEffect(() => {
    fetchPredictiveData();
  }, [dateRange]);

  const fetchPredictiveData = async () => {
    try {
      setLoading(true);
      
      const queryParams = new URLSearchParams();
      if (dateRange) {
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - parseInt(dateRange));
        queryParams.append('dateRange', JSON.stringify({
          start: startDate.toISOString().split('T')[0],
          end: endDate.toISOString().split('T')[0]
        }));
      }

      const { data } = await api.get(`/user-analytics/predictive?${queryParams}`);
      setPredictiveData(data.data);

      // Process churn predictions
      const churnData = data.data.highChurnRiskUsers.filter((user: Record<string, unknown>) => user !== null);
      setChurnPredictions(churnData.map((user: Record<string, unknown>) => ({
        ...user,
        predictedChurnDate: calculateChurnDate(user.churnRisk),
        confidence: calculateConfidence(user.churnRisk, user.engagementScore)
      })));

      // Process engagement forecasts
      setEngagementForecasts(data.data.engagementTrends.map((trend: Record<string, unknown>) => ({
        ...trend,
        predictedEngagementScore: calculatePredictedEngagement(trend.engagementTrend),
        confidence: calculateEngagementConfidence(trend.engagementTrend)
      })));
    } catch (error) {
      toast.error('Failed to fetch predictive analytics');
    } finally {
      setLoading(false);
    }
  };

  const calculateChurnDate = (churnRisk: number) => {
    const days = Math.max(1, Math.round((100 - churnRisk) / 10));
    const date = new Date();
    date.setDate(date.getDate() + days);
    return date.toISOString().split('T')[0];
  };

  const calculateConfidence = (churnRisk: number, engagementScore: number) => {
    const riskFactor = churnRisk / 100;
    const engagementFactor = engagementScore / 100;
    return Math.round((riskFactor + (1 - engagementFactor)) * 50);
  };

  const calculatePredictedEngagement = (trend: string) => {
    const baseScore = 60;
    switch (trend) {
      case 'increasing':
        return baseScore + 20;
      case 'stable':
        return baseScore;
      case 'decreasing':
        return baseScore - 20;
      default:
        return baseScore;
    }
  };

  const calculateEngagementConfidence = (trend: string) => {
    switch (trend) {
      case 'increasing':
        return 85;
      case 'stable':
        return 70;
      case 'decreasing':
        return 80;
      default:
        return 60;
    }
  };

  const getChurnRiskColor = (risk: number) => {
    if (risk >= 80) return 'text-red-600 bg-red-100';
    if (risk >= 60) return 'text-orange-600 bg-orange-100';
    if (risk >= 40) return 'text-yellow-600 bg-yellow-100';
    return 'text-green-600 bg-green-100';
  };

  const getEngagementTrendColor = (trend: string) => {
    switch (trend) {
      case 'increasing':
        return 'text-green-600 bg-green-100';
      case 'stable':
        return 'text-blue-600 bg-blue-100';
      case 'decreasing':
        return 'text-red-600 bg-red-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 80) return 'text-green-600 bg-green-100';
    if (confidence >= 60) return 'text-yellow-600 bg-yellow-100';
    return 'text-red-600 bg-red-100';
  };

  const getLifecycleColor = (stage: string) => {
    const colors = {
      'new': 'text-blue-600 bg-blue-100',
      'active': 'text-green-600 bg-green-100',
      'engaged': 'text-purple-600 bg-purple-100',
      'at_risk': 'text-yellow-600 bg-yellow-100',
      'churned': 'text-red-600 bg-red-100'
    };
    return colors[stage as keyof typeof colors] || 'text-gray-600 bg-gray-100';
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const getRecommendationIcon = (action: string) => {
    const icons = {
      'send_welcome_email': <Zap className="w-4 h-4" />,
      'offer_training': <Target className="w-4 h-4" />,
      'feature_highlight': <Star className="w-4 h-4" />,
      'engagement_campaign': <TrendingUp className="w-4 h-4" />,
      'retention_offer': <Shield className="w-4 h-4" />,
      'feedback_request': <Eye className="w-4 h-4" />,
      'upgrade_promotion': <BarChart3 className="w-4 h-4" />,
      'support_outreach': <Users className="w-4 h-4" />
    };
    return icons[action as keyof typeof icons] || <Target className="w-4 h-4" />;
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
        <div className="relative top-20 mx-auto p-5 border w-11/12 md:w-4/5 lg:w-3/4 shadow-lg rounded-md bg-white">
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-2 text-gray-600">Loading predictive analytics...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-10 mx-auto p-5 border w-11/12 md:w-4/5 lg:w-3/4 shadow-lg rounded-md bg-white">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center">
            <Brain className="w-6 h-6 text-blue-600 mr-2" />
            <h3 className="text-lg font-medium text-gray-900">Predictive Analytics</h3>
            <span className="ml-2 text-sm text-gray-500">AI-powered insights</span>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={fetchPredictiveData}
              disabled={loading}
              className="flex items-center px-3 py-1 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button aria-label="Close"
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Controls */}
        <div className="bg-gray-50 p-4 rounded-lg mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Time Range
              </label>
              <select
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="7">Last 7 Days</option>
                <option value="30">Last 30 Days</option>
                <option value="90">Last 90 Days</option>
                <option value="365">Last Year</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Focus Metric
              </label>
              <select
                value={selectedMetric}
                onChange={(e) => setSelectedMetric(e.target.value as 'churn' | 'engagement' | 'lifetime')}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="churn">Churn Prediction</option>
                <option value="engagement">Engagement Forecast</option>
                <option value="lifetime">Lifetime Value</option>
              </select>
            </div>
            <div className="flex items-end">
              <button
                onClick={() => {
                  setDateRange('30');
                  setSelectedMetric('churn');
                }}
                className="w-full flex items-center justify-center px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200"
              >
                <Filter className="w-4 h-4 mr-2" />
                Reset
              </button>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="mb-6">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              {[
                { id: 'overview', label: 'Overview', icon: BarChart3 },
                { id: 'churn', label: 'Churn Prediction', icon: AlertTriangle },
                { id: 'engagement', label: 'Engagement Forecast', icon: TrendingUp },
                { id: 'recommendations', label: 'Recommendations', icon: Target }
              ].map((tab) => {
                const Icon = tab.icon;
                return (
                  <button aria-label="Close"
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as unknown)}
                    className={`flex items-center py-2 px-1 border-b-2 font-medium text-sm ${
                      activeTab === tab.id
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    <Icon className="w-4 h-4 mr-2" />
                    {tab.label}
                  </button>
                );
              })}
            </nav>
          </div>
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && predictiveData && (
          <div className="space-y-6">
            {/* Summary Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-white p-4 rounded-lg shadow-sm border">
                <div className="flex items-center">
                  <Users className="w-8 h-8 text-blue-600" />
                  <div className="ml-3">
                    <p className="text-sm font-medium text-gray-600">Total Users</p>
                    <p className="text-2xl font-bold text-gray-900">{predictiveData.totalUserCount}</p>
                  </div>
                </div>
              </div>
              <div className="bg-white p-4 rounded-lg shadow-sm border">
                <div className="flex items-center">
                  <AlertTriangle className="w-8 h-8 text-red-600" />
                  <div className="ml-3">
                    <p className="text-sm font-medium text-gray-600">High Churn Risk</p>
                    <p className="text-2xl font-bold text-gray-900">{predictiveData.highChurnRiskCount}</p>
                  </div>
                </div>
              </div>
              <div className="bg-white p-4 rounded-lg shadow-sm border">
                <div className="flex items-center">
                  <TrendingUp className="w-8 h-8 text-green-600" />
                  <div className="ml-3">
                    <p className="text-sm font-medium text-gray-600">Engagement Trends</p>
                    <p className="text-2xl font-bold text-gray-900">{engagementForecasts.length}</p>
                  </div>
                </div>
              </div>
              <div className="bg-white p-4 rounded-lg shadow-sm border">
                <div className="flex items-center">
                  <Target className="w-8 h-8 text-purple-600" />
                  <div className="ml-3">
                    <p className="text-sm font-medium text-gray-600">Avg Lifetime Value</p>
                    <p className="text-2xl font-bold text-gray-900">${predictiveData.averagePredictedLifetimeValue.toFixed(0)}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Risk Distribution */}
            <div className="bg-white shadow-sm rounded-lg border p-6">
              <h4 className="text-lg font-medium text-gray-900 mb-4">Churn Risk Distribution</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="text-center">
                  <div className="text-3xl font-bold text-red-600">
                    {churnPredictions.filter(p => p.churnRisk >= 80).length}
                  </div>
                  <div className="text-sm text-gray-500">Critical Risk (80%+)</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-orange-600">
                    {churnPredictions.filter(p => p.churnRisk >= 60 && p.churnRisk < 80).length}
                  </div>
                  <div className="text-sm text-gray-500">High Risk (60-79%)</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-yellow-600">
                    {churnPredictions.filter(p => p.churnRisk >= 40 && p.churnRisk < 60).length}
                  </div>
                  <div className="text-sm text-gray-500">Medium Risk (40-59%)</div>
                </div>
              </div>
            </div>

            {/* Engagement Trends */}
            <div className="bg-white shadow-sm rounded-lg border p-6">
              <h4 className="text-lg font-medium text-gray-900 mb-4">Engagement Trend Distribution</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="text-center">
                  <div className="text-3xl font-bold text-green-600">
                    {engagementForecasts.filter(f => f.engagementTrend === 'increasing').length}
                  </div>
                  <div className="text-sm text-gray-500">Increasing</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-blue-600">
                    {engagementForecasts.filter(f => f.engagementTrend === 'stable').length}
                  </div>
                  <div className="text-sm text-gray-500">Stable</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-red-600">
                    {engagementForecasts.filter(f => f.engagementTrend === 'decreasing').length}
                  </div>
                  <div className="text-sm text-gray-500">Decreasing</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Churn Prediction Tab */}
        {activeTab === 'churn' && (
          <div className="space-y-6">
            <div className="bg-white shadow-sm rounded-lg border">
              <div className="px-6 py-4 border-b border-gray-200">
                <h4 className="text-lg font-medium text-gray-900">Churn Risk Predictions</h4>
                <p className="text-sm text-gray-500">Users at risk of churning based on AI analysis</p>
              </div>
              <div className="divide-y divide-gray-200">
                {churnPredictions.length === 0 ? (
                  <div className="p-8 text-center">
                    <AlertTriangle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500">No high-risk users found</p>
                  </div>
                ) : (
                  churnPredictions.map((prediction, index) => (
                    <div key={`churnPredictions-${index}`} className="p-6 hover:bg-gray-50">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-10 w-10">
                            <div className="h-10 w-10 rounded-full bg-gray-300 flex items-center justify-center">
                              <span className="text-sm font-medium text-gray-700">
                                {prediction.userName.charAt(0).toUpperCase()}
                              </span>
                            </div>
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">{prediction.userName}</div>
                            <div className="text-sm text-gray-500">{prediction.userEmail}</div>
                            <div className="flex items-center mt-1">
                              <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getLifecycleColor(prediction.lifecycleStage)}`}>
                                {prediction.lifecycleStage.replace('_', ' ')}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center space-x-4">
                          <div className="text-right">
                            <p className="text-sm text-gray-500">Churn Risk</p>
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getChurnRiskColor(prediction.churnRisk)}`}>
                              {prediction.churnRisk.toFixed(1)}%
                            </span>
                          </div>
                          <div className="text-right">
                            <p className="text-sm text-gray-500">Engagement</p>
                            <span className="text-sm font-medium text-gray-900">{prediction.engagementScore.toFixed(1)}</span>
                          </div>
                          <div className="text-right">
                            <p className="text-sm text-gray-500">Confidence</p>
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getConfidenceColor(prediction.confidence)}`}>
                              {prediction.confidence}%
                            </span>
                          </div>
                          <div className="text-right">
                            <p className="text-sm text-gray-500">Predicted Date</p>
                            <p className="text-sm font-medium text-gray-900">{formatDate(prediction.predictedChurnDate || '')}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* Engagement Forecast Tab */}
        {activeTab === 'engagement' && (
          <div className="space-y-6">
            <div className="bg-white shadow-sm rounded-lg border">
              <div className="px-6 py-4 border-b border-gray-200">
                <h4 className="text-lg font-medium text-gray-900">Engagement Forecasts</h4>
                <p className="text-sm text-gray-500">Predicted engagement trends and next login times</p>
              </div>
              <div className="divide-y divide-gray-200">
                {engagementForecasts.length === 0 ? (
                  <div className="p-8 text-center">
                    <TrendingUp className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500">No engagement forecasts available</p>
                  </div>
                ) : (
                  engagementForecasts.map((forecast, index) => (
                    <div key={`engagementForecasts-${index}`} className="p-6 hover:bg-gray-50">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-10 w-10">
                            <div className="h-10 w-10 rounded-full bg-gray-300 flex items-center justify-center">
                              <span className="text-sm font-medium text-gray-700">
                                {forecast.userName.charAt(0).toUpperCase()}
                              </span>
                            </div>
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">{forecast.userName}</div>
                            <div className="flex items-center mt-1">
                              <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getEngagementTrendColor(forecast.engagementTrend)}`}>
                                {forecast.engagementTrend}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center space-x-4">
                          <div className="text-right">
                            <p className="text-sm text-gray-500">Predicted Score</p>
                            <span className="text-sm font-medium text-gray-900">{forecast.predictedEngagementScore}</span>
                          </div>
                          <div className="text-right">
                            <p className="text-sm text-gray-500">Next Login</p>
                            <p className="text-sm font-medium text-gray-900">{formatDate(forecast.nextLoginPrediction)}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm text-gray-500">Confidence</p>
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getConfidenceColor(forecast.confidence)}`}>
                              {forecast.confidence}%
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* Recommendations Tab */}
        {activeTab === 'recommendations' && (
          <div className="space-y-6">
            <div className="bg-white shadow-sm rounded-lg border">
              <div className="px-6 py-4 border-b border-gray-200">
                <h4 className="text-lg font-medium text-gray-900">AI-Powered Recommendations</h4>
                <p className="text-sm text-gray-500">Personalized actions to improve user engagement and retention</p>
              </div>
              <div className="divide-y divide-gray-200">
                {churnPredictions.length === 0 ? (
                  <div className="p-8 text-center">
                    <Target className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500">No recommendations available</p>
                  </div>
                ) : (
                  churnPredictions.map((prediction, index) => (
                    <div key={`churnPredictions-${index}`} className="p-6 hover:bg-gray-50">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start">
                          <div className="flex-shrink-0 h-10 w-10">
                            <div className="h-10 w-10 rounded-full bg-gray-300 flex items-center justify-center">
                              <span className="text-sm font-medium text-gray-700">
                                {prediction.userName.charAt(0).toUpperCase()}
                              </span>
                            </div>
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">{prediction.userName}</div>
                            <div className="text-sm text-gray-500">{prediction.userEmail}</div>
                            <div className="mt-2">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getChurnRiskColor(prediction.churnRisk)}`}>
                                {prediction.churnRisk.toFixed(1)}% churn risk
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="ml-4">
                          <h5 className="text-sm font-medium text-gray-900 mb-2">Recommended Actions</h5>
                          <div className="space-y-2">
                            {prediction.recommendedActions.map((action, actionIndex) => (
                              <div key={actionIndex} className="flex items-center text-sm text-gray-600">
                                {getRecommendationIcon(action)}
                                <span className="ml-2">{action.replace('_', ' ')}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PredictiveAnalytics;
