import React, { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Typography,
  Tabs,
  Tab,
  Paper,
  Button,
  Card,
  CardContent,
  Grid,
  Chip,
  Avatar,
  IconButton,
  Menu,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  Switch,
  FormControlLabel,
  Alert,
  CircularProgress,
  Divider
} from '@mui/material';
import {
  Add as AddIcon,
  MoreVert as MoreVertIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Schedule as ScheduleIcon,
  Assessment as AssessmentIcon,
  Hotel as HotelIcon,
  People as PeopleIcon,
  TrendingUp as TrendingUpIcon,
  CalendarToday as CalendarTodayIcon,
  AccessTime as AccessTimeIcon,
  AttachMoney as AttachMoneyIcon
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import SlotManager from '../../components/admin/SlotManager';
import DayUseBookingsTable from '../../components/admin/DayUseBookingsTable';
import DayUseAnalytics from '../../components/admin/DayUseAnalytics';
import { api } from '../../services/api';
import { toast } from 'react-toastify';
import { useProperty } from '../../context/PropertyContext';
import { PropertyBreadcrumb } from '../../components/common/PropertyBreadcrumb';
import { withErrorBoundary } from '../../components/ErrorBoundary';

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
      id={`day-use-tabpanel-${index}`}
      aria-labelledby={`day-use-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

function a11yProps(index: number) {
  return {
    id: `day-use-tab-${index}`,
    'aria-controls': `day-use-tabpanel-${index}`,
  };
}

const AdminDayUseManagement: React.FC = () => {
  const { selectedPropertyId, selectedProperty, viewMode } = useProperty();
  const [tabValue, setTabValue] = useState(0);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [slots, setSlots] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [todaySchedule, setTodaySchedule] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Quick stats state
  const [quickStats, setQuickStats] = useState({
    totalSlots: 0,
    activeBookings: 0,
    todayRevenue: 0,
    occupancyRate: 0
  });

  useEffect(() => {
    if (selectedPropertyId || viewMode === 'portfolio') {
      fetchData();
      fetchTodaySchedule();
      fetchQuickStats();
    }
  }, [selectedDate, selectedPropertyId]);

  const fetchData = async () => {
    if (!selectedPropertyId && viewMode === 'single') return;

    setLoading(true);
    setError(null);
    try {
      const [slotsRes, bookingsRes] = await Promise.all([
        api.get('/day-use/slots', { params: { propertyId: selectedPropertyId } }),
        api.get('/day-use/bookings', {
          params: {
            propertyId: selectedPropertyId,
            startDate: selectedDate.toISOString().split('T')[0],
            endDate: selectedDate.toISOString().split('T')[0]
          }
        })
      ]);

      setSlots(slotsRes.data.data);
      setBookings(bookingsRes.data.data.bookings);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } }; message?: string };
      setError(axiosErr.response?.data?.message || 'Failed to fetch data');
      toast.error('Failed to load day use data');
    } finally {
      setLoading(false);
    }
  };

  const fetchTodaySchedule = async () => {
    try {
      const response = await api.get('/day-use/schedule/today', {
        params: { propertyId: selectedPropertyId }
      });
      setTodaySchedule(response.data.data);
    } catch {
      // Error handled silently
    }
  };

  const fetchQuickStats = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const [revenueRes, occupancyRes] = await Promise.all([
        api.get('/day-use/analytics/revenue', {
          params: { propertyId: selectedPropertyId, startDate: today, endDate: today }
        }),
        api.get(`/day-use/analytics/occupancy/${today}`, {
          params: { propertyId: selectedPropertyId }
        })
      ]);

      const todayRevenue = revenueRes.data.data.revenue.reduce(
        (sum: number, item: Record<string, unknown>) => sum + ((item.totalRevenue as number) || 0), 0
      );
      
      const occupancyItems = occupancyRes.data.data.occupancy;
      const avgOccupancy = occupancyItems.length > 0
        ? occupancyItems.reduce(
            (sum: number, item: Record<string, unknown>) => sum + (item.occupancyRate as number), 0
          ) / occupancyItems.length
        : 0;

      setQuickStats({
        totalSlots: slots.length,
        activeBookings: bookings.filter((b: Record<string, unknown>) => {
          const status = b.status as Record<string, unknown> | undefined;
          return status && ['confirmed', 'checked_in', 'in_use'].includes(status.bookingStatus as string);
        }).length,
        todayRevenue,
        occupancyRate: Math.round(avgOccupancy)
      });
    } catch {
      // Error handled silently
    }
  };

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const handleDateChange = (date: Date | null) => {
    if (date) {
      setSelectedDate(date);
    }
  };

  const handleSlotCreated = () => {
    fetchData();
    fetchQuickStats();
    toast.success('Slot created successfully');
  };

  const handleSlotUpdated = () => {
    fetchData();
    toast.success('Slot updated successfully');
  };

  const handleSlotDeleted = () => {
    fetchData();
    fetchQuickStats();
    toast.success('Slot deleted successfully');
  };

  const handleBookingUpdated = () => {
    fetchData();
    fetchTodaySchedule();
    fetchQuickStats();
  };

  const QuickStatsCard = ({ title, value, icon, color }: Record<string, unknown>) => (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Box>
            <Typography variant="h4" color={color} fontWeight="bold">
              {value}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {title}
            </Typography>
          </Box>
          <Avatar sx={{ bgcolor: color, width: 48, height: 48 }}>
            {icon}
          </Avatar>
        </Box>
      </CardContent>
    </Card>
  );

  const TodayScheduleCard = () => (
    <Card>
      <CardContent>
        <Box display="flex" alignItems="center" mb={2}>
          <ScheduleIcon color="primary" sx={{ mr: 1 }} />
          <Typography variant="h6">Today's Schedule</Typography>
        </Box>
        {todaySchedule ? (
          <Box>
            <Typography variant="body2" color="text.secondary" mb={1}>
              {todaySchedule.totalBookings} bookings scheduled
            </Typography>
            <Box maxHeight={200} overflow="auto">
              {todaySchedule.schedule.map((item: Record<string, unknown>, index: number) => (
                <Box key={`item-${index}`} display="flex" justifyContent="space-between" 
                     alignItems="center" py={1} borderBottom="1px solid #f0f0f0">
                  <Box>
                    <Typography variant="body2" fontWeight="bold">
                      {item.guestName}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {item.slotName} • {item.guestCount} guests
                    </Typography>
                  </Box>
                  <Box textAlign="right">
                    <Typography variant="body2">
                      {item.timeSlot.startTime} - {item.timeSlot.endTime}
                    </Typography>
                    <Chip 
                      size="small" 
                      label={item.status}
                      color={
                        item.status === 'confirmed' ? 'primary' :
                        item.status === 'checked_in' ? 'success' :
                        item.status === 'in_use' ? 'info' : 'default'
                      }
                    />
                  </Box>
                </Box>
              ))}
            </Box>
          </Box>
        ) : (
          <Typography variant="body2" color="text.secondary">
            No bookings for today
          </Typography>
        )}
      </CardContent>
    </Card>
  );

  if (!selectedPropertyId && viewMode === 'single') {
    return (
      <Container maxWidth="xl" sx={{ py: 3 }}>
        <PropertyBreadcrumb items={['Day Use Management']} />
        <Box display="flex" flexDirection="column" alignItems="center" justifyContent="center" minHeight="400px">
          <ScheduleIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
          <Typography variant="h6" color="text.secondary">No Property Selected</Typography>
          <Typography variant="body2" color="text.disabled">
            Please select a property to view day use management.
          </Typography>
        </Box>
      </Container>
    );
  }

  if (loading && slots.length === 0) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Container maxWidth="xl" sx={{ py: 3 }}>
        <PropertyBreadcrumb items={['Day Use Management']} />
        {/* Header */}
        <Box mb={4}>
          <Typography variant="h4" component="h1" fontWeight="bold" mb={1}>
            Day Use Management
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Manage day use slots, bookings, and analytics
          </Typography>
        </Box>

        {/* Quick Stats */}
        <Grid container spacing={3} mb={4}>
          <Grid item xs={12} sm={6} md={3}>
            <QuickStatsCard
              title="Total Slots"
              value={quickStats.totalSlots}
              icon={<HotelIcon />}
              color="primary.main"
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <QuickStatsCard
              title="Active Bookings"
              value={quickStats.activeBookings}
              icon={<PeopleIcon />}
              color="success.main"
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <QuickStatsCard
              title="Today's Revenue"
              value={`₹${quickStats.todayRevenue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`}
              icon={<AttachMoneyIcon />}
              color="warning.main"
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <QuickStatsCard
              title="Occupancy Rate"
              value={`${quickStats.occupancyRate}%`}
              icon={<TrendingUpIcon />}
              color="info.main"
            />
          </Grid>
        </Grid>

        <Grid container spacing={3} mb={4}>
          <Grid item xs={12} md={8}>
            {error && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {error}
              </Alert>
            )}
            
            <Paper sx={{ width: '100%' }}>
              <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
                <Tabs 
                  value={tabValue} 
                  onChange={handleTabChange}
                  variant="scrollable"
                  scrollButtons="auto"
                >
                  <Tab label="Slot Management" icon={<ScheduleIcon />} {...a11yProps(0)} />
                  <Tab label="Bookings" icon={<CalendarTodayIcon />} {...a11yProps(1)} />
                  <Tab label="Analytics" icon={<AssessmentIcon />} {...a11yProps(2)} />
                </Tabs>
              </Box>

              <TabPanel value={tabValue} index={0}>
                <SlotManager
                  slots={slots}
                  onSlotCreated={handleSlotCreated}
                  onSlotUpdated={handleSlotUpdated}
                  onSlotDeleted={handleSlotDeleted}
                />
              </TabPanel>

              <TabPanel value={tabValue} index={1}>
                <Box mb={3}>
                  <DatePicker
                    label="Select Date"
                    value={selectedDate}
                    onChange={handleDateChange}
                    renderInput={(params) => <TextField {...params} />}
                  />
                </Box>
                <DayUseBookingsTable
                  bookings={bookings}
                  selectedDate={selectedDate}
                  onBookingUpdated={handleBookingUpdated}
                  loading={loading}
                />
              </TabPanel>

              <TabPanel value={tabValue} index={2}>
                <DayUseAnalytics />
              </TabPanel>
            </Paper>
          </Grid>

          <Grid item xs={12} md={4}>
            <TodayScheduleCard />
          </Grid>
        </Grid>
      </Container>
    </LocalizationProvider>
  );
};

export default withErrorBoundary(AdminDayUseManagement);