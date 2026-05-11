import React, { useState, useEffect } from 'react';
import {
  Package,
  AlertTriangle,
  ClipboardCheck,
  TrendingUp,
  RefreshCw,
  ArrowRight,
  IndianRupee
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LoadingSpinner } from '../LoadingSpinner';
import { roomInventoryService } from '../../services/roomInventoryService';
import { formatCurrency } from '../../utils/formatters';

interface InventoryWidgetProps {
  hotelId: string;
  onNavigate?: (path: string) => void;
}

interface InventorySummary {
  totalItems: number;
  lowStockItems: number;
  roomsNeedingInspection: number;
  totalValue: number;
  recentTransactions: number;
  criticalIssues: number;
  topLowStockItems: Array<{
    name: string;
    currentStock: number;
    stockThreshold: number;
    category: string;
  }>;
  urgentRooms: Array<{
    roomNumber: string;
    daysSinceLastInspection: number;
    conditionScore: number;
    status: string;
  }>;
  recentTransactionValue: number;
}

export function InventoryDashboardWidget({ hotelId, onNavigate }: InventoryWidgetProps) {
  const [summary, setSummary] = useState<InventorySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchInventorySummary = React.useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [analyticsResponse, itemsResponse] = await Promise.all([
        roomInventoryService.getInventoryAnalytics({
          startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
          endDate: new Date().toISOString()
        }),
        roomInventoryService.getInventoryItems({ active: true, limit: 100 })
      ]);

      const { lowStockItems, roomsNeedingInspection, costAnalytics } = analyticsResponse.data;
      const { items } = itemsResponse.data;

      // Calculate total value
      const totalValue = items.reduce((sum, item) => sum + (item.unitPrice * item.currentStock), 0);
      
      // Recent transactions value
      const recentTransactionValue = costAnalytics?.reduce((sum: number, category: Record<string, unknown>) => 
        sum + category.totalCost, 0) || 0;

      // Critical issues (damaged rooms or items needing immediate attention)
      const criticalIssues = roomsNeedingInspection.filter((room: Record<string, unknown>) => 
        room.status === 'damaged' || room.conditionScore < 40 || room.maintenanceRequired
      ).length;

      setSummary({
        totalItems: items.length,
        lowStockItems: lowStockItems.length,
        roomsNeedingInspection: roomsNeedingInspection.length,
        totalValue,
        recentTransactions: costAnalytics?.reduce((sum: number, category: Record<string, unknown>) => 
          sum + category.totalTransactionCount, 0) || 0,
        criticalIssues,
        topLowStockItems: lowStockItems.slice(0, 5).map((item: Record<string, unknown>) => ({
          name: item.name,
          currentStock: item.currentStock,
          stockThreshold: item.stockThreshold,
          category: item.category
        })),
        urgentRooms: roomsNeedingInspection.slice(0, 5).map((room: Record<string, unknown>) => ({
          roomNumber: room.roomId.roomNumber,
          daysSinceLastInspection: room.daysSinceLastInspection || 0,
          conditionScore: room.conditionScore,
          status: room.status
        })),
        recentTransactionValue
      });

    } catch (error) {
      setError('Failed to load inventory data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (hotelId) {
      fetchInventorySummary();
    }
  }, [hotelId, fetchInventorySummary]);

  const handleNavigate = (path: string) => {
    if (onNavigate) {
      onNavigate(path);
    } else {
      window.location.href = path;
    }
  };

  if (loading) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-center h-40">
          <LoadingSpinner />
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="p-6">
        <div className="text-center py-8">
          <AlertTriangle className="mx-auto h-8 w-8 text-red-500 mb-3" />
          <p className="text-red-600">{error}</p>
          <Button
            onClick={fetchInventorySummary}
            size="sm"
            variant="secondary"
            className="mt-2"
          >
            <RefreshCw className="w-4 h-4 mr-1" />
            Retry
          </Button>
        </div>
      </Card>
    );
  }

  if (!summary) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Inventory Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Package className="w-5 h-5 text-blue-600" />
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-600">Total Items</p>
                <p className="text-lg font-semibold text-gray-900">{summary.totalItems}</p>
              </div>
            </div>
            <Button
              onClick={() => handleNavigate('/admin/inventory')}
              size="sm"
              variant="secondary"
            >
              <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="p-2 bg-red-100 rounded-lg">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-600">Low Stock</p>
                <p className="text-lg font-semibold text-gray-900">{summary.lowStockItems}</p>
              </div>
            </div>
            {summary.lowStockItems > 0 && (
              <Badge variant="secondary" className="bg-red-100 text-red-800">
                Urgent
              </Badge>
            )}
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <ClipboardCheck className="w-5 h-5 text-yellow-600" />
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-600">Need Inspection</p>
                <p className="text-lg font-semibold text-gray-900">{summary.roomsNeedingInspection}</p>
              </div>
            </div>
            <Button
              onClick={() => handleNavigate('/admin/housekeeping')}
              size="sm"
              variant="secondary"
            >
              <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 rounded-lg">
                <TrendingUp className="w-5 h-5 text-green-600" />
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-600">Total Value</p>
                <p className="text-lg font-semibold text-gray-900">{formatCurrency(summary.totalValue)}</p>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Critical Alerts */}
      {summary.criticalIssues > 0 && (
        <Card className="p-4 bg-red-50 border-red-200">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center">
              <AlertTriangle className="w-5 h-5 text-red-600 mr-2" />
              <h3 className="font-semibold text-red-900">Critical Issues Detected</h3>
            </div>
            <Badge variant="secondary" className="bg-red-200 text-red-800">
              {summary.criticalIssues} issues
            </Badge>
          </div>
          <p className="text-red-700 text-sm mb-3">
            {summary.criticalIssues} rooms require immediate attention due to damage or poor condition scores.
          </p>
          <Button
            onClick={() => handleNavigate('/admin/housekeeping')}
            size="sm"
            className="bg-red-600 hover:bg-red-700"
          >
            View Critical Issues
          </Button>
        </Card>
      )}

      {/* Inventory Details */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Low Stock Items */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Low Stock Alert</h3>
            <Badge variant="secondary" className="bg-red-100 text-red-800">
              {summary.lowStockItems} items
            </Badge>
          </div>

          {summary.topLowStockItems.length === 0 ? (
            <div className="text-center py-6">
              <Package className="mx-auto h-8 w-8 text-green-500 mb-3" />
              <p className="text-gray-500">All items are well stocked!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {summary.topLowStockItems.map((item, index) => (
                <div key={`summary-topLowStockItems-${index}-${item.name}`} className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900">{item.name}</p>
                    <p className="text-sm text-gray-600 capitalize">{item.category}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-red-700">
                      {item.currentStock} / {item.stockThreshold}
                    </p>
                    <p className="text-xs text-red-600">Low Stock</p>
                  </div>
                </div>
              ))}
              
              {summary.lowStockItems > 5 && (
                <Button
                  onClick={() => handleNavigate('/admin/inventory?lowStock=true')}
                  variant="secondary"
                  size="sm"
                  className="w-full mt-3"
                >
                  View All {summary.lowStockItems} Low Stock Items
                </Button>
              )}
            </div>
          )}
        </Card>

        {/* Rooms Needing Attention */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Urgent Rooms</h3>
            <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
              {summary.roomsNeedingInspection} rooms
            </Badge>
          </div>

          {summary.urgentRooms.length === 0 ? (
            <div className="text-center py-6">
              <ClipboardCheck className="mx-auto h-8 w-8 text-green-500 mb-3" />
              <p className="text-gray-500">All rooms are up to date!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {summary.urgentRooms.map((room, index) => (
                <div key={`summary-urgentRooms-${index}-${room.status}`} className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900">Room {room.roomNumber}</p>
                    <p className="text-sm text-gray-600">
                      {room.daysSinceLastInspection} days since inspection
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-yellow-700">
                      Score: {room.conditionScore}/100
                    </p>
                    <Badge variant="secondary" className={
                      room.status === 'damaged' ? 'bg-red-100 text-red-800' :
                      room.conditionScore < 40 ? 'bg-red-100 text-red-800' :
                      'bg-yellow-100 text-yellow-800'
                    }>
                      {room.status}
                    </Badge>
                  </div>
                </div>
              ))}
              
              {summary.roomsNeedingInspection > 5 && (
                <Button
                  onClick={() => handleNavigate('/admin/housekeeping')}
                  variant="secondary"
                  size="sm"
                  className="w-full mt-3"
                >
                  View All {summary.roomsNeedingInspection} Rooms
                </Button>
              )}
            </div>
          )}
        </Card>
      </div>

      {/* Recent Activity Summary */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Inventory Activity (Last 7 Days)</h3>
          <Button
            onClick={() => handleNavigate('/admin/inventory')}
            size="sm"
            variant="secondary"
          >
            View All Transactions
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center justify-center mb-2">
              <RefreshCw className="w-5 h-5 text-blue-600" />
            </div>
            <p className="text-2xl font-bold text-gray-900">{summary.recentTransactions}</p>
            <p className="text-sm text-gray-600">Transactions</p>
          </div>
          
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center justify-center mb-2">
              <IndianRupee className="w-5 h-5 text-green-600" />
            </div>
            <p className="text-2xl font-bold text-gray-900">{formatCurrency(summary.recentTransactionValue)}</p>
            <p className="text-sm text-gray-600">Transaction Value</p>
          </div>
          
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center justify-center mb-2">
              <AlertTriangle className="w-5 h-5 text-orange-600" />
            </div>
            <p className="text-2xl font-bold text-gray-900">{summary.criticalIssues}</p>
            <p className="text-sm text-gray-600">Critical Issues</p>
          </div>
        </div>
      </Card>

      {/* Quick Actions */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <Button
            onClick={() => handleNavigate('/admin/inventory')}
            className="flex items-center justify-center p-3 bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200"
          >
            <Package className="w-4 h-4 mr-2" />
            <span className="text-sm font-medium">Inventory Dashboard</span>
          </Button>
          
          <Button
            onClick={() => handleNavigate('/admin/inventory')}
            className="flex items-center justify-center p-3 bg-green-50 text-green-700 hover:bg-green-100 border border-green-200"
          >
            <TrendingUp className="w-4 h-4 mr-2" />
            <span className="text-sm font-medium">Manage Items</span>
          </Button>
          
          <Button
            onClick={() => handleNavigate('/admin/housekeeping')}
            className="flex items-center justify-center p-3 bg-yellow-50 text-yellow-700 hover:bg-yellow-100 border border-yellow-200"
          >
            <ClipboardCheck className="w-4 h-4 mr-2" />
            <span className="text-sm font-medium">Room Inspections</span>
          </Button>
          
          <Button
            onClick={() => handleNavigate('/admin/inventory')}
            className="flex items-center justify-center p-3 bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            <span className="text-sm font-medium">View Transactions</span>
          </Button>
        </div>
      </Card>
    </div>
  );
}