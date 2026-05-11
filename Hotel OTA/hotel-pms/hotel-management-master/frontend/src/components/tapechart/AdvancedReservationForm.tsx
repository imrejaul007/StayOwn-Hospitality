import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Plus, X, Users, Settings, Crown, Calendar, AlertTriangle } from 'lucide-react';
import advancedReservationsService, { CreateAdvancedReservationData, AdvancedReservation } from '@/services/advancedReservationsService';

interface AdvancedReservationFormProps {
  onSuccess: (reservation: AdvancedReservation) => void;
  onCancel: () => void;
  reservation?: AdvancedReservation;
}

const AdvancedReservationForm: React.FC<AdvancedReservationFormProps> = ({
  onSuccess,
  onCancel,
  reservation
}) => {
  const [formData, setFormData] = useState<CreateAdvancedReservationData>({
    bookingId: reservation?.bookingId._id || '',
    reservationType: reservation?.reservationType || 'standard',
    priority: reservation?.priority || 'medium',
    roomPreferences: reservation?.roomPreferences || {
      preferredRooms: [],
      accessibleRoom: false,
      smokingPreference: 'non_smoking'
    },
    guestProfile: reservation?.guestProfile || {
      vipStatus: 'none',
      preferences: {},
      allergies: [],
      specialNeeds: [],
      dietaryRestrictions: []
    },
    specialRequests: reservation?.specialRequests?.map(req => ({
      type: req.type,
      description: req.description,
      priority: req.priority,
      status: req.status,
      dueDate: req.dueDate,
      cost: req.cost,
      notes: req.notes
    })) || [],
    waitlistInfo: reservation?.waitlistInfo
  });

  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [availableBookings, setAvailableBookings] = useState<unknown[]>([]);
  const [loadingBookings, setLoadingBookings] = useState(false);

  useEffect(() => {
    fetchAvailableBookings();
  }, []);

  const fetchAvailableBookings = async () => {
    try {
      setLoadingBookings(true);
      const { data } = await api.get('/bookings', { params: { limit: 50 } });
      if (data.success) {
        setAvailableBookings(data.data || []);
      }
    } catch {
      // Error handled silently
    } finally {
      setLoadingBookings(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrors({});

    // Basic validation
    if (!formData.bookingId) {
      setErrors({ bookingId: 'Please select a booking' });
      setLoading(false);
      return;
    }

    try {
      let result: AdvancedReservation;
      if (reservation) {
        result = await advancedReservationsService.updateAdvancedReservation(reservation._id, formData);
      } else {
        result = await advancedReservationsService.createAdvancedReservation(formData);
      }
      onSuccess(result);
    } catch (error: unknown) {
      const axiosErr = error as { response?: { data?: { errors?: unknown; message?: string } } };

      // Handle validation errors
      if (axiosErr.response?.data?.errors) {
        if (Array.isArray(axiosErr.response.data.errors)) {
          // Handle express-validator errors
          const validationErrors: Record<string, string> = {};
          axiosErr.response.data.errors.forEach((err: Record<string, string>) => {
            validationErrors[err.path || err.param] = err.msg || err.message;
          });
          setErrors(validationErrors);
        } else {
          setErrors(axiosErr.response.data.errors as Record<string, string>);
        }
      } else if (axiosErr.response?.data?.message) {
        // Handle general error messages
        setErrors({ general: axiosErr.response.data.message });
      } else if (error instanceof Error) {
        // Handle network or other errors
        setErrors({ general: error.message });
      } else {
        // Handle unknown errors
        setErrors({ general: 'An unexpected error occurred. Please try again.' });
      }
    } finally {
      setLoading(false);
    }
  };

  const addSpecialRequest = () => {
    setFormData(prev => ({
      ...prev,
      specialRequests: [
        ...prev.specialRequests || [],
        {
          type: 'amenities',
          description: '',
          priority: 'medium',
          status: 'pending'
        }
      ]
    }));
  };

  const removeSpecialRequest = (index: number) => {
    setFormData(prev => ({
      ...prev,
      specialRequests: prev.specialRequests?.filter((_, i) => i !== index) || []
    }));
  };

  const updateSpecialRequest = (index: number, field: string, value: unknown) => {
    setFormData(prev => ({
      ...prev,
      specialRequests: prev.specialRequests?.map((req, i) => 
        i === index ? { ...req, [field]: value } : req
      ) || []
    }));
  };

  const handleArrayToggle = (section: string, field: string, item: string) => {
    setFormData(prev => {
      const currentSection = (prev as unknown)[section] || {};
      const currentArray = currentSection[field] || [];
      const newArray = currentArray.includes(item)
        ? currentArray.filter((i: string) => i !== item)
        : [...currentArray, item];
      
      return {
        ...prev,
        [section]: {
          ...currentSection,
          [field]: newArray
        }
      };
    });
  };

  const vipStatuses = ['none', 'member', 'silver', 'gold', 'platinum', 'diamond'];
  const roomTypes = ['single', 'double', 'deluxe', 'suite', 'presidential'];
  const viewTypes = ['city', 'ocean', 'mountain', 'garden', 'courtyard'];
  const bedTypes = ['single', 'double', 'queen', 'king', 'twin'];
  const pillowTypes = ['soft', 'medium', 'firm', 'memory_foam'];
  const requestTypes = ['room_setup', 'amenities', 'services', 'dining', 'transportation', 'other'];

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {errors.general && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="flex">
            <AlertTriangle className="h-4 w-4 text-red-400 mt-0.5 mr-3" />
            <div>
              <h3 className="text-sm font-medium text-red-800">Error</h3>
              <p className="text-sm text-red-700 mt-1">{errors.general}</p>
            </div>
          </div>
        </div>
      )}

      <Tabs defaultValue="basic" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="basic">Basic Info</TabsTrigger>
          <TabsTrigger value="room-prefs">Room Preferences</TabsTrigger>
          <TabsTrigger value="guest-profile">Guest Profile</TabsTrigger>
          <TabsTrigger value="requests">Special Requests</TabsTrigger>
          <TabsTrigger value="waitlist">Waitlist</TabsTrigger>
        </TabsList>

        <TabsContent value="basic" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="w-4 h-4" />
                Basic Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="bookingId">Select Booking</Label>
                  <Select
                    value={formData.bookingId}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, bookingId: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={loadingBookings ? "Loading bookings..." : "Select a booking"} />
                    </SelectTrigger>
                    <SelectContent>
                      {availableBookings.map(booking => (
                        <SelectItem key={booking._id} value={booking._id}>
                          {booking.bookingNumber} - {booking.guestName} ({booking.status})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.bookingId && <p className="text-sm text-red-500">{errors.bookingId}</p>}
                </div>

                <div>
                  <Label htmlFor="reservationType">Reservation Type</Label>
                  <Select
                    value={formData.reservationType}
                    onValueChange={(value: Record<string, unknown>) => setFormData(prev => ({ ...prev, reservationType: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="standard">Standard</SelectItem>
                      <SelectItem value="group">Group</SelectItem>
                      <SelectItem value="corporate">Corporate</SelectItem>
                      <SelectItem value="vip">VIP</SelectItem>
                      <SelectItem value="complimentary">Complimentary</SelectItem>
                      <SelectItem value="house_use">House Use</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="priority">Priority</Label>
                  <Select
                    value={formData.priority}
                    onValueChange={(value: Record<string, unknown>) => setFormData(prev => ({ ...prev, priority: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="vip">VIP</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="room-prefs" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-4 h-4" />
                Room Preferences
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="preferredView">Preferred View</Label>
                  <Select
                    value={formData.roomPreferences?.preferredView || ''}
                    onValueChange={(value) => setFormData(prev => ({
                      ...prev,
                      roomPreferences: { ...prev.roomPreferences, preferredView: value }
                    }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select view" />
                    </SelectTrigger>
                    <SelectContent>
                      {viewTypes.map(view => (
                        <SelectItem key={view} value={view}>
                          {view.charAt(0).toUpperCase() + view.slice(1)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="preferredFloor">Preferred Floor</Label>
                  <Input
                    id="preferredFloor"
                    type="number"
                    value={formData.roomPreferences?.preferredFloor || ''}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      roomPreferences: { ...prev.roomPreferences, preferredFloor: parseInt(e.target.value) }
                    }))}
                    placeholder="Floor number"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="accessibleRoom"
                    checked={formData.roomPreferences?.accessibleRoom || false}
                    onCheckedChange={(checked) => setFormData(prev => ({
                      ...prev,
                      roomPreferences: { ...prev.roomPreferences, accessibleRoom: !!checked }
                    }))}
                  />
                  <Label htmlFor="accessibleRoom">Accessible Room</Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="adjacentRooms"
                    checked={formData.roomPreferences?.adjacentRooms || false}
                    onCheckedChange={(checked) => setFormData(prev => ({
                      ...prev,
                      roomPreferences: { ...prev.roomPreferences, adjacentRooms: !!checked }
                    }))}
                  />
                  <Label htmlFor="adjacentRooms">Adjacent Rooms</Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="connectingRooms"
                    checked={formData.roomPreferences?.connectingRooms || false}
                    onCheckedChange={(checked) => setFormData(prev => ({
                      ...prev,
                      roomPreferences: { ...prev.roomPreferences, connectingRooms: !!checked }
                    }))}
                  />
                  <Label htmlFor="connectingRooms">Connecting Rooms</Label>
                </div>
              </div>

              <div>
                <Label>Smoking Preference</Label>
                <Select
                  value={formData.roomPreferences?.smokingPreference || 'non_smoking'}
                  onValueChange={(value: Record<string, unknown>) => setFormData(prev => ({
                    ...prev,
                    roomPreferences: { ...prev.roomPreferences, smokingPreference: value }
                  }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="non_smoking">Non-Smoking</SelectItem>
                    <SelectItem value="smoking">Smoking</SelectItem>
                    <SelectItem value="no_preference">No Preference</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="guest-profile" className="space-y-4">
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
                  <Label htmlFor="vipStatus">VIP Status</Label>
                  <Select
                    value={formData.guestProfile?.vipStatus || 'none'}
                    onValueChange={(value: Record<string, unknown>) => setFormData(prev => ({
                      ...prev,
                      guestProfile: { ...prev.guestProfile, vipStatus: value }
                    }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {vipStatuses.map(status => (
                        <SelectItem key={status} value={status}>
                          {status.charAt(0).toUpperCase() + status.slice(1)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="loyaltyNumber">Loyalty Number</Label>
                  <Input
                    id="loyaltyNumber"
                    value={formData.guestProfile?.loyaltyNumber || ''}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      guestProfile: { ...prev.guestProfile, loyaltyNumber: e.target.value }
                    }))}
                    placeholder="Enter loyalty number"
                  />
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="font-medium">Preferences</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="bedType">Bed Type</Label>
                    <Select
                      value={formData.guestProfile?.preferences?.bedType || ''}
                      onValueChange={(value) => setFormData(prev => ({
                        ...prev,
                        guestProfile: {
                          ...prev.guestProfile,
                          preferences: { ...prev.guestProfile?.preferences, bedType: value }
                        }
                      }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select bed type" />
                      </SelectTrigger>
                      <SelectContent>
                        {bedTypes.map(type => (
                          <SelectItem key={type} value={type}>
                            {type.charAt(0).toUpperCase() + type.slice(1)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="pillowType">Pillow Type</Label>
                    <Select
                      value={formData.guestProfile?.preferences?.pillowType || ''}
                      onValueChange={(value) => setFormData(prev => ({
                        ...prev,
                        guestProfile: {
                          ...prev.guestProfile,
                          preferences: { ...prev.guestProfile?.preferences, pillowType: value }
                        }
                      }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select pillow type" />
                      </SelectTrigger>
                      <SelectContent>
                        {pillowTypes.map(type => (
                          <SelectItem key={type} value={type}>
                            {type.replace('_', ' ').charAt(0).toUpperCase() + type.replace('_', ' ').slice(1)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="wakeUpCall"
                      checked={formData.guestProfile?.preferences?.wakeUpCall || false}
                      onCheckedChange={(checked) => setFormData(prev => ({
                        ...prev,
                        guestProfile: {
                          ...prev.guestProfile,
                          preferences: { ...prev.guestProfile?.preferences, wakeUpCall: !!checked }
                        }
                      }))}
                    />
                    <Label htmlFor="wakeUpCall">Wake Up Call</Label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="turndownService"
                      checked={formData.guestProfile?.preferences?.turndownService || false}
                      onCheckedChange={(checked) => setFormData(prev => ({
                        ...prev,
                        guestProfile: {
                          ...prev.guestProfile,
                          preferences: { ...prev.guestProfile?.preferences, turndownService: !!checked }
                        }
                      }))}
                    />
                    <Label htmlFor="turndownService">Turndown Service</Label>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="requests" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                Special Requests
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center">
                <p className="text-sm text-gray-600">Add special requests for this reservation</p>
                <Button type="button" onClick={addSpecialRequest} variant="outline" size="sm">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Request
                </Button>
              </div>

              {formData.specialRequests?.map((request, index) => (
                <div key={`-${index}-${request}`} className="border rounded-lg p-4 space-y-3">
                  <div className="flex justify-between items-start">
                    <h4 className="font-medium">Request #{index + 1}</h4>
                    <Button
                      type="button"
                      onClick={() => removeSpecialRequest(index)}
                      variant="ghost"
                      size="sm"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <Label>Type</Label>
                      <Select
                        value={request.type}
                        onValueChange={(value: Record<string, unknown>) => updateSpecialRequest(index, 'type', value)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {requestTypes.map(type => (
                            <SelectItem key={type} value={type}>
                              {type.replace('_', ' ').charAt(0).toUpperCase() + type.replace('_', ' ').slice(1)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label>Priority</Label>
                      <Select
                        value={request.priority}
                        onValueChange={(value: Record<string, unknown>) => updateSpecialRequest(index, 'priority', value)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="low">Low</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="high">High</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label>Cost</Label>
                      <Input
                        type="number"
                        value={request.cost || ''}
                        onChange={(e) => updateSpecialRequest(index, 'cost', parseFloat(e.target.value))}
                        placeholder="0.00"
                      />
                    </div>
                  </div>

                  <div>
                    <Label>Description</Label>
                    <Textarea
                      value={request.description}
                      onChange={(e) => updateSpecialRequest(index, 'description', e.target.value)}
                      placeholder="Enter request description"
                      rows={2}
                    />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="waitlist" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Waitlist Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="waitlistPosition">Waitlist Position</Label>
                  <Input
                    id="waitlistPosition"
                    type="number"
                    value={formData.waitlistInfo?.waitlistPosition || ''}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      waitlistInfo: {
                        ...prev.waitlistInfo,
                        waitlistPosition: parseInt(e.target.value)
                      }
                    }))}
                    placeholder="Position in queue"
                  />
                </div>

                <div>
                  <Label htmlFor="maxRate">Max Rate</Label>
                  <Input
                    id="maxRate"
                    type="number"
                    value={formData.waitlistInfo?.maxRate || ''}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      waitlistInfo: {
                        ...prev.waitlistInfo,
                        maxRate: parseFloat(e.target.value)
                      }
                    }))}
                    placeholder="Maximum acceptable rate"
                  />
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="font-medium">Notification Preferences</h4>
                <div className="grid grid-cols-3 gap-4">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="emailNotification"
                      checked={formData.waitlistInfo?.notificationPreferences?.email || false}
                      onCheckedChange={(checked) => setFormData(prev => ({
                        ...prev,
                        waitlistInfo: {
                          ...prev.waitlistInfo,
                          notificationPreferences: {
                            ...prev.waitlistInfo?.notificationPreferences,
                            email: !!checked
                          }
                        }
                      }))}
                    />
                    <Label htmlFor="emailNotification">Email</Label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="smsNotification"
                      checked={formData.waitlistInfo?.notificationPreferences?.sms || false}
                      onCheckedChange={(checked) => setFormData(prev => ({
                        ...prev,
                        waitlistInfo: {
                          ...prev.waitlistInfo,
                          notificationPreferences: {
                            ...prev.waitlistInfo?.notificationPreferences,
                            sms: !!checked
                          }
                        }
                      }))}
                    />
                    <Label htmlFor="smsNotification">SMS</Label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="phoneNotification"
                      checked={formData.waitlistInfo?.notificationPreferences?.phone || false}
                      onCheckedChange={(checked) => setFormData(prev => ({
                        ...prev,
                        waitlistInfo: {
                          ...prev.waitlistInfo,
                          notificationPreferences: {
                            ...prev.waitlistInfo?.notificationPreferences,
                            phone: !!checked
                          }
                        }
                      }))}
                    />
                    <Label htmlFor="phoneNotification">Phone</Label>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="flex justify-end gap-4">
        <Button type="button" onClick={onCancel} variant="outline" disabled={loading}>
          Cancel
        </Button>
        <Button type="submit" disabled={loading}>
          {loading ? 'Saving...' : reservation ? 'Update Advanced Reservation' : 'Create Advanced Reservation'}
        </Button>
      </div>
    </form>
  );
};

export default AdvancedReservationForm;