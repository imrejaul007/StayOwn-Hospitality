import React, { useState, useEffect } from 'react';
import { withErrorBoundary } from '../../components/ErrorBoundary';
import { Box, Typography, Tabs, Tab, Paper, Grid, Card, CardContent, CardHeader } from '@mui/material';
import {
  LocalOffer,
  TrendingUp,
  Group,
  Work,
  Analytics,
  Add,
  Edit,
  Delete,
  Visibility
} from '@mui/icons-material';
import DiscountManager from '../../components/advanced/DiscountManager';
import PricingManager from '../../components/advanced/PricingManager';
import MarketSegmentManager from '../../components/advanced/MarketSegmentManager';
import JobTypeManager from '../../components/advanced/JobTypeManager';
import AdvancedAnalytics from '../../components/advanced/AdvancedAnalytics';
import { useProperty } from '../../context/PropertyContext';
import { PropertyBreadcrumb } from '../../components/common/PropertyBreadcrumb';
import { api } from '../../services/api';

interface OverviewData {
  summary: {
    totalDiscounts: number;
    activeDiscounts: number;
    totalPricingRules: number;
    activePricingRules: number;
    totalMarketSegments: number;
    totalJobTypes: number;
    remoteEligibleJobs: number;
  };
  topSegments: Array<{
    _id: string;
    name: string;
    category: string;
    analytics: {
      totalRevenue: number;
      totalBookings: number;
      averageBookingValue: number;
    };
  }>;
}

const AdminAdvancedFeatures: React.FC = () => {
  const { selectedPropertyId, selectedProperty, viewMode } = useProperty();
  const [currentTab, setCurrentTab] = useState(0);
  const [overviewData, setOverviewData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (selectedPropertyId || viewMode === 'all') {
      fetchOverviewData();
    }
  }, [selectedPropertyId, viewMode]);

  const fetchOverviewData = async () => {
    try {
      setLoading(true);
      const response = await api.get('/discount-pricing/overview', {
        params: { propertyId: selectedPropertyId }
      });
      if (response.data?.data?.overview) {
        setOverviewData(response.data.data.overview);
      } else if (response.data?.overview) {
        setOverviewData(response.data.overview);
      }
    } catch {
      // If overview endpoint not available, set empty defaults
      setOverviewData({
        summary: {
          totalDiscounts: 0,
          activeDiscounts: 0,
          totalPricingRules: 0,
          activePricingRules: 0,
          totalMarketSegments: 0,
          totalJobTypes: 0,
          remoteEligibleJobs: 0
        },
        topSegments: []
      });
    } finally {
      setLoading(false);
    }
  };

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setCurrentTab(newValue);
  };

  const StatCard: React.FC<{ title: string; value: number; icon: React.ReactNode; color: string; subtitle?: string }> = ({ 
    title, 
    value, 
    icon, 
    color,
    subtitle
  }) => (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Box>
            <Typography color="textSecondary" gutterBottom variant="h6">
              {title}
            </Typography>
            <Typography variant="h4" component="h2" color={color}>
              {value}
            </Typography>
            {subtitle && (
              <Typography variant="body2" color="textSecondary">
                {subtitle}
              </Typography>
            )}
          </Box>
          <Box color={color}>
            {icon}
          </Box>
        </Box>
      </CardContent>
    </Card>
  );

  // If in single mode and no property selected, show selection prompt
  if (!selectedPropertyId && viewMode === 'single') {
    return (
      <Box sx={{ p: 3 }}>
        <PropertyBreadcrumb items={['Integration', 'Advanced Features']} />
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '400px' }}>
          <Typography variant="h6" color="textSecondary">
            Please select a property to view advanced features
          </Typography>
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <PropertyBreadcrumb items={['Integration', 'Advanced Features']} />
      <Typography variant="h4" component="h1" gutterBottom sx={{ mt: 2 }}>
        Advanced Features
      </Typography>
      <Typography variant="subtitle1" color="textSecondary" gutterBottom>
        Manage discounts, dynamic pricing, market segments, and job types for advanced hotel operations
        {selectedProperty && ` - ${selectedProperty.name}`}
      </Typography>

      {/* Overview Cards */}
      {overviewData && (
        <Grid container spacing={3} sx={{ mb: 3 }}>
          <Grid item xs={12} md={3}>
            <StatCard
              title="Special Discounts"
              value={overviewData.summary.totalDiscounts}
              icon={<LocalOffer sx={{ fontSize: 40 }} />}
              color="primary.main"
              subtitle={`${overviewData.summary.activeDiscounts} active`}
            />
          </Grid>
          <Grid item xs={12} md={3}>
            <StatCard
              title="Pricing Rules"
              value={overviewData.summary.totalPricingRules}
              icon={<TrendingUp sx={{ fontSize: 40 }} />}
              color="success.main"
              subtitle={`${overviewData.summary.activePricingRules} active`}
            />
          </Grid>
          <Grid item xs={12} md={3}>
            <StatCard
              title="Market Segments"
              value={overviewData.summary.totalMarketSegments}
              icon={<Group sx={{ fontSize: 40 }} />}
              color="warning.main"
            />
          </Grid>
          <Grid item xs={12} md={3}>
            <StatCard
              title="Job Types"
              value={overviewData.summary.totalJobTypes}
              icon={<Work sx={{ fontSize: 40 }} />}
              color="info.main"
              subtitle={`${overviewData.summary.remoteEligibleJobs} remote`}
            />
          </Grid>
        </Grid>
      )}

      {/* Top Performing Segments */}
      {overviewData && overviewData.topSegments.length > 0 && (
        <Grid container spacing={3} sx={{ mb: 3 }}>
          <Grid item xs={12}>
            <Card>
              <CardHeader>
                <CardTitle>Top Performing Market Segments</CardTitle>
              </CardHeader>
              <CardContent>
                <Grid container spacing={2}>
                  {overviewData.topSegments.map((segment) => (
                    <Grid item xs={12} md={4} key={segment._id}>
                      <Card variant="outlined">
                        <CardContent>
                          <Typography variant="h6" gutterBottom>
                            {segment.name}
                          </Typography>
                          <Typography variant="body2" color="textSecondary" gutterBottom>
                            {segment.category.charAt(0).toUpperCase() + segment.category.slice(1)}
                          </Typography>
                          <Typography variant="body2">
                            Revenue: ${segment.analytics.totalRevenue.toLocaleString()}
                          </Typography>
                          <Typography variant="body2">
                            Bookings: {segment.analytics.totalBookings}
                          </Typography>
                          <Typography variant="body2">
                            Avg Value: ${segment.analytics.averageBookingValue.toFixed(2)}
                          </Typography>
                        </CardContent>
                      </Card>
                    </Grid>
                  ))}
                </Grid>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Tabs */}
      <Paper sx={{ mb: 3 }}>
        <Tabs 
          value={currentTab} 
          onChange={handleTabChange} 
          aria-label="advanced features tabs"
          variant="fullWidth"
        >
          <Tab 
            icon={<LocalOffer />} 
            label="Discounts" 
            iconPosition="start"
          />
          <Tab 
            icon={<TrendingUp />} 
            label="Dynamic Pricing" 
            iconPosition="start"
          />
          <Tab 
            icon={<Group />} 
            label="Market Segments" 
            iconPosition="start"
          />
          <Tab 
            icon={<Work />} 
            label="Job Types" 
            iconPosition="start"
          />
          <Tab 
            icon={<Analytics />} 
            label="Analytics" 
            iconPosition="start"
          />
        </Tabs>
      </Paper>

      {/* Tab Content */}
      {currentTab === 0 && (
        <Box>
          <DiscountManager onRefresh={fetchOverviewData} />
        </Box>
      )}
      
      {currentTab === 1 && (
        <Box>
          <PricingManager onRefresh={fetchOverviewData} />
        </Box>
      )}
      
      {currentTab === 2 && (
        <Box>
          <MarketSegmentManager onRefresh={fetchOverviewData} />
        </Box>
      )}
      
      {currentTab === 3 && (
        <Box>
          <JobTypeManager onRefresh={fetchOverviewData} />
        </Box>
      )}
      
      {currentTab === 4 && (
        <Box>
          <AdvancedAnalytics />
        </Box>
      )}
    </Box>
  );
};

export default withErrorBoundary(AdminAdvancedFeatures);
