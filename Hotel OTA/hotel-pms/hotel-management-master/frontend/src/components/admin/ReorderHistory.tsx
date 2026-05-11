import React, { useState, useEffect } from 'react';
import {
  History,
  Calendar,
  Package,
  User,
  DollarSign,
  TrendingUp,
  CheckCircle,
  XCircle,
  Clock,
  Truck,
  Filter,
  Download,
  Search,
  RefreshCw,
  Eye,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/badge';
import { DataTable } from '../dashboard/DataTable';
import { reorderService } from '../../services/reorderService';

interface ReorderHistoryEntry {
  itemId: string;
  itemName: string;
  itemCategory: string;
  date: string;
  quantity: number;
  supplier: string;
  status: string;
  estimatedCost?: number;
  actualCost?: number;
  approvedBy?: string;
  orderDate?: string;
  expectedDeliveryDate?: string;
  actualDeliveryDate?: string;
  notes?: string;
}

interface ReorderHistoryProps {
  className?: string;
  itemId?: string; // If provided, shows history for specific item
  maxEntries?: number;
  showFilters?: boolean;
  showExport?: boolean;
}

interface HistoryFilters {
  itemId?: string;
  status?: 'pending' | 'approved' | 'ordered' | 'received' | 'cancelled' | 'rejected';
  startDate?: string;
  endDate?: string;
  limit?: number;
  search?: string;
}

export const ReorderHistory: React.FC<ReorderHistoryProps> = ({
  className = '',
  itemId,
  maxEntries = 50,
  showFilters = true,
  showExport = true
}) => {
  const [history, setHistory] = useState<ReorderHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<HistoryFilters>({
    itemId,
    limit: maxEntries
  });
  const [showFiltersPanel, setShowFiltersPanel] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<ReorderHistoryEntry | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);

  // Fetch reorder history
  const fetchHistory = async () => {
    try {
      setLoading(true);
      setError(null);

      const searchFilters = {
        ...filters,
        search: searchTerm || undefined
      };

      const data = await reorderService.getHistory(searchFilters);
      setHistory(data.history);
    } catch (err) {
      setError('Failed to load reorder history');
    } finally {
      setLoading(false);
    }
  };

  // Initial load and filter changes
  useEffect(() => {
    fetchHistory();
  }, [filters]);

  // Handle search with debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchTerm !== filters.search) {
        setFilters(prev => ({ ...prev, search: searchTerm }));
        setCurrentPage(1);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Export to CSV
  const exportToCSV = () => {
    const headers = [
      'Date',
      'Item Name',
      'Category',
      'Quantity',
      'Supplier',
      'Status',
      'Estimated Cost',
      'Actual Cost',
      'Approved By',
      'Order Date',
      'Expected Delivery',
      'Actual Delivery',
      'Notes'
    ];

    const csvData = history.map(entry => [
      new Date(entry.date).toLocaleDateString(),
      entry.itemName,
      entry.itemCategory,
      entry.quantity,
      entry.supplier,
      entry.status,
      entry.estimatedCost ? `$${entry.estimatedCost.toFixed(2)}` : '',
      entry.actualCost ? `$${entry.actualCost.toFixed(2)}` : '',
      entry.approvedBy || '',
      entry.orderDate ? new Date(entry.orderDate).toLocaleDateString() : '',
      entry.expectedDeliveryDate ? new Date(entry.expectedDeliveryDate).toLocaleDateString() : '',
      entry.actualDeliveryDate ? new Date(entry.actualDeliveryDate).toLocaleDateString() : '',
      entry.notes || ''
    ]);

    const csvContent = [headers, ...csvData]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `reorder-history-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  // Get status display configuration
  const getStatusConfig = (status: string) => {
    const configs = {
      pending: { label: 'Pending', color: 'bg-yellow-100 text-yellow-800 border-yellow-200', icon: Clock },
      approved: { label: 'Approved', color: 'bg-green-100 text-green-800 border-green-200', icon: CheckCircle },
      ordered: { label: 'Ordered', color: 'bg-blue-100 text-blue-800 border-blue-200', icon: Package },
      received: { label: 'Received', color: 'bg-green-100 text-green-800 border-green-200', icon: Truck },
      cancelled: { label: 'Cancelled', color: 'bg-gray-100 text-gray-800 border-gray-200', icon: XCircle },
      rejected: { label: 'Rejected', color: 'bg-red-100 text-red-800 border-red-200', icon: XCircle }
    };
    return configs[status as keyof typeof configs] || configs.pending;
  };

  // Calculate pagination
  const totalPages = Math.ceil(history.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentEntries = history.slice(startIndex, endIndex);

  // Calculate summary statistics
  const stats = {
    total: history.length,
    approved: history.filter(h => h.status === 'approved').length,
    received: history.filter(h => h.status === 'received').length,
    totalValue: history.reduce((sum, h) => sum + (h.actualCost || h.estimatedCost || 0), 0),
    averageValue: history.length > 0 ?
      history.reduce((sum, h) => sum + (h.actualCost || h.estimatedCost || 0), 0) / history.length : 0
  };

  if (loading) {
    return (
      <Card className={className}>
        <CardContent className="p-6">
          <div className="flex items-center justify-center space-x-2">
            <RefreshCw className="h-4 w-4 animate-spin" />
            <span>Loading reorder history...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={className}>
        <CardContent className="p-6">
          <div className="text-center">
            <XCircle className="h-8 w-8 text-red-500 mx-auto mb-2" />
            <p className="text-sm text-gray-600">{error}</p>
            <Button
              onClick={fetchHistory}
              variant="outline"
              size="sm"
              className="mt-2"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className={className}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-semibold flex items-center">
              <History className="h-5 w-5 mr-2 text-blue-600" />
              Reorder History
              <Badge variant="secondary" className="ml-2">
                {history.length}
              </Badge>
            </CardTitle>
            <div className="flex items-center space-x-2">
              {showFilters && (
                <Button
                  onClick={() => setShowFiltersPanel(!showFiltersPanel)}
                  variant="outline"
                  size="sm"
                >
                  <Filter className="h-4 w-4" />
                </Button>
              )}
              {showExport && (
                <Button
                  onClick={exportToCSV}
                  variant="outline"
                  size="sm"
                  disabled={history.length === 0}
                >
                  <Download className="h-4 w-4" />
                </Button>
              )}
              <Button
                onClick={fetchHistory}
                variant="outline"
                size="sm"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Summary Statistics */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-4">
            <div className="bg-blue-50 p-3 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">{stats.total}</div>
              <div className="text-xs text-blue-600">Total Reorders</div>
            </div>
            <div className="bg-green-50 p-3 rounded-lg">
              <div className="text-2xl font-bold text-green-600">{stats.approved}</div>
              <div className="text-xs text-green-600">Approved</div>
            </div>
            <div className="bg-purple-50 p-3 rounded-lg">
              <div className="text-2xl font-bold text-purple-600">{stats.received}</div>
              <div className="text-xs text-purple-600">Received</div>
            </div>
            <div className="bg-yellow-50 p-3 rounded-lg">
              <div className="text-2xl font-bold text-yellow-600">
                ${stats.totalValue.toFixed(0)}
              </div>
              <div className="text-xs text-yellow-600">Total Value</div>
            </div>
            <div className="bg-gray-50 p-3 rounded-lg">
              <div className="text-2xl font-bold text-gray-600">
                ${stats.averageValue.toFixed(0)}
              </div>
              <div className="text-xs text-gray-600">Avg. Value</div>
            </div>
          </div>

          {/* Search */}
          <div className="flex items-center space-x-4 mt-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search by item name, supplier, or notes..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          </div>

          {/* Filters Panel */}
          {showFiltersPanel && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mt-4 p-3 bg-gray-50 rounded-lg">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Status
                </label>
                <select
                  value={filters.status || ''}
                  onChange={(e) => setFilters({ ...filters, status: e.target.value as string })}
                  className="w-full px-3 py-1 text-sm border border-gray-300 rounded-md"
                >
                  <option value="">All Statuses</option>
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="ordered">Ordered</option>
                  <option value="received">Received</option>
                  <option value="cancelled">Cancelled</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Start Date
                </label>
                <Input
                  type="date"
                  value={filters.startDate || ''}
                  onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                  className="text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  End Date
                </label>
                <Input
                  type="date"
                  value={filters.endDate || ''}
                  onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                  className="text-sm"
                />
              </div>
              <div className="flex items-end">
                <Button
                  onClick={() => {
                    setFilters({ itemId, limit: maxEntries });
                    setSearchTerm('');
                    setCurrentPage(1);
                  }}
                  variant="outline"
                  size="sm"
                  className="w-full"
                >
                  Clear Filters
                </Button>
              </div>
            </div>
          )}
        </CardHeader>

        <CardContent className="p-0">
          {history.length === 0 ? (
            <div className="p-6 text-center">
              <History className="h-8 w-8 text-gray-400 mx-auto mb-2" />
              <p className="text-sm text-gray-600">No reorder history found</p>
              <p className="text-xs text-gray-500 mt-1">
                {filters.status || filters.startDate || filters.endDate || searchTerm
                  ? 'Try adjusting your filters'
                  : 'Reorder history will appear here once items are reordered'
                }
              </p>
            </div>
          ) : (
            <>
              <div className="divide-y divide-gray-200">
                {currentEntries.map((entry, index) => {
                  const statusConfig = getStatusConfig(entry.status);
                  const StatusIcon = statusConfig.icon;

                  return (
                    <div key={`${entry.itemId}-${entry.date}-${index}`} className="p-4 hover:bg-gray-50 transition-colors">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start space-x-3 flex-1">
                          <div className="p-2 bg-blue-50 rounded-lg">
                            <Package className="h-4 w-4 text-blue-600" />
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center space-x-2 mb-1">
                              <h4 className="font-medium text-gray-900 truncate">
                                {entry.itemName}
                              </h4>
                              <Badge className={statusConfig.color} variant="outline">
                                <StatusIcon className="h-3 w-3 mr-1" />
                                {statusConfig.label}
                              </Badge>
                              <Badge variant="outline">
                                {entry.itemCategory}
                              </Badge>
                            </div>

                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs text-gray-600 mb-2">
                              <div>
                                <span className="font-medium">Quantity:</span> {entry.quantity}
                              </div>
                              <div>
                                <span className="font-medium">Supplier:</span> {entry.supplier}
                              </div>
                              <div>
                                <span className="font-medium">Cost:</span>{' '}
                                {entry.actualCost ? (
                                  <span className="text-green-600 font-medium">
                                    ${entry.actualCost.toFixed(2)}
                                  </span>
                                ) : entry.estimatedCost ? (
                                  <span className="text-gray-500">
                                    ~${entry.estimatedCost.toFixed(2)}
                                  </span>
                                ) : (
                                  'TBD'
                                )}
                              </div>
                              {entry.approvedBy && (
                                <div>
                                  <span className="font-medium">Approved by:</span> {entry.approvedBy}
                                </div>
                              )}
                            </div>

                            <div className="flex items-center text-xs text-gray-500">
                              <Calendar className="h-3 w-3 mr-1" />
                              {new Date(entry.date).toLocaleDateString()}
                              {entry.orderDate && (
                                <>
                                  <span className="mx-2">•</span>
                                  <span>Ordered: {new Date(entry.orderDate).toLocaleDateString()}</span>
                                </>
                              )}
                              {entry.expectedDeliveryDate && (
                                <>
                                  <span className="mx-2">•</span>
                                  <span>Expected: {new Date(entry.expectedDeliveryDate).toLocaleDateString()}</span>
                                </>
                              )}
                            </div>

                            {entry.notes && (
                              <div className="mt-2 text-xs text-gray-600 bg-gray-50 p-2 rounded">
                                {entry.notes}
                              </div>
                            )}
                          </div>
                        </div>

                        <Button
                          onClick={() => {
                            setSelectedEntry(entry);
                            setShowDetailsModal(true);
                          }}
                          variant="ghost"
                          size="sm"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t">
                  <div className="text-sm text-gray-600">
                    Showing {startIndex + 1} to {Math.min(endIndex, history.length)} of {history.length} entries
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                      variant="outline"
                      size="sm"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-sm text-gray-600">
                      Page {currentPage} of {totalPages}
                    </span>
                    <Button
                      onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                      disabled={currentPage === totalPages}
                      variant="outline"
                      size="sm"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Entry Details Modal */}
      {showDetailsModal && selectedEntry && (
        <Modal
          isOpen={showDetailsModal}
          onClose={() => setShowDetailsModal(false)}
          title="Reorder Entry Details"
          size="lg"
        >
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-6">
              <div>
                <h3 className="font-medium text-gray-900 mb-3">Item Information</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Name:</span>
                    <span className="font-medium">{selectedEntry.itemName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Category:</span>
                    <span>{selectedEntry.itemCategory}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Quantity:</span>
                    <span className="font-medium">{selectedEntry.quantity}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Supplier:</span>
                    <span>{selectedEntry.supplier}</span>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="font-medium text-gray-900 mb-3">Order Details</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Status:</span>
                    <Badge className={getStatusConfig(selectedEntry.status).color}>
                      {getStatusConfig(selectedEntry.status).label}
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Request Date:</span>
                    <span>{new Date(selectedEntry.date).toLocaleDateString()}</span>
                  </div>
                  {selectedEntry.orderDate && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Order Date:</span>
                      <span>{new Date(selectedEntry.orderDate).toLocaleDateString()}</span>
                    </div>
                  )}
                  {selectedEntry.approvedBy && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Approved By:</span>
                      <span>{selectedEntry.approvedBy}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div>
              <h3 className="font-medium text-gray-900 mb-3">Financial Information</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Estimated Cost:</span>
                  <span>
                    {selectedEntry.estimatedCost
                      ? reorderService.formatCurrency(selectedEntry.estimatedCost)
                      : 'Not specified'
                    }
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Actual Cost:</span>
                  <span className={selectedEntry.actualCost ? 'font-medium text-green-600' : ''}>
                    {selectedEntry.actualCost
                      ? reorderService.formatCurrency(selectedEntry.actualCost)
                      : 'Not available'
                    }
                  </span>
                </div>
              </div>
            </div>

            {(selectedEntry.expectedDeliveryDate || selectedEntry.actualDeliveryDate) && (
              <div>
                <h3 className="font-medium text-gray-900 mb-3">Delivery Information</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  {selectedEntry.expectedDeliveryDate && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Expected Delivery:</span>
                      <span>{new Date(selectedEntry.expectedDeliveryDate).toLocaleDateString()}</span>
                    </div>
                  )}
                  {selectedEntry.actualDeliveryDate && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Actual Delivery:</span>
                      <span className="font-medium text-green-600">
                        {new Date(selectedEntry.actualDeliveryDate).toLocaleDateString()}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {selectedEntry.notes && (
              <div>
                <h3 className="font-medium text-gray-900 mb-3">Notes</h3>
                <div className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">
                  {selectedEntry.notes}
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}
    </>
  );
};

export default ReorderHistory;