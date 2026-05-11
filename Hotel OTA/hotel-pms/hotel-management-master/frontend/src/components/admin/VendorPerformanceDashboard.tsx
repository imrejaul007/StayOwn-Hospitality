import React, { useState, useEffect } from 'react';
import { BarChart3, TrendingUp, TrendingDown, Star, Clock, Package, DollarSign, AlertTriangle, CheckCircle, Target, Award } from 'lucide-react';
import { api } from '../../services/api';

interface VendorPerformance {
  _id: string;
  vendorId: {
    _id: string;
    name: string;
    categories: string[];
  };
  deliveryMetrics: {
    onTimeDeliveryPercentage: number;
    averageDeliveryTime: number;
    totalOrders: number;
    onTimeDeliveries: number;
  };
  qualityMetrics: {
    qualityScore: number;
    defectRate: number;
    returnRate: number;
  };
  costMetrics: {
    totalOrderValue: number;
    averageOrderValue: number;
    competitivenessScore: number;
  };
  serviceMetrics: {
    communicationScore: number;
    responseTime: {
      averageHours: number;
    };
  };
  overallScore: number;
  trendAnalysis: {
    overallTrend: 'improving' | 'stable' | 'declining';
    deliveryTrend: 'improving' | 'stable' | 'declining';
    qualityTrend: 'improving' | 'stable' | 'declining';
  };
}

interface CategoryStats {
  _id: string;
  vendorCount: number;
  avgPerformance: number;
  avgDeliveryPerformance: number;
  totalOrderValue: number;
}

interface OverallStats {
  avgOverallScore: number;
  avgDeliveryPerformance: number;
  avgQualityScore: number;
  avgServiceScore: number;
  totalVendors: number;
  excellentPerformers: number;
  goodPerformers: number;
  poorPerformers: number;
}

const VendorPerformanceDashboard: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [period, setPeriod] = useState('monthly');
  const [selectedCategory, setSelectedCategory] = useState('');

  const [topPerformers, setTopPerformers] = useState<VendorPerformance[]>([]);
  const [poorPerformers, setPoorPerformers] = useState<VendorPerformance[]>([]);
  const [categoryStats, setCategoryStats] = useState<CategoryStats[]>([]);
  const [overallStats, setOverallStats] = useState<OverallStats>({
    avgOverallScore: 0,
    avgDeliveryPerformance: 0,
    avgQualityScore: 0,
    avgServiceScore: 0,
    totalVendors: 0,
    excellentPerformers: 0,
    goodPerformers: 0,
    poorPerformers: 0
  });

  const categories = [
    'linens', 'toiletries', 'cleaning_supplies', 'maintenance_supplies',
    'food_beverage', 'electronics', 'furniture', 'hvac', 'plumbing',
    'electrical', 'safety_equipment', 'office_supplies', 'laundry_supplies',
    'guest_amenities', 'kitchen_equipment', 'other'
  ];

  useEffect(() => {
    fetchPerformanceData();
  }, [period, selectedCategory]);

  const fetchPerformanceData = async () => {
    try {
      setLoading(true);
      const queryParams = new URLSearchParams({
        period,
        ...(selectedCategory && { category: selectedCategory })
      });

      const { data } = await api.get(`/vendors/enhanced/analytics?${queryParams}`);
      if (data.success) {
        setTopPerformers(data.data.topPerformers || []);
        setPoorPerformers(data.data.poorPerformers || []);
        setCategoryStats(data.data.categoryStats || []);
        setOverallStats(data.data.performanceStats?.[0] || overallStats);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch performance data');
    } finally {
      setLoading(false);
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'improving':
        return <TrendingUp className="w-4 h-4 text-green-500" />;
      case 'declining':
        return <TrendingDown className="w-4 h-4 text-red-500" />;
      default:
        return <div className="w-4 h-4 bg-yellow-500 rounded-full" />;
    }
  };

  const getPerformanceColor = (score: number) => {
    if (score >= 4.5) return 'text-green-600';
    if (score >= 3.5) return 'text-yellow-600';
    return 'text-red-600';
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0
    }).format(amount);
  };

  const getRatingStars = (rating: number) => {
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;

    return (
      <div className="flex items-center">
        {[...Array(5)].map((_, i) => (
          <Star
            key={i}
            className={`w-4 h-4 ${
              i < fullStars
                ? 'text-yellow-400 fill-current'
                : i === fullStars && hasHalfStar
                ? 'text-yellow-400'
                : 'text-gray-300'
            }`}
          />
        ))}
        <span className="ml-1 text-sm text-gray-600">({rating.toFixed(1)})</span>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Vendor Performance Dashboard</h2>
          <p className="mt-1 text-sm text-gray-500">
            Monitor and analyze vendor performance metrics
          </p>
        </div>
        <div className="flex space-x-3">
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-2 text-sm"
          >
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
            <option value="quarterly">Quarterly</option>
            <option value="yearly">Yearly</option>
          </select>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-2 text-sm"
          >
            <option value="">All Categories</option>
            {categories.map(category => (
              <option key={category} value={category}>
                {category.replace('_', ' ').toUpperCase()}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="flex">
            <AlertTriangle className="h-5 w-5 text-red-400" />
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Error</h3>
              <div className="mt-2 text-sm text-red-700">{error}</div>
            </div>
          </div>
        </div>
      )}

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <BarChart3 className="h-6 w-6 text-blue-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Overall Performance</dt>
                  <dd className={`text-lg font-medium ${getPerformanceColor(overallStats.avgOverallScore)}`}>
                    {overallStats.avgOverallScore.toFixed(1)}/5.0
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <Clock className="h-6 w-6 text-green-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Delivery Performance</dt>
                  <dd className="text-lg font-medium text-gray-900">
                    {overallStats.avgDeliveryPerformance.toFixed(1)}%
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <Package className="h-6 w-6 text-purple-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Quality Score</dt>
                  <dd className="text-lg font-medium text-gray-900">
                    {overallStats.avgQualityScore.toFixed(1)}/5.0
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <Target className="h-6 w-6 text-orange-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Excellent Performers</dt>
                  <dd className="text-lg font-medium text-gray-900">
                    {overallStats.excellentPerformers}/{overallStats.totalVendors}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Performance Distribution */}
      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Performance Distribution</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center">
            <div className="flex items-center justify-center w-16 h-16 mx-auto bg-green-100 rounded-full">
              <Award className="w-8 h-8 text-green-600" />
            </div>
            <div className="mt-3">
              <div className="text-2xl font-bold text-green-600">{overallStats.excellentPerformers}</div>
              <div className="text-sm text-gray-500">Excellent (4.5+)</div>
            </div>
          </div>

          <div className="text-center">
            <div className="flex items-center justify-center w-16 h-16 mx-auto bg-yellow-100 rounded-full">
              <CheckCircle className="w-8 h-8 text-yellow-600" />
            </div>
            <div className="mt-3">
              <div className="text-2xl font-bold text-yellow-600">{overallStats.goodPerformers}</div>
              <div className="text-sm text-gray-500">Good (3.5-4.4)</div>
            </div>
          </div>

          <div className="text-center">
            <div className="flex items-center justify-center w-16 h-16 mx-auto bg-red-100 rounded-full">
              <AlertTriangle className="w-8 h-8 text-red-600" />
            </div>
            <div className="mt-3">
              <div className="text-2xl font-bold text-red-600">{overallStats.poorPerformers}</div>
              <div className="text-sm text-gray-500">Needs Improvement (&lt;2.5)</div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Performers */}
        <div className="bg-white shadow rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">Top Performers</h3>
          </div>
          <div className="p-6">
            <div className="space-y-4">
              {topPerformers.slice(0, 5).map((vendor, index) => (
                <div key={vendor._id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className="flex-shrink-0">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold ${
                        index === 0 ? 'bg-yellow-500' : index === 1 ? 'bg-gray-400' : index === 2 ? 'bg-yellow-600' : 'bg-blue-500'
                      }`}>
                        {index + 1}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm font-medium text-gray-900">{vendor.vendorId.name}</div>
                      <div className="text-xs text-gray-500">
                        {vendor.vendorId.categories.slice(0, 2).join(', ')}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    {getRatingStars(vendor.overallScore)}
                    <div className="flex items-center mt-1">
                      {getTrendIcon(vendor.trendAnalysis.overallTrend)}
                      <span className="ml-1 text-xs text-gray-500">
                        {vendor.deliveryMetrics.onTimeDeliveryPercentage.toFixed(0)}% on-time
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Category Performance */}
        <div className="bg-white shadow rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">Category Performance</h3>
          </div>
          <div className="p-6">
            <div className="space-y-4">
              {categoryStats.slice(0, 5).map((category) => (
                <div key={category._id} className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium text-gray-900">
                      {category._id.replace('_', ' ').toUpperCase()}
                    </div>
                    <div className="text-xs text-gray-500">
                      {category.vendorCount} vendors • {formatCurrency(category.totalOrderValue)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`text-sm font-medium ${getPerformanceColor(category.avgPerformance)}`}>
                      {category.avgPerformance.toFixed(1)}/5.0
                    </div>
                    <div className="text-xs text-gray-500">
                      {category.avgDeliveryPerformance.toFixed(0)}% delivery
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Poor Performers Alert */}
      {poorPerformers.length > 0 && (
        <div className="bg-white shadow rounded-lg">
          <div className="px-6 py-4 border-b border-red-200 bg-red-50">
            <div className="flex items-center">
              <AlertTriangle className="h-5 w-5 text-red-500 mr-2" />
              <h3 className="text-lg font-medium text-red-900">Vendors Requiring Attention</h3>
            </div>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {poorPerformers.map((vendor) => (
                <div key={vendor._id} className="border border-red-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-sm font-medium text-gray-900">{vendor.vendorId.name}</div>
                    <div className={`text-sm font-medium ${getPerformanceColor(vendor.overallScore)}`}>
                      {vendor.overallScore.toFixed(1)}/5.0
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-500">Delivery Performance:</span>
                      <span className="text-red-600">
                        {vendor.deliveryMetrics.onTimeDeliveryPercentage.toFixed(0)}%
                      </span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-500">Quality Score:</span>
                      <span className="text-red-600">
                        {vendor.qualityMetrics.qualityScore.toFixed(1)}/5.0
                      </span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-500">Defect Rate:</span>
                      <span className="text-red-600">
                        {vendor.qualityMetrics.defectRate.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <div className="flex items-center">
                      {getTrendIcon(vendor.trendAnalysis.overallTrend)}
                      <span className="ml-1 text-xs text-gray-500">
                        {vendor.trendAnalysis.overallTrend}
                      </span>
                    </div>
                    <button className="text-xs text-blue-600 hover:text-blue-800">
                      View Details
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Key Metrics Summary */}
      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Key Performance Indicators</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center p-4 border border-gray-200 rounded-lg">
            <div className="text-2xl font-bold text-blue-600">
              {overallStats.avgDeliveryPerformance.toFixed(1)}%
            </div>
            <div className="text-sm text-gray-500 mt-1">Average On-Time Delivery</div>
            <div className="text-xs text-gray-400 mt-1">Target: 95%</div>
          </div>

          <div className="text-center p-4 border border-gray-200 rounded-lg">
            <div className="text-2xl font-bold text-green-600">
              {overallStats.avgQualityScore.toFixed(1)}/5.0
            </div>
            <div className="text-sm text-gray-500 mt-1">Average Quality Score</div>
            <div className="text-xs text-gray-400 mt-1">Target: 4.5+</div>
          </div>

          <div className="text-center p-4 border border-gray-200 rounded-lg">
            <div className="text-2xl font-bold text-purple-600">
              {overallStats.avgServiceScore.toFixed(1)}/5.0
            </div>
            <div className="text-sm text-gray-500 mt-1">Average Service Score</div>
            <div className="text-xs text-gray-400 mt-1">Target: 4.0+</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VendorPerformanceDashboard;