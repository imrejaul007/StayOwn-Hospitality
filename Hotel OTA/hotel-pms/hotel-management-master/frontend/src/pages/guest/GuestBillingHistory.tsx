import React, { useState, useEffect } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { cn } from '../../utils/cn';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Modal } from '@/components/ui/Modal';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import {
  billingHistoryService,
  BillingHistoryItem,
  BillingHistoryFilters
} from '../../services/billingHistoryService';
import { Download, Receipt, CreditCard, RefreshCw, Calendar, AlertCircle } from 'lucide-react';
import { withErrorBoundary } from '../../components/ErrorBoundary';

// Quick Stats Component for Guest View
interface QuickStatsProps {
  data: {
    totalSpent: number;
    totalInvoices: number;
    totalPayments: number;
    totalRefunds: number;
  };
  isLoading: boolean;
}

const QuickStats: React.FC<QuickStatsProps> = ({ data, isLoading }) => {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="p-4">
            <div className="animate-pulse">
              <div className="h-4 bg-gray-200 rounded mb-2"></div>
              <div className="h-6 bg-gray-200 rounded"></div>
            </div>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      <Card className="p-4">
        <div className="text-sm text-gray-600">Total Spent</div>
        <div className="text-xl font-bold text-gray-900">
          {billingHistoryService.formatCurrency(data.totalSpent)}
        </div>
      </Card>
      <Card className="p-4">
        <div className="text-sm text-gray-600">Invoices</div>
        <div className="text-xl font-bold text-blue-600">{data.totalInvoices}</div>
      </Card>
      <Card className="p-4">
        <div className="text-sm text-gray-600">Payments</div>
        <div className="text-xl font-bold text-green-600">{data.totalPayments}</div>
      </Card>
      <Card className="p-4">
        <div className="text-sm text-gray-600">Refunds</div>
        <div className="text-xl font-bold text-purple-600">{data.totalRefunds}</div>
      </Card>
    </div>
  );
};

// Guest Transaction Item Component
interface TransactionItemProps {
  item: BillingHistoryItem;
  onClick: (item: BillingHistoryItem) => void;
}

const TransactionItem: React.FC<TransactionItemProps> = ({ item, onClick }) => {
  const getTypeIcon = () => {
    switch (item.type) {
      case 'invoice':
        return <Receipt className="h-5 w-5 text-blue-500" />;
      case 'payment':
        return <CreditCard className="h-5 w-5 text-green-500" />;
      case 'refund':
        return <RefreshCw className="h-5 w-5 text-purple-500" />;
      case 'booking':
        return <Calendar className="h-5 w-5 text-orange-500" />;
      case 'checkout_charges':
        return <Receipt className="h-5 w-5 text-amber-600" />;
      default:
        return <Receipt className="h-5 w-5 text-gray-500" />;
    }
  };

  return (
    <Card 
      className="p-4 cursor-pointer hover:shadow-md transition-shadow"
      onClick={() => onClick(item)}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          {getTypeIcon()}
          <div>
            <div className="font-medium text-gray-900">
              {item.type === 'invoice' && item.invoiceNumber}
              {item.type === 'payment' && 'Payment'}
              {item.type === 'refund' && 'Refund'}
              {item.type === 'booking' && item.bookingNumber}
              {item.type === 'checkout_charges' && 'Checkout Charges'}
            </div>
            <div className="text-sm text-gray-600">
              {billingHistoryService.formatDate(item.date)}
            </div>
            {item.bookingNumber && (
              <div className="text-xs text-gray-500">
                Booking: {item.bookingNumber}
              </div>
            )}
          </div>
        </div>
        <div className="text-right">
          <div className={cn(
            "font-semibold",
            item.type === 'refund' ? 'text-green-600' : 'text-gray-900'
          )}>
            {item.type === 'refund' ? '+' : ''}
            {billingHistoryService.formatCurrency(item.amount, item.currency)}
          </div>
          <Badge
            variant={billingHistoryService.getStatusColor(item.status, item.type) as 'green' | 'blue' | 'orange' | 'red' | 'gray' | 'yellow' | 'purple'}
            className="text-xs"
          >
            {item.status}
          </Badge>
        </div>
      </div>
    </Card>
  );
};

// Detail Modal for Guest View
interface GuestDetailModalProps {
  item: BillingHistoryItem | null;
  isOpen: boolean;
  onClose: () => void;
}

const GuestDetailModal: React.FC<GuestDetailModalProps> = ({ item, isOpen, onClose }) => {
  if (!item) return null;

  const handleDownloadReceipt = async () => {
    try {
      const receiptContent = [
        '='.repeat(48),
        '              TRANSACTION RECEIPT',
        '='.repeat(48),
        '',
        `Type:            ${item.type.toUpperCase()}`,
        `Date:            ${billingHistoryService.formatDate(item.date)}`,
        `Amount:          ${billingHistoryService.formatCurrency(item.amount, item.currency)}`,
        `Status:          ${item.status}`,
        '',
        item.invoiceNumber ? `Invoice #:       ${item.invoiceNumber}` : '',
        item.bookingNumber ? `Booking #:       ${item.bookingNumber}` : '',
        item.paymentMethod ? `Payment Method:  ${item.paymentMethod}` : '',
        item.transactionId ? `Transaction ID:  ${item.transactionId}` : '',
        item.refundReason ? `Refund Reason:   ${item.refundReason}` : '',
        '',
        `Description:     ${item.description}`,
        '',
        '-'.repeat(48),
        item.amountPaid !== undefined ? `Amount Paid:     ${billingHistoryService.formatCurrency(item.amountPaid, item.currency)}` : '',
        item.amountRemaining !== undefined ? `Amount Due:      ${billingHistoryService.formatCurrency(item.amountRemaining, item.currency)}` : '',
        '-'.repeat(48),
        '',
        `Generated:       ${billingHistoryService.formatDate(new Date().toISOString())}`,
        '='.repeat(48),
      ].filter(Boolean).join('\n');

      const blob = new Blob([receiptContent], { type: 'text/plain;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `receipt-${item.invoiceNumber || item.transactionId || item.id}-${new Date().toISOString().split('T')[0]}.txt`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Receipt download failed:', error);
      alert('Failed to download receipt. Please try again.');
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Transaction Details">
      <div className="space-y-4">
        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
          <div className="flex items-center space-x-3">
            {item.type === 'invoice' && <Receipt className="h-6 w-6 text-blue-500" />}
            {item.type === 'payment' && <CreditCard className="h-6 w-6 text-green-500" />}
            {item.type === 'refund' && <RefreshCw className="h-6 w-6 text-purple-500" />}
            {item.type === 'booking' && <Calendar className="h-6 w-6 text-orange-500" />}
            {item.type === 'checkout_charges' && <Receipt className="h-6 w-6 text-amber-600" />}
            <div>
              <div className="font-medium capitalize">{item.type}</div>
              <Badge variant={billingHistoryService.getStatusColor(item.status, item.type) as 'green' | 'blue' | 'orange' | 'red' | 'gray' | 'yellow' | 'purple'}>
                {item.status}
              </Badge>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownloadReceipt}
            className="flex items-center gap-1"
          >
            <Download className="h-4 w-4" />
            Receipt
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Amount</label>
            <div className={cn(
              "text-lg font-semibold",
              item.type === 'refund' ? 'text-green-600' : 'text-gray-900'
            )}>
              {item.type === 'refund' ? '+' : ''}
              {billingHistoryService.formatCurrency(item.amount, item.currency)}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
            <div className="text-gray-900">
              {billingHistoryService.formatDate(item.date)}
            </div>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
          <p className="text-gray-900 bg-gray-50 p-3 rounded">
            {item.description}
          </p>
        </div>

        {item.bookingNumber && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Booking</label>
            <div className="text-gray-900">#{item.bookingNumber}</div>
          </div>
        )}

        {item.invoiceNumber && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Invoice Number</label>
            <div className="text-gray-900 font-mono">{item.invoiceNumber}</div>
          </div>
        )}

        {item.paymentMethod && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Payment Method</label>
            <div className="text-gray-900 capitalize">{item.paymentMethod}</div>
          </div>
        )}

        {item.transactionId && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Transaction ID</label>
            <div className="text-xs text-gray-600 font-mono break-all bg-gray-50 p-2 rounded">
              {item.transactionId}
            </div>
          </div>
        )}

        {item.refundReason && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Refund Reason</label>
            <div className="text-gray-900">{item.refundReason}</div>
          </div>
        )}

        {(item.amountPaid !== undefined && item.amountRemaining !== undefined) && (
          <div className="grid grid-cols-2 gap-4 pt-4 border-t">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Amount Paid</label>
              <div className="text-green-600 font-medium">
                {billingHistoryService.formatCurrency(item.amountPaid, item.currency)}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Amount Remaining</label>
              <div className="text-orange-600 font-medium">
                {billingHistoryService.formatCurrency(item.amountRemaining, item.currency)}
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};

// Main Guest Billing History Component
function GuestBillingHistory() {
  const [filters, setFilters] = useState<BillingHistoryFilters>({
    page: 1,
    limit: 10,
    type: 'all'
  });
  const [accumulatedItems, setAccumulatedItems] = useState<BillingHistoryItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<BillingHistoryItem | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState('all');

  // Fetch billing history for the guest
  const {
    data: historyData,
    isLoading,
    isError,
    error,
    refetch
  } = useQuery({
    queryKey: ['guest-billing-history', filters],
    queryFn: () => billingHistoryService.getBillingHistory(filters),
    // v5: use placeholderData instead of removed keepPreviousData option name
    placeholderData: keepPreviousData,
  });

  // TanStack Query v5 removed useQuery's onSuccess — sync list state when data arrives.
  // Ignore stale placeholder rows while the next page is loading (pagination.page must match).
  useEffect(() => {
    if (!historyData?.data) return;
    const page = filters.page || 1;
    const responsePage = historyData.data.pagination?.page ?? page;
    if (responsePage !== page) return;
    const history = historyData.data.history ?? [];
    if (page === 1) {
      setAccumulatedItems(history);
    } else {
      setAccumulatedItems((prev) => {
        const existingIds = new Set(prev.map((i) => i.id));
        const newItems = history.filter((i) => !existingIds.has(i.id));
        return [...prev, ...newItems];
      });
    }
  }, [historyData, filters.page]);

  const handlePeriodFilter = (period: string) => {
    setSelectedPeriod(period);
    const now = new Date();
    let startDate = '';
    
    switch (period) {
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
        break;
      case 'quarter':
        startDate = new Date(now.getFullYear(), now.getMonth() - 3, 1).toISOString().split('T')[0];
        break;
      case 'year':
        startDate = new Date(now.getFullYear() - 1, now.getMonth(), 1).toISOString().split('T')[0];
        break;
      default:
        startDate = '';
    }
    
    setAccumulatedItems([]);
    setFilters({ ...filters, startDate, page: 1 });
  };

  const handleTypeFilter = (type: string) => {
    setAccumulatedItems([]);
    setFilters({ ...filters, type: type as BillingHistoryFilters['type'], page: 1 });
  };

  const handleItemClick = (item: BillingHistoryItem) => {
    setSelectedItem(item);
    setShowDetailModal(true);
  };

  const loadMore = () => {
    setFilters({ ...filters, page: (filters.page || 1) + 1 });
  };

  // Calculate quick stats from the summary
  const quickStats = {
    totalSpent: historyData?.data.summary.totalPaymentAmount || 0,
    totalInvoices: historyData?.data.summary.invoiceCount || 0,
    totalPayments: historyData?.data.summary.paymentCount || 0,
    totalRefunds: historyData?.data.summary.refundCount || 0
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">My Billing & Payments</h1>
        <p className="text-gray-600 mt-1">
          View your invoices, payments, and refund history
        </p>
      </div>

      {/* Quick Stats */}
      <QuickStats data={quickStats} isLoading={isLoading} />

      {/* Filters */}
      <Card className="p-4 mb-6">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Period Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Period</label>
            <div className="flex flex-wrap gap-2">
              {[
                { label: 'All Time', value: 'all' },
                { label: 'This Month', value: 'month' },
                { label: 'Last 3 Months', value: 'quarter' },
                { label: 'This Year', value: 'year' }
              ].map((period) => (
                <Button
                  key={period.value}
                  variant={selectedPeriod === period.value ? 'primary' : 'outline'}
                  onClick={() => handlePeriodFilter(period.value)}
                  className="text-sm"
                >
                  {period.label}
                </Button>
              ))}
            </div>
          </div>

          {/* Type Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Type</label>
            <div className="flex flex-wrap gap-2">
              {[
                { label: 'All', value: 'all' },
                { label: 'Invoices', value: 'invoice' },
                { label: 'Payments', value: 'payment' },
                { label: 'Refunds', value: 'refund' }
              ].map((type) => (
                <Button
                  key={type.value}
                  variant={filters.type === type.value ? 'primary' : 'outline'}
                  onClick={() => handleTypeFilter(type.value)}
                  className="text-sm"
                >
                  {type.label}
                </Button>
              ))}
            </div>
          </div>
        </div>
      </Card>

      {/* Transaction List */}
      <div className="space-y-4">
        {isError ? (
          <Card className="p-8 text-center">
            <AlertCircle className="h-12 w-12 text-red-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Failed to load billing history</h3>
            <p className="text-gray-500 mb-4">
              {error instanceof Error ? error.message : 'An unexpected error occurred while fetching your billing data.'}
            </p>
            <Button variant="outline" onClick={() => refetch()}>
              Try Again
            </Button>
          </Card>
        ) : isLoading && filters.page === 1 ? (
          <div className="flex justify-center py-8">
            <LoadingSpinner />
          </div>
        ) : accumulatedItems.length === 0 ? (
          <Card className="p-8 text-center">
            <Receipt className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No transactions found</h3>
            <p className="text-gray-500">
              You don't have any billing history yet. Your transactions will appear here once you make bookings and payments.
            </p>
          </Card>
        ) : (
          <>
            {accumulatedItems.map((item) => (
              <TransactionItem
                key={item.id}
                item={item}
                onClick={handleItemClick}
              />
            ))}

            {/* Load More Button */}
            {historyData?.data.pagination && historyData.data.pagination.page < historyData.data.pagination.pages && (
              <div className="flex justify-center pt-6">
                <Button
                  variant="outline"
                  onClick={loadMore}
                  disabled={isLoading}
                >
                  {isLoading ? 'Loading...' : 'Load More'}
                </Button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Detail Modal */}
      <GuestDetailModal
        item={selectedItem}
        isOpen={showDetailModal}
        onClose={() => {
          setShowDetailModal(false);
          setSelectedItem(null);
        }}
      />
    </div>
  );
}

export default withErrorBoundary(GuestBillingHistory);
