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
  status: 'pending' | 'approved' | 'completed' | 'late';
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
  status: 'pending_request' | 'on_time' | 'late';
  has_requests: boolean;
}

const formatCurrency = (paise: number) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
  }).format(paise / 100);
};

export default function CheckoutPage() {
  const [checkouts, setCheckouts] = useState<CheckoutRequest[]>([]);
  const [pending, setPending] = useState<PendingCheckout[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'scheduled' | 'pending' | 'completed'>('scheduled');
  const [selectedCheckout, setSelectedCheckout] = useState<CheckoutRequest | null>(null);
  const [showLateModal, setShowLateModal] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [checkoutRes, pendingRes] = await Promise.all([
        fetch('/api/staff/checkouts', { credentials: 'include' }),
        fetch('/api/staff/checkouts/pending', { credentials: 'include' }),
      ]);

      if (checkoutRes.ok) {
        const data = await checkoutRes.json();
        setCheckouts(data.checkouts || []);
      }
      if (pendingRes.ok) {
        const data = await pendingRes.json();
        setPending(data.pending || []);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const approveCheckout = async (bookingId: string) => {
    try {
      const res = await fetch(`/api/staff/checkout/${bookingId}/approve`, {
        method: 'POST',
        credentials: 'include',
      });
      if (res.ok) {
        setCheckouts((prev) =>
          prev.map((c) => (c.booking_id === bookingId ? { ...c, status: 'approved' as const } : c))
        );
      }
    } catch (err) {
      console.error('Failed to approve checkout');
    }
  };

  const completeCheckout = async (bookingId: string) => {
    try {
      const res = await fetch(`/api/staff/checkout/${bookingId}/complete`, {
        method: 'POST',
        credentials: 'include',
      });
      if (res.ok) {
        setCheckouts((prev) =>
          prev.map((c) => (c.booking_id === bookingId ? { ...c, status: 'completed' as const } : c))
        );
      }
    } catch (err) {
      console.error('Failed to complete checkout');
    }
  };

  const approveLateCheckout = async (bookingId: string, hours: number) => {
    try {
      const res = await fetch(`/api/staff/checkout/${bookingId}/late`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hours }),
        credentials: 'include',
      });
      if (res.ok) {
        setCheckouts((prev) =>
          prev.map((c) => (c.booking_id === bookingId ? { ...c, status: 'late' as const } : c))
        );
        setShowLateModal(false);
        setSelectedCheckout(null);
      }
    } catch (err) {
      console.error('Failed to approve late checkout');
    }
  };

  const getStatusColor = (status: CheckoutRequest['status']) => {
    switch (status) {
      case 'pending':
        return 'bg-amber-100 text-amber-700';
      case 'approved':
        return 'bg-blue-100 text-blue-700';
      case 'completed':
        return 'bg-green-100 text-green-700';
      case 'late':
        return 'bg-purple-100 text-purple-700';
    }
  };

  const getPendingStatusColor = (status: PendingCheckout['status']) => {
    switch (status) {
      case 'pending_request':
        return 'bg-red-100 text-red-700';
      case 'on_time':
        return 'bg-green-100 text-green-700';
      case 'late':
        return 'bg-red-100 text-red-700';
    }
  };

  const scheduledCheckouts = checkouts.filter(
    (c) => c.status === 'pending' || c.status === 'approved' || c.status === 'late'
  );
  const completedCheckouts = checkouts.filter((c) => c.status === 'completed');

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center h-64">
        <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Checkout Management</h1>
        <p className="text-gray-500 mt-1">Manage guest checkouts and billing</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard label="Scheduled" value={scheduledCheckouts.length} color="bg-blue-100 text-blue-700" />
        <StatCard label="Pending Approval" value={checkouts.filter((c) => c.status === 'pending').length} color="bg-amber-100 text-amber-700" />
        <StatCard label="Completed" value={completedCheckouts.length} color="bg-green-100 text-green-700" />
        <StatCard
          label="Pending Requests"
          value={pending.filter((p) => p.has_requests).length}
          color="bg-red-100 text-red-700"
        />
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setActiveTab('scheduled')}
            className={`px-6 py-3 text-sm font-medium transition-colors ${
              activeTab === 'scheduled'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Scheduled ({scheduledCheckouts.length})
          </button>
          <button
            onClick={() => setActiveTab('pending')}
            className={`px-6 py-3 text-sm font-medium transition-colors ${
              activeTab === 'pending'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Pending Requests ({pending.length})
          </button>
          <button
            onClick={() => setActiveTab('completed')}
            className={`px-6 py-3 text-sm font-medium transition-colors ${
              activeTab === 'completed'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Completed ({completedCheckouts.length})
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {activeTab === 'scheduled' && (
            <div className="space-y-4">
              {scheduledCheckouts.length === 0 ? (
                <EmptyState message="No scheduled checkouts for today" />
              ) : (
                scheduledCheckouts.map((checkout) => (
                  <CheckoutCard
                    key={checkout.id}
                    checkout={checkout}
                    getStatusColor={getStatusColor}
                    onApprove={approveCheckout}
                    onComplete={completeCheckout}
                    onLateCheckout={() => {
                      setSelectedCheckout(checkout);
                      setShowLateModal(true);
                    }}
                  />
                ))
              )}
            </div>
          )}

          {activeTab === 'pending' && (
            <div className="space-y-4">
              {pending.length === 0 ? (
                <EmptyState message="No pending checkout requests" />
              ) : (
                pending.map((p) => (
                  <PendingCheckoutCard
                    key={p.id}
                    pending={p}
                    getStatusColor={getPendingStatusColor}
                  />
                ))
              )}
            </div>
          )}

          {activeTab === 'completed' && (
            <div className="space-y-4">
              {completedCheckouts.length === 0 ? (
                <EmptyState message="No completed checkouts today" />
              ) : (
                completedCheckouts.map((checkout) => (
                  <CheckoutCard
                    key={checkout.id}
                    checkout={checkout}
                    getStatusColor={getStatusColor}
                    onApprove={() => {}}
                    onComplete={() => {}}
                    onLateCheckout={() => {}}
                    showActions={false}
                  />
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* Late Checkout Modal */}
      {showLateModal && selectedCheckout && (
        <LateCheckoutModal
          checkout={selectedCheckout}
          onApprove={approveLateCheckout}
          onClose={() => {
            setShowLateModal(false);
            setSelectedCheckout(null);
          }}
        />
      )}
    </div>
  );
}

// Stat Card Component
function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className={`${color} rounded-xl p-4 text-center`}>
      <p className="text-3xl font-bold">{value}</p>
      <p className="text-sm font-medium opacity-80">{label}</p>
    </div>
  );
}

// Empty State Component
function EmptyState({ message }: { message: string }) {
  return (
    <div className="text-center py-12 text-gray-400">
      <p className="text-4xl mb-2">🚪</p>
      <p>{message}</p>
    </div>
  );
}

// Checkout Card Component
function CheckoutCard({
  checkout,
  getStatusColor,
  onApprove,
  onComplete,
  onLateCheckout,
  showActions = true,
}: {
  checkout: CheckoutRequest;
  getStatusColor: (status: CheckoutRequest['status']) => string;
  onApprove: (bookingId: string) => void;
  onComplete: (bookingId: string) => void;
  onLateCheckout: () => void;
  showActions?: boolean;
}) {
  return (
    <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
      <div className="flex flex-col md:flex-row md:items-center gap-4">
        {/* Guest Info */}
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <p className="text-lg font-semibold text-gray-900">{checkout.guest_name}</p>
            <span className={`px-2 py-0.5 rounded text-xs font-medium ${getStatusColor(checkout.status)}`}>
              {checkout.status.toUpperCase()}
            </span>
          </div>
          <div className="flex flex-wrap gap-4 text-sm text-gray-500">
            <span>Room {checkout.room_number}</span>
            <span>Ref: {checkout.booking_ref}</span>
            <span>
              Checkout: {new Date(checkout.checkout_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        </div>

        {/* Billing */}
        <div className="text-right">
          <p className="text-sm text-gray-500">Total Amount</p>
          <p className="text-xl font-bold text-gray-900">{formatCurrency(checkout.total_amount_paise)}</p>
          {checkout.pending_amount_paise > 0 && (
            <p className="text-sm text-red-600">
              Pending: {formatCurrency(checkout.pending_amount_paise)}
            </p>
          )}
        </div>

        {/* Actions */}
        {showActions && (
          <div className="flex gap-2">
            {checkout.status === 'pending' && (
              <>
                <button
                  onClick={onLateCheckout}
                  className="px-4 py-2 bg-purple-100 text-purple-700 rounded-lg text-sm font-medium hover:bg-purple-200"
                >
                  Late Checkout
                </button>
                <button
                  onClick={() => onApprove(checkout.booking_id)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
                >
                  Approve
                </button>
              </>
            )}
            {checkout.status === 'approved' && (
              <button
                onClick={() => onComplete(checkout.booking_id)}
                className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700"
              >
                Complete Checkout
              </button>
            )}
          </div>
        )}
      </div>

      {/* Special Requests */}
      {checkout.special_requests && (
        <div className="mt-4 p-3 bg-amber-50 rounded-lg">
          <p className="text-sm font-medium text-amber-800">Special Request:</p>
          <p className="text-sm text-amber-700">{checkout.special_requests}</p>
        </div>
      )}
    </div>
  );
}

// Pending Checkout Card Component
function PendingCheckoutCard({
  pending,
  getStatusColor,
}: {
  pending: PendingCheckout;
  getStatusColor: (status: PendingCheckout['status']) => string;
}) {
  return (
    <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <p className="font-semibold text-gray-900">{pending.guest_name}</p>
            <span className={`px-2 py-0.5 rounded text-xs font-medium ${getStatusColor(pending.status)}`}>
              {pending.status.replace('_', ' ').toUpperCase()}
            </span>
          </div>
          <div className="flex items-center gap-4 text-sm text-gray-500">
            <span>Room {pending.room_number}</span>
            <span>Ref: {pending.booking_ref}</span>
            <span>
              Scheduled: {new Date(pending.scheduled_checkout).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          </div>
        </div>

        {pending.has_requests && (
          <div className="flex items-center gap-2">
            <span className="bg-red-100 text-red-700 text-xs font-medium px-3 py-1 rounded-full">
              Has Requests
            </span>
            <button
              onClick={() => (window.location.href = `/staff/requests?room=${pending.room_number}`)}
              className="px-3 py-1 bg-gray-100 text-gray-700 text-sm rounded-lg hover:bg-gray-200"
            >
              View
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// Late Checkout Modal
function LateCheckoutModal({
  checkout,
  onApprove,
  onClose,
}: {
  checkout: CheckoutRequest;
  onApprove: (bookingId: string, hours: number) => void;
  onClose: () => void;
}) {
  const [hours, setHours] = useState(2);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Approve Late Checkout</h2>
          <p className="text-sm text-gray-500 mt-1">
            {checkout.guest_name} - Room {checkout.room_number}
          </p>
        </div>

        <div className="p-6">
          <label className="block text-sm font-medium text-gray-700 mb-4">
            Select extension time
          </label>
          <div className="grid grid-cols-3 gap-3">
            {[1, 2, 3, 4].map((h) => (
              <button
                key={h}
                onClick={() => setHours(h)}
                className={`px-4 py-3 rounded-lg text-center font-medium border-2 transition-colors ${
                  hours === h
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-200 text-gray-700 hover:border-gray-300'
                }`}
              >
                {h} hour{h > 1 ? 's' : ''}
              </button>
            ))}
          </div>

          <div className="mt-4 p-4 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-600">
              New checkout time:{' '}
              <span className="font-semibold text-gray-900">
                {new Date(
                  new Date(checkout.checkout_time).getTime() + hours * 60 * 60 * 1000
                ).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </p>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-200 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={() => onApprove(checkout.booking_id, hours)}
            className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
          >
            Approve
          </button>
        </div>
      </div>
    </div>
  );
}
