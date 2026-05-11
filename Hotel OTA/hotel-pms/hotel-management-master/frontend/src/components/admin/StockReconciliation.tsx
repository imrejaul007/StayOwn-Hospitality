import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FaCheckCircle,
  FaExclamationTriangle,
  FaClipboardList,
  FaSave,
  FaUndo,
  FaDownload,
  FaSearch,
  FaFilter,
  FaCalculator,
  FaBarcode,
  FaEdit,
  FaCheck,
  FaTimes,
  FaInfoCircle,
  FaSort
} from 'react-icons/fa';
import { inventoryService } from '../../services/inventoryService';
import { stockMovementsService } from '../../services/stockMovementsService';
import { format } from 'date-fns';

interface InventoryItem {
  _id: string;
  name: string;
  category: string;
  stock: number;
  unit: string;
  minStock: number;
  maxStock: number;
  location?: {
    building?: string;
    floor?: string;
    room?: string;
    shelf?: string;
  };
  lastUpdated: string;
}

interface ReconciliationItem extends InventoryItem {
  physicalCount: number | null;
  variance: number;
  variancePercentage: number;
  needsAdjustment: boolean;
  isEditing: boolean;
  notes: string;
}

interface ReconciliationSummary {
  totalItems: number;
  itemsReconciled: number;
  itemsWithVariance: number;
  totalVariance: number;
  totalVarianceValue: number;
}

const StockReconciliation: React.FC = () => {
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [reconciliationItems, setReconciliationItems] = useState<ReconciliationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [showVarianceOnly, setShowVarianceOnly] = useState(false);
  const [reconciliationNotes, setReconciliationNotes] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'category' | 'variance' | 'stock'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Fetch inventory items
  const fetchInventoryItems = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await inventoryService.getInventoryItems({
        page: 1,
        limit: 1000, // Get all items for reconciliation
        includeInactive: false
      });

      if (response.success) {
        setInventoryItems(response.data.items);

        // Initialize reconciliation items
        const reconciliation = response.data.items.map((item: InventoryItem) => ({
          ...item,
          physicalCount: null,
          variance: 0,
          variancePercentage: 0,
          needsAdjustment: false,
          isEditing: false,
          notes: ''
        }));

        setReconciliationItems(reconciliation);
      } else {
        setError('Failed to fetch inventory items');
      }
    } catch (err: unknown) {
      setError(err.message || 'Failed to fetch inventory items');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInventoryItems();
  }, []);

  // Update physical count for an item
  const updatePhysicalCount = (itemId: string, physicalCount: number | null) => {
    setReconciliationItems(prev => prev.map(item => {
      if (item._id === itemId) {
        const variance = physicalCount !== null ? physicalCount - item.stock : 0;
        const variancePercentage = item.stock > 0 ? (variance / item.stock) * 100 : 0;
        const needsAdjustment = Math.abs(variance) > 0.001;

        return {
          ...item,
          physicalCount,
          variance,
          variancePercentage,
          needsAdjustment
        };
      }
      return item;
    }));
  };

  // Update notes for an item
  const updateItemNotes = (itemId: string, notes: string) => {
    setReconciliationItems(prev => prev.map(item =>
      item._id === itemId ? { ...item, notes } : item
    ));
  };

  // Toggle editing mode for an item
  const toggleEditMode = (itemId: string) => {
    setReconciliationItems(prev => prev.map(item =>
      item._id === itemId ? { ...item, isEditing: !item.isEditing } : item
    ));
  };

  // Reset reconciliation data
  const resetReconciliation = () => {
    const reconciliation = inventoryItems.map(item => ({
      ...item,
      physicalCount: null,
      variance: 0,
      variancePercentage: 0,
      needsAdjustment: false,
      isEditing: false,
      notes: ''
    }));

    setReconciliationItems(reconciliation);
    setReconciliationNotes('');
  };

  // Save reconciliation
  const saveReconciliation = async () => {
    try {
      setSaving(true);
      setError(null);

      const itemsToReconcile = reconciliationItems.filter(item =>
        item.physicalCount !== null && item.needsAdjustment
      );

      if (itemsToReconcile.length === 0) {
        setError('No items with variance to reconcile');
        return;
      }

      const reconciliationData = {
        itemCounts: itemsToReconcile.map(item => ({
          itemId: item._id,
          physicalCount: item.physicalCount!
        })),
        notes: reconciliationNotes || 'Stock reconciliation'
      };

      const response = await stockMovementsService.reconcileInventory(reconciliationData);

      if (response.success) {
        // Refresh inventory data
        await fetchInventoryItems();

        // Show success message
        alert(`Reconciliation completed successfully! ${response.data.summary.itemsAdjusted} items adjusted.`);
      } else {
        setError('Failed to save reconciliation');
      }
    } catch (err: unknown) {
      setError(err.message || 'Failed to save reconciliation');
    } finally {
      setSaving(false);
    }
  };

  // Export reconciliation data
  const exportReconciliation = () => {
    const exportData = {
      reconciliationDate: new Date().toISOString(),
      notes: reconciliationNotes,
      summary: reconciliationSummary,
      items: reconciliationItems.map(item => ({
        name: item.name,
        category: item.category,
        systemStock: item.stock,
        physicalCount: item.physicalCount,
        variance: item.variance,
        variancePercentage: item.variancePercentage,
        needsAdjustment: item.needsAdjustment,
        unit: item.unit,
        notes: item.notes
      }))
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `stock_reconciliation_${format(new Date(), 'yyyy-MM-dd_HH-mm')}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  // Get unique categories
  const categories = useMemo(() => {
    const uniqueCategories = [...new Set(inventoryItems.map(item => item.category))];
    return uniqueCategories.sort();
  }, [inventoryItems]);

  // Filter and sort items
  const filteredItems = useMemo(() => {
    let filtered = reconciliationItems.filter(item => {
      const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           item.category.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = !selectedCategory || item.category === selectedCategory;
      const matchesVariance = !showVarianceOnly || item.needsAdjustment;

      return matchesSearch && matchesCategory && matchesVariance;
    });

    // Sort items
    filtered.sort((a, b) => {
      let valueA: unknown, valueB: unknown;

      switch (sortBy) {
        case 'name':
          valueA = a.name.toLowerCase();
          valueB = b.name.toLowerCase();
          break;
        case 'category':
          valueA = a.category.toLowerCase();
          valueB = b.category.toLowerCase();
          break;
        case 'variance':
          valueA = Math.abs(a.variance);
          valueB = Math.abs(b.variance);
          break;
        case 'stock':
          valueA = a.stock;
          valueB = b.stock;
          break;
        default:
          valueA = a.name.toLowerCase();
          valueB = b.name.toLowerCase();
      }

      if (sortOrder === 'asc') {
        return valueA < valueB ? -1 : valueA > valueB ? 1 : 0;
      } else {
        return valueA > valueB ? -1 : valueA < valueB ? 1 : 0;
      }
    });

    return filtered;
  }, [reconciliationItems, searchTerm, selectedCategory, showVarianceOnly, sortBy, sortOrder]);

  // Calculate reconciliation summary
  const reconciliationSummary: ReconciliationSummary = useMemo(() => {
    const totalItems = reconciliationItems.length;
    const itemsReconciled = reconciliationItems.filter(item => item.physicalCount !== null).length;
    const itemsWithVariance = reconciliationItems.filter(item => item.needsAdjustment).length;
    const totalVariance = reconciliationItems.reduce((sum, item) => sum + Math.abs(item.variance), 0);
    const totalVarianceValue = reconciliationItems.reduce((sum, item) =>
      sum + Math.abs(item.variance) * (item.stock > 0 ? 1 : 0), 0 // Simplified value calculation
    );

    return {
      totalItems,
      itemsReconciled,
      itemsWithVariance,
      totalVariance,
      totalVarianceValue
    };
  }, [reconciliationItems]);

  if (loading) {
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
          <FaClipboardList className="h-6 w-6 text-blue-600" />
          <h2 className="text-2xl font-bold text-gray-900">Stock Reconciliation</h2>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={exportReconciliation}
            className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            <FaDownload className="h-4 w-4 mr-2" />
            Export
          </button>

          <button
            onClick={resetReconciliation}
            className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            <FaUndo className="h-4 w-4 mr-2" />
            Reset
          </button>

          <button
            onClick={saveReconciliation}
            disabled={saving || reconciliationSummary.itemsWithVariance === 0}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
            ) : (
              <FaSave className="h-4 w-4 mr-2" />
            )}
            Save Reconciliation
          </button>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <FaExclamationTriangle className="h-5 w-5 text-red-400" />
            </div>
            <div className="ml-3">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <FaClipboardList className="h-6 w-6 text-gray-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Total Items
                  </dt>
                  <dd className="text-lg font-medium text-gray-900">
                    {reconciliationSummary.totalItems}
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
                <FaCheckCircle className="h-6 w-6 text-blue-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Reconciled
                  </dt>
                  <dd className="text-lg font-medium text-gray-900">
                    {reconciliationSummary.itemsReconciled}
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
                <FaExclamationTriangle className="h-6 w-6 text-yellow-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    With Variance
                  </dt>
                  <dd className="text-lg font-medium text-gray-900">
                    {reconciliationSummary.itemsWithVariance}
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
                <FaCalculator className="h-6 w-6 text-green-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Total Variance
                  </dt>
                  <dd className="text-lg font-medium text-gray-900">
                    {reconciliationSummary.totalVariance.toFixed(2)}
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
                <span className="text-lg">📊</span>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Progress
                  </dt>
                  <dd className="text-lg font-medium text-gray-900">
                    {reconciliationSummary.totalItems > 0
                      ? Math.round((reconciliationSummary.itemsReconciled / reconciliationSummary.totalItems) * 100)
                      : 0}%
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="bg-white p-4 rounded-lg shadow">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700">Reconciliation Progress</span>
          <span className="text-sm text-gray-500">
            {reconciliationSummary.itemsReconciled} of {reconciliationSummary.totalItems} items
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
            style={{
              width: `${reconciliationSummary.totalItems > 0
                ? (reconciliationSummary.itemsReconciled / reconciliationSummary.totalItems) * 100
                : 0}%`
            }}
          ></div>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="bg-white p-4 rounded-lg shadow">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="relative">
            <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search items..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">All Categories</option>
            {categories.map(category => (
              <option key={category} value={category}>{category}</option>
            ))}
          </select>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as unknown)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="name">Sort by Name</option>
            <option value="category">Sort by Category</option>
            <option value="stock">Sort by Stock</option>
            <option value="variance">Sort by Variance</option>
          </select>

          <button aria-label="Sort"
            onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
            className="inline-flex items-center justify-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            <FaSort className="h-4 w-4 mr-2" />
            {sortOrder === 'asc' ? 'A-Z' : 'Z-A'}
          </button>

          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={showVarianceOnly}
              onChange={(e) => setShowVarianceOnly(e.target.checked)}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <span className="text-sm font-medium text-gray-700">Variance Only</span>
          </label>
        </div>
      </div>

      {/* Reconciliation Notes */}
      <div className="bg-white p-4 rounded-lg shadow">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Reconciliation Notes
        </label>
        <textarea
          value={reconciliationNotes}
          onChange={(e) => setReconciliationNotes(e.target.value)}
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          placeholder="Add notes about this reconciliation..."
        />
      </div>

      {/* Items Table */}
      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        <div className="min-w-full">
          {/* Table Header */}
          <div className="bg-gray-50 px-6 py-3 border-b border-gray-200">
            <div className="grid grid-cols-8 gap-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              <div className="col-span-2">Item Details</div>
              <div>System Stock</div>
              <div>Physical Count</div>
              <div>Variance</div>
              <div>Variance %</div>
              <div>Status</div>
              <div>Actions</div>
            </div>
          </div>

          {/* Table Body */}
          <div className="bg-white divide-y divide-gray-200">
            {filteredItems.length === 0 ? (
              <div className="px-6 py-12 text-center text-gray-500">
                <FaClipboardList className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <p className="text-lg font-medium">No items found</p>
                <p className="text-sm">Try adjusting your search filters</p>
              </div>
            ) : (
              filteredItems.map((item) => (
                <motion.div
                  key={item._id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="px-6 py-4 hover:bg-gray-50"
                >
                  <div className="grid grid-cols-8 gap-4 items-center">
                    {/* Item Details */}
                    <div className="col-span-2">
                      <div className="text-sm font-medium text-gray-900">
                        {item.name}
                      </div>
                      <div className="text-sm text-gray-500">
                        {item.category}
                      </div>
                      <div className="text-xs text-gray-400">
                        Unit: {item.unit}
                      </div>
                    </div>

                    {/* System Stock */}
                    <div className="text-sm text-gray-900">
                      <span className="font-medium">{item.stock}</span>
                      <span className="text-gray-500 ml-1">{item.unit}</span>
                    </div>

                    {/* Physical Count */}
                    <div>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.physicalCount || ''}
                        onChange={(e) => updatePhysicalCount(item._id, e.target.value ? parseFloat(e.target.value) : null)}
                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Enter count"
                      />
                    </div>

                    {/* Variance */}
                    <div className="text-sm">
                      {item.physicalCount !== null ? (
                        <span className={`font-medium ${
                          item.variance > 0 ? 'text-green-600' :
                          item.variance < 0 ? 'text-red-600' : 'text-gray-600'
                        }`}>
                          {item.variance > 0 ? '+' : ''}{item.variance.toFixed(2)}
                        </span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </div>

                    {/* Variance % */}
                    <div className="text-sm">
                      {item.physicalCount !== null ? (
                        <span className={`font-medium ${
                          Math.abs(item.variancePercentage) > 10 ? 'text-red-600' :
                          Math.abs(item.variancePercentage) > 5 ? 'text-yellow-600' : 'text-green-600'
                        }`}>
                          {item.variancePercentage.toFixed(1)}%
                        </span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </div>

                    {/* Status */}
                    <div>
                      {item.physicalCount === null ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                          Pending
                        </span>
                      ) : item.needsAdjustment ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                          <FaExclamationTriangle className="h-3 w-3 mr-1" />
                          Needs Adjustment
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          <FaCheckCircle className="h-3 w-3 mr-1" />
                          Matched
                        </span>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center space-x-2">
                      <button aria-label="Edit"
                        onClick={() => toggleEditMode(item._id)}
                        className="text-gray-400 hover:text-gray-600"
                        title="Add notes"
                      >
                        <FaEdit className="h-4 w-4" />
                      </button>

                      {item.needsAdjustment && (
                        <FaInfoCircle
                          className="h-4 w-4 text-yellow-500"
                          title={`Variance: ${item.variance.toFixed(2)} ${item.unit}`}
                        />
                      )}
                    </div>
                  </div>

                  {/* Notes Row */}
                  <AnimatePresence>
                    {item.isEditing && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="mt-3 pt-3 border-t border-gray-200"
                      >
                        <div className="flex items-center space-x-3">
                          <input
                            type="text"
                            value={item.notes}
                            onChange={(e) => updateItemNotes(item._id, e.target.value)}
                            className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            placeholder="Add notes about this count..."
                          />
                          <button aria-label="Edit"
                            onClick={() => toggleEditMode(item._id)}
                            className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-blue-700 bg-blue-100 hover:bg-blue-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                          >
                            <FaCheck className="h-4 w-4" />
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Help Text */}
      <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
        <div className="flex">
          <div className="flex-shrink-0">
            <FaInfoCircle className="h-5 w-5 text-blue-400" />
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-blue-800">
              How to use Stock Reconciliation
            </h3>
            <div className="mt-2 text-sm text-blue-700">
              <ol className="list-decimal list-inside space-y-1">
                <li>Enter the physical count for each item you want to reconcile</li>
                <li>The system will automatically calculate variance and percentage differences</li>
                <li>Items with variance will be marked as "Needs Adjustment"</li>
                <li>Add notes for any items that need explanation</li>
                <li>Click "Save Reconciliation" to create adjustment transactions for items with variance</li>
              </ol>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StockReconciliation;