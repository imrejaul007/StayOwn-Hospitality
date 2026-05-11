import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Edit, Copy, BarChart3, Calendar, Target, Percent, IndianRupee } from 'lucide-react';
import { bookingEngineService, PromoCode, CreatePromoCodeData } from '@/services/bookingEngineService';

interface CreatePromoFormData {
  codeId: string;
  code: string;
  name: string;
  description: string;
  type: 'percentage' | 'fixed_amount' | 'free_night' | 'upgrade';
  discountValue: number;
  maxAmount?: number;
  minBookingValue?: number;
  minNights?: number;
  maxNights?: number;
  applicableRoomTypes: string[];
  firstTimeGuests: boolean;
  maxUsagePerGuest: number;
  combinableWithOtherOffers: boolean;
  startDate: string;
  endDate: string;
  totalUsageLimit?: number;
  guestSegments: string[];
  channels: string[];
  isActive: boolean;
}

const PromoCodeManager: React.FC = () => {
  const [promoCodes, setPromoCodes] = useState<PromoCode[]>([]);
  const [selectedPromo, setSelectedPromo] = useState<PromoCode | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');

  const [formData, setFormData] = useState<CreatePromoFormData>({
    codeId: '',
    code: '',
    name: '',
    description: '',
    type: 'percentage',
    discountValue: 0,
    maxAmount: 0,
    minBookingValue: 0,
    minNights: 1,
    maxNights: 30,
    applicableRoomTypes: [],
    firstTimeGuests: false,
    maxUsagePerGuest: 1,
    combinableWithOtherOffers: false,
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    totalUsageLimit: 100,
    guestSegments: [],
    channels: [],
    isActive: true
  });

  useEffect(() => {
    fetchPromoCodes();
  }, []);

  const fetchPromoCodes = async () => {
    try {
      setLoading(true);
      const data = await bookingEngineService.getPromoCodes();
      setPromoCodes(data);
    } catch (error) {
      console.error('Failed to load promo codes:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePromoCode = async () => {
    try {
      const promoData: CreatePromoCodeData = {
        codeId: formData.codeId,
        code: formData.code,
        name: formData.name,
        description: formData.description,
        type: formData.type,
        discount: {
          value: formData.discountValue,
          maxAmount: formData.maxAmount
        },
        conditions: {
          minBookingValue: formData.minBookingValue,
          minNights: formData.minNights,
          maxNights: formData.maxNights,
          applicableRoomTypes: formData.applicableRoomTypes,
          firstTimeGuests: formData.firstTimeGuests,
          maxUsagePerGuest: formData.maxUsagePerGuest,
          combinableWithOtherOffers: formData.combinableWithOtherOffers
        },
        validity: {
          startDate: formData.startDate,
          endDate: formData.endDate
        },
        usage: {
          totalUsageLimit: formData.totalUsageLimit
        },
        targeting: {
          guestSegments: formData.guestSegments,
          channels: formData.channels
        },
        isActive: formData.isActive
      };

      await bookingEngineService.createPromoCode(promoData);
      fetchPromoCodes();
      setIsCreateModalOpen(false);
      resetForm();
    } catch (error) {
      console.error('Error creating promo code:', error);
    }
  };

  const handleUpdatePromoCode = async () => {
    if (!selectedPromo) return;

    try {
      const updateData = {
        name: formData.name,
        description: formData.description,
        type: formData.type,
        discount: {
          value: formData.discountValue,
          maxAmount: formData.maxAmount
        },
        conditions: {
          minBookingValue: formData.minBookingValue,
          minNights: formData.minNights,
          maxNights: formData.maxNights,
          applicableRoomTypes: formData.applicableRoomTypes,
          firstTimeGuests: formData.firstTimeGuests,
          maxUsagePerGuest: formData.maxUsagePerGuest,
          combinableWithOtherOffers: formData.combinableWithOtherOffers
        },
        validity: {
          startDate: formData.startDate,
          endDate: formData.endDate
        },
        usage: {
          totalUsageLimit: formData.totalUsageLimit
        },
        targeting: {
          guestSegments: formData.guestSegments,
          channels: formData.channels
        },
        isActive: formData.isActive
      };

      await bookingEngineService.updatePromoCode(selectedPromo._id, updateData);
      fetchPromoCodes();
      setIsEditModalOpen(false);
      setSelectedPromo(null);
      resetForm();
    } catch (error) {
      console.error('Error updating promo code:', error);
    }
  };

  const resetForm = () => {
    setFormData({
      codeId: '',
      code: '',
      name: '',
      description: '',
      type: 'percentage',
      discountValue: 0,
      maxAmount: 0,
      minBookingValue: 0,
      minNights: 1,
      maxNights: 30,
      applicableRoomTypes: [],
      firstTimeGuests: false,
      maxUsagePerGuest: 1,
      combinableWithOtherOffers: false,
      startDate: new Date().toISOString().split('T')[0],
      endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      totalUsageLimit: 100,
      guestSegments: [],
      channels: [],
      isActive: true
    });
  };

  const openEditModal = (promo: PromoCode) => {
    setSelectedPromo(promo);
    setFormData({
      codeId: promo.codeId,
      code: promo.code,
      name: promo.name,
      description: promo.description || '',
      type: promo.type,
      discountValue: promo.discount.value,
      maxAmount: promo.discount.maxAmount || 0,
      minBookingValue: promo.conditions.minBookingValue || 0,
      minNights: promo.conditions.minNights || 1,
      maxNights: promo.conditions.maxNights || 30,
      applicableRoomTypes: promo.conditions.applicableRoomTypes || [],
      firstTimeGuests: promo.conditions.firstTimeGuests || false,
      maxUsagePerGuest: promo.conditions.maxUsagePerGuest || 1,
      combinableWithOtherOffers: promo.conditions.combinableWithOtherOffers || false,
      startDate: promo.validity.startDate.split('T')[0],
      endDate: promo.validity.endDate.split('T')[0],
      totalUsageLimit: promo.usage.totalUsageLimit || 100,
      guestSegments: promo.targeting.guestSegments || [],
      channels: promo.targeting.channels || [],
      isActive: promo.isActive
    });
    setIsEditModalOpen(true);
  };

  const getTypeIcon = (type: string) => {
    const icons = {
      percentage: Percent,
      fixed_amount: IndianRupee,
      free_night: Calendar,
      upgrade: Target
    };
    return icons[type as keyof typeof icons] || Percent;
  };

  const getTypeColor = (type: string) => {
    const colors = {
      percentage: 'bg-blue-100 text-blue-800',
      fixed_amount: 'bg-green-100 text-green-800',
      free_night: 'bg-purple-100 text-purple-800',
      upgrade: 'bg-orange-100 text-orange-800'
    };
    return colors[type as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  const isExpired = (endDate: string) => {
    return new Date(endDate) < new Date();
  };

  const filteredPromoCodes = promoCodes.filter(promo => {
    if (activeTab === 'all') return true;
    if (activeTab === 'active') return promo.isActive && !isExpired(promo.validity.endDate);
    if (activeTab === 'expired') return isExpired(promo.validity.endDate);
    if (activeTab === 'inactive') return !promo.isActive;
    return true;
  });

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex justify-center py-8">
          <div className="text-lg">Loading promo codes...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Promo Code Management</h1>
        <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Create Promo Code
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create Promo Code</DialogTitle>
            </DialogHeader>
            <PromoCodeForm
              formData={formData}
              setFormData={setFormData}
              onSubmit={handleCreatePromoCode}
              onCancel={() => setIsCreateModalOpen(false)}
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* Promo Code Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardContent className="flex items-center p-6">
            <Target className="w-8 h-8 text-blue-600 mr-4" />
            <div>
              <p className="text-sm font-medium text-gray-600">Total Promo Codes</p>
              <p className="text-2xl font-bold">{promoCodes.length}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center p-6">
            <Percent className="w-8 h-8 text-green-600 mr-4" />
            <div>
              <p className="text-sm font-medium text-gray-600">Active Codes</p>
              <p className="text-2xl font-bold">
                {promoCodes.filter(p => p.isActive && !isExpired(p.validity.endDate)).length}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center p-6">
            <BarChart3 className="w-8 h-8 text-purple-600 mr-4" />
            <div>
              <p className="text-sm font-medium text-gray-600">Total Usage</p>
              <p className="text-2xl font-bold">
                {promoCodes.reduce((sum, p) => sum + (p.usage.currentUsage || 0), 0).toLocaleString()}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center p-6">
            <Calendar className="w-8 h-8 text-orange-600 mr-4" />
            <div>
              <p className="text-sm font-medium text-gray-600">Expired Codes</p>
              <p className="text-2xl font-bold">
                {promoCodes.filter(p => isExpired(p.validity.endDate)).length}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Promo Code Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="all">All Codes</TabsTrigger>
          <TabsTrigger value="active">Active</TabsTrigger>
          <TabsTrigger value="expired">Expired</TabsTrigger>
          <TabsTrigger value="inactive">Inactive</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="space-y-4">
          {filteredPromoCodes.length === 0 ? (
            <Card>
              <CardContent className="text-center py-8">
                <Target className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">No promo codes found</p>
                <p className="text-sm text-gray-400">Create your first promo code to get started</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {filteredPromoCodes.map((promo) => {
                const TypeIcon = getTypeIcon(promo.type);
                return (
                  <Card key={promo._id} className="hover:shadow-lg transition-shadow">
                    <CardHeader>
                      <div className="flex justify-between items-start">
                        <div className="flex items-center space-x-3">
                          <TypeIcon className="w-5 h-5 text-gray-600" />
                          <div>
                            <h3 className="text-lg font-semibold">{promo.name}</h3>
                            <p className="text-sm text-gray-600">{promo.description}</p>
                            <div className="flex items-center space-x-2 mt-1">
                              <Badge className={getTypeColor(promo.type)}>
                                {promo.type.replace('_', ' ')}
                              </Badge>
                              <Badge variant={promo.isActive ? "default" : "secondary"}>
                                {promo.isActive ? 'Active' : 'Inactive'}
                              </Badge>
                              {isExpired(promo.validity.endDate) && (
                                <Badge variant="destructive">Expired</Badge>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              navigator.clipboard.writeText(promo.code);
                            }}
                          >
                            <Copy className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openEditModal(promo)}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="flex items-center">
                          <Percent className="w-4 h-4 text-blue-600 mr-2" />
                          <div>
                            <p className="text-sm text-gray-600">Discount</p>
                            <p className="font-semibold">
                              {promo.type === 'percentage' 
                                ? `${promo.discount.value}%` 
                                : `₹${promo.discount.value}`
                              }
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center">
                          <Calendar className="w-4 h-4 text-green-600 mr-2" />
                          <div>
                            <p className="text-sm text-gray-600">Valid Until</p>
                            <p className="font-semibold">
                              {new Date(promo.validity.endDate).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center">
                          <BarChart3 className="w-4 h-4 text-purple-600 mr-2" />
                          <div>
                            <p className="text-sm text-gray-600">Usage</p>
                            <p className="font-semibold">
                              {promo.usage.currentUsage || 0} / {promo.usage.totalUsageLimit || '∞'}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center">
                          <Target className="w-4 h-4 text-orange-600 mr-2" />
                          <div>
                            <p className="text-sm text-gray-600">Min Booking</p>
                            <p className="font-semibold">
                              ₹{promo.conditions.minBookingValue?.toLocaleString() || '0'}
                            </p>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Edit Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Promo Code</DialogTitle>
          </DialogHeader>
          <PromoCodeForm
            formData={formData}
            setFormData={setFormData}
            onSubmit={handleUpdatePromoCode}
            onCancel={() => setIsEditModalOpen(false)}
            isEdit
          />
        </DialogContent>
      </Dialog>
    </div>
  );
};

const PromoCodeForm: React.FC<{
  formData: CreatePromoFormData;
  setFormData: (data: CreatePromoFormData) => void;
  onSubmit: () => void;
  onCancel: () => void;
  isEdit?: boolean;
}> = ({ formData, setFormData, onSubmit, onCancel, isEdit }) => {
  return (
    <Tabs defaultValue="basic" className="w-full">
      <TabsList>
        <TabsTrigger value="basic">Basic Settings</TabsTrigger>
        <TabsTrigger value="discount">Discount & Conditions</TabsTrigger>
        <TabsTrigger value="validity">Validity & Usage</TabsTrigger>
        <TabsTrigger value="targeting">Targeting</TabsTrigger>
      </TabsList>

      <TabsContent value="basic" className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="codeId">Code ID</Label>
            <Input
              id="codeId"
              value={formData.codeId}
              onChange={(e) => setFormData({ ...formData, codeId: e.target.value })}
              placeholder="Enter unique code ID"
            />
          </div>

          <div>
            <Label htmlFor="code">Promo Code</Label>
            <Input
              id="code"
              value={formData.code}
              onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
              placeholder="Enter promo code (e.g., WELCOME20)"
            />
          </div>
        </div>

        <div>
          <Label htmlFor="name">Name</Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="Enter promo code name"
          />
        </div>

        <div>
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="Enter description"
          />
        </div>

        <div>
          <Label htmlFor="type">Discount Type</Label>
          <Select value={formData.type} onValueChange={(value: string) => setFormData({ ...formData, type: value as 'percentage' | 'fixed_amount' | 'free_night' | 'upgrade' })}>
            <SelectTrigger>
              <SelectValue placeholder="Select discount type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="percentage">Percentage</SelectItem>
              <SelectItem value="fixed_amount">Fixed Amount</SelectItem>
              <SelectItem value="free_night">Free Night</SelectItem>
              <SelectItem value="upgrade">Room Upgrade</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </TabsContent>

      <TabsContent value="discount" className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="discountValue">Discount Value</Label>
            <Input
              id="discountValue"
              type="number"
              value={formData.discountValue}
              onChange={(e) => setFormData({ ...formData, discountValue: parseFloat(e.target.value) || 0 })}
              placeholder={formData.type === 'percentage' ? '20' : '500'}
            />
          </div>

          {formData.type === 'percentage' && (
            <div>
              <Label htmlFor="maxAmount">Maximum Discount Amount</Label>
              <Input
                id="maxAmount"
                type="number"
                value={formData.maxAmount || 0}
                onChange={(e) => setFormData({ ...formData, maxAmount: parseFloat(e.target.value) || 0 })}
                placeholder="1000"
              />
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="minBookingValue">Minimum Booking Value</Label>
            <Input
              id="minBookingValue"
              type="number"
              value={formData.minBookingValue || 0}
              onChange={(e) => setFormData({ ...formData, minBookingValue: parseFloat(e.target.value) || 0 })}
              placeholder="1000"
            />
          </div>

          <div>
            <Label htmlFor="minNights">Minimum Nights</Label>
            <Input
              id="minNights"
              type="number"
              value={formData.minNights}
              onChange={(e) => setFormData({ ...formData, minNights: parseInt(e.target.value) || 1 })}
              placeholder="1"
            />
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="firstTimeGuests"
              checked={formData.firstTimeGuests}
              onChange={(e) => setFormData({ ...formData, firstTimeGuests: e.target.checked })}
            />
            <Label htmlFor="firstTimeGuests">First-time guests only</Label>
          </div>

          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="combinableWithOtherOffers"
              checked={formData.combinableWithOtherOffers}
              onChange={(e) => setFormData({ ...formData, combinableWithOtherOffers: e.target.checked })}
            />
            <Label htmlFor="combinableWithOtherOffers">Combinable with other offers</Label>
          </div>
        </div>
      </TabsContent>

      <TabsContent value="validity" className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="startDate">Start Date</Label>
            <Input
              id="startDate"
              type="date"
              value={formData.startDate}
              onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
            />
          </div>

          <div>
            <Label htmlFor="endDate">End Date</Label>
            <Input
              id="endDate"
              type="date"
              value={formData.endDate}
              onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="totalUsageLimit">Total Usage Limit</Label>
            <Input
              id="totalUsageLimit"
              type="number"
              value={formData.totalUsageLimit || 0}
              onChange={(e) => setFormData({ ...formData, totalUsageLimit: parseInt(e.target.value) || 0 })}
              placeholder="100 (0 for unlimited)"
            />
          </div>

          <div>
            <Label htmlFor="maxUsagePerGuest">Max Usage Per Guest</Label>
            <Input
              id="maxUsagePerGuest"
              type="number"
              value={formData.maxUsagePerGuest}
              onChange={(e) => setFormData({ ...formData, maxUsagePerGuest: parseInt(e.target.value) || 1 })}
              placeholder="1"
            />
          </div>
        </div>
      </TabsContent>

      <TabsContent value="targeting" className="space-y-4">
        <div>
          <Label htmlFor="guestSegments">Target Guest Segments</Label>
          <Input
            id="guestSegments"
            value={formData.guestSegments.join(', ')}
            onChange={(e) => setFormData({ 
              ...formData, 
              guestSegments: e.target.value.split(',').map(s => s.trim()).filter(s => s)
            })}
            placeholder="Enter target segments separated by commas (e.g., new_customers, premium, vip)"
          />
        </div>

        <div>
          <Label htmlFor="channels">Target Channels</Label>
          <Input
            id="channels"
            value={formData.channels.join(', ')}
            onChange={(e) => setFormData({ 
              ...formData, 
              channels: e.target.value.split(',').map(s => s.trim()).filter(s => s)
            })}
            placeholder="Enter target channels separated by commas (e.g., website, direct, ota)"
          />
        </div>

        <div className="flex items-center space-x-2">
          <input
            type="checkbox"
            id="isActive"
            checked={formData.isActive}
            onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
          />
          <Label htmlFor="isActive">Active</Label>
        </div>
      </TabsContent>

      <div className="flex justify-end space-x-2 mt-6">
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={onSubmit}>
          {isEdit ? 'Update' : 'Create'} Promo Code
        </Button>
      </div>
    </Tabs>
  );
};

export default PromoCodeManager;
