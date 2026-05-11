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
  CheckCircle,
  RefreshCw
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { api } from '../../services/api';
import { ApplyToSelector, ApplyToConfirmation, ApplyToScope } from '@/components/settings/ApplyToSelector';
import { useSettingsInheritance, useAffectedPropertiesCount } from '@/hooks/useSettingsInheritance';
import { useProperty } from '@/context/PropertyContext';
import { withErrorBoundary } from '../../components/ErrorBoundary';
import { formatCurrency } from '@/utils/currencyUtils';

interface TaxRule {
  name: string;
  type: 'percentage' | 'fixed_amount' | 'compound';
  value: number;
  appliesToTaxes?: string[];
  minThreshold?: number;
  maxThreshold?: number;
  rounding?: 'round' | 'floor' | 'ceil' | 'none';
  decimalPlaces?: number;
}

interface TaxExemption {
  name: string;
  description?: string;
  conditions: {
    customerTypes?: string[];
    productCategories?: string[];
    validFrom?: string;
    validTo?: string;
    minAmount?: number;
    maxAmount?: number;
    applicableOutlets?: string[];
  };
  exemptionPercentage?: number;
  requiresDocumentation?: boolean;
  requiresApproval?: boolean;
}

interface POSTax {
  _id: string;
  taxId: string;
  name: string;
  displayName: string;
  description?: string;
  taxType: string;
  taxGroup: string;
  rules: TaxRule[];
  exemptions: TaxExemption[];
  isActive: boolean;
  validFrom: string;
  validTo?: string;
  reportingCode?: string;
  glAccountCode?: string;
  isInclusive: boolean;
  displayFormat: {
    showOnReceipt: boolean;
    showInBreakdown: boolean;
    receiptLabel: string;
    breakdownLabel: string;
  };
  effectiveRate?: number;
  isCurrentlyValid: boolean;
  calculationCount: number;
  totalCollected: number;
  createdAt: string;
  updatedAt: string;
}

interface TaxCalculationResult {
  totalTax: number;
  taxBreakdown: Array<{
    taxId: string;
    taxName: string;
    taxType: string;
    amount: number;
    rate: number;
    exemptionApplied: boolean;
    exemptionPercentage?: number;
  }>;
  exemptedAmount: number;
  taxableAmount: number;
}

const AdminPOSTaxes: React.FC = () => {
  const [taxes, setTaxes] = useState<POSTax[]>([]);
  const [selectedTax, setSelectedTax] = useState<POSTax | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isCalculationModalOpen, setIsCalculationModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [calculationResult, setCalculationResult] = useState<TaxCalculationResult | null>(null);

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
    displayName: '',
    description: '',
    taxType: '',
    taxGroup: '',
    rules: [] as TaxRule[],
    exemptions: [] as TaxExemption[],
    validFrom: new Date().toISOString().split('T')[0],
    validTo: '',
    reportingCode: '',
    glAccountCode: '',
    isInclusive: false,
    displayFormat: {
      showOnReceipt: true,
      showInBreakdown: true,
      receiptLabel: '',
      breakdownLabel: ''
    }
  });

  const [calculationData, setCalculationData] = useState({
    amount: 0,
    taxGroup: '',
    customerType: 'individual',
    outletId: '',
    applyExemptions: true
  });

  const taxTypes = [
    { value: 'VAT', label: 'Value Added Tax' },
    { value: 'GST', label: 'Goods and Services Tax' },
    { value: 'SERVICE_TAX', label: 'Service Tax' },
    { value: 'LOCAL_TAX', label: 'Local Tax' },
    { value: 'LUXURY_TAX', label: 'Luxury Tax' },
    { value: 'ENTERTAINMENT_TAX', label: 'Entertainment Tax' },
    { value: 'CUSTOM', label: 'Custom Tax' }
  ];

  const taxGroups = [
    { value: 'FOOD', label: 'Food Items' },
    { value: 'BEVERAGE', label: 'Beverages' },
    { value: 'SERVICE', label: 'Services' },
    { value: 'PRODUCT', label: 'Products' },
    { value: 'ALCOHOL', label: 'Alcoholic Beverages' },
    { value: 'TOBACCO', label: 'Tobacco Products' },
    { value: 'LUXURY', label: 'Luxury Items' },
    { value: 'GENERAL', label: 'General Items' }
  ];

  const customerTypes = [
    { value: 'individual', label: 'Individual' },
    { value: 'corporate', label: 'Corporate' },
    { value: 'government', label: 'Government' },
    { value: 'diplomatic', label: 'Diplomatic' },
    { value: 'senior_citizen', label: 'Senior Citizen' },
    { value: 'student', label: 'Student' }
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
      fetchTaxes();
    }
  }, [selectedPropertyId]);

  const fetchTaxes = async () => {
    try {
      setLoading(true);
      const response = await api.get('/pos/taxes', {
        params: { page: 1, limit: 100 }
      });
      if (response.data.status === 'success') {
        setTaxes(response.data.data.taxes);
      }
    } catch (error) {
      toast.error('Failed to fetch taxes');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTax = async () => {
    if (!formData.name.trim() || !formData.taxType || !formData.taxGroup) {
      toast.error('Tax name, type, and group are required');
      return;
    }
    try {
      // If multi-property update, use applySettings
      if (applyToScope !== 'single') {
        const result = await applySettings({
          scope: applyToScope,
          propertyId: selectedPropertyId,
          settingUpdates: formData,
          settingType: 'pos_taxes',
        });

        if (!result) return; // Confirmation dialog shown

        setShowSuccess(true);
        if (successTimerRef.current) clearTimeout(successTimerRef.current);
        successTimerRef.current = setTimeout(() => setShowSuccess(false), 3000);
        toast.success(`POS tax created successfully${
          applyToScope !== 'single' ? ` for ${result.propertiesUpdated} properties` : ''
        }`);
        setApplyToScope('single');
      } else {
        // Single property update
        const response = await api.post('/pos/taxes', formData);
        if (response.data.status === 'success') {
          toast.success('Tax created successfully');
        }
      }

      fetchTaxes();
      setIsCreateModalOpen(false);
      resetForm();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } }; message?: string };
      toast.error(err.response?.data?.message || 'Failed to create tax');
    }
  };

  const handleUpdateTax = async () => {
    if (!selectedTax) return;
    if (!formData.name.trim() || !formData.taxType || !formData.taxGroup) {
      toast.error('Tax name, type, and group are required');
      return;
    }
    try {
      // If multi-property update, use applySettings
      if (applyToScope !== 'single') {
        const result = await applySettings({
          scope: applyToScope,
          propertyId: selectedPropertyId,
          settingUpdates: { ...formData, taxId: selectedTax._id },
          settingType: 'pos_taxes',
        });

        if (!result) return; // Confirmation dialog shown

        setShowSuccess(true);
        if (successTimerRef.current) clearTimeout(successTimerRef.current);
        successTimerRef.current = setTimeout(() => setShowSuccess(false), 3000);
        toast.success(`POS tax updated successfully${
          applyToScope !== 'single' ? ` for ${result.propertiesUpdated} properties` : ''
        }`);
        setApplyToScope('single');
      } else {
        // Single property update
        const response = await api.put(`/pos/taxes/${selectedTax._id}`, formData);
        if (response.data.status === 'success') {
          toast.success('Tax updated successfully');
        }
      }

      fetchTaxes();
      setIsEditModalOpen(false);
      setSelectedTax(null);
      resetForm();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } }; message?: string };
      toast.error(err.response?.data?.message || 'Failed to update tax');
    }
  };

  const handleConfirm = async () => {
    if (pendingUpdate) {
      const result = await confirmBulkUpdate();
      if (result) {
        setShowSuccess(true);
        if (successTimerRef.current) clearTimeout(successTimerRef.current);
        successTimerRef.current = setTimeout(() => setShowSuccess(false), 3000);
        toast.success(`POS tax configuration updated for ${result.propertiesUpdated} properties`);
        fetchTaxes();
      }
    }
  };

  const handleDeleteTax = async (tax: POSTax) => {
    if (!confirm(`Are you sure you want to ${tax.calculationCount > 0 ? 'deactivate' : 'delete'} this tax?`)) {
      return;
    }

    try {
      const response = await api.delete(`/pos/taxes/${tax._id}`);
      if (response.data.status === 'success') {
        toast.success(response.data.message);
        fetchTaxes();
      }
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } }; message?: string };
      toast.error(err.response?.data?.message || 'Failed to delete tax');
    }
  };

  const handleCalculateTax = async () => {
    try {
      const response = await api.post('/pos/taxes/calculate', calculationData);
      if (response.data.status === 'success') {
        setCalculationResult(response.data.data);
        setIsCalculationModalOpen(true);
      }
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } }; message?: string };
      toast.error(err.response?.data?.message || 'Failed to calculate tax');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      displayName: '',
      description: '',
      taxType: '',
      taxGroup: '',
      rules: [],
      exemptions: [],
      validFrom: new Date().toISOString().split('T')[0],
      validTo: '',
      reportingCode: '',
      glAccountCode: '',
      isInclusive: false,
      displayFormat: {
        showOnReceipt: true,
        showInBreakdown: true,
        receiptLabel: '',
        breakdownLabel: ''
      }
    });
  };

  const openEditModal = (tax: POSTax) => {
    setSelectedTax(tax);
    setFormData({
      name: tax.name,
      displayName: tax.displayName,
      description: tax.description || '',
      taxType: tax.taxType,
      taxGroup: tax.taxGroup,
      rules: tax.rules,
      exemptions: tax.exemptions,
      validFrom: tax.validFrom.split('T')[0],
      validTo: tax.validTo ? tax.validTo.split('T')[0] : '',
      reportingCode: tax.reportingCode || '',
      glAccountCode: tax.glAccountCode || '',
      isInclusive: tax.isInclusive,
      displayFormat: {
        showOnReceipt: tax.displayFormat.showOnReceipt,
        showInBreakdown: tax.displayFormat.showInBreakdown,
        receiptLabel: tax.displayFormat.receiptLabel || '',
        breakdownLabel: tax.displayFormat.breakdownLabel || ''
      }
    });
    setIsEditModalOpen(true);
  };

  const getTaxTypeColor = (type: string) => {
    const colors = {
      VAT: 'bg-blue-100 text-blue-800',
      GST: 'bg-green-100 text-green-800',
      SERVICE_TAX: 'bg-purple-100 text-purple-800',
      LOCAL_TAX: 'bg-orange-100 text-orange-800',
      LUXURY_TAX: 'bg-red-100 text-red-800',
      ENTERTAINMENT_TAX: 'bg-pink-100 text-pink-800',
      CUSTOM: 'bg-gray-100 text-gray-800'
    };
    return colors[type as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  const getTaxGroupColor = (group: string) => {
    const colors = {
      FOOD: 'bg-yellow-100 text-yellow-800',
      BEVERAGE: 'bg-blue-100 text-blue-800',
      SERVICE: 'bg-green-100 text-green-800',
      PRODUCT: 'bg-purple-100 text-purple-800',
      ALCOHOL: 'bg-red-100 text-red-800',
      TOBACCO: 'bg-gray-100 text-gray-800',
      LUXURY: 'bg-pink-100 text-pink-800',
      GENERAL: 'bg-gray-100 text-gray-800'
    };
    return colors[group as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  if (!selectedPropertyId) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">No Property Selected</h2>
          <p className="text-gray-600">Please select a property from the header to manage POS taxes.</p>
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
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-800 dark:text-green-200 px-4 py-3 rounded-lg">
          <p className="font-medium">POS tax configuration updated successfully!</p>
        </div>
      )}

      {/* Error Message */}
      {updateError && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-200 px-4 py-3 rounded-lg">
          <p className="font-medium">Error: {updateError}</p>
        </div>
      )}

      {/* Inheritance Status Card */}
      {inheritanceStatus?.isInheriting && inheritanceStatus?.hasGroup && (
        <Card className="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                  This property is part of: {inheritanceStatus.groupName}
                </p>
                <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                  POS tax settings are inherited from the property group
                  {inheritanceStatus.lastSyncAt && ` • Last synced: ${new Date(inheritanceStatus.lastSyncAt).toLocaleDateString()}`}
                </p>
              </div>
              {inheritanceStatus.canOverride && (
                <Badge variant="secondary" className="text-xs">
                  Override Enabled
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold dark:text-gray-100">POS Tax Management</h1>
        <div className="flex space-x-2">
          <Button
            variant="outline"
            onClick={() => setIsCalculationModalOpen(true)}
          >
            <Calculator className="w-4 h-4 mr-2" />
            Calculate Tax
          </Button>
          <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Create Tax
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create New Tax</DialogTitle>
              </DialogHeader>

              {/* Multi-Property Selector */}
              <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                <ApplyToSelector
                  value={applyToScope}
                  onChange={setApplyToScope}
                  isInGroup={inheritanceStatus?.hasGroup || false}
                  groupName={inheritanceStatus?.groupName}
                  totalProperties={inheritanceStatus?.groupPropertyCount || 0}
                  showWarning={true}
                  warningMessage="These POS tax configurations will be applied to all selected properties. Tax rules, exemptions, and calculations will be synchronized."
                />
              </div>

              <TaxForm
                formData={formData}
                setFormData={setFormData}
                onSubmit={handleCreateTax}
                onCancel={() => {
                  setIsCreateModalOpen(false);
                  setApplyToScope('single');
                }}
                taxTypes={taxTypes}
                taxGroups={taxGroups}
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Tax Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardContent className="flex items-center p-6">
            <FileText className="w-8 h-8 text-blue-600 mr-4" />
            <div>
              <p className="text-sm font-medium text-gray-600">Total Taxes</p>
              <p className="text-2xl font-bold">{taxes.length}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center p-6">
            <CheckCircle className="w-8 h-8 text-green-600 mr-4" />
            <div>
              <p className="text-sm font-medium text-gray-600">Active Taxes</p>
              <p className="text-2xl font-bold">{taxes.filter(t => t.isActive).length}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center p-6">
            <TrendingUp className="w-8 h-8 text-purple-600 mr-4" />
            <div>
              <p className="text-sm font-medium text-gray-600">Total Calculations</p>
              <p className="text-2xl font-bold">{taxes.reduce((sum, t) => sum + t.calculationCount, 0)}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center p-6">
            <Settings className="w-8 h-8 text-orange-600 mr-4" />
            <div>
              <p className="text-sm font-medium text-gray-600">Tax Groups</p>
              <p className="text-2xl font-bold">{new Set(taxes.map(t => t.taxGroup)).size}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Taxes Table */}
      <Card>
        <CardHeader>
          <CardTitle>Taxes</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tax ID</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Group</TableHead>
                <TableHead>Rate</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Calculations</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {taxes.map((tax) => (
                <TableRow key={tax._id}>
                  <TableCell className="font-mono">{tax.taxId}</TableCell>
                  <TableCell>
                    <div>
                      <p className="font-semibold">{tax.displayName}</p>
                      <p className="text-sm text-gray-600">{tax.name}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge className={getTaxTypeColor(tax.taxType)}>
                      {tax.taxType}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge className={getTaxGroupColor(tax.taxGroup)}>
                      {tax.taxGroup}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {tax.effectiveRate ? `${tax.effectiveRate}%` : 'Variable'}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-2">
                      <Badge variant={tax.isActive ? "default" : "secondary"}>
                        {tax.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                      {tax.isCurrentlyValid && (
                        <CheckCircle className="w-4 h-4 text-green-600" />
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div>
                      <p className="font-semibold">{tax.calculationCount}</p>
                      <p className="text-sm text-gray-600">
                        {formatCurrency(tax.totalCollected)}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex space-x-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openEditModal(tax)}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDeleteTax(tax)}
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
            <DialogTitle>Edit Tax</DialogTitle>
          </DialogHeader>

          {/* Multi-Property Selector */}
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <ApplyToSelector
              value={applyToScope}
              onChange={setApplyToScope}
              isInGroup={inheritanceStatus?.hasGroup || false}
              groupName={inheritanceStatus?.groupName}
              totalProperties={inheritanceStatus?.groupPropertyCount || 0}
              showWarning={true}
              warningMessage="These POS tax configuration updates will be applied to all selected properties. Existing tax rules may be overridden."
            />
          </div>

          <TaxForm
            formData={formData}
            setFormData={setFormData}
            onSubmit={handleUpdateTax}
            onCancel={() => {
              setIsEditModalOpen(false);
              setApplyToScope('single');
            }}
            isEdit
            taxTypes={taxTypes}
            taxGroups={taxGroups}
          />
        </DialogContent>
      </Dialog>

      {/* Tax Calculation Modal */}
      <Dialog open={isCalculationModalOpen} onOpenChange={setIsCalculationModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Tax Calculator</DialogTitle>
          </DialogHeader>
          <TaxCalculator
            calculationData={calculationData}
            setCalculationData={setCalculationData}
            onCalculate={handleCalculateTax}
            onCancel={() => setIsCalculationModalOpen(false)}
            result={calculationResult}
            taxGroups={taxGroups}
            customerTypes={customerTypes}
          />
        </DialogContent>
      </Dialog>

      {/* Multi-Property Confirmation Dialog */}
      <ApplyToConfirmation
        isOpen={showConfirmation}
        scope={applyToScope}
        affectedCount={affectedCount}
        settingName="POS tax configurations"
        groupName={inheritanceStatus?.groupName}
        onConfirm={handleConfirm}
        onCancel={cancelBulkUpdate}
      />
    </div>
  );
};

// Tax Form Component
const TaxForm: React.FC<{
  formData: Record<string, unknown>;
  setFormData: (data: Record<string, unknown>) => void;
  onSubmit: () => void;
  onCancel: () => void;
  isEdit?: boolean;
  taxTypes: Array<{ value: string; label: string }>;
  taxGroups: Array<{ value: string; label: string }>;
}> = ({ formData, setFormData, onSubmit, onCancel, isEdit, taxTypes, taxGroups }) => {
  const [activeTab, setActiveTab] = useState('basic');

  const addRule = () => {
    setFormData({
      ...formData,
      rules: [...formData.rules, {
        name: '',
        type: 'percentage',
        value: 0,
        rounding: 'round',
        decimalPlaces: 2
      }]
    });
  };

  const updateRule = (index: number, field: string, value: string | number | undefined) => {
    const newRules = [...formData.rules];
    newRules[index] = { ...newRules[index], [field]: value };
    setFormData({ ...formData, rules: newRules });
  };

  const removeRule = (index: number) => {
    setFormData({
      ...formData,
      rules: (formData.rules as unknown[]).filter((_: unknown, i: number) => i !== index)
    });
  };

  const addExemption = () => {
    setFormData({
      ...formData,
      exemptions: [...formData.exemptions, {
        name: '',
        description: '',
        conditions: {},
        exemptionPercentage: 100,
        requiresDocumentation: false,
        requiresApproval: false
      }]
    });
  };

  const updateExemption = (index: number, field: string, value: string | number | boolean) => {
    const newExemptions = [...formData.exemptions];
    newExemptions[index] = { ...newExemptions[index], [field]: value };
    setFormData({ ...formData, exemptions: newExemptions });
  };

  const removeExemption = (index: number) => {
    setFormData({
      ...formData,
      exemptions: (formData.exemptions as unknown[]).filter((_: unknown, i: number) => i !== index)
    });
  };

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
      <TabsList>
        <TabsTrigger value="basic">Basic Info</TabsTrigger>
        <TabsTrigger value="rules">Tax Rules</TabsTrigger>
        <TabsTrigger value="exemptions">Exemptions</TabsTrigger>
        <TabsTrigger value="display">Display Settings</TabsTrigger>
      </TabsList>

      <TabsContent value="basic" className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="name">Tax Name</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Enter tax name"
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
            <Label htmlFor="taxType">Tax Type</Label>
            <Select value={formData.taxType} onValueChange={(value) => setFormData({ ...formData, taxType: value })}>
              <SelectTrigger>
                <SelectValue placeholder="Select tax type" />
              </SelectTrigger>
              <SelectContent>
                {taxTypes.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="taxGroup">Tax Group</Label>
            <Select value={formData.taxGroup} onValueChange={(value) => setFormData({ ...formData, taxGroup: value })}>
              <SelectTrigger>
                <SelectValue placeholder="Select tax group" />
              </SelectTrigger>
              <SelectContent>
                {taxGroups.map((group) => (
                  <SelectItem key={group.value} value={group.value}>
                    {group.label}
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
              placeholder="Enter tax description"
            />
          </div>

          <div>
            <Label htmlFor="validFrom">Valid From</Label>
            <Input
              id="validFrom"
              type="date"
              value={formData.validFrom}
              onChange={(e) => setFormData({ ...formData, validFrom: e.target.value })}
            />
          </div>

          <div>
            <Label htmlFor="validTo">Valid To (Optional)</Label>
            <Input
              id="validTo"
              type="date"
              value={formData.validTo}
              onChange={(e) => setFormData({ ...formData, validTo: e.target.value })}
            />
          </div>

          <div>
            <Label htmlFor="reportingCode">Reporting Code</Label>
            <Input
              id="reportingCode"
              value={formData.reportingCode}
              onChange={(e) => setFormData({ ...formData, reportingCode: e.target.value })}
              placeholder="Enter reporting code"
            />
          </div>

          <div>
            <Label htmlFor="glAccountCode">GL Account Code</Label>
            <Input
              id="glAccountCode"
              value={formData.glAccountCode}
              onChange={(e) => setFormData({ ...formData, glAccountCode: e.target.value })}
              placeholder="Enter GL account code"
            />
          </div>

          <div className="col-span-2">
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="isInclusive"
                checked={formData.isInclusive}
                onChange={(e) => setFormData({ ...formData, isInclusive: e.target.checked })}
              />
              <Label htmlFor="isInclusive">Tax Inclusive (tax included in price)</Label>
            </div>
          </div>
        </div>
      </TabsContent>

      <TabsContent value="rules" className="space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-semibold">Tax Rules</h3>
          <Button onClick={addRule} size="sm">
            <Plus className="w-4 h-4 mr-2" />
            Add Rule
          </Button>
        </div>

        <div className="space-y-4">
          {(formData.rules as Record<string, unknown>[]).map((rule: Record<string, unknown>, index: number) => (
            <Card key={`rule-${index}-${rule.name || rule.type || ''}`}>
              <CardContent className="p-4">
                <div className="flex justify-between items-start mb-4">
                  <h4 className="font-semibold">Rule {index + 1}</h4>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => removeRule(index)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Rule Name</Label>
                    <Input
                      value={rule.name}
                      onChange={(e) => updateRule(index, 'name', e.target.value)}
                      placeholder="Enter rule name"
                    />
                  </div>

                  <div>
                    <Label>Rule Type</Label>
                    <Select value={rule.type} onValueChange={(value) => updateRule(index, 'type', value)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="percentage">Percentage</SelectItem>
                        <SelectItem value="fixed_amount">Fixed Amount</SelectItem>
                        <SelectItem value="compound">Compound</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Value</Label>
                    <Input
                      type="number"
                      value={rule.value}
                      onChange={(e) => updateRule(index, 'value', parseFloat(e.target.value) || 0)}
                      placeholder="Enter value"
                      min="0"
                    />
                  </div>

                  <div>
                    <Label>Rounding</Label>
                    <Select value={rule.rounding} onValueChange={(value) => updateRule(index, 'rounding', value)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="round">Round</SelectItem>
                        <SelectItem value="floor">Floor</SelectItem>
                        <SelectItem value="ceil">Ceiling</SelectItem>
                        <SelectItem value="none">None</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Min Threshold</Label>
                    <Input
                      type="number"
                      value={rule.minThreshold || ''}
                      onChange={(e) => updateRule(index, 'minThreshold', e.target.value ? parseFloat(e.target.value) : undefined)}
                      placeholder="Minimum amount"
                    />
                  </div>

                  <div>
                    <Label>Max Threshold</Label>
                    <Input
                      type="number"
                      value={rule.maxThreshold || ''}
                      onChange={(e) => updateRule(index, 'maxThreshold', e.target.value ? parseFloat(e.target.value) : undefined)}
                      placeholder="Maximum amount"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}

          {formData.rules.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              No tax rules defined. Click "Add Rule" to create one.
            </div>
          )}
        </div>
      </TabsContent>

      <TabsContent value="exemptions" className="space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-semibold">Tax Exemptions</h3>
          <Button onClick={addExemption} size="sm">
            <Plus className="w-4 h-4 mr-2" />
            Add Exemption
          </Button>
        </div>

        <div className="space-y-4">
          {(formData.exemptions as Record<string, unknown>[]).map((exemption: Record<string, unknown>, index: number) => (
            <Card key={`exemption-${index}-${exemption.name || exemption.type || ''}`}>
              <CardContent className="p-4">
                <div className="flex justify-between items-start mb-4">
                  <h4 className="font-semibold">Exemption {index + 1}</h4>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => removeExemption(index)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Exemption Name</Label>
                    <Input
                      value={exemption.name}
                      onChange={(e) => updateExemption(index, 'name', e.target.value)}
                      placeholder="Enter exemption name"
                    />
                  </div>

                  <div>
                    <Label>Exemption Percentage</Label>
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      value={exemption.exemptionPercentage || 100}
                      onChange={(e) => updateExemption(index, 'exemptionPercentage', parseFloat(e.target.value))}
                      placeholder="100"
                    />
                  </div>

                  <div className="col-span-2">
                    <Label>Description</Label>
                    <Input
                      value={exemption.description || ''}
                      onChange={(e) => updateExemption(index, 'description', e.target.value)}
                      placeholder="Enter exemption description"
                    />
                  </div>

                  <div className="col-span-2">
                    <div className="flex items-center space-x-4">
                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id={`requiresDoc-${index}`}
                          checked={exemption.requiresDocumentation || false}
                          onChange={(e) => updateExemption(index, 'requiresDocumentation', e.target.checked)}
                        />
                        <Label htmlFor={`requiresDoc-${index}`}>Requires Documentation</Label>
                      </div>

                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id={`requiresApproval-${index}`}
                          checked={exemption.requiresApproval || false}
                          onChange={(e) => updateExemption(index, 'requiresApproval', e.target.checked)}
                        />
                        <Label htmlFor={`requiresApproval-${index}`}>Requires Approval</Label>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}

          {formData.exemptions.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              No exemptions defined. Click "Add Exemption" to create one.
            </div>
          )}
        </div>
      </TabsContent>

      <TabsContent value="display" className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="receiptLabel">Receipt Label</Label>
            <Input
              id="receiptLabel"
              value={formData.displayFormat.receiptLabel || ''}
              onChange={(e) => setFormData({
                ...formData,
                displayFormat: { ...formData.displayFormat, receiptLabel: e.target.value }
              })}
              placeholder="Label for receipts"
            />
          </div>

          <div>
            <Label htmlFor="breakdownLabel">Breakdown Label</Label>
            <Input
              id="breakdownLabel"
              value={formData.displayFormat.breakdownLabel || ''}
              onChange={(e) => setFormData({
                ...formData,
                displayFormat: { ...formData.displayFormat, breakdownLabel: e.target.value }
              })}
              placeholder="Label for breakdown"
            />
          </div>

          <div className="col-span-2">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="showOnReceipt"
                  checked={formData.displayFormat.showOnReceipt}
                  onChange={(e) => setFormData({
                    ...formData,
                    displayFormat: { ...formData.displayFormat, showOnReceipt: e.target.checked }
                  })}
                />
                <Label htmlFor="showOnReceipt">Show on Receipt</Label>
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="showInBreakdown"
                  checked={formData.displayFormat.showInBreakdown}
                  onChange={(e) => setFormData({
                    ...formData,
                    displayFormat: { ...formData.displayFormat, showInBreakdown: e.target.checked }
                  })}
                />
                <Label htmlFor="showInBreakdown">Show in Breakdown</Label>
              </div>
            </div>
          </div>
        </div>
      </TabsContent>

      <div className="flex justify-end space-x-2 mt-6">
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={onSubmit}>
          {isEdit ? 'Update' : 'Create'} Tax
        </Button>
      </div>
    </Tabs>
  );
};

// Tax Calculator Component
const TaxCalculator: React.FC<{
  calculationData: Record<string, unknown>;
  setCalculationData: (data: Record<string, unknown>) => void;
  onCalculate: () => void;
  onCancel: () => void;
  result: TaxCalculationResult | null;
  taxGroups: Array<{ value: string; label: string }>;
  customerTypes: Array<{ value: string; label: string }>;
}> = ({ calculationData, setCalculationData, onCalculate, onCancel, result, taxGroups, customerTypes }) => {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="amount">Amount</Label>
          <Input
            id="amount"
            type="number"
            value={calculationData.amount}
            onChange={(e) => setCalculationData({ ...calculationData, amount: parseFloat(e.target.value) || 0 })}
            placeholder="Enter amount"
            min="0"
          />
        </div>

        <div>
          <Label htmlFor="taxGroup">Tax Group</Label>
          <Select value={calculationData.taxGroup} onValueChange={(value) => setCalculationData({ ...calculationData, taxGroup: value })}>
            <SelectTrigger>
              <SelectValue placeholder="Select tax group" />
            </SelectTrigger>
            <SelectContent>
              {taxGroups.map((group) => (
                <SelectItem key={group.value} value={group.value}>
                  {group.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="customerType">Customer Type</Label>
          <Select value={calculationData.customerType} onValueChange={(value) => setCalculationData({ ...calculationData, customerType: value })}>
            <SelectTrigger>
              <SelectValue placeholder="Select customer type" />
            </SelectTrigger>
            <SelectContent>
              {customerTypes.map((type) => (
                <SelectItem key={type.value} value={type.value}>
                  {type.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="outletId">Outlet ID (Optional)</Label>
          <Input
            id="outletId"
            value={calculationData.outletId}
            onChange={(e) => setCalculationData({ ...calculationData, outletId: e.target.value })}
            placeholder="Enter outlet ID"
          />
        </div>
      </div>

      <div className="flex items-center space-x-2">
        <input
          type="checkbox"
          id="applyExemptions"
          checked={calculationData.applyExemptions}
          onChange={(e) => setCalculationData({ ...calculationData, applyExemptions: e.target.checked })}
        />
        <Label htmlFor="applyExemptions">Apply Exemptions</Label>
      </div>

      {result && (
        <Card>
          <CardHeader>
            <CardTitle>Calculation Result</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span>Taxable Amount:</span>
                <span className="font-semibold">{formatCurrency(result.taxableAmount)}</span>
              </div>
              <div className="flex justify-between">
                <span>Exempted Amount:</span>
                <span className="font-semibold">{formatCurrency(result.exemptedAmount)}</span>
              </div>
              <div className="flex justify-between text-lg font-bold">
                <span>Total Tax:</span>
                <span>{formatCurrency(result.totalTax)}</span>
              </div>
            </div>

            {result.taxBreakdown.length > 0 && (
              <div className="mt-4">
                <h4 className="font-semibold mb-2">Tax Breakdown:</h4>
                <div className="space-y-1">
                  {result.taxBreakdown.map((tax, index) => (
                    <div key={`result-taxBreakdown-${index}`} className="flex justify-between text-sm">
                      <span>{tax.taxName} ({tax.taxType})</span>
                      <span>{formatCurrency(tax.amount)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <div className="flex justify-end space-x-2">
        <Button variant="outline" onClick={onCancel}>
          Close
        </Button>
        <Button onClick={onCalculate}>
          <Calculator className="w-4 h-4 mr-2" />
          Calculate
        </Button>
      </div>
    </div>
  );
};

export default withErrorBoundary(AdminPOSTaxes, { level: 'page' });
