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
  CircularProgress,
  Checkbox,
  FormGroup
} from '@mui/material';
import {
  Add,
  Edit,
  Delete,
  Search
} from '@mui/icons-material';
import { api } from '../../services/api';

interface ArrivalDepartureMode {
  _id: string;
  name: string;
  code: string;
  type: string;
  category: string;
  description?: string;
  icon: string;
  color: string;
  isActive: boolean;
  requiresDetails: {
    flightNumber: boolean;
    trainNumber: boolean;
    busNumber: boolean;
    vehicleNumber: boolean;
    driverName: boolean;
  };
  analytics: {
    totalUsage: number;
    averageDelay: number;
    onTimePercentage: number;
    lastUsed?: string;
  };
  createdAt: string;
  updatedAt: string;
}

const modeTypes = [
  'air', 'train', 'bus', 'car', 'taxi', 'walk_in',
  'boat', 'motorcycle', 'bicycle', 'other'
];

const modeCategories = ['transportation', 'personal', 'business', 'emergency', 'other'];

const formatLabel = (value: string): string =>
  value.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

const getTypeColor = (type: string): string => {
  const colors: Record<string, string> = {
    air: 'primary',
    train: 'secondary',
    bus: 'success',
    car: 'info',
    taxi: 'warning',
    walk_in: 'default',
    boat: 'primary',
    motorcycle: 'secondary',
    bicycle: 'success',
    other: 'default',
  };
  return colors[type] || 'default';
};

const getCategoryColor = (category: string): string => {
  const colors: Record<string, string> = {
    transportation: 'primary',
    personal: 'secondary',
    business: 'info',
    emergency: 'error',
    other: 'default',
  };
  return colors[category] || 'default';
};

// ---------- Inline form component ----------
interface ModeFormProps {
  mode: ArrivalDepartureMode | null;
  onSubmit: (data: Record<string, unknown>) => void;
  onCancel: () => void;
}

function ModeForm({ mode, onSubmit, onCancel }: ModeFormProps) {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [type, setType] = useState('air');
  const [category, setCategory] = useState('transportation');
  const [icon, setIcon] = useState('transport');
  const [color, setColor] = useState('#3B82F6');
  const [requiresDetails, setRequiresDetails] = useState({
    flightNumber: false,
    trainNumber: false,
    busNumber: false,
    vehicleNumber: false,
    driverName: false,
  });
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    if (mode) {
      setName(mode.name || '');
      setCode(mode.code || '');
      setType(mode.type || 'air');
      setCategory(mode.category || 'transportation');
      setIcon(mode.icon || 'transport');
      setColor(mode.color || '#3B82F6');
      setRequiresDetails({
        flightNumber: mode.requiresDetails?.flightNumber ?? false,
        trainNumber: mode.requiresDetails?.trainNumber ?? false,
        busNumber: mode.requiresDetails?.busNumber ?? false,
        vehicleNumber: mode.requiresDetails?.vehicleNumber ?? false,
        driverName: mode.requiresDetails?.driverName ?? false,
      });
      setIsActive(mode.isActive ?? true);
    }
  }, [mode]);

  const handleDetailToggle = (key: keyof typeof requiresDetails) => {
    setRequiresDetails((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ name, code, type, category, icon, color, requiresDetails, isActive });
  };

  return (
    <Box component="form" onSubmit={handleSubmit} sx={{ pt: 1 }}>
      <Grid container spacing={2}>
        <Grid item xs={12} sm={6}>
          <TextField label="Name" value={name} onChange={(e) => setName(e.target.value)} fullWidth required size="small" />
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField label="Code" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} fullWidth required size="small" />
        </Grid>
        <Grid item xs={12} sm={6}>
          <FormControl fullWidth size="small">
            <InputLabel>Type</InputLabel>
            <Select value={type} label="Type" onChange={(e) => setType(e.target.value)}>
              {modeTypes.map((t) => (
                <MenuItem key={t} value={t}>{formatLabel(t)}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={12} sm={6}>
          <FormControl fullWidth size="small">
            <InputLabel>Category</InputLabel>
            <Select value={category} label="Category" onChange={(e) => setCategory(e.target.value)}>
              {modeCategories.map((c) => (
                <MenuItem key={c} value={c}>{formatLabel(c)}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField label="Icon" value={icon} onChange={(e) => setIcon(e.target.value)} fullWidth size="small" />
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField
            label="Color"
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            fullWidth
            size="small"
            InputLabelProps={{ shrink: true }}
          />
        </Grid>
        <Grid item xs={12} sm={6}>
          <FormControlLabel
            control={<Switch checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />}
            label="Active"
          />
        </Grid>

        {/* Requires Details */}
        <Grid item xs={12}>
          <Typography variant="subtitle2" color="textSecondary" sx={{ mb: 1 }}>
            Required Details
          </Typography>
          <FormGroup row>
            <FormControlLabel
              control={<Checkbox checked={requiresDetails.flightNumber} onChange={() => handleDetailToggle('flightNumber')} size="small" />}
              label="Flight Number"
            />
            <FormControlLabel
              control={<Checkbox checked={requiresDetails.trainNumber} onChange={() => handleDetailToggle('trainNumber')} size="small" />}
              label="Train Number"
            />
            <FormControlLabel
              control={<Checkbox checked={requiresDetails.busNumber} onChange={() => handleDetailToggle('busNumber')} size="small" />}
              label="Bus Number"
            />
            <FormControlLabel
              control={<Checkbox checked={requiresDetails.vehicleNumber} onChange={() => handleDetailToggle('vehicleNumber')} size="small" />}
              label="Vehicle Number"
            />
            <FormControlLabel
              control={<Checkbox checked={requiresDetails.driverName} onChange={() => handleDetailToggle('driverName')} size="small" />}
              label="Driver Name"
            />
          </FormGroup>
        </Grid>
      </Grid>

      <Box display="flex" justifyContent="flex-end" gap={2} mt={3}>
        <Button onClick={onCancel}>Cancel</Button>
        <Button type="submit" variant="contained">{mode ? 'Update' : 'Create'}</Button>
      </Box>
    </Box>
  );
}

// ---------- Main component ----------

export default function ArrivalDepartureManager() {
  const [modes, setModes] = useState<ArrivalDepartureMode[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMode, setSelectedMode] = useState<ArrivalDepartureMode | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });

  useEffect(() => {
    fetchModes();
  }, [statusFilter]);

  const fetchModes = async () => {
    try {
      setLoading(true);
      const params: Record<string, string> = {};
      if (statusFilter === 'active') params.isActive = 'true';
      if (statusFilter === 'inactive') params.isActive = 'false';
      const response = await api.get('/operational-management/arrival-departure-modes', { params });
      const data = response.data?.data || response.data;
      const list = Array.isArray(data) ? data : (data?.modes || []);
      setModes(list);
    } catch {
      showSnackbar('Error fetching arrival/departure modes', 'error');
      setModes([]);
    } finally {
      setLoading(false);
    }
  };

  const showSnackbar = (message: string, severity: 'success' | 'error') => {
    setSnackbar({ open: true, message, severity });
  };

  const handleCreate = () => {
    setSelectedMode(null);
    setShowForm(true);
  };

  const handleEdit = (mode: ArrivalDepartureMode) => {
    setSelectedMode(mode);
    setShowForm(true);
  };

  const handleDelete = async (mode: ArrivalDepartureMode) => {
    if (window.confirm(`Are you sure you want to delete "${mode.name}"?`)) {
      try {
        await api.delete(`/operational-management/arrival-departure-modes/${mode._id}`);
        showSnackbar('Mode deleted successfully', 'success');
        fetchModes();
      } catch {
        showSnackbar('Error deleting mode', 'error');
      }
    }
  };

  const handleFormClose = () => {
    setShowForm(false);
    setSelectedMode(null);
  };

  const handleFormSubmit = async (data: Record<string, unknown>) => {
    try {
      if (selectedMode) {
        await api.patch(`/operational-management/arrival-departure-modes/${selectedMode._id}`, data);
        showSnackbar('Mode updated successfully', 'success');
      } else {
        await api.post('/operational-management/arrival-departure-modes', data);
        showSnackbar('Mode created successfully', 'success');
      }
      handleFormClose();
      fetchModes();
    } catch {
      showSnackbar('Error saving mode', 'error');
    }
  };

  const getRequiredDetailsList = (mode: ArrivalDepartureMode): string[] => {
    const details: string[] = [];
    if (mode.requiresDetails?.flightNumber) details.push('Flight');
    if (mode.requiresDetails?.trainNumber) details.push('Train');
    if (mode.requiresDetails?.busNumber) details.push('Bus');
    if (mode.requiresDetails?.vehicleNumber) details.push('Vehicle');
    if (mode.requiresDetails?.driverName) details.push('Driver');
    return details;
  };

  const filteredModes = modes.filter((mode) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      mode.name.toLowerCase().includes(term) ||
      mode.code.toLowerCase().includes(term) ||
      mode.type.toLowerCase().includes(term)
    );
  });

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h5" component="h2">
          Arrival / Departure Modes
        </Typography>
        <Box display="flex" gap={2}>
          <TextField
            size="small"
            placeholder="Search..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            InputProps={{ startAdornment: <Search fontSize="small" sx={{ mr: 1, color: 'text.secondary' }} /> }}
          />
          <FormControl size="small" sx={{ minWidth: 140 }}>
            <InputLabel>Status</InputLabel>
            <Select value={statusFilter} label="Status" onChange={(e) => setStatusFilter(e.target.value)}>
              <MenuItem value="">All</MenuItem>
              <MenuItem value="active">Active</MenuItem>
              <MenuItem value="inactive">Inactive</MenuItem>
            </Select>
          </FormControl>
          <Button variant="contained" startIcon={<Add />} onClick={handleCreate}>
            Add Mode
          </Button>
        </Box>
      </Box>

      {loading && (
        <Box display="flex" justifyContent="center" py={4}>
          <CircularProgress size={32} />
        </Box>
      )}

      {!loading && filteredModes.length === 0 && (
        <Box py={4} textAlign="center">
          <Typography variant="body1" color="textSecondary">
            {searchTerm || statusFilter
              ? 'No modes match your filters.'
              : 'No arrival/departure modes found. Click "Add Mode" to create one.'}
          </Typography>
        </Box>
      )}

      {!loading && filteredModes.length > 0 && (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Code</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Category</TableCell>
                <TableCell>Required Details</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredModes.map((mode) => (
                <TableRow key={mode._id} hover>
                  <TableCell>
                    <Box display="flex" alignItems="center" gap={1}>
                      <Box
                        sx={{
                          width: 12,
                          height: 12,
                          borderRadius: '50%',
                          backgroundColor: mode.color || '#3B82F6',
                          flexShrink: 0,
                        }}
                      />
                      <Typography variant="body2" fontWeight="medium">
                        {mode.name}
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" fontFamily="monospace">
                      {mode.code}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={formatLabel(mode.type)}
                      size="small"
                      color={getTypeColor(mode.type) as 'primary' | 'secondary' | 'success' | 'info' | 'warning' | 'error' | 'default'}
                    />
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={formatLabel(mode.category)}
                      size="small"
                      variant="outlined"
                      color={getCategoryColor(mode.category) as 'primary' | 'secondary' | 'success' | 'info' | 'warning' | 'error' | 'default'}
                    />
                  </TableCell>
                  <TableCell>
                    <Box display="flex" flexWrap="wrap" gap={0.5}>
                      {getRequiredDetailsList(mode).length > 0
                        ? getRequiredDetailsList(mode).map((d) => (
                            <Chip key={d} label={d} size="small" variant="outlined" />
                          ))
                        : <Typography variant="caption" color="textSecondary">None</Typography>}
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={mode.isActive ? 'Active' : 'Inactive'}
                      size="small"
                      color={mode.isActive ? 'success' : 'default'}
                    />
                  </TableCell>
                  <TableCell>
                    <Box display="flex" gap={1}>
                      <IconButton size="small" onClick={() => handleEdit(mode)} title="Edit">
                        <Edit />
                      </IconButton>
                      <IconButton size="small" onClick={() => handleDelete(mode)} title="Delete" color="error">
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
      <Dialog open={showForm} onClose={handleFormClose} maxWidth="md" fullWidth>
        <DialogTitle>{selectedMode ? 'Edit Mode' : 'Create Mode'}</DialogTitle>
        <DialogContent>
          <ModeForm mode={selectedMode} onSubmit={handleFormSubmit} onCancel={handleFormClose} />
        </DialogContent>
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
}
