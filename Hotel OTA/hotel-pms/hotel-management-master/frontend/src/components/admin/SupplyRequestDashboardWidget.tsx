import React, { useState, useEffect } from 'react';
import {
  Package,
  Clock,
  CheckSquare,
  XCircle,
  AlertTriangle,
  TrendingUp,
  RefreshCw,
  ArrowRight,
  IndianRupee,
  Users,
  Calendar
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LoadingSpinner } from '../LoadingSpinner';
import { adminSupplyRequestsService } from '../../services/adminSupplyRequestsService';
import { formatCurrency } from '../../utils/formatters';

interface SupplyRequestWidgetProps {
  hotelId: string;
  onNavigate?: (path: string) => void;
}

interface SupplyRequestSummary {
  totalRequests: number;
  pendingRequests: number;
  approvedRequests: number;
  rejectedRequests: number;
  urgentRequests: number;
  overdueRequests: number;
  totalValue: number;
  pendingValue: number;
  averageProcessingTime: number;
  topDepartments: Array<{
    department: string;
    count: number;
    value: number;
  }>;
  recentRequests: Array<{
    _id: string;
    requestNumber: string;
    title: string;
    department: string;
    priority: string;
    totalEstimatedCost: number;
    status: string;
    requestedBy: {
      name: string;
    };
    createdAt: string;
  }>;
}

export function SupplyRequestDashboardWidget({ hotelId, onNavigate }: SupplyRequestWidgetProps) {
  const [summary, setSummary] = useState<SupplyRequestSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSummary = React.useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch supply request stats and recent requests
      const [statsResponse, requestsResponse] = await Promise.all([
        adminSupplyRequestsService.getStats(),
        adminSupplyRequestsService.getRequests({ limit: 5, sortBy: 'createdAt', sortOrder: 'desc' })
      ]);

      const stats = statsResponse.data;
      const requests = requestsResponse.data.requests || [];

      // Calculate additional metrics
      const totalValue = requests.reduce((sum, req) => sum + req.totalEstimatedCost, 0);
      const pendingValue = requests
        .filter(req => req.status === 'pending')
        .reduce((sum, req) => sum + req.totalEstimatedCost, 0);

      // Group by department
      const departmentCounts = requests.reduce((acc, req) => {
        if (!acc[req.department]) {
          acc[req.department] = { count: 0, value: 0 };
        }
        acc[req.department].count++;
        acc[req.department].value += req.totalEstimatedCost;
        return acc;
      }, {} as Record<string, { count: number; value: number }>);

      const topDepartments = Object.entries(departmentCounts)
        .map(([department, data]) => ({
          department,
          count: data.count,
          value: data.value
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 3);

      const summaryData: SupplyRequestSummary = {
        totalRequests: stats.total || 0,
        pendingRequests: stats.pending || 0,
        approvedRequests: stats.approved || 0,
        rejectedRequests: stats.rejected || 0,
        urgentRequests: stats.urgent || 0,
        overdueRequests: stats.overdue || 0,
        totalValue: stats.totalValue || totalValue,
        pendingValue,
        averageProcessingTime: 2.3, // Mock data - would come from backend
        topDepartments,
        recentRequests: requests.slice(0, 5)
      };

      setSummary(summaryData);
    } catch (err) {
      setError('Failed to load supply request data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSummary();
  }, [hotelId, fetchSummary]);

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'emergency': return 'bg-red-600 text-white';
      case 'urgent': return 'bg-red-500 text-white';
      case 'high': return 'bg-orange-500 text-white';
      case 'medium': return 'bg-yellow-500 text-white';
      case 'low': return 'bg-gray-500 text-white';
      default: return 'bg-gray-400 text-white';
    }
  };

  const getDepartmentColor = (department: string) => {
    const colors: Record<string, string> = {
      housekeeping: 'bg-green-100 text-green-800',
      maintenance: 'bg-orange-100 text-orange-800',
      front_desk: 'bg-blue-100 text-blue-800',
      food_beverage: 'bg-purple-100 text-purple-800',
      spa: 'bg-pink-100 text-pink-800',
    };
    return colors[department] || 'bg-gray-100 text-gray-800';
  };

  if (loading) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-center h-48">
          <LoadingSpinner />
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="p-6">
        <div className="text-center">
          <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <p className="text-red-600">{error}</p>
          <Button onClick={fetchSummary} variant="secondary" size="sm" className="mt-2">
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </div>
      </Card>
    );
  }

  if (!summary) return null;

  return (
    <Card className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-orange-500 to-red-600 rounded-xl">
            <Package className="h-6 w-6 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Supply Requests</h3>
            <p className="text-sm text-gray-600">Request management overview</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={fetchSummary} variant="secondary" size="sm">
            <RefreshCw className="h-4 w-4" />
          </Button>
          {onNavigate && (
            <Button onClick={() => onNavigate('/admin/supply-requests')} size="sm">
              <ArrowRight className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="text-center p-3 bg-blue-50 rounded-lg">
          <div className="flex items-center justify-center mb-2">
            <Package className="h-5 w-5 text-blue-600" />
          </div>
          <div className="text-2xl font-bold text-blue-900">{summary.totalRequests}</div>
          <div className="text-xs text-blue-600">Total Requests</div>
        </div>

        <div className="text-center p-3 bg-yellow-50 rounded-lg">
          <div className="flex items-center justify-center mb-2">
            <Clock className="h-5 w-5 text-yellow-600" />
          </div>
          <div className="text-2xl font-bold text-yellow-900">{summary.pendingRequests}</div>
          <div className="text-xs text-yellow-600">Pending Approval</div>
        </div>

        <div className="text-center p-3 bg-red-50 rounded-lg">
          <div className="flex items-center justify-center mb-2">
            <AlertTriangle className="h-5 w-5 text-red-600" />
          </div>
          <div className="text-2xl font-bold text-red-900">{summary.overdueRequests}</div>
          <div className="text-xs text-red-600">Overdue</div>
        </div>

        <div className="text-center p-3 bg-green-50 rounded-lg">
          <div className="flex items-center justify-center mb-2">
            <IndianRupee className="h-5 w-5 text-green-600" />
          </div>
          <div className="text-lg font-bold text-green-900">{formatCurrency(summary.totalValue)}</div>
          <div className="text-xs text-green-600">Total Value</div>
        </div>
      </div>

      {/* Department Breakdown */}
      {summary.topDepartments.length > 0 && (
        <div className="mb-6">
          <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center">
            <Users className="h-4 w-4 mr-2" />
            Top Departments
          </h4>
          <div className="space-y-2">
            {summary.topDepartments.map((dept, index) => (
              <div key={dept.department} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-600">#{index + 1}</span>
                  <Badge className={getDepartmentColor(dept.department)}>
                    {(dept.department || '').replace('_', ' ')}
                  </Badge>
                </div>
                <div className="text-right">
                  <div className="text-sm font-medium">{dept.count} {dept.count === 1 ? 'request' : 'requests'}</div>
                  <div className="text-xs text-gray-500">{formatCurrency(dept.value)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Requests */}
      {summary.recentRequests.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center">
            <Calendar className="h-4 w-4 mr-2" />
            Recent Requests
          </h4>
          <div className="space-y-2">
            {summary.recentRequests.map((request) => (
              <div key={request._id} className="flex items-center justify-between p-3 bg-gray-50 rounded border">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium text-gray-900 truncate">
                      {request.requestNumber}
                    </span>
                    <Badge className={`text-xs ${getPriorityColor(request.priority)}`}>
                      {request.priority}
                    </Badge>
                  </div>
                  <div className="text-sm text-gray-600 truncate">{request.title}</div>
                  <div className="text-xs text-gray-500">
                    {request.requestedBy?.name || 'Unknown'} • {(request.department || '').replace('_', ' ')}
                  </div>
                </div>
                <div className="text-right ml-3">
                  <div className="text-sm font-medium">{formatCurrency(request.totalEstimatedCost)}</div>
                  <Badge variant={request.status === 'pending' ? 'destructive' : 'secondary'} className="text-xs">
                    {request.status}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="mt-6 pt-4 border-t border-gray-200">
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-600">
            {summary.pendingRequests > 0 && (
              <span className="text-yellow-600 font-medium">
                {summary.pendingRequests} {summary.pendingRequests === 1 ? 'request needs' : 'requests need'} approval
              </span>
            )}
            {summary.overdueRequests > 0 && (
              <span className="text-red-600 font-medium ml-3">
                {summary.overdueRequests} overdue
              </span>
            )}
          </div>
          {onNavigate && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => onNavigate('/admin/supply-requests')}
            >
              Manage All
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}