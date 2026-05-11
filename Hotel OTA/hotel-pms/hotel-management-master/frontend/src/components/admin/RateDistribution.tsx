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
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Checkbox,
  IconButton,
  Tooltip,
  Alert,
  LinearProgress,
  Tabs,
  Tab,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  ListItemSecondaryAction,
  Collapse,
  Divider
} from '@mui/material';
import {
  Share as ShareIcon,
  Sync as SyncIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Schedule as ScheduleIcon,
  Visibility as VisibilityIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Timeline as TimelineIcon,
  Assignment as AssignmentIcon
} from '@mui/icons-material';
import { centralizedRatesApi } from '../../services/api';

interface RateDistributionProps {
  selectedGroup: string | null;
}

interface CentralizedRate {
  _id: string;
  rateId: string;
  rateName: string;
  status: 'active' | 'inactive' | 'draft' | 'suspended';
  propertyGroup: {
    groupId: string;
    groupName: string;
    properties: string[];
  };
  pricing: {
    baseRate: number;
    currency: string;
  };
  distributionStatus: {
    totalProperties: number;
    synchronized: number;
    pending: number;
    conflicts: number;
    lastSync: string;
  };
  effectiveDates: {
    startDate: string;
    endDate: string;
  };
}

interface PropertyDistribution {
  propertyId: string;
  propertyName: string;
  location: string;
  status: 'synchronized' | 'pending' | 'conflict' | 'error';
  lastSync: string;
  conflictDetails?: {
    type: string;
    description: string;
    localRate: number;
    centralizedRate: number;
  };
  overrides: Array<{
    field: string;
    localValue: unknown;
    centralizedValue: unknown;
    reason: string;
  }>;
}

interface Conflict {
  _id: string;
  rateId: string;
  rateName: string;
  propertyId: string;
  propertyName: string;
  conflictType: 'rate_mismatch' | 'date_overlap' | 'policy_conflict' | 'availability_conflict';
  description: string;
  centralizedValue: unknown;
  propertyValue: unknown;
  priority: 'high' | 'medium' | 'low';
  status: 'pending' | 'resolved' | 'ignored';
  createdAt: string;
}

const RateDistribution: React.FC<RateDistributionProps> = ({ selectedGroup }) => {
  const [currentTab, setCurrentTab] = useState(0);
  const [rates, setRates] = useState<CentralizedRate[]>([]);
  const [selectedRate, setSelectedRate] = useState<string | null>(null);
  const [distribution, setDistribution] = useState<PropertyDistribution[]>([]);
  const [conflicts, setConflicts] = useState<Conflict[]>([]);
  const [loading, setLoading] = useState(false);
  const [distributionDialogOpen, setDistributionDialogOpen] = useState(false);
  const [selectedProperties, setSelectedProperties] = useState<string[]>([]);
  const [expandedConflicts, setExpandedConflicts] = useState<string[]>([]);
  const [previewData, setPreviewData] = useState<unknown>(null);

  useEffect(() => {
    if (selectedGroup) {
      loadRates();
      loadConflicts();
    }
  }, [selectedGroup]);

  useEffect(() => {
    if (selectedRate) {
      loadDistribution();
    }
  }, [selectedRate]);

  const loadRates = async () => {
    if (!selectedGroup) return;
    
    try {
      setLoading(true);
      const response = await centralizedRatesApi.getRates({ groupId: selectedGroup });
      setRates(response.data.rates);
    } catch {
      // Error handled silently
    } finally {
      setLoading(false);
    }
  };

  const loadDistribution = async () => {
    if (!selectedRate) return;
    
    try {
      const response = await centralizedRatesApi.getRateDistribution(selectedRate);
      setDistribution(response.data);
    } catch {
      // Error handled silently
    }
  };

  const loadConflicts = async () => {
    if (!selectedGroup) return;
    
    try {
      const response = await centralizedRatesApi.getConflicts({ groupId: selectedGroup });
      setConflicts(response.data.conflicts);
    } catch {
      // Error handled silently
    }
  };

  const handleDistributeRate = async () => {
    if (!selectedRate || selectedProperties.length === 0) return;
    
    try {
      await centralizedRatesApi.distributeRate(selectedRate, {
        propertyIds: selectedProperties
      });
      await loadDistribution();
      setDistributionDialogOpen(false);
      setSelectedProperties([]);
    } catch {
      // Error handled silently
    }
  };

  const handlePreviewDistribution = async (rateId: string, propertyIds: string[]) => {
    try {
      const response = await centralizedRatesApi.previewDistribution(rateId, {
        propertyIds
      });
      setPreviewData(response.data);
    } catch {
      // Error handled silently
    }
  };

  const handleSyncRate = async (rateId: string) => {
    try {
      await centralizedRatesApi.syncRate(rateId);
      await loadDistribution();
    } catch {
      // Error handled silently
    }
  };

  const handleResolveConflict = async (conflictId: string, resolution: string, notes?: string) => {
    try {
      await centralizedRatesApi.resolveConflict(conflictId, { resolution, notes });
      await loadConflicts();
      await loadDistribution();
    } catch {
      // Error handled silently
    }
  };

  const toggleConflictExpansion = (conflictId: string) => {
    setExpandedConflicts(prev => 
      prev.includes(conflictId) 
        ? prev.filter(id => id !== conflictId)
        : [...prev, conflictId]
    );
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'synchronized':
        return <CheckCircleIcon color="success" />;
      case 'pending':
        return <ScheduleIcon color="warning" />;
      case 'conflict':
        return <WarningIcon color="error" />;
      case 'error':
        return <ErrorIcon color="error" />;
      default:
        return null;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'synchronized': return 'success';
      case 'pending': return 'warning';
      case 'conflict': return 'error';
      case 'error': return 'error';
      default: return 'default';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'error';
      case 'medium': return 'warning';
      case 'low': return 'info';
      default: return 'default';
    }
  };

  if (!selectedGroup) {
    return (
      <Alert severity="info">
        Please select a property group to manage rate distribution.
      </Alert>
    );
  }

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h5">Rate Distribution</Typography>
        <Button
          variant="contained"
          startIcon={<ShareIcon />}
          onClick={() => setDistributionDialogOpen(true)}
          disabled={!selectedRate}
        >
          Distribute Rate
        </Button>
      </Box>

      <Paper sx={{ width: '100%', mb: 3 }}>
        <Tabs value={currentTab} onChange={(e, v) => setCurrentTab(v)}>
          <Tab icon={<AssignmentIcon />} label="Rate Management" />
          <Tab icon={<WarningIcon />} label={`Conflicts (${conflicts.length})`} />
          <Tab icon={<TimelineIcon />} label="Distribution History" />
        </Tabs>

        {currentTab === 0 && (
          <Box p={3}>
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>Centralized Rates</Typography>
                    <List>
                      {rates.map((rate) => (
                        <ListItem
                          key={rate._id}
                          button
                          selected={selectedRate === rate._id}
                          onClick={() => setSelectedRate(rate._id)}
                        >
                          <ListItemIcon>
                            {getStatusIcon(rate.distributionStatus.synchronized === rate.distributionStatus.totalProperties ? 'synchronized' : 
                                        rate.distributionStatus.conflicts > 0 ? 'conflict' : 'pending')}
                          </ListItemIcon>
                          <ListItemText
                            primary={rate.rateName}
                            secondary={
                              <Box>
                                <Typography variant="caption" display="block">
                                  {rate.pricing.currency} {rate.pricing.baseRate} • {rate.distributionStatus.synchronized}/{rate.distributionStatus.totalProperties} synced
                                </Typography>
                                {rate.distributionStatus.conflicts > 0 && (
                                  <Chip 
                                    label={`${rate.distributionStatus.conflicts} conflicts`}
                                    color="error"
                                    size="small"
                                    sx={{ mt: 0.5 }}
                                  />
                                )}
                              </Box>
                            }
                          />
                          <ListItemSecondaryAction>
                            <Chip 
                              label={rate.status} 
                              color={getStatusColor(rate.status)} 
                              size="small" 
                            />
                          </ListItemSecondaryAction>
                        </ListItem>
                      ))}
                    </List>
                  </CardContent>
                </Card>
              </Grid>

              <Grid item xs={12} md={6}>
                {selectedRate && (
                  <Card>
                    <CardContent>
                      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                        <Typography variant="h6">Distribution Status</Typography>
                        <Button
                          size="small"
                          startIcon={<SyncIcon />}
                          onClick={() => handleSyncRate(selectedRate)}
                        >
                          Sync Now
                        </Button>
                      </Box>

                      {loading ? (
                        <LinearProgress />
                      ) : (
                        <TableContainer>
                          <Table size="small">
                            <TableHead>
                              <TableRow>
                                <TableCell>Property</TableCell>
                                <TableCell>Status</TableCell>
                                <TableCell>Last Sync</TableCell>
                                <TableCell>Actions</TableCell>
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              {distribution.map((dist) => (
                                <TableRow key={dist.propertyId}>
                                  <TableCell>
                                    <Typography variant="body2" fontWeight="bold">
                                      {dist.propertyName}
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary">
                                      {dist.location}
                                    </Typography>
                                  </TableCell>
                                  <TableCell>
                                    <Box display="flex" alignItems="center" gap={1}>
                                      {getStatusIcon(dist.status)}
                                      <Chip 
                                        label={dist.status} 
                                        color={getStatusColor(dist.status)} 
                                        size="small" 
                                      />
                                    </Box>
                                    {dist.overrides.length > 0 && (
                                      <Typography variant="caption" display="block" color="warning.main">
                                        {dist.overrides.length} overrides
                                      </Typography>
                                    )}
                                  </TableCell>
                                  <TableCell>
                                    <Typography variant="caption">
                                      {new Date(dist.lastSync).toLocaleString()}
                                    </Typography>
                                  </TableCell>
                                  <TableCell>
                                    <Tooltip title="View Details">
                                      <IconButton size="small">
                                        <VisibilityIcon fontSize="small" />
                                      </IconButton>
                                    </Tooltip>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </TableContainer>
                      )}
                    </CardContent>
                  </Card>
                )}
              </Grid>
            </Grid>
          </Box>
        )}

        {currentTab === 1 && (
          <Box p={3}>
            <Typography variant="h6" gutterBottom>Rate Conflicts</Typography>
            {conflicts.length === 0 ? (
              <Alert severity="success">No conflicts found. All rates are synchronized.</Alert>
            ) : (
              <List>
                {conflicts.map((conflict) => (
                  <React.Fragment key={conflict._id}>
                    <ListItem>
                      <ListItemIcon>
                        <WarningIcon color="error" />
                      </ListItemIcon>
                      <ListItemText
                        primary={
                          <Box display="flex" alignItems="center" gap={2}>
                            <Typography variant="subtitle2">{conflict.rateName}</Typography>
                            <Chip 
                              label={conflict.priority} 
                              color={getPriorityColor(conflict.priority)} 
                              size="small" 
                            />
                            <Chip 
                              label={conflict.conflictType.replace('_', ' ')} 
                              variant="outlined" 
                              size="small" 
                            />
                          </Box>
                        }
                        secondary={
                          <Box>
                            <Typography variant="body2" color="text.secondary">
                              {conflict.propertyName} • {conflict.description}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              Created: {new Date(conflict.createdAt).toLocaleString()}
                            </Typography>
                          </Box>
                        }
                      />
                      <ListItemSecondaryAction>
                        <IconButton 
                          onClick={() => toggleConflictExpansion(conflict._id)}
                          size="small"
                        >
                          {expandedConflicts.includes(conflict._id) ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                        </IconButton>
                      </ListItemSecondaryAction>
                    </ListItem>

                    <Collapse in={expandedConflicts.includes(conflict._id)} timeout="auto" unmountOnExit>
                      <Box sx={{ pl: 9, pr: 2, pb: 2 }}>
                        <Grid container spacing={2}>
                          <Grid item xs={12} sm={6}>
                            <Paper sx={{ p: 2, bgcolor: 'error.light', color: 'error.contrastText' }}>
                              <Typography variant="subtitle2" gutterBottom>Property Value</Typography>
                              <Typography variant="body2">
                                {JSON.stringify(conflict.propertyValue, null, 2)}
                              </Typography>
                            </Paper>
                          </Grid>
                          <Grid item xs={12} sm={6}>
                            <Paper sx={{ p: 2, bgcolor: 'success.light', color: 'success.contrastText' }}>
                              <Typography variant="subtitle2" gutterBottom>Centralized Value</Typography>
                              <Typography variant="body2">
                                {JSON.stringify(conflict.centralizedValue, null, 2)}
                              </Typography>
                            </Paper>
                          </Grid>
                          <Grid item xs={12}>
                            <Box display="flex" gap={1}>
                              <Button
                                size="small"
                                variant="contained"
                                color="success"
                                onClick={() => handleResolveConflict(conflict._id, 'accept_centralized')}
                              >
                                Accept Centralized
                              </Button>
                              <Button
                                size="small"
                                variant="contained"
                                color="warning"
                                onClick={() => handleResolveConflict(conflict._id, 'accept_property')}
                              >
                                Accept Property
                              </Button>
                              <Button
                                size="small"
                                variant="outlined"
                                onClick={() => handleResolveConflict(conflict._id, 'create_exception')}
                              >
                                Create Exception
                              </Button>
                            </Box>
                          </Grid>
                        </Grid>
                      </Box>
                    </Collapse>
                    <Divider />
                  </React.Fragment>
                ))}
              </List>
            )}
          </Box>
        )}

        {currentTab === 2 && (
          <Box p={3}>
            <Typography variant="h6" gutterBottom>Distribution History</Typography>
            <Alert severity="info">
              Distribution history tracking will be implemented to show sync logs and changes over time.
            </Alert>
          </Box>
        )}
      </Paper>

      {/* Distribution Dialog */}
      <Dialog open={distributionDialogOpen} onClose={() => setDistributionDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Distribute Rate to Properties</DialogTitle>
        <DialogContent>
          {selectedRate && (
            <Box>
              <Typography variant="subtitle1" gutterBottom>
                Selected Rate: {rates.find(r => r._id === selectedRate)?.rateName}
              </Typography>
              
              <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
                Select Properties:
              </Typography>
              
              <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 400 }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell padding="checkbox">
                        <Checkbox
                          indeterminate={selectedProperties.length > 0 && selectedProperties.length < distribution.length}
                          checked={selectedProperties.length === distribution.length}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedProperties(distribution.map(d => d.propertyId));
                            } else {
                              setSelectedProperties([]);
                            }
                          }}
                        />
                      </TableCell>
                      <TableCell>Property</TableCell>
                      <TableCell>Current Status</TableCell>
                      <TableCell>Last Sync</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {distribution.map((dist) => (
                      <TableRow key={dist.propertyId}>
                        <TableCell padding="checkbox">
                          <Checkbox
                            checked={selectedProperties.includes(dist.propertyId)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedProperties([...selectedProperties, dist.propertyId]);
                              } else {
                                setSelectedProperties(selectedProperties.filter(id => id !== dist.propertyId));
                              }
                            }}
                          />
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" fontWeight="bold">
                            {dist.propertyName}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {dist.location}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Chip 
                            label={dist.status} 
                            color={getStatusColor(dist.status)} 
                            size="small" 
                          />
                        </TableCell>
                        <TableCell>
                          <Typography variant="caption">
                            {new Date(dist.lastSync).toLocaleString()}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>

              {selectedProperties.length > 0 && (
                <Box mt={2}>
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={() => handlePreviewDistribution(selectedRate, selectedProperties)}
                  >
                    Preview Changes
                  </Button>
                  
                  {previewData && (
                    <Paper sx={{ mt: 2, p: 2, bgcolor: 'info.light' }}>
                      <Typography variant="subtitle2" gutterBottom>Preview:</Typography>
                      <Typography variant="body2">
                        {previewData.summary}
                      </Typography>
                    </Paper>
                  )}
                </Box>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDistributionDialogOpen(false)}>Cancel</Button>
          <Button 
            onClick={handleDistributeRate} 
            variant="contained"
            disabled={selectedProperties.length === 0}
          >
            Distribute ({selectedProperties.length} properties)
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default RateDistribution;