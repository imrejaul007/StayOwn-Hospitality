import React, { useState, useEffect } from 'react';
import {
  Package,
  CoffeeIcon,
  Utensils,
  ShoppingCart,
  IndianRupee,
  Clock,
  CheckCircle,
  AlertTriangle,
  Bell,
  Star,
  Receipt,
  Plus,
  Minus,
  Loader2
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LoadingSpinner } from '../LoadingSpinner';
import { formatCurrency } from '../../utils/formatters';
import { api } from '../../services/api';
import toast from 'react-hot-toast';

interface EnhancedRoomServiceWidgetProps {
  bookingId?: string;
  roomId?: string;
  guestId?: string;
  onRequestService?: (serviceType: string, items: unknown[], posOrder?: unknown) => void;
}

interface MenuItem {
  itemId: string;
  name: string;
  description?: string;
  price: number;
  category: string;
  image?: string;
  isAvailable: boolean;
  modifiers?: Modifier[];
}

interface Modifier {
  name: string;
  options: ModifierOption[];
}

interface ModifierOption {
  name: string;
  price: number;
}

interface POSOutlet {
  _id: string;
  name: string;
  type: string;
  isActive: boolean;
}

interface MenuCategory {
  category: string;
  items: MenuItem[];
  icon: React.ReactNode;
}

interface CartItem {
  itemId: string;
  name: string;
  price: number;
  quantity: number;
  modifiers: unknown[];
  total: number;
}

const categoryIcons = {
  'appetizers': <Utensils className="w-5 h-5" />,
  'main_course': <CoffeeIcon className="w-5 h-5" />,
  'desserts': <Star className="w-5 h-5" />,
  'beverages': <Package className="w-5 h-5" />,
  'drinks': <Package className="w-5 h-5" />,
  'starters': <Utensils className="w-5 h-5" />,
  'default': <Utensils className="w-5 h-5" />
};

export function EnhancedRoomServiceWidget({
  bookingId,
  roomId,
  guestId,
  onRequestService
}: EnhancedRoomServiceWidgetProps) {
  const [loading, setLoading] = useState(true);
  const [outlets, setOutlets] = useState<POSOutlet[]>([]);
  const [selectedOutlet, setSelectedOutlet] = useState<string>('');
  const [menus, setMenus] = useState<unknown[]>([]);
  const [menuCategories, setMenuCategories] = useState<MenuCategory[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [orderHistory, setOrderHistory] = useState<unknown[]>([]);

  useEffect(() => {
    fetchRoomServiceData();
  }, [bookingId, roomId, guestId]);

  useEffect(() => {
    if (selectedOutlet) {
      fetchMenus();
    }
  }, [selectedOutlet]);

  const fetchRoomServiceData = async () => {
    try {
      setLoading(true);

      // Fetch POS outlets
      await fetchOutlets();

      // Fetch guest's order history
      await fetchOrderHistory();

    } catch {
      // Error handled silently
    } finally {
      setLoading(false);
    }
  };

  const fetchOutlets = async () => {
    try {
      const response = await api.get('/pos/outlets');
      if (response.data.success) {
        const availableOutlets = response.data.data.filter(
          (outlet: POSOutlet) => outlet.isActive &&
          (outlet.type === 'room_service' || outlet.type === 'restaurant')
        );
        setOutlets(availableOutlets);

        // Auto-select room service outlet if available
        const roomServiceOutlet = availableOutlets.find(outlet => outlet.type === 'room_service');
        if (roomServiceOutlet) {
          setSelectedOutlet(roomServiceOutlet._id);
        } else if (availableOutlets.length > 0) {
          setSelectedOutlet(availableOutlets[0]._id);
        }
      }
    } catch {
      // Error handled silently
    }
  };

  const fetchMenus = async () => {
    try {
      const response = await api.get(`/pos/menus/outlet/${selectedOutlet}`);
      if (response.data.success) {
        setMenus(response.data.data);

        // Process menus into categories
        const categories = processMenusIntoCategories(response.data.data);
        setMenuCategories(categories);
      }
    } catch {
      // Show empty state when menu cannot be loaded
      setMenuCategories([]);
    }
  };

  const fetchOrderHistory = async () => {
    try {
      if (!guestId) return;

      // Fetch recent guest service requests
      const response = await api.get('/guest-services?limit=5');
      if (response.data.status === 'success') {
        const foodOrders = response.data.data.serviceRequests.filter(
          (request: Record<string, unknown>) => request.serviceType === 'room_service' && request.items?.length > 0
        );
        setOrderHistory(foodOrders);
      }
    } catch {
      // Error handled silently
    }
  };

  const processMenusIntoCategories = (menus: unknown[]): MenuCategory[] => {
    const categoryMap = new Map<string, MenuItem[]>();

    menus.forEach(menu => {
      menu.items?.forEach((item: Record<string, unknown>) => {
        const category = item.category || 'other';
        if (!categoryMap.has(category)) {
          categoryMap.set(category, []);
        }

        categoryMap.get(category)?.push({
          itemId: item.itemId,
          name: item.name,
          description: item.description,
          price: item.price,
          category: category,
          image: item.image,
          isAvailable: item.isAvailable !== false,
          modifiers: item.modifiers || []
        });
      });
    });

    return Array.from(categoryMap.entries()).map(([category, items]) => ({
      category,
      items,
      icon: categoryIcons[category as keyof typeof categoryIcons] || categoryIcons.default
    }));
  };

  const addToCart = (item: MenuItem) => {
    setCart(prev => {
      const existing = prev.find(cartItem => cartItem.itemId === item.itemId);
      if (existing) {
        return prev.map(cartItem =>
          cartItem.itemId === item.itemId
            ? { ...cartItem, quantity: cartItem.quantity + 1, total: (cartItem.quantity + 1) * cartItem.price }
            : cartItem
        );
      } else {
        return [...prev, {
          itemId: item.itemId,
          name: item.name,
          price: item.price,
          quantity: 1,
          modifiers: [],
          total: item.price
        }];
      }
    });
  };

  const removeFromCart = (itemId: string) => {
    setCart(prev => {
      const existing = prev.find(item => item.itemId === itemId);
      if (existing && existing.quantity > 1) {
        return prev.map(item =>
          item.itemId === itemId
            ? { ...item, quantity: item.quantity - 1, total: (item.quantity - 1) * item.price }
            : item
        );
      } else {
        return prev.filter(item => item.itemId !== itemId);
      }
    });
  };

  const getCartTotal = () => {
    return cart.reduce((total, item) => total + item.total, 0);
  };

  const getCartItemCount = () => {
    return cart.reduce((total, item) => total + item.quantity, 0);
  };

  const submitOrder = async () => {
    if (cart.length === 0 || !bookingId) return;

    try {
      setSubmitting(true);

      // Prepare service request data
      const serviceRequestData = {
        bookingId,
        serviceType: 'room_service',
        serviceVariation: 'food_order',
        title: 'Room Service Food Order',
        description: `Food order for ${cart.length} items`,
        priority: 'now',
        items: cart.map(item => ({
          itemId: item.itemId,
          name: item.name,
          price: item.price,
          quantity: item.quantity
        })),
        specialInstructions: `Room service delivery. Total items: ${getCartItemCount()}. Total amount: ${formatCurrency(getCartTotal())}`
      };

      // Create service request (which will auto-create POS order)
      const response = await api.post('/guest-services', serviceRequestData);

      if (response.data.status === 'success') {
        const { serviceRequest, posOrder } = response.data.data;


        // Clear cart
        setCart([]);

        // Refresh order history
        await fetchOrderHistory();

        // Call parent callback
        if (onRequestService) {
          onRequestService('room_service', cart, posOrder);
        }

        toast.success(`Order submitted successfully! ${posOrder ? `POS Order #${posOrder.orderNumber}` : 'Service Request created'}`);
      }
    } catch {
      toast.error('Failed to submit order. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-center h-40">
          <LoadingSpinner />
        </div>
      </Card>
    );
  }

  const filteredCategories = selectedCategory === 'all'
    ? menuCategories
    : menuCategories.filter(cat => cat.category === selectedCategory);

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Room Service Menu</h2>
            <p className="text-gray-600">Order delicious food directly to your room</p>
          </div>
          {getCartItemCount() > 0 && (
            <div className="flex items-center space-x-3">
              <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                {getCartItemCount()} items • {formatCurrency(getCartTotal())}
              </Badge>
              <Button
                onClick={submitOrder}
                disabled={submitting}
                className="bg-green-600 hover:bg-green-700"
              >
                {submitting ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <ShoppingCart className="w-4 h-4 mr-2" />
                )}
                {submitting ? 'Ordering...' : 'Place Order'}
              </Button>
            </div>
          )}
        </div>

        {/* Outlet Selection */}
        {outlets.length > 1 && (
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">Select Restaurant</label>
            <select
              value={selectedOutlet}
              onChange={(e) => setSelectedOutlet(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-md"
            >
              {outlets.map(outlet => (
                <option key={outlet._id} value={outlet._id}>
                  {outlet.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Category Filter */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              selectedCategory === 'all'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            All Categories
          </button>
          {menuCategories.map(category => (
            <button aria-label={`Filter by ${category.category.replace('_', ' ')} category`}
              key={category.category}
              onClick={() => setSelectedCategory(category.category)}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center ${
                selectedCategory === category.category
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {category.icon}
              <span className="ml-2 capitalize">{category.category.replace('_', ' ')}</span>
            </button>
          ))}
        </div>
      </Card>

      {/* Menu Items */}
      {filteredCategories.map(category => (
        <Card key={category.category} className="p-6">
          <div className="flex items-center space-x-2 mb-4">
            {category.icon}
            <h3 className="text-lg font-semibold text-gray-900 capitalize">
              {category.category.replace('_', ' ')}
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {category.items.map(item => {
              const cartItem = cart.find(c => c.itemId === item.itemId);
              const cartQuantity = cartItem?.quantity || 0;

              return (
                <Card key={item.itemId} className="p-4 border-2 hover:border-blue-300 transition-colors">
                  <div className="flex flex-col h-full">
                    <div className="flex-1">
                      <h4 className="font-semibold text-gray-900 mb-1">{item.name}</h4>
                      {item.description && (
                        <p className="text-sm text-gray-600 mb-2">{item.description}</p>
                      )}
                      <p className="text-lg font-bold text-gray-900 mb-3">
                        {formatCurrency(item.price)}
                      </p>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        {cartQuantity > 0 ? (
                          <>
                            <Button
                              onClick={() => removeFromCart(item.itemId)}
                              size="sm"
                              variant="secondary"
                            >
                              <Minus className="w-4 h-4" />
                            </Button>
                            <span className="w-8 text-center font-medium">{cartQuantity}</span>
                            <Button
                              onClick={() => addToCart(item)}
                              size="sm"
                              variant="secondary"
                            >
                              <Plus className="w-4 h-4" />
                            </Button>
                          </>
                        ) : (
                          <Button
                            onClick={() => addToCart(item)}
                            size="sm"
                            disabled={!item.isAvailable}
                          >
                            {item.isAvailable ? 'Add to Cart' : 'Unavailable'}
                          </Button>
                        )}
                      </div>

                      {!item.isAvailable && (
                        <Badge variant="secondary" className="bg-red-100 text-red-800">
                          Out of Stock
                        </Badge>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </Card>
      ))}

      {/* Order History */}
      {orderHistory.length > 0 && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Orders</h3>
          <div className="space-y-3">
            {orderHistory.map((order, index) => (
              <div key={`orderHistory-${index}-${order.title}`} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <p className="font-medium text-gray-900">{order.title}</p>
                  <p className="text-sm text-gray-600">
                    {order.items?.length} items • {new Date(order.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <Badge variant="secondary" className={
                  order.status === 'completed' ? 'bg-green-100 text-green-800' :
                  order.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                  'bg-yellow-100 text-yellow-800'
                }>
                  {order.status}
                </Badge>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Empty State */}
      {menuCategories.length === 0 && (
        <Card className="p-6">
          <div className="text-center py-8">
            <Utensils className="mx-auto h-8 w-8 text-gray-400 mb-3" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Menu Not Available</h3>
            <p className="text-gray-600">The room service menu is currently being updated. Please try again later.</p>
          </div>
        </Card>
      )}
    </div>
  );
}