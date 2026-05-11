import React, { useState, useEffect } from 'react';
import { Search, Filter, Plus, Eye, DollarSign, Clock, AlertTriangle, CheckCircle, FileText, MessageCircle, TrendingUp, Calendar, Users, IndianRupee, CreditCard, Bell, Send, Zap, ShoppingCart, Package, ArrowRight } from 'lucide-react';
import { bookingEditingService } from '../../services/bookingEditingService';
import { Modal } from '../ui/Modal';
import { SettlementPayment } from '../payments/SettlementPayment';
import { api } from '../../services/api';
import { withErrorBoundary } from '../ErrorBoundary';

interface Settlement {
  _id: string;
  settlementNumber: string;
  status: 'pending' | 'partial' | 'completed' | 'overdue' | 'cancelled' | 'refunded';
  finalAmount: number;
  outstandingBalance: number;
  refundAmount: number;
  dueDate: string;
  escalationLevel: number;
  guestDetails: {
    guestName: string;
    guestEmail: string;
    guestPhone: string;
  };
  bookingDetails: {
    bookingNumber: string;
    checkInDate: string;
    checkOutDate: string;
    nights: number;
  };
  adjustments: Array<{
    type: string;
    amount: number;
    description: string;
    appliedAt: string;
  }>;
  payments: Array<{
    amount: number;
    method: string;
    processedAt: string;
  }>;
  communications: Array<{
    type: string;
    direction: string;
    subject: string;
    sentAt: string;
  }>;
  createdAt: string;
}

interface SettlementAnalytics {
  byStatus: Array<{
    status: string;
    count: number;
    totalAmount: number;
    totalOutstanding: number;
  }>;
  totalSettlements: number;
  totalValue: number;
  totalOutstanding: number;
}

const getSettlementStatusColor = (status: string) => {
  const colors: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-800',
    partial: 'bg-blue-100 text-blue-800',
    completed: 'bg-green-100 text-green-800',
    overdue: 'bg-red-100 text-red-800',
    cancelled: 'bg-gray-100 text-gray-800',
    refunded: 'bg-purple-100 text-purple-800'
  };
  return colors[status] || 'bg-gray-100 text-gray-800';
};

const getSettlementEscalationColor = (level: number) => {
  if (level >= 3) return 'bg-red-100 text-red-800';
  if (level === 2) return 'bg-orange-100 text-orange-800';
  if (level === 1) return 'bg-yellow-100 text-yellow-800';
  return 'bg-green-100 text-green-800';
};

const SettlementRowInfo = React.memo(({ settlement }: { settlement: Settlement }) => (
  <>
    <td className="px-6 py-4">
      <div>
        <p className="text-sm font-medium text-gray-900">{settlement.settlementNumber}</p>
        <p className="text-sm text-gray-500">{settlement.bookingDetails.bookingNumber}</p>
      </div>
    </td>
    <td className="px-6 py-4">
      <div>
        <p className="text-sm font-medium text-gray-900">{settlement.guestDetails.guestName}</p>
        <p className="text-sm text-gray-500">{settlement.guestDetails.guestEmail}</p>
      </div>
    </td>
    <td className="px-6 py-4">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getSettlementStatusColor(settlement.status)}`}>
            {settlement.status}
          </span>
        </div>
        <p className="text-sm text-gray-900">{'\u20B9'}{settlement.finalAmount.toLocaleString()}</p>
        {settlement.outstandingBalance > 0 && (
          <p className="text-sm text-red-600">Outstanding: {'\u20B9'}{settlement.outstandingBalance.toLocaleString()}</p>
        )}
        {settlement.refundAmount > 0 && (
          <p className="text-sm text-green-600">Refund: {'\u20B9'}{settlement.refundAmount.toLocaleString()}</p>
        )}
      </div>
    </td>
    <td className="px-6 py-4">
      <p className="text-sm text-gray-900">
        {new Date(settlement.dueDate).toLocaleDateString()}
      </p>
      {new Date(settlement.dueDate) < new Date() && settlement.status !== 'completed' && (
        <p className="text-xs text-red-600">Overdue</p>
      )}
    </td>
    <td className="px-6 py-4">
      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getSettlementEscalationColor(settlement.escalationLevel)}`}>
        Level {settlement.escalationLevel}
      </span>
    </td>
  </>
));
SettlementRowInfo.displayName = 'SettlementRowInfo';

function SettlementManagement() {
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [analytics, setAnalytics] = useState<SettlementAnalytics | null>(null);
  const [overdueSettlements, setOverdueSettlements] = useState<Settlement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters and pagination
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [escalationFilter, setEscalationFilter] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(20);

  // Modal states
  const [selectedSettlement, setSelectedSettlement] = useState<Settlement | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [settlementForPayment, setSettlementForPayment] = useState<Settlement | null>(null);

  // Notification states
  const [isSendingNotifications, setIsSendingNotifications] = useState(false);
  const [notificationSuccess, setNotificationSuccess] = useState<string | null>(null);
  const [selectedSettlements, setSelectedSettlements] = useState<Set<string>>(new Set());
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isCommunicationModalOpen, setIsCommunicationModalOpen] = useState(false);

  // POS Integration states
  const [integrationReadyItems, setIntegrationReadyItems] = useState<unknown>(null);
  const [showIntegrationPanel, setShowIntegrationPanel] = useState(false);
  const [isIntegrating, setIsIntegrating] = useState(false);
  const [integrationStats, setIntegrationStats] = useState<unknown>(null);

  // Form states
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [paymentReference, setPaymentReference] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  const [communicationType, setCommunicationType] = useState<'email' | 'sms' | 'phone_call' | 'in_person'>('email');
  const [communicationSubject, setCommunicationSubject] = useState('');
  const [communicationMessage, setCommunicationMessage] = useState('');
  const [isSendingCommunication, setIsSendingCommunication] = useState(false);

  useEffect(() => {
    fetchSettlements();
    fetchAnalytics();
    fetchOverdueSettlements();
    fetchIntegrationReadyItems();
    fetchIntegrationStats();
  }, [statusFilter, escalationFilter, currentPage]);

  const fetchSettlements = async () => {
    try {
      setLoading(true);
      const filters: Record<string, string | number> = {
        limit: pageSize,
        offset: (currentPage - 1) * pageSize
      };

      if (statusFilter) filters.status = statusFilter;
      if (escalationFilter) filters.escalationLevel = parseInt(escalationFilter);

      const response = await bookingEditingService.getSettlements(filters);
      setSettlements(response.data.settlements);
    } catch (error: unknown) {
      const err = error as { message?: string };
      setError(err.message || 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const fetchAnalytics = async () => {
    try {
      const response = await bookingEditingService.getSettlementAnalytics();
      setAnalytics(response.data.analytics);
    } catch {
      // Error handled silently
    }
  };

  const fetchOverdueSettlements = async () => {
    try {
      const response = await bookingEditingService.getOverdueSettlements();
      setOverdueSettlements(response.data.overdueSettlements);
    } catch {
      // Error handled silently
    }
  };

  const fetchIntegrationReadyItems = async () => {
    try {
      const response = await api.get('/api/v1/pos-settlements/ready-for-integration');
      setIntegrationReadyItems(response.data.data);
    } catch {
      // Error handled silently
    }
  };

  const fetchIntegrationStats = async () => {
    try {
      const response = await api.get('/api/v1/pos-settlements/integration-stats');
      setIntegrationStats(response.data.data);
    } catch {
      // Error handled silently
    }
  };

  const handleBulkPOSIntegration = async () => {
    if (!integrationReadyItems) return;

    setIsIntegrating(true);
    try {
      const billingSessionIds = integrationReadyItems.billingSessions.items.map((item: { sessionId: string }) => item.sessionId);
      const checkoutInventoryIds = integrationReadyItems.checkoutInventories.items.map((item: { checkoutId: string }) => item.checkoutId);

      const response = await api.post('/api/v1/pos-settlements/bulk-integrate', {
        billingSessionIds,
        checkoutInventoryIds
      });

      // Refresh all data
      fetchSettlements();
      fetchAnalytics();
      fetchIntegrationReadyItems();
      fetchIntegrationStats();

      setShowIntegrationPanel(false);
      alert(`Integration completed: ${response.data.data.summary.successCount} successful, ${response.data.data.summary.errorCount} failed`);
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } }; message?: string };
      alert('Bulk integration failed: ' + (err.response?.data?.message || 'Please try again'));
    } finally {
      setIsIntegrating(false);
    }
  };

  const handlePaymentSubmit = async () => {
    if (!selectedSettlement || !paymentAmount || !paymentMethod) return;

    setIsProcessingPayment(true);
    try {
      await bookingEditingService.addPaymentToSettlement(selectedSettlement._id, {
        amount: parseFloat(paymentAmount),
        method: paymentMethod,
        reference: paymentReference,
        notes: paymentNotes
      });

      // Reset form and close modal
      setPaymentAmount('');
      setPaymentMethod('');
      setPaymentReference('');
      setPaymentNotes('');
      setIsPaymentModalOpen(false);

      // Refresh data
      fetchSettlements();
      fetchAnalytics();
    } catch (error: unknown) {
      const err = error as { message?: string };
      setError(err.message || 'Unknown error');
    } finally {
      setIsProcessingPayment(false);
    }
  };

  const handleCommunicationSubmit = async () => {
    if (!selectedSettlement || !communicationType || !communicationMessage) return;

    setIsSendingCommunication(true);
    try {
      await bookingEditingService.addCommunicationToSettlement(selectedSettlement._id, {
        type: communicationType,
        subject: communicationSubject,
        message: communicationMessage,
        direction: 'outbound'
      });

      // Reset form and close modal
      setCommunicationType('email');
      setCommunicationSubject('');
      setCommunicationMessage('');
      setIsCommunicationModalOpen(false);

      // Refresh settlements
      fetchSettlements();
    } catch (error: unknown) {
      const err = error as { message?: string };
      setError(err.message || 'Unknown error');
    } finally {
      setIsSendingCommunication(false);
    }
  };

  const escalateSettlement = async (settlement: Settlement) => {
    try {
      const reason = `Escalation due to overdue settlement - Level ${settlement.escalationLevel + 1}`;
      await bookingEditingService.escalateSettlement(settlement._id, reason);
      fetchSettlements();
    } catch (error: unknown) {
      const err = error as { message?: string };
      setError(err.message || 'Unknown error');
    }
  };

  const getStatusColor = (status: string) => {
    const colors = {
      pending: 'bg-yellow-100 text-yellow-800',
      partial: 'bg-blue-100 text-blue-800',
      completed: 'bg-green-100 text-green-800',
      overdue: 'bg-red-100 text-red-800',
      cancelled: 'bg-gray-100 text-gray-800',
      refunded: 'bg-purple-100 text-purple-800'
    };
    return colors[status as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  const getEscalationColor = (level: number) => {
    if (level === 0) return 'bg-green-100 text-green-800';
    if (level <= 2) return 'bg-yellow-100 text-yellow-800';
    if (level <= 4) return 'bg-orange-100 text-orange-800';
    return 'bg-red-100 text-red-800';
  };

  const filteredSettlements = settlements.filter(settlement =>
    settlement.guestDetails.guestName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    settlement.bookingDetails.bookingNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
    settlement.settlementNumber.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Settlement Management</h1>
          <p className="text-gray-600">Manage post-checkout settlements and outstanding balances</p>
        </div>
        <div className="flex items-center gap-3">
          {integrationReadyItems && integrationReadyItems.summary.totalItemsReady > 0 && (
            <button
              onClick={() => setShowIntegrationPanel(true)}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Package className="w-4 h-4" />
              POS Integration ({integrationReadyItems.summary.totalItemsReady})
            </button>
          )}
        </div>
      </div>

      {/* Analytics Cards */}
      {analytics && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg border p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <FileText className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Total Settlements</p>
                <p className="text-2xl font-bold text-gray-900">{analytics.totalSettlements}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg border p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <IndianRupee className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Total Value</p>
                <p className="text-2xl font-bold text-gray-900">₹{analytics.totalValue.toLocaleString()}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg border p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 rounded-lg">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Outstanding</p>
                <p className="text-2xl font-bold text-gray-900">₹{analytics.totalOutstanding.toLocaleString()}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg border p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 rounded-lg">
                <Clock className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Overdue</p>
                <p className="text-2xl font-bold text-gray-900">{overdueSettlements.length}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-lg border p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Search</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search settlements..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="partial">Partial</option>
              <option value="completed">Completed</option>
              <option value="overdue">Overdue</option>
              <option value="cancelled">Cancelled</option>
              <option value="refunded">Refunded</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Escalation Level</label>
            <select
              value={escalationFilter}
              onChange={(e) => setEscalationFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">All Levels</option>
              <option value="0">Level 0 - No Escalation</option>
              <option value="1">Level 1 - First Reminder</option>
              <option value="2">Level 2 - Second Reminder</option>
              <option value="3">Level 3 - Manager Review</option>
              <option value="4">Level 4 - Legal Notice</option>
              <option value="5">Level 5 - Collection Agency</option>
            </select>
          </div>

          <div className="flex items-end">
            <button
              onClick={() => {
                setStatusFilter('');
                setEscalationFilter('');
                setSearchTerm('');
                setCurrentPage(1);
              }}
              className="w-full bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Clear Filters
            </button>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center gap-2">
          <AlertTriangle className="w-5 h-5" />
          {error}
          <button aria-label="Close" onClick={() => setError(null)} className="ml-auto text-red-600 hover:text-red-800">×</button>
        </div>
      )}

      {/* Settlements Table */}
      <div className="bg-white rounded-lg border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Settlement Details
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Guest
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Amount & Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Due Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Escalation
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                    <div className="flex justify-center items-center gap-2">
                      <Clock className="w-5 h-5 animate-spin" />
                      Loading settlements...
                    </div>
                  </td>
                </tr>
              ) : filteredSettlements.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                    No settlements found matching your criteria
                  </td>
                </tr>
              ) : (
                filteredSettlements.map((settlement) => (
                  <tr key={settlement._id} className="hover:bg-gray-50">
                    <SettlementRowInfo settlement={settlement} />
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <button aria-label="View"
                          onClick={() => {
                            setSelectedSettlement(settlement);
                            setIsDetailsModalOpen(true);
                          }}
                          className="text-blue-600 hover:text-blue-800"
                          title="View Details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>

                        {settlement.outstandingBalance > 0 && (
                          <>
                            <button aria-label="Add"
                              onClick={() => {
                                setSelectedSettlement(settlement);
                                setIsPaymentModalOpen(true);
                              }}
                              className="text-green-600 hover:text-green-800"
                              title="Add Payment"
                            >
                              <DollarSign className="w-4 h-4" />
                            </button>
                            <button aria-label="Edit"
                              onClick={() => {
                                setSettlementForPayment(settlement);
                                setShowPaymentModal(true);
                              }}
                              className="text-blue-600 hover:text-blue-800"
                              title="Process Card Payment"
                            >
                              <CreditCard className="w-4 h-4" />
                            </button>
                          </>
                        )}

                        <button aria-label="Send"
                          onClick={() => {
                            setSelectedSettlement(settlement);
                            setIsCommunicationModalOpen(true);
                          }}
                          className="text-purple-600 hover:text-purple-800"
                          title="Send Communication"
                        >
                          <MessageCircle className="w-4 h-4" />
                        </button>

                        {settlement.status !== 'completed' && settlement.escalationLevel < 5 && (
                          <button aria-label="Close"
                            onClick={() => escalateSettlement(settlement)}
                            className="text-orange-600 hover:text-orange-800"
                            title="Escalate"
                          >
                            <TrendingUp className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Payment Modal */}
      <Modal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        title="Add Payment"
        size="md"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Amount *</label>
            <input
              type="number"
              value={paymentAmount}
              onChange={(e) => setPaymentAmount(e.target.value)}
              placeholder="Payment amount"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              min="0"
              step="0.01"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Payment Method *</label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
            >
              <option value="">Select method</option>
              <option value="cash">Cash</option>
              <option value="card">Card</option>
              <option value="upi">UPI</option>
              <option value="bank_transfer">Bank Transfer</option>
              <option value="refund_to_source">Refund to Source</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Reference</label>
            <input
              type="text"
              value={paymentReference}
              onChange={(e) => setPaymentReference(e.target.value)}
              placeholder="Transaction reference"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
            <textarea
              value={paymentNotes}
              onChange={(e) => setPaymentNotes(e.target.value)}
              placeholder="Payment notes"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-3">
            <button
              onClick={() => setIsPaymentModalOpen(false)}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
            >
              Cancel
            </button>
            <button aria-label="Add"
              onClick={handlePaymentSubmit}
              disabled={isProcessingPayment || !paymentAmount || !paymentMethod}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
            >
              {isProcessingPayment && <Clock className="w-4 h-4 animate-spin" />}
              {isProcessingPayment ? 'Processing...' : 'Add Payment'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Communication Modal */}
      <Modal
        isOpen={isCommunicationModalOpen}
        onClose={() => setIsCommunicationModalOpen(false)}
        title="Send Communication"
        size="md"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Type *</label>
            <select
              value={communicationType}
              onChange={(e) => setCommunicationType(e.target.value as unknown)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="email">Email</option>
              <option value="sms">SMS</option>
              <option value="phone_call">Phone Call</option>
              <option value="in_person">In Person</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Subject</label>
            <input
              type="text"
              value={communicationSubject}
              onChange={(e) => setCommunicationSubject(e.target.value)}
              placeholder="Communication subject"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Message *</label>
            <textarea
              value={communicationMessage}
              onChange={(e) => setCommunicationMessage(e.target.value)}
              placeholder="Communication message"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              rows={5}
              required
            />
          </div>

          <div className="flex justify-end gap-3">
            <button
              onClick={() => setIsCommunicationModalOpen(false)}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
            >
              Cancel
            </button>
            <button aria-label="Send"
              onClick={handleCommunicationSubmit}
              disabled={isSendingCommunication || !communicationMessage}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
            >
              {isSendingCommunication && <Clock className="w-4 h-4 animate-spin" />}
              {isSendingCommunication ? 'Sending...' : 'Send Communication'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Stripe Settlement Payment Modal */}
      {settlementForPayment && (
        <SettlementPayment
          isOpen={showPaymentModal}
          onClose={() => {
            setShowPaymentModal(false);
            setSettlementForPayment(null);
          }}
          settlement={{
            _id: settlementForPayment._id,
            bookingId: {
              _id: settlementForPayment.bookingDetails.bookingNumber, // This should be the actual booking ID
              bookingNumber: settlementForPayment.bookingDetails.bookingNumber
            },
            finalAmount: settlementForPayment.finalAmount,
            outstandingBalance: settlementForPayment.outstandingBalance,
            status: settlementForPayment.status
          }}
          onPaymentSuccess={() => {
            // Refresh settlements data
            fetchSettlements();
          }}
        />
      )}

      {/* POS Integration Panel */}
      <Modal
        isOpen={showIntegrationPanel}
        onClose={() => setShowIntegrationPanel(false)}
        title="POS Settlement Integration"
        size="lg"
      >
        <div className="space-y-6">
          {integrationReadyItems && (
            <>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-blue-900 mb-2">Integration Summary</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">{integrationReadyItems.billingSessions.count}</div>
                    <div className="text-sm text-blue-700">POS Sessions</div>
                    <div className="text-xs text-blue-600">₹{integrationReadyItems.summary.totalPOSAmount.toLocaleString()}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-orange-600">{integrationReadyItems.checkoutInventories.count}</div>
                    <div className="text-sm text-orange-700">Checkout Charges</div>
                    <div className="text-xs text-orange-600">₹{integrationReadyItems.summary.totalCheckoutCharges.toLocaleString()}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">₹{(integrationReadyItems.summary.totalPOSAmount + integrationReadyItems.summary.totalCheckoutCharges).toLocaleString()}</div>
                    <div className="text-sm text-green-700">Total Amount</div>
                    <div className="text-xs text-green-600">{integrationReadyItems.summary.totalItemsReady} items</div>
                  </div>
                </div>
              </div>

              {/* POS Sessions */}
              {integrationReadyItems.billingSessions.count > 0 && (
                <div>
                  <h4 className="text-md font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <ShoppingCart className="w-4 h-4" />
                    POS Billing Sessions ({integrationReadyItems.billingSessions.count})
                  </h4>
                  <div className="bg-gray-50 rounded-lg p-3 max-h-40 overflow-y-auto">
                    {integrationReadyItems.billingSessions.items.map((session: { sessionId: string; guestName: string; roomNumber: string; totalAmount: number; itemsCount: number }, index: number) => (
                      <div key={session.sessionId} className="flex justify-between items-center py-2 border-b border-gray-200 last:border-b-0">
                        <div>
                          <span className="font-medium">{session.sessionId}</span>
                          <span className="text-sm text-gray-600 ml-2">{session.guestName} - Room {session.roomNumber}</span>
                        </div>
                        <div className="text-right">
                          <div className="font-medium">₹{session.totalAmount.toLocaleString()}</div>
                          <div className="text-xs text-gray-500">{session.itemsCount} items</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Checkout Inventories */}
              {integrationReadyItems.checkoutInventories.count > 0 && (
                <div>
                  <h4 className="text-md font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <Package className="w-4 h-4" />
                    Checkout Damage Charges ({integrationReadyItems.checkoutInventories.count})
                  </h4>
                  <div className="bg-gray-50 rounded-lg p-3 max-h-40 overflow-y-auto">
                    {integrationReadyItems.checkoutInventories.items.map((checkout: { checkoutId: string; roomId?: { roomNumber: string }; totalAmount: number; chargeableItemsCount: number }, index: number) => (
                      <div key={checkout.checkoutId} className="flex justify-between items-center py-2 border-b border-gray-200 last:border-b-0">
                        <div>
                          <span className="font-medium">Checkout #{checkout.checkoutId.slice(-8)}</span>
                          <span className="text-sm text-gray-600 ml-2">Room {checkout.roomId?.roomNumber}</span>
                        </div>
                        <div className="text-right">
                          <div className="font-medium">₹{checkout.totalAmount.toLocaleString()}</div>
                          <div className="text-xs text-gray-500">{checkout.chargeableItemsCount} damage items</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4 border-t">
                <button
                  onClick={() => setShowIntegrationPanel(false)}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button aria-label="Next"
                  onClick={handleBulkPOSIntegration}
                  disabled={isIntegrating}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
                >
                  {isIntegrating && <Clock className="w-4 h-4 animate-spin" />}
                  {isIntegrating ? 'Integrating...' : 'Integrate All to Settlements'}
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </>
          )}
        </div>
      </Modal>
    </div>
  );
}

export { SettlementManagement };
export default withErrorBoundary(SettlementManagement, { level: 'component' });