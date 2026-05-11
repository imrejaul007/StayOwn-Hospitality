import React, { useState, useEffect } from 'react';
import {
  Clock,
  CheckCircle,
  AlertCircle,
  Truck,
  ChefHat,
  Package,
  Bell,
  Timer,
  MapPin,
  Phone,
  MessageSquare
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '../../utils/formatters';
import { api } from '../../services/api';
import { realTimeService } from '../../services/realTimeService';
import toast from 'react-hot-toast';

interface OrderTrackerProps {
  orderId?: string;
  serviceRequestId?: string;
  bookingId?: string;
  onOrderUpdate?: (order: Record<string, unknown>) => void;
}

interface OrderStatus {
  status: string;
  timestamp: string;
  message: string;
  icon: React.ReactNode;
  completed: boolean;
}

interface Order {
  _id: string;
  orderNumber?: string;
  serviceRequestId?: string;
  status: string;
  items: unknown[];
  totalAmount: number;
  customer: {
    roomNumber?: string;
    guest?: unknown;
  };
  specialRequests?: string;
  createdAt: string;
  updatedAt: string;
  estimatedDeliveryTime?: string;
  assignedStaff?: unknown;
  outlet?: unknown;
}

const statusConfig = {
  pending: {
    icon: <Clock className="w-5 h-5" />,
    label: 'Order Received',
    color: 'bg-yellow-100 text-yellow-800',
    description: 'Your order has been received and is being processed'
  },
  confirmed: {
    icon: <CheckCircle className="w-5 h-5" />,
    label: 'Order Confirmed',
    color: 'bg-blue-100 text-blue-800',
    description: 'Your order has been confirmed by the kitchen'
  },
  preparing: {
    icon: <ChefHat className="w-5 h-5" />,
    label: 'Preparing',
    color: 'bg-orange-100 text-orange-800',
    description: 'Your order is being prepared by our chefs'
  },
  ready: {
    icon: <Package className="w-5 h-5" />,
    label: 'Ready for Delivery',
    color: 'bg-purple-100 text-purple-800',
    description: 'Your order is ready and will be delivered shortly'
  },
  out_for_delivery: {
    icon: <Truck className="w-5 h-5" />,
    label: 'Out for Delivery',
    color: 'bg-indigo-100 text-indigo-800',
    description: 'Your order is on its way to your room'
  },
  delivered: {
    icon: <CheckCircle className="w-5 h-5" />,
    label: 'Delivered',
    color: 'bg-green-100 text-green-800',
    description: 'Your order has been delivered. Enjoy your meal!'
  },
  cancelled: {
    icon: <AlertCircle className="w-5 h-5" />,
    label: 'Cancelled',
    color: 'bg-red-100 text-red-800',
    description: 'Your order has been cancelled'
  }
};

const getOrderTimeline = (status: string): OrderStatus[] => {
  const allStatuses = ['pending', 'confirmed', 'preparing', 'ready', 'out_for_delivery', 'delivered'];
  const currentIndex = allStatuses.indexOf(status);

  return allStatuses.map((statusKey, index) => {
    const config = statusConfig[statusKey as keyof typeof statusConfig];
    return {
      status: statusKey,
      timestamp: '', // This would be populated from order history
      message: config.description,
      icon: config.icon,
      completed: index <= currentIndex && status !== 'cancelled'
    };
  });
};

export function RealTimeOrderTracker({
  orderId,
  serviceRequestId,
  bookingId,
  onOrderUpdate
}: OrderTrackerProps) {
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeline, setTimeline] = useState<OrderStatus[]>([]);
  const [estimatedTime, setEstimatedTime] = useState<string>('');
  const [isConnected, setIsConnected] = useState(false);

  // Connect to WebSocket and listen for real-time order/service updates
  useEffect(() => {
    if (orderId || serviceRequestId) {
      fetchOrderDetails();
    }

    // Connect to real-time WebSocket for instant updates
    realTimeService.connect().then(() => {
      setIsConnected(true);
    }).catch(() => {
      setIsConnected(false);
    });

    const handleOrderUpdate = () => {
      if (orderId || serviceRequestId) {
        fetchOrderDetails();
      }
    };

    // Listen for guest-service and food-order events that affect this order
    realTimeService.on('guest-services:updated', handleOrderUpdate);
    realTimeService.on('guest-services:status_changed', handleOrderUpdate);
    realTimeService.on('food_order:created', handleOrderUpdate);
    realTimeService.on('guest-service:created', handleOrderUpdate);

    // Fallback: poll every 60 seconds in case WebSocket is unavailable
    const interval = setInterval(() => {
      if (orderId || serviceRequestId) {
        fetchOrderDetails();
      }
    }, 60000);

    return () => {
      clearInterval(interval);
      realTimeService.off('guest-services:updated', handleOrderUpdate);
      realTimeService.off('guest-services:status_changed', handleOrderUpdate);
      realTimeService.off('food_order:created', handleOrderUpdate);
      realTimeService.off('guest-service:created', handleOrderUpdate);
      setIsConnected(false);
    };
  }, [orderId, serviceRequestId]);

  useEffect(() => {
    if (order) {
      const orderTimeline = getOrderTimeline(order.status);
      setTimeline(orderTimeline);
      calculateEstimatedDeliveryTime();

      // Notify parent component of order updates
      if (onOrderUpdate) {
        onOrderUpdate(order);
      }
    }
  }, [order, onOrderUpdate]);

  const fetchOrderDetails = async () => {
    try {
      setLoading(true);
      let response;

      if (orderId) {
        // Fetch POS order
        response = await api.get(`/pos/orders/${orderId}`);
      } else if (serviceRequestId) {
        // Fetch service request and linked POS order
        response = await api.get(`/guest-services/${serviceRequestId}`);
      }

      if (response?.data?.success || response?.data?.status === 'success') {
        let orderData;

        if (orderId) {
          orderData = response.data.data;
        } else {
          // Extract order data from service request
          const serviceRequest = response.data.data?.serviceRequest || response.data.data;
          orderData = {
            _id: serviceRequest._id,
            orderNumber: serviceRequest.posOrderNumber,
            serviceRequestId: serviceRequest._id,
            status: mapServiceRequestStatusToPOSStatus(serviceRequest.status),
            items: serviceRequest.items || [],
            totalAmount: calculateTotalFromItems(serviceRequest.items || []),
            customer: {
              roomNumber: serviceRequest.bookingId?.rooms?.[0]?.roomId?.roomNumber,
              guest: serviceRequest.userId
            },
            specialRequests: serviceRequest.specialInstructions,
            createdAt: serviceRequest.createdAt,
            updatedAt: serviceRequest.updatedAt,
            assignedStaff: serviceRequest.assignedTo,
            outlet: { name: 'Room Service' }
          };
        }

        setOrder(orderData);
      }
    } catch {
      // Error handled silently
    } finally {
      setLoading(false);
    }
  };

  const mapServiceRequestStatusToPOSStatus = (serviceStatus: string): string => {
    const statusMapping = {
      'pending': 'pending',
      'assigned': 'confirmed',
      'in_progress': 'preparing',
      'completed': 'delivered',
      'cancelled': 'cancelled'
    };
    return statusMapping[serviceStatus as keyof typeof statusMapping] || 'pending';
  };

  const calculateTotalFromItems = (items: Array<Record<string, unknown>>): number => {
    return items.reduce((total: number, item) => {
      const price = Number(item.price) || 0;
      const quantity = Number(item.quantity) || 0;
      return total + (price * quantity);
    }, 0);
  };

  const calculateEstimatedDeliveryTime = () => {
    if (!order) return;

    const now = new Date();
    const orderTime = new Date(order.createdAt);
    const elapsed = (now.getTime() - orderTime.getTime()) / 1000 / 60; // minutes

    let estimatedMinutes = 30; // Default 30 minutes

    switch (order.status) {
      case 'pending':
      case 'confirmed':
        estimatedMinutes = 25;
        break;
      case 'preparing':
        estimatedMinutes = 15;
        break;
      case 'ready':
        estimatedMinutes = 5;
        break;
      case 'out_for_delivery':
        estimatedMinutes = 2;
        break;
      case 'delivered':
        estimatedMinutes = 0;
        break;
    }

    const adjustedMinutes = Math.max(0, estimatedMinutes - elapsed);

    if (adjustedMinutes === 0) {
      setEstimatedTime('Delivered');
    } else if (adjustedMinutes < 1) {
      setEstimatedTime('Any moment now');
    } else {
      setEstimatedTime(`${Math.ceil(adjustedMinutes)} minutes`);
    }
  };

  const contactSupport = () => {
    toast.success('Our support team has been notified. Someone will contact you shortly.');
  };

  if (loading) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </Card>
    );
  }

  if (!order) {
    return (
      <Card className="p-6">
        <div className="text-center py-8">
          <AlertCircle className="mx-auto h-8 w-8 text-gray-400 mb-3" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Order Not Found</h3>
          <p className="text-gray-600">We couldn't find the order you're looking for.</p>
        </div>
      </Card>
    );
  }

  const currentStatusConfig = statusConfig[order.status as keyof typeof statusConfig] || statusConfig.pending;

  return (
    <div className="space-y-6">
      {/* Order Header */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              {order.orderNumber ? `Order #${order.orderNumber}` : 'Room Service Order'}
            </h2>
            <p className="text-gray-600">
              {order.customer.roomNumber ? `Room ${order.customer.roomNumber}` : 'Room Service'}
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <Badge className={currentStatusConfig.color}>
              {currentStatusConfig.icon}
              <span className="ml-2">{currentStatusConfig.label}</span>
            </Badge>
            {isConnected && (
              <div className="flex items-center text-green-600">
                <div className="w-2 h-2 bg-green-600 rounded-full mr-2 animate-pulse"></div>
                <span className="text-xs">Live</span>
              </div>
            )}
          </div>
        </div>

        {/* Estimated Time */}
        {order.status !== 'delivered' && order.status !== 'cancelled' && (
          <div className="bg-blue-50 p-4 rounded-lg mb-4">
            <div className="flex items-center">
              <Timer className="w-5 h-5 text-blue-600 mr-2" />
              <div>
                <p className="font-medium text-blue-900">Estimated Delivery Time</p>
                <p className="text-blue-700">{estimatedTime}</p>
              </div>
            </div>
          </div>
        )}

        {/* Current Status Description */}
        <p className="text-gray-700 mb-4">{currentStatusConfig.description}</p>

        {/* Quick Actions */}
        <div className="flex space-x-3">
          <Button
            onClick={contactSupport}
            variant="secondary"
            size="sm"
          >
            <Phone className="w-4 h-4 mr-2" />
            Contact Support
          </Button>
          <Button
            onClick={() => window.location.href = '/guest/orders'}
            variant="secondary"
            size="sm"
          >
            <Package className="w-4 h-4 mr-2" />
            View All Orders
          </Button>
        </div>
      </Card>

      {/* Order Timeline */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Order Progress</h3>
        <div className="space-y-4">
          {timeline.map((step, index) => (
            <div key={step.status} className="flex items-start">
              <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                step.completed ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'
              }`}>
                {step.completed ? <CheckCircle className="w-5 h-5" /> : step.icon}
              </div>
              <div className="ml-4 flex-1">
                <div className="flex items-center justify-between">
                  <p className={`font-medium ${step.completed ? 'text-gray-900' : 'text-gray-500'}`}>
                    {statusConfig[step.status as keyof typeof statusConfig]?.label}
                  </p>
                  {step.timestamp && (
                    <span className="text-xs text-gray-500">{step.timestamp}</span>
                  )}
                </div>
                <p className={`text-sm ${step.completed ? 'text-gray-600' : 'text-gray-400'}`}>
                  {step.message}
                </p>
              </div>
              {index < timeline.length - 1 && (
                <div className={`absolute left-4 mt-8 w-0.5 h-6 ${
                  step.completed ? 'bg-green-200' : 'bg-gray-200'
                }`} style={{ marginLeft: '15px' }} />
              )}
            </div>
          ))}
        </div>
      </Card>

      {/* Order Details */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Order Details</h3>

        {/* Items */}
        <div className="space-y-3 mb-4">
          {order.items.map((item, index) => (
            <div key={`order-items-${index}-${item.name}`} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-b-0">
              <div>
                <p className="font-medium text-gray-900">{item.name}</p>
                <p className="text-sm text-gray-600">Quantity: {item.quantity}</p>
              </div>
              <p className="font-medium text-gray-900">
                {formatCurrency(item.price * item.quantity)}
              </p>
            </div>
          ))}
        </div>

        {/* Total */}
        <div className="flex items-center justify-between pt-3 border-t border-gray-200">
          <p className="font-semibold text-gray-900">Total</p>
          <p className="font-semibold text-gray-900 text-lg">
            {formatCurrency(order.totalAmount)}
          </p>
        </div>

        {/* Special Instructions */}
        {order.specialRequests && (
          <div className="mt-4 p-3 bg-yellow-50 rounded-lg">
            <p className="text-sm font-medium text-yellow-800 mb-1">Special Instructions</p>
            <p className="text-sm text-yellow-700">{order.specialRequests}</p>
          </div>
        )}

        {/* Staff Assignment */}
        {order.assignedStaff && (
          <div className="mt-4 p-3 bg-blue-50 rounded-lg">
            <p className="text-sm font-medium text-blue-800 mb-1">Assigned Staff</p>
            <p className="text-sm text-blue-700">{order.assignedStaff.name}</p>
          </div>
        )}
      </Card>

      {/* Delivery Information */}
      {order.customer.roomNumber && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Delivery Information</h3>
          <div className="flex items-center">
            <MapPin className="w-5 h-5 text-gray-600 mr-3" />
            <div>
              <p className="font-medium text-gray-900">Room {order.customer.roomNumber}</p>
              <p className="text-sm text-gray-600">Please ensure someone is available to receive the order</p>
            </div>
          </div>
        </Card>
      )}

      {/* Feedback Section (for completed orders) */}
      {order.status === 'delivered' && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">How was your order?</h3>
          <p className="text-gray-600 mb-4">We'd love to hear about your experience with this order.</p>
          <Button className="bg-green-600 hover:bg-green-700">
            <MessageSquare className="w-4 h-4 mr-2" />
            Leave Feedback
          </Button>
        </Card>
      )}
    </div>
  );
}