import React, { useState, useEffect, useRef} from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Grid,
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
  Tabs,
  Tab,
  Alert,
  CircularProgress,
  Menu,
  MenuItem as MenuItemComponent,
  Divider,
  Tooltip,
  Paper,
  Avatar,
  LinearProgress
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  MoreVert as MoreVertIcon,
  Search as SearchIcon,
  Download as DownloadIcon,
  Upload as UploadIcon,
  TrendingUp as AnalyticsIcon,
  ContentCopy as CloneIcon,
  PowerSettingsNew as StatusIcon,
  Science as TestIcon,
  CreditCard as CreditCardIcon,
  Payment as PaymentIcon,
  Money as MoneyIcon,
  Receipt as ReceiptIcon
} from '@mui/icons-material';
import { DataGrid, GridColDef, GridRenderCellParams } from '@mui/x-data-grid';
import { paymentMethodService, PaymentMethod, PaymentMethodType, GatewayProvider } from '../../services/paymentMethodService';
import { ApplyToSelector, ApplyToConfirmation, ApplyToScope } from '../../components/settings/ApplyToSelector';
import { useSettingsInheritance, useAffectedPropertiesCount } from '../../hooks/useSettingsInheritance';
import { useProperty } from '../../context/PropertyContext';
import { withErrorBoundary } from '../../components/ErrorBoundary';
import EmptyState from '../../components/ui/EmptyState';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index, ...other }) => (
  <div
    role="tabpanel"
    hidden={value !== index}
    id={`payment-methods-tabpanel-${index}`}
    aria-labelledby={`payment-methods-tab-${index}`}
    {...other}
  >
    {value === index && (
      <Box sx={{ p: 3 }}>
        {children}
      </Box>
    )}
  </div>
);

const AdminPaymentMethods: React.FC = () => {
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [filteredPaymentMethods, setFilteredPaymentMethods] = useState<PaymentMethod[]>([]);
  const [paymentMethodTypes, setPaymentMethodTypes] = useState<PaymentMethodType[]>([]);
  const [gatewayProviders, setGatewayProviders] = useState<GatewayProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentTab, setCurrentTab] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Multi-property support
  const { selectedProperty, selectedPropertyId } = useProperty();
  const [applyToScope, setApplyToScope] = useState<ApplyToScope>('single');
  const [showSuccess, setShowSuccess] = useState(false);

  const {
    useInheritanceStatus,
    applySettings,
    isUpdating,
    updateError,
    showConfirmation,
    pendingUpdate,
    confirmBulkUpdate,
    cancelBulkUpdate,
  } = useSettingsInheritance();

  const { data: inheritanceStatus } = useInheritanceStatus(selectedPropertyId);
  const affectedCount = useAffectedPropertiesCount(
    applyToScope,
    inheritanceStatus?.groupPropertyCount || 0
  );

  // Dialog states
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [cloneDialogOpen, setCloneDialogOpen] = useState(false);
  const [testDialogOpen, setTestDialogOpen] = useState(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethod | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    description: '',
    type: '',
    subtype: '',
    gateway: {
      provider: '',
      configuration: {
        environment: 'sandbox' as 'sandbox' | 'production'
      },
      features: {
        supportsRefunds: true,
        supportsPartialRefunds: true,
        supportsVoids: true,
        supportsCapture: true,
        supportsAuth: true,
        supportsRecurring: false,
        supportsTokenization: false
      }
    },
    fees: {
      fixed: 0,
      percentage: 0,
      minimumFee: 0,
      maximumFee: 0,
      currency: 'USD',
      feeCalculation: 'add_to_total' as 'add_to_total' | 'deduct_from_amount' | 'separate_charge'
    },
    isActive: true,
    isOnline: true,
    isManual: false,
    requiresVerification: false,
    allowsPartialPayments: false,
    allowsOverpayments: false,
    allowedRoles: [] as string[],
    restrictedRoles: [] as string[],
    limits: {
      perTransaction: {
        minAmount: 0,
        maxAmount: 10000
      }
    },
    display: {
      color: '#000000',
      order: 0,
      showInPos: true,
      showInBooking: true,
      showOnWebsite: false
    }
  });

  // Menu state
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [menuPaymentMethod, setMenuPaymentMethod] = useState<PaymentMethod | null>(null);

  const roles = [
    'admin', 'manager', 'supervisor', 'front_desk', 'accounting', 'guest_services'
  ];

  const successTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (successTimerRef.current) clearTimeout(successTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (selectedPropertyId) {
      loadData();
    }
  }, [selectedPropertyId]);

  useEffect(() => {
    filterPaymentMethods();
  }, [paymentMethods, searchTerm, typeFilter, statusFilter]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [paymentMethodsResponse, typesResponse, providersResponse] = await Promise.all([
        paymentMethodService.getPaymentMethods(),
        paymentMethodService.getPaymentMethodTypes(),
        paymentMethodService.getGatewayProviders()
      ]);
      
      setPaymentMethods(paymentMethodsResponse.data.paymentMethods || []);
      setPaymentMethodTypes(typesResponse.data || []);
      setGatewayProviders(providersResponse.data || []);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } }; message?: string };
      setError(error.response?.data?.message || error.message || 'Failed to load payment methods');
    } finally {
      setLoading(false);
    }
  };

  const filterPaymentMethods = () => {
    let filtered = paymentMethods;

    if (searchTerm) {
      filtered = filtered.filter(pm =>
        pm.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        pm.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        pm.description?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (typeFilter !== 'all') {
      filtered = filtered.filter(pm => pm.type === typeFilter);
    }

    if (statusFilter !== 'all') {
      const isActive = statusFilter === 'active';
      filtered = filtered.filter(pm => pm.isActive === isActive);
    }

    setFilteredPaymentMethods(filtered);
  };

  const handleCreatePaymentMethod = async () => {
    try {
      // Multi-property update
      if (applyToScope !== 'single') {
        const result = await applySettings({
          scope: applyToScope,
          propertyId: selectedPropertyId,
          settingUpdates: formData,
          settingType: 'payment_method',
        });

        if (!result) return; // Confirmation dialog shown

        setShowSuccess(true);
        if (successTimerRef.current) clearTimeout(successTimerRef.current);
        successTimerRef.current = setTimeout(() => setShowSuccess(false), 3000);
        setError(null);
        setApplyToScope('single');
      } else {
        await paymentMethodService.createPaymentMethod(formData);
      }
      setCreateDialogOpen(false);
      resetForm();
      loadData();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } }; message?: string };
      setError(error.response?.data?.message || error.message || 'Failed to create payment method');
    }
  };

  const handleUpdatePaymentMethod = async () => {
    if (!selectedPaymentMethod) return;

    try {
      // Multi-property update
      if (applyToScope !== 'single') {
        const result = await applySettings({
          scope: applyToScope,
          propertyId: selectedPropertyId,
          settingUpdates: { id: selectedPaymentMethod._id, ...formData },
          settingType: 'payment_method',
        });

        if (!result) return; // Confirmation dialog shown

        setShowSuccess(true);
        if (successTimerRef.current) clearTimeout(successTimerRef.current);
        successTimerRef.current = setTimeout(() => setShowSuccess(false), 3000);
        setError(null);
        setApplyToScope('single');
      } else {
        await paymentMethodService.updatePaymentMethod(selectedPaymentMethod._id, formData);
      }
      setEditDialogOpen(false);
      resetForm();
      loadData();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } }; message?: string };
      setError(error.response?.data?.message || error.message || 'Failed to update payment method');
    }
  };

  const handleConfirm = async () => {
    if (pendingUpdate) {
      const result = await confirmBulkUpdate();
      if (result) {
        setShowSuccess(true);
        if (successTimerRef.current) clearTimeout(successTimerRef.current);
        successTimerRef.current = setTimeout(() => setShowSuccess(false), 3000);
        setError(null);
        setApplyToScope('single');
        loadData();
      }
    }
  };

  const handleDeletePaymentMethod = async () => {
    if (!selectedPaymentMethod) return;

    try {
      await paymentMethodService.deletePaymentMethod(selectedPaymentMethod._id);
      setDeleteDialogOpen(false);
      setSelectedPaymentMethod(null);
      loadData();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } }; message?: string };
      setError(error.response?.data?.message || error.message || 'Failed to delete payment method');
    }
  };

  const handleClonePaymentMethod = async () => {
    if (!selectedPaymentMethod) return;

    try {
      await paymentMethodService.clonePaymentMethod(selectedPaymentMethod._id, formData.name, formData.code);
      setCloneDialogOpen(false);
      resetForm();
      loadData();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } }; message?: string };
      setError(error.response?.data?.message || error.message || 'Failed to clone payment method');
    }
  };

  const handleToggleStatus = async (paymentMethod: PaymentMethod) => {
    try {
      await paymentMethodService.updatePaymentMethodStatus(paymentMethod._id, !paymentMethod.isActive);
      loadData();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } }; message?: string };
      setError(error.response?.data?.message || error.message || 'Failed to update status');
    }
  };

  const handleTestGateway = async () => {
    if (!selectedPaymentMethod) return;

    try {
      const result = await paymentMethodService.testGatewayConnection(selectedPaymentMethod._id);
      // Show test result in dialog or notification
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } }; message?: string };
      setError(error.response?.data?.message || error.message || 'Failed to test gateway');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      code: '',
      description: '',
      type: '',
      subtype: '',
      gateway: {
        provider: '',
        configuration: {
          environment: 'sandbox'
        },
        features: {
          supportsRefunds: true,
          supportsPartialRefunds: true,
          supportsVoids: true,
          supportsCapture: true,
          supportsAuth: true,
          supportsRecurring: false,
          supportsTokenization: false
        }
      },
      fees: {
        fixed: 0,
        percentage: 0,
        minimumFee: 0,
        maximumFee: 0,
        currency: 'USD',
        feeCalculation: 'add_to_total'
      },
      isActive: true,
      isOnline: true,
      isManual: false,
      requiresVerification: false,
      allowsPartialPayments: false,
      allowsOverpayments: false,
      allowedRoles: [],
      restrictedRoles: [],
      limits: {
        perTransaction: {
          minAmount: 0,
          maxAmount: 10000
        }
      },
      display: {
        color: '#000000',
        order: 0,
        showInPos: true,
        showInBooking: true,
        showOnWebsite: false
      }
    });
  };

  const openEditDialog = (paymentMethod: PaymentMethod) => {
    setSelectedPaymentMethod(paymentMethod);
    setFormData({
      name: paymentMethod.name,
      code: paymentMethod.code,
      description: paymentMethod.description || '',
      type: paymentMethod.type,
      subtype: paymentMethod.subtype || '',
      gateway: {
        provider: paymentMethod.gateway.provider,
        configuration: {
          environment: paymentMethod.gateway.configuration.environment
        },
        features: paymentMethod.gateway.features
      },
      fees: paymentMethod.fees,
      isActive: paymentMethod.isActive,
      isOnline: paymentMethod.isOnline,
      isManual: paymentMethod.isManual,
      requiresVerification: paymentMethod.requiresVerification,
      allowsPartialPayments: paymentMethod.allowsPartialPayments,
      allowsOverpayments: paymentMethod.allowsOverpayments,
      allowedRoles: paymentMethod.allowedRoles,
      restrictedRoles: paymentMethod.restrictedRoles,
      limits: paymentMethod.limits,
      display: paymentMethod.display
    });
    setEditDialogOpen(true);
  };

  const openCloneDialog = (paymentMethod: PaymentMethod) => {
    setSelectedPaymentMethod(paymentMethod);
    setFormData({
      ...formData,
      name: `${paymentMethod.name} (Copy)`,
      code: `${paymentMethod.code}_COPY`
    });
    setCloneDialogOpen(true);
  };

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, paymentMethod: PaymentMethod) => {
    setAnchorEl(event.currentTarget);
    setMenuPaymentMethod(paymentMethod);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setMenuPaymentMethod(null);
  };

  const getTypeIcon = (type: string) => {
    const icons = {
      credit_card: <CreditCardIcon />,
      debit_card: <PaymentIcon />,
      cash: <MoneyIcon />,
      check: <ReceiptIcon />,
      default: <PaymentIcon />
    };
    return icons[type as keyof typeof icons] || icons.default;
  };

  const columns: GridColDef[] = [
    { 
      field: 'name', 
      headerName: 'Name', 
      width: 200,
      renderCell: (params: GridRenderCellParams) => (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Avatar
            sx={{ 
              width: 32, 
              height: 32, 
              bgcolor: paymentMethodService.getTypeColor(params.row.type),
              fontSize: '0.75rem'
            }}
          >
            {getTypeIcon(params.row.type)}
          </Avatar>
          <Typography variant="body2">{params.value}</Typography>
        </Box>
      )
    },
    { field: 'code', headerName: 'Code', width: 120 },
    { 
      field: 'type', 
      headerName: 'Type', 
      width: 140,
      renderCell: (params: GridRenderCellParams) => (
        <Chip 
          label={paymentMethodService.formatTypeName(params.value)} 
          size="small"
          sx={{ 
            bgcolor: paymentMethodService.getTypeColor(params.value),
            color: 'white'
          }}
        />
      )
    },
    { 
      field: 'gateway.provider', 
      headerName: 'Gateway', 
      width: 120,
      renderCell: (params: GridRenderCellParams) => (
        <Chip 
          label={params.row.gateway.provider.toUpperCase()} 
          size="small"
          variant="outlined"
          sx={{ 
            borderColor: paymentMethodService.getGatewayColor(params.row.gateway.provider),
            color: paymentMethodService.getGatewayColor(params.row.gateway.provider)
          }}
        />
      )
    },
    { 
      field: 'isActive', 
      headerName: 'Status', 
      width: 100,
      renderCell: (params: GridRenderCellParams) => (
        <Chip 
          label={params.value ? 'Active' : 'Inactive'} 
          size="small"
          color={params.value ? 'success' : 'default'}
        />
      )
    },
    { 
      field: 'analytics.successRate', 
      headerName: 'Success Rate', 
      width: 120,
      renderCell: (params: GridRenderCellParams) => {
        const rate = parseFloat(params.row.analytics?.successfulTransactions && params.row.analytics?.totalTransactions 
          ? ((params.row.analytics.successfulTransactions / params.row.analytics.totalTransactions) * 100).toFixed(1)
          : '0');
        return (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <LinearProgress
              variant="determinate"
              value={rate}
              color={paymentMethodService.getSuccessRateColor(rate)}
              sx={{ width: 60, height: 8 }}
            />
            <Typography variant="caption">{rate}%</Typography>
          </Box>
        );
      }
    },
    { 
      field: 'analytics.totalTransactions', 
      headerName: 'Transactions', 
      width: 110,
      renderCell: (params: GridRenderCellParams) => (
        <Typography variant="body2">
          {params.row.analytics?.totalTransactions || 0}
        </Typography>
      )
    },
    { 
      field: 'fees.percentage', 
      headerName: 'Fee %', 
      width: 80,
      renderCell: (params: GridRenderCellParams) => (
        <Typography variant="body2">
          {params.row.fees?.percentage || 0}%
        </Typography>
      )
    },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 120,
      sortable: false,
      renderCell: (params: GridRenderCellParams) => (
        <IconButton
          size="small"
          onClick={(e) => handleMenuOpen(e, params.row)}
        >
          <MoreVertIcon />
        </IconButton>
      )
    }
  ];

  const getSummaryCards = () => {
    const total = paymentMethods.length;
    const active = paymentMethods.filter(pm => pm.isActive).length;
    const online = paymentMethods.filter(pm => pm.isOnline).length;
    const totalTransactions = paymentMethods.reduce((sum, pm) => sum + (pm.analytics?.totalTransactions || 0), 0);

    return [
      { label: 'Total Methods', value: total, color: 'primary' },
      { label: 'Active', value: active, color: 'success' },
      { label: 'Online', value: online, color: 'info' },
      { label: 'Transactions', value: totalTransactions.toLocaleString(), color: 'warning' }
    ];
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      {/* Success Message */}
      {showSuccess && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setShowSuccess(false)}>
          Settings updated successfully!
          {applyToScope !== 'single' && affectedCount > 1 && (
            <Typography variant="body2">Changes applied to {affectedCount} properties</Typography>
          )}
        </Alert>
      )}

      {/* Error Message */}
      {(error || updateError) && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error || updateError}
        </Alert>
      )}

      {/* Inheritance Status Card */}
      {inheritanceStatus?.isInheriting && inheritanceStatus?.hasGroup && (
        <Alert severity="info" sx={{ mb: 2 }}>
          <Typography variant="body2" fontWeight="medium">
            This property is part of: {inheritanceStatus.groupName}
          </Typography>
          <Typography variant="caption">
            Payment method settings can be managed centrally for all properties in this group.
            {inheritanceStatus.lastSyncedAt && (
              <span> Last synced: {new Date(inheritanceStatus.lastSyncedAt).toLocaleString()}</span>
            )}
          </Typography>
        </Alert>
      )}

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1">
          Payment Methods
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setCreateDialogOpen(true)}
        >
          Add Payment Method
        </Button>
      </Box>

      {/* Summary Cards */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        {getSummaryCards().map((card, index) => (
          <Grid item xs={12} sm={6} md={3} key={`-${index}-${card.label}`}>
            <Card>
              <CardContent sx={{ textAlign: 'center' }}>
                <Typography variant="h4" color={`${card.color}.main`}>
                  {card.value}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {card.label}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Filters */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={4}>
            <TextField
              fullWidth
              label="Search payment methods..."
              variant="outlined"
              size="small"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              InputProps={{
                startAdornment: <SearchIcon sx={{ color: 'text.secondary', mr: 1 }} />
              }}
            />
          </Grid>
          <Grid item xs={12} md={3}>
            <FormControl fullWidth size="small">
              <InputLabel>Type</InputLabel>
              <Select
                value={typeFilter}
                label="Type"
                onChange={(e) => setTypeFilter(e.target.value)}
              >
                <MenuItem value="all">All Types</MenuItem>
                {paymentMethodTypes.map(type => (
                  <MenuItem key={type.value} value={type.value}>
                    {type.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={3}>
            <FormControl fullWidth size="small">
              <InputLabel>Status</InputLabel>
              <Select
                value={statusFilter}
                label="Status"
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <MenuItem value="all">All Status</MenuItem>
                <MenuItem value="active">Active</MenuItem>
                <MenuItem value="inactive">Inactive</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={2}>
            <Button
              fullWidth
              variant="outlined"
              startIcon={<DownloadIcon />}
              onClick={() => paymentMethodService.exportPaymentMethods('csv')}
            >
              Export
            </Button>
          </Grid>
        </Grid>
      </Paper>

      {/* Multi-property selector */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <ApplyToSelector
          value={applyToScope}
          onChange={setApplyToScope}
          isInGroup={inheritanceStatus?.hasGroup || false}
          groupName={inheritanceStatus?.groupName}
          totalProperties={inheritanceStatus?.groupPropertyCount || 0}
          showWarning={true}
          warningMessage="Changes to payment method settings will affect payment processing across all properties in the selected scope."
        />
      </Paper>

      {/* Data Grid */}
      <Card>
        <CardContent>
          {filteredPaymentMethods.length === 0 ? (
            <EmptyState
              title="No payment methods found"
              description="There are no payment methods matching your criteria. Add a new payment method to get started."
            />
          ) : (
            <DataGrid
              rows={filteredPaymentMethods}
              columns={columns}
              pageSize={25}
              rowsPerPageOptions={[25, 50, 100]}
              autoHeight
              disableSelectionOnClick
              getRowId={(row) => row._id}
              loading={loading}
            />
          )}
        </CardContent>
      </Card>

      {/* Context Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItemComponent onClick={() => { openEditDialog(menuPaymentMethod!); handleMenuClose(); }}>
          <EditIcon sx={{ mr: 1 }} /> Edit
        </MenuItemComponent>
        <MenuItemComponent onClick={() => { openCloneDialog(menuPaymentMethod!); handleMenuClose(); }}>
          <CloneIcon sx={{ mr: 1 }} /> Clone
        </MenuItemComponent>
        <MenuItemComponent onClick={() => { setSelectedPaymentMethod(menuPaymentMethod); setTestDialogOpen(true); handleMenuClose(); }}>
          <TestIcon sx={{ mr: 1 }} /> Test Gateway
        </MenuItemComponent>
        <MenuItemComponent onClick={() => { handleToggleStatus(menuPaymentMethod!); handleMenuClose(); }}>
          <StatusIcon sx={{ mr: 1 }} /> 
          {menuPaymentMethod?.isActive ? 'Deactivate' : 'Activate'}
        </MenuItemComponent>
        <Divider />
        <MenuItemComponent 
          onClick={() => { setSelectedPaymentMethod(menuPaymentMethod); setDeleteDialogOpen(true); handleMenuClose(); }}
          sx={{ color: 'error.main' }}
        >
          <DeleteIcon sx={{ mr: 1 }} /> Delete
        </MenuItemComponent>
      </Menu>

      {/* Basic Create/Edit Dialog - Simplified for brevity */}
      <Dialog 
        open={createDialogOpen || editDialogOpen} 
        onClose={() => { setCreateDialogOpen(false); setEditDialogOpen(false); resetForm(); }}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          {createDialogOpen ? 'Create New Payment Method' : 'Edit Payment Method'}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={3} sx={{ pt: 2 }}>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Payment Method Name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Payment Method Code"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                required
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                multiline
                rows={3}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth required>
                <InputLabel>Type</InputLabel>
                <Select
                  value={formData.type}
                  label="Type"
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                >
                  {paymentMethodTypes.map(type => (
                    <MenuItem key={type.value} value={type.value}>
                      {type.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth required>
                <InputLabel>Gateway Provider</InputLabel>
                <Select
                  value={formData.gateway.provider}
                  label="Gateway Provider"
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    gateway: { ...formData.gateway, provider: e.target.value } 
                  })}
                >
                  {gatewayProviders.map(provider => (
                    <MenuItem key={provider.value} value={provider.value}>
                      {provider.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={formData.isActive}
                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  />
                }
                label="Active"
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setCreateDialogOpen(false); setEditDialogOpen(false); resetForm(); }}>
            Cancel
          </Button>
          <Button 
            onClick={createDialogOpen ? handleCreatePaymentMethod : handleUpdatePaymentMethod}
            variant="contained"
          >
            {createDialogOpen ? 'Create' : 'Update'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Clone Dialog */}
      <Dialog open={cloneDialogOpen} onClose={() => { setCloneDialogOpen(false); resetForm(); }}>
        <DialogTitle>Clone Payment Method</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ pt: 2 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="New Name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="New Code"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                required
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setCloneDialogOpen(false); resetForm(); }}>Cancel</Button>
          <Button onClick={handleClonePaymentMethod} variant="contained">Clone</Button>
        </DialogActions>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Delete Payment Method</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete "{selectedPaymentMethod?.name}"? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleDeletePaymentMethod} color="error" variant="contained">Delete</Button>
        </DialogActions>
      </Dialog>

      {/* Confirmation Dialog */}
      <ApplyToConfirmation
        isOpen={showConfirmation}
        scope={applyToScope}
        affectedCount={affectedCount}
        settingName="Payment Method Settings"
        groupName={inheritanceStatus?.groupName}
        onConfirm={handleConfirm}
        onCancel={cancelBulkUpdate}
      />
    </Box>
  );
};

export default withErrorBoundary(AdminPaymentMethods, { level: 'page' });