import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { toast } from '@/utils/toast';
import {
  Calendar,
  Clock,
  AlertTriangle,
  CheckCircle,
  Package,
  TrendingUp,
  RefreshCw,
  Filter,
  Download,
  Plus,
  Eye,
  Edit,
  Trash2,
  AlertCircle,
  CheckSquare,
  XCircle,
  Timer,
  IndianRupee,
  BarChart3,
  PieChart
} from 'lucide-react';
import laundryService, { LaundryTransaction, LaundryDashboard as LaundryDashboardData } from '@/services/laundryService';
import { formatCurrency } from '@/utils/currencyUtils';

interface LaundryDashboardProps {
  className?: string;
}

const LaundryDashboard: React.FC<LaundryDashboardProps> = ({ className = '' }) => {
  const [dashboardData, setDashboardData] = useState<LaundryDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState('30d');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  useEffect(() => {
    fetchDashboardData();
    const interval = setInterval(fetchDashboardData, 30000); // Update every 30 seconds
    return () => clearInterval(interval);
  }, [selectedPeriod, selectedStatus]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);

      const filters: Record<string, unknown> = {};
      if (selectedStatus !== 'all') {
        filters.status = selectedStatus;
      }

      // Calculate date range based on period
      const endDate = new Date();
      const startDate = new Date();
      switch (selectedPeriod) {
        case '7d':
          startDate.setDate(endDate.getDate() - 7);
          break;
        case '30d':
          startDate.setDate(endDate.getDate() - 30);
          break;
        case '90d':
          startDate.setDate(endDate.getDate() - 90);
          break;
        case '1y':
          startDate.setFullYear(endDate.getFullYear() - 1);
          break;
      }
      filters.startDate = startDate.toISOString().split('T')[0];
      filters.endDate = endDate.toISOString().split('T')[0];

      const data = await laundryService.getLaundryDashboard(filters);
      setDashboardData(data);
      setLastUpdate(new Date());
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to fetch laundry dashboard data');
      toast.error('Failed to load laundry dashboard');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    fetchDashboardData();
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="w-4 h-4" />;
      case 'in_laundry':
        return <Package className="w-4 h-4" />;
      case 'cleaning':
        return <RefreshCw className="w-4 h-4" />;
      case 'ready':
        return <CheckCircle className="w-4 h-4" />;
      case 'returned':
        return <CheckSquare className="w-4 h-4" />;
      case 'lost':
        return <XCircle className="w-4 h-4" />;
      case 'damaged':
        return <AlertTriangle className="w-4 h-4" />;
      default:
        return <AlertCircle className="w-4 h-4" />;
    }
  };

  const getStatusColor = (status: string) => {
    return laundryService.getStatusColor(status);
  };

  const getStatusText = (status: string) => {
    return laundryService.getStatusText(status);
  };

  if (loading && !dashboardData) {
    return (
      <div className={`space-y-6 ${className}`}>
        <div className="flex items-center justify-between">
          <div>
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-96 mt-2" />
          </div>
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`space-y-6 ${className}`}>
        <div className="text-center py-12">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Error Loading Dashboard</h3>
          <p className="text-gray-600 mb-4">{error}</p>
          <Button onClick={handleRefresh} variant="outline">
            <RefreshCw className="w-4 h-4 mr-2" />
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Laundry Management</h1>
          <p className="text-gray-600">
            Track and manage laundry items from rooms to laundry service and back
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Clock className="w-4 h-4" />
            Last updated: {lastUpdate.toLocaleTimeString()}
          </div>
          <Button onClick={handleRefresh} variant="outline" size="sm">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7d">Last 7 days</SelectItem>
            <SelectItem value="30d">Last 30 days</SelectItem>
            <SelectItem value="90d">Last 90 days</SelectItem>
            <SelectItem value="1y">Last year</SelectItem>
          </SelectContent>
        </Select>

        <Select value={selectedStatus} onValueChange={setSelectedStatus}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="in_laundry">In Laundry</SelectItem>
            <SelectItem value="cleaning">Cleaning</SelectItem>
            <SelectItem value="ready">Ready</SelectItem>
            <SelectItem value="returned">Returned</SelectItem>
            <SelectItem value="lost">Lost</SelectItem>
            <SelectItem value="damaged">Damaged</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Status Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {dashboardData?.statusSummary.map((status) => (
          <Card key={status._id} className="relative">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                {getStatusText(status._id)}
              </CardTitle>
              <div className={`p-2 rounded-full ${getStatusColor(status._id)}`}>
                {getStatusIcon(status._id)}
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900">{status.count}</div>
              <div className="flex items-center justify-between text-sm text-gray-600">
                <span>{status.totalQuantity} items</span>
                <span className="font-medium">
                  {formatCurrency(status.totalCost)}
                </span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Transactions</CardTitle>
            <BarChart3 className="w-4 h-4 text-gray-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900">
              {dashboardData?.statistics.totalTransactions || 0}
            </div>
            <p className="text-xs text-gray-600">
              All time laundry transactions
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Cost</CardTitle>
            <IndianRupee className="w-4 h-4 text-gray-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900">
              {formatCurrency(dashboardData?.statistics.totalCost || 0)}
            </div>
            <p className="text-xs text-gray-600">
              Total laundry expenses
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Processing Time</CardTitle>
            <Timer className="w-4 h-4 text-gray-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900">
              {Math.round(dashboardData?.statistics.averageProcessingTime || 0)} days
            </div>
            <p className="text-xs text-gray-600">
              Average time from send to return
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Overdue Items Alert */}
      {dashboardData?.totalOverdue > 0 && (
        <Card className="border-red-200 bg-red-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-800">
              <AlertTriangle className="w-5 h-5" />
              Overdue Items ({dashboardData.totalOverdue})
            </CardTitle>
            <CardDescription className="text-red-600">
              Items that are past their expected return date
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {dashboardData.overdueItems.slice(0, 5).map((item) => (
                <div key={item._id} className="flex items-center justify-between p-3 bg-white rounded-lg border border-red-200">
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${getStatusColor(item.status)}`} />
                    <div>
                      <div className="font-medium text-gray-900">
                        {item.itemId.name} - Room {item.roomId.roomNumber}
                      </div>
                      <div className="text-sm text-gray-600">
                        Expected: {laundryService.formatDate(item.expectedReturnDate)}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium text-red-600">
                      {item.daysOverdue} days overdue
                    </div>
                    <div className="text-xs text-gray-600">
                      {item.quantity} items
                    </div>
                  </div>
                </div>
              ))}
              {dashboardData.overdueItems.length > 5 && (
                <div className="text-center text-sm text-red-600">
                  And {dashboardData.overdueItems.length - 5} more overdue items...
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Transactions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="w-5 h-5" />
            Recent Transactions
          </CardTitle>
          <CardDescription>
            Latest laundry transactions and their current status
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {dashboardData?.recentTransactions.map((transaction) => (
              <div key={transaction._id} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-4">
                  <div className={`p-2 rounded-full ${getStatusColor(transaction.status)}`}>
                    {getStatusIcon(transaction.status)}
                  </div>
                  <div>
                    <div className="font-medium text-gray-900">
                      {transaction.itemId.name} - Room {transaction.roomId.roomNumber}
                    </div>
                    <div className="text-sm text-gray-600">
                      {transaction.quantity} items • {formatCurrency(transaction.totalCost)}
                    </div>
                    <div className="text-xs text-gray-500">
                      Sent: {laundryService.formatDate(transaction.sentDate)} • 
                      Expected: {laundryService.formatDate(transaction.expectedReturnDate)}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <Badge className={`${getStatusColor(transaction.status)} text-white`}>
                    {getStatusText(transaction.status)}
                  </Badge>
                  {transaction.isOverdue && (
                    <div className="text-xs text-red-600 mt-1">
                      {transaction.daysOverdue} days overdue
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default LaundryDashboard;

