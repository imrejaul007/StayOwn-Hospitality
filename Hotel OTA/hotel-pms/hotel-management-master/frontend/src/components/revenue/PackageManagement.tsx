import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Plus,
  Edit,
  Trash2,
  Package,
  Calendar,
  IndianRupee,
  Check,
  X,
  Info,
  Coffee,
  Utensils,
  Car,
  Wifi,
  Sparkles
} from 'lucide-react';
import { formatCurrency } from '@/utils/currencyUtils';
import revenueManagementService from '@/services/revenueManagementService';
import { toast } from 'react-hot-toast';

interface PackageData {
  _id?: string;
  packageId?: string;
  name: string;
  description: string;
  type: string;
  baseRate: number;
  inclusions: {
    service: string;
    description: string;
    value: number;
  }[];
  roomTypes: string[];
  validDates: {
    startDate: string;
    endDate: string;
  };
  bookingWindow: {
    minAdvance: number;
    maxAdvance: number;
  };
  lengthOfStay: {
    minNights: number;
    maxNights: number;
  };
  isActive: boolean;
}

const PackageManagement: React.FC = () => {
  const [packages, setPackages] = useState<PackageData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const [editingPackage, setEditingPackage] = useState<PackageData | null>(null);
  const [formData, setFormData] = useState<PackageData>({
    name: '',
    description: '',
    type: 'room_only',
    baseRate: 0,
    inclusions: [],
    roomTypes: [],
    validDates: {
      startDate: new Date().toISOString().split('T')[0],
      endDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    },
    bookingWindow: {
      minAdvance: 1,
      maxAdvance: 90
    },
    lengthOfStay: {
      minNights: 1,
      maxNights: 7
    },
    isActive: true
  });

  useEffect(() => {
    fetchPackages();
  }, []);

  const fetchPackages = async () => {
    setIsLoading(true);
    try {
      const data = await revenueManagementService.getPackages();
      setPackages(data);
    } catch (error) {
      toast.error('Failed to fetch packages');

      // Try to get packages from alternative source or keep empty state
      setPackages([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (editingPackage?._id) {
        await revenueManagementService.updatePackage(editingPackage._id, formData);
        toast.success('Package updated successfully');
      } else {
        await revenueManagementService.createPackage(formData);
        toast.success('Package created successfully');
      }

      setShowDialog(false);
      setEditingPackage(null);
      resetForm();
      fetchPackages();
    } catch (error) {
      toast.error('Failed to save package');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEdit = (pkg: PackageData) => {
    setEditingPackage(pkg);
    setFormData(pkg);
    setShowDialog(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this package?')) return;

    try {
      await revenueManagementService.deletePackage(id);
      toast.success('Package deleted successfully');
      fetchPackages();
    } catch (error) {
      toast.error('Failed to delete package');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      type: 'room_only',
      baseRate: 0,
      inclusions: [],
      roomTypes: [],
      validDates: {
        startDate: new Date().toISOString().split('T')[0],
        endDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      },
      bookingWindow: {
        minAdvance: 1,
        maxAdvance: 90
      },
      lengthOfStay: {
        minNights: 1,
        maxNights: 7
      },
      isActive: true
    });
  };

  const addInclusion = () => {
    setFormData({
      ...formData,
      inclusions: [...formData.inclusions, { service: '', description: '', value: 0 }]
    });
  };

  const updateInclusion = (index: number, field: keyof typeof formData.inclusions[0], value: string | number) => {
    const updated = [...formData.inclusions];
    updated[index] = { ...updated[index], [field]: value };
    setFormData({ ...formData, inclusions: updated });
  };

  const removeInclusion = (index: number) => {
    setFormData({
      ...formData,
      inclusions: formData.inclusions.filter((_, i) => i !== index)
    });
  };

  const getPackageIcon = (type: string) => {
    switch (type) {
      case 'bed_breakfast': return <Coffee className="w-4 h-4" />;
      case 'all_inclusive': return <Sparkles className="w-4 h-4" />;
      case 'half_board':
      case 'full_board': return <Utensils className="w-4 h-4" />;
      case 'business': return <Wifi className="w-4 h-4" />;
      default: return <Package className="w-4 h-4" />;
    }
  };

  const getPackageTypeColor = (type: string) => {
    switch (type) {
      case 'all_inclusive': return 'bg-purple-100 text-purple-800';
      case 'bed_breakfast': return 'bg-yellow-100 text-yellow-800';
      case 'business': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold">Package Management</h2>
          <p className="text-gray-600">Create and manage hotel packages and special offers</p>
        </div>

        <Dialog open={showDialog} onOpenChange={setShowDialog}>
          <DialogTrigger asChild>
            <Button onClick={() => {
              setEditingPackage(null);
              resetForm();
            }}>
              <Plus className="w-4 h-4 mr-2" />
              Create Package
            </Button>
          </DialogTrigger>

          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingPackage ? 'Edit Package' : 'Create New Package'}
              </DialogTitle>
              <DialogDescription>
                Define package details, inclusions, and booking rules
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Basic Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name">Package Name</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                    placeholder="e.g., Weekend Getaway"
                  />
                </div>

                <div>
                  <Label htmlFor="type">Package Type</Label>
                  <Select
                    value={formData.type}
                    onValueChange={(value) => setFormData({ ...formData, type: value })}
                  >
                    <SelectTrigger id="type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="room_only">Room Only</SelectItem>
                      <SelectItem value="bed_breakfast">Bed & Breakfast</SelectItem>
                      <SelectItem value="half_board">Half Board</SelectItem>
                      <SelectItem value="full_board">Full Board</SelectItem>
                      <SelectItem value="all_inclusive">All Inclusive</SelectItem>
                      <SelectItem value="spa">Spa Package</SelectItem>
                      <SelectItem value="business">Business Package</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                  placeholder="Describe what makes this package special..."
                />
              </div>

              <div>
                <Label htmlFor="baseRate">Base Rate (₹)</Label>
                <Input
                  id="baseRate"
                  type="number"
                  value={formData.baseRate}
                  onChange={(e) => setFormData({ ...formData, baseRate: parseFloat(e.target.value) })}
                  required
                  min="0"
                />
              </div>

              {/* Inclusions */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <Label>Package Inclusions</Label>
                  <Button type="button" variant="outline" size="sm" onClick={addInclusion}>
                    <Plus className="w-4 h-4 mr-1" />
                    Add Inclusion
                  </Button>
                </div>

                <div className="space-y-2">
                  {formData.inclusions.map((inclusion, index) => (
                    <div key={`formData-inclusions-${inclusion.value}`} className="flex gap-2 items-start">
                      <Input
                        placeholder="Service"
                        value={inclusion.service}
                        onChange={(e) => updateInclusion(index, 'service', e.target.value)}
                      />
                      <Input
                        placeholder="Description"
                        value={inclusion.description}
                        onChange={(e) => updateInclusion(index, 'description', e.target.value)}
                      />
                      <Input
                        type="number"
                        placeholder="Value"
                        value={inclusion.value}
                        onChange={(e) => updateInclusion(index, 'value', parseFloat(e.target.value))}
                        className="w-24"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeInclusion(index)}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Valid Dates */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="startDate">Valid From</Label>
                  <Input
                    id="startDate"
                    type="date"
                    value={formData.validDates.startDate}
                    onChange={(e) => setFormData({
                      ...formData,
                      validDates: { ...formData.validDates, startDate: e.target.value }
                    })}
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="endDate">Valid Until</Label>
                  <Input
                    id="endDate"
                    type="date"
                    value={formData.validDates.endDate}
                    onChange={(e) => setFormData({
                      ...formData,
                      validDates: { ...formData.validDates, endDate: e.target.value }
                    })}
                    required
                  />
                </div>
              </div>

              {/* Booking Window */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="minAdvance">Min Advance Booking (days)</Label>
                  <Input
                    id="minAdvance"
                    type="number"
                    value={formData.bookingWindow.minAdvance}
                    onChange={(e) => setFormData({
                      ...formData,
                      bookingWindow: { ...formData.bookingWindow, minAdvance: parseInt(e.target.value) }
                    })}
                    min="0"
                  />
                </div>

                <div>
                  <Label htmlFor="maxAdvance">Max Advance Booking (days)</Label>
                  <Input
                    id="maxAdvance"
                    type="number"
                    value={formData.bookingWindow.maxAdvance}
                    onChange={(e) => setFormData({
                      ...formData,
                      bookingWindow: { ...formData.bookingWindow, maxAdvance: parseInt(e.target.value) }
                    })}
                    min="1"
                  />
                </div>
              </div>

              {/* Length of Stay */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="minNights">Min Nights</Label>
                  <Input
                    id="minNights"
                    type="number"
                    value={formData.lengthOfStay.minNights}
                    onChange={(e) => setFormData({
                      ...formData,
                      lengthOfStay: { ...formData.lengthOfStay, minNights: parseInt(e.target.value) }
                    })}
                    min="1"
                  />
                </div>

                <div>
                  <Label htmlFor="maxNights">Max Nights</Label>
                  <Input
                    id="maxNights"
                    type="number"
                    value={formData.lengthOfStay.maxNights}
                    onChange={(e) => setFormData({
                      ...formData,
                      lengthOfStay: { ...formData.lengthOfStay, maxNights: parseInt(e.target.value) }
                    })}
                    min="1"
                  />
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="isActive"
                  checked={formData.isActive}
                  onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
                />
                <Label htmlFor="isActive">Active</Label>
              </div>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setShowDialog(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isLoading}>
                  {isLoading ? 'Saving...' : (editingPackage ? 'Update' : 'Create')} Package
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Packages List */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Package</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Rate</TableHead>
                  <TableHead>Valid Period</TableHead>
                  <TableHead>Stay Length</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      Loading packages...
                    </TableCell>
                  </TableRow>
                ) : packages.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      No packages found. Create your first package to get started.
                    </TableCell>
                  </TableRow>
                ) : (
                  packages.map((pkg) => (
                    <TableRow key={pkg._id || pkg.packageId}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getPackageIcon(pkg.type)}
                          <div>
                            <p className="font-medium">{pkg.name}</p>
                            <p className="text-sm text-gray-500">{pkg.description}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={getPackageTypeColor(pkg.type)}>
                          {pkg.type.replace('_', ' ')}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{formatCurrency(pkg.baseRate)}</div>
                        {pkg.inclusions?.length > 0 && (
                          <p className="text-xs text-gray-500">
                            +{pkg.inclusions.length} inclusions
                          </p>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <p>{pkg.validDates?.startDate ? new Date(pkg.validDates.startDate).toLocaleDateString() : 'N/A'}</p>
                          <p className="text-gray-500">to {pkg.validDates?.endDate ? new Date(pkg.validDates.endDate).toLocaleDateString() : 'N/A'}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {pkg.lengthOfStay?.minNights && pkg.lengthOfStay?.maxNights
                            ? `${pkg.lengthOfStay.minNights}-${pkg.lengthOfStay.maxNights} nights`
                            : 'N/A'
                          }
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={pkg.isActive ? 'default' : 'secondary'}>
                          {pkg.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(pkg)}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(pkg._id!)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PackageManagement;