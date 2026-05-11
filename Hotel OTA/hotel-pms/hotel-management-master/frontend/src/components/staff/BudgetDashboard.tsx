import React, { useState, useEffect, useCallback } from 'react';
import {
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  DollarSign,
  Calendar,
  Target,
  CreditCard,
  Wallet,
  IndianRupee
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { formatCurrency } from '../../utils/formatters';
import {
  staffSupplyRequestsService,
  DepartmentBudget,
  BudgetAlert
} from '../../services/staffSupplyRequestsService';
import toast from 'react-hot-toast';

interface BudgetDashboardProps {
  onBudgetLoad?: (budget: DepartmentBudget) => void;
}

export default function BudgetDashboard({ onBudgetLoad }: BudgetDashboardProps) {
  const [budget, setBudget] = useState<DepartmentBudget | null>(null);
  const [alerts, setAlerts] = useState<BudgetAlert[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchBudgetData = useCallback(async () => {
    try {
      setLoading(true);
      const [budgetResponse, alertsResponse] = await Promise.all([
        staffSupplyRequestsService.getDepartmentBudget(),
        staffSupplyRequestsService.getBudgetAlerts()
      ]);

      setBudget(budgetResponse.data);
      setAlerts(alertsResponse.data);

      if (onBudgetLoad && budgetResponse.data) {
        onBudgetLoad(budgetResponse.data);
      }
    } catch (error) {
      toast.error('Failed to load budget information');
    } finally {
      setLoading(false);
    }
  }, [onBudgetLoad]);

  useEffect(() => {
    fetchBudgetData();
  }, [fetchBudgetData]);

  if (loading) {
    return (
      <Card className="bg-white rounded-xl shadow-lg border border-gray-200">
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-gray-200 rounded w-1/3"></div>
            <div className="h-8 bg-gray-200 rounded w-2/3"></div>
            <div className="h-2 bg-gray-200 rounded w-full"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!budget) {
    return (
      <Card className="bg-white rounded-xl shadow-lg border border-gray-200">
        <CardContent className="p-6 text-center">
          <Wallet className="h-12 w-12 mx-auto mb-4 text-gray-300" />
          <p className="text-gray-500">Budget information not available</p>
        </CardContent>
      </Card>
    );
  }

  const getUtilizationColor = (percentage: number) => {
    if (percentage >= 90) return 'text-red-600 bg-red-50';
    if (percentage >= 75) return 'text-orange-600 bg-orange-50';
    if (percentage >= 50) return 'text-yellow-600 bg-yellow-50';
    return 'text-green-600 bg-green-50';
  };

  const getProgressColor = (percentage: number) => {
    if (percentage >= 90) return 'bg-red-500';
    if (percentage >= 75) return 'bg-orange-500';
    if (percentage >= 50) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  return (
    <div className="space-y-6">
      {/* Budget Alerts */}
      {alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.map((alert, index) => (
            <div
              key={`alerts-${index}-${alert.type}`}
              className={`p-3 rounded-lg border-l-4 ${
                alert.type === 'critical'
                  ? 'bg-red-50 border-red-500 text-red-800'
                  : alert.type === 'warning'
                  ? 'bg-orange-50 border-orange-500 text-orange-800'
                  : 'bg-blue-50 border-blue-500 text-blue-800'
              }`}
            >
              <div className="flex items-center">
                <AlertTriangle className="h-4 w-4 mr-2" />
                <span className="text-sm font-medium">{alert.message}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Budget Overview */}
      <Card className="bg-white rounded-xl shadow-lg border border-gray-200">
        <CardHeader className="border-b border-gray-200">
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl font-bold text-gray-900 flex items-center">
              <Wallet className="h-6 w-6 mr-2 text-blue-600" />
              Department Budget
            </CardTitle>
            <div className="text-sm text-gray-500 capitalize">
              {budget.department.replace('_', ' ')}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          {/* Budget Utilization */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">Monthly Budget Utilization</span>
              <span className={`text-sm font-bold px-2 py-1 rounded-full ${getUtilizationColor(budget.utilizationPercentage)}`}>
                {budget.utilizationPercentage.toFixed(1)}%
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div
                className={`h-3 rounded-full transition-all duration-300 ${getProgressColor(budget.utilizationPercentage)}`}
                style={{ width: `${Math.min(budget.utilizationPercentage, 100)}%` }}
              />
            </div>
          </div>

          {/* Budget Breakdown */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <div className="flex items-center justify-center mb-2">
                <Target className="h-5 w-5 text-blue-600" />
              </div>
              <div className="text-lg font-bold text-blue-900">
                {formatCurrency(budget.monthlyAllocation)}
              </div>
              <div className="text-xs text-blue-600 font-medium">Monthly Budget</div>
            </div>

            <div className="text-center p-4 bg-green-50 rounded-lg">
              <div className="flex items-center justify-center mb-2">
                <TrendingUp className="h-5 w-5 text-green-600" />
              </div>
              <div className="text-lg font-bold text-green-900">
                {formatCurrency(budget.currentSpent)}
              </div>
              <div className="text-xs text-green-600 font-medium">Spent</div>
            </div>

            <div className="text-center p-4 bg-orange-50 rounded-lg">
              <div className="flex items-center justify-center mb-2">
                <CreditCard className="h-5 w-5 text-orange-600" />
              </div>
              <div className="text-lg font-bold text-orange-900">
                {formatCurrency(budget.pendingCommitments)}
              </div>
              <div className="text-xs text-orange-600 font-medium">Pending</div>
            </div>

            <div className="text-center p-4 bg-purple-50 rounded-lg">
              <div className="flex items-center justify-center mb-2">
                <IndianRupee className="h-5 w-5 text-purple-600" />
              </div>
              <div className="text-lg font-bold text-purple-900">
                {formatCurrency(budget.remainingBudget)}
              </div>
              <div className="text-xs text-purple-600 font-medium">Remaining</div>
            </div>
          </div>

          {/* Budget Periods */}
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 border border-gray-200 rounded-lg">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">Quarterly Budget</span>
                <span className="text-lg font-bold text-gray-900">
                  {formatCurrency(budget.quarterlyAllocation)}
                </span>
              </div>
            </div>
            <div className="p-4 border border-gray-200 rounded-lg">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">Yearly Budget</span>
                <span className="text-lg font-bold text-gray-900">
                  {formatCurrency(budget.yearlyAllocation)}
                </span>
              </div>
            </div>
          </div>

          {/* Last Updated */}
          <div className="mt-4 flex items-center justify-between text-xs text-gray-500">
            <div className="flex items-center">
              <Calendar className="h-3 w-3 mr-1" />
              Last updated: {new Date(budget.lastUpdated).toLocaleDateString()}
            </div>
            <Button
              size="sm"
              variant="secondary"
              onClick={fetchBudgetData}
              className="text-xs"
            >
              Refresh
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}