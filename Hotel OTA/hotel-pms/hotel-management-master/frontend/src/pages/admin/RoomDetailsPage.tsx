import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useRoom, useRoomMetrics, useUpdateRoomStatus } from '../../hooks/useRooms';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { formatCurrency, formatPercentage } from '../../utils/dashboardUtils';
import { withErrorBoundary } from '../../components/ErrorBoundary';
import {
  ArrowLeft,
  MapPin, 
  Users, 
  Calendar,
  Settings,
  Wrench,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  Star,
  Wifi,
  Car,
  Coffee,
  Tv,
  Wind
} from 'lucide-react';

const amenityIcons: Record<string, React.ReactNode> = {
  'wifi': <Wifi className="h-4 w-4" />,
  'free wifi': <Wifi className="h-4 w-4" />,
  'parking': <Car className="h-4 w-4" />,
  'coffee machine': <Coffee className="h-4 w-4" />,
  'tv': <Tv className="h-4 w-4" />,
  'television': <Tv className="h-4 w-4" />,
  'ac': <Wind className="h-4 w-4" />,
  'air conditioning': <Wind className="h-4 w-4" />,
  'minibar': <Coffee className="h-4 w-4" />,
};

const getStatusColor = (status: string) => {
  switch (status) {
    case 'vacant':
      return 'bg-green-100 text-green-800 border-green-200';
    case 'occupied':
      return 'bg-red-100 text-red-800 border-red-200';
    case 'reserved':
      return 'bg-orange-100 text-orange-800 border-orange-200';
    case 'dirty':
      return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    case 'maintenance':
      return 'bg-orange-100 text-orange-800 border-orange-200';
    case 'out_of_order':
      return 'bg-gray-100 text-gray-800 border-gray-200';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200';
  }
};

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'vacant':
      return <CheckCircle className="h-4 w-4" />;
    case 'occupied':
      return <Users className="h-4 w-4" />;
    case 'reserved':
      return <Clock className="h-4 w-4" />;
    case 'dirty':
      return <AlertTriangle className="h-4 w-4" />;
    case 'maintenance':
      return <Wrench className="h-4 w-4" />;
    case 'out_of_order':
      return <XCircle className="h-4 w-4" />;
    default:
      return <Settings className="h-4 w-4" />;
  }
};

const getStatusLabel = (status: string) => {
  switch (status) {
    case 'vacant':
      return 'Available';
    case 'occupied':
      return 'Occupied';
    case 'reserved':
      return 'Reserved';
    case 'dirty':
      return 'Dirty/Cleaning';
    case 'maintenance':
      return 'Maintenance';
    case 'out_of_order':
      return 'Out of Order';
    default:
      return 'Unknown';
  }
};

function RoomDetailsPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  // State for modals
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showMaintenanceModal, setShowMaintenanceModal] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [maintenanceNotes, setMaintenanceNotes] = useState('');
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  
  const roomQuery = useRoom(roomId!, { enabled: !!roomId });
  const updateRoomStatus = useUpdateRoomStatus();
  const room = roomQuery.data?.room;
  
  if (roomQuery.isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (roomQuery.error || !room) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-4xl mx-auto">
          <Card className="text-center py-12">
            <CardContent>
              <XCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Room Not Found</h2>
              <p className="text-gray-600 mb-4">The room you're looking for doesn't exist or you don't have permission to view it.</p>
              <Button onClick={() => navigate('/admin/rooms')} className="mt-4">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Rooms
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Handler functions
  const handleStatusChange = async (status: string) => {
    if (!roomId || !room) return;
    
    setIsUpdatingStatus(true);
    try {
      await updateRoomStatus.mutateAsync({
        id: roomId,
        status: status as string
      });
      
      toast.success(`Room status updated to ${getStatusLabel(status)}`);
      setShowStatusModal(false);
      // Refetch room data
      roomQuery.refetch();
    } catch (error) {
      toast.error('Failed to update room status');
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleMaintenanceSchedule = async () => {
    if (!roomId || !room || !maintenanceNotes.trim()) {
      toast.error('Please add maintenance notes');
      return;
    }

    setIsUpdatingStatus(true);
    try {
      // Update room status to maintenance and add notes
      await updateRoomStatus.mutateAsync({
        id: roomId,
        status: 'maintenance',
        maintenanceNotes: maintenanceNotes.trim()
      });
      
      toast.success('Room scheduled for maintenance');
      setShowMaintenanceModal(false);
      setMaintenanceNotes('');
      // Refetch room data
      roomQuery.refetch();
    } catch (error) {
      toast.error('Failed to schedule maintenance');
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const currentStatus = (room as Record<string, unknown>).computedStatus as string || room.status;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-4">
            <Button
              variant="ghost"
              onClick={() => navigate('/admin/rooms')}
              className="text-gray-600 hover:text-gray-900"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Rooms
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Room {room.roomNumber}
              </h1>
              <p className="text-gray-600 capitalize">
                {room.type} • Floor {room.floor}
              </p>
            </div>
          </div>
          
          <div className={`px-3 py-2 rounded-full text-sm font-medium border ${getStatusColor(currentStatus)} flex items-center space-x-2`}>
            {getStatusIcon(currentStatus)}
            <span>{getStatusLabel(currentStatus)}</span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Room Information */}
          <div className="lg:col-span-2 space-y-6">
            {/* Basic Details Card */}
            <Card>
              <CardHeader>
                <h2 className="text-lg font-semibold text-gray-900">Room Information</h2>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Room Number</label>
                    <p className="text-lg font-semibold text-gray-900">{room.roomNumber}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Type</label>
                    <p className="text-lg font-semibold text-gray-900 capitalize">{room.type}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Floor</label>
                    <p className="text-lg font-semibold text-gray-900">{room.floor}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Capacity</label>
                    <p className="text-lg font-semibold text-gray-900 flex items-center">
                      <Users className="h-4 w-4 mr-1" />
                      {room.capacity} guests
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Base Rate</label>
                    <p className="text-lg font-semibold text-gray-900">{formatCurrency(room.baseRate)}/night</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Current Rate</label>
                    <p className="text-lg font-semibold text-gray-900">{formatCurrency(room.currentRate)}/night</p>
                  </div>
                </div>

                {room.description && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                    <p className="text-gray-900">{room.description}</p>
                  </div>
                )}

                {room.amenities && room.amenities.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Amenities</label>
                    <div className="flex flex-wrap gap-2">
                      {room.amenities.map((amenity: string, index: number) => (
                        <div key={`amenity-${amenity}`} className="flex items-center space-x-1 bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-sm">
                          {amenityIcons[amenity.toLowerCase()] || <Star className="h-4 w-4" />}
                          <span className="capitalize">{amenity}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {room.maintenanceNotes && (
                  <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                    <div className="flex items-center space-x-2 mb-2">
                      <Wrench className="h-4 w-4 text-orange-600" />
                      <label className="block text-sm font-medium text-orange-800">Maintenance Notes</label>
                    </div>
                    <p className="text-orange-700">{room.maintenanceNotes}</p>
                  </div>
                )}

                {room.lastCleaned && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Last Cleaned</label>
                    <p className="text-gray-900 flex items-center">
                      <Calendar className="h-4 w-4 mr-1" />
                      {new Date(room.lastCleaned).toLocaleDateString()} at {new Date(room.lastCleaned).toLocaleTimeString()}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Current Booking Card */}
            {room.currentBooking && (
              <Card>
                <CardHeader>
                  <h2 className="text-lg font-semibold text-gray-900">Current Booking</h2>
                </CardHeader>
                <CardContent>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-blue-800">Check-in</label>
                        <p className="text-blue-900 font-semibold">
                          {new Date(room.currentBooking.checkIn).toLocaleDateString()}
                        </p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-blue-800">Check-out</label>
                        <p className="text-blue-900 font-semibold">
                          {new Date(room.currentBooking.checkOut).toLocaleDateString()}
                        </p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-blue-800">Booking Status</label>
                        <p className="text-blue-900 font-semibold capitalize">
                          {room.currentBooking.status.replace('_', ' ')}
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Room Images */}
            {room.images && room.images.length > 0 && (
              <Card>
                <CardHeader>
                  <h2 className="text-lg font-semibold text-gray-900">Room Images</h2>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {room.images.map((image: string, index: number) => (
                      <div key={`image-${image}`} className="aspect-video bg-gray-200 rounded-lg overflow-hidden">
                        <img
                          src={image}
                          alt={`Room ${room.roomNumber} - Image ${index + 1}`}
                          className="w-full h-full object-cover hover:scale-105 transition-transform duration-200"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = '/api/placeholder/400/300';
                          }}
                        />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <h2 className="text-lg font-semibold text-gray-900">Quick Actions</h2>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button 
                  className="w-full" 
                  variant="outline"
                  onClick={() => setShowStatusModal(true)}
                  disabled={isUpdatingStatus}
                >
                  <Settings className="h-4 w-4 mr-2" />
                  Change Status
                </Button>
                <Button 
                  className="w-full" 
                  variant="outline"
                  onClick={() => navigate(`/admin/rooms/${roomId}/bookings`)}
                >
                  <Calendar className="h-4 w-4 mr-2" />
                  View Bookings
                </Button>
                <Button 
                  className="w-full" 
                  variant="outline"
                  onClick={() => setShowMaintenanceModal(true)}
                  disabled={isUpdatingStatus}
                >
                  <Wrench className="h-4 w-4 mr-2" />
                  Schedule Maintenance
                </Button>
              </CardContent>
            </Card>

            {/* Room Stats */}
            <Card>
              <CardHeader>
                <h2 className="text-lg font-semibold text-gray-900">Room Statistics</h2>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-center p-4 bg-green-50 rounded-lg border border-green-200">
                  <p className="text-2xl font-bold text-green-600">85%</p>
                  <p className="text-sm text-green-800">Occupancy Rate</p>
                </div>
                <div className="text-center p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <p className="text-2xl font-bold text-blue-600">{formatCurrency(room.currentRate * 25)}</p>
                  <p className="text-sm text-blue-800">Revenue (This Month)</p>
                </div>
                <div className="text-center p-4 bg-purple-50 rounded-lg border border-purple-200">
                  <p className="text-2xl font-bold text-purple-600">4.8</p>
                  <p className="text-sm text-purple-800">Average Rating</p>
                </div>
              </CardContent>
            </Card>

            {/* Recent Activity */}
            <Card>
              <CardHeader>
                <h2 className="text-lg font-semibold text-gray-900">Recent Activity</h2>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-start space-x-3">
                    <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
                    <div>
                      <p className="text-sm text-gray-900">Status changed to Available</p>
                      <p className="text-xs text-gray-500">2 hours ago</p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-3">
                    <div className="w-2 h-2 bg-green-500 rounded-full mt-2"></div>
                    <div>
                      <p className="text-sm text-gray-900">Cleaning completed</p>
                      <p className="text-xs text-gray-500">4 hours ago</p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-3">
                    <div className="w-2 h-2 bg-orange-500 rounded-full mt-2"></div>
                    <div>
                      <p className="text-sm text-gray-900">Guest checked out</p>
                      <p className="text-xs text-gray-500">6 hours ago</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Status Change Modal */}
      {showStatusModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">Change Room Status</h3>
                <button aria-label="Close"
                  onClick={() => setShowStatusModal(false)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <XCircle className="w-6 h-6" />
                </button>
              </div>

              <div className="mb-4">
                <p className="text-sm text-gray-600 mb-3">
                  Current Status: <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(currentStatus)}`}>
                    {getStatusLabel(currentStatus)}
                  </span>
                </p>
                <p className="text-sm font-medium text-gray-700 mb-3">Select New Status:</p>
                <div className="grid grid-cols-2 gap-3">
                  {['vacant', 'dirty', 'maintenance', 'out_of_order'].map((status) => (
                    <button aria-label="Close"
                      key={status}
                      onClick={() => handleStatusChange(status)}
                      disabled={isUpdatingStatus || currentStatus === status}
                      className={`flex items-center justify-center p-3 border-2 rounded-lg hover:border-opacity-75 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                        status === 'vacant' ? 'border-green-300 hover:border-green-500 hover:bg-green-50' :
                        status === 'dirty' ? 'border-yellow-300 hover:border-yellow-500 hover:bg-yellow-50' :
                        status === 'maintenance' ? 'border-orange-300 hover:border-orange-500 hover:bg-orange-50' :
                        'border-gray-300 hover:border-gray-500 hover:bg-gray-50'
                      }`}
                    >
                      <div className="text-center">
                        <div className="flex items-center justify-center mb-1">
                          {getStatusIcon(status)}
                        </div>
                        <span className="text-sm font-medium text-gray-700">
                          {getStatusLabel(status)}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex justify-end space-x-3">
                <Button
                  variant="outline"
                  onClick={() => setShowStatusModal(false)}
                  disabled={isUpdatingStatus}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Maintenance Modal */}
      {showMaintenanceModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">Schedule Maintenance</h3>
                <button aria-label="Close"
                  onClick={() => setShowMaintenanceModal(false)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <XCircle className="w-6 h-6" />
                </button>
              </div>

              <div className="mb-4">
                <p className="text-sm text-gray-600 mb-4">
                  This will set the room status to "Maintenance" and add your notes.
                </p>
                
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Maintenance Notes *
                </label>
                <textarea
                  value={maintenanceNotes}
                  onChange={(e) => setMaintenanceNotes(e.target.value)}
                  placeholder="Describe the maintenance work needed..."
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div className="flex justify-end space-x-3">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowMaintenanceModal(false);
                    setMaintenanceNotes('');
                  }}
                  disabled={isUpdatingStatus}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleMaintenanceSchedule}
                  disabled={isUpdatingStatus || !maintenanceNotes.trim()}
                  className="bg-orange-600 hover:bg-orange-700 text-white"
                >
                  {isUpdatingStatus ? 'Scheduling...' : 'Schedule Maintenance'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default withErrorBoundary(RoomDetailsPage);
