import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { formatCurrency } from '@/utils/currencyUtils';
import {
  Calendar,
  Users,
  Building,
  Mail,
  Phone,
  IndianRupee,
  CheckCircle,
  XCircle,
  AlertCircle,
  Edit,
  MessageSquare,
  User,
  MapPin,
  Clock,
  FileText,
  Settings
} from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/utils/cn';
import roomBlockService, { RoomBlock } from '@/services/roomBlockService';

interface RoomBlockDetailsProps {
  roomBlock: RoomBlock;
  onUpdate: (updatedBlock: RoomBlock) => void;
  onClose: () => void;
}

const RoomBlockDetails: React.FC<RoomBlockDetailsProps> = ({
  roomBlock,
  onUpdate,
  onClose
}) => {
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(false);
  const [showReleaseDialog, setShowReleaseDialog] = useState(false);
  const [showBookDialog, setShowBookDialog] = useState(false);
  const [showAddNote, setShowAddNote] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState<unknown>(null);
  const [releaseReason, setReleaseReason] = useState('');
  const [bookingData, setBookingData] = useState({
    guestName: '',
    specialRequests: ''
  });
  const [newNote, setNewNote] = useState('');

  const getStatusBadge = (status: RoomBlock['status']) => {
    const variants = {
      active: 'bg-green-100 text-green-800 border-green-200',
      completed: 'bg-blue-100 text-blue-800 border-blue-200',
      cancelled: 'bg-red-100 text-red-800 border-red-200',
      partially_released: 'bg-yellow-100 text-yellow-800 border-yellow-200'
    };

    const icons = {
      active: <CheckCircle className="w-3 h-3" />,
      completed: <CheckCircle className="w-3 h-3" />,
      cancelled: <XCircle className="w-3 h-3" />,
      partially_released: <AlertCircle className="w-3 h-3" />
    };

    return (
      <Badge className={`${variants[status]} flex items-center gap-1 border`}>
        {icons[status]}
        {status.replace('_', ' ').toUpperCase()}
      </Badge>
    );
  };

  const getRoomStatusBadge = (status: string) => {
    const variants = {
      blocked: 'bg-blue-100 text-blue-800',
      booked: 'bg-green-100 text-green-800',
      released: 'bg-gray-100 text-gray-800'
    };

    return (
      <Badge className={`${variants[status as keyof typeof variants] || 'bg-gray-100 text-gray-800'} text-xs`}>
        {status.toUpperCase()}
      </Badge>
    );
  };

  const handleReleaseRoom = async () => {
    if (!selectedRoom) return;

    try {
      setLoading(true);
      const updatedBlock = await roomBlockService.releaseRoom(
        roomBlock._id,
        selectedRoom._id,
        releaseReason
      );
      onUpdate(updatedBlock);
      setShowReleaseDialog(false);
      setSelectedRoom(null);
      setReleaseReason('');
    } catch {
      // Error handled silently
    } finally {
      setLoading(false);
    }
  };

  const handleBookRoom = async () => {
    if (!selectedRoom || !bookingData.guestName.trim()) return;

    try {
      setLoading(true);
      const updatedBlock = await roomBlockService.bookRoom(
        roomBlock._id,
        selectedRoom._id,
        bookingData
      );
      onUpdate(updatedBlock);
      setShowBookDialog(false);
      setSelectedRoom(null);
      setBookingData({ guestName: '', specialRequests: '' });
    } catch {
      // Error handled silently
    } finally {
      setLoading(false);
    }
  };

  const handleAddNote = async () => {
    if (!newNote.trim()) return;

    try {
      setLoading(true);
      await roomBlockService.addNote(roomBlock._id, newNote, true);
      // Refresh the room block data
      const updatedBlock = await roomBlockService.getRoomBlock(roomBlock._id);
      onUpdate(updatedBlock);
      setNewNote('');
      setShowAddNote(false);
    } catch {
      // Error handled silently
    } finally {
      setLoading(false);
    }
  };

  const utilization = roomBlockService.getUtilizationPercentage(roomBlock);
  const totalRevenue = roomBlockService.calculateTotalRevenue(roomBlock);
  
  // Calculate nights for revenue calculation
  const calculateNights = () => {
    const startDate = new Date(roomBlock.startDate);
    const endDate = new Date(roomBlock.endDate);
    const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };
  
  const nights = calculateNights();
  
  // Better revenue calculation
  const estimatedRevenue = (() => {
    if (totalRevenue > 0) return totalRevenue;
    
    // Fallback: calculate from block rate or average room rates
    const avgRate = roomBlock.blockRate || 
      (roomBlock.rooms.reduce((sum, room) => sum + (room.rate || 3500), 0) / roomBlock.rooms.length) ||
      3500; // fallback rate
      
    return roomBlock.roomsBooked * avgRate * nights;
  })();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h2 className="text-2xl font-bold">{roomBlock.blockName}</h2>
            {getStatusBadge(roomBlock.status)}
          </div>
          <div className="flex items-center gap-4 text-sm text-gray-600">
            <div className="flex items-center gap-1">
              <Users className="w-4 h-4" />
              <span>{roomBlock.groupName}</span>
            </div>
            <div className="flex items-center gap-1">
              <Calendar className="w-4 h-4" />
              <span>
                {format(new Date(roomBlock.startDate), 'MMM dd')} - {format(new Date(roomBlock.endDate), 'MMM dd, yyyy')}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <Clock className="w-4 h-4" />
              <span>{nights} nights</span>
            </div>
          </div>
        </div>
        <Button variant="outline" onClick={onClose}>
          Close
        </Button>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Building className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Total Rooms</p>
                <p className="text-xl font-semibold">{roomBlock.totalRooms}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <CheckCircle className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Booked</p>
                <p className="text-xl font-semibold">{roomBlock.roomsBooked}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <AlertCircle className="w-5 h-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Available</p>
                <p className="text-xl font-semibold">{roomBlock.availableRooms}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <IndianRupee className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Utilization</p>
                <p className="text-xl font-semibold">{utilization}%</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="rooms">Rooms</TabsTrigger>
          <TabsTrigger value="contact">Contact</TabsTrigger>
          <TabsTrigger value="notes">Notes</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Event Details */}
            <Card>
              <CardHeader>
                <CardTitle>Event Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600">Event Type:</span>
                  <span className="font-medium">{roomBlockService.getEventTypeDisplayName(roomBlock.eventType)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Start Date:</span>
                  <span className="font-medium">{format(new Date(roomBlock.startDate), 'PPP')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">End Date:</span>
                  <span className="font-medium">{format(new Date(roomBlock.endDate), 'PPP')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Duration:</span>
                  <span className="font-medium">{nights} nights</span>
                </div>
                {roomBlock.blockRate && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Block Rate:</span>
                    <span className="font-medium">{formatCurrency(roomBlock.blockRate)}/night</span>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Financial Summary */}
            <Card>
              <CardHeader>
                <CardTitle>Financial Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600">Estimated Revenue:</span>
                  <span className="font-medium">{formatCurrency(estimatedRevenue)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Currency:</span>
                  <span className="font-medium">{roomBlock.currency}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Deposit Required:</span>
                  <span className="font-medium">{roomBlock.paymentTerms?.depositPercentage || 0}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Cancellation Policy:</span>
                  <span className="font-medium">{roomBlock.paymentTerms?.cancellationPolicy || 'Standard'}</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Special Instructions */}
          {roomBlock.specialInstructions && (
            <Card>
              <CardHeader>
                <CardTitle>Special Instructions</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-700">{roomBlock.specialInstructions}</p>
              </CardContent>
            </Card>
          )}

          {/* Amenities */}
          {roomBlock.amenities && roomBlock.amenities.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Included Amenities</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {roomBlock.amenities.map((amenity, index) => (
                    <Badge key={`roomBlock-amenities-${index}-${amenity}`} variant="secondary">
                      {amenity}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="rooms" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Room Details ({roomBlock.rooms.length} rooms)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {roomBlock.rooms.map((room, index) => (
                  <div key={room._id} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div>
                          <div className="font-medium">Room {room.roomNumber}</div>
                          <div className="text-sm text-gray-500">{room.roomType}</div>
                          {room.rate && <div className="text-sm text-gray-500">{formatCurrency(room.rate)}/night</div>}
                        </div>
                        {getRoomStatusBadge(room.status)}
                      </div>

                      <div className="flex items-center gap-2">
                        {room.status === 'blocked' && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setSelectedRoom(room);
                                setShowBookDialog(true);
                              }}
                            >
                              Book
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setSelectedRoom(room);
                                setShowReleaseDialog(true);
                              }}
                            >
                              Release
                            </Button>
                          </>
                        )}
                      </div>
                    </div>

                    {room.guestName && (
                      <div className="mt-2 text-sm text-gray-600">
                        <span className="font-medium">Guest:</span> {room.guestName}
                      </div>
                    )}

                    {room.specialRequests && (
                      <div className="mt-1 text-sm text-gray-600">
                        <span className="font-medium">Requests:</span> {room.specialRequests}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="contact" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Contact Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {roomBlock.contactPerson.name && (
                <div className="flex items-center gap-3">
                  <User className="w-4 h-4 text-gray-500" />
                  <div>
                    <div className="font-medium">{roomBlock.contactPerson.name}</div>
                    {roomBlock.contactPerson.title && (
                      <div className="text-sm text-gray-500">{roomBlock.contactPerson.title}</div>
                    )}
                  </div>
                </div>
              )}

              {roomBlock.contactPerson.email && (
                <div className="flex items-center gap-3">
                  <Mail className="w-4 h-4 text-gray-500" />
                  <a
                    href={`mailto:${roomBlock.contactPerson.email}`}
                    className="text-blue-600 hover:underline"
                  >
                    {roomBlock.contactPerson.email}
                  </a>
                </div>
              )}

              {roomBlock.contactPerson.phone && (
                <div className="flex items-center gap-3">
                  <Phone className="w-4 h-4 text-gray-500" />
                  <a
                    href={`tel:${roomBlock.contactPerson.phone}`}
                    className="text-blue-600 hover:underline"
                  >
                    {roomBlock.contactPerson.phone}
                  </a>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Billing Instructions</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-700 whitespace-pre-wrap">{roomBlock.billingInstructions}</p>
            </CardContent>
          </Card>

          {roomBlock.cateringRequirements && (
            <Card>
              <CardHeader>
                <CardTitle>Catering Requirements</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-700 whitespace-pre-wrap">{roomBlock.cateringRequirements}</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="notes" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                Notes & History
                <Button
                  size="sm"
                  onClick={() => setShowAddNote(true)}
                  className="flex items-center gap-2"
                >
                  <MessageSquare className="w-4 h-4" />
                  Add Note
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!roomBlock.notes || roomBlock.notes.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No notes available</p>
                  <p className="text-sm">Add the first note to track changes</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {roomBlock.notes && roomBlock.notes.map((note, index) => (
                    <div key={note._id} className="border-l-4 border-blue-200 pl-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="text-gray-700">{note.content}</p>
                          <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
                            <span>{note.createdBy.name}</span>
                            <span>•</span>
                            <span>{format(new Date(note.createdAt), 'PPp')}</span>
                            {note.isInternal && (
                              <>
                                <span>•</span>
                                <Badge variant="outline" className="text-xs">Internal</Badge>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Release Room Dialog */}
      <Dialog open={showReleaseDialog} onOpenChange={setShowReleaseDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Release Room</DialogTitle>
            <DialogDescription>
              Release room {selectedRoom?.roomNumber} from the block
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="releaseReason">Reason for Release</Label>
              <Textarea
                id="releaseReason"
                value={releaseReason}
                onChange={(e) => setReleaseReason(e.target.value)}
                placeholder="Enter reason for releasing this room"
                rows={3}
              />
            </div>
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setShowReleaseDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleReleaseRoom} disabled={loading}>
                {loading ? 'Releasing...' : 'Release Room'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Book Room Dialog */}
      <Dialog open={showBookDialog} onOpenChange={setShowBookDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Book Room</DialogTitle>
            <DialogDescription>
              Book room {selectedRoom?.roomNumber} from the block
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="guestName">Guest Name *</Label>
              <Input
                id="guestName"
                value={bookingData.guestName}
                onChange={(e) => setBookingData(prev => ({ ...prev, guestName: e.target.value }))}
                placeholder="Enter guest name"
              />
            </div>
            <div>
              <Label htmlFor="specialRequests">Special Requests</Label>
              <Textarea
                id="specialRequests"
                value={bookingData.specialRequests}
                onChange={(e) => setBookingData(prev => ({ ...prev, specialRequests: e.target.value }))}
                placeholder="Any special requests or notes"
                rows={3}
              />
            </div>
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setShowBookDialog(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleBookRoom} 
                disabled={loading || !bookingData.guestName.trim()}
              >
                {loading ? 'Booking...' : 'Book Room'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Note Dialog */}
      <Dialog open={showAddNote} onOpenChange={setShowAddNote}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Note</DialogTitle>
            <DialogDescription>
              Add a note to track changes or important information
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="newNote">Note</Label>
              <Textarea
                id="newNote"
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                placeholder="Enter your note here"
                rows={4}
              />
            </div>
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setShowAddNote(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleAddNote} 
                disabled={loading || !newNote.trim()}
              >
                {loading ? 'Adding...' : 'Add Note'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default RoomBlockDetails;