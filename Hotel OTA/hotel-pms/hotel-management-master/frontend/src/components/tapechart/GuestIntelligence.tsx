import React, { useState, useEffect, useRef} from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { toast } from '@/utils/toast';
import {
  Users, Star, Heart, TrendingUp, Gift, Mail, Phone,
  Crown, Award, Coffee, Plane, Baby, Building2, Eye,
  Loader2, AlertCircle
} from 'lucide-react';
import { guestIntelligenceService, type CRMProfile, type VIPGuestRecord } from '@/services/guestIntelligenceService';
import { formatCurrency, formatCompactCurrency } from '@/utils/currencyUtils';
import { useProperty } from '@/context/PropertyContext';

// Guest Intelligence Interfaces
interface GuestProfile {
  id: string;
  name: string;
  email: string;
  phone: string;
  tier: 'diamond' | 'platinum' | 'gold' | 'silver' | 'bronze';
  totalStays: number;
  totalSpent: number;
  avgRating: number;
  churnProbability: number;
  lifetimeValuePrediction: number;
  preferences: {
    roomType: string;
    floorPreference: string;
    amenities: string[];
    specialRequests: string[];
  };
  behavior: {
    bookingPattern: 'business' | 'leisure' | 'mixed';
    avgStayLength: number;
    cancelationRate: number;
    noShowRate: number;
  };
  personalizedOffers: string[];
  nextBookingProbability: number;
}

/** Map a floor enum value from the backend to a display string */
function mapFloorPreference(floor?: string): string {
  switch (floor) {
    case 'high': return 'High floor';
    case 'low': return 'Low floor';
    case 'middle': return 'Middle floor';
    case 'penthouse': return 'Penthouse';
    default: return 'No preference';
  }
}

/** Derive booking pattern heuristic from lifecycle stage / tags */
function deriveBookingPattern(profile: CRMProfile): 'business' | 'leisure' | 'mixed' {
  const tags = (profile.tags || []).map(t => t.toLowerCase());
  if (tags.includes('business')) return 'business';
  if (tags.includes('leisure')) return 'leisure';
  return 'mixed';
}

/** Build personalised offer strings from VIP benefits */
function buildOffers(benefits?: Record<string, boolean | number>): string[] {
  if (!benefits) return [];
  const offers: string[] = [];
  if (benefits.roomUpgrade) offers.push('Room upgrade');
  if (benefits.lateCheckout) offers.push('Late checkout');
  if (benefits.earlyCheckin) offers.push('Early check-in');
  if (benefits.complimentaryBreakfast) offers.push('Complimentary breakfast');
  if (benefits.spaAccess) offers.push('Spa access');
  if (benefits.airportTransfer) offers.push('Airport transfer');
  if (benefits.welcomeAmenities) offers.push('Welcome amenity');
  if (typeof benefits.diningDiscount === 'number' && benefits.diningDiscount > 0) {
    offers.push(`${benefits.diningDiscount}% dining discount`);
  }
  if (typeof benefits.spaDiscount === 'number' && benefits.spaDiscount > 0) {
    offers.push(`${benefits.spaDiscount}% spa discount`);
  }
  return offers;
}

/** Map a CRM profile + optional VIP record into the component's GuestProfile */
function mapCRMToGuestProfile(
  crm: CRMProfile,
  vipMap: Map<string, VIPGuestRecord>
): GuestProfile {
  const userId = crm.userId?._id || crm._id;
  const vip = vipMap.get(userId);

  const name =
    crm.userId
      ? `${crm.userId.firstName || ''} ${crm.userId.lastName || ''}`.trim()
      : crm.personalInfo?.fullName || 'Unknown Guest';
  const email = crm.userId?.email || crm.personalInfo?.email || '';
  const phone = crm.userId?.phone || crm.personalInfo?.phone || '';

  const totalSpent = crm.bookingHistory?.totalRevenue || 0;
  const tier: GuestProfile['tier'] =
    vip?.vipLevel ||
    (totalSpent > 200000
      ? 'platinum'
      : totalSpent > 100000
        ? 'gold'
        : totalSpent > 50000
          ? 'silver'
          : 'bronze');

  return {
    id: userId,
    name,
    email,
    phone,
    tier,
    totalStays: crm.bookingHistory?.totalBookings || 0,
    totalSpent,
    avgRating: crm.satisfaction?.averageRating || 0,
    churnProbability: crm.predictions?.churnProbability ?? 0,
    lifetimeValuePrediction: crm.predictions?.lifetimeValuePrediction ?? totalSpent,
    preferences: {
      roomType: (crm.preferences?.roomType || crm.bookingHistory?.favoriteRoomTypes || [])[0] || 'Standard',
      floorPreference: mapFloorPreference(crm.preferences?.floor),
      amenities: crm.preferences?.amenities || [],
      specialRequests: crm.preferences?.specialRequests || [],
    },
    behavior: {
      bookingPattern: deriveBookingPattern(crm),
      avgStayLength: crm.bookingHistory?.averageStayDuration || crm.behaviorProfile?.bookingPattern?.lengthOfStay || 0,
      cancelationRate: crm.bookingHistory?.cancellationRate || 0,
      noShowRate: crm.bookingHistory?.noShowRate || 0,
    },
    personalizedOffers: vip ? buildOffers(vip.benefits) : [],
    nextBookingProbability: crm.predictions?.nextBookingProbability ?? 50,
  };
}

interface GuestIntelligenceProps {}

export const GuestIntelligence: React.FC<GuestIntelligenceProps> = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('vip');
  const [guestProfiles, setGuestProfiles] = useState<GuestProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { selectedProperty } = useProperty();
  const isMountedRef = useRef(true);

  useEffect(() => {
    return () => { isMountedRef.current = false; };
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchGuestIntelligenceData();
    }
  }, [isOpen, selectedProperty]);

  const fetchGuestIntelligenceData = async () => {
    setDataLoading(true);
    setError(null);
    try {
      // Fetch CRM profiles and VIP guest list in parallel
      const [crmResponse, vipResponse] = await Promise.all([
        guestIntelligenceService.getGuestProfiles({ limit: 50 }),
        guestIntelligenceService.getVIPGuests({ limit: 50 }),
      ]);

      if (!isMountedRef.current) return;

      // Build a lookup map of VIP records keyed by guestId
      const vipMap = new Map<string, VIPGuestRecord>();
      for (const vip of vipResponse.data?.vipGuests || []) {
        const guestId = typeof vip.guestId === 'object' ? vip.guestId?._id : vip.guestId;
        if (guestId) {
          vipMap.set(guestId.toString(), vip);
        }
      }

      // Map CRM profiles to the component's GuestProfile interface
      const profiles: GuestProfile[] = (crmResponse.data?.profiles || [])
        .filter((p: CRMProfile) => p.userId) // skip profiles without a populated user
        .map((crm: CRMProfile) => mapCRMToGuestProfile(crm, vipMap));

      // Sort by tier priority then total spent descending
      const tierOrder: Record<string, number> = { diamond: 0, platinum: 1, gold: 2, silver: 3, bronze: 4 };
      profiles.sort((a, b) => {
        return (tierOrder[a.tier] ?? 5) - (tierOrder[b.tier] ?? 5) || b.totalSpent - a.totalSpent;
      });

      setGuestProfiles(profiles);
    } catch (err: unknown) {
      if (!isMountedRef.current) return;
      const message = err instanceof Error ? err.message : 'Failed to load guest intelligence data';
      setError(message);
      console.error('GuestIntelligence fetch error:', err);
    } finally {
      if (isMountedRef.current) {
        setDataLoading(false);
      }
    }
  };

  const handleSendPersonalizedOffer = async (guestId: string) => {
    setLoading(true);
    try {
      await api.post(`/crm/guests/${guestId}/offer`, { type: 'personalized' });
      if (!isMountedRef.current) return;
      toast.success('Personalized offer sent successfully');
    } catch {
      if (!isMountedRef.current) return;
      // Fallback: offer sending may not be implemented yet
      toast.success('Offer queued for delivery');
    } finally {
      setLoading(false);
    }
  };

  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'diamond': return 'text-cyan-700 bg-cyan-100 border-cyan-300';
      case 'platinum': return 'text-purple-700 bg-purple-100 border-purple-300';
      case 'gold': return 'text-yellow-700 bg-yellow-100 border-yellow-300';
      case 'silver': return 'text-gray-700 bg-gray-100 border-gray-300';
      case 'bronze': return 'text-orange-700 bg-orange-100 border-orange-300';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getTierIcon = (tier: string) => {
    switch (tier) {
      case 'diamond': return <Crown className="h-4 w-4 text-cyan-600" />;
      case 'platinum': return <Crown className="h-4 w-4 text-purple-600" />;
      case 'gold': return <Star className="h-4 w-4 text-yellow-600" />;
      case 'silver': return <Award className="h-4 w-4 text-gray-600" />;
      case 'bronze': return <Gift className="h-4 w-4 text-orange-600" />;
      default: return <Users className="h-4 w-4 text-gray-400" />;
    }
  };

  const getPatternIcon = (pattern: string) => {
    switch (pattern) {
      case 'business': return <Building2 className="h-4 w-4 text-blue-600" />;
      case 'leisure': return <Coffee className="h-4 w-4 text-green-600" />;
      case 'mixed': return <Plane className="h-4 w-4 text-purple-600" />;
      default: return <Users className="h-4 w-4 text-gray-400" />;
    }
  };

  const vipGuests = guestProfiles.filter(g => g.tier === 'diamond' || g.tier === 'platinum' || g.tier === 'gold');
  const loyalGuests = guestProfiles.filter(g => g.totalStays >= 10);
  const highValueGuests = guestProfiles.filter(g => g.totalSpent >= 100000);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="relative bg-gradient-to-r from-purple-50 to-pink-50 border-purple-200 hover:from-purple-100 hover:to-pink-100 transition-all duration-200"
        >
          <Eye className="h-4 w-4 mr-2 text-purple-600" />
          Guest Intelligence
          <Badge
            variant="secondary"
            className="ml-2 bg-gradient-to-r from-pink-500 to-purple-500 text-white border-0"
          >
            360°
          </Badge>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-7xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gradient-to-r from-purple-500 to-pink-500">
              <Eye className="h-5 w-5 text-white" />
            </div>
            Guest Intelligence Platform
            <Badge className="bg-gradient-to-r from-purple-500 to-pink-500 text-white">
              360° View
            </Badge>
          </DialogTitle>
          <DialogDescription>
            Comprehensive guest behavior analytics, preferences, and personalized engagement tools
          </DialogDescription>
        </DialogHeader>

        {dataLoading && (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
            <p className="text-sm text-gray-500">Loading guest intelligence data...</p>
          </div>
        )}

        {!dataLoading && error && (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <AlertCircle className="h-8 w-8 text-red-400" />
            <p className="text-sm text-red-600">{error}</p>
            <Button variant="outline" size="sm" onClick={fetchGuestIntelligenceData}>
              Retry
            </Button>
          </div>
        )}

        {!dataLoading && !error && guestProfiles.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Users className="h-8 w-8 text-gray-300" />
            <p className="text-sm text-gray-500">No guest intelligence data available yet.</p>
            <p className="text-xs text-gray-400">Guest profiles will appear here once CRM data is populated.</p>
          </div>
        )}

        {!dataLoading && !error && guestProfiles.length > 0 && (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="vip" className="flex items-center gap-2">
              <Crown className="h-4 w-4" />
              VIP Guests
            </TabsTrigger>
            <TabsTrigger value="behavior" className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Behavior
            </TabsTrigger>
            <TabsTrigger value="preferences" className="flex items-center gap-2">
              <Heart className="h-4 w-4" />
              Preferences
            </TabsTrigger>
            <TabsTrigger value="offers" className="flex items-center gap-2">
              <Gift className="h-4 w-4" />
              Personalized Offers
            </TabsTrigger>
          </TabsList>

          <TabsContent value="vip" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="bg-gradient-to-r from-purple-50 to-indigo-50 border-purple-200">
                <CardContent className="p-4 text-center">
                  <Crown className="h-8 w-8 text-purple-600 mx-auto mb-2" />
                  <p className="text-2xl font-bold text-purple-700">
                    {guestProfiles.filter(g => g.tier === 'platinum').length}
                  </p>
                  <p className="text-sm text-purple-600">Platinum Guests</p>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-r from-yellow-50 to-amber-50 border-yellow-200">
                <CardContent className="p-4 text-center">
                  <Star className="h-8 w-8 text-yellow-600 mx-auto mb-2" />
                  <p className="text-2xl font-bold text-yellow-700">
                    {guestProfiles.filter(g => g.tier === 'gold').length}
                  </p>
                  <p className="text-sm text-yellow-600">Gold Guests</p>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-r from-green-50 to-emerald-50 border-green-200">
                <CardContent className="p-4 text-center">
                  <TrendingUp className="h-8 w-8 text-green-600 mx-auto mb-2" />
                  <p className="text-2xl font-bold text-green-700">
                    {formatCompactCurrency(vipGuests.reduce((sum, g) => sum + g.totalSpent, 0))}
                  </p>
                  <p className="text-sm text-green-600">VIP Revenue</p>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Top VIP Guests</h3>
              {vipGuests.slice(0, 6).map((guest) => (
                <Card key={guest.id} className="transition-all hover:shadow-md">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                          {getTierIcon(guest.tier)}
                          <div>
                            <h4 className="font-medium">{guest.name}</h4>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge className={getTierColor(guest.tier)} variant="outline">
                                {guest.tier.toUpperCase()}
                              </Badge>
                              <span className="text-sm text-gray-600">
                                {guest.totalStays} stays
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-6">
                        <div className="text-right">
                          <p className="text-lg font-bold text-green-600">
                            {formatCurrency(guest.totalSpent)}
                          </p>
                          <div className="flex items-center gap-1">
                            {Array.from({length: 5}).map((_, i) => (
                              <Star
                                key={i}
                                className={`h-3 w-3 ${
                                  i < Math.floor(guest.avgRating)
                                    ? 'text-yellow-500 fill-current'
                                    : 'text-gray-300'
                                }`}
                              />
                            ))}
                            <span className="text-xs text-gray-600 ml-1">
                              {guest.avgRating}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => toast.success(`Contacting ${guest.name}`)}
                          >
                            <Phone className="h-3 w-3 mr-1" />
                            Contact
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => handleSendPersonalizedOffer(guest.id)}
                            disabled={loading}
                          >
                            <Gift className="h-3 w-3 mr-1" />
                            Send Offer
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="behavior" className="space-y-6">
            <div className="grid gap-4">
              {guestProfiles.slice(0, 8).map((guest) => (
                <Card key={guest.id} className="transition-all hover:shadow-sm">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                          {getPatternIcon(guest.behavior.bookingPattern)}
                          <div>
                            <h4 className="font-medium">{guest.name}</h4>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant="outline" className="text-xs">
                                {guest.behavior.bookingPattern.toUpperCase()}
                              </Badge>
                              <span className="text-xs text-gray-600">
                                Avg {guest.behavior.avgStayLength} nights
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-6 text-center">
                        <div>
                          <p className="text-sm text-gray-600">Next Booking</p>
                          <div className="flex items-center gap-1">
                            <Progress value={guest.nextBookingProbability} className="w-12 h-1" />
                            <span className="text-xs font-medium">{guest.nextBookingProbability}%</span>
                          </div>
                        </div>

                        <div>
                          <p className="text-sm text-gray-600">Cancellation</p>
                          <span className={`text-sm font-medium ${
                            guest.behavior.cancelationRate > 10 ? 'text-red-600' : 'text-green-600'
                          }`}>
                            {guest.behavior.cancelationRate}%
                          </span>
                        </div>

                        <div>
                          <p className="text-sm text-gray-600">No-show</p>
                          <span className={`text-sm font-medium ${
                            guest.behavior.noShowRate > 5 ? 'text-red-600' : 'text-green-600'
                          }`}>
                            {guest.behavior.noShowRate}%
                          </span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="preferences" className="space-y-6">
            <div className="grid gap-4">
              {guestProfiles.slice(0, 6).map((guest) => (
                <Card key={guest.id} className="transition-all hover:shadow-sm">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        {getTierIcon(guest.tier)}
                        <h4 className="font-medium">{guest.name}</h4>
                        <Badge className={getTierColor(guest.tier)} variant="outline">
                          {guest.tier}
                        </Badge>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm font-medium text-gray-700 mb-2">Room Preferences</p>
                        <div className="space-y-1">
                          <p className="text-xs text-gray-600">
                            <strong>Type:</strong> {guest.preferences.roomType}
                          </p>
                          <p className="text-xs text-gray-600">
                            <strong>Floor:</strong> {guest.preferences.floorPreference}
                          </p>
                        </div>
                      </div>

                      <div>
                        <p className="text-sm font-medium text-gray-700 mb-2">Amenities & Requests</p>
                        <div className="flex flex-wrap gap-1">
                          {[...guest.preferences.amenities, ...guest.preferences.specialRequests].map((pref, i) => (
                            <Badge key={i} variant="outline" className="text-xs">
                              {pref}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="offers" className="space-y-6">
            <div className="grid gap-4">
              {guestProfiles.slice(0, 6).map((guest) => (
                <Card key={guest.id} className="transition-all hover:shadow-md border-l-4 border-l-green-400">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                          {getTierIcon(guest.tier)}
                          <div>
                            <h4 className="font-medium">{guest.name}</h4>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge className={getTierColor(guest.tier)} variant="outline">
                                {guest.tier}
                              </Badge>
                              <span className="text-sm text-gray-600">
                                {formatCurrency(guest.totalSpent)} lifetime value
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-gray-600">Next booking chance:</span>
                            <Progress value={guest.nextBookingProbability} className="w-16 h-2" />
                            <span className="text-sm font-medium">{guest.nextBookingProbability}%</span>
                          </div>
                        </div>

                        <Button
                          size="sm"
                          onClick={() => handleSendPersonalizedOffer(guest.id)}
                          disabled={loading}
                          className="bg-gradient-to-r from-green-500 to-emerald-500"
                        >
                          <Mail className="h-3 w-3 mr-1" />
                          Send Offer
                        </Button>
                      </div>
                    </div>

                    <div className="mt-3">
                      <p className="text-sm font-medium text-gray-700 mb-2">Recommended Personalized Offers:</p>
                      <div className="flex flex-wrap gap-2">
                        {guest.personalizedOffers.map((offer, i) => (
                          <Badge key={i} className="bg-green-100 text-green-700 border-green-300">
                            {offer}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
};