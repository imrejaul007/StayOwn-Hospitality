import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { toast } from '@/utils/toast';
import {
  Crown,
  Star,
  Building2,
  User,
  Calendar,
  IndianRupee,
  MapPin,
  Clock,
  Bell,
  Gift,
  Car,
  Utensils,
  Wifi,
  Dumbbell,
  Coffee,
  Wine,
  Bed,
  Bath,
  Shirt,
  Phone,
  Mail,
  MessageSquare,
  CheckCircle,
  AlertTriangle,
  Eye,
  Edit,
  Save,
  X,
  Plus,
  Minus,
  Search,
  Filter,
  TrendingUp,
  Heart,
  Award,
  Sparkles
} from 'lucide-react';
import { cn } from '@/utils/cn';
import { format, formatDistanceToNow } from 'date-fns';
import { workflowEngine } from '@/utils/ReservationWorkflowEngine';
import { withErrorBoundary } from '../ErrorBoundary';
import { formatCurrency } from '@/utils/currencyUtils';
import { api } from '@/services/api';

interface VIPProfile {
  id: string;
  guestId: string;
  guestName: string;
  email: string;
  phone: string;
  vipTier: 'vip' | 'svip' | 'corporate' | 'diamond';
  memberSince: Date;
  totalSpend: number;
  visitCount: number;
  lastVisit?: Date;
  preferences: {
    roomType: string[];
    floor: number[];
    bedType: 'king' | 'queen' | 'twin' | 'suite';
    roomTemperature: number;
    pillow: 'soft' | 'medium' | 'firm';
    wakeUpCall: boolean;
    turndownService: boolean;
    newspaper: string;
    roomService: boolean;
    quietRoom: boolean;
    highFloor: boolean;
    cityView: boolean;
    oceanView: boolean;
  };
  amenities: {
    airportTransfer: boolean;
    personalConcierge: boolean;
    priorityCheckIn: boolean;
    lateCheckout: boolean;
    complimentaryUpgrade: boolean;
    welcomeAmenities: boolean;
    dailyBreakfast: boolean;
    loungeAccess: boolean;
    spaAccess: boolean;
    gymAccess: boolean;
    vipParking: boolean;
  };
  allergies: string[];
  dietaryRestrictions: string[];
  specialRequests: Array<{
    type: string;
    description: string;
    priority: 'low' | 'medium' | 'high';
    status: 'pending' | 'approved' | 'rejected' | 'completed';
  }>;
  notes: Array<{
    date: Date;
    author: string;
    content: string;
    private: boolean;
    category: 'preference' | 'incident' | 'compliment' | 'complaint' | 'general';
  }>;
  currentReservation?: unknown;
  status: 'active' | 'inactive' | 'blocked';
}

interface VIPGuestManagerProps {
  isOpen: boolean;
  onClose: () => void;
  selectedGuest?: unknown;
  className?: string;
}

const VIPGuestManager: React.FC<VIPGuestManagerProps> = ({
  isOpen,
  onClose,
  selectedGuest,
  className
}) => {
  const [vipGuests, setVipGuests] = useState<VIPProfile[]>([]);
  const [filteredGuests, setFilteredGuests] = useState<VIPProfile[]>([]);
  const [selectedVipGuest, setSelectedVipGuest] = useState<VIPProfile | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [tierFilter, setTierFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showGuestDetails, setShowGuestDetails] = useState(false);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [editingProfile, setEditingProfile] = useState<VIPProfile | null>(null);
  const [newNote, setNewNote] = useState('');
  const [noteCategory, setNoteCategory] = useState<'preference' | 'incident' | 'compliment' | 'complaint' | 'general'>('general');
  const [isPrivateNote, setIsPrivateNote] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  /** Map backend vipLevel (bronze/silver/gold/platinum/diamond) to frontend vipTier */
  const mapVipLevelToTier = (vipLevel: string): VIPProfile['vipTier'] => {
    const tierMap: Record<string, VIPProfile['vipTier']> = {
      diamond: 'diamond',
      platinum: 'svip',
      gold: 'vip',
      silver: 'vip',
      bronze: 'corporate',
    };
    return tierMap[vipLevel] || 'vip';
  };

  /** Map frontend vipTier back to backend vipLevel */
  const mapTierToVipLevel = (tier: VIPProfile['vipTier']): string => {
    const levelMap: Record<string, string> = {
      diamond: 'diamond',
      svip: 'platinum',
      vip: 'gold',
      corporate: 'bronze',
    };
    return levelMap[tier] || 'gold';
  };

  /** Map backend status to frontend status */
  const mapBackendStatus = (status: string): VIPProfile['status'] => {
    const statusMap: Record<string, VIPProfile['status']> = {
      active: 'active',
      inactive: 'inactive',
      suspended: 'blocked',
      pending: 'inactive',
    };
    return statusMap[status] || 'active';
  };

  /** Map a single backend VIPGuest record to the frontend VIPProfile interface */
  const mapApiGuestToProfile = (apiGuest: Record<string, unknown>): VIPProfile => {
    const guest = apiGuest as Record<string, unknown>;
    const guestUser = (guest.guestId && typeof guest.guestId === 'object' ? guest.guestId : {}) as Record<string, unknown>;
    const qualCriteria = (guest.qualificationCriteria || {}) as Record<string, unknown>;
    const benefits = (guest.benefits || {}) as Record<string, unknown>;
    const enhancedPrefs = (guest.enhancedPreferences || {}) as Record<string, unknown>;
    const roomPrefs = (enhancedPrefs.roomPreferences || {}) as Record<string, unknown>;
    const servicePrefs = (enhancedPrefs.servicePreferences || {}) as Record<string, unknown>;
    const diningPrefs = (enhancedPrefs.diningPreferences || {}) as Record<string, unknown>;
    const loyalty = (guest.loyaltyProgram || {}) as Record<string, unknown>;
    const activityTracking = (guest.activityTracking || {}) as Record<string, unknown>;

    return {
      id: (guest._id || guest.id || '') as string,
      guestId: (typeof guest.guestId === 'string' ? guest.guestId : (guestUser._id || guestUser.id || '')) as string,
      guestName: (guestUser.name || 'Unknown Guest') as string,
      email: (guestUser.email || '') as string,
      phone: (guestUser.phone || '') as string,
      vipTier: mapVipLevelToTier((guest.vipLevel || 'gold') as string),
      memberSince: new Date((loyalty.membershipStartDate || guest.createdAt || new Date()) as string),
      totalSpend: ((qualCriteria.totalSpent || activityTracking.currentYearSpending || 0) as number),
      visitCount: ((qualCriteria.totalStays || activityTracking.currentYearStays || 0) as number),
      lastVisit: qualCriteria.lastStayDate ? new Date(qualCriteria.lastStayDate as string) : undefined,
      preferences: {
        roomType: roomPrefs.preferredRoomType ? [roomPrefs.preferredRoomType as string] : [],
        floor: roomPrefs.preferredFloor ? [parseInt(roomPrefs.preferredFloor as string, 10) || 1] : [],
        bedType: (roomPrefs.bedType || 'king') as VIPProfile['preferences']['bedType'],
        roomTemperature: 22,
        pillow: 'medium',
        wakeUpCall: (servicePrefs.wakeUpCall || false) as boolean,
        turndownService: (servicePrefs.turndownService || false) as boolean,
        newspaper: '',
        roomService: false,
        quietRoom: false,
        highFloor: roomPrefs.preferredFloor ? parseInt(roomPrefs.preferredFloor as string, 10) > 10 : false,
        cityView: roomPrefs.preferredView === 'city',
        oceanView: roomPrefs.preferredView === 'ocean' || roomPrefs.preferredView === 'sea',
      },
      amenities: {
        airportTransfer: (benefits.airportTransfer || false) as boolean,
        personalConcierge: (benefits.conciergeService || false) as boolean,
        priorityCheckIn: (benefits.priorityReservation || false) as boolean,
        lateCheckout: (benefits.lateCheckout || false) as boolean,
        complimentaryUpgrade: (benefits.roomUpgrade || false) as boolean,
        welcomeAmenities: (benefits.welcomeAmenities || false) as boolean,
        dailyBreakfast: (benefits.complimentaryBreakfast || false) as boolean,
        loungeAccess: false,
        spaAccess: (benefits.spaAccess || false) as boolean,
        gymAccess: false,
        vipParking: false,
      },
      allergies: ((diningPrefs.allergies || []) as string[]),
      dietaryRestrictions: ((diningPrefs.diningRestrictions || []) as string[]),
      specialRequests: ((guest.specialRequests || []) as string[]).map((req: string) => ({
        type: 'General',
        description: req,
        priority: 'medium' as const,
        status: 'pending' as const,
      })),
      notes: guest.notes && typeof guest.notes === 'string' && guest.notes.trim()
        ? [{
            date: new Date((guest.updatedAt || guest.createdAt || new Date()) as string),
            author: 'System',
            content: guest.notes as string,
            private: false,
            category: 'general' as const,
          }]
        : [],
      status: mapBackendStatus((guest.status || 'active') as string),
    };
  };

  useEffect(() => {
    if (isOpen) {
      loadVIPGuests();
    }
  }, [isOpen]);

  useEffect(() => {
    if (selectedGuest && isOpen) {
      // Auto-select guest if passed from parent
      const vipProfile = vipGuests.find(g => g.guestId === selectedGuest.id);
      if (vipProfile) {
        setSelectedVipGuest(vipProfile);
        setShowGuestDetails(true);
      } else {
        // Create VIP profile for non-VIP guest
        createVIPProfile(selectedGuest);
      }
    }
  }, [selectedGuest, vipGuests, isOpen]);

  // Apply filters
  useEffect(() => {
    let filtered = vipGuests;

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(guest =>
        guest.guestName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        guest.email.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Tier filter
    if (tierFilter !== 'all') {
      filtered = filtered.filter(guest => guest.vipTier === tierFilter);
    }

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(guest => guest.status === statusFilter);
    }

    // Sort by tier priority and last visit
    filtered.sort((a, b) => {
      const tierOrder = { diamond: 4, svip: 3, vip: 2, corporate: 1 };
      const aTier = tierOrder[a.vipTier as keyof typeof tierOrder];
      const bTier = tierOrder[b.vipTier as keyof typeof tierOrder];

      if (aTier !== bTier) {
        return bTier - aTier;
      }

      const aLastVisit = a.lastVisit ? a.lastVisit.getTime() : 0;
      const bLastVisit = b.lastVisit ? b.lastVisit.getTime() : 0;
      return bLastVisit - aLastVisit;
    });

    setFilteredGuests(filtered);
  }, [vipGuests, searchTerm, tierFilter, statusFilter]);

  const loadVIPGuests = async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const response = await api.get('/vip', {
        params: { page: 1, limit: 100, sortBy: 'createdAt', sortOrder: 'desc' },
      });

      const apiData = response.data?.data?.vipGuests || response.data?.vipGuests || [];
      const mapped: VIPProfile[] = apiData.map(mapApiGuestToProfile);
      setVipGuests(mapped);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load VIP guests';
      setLoadError(message);
      toast.error('Failed to load VIP guests');
    } finally {
      setIsLoading(false);
    }
  };

  const createVIPProfile = async (guest: Record<string, unknown>) => {
    setIsSaving(true);
    try {
      const payload = {
        guestId: guest.id || guest._id,
        vipLevel: 'gold',
        status: 'active',
        benefits: {
          priorityReservation: true,
          welcomeAmenities: true,
        },
        notes: 'VIP profile created',
      };

      const response = await api.post('/vip', payload);
      const created = response.data?.data?.vipGuest;

      if (created) {
        const newProfile = mapApiGuestToProfile(created);
        setVipGuests(prev => [...prev, newProfile]);
        setSelectedVipGuest(newProfile);
        setShowGuestDetails(true);
        toast.success('VIP profile created successfully');
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to create VIP profile';
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  };

  const getTierIcon = (tier: string) => {
    const icons = {
      diamond: <Award className="w-4 h-4 text-purple-600" />,
      svip: <Crown className="w-4 h-4 text-gold-500" />,
      vip: <Star className="w-4 h-4 text-yellow-500" />,
      corporate: <Building2 className="w-4 h-4 text-blue-600" />
    };
    return icons[tier as keyof typeof icons] || icons.vip;
  };

  const getTierColor = (tier: string) => {
    const colors = {
      diamond: 'bg-purple-100 text-purple-800 border-purple-200',
      svip: 'bg-amber-100 text-amber-800 border-amber-200',
      vip: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      corporate: 'bg-blue-100 text-blue-800 border-blue-200'
    };
    return colors[tier as keyof typeof colors] || colors.vip;
  };

  const getStatusColor = (status: string) => {
    const colors = {
      active: 'bg-green-100 text-green-800 border-green-200',
      inactive: 'bg-gray-100 text-gray-800 border-gray-200',
      blocked: 'bg-red-100 text-red-800 border-red-200'
    };
    return colors[status as keyof typeof colors] || colors.active;
  };

  const handleSaveProfile = async () => {
    if (!editingProfile) return;

    setIsSaving(true);
    try {
      const payload: Record<string, unknown> = {
        vipLevel: mapTierToVipLevel(editingProfile.vipTier),
        status: editingProfile.status === 'blocked' ? 'suspended' : editingProfile.status,
        benefits: {
          airportTransfer: editingProfile.amenities.airportTransfer,
          conciergeService: editingProfile.amenities.personalConcierge,
          priorityReservation: editingProfile.amenities.priorityCheckIn,
          lateCheckout: editingProfile.amenities.lateCheckout,
          roomUpgrade: editingProfile.amenities.complimentaryUpgrade,
          welcomeAmenities: editingProfile.amenities.welcomeAmenities,
          complimentaryBreakfast: editingProfile.amenities.dailyBreakfast,
          spaAccess: editingProfile.amenities.spaAccess,
        },
      };

      await api.patch(`/vip/${editingProfile.id}`, payload);

      setVipGuests(prev =>
        prev.map(guest =>
          guest.id === editingProfile.id ? editingProfile : guest
        )
      );

      if (selectedVipGuest?.id === editingProfile.id) {
        setSelectedVipGuest(editingProfile);
      }

      setShowEditProfile(false);
      setEditingProfile(null);
      toast.success('VIP profile updated successfully');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to update VIP profile';
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddNote = async () => {
    if (!selectedVipGuest || !newNote.trim()) return;

    setIsSaving(true);
    try {
      // The backend notes field is a single string; append the new note with metadata
      const notePrefix = `[${noteCategory.toUpperCase()}${isPrivateNote ? ' - PRIVATE' : ''}] ${new Date().toISOString()} (${getCurrentUser()}): `;
      const existingBackendNotes = selectedVipGuest.notes
        .map(n => `[${n.category.toUpperCase()}${n.private ? ' - PRIVATE' : ''}] ${n.date instanceof Date ? n.date.toISOString() : n.date} (${n.author}): ${n.content}`)
        .join('\n');
      const combinedNotes = `${notePrefix}${newNote.trim()}${existingBackendNotes ? '\n' + existingBackendNotes : ''}`;

      await api.patch(`/vip/${selectedVipGuest.id}`, { notes: combinedNotes });

      const note = {
        date: new Date(),
        author: getCurrentUser(),
        content: newNote.trim(),
        private: isPrivateNote,
        category: noteCategory
      };

      const updatedProfile = {
        ...selectedVipGuest,
        notes: [note, ...selectedVipGuest.notes]
      };

      setVipGuests(prev =>
        prev.map(guest =>
          guest.id === selectedVipGuest.id ? updatedProfile : guest
        )
      );

      setSelectedVipGuest(updatedProfile);
      setNewNote('');
      setIsPrivateNote(false);
      setNoteCategory('general');

      toast.success('Note added successfully');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to save note';
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSpecialRequest = async (requestType: string) => {
    if (!selectedVipGuest) return;

    // Create workflow for special VIP request
    const workflowData = {
      id: selectedVipGuest.currentReservation?.id || `vip-${Date.now()}`,
      guestName: selectedVipGuest.guestName,
      vipStatus: selectedVipGuest.vipTier,
      totalAmount: selectedVipGuest.totalSpend,
      specialRequests: [requestType]
    };

    try {
      await workflowEngine.createWorkflow(workflowData);
      toast.success(`VIP ${requestType} workflow initiated`);
    } catch (error) {
      toast.error('Failed to initiate VIP workflow');
    }
  };

  const getCurrentUser = (): string => {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    return user.name || user.id || 'Staff';
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-6xl max-h-[95vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Crown className="h-5 w-5" />
              VIP Guest Management
            </DialogTitle>
            <DialogDescription>
              Manage VIP guest profiles, preferences, and special services
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col h-full space-y-4">
            {/* VIP Stats */}
            <div className="grid grid-cols-5 gap-4">
              <div className="bg-purple-50 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-purple-700">
                  {vipGuests.filter(g => g.vipTier === 'diamond').length}
                </div>
                <div className="text-sm text-purple-600">Diamond</div>
              </div>
              <div className="bg-amber-50 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-amber-700">
                  {vipGuests.filter(g => g.vipTier === 'svip').length}
                </div>
                <div className="text-sm text-amber-600">Super VIP</div>
              </div>
              <div className="bg-yellow-50 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-yellow-700">
                  {vipGuests.filter(g => g.vipTier === 'vip').length}
                </div>
                <div className="text-sm text-yellow-600">VIP</div>
              </div>
              <div className="bg-blue-50 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-blue-700">
                  {vipGuests.filter(g => g.vipTier === 'corporate').length}
                </div>
                <div className="text-sm text-blue-600">Corporate</div>
              </div>
              <div className="bg-green-50 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-green-700">
                  {vipGuests.filter(g => g.status === 'active').length}
                </div>
                <div className="text-sm text-green-600">Active</div>
              </div>
            </div>

            {/* Filters */}
            <div className="flex items-center gap-4">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="Search VIP guests..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8 w-64"
                />
              </div>

              <Select value={tierFilter} onValueChange={setTierFilter}>
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="Tier" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Tiers</SelectItem>
                  <SelectItem value="diamond">Diamond</SelectItem>
                  <SelectItem value="svip">Super VIP</SelectItem>
                  <SelectItem value="vip">VIP</SelectItem>
                  <SelectItem value="corporate">Corporate</SelectItem>
                </SelectContent>
              </Select>

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="blocked">Blocked</SelectItem>
                </SelectContent>
              </Select>

              <div className="flex-1" />

              <Button
                onClick={() => {
                  if (selectedGuest) {
                    createVIPProfile(selectedGuest);
                  }
                }}
                className="bg-purple-600 hover:bg-purple-700"
                disabled={!selectedGuest || isSaving}
              >
                <Plus className="w-4 h-4 mr-2" />
                {isSaving ? 'Creating...' : 'Create VIP Profile'}
              </Button>
            </div>

            {/* VIP Guests List */}
            <div className="flex-1 overflow-hidden">
              <ScrollArea className="h-full">
                {isLoading ? (
                  <div className="text-center py-12 text-gray-500">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto mb-3" />
                    <p>Loading VIP guests...</p>
                  </div>
                ) : loadError ? (
                  <div className="text-center py-12 text-red-500">
                    <AlertTriangle className="w-12 h-12 mx-auto mb-3 text-red-300" />
                    <p>Failed to load VIP guests</p>
                    <p className="text-sm mb-3">{loadError}</p>
                    <Button variant="outline" size="sm" onClick={loadVIPGuests}>
                      Retry
                    </Button>
                  </div>
                ) : filteredGuests.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <Crown className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                    <p>No VIP guests found</p>
                    <p className="text-sm">Create VIP profiles for your premium guests</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredGuests.map(guest => (
                      <Card key={guest.id} className="hover:shadow-md transition-shadow">
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4 flex-1">
                              {/* VIP Tier Icon */}
                              <div className="flex-shrink-0">
                                {getTierIcon(guest.vipTier)}
                              </div>

                              {/* Guest Info */}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <h4 className="font-medium truncate">{guest.guestName}</h4>
                                  <Badge className={getTierColor(guest.vipTier)}>
                                    {guest.vipTier.toUpperCase()}
                                  </Badge>
                                  <Badge className={getStatusColor(guest.status)}>
                                    {guest.status}
                                  </Badge>
                                </div>

                                <div className="flex items-center gap-4 text-sm text-gray-600">
                                  <span>{guest.email}</span>
                                  <span>•</span>
                                  <span>{guest.visitCount} visits</span>
                                  <span>•</span>
                                  <span>{formatCurrency(guest.totalSpend)}</span>
                                  <span>•</span>
                                  <span>Member since {format(guest.memberSince, 'MMM yyyy')}</span>
                                </div>

                                {guest.lastVisit && (
                                  <div className="text-sm text-gray-500 mt-1">
                                    Last visit: {formatDistanceToNow(guest.lastVisit, { addSuffix: true })}
                                  </div>
                                )}
                              </div>

                              {/* VIP Benefits Summary */}
                              <div className="flex items-center gap-2">
                                {guest.amenities.personalConcierge && <User className="w-4 h-4 text-purple-500" title="Personal Concierge" />}
                                {guest.amenities.airportTransfer && <Car className="w-4 h-4 text-blue-500" title="Airport Transfer" />}
                                {guest.amenities.loungeAccess && <Coffee className="w-4 h-4 text-amber-500" title="Lounge Access" />}
                                {guest.amenities.spaAccess && <Sparkles className="w-4 h-4 text-pink-500" title="Spa Access" />}
                              </div>
                            </div>

                            {/* Actions */}
                            <div className="flex items-center gap-2 ml-4">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setSelectedVipGuest(guest);
                                  setShowGuestDetails(true);
                                }}
                              >
                                <Eye className="w-4 h-4" />
                              </Button>

                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setEditingProfile({ ...guest });
                                  setShowEditProfile(true);
                                }}
                              >
                                <Edit className="w-4 h-4" />
                              </Button>

                              {guest.currentReservation && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleSpecialRequest('upgrade')}
                                  className="text-purple-600 hover:text-purple-700 hover:bg-purple-50"
                                  title="Initiate VIP Workflow"
                                >
                                  <Sparkles className="w-4 h-4" />
                                </Button>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* VIP Guest Details Modal */}
      {selectedVipGuest && (
        <Dialog open={showGuestDetails} onOpenChange={setShowGuestDetails}>
          <DialogContent className="max-w-5xl max-h-[95vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {getTierIcon(selectedVipGuest.vipTier)}
                {selectedVipGuest.guestName} - VIP Profile
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-6">
              {/* VIP Overview */}
              <div className="grid grid-cols-3 gap-6">
                <div className="space-y-4">
                  <div>
                    <label className="font-medium">VIP Status</label>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge className={getTierColor(selectedVipGuest.vipTier)}>
                        {selectedVipGuest.vipTier.toUpperCase()}
                      </Badge>
                      <Badge className={getStatusColor(selectedVipGuest.status)}>
                        {selectedVipGuest.status}
                      </Badge>
                    </div>
                  </div>

                  <div>
                    <label className="font-medium">Contact Information</label>
                    <div className="bg-gray-50 rounded-lg p-3 mt-1 space-y-2 text-sm">
                      <div><strong>Email:</strong> {selectedVipGuest.email}</div>
                      <div><strong>Phone:</strong> {selectedVipGuest.phone}</div>
                      <div><strong>Member Since:</strong> {format(selectedVipGuest.memberSince, 'MMM dd, yyyy')}</div>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="font-medium">VIP Statistics</label>
                    <div className="bg-gray-50 rounded-lg p-3 mt-1 space-y-2 text-sm">
                      <div><strong>Total Spend:</strong> {formatCurrency(selectedVipGuest.totalSpend)}</div>
                      <div><strong>Visit Count:</strong> {selectedVipGuest.visitCount}</div>
                      {selectedVipGuest.lastVisit && (
                        <div><strong>Last Visit:</strong> {format(selectedVipGuest.lastVisit, 'MMM dd, yyyy')}</div>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="font-medium">Health & Dietary</label>
                    <div className="bg-gray-50 rounded-lg p-3 mt-1 space-y-2 text-sm">
                      <div><strong>Allergies:</strong> {selectedVipGuest.allergies.join(', ') || 'None'}</div>
                      <div><strong>Dietary:</strong> {selectedVipGuest.dietaryRestrictions.join(', ') || 'None'}</div>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="font-medium">VIP Quick Actions</label>
                    <div className="grid grid-cols-2 gap-2 mt-1">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleSpecialRequest('concierge')}
                        className="text-purple-600 border-purple-200 hover:bg-purple-50"
                      >
                        <User className="w-4 h-4 mr-1" />
                        Concierge
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleSpecialRequest('upgrade')}
                        className="text-blue-600 border-blue-200 hover:bg-blue-50"
                      >
                        <TrendingUp className="w-4 h-4 mr-1" />
                        Upgrade
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleSpecialRequest('transport')}
                        className="text-green-600 border-green-200 hover:bg-green-50"
                      >
                        <Car className="w-4 h-4 mr-1" />
                        Transport
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleSpecialRequest('amenities')}
                        className="text-amber-600 border-amber-200 hover:bg-amber-50"
                      >
                        <Gift className="w-4 h-4 mr-1" />
                        Amenities
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              {/* VIP Preferences */}
              <div>
                <h3 className="font-medium mb-3">VIP Preferences</h3>
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <div className="bg-gray-50 rounded-lg p-3">
                      <h4 className="font-medium mb-2">Room Preferences</h4>
                      <div className="space-y-2 text-sm">
                        <div><strong>Room Types:</strong> {selectedVipGuest.preferences.roomType.join(', ') || 'Any'}</div>
                        <div><strong>Floors:</strong> {selectedVipGuest.preferences.floor.join(', ') || 'Any'}</div>
                        <div><strong>Bed Type:</strong> {selectedVipGuest.preferences.bedType}</div>
                        <div><strong>Temperature:</strong> {selectedVipGuest.preferences.roomTemperature}°C</div>
                        <div><strong>Pillow:</strong> {selectedVipGuest.preferences.pillow}</div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="bg-gray-50 rounded-lg p-3">
                      <h4 className="font-medium mb-2">Service Preferences</h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span>Wake-up Call:</span>
                          <span>{selectedVipGuest.preferences.wakeUpCall ? 'Yes' : 'No'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Turndown Service:</span>
                          <span>{selectedVipGuest.preferences.turndownService ? 'Yes' : 'No'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Room Service:</span>
                          <span>{selectedVipGuest.preferences.roomService ? 'Yes' : 'No'}</span>
                        </div>
                        <div><strong>Newspaper:</strong> {selectedVipGuest.preferences.newspaper || 'None'}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* VIP Amenities */}
              <div>
                <h3 className="font-medium mb-3">VIP Amenities & Services</h3>
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="grid grid-cols-3 gap-4">
                    {Object.entries(selectedVipGuest.amenities).map(([key, enabled]) => {
                      const amenityNames: Record<string, string> = {
                        airportTransfer: 'Airport Transfer',
                        personalConcierge: 'Personal Concierge',
                        priorityCheckIn: 'Priority Check-in',
                        lateCheckout: 'Late Checkout',
                        complimentaryUpgrade: 'Complimentary Upgrade',
                        welcomeAmenities: 'Welcome Amenities',
                        dailyBreakfast: 'Daily Breakfast',
                        loungeAccess: 'Lounge Access',
                        spaAccess: 'Spa Access',
                        gymAccess: 'Gym Access',
                        vipParking: 'VIP Parking'
                      };

                      return (
                        <div key={key} className="flex items-center gap-2">
                          {enabled ? (
                            <CheckCircle className="w-4 h-4 text-green-500" />
                          ) : (
                            <X className="w-4 h-4 text-gray-300" />
                          )}
                          <span className={cn(
                            'text-sm',
                            enabled ? 'text-green-700 font-medium' : 'text-gray-500'
                          )}>
                            {amenityNames[key] || key}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Notes Section */}
              <div>
                <h3 className="font-medium mb-3">Guest Notes</h3>

                {/* Add Note */}
                <div className="bg-blue-50 rounded-lg p-4 mb-4">
                  <div className="space-y-3">
                    <div className="flex items-center gap-4">
                      <Select value={noteCategory} onValueChange={(value: Record<string, unknown>) => setNoteCategory(value)}>
                        <SelectTrigger className="w-40">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="general">General</SelectItem>
                          <SelectItem value="preference">Preference</SelectItem>
                          <SelectItem value="incident">Incident</SelectItem>
                          <SelectItem value="compliment">Compliment</SelectItem>
                          <SelectItem value="complaint">Complaint</SelectItem>
                        </SelectContent>
                      </Select>

                      <div className="flex items-center gap-2">
                        <Checkbox
                          id="private-note"
                          checked={isPrivateNote}
                          onCheckedChange={setIsPrivateNote}
                        />
                        <label htmlFor="private-note" className="text-sm">Private Note</label>
                      </div>
                    </div>

                    <Textarea
                      value={newNote}
                      onChange={(e) => setNewNote(e.target.value)}
                      placeholder="Add a note about this VIP guest..."
                      rows={3}
                    />

                    <Button
                      onClick={handleAddNote}
                      disabled={!newNote.trim() || isSaving}
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      {isSaving ? 'Saving...' : 'Add Note'}
                    </Button>
                  </div>
                </div>

                {/* Notes List */}
                <div className="space-y-3 max-h-60 overflow-y-auto">
                  {selectedVipGuest.notes.map((note, index) => (
                    <div
                      key={`selectedVipGuest-notes-${index}-${note.date}`}
                      className={cn(
                        'border rounded-lg p-3',
                        note.category === 'complaint' && 'bg-red-50 border-red-200',
                        note.category === 'compliment' && 'bg-green-50 border-green-200',
                        note.category === 'incident' && 'bg-amber-50 border-amber-200',
                        note.category === 'preference' && 'bg-blue-50 border-blue-200',
                        note.category === 'general' && 'bg-gray-50 border-gray-200'
                      )}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">
                            {note.category}
                          </Badge>
                          {note.private && (
                            <Badge variant="outline" className="text-xs bg-gray-100">
                              Private
                            </Badge>
                          )}
                        </div>
                        <div className="text-xs text-gray-500">
                          {format(note.date, 'MMM dd, yyyy HH:mm')} by {note.author}
                        </div>
                      </div>
                      <p className="text-sm">{note.content}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Edit Profile Modal - Simplified for brevity */}
      {editingProfile && (
        <Dialog open={showEditProfile} onOpenChange={setShowEditProfile}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Edit VIP Profile - {editingProfile.guestName}</DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">VIP Tier</label>
                  <Select
                    value={editingProfile.vipTier}
                    onValueChange={(value: Record<string, unknown>) =>
                      setEditingProfile({
                        ...editingProfile,
                        vipTier: value
                      })
                    }
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="vip">VIP</SelectItem>
                      <SelectItem value="svip">Super VIP</SelectItem>
                      <SelectItem value="diamond">Diamond</SelectItem>
                      <SelectItem value="corporate">Corporate</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium">Status</label>
                  <Select
                    value={editingProfile.status}
                    onValueChange={(value: Record<string, unknown>) =>
                      setEditingProfile({
                        ...editingProfile,
                        status: value
                      })
                    }
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                      <SelectItem value="blocked">Blocked</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* More edit fields would go here */}

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowEditProfile(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSaveProfile} className="bg-purple-600 hover:bg-purple-700" disabled={isSaving}>
                  <Save className="w-4 h-4 mr-2" />
                  {isSaving ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
};

export default withErrorBoundary(VIPGuestManager, { level: 'component' });