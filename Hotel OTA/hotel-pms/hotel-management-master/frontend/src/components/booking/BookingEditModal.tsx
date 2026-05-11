import React, { useState, useEffect, useRef} from 'react';
import { Modal } from '../ui/Modal';
import { User, UserPlus, UserMinus, Calculator, IndianRupee, AlertCircle, CheckCircle, Clock, FileText, CreditCard, Receipt, Eye, Edit } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { ExtraPersonChargesPayment } from '../payments/ExtraPersonChargesPayment';
import { MultiPaymentExtraPersonCharges, PaymentMethod } from '../payments/MultiPaymentExtraPersonCharges';
import { ExtraPersonChargePayment } from '../../services/stripePaymentService';
import { bookingEditingService } from '../../services/bookingEditingService';
import { api } from '../../services/api';
import { withErrorBoundary } from '../ErrorBoundary';

interface ExtraPerson {
  personId?: string;
  name: string;
  type: 'adult' | 'child';
  age?: number;
  isActive: boolean;
}

interface ExtraPersonCharge {
  personId: string;
  baseCharge: number;
  totalCharge: number;
  currency: string;
  description: string;
}

interface SettlementData {
  status: string;
  finalAmount: number;
  outstandingBalance: number;
  refundAmount: number;
  adjustments: Array<{
    type: string;
    amount: number;
    description: string;
    appliedAt: string;
  }>;
}

interface BookingData {
  _id: string;
  bookingNumber: string;
  checkIn: string;
  checkOut: string;
  status: string;
  totalAmount: number;
  guestDetails: {
    adults: number;
    children: number;
  };
  extraPersons?: ExtraPerson[];
  extraPersonCharges?: ExtraPersonCharge[];
  settlementTracking?: SettlementData;
}

interface BookingEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  booking: BookingData | null;
  onBookingUpdated?: (updatedBooking: BookingData) => void;
}

function BookingEditModal({ isOpen, onClose, booking, onBookingUpdated }: BookingEditModalProps) {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'persons' | 'settlement'>('persons');
  const [extraPersons, setExtraPersons] = useState<ExtraPerson[]>([]);
  const [charges, setCharges] = useState<ExtraPersonCharge[]>([]);
  const [settlement, setSettlement] = useState<SettlementData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form states
  const [newPersonName, setNewPersonName] = useState('');
  const [newPersonType, setNewPersonType] = useState<'adult' | 'child'>('adult');
  const [newPersonAge, setNewPersonAge] = useState('');
  const [isAddingPerson, setIsAddingPerson] = useState(false);

  // Settlement form states
  const [adjustmentType, setAdjustmentType] = useState('');
  const [adjustmentAmount, setAdjustmentAmount] = useState('');
  const [adjustmentDescription, setAdjustmentDescription] = useState('');
  const [isAddingAdjustment, setIsAddingAdjustment] = useState(false);

  // Payment states
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentCharges, setPaymentCharges] = useState<ExtraPersonChargePayment[]>([]);

  // Edit price modal state
  const [editingCharge, setEditingCharge] = useState<unknown>(null);
  const [editedAmount, setEditedAmount] = useState('');
  const [editReason, setEditReason] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [isApproving, setIsApproving] = useState(false);

  // Invoice generation states
  const [isGeneratingInvoice, setIsGeneratingInvoice] = useState(false);
  const [isGeneratingSettlementInvoice, setIsGeneratingSettlementInvoice] = useState(false);
  const [generatedInvoice, setGeneratedInvoice] = useState<unknown>(null);

  // Check if user has permission (admin or staff only)
  const hasPermission = user && ['admin', 'staff'].includes(user.role);

  const isMountedRef = useRef(true);

  const successTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (successTimerRef.current) clearTimeout(successTimerRef.current);
    };
  }, []);

  useEffect(() => {
    return () => { isMountedRef.current = false; };
  }, []);

  useEffect(() => {
    if (booking && isOpen) {

      setExtraPersons(booking.extraPersons || []);
      setCharges(booking.extraPersonCharges || []);

      // Check if booking prop already has settlement data
      if (booking.settlementTracking) {
        setSettlement(booking.settlementTracking);
      } else {
        fetchSettlementData();
      }
    }
  }, [booking, isOpen]);

  const fetchSettlementData = async () => {
    if (!booking) return;

    try {

      // Try fetching from main booking endpoint to get latest settlementTracking
      const { data: bookingData } = await api.get(`/bookings/${booking._id}`);

      if (bookingData.data.settlementTracking) {
        setSettlement(bookingData.data.settlementTracking);
        return;
      } else {
      }

      // Fallback to settlement endpoint
      const { data: settlementResponse } = await api.get(`/bookings/${booking._id}/settlement`);
      setSettlement(settlementResponse.data.settlement);
    } catch {
      // Error handled silently
    }
  };

  const addExtraPerson = async () => {
    if (!newPersonName.trim() || !booking) return;

    setIsAddingPerson(true);
    setError(null);

    try {
      const personData: Record<string, unknown> = {
        name: newPersonName.trim(),
        type: newPersonType
        // REMOVED: autoCalculateCharges: true
      };

      if (newPersonType === 'child' && newPersonAge) {
        personData.age = parseInt(newPersonAge);
      }

      const { data: result } = await api.post(`/bookings/${booking._id}/extra-persons`, personData);
      setExtraPersons(result.data.booking.extraPersons || []);
      setCharges(result.data.booking.extraPersonCharges || []);

      // Reset form
      setNewPersonName('');
      setNewPersonType('adult');
      setNewPersonAge('');

      // NEW: Show pending status in success message
      const suggestedCharge = result.data.suggestedCharge;
      setSuccess(`${personData.type} "${personData.name}" added successfully. Suggested charge: ₹${suggestedCharge?.totalCharge || 0} (Pending approval)`);
      if (successTimerRef.current) clearTimeout(successTimerRef.current);
      successTimerRef.current = setTimeout(() => setSuccess(null), 5000);

      // Refresh settlement data
      fetchSettlementData();

      if (onBookingUpdated) {
        onBookingUpdated(result.data.booking);
      }
    } catch (error: unknown) {
      setError(error.response?.data?.message || 'Failed to add extra person. Please try again.');
    } finally {
      setIsAddingPerson(false);
    }
  };

  const removeExtraPerson = async (personId: string, personName: string) => {
    if (!booking || !window.confirm(`Remove ${personName}?`)) return;

    setIsLoading(true);
    setError(null);

    try {
      const { data: result } = await api.delete(`/bookings/${booking._id}/extra-persons/${personId}`);
      setExtraPersons(prev => prev.filter(p => p.personId !== personId));
      setCharges(prev => prev.filter(c => c.personId !== personId));

      setSuccess(`${result.data.removedPerson.name} removed successfully`);
      if (successTimerRef.current) clearTimeout(successTimerRef.current);
      successTimerRef.current = setTimeout(() => setSuccess(null), 3000);

      // Refresh settlement data
      fetchSettlementData();
    } catch (error: unknown) {
      setError(error.response?.data?.message || 'Failed to remove extra person. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const addSettlementAdjustment = async () => {
    if (!adjustmentType || !adjustmentAmount || !adjustmentDescription.trim() || !booking) return;

    setIsAddingAdjustment(true);
    setError(null);

    try {
      const adjustmentData = {
        type: adjustmentType,
        amount: parseFloat(adjustmentAmount),
        description: adjustmentDescription.trim()
      };

      const { data: result } = await api.post(`/bookings/${booking._id}/settlement/adjustment`, adjustmentData);


      // Don't immediately trust the backend response, refresh data instead
      // setSettlement(result.data.updatedSettlement);

      // Force a fresh fetch of settlement data to avoid stale calculations
      if (successTimerRef.current) clearTimeout(successTimerRef.current);
      successTimerRef.current = setTimeout(() => {
        fetchSettlementData();
      }, 500);

      // Reset form
      setAdjustmentType('');
      setAdjustmentAmount('');
      setAdjustmentDescription('');

      setSuccess('Settlement adjustment added successfully');
      if (successTimerRef.current) clearTimeout(successTimerRef.current);
      successTimerRef.current = setTimeout(() => setSuccess(null), 3000);
    } catch (error: unknown) {
      setError(error.response?.data?.message || 'Failed to add adjustment. Please try again.');
    } finally {
      setIsAddingAdjustment(false);
    }
  };

  const recalculateCharges = async () => {
    if (!booking) return;

    setIsLoading(true);
    setError(null);

    try {
      const { data: result } = await api.post(`/bookings/${booking._id}/extra-persons/calculate-charges`);

      // Use extraPersonCharges which preserves payment status, fallback to chargeBreakdown for compatibility
      const updatedCharges = result.data.extraPersonCharges || result.data.chargeBreakdown || [];
      setCharges(updatedCharges);


      setSuccess('Charges recalculated successfully');
      if (successTimerRef.current) clearTimeout(successTimerRef.current);
      successTimerRef.current = setTimeout(() => setSuccess(null), 3000);

      // If there's a callback to refresh booking data, call it
      if (onBookingUpdated && result.data.booking) {
        onBookingUpdated(result.data.booking);
      }

      // Refresh settlement data
      fetchSettlementData();
    } catch (error: unknown) {
      setError(error.response?.data?.message || 'Failed to recalculate charges. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Open edit price modal
  const openEditPriceModal = (charge: Record<string, unknown>) => {
    setEditingCharge(charge);
    setEditedAmount(charge.adjustedAmount?.toString() || charge.calculatedAmount?.toString() || charge.totalCharge?.toString() || '');
    setEditReason(charge.adjustmentReason || '');
  };

  // Save edited price
  const saveEditedPrice = async () => {
    if (!editingCharge || !booking || !editedAmount || !editReason.trim()) return;

    setIsSavingEdit(true);
    setError(null);

    try {
      const { data: result } = await api.put(
        `/bookings/${booking._id}/extra-persons/${editingCharge.personId}/update-charge`,
        {
          adjustedAmount: parseFloat(editedAmount),
          adjustmentReason: editReason.trim()
        }
      );

      setCharges(result.data.booking.extraPersonCharges);
      setSuccess('Price updated successfully');
      if (successTimerRef.current) clearTimeout(successTimerRef.current);
      successTimerRef.current = setTimeout(() => setSuccess(null), 3000);
      setEditingCharge(null);

      if (onBookingUpdated) {
        onBookingUpdated(result.data.booking);
      }
    } catch (error: unknown) {
      setError(error.response?.data?.message || 'Failed to update price. Please try again.');
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Approve/Apply charge
  const approveCharge = async (personId: string) => {
    if (!booking) return;

    if (!window.confirm('Apply this charge to the booking? Guest will be able to pay after this action.')) {
      return;
    }

    setIsApproving(true);
    setError(null);

    try {
      const { data: result } = await api.post(
        `/bookings/${booking._id}/extra-persons/${personId}/approve`
      );

      setCharges(result.data.booking.extraPersonCharges);
      setSuccess('Charge applied successfully. Guest can now pay.');
      if (successTimerRef.current) clearTimeout(successTimerRef.current);
      successTimerRef.current = setTimeout(() => setSuccess(null), 3000);
      fetchSettlementData();

      if (onBookingUpdated) {
        onBookingUpdated(result.data.booking);
      }
    } catch (error: unknown) {
      setError(error.response?.data?.message || 'Failed to apply charge. Please try again.');
    } finally {
      setIsApproving(false);
    }
  };

  if (!booking) return null;

  if (!hasPermission) {
    return (
      <Modal isOpen={isOpen} onClose={onClose} title="Access Denied" size="md">
        <div className="text-center py-8">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <p className="text-gray-600">Only admin and staff members can edit bookings.</p>
        </div>
      </Modal>
    );
  }

  // Calculate unpaid charges only (APPLIED or PAID status, not PENDING)
  const unpaidCharges = charges.filter(charge => charge.status !== 'pending' && !charge.isPaid);
  const totalUnpaidCharges = unpaidCharges.reduce((sum, charge) => sum + (charge.totalCharge - (charge.paidAmount || 0)), 0);

  // Total charges (only applied/paid, not pending)
  const appliedCharges = charges.filter(charge => charge.status !== 'pending');
  const totalExtraCharges = appliedCharges.reduce((sum, charge) => sum + charge.totalCharge, 0);
  const totalPaidCharges = appliedCharges.reduce((sum, charge) => sum + (charge.paidAmount || 0), 0);

  // Count pending charges
  const pendingCharges = charges.filter(charge => charge.status === 'pending');

  const generateSupplementaryInvoice = async () => {

    if (charges.length === 0) {
      setError('No extra person charges to generate invoice for');
      return;
    }

    setIsGeneratingInvoice(true);
    setError(null);
    setSuccess(null);

    try {
      const extraPersonCharges = charges.map(charge => ({
        personId: charge.personId,
        personName: extraPersons.find(p => p.personId === charge.personId)?.name || 'Additional Guest',
        description: charge.description,
        baseCharge: charge.baseCharge,
        totalCharge: charge.totalCharge,
        addedAt: new Date().toISOString()
      }));


      const response = await bookingEditingService.generateSupplementaryInvoice(
        booking._id,
        extraPersonCharges
      );


      if (response.status === 'success' || response.success) {
        // Handle different response structures
        const invoice = response.data.invoice || response.data;

        // Ensure we have invoice data
        if (!invoice || (!invoice._id && !invoice.id)) {
          throw new Error('Invalid invoice data received from server');
        }

        const invoiceId = invoice._id || invoice.id;
        const successMessage = `Supplementary invoice generated successfully! Invoice ID: ${invoiceId}`;

        // Create a more detailed success message with download options
        setSuccess('success_with_invoice');
        setGeneratedInvoice(invoice);

        // Display invoice details if available
      } else {
        throw new Error(response.message || 'Failed to generate invoice');
      }
    } catch (err: unknown) {
      const errorMessage = err.response?.data?.error?.message || err.message || 'Failed to generate supplementary invoice';
      setError(errorMessage);
    } finally {
      setIsGeneratingInvoice(false);
    }
  };

  const downloadInvoice = async (invoiceId: string) => {
    try {

      if (!invoiceId || invoiceId === 'undefined') {
        throw new Error('Invalid invoice ID');
      }

      const { data: blob } = await api.get(`/invoices/${invoiceId}/download`, {
        responseType: 'blob'
      });

      // Create blob from response
      const url = window.URL.createObjectURL(blob);

      // Create download link
      const link = document.createElement('a');
      link.href = url;
      link.download = `Invoice-${invoiceId}.pdf`;
      document.body.appendChild(link);
      link.click();

      // Cleanup
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

    } catch (err: unknown) {
      setError(err.response?.data?.message || err.message || 'Failed to download invoice');
    }
  };

  const viewInvoice = async (invoiceId: string) => {
    try {

      if (!invoiceId || invoiceId === 'undefined') {
        throw new Error('Invalid invoice ID');
      }

      // Fetch the invoice HTML content and open in new window
      const { data: htmlContent } = await api.get(`/invoices/${invoiceId}/view`, {
        responseType: 'text'
      });

      // Open new window and write the HTML content
      const newWindow = window.open('', '_blank');
      if (newWindow) {
        newWindow.document.write(htmlContent);
        newWindow.document.close();
      } else {
        throw new Error('Unable to open new window. Please check if popups are blocked.');
      }

    } catch (err: unknown) {
      setError(err.response?.data?.message || err.message || 'Failed to open invoice');
    }
  };

  const generateSettlementInvoice = async () => {
    if (!settlement || !settlement.adjustments || settlement.adjustments.length === 0) {
      setError('No settlement adjustments to generate invoice for');
      return;
    }

    setIsGeneratingSettlementInvoice(true);
    setError(null);

    try {
      // We would need settlement ID, but since we're working with settlement data,
      // we'd need to either store the settlement ID or get it from the API
      // For now, let's simulate the process and show success

      const adjustments = settlement.adjustments.map(adj => ({
        description: adj.description,
        amount: adj.amount,
        type: adj.type,
        appliedAt: adj.appliedAt
      }));

      // Note: In a real implementation, you would need the settlement ID
      // const response = await bookingEditingService.generateSettlementInvoice(settlementId, adjustments);

      // For now, simulate success
      await new Promise(resolve => setTimeout(resolve, 2000)); // Simulate API call
    if (!isMountedRef.current) return;

      setSuccess('Settlement invoice would be generated successfully!');
      // In reality: if (response.status === 'success') { ... }

    } catch (err: unknown) {
      setError(err.message || 'Failed to generate settlement invoice');
    } finally {
      setIsGeneratingSettlementInvoice(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Edit Booking ${booking.bookingNumber}`} size="xl">
      <div className="space-y-6">
        {/* Success/Error Messages */}
        {success && (
          <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg">
            {success === 'success_with_invoice' && generatedInvoice ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5" />
                  <span className="font-medium">Supplementary invoice generated successfully!</span>
                </div>
                <div className="bg-white border border-green-300 rounded-lg p-3">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <p className="text-sm text-gray-600">
                        Invoice ID: <span className="font-mono text-gray-800">
                          {generatedInvoice._id || generatedInvoice.id || 'Loading...'}
                        </span>
                      </p>
                      <p className="text-sm text-gray-600">
                        Total Amount: <span className="font-semibold text-green-700">
                          ₹{generatedInvoice.totalAmount?.toLocaleString() || 'Loading...'}
                        </span>
                      </p>
                      <p className="text-sm text-gray-600">
                        Status: <span className="capitalize">
                          {generatedInvoice.status || 'Loading...'}
                        </span>
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        const invoiceId = generatedInvoice._id || generatedInvoice.id;
                        if (invoiceId && invoiceId !== 'undefined') {
                          downloadInvoice(invoiceId);
                        } else {
                          setError('Invalid invoice ID. Please try generating the invoice again.');
                        }
                      }}
                      disabled={!generatedInvoice._id && !generatedInvoice.id}
                      className="bg-blue-600 text-white px-3 py-2 rounded text-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                    >
                      <Receipt className="w-4 h-4" />
                      Download PDF
                    </button>
                    <button
                      onClick={() => {
                        const invoiceId = generatedInvoice._id || generatedInvoice.id;
                        if (invoiceId && invoiceId !== 'undefined') {
                          viewInvoice(invoiceId);
                        } else {
                          setError('Invalid invoice ID. Please try generating the invoice again.');
                        }
                      }}
                      disabled={!generatedInvoice._id && !generatedInvoice.id}
                      className="bg-gray-600 text-white px-3 py-2 rounded text-sm hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                    >
                      <Eye className="w-4 h-4" />
                      View Invoice
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5" />
                {success}
              </div>
            )}
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center gap-2">
            <AlertCircle className="w-5 h-5" />
            {error}
          </div>
        )}

        {/* Booking Summary */}
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-gray-500">Check-in:</span>
              <p className="font-medium">{new Date(booking.checkIn).toLocaleDateString()}</p>
            </div>
            <div>
              <span className="text-gray-500">Check-out:</span>
              <p className="font-medium">{new Date(booking.checkOut).toLocaleDateString()}</p>
            </div>
            <div>
              <span className="text-gray-500">Status:</span>
              <p className="font-medium capitalize">{booking.status}</p>
            </div>
            <div>
              <span className="text-gray-500">Original Amount:</span>
              <p className="font-medium">₹{booking.totalAmount?.toLocaleString() || 0}</p>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b">
          <button
            onClick={() => setActiveTab('persons')}
            className={`px-4 py-2 border-b-2 font-medium transition-colors ${
              activeTab === 'persons'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <div className="flex items-center gap-2">
              <UserPlus className="w-4 h-4" />
              Extra Persons ({extraPersons.length})
            </div>
          </button>
          <button
            onClick={() => {
              setActiveTab('settlement');
              // Refresh settlement data when settlement tab is clicked
              fetchSettlementData();
            }}
            className={`px-4 py-2 border-b-2 font-medium transition-colors ${
              activeTab === 'settlement'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Settlement
            </div>
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === 'persons' && (
          <div className="space-y-6">
            {/* Add Extra Person Form */}
            <div className="border rounded-lg p-4">
              <h3 className="text-lg font-medium mb-4">Add Extra Person</h3>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Name *</label>
                  <input
                    type="text"
                    value={newPersonName}
                    onChange={(e) => setNewPersonName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Person name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Type *</label>
                  <select
                    value={newPersonType}
                    onChange={(e) => setNewPersonType(e.target.value as 'adult' | 'child')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="adult">Adult</option>
                    <option value="child">Child</option>
                  </select>
                </div>
                {newPersonType === 'child' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Age</label>
                    <input
                      type="number"
                      value={newPersonAge}
                      onChange={(e) => setNewPersonAge(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Age"
                      min="0"
                      max="17"
                    />
                  </div>
                )}
                <div className="flex items-end">
                  <button aria-label="Add"
                    onClick={addExtraPerson}
                    disabled={isAddingPerson || !newPersonName.trim()}
                    className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isAddingPerson ? (
                      <Clock className="w-4 h-4 animate-spin" />
                    ) : (
                      <UserPlus className="w-4 h-4" />
                    )}
                    {isAddingPerson ? 'Adding...' : 'Add Person'}
                  </button>
                </div>
              </div>
            </div>

            {/* Extra Persons List */}
            {extraPersons.length > 0 && (
              <div className="bg-gradient-to-br from-gray-50 to-gray-100 border border-gray-200 rounded-xl shadow-sm p-6">
                <div className="flex justify-between items-center mb-6">
                  <div>
                    <h3 className="text-xl font-bold text-gray-900">Extra Persons</h3>
                    <p className="text-sm text-gray-600 mt-1">{extraPersons.length} additional {extraPersons.length === 1 ? 'guest' : 'guests'} added to booking</p>
                  </div>
                  <button
                    onClick={recalculateCharges}
                    disabled={isLoading}
                    className="bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white font-medium px-4 py-2.5 rounded-lg shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-all duration-200"
                  >
                    <Calculator className="w-4 h-4" />
                    Recalculate Charges
                  </button>
                </div>

                <div className="space-y-4">
                  {extraPersons.map((person, index) => {
                    const personCharge = charges.find(c => c.personId === person.personId);

                    return (
                      <div key={person.personId || index} className="group bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md transition-all duration-200">
                        <div className="p-4">
                          <div className="flex items-start justify-between gap-4">
                            {/* Person Info */}
                            <div className="flex items-start gap-3 flex-1">
                              <div className="mt-1 flex-shrink-0 w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center shadow-sm">
                                <User className="w-5 h-5 text-white" />
                              </div>
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <h4 className="font-semibold text-gray-900 text-base">{person.name}</h4>
                                  <span className="px-2.5 py-0.5 bg-gray-100 text-gray-700 text-xs font-medium rounded-full">
                                    {person.type === 'child' ? `Child${person.age ? ` (${person.age}y)` : ''}` : 'Adult'}
                                  </span>
                                </div>

                                {/* Charge Details */}
                                {personCharge && (
                                  <div className="mt-3">
                                    {/* PENDING STATUS */}
                                    {personCharge.status === 'pending' && (
                                      <div className="bg-gradient-to-br from-amber-50 to-yellow-50 border-2 border-amber-200 rounded-xl p-4 space-y-3">
                                        <div className="flex items-start justify-between">
                                          <div className="flex-1">
                                            <div className="flex items-baseline gap-2 mb-1">
                                              <span className="text-xs font-medium text-gray-600 uppercase tracking-wide">Calculated Price</span>
                                            </div>
                                            <div className="flex items-baseline gap-2">
                                              <p className="text-2xl font-bold text-gray-900">₹{personCharge.calculatedAmount?.toLocaleString()}</p>
                                            </div>

                                            {personCharge.adjustedAmount && personCharge.adjustedAmount !== personCharge.calculatedAmount && (
                                              <div className="mt-2 space-y-1">
                                                <div className="flex items-center gap-2">
                                                  <p className="text-sm text-gray-500 line-through">₹{personCharge.calculatedAmount?.toLocaleString()}</p>
                                                  <span className="text-xs text-gray-400">→</span>
                                                  <p className="text-base font-bold text-blue-600">₹{personCharge.adjustedAmount?.toLocaleString()}</p>
                                                </div>
                                                {personCharge.adjustmentReason && (
                                                  <div className="bg-white/60 rounded-lg px-3 py-2 border border-amber-200/50">
                                                    <p className="text-xs text-gray-600 italic leading-relaxed">{personCharge.adjustmentReason}</p>
                                                  </div>
                                                )}
                                              </div>
                                            )}
                                          </div>
                                          <span className="inline-flex items-center px-3 py-1.5 bg-amber-100 text-amber-800 text-xs font-semibold rounded-full shadow-sm">
                                            <Clock className="w-3 h-3 mr-1.5" />
                                            Pending Approval
                                          </span>
                                        </div>

                                        <div className="grid grid-cols-2 gap-2 pt-2">
                                          <button
                                            onClick={() => openEditPriceModal(personCharge)}
                                            className="bg-white hover:bg-blue-50 text-blue-700 font-medium px-4 py-2.5 rounded-lg border-2 border-blue-200 hover:border-blue-300 transition-all duration-200 flex items-center justify-center gap-2 shadow-sm hover:shadow"
                                            disabled={isApproving}
                                          >
                                            <Edit className="w-4 h-4" />
                                            <span>Edit Price</span>
                                          </button>
                                          <button aria-label="Lock"
                                            onClick={() => approveCharge(personCharge.personId)}
                                            className="bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white font-medium px-4 py-2.5 rounded-lg transition-all duration-200 flex items-center justify-center gap-2 shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                                            disabled={isApproving}
                                          >
                                            {isApproving ? (
                                              <>
                                                <Clock className="w-4 h-4 animate-spin" />
                                                <span>Applying...</span>
                                              </>
                                            ) : (
                                              <>
                                                <CheckCircle className="w-4 h-4" />
                                                <span>Apply Charges</span>
                                              </>
                                            )}
                                          </button>
                                        </div>
                                      </div>
                                    )}

                                    {/* APPLIED STATUS */}
                                    {personCharge.status === 'applied' && (
                                      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-xl p-4">
                                        <div className="flex items-center justify-between mb-2">
                                          <div>
                                            <span className="text-xs font-medium text-gray-600 uppercase tracking-wide block mb-1">Charge Amount</span>
                                            <p className="text-2xl font-bold text-gray-900">₹{personCharge.totalCharge.toLocaleString()}</p>
                                          </div>
                                          {personCharge.isPaid ? (
                                            <span className="inline-flex items-center px-3 py-1.5 bg-green-100 text-green-800 text-xs font-semibold rounded-full shadow-sm">
                                              <CheckCircle className="w-3 h-3 mr-1.5" />
                                              Paid
                                            </span>
                                          ) : (
                                            <span className="inline-flex items-center px-3 py-1.5 bg-red-100 text-red-800 text-xs font-semibold rounded-full shadow-sm">
                                              <AlertCircle className="w-3 h-3 mr-1.5" />
                                              ₹{(personCharge.totalCharge - (personCharge.paidAmount || 0)).toLocaleString()} Due
                                            </span>
                                          )}
                                        </div>
                                        <p className="text-xs text-gray-600 bg-white/60 rounded-lg px-3 py-2">{personCharge.description}</p>
                                      </div>
                                    )}

                                    {/* PAID STATUS */}
                                    {personCharge.status === 'paid' && (
                                      <div className="bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-200 rounded-xl p-4">
                                        <div className="flex items-center justify-between mb-2">
                                          <div>
                                            <span className="text-xs font-medium text-gray-600 uppercase tracking-wide block mb-1">Paid Amount</span>
                                            <p className="text-2xl font-bold text-gray-900">₹{personCharge.totalCharge.toLocaleString()}</p>
                                          </div>
                                          <span className="inline-flex items-center px-3 py-1.5 bg-green-100 text-green-800 text-xs font-semibold rounded-full shadow-sm">
                                            <CheckCircle className="w-3 h-3 mr-1.5" />
                                            Paid
                                          </span>
                                        </div>
                                        <p className="text-xs text-gray-600 bg-white/60 rounded-lg px-3 py-2">{personCharge.description}</p>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Remove Button */}
                            <button aria-label="Delete"
                              onClick={() => removeExtraPerson(person.personId!, person.name)}
                              disabled={isLoading}
                              className="flex-shrink-0 mt-1 w-8 h-8 flex items-center justify-center text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                              title="Remove person"
                            >
                              <UserMinus className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {totalExtraCharges > 0 && (
                  <div className="mt-6 pt-6 border-t-2 border-gray-200">
                    <div className="bg-white rounded-xl border-2 border-gray-200 shadow-sm p-5 space-y-3">
                      <h4 className="font-bold text-gray-900 text-sm uppercase tracking-wide mb-3">Payment Summary</h4>

                      <div className="space-y-2">
                        <div className="flex justify-between items-center py-2 border-b border-gray-100">
                          <span className="text-gray-700 font-medium">Total Charges</span>
                          <span className="text-lg font-bold text-gray-900">₹{totalExtraCharges.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between items-center py-2 border-b border-gray-100">
                          <span className="text-gray-700 font-medium">Paid Amount</span>
                          <span className="text-lg font-bold text-green-600">₹{totalPaidCharges.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between items-center py-3 bg-gradient-to-r from-gray-50 to-gray-100 rounded-lg px-3 mt-2">
                          <span className="text-gray-900 font-bold">Remaining Due</span>
                          <span className={`text-xl font-bold ${totalUnpaidCharges > 0 ? 'text-red-600' : 'text-green-600'}`}>
                            ₹{totalUnpaidCharges.toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Pending Charges Notice */}
                    {pendingCharges.length > 0 && (
                      <div className="mt-4 bg-gradient-to-br from-amber-50 to-yellow-50 border-2 border-amber-200 rounded-xl p-4 shadow-sm">
                        <div className="flex items-start gap-3">
                          <div className="flex-shrink-0 w-8 h-8 bg-amber-100 rounded-full flex items-center justify-center">
                            <AlertCircle className="w-4 h-4 text-amber-700" />
                          </div>
                          <div className="flex-1">
                            <p className="text-sm font-semibold text-amber-900">
                              {pendingCharges.length} charge{pendingCharges.length > 1 ? 's' : ''} pending approval
                            </p>
                            <p className="text-xs text-amber-700 mt-1 leading-relaxed">
                              These charges must be approved before they can be paid
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div className={`grid gap-3 mt-4 ${totalUnpaidCharges > 0 ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1'}`}>
                      {totalUnpaidCharges > 0 && (
                        <button
                          onClick={() => {
                            // Prepare payment charges data for unpaid charges only
                            const paymentData: ExtraPersonChargePayment[] = unpaidCharges.map(charge => ({
                              personId: charge.personId,
                              amount: charge.totalCharge - (charge.paidAmount || 0),
                              description: charge.description
                            }));
                            setPaymentCharges(paymentData);
                            setShowPaymentModal(true);
                          }}
                          className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-semibold px-5 py-3.5 rounded-xl shadow-md hover:shadow-lg flex items-center justify-center gap-2 transition-all duration-200"
                        >
                          <CreditCard className="w-5 h-5" />
                          <span>Process Payment (₹{totalUnpaidCharges.toLocaleString()})</span>
                        </button>
                      )}

                      {totalUnpaidCharges === 0 && totalPaidCharges > 0 && (
                        <div className="bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-200 rounded-xl p-4 flex items-center justify-center gap-2 shadow-sm">
                          <CheckCircle className="w-5 h-5 text-green-600" />
                          <span className="text-green-800 font-semibold">All charges have been paid ✓</span>
                        </div>
                      )}

                      <button aria-label="Lock"
                        onClick={() => {
                          generateSupplementaryInvoice();
                        }}
                        disabled={isGeneratingInvoice}
                        className="bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white font-semibold px-5 py-3.5 rounded-xl shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all duration-200"
                      >
                        {isGeneratingInvoice ? (
                          <>
                            <Clock className="w-5 h-5 animate-spin" />
                            <span>Generating...</span>
                          </>
                        ) : (
                          <>
                            <Receipt className="w-5 h-5" />
                            <span>Generate Invoice</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === 'settlement' && (
          <div className="space-y-6">
            {settlement && (
              <>
                {/* Settlement Charges List */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-medium">Settlement Adjustments ({settlement.adjustments?.length || 0})</h3>
                    <button className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors">
                      Recalculate Settlement
                    </button>
                  </div>

                  {/* Settlement Items */}
                  <div className="space-y-3">
                    {settlement.adjustments && settlement.adjustments.length > 0 ? (
                      settlement.adjustments.map((adjustment, index) => {
                        // Smart settlement payment logic: handle overpayment situations
                        const settlementPayments = settlement.settlementHistory?.filter(h => h.action === 'payment_received') || [];
                        const totalPaid = settlementPayments.reduce((sum, payment) => sum + (payment.amount || 0), 0);
                        const finalAmount = settlement.finalAmount || 0;

                        // If total payments exceed final amount significantly, there might be historical overpayment
                        const hasSignificantOverpayment = totalPaid > (finalAmount * 1.5); // 50% overpayment threshold

                        let actualOutstanding;
                        let isFullyPaid;
                        let calculatedOutstanding;
                        let shouldTrustBackend;

                        if (hasSignificantOverpayment) {
                          // For overpayment scenarios, trust backend status more than calculation
                          actualOutstanding = settlement.outstandingBalance || 0;
                          isFullyPaid = settlement.status === 'completed' || settlement.outstandingBalance === 0;
                          calculatedOutstanding = Math.max(0, finalAmount - totalPaid); // For logging
                          shouldTrustBackend = false; // Using backend status instead
                        } else {
                          // For normal scenarios, use smart calculation
                          calculatedOutstanding = Math.max(0, finalAmount - totalPaid);
                          shouldTrustBackend = Math.abs((settlement.outstandingBalance || 0) - calculatedOutstanding) < 1;

                          actualOutstanding = shouldTrustBackend ? settlement.outstandingBalance : calculatedOutstanding;
                          isFullyPaid = actualOutstanding === 0 || settlement.status === 'completed';
                        }


                        return (
                          <div key={`item-${index}`} className="flex items-center justify-between p-3 border rounded-lg">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                                <span className="text-sm text-gray-600">{index + 1}</span>
                              </div>
                              <div>
                                <p className="font-medium capitalize">{adjustment.type?.replace('_', ' ') || 'Settlement Charge'}</p>
                                <p className="text-sm text-gray-600">{adjustment.description}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="text-lg font-bold text-green-600">
                                ₹{adjustment.amount?.toLocaleString()}
                              </span>
                              {isFullyPaid ? (
                                <span className="text-green-600 font-medium">Paid ✓</span>
                              ) : (
                                <span className="text-red-600 font-medium">₹{adjustment.amount?.toLocaleString()} Due</span>
                              )}
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="text-center py-8 text-gray-500">
                        <p>No settlement adjustments</p>
                      </div>
                    )}
                  </div>

                  {/* Settlement Summary */}
                  {settlement.adjustments && settlement.adjustments.length > 0 && (
                    <div className="border-t pt-4 space-y-2">
                      {(() => {
                        // Calculate actual payments from history
                        const settlementPayments = settlement.settlementHistory?.filter(h => h.action === 'payment_received') || [];
                        const actualPaidAmount = settlementPayments.reduce((sum, payment) => sum + (payment.amount || 0), 0);
                        const finalAmount = settlement.finalAmount || 0;

                        // Use same overpayment detection logic as individual items
                        const hasSignificantOverpayment = actualPaidAmount > (finalAmount * 1.5); // 50% overpayment threshold

                        let actualRemainingDue;

                        if (hasSignificantOverpayment) {
                          // For overpayment scenarios, trust backend status more than calculation
                          actualRemainingDue = settlement.outstandingBalance || 0;
                        } else {
                          // Normal calculation: remaining = total - paid
                          const calculatedOutstanding = Math.max(0, finalAmount - actualPaidAmount);
                          const shouldTrustBackend = Math.abs((settlement.outstandingBalance || 0) - calculatedOutstanding) < 1;
                          actualRemainingDue = shouldTrustBackend ? settlement.outstandingBalance : calculatedOutstanding;
                        }


                        return (
                          <>
                            <div className="flex justify-between text-lg">
                              <span>Total Charges:</span>
                              <span className="font-bold">₹{settlement.finalAmount?.toLocaleString() || 0}</span>
                            </div>
                            <div className="flex justify-between text-lg">
                              <span>Paid Amount:</span>
                              <span className="font-bold text-green-600">
                                ₹{actualPaidAmount.toLocaleString()}
                              </span>
                            </div>
                            <div className="flex justify-between text-lg">
                              <span>Remaining Due:</span>
                              <span className="font-bold text-red-600">₹{actualRemainingDue.toLocaleString()}</span>
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  )}

                  {/* Payment Status */}
                  {settlement.adjustments && settlement.adjustments.length > 0 && (
                    <>
                      {(() => {
                        // Use same smart logic for button display
                        const settlementPayments = settlement.settlementHistory?.filter(h => h.action === 'payment_received') || [];
                        const actualPaidAmount = settlementPayments.reduce((sum, payment) => sum + (payment.amount || 0), 0);
                        const finalAmount = settlement.finalAmount || 0;

                        // Use same overpayment detection logic as individual items and summary
                        const hasSignificantOverpayment = actualPaidAmount > (finalAmount * 1.5); // 50% overpayment threshold

                        let actualRemainingDue;
                        let isFullyPaidCalculated;

                        if (hasSignificantOverpayment) {
                          // For overpayment scenarios, trust backend status more than calculation
                          actualRemainingDue = settlement.outstandingBalance || 0;
                          isFullyPaidCalculated = settlement.status === 'completed' || settlement.outstandingBalance === 0;
                        } else {
                          // Normal calculation: remaining = total - paid
                          const calculatedOutstanding = Math.max(0, finalAmount - actualPaidAmount);
                          const shouldTrustBackend = Math.abs((settlement.outstandingBalance || 0) - calculatedOutstanding) < 1;
                          actualRemainingDue = shouldTrustBackend ? settlement.outstandingBalance : calculatedOutstanding;
                          isFullyPaidCalculated = actualRemainingDue === 0;
                        }

                        return isFullyPaidCalculated ? (
                          <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                            <div className="flex items-center justify-center gap-2 text-green-800">
                              <CheckCircle className="w-5 h-5" />
                              <span className="font-medium">All charges have been paid ✓</span>
                            </div>
                          </div>
                        ) : (
                          <button
                            onClick={() => {
                              const settlementCharges = [{
                                adjustmentId: 'settlement_outstanding',
                                amount: actualRemainingDue,
                                description: `Settlement payment for booking ${booking.bookingNumber}`,
                                type: 'settlement_payment'
                              }];
                              setPaymentCharges(settlementCharges);
                              setShowPaymentModal(true);
                            }}
                            className="w-full bg-blue-600 text-white px-4 py-3 rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2 transition-colors"
                          >
                            <CreditCard className="w-5 h-5" />
                            Process Payment (₹{actualRemainingDue.toLocaleString()})
                          </button>
                        );
                      })()}
                    </>
                  )}
                </div>

                {/* Add Adjustment Form */}
                <div className="border rounded-lg p-4">
                  <h3 className="text-lg font-medium mb-4">Add Settlement Adjustment</h3>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Type</label>
                      <select
                        value={adjustmentType}
                        onChange={(e) => setAdjustmentType(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="">Select type</option>
                        <option value="damage_charge">Damage Charge</option>
                        <option value="minibar_charge">Minibar Charge</option>
                        <option value="service_charge">Service Charge</option>
                        <option value="discount">Discount</option>
                        <option value="penalty">Penalty</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Amount</label>
                      <input
                        type="number"
                        value={adjustmentAmount}
                        onChange={(e) => setAdjustmentAmount(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Amount"
                        step="0.01"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                      <input
                        type="text"
                        value={adjustmentDescription}
                        onChange={(e) => setAdjustmentDescription(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Description"
                      />
                    </div>
                    <div className="flex items-end">
                      <button aria-label="Add"
                        onClick={addSettlementAdjustment}
                        disabled={isAddingAdjustment || !adjustmentType || !adjustmentAmount || !adjustmentDescription.trim()}
                        className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                      >
                        {isAddingAdjustment ? (
                          <Clock className="w-4 h-4 animate-spin" />
                        ) : (
                          <IndianRupee className="w-4 h-4" />
                        )}
                        {isAddingAdjustment ? 'Adding...' : 'Add Adjustment'}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Generate Settlement Invoice Button */}
                {settlement.adjustments && settlement.adjustments.length > 0 && (
                  <div className="border-t pt-4">
                    <button aria-label="Lock"
                      onClick={generateSettlementInvoice}
                      disabled={isGeneratingSettlementInvoice}
                      className="w-full bg-purple-600 text-white px-4 py-3 rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
                    >
                      {isGeneratingSettlementInvoice ? (
                        <>
                          <Clock className="w-5 h-5 animate-spin" />
                          Generating Settlement Invoice...
                        </>
                      ) : (
                        <>
                          <Receipt className="w-5 h-5" />
                          Generate Settlement Invoice
                        </>
                      )}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Multi-Payment Modal */}
      <MultiPaymentExtraPersonCharges
        isOpen={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        bookingId={booking._id}
        extraPersonCharges={paymentCharges}
        onPaymentSuccess={(paymentDetails: { paymentMethods: PaymentMethod[] }) => {
          setSuccess(`Payment processed successfully! Paid via ${paymentDetails.paymentMethods.map(p => p.method).join(', ')}`);

          const totalPaidAmount = paymentDetails.paymentMethods.reduce((sum, p) => sum + p.amount, 0);
          const isSettlementPayment = paymentCharges.some(charge => charge.type === 'settlement_payment');

          if (isSettlementPayment) {
            // Immediately update local settlement state for instant UI feedback
            const currentOutstanding = settlement?.outstandingBalance || 0;
            const newOutstanding = Math.max(0, currentOutstanding - totalPaidAmount);


            setSettlement(prev => {
              const updated = prev ? {
                ...prev,
                outstandingBalance: newOutstanding,
                status: newOutstanding === 0 ? 'completed' : 'partial'
              } : null;

              return updated;
            });

            // Also refresh from backend to ensure accuracy
            if (successTimerRef.current) clearTimeout(successTimerRef.current);
            successTimerRef.current = setTimeout(() => {
              fetchSettlementData();
            }, 500);

            // TEMPORARY FIX: If we know settlement should be completed, force the status
            if (newOutstanding === 0) {
              if (successTimerRef.current) clearTimeout(successTimerRef.current);
              successTimerRef.current = setTimeout(() => {
                setSettlement(prev => prev ? {
                  ...prev,
                  outstandingBalance: 0,
                  status: 'completed'
                } : null);
              }, 1000);
            }

            // Also trigger parent component update
            if (successTimerRef.current) clearTimeout(successTimerRef.current);
            successTimerRef.current = setTimeout(() => {
              if (onBookingUpdated) {
                // This will update the upcoming bookings list
                const refreshedBooking = { ...booking, settlementTracking: { ...settlement, outstandingBalance: newOutstanding, status: newOutstanding === 0 ? 'completed' : 'partial' } };
                onBookingUpdated(refreshedBooking);
              }
            }, 800);

            // Close payment modal to show updated settlement status
            setShowPaymentModal(false);
          }

          // Refresh booking data for parent component
          if (onBookingUpdated) {
            let updatedBooking = { ...booking };

            if (isSettlementPayment) {
              // Update settlement tracking
              const currentOutstanding = settlement?.outstandingBalance || 0;
              const newOutstanding = Math.max(0, currentOutstanding - totalPaidAmount);

              updatedBooking.settlementTracking = {
                ...settlement,
                outstandingBalance: newOutstanding,
                status: newOutstanding === 0 ? 'completed' : 'partial'
              };
            } else {
              // Update extra person charges
              updatedBooking.extraPersonCharges = charges;
              updatedBooking.paymentStatus = 'paid';
            }

            updatedBooking.totalPaid = (booking.totalPaid || 0) + totalPaidAmount;
            onBookingUpdated(updatedBooking);
          }
        }}
      />

      {/* Edit Price Modal */}
      {editingCharge && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold mb-4">Edit Extra Person Charge</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Person
                </label>
                <p className="text-gray-900 font-medium">
                  {extraPersons.find(p => p.personId === editingCharge.personId)?.name || 'Unknown'}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Calculated Price
                </label>
                <p className="text-gray-500">₹{editingCharge.calculatedAmount?.toLocaleString() || editingCharge.totalCharge?.toLocaleString()}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Adjusted Price *
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">₹</span>
                  <input
                    type="number"
                    value={editedAmount}
                    onChange={(e) => setEditedAmount(e.target.value)}
                    className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter adjusted price"
                    step="0.01"
                    min="0"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Reason for Adjustment *
                </label>
                <textarea
                  value={editReason}
                  onChange={(e) => setEditReason(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g., Loyalty discount, Special arrangement, Group discount"
                  rows={3}
                />
                <p className="text-xs text-gray-500 mt-1">
                  This reason will be saved for audit purposes
                </p>
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                onClick={() => {
                  setEditingCharge(null);
                  setEditedAmount('');
                  setEditReason('');
                }}
                className="flex-1 bg-gray-200 text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-300 transition-colors"
                disabled={isSavingEdit}
              >
                Cancel
              </button>
              <button aria-label="Edit"
                onClick={saveEditedPrice}
                disabled={!editedAmount || !editReason.trim() || isSavingEdit}
                className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
              >
                {isSavingEdit ? (
                  <>
                    <Clock className="w-4 h-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Changes'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}

export { BookingEditModal };
export default withErrorBoundary(BookingEditModal, { level: 'component' });