import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { 
  ClipboardList, 
  Clock, 
  CheckCircle, 
  AlertTriangle, 
  RefreshCw,
  Plus,
  Calendar,
  Home,
  Package,
  Search,
  Filter,
  Eye,
  ShoppingCart,
  RotateCcw,
  CheckSquare,
  X
} from 'lucide-react';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { dailyRoutineCheckService, DailyCheckData, RoomInventoryItem } from '../../services/dailyRoutineCheckService';
import toast from 'react-hot-toast';
import { withErrorBoundary } from '../../components/ErrorBoundary';

interface CartItem {
  itemId: string;
  itemName: string;
  category: string;
  inventoryType: 'fixed' | 'daily';
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  action: 'replace' | 'add' | 'laundry' | 'reuse';
  notes?: string;
}

function DailyRoutineCheck() {
  const [rooms, setRooms] = useState<DailyCheckData[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState('all'); // all, pending, completed, overdue
  const [selectedRoom, setSelectedRoom] = useState<DailyCheckData | null>(null);
  const [showRoomDetails, setShowRoomDetails] = useState(false);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showCart, setShowCart] = useState(false);
  const [addedItems, setAddedItems] = useState<Set<string>>(new Set());

  // Track per-item flash timers so clearing one doesn't cancel another item's animation
  const timerMapRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    const timerMap = timerMapRef.current;
    return () => {
      // Clear all pending flash timers on unmount
      timerMap.forEach((timerId) => clearTimeout(timerId));
      timerMap.clear();
    };
  }, []);

  const fetchRooms = useCallback(async () => {
    try {
      setLoading(true);
      const response = await dailyRoutineCheckService.getRoomsForDailyCheck({ filter, assignedToMe: true });
      setRooms(response.data.rooms || []);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to load rooms for daily check';
      toast.error(message);
      setRooms([]);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    fetchRooms();
  }, [fetchRooms]);

  const handleStartCheck = (room: DailyCheckData) => {
    setSelectedRoom(room);
    setShowRoomDetails(true);
  };

  const handleCompleteCheck = async (roomId: string) => {
    // Confirm when no items were actioned so staff don't accidentally submit empty checks
    if (cart.length === 0) {
      const confirmed = window.confirm(
        'No inventory actions recorded. Complete check with no changes?'
      );
      if (!confirmed) return;
    }

    // Guard against double-submit
    if (submitting) return;

    try {
      setSubmitting(true);
      await dailyRoutineCheckService.completeDailyCheck(roomId, { cart });
      toast.success('Daily check completed successfully!');
      setShowRoomDetails(false);
      setSelectedRoom(null);
      setCart([]);
      fetchRooms(); // Refresh the list
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to complete daily check';
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  const addToCart = (item: RoomInventoryItem, action: 'replace' | 'add' | 'laundry' | 'reuse', quantity: number = 1, isFixedInventory: boolean = false) => {
    const inventoryType: 'fixed' | 'daily' = isFixedInventory ? 'fixed' : 'daily';

    const existingItem = cart.find(cartItem =>
      cartItem.itemId === item._id && cartItem.action === action
    );

    if (existingItem) {
      if (isFixedInventory) {
        // For Fixed Inventory: Toggle behavior - remove item if already exists
        setCart(cart.filter(cartItem =>
          !(cartItem.itemId === item._id && cartItem.action === action)
        ));
        toast.success(`${action} action removed from cart for ${item.name}`);
      } else {
        // For Daily Inventory: Increment behavior (existing functionality)
        setCart(cart.map(cartItem =>
          cartItem.itemId === item._id && cartItem.action === action
            ? { ...cartItem, quantity: cartItem.quantity + quantity }
            : cartItem
        ));
        toast.success(`${action} action updated in cart for ${item.name}`);
      }
    } else {
      const newCartItem: CartItem = {
        itemId: item._id,
        itemName: item.name,
        category: item.category,
        inventoryType,
        quantity,
        unitPrice: item.unitPrice || 0,
        totalPrice: (item.unitPrice || 0) * quantity,
        action,
        notes: action === 'laundry' ? 'Sent for laundry' :
               action === 'reuse' ? 'Marked for reuse' : ''
      };
      setCart([...cart, newCartItem]);
      toast.success(`${action} action added to cart for ${item.name}`);
    }

    // Add visual feedback — use a per-item timer so multiple items can animate independently
    const itemKey = `${item._id}-${action}`;
    setAddedItems(prev => new Set([...prev, itemKey]));

    const existingTimer = timerMapRef.current.get(itemKey);
    if (existingTimer) clearTimeout(existingTimer);
    const newTimer = setTimeout(() => {
      setAddedItems(prev => {
        const newSet = new Set(prev);
        newSet.delete(itemKey);
        return newSet;
      });
      timerMapRef.current.delete(itemKey);
    }, 2000);
    timerMapRef.current.set(itemKey, newTimer);

  };

  const removeFromCart = (itemId: string, action: string) => {
    setCart(cart.filter(item => !(item.itemId === itemId && item.action === action)));
  };

  const updateCartQuantity = (itemId: string, action: string, rawQuantity: number) => {
    const quantity = Number.isFinite(rawQuantity) && rawQuantity >= 1 ? Math.floor(rawQuantity) : 1;
    setCart(cart.map(item =>
      item.itemId === itemId && item.action === action
        ? { ...item, quantity, totalPrice: item.unitPrice * quantity }
        : item
    ));
  };

  const getCartItemQuantity = (itemId: string, action: string) => {
    const item = cart.find(cartItem => 
      cartItem.itemId === itemId && cartItem.action === action
    );
    return item ? item.quantity : 0;
  };

  const isItemInCart = (itemId: string, action: string) => {
    return cart.some(cartItem =>
      cartItem.itemId === itemId && cartItem.action === action
    );
  };

  // Helper function to determine which actions are appropriate for each category
  const getAvailableActions = (category: string) => {
    const actions = {
      add: true, // All items can be added
      laundry: false,
      reuse: true // All items can be reused
    };

    // Categories that can go to laundry (textiles, linens, etc.)
    const laundryCategories = ['bedroom', 'bathroom'];

    if (laundryCategories.includes(category.toLowerCase())) {
      actions.laundry = true;
    }

    return actions;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800';
      case 'in_progress': return 'bg-blue-100 text-blue-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'overdue': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getLastCheckDate = (lastChecked: string | null) => {
    if (!lastChecked) return 'Never checked';
    const date = new Date(lastChecked);
    const today = new Date();
    // Compare calendar dates (not raw ms difference) to avoid timezone edge cases
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const checkStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const diffMs = todayStart.getTime() - checkStart.getTime();
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays > 1) return `${diffDays} days ago`;
    return 'Recently';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile-First Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10 px-4 py-4 sm:px-6">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-xl sm:text-3xl font-bold text-gray-900 mb-1 sm:mb-2">Daily Routine Check</h1>
          <p className="text-sm sm:text-base text-gray-600">Perform daily inventory checks for all rooms</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-20 sm:pb-6">
        {/* Mobile-Optimized Search and Filter */}
        <div className="mb-4 sm:mb-6 mt-4 sm:mt-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Search rooms..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 h-12 sm:h-10 text-base sm:text-sm"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="px-3 py-3 sm:py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-base sm:text-sm min-w-[120px] touch-manipulation"
              >
                <option value="all">All Rooms</option>
                <option value="pending">Pending</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
                <option value="overdue">Overdue</option>
              </select>
              <Button
                onClick={fetchRooms}
                className="flex items-center gap-2 px-4 py-3 sm:py-2 h-12 sm:h-10 touch-manipulation"
              >
                <RefreshCw className="h-4 w-4" />
                <span className="hidden sm:inline">Refresh</span>
              </Button>
            </div>
          </div>
        </div>

        {/* Mobile-Optimized Cart Summary */}
        {cart.length > 0 && (
          <Card className="mb-4 sm:mb-6">
            <CardHeader>
              <CardTitle className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <span className="flex items-center gap-2">
                  <ShoppingCart className="h-5 w-5 text-blue-600" />
                  Cart ({cart.length} items)
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setShowCart(!showCart)}
                    className="flex-1 sm:flex-none h-10 sm:h-9 touch-manipulation"
                  >
                    {showCart ? 'Hide Details' : 'Show Details'}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setCart([])}
                    className="flex-1 sm:flex-none h-10 sm:h-9 text-red-600 hover:text-red-700 touch-manipulation"
                  >
                    Clear Cart
                  </Button>
                </div>
            </CardTitle>
          </CardHeader>
          {showCart && (
            <CardContent>
              <div className="space-y-3">
                {cart.map((item, index) => (
                  <div key={`cart-${index}-${item.category}`} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{item.itemName}</span>
                        <Badge variant="default" className={
                          item.action === 'replace' ? 'bg-red-100 text-red-800' :
                          item.action === 'add' ? 'bg-blue-100 text-blue-800' :
                          item.action === 'laundry' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-green-100 text-green-800'
                        }>
                          {item.action}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-600">{item.category}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => {
                          const parsed = parseInt(e.target.value, 10);
                          updateCartQuantity(item.itemId, item.action, parsed);
                        }}
                        className="w-20"
                      />
                      <span className="text-sm font-medium">₹{item.totalPrice}</span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => removeFromCart(item.itemId, item.action)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
                <div className="border-t pt-3">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold">Total:</span>
                    <span className="font-bold text-lg">
                      ₹{cart.reduce((sum, item) => sum + item.totalPrice, 0)}
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          )}
        </Card>
      )}

      {/* Rooms Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {rooms
          .filter(room => 
            room.roomNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
            room.type.toLowerCase().includes(searchTerm.toLowerCase())
          )
          .map((room) => (
          <Card key={room._id} className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Home className="h-5 w-5 text-blue-600" />
                  Room {room.roomNumber}
                </span>
                <Badge variant="default" className={getStatusColor(room.checkStatus)}>
                  {room.checkStatus}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div>
                  <p className="text-sm text-gray-600">Type</p>
                  <p className="font-medium">{room.type}</p>
                </div>
                
                <div>
                  <p className="text-sm text-gray-600">Last Check</p>
                  <p className="font-medium">{getLastCheckDate(room.lastChecked)}</p>
                </div>

                <div>
                  <p className="text-sm text-gray-600">Inventory Items</p>
                  <div className="flex gap-2 mt-1">
                    <Badge variant="outline" className="text-xs">
                      Fixed: {room.fixedInventory.length}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      Daily: {room.dailyInventory.length}
                    </Badge>
                  </div>
                </div>

                {(room.checkStatus === 'pending' || room.checkStatus === 'overdue' || room.checkStatus === 'in_progress') && (
                  <Button
                    onClick={() => handleStartCheck(room)}
                    className="w-full"
                  >
                    {room.checkStatus === 'in_progress' ? 'Continue Check' : 'Start Check'}
                  </Button>
                )}

                {room.checkStatus === 'completed' && (
                  <Button
                    variant="outline"
                    onClick={() => handleStartCheck(room)}
                    className="w-full"
                  >
                    Recheck
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Room Details Modal */}
      {selectedRoom && showRoomDetails && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold">Daily Check - Room {selectedRoom.roomNumber}</h2>
                <Button
                  variant="outline"
                  onClick={() => setShowRoomDetails(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {/* Fixed Inventory */}
              <Card className="mb-6">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Package className="h-5 w-5 text-blue-600" />
                    Fixed Inventory
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {selectedRoom.fixedInventory.map((item) => (
                      <div 
                        key={item._id} 
                        className={`border rounded-lg p-4 transition-all duration-300 ${
                          isItemInCart(item._id, 'replace') || isItemInCart(item._id, 'reuse')
                            ? 'ring-2 ring-blue-500 bg-blue-50 shadow-md'
                            : 'hover:shadow-md'
                        } ${
                          addedItems.has(`${item._id}-replace`) || addedItems.has(`${item._id}-reuse`)
                            ? 'animate-pulse'
                            : ''
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium">{item.name}</h4>
                            {(isItemInCart(item._id, 'replace') || isItemInCart(item._id, 'reuse')) && (
                              <Badge variant="default" className="bg-blue-600 text-white text-xs">
                                In Cart
                              </Badge>
                            )}
                          </div>
                          <Badge variant="outline">{item.category}</Badge>
                        </div>
                        <p className="text-sm text-gray-600 mb-3">{item.description}</p>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant={isItemInCart(item._id, 'replace') ? "default" : "outline"}
                            onClick={() => addToCart(item, 'replace', 1, true)}
                            className={`transition-all duration-200 ${
                              isItemInCart(item._id, 'replace')
                                ? 'bg-red-600 hover:bg-red-700 text-white'
                                : 'text-red-600 hover:text-red-700'
                            }`}
                          >
                            {isItemInCart(item._id, 'replace') ? (
                              <span className="flex items-center gap-1">
                                <CheckCircle className="h-4 w-4" />
                              </span>
                            ) : (
                              'Replace'
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant={isItemInCart(item._id, 'reuse') ? "default" : "outline"}
                            onClick={() => addToCart(item, 'reuse', 1, true)}
                            className={`transition-all duration-200 ${
                              isItemInCart(item._id, 'reuse')
                                ? 'bg-green-600 hover:bg-green-700 text-white'
                                : 'text-green-600 hover:text-green-700'
                            }`}
                          >
                            {isItemInCart(item._id, 'reuse') ? (
                              <span className="flex items-center gap-1">
                                <CheckCircle className="h-4 w-4" />
                              </span>
                            ) : (
                              'Reuse'
                            )}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Daily Inventory */}
              <Card className="mb-6">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <RefreshCw className="h-5 w-5 text-green-600" />
                    Daily Inventory
                  </CardTitle>
                </CardHeader>
                                                  <CardContent>
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                     {selectedRoom.dailyInventory.map((item) => (
                       <div 
                         key={item._id} 
                         className={`border rounded-lg p-4 transition-all duration-300 ${
                           isItemInCart(item._id, 'add') || isItemInCart(item._id, 'laundry') || isItemInCart(item._id, 'reuse')
                             ? 'ring-2 ring-green-500 bg-green-50 shadow-md'
                             : 'hover:shadow-md'
                         } ${
                           addedItems.has(`${item._id}-add`) || addedItems.has(`${item._id}-laundry`) || addedItems.has(`${item._id}-reuse`)
                             ? 'animate-pulse'
                             : ''
                         }`}
                       >
                         <div className="flex items-center justify-between mb-2">
                           <div className="flex items-center gap-2">
                             <h4 className="font-medium">{item.name}</h4>
                             {(isItemInCart(item._id, 'add') || isItemInCart(item._id, 'laundry') || isItemInCart(item._id, 'reuse')) && (
                               <Badge variant="default" className="bg-green-600 text-white text-xs">
                                 In Cart
                               </Badge>
                             )}
                           </div>
                           <Badge variant="outline">{item.category}</Badge>
                         </div>
                         <p className="text-sm text-gray-600 mb-3">{item.description}</p>
                         <div className="flex gap-2">
                           {(() => {
                             const availableActions = getAvailableActions(item.category);
                             return (
                               <>
                                 {availableActions.add && (
                                   <Button
                                     size="sm"
                                     variant={isItemInCart(item._id, 'add') ? "default" : "outline"}
                                     onClick={() => addToCart(item, 'add')}
                                     className={`transition-all duration-200 ${
                                       isItemInCart(item._id, 'add')
                                         ? 'bg-blue-600 hover:bg-blue-700 text-white'
                                         : 'text-blue-600 hover:text-blue-700'
                                     }`}
                                   >
                                     {isItemInCart(item._id, 'add') ? (
                                       <span className="flex items-center gap-1">
                                         <CheckCircle className="h-4 w-4" />
                                         {getCartItemQuantity(item._id, 'add')}
                                       </span>
                                     ) : (
                                       'Add'
                                     )}
                                   </Button>
                                 )}
                                 {availableActions.laundry && (
                                   <Button
                                     size="sm"
                                     variant={isItemInCart(item._id, 'laundry') ? "default" : "outline"}
                                     onClick={() => addToCart(item, 'laundry')}
                                     className={`transition-all duration-200 ${
                                       isItemInCart(item._id, 'laundry')
                                         ? 'bg-yellow-600 hover:bg-yellow-700 text-white'
                                         : 'text-yellow-600 hover:text-yellow-700'
                                     }`}
                                   >
                                     {isItemInCart(item._id, 'laundry') ? (
                                       <span className="flex items-center gap-1">
                                         <RotateCcw className="h-4 w-4" />
                                         {getCartItemQuantity(item._id, 'laundry')}
                                       </span>
                                     ) : (
                                       'Laundry'
                                     )}
                                   </Button>
                                 )}
                                 {availableActions.reuse && (
                                   <Button
                                     size="sm"
                                     variant={isItemInCart(item._id, 'reuse') ? "default" : "outline"}
                                     onClick={() => addToCart(item, 'reuse')}
                                     className={`transition-all duration-200 ${
                                       isItemInCart(item._id, 'reuse')
                                         ? 'bg-green-600 hover:bg-green-700 text-white'
                                         : 'text-green-600 hover:text-green-700'
                                     }`}
                                   >
                                     {isItemInCart(item._id, 'reuse') ? (
                                       <span className="flex items-center gap-1">
                                         <CheckCircle className="h-4 w-4" />
                                         {getCartItemQuantity(item._id, 'reuse')}
                                       </span>
                                     ) : (
                                       'Reuse'
                                     )}
                                   </Button>
                                 )}
                               </>
                             );
                           })()}
                         </div>
                       </div>
                     ))}
                   </div>
                 </CardContent>
              </Card>

              {/* Action Buttons */}
              <div className="flex justify-end gap-4">
                <Button
                  variant="outline"
                  onClick={() => setShowRoomDetails(false)}
                  disabled={submitting}
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => handleCompleteCheck(selectedRoom._id)}
                  disabled={submitting}
                >
                  {submitting ? 'Completing...' : 'Complete Check'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}

export default withErrorBoundary(DailyRoutineCheck);
