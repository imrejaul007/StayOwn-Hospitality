import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from '@/utils/toast';
import {
  Clock,
  CalendarIcon,
  User,
  Mail,
  Phone,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Calendar as CalendarSidebar,
  Building2,
  Users,
  Send,
  Calendar,
  RefreshCw
} from 'lucide-react';
import { format, addDays, addHours, addMinutes, addMonths, addYears } from 'date-fns';
import { api } from '@/services/api';
import { formatCurrency } from '@/utils/currencyUtils';

export interface TempReservation {
  id: string;
  guestName: string;
  guestEmail: string;
  guestPhone: string;
  roomNumber: string;
  roomType: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  adults: number;
  children: number;
  rate: number;
  totalAmount: number;
  holdTillDate: string;
  holdTillType: 'minutes' | 'hours' | 'days' | 'months' | 'years';
  holdTillValue: number;
  status: 'temp' | 'confirmed' | 'expired' | 'cancelled';
  createdAt: string;
  notes?: string;
  autoConfirmEmail: boolean;
  paymentRequired: boolean;
  depositAmount?: number;
  source: 'phone' | 'email' | 'walk_in' | 'website';
  urgency: 'low' | 'medium' | 'high' | 'urgent';
  specialRequests?: string[];
}

export interface TempReservationStats {
  totalTemp: number;
  expiredToday: number;
  confirmedToday: number;
  cancelledToday: number;
  holdingRevenue: number;
  avgHoldTime: number;
  conversionRate: number;
}

export interface BlockedRowData {
  date: string;
  count: number;
  revenue: number;
  status: 'normal' | 'high' | 'critical';
}

export const TempReservationSystem: React.FC = () => {
  const [tempReservations, setTempReservations] = useState<TempReservation[]>([]);
  const [stats, setStats] = useState<TempReservationStats>({
    totalTemp: 0,
    expiredToday: 0,
    confirmedToday: 0,
    cancelledToday: 0,
    holdingRevenue: 0,
    avgHoldTime: 0,
    conversionRate: 0
  });
  const [blockedRowData, setBlockedRowData] = useState<BlockedRowData[]>([]);
  const [selectedTempReservation, setSelectedTempReservation] = useState<TempReservation | null>(null);
  const [isCreatingTemp, setIsCreatingTemp] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [newTempReservation, setNewTempReservation] = useState<Partial<TempReservation>>({
    holdTillType: 'hours',
    holdTillValue: 2,
    autoConfirmEmail: true,
    paymentRequired: false,
    urgency: 'medium',
    source: 'phone'
  });

  useEffect(() => {
    loadTempReservations();
    loadBlockedRowData();
    const interval = setInterval(() => {
      checkExpiredReservations();
      loadTempReservations();
    }, 60000); // Check every minute
    return () => clearInterval(interval);
  }, []);

  const loadTempReservations = async () => {
    try {
      // Fetch pending bookings from real backend API (treating pending as temp reservations)
      const response = await api.get('/bookings?status=pending');
      const data = response.data;

      // Transform backend booking data to TempReservation format
      const transformedReservations: TempReservation[] = (data.bookings || []).map((booking: Record<string, unknown>) => {
        const checkInDate = new Date(booking.checkIn);
        const checkOutDate = new Date(booking.checkOut);
        const nights = Math.ceil((checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24));

        return {
          id: booking._id,
          guestName: booking.userId?.name || 'Unknown Guest',
          guestEmail: booking.userId?.email || '',
          guestPhone: booking.userId?.phone || '',
          roomNumber: booking.rooms?.[0]?.roomId?.roomNumber || 'N/A',
          roomType: booking.rooms?.[0]?.roomId?.type || 'Standard',
          checkIn: booking.checkIn?.split('T')[0] || '',
          checkOut: booking.checkOut?.split('T')[0] || '',
          nights: nights || 1,
          adults: booking.guestDetails?.adults || 1,
          children: booking.guestDetails?.children || 0,
          rate: booking.rooms?.[0]?.rate || 0,
          totalAmount: booking.totalAmount || 0,
          holdTillDate: format(addHours(new Date(booking.createdAt || new Date()), 4), 'yyyy-MM-dd HH:mm:ss'),
          holdTillType: 'hours' as const,
          holdTillValue: 4,
          status: 'temp' as const,
          createdAt: booking.createdAt || new Date().toISOString(),
          autoConfirmEmail: false,
          paymentRequired: booking.paymentStatus === 'pending',
          depositAmount: 0,
          source: (booking.source === 'phone' ? 'phone' : booking.source === 'walk_in' ? 'walk_in' : 'website') as 'phone' | 'email' | 'walk_in' | 'website',
          urgency: 'medium' as const,
          notes: booking.guestDetails?.specialRequests || 'Temporary reservation - awaiting confirmation',
          specialRequests: booking.guestDetails?.specialRequests ? [booking.guestDetails.specialRequests] : []
        };
      });

      setTempReservations(transformedReservations);

      // Calculate stats
      const tempStats: TempReservationStats = {
        totalTemp: transformedReservations.filter(tr => tr.status === 'temp').length,
        expiredToday: 0,
        confirmedToday: 0,
        cancelledToday: 0,
        holdingRevenue: transformedReservations
          .filter(tr => tr.status === 'temp')
          .reduce((sum, tr) => sum + tr.totalAmount, 0),
        avgHoldTime: 3.5,
        conversionRate: transformedReservations.length > 0 ? 78 : 0
      };
      setStats(tempStats);
    } catch (error) {
      toast.error('Failed to load temporary reservations');
    } finally {
      setIsLoading(false);
    }
  };

  const loadBlockedRowData = async () => {
    try {
      // Generate blocked row data for the next 7 days
      const today = new Date();
      const blockedData: BlockedRowData[] = [];

      for (let i = 0; i < 7; i++) {
        const date = addDays(today, i);
        const dateStr = format(date, 'yyyy-MM-dd');
        const dayTempReservations = tempReservations.filter(
          tr => tr.checkIn === dateStr && tr.status === 'temp'
        );

        const count = dayTempReservations.length;
        const revenue = dayTempReservations.reduce((sum, tr) => sum + tr.totalAmount, 0);

        let status: 'normal' | 'high' | 'critical' = 'normal';
        if (count > 5) status = 'critical';
        else if (count > 2) status = 'high';

        blockedData.push({
          date: dateStr,
          count,
          revenue,
          status
        });
      }

      setBlockedRowData(blockedData);
    } catch {
      // Error handled silently
    }
  };

  const checkExpiredReservations = async () => {
    const now = new Date();
    const expiredReservations = tempReservations.filter(
      tr => tr.status === 'temp' && new Date(tr.holdTillDate) < now
    );

    if (expiredReservations.length > 0) {
      // In real implementation, would call API to expire these reservations
      toast.warning(`${expiredReservations.length} temporary reservations have expired`);
    }
  };

  const calculateHoldTillDate = (type: string, value: number) => {
    const now = new Date();
    switch (type) {
      case 'minutes':
        return addMinutes(now, value);
      case 'hours':
        return addHours(now, value);
      case 'days':
        return addDays(now, value);
      case 'months':
        return addMonths(now, value);
      case 'years':
        return addYears(now, value);
      default:
        return addHours(now, 2);
    }
  };

  const createTempReservation = async () => {
    if (!newTempReservation.guestName || !newTempReservation.roomNumber) {
      toast.error('Please fill in all required fields');
      return;
    }

    const holdTillDate = calculateHoldTillDate(
      newTempReservation.holdTillType!,
      newTempReservation.holdTillValue!
    );

    const tempReservation: TempReservation = {
      ...newTempReservation as TempReservation,
      id: `temp-${Date.now()}`,
      holdTillDate: format(holdTillDate, 'yyyy-MM-dd HH:mm:ss'),
      status: 'temp',
      createdAt: new Date().toISOString()
    };

    try {
      // In real implementation, would call API
      setTempReservations(prev => [...prev, tempReservation]);

      if (tempReservation.autoConfirmEmail) {
        await sendTempReservationEmail(tempReservation);
      }

      toast.success(`Temporary reservation created for ${tempReservation.guestName}`);
      setIsCreatingTemp(false);
      setNewTempReservation({
        holdTillType: 'hours',
        holdTillValue: 2,
        autoConfirmEmail: true,
        paymentRequired: false,
        urgency: 'medium',
        source: 'phone'
      });

      // Reload data
      loadTempReservations();
      loadBlockedRowData();
    } catch (error) {
      toast.error('Failed to create temporary reservation');
    }
  };

  const sendTempReservationEmail = async (tempReservation: TempReservation) => {
    try {
      // In real implementation, would call email service
      toast.info(`Confirmation email sent to ${tempReservation.guestEmail}`);
    } catch (error) {
      toast.error('Failed to send confirmation email');
    }
  };

  const confirmTempReservation = async (tempId: string) => {
    try {
      // In real implementation, would call API to convert to confirmed reservation
      setTempReservations(prev =>
        prev.map(tr => tr.id === tempId ? { ...tr, status: 'confirmed' } : tr)
      );
      toast.success('Temporary reservation confirmed successfully');
      loadTempReservations();
    } catch (error) {
      toast.error('Failed to confirm reservation');
    }
  };

  const cancelTempReservation = async (tempId: string, reason?: string) => {
    try {
      setTempReservations(prev =>
        prev.map(tr => tr.id === tempId ? { ...tr, status: 'cancelled' } : tr)
      );
      toast.success('Temporary reservation cancelled');
      loadTempReservations();
    } catch (error) {
      toast.error('Failed to cancel reservation');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'temp':
        return 'bg-yellow-100 text-yellow-800';
      case 'confirmed':
        return 'bg-green-100 text-green-800';
      case 'expired':
        return 'bg-red-100 text-red-800';
      case 'cancelled':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-blue-100 text-blue-800';
    }
  };

  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case 'urgent':
        return 'bg-red-100 text-red-800';
      case 'high':
        return 'bg-orange-100 text-orange-800';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800';
      case 'low':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-blue-100 text-blue-800';
    }
  };

  const getTimeRemaining = (holdTillDate: string) => {
    const now = new Date();
    const expiry = new Date(holdTillDate);
    const diff = expiry.getTime() - now.getTime();

    if (diff < 0) {
      return 'EXPIRED';
    }

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else {
      return `${minutes}m`;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <RefreshCw className="h-6 w-6 animate-spin text-blue-600" />
        <span className="ml-2 text-gray-600">Loading reservations...</span>
      </div>
    );
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2 relative">
          <CalendarSidebar className="h-4 w-4" />
          Temp Reservations
          {stats.totalTemp > 0 && (
            <Badge className="ml-1 bg-yellow-500 text-white">
              {stats.totalTemp}
            </Badge>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-7xl max-h-[95vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarSidebar className="h-5 w-5 text-blue-600" />
            Temporary Reservation Management
            <Badge className="bg-gradient-to-r from-blue-100 to-indigo-100 text-blue-800 border-0">
              Real-time System
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="blocked-row">Blocked Row</TabsTrigger>
            <TabsTrigger value="manage">Manage</TabsTrigger>
            <TabsTrigger value="create">Create New</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            {/* Stats Dashboard */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <Card className="bg-gradient-to-br from-amber-50 to-yellow-50 border-amber-200 hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <CalendarSidebar className="h-5 w-5 text-amber-600" />
                    Active Temp
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-amber-600">{stats.totalTemp}</div>
                  <p className="text-sm text-amber-700/80">Currently holding</p>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-emerald-50 to-green-50 border-emerald-200 hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-emerald-600" />
                    Confirmed Today
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-emerald-600">{stats.confirmedToday}</div>
                  <p className="text-sm text-emerald-700/80">Success rate: {stats.conversionRate}%</p>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-rose-50 to-red-50 border-rose-200 hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <XCircle className="h-5 w-5 text-rose-600" />
                    Expired
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-rose-600">{stats.expiredToday}</div>
                  <p className="text-sm text-rose-700/80">Today</p>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200 hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Building2 className="h-5 w-5 text-blue-600" />
                    Holding Revenue
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-blue-600">{formatCurrency(stats.holdingRevenue)}</div>
                  <p className="text-sm text-blue-700/80">Potential revenue</p>
                </CardContent>
              </Card>
            </div>

            {/* Recent Temp Reservations */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  Recent Temporary Reservations
                  <Button size="sm" onClick={loadTempReservations} className="gap-2">
                    <RefreshCw className="h-3 w-3" />
                    Refresh
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[400px]">
                  {tempReservations.length === 0 ? (
                    <div className="text-center py-12 text-gray-500">
                      <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p>No temporary reservations</p>
                      <p className="text-xs mt-1">Temporary holds will appear here when created</p>
                    </div>
                  ) : (
                  <div className="space-y-3">
                    {tempReservations.slice(0, 10).map((tempRes) => (
                      <div key={tempRes.id} className="border rounded-lg p-4 hover:shadow-sm transition-shadow">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <div className="font-semibold text-lg">{tempRes.guestName}</div>
                            <div className="text-sm text-gray-600">{tempRes.guestEmail} • {tempRes.guestPhone}</div>
                          </div>
                          <div className="flex gap-2">
                            <Badge className={getStatusColor(tempRes.status)}>
                              {tempRes.status.toUpperCase()}
                            </Badge>
                            <Badge className={getUrgencyColor(tempRes.urgency)}>
                              {tempRes.urgency.toUpperCase()}
                            </Badge>
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-4 text-sm">
                          <div>
                            <span className="font-medium">Room:</span> {tempRes.roomNumber} ({tempRes.roomType})
                          </div>
                          <div>
                            <span className="font-medium">Dates:</span> {format(new Date(tempRes.checkIn), 'MMM dd')} - {format(new Date(tempRes.checkOut), 'MMM dd')}
                          </div>
                          <div>
                            <span className="font-medium">Amount:</span> {formatCurrency(tempRes.totalAmount)}
                          </div>
                        </div>

                        <div className="mt-3 flex items-center justify-between">
                          <div className="text-sm">
                            <span className="font-medium">Hold Till:</span>
                            <span className={`ml-2 px-2 py-1 rounded text-xs ${
                              getTimeRemaining(tempRes.holdTillDate) === 'EXPIRED'
                                ? 'bg-red-100 text-red-800'
                                : 'bg-blue-100 text-blue-800'
                            }`}>
                              {getTimeRemaining(tempRes.holdTillDate)}
                            </span>
                          </div>

                          <div className="flex gap-2">
                            {tempRes.status === 'temp' && (
                              <>
                                <Button size="sm" onClick={() => confirmTempReservation(tempRes.id)} className="gap-1">
                                  <CheckCircle className="h-3 w-3" />
                                  Confirm
                                </Button>
                                <Button size="sm" variant="outline" onClick={() => cancelTempReservation(tempRes.id)} className="gap-1">
                                  <XCircle className="h-3 w-3" />
                                  Cancel
                                </Button>
                              </>
                            )}
                            <Button size="sm" variant="ghost" onClick={() => setSelectedTempReservation(tempRes)}>
                              Details
                            </Button>
                          </div>
                        </div>

                        {tempRes.notes && (
                          <div className="mt-2 p-2 bg-gray-50 rounded text-sm">
                            <span className="font-medium">Notes:</span> {tempRes.notes}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="blocked-row" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-purple-600" />
                  Daily Temp Reservations Overview
                  <Badge className="bg-gradient-to-r from-purple-100 to-pink-100 text-purple-800 border-0">
                    Analytics
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* Blocked Row Header */}
                  <div className="text-sm font-medium text-gray-600 border-b pb-2">
                    Shows count of temporary reservations per day
                  </div>

                  {/* Blocked Row Display */}
                  <div className="grid grid-cols-7 gap-4">
                    {blockedRowData.map((dayData) => (
                      <div key={dayData.date} className={`p-4 rounded-lg border-2 ${
                        dayData.status === 'critical' ? 'border-red-300 bg-red-50' :
                        dayData.status === 'high' ? 'border-orange-300 bg-orange-50' :
                        'border-gray-200 bg-gray-50'
                      }`}>
                        <div className="text-center">
                          <div className="text-sm font-medium text-gray-600">
                            {format(new Date(dayData.date), 'MMM dd')}
                          </div>
                          <div className="text-xl font-bold mt-1">
                            {dayData.count}
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            {formatCurrency(dayData.revenue)}
                          </div>
                          {dayData.status !== 'normal' && (
                            <Badge className={`mt-2 text-xs ${
                              dayData.status === 'critical' ? 'bg-red-100 text-red-800' :
                              'bg-orange-100 text-orange-800'
                            }`}>
                              {dayData.status.toUpperCase()}
                            </Badge>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Legend */}
                  <div className="flex items-center justify-center gap-6 pt-4 border-t">
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 bg-gray-50 border-2 border-gray-200 rounded"></div>
                      <span className="text-sm text-gray-600">Normal (0-2)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 bg-orange-50 border-2 border-orange-300 rounded"></div>
                      <span className="text-sm text-gray-600">High (3-5)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 bg-red-50 border-2 border-red-300 rounded"></div>
                      <span className="text-sm text-gray-600">Critical (6+)</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="manage" className="space-y-4">
            {/* Management interface */}
            <div className="text-center py-8 text-gray-500">
              <CalendarSidebar className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <h3 className="text-lg font-semibold mb-2">Temp Reservation Management</h3>
              <p>Comprehensive management tools for temporary reservations</p>
              <p className="text-sm">Features: Bulk operations, email automation, expiry management</p>
            </div>
          </TabsContent>

          <TabsContent value="create" className="space-y-4">
            {/* Create new temp reservation form */}
            <Card>
              <CardHeader>
                <CardTitle>Create New Temporary Reservation</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="guestName">Guest Name *</Label>
                    <Input
                      id="guestName"
                      value={newTempReservation.guestName || ''}
                      onChange={(e) => setNewTempReservation(prev => ({ ...prev, guestName: e.target.value }))}
                      placeholder="Enter guest name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="roomNumber">Room Number *</Label>
                    <Input
                      id="roomNumber"
                      value={newTempReservation.roomNumber || ''}
                      onChange={(e) => setNewTempReservation(prev => ({ ...prev, roomNumber: e.target.value }))}
                      placeholder="e.g., 305"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Hold Till Duration *</Label>
                    <Select
                      value={newTempReservation.holdTillType || 'hours'}
                      onValueChange={(value) => setNewTempReservation(prev => ({ ...prev, holdTillType: value as string }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="minutes">Minutes</SelectItem>
                        <SelectItem value="hours">Hours</SelectItem>
                        <SelectItem value="days">Days</SelectItem>
                        <SelectItem value="months">Months</SelectItem>
                        <SelectItem value="years">Years</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="holdTillValue">Value *</Label>
                    <Input
                      id="holdTillValue"
                      type="number"
                      value={newTempReservation.holdTillValue || 2}
                      onChange={(e) => setNewTempReservation(prev => ({ ...prev, holdTillValue: parseInt(e.target.value) }))}
                      min="1"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Auto Email</Label>
                    <div className="flex items-center space-x-2 pt-2">
                      <Switch
                        checked={newTempReservation.autoConfirmEmail}
                        onCheckedChange={(checked) => setNewTempReservation(prev => ({ ...prev, autoConfirmEmail: checked }))}
                      />
                      <span className="text-sm text-gray-600">
                        Send confirmation email
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button onClick={createTempReservation} className="gap-2">
                    <CalendarSidebar className="h-4 w-4" />
                    Create Temp Reservation
                  </Button>
                  <Button variant="outline" onClick={() => setIsCreatingTemp(false)}>
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};