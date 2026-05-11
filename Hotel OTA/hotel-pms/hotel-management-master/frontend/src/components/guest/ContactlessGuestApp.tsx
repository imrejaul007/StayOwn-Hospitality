import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Smartphone,
  QrCode,
  Key,
  Car,
  Utensils,
  Heart,
  ConciergeBell,
  MessageSquare,
  Clock,
  Settings,
  Calendar,
  Coffee,
  Dumbbell,
  Phone,
  AlertCircle,
  Download,
  Share2,
  Loader2
} from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/use-toast';
import { withErrorBoundary } from '../ErrorBoundary';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { api } from '@/services/api';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { resolvePublicHotelId } from '@/utils/publicBookingHotel';
import GuestChatPanelWeb from './GuestChatPanelWeb';

interface GuestProfile {
  id: string;
  name: string;
  email: string;
  phone: string;
  roomNumber: string;
  checkIn: string;
  checkOut: string;
  loyaltyTier: string;
  preferences: {
    roomTemp: number;
    wakeUpCall: string;
    pillow: string;
    newspaper: string;
    housekeeping: string;
  };
  keylessEntry: boolean;
  notifications: boolean;
}

interface ServiceRequest {
  id: string;
  service: string;
  category: string;
  description: string;
  requestTime: string;
  status: 'pending' | 'in_progress' | 'completed';
  estimatedTime?: string;
  priority: 'low' | 'medium' | 'high';
}

interface DigitalKey {
  id: string;
  roomNumber: string;
  isActive: boolean;
  expiresAt: string;
  accessCount: number;
  lastUsed?: string;
}

interface HotelService {
  id: string;
  name: string;
  type?: string;
  category: string;
  description: string;
  icon: React.ComponentType<unknown>;
  available: boolean;
  hours: string;
  price?: number;
}

const SERVICE_ICON_MAP: Record<string, React.ComponentType<unknown>> = {
  'F&B': Utensils,
  'Spa': Heart,
  'Concierge': ConciergeBell,
  'Parking': Car,
  'Fitness': Dumbbell,
  'Business': Settings,
  'Room': Coffee,
};

const ContactlessGuestApp: React.FC = () => {
  const [activeTab, setActiveTab] = useState('home');
  const [guestProfile, setGuestProfile] = useState<GuestProfile | null>(null);
  const [serviceRequests, setServiceRequests] = useState<ServiceRequest[]>([]);
  const [digitalKey, setDigitalKey] = useState<DigitalKey | null>(null);
  const [hotelServices, setHotelServices] = useState<HotelService[]>([]);
  const [activeBookingId, setActiveBookingId] = useState<string>('');
  const [newRequest, setNewRequest] = useState({ service: '', description: '', category: '' });
  const [loadingState, setLoadingState] = useState({ profile: true, services: true, key: true, requests: true });
  const isMountedRef = useRef(true);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { data: currentUser } = useCurrentUser();

  useEffect(() => {
    return () => { isMountedRef.current = false; };
  }, []);

  // Build guest profile from auth context user data
  useEffect(() => {
    if (currentUser) {
      setGuestProfile({
        id: currentUser._id || currentUser.id || '',
        name: currentUser?.name || '',
        email: currentUser?.email || '',
        phone: currentUser?.phone || '',
        roomNumber: '', // Available from active booking, not user object
        checkIn: '',
        checkOut: '',
        loyaltyTier: currentUser?.loyalty?.tier || 'bronze',
        preferences: {
          roomTemp: 22,
          wakeUpCall: '',
          pillow: 'Soft',
          newspaper: 'None',
          housekeeping: ''
        },
        keylessEntry: false,
        notifications: true
      });
      setLoadingState(prev => ({ ...prev, profile: false }));
    } else {
      setLoadingState(prev => ({ ...prev, profile: false }));
    }
  }, [currentUser]);

  // Fetch service requests from API
  const fetchServiceRequests = useCallback(async () => {
    try {
      const response = await api.get('/guest-services', { params: { limit: 10 } });
      if (!isMountedRef.current) return;
      const data = response.data?.data?.serviceRequests || response.data?.serviceRequests || response.data || [];
      const normalized = (Array.isArray(data) ? data : []).map((item: Record<string, unknown>) => ({
        id: String(item._id || item.id || ''),
        service: String(item.serviceVariation || item.title || item.serviceType || ''),
        category: String(item.serviceType || item.category || 'other'),
        description: String(item.description || ''),
        requestTime: String(item.createdAt || item.requestTime || new Date().toISOString()),
        status: (item.status as ServiceRequest['status']) || 'pending',
        estimatedTime: item.estimatedTime ? String(item.estimatedTime) : undefined,
        priority: (item.priority as ServiceRequest['priority']) || 'medium'
      }));
      setServiceRequests(normalized);
    } catch {
      if (isMountedRef.current) setServiceRequests([]);
    } finally {
      if (isMountedRef.current) setLoadingState(prev => ({ ...prev, requests: false }));
    }
  }, []);

  // Fetch digital key from API
  const fetchDigitalKey = useCallback(async () => {
    try {
      const response = await api.get('/digital-keys', { params: { limit: 1, status: 'active' } });
      if (!isMountedRef.current) return;
      const list = response.data?.data?.keys || response.data?.keys || [];
      const data = Array.isArray(list) && list.length > 0 ? list[0] : null;
      setDigitalKey(data);
    } catch {
      if (isMountedRef.current) setDigitalKey(null);
    } finally {
      if (isMountedRef.current) setLoadingState(prev => ({ ...prev, key: false }));
    }
  }, []);

  // Resolve current booking context for guest-service creation
  const fetchActiveBooking = useCallback(async () => {
    try {
      const response = await api.get('/bookings', { params: { page: 1, limit: 1, status: 'checked_in' } });
      if (!isMountedRef.current) return;
      const checkedIn = response.data?.data?.bookings || response.data?.bookings || [];
      if (Array.isArray(checkedIn) && checkedIn[0]?._id) {
        setActiveBookingId(String(checkedIn[0]._id));
        return;
      }

      const fallback = await api.get('/bookings', { params: { page: 1, limit: 1, status: 'confirmed' } });
      const confirmed = fallback.data?.data?.bookings || fallback.data?.bookings || [];
      if (Array.isArray(confirmed) && confirmed[0]?._id) {
        setActiveBookingId(String(confirmed[0]._id));
      }
    } catch {
      if (isMountedRef.current) setActiveBookingId('');
    }
  }, []);

  // Fetch hotel services from API
  const fetchHotelServices = useCallback(async () => {
    try {
      const hotelId = resolvePublicHotelId(searchParams);
      const response = await api.get('/hotel-services', {
        params: { page: 1, limit: 50, hotelId }
      });
      if (!isMountedRef.current) return;
      const rawServices = response.data?.data || response.data?.services || response.data || [];
      const services: HotelService[] = (Array.isArray(rawServices) ? rawServices : []).map(
        (svc: Record<string, unknown>) => ({
          id: (svc._id || svc.id || '') as string,
          name: (svc.name || '') as string,
          type: (svc.type || '') as string,
          category: ((svc.category || svc.type || '') as string),
          description: (svc.description || '') as string,
          icon: SERVICE_ICON_MAP[((svc.category || svc.type) as string) || ''] || ConciergeBell,
          available: svc.available !== false,
          hours: (svc.hours || svc.operatingHours || '') as string,
          price: svc.price as number | undefined,
        })
      );
      setHotelServices(services);
    } catch {
      if (isMountedRef.current) setHotelServices([]);
    } finally {
      if (isMountedRef.current) setLoadingState(prev => ({ ...prev, services: false }));
    }
  }, [searchParams]);

  useEffect(() => {
    fetchServiceRequests();
    fetchDigitalKey();
    fetchHotelServices();
    fetchActiveBooking();
  }, [fetchServiceRequests, fetchDigitalKey, fetchHotelServices, fetchActiveBooking]);

  const requestService = async () => {
    if (!newRequest.service || !newRequest.description) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive"
      });
      return;
    }
    if (!activeBookingId) {
      toast({
        title: "No active booking",
        description: "A confirmed or checked-in booking is required to place service requests.",
        variant: "destructive"
      });
      return;
    }

    try {
      const selectedService = hotelServices.find((svc) => svc.name === newRequest.service);
      const mappedType = (selectedService?.type || selectedService?.category || '').toLowerCase();
      const validTypes = ['room_service', 'housekeeping', 'maintenance', 'concierge', 'transport', 'spa', 'laundry'];
      const serviceType = validTypes.includes(mappedType) ? mappedType : 'other';

      const response = await api.post('/guest-services', {
        bookingId: activeBookingId,
        serviceType,
        serviceVariation: newRequest.service,
        description: newRequest.description,
        priority: 'medium'
      });

      const created = response.data?.data || response.data?.serviceRequest || response.data;
      if (created) {
        const normalized = {
          id: String(created._id || created.id || ''),
          service: String(created.serviceVariation || created.title || created.serviceType || ''),
          category: String(created.serviceType || 'other'),
          description: String(created.description || ''),
          requestTime: String(created.createdAt || new Date().toISOString()),
          status: (created.status as ServiceRequest['status']) || 'pending',
          estimatedTime: created.estimatedTime ? String(created.estimatedTime) : undefined,
          priority: (created.priority as ServiceRequest['priority']) || 'medium'
        };
        setServiceRequests(prev => [...prev, normalized]);
      }
      setNewRequest({ service: '', description: '', category: '' });

      toast({
        title: "Service Requested",
        description: "Your request has been submitted to our staff"
      });
    } catch {
      toast({
        title: "Error",
        description: "Failed to submit service request. Please try again.",
        variant: "destructive"
      });
    }
  };

  const activateDigitalKey = () => {
    if (digitalKey) {
      setDigitalKey({ ...digitalKey, isActive: true, lastUsed: new Date().toISOString() });
      toast({
        title: "Digital Key Activated",
        description: "Your room key is now active"
      });
    }
  };

  const scanQRCode = () => {
    // Navigate to the QR scanner page
    navigate('/scan');
  };

  const updatePreferences = (key: string, value: unknown) => {
    if (guestProfile) {
      setGuestProfile({
        ...guestProfile,
        preferences: {
          ...guestProfile.preferences,
          [key]: value
        }
      });
      
      toast({
        title: "Preferences Updated",
        description: "Your preferences have been saved"
      });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'default';
      case 'in_progress': return 'secondary';
      case 'pending': return 'destructive';
      default: return 'secondary';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'text-red-500';
      case 'medium': return 'text-yellow-500';
      case 'low': return 'text-green-500';
      default: return 'text-gray-500';
    }
  };

  const renderHomeTab = () => (
    <div className="space-y-6">
      {/* Welcome Card */}
      <Card className="bg-gradient-to-r from-blue-500 to-purple-600 text-white">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold">Welcome back, {guestProfile?.name}</h2>
              <p className="text-blue-100">Room {guestProfile?.roomNumber} • {guestProfile?.loyaltyTier} Member</p>
            </div>
            <div className="text-right">
              <div className="text-sm text-blue-100">Check-out</div>
              <div className="text-lg font-semibold">{guestProfile?.checkOut}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Button
              variant="outline"
              className="h-20 flex-col space-y-2"
              onClick={() => setActiveTab('key')}
            >
              <Key className="h-6 w-6" />
              <span>Digital Key</span>
            </Button>
            <Button
              variant="outline"
              className="h-20 flex-col space-y-2"
              onClick={() => setActiveTab('services')}
            >
              <ConciergeBell className="h-6 w-6" />
              <span>Services</span>
            </Button>
            <Button
              variant="outline"
              className="h-20 flex-col space-y-2"
              onClick={scanQRCode}
            >
              <QrCode className="h-6 w-6" />
              <span>Scan QR</span>
            </Button>
            <Button
              variant="outline"
              className="h-20 flex-col space-y-2"
              onClick={() => setActiveTab('chat')}
            >
              <MessageSquare className="h-6 w-6" />
              <span>Chat</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Recent Requests */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Requests</CardTitle>
        </CardHeader>
        <CardContent>
          {serviceRequests.length === 0 ? (
            <div className="text-center py-4 text-sm text-muted-foreground">
              No service requests yet. Use the Services tab to make a request.
            </div>
          ) : (
            <div className="space-y-3">
              {serviceRequests.slice(0, 3).map(request => (
                <div key={request.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex-1">
                    <div className="font-medium">{request.service}</div>
                    <div className="text-sm text-muted-foreground">{request.description}</div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Badge variant={getStatusColor(request.status) as unknown}>
                      {request.status}
                    </Badge>
                    <div className={`w-2 h-2 rounded-full ${getPriorityColor(request.priority)}`} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Hotel Services */}
      <Card>
        <CardHeader>
          <CardTitle>Available Services</CardTitle>
        </CardHeader>
        <CardContent>
          {hotelServices.length === 0 ? (
            <div className="text-center py-4 text-sm text-muted-foreground">
              No hotel services available at this time.
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {hotelServices.slice(0, 6).map(service => {
                const Icon = service.icon;
                return (
                  <div key={service.id} className="p-3 border rounded-lg text-center">
                    <Icon className="h-8 w-8 mx-auto mb-2 text-blue-500" />
                    <div className="font-medium text-sm">{service.name}</div>
                    <div className="text-xs text-muted-foreground">{service.hours}</div>
                    {service.price && (
                      <div className="text-xs font-medium text-green-600">${service.price}</div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );

  const renderDigitalKeyTab = () => (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Key className="mr-2 h-5 w-5" />
            Digital Room Key
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!digitalKey && !loadingState.key && (
            <div className="text-center py-8 text-muted-foreground">
              <Key className="h-12 w-12 mx-auto mb-3 text-gray-300" />
              <p>No digital key available for your stay.</p>
              <p className="text-sm mt-1">Please contact the front desk for assistance.</p>
            </div>
          )}
          {digitalKey && (
            <div className="space-y-6">
              {/* Key Status */}
              <div className="text-center">
                <div className={`w-32 h-32 mx-auto rounded-full flex items-center justify-center text-white text-4xl ${
                  digitalKey.isActive ? 'bg-green-500' : 'bg-gray-400'
                }`}>
                  <Key className="h-16 w-16" />
                </div>
                <div className="mt-4">
                  <div className="text-2xl font-bold">Room {digitalKey.roomNumber}</div>
                  <Badge variant={digitalKey.isActive ? 'default' : 'secondary'} className="mt-2">
                    {digitalKey.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
              </div>

              {/* Key Information */}
              <div className="grid grid-cols-2 gap-4">
                <Card>
                  <CardContent className="p-4 text-center">
                    <Calendar className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
                    <div className="text-sm text-muted-foreground">Expires</div>
                    <div className="font-medium">{new Date(digitalKey.expiresAt).toLocaleDateString()}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <Clock className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
                    <div className="text-sm text-muted-foreground">Last Used</div>
                    <div className="font-medium">
                      {digitalKey.lastUsed 
                        ? new Date(digitalKey.lastUsed).toLocaleTimeString()
                        : 'Never'
                      }
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Key Actions */}
              <div className="space-y-3">
                <Button
                  onClick={activateDigitalKey}
                  disabled={digitalKey.isActive}
                  className="w-full"
                >
                  <Key className="mr-2 h-4 w-4" />
                  {digitalKey.isActive ? 'Key Active' : 'Activate Key'}
                </Button>
                <Button variant="outline" className="w-full">
                  <Share2 className="mr-2 h-4 w-4" />
                  Share Access
                </Button>
                <Button variant="outline" className="w-full">
                  <Download className="mr-2 h-4 w-4" />
                  Add to Wallet
                </Button>
              </div>

              {/* Access History */}
              <Card>
                <CardHeader>
                  <CardTitle>Access History</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Total Access Count</span>
                      <span className="font-medium">{digitalKey.accessCount}</span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Key usage is tracked for security purposes
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );

  const renderServicesTab = () => (
    <div className="space-y-6">
      {/* Service Request Form */}
      <Card>
        <CardHeader>
          <CardTitle>Request Service</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Select
            value={newRequest.service}
            onValueChange={(value) => setNewRequest({...newRequest, service: value})}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select service..." />
            </SelectTrigger>
            <SelectContent>
              {hotelServices.map(service => (
                <SelectItem key={service.id} value={service.name}>
                  {service.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Textarea
            placeholder="Describe your request..."
            value={newRequest.description}
            onChange={(e) => setNewRequest({...newRequest, description: e.target.value})}
          />
          <Button onClick={requestService} className="w-full">
            <ConciergeBell className="mr-2 h-4 w-4" />
            Submit Request
          </Button>
        </CardContent>
      </Card>

      {/* Available Services */}
      <Card>
        <CardHeader>
          <CardTitle>Available Services</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4">
            {hotelServices.map(service => {
              const Icon = service.icon;
              return (
                <div key={service.id} className="flex items-center p-4 border rounded-lg">
                  <Icon className="h-8 w-8 mr-4 text-blue-500" />
                  <div className="flex-1">
                    <div className="font-medium">{service.name}</div>
                    <div className="text-sm text-muted-foreground">{service.description}</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {service.hours}
                      {service.price && ` • $${service.price}`}
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Badge variant={service.available ? 'default' : 'secondary'}>
                      {service.available ? 'Available' : 'Closed'}
                    </Badge>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Service Requests */}
      <Card>
        <CardHeader>
          <CardTitle>Your Requests</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {serviceRequests.map(request => (
              <div key={request.id} className="p-4 border rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <div className="font-medium">{request.service}</div>
                  <div className="flex items-center space-x-2">
                    <Badge variant={getStatusColor(request.status) as unknown}>
                      {request.status}
                    </Badge>
                    <div className={`w-2 h-2 rounded-full ${getPriorityColor(request.priority)}`} />
                  </div>
                </div>
                <div className="text-sm text-muted-foreground mb-2">{request.description}</div>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Requested: {new Date(request.requestTime).toLocaleString()}</span>
                  {request.estimatedTime && <span>ETA: {request.estimatedTime}</span>}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderPreferencesTab = () => (
    <div className="space-y-6">
      {guestProfile && (
        <>
          {/* Profile Information */}
          <Card>
            <CardHeader>
              <CardTitle>Profile Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Name</label>
                  <Input value={guestProfile.name} readOnly />
                </div>
                <div>
                  <label className="text-sm font-medium">Email</label>
                  <Input value={guestProfile.email} readOnly />
                </div>
                <div>
                  <label className="text-sm font-medium">Phone</label>
                  <Input value={guestProfile.phone} readOnly />
                </div>
                <div>
                  <label className="text-sm font-medium">Loyalty Tier</label>
                  <Input value={guestProfile.loyaltyTier} readOnly />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Room Preferences */}
          <Card>
            <CardHeader>
              <CardTitle>Room Preferences</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Room Temperature (°C)</label>
                  <Input
                    type="number"
                    value={guestProfile.preferences.roomTemp}
                    onChange={(e) => updatePreferences('roomTemp', parseInt(e.target.value))}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Wake-up Call</label>
                  <Input
                    type="time"
                    value={guestProfile.preferences.wakeUpCall}
                    onChange={(e) => updatePreferences('wakeUpCall', e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Pillow Type</label>
                  <Select
                    value={guestProfile.preferences.pillow}
                    onValueChange={(value) => updatePreferences('pillow', value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Soft">Soft</SelectItem>
                      <SelectItem value="Medium">Medium</SelectItem>
                      <SelectItem value="Firm">Firm</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium">Newspaper</label>
                  <Select
                    value={guestProfile.preferences.newspaper}
                    onValueChange={(value) => updatePreferences('newspaper', value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="None">None</SelectItem>
                      <SelectItem value="Wall Street Journal">Wall Street Journal</SelectItem>
                      <SelectItem value="USA Today">USA Today</SelectItem>
                      <SelectItem value="Local Paper">Local Paper</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="md:col-span-2">
                  <label className="text-sm font-medium">Housekeeping Time</label>
                  <Input
                    type="time"
                    value={guestProfile.preferences.housekeeping}
                    onChange={(e) => updatePreferences('housekeeping', e.target.value)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Notification Settings */}
          <Card>
            <CardHeader>
              <CardTitle>Notification Settings</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">Push Notifications</div>
                    <div className="text-sm text-muted-foreground">
                      Receive updates about your requests and hotel services
                    </div>
                  </div>
                  <Button
                    variant={guestProfile.notifications ? 'default' : 'outline'}
                    onClick={() => setGuestProfile({
                      ...guestProfile,
                      notifications: !guestProfile.notifications
                    })}
                  >
                    {guestProfile.notifications ? 'On' : 'Off'}
                  </Button>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">Keyless Entry</div>
                    <div className="text-sm text-muted-foreground">
                      Use your phone as a room key
                    </div>
                  </div>
                  <Button
                    variant={guestProfile.keylessEntry ? 'default' : 'outline'}
                    onClick={() => setGuestProfile({
                      ...guestProfile,
                      keylessEntry: !guestProfile.keylessEntry
                    })}
                  >
                    {guestProfile.keylessEntry ? 'Enabled' : 'Disabled'}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );

  const renderChatTab = () => (
    <div className="h-[calc(100vh-16rem)]">
      <GuestChatPanelWeb
        guestId={guestProfile?.id || ''}
        guestName={guestProfile?.name || 'Guest'}
        roomNumber={guestProfile?.roomNumber}
        bookingId={activeBookingId}
        hotelId={searchParams.get('hotelId') || undefined}
        apiBaseUrl={import.meta.env.VITE_API_URL || 'http://localhost:3001'}
        socketUrl={import.meta.env.VITE_SOCKET_URL || 'http://localhost:3001'}
      />
    </div>
  );

  const tabs = [
    { id: 'home', name: 'Home', icon: Smartphone },
    { id: 'key', name: 'Digital Key', icon: Key },
    { id: 'services', name: 'Services', icon: ConciergeBell },
    { id: 'preferences', name: 'Preferences', icon: Settings },
    { id: 'chat', name: 'Chat', icon: MessageSquare }
  ];

  const isAnyLoading = loadingState.profile || loadingState.services || loadingState.key || loadingState.requests;

  return (
    <div className="max-w-md mx-auto bg-white min-h-screen">
      {!currentUser && !loadingState.profile && (
        <Alert className="m-4 border-amber-200 bg-amber-50 text-amber-900">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Not signed in</AlertTitle>
          <AlertDescription>
            Please sign in to access guest services.
          </AlertDescription>
        </Alert>
      )}
      {isAnyLoading && (
        <div className="flex items-center justify-center p-6 text-gray-500">
          <Loader2 className="h-5 w-5 animate-spin mr-2" />
          Loading guest services...
        </div>
      )}
      {/* App Content */}
      <div className="pb-20 px-4 pt-6">
        {activeTab === 'home' && renderHomeTab()}
        {activeTab === 'key' && renderDigitalKeyTab()}
        {activeTab === 'services' && renderServicesTab()}
        {activeTab === 'preferences' && renderPreferencesTab()}
        {activeTab === 'chat' && renderChatTab()}
      </div>

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-1/2 transform -translate-x-1/2 w-full max-w-md bg-white border-t">
        <div className="flex justify-around py-2">
          {tabs.map(tab => {
            const Icon = tab.icon;
            return (
              <button aria-label={tab.name}
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex flex-col items-center py-2 px-3 rounded-lg transition-colors ${
                  activeTab === tab.id
                    ? 'text-blue-600 bg-blue-50'
                    : 'text-gray-600 hover:text-blue-600'
                }`}
              >
                <Icon className="h-6 w-6 mb-1" />
                <span className="text-xs font-medium">{tab.name}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default withErrorBoundary(ContactlessGuestApp, { level: 'component' });