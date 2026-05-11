import React, { useState } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Card, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { 
  X, 
  Package,
  CheckCircle,
  AlertTriangle,
  Clock,
  CreditCard,
  Receipt,
  User,
  Calendar,
  Home,
  ClipboardList
} from 'lucide-react';
import { checkoutInventoryService, CheckoutInventory } from '../../services/checkoutInventoryService';
import { formatDate, formatCurrency } from '../../utils/formatters';
import toast from 'react-hot-toast';

interface CheckoutInventoryDetailsProps {
  inventory: CheckoutInventory;
  onSuccess: () => void;
  onClose: () => void;
}

export function CheckoutInventoryDetails({ inventory, onSuccess, onClose }: CheckoutInventoryDetailsProps) {
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'upi' | 'bank_transfer'>('cash');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [processing, setProcessing] = useState(false);

  const handleProcessPayment = async () => {
    try {
      setProcessing(true);
      await checkoutInventoryService.processPayment(inventory._id, {
        paymentMethod,
        notes: paymentNotes
      });
      toast.success('Payment processed and guest checked out successfully');
      onSuccess();
    } catch (error: unknown) {
      const axiosError = error as { response?: { data?: { message?: string } } };
      const msg = axiosError?.response?.data?.message || 'Failed to process payment';
      toast.error(msg);
    } finally {
      setProcessing(false);
    }
  };

  const handleCompleteInventoryCheck = async () => {
    try {
      setProcessing(true);
      await checkoutInventoryService.completeInventoryCheck(inventory._id);
      toast.success('Inventory check completed successfully!');
      onSuccess();
    } catch (error: unknown) {
      const axiosError = error as { response?: { data?: { message?: string } } };
      const msg = axiosError?.response?.data?.message || 'Failed to complete inventory check';
      toast.error(msg);
    } finally {
      setProcessing(false);
    }
  };

  // Color for item-level status (intact / used / damaged / missing / consumed)
  const getItemStatusColor = (status: string) => {
    switch (status) {
      case 'intact': return 'bg-green-100 text-green-800';
      case 'used': return 'bg-blue-100 text-blue-800';
      case 'damaged': return 'bg-red-100 text-red-800';
      case 'missing': return 'bg-orange-100 text-orange-800';
      case 'consumed': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  // Color for checkout-level status (pending / completed / paid)
  const getCheckoutStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-orange-100 text-orange-800';
      case 'completed': return 'bg-blue-100 text-blue-800';
      case 'paid': return 'bg-green-100 text-green-800';
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

  const getPaymentStatusColor = (status: string) => {
    switch (status) {
      case 'paid': return 'bg-green-100 text-green-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'failed': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-2 sm:p-4">
      <div className="bg-gradient-to-br from-white via-blue-50/30 to-indigo-50/30 backdrop-blur-xl border border-white/20 rounded-3xl w-full max-w-5xl max-h-[95vh] overflow-hidden shadow-2xl">
        {/* Modern Header with Gradient */}
        <div className="relative bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 p-6 sm:p-8">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 to-purple-500/20 backdrop-blur-sm"></div>
          <div className="relative flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
            <div className="flex items-center space-x-3">
              <div className="p-3 bg-white/20 backdrop-blur-sm rounded-2xl">
                <ClipboardList className="h-6 w-6 text-white" />
              </div>
              <div>
                <h2 className="text-2xl sm:text-3xl font-bold text-white">Checkout Inventory</h2>
                <p className="text-blue-100 text-sm sm:text-base">Room {inventory.roomId.roomNumber} • {inventory.roomId.type}</p>
              </div>
            </div>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={onClose}
              className="self-end sm:self-auto bg-white/10 hover:bg-white/20 text-white border-white/20 rounded-xl transition-all duration-200 transform hover:scale-105"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Scrollable Content Area */}
        <div className="overflow-y-auto max-h-[calc(95vh-200px)] p-4 sm:p-6 space-y-6">
          {/* Customer & Booking Information */}
          <div className="relative group">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 to-indigo-500/20 rounded-3xl blur opacity-75 group-hover:opacity-100 transition duration-300"></div>
            <Card className="relative bg-white/90 backdrop-blur-sm border-0 shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:scale-[1.02] rounded-3xl">
              <div className="p-6 sm:p-8">
                <div className="flex items-center mb-6">
                  <div className="p-3 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-2xl mr-4">
                    <User className="h-6 w-6 text-white" />
                  </div>
                  <h3 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">Customer & Booking Details</h3>
                </div>
              
              {/* Customer Information - Prominent Display */}
              <div className="relative bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 border border-blue-200/50 rounded-2xl p-6 mb-6 overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-blue-400/10 to-transparent rounded-full -mr-16 -mt-16"></div>
                <div className="relative">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-4">
                    <div className="p-3 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-2xl w-fit">
                      <User className="h-6 w-6 text-white" />
                    </div>
                    <div className="flex-1">
                      <h4 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-blue-700 to-indigo-700 bg-clip-text text-transparent">
                        {inventory.bookingId.userId?.name || 'Walk-in Guest'}
                      </h4>
                      {inventory.bookingId.userId?.email && (
                        <p className="text-blue-600 font-medium mt-1">{inventory.bookingId.userId.email}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center bg-white/60 backdrop-blur-sm rounded-xl p-3 w-fit">
                    <Receipt className="h-5 w-5 text-indigo-500 mr-3" />
                    <span className="text-indigo-700 font-semibold">Booking #{inventory.bookingId.bookingNumber}</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Room Info */}
                <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-2xl p-4 border border-emerald-200/50 hover:shadow-lg transition-all duration-200 transform hover:scale-105">
                  <div className="flex items-center mb-2">
                    <div className="p-2 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-xl mr-3">
                      <Home className="h-4 w-4 text-white" />
                    </div>
                    <p className="text-sm font-semibold text-emerald-700">Room</p>
                  </div>
                  <p className="font-bold text-emerald-900 text-lg">{inventory.roomId.roomNumber}</p>
                  <p className="text-emerald-600 text-sm">({inventory.roomId.type})</p>
                </div>

                {/* Staff Info */}
                <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl p-4 border border-purple-200/50 hover:shadow-lg transition-all duration-200 transform hover:scale-105">
                  <div className="flex items-center mb-2">
                    <div className="p-2 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl mr-3">
                      <User className="h-4 w-4 text-white" />
                    </div>
                    <p className="text-sm font-semibold text-purple-700">Checked By</p>
                  </div>
                  <p className="font-bold text-purple-900">{inventory.checkedBy.name}</p>
                </div>

                {/* Stay Period */}
                <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl p-4 border border-amber-200/50 hover:shadow-lg transition-all duration-200 transform hover:scale-105 sm:col-span-2 lg:col-span-1">
                  <div className="flex items-center mb-2">
                    <div className="p-2 bg-gradient-to-br from-amber-500 to-orange-500 rounded-xl mr-3">
                      <Calendar className="h-4 w-4 text-white" />
                    </div>
                    <p className="text-sm font-semibold text-amber-700">Stay Period</p>
                  </div>
                  <p className="font-bold text-amber-900 text-sm">
                    {formatDate(inventory.bookingId.checkIn)} - {formatDate(inventory.bookingId.checkOut)}
                  </p>
                </div>

                {/* Checked At */}
                <div className="bg-gradient-to-br from-cyan-50 to-blue-50 rounded-2xl p-4 border border-cyan-200/50 hover:shadow-lg transition-all duration-200 transform hover:scale-105">
                  <div className="flex items-center mb-2">
                    <div className="p-2 bg-gradient-to-br from-cyan-500 to-blue-500 rounded-xl mr-3">
                      <Clock className="h-4 w-4 text-white" />
                    </div>
                    <p className="text-sm font-semibold text-cyan-700">Checked At</p>
                  </div>
                  <p className="font-bold text-cyan-900 text-sm">{formatDate(inventory.checkedAt)}</p>
                </div>

                {/* Items Status */}
                <div className="bg-gradient-to-br from-rose-50 to-red-50 rounded-2xl p-4 border border-rose-200/50 hover:shadow-lg transition-all duration-200 transform hover:scale-105">
                  <div className="flex items-center mb-2">
                    <div className="p-2 bg-gradient-to-br from-rose-500 to-red-500 rounded-xl mr-3">
                      <Package className="h-4 w-4 text-white" />
                    </div>
                    <p className="text-sm font-semibold text-rose-700">Items Status</p>
                  </div>
                  <div className="space-y-1">
                    <p className="font-bold text-rose-900 text-sm">
                      {inventory.items.filter(item => item.status !== 'intact').length} used
                    </p>
                    <p className="text-rose-600 text-xs">
                      {inventory.items.filter(item => item.status === 'damaged').length} damaged • {inventory.items.filter(item => item.status === 'missing').length} missing
                    </p>
                  </div>
                </div>

                {/* Charges Due */}
                <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl p-4 border border-green-200/50 hover:shadow-lg transition-all duration-200 transform hover:scale-105 sm:col-span-2 lg:col-span-1">
                  <div className="flex items-center mb-2">
                    <div className="p-2 bg-gradient-to-br from-green-500 to-emerald-500 rounded-xl mr-3">
                      <CreditCard className="h-4 w-4 text-white" />
                    </div>
                    <p className="text-sm font-semibold text-green-700">Charges Due</p>
                  </div>
                  <p className="font-bold text-green-900 text-xl">{formatCurrency(inventory.totalAmount)}</p>
                </div>
              </div>
            </div>
            </Card>
          </div>

          {/* Status and Payment */}
          <div className="relative group">
            <div className="absolute inset-0 bg-gradient-to-r from-purple-500/20 to-pink-500/20 rounded-3xl blur opacity-75 group-hover:opacity-100 transition duration-300"></div>
            <Card className="relative bg-white/90 backdrop-blur-sm border-0 shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:scale-[1.02] rounded-3xl">
              <div className="p-6 sm:p-8">
                <div className="flex items-center mb-6">
                  <div className="p-3 bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl mr-4">
                    <Receipt className="h-6 w-6 text-white" />
                  </div>
                  <h3 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">Status & Payment</h3>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  {/* Status */}
                  <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-4 border border-blue-200/50">
                    <div className="flex items-center mb-3">
                      <div className="p-2 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-xl mr-3">
                        <Clock className="h-4 w-4 text-white" />
                      </div>
                      <p className="text-sm font-semibold text-blue-700">Status</p>
                    </div>
                    <Badge className={`${getCheckoutStatusColor(inventory.status)} text-sm px-4 py-2 rounded-xl font-semibold`}>
                      {inventory.status}
                    </Badge>
                  </div>

                  {/* Payment Status */}
                  <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-2xl p-4 border border-emerald-200/50">
                    <div className="flex items-center mb-3">
                      <div className="p-2 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-xl mr-3">
                        <CreditCard className="h-4 w-4 text-white" />
                      </div>
                      <p className="text-sm font-semibold text-emerald-700">Payment Status</p>
                    </div>
                    <Badge className={`${getPaymentStatusColor(inventory.paymentStatus)} text-sm px-4 py-2 rounded-xl font-semibold`}>
                      {inventory.paymentStatus}
                    </Badge>
                  </div>

                  {/* Payment Method */}
                  {inventory.paymentMethod && (
                    <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl p-4 border border-amber-200/50">
                      <div className="flex items-center mb-3">
                        <div className="p-2 bg-gradient-to-br from-amber-500 to-orange-500 rounded-xl mr-3">
                          <CreditCard className="h-4 w-4 text-white" />
                        </div>
                        <p className="text-sm font-semibold text-amber-700">Payment Method</p>
                      </div>
                      <p className="font-bold text-amber-900 capitalize">{inventory.paymentMethod.replace('_', ' ')}</p>
                    </div>
                  )}

                  {/* Paid At */}
                  {inventory.paidAt && (
                    <div className="bg-gradient-to-br from-cyan-50 to-blue-50 rounded-2xl p-4 border border-cyan-200/50">
                      <div className="flex items-center mb-3">
                        <div className="p-2 bg-gradient-to-br from-cyan-500 to-blue-500 rounded-xl mr-3">
                          <Calendar className="h-4 w-4 text-white" />
                        </div>
                        <p className="text-sm font-semibold text-cyan-700">Paid At</p>
                      </div>
                      <p className="font-bold text-cyan-900">{formatDate(inventory.paidAt)}</p>
                    </div>
                  )}
                </div>
              </div>
            </Card>
          </div>

          {/* Items List */}
          <div className="relative group">
            <div className="absolute inset-0 bg-gradient-to-r from-orange-500/20 to-red-500/20 rounded-3xl blur opacity-75 group-hover:opacity-100 transition duration-300"></div>
            <Card className="relative bg-white/90 backdrop-blur-sm border-0 shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:scale-[1.02] rounded-3xl">
              <div className="p-6 sm:p-8">
                <div className="flex items-center mb-6">
                  <div className="p-3 bg-gradient-to-br from-orange-500 to-red-500 rounded-2xl mr-4">
                    <Package className="h-6 w-6 text-white" />
                  </div>
                  <h3 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-orange-600 to-red-600 bg-clip-text text-transparent">Inventory Items</h3>
                </div>
                
                <div className="space-y-4">
                  {inventory.items.map((item, index) => (
                    <div key={`inventory-items-${index}-${item.category}`} className="bg-gradient-to-br from-gray-50 to-slate-50 border border-gray-200/50 rounded-2xl p-4 sm:p-6 hover:shadow-lg transition-all duration-200 transform hover:scale-[1.01]">
                      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4 mb-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 bg-gradient-to-br from-slate-500 to-gray-500 rounded-xl">
                              <Package className="h-4 w-4 text-white" />
                            </div>
                            <div>
                              <h4 className="font-bold text-gray-900 text-lg">{item.itemName}</h4>
                              <p className="text-sm font-medium text-gray-600 capitalize bg-gray-100 px-2 py-1 rounded-lg w-fit">{item.category}</p>
                            </div>
                          </div>
                        </div>
                        <Badge className={`${getItemStatusColor(item.status)} text-sm px-4 py-2 rounded-xl font-semibold flex items-center gap-2 w-fit`}>
                          {getStatusIcon(item.status)}
                          <span className="capitalize">{item.status}</span>
                        </Badge>
                      </div>
                      
                      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="bg-white/70 backdrop-blur-sm rounded-xl p-3 border border-gray-200/50">
                          <p className="text-xs font-semibold text-gray-500 mb-1">Quantity</p>
                          <p className="font-bold text-gray-900">{item.quantity}</p>
                        </div>
                        <div className="bg-white/70 backdrop-blur-sm rounded-xl p-3 border border-gray-200/50">
                          <p className="text-xs font-semibold text-gray-500 mb-1">Unit Price</p>
                          <p className="font-bold text-gray-900">{formatCurrency(item.unitPrice)}</p>
                        </div>
                        <div className="bg-white/70 backdrop-blur-sm rounded-xl p-3 border border-gray-200/50">
                          <p className="text-xs font-semibold text-gray-500 mb-1">Total</p>
                          <p className="font-bold text-green-600">{formatCurrency(item.totalPrice)}</p>
                        </div>
                        <div className="bg-white/70 backdrop-blur-sm rounded-xl p-3 border border-gray-200/50">
                          <p className="text-xs font-semibold text-gray-500 mb-1">Status</p>
                          <p className="font-bold text-gray-900 capitalize">{item.status}</p>
                        </div>
                      </div>
                      
                      {item.notes && (
                        <div className="mt-4 bg-blue-50/70 backdrop-blur-sm border border-blue-200/50 rounded-xl p-3">
                          <p className="text-xs font-semibold text-blue-700 mb-1">Notes</p>
                          <p className="text-sm text-blue-800">{item.notes}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          </div>

          {/* Billing Summary */}
          <div className="relative group">
            <div className="absolute inset-0 bg-gradient-to-r from-green-500/20 to-emerald-500/20 rounded-3xl blur opacity-75 group-hover:opacity-100 transition duration-300"></div>
            <Card className="relative bg-white/90 backdrop-blur-sm border-0 shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:scale-[1.02] rounded-3xl">
              <div className="p-6 sm:p-8">
                <div className="flex items-center mb-6">
                  <div className="p-3 bg-gradient-to-br from-green-500 to-emerald-500 rounded-2xl mr-4">
                    <Receipt className="h-6 w-6 text-white" />
                  </div>
                  <h3 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">Billing Summary</h3>
                </div>
                
                <div className="space-y-4">
                  <div className="flex justify-between items-center py-3 px-4 bg-gradient-to-r from-gray-50 to-slate-50 rounded-xl">
                    <span className="text-gray-700 font-medium">Subtotal:</span>
                    <span className="font-bold text-gray-900 text-lg">{formatCurrency(inventory.subtotal)}</span>
                  </div>
                  <div className="flex justify-between items-center py-3 px-4 bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl">
                    <span className="text-amber-700 font-medium">Tax (18%):</span>
                    <span className="font-bold text-amber-900 text-lg">{formatCurrency(inventory.tax)}</span>
                  </div>
                  <div className="bg-gradient-to-r from-green-500 to-emerald-500 rounded-2xl p-4 text-white">
                    <div className="flex justify-between items-center">
                      <span className="text-green-100 font-medium">Total Amount:</span>
                      <span className="font-bold text-2xl">{formatCurrency(inventory.totalAmount)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          </div>

          {/* Notes */}
          {inventory.notes && (
            <div className="relative group">
              <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/20 to-purple-500/20 rounded-3xl blur opacity-75 group-hover:opacity-100 transition duration-300"></div>
              <Card className="relative bg-white/90 backdrop-blur-sm border-0 shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:scale-[1.02] rounded-3xl">
                <div className="p-6 sm:p-8">
                  <div className="flex items-center mb-6">
                    <div className="p-3 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-2xl mr-4">
                      <AlertTriangle className="h-6 w-6 text-white" />
                    </div>
                    <h3 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">Notes</h3>
                  </div>
                  <div className="bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-200/50 rounded-2xl p-4">
                    <p className="text-indigo-800 leading-relaxed">{inventory.notes}</p>
                  </div>
                </div>
              </Card>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-4">
            {inventory.status === 'pending' && (
              <Button 
                onClick={handleCompleteInventoryCheck} 
                loading={processing}
                className="bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 shadow-xl hover:shadow-2xl transition-all duration-200 transform hover:scale-105 rounded-2xl px-8 py-4 font-bold text-lg w-full sm:w-auto"
              >
                <CheckCircle className="h-5 w-5 mr-3" />
                Complete Inventory Check
              </Button>
            )}
            
            {inventory.status === 'completed' && inventory.paymentStatus === 'pending' && !showPaymentForm && (
              <Button 
                onClick={() => setShowPaymentForm(true)}
                className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-xl hover:shadow-2xl transition-all duration-200 transform hover:scale-105 rounded-2xl px-8 py-4 font-bold text-lg w-full sm:w-auto"
              >
                <CreditCard className="h-5 w-5 mr-3" />
                Process Payment
              </Button>
            )}
          </div>

          {showPaymentForm && (
            <div className="relative group">
              <div className="absolute inset-0 bg-gradient-to-r from-green-500/20 to-blue-500/20 rounded-3xl blur opacity-75 group-hover:opacity-100 transition duration-300"></div>
              <Card className="relative bg-white/90 backdrop-blur-sm border-0 shadow-xl hover:shadow-2xl transition-all duration-300 rounded-3xl">
                <div className="p-6 sm:p-8">
                  <div className="flex items-center mb-6">
                    <div className="p-3 bg-gradient-to-br from-green-500 to-blue-500 rounded-2xl mr-4">
                      <CreditCard className="h-6 w-6 text-white" />
                    </div>
                    <h3 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-green-600 to-blue-600 bg-clip-text text-transparent">Process Payment</h3>
                  </div>
                  
                  <div className="space-y-6">
                    <div>
                      <label className="flex items-center text-sm font-semibold text-gray-700 mb-3">
                        <CreditCard className="w-4 h-4 mr-2 text-blue-500" />
                        Payment Method *
                      </label>
                      <select
                        value={paymentMethod}
                        onChange={(e) => setPaymentMethod(e.target.value as 'cash' | 'card' | 'upi' | 'bank_transfer')}
                        className="w-full p-4 border-2 border-gray-200 rounded-2xl bg-white/80 backdrop-blur-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all duration-200 font-medium text-gray-900"
                      >
                        <option value="cash">💵 Cash</option>
                        <option value="card">💳 Card</option>
                        <option value="upi">📱 UPI</option>
                        <option value="bank_transfer">🏦 Bank Transfer</option>
                      </select>
                    </div>

                    <div>
                      <label className="flex items-center text-sm font-semibold text-gray-700 mb-3">
                        <Receipt className="w-4 h-4 mr-2 text-purple-500" />
                        Payment Notes
                      </label>
                      <textarea
                        value={paymentNotes}
                        onChange={(e) => setPaymentNotes(e.target.value)}
                        placeholder="Any notes about the payment..."
                        className="w-full p-4 border-2 border-gray-200 rounded-2xl bg-white/80 backdrop-blur-sm focus:border-purple-500 focus:ring-2 focus:ring-purple-200 transition-all duration-200 font-medium text-gray-900 h-24 resize-none"
                      />
                    </div>

                    <div className="bg-gradient-to-br from-amber-50 to-orange-50 border-2 border-amber-200/50 rounded-2xl p-6">
                      <div className="flex items-start">
                        <div className="p-2 bg-gradient-to-br from-amber-500 to-orange-500 rounded-xl mr-4">
                          <AlertTriangle className="h-5 w-5 text-white" />
                        </div>
                        <div className="flex-1">
                          <h4 className="font-bold text-amber-800 text-lg mb-2">Payment Confirmation</h4>
                          <p className="text-amber-700 font-medium">
                            Total amount to be collected: 
                            <span className="ml-2 text-2xl font-bold bg-gradient-to-r from-amber-600 to-orange-600 bg-clip-text text-transparent">
                              {formatCurrency(inventory.totalAmount)}
                            </span>
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-4">
                      <Button 
                        onClick={handleProcessPayment} 
                        loading={processing}
                        className="flex-1 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 shadow-xl hover:shadow-2xl transition-all duration-200 transform hover:scale-105 rounded-2xl px-6 py-4 font-bold text-lg"
                      >
                        <CheckCircle className="h-5 w-5 mr-2" />
                        Confirm Payment & Checkout
                      </Button>
                      <Button 
                        variant="outline" 
                        onClick={() => setShowPaymentForm(false)}
                        className="bg-white/80 backdrop-blur-sm border-2 border-gray-200 hover:border-gray-300 rounded-2xl px-6 py-4 font-semibold transition-all duration-200 transform hover:scale-105"
                      >
                        <X className="h-4 w-4 mr-2" />
                        Cancel
                      </Button>
                    </div>
                  </div>
                </div>
              </Card>
            </div>
          )}

          {/* Close Button */}
          <div className="flex justify-center pt-6">
            <Button 
              variant="outline" 
              onClick={onClose}
              className="bg-white/80 backdrop-blur-sm border-2 border-gray-200 hover:border-gray-300 rounded-2xl px-8 py-3 font-semibold transition-all duration-200 transform hover:scale-105 text-gray-700 hover:text-gray-900"
            >
              <X className="h-4 w-4 mr-2" />
              Close
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
