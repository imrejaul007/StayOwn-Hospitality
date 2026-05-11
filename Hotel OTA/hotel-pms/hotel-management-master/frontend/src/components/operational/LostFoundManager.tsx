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
  Grid,
  Alert,
  Snackbar,
  CircularProgress,
  Tabs,
  Tab,
  InputAdornment
} from '@mui/material';
import {
  Add,
  Edit,
  Delete,
  Visibility,
  Search,
  CheckCircle,
  RemoveCircle
} from '@mui/icons-material';
import { api } from '../../services/api';

interface LostFoundItem {
  _id: string;
  itemName: string;
  description?: string;
  category: string;
  status: 'found' | 'claimed' | 'disposed';
  priority: 'low' | 'medium' | 'high' | 'critical';
  foundLocation: string;
  currentLocation?: string;
  finderName?: string;
  foundDate: string;
  claimedBy?: string;
  claimedDate?: string;
  disposedDate?: string;
  disposalReason?: string;
  createdAt: string;
  updatedAt: string;
}

interface FormData {
  itemName: string;
  description: string;
  category: string;
  priority: string;
  foundLocation: string;
  currentLocation: string;
  finderName: string;
}

const CATEGORIES = [
  'electronics',
  'clothing',
  'documents',
  'valuables',
  'personal_items',
  'luggage',
  'accessories',
  'other'
];

const PRIORITIES = ['low', 'medium', 'high', 'critical'];

const defaultFormData: FormData = {
  itemName: '',
  description: '',
  category: 'other',
  priority: 'medium',
  foundLocation: '',
  currentLocation: '',
  finderName: ''
};

const LostFoundManager: React.FC<{ onRefresh?: () => void }> = ({ onRefresh }) => {
  const [items, setItems] = useState<LostFoundItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState<LostFoundItem | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [showViewDialog, setShowViewDialog] = useState(false);
  const [statusTab, setStatusTab] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState<FormData>(defaultFormData);
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof FormData, string>>>({});
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'success' as 'success' | 'error'
  });

  useEffect(() => {
    fetchItems();
  }, [statusTab]);

  const fetchItems = async () => {
    try {
      setLoading(true);
      const params: Record<string, string | number> = { page: 1, limit: 100 };
      if (statusTab !== 'all') params.status = statusTab;
      const response = await api.get('/operational-management/lost-found', { params });
      const data = response.data?.data || response.data;
      const list = Array.isArray(data) ? data : (data?.items || []);
      setItems(list);
    } catch {
      showSnackbar('Error fetching lost & found items', 'error');
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  const showSnackbar = (message: string, severity: 'success' | 'error') => {
    setSnackbar({ open: true, message, severity });
  };

  const validateForm = (): boolean => {
    const errors: Partial<Record<keyof FormData, string>> = {};
    if (!formData.itemName.trim()) errors.itemName = 'Item name is required';
    if (!formData.foundLocation.trim()) errors.foundLocation = 'Found location is required';
    if (!formData.category) errors.category = 'Category is required';
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleCreate = () => {
    setSelectedItem(null);
    setFormData(defaultFormData);
    setFormErrors({});
    setShowForm(true);
  };

  const handleEdit = (item: LostFoundItem) => {
    setSelectedItem(item);
    setFormData({
      itemName: item.itemName,
      description: item.description || '',
      category: item.category,
      priority: item.priority,
      foundLocation: item.foundLocation,
      currentLocation: item.currentLocation || '',
      finderName: item.finderName || ''
    });
    setFormErrors({});
    setShowForm(true);
  };

  const handleView = (item: LostFoundItem) => {
    setSelectedItem(item);
    setShowViewDialog(true);
  };

  const handleFormSubmit = async () => {
    if (!validateForm()) return;

    try {
      if (selectedItem) {
        await api.patch(`/operational-management/lost-found/${selectedItem._id}`, formData);
        showSnackbar('Item updated successfully', 'success');
      } else {
        await api.post('/operational-management/lost-found', formData);
        showSnackbar('Item reported successfully', 'success');
      }
      setShowForm(false);
      setSelectedItem(null);
      fetchItems();
      onRefresh?.();
    } catch {
      showSnackbar('Error saving item', 'error');
    }
  };

  const handleClaim = async (item: LostFoundItem) => {
    const claimedBy = window.prompt('Enter the name of the person claiming this item:');
    if (!claimedBy) return;

    try {
      await api.patch(`/operational-management/lost-found/${item._id}/claim`, { claimedBy });
      showSnackbar('Item marked as claimed', 'success');
      fetchItems();
      onRefresh?.();
    } catch {
      showSnackbar('Error claiming item', 'error');
    }
  };

  const handleDispose = async (item: LostFoundItem) => {
    const disposalReason = window.prompt('Enter reason for disposal:');
    if (!disposalReason) return;

    if (!window.confirm(`Are you sure you want to dispose "${item.itemName}"?`)) return;

    try {
      await api.patch(`/operational-management/lost-found/${item._id}/dispose`, { disposalReason });
      showSnackbar('Item marked as disposed', 'success');
      fetchItems();
      onRefresh?.();
    } catch {
      showSnackbar('Error disposing item', 'error');
    }
  };

  const getStatusColor = (status: string): 'success' | 'info' | 'error' | 'default' => {
    const colors: Record<string, 'success' | 'info' | 'error' | 'default'> = {
      found: 'info',
      claimed: 'success',
      disposed: 'error'
    };
    return colors[status] || 'default';
  };

  const getPriorityColor = (priority: string): 'success' | 'warning' | 'error' | 'default' => {
    const colors: Record<string, 'success' | 'warning' | 'error' | 'default'> = {
      low: 'success',
      medium: 'warning',
      high: 'error',
      critical: 'error'
    };
    return colors[priority] || 'default';
  };

  const formatCategory = (category: string): string => {
    return category.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  };

  const filteredItems = items.filter((item) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      item.itemName.toLowerCase().includes(term) ||
      item.foundLocation.toLowerCase().includes(term) ||
      item.category.toLowerCase().includes(term) ||
      (item.description && item.description.toLowerCase().includes(term))
    );
  });

  return (
    <Box>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h5" component="h2">
          Lost & Found Management
        </Typography>
        <Button variant="contained" startIcon={<Add />} onClick={handleCreate}>
          Report Found Item
        </Button>
      </Box>

      {/* Search and Filter Tabs */}
      <Box mb={3}>
        <TextField
          size="small"
          placeholder="Search by item name, location, category..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          sx={{ mb: 2, minWidth: 350 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Search />
              </InputAdornment>
            )
          }}
        />

        <Tabs
          value={statusTab}
          onChange={(_e, newValue: string) => setStatusTab(newValue)}
          sx={{ borderBottom: 1, borderColor: 'divider' }}
        >
          <Tab label="All" value="all" />
          <Tab label="Found" value="found" />
          <Tab label="Claimed" value="claimed" />
          <Tab label="Disposed" value="disposed" />
        </Tabs>
      </Box>

      {/* Loading */}
      {loading && (
        <Box display="flex" justifyContent="center" py={4}>
          <CircularProgress size={32} />
        </Box>
      )}

      {/* Empty State */}
      {!loading && filteredItems.length === 0 && (
        <Box py={6} textAlign="center">
          <Typography variant="h6" color="textSecondary" gutterBottom>
            No items found
          </Typography>
          <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
            {searchTerm || statusTab !== 'all'
              ? 'Try adjusting your search or filter criteria.'
              : 'No lost & found items have been reported yet. Click "Report Found Item" to add one.'}
          </Typography>
          {!searchTerm && statusTab === 'all' && (
            <Button variant="outlined" startIcon={<Add />} onClick={handleCreate}>
              Report Found Item
            </Button>
          )}
        </Box>
      )}

      {/* Table */}
      {!loading && filteredItems.length > 0 && (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Item Name</TableCell>
                <TableCell>Category</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Priority</TableCell>
                <TableCell>Found Location</TableCell>
                <TableCell>Found Date</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredItems.map((item) => (
                <TableRow key={item._id} hover>
                  <TableCell>
                    <Typography variant="body2" fontWeight="medium">
                      {item.itemName}
                    </Typography>
                    {item.description && (
                      <Typography
                        variant="caption"
                        color="textSecondary"
                        sx={{
                          display: 'block',
                          maxWidth: 200,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        {item.description}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    <Chip label={formatCategory(item.category)} size="small" variant="outlined" />
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                      size="small"
                      color={getStatusColor(item.status)}
                    />
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={item.priority.charAt(0).toUpperCase() + item.priority.slice(1)}
                      size="small"
                      color={getPriorityColor(item.priority)}
                      variant="outlined"
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">{item.foundLocation}</Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {new Date(item.foundDate || item.createdAt).toLocaleDateString()}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Box display="flex" gap={0.5}>
                      <IconButton
                        size="small"
                        onClick={() => handleView(item)}
                        title="View Details"
                      >
                        <Visibility fontSize="small" />
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={() => handleEdit(item)}
                        title="Edit"
                      >
                        <Edit fontSize="small" />
                      </IconButton>
                      {item.status === 'found' && (
                        <>
                          <IconButton
                            size="small"
                            onClick={() => handleClaim(item)}
                            title="Mark as Claimed"
                            color="success"
                          >
                            <CheckCircle fontSize="small" />
                          </IconButton>
                          <IconButton
                            size="small"
                            onClick={() => handleDispose(item)}
                            title="Dispose"
                            color="error"
                          >
                            <RemoveCircle fontSize="small" />
                          </IconButton>
                        </>
                      )}
                    </Box>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Create / Edit Form Dialog */}
      <Dialog open={showForm} onClose={() => setShowForm(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          {selectedItem ? 'Edit Lost & Found Item' : 'Report Found Item'}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Item Name"
                value={formData.itemName}
                onChange={(e) => setFormData({ ...formData, itemName: e.target.value })}
                error={!!formErrors.itemName}
                helperText={formErrors.itemName}
                fullWidth
                required
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth required error={!!formErrors.category}>
                <InputLabel>Category</InputLabel>
                <Select
                  value={formData.category}
                  label="Category"
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                >
                  {CATEGORIES.map((cat) => (
                    <MenuItem key={cat} value={cat}>
                      {formatCategory(cat)}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <TextField
                label="Description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                fullWidth
                multiline
                rows={3}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Priority</InputLabel>
                <Select
                  value={formData.priority}
                  label="Priority"
                  onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                >
                  {PRIORITIES.map((p) => (
                    <MenuItem key={p} value={p}>
                      {p.charAt(0).toUpperCase() + p.slice(1)}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Finder Name"
                value={formData.finderName}
                onChange={(e) => setFormData({ ...formData, finderName: e.target.value })}
                fullWidth
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Found Location"
                value={formData.foundLocation}
                onChange={(e) => setFormData({ ...formData, foundLocation: e.target.value })}
                error={!!formErrors.foundLocation}
                helperText={formErrors.foundLocation}
                fullWidth
                required
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Current Storage Location"
                value={formData.currentLocation}
                onChange={(e) => setFormData({ ...formData, currentLocation: e.target.value })}
                fullWidth
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowForm(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleFormSubmit}>
            {selectedItem ? 'Update' : 'Report Item'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* View Details Dialog */}
      <Dialog
        open={showViewDialog}
        onClose={() => setShowViewDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Item Details</DialogTitle>
        <DialogContent>
          {selectedItem && (
            <Grid container spacing={2} sx={{ mt: 0.5 }}>
              <Grid item xs={12} sm={6}>
                <Typography variant="subtitle2" color="textSecondary">
                  Item Name
                </Typography>
                <Typography variant="body1">{selectedItem.itemName}</Typography>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Typography variant="subtitle2" color="textSecondary">
                  Category
                </Typography>
                <Chip
                  label={formatCategory(selectedItem.category)}
                  size="small"
                  variant="outlined"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <Typography variant="subtitle2" color="textSecondary">
                  Status
                </Typography>
                <Chip
                  label={selectedItem.status.charAt(0).toUpperCase() + selectedItem.status.slice(1)}
                  size="small"
                  color={getStatusColor(selectedItem.status)}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <Typography variant="subtitle2" color="textSecondary">
                  Priority
                </Typography>
                <Chip
                  label={selectedItem.priority.charAt(0).toUpperCase() + selectedItem.priority.slice(1)}
                  size="small"
                  color={getPriorityColor(selectedItem.priority)}
                  variant="outlined"
                />
              </Grid>
              <Grid item xs={12}>
                <Typography variant="subtitle2" color="textSecondary">
                  Description
                </Typography>
                <Typography variant="body1">
                  {selectedItem.description || 'No description'}
                </Typography>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Typography variant="subtitle2" color="textSecondary">
                  Found Location
                </Typography>
                <Typography variant="body1">{selectedItem.foundLocation}</Typography>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Typography variant="subtitle2" color="textSecondary">
                  Current Location
                </Typography>
                <Typography variant="body1">
                  {selectedItem.currentLocation || 'Not specified'}
                </Typography>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Typography variant="subtitle2" color="textSecondary">
                  Finder Name
                </Typography>
                <Typography variant="body1">
                  {selectedItem.finderName || 'Unknown'}
                </Typography>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Typography variant="subtitle2" color="textSecondary">
                  Found Date
                </Typography>
                <Typography variant="body1">
                  {new Date(selectedItem.foundDate || selectedItem.createdAt).toLocaleDateString()}
                </Typography>
              </Grid>
              {selectedItem.status === 'claimed' && (
                <>
                  <Grid item xs={12} sm={6}>
                    <Typography variant="subtitle2" color="textSecondary">
                      Claimed By
                    </Typography>
                    <Typography variant="body1">
                      {selectedItem.claimedBy || 'N/A'}
                    </Typography>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Typography variant="subtitle2" color="textSecondary">
                      Claimed Date
                    </Typography>
                    <Typography variant="body1">
                      {selectedItem.claimedDate
                        ? new Date(selectedItem.claimedDate).toLocaleDateString()
                        : 'N/A'}
                    </Typography>
                  </Grid>
                </>
              )}
              {selectedItem.status === 'disposed' && (
                <>
                  <Grid item xs={12} sm={6}>
                    <Typography variant="subtitle2" color="textSecondary">
                      Disposed Date
                    </Typography>
                    <Typography variant="body1">
                      {selectedItem.disposedDate
                        ? new Date(selectedItem.disposedDate).toLocaleDateString()
                        : 'N/A'}
                    </Typography>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Typography variant="subtitle2" color="textSecondary">
                      Disposal Reason
                    </Typography>
                    <Typography variant="body1">
                      {selectedItem.disposalReason || 'Not specified'}
                    </Typography>
                  </Grid>
                </>
              )}
            </Grid>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowViewDialog(false)}>Close</Button>
          {selectedItem?.status === 'found' && (
            <>
              <Button
                color="success"
                onClick={() => {
                  setShowViewDialog(false);
                  handleClaim(selectedItem);
                }}
              >
                Claim
              </Button>
              <Button
                color="error"
                onClick={() => {
                  setShowViewDialog(false);
                  handleDispose(selectedItem);
                }}
              >
                Dispose
              </Button>
            </>
          )}
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

export default LostFoundManager;
