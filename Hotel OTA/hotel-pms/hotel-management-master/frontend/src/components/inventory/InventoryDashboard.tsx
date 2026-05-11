import React, { useState, useEffect } from 'react';
import { 
  Package, 
  AlertTriangle, 
  TrendingUp, 
  ClipboardCheck,
  Search,
  Filter,
  Plus,
  RefreshCw
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LoadingSpinner } from '../LoadingSpinner';
import { roomInventoryService, InventoryItem, RoomInventory } from '../../services/roomInventoryService';
import { formatCurrency } from '../../utils/formatters';

interface InventoryStats {
  totalItems: number;
  lowStockItems: number;
  roomsNeedingInspection: number;
  totalValue: number;
  recentTransactions: number;
  criticalIssues: number;
}

export function InventoryDashboard() {
  const [stats, setStats] = useState<InventoryStats>({
    totalItems: 0,
    lowStockItems: 0,
    roomsNeedingInspection: 0,
    totalValue: 0,
    recentTransactions: 0,
    criticalIssues: 0
  });
  
  const [lowStockItems, setLowStockItems] = useState<InventoryItem[]>([]);
  const [roomsNeedingInspection, setRoomsNeedingInspection] = useState<RoomInventory[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState('7d');

  useEffect(() => {
    fetchDashboardData();
  }, [selectedPeriod]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      
      // Calculate date range
      const endDate = new Date();
      const startDate = new Date();
      if (selectedPeriod === '7d') {
        startDate.setDate(startDate.getDate() - 7);
      } else if (selectedPeriod === '30d') {
        startDate.setDate(startDate.getDate() - 30);
      } else if (selectedPeriod === '90d') {
        startDate.setDate(startDate.getDate() - 90);
      }

      const [analyticsResponse, itemsResponse] = await Promise.all([
        roomInventoryService.getInventoryAnalytics({
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString()
        }),
        roomInventoryService.getInventoryItems({ active: true })
      ]);

      const { lowStockItems, roomsNeedingInspection, costAnalytics } = analyticsResponse.data;
      const { items } = itemsResponse.data;

      // Calculate stats
      const totalValue = items.reduce((sum, item) => sum + (item.unitPrice * item.currentStock), 0);
      const recentTransactions = costAnalytics?.reduce((sum: number, category: Record<string, unknown>) => 
        sum + category.totalTransactionCount, 0) || 0;

      setStats({
        totalItems: items.length,
        lowStockItems: lowStockItems.length,
        roomsNeedingInspection: roomsNeedingInspection.length,
        totalValue,
        recentTransactions,
        criticalIssues: roomsNeedingInspection.filter((room: RoomInventory) => 
          room.status === 'damaged' || room.maintenanceRequired
        ).length
      });

      setLowStockItems(lowStockItems);
      setRoomsNeedingInspection(roomsNeedingInspection);
      
    } catch {
      // Error handled silently
    } finally {
      setLoading(false);
    }
  };

  const getStockStatusColor = (item: InventoryItem) => {
    if (item.currentStock === 0) return 'bg-red-100 text-red-800 border-red-200';
    if (item.isLowStock) return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    return 'bg-green-100 text-green-800 border-green-200';
  };

  const getStockStatusText = (item: InventoryItem) => {
    if (item.currentStock === 0) return 'Out of Stock';
    if (item.isLowStock) return 'Low Stock';
    return 'In Stock';
  };

  const getRoomStatusColor = (status: string) => {
    switch (status) {
      case 'clean': return 'bg-green-100 text-green-800';
      case 'dirty': return 'bg-yellow-100 text-yellow-800';
      case 'maintenance': return 'bg-orange-100 text-orange-800';
      case 'damaged': return 'bg-red-100 text-red-800';
      case 'inspection_required': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Inventory Dashboard</h1>
          <p className="text-gray-600 mt-1">Monitor and manage room inventory across your hotel</p>
        </div>
        <div className="flex items-center space-x-3">
          <select
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
          </select>
          <Button onClick={fetchDashboardData} variant="secondary" size="sm">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={() => window.location.href = '/admin/inventory/items'}>
            <Plus className="w-4 h-4 mr-2" />
            Add Item
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <Card className="p-4">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Package className="w-5 h-5 text-blue-600" />
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-600">Total Items</p>
              <p className="text-lg font-semibold text-gray-900">{stats.totalItems}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center">
            <div className="p-2 bg-red-100 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-red-600" />
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-600">Low Stock</p>
              <p className="text-lg font-semibold text-gray-900">{stats.lowStockItems}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <ClipboardCheck className="w-5 h-5 text-yellow-600" />
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-600">Need Inspection</p>
              <p className="text-lg font-semibold text-gray-900">{stats.roomsNeedingInspection}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 rounded-lg">
              <TrendingUp className="w-5 h-5 text-green-600" />
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-600">Total Value</p>
              <p className="text-lg font-semibold text-gray-900">{formatCurrency(stats.totalValue)}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center">
            <div className="p-2 bg-purple-100 rounded-lg">
              <RefreshCw className="w-5 h-5 text-purple-600" />
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-600">Transactions</p>
              <p className="text-lg font-semibold text-gray-900">{stats.recentTransactions}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center">
            <div className="p-2 bg-orange-100 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-orange-600" />
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-600">Critical Issues</p>
              <p className="text-lg font-semibold text-gray-900">{stats.criticalIssues}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Low Stock Items */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Low Stock Alert</h2>
            <Badge variant="secondary" className="bg-red-100 text-red-800">
              {stats.lowStockItems} items
            </Badge>
          </div>

          {lowStockItems.length === 0 ? (
            <div className="text-center py-8">
              <Package className="mx-auto h-8 w-8 text-green-500 mb-3" />
              <p className="text-gray-500">All items are well stocked!</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-80 overflow-y-auto">
              {lowStockItems.slice(0, 10).map((item) => (
                <div key={item._id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3">
                      <div className="flex-shrink-0">
                        {item.imageUrl ? (
                          <img 
                            src={item.imageUrl} 
                            alt={item.name}
                            className="w-10 h-10 rounded-lg object-cover"
                          />
                        ) : (
                          <div className="w-10 h-10 bg-gray-300 rounded-lg flex items-center justify-center">
                            <Package className="w-5 h-5 text-gray-600" />
                          </div>
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{item.name}</p>
                        <p className="text-sm text-gray-600">{item.category}</p>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-gray-900">
                      {item.currentStock} / {item.stockThreshold}
                    </p>
                    <Badge 
                      variant="secondary" 
                      className={getStockStatusColor(item)}
                    >
                      {getStockStatusText(item)}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}

          {lowStockItems.length > 10 && (
            <div className="mt-4 text-center">
              <Button 
                variant="secondary" 
                size="sm"
                onClick={() => window.location.href = '/admin/inventory/items?filter=low-stock'}
              >
                View All Low Stock Items
              </Button>
            </div>
          )}
        </Card>

        {/* Rooms Needing Inspection */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Inspection Required</h2>
            <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
              {stats.roomsNeedingInspection} rooms
            </Badge>
          </div>

          {roomsNeedingInspection.length === 0 ? (
            <div className="text-center py-8">
              <ClipboardCheck className="mx-auto h-8 w-8 text-green-500 mb-3" />
              <p className="text-gray-500">All rooms are up to date!</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-80 overflow-y-auto">
              {roomsNeedingInspection.slice(0, 10).map((room) => (
                <div key={room._id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <div className="flex items-center space-x-2">
                      <p className="font-medium text-gray-900">
                        Room {room.roomId.roomNumber}
                      </p>
                      <Badge variant="secondary" className="text-xs">
                        {room.roomId.type}
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-600">
                      {room.daysSinceLastInspection ? 
                        `${room.daysSinceLastInspection} days since last inspection` : 
                        'Never inspected'
                      }
                    </p>
                    {room.maintenanceRequired && (
                      <p className="text-xs text-red-600 mt-1">
                        Maintenance required: {room.itemsNeedingReplacement.length} items
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <Badge 
                      variant="secondary" 
                      className={getRoomStatusColor(room.status)}
                    >
                      {room.status.replace('_', ' ')}
                    </Badge>
                    <div className="mt-1">
                      <span className="text-xs text-gray-500">
                        Score: {room.conditionScore}/100
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {roomsNeedingInspection.length > 10 && (
            <div className="mt-4 text-center">
              <Button 
                variant="secondary" 
                size="sm"
                onClick={() => window.location.href = '/admin/housekeeping'}
              >
                View All Rooms
              </Button>
            </div>
          )}
        </Card>
      </div>

      {/* Quick Actions */}
      <Card className="p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Button
            onClick={() => window.location.href = '/admin/inventory/items'}
            className="flex items-center justify-center p-4 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors"
          >
            <Package className="w-5 h-5 text-blue-600 mr-2" />
            <span className="font-medium text-blue-700">Manage Items</span>
          </Button>

          <Button
            onClick={() => window.location.href = '/admin/inventory/templates'}
            className="flex items-center justify-center p-4 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 transition-colors"
          >
            <ClipboardCheck className="w-5 h-5 text-green-600 mr-2" />
            <span className="font-medium text-green-700">Room Templates</span>
          </Button>

          <Button
            onClick={() => window.location.href = '/admin/housekeeping'}
            className="flex items-center justify-center p-4 bg-yellow-50 border border-yellow-200 rounded-lg hover:bg-yellow-100 transition-colors"
          >
            <Search className="w-5 h-5 text-yellow-600 mr-2" />
            <span className="font-medium text-yellow-700">Room Inspections</span>
          </Button>

          <Button
            onClick={() => window.location.href = '/admin/inventory/transactions'}
            className="flex items-center justify-center p-4 bg-purple-50 border border-purple-200 rounded-lg hover:bg-purple-100 transition-colors"
          >
            <TrendingUp className="w-5 h-5 text-purple-600 mr-2" />
            <span className="font-medium text-purple-700">View Transactions</span>
          </Button>
        </div>
      </Card>
    </div>
  );
}