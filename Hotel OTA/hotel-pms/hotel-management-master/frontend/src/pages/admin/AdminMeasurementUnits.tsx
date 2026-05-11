import React, { useState, useEffect, useRef} from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Plus,
  Edit,
  Trash2,
  Calculator,
  FileText,
  Settings,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  RefreshCw,
  ArrowRightLeft,
  Ruler
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { api } from '../../services/api';
import { ApplyToSelector, ApplyToConfirmation, ApplyToScope } from '../../components/settings/ApplyToSelector';
import { useSettingsInheritance, useAffectedPropertiesCount } from '../../hooks/useSettingsInheritance';
import { useProperty } from '../../context/PropertyContext';
import { withErrorBoundary } from '../../components/ErrorBoundary';

interface ConversionFactor {
  targetUnit: string;
  factor: number;
  offset: number;
}

interface MeasurementUnit {
  _id: string;
  unitId: string;
  name: string;
  symbol: string;
  displayName: string;
  description?: string;
  unitType: string;
  unitSystem: string;
  isBaseUnit: boolean;
  baseUnit?: string;
  conversionFactors: ConversionFactor[];
  decimalPlaces: number;
  precision: number;
  displayFormat: {
    showSymbol: boolean;
    symbolPosition: 'before' | 'after';
    thousandsSeparator: string;
    decimalSeparator: string;
  };
  isActive: boolean;
  isSystemUnit: boolean;
  usageCount: number;
  lastUsed?: string;
  category: string;
  sortOrder: number;
  minValue: number;
  maxValue?: number;
  allowNegative: boolean;
  posIntegration: {
    isDefaultForType: boolean;
    applicableCategories: string[];
    inventoryTracking: boolean;
  };
  formattedDisplay: string;
  createdAt: string;
  updatedAt: string;
}

interface ConversionResult {
  originalValue: number;
  originalUnit: {
    id: string;
    name: string;
    symbol: string;
  };
  convertedValue: number;
  targetUnit: {
    id: string;
    name: string;
    symbol: string;
  };
  conversionFactor: number;
  conversionOffset: number;
  conversionPath: string;
  precision: number;
  convertedAt: string;
}

const AdminMeasurementUnits: React.FC = () => {
  const [units, setUnits] = useState<MeasurementUnit[]>([]);
  const [selectedUnit, setSelectedUnit] = useState<MeasurementUnit | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isConversionModalOpen, setIsConversionModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [conversionResult, setConversionResult] = useState<ConversionResult | null>(null);

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
  
  const [formData, setFormData] = useState({
    name: '',
    symbol: '',
    displayName: '',
    description: '',
    unitType: '',
    unitSystem: 'METRIC',
    isBaseUnit: false,
    baseUnit: '',
    decimalPlaces: 2,
    precision: 0.01,
    displayFormat: {
      showSymbol: true,
      symbolPosition: 'after' as 'before' | 'after',
      thousandsSeparator: ',',
      decimalSeparator: '.'
    },
    category: 'STANDARD',
    sortOrder: 0,
    minValue: 0,
    maxValue: '',
    allowNegative: false,
    posIntegration: {
      isDefaultForType: false,
      applicableCategories: [] as string[],
      inventoryTracking: true
    }
  });

  const [conversionData, setConversionData] = useState({
    fromUnitId: '',
    toUnitId: '',
    value: 0,
    precision: 6
  });

  const unitTypes = [
    { value: 'WEIGHT', label: 'Weight' },
    { value: 'VOLUME', label: 'Volume' },
    { value: 'QUANTITY', label: 'Quantity' },
    { value: 'LENGTH', label: 'Length' },
    { value: 'AREA', label: 'Area' },
    { value: 'TIME', label: 'Time' },
    { value: 'TEMPERATURE', label: 'Temperature' },
    { value: 'CUSTOM', label: 'Custom' }
  ];

  const unitSystems = [
    { value: 'METRIC', label: 'Metric System' },
    { value: 'IMPERIAL', label: 'Imperial System' },
    { value: 'US_CUSTOMARY', label: 'US Customary' },
    { value: 'CUSTOM', label: 'Custom System' }
  ];

  const categories = [
    { value: 'COMMON', label: 'Common' },
    { value: 'STANDARD', label: 'Standard' },
    { value: 'SPECIALIZED', label: 'Specialized' },
    { value: 'LEGACY', label: 'Legacy' }
  ];

  const posCategories = [
    { value: 'FOOD', label: 'Food' },
    { value: 'BEVERAGE', label: 'Beverage' },
    { value: 'SERVICE', label: 'Service' },
    { value: 'PRODUCT', label: 'Product' },
    { value: 'ALCOHOL', label: 'Alcohol' },
    { value: 'TOBACCO', label: 'Tobacco' },
    { value: 'LUXURY', label: 'Luxury' },
    { value: 'GENERAL', label: 'General' }
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
      fetchUnits();
    }
  }, [selectedPropertyId]);

  const fetchUnits = async () => {
    try {
      setLoading(true);
      const response = await api.get('/pos/measurement-units', {
        params: { page: 1, limit: 100 }
      });
      if (response.data.status === 'success') {
        setUnits(response.data.data.units);
      }
    } catch (error) {
      toast.error('Failed to fetch measurement units');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUnit = async () => {
    if (!formData.name.trim() || !formData.symbol.trim() || !formData.unitType) {
      toast.error('Unit name, symbol, and type are required');
      return;
    }
    try {
      if (applyToScope !== 'single') {
        const result = await applySettings({
          scope: applyToScope,
          propertyId: selectedPropertyId,
          settingUpdates: formData,
          settingType: 'measurement_units',
        });

        if (!result) return; // Confirmation dialog shown

        setShowSuccess(true);
        if (successTimerRef.current) clearTimeout(successTimerRef.current);
        successTimerRef.current = setTimeout(() => setShowSuccess(false), 3000);
        toast.success(`Measurement unit created successfully${
          applyToScope !== 'single' ? ` for ${result.propertiesUpdated} properties` : ''
        }`);
        setApplyToScope('single');
      } else {
        const response = await api.post('/pos/measurement-units', formData);
        if (response.data.status === 'success') {
          toast.success('Measurement unit created successfully');
        }
      }

      fetchUnits();
      setIsCreateModalOpen(false);
      resetForm();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } }; message?: string };
      toast.error(err.response?.data?.message || 'Failed to create unit');
    }
  };

  const handleUpdateUnit = async () => {
    if (!selectedUnit) return;

    try {
      if (applyToScope !== 'single') {
        const result = await applySettings({
          scope: applyToScope,
          propertyId: selectedPropertyId,
          settingUpdates: formData,
          settingType: 'measurement_units',
        });

        if (!result) return; // Confirmation dialog shown

        setShowSuccess(true);
        if (successTimerRef.current) clearTimeout(successTimerRef.current);
        successTimerRef.current = setTimeout(() => setShowSuccess(false), 3000);
        toast.success(`Measurement unit updated successfully${
          applyToScope !== 'single' ? ` for ${result.propertiesUpdated} properties` : ''
        }`);
        setApplyToScope('single');
      } else {
        const response = await api.put(`/pos/measurement-units/${selectedUnit._id}`, formData);
        if (response.data.status === 'success') {
          toast.success('Measurement unit updated successfully');
        }
      }

      fetchUnits();
      setIsEditModalOpen(false);
      setSelectedUnit(null);
      resetForm();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } }; message?: string };
      toast.error(err.response?.data?.message || 'Failed to update unit');
    }
  };

  const handleDeleteUnit = async (unit: MeasurementUnit) => {
    if (!confirm(`Are you sure you want to ${unit.usageCount > 0 ? 'deactivate' : 'delete'} this unit?`)) {
      return;
    }

    try {
      if (applyToScope !== 'single') {
        const result = await applySettings({
          scope: applyToScope,
          propertyId: selectedPropertyId,
          settingUpdates: { unitId: unit._id },
          settingType: 'measurement_units',
        });

        if (!result) return; // Confirmation dialog shown

        setShowSuccess(true);
        if (successTimerRef.current) clearTimeout(successTimerRef.current);
        successTimerRef.current = setTimeout(() => setShowSuccess(false), 3000);
        toast.success(`Measurement unit deleted successfully${
          applyToScope !== 'single' ? ` for ${result.propertiesUpdated} properties` : ''
        }`);
        setApplyToScope('single');
      } else {
        const response = await api.delete(`/pos/measurement-units/${unit._id}`);
        if (response.data.status === 'success') {
          toast.success(response.data.message);
        }
      }

      fetchUnits();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } }; message?: string };
      toast.error(err.response?.data?.message || 'Failed to delete unit');
    }
  };

  const handleConfirm = async () => {
    if (pendingUpdate) {
      const result = await confirmBulkUpdate();
      if (result) {
        setShowSuccess(true);
        if (successTimerRef.current) clearTimeout(successTimerRef.current);
        successTimerRef.current = setTimeout(() => setShowSuccess(false), 3000);
        toast.success(`Updated for ${result.propertiesUpdated} properties`);
        setApplyToScope('single');
        fetchUnits();
      }
    }
  };

  const handleConvertUnits = async () => {
    try {
      const response = await api.post('/pos/measurement-units/convert', conversionData);
      if (response.data.status === 'success') {
        setConversionResult(response.data.data);
        setIsConversionModalOpen(true);
      }
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } }; message?: string };
      toast.error(err.response?.data?.message || 'Failed to convert units');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      symbol: '',
      displayName: '',
      description: '',
      unitType: '',
      unitSystem: 'METRIC',
      isBaseUnit: false,
      baseUnit: '',
      decimalPlaces: 2,
      precision: 0.01,
      displayFormat: {
        showSymbol: true,
        symbolPosition: 'after',
        thousandsSeparator: ',',
        decimalSeparator: '.'
      },
      category: 'STANDARD',
      sortOrder: 0,
      minValue: 0,
      maxValue: '',
      allowNegative: false,
      posIntegration: {
        isDefaultForType: false,
        applicableCategories: [],
        inventoryTracking: true
      }
    });
  };

  const openEditModal = (unit: MeasurementUnit) => {
    setSelectedUnit(unit);
    setFormData({
      name: unit.name,
      symbol: unit.symbol,
      displayName: unit.displayName,
      description: unit.description || '',
      unitType: unit.unitType,
      unitSystem: unit.unitSystem,
      isBaseUnit: unit.isBaseUnit,
      baseUnit: unit.baseUnit || '',
      decimalPlaces: unit.decimalPlaces,
      precision: unit.precision,
      displayFormat: unit.displayFormat,
      category: unit.category,
      sortOrder: unit.sortOrder,
      minValue: unit.minValue,
      maxValue: unit.maxValue?.toString() || '',
      allowNegative: unit.allowNegative,
      posIntegration: unit.posIntegration
    });
    setIsEditModalOpen(true);
  };

  const getUnitTypeColor = (type: string) => {
    const colors = {
      WEIGHT: 'bg-blue-100 text-blue-800',
      VOLUME: 'bg-green-100 text-green-800',
      QUANTITY: 'bg-purple-100 text-purple-800',
      LENGTH: 'bg-orange-100 text-orange-800',
      AREA: 'bg-yellow-100 text-yellow-800',
      TIME: 'bg-red-100 text-red-800',
      TEMPERATURE: 'bg-pink-100 text-pink-800',
      CUSTOM: 'bg-gray-100 text-gray-800'
    };
    return colors[type as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  const getUnitSystemColor = (system: string) => {
    const colors = {
      METRIC: 'bg-blue-100 text-blue-800',
      IMPERIAL: 'bg-red-100 text-red-800',
      US_CUSTOMARY: 'bg-green-100 text-green-800',
      CUSTOM: 'bg-gray-100 text-gray-800'
    };
    return colors[system as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  if (!selectedPropertyId) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">No Property Selected</h2>
          <p className="text-gray-600">Please select a property from the header to manage measurement units.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Success Message */}
      {showSuccess && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-800 dark:text-green-200 px-4 py-3 rounded-lg mb-4">
          <div className="flex items-center">
            <CheckCircle className="w-5 h-5 mr-2" />
            <div>
              <p className="font-medium">Settings updated successfully!</p>
              {applyToScope !== 'single' && affectedCount > 1 && (
                <p className="text-sm mt-1">Changes applied to {affectedCount} properties</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Error Message */}
      {updateError && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-200 px-4 py-3 rounded-lg mb-4">
          <div className="flex items-center">
            <AlertTriangle className="w-5 h-5 mr-2" />
            <p className="font-medium">Error: {updateError}</p>
          </div>
        </div>
      )}

      {/* Inheritance Status Card */}
      {inheritanceStatus?.isInheriting && inheritanceStatus?.hasGroup && (
        <Card className="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 mb-4">
          <CardContent className="p-4">
            <div className="flex items-start">
              <AlertTriangle className="w-5 h-5 text-blue-600 dark:text-blue-400 mr-3 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                  This property is part of: {inheritanceStatus.groupName}
                </p>
                <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                  Settings are inherited from the property group.
                  {inheritanceStatus.lastSyncedAt && (
                    <span className="ml-1">
                      Last synced: {new Date(inheritanceStatus.lastSyncedAt).toLocaleString()}
                    </span>
                  )}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Measurement Units</h1>
        <div className="flex space-x-2">
          <Button
            variant="outline"
            onClick={() => setIsConversionModalOpen(true)}
          >
            <ArrowRightLeft className="w-4 h-4 mr-2" />
            Convert Units
          </Button>
          <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Create Unit
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create New Measurement Unit</DialogTitle>
              </DialogHeader>
              <UnitForm
                formData={formData}
                setFormData={setFormData}
                onSubmit={handleCreateUnit}
                onCancel={() => setIsCreateModalOpen(false)}
                unitTypes={unitTypes}
                unitSystems={unitSystems}
                categories={categories}
                posCategories={posCategories}
                units={units}
                applyToScope={applyToScope}
                setApplyToScope={setApplyToScope}
                inheritanceStatus={inheritanceStatus}
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Unit Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardContent className="flex items-center p-6">
            <Ruler className="w-8 h-8 text-blue-600 mr-4" />
            <div>
              <p className="text-sm font-medium text-gray-600">Total Units</p>
              <p className="text-2xl font-bold">{units.length}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center p-6">
            <CheckCircle className="w-8 h-8 text-green-600 mr-4" />
            <div>
              <p className="text-sm font-medium text-gray-600">Active Units</p>
              <p className="text-2xl font-bold">{units.filter(u => u.isActive).length}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center p-6">
            <TrendingUp className="w-8 h-8 text-purple-600 mr-4" />
            <div>
              <p className="text-sm font-medium text-gray-600">Total Usage</p>
              <p className="text-2xl font-bold">{units.reduce((sum, u) => sum + u.usageCount, 0)}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center p-6">
            <Settings className="w-8 h-8 text-orange-600 mr-4" />
            <div>
              <p className="text-sm font-medium text-gray-600">Unit Types</p>
              <p className="text-2xl font-bold">{new Set(units.map(u => u.unitType)).size}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Units Table */}
      <Card>
        <CardHeader>
          <CardTitle>Measurement Units</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Unit ID</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>System</TableHead>
                <TableHead>Symbol</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Usage</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {units.map((unit) => (
                <TableRow key={unit._id}>
                  <TableCell className="font-mono">{unit.unitId}</TableCell>
                  <TableCell>
                    <div>
                      <p className="font-semibold">{unit.displayName}</p>
                      <p className="text-sm text-gray-600">{unit.name}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge className={getUnitTypeColor(unit.unitType)}>
                      {unit.unitType}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge className={getUnitSystemColor(unit.unitSystem)}>
                      {unit.unitSystem}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono">{unit.symbol}</TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-2">
                      <Badge variant={unit.isActive ? "default" : "secondary"}>
                        {unit.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                      {unit.isBaseUnit && (
                        <Badge variant="outline">Base</Badge>
                      )}
                      {unit.isSystemUnit && (
                        <Badge variant="outline">System</Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div>
                      <p className="font-semibold">{unit.usageCount}</p>
                      {unit.lastUsed && (
                        <p className="text-sm text-gray-600">
                          {new Date(unit.lastUsed).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex space-x-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openEditModal(unit)}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDeleteUnit(unit)}
                        disabled={unit.isSystemUnit}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Edit Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Measurement Unit</DialogTitle>
          </DialogHeader>
          <UnitForm
            formData={formData}
            setFormData={setFormData}
            onSubmit={handleUpdateUnit}
            onCancel={() => setIsEditModalOpen(false)}
            isEdit
            unitTypes={unitTypes}
            unitSystems={unitSystems}
            categories={categories}
            posCategories={posCategories}
            units={units}
            applyToScope={applyToScope}
            setApplyToScope={setApplyToScope}
            inheritanceStatus={inheritanceStatus}
          />
        </DialogContent>
      </Dialog>

      {/* Unit Conversion Modal */}
      <Dialog open={isConversionModalOpen} onOpenChange={setIsConversionModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Unit Converter</DialogTitle>
          </DialogHeader>
          <UnitConverter
            conversionData={conversionData}
            setConversionData={setConversionData}
            onConvert={handleConvertUnits}
            onCancel={() => setIsConversionModalOpen(false)}
            result={conversionResult}
            units={units}
          />
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog */}
      <ApplyToConfirmation
        isOpen={showConfirmation}
        scope={applyToScope}
        affectedCount={affectedCount}
        settingName="Measurement Units"
        groupName={inheritanceStatus?.groupName}
        onConfirm={handleConfirm}
        onCancel={cancelBulkUpdate}
      />
    </div>
  );
};

// Unit Form Component
const UnitForm: React.FC<{
  formData: Record<string, unknown>;
  setFormData: (data: Record<string, unknown>) => void;
  onSubmit: () => void;
  onCancel: () => void;
  isEdit?: boolean;
  unitTypes: Array<{ value: string; label: string }>;
  unitSystems: Array<{ value: string; label: string }>;
  categories: Array<{ value: string; label: string }>;
  posCategories: Array<{ value: string; label: string }>;
  units: MeasurementUnit[];
  applyToScope: ApplyToScope;
  setApplyToScope: (scope: ApplyToScope) => void;
  inheritanceStatus: unknown;
}> = ({ formData, setFormData, onSubmit, onCancel, isEdit, unitTypes, unitSystems, categories, posCategories, units, applyToScope, setApplyToScope, inheritanceStatus }) => {
  const [activeTab, setActiveTab] = useState('basic');

  const availableBaseUnits = units.filter(unit => 
    unit.unitType === formData.unitType && 
    unit.isBaseUnit && 
    unit.isActive &&
    unit._id !== (isEdit ? formData._id : null)
  );

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
      <TabsList>
        <TabsTrigger value="basic">Basic Info</TabsTrigger>
        <TabsTrigger value="format">Display Format</TabsTrigger>
        <TabsTrigger value="integration">POS Integration</TabsTrigger>
      </TabsList>

      <TabsContent value="basic" className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="name">Unit Name</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Enter unit name"
            />
          </div>

          <div>
            <Label htmlFor="symbol">Symbol</Label>
            <Input
              id="symbol"
              value={formData.symbol}
              onChange={(e) => setFormData({ ...formData, symbol: e.target.value })}
              placeholder="Enter unit symbol"
            />
          </div>

          <div>
            <Label htmlFor="displayName">Display Name</Label>
            <Input
              id="displayName"
              value={formData.displayName}
              onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
              placeholder="Enter display name"
            />
          </div>

          <div>
            <Label htmlFor="unitType">Unit Type</Label>
            <Select value={formData.unitType} onValueChange={(value) => setFormData({ ...formData, unitType: value })}>
              <SelectTrigger>
                <SelectValue placeholder="Select unit type" />
              </SelectTrigger>
              <SelectContent>
                {unitTypes.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="unitSystem">Unit System</Label>
            <Select value={formData.unitSystem} onValueChange={(value) => setFormData({ ...formData, unitSystem: value })}>
              <SelectTrigger>
                <SelectValue placeholder="Select unit system" />
              </SelectTrigger>
              <SelectContent>
                {unitSystems.map((system) => (
                  <SelectItem key={system.value} value={system.value}>
                    {system.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="category">Category</Label>
            <Select value={formData.category} onValueChange={(value) => setFormData({ ...formData, category: value })}>
              <SelectTrigger>
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((category) => (
                  <SelectItem key={category.value} value={category.value}>
                    {category.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="col-span-2">
            <Label htmlFor="description">Description</Label>
            <Input
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Enter unit description"
            />
          </div>

          <div>
            <Label htmlFor="decimalPlaces">Decimal Places</Label>
            <Input
              id="decimalPlaces"
              type="number"
              min="0"
              max="6"
              value={formData.decimalPlaces}
              onChange={(e) => setFormData({ ...formData, decimalPlaces: parseInt(e.target.value) })}
            />
          </div>

          <div>
            <Label htmlFor="precision">Precision</Label>
            <Input
              id="precision"
              type="number"
              step="0.000001"
              min="0.000001"
              value={formData.precision}
              onChange={(e) => setFormData({ ...formData, precision: parseFloat(e.target.value) })}
            />
          </div>

          <div>
            <Label htmlFor="minValue">Minimum Value</Label>
            <Input
              id="minValue"
              type="number"
              value={formData.minValue}
              onChange={(e) => setFormData({ ...formData, minValue: parseFloat(e.target.value) })}
            />
          </div>

          <div>
            <Label htmlFor="maxValue">Maximum Value (Optional)</Label>
            <Input
              id="maxValue"
              type="number"
              value={formData.maxValue}
              onChange={(e) => setFormData({ ...formData, maxValue: e.target.value ? parseFloat(e.target.value) : '' })}
            />
          </div>

          <div>
            <Label htmlFor="sortOrder">Sort Order</Label>
            <Input
              id="sortOrder"
              type="number"
              min="0"
              value={formData.sortOrder}
              onChange={(e) => setFormData({ ...formData, sortOrder: parseInt(e.target.value) })}
            />
          </div>

          <div>
            <Label htmlFor="baseUnit">Base Unit (Optional)</Label>
            <Select value={formData.baseUnit} onValueChange={(value) => setFormData({ ...formData, baseUnit: value })}>
              <SelectTrigger>
                <SelectValue placeholder="Select base unit" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">None</SelectItem>
                {availableBaseUnits.map((unit) => (
                  <SelectItem key={unit._id} value={unit._id}>
                    {unit.displayName} ({unit.symbol})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="col-span-2">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="isBaseUnit"
                  checked={formData.isBaseUnit}
                  onChange={(e) => setFormData({ ...formData, isBaseUnit: e.target.checked })}
                />
                <Label htmlFor="isBaseUnit">Is Base Unit</Label>
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="allowNegative"
                  checked={formData.allowNegative}
                  onChange={(e) => setFormData({ ...formData, allowNegative: e.target.checked })}
                />
                <Label htmlFor="allowNegative">Allow Negative Values</Label>
              </div>
            </div>
          </div>
        </div>
      </TabsContent>

      <TabsContent value="format" className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="thousandsSeparator">Thousands Separator</Label>
            <Input
              id="thousandsSeparator"
              value={formData.displayFormat.thousandsSeparator}
              onChange={(e) => setFormData({
                ...formData,
                displayFormat: { ...formData.displayFormat, thousandsSeparator: e.target.value }
              })}
              placeholder=","
            />
          </div>

          <div>
            <Label htmlFor="decimalSeparator">Decimal Separator</Label>
            <Input
              id="decimalSeparator"
              value={formData.displayFormat.decimalSeparator}
              onChange={(e) => setFormData({
                ...formData,
                displayFormat: { ...formData.displayFormat, decimalSeparator: e.target.value }
              })}
              placeholder="."
            />
          </div>

          <div>
            <Label htmlFor="symbolPosition">Symbol Position</Label>
            <Select 
              value={formData.displayFormat.symbolPosition} 
              onValueChange={(value) => setFormData({
                ...formData,
                displayFormat: { ...formData.displayFormat, symbolPosition: value }
              })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="before">Before</SelectItem>
                <SelectItem value="after">After</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="col-span-2">
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="showSymbol"
                checked={formData.displayFormat.showSymbol}
                onChange={(e) => setFormData({
                  ...formData,
                  displayFormat: { ...formData.displayFormat, showSymbol: e.target.checked }
                })}
              />
              <Label htmlFor="showSymbol">Show Symbol</Label>
            </div>
          </div>
        </div>
      </TabsContent>

      <TabsContent value="integration" className="space-y-4">
        <div className="space-y-4">
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="isDefaultForType"
              checked={formData.posIntegration.isDefaultForType}
              onChange={(e) => setFormData({
                ...formData,
                posIntegration: { ...formData.posIntegration, isDefaultForType: e.target.checked }
              })}
            />
            <Label htmlFor="isDefaultForType">Default for Unit Type</Label>
          </div>

          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="inventoryTracking"
              checked={formData.posIntegration.inventoryTracking}
              onChange={(e) => setFormData({
                ...formData,
                posIntegration: { ...formData.posIntegration, inventoryTracking: e.target.checked }
              })}
            />
            <Label htmlFor="inventoryTracking">Enable Inventory Tracking</Label>
          </div>

          <div>
            <Label>Applicable POS Categories</Label>
            <div className="space-y-2 max-h-40 overflow-y-auto border rounded-md p-3">
              {posCategories.map((category) => (
                <label key={category.value} className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={formData.posIntegration.applicableCategories.includes(category.value)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setFormData({
                          ...formData,
                          posIntegration: {
                            ...formData.posIntegration,
                            applicableCategories: [...formData.posIntegration.applicableCategories, category.value]
                          }
                        });
                      } else {
                        setFormData({
                          ...formData,
                          posIntegration: {
                            ...formData.posIntegration,
                            applicableCategories: formData.posIntegration.applicableCategories.filter(c => c !== category.value)
                          }
                        });
                      }
                    }}
                  />
                  <span>{category.label}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      </TabsContent>

      {/* Multi-property selector */}
      <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mt-4">
        <ApplyToSelector
          value={applyToScope}
          onChange={setApplyToScope}
          isInGroup={inheritanceStatus?.hasGroup || false}
          groupName={inheritanceStatus?.groupName}
          totalProperties={inheritanceStatus?.groupPropertyCount || 0}
          showWarning={true}
          warningMessage="These measurement units will be applied to all selected properties. Ensure unit standards are appropriate for all properties."
        />
      </div>

      <div className="flex justify-end space-x-2 mt-6">
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={onSubmit}>
          {isEdit ? 'Update' : 'Create'} Unit
        </Button>
      </div>
    </Tabs>
  );
};

// Unit Converter Component
const UnitConverter: React.FC<{
  conversionData: unknown;
  setConversionData: (data: Record<string, unknown>) => void;
  onConvert: () => void;
  onCancel: () => void;
  result: ConversionResult | null;
  units: MeasurementUnit[];
}> = ({ conversionData, setConversionData, onConvert, onCancel, result, units }) => {
  const availableUnits = units.filter(unit => unit.isActive);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="fromUnit">From Unit</Label>
          <Select value={conversionData.fromUnitId} onValueChange={(value) => setConversionData({ ...conversionData, fromUnitId: value })}>
            <SelectTrigger>
              <SelectValue placeholder="Select source unit" />
            </SelectTrigger>
            <SelectContent>
              {availableUnits.map((unit) => (
                <SelectItem key={unit._id} value={unit._id}>
                  {unit.displayName} ({unit.symbol})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="toUnit">To Unit</Label>
          <Select value={conversionData.toUnitId} onValueChange={(value) => setConversionData({ ...conversionData, toUnitId: value })}>
            <SelectTrigger>
              <SelectValue placeholder="Select target unit" />
            </SelectTrigger>
            <SelectContent>
              {availableUnits.map((unit) => (
                <SelectItem key={unit._id} value={unit._id}>
                  {unit.displayName} ({unit.symbol})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="value">Value</Label>
          <Input
            id="value"
            type="number"
            value={conversionData.value}
            onChange={(e) => setConversionData({ ...conversionData, value: parseFloat(e.target.value) })}
            placeholder="Enter value to convert"
          />
        </div>

        <div>
          <Label htmlFor="precision">Precision</Label>
          <Input
            id="precision"
            type="number"
            min="0"
            max="10"
            value={conversionData.precision}
            onChange={(e) => setConversionData({ ...conversionData, precision: parseInt(e.target.value) })}
            placeholder="Decimal places"
          />
        </div>
      </div>

      {result && (
        <Card>
          <CardHeader>
            <CardTitle>Conversion Result</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span>Original:</span>
                <span className="font-semibold">
                  {result.originalValue} {result.originalUnit.symbol}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Converted:</span>
                <span className="font-semibold">
                  {result.convertedValue.toFixed(result.precision)} {result.targetUnit.symbol}
                </span>
              </div>
              <div className="flex justify-between text-sm text-gray-600">
                <span>Conversion Factor:</span>
                <span>{result.conversionFactor}</span>
              </div>
              <div className="flex justify-between text-sm text-gray-600">
                <span>Conversion Path:</span>
                <span className="capitalize">{result.conversionPath.replace('_', ' ')}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex justify-end space-x-2">
        <Button variant="outline" onClick={onCancel}>
          Close
        </Button>
        <Button onClick={onConvert}>
          <Calculator className="w-4 h-4 mr-2" />
          Convert
        </Button>
      </div>
    </div>
  );
};

export default withErrorBoundary(AdminMeasurementUnits, { level: 'page' });
