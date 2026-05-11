import React, { useState, useEffect } from 'react';
import {
  Package,
  Plus,
  Minus,
  Camera,
  Upload,
  Save,
  AlertTriangle,
  CheckCircle,
  X,
  Search,
  RefreshCw
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LoadingSpinner } from '../LoadingSpinner';
import { formatCurrency } from '../../utils/formatters';
import { roomInventoryService, InventoryItem, RoomInventory } from '../../services/roomInventoryService';

interface ReplacementRequestFormProps {
  roomId: string;
  onComplete?: (request: Record<string, unknown>) => void;
  onCancel?: () => void;
  preselectedItems?: string[];
}

interface RequestItem {
  itemId: string;
  itemName: string;
  category: string;
  currentStock: number;
  requestedQuantity: number;
  condition: 'damaged' | 'worn' | 'missing' | 'hygiene' | 'guest_request';
  reason: string;
  notes: string;
  photos: string[];
  unitPrice: number;
  totalCost: number;
}

export function ReplacementRequestForm({
  roomId,
  onComplete,
  onCancel,
  preselectedItems = []
}: ReplacementRequestFormProps) {
  const [availableItems, setAvailableItems] = useState<InventoryItem[]>([]);
  const [roomInventory, setRoomInventory] = useState<RoomInventory | null>(null);
  const [requestItems, setRequestItems] = useState<RequestItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [generalNotes, setGeneralNotes] = useState('');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high' | 'urgent'>('medium');

  const categories = [
    'all',
    'bedding',
    'toiletries',
    'minibar',
    'electronics',
    'amenities',
    'cleaning',
    'furniture'
  ];

  const conditionOptions = [
    { value: 'damaged', label: 'Damaged', color: 'text-red-600' },
    { value: 'worn', label: 'Worn Out', color: 'text-orange-600' },
    { value: 'missing', label: 'Missing', color: 'text-gray-600' },
    { value: 'hygiene', label: 'Hygiene Replacement', color: 'text-blue-600' },
    { value: 'guest_request', label: 'Guest Request', color: 'text-purple-600' }
  ];

  useEffect(() => {
    fetchData();
  }, [roomId]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [itemsResponse, roomResponse] = await Promise.all([
        roomInventoryService.getInventoryItems({ active: true }),
        roomInventoryService.getRoomInventory(roomId)
      ]);

      setAvailableItems(itemsResponse.data.items);
      setRoomInventory(roomResponse.data.roomInventory);

      // Pre-select items if provided
      if (preselectedItems.length > 0) {
        const preselected = preselectedItems.map(itemId => {
          const item = itemsResponse.data.items.find(i => i._id === itemId);
          const roomItem = roomResponse.data.roomInventory.items.find(ri => ri.itemId._id === itemId);
          
          if (item && roomItem) {
            return {
              itemId: item._id,
              itemName: item.name,
              category: item.category,
              currentStock: roomItem.currentQuantity,
              requestedQuantity: 1,
              condition: 'damaged' as const,
              reason: '',
              notes: '',
              photos: [],
              unitPrice: item.unitPrice,
              totalCost: item.unitPrice
            };
          }
          return null;
        }).filter(Boolean) as RequestItem[];

        setRequestItems(preselected);
      }
    } catch {
      // Error handled silently
    } finally {
      setLoading(false);
    }
  };

  const filteredItems = availableItems.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         item.category.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory;
    const notAlreadyAdded = !requestItems.some(ri => ri.itemId === item._id);
    
    return matchesSearch && matchesCategory && notAlreadyAdded;
  });

  const addItem = (item: InventoryItem) => {
    const roomItem = roomInventory?.items.find(ri => ri.itemId._id === item._id);
    
    const newRequestItem: RequestItem = {
      itemId: item._id,
      itemName: item.name,
      category: item.category,
      currentStock: roomItem?.currentQuantity || 0,
      requestedQuantity: 1,
      condition: 'damaged',
      reason: '',
      notes: '',
      photos: [],
      unitPrice: item.unitPrice,
      totalCost: item.unitPrice
    };

    setRequestItems(prev => [...prev, newRequestItem]);
  };

  const updateRequestItem = (itemId: string, updates: Partial<RequestItem>) => {
    setRequestItems(prev => prev.map(item => {
      if (item.itemId === itemId) {
        const updated = { ...item, ...updates };
        if (updates.requestedQuantity !== undefined) {
          updated.totalCost = updated.requestedQuantity * updated.unitPrice;
        }
        return updated;
      }
      return item;
    }));
  };

  const removeItem = (itemId: string) => {
    setRequestItems(prev => prev.filter(item => item.itemId !== itemId));
  };

  const getTotalCost = () => {
    return requestItems.reduce((sum, item) => sum + item.totalCost, 0);
  };

  const submitRequest = async () => {
    if (requestItems.length === 0) return;

    try {
      setSubmitting(true);
      
      const requestData = {
        items: requestItems.map(item => ({
          itemId: item.itemId,
          quantity: item.requestedQuantity,
          condition: item.condition
        })),
        reason: generalNotes || 'Item replacement request',
        notes: `Priority: ${priority}\n\nDetailed items:\n${requestItems.map(item => 
          `- ${item.itemName} (${item.requestedQuantity}x): ${item.reason || item.condition} - ${item.notes}`
        ).join('\n')}`
      };

      const response = await roomInventoryService.requestItemReplacement(roomId, requestData);
      onComplete?.(response);
    } catch {
      // Error handled silently
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Item Replacement Request</h1>
            <p className="text-gray-600">
              Room {roomInventory?.roomId.roomNumber} - {roomInventory?.roomId.type}
            </p>
          </div>
          <div className="text-right">
            <div className="text-sm text-gray-500">Total Cost</div>
            <div className="text-2xl font-bold text-gray-900">
              {formatCurrency(getTotalCost())}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Available Items */}
        <div className="lg:col-span-1">
          <Card className="p-4 h-full">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Available Items</h2>
              <Badge variant="secondary">
                {filteredItems.length} items
              </Badge>
            </div>

            {/* Search and Filter */}
            <div className="space-y-3 mb-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search items..."
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {categories.map(category => (
                  <option key={category} value={category}>
                    {category === 'all' ? 'All Categories' : 
                     category.charAt(0).toUpperCase() + category.slice(1)}
                  </option>
                ))}
              </select>
            </div>

            {/* Items List */}
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {filteredItems.map(item => (
                <div
                  key={item._id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <div className="flex-1">
                    <div className="flex items-center space-x-3">
                      {item.imageUrl ? (
                        <img 
                          src={item.imageUrl} 
                          alt={item.name}
                          className="w-8 h-8 rounded object-cover"
                        />
                      ) : (
                        <div className="w-8 h-8 bg-gray-300 rounded flex items-center justify-center">
                          <Package className="w-4 h-4 text-gray-600" />
                        </div>
                      )}
                      <div>
                        <p className="font-medium text-gray-900 text-sm">{item.name}</p>
                        <p className="text-xs text-gray-500">{formatCurrency(item.unitPrice)}</p>
                      </div>
                    </div>
                  </div>
                  <Button
                    onClick={() => addItem(item)}
                    size="sm"
                    className="ml-2"
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              ))}

              {filteredItems.length === 0 && (
                <div className="text-center py-8">
                  <Package className="mx-auto h-8 w-8 text-gray-400 mb-3" />
                  <p className="text-gray-500">No items found</p>
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* Right: Request Items */}
        <div className="lg:col-span-2">
          <Card className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-gray-900">Request Items</h2>
              <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                {requestItems.length} items selected
              </Badge>
            </div>

            {requestItems.length === 0 ? (
              <div className="text-center py-12">
                <AlertTriangle className="mx-auto h-12 w-12 text-yellow-500 mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No Items Selected</h3>
                <p className="text-gray-600">Add items from the available items list to create a replacement request.</p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Request Priority */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Priority Level
                  </label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as unknown)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="low">Low - Can wait</option>
                    <option value="medium">Medium - Normal priority</option>
                    <option value="high">High - Important</option>
                    <option value="urgent">Urgent - ASAP</option>
                  </select>
                </div>

                {/* Request Items */}
                <div className="space-y-4">
                  {requestItems.map(item => (
                    <Card key={item.itemId} className="p-4 border-l-4 border-l-orange-500">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 bg-orange-100 rounded flex items-center justify-center">
                            <Package className="w-5 h-5 text-orange-600" />
                          </div>
                          <div>
                            <h3 className="font-semibold text-gray-900">{item.itemName}</h3>
                            <p className="text-sm text-gray-600">{item.category}</p>
                            <p className="text-xs text-gray-500">Current: {item.currentStock}</p>
                          </div>
                        </div>
                        <Button
                          onClick={() => removeItem(item.itemId)}
                          size="sm"
                          variant="secondary"
                          className="text-red-600 hover:bg-red-50"
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Quantity Needed
                          </label>
                          <div className="flex items-center space-x-2">
                            <Button
                              onClick={() => updateRequestItem(item.itemId, {
                                requestedQuantity: Math.max(1, item.requestedQuantity - 1)
                              })}
                              size="sm"
                              variant="secondary"
                            >
                              <Minus className="w-4 h-4" />
                            </Button>
                            <span className="px-3 py-1 bg-gray-100 rounded text-center min-w-[60px]">
                              {item.requestedQuantity}
                            </span>
                            <Button
                              onClick={() => updateRequestItem(item.itemId, {
                                requestedQuantity: item.requestedQuantity + 1
                              })}
                              size="sm"
                              variant="secondary"
                            >
                              <Plus className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Condition/Reason
                          </label>
                          <select
                            value={item.condition}
                            onChange={(e) => updateRequestItem(item.itemId, {
                              condition: e.target.value as RequestItem['condition']
                            })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          >
                            {conditionOptions.map(option => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Specific Reason
                          </label>
                          <input
                            type="text"
                            value={item.reason}
                            onChange={(e) => updateRequestItem(item.itemId, {
                              reason: e.target.value
                            })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            placeholder="Brief description of why replacement is needed"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Additional Notes
                          </label>
                          <textarea
                            value={item.notes}
                            onChange={(e) => updateRequestItem(item.itemId, {
                              notes: e.target.value
                            })}
                            rows={2}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            placeholder="Additional details, specific requirements, etc."
                          />
                        </div>
                      </div>

                      <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-200">
                        <div className="text-sm text-gray-600">
                          Unit Price: {formatCurrency(item.unitPrice)}
                        </div>
                        <div className="font-semibold text-gray-900">
                          Total: {formatCurrency(item.totalCost)}
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>

                {/* General Notes */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    General Notes
                  </label>
                  <textarea
                    value={generalNotes}
                    onChange={(e) => setGeneralNotes(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Overall request notes, special instructions, timeline requirements..."
                  />
                </div>

                {/* Cost Summary */}
                <Card className="p-4 bg-gray-50">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-gray-900">Request Summary</h3>
                      <p className="text-sm text-gray-600">
                        {requestItems.length} items • {requestItems.reduce((sum, item) => sum + item.requestedQuantity, 0)} total quantity
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-gray-900">
                        {formatCurrency(getTotalCost())}
                      </div>
                      <div className="text-sm text-gray-600">Total estimated cost</div>
                    </div>
                  </div>
                </Card>
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center justify-between mt-6">
        <div className="flex space-x-3">
          {onCancel && (
            <Button onClick={onCancel} variant="secondary">
              Cancel
            </Button>
          )}
        </div>

        <div className="flex space-x-3">
          <Button
            onClick={() => window.location.reload()}
            variant="secondary"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Reset
          </Button>
          
          <Button
            onClick={submitRequest}
            disabled={requestItems.length === 0 || submitting}
            className="bg-orange-600 hover:bg-orange-700"
          >
            {submitting ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                Submitting...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Submit Request
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}