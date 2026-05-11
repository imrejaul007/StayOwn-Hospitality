import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  X, 
  Plus, 
  Trash2, 
  Package,
  CheckCircle,
  AlertTriangle,
  Clock
} from 'lucide-react';
import { checkoutInventoryService, CheckoutInventory as CheckoutInventoryType } from '../../services/checkoutInventoryService';
import { bookingService } from '../../services/bookingService';
import { formatDate } from '../../utils/formatters';
import toast from 'react-hot-toast';

interface Booking {
  _id: string;
  bookingNumber: string;
  checkIn: string;
  checkOut: string;
  status: string;
  rooms: Array<{
    roomId: {
      _id: string;
      roomNumber: string;
      type: string;
    };
    rate: number;
  }>;
}

interface CheckoutInventoryFormProps {
  onSuccess: () => void;
  onCancel: () => void;
}

// Predefined inventory items with dummy prices
const INVENTORY_ITEMS = {
  bathroom: [
    { name: 'Towels', price: 150 },
    { name: 'Soap', price: 50 },
    { name: 'Shampoo', price: 80 },
    { name: 'Toilet Paper', price: 30 },
    { name: 'Toothbrush', price: 40 },
    { name: 'Toothpaste', price: 60 },
    { name: 'Hair Dryer', price: 500 },
    { name: 'Bath Mat', price: 200 }
  ],
  bedroom: [
    { name: 'Bed Sheets', price: 300 },
    { name: 'Pillows', price: 250 },
    { name: 'Blanket', price: 400 },
    { name: 'Hangers', price: 100 },
    { name: 'Iron', price: 800 },
    { name: 'Ironing Board', price: 600 }
  ],
  kitchen: [
    { name: 'Coffee Maker', price: 1200 },
    { name: 'Microwave', price: 2000 },
    { name: 'Refrigerator', price: 15000 },
    { name: 'Dishes', price: 500 },
    { name: 'Cutlery', price: 300 },
    { name: 'Coffee/Tea', price: 100 }
  ],
  electronics: [
    { name: 'TV Remote', price: 400 },
    { name: 'Phone Charger', price: 200 },
    { name: 'Lamp', price: 600 },
    { name: 'Alarm Clock', price: 300 }
  ],
  furniture: [
    { name: 'Chair', price: 800 },
    { name: 'Table', price: 1200 },
    { name: 'Wardrobe', price: 3000 },
    { name: 'Mirror', price: 500 }
  ],
  other: [
    { name: 'Room Key', price: 200 },
    { name: 'WiFi Router', price: 1500 },
    { name: 'Air Conditioner Remote', price: 300 }
  ]
};

export function CheckoutInventoryForm({ onSuccess, onCancel }: CheckoutInventoryFormProps) {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<string>('');
  const [selectedRoom, setSelectedRoom] = useState<string>('');
  const [items, setItems] = useState<Array<{
    itemName: string;
    category: string;
    quantity: number;
    unitPrice: number;
    status: string;
    notes?: string;
  }>>([]);
  const [notes, setNotes] = useState('');
  const [checkingExisting, setCheckingExisting] = useState(false);
  const [existingInventory, setExistingInventory] = useState<CheckoutInventoryType | null>(null);

  useEffect(() => {
    fetchBookings();
  }, []);

  // Re-check for existing inventory whenever booking OR room selection changes,
  // because the backend duplicate guard is per booking+room (not just per booking).
  useEffect(() => {
    if (selectedBooking && selectedRoom) {
      checkExistingInventory(selectedBooking, selectedRoom);
    } else {
      setExistingInventory(null);
    }
  }, [selectedBooking, selectedRoom]);

  const fetchBookings = async () => {
    try {
      const response = await bookingService.getBookings({ status: 'checked_in', limit: 100 });
      const raw = response?.data;
      const bookingsData = Array.isArray(raw?.bookings) ? raw.bookings : Array.isArray(raw) ? raw : [];
      setBookings(bookingsData);
    } catch (error) {
      toast.error('Failed to load bookings');
    }
  };

  const checkExistingInventory = async (bookingId: string, roomId: string) => {
    try {
      setCheckingExisting(true);
      // Query by bookingId — the backend duplicate guard is per booking+room, so we filter
      // the returned list by roomId to check for an existing record for this exact combination.
      const response = await checkoutInventoryService.getCheckoutInventories({ bookingId, limit: 50 });
      const inventories = response.data.checkoutInventories || [];
      const match = inventories.find(inv => {
        const invRoomId = (inv.roomId as { _id?: string } | null)?._id ?? (inv.roomId as unknown as string);
        return invRoomId === roomId;
      });
      setExistingInventory(match ?? null);
    } catch (error: unknown) {
      // 404 means no records — this is normal
      const axiosError = error as { response?: { status?: number } };
      if (axiosError?.response?.status === 404) {
        setExistingInventory(null);
      }
      // Other errors (network, server) are silently ignored to avoid blocking form usage
    } finally {
      setCheckingExisting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedBooking || !selectedRoom || items.length === 0) {
      toast.error('Please fill in all required fields and add at least one item');
      return;
    }

    if (existingInventory) {
      toast.error('Inventory check already exists for this booking. Please view existing checkout inventory instead.');
      return;
    }

    try {
      setLoading(true);
      await checkoutInventoryService.createCheckoutInventory({
        bookingId: selectedBooking,
        roomId: selectedRoom,
        items,
        notes
      });
      onSuccess();
    } catch (error: unknown) {
      const axiosError = error as { response?: { data?: { message?: string } } };
      const msg = axiosError?.response?.data?.message || 'Failed to create checkout inventory';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const addItem = (category: string, itemName: string, price: number) => {
    setItems(prev => {
      const newItems = [...prev, {
        itemName,
        category,
        quantity: 1,
        unitPrice: price,
        status: 'intact',
        notes: ''
      }];
      return newItems;
    });
  };

  const toggleItem = (category: string, itemName: string, price: number) => {
    const existingItemIndex = items.findIndex(i => i.itemName === itemName && i.category === category);
    
    if (existingItemIndex >= 0) {
      // Item exists, remove it
      setItems(prev => prev.filter((_, index) => index !== existingItemIndex));
    } else {
      // Item doesn't exist, add it
      addItem(category, itemName, price);
    }
  };

  const removeItem = (index: number) => {
    setItems(prev => prev.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, field: string, value: unknown) => {
    setItems(prev => prev.map((item, i) => 
      i === index ? { ...item, [field]: value } : item
    ));
  };

  const getSelectedBooking = bookings.find(b => b._id === selectedBooking);
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'intact': return 'bg-green-100 text-green-800';
      case 'used': return 'bg-blue-100 text-blue-800';
      case 'damaged': return 'bg-red-100 text-red-800';
      case 'missing': return 'bg-orange-100 text-orange-800';
      case 'consumed': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'intact': return <CheckCircle className="h-4 w-4" />;
      case 'used': return <Clock className="h-4 w-4" />;
      case 'damaged': return <AlertTriangle className="h-4 w-4" />;
      case 'missing': return <X className="h-4 w-4" />;
      case 'consumed': return <Package className="h-4 w-4" />;
      default: return <Package className="h-4 w-4" />;
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold text-gray-900">Create Checkout Inventory Check</h2>
            <Button variant="ghost" size="sm" onClick={onCancel}>
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Booking and Room Selection */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Booking *
              </label>
              <select
                value={selectedBooking}
                onChange={(e) => {
                  setSelectedBooking(e.target.value);
                  setSelectedRoom('');
                }}
                className="w-full p-2 border border-gray-300 rounded-md"
                required
              >
                <option value="">Choose a booking</option>
                {bookings.map(booking => (
                  <option key={booking._id} value={booking._id}>
                    #{booking.bookingNumber} - {formatDate(booking.checkIn)} to {formatDate(booking.checkOut)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Room *
              </label>
              <select
                value={selectedRoom}
                onChange={(e) => setSelectedRoom(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-md"
                required
                disabled={!selectedBooking}
              >
                <option value="">Choose a room</option>
                {getSelectedBooking?.rooms.map(room => (
                  <option key={room.roomId._id} value={room.roomId._id}>
                    {room.roomId.roomNumber} ({room.roomId.type})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Existing Inventory Warning */}
          {checkingExisting && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center">
                <Clock className="h-5 w-5 text-blue-600 mr-2" />
                <span className="text-blue-800">Checking for existing inventory...</span>
              </div>
            </div>
          )}

          {existingInventory && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex items-start">
                <AlertTriangle className="h-5 w-5 text-yellow-600 mr-3 mt-0.5" />
                <div className="flex-1">
                  <h4 className="font-medium text-yellow-800 mb-1">
                    Inventory Check Already Exists
                  </h4>
                  <p className="text-yellow-700 text-sm mb-3">
                    This booking already has an inventory check created on {formatDate(existingInventory.createdAt)}.
                    Status: <span className="font-medium capitalize">{existingInventory.status}</span>
                  </p>
                  <p className="text-yellow-700 text-sm">
                    You cannot create a new inventory check. Please go to the Checkout Queue to view or manage the existing one.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Inventory Items Selection */}
          <div className={existingInventory ? 'opacity-50 pointer-events-none' : ''}>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Inventory Items</h3>
            
            {/* Predefined Items by Category */}
            <div className="space-y-4">
              {Object.entries(INVENTORY_ITEMS).map(([category, categoryItems]) => (
                <div key={category} className="border border-gray-200 rounded-lg p-4">
                  <h4 className="font-medium text-gray-900 mb-3 capitalize">{category} Items</h4>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                    {categoryItems.map((item) => {
                      const existingItem = items.find(i => i.itemName === item.name && i.category === category);
                      const isAdded = !!existingItem;
                      
                      return (
                        <Button
                          key={item.name}
                          type="button"
                          variant={isAdded ? "primary" : "outline"}
                          size="sm"
                          onClick={() => toggleItem(category, item.name, item.price)}
                          className={`text-xs ${isAdded ? 'bg-green-600 hover:bg-green-700' : ''}`}
                        >
                          {isAdded ? (
                            <>
                              <CheckCircle className="h-3 w-3 mr-1" />
                              {item.name} (x{existingItem.quantity})
                            </>
                          ) : (
                            <>
                              <Plus className="h-3 w-3 mr-1" />
                              {item.name} (₹{item.price})
                            </>
                          )}
                        </Button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Selected Items */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Selected Items ({items.length})</h3>
            {items.length > 0 ? (
              <>
                <div className="space-y-3">
                  {items.map((item, index) => (
                    <div key={`items-${index}-${item.category}`} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex-1">
                          <h4 className="font-medium text-gray-900">{item.itemName}</h4>
                          <p className="text-sm text-gray-600 capitalize">{item.category}</p>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeItem(index)}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Quantity</label>
                          <Input
                            type="number"
                            value={item.quantity}
                            onChange={(e) => updateItem(index, 'quantity', parseInt(e.target.value) || 1)}
                            min="1"
                            className="w-full"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Unit Price (₹)</label>
                          <Input
                            type="number"
                            value={item.unitPrice}
                            onChange={(e) => updateItem(index, 'unitPrice', parseInt(e.target.value) || 0)}
                            min="0"
                            className="w-full"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                          <select
                            value={item.status}
                            onChange={(e) => updateItem(index, 'status', e.target.value)}
                            className="w-full p-2 border border-gray-300 rounded-md"
                          >
                            <option value="intact">Intact</option>
                            <option value="used">Used</option>
                            <option value="damaged">Damaged</option>
                            <option value="missing">Missing</option>
                            <option value="consumed">Consumed</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Total (₹)</label>
                          <div className="p-2 bg-gray-50 rounded-md text-sm font-medium">
                            {item.quantity * item.unitPrice}
                          </div>
                        </div>
                      </div>

                      <div className="mt-3">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                        <Input
                          value={item.notes || ''}
                          onChange={(e) => updateItem(index, 'notes', e.target.value)}
                          placeholder="Any additional notes..."
                          className="w-full"
                        />
                      </div>

                      <div className="mt-2">
                        <Badge className={getStatusColor(item.status)}>
                          {getStatusIcon(item.status)}
                          <span className="ml-1 capitalize">{item.status}</span>
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Summary */}
                <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                  <h4 className="font-medium text-gray-900 mb-2">Summary</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600">Total Items:</span>
                      <span className="ml-2 font-medium">{items.length}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Subtotal:</span>
                      <span className="ml-2 font-medium">₹{items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0)}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Tax (18%):</span>
                      <span className="ml-2 font-medium">₹{Math.round(items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0) * 0.18)}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Total:</span>
                      <span className="ml-2 font-medium text-green-600">₹{Math.round(items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0) * 1.18)}</span>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <Package className="mx-auto h-12 w-12 mb-2" />
                <p>Click on inventory items above to add them to this checkout</p>
              </div>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Additional Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any additional notes about the inventory check..."
              className="w-full p-2 border border-gray-300 rounded-md h-20"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t border-gray-200">
            <Button
              type="submit"
              loading={loading}
              disabled={items.length === 0 || !!existingInventory || checkingExisting}
            >
              {existingInventory ? 'Cannot Create - Already Exists' : 'Create Inventory Check'}
            </Button>
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
