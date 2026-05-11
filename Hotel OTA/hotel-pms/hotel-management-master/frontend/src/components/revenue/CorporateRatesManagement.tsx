import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  Building,
  Plus,
  Edit,
  Trash2,
  IndianRupee,
  Calendar,
  FileText,
  Users,
  TrendingUp,
  Percent,
  CheckCircle,
  XCircle,
  AlertCircle,
  CreditCard,
  Download
} from 'lucide-react';
import { formatCurrency } from '@/utils/currencyUtils';
import revenueManagementService from '@/services/revenueManagementService';
import { toast } from 'react-hot-toast';
import { withErrorBoundary } from '../ErrorBoundary';

interface CorporateRate {
  _id?: string;
  contractId: string;
  company: {
    _id: string;
    name: string;
    contactPerson?: string;
    email?: string;
    phone?: string;
  };
  rateType: 'corporate' | 'government' | 'group' | 'confidential';
  rateDetails: {
    baseRate: number;
    discount: number;
    discountType: 'percentage' | 'fixed';
  };
  roomTypes: {
    roomType: string;
    rate: number;
    discount: number;
  }[];
  validPeriod: {
    startDate: string;
    endDate: string;
  };
  bookingLimits: {
    maxRoomsPerBooking: number;
    maxRoomsPerNight: number;
    totalRoomNights?: number;
  };
  paymentTerms: {
    creditLimit: number;
    paymentDays: number;
    requiresApproval: boolean;
  };
  isActive: boolean;
  performance?: {
    bookings: number;
    revenue: number;
    avgRate: number;
  };
}

const CorporateRatesManagement: React.FC = () => {
  const [corporateRates, setCorporateRates] = useState<CorporateRate[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const [editingRate, setEditingRate] = useState<CorporateRate | null>(null);
  const [activeTab, setActiveTab] = useState('active');

  const [formData, setFormData] = useState<Partial<CorporateRate>>({
    contractId: '',
    company: {
      _id: '',
      name: '',
      contactPerson: '',
      email: '',
      phone: ''
    },
    rateType: 'corporate',
    rateDetails: {
      baseRate: 0,
      discount: 0,
      discountType: 'percentage'
    },
    roomTypes: [],
    validPeriod: {
      startDate: new Date().toISOString().split('T')[0],
      endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    },
    bookingLimits: {
      maxRoomsPerBooking: 10,
      maxRoomsPerNight: 5,
      totalRoomNights: 500
    },
    paymentTerms: {
      creditLimit: 100000,
      paymentDays: 30,
      requiresApproval: false
    },
    isActive: true
  });

  useEffect(() => {
    fetchCorporateRates();
  }, []);

  const fetchCorporateRates = async () => {
    setIsLoading(true);
    try {
      const data = await revenueManagementService.getCorporateRates();
      setCorporateRates(data || []);

      // If no data, show empty state
      if (!data || data.length === 0) {
        toast.info('No corporate rate contracts found. Create your first contract to get started.');
      }
    } catch (error) {
      toast.error('Failed to fetch corporate rates');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (editingRate?._id) {
        // Update existing rate
        await revenueManagementService.updateCorporateRate(editingRate._id, formData as Record<string, unknown>);
        toast.success('Corporate rate updated successfully');
      } else {
        // Create new rate
        await revenueManagementService.createCorporateRate(formData as Record<string, unknown>);
        toast.success('Corporate rate created successfully');
      }

      setShowDialog(false);
      setEditingRate(null);
      resetForm();
      fetchCorporateRates();
    } catch (error) {
      toast.error('Failed to save corporate rate');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEdit = (rate: CorporateRate) => {
    setEditingRate(rate);
    setFormData(rate);
    setShowDialog(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this corporate rate contract?')) return;

    try {
      await revenueManagementService.deleteCorporateRate(id);
      toast.success('Corporate rate deleted successfully');
      fetchCorporateRates();
    } catch (error) {
      toast.error('Failed to delete corporate rate');
    }
  };

  const resetForm = () => {
    setFormData({
      contractId: '',
      company: {
        _id: '',
        name: '',
        contactPerson: '',
        email: '',
        phone: ''
      },
      rateType: 'corporate',
      rateDetails: {
        baseRate: 0,
        discount: 0,
        discountType: 'percentage'
      },
      roomTypes: [],
      validPeriod: {
        startDate: new Date().toISOString().split('T')[0],
        endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      },
      bookingLimits: {
        maxRoomsPerBooking: 10,
        maxRoomsPerNight: 5,
        totalRoomNights: 500
      },
      paymentTerms: {
        creditLimit: 100000,
        paymentDays: 30,
        requiresApproval: false
      },
      isActive: true
    });
  };

  const getRateTypeColor = (type: string) => {
    switch (type) {
      case 'corporate': return 'bg-blue-100 text-blue-800';
      case 'government': return 'bg-green-100 text-green-800';
      case 'group': return 'bg-purple-100 text-purple-800';
      case 'confidential': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (isActive: boolean) => {
    return isActive ?
      <CheckCircle className="w-4 h-4 text-green-600" /> :
      <XCircle className="w-4 h-4 text-red-600" />;
  };

  const calculateEffectiveRate = (baseRate: number, discount: number, discountType: string) => {
    if (discountType === 'percentage') {
      return baseRate * (1 - discount / 100);
    } else {
      return baseRate - discount;
    }
  };

  const exportContracts = () => {
    if (corporateRates.length === 0) {
      toast.error('No data to export');
      return;
    }
    const data = corporateRates.map(rate => ({
      'Contract ID': rate.contractId,
      'Company': rate.company.name,
      'Type': rate.rateType,
      'Base Rate': rate.rateDetails.baseRate,
      'Discount': `${rate.rateDetails.discount}${rate.rateDetails.discountType === 'percentage' ? '%' : ''}`,
      'Effective Rate': calculateEffectiveRate(rate.rateDetails.baseRate, rate.rateDetails.discount, rate.rateDetails.discountType),
      'Valid From': rate.validPeriod.startDate,
      'Valid To': rate.validPeriod.endDate,
      'Status': rate.isActive ? 'Active' : 'Inactive'
    }));

    const csv = [
      Object.keys(data[0]).join(','),
      ...data.map(row => Object.values(row).join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `corporate-rates-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  const activeRates = corporateRates.filter(r => r.isActive);
  const inactiveRates = corporateRates.filter(r => !r.isActive);

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold">Corporate Rate Management</h2>
          <p className="text-sm sm:text-base text-gray-600">Manage negotiated rates and corporate contracts</p>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={exportContracts} className="w-full sm:w-auto">
            <Download className="w-4 h-4 sm:mr-2" />
            <span className="sm:hidden">Export</span>
            <span className="hidden sm:inline">Export</span>
          </Button>

          <Dialog open={showDialog} onOpenChange={setShowDialog}>
            <DialogTrigger asChild>
              <Button onClick={() => {
                setEditingRate(null);
                resetForm();
              }} className="w-full sm:w-auto">
                <Plus className="w-4 h-4 sm:mr-2" />
                <span className="sm:hidden">New Contract</span>
                <span className="hidden sm:inline">New Contract</span>
              </Button>
            </DialogTrigger>

            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="text-base sm:text-lg">
                  {editingRate ? 'Edit Corporate Contract' : 'Create New Corporate Contract'}
                </DialogTitle>
                <DialogDescription className="text-sm">
                  Set up negotiated rates and terms for corporate clients
                </DialogDescription>
              </DialogHeader>

              <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
                <Tabs defaultValue="basic" className="w-full">
                  <TabsList className="grid w-full grid-cols-3 gap-1">
                    <TabsTrigger value="basic" className="text-xs sm:text-sm">Basic Info</TabsTrigger>
                    <TabsTrigger value="rates" className="text-xs sm:text-sm">Rates & Discounts</TabsTrigger>
                    <TabsTrigger value="terms" className="text-xs sm:text-sm">Terms & Limits</TabsTrigger>
                  </TabsList>

                  <TabsContent value="basic" className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="contractId">Contract ID</Label>
                        <Input
                          id="contractId"
                          value={formData.contractId}
                          onChange={(e) => setFormData({ ...formData, contractId: e.target.value })}
                          placeholder="e.g., CORP-2025-001"
                          required
                        />
                      </div>

                      <div>
                        <Label htmlFor="rateType">Rate Type</Label>
                        <Select
                          value={formData.rateType}
                          onValueChange={(value: Record<string, unknown>) => setFormData({ ...formData, rateType: value })}
                        >
                          <SelectTrigger id="rateType">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="corporate">Corporate</SelectItem>
                            <SelectItem value="government">Government</SelectItem>
                            <SelectItem value="group">Group</SelectItem>
                            <SelectItem value="confidential">Confidential</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="companyName">Company Name</Label>
                      <Input
                        id="companyName"
                        value={formData.company?.name}
                        onChange={(e) => setFormData({
                          ...formData,
                          company: { ...formData.company!, name: e.target.value }
                        })}
                        placeholder="e.g., Tech Solutions Pvt Ltd"
                        required
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="contactPerson">Contact Person</Label>
                        <Input
                          id="contactPerson"
                          value={formData.company?.contactPerson}
                          onChange={(e) => setFormData({
                            ...formData,
                            company: { ...formData.company!, contactPerson: e.target.value }
                          })}
                          placeholder="Full name"
                        />
                      </div>

                      <div>
                        <Label htmlFor="email">Email</Label>
                        <Input
                          id="email"
                          type="email"
                          value={formData.company?.email}
                          onChange={(e) => setFormData({
                            ...formData,
                            company: { ...formData.company!, email: e.target.value }
                          })}
                          placeholder="contact@company.com"
                        />
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="rates" className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <Label htmlFor="baseRate">Base Rate (₹)</Label>
                        <Input
                          id="baseRate"
                          type="number"
                          value={formData.rateDetails?.baseRate}
                          onChange={(e) => setFormData({
                            ...formData,
                            rateDetails: { ...formData.rateDetails!, baseRate: parseFloat(e.target.value) }
                          })}
                          min="0"
                          required
                        />
                      </div>

                      <div>
                        <Label htmlFor="discount">Discount</Label>
                        <Input
                          id="discount"
                          type="number"
                          value={formData.rateDetails?.discount}
                          onChange={(e) => setFormData({
                            ...formData,
                            rateDetails: { ...formData.rateDetails!, discount: parseFloat(e.target.value) }
                          })}
                          min="0"
                          required
                        />
                      </div>

                      <div>
                        <Label htmlFor="discountType">Discount Type</Label>
                        <Select
                          value={formData.rateDetails?.discountType}
                          onValueChange={(value: Record<string, unknown>) => setFormData({
                            ...formData,
                            rateDetails: { ...formData.rateDetails!, discountType: value }
                          })}
                        >
                          <SelectTrigger id="discountType">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="percentage">Percentage (%)</SelectItem>
                            <SelectItem value="fixed">Fixed (₹)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {formData.rateDetails && (
                      <div className="p-3 bg-gray-50 rounded-lg">
                        <p className="text-sm text-gray-600">Effective Rate</p>
                        <p className="text-xl font-bold">
                          {formatCurrency(calculateEffectiveRate(
                            formData.rateDetails.baseRate,
                            formData.rateDetails.discount,
                            formData.rateDetails.discountType
                          ))}
                        </p>
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="terms" className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="startDate">Valid From</Label>
                        <Input
                          id="startDate"
                          type="date"
                          value={formData.validPeriod?.startDate}
                          onChange={(e) => setFormData({
                            ...formData,
                            validPeriod: { ...formData.validPeriod!, startDate: e.target.value }
                          })}
                          required
                        />
                      </div>

                      <div>
                        <Label htmlFor="endDate">Valid Until</Label>
                        <Input
                          id="endDate"
                          type="date"
                          value={formData.validPeriod?.endDate}
                          onChange={(e) => setFormData({
                            ...formData,
                            validPeriod: { ...formData.validPeriod!, endDate: e.target.value }
                          })}
                          required
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <Label htmlFor="maxRoomsPerBooking">Max Rooms/Booking</Label>
                        <Input
                          id="maxRoomsPerBooking"
                          type="number"
                          value={formData.bookingLimits?.maxRoomsPerBooking}
                          onChange={(e) => setFormData({
                            ...formData,
                            bookingLimits: { ...formData.bookingLimits!, maxRoomsPerBooking: parseInt(e.target.value) }
                          })}
                          min="1"
                        />
                      </div>

                      <div>
                        <Label htmlFor="maxRoomsPerNight">Max Rooms/Night</Label>
                        <Input
                          id="maxRoomsPerNight"
                          type="number"
                          value={formData.bookingLimits?.maxRoomsPerNight}
                          onChange={(e) => setFormData({
                            ...formData,
                            bookingLimits: { ...formData.bookingLimits!, maxRoomsPerNight: parseInt(e.target.value) }
                          })}
                          min="1"
                        />
                      </div>

                      <div>
                        <Label htmlFor="creditLimit">Credit Limit (₹)</Label>
                        <Input
                          id="creditLimit"
                          type="number"
                          value={formData.paymentTerms?.creditLimit}
                          onChange={(e) => setFormData({
                            ...formData,
                            paymentTerms: { ...formData.paymentTerms!, creditLimit: parseFloat(e.target.value) }
                          })}
                          min="0"
                        />
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Switch
                        id="requiresApproval"
                        checked={formData.paymentTerms?.requiresApproval}
                        onCheckedChange={(checked) => setFormData({
                          ...formData,
                          paymentTerms: { ...formData.paymentTerms!, requiresApproval: checked }
                        })}
                      />
                      <Label htmlFor="requiresApproval">Requires Approval</Label>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Switch
                        id="isActive"
                        checked={formData.isActive}
                        onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
                      />
                      <Label htmlFor="isActive">Active Contract</Label>
                    </div>
                  </TabsContent>
                </Tabs>

                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setShowDialog(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isLoading}>
                    {isLoading ? 'Saving...' : (editingRate ? 'Update' : 'Create')} Contract
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Card>
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm text-gray-600 truncate">Active Contracts</p>
                <p className="text-lg sm:text-2xl font-bold truncate">{activeRates.length}</p>
              </div>
              <Building className="w-6 h-6 sm:w-8 sm:h-8 text-blue-600 flex-shrink-0 ml-2" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm text-gray-600 truncate">Total Revenue</p>
                <p className="text-lg sm:text-2xl font-bold truncate">
                  {formatCurrency(corporateRates.reduce((sum, r) => sum + (r.performance?.revenue || 0), 0))}
                </p>
              </div>
              <IndianRupee className="w-6 h-6 sm:w-8 sm:h-8 text-green-600 flex-shrink-0 ml-2" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm text-gray-600 truncate">Total Bookings</p>
                <p className="text-lg sm:text-2xl font-bold truncate">
                  {corporateRates.reduce((sum, r) => sum + (r.performance?.bookings || 0), 0)}
                </p>
              </div>
              <Users className="w-6 h-6 sm:w-8 sm:h-8 text-purple-600 flex-shrink-0 ml-2" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm text-gray-600 truncate">Avg Discount</p>
                <p className="text-lg sm:text-2xl font-bold truncate">
                  {(() => {
                    const pctRates = corporateRates.filter(r => r.rateDetails.discountType === 'percentage');
                    const total = pctRates.reduce((sum, r) => sum + r.rateDetails.discount, 0);
                    return pctRates.length > 0 ? Math.round(total / pctRates.length) : 0;
                  })()}%
                </p>
              </div>
              <Percent className="w-6 h-6 sm:w-8 sm:h-8 text-orange-600 flex-shrink-0 ml-2" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Contracts Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base sm:text-lg">Corporate Contracts</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-3 gap-1">
              <TabsTrigger value="active" className="text-xs sm:text-sm">Active ({activeRates.length})</TabsTrigger>
              <TabsTrigger value="inactive" className="text-xs sm:text-sm">Inactive ({inactiveRates.length})</TabsTrigger>
              <TabsTrigger value="all" className="text-xs sm:text-sm">All ({corporateRates.length})</TabsTrigger>
            </TabsList>

            <TabsContent value={activeTab} className="mt-4">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Contract</TableHead>
                      <TableHead>Company</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Rate</TableHead>
                      <TableHead>Validity</TableHead>
                      <TableHead>Performance</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(activeTab === 'active' ? activeRates :
                      activeTab === 'inactive' ? inactiveRates :
                      corporateRates).map((rate) => (
                      <TableRow key={rate._id || rate.contractId}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{rate.contractId}</p>
                            <p className="text-xs text-gray-500">
                              {rate.bookingLimits.maxRoomsPerNight} rooms/night
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{rate.company.name}</p>
                            {rate.company.contactPerson && (
                              <p className="text-sm text-gray-500">{rate.company.contactPerson}</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={getRateTypeColor(rate.rateType)}>
                            {rate.rateType}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">
                              {formatCurrency(calculateEffectiveRate(
                                rate.rateDetails.baseRate,
                                rate.rateDetails.discount,
                                rate.rateDetails.discountType
                              ))}
                            </p>
                            <p className="text-xs text-gray-500">
                              -{rate.rateDetails.discount}
                              {rate.rateDetails.discountType === 'percentage' ? '%' : '₹'}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <p>{new Date(rate.validPeriod.startDate).toLocaleDateString()}</p>
                            <p className="text-gray-500">to {new Date(rate.validPeriod.endDate).toLocaleDateString()}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          {rate.performance && (
                            <div className="text-sm">
                              <p>{rate.performance.bookings} bookings</p>
                              <p className="text-gray-500">{formatCurrency(rate.performance.revenue)}</p>
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {getStatusIcon(rate.isActive)}
                            <span className="text-sm">
                              {rate.isActive ? 'Active' : 'Inactive'}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEdit(rate)}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(rate._id!)}
                              className="text-red-600 hover:text-red-700"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default withErrorBoundary(CorporateRatesManagement, { level: 'component' });