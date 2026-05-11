import React, { useState, useEffect } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar
} from 'recharts';
import { withErrorBoundary } from '../ErrorBoundary';
import { api } from '../../services/api';
import {
  DollarSign,
  TrendingDown,
  TrendingUp,
  Target,
  Package,
  Truck,
  Users,
  AlertTriangle,
  CheckCircle,
  Clock,
  Calculator,
  PieChart as PieChartIcon,
  BarChart3,
  RefreshCw,
  Download,
  Filter,
  Search,
  Award,
  ShoppingCart,
  Zap
} from 'lucide-react';

interface CostSummary {
  totalSpent: number;
  averageTransactionValue: number;
  transactionCount: number;
  currentInventoryValue: number;
  averageCostPerItem: number;
  period: number;
}

interface CategoryBreakdown {
  category: string;
  totalCost: number;
  totalQuantity: number;
  transactionCount: number;
  averageUnitCost: number;
}

interface OptimizationOpportunity {
  type: string;
  itemId: string;
  itemName: string;
  category: string;
  issue: string;
  potentialSavings: number;
  recommendation: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
}

interface CostTrends {
  trend: 'increasing' | 'decreasing';
  changePercent: number;
  firstHalfTotal: number;
  secondHalfTotal: number;
  period: number;
}

interface SupplierMetrics {
  name: string;
  totalSpend: number;
  totalOrders: number;
  averageOrderValue: number;
  itemCount: number;
  qualityScore: number;
  onTimeDeliveryRate: number;
  defectRate: number;
  priceStability: number;
  responseTime: number;
  communicationScore: number;
}

interface SupplierComparison {
  supplierValue: number;
  benchmarkValue: number;
  performance: 'above_average' | 'average' | 'below_average';
  variance: number;
}

interface SupplierAnalysis {
  supplier: string;
  performance: SupplierMetrics;
  benchmarking: Record<string, SupplierComparison>;
  recommendations: Array<{
    type: string;
    priority: string;
    description: string;
    action: string;
  }>;
  riskAssessment: {
    score: number;
    level: 'low' | 'medium' | 'high';
    factors: string[];
  };
}

interface CostOptimizationData {
  summary: CostSummary;
  categories: CategoryBreakdown[];
  opportunities: OptimizationOpportunity[];
  trends: CostTrends;
  recommendations: Array<{
    type: string;
    priority: string;
    description: string;
    action: string;
    estimatedSavings?: number;
  }>;
}

const COLORS = {
  primary: '#3B82F6',
  secondary: '#8B5CF6',
  success: '#10B981',
  warning: '#F59E0B',
  danger: '#EF4444',
  gray: '#6B7280'
};

const CHART_COLORS = [
  '#3B82F6', '#8B5CF6', '#10B981', '#F59E0B',
  '#EF4444', '#06B6D4', '#84CC16', '#F97316'
];

const CostOptimizationDashboard: React.FC = () => {
  const [dashboardData, setDashboardData] = useState<CostOptimizationData | null>(null);
  const [supplierAnalysis, setSupplierAnalysis] = useState<SupplierAnalysis[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState('90');
  const [activeTab, setActiveTab] = useState<'overview' | 'suppliers' | 'opportunities' | 'analysis'>('overview');
  const [selectedOpportunityType, setSelectedOpportunityType] = useState<string>('all');

  useEffect(() => {
    fetchCostOptimizationData();
    fetchSupplierAnalysis();
  }, [selectedPeriod]);

  const fetchCostOptimizationData = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        period: selectedPeriod,
        includeForecasting: 'true',
        includeBenchmarking: 'false'
      });

      const { data } = await api.get(`/inventory/analytics/cost-optimization?${params}`);
      setDashboardData(data.data);
    } catch {
      // Error handled silently
    } finally {
      setLoading(false);
    }
  };

  const fetchSupplierAnalysis = async () => {
    try {
      const params = new URLSearchParams({
        timeframe: selectedPeriod,
        includeQualityMetrics: 'true',
        includeReliabilityScore: 'true'
      });

      const { data } = await api.get(`/inventory/analytics/supplier-performance?${params}`);
      setSupplierAnalysis(data.data.suppliers || []);
    } catch {
      // Error handled silently
    }
  };

  const formatCurrency = (amount: number) => {
    if (!isFinite(amount)) return '\u20B90.00';
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR'
    }).format(amount);
  };

  const formatPercentage = (value: number) => {
    if (!isFinite(value)) return '0.0%';
    return `${value.toFixed(1)}%`;
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical':
        return 'text-red-600 bg-red-100';
      case 'high':
        return 'text-orange-600 bg-orange-100';
      case 'medium':
        return 'text-yellow-600 bg-yellow-100';
      default:
        return 'text-blue-600 bg-blue-100';
    }
  };

  const getPerformanceColor = (performance: string) => {
    switch (performance) {
      case 'above_average':
        return 'text-green-600';
      case 'below_average':
        return 'text-red-600';
      default:
        return 'text-gray-600';
    }
  };

  const exportData = () => {
    const dataToExport = {
      dashboardData,
      supplierAnalysis,
      exportDate: new Date().toISOString()
    };

    const blob = new Blob([JSON.stringify(dataToExport, null, 2)], {
      type: 'application/json'
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cost-optimization-analysis-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (loading || !dashboardData) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
          <span className="ml-2 text-gray-600">Loading cost optimization data...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Cost Optimization Dashboard</h2>
            <p className="text-gray-600 mt-1">
              Analyze spending patterns, optimize procurement, and identify cost savings opportunities
            </p>
          </div>
          <div className="flex space-x-3">
            <button
              onClick={fetchCostOptimizationData}
              className="flex items-center px-4 py-2 text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </button>
            <button
              onClick={exportData}
              className="flex items-center px-4 py-2 text-gray-600 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <Download className="w-4 h-4 mr-2" />
              Export
            </button>
          </div>
        </div>

        {/* Period Selector */}
        <div className="flex items-center space-x-4 mb-6">
          <label className="text-sm font-medium text-gray-700">Analysis Period:</label>
          <select
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="30">Last 30 days</option>
            <option value="60">Last 60 days</option>
            <option value="90">Last 90 days</option>
            <option value="180">Last 6 months</option>
            <option value="365">Last year</option>
          </select>
        </div>

        {/* Tab Navigation */}
        <div className="flex space-x-1 bg-gray-100 rounded-lg p-1">
          {['overview', 'suppliers', 'opportunities', 'analysis'].map((tab) => (
            <button aria-label="Close"
              key={tab}
              onClick={() => setActiveTab(tab as typeof activeTab)}
              className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                activeTab === tab
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Spent</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {formatCurrency(dashboardData.summary.totalSpent)}
                  </p>
                  <p className="text-sm text-gray-500 mt-1">
                    {dashboardData.summary.transactionCount} transactions
                  </p>
                </div>
                <DollarSign className="w-8 h-8 text-blue-500" />
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Inventory Value</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {formatCurrency(dashboardData.summary.currentInventoryValue)}
                  </p>
                  <p className="text-sm text-gray-500 mt-1">
                    Avg: {formatCurrency(dashboardData.summary.averageCostPerItem)}/item
                  </p>
                </div>
                <Package className="w-8 h-8 text-green-500" />
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Cost Trend</p>
                  <p className={`text-2xl font-bold ${
                    dashboardData.trends.trend === 'increasing' ? 'text-red-600' : 'text-green-600'
                  }`}>
                    {formatPercentage(Math.abs(dashboardData.trends.changePercent))}
                  </p>
                  <p className="text-sm text-gray-500 mt-1 capitalize">
                    {dashboardData.trends.trend}
                  </p>
                </div>
                {dashboardData.trends.trend === 'increasing' ? (
                  <TrendingUp className="w-8 h-8 text-red-500" />
                ) : (
                  <TrendingDown className="w-8 h-8 text-green-500" />
                )}
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Potential Savings</p>
                  <p className="text-2xl font-bold text-green-600">
                    {formatCurrency(
                      dashboardData.opportunities.reduce((sum, opp) => sum + opp.potentialSavings, 0)
                    )}
                  </p>
                  <p className="text-sm text-gray-500 mt-1">
                    {dashboardData.opportunities.length} opportunities
                  </p>
                </div>
                <Target className="w-8 h-8 text-green-500" />
              </div>
            </div>
          </div>

          {/* Category Breakdown Chart */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Spending by Category</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dashboardData.categories}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="category" />
                  <YAxis />
                  <Tooltip formatter={(value) => formatCurrency(value as number)} />
                  <Legend />
                  <Bar dataKey="totalCost" fill={COLORS.primary} name="Total Cost" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Cost Trends Chart */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Cost Trends Analysis</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="text-md font-medium text-gray-700 mb-2">Period Comparison</h4>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">First Half</span>
                    <span className="font-medium">
                      {formatCurrency(dashboardData.trends.firstHalfTotal)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Second Half</span>
                    <span className="font-medium">
                      {formatCurrency(dashboardData.trends.secondHalfTotal)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center border-t pt-2">
                    <span className="text-sm text-gray-600">Change</span>
                    <span className={`font-medium ${
                      dashboardData.trends.changePercent > 0 ? 'text-red-600' : 'text-green-600'
                    }`}>
                      {dashboardData.trends.changePercent > 0 ? '+' : ''}
                      {formatPercentage(dashboardData.trends.changePercent)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={dashboardData.categories.slice(0, 5)}
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="totalCost"
                      label={({ category, percent }) => `${category} ${(percent * 100).toFixed(0)}%`}
                    >
                      {dashboardData.categories.slice(0, 5).map((_, index) => (
                        <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => formatCurrency(value as number)} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Suppliers Tab */}
      {activeTab === 'suppliers' && (
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Supplier Performance Analysis</h3>

            {supplierAnalysis.length === 0 ? (
              <div className="text-center py-8">
                <Users className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-600">No supplier data available</p>
              </div>
            ) : (
              <div className="space-y-6">
                {supplierAnalysis.map((supplier, index) => (
                  <div key={supplier.supplier} className="border border-gray-200 rounded-lg p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h4 className="text-lg font-medium text-gray-900">{supplier.supplier}</h4>
                        <div className="flex items-center space-x-4 mt-1 text-sm text-gray-600">
                          <span>Total Spend: {formatCurrency(supplier.performance.totalSpend)}</span>
                          <span>Orders: {supplier.performance.totalOrders}</span>
                          <span>Items: {supplier.performance.itemCount}</span>
                        </div>
                      </div>
                      <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                        supplier.riskAssessment.level === 'high' ? 'text-red-600 bg-red-100' :
                        supplier.riskAssessment.level === 'medium' ? 'text-yellow-600 bg-yellow-100' :
                        'text-green-600 bg-green-100'
                      }`}>
                        {supplier.riskAssessment.level.toUpperCase()} RISK
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-4">
                      {/* Performance Metrics */}
                      <div>
                        <h5 className="text-sm font-medium text-gray-700 mb-3">Performance Metrics</h5>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-gray-600">Quality Score</span>
                            <span className={getPerformanceColor(supplier.benchmarking.qualityScore?.performance)}>
                              {formatPercentage(supplier.performance.qualityScore)}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">On-Time Delivery</span>
                            <span className={getPerformanceColor(supplier.benchmarking.onTimeDeliveryRate?.performance)}>
                              {formatPercentage(supplier.performance.onTimeDeliveryRate)}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Price Stability</span>
                            <span className={getPerformanceColor(supplier.benchmarking.priceStability?.performance)}>
                              {formatPercentage(supplier.performance.priceStability)}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Risk Factors */}
                      <div>
                        <h5 className="text-sm font-medium text-gray-700 mb-3">Risk Factors</h5>
                        <div className="space-y-1">
                          {supplier.riskAssessment.factors.length === 0 ? (
                            <span className="text-sm text-green-600">No risk factors identified</span>
                          ) : (
                            supplier.riskAssessment.factors.map((factor, idx) => (
                              <div key={idx} className="flex items-center text-sm text-red-600">
                                <AlertTriangle className="w-3 h-3 mr-1" />
                                {factor}
                              </div>
                            ))
                          )}
                        </div>
                      </div>

                      {/* Recommendations */}
                      <div>
                        <h5 className="text-sm font-medium text-gray-700 mb-3">Recommendations</h5>
                        <div className="space-y-1">
                          {supplier.recommendations.slice(0, 3).map((rec, idx) => (
                            <div key={idx} className="text-sm">
                              <span className={`inline-block px-2 py-1 rounded text-xs font-medium mr-2 ${
                                getPriorityColor(rec.priority)
                              }`}>
                                {rec.type.replace('_', ' ').toUpperCase()}
                              </span>
                              <span className="text-gray-600">{rec.description}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Performance Radar Chart */}
                    <div className="h-48">
                      <ResponsiveContainer width="100%" height="100%">
                        <RadarChart data={[
                          { metric: 'Quality', value: supplier.performance.qualityScore },
                          { metric: 'Delivery', value: supplier.performance.onTimeDeliveryRate },
                          { metric: 'Price Stability', value: supplier.performance.priceStability },
                          { metric: 'Communication', value: supplier.performance.communicationScore },
                          { metric: 'Response Time', value: Math.max(0, 100 - (supplier.performance.responseTime * 20)) }
                        ]}>
                          <PolarGrid />
                          <PolarAngleAxis dataKey="metric" />
                          <PolarRadiusAxis angle={90} domain={[0, 100]} />
                          <Radar
                            name={supplier.supplier}
                            dataKey="value"
                            stroke={CHART_COLORS[index % CHART_COLORS.length]}
                            fill={CHART_COLORS[index % CHART_COLORS.length]}
                            fillOpacity={0.3}
                          />
                        </RadarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Opportunities Tab */}
      {activeTab === 'opportunities' && (
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Cost Optimization Opportunities</h3>
              <select
                value={selectedOpportunityType}
                onChange={(e) => setSelectedOpportunityType(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">All Types</option>
                <option value="inventory_optimization">Inventory Optimization</option>
                <option value="bulk_purchase">Bulk Purchase</option>
                <option value="supplier_change">Supplier Change</option>
              </select>
            </div>

            <div className="space-y-4">
              {dashboardData.opportunities
                .filter(opp => selectedOpportunityType === 'all' || opp.type === selectedOpportunityType)
                .map((opportunity, index) => (
                  <div
                    key={`${opportunity.itemId}-${index}`}
                    className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <h4 className="font-medium text-gray-900">{opportunity.itemName}</h4>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getPriorityColor(opportunity.priority)}`}>
                            {opportunity.priority.toUpperCase()}
                          </span>
                          <span className="px-2 py-1 rounded-full text-xs font-medium text-blue-600 bg-blue-100">
                            {opportunity.type.replace('_', ' ').toUpperCase()}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 mb-2">{opportunity.issue}</p>
                        <p className="text-sm text-gray-800">{opportunity.recommendation}</p>
                        <div className="flex items-center space-x-4 mt-2 text-sm">
                          <span className="text-gray-600">Category: {opportunity.category}</span>
                          <span className="text-green-600 font-medium">
                            Potential Savings: {formatCurrency(opportunity.potentialSavings)}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Target className={`w-6 h-6 ${
                          opportunity.priority === 'critical' ? 'text-red-500' :
                          opportunity.priority === 'high' ? 'text-orange-500' :
                          opportunity.priority === 'medium' ? 'text-yellow-500' : 'text-blue-500'
                        }`} />
                      </div>
                    </div>
                  </div>
                ))}

              {dashboardData.opportunities.filter(opp =>
                selectedOpportunityType === 'all' || opp.type === selectedOpportunityType
              ).length === 0 && (
                <div className="text-center py-8">
                  <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-3" />
                  <p className="text-gray-600">No optimization opportunities found</p>
                  <p className="text-sm text-gray-500 mt-1">
                    Your inventory costs are already well optimized
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Analysis Tab */}
      {activeTab === 'analysis' && (
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Recommendations</h3>

            <div className="space-y-4">
              {dashboardData.recommendations.map((recommendation, index) => (
                <div
                  key={`dashboardData-recommendations-${index}-${recommendation.type}`}
                  className="border border-gray-200 rounded-lg p-4"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getPriorityColor(recommendation.priority)}`}>
                          {recommendation.priority.toUpperCase()}
                        </span>
                        <span className="px-2 py-1 rounded-full text-xs font-medium text-gray-600 bg-gray-100">
                          {recommendation.type.replace('_', ' ').toUpperCase()}
                        </span>
                      </div>
                      <h4 className="font-medium text-gray-900 mb-1">{recommendation.description}</h4>
                      <p className="text-sm text-gray-600">{recommendation.action}</p>
                      {recommendation.estimatedSavings && (
                        <p className="text-sm text-green-600 font-medium mt-2">
                          Estimated Savings: {formatCurrency(recommendation.estimatedSavings)}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center">
                      {recommendation.priority === 'critical' ? (
                        <AlertTriangle className="w-6 h-6 text-red-500" />
                      ) : recommendation.priority === 'high' ? (
                        <Zap className="w-6 h-6 text-orange-500" />
                      ) : (
                        <Award className="w-6 h-6 text-blue-500" />
                      )}
                    </div>
                  </div>
                </div>
              ))}

              {dashboardData.recommendations.length === 0 && (
                <div className="text-center py-8">
                  <Award className="w-12 h-12 text-blue-400 mx-auto mb-3" />
                  <p className="text-gray-600">No specific recommendations at this time</p>
                  <p className="text-sm text-gray-500 mt-1">
                    Continue monitoring your inventory costs for optimization opportunities
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Additional Analysis Charts */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h4 className="text-md font-medium text-gray-900 mb-4">Category Performance</h4>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={dashboardData.categories}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="category" />
                    <YAxis />
                    <Tooltip formatter={(value) => formatCurrency(value as number)} />
                    <Area
                      type="monotone"
                      dataKey="totalCost"
                      stroke={COLORS.primary}
                      fill={COLORS.primary}
                      fillOpacity={0.3}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm p-6">
              <h4 className="text-md font-medium text-gray-900 mb-4">Average Unit Costs</h4>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dashboardData.categories}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="category" />
                    <YAxis />
                    <Tooltip formatter={(value) => formatCurrency(value as number)} />
                    <Bar dataKey="averageUnitCost" fill={COLORS.secondary} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default withErrorBoundary(CostOptimizationDashboard, { level: 'component' });