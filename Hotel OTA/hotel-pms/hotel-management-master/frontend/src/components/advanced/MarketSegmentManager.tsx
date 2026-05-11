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
  People
} from '@mui/icons-material';
import { api } from '../../services/api';

interface MarketSegment {
  _id: string;
  name: string;
  code: string;
  category: string;
  description?: string;
  characteristics: {
    avgStayDuration: number;
    avgGroupSize: number;
    preferredRoomTypes: string[];
    budgetRange: {
      min: number;
      max: number;
    };
  };
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface SegmentFormData {
  name: string;
  code: string;
  category: string;
  description: string;
  avgStayDuration: number;
  avgGroupSize: number;
  preferredRoomTypes: string;
  budgetMin: number;
  budgetMax: number;
  isActive: boolean;
}

const emptyForm: SegmentFormData = {
  name: '',
  code: '',
  category: 'leisure',
  description: '',
  avgStayDuration: 1,
  avgGroupSize: 1,
  preferredRoomTypes: '',
  budgetMin: 0,
  budgetMax: 0,
  isActive: true,
};

const categories = [
  'leisure',
  'business',
  'corporate',
  'group',
  'government',
  'military',
  'student',
  'senior',
  'family',
  'other',
];

const MarketSegmentManager: React.FC<{ onRefresh: () => void }> = ({ onRefresh }) => {
  const [segments, setSegments] = useState<MarketSegment[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSegment, setSelectedSegment] = useState<MarketSegment | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [showViewDialog, setShowViewDialog] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [formData, setFormData] = useState<SegmentFormData>(emptyForm);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });

  useEffect(() => {
    fetchSegments();
  }, [categoryFilter]);

  const fetchSegments = async () => {
    try {
      setLoading(true);
      const params: Record<string, string> = {};
      if (categoryFilter) params.category = categoryFilter;

      // Try segmentation endpoint first, fall back to discount-pricing
      let list: MarketSegment[] = [];
      try {
        const response = await api.get('/segmentation/segments', { params });
        const data = response.data?.data || response.data;
        list = Array.isArray(data) ? data : (data?.segments || []);
      } catch {
        const response = await api.get('/discount-pricing/market-segments', { params });
        const data = response.data?.data || response.data;
        list = Array.isArray(data) ? data : (data?.segments || data?.marketSegments || []);
      }
      setSegments(list);
    } catch {
      setSegments([]);
    } finally {
      setLoading(false);
    }
  };

  const showSnackbar = (message: string, severity: 'success' | 'error') => {
    setSnackbar({ open: true, message, severity });
  };

  const handleCreate = () => {
    setSelectedSegment(null);
    setFormData(emptyForm);
    setShowForm(true);
  };

  const handleEdit = (segment: MarketSegment) => {
    setSelectedSegment(segment);
    setFormData({
      name: segment.name,
      code: segment.code,
      category: segment.category,
      description: segment.description || '',
      avgStayDuration: segment.characteristics?.avgStayDuration || 1,
      avgGroupSize: segment.characteristics?.avgGroupSize || 1,
      preferredRoomTypes: (segment.characteristics?.preferredRoomTypes || []).join(', '),
      budgetMin: segment.characteristics?.budgetRange?.min || 0,
      budgetMax: segment.characteristics?.budgetRange?.max || 0,
      isActive: segment.isActive,
    });
    setShowForm(true);
  };

  const handleView = (segment: MarketSegment) => {
    setSelectedSegment(segment);
    setShowViewDialog(true);
  };

  const handleToggleStatus = async (segment: MarketSegment) => {
    try {
      await api.patch(`/discount-pricing/market-segments/${segment._id}`, {
        isActive: !segment.isActive,
      });
      showSnackbar(`Segment ${!segment.isActive ? 'activated' : 'deactivated'}`, 'success');
      fetchSegments();
      onRefresh();
    } catch {
      showSnackbar('Error updating segment status', 'error');
    }
  };

  const handleDelete = async (segment: MarketSegment) => {
    if (window.confirm(`Are you sure you want to delete "${segment.name}"?`)) {
      try {
        await api.delete(`/discount-pricing/market-segments/${segment._id}`);
        showSnackbar('Segment deleted successfully', 'success');
        fetchSegments();
        onRefresh();
      } catch {
        showSnackbar('Error deleting segment', 'error');
      }
    }
  };

  const handleFormClose = () => {
    setShowForm(false);
    setSelectedSegment(null);
    setFormData(emptyForm);
  };

  const handleFormSubmit = async () => {
    try {
      const payload = {
        name: formData.name,
        code: formData.code,
        category: formData.category,
        description: formData.description,
        characteristics: {
          avgStayDuration: formData.avgStayDuration,
          avgGroupSize: formData.avgGroupSize,
          preferredRoomTypes: formData.preferredRoomTypes
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
          budgetRange: {
            min: formData.budgetMin,
            max: formData.budgetMax,
          },
        },
        isActive: formData.isActive,
      };
      if (selectedSegment) {
        await api.patch(`/discount-pricing/market-segments/${selectedSegment._id}`, payload);
        showSnackbar('Segment updated successfully', 'success');
      } else {
        await api.post('/discount-pricing/market-segments', payload);
        showSnackbar('Segment created successfully', 'success');
      }
      handleFormClose();
      fetchSegments();
      onRefresh();
    } catch {
      showSnackbar('Error saving segment', 'error');
    }
  };

  const getCategoryColor = (category: string) => {
    const colors: { [key: string]: string } = {
      leisure: 'success',
      business: 'primary',
      corporate: 'secondary',
      group: 'info',
      government: 'warning',
      military: 'error',
      student: 'default',
      senior: 'default',
      family: 'info',
      other: 'default',
    };
    return colors[category] || 'default';
  };

  const formatLabel = (value: string) =>
    value
      .split('_')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');

  const filteredSegments = segments.filter((segment) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      segment.name.toLowerCase().includes(q) ||
      segment.code.toLowerCase().includes(q) ||
      segment.category.toLowerCase().includes(q) ||
      (segment.description || '').toLowerCase().includes(q)
    );
  });

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h5" component="h2">
          Market Segment Management
        </Typography>
        <Box display="flex" gap={2}>
          <TextField
            size="small"
            placeholder="Search segments..."
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
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Category</InputLabel>
            <Select
              value={categoryFilter}
              label="Category"
              onChange={(e) => setCategoryFilter(e.target.value)}
            >
              <MenuItem value="">All Categories</MenuItem>
              {categories.map((cat) => (
                <MenuItem key={cat} value={cat}>
                  {formatLabel(cat)}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <Button variant="contained" startIcon={<Add />} onClick={handleCreate}>
            Add Segment
          </Button>
        </Box>
      </Box>

      {loading && (
        <Box display="flex" justifyContent="center" py={4}>
          <CircularProgress size={32} />
        </Box>
      )}

      {!loading && filteredSegments.length === 0 && (
        <Card sx={{ mt: 2 }}>
          <CardContent>
            <Box textAlign="center" py={6}>
              <People sx={{ fontSize: 48, color: 'text.disabled', mb: 2 }} />
              <Typography variant="h6" gutterBottom>
                No market segments configured
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Click &quot;Add Segment&quot; to create your first market segment.
              </Typography>
            </Box>
          </CardContent>
        </Card>
      )}

      {!loading && filteredSegments.length > 0 && (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Code</TableCell>
                <TableCell>Category</TableCell>
                <TableCell>Avg Stay Duration</TableCell>
                <TableCell>Avg Group Size</TableCell>
                <TableCell>Budget Range</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredSegments.map((segment) => (
                <TableRow key={segment._id} hover>
                  <TableCell>
                    <Typography variant="body2" fontWeight="medium">
                      {segment.name}
                    </Typography>
                    {segment.description && (
                      <Typography variant="caption" color="textSecondary">
                        {segment.description}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" fontFamily="monospace">
                      {segment.code}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={formatLabel(segment.category)}
                      size="small"
                      color={getCategoryColor(segment.category) as unknown}
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {segment.characteristics?.avgStayDuration || 'N/A'} nights
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {segment.characteristics?.avgGroupSize || 'N/A'} guests
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {segment.characteristics?.budgetRange
                        ? `$${segment.characteristics.budgetRange.min.toLocaleString()} - $${segment.characteristics.budgetRange.max.toLocaleString()}`
                        : 'N/A'}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={segment.isActive ? 'Active' : 'Inactive'}
                      size="small"
                      color={segment.isActive ? 'success' : 'default'}
                    />
                  </TableCell>
                  <TableCell>
                    <Box display="flex" gap={1}>
                      <IconButton
                        size="small"
                        onClick={() => handleView(segment)}
                        title="View Details"
                      >
                        <Visibility />
                      </IconButton>
                      <IconButton size="small" onClick={() => handleEdit(segment)} title="Edit">
                        <Edit />
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={() => handleToggleStatus(segment)}
                        title="Toggle Status"
                      >
                        {segment.isActive ? <TrendingDown /> : <TrendingUp />}
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={() => handleDelete(segment)}
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
        <DialogTitle>
          {selectedSegment ? 'Edit Market Segment' : 'Create Market Segment'}
        </DialogTitle>
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
                <TextField
                  fullWidth
                  label="Code"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  required
                  helperText="Unique segment identifier (e.g., CORP, LEIS)"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel>Category</InputLabel>
                  <Select
                    value={formData.category}
                    label="Category"
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  >
                    {categories.map((cat) => (
                      <MenuItem key={cat} value={cat}>
                        {formatLabel(cat)}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
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
              <Grid item xs={12}>
                <Typography variant="subtitle2" gutterBottom sx={{ mt: 1 }}>
                  Characteristics
                </Typography>
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Average Stay Duration (nights)"
                  type="number"
                  value={formData.avgStayDuration}
                  onChange={(e) =>
                    setFormData({ ...formData, avgStayDuration: Number(e.target.value) })
                  }
                  inputProps={{ min: 1 }}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Average Group Size"
                  type="number"
                  value={formData.avgGroupSize}
                  onChange={(e) =>
                    setFormData({ ...formData, avgGroupSize: Number(e.target.value) })
                  }
                  inputProps={{ min: 1 }}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Preferred Room Types (comma-separated)"
                  value={formData.preferredRoomTypes}
                  onChange={(e) =>
                    setFormData({ ...formData, preferredRoomTypes: e.target.value })
                  }
                  helperText="Enter room type names separated by commas"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Budget Range Min"
                  type="number"
                  value={formData.budgetMin}
                  onChange={(e) => setFormData({ ...formData, budgetMin: Number(e.target.value) })}
                  InputProps={{
                    startAdornment: <InputAdornment position="start">$</InputAdornment>,
                  }}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Budget Range Max"
                  type="number"
                  value={formData.budgetMax}
                  onChange={(e) => setFormData({ ...formData, budgetMax: Number(e.target.value) })}
                  InputProps={{
                    startAdornment: <InputAdornment position="start">$</InputAdornment>,
                  }}
                />
              </Grid>
            </Grid>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleFormClose}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleFormSubmit}
            disabled={!formData.name || !formData.code}
          >
            {selectedSegment ? 'Update' : 'Create'}
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
        <DialogTitle>Market Segment Details</DialogTitle>
        <DialogContent>
          {selectedSegment && (
            <Box>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" color="textSecondary">
                    Name
                  </Typography>
                  <Typography variant="body1">{selectedSegment.name}</Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" color="textSecondary">
                    Code
                  </Typography>
                  <Typography variant="body1" fontFamily="monospace">
                    {selectedSegment.code}
                  </Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" color="textSecondary">
                    Category
                  </Typography>
                  <Chip
                    label={formatLabel(selectedSegment.category)}
                    size="small"
                    color={getCategoryColor(selectedSegment.category) as unknown}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" color="textSecondary">
                    Status
                  </Typography>
                  <Chip
                    label={selectedSegment.isActive ? 'Active' : 'Inactive'}
                    size="small"
                    color={selectedSegment.isActive ? 'success' : 'default'}
                  />
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="subtitle2" color="textSecondary">
                    Description
                  </Typography>
                  <Typography variant="body1">
                    {selectedSegment.description || 'No description'}
                  </Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" color="textSecondary">
                    Average Stay Duration
                  </Typography>
                  <Typography variant="body1">
                    {selectedSegment.characteristics?.avgStayDuration || 'N/A'} nights
                  </Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" color="textSecondary">
                    Average Group Size
                  </Typography>
                  <Typography variant="body1">
                    {selectedSegment.characteristics?.avgGroupSize || 'N/A'} guests
                  </Typography>
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="subtitle2" color="textSecondary">
                    Preferred Room Types
                  </Typography>
                  <Box display="flex" flexWrap="wrap" gap={0.5} mt={0.5}>
                    {(selectedSegment.characteristics?.preferredRoomTypes || []).length > 0 ? (
                      selectedSegment.characteristics.preferredRoomTypes.map((rt) => (
                        <Chip key={rt} label={rt} size="small" variant="outlined" />
                      ))
                    ) : (
                      <Typography variant="body2" color="textSecondary">
                        No preference
                      </Typography>
                    )}
                  </Box>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" color="textSecondary">
                    Budget Range
                  </Typography>
                  <Typography variant="body1">
                    {selectedSegment.characteristics?.budgetRange
                      ? `$${selectedSegment.characteristics.budgetRange.min.toLocaleString()} - $${selectedSegment.characteristics.budgetRange.max.toLocaleString()}`
                      : 'N/A'}
                  </Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" color="textSecondary">
                    Created At
                  </Typography>
                  <Typography variant="body1">
                    {new Date(selectedSegment.createdAt).toLocaleDateString()}
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

export default MarketSegmentManager;
