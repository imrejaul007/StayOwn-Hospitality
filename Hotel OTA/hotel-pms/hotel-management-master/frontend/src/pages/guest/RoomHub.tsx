import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '@/services/api';
import {
  LayoutDashboard,
  Sparkles,
  Utensils,
  MessageSquare,
  CreditCard,
  LogOut,
  Phone,
  Bell,
  Settings,
  ChevronRight,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Coffee,
  Dumbbell,
  Car,
  Heart,
  ConciergeBell,
  Wrench,
  Shirt,
  Plus,
  Minus,
  ShoppingCart,
  Star,
  Calendar,
  Key,
  QrCode,
  Loader2
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'react-hot-toast';
import { withErrorBoundary } from '@/components/ErrorBoundary';
import { formatCurrency, formatDate } from '@/utils/formatters';

interface RoomContext {
  roomId: string;
  roomNumber: string;
  roomType: string;
  floor: string;
  hotelId: string;
  hotelName: string;
  bookingId?: string;
  guestName?: string;
  checkIn?: string;
  checkOut?: string;
  expiresAt?: string;
}

interface ServiceRequest {
  id: string;
  serviceType: string;
  title: string;
  status: 'pending' | 'assigned' | 'in_progress' | 'completed' | 'cancelled';
  priority: string;
  createdAt: string;
  completedAt?: string;
}

interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  category: string;
}

const SERVICE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  housekeeping: Sparkles,
  room_service: Utensils,
  laundry: Shirt,
  maintenance: Wrench,
  concierge: ConciergeBell,
  transport: Car,
  spa: Heart,
  fitness: Dumbbell,
};

const SERVICE_COLORS: Record<string, string> = {
  housekeeping: 'bg-blue-500',
  room_service: 'bg-orange-500',
  laundry: 'bg-purple-500',
  maintenance: 'bg-yellow-500',
  concierge: 'bg-green-500',
  transport: 'bg-indigo-500',
  spa: 'bg-pink-500',
  fitness: 'bg-red-500',
};

const STATUS_CONFIG = {
  pending: { icon: Clock, color: 'text-yellow-500', bg: 'bg-yellow-100' },
  assigned: { icon: Bell, color: 'text-blue-500', bg: 'bg-blue-100' },
  in_progress: { icon: Loader2, color: 'text-orange-500', bg: 'bg-orange-100' },
  completed: { icon: CheckCircle, color: 'text-green-500', bg: 'bg-green-100' },
  cancelled: { icon: XCircle, color: 'text-red-500', bg: 'bg-red-100' },
};

const RoomHub: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [roomContext, setRoomContext] = useState<RoomContext | null>(null);
  const [activeTab, setActiveTab] = useState('home');
  const [loading, setLoading] = useState(true);
  const [serviceRequests, setServiceRequests] = useState<ServiceRequest[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [specialRequest, setSpecialRequest] = useState('');
  const [requestingService, setRequestingService] = useState(false);

  // Decode room context from URL or localStorage
  useEffect(() => {
    const decodeRoomContext = async () => {
      setLoading(true);

      // Check URL params first (from QR scan /scan page)
      const roomId = searchParams.get('roomId');
      const roomNumber = searchParams.get('roomNumber');

      if (roomId) {
        try {
          const context: RoomContext = {
            roomId: roomId,
            roomNumber: roomNumber || '',
            roomType: searchParams.get('roomType') || '',
            floor: searchParams.get('floor') || '',
            hotelId: searchParams.get('hotelId') || '',
            hotelName: searchParams.get('hotelName') || '',
            bookingId: searchParams.get('bookingId') || undefined,
            guestName: searchParams.get('guestName') || undefined,
            checkIn: searchParams.get('checkIn') || undefined,
            checkOut: searchParams.get('checkOut') || undefined,
            expiresAt: searchParams.get('expiresAt') || undefined,
          };

          // Check expiration
          if (context.expiresAt && new Date(context.expiresAt) < new Date()) {
            toast.error('Session expired. Please scan QR again.');
            navigate('/scan');
            return;
          }

          // Save to localStorage for persistence
          localStorage.setItem('roomHubContext', JSON.stringify(context));
          setRoomContext(context);
          await fetchActiveBookingForRoom(context.roomId);
          await fetchServiceRequests(context.roomId);
        } catch (e) {
          toast.error('Invalid QR code');
          navigate('/scan');
        }
      } else {
        // Try localStorage for persisted session
        const saved = localStorage.getItem('roomHubContext');
        if (saved) {
          try {
            const parsed = JSON.parse(saved);
            // Check if expired
            if (parsed.expiresAt && new Date(parsed.expiresAt) < new Date()) {
              localStorage.removeItem('roomHubContext');
              toast.error('Session expired. Please scan QR again.');
              navigate('/scan');
              return;
            }
            setRoomContext(parsed);
            await fetchActiveBookingForRoom(parsed.roomId);
            await fetchServiceRequests(parsed.roomId);
          } catch (e) {
            localStorage.removeItem('roomHubContext');
            navigate('/scan');
          }
        } else {
          // No context available - redirect to scanner
          navigate('/scan');
        }
      }
      setLoading(false);
    };

    decodeRoomContext();
  }, [searchParams, navigate]);

  const fetchActiveBookingForRoom = async (roomId: string) => {
    try {
      const response = await api.get('/bookings', {
        params: {
          roomId,
          status: 'checked_in',
          limit: 1
        }
      });
      const bookings = response.data?.data?.bookings || response.data?.bookings || [];
      if (bookings.length > 0) {
        const booking = bookings[0];
        setRoomContext(prev => prev ? {
          ...prev,
          bookingId: booking._id,
          guestName: booking.guestId?.name || 'Guest',
          checkIn: booking.checkIn,
          checkOut: booking.checkOut
        } : null);
      }
    } catch (e) {
      console.error('Failed to fetch booking', e);
    }
  };

  const fetchServiceRequests = async (roomId: string) => {
    try {
      const response = await api.get('/guest-services', {
        params: { roomId, limit: 20 }
      });
      const requests = response.data?.data?.serviceRequests || response.data?.serviceRequests || [];
      setServiceRequests(requests.slice(0, 10));
    } catch (e) {
      console.error('Failed to fetch service requests', e);
    }
  };

  const addToCart = (item: Omit<CartItem, 'quantity'>) => {
    setCart(prev => {
      const existing = prev.find(i => i.id === item.id);
      if (existing) {
        return prev.map(i => i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, { ...item, quantity: 1 }];
    });
  };

  const removeFromCart = (itemId: string) => {
    setCart(prev => {
      const existing = prev.find(i => i.id === itemId);
      if (existing && existing.quantity > 1) {
        return prev.map(i => i.id === itemId ? { ...i, quantity: i.quantity - 1 } : i);
      }
      return prev.filter(i => i.id !== itemId);
    });
  };

  const submitServiceRequest = async (serviceType: string, items?: CartItem[], notes?: string) => {
    if (!roomContext?.bookingId) {
      toast.error('No active booking found for this room');
      return;
    }

    setRequestingService(true);
    try {
      const serviceItems = items?.map(item => ({
        name: item.name,
        quantity: item.quantity,
        price: item.price
      })) || [];

      const response = await api.post('/guest-services', {
        bookingId: roomContext.bookingId,
        serviceType,
        serviceVariation: serviceType.replace('_', ' '),
        serviceVariations: items?.map(i => i.name) || [],
        description: notes || '',
        items: serviceItems,
        priority: 'now',
        roomId: roomContext.roomId
      });

      const newRequest = response.data?.data || response.data;
      if (newRequest?._id) {
        setServiceRequests(prev => [{
          id: newRequest._id,
          serviceType,
          title: serviceType.replace('_', ' '),
          status: 'pending',
          priority: 'now',
          createdAt: new Date().toISOString()
        }, ...prev]);
        setCart([]);
        setSpecialRequest('');
        toast.success('Service request submitted!');
      }
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Failed to submit request');
    } finally {
      setRequestingService(false);
    }
  };

  const quickRequest = async (serviceType: string) => {
    await submitServiceRequest(serviceType);
  };

  const cartTotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!roomContext) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6">
        <QrCode className="h-16 w-16 text-gray-400 mb-4" />
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Room Not Found</h2>
        <p className="text-gray-600 text-center mb-6">Please scan a valid room QR code</p>
        <Button onClick={() => navigate('/')}>Go Home</Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold">Room {roomContext.roomNumber}</h1>
            <p className="text-blue-100 text-sm">{roomContext.roomType} • Floor {roomContext.floor}</p>
          </div>
          <div className="text-right">
            <Badge className="bg-white/20 text-white">{roomContext.hotelName}</Badge>
            {roomContext.checkOut && (
              <p className="text-blue-100 text-xs mt-1">Checkout: {formatDate(roomContext.checkOut)}</p>
            )}
          </div>
        </div>

        {/* Quick Status */}
        <div className="flex items-center gap-4 text-sm">
          {roomContext.guestName && (
            <div className="flex items-center gap-1">
              <Star className="h-4 w-4" />
              <span>{roomContext.guestName}</span>
            </div>
          )}
          <div className="flex items-center gap-1">
            <Clock className="h-4 w-4" />
            <span>{new Date().toLocaleDateString()}</span>
          </div>
        </div>
      </div>

      {/* Tab Content */}
      <div className="p-4 space-y-4">
        {activeTab === 'home' && (
          <>
            {/* Quick Actions Grid */}
            <div className="grid grid-cols-4 gap-3">
              {[
                { id: 'housekeeping', icon: Sparkles, label: 'Housekeeping', color: 'bg-blue-500' },
                { id: 'room_service', icon: Utensils, label: 'Room Service', color: 'bg-orange-500' },
                { id: 'laundry', icon: Shirt, label: 'Laundry', color: 'bg-purple-500' },
                { id: 'maintenance', icon: Wrench, label: 'Help', color: 'bg-yellow-500' },
                { id: 'concierge', icon: ConciergeBell, label: 'Concierge', color: 'bg-green-500' },
                { id: 'spa', icon: Heart, label: 'Spa', color: 'bg-pink-500' },
                { id: 'transport', icon: Car, label: 'Transport', color: 'bg-indigo-500' },
                { id: 'fitness', icon: Dumbbell, label: 'Gym', color: 'bg-red-500' },
              ].map(action => (
                <button
                  key={action.id}
                  onClick={() => {
                    setActiveTab('services');
                    quickRequest(action.id);
                  }}
                  className="flex flex-col items-center p-3 bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow"
                >
                  <div className={`${action.color} p-3 rounded-full mb-2`}>
                    <action.icon className="h-6 w-6 text-white" />
                  </div>
                  <span className="text-xs font-medium text-gray-700 text-center">{action.label}</span>
                </button>
              ))}
            </div>

            {/* Recent Requests */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center justify-between">
                  <span>Recent Requests</span>
                  <Button variant="ghost" size="sm" onClick={() => setActiveTab('requests')}>
                    View All <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {serviceRequests.length === 0 ? (
                  <p className="text-gray-500 text-sm text-center py-4">No recent requests</p>
                ) : (
                  <div className="space-y-3">
                    {serviceRequests.slice(0, 3).map(req => {
                      const config = STATUS_CONFIG[req.status] || STATUS_CONFIG.pending;
                      const Icon = config.icon;
                      return (
                        <div key={req.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-full ${config.bg}`}>
                              <Icon className={`h-4 w-4 ${config.color}`} />
                            </div>
                            <div>
                              <p className="font-medium capitalize">{req.serviceType.replace('_', ' ')}</p>
                              <p className="text-xs text-gray-500">
                                {new Date(req.createdAt).toLocaleTimeString()}
                              </p>
                            </div>
                          </div>
                          <Badge variant="secondary" className={config.bg}>{req.status.replace('_', ' ')}</Badge>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Quick Links */}
            <div className="grid grid-cols-2 gap-3">
              <Card
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => setActiveTab('services')}
              >
                <CardContent className="p-4 flex items-center gap-3">
                  <MessageSquare className="h-8 w-8 text-blue-500" />
                  <div>
                    <p className="font-semibold">Special Request</p>
                    <p className="text-xs text-gray-500">Describe your needs</p>
                  </div>
                </CardContent>
              </Card>
              <Card
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => navigate('/app/billing')}
              >
                <CardContent className="p-4 flex items-center gap-3">
                  <CreditCard className="h-8 w-8 text-green-500" />
                  <div>
                    <p className="font-semibold">Room Bill</p>
                    <p className="text-xs text-gray-500">View & pay</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </>
        )}

        {activeTab === 'services' && (
          <>
            {/* Room Service Menu */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Utensils className="h-5 w-5" />
                    Room Service Menu
                  </span>
                  {cartCount > 0 && (
                    <Badge className="bg-orange-500">
                      <ShoppingCart className="h-4 w-4 mr-1" />
                      {cartCount} • {formatCurrency(cartTotal)}
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Beverages */}
                <div>
                  <h3 className="font-semibold mb-2 flex items-center gap-2">
                    <Coffee className="h-4 w-4" /> Beverages
                  </h3>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { id: 'tea', name: 'Masala Tea', price: 50 },
                      { id: 'coffee', name: 'Coffee', price: 75 },
                      { id: 'espresso', name: 'Espresso', price: 120 },
                      { id: 'juice', name: 'Fresh Juice', price: 100 },
                    ].map(item => (
                      <div key={item.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div>
                          <p className="font-medium">{item.name}</p>
                          <p className="text-sm text-gray-500">{formatCurrency(item.price)}</p>
                        </div>
                        <Button size="sm" variant="outline" onClick={() => addToCart({ ...item, category: 'beverages' })}>
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Snacks */}
                <div>
                  <h3 className="font-semibold mb-2 flex items-center gap-2">
                    <Utensils className="h-4 w-4" /> Snacks
                  </h3>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { id: 'samosa', name: 'Samosa (2pc)', price: 80 },
                      { id: 'pakoda', name: 'Onion Pakoda', price: 70 },
                      { id: 'sandwich', name: 'Sandwich', price: 120 },
                      { id: 'biscuits', name: 'Biscuits Plate', price: 100 },
                    ].map(item => (
                      <div key={item.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div>
                          <p className="font-medium">{item.name}</p>
                          <p className="text-sm text-gray-500">{formatCurrency(item.price)}</p>
                        </div>
                        <Button size="sm" variant="outline" onClick={() => addToCart({ ...item, category: 'snacks' })}>
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Housekeeping */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-blue-500" />
                  Housekeeping
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-2">
                {['Room Cleaning', 'Extra Towels', 'Toiletries', 'Bedding Change'].map(service => (
                  <Button
                    key={service}
                    variant="outline"
                    className="justify-start"
                    onClick={() => quickRequest(service.toLowerCase().replace(' ', '_'))}
                  >
                    <Sparkles className="h-4 w-4 mr-2" />
                    {service}
                  </Button>
                ))}
              </CardContent>
            </Card>

            {/* Special Request */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5 text-purple-500" />
                  Special Request
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Textarea
                  placeholder="Describe your special request..."
                  value={specialRequest}
                  onChange={(e) => setSpecialRequest(e.target.value)}
                  rows={3}
                />
                <Button
                  className="w-full"
                  onClick={() => submitServiceRequest('concierge', [], specialRequest)}
                  disabled={!specialRequest.trim() || requestingService}
                >
                  {requestingService ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Submit Request
                </Button>
              </CardContent>
            </Card>

            {/* Cart */}
            {cart.length > 0 && (
              <Card className="border-orange-200 bg-orange-50">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <ShoppingCart className="h-5 w-5" />
                      Your Order
                    </span>
                    <span className="text-lg font-bold">{formatCurrency(cartTotal)}</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {cart.map(item => (
                    <div key={item.id} className="flex items-center justify-between">
                      <span>{item.name} x{item.quantity}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-gray-500">{formatCurrency(item.price * item.quantity)}</span>
                        <Button size="sm" variant="ghost" onClick={() => removeFromCart(item.id)}>
                          <Minus className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                  <Button
                    className="w-full mt-3 bg-orange-500 hover:bg-orange-600"
                    onClick={() => submitServiceRequest('room_service', cart)}
                    disabled={requestingService}
                  >
                    {requestingService ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    Place Order • {formatCurrency(cartTotal)}
                  </Button>
                </CardContent>
              </Card>
            )}
          </>
        )}

        {activeTab === 'requests' && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                Your Requests
              </CardTitle>
            </CardHeader>
            <CardContent>
              {serviceRequests.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No service requests yet</p>
              ) : (
                <div className="space-y-3">
                  {serviceRequests.map(req => {
                    const config = STATUS_CONFIG[req.status] || STATUS_CONFIG.pending;
                    const Icon = config.icon;
                    return (
                      <div key={req.id} className="p-4 border rounded-lg">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-full ${config.bg}`}>
                              <Icon className={`h-4 w-4 ${config.color}`} />
                            </div>
                            <div>
                              <p className="font-semibold capitalize">{req.serviceType.replace('_', ' ')}</p>
                              <p className="text-sm text-gray-500">{new Date(req.createdAt).toLocaleString()}</p>
                            </div>
                          </div>
                          <Badge className={config.bg}>{req.status.replace('_', ' ')}</Badge>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t">
        <div className="flex justify-around py-2 max-w-md mx-auto">
          {[
            { id: 'home', icon: LayoutDashboard, label: 'Home' },
            { id: 'services', icon: Utensils, label: 'Services' },
            { id: 'requests', icon: Bell, label: 'Requests' },
            { id: 'settings', icon: Settings, label: 'More' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex flex-col items-center py-2 px-4 rounded-lg transition-colors ${
                activeTab === tab.id ? 'text-blue-600 bg-blue-50' : 'text-gray-600'
              }`}
            >
              <tab.icon className="h-5 w-5" />
              <span className="text-xs mt-1">{tab.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default withErrorBoundary(RoomHub, { level: 'page' });
