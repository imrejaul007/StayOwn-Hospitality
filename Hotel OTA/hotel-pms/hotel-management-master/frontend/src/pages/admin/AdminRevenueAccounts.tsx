import React, { useState, useEffect, useRef} from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { Plus, Search, Edit, Trash2, TrendingUp, CheckCircle, AlertCircle } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { toast } from '../../hooks/use-toast';
import RevenueAccountForm from '../../components/admin/RevenueAccountForm';
import RevenueTrackingDashboard from '../../components/admin/RevenueTrackingDashboard';
import { ApplyToSelector, ApplyToConfirmation, ApplyToScope } from '@/components/settings/ApplyToSelector';
import { useSettingsInheritance, useAffectedPropertiesCount } from '@/hooks/useSettingsInheritance';
import { useProperty } from '@/context/PropertyContext';
import { api } from '../../services/api';
import { withErrorBoundary } from '../../components/ErrorBoundary';
import { formatCurrency } from '@/utils/currencyUtils';

interface RevenueAccount {
  _id: string;
  accountCode: string;
  accountName: string;
  accountDescription?: string;
  revenueCategory: string;
  accountType: string;
  reportingGroup: string;
  isActive: boolean;
  isSystemGenerated: boolean;
  parentAccount?: {
    _id: string;
    accountCode: string;
    accountName: string;
  };
  accountLevel: number;
  sortOrder: number;
  glAccountCode?: string;
  applicableRoomTypes: unknown[];
  applicableChannels: string[];
  applicableRateTypes: string[];
  validFrom: string;
  validTo?: string;
  autoCalculation: {
    isEnabled: boolean;
    calculationMethod: string;
    calculationValue: number;
  };
  budgetInfo: {
    monthlyBudget: number;
    yearlyBudget: number;
    budgetCurrency: string;
  };
  auditInfo: {
    totalRevenue: number;
    transactionCount: number;
    lastRevenueDate?: string;
  };
  createdBy: {
    name: string;
    email: string;
  };
  createdAt: string;
  updatedAt: string;
}

interface RevenueSummary {
  totalAccounts: number;
  activeAccounts: number;
  totalBudgetedRevenue: number;
  totalActualRevenue: number;
  categoryBreakdown: Record<string, number>;
  typeBreakdown: Record<string, number>;
  budgetVariance: number;
}

const AdminRevenueAccounts: React.FC = () => {
  const [accounts, setAccounts] = useState<RevenueAccount[]>([]);
  const [filteredAccounts, setFilteredAccounts] = useState<RevenueAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [showDashboard, setShowDashboard] = useState(false);
  const [editingAccount, setEditingAccount] = useState<RevenueAccount | null>(null);
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);
  const [revenueSummary, setRevenueSummary] = useState<RevenueSummary | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(15);
  const [viewMode, setViewMode] = useState<'flat' | 'hierarchical'>('flat');

  // Multi-property support
  const { selectedProperty, selectedPropertyId } = useProperty();

  const hotelId = selectedPropertyId || '';
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

  const successTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (successTimerRef.current) clearTimeout(successTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (hotelId) {
      fetchAccounts();
      fetchRevenueSummary();
    }
  }, [viewMode, hotelId]);

  useEffect(() => {
    applyFilters();
  }, [accounts, searchTerm, filterCategory, filterType, filterStatus]);

  const fetchAccounts = async () => {
    try {
      setLoading(true);
      const url = viewMode === 'hierarchical'
        ? `/api/v1/revenue-accounts/hotels/${hotelId}?hierarchical=true&limit=100`
        : `/api/v1/revenue-accounts/hotels/${hotelId}?limit=100&sortBy=accountLevel&sortOrder=asc`;

      const { data } = await api.get(url.replace('/api/v1', ''));
      setAccounts(data.data?.accounts || []);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to fetch revenue accounts",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchRevenueSummary = async () => {
    try {
      const { data } = await api.get(`/revenue-accounts/hotels/${hotelId}/summary`);
      setRevenueSummary(data.data?.summary || null);
    } catch (error) {
      console.error('Failed to fetch revenue summary:', error);
    }
  };

  const applyFilters = () => {
    let filtered = flattenHierarchy(accounts);

    if (searchTerm) {
      filtered = filtered.filter(account =>
        account.accountCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
        account.accountName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        account.accountDescription?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (filterCategory !== 'all') {
      filtered = filtered.filter(account => account.revenueCategory === filterCategory);
    }

    if (filterType !== 'all') {
      filtered = filtered.filter(account => account.accountType === filterType);
    }

    if (filterStatus !== 'all') {
      filtered = filtered.filter(account => 
        filterStatus === 'active' ? account.isActive : !account.isActive
      );
    }

    setFilteredAccounts(filtered);
    setCurrentPage(1);
  };

  const flattenHierarchy = (accounts: Array<RevenueAccount & { children?: RevenueAccount[] }>): RevenueAccount[] => {
    const flattened: RevenueAccount[] = [];

    const flatten = (items: Array<RevenueAccount & { children?: RevenueAccount[] }>) => {
      items.forEach(item => {
        if (item._id) {
          flattened.push(item);
        }
        if (item.children && item.children.length > 0) {
          flatten(item.children);
        }
      });
    };

    flatten(accounts);
    return flattened;
  };

  const handleCreateAccount = () => {
    setEditingAccount(null);
    setShowForm(true);
  };

  const handleEditAccount = (account: RevenueAccount) => {
    setEditingAccount(account);
    setShowForm(true);
  };

  const handleDeleteAccount = async (accountId: string) => {
    if (!confirm('Are you sure you want to delete this revenue account? This action cannot be undone.')) {
      return;
    }

    try {
      if (applyToScope !== 'single') {
        const result = await applySettings({
          scope: applyToScope,
          propertyId: selectedPropertyId,
          settingUpdates: { action: 'delete', accountId },
          settingType: 'revenue_accounts',
        });

        if (!result) return; // Confirmation dialog will show

        setShowSuccess(true);
        if (successTimerRef.current) clearTimeout(successTimerRef.current);
        successTimerRef.current = setTimeout(() => setShowSuccess(false), 3000);
        toast({
          title: "Success",
          description: `Revenue account deleted successfully${
            applyToScope !== 'single' ? ` for ${result.propertiesUpdated} properties` : ''
          }`,
        });
        setApplyToScope('single');
      } else {
        await api.delete(`/revenue-accounts/${accountId}`);

        toast({
          title: "Success",
          description: "Revenue account deleted successfully",
        });
      }

      fetchAccounts();
      fetchRevenueSummary();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete revenue account",
        variant: "destructive",
      });
    }
  };

  const handleBulkStatusUpdate = async (isActive: boolean) => {
    if (selectedAccounts.length === 0) {
      toast({
        title: "Warning",
        description: "Please select accounts to update",
        variant: "destructive",
      });
      return;
    }

    try {
      if (applyToScope !== 'single') {
        const result = await applySettings({
          scope: applyToScope,
          propertyId: selectedPropertyId,
          settingUpdates: { action: 'bulkStatus', accountIds: selectedAccounts, isActive },
          settingType: 'revenue_accounts',
        });

        if (!result) return; // Confirmation dialog will show

        setShowSuccess(true);
        if (successTimerRef.current) clearTimeout(successTimerRef.current);
        successTimerRef.current = setTimeout(() => setShowSuccess(false), 3000);
        toast({
          title: "Success",
          description: `Accounts updated successfully${
            applyToScope !== 'single' ? ` for ${result.propertiesUpdated} properties` : ''
          }`,
        });
        setApplyToScope('single');
      } else {
        await api.patch(`/revenue-accounts/hotels/${hotelId}/bulk-update`, {
          accountIds: selectedAccounts,
          isActive
        });

        toast({
          title: "Success",
          description: `${selectedAccounts.length} accounts updated successfully`,
        });
      }

      setSelectedAccounts([]);
      fetchAccounts();
      fetchRevenueSummary();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update accounts",
        variant: "destructive",
      });
    }
  };

  const handleConfirm = async () => {
    if (pendingUpdate) {
      const result = await confirmBulkUpdate();
      if (result) {
        setShowSuccess(true);
        if (successTimerRef.current) clearTimeout(successTimerRef.current);
        successTimerRef.current = setTimeout(() => setShowSuccess(false), 3000);
        toast({
          title: "Success",
          description: `Updated for ${result.propertiesUpdated} properties`,
        });
        setApplyToScope('single');
        fetchAccounts();
        fetchRevenueSummary();
      }
    }
  };

  const handleFormSubmit = () => {
    setShowForm(false);
    fetchAccounts();
    fetchRevenueSummary();
  };

  const handleSelectAccount = (accountId: string, checked: boolean) => {
    if (checked) {
      setSelectedAccounts([...selectedAccounts, accountId]);
    } else {
      setSelectedAccounts(selectedAccounts.filter(id => id !== accountId));
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const currentPageAccountIds = getCurrentPageAccounts().map(account => account._id);
      setSelectedAccounts([...selectedAccounts, ...currentPageAccountIds.filter(id => !selectedAccounts.includes(id))]);
    } else {
      const currentPageAccountIds = getCurrentPageAccounts().map(account => account._id);
      setSelectedAccounts(selectedAccounts.filter(id => !currentPageAccountIds.includes(id)));
    }
  };

  const getCurrentPageAccounts = () => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filteredAccounts.slice(startIndex, endIndex);
  };

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      'room_revenue': 'bg-blue-100 text-blue-800',
      'upgrade_revenue': 'bg-green-100 text-green-800',
      'package_revenue': 'bg-yellow-100 text-yellow-800',
      'addon_revenue': 'bg-purple-100 text-purple-800',
      'fee_revenue': 'bg-orange-100 text-orange-800',
      'corporate_revenue': 'bg-indigo-100 text-indigo-800',
      'group_revenue': 'bg-pink-100 text-pink-800',
      'other_revenue': 'bg-gray-100 text-gray-800'
    };
    return colors[category] || 'bg-gray-100 text-gray-800';
  };

  const getTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      'primary': 'bg-emerald-100 text-emerald-800',
      'secondary': 'bg-blue-100 text-blue-800',
      'adjustment': 'bg-yellow-100 text-yellow-800',
      'promotional': 'bg-pink-100 text-pink-800',
      'fee': 'bg-orange-100 text-orange-800',
      'tax': 'bg-red-100 text-red-800',
      'deposit': 'bg-purple-100 text-purple-800'
    };
    return colors[type] || 'bg-gray-100 text-gray-800';
  };

  const getAccountHierarchyDisplay = (account: RevenueAccount) => {
    const indent = '  '.repeat(account.accountLevel - 1);
    return indent + account.accountName;
  };

  const renderAccountRow = (account: RevenueAccount) => (
    <TableRow key={account._id}>
      <TableCell>
        <input
          type="checkbox"
          checked={selectedAccounts.includes(account._id)}
          onChange={(e) => handleSelectAccount(account._id, e.target.checked)}
          disabled={account.isSystemGenerated}
        />
      </TableCell>
      <TableCell>
        <div>
          <div className="font-medium flex items-center gap-2">
            {viewMode === 'hierarchical' && account.accountLevel > 1 && (
              <span className="text-gray-400">{'└─'.repeat(account.accountLevel - 1)}</span>
            )}
            {account.accountCode}
            {account.isSystemGenerated && (
              <Badge variant="outline" className="text-xs">
                System
              </Badge>
            )}
          </div>
          <div className="text-sm text-gray-500 font-mono">
            {account.glAccountCode}
          </div>
        </div>
      </TableCell>
      <TableCell>
        <div>
          <div className="font-medium">{account.accountName}</div>
          {account.accountDescription && (
            <div className="text-sm text-gray-500">{account.accountDescription}</div>
          )}
        </div>
      </TableCell>
      <TableCell>
        <Badge className={getCategoryColor(account.revenueCategory)}>
          {account.revenueCategory.replace(/_/g, ' ')}
        </Badge>
      </TableCell>
      <TableCell>
        <Badge className={getTypeColor(account.accountType)}>
          {account.accountType}
        </Badge>
      </TableCell>
      <TableCell>
        <div className="text-right">
          <div className="font-medium">
            {formatCurrency(account.auditInfo.totalRevenue || 0)}
          </div>
          <div className="text-sm text-gray-500">
            {account.auditInfo.transactionCount || 0} transactions
          </div>
        </div>
      </TableCell>
      <TableCell>
        <div className="text-right">
          <div className="font-medium">
            {formatCurrency(account.budgetInfo.yearlyBudget || 0)}
          </div>
          {account.budgetInfo.yearlyBudget > 0 && (
            <div className="text-sm text-gray-500">
              {((account.auditInfo.totalRevenue || 0) / account.budgetInfo.yearlyBudget * 100).toFixed(1)}%
            </div>
          )}
        </div>
      </TableCell>
      <TableCell>
        <Badge variant={account.isActive ? "success" : "secondary"}>
          {account.isActive ? 'Active' : 'Inactive'}
        </Badge>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleEditAccount(account)}
          >
            <Edit className="h-4 w-4" />
          </Button>
          {!account.isSystemGenerated && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleDeleteAccount(account._id)}
              className="text-red-600 hover:text-red-800"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </TableCell>
    </TableRow>
  );

  const totalPages = Math.ceil(filteredAccounts.length / itemsPerPage);
  const currentPageAccounts = getCurrentPageAccounts();

  if (!hotelId) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">No Property Selected</h2>
          <p className="text-gray-600">Please select a property from the header to view revenue accounts.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Revenue Accounts</h1>
          <p className="text-gray-600">Manage revenue account codes and tracking</p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => setShowDashboard(true)}
            variant="outline"
            className="flex items-center gap-2"
          >
            <TrendingUp className="h-4 w-4" />
            Analytics
          </Button>
          <Button
            onClick={handleCreateAccount}
            className="flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Add Account
          </Button>
        </div>
      </div>

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
            <AlertCircle className="w-5 h-5 mr-2" />
            <p className="font-medium">Error: {updateError}</p>
          </div>
        </div>
      )}

      {/* Inheritance Status Card */}
      {inheritanceStatus?.isInheriting && inheritanceStatus?.hasGroup && (
        <Card className="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 mb-4">
          <CardContent className="p-4">
            <div className="flex items-start">
              <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 mr-3 mt-0.5" />
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

      {/* Summary Cards */}
      {revenueSummary && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <div>
                  <p className="text-sm font-medium text-gray-600">Active Accounts</p>
                  <div className="text-2xl font-bold">{revenueSummary.activeAccounts}</div>
                  <div className="text-sm text-gray-500">
                    of {revenueSummary.totalAccounts} total
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Revenue</p>
                  <div className="text-2xl font-bold">
                    {formatCurrency(revenueSummary.totalActualRevenue)}
                  </div>
                  <div className="text-sm text-gray-500">
                    Actual to date
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <div>
                  <p className="text-sm font-medium text-gray-600">Budgeted Revenue</p>
                  <div className="text-2xl font-bold">
                    {formatCurrency(revenueSummary.totalBudgetedRevenue)}
                  </div>
                  <div className="text-sm text-gray-500">
                    Annual target
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <div>
                  <p className="text-sm font-medium text-gray-600">Budget Variance</p>
                  <div className={`text-2xl font-bold ${
                    revenueSummary.budgetVariance >= 0 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {revenueSummary.budgetVariance >= 0 ? '+' : ''}
                    {formatCurrency(revenueSummary.budgetVariance)}
                  </div>
                  <div className="text-sm text-gray-500">
                    {revenueSummary.totalBudgetedRevenue > 0 
                      ? `${((revenueSummary.budgetVariance / revenueSummary.totalBudgetedRevenue) * 100).toFixed(1)}%`
                      : '0%'
                    }
                  </div>
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
                placeholder="Search accounts..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex gap-2">
              <Select value={viewMode} onValueChange={(value: 'flat' | 'hierarchical') => setViewMode(value)}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="flat">Flat View</SelectItem>
                  <SelectItem value="hierarchical">Hierarchy</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterCategory} onValueChange={setFilterCategory}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  <SelectItem value="room_revenue">Room Revenue</SelectItem>
                  <SelectItem value="upgrade_revenue">Upgrade Revenue</SelectItem>
                  <SelectItem value="package_revenue">Package Revenue</SelectItem>
                  <SelectItem value="fee_revenue">Fee Revenue</SelectItem>
                  <SelectItem value="other_revenue">Other Revenue</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="w-[120px]">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="primary">Primary</SelectItem>
                  <SelectItem value="secondary">Secondary</SelectItem>
                  <SelectItem value="adjustment">Adjustment</SelectItem>
                  <SelectItem value="fee">Fee</SelectItem>
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
          {selectedAccounts.length > 0 && (
            <div className="mb-4 p-4 bg-blue-50 rounded-lg flex justify-between items-center">
              <span className="text-sm text-blue-800">
                {selectedAccounts.length} account(s) selected
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

          {/* Accounts Table */}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <input
                    type="checkbox"
                    onChange={(e) => handleSelectAll(e.target.checked)}
                    checked={
                      currentPageAccounts.length > 0 && 
                      currentPageAccounts.filter(acc => !acc.isSystemGenerated).every(account => 
                        selectedAccounts.includes(account._id)
                      )
                    }
                  />
                </TableHead>
                <TableHead>Account Code</TableHead>
                <TableHead>Account Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Actual Revenue</TableHead>
                <TableHead className="text-right">Budget</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {currentPageAccounts.map(renderAccountRow)}
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

      {/* Revenue Account Form Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingAccount ? 'Edit Revenue Account' : 'Add New Revenue Account'}
            </DialogTitle>
          </DialogHeader>
          <RevenueAccountForm
            account={editingAccount}
            hotelId={hotelId}
            onSubmit={handleFormSubmit}
            onCancel={() => setShowForm(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Revenue Analytics Dashboard Dialog */}
      <Dialog open={showDashboard} onOpenChange={setShowDashboard}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Revenue Analytics Dashboard</DialogTitle>
          </DialogHeader>
          <RevenueTrackingDashboard
            hotelId={hotelId}
            onClose={() => setShowDashboard(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog */}
      <ApplyToConfirmation
        isOpen={showConfirmation}
        scope={applyToScope}
        affectedCount={affectedCount}
        settingName="Revenue Account Mappings"
        groupName={inheritanceStatus?.groupName}
        onConfirm={handleConfirm}
        onCancel={cancelBulkUpdate}
      />
    </div>
  );
};

export default withErrorBoundary(AdminRevenueAccounts, { level: 'page' });