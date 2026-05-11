import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Building2,
  Clock,
  FileText,
  CreditCard,
  Star,
  Wifi,
  RefreshCw,
  AlertTriangle,
  Info,
  Phone,
  Mail,
  Globe,
  MapPin,
  CheckCircle,
  XCircle,
} from 'lucide-react';
import { cn } from '../../utils/cn';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { api } from '../../services/api';
import { withErrorBoundary } from '../../components/ErrorBoundary';

interface HotelSettingsData {
  basicInfo?: {
    name?: string;
    address?: {
      street?: string;
      city?: string;
      state?: string;
      country?: string;
      postalCode?: string;
    };
    contact?: {
      phone?: string;
      email?: string;
      website?: string;
    };
    starRating?: number;
  };
  operations?: {
    checkInTime?: string;
    checkOutTime?: string;
    currency?: string;
    timezone?: string;
  };
  policies?: {
    cancellation?: string;
    child?: string;
    pet?: string;
    smoking?: string;
    extraBed?: string;
  };
  taxes?: {
    gst?: number;
    serviceCharge?: number;
    localTax?: number;
    tourismTax?: number;
  };
  amenities?: Array<{
    _id: string;
    name: string;
    category: string;
    enabled: boolean;
    chargeable: boolean;
    price?: number;
  }>;
  bookingRules?: {
    minimumStay?: { enabled: boolean; nights: number; applyToWeekends: boolean };
    maximumStay?: { enabled: boolean; nights: number };
    advanceBooking?: { minDays: number; maxDays: number };
    cutoffTime?: { hours: number; sameDay: boolean };
    cancellationWindow?: { hours: number; penaltyPercentage: number };
  };
}

const fetchHotelSettings = async (): Promise<HotelSettingsData> => {
  const { data } = await api.get('/hotel-settings');
  return data.data?.settings || data.data || {};
};

type TabKey = 'info' | 'operations' | 'policies' | 'rates' | 'amenities';

const tabs: { key: TabKey; label: string; icon: React.ElementType }[] = [
  { key: 'info', label: 'Hotel Info', icon: Building2 },
  { key: 'operations', label: 'Check-in/out', icon: Clock },
  { key: 'policies', label: 'Policies', icon: FileText },
  { key: 'rates', label: 'Rates & Taxes', icon: CreditCard },
  { key: 'amenities', label: 'Amenities', icon: Star },
];

function FrontDeskSettings() {
  const [activeTab, setActiveTab] = useState<TabKey>('info');
  const [refreshing, setRefreshing] = useState(false);

  const {
    data: settings,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['frontdesk-hotel-settings'],
    queryFn: fetchHotelSettings,
    staleTime: 5 * 60 * 1000,
  });

  const handleRefresh = () => {
    setRefreshing(true);
    refetch().finally(() => setTimeout(() => setRefreshing(false), 500));
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <LoadingSpinner size="large" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <AlertTriangle className="mx-auto h-12 w-12 text-red-500 mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">Failed to load hotel settings</h3>
        <p className="text-gray-500 mb-4">There was an error loading the hotel configuration.</p>
        <Button onClick={() => refetch()}>Try Again</Button>
      </div>
    );
  }

  const formatAddress = (address?: HotelSettingsData['basicInfo']['address']) => {
    if (!address) return 'Not configured';
    const parts = [address.street, address.city, address.state, address.country, address.postalCode].filter(Boolean);
    return parts.length > 0 ? parts.join(', ') : 'Not configured';
  };

  const renderStarRating = (rating?: number) => {
    if (!rating) return <span className="text-gray-400">Not set</span>;
    return (
      <div className="flex items-center gap-1">
        {Array.from({ length: 5 }, (_, i) => (
          <Star
            key={i}
            className={cn(
              'w-4 h-4',
              i < rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'
            )}
          />
        ))}
        <span className="ml-1 text-sm text-gray-600">({rating} star{rating !== 1 ? 's' : ''})</span>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Hotel Settings</h1>
          <p className="text-gray-600">View hotel configuration and policies for guest inquiries</p>
        </div>
        <Button
          onClick={handleRefresh}
          disabled={refreshing}
          variant="outline"
          className="flex items-center"
        >
          <RefreshCw className={cn('w-4 h-4 mr-2', refreshing && 'animate-spin')} />
          Refresh
        </Button>
      </div>

      {/* Info Notice */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-800 flex items-start gap-2">
          <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span>
            <strong>Read-Only View:</strong> This page displays the current hotel configuration so you can answer
            guest questions. To modify settings, please contact an administrator.
          </span>
        </p>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-4 overflow-x-auto" aria-label="Settings tabs">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                'flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 whitespace-nowrap transition-colors',
                activeTab === tab.key
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              )}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="space-y-6">
        {activeTab === 'info' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Building2 className="w-5 h-5" />
                  Basic Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">Hotel Name</label>
                  <p className="text-gray-900 mt-1">{settings?.basicInfo?.name || 'Not configured'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Star Rating</label>
                  <div className="mt-1">{renderStarRating(settings?.basicInfo?.starRating)}</div>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Address</label>
                  <p className="text-gray-900 mt-1 flex items-start gap-2">
                    <MapPin className="w-4 h-4 mt-0.5 text-gray-400 flex-shrink-0" />
                    {formatAddress(settings?.basicInfo?.address)}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Phone className="w-5 h-5" />
                  Contact Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3">
                  <Phone className="w-4 h-4 text-gray-400" />
                  <div>
                    <label className="text-sm font-medium text-gray-500">Phone</label>
                    <p className="text-gray-900">{settings?.basicInfo?.contact?.phone || 'Not configured'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Mail className="w-4 h-4 text-gray-400" />
                  <div>
                    <label className="text-sm font-medium text-gray-500">Email</label>
                    <p className="text-gray-900">{settings?.basicInfo?.contact?.email || 'Not configured'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Globe className="w-4 h-4 text-gray-400" />
                  <div>
                    <label className="text-sm font-medium text-gray-500">Website</label>
                    <p className="text-gray-900">{settings?.basicInfo?.contact?.website || 'Not configured'}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === 'operations' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Clock className="w-5 h-5" />
                  Check-in / Check-out Times
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-6">
                  <div className="bg-green-50 rounded-lg p-4 text-center">
                    <p className="text-sm text-green-600 font-medium">Check-in Time</p>
                    <p className="text-3xl font-bold text-green-800 mt-1">
                      {settings?.operations?.checkInTime || '--:--'}
                    </p>
                  </div>
                  <div className="bg-orange-50 rounded-lg p-4 text-center">
                    <p className="text-sm text-orange-600 font-medium">Check-out Time</p>
                    <p className="text-3xl font-bold text-orange-800 mt-1">
                      {settings?.operations?.checkOutTime || '--:--'}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Globe className="w-5 h-5" />
                  Operational Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <span className="text-sm text-gray-600">Currency</span>
                  <Badge variant="outline">{settings?.operations?.currency || 'INR'}</Badge>
                </div>
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <span className="text-sm text-gray-600">Timezone</span>
                  <Badge variant="outline">{settings?.operations?.timezone || 'Asia/Kolkata'}</Badge>
                </div>
              </CardContent>
            </Card>

            {settings?.bookingRules && (
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <FileText className="w-5 h-5" />
                    Booking Rules
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <p className="text-sm font-medium text-gray-700">Minimum Stay</p>
                      <p className="text-gray-900 mt-1">
                        {settings.bookingRules.minimumStay?.enabled
                          ? `${settings.bookingRules.minimumStay.nights} night(s)`
                          : 'No minimum'}
                      </p>
                    </div>
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <p className="text-sm font-medium text-gray-700">Maximum Stay</p>
                      <p className="text-gray-900 mt-1">
                        {settings.bookingRules.maximumStay?.enabled
                          ? `${settings.bookingRules.maximumStay.nights} night(s)`
                          : 'No maximum'}
                      </p>
                    </div>
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <p className="text-sm font-medium text-gray-700">Advance Booking</p>
                      <p className="text-gray-900 mt-1">
                        {settings.bookingRules.advanceBooking
                          ? `${settings.bookingRules.advanceBooking.minDays} - ${settings.bookingRules.advanceBooking.maxDays} days`
                          : 'Not configured'}
                      </p>
                    </div>
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <p className="text-sm font-medium text-gray-700">Cutoff Time</p>
                      <p className="text-gray-900 mt-1">
                        {settings.bookingRules.cutoffTime
                          ? `${settings.bookingRules.cutoffTime.hours} hours before`
                          : 'Not configured'}
                      </p>
                    </div>
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <p className="text-sm font-medium text-gray-700">Cancellation Window</p>
                      <p className="text-gray-900 mt-1">
                        {settings.bookingRules.cancellationWindow
                          ? `${settings.bookingRules.cancellationWindow.hours}h (${settings.bookingRules.cancellationWindow.penaltyPercentage}% penalty)`
                          : 'Not configured'}
                      </p>
                    </div>
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <p className="text-sm font-medium text-gray-700">Same-day Booking</p>
                      <p className="text-gray-900 mt-1">
                        {settings.bookingRules.cutoffTime?.sameDay ? 'Allowed' : 'Not allowed'}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {activeTab === 'policies' && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Hotel Policies
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[
                  { label: 'Cancellation Policy', value: settings?.policies?.cancellation, icon: XCircle },
                  { label: 'Child Policy', value: settings?.policies?.child, icon: Info },
                  { label: 'Pet Policy', value: settings?.policies?.pet, icon: Info },
                  { label: 'Smoking Policy', value: settings?.policies?.smoking, icon: Info },
                  { label: 'Extra Bed Policy', value: settings?.policies?.extraBed, icon: Info },
                ].map((policy) => (
                  <div
                    key={policy.label}
                    className="p-4 bg-gray-50 rounded-lg border border-gray-100"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <policy.icon className="w-4 h-4 text-gray-500" />
                      <h4 className="text-sm font-semibold text-gray-700">{policy.label}</h4>
                    </div>
                    <p className="text-gray-900 text-sm">
                      {policy.value || 'Not configured'}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {activeTab === 'rates' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <CreditCard className="w-5 h-5" />
                  Tax Configuration
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {[
                    { label: 'GST', value: settings?.taxes?.gst },
                    { label: 'Service Charge', value: settings?.taxes?.serviceCharge },
                    { label: 'Local Tax', value: settings?.taxes?.localTax },
                    { label: 'Tourism Tax', value: settings?.taxes?.tourismTax },
                  ].map((tax) => (
                    <div
                      key={tax.label}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                    >
                      <span className="text-sm font-medium text-gray-700">{tax.label}</span>
                      <Badge variant="outline">
                        {tax.value != null ? `${tax.value}%` : 'Not set'}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Wifi className="w-5 h-5" />
                  Payment Methods
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8 text-gray-500">
                  <CreditCard className="mx-auto h-8 w-8 text-gray-400 mb-2" />
                  <p className="text-sm">Payment gateway details are managed by administrators.</p>
                  <p className="text-sm mt-1">Contact your admin for payment configuration inquiries.</p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === 'amenities' && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Star className="w-5 h-5" />
                Hotel Amenities & Facilities
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!settings?.amenities || settings.amenities.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Star className="mx-auto h-8 w-8 text-gray-400 mb-2" />
                  <p>No amenities configured yet</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Group amenities by category */}
                  {Object.entries(
                    settings.amenities.reduce<Record<string, typeof settings.amenities>>(
                      (groups, amenity) => {
                        const cat = amenity.category || 'General';
                        if (!groups[cat]) groups[cat] = [];
                        groups[cat].push(amenity);
                        return groups;
                      },
                      {}
                    )
                  ).map(([category, amenities]) => (
                    <div key={category}>
                      <h4 className="text-sm font-semibold text-gray-700 mb-3 capitalize">{category}</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {amenities.map((amenity) => (
                          <div
                            key={amenity._id}
                            className={cn(
                              'flex items-center justify-between p-3 rounded-lg border',
                              amenity.enabled
                                ? 'bg-green-50 border-green-200'
                                : 'bg-gray-50 border-gray-200 opacity-60'
                            )}
                          >
                            <div className="flex items-center gap-2">
                              {amenity.enabled ? (
                                <CheckCircle className="w-4 h-4 text-green-500" />
                              ) : (
                                <XCircle className="w-4 h-4 text-gray-400" />
                              )}
                              <span className="text-sm font-medium text-gray-900">{amenity.name}</span>
                            </div>
                            {amenity.chargeable && amenity.price != null && (
                              <Badge variant="secondary" className="text-xs">
                                Paid
                              </Badge>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

export default withErrorBoundary(FrontDeskSettings);
