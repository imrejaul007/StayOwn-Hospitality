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
  Avatar,
  IconButton,
  Tooltip,
  Alert,
  CircularProgress,
  Divider
} from '@mui/material';
import {
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  TrendingFlat as TrendingFlatIcon,
  Assessment as AssessmentIcon,
  People as PeopleIcon,
  AttachMoney as AttachMoneyIcon,
  Hotel as HotelIcon,
  Schedule as ScheduleIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Legend
} from 'recharts';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { format, subDays, startOfMonth, endOfMonth } from 'date-fns';
import axios from 'axios';
import { toast } from 'react-toastify';

interface AnalyticsData {
  overview: {
    totalBookings: number;
    confirmedBookings: number;
    cancelledBookings: number;
    totalRevenue: number;
    totalGuests: number;
  };
  byRoomType: Record<string, {
    totalBookings: number;
    totalRevenue: number;
    totalGuests: number;
  }>;
  byTimeSlot: Record<string, {
    totalBookings: number;
    totalRevenue: number;
    totalGuests: number;
  }>;
  bySource: Record<string, {
    totalBookings: number;
    totalRevenue: number;
    totalGuests: number;
  }>;
  trends: {
    bookingsTrend: string;
    revenueTrend: string;
    occupancyTrend: string;
  };
}

interface RevenueData {
  date: string;
  totalRevenue: number;
  totalBookings: number;
  averageRevenue: number;
}

interface OccupancyData {
  slot: {
    slotName: string;
    roomType: string;
    timeSlot: {
      startTime: string;
      endTime: string;
    };
    maxCapacity: number;
  };
  bookingCount: number;
  totalGuests: number;
  totalRevenue: number;
  occupancyRate: number;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D'];

const DayUseAnalytics: React.FC = () => {
  const [dateRange, setDateRange] = useState({
    start: startOfMonth(new Date()),
    end: endOfMonth(new Date())
  });
  const [selectedPeriod, setSelectedPeriod] = useState('thisMonth');
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [revenueData, setRevenueData] = useState<RevenueData[]>([]);
  const [occupancyData, setOccupancyData] = useState<OccupancyData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const periodOptions = [
    { value: 'today', label: 'Today' },
    { value: 'yesterday', label: 'Yesterday' },
    { value: 'last7days', label: 'Last 7 Days' },
    { value: 'thisMonth', label: 'This Month' },
    { value: 'lastMonth', label: 'Last Month' },
    { value: 'custom', label: 'Custom Range' }
  ];

  useEffect(() => {
    updateDateRangeFromPeriod(selectedPeriod);
  }, [selectedPeriod]);

  useEffect(() => {
    if (dateRange.start && dateRange.end) {
      fetchAnalytics();
    }
  }, [dateRange]);

  const updateDateRangeFromPeriod = (period: string) => {
    const today = new Date();
    let start: Date, end: Date;

    switch (period) {
      case 'today':
        start = end = today;
        break;
      case 'yesterday':
        start = end = subDays(today, 1);
        break;
      case 'last7days':
        start = subDays(today, 6);
        end = today;
        break;
      case 'thisMonth':
        start = startOfMonth(today);
        end = endOfMonth(today);
        break;
      case 'lastMonth':
        const lastMonth = subDays(startOfMonth(today), 1);
        start = startOfMonth(lastMonth);
        end = endOfMonth(lastMonth);
        break;
      default:
        return; // Custom range - don't update
    }

    setDateRange({ start, end });
  };

  const fetchAnalytics = async () => {
    setLoading(true);
    setError(null);

    try {
      const startDate = format(dateRange.start, 'yyyy-MM-dd');
      const endDate = format(dateRange.end, 'yyyy-MM-dd');

      const [analyticsRes, revenueRes] = await Promise.all([
        axios.get('/api/v1/day-use/analytics', {
          params: { startDate, endDate }
        }),
        axios.get('/api/v1/day-use/analytics/revenue', {
          params: { startDate, endDate }
        })
      ]);

      setAnalytics(analyticsRes.data.data);
      setRevenueData(revenueRes.data.data.revenue);

      // Fetch today's occupancy data for slot performance
      const todayOccupancyRes = await axios.get(
        `/api/v1/day-use/analytics/occupancy/${format(new Date(), 'yyyy-MM-dd')}`
      );
      setOccupancyData(todayOccupancyRes.data.data.occupancy);

    } catch (err: unknown) {
      setError(err.response?.data?.message || 'Failed to fetch analytics');
      toast.error('Failed to load analytics data');
    } finally {
      setLoading(false);
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'increasing':
        return <TrendingUpIcon color="success" />;
      case 'decreasing':
        return <TrendingDownIcon color="error" />;
      default:
        return <TrendingFlatIcon color="warning" />;
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const MetricCard = ({ title, value, subtitle, icon, trend, color }: Record<string, unknown>) => (
    <Card>
      <CardContent>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Box>
            <Typography variant="h4" color={color} fontWeight="bold">
              {value}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {title}
            </Typography>
            {subtitle && (
              <Typography variant="caption" color="text.secondary">
                {subtitle}
              </Typography>
            )}
          </Box>
          <Box display="flex" flexDirection="column" alignItems="center">
            <Avatar sx={{ bgcolor: color, width: 48, height: 48, mb: 1 }}>
              {icon}
            </Avatar>
            {trend && getTrendIcon(trend)}
          </Box>
        </Box>
      </CardContent>
    </Card>
  );

  const prepareRevenueChartData = () => {
    return revenueData.map(item => ({
      date: format(new Date(item.date), 'MMM dd'),
      revenue: item.totalRevenue,
      bookings: item.totalBookings,
      average: item.averageRevenue
    }));
  };

  const prepareRoomTypeData = () => {
    if (!analytics) return [];
    
    return Object.entries(analytics.byRoomType).map(([roomType, data]) => ({
      name: roomType,
      bookings: data.totalBookings,
      revenue: data.totalRevenue,
      guests: data.totalGuests
    }));
  };

  const prepareTimeSlotData = () => {
    if (!analytics) return [];
    
    return Object.entries(analytics.byTimeSlot).map(([timeSlot, data]) => ({
      name: timeSlot,
      bookings: data.totalBookings,
      revenue: data.totalRevenue
    }));
  };

  const prepareSourceData = () => {
    if (!analytics) return [];
    
    return Object.entries(analytics.bySource).map(([source, data], index) => ({
      name: source.charAt(0).toUpperCase() + source.slice(1),
      value: data.totalBookings,
      revenue: data.totalRevenue,
      color: COLORS[index % COLORS.length]
    }));
  };

  if (loading && !analytics) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Box>
        {/* Header Controls */}
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={4}>
          <Typography variant="h6">Day Use Analytics</Typography>
          <Box display="flex" gap={2} alignItems="center">
            <FormControl size="small" sx={{ minWidth: 150 }}>
              <InputLabel>Time Period</InputLabel>
              <Select
                value={selectedPeriod}
                label="Time Period"
                onChange={(e) => setSelectedPeriod(e.target.value)}
              >
                {periodOptions.map(option => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {selectedPeriod === 'custom' && (
              <>
                <DatePicker
                  label="Start Date"
                  value={dateRange.start}
                  onChange={(date) => date && setDateRange(prev => ({ ...prev, start: date }))}
                  renderInput={(params) => <TextField {...params} size="small" />}
                />
                <DatePicker
                  label="End Date"
                  value={dateRange.end}
                  onChange={(date) => date && setDateRange(prev => ({ ...prev, end: date }))}
                  renderInput={(params) => <TextField {...params} size="small" />}
                />
              </>
            )}

            <Tooltip title="Refresh Data">
              <IconButton onClick={fetchAnalytics} disabled={loading}>
                <RefreshIcon />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        {analytics && (
          <>
            {/* Overview Metrics */}
            <Grid container spacing={3} mb={4}>
              <Grid item xs={12} sm={6} md={3}>
                <MetricCard
                  title="Total Bookings"
                  value={analytics.overview.totalBookings}
                  subtitle={`${analytics.overview.confirmedBookings} confirmed`}
                  icon={<AssessmentIcon />}
                  trend={analytics.trends.bookingsTrend}
                  color="primary.main"
                />
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <MetricCard
                  title="Total Revenue"
                  value={formatCurrency(analytics.overview.totalRevenue)}
                  subtitle={`${analytics.overview.cancelledBookings} cancelled`}
                  icon={<AttachMoneyIcon />}
                  trend={analytics.trends.revenueTrend}
                  color="success.main"
                />
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <MetricCard
                  title="Total Guests"
                  value={analytics.overview.totalGuests}
                  subtitle={`Avg: ${Math.round(analytics.overview.totalGuests / Math.max(analytics.overview.totalBookings, 1))} per booking`}
                  icon={<PeopleIcon />}
                  trend={analytics.trends.occupancyTrend}
                  color="info.main"
                />
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <MetricCard
                  title="Avg Revenue"
                  value={formatCurrency(analytics.overview.totalRevenue / Math.max(analytics.overview.totalBookings, 1))}
                  subtitle="Per booking"
                  icon={<TrendingUpIcon />}
                  color="warning.main"
                />
              </Grid>
            </Grid>

            <Grid container spacing={3}>
              {/* Revenue Trend Chart */}
              <Grid item xs={12} lg={8}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" mb={3}>Revenue Trend</Typography>
                    <Box height={300}>
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={prepareRevenueChartData()}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="date" />
                          <YAxis />
                          <RechartsTooltip 
                            formatter={(value: Record<string, unknown>, name: string) => [
                              name === 'revenue' ? formatCurrency(value) : value,
                              name === 'revenue' ? 'Revenue' : 'Bookings'
                            ]}
                          />
                          <Line 
                            type="monotone" 
                            dataKey="revenue" 
                            stroke="#8884d8" 
                            strokeWidth={2}
                          />
                          <Line 
                            type="monotone" 
                            dataKey="bookings" 
                            stroke="#82ca9d"
                            strokeWidth={2}
                            yAxisId="right"
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>

              {/* Booking Sources */}
              <Grid item xs={12} lg={4}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" mb={3}>Booking Sources</Typography>
                    <Box height={300}>
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={prepareSourceData()}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={100}
                            dataKey="value"
                          >
                            {prepareSourceData().map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <RechartsTooltip 
                            formatter={(value: Record<string, unknown>, name: string, props: Record<string, unknown>) => [
                              value,
                              `${props.payload.name} (${formatCurrency(props.payload.revenue)})`
                            ]}
                          />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>

              {/* Room Type Performance */}
              <Grid item xs={12}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" mb={3}>Performance by Room Type</Typography>
                    <Box height={300}>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={prepareRoomTypeData()}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="name" />
                          <YAxis />
                          <RechartsTooltip 
                            formatter={(value: Record<string, unknown>, name: string) => [
                              name === 'revenue' ? formatCurrency(value) : value,
                              name === 'revenue' ? 'Revenue' : name === 'bookings' ? 'Bookings' : 'Guests'
                            ]}
                          />
                          <Bar dataKey="bookings" fill="#8884d8" />
                          <Bar dataKey="revenue" fill="#82ca9d" />
                        </BarChart>
                      </ResponsiveContainer>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>

              {/* Today's Slot Occupancy */}
              <Grid item xs={12}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" mb={3}>Today's Slot Occupancy</Typography>
                    {occupancyData.length > 0 ? (
                      <TableContainer>
                        <Table>
                          <TableHead>
                            <TableRow>
                              <TableCell>Slot</TableCell>
                              <TableCell>Time</TableCell>
                              <TableCell>Room Type</TableCell>
                              <TableCell>Bookings</TableCell>
                              <TableCell>Guests</TableCell>
                              <TableCell>Occupancy</TableCell>
                              <TableCell>Revenue</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {occupancyData.map((slot, index) => (
                              <TableRow key={`occupancyData-${index}`}>
                                <TableCell>
                                  <Typography variant="body2" fontWeight="bold">
                                    {slot.slot?.slotName || 'Unknown Slot'}
                                  </Typography>
                                </TableCell>
                                <TableCell>
                                  <Typography variant="body2">
                                    {slot.slot?.timeSlot?.startTime} - {slot.slot?.timeSlot?.endTime}
                                  </Typography>
                                </TableCell>
                                <TableCell>
                                  <Typography variant="body2">
                                    {slot.slot?.roomType}
                                  </Typography>
                                </TableCell>
                                <TableCell>{slot.bookingCount}</TableCell>
                                <TableCell>{slot.totalGuests}</TableCell>
                                <TableCell>
                                  <Box display="flex" alignItems="center" gap={1}>
                                    <LinearProgress
                                      variant="determinate"
                                      value={slot.occupancyRate}
                                      sx={{ width: 60, height: 8, borderRadius: 4 }}
                                      color={
                                        slot.occupancyRate > 80 ? 'error' :
                                        slot.occupancyRate > 60 ? 'warning' : 'primary'
                                      }
                                    />
                                    <Typography variant="body2">
                                      {slot.occupancyRate}%
                                    </Typography>
                                  </Box>
                                </TableCell>
                                <TableCell>
                                  <Typography variant="body2" fontWeight="bold">
                                    {formatCurrency(slot.totalRevenue)}
                                  </Typography>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </TableContainer>
                    ) : (
                      <Typography variant="body2" color="text.secondary" textAlign="center" py={4}>
                        No occupancy data available for today
                      </Typography>
                    )}
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          </>
        )}

        {loading && (
          <Box display="flex" justifyContent="center" py={2}>
            <CircularProgress size={24} />
          </Box>
        )}
      </Box>
    </LocalizationProvider>
  );
};

export default DayUseAnalytics;