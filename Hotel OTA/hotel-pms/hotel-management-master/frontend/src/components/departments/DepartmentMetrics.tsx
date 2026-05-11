import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  LinearProgress,
  Chip,
  IconButton,
  Menu,
  MenuItem,
  Alert,
  CircularProgress,
  Tooltip,
  Paper,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider
} from '@mui/material';
import {
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  People as PeopleIcon,
  AttachMoney as MoneyIcon,
  Assignment as TaskIcon,
  Speed as EfficiencyIcon,
  MoreVert as MoreVertIcon,
  Refresh as RefreshIcon,
  Timeline as TimelineIcon,
  Star as StarIcon
} from '@mui/icons-material';
import { departmentService } from '../../services/departmentService';

interface DepartmentMetrics {
  basic: {
    name: string;
    code: string;
    type: string;
    level: number;
  };
  staffing: {
    totalPositions: number;
    currentStaff: number;
    occupancyRate: string;
  };
  performance: {
    completionRate: string;
    efficiency: number;
    totalTasks: number;
    avgCompletionTime: number;
  };
  financial: {
    totalRevenue: number;
    totalExpenses: number;
    budgetUtilization: string;
  };
  hierarchy: {
    subdepartments: number;
    hasParent: boolean;
    fullPath: string;
  };
}

interface KPI {
  name: string;
  target: number;
  current: number;
  achievement: string;
  unit: string;
}

interface DepartmentAnalytics {
  basic: DepartmentMetrics;
  period: string;
  kpis: KPI[];
  trends: {
    efficiency: number;
    completionRate: string;
    budgetUtilization: string;
  };
}

interface DepartmentMetricsProps {
  departmentId: string | null;
  period?: '7d' | '30d' | '90d' | '1y';
}

const DepartmentMetrics: React.FC<DepartmentMetricsProps> = ({ 
  departmentId, 
  period = '30d' 
}) => {
  const [metrics, setMetrics] = useState<DepartmentAnalytics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  useEffect(() => {
    if (departmentId) {
      loadMetrics();
    }
  }, [departmentId, period]);

  const loadMetrics = async () => {
    if (!departmentId) return;

    try {
      setLoading(true);
      setError(null);
      const response = await departmentService.getDepartmentMetrics(departmentId, period);
      setMetrics(response.data);
    } catch (err: unknown) {
      setError(err.response?.data?.message || 'Failed to load department metrics');
    } finally {
      setLoading(false);
    }
  };

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const getProgressColor = (value: number): 'primary' | 'secondary' | 'error' | 'warning' | 'info' | 'success' => {
    if (value >= 90) return 'success';
    if (value >= 75) return 'info';
    if (value >= 50) return 'warning';
    return 'error';
  };

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const formatNumber = (num: number): string => {
    return new Intl.NumberFormat('en-US').format(num);
  };

  const getTrendIcon = (value: number) => {
    return value >= 0 ? (
      <TrendingUpIcon sx={{ color: 'success.main', fontSize: 20 }} />
    ) : (
      <TrendingDownIcon sx={{ color: 'error.main', fontSize: 20 }} />
    );
  };

  if (!departmentId) {
    return (
      <Card>
        <CardContent>
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <TimelineIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6" color="text.secondary" gutterBottom>
              No Department Selected
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Select a department to view its performance metrics
            </Typography>
          </Box>
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 300 }}>
            <CircularProgress />
          </Box>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent>
          <Alert severity="error">{error}</Alert>
        </CardContent>
      </Card>
    );
  }

  if (!metrics) {
    return null;
  }

  return (
    <Card>
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Box>
            <Typography variant="h6" gutterBottom>
              {metrics.basic.basic.name} Analytics
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {metrics.period} performance overview
            </Typography>
          </Box>
          <Box>
            <IconButton onClick={loadMetrics} size="small">
              <RefreshIcon />
            </IconButton>
            <IconButton onClick={handleMenuOpen} size="small">
              <MoreVertIcon />
            </IconButton>
          </Box>
        </Box>

        <Grid container spacing={3}>
          {/* Key Performance Indicators */}
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 2, height: '100%' }}>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
                <StarIcon sx={{ mr: 1, color: 'primary.main' }} />
                Key Performance Indicators
              </Typography>
              <List dense>
                {metrics.kpis.map((kpi, index) => (
                  <React.Fragment key={`metrics-kpis-${index}-${kpi.name}`}>
                    <ListItem sx={{ px: 0 }}>
                      <ListItemText
                        primary={kpi.name}
                        secondary={
                          <Box sx={{ mt: 1 }}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                              <Typography variant="caption">
                                {kpi.current} / {kpi.target} {kpi.unit}
                              </Typography>
                              <Typography variant="caption" color="primary">
                                {kpi.achievement}%
                              </Typography>
                            </Box>
                            <LinearProgress
                              variant="determinate"
                              value={Math.min(parseFloat(kpi.achievement), 100)}
                              color={getProgressColor(parseFloat(kpi.achievement))}
                              sx={{ height: 6, borderRadius: 3 }}
                            />
                          </Box>
                        }
                      />
                    </ListItem>
                    {index < metrics.kpis.length - 1 && <Divider />}
                  </React.Fragment>
                ))}
              </List>
            </Paper>
          </Grid>

          {/* Performance Metrics */}
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 2, height: '100%' }}>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
                <EfficiencyIcon sx={{ mr: 1, color: 'info.main' }} />
                Performance Overview
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                    <Typography variant="body2">Task Completion</Typography>
                    <Chip 
                      label={`${metrics.basic.performance.completionRate}%`}
                      color={getProgressColor(parseFloat(metrics.basic.performance.completionRate))}
                      size="small"
                    />
                  </Box>
                  <LinearProgress
                    variant="determinate"
                    value={parseFloat(metrics.basic.performance.completionRate)}
                    color={getProgressColor(parseFloat(metrics.basic.performance.completionRate))}
                    sx={{ height: 8, borderRadius: 4 }}
                  />
                </Grid>

                <Grid item xs={12}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                    <Typography variant="body2">Department Efficiency</Typography>
                    <Chip 
                      label={`${metrics.basic.performance.efficiency.toFixed(1)}%`}
                      color={getProgressColor(metrics.basic.performance.efficiency)}
                      size="small"
                    />
                  </Box>
                  <LinearProgress
                    variant="determinate"
                    value={Math.min(metrics.basic.performance.efficiency, 100)}
                    color={getProgressColor(metrics.basic.performance.efficiency)}
                    sx={{ height: 8, borderRadius: 4 }}
                  />
                </Grid>

                <Grid item xs={12}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                    <Typography variant="body2">Staff Occupancy</Typography>
                    <Chip 
                      label={`${metrics.basic.staffing.occupancyRate}%`}
                      color={getProgressColor(parseFloat(metrics.basic.staffing.occupancyRate))}
                      size="small"
                    />
                  </Box>
                  <LinearProgress
                    variant="determinate"
                    value={parseFloat(metrics.basic.staffing.occupancyRate)}
                    color={getProgressColor(parseFloat(metrics.basic.staffing.occupancyRate))}
                    sx={{ height: 8, borderRadius: 4 }}
                  />
                </Grid>
              </Grid>
            </Paper>
          </Grid>

          {/* Staffing Metrics */}
          <Grid item xs={12} md={4}>
            <Paper sx={{ p: 2, textAlign: 'center' }}>
              <PeopleIcon sx={{ fontSize: 40, color: 'primary.main', mb: 1 }} />
              <Typography variant="h4" color="primary.main">
                {metrics.basic.staffing.currentStaff}
              </Typography>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Current Staff
              </Typography>
              <Typography variant="caption" color="text.secondary">
                of {metrics.basic.staffing.totalPositions} positions
              </Typography>
            </Paper>
          </Grid>

          {/* Task Metrics */}
          <Grid item xs={12} md={4}>
            <Paper sx={{ p: 2, textAlign: 'center' }}>
              <TaskIcon sx={{ fontSize: 40, color: 'info.main', mb: 1 }} />
              <Typography variant="h4" color="info.main">
                {formatNumber(metrics.basic.performance.totalTasks)}
              </Typography>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Total Tasks
              </Typography>
              <Typography variant="caption" color="text.secondary">
                avg completion: {metrics.basic.performance.avgCompletionTime}h
              </Typography>
            </Paper>
          </Grid>

          {/* Financial Metrics */}
          <Grid item xs={12} md={4}>
            <Paper sx={{ p: 2, textAlign: 'center' }}>
              <MoneyIcon sx={{ fontSize: 40, color: 'success.main', mb: 1 }} />
              <Typography variant="h4" color="success.main">
                {formatCurrency(metrics.basic.financial.totalRevenue)}
              </Typography>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Revenue Generated
              </Typography>
              <Typography variant="caption" color="text.secondary">
                budget utilized: {metrics.basic.financial.budgetUtilization}%
              </Typography>
            </Paper>
          </Grid>

          {/* Trends */}
          <Grid item xs={12}>
            <Paper sx={{ p: 2 }}>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
                <TimelineIcon sx={{ mr: 1, color: 'secondary.main' }} />
                Performance Trends
              </Typography>
              <Grid container spacing={3}>
                <Grid item xs={12} md={4}>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Box>
                      <Typography variant="body2" color="text.secondary">
                        Efficiency Trend
                      </Typography>
                      <Typography variant="h6">
                        {metrics.trends.efficiency.toFixed(1)}%
                      </Typography>
                    </Box>
                    {getTrendIcon(metrics.trends.efficiency)}
                  </Box>
                </Grid>
                <Grid item xs={12} md={4}>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Box>
                      <Typography variant="body2" color="text.secondary">
                        Completion Rate
                      </Typography>
                      <Typography variant="h6">
                        {metrics.trends.completionRate}%
                      </Typography>
                    </Box>
                    {getTrendIcon(parseFloat(metrics.trends.completionRate))}
                  </Box>
                </Grid>
                <Grid item xs={12} md={4}>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Box>
                      <Typography variant="body2" color="text.secondary">
                        Budget Utilization
                      </Typography>
                      <Typography variant="h6">
                        {metrics.trends.budgetUtilization}%
                      </Typography>
                    </Box>
                    {getTrendIcon(parseFloat(metrics.trends.budgetUtilization))}
                  </Box>
                </Grid>
              </Grid>
            </Paper>
          </Grid>
        </Grid>

        <Menu
          anchorEl={anchorEl}
          open={Boolean(anchorEl)}
          onClose={handleMenuClose}
          onClick={handleMenuClose}
        >
          <MenuItem onClick={loadMetrics}>
            <RefreshIcon sx={{ mr: 1, fontSize: 20 }} />
            Refresh Data
          </MenuItem>
        </Menu>
      </CardContent>
    </Card>
  );
};

export default DepartmentMetrics;