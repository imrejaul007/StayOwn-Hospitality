import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  Users,
  ClipboardCheck,
  AlertTriangle,
  Wrench,
  Calendar,
  CheckCircle,
  Package,
  TrendingUp,
  RefreshCw,
  Receipt,
  CheckSquare
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { 
  staffDashboardService,
  StaffTodayData, 
  RoomStatusData, 
  StaffInventoryData 
} from '../../services/staffDashboardService';
import { checkoutInventoryService, CheckoutInventory } from '../../services/checkoutInventoryService';
import { dailyRoutineCheckService, AssignedRoomData } from '../../services/dailyRoutineCheckService';
import TodayArrivalsWidget from '../../components/staff/TodayArrivalsWidget';
import { withErrorBoundary } from '../../components/ErrorBoundary';

interface StaffDashboardData {
  today: StaffTodayData & { pendingOrders?: number };
  roomStatus: RoomStatusData;
  inventory: StaffInventoryData;
  checkoutInventories: CheckoutInventory[];
  assignedRooms: AssignedRoomData[];
}

type TabId = 'overview' | 'rooms' | 'inventory' | 'checkout' | 'assignments';

function StaffDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState<StaffDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const isFirstLoad = useRef(true);
  // Guard against state updates after unmount (e.g. navigation during a long fetch)
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const fetchDashboardData = useCallback(async () => {
    try {
      // On first load show full spinner; on refresh show subtle indicator
      if (isFirstLoad.current) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }

      // Fetch real data from the backend API using the service
      const [todayRes, roomsRes, inventoryRes, checkoutRes, assignmentsRes] = await Promise.allSettled([
        staffDashboardService.getTodayOverview(),
        staffDashboardService.getRoomStatus(),
        staffDashboardService.getInventorySummary(),
        checkoutInventoryService.getCheckoutInventories({ status: 'completed', limit: 10 }),
        dailyRoutineCheckService.getMyAssignedRooms()
      ]);

      if (!mountedRef.current) return;

      // Use functional setState to get the latest data without adding it to deps
      setData(prev => ({
        today: todayRes.status === 'fulfilled'
          ? todayRes.value.data.today
          : (prev?.today ?? { checkIns: 0, checkOuts: 0, pendingHousekeeping: 0, pendingMaintenance: 0, pendingGuestServices: 0, pendingOrders: 0, occupancyRate: 0 }),
        roomStatus: roomsRes.status === 'fulfilled'
          ? roomsRes.value.data
          : (prev?.roomStatus ?? { summary: { occupied: 0, vacant_clean: 0, vacant_dirty: 0, maintenance: 0, out_of_order: 0 }, needsAttention: [], total: 0 }),
        inventory: inventoryRes.status === 'fulfilled'
          ? inventoryRes.value.data
          : (prev?.inventory ?? { lowStockAlert: { count: 0, items: [] }, inspectionsDue: { count: 0, rooms: [] } }),
        checkoutInventories: checkoutRes.status === 'fulfilled'
          ? (checkoutRes.value.data.checkoutInventories || [])
          : (prev?.checkoutInventories ?? []),
        assignedRooms: assignmentsRes.status === 'fulfilled'
          ? (assignmentsRes.value.data.rooms || [])
          : (prev?.assignedRooms ?? [])
      }));

      if (!mountedRef.current) return;
      const hasFailures = [todayRes, roomsRes, inventoryRes, checkoutRes, assignmentsRes]
        .some(result => result.status === 'rejected');
      setError(hasFailures ? 'Some dashboard sections could not be refreshed. Showing the latest available data.' : null);
    } catch (_err) {
      if (!mountedRef.current) return;
      // Keep previous data if available -- don't reset to zeros
      setData(prev => {
        if (prev) return prev;
        // Only use empty fallback on first load
        return {
          today: { checkIns: 0, checkOuts: 0, pendingHousekeeping: 0, pendingMaintenance: 0, pendingGuestServices: 0, pendingOrders: 0, occupancyRate: 0 },
          roomStatus: { summary: { occupied: 0, vacant_clean: 0, vacant_dirty: 0, maintenance: 0, out_of_order: 0 }, needsAttention: [], total: 0 },
          inventory: { lowStockAlert: { count: 0, items: [] }, inspectionsDue: { count: 0, rooms: [] } },
          checkoutInventories: [],
          assignedRooms: []
        };
      });
      setError('Unable to load dashboard data. Will retry automatically.');
    } finally {
      if (mountedRef.current) {
        setLoading(false);
        setRefreshing(false);
        isFirstLoad.current = false;
      }
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
    // Auto-refresh every 30 seconds
    const interval = setInterval(() => {
      fetchDashboardData();
    }, 30000);
    return () => clearInterval(interval);
  }, [fetchDashboardData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <AlertTriangle className="mx-auto h-8 w-8 text-red-500 mb-3" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Failed to load dashboard</h3>
          <Button onClick={fetchDashboardData}>Try Again</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      {/* Error Banner */}
      {error && (
        <div className="mb-4 bg-red-50 border-l-4 border-red-400 p-4 rounded-lg flex items-center justify-between">
          <p className="text-sm text-red-700">{error}</p>
          <button onClick={() => { setError(null); fetchDashboardData(); }} className="text-sm text-red-600 font-medium hover:text-red-800">Retry</button>
        </div>
      )}

      {/* Header */}
      <div className="mb-6 sm:mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">
              Welcome, {user?.name}!
            </h1>
            <p className="text-gray-600 text-sm sm:text-base">Staff Dashboard - Today's Operations</p>
          </div>
          <Button onClick={fetchDashboardData} disabled={loading || refreshing} variant="outline" size="sm">
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Refreshing...' : 'Refresh All Data'}
          </Button>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="mb-6 border-b">
        <nav role="tablist" aria-label="Dashboard sections" className="-mb-px flex space-x-4 sm:space-x-8 overflow-x-auto">
          {[
            { id: 'overview', label: 'Overview', icon: TrendingUp },
            { id: 'assignments', label: 'My Assignments', icon: ClipboardCheck },
            { id: 'rooms', label: 'Room Status', icon: Users },
            { id: 'inventory', label: 'Inventory', icon: Package },
            { id: 'checkout', label: 'Billing Queue', icon: Receipt }
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              id={`tab-${id}`}
              role="tab"
              aria-selected={activeTab === id}
              aria-controls={`tabpanel-${id}`}
              onClick={() => setActiveTab(id as TabId)}
              className={`py-2 px-1 border-b-2 font-medium text-xs sm:text-sm flex items-center space-x-1 sm:space-x-2 whitespace-nowrap ${
                activeTab === id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{label}</span>
            </button>
          ))}
        </nav>
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div role="tabpanel" id="tabpanel-overview" aria-labelledby="tab-overview" className="space-y-6">
          {/* Today's Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            <Card className="p-4 sm:p-6">
              <div className="flex items-center">
                <div className="p-2 bg-green-100 rounded-lg">
                  <Calendar className="w-6 h-6 text-green-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Check-ins Today</p>
                  <p className="text-2xl font-semibold text-gray-900">{data.today.checkIns}</p>
                </div>
              </div>
            </Card>

            <Card className="p-4 sm:p-6">
              <div className="flex items-center">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <CheckCircle className="w-6 h-6 text-blue-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Check-outs Today</p>
                  <p className="text-2xl font-semibold text-gray-900">{data.today.checkOuts}</p>
                </div>
              </div>
            </Card>

            <Card className="p-4 sm:p-6">
              <div className="flex items-center">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <TrendingUp className="w-6 h-6 text-purple-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Occupancy Rate</p>
                  <p className="text-2xl font-semibold text-gray-900">{data.today.occupancyRate ?? 0}%</p>
                </div>
              </div>
            </Card>

            <Card className="p-4 sm:p-6">
              <div className="flex items-center">
                <div className="p-2 bg-yellow-100 rounded-lg">
                  <ClipboardCheck className="w-6 h-6 text-yellow-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Housekeeping Tasks</p>
                  <p className="text-2xl font-semibold text-gray-900">{data.today.pendingHousekeeping}</p>
                </div>
              </div>
            </Card>

            <Card className="p-4 sm:p-6">
              <div className="flex items-center">
                <div className="p-2 bg-orange-100 rounded-lg">
                  <Wrench className="w-6 h-6 text-orange-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Maintenance Tasks</p>
                  <p className="text-2xl font-semibold text-gray-900">{data.today.pendingMaintenance}</p>
                </div>
              </div>
            </Card>

            <Card className="p-4 sm:p-6">
              <div className="flex items-center">
                <div className="p-2 bg-pink-100 rounded-lg">
                  <Users className="w-6 h-6 text-pink-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Guest Services</p>
                  <p className="text-2xl font-semibold text-gray-900">{data.today.pendingGuestServices}</p>
                </div>
              </div>
            </Card>
          </div>

          {/* Today's Arrivals Widget */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1">
              <TodayArrivalsWidget />
            </div>

            {/* Today's Summary Cards */}
            <div className="lg:col-span-2 space-y-6">
              <Card className="p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Today's Summary</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-4 bg-blue-50 rounded-lg">
                    <div className="text-2xl font-bold text-blue-600">{data.roomStatus.summary.occupied}</div>
                    <div className="text-sm text-blue-700">Occupied Rooms</div>
                  </div>
                  <div className="text-center p-4 bg-green-50 rounded-lg">
                    <div className="text-2xl font-bold text-green-600">{data.roomStatus.summary.vacant_clean}</div>
                    <div className="text-sm text-green-700">Ready Rooms</div>
                  </div>
                </div>
              </Card>
            </div>
          </div>

          {/* Quick Actions */}
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
              <Button
                onClick={() => setActiveTab('rooms')}
                className="flex items-center justify-center space-x-2"
              >
                <Users className="w-4 h-4" />
                <span>Room Status</span>
              </Button>
              <Button
                onClick={() => setActiveTab('checkout')}
                variant="secondary"
                className="flex items-center justify-center space-x-2"
              >
                <Receipt className="w-4 h-4" />
                <span>Billing Queue</span>
              </Button>
              <Button
                onClick={() => navigate('/staff/housekeeping')}
                variant="secondary"
                className="flex items-center justify-center space-x-2"
              >
                <ClipboardCheck className="w-4 h-4" />
                <span>Housekeeping</span>
              </Button>
              <Button
                onClick={() => navigate('/staff/maintenance')}
                variant="secondary"
                className="flex items-center justify-center space-x-2"
              >
                <Wrench className="w-4 h-4" />
                <span>Maintenance</span>
              </Button>
              <Button
                onClick={() => setActiveTab('inventory')}
                variant="secondary"
                className="flex items-center justify-center space-x-2"
              >
                <Package className="w-4 h-4" />
                <span>Inventory</span>
              </Button>
              <Button
                onClick={() => navigate('/staff/daily-routine-check')}
                variant="secondary"
                className="flex items-center justify-center space-x-2"
              >
                <CheckSquare className="w-4 h-4" />
                <span>Daily Check</span>
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* My Assignments Tab */}
      {activeTab === 'assignments' && (
        <div role="tabpanel" id="tabpanel-assignments" aria-labelledby="tab-assignments" className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">My Daily Check Assignments</h2>
            <Badge variant="default" className="bg-blue-100 text-blue-800">
              {data.assignedRooms.filter(room => room.checkStatus !== 'completed').length} Pending
            </Badge>
          </div>

          {data.assignedRooms.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {data.assignedRooms.map((room) => (
                <Card key={room._id} className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">Room {room.roomNumber}</h3>
                      <p className="text-sm text-gray-600 capitalize">{room.type} • Floor {room.floor}</p>
                    </div>
                    <Badge
                      variant="default"
                      className={
                        room.checkStatus === 'completed' ? 'bg-green-100 text-green-800' :
                        room.checkStatus === 'overdue' ? 'bg-red-100 text-red-800' :
                        'bg-yellow-100 text-yellow-800'
                      }
                    >
                      {room.checkStatus}
                    </Badge>
                  </div>

                  <div className="space-y-3 mb-4">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">Fixed Items:</span>
                      <span className="font-medium">{room.fixedInventory?.length ?? 0}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">Daily Items:</span>
                      <span className="font-medium">{room.dailyInventory?.length ?? 0}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">Est. Duration:</span>
                      <span className="font-medium">{room.estimatedDuration} min</span>
                    </div>
                    {room.lastChecked && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">Last Checked:</span>
                        <span className="font-medium">
                          {new Date(room.lastChecked).toLocaleDateString()}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2">
                    {room.checkStatus === 'completed' ? (
                      <Button
                        onClick={() => navigate(`/staff/daily-routine-check?roomId=${room._id}`)}
                        variant="outline"
                        className="flex-1 bg-green-50 text-green-700 hover:bg-green-100"
                      >
                        <CheckCircle className="w-4 h-4 mr-2" />
                        View Completed
                      </Button>
                    ) : (
                      <Button
                        onClick={() => navigate(`/staff/daily-routine-check?roomId=${room._id}`)}
                        className="flex-1"
                      >
                        <CheckSquare className="w-4 h-4 mr-2" />
                        Start Check
                      </Button>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="p-6">
              <div className="text-center py-12">
                <ClipboardCheck className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No assignments today</h3>
                <p className="text-gray-500 mb-4">You don't have any daily check assignments yet</p>
                <Button
                  onClick={() => setActiveTab('overview')}
                  variant="outline"
                >
                  Back to Overview
                </Button>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* Room Status Tab */}
      {activeTab === 'rooms' && (
        <div role="tabpanel" id="tabpanel-rooms" aria-labelledby="tab-rooms" className="space-y-6">
          <h2 className="text-xl font-semibold text-gray-900">Room Status Overview</h2>

          {/* Status Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
            {Object.entries(data.roomStatus.summary).map(([status, count]) => (
              <Card key={status} className="p-4">
                <div className="text-center">
                  <p className="text-2xl font-bold text-gray-900">{count as number}</p>
                  <p className="text-sm text-gray-600 capitalize">
                    {status.replace(/_/g, ' ')}
                  </p>
                </div>
              </Card>
            ))}
          </div>

          {/* Rooms Needing Attention */}
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Rooms Needing Attention</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
              {data.roomStatus.needsAttention.map((room) => (
                <div key={room._id} className="p-4 border rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900">Room {room.roomNumber}</p>
                      <p className="text-sm text-gray-600 capitalize">{room.type}</p>
                    </div>
                    <Badge
                      variant="default"
                      className={
                        room.status === 'out_of_order' ? 'bg-red-100 text-red-800' :
                        room.status === 'maintenance' ? 'bg-orange-100 text-orange-800' :
                        'bg-yellow-100 text-yellow-800'
                      }
                    >
                      {room.status.replace(/_/g, ' ')}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* Inventory Tab */}
      {activeTab === 'inventory' && (
        <div role="tabpanel" id="tabpanel-inventory" aria-labelledby="tab-inventory" className="space-y-6">
          <h2 className="text-xl font-semibold text-gray-900">Inventory Summary</h2>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
            {/* Low Stock Items */}
            <Card className="p-4 sm:p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Low Stock Alert</h3>
                <Badge variant="default" className="bg-red-100 text-red-800">
                  {data.inventory.lowStockAlert.count} items
                </Badge>
              </div>
              <div className="space-y-3">
                {data.inventory.lowStockAlert.items.map((item) => (
                  <div key={item._id} className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                    <div>
                      <p className="font-medium text-gray-900">{item.name}</p>
                      <p className="text-sm text-gray-600 capitalize">{item.category}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-red-700">
                        {item.currentStock} / {item.threshold}
                      </p>
                      <p className="text-xs text-red-600">Low Stock</p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            {/* Inspections Due */}
            <Card className="p-4 sm:p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Inspections Due</h3>
                <Badge variant="default" className="bg-yellow-100 text-yellow-800">
                  {data.inventory.inspectionsDue.count} rooms
                </Badge>
              </div>
              <div className="space-y-3">
                {data.inventory.inspectionsDue.rooms.map((room) => (
                  <div key={`inspectionsDue-${room._id}`} className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg">
                    <div>
                      <p className="font-medium text-gray-900">Room {room.roomNumber}</p>
                      <p className="text-sm text-gray-600">Inventory inspection needed</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-yellow-700">
                        {room.daysPastDue} days
                      </p>
                      <p className="text-xs text-yellow-600">Overdue</p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* Checkout Queue Tab */}
      {activeTab === 'checkout' && (
        <div role="tabpanel" id="tabpanel-checkout" aria-labelledby="tab-checkout" className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">Billing Queue</h2>
            <Badge variant="default" className="bg-blue-100 text-blue-800">
              {data.checkoutInventories.filter(c => c.status === 'completed' && c.paymentStatus === 'pending').length} Ready for Payment
            </Badge>
          </div>

          {/* Checkout Inventories List */}
          <div className="space-y-4">
            {data.checkoutInventories.length > 0 ? (
              data.checkoutInventories.map((checkout) => (
                <Card key={checkout._id} className="p-6">
                  <div className="flex flex-col lg:flex-row lg:justify-between lg:items-start gap-4 lg:gap-0">
                    <div className="flex-1">
                      <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-3">
                        <h3 className="text-lg font-semibold text-gray-900">
                          Booking #{checkout.bookingId?.bookingNumber || checkout.bookingId?._id || 'Unknown'}
                        </h3>
                        <Badge
                          variant="default"
                          className={
                            checkout.status === 'completed' ? 'bg-blue-100 text-blue-800' :
                            checkout.status === 'paid' ? 'bg-green-100 text-green-800' :
                            'bg-orange-100 text-orange-800'
                          }
                        >
                          {checkout.status}
                        </Badge>
                        <Badge
                          variant="default"
                          className={
                            checkout.paymentStatus === 'paid' ? 'bg-green-100 text-green-800' :
                            'bg-yellow-100 text-yellow-800'
                          }
                        >
                          Payment: {checkout.paymentStatus}
                        </Badge>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-4">
                        <div>
                          <p className="text-sm text-gray-600">Customer</p>
                          <p className="font-medium">
                            {checkout.bookingId?.userId?.name || 'Guest'}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">Room</p>
                          <p className="font-medium">
                            {checkout.roomId?.roomNumber || '—'} ({checkout.roomId?.type || 'Unknown'})
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">Items Used</p>
                          <p className="font-medium">
                            {(checkout.items ?? []).filter(item => item.status !== 'intact').length} of {(checkout.items ?? []).length}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">Total Amount</p>
                          <p className="font-medium text-green-600">
                            ₹{(checkout.totalAmount ?? 0).toLocaleString('en-IN')}
                          </p>
                        </div>
                      </div>

                      <div className="mb-3">
                        <h4 className="text-sm font-medium text-gray-700 mb-2">Items with Charges:</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {(checkout.items ?? [])
                            .filter(item => item.status !== 'intact' && item.totalPrice > 0)
                            .map((item, index) => (
                              <div key={`${checkout._id}-item-${index}`} className="flex justify-between items-center p-2 bg-red-50 rounded">
                                <div>
                                  <span className="text-sm font-medium">{item.itemName}</span>
                                  <span className="text-xs text-gray-500 ml-2 capitalize">({item.status})</span>
                                </div>
                                <span className="text-sm font-semibold text-red-700">
                                  ₹{item.totalPrice.toLocaleString('en-IN')}
                                </span>
                              </div>
                            ))}
                        </div>
                      </div>

                      <div className="flex items-center gap-4 text-sm text-gray-500">
                        <span>Checked by: {checkout.checkedBy?.name || 'System'}</span>
                        {checkout.checkedAt && (
                          <span>Checked: {new Date(checkout.checkedAt).toLocaleDateString()}</span>
                        )}
                        {checkout.paidAt && (
                          <span>Paid: {new Date(checkout.paidAt).toLocaleDateString()}</span>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-2 lg:ml-4">
                      {checkout.status === 'completed' && checkout.paymentStatus === 'pending' && (
                        <Button
                          onClick={() => navigate(`/staff/checkout-inventory?bookingId=${checkout.bookingId?._id || checkout.bookingId}`)}
                          className="bg-green-600 hover:bg-green-700"
                        >
                          Process Payment
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        onClick={() => navigate(`/staff/checkout-inventory?bookingId=${checkout.bookingId?._id || checkout.bookingId}`)}
                      >
                        View Details
                      </Button>
                    </div>
                  </div>
                </Card>
              ))
            ) : (
              <div className="text-center py-12">
                <Receipt className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No completed checkouts awaiting payment</h3>
                <p className="text-gray-500">Completed checkout reviews that still need payment will appear here</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default withErrorBoundary(StaffDashboard, { level: 'page' });
