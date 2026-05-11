import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import toast from 'react-hot-toast';
import {
  ClipboardCheck,
  AlertTriangle,
  IndianRupee,
  Save,
  X,
  Plus,
  Minus,
  CheckCircle,
  Camera,
  Upload,
  Trash2
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PhotoUpload } from '../inventory/PhotoUpload';
import { formatCurrency } from '../../utils/formatters';

interface InventoryItem {
  itemId: string;
  itemName: string;
  category: string;
  expectedQuantity: number;
  actualQuantity: number;
  condition: 'excellent' | 'good' | 'fair' | 'worn' | 'damaged' | 'missing';
  needsReplacement: boolean;
  replacementReason?: string;
  chargeGuest: boolean;
  replacementCost: number;
  notes: string;
  photos: Array<{
    id: string;
    url: string;
    description: string;
    file?: File;
  }>;
}

interface DailyInventoryCheckFormProps {
  roomId: string;
  roomNumber: string;
  onClose: () => void;
  onSubmit: (checkData: Record<string, unknown>) => Promise<void>;
  initialData?: InventoryItem[];
}

export function DailyInventoryCheckForm({
  roomId,
  roomNumber,
  onClose,
  onSubmit,
  initialData = []
}: DailyInventoryCheckFormProps) {
  const [items, setItems] = useState<InventoryItem[]>(initialData);
  const [checkType, setCheckType] = useState<'daily_maintenance' | 'post_checkout' | 'pre_checkin'>('daily_maintenance');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingTemplate, setLoadingTemplate] = useState(true);

  // Load template data whenever roomId changes.
  // fetchTemplate is defined inside the effect so the dep array is exhaustive
  // (only roomId matters) and there is no stale-closure risk.
  useEffect(() => {
    let cancelled = false;

    const fetchTemplate = async () => {
      try {
        setLoadingTemplate(true);
        // Use the correct daily-routine-check endpoint for room inventory templates
        const { data } = await api.get(`/daily-routine-check/rooms/${roomId}/inventory`);
        if (cancelled) return;
        const roomData = data.data;
        // Map template items to the InventoryItem format expected by this form
        const allItems = [
          ...(roomData.fixedInventory || []).map((item: { _id: string; name: string; category: string; unitPrice?: number; quantity?: number }) => ({
            itemId: item._id,
            itemName: item.name,
            category: item.category,
            expectedQuantity: item.quantity || 1,
            actualQuantity: item.quantity || 1,
            condition: 'good' as const,
            needsReplacement: false,
            chargeGuest: false,
            replacementCost: item.unitPrice || 0,
            notes: '',
            photos: []
          })),
          ...(roomData.dailyInventory || []).map((item: { _id: string; name: string; category: string; unitPrice?: number; quantity?: number }) => ({
            itemId: item._id,
            itemName: item.name,
            category: item.category,
            expectedQuantity: item.quantity || 1,
            actualQuantity: item.quantity || 1,
            condition: 'good' as const,
            needsReplacement: false,
            chargeGuest: false,
            replacementCost: item.unitPrice || 0,
            notes: '',
            photos: []
          }))
        ];
        setItems(allItems);
      } catch (err: unknown) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : 'Failed to load inventory template';
        toast.error(message);
      } finally {
        if (!cancelled) setLoadingTemplate(false);
      }
    };

    fetchTemplate();

    // If roomId changes before the request resolves, ignore the stale response
    return () => { cancelled = true; };
  }, [roomId]);

  const updateItem = (index: number, field: keyof InventoryItem, value: unknown) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };

    // Auto-set needsReplacement based on condition
    if (field === 'condition') {
      const conditionValue = value as string;
      newItems[index].needsReplacement = ['damaged', 'missing', 'worn'].includes(conditionValue);

      // Auto-set charge guest for damage/missing items
      if (['damaged', 'missing'].includes(conditionValue)) {
        newItems[index].chargeGuest = true;
        newItems[index].replacementReason = conditionValue === 'damaged' ? 'guest_damage' : 'missing';
      } else {
        newItems[index].chargeGuest = false;
        newItems[index].replacementReason = '';
      }
    }

    setItems(newItems);
  };

  // PhotoUpload returns a richer Photo type; map it down to our InventoryItem photo shape.
  const updateItemPhotos = (index: number, incomingPhotos: Array<{ id: string; url: string; description: string; file?: File; [key: string]: unknown }>) => {
    const photos: InventoryItem['photos'] = incomingPhotos.map(p => ({
      id: p.id,
      url: p.url,
      description: p.description,
      ...(p.file ? { file: p.file } : {})
    }));
    const newItems = [...items];
    newItems[index] = { ...newItems[index], photos };
    setItems(newItems);
  };

  const getConditionColor = (condition: string) => {
    switch (condition) {
      case 'excellent': return 'bg-green-100 text-green-800';
      case 'good': return 'bg-blue-100 text-blue-800';
      case 'fair': return 'bg-yellow-100 text-yellow-800';
      case 'worn': return 'bg-orange-100 text-orange-800';
      case 'damaged': return 'bg-red-100 text-red-800';
      case 'missing': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getTotalCharges = () => {
    return items.reduce((total, item) => {
      return total + (item.chargeGuest ? item.replacementCost : 0);
    }, 0);
  };

  const getIssueCount = () => {
    return items.filter(item => item.needsReplacement).length;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate that items requiring guest charges have documentation photos
    const missingPhotos = items.filter(
      (item) => item.chargeGuest && (!item.photos || item.photos.length === 0)
    );
    if (missingPhotos.length > 0) {
      const names = missingPhotos.map((i) => i.itemName).join(', ');
      toast.error(`Please add documentation photos for: ${names}`);
      return;
    }

    try {
      setLoading(true);
      
      // First, upload all photos that need uploading
      const itemsWithUploadedPhotos = await Promise.all(
        items.map(async (item) => {
          if (item.photos && item.photos.length > 0) {
            const uploadedPhotos = await Promise.all(
              item.photos.map(async (photo) => {
                if (photo.file) {
                  // Upload the photo
                  const formData = new FormData();
                  formData.append('photo', photo.file);
                  formData.append('description', photo.description);
                  formData.append('roomId', roomId);
                  formData.append('itemId', item.itemId);
                  
                  const { data: uploadData } = await api.post('/photos/upload', formData, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                  });
                  return {
                    id: uploadData.data.id,
                    url: uploadData.data.url,
                    description: photo.description
                  };
                }
                return photo;
              })
            );
            return { ...item, photos: uploadedPhotos };
          }
          return item;
        })
      );
      
      const checkData = {
        roomId,
        checkType,
        inventoryItems: itemsWithUploadedPhotos.map(item => ({
          itemId: item.itemId,
          expectedQuantity: item.expectedQuantity,
          actualQuantity: item.actualQuantity,
          condition: item.condition,
          needsReplacement: item.needsReplacement,
          replacementReason: item.replacementReason,
          chargeGuest: item.chargeGuest,
          replacementCost: item.chargeGuest ? item.replacementCost : 0,
          notes: item.notes,
          photos: item.photos || []
        })),
        notes
      };

      await onSubmit(checkData);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to complete inventory check';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  if (loadingTemplate) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-center h-32">
          <div className="text-center">
            <ClipboardCheck className="h-8 w-8 text-gray-400 mx-auto mb-2" />
            <p className="text-gray-500">Loading inventory template...</p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="max-w-6xl mx-auto">
      <form onSubmit={handleSubmit} className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between border-b pb-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 flex items-center">
              <ClipboardCheck className="h-6 w-6 mr-2" />
              Daily Inventory Check - Room {roomNumber}
            </h2>
            <p className="text-gray-600 mt-1">Record condition and replacements for all inventory items</p>
          </div>
          <button aria-label="Close"
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Check Type */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Check Type</label>
          <select
            value={checkType}
            onChange={(e) => setCheckType(e.target.value as 'daily_maintenance' | 'post_checkout' | 'pre_checkin')}
            className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="daily_maintenance">Daily Maintenance</option>
            <option value="post_checkout">Post Checkout</option>
            <option value="pre_checkin">Pre Check-in</option>
          </select>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="p-4">
            <div className="flex items-center">
              <ClipboardCheck className="h-8 w-8 text-blue-600" />
              <div className="ml-3">
                <p className="text-sm text-gray-600">Total Items</p>
                <p className="text-xl font-semibold">{items.length}</p>
              </div>
            </div>
          </Card>
          
          <Card className="p-4">
            <div className="flex items-center">
              <AlertTriangle className="h-8 w-8 text-orange-600" />
              <div className="ml-3">
                <p className="text-sm text-gray-600">Issues Found</p>
                <p className="text-xl font-semibold">{getIssueCount()}</p>
              </div>
            </div>
          </Card>
          
          <Card className="p-4">
            <div className="flex items-center">
              <IndianRupee className="h-8 w-8 text-green-600" />
              <div className="ml-3">
                <p className="text-sm text-gray-600">Guest Charges</p>
                <p className="text-xl font-semibold">{formatCurrency(getTotalCharges())}</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Inventory Items */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-900">Inventory Items</h3>
          
          {items.map((item, index) => (
            <Card key={item.itemId} className="p-4">
              <div className="grid grid-cols-1 lg:grid-cols-6 gap-4 items-center">
                {/* Item Info */}
                <div className="lg:col-span-1">
                  <h4 className="font-medium text-gray-900">{item.itemName}</h4>
                  <p className="text-sm text-gray-600 capitalize">{item.category}</p>
                </div>

                {/* Quantity */}
                <div className="flex items-center space-x-2">
                  <label className="text-sm text-gray-600">Qty:</label>
                  <div className="flex items-center space-x-1">
                    <button aria-label="Decrease quantity"
                      type="button"
                      onClick={() => updateItem(index, 'actualQuantity', Math.max(0, item.actualQuantity - 1))}
                      className="p-1 text-gray-600 hover:text-gray-800"
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                    <span className="w-8 text-center font-medium">{item.actualQuantity}</span>
                    <button aria-label="Add"
                      type="button"
                      onClick={() => updateItem(index, 'actualQuantity', item.actualQuantity + 1)}
                      className="p-1 text-gray-600 hover:text-gray-800"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                  <span className="text-sm text-gray-500">/ {item.expectedQuantity}</span>
                </div>

                {/* Condition */}
                <div>
                  <select
                    value={item.condition}
                    onChange={(e) => updateItem(index, 'condition', e.target.value)}
                    className="w-full p-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="excellent">Excellent</option>
                    <option value="good">Good</option>
                    <option value="fair">Fair</option>
                    <option value="worn">Worn</option>
                    <option value="damaged">Damaged</option>
                    <option value="missing">Missing</option>
                  </select>
                  <Badge className={`mt-1 ${getConditionColor(item.condition)}`}>
                    {item.condition}
                  </Badge>
                </div>

                {/* Replacement */}
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    checked={item.needsReplacement}
                    onChange={(e) => updateItem(index, 'needsReplacement', e.target.checked)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500"
                  />
                  <label className="ml-2 text-sm text-gray-700">Replace</label>
                </div>

                {/* Charge Guest */}
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    checked={item.chargeGuest}
                    onChange={(e) => updateItem(index, 'chargeGuest', e.target.checked)}
                    disabled={!item.needsReplacement}
                    className="h-4 w-4 text-red-600 focus:ring-red-500"
                  />
                  <label className="ml-2 text-sm text-gray-700">
                    Charge {formatCurrency(item.replacementCost)}
                  </label>
                </div>

                {/* Notes */}
                <div className="lg:col-span-1">
                  <input
                    type="text"
                    placeholder="Notes..."
                    value={item.notes}
                    onChange={(e) => updateItem(index, 'notes', e.target.value)}
                    className="w-full p-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Photo Upload Section - Only show for damaged/missing items */}
              {(item.condition === 'damaged' || item.condition === 'missing' || item.needsReplacement) && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <div className="flex items-center mb-2">
                    <Camera className="h-4 w-4 text-gray-600 mr-2" />
                    <label className="text-sm font-medium text-gray-700">
                      Documentation Photos
                    </label>
                    <span className="text-xs text-gray-500 ml-2">
                      (Required for damage/missing items)
                    </span>
                  </div>
                  <PhotoUpload
                    photos={item.photos || []}
                    onPhotosChange={(photos) => updateItemPhotos(index, photos)}
                    maxPhotos={5}
                    required={item.chargeGuest}
                  />
                </div>
              )}
            </Card>
          ))}
        </div>

        {/* Overall Notes */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Additional Notes
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="Any additional observations or notes..."
          />
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between pt-6 border-t">
          <div className="text-sm text-gray-600">
            {getIssueCount() > 0 && (
              <span className="text-orange-600 flex items-center">
                <AlertTriangle className="h-4 w-4 mr-1" />
                {getIssueCount()} items need attention
              </span>
            )}
            {getTotalCharges() > 0 && (
              <span className="text-red-600 ml-4">
                Guest charges: {formatCurrency(getTotalCharges())}
              </span>
            )}
          </div>
          
          <div className="flex space-x-3">
            <Button
              type="button"
              variant="secondary"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="flex items-center"
            >
              {loading ? (
                <>
                  <ClipboardCheck className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Complete Check
                </>
              )}
            </Button>
          </div>
        </div>
      </form>
    </Card>
  );
}