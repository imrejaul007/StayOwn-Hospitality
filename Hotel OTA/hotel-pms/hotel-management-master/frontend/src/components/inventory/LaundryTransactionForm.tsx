import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from '@/utils/toast';
import {
  Plus,
  Minus,
  Calendar,
  Package,
  AlertCircle,
  Clock,
  IndianRupee,
  Save,
  X,
  Info,
  CheckCircle
} from 'lucide-react';
import { api } from '@/services/api';
import laundryService, { LaundryItem, SendToLaundryRequest } from '@/services/laundryService';
import { formatCurrency } from '@/utils/currencyUtils';

interface LaundryTransactionFormProps {
  roomId?: string;
  onSuccess?: (result: Record<string, unknown>) => void;
  onCancel?: () => void;
  className?: string;
}

interface InventoryItem {
  _id: string;
  name: string;
  category: string;
  unitPrice: number;
  currentQuantity: number;
  expectedQuantity: number;
  condition: string;
}

const LaundryTransactionForm: React.FC<LaundryTransactionFormProps> = ({
  roomId,
  onSuccess,
  onCancel,
  className = ''
}) => {
  const [formData, setFormData] = useState<SendToLaundryRequest>({
    roomId: roomId || '',
    items: [],
    expectedReturnDate: '',
    notes: '',
    specialInstructions: '',
    isUrgent: false
  });
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [itemQuantity, setItemQuantity] = useState(1);
  const [itemNotes, setItemNotes] = useState('');
  const [itemSpecialInstructions, setItemSpecialInstructions] = useState('');

  // Default laundry costs by category
  const laundryCosts = {
    'bedding': 50,
    'towels': 25,
    'bathrobes': 75,
    'curtains': 100,
    'carpets': 200,
    'other': 30
  };

  useEffect(() => {
    if (roomId) {
      fetchRoomInventory();
    }
  }, [roomId]);

  const fetchRoomInventory = async () => {
    try {
      setLoading(true);
      // Fetch real room inventory from the backend
      const response = await api.get(`/room-inventory/rooms/${roomId}`);
      if (response.data?.status === 'success' && response.data?.data?.roomInventory?.items) {
        const items: InventoryItem[] = response.data.data.roomInventory.items
          .filter((item: Record<string, unknown>) => {
            // Only include launderable categories (bedding, towels, bathrobes, curtains, etc.)
            const category = ((item.itemId as Record<string, unknown>)?.category as string || '').toLowerCase();
            const launderableCategories = ['bedding', 'towels', 'bathrobes', 'curtains', 'linens', 'bathroom', 'bedroom'];
            return launderableCategories.some(c => category.includes(c));
          })
          .map((item: Record<string, unknown>) => {
            const itemData = item.itemId as Record<string, unknown> || {};
            return {
              _id: (itemData._id as string) || (item._id as string),
              name: (itemData.name as string) || 'Unknown Item',
              category: (itemData.category as string) || 'other',
              unitPrice: (itemData.unitPrice as number) || 0,
              currentQuantity: (item.currentQuantity as number) || 0,
              expectedQuantity: (item.expectedQuantity as number) || 0,
              condition: (item.condition as string) || 'unknown'
            };
          });
        setInventoryItems(items);
      } else {
        setInventoryItems([]);
      }
    } catch {
      toast.error('Failed to load room inventory');
      setInventoryItems([]);
    } finally {
      setLoading(false);
    }
  };

  const handleAddItem = () => {
    if (!selectedItem || itemQuantity <= 0) {
      toast.error('Please select an item and enter a valid quantity');
      return;
    }

    if (itemQuantity > selectedItem.currentQuantity) {
      toast.error('Quantity cannot exceed available items');
      return;
    }

    const existingItemIndex = formData.items.findIndex(
      item => item.itemId === selectedItem._id
    );

    if (existingItemIndex >= 0) {
      toast.error('This item is already added to the laundry list');
      return;
    }

    const newItem: LaundryItem = {
      itemId: selectedItem._id,
      quantity: itemQuantity,
      notes: itemNotes,
      specialInstructions: itemSpecialInstructions
    };

    setFormData(prev => ({
      ...prev,
      items: [...prev.items, newItem]
    }));

    // Reset form
    setSelectedItem(null);
    setItemQuantity(1);
    setItemNotes('');
    setItemSpecialInstructions('');

    toast.success('Item added to laundry list');
  };

  const handleRemoveItem = (itemId: string) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.filter(item => item.itemId !== itemId)
    }));
    toast.success('Item removed from laundry list');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.roomId) {
      toast.error('Please select a room');
      return;
    }

    if (formData.items.length === 0) {
      toast.error('Please add at least one item to send to laundry');
      return;
    }

    if (!formData.expectedReturnDate) {
      toast.error('Please select an expected return date');
      return;
    }

    try {
      setSubmitting(true);
      const result = await laundryService.sendItemsToLaundry(formData);
      
      toast.success(`Successfully sent ${result.totalItems} items to laundry`);
      
      if (onSuccess) {
        onSuccess(result);
      }

      // Reset form
      setFormData({
        roomId: roomId || '',
        items: [],
        expectedReturnDate: '',
        notes: '',
        specialInstructions: '',
        isUrgent: false
      });
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Failed to send items to laundry');
    } finally {
      setSubmitting(false);
    }
  };

  const calculateTotalCost = () => {
    return formData.items.reduce((total, item) => {
      const inventoryItem = inventoryItems.find(i => i._id === item.itemId);
      if (inventoryItem) {
        const cost = laundryCosts[inventoryItem.category as keyof typeof laundryCosts] || laundryCosts.other;
        return total + (cost * item.quantity);
      }
      return total;
    }, 0);
  };

  const getItemDetails = (itemId: string) => {
    return inventoryItems.find(item => item._id === itemId);
  };

  const getLaundryCost = (category: string) => {
    return laundryCosts[category as keyof typeof laundryCosts] || laundryCosts.other;
  };

  return (
    <div className={`space-y-6 ${className}`}>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="w-5 h-5" />
            Send Items to Laundry
          </CardTitle>
          <CardDescription>
            Select items from the room inventory to send for laundry service
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Room Selection */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="roomId">Room *</Label>
                <Input
                  id="roomId"
                  value={formData.roomId}
                  onChange={(e) => setFormData(prev => ({ ...prev, roomId: e.target.value }))}
                  placeholder="Enter room number"
                  required
                />
              </div>
              <div>
                <Label htmlFor="expectedReturnDate">Expected Return Date *</Label>
                <Input
                  id="expectedReturnDate"
                  type="date"
                  value={formData.expectedReturnDate}
                  onChange={(e) => setFormData(prev => ({ ...prev, expectedReturnDate: e.target.value }))}
                  min={new Date().toISOString().split('T')[0]}
                  required
                />
              </div>
            </div>

            {/* Add Items Section */}
            <div className="border rounded-lg p-4">
              <h3 className="text-lg font-semibold mb-4">Add Items to Laundry</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                <div>
                  <Label htmlFor="itemSelect">Select Item</Label>
                  <Select value={selectedItem?._id || ''} onValueChange={(value) => {
                    const item = inventoryItems.find(i => i._id === value);
                    setSelectedItem(item || null);
                  }}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose an item" />
                    </SelectTrigger>
                    <SelectContent>
                      {inventoryItems.map((item) => (
                        <SelectItem key={item._id} value={item._id}>
                          {item.name} ({item.currentQuantity} available)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="quantity">Quantity</Label>
                  <Input
                    id="quantity"
                    type="number"
                    min="1"
                    max={selectedItem?.currentQuantity || 1}
                    value={itemQuantity}
                    onChange={(e) => setItemQuantity(parseInt(e.target.value) || 1)}
                  />
                </div>

                <div>
                  <Label htmlFor="itemNotes">Notes</Label>
                  <Input
                    id="itemNotes"
                    value={itemNotes}
                    onChange={(e) => setItemNotes(e.target.value)}
                    placeholder="Item-specific notes"
                  />
                </div>

                <div className="flex items-end">
                  <Button
                    type="button"
                    onClick={handleAddItem}
                    disabled={!selectedItem || itemQuantity <= 0}
                    className="w-full"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Item
                  </Button>
                </div>
              </div>

              {selectedItem && (
                <div className="bg-blue-50 p-3 rounded-lg mb-4">
                  <div className="flex items-center gap-2 text-sm text-blue-800">
                    <Info className="w-4 h-4" />
                    <span>
                      <strong>{selectedItem.name}</strong> - 
                      Laundry Cost: {formatCurrency(getLaundryCost(selectedItem.category))} per item
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Selected Items List */}
            {formData.items.length > 0 && (
              <div className="border rounded-lg p-4">
                <h3 className="text-lg font-semibold mb-4">Items to Send to Laundry</h3>
                <div className="space-y-3">
                  {formData.items.map((item, index) => {
                    const itemDetails = getItemDetails(item.itemId);
                    if (!itemDetails) return null;

                    const cost = getLaundryCost(itemDetails.category);
                    const totalCost = cost * item.quantity;

                    return (
                      <div key={item.itemId} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                            <span className="text-sm font-medium text-blue-600">{index + 1}</span>
                          </div>
                          <div>
                            <div className="font-medium text-gray-900">{itemDetails.name}</div>
                            <div className="text-sm text-gray-600">
                              Quantity: {item.quantity} • Cost: {formatCurrency(cost)} per item
                            </div>
                            {item.notes && (
                              <div className="text-xs text-gray-500">Notes: {item.notes}</div>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <div className="font-medium text-gray-900">
                              {formatCurrency(totalCost)}
                            </div>
                            <div className="text-xs text-gray-500">
                              {item.quantity} × {formatCurrency(cost)}
                            </div>
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => handleRemoveItem(item.itemId)}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-4 pt-4 border-t">
                  <div className="flex items-center justify-between">
                    <span className="text-lg font-semibold">Total Cost:</span>
                    <span className="text-lg font-bold text-green-600">
                      {formatCurrency(calculateTotalCost())}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* General Notes and Instructions */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="notes">General Notes</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Any general notes about this laundry request"
                  rows={3}
                />
              </div>
              <div>
                <Label htmlFor="specialInstructions">Special Instructions</Label>
                <Textarea
                  id="specialInstructions"
                  value={formData.specialInstructions}
                  onChange={(e) => setFormData(prev => ({ ...prev, specialInstructions: e.target.value }))}
                  placeholder="Special instructions for the laundry service"
                  rows={3}
                />
              </div>
            </div>

            {/* Urgent Checkbox */}
            <div className="flex items-center space-x-2">
              <Checkbox
                id="isUrgent"
                checked={formData.isUrgent}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isUrgent: !!checked }))}
              />
              <Label htmlFor="isUrgent" className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-orange-500" />
                Mark as urgent (priority processing)
              </Label>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-4 pt-4 border-t">
              {onCancel && (
                <Button type="button" variant="outline" onClick={onCancel}>
                  Cancel
                </Button>
              )}
              <Button
                type="submit"
                disabled={submitting || formData.items.length === 0}
                className="min-w-32"
              >
                {submitting ? (
                  <>
                    <Clock className="w-4 h-4 mr-2 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Send to Laundry
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default LaundryTransactionForm;
