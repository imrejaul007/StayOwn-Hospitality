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
  Card,
  CardContent,
  Alert,
  Snackbar,
  CircularProgress
} from '@mui/material';
import {
  Add,
  Edit,
  Delete,
  Visibility,
  DragIndicator,
  Save,
  Cancel
} from '@mui/icons-material';
import { AccountAttributeForm } from './AccountAttributeForm';
import { api } from '../../services/api';

interface AccountAttribute {
  _id: string;
  name: string;
  label: string;
  type: string;
  category: string;
  description?: string;
  isRequired: boolean;
  isActive: boolean;
  displayOrder: number;
  validationSummary: string;
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

const AccountAttributeManager: React.FC<{ onRefresh: () => void }> = ({ onRefresh }) => {
  const [attributes, setAttributes] = useState<AccountAttribute[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAttribute, setSelectedAttribute] = useState<AccountAttribute | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [showViewDialog, setShowViewDialog] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });

  const categories = [
    'personal', 'business', 'financial', 'contact', 'preferences', 'security', 'compliance', 'other'
  ];

  const fieldTypes = [
    'text', 'number', 'date', 'boolean', 'select', 'multiselect', 'textarea', 'email', 'phone', 'url', 'file'
  ];

  useEffect(() => {
    fetchAttributes();
  }, [categoryFilter]);

  const fetchAttributes = async () => {
    try {
      setLoading(true);
      const params: Record<string, string> = {};
      if (categoryFilter) params.category = categoryFilter;
      const response = await api.get('/guest-management/account-attributes', { params });
      const data = response.data?.data || response.data;
      const list = Array.isArray(data) ? data : (data?.attributes || []);
      setAttributes(list);
    } catch (error) {
      showSnackbar('Error fetching attributes', 'error');
      setAttributes([]);
    } finally {
      setLoading(false);
    }
  };

  const showSnackbar = (message: string, severity: 'success' | 'error') => {
    setSnackbar({ open: true, message, severity });
  };

  const handleCreate = () => {
    setSelectedAttribute(null);
    setShowForm(true);
  };

  const handleEdit = (attribute: AccountAttribute) => {
    setSelectedAttribute(attribute);
    setShowForm(true);
  };

  const handleView = (attribute: AccountAttribute) => {
    setSelectedAttribute(attribute);
    setShowViewDialog(true);
  };

  const handleDelete = async (attribute: AccountAttribute) => {
    if (window.confirm(`Are you sure you want to delete "${attribute.label}"?`)) {
      try {
        await api.delete(`/guest-management/account-attributes/${attribute._id}`);
        showSnackbar('Attribute deleted successfully', 'success');
        fetchAttributes();
        onRefresh();
      } catch (error) {
        showSnackbar('Error deleting attribute', 'error');
      }
    }
  };

  const handleFormClose = () => {
    setShowForm(false);
    setSelectedAttribute(null);
  };

  const handleFormSubmit = async (attributeData: Record<string, unknown>) => {
    try {
      if (selectedAttribute) {
        await api.patch(`/guest-management/account-attributes/${selectedAttribute._id}`, attributeData);
        showSnackbar('Attribute updated successfully', 'success');
      } else {
        await api.post('/guest-management/account-attributes', attributeData);
        showSnackbar('Attribute created successfully', 'success');
      }
      handleFormClose();
      fetchAttributes();
      onRefresh();
    } catch (error) {
      showSnackbar('Error saving attribute', 'error');
    }
  };

  const getCategoryColor = (category: string) => {
    const colors: { [key: string]: string } = {
      personal: 'primary',
      business: 'secondary',
      financial: 'success',
      contact: 'info',
      preferences: 'warning',
      security: 'error',
      compliance: 'default',
      other: 'default'
    };
    return colors[category] || 'default';
  };

  const getTypeColor = (type: string) => {
    const colors: { [key: string]: string } = {
      text: 'primary',
      number: 'secondary',
      date: 'success',
      boolean: 'info',
      select: 'warning',
      multiselect: 'error',
      textarea: 'default',
      email: 'primary',
      phone: 'secondary',
      url: 'success',
      file: 'info'
    };
    return colors[type] || 'default';
  };

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h5" component="h2">
          Account Attributes
        </Typography>
        <Box display="flex" gap={2}>
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
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={handleCreate}
          >
            Add Attribute
          </Button>
        </Box>
      </Box>

      {loading && (
        <Box display="flex" justifyContent="center" py={4}>
          <CircularProgress size={32} />
        </Box>
      )}

      {!loading && attributes.length === 0 && (
        <Box py={4} textAlign="center">
          <Typography variant="body1" color="textSecondary">
            No account attributes found. Click "Add Attribute" to create one.
          </Typography>
        </Box>
      )}

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Order</TableCell>
              <TableCell>Name</TableCell>
              <TableCell>Label</TableCell>
              <TableCell>Type</TableCell>
              <TableCell>Category</TableCell>
              <TableCell>Required</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Validation</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {attributes.map((attribute) => (
              <TableRow key={attribute._id} hover>
                <TableCell>
                  <Box display="flex" alignItems="center">
                    <DragIndicator sx={{ mr: 1, cursor: 'grab' }} />
                    {attribute.displayOrder}
                  </Box>
                </TableCell>
                <TableCell>
                  <Typography variant="body2" fontWeight="medium">
                    {attribute.name}
                  </Typography>
                </TableCell>
                <TableCell>{attribute.label}</TableCell>
                <TableCell>
                  <Chip
                    label={attribute.type}
                    size="small"
                    color={getTypeColor(attribute.type) as unknown}
                  />
                </TableCell>
                <TableCell>
                  <Chip
                    label={attribute.category}
                    size="small"
                    color={getCategoryColor(attribute.category) as unknown}
                  />
                </TableCell>
                <TableCell>
                  <Chip
                    label={attribute.isRequired ? 'Yes' : 'No'}
                    size="small"
                    color={attribute.isRequired ? 'error' : 'default'}
                  />
                </TableCell>
                <TableCell>
                  <Chip
                    label={attribute.isActive ? 'Active' : 'Inactive'}
                    size="small"
                    color={attribute.isActive ? 'success' : 'default'}
                  />
                </TableCell>
                <TableCell>
                  <Typography variant="caption" color="textSecondary">
                    {attribute.validationSummary}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Box display="flex" gap={1}>
                    <IconButton
                      size="small"
                      onClick={() => handleView(attribute)}
                      title="View Details"
                    >
                      <Visibility />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => handleEdit(attribute)}
                      title="Edit"
                    >
                      <Edit />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => handleDelete(attribute)}
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

      {/* Form Dialog */}
      <Dialog
        open={showForm}
        onClose={handleFormClose}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          {selectedAttribute ? 'Edit Account Attribute' : 'Create Account Attribute'}
        </DialogTitle>
        <DialogContent>
          <AccountAttributeForm
            attribute={selectedAttribute}
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
        <DialogTitle>Attribute Details</DialogTitle>
        <DialogContent>
          {selectedAttribute && (
            <Box>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" color="textSecondary">
                    Name
                  </Typography>
                  <Typography variant="body1">
                    {selectedAttribute.name}
                  </Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" color="textSecondary">
                    Label
                  </Typography>
                  <Typography variant="body1">
                    {selectedAttribute.label}
                  </Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" color="textSecondary">
                    Type
                  </Typography>
                  <Chip
                    label={selectedAttribute.type}
                    size="small"
                    color={getTypeColor(selectedAttribute.type) as unknown}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" color="textSecondary">
                    Category
                  </Typography>
                  <Chip
                    label={selectedAttribute.category}
                    size="small"
                    color={getCategoryColor(selectedAttribute.category) as unknown}
                  />
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="subtitle2" color="textSecondary">
                    Description
                  </Typography>
                  <Typography variant="body1">
                    {selectedAttribute.description || 'No description'}
                  </Typography>
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="subtitle2" color="textSecondary">
                    Validation Rules
                  </Typography>
                  <Typography variant="body1">
                    {selectedAttribute.validationSummary}
                  </Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" color="textSecondary">
                    Required
                  </Typography>
                  <Chip
                    label={selectedAttribute.isRequired ? 'Yes' : 'No'}
                    size="small"
                    color={selectedAttribute.isRequired ? 'error' : 'default'}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" color="textSecondary">
                    Status
                  </Typography>
                  <Chip
                    label={selectedAttribute.isActive ? 'Active' : 'Inactive'}
                    size="small"
                    color={selectedAttribute.isActive ? 'success' : 'default'}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" color="textSecondary">
                    Created By
                  </Typography>
                  <Typography variant="body1">
                    {selectedAttribute.createdBy.name}
                  </Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" color="textSecondary">
                    Created At
                  </Typography>
                  <Typography variant="body1">
                    {new Date(selectedAttribute.createdAt).toLocaleDateString()}
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

export default AccountAttributeManager;
