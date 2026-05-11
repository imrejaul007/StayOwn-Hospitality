import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Badge } from '../ui/badge';
import { Textarea } from '../ui/textarea';
import { Checkbox } from '../ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Plus, Minus, Package, CheckCircle, AlertCircle, Search, X } from 'lucide-react';
import { toast } from 'react-hot-toast';

interface InventoryItem {
  _id: string;
  name: string;
  category: string;
  // Unified Inventory model fields (from /api/v1/inventory)
  currentStock: number;   // mapped from quantity
  unitPrice: number;      // mapped from costPerUnit
  isComplimentary: boolean;
  isChargeable: boolean;
  maxComplimentary: number;
  description?: string;
}

interface ConsumptionItem {
  inventoryItemId: string;
  quantity: number;
  notes?: string;
  replacementType?: string;
  isComplimentary?: boolean;
  chargeToGuest?: boolean;
}

interface PredictedConsumption {
  inventoryItem: InventoryItem;
  recommendedQuantity: number;
  confidence: number;
  historicalAverage: number;
}

interface FormData {
  consumptionType: 'housekeeping' | 'guest_service';
  housekeepingTaskId?: string;
  guestServiceId?: string;
  roomId?: string;
  consumptions: ConsumptionItem[];
}

interface InventoryConsumptionFormProps {
  mode: 'housekeeping' | 'guest_service';
  taskId?: string;
  serviceId?: string;
  roomId?: string;
  onSuccess?: () => void;
  onCancel?: () => void;
}

const InventoryConsumptionForm: React.FC<InventoryConsumptionFormProps> = ({
  mode,
  taskId,
  serviceId,
  roomId,
  onSuccess,
  onCancel
}) => {
  const [formData, setFormData] = useState<FormData>({
    consumptionType: mode,
    housekeepingTaskId: taskId,
    guestServiceId: serviceId,
    roomId,
    consumptions: []
  });

  const [availableItems, setAvailableItems] = useState<InventoryItem[]>([]);
  const [predictions, setPredictions] = useState<PredictedConsumption[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);

  useEffect(() => {
    fetchAvailableItems();
    if (mode === 'housekeeping' && roomId) {
      fetchPredictions();
    }
  }, [mode, roomId]);

  const fetchAvailableItems = async () => {
    try {
      setLoading(true);
      // Backend returns { status: 'success', data: { items: [...] }, pagination: {...} }
      // Fields: quantity (currentStock), costPerUnit (unitPrice), minimumThreshold, etc.
      // Use max limit (100) allowed by the backend to reduce round-trips.
      const { data: result } = await api.get('/inventory?limit=100&page=1');
      if (result.status === 'success') {
        const rawItems: Record<string, unknown>[] = result.data?.items || [];
        // Map unified Inventory model fields to the shape this component expects
        const mappedItems: InventoryItem[] = rawItems.map((item) => ({
          _id: item._id as string,
          name: item.name as string,
          category: item.category as string,
          currentStock: typeof item.quantity === 'number' ? (item.quantity as number) : 0,
          unitPrice: typeof item.costPerUnit === 'number' ? (item.costPerUnit as number) : 0,
          isComplimentary: false,
          isChargeable: typeof item.costPerUnit === 'number' && (item.costPerUnit as number) > 0,
          maxComplimentary: 0,
          description: item.description as string | undefined
        }));
        setAvailableItems(mappedItems);
      }
    } catch (error) {
      toast.error('Failed to load inventory items');
    } finally {
      setLoading(false);
    }
  };

  const fetchPredictions = async () => {
    if (!roomId) return;

    try {
      const { data: result } = await api.post('/inventory/consumption/housekeeping/predict', {
        roomId,
        taskTypes: ['cleaning', 'bed_making', 'bathroom', 'amenities']
      });
      if (result.success) {
        setPredictions(result.data.recommendations || []);
      }
    } catch {
      // Error handled silently
    }
  };

  const filteredItems = availableItems.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         item.description?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = !selectedCategory || item.category === selectedCategory;
    return matchesSearch && matchesCategory && item.currentStock > 0;
  });

  const addConsumptionItem = (item: InventoryItem, predictedQuantity?: number) => {
    const existingIndex = formData.consumptions.findIndex(
      c => c.inventoryItemId === item._id
    );

    if (existingIndex >= 0) {
      // Update existing item
      const updated = [...formData.consumptions];
      updated[existingIndex].quantity += predictedQuantity || 1;
      setFormData({ ...formData, consumptions: updated });
    } else {
      // Add new item
      const newConsumption: ConsumptionItem = {
        inventoryItemId: item._id,
        quantity: predictedQuantity || 1,
        isComplimentary: item.isComplimentary,
        chargeToGuest: mode === 'guest_service' && item.isChargeable
      };

      setFormData({
        ...formData,
        consumptions: [...formData.consumptions, newConsumption]
      });
    }

    toast.success(`Added ${item.name} to consumption list`);
  };

  const updateConsumptionItem = (index: number, field: keyof ConsumptionItem, value: unknown) => {
    const updated = [...formData.consumptions];
    updated[index] = { ...updated[index], [field]: value };
    setFormData({ ...formData, consumptions: updated });
  };

  const removeConsumptionItem = (index: number) => {
    const updated = formData.consumptions.filter((_, i) => i !== index);
    setFormData({ ...formData, consumptions: updated });
  };

  const getItemById = (id: string) => {
    return availableItems.find(item => item._id === id);
  };

  const calculateTotalCost = () => {
    return formData.consumptions.reduce((total, consumption) => {
      const item = getItemById(consumption.inventoryItemId);
      return total + (item ? item.unitPrice * consumption.quantity : 0);
    }, 0);
  };

  const handleSubmit = async () => {
    if (formData.consumptions.length === 0) {
      toast.error('Please add at least one item to consume');
      return;
    }

    try {
      setSubmitLoading(true);

      const { data: result } = await api.post('/inventory/consumption', formData);

      if (result.success) {
        toast.success('Inventory consumption recorded successfully');
        if (onSuccess) onSuccess();
      } else {
        toast.error(result.message || 'Failed to record consumption');
      }
    } catch (error) {
      toast.error('Failed to record consumption');
    } finally {
      setSubmitLoading(false);
    }
  };

  const categories = [...new Set(availableItems.map(item => item.category))];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Package className="h-5 w-5" />
            <span>
              {mode === 'housekeeping' ? 'Housekeeping' : 'Guest Service'} Inventory Consumption
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="items" className="space-y-6">
            <TabsList>
              <TabsTrigger value="items">Available Items</TabsTrigger>
              {mode === 'housekeeping' && (
                <TabsTrigger value="predictions">AI Predictions</TabsTrigger>
              )}
              <TabsTrigger value="consumption">
                Consumption List ({formData.consumptions.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="items" className="space-y-4">
              {/* Search and Filters */}
              <div className="flex gap-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search inventory items..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="All Categories" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All Categories</SelectItem>
                    {categories.map(category => (
                      <SelectItem key={category} value={category}>
                        {category.charAt(0).toUpperCase() + category.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Available Items Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-96 overflow-y-auto">
                {filteredItems.map(item => (
                  <Card key={item._id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="space-y-3">
                        <div className="flex justify-between items-start">
                          <h3 className="font-medium text-sm">{item.name}</h3>
                          <Badge variant="outline" className="text-xs">
                            {item.category}
                          </Badge>
                        </div>

                        {item.description && (
                          <p className="text-xs text-gray-600 line-clamp-2">{item.description}</p>
                        )}

                        <div className="space-y-1 text-xs">
                          <div className="flex justify-between">
                            <span>Stock:</span>
                            <span className={item.currentStock < 10 ? 'text-red-500' : ''}>
                              {item.currentStock}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span>Price:</span>
                            <span>₹{item.unitPrice.toFixed(2)}</span>
                          </div>
                        </div>

                        <div className="flex gap-2">
                          {item.isComplimentary && (
                            <Badge variant="secondary" className="text-xs">
                              Complimentary
                            </Badge>
                          )}
                          {item.isChargeable && (
                            <Badge variant="outline" className="text-xs">
                              Chargeable
                            </Badge>
                          )}
                        </div>

                        <Button
                          size="sm"
                          onClick={() => addConsumptionItem(item)}
                          disabled={item.currentStock === 0}
                          className="w-full"
                        >
                          <Plus className="h-3 w-3 mr-1" />
                          Add
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            {mode === 'housekeeping' && (
              <TabsContent value="predictions" className="space-y-4">
                {predictions.length > 0 ? (
                  <div className="space-y-4">
                    <div className="text-sm text-gray-600 mb-4">
                      AI-powered predictions based on historical consumption patterns for this room type
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {predictions.map((prediction, index) => (
                        <Card key={`predictions-${index}`} className="border-blue-200">
                          <CardContent className="p-4">
                            <div className="space-y-3">
                              <div className="flex justify-between items-start">
                                <h3 className="font-medium">{prediction.inventoryItem.name}</h3>
                                <Badge className="bg-blue-100 text-blue-800">
                                  {prediction.confidence}% confident
                                </Badge>
                              </div>

                              <div className="space-y-2 text-sm">
                                <div className="flex justify-between">
                                  <span>Recommended:</span>
                                  <span className="font-medium">{prediction.recommendedQuantity} units</span>
                                </div>
                                <div className="flex justify-between">
                                  <span>Historical avg:</span>
                                  <span>{prediction.historicalAverage} units</span>
                                </div>
                                <div className="flex justify-between">
                                  <span>Current stock:</span>
                                  <span>{prediction.inventoryItem.currentStock}</span>
                                </div>
                              </div>

                              <Button
                                size="sm"
                                onClick={() => addConsumptionItem(
                                  prediction.inventoryItem,
                                  prediction.recommendedQuantity
                                )}
                                disabled={prediction.inventoryItem.currentStock < prediction.recommendedQuantity}
                                className="w-full"
                              >
                                <CheckCircle className="h-3 w-3 mr-1" />
                                Use Prediction
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <AlertCircle className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-gray-500">No predictions available for this room</p>
                  </div>
                )}
              </TabsContent>
            )}

            <TabsContent value="consumption" className="space-y-4">
              {formData.consumptions.length > 0 ? (
                <div className="space-y-4">
                  {formData.consumptions.map((consumption, index) => {
                    const item = getItemById(consumption.inventoryItemId);
                    if (!item) return null;

                    return (
                      <Card key={`formData-consumptions-${index}`}>
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between space-x-4">
                            <div className="flex-1 space-y-3">
                              <div className="flex items-center justify-between">
                                <h3 className="font-medium">{item.name}</h3>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => removeConsumptionItem(index)}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>

                              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div>
                                  <label className="text-sm font-medium">Quantity</label>
                                  <div className="flex items-center space-x-2 mt-1">
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => updateConsumptionItem(
                                        index,
                                        'quantity',
                                        Math.max(1, consumption.quantity - 1)
                                      )}
                                    >
                                      <Minus className="h-3 w-3" />
                                    </Button>
                                    <Input
                                      type="number"
                                      value={consumption.quantity}
                                      onChange={(e) => updateConsumptionItem(
                                        index,
                                        'quantity',
                                        Math.max(1, parseInt(e.target.value) || 1)
                                      )}
                                      className="w-20 text-center"
                                      min="1"
                                      max={item.currentStock}
                                    />
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => updateConsumptionItem(
                                        index,
                                        'quantity',
                                        Math.min(item.currentStock, consumption.quantity + 1)
                                      )}
                                    >
                                      <Plus className="h-3 w-3" />
                                    </Button>
                                  </div>
                                </div>

                                {mode === 'housekeeping' && (
                                  <div>
                                    <label className="text-sm font-medium">Replacement Type</label>
                                    <Select
                                      value={consumption.replacementType || ''}
                                      onValueChange={(value) => updateConsumptionItem(index, 'replacementType', value)}
                                    >
                                      <SelectTrigger className="mt-1">
                                        <SelectValue placeholder="None" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="">None</SelectItem>
                                        <SelectItem value="damaged">Damaged</SelectItem>
                                        <SelectItem value="lost">Lost</SelectItem>
                                        <SelectItem value="wear_and_tear">Wear & Tear</SelectItem>
                                        <SelectItem value="theft">Theft</SelectItem>
                                        <SelectItem value="guest_request">Guest Request</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                )}

                                <div>
                                  <label className="text-sm font-medium">Cost</label>
                                  <p className="text-lg font-bold mt-1">
                                    ₹{(item.unitPrice * consumption.quantity).toFixed(2)}
                                  </p>
                                </div>
                              </div>

                              {mode === 'guest_service' && (
                                <div className="flex items-center space-x-4">
                                  <div className="flex items-center space-x-2">
                                    <Checkbox
                                      checked={consumption.isComplimentary}
                                      onCheckedChange={(checked) => updateConsumptionItem(
                                        index,
                                        'isComplimentary',
                                        checked
                                      )}
                                    />
                                    <label className="text-sm">Complimentary</label>
                                  </div>
                                  <div className="flex items-center space-x-2">
                                    <Checkbox
                                      checked={consumption.chargeToGuest}
                                      onCheckedChange={(checked) => updateConsumptionItem(
                                        index,
                                        'chargeToGuest',
                                        checked
                                      )}
                                    />
                                    <label className="text-sm">Charge to Guest</label>
                                  </div>
                                </div>
                              )}

                              <div>
                                <label className="text-sm font-medium">Notes (Optional)</label>
                                <Textarea
                                  value={consumption.notes || ''}
                                  onChange={(e) => updateConsumptionItem(index, 'notes', e.target.value)}
                                  placeholder="Add any notes about this consumption..."
                                  className="mt-1"
                                  rows={2}
                                />
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}

                  {/* Summary */}
                  <Card className="border-green-200">
                    <CardContent className="p-4">
                      <div className="flex justify-between items-center">
                        <span className="text-lg font-medium">Total Cost:</span>
                        <span className="text-2xl font-bold text-green-600">
                          ₹{calculateTotalCost().toFixed(2)}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              ) : (
                <div className="text-center py-8">
                  <Package className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-gray-500">No items added to consumption list</p>
                  <p className="text-sm text-gray-400">Add items from the Available Items tab</p>
                </div>
              )}
            </TabsContent>
          </Tabs>

          {/* Action Buttons */}
          <div className="flex justify-end space-x-4 pt-6 border-t">
            {onCancel && (
              <Button variant="outline" onClick={onCancel}>
                Cancel
              </Button>
            )}
            <Button
              onClick={handleSubmit}
              disabled={formData.consumptions.length === 0 || submitLoading}
            >
              {submitLoading ? 'Recording...' : 'Record Consumption'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default InventoryConsumptionForm;