import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Grid,
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
  Chip,
  IconButton,
  Menu,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Divider,
  Alert,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  MoreVert as MoreVertIcon,
  ExpandMore as ExpandMoreIcon,
  Business as BusinessIcon,
  Settings as SettingsIcon,
  Group as GroupIcon,
  Sync as SyncIcon
} from '@mui/icons-material';
import { propertyGroupsApi, centralizedRatesApi } from '../../services/api';

interface PropertyGroup {
  _id: string;
  name: string;
  description: string;
  groupType: 'chain' | 'franchise' | 'management_company' | 'independent';
  status: 'active' | 'inactive' | 'suspended';
  metrics: {
    totalProperties: number;
    totalRooms: number;
    activeUsers: number;
    averageOccupancyRate: number;
  };
  settings: {
    centralizedRates: boolean;
    centralizedInventory: boolean;
    sharedGuestDatabase: boolean;
    rateManagement: {
      autoSync: boolean;
      syncFrequency: string;
      allowPropertyOverrides: boolean;
      requireApproval: boolean;
      conflictResolution: string;
    };
  };
  properties: Array<{
    _id: string;
    name: string;
    location: string;
    roomCount: number;
    isActive: boolean;
  }>;
  createdAt: string;
  updatedAt: string;
}

interface PropertyGroupManagerProps {
  onGroupSelect: (groupId: string | null) => void;
  selectedGroup: string | null;
}

const PropertyGroupManager: React.FC<PropertyGroupManagerProps> = ({ 
  onGroupSelect, 
  selectedGroup 
}) => {
  const [groups, setGroups] = useState<PropertyGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<PropertyGroup | null>(null);
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const [selectedMenuGroup, setSelectedMenuGroup] = useState<PropertyGroup | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    groupType: 'chain' as const,
    centralizedRates: true,
    centralizedInventory: false,
    sharedGuestDatabase: true,
    autoSync: true,
    syncFrequency: 'daily',
    allowPropertyOverrides: true,
    requireApproval: false,
    conflictResolution: 'alert_only'
  });

  useEffect(() => {
    loadGroups();
  }, []);

  const loadGroups = async () => {
    try {
      setLoading(true);
      const response = await propertyGroupsApi.getGroups();
      setGroups(response.data.groups);
    } catch {
      // Error handled silently
    } finally {
      setLoading(false);
    }
  };

  const handleCreateGroup = () => {
    setEditingGroup(null);
    resetForm();
    setDialogOpen(true);
  };

  const handleEditGroup = (group: PropertyGroup) => {
    setEditingGroup(group);
    setFormData({
      name: group.name,
      description: group.description,
      groupType: group.groupType,
      centralizedRates: group.settings.centralizedRates,
      centralizedInventory: group.settings.centralizedInventory,
      sharedGuestDatabase: group.settings.sharedGuestDatabase,
      autoSync: group.settings.rateManagement.autoSync,
      syncFrequency: group.settings.rateManagement.syncFrequency,
      allowPropertyOverrides: group.settings.rateManagement.allowPropertyOverrides,
      requireApproval: group.settings.rateManagement.requireApproval,
      conflictResolution: group.settings.rateManagement.conflictResolution
    });
    setDialogOpen(true);
    setMenuAnchor(null);
  };

  const handleDeleteGroup = async (group: PropertyGroup) => {
    if (window.confirm(`Are you sure you want to delete "${group.name}"?`)) {
      try {
        await propertyGroupsApi.deleteGroup(group._id);
        await loadGroups();
        if (selectedGroup === group._id) {
          onGroupSelect(null);
        }
      } catch {
        // Error handled silently
      }
    }
    setMenuAnchor(null);
  };

  const handleSaveGroup = async () => {
    try {
      const groupData = {
        name: formData.name,
        description: formData.description,
        groupType: formData.groupType,
        settings: {
          centralizedRates: formData.centralizedRates,
          centralizedInventory: formData.centralizedInventory,
          sharedGuestDatabase: formData.sharedGuestDatabase,
          rateManagement: {
            autoSync: formData.autoSync,
            syncFrequency: formData.syncFrequency,
            allowPropertyOverrides: formData.allowPropertyOverrides,
            requireApproval: formData.requireApproval,
            conflictResolution: formData.conflictResolution
          }
        }
      };

      if (editingGroup) {
        await propertyGroupsApi.updateGroup(editingGroup._id, groupData);
      } else {
        await propertyGroupsApi.createGroup(groupData);
      }

      await loadGroups();
      setDialogOpen(false);
      resetForm();
    } catch {
      // Error handled silently
    }
  };

  const handleSyncGroup = async (groupId: string) => {
    try {
      await centralizedRatesApi.syncRates(groupId);
      await loadGroups();
    } catch {
      // Error handled silently
    }
    setMenuAnchor(null);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      groupType: 'chain',
      centralizedRates: true,
      centralizedInventory: false,
      sharedGuestDatabase: true,
      autoSync: true,
      syncFrequency: 'daily',
      allowPropertyOverrides: true,
      requireApproval: false,
      conflictResolution: 'alert_only'
    });
  };

  const handleMenuClick = (event: React.MouseEvent<HTMLElement>, group: PropertyGroup) => {
    setMenuAnchor(event.currentTarget);
    setSelectedMenuGroup(group);
  };

  const handleMenuClose = () => {
    setMenuAnchor(null);
    setSelectedMenuGroup(null);
  };

  const getGroupTypeLabel = (type: string) => {
    switch (type) {
      case 'chain': return 'Hotel Chain';
      case 'franchise': return 'Franchise';
      case 'management_company': return 'Management Company';
      case 'independent': return 'Independent';
      default: return type;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'success';
      case 'inactive': return 'default';
      case 'suspended': return 'error';
      default: return 'default';
    }
  };

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h5">Property Groups</Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleCreateGroup}
        >
          Create Group
        </Button>
      </Box>

      {groups.length === 0 && !loading ? (
        <Alert severity="info">
          No property groups found. Create your first group to start managing centralized rates.
        </Alert>
      ) : (
        <Grid container spacing={3}>
          {groups.map((group) => (
            <Grid item xs={12} key={group._id}>
              <Card 
                variant={selectedGroup === group._id ? "outlined" : "elevation"}
                sx={{ 
                  border: selectedGroup === group._id ? 2 : 0,
                  borderColor: selectedGroup === group._id ? 'primary.main' : 'transparent'
                }}
              >
                <CardContent>
                  <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
                    <Box flex={1}>
                      <Box display="flex" alignItems="center" gap={2} mb={1}>
                        <Typography variant="h6">{group.name}</Typography>
                        <Chip 
                          label={group.status} 
                          color={getStatusColor(group.status)} 
                          size="small" 
                        />
                        <Chip 
                          label={getGroupTypeLabel(group.groupType)} 
                          variant="outlined" 
                          size="small" 
                        />
                      </Box>
                      <Typography variant="body2" color="text.secondary" paragraph>
                        {group.description}
                      </Typography>
                    </Box>
                    
                    <Box display="flex" gap={1}>
                      <Button
                        size="small"
                        variant={selectedGroup === group._id ? "contained" : "outlined"}
                        onClick={() => onGroupSelect(selectedGroup === group._id ? null : group._id)}
                      >
                        {selectedGroup === group._id ? 'Selected' : 'Select'}
                      </Button>
                      <IconButton 
                        size="small"
                        onClick={(e) => handleMenuClick(e, group)}
                      >
                        <MoreVertIcon />
                      </IconButton>
                    </Box>
                  </Box>

                  <Grid container spacing={2} mb={2}>
                    <Grid item xs={12} sm={3}>
                      <Box textAlign="center">
                        <Typography variant="h6" color="primary">
                          {group.metrics.totalProperties}
                        </Typography>
                        <Typography variant="caption">Properties</Typography>
                      </Box>
                    </Grid>
                    <Grid item xs={12} sm={3}>
                      <Box textAlign="center">
                        <Typography variant="h6" color="secondary">
                          {group.metrics.totalRooms}
                        </Typography>
                        <Typography variant="caption">Total Rooms</Typography>
                      </Box>
                    </Grid>
                    <Grid item xs={12} sm={3}>
                      <Box textAlign="center">
                        <Typography variant="h6" color="info.main">
                          {group.metrics.activeUsers}
                        </Typography>
                        <Typography variant="caption">Active Users</Typography>
                      </Box>
                    </Grid>
                    <Grid item xs={12} sm={3}>
                      <Box textAlign="center">
                        <Typography variant="h6" color="success.main">
                          {(group.metrics.averageOccupancyRate * 100).toFixed(1)}%
                        </Typography>
                        <Typography variant="caption">Avg Occupancy</Typography>
                      </Box>
                    </Grid>
                  </Grid>

                  <Accordion>
                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                      <Typography variant="subtitle2">Settings & Properties</Typography>
                    </AccordionSummary>
                    <AccordionDetails>
                      <Grid container spacing={3}>
                        <Grid item xs={12} md={6}>
                          <Typography variant="subtitle2" gutterBottom>Integration Settings</Typography>
                          <Box>
                            <Box display="flex" alignItems="center" justifyContent="space-between" py={0.5}>
                              <Typography variant="body2">Centralized Rates:</Typography>
                              <Chip 
                                label={group.settings.centralizedRates ? 'Enabled' : 'Disabled'} 
                                color={group.settings.centralizedRates ? 'success' : 'default'} 
                                size="small" 
                              />
                            </Box>
                            <Box display="flex" alignItems="center" justifyContent="space-between" py={0.5}>
                              <Typography variant="body2">Auto Sync:</Typography>
                              <Chip 
                                label={group.settings.rateManagement.autoSync ? 'On' : 'Off'} 
                                color={group.settings.rateManagement.autoSync ? 'success' : 'default'} 
                                size="small" 
                              />
                            </Box>
                            <Box display="flex" alignItems="center" justifyContent="space-between" py={0.5}>
                              <Typography variant="body2">Sync Frequency:</Typography>
                              <Typography variant="body2" color="text.secondary">
                                {group.settings.rateManagement.syncFrequency}
                              </Typography>
                            </Box>
                          </Box>
                        </Grid>
                        
                        <Grid item xs={12} md={6}>
                          <Typography variant="subtitle2" gutterBottom>Properties ({group.properties.length})</Typography>
                          <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 200 }}>
                            <Table size="small">
                              <TableHead>
                                <TableRow>
                                  <TableCell>Name</TableCell>
                                  <TableCell>Location</TableCell>
                                  <TableCell>Rooms</TableCell>
                                  <TableCell>Status</TableCell>
                                </TableRow>
                              </TableHead>
                              <TableBody>
                                {group.properties.map((property) => (
                                  <TableRow key={property._id}>
                                    <TableCell>{property.name}</TableCell>
                                    <TableCell>{property.location}</TableCell>
                                    <TableCell>{property.roomCount}</TableCell>
                                    <TableCell>
                                      <Chip 
                                        label={property.isActive ? 'Active' : 'Inactive'} 
                                        color={property.isActive ? 'success' : 'default'} 
                                        size="small" 
                                      />
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </TableContainer>
                        </Grid>
                      </Grid>
                    </AccordionDetails>
                  </Accordion>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Context Menu */}
      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={() => handleEditGroup(selectedMenuGroup!)}>
          <EditIcon fontSize="small" sx={{ mr: 1 }} />
          Edit Group
        </MenuItem>
        <MenuItem onClick={() => handleSyncGroup(selectedMenuGroup!._id)}>
          <SyncIcon fontSize="small" sx={{ mr: 1 }} />
          Sync Rates
        </MenuItem>
        <Divider />
        <MenuItem 
          onClick={() => handleDeleteGroup(selectedMenuGroup!)}
          sx={{ color: 'error.main' }}
        >
          <DeleteIcon fontSize="small" sx={{ mr: 1 }} />
          Delete Group
        </MenuItem>
      </Menu>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          {editingGroup ? 'Edit Property Group' : 'Create Property Group'}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={3} sx={{ mt: 1 }}>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Group Name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                fullWidth
                required
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Group Type</InputLabel>
                <Select
                  value={formData.groupType}
                  onChange={(e) => setFormData({ ...formData, groupType: e.target.value as string })}
                  label="Group Type"
                >
                  <MenuItem value="chain">Hotel Chain</MenuItem>
                  <MenuItem value="franchise">Franchise</MenuItem>
                  <MenuItem value="management_company">Management Company</MenuItem>
                  <MenuItem value="independent">Independent</MenuItem>
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
            
            <Grid item xs={12}>
              <Typography variant="h6" gutterBottom>Integration Settings</Typography>
            </Grid>
            
            <Grid item xs={12} sm={4}>
              <FormControlLabel
                control={
                  <Switch
                    checked={formData.centralizedRates}
                    onChange={(e) => setFormData({ ...formData, centralizedRates: e.target.checked })}
                  />
                }
                label="Centralized Rates"
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <FormControlLabel
                control={
                  <Switch
                    checked={formData.centralizedInventory}
                    onChange={(e) => setFormData({ ...formData, centralizedInventory: e.target.checked })}
                  />
                }
                label="Centralized Inventory"
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <FormControlLabel
                control={
                  <Switch
                    checked={formData.sharedGuestDatabase}
                    onChange={(e) => setFormData({ ...formData, sharedGuestDatabase: e.target.checked })}
                  />
                }
                label="Shared Guest Database"
              />
            </Grid>

            {formData.centralizedRates && (
              <>
                <Grid item xs={12}>
                  <Typography variant="h6" gutterBottom>Rate Management Settings</Typography>
                </Grid>
                
                <Grid item xs={12} sm={6}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={formData.autoSync}
                        onChange={(e) => setFormData({ ...formData, autoSync: e.target.checked })}
                      />
                    }
                    label="Auto Sync Rates"
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth>
                    <InputLabel>Sync Frequency</InputLabel>
                    <Select
                      value={formData.syncFrequency}
                      onChange={(e) => setFormData({ ...formData, syncFrequency: e.target.value })}
                      label="Sync Frequency"
                    >
                      <MenuItem value="real_time">Real Time</MenuItem>
                      <MenuItem value="hourly">Hourly</MenuItem>
                      <MenuItem value="daily">Daily</MenuItem>
                      <MenuItem value="weekly">Weekly</MenuItem>
                      <MenuItem value="manual">Manual</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                
                <Grid item xs={12} sm={6}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={formData.allowPropertyOverrides}
                        onChange={(e) => setFormData({ ...formData, allowPropertyOverrides: e.target.checked })}
                      />
                    }
                    label="Allow Property Overrides"
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={formData.requireApproval}
                        onChange={(e) => setFormData({ ...formData, requireApproval: e.target.checked })}
                      />
                    }
                    label="Require Approval"
                  />
                </Grid>
                
                <Grid item xs={12}>
                  <FormControl fullWidth>
                    <InputLabel>Conflict Resolution</InputLabel>
                    <Select
                      value={formData.conflictResolution}
                      onChange={(e) => setFormData({ ...formData, conflictResolution: e.target.value })}
                      label="Conflict Resolution"
                    >
                      <MenuItem value="centralized_wins">Centralized Wins</MenuItem>
                      <MenuItem value="property_wins">Property Wins</MenuItem>
                      <MenuItem value="manual_resolve">Manual Resolve</MenuItem>
                      <MenuItem value="alert_only">Alert Only</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
              </>
            )}
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleSaveGroup} variant="contained">
            {editingGroup ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default PropertyGroupManager;