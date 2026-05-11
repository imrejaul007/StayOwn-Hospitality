import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import {
  TrendingUp,
  TrendingDown,
  Target,
  Award,
  BarChart3,
  AlertCircle,
  CheckCircle,
  XCircle,
  Building2,
} from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';

interface PerformanceBenchmarkingProps {
  properties?: Property[];
  selectedProperty?: Property | null;
}

interface Property {
  id: string;
  name: string;
  brand: string;
  type: 'hotel' | 'resort' | 'aparthotel' | 'hostel' | 'boutique';
  location: {
    address: string;
    city: string;
    country: string;
    coordinates: { lat: number; lng: number };
  };
  contact: {
    phone: string;
    email: string;
    manager: string;
  };
  rooms: {
    total: number;
    occupied: number;
    available: number;
    outOfOrder: number;
  };
  performance: {
    occupancyRate: number;
    adr: number;
    revpar: number;
    revenue: number;
    lastMonth: {
      occupancyRate: number;
      adr: number;
      revpar: number;
      revenue: number;
    };
  };
  amenities: string[];
  rating: number;
  status: 'active' | 'inactive' | 'maintenance';
  features: {
    pms: boolean;
    pos: boolean;
    spa: boolean;
    restaurant: boolean;
    parking: boolean;
    wifi: boolean;
    fitness: boolean;
    pool: boolean;
  };
  operationalHours: {
    checkIn: string;
    checkOut: string;
    frontDesk: string;
  };
}

interface BenchmarkData {
  metric: string;
  current: number;
  target: number;
  industry: number;
  trend: 'up' | 'down' | 'stable';
  status: 'excellent' | 'good' | 'average' | 'poor';
  unit: string;
  description: string;
}

export const PerformanceBenchmarking: React.FC<PerformanceBenchmarkingProps> = ({
  properties = [],
  selectedProperty
}) => {
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d'>('30d');
  const [category, setCategory] = useState<'all' | 'occupancy' | 'revenue' | 'guest' | 'operational'>('all');
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>(
    selectedProperty?.id || (properties.length > 0 ? properties[0].id : '')
  );

  // Sync selectedPropertyId when selectedProperty prop changes
  useEffect(() => {
    if (selectedProperty?.id) {
      setSelectedPropertyId(selectedProperty.id);
    } else if (properties.length > 0 && !properties.some(p => p.id === selectedPropertyId)) {
      setSelectedPropertyId(properties[0].id);
    }
  }, [selectedProperty?.id, properties]);

  // Calculate industry benchmarks from all properties
  const calculateIndustryBenchmarks = () => {
    if (properties.length === 0) {
      return {
        avgOccupancy: 72.3,
        avgADR: 2750,
        avgRevPAR: 1987,
        avgRating: 4.1,
        avgCheckInTime: 12.0,
        avgHousekeepingEff: 78.5,
        avgMaintenanceTime: 60,
        avgStaffProductivity: 88.3
      };
    }

    const activeProperties = properties.filter(p => p.status === 'active');
    const total = activeProperties.length || 1; // Avoid division by zero

    return {
      avgOccupancy: activeProperties.reduce((sum, p) => sum + (p.performance?.occupancyRate || 0), 0) / total,
      avgADR: activeProperties.reduce((sum, p) => sum + (p.performance?.adr || 0), 0) / total,
      avgRevPAR: activeProperties.reduce((sum, p) => sum + (p.performance?.revpar || 0), 0) / total,
      avgRating: activeProperties.reduce((sum, p) => sum + (p.rating || 0), 0) / total,
      avgCheckInTime: 12.0, // Mock - would come from operational data
      avgHousekeepingEff: 78.5, // Mock - would come from housekeeping metrics
      avgMaintenanceTime: 60, // Mock - would come from maintenance data
      avgStaffProductivity: 88.3 // Mock - would come from staff metrics
    };
  };

  const industryBenchmarks = useMemo(() => calculateIndustryBenchmarks(), [properties]);

  // Get current property data
  const currentProperty = selectedProperty ||
                         properties.find(p => p.id === selectedPropertyId) ||
                         (properties.length > 0 ? properties[0] : null);

  // Generate benchmark data from real property data
  const generateBenchmarkData = (): BenchmarkData[] => {
    if (!currentProperty) {
      return []; // Return empty array if no property selected
    }

    return [
      {
        metric: 'Occupancy Rate',
        current: currentProperty.performance.occupancyRate,
        target: Math.max(85.0, currentProperty.performance.occupancyRate * 1.1), // Target 10% improvement or 85%
        industry: industryBenchmarks.avgOccupancy,
        trend: currentProperty.performance.occupancyRate > currentProperty.performance.lastMonth.occupancyRate ? 'up' :
               currentProperty.performance.occupancyRate < currentProperty.performance.lastMonth.occupancyRate ? 'down' : 'stable',
        status: currentProperty.performance.occupancyRate >= 85 ? 'excellent' :
                currentProperty.performance.occupancyRate >= 75 ? 'good' :
                currentProperty.performance.occupancyRate >= 60 ? 'average' : 'poor',
        unit: '%',
        description: 'Percentage of rooms occupied'
      },
      {
        metric: 'Average Daily Rate (ADR)',
        current: currentProperty.performance.adr,
        target: Math.max(3200, currentProperty.performance.adr * 1.15), // Target 15% improvement or ₹3200
        industry: industryBenchmarks.avgADR,
        trend: currentProperty.performance.adr > currentProperty.performance.lastMonth.adr ? 'up' :
               currentProperty.performance.adr < currentProperty.performance.lastMonth.adr ? 'down' : 'stable',
        status: currentProperty.performance.adr <= 0 ? 'poor' :
                industryBenchmarks.avgADR <= 0 ? 'average' :
                currentProperty.performance.adr >= industryBenchmarks.avgADR * 1.2 ? 'excellent' :
                currentProperty.performance.adr >= industryBenchmarks.avgADR ? 'good' :
                currentProperty.performance.adr >= industryBenchmarks.avgADR * 0.8 ? 'average' : 'poor',
        unit: '₹',
        description: 'Average room rate per day'
      },
      {
        metric: 'Revenue Per Available Room (RevPAR)',
        current: currentProperty.performance.revpar,
        target: Math.max(2720, currentProperty.performance.revpar * 1.2), // Target 20% improvement or ₹2720
        industry: industryBenchmarks.avgRevPAR,
        trend: currentProperty.performance.revpar > currentProperty.performance.lastMonth.revpar ? 'up' :
               currentProperty.performance.revpar < currentProperty.performance.lastMonth.revpar ? 'down' : 'stable',
        status: currentProperty.performance.revpar <= 0 ? 'poor' :
                industryBenchmarks.avgRevPAR <= 0 ? 'average' :
                currentProperty.performance.revpar >= industryBenchmarks.avgRevPAR * 1.2 ? 'excellent' :
                currentProperty.performance.revpar >= industryBenchmarks.avgRevPAR ? 'good' :
                currentProperty.performance.revpar >= industryBenchmarks.avgRevPAR * 0.8 ? 'average' : 'poor',
        unit: '₹',
        description: 'Revenue per available room'
      },
      {
        metric: 'Guest Satisfaction Score',
        current: currentProperty.rating,
        target: Math.max(4.5, currentProperty.rating + 0.3), // Target +0.3 improvement or 4.5
        industry: industryBenchmarks.avgRating,
        trend: 'stable', // Would need historical rating data
        status: currentProperty.rating >= 4.5 ? 'excellent' :
                currentProperty.rating >= 4.0 ? 'good' :
                currentProperty.rating >= 3.5 ? 'average' : 'poor',
        unit: '/5',
        description: 'Average guest rating'
      },
      {
        metric: 'Room Utilization',
        current: currentProperty.rooms.total > 0
          ? ((currentProperty.rooms.total - currentProperty.rooms.outOfOrder) / currentProperty.rooms.total) * 100
          : 0,
        target: 98.0, // Target 98% rooms operational
        industry: 95.0, // Industry average
        trend: 'stable',
        status: currentProperty.rooms.total === 0 ? 'poor' :
                currentProperty.rooms.outOfOrder <= currentProperty.rooms.total * 0.02 ? 'excellent' :
                currentProperty.rooms.outOfOrder <= currentProperty.rooms.total * 0.05 ? 'good' :
                currentProperty.rooms.outOfOrder <= currentProperty.rooms.total * 0.1 ? 'average' : 'poor',
        unit: '%',
        description: 'Percentage of rooms operational'
      },
      {
        metric: 'Property Performance Score',
        current: Math.round(
          (currentProperty.performance.occupancyRate * 0.3 +
           (industryBenchmarks.avgADR > 0 ? (currentProperty.performance.adr / industryBenchmarks.avgADR) * 100 : 0) * 0.25 +
           (industryBenchmarks.avgRevPAR > 0 ? (currentProperty.performance.revpar / industryBenchmarks.avgRevPAR) * 100 : 0) * 0.25 +
           currentProperty.rating * 20 * 0.2) / 100 * 100
        ) || 0,
        target: 90.0,
        industry: 75.0,
        trend: 'up',
        status: (() => {
          const score = Math.round(
            (currentProperty.performance.occupancyRate * 0.3 +
             (industryBenchmarks.avgADR > 0 ? (currentProperty.performance.adr / industryBenchmarks.avgADR) * 100 : 0) * 0.25 +
             (industryBenchmarks.avgRevPAR > 0 ? (currentProperty.performance.revpar / industryBenchmarks.avgRevPAR) * 100 : 0) * 0.25 +
             currentProperty.rating * 20 * 0.2) / 100 * 100
          ) || 0;
          return score >= 90 ? 'excellent' as const : score >= 75 ? 'good' as const : score >= 60 ? 'average' as const : 'poor' as const;
        })(),
        unit: '%',
        description: 'Overall property performance composite score'
      }
    ];
  };

  const benchmarkData = useMemo(() => generateBenchmarkData(), [currentProperty, industryBenchmarks]);

  const formatValue = (value: number, unit: string) => {
    if (Number.isNaN(value) || !Number.isFinite(value)) return `0${unit}`;
    if (unit === '₹') {
      return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(value);
    }
    if (unit === '%' || unit === '/5') {
      return `${parseFloat(value.toFixed(1))}${unit}`;
    }
    return `${value}${unit}`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'excellent': return 'bg-green-100 text-green-800';
      case 'good': return 'bg-blue-100 text-blue-800';
      case 'average': return 'bg-yellow-100 text-yellow-800';
      case 'poor': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'excellent': return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'good': return <CheckCircle className="w-4 h-4 text-blue-600" />;
      case 'average': return <AlertCircle className="w-4 h-4 text-yellow-600" />;
      case 'poor': return <XCircle className="w-4 h-4 text-red-600" />;
      default: return <AlertCircle className="w-4 h-4 text-gray-600" />;
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'up': return <TrendingUp className="w-4 h-4 text-green-500" />;
      case 'down': return <TrendingDown className="w-4 h-4 text-red-500" />;
      default: return <BarChart3 className="w-4 h-4 text-gray-500" />;
    }
  };

  const getPerformanceScore = () => {
    if (benchmarkData.length === 0) return 0;
    const excellent = benchmarkData.filter(item => item.status === 'excellent').length;
    const good = benchmarkData.filter(item => item.status === 'good').length;
    const average = benchmarkData.filter(item => item.status === 'average').length;
    const total = benchmarkData.length;

    return Math.round(((excellent * 100 + good * 75 + average * 50) / (total * 100)) * 100);
  };

  const performanceScore = getPerformanceScore();

  const filteredData = benchmarkData.filter(item => {
    if (category === 'all') return true;
    if (category === 'occupancy') return item.metric.includes('Occupancy') || item.metric.includes('ADR') || item.metric.includes('RevPAR');
    if (category === 'revenue') return item.metric.includes('Revenue') || item.metric.includes('ADR');
    if (category === 'guest') return item.metric.includes('Guest') || item.metric.includes('Check-in');
    if (category === 'operational') return item.metric.includes('Room Utilization') || item.metric.includes('Property Performance');
    return true;
  });

  if (!currentProperty) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="text-center text-gray-500">
            <BarChart3 className="mx-auto h-12 w-12 mb-4 text-gray-300" />
            <h3 className="text-lg font-semibold mb-1">No Property Selected</h3>
            <p className="text-sm">Select a property from the Properties tab to view benchmarks.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Performance Benchmarking</h2>
          <p className="text-gray-600">
            Compare performance against targets and industry standards
            {currentProperty && ` • ${currentProperty.name}`}
          </p>
        </div>
        <div className="flex items-center space-x-3">
          {/* Property Selector */}
          {properties.length > 1 && (
            <Select value={selectedPropertyId} onValueChange={setSelectedPropertyId}>
              <SelectTrigger className="w-56">
                <div className="flex items-center space-x-2 truncate">
                  <Building2 className="h-4 w-4 shrink-0" />
                  <span className="truncate">{currentProperty?.name || 'Select property'}</span>
                </div>
              </SelectTrigger>
              <SelectContent>
                {properties.map((property) => (
                  <SelectItem key={property.id} value={property.id}>
                    {property.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* Time Range Selector */}
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
      </div>

      {/* Performance Score */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Award className="w-5 h-5" />
            <span>Overall Performance Score</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="text-4xl font-bold text-blue-600">{performanceScore}%</div>
              <div>
                <div className="text-sm text-gray-600">Performance Rating</div>
                <Badge className={performanceScore >= 90 ? 'bg-green-100 text-green-800' : 
                                 performanceScore >= 75 ? 'bg-blue-100 text-blue-800' : 
                                 performanceScore >= 60 ? 'bg-yellow-100 text-yellow-800' : 
                                 'bg-red-100 text-red-800'}>
                  {performanceScore >= 90 ? 'Excellent' : 
                   performanceScore >= 75 ? 'Good' : 
                   performanceScore >= 60 ? 'Average' : 'Needs Improvement'}
                </Badge>
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm text-gray-600">vs Industry Average</div>
              <div className={`text-lg font-semibold ${performanceScore >= 75 ? 'text-green-600' : performanceScore >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>
                {performanceScore >= 75 ? '+' : ''}{(performanceScore - 75).toFixed(1)}%
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Category Filters */}
      <div className="flex flex-wrap gap-2">
        <Button
          variant={category === 'all' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setCategory('all')}
        >
          All Metrics
        </Button>
        <Button
          variant={category === 'occupancy' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setCategory('occupancy')}
        >
          Occupancy
        </Button>
        <Button
          variant={category === 'revenue' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setCategory('revenue')}
        >
          Revenue
        </Button>
        <Button
          variant={category === 'guest' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setCategory('guest')}
        >
          Guest Experience
        </Button>
        <Button
          variant={category === 'operational' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setCategory('operational')}
        >
          Operations
        </Button>
      </div>

      {/* Benchmark Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredData.map((item, index) => (
          <Card key={`filteredData-${index}-${item.metric}`}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">{item.metric}</CardTitle>
                <div className="flex items-center space-x-2">
                  {getStatusIcon(item.status)}
                  <Badge className={getStatusColor(item.status)}>
                    {item.status}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Current Value */}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Current</span>
                  <div className="flex items-center space-x-2">
                    <span className="text-xl font-bold">{formatValue(item.current, item.unit)}</span>
                    {getTrendIcon(item.trend)}
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className={`h-2 rounded-full ${
                      item.status === 'excellent' ? 'bg-green-500' :
                      item.status === 'good' ? 'bg-blue-500' :
                      item.status === 'average' ? 'bg-yellow-500' : 'bg-red-500'
                    }`}
                    style={{
                      width: `${item.target > 0 ? Math.min(100, (item.current / item.target) * 100) : 0}%`
                    }}
                  ></div>
                </div>

                {/* Target and Industry */}
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <div className="text-gray-600">Target</div>
                    <div className="font-semibold">{formatValue(item.target, item.unit)}</div>
                  </div>
                  <div>
                    <div className="text-gray-600">Industry Avg</div>
                    <div className="font-semibold">{formatValue(item.industry, item.unit)}</div>
                  </div>
                </div>

                {/* Description */}
                <div className="text-xs text-gray-500 pt-2 border-t">
                  {item.description}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Portfolio Comparison */}
      {properties.length > 1 && currentProperty && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <BarChart3 className="w-5 h-5" />
              <span>Portfolio Comparison</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <div className="text-lg font-bold text-blue-600">
                  {industryBenchmarks.avgOccupancy > 0
                    ? `${((currentProperty.performance.occupancyRate / industryBenchmarks.avgOccupancy) * 100 - 100).toFixed(1)}%`
                    : '—'}
                </div>
                <div className="text-sm text-blue-700">vs Portfolio Avg</div>
                <div className="text-xs text-blue-600">Occupancy Rate</div>
              </div>
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <div className="text-lg font-bold text-green-600">
                  {industryBenchmarks.avgADR > 0
                    ? `${((currentProperty.performance.adr / industryBenchmarks.avgADR) * 100 - 100).toFixed(1)}%`
                    : '—'}
                </div>
                <div className="text-sm text-green-700">vs Portfolio Avg</div>
                <div className="text-xs text-green-600">ADR</div>
              </div>
              <div className="text-center p-4 bg-purple-50 rounded-lg">
                <div className="text-lg font-bold text-purple-600">
                  {industryBenchmarks.avgRevPAR > 0
                    ? `${((currentProperty.performance.revpar / industryBenchmarks.avgRevPAR) * 100 - 100).toFixed(1)}%`
                    : '—'}
                </div>
                <div className="text-sm text-purple-700">vs Portfolio Avg</div>
                <div className="text-xs text-purple-600">RevPAR</div>
              </div>
              <div className="text-center p-4 bg-orange-50 rounded-lg">
                <div className="text-lg font-bold text-orange-600">
                  {[...properties].sort((a, b) => (b.performance?.revpar || 0) - (a.performance?.revpar || 0)).findIndex(p => p.id === currentProperty.id) + 1}
                </div>
                <div className="text-sm text-orange-700">Portfolio Rank</div>
                <div className="text-xs text-orange-600">by RevPAR</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recommendations */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Target className="w-5 h-5" />
            <span>Performance Recommendations</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {benchmarkData.filter(item => item.status === 'average' || item.status === 'poor').length === 0 ? (
              <div className="flex items-center space-x-3 p-3 bg-green-50 rounded-lg">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <div className="text-sm text-green-800">All metrics are meeting or exceeding targets. Keep up the great work!</div>
              </div>
            ) : (
              benchmarkData
                .filter(item => item.status === 'average' || item.status === 'poor')
                .map((item, index) => (
                  <div key={`rec-${index}-${item.metric}`} className="flex items-start space-x-3 p-3 bg-yellow-50 rounded-lg">
                    <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5" />
                    <div>
                      <div className="font-medium text-yellow-800">{item.metric}</div>
                      <div className="text-sm text-yellow-700">
                        Current: {formatValue(item.current, item.unit)} |
                        Target: {formatValue(item.target, item.unit)} |
                        Gap: {formatValue(item.target - item.current, item.unit)}
                      </div>
                      <div className="text-xs text-yellow-600 mt-1">
                        Focus on improving {item.metric.toLowerCase()} to meet target performance.
                      </div>
                    </div>
                  </div>
                ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
