import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import {
  Package,
  CoffeeIcon,
  Tv,
  Bath,
  ShoppingCart,
  IndianRupee,
  Clock,
  CheckCircle,
  AlertTriangle,
  Bell,
  Star,
  Receipt
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LoadingSpinner } from '../LoadingSpinner';
import { roomInventoryService } from '../../services/roomInventoryService';
import { formatCurrency } from '../../utils/formatters';

interface InventoryChargeItem {
  name?: string;
  status?: string;
  cost?: number;
}

interface InventoryCharge {
  date?: string;
  items?: InventoryChargeItem[];
}

interface RoomServiceWidgetProps {
  bookingId?: string;
  roomId?: string;
  guestId?: string;
  onRequestService?: (serviceType: string, items: unknown[]) => void;
}

interface RoomServiceSummary {
  availableServices: Array<{
    category: string;
    icon: React.ReactNode;
    name: string;
    description: string;
    items: Array<{
      id: string;
      name: string;
      price: number;
      isComplimentary: boolean;
      maxComplimentary: number;
      inStock: boolean;
      description?: string;
    }>;
  }>;
  currentCharges: Array<{
    itemName: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    isCharged: boolean;
    date: string;
  }>;
  inventoryCharges: Array<{
    itemName: string;
    reason: string;
    cost: number;
    date: string;
  }>;
  totalCharges: number;
  currency?: string;
  roomCondition: {
    score: number;
    status: string;
    lastInspection: string;
  };
  complimentaryUsage: Array<{
    itemName: string;
    used: number;
    allowed: number;
    remaining: number;
  }>;
}

const serviceCategoryIcons = {
  'minibar': <CoffeeIcon className="w-5 h-5" />,
  'toiletries': <Bath className="w-5 h-5" />,
  'bedding': <Package className="w-5 h-5" />,
  'electronics': <Tv className="w-5 h-5" />,
  'amenities': <Star className="w-5 h-5" />,
  'cleaning': <Package className="w-5 h-5" />
};

export function RoomServiceWidget({
  bookingId,
  roomId,
  guestId,
  onRequestService
}: RoomServiceWidgetProps) {
  const navigate = useNavigate();
  const [summary, setSummary] = useState<RoomServiceSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [cart, setCart] = useState<Array<{ id: string; quantity: number }>>([]);

  useEffect(() => {
    if (roomId || bookingId) {
      fetchRoomServices();
    }
  }, [roomId, bookingId]);

  const fetchRoomServices = async () => {
    try {
      setLoading(true);
      
      // Fetch real inventory charges if guest ID is available
      let inventoryCharges = [];
      let roomInventoryData = null;
      
      if (guestId) {
        try {
          // Fetch inventory charges for the guest
          const params: Record<string, unknown> = {};
          if (bookingId) params.bookingId = bookingId;
          const { data } = await api.get(`/daily-inventory-checks/guest-charges/${guestId}`, { params });
          const charges = Array.isArray(data?.data?.charges) ? data.data.charges : [];
          inventoryCharges = charges.flatMap((charge: Record<string, unknown>) => {
            const items = Array.isArray(charge.items) ? charge.items : [];
            return items.map((item: Record<string, unknown>) => ({
              itemName: (item as InventoryChargeItem).name || 'Unknown',
              reason: (item as InventoryChargeItem).status || 'damage',
              cost: Number((item as InventoryChargeItem).cost) || 0,
              date: (charge as InventoryCharge).date || ''
            }));
          });
        } catch (error) {
          console.error('Failed to fetch guest inventory charges:', error);
        }
      }

      if (roomId) {
        try {
          // Fetch room inventory data
          const inventoryResponse = await roomInventoryService.getRoomInventory(roomId);
          roomInventoryData = inventoryResponse.data.roomInventory;
        } catch (error) {
          console.error('Failed to fetch room inventory data:', error);
        }
      }

      // Build services from room inventory data, or show empty if no data available
      const availableServices: RoomServiceSummary['availableServices'] = [];

      if (roomInventoryData?.items && Array.isArray(roomInventoryData.items)) {
        // Group items by category from real inventory data
        const categoryMap = new Map<string, RoomServiceSummary['availableServices'][0]>();
        for (const item of roomInventoryData.items) {
          const category = item.itemId?.category || 'other';
          if (!categoryMap.has(category)) {
            const iconKey = category as keyof typeof serviceCategoryIcons;
            categoryMap.set(category, {
              category,
              icon: serviceCategoryIcons[iconKey] || serviceCategoryIcons.amenities,
              name: category.charAt(0).toUpperCase() + category.slice(1),
              description: `${category.charAt(0).toUpperCase() + category.slice(1)} items`,
              items: []
            });
          }
          categoryMap.get(category)!.items.push({
            id: item.itemId?._id || item._id,
            name: item.itemId?.name || 'Unknown Item',
            price: item.itemId?.unitPrice || 0,
            isComplimentary: item.itemId?.isComplimentary || false,
            maxComplimentary: item.itemId?.maxComplimentary || 0,
            inStock: (item.currentQuantity || 0) > 0,
            description: item.itemId?.description
          });
        }
        availableServices.push(...categoryMap.values());
      }

      const complimentaryUsage = roomInventoryData?.items
        ?.filter((item: Record<string, unknown>) => (item.itemId as Record<string, unknown>)?.isComplimentary)
        .map((item: Record<string, unknown>) => ({
          itemName: (item.itemId as Record<string, unknown>)?.name as string || 'Unknown',
          used: ((item.itemId as Record<string, unknown>)?.maxComplimentary as number || 0) - ((item.currentQuantity as number) || 0),
          allowed: (item.itemId as Record<string, unknown>)?.maxComplimentary as number || 0,
          remaining: (item.currentQuantity as number) || 0
        })) || [];

      const summaryData: RoomServiceSummary = {
        availableServices,
        currentCharges: [],
        inventoryCharges: inventoryCharges,
        totalCharges: inventoryCharges.reduce((sum: number, charge: { cost: number }) => sum + charge.cost, 0),
        roomCondition: {
          score: roomInventoryData?.conditionScore || 0,
          status: roomInventoryData?.status || 'unknown',
          lastInspection: roomInventoryData?.lastInspectionDate || ''
        },
        complimentaryUsage
      };

      setSummary(summaryData);
    } catch (error) {
      console.error('Failed to fetch room services:', error);
      setSummary(null);
    } finally {
      setLoading(false);
    }
  };

  const addToCart = (itemId: string) => {
    setCart(prev => {
      const existing = prev.find(item => item.id === itemId);
      if (existing) {
        return prev.map(item =>
          item.id === itemId
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      } else {
        return [...prev, { id: itemId, quantity: 1 }];
      }
    });
  };

  const removeFromCart = (itemId: string) => {
    setCart(prev => {
      const existing = prev.find(item => item.id === itemId);
      if (existing && existing.quantity > 1) {
        return prev.map(item =>
          item.id === itemId
            ? { ...item, quantity: item.quantity - 1 }
            : item
        );
      } else {
        return prev.filter(item => item.id !== itemId);
      }
    });
  };

  const getCartTotal = () => {
    if (!summary) return 0;
    
    return cart.reduce((total, cartItem) => {
      const item = summary.availableServices
        .flatMap(service => service.items)
        .find(item => item.id === cartItem.id);
      return total + (item ? item.price * cartItem.quantity : 0);
    }, 0);
  };

  const getCartItemCount = () => {
    return cart.reduce((total, item) => total + item.quantity, 0);
  };

  const requestService = async () => {
    if (cart.length === 0 || !summary) return;

    const requestItems = cart.map(cartItem => {
      const item = summary.availableServices
        .flatMap(service => service.items)
        .find(item => item.id === cartItem.id);
      return {
        itemId: cartItem.id,
        itemName: item?.name || '',
        name: item?.name || '',
        quantity: cartItem.quantity,
        unitPrice: item?.price || 0,
        price: item?.price || 0,
        totalPrice: (item?.price || 0) * cartItem.quantity,
        isComplimentary: item?.isComplimentary || false
      };
    });

    try {
      // Submit service request to backend
      if (bookingId) {
        const { guestServiceService } = await import('../../services/guestService');
        await guestServiceService.createServiceRequest({
          bookingId,
          serviceType: 'room_service',
          serviceVariations: requestItems.map(item => item.name),
          items: requestItems.map(item => ({
            name: item.name,
            quantity: item.quantity,
            price: item.price
          })),
          priority: 'now',
          specialInstructions: ''
        });
      }
      // else: bookingId not available — API call skipped
      // TODO: If bookingId is missing, consider deriving it from booking context

      onRequestService?.('room_service', requestItems);
      setCart([]);
    } catch (error) {
      console.error('Failed to submit room service request:', error);
      // Still clear cart and notify parent on failure so UI stays responsive
      onRequestService?.('room_service', requestItems);
      setCart([]);
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

  if (!summary) {
    return (
      <Card className="p-6">
        <div className="text-center py-8">
          <Package className="mx-auto h-8 w-8 text-gray-400 mb-3" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Room Services Unavailable</h3>
          <p className="text-gray-600">Services will be available once you're checked in.</p>
        </div>
      </Card>
    );
  }

  const filteredServices = selectedCategory === 'all' 
    ? summary.availableServices 
    : summary.availableServices.filter(service => service.category === selectedCategory);

  return (
    <div className="space-y-6">
      {/* Room Condition Status */}
      {summary.roomCondition.score > 0 && (
      <Card className={`p-4 ${summary.roomCondition.score >= 70 ? 'bg-green-50 border-green-200' : summary.roomCondition.score >= 40 ? 'bg-yellow-50 border-yellow-200' : 'bg-red-50 border-red-200'}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <CheckCircle className={`w-5 h-5 mr-2 ${summary.roomCondition.score >= 70 ? 'text-green-600' : summary.roomCondition.score >= 40 ? 'text-yellow-600' : 'text-red-600'}`} />
            <div>
              <h3 className={`font-semibold ${summary.roomCondition.score >= 70 ? 'text-green-900' : summary.roomCondition.score >= 40 ? 'text-yellow-900' : 'text-red-900'}`}>
                Room Status: {summary.roomCondition.score >= 80 ? 'Excellent' : summary.roomCondition.score >= 60 ? 'Good' : summary.roomCondition.score >= 40 ? 'Fair' : 'Needs Attention'}
              </h3>
              <p className={`text-sm ${summary.roomCondition.score >= 70 ? 'text-green-700' : summary.roomCondition.score >= 40 ? 'text-yellow-700' : 'text-red-700'}`}>
                Room condition score: {summary.roomCondition.score}/100
              </p>
            </div>
          </div>
          <Badge variant="secondary" className={summary.roomCondition.score >= 70 ? 'bg-green-100 text-green-800' : summary.roomCondition.score >= 40 ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'}>
            {summary.roomCondition.status}
          </Badge>
        </div>
      </Card>
      )}

      {/* Current Charges Summary */}
      {summary.totalCharges > 0 && (
        <div className="space-y-4">
          {/* Room Service Charges */}
          {summary.currentCharges && summary.currentCharges.length > 0 && (
            <Card className="p-4 bg-blue-50 border-blue-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <IndianRupee className="w-5 h-5 text-blue-600 mr-2" />
                  <div>
                    <h3 className="font-semibold text-blue-900">Room Service Charges</h3>
                    <p className="text-sm text-blue-700">
                      {formatCurrency(summary.currentCharges.reduce((sum, charge) => sum + charge.totalPrice, 0))}
                    </p>
                  </div>
                </div>
                <Button
                  onClick={() => navigate('/app/billing')}
                  size="sm"
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  View Details
                </Button>
              </div>
            </Card>
          )}

          {/* Inventory Charges */}
          {summary.inventoryCharges && summary.inventoryCharges.length > 0 && (
            <Card className="p-4 bg-orange-50 border-orange-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <AlertTriangle className="w-5 h-5 text-orange-600 mr-2" />
                  <div>
                    <h3 className="font-semibold text-orange-900">Inventory Charges</h3>
                    <p className="text-sm text-orange-700">
                      Charges from damaged/missing items: {formatCurrency(summary.inventoryCharges.reduce((sum, charge) => sum + charge.cost, 0))}
                    </p>
                    <div className="mt-2 space-y-1">
                      {summary.inventoryCharges.map((charge, index) => (
                        <div key={`summary-inventoryCharges-${index}`} className="text-xs text-orange-600">
                          • {charge.itemName} - {charge.reason.replace('_', ' ')} ({formatCurrency(charge.cost)})
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                <Button
                  onClick={() => navigate('/app/billing')}
                  size="sm"
                  className="bg-orange-600 hover:bg-orange-700"
                >
                  View Details
                </Button>
              </div>
            </Card>
          )}

          {/* Total Summary */}
          <Card className="p-4 bg-gray-50 border-gray-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <Receipt className="w-5 h-5 text-gray-600 mr-2" />
                <div>
                  <h3 className="font-semibold text-gray-900">Total Additional Charges</h3>
                  <p className="text-sm text-gray-700">
                    Total amount to be added to your bill
                  </p>
                </div>
              </div>
              <div className="text-right">
                                  <p className="text-2xl font-bold text-gray-900">{formatCurrency(summary.totalCharges)}</p>
                  <p className="text-xs text-gray-500">{summary?.currency || 'INR'}</p>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Service Categories */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Room Services</h2>
            <p className="text-gray-600">Request additional amenities and services</p>
          </div>
          {getCartItemCount() > 0 && (
            <div className="flex items-center space-x-3">
              <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                {getCartItemCount()} items • {formatCurrency(getCartTotal())}
              </Badge>
              <Button
                onClick={requestService}
                size="sm"
                className="bg-green-600 hover:bg-green-700"
              >
                <ShoppingCart className="w-4 h-4 mr-1" />
                Request Service
              </Button>
            </div>
          )}
        </div>

        {/* Category Filter */}
        <div className="flex flex-wrap gap-2 mb-6">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              selectedCategory === 'all'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            All Services
          </button>
          {summary.availableServices.map(service => (
            <button
              aria-label={`Filter by ${service.name}`}
              key={service.category}
              onClick={() => setSelectedCategory(service.category)}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center ${
                selectedCategory === service.category
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {service.icon}
              <span className="ml-2 capitalize">{service.name}</span>
            </button>
          ))}
        </div>

        {/* Service Items */}
        <div className="space-y-6">
          {filteredServices.length === 0 && (
            <div className="text-center py-8">
              <Package className="mx-auto h-8 w-8 text-gray-400 mb-3" />
              <p className="text-gray-500">No services available in this category</p>
            </div>
          )}
          {filteredServices.map(service => (
            <div key={service.category} className="space-y-4">
              <div className="flex items-center space-x-2">
                {service.icon}
                <h3 className="text-lg font-semibold text-gray-900">{service.name}</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {service.items.map(item => {
                  const cartItem = cart.find(c => c.id === item.id);
                  const cartQuantity = cartItem?.quantity || 0;
                  
                  return (
                    <Card key={item.id} className="p-4 border-2 hover:border-blue-300 transition-colors">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <h4 className="font-semibold text-gray-900">{item.name}</h4>
                          {item.description && (
                            <p className="text-sm text-gray-600 mt-1">{item.description}</p>
                          )}
                        </div>
                        <div className="text-right">
                          {item.isComplimentary ? (
                            <Badge variant="secondary" className="bg-green-100 text-green-800">
                              Complimentary
                            </Badge>
                          ) : (
                            <span className="font-semibold text-gray-900">
                              {formatCurrency(item.price)}
                            </span>
                          )}
                        </div>
                      </div>

                      {item.isComplimentary && item.maxComplimentary > 0 && (
                        <div className="mb-3 p-2 bg-green-50 rounded-lg">
                          <p className="text-xs text-green-700">
                            Up to {item.maxComplimentary} complimentary per stay
                          </p>
                        </div>
                      )}

                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          {cartQuantity > 0 ? (
                            <>
                              <Button
                                onClick={() => removeFromCart(item.id)}
                                size="sm"
                                variant="secondary"
                              >
                                -
                              </Button>
                              <span className="w-8 text-center font-medium">{cartQuantity}</span>
                              <Button
                                onClick={() => addToCart(item.id)}
                                size="sm"
                                variant="secondary"
                              >
                                +
                              </Button>
                            </>
                          ) : (
                            <Button
                              onClick={() => addToCart(item.id)}
                              size="sm"
                              disabled={!item.inStock}
                            >
                              {item.inStock ? 'Add' : 'Out of Stock'}
                            </Button>
                          )}
                        </div>
                        
                        {!item.inStock && (
                          <Badge variant="secondary" className="bg-red-100 text-red-800">
                            Out of Stock
                          </Badge>
                        )}
                      </div>
                    </Card>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Complimentary Usage Tracker */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Complimentary Items Usage</h3>
        {summary.complimentaryUsage.length === 0 ? (
          <div className="text-center py-6">
            <Star className="mx-auto h-8 w-8 text-gray-400 mb-3" />
            <p className="text-gray-500">No complimentary items tracked for this room</p>
          </div>
        ) : (
        <div className="space-y-3">
          {summary.complimentaryUsage.map((usage, index) => (
            <div key={`summary-complimentaryUsage-${index}`} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div>
                <p className="font-medium text-gray-900">{usage.itemName}</p>
                <p className="text-sm text-gray-600">
                  Used {usage.used} of {usage.allowed} complimentary items
                </p>
              </div>
              <div className="text-right">
                <p className="font-semibold text-gray-900">
                  {usage.remaining} remaining
                </p>
                <div className="w-20 bg-gray-200 rounded-full h-2 mt-1">
                  <div
                    className="bg-green-500 h-2 rounded-full"
                    style={{ width: `${usage.allowed > 0 ? (usage.remaining / usage.allowed) * 100 : 0}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
        )}
      </Card>

      {/* Service Request History */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Recent Requests</h3>
          <Button
            onClick={() => navigate('/app/services')}
            size="sm"
            variant="secondary"
          >
            View All
          </Button>
        </div>

        {summary.currentCharges.length === 0 ? (
          <div className="text-center py-6">
            <Clock className="mx-auto h-8 w-8 text-gray-400 mb-3" />
            <p className="text-gray-500">No recent service requests</p>
          </div>
        ) : (
          <div className="space-y-3">
            {summary.currentCharges.map((charge, index) => (
              <div key={`summary-currentCharges-${index}-${charge.date}`} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <p className="font-medium text-gray-900">{charge.itemName}</p>
                  <p className="text-sm text-gray-600">
                    Quantity: {charge.quantity} • {new Date(charge.date).toLocaleDateString()}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-gray-900">
                    {formatCurrency(charge.totalPrice)}
                  </p>
                  <Badge variant="secondary" className={
                    charge.isCharged ? 'bg-blue-100 text-blue-800' : 'bg-yellow-100 text-yellow-800'
                  }>
                    {charge.isCharged ? 'Charged' : 'Pending'}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Contact Housekeeping */}
      <Card className="p-6 bg-gray-50">
        <div className="text-center">
          <Bell className="mx-auto h-8 w-8 text-gray-600 mb-3" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Need Assistance?</h3>
          <p className="text-gray-600 mb-4">
            Contact our housekeeping team for any special requests or assistance
          </p>
          <Button
            onClick={() => navigate('/contact')}
            className="bg-blue-600 hover:bg-blue-700"
          >
            Contact Housekeeping
          </Button>
        </div>
      </Card>
    </div>
  );
}