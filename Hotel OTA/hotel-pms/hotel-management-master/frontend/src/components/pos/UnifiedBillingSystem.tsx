import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { API_CONFIG } from '../../config/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from '../../utils/toast';
import {
  ShoppingCart,
  IndianRupee,
  CreditCard,
  Receipt,
  RefreshCw,
  Plus,
  Minus,
  Trash2,
  User,
  Building,
  Coffee,
  Dumbbell,
  Scissors,
  Car,
  ShoppingBag,
  Percent,
  Calculator,
  Printer,
  Archive,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Search
} from 'lucide-react';
import { formatCurrency } from '@/utils/currencyUtils';
import billingSessionService, { BillingSession as BackendBillingSession, CreateBillingSessionRequest } from '../../services/billingSessionService';
import guestLookupService from '../../services/guestLookupService';
import { useAuth } from '../../context/AuthContext';
import { withErrorBoundary } from '../ErrorBoundary';

interface OutletItem {
  id: string;
  name: string;
  category: string;
  price: number;
  outlet: string;
  quantity: number;
  discount?: number;
  tax?: number;
  timestamp: Date;
}

interface BillingSession {
  id: string;
  guestName: string;
  roomNumber: string;
  bookingId?: string;
  items: OutletItem[];
  subtotal: number;
  totalDiscount: number;
  totalTax: number;
  grandTotal: number;
  paymentMethod: 'cash' | 'card' | 'room_charge' | 'corporate' | 'split';
  status: 'draft' | 'paid' | 'room_charged' | 'void';
  createdAt: Date;
  paidAt?: Date;
  notes?: string;
  splitPayments?: Array<{
    method: string;
    amount: number;
  }>;
}

interface Outlet {
  id: string;
  name: string;
  type: 'restaurant' | 'spa' | 'gym' | 'shop' | 'pool' | 'parking';
  icon: React.ReactNode;
  isActive: boolean;
  location: string;
}

const UnifiedBillingSystem: React.FC = () => {
  const { user } = useAuth();
  const [currentSession, setCurrentSession] = useState<BillingSession | null>(null);
  const [backendOutlets, setBackendOutlets] = useState<unknown[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Add custom CSS for scrollbar hiding
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      .scrollbar-hide {
        -ms-overflow-style: none;
        scrollbar-width: none;
      }
      .scrollbar-hide::-webkit-scrollbar {
        display: none;
      }
      .line-clamp-2 {
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }
    `;
    document.head.appendChild(style);
    
    return () => {
      document.head.removeChild(style);
    };
  }, []);
  
  // Backend outlets data
  const [outlets, setOutlets] = useState<Outlet[]>([]);

  const [selectedOutlet, setSelectedOutlet] = useState<string>('');
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [isPercentage, setIsPercentage] = useState(true);
  const [splitPayments, setSplitPayments] = useState<Array<{ method: string; amount: number }>>([]);

  // Load backend data on component mount
  useEffect(() => {
    loadBackendData();
  }, []);

  const loadBackendData = async () => {
    if (!user?.hotelId) return;
    
    try {
      setLoading(true);
      setLoadingItems(true);
      setLoadingGuests(true);
      
                   // Fetch active guests from backend
      try {
        const { data: guestsData } = await api.get('/admin-dashboard/checked-in-bookings');

        // Transform booking data to guest format
        const transformedGuests = guestsData.data?.bookings?.map(booking => ({
          _id: booking._id,
          name: booking.guest?.name || 'Guest',
          email: booking.guest?.email || '',
          phone: booking.guest?.phone || '',
          roomNumber: booking.room?.number || 'N/A',
          roomType: booking.room?.type || 'standard',
          bookingId: booking.bookingNumber || booking._id,
          checkIn: booking.checkIn,
          checkOut: booking.checkOut,
          status: 'checked-in' // All bookings from this endpoint are checked-in
        })) || [];

        setGuests(transformedGuests);
      } catch (error) {
        setGuests([]); // Set empty array instead of sample data
      }
      
      
      // Initialize empty data structure
      const initialData: {[key: string]: unknown[]} = {};

      // Then try to fetch from backend to enhance the data
      try {
        const { data: outletsData } = await api.get('/pos/outlets');
        
        // Fetch menu items for each outlet
        const itemsData: {[key: string]: unknown[]} = {...initialData}; // Start with initial data
        
        for (const outlet of outletsData.data || []) {
          try {
            const { data: menuData } = await api.get(`/pos/menus/outlet/${outlet._id}`);
            if (menuData) {
              
              // Flatten menu items from all menus for this outlet
              const allItems = [];
              for (const menu of menuData.data || []) {
                if (menu.items && menu.items.length > 0) {
                  const formattedItems = menu.items.map(item => ({
                    _id: item.itemId || item._id,
                    name: item.name,
                    category: item.category,
                    price: item.price,
                    outlet: outlet.type
                  }));
                  allItems.push(...formattedItems);
                }
              }
              
              if (allItems.length > 0) {
                itemsData[outlet.type] = allItems;
              }
            } else {
            }
          } catch {
            // Error handled silently
          }
        }
        
        // Transform backend outlets to frontend format
        const getOutletIcon = (type: string) => {
          switch (type) {
            case 'restaurant': return <Coffee className="w-4 h-4" />;
            case 'spa': return <Scissors className="w-4 h-4" />;
            case 'gym': return <Dumbbell className="w-4 h-4" />;
            case 'shop': return <ShoppingBag className="w-4 h-4" />;
            case 'parking': return <Car className="w-4 h-4" />;
            default: return <Building className="w-4 h-4" />;
          }
        };
        
        const transformedOutlets = outletsData.data?.map(outlet => ({
          id: outlet.type,
          name: outlet.name,
          type: outlet.type,
          icon: getOutletIcon(outlet.type),
          isActive: outlet.isActive,
          location: outlet.location
        })) || [];
        
        // Store the enhanced data
        setOutletItems(itemsData);
        setBackendOutlets(outletsData.data || []);
        setOutlets(transformedOutlets);
        
        // Set the first active outlet as selected if not already set
        if (transformedOutlets.length > 0 && !selectedOutlet) {
          const firstActiveOutlet = transformedOutlets.find(outlet => outlet.isActive);
          if (firstActiveOutlet) {
            setSelectedOutlet(firstActiveOutlet.id);
          }
        }
        
        
      } catch (error) {
        // Fallback data already set above
      }
      
      setLoadingItems(false);
      setLoadingGuests(false);
      setLoading(false);
    } catch (error) {
      setLoadingItems(false);
      setLoadingGuests(false);
      setLoading(false);
    }
  };


  // State for outlet items from backend
  const [outletItems, setOutletItems] = useState<{[key: string]: unknown[]}>({});
  const [loadingItems, setLoadingItems] = useState(false);
  
  // State for guest data
  const [guests, setGuests] = useState<unknown[]>([]);
  const [loadingGuests, setLoadingGuests] = useState(false);
  const [selectedGuest, setSelectedGuest] = useState<unknown>(null);
  
  // Filter states
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [roomTypeFilter, setRoomTypeFilter] = useState<string>('all');
  const [floorFilter, setFloorFilter] = useState<string>('all');
  
  // Filtered guests based on selected filters
  const filteredGuests = guests.filter(guest => {
    if (statusFilter !== 'all' && guest.status !== statusFilter) return false;
    if (roomTypeFilter !== 'all' && guest.roomType !== roomTypeFilter) return false;
    if (floorFilter !== 'all') {
      const guestFloor = guest.roomNumber.charAt(0);
      if (floorFilter === 'ground' && guestFloor !== '0') return false;
      if (floorFilter !== 'ground' && guestFloor !== floorFilter) return false;
    }
    return true;
  });

  useEffect(() => {
    if (!currentSession && selectedGuest) {
      // Automatically start billing session when guest is selected
      initializeSession();
    }
  }, [selectedGuest, user?.hotelId]);

  const initializeSession = async () => {
    if (!user?.hotelId || !selectedGuest) {
      toast.error('Hotel ID or guest not found');
      return;
    }

    try {
      setLoading(true);
      
      const sessionData: CreateBillingSessionRequest = {
        guestName: selectedGuest.name,
        roomNumber: selectedGuest.roomNumber,
        bookingNumber: selectedGuest.bookingId || undefined,
        hotelId: user.hotelId
      };

      // Try to create a new session
      let response;
      let wasExistingSession = false;
      try {
        response = await billingSessionService.createSession(sessionData);
      } catch (createError: Record<string, unknown>) {
        // Handle 409 conflict - active session already exists for this room
        if (createError.response?.status === 409) {
          wasExistingSession = true;
          
          // Fetch existing active sessions for this hotel and room
          const sessionsResponse = await billingSessionService.getHotelSessions(user.hotelId, {
            status: 'draft',
            limit: 50
          });
          
          // Find the active session for this specific room
          const existingSession = sessionsResponse.data.find(
            session => session.roomNumber === selectedGuest.roomNumber && 
                      (session.status === 'draft' || session.status === 'room_charged')
          );
          
          if (existingSession) {
            // Use the existing session
            response = { data: { billingSession: existingSession } };
            toast.success(`Resumed existing billing session for Room ${selectedGuest.roomNumber}`);
          } else {
            // Couldn't find the conflicting session, show error
            toast.error('An active billing session exists for this room but could not be retrieved');
            return;
          }
        } else {
          // Re-throw other errors
          throw createError;
        }
      }
      
      const newSession = response.data.billingSession;
      
      // Convert backend session to frontend format
      const frontendSession: BillingSession = {
        id: newSession._id,
        guestName: newSession.guestName,
        roomNumber: newSession.roomNumber,
        bookingId: newSession.bookingId,
        bookingNumber: newSession.bookingNumber,
        items: newSession.items.map(item => ({
          id: item.itemId,
          name: item.name,
          category: item.category,
          price: item.price,
          outlet: item.outlet,
          quantity: item.quantity,
          discount: item.discount,
          tax: item.tax,
          timestamp: new Date(item.timestamp)
        })),
        subtotal: newSession.subtotal,
        totalDiscount: newSession.totalDiscount,
        totalTax: newSession.totalTax,
        grandTotal: newSession.grandTotal,
        paymentMethod: newSession.paymentMethod,
        status: newSession.status,
        createdAt: new Date(newSession.createdAt)
      };

      setCurrentSession(frontendSession);
      if (!wasExistingSession) {
        toast.success(`Billing session started for ${selectedGuest.name}`);
      }
    } catch (error) {
      toast.error('Failed to initialize billing session');
    } finally {
      setLoading(false);
    }
  };

  const addItemToSession = async (item: Record<string, unknown>) => {
    if (!currentSession) {
      toast.error('Please start a billing session first');
      return;
    }

    try {
      setLoading(true);
      
      // Call backend API to add item to session
      const response = await billingSessionService.addItem(currentSession.id, {
        item: {
          id: item._id || item.id,
          name: item.name,
          category: item.category,
          price: item.price,
          outlet: selectedOutlet || item.outlet
        }
      });

      // Update local session state with backend response
      const backendSession = response.data.billingSession;
      const updatedSession = {
        ...currentSession,
        items: backendSession.items.map((backendItem: Record<string, unknown>) => ({
          id: backendItem.itemId,
          name: backendItem.name,
          category: backendItem.category,
          price: backendItem.price,
          outlet: backendItem.outlet,
          quantity: backendItem.quantity,
          tax: backendItem.tax,
          timestamp: new Date(backendItem.timestamp)
        })),
        subtotal: backendSession.subtotal,
        totalTax: backendSession.totalTax,
        grandTotal: backendSession.grandTotal
      };

      setCurrentSession(updatedSession);
      toast.success(`${item.name} added to bill`);
    } catch (error) {
      toast.error(`Failed to add ${item.name}: ${error.response?.data?.message || 'Please try again'}`);
    } finally {
      setLoading(false);
    }
  };

  const updateItemQuantity = (itemId: string, quantity: number) => {
    if (!currentSession || quantity < 1) return;

    const updatedSession = {
      ...currentSession,
      items: currentSession.items.map(item =>
        item.id === itemId ? { ...item, quantity } : item
      )
    };

    calculateTotals(updatedSession);
  };

  const removeItem = (itemId: string) => {
    if (!currentSession) return;

    const updatedSession = {
      ...currentSession,
      items: currentSession.items.filter(item => item.id !== itemId)
    };

    calculateTotals(updatedSession);
  };

  const applyDiscount = () => {
    if (!currentSession) return;

    let discountValue = 0;
    if (isPercentage) {
      discountValue = (currentSession.subtotal * discountAmount) / 100;
    } else {
      discountValue = discountAmount;
    }

    const updatedSession = {
      ...currentSession,
      totalDiscount: discountValue
    };

    calculateTotals(updatedSession);
  };

  const calculateTotals = async (session: BillingSession) => {
    if (!session.items || session.items.length === 0) {
      const updatedSession = {
        ...session,
        subtotal: 0,
        totalTax: 0,
        grandTotal: 0
      };
      setCurrentSession(updatedSession);
      return;
    }

    try {
      // Use backend API to calculate billing totals
      const response = await api.post('/pos/calculate/billing-totals', {
        session: {
          items: session.items,
          totalDiscount: session.totalDiscount || 0
        },
        splitPayments: splitPayments
      });

      if (response.data.success) {
        const { subtotal, totalItemTax, grandTotal } = response.data.data;
        const updatedSession = {
          ...session,
          subtotal,
          totalTax: totalItemTax,
          grandTotal
        };
        setCurrentSession(updatedSession);
      }
    } catch (error) {
      // Fallback to local calculation if API fails
      const subtotal = session.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
      const totalTax = session.items.reduce((sum, item) => sum + ((item.tax || 0) * item.quantity), 0);
      const grandTotal = subtotal + totalTax - session.totalDiscount;

      const updatedSession = {
        ...session,
        subtotal,
        totalTax,
        grandTotal
      };
      setCurrentSession(updatedSession);
    }
  };

  const processPayment = async (paymentMethod: string) => {
    if (!currentSession) return;

    // Validate session before processing
    if (!currentSession.items || currentSession.items.length === 0) {
      toast.error('Cannot process payment for empty bill. Please add items first.');
      return;
    }

    if (currentSession.status !== 'draft') {
      toast.error('Cannot process payment. This session has already been processed.');
      return;
    }

    try {
      setLoading(true);
      
      // Call real backend API for payment processing
      const response = await billingSessionService.checkoutSession(currentSession.id, {
        paymentMethod: paymentMethod as unknown,
        notes: `Payment processed via ${paymentMethod} through POS system`
      });

      const updatedSession = {
        ...currentSession,
        paymentMethod: response.data.billingSession.paymentMethod,
        status: response.data.billingSession.status,
        paidAt: new Date(response.data.billingSession.paidAt)
      };

      setCurrentSession(updatedSession);
      setPaymentDialogOpen(false);

      // Check for settlement integration
      let settlementMessage = '';
      if (response.data.settlementIntegration) {
        const integration = response.data.settlementIntegration;
        if (integration.integrationType === 'new_settlement_created') {
          settlementMessage = ' | New settlement created automatically';
        } else if (integration.integrationType === 'added_to_existing_settlement') {
          settlementMessage = ' | Added to existing settlement';
        }
      }

      toast.success(`Payment processed successfully via ${paymentMethod}${paymentMethod === 'room_charge' ? ' - Charged to room' : ''}${settlementMessage}`);

      // Generate receipt
      generateReceipt(updatedSession);
    } catch (error) {
      toast.error(`Payment processing failed: ${error.response?.data?.message || 'Please try again'}`);
    } finally {
      setLoading(false);
    }
  };

  const processSplitPayment = async () => {
    if (!currentSession || splitPayments.length === 0) return;

    // Validate session before processing
    if (!currentSession.items || currentSession.items.length === 0) {
      toast.error('Cannot process payment for empty bill. Please add items first.');
      return;
    }

    if (currentSession.status !== 'draft') {
      toast.error('Cannot process payment. This session has already been processed.');
      return;
    }

    // Calculate split payment totals using backend
    let totalSplitAmount = 0;
    try {
      const response = await api.post('/pos/calculate/billing-totals', {
        session: {
          items: currentSession.items,
          totalDiscount: currentSession.totalDiscount || 0
        },
        splitPayments: splitPayments
      });
      if (response.data.success) {
        totalSplitAmount = response.data.data.splitPayments.totalSplitAmount;
      } else {
        // Fallback calculation
        totalSplitAmount = splitPayments.reduce((sum, payment) => sum + payment.amount, 0);
      }
    } catch (error) {
      // Fallback calculation
      totalSplitAmount = splitPayments.reduce((sum, payment) => sum + payment.amount, 0);
    }

    if (Math.abs(totalSplitAmount - currentSession.grandTotal) > 0.01) {
      toast.error('Split payment amounts must equal the total bill');
      return;
    }

    try {
      setLoading(true);
      // Call real backend API for split payment processing
      const response = await billingSessionService.checkoutSession(currentSession.id, {
        paymentMethod: 'split',
        splitPayments,
        notes: `Split payment processed via POS system with ${splitPayments.length} payment methods`
      });

      const updatedSession = {
        ...currentSession,
        paymentMethod: response.data.billingSession.paymentMethod,
        splitPayments: response.data.billingSession.splitPayments,
        status: response.data.billingSession.status,
        paidAt: new Date(response.data.billingSession.paidAt)
      };

      setCurrentSession(updatedSession);
      setPaymentDialogOpen(false);
      toast.success('Split payment processed successfully');
      generateReceipt(updatedSession);
    } catch (error) {
      toast.error(`Split payment processing failed: ${error.response?.data?.message || 'Please try again'}`);
    } finally {
      setLoading(false);
    }
  };

  const generateReceipt = (session: BillingSession) => {
    // Mock receipt generation
    const receiptData = {
      sessionId: session.id,
      guestName: session.guestName,
      roomNumber: session.roomNumber,
      items: session.items,
      totals: {
        subtotal: session.subtotal,
        discount: session.totalDiscount,
        tax: session.totalTax,
        grandTotal: session.grandTotal
      },
      paymentMethod: session.paymentMethod,
      timestamp: session.paidAt || new Date()
    };

    toast.success('Receipt generated and sent to printer');
  };

  const voidTransaction = async () => {
    if (!currentSession) return;
    
    try {
      setLoading(true);
      // Call real backend API to void the transaction
      const response = await billingSessionService.voidSession(currentSession.id, {
        reason: 'Transaction voided via POS system'
      });
      
      const updatedSession = {
        ...currentSession,
        status: response.data.billingSession.status,
        notes: response.data.billingSession.notes
      };
      
      setCurrentSession(updatedSession);
      toast.success('Transaction voided successfully');
    } catch (error) {
      toast.error(`Failed to void transaction: ${error.response?.data?.message || 'Please try again'}`);
    } finally {
      setLoading(false);
    }
  };

  const clearSession = () => {
    setCurrentSession(null);
    setSelectedGuest(null);
    setDiscountAmount(0);
    setSplitPayments([]);
  };

  const addSplitPayment = () => {
    setSplitPayments([...splitPayments, { method: 'cash', amount: 0 }]);
  };

  const updateSplitPayment = (index: number, field: string, value: unknown) => {
    const updated = splitPayments.map((payment, i) => 
      i === index ? { ...payment, [field]: value } : payment
    );
    setSplitPayments(updated);
  };

  const removeSplitPayment = (index: number) => {
    setSplitPayments(splitPayments.filter((_, i) => i !== index));
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'paid': return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'room_charged': return <Building className="w-4 h-4 text-blue-500" />;
      case 'void': return <XCircle className="w-4 h-4 text-red-500" />;
      case 'draft': return <Clock className="w-4 h-4 text-yellow-500" />;
      default: return <AlertCircle className="w-4 h-4 text-gray-500" />;
    }
  };

  return (
    <div className="h-screen flex">
      {/* Left Panel - Guest Info & Items */}
      <div className="flex-1 p-4 space-y-4">
                 {/* Guest Selection with Dropdown Filters */}
         {!currentSession && (
           <Card>
             <CardHeader>
               <CardTitle className="flex items-center gap-2">
                 <User className="w-5 h-5" />
                 Select Guest
                 {loadingGuests && <RefreshCw className="w-4 h-4 animate-spin" />}
               </CardTitle>
             </CardHeader>
             <CardContent className="space-y-6">
               {/* Filter Dropdowns */}
               <div className="grid grid-cols-3 gap-4">
                 <div>
                   <Label htmlFor="statusFilter">Status</Label>
                   <Select value={statusFilter} onValueChange={setStatusFilter}>
                     <SelectTrigger className="w-full">
                       <SelectValue placeholder="All Status" />
                     </SelectTrigger>
                     <SelectContent>
                       <SelectItem value="all">All Status</SelectItem>
                       <SelectItem value="checked-in">Checked In</SelectItem>
                       <SelectItem value="confirmed">Confirmed</SelectItem>
                       <SelectItem value="checked-out">Checked Out</SelectItem>
                     </SelectContent>
                   </Select>
                 </div>
                 
                 <div>
                   <Label htmlFor="roomTypeFilter">Room Type</Label>
                   <Select value={roomTypeFilter} onValueChange={setRoomTypeFilter}>
                     <SelectTrigger className="w-full">
                       <SelectValue placeholder="All Types" />
                     </SelectTrigger>
                     <SelectContent>
                       <SelectItem value="all">All Types</SelectItem>
                       <SelectItem value="standard">Standard</SelectItem>
                       <SelectItem value="deluxe">Deluxe</SelectItem>
                       <SelectItem value="suite">Suite</SelectItem>
                       <SelectItem value="presidential">Presidential</SelectItem>
                     </SelectContent>
                   </Select>
                 </div>
                 
                 <div>
                   <Label htmlFor="floorFilter">Floor</Label>
                   <Select value={floorFilter} onValueChange={setFloorFilter}>
                     <SelectTrigger className="w-full">
                       <SelectValue placeholder="All Floors" />
                     </SelectTrigger>
                     <SelectContent>
                       <SelectItem value="all">All Floors</SelectItem>
                       <SelectItem value="ground">Ground Floor</SelectItem>
                       <SelectItem value="1">1st Floor</SelectItem>
                       <SelectItem value="2">2nd Floor</SelectItem>
                       <SelectItem value="3">3rd Floor</SelectItem>
                       <SelectItem value="4">4th Floor</SelectItem>
                       <SelectItem value="5">5th Floor</SelectItem>
                     </SelectContent>
                   </Select>
                 </div>
               </div>

               {/* Guest Selection Dropdown */}
               <div>
                 <Label htmlFor="guestSelect">Select Guest</Label>
                 <Select value={selectedGuest?._id || ''} onValueChange={(guestId) => {
                   const guest = guests.find(g => g._id === guestId);
                   setSelectedGuest(guest || null);
                 }}>
                   <SelectTrigger className="w-full">
                     <SelectValue placeholder="Choose a guest..." />
                   </SelectTrigger>
                   <SelectContent>
                     {filteredGuests.map((guest) => (
                       <SelectItem key={guest._id} value={guest._id}>
                         <div className="flex items-center gap-3">
                           <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                             <span className="text-blue-600 font-semibold text-sm">
                               {guest.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                             </span>
                           </div>
                           <div className="flex-1">
                             <div className="font-medium">{guest.name}</div>
                             <div className="text-sm text-gray-500">
                               Room {guest.roomNumber} • {guest.bookingId}
                             </div>
                           </div>
                         </div>
                       </SelectItem>
                     ))}
                   </SelectContent>
                 </Select>
               </div>

               {/* Selected Guest Info */}
               {selectedGuest && (
                 <Card className="bg-blue-50 border-blue-200">
                   <CardContent className="p-4">
                     <div className="flex items-center gap-4">
                       <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
                         <span className="text-blue-600 font-bold text-xl">
                           {selectedGuest.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                         </span>
                       </div>
                       <div className="flex-1">
                         <h4 className="font-semibold text-lg text-gray-900 mb-1">{selectedGuest.name}</h4>
                         <div className="grid grid-cols-2 gap-4 text-sm text-gray-600">
                           <div>
                             <span className="font-medium">Room:</span> {selectedGuest.roomNumber}
                           </div>
                           <div>
                             <span className="font-medium">Booking:</span> {selectedGuest.bookingId}
                           </div>
                           <div>
                             <span className="font-medium">Check-in:</span> {selectedGuest.checkIn}
                           </div>
                           <div>
                             <span className="font-medium">Check-out:</span> {selectedGuest.checkOut}
                           </div>
                         </div>
                       </div>
                       <div className="text-right">
                         <Badge className="bg-green-100 text-green-800">
                           {selectedGuest.status}
                         </Badge>
                       </div>
                     </div>
                   </CardContent>
                 </Card>
               )}
             </CardContent>
           </Card>
         )}

        {/* Session Header */}
        {currentSession && (
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {getStatusIcon(currentSession.status)}
                  <div>
                    <h3 className="font-medium">{currentSession.guestName}</h3>
                    <p className="text-sm text-gray-500">Room {currentSession.roomNumber} • Session #{currentSession.id.slice(-6)}</p>
                  </div>
                  <Badge className={
                    currentSession.status === 'paid' ? 'bg-green-100 text-green-800' :
                    currentSession.status === 'room_charged' ? 'bg-blue-100 text-blue-800' :
                    currentSession.status === 'void' ? 'bg-red-100 text-red-800' :
                    'bg-yellow-100 text-yellow-800'
                  }>
                    {currentSession.status.replace('_', ' ').toUpperCase()}
                  </Badge>
                </div>
                
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={voidTransaction}>
                    <XCircle className="w-4 h-4 mr-1" />
                    Void
                  </Button>
                  <Button variant="outline" size="sm" onClick={clearSession}>
                    <RefreshCw className="w-4 h-4 mr-1" />
                    New Session
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Outlet Selection & Items */}
        <Card className="flex-1">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Add Items</CardTitle>
              <Select value={selectedOutlet} onValueChange={setSelectedOutlet}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {outlets.map(outlet => (
                    <SelectItem key={outlet.id} value={outlet.id}>
                      <div className="flex items-center gap-2">
                        {outlet.icon}
                        {outlet.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
                     <CardContent>
             {loadingItems ? (
               <div className="flex items-center justify-center py-8">
                 <RefreshCw className="w-6 h-6 animate-spin text-gray-500" />
                 <span className="ml-2 text-gray-500">Loading items...</span>
               </div>
             ) : outletItems[selectedOutlet]?.length > 0 ? (
               <div className="relative">
                 {/* Grid Container */}
                 <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                   {outletItems[selectedOutlet]?.map((item) => (
                     <div role="button" tabIndex={0} 
                       key={item._id || item.id} 
                       className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-lg transition-all duration-200 cursor-pointer overflow-hidden group"
                       onClick={() => addItemToSession(item)}
                      onKeyDown={(e: React.KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); const clickHandler = () => addItemToSession(item); if (typeof clickHandler === 'function') { clickHandler(e as any); } } }}>
                       {/* Item Image Placeholder */}
                       <div className="h-40 bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center group-hover:from-blue-100 group-hover:to-indigo-200 transition-colors">
                         <div className="text-5xl">
                           {item.category === 'Appetizers' ? '🥗' :
                            item.category === 'Main Course' ? '🍽️' : 
                            item.category === 'Desserts' ? '🍰' :
                            item.category === 'Beverages' ? '🥤' : 
                            item.category === 'Massage' ? '💆' : 
                            item.category === 'Training' ? '💪' : 
                            item.category === 'Apparel' ? '👕' : 
                            item.category === 'Services' ? '🛎️' : '🛍️'}
                         </div>
                       </div>
                       
                       {/* Item Details */}
                       <div className="p-4">
                         <div className="mb-3">
                           <h4 className="font-semibold text-gray-900 mb-1 text-sm leading-tight line-clamp-2">{item.name}</h4>
                           <span className="inline-block px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full">{item.category}</span>
                         </div>
                         <div className="flex items-center justify-between">
                           <span className="text-lg font-bold text-emerald-600">{formatCurrency(item.price)}</span>
                           <Button 
                             size="sm" 
                             className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 text-xs font-medium shadow-sm"
                             onClick={(e) => {
                               e.stopPropagation();
                               addItemToSession(item);
                             }}
                           >
                             <Plus className="w-3 h-3 mr-1" />
                             Add
                           </Button>
                         </div>
                       </div>
                     </div>
                   ))}
                 </div>
               </div>
             ) : (
               <div className="text-center py-16 text-gray-500">
                 <div className="text-6xl mb-4">🍽️</div>
                 <h3 className="text-lg font-medium text-gray-700 mb-2">No items available</h3>
                 <p className="text-sm">Items for this outlet will be loaded from the backend</p>
               </div>
             )}
           </CardContent>
        </Card>
      </div>

      {/* Right Panel - Bill Summary */}
      <div className="w-96 border-l bg-gray-50 p-4 space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Receipt className="w-5 h-5" />
              Bill Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Items List */}
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {currentSession?.items.map(item => (
                <div key={item.id} className="flex items-center justify-between p-2 bg-white rounded border">
                  <div className="flex-1">
                    <p className="font-medium text-sm">{item.name}</p>
                    <p className="text-xs text-gray-500">{item.outlet}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1">
                      <Button 
                        size="sm" 
                        variant="outline" 
                        onClick={() => updateItemQuantity(item.id, item.quantity - 1)}
                        className="w-6 h-6 p-0"
                      >
                        <Minus className="w-3 h-3" />
                      </Button>
                      <span className="text-sm w-8 text-center">{item.quantity}</span>
                      <Button 
                        size="sm" 
                        variant="outline" 
                        onClick={() => updateItemQuantity(item.id, item.quantity + 1)}
                        className="w-6 h-6 p-0"
                      >
                        <Plus className="w-3 h-3" />
                      </Button>
                    </div>
                    <span className="text-sm font-medium w-16 text-right">
                      {formatCurrency(item.price * item.quantity)}
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => removeItem(item.id)}
                      className="w-6 h-6 p-0"
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              ))}

              {(!currentSession?.items || currentSession.items.length === 0) && (
                <p className="text-center text-gray-500 py-8">No items added</p>
              )}
            </div>

            <Separator />

            {/* Discount Section */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Discount</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    value={discountAmount}
                    onChange={(e) => setDiscountAmount(parseFloat(e.target.value) || 0)}
                    className="w-20"
                    placeholder="0"
                  />
                  <Select value={isPercentage ? 'percentage' : 'fixed'} onValueChange={(v) => setIsPercentage(v === 'percentage')}>
                    <SelectTrigger className="w-16">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percentage">%</SelectItem>
                      <SelectItem value="fixed">₹</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button size="sm" onClick={applyDiscount}>
                    Apply
                  </Button>
                </div>
              </div>
            </div>

            <Separator />

            {/* Totals */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Subtotal:</span>
                <span>{formatCurrency(currentSession?.subtotal || 0)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Tax (18%):</span>
                <span>{formatCurrency(currentSession?.totalTax || 0)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Discount:</span>
                <span>-{formatCurrency(currentSession?.totalDiscount || 0)}</span>
              </div>
              <Separator />
              <div className="flex justify-between font-bold text-lg">
                <span>Total:</span>
                <span>{formatCurrency(currentSession?.grandTotal || 0)}</span>
              </div>
            </div>

            {/* Payment Buttons */}
            {currentSession && currentSession.status === 'draft' && currentSession.items.length > 0 && (
              <div className="space-y-2">
                <Button className="w-full" onClick={() => processPayment('room_charge')}>
                  <Building className="w-4 h-4 mr-2" />
                  Charge to Room
                </Button>
                <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" className="w-full">
                      <CreditCard className="w-4 h-4 mr-2" />
                      Other Payment Methods
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Payment Options</DialogTitle>
                      <DialogDescription>
                        Total Amount: {formatCurrency(currentSession.grandTotal)}
                      </DialogDescription>
                    </DialogHeader>
                    
                    <Tabs defaultValue="single" className="space-y-4">
                      <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="single">Single Payment</TabsTrigger>
                        <TabsTrigger value="split">Split Payment</TabsTrigger>
                      </TabsList>
                      
                      <TabsContent value="single" className="space-y-4">
                        <div className="grid grid-cols-2 gap-2">
                          <Button onClick={() => processPayment('cash')}>Cash</Button>
                          <Button onClick={() => processPayment('card')}>Card</Button>
                          <Button onClick={() => processPayment('corporate')}>Corporate</Button>
                          <Button onClick={() => processPayment('room_charge')}>Room Charge</Button>
                        </div>
                      </TabsContent>
                      
                      <TabsContent value="split" className="space-y-4">
                        <div className="space-y-2">
                          {splitPayments.map((payment, index) => (
                            <div key={`splitPayments-${index}-${payment.method}`} className="flex items-center gap-2">
                              <Select
                                value={payment.method}
                                onValueChange={(value) => updateSplitPayment(index, 'method', value)}
                              >
                                <SelectTrigger className="flex-1">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="cash">Cash</SelectItem>
                                  <SelectItem value="card">Card</SelectItem>
                                  <SelectItem value="corporate">Corporate</SelectItem>
                                </SelectContent>
                              </Select>
                              <Input
                                type="number"
                                placeholder="Amount"
                                value={payment.amount || ''}
                                onChange={(e) => updateSplitPayment(index, 'amount', parseFloat(e.target.value) || 0)}
                                className="w-24"
                              />
                              <Button size="sm" variant="outline" onClick={() => removeSplitPayment(index)}>
                                <Minus className="w-4 h-4" />
                              </Button>
                            </div>
                          ))}
                          
                          <Button onClick={addSplitPayment} variant="outline" className="w-full">
                            <Plus className="w-4 h-4 mr-2" />
                            Add Payment Method
                          </Button>
                          
                          <div className="text-sm text-gray-600">
                            Split Total: {formatCurrency(splitPayments.reduce((sum, p) => sum + p.amount, 0))} / {formatCurrency(currentSession.grandTotal)}
                          </div>
                          
                          <Button onClick={processSplitPayment} className="w-full">
                            Process Split Payment
                          </Button>
                        </div>
                      </TabsContent>
                    </Tabs>
                  </DialogContent>
                </Dialog>
              </div>
            )}

            {/* Receipt Actions */}
            {currentSession && (currentSession.status === 'paid' || currentSession.status === 'room_charged') && (
              <div className="space-y-2">
                <Button variant="outline" className="w-full">
                  <Printer className="w-4 h-4 mr-2" />
                  Print Receipt
                </Button>
                <Button variant="outline" className="w-full">
                  <Archive className="w-4 h-4 mr-2" />
                  Email Receipt
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default withErrorBoundary(UnifiedBillingSystem, { level: 'component' });