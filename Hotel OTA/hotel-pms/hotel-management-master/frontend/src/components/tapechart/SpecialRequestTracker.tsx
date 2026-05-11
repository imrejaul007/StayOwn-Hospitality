import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/context/AuthContext';
import { formatCurrency } from '@/utils/currencyUtils';
import { guestServiceRequestService, GuestServiceRequest, ServiceStatsResponse, StaffMember } from '@/services/guestServiceRequestService';
import { toast } from 'react-hot-toast';
import {
  Users,
  AlertCircleIcon,
  CheckCircleIcon,
  ClockIcon,
  UserIcon,
  CalendarIcon,
  MessageCircleIcon,
  FilterIcon,
  PlusIcon,
  StarIcon,
  UtensilsIcon,
  BedIcon,
  CarIcon,
  GiftIcon
} from 'lucide-react';

// Using GuestServiceRequest interface from the service
interface RequestStats {
  total: number;
  pending: number;
  assigned: number;
  inProgress: number;
  completed: number;
  overdue: number;
  averageCompletionTime: number;
}

// Extract hotelId string from user object, handling both string and populated object forms
function getUserHotelIdString(hotelId: unknown): string | undefined {
  if (!hotelId) return undefined;
  if (typeof hotelId === 'string') return hotelId;
  if (typeof hotelId === 'object' && hotelId !== null && '_id' in hotelId) {
    return (hotelId as { _id: string })._id;
  }
  return undefined;
}

export const SpecialRequestTracker: React.FC = () => {
  const { user } = useAuth();
  const hotelId = getUserHotelIdString(user?.hotelId);
  const [requests, setRequests] = useState<GuestServiceRequest[]>([]);
  const [availableStaff, setAvailableStaff] = useState<StaffMember[]>([]);
  const [stats, setStats] = useState<RequestStats>({
    total: 0,
    pending: 0,
    assigned: 0,
    inProgress: 0,
    completed: 0,
    overdue: 0,
    averageCompletionTime: 0
  });
  const [selectedRequest, setSelectedRequest] = useState<GuestServiceRequest | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');
  const [newRequestDialogOpen, setNewRequestDialogOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    loadServiceRequests();
    loadRequestStats();
    loadAvailableStaff();
  }, [currentPage, filterStatus, filterPriority, filterType]);

  useEffect(() => {
    if (filterStatus !== 'all' || filterPriority !== 'all' || filterType !== 'all') {
      setCurrentPage(1);
    }
  }, [filterStatus, filterPriority, filterType]);

  const loadServiceRequests = async () => {
    try {
      setLoading(true);
      const params: Record<string, unknown> = {
        page: currentPage,
        limit: 20
      };

      // Apply filters
      if (filterStatus !== 'all') params.status = filterStatus;
      if (filterPriority !== 'all') params.priority = filterPriority;
      if (filterType !== 'all') params.serviceType = filterType;
      if (hotelId) params.hotelId = hotelId;

      const response = await guestServiceRequestService.getServiceRequests(params);
      setRequests(response.serviceRequests);
      setTotalPages(response.pagination.pages);
    } catch (error) {
      toast.error('Failed to load service requests');
      setRequests([]);
    } finally {
      setLoading(false);
    }
  };

  const loadRequestStats = async () => {
    try {
      const params: Record<string, unknown> = {};
      if (hotelId) params.hotelId = hotelId;

      const response = await guestServiceRequestService.getServiceStats(params);

      // Calculate derived stats from the requests
      const totalRequests = requests.length;
      const pending = requests.filter(r => r.status === 'pending').length;
      const assigned = requests.filter(r => r.status === 'assigned').length;
      const inProgress = requests.filter(r => r.status === 'in_progress').length;
      const completed = requests.filter(r => r.status === 'completed').length;
      const overdue = requests.filter(r => guestServiceRequestService.isOverdue(r)).length;

      setStats({
        total: response.overall.totalRequests || totalRequests,
        pending,
        assigned,
        inProgress,
        completed,
        overdue,
        averageCompletionTime: 85 // Default value, could be calculated from completion times
      });
    } catch (error) {
      // Use calculated stats from current requests as fallback
      const totalRequests = requests.length;
      setStats({
        total: totalRequests,
        pending: requests.filter(r => r.status === 'pending').length,
        assigned: requests.filter(r => r.status === 'assigned').length,
        inProgress: requests.filter(r => r.status === 'in_progress').length,
        completed: requests.filter(r => r.status === 'completed').length,
        overdue: requests.filter(r => guestServiceRequestService.isOverdue(r)).length,
        averageCompletionTime: 85
      });
    }
  };

  const loadAvailableStaff = async () => {
    try {
      const staff = await guestServiceRequestService.getAvailableStaff(hotelId);
      setAvailableStaff(staff);
    } catch (error) {
      setAvailableStaff([]);
    }
  };

  const getRequestTypeIcon = (type: string) => {
    const typeInfo = guestServiceRequestService.getServiceTypeInfo(type);
    return <span className="text-sm">{typeInfo.icon}</span>;
  };

  const getPriorityColor = (priority: string): string => {
    return guestServiceRequestService.getPriorityInfo(priority).color;
  };

  const getStatusColor = (status: string): string => {
    return guestServiceRequestService.getStatusInfo(status).color;
  };

  const getStatusIcon = (status: string) => {
    const statusInfo = guestServiceRequestService.getStatusInfo(status);
    return <span className="text-sm">{statusInfo.icon}</span>;
  };

  const isOverdue = (request: GuestServiceRequest): boolean => {
    return guestServiceRequestService.isOverdue(request);
  };

  const assignRequest = async (requestId: string, staffId: string) => {
    try {
      const updatedRequest = await guestServiceRequestService.assignServiceRequest(requestId, staffId);
      setRequests(prev => prev.map(req => req._id === requestId ? updatedRequest : req));
      toast.success('Request assigned successfully');
    } catch (error) {
      toast.error('Failed to assign request');
    }
  };

  const updateRequestStatus = async (requestId: string, newStatus: GuestServiceRequest['status']) => {
    try {
      let updatedRequest;
      switch (newStatus) {
        case 'in_progress':
          updatedRequest = await guestServiceRequestService.startServiceRequest(requestId);
          break;
        case 'completed':
          updatedRequest = await guestServiceRequestService.completeServiceRequest(requestId);
          break;
        case 'cancelled':
          updatedRequest = await guestServiceRequestService.cancelServiceRequest(requestId);
          break;
        default:
          updatedRequest = await guestServiceRequestService.updateServiceRequest(requestId, { status: newStatus });
      }

      setRequests(prev => prev.map(req => req._id === requestId ? updatedRequest : req));
      toast.success(`Request ${newStatus.replace('_', ' ')}`);
    } catch (error) {
      toast.error('Failed to update request status');
    }
  };

  const addNote = async (requestId: string, note: string) => {
    try {
      const updatedRequest = await guestServiceRequestService.updateServiceRequest(requestId, { notes: note });
      setRequests(prev => prev.map(req => req._id === requestId ? updatedRequest : req));
      toast.success('Note added successfully');
    } catch (error) {
      toast.error('Failed to add note');
    }
  };

  const filteredRequests = requests.filter(req => {
    const statusMatch = filterStatus === 'all' || req.status === filterStatus;
    const priorityMatch = filterPriority === 'all' || req.priority === filterPriority;
    const typeMatch = filterType === 'all' || req.serviceType === filterType;
    return statusMatch && priorityMatch && typeMatch;
  });

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button 
          variant="outline" 
          className="gap-2 bg-white border-gray-200 hover:bg-gray-50 hover:border-gray-300 text-gray-700 hover:text-gray-800 transition-all duration-200 shadow-sm hover:shadow-md rounded-lg"
        >
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-gray-600" />
            <span className="font-medium">Special Requests</span>
          </div>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-7xl max-h-[90vh] bg-white rounded-xl shadow-2xl border-0 p-0 overflow-hidden flex flex-col">
        <DialogHeader className="bg-gradient-to-r from-gray-700 to-gray-800 text-white p-6 rounded-t-xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                <Users className="h-8 w-8 text-white" />
              </div>
              <div>
                <DialogTitle className="text-2xl font-bold text-white mb-1">
                  Special Request Tracking & Assignment
                </DialogTitle>
                <p className="text-gray-200 text-sm">Manage guest service requests and staff assignments efficiently</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="px-3 py-1 bg-white/20 rounded-full text-xs font-medium">
                {stats.total} REQUESTS
              </div>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto">
          <div className="p-6">
            <Tabs defaultValue="dashboard" className="w-full">
            <TabsList className="grid w-full grid-cols-3 bg-gray-50 border border-gray-200 rounded-lg p-1 mb-6">
              <TabsTrigger 
                value="dashboard"
                className="data-[state=active]:bg-white data-[state=active]:text-gray-700 data-[state=active]:shadow-sm transition-all duration-200 rounded-md"
              >
                Dashboard
              </TabsTrigger>
              <TabsTrigger 
                value="requests"
                className="data-[state=active]:bg-white data-[state=active]:text-gray-700 data-[state=active]:shadow-sm transition-all duration-200 rounded-md"
              >
                Active Requests
              </TabsTrigger>
              <TabsTrigger 
                value="analytics"
                className="data-[state=active]:bg-white data-[state=active]:text-gray-700 data-[state=active]:shadow-sm transition-all duration-200 rounded-md"
              >
                Analytics
              </TabsTrigger>
            </TabsList>

          <TabsContent value="dashboard" className="space-y-4">
            {/* Statistics Overview */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              <Card>
                <CardContent className="p-4">
                  <div className="text-2xl font-bold">{stats.total}</div>
                  <div className="text-sm text-gray-600">Total Requests</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="text-2xl font-bold text-yellow-600">{stats.pending}</div>
                  <div className="text-sm text-gray-600">Pending</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="text-2xl font-bold text-blue-600">{stats.assigned}</div>
                  <div className="text-sm text-gray-600">Assigned</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="text-2xl font-bold text-orange-600">{stats.inProgress}</div>
                  <div className="text-sm text-gray-600">In Progress</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="text-2xl font-bold text-green-600">{stats.completed}</div>
                  <div className="text-sm text-gray-600">Completed</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="text-2xl font-bold text-red-600">{stats.overdue}</div>
                  <div className="text-sm text-gray-600">Overdue</div>
                </CardContent>
              </Card>
            </div>

            {/* Recent Requests */}
            <Card>
              <CardHeader>
                <CardTitle>Recent Requests</CardTitle>
              </CardHeader>
              <CardContent>
                {requests.length > 0 ? (
                  <div className="space-y-3">
                    {requests.slice(0, 5).map((request) => (
                      <div key={request._id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center gap-3">
                          {getRequestTypeIcon(request.serviceType)}
                          <div>
                            <div className="font-medium">{request.title}</div>
                            <div className="text-sm text-gray-600">
                              {request.userId?.name || 'Unknown Guest'} - Room {guestServiceRequestService.getRoomNumbers(request).join(', ') || 'No Room'}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className={getPriorityColor(request.priority)}>
                            {request.priority.toUpperCase()}
                          </Badge>
                          <Badge className={getStatusColor(request.status)}>
                            {getStatusIcon(request.status)}
                            {request.status.replace('_', ' ').toUpperCase()}
                          </Badge>
                          {isOverdue(request) && (
                            <Badge className="bg-red-100 text-red-800">OVERDUE</Badge>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6 text-gray-500">
                    <p>No recent requests</p>
                    <p className="text-xs mt-1">Special requests will appear here when submitted</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="requests" className="space-y-4">
            {/* Filters */}
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                <FilterIcon className="h-4 w-4" />
                <span className="text-sm font-medium">Filter:</span>
              </div>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="assigned">Assigned</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterPriority} onValueChange={setFilterPriority}>
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="Priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Priority</SelectItem>
                  <SelectItem value="now">Now</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="later">Later</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="room_service">Room Service</SelectItem>
                  <SelectItem value="housekeeping">Housekeeping</SelectItem>
                  <SelectItem value="maintenance">Maintenance</SelectItem>
                  <SelectItem value="concierge">Concierge</SelectItem>
                  <SelectItem value="transport">Transportation</SelectItem>
                  <SelectItem value="spa">Spa & Wellness</SelectItem>
                  <SelectItem value="laundry">Laundry</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
              <Button
                onClick={() => setNewRequestDialogOpen(true)}
                className="gap-2 ml-auto"
              >
                <PlusIcon className="h-4 w-4" />
                New Request
              </Button>
            </div>

            <ScrollArea className="h-[500px] pr-4">
              <div className="space-y-4">
                {loading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                    <span className="ml-2">Loading special requests...</span>
                  </div>
                ) : filteredRequests.map((request) => (
                  <Card key={request._id} className={`border-l-4 ${
                    isOverdue(request)
                      ? 'border-l-red-500'
                      : request.priority === 'urgent' || request.priority === 'now'
                        ? 'border-l-red-400'
                        : request.priority === 'high'
                          ? 'border-l-orange-400'
                          : 'border-l-blue-400'
                  }`}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-start gap-3">
                          {getRequestTypeIcon(request.serviceType)}
                          <div>
                            <div className="font-semibold text-lg">{request.title}</div>
                            <div className="text-sm text-gray-600 mb-1">
                              {request.userId?.name || 'Unknown Guest'} - Room {guestServiceRequestService.getRoomNumbers(request).join(', ') || 'No Room'}
                            </div>
                            <div className="text-sm text-gray-500">
                              Booking: {request.bookingId?.bookingNumber || 'No Booking'}
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-col gap-2 items-end">
                          <div className="flex gap-2">
                            <Badge className={getPriorityColor(request.priority)}>
                              {request.priority.toUpperCase()}
                            </Badge>
                            <Badge className={getStatusColor(request.status)}>
                              {getStatusIcon(request.status)}
                              {request.status.replace('_', ' ').toUpperCase()}
                            </Badge>
                          </div>
                          {isOverdue(request) && (
                            <Badge className="bg-red-100 text-red-800">OVERDUE</Badge>
                          )}
                        </div>
                      </div>

                      <div className="mb-3">
                        <div className="text-sm text-gray-700">{request.description}</div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-3 text-sm">
                        {request.scheduledTime && (
                          <div>
                            <div className="font-medium">Scheduled Time</div>
                            <div className="flex items-center gap-1">
                              <CalendarIcon className="h-3 w-3" />
                              {guestServiceRequestService.formatDateTime(request.scheduledTime)}
                            </div>
                          </div>
                        )}
                        <div>
                          <div className="font-medium">Service Type</div>
                          <div className="flex items-center gap-1">
                            {getRequestTypeIcon(request.serviceType)}
                            {guestServiceRequestService.getServiceTypeInfo(request.serviceType).label}
                          </div>
                        </div>
                        {request.actualCost && (
                          <div>
                            <div className="font-medium">Cost</div>
                            <div className="text-green-600 font-semibold">{formatCurrency(request.actualCost)}</div>
                          </div>
                        )}
                      </div>

                      {request.assignedTo && (
                        <div className="mb-3 p-2 bg-blue-50 rounded">
                          <div className="text-sm">
                            <strong>Assigned to:</strong> {request.assignedTo?.name || 'Unknown'} ({request.assignedTo?.role || 'Unknown'})
                          </div>
                          <div className="text-xs text-gray-600">
                            Contact: {request.assignedTo?.email || 'No contact'}
                          </div>
                        </div>
                      )}

                      {request.notes && (
                        <div className="mb-3">
                          <div className="text-sm font-medium mb-1">Notes:</div>
                          <div className="text-xs bg-gray-50 p-2 rounded">
                            {request.notes}
                          </div>
                        </div>
                      )}

                      <div className="flex gap-2 flex-wrap">
                        {request.status === 'pending' && availableStaff.length > 0 && (
                          <Button
                            size="sm"
                            onClick={() => assignRequest(request._id, availableStaff[0]._id)}
                          >
                            Assign
                          </Button>
                        )}
                        {request.status === 'assigned' && (
                          <Button
                            size="sm"
                            onClick={() => updateRequestStatus(request._id, 'in_progress')}
                          >
                            Start Work
                          </Button>
                        )}
                        {request.status === 'in_progress' && (
                          <Button
                            size="sm"
                            onClick={() => updateRequestStatus(request._id, 'completed')}
                            className="bg-green-600 hover:bg-green-700"
                          >
                            Complete
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setSelectedRequest(request)}
                        >
                          View Details
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            const note = prompt('Add a note:');
                            if (note) addNote(request._id, note);
                          }}
                          className="gap-2"
                        >
                          <MessageCircleIcon className="h-3 w-3" />
                          Add Note
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}

                {filteredRequests.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    No requests found matching the current filters.
                  </div>
                )}
              </div>
            </ScrollArea>
          </TabsContent>


          <TabsContent value="analytics" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle>Request Types Distribution</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {['room_service', 'housekeeping', 'maintenance', 'concierge', 'transport', 'spa'].map((type) => {
                      const count = requests.filter(r => r.serviceType === type).length;
                      const percentage = requests.length > 0 ? Math.round((count / requests.length) * 100) : 0;
                      const typeInfo = guestServiceRequestService.getServiceTypeInfo(type);
                      return (
                        <div key={type} className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {getRequestTypeIcon(type)}
                            <span>{typeInfo.label}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="w-20 bg-gray-200 rounded-full h-2">
                              <div
                                className="bg-blue-600 h-2 rounded-full"
                                style={{ width: `${percentage}%` }}
                              ></div>
                            </div>
                            <span className="text-sm w-8">{count}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Performance Metrics</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between mb-1">
                        <span className="text-sm">Completion Rate</span>
                        <span className="text-sm font-medium">87%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div className="bg-green-600 h-2 rounded-full w-[87%]"></div>
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between mb-1">
                        <span className="text-sm">On-Time Delivery</span>
                        <span className="text-sm font-medium">92%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div className="bg-blue-600 h-2 rounded-full w-[92%]"></div>
                      </div>
                    </div>

                    <div>
                      <div className="text-sm mb-2">Average Completion Time</div>
                      <div className="text-2xl font-bold">{stats.averageCompletionTime} min</div>
                    </div>

                    <div>
                      <div className="text-sm mb-2">Customer Satisfaction</div>
                      <div className="flex items-center gap-1">
                        <div className="text-2xl font-bold">4.8</div>
                        <div className="flex">
                          {[1,2,3,4,5].map(i => (
                            <StarIcon key={i} className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};