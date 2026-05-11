import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Clock, IndianRupee, Users, TrendingUp } from 'lucide-react';
import { posService, POSStats, POSOrder } from '../../services/posService';
import { useProperty } from '../../context/PropertyContext';

interface Order {
  orderId: string;
  orderNumber: string;
  customerName: string;
  totalAmount: number;
  status: string;
  outlet: string;
  orderTime: string;
}

interface POSDashboardProps {
  onNewOrderClick?: () => void;
}

const POSDashboard: React.FC<POSDashboardProps> = ({ onNewOrderClick }) => {
  const { selectedPropertyId } = useProperty();
  const [stats, setStats] = useState<POSStats>({
    todaysSales: 0,
    todaysOrders: 0,
    activeOrders: 0,
    averageOrderValue: 0
  });
  const [activeOrders, setActiveOrders] = useState<Order[]>([]);
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);

  useEffect(() => {
    fetchDashboardData();
  }, [selectedPropertyId]);

  const fetchDashboardData = async () => {
    try {
      // Fetch POS dashboard stats
      const statsData = await posService.getDashboardStats();
      setStats(statsData);

      // Fetch active orders
      const activeOrdersData = await posService.getOrders({ status: 'preparing,ready' });
      setActiveOrders(activeOrdersData.map((order: POSOrder) => ({
        orderId: order.orderId,
        orderNumber: order.orderNumber,
        customerName: order.customer?.guest?.name || order.customer?.walkIn?.name || 'Walk-in Customer',
        totalAmount: order.totalAmount,
        status: order.status,
        outlet: order.outlet?.name || 'Unknown Outlet',
        orderTime: order.orderTime.toString()
      })));

      // Fetch recent orders
      const recentOrdersData = await posService.getOrders({ limit: 10 });
      setRecentOrders(recentOrdersData.map((order: POSOrder) => ({
        orderId: order.orderId,
        orderNumber: order.orderNumber,
        customerName: order.customer?.guest?.name || order.customer?.walkIn?.name || 'Walk-in Customer',
        totalAmount: order.totalAmount,
        status: order.status,
        outlet: order.outlet?.name || 'Unknown Outlet',
        orderTime: order.orderTime.toString()
      })));
    } catch (error) {
      console.error('Failed to load POS dashboard data:', error);
    }
  };

  const getStatusColor = (status: string) => {
    const colors = {
      pending: 'bg-yellow-100 text-yellow-800',
      confirmed: 'bg-blue-100 text-blue-800',
      preparing: 'bg-orange-100 text-orange-800',
      ready: 'bg-green-100 text-green-800',
      served: 'bg-gray-100 text-gray-800',
      completed: 'bg-green-100 text-green-800',
      cancelled: 'bg-red-100 text-red-800'
    };
    return colors[status as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR'
    }).format(amount);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">POS Dashboard</h1>
        <Button onClick={onNewOrderClick}>
          <Plus className="w-4 h-4 mr-2" />
          New Order
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardContent className="flex items-center p-6">
            <IndianRupee className="w-8 h-8 text-green-600 mr-4" />
            <div>
              <p className="text-sm font-medium text-gray-600">Today's Sales</p>
              <p className="text-2xl font-bold">{formatCurrency(stats.todaysSales)}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center p-6">
            <Users className="w-8 h-8 text-blue-600 mr-4" />
            <div>
              <p className="text-sm font-medium text-gray-600">Today's Orders</p>
              <p className="text-2xl font-bold">{stats.todaysOrders}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center p-6">
            <Clock className="w-8 h-8 text-orange-600 mr-4" />
            <div>
              <p className="text-sm font-medium text-gray-600">Active Orders</p>
              <p className="text-2xl font-bold">{stats.activeOrders}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center p-6">
            <TrendingUp className="w-8 h-8 text-purple-600 mr-4" />
            <div>
              <p className="text-sm font-medium text-gray-600">Avg Order Value</p>
              <p className="text-2xl font-bold">{formatCurrency(stats.averageOrderValue)}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Orders Tabs */}
      <Tabs defaultValue="active" className="w-full">
        <TabsList>
          <TabsTrigger value="active">Active Orders ({activeOrders.length})</TabsTrigger>
          <TabsTrigger value="recent">Recent Orders</TabsTrigger>
        </TabsList>

        <TabsContent value="active">
          <Card>
            <CardHeader>
              <CardTitle>Active Orders</CardTitle>
            </CardHeader>
            <CardContent>
              {activeOrders.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No active orders</p>
              ) : (
                <div className="space-y-4">
                  {activeOrders.map((order) => (
                    <div key={order.orderId} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex-1">
                        <div className="flex items-center space-x-4">
                          <div>
                            <p className="font-semibold">#{order.orderNumber}</p>
                            <p className="text-sm text-gray-600">{order.customerName}</p>
                          </div>
                          <Badge className={getStatusColor(order.status)}>
                            {order.status}
                          </Badge>
                        </div>
                        <p className="text-sm text-gray-500 mt-1">{order.outlet}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">{formatCurrency(order.totalAmount)}</p>
                        <p className="text-sm text-gray-500">
                          {new Date(order.orderTime).toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="recent">
          <Card>
            <CardHeader>
              <CardTitle>Recent Orders</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {recentOrders.map((order) => (
                  <div key={order.orderId} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex-1">
                      <div className="flex items-center space-x-4">
                        <div>
                          <p className="font-semibold">#{order.orderNumber}</p>
                          <p className="text-sm text-gray-600">{order.customerName}</p>
                        </div>
                        <Badge className={getStatusColor(order.status)}>
                          {order.status}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-500 mt-1">{order.outlet}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">{formatCurrency(order.totalAmount)}</p>
                      <p className="text-sm text-gray-500">
                        {new Date(order.orderTime).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default POSDashboard;