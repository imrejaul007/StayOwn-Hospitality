import React, { useState, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Progress } from '../ui/progress';
import {
  TrendingUp,
  Target,
  Lightbulb,
  CheckCircle,
  IndianRupee,
  Users,
  BarChart3,
  Zap,
  Clock,
  Star
} from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';

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

interface RevenueOptimizationInsightsProps {
  properties: Property[];
  selectedProperty?: Property | null;
}

interface Opportunity {
  id: string;
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  effort: 'low' | 'medium' | 'high';
  category: 'pricing' | 'occupancy' | 'amenities' | 'operational' | 'marketing';
  potentialRevenue: number;
  confidence: number;
  timeframe: string;
  recommendations: string[];
  currentValue: number;
  targetValue: number;
  unit: string;
}

export const RevenueOptimizationInsights: React.FC<RevenueOptimizationInsightsProps> = ({
  properties,
  selectedProperty
}) => {
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [impactFilter, setImpactFilter] = useState<string>('all');

  // Calculate portfolio benchmarks
  const portfolioBenchmarks = useMemo(() => {
    if (properties.length === 0) return null;

    const activeProperties = properties.filter(p => p.status === 'active');
    const total = activeProperties.length || 1; // Avoid division by zero

    return {
      avgOccupancy: activeProperties.reduce((sum, p) => sum + (p.performance?.occupancyRate || 0), 0) / total,
      avgADR: activeProperties.reduce((sum, p) => sum + (p.performance?.adr || 0), 0) / total,
      avgRevPAR: activeProperties.reduce((sum, p) => sum + (p.performance?.revpar || 0), 0) / total,
      avgRevenue: activeProperties.reduce((sum, p) => sum + (p.performance?.revenue || 0), 0) / total,
      avgRating: activeProperties.reduce((sum, p) => sum + (p.rating || 0), 0) / total,
      topPerformer: [...activeProperties].sort((a, b) => (b.performance?.revpar || 0) - (a.performance?.revpar || 0))[0],
      bottomPerformer: [...activeProperties].sort((a, b) => (a.performance?.revpar || 0) - (b.performance?.revpar || 0))[0]
    };
  }, [properties]);

  // Generate optimization opportunities
  const generateOpportunities = (): Opportunity[] => {
    if (!portfolioBenchmarks) return [];

    const opportunities: Opportunity[] = [];
    const currentProperty = selectedProperty || properties[0];

    if (!currentProperty) return [];

    // Pricing Optimization
    if (currentProperty.performance.adr < portfolioBenchmarks.avgADR * 0.9) {
      opportunities.push({
        id: 'pricing-adr',
        title: 'ADR Optimization Opportunity',
        description: 'Your Average Daily Rate is below portfolio benchmark. Consider dynamic pricing strategies.',
        impact: 'high',
        effort: 'medium',
        category: 'pricing',
        potentialRevenue: (portfolioBenchmarks.avgADR - currentProperty.performance.adr) * currentProperty.rooms.total * 365 * 0.7,
        confidence: 85,
        timeframe: '30-60 days',
        recommendations: [
          'Implement dynamic pricing based on demand patterns',
          'Analyze competitor pricing in your market',
          'Consider value-added packages to justify higher rates',
          'Optimize pricing for weekends and peak seasons'
        ],
        currentValue: currentProperty.performance.adr,
        targetValue: portfolioBenchmarks.avgADR,
        unit: '₹'
      });
    }

    // Occupancy Optimization
    if (currentProperty.performance.occupancyRate < portfolioBenchmarks.avgOccupancy * 0.9) {
      opportunities.push({
        id: 'occupancy-rate',
        title: 'Occupancy Rate Enhancement',
        description: 'Occupancy is below portfolio average. Focus on marketing and booking optimization.',
        impact: 'high',
        effort: 'medium',
        category: 'occupancy',
        potentialRevenue: (portfolioBenchmarks.avgOccupancy - currentProperty.performance.occupancyRate) * 0.01 * currentProperty.performance.adr * currentProperty.rooms.total * 365,
        confidence: 78,
        timeframe: '60-90 days',
        recommendations: [
          'Enhance online marketing presence',
          'Optimize booking engine and reduce friction',
          'Partner with local attractions and businesses',
          'Implement last-minute booking promotions'
        ],
        currentValue: currentProperty.performance.occupancyRate,
        targetValue: portfolioBenchmarks.avgOccupancy,
        unit: '%'
      });
    }

    // Service Quality Optimization
    if (currentProperty.rating < portfolioBenchmarks.avgRating) {
      opportunities.push({
        id: 'service-quality',
        title: 'Guest Satisfaction Improvement',
        description: 'Guest ratings are below portfolio average. Improving satisfaction can drive repeat bookings.',
        impact: 'medium',
        effort: 'high',
        category: 'operational',
        potentialRevenue: Math.max(50000, (currentProperty.performance?.revenue || 0) * 0.05), // ~5% of current revenue
        confidence: 70,
        timeframe: '90-180 days',
        recommendations: [
          'Implement guest feedback collection system',
          'Train staff on hospitality excellence',
          'Upgrade key amenities based on guest feedback',
          'Respond promptly to online reviews'
        ],
        currentValue: currentProperty.rating,
        targetValue: portfolioBenchmarks.avgRating,
        unit: '/5'
      });
    }

    // Room Utilization
    if (currentProperty.rooms.outOfOrder > currentProperty.rooms.total * 0.05) {
      opportunities.push({
        id: 'room-utilization',
        title: 'Room Availability Optimization',
        description: 'High number of out-of-order rooms is impacting revenue potential.',
        impact: 'medium',
        effort: 'low',
        category: 'operational',
        potentialRevenue: currentProperty.rooms.outOfOrder * currentProperty.performance.adr * 365 * 0.7,
        confidence: 90,
        timeframe: '7-30 days',
        recommendations: [
          'Prioritize maintenance of out-of-order rooms',
          'Implement preventive maintenance schedule',
          'Consider room upgrade opportunities during repairs',
          'Track maintenance response times'
        ],
        currentValue: currentProperty.rooms.total > 0
          ? ((currentProperty.rooms.total - currentProperty.rooms.outOfOrder) / currentProperty.rooms.total) * 100
          : 0,
        targetValue: 98,
        unit: '%'
      });
    }

    // Premium Amenities
    const premiumAmenities = ['spa', 'fitness', 'restaurant', 'pool'];
    const hasPremiumAmenities = premiumAmenities.filter(amenity => currentProperty.features[amenity as keyof typeof currentProperty.features]).length;

    if (hasPremiumAmenities < 2) {
      opportunities.push({
        id: 'amenity-upgrade',
        title: 'Premium Amenity Development',
        description: 'Adding premium amenities can justify higher rates and attract more guests.',
        impact: 'high',
        effort: 'high',
        category: 'amenities',
        potentialRevenue: Math.max(200000, (currentProperty.performance?.revenue || 0) * 0.15), // ~15% of current revenue
        confidence: 65,
        timeframe: '180-365 days',
        recommendations: [
          'Conduct market analysis for most desired amenities',
          'Consider fitness center or spa installation',
          'Evaluate restaurant/dining options',
          'Plan amenity development in phases'
        ],
        currentValue: hasPremiumAmenities,
        targetValue: 3,
        unit: ' amenities'
      });
    }

    return opportunities.sort((a, b) => b.potentialRevenue - a.potentialRevenue);
  };

  const opportunities = useMemo(() => generateOpportunities(), [portfolioBenchmarks, selectedProperty, properties]);

  const filteredOpportunities = opportunities.filter(opp => {
    const categoryMatch = categoryFilter === 'all' || opp.category === categoryFilter;
    const impactMatch = impactFilter === 'all' || opp.impact === impactFilter;
    return categoryMatch && impactMatch;
  });

  const getImpactColor = (impact: string) => {
    switch (impact) {
      case 'high': return 'bg-red-100 text-red-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'low': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getEffortColor = (effort: string) => {
    switch (effort) {
      case 'low': return 'bg-green-100 text-green-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'high': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'pricing': return <IndianRupee className="h-4 w-4" />;
      case 'occupancy': return <Users className="h-4 w-4" />;
      case 'amenities': return <Star className="h-4 w-4" />;
      case 'operational': return <Clock className="h-4 w-4" />;
      case 'marketing': return <TrendingUp className="h-4 w-4" />;
      default: return <BarChart3 className="h-4 w-4" />;
    }
  };

  const totalPotentialRevenue = filteredOpportunities.reduce((sum, opp) => sum + opp.potentialRevenue, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Revenue Optimization Insights</h2>
          <p className="text-gray-600">
            AI-powered recommendations to maximize revenue potential
            {selectedProperty && ` • ${selectedProperty.name}`}
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-40">
              <span>{categoryFilter === 'all' ? 'All Categories' : categoryFilter.charAt(0).toUpperCase() + categoryFilter.slice(1)}</span>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              <SelectItem value="pricing">Pricing</SelectItem>
              <SelectItem value="occupancy">Occupancy</SelectItem>
              <SelectItem value="amenities">Amenities</SelectItem>
              <SelectItem value="operational">Operational</SelectItem>
              <SelectItem value="marketing">Marketing</SelectItem>
            </SelectContent>
          </Select>

          <Select value={impactFilter} onValueChange={setImpactFilter}>
            <SelectTrigger className="w-32">
              <span>{impactFilter === 'all' ? 'All Impact' : impactFilter.charAt(0).toUpperCase() + impactFilter.slice(1)}</span>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Impact</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="low">Low</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Opportunities</p>
                <p className="text-2xl font-bold">{filteredOpportunities.length}</p>
              </div>
              <Lightbulb className="h-8 w-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Potential Revenue</p>
                <p className="text-2xl font-bold">₹{(totalPotentialRevenue / 1000).toFixed(0)}K</p>
              </div>
              <TrendingUp className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">High Impact</p>
                <p className="text-2xl font-bold">{filteredOpportunities.filter(o => o.impact === 'high').length}</p>
              </div>
              <Target className="h-8 w-8 text-red-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Quick Wins</p>
                <p className="text-2xl font-bold">
                  {filteredOpportunities.filter(o => o.effort === 'low' && o.impact !== 'low').length}
                </p>
              </div>
              <Zap className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Opportunities List */}
      <div className="space-y-4">
        {filteredOpportunities.map((opportunity) => (
          <Card key={opportunity.id} className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  {getCategoryIcon(opportunity.category)}
                  <div>
                    <CardTitle className="text-lg">{opportunity.title}</CardTitle>
                    <p className="text-sm text-muted-foreground">{opportunity.description}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Badge className={getImpactColor(opportunity.impact)}>
                    {opportunity.impact} impact
                  </Badge>
                  <Badge className={getEffortColor(opportunity.effort)}>
                    {opportunity.effort} effort
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Metrics */}
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-muted-foreground">Current</span>
                      <span className="font-medium">
                        {opportunity.currentValue.toFixed(opportunity.unit === '%' ? 1 : 0)}{opportunity.unit}
                      </span>
                    </div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-muted-foreground">Target</span>
                      <span className="font-medium text-green-600">
                        {opportunity.targetValue.toFixed(opportunity.unit === '%' ? 1 : 0)}{opportunity.unit}
                      </span>
                    </div>
                    <Progress
                      value={opportunity.targetValue > 0 ? Math.min(100, (opportunity.currentValue / opportunity.targetValue) * 100) : 0}
                      className="h-2"
                    />
                  </div>

                  <div>
                    <div className="text-sm text-muted-foreground">Potential Revenue</div>
                    <div className="text-xl font-bold text-green-600">
                      ₹{(opportunity.potentialRevenue / 1000).toFixed(0)}K
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {opportunity.confidence}% confidence • {opportunity.timeframe}
                    </div>
                  </div>
                </div>

                {/* Recommendations */}
                <div className="md:col-span-2">
                  <div className="text-sm font-medium mb-2">Recommended Actions:</div>
                  <div className="space-y-2">
                    {opportunity.recommendations.map((rec, index) => (
                      <div key={`opportunity-recommendations-${index}-${rec}`} className="flex items-start space-x-2">
                        <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                        <span className="text-sm text-gray-700">{rec}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Empty State */}
      {filteredOpportunities.length === 0 && (
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <CheckCircle className="mx-auto h-12 w-12 text-green-500" />
              <h3 className="mt-4 text-lg font-semibold">Great Performance!</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                No optimization opportunities found with current filters. Your property is performing well!
              </p>
              <Button
                className="mt-4"
                variant="outline"
                onClick={() => {
                  setCategoryFilter('all');
                  setImpactFilter('all');
                }}
              >
                View All Opportunities
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};