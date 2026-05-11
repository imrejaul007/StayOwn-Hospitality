import React, { useState, useEffect, useRef} from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { Plus, Search, Edit, Trash2, Calculator, Filter, Download } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { toast as shadToast } from '../../hooks/use-toast';
import RoomTaxForm from '../../components/admin/RoomTaxForm';
import TaxCalculationDisplay from '../../components/admin/TaxCalculationDisplay';
import { ApplyToSelector, ApplyToConfirmation, ApplyToScope } from '../../components/settings/ApplyToSelector';
import { useSettingsInheritance, useAffectedPropertiesCount } from '../../hooks/useSettingsInheritance';
import { useProperty } from '../../context/PropertyContext';
import toast from 'react-hot-toast';
import { api } from '../../services/api';
import { withErrorBoundary } from '../../components/ErrorBoundary';

interface RoomTax {
  _id: string;
  taxName: string;
  taxType: string;
  taxCategory: string;
  taxRate: number;
  isPercentage: boolean;
  fixedAmount: number;
  calculationMethod: string;
  isActive: boolean;
  validFrom: string;
  validTo?: string;
  isCompoundTax: boolean;
  compoundOrder: number;
  applicableRoomTypes: unknown[];
  applicableChannels: string[];
  description?: string;
  createdBy: {
    name: string;
    email: string;
  };
  createdAt: string;
  updatedAt: string;
}

interface TaxSummary {
  totalActiveTaxes: number;
  taxesByType: Record<string, number>;
  taxesByCategory: Record<string, number>;
  averageTaxRate: number;
}

const AdminRoomTaxes: React.FC = () => {
  const [taxes, setTaxes] = useState<RoomTax[]>([]);
  const [filteredTaxes, setFilteredTaxes] = useState<RoomTax[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [showCalculator, setShowCalculator] = useState(false);
  const [editingTax, setEditingTax] = useState<RoomTax | null>(null);
  const [selectedTaxes, setSelectedTaxes] = useState<string[]>([]);
  const [taxSummary, setTaxSummary] = useState<TaxSummary | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);

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

  const hotelId = selectedPropertyId || localStorage.getItem('hotelId') || '';

  const successTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (successTimerRef.current) clearTimeout(successTimerRef.current);
    };
  }, []);

  useEffect(() => {
    fetchTaxes();
    fetchTaxSummary();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [taxes, searchTerm, filterType, filterCategory, filterStatus]);

  const fetchTaxes = async () => {
    try {
      setLoading(true);
      const { data } = await api.get(`/room-taxes/hotels/${hotelId}`);
      setTaxes(data.data.taxes);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to fetch room taxes",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchTaxSummary = async () => {
    try {
      const { data } = await api.get(`/room-taxes/hotels/${hotelId}/summary`);
      setTaxSummary(data.data.summary);
    } catch {
      // Error handled silently
    }
  };

  const applyFilters = () => {
    let filtered = taxes;

    if (searchTerm) {
      filtered = filtered.filter(tax =>
        tax.taxName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        tax.taxType.toLowerCase().includes(searchTerm.toLowerCase()) ||
        tax.description?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (filterType !== 'all') {
      filtered = filtered.filter(tax => tax.taxType === filterType);
    }

    if (filterCategory !== 'all') {
      filtered = filtered.filter(tax => tax.taxCategory === filterCategory);
    }

    if (filterStatus !== 'all') {
      filtered = filtered.filter(tax => 
        filterStatus === 'active' ? tax.isActive : !tax.isActive
      );
    }

    setFilteredTaxes(filtered);
    setCurrentPage(1);
  };

  const handleCreateTax = () => {
    setEditingTax(null);
    setShowForm(true);
  };

  const handleEditTax = (tax: RoomTax) => {
    setEditingTax(tax);
    setShowForm(true);
  };

  const handleDeleteTax = async (taxId: string) => {
    if (!confirm('Are you sure you want to delete this tax? This action cannot be undone.')) {
      return;
    }

    try {
      await api.delete(`/room-taxes/${taxId}`);

      toast({
        title: "Success",
        description: "Tax deleted successfully",
      });

      fetchTaxes();
      fetchTaxSummary();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete tax",
        variant: "destructive",
      });
    }
  };

  const handleBulkStatusUpdate = async (isActive: boolean) => {
    if (selectedTaxes.length === 0) {
      toast({
        title: "Warning",
        description: "Please select taxes to update",
        variant: "destructive",
      });
      return;
    }

    try {
      await api.patch(`/room-taxes/hotels/${hotelId}/bulk-update`, {
        taxIds: selectedTaxes,
        isActive
      });

      toast({
        title: "Success",
        description: `${selectedTaxes.length} taxes updated successfully`,
      });

      setSelectedTaxes([]);
      fetchTaxes();
      fetchTaxSummary();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update taxes",
        variant: "destructive",
      });
    }
  };

  const handleFormSubmit = async (taxData?: Record<string, unknown>) => {
    // If tax data is provided, apply multi-property settings
    if (taxData && applyToScope !== 'single') {
      try {
        const result = await applySettings({
          scope: applyToScope,
          propertyId: selectedPropertyId,
          settingUpdates: taxData,
          settingType: 'room_taxes',
        });

        if (!result) return; // Confirmation dialog shown

        setShowSuccess(true);
        if (successTimerRef.current) clearTimeout(successTimerRef.current);
        successTimerRef.current = setTimeout(() => setShowSuccess(false), 3000);
        toast.success(`Tax configuration updated successfully${
          applyToScope !== 'single' ? ` for ${result.propertiesUpdated} properties` : ''
        }`);
      } catch (error) {
        toast.error('Failed to update tax configuration');
      }
    }

    setShowForm(false);
    setApplyToScope('single');
    fetchTaxes();
    fetchTaxSummary();
  };

  const handleConfirm = async () => {
    if (pendingUpdate) {
      const result = await confirmBulkUpdate();
      if (result) {
        setShowSuccess(true);
        if (successTimerRef.current) clearTimeout(successTimerRef.current);
        successTimerRef.current = setTimeout(() => setShowSuccess(false), 3000);
        toast.success(`Tax configuration updated for ${result.propertiesUpdated} properties`);
        fetchTaxes();
        fetchTaxSummary();
      }
    }
  };

  const handleSelectTax = (taxId: string, checked: boolean) => {
    if (checked) {
      setSelectedTaxes([...selectedTaxes, taxId]);
    } else {
      setSelectedTaxes(selectedTaxes.filter(id => id !== taxId));
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const currentPageTaxIds = getCurrentPageTaxes().map(tax => tax._id);
      setSelectedTaxes([...selectedTaxes, ...currentPageTaxIds.filter(id => !selectedTaxes.includes(id))]);
    } else {
      const currentPageTaxIds = getCurrentPageTaxes().map(tax => tax._id);
      setSelectedTaxes(selectedTaxes.filter(id => !currentPageTaxIds.includes(id)));
    }
  };

  const getCurrentPageTaxes = () => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filteredTaxes.slice(startIndex, endIndex);
  };

  const getTaxTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      'VAT': 'bg-blue-100 text-blue-800',
      'GST': 'bg-green-100 text-green-800',
      'service_tax': 'bg-yellow-100 text-yellow-800',
      'luxury_tax': 'bg-purple-100 text-purple-800',
      'city_tax': 'bg-orange-100 text-orange-800',
      'tourism_tax': 'bg-pink-100 text-pink-800',
      'occupancy_tax': 'bg-indigo-100 text-indigo-800',
      'resort_fee': 'bg-teal-100 text-teal-800',
      'facility_tax': 'bg-gray-100 text-gray-800',
      'custom': 'bg-red-100 text-red-800'
    };
    return colors[type] || 'bg-gray-100 text-gray-800';
  };

  const formatTaxDisplay = (tax: RoomTax) => {
    if (tax.isPercentage) {
      return `${tax.taxRate}%`;
    } else {
      return `$${tax.fixedAmount} ${tax.calculationMethod.replace('_', ' ')}`;
    }
  };

  const totalPages = Math.ceil(filteredTaxes.length / itemsPerPage);
  const currentPageTaxes = getCurrentPageTaxes();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Success Message */}
      {showSuccess && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-800 dark:text-green-200 px-4 py-3 rounded-lg">
          <p className="font-medium">Tax configuration updated successfully!</p>
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
                  Tax settings are inherited from the property group
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

      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold dark:text-gray-100">Room Taxes</h1>
          <p className="text-gray-600 dark:text-gray-400">Manage room taxes and calculations</p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => setShowCalculator(true)}
            variant="outline"
            className="flex items-center gap-2"
          >
            <Calculator className="h-4 w-4" />
            Tax Calculator
          </Button>
          <Button
            onClick={handleCreateTax}
            className="flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Add Tax
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      {taxSummary && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <div>
                  <p className="text-sm font-medium text-gray-600">Active Taxes</p>
                  <div className="text-2xl font-bold">{taxSummary.totalActiveTaxes}</div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <div>
                  <p className="text-sm font-medium text-gray-600">Avg Tax Rate</p>
                  <div className="text-2xl font-bold">{taxSummary.averageTaxRate}%</div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <div>
                  <p className="text-sm font-medium text-gray-600">Tax Types</p>
                  <div className="text-2xl font-bold">{Object.keys(taxSummary.taxesByType).length}</div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <div>
                  <p className="text-sm font-medium text-gray-600">Tax Categories</p>
                  <div className="text-2xl font-bold">{Object.keys(taxSummary.taxesByCategory).length}</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters and Search */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row gap-4 items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Search taxes..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex gap-2">
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Tax Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="VAT">VAT</SelectItem>
                  <SelectItem value="GST">GST</SelectItem>
                  <SelectItem value="service_tax">Service Tax</SelectItem>
                  <SelectItem value="luxury_tax">Luxury Tax</SelectItem>
                  <SelectItem value="city_tax">City Tax</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterCategory} onValueChange={setFilterCategory}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  <SelectItem value="room_charge">Room Charge</SelectItem>
                  <SelectItem value="service_charge">Service Charge</SelectItem>
                  <SelectItem value="government">Government</SelectItem>
                  <SelectItem value="local_authority">Local Authority</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-[120px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Bulk Actions */}
          {selectedTaxes.length > 0 && (
            <div className="mb-4 p-4 bg-blue-50 rounded-lg flex justify-between items-center">
              <span className="text-sm text-blue-800">
                {selectedTaxes.length} tax(es) selected
              </span>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleBulkStatusUpdate(true)}
                >
                  Activate
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleBulkStatusUpdate(false)}
                >
                  Deactivate
                </Button>
              </div>
            </div>
          )}

          {/* Taxes Table */}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <input
                    type="checkbox"
                    onChange={(e) => handleSelectAll(e.target.checked)}
                    checked={currentPageTaxes.length > 0 && currentPageTaxes.every(tax => selectedTaxes.includes(tax._id))}
                  />
                </TableHead>
                <TableHead>Tax Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Rate/Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Valid Period</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {currentPageTaxes.map((tax) => (
                <TableRow key={tax._id}>
                  <TableCell>
                    <input
                      type="checkbox"
                      checked={selectedTaxes.includes(tax._id)}
                      onChange={(e) => handleSelectTax(tax._id, e.target.checked)}
                    />
                  </TableCell>
                  <TableCell>
                    <div>
                      <div className="font-medium">{tax.taxName}</div>
                      {tax.description && (
                        <div className="text-sm text-gray-500">{tax.description}</div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge className={getTaxTypeColor(tax.taxType)}>
                      {tax.taxType.toUpperCase()}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <span className="capitalize">
                      {tax.taxCategory.replace('_', ' ')}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div>
                      <div className="font-medium">{formatTaxDisplay(tax)}</div>
                      {tax.isCompoundTax && (
                        <Badge variant="secondary" className="text-xs">
                          Compound ({tax.compoundOrder})
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={tax.isActive ? "success" : "secondary"}>
                      {tax.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      <div>From: {new Date(tax.validFrom).toLocaleDateString()}</div>
                      {tax.validTo && (
                        <div>To: {new Date(tax.validTo).toLocaleDateString()}</div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEditTax(tax)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteTax(tax._id)}
                        className="text-red-600 hover:text-red-800"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center mt-6 gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(currentPage - 1)}
                disabled={currentPage === 1}
              >
                Previous
              </Button>
              <span className="flex items-center px-4 text-sm">
                Page {currentPage} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(currentPage + 1)}
                disabled={currentPage === totalPages}
              >
                Next
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Room Tax Form Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingTax ? 'Edit Room Tax' : 'Add New Room Tax'}
            </DialogTitle>
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
              warningMessage="These tax configurations will be applied to all selected properties. Existing taxes may be overridden."
            />
          </div>

          <RoomTaxForm
            tax={editingTax}
            hotelId={hotelId}
            onSubmit={handleFormSubmit}
            onCancel={() => {
              setShowForm(false);
              setApplyToScope('single');
            }}
          />
        </DialogContent>
      </Dialog>

      {/* Tax Calculator Dialog */}
      <Dialog open={showCalculator} onOpenChange={setShowCalculator}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Tax Calculator</DialogTitle>
          </DialogHeader>
          <TaxCalculationDisplay
            hotelId={hotelId}
            onClose={() => setShowCalculator(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Multi-Property Confirmation Dialog */}
      <ApplyToConfirmation
        isOpen={showConfirmation}
        scope={applyToScope}
        affectedCount={affectedCount}
        settingName="tax configurations"
        groupName={inheritanceStatus?.groupName}
        onConfirm={handleConfirm}
        onCancel={cancelBulkUpdate}
      />
    </div>
  );
};

export default withErrorBoundary(AdminRoomTaxes, { level: 'page' });