import React, { useState, useEffect } from 'react';
import { withErrorBoundary } from '../../components/ErrorBoundary';
import {
  Box,
  Container,
  Typography,
  Card,
  CardContent,
  Grid,
  Button,
  Tabs,
  Tab,
  Alert,
  Chip,
  CircularProgress,
  Paper,
  Breadcrumbs,
  Link
} from '@mui/material';
import {
  Add as AddIcon,
  Dashboard as DashboardIcon,
  Group as GroupIcon,
  Share as ShareIcon,
  Analytics as AnalyticsIcon,
  Sync as SyncIcon,
  Warning as WarningIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useProperty } from '../../context/PropertyContext';
import { PropertyBreadcrumb } from '../../components/common/PropertyBreadcrumb';
import { centralizedRatesApi } from '../../services/api';
import PropertyGroupManager from '../../components/admin/PropertyGroupManager';
import RateDistribution from '../../components/admin/RateDistribution';
import CentralizedAnalytics from '../../components/admin/CentralizedAnalytics';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`centralized-rates-tabpanel-${index}`}
      aria-labelledby={`centralized-rates-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

interface DashboardStats {
  totalRates: number;
  activeRates: number;
  totalGroups: number;
  totalProperties: number;
  pendingConflicts: number;
  syncStatus: 'healthy' | 'warning' | 'error';
  lastSync: string;
}

interface CentralizedRate {
  _id: string;
  rateId: string;
  rateName: string;
  status: 'active' | 'inactive' | 'draft' | 'suspended';
  propertyGroup: {
    groupId: string;
    groupName: string;
    properties: string[];
  };
  pricing: {
    baseRate: number;
    currency: string;
  };
  distributionStatus: {
    totalProperties: number;
    synchronized: number;
    conflicts: number;
  };
  createdAt: string;
  updatedAt: string;
}

const AdminCentralizedRates: React.FC = () => {
  const navigate = useNavigate();
  const { selectedPropertyId, selectedProperty, viewMode } = useProperty();
  const [currentTab, setCurrentTab] = useState(0);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [rates, setRates] = useState<CentralizedRate[]>([]);
  const [conflicts, setConflicts] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const [ratesResponse, conflictsResponse, statsResponse] = await Promise.all([
        centralizedRatesApi.getRates({ limit: 10 }),
        centralizedRatesApi.getConflicts({ limit: 5 }),
        centralizedRatesApi.getDashboardStats()
      ]);

      setRates(ratesResponse.data?.rates || []);
      setConflicts(conflictsResponse.data?.conflicts || []);
      setStats(statsResponse.data || null);
    } catch (error) {
      console.error('Failed to load centralized rates dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setCurrentTab(newValue);
  };

  const handleCreateRate = () => {
    navigate('/admin/centralized-rates/create');
  };

  const handleSyncRates = async () => {
    if (!selectedGroup) return;

    try {
      await centralizedRatesApi.syncRates(selectedGroup);
      await loadDashboardData();
    } catch (error) {
      console.error('Failed to sync rates:', error);
    }
  };

  useEffect(() => {
    if (selectedPropertyId) {
      loadDashboardData();
    }
  }, [selectedPropertyId]);

  // Early return if no property selected in single mode - placed AFTER all hooks
  if (!selectedPropertyId && viewMode === 'single') {
    return <Container><Box p={6}>Please select a property</Box></Container>;
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'success';
      case 'inactive': return 'default';
      case 'draft': return 'warning';
      case 'suspended': return 'error';
      default: return 'default';
    }
  };

  const getSyncStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'success';
      case 'warning': return 'warning';
      case 'error': return 'error';
      default: return 'default';
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Container maxWidth="xl" sx={{ py: 3 }}>
      {/* Property Breadcrumb */}
      <PropertyBreadcrumb items={['Configuration', 'Centralized Rates']} />

      {/* Header */}
      <Box mb={3}>
        <Breadcrumbs aria-label="breadcrumb" sx={{ mb: 2 }}>
          <Link color="inherit" href="/admin">Admin</Link>
          <Typography color="text.primary">Centralized Rate Management</Typography>
        </Breadcrumbs>
        
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h4" component="h1">
            Centralized Rate Management
          </Typography>
          <Box display="flex" gap={2}>
            <Button
              variant="outlined"
              startIcon={<SyncIcon />}
              onClick={handleSyncRates}
              disabled={!selectedGroup}
            >
              Sync Rates
            </Button>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={handleCreateRate}
            >
              Create Rate
            </Button>
          </Box>
        </Box>

        {/* Quick Stats */}
        {stats && (
          <Grid container spacing={3} mb={3}>
            <Grid item xs={12} sm={6} md={2}>
              <Paper sx={{ p: 2, textAlign: 'center' }}>
                <Typography variant="h4" color="primary">{stats.totalRates}</Typography>
                <Typography variant="body2" color="text.secondary">Total Rates</Typography>
              </Paper>
            </Grid>
            <Grid item xs={12} sm={6} md={2}>
              <Paper sx={{ p: 2, textAlign: 'center' }}>
                <Typography variant="h4" color="success.main">{stats.activeRates}</Typography>
                <Typography variant="body2" color="text.secondary">Active Rates</Typography>
              </Paper>
            </Grid>
            <Grid item xs={12} sm={6} md={2}>
              <Paper sx={{ p: 2, textAlign: 'center' }}>
                <Typography variant="h4" color="info.main">{stats.totalGroups}</Typography>
                <Typography variant="body2" color="text.secondary">Property Groups</Typography>
              </Paper>
            </Grid>
            <Grid item xs={12} sm={6} md={2}>
              <Paper sx={{ p: 2, textAlign: 'center' }}>
                <Typography variant="h4" color="secondary.main">{stats.totalProperties}</Typography>
                <Typography variant="body2" color="text.secondary">Properties</Typography>
              </Paper>
            </Grid>
            <Grid item xs={12} sm={6} md={2}>
              <Paper sx={{ p: 2, textAlign: 'center' }}>
                <Typography variant="h4" color="warning.main">{stats.pendingConflicts}</Typography>
                <Typography variant="body2" color="text.secondary">Conflicts</Typography>
              </Paper>
            </Grid>
            <Grid item xs={12} sm={6} md={2}>
              <Paper sx={{ p: 2, textAlign: 'center' }}>
                <Chip 
                  label={stats.syncStatus.toUpperCase()} 
                  color={getSyncStatusColor(stats.syncStatus)} 
                  size="small"
                  sx={{ mb: 1 }}
                />
                <Typography variant="body2" color="text.secondary">Sync Status</Typography>
              </Paper>
            </Grid>
          </Grid>
        )}
      </Box>

      {/* Alerts */}
      {stats && stats.pendingConflicts > 0 && (
        <Alert severity="warning" sx={{ mb: 3 }} icon={<WarningIcon />}>
          You have {stats.pendingConflicts} pending rate conflicts that require attention.
          <Button size="small" sx={{ ml: 2 }} onClick={() => setCurrentTab(2)}>
            View Conflicts
          </Button>
        </Alert>
      )}

      {/* Main Content */}
      <Paper sx={{ width: '100%' }}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={currentTab} onChange={handleTabChange} aria-label="centralized rates tabs">
            <Tab 
              icon={<DashboardIcon />} 
              label="Overview" 
              id="centralized-rates-tab-0"
              aria-controls="centralized-rates-tabpanel-0"
            />
            <Tab 
              icon={<GroupIcon />} 
              label="Property Groups" 
              id="centralized-rates-tab-1"
              aria-controls="centralized-rates-tabpanel-1"
            />
            <Tab 
              icon={<ShareIcon />} 
              label="Rate Distribution" 
              id="centralized-rates-tab-2"
              aria-controls="centralized-rates-tabpanel-2"
            />
            <Tab 
              icon={<AnalyticsIcon />} 
              label="Analytics" 
              id="centralized-rates-tab-3"
              aria-controls="centralized-rates-tabpanel-3"
            />
          </Tabs>
        </Box>

        <TabPanel value={currentTab} index={0}>
          {/* Overview Tab */}
          <Grid container spacing={3}>
            <Grid item xs={12} lg={8}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>Recent Rates</Typography>
                  <Box sx={{ maxHeight: 400, overflow: 'auto' }}>
                    {rates.map((rate) => (
                      <Paper key={rate._id} sx={{ p: 2, mb: 2, border: '1px solid #e0e0e0' }}>
                        <Box display="flex" justifyContent="space-between" alignItems="center">
                          <Box>
                            <Typography variant="h6">{rate.rateName}</Typography>
                            <Typography variant="body2" color="text.secondary">
                              {rate.propertyGroup.groupName} • {rate.propertyGroup.properties.length} properties
                            </Typography>
                            <Typography variant="body2">
                              Base Rate: {rate.pricing.currency} {rate.pricing.baseRate}
                            </Typography>
                          </Box>
                          <Box textAlign="right">
                            <Chip 
                              label={rate.status} 
                              color={getStatusColor(rate.status)} 
                              size="small" 
                              sx={{ mb: 1 }}
                            />
                            <Typography variant="caption" display="block">
                              {rate.distributionStatus.synchronized}/{rate.distributionStatus.totalProperties} synced
                            </Typography>
                            {rate.distributionStatus.conflicts > 0 && (
                              <Chip 
                                label={`${rate.distributionStatus.conflicts} conflicts`}
                                color="warning" 
                                size="small" 
                              />
                            )}
                          </Box>
                        </Box>
                      </Paper>
                    ))}
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} lg={4}>
              <Card sx={{ mb: 2 }}>
                <CardContent>
                  <Typography variant="h6" gutterBottom>System Status</Typography>
                  <Box>
                    <Box display="flex" justifyContent="space-between" py={1}>
                      <Typography variant="body2">Last Sync:</Typography>
                      <Typography variant="body2" color="text.secondary">
                        {stats ? new Date(stats.lastSync).toLocaleString() : 'N/A'}
                      </Typography>
                    </Box>
                    <Box display="flex" justifyContent="space-between" py={1}>
                      <Typography variant="body2">Sync Status:</Typography>
                      <Chip 
                        label={stats?.syncStatus.toUpperCase()} 
                        color={getSyncStatusColor(stats?.syncStatus || 'default')} 
                        size="small" 
                      />
                    </Box>
                  </Box>
                </CardContent>
              </Card>

              {conflicts.length > 0 && (
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>Recent Conflicts</Typography>
                    <Box sx={{ maxHeight: 300, overflow: 'auto' }}>
                      {conflicts.map((conflict: Record<string, unknown>) => (
                        <Box key={conflict._id} sx={{ p: 1, mb: 1, bgcolor: 'warning.light', borderRadius: 1 }}>
                          <Typography variant="body2" fontWeight="bold">
                            {conflict.rateName}
                          </Typography>
                          <Typography variant="caption">
                            {conflict.propertyName} • {conflict.conflictType}
                          </Typography>
                        </Box>
                      ))}
                    </Box>
                  </CardContent>
                </Card>
              )}
            </Grid>
          </Grid>
        </TabPanel>

        <TabPanel value={currentTab} index={1}>
          <PropertyGroupManager 
            onGroupSelect={setSelectedGroup}
            selectedGroup={selectedGroup}
          />
        </TabPanel>

        <TabPanel value={currentTab} index={2}>
          <RateDistribution selectedGroup={selectedGroup} />
        </TabPanel>

        <TabPanel value={currentTab} index={3}>
          <CentralizedAnalytics selectedGroup={selectedGroup} />
        </TabPanel>
      </Paper>
    </Container>
  );
};

export default withErrorBoundary(AdminCentralizedRates);