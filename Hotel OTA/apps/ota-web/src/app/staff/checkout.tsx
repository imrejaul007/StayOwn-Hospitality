'use client';

import { useState, useEffect } from 'react';

interface CheckoutRequest {
  id: string;
  booking_id: string;
  booking_ref: string;
  guest_name: string;
  guest_phone: string;
  room_number: string;
  check_in: string;
  check_out: string;
  checkout_time: string;
  actual_checkout?: string;
  status: 'pending' | 'approved' | 'completed' | 'late' | 'early';
  total_amount_paise: number;
  paid_amount_paise: number;
  pending_amount_paise: number;
  special_requests?: string;
}

interface PendingCheckout {
  id: string;
  booking_id: string;
  booking_ref: string;
  guest_name: string;
  room_number: string;
  scheduled_checkout: string;
  status: 'on_time' | 'pending_request' | 'late';
  has_requests: boolean;
}

export default function CheckoutPage() {
  const [checkoutRequests, setCheckoutRequests] = useState<CheckoutRequest[]>([]);
  const [pendingCheckouts, setPendingCheckouts] = useState<PendingCheckout[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedCheckout, setSelectedCheckout] = useState<CheckoutRequest | null>(null);
  const [tab, setTab] = useState<'requests' | 'pending'>('requests');
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    fetchCheckoutData();
  }, []);

  const fetchCheckoutData = async () => {
    try {
      const [requestsRes, pendingRes] = await Promise.all([
        fetch('/api/staff/checkouts', { credentials: 'include' }),
        fetch('/api/staff/checkouts/pending', { credentials: 'include' }),
      ]);

      if (requestsRes.ok) {
        const data = await requestsRes.json();
        setCheckoutRequests(data.checkouts || []);
      }

      if (pendingRes.ok) {
        const data = await pendingRes.json();
        setPendingCheckouts(data.pending || []);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const approveCheckout = async (bookingId: string) => {
    setProcessing(true);
    try {
      const res = await fetch(`/api/staff/checkout/${bookingId}/approve`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to approve checkout');
      await fetchCheckoutData();
      setSelectedCheckout(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setProcessing(false);
    }
  };

  const completeCheckout = async (bookingId: string) => {
    setProcessing(true);
    try {
      const res = await fetch(`/api/staff/checkout/${bookingId}/complete`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to complete checkout');
      await fetchCheckoutData();
      setSelectedCheckout(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setProcessing(false);
    }
  };

  const approveLateCheckout = async (bookingId: string, hours: number) => {
    setProcessing(true);
    try {
      const res = await fetch(`/api/staff/checkout/${bookingId}/late`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hours }),
      });
      if (!res.ok) throw new Error('Failed to approve late checkout');
      await fetchCheckoutData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setProcessing(false);
    }
  };

  const formatINR = (paise: number) => {
    return `₹${(paise / 100).toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-amber-100 text-amber-700';
      case 'approved':
        return 'bg-blue-100 text-blue-700';
      case 'completed':
        return 'bg-green-100 text-green-700';
      case 'late':
        return 'bg-red-100 text-red-700';
      case 'early':
        return 'bg-purple-100 text-purple-700';
      case 'on_time':
        return 'bg-green-100 text-green-700';
      case 'pending_request':
        return 'bg-amber-100 text-amber-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Checkout Management</h1>
        <p className="text-gray-500 text-sm mt-1">
          Manage guest checkouts, bill reviews, and late checkout approvals
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 mb-6 border-b border-gray-200">
        <button
          onClick={() => setTab('requests')}
          className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
            tab === 'requests'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Checkout Requests ({checkoutRequests.length})
        </button>
        <button
          onClick={() => setTab('pending')}
          className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
            tab === 'pending'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Scheduled ({pendingCheckouts.length})
        </button>
      </div>

      {/* Error banner */}
      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          {error}
          <button onClick={() => setError('')} className="ml-2 underline">Dismiss</button>
        </div>
      )}

      {/* Content */}
      {tab === 'requests' ? (
        <CheckoutRequestsTab
          requests={checkoutRequests}
          onSelect={setSelectedCheckout}
          getStatusBadge={getStatusBadge}
          formatDate={formatDate}
          formatTime={formatTime}
          formatINR={formatINR}
        />
      ) : (
        <ScheduledCheckoutsTab
          pending={pendingCheckouts}
          onApproveLate={approveLateCheckout}
          getStatusBadge={getStatusBadge}
          formatDate={formatDate}
          processing={processing}
        />
      )}

      {/* Checkout Detail Modal */}
      {selectedCheckout && (
        <CheckoutDetailModal
          checkout={selectedCheckout}
          onClose={() => setSelectedCheckout(null)}
          onApprove={approveCheckout}
          onComplete={completeCheckout}
          formatINR={formatINR}
          formatDate={formatDate}
          formatTime={formatTime}
          getStatusBadge={getStatusBadge}
          processing={processing}
        />
      )}
    </div>
  );
}

// Checkout Requests Tab
function CheckoutRequestsTab({
  requests,
  onSelect,
  getStatusBadge,
  formatDate,
  formatTime,
  formatINR,
}: {
  requests: CheckoutRequest[];
  onSelect: (r: CheckoutRequest) => void;
  getStatusBadge: (s: string) => string;
  formatDate: (d: string) => string;
  formatTime: (t: string) => string;
  formatINR: (p: number) => string;
}) {
  if (requests.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
        <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
          <span className="text-2xl">🚪</span>
        </div>
        <h3 className="font-medium text-gray-900">No checkout requests</h3>
        <p className="text-sm text-gray-500 mt-1">Guest checkout requests will appear here</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <table className="w-full">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Guest</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Room</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Check-out</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {requests.map((req) => (
            <tr key={req.id} className="hover:bg-gray-50">
              <td className="px-4 py-3">
                <p className="font-medium text-gray-900">{req.guest_name}</p>
                <p className="text-xs text-gray-500">{req.booking_ref}</p>
              </td>
              <td className="px-4 py-3 text-sm text-gray-600">{req.room_number}</td>
              <td className="px-4 py-3">
                <p className="text-sm text-gray-900">{formatDate(req.checkout_time)}</p>
                <p className="text-xs text-gray-500">{formatTime(req.checkout_time)}</p>
              </td>
              <td className="px-4 py-3">
                <p className="text-sm font-medium text-gray-900">{formatINR(req.total_amount_paise)}</p>
                {req.pending_amount_paise > 0 && (
                  <p className="text-xs text-red-600">Pending: {formatINR(req.pending_amount_paise)}</p>
                )}
              </td>
              <td className="px-4 py-3">
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${getStatusBadge(req.status)}`}>
                  {req.status.charAt(0).toUpperCase() + req.status.slice(1)}
                </span>
              </td>
              <td className="px-4 py-3">
                <button
                  onClick={() => onSelect(req)}
                  className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                >
                  Review
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Scheduled Checkouts Tab
function ScheduledCheckoutsTab({
  pending,
  onApproveLate,
  getStatusBadge,
  formatDate,
  processing,
}: {
  pending: PendingCheckout[];
  onApproveLate: (id: string, hours: number) => void;
  getStatusBadge: (s: string) => string;
  formatDate: (d: string) => string;
  processing: boolean;
}) {
  if (pending.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
        <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
          <span className="text-2xl">📅</span>
        </div>
        <h3 className="font-medium text-gray-900">No scheduled checkouts today</h3>
        <p className="text-sm text-gray-500 mt-1">Guests with checkouts today will appear here</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {pending.map((item) => (
        <div key={item.id} className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-start justify-between mb-3">
            <div>
              <p className="font-medium text-gray-900">{item.guest_name}</p>
              <p className="text-sm text-gray-500">Room {item.room_number}</p>
            </div>
            <span className={`text-xs px-2 py-1 rounded-full font-medium ${getStatusBadge(item.status)}`}>
              {item.status.replace('_', ' ')}
            </span>
          </div>

          <p className="text-sm text-gray-600 mb-3">
            Scheduled: {formatDate(item.scheduled_checkout)}
          </p>

          {item.has_requests && (
            <div className="flex items-center gap-1 text-xs text-orange-600 mb-3">
              <span className="w-1.5 h-1.5 bg-orange-500 rounded-full"></span>
              Has pending requests
            </div>
          )}

          {item.status === 'late' && (
            <div className="flex gap-2">
              <button
                onClick={() => onApproveLate(item.booking_id, 2)}
                disabled={processing}
                className="flex-1 px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                +2 hrs
              </button>
              <button
                onClick={() => onApproveLate(item.booking_id, 4)}
                disabled={processing}
                className="flex-1 px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                +4 hrs
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// Checkout Detail Modal
function CheckoutDetailModal({
  checkout,
  onClose,
  onApprove,
  onComplete,
  formatINR,
  formatDate,
  formatTime,
  getStatusBadge,
  processing,
}: {
  checkout: CheckoutRequest;
  onClose: () => void;
  onApprove: (id: string) => void;
  onComplete: (id: string) => void;
  formatINR: (p: number) => string;
  formatDate: (d: string) => string;
  formatTime: (t: string) => string;
  getStatusBadge: (s: string) => string;
  processing: boolean;
}) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-900">{checkout.guest_name}</h2>
              <p className="text-sm text-gray-500">Booking: {checkout.booking_ref}</p>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Room Info */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h4 className="text-sm font-medium text-gray-700 mb-2">Room Details</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-gray-500">Room</p>
                <p className="font-medium text-gray-900">{checkout.room_number}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Check-out</p>
                <p className="font-medium text-gray-900">{formatTime(checkout.checkout_time)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Check-in</p>
                <p className="font-medium text-gray-900">{formatDate(checkout.check_in)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Status</p>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getStatusBadge(checkout.status)}`}>
                  {checkout.status}
                </span>
              </div>
            </div>
          </div>

          {/* Bill Summary */}
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-3">Bill Summary</h4>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Total Amount</span>
                <span className="font-medium text-gray-900">{formatINR(checkout.total_amount_paise)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Paid Amount</span>
                <span className="font-medium text-green-600">{formatINR(checkout.paid_amount_paise)}</span>
              </div>
              {checkout.pending_amount_paise > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Pending Amount</span>
                  <span className="font-medium text-red-600">{formatINR(checkout.pending_amount_paise)}</span>
                </div>
              )}
              <div className="pt-2 border-t border-gray-200 flex justify-between">
                <span className="font-medium text-gray-900">Balance Due</span>
                <span className="font-bold text-gray-900">{formatINR(checkout.pending_amount_paise)}</span>
              </div>
            </div>
          </div>

          {/* Special Requests */}
          {checkout.special_requests && (
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">Special Requests</h4>
              <p className="text-sm text-gray-600 bg-blue-50 rounded-lg p-3">{checkout.special_requests}</p>
            </div>
          )}
        </div>

        <div className="p-6 border-t border-gray-200 bg-gray-50">
          <div className="flex gap-3">
            {checkout.status === 'pending' && (
              <>
                <button
                  onClick={() => onApprove(checkout.booking_id)}
                  disabled={processing || checkout.pending_amount_paise > 0}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50"
                >
                  Approve Checkout
                </button>
              </>
            )}
            {checkout.status === 'approved' && (
              <button
                onClick={() => onComplete(checkout.booking_id)}
                disabled={processing}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-50"
              >
                Complete & Check-out
              </button>
            )}
            <button
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-100"
            >
              Close
            </button>
          </div>
          {checkout.pending_amount_paise > 0 && checkout.status === 'pending' && (
            <p className="text-xs text-red-600 mt-2 text-center">
              Cannot approve checkout - pending payment required
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

