import React, { useState, useEffect } from 'react';
import {
  Home,
  ClipboardCheck,
  Package,
  AlertTriangle,
  CheckCircle,
  Clock,
  User,
  Settings,
  Search,
  Filter,
  Plus,
  Bell,
  Menu,
  X
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LoadingSpinner } from '../LoadingSpinner';
import { HousekeepingInspectionForm } from './HousekeepingInspectionForm';
import { ReplacementRequestForm } from './ReplacementRequestForm';
import { roomInventoryService, RoomInventory } from '../../services/roomInventoryService';

interface MobileHousekeepingAppProps {
  userId?: string;
  userRole?: 'housekeeping' | 'supervisor' | 'manager';
}

export function MobileHousekeepingApp({ userId, userRole = 'housekeeping' }: MobileHousekeepingAppProps) {
  const [currentView, setCurrentView] = useState<'dashboard' | 'inspection' | 'replacement' | 'profile'>('dashboard');
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [rooms, setRooms] = useState<RoomInventory[]>([]);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [notifications, setNotifications] = useState<unknown[]>([]);

  const stats = {
    roomsToday: rooms.filter(room => room.isInspectionOverdue || room.daysSinceLastInspection === 0).length,
    completed: rooms.filter(room => !room.isInspectionOverdue && room.daysSinceLastInspection === 0).length,
    pending: rooms.filter(room => room.isInspectionOverdue).length,
    issues: rooms.filter(room => room.maintenanceRequired || room.itemsNeedingReplacement.length > 0).length
  };

  useEffect(() => {
    fetchRooms();
  }, []);

  const fetchRooms = async () => {
    try {
      setLoading(true);
      const response = await roomInventoryService.getInventoryAnalytics();
      setRooms(response.data.roomsNeedingInspection);
    } catch {
      // Error handled silently
    } finally {
      setLoading(false);
    }
  };

  const filteredRooms = rooms.filter(room => {
    const matchesSearch = room.roomId.roomNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         room.roomId.type.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || room.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'clean': return 'bg-green-100 text-green-800';
      case 'dirty': return 'bg-yellow-100 text-yellow-800';
      case 'maintenance': return 'bg-orange-100 text-orange-800';
      case 'damaged': return 'bg-red-100 text-red-800';
      case 'inspection_required': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getPriorityColor = (room: RoomInventory) => {
    if (room.status === 'damaged' || room.conditionScore < 40) return 'border-red-500';
    if (room.maintenanceRequired || room.conditionScore < 70) return 'border-orange-500';
    if (room.isInspectionOverdue) return 'border-yellow-500';
    return 'border-gray-200';
  };

  const renderDashboard = () => (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="p-4 text-center">
          <div className="text-2xl font-bold text-blue-600">{stats.roomsToday}</div>
          <div className="text-sm text-gray-600">Rooms Today</div>
        </Card>
        <Card className="p-4 text-center">
          <div className="text-2xl font-bold text-green-600">{stats.completed}</div>
          <div className="text-sm text-gray-600">Completed</div>
        </Card>
        <Card className="p-4 text-center">
          <div className="text-2xl font-bold text-orange-600">{stats.pending}</div>
          <div className="text-sm text-gray-600">Pending</div>
        </Card>
        <Card className="p-4 text-center">
          <div className="text-2xl font-bold text-red-600">{stats.issues}</div>
          <div className="text-sm text-gray-600">Issues</div>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card className="p-4">
        <h3 className="font-semibold text-gray-900 mb-3">Quick Actions</h3>
        <div className="grid grid-cols-2 gap-3">
          <Button
            onClick={() => setCurrentView('inspection')}
            className="bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center p-3"
          >
            <ClipboardCheck className="w-5 h-5 mr-2" />
            <span>Start Inspection</span>
          </Button>
          <Button
            onClick={() => setCurrentView('replacement')}
            className="bg-orange-600 hover:bg-orange-700 text-white flex items-center justify-center p-3"
          >
            <Package className="w-5 h-5 mr-2" />
            <span>Request Items</span>
          </Button>
        </div>
      </Card>

      {/* Search and Filter */}
      <Card className="p-4">
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search rooms..."
              className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="all">All Status</option>
            <option value="clean">Clean</option>
            <option value="dirty">Dirty</option>
            <option value="maintenance">Maintenance</option>
            <option value="inspection_required">Inspection Required</option>
            <option value="damaged">Damaged</option>
          </select>
        </div>
      </Card>

      {/* Rooms List */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-gray-900">Assigned Rooms</h3>
          <Badge variant="secondary">{filteredRooms.length} rooms</Badge>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <LoadingSpinner />
          </div>
        ) : filteredRooms.length === 0 ? (
          <Card className="p-8 text-center">
            <CheckCircle className="mx-auto h-12 w-12 text-green-500 mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">All Caught Up!</h3>
            <p className="text-gray-600">No rooms need inspection right now.</p>
          </Card>
        ) : (
          filteredRooms.map(room => (
            <Card
              key={room._id}
              className={`p-4 border-l-4 ${getPriorityColor(room)} cursor-pointer hover:shadow-md transition-shadow`}
              onClick={() => {
                setSelectedRoomId(room.roomId._id);
                setCurrentView('inspection');
              }}
            >
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h4 className="font-semibold text-gray-900">
                    Room {room.roomId.roomNumber}
                  </h4>
                  <p className="text-sm text-gray-600">{room.roomId.type}</p>
                </div>
                <div className="text-right">
                  <Badge variant="secondary" className={getStatusColor(room.status)}>
                    {room.status.replace('_', ' ')}
                  </Badge>
                  <div className="text-xs text-gray-500 mt-1">
                    Score: {room.conditionScore}/100
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between text-sm text-gray-600">
                <div className="flex items-center">
                  <Clock className="w-4 h-4 mr-1" />
                  {room.daysSinceLastInspection ? 
                    `${room.daysSinceLastInspection} days ago` : 
                    'Never inspected'
                  }
                </div>
                <div className="flex items-center space-x-2">
                  {room.maintenanceRequired && (
                    <AlertTriangle className="w-4 h-4 text-orange-500" />
                  )}
                  {room.itemsNeedingReplacement.length > 0 && (
                    <Package className="w-4 h-4 text-red-500" />
                  )}
                </div>
              </div>

              {(room.maintenanceRequired || room.itemsNeedingReplacement.length > 0) && (
                <div className="mt-2 pt-2 border-t border-gray-200">
                  <div className="text-xs text-gray-600">
                    {room.maintenanceRequired && (
                      <div className="flex items-center text-orange-600">
                        <AlertTriangle className="w-3 h-3 mr-1" />
                        Maintenance required
                      </div>
                    )}
                    {room.itemsNeedingReplacement.length > 0 && (
                      <div className="flex items-center text-red-600 mt-1">
                        <Package className="w-3 h-3 mr-1" />
                        {room.itemsNeedingReplacement.length} items need replacement
                      </div>
                    )}
                  </div>
                </div>
              )}
            </Card>
          ))
        )}
      </div>
    </div>
  );

  const renderProfile = () => (
    <div className="space-y-6">
      <Card className="p-6">
        <div className="flex items-center space-x-4 mb-6">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
            <User className="w-8 h-8 text-blue-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">Staff Member</h2>
            <p className="text-gray-600">{userRole} • Employee ID: {userId}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <div className="text-2xl font-bold text-gray-900">{stats.completed}</div>
            <div className="text-sm text-gray-600">Rooms Completed Today</div>
          </div>
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <div className="text-2xl font-bold text-gray-900">{stats.roomsToday}</div>
            <div className="text-sm text-gray-600">Total Assigned</div>
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <h3 className="font-semibold text-gray-900 mb-4">App Settings</h3>
        <div className="space-y-4">
          <label className="flex items-center justify-between">
            <span className="text-gray-700">Push Notifications</span>
            <input type="checkbox" className="toggle" defaultChecked />
          </label>
          <label className="flex items-center justify-between">
            <span className="text-gray-700">Auto-sync Data</span>
            <input type="checkbox" className="toggle" defaultChecked />
          </label>
          <label className="flex items-center justify-between">
            <span className="text-gray-700">Offline Mode</span>
            <input type="checkbox" className="toggle" />
          </label>
        </div>
      </Card>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile Header */}
      <div className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-40">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center space-x-3">
            <Button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              size="sm"
              variant="secondary"
              className="md:hidden"
            >
              <Menu className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-lg font-bold text-gray-900">Housekeeping</h1>
              <p className="text-xs text-gray-600">
                {currentView === 'dashboard' ? 'Dashboard' :
                 currentView === 'inspection' ? 'Room Inspection' :
                 currentView === 'replacement' ? 'Item Request' :
                 'Profile'}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Button size="sm" variant="secondary">
              <Bell className="w-4 h-4" />
              {notifications.length > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                  {notifications.length}
                </span>
              )}
            </Button>
          </div>
        </div>
      </div>

      <div className="flex">
        {/* Sidebar */}
        <div className={`fixed inset-y-0 left-0 z-30 w-64 bg-white shadow-lg transform transition-transform ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } md:translate-x-0 md:static md:inset-0 md:w-16 lg:w-64`}>
          <div className="flex flex-col h-full">
            <div className="p-4 border-b border-gray-200 md:hidden lg:block">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900">Navigation</h2>
                <Button
                  onClick={() => setSidebarOpen(false)}
                  size="sm"
                  variant="secondary"
                  className="md:hidden"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <nav className="flex-1 p-4">
              <div className="space-y-2">
                <Button
                  onClick={() => {
                    setCurrentView('dashboard');
                    setSidebarOpen(false);
                  }}
                  variant={currentView === 'dashboard' ? 'default' : 'secondary'}
                  className="w-full justify-start"
                >
                  <Home className="w-4 h-4 mr-2 lg:mr-2 md:mr-0" />
                  <span className="md:hidden lg:inline">Dashboard</span>
                </Button>
                
                <Button
                  onClick={() => {
                    setCurrentView('inspection');
                    setSidebarOpen(false);
                  }}
                  variant={currentView === 'inspection' ? 'default' : 'secondary'}
                  className="w-full justify-start"
                >
                  <ClipboardCheck className="w-4 h-4 mr-2 lg:mr-2 md:mr-0" />
                  <span className="md:hidden lg:inline">Inspection</span>
                </Button>
                
                <Button
                  onClick={() => {
                    setCurrentView('replacement');
                    setSidebarOpen(false);
                  }}
                  variant={currentView === 'replacement' ? 'default' : 'secondary'}
                  className="w-full justify-start"
                >
                  <Package className="w-4 h-4 mr-2 lg:mr-2 md:mr-0" />
                  <span className="md:hidden lg:inline">Request Items</span>
                </Button>
                
                <Button
                  onClick={() => {
                    setCurrentView('profile');
                    setSidebarOpen(false);
                  }}
                  variant={currentView === 'profile' ? 'default' : 'secondary'}
                  className="w-full justify-start"
                >
                  <User className="w-4 h-4 mr-2 lg:mr-2 md:mr-0" />
                  <span className="md:hidden lg:inline">Profile</span>
                </Button>
              </div>
            </nav>
          </div>
        </div>

        {/* Overlay */}
        {sidebarOpen && (
          <div aria-hidden="true"
            className="fixed inset-0 bg-black bg-opacity-50 z-20 md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Main Content */}
        <div className="flex-1 p-4 md:p-6">
          {currentView === 'dashboard' && renderDashboard()}
          {currentView === 'inspection' && (
            <HousekeepingInspectionForm
              roomId={selectedRoomId || filteredRooms[0]?.roomId._id || ''}
              inspectionType="daily_cleaning"
              onComplete={(inspection) => {
                setCurrentView('dashboard');
                fetchRooms();
              }}
              onCancel={() => setCurrentView('dashboard')}
            />
          )}
          {currentView === 'replacement' && (
            <ReplacementRequestForm
              roomId={selectedRoomId || filteredRooms[0]?.roomId._id || ''}
              onComplete={(request) => {
                setCurrentView('dashboard');
                fetchRooms();
              }}
              onCancel={() => setCurrentView('dashboard')}
            />
          )}
          {currentView === 'profile' && renderProfile()}
        </div>
      </div>
    </div>
  );
}