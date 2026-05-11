import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  Edit,
  Trash2,
  Search,
  TrendingUp,
  Users,
  Gift,
  CheckCircle,
  XCircle
} from 'lucide-react';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/Select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { Checkbox } from '../../components/ui/checkbox';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { api } from '../../services/api';
import toast from 'react-hot-toast';
import { useProperty } from '../../context/PropertyContext';
import { PropertyBreadcrumb } from '../../components/common/PropertyBreadcrumb';
import { withErrorBoundary } from '../../components/ErrorBoundary';

interface Offer {
  _id: string;
  title: string;
  description?: string;
  pointsRequired: number;
  discountPercentage?: number;
  discountAmount?: number;
  type: 'discount' | 'free_service' | 'upgrade' | 'bonus_points';
  category: 'room' | 'dining' | 'spa' | 'transport' | 'general';
  minTier: 'bronze' | 'silver' | 'gold' | 'platinum';
  isActive: boolean;
  validFrom: string;
  validUntil?: string;
  maxRedemptions?: number;
  currentRedemptions: number;
  imageUrl?: string;
  terms?: string;
  createdAt: string;
  updatedAt: string;
}

interface OfferFormData {
  title: string;
  description: string;
  pointsRequired: number;
  discountPercentage: number;
  discountAmount: number;
  type: string;
  category: string;
  minTier: string;
  validFrom: string;
  validUntil: string;
  maxRedemptions: number;
  imageUrl: string;
  terms: string;
}

const initialFormData: OfferFormData = {
  title: '',
  description: '',
  pointsRequired: 100,
  discountPercentage: 0,
  discountAmount: 0,
  type: 'discount',
  category: 'general',
  minTier: 'bronze',
  validFrom: new Date().toISOString().split('T')[0],
  validUntil: '',
  maxRedemptions: 0,
  imageUrl: '',
  terms: ''
};

// API functions
const fetchOffers = async (params: Record<string, unknown>) => {
  try {
    const response = await api.get('/admin/loyalty/offers', { params });
    return response.data.data;
  } catch (error: unknown) {
    throw error instanceof Error ? error : new Error('Failed to fetch offers');
  }
};

const createOffer = async (data: Partial<OfferFormData> & { propertyId?: string }) => {
  try {
    const response = await api.post('/admin/loyalty/offers', data);
    return response.data.data;
  } catch (error: unknown) {
    throw error instanceof Error ? error : new Error('Failed to create offer');
  }
};

const updateOffer = async ({ id, data }: { id: string; data: Partial<OfferFormData> & { propertyId?: string } }) => {
  try {
    const response = await api.put(`/admin/loyalty/offers/${id}`, data);
    return response.data.data;
  } catch (error: unknown) {
    throw error instanceof Error ? error : new Error('Failed to update offer');
  }
};

const deleteOffer = async (id: string) => {
  try {
    const response = await api.delete(`/admin/loyalty/offers/${id}`);
    return response.data;
  } catch (error: unknown) {
    throw error instanceof Error ? error : new Error('Failed to delete offer');
  }
};

const bulkOperation = async (data: { offerIds: string[]; operation: string; propertyId?: string }) => {
  try {
    const response = await api.post('/admin/loyalty/offers/bulk', data);
    return response.data.data;
  } catch (error: unknown) {
    throw error instanceof Error ? error : new Error('Failed to perform bulk operation');
  }
};

const fetchAnalytics = async (propertyId?: string) => {
  try {
    const response = await api.get('/admin/loyalty/analytics', {
      params: { propertyId }
    });
    return response.data.data;
  } catch (error: unknown) {
    throw error instanceof Error ? error : new Error('Failed to fetch analytics');
  }
};

const getTypeColor = (type: string) => {
  const colors = {
    discount: 'bg-green-100 text-green-800',
    free_service: 'bg-blue-100 text-blue-800',
    upgrade: 'bg-purple-100 text-purple-800',
    bonus_points: 'bg-yellow-100 text-yellow-800'
  };
  return colors[type as keyof typeof colors] || 'bg-gray-100 text-gray-800';
};

const getCategoryColor = (category: string) => {
  const colors = {
    room: 'bg-blue-100 text-blue-800',
    dining: 'bg-orange-100 text-orange-800',
    spa: 'bg-green-100 text-green-800',
    transport: 'bg-purple-100 text-purple-800',
    general: 'bg-gray-100 text-gray-800'
  };
  return colors[category as keyof typeof colors] || 'bg-gray-100 text-gray-800';
};

const OfferCardInfo = React.memo(({ offer, getTypeColor, getCategoryColor }: {
  offer: Offer;
  getTypeColor: (type: string) => string;
  getCategoryColor: (category: string) => string;
}) => (
  <div className="flex-1 min-w-0">
    <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-2">
      <h3 className="text-base sm:text-lg font-semibold truncate">{offer.title}</h3>
      <div className="flex flex-wrap gap-1 sm:gap-2">
        <Badge className={`${getTypeColor(offer.type)} text-xs`}>
          {offer.type.replace('_', ' ')}
        </Badge>
        <Badge className={`${getCategoryColor(offer.category)} text-xs`}>
          {offer.category}
        </Badge>
        <Badge variant={offer.isActive ? "default" : "secondary"} className="text-xs">
          {offer.isActive ? 'Active' : 'Inactive'}
        </Badge>
      </div>
    </div>
    <p className="text-sm sm:text-base text-gray-600 mb-3 line-clamp-2">{offer.description}</p>
    <div className="grid grid-cols-2 sm:flex sm:items-center gap-2 sm:gap-4 text-xs sm:text-sm text-gray-600">
      <span className="font-medium">{offer.pointsRequired} points</span>
      {offer.type === 'discount' && (
        <span className="text-green-600 font-medium">
          {offer.discountPercentage
            ? `${offer.discountPercentage}% off`
            : `\u20B9${offer.discountAmount} off`
          }
        </span>
      )}
      <span className="capitalize">Min: {offer.minTier}</span>
      {offer.maxRedemptions && (
        <span className="text-blue-600">
          {offer.maxRedemptions - offer.currentRedemptions} left
        </span>
      )}
      <span className="col-span-2 sm:col-span-1">
        {new Date(offer.createdAt).toLocaleDateString()}
      </span>
    </div>
  </div>
));
OfferCardInfo.displayName = 'OfferCardInfo';

function AdminOfferManagement() {
  const { selectedPropertyId, selectedProperty, viewMode } = useProperty();
  const [activeTab, setActiveTab] = useState('offers');
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedOffers, setSelectedOffers] = useState<string[]>([]);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingOffer, setEditingOffer] = useState<Offer | null>(null);
  const [formData, setFormData] = useState<OfferFormData>(initialFormData);
  const [currentPage, setCurrentPage] = useState(1);

  const queryClient = useQueryClient();

  // Fetch offers with filters
  const { data: offersData, isLoading: offersLoading, error: offersError } = useQuery({
    queryKey: ['admin-offers', selectedPropertyId, searchTerm, categoryFilter, typeFilter, statusFilter, currentPage],
    queryFn: () => fetchOffers({
      propertyId: selectedPropertyId,
      search: searchTerm || undefined,
      category: categoryFilter || undefined,
      type: typeFilter || undefined,
      isActive: statusFilter === 'active' ? true : statusFilter === 'inactive' ? false : undefined,
      page: currentPage,
      limit: 20
    }),
    enabled: !!selectedPropertyId,
    staleTime: 5 * 60 * 1000
  });

  // Fetch analytics
  const { data: analytics, isLoading: analyticsLoading } = useQuery({
    queryKey: ['admin-loyalty-analytics', selectedPropertyId],
    queryFn: () => fetchAnalytics(selectedPropertyId),
    enabled: !!selectedPropertyId,
    staleTime: 10 * 60 * 1000
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: (data: Partial<OfferFormData>) => createOffer({ ...data, propertyId: selectedPropertyId }),
    onSuccess: () => {
      toast.success('Offer created successfully');
      setIsCreateModalOpen(false);
      setFormData(initialFormData);
      queryClient.invalidateQueries({ queryKey: ['admin-offers'] });
    },
    onError: (error: unknown) => {
      const axiosErr = error as { response?: { data?: { message?: string } } };
      toast.error(axiosErr.response?.data?.message || (error instanceof Error ? error.message : 'Failed to create offer'));
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<OfferFormData> }) =>
      updateOffer({ id, data: { ...data, propertyId: selectedPropertyId } }),
    onSuccess: () => {
      toast.success('Offer updated successfully');
      setIsEditModalOpen(false);
      setEditingOffer(null);
      setFormData(initialFormData);
      queryClient.invalidateQueries({ queryKey: ['admin-offers'] });
    },
    onError: (error: unknown) => {
      const axiosErr = error as { response?: { data?: { message?: string } } };
      toast.error(axiosErr.response?.data?.message || (error instanceof Error ? error.message : 'Failed to update offer'));
    }
  });

  const deleteMutation = useMutation({
    mutationFn: deleteOffer,
    onSuccess: () => {
      toast.success('Offer deleted successfully');
      queryClient.invalidateQueries({ queryKey: ['admin-offers'] });
    },
    onError: (error: unknown) => {
      const axiosErr = error as { response?: { data?: { message?: string } } };
      toast.error(axiosErr.response?.data?.message || (error instanceof Error ? error.message : 'Failed to delete offer'));
    }
  });

  const bulkMutation = useMutation({
    mutationFn: (data: { offerIds: string[]; operation: string }) =>
      bulkOperation({ ...data, propertyId: selectedPropertyId }),
    onSuccess: (data: { affectedCount?: number } | undefined) => {
      toast.success(`Bulk operation completed: ${data?.affectedCount ?? 0} offers affected`);
      setSelectedOffers([]);
      queryClient.invalidateQueries({ queryKey: ['admin-offers'] });
    },
    onError: (error: unknown) => {
      const axiosErr = error as { response?: { data?: { message?: string } } };
      toast.error(axiosErr.response?.data?.message || (error instanceof Error ? error.message : 'Bulk operation failed'));
    }
  });

  const offers = offersData?.offers || [];
  const pagination = offersData?.pagination || { currentPage: 1, totalPages: 1, totalItems: 0, itemsPerPage: 20, hasNext: false, hasPrev: false };

  const validateForm = (data: OfferFormData): string | null => {
    if (!data.title.trim()) {
      return 'Offer title is required';
    }
    if (data.pointsRequired < 1) {
      return 'Points required must be at least 1';
    }
    if (data.type === 'discount') {
      if (data.discountPercentage < 0 || data.discountPercentage > 100) {
        return 'Discount percentage must be between 0 and 100';
      }
      if (data.discountAmount < 0) {
        return 'Fixed discount amount cannot be negative';
      }
      if (!data.discountPercentage && !data.discountAmount) {
        return 'Discount offers must have either a discount percentage or fixed discount amount greater than 0';
      }
    }
    if (!data.validFrom) {
      return 'Valid From date is required';
    }
    if (data.validUntil && data.validFrom && data.validUntil < data.validFrom) {
      return 'Valid Until date must be after Valid From date';
    }
    return null;
  };

  const cleanFormData = (data: OfferFormData): Partial<OfferFormData> => {
    const submitData = { ...data };
    const cleaned: Partial<OfferFormData> = { ...submitData };
    if (!submitData.validUntil) {
      delete cleaned.validUntil;
    }
    if (!submitData.maxRedemptions || submitData.maxRedemptions <= 0) {
      delete cleaned.maxRedemptions;
    }
    if (!submitData.imageUrl) {
      delete cleaned.imageUrl;
    }
    if (!submitData.terms) {
      delete cleaned.terms;
    }
    if (submitData.type !== 'discount') {
      delete cleaned.discountPercentage;
      delete cleaned.discountAmount;
    }
    return cleaned;
  };

  const handleCreateOffer = () => {
    const validationError = validateForm(formData);
    if (validationError) {
      toast.error(validationError);
      return;
    }

    const submitData = cleanFormData(formData);
    createMutation.mutate(submitData);
  };

  const handleUpdateOffer = () => {
    if (!editingOffer) return;

    const validationError = validateForm(formData);
    if (validationError) {
      toast.error(validationError);
      return;
    }

    const submitData = cleanFormData(formData);
    updateMutation.mutate({ id: editingOffer._id, data: submitData });
  };

  const handleEditOffer = (offer: Offer) => {
    setEditingOffer(offer);
    setFormData({
      title: offer.title,
      description: offer.description || '',
      pointsRequired: offer.pointsRequired,
      discountPercentage: offer.discountPercentage || 0,
      discountAmount: offer.discountAmount || 0,
      type: offer.type,
      category: offer.category,
      minTier: offer.minTier,
      validFrom: offer.validFrom.split('T')[0],
      validUntil: offer.validUntil ? offer.validUntil.split('T')[0] : '',
      maxRedemptions: offer.maxRedemptions || 0,
      imageUrl: offer.imageUrl || '',
      terms: offer.terms || ''
    });
    setIsEditModalOpen(true);
  };

  const handleDeleteOffer = (offerId: string) => {
    if (window.confirm('Are you sure you want to delete this offer?')) {
      deleteMutation.mutate(offerId);
    }
  };

  const handleBulkOperation = (operation: string) => {
    if (selectedOffers.length === 0) {
      toast.error('Please select offers first');
      return;
    }

    const confirmMessage = `Are you sure you want to ${operation} ${selectedOffers.length} offer(s)?`;
    if (window.confirm(confirmMessage)) {
      bulkMutation.mutate({ offerIds: selectedOffers, operation });
    }
  };

  const toggleOfferSelection = (offerId: string) => {
    setSelectedOffers(prev =>
      prev.includes(offerId)
        ? prev.filter(id => id !== offerId)
        : [...prev, offerId]
    );
  };

  // Early return if no property selected in single property mode
  if (!selectedPropertyId && viewMode === 'single') {
    return (
      <div className="p-6">
        <PropertyBreadcrumb items={['Services', 'Offer Management']} />
        <div className="text-center py-12">
          <p className="text-gray-600">Please select a property to manage offers</p>
        </div>
      </div>
    );
  }

  if (offersLoading && !offers.length) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      {/* Property Breadcrumb */}
      <PropertyBreadcrumb items={['Services', 'Offer Management']} />

      {/* Header */}
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">
          Offer Management
        </h1>
        <p className="text-sm sm:text-base text-gray-600">
          Create and manage loyalty program offers
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="offers">Offers</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="offers" className="space-y-4 sm:space-y-6">
          {/* Controls */}
          <Card className="p-4 sm:p-6">
            <div className="space-y-4">
              {/* Search and Filters */}
              <div className="flex flex-col gap-4">
                {/* Search Bar */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <Input
                    placeholder="Search offers..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
                
                {/* Filters Row */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="All categories" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">All categories</SelectItem>
                      <SelectItem value="room">Room</SelectItem>
                      <SelectItem value="dining">Dining</SelectItem>
                      <SelectItem value="spa">Spa</SelectItem>
                      <SelectItem value="transport">Transport</SelectItem>
                      <SelectItem value="general">General</SelectItem>
                    </SelectContent>
                  </Select>
                  
                  <Select value={typeFilter} onValueChange={setTypeFilter}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="All types" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">All types</SelectItem>
                      <SelectItem value="discount">Discount</SelectItem>
                      <SelectItem value="free_service">Free Service</SelectItem>
                      <SelectItem value="upgrade">Upgrade</SelectItem>
                      <SelectItem value="bonus_points">Bonus Points</SelectItem>
                    </SelectContent>
                  </Select>
                  
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="All status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">All status</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                  <Button onClick={() => setIsCreateModalOpen(true)} className="w-full sm:w-auto">
                    <Plus className="w-4 h-4 mr-2" />
                    Create Offer
                  </Button>
                  {selectedOffers.length > 0 && (
                    <div className="flex flex-col sm:flex-row gap-2">
                      <Button
                        variant="outline"
                        onClick={() => handleBulkOperation('activate')}
                        disabled={bulkMutation.isPending}
                        className="w-full sm:w-auto"
                      >
                        <CheckCircle className="w-4 h-4 mr-2" />
                        <span className="hidden sm:inline">Activate</span> ({selectedOffers.length})
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => handleBulkOperation('deactivate')}
                        disabled={bulkMutation.isPending}
                        className="w-full sm:w-auto"
                      >
                        <XCircle className="w-4 h-4 mr-2" />
                        <span className="hidden sm:inline">Deactivate</span> ({selectedOffers.length})
                      </Button>
                      <Button
                        variant="destructive"
                        onClick={() => handleBulkOperation('delete')}
                        disabled={bulkMutation.isPending}
                        className="w-full sm:w-auto"
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        <span className="hidden sm:inline">Delete</span> ({selectedOffers.length})
                      </Button>
                    </div>
                  )}
                </div>
                <div className="text-sm text-gray-600 w-full sm:w-auto text-center sm:text-right">
                  {pagination.totalItems || 0} offers total
                </div>
              </div>
            </div>
          </Card>

          {/* Offers List */}
          <div className="grid gap-3 sm:gap-4">
            {offers.length === 0 ? (
              <Card className="p-8 sm:p-16 text-center">
                <Gift className="h-12 w-12 sm:h-16 sm:w-16 mx-auto mb-4 text-gray-300" />
                <h3 className="text-lg font-semibold mb-2">No offers found</h3>
                <p className="text-gray-600 mb-4">Create your first loyalty offer to get started</p>
                <Button onClick={() => setIsCreateModalOpen(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Create Offer
                </Button>
              </Card>
            ) : (
              offers.map((offer: Offer) => (
                <Card key={offer._id} className="p-4 sm:p-6">
                  <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                    <div className="flex items-start space-x-3 sm:space-x-4 flex-1">
                      <Checkbox
                        checked={selectedOffers.includes(offer._id)}
                        onCheckedChange={() => toggleOfferSelection(offer._id)}
                        className="mt-1"
                      />
                      <OfferCardInfo offer={offer} getTypeColor={getTypeColor} getCategoryColor={getCategoryColor} />
                    </div>
                    <div className="flex items-center justify-end sm:justify-start space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEditOffer(offer)}
                        className="flex-1 sm:flex-none"
                      >
                        <Edit className="w-4 h-4 sm:mr-2" />
                        <span className="sm:hidden">Edit</span>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeleteOffer(offer._id)}
                        className="flex-1 sm:flex-none"
                      >
                        <Trash2 className="w-4 h-4 sm:mr-2" />
                        <span className="sm:hidden">Delete</span>
                      </Button>
                    </div>
                  </div>
                </Card>
              ))
            )}
          </div>

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="flex justify-center space-x-2">
              <Button
                variant="outline"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage(currentPage - 1)}
              >
                Previous
              </Button>
              <span className="flex items-center px-4">
                Page {pagination.currentPage} of {pagination.totalPages}
              </span>
              <Button
                variant="outline"
                disabled={currentPage >= pagination.totalPages}
                onClick={() => setCurrentPage(currentPage + 1)}
              >
                Next
              </Button>
            </div>
          )}
        </TabsContent>

        <TabsContent value="analytics" className="space-y-6">
          {analyticsLoading ? (
            <div className="flex items-center justify-center h-64">
              <LoadingSpinner />
            </div>
          ) : (
            <div className="space-y-6">
              {/* Overview Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card className="p-4">
                  <div className="flex items-center space-x-2">
                    <Gift className="h-5 w-5 text-blue-600" />
                    <div>
                      <p className="text-sm text-gray-600">Total Offers</p>
                      <p className="text-2xl font-semibold">{analytics?.offers?.total || 0}</p>
                    </div>
                  </div>
                </Card>
                <Card className="p-4">
                  <div className="flex items-center space-x-2">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    <div>
                      <p className="text-sm text-gray-600">Active Offers</p>
                      <p className="text-2xl font-semibold">{analytics?.offers?.active || 0}</p>
                    </div>
                  </div>
                </Card>
                <Card className="p-4">
                  <div className="flex items-center space-x-2">
                    <TrendingUp className="h-5 w-5 text-orange-600" />
                    <div>
                      <p className="text-sm text-gray-600">Total Redemptions</p>
                      <p className="text-2xl font-semibold">
                        {analytics?.overallStats?.find(s => s._id === 'redeemed')?.count || 0}
                      </p>
                    </div>
                  </div>
                </Card>
                <Card className="p-4">
                  <div className="flex items-center space-x-2">
                    <Users className="h-5 w-5 text-purple-600" />
                    <div>
                      <p className="text-sm text-gray-600">Points Redeemed</p>
                      <p className="text-2xl font-semibold">
                        {Math.abs(analytics?.overallStats?.find(s => s._id === 'redeemed')?.totalPoints || 0).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </Card>
              </div>

              {/* Top Performing Offers */}
              <Card className="p-6">
                <h3 className="text-lg font-semibold mb-4">Top Performing Offers</h3>
                <div className="space-y-4">
                  {analytics?.offerPerformance && analytics.offerPerformance.length > 0 ? (
                    analytics.offerPerformance.slice(0, 5).map((offer: { _id: string; offerTitle?: string; offerCategory?: string; offerType?: string; totalRedemptions: number; totalPointsRedeemed: number }, index: number) => (
                      <div key={offer._id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-semibold">
                            {index + 1}
                          </div>
                          <div>
                            <p className="font-medium">{offer.offerTitle ?? 'Untitled Offer'}</p>
                            <p className="text-sm text-gray-600">
                              {offer.offerCategory ?? 'N/A'} • {offer.offerType?.replace('_', ' ') ?? 'N/A'}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold">{offer.totalRedemptions} redemptions</p>
                          <p className="text-sm text-gray-600">
                            {(offer.totalPointsRedeemed ?? 0).toLocaleString()} points
                          </p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-center text-gray-500 py-8">No offers to display. Create your first offer to see performance data.</p>
                  )}
                </div>
              </Card>

              {/* Category Breakdown */}
              <Card className="p-6">
                <h3 className="text-lg font-semibold mb-4">Category Breakdown</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {analytics?.categoryBreakdown && analytics.categoryBreakdown.length > 0 ? (
                    analytics.categoryBreakdown.map((category: { _id: string; totalRedemptions: number; totalPointsRedeemed: number }) => (
                      <div key={category._id} className="p-4 bg-gray-50 rounded-lg">
                        <h4 className="font-medium capitalize mb-2">{category._id ?? 'Unknown'}</h4>
                        <p className="text-2xl font-semibold text-blue-600">{category.totalRedemptions}</p>
                        <p className="text-sm text-gray-600">
                          {(category.totalPointsRedeemed ?? 0).toLocaleString()} points redeemed
                        </p>
                      </div>
                    ))
                  ) : (
                    <p className="text-center text-gray-500 py-8 col-span-full">No offers to display. Create your first offer to see performance data.</p>
                  )}
                </div>
              </Card>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Create Offer Modal */}
      <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
        <DialogContent className="max-w-4xl max-h-[95vh] overflow-y-auto">
          <DialogHeader className="pb-4">
            <DialogTitle className="text-xl font-semibold">Create New Offer</DialogTitle>
            <p className="text-sm text-gray-600">Fill in the details to create a new loyalty offer</p>
          </DialogHeader>
          <OfferForm
            formData={formData}
            setFormData={setFormData}
            onSubmit={handleCreateOffer}
            isLoading={createMutation.isPending}
          />
        </DialogContent>
      </Dialog>

      {/* Edit Offer Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="max-w-4xl max-h-[95vh] overflow-y-auto">
          <DialogHeader className="pb-4">
            <DialogTitle className="text-xl font-semibold">Edit Offer</DialogTitle>
            <p className="text-sm text-gray-600">Update the offer details below</p>
          </DialogHeader>
          <OfferForm
            formData={formData}
            setFormData={setFormData}
            onSubmit={handleUpdateOffer}
            isLoading={updateMutation.isPending}
            isEdit
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Offer Form Component
interface OfferFormProps {
  formData: OfferFormData;
  setFormData: (data: OfferFormData) => void;
  onSubmit: () => void;
  isLoading: boolean;
  isEdit?: boolean;
}

function OfferForm({ formData, setFormData, onSubmit, isLoading, isEdit }: OfferFormProps) {
  const handleInputChange = (field: keyof OfferFormData, value: unknown) => {
    setFormData({ ...formData, [field]: value });
  };

  return (
    <div className="space-y-6">
      {/* Basic Information Section */}
      <div className="bg-gray-50 p-4 rounded-lg">
        <h3 className="text-lg font-semibold mb-4 text-gray-900">Basic Information</h3>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="lg:col-span-2">
            <Label htmlFor="title" className="text-sm font-medium text-gray-700">
              Offer Title *
            </Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => handleInputChange('title', e.target.value)}
              placeholder="Enter a compelling offer title"
              className="mt-1"
            />
          </div>

          <div className="lg:col-span-2">
            <Label htmlFor="description" className="text-sm font-medium text-gray-700">
              Description
            </Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              placeholder="Describe what this offer includes and its benefits..."
              rows={3}
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="type" className="text-sm font-medium text-gray-700">
              Offer Type *
            </Label>
            <Select value={formData.type} onValueChange={(value) => handleInputChange('type', value)}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Select offer type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="discount">💰 Discount</SelectItem>
                <SelectItem value="free_service">🎁 Free Service</SelectItem>
                <SelectItem value="upgrade">⬆️ Upgrade</SelectItem>
                <SelectItem value="bonus_points">⭐ Bonus Points</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="category" className="text-sm font-medium text-gray-700">
              Category *
            </Label>
            <Select value={formData.category} onValueChange={(value) => handleInputChange('category', value)}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="room">🏨 Room</SelectItem>
                <SelectItem value="dining">🍽️ Dining</SelectItem>
                <SelectItem value="spa">🧘 Spa</SelectItem>
                <SelectItem value="transport">🚗 Transport</SelectItem>
                <SelectItem value="general">📋 General</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Points & Tier Section */}
      <div className="bg-blue-50 p-4 rounded-lg">
        <h3 className="text-lg font-semibold mb-4 text-gray-900">Points & Requirements</h3>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="pointsRequired" className="text-sm font-medium text-gray-700">
              Points Required *
            </Label>
            <Input
              id="pointsRequired"
              type="number"
              value={formData.pointsRequired}
              onChange={(e) => handleInputChange('pointsRequired', parseInt(e.target.value) || 0)}
              min="1"
              placeholder="e.g., 500"
              className="mt-1"
            />
            <p className="text-xs text-gray-500 mt-1">Minimum points needed to redeem this offer</p>
          </div>

          <div>
            <Label htmlFor="minTier" className="text-sm font-medium text-gray-700">
              Minimum Tier
            </Label>
            <Select value={formData.minTier} onValueChange={(value) => handleInputChange('minTier', value)}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Select minimum tier" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="bronze">🥉 Bronze</SelectItem>
                <SelectItem value="silver">🥈 Silver</SelectItem>
                <SelectItem value="gold">🥇 Gold</SelectItem>
                <SelectItem value="platinum">💎 Platinum</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-gray-500 mt-1">Minimum loyalty tier required</p>
          </div>
        </div>
      </div>

      {/* Discount Details Section */}
      {formData.type === 'discount' && (
        <div className="bg-green-50 p-4 rounded-lg">
          <h3 className="text-lg font-semibold mb-4 text-gray-900">Discount Details</h3>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="discountPercentage" className="text-sm font-medium text-gray-700">
                Discount Percentage
              </Label>
              <div className="relative mt-1">
                <Input
                  id="discountPercentage"
                  type="number"
                  value={formData.discountPercentage}
                  onChange={(e) => handleInputChange('discountPercentage', parseFloat(e.target.value) || 0)}
                  min="0"
                  max="100"
                  placeholder="e.g., 20"
                  className="pr-8"
                />
                <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 text-sm">%</span>
              </div>
              <p className="text-xs text-gray-500 mt-1">Percentage discount (0-100%)</p>
            </div>

            <div>
              <Label htmlFor="discountAmount" className="text-sm font-medium text-gray-700">
                Fixed Discount Amount (₹)
              </Label>
              <div className="relative mt-1">
                <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 text-sm">₹</span>
                <Input
                  id="discountAmount"
                  type="number"
                  value={formData.discountAmount}
                  onChange={(e) => handleInputChange('discountAmount', parseFloat(e.target.value) || 0)}
                  min="0"
                  placeholder="e.g., 500"
                  className="pl-8"
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">Fixed amount discount in rupees</p>
            </div>
          </div>
        </div>
      )}

      {/* Validity & Limits Section */}
      <div className="bg-yellow-50 p-4 rounded-lg">
        <h3 className="text-lg font-semibold mb-4 text-gray-900">Validity & Limits</h3>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div>
            <Label htmlFor="validFrom" className="text-sm font-medium text-gray-700">
              Valid From
            </Label>
            <Input
              id="validFrom"
              type="date"
              value={formData.validFrom}
              onChange={(e) => handleInputChange('validFrom', e.target.value)}
              className="mt-1"
            />
            <p className="text-xs text-gray-500 mt-1">When the offer becomes active</p>
          </div>

          <div>
            <Label htmlFor="validUntil" className="text-sm font-medium text-gray-700">
              Valid Until
            </Label>
            <Input
              id="validUntil"
              type="date"
              value={formData.validUntil}
              onChange={(e) => handleInputChange('validUntil', e.target.value)}
              className="mt-1"
            />
            <p className="text-xs text-gray-500 mt-1">When the offer expires (optional)</p>
          </div>

          <div>
            <Label htmlFor="maxRedemptions" className="text-sm font-medium text-gray-700">
              Max Redemptions
            </Label>
            <Input
              id="maxRedemptions"
              type="number"
              value={formData.maxRedemptions}
              onChange={(e) => handleInputChange('maxRedemptions', parseInt(e.target.value) || 0)}
              min="0"
              placeholder="0 for unlimited"
              className="mt-1"
            />
            <p className="text-xs text-gray-500 mt-1">Maximum number of redemptions (0 = unlimited)</p>
          </div>
        </div>
      </div>

      {/* Additional Details Section */}
      <div className="bg-purple-50 p-4 rounded-lg">
        <h3 className="text-lg font-semibold mb-4 text-gray-900">Additional Details</h3>
        <div className="space-y-4">
          <div>
            <Label htmlFor="imageUrl" className="text-sm font-medium text-gray-700">
              Image URL
            </Label>
            <Input
              id="imageUrl"
              type="url"
              value={formData.imageUrl}
              onChange={(e) => handleInputChange('imageUrl', e.target.value)}
              placeholder="https://example.com/offer-image.jpg"
              className="mt-1"
            />
            <p className="text-xs text-gray-500 mt-1">URL to an image representing this offer</p>
          </div>

          <div>
            <Label htmlFor="terms" className="text-sm font-medium text-gray-700">
              Terms & Conditions
            </Label>
            <Textarea
              id="terms"
              value={formData.terms}
              onChange={(e) => handleInputChange('terms', e.target.value)}
              placeholder="Enter any specific terms and conditions for this offer..."
              rows={4}
              className="mt-1"
            />
            <p className="text-xs text-gray-500 mt-1">Any special terms or restrictions for this offer</p>
          </div>
        </div>
      </div>

      <DialogFooter className="flex flex-col sm:flex-row gap-3 pt-6">
        <Button type="button" variant="outline" className="w-full sm:w-auto" disabled={isLoading}>
          Cancel
        </Button>
        <Button type="button" onClick={onSubmit} disabled={isLoading || !formData.title.trim()} className="w-full sm:w-auto">
          {isLoading && <LoadingSpinner size="sm" className="mr-2" />}
          {isLoading ? (isEdit ? 'Updating...' : 'Creating...') : (isEdit ? 'Update Offer' : 'Create Offer')}
        </Button>
      </DialogFooter>
    </div>
  );
}

export default withErrorBoundary(AdminOfferManagement, { level: 'page' });