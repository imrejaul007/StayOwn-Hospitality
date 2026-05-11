import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Plus, Search, Filter, Calendar, BarChart3, Settings, TrendingUp, Users, AlertTriangle, RefreshCw, Download, Edit, Trash2 } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { useProperty } from '../../context/PropertyContext';
import { PropertyBreadcrumb } from '../../components/common/PropertyBreadcrumb';
import AllotmentCalendar from '../../components/admin/AllotmentCalendar';
import AllotmentAnalytics from '../../components/admin/AllotmentAnalytics';
import allotmentService, { RoomTypeAllotment } from '../../services/allotmentService';
import GlobalSettingsForm from '../../components/allotments/settings/GlobalSettingsForm';
import IntegrationSettingsForm from '../../components/allotments/settings/IntegrationSettingsForm';
import allotmentSettingsService, { HotelAllotmentSettings } from '../../services/allotmentSettingsService';
import { withErrorBoundary } from '../../components/ErrorBoundary';

const AdminRoomTypeAllotments: React.FC = () => {
  const { selectedPropertyId, selectedProperty, viewMode } = useProperty();
  const [allotments, setAllotments] = useState<RoomTypeAllotment[]>([]);
  const [filteredAllotments, setFilteredAllotments] = useState<RoomTypeAllotment[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [roomTypeFilter, setRoomTypeFilter] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [selectedAllotment, setSelectedAllotment] = useState<RoomTypeAllotment | null>(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [dashboardData, setDashboardData] = useState<unknown>(null);
  const [pagination, setPagination] = useState({
    current: 1,
    pages: 1,
    total: 0,
    limit: 12
  });
  const [dateRange, setDateRange] = useState({
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0]
  });

  // Settings state
  const [hotelSettings, setHotelSettings] = useState<HotelAllotmentSettings | null>(null);
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [activeSettingsTab, setActiveSettingsTab] = useState('global');

  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // Early return if no property selected in single mode
  if (!selectedPropertyId && viewMode === 'single') {
    return <div className="p-6">Please select a property</div>;
  }

  useEffect(() => {
    loadAllotments();
    loadDashboard();
    loadHotelSettings();
  }, [searchParams]);

  useEffect(() => {
    filterAllotments();
  }, [allotments, searchTerm, statusFilter, roomTypeFilter]);

  const loadAllotments = async () => {
    try {
      setLoading(true);
      const params = {
        page: searchParams.get('page') || '1',
        limit: '12',
        search: searchParams.get('search') || '',
        status: searchParams.get('status') || 'all',
        roomTypeId: searchParams.get('roomTypeId') || '',
        sortBy: searchParams.get('sortBy') || 'updatedAt',
        sortOrder: searchParams.get('sortOrder') || 'desc'
      };

      
      const response = await allotmentService.getAllotments(params);
      
      
      if (response) {
        setAllotments(response.allotments);
        setPagination(response.pagination);
      } else {
        toast.error('Failed to load allotments');
      }
    } catch (error) {
      toast.error('Failed to load allotments');
    } finally {
      setLoading(false);
    }
  };

  const loadDashboard = async () => {
    try {
      
      const response = await allotmentService.getDashboard({
        startDate: dateRange.startDate,
        endDate: dateRange.endDate
      });
      
      
      if (response?.success) {
        setDashboardData(response.data);
      } else {
      }
    } catch {
      // Error handled silently
    }
  };

  const filterAllotments = () => {
    let filtered = [...allotments];

    if (searchTerm) {
      filtered = filtered.filter(allotment =>
        allotment.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        allotment.roomTypeId?.name?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter(allotment => allotment.status === statusFilter);
    }

    if (roomTypeFilter !== 'all') {
      filtered = filtered.filter(allotment => allotment.roomTypeId?._id === roomTypeFilter);
    }

    setFilteredAllotments(filtered);
  };

  const handleCreateAllotment = () => {
    navigate('/admin/room-allotments/create');
  };

  const handleEditAllotment = (allotment: RoomTypeAllotment) => {
    navigate(`/admin/room-allotments/${allotment._id}/edit`);
  };

  const handleViewCalendar = (allotment: RoomTypeAllotment) => {
    setSelectedAllotment(allotment);
    setActiveTab('calendar');
  };

  const handleViewAnalytics = (allotment: RoomTypeAllotment) => {
    setSelectedAllotment(allotment);
    setActiveTab('analytics');
  };

  const handleOptimizeAllotment = async (allotment: RoomTypeAllotment) => {
    try {
      const response = await allotmentService.optimizeAllocations(allotment._id);
      if (response?.success !== false) {
        toast.success('Allocations optimized successfully');
        loadAllotments();
      } else {
        toast.error('Failed to optimize allocations');
      }
    } catch {
      toast.error('Failed to optimize allocations');
    }
  };

  const handleDeleteAllotment = async (allotment: RoomTypeAllotment) => {
    if (!window.confirm(`Are you sure you want to delete the allotment "${allotment.name}"?`)) return;
    try {
      await allotmentService.deleteAllotment(allotment._id);
      toast.success('Allotment deleted successfully');
      loadAllotments();
    } catch {
      toast.error('Failed to delete allotment');
    }
  };

  const handleExportDashboard = async () => {
    try {
      const exportData = {
        exportDate: new Date().toISOString(),
        dateRange: dateRange,
        dashboardData: dashboardData,
        allotments: filteredAllotments
      };

      const dataStr = JSON.stringify(exportData, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(dataBlob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = `allotment-dashboard-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      toast.success('Dashboard data exported successfully');
    } catch (error) {
      toast.error('Failed to export dashboard data');
    }
  };

  // Hotel Settings Functions
  const loadHotelSettings = async () => {
    try {
      setSettingsLoading(true);
      const settings = await allotmentSettingsService.getHotelSettings();
      setHotelSettings(settings);
    } catch (error) {
      toast.error('Failed to load hotel settings');
    } finally {
      setSettingsLoading(false);
    }
  };

  const handleSaveGlobalSettings = async (settings: Partial<HotelAllotmentSettings>) => {
    try {
      const updatedSettings = await allotmentSettingsService.updateGlobalSettings(settings);
      setHotelSettings(updatedSettings);
      toast.success('Global settings saved successfully');
    } catch (error) {
      throw error;
    }
  };

  const handleSaveIntegrationSettings = async (settings: Record<string, unknown>) => {
    try {
      const updatedSettings = await allotmentSettingsService.updateIntegrationSettings(settings);
      setHotelSettings(updatedSettings);
      toast.success('Integration settings saved successfully');
    } catch (error) {
      throw error;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case 'inactive':
        return 'bg-gray-100 text-gray-600 border-gray-200';
      case 'suspended':
        return 'bg-red-100 text-red-700 border-red-200';
      default:
        return 'bg-gray-100 text-gray-600 border-gray-200';
    }
  };

  const getOccupancyColor = (rate: number) => {
    if (rate >= 90) return 'text-red-600';
    if (rate >= 70) return 'text-orange-500';
    if (rate >= 50) return 'text-amber-500';
    if (rate >= 30) return 'text-emerald-500';
    return 'text-emerald-600';
  };

  if (selectedAllotment && activeTab === 'calendar') {
    const roomType = {
      _id: selectedAllotment.roomTypeId?._id || selectedAllotment.roomTypeId,
      name: selectedAllotment.roomTypeId?.name || 'Unknown',
      totalInventory: selectedAllotment.defaultSettings?.totalInventory || 0,
      basePrice: 0
    };

    return (
      <div className="p-6">
        <div className="mb-6">
          <Button 
            variant="outline" 
            onClick={() => {
              setSelectedAllotment(null);
              setActiveTab('overview');
            }}
            className="mb-4"
          >
            ← Back to Overview
          </Button>
          <h1 className="text-3xl font-bold text-gray-900">
            {selectedAllotment.name} - Calendar View
          </h1>
          <p className="text-gray-600">
            Drag and drop inventory allocations across channels
          </p>
        </div>

        <AllotmentCalendar
          roomTypes={[roomType]}
          selectedRoomType={roomType._id}
          onRoomTypeChange={() => {}}
          dateRange={{
            start: new Date(),
            end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
          }}
          onDateRangeChange={() => {}}
        />
      </div>
    );
  }

  if (selectedAllotment && activeTab === 'analytics') {
    return (
      <AllotmentAnalytics
        allotment={selectedAllotment}
        onBack={() => {
          setSelectedAllotment(null);
          setActiveTab('overview');
        }}
      />
    );
  }

  return (
    <div className="p-6">
      {/* Property Breadcrumb */}
      <PropertyBreadcrumb items={['Configuration', 'Room Allotments']} />

      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Room Type Allotments</h1>
          <p className="text-gray-500 text-lg">Manage inventory allocation across distribution channels</p>
        </div>
        <Button 
          onClick={handleCreateAllotment} 
          className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white shadow-lg hover:shadow-xl transition-all duration-200"
        >
          <Plus className="w-4 h-4 mr-2" />
          Create Allotment
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3 bg-gray-100 p-1 rounded-lg">
          <TabsTrigger 
            value="overview" 
            className="data-[state=active]:bg-white data-[state=active]:shadow-sm transition-all"
          >
            Overview
          </TabsTrigger>
          <TabsTrigger 
            value="dashboard" 
            className="data-[state=active]:bg-white data-[state=active]:shadow-sm transition-all"
          >
            Dashboard
          </TabsTrigger>
          <TabsTrigger 
            value="settings" 
            className="data-[state=active]:bg-white data-[state=active]:shadow-sm transition-all"
          >
            Settings
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6">
          {/* Dashboard Summary Cards */}
          {dashboardData && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Allotments</CardTitle>
                  <Settings className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{dashboardData.totalAllotments || 0}</div>
                  <p className="text-xs text-muted-foreground">
                    {dashboardData.totalRoomTypes || 0} room type{(dashboardData.totalRoomTypes || 0) === 1 ? '' : 's'} configured
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Avg Occupancy</CardTitle>
                  <BarChart3 className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className={`text-2xl font-bold ${getOccupancyColor(dashboardData.averageOccupancyRate || 0)}`}>
                    {(dashboardData.averageOccupancyRate || 0).toFixed(1)}%
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Last 30 days average
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Active Channels</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{dashboardData.totalChannels || 0}</div>
                  <p className="text-xs text-muted-foreground">
                    {dashboardData.topPerformingChannel?.channelName || 'N/A'} performing best
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    ₹{(dashboardData.totalRevenue || 0).toLocaleString('en-IN')}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Last 30 days
                  </p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Recommendations Alert */}
          {dashboardData?.recentRecommendations?.length > 0 && (
            <Card className="mb-6 border-orange-200 bg-orange-50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-orange-800">
                  <AlertTriangle className="w-5 h-5" />
                  Optimization Recommendations
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {dashboardData.recentRecommendations.slice(0, 3).map((rec: Record<string, unknown>, index: number) => (
                    <div key={`item-${index}`} className="flex items-center justify-between p-2 bg-white rounded">
                      <div>
                        <span className="text-sm font-medium">{rec.type.replace('_', ' ')}</span>
                        <p className="text-xs text-gray-600">{rec.impact}</p>
                      </div>
                      <Badge variant={rec.priority === 'high' ? 'destructive' : 'secondary'}>
                        {rec.priority}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Filters */}
          <Card className="mb-6">
            <CardContent className="p-4">
              <div className="flex flex-wrap gap-4 items-center">
                <div className="flex-1 min-w-[200px]">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <Input
                      placeholder="Search allotments..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
                
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                    <SelectItem value="suspended">Suspended</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={roomTypeFilter} onValueChange={setRoomTypeFilter}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Room Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Room Types</SelectItem>
                    {[...new Map(allotments.filter(a => a.roomTypeId?._id).map(a => [a.roomTypeId._id, a.roomTypeId.name])).entries()].map(([id, name]) => (
                      <SelectItem key={id} value={id}>{name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Allotments Grid */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredAllotments.map((allotment) => (
                <Card key={allotment._id} className="hover:shadow-xl transition-all duration-300 border-0 shadow-md bg-gradient-to-br from-white to-gray-50">
                  <CardHeader className="pb-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-lg font-semibold text-gray-900 truncate">
                          {allotment.name}
                        </CardTitle>
                        <p className="text-sm text-gray-500 mt-1 truncate">
                          {allotment.roomTypeId?.name || 'Unknown Room Type'}
                        </p>
                      </div>
                      <Badge 
                        className={`${getStatusColor(allotment.status)} text-xs font-medium px-2 py-1 rounded-full border-0 shadow-sm flex-shrink-0`}
                      >
                        {allotment.status}
                      </Badge>
                    </div>
                  </CardHeader>
                  
                  <CardContent className="pt-0">
                    <div className="space-y-4">
                      {/* Key Metrics */}
                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-white rounded-lg p-3 border border-gray-100">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                            <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Inventory</span>
                          </div>
                          <p className="text-xl font-bold text-gray-900 mt-1">
                            {allotment.defaultSettings?.totalInventory || 0}
                          </p>
                        </div>
                        <div className="bg-white rounded-lg p-3 border border-gray-100">
                          <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${getOccupancyColor(allotment.overallOccupancyRate || 0).replace('text-', 'bg-')}`}></div>
                            <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Occupancy</span>
                          </div>
                          <p className={`text-xl font-bold mt-1 ${getOccupancyColor(allotment.overallOccupancyRate || 0)}`}>
                            {allotment.overallOccupancyRate?.toFixed(1) || 0}%
                          </p>
                        </div>
                      </div>

                      {/* Active Channels */}
                      <div>
                        <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Active Channels</span>
                        <div className="flex flex-wrap gap-2 mt-2">
                          {allotment.channels?.filter(c => c.isActive).slice(0, 3).map((channel, index) => (
                            <Badge 
                              key={`channel-${index}`} 
                              variant="outline" 
                              className="text-xs px-2 py-1 bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100 transition-colors"
                            >
                              {channel.channelName}
                            </Badge>
                          ))}
                          {allotment.channels?.filter(c => c.isActive).length > 3 && (
                            <Badge 
                              variant="outline" 
                              className="text-xs px-2 py-1 bg-blue-50 border-blue-200 text-blue-700"
                            >
                              +{(allotment.channels?.filter(c => c.isActive).length || 0) - 3} more
                            </Badge>
                          )}
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex gap-2 pt-3 border-t border-gray-100">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleViewCalendar(allotment)}
                          className="flex-1 bg-white border-gray-200 text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-all"
                        >
                          <Calendar className="w-4 h-4 mr-2" />
                          Calendar
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleViewAnalytics(allotment)}
                          className="bg-white border-gray-200 text-gray-700 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 transition-all"
                        >
                          <BarChart3 className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleOptimizeAllotment(allotment)}
                          className="bg-white border-gray-200 text-gray-700 hover:bg-green-50 hover:border-green-300 hover:text-green-700 transition-all"
                        >
                          <TrendingUp className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleEditAllotment(allotment)}
                          className="bg-white border-gray-200 text-gray-700 hover:bg-yellow-50 hover:border-yellow-300 hover:text-yellow-700 transition-all"
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDeleteAllotment(allotment)}
                          className="bg-white border-gray-200 text-gray-700 hover:bg-red-50 hover:border-red-300 hover:text-red-700 transition-all"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Pagination Controls */}
          {filteredAllotments.length > 0 && (
            <div className="flex items-center justify-between mt-8">
              <div className="text-sm text-gray-700">
                Showing {((pagination.current - 1) * pagination.limit) + 1} to {Math.min(pagination.current * pagination.limit, pagination.total)} of {pagination.total} allotments
              </div>
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const newPage = Math.max(1, pagination.current - 1);
                    navigate(`?page=${newPage}`);
                  }}
                  disabled={pagination.current <= 1}
                >
                  Previous
                </Button>
                <div className="flex items-center space-x-1">
                  {Array.from({ length: Math.min(5, pagination.pages) }, (_, i) => {
                    const pageNum = i + 1;
                    return (
                      <Button
                        key={pageNum}
                        variant={pagination.current === pageNum ? "default" : "outline"}
                        size="sm"
                        onClick={() => navigate(`?page=${pageNum}`)}
                        className="w-8 h-8 p-0"
                      >
                        {pageNum}
                      </Button>
                    );
                  })}
                  {pagination.pages > 5 && (
                    <>
                      <span className="text-gray-500">...</span>
                      <Button
                        variant={pagination.current === pagination.pages ? "default" : "outline"}
                        size="sm"
                        onClick={() => navigate(`?page=${pagination.pages}`)}
                        className="w-8 h-8 p-0"
                      >
                        {pagination.pages}
                      </Button>
                    </>
                  )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const newPage = Math.min(pagination.pages, pagination.current + 1);
                    navigate(`?page=${newPage}`);
                  }}
                  disabled={pagination.current >= pagination.pages}
                >
                  Next
                </Button>
              </div>
            </div>
          )}

          {filteredAllotments.length === 0 && !loading && (
            <div className="text-center py-12">
              <Settings className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No allotments found</h3>
              <p className="text-gray-600 mb-4">
                {searchTerm || statusFilter !== 'all' || roomTypeFilter !== 'all'
                  ? 'No allotments match your current filters.'
                  : 'Create your first room type allotment configuration to get started.'}
              </p>
              {(!searchTerm && statusFilter === 'all' && roomTypeFilter === 'all') && (
                <Button onClick={handleCreateAllotment} className="bg-blue-600 hover:bg-blue-700">
                  <Plus className="w-4 h-4 mr-2" />
                  Create Allotment
                </Button>
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="dashboard" className="mt-6">
          <div className="space-y-6">
            {/* Date Range Filter */}
            <Card>
              <CardHeader>
                <CardTitle>Dashboard Filters</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-4 items-center">
                  <div className="flex items-center space-x-2">
                    <label className="text-sm font-medium">Date Range:</label>
                    <Input
                      type="date"
                      value={dateRange.startDate}
                      onChange={(e) => setDateRange(prev => ({ ...prev, startDate: e.target.value }))}
                      className="w-40"
                    />
                    <span className="text-gray-500">to</span>
                    <Input
                      type="date"
                      value={dateRange.endDate}
                      onChange={(e) => setDateRange(prev => ({ ...prev, endDate: e.target.value }))}
                      className="w-40"
                    />
                  </div>
                  <Button 
                    onClick={loadDashboard}
                    variant="outline"
                    size="sm"
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Apply Filters
                  </Button>
                  <Button 
                    onClick={handleExportDashboard}
                    variant="outline"
                    size="sm"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Export Data
                  </Button>
                  <div className="flex space-x-2">
                    <Button 
                      onClick={() => {
                        const today = new Date();
                        const last7Days = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
                        setDateRange({
                          startDate: last7Days.toISOString().split('T')[0],
                          endDate: today.toISOString().split('T')[0]
                        });
                      }}
                      variant="outline"
                      size="sm"
                    >
                      Last 7 Days
                    </Button>
                    <Button 
                      onClick={() => {
                        const today = new Date();
                        const last30Days = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
                        setDateRange({
                          startDate: last30Days.toISOString().split('T')[0],
                          endDate: today.toISOString().split('T')[0]
                        });
                      }}
                      variant="outline"
                      size="sm"
                    >
                      Last 30 Days
                    </Button>
                    <Button 
                      onClick={() => {
                        const today = new Date();
                        const last90Days = new Date(today.getTime() - 90 * 24 * 60 * 60 * 1000);
                        setDateRange({
                          startDate: last90Days.toISOString().split('T')[0],
                          endDate: today.toISOString().split('T')[0]
                        });
                      }}
                      variant="outline"
                      size="sm"
                    >
                      Last 90 Days
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Dashboard Summary Cards */}
            {dashboardData && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Allotments</CardTitle>
                    <Settings className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{dashboardData.totalAllotments || 0}</div>
                    <p className="text-xs text-muted-foreground">
                      {dashboardData.totalRoomTypes || 0} room type{(dashboardData.totalRoomTypes || 0) === 1 ? '' : 's'} configured
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Avg Occupancy</CardTitle>
                    <BarChart3 className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className={`text-2xl font-bold ${getOccupancyColor(dashboardData.averageOccupancyRate || 0)}`}>
                      {(dashboardData.averageOccupancyRate || 0).toFixed(1)}%
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Last 30 days average
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Active Channels</CardTitle>
                    <Users className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{dashboardData.totalChannels || 0}</div>
                    <p className="text-xs text-muted-foreground">
                      {dashboardData.topPerformingChannel?.channelName || 'N/A'} performing best
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      ₹{(dashboardData.totalRevenue || 0).toLocaleString('en-IN')}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Last 30 days
                    </p>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Channel Performance Overview */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Top Performing Channel */}
              <Card>
                <CardHeader>
                  <CardTitle>Top Performing Channel</CardTitle>
                </CardHeader>
                <CardContent>
                  {dashboardData?.topPerformingChannel ? (
                  <div className="space-y-4">
                      <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg">
                        <div>
                          <h4 className="font-medium text-green-900">Top Performer</h4>
                          <p className="text-sm text-green-700">{dashboardData.topPerformingChannel.channelName}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-bold text-green-900">
                            {(dashboardData.topPerformingChannel.utilizationRate || 0).toFixed(1)}%
                          </p>
                          <p className="text-sm text-green-700">Utilization</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-gray-600">Revenue</span>
                          <p className="font-semibold">₹{dashboardData.topPerformingChannel.totalRevenue?.toLocaleString() || 0}</p>
                        </div>
                        <div>
                          <span className="text-gray-600">Bookings</span>
                          <p className="font-semibold">{dashboardData.topPerformingChannel.totalSold || 0}</p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center p-8 bg-gray-50 rounded-lg">
                      <div className="text-center">
                        <BarChart3 className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                          <h4 className="font-medium text-gray-600">No Channel Data Available</h4>
                          <p className="text-sm text-gray-500">Performance data will appear once bookings are made</p>
                        </div>
                      </div>
                    )}
                </CardContent>
              </Card>

              {/* Low Utilization Channels */}
              <Card>
                <CardHeader>
                  <CardTitle>Low Utilization Channels</CardTitle>
                </CardHeader>
                <CardContent>
                  {dashboardData?.lowUtilizationChannels?.length > 0 ? (
                    <div className="space-y-3">
                      {dashboardData.lowUtilizationChannels.slice(0, 3).map((channel: Record<string, unknown>, index: number) => (
                        <div key={`item-${index}`} className="flex items-center justify-between p-3 bg-orange-50 rounded">
                      <div>
                            <span className="text-sm font-medium">{channel.channelName}</span>
                            <p className="text-xs text-gray-600">Allocated: {channel.totalAllocated || 0}</p>
                          </div>
                              <Badge variant="outline" className="text-orange-600">
                                {channel.utilizationRate.toFixed(1)}%
                              </Badge>
                            </div>
                          ))}
                      {dashboardData.lowUtilizationChannels.length > 3 && (
                        <p className="text-xs text-gray-500 text-center">
                          +{dashboardData.lowUtilizationChannels.length - 3} more channels
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center justify-center p-8 bg-gray-50 rounded-lg">
                      <div className="text-center">
                        <AlertTriangle className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                        <h4 className="font-medium text-gray-600">All Channels Performing Well</h4>
                        <p className="text-sm text-gray-500">No low utilization channels found</p>
                        </div>
                      </div>
                    )}
                </CardContent>
              </Card>
            </div>

            {/* Channel Performance Chart */}
            {dashboardData?.topPerformingChannel && (
              <Card>
                <CardHeader>
                  <CardTitle>Channel Performance Overview</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={[
                        {
                          channel: dashboardData.topPerformingChannel.channelName,
                          utilization: dashboardData.topPerformingChannel.utilizationRate || 0,
                          revenue: dashboardData.topPerformingChannel.totalRevenue || 0,
                          bookings: dashboardData.topPerformingChannel.totalSold || 0
                        },
                        ...(dashboardData.lowUtilizationChannels || []).slice(0, 4).map((channel: Record<string, unknown>) => ({
                          channel: channel.channelName,
                          utilization: channel.utilizationRate || 0,
                          revenue: 0, // Low utilization channels might not have revenue data
                          bookings: 0
                        }))
                      ]}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="channel" />
                        <YAxis yAxisId="left" />
                        <YAxis yAxisId="right" orientation="right" />
                        <Tooltip 
                          formatter={(value: number, name: string) => [
                            name === 'revenue' ? `₹${value.toLocaleString()}` : 
                            name === 'utilization' ? `${value.toFixed(1)}%` : 
                            value,
                            name === 'revenue' ? 'Revenue' : 
                            name === 'utilization' ? 'Utilization' : 
                            name === 'bookings' ? 'Bookings' : name
                          ]}
                        />
                        <Legend />
                        <Bar yAxisId="left" dataKey="utilization" fill="#3b82f6" name="Utilization (%)" />
                        <Bar yAxisId="right" dataKey="revenue" fill="#10b981" name="Revenue (₹)" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Button 
                    variant="outline" 
                    className="h-20 flex flex-col items-center justify-center space-y-2"
                    onClick={handleCreateAllotment}
                  >
                    <Plus className="h-6 w-6" />
                    <span>Create New Allotment</span>
                  </Button>
                  <Button 
                    variant="outline" 
                    className="h-20 flex flex-col items-center justify-center space-y-2"
                    onClick={() => loadDashboard()}
                  >
                    <RefreshCw className="h-6 w-6" />
                    <span>Refresh Data</span>
                  </Button>
                  <Button 
                    variant="outline" 
                    className="h-20 flex flex-col items-center justify-center space-y-2"
                    onClick={() => setActiveTab('overview')}
                  >
                    <BarChart3 className="h-6 w-6" />
                    <span>View All Allotments</span>
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Recent Recommendations */}
            {dashboardData?.recentRecommendations?.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Recent Recommendations</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {dashboardData.recentRecommendations.map((rec: Record<string, unknown>, index: number) => (
                      <div key={`item-${index}`} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex-1">
                          <h4 className="font-medium capitalize">{rec.type.replace('_', ' ')}</h4>
                          <p className="text-sm text-gray-600">{rec.impact}</p>
                          <p className="text-xs text-gray-500">
                            Confidence: {rec.confidence}% • Created: {new Date(rec.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                        <Badge variant={rec.priority === 'high' ? 'destructive' : rec.priority === 'medium' ? 'default' : 'secondary'}>
                          {rec.priority}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="settings" className="mt-6">
          <Tabs value={activeSettingsTab} onValueChange={setActiveSettingsTab}>
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="global" className="flex items-center">
                <Settings className="w-4 h-4 mr-2" />
                Global Settings
              </TabsTrigger>
              <TabsTrigger value="integration" className="flex items-center">
                <RefreshCw className="w-4 h-4 mr-2" />
                Integration Settings
              </TabsTrigger>
            </TabsList>

            <TabsContent value="global">
              <GlobalSettingsForm
                settings={hotelSettings}
                onSave={handleSaveGlobalSettings}
                loading={settingsLoading}
              />
            </TabsContent>

            <TabsContent value="integration">
              <IntegrationSettingsForm
                settings={hotelSettings}
                onSave={handleSaveIntegrationSettings}
                loading={settingsLoading}
              />
            </TabsContent>
          </Tabs>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default withErrorBoundary(AdminRoomTypeAllotments, { level: 'page' });