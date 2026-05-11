import React, { useState, useEffect } from 'react';
import { withErrorBoundary } from '../../components/ErrorBoundary';
import { Box, Typography, Tabs, Tab, Paper, Grid, Card, CardContent, CardHeader, CardTitle } from '@mui/material';
import { 
  Business, 
  FlightTakeoff, 
  FindInPage, 
  Analytics,
  Add,
  Edit,
  Delete,
  Visibility
} from '@mui/icons-material';
import CounterManager from '../../components/operational/CounterManager';
import ArrivalDepartureManager from '../../components/operational/ArrivalDepartureManager';
import LostFoundManager from '../../components/operational/LostFoundManager';
import OperationalAnalytics from '../../components/operational/OperationalAnalytics';
import { useProperty } from '../../context/PropertyContext';
import { PropertyBreadcrumb } from '../../components/common/PropertyBreadcrumb';
import { api } from '../../services/api';

interface OverviewData {
  summary: {
    totalCounters: number;
    availableCounters: number;
    totalModes: number;
    totalLostFoundItems: number;
    foundItems: number;
    claimedItems: number;
  };
}

const AdminOperationalManagement: React.FC = () => {
  const { selectedPropertyId, viewMode } = useProperty();
  const [currentTab, setCurrentTab] = useState(0);
  const [overviewData, setOverviewData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (selectedPropertyId || viewMode === 'portfolio') {
      fetchOverviewData();
    }
  }, [selectedPropertyId]);

  const fetchOverviewData = async () => {
    if (!selectedPropertyId && viewMode === 'single') return;

    try {
      setLoading(true);
      const response = await api.get('/operational-management/overview', {
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
          totalCounters: 0,
          availableCounters: 0,
          totalModes: 0,
          totalLostFoundItems: 0,
          foundItems: 0,
          claimedItems: 0
        }
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

  if (!selectedPropertyId && viewMode === 'single') {
    return (
      <Box sx={{ p: 3 }}>
        <PropertyBreadcrumb items={['Operational Management']} />
        <Box display="flex" flexDirection="column" alignItems="center" justifyContent="center" minHeight="400px">
          <Business sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
          <Typography variant="h6" color="text.secondary">No Property Selected</Typography>
          <Typography variant="body2" color="text.disabled">
            Please select a property to view operational management.
          </Typography>
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <PropertyBreadcrumb items={['Operational Management']} />
      <Typography variant="h4" component="h1" gutterBottom>
        Operational Management
      </Typography>
      <Typography variant="subtitle1" color="textSecondary" gutterBottom>
        Manage counters, arrival/departure modes, and lost & found items for your hotel
      </Typography>

      {/* Overview Cards */}
      {overviewData && (
        <Grid container spacing={3} sx={{ mb: 3 }}>
          <Grid item xs={12} md={4}>
            <StatCard
              title="Counters"
              value={overviewData.summary.totalCounters}
              icon={<Business sx={{ fontSize: 40 }} />}
              color="primary.main"
              subtitle={`${overviewData.summary.availableCounters} available`}
            />
          </Grid>
          <Grid item xs={12} md={4}>
            <StatCard
              title="Arrival/Departure Modes"
              value={overviewData.summary.totalModes}
              icon={<FlightTakeoff sx={{ fontSize: 40 }} />}
              color="success.main"
            />
          </Grid>
          <Grid item xs={12} md={4}>
            <StatCard
              title="Lost & Found Items"
              value={overviewData.summary.totalLostFoundItems}
              icon={<FindInPage sx={{ fontSize: 40 }} />}
              color="warning.main"
              subtitle={`${overviewData.summary.foundItems} found, ${overviewData.summary.claimedItems} claimed`}
            />
          </Grid>
        </Grid>
      )}

      {/* Tabs */}
      <Paper sx={{ mb: 3 }}>
        <Tabs 
          value={currentTab} 
          onChange={handleTabChange} 
          aria-label="operational management tabs"
          variant="fullWidth"
        >
          <Tab 
            icon={<Business />} 
            label="Counters" 
            iconPosition="start"
          />
          <Tab 
            icon={<FlightTakeoff />} 
            label="Arrival/Departure" 
            iconPosition="start"
          />
          <Tab 
            icon={<FindInPage />} 
            label="Lost & Found" 
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
          <CounterManager onRefresh={fetchOverviewData} />
        </Box>
      )}
      
      {currentTab === 1 && (
        <Box>
          <ArrivalDepartureManager onRefresh={fetchOverviewData} />
        </Box>
      )}
      
      {currentTab === 2 && (
        <Box>
          <LostFoundManager onRefresh={fetchOverviewData} />
        </Box>
      )}
      
      {currentTab === 3 && (
        <Box>
          <OperationalAnalytics />
        </Box>
      )}
    </Box>
  );
};

export default AdminOperationalManagement;
