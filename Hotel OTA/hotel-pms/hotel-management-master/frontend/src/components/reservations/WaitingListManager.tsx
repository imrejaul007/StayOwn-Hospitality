import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Clock,
  Calendar,
  Users,
  Phone,
  Mail,
  Star,
  ArrowUp,
  ArrowDown,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Filter,
  Search,
  Plus,
  MessageSquare,
  Bell,
  Loader2
} from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/use-toast';
import { withErrorBoundary } from '../ErrorBoundary';

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && error !== null && 'message' in error) return String((error as Record<string, unknown>).message);
  return 'An unexpected error occurred';
};

import waitingListService, {
  WaitingListEntry,
  RoomAvailability,
  CreateWaitingListEntryData,
  WaitingListFilters
} from '@/services/waitingListService';

// Interface is now imported from the service

export const WaitingListManager: React.FC = () => {
  const [waitingList, setWaitingList] = useState<WaitingListEntry[]>([]);
  const [selectedEntry, setSelectedEntry] = useState<WaitingListEntry | null>(null);
  const [roomAvailability, setRoomAvailability] = useState<RoomAvailability[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [showAddEntry, setShowAddEntry] = useState(false);
  const [pagination, setPagination] = useState({
    current: 1,
    pages: 1,
    total: 0
  });
  const [filters, setFilters] = useState<WaitingListFilters>({
    page: 1,
    limit: 20,
    sortBy: 'priority_score',
    sortOrder: 'desc'
  });
  const [newEntry, setNewEntry] = useState<CreateWaitingListEntryData>({
    guestName: '',
    email: '',
    phone: '',
    roomType: '',
    preferredDates: { checkIn: '', checkOut: '' },
    guests: 2,
    priority: 'medium',
    vipStatus: false,
    specialRequests: '',
    contactPreference: 'email',
    source: 'direct'
  });

  // Fetch data on component mount and when filters change
  useEffect(() => {
    fetchWaitingList();
    fetchRoomAvailability();
  }, [filters]);

  // Fetch waiting list data
  const fetchWaitingList = async () => {
    try {
      setLoading(true);
      const searchFilters: WaitingListFilters = { ...filters };

      if (searchTerm.trim()) {
        searchFilters.search = searchTerm.trim();
      }

      if (statusFilter !== 'all') {
        searchFilters.status = statusFilter;
      }

      if (priorityFilter !== 'all') {
        searchFilters.priority = priorityFilter;
      }

      const response = await waitingListService.getWaitingList(searchFilters);
      setWaitingList(response.data);
      setPagination(response.pagination);
    } catch (error: unknown) {
      toast({
        title: "Error",
        description: "Failed to load waiting list entries",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  // Fetch room availability
  const fetchRoomAvailability = async () => {
    try {
      const availability = await waitingListService.getRoomAvailability();
      setRoomAvailability(availability);
    } catch (error: unknown) {
      // Service already provides fallback data on error
    }
  };

  // Handle search and filter
  const handleSearch = () => {
    setFilters(prev => ({ ...prev, page: 1 }));
    fetchWaitingList();
  };

  const updateEntryStatus = async (entryId: string, newStatus: WaitingListEntry['status']) => {
    try {
      setActionLoading(`status-${entryId}`);
      const updatedEntry = await waitingListService.updateStatus(entryId, newStatus);

      // Update local state
      setWaitingList(waitingList.map(entry =>
        entry._id === entryId ? updatedEntry : entry
      ));

      if (selectedEntry && selectedEntry._id === entryId) {
        setSelectedEntry(updatedEntry);
      }

      toast({
        title: "Status Updated",
        description: `Entry marked as ${newStatus}`
      });
    } catch (error: unknown) {
      toast({
        title: "Error",
        description: getErrorMessage(error),
        variant: "destructive"
      });
    } finally {
      setActionLoading(null);
    }
  };

  const updatePriority = async (entryId: string, newPriority: WaitingListEntry['priority']) => {
    try {
      setActionLoading(`priority-${entryId}`);
      const updatedEntry = await waitingListService.updatePriority(entryId, newPriority);

      // Update local state
      setWaitingList(waitingList.map(entry =>
        entry._id === entryId ? updatedEntry : entry
      ));

      if (selectedEntry && selectedEntry._id === entryId) {
        setSelectedEntry(updatedEntry);
      }

      toast({
        title: "Priority Updated",
        description: `Priority changed to ${newPriority}`
      });
    } catch (error: unknown) {
      toast({
        title: "Error",
        description: getErrorMessage(error),
        variant: "destructive"
      });
    } finally {
      setActionLoading(null);
    }
  };

  const addNote = async (entryId: string, note: string) => {
    if (!note.trim()) return;

    try {
      setActionLoading(`note-${entryId}`);
      const updatedEntry = await waitingListService.addNote(entryId, note, true);

      // Update local state
      setWaitingList(waitingList.map(entry =>
        entry._id === entryId ? updatedEntry : entry
      ));

      if (selectedEntry && selectedEntry._id === entryId) {
        setSelectedEntry(updatedEntry);
      }

      toast({
        title: "Note Added",
        description: "Note has been added to the entry"
      });
    } catch (error: unknown) {
      toast({
        title: "Error",
        description: getErrorMessage(error),
        variant: "destructive"
      });
    } finally {
      setActionLoading(null);
    }
  };

  const removeFromWaitingList = async (entryId: string) => {
    try {
      setActionLoading(`delete-${entryId}`);
      await waitingListService.deleteWaitingListEntry(entryId);

      setWaitingList(waitingList.filter(entry => entry._id !== entryId));
      setSelectedEntry(null);

      toast({
        title: "Entry Removed",
        description: "Entry has been removed from waiting list"
      });
    } catch (error: unknown) {
      toast({
        title: "Error",
        description: getErrorMessage(error),
        variant: "destructive"
      });
    } finally {
      setActionLoading(null);
    }
  };

  const addNewEntry = async () => {
    if (!newEntry.guestName || !newEntry.email || !newEntry.roomType || !newEntry.preferredDates.checkIn || !newEntry.preferredDates.checkOut) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive"
      });
      return;
    }

    try {
      setActionLoading('add-entry');
      const createdEntry = await waitingListService.createWaitingListEntry(newEntry);

      setWaitingList([createdEntry, ...waitingList]);
      setNewEntry({
        guestName: '',
        email: '',
        phone: '',
        roomType: '',
        preferredDates: { checkIn: '', checkOut: '' },
        guests: 2,
        priority: 'medium',
        vipStatus: false,
        specialRequests: '',
        contactPreference: 'email',
        source: 'direct'
      });
      setShowAddEntry(false);

      toast({
        title: "Entry Added",
        description: "New waiting list entry has been created"
      });

      // Refresh the list to ensure proper pagination
      fetchWaitingList();
    } catch (error: unknown) {
      toast({
        title: "Error",
        description: getErrorMessage(error),
        variant: "destructive"
      });
    } finally {
      setActionLoading(null);
    }
  };

  const sendNotification = async (entry: WaitingListEntry) => {
    try {
      setActionLoading(`notify-${entry._id}`);
      const result = await waitingListService.sendAvailabilityNotification(entry._id);

      toast({
        title: "Notification Sent",
        description: `Room availability notification sent to ${entry.guestName} via ${result.method}`
      });
    } catch (error: unknown) {
      toast({
        title: "Error",
        description: getErrorMessage(error),
        variant: "destructive"
      });
    } finally {
      setActionLoading(null);
    }
  };

  const checkAvailabilityMatch = (entry: WaitingListEntry) => {
    const roomAvail = roomAvailability.find(r => r.roomType === entry.roomType);
    return roomAvail && roomAvail.available > 0;
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-500';
      case 'medium': return 'bg-yellow-500';
      case 'low': return 'bg-green-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'default';
      case 'contacted': return 'secondary';
      case 'confirmed': return 'default';
      case 'expired': return 'destructive';
      case 'cancelled': return 'outline';
      default: return 'secondary';
    }
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold tracking-tight">Waiting List Manager</h2>
        <div className="flex gap-2">
          <Button onClick={() => setShowAddEntry(true)} className="flex items-center">
            <Plus className="mr-2 h-4 w-4" />
            Add Entry
          </Button>
          <Button variant="outline">
            <Bell className="mr-2 h-4 w-4" />
            Send Notifications
          </Button>
        </div>
      </div>

      {/* Room Availability Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Calendar className="mr-2 h-5 w-5" />
            Current Room Availability
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {roomAvailability.map(room => (
              <div key={room.roomType} className="text-center p-4 bg-muted rounded-lg">
                <div className="font-medium text-sm">{room.roomType}</div>
                <div className="text-2xl font-bold mt-2">
                  <span className={room.available > 0 ? 'text-green-600' : 'text-red-600'}>
                    {room.available}
                  </span>
                  <span className="text-muted-foreground text-sm">/{room.total}</span>
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  Next: {room.nextAvailable}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Filters and Search */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search guests..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleSearch();
                  }
                }}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Status filter" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="contacted">Contacted</SelectItem>
                <SelectItem value="confirmed">Confirmed</SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Priority filter" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Priority</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>
            <div className="text-sm text-muted-foreground flex items-center">
              <Filter className="mr-2 h-4 w-4" />
              {pagination.total} entries
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Waiting List Entries */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          {loading ? (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="h-8 w-8 animate-spin" />
              <span className="ml-2">Loading waiting list...</span>
            </div>
          ) : (() => {
            // Filter the waitingList based on current filters
            const filteredList = waitingList.filter(entry => {
              const matchesSearch = !searchTerm ||
                entry.guestName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                entry.email.toLowerCase().includes(searchTerm.toLowerCase());
              const matchesStatus = statusFilter === 'all' || entry.status === statusFilter;
              const matchesPriority = priorityFilter === 'all' || entry.priority === priorityFilter;
              return matchesSearch && matchesStatus && matchesPriority;
            });

            if (filteredList.length === 0) {
              return (
                <Card>
                  <CardContent className="p-8 text-center text-muted-foreground">
                    No waiting list entries match your filters
                  </CardContent>
                </Card>
              );
            }

            return filteredList.map(entry => (
            <Card
              key={entry._id}
              className={`cursor-pointer transition-colors ${
                selectedEntry?._id === entry._id ? 'border-blue-500' : ''
              } ${checkAvailabilityMatch(entry) ? 'border-l-4 border-l-green-500' : ''}`}
              onClick={() => setSelectedEntry(entry)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center text-lg">
                    {entry.vipStatus && <Star className="mr-2 h-4 w-4 text-yellow-500" />}
                    {entry.guestName}
                    {entry.loyaltyTier && (
                      <Badge variant="secondary" className="ml-2 text-xs">
                        {entry.loyaltyTier}
                      </Badge>
                    )}
                  </CardTitle>
                  <div className="flex items-center space-x-2">
                    <div className={`w-3 h-3 rounded-full ${getPriorityColor(entry.priority)}`} />
                    <Badge variant={getStatusColor(entry.status) as unknown}>
                      {entry.status}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex items-center text-sm text-muted-foreground">
                    <Calendar className="mr-2 h-4 w-4" />
                    {entry.preferredDates.checkIn} to {entry.preferredDates.checkOut}
                  </div>
                  <div className="flex items-center text-sm text-muted-foreground">
                    <Users className="mr-2 h-4 w-4" />
                    {entry.guests} guests • {entry.roomType}
                  </div>
                  <div className="flex items-center text-sm text-muted-foreground">
                    <Clock className="mr-2 h-4 w-4" />
                    Added: {entry.addedDate}
                    {entry.lastContact && ` • Last contact: ${entry.lastContact}`}
                  </div>
                  {checkAvailabilityMatch(entry) && (
                    <div className="flex items-center text-sm text-green-600 font-medium">
                      <CheckCircle className="mr-2 h-4 w-4" />
                      Room Available Now!
                    </div>
                  )}
                  {entry.maxRate && (
                    <div className="text-sm text-muted-foreground">
                      Max rate: ${entry.maxRate}/night
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ));
          })()}
        </div>

        {/* Entry Details */}
        <div>
          {selectedEntry ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Entry Details</span>
                  <div className="flex space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => updatePriority(selectedEntry._id, 'high')}
                      disabled={selectedEntry.priority === 'high' || actionLoading === `priority-${selectedEntry._id}`}
                    >
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => updatePriority(selectedEntry._id, 'low')}
                      disabled={selectedEntry.priority === 'low' || actionLoading === `priority-${selectedEntry._id}`}
                    >
                      <ArrowDown className="h-4 w-4" />
                    </Button>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Contact Information */}
                <div>
                  <h4 className="font-medium mb-2">Contact Information</h4>
                  <div className="space-y-1 text-sm">
                    <div className="flex items-center">
                      <Mail className="mr-2 h-4 w-4" />
                      {selectedEntry.email}
                    </div>
                    <div className="flex items-center">
                      <Phone className="mr-2 h-4 w-4" />
                      {selectedEntry.phone || 'Not provided'}
                    </div>
                    <div className="text-muted-foreground">
                      Preferred contact: {selectedEntry.contactPreference}
                    </div>
                  </div>
                </div>

                {/* Booking Details */}
                <div>
                  <h4 className="font-medium mb-2">Booking Details</h4>
                  <div className="space-y-1 text-sm">
                    <div>Room Type: {selectedEntry.roomType}</div>
                    <div>Guests: {selectedEntry.guests}</div>
                    <div>Preferred: {selectedEntry.preferredDates.checkIn} to {selectedEntry.preferredDates.checkOut}</div>
                    {selectedEntry.alternativeDates && selectedEntry.alternativeDates.length > 0 && (
                      <div>
                        Alternative dates:
                        {selectedEntry.alternativeDates.map((dates, idx) => (
                          <div key={idx} className="ml-4 text-muted-foreground">
                            • {dates.checkIn} to {dates.checkOut}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Special Requests */}
                {selectedEntry.specialRequests && (
                  <div>
                    <h4 className="font-medium mb-2">Special Requests</h4>
                    <p className="text-sm text-muted-foreground">{selectedEntry.specialRequests}</p>
                  </div>
                )}

                {/* Notes */}
                <div>
                  <h4 className="font-medium mb-2">Notes</h4>
                  <div className="space-y-1">
                    {selectedEntry.notes.map((note, idx) => (
                      <div key={idx} className="text-sm bg-muted p-2 rounded">
                        <div className="flex justify-between items-start mb-1">
                          <span className="text-xs text-muted-foreground">
                            {note.createdBy.name} • {new Date(note.createdAt).toLocaleDateString()}
                          </span>
                          {note.isInternal && (
                            <Badge variant="outline" className="text-xs">Internal</Badge>
                          )}
                        </div>
                        {note.content}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Actions */}
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => updateEntryStatus(selectedEntry._id, 'contacted')}
                      disabled={selectedEntry.status === 'contacted' || actionLoading === `status-${selectedEntry._id}`}
                    >
                      <MessageSquare className="mr-2 h-4 w-4" />
                      Mark Contacted
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => sendNotification(selectedEntry)}
                    >
                      <Bell className="mr-2 h-4 w-4" />
                      Notify Available
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => updateEntryStatus(selectedEntry._id, 'confirmed')}
                      disabled={selectedEntry.status === 'confirmed' || actionLoading === `status-${selectedEntry._id}`}
                    >
                      <CheckCircle className="mr-2 h-4 w-4" />
                      Confirm Booking
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => removeFromWaitingList(selectedEntry._id)}
                      disabled={actionLoading === `delete-${selectedEntry._id}`}
                    >
                      <XCircle className="mr-2 h-4 w-4" />
                      Remove Entry
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                Select an entry to view details
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Add Entry Modal */}
      {showAddEntry && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <CardTitle>Add New Waiting List Entry</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  placeholder="Guest Name *"
                  value={newEntry.guestName}
                  onChange={(e) => setNewEntry({...newEntry, guestName: e.target.value})}
                />
                <Input
                  placeholder="Email *"
                  type="email"
                  value={newEntry.email}
                  onChange={(e) => setNewEntry({...newEntry, email: e.target.value})}
                />
                <Input
                  placeholder="Phone"
                  value={newEntry.phone}
                  onChange={(e) => setNewEntry({...newEntry, phone: e.target.value})}
                />
                <Select
                  value={newEntry.roomType}
                  onValueChange={(value) => setNewEntry({...newEntry, roomType: value})}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Room Type *" />
                  </SelectTrigger>
                  <SelectContent>
                    {roomAvailability.map(room => (
                      <SelectItem key={room.roomType} value={room.roomType}>
                        {room.roomType}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  placeholder="Check-in Date"
                  type="date"
                  value={newEntry.preferredDates?.checkIn}
                  onChange={(e) => setNewEntry({
                    ...newEntry,
                    preferredDates: {...newEntry.preferredDates!, checkIn: e.target.value}
                  })}
                />
                <Input
                  placeholder="Check-out Date"
                  type="date"
                  value={newEntry.preferredDates?.checkOut}
                  onChange={(e) => setNewEntry({
                    ...newEntry,
                    preferredDates: {...newEntry.preferredDates!, checkOut: e.target.value}
                  })}
                />
                <Input
                  placeholder="Number of Guests"
                  type="number"
                  min="1"
                  value={newEntry.guests}
                  onChange={(e) => setNewEntry({...newEntry, guests: parseInt(e.target.value) || 1})}
                />
                <Select
                  value={newEntry.priority}
                  onValueChange={(value: Record<string, unknown>) => setNewEntry({...newEntry, priority: value})}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Priority" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  placeholder="Max Rate (optional)"
                  type="number"
                  value={newEntry.maxRate || ''}
                  onChange={(e) => setNewEntry({...newEntry, maxRate: parseFloat(e.target.value) || undefined})}
                />
                <Select
                  value={newEntry.contactPreference}
                  onValueChange={(value: Record<string, unknown>) => setNewEntry({...newEntry, contactPreference: value})}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Contact Preference" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="phone">Phone</SelectItem>
                    <SelectItem value="sms">SMS</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Textarea
                placeholder="Special Requests"
                value={newEntry.specialRequests}
                onChange={(e) => setNewEntry({...newEntry, specialRequests: e.target.value})}
              />
              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setShowAddEntry(false)}>
                  Cancel
                </Button>
                <Button onClick={addNewEntry}>
                  Add Entry
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default withErrorBoundary(WaitingListManager, { level: 'component' });