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
  CardContent,
  CircularProgress,
  InputAdornment
} from '@mui/material';
import {
  Add,
  Edit,
  Delete,
  Visibility,
  TrendingUp,
  TrendingDown,
  Search as SearchIcon,
  AttachMoney
} from '@mui/icons-material';
import { api } from '../../services/api';

interface DynamicPricingRule {
  _id: string;
  name: string;
  algorithm: string;
  description?: string;
  targetRoomTypes: string[];
  basePrice: number;
  minPrice: number;
  maxPrice: number;
  adjustmentPercentage: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface PricingFormData {
  name: string;
  algorithm: string;
  description: string;
  targetRoomTypes: string;
  basePrice: number;
  minPrice: number;
  maxPrice: number;
  adjustmentPercentage: number;
  isActive: boolean;
}

const emptyForm: PricingFormData = {
  name: '',
  algorithm: 'demand_based',
  description: '',
  targetRoomTypes: '',
  basePrice: 0,
  minPrice: 0,
  maxPrice: 0,
  adjustmentPercentage: 0,
  isActive: true,
};

const algorithmTypes = [
  'demand_based',
  'competitor_based',
  'time_based',
  'event_based',
  'seasonal',
  'occupancy_based',
  'hybrid',
];

const PricingManager: React.FC<{ onRefresh: () => void }> = ({ onRefresh }) => {
  const [rules, setRules] = useState<DynamicPricingRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRule, setSelectedRule] = useState<DynamicPricingRule | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [showViewDialog, setShowViewDialog] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [algorithmFilter, setAlgorithmFilter] = useState<string>('');
  const [formData, setFormData] = useState<PricingFormData>(emptyForm);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });

  useEffect(() => {
    fetchRules();
  }, [algorithmFilter]);

  const fetchRules = async () => {
    try {
      setLoading(true);
      const params: Record<string, string> = {};
      if (algorithmFilter) params.algorithm = algorithmFilter;
      const response = await api.get('/discount-pricing/pricing', { params });
      const data = response.data?.data || response.data;
      const list = Array.isArray(data) ? data : (data?.rules || data?.pricing || []);
      setRules(list);
    } catch {
      setRules([]);
    } finally {
      setLoading(false);
    }
  };

  const showSnackbar = (message: string, severity: 'success' | 'error') => {
    setSnackbar({ open: true, message, severity });
  };

  const handleCreate = () => {
    setSelectedRule(null);
    setFormData(emptyForm);
    setShowForm(true);
  };

  const handleEdit = (rule: DynamicPricingRule) => {
    setSelectedRule(rule);
    setFormData({
      name: rule.name,
      algorithm: rule.algorithm,
      description: rule.description || '',
      targetRoomTypes: (rule.targetRoomTypes || []).join(', '),
      basePrice: rule.basePrice,
      minPrice: rule.minPrice,
      maxPrice: rule.maxPrice,
      adjustmentPercentage: rule.adjustmentPercentage,
      isActive: rule.isActive,
    });
    setShowForm(true);
  };

  const handleView = (rule: DynamicPricingRule) => {
    setSelectedRule(rule);
    setShowViewDialog(true);
  };

  const handleToggleStatus = async (rule: DynamicPricingRule) => {
    try {
      await api.patch(`/discount-pricing/pricing/${rule._id}`, { isActive: !rule.isActive });
      showSnackbar(`Pricing rule ${!rule.isActive ? 'activated' : 'deactivated'}`, 'success');
      fetchRules();
      onRefresh();
    } catch {
      showSnackbar('Error updating pricing rule status', 'error');
    }
  };

  const handleDelete = async (rule: DynamicPricingRule) => {
    if (window.confirm(`Are you sure you want to delete "${rule.name}"?`)) {
      try {
        await api.delete(`/discount-pricing/pricing/${rule._id}`);
        showSnackbar('Pricing rule deleted successfully', 'success');
        fetchRules();
        onRefresh();
      } catch {
        showSnackbar('Error deleting pricing rule', 'error');
      }
    }
  };

  const handleFormClose = () => {
    setShowForm(false);
    setSelectedRule(null);
    setFormData(emptyForm);
  };

  const handleFormSubmit = async () => {
    try {
      const payload = {
        ...formData,
        targetRoomTypes: formData.targetRoomTypes
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
      };
      if (selectedRule) {
        await api.patch(`/discount-pricing/pricing/${selectedRule._id}`, payload);
        showSnackbar('Pricing rule updated successfully', 'success');
      } else {
        await api.post('/discount-pricing/pricing', payload);
        showSnackbar('Pricing rule created successfully', 'success');
      }
      handleFormClose();
      fetchRules();
      onRefresh();
    } catch {
      showSnackbar('Error saving pricing rule', 'error');
    }
  };

  const getAlgorithmColor = (algorithm: string) => {
    const colors: { [key: string]: string } = {
      demand_based: 'primary',
      competitor_based: 'secondary',
      time_based: 'info',
      event_based: 'warning',
      seasonal: 'success',
      occupancy_based: 'error',
      hybrid: 'default',
    };
    return colors[algorithm] || 'default';
  };

  const formatLabel = (value: string) =>
    value
      .split('_')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');

  const filteredRules = rules.filter((rule) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      rule.name.toLowerCase().includes(q) ||
      rule.algorithm.toLowerCase().includes(q) ||
      (rule.description || '').toLowerCase().includes(q)
    );
  });

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h5" component="h2">
          Dynamic Pricing Management
        </Typography>
        <Box display="flex" gap={2}>
          <TextField
            size="small"
            placeholder="Search pricing rules..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
            }}
          />
          <FormControl size="small" sx={{ minWidth: 180 }}>
            <InputLabel>Algorithm Type</InputLabel>
            <Select
              value={algorithmFilter}
              label="Algorithm Type"
              onChange={(e) => setAlgorithmFilter(e.target.value)}
            >
              <MenuItem value="">All Algorithms</MenuItem>
              {algorithmTypes.map((alg) => (
                <MenuItem key={alg} value={alg}>
                  {formatLabel(alg)}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <Button variant="contained" startIcon={<Add />} onClick={handleCreate}>
            Add Pricing Rule
          </Button>
        </Box>
      </Box>

      {loading && (
        <Box display="flex" justifyContent="center" py={4}>
          <CircularProgress size={32} />
        </Box>
      )}

      {!loading && filteredRules.length === 0 && (
        <Card sx={{ mt: 2 }}>
          <CardContent>
            <Box textAlign="center" py={6}>
              <AttachMoney sx={{ fontSize: 48, color: 'text.disabled', mb: 2 }} />
              <Typography variant="h6" gutterBottom>
                No dynamic pricing rules configured
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Click &quot;Add Pricing Rule&quot; to create your first dynamic pricing rule.
              </Typography>
            </Box>
          </CardContent>
        </Card>
      )}

      {!loading && filteredRules.length > 0 && (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Algorithm Type</TableCell>
                <TableCell>Target Room Types</TableCell>
                <TableCell>Base Price</TableCell>
                <TableCell>Min / Max Price</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredRules.map((rule) => (
                <TableRow key={rule._id} hover>
                  <TableCell>
                    <Typography variant="body2" fontWeight="medium">
                      {rule.name}
                    </Typography>
                    {rule.description && (
                      <Typography variant="caption" color="textSecondary">
                        {rule.description}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={formatLabel(rule.algorithm)}
                      size="small"
                      color={getAlgorithmColor(rule.algorithm) as unknown}
                    />
                  </TableCell>
                  <TableCell>
                    <Box display="flex" flexWrap="wrap" gap={0.5}>
                      {(rule.targetRoomTypes || []).length > 0 ? (
                        rule.targetRoomTypes.map((rt) => (
                          <Chip key={rt} label={rt} size="small" variant="outlined" />
                        ))
                      ) : (
                        <Typography variant="caption" color="textSecondary">
                          All types
                        </Typography>
                      )}
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" fontWeight="medium">
                      ${rule.basePrice.toLocaleString()}
                    </Typography>
                    <Typography variant="caption" color="textSecondary">
                      {rule.adjustmentPercentage > 0 ? '+' : ''}
                      {rule.adjustmentPercentage}% adj.
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      ${rule.minPrice.toLocaleString()} - ${rule.maxPrice.toLocaleString()}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={rule.isActive ? 'Active' : 'Inactive'}
                      size="small"
                      color={rule.isActive ? 'success' : 'default'}
                    />
                  </TableCell>
                  <TableCell>
                    <Box display="flex" gap={1}>
                      <IconButton size="small" onClick={() => handleView(rule)} title="View Details">
                        <Visibility />
                      </IconButton>
                      <IconButton size="small" onClick={() => handleEdit(rule)} title="Edit">
                        <Edit />
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={() => handleToggleStatus(rule)}
                        title="Toggle Status"
                      >
                        {rule.isActive ? <TrendingDown /> : <TrendingUp />}
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={() => handleDelete(rule)}
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

      {/* Create / Edit Form Dialog */}
      <Dialog open={showForm} onClose={handleFormClose} maxWidth="md" fullWidth>
        <DialogTitle>{selectedRule ? 'Edit Pricing Rule' : 'Create Pricing Rule'}</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1 }}>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel>Algorithm</InputLabel>
                  <Select
                    value={formData.algorithm}
                    label="Algorithm"
                    onChange={(e) => setFormData({ ...formData, algorithm: e.target.value })}
                  >
                    {algorithmTypes.map((alg) => (
                      <MenuItem key={alg} value={alg}>
                        {formatLabel(alg)}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Target Room Types (comma-separated)"
                  value={formData.targetRoomTypes}
                  onChange={(e) => setFormData({ ...formData, targetRoomTypes: e.target.value })}
                  helperText="Enter room type IDs separated by commas, or leave empty for all types"
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField
                  fullWidth
                  label="Base Price"
                  type="number"
                  value={formData.basePrice}
                  onChange={(e) => setFormData({ ...formData, basePrice: Number(e.target.value) })}
                  InputProps={{
                    startAdornment: <InputAdornment position="start">$</InputAdornment>,
                  }}
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField
                  fullWidth
                  label="Min Price"
                  type="number"
                  value={formData.minPrice}
                  onChange={(e) => setFormData({ ...formData, minPrice: Number(e.target.value) })}
                  InputProps={{
                    startAdornment: <InputAdornment position="start">$</InputAdornment>,
                  }}
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField
                  fullWidth
                  label="Max Price"
                  type="number"
                  value={formData.maxPrice}
                  onChange={(e) => setFormData({ ...formData, maxPrice: Number(e.target.value) })}
                  InputProps={{
                    startAdornment: <InputAdornment position="start">$</InputAdornment>,
                  }}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Adjustment Percentage"
                  type="number"
                  value={formData.adjustmentPercentage}
                  onChange={(e) =>
                    setFormData({ ...formData, adjustmentPercentage: Number(e.target.value) })
                  }
                  InputProps={{
                    endAdornment: <InputAdornment position="end">%</InputAdornment>,
                  }}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={formData.isActive}
                      onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                    />
                  }
                  label="Active"
                  sx={{ mt: 1 }}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  multiline
                  rows={3}
                  label="Description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </Grid>
            </Grid>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleFormClose}>Cancel</Button>
          <Button variant="contained" onClick={handleFormSubmit} disabled={!formData.name}>
            {selectedRule ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* View Dialog */}
      <Dialog
        open={showViewDialog}
        onClose={() => setShowViewDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Pricing Rule Details</DialogTitle>
        <DialogContent>
          {selectedRule && (
            <Box>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" color="textSecondary">
                    Name
                  </Typography>
                  <Typography variant="body1">{selectedRule.name}</Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" color="textSecondary">
                    Algorithm
                  </Typography>
                  <Chip
                    label={formatLabel(selectedRule.algorithm)}
                    size="small"
                    color={getAlgorithmColor(selectedRule.algorithm) as unknown}
                  />
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="subtitle2" color="textSecondary">
                    Description
                  </Typography>
                  <Typography variant="body1">
                    {selectedRule.description || 'No description'}
                  </Typography>
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="subtitle2" color="textSecondary">
                    Target Room Types
                  </Typography>
                  <Box display="flex" flexWrap="wrap" gap={0.5} mt={0.5}>
                    {(selectedRule.targetRoomTypes || []).length > 0 ? (
                      selectedRule.targetRoomTypes.map((rt) => (
                        <Chip key={rt} label={rt} size="small" variant="outlined" />
                      ))
                    ) : (
                      <Typography variant="body2" color="textSecondary">
                        All room types
                      </Typography>
                    )}
                  </Box>
                </Grid>
                <Grid item xs={12} sm={4}>
                  <Typography variant="subtitle2" color="textSecondary">
                    Base Price
                  </Typography>
                  <Typography variant="body1" fontWeight="medium">
                    ${selectedRule.basePrice.toLocaleString()}
                  </Typography>
                </Grid>
                <Grid item xs={12} sm={4}>
                  <Typography variant="subtitle2" color="textSecondary">
                    Min Price
                  </Typography>
                  <Typography variant="body1">
                    ${selectedRule.minPrice.toLocaleString()}
                  </Typography>
                </Grid>
                <Grid item xs={12} sm={4}>
                  <Typography variant="subtitle2" color="textSecondary">
                    Max Price
                  </Typography>
                  <Typography variant="body1">
                    ${selectedRule.maxPrice.toLocaleString()}
                  </Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" color="textSecondary">
                    Adjustment Percentage
                  </Typography>
                  <Typography variant="body1">
                    {selectedRule.adjustmentPercentage > 0 ? '+' : ''}
                    {selectedRule.adjustmentPercentage}%
                  </Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" color="textSecondary">
                    Status
                  </Typography>
                  <Chip
                    label={selectedRule.isActive ? 'Active' : 'Inactive'}
                    size="small"
                    color={selectedRule.isActive ? 'success' : 'default'}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" color="textSecondary">
                    Created At
                  </Typography>
                  <Typography variant="body1">
                    {new Date(selectedRule.createdAt).toLocaleDateString()}
                  </Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" color="textSecondary">
                    Last Updated
                  </Typography>
                  <Typography variant="body1">
                    {new Date(selectedRule.updatedAt).toLocaleDateString()}
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

export default PricingManager;
