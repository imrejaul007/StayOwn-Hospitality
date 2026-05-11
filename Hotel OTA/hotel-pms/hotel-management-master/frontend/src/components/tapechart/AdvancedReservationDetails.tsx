import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { 
  Users, 
  Building, 
  Crown, 
  Calendar, 
  MapPin, 
  Phone, 
  Mail, 
  AlertTriangle, 
  CheckCircle, 
  Clock,
  TrendingUp,
  Plus,
  Edit,
  Flag,
  Bed,
  Star,
  IndianRupee
} from 'lucide-react';
import { format } from 'date-fns';
import { AdvancedReservation } from '@/services/advancedReservationsService';
import advancedReservationsService from '@/services/advancedReservationsService';
import { withErrorBoundary } from '../ErrorBoundary';
import { formatCurrency } from '@/utils/currencyUtils';

interface AdvancedReservationDetailsProps {
  reservation: AdvancedReservation;
  onUpdate: (reservation: AdvancedReservation) => void;
  onClose: () => void;
}

const AdvancedReservationDetails: React.FC<AdvancedReservationDetailsProps> = ({
  reservation,
  onUpdate,
  onClose
}) => {
  const [showAssignRoom, setShowAssignRoom] = useState(false);
  const [showAddUpgrade, setShowAddUpgrade] = useState(false);
  const [showAddFlag, setShowAddFlag] = useState(false);
  const [roomId, setRoomId] = useState('');
  const [upgradeData, setUpgradeData] = useState({
    fromRoomType: '',
    toRoomType: '',
    upgradeType: 'complimentary',
    upgradeReason: '',
    additionalCharge: 0
  });
  const [flagData, setFlagData] = useState({
    flag: 'special_attention',
    severity: 'info',
    description: '',
    expiryDate: ''
  });

  const getStatusBadge = (status: string) => {
    const statusColors = {
      pending: 'bg-yellow-100 text-yellow-800',
      confirmed: 'bg-blue-100 text-blue-800',
      completed: 'bg-green-100 text-green-800',
      cancelled: 'bg-red-100 text-red-800'
    };
    
    return (
      <Badge className={statusColors[status as keyof typeof statusColors] || 'bg-gray-100 text-gray-800'}>
        {status.toUpperCase()}
      </Badge>
    );
  };

  const getPriorityBadge = (priority: string) => {
    const priorityColors = {
      low: 'bg-gray-100 text-gray-800',
      medium: 'bg-blue-100 text-blue-800',
      high: 'bg-orange-100 text-orange-800'
    };
    
    return (
      <Badge className={priorityColors[priority as keyof typeof priorityColors] || 'bg-gray-100 text-gray-800'}>
        {priority.toUpperCase()}
      </Badge>
    );
  };

  const getFlagSeverityBadge = (severity: string) => {
    const severityColors = {
      info: 'bg-blue-100 text-blue-800',
      warning: 'bg-yellow-100 text-yellow-800',
      critical: 'bg-red-100 text-red-800'
    };
    
    return (
      <Badge className={severityColors[severity as keyof typeof severityColors] || 'bg-gray-100 text-gray-800'}>
        {severity.toUpperCase()}
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

  const handleAssignRoom = async () => {
    try {
      const updatedReservation = await advancedReservationsService.assignRoom(
        reservation._id, 
        roomId, 
        'manual', 
        'Manually assigned via admin interface'
      );
      onUpdate(updatedReservation);
      setShowAssignRoom(false);
      setRoomId('');
    } catch {
      // Error handled silently
    }
  };

  const handleAddUpgrade = async () => {
    try {
      const updatedReservation = await advancedReservationsService.addUpgrade(reservation._id, upgradeData);
      onUpdate(updatedReservation);
      setShowAddUpgrade(false);
      setUpgradeData({
        fromRoomType: '',
        toRoomType: '',
        upgradeType: 'complimentary',
        upgradeReason: '',
        additionalCharge: 0
      });
    } catch {
      // Error handled silently
    }
  };

  const handleAddFlag = async () => {
    try {
      const updatedFlags = await advancedReservationsService.addReservationFlag(reservation._id, flagData);
      const updatedReservation = { ...reservation, reservationFlags: updatedFlags };
      onUpdate(updatedReservation);
      setShowAddFlag(false);
      setFlagData({
        flag: 'special_attention',
        severity: 'info',
        description: '',
        expiryDate: ''
      });
    } catch {
      // Error handled silently
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
            {reservation.bookingId.guestName}
            <span className="text-lg text-gray-500">#{reservation.reservationId}</span>
            {getVipStatusIcon(reservation.guestProfile.vipStatus)}
          </h2>
          <p className="text-gray-600">Advanced Reservation Details</p>
        </div>
        <Button onClick={onClose} variant="outline">Close</Button>
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="guest">Guest Profile</TabsTrigger>
          <TabsTrigger value="rooms">Room Assignments</TabsTrigger>
          <TabsTrigger value="upgrades">Upgrades</TabsTrigger>
          <TabsTrigger value="requests">Special Requests</TabsTrigger>
          <TabsTrigger value="flags">Flags</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  Booking Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600">Booking Number:</span>
                  <span className="font-medium">{reservation.bookingId.bookingNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Check-in:</span>
                  <span className="font-medium">
                    {format(new Date(reservation.bookingId.checkIn), 'MMM dd, yyyy')}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Check-out:</span>
                  <span className="font-medium">
                    {format(new Date(reservation.bookingId.checkOut), 'MMM dd, yyyy')}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Status:</span>
                  <span className="font-medium">{getStatusBadge(reservation.bookingId.status)}</span>
                </div>
                {reservation.bookingId.totalAmount && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Total Amount:</span>
                    <span className="font-medium">{formatCurrency(reservation.bookingId.totalAmount)}</span>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  Reservation Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600">Type:</span>
                  <span className="font-medium">
                    <Badge className="bg-blue-100 text-blue-800">
                      {reservation.reservationType.toUpperCase().replace('_', ' ')}
                    </Badge>
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Priority:</span>
                  <span className="font-medium">{getPriorityBadge(reservation.priority)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Created:</span>
                  <span className="font-medium">
                    {format(new Date(reservation.createdAt), 'MMM dd, yyyy HH:mm')}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Last Updated:</span>
                  <span className="font-medium">
                    {format(new Date(reservation.updatedAt), 'MMM dd, yyyy HH:mm')}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Room Preferences */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bed className="w-4 h-4" />
                Room Preferences
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {reservation.roomPreferences.preferredView && (
                  <div>
                    <span className="text-gray-600 text-sm">Preferred View:</span>
                    <p className="font-medium">{reservation.roomPreferences.preferredView}</p>
                  </div>
                )}
                {reservation.roomPreferences.preferredFloor && (
                  <div>
                    <span className="text-gray-600 text-sm">Preferred Floor:</span>
                    <p className="font-medium">Floor {reservation.roomPreferences.preferredFloor}</p>
                  </div>
                )}
                <div>
                  <span className="text-gray-600 text-sm">Smoking:</span>
                  <p className="font-medium">
                    {reservation.roomPreferences.smokingPreference?.replace('_', ' ') || 'Non-smoking'}
                  </p>
                </div>
              </div>
              
              <div className="mt-4 flex flex-wrap gap-2">
                {reservation.roomPreferences.accessibleRoom && (
                  <Badge variant="outline">Accessible Room Required</Badge>
                )}
                {reservation.roomPreferences.adjacentRooms && (
                  <Badge variant="outline">Adjacent Rooms</Badge>
                )}
                {reservation.roomPreferences.connectingRooms && (
                  <Badge variant="outline">Connecting Rooms</Badge>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Quick Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <Bed className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Room Assignments</p>
                    <p className="text-xl font-semibold">{reservation.roomAssignments.length}</p>
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
                    <p className="text-xl font-semibold">{reservation.upgrades.length}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-yellow-100 rounded-lg">
                    <AlertTriangle className="w-5 h-5 text-yellow-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Special Requests</p>
                    <p className="text-xl font-semibold">{reservation.specialRequests.length}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-red-100 rounded-lg">
                    <Flag className="w-5 h-5 text-red-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Flags</p>
                    <p className="text-xl font-semibold">{reservation.reservationFlags.length}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="guest" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Crown className="w-4 h-4" />
                Guest Profile
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-gray-600 text-sm">VIP Status:</span>
                  <p className="font-medium flex items-center gap-2">
                    {getVipStatusIcon(reservation.guestProfile.vipStatus)}
                    {reservation.guestProfile.vipStatus?.toUpperCase() || 'NONE'}
                  </p>
                </div>
                {reservation.guestProfile.loyaltyNumber && (
                  <div>
                    <span className="text-gray-600 text-sm">Loyalty Number:</span>
                    <p className="font-medium">{reservation.guestProfile.loyaltyNumber}</p>
                  </div>
                )}
              </div>

              {reservation.guestProfile.preferences && (
                <div>
                  <h4 className="font-medium mb-2">Preferences</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    {reservation.guestProfile.preferences.bedType && (
                      <div>
                        <span className="text-gray-600">Bed Type:</span>
                        <p className="font-medium">{reservation.guestProfile.preferences.bedType}</p>
                      </div>
                    )}
                    {reservation.guestProfile.preferences.pillowType && (
                      <div>
                        <span className="text-gray-600">Pillow Type:</span>
                        <p className="font-medium">{reservation.guestProfile.preferences.pillowType}</p>
                      </div>
                    )}
                    {reservation.guestProfile.preferences.roomTemperature && (
                      <div>
                        <span className="text-gray-600">Room Temperature:</span>
                        <p className="font-medium">{reservation.guestProfile.preferences.roomTemperature}°F</p>
                      </div>
                    )}
                  </div>
                  
                  <div className="mt-3 flex flex-wrap gap-2">
                    {reservation.guestProfile.preferences.wakeUpCall && (
                      <Badge variant="outline">Wake Up Call</Badge>
                    )}
                    {reservation.guestProfile.preferences.turndownService && (
                      <Badge variant="outline">Turndown Service</Badge>
                    )}
                  </div>
                </div>
              )}

              {(reservation.guestProfile.allergies?.length || reservation.guestProfile.dietaryRestrictions?.length || reservation.guestProfile.specialNeeds?.length) && (
                <div>
                  <h4 className="font-medium mb-2">Special Needs</h4>
                  <div className="space-y-2">
                    {reservation.guestProfile.allergies?.length > 0 && (
                      <div>
                        <span className="text-gray-600 text-sm">Allergies:</span>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {reservation.guestProfile.allergies.map((allergy, index) => (
                            <Badge key={`reservation-guestProfile-allergies-${index}-${allergy}`} variant="outline" className="bg-red-50 text-red-700">
                              {allergy}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                    {reservation.guestProfile.dietaryRestrictions?.length > 0 && (
                      <div>
                        <span className="text-gray-600 text-sm">Dietary Restrictions:</span>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {reservation.guestProfile.dietaryRestrictions.map((restriction, index) => (
                            <Badge key={`reservation-guestProfile-dietaryRestrictions-${index}-${restriction}`} variant="outline" className="bg-orange-50 text-orange-700">
                              {restriction}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                    {reservation.guestProfile.specialNeeds?.length > 0 && (
                      <div>
                        <span className="text-gray-600 text-sm">Special Needs:</span>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {reservation.guestProfile.specialNeeds.map((need, index) => (
                            <Badge key={`reservation-guestProfile-specialNeeds-${index}-${need}`} variant="outline" className="bg-blue-50 text-blue-700">
                              {need}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="rooms" className="space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Room Assignments</h3>
            <Button onClick={() => setShowAssignRoom(true)} className="flex items-center gap-2">
              <Plus className="w-4 h-4" />
              Assign Room
            </Button>
          </div>

          {reservation.roomAssignments.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-gray-500">
                <Bed className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No room assignments yet</p>
                <p className="text-sm">Assign rooms to complete the reservation</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {reservation.roomAssignments.map((assignment, index) => (
                <Card key={assignment._id}>
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-medium text-lg">
                          Room {assignment.roomId.roomNumber}
                        </h4>
                        <p className="text-gray-600">
                          {assignment.roomId.type} • Floor {assignment.roomId.floor}
                        </p>
                        <div className="mt-2 flex items-center gap-4 text-sm text-gray-600">
                          <span>Assigned: {format(new Date(assignment.assignedDate), 'MMM dd, yyyy')}</span>
                          <Badge variant="outline">
                            {assignment.assignmentType.replace('_', ' ').toUpperCase()}
                          </Badge>
                        </div>
                        <p className="text-sm text-gray-600 mt-1">
                          By: {assignment.assignedBy.name}
                        </p>
                        {assignment.notes && (
                          <p className="text-sm text-gray-600 mt-2">{assignment.notes}</p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="upgrades" className="space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Room Upgrades</h3>
            <Button onClick={() => setShowAddUpgrade(true)} className="flex items-center gap-2">
              <Plus className="w-4 h-4" />
              Add Upgrade
            </Button>
          </div>

          {reservation.upgrades.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-gray-500">
                <TrendingUp className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No upgrades applied</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {reservation.upgrades.map((upgrade, index) => (
                <Card key={upgrade._id}>
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-medium text-lg">
                          {upgrade.fromRoomType} → {upgrade.toRoomType}
                        </h4>
                        <div className="mt-2 flex items-center gap-4">
                          <Badge className="bg-green-100 text-green-800">
                            {upgrade.upgradeType.replace('_', ' ').toUpperCase()}
                          </Badge>
                          <span className="text-sm text-gray-600">
                            {format(new Date(upgrade.upgradeDate), 'MMM dd, yyyy')}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 mt-1">
                          Approved by: {upgrade.approvedBy.name}
                        </p>
                        {upgrade.upgradeReason && (
                          <p className="text-sm text-gray-600 mt-2">{upgrade.upgradeReason}</p>
                        )}
                      </div>
                      {upgrade.additionalCharge > 0 && (
                        <div className="text-right">
                          <p className="font-semibold text-green-600">
                            +{formatCurrency(upgrade.additionalCharge)}
                          </p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="requests" className="space-y-6">
          <h3 className="text-lg font-semibold">Special Requests</h3>

          {reservation.specialRequests.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-gray-500">
                <AlertTriangle className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No special requests</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {reservation.specialRequests.map((request, index) => (
                <Card key={request._id}>
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h4 className="font-medium">
                            {request.type.replace('_', ' ').charAt(0).toUpperCase() + 
                             request.type.replace('_', ' ').slice(1)}
                          </h4>
                          {getStatusBadge(request.status)}
                          {getPriorityBadge(request.priority)}
                        </div>
                        <p className="text-gray-700 mb-2">{request.description}</p>
                        <div className="flex items-center gap-4 text-sm text-gray-600">
                          {request.assignedTo && (
                            <span>Assigned to: {request.assignedTo.name}</span>
                          )}
                          {request.dueDate && (
                            <span>Due: {format(new Date(request.dueDate), 'MMM dd, yyyy')}</span>
                          )}
                          {request.cost && (
                            <span className="font-medium text-green-600">{formatCurrency(request.cost)}</span>
                          )}
                        </div>
                        {request.notes && (
                          <p className="text-sm text-gray-600 mt-2">{request.notes}</p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="flags" className="space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Reservation Flags</h3>
            <Button onClick={() => setShowAddFlag(true)} className="flex items-center gap-2">
              <Plus className="w-4 h-4" />
              Add Flag
            </Button>
          </div>

          {reservation.reservationFlags.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-gray-500">
                <Flag className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No flags set</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {reservation.reservationFlags.map((flag, index) => (
                <Card key={flag._id}>
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="flex items-center gap-3 mb-2">
                          <h4 className="font-medium">
                            {flag.flag.replace('_', ' ').charAt(0).toUpperCase() + 
                             flag.flag.replace('_', ' ').slice(1)}
                          </h4>
                          {getFlagSeverityBadge(flag.severity)}
                        </div>
                        {flag.description && (
                          <p className="text-gray-700 mb-2">{flag.description}</p>
                        )}
                        <div className="flex items-center gap-4 text-sm text-gray-600">
                          <span>Created by: {flag.createdBy.name}</span>
                          <span>{format(new Date(flag.createdAt), 'MMM dd, yyyy')}</span>
                          {flag.expiryDate && (
                            <span>Expires: {format(new Date(flag.expiryDate), 'MMM dd, yyyy')}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Assign Room Dialog */}
      <Dialog open={showAssignRoom} onOpenChange={setShowAssignRoom}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Room</DialogTitle>
            <DialogDescription>
              Assign a room to this reservation
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="roomId">Room ID</Label>
              <Input
                id="roomId"
                value={roomId}
                onChange={(e) => setRoomId(e.target.value)}
                placeholder="Enter room ID"
              />
            </div>
            <div className="flex justify-end gap-4">
              <Button onClick={() => setShowAssignRoom(false)} variant="outline">
                Cancel
              </Button>
              <Button onClick={handleAssignRoom}>
                Assign Room
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Upgrade Dialog */}
      <Dialog open={showAddUpgrade} onOpenChange={setShowAddUpgrade}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Upgrade</DialogTitle>
            <DialogDescription>
              Add a room upgrade to this reservation
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="fromRoomType">From Room Type</Label>
                <Input
                  id="fromRoomType"
                  value={upgradeData.fromRoomType}
                  onChange={(e) => setUpgradeData(prev => ({ ...prev, fromRoomType: e.target.value }))}
                  placeholder="Current room type"
                />
              </div>
              <div>
                <Label htmlFor="toRoomType">To Room Type</Label>
                <Input
                  id="toRoomType"
                  value={upgradeData.toRoomType}
                  onChange={(e) => setUpgradeData(prev => ({ ...prev, toRoomType: e.target.value }))}
                  placeholder="Upgraded room type"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="upgradeType">Upgrade Type</Label>
              <Select
                value={upgradeData.upgradeType}
                onValueChange={(value: Record<string, unknown>) => setUpgradeData(prev => ({ ...prev, upgradeType: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="complimentary">Complimentary</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="loyalty">Loyalty</SelectItem>
                  <SelectItem value="operational">Operational</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="additionalCharge">Additional Charge</Label>
              <Input
                id="additionalCharge"
                type="number"
                value={upgradeData.additionalCharge}
                onChange={(e) => setUpgradeData(prev => ({ ...prev, additionalCharge: parseFloat(e.target.value) || 0 }))}
                placeholder="0.00"
              />
            </div>
            <div className="flex justify-end gap-4">
              <Button onClick={() => setShowAddUpgrade(false)} variant="outline">
                Cancel
              </Button>
              <Button onClick={handleAddUpgrade}>
                Add Upgrade
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Flag Dialog */}
      <Dialog open={showAddFlag} onOpenChange={setShowAddFlag}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Reservation Flag</DialogTitle>
            <DialogDescription>
              Add a flag to highlight important information about this reservation
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="flag">Flag Type</Label>
                <Select
                  value={flagData.flag}
                  onValueChange={(value: Record<string, unknown>) => setFlagData(prev => ({ ...prev, flag: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="credit_hold">Credit Hold</SelectItem>
                    <SelectItem value="no_show_risk">No Show Risk</SelectItem>
                    <SelectItem value="special_attention">Special Attention</SelectItem>
                    <SelectItem value="vip">VIP</SelectItem>
                    <SelectItem value="complainer">Complainer</SelectItem>
                    <SelectItem value="loyalty_member">Loyalty Member</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="severity">Severity</Label>
                <Select
                  value={flagData.severity}
                  onValueChange={(value: Record<string, unknown>) => setFlagData(prev => ({ ...prev, severity: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="info">Info</SelectItem>
                    <SelectItem value="warning">Warning</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label htmlFor="flagDescription">Description</Label>
              <Input
                id="flagDescription"
                value={flagData.description}
                onChange={(e) => setFlagData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Flag description"
              />
            </div>
            <div className="flex justify-end gap-4">
              <Button onClick={() => setShowAddFlag(false)} variant="outline">
                Cancel
              </Button>
              <Button onClick={handleAddFlag}>
                Add Flag
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default withErrorBoundary(AdvancedReservationDetails, { level: 'component' });