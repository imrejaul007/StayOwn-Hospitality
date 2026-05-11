import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import {
  Plus,
  Edit,
  Search,
  Download,
  Upload,
  TrendingUp,
  TrendingDown,
  IndianRupee,
  Target,
  CheckCircle,
  Clock,
  BarChart3,
  RefreshCw
} from 'lucide-react';
import { formatCurrency } from '@/utils/currencyUtils';
import { toast } from 'sonner';
import financialService from '@/services/financialService';

interface Budget {
  _id: string;
  budgetName: string;
  fiscalYear: number;
  period: {
    startDate: Date;
    endDate: Date;
  };
  currency: string;
  status: 'draft' | 'active' | 'approved' | 'closed';
  budgetCategories: BudgetCategory[];
  totalBudgetedAmount: number;
  totalActualAmount: number;
  approvedBy?: string;
  approvedDate?: Date;
  createdBy: string;
  lastUpdated: Date;
}

interface BudgetCategory {
  categoryName: string;
  accountId: string;
  budgetedAmount: number;
  actualAmount: number;
  variance: number;
  variancePercentage: number;
  quarters: {
    q1: number;
    q2: number;
    q3: number;
    q4: number;
  };
}

interface BudgetManagementProps {
  readOnly?: boolean;
}

const BudgetManagement: React.FC<BudgetManagementProps> = ({ readOnly = false }) => {
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBudget, setSelectedBudget] = useState<Budget | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [selectedTab, setSelectedTab] = useState('budgets');
  const [showBudgetDialog, setShowBudgetDialog] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 20;

  const [budgetFormData, setBudgetFormData] = useState({
    budgetName: '',
    fiscalYear: new Date().getFullYear(),
    currency: 'INR',
    status: 'draft' as const
  });

  const budgetStatuses = [
    { value: 'draft', label: 'Draft', color: 'secondary' },
    { value: 'active', label: 'Active', color: 'default' },
    { value: 'approved', label: 'Approved', color: 'default' },
    { value: 'closed', label: 'Closed', color: 'outline' }
  ];

  const fetchBudgets = useCallback(async () => {
    try {
      setLoading(true);
      const filters: Record<string, unknown> = {};
      if (filterStatus && filterStatus !== 'all') filters.status = filterStatus;

      const response = await financialService.getBudgets(filters);
      const budgetData = response.data?.budgets || [];

      setBudgets(budgetData);
      if (budgetData.length > 0) {
        setSelectedBudget(budgetData[0]);
      }

    } catch (error: unknown) {
      toast.error('Failed to load budgets');
      setBudgets([]);
      setSelectedBudget(null);
    } finally {
      setLoading(false);
    }
  }, [filterStatus]);

  useEffect(() => {
    fetchBudgets();
  }, [fetchBudgets]);

  const handleCreateBudget = () => {
    setShowBudgetDialog(true);
  };

  const handleSubmitBudget = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      const budgetData = {
        budgetName: budgetFormData.budgetName,
        budgetType: 'Operating',
        fiscalYear: budgetFormData.fiscalYear,
        currency: budgetFormData.currency,
        status: budgetFormData.status.charAt(0).toUpperCase() + budgetFormData.status.slice(1),
        budgetLines: []
      };

      await financialService.createBudget(budgetData);
      await fetchBudgets();

      toast.success('Budget created successfully');
      setShowBudgetDialog(false);

      // Reset form
      setBudgetFormData({
        budgetName: '',
        fiscalYear: new Date().getFullYear(),
        currency: 'INR',
        status: 'draft'
      });
    } catch (error: unknown) {
      toast.error('Failed to create budget: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setSubmitting(false);
    }
  };

  const getVarianceColor = (percentage: number) => {
    if (percentage > 10) return 'text-red-600';
    if (percentage < -10) return 'text-green-600';
    return 'text-yellow-600';
  };

  const getVarianceIcon = (percentage: number) => {
    if (percentage > 5) return <TrendingUp className="w-4 h-4 text-red-600" />;
    if (percentage < -5) return <TrendingDown className="w-4 h-4 text-green-600" />;
    return <Target className="w-4 h-4 text-yellow-600" />;
  };

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterStatus]);

  const filteredBudgets = budgets.filter(budget => {
    const matchesSearch = !searchTerm || budget.budgetName?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  const totalPages = Math.max(1, Math.ceil(filteredBudgets.length / ITEMS_PER_PAGE));
  const paginatedBudgets = filteredBudgets.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const budgetProgress = selectedBudget && selectedBudget.totalBudgetedAmount > 0
    ? Math.round((selectedBudget.totalActualAmount / selectedBudget.totalBudgetedAmount) * 100) : 0;

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-64"></div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-32 bg-gray-200 rounded"></div>
            ))}
          </div>
          <div className="h-96 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-4 sm:gap-0 sm:justify-between sm:items-center">
        <div>
          <h1 className="text-3xl font-bold">Budget Management</h1>
          <p className="text-gray-600">Plan, track, and analyze your financial budgets</p>
        </div>
        <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
          <Button variant="outline" onClick={() => toast.info('Budget import coming soon')}>
            <Upload className="w-4 h-4 mr-2" />
            Import
          </Button>
          <Button variant="outline" onClick={() => toast.info('Budget export coming soon')}>
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
          {!readOnly && (
          <Button onClick={handleCreateBudget}>
            <Plus className="w-4 h-4 mr-2" />
            Create Budget
          </Button>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      {selectedBudget && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Total Budgeted</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <p className="text-2xl font-bold">{formatCurrency(selectedBudget.totalBudgetedAmount)}</p>
                <Target className="w-5 h-5 text-blue-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Actual Spent</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <p className="text-2xl font-bold">{formatCurrency(selectedBudget.totalActualAmount)}</p>
                <IndianRupee className="w-5 h-5 text-green-500" />
              </div>
              <div className="mt-2">
                <Progress value={budgetProgress} className="h-2" />
                <p className="text-xs text-gray-500 mt-1">{budgetProgress}% of budget used</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Variance</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <p className={`text-2xl font-bold ${getVarianceColor(
                  selectedBudget.totalBudgetedAmount > 0 ? ((selectedBudget.totalActualAmount - selectedBudget.totalBudgetedAmount) / selectedBudget.totalBudgetedAmount) * 100 : 0
                )}`}>
                  {formatCurrency(selectedBudget.totalActualAmount - selectedBudget.totalBudgetedAmount)}
                </p>
                {getVarianceIcon(selectedBudget.totalBudgetedAmount > 0 ? ((selectedBudget.totalActualAmount - selectedBudget.totalBudgetedAmount) / selectedBudget.totalBudgetedAmount) * 100 : 0)}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <Badge variant={selectedBudget.status === 'approved' ? 'default' : 'secondary'}>
                  {selectedBudget.status.toUpperCase()}
                </Badge>
                {selectedBudget.status === 'approved' ? (
                  <CheckCircle className="w-5 h-5 text-green-500" />
                ) : (
                  <Clock className="w-5 h-5 text-yellow-500" />
                )}
              </div>
              <p className="text-xs text-gray-500 mt-1">FY {selectedBudget.fiscalYear}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main Content */}
      <Tabs value={selectedTab} onValueChange={setSelectedTab}>
        <TabsList>
          <TabsTrigger value="budgets">Budgets</TabsTrigger>
          <TabsTrigger value="categories">Categories</TabsTrigger>
          <TabsTrigger value="analysis">Analysis</TabsTrigger>
        </TabsList>

        <TabsContent value="budgets" className="space-y-4">
          {/* Filters */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Budget Filters</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex space-x-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search budgets..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="All Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    {budgetStatuses.map(status => (
                      <SelectItem key={status.value} value={status.value}>
                        {status.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Budgets Table */}
          <Card>
            <CardHeader>
              <CardTitle>Budget Overview ({filteredBudgets.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Budget Name</TableHead>
                    <TableHead>Fiscal Year</TableHead>
                    <TableHead className="text-right">Budgeted Amount</TableHead>
                    <TableHead className="text-right">Actual Amount</TableHead>
                    <TableHead className="text-right">Variance</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedBudgets.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                        No budgets found
                      </TableCell>
                    </TableRow>
                  ) : paginatedBudgets.map((budget) => {
                    const variance = (budget.totalActualAmount || 0) - (budget.totalBudgetedAmount || 0);
                    const variancePercentage = budget.totalBudgetedAmount > 0 ? (variance / budget.totalBudgetedAmount) * 100 : 0;
                    const statusLower = budget.status?.toLowerCase() || 'draft';

                    return (
                      <TableRow key={budget._id}>
                        <TableCell>
                          <div role="button" tabIndex={0} className="cursor-pointer" onClick={() => setSelectedBudget(budget)} onKeyDown={(e: React.KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedBudget(budget); } }}>
                            <p className="font-medium">{budget.budgetName}</p>
                          </div>
                        </TableCell>
                        <TableCell>FY {budget.fiscalYear}</TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(budget.totalBudgetedAmount || 0)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(budget.totalActualAmount || 0)}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className={`flex items-center justify-end ${getVarianceColor(variancePercentage)}`}>
                            {getVarianceIcon(variancePercentage)}
                            <div className="ml-2">
                              <p className="font-medium">{formatCurrency(variance)}</p>
                              <p className="text-xs">({variancePercentage.toFixed(1)}%)</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={(budgetStatuses.find(s => s.value === statusLower)?.color || 'secondary') as 'default' | 'secondary' | 'outline'}>
                            {budget.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button size="sm" variant="outline" onClick={() => toast.info('Budget editing coming soon')}>
                            <Edit className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              {/* Pagination Controls */}
              {filteredBudgets.length > ITEMS_PER_PAGE && (
                <div className="flex items-center justify-between mt-4 pt-4 border-t">
                  <p className="text-sm text-gray-600">
                    Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1} to{' '}
                    {Math.min(currentPage * ITEMS_PER_PAGE, filteredBudgets.length)} of{' '}
                    {filteredBudgets.length} budgets
                  </p>
                  <div className="flex space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={currentPage <= 1}
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    >
                      Previous
                    </Button>
                    <span className="flex items-center px-3 text-sm text-gray-600">
                      Page {currentPage} of {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={currentPage >= totalPages}
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="categories">
          {selectedBudget ? (
            <Card>
              <CardHeader>
                <CardTitle>{selectedBudget.budgetName} - Categories</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Category</TableHead>
                      <TableHead className="text-right">Budgeted</TableHead>
                      <TableHead className="text-right">Actual</TableHead>
                      <TableHead className="text-right">Variance</TableHead>
                      <TableHead>Progress</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(!selectedBudget.budgetCategories || selectedBudget.budgetCategories.length === 0) ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8 text-gray-500">
                          No budget categories defined. Add budget line items to see category breakdowns.
                        </TableCell>
                      </TableRow>
                    ) : selectedBudget.budgetCategories.map((category, index) => {
                      const catVariancePct = category.budgetedAmount > 0 ? (category.variancePercentage ?? ((category.actualAmount - category.budgetedAmount) / category.budgetedAmount) * 100) : 0;
                      const catProgress = category.budgetedAmount > 0 ? Math.min((category.actualAmount / category.budgetedAmount) * 100, 100) : 0;
                      return (
                        <TableRow key={`cat-${index}-${category.categoryName}`}>
                          <TableCell className="font-medium">{category.categoryName}</TableCell>
                          <TableCell className="text-right">{formatCurrency(category.budgetedAmount)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(category.actualAmount)}</TableCell>
                          <TableCell className={`text-right ${getVarianceColor(catVariancePct)}`}>
                            {formatCurrency(category.variance || 0)} ({catVariancePct.toFixed(1)}%)
                          </TableCell>
                          <TableCell>
                            <Progress value={catProgress} className="h-2" />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="text-center py-8">
                <p className="text-gray-600">Select a budget to view categories</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="analysis">
          <Card>
            <CardHeader>
              <CardTitle>Budget Analysis</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <Button variant="outline" className="justify-start" onClick={() => toast.info('Budget vs Actual report coming soon')}>
                  <BarChart3 className="w-4 h-4 mr-2" />
                  Budget vs Actual Report
                </Button>
                <Button variant="outline" className="justify-start" onClick={() => toast.info('Variance analysis coming soon')}>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Variance Analysis
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Create Budget Dialog */}
      <Dialog open={showBudgetDialog} onOpenChange={setShowBudgetDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Budget</DialogTitle>
            <DialogDescription>Create a new budget for planning and tracking</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmitBudget} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="budgetName">Budget Name</Label>
              <Input
                id="budgetName"
                value={budgetFormData.budgetName}
                onChange={(e) => setBudgetFormData({...budgetFormData, budgetName: e.target.value})}
                placeholder="e.g., Annual Budget 2024"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="fiscalYear">Fiscal Year</Label>
                <Input
                  id="fiscalYear"
                  type="number"
                  min={2020}
                  max={2099}
                  value={budgetFormData.fiscalYear}
                  onChange={(e) => setBudgetFormData({...budgetFormData, fiscalYear: parseInt(e.target.value) || new Date().getFullYear()})}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="currency">Currency</Label>
                <Select
                  value={budgetFormData.currency}
                  onValueChange={(value) => setBudgetFormData({...budgetFormData, currency: value})}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="INR">INR - Indian Rupee</SelectItem>
                    <SelectItem value="USD">USD - US Dollar</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex justify-end space-x-2">
              <Button type="button" variant="outline" onClick={() => setShowBudgetDialog(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? 'Creating...' : 'Create Budget'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default BudgetManagement;