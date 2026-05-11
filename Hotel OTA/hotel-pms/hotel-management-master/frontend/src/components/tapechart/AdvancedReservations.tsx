import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { 
  Plus, 
  Search, 
  Filter, 
  Users, 
  Building, 
  Star,
  Calendar,
  CheckCircle,
  Clock,
  AlertTriangle,
  Eye,
  Edit,
  MoreHorizontal,
  Bed,
  Crown,
  TrendingUp
} from 'lucide-react';
import { format } from 'date-fns';
import advancedReservationsService, { AdvancedReservation, AdvancedReservationFilters, AdvancedReservationsStats } from '@/services/advancedReservationsService';
import AdvancedReservationForm from './AdvancedReservationForm';
import AdvancedReservationDetails from './AdvancedReservationDetails';

const AdvancedReservations: React.FC = () => {
  const [reservations, setReservations] = useState<AdvancedReservation[]>([]);
  const [stats, setStats] = useState<AdvancedReservationsStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<AdvancedReservationFilters>({
    page: 1,
    limit: 10,
    sortBy: 'createdAt',
    sortOrder: 'desc'
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [selectedReservation, setSelectedReservation] = useState<AdvancedReservation | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState({
    current: 1,
    pages: 1,
    total: 0
  });

  useEffect(() => {
    fetchReservations();
    fetchStats();
  }, [filters]);

  const fetchReservations = async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await advancedReservationsService.getAdvancedReservations(filters);
      setReservations(result.data);
      setPagination(result.pagination);
    } catch (error: unknown) {
      const axiosErr = error as { response?: { data?: { message?: string } } };
      const errorMessage = axiosErr.response?.data?.message ||
                          (error instanceof Error ? error.message : 'Failed to load advanced reservations. Please try again.');
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const statsData = await advancedReservationsService.getAdvancedReservationsStats();
      setStats(statsData);
    } catch {
      // Error handled silently
    }
  };

  const handleSearch = () => {
    const searchFilters: AdvancedReservationFilters = {
      ...filters,
      page: 1
    };

    if (typeFilter !== 'all') {
      searchFilters.reservationType = typeFilter;
    }

    if (priorityFilter !== 'all') {
      searchFilters.priority = priorityFilter;
    }

    // Add search term to filters (backend should handle this)
    if (searchTerm.trim()) {
      searchFilters.search = searchTerm.trim();
    }

    setFilters(searchFilters);
  };

  const getReservationTypeBadge = (type: string) => {
    const typeColors = {
      standard: 'bg-gray-100 text-gray-800',
      group: 'bg-blue-100 text-blue-800',
      corporate: 'bg-purple-100 text-purple-800',
      vip: 'bg-yellow-100 text-yellow-800',
      complimentary: 'bg-green-100 text-green-800',
      house_use: 'bg-red-100 text-red-800'
    };
    
    return (
      <Badge className={typeColors[type as keyof typeof typeColors] || 'bg-gray-100 text-gray-800'}>
        {type.toUpperCase().replace('_', ' ')}
      </Badge>
    );
  };

  const getPriorityBadge = (priority: string) => {
    const priorityColors = {
      low: 'bg-gray-100 text-gray-800',
      medium: 'bg-blue-100 text-blue-800',
      high: 'bg-orange-100 text-orange-800',
      vip: 'bg-red-100 text-red-800'
    };
    
    return (
      <Badge className={priorityColors[priority as keyof typeof priorityColors] || 'bg-gray-100 text-gray-800'}>
        {priority.toUpperCase()}
      </Badge>
    );
  };

  const getVipStatusIcon = (vipStatus?: string) => {
    if (!vipStatus || vipStatus === 'none') return null;
    
    const vipColors = {
      member: 'text-gray-500',
      silver: 'text-gray-400',
      gold: 'text-yellow-500',
      platinum: 'text-blue-500',
      diamond: 'text-purple-500'
    };
    
    return <Crown className={`w-4 h-4 ${vipColors[vipStatus as keyof typeof vipColors] || 'text-gray-500'}`} />;
  };

  const handleCreateSuccess = (newReservation: AdvancedReservation) => {
    setReservations(prev => [newReservation, ...prev]);
    setShowCreateForm(false);
    fetchStats();
  };

  if (loading && reservations.length === 0) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Advanced Reservations</h1>
          <p className="text-gray-600">Manage complex reservations with detailed preferences and requirements</p>
        </div>
        <Button onClick={() => setShowCreateForm(true)} className="flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Create Advanced Reservation
        </Button>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="flex">
            <AlertTriangle className="h-4 w-4 text-red-400 mt-0.5 mr-3" />
            <div className="flex-1">
              <h3 className="text-sm font-medium text-red-800">Error</h3>
              <p className="text-sm text-red-700 mt-1">{error}</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setError(null);
                fetchReservations();
                fetchStats();
              }}
              className="ml-3"
            >
              Retry
            </Button>
          </div>
        </div>
      )}

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Users className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Total Reservations</p>
                  <p className="text-xl font-semibold">
                    {stats.typeStats.reduce((sum, stat) => sum + stat.count, 0)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <TrendingUp className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Upgrades</p>
                  <p className="text-xl font-semibold">
                    {stats.upgradeStats.reduce((sum, stat) => sum + stat.count, 0)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-yellow-100 rounded-lg">
                  <Clock className="w-5 h-5 text-yellow-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Waitlist</p>
                  <p className="text-xl font-semibold">{stats.waitlistCount}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <Crown className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">VIP Reservations</p>
                  <p className="text-xl font-semibold">
                    {stats.typeStats.find(s => s._id === 'vip')?.count || 0}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-4 items-center">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <Input
                  placeholder="Search reservations..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleSearch();
                    }
                  }}
                  className="pl-9"
                />
              </div>
            </div>
            
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="standard">Standard</SelectItem>
                <SelectItem value="group">Group</SelectItem>
                <SelectItem value="corporate">Corporate</SelectItem>
                <SelectItem value="vip">VIP</SelectItem>
                <SelectItem value="complimentary">Complimentary</SelectItem>
                <SelectItem value="house_use">House Use</SelectItem>
              </SelectContent>
            </Select>
            
            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Priorities</SelectItem>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="vip">VIP</SelectItem>
              </SelectContent>
            </Select>
            
            <Button onClick={handleSearch} variant="outline" className="flex items-center gap-2">
              <Filter className="w-4 h-4" />
              Filter
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Reservations Table */}
      <Card>
        <CardHeader>
          <CardTitle>Advanced Reservations ({pagination.total})</CardTitle>
        </CardHeader>
        <CardContent>
          {reservations.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No advanced reservations found</p>
              <p className="text-sm">Create your first advanced reservation to get started</p>
            </div>
          ) : (
            <div className="space-y-4">
              {reservations.map((reservation) => (
                <div
                  key={reservation._id}
                  className="border rounded-lg p-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <Users className="w-4 h-4 text-gray-500" />
                        <h3 className="font-semibold text-lg">
                          {reservation.bookingId?.guestName || 'Guest Name Not Available'}
                        </h3>
                        <span className="text-sm text-gray-500">
                          #{reservation.reservationId}
                        </span>
                        {getReservationTypeBadge(reservation.reservationType)}
                        {getPriorityBadge(reservation.priority)}
                        {getVipStatusIcon(reservation.guestProfile.vipStatus)}
                      </div>
                      
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-600 mb-3">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4" />
                          <span>
                            {reservation.bookingId?.checkIn ? format(new Date(reservation.bookingId.checkIn), 'MMM dd') : 'N/A'} - 
                            {reservation.bookingId?.checkOut ? format(new Date(reservation.bookingId.checkOut), 'MMM dd, yyyy') : 'N/A'}
                          </span>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <Bed className="w-4 h-4" />
                          <span>Rooms: {reservation.roomAssignments.length}</span>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <TrendingUp className="w-4 h-4" />
                          <span>Upgrades: {reservation.upgrades.length}</span>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4" />
                          <span>Requests: {reservation.specialRequests.length}</span>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {reservation.roomPreferences.preferredView && (
                          <Badge variant="outline" className="text-xs">
                            {reservation.roomPreferences.preferredView} view
                          </Badge>
                        )}
                        {reservation.roomPreferences.accessibleRoom && (
                          <Badge variant="outline" className="text-xs">
                            Accessible
                          </Badge>
                        )}
                        {reservation.roomPreferences.connectingRooms && (
                          <Badge variant="outline" className="text-xs">
                            Connecting rooms
                          </Badge>
                        )}
                        {reservation.waitlistInfo && (
                          <Badge variant="outline" className="text-xs bg-yellow-50 text-yellow-700">
                            Waitlist #{reservation.waitlistInfo.waitlistPosition}
                          </Badge>
                        )}
                        {reservation.reservationFlags.length > 0 && (
                          <Badge variant="outline" className="text-xs bg-red-50 text-red-700">
                            {reservation.reservationFlags.length} flags
                          </Badge>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedReservation(reservation)}
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Pagination */}
          {pagination.pages > 1 && (
            <div className="flex items-center justify-between pt-4">
              <p className="text-sm text-gray-600">
                Showing {((pagination.current - 1) * filters.limit! + 1)} to {Math.min(pagination.current * filters.limit!, pagination.total)} of {pagination.total} results
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setFilters(prev => ({ ...prev, page: prev.page! - 1 }))}
                  disabled={pagination.current <= 1}
                >
                  Previous
                </Button>
                <span className="text-sm text-gray-600">
                  Page {pagination.current} of {pagination.pages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setFilters(prev => ({ ...prev, page: prev.page! + 1 }))}
                  disabled={pagination.current >= pagination.pages}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Advanced Reservation Dialog */}
      <Dialog open={showCreateForm} onOpenChange={setShowCreateForm}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Advanced Reservation</DialogTitle>
            <DialogDescription>
              Create a new advanced reservation with detailed preferences and requirements
            </DialogDescription>
          </DialogHeader>
          <AdvancedReservationForm
            onSuccess={handleCreateSuccess}
            onCancel={() => setShowCreateForm(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Advanced Reservation Details Dialog */}
      <Dialog open={!!selectedReservation} onOpenChange={() => setSelectedReservation(null)}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          {selectedReservation && (
            <AdvancedReservationDetails
              reservation={selectedReservation}
              onUpdate={(updatedReservation) => {
                setReservations(prev => 
                  prev.map(res => 
                    res._id === updatedReservation._id ? updatedReservation : res
                  )
                );
                setSelectedReservation(updatedReservation);
              }}
              onClose={() => setSelectedReservation(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdvancedReservations;