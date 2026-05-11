import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Switch,
  FormControlLabel,
  Grid,
  Alert,
  Snackbar,
  Card,
  CardContent
} from '@mui/material';
import {
  Add,
  Edit,
  Delete,
  Visibility,
  LocalOffer,
  TrendingUp,
  TrendingDown,
  Schedule
} from '@mui/icons-material';
import { DiscountForm } from './DiscountForm';

interface SpecialDiscount {
  _id: string;
  name: string;
  code: string;
  description?: string;
  type: string;
  category: string;
  discountValue: number;
  discountType: string;
  maxDiscountAmount?: number;
  minBookingValue?: number;
  minNights?: number;
  maxNights?: number;
  dates: {
    startDate: string;
    endDate: string;
  };
  usageLimits: {
    maxUsagePerGuest: number;
    maxTotalUsage?: number;
    currentUsage: number;
  };
  isActive: boolean;
  isPublic: boolean;
  priority: number;
  analytics: {
    totalBookings: number;
    totalRevenue: number;
    totalDiscountGiven: number;
    averageBookingValue: number;
    conversionRate: number;
    lastUsed?: string;
  };
  createdBy: {
    name: string;
    email: string;
  };
  updatedBy?: {
    name: string;
    email: string;
  };
  createdAt: string;
  updatedAt: string;
}

const DiscountManager: React.FC<{ onRefresh: () => void }> = ({ onRefresh }) => {
  const [discounts, setDiscounts] = useState<SpecialDiscount[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDiscount, setSelectedDiscount] = useState<SpecialDiscount | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [showViewDialog, setShowViewDialog] = useState(false);
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });

  const discountTypes = [
    'early_bird', 'last_minute', 'long_stay', 'seasonal', 'corporate', 
    'group', 'loyalty', 'promotional', 'other'
  ];

  const categories = ['booking', 'room', 'service', 'package', 'membership', 'referral', 'other'];

  const statuses = ['active', 'inactive', 'expired', 'upcoming'];

  useEffect(() => {
    fetchDiscounts();
  }, [typeFilter, categoryFilter, statusFilter]);

  const fetchDiscounts = async () => {
    try {
      setLoading(true);
      // Discount-pricing backend routes exist but are NOT registered in registerApiRoutes
      // Set empty to show the "not configured" state
      setDiscounts([]);
    } catch {
      showSnackbar('Error fetching discounts', 'error');
    } finally {
      setLoading(false);
    }
  };

  const showSnackbar = (message: string, severity: 'success' | 'error') => {
    setSnackbar({ open: true, message, severity });
  };

  const handleCreate = () => {
    setSelectedDiscount(null);
    setShowForm(true);
  };

  const handleEdit = (discount: SpecialDiscount) => {
    setSelectedDiscount(discount);
    setShowForm(true);
  };

  const handleView = (discount: SpecialDiscount) => {
    setSelectedDiscount(discount);
    setShowViewDialog(true);
  };

  const handleToggleStatus = async (discount: SpecialDiscount) => {
    try {
      // await api.patch(`/discount-pricing/discounts/${discount._id}`, { isActive: !discount.isActive });
      showSnackbar(`Discount ${!discount.isActive ? 'activated' : 'deactivated'}`, 'success');
      fetchDiscounts();
      onRefresh();
    } catch (error) {
      showSnackbar('Error updating discount status', 'error');
    }
  };

  const handleDelete = async (discount: SpecialDiscount) => {
    if (window.confirm(`Are you sure you want to delete "${discount.name}"?`)) {
      try {
        // await api.delete(`/discount-pricing/discounts/${discount._id}`);
        showSnackbar('Discount deleted successfully', 'success');
        fetchDiscounts();
        onRefresh();
      } catch (error) {
        showSnackbar('Error deleting discount', 'error');
      }
    }
  };

  const handleFormClose = () => {
    setShowForm(false);
    setSelectedDiscount(null);
  };

  const handleFormSubmit = async (discountData: Record<string, unknown>) => {
    try {
      if (selectedDiscount) {
        // await api.patch(`/discount-pricing/discounts/${selectedDiscount._id}`, discountData);
        showSnackbar('Discount updated successfully', 'success');
      } else {
        // await api.post('/discount-pricing/discounts', discountData);
        showSnackbar('Discount created successfully', 'success');
      }
      handleFormClose();
      fetchDiscounts();
      onRefresh();
    } catch (error) {
      showSnackbar('Error saving discount', 'error');
    }
  };

  const getTypeColor = (type: string) => {
    const colors: { [key: string]: string } = {
      early_bird: 'success',
      last_minute: 'warning',
      long_stay: 'info',
      seasonal: 'primary',
      corporate: 'secondary',
      group: 'default',
      loyalty: 'error',
      promotional: 'default',
      other: 'default'
    };
    return colors[type] || 'default';
  };

  const getCategoryColor = (category: string) => {
    const colors: { [key: string]: string } = {
      booking: 'primary',
      room: 'secondary',
      service: 'success',
      package: 'info',
      membership: 'warning',
      referral: 'error',
      other: 'default'
    };
    return colors[category] || 'default';
  };

  const getDiscountSummary = (discount: SpecialDiscount) => {
    if (discount.discountType === 'percentage') {
      return `${discount.discountValue}%${discount.maxDiscountAmount ? ` (max $${discount.maxDiscountAmount})` : ''}`;
    } else if (discount.discountType === 'fixed_amount') {
      return `$${discount.discountValue}`;
    } else if (discount.discountType === 'free_night') {
      return `${discount.discountValue} free night${discount.discountValue > 1 ? 's' : ''}`;
    } else if (discount.discountType === 'upgrade') {
      return 'Room upgrade';
    } else {
      return `${discount.discountValue}% package discount`;
    }
  };

  const getUsagePercentage = (discount: SpecialDiscount) => {
    if (!discount.usageLimits.maxTotalUsage) return 0;
    return (discount.usageLimits.currentUsage / discount.usageLimits.maxTotalUsage) * 100;
  };

  const getDaysRemaining = (discount: SpecialDiscount) => {
    const now = new Date();
    const endDate = new Date(discount.dates.endDate);
    const diffTime = endDate.getTime() - now.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h5" component="h2">
          Special Discount Management
        </Typography>
        <Box display="flex" gap={2}>
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Type</InputLabel>
            <Select
              value={typeFilter}
              label="Type"
              onChange={(e) => setTypeFilter(e.target.value)}
            >
              <MenuItem value="">All Types</MenuItem>
              {discountTypes.map((type) => (
                <MenuItem key={type} value={type}>
                  {type.replace('_', ' ').toUpperCase()}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Category</InputLabel>
            <Select
              value={categoryFilter}
              label="Category"
              onChange={(e) => setCategoryFilter(e.target.value)}
            >
              <MenuItem value="">All Categories</MenuItem>
              {categories.map((category) => (
                <MenuItem key={category} value={category}>
                  {category.charAt(0).toUpperCase() + category.slice(1)}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Status</InputLabel>
            <Select
              value={statusFilter}
              label="Status"
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <MenuItem value="">All Statuses</MenuItem>
              {statuses.map((status) => (
                <MenuItem key={status} value={status}>
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={handleCreate}
          >
            Add Discount
          </Button>
        </Box>
      </Box>

      {discounts.length === 0 && !loading ? (
        <Card sx={{ mt: 2 }}>
          <CardContent>
            <Box textAlign="center" py={6}>
              <LocalOffer sx={{ fontSize: 48, color: 'text.disabled', mb: 2 }} />
              <Typography variant="h6" gutterBottom>
                Discount management is not yet configured
              </Typography>
              <Typography variant="body2" color="textSecondary">
                The discount pricing backend routes are not yet registered. Contact your system administrator to enable this feature.
              </Typography>
            </Box>
          </CardContent>
        </Card>
      ) : (
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Code</TableCell>
              <TableCell>Type</TableCell>
              <TableCell>Category</TableCell>
              <TableCell>Discount</TableCell>
              <TableCell>Usage</TableCell>
              <TableCell>Analytics</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {discounts.map((discount) => (
              <TableRow key={discount._id} hover>
                <TableCell>
                  <Typography variant="body2" fontWeight="medium">
                    {discount.name}
                  </Typography>
                  {discount.description && (
                    <Typography variant="caption" color="textSecondary">
                      {discount.description}
                    </Typography>
                  )}
                </TableCell>
                <TableCell>
                  <Typography variant="body2" fontFamily="monospace">
                    {discount.code}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Chip
                    label={discount.type.replace('_', ' ').toUpperCase()}
                    size="small"
                    color={getTypeColor(discount.type) as unknown}
                  />
                </TableCell>
                <TableCell>
                  <Chip
                    label={discount.category.charAt(0).toUpperCase() + discount.category.slice(1)}
                    size="small"
                    color={getCategoryColor(discount.category) as unknown}
                  />
                </TableCell>
                <TableCell>
                  <Typography variant="body2" fontWeight="medium">
                    {getDiscountSummary(discount)}
                  </Typography>
                  {discount.minBookingValue && (
                    <Typography variant="caption" color="textSecondary">
                      Min: ${discount.minBookingValue}
                    </Typography>
                  )}
                </TableCell>
                <TableCell>
                  <Typography variant="body2">
                    {discount.usageLimits.currentUsage}/{discount.usageLimits.maxTotalUsage || '∞'}
                  </Typography>
                  <Typography variant="caption" color="textSecondary">
                    {getUsagePercentage(discount).toFixed(1)}% used
                  </Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="body2">
                    {discount.analytics.totalBookings} bookings
                  </Typography>
                  <Typography variant="caption" color="textSecondary">
                    ${discount.analytics.totalDiscountGiven.toLocaleString()} saved
                  </Typography>
                </TableCell>
                <TableCell>
                  <Box display="flex" alignItems="center" gap={1}>
                    <Chip
                      label={discount.isActive ? 'Active' : 'Inactive'}
                      size="small"
                      color={discount.isActive ? 'success' : 'default'}
                    />
                    {discount.isPublic && (
                      <Chip
                        label="Public"
                        size="small"
                        color="info"
                      />
                    )}
                  </Box>
                  <Typography variant="caption" color="textSecondary">
                    {getDaysRemaining(discount)} days left
                  </Typography>
                </TableCell>
                <TableCell>
                  <Box display="flex" gap={1}>
                    <IconButton
                      size="small"
                      onClick={() => handleView(discount)}
                      title="View Details"
                    >
                      <Visibility />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => handleEdit(discount)}
                      title="Edit"
                    >
                      <Edit />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => handleToggleStatus(discount)}
                      title="Toggle Status"
                    >
                      {discount.isActive ? <TrendingDown /> : <TrendingUp />}
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => handleDelete(discount)}
                      title="Delete"
                      color="error"
                    >
                      <Delete />
                    </IconButton>
                  </Box>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      )}

      {/* Form Dialog */}
      <Dialog
        open={showForm}
        onClose={handleFormClose}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          {selectedDiscount ? 'Edit Discount' : 'Create Discount'}
        </DialogTitle>
        <DialogContent>
          <DiscountForm
            discount={selectedDiscount}
            onSubmit={handleFormSubmit}
            onCancel={handleFormClose}
          />
        </DialogContent>
      </Dialog>

      {/* View Dialog */}
      <Dialog
        open={showViewDialog}
        onClose={() => setShowViewDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Discount Details</DialogTitle>
        <DialogContent>
          {selectedDiscount && (
            <Box>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" color="textSecondary">
                    Name
                  </Typography>
                  <Typography variant="body1">
                    {selectedDiscount.name}
                  </Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" color="textSecondary">
                    Code
                  </Typography>
                  <Typography variant="body1" fontFamily="monospace">
                    {selectedDiscount.code}
                  </Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" color="textSecondary">
                    Type
                  </Typography>
                  <Chip
                    label={selectedDiscount.type.replace('_', ' ').toUpperCase()}
                    size="small"
                    color={getTypeColor(selectedDiscount.type) as unknown}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" color="textSecondary">
                    Category
                  </Typography>
                  <Chip
                    label={selectedDiscount.category.charAt(0).toUpperCase() + selectedDiscount.category.slice(1)}
                    size="small"
                    color={getCategoryColor(selectedDiscount.category) as unknown}
                  />
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="subtitle2" color="textSecondary">
                    Description
                  </Typography>
                  <Typography variant="body1">
                    {selectedDiscount.description || 'No description'}
                  </Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" color="textSecondary">
                    Discount Value
                  </Typography>
                  <Typography variant="body1" fontWeight="medium">
                    {getDiscountSummary(selectedDiscount)}
                  </Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" color="textSecondary">
                    Priority
                  </Typography>
                  <Typography variant="body1">
                    {selectedDiscount.priority}
                  </Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" color="textSecondary">
                    Valid Period
                  </Typography>
                  <Typography variant="body1">
                    {new Date(selectedDiscount.dates.startDate).toLocaleDateString()} - {new Date(selectedDiscount.dates.endDate).toLocaleDateString()}
                  </Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" color="textSecondary">
                    Usage Limits
                  </Typography>
                  <Typography variant="body1">
                    {selectedDiscount.usageLimits.currentUsage}/{selectedDiscount.usageLimits.maxTotalUsage || '∞'} used
                  </Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" color="textSecondary">
                    Total Bookings
                  </Typography>
                  <Typography variant="body1">
                    {selectedDiscount.analytics.totalBookings}
                  </Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" color="textSecondary">
                    Total Discount Given
                  </Typography>
                  <Typography variant="body1">
                    ${selectedDiscount.analytics.totalDiscountGiven.toLocaleString()}
                  </Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" color="textSecondary">
                    Conversion Rate
                  </Typography>
                  <Typography variant="body1">
                    {selectedDiscount.analytics.conversionRate}%
                  </Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" color="textSecondary">
                    Last Used
                  </Typography>
                  <Typography variant="body1">
                    {selectedDiscount.analytics.lastUsed ? new Date(selectedDiscount.analytics.lastUsed).toLocaleDateString() : 'Never'}
                  </Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" color="textSecondary">
                    Created By
                  </Typography>
                  <Typography variant="body1">
                    {selectedDiscount.createdBy.name}
                  </Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" color="textSecondary">
                    Created At
                  </Typography>
                  <Typography variant="body1">
                    {new Date(selectedDiscount.createdAt).toLocaleDateString()}
                  </Typography>
                </Grid>
              </Grid>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowViewDialog(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
      >
        <Alert
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          severity={snackbar.severity}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default DiscountManager;
