import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  LinearProgress,
  Alert,
  Button,
  DatePicker,
  TextField,
  Tabs,
  Tab,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider
} from '@mui/material';
import {
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  Analytics as AnalyticsIcon,
  Assessment as AssessmentIcon,
  Timeline as TimelineIcon,
  PieChart as PieChartIcon,
  BarChart as BarChartIcon,
  AttachMoney as MoneyIcon,
  Hotel as HotelIcon,
  Group as GroupIcon,
  Sync as SyncIcon
} from '@mui/icons-material';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';
import { centralizedRatesApi } from '../../services/api';

interface CentralizedAnalyticsProps {
  selectedGroup: string | null;
}

interface AnalyticsData {
  overview: {
    totalRates: number;
    activeRates: number;
    totalProperties: number;
    syncSuccess: number;
    avgResponseTime: number;
    lastUpdate: string;
  };
  performance: {
    rateDistributionSpeed: Array<{
      date: string;
      speed: number;
      properties: number;
    }>;
    syncSuccess: Array<{
      date: string;
      successful: number;
      failed: number;
      total: number;
    }>;
    conflictResolution: Array<{
      type: string;
      count: number;
      resolved: number;
      pending: number;
    }>;
  };
  revenue: {
    impactAnalysis: Array<{
      rateName: string;
      beforeRevenue: number;
      afterRevenue: number;
      changePercent: number;
      properties: number;
    }>;
    propertyComparison: Array<{
      propertyName: string;
      centralizedRevenue: number;
      localRevenue: number;
      improvement: number;
    }>;
  };
  usage: {
    rateUsage: Array<{
      rateName: string;
      usageCount: number;
      properties: number;
      lastUsed: string;
    }>;
    propertyAdoption: Array<{
      propertyName: string;
      adoptionRate: number;
      totalRates: number;
      activeRates: number;
    }>;
  };
  trends: {
    monthlyGrowth: Array<{
      month: string;
      newRates: number;
      activeProperties: number;
      revenue: number;
    }>;
    seasonalPatterns: Array<{
      season: string;
      avgRate: number;
      bookings: number;
      revenue: number;
    }>;
  };
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D'];

const CentralizedAnalytics: React.FC<CentralizedAnalyticsProps> = ({ selectedGroup }) => {
  const [currentTab, setCurrentTab] = useState(0);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [dateRange, setDateRange] = useState({
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    endDate: new Date()
  });
  const [metricsType, setMetricsType] = useState('performance');

  useEffect(() => {
    if (selectedGroup) {
      loadAnalytics();
    }
  }, [selectedGroup, dateRange, metricsType]);

  const loadAnalytics = async () => {
    if (!selectedGroup) return;
    
    try {
      setLoading(true);
      const response = await centralizedRatesApi.getGroupAnalytics(selectedGroup, {
        startDate: dateRange.startDate.toISOString(),
        endDate: dateRange.endDate.toISOString(),
        metricsType
      });
      setAnalytics(response.data);
    } catch {
      // Error handled silently
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const formatPercentage = (value: number) => {
    return `${(value * 100).toFixed(1)}%`;
  };

  const getChangeIcon = (change: number) => {
    return change > 0 ? <TrendingUpIcon color="success" /> : <TrendingDownIcon color="error" />;
  };

  const getChangeColor = (change: number) => {
    return change > 0 ? 'success.main' : 'error.main';
  };

  if (!selectedGroup) {
    return (
      <Alert severity="info">
        Please select a property group to view analytics.
      </Alert>
    );
  }

  if (loading || !analytics) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <LinearProgress sx={{ width: '50%' }} />
      </Box>
    );
  }

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h5">Centralized Rate Analytics</Typography>
        <Box display="flex" gap={2}>
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Metrics Type</InputLabel>
            <Select
              value={metricsType}
              onChange={(e) => setMetricsType(e.target.value)}
              label="Metrics Type"
            >
              <MenuItem value="performance">Performance</MenuItem>
              <MenuItem value="revenue">Revenue Impact</MenuItem>
              <MenuItem value="usage">Usage Analytics</MenuItem>
            </Select>
          </FormControl>
          <Button variant="outlined" onClick={loadAnalytics}>
            Refresh
          </Button>
        </Box>
      </Box>

      {/* Overview Cards */}
      <Grid container spacing={3} mb={3}>
        <Grid item xs={12} sm={6} md={2}>
          <Paper sx={{ p: 2, textAlign: 'center' }}>
            <MoneyIcon color="primary" sx={{ fontSize: 40, mb: 1 }} />
            <Typography variant="h5" color="primary">
              {analytics.overview.totalRates}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Total Rates
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={6} md={2}>
          <Paper sx={{ p: 2, textAlign: 'center' }}>
            <AnalyticsIcon color="success" sx={{ fontSize: 40, mb: 1 }} />
            <Typography variant="h5" color="success.main">
              {analytics.overview.activeRates}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Active Rates
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={6} md={2}>
          <Paper sx={{ p: 2, textAlign: 'center' }}>
            <HotelIcon color="info" sx={{ fontSize: 40, mb: 1 }} />
            <Typography variant="h5" color="info.main">
              {analytics.overview.totalProperties}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Properties
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={6} md={2}>
          <Paper sx={{ p: 2, textAlign: 'center' }}>
            <SyncIcon color="warning" sx={{ fontSize: 40, mb: 1 }} />
            <Typography variant="h5" color="warning.main">
              {formatPercentage(analytics.overview.syncSuccess)}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Sync Success
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={6} md={2}>
          <Paper sx={{ p: 2, textAlign: 'center' }}>
            <TimelineIcon color="secondary" sx={{ fontSize: 40, mb: 1 }} />
            <Typography variant="h5" color="secondary.main">
              {analytics.overview.avgResponseTime}ms
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Avg Response
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={6} md={2}>
          <Paper sx={{ p: 2, textAlign: 'center' }}>
            <Typography variant="caption" color="text.secondary">
              Last Updated
            </Typography>
            <Typography variant="body2" fontWeight="bold">
              {new Date(analytics.overview.lastUpdate).toLocaleString()}
            </Typography>
          </Paper>
        </Grid>
      </Grid>

      {/* Analytics Tabs */}
      <Paper sx={{ width: '100%' }}>
        <Tabs value={currentTab} onChange={(e, v) => setCurrentTab(v)}>
          <Tab icon={<AssessmentIcon />} label="Performance" />
          <Tab icon={<MoneyIcon />} label="Revenue Impact" />
          <Tab icon={<BarChartIcon />} label="Usage Analytics" />
          <Tab icon={<TimelineIcon />} label="Trends" />
        </Tabs>

        <Box p={3}>
          {currentTab === 0 && (
            <Grid container spacing={3}>
              <Grid item xs={12} lg={6}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>Distribution Speed</Typography>
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={analytics.performance.rateDistributionSpeed}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Line type="monotone" dataKey="speed" stroke="#8884d8" name="Speed (ms)" />
                        <Line type="monotone" dataKey="properties" stroke="#82ca9d" name="Properties" />
                      </LineChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </Grid>

              <Grid item xs={12} lg={6}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>Sync Success Rate</Typography>
                    <ResponsiveContainer width="100%" height={300}>
                      <AreaChart data={analytics.performance.syncSuccess}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Area type="monotone" dataKey="successful" stackId="1" stroke="#82ca9d" fill="#82ca9d" name="Successful" />
                        <Area type="monotone" dataKey="failed" stackId="1" stroke="#ff8042" fill="#ff8042" name="Failed" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </Grid>

              <Grid item xs={12}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>Conflict Resolution</Typography>
                    <TableContainer>
                      <Table>
                        <TableHead>
                          <TableRow>
                            <TableCell>Conflict Type</TableCell>
                            <TableCell>Total</TableCell>
                            <TableCell>Resolved</TableCell>
                            <TableCell>Pending</TableCell>
                            <TableCell>Resolution Rate</TableCell>
                            <TableCell>Status</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {analytics.performance.conflictResolution.map((conflict) => (
                            <TableRow key={conflict.type}>
                              <TableCell>{conflict.type.replace('_', ' ').toUpperCase()}</TableCell>
                              <TableCell>{conflict.count}</TableCell>
                              <TableCell>{conflict.resolved}</TableCell>
                              <TableCell>{conflict.pending}</TableCell>
                              <TableCell>{formatPercentage(conflict.resolved / conflict.count)}</TableCell>
                              <TableCell>
                                <Chip 
                                  label={conflict.pending === 0 ? 'Clean' : 'Has Issues'} 
                                  color={conflict.pending === 0 ? 'success' : 'warning'} 
                                  size="small" 
                                />
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          )}

          {currentTab === 1 && (
            <Grid container spacing={3}>
              <Grid item xs={12} lg={8}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>Revenue Impact Analysis</Typography>
                    <TableContainer>
                      <Table>
                        <TableHead>
                          <TableRow>
                            <TableCell>Rate Name</TableCell>
                            <TableCell>Before</TableCell>
                            <TableCell>After</TableCell>
                            <TableCell>Change</TableCell>
                            <TableCell>Properties</TableCell>
                            <TableCell>Impact</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {analytics.revenue.impactAnalysis.map((impact) => (
                            <TableRow key={impact.rateName}>
                              <TableCell>{impact.rateName}</TableCell>
                              <TableCell>{formatCurrency(impact.beforeRevenue)}</TableCell>
                              <TableCell>{formatCurrency(impact.afterRevenue)}</TableCell>
                              <TableCell>
                                <Box display="flex" alignItems="center" gap={1}>
                                  {getChangeIcon(impact.changePercent)}
                                  <Typography color={getChangeColor(impact.changePercent)}>
                                    {formatPercentage(impact.changePercent / 100)}
                                  </Typography>
                                </Box>
                              </TableCell>
                              <TableCell>{impact.properties}</TableCell>
                              <TableCell>
                                <Chip 
                                  label={impact.changePercent > 0 ? 'Positive' : 'Negative'} 
                                  color={impact.changePercent > 0 ? 'success' : 'error'} 
                                  size="small" 
                                />
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </CardContent>
                </Card>
              </Grid>

              <Grid item xs={12} lg={4}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>Property Comparison</Typography>
                    <ResponsiveContainer width="100%" height={400}>
                      <BarChart data={analytics.revenue.propertyComparison.slice(0, 10)}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="propertyName" angle={-45} textAnchor="end" height={100} />
                        <YAxis />
                        <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                        <Legend />
                        <Bar dataKey="centralizedRevenue" fill="#8884d8" name="Centralized" />
                        <Bar dataKey="localRevenue" fill="#82ca9d" name="Local" />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          )}

          {currentTab === 2 && (
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>Rate Usage</Typography>
                    <List>
                      {analytics.usage.rateUsage.map((usage) => (
                        <ListItem key={usage.rateName}>
                          <ListItemIcon>
                            <MoneyIcon />
                          </ListItemIcon>
                          <ListItemText
                            primary={usage.rateName}
                            secondary={
                              <Box>
                                <Typography variant="body2">
                                  Used {usage.usageCount} times across {usage.properties} properties
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  Last used: {new Date(usage.lastUsed).toLocaleDateString()}
                                </Typography>
                              </Box>
                            }
                          />
                        </ListItem>
                      ))}
                    </List>
                  </CardContent>
                </Card>
              </Grid>

              <Grid item xs={12} md={6}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>Property Adoption</Typography>
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={analytics.usage.propertyAdoption.map(p => ({
                            name: p.propertyName,
                            value: p.adoptionRate
                          }))}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, value }) => `${name}: ${formatPercentage(value)}`}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {analytics.usage.propertyAdoption.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          )}

          {currentTab === 3 && (
            <Grid container spacing={3}>
              <Grid item xs={12} lg={8}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>Monthly Growth Trends</Typography>
                    <ResponsiveContainer width="100%" height={400}>
                      <LineChart data={analytics.trends.monthlyGrowth}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="month" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Line type="monotone" dataKey="newRates" stroke="#8884d8" name="New Rates" />
                        <Line type="monotone" dataKey="activeProperties" stroke="#82ca9d" name="Active Properties" />
                        <Line type="monotone" dataKey="revenue" stroke="#ffc658" name="Revenue" />
                      </LineChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </Grid>

              <Grid item xs={12} lg={4}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>Seasonal Patterns</Typography>
                    <List>
                      {analytics.trends.seasonalPatterns.map((season) => (
                        <React.Fragment key={season.season}>
                          <ListItem>
                            <ListItemText
                              primary={season.season}
                              secondary={
                                <Box>
                                  <Typography variant="body2">
                                    Avg Rate: {formatCurrency(season.avgRate)}
                                  </Typography>
                                  <Typography variant="body2">
                                    Bookings: {season.bookings}
                                  </Typography>
                                  <Typography variant="body2">
                                    Revenue: {formatCurrency(season.revenue)}
                                  </Typography>
                                </Box>
                              }
                            />
                          </ListItem>
                          <Divider />
                        </React.Fragment>
                      ))}
                    </List>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          )}
        </Box>
      </Paper>
    </Box>
  );
};

export default CentralizedAnalytics;