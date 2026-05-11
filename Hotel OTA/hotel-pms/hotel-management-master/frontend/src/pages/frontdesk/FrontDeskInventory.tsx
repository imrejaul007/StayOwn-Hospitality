import React, { useState, useEffect, useCallback, useRef } from 'react';
import { format } from 'date-fns';
import {
  Package,
  AlertTriangle,
  Search,
  Filter,
  RefreshCw,
  TrendingUp,
  PackageX,
  ShoppingCart,
  DollarSign,
  ChevronDown,
  ChevronUp,
  Eye,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/Modal';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import ErrorBoundary from '../../components/ErrorBoundary';
import toast from 'react-hot-toast';
import { api } from '../../services/api';
import { useProperty } from '../../context/PropertyContext';
import { PropertyBreadcrumb } from '../../components/common/PropertyBreadcrumb';

interface InventoryItem {
  _id: string;
  name: string;
  sku: string;
  category: string;
  quantity: number;
  unit: string;
  minimumThreshold: number;
  maximumCapacity: number;
  costPerUnit?: number;
  supplier?: {
    name?: string;
    contact?: string;
    email?: string;
  };
  location?: {
    building?: string;
    floor?: string;
    room?: string;
    shelf?: string;
  };
  isLowStock?: boolean;
  lastRestocked?: string;
  expiryDate?: string;
  createdAt: string;
  updatedAt: string;
}

interface InventoryStats {
  total: number;
  lowStock: number;
  outOfStock: number;
  totalValue: number;
  categories: Record<string, number>;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

const CATEGORY_LABELS: Record<string, string> = {
  linens: 'Linens',
  toiletries: 'Toiletries',
  cleaning: 'Cleaning',
  maintenance: 'Maintenance',
  food_beverage: 'Food & Beverage',
  other: 'Other',
};

export default function FrontDeskInventory() {
  const { selectedPropertyId, viewMode } = useProperty();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [stats, setStats] = useState<InventoryStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);
  const [filters, setFilters] = useState<{
    category?: string;
    lowStock?: string;
    page: number;
    limit: number;
  }>({ page: 1, limit: 20 });
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 20,
    total: 0,
    pages: 0,
  });
  const [searchTerm, setSearchTerm] = useState('');
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  const fetchStats = useCallback(async () => {
    if (!selectedPropertyId) return;
    try {
      setStatsLoading(true);
      const response = await api.get('/inventory/stats', {
        params: { hotelId: selectedPropertyId },
      });
      setStats(response.data?.data?.stats || null);
    } catch {
      // Stats are non-critical, keep going
    } finally {
      setStatsLoading(false);
    }
  }, [selectedPropertyId]);

  const fetchItems = useCallback(async () => {
    if (!selectedPropertyId) return;
    try {
      setLoading(true);
      const params: Record<string, string | number> = {
        hotelId: selectedPropertyId,
        page: filters.page,
        limit: filters.limit,
      };
      if (filters.category) params.category = filters.category;
      if (filters.lowStock) params.lowStock = filters.lowStock;

      const response = await api.get('/inventory', { params });
      const data = response.data;
      setItems(data.data?.items || []);
      setPagination(
        data.pagination || { page: filters.page, limit: filters.limit, total: 0, pages: 0 }
      );
    } catch {
      toast.error('Failed to load inventory items');
    } finally {
      setLoading(false);
    }
  }, [selectedPropertyId, filters]);

  useEffect(() => {
    if (selectedPropertyId) {
      fetchItems();
      fetchStats();
    }
    return () => {
      if (debounceTimeoutRef.current) clearTimeout(debounceTimeoutRef.current);
    };
  }, [fetchItems, fetchStats]);

  const debouncedSearch = useCallback((term: string) => {
    if (debounceTimeoutRef.current) clearTimeout(debounceTimeoutRef.current);
    debounceTimeoutRef.current = setTimeout(() => setSearchTerm(term), 300);
  }, []);

  const displayedItems = searchTerm.trim()
    ? items.filter((item) => {
        const lower = searchTerm.toLowerCase();
        return (
          item.name.toLowerCase().includes(lower) ||
          item.sku.toLowerCase().includes(lower) ||
          (item.supplier?.name || '').toLowerCase().includes(lower) ||
          (item.location?.room || '').toLowerCase().includes(lower)
        );
      })
    : items;

  const toggleCategory = (cat: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  const getStockLevel = (item: InventoryItem) => {
    if (item.quantity === 0) return { label: 'Out of Stock', color: 'bg-red-100 text-red-800' };
    if (item.quantity <= item.minimumThreshold)
      return { label: 'Low Stock', color: 'bg-yellow-100 text-yellow-800' };
    if (item.quantity >= item.maximumCapacity * 0.8)
      return { label: 'Well Stocked', color: 'bg-green-100 text-green-800' };
    return { label: 'Normal', color: 'bg-blue-100 text-blue-800' };
  };

  const getStockPercentage = (item: InventoryItem) => {
    if (item.maximumCapacity === 0) return 0;
    return Math.min(100, Math.round((item.quantity / item.maximumCapacity) * 100));
  };

  const formatCurrency = (value?: number) => {
    if (value === undefined || value === null) return 'N/A';
    return `$${value.toFixed(2)}`;
  };

  const handleViewItem = (item: InventoryItem) => {
    setSelectedItem(item);
    setShowDetailModal(true);
  };

  if (!selectedPropertyId && viewMode === 'single') {
    return (
      <div className="p-6">
        <PropertyBreadcrumb items={['Inventory', 'Stock Levels']} />
        <div className="text-center py-12">
          <p className="text-gray-600">Please select a property to view inventory</p>
        </div>
      </div>
    );
  }

  if (loading && !items.length) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <ErrorBoundary level="page">
      <div className="space-y-6 p-6">
        <PropertyBreadcrumb items={['Inventory', 'Stock Levels']} />

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Inventory Stock Levels</h1>
            <p className="text-gray-600 mt-1 text-sm">
              Monitor supply stock levels, low-stock alerts, and reorder points
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={() => { fetchItems(); fetchStats(); }} size="sm" disabled={loading}>
              <RefreshCw className={`w-4 h-4 mr-1 ${loading ? 'animate-spin' : ''}`} /> Refresh
            </Button>
          </div>
        </div>

        {/* Stats cards */}
        {stats && !statsLoading && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4 flex items-center">
                <div className="p-2 bg-blue-100 rounded-lg mr-3">
                  <Package className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-600">Total Items</p>
                  <p className="text-xl font-bold">{stats.total}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex items-center">
                <div className="p-2 bg-yellow-100 rounded-lg mr-3">
                  <AlertTriangle className="h-5 w-5 text-yellow-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-600">Low Stock</p>
                  <p className="text-xl font-bold text-yellow-700">{stats.lowStock}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex items-center">
                <div className="p-2 bg-red-100 rounded-lg mr-3">
                  <PackageX className="h-5 w-5 text-red-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-600">Out of Stock</p>
                  <p className="text-xl font-bold text-red-700">{stats.outOfStock}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex items-center">
                <div className="p-2 bg-green-100 rounded-lg mr-3">
                  <DollarSign className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-600">Total Value</p>
                  <p className="text-xl font-bold">{formatCurrency(stats.totalValue)}</p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Category breakdown */}
        {stats && stats.categories && Object.keys(stats.categories).length > 0 && (
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center mb-3">
                <TrendingUp className="h-5 w-5 text-gray-500 mr-2" />
                <h2 className="font-semibold text-gray-800">Category Breakdown</h2>
              </div>
              <div className="flex flex-wrap gap-2">
                {Object.entries(stats.categories).map(([cat, count]) => (
                  <button
                    key={cat}
                    onClick={() => {
                      if (filters.category === cat) {
                        setFilters({ ...filters, category: undefined, page: 1 });
                      } else {
                        setFilters({ ...filters, category: cat, page: 1 });
                      }
                    }}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                      filters.category === cat
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {CATEGORY_LABELS[cat] || cat} ({count})
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center mb-4">
              <Filter className="h-5 w-5 text-gray-500 mr-2" />
              <h2 className="font-semibold text-gray-800">Filters</h2>
            </div>

            <div className="mb-4 relative">
              <input
                type="text"
                placeholder="Search by name, SKU, supplier, or location..."
                className="w-full border rounded-lg px-4 py-2 pl-10 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-200"
                onChange={(e) => debouncedSearch(e.target.value)}
              />
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                <select
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                  value={filters.category || ''}
                  onChange={(e) =>
                    setFilters({ ...filters, category: e.target.value || undefined, page: 1 })
                  }
                >
                  <option value="">All Categories</option>
                  {Object.entries(CATEGORY_LABELS).map(([val, label]) => (
                    <option key={val} value={val}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Stock Status
                </label>
                <select
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                  value={filters.lowStock || ''}
                  onChange={(e) =>
                    setFilters({ ...filters, lowStock: e.target.value || undefined, page: 1 })
                  }
                >
                  <option value="">All Stock Levels</option>
                  <option value="true">Low Stock Only</option>
                </select>
              </div>
              <div className="flex items-end">
                <Button
                  onClick={() => setFilters({ page: 1, limit: 20 })}
                  variant="outline"
                  size="sm"
                  className="w-full"
                >
                  <RefreshCw className="h-4 w-4 mr-1" /> Reset
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Inventory table */}
        <Card>
          <CardContent className="p-0">
            {displayedItems.length === 0 && !loading ? (
              <div className="p-12 text-center">
                <Package className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Inventory Items Found</h3>
                <p className="text-gray-500">No items match the current filters.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium text-gray-600">Item</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-600">Category</th>
                      <th className="px-4 py-3 text-center font-medium text-gray-600">Stock</th>
                      <th className="px-4 py-3 text-center font-medium text-gray-600">Status</th>
                      <th className="px-4 py-3 text-right font-medium text-gray-600">Unit Cost</th>
                      <th className="px-4 py-3 text-center font-medium text-gray-600">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {displayedItems.map((item) => {
                      const stockLevel = getStockLevel(item);
                      const stockPct = getStockPercentage(item);
                      return (
                        <tr key={item._id} className="hover:bg-gray-50">
                          <td className="px-4 py-3">
                            <div className="font-medium text-gray-900">{item.name}</div>
                            <div className="text-xs text-gray-500">SKU: {item.sku}</div>
                          </td>
                          <td className="px-4 py-3 text-gray-600">
                            {CATEGORY_LABELS[item.category] || item.category}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <div className="flex flex-col items-center">
                              <span className="font-semibold">
                                {item.quantity} / {item.maximumCapacity}
                              </span>
                              <span className="text-xs text-gray-500">{item.unit}</span>
                              <div className="w-20 bg-gray-200 rounded-full h-1.5 mt-1">
                                <div
                                  className={`h-1.5 rounded-full ${
                                    item.quantity === 0
                                      ? 'bg-red-500'
                                      : item.quantity <= item.minimumThreshold
                                      ? 'bg-yellow-500'
                                      : 'bg-green-500'
                                  }`}
                                  style={{ width: `${stockPct}%` }}
                                />
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span
                              className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${stockLevel.color}`}
                            >
                              {stockLevel.label}
                            </span>
                            {item.quantity <= item.minimumThreshold && item.quantity > 0 && (
                              <div className="text-xs text-gray-500 mt-1">
                                Reorder at: {item.minimumThreshold}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right text-gray-700">
                            {formatCurrency(item.costPerUnit)}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleViewItem(item)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pagination */}
        {!searchTerm.trim() && pagination.pages > 1 && (
          <div className="flex items-center justify-between pt-4">
            <span className="text-sm text-gray-600">
              Page {pagination.page} of {pagination.pages} ({pagination.total} items)
            </span>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={pagination.page <= 1}
                onClick={() => setFilters({ ...filters, page: filters.page - 1 })}
              >
                Previous
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={pagination.page >= pagination.pages}
                onClick={() => setFilters({ ...filters, page: filters.page + 1 })}
              >
                Next
              </Button>
            </div>
          </div>
        )}

        {/* Detail Modal */}
        {selectedItem && (
          <Modal
            isOpen={showDetailModal}
            onClose={() => setShowDetailModal(false)}
            title="Inventory Item Details"
          >
            <div className="space-y-4">
              <div className="flex items-start space-x-3">
                <div className="p-2 rounded-lg bg-blue-100">
                  <Package className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold">{selectedItem.name}</h3>
                  <p className="text-sm text-gray-500">SKU: {selectedItem.sku}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">Category</label>
                  <div className="mt-1 font-medium">
                    {CATEGORY_LABELS[selectedItem.category] || selectedItem.category}
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Unit</label>
                  <div className="mt-1 font-medium">{selectedItem.unit}</div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">Current Stock</label>
                  <div className="mt-1 font-semibold text-lg">{selectedItem.quantity}</div>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Reorder Point</label>
                  <div className="mt-1 font-medium">{selectedItem.minimumThreshold}</div>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Max Capacity</label>
                  <div className="mt-1 font-medium">{selectedItem.maximumCapacity}</div>
                </div>
              </div>

              {/* Stock bar */}
              <div>
                <label className="text-sm font-medium text-gray-500">Stock Level</label>
                <div className="mt-2 w-full bg-gray-200 rounded-full h-3">
                  <div
                    className={`h-3 rounded-full ${
                      selectedItem.quantity === 0
                        ? 'bg-red-500'
                        : selectedItem.quantity <= selectedItem.minimumThreshold
                        ? 'bg-yellow-500'
                        : 'bg-green-500'
                    }`}
                    style={{ width: `${getStockPercentage(selectedItem)}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>0</span>
                  <span className="text-yellow-600">
                    Reorder: {selectedItem.minimumThreshold}
                  </span>
                  <span>{selectedItem.maximumCapacity}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">Cost per Unit</label>
                  <div className="mt-1 font-medium">
                    {formatCurrency(selectedItem.costPerUnit)}
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Total Value</label>
                  <div className="mt-1 font-medium">
                    {formatCurrency(
                      (selectedItem.costPerUnit || 0) * selectedItem.quantity
                    )}
                  </div>
                </div>
              </div>

              {selectedItem.supplier?.name && (
                <div>
                  <label className="text-sm font-medium text-gray-500">Supplier</label>
                  <div className="mt-1 bg-gray-50 p-3 rounded-md text-sm">
                    <div className="font-medium">{selectedItem.supplier.name}</div>
                    {selectedItem.supplier.contact && (
                      <div className="text-gray-500">{selectedItem.supplier.contact}</div>
                    )}
                    {selectedItem.supplier.email && (
                      <div className="text-gray-500">{selectedItem.supplier.email}</div>
                    )}
                  </div>
                </div>
              )}

              {selectedItem.location && (selectedItem.location.building || selectedItem.location.room) && (
                <div>
                  <label className="text-sm font-medium text-gray-500">Location</label>
                  <div className="mt-1 bg-gray-50 p-3 rounded-md text-sm">
                    {selectedItem.location.building && (
                      <span>Building: {selectedItem.location.building} </span>
                    )}
                    {selectedItem.location.floor && (
                      <span>| Floor: {selectedItem.location.floor} </span>
                    )}
                    {selectedItem.location.room && (
                      <span>| Room: {selectedItem.location.room} </span>
                    )}
                    {selectedItem.location.shelf && (
                      <span>| Shelf: {selectedItem.location.shelf}</span>
                    )}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4 text-sm">
                {selectedItem.lastRestocked && (
                  <div>
                    <label className="text-sm font-medium text-gray-500">Last Restocked</label>
                    <div className="mt-1">
                      {format(new Date(selectedItem.lastRestocked), 'MMM dd, yyyy')}
                    </div>
                  </div>
                )}
                {selectedItem.expiryDate && (
                  <div>
                    <label className="text-sm font-medium text-gray-500">Expiry Date</label>
                    <div className="mt-1">
                      {format(new Date(selectedItem.expiryDate), 'MMM dd, yyyy')}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t mt-4">
              <Button variant="outline" onClick={() => setShowDetailModal(false)}>
                Close
              </Button>
            </div>
          </Modal>
        )}
      </div>
    </ErrorBoundary>
  );
}
