import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FaHistory,
  FaFilter,
  FaDownload,
  FaSearch,
  FaSort,
  FaArrowUp,
  FaArrowDown,
  FaExchangeAlt,
  FaPlus,
  FaMinus,
  FaAdjust,
  FaRecycle,
  FaUtensils
} from 'react-icons/fa';
import { stockMovementsService } from '../../services/stockMovementsService';
import { format } from 'date-fns';

interface Transaction {
  _id: string;
  inventoryItemId: {
    _id: string;
    name: string;
    category: string;
    unit: string;
  };
  transactionType: 'IN' | 'OUT' | 'TRANSFER' | 'ADJUSTMENT' | 'REORDER' | 'CONSUMPTION';
  quantity: number;
  previousQuantity: number;
  newQuantity: number;
  unitCost: number;
  totalCost: number;
  reason: string;
  reference?: {
    type: string;
    description: string;
  };
  performedBy: {
    _id: string;
    name: string;
    role: string;
  };
  status: 'pending' | 'completed' | 'cancelled';
  timestamps: {
    created: string;
    updated: string;
    completed?: string;
  };
  formattedQuantity: string;
  transactionValue: number;
  locationDisplay?: string;
}

interface TransactionFilters {
  page: number;
  limit: number;
  transactionType?: string;
  inventoryItemId?: string;
  startDate?: string;
  endDate?: string;
  status?: string;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
  searchTerm: string;
}

const TransactionHistory: React.FC = () => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    pages: 0
  });

  const [filters, setFilters] = useState<TransactionFilters>({
    page: 1,
    limit: 50,
    sortBy: 'timestamps.created',
    sortOrder: 'desc',
    searchTerm: ''
  });

  const [showFilters, setShowFilters] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);

  // Fetch transactions
  const fetchTransactions = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await stockMovementsService.getTransactionHistory(filters);

      if (response.success) {
        setTransactions(response.data.transactions);
        setPagination(response.data.pagination);
      } else {
        setError('Failed to fetch transaction history');
      }
    } catch (err: unknown) {
      setError(err.message || 'Failed to fetch transaction history');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, [filters]);

  // Filter handlers
  const updateFilter = (key: keyof TransactionFilters, value: unknown) => {
    setFilters(prev => ({
      ...prev,
      [key]: value,
      page: key !== 'page' ? 1 : value // Reset to page 1 when changing filters
    }));
  };

  const clearFilters = () => {
    setFilters({
      page: 1,
      limit: 50,
      sortBy: 'timestamps.created',
      sortOrder: 'desc',
      searchTerm: ''
    });
  };

  // Export data
  const exportData = async (format: 'csv' | 'json' = 'csv') => {
    try {
      const exportFilters = { ...filters };
      delete exportFilters.page;
      delete exportFilters.limit;

      const response = await stockMovementsService.exportTransactions({
        ...exportFilters,
        format
      });

      if (format === 'csv') {
        // Create and download CSV file
        const blob = new Blob([response], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `stock-movements-${format(new Date(), 'yyyy-MM-dd')}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      } else {
        // Create and download JSON file
        const blob = new Blob([JSON.stringify(response.data, null, 2)], { type: 'application/json' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `stock-movements-${format(new Date(), 'yyyy-MM-dd')}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      }
    } catch (err: unknown) {
      setError(err.message || 'Failed to export data');
    }
  };

  // Get transaction type icon and color
  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'IN':
      case 'REORDER':
        return <FaArrowUp className="text-green-500" />;
      case 'OUT':
      case 'CONSUMPTION':
        return <FaArrowDown className="text-red-500" />;
      case 'TRANSFER':
        return <FaExchangeAlt className="text-blue-500" />;
      case 'ADJUSTMENT':
        return <FaAdjust className="text-yellow-500" />;
      default:
        return <FaRecycle className="text-gray-500" />;
    }
  };

  const getTransactionColor = (type: string) => {
    switch (type) {
      case 'IN':
      case 'REORDER':
        return 'text-green-600 bg-green-50';
      case 'OUT':
      case 'CONSUMPTION':
        return 'text-red-600 bg-red-50';
      case 'TRANSFER':
        return 'text-blue-600 bg-blue-50';
      case 'ADJUSTMENT':
        return 'text-yellow-600 bg-yellow-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  // Filter transactions by search term
  const filteredTransactions = useMemo(() => {
    if (!filters.searchTerm) return transactions;

    return transactions.filter(transaction =>
      transaction.inventoryItemId.name.toLowerCase().includes(filters.searchTerm.toLowerCase()) ||
      transaction.reason.toLowerCase().includes(filters.searchTerm.toLowerCase()) ||
      transaction.performedBy.name.toLowerCase().includes(filters.searchTerm.toLowerCase()) ||
      transaction.reference?.description?.toLowerCase().includes(filters.searchTerm.toLowerCase())
    );
  }, [transactions, filters.searchTerm]);

  if (loading && transactions.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <FaHistory className="h-6 w-6 text-blue-600" />
          <h2 className="text-2xl font-bold text-gray-900">Stock Movement History</h2>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={() => exportData('csv')}
            className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            <FaDownload className="h-4 w-4 mr-2" />
            Export CSV
          </button>

          <button
            onClick={() => exportData('json')}
            className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            <FaDownload className="h-4 w-4 mr-2" />
            Export JSON
          </button>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
        <div className="flex flex-col space-y-4">
          {/* Search Bar */}
          <div className="flex items-center space-x-4">
            <div className="flex-1 relative">
              <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search transactions..."
                value={filters.searchTerm}
                onChange={(e) => updateFilter('searchTerm', e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`inline-flex items-center px-4 py-2 border rounded-md shadow-sm text-sm font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${
                showFilters
                  ? 'border-blue-300 text-blue-700 bg-blue-50 hover:bg-blue-100'
                  : 'border-gray-300 text-gray-700 bg-white hover:bg-gray-50'
              }`}
            >
              <FaFilter className="h-4 w-4 mr-2" />
              Filters
            </button>
          </div>

          {/* Advanced Filters */}
          <AnimatePresence>
            {showFilters && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="border-t border-gray-200 pt-4"
              >
                <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
                  <select
                    value={filters.transactionType || ''}
                    onChange={(e) => updateFilter('transactionType', e.target.value || undefined)}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">All Types</option>
                    <option value="IN">Stock In</option>
                    <option value="OUT">Stock Out</option>
                    <option value="TRANSFER">Transfer</option>
                    <option value="ADJUSTMENT">Adjustment</option>
                    <option value="REORDER">Reorder</option>
                    <option value="CONSUMPTION">Consumption</option>
                  </select>

                  <select
                    value={filters.status || ''}
                    onChange={(e) => updateFilter('status', e.target.value || undefined)}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">All Status</option>
                    <option value="pending">Pending</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>

                  <input
                    type="date"
                    value={filters.startDate || ''}
                    onChange={(e) => updateFilter('startDate', e.target.value || undefined)}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Start Date"
                  />

                  <input
                    type="date"
                    value={filters.endDate || ''}
                    onChange={(e) => updateFilter('endDate', e.target.value || undefined)}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    placeholder="End Date"
                  />

                  <button
                    onClick={clearFilters}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    Clear Filters
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <FaHistory className="h-6 w-6 text-gray-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Total Transactions
                  </dt>
                  <dd className="text-lg font-medium text-gray-900">
                    {pagination.total.toLocaleString()}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <FaArrowUp className="h-6 w-6 text-green-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Stock In
                  </dt>
                  <dd className="text-lg font-medium text-green-600">
                    {filteredTransactions.filter(t => ['IN', 'REORDER'].includes(t.transactionType)).length}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <FaArrowDown className="h-6 w-6 text-red-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Stock Out
                  </dt>
                  <dd className="text-lg font-medium text-red-600">
                    {filteredTransactions.filter(t => ['OUT', 'CONSUMPTION'].includes(t.transactionType)).length}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <span className="text-lg">💰</span>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Total Value
                  </dt>
                  <dd className="text-lg font-medium text-gray-900">
                    ${filteredTransactions.reduce((sum, t) => sum + (t.totalCost || 0), 0).toFixed(2)}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        <div className="min-w-full">
          {/* Table Header */}
          <div className="bg-gray-50 px-6 py-3 border-b border-gray-200">
            <div className="grid grid-cols-8 gap-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              <div className="col-span-2">Item & Details</div>
              <div>Type</div>
              <div>Quantity</div>
              <div>Stock Change</div>
              <div>Cost</div>
              <div>Performed By</div>
              <div>Date</div>
            </div>
          </div>

          {/* Table Body */}
          <div className="bg-white divide-y divide-gray-200">
            {filteredTransactions.length === 0 ? (
              <div className="px-6 py-12 text-center text-gray-500">
                <FaHistory className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <p className="text-lg font-medium">No transactions found</p>
                <p className="text-sm">Try adjusting your search filters</p>
              </div>
            ) : (
              filteredTransactions.map((transaction) => (
                <motion.div
                  key={transaction._id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="px-6 py-4 hover:bg-gray-50 cursor-pointer"
                  onClick={() => setSelectedTransaction(transaction)}
                >
                  <div className="grid grid-cols-8 gap-4 items-center">
                    {/* Item & Details */}
                    <div className="col-span-2">
                      <div className="text-sm font-medium text-gray-900">
                        {transaction.inventoryItemId.name}
                      </div>
                      <div className="text-sm text-gray-500">
                        {transaction.inventoryItemId.category}
                      </div>
                      <div className="text-xs text-gray-400 mt-1">
                        {transaction.reason}
                      </div>
                    </div>

                    {/* Type */}
                    <div>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getTransactionColor(transaction.transactionType)}`}>
                        {getTransactionIcon(transaction.transactionType)}
                        <span className="ml-1">{transaction.transactionType}</span>
                      </span>
                    </div>

                    {/* Quantity */}
                    <div className="text-sm text-gray-900">
                      <span className={`font-medium ${transaction.quantity >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {transaction.formattedQuantity}
                      </span>
                      <span className="text-gray-500 ml-1">{transaction.inventoryItemId.unit}</span>
                    </div>

                    {/* Stock Change */}
                    <div className="text-sm text-gray-900">
                      <div>{transaction.previousQuantity} → {transaction.newQuantity}</div>
                    </div>

                    {/* Cost */}
                    <div className="text-sm text-gray-900">
                      ${(transaction.totalCost || 0).toFixed(2)}
                    </div>

                    {/* Performed By */}
                    <div className="text-sm text-gray-900">
                      <div>{transaction.performedBy.name}</div>
                      <div className="text-xs text-gray-500">{transaction.performedBy.role}</div>
                    </div>

                    {/* Date */}
                    <div className="text-sm text-gray-900">
                      <div>{format(new Date(transaction.timestamps.created), 'MMM dd, yyyy')}</div>
                      <div className="text-xs text-gray-500">
                        {format(new Date(transaction.timestamps.created), 'HH:mm')}
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Pagination */}
      {pagination.pages > 1 && (
        <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
          <div className="flex-1 flex justify-between sm:hidden">
            <button
              onClick={() => updateFilter('page', Math.max(1, pagination.page - 1))}
              disabled={pagination.page === 1}
              className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <button
              onClick={() => updateFilter('page', Math.min(pagination.pages, pagination.page + 1))}
              disabled={pagination.page === pagination.pages}
              className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>

          <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-gray-700">
                Showing <span className="font-medium">{(pagination.page - 1) * pagination.limit + 1}</span> to{' '}
                <span className="font-medium">
                  {Math.min(pagination.page * pagination.limit, pagination.total)}
                </span>{' '}
                of <span className="font-medium">{pagination.total}</span> results
              </p>
            </div>
            <div>
              <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                <button
                  onClick={() => updateFilter('page', Math.max(1, pagination.page - 1))}
                  disabled={pagination.page === 1}
                  className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                {/* Page numbers would go here */}
                <button
                  onClick={() => updateFilter('page', Math.min(pagination.pages, pagination.page + 1))}
                  disabled={pagination.page === pagination.pages}
                  className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </nav>
            </div>
          </div>
        </div>
      )}

      {/* Transaction Detail Modal */}
      <AnimatePresence>
        {selectedTransaction && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50"
            onClick={() => setSelectedTransaction(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative top-20 mx-auto p-5 border w-11/12 md:w-3/4 lg:w-1/2 shadow-lg rounded-md bg-white"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium text-gray-900">
                    Transaction Details
                  </h3>
                  <button
                    onClick={() => setSelectedTransaction(null)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <span className="sr-only">Close</span>
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <div className="border-t border-gray-200 pt-4">
                  <dl className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2">
                    <div>
                      <dt className="text-sm font-medium text-gray-500">Item</dt>
                      <dd className="mt-1 text-sm text-gray-900">{selectedTransaction.inventoryItemId.name}</dd>
                    </div>

                    <div>
                      <dt className="text-sm font-medium text-gray-500">Category</dt>
                      <dd className="mt-1 text-sm text-gray-900">{selectedTransaction.inventoryItemId.category}</dd>
                    </div>

                    <div>
                      <dt className="text-sm font-medium text-gray-500">Transaction Type</dt>
                      <dd className="mt-1">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getTransactionColor(selectedTransaction.transactionType)}`}>
                          {getTransactionIcon(selectedTransaction.transactionType)}
                          <span className="ml-1">{selectedTransaction.transactionType}</span>
                        </span>
                      </dd>
                    </div>

                    <div>
                      <dt className="text-sm font-medium text-gray-500">Quantity Change</dt>
                      <dd className="mt-1 text-sm text-gray-900">
                        <span className={`font-medium ${selectedTransaction.quantity >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {selectedTransaction.formattedQuantity} {selectedTransaction.inventoryItemId.unit}
                        </span>
                      </dd>
                    </div>

                    <div>
                      <dt className="text-sm font-medium text-gray-500">Stock Level</dt>
                      <dd className="mt-1 text-sm text-gray-900">
                        {selectedTransaction.previousQuantity} → {selectedTransaction.newQuantity}
                      </dd>
                    </div>

                    <div>
                      <dt className="text-sm font-medium text-gray-500">Total Cost</dt>
                      <dd className="mt-1 text-sm text-gray-900">${(selectedTransaction.totalCost || 0).toFixed(2)}</dd>
                    </div>

                    <div>
                      <dt className="text-sm font-medium text-gray-500">Performed By</dt>
                      <dd className="mt-1 text-sm text-gray-900">
                        {selectedTransaction.performedBy.name} ({selectedTransaction.performedBy.role})
                      </dd>
                    </div>

                    <div>
                      <dt className="text-sm font-medium text-gray-500">Date & Time</dt>
                      <dd className="mt-1 text-sm text-gray-900">
                        {format(new Date(selectedTransaction.timestamps.created), 'PPpp')}
                      </dd>
                    </div>

                    <div className="sm:col-span-2">
                      <dt className="text-sm font-medium text-gray-500">Reason</dt>
                      <dd className="mt-1 text-sm text-gray-900">{selectedTransaction.reason}</dd>
                    </div>

                    {selectedTransaction.reference && (
                      <div className="sm:col-span-2">
                        <dt className="text-sm font-medium text-gray-500">Reference</dt>
                        <dd className="mt-1 text-sm text-gray-900">
                          {selectedTransaction.reference.type}: {selectedTransaction.reference.description}
                        </dd>
                      </div>
                    )}

                    {selectedTransaction.locationDisplay && (
                      <div className="sm:col-span-2">
                        <dt className="text-sm font-medium text-gray-500">Location</dt>
                        <dd className="mt-1 text-sm text-gray-900">{selectedTransaction.locationDisplay}</dd>
                      </div>
                    )}
                  </dl>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default TransactionHistory;