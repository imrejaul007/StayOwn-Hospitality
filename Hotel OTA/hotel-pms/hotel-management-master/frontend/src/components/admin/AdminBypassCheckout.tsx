import React, { useState, useEffect, useRef} from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  AlertTriangle,
  User,
  Home,
  Calendar,
  CreditCard,
  FileText,
  CheckCircle,
  Clock,
  Shield,
  DollarSign
} from 'lucide-react';
import { adminBypassService, CheckedInBooking, AdminBypassRequest } from '../../services/adminBypassService';
import { bypassApprovalService } from '../../services/bypassApprovalService';
import { LoadingSpinner } from '../LoadingSpinner';

const AdminBypassCheckout: React.FC = () => {
  const [bookings, setBookings] = useState<CheckedInBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [selectedBooking, setSelectedBooking] = useState<CheckedInBooking | null>(null);
  const [notes, setNotes] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'upi' | 'bank_transfer'>('cash');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pendingApproval, setPendingApproval] = useState<{
    workflowId: string;
    riskScore: number;
    approvalLevels: number;
    currentLevel: number;
    timeoutAt: string;
    reasons?: string[];
  } | null>(null);
  
  // Enhanced bypass form fields
  const [reasonCategory, setReasonCategory] = useState('system_failure');
  const [reasonDescription, setReasonDescription] = useState('');
  const [urgencyLevel, setUrgencyLevel] = useState<'low' | 'medium' | 'high' | 'critical'>('medium');
  const [estimatedLoss, setEstimatedLoss] = useState<number>(0);
  const [sensitiveNotes, setSensitiveNotes] = useState('');
  const [useEnhancedBypass, setUseEnhancedBypass] = useState(true);

  const successTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (successTimerRef.current) clearTimeout(successTimerRef.current);
    };
  }, []);

  useEffect(() => {
    fetchBookings();
  }, []);

  const fetchBookings = async () => {
    try {
      setLoading(true);
      const response = await adminBypassService.getCheckedInBookings();
      setBookings(response.data?.bookings || []);
      setError(null);
    } catch (err: unknown) {
      setError('Failed to fetch bookings: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  const handleBypassCheckout = async (booking: CheckedInBooking) => {
    if (useEnhancedBypass) {
      return handleEnhancedBypassCheckout(booking);
    }

    // Legacy bypass checkout
    if (!notes.trim()) {
      setError('Please enter notes explaining the reason for bypass checkout');
      return;
    }

    try {
      setProcessing(booking._id);
      setError(null);

      const bypassData: AdminBypassRequest = {
        bookingId: booking._id,
        notes: notes.trim(),
        paymentMethod
      };

      await adminBypassService.bypassCheckout(bypassData);
      
      setSuccess(`✅ Admin bypass checkout completed successfully for ${booking.guest.name}`);
      setSelectedBooking(null);
      resetForm();
      
      // Refresh the bookings list
      fetchBookings();
      
      // Clear success message after 5 seconds
      if (successTimerRef.current) clearTimeout(successTimerRef.current);
      successTimerRef.current = setTimeout(() => setSuccess(null), 5000);
      
    } catch (err: unknown) {
      setError('Failed to process bypass checkout: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setProcessing(null);
    }
  };

  const handleEnhancedBypassCheckout = async (booking: CheckedInBooking) => {
    if (!reasonDescription.trim()) {
      setError('Please enter a detailed reason for the bypass');
      return;
    }

    try {
      setProcessing(booking._id);
      setError(null);
      setPendingApproval(null);

      const bypassData = {
        bookingId: booking._id,
        reason: {
          category: reasonCategory,
          description: reasonDescription.trim(),
          urgencyLevel,
          sensitiveNotes: sensitiveNotes.trim() || undefined
        },
        financialImpact: {
          estimatedLoss: estimatedLoss || 0,
          currency: 'INR',
          impactCategory: estimatedLoss > 5000 ? 'high' : estimatedLoss > 1000 ? 'medium' : 'low'
        },
        paymentMethod,
        deviceFingerprint: generateDeviceFingerprint(),
        geolocation: await getCurrentLocation()
      };

      const response = await bypassApprovalService.enhancedBypassCheckout(bypassData);
      
      if (response.status === 'pending_approval') {
        setPendingApproval(response.data);
        setSuccess(`⏳ Bypass checkout requires approval. Workflow ID: ${response.data.workflowId}`);
      } else {
        setSuccess(`✅ Enhanced bypass checkout completed successfully for ${booking.guest.name}`);
        fetchBookings();
      }
      
      setSelectedBooking(null);
      resetForm();
      
      // Clear success message after 8 seconds for approval cases
      if (successTimerRef.current) clearTimeout(successTimerRef.current);
      successTimerRef.current = setTimeout(() => {
        setSuccess(null);
        setPendingApproval(null);
      }, 8000);
      
    } catch (err: unknown) {
      setError('Failed to process enhanced bypass checkout: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setProcessing(null);
    }
  };

  const resetForm = () => {
    setNotes('');
    setReasonDescription('');
    setSensitiveNotes('');
    setEstimatedLoss(0);
    setReasonCategory('system_failure');
    setUrgencyLevel('medium');
  };

  const generateDeviceFingerprint = () => {
    // Simple device fingerprinting
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    ctx?.fillText('Device fingerprint', 2, 2);
    
    return btoa(JSON.stringify({
      userAgent: navigator.userAgent,
      language: navigator.language,
      platform: navigator.platform,
      screen: `${screen.width}x${screen.height}`,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      canvas: canvas.toDataURL(),
      timestamp: Date.now()
    })).substring(0, 32);
  };

  const getCurrentLocation = (): Promise<unknown> => {
    return new Promise((resolve) => {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            resolve({
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              accuracy: position.coords.accuracy
            });
          },
          () => resolve(undefined),
          { timeout: 5000 }
        );
      } else {
        resolve(undefined);
      }
    });
  };

  const openBypassModal = (booking: CheckedInBooking) => {
    setSelectedBooking(booking);
    resetForm();
    setPaymentMethod('cash');
    setError(null);
  };

  const closeBypassModal = () => {
    setSelectedBooking(null);
    resetForm();
    setError(null);
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <LoadingSpinner />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="border-yellow-200 bg-yellow-50">
        <CardContent className="pt-6">
          <div className="flex items-center space-x-3">
            <AlertTriangle className="h-8 w-8 text-yellow-600" />
            <div>
              <h2 className="text-lg font-semibold text-yellow-800">Admin Bypass Checkout</h2>
              <p className="text-sm text-yellow-700">
                Emergency checkout option that bypasses the normal inventory check process.
                Use only for special cases and always provide detailed notes.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Success Message */}
      {success && (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <p className="text-green-800">{success}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Pending Approval Notification */}
      {pendingApproval && (
        <Card className="border-yellow-200 bg-yellow-50">
          <CardContent className="pt-6">
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Clock className="h-5 w-5 text-yellow-600" />
                <h3 className="font-semibold text-yellow-800">Approval Required</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-yellow-700">
                <div>
                  <p><strong>Workflow ID:</strong> {pendingApproval.workflowId}</p>
                  <p><strong>Risk Score:</strong> {pendingApproval.riskScore}</p>
                  <p><strong>Approval Levels:</strong> {pendingApproval.approvalLevels}</p>
                </div>
                <div>
                  <p><strong>Current Level:</strong> {pendingApproval.currentLevel}</p>
                  <p><strong>Timeout:</strong> {new Date(pendingApproval.timeoutAt).toLocaleString()}</p>
                  <p><strong>Reasons:</strong> {pendingApproval.reasons?.join(', ')}</p>
                </div>
              </div>
              <Alert className="border-yellow-300 bg-yellow-100">
                <Shield className="h-4 w-4 text-yellow-600" />
                <AlertDescription className="text-yellow-800">
                  This bypass request requires manager approval due to security or financial risk factors. 
                  You will be notified once the approval process is complete.
                </AlertDescription>
              </Alert>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Error Message */}
      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <p className="text-red-800">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Checked-in Bookings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Checked-in Bookings ({bookings.length})</span>
            <Button onClick={fetchBookings} size="sm" variant="outline">
              Refresh
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {bookings.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Home className="mx-auto h-12 w-12 mb-3 text-gray-400" />
              <p>No checked-in bookings available for bypass checkout</p>
            </div>
          ) : (
            <div className="space-y-4">
              {bookings.map((booking) => (
                <div
                  key={booking._id}
                  className="border rounded-lg p-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-4">
                        <div className="flex-1">
                          <h3 className="font-semibold text-gray-900">
                            {booking.guest.name}
                          </h3>
                          <div className="flex items-center space-x-4 mt-1 text-sm text-gray-600">
                            <span className="flex items-center">
                              <Home className="h-4 w-4 mr-1" />
                              Room {booking.room.number} ({booking.room.type})
                            </span>
                            <span className="flex items-center">
                              <Calendar className="h-4 w-4 mr-1" />
                              {booking.nights} night{booking.nights !== 1 ? 's' : ''}
                            </span>
                            <span className="flex items-center">
                              <CreditCard className="h-4 w-4 mr-1" />
                              ₹{booking.totalAmount?.toLocaleString('en-IN')}
                            </span>
                          </div>
                          <p className="text-sm text-gray-500 mt-1">
                            Booking: {booking.bookingNumber} | {booking.guest.email}
                          </p>
                        </div>
                        <div className="flex items-center space-x-3">
                          {booking.checkoutInventory ? (
                            <Badge
                              variant={
                                booking.checkoutInventory.status === 'paid'
                                  ? 'default'
                                  : booking.checkoutInventory.status === 'completed'
                                  ? 'secondary'
                                  : 'outline'
                              }
                            >
                              {booking.checkoutInventory.status}
                            </Badge>
                          ) : (
                            <Badge variant="outline">No Checkout</Badge>
                          )}
                          
                          {booking.canBypassCheckout && (
                            <Button
                              onClick={() => openBypassModal(booking)}
                              disabled={processing === booking._id}
                              variant="destructive"
                              size="sm"
                            >
                              {processing === booking._id ? 'Processing...' : 'Bypass Checkout'}
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Bypass Confirmation Modal */}
      {selectedBooking && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold mb-4 flex items-center">
              <AlertTriangle className="h-5 w-5 text-yellow-600 mr-2" />
              Confirm Bypass Checkout
            </h3>
            
            <div className="space-y-4">
              <div className="bg-gray-50 p-3 rounded">
                <p><strong>Guest:</strong> {selectedBooking.guest.name}</p>
                <p><strong>Room:</strong> {selectedBooking.room.number}</p>
                <p><strong>Booking:</strong> {selectedBooking.bookingNumber}</p>
              </div>

              {/* Bypass Type Toggle */}
              <div className="mb-4">
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={useEnhancedBypass}
                    onChange={(e) => setUseEnhancedBypass(e.target.checked)}
                    className="rounded border-gray-300"
                  />
                  <span className="text-sm font-medium text-gray-700">
                    Use Enhanced Bypass (with approval workflow)
                  </span>
                </label>
              </div>

              {useEnhancedBypass ? (
                <>
                  {/* Enhanced Bypass Form */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Reason Category
                      </label>
                      <select
                        value={reasonCategory}
                        onChange={(e) => setReasonCategory(e.target.value)}
                        className="w-full p-2 border border-gray-300 rounded-md"
                      >
                        <option value="emergency_medical">Emergency Medical</option>
                        <option value="system_failure">System Failure</option>
                        <option value="inventory_unavailable">Inventory Unavailable</option>
                        <option value="guest_complaint">Guest Complaint</option>
                        <option value="staff_shortage">Staff Shortage</option>
                        <option value="technical_issue">Technical Issue</option>
                        <option value="management_override">Management Override</option>
                        <option value="compliance_requirement">Compliance Requirement</option>
                        <option value="other">Other</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Urgency Level
                      </label>
                      <select
                        value={urgencyLevel}
                        onChange={(e) => setUrgencyLevel(e.target.value as 'low' | 'medium' | 'high' | 'critical')}
                        className="w-full p-2 border border-gray-300 rounded-md"
                      >
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                        <option value="critical">Critical</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <FileText className="h-4 w-4 inline mr-1" />
                      Detailed Reason (Required)
                    </label>
                    <textarea
                      value={reasonDescription}
                      onChange={(e) => setReasonDescription(e.target.value)}
                      placeholder="Enter detailed explanation for the bypass..."
                      className="w-full p-3 border border-gray-300 rounded-md resize-none h-24"
                      required
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Provide specific details about why this bypass is necessary
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        <DollarSign className="h-4 w-4 inline mr-1" />
                        Estimated Financial Impact (INR)
                      </label>
                      <input
                        type="number"
                        value={estimatedLoss}
                        onChange={(e) => setEstimatedLoss(Number(e.target.value))}
                        min="0"
                        step="0.01"
                        className="w-full p-2 border border-gray-300 rounded-md"
                        placeholder="0.00"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Payment Method
                      </label>
                      <select
                        value={paymentMethod}
                        onChange={(e) => setPaymentMethod(e.target.value as 'cash' | 'card' | 'upi' | 'bank_transfer')}
                        className="w-full p-2 border border-gray-300 rounded-md"
                      >
                        <option value="cash">Cash</option>
                        <option value="card">Card</option>
                        <option value="upi">UPI</option>
                        <option value="bank_transfer">Bank Transfer</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <Shield className="h-4 w-4 inline mr-1" />
                      Sensitive Notes (Optional, Encrypted)
                    </label>
                    <textarea
                      value={sensitiveNotes}
                      onChange={(e) => setSensitiveNotes(e.target.value)}
                      placeholder="Any sensitive information that needs to be encrypted..."
                      className="w-full p-3 border border-gray-300 rounded-md resize-none h-20"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      This information will be encrypted and only visible to authorized personnel
                    </p>
                  </div>
                </>
              ) : (
                <>
                  {/* Legacy Bypass Form */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Payment Method
                    </label>
                    <select
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value as 'cash' | 'card' | 'upi' | 'bank_transfer')}
                      className="w-full p-2 border border-gray-300 rounded-md"
                    >
                      <option value="cash">Cash</option>
                      <option value="card">Card</option>
                      <option value="upi">UPI</option>
                      <option value="bank_transfer">Bank Transfer</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <FileText className="h-4 w-4 inline mr-1" />
                      Reason for Bypass (Required)
                    </label>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Enter detailed reason for bypassing normal checkout process..."
                      className="w-full p-3 border border-gray-300 rounded-md resize-none h-24"
                      required
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Explain why normal inventory checkout cannot be completed
                    </p>
                  </div>
                </>
              )}

              {error && (
                <div className="text-red-600 text-sm bg-red-50 p-2 rounded">
                  {error}
                </div>
              )}

              <div className="flex space-x-3">
                <Button
                  onClick={() => handleBypassCheckout(selectedBooking)}
                  disabled={
                    processing === selectedBooking._id ||
                    (useEnhancedBypass ? !reasonDescription.trim() : !notes.trim())
                  }
                  variant="destructive"
                  className="flex-1"
                >
                  {processing === selectedBooking._id ? 'Processing...' : 
                   useEnhancedBypass ? 'Submit Enhanced Bypass' : 'Confirm Bypass'}
                </Button>
                <Button
                  onClick={closeBypassModal}
                  variant="outline"
                  className="flex-1"
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminBypassCheckout;