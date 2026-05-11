import React, { useState } from 'react';
import { useQuery, useMutation, keepPreviousData } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { cn } from '../../utils/cn';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Modal } from '@/components/ui/Modal';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { 
  billingHistoryService, 
  BillingHistoryItem, 
  BillingHistoryFilters,
  BillingHistorySummary
} from '../../services/billingHistoryService';
import { useAuth } from '../../context/AuthContext';
import { withErrorBoundary } from '../../components/ErrorBoundary';

// Filter Component
interface BillingFiltersProps {
  filters: BillingHistoryFilters;
  onFiltersChange: (filters: BillingHistoryFilters) => void;
  onSearch: (query: string) => void;
  onExport: () => void;
  isExporting: boolean;
}

const BillingFilters: React.FC<BillingFiltersProps> = ({
  filters,
  onFiltersChange,
  onSearch,
  onExport,
  isExporting
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [localFilters, setLocalFilters] = useState(filters);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch(searchQuery);
  };

  const handleFilterChange = (key: string, value: unknown) => {
    const newFilters = { ...localFilters, [key]: value };
    setLocalFilters(newFilters);
    onFiltersChange(newFilters);
  };

  const clearFilters = () => {
    const clearedFilters = { page: 1, limit: 20 };
    setLocalFilters(clearedFilters);
    setSearchQuery('');
    onFiltersChange(clearedFilters);
  };

  return (
    <Card className="p-4 sm:p-6 mb-6">
      <div className="space-y-4">
        {/* Search Bar */}
        <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row gap-2">
          <Input
            type="text"
            placeholder="Search invoices, bookings, guests..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 text-sm"
          />
          <div className="flex gap-2">
            <Button type="submit" size="sm" className="flex-1 sm:flex-none">Search</Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onExport}
              disabled={isExporting}
              className="flex-1 sm:flex-none"
            >
              {isExporting ? 'Exporting...' : 'Export'}
            </Button>
          </div>
        </form>

        {/* Filter Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
              Type
            </label>
            <select
              value={localFilters.type || 'all'}
              onChange={(e) => handleFilterChange('type', e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Types</option>
              <option value="invoice">Invoices</option>
              <option value="payment">Payments</option>
              <option value="refund">Refunds</option>
              <option value="booking">Bookings</option>
              <option value="checkout_charges">Checkout Charges</option>
            </select>
          </div>

          <div>
            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
              Status
            </label>
            <select
              value={localFilters.status || ''}
              onChange={(e) => handleFilterChange('status', e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Statuses</option>
              <option value="paid">Paid</option>
              <option value="pending">Pending</option>
              <option value="issued">Issued</option>
              <option value="overdue">Overdue</option>
              <option value="succeeded">Succeeded</option>
              <option value="failed">Failed</option>
              <option value="refunded">Refunded</option>
            </select>
          </div>

          <div>
            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
              Start Date
            </label>
            <Input
              type="date"
              value={localFilters.startDate || ''}
              onChange={(e) => handleFilterChange('startDate', e.target.value)}
              className="text-sm"
            />
          </div>

          <div>
            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
              End Date
            </label>
            <Input
              type="date"
              value={localFilters.endDate || ''}
              onChange={(e) => handleFilterChange('endDate', e.target.value)}
              className="text-sm"
            />
          </div>
        </div>

        <div className="flex justify-end">
          <Button variant="outline" size="sm" onClick={clearFilters} className="text-sm">
            Clear Filters
          </Button>
        </div>
      </div>
    </Card>
  );
};

// Summary Stats Component
interface SummaryStatsProps {
  summary: BillingHistorySummary;
  isLoading: boolean;
}

const SummaryStats: React.FC<SummaryStatsProps> = ({ summary, isLoading }) => {
  if (isLoading) {
    return (
      <Card className="p-6 mb-6">
        <div className="flex justify-center">
          <LoadingSpinner />
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-4 sm:p-6 mb-6">
      <h3 className="text-base sm:text-lg font-semibold mb-4">Summary Statistics</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <div className="text-center p-3 bg-blue-50 rounded-lg border border-blue-100">
          <div className="text-lg sm:text-2xl font-bold text-blue-600 truncate">
            {summary.totalTransactions}
          </div>
          <div className="text-xs sm:text-sm text-gray-600 mt-1">Total Transactions</div>
        </div>
        <div className="text-center p-3 bg-green-50 rounded-lg border border-green-100">
          <div className="text-lg sm:text-2xl font-bold text-green-600 truncate">
            {billingHistoryService.formatCurrency(
              (summary.totalPaymentAmount || 0) + (summary.totalBookingAmount || 0)
            )}
          </div>
          <div className="text-xs sm:text-sm text-gray-600 mt-1">Total Revenue</div>
        </div>
        <div className="text-center p-3 bg-orange-50 rounded-lg border border-orange-100">
          <div className="text-lg sm:text-2xl font-bold text-orange-600 truncate">
            {billingHistoryService.formatCurrency(summary.totalInvoiceAmount || 0)}
          </div>
          <div className="text-xs sm:text-sm text-gray-600 mt-1">Total Invoiced</div>
        </div>
        <div className="text-center p-3 bg-purple-50 rounded-lg border border-purple-100">
          <div className="text-lg sm:text-2xl font-bold text-purple-600 truncate">
            {billingHistoryService.formatCurrency(summary.totalRefundAmount || 0)}
          </div>
          <div className="text-xs sm:text-sm text-gray-600 mt-1">Total Refunds</div>
        </div>
      </div>
    </Card>
  );
};

// History Table Component
interface HistoryTableProps {
  items: BillingHistoryItem[];
  isLoading: boolean;
  onItemClick: (item: BillingHistoryItem) => void;
}

const HistoryTable: React.FC<HistoryTableProps> = ({ items, isLoading, onItemClick }) => {
  if (isLoading) {
    return (
      <Card className="p-6">
        <div className="flex justify-center py-8">
          <LoadingSpinner />
        </div>
      </Card>
    );
  }

  if (!items.length) {
    return (
      <Card className="p-6">
        <div className="text-center py-8 text-gray-500">
          No billing history found
        </div>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Date
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Type
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Description
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Guest
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Amount
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {items.map((item) => (
              <tr role="button" tabIndex={0}
                key={item.id}
                onClick={() => onItemClick(item)}
                className="hover:bg-gray-50 cursor-pointer"
                onKeyDown={(e: React.KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onItemClick(item); } }}>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {billingHistoryService.formatDate(item.date)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  <div className="flex items-center">
                    <span className="mr-2">
                      {billingHistoryService.getTypeIcon(item.type)}
                    </span>
                    <span className="capitalize">{item.type}</span>
                  </div>
                </td>
                <td className="px-6 py-4 text-sm text-gray-900">
                  <div className="max-w-xs truncate">
                    {item.description}
                  </div>
                  {item.bookingNumber && (
                    <div className="text-xs text-gray-500">
                      Booking: {item.bookingNumber}
                    </div>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {item.guestName || 'N/A'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  <span className={cn(
                    item.type === 'refund' ? 'text-red-600' : 'text-gray-900'
                  )}>
                    {item.type === 'refund' ? '-' : ''}
                    {billingHistoryService.formatCurrency(item.amount, item.currency)}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <Badge 
                    variant={billingHistoryService.getStatusColor(item.status, item.type)}
                  >
                    {item.status}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
};

// Detail Modal Component
interface DetailModalProps {
  item: BillingHistoryItem | null;
  isOpen: boolean;
  onClose: () => void;
}

const DetailModal: React.FC<DetailModalProps> = ({ item, isOpen, onClose }) => {
  if (!item) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Transaction Details">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Type</label>
            <div className="flex items-center mt-1">
              <span className="mr-2">{billingHistoryService.getTypeIcon(item.type)}</span>
              <span className="capitalize">{item.type}</span>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Status</label>
            <Badge 
              variant={billingHistoryService.getStatusColor(item.status, item.type)}
              className="mt-1"
            >
              {item.status}
            </Badge>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Description</label>
          <p className="mt-1 text-sm text-gray-900">{item.description}</p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Amount</label>
            <p className="mt-1 text-sm font-medium">
              {item.type === 'refund' ? '-' : ''}
              {billingHistoryService.formatCurrency(item.amount, item.currency)}
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Date</label>
            <p className="mt-1 text-sm text-gray-900">
              {billingHistoryService.formatDate(item.date)}
            </p>
          </div>
        </div>

        {item.guestName && (
          <div>
            <label className="block text-sm font-medium text-gray-700">Guest</label>
            <p className="mt-1 text-sm text-gray-900">{item.guestName}</p>
            {item.guestEmail && (
              <p className="text-sm text-gray-500">{item.guestEmail}</p>
            )}
          </div>
        )}

        {item.bookingNumber && (
          <div>
            <label className="block text-sm font-medium text-gray-700">Booking</label>
            <p className="mt-1 text-sm text-gray-900">#{item.bookingNumber}</p>
          </div>
        )}

        {item.invoiceNumber && (
          <div>
            <label className="block text-sm font-medium text-gray-700">Invoice Number</label>
            <p className="mt-1 text-sm text-gray-900">{item.invoiceNumber}</p>
          </div>
        )}

        {item.paymentMethod && (
          <div>
            <label className="block text-sm font-medium text-gray-700">Payment Method</label>
            <p className="mt-1 text-sm text-gray-900 capitalize">{item.paymentMethod}</p>
          </div>
        )}

        {item.transactionId && (
          <div>
            <label className="block text-sm font-medium text-gray-700">Transaction ID</label>
            <p className="mt-1 text-sm text-gray-900 font-mono text-xs break-all">
              {item.transactionId}
            </p>
          </div>
        )}

        {item.refundReason && (
          <div>
            <label className="block text-sm font-medium text-gray-700">Refund Reason</label>
            <p className="mt-1 text-sm text-gray-900">{item.refundReason}</p>
          </div>
        )}
      </div>
    </Modal>
  );
};

// Pagination Component
interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

const Pagination: React.FC<PaginationProps> = ({ currentPage, totalPages, onPageChange }) => {
  const pages = [];
  const showPages = 5;
  const startPage = Math.max(1, currentPage - Math.floor(showPages / 2));
  const endPage = Math.min(totalPages, startPage + showPages - 1);

  for (let i = startPage; i <= endPage; i++) {
    pages.push(i);
  }

  if (totalPages <= 1) return null;

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between px-4 py-3 bg-white border-t border-gray-200 sm:px-6 gap-3">
      <div className="flex items-center">
        <p className="text-xs sm:text-sm text-gray-700">
          Page <span className="font-medium">{currentPage}</span> of{' '}
          <span className="font-medium">{totalPages}</span>
        </p>
      </div>
      <div className="flex items-center space-x-1 sm:space-x-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage <= 1}
          className="text-xs px-2 sm:px-3"
        >
          Prev
        </Button>
        
        <div className="hidden sm:flex items-center space-x-1">
          {pages.map((page) => (
            <Button
              key={page}
              variant={page === currentPage ? 'primary' : 'outline'}
              size="sm"
              onClick={() => onPageChange(page)}
              className="text-xs min-w-[32px]"
            >
              {page}
            </Button>
          ))}
        </div>
        
        <div className="sm:hidden text-xs text-gray-500">
          {currentPage} / {totalPages}
        </div>
        
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages}
          className="text-xs px-2 sm:px-3"
        >
          Next
        </Button>
      </div>
    </div>
  );
};

// Main Component
function BillingHistory() {
  const { user } = useAuth();
  const [filters, setFilters] = useState<BillingHistoryFilters>({
    page: 1,
    limit: 20,
    type: 'all'
  });
  const [selectedItem, setSelectedItem] = useState<BillingHistoryItem | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  // Fetch billing history
  const {
    data: historyData,
    isLoading
  } = useQuery({
    queryKey: ['billing-history', filters],
    queryFn: () => billingHistoryService.getBillingHistory(filters),
    placeholderData: keepPreviousData
  });

  // Resolve hotelId safely: user.hotelId may be a string or an object ref
  const resolvedHotelId: string | undefined = (() => {
    if (!user?.hotelId) return undefined;
    if (typeof user.hotelId === 'string') return user.hotelId;
    if (typeof user.hotelId === 'object' && '_id' in user.hotelId) return (user.hotelId as { _id: string })._id;
    return undefined;
  })();

  // Export mutation
  const exportMutation = useMutation({
    mutationFn: () => billingHistoryService.exportBillingHistory('csv', {
      startDate: filters.startDate,
      endDate: filters.endDate,
      // Only pass exportable types; 'booking' and 'checkout_charges' are also
      // valid now that the backend accepts them.
      type: filters.type as 'all' | 'invoice' | 'payment' | 'refund' | 'booking' | 'checkout_charges' | undefined,
      hotelId: resolvedHotelId
    }),
    onSuccess: (data) => {
      billingHistoryService.downloadExportFile(data.data);
      toast.success('Export completed successfully');
    },
    onError: () => {
      toast.error('Export failed. Please try again.');
    }
  });

  const handleFiltersChange = (newFilters: BillingHistoryFilters) => {
    setFilters({ ...newFilters, page: 1 });
  };

  const handleSearch = (query: string) => {
    setFilters({ ...filters, search: query, page: 1 });
  };

  const handleExport = () => {
    exportMutation.mutate();
  };

  const handleItemClick = (item: BillingHistoryItem) => {
    setSelectedItem(item);
    setShowDetailModal(true);
  };

  const handlePageChange = (page: number) => {
    setFilters({ ...filters, page });
  };

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Billing & Payments History</h1>
        <p className="text-sm sm:text-base text-gray-600 mt-1">
          Comprehensive view of invoices, transactions, and refunds
        </p>
      </div>

      {/* Summary Stats */}
      <SummaryStats
        summary={historyData?.data.summary ?? {
          totalTransactions: 0,
          totalAmount: 0,
          invoiceCount: 0,
          paymentCount: 0,
          refundCount: 0,
          bookingCount: 0,
          checkoutChargeCount: 0,
          totalInvoiceAmount: 0,
          totalPaymentAmount: 0,
          totalRefundAmount: 0,
          totalBookingAmount: 0,
          totalCheckoutChargeAmount: 0
        }}
        isLoading={isLoading}
      />

      {/* Filters */}
      <BillingFilters
        filters={filters}
        onFiltersChange={handleFiltersChange}
        onSearch={handleSearch}
        onExport={handleExport}
        isExporting={exportMutation.isPending}
      />

      {/* History Table */}
      <HistoryTable
        items={historyData?.data.history || []}
        isLoading={isLoading}
        onItemClick={handleItemClick}
      />

      {/* Pagination */}
      {historyData?.data.pagination && (
        <Pagination
          currentPage={historyData.data.pagination.page}
          totalPages={historyData.data.pagination.pages}
          onPageChange={handlePageChange}
        />
      )}

      {/* Detail Modal */}
      <DetailModal
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

export default withErrorBoundary(BillingHistory);
