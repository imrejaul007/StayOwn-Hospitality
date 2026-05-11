import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { toast } from '@/utils/toast';
import { formatCurrency, formatCompactCurrency } from '@/utils/currencyUtils';
import {
  LayoutGrid,
  UserCheck,
  UserX,
  Calendar,
  AlertTriangle,
  XCircle,
  Clock,
  CreditCard,
  IndianRupee,
  Users,
  Search,
  Filter,
  Download,
  RefreshCw,
  Eye,
  Edit,
  Trash2,
  Phone,
  Mail,
  MapPin,
  Building2,
  Star,
  CheckCircle
} from 'lucide-react';
import { format, isToday, isTomorrow } from 'date-fns';
import { api } from '@/services/api';

interface OperationalListItem {
  id: string;
  bookingId: string;
  guestName: string;
  roomNumber: string;
  roomType: string;
  checkIn: string;
  checkOut: string;
  status: string;
  amount: number;
  paymentStatus: string;
  guestTier: 'regular' | 'vip' | 'svip' | 'corporate' | 'diamond';
  phone?: string;
  email?: string;
  specialRequests?: string[];
  notes?: string;
  groupType?: 'individual' | 'group' | 'corporate' | 'travel_agent';
  depositAmount?: number;
  balanceAmount?: number;
  lastUpdated: string;
}

interface OperationFilters {
  dateRange: 'today' | 'tomorrow' | 'week' | 'custom';
  guestName: string;
  reservationId: string;
  groupType: 'all' | 'individual' | 'group' | 'corporate' | 'travel_agent';
  paymentStatus: 'all' | 'pending' | 'partial' | 'paid' | 'overdue';
  roomType: string;
  guestTier: 'all' | 'regular' | 'vip' | 'svip' | 'corporate' | 'diamond';
}

interface OperationStats {
  checkInsToday: number;
  checkOutsToday: number;
  noShows: number;
  pendingPayments: number;
  inHouseGuests: number;
  pendingFolios: number;
  totalRevenue: number;
  occupancyRate: number;
}

export const MultiViewOperationsDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState('checkin');
  const [operationalData, setOperationalData] = useState<{
    [key: string]: OperationalListItem[];
  }>({});
  const [stats, setStats] = useState<OperationStats>({
    checkInsToday: 0,
    checkOutsToday: 0,
    noShows: 0,
    pendingPayments: 0,
    inHouseGuests: 0,
    pendingFolios: 0,
    totalRevenue: 0,
    occupancyRate: 0
  });
  const [filters, setFilters] = useState<OperationFilters>({
    dateRange: 'today',
    guestName: '',
    reservationId: '',
    groupType: 'all',
    paymentStatus: 'all',
    roomType: '',
    guestTier: 'all'
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadOperationalData();
    const interval = setInterval(loadOperationalData, 300000); // Refresh every 5 minutes
    return () => clearInterval(interval);
  }, [filters, activeTab]);

  // Helper function to transform booking data to operational item
  const transformBookingToOperationalItem = (booking: Record<string, unknown>): OperationalListItem => ({
    id: booking._id,
    bookingId: booking._id,
    guestName: booking.userId?.name || 'Unknown Guest',
    roomNumber: booking.rooms?.[0]?.roomId?.roomNumber || 'N/A',
    roomType: booking.rooms?.[0]?.roomId?.type || 'Standard',
    checkIn: booking.checkIn || '',
    checkOut: booking.checkOut || '',
    status: booking.status,
    amount: booking.totalAmount || 0,
    paymentStatus: booking.paymentStatus || 'pending',
    notes: booking.guestDetails?.specialRequests || '',
    priority: 'medium',
    timestamp: booking.createdAt || new Date().toISOString(),
    contactInfo: {
      phone: booking.userId?.phone || '',
      email: booking.userId?.email || ''
    },
    guestTier: booking.userId?.loyalty?.tier || 'regular',
    source: booking.source || 'direct'
  });

  const loadOperationalData = async () => {
    setLoading(true);
    try {
      // Fetch real operational data from backend APIs
      const today = format(new Date(), 'yyyy-MM-dd');

      // Fetch real operational data from backend APIs
      const [bookingsResponse, roomsResponse] = await Promise.all([
        api.get('/bookings'),
        api.get('/rooms')
      ]);

      const bookings = bookingsResponse.data.bookings || [];
      const rooms = roomsResponse.data.rooms || [];

      // Transform real data to operational lists
      const operationalData: OperationalData = {
        checkin: bookings.filter((b: unknown) =>
          b.status === 'confirmed' &&
          isToday(new Date(b.checkIn))
        ).map(transformBookingToOperationalItem),

        checkout: bookings.filter((b: unknown) =>
          b.status === 'checked_in' &&
          isToday(new Date(b.checkOut))
        ).map(transformBookingToOperationalItem),

        inhouse: bookings.filter((b: unknown) =>
          b.status === 'checked_in' &&
          new Date(b.checkIn) <= new Date() &&
          new Date(b.checkOut) > new Date()
        ).map(transformBookingToOperationalItem),

        noshow: bookings.filter((b: unknown) =>
          b.status === 'no_show'
        ).map(transformBookingToOperationalItem),

        payments: bookings.filter((b: unknown) =>
          b.paymentStatus === 'pending' || b.paymentStatus === 'partial'
        ).map((b: unknown) => ({
          id: b._id + '_payment',
          bookingId: b._id,
          guestName: b.userId?.name || 'Unknown',
          roomNumber: b.rooms?.[0]?.roomId?.roomNumber || 'N/A',
          roomType: b.rooms?.[0]?.roomId?.type || 'Standard',
          checkIn: b.checkIn || '',
          checkOut: b.checkOut || '',
          status: b.paymentStatus,
          amount: b.totalAmount || 0,
          paymentStatus: b.paymentStatus || 'pending',
          notes: b.guestDetails?.specialRequests || '',
          priority: 'medium',
          timestamp: b.createdAt || new Date().toISOString(),
          contactInfo: {
            phone: b.userId?.phone || '',
            email: b.userId?.email || ''
          },
          guestTier: b.userId?.loyalty?.tier || 'regular',
          source: b.source || 'direct'
        })),

        // Generate other operational lists from available data
        departures: bookings.filter((b: unknown) =>
          isTomorrow(new Date(b.checkOut))
        ).map(transformBookingToOperationalItem),

        arrivals: bookings.filter((b: unknown) =>
          isTomorrow(new Date(b.checkIn))
        ).map(transformBookingToOperationalItem),

        vip: bookings.filter((b: unknown) =>
          b.userId?.guestType === 'vip' || b.userId?.loyalty?.tier === 'vip'
        ).map(transformBookingToOperationalItem),

        corporate: bookings.filter((b: unknown) =>
          b.corporateBooking
        ).map(transformBookingToOperationalItem),

        waitlist: [], // Would need separate waitlist API
        folios: [], // Would need separate folios API
        maintenance: [] // Would need separate maintenance API
      };

      setOperationalData(operationalData);

      // Calculate real stats
      const calculatedStats: OperationStats = {
        checkInsToday: operationalData.checkin?.length || 0,
        checkOutsToday: operationalData.checkout?.length || 0,
        noShows: operationalData.noshow?.length || 0,
        pendingPayments: operationalData.payments?.filter(p => p.paymentStatus === 'pending').length || 0,
        inHouseGuests: operationalData.inhouse?.length || 0,
        pendingFolios: operationalData.folios?.length || 0,
        totalRevenue: operationalData.payments?.reduce((sum, p) => sum + p.amount, 0) || 0,
        occupancyRate: rooms.length > 0 ? (operationalData.inhouse.length / rooms.length) * 100 : 0
      };
      setStats(calculatedStats);
    } catch (error) {
      toast.error('Failed to load operational data');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    const colors = {
      confirmed: 'bg-green-100 text-green-800',
      pending: 'bg-yellow-100 text-yellow-800',
      cancelled: 'bg-red-100 text-red-800',
      noshow: 'bg-orange-100 text-orange-800',
      occupied: 'bg-blue-100 text-blue-800',
      checkout: 'bg-purple-100 text-purple-800',
      checkin: 'bg-emerald-100 text-emerald-800',
      temp: 'bg-amber-100 text-amber-800',
      paid: 'bg-green-100 text-green-800',
      partial: 'bg-yellow-100 text-yellow-800',
      overdue: 'bg-red-100 text-red-800'
    };
    return colors[status as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  const getTierIcon = (tier: string) => {
    switch (tier) {
      case 'diamond':
        return <Star className="h-4 w-4 text-purple-600" />;
      case 'svip':
        return <Star className="h-4 w-4 text-yellow-600" />;
      case 'vip':
        return <Star className="h-4 w-4 text-blue-600" />;
      case 'corporate':
        return <Building2 className="h-4 w-4 text-green-600" />;
      default:
        return <Users className="h-4 w-4 text-gray-600" />;
    }
  };

  const filteredData = (data: OperationalListItem[]) => {
    return data.filter(item => {
      if (filters.guestName && !item.guestName.toLowerCase().includes(filters.guestName.toLowerCase())) {
        return false;
      }
      if (filters.reservationId && !item.bookingId.toLowerCase().includes(filters.reservationId.toLowerCase())) {
        return false;
      }
      if (filters.groupType !== 'all' && item.groupType !== filters.groupType) {
        return false;
      }
      if (filters.paymentStatus !== 'all' && item.paymentStatus !== filters.paymentStatus) {
        return false;
      }
      if (filters.guestTier !== 'all' && item.guestTier !== filters.guestTier) {
        return false;
      }
      return true;
    });
  };

  const exportToExcel = (data: OperationalListItem[], listName: string) => {
    if (data.length === 0) {
      toast.error('No data to export');
      return;
    }
    const headers = ['Guest Name', 'Room', 'Room Type', 'Check In', 'Check Out', 'Status', 'Amount'];
    const rows = data.map(item => [
      item.guestName,
      item.roomNumber,
      item.roomType,
      item.checkIn,
      item.checkOut,
      item.status,
      String(item.amount)
    ]);
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${listName}-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${data.length} items from ${listName}`);
  };

  const tabConfigs = [
    {
      id: 'checkin',
      label: 'Check-in List',
      icon: <UserCheck className="h-4 w-4" />,
      color: 'text-green-600',
      description: 'Guests scheduled to check in today'
    },
    {
      id: 'checkout',
      label: 'Check-out List',
      icon: <UserX className="h-4 w-4" />,
      color: 'text-blue-600',
      description: 'Guests scheduled to check out today'
    },
    {
      id: 'reservations',
      label: 'Reservation List',
      icon: <Calendar className="h-4 w-4" />,
      color: 'text-purple-600',
      description: 'All confirmed reservations'
    },
    {
      id: 'temp',
      label: 'Temp Room List',
      icon: <Clock className="h-4 w-4" />,
      color: 'text-amber-600',
      description: 'Temporary reservations requiring confirmation'
    },
    {
      id: 'noshow',
      label: 'No Show List',
      icon: <AlertTriangle className="h-4 w-4" />,
      color: 'text-orange-600',
      description: 'Guests who failed to check in'
    },
    {
      id: 'cancelled',
      label: 'Cancelled List',
      icon: <XCircle className="h-4 w-4" />,
      color: 'text-red-600',
      description: 'Recently cancelled reservations'
    },
    {
      id: 'pending_checkout',
      label: 'Checkout Pending',
      icon: <Clock className="h-4 w-4" />,
      color: 'text-cyan-600',
      description: 'Guests with pending checkout process'
    },
    {
      id: 'folios',
      label: 'Pending Folios',
      icon: <CreditCard className="h-4 w-4" />,
      color: 'text-indigo-600',
      description: 'Folios requiring attention'
    },
    {
      id: 'deposits',
      label: 'Deposits Tracker',
      icon: <IndianRupee className="h-4 w-4" />,
      color: 'text-emerald-600',
      description: 'Booking deposits and payments'
    },
    {
      id: 'payments',
      label: 'Payment Tracker',
      icon: <CreditCard className="h-4 w-4" />,
      color: 'text-teal-600',
      description: 'Payment status tracking'
    },
    {
      id: 'inhouse',
      label: 'Guests In-House',
      icon: <Users className="h-4 w-4" />,
      color: 'text-slate-600',
      description: 'Currently checked-in guests'
    }
  ];

  const renderOperationalList = (data: OperationalListItem[], config: Record<string, unknown>) => {
    const filtered = filteredData(data);

    return (
      <div className="space-y-4">
        {/* List Header with Stats */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${config.color.replace('text-', 'bg-').replace('-600', '-100')}`}>
              {config.icon}
            </div>
            <div>
              <h3 className="font-semibold text-lg">{config.label}</h3>
              <p className="text-sm text-gray-600">{config.description}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge className="bg-blue-100 text-blue-800">
              {filtered.length} items
            </Badge>
            <Button size="sm" variant="outline" onClick={() => exportToExcel(filtered, config.label)} className="gap-1">
              <Download className="h-3 w-3" />
              Export
            </Button>
            <Button size="sm" onClick={loadOperationalData} className="gap-1">
              <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>

        {/* Items List */}
        <ScrollArea className="h-[500px]">
          <div className="space-y-3">
            {filtered.map((item) => (
              <Card key={item.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-start gap-3">
                      {getTierIcon(item.guestTier)}
                      <div>
                        <div className="font-semibold text-lg flex items-center gap-2">
                          {item.guestName}
                          <Badge className={getStatusColor(item.guestTier)}>
                            {item.guestTier.toUpperCase()}
                          </Badge>
                        </div>
                        <div className="text-sm text-gray-600">
                          {item.email} • {item.phone}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge className={getStatusColor(item.status)}>
                        {item.status.toUpperCase()}
                      </Badge>
                    </div>
                  </div>

                  <div className="grid grid-cols-4 gap-4 text-sm mb-3">
                    <div>
                      <span className="font-medium text-gray-700">Room:</span>
                      <div>{item.roomNumber} ({item.roomType})</div>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">Booking ID:</span>
                      <div className="font-mono">{item.bookingId}</div>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">Dates:</span>
                      <div>{format(new Date(item.checkIn), 'MMM dd')} - {format(new Date(item.checkOut), 'MMM dd')}</div>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">Amount:</span>
                      <div className="font-semibold text-green-600">{formatCurrency(item.amount)}</div>
                    </div>
                  </div>

                  {item.specialRequests && item.specialRequests.length > 0 && (
                    <div className="mb-3">
                      <span className="font-medium text-gray-700 text-sm">Special Requests:</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {item.specialRequests.map((req, idx) => (
                          <Badge key={idx} variant="secondary" className="text-xs">
                            {req}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-2 border-t">
                    <div className="flex items-center gap-4 text-sm text-gray-600">
                      <span>Group: {item.groupType}</span>
                      <span>Payment: {item.paymentStatus}</span>
                      {item.balanceAmount && (
                        <span>Balance: {formatCurrency(item.balanceAmount)}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="ghost" className="gap-1">
                        <Eye className="h-3 w-3" />
                        View
                      </Button>
                      <Button size="sm" variant="ghost" className="gap-1">
                        <Edit className="h-3 w-3" />
                        Edit
                      </Button>
                      <Button size="sm" variant="ghost" className="gap-1">
                        <Phone className="h-3 w-3" />
                        Call
                      </Button>
                      <Button size="sm" variant="ghost" className="gap-1">
                        <Mail className="h-3 w-3" />
                        Email
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </ScrollArea>
      </div>
    );
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <LayoutGrid className="h-4 w-4" />
          Operations Dashboard
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-[95vw] max-h-[95vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <LayoutGrid className="h-5 w-5" />
            Multi-View Operations Dashboard
            <Badge className="bg-orange-100 text-orange-800">
              Hotelogix Standard
            </Badge>
          </DialogTitle>
        </DialogHeader>

        {/* Stats Overview */}
        <div className="grid grid-cols-4 md:grid-cols-8 gap-3 mb-4">
          <Card className="p-3">
            <div className="text-center">
              <div className="text-xl font-bold text-green-600">{stats.checkInsToday}</div>
              <div className="text-xs text-gray-600">Check-ins</div>
            </div>
          </Card>
          <Card className="p-3">
            <div className="text-center">
              <div className="text-xl font-bold text-blue-600">{stats.checkOutsToday}</div>
              <div className="text-xs text-gray-600">Check-outs</div>
            </div>
          </Card>
          <Card className="p-3">
            <div className="text-center">
              <div className="text-xl font-bold text-purple-600">{stats.inHouseGuests}</div>
              <div className="text-xs text-gray-600">In-House</div>
            </div>
          </Card>
          <Card className="p-3">
            <div className="text-center">
              <div className="text-xl font-bold text-orange-600">{stats.noShows}</div>
              <div className="text-xs text-gray-600">No Shows</div>
            </div>
          </Card>
          <Card className="p-3">
            <div className="text-center">
              <div className="text-xl font-bold text-red-600">{stats.pendingPayments}</div>
              <div className="text-xs text-gray-600">Pending Pay</div>
            </div>
          </Card>
          <Card className="p-3">
            <div className="text-center">
              <div className="text-xl font-bold text-indigo-600">{stats.pendingFolios}</div>
              <div className="text-xs text-gray-600">Folios</div>
            </div>
          </Card>
          <Card className="p-3">
            <div className="text-center">
              <div className="text-xl font-bold text-emerald-600">{formatCompactCurrency(stats.totalRevenue)}</div>
              <div className="text-xs text-gray-600">Revenue</div>
            </div>
          </Card>
          <Card className="p-3">
            <div className="text-center">
              <div className="text-xl font-bold text-slate-600">{stats.occupancyRate}%</div>
              <div className="text-xs text-gray-600">Occupancy</div>
            </div>
          </Card>
        </div>

        {/* Advanced Filters */}
        <Card className="p-4 mb-4">
          <div className="flex items-center gap-2 mb-3">
            <Filter className="h-4 w-4" />
            <span className="font-medium">Advanced Filtering</span>
          </div>
          <div className="grid grid-cols-6 gap-3">
            <div>
              <Label className="text-xs">Guest Name</Label>
              <Input
                placeholder="Search..."
                value={filters.guestName}
                onChange={(e) => setFilters(prev => ({ ...prev, guestName: e.target.value }))}
                className="h-8 text-xs"
              />
            </div>
            <div>
              <Label className="text-xs">Booking ID</Label>
              <Input
                placeholder="BK123..."
                value={filters.reservationId}
                onChange={(e) => setFilters(prev => ({ ...prev, reservationId: e.target.value }))}
                className="h-8 text-xs"
              />
            </div>
            <div>
              <Label className="text-xs">Group Type</Label>
              <Select value={filters.groupType} onValueChange={(value) => setFilters(prev => ({ ...prev, groupType: value as string }))}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="individual">Individual</SelectItem>
                  <SelectItem value="group">Group</SelectItem>
                  <SelectItem value="corporate">Corporate</SelectItem>
                  <SelectItem value="travel_agent">Travel Agent</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Payment Status</Label>
              <Select value={filters.paymentStatus} onValueChange={(value) => setFilters(prev => ({ ...prev, paymentStatus: value as string }))}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="partial">Partial</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="overdue">Overdue</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Guest Tier</Label>
              <Select value={filters.guestTier} onValueChange={(value) => setFilters(prev => ({ ...prev, guestTier: value as string }))}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Tiers</SelectItem>
                  <SelectItem value="diamond">Diamond</SelectItem>
                  <SelectItem value="svip">SVIP</SelectItem>
                  <SelectItem value="vip">VIP</SelectItem>
                  <SelectItem value="corporate">Corporate</SelectItem>
                  <SelectItem value="regular">Regular</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Date Range</Label>
              <Select value={filters.dateRange} onValueChange={(value) => setFilters(prev => ({ ...prev, dateRange: value as string }))}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="tomorrow">Tomorrow</SelectItem>
                  <SelectItem value="week">This Week</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </Card>

        {/* Operational Lists Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid grid-cols-6 lg:grid-cols-11 mb-4">
            {tabConfigs.map((config) => {
              const count = operationalData[config.id]?.length || 0;
              return (
                <TabsTrigger key={config.id} value={config.id} className="relative">
                  <div className="flex items-center gap-1">
                    {config.icon}
                    <span className="hidden lg:inline text-xs">{config.label.split(' ')[0]}</span>
                  </div>
                  {count > 0 && (
                    <Badge className="absolute -top-2 -right-2 bg-red-500 text-white text-xs min-w-5 h-5 rounded-full p-0 flex items-center justify-center">
                      {count}
                    </Badge>
                  )}
                </TabsTrigger>
              );
            })}
          </TabsList>

          {tabConfigs.map((config) => (
            <TabsContent key={config.id} value={config.id} className="mt-0">
              {renderOperationalList(operationalData[config.id] || [], config)}
            </TabsContent>
          ))}
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};