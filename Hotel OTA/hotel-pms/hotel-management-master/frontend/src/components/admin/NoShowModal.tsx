import React, { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  X,
  AlertTriangle,
  DollarSign,
  FileText,
  Calendar,
  User,
  Clock,
  CheckCircle2,
  Percent,
  CreditCard,
  TrendingUp
} from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Label } from '../ui/label';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '../ui/dialog';
import toast from 'react-hot-toast';
import { api } from '../../services/api';

interface NoShowModalProps {
  isOpen: boolean;
  onClose: () => void;
  booking: {
    _id: string;
    bookingNumber: string;
    userId?: { name: string };
    checkIn: string;
    checkOut: string;
    totalAmount: number;
    currency: string;
    status: string;
  };
  onSuccess?: () => void;
}

interface NoShowFormData {
  reason: string;
  chargeAmount: number;
}

const NoShowModal: React.FC<NoShowModalProps> = ({
  isOpen,
  onClose,
  booking,
  onSuccess
}) => {
  const [formData, setFormData] = useState<NoShowFormData>({
    reason: '',
    chargeAmount: 0
  });
  const [errors, setErrors] = useState<Partial<NoShowFormData>>({});
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [recentReasons] = useState([
    'Guest did not arrive',
    'No communication from guest',
    'Unable to contact guest',
    'Booking not honored'
  ]);

  const queryClient = useQueryClient();

  // Auto-save to localStorage
  useEffect(() => {
    if (formData.reason) {
      localStorage.setItem(`no-show-draft-${booking._id}`, JSON.stringify(formData));
    }
  }, [formData, booking._id]);

  // Load draft on mount
  useEffect(() => {
    if (isOpen) {
      const draft = localStorage.getItem(`no-show-draft-${booking._id}`);
      if (draft) {
        try {
          const savedData = JSON.parse(draft);
          setFormData(savedData);
        } catch {
          // Error handled silently
        }
      }
    }
  }, [isOpen, booking._id]);

  const markAsNoShowMutation = useMutation({
    mutationFn: async (data: NoShowFormData) => {
      // Use api service for automatic auth header and property ID injection
      const response = await api.post(`/bookings/${booking._id}/no-show`, data);
      return response.data;
    },
    onSuccess: (data) => {
      // Clear draft
      localStorage.removeItem(`no-show-draft-${booking._id}`);

      toast.success(
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5 text-green-600" />
          <span>Booking marked as no-show successfully</span>
        </div>
      );

      // Invalidate and refetch booking queries
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      queryClient.invalidateQueries({ queryKey: ['admin-bookings'] });
      queryClient.invalidateQueries({ queryKey: ['booking-details', booking._id] });

      onSuccess?.();
      handleClose();
    },
    onError: (error: unknown) => {
      // Handle axios error format
      const axiosErr = error as { response?: { data?: { message?: string } } };
      const errorMessage = axiosErr.response?.data?.message || (error instanceof Error ? error.message : 'Failed to mark booking as no-show');
      toast.error(errorMessage);
    }
  });

  const validateForm = (): boolean => {
    const newErrors: Partial<NoShowFormData> = {};

    if (!formData.reason.trim()) {
      newErrors.reason = 'Reason is required';
    } else if (formData.reason.length > 500) {
      newErrors.reason = 'Reason must be less than 500 characters';
    }

    if (formData.chargeAmount < 0) {
      newErrors.chargeAmount = 'Charge amount cannot be negative';
    }

    if (formData.chargeAmount > booking.totalAmount) {
      newErrors.chargeAmount = 'Charge amount cannot exceed booking total';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    // Show confirmation step
    setShowConfirmation(true);
  };

  const handleConfirm = () => {
    setShowConfirmation(false);
    markAsNoShowMutation.mutate(formData);
  };

  const handleClose = () => {
    setFormData({ reason: '', chargeAmount: 0 });
    setErrors({});
    setShowConfirmation(false);
    localStorage.removeItem(`no-show-draft-${booking._id}`);
    onClose();
  };

  const handleQuickAmount = (percentage: number) => {
    const amount = (booking.totalAmount * percentage) / 100;
    setFormData(prev => ({ ...prev, chargeAmount: parseFloat(amount.toFixed(2)) }));
  };

  const handleRecentReason = (reason: string) => {
    setFormData(prev => ({ ...prev, reason }));
  };

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD'
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      confirmed: 'info',
      pending: 'warning',
      cancelled: 'error',
      completed: 'success'
    };
    return colors[status.toLowerCase()] || 'default';
  };

  const chargePercentage = booking.totalAmount > 0
    ? ((formData.chargeAmount / booking.totalAmount) * 100).toFixed(0)
    : '0';

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto p-0 bg-white shadow-2xl">
        {!showConfirmation ? (
          <>
            {/* Gradient Header with Enhanced Design */}
            <div className="relative bg-gradient-to-r from-red-500 via-red-600 to-orange-500 text-white p-8 rounded-t-lg overflow-hidden">
              {/* Animated background pattern */}
              <div className="absolute inset-0 opacity-10">
                <div className="absolute top-0 left-0 w-40 h-40 bg-white rounded-full blur-3xl"></div>
                <div className="absolute bottom-0 right-0 w-64 h-64 bg-white rounded-full blur-3xl"></div>
              </div>

              <div className="relative z-10">
                <div className="flex items-start justify-between mb-6">
                  <div className="flex items-center gap-4">
                    <div className="p-4 bg-white/20 backdrop-blur-md rounded-2xl shadow-2xl ring-2 ring-white/30 hover:scale-105 transition-transform duration-200">
                      <AlertTriangle className="h-8 w-8 text-white drop-shadow-lg" />
                    </div>
                    <div>
                      <h2 className="text-3xl font-bold mb-1 drop-shadow-md">Mark as No-Show</h2>
                      <p className="text-red-100 text-sm font-medium">
                        Booking #{booking.bookingNumber}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Enhanced Progress Indicator */}
                <div className="flex items-center gap-3 bg-white/10 backdrop-blur-sm rounded-full px-4 py-2 w-fit">
                  <div className="flex items-center gap-2">
                    <div className="h-6 w-6 rounded-full bg-white flex items-center justify-center">
                      <Clock className="h-3.5 w-3.5 text-red-600" />
                    </div>
                    <span className="text-sm font-semibold text-white">Step 1 of 2: Enter Details</span>
                  </div>
                  <div className="h-4 w-px bg-white/30"></div>
                  <div className="flex gap-1.5">
                    <div className="h-2 w-2 rounded-full bg-white"></div>
                    <div className="h-2 w-2 rounded-full bg-white/30"></div>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-8 bg-gray-50/50">
              {/* Booking Information Grid */}
              <div className="mb-8">
                <div className="flex items-center gap-2 mb-5">
                  <div className="h-1 w-1 rounded-full bg-blue-600"></div>
                  <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider">
                    Booking Information
                  </h3>
                  <div className="flex-1 h-px bg-gradient-to-r from-gray-300 to-transparent"></div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Guest Card - Enhanced */}
                  <Card className="group p-5 bg-gradient-to-br from-blue-50 via-blue-50 to-blue-100/60 border-blue-200/60 hover:shadow-lg hover:border-blue-300 transition-all duration-300 hover:-translate-y-0.5">
                    <div className="flex items-start gap-3.5">
                      <div className="p-2.5 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-md group-hover:shadow-lg transition-shadow">
                        <User className="h-5 w-5 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-blue-700 font-semibold mb-1.5 uppercase tracking-wide">Guest Name</p>
                        <p className="text-base font-bold text-gray-900 truncate">
                          {booking.userId?.name || 'N/A'}
                        </p>
                      </div>
                    </div>
                  </Card>

                  {/* Dates Card - Enhanced */}
                  <Card className="group p-5 bg-gradient-to-br from-purple-50 via-purple-50 to-purple-100/60 border-purple-200/60 hover:shadow-lg hover:border-purple-300 transition-all duration-300 hover:-translate-y-0.5">
                    <div className="flex items-start gap-3.5">
                      <div className="p-2.5 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl shadow-md group-hover:shadow-lg transition-shadow">
                        <Calendar className="h-5 w-5 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-purple-700 font-semibold mb-1.5 uppercase tracking-wide">Check-in Date</p>
                        <p className="text-base font-bold text-gray-900">
                          {formatDate(booking.checkIn)}
                        </p>
                      </div>
                    </div>
                  </Card>

                  {/* Amount Card - Enhanced */}
                  <Card className="group p-5 bg-gradient-to-br from-green-50 via-green-50 to-green-100/60 border-green-200/60 hover:shadow-lg hover:border-green-300 transition-all duration-300 hover:-translate-y-0.5">
                    <div className="flex items-start gap-3.5">
                      <div className="p-2.5 bg-gradient-to-br from-green-500 to-green-600 rounded-xl shadow-md group-hover:shadow-lg transition-shadow">
                        <DollarSign className="h-5 w-5 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-green-700 font-semibold mb-1.5 uppercase tracking-wide">Total Amount</p>
                        <p className="text-base font-bold text-gray-900">
                          {formatCurrency(booking.totalAmount, booking.currency)}
                        </p>
                      </div>
                    </div>
                  </Card>

                  {/* Status Card - Enhanced */}
                  <Card className="group p-5 bg-gradient-to-br from-orange-50 via-orange-50 to-orange-100/60 border-orange-200/60 hover:shadow-lg hover:border-orange-300 transition-all duration-300 hover:-translate-y-0.5">
                    <div className="flex items-start gap-3.5">
                      <div className="p-2.5 bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl shadow-md group-hover:shadow-lg transition-shadow">
                        <TrendingUp className="h-5 w-5 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-orange-700 font-semibold mb-1.5 uppercase tracking-wide">Current Status</p>
                        <Badge variant={(getStatusColor(booking.status) || 'default') as 'default' | 'info' | 'warning' | 'error' | 'success'} size="sm" className="font-bold">
                          {booking.status.charAt(0).toUpperCase() + booking.status.slice(1)}
                        </Badge>
                      </div>
                    </div>
                  </Card>
                </div>
              </div>

              {/* Enhanced Warning Alert */}
              <Alert variant="warning" className="mb-8 border-2 border-amber-300 bg-gradient-to-r from-amber-50 via-yellow-50 to-amber-50 shadow-md">
                <div className="flex gap-3">
                  <div className="flex-shrink-0 mt-0.5">
                    <div className="p-2 bg-amber-100 rounded-lg">
                      <AlertTriangle className="h-5 w-5 text-amber-600" />
                    </div>
                  </div>
                  <div className="flex-1">
                    <AlertTitle className="text-base font-bold text-amber-900 mb-2">
                      Important Notice
                    </AlertTitle>
                    <AlertDescription className="text-sm leading-relaxed text-amber-800">
                      Marking this booking as no-show will <span className="font-semibold">permanently change its status</span> and may trigger
                      automatic charges. This action can be reversed by an administrator if needed.
                      Please ensure all details are accurate before proceeding.
                    </AlertDescription>
                  </div>
                </div>
              </Alert>

              {/* Enhanced Form */}
              <form onSubmit={handleSubmit} className="space-y-8">
                {/* Reason Field - Enhanced */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label
                      htmlFor="reason"
                      className="flex items-center gap-2.5 text-sm font-bold text-gray-900"
                    >
                      <div className="p-1.5 bg-blue-100 rounded-lg">
                        <FileText className="h-4 w-4 text-blue-600" />
                      </div>
                      No-Show Reason
                      <span className="text-red-500 text-base">*</span>
                    </Label>
                    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                      formData.reason.length > 450 ? 'bg-red-100 text-red-700 ring-2 ring-red-300' :
                      formData.reason.length > 400 ? 'bg-orange-100 text-orange-700 ring-2 ring-orange-300' :
                      'bg-gray-100 text-gray-600'
                    }`}>
                      <span>{formData.reason.length}</span>
                      <span className="text-gray-400">/</span>
                      <span>500</span>
                    </div>
                  </div>

                  {/* Enhanced Quick Select Chips */}
                  <div>
                    <p className="text-xs font-semibold text-gray-600 mb-2.5 uppercase tracking-wide">Quick Select:</p>
                    <div className="flex flex-wrap gap-2.5">
                      {recentReasons.map((reason, index) => (
                        <button aria-label={`Select reason: ${reason}`}
                          key={`recentReasons-${index}-${reason}`}
                          type="button"
                          onClick={() => handleRecentReason(reason)}
                          className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all duration-200 ${
                            formData.reason === reason
                              ? 'bg-blue-500 text-white shadow-md ring-2 ring-blue-300'
                              : 'bg-white text-gray-700 border-2 border-gray-300 hover:border-blue-400 hover:bg-blue-50 hover:shadow-sm'
                          }`}
                          disabled={markAsNoShowMutation.isPending}
                        >
                          {reason}
                        </button>
                      ))}
                    </div>
                  </div>

                  <Textarea
                    id="reason"
                    value={formData.reason}
                    onChange={(e) => setFormData(prev => ({ ...prev, reason: e.target.value }))}
                    placeholder="Enter a detailed reason for marking this booking as no-show. Include any communication attempts, guest contact details, or other relevant information..."
                    rows={5}
                    className={`w-full resize-none transition-all shadow-sm font-medium ${
                      errors.reason
                        ? 'border-2 border-red-500 focus:border-red-500 focus:ring-2 focus:ring-red-200 bg-red-50/30'
                        : 'border-2 border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 hover:border-gray-400'
                    }`}
                    disabled={markAsNoShowMutation.isPending}
                  />
                  {errors.reason && (
                    <div className="flex items-center gap-2 p-3 bg-red-50 border-l-4 border-red-500 rounded-r text-red-700 text-sm font-semibold">
                      <X className="h-4 w-4 flex-shrink-0" />
                      {errors.reason}
                    </div>
                  )}
                </div>

                {/* Charge Amount Field - Enhanced */}
                <div className="space-y-4">
                  <Label
                    htmlFor="chargeAmount"
                    className="flex items-center gap-2.5 text-sm font-bold text-gray-900"
                  >
                    <div className="p-1.5 bg-green-100 rounded-lg">
                      <CreditCard className="h-4 w-4 text-green-600" />
                    </div>
                    No-Show Charge Amount
                  </Label>

                  {/* Enhanced Quick Amount Buttons */}
                  <div>
                    <p className="text-xs font-semibold text-gray-600 mb-2.5 uppercase tracking-wide">Quick Charge:</p>
                    <div className="grid grid-cols-5 gap-2.5">
                      {[0, 25, 50, 75, 100].map((percentage) => {
                        const isActive = Math.abs(formData.chargeAmount - (booking.totalAmount * percentage) / 100) < 0.01;
                        return (
                          <button
                            key={percentage}
                            type="button"
                            onClick={() => handleQuickAmount(percentage)}
                            className={`group relative px-3 py-3.5 text-xs font-bold rounded-xl transition-all duration-200 border-2 ${
                              isActive
                                ? 'bg-gradient-to-br from-green-500 to-green-600 text-white border-green-600 shadow-lg ring-2 ring-green-300 scale-105'
                                : 'bg-white text-gray-700 border-gray-300 hover:border-green-400 hover:bg-green-50 hover:shadow-md hover:scale-105'
                            }`}
                            disabled={markAsNoShowMutation.isPending}
                          >
                            <Percent className={`h-4 w-4 mx-auto mb-1 ${isActive ? 'text-white' : 'text-gray-400 group-hover:text-green-500'}`} />
                            <div className="text-sm">{percentage}%</div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="relative">
                    <div className="absolute left-5 top-1/2 -translate-y-1/2 flex items-center gap-2.5 text-gray-600 z-10">
                      <div className="p-1.5 bg-gray-100 rounded-lg">
                        <DollarSign className="h-4 w-4" />
                      </div>
                      <span className="text-sm font-bold">{booking.currency || 'USD'}</span>
                    </div>
                    <Input
                      id="chargeAmount"
                      type="number"
                      min="0"
                      max={booking.totalAmount}
                      step="0.01"
                      value={formData.chargeAmount}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        chargeAmount: parseFloat(e.target.value) || 0
                      }))}
                      placeholder="0.00"
                      className={`w-full pl-28 pr-24 py-7 text-xl font-bold transition-all shadow-sm ${
                        errors.chargeAmount
                          ? 'border-2 border-red-500 focus:border-red-500 focus:ring-2 focus:ring-red-200 bg-red-50/30'
                          : 'border-2 border-gray-300 focus:border-green-500 focus:ring-2 focus:ring-green-200 hover:border-gray-400'
                      }`}
                      disabled={markAsNoShowMutation.isPending}
                    />
                    <div className="absolute right-5 top-1/2 -translate-y-1/2 z-10">
                      <div className="px-3 py-1.5 bg-green-100 rounded-lg">
                        <span className="text-sm font-bold text-green-700">{chargePercentage}%</span>
                      </div>
                    </div>
                  </div>

                  {errors.chargeAmount && (
                    <div className="flex items-center gap-2 p-3 bg-red-50 border-l-4 border-red-500 rounded-r text-red-700 text-sm font-semibold">
                      <X className="h-4 w-4 flex-shrink-0" />
                      {errors.chargeAmount}
                    </div>
                  )}

                  {/* Enhanced Charge Summary Card */}
                  <div className="bg-gradient-to-br from-gray-50 to-gray-100/50 border-2 border-gray-200 rounded-xl p-4 space-y-2.5 shadow-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-gray-600">Maximum charge:</span>
                      <span className="text-base font-bold text-gray-900">
                        {formatCurrency(booking.totalAmount, booking.currency)}
                      </span>
                    </div>
                    {formData.chargeAmount > 0 && (
                      <>
                        <div className="h-px bg-gradient-to-r from-transparent via-gray-300 to-transparent"></div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-semibold text-gray-600">You are charging:</span>
                          <div className="flex items-center gap-2">
                            <span className="text-lg font-bold text-green-600">
                              {formatCurrency(formData.chargeAmount, booking.currency)}
                            </span>
                            <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs font-bold rounded-full">
                              {chargePercentage}%
                            </span>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Enhanced Action Buttons */}
                <div className="flex gap-4 pt-8 border-t-2 border-gray-200">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleClose}
                    className="flex-1 py-6 text-base font-bold border-2 border-gray-300 hover:bg-gray-100 hover:border-gray-400 transition-all shadow-sm hover:shadow-md"
                    disabled={markAsNoShowMutation.isPending}
                  >
                    <X className="h-5 w-5 mr-2.5" />
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    className="flex-1 py-6 text-base font-bold bg-gradient-to-r from-red-500 via-red-600 to-orange-500
                             hover:from-red-600 hover:via-red-700 hover:to-orange-600 shadow-lg hover:shadow-2xl
                             transition-all duration-200 hover:scale-[1.02] border-0"
                    disabled={markAsNoShowMutation.isPending}
                  >
                    <AlertTriangle className="h-5 w-5 mr-2.5" />
                    Continue to Review
                  </Button>
                </div>
              </form>
            </div>
          </>
        ) : (
          <>
            {/* Confirmation Step - Enhanced Header */}
            <div className="relative bg-gradient-to-r from-orange-500 via-orange-600 to-red-500 text-white p-8 rounded-t-lg overflow-hidden">
              {/* Animated background pattern */}
              <div className="absolute inset-0 opacity-10">
                <div className="absolute top-0 right-0 w-40 h-40 bg-white rounded-full blur-3xl"></div>
                <div className="absolute bottom-0 left-0 w-64 h-64 bg-white rounded-full blur-3xl"></div>
              </div>

              <div className="relative z-10">
                <div className="flex items-center gap-4 mb-6">
                  <div className="p-4 bg-white/20 backdrop-blur-md rounded-2xl shadow-2xl ring-2 ring-white/30 hover:scale-105 transition-transform duration-200">
                    <CheckCircle2 className="h-8 w-8 text-white drop-shadow-lg" />
                  </div>
                  <div>
                    <h2 className="text-3xl font-bold mb-1 drop-shadow-md">Confirm No-Show</h2>
                    <p className="text-orange-100 text-sm font-medium">
                      Please review the details before confirming
                    </p>
                  </div>
                </div>

                {/* Enhanced Progress Indicator */}
                <div className="flex items-center gap-3 bg-white/10 backdrop-blur-sm rounded-full px-4 py-2 w-fit">
                  <div className="flex items-center gap-2">
                    <div className="h-6 w-6 rounded-full bg-white flex items-center justify-center">
                      <CheckCircle2 className="h-3.5 w-3.5 text-orange-600" />
                    </div>
                    <span className="text-sm font-semibold text-white">Step 2 of 2: Review & Confirm</span>
                  </div>
                  <div className="h-4 w-px bg-white/30"></div>
                  <div className="flex gap-1.5">
                    <div className="h-2 w-2 rounded-full bg-white/30"></div>
                    <div className="h-2 w-2 rounded-full bg-white"></div>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-8 bg-gray-50/50 space-y-8">
              {/* Enhanced Summary Card */}
              <Card className="p-6 bg-gradient-to-br from-white via-gray-50 to-gray-100/50 border-2 border-gray-300 shadow-lg">
                <div className="flex items-center gap-2 mb-6">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <FileText className="h-5 w-5 text-blue-600" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900">
                    Summary
                  </h3>
                  <div className="flex-1 h-px bg-gradient-to-r from-gray-300 to-transparent ml-2"></div>
                </div>

                <div className="space-y-5">
                  <div className="pb-4 border-b-2 border-gray-200">
                    <p className="text-xs font-semibold text-gray-600 mb-2 uppercase tracking-wide">Booking Number</p>
                    <p className="text-lg font-bold text-gray-900">#{booking.bookingNumber}</p>
                  </div>

                  <div className="pb-4 border-b-2 border-gray-200">
                    <p className="text-xs font-semibold text-gray-600 mb-2 uppercase tracking-wide">Guest Name</p>
                    <p className="text-lg font-bold text-gray-900">{booking.userId?.name || 'N/A'}</p>
                  </div>

                  <div className="pb-4 border-b-2 border-gray-200">
                    <p className="text-xs font-semibold text-gray-600 mb-2 uppercase tracking-wide">No-Show Reason</p>
                    <div className="text-base text-gray-900 bg-white p-4 rounded-xl border-2 border-gray-200 shadow-sm font-medium leading-relaxed">
                      {formData.reason}
                    </div>
                  </div>

                  <div>
                    <p className="text-xs font-semibold text-gray-600 mb-3 uppercase tracking-wide">Charge Amount</p>
                    <div className="flex items-center justify-between bg-gradient-to-r from-green-50 to-green-100/50 p-5 rounded-xl border-2 border-green-300 shadow-md">
                      <span className="text-3xl font-bold text-green-700">
                        {formatCurrency(formData.chargeAmount, booking.currency)}
                      </span>
                      {formData.chargeAmount > 0 && (
                        <div className="flex items-center gap-2">
                          <Badge variant="success" size="md" className="text-sm px-4 py-1.5 font-bold shadow-sm">
                            {chargePercentage}% of total
                          </Badge>
                        </div>
                      )}
                      {formData.chargeAmount === 0 && (
                        <Badge className="text-sm px-4 py-1.5 font-bold bg-gray-200 text-gray-700">
                          No Charge
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </Card>

              {/* Enhanced Final Warning */}
              <Alert variant="warning" className="border-2 border-amber-300 bg-gradient-to-r from-amber-50 via-yellow-50 to-amber-50 shadow-md">
                <div className="flex gap-3">
                  <div className="flex-shrink-0 mt-0.5">
                    <div className="p-2 bg-amber-100 rounded-lg">
                      <AlertTriangle className="h-5 w-5 text-amber-600" />
                    </div>
                  </div>
                  <div className="flex-1">
                    <AlertTitle className="text-base font-bold text-amber-900 mb-2">
                      Final Confirmation Required
                    </AlertTitle>
                    <AlertDescription className="text-sm leading-relaxed text-amber-800">
                      This action will <span className="font-semibold">immediately mark the booking as no-show</span>. The guest will be notified
                      and any configured charges will be processed. Please ensure you have reviewed all details above.
                    </AlertDescription>
                  </div>
                </div>
              </Alert>

              {/* Enhanced Action Buttons */}
              <div className="flex gap-4 pt-6 border-t-2 border-gray-200">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowConfirmation(false)}
                  className="flex-1 py-6 text-base font-bold border-2 border-gray-300 hover:bg-gray-100 hover:border-gray-400 transition-all shadow-sm hover:shadow-md"
                  disabled={markAsNoShowMutation.isPending}
                >
                  <X className="h-5 w-5 mr-2.5" />
                  Go Back
                </Button>
                <Button
                  type="button"
                  onClick={handleConfirm}
                  className="flex-1 py-6 text-base font-bold bg-gradient-to-r from-red-500 via-red-600 to-orange-500
                           hover:from-red-600 hover:via-red-700 hover:to-orange-600 shadow-lg hover:shadow-2xl
                           transition-all duration-200 hover:scale-[1.02] border-0"
                  disabled={markAsNoShowMutation.isPending}
                >
                  {markAsNoShowMutation.isPending ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent mr-2.5" />
                      <span>Processing...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-5 w-5 mr-2.5" />
                      <span>Confirm No-Show</span>
                    </>
                  )}
                </Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default NoShowModal;
