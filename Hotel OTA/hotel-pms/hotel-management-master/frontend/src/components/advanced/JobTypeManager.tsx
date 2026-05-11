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
  Work
} from '@mui/icons-material';
import { api } from '../../services/api';

interface JobType {
  _id: string;
  name: string;
  code: string;
  category: string;
  description?: string;
  requirements: {
    education: string;
    experience: string;
    skills: string[];
  };
  isRemoteEligible: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface JobTypeFormData {
  name: string;
  code: string;
  category: string;
  description: string;
  education: string;
  experience: string;
  skills: string;
  isRemoteEligible: boolean;
  isActive: boolean;
}

const emptyForm: JobTypeFormData = {
  name: '',
  code: '',
  category: 'hospitality',
  description: '',
  education: '',
  experience: '',
  skills: '',
  isRemoteEligible: false,
  isActive: true,
};

const jobCategories = [
  'hospitality',
  'management',
  'maintenance',
  'security',
  'food_beverage',
  'housekeeping',
  'front_desk',
  'sales_marketing',
  'finance',
  'human_resources',
  'other',
];

const JobTypeManager: React.FC<{ onRefresh: () => void }> = ({ onRefresh }) => {
  const [jobTypes, setJobTypes] = useState<JobType[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedJobType, setSelectedJobType] = useState<JobType | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [showViewDialog, setShowViewDialog] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [formData, setFormData] = useState<JobTypeFormData>(emptyForm);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });

  useEffect(() => {
    fetchJobTypes();
  }, [categoryFilter]);

  const fetchJobTypes = async () => {
    try {
      setLoading(true);
      const params: Record<string, string> = {};
      if (categoryFilter) params.category = categoryFilter;
      const response = await api.get('/discount-pricing/job-types', { params });
      const data = response.data?.data || response.data;
      const list = Array.isArray(data) ? data : (data?.jobTypes || []);
      setJobTypes(list);
    } catch {
      setJobTypes([]);
    } finally {
      setLoading(false);
    }
  };

  const showSnackbar = (message: string, severity: 'success' | 'error') => {
    setSnackbar({ open: true, message, severity });
  };

  const handleCreate = () => {
    setSelectedJobType(null);
    setFormData(emptyForm);
    setShowForm(true);
  };

  const handleEdit = (jobType: JobType) => {
    setSelectedJobType(jobType);
    setFormData({
      name: jobType.name,
      code: jobType.code,
      category: jobType.category,
      description: jobType.description || '',
      education: jobType.requirements?.education || '',
      experience: jobType.requirements?.experience || '',
      skills: (jobType.requirements?.skills || []).join(', '),
      isRemoteEligible: jobType.isRemoteEligible,
      isActive: jobType.isActive,
    });
    setShowForm(true);
  };

  const handleView = (jobType: JobType) => {
    setSelectedJobType(jobType);
    setShowViewDialog(true);
  };

  const handleToggleStatus = async (jobType: JobType) => {
    try {
      await api.patch(`/discount-pricing/job-types/${jobType._id}`, {
        isActive: !jobType.isActive,
      });
      showSnackbar(`Job type ${!jobType.isActive ? 'activated' : 'deactivated'}`, 'success');
      fetchJobTypes();
      onRefresh();
    } catch {
      showSnackbar('Error updating job type status', 'error');
    }
  };

  const handleDelete = async (jobType: JobType) => {
    if (window.confirm(`Are you sure you want to delete "${jobType.name}"?`)) {
      try {
        await api.delete(`/discount-pricing/job-types/${jobType._id}`);
        showSnackbar('Job type deleted successfully', 'success');
        fetchJobTypes();
        onRefresh();
      } catch {
        showSnackbar('Error deleting job type', 'error');
      }
    }
  };

  const handleFormClose = () => {
    setShowForm(false);
    setSelectedJobType(null);
    setFormData(emptyForm);
  };

  const handleFormSubmit = async () => {
    try {
      const payload = {
        name: formData.name,
        code: formData.code,
        category: formData.category,
        description: formData.description,
        requirements: {
          education: formData.education,
          experience: formData.experience,
          skills: formData.skills
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
        },
        isRemoteEligible: formData.isRemoteEligible,
        isActive: formData.isActive,
      };
      if (selectedJobType) {
        await api.patch(`/discount-pricing/job-types/${selectedJobType._id}`, payload);
        showSnackbar('Job type updated successfully', 'success');
      } else {
        await api.post('/discount-pricing/job-types', payload);
        showSnackbar('Job type created successfully', 'success');
      }
      handleFormClose();
      fetchJobTypes();
      onRefresh();
    } catch {
      showSnackbar('Error saving job type', 'error');
    }
  };

  const getCategoryColor = (category: string) => {
    const colors: { [key: string]: string } = {
      hospitality: 'primary',
      management: 'secondary',
      maintenance: 'info',
      security: 'warning',
      food_beverage: 'success',
      housekeeping: 'default',
      front_desk: 'primary',
      sales_marketing: 'secondary',
      finance: 'info',
      human_resources: 'warning',
      other: 'default',
    };
    return colors[category] || 'default';
  };

  const formatLabel = (value: string) =>
    value
      .split('_')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');

  const filteredJobTypes = jobTypes.filter((jt) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      jt.name.toLowerCase().includes(q) ||
      jt.code.toLowerCase().includes(q) ||
      jt.category.toLowerCase().includes(q) ||
      (jt.description || '').toLowerCase().includes(q)
    );
  });

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h5" component="h2">
          Job Type Management
        </Typography>
        <Box display="flex" gap={2}>
          <TextField
            size="small"
            placeholder="Search job types..."
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
              {jobCategories.map((cat) => (
                <MenuItem key={cat} value={cat}>
                  {formatLabel(cat)}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <Button variant="contained" startIcon={<Add />} onClick={handleCreate}>
            Add Job Type
          </Button>
        </Box>
      </Box>

      {loading && (
        <Box display="flex" justifyContent="center" py={4}>
          <CircularProgress size={32} />
        </Box>
      )}

      {!loading && filteredJobTypes.length === 0 && (
        <Card sx={{ mt: 2 }}>
          <CardContent>
            <Box textAlign="center" py={6}>
              <Work sx={{ fontSize: 48, color: 'text.disabled', mb: 2 }} />
              <Typography variant="h6" gutterBottom>
                No job types configured
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Click &quot;Add Job Type&quot; to create your first job type.
              </Typography>
            </Box>
          </CardContent>
        </Card>
      )}

      {!loading && filteredJobTypes.length > 0 && (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Code</TableCell>
                <TableCell>Category</TableCell>
                <TableCell>Education</TableCell>
                <TableCell>Experience</TableCell>
                <TableCell>Remote Eligible</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredJobTypes.map((jt) => (
                <TableRow key={jt._id} hover>
                  <TableCell>
                    <Typography variant="body2" fontWeight="medium">
                      {jt.name}
                    </Typography>
                    {jt.description && (
                      <Typography variant="caption" color="textSecondary">
                        {jt.description}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" fontFamily="monospace">
                      {jt.code}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={formatLabel(jt.category)}
                      size="small"
                      color={getCategoryColor(jt.category) as unknown}
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {jt.requirements?.education || 'N/A'}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {jt.requirements?.experience || 'N/A'}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={jt.isRemoteEligible ? 'Yes' : 'No'}
                      size="small"
                      color={jt.isRemoteEligible ? 'success' : 'default'}
                    />
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={jt.isActive ? 'Active' : 'Inactive'}
                      size="small"
                      color={jt.isActive ? 'success' : 'default'}
                    />
                  </TableCell>
                  <TableCell>
                    <Box display="flex" gap={1}>
                      <IconButton
                        size="small"
                        onClick={() => handleView(jt)}
                        title="View Details"
                      >
                        <Visibility />
                      </IconButton>
                      <IconButton size="small" onClick={() => handleEdit(jt)} title="Edit">
                        <Edit />
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={() => handleToggleStatus(jt)}
                        title="Toggle Status"
                      >
                        {jt.isActive ? <TrendingDown /> : <TrendingUp />}
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={() => handleDelete(jt)}
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
        <DialogTitle>{selectedJobType ? 'Edit Job Type' : 'Create Job Type'}</DialogTitle>
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
                  helperText="Unique job type identifier (e.g., MGR, HSK)"
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
                    {jobCategories.map((cat) => (
                      <MenuItem key={cat} value={cat}>
                        {formatLabel(cat)}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={3}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={formData.isRemoteEligible}
                      onChange={(e) =>
                        setFormData({ ...formData, isRemoteEligible: e.target.checked })
                      }
                    />
                  }
                  label="Remote Eligible"
                  sx={{ mt: 1 }}
                />
              </Grid>
              <Grid item xs={12} sm={3}>
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
                  Requirements
                </Typography>
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Education"
                  value={formData.education}
                  onChange={(e) => setFormData({ ...formData, education: e.target.value })}
                  helperText="e.g., Bachelor's Degree, High School Diploma"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Experience"
                  value={formData.experience}
                  onChange={(e) => setFormData({ ...formData, experience: e.target.value })}
                  helperText="e.g., 2+ years, Entry-level"
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Skills (comma-separated)"
                  value={formData.skills}
                  onChange={(e) => setFormData({ ...formData, skills: e.target.value })}
                  helperText="Enter required skills separated by commas"
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
            {selectedJobType ? 'Update' : 'Create'}
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
        <DialogTitle>Job Type Details</DialogTitle>
        <DialogContent>
          {selectedJobType && (
            <Box>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" color="textSecondary">
                    Name
                  </Typography>
                  <Typography variant="body1">{selectedJobType.name}</Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" color="textSecondary">
                    Code
                  </Typography>
                  <Typography variant="body1" fontFamily="monospace">
                    {selectedJobType.code}
                  </Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" color="textSecondary">
                    Category
                  </Typography>
                  <Chip
                    label={formatLabel(selectedJobType.category)}
                    size="small"
                    color={getCategoryColor(selectedJobType.category) as unknown}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" color="textSecondary">
                    Status
                  </Typography>
                  <Chip
                    label={selectedJobType.isActive ? 'Active' : 'Inactive'}
                    size="small"
                    color={selectedJobType.isActive ? 'success' : 'default'}
                  />
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="subtitle2" color="textSecondary">
                    Description
                  </Typography>
                  <Typography variant="body1">
                    {selectedJobType.description || 'No description'}
                  </Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" color="textSecondary">
                    Education Requirement
                  </Typography>
                  <Typography variant="body1">
                    {selectedJobType.requirements?.education || 'Not specified'}
                  </Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" color="textSecondary">
                    Experience Requirement
                  </Typography>
                  <Typography variant="body1">
                    {selectedJobType.requirements?.experience || 'Not specified'}
                  </Typography>
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="subtitle2" color="textSecondary">
                    Required Skills
                  </Typography>
                  <Box display="flex" flexWrap="wrap" gap={0.5} mt={0.5}>
                    {(selectedJobType.requirements?.skills || []).length > 0 ? (
                      selectedJobType.requirements.skills.map((skill) => (
                        <Chip key={skill} label={skill} size="small" variant="outlined" />
                      ))
                    ) : (
                      <Typography variant="body2" color="textSecondary">
                        No specific skills listed
                      </Typography>
                    )}
                  </Box>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" color="textSecondary">
                    Remote Eligible
                  </Typography>
                  <Chip
                    label={selectedJobType.isRemoteEligible ? 'Yes' : 'No'}
                    size="small"
                    color={selectedJobType.isRemoteEligible ? 'success' : 'default'}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" color="textSecondary">
                    Created At
                  </Typography>
                  <Typography variant="body1">
                    {new Date(selectedJobType.createdAt).toLocaleDateString()}
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

export default JobTypeManager;
