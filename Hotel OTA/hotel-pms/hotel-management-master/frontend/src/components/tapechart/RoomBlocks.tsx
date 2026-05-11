import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Plus, 
  Search, 
  Filter, 
  Calendar, 
  Users, 
  Building, 
  MapPin,
  Phone,
  Mail,
  Clock,
  IndianRupee,
  AlertCircle,
  CheckCircle,
  XCircle,
  Eye,
  Edit,
  Trash2,
  MoreHorizontal
} from 'lucide-react';
import { format } from 'date-fns';
import roomBlockService, { RoomBlock, RoomBlockFilters, RoomBlockStats } from '@/services/roomBlockService';
import RoomBlockForm from './RoomBlockForm';
import RoomBlockDetails from './RoomBlockDetails';

const RoomBlocks: React.FC = () => {
  const [roomBlocks, setRoomBlocks] = useState<RoomBlock[]>([]);
  const [stats, setStats] = useState<RoomBlockStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [filters, setFilters] = useState<RoomBlockFilters>({
    page: 1,
    limit: 10,
    sortBy: 'startDate',
    sortOrder: 'asc'
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [eventTypeFilter, setEventTypeFilter] = useState<string>('all');
  const [selectedBlock, setSelectedBlock] = useState<RoomBlock | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [pagination, setPagination] = useState({
    current: 1,
    pages: 1,
    total: 0
  });

  useEffect(() => {
    fetchRoomBlocks();
    fetchStats();
  }, [filters]);

  const fetchRoomBlocks = async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await roomBlockService.getRoomBlocks(filters);
      setRoomBlocks(result.data);
      setPagination(result.pagination);
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : 'Failed to load room blocks. Please try again.');
      setRoomBlocks([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      setStatsLoading(true);
      setStatsError(null);
      const statsData = await roomBlockService.getRoomBlockStats();
      setStats(statsData);
    } catch (error: unknown) {
      setStatsError(error instanceof Error ? error.message : 'Failed to load statistics.');
      setStats(null);
    } finally {
      setStatsLoading(false);
    }
  };

  const handleSearch = () => {
    const searchFilters: RoomBlockFilters = {
      ...filters,
      page: 1
    };

    if (searchTerm.trim()) {
      searchFilters.search = searchTerm.trim();
    }

    if (statusFilter !== 'all') {
      searchFilters.status = statusFilter;
    }

    if (eventTypeFilter !== 'all') {
      searchFilters.eventType = eventTypeFilter;
    }

    setFilters(searchFilters);
  };

  // Auto-search as user types (debounced)
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (searchTerm !== (filters.search || '')) {
        handleSearch();
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [searchTerm]);

  const getStatusBadge = (status: RoomBlock['status']) => {
    const variants = {
      active: 'bg-green-100 text-green-800',
      completed: 'bg-blue-100 text-blue-800',
      cancelled: 'bg-red-100 text-red-800',
      partially_released: 'bg-yellow-100 text-yellow-800'
    };

    const icons = {
      active: <CheckCircle className="w-3 h-3" />,
      completed: <CheckCircle className="w-3 h-3" />,
      cancelled: <XCircle className="w-3 h-3" />,
      partially_released: <AlertCircle className="w-3 h-3" />
    };

    return (
      <Badge className={`${variants[status]} flex items-center gap-1`}>
        {icons[status]}
        {status.replace('_', ' ').toUpperCase()}
      </Badge>
    );
  };

  const getEventTypeIcon = (eventType: RoomBlock['eventType']) => {
    const icons = {
      conference: <Users className="w-4 h-4" />,
      wedding: <Users className="w-4 h-4" />,
      corporate_event: <Building className="w-4 h-4" />,
      group_booking: <Users className="w-4 h-4" />,
      convention: <Building className="w-4 h-4" />,
      other: <Calendar className="w-4 h-4" />
    };
    return icons[eventType] || <Calendar className="w-4 h-4" />;
  };

  const handleCreateSuccess = (newBlock: RoomBlock) => {
    setRoomBlocks(prev => [newBlock, ...prev]);
    setShowCreateForm(false);
    fetchStats(); // Refresh stats
  };

  if (loading && roomBlocks.length === 0) {
    return (
      <div className="p-4 md:p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="h-8 bg-gray-200 rounded w-64 animate-pulse"></div>
            <div className="h-4 bg-gray-200 rounded w-48 mt-2 animate-pulse"></div>
          </div>
          <div className="h-10 bg-gray-200 rounded w-40 animate-pulse"></div>
        </div>
        
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gray-200 rounded-lg"></div>
                  <div className="flex-1">
                    <div className="h-4 bg-gray-200 rounded mb-2"></div>
                    <div className="h-6 bg-gray-200 rounded"></div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        
        <Card>
          <CardContent className="p-4">
            <div className="h-10 bg-gray-200 rounded animate-pulse"></div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <span className="ml-3 text-gray-600">Loading room blocks...</span>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Room Block Management</h1>
          <p className="text-gray-600 mt-1">Manage group bookings and room blocks</p>
        </div>
        <Button onClick={() => setShowCreateForm(true)} className="flex items-center gap-2 w-full sm:w-auto">
          <Plus className="w-4 h-4" />
          Create Room Block
        </Button>
      </div>

      {/* Stats Cards */}
      {statsLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gray-200 rounded-lg"></div>
                  <div className="flex-1">
                    <div className="h-4 bg-gray-200 rounded mb-2"></div>
                    <div className="h-6 bg-gray-200 rounded"></div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : statsError ? (
        <Card className="border-red-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-red-600">
              <AlertCircle className="w-4 h-4" />
              <span>{statsError}</span>
              <Button variant="outline" size="sm" onClick={fetchStats} className="ml-auto">
                Retry
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : stats ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-gray-600 truncate">Active Blocks</p>
                  <p className="text-2xl font-semibold">
                    {stats.statusStats.find(s => s._id === 'active')?.count || 0}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Building className="w-5 h-5 text-blue-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-gray-600 truncate">Total Rooms</p>
                  <p className="text-2xl font-semibold">
                    {stats.statusStats.reduce((sum, stat) => sum + stat.totalRooms, 0)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-yellow-100 rounded-lg">
                  <Users className="w-5 h-5 text-yellow-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-gray-600 truncate">Booked Rooms</p>
                  <p className="text-2xl font-semibold">
                    {stats.statusStats.reduce((sum, stat) => sum + stat.totalBookedRooms, 0)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <Calendar className="w-5 h-5 text-purple-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-gray-600 truncate">Events</p>
                  <p className="text-2xl font-semibold">
                    {stats.eventTypeStats.length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <Input
                  placeholder="Search room blocks..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-4">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-[150px]">
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                  <SelectItem value="partially_released">Partially Released</SelectItem>
                </SelectContent>
              </Select>
              
              <Select value={eventTypeFilter} onValueChange={setEventTypeFilter}>
                <SelectTrigger className="w-full sm:w-[150px]">
                  <SelectValue placeholder="All Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="conference">Conference</SelectItem>
                  <SelectItem value="wedding">Wedding</SelectItem>
                  <SelectItem value="corporate_event">Corporate Event</SelectItem>
                  <SelectItem value="group_booking">Group Booking</SelectItem>
                  <SelectItem value="convention">Convention</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
              
              <Button 
                onClick={handleSearch} 
                variant="outline" 
                className="flex items-center gap-2 w-full sm:w-auto justify-center"
              >
                <Filter className="w-4 h-4" />
                Filter
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Room Blocks Table */}
      <Card>
        <CardHeader>
          <CardTitle>Room Blocks ({pagination.total})</CardTitle>
        </CardHeader>
        <CardContent>
          {error ? (
            <div className="text-center py-8">
              <AlertCircle className="w-12 h-12 mx-auto mb-4 text-red-500" />
              <p className="text-red-600 mb-4">{error}</p>
              <Button onClick={fetchRoomBlocks} variant="outline">
                Try Again
              </Button>
            </div>
          ) : roomBlocks.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Building className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No room blocks found</p>
              <p className="text-sm">Create your first room block to get started</p>
            </div>
          ) : (
            <div className="space-y-4">
              {roomBlocks.map((block) => (
                <div role="button" tabIndex={0}
                  key={block._id}
                  className="border rounded-lg p-4 hover:shadow-md transition-all duration-200 cursor-pointer bg-white hover:bg-gray-50"
                  onClick={() => setSelectedBlock(block)}
                 onKeyDown={(e: React.KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); const clickHandler = () => setSelectedBlock(block); if (typeof clickHandler === 'function') { clickHandler(e as any); } } }}>
                  <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-3">
                        <div className="flex items-center gap-3">
                          {getEventTypeIcon(block.eventType)}
                          <h3 className="font-semibold text-lg truncate">{block.blockName}</h3>
                        </div>
                        {getStatusBadge(block.status)}
                      </div>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-sm text-gray-600 mb-3">
                        <div className="flex items-center gap-2 min-w-0">
                          <Users className="w-4 h-4 flex-shrink-0" />
                          <span className="truncate">{block.groupName}</span>
                        </div>
                        
                        <div className="flex items-center gap-2 min-w-0">
                          <Calendar className="w-4 h-4 flex-shrink-0" />
                          <span className="truncate">
                            {format(new Date(block.startDate), 'MMM dd')} - {format(new Date(block.endDate), 'MMM dd, yyyy')}
                          </span>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <Building className="w-4 h-4 flex-shrink-0" />
                          <span>{block.totalRooms} rooms</span>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <CheckCircle className="w-4 h-4 flex-shrink-0" />
                          <span>{block.roomsBooked} booked</span>
                        </div>
                      </div>
                      
                      {block.contactPerson?.name && (
                        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-gray-600">
                          <div className="flex items-center gap-1 min-w-0">
                            <Users className="w-3 h-3 flex-shrink-0" />
                            <span className="truncate">{block.contactPerson.name}</span>
                          </div>
                          {block.contactPerson.email && (
                            <div className="flex items-center gap-1 min-w-0">
                              <Mail className="w-3 h-3 flex-shrink-0" />
                              <span className="truncate">{block.contactPerson.email}</span>
                            </div>
                          )}
                          {block.contactPerson.phone && (
                            <div className="flex items-center gap-1">
                              <Phone className="w-3 h-3 flex-shrink-0" />
                              <span>{block.contactPerson.phone}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    
                    <div className="flex items-center justify-end gap-2 lg:ml-4">
                      <div className="text-right text-sm">
                        <div className="text-gray-500">Utilization</div>
                        <div className="font-semibold text-lg">
                          {Math.round((block.roomsBooked / block.totalRooms) * 100)}%
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedBlock(block);
                        }}
                        className="flex-shrink-0"
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Room Block Dialog */}
      <Dialog open={showCreateForm} onOpenChange={setShowCreateForm}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Room Block</DialogTitle>
            <DialogDescription>
              Create a new room block for group bookings
            </DialogDescription>
          </DialogHeader>
          <RoomBlockForm
            onSuccess={handleCreateSuccess}
            onCancel={() => setShowCreateForm(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Room Block Details Dialog */}
      <Dialog open={!!selectedBlock} onOpenChange={() => setSelectedBlock(null)}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          {selectedBlock && (
            <RoomBlockDetails
              roomBlock={selectedBlock}
              onUpdate={(updatedBlock) => {
                setRoomBlocks(prev => 
                  prev.map(block => 
                    block._id === updatedBlock._id ? updatedBlock : block
                  )
                );
                setSelectedBlock(updatedBlock);
              }}
              onClose={() => setSelectedBlock(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default RoomBlocks;