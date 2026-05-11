import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Plus, Minus, ShoppingCart, CreditCard, Banknote, Home, Coffee, Pizza, Soup, Cake, Loader2 } from 'lucide-react';
import { formatCurrency } from '@/utils/currencyUtils';
import { api } from '../../services/api';

interface MenuItem {
  itemId: string;
  name: string;
  description: string;
  price: number;
  category: string;
  image?: string;
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

interface OrderItem {
  itemId: string;
  name: string;
  price: number;
  quantity: number;
  modifiers: unknown[];
  total: number;
}

interface Customer {
  type: 'guest' | 'walkin';
  guestId?: string;
  roomNumber?: string;
  name?: string;
  phone?: string;
}

const POSOrderEntry: React.FC = () => {
  const [outlets, setOutlets] = useState<unknown[]>([]);
  const [selectedOutlet, setSelectedOutlet] = useState<string>('');
  const [menus, setMenus] = useState<unknown[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [filteredItems, setFilteredItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [customer, setCustomer] = useState<Customer>({ type: 'walkin' });
  const [orderType, setOrderType] = useState<string>('dine_in');
  const [tableNumber, setTableNumber] = useState<string>('');
  
  const [subtotal, setSubtotal] = useState<number>(0);
  const [tax, setTax] = useState<number>(0);
  const [total, setTotal] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchOutlets();
  }, []);

  useEffect(() => {
    if (selectedOutlet) {
      fetchMenus();
    }
  }, [selectedOutlet]);

  useEffect(() => {
    filterItems();
  }, [menuItems, selectedCategory, searchTerm]);

  useEffect(() => {
    calculateTotals();
  }, [orderItems, selectedOutlet]);

  const fetchOutlets = async () => {
    try {
      setIsLoading(true);
      const response = await api.get('/pos/outlets');
      if (response.data.success) {
        setOutlets(response.data.data);
      }
    } catch {
      // Error handled silently
    } finally {
      setIsLoading(false);
    }
  };

  const fetchMenus = async () => {
    try {
      const response = await api.get(`/pos/menus/outlet/${selectedOutlet}`);
      if (response.data.success) {
        setMenus(response.data.data);
        
        // Combine all menu items
        const allItems: MenuItem[] = [];
        const allCategories = new Set<string>();
        
        response.data.data.forEach((menu: Record<string, unknown>) => {
          menu.items.forEach((item: MenuItem) => {
            allItems.push(item);
            allCategories.add(item.category);
          });
        });
        
        setMenuItems(allItems);
        setCategories(Array.from(allCategories));
      }
    } catch {
      // Error handled silently
    }
  };

  const filterItems = () => {
    let filtered = menuItems;
    
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(item => item.category === selectedCategory);
    }
    
    if (searchTerm) {
      filtered = filtered.filter(item =>
        item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.description?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    setFilteredItems(filtered);
  };

  const addToOrder = (item: MenuItem) => {
    const existingItemIndex = orderItems.findIndex(
      orderItem => orderItem.itemId === item.itemId
    );
    
    if (existingItemIndex > -1) {
      const updatedItems = [...orderItems];
      updatedItems[existingItemIndex].quantity += 1;
      updatedItems[existingItemIndex].total = 
        updatedItems[existingItemIndex].price * updatedItems[existingItemIndex].quantity;
      setOrderItems(updatedItems);
    } else {
      const newOrderItem: OrderItem = {
        itemId: item.itemId,
        name: item.name,
        price: item.price,
        quantity: 1,
        modifiers: [],
        total: item.price
      };
      setOrderItems([...orderItems, newOrderItem]);
    }
  };

  const updateQuantity = (itemId: string, change: number) => {
    const updatedItems = orderItems.map(item => {
      if (item.itemId === itemId) {
        const newQuantity = Math.max(0, item.quantity + change);
        return {
          ...item,
          quantity: newQuantity,
          total: item.price * newQuantity
        };
      }
      return item;
    }).filter(item => item.quantity > 0);
    
    setOrderItems(updatedItems);
  };

  const calculateTotals = async () => {
    if (orderItems.length === 0) {
      setSubtotal(0);
      setTax(0);
      setTotal(0);
      return;
    }

    try {
      // Use backend API to calculate totals with proper tax rates
      const response = await api.post('/pos/calculate/order-totals', {
        items: orderItems,
        outletId: selectedOutlet,
        discounts: []
      });

      if (response.data.success) {
        const { subtotal, taxes, grandTotal } = response.data.data;
        setSubtotal(subtotal);
        setTax(taxes.totalTax);
        setTotal(grandTotal);
      }
    } catch (error) {
      // Fallback to simple calculation if API fails
      const newSubtotal = orderItems.reduce((sum, item) => sum + item.total, 0);
      const newTax = newSubtotal * 0.18;
      const newTotal = newSubtotal + newTax;
      setSubtotal(newSubtotal);
      setTax(newTax);
      setTotal(newTotal);
    }
  };

  const getSelectedOutletName = () => {
    const outlet = outlets.find(o => o._id === selectedOutlet);
    return outlet ? outlet.name : 'Select Outlet';
  };

  const getCategoryIcon = (category: string) => {
    const icons = {
      beverages: Coffee,
      appetizers: Pizza,
      'main course': Soup,
      desserts: Cake,
    };
    const IconComponent = icons[category.toLowerCase() as keyof typeof icons] || Pizza;
    return <IconComponent className="w-12 h-12 text-gray-400" />;
  };

  const processOrder = async (paymentMethod: string) => {
    if (!selectedOutlet || orderItems.length === 0) {
      alert('Please select outlet and add items to order');
      return;
    }

    try {
      const orderData = {
        outlet: selectedOutlet,
        type: orderType,
        customer,
        items: orderItems,
        subtotal,
        taxes: {
          gst: tax,
          totalTax: tax
        },
        totalAmount: total,
        payment: {
          method: paymentMethod,
          status: 'paid'
        },
        tableNumber
      };

      const response = await api.post('/pos/orders', orderData);
      
      if (response.data.success) {
        alert('Order created successfully!');
        // Reset form
        setOrderItems([]);
        setCustomer({ type: 'walkin' });
        setTableNumber('');
      } else {
        alert('Error creating order: ' + response.data.message);
      }
    } catch (error) {
      alert('Error processing order');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        <span className="ml-2 text-gray-600">Loading POS...</span>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Left Panel - Menu Items */}
      <div className="flex-1 p-4 overflow-y-auto">
        <div className="mb-4 space-y-4">
          <div className="relative">
            <Select value={selectedOutlet} onValueChange={setSelectedOutlet}>
              <SelectTrigger>
                <span className="block truncate">
                  {selectedOutlet ? getSelectedOutletName() : "Select Outlet"}
                </span>
              </SelectTrigger>
              <SelectContent>
                {outlets.map((outlet) => (
                  <SelectItem key={outlet._id} value={outlet._id}>
                    {outlet.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Input
            placeholder="Search items..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />

          <div className="flex space-x-2">
            <Button
              variant={selectedCategory === 'all' ? 'default' : 'outline'}
              onClick={() => setSelectedCategory('all')}
            >
              All
            </Button>
            {categories.map((category) => (
              <Button
                key={category}
                variant={selectedCategory === category ? 'default' : 'outline'}
                onClick={() => setSelectedCategory(category)}
              >
                {category}
              </Button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredItems.map((item) => (
            <Card key={item.itemId} className="cursor-pointer hover:shadow-lg transition-shadow">
              <CardContent className="p-4" onClick={() => addToOrder(item)}>
                <div className="aspect-square bg-gray-100 rounded-lg mb-3 flex items-center justify-center">
                  {getCategoryIcon(item.category)}
                </div>
                <h3 className="font-semibold text-sm mb-1">{item.name}</h3>
                <p className="text-xs text-gray-600 mb-2">{item.description}</p>
                <p className="font-bold text-green-600">{formatCurrency(item.price)}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Right Panel - Order Summary */}
      <div className="w-96 bg-white border-l p-4 flex flex-col">
        <div className="mb-4">
          <h2 className="text-xl font-bold mb-4">Order Summary</h2>
          
          {/* Customer Info */}
          <div className="space-y-3 mb-4">
            <div>
              <Label>Order Type</Label>
              <Select value={orderType} onValueChange={setOrderType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="dine_in">Dine In</SelectItem>
                  <SelectItem value="takeaway">Takeaway</SelectItem>
                  <SelectItem value="room_service">Room Service</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {orderType === 'dine_in' && (
              <div>
                <Label>Table Number</Label>
                <Input
                  value={tableNumber}
                  onChange={(e) => setTableNumber(e.target.value)}
                  placeholder="Enter table number"
                />
              </div>
            )}

            <div>
              <Label>Customer Type</Label>
              <Select value={customer.type} onValueChange={(value) => setCustomer({ ...customer, type: value as 'guest' | 'walkin' })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="walkin">Walk-in</SelectItem>
                  <SelectItem value="guest">Hotel Guest</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {customer.type === 'guest' && (
              <div>
                <Label>Room Number</Label>
                <Input
                  value={customer.roomNumber || ''}
                  onChange={(e) => setCustomer({ ...customer, roomNumber: e.target.value })}
                  placeholder="Enter room number"
                />
              </div>
            )}
          </div>
        </div>

        <Separator className="mb-4" />

        {/* Order Items */}
        <div className="flex-1 overflow-y-auto">
          {orderItems.length === 0 ? (
            <p className="text-gray-500 text-center">No items added</p>
          ) : (
            <div className="space-y-3">
              {orderItems.map((item) => (
                <div key={item.itemId} className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="font-medium text-sm">{item.name}</p>
                    <p className="text-xs text-gray-500">{formatCurrency(item.price)} each</p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => updateQuantity(item.itemId, -1)}
                    >
                      <Minus className="w-3 h-3" />
                    </Button>
                    <span className="w-8 text-center">{item.quantity}</span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => updateQuantity(item.itemId, 1)}
                    >
                      <Plus className="w-3 h-3" />
                    </Button>
                  </div>
                  <div className="w-16 text-right">
                    <p className="font-medium text-sm">{formatCurrency(item.total)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Order Totals */}
        {orderItems.length > 0 && (
          <div className="mt-4 space-y-2">
            <Separator />
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span>{formatCurrency(subtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span>Tax (18%)</span>
              <span>{formatCurrency(tax)}</span>
            </div>
            <div className="flex justify-between font-bold text-lg">
              <span>Total</span>
              <span>{formatCurrency(total)}</span>
            </div>
            
            {/* Payment Buttons */}
            <div className="space-y-2 mt-4">
              <Button
                className="w-full"
                onClick={() => processOrder('cash')}
              >
                <Banknote className="w-4 h-4 mr-2" />
                Pay Cash
              </Button>
              <Button
                className="w-full"
                variant="outline"
                onClick={() => processOrder('card')}
              >
                <CreditCard className="w-4 h-4 mr-2" />
                Pay Card
              </Button>
              <Button
                className="w-full"
                variant="outline"
                onClick={() => processOrder('room_charge')}
              >
                <Home className="w-4 h-4 mr-2" />
                Room Charge
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default POSOrderEntry;