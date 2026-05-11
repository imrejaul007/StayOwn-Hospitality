
import React, { useState, useEffect } from 'react';
import { format, parseISO } from 'date-fns';
import {
  Package,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Filter,
  Plus,
  Eye,
  Edit,
  Trash2,
  ShoppingCart,
  MapPin,
  Calendar,
  Coins,
  BarChart3,
  RefreshCw,
  Building,
  Phone,
  Mail,
  Save,
  X,
  CheckCircle,
  LineChart,
  DollarSign,
  Shield,
  Target
} from 'lucide-react';
import { useProperty } from '../../context/PropertyContext';
import { PropertyBreadcrumb } from '../../components/common/PropertyBreadcrumb';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/Modal';
import { DataTable } from '../../components/dashboard/DataTable';
import { StatusBadge } from '../../components/dashboard/StatusBadge';
import InventoryTrendAnalysis from '../../components/admin/InventoryTrendAnalysis';
import CostOptimizationDashboard from '../../components/admin/CostOptimizationDashboard';
import ComplianceCenter from '../../components/admin/ComplianceCenter';
import PredictiveDemandChart from '../../components/admin/PredictiveDemandChart';
import { adminService } from '../../services/adminService';
import { InventoryItem } from '../../types/admin';
import { formatNumber, formatCurrency } from '../../utils/dashboardUtils';
import { withErrorBoundary } from '../../components/ErrorBoundary';
import toast from 'react-hot-toast';

interface InventoryFilters {
  category?: string;
  lowStock?: boolean;
  page?: number;
  limit?: number;
}

interface InventoryStats {
  total: number;
  lowStock: number;
  outOfStock: number;
  totalValue: number;
  categories: {
    [key: string]: number;
  };
}

function AdminInventory() {
  const { selectedPropertyId } = useProperty();

  // State
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [stats, setStats] = useState<InventoryStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showRestockModal, setShowRestockModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    sku: '',
    category: 'linens' as 'linens' | 'toiletries' | 'cleaning' | 'maintenance' | 'food_beverage' | 'other',
    quantity: 0,
    unit: 'pieces' as 'pieces' | 'bottles' | 'rolls' | 'kg' | 'liters' | 'sets',
    minimumThreshold: 0,
    maximumCapacity: 0,
    costPerUnit: 0,
    supplier: {
      name: '',
      contact: '',
      email: ''
    },
    location: {
      building: '',
      floor: '',
      room: '',
      shelf: ''
    }
  });
  const [restockData, setRestockData] = useState({
    quantity: 0,
    costPerUnit: 0
  });
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkAction, setBulkAction] = useState<'restock' | 'update' | 'export'>('restock');
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [activeAnalyticsTab, setActiveAnalyticsTab] = useState<'overview' | 'trends' | 'cost' | 'compliance' | 'forecasting'>('overview');
  const [analyticsData, setAnalyticsData] = useState({
    categoryDistribution: {} as { [key: string]: number },
    stockTrends: [] as unknown[],
    lowStockAlerts: [] as Array<{
      id: string;
      name: string;
      currentStock: number;
      minimumThreshold: number;
      category: string;
      urgency: string;
    }>,
    costAnalysis: {} as {
      totalValue: number;
      averageCost: number;
      highestCost: number;
      lowestCost: number;
    },
    supplierPerformance: {} as { [key: string]: { items: number; totalValue: number; lowStockItems: number } }
  });
  const [advancedFilters, setAdvancedFilters] = useState({
    dateRange: { start: '', end: '' },
    costRange: { min: 0, max: 10000 },
    supplier: '',
    location: '',
    lastRestocked: ''
  });
  const [filters, setFilters] = useState<InventoryFilters>({
    page: 1,
    limit: 10
  });
  const [pagination, setPagination] = useState({
    current: 1,
    pages: 1,
    total: 0
  });

  // Fetch inventory items
  const fetchItems = async () => {
    if (!selectedPropertyId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const response = await adminService.getInventoryItems({
        ...filters,
        hotelId: selectedPropertyId
      });
      setItems(response.data.items || []);
      // Backend returns { page, limit, total, pages } — map `page` to `current`
      const pag = response.pagination as unknown as { page?: number; current?: number; pages: number; total: number } | undefined;
      if (pag) {
        setPagination({
          current: pag.current ?? pag.page ?? 1,
          pages: pag.pages ?? 1,
          total: pag.total ?? 0
        });
      }
    } catch {
      toast.error('Failed to load inventory items');
    } finally {
      setLoading(false);
    }
  };

  // Fetch stats from dedicated backend endpoint (aggregated across ALL items)
  const fetchStats = async () => {
    if (!selectedPropertyId) return;
    try {
      const response = await adminService.getInventoryStats(selectedPropertyId);
      setStats(response.data.stats);
    } catch {
      // Fallback: if endpoint unavailable, at least show pagination total
      setStats({
        total: pagination.total,
        lowStock: 0,
        outOfStock: 0,
        totalValue: 0,
        categories: {}
      });
    }
  };

  // Safely compute isLowStock (fallback if virtual not serialized by backend)
  const itemIsLowStock = (item: InventoryItem): boolean =>
    item.isLowStock ?? item.quantity <= item.minimumThreshold;

  // Reset to page 1 when selected property changes to avoid stale pagination state
  const prevPropertyIdRef = React.useRef<string | null>(null);
  useEffect(() => {
    if (selectedPropertyId && selectedPropertyId !== prevPropertyIdRef.current) {
      prevPropertyIdRef.current = selectedPropertyId;
      setFilters(prev => ({ ...prev, page: 1 }));
    }
  }, [selectedPropertyId]);

  // Load data on mount and filter changes
  useEffect(() => {
    if (selectedPropertyId) {
      fetchItems();
      fetchStats();
    }
  }, [filters, selectedPropertyId]);

  useEffect(() => {
    if (items.length > 0) {
      calculateAnalytics(); // Phase 5: Calculate analytics when items change
    }
  }, [items]);

  // Handle item update
  const handleUpdateItem = async (itemId: string, updates: Partial<InventoryItem>) => {
    try {
      setUpdating(true);
      await adminService.updateInventoryItem(itemId, updates);
      toast.success('Inventory item updated successfully');
      await Promise.all([fetchItems(), fetchStats()]);
    } catch {
      toast.error('Failed to update inventory item');
    } finally {
      setUpdating(false);
    }
  };

  // Handle item creation
  const handleCreateItem = async (itemData: Partial<InventoryItem>) => {
    try {
      setUpdating(true);
      await adminService.createInventoryItem({ ...itemData, hotelId: selectedPropertyId });
      toast.success('Inventory item created successfully');
      await Promise.all([fetchItems(), fetchStats()]);
      setShowCreateModal(false);
    } catch {
      toast.error('Failed to create inventory item');
    } finally {
      setUpdating(false);
    }
  };

  // Handle restock
  const handleRestock = async (itemId: string, quantity: number, costPerUnit: number) => {
    try {
      setUpdating(true);
      await adminService.restockInventoryItem(itemId, {
        quantity,
        ...(costPerUnit > 0 ? { costPerUnit } : {})
      });

      toast.success('Item restocked successfully');
      await Promise.all([fetchItems(), fetchStats()]);
      setShowRestockModal(false);
      setRestockData({ quantity: 0, costPerUnit: 0 });
    } catch {
      toast.error('Failed to restock item');
    } finally {
      setUpdating(false);
    }
  };

  // Handle item deletion
  const handleDeleteItem = async (itemId: string) => {
    if (!window.confirm('Are you sure you want to delete this inventory item?')) return;
    try {
      setUpdating(true);
      await adminService.deleteInventoryItem(itemId);
      toast.success('Inventory item deleted successfully');
      await Promise.all([fetchItems(), fetchStats()]);
    } catch {
      toast.error('Failed to delete inventory item');
    } finally {
      setUpdating(false);
    }
  };

  // Reset form data
  const resetFormData = () => {
    setFormData({
      name: '',
      sku: '',
      category: 'linens',
      quantity: 0,
      unit: 'pieces',
      minimumThreshold: 0,
      maximumCapacity: 0,
      costPerUnit: 0,
      supplier: {
        name: '',
        contact: '',
        email: ''
      },
      location: {
        building: '',
        floor: '',
        room: '',
        shelf: ''
      }
    });
  };

  // Open create modal
  const openCreateModal = () => {
    resetFormData();
    setShowCreateModal(true);
  };

  // Open edit modal
  const openEditModal = (item: InventoryItem) => {
    setFormData({
      name: item.name,
      sku: item.sku,
      category: item.category,
      quantity: item.quantity,
      unit: item.unit,
      minimumThreshold: item.minimumThreshold,
      maximumCapacity: item.maximumCapacity,
      costPerUnit: item.costPerUnit || 0,
      supplier: item.supplier || { name: '', contact: '', email: '' },
      location: {
        building: item.location?.building || '',
        floor: item.location?.floor || '',
        room: item.location?.room || '',
        shelf: item.location?.shelf || ''
      }
    });
    setSelectedItem(item);
    setShowEditModal(true);
  };

  // Open restock modal
  const openRestockModal = (item: InventoryItem) => {
    setSelectedItem(item);
    setRestockData({
      quantity: 0,
      costPerUnit: item.costPerUnit || 0
    });
    setShowRestockModal(true);
  };

  // Bulk operations
  const handleBulkRestock = async (quantity: number, costPerUnit: number) => {
    try {
      setUpdating(true);
      const promises = selectedItems.map(itemId => {
        return adminService.restockInventoryItem(itemId, {
          quantity,
          ...(costPerUnit > 0 ? { costPerUnit } : {})
        });
      });
      
      await Promise.all(promises);
      toast.success(`${selectedItems.length} items restocked successfully`);
      await Promise.all([fetchItems(), fetchStats()]);
      setSelectedItems([]);
      setShowBulkModal(false);
    } catch {
      toast.error('Failed to perform bulk restock');
    } finally {
      setUpdating(false);
    }
  };

  const handleBulkExport = () => {
    const selectedData = items.filter(item => selectedItems.includes(item._id));
    if (selectedData.length === 0) {
      setSelectedItems([]);
      setShowBulkModal(false);
      return;
    }
    const csvData = selectedData.map(item => ({
      Name: item.name,
      SKU: item.sku,
      Category: item.category,
      Quantity: item.quantity,
      Unit: item.unit,
      'Cost Per Unit': item.costPerUnit || 0,
      'Min Threshold': item.minimumThreshold,
      'Max Capacity': item.maximumCapacity,
      'Low Stock': (item.isLowStock ?? item.quantity <= item.minimumThreshold) ? 'Yes' : 'No',
      'Last Restocked': item.lastRestocked ? format(parseISO(item.lastRestocked), 'MMM dd, yyyy') : 'Never',
      'Supplier': item.supplier?.name || '',
      'Location': item.location ? `${item.location.building || ''} ${item.location.floor || ''} ${item.location.room || ''}`.trim() : ''
    }));

    const csv = [
      Object.keys(csvData[0]).join(','),
      ...csvData.map(row => Object.values(row).map(value => `"${value}"`).join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = `inventory-export-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);

    setSelectedItems([]);
    setShowBulkModal(false);
  };

  const toggleItemSelection = (itemId: string) => {
    setSelectedItems(prev => 
      prev.includes(itemId) 
        ? prev.filter(id => id !== itemId)
        : [...prev, itemId]
    );
  };

  const selectAllItems = () => {
    setSelectedItems(items.map(item => item._id));
  };

  const clearSelection = () => {
    setSelectedItems([]);
  };

  // Phase 5: Advanced Analytics Functions
  const calculateAnalytics = () => {
    const categoryDistribution = items.reduce((acc, item) => {
      acc[item.category] = (acc[item.category] || 0) + 1;
      return acc;
    }, {} as { [key: string]: number });

    const costAnalysis = {
      totalValue: items.reduce((sum, item) => sum + (item.costPerUnit || 0) * item.quantity, 0),
      averageCost: items.length > 0
        ? items.reduce((sum, item) => sum + (item.costPerUnit || 0), 0) / items.length
        : 0,
      highestCost: items.length > 0
        ? Math.max(...items.map(item => item.costPerUnit || 0))
        : 0,
      lowestCost: items.length > 0
        ? Math.min(...items.map(item => item.costPerUnit || 0))
        : 0
    };

    const supplierPerformance = items.reduce((acc, item) => {
      if (item.supplier?.name) {
        if (!acc[item.supplier.name]) {
          acc[item.supplier.name] = { items: 0, totalValue: 0, lowStockItems: 0 };
        }
        acc[item.supplier.name].items += 1;
        acc[item.supplier.name].totalValue += (item.costPerUnit || 0) * item.quantity;
        if (itemIsLowStock(item)) {
          acc[item.supplier.name].lowStockItems += 1;
        }
      }
      return acc;
    }, {} as { [key: string]: { items: number; totalValue: number; lowStockItems: number } });

    const lowStockAlerts = items
      .filter(item => itemIsLowStock(item))
      .map(item => ({
        id: item._id,
        name: item.name,
        currentStock: item.quantity,
        minimumThreshold: item.minimumThreshold,
        category: item.category,
        urgency: item.quantity === 0 ? 'critical' : 'warning'
      }))
      .sort((a, b) => a.currentStock - b.currentStock);

    setAnalyticsData({
      categoryDistribution,
      stockTrends: [], // Would be populated from historical data
      lowStockAlerts,
      costAnalysis,
      supplierPerformance
    });
  };

  const generateInventoryReport = () => {
    const reportData = {
      generatedAt: new Date().toISOString(),
      summary: {
        totalItems: stats?.total ?? items.length,
        totalValue: stats?.totalValue ?? items.reduce((sum, item) => sum + (item.costPerUnit || 0) * item.quantity, 0),
        lowStockItems: stats?.lowStock ?? items.filter(item => itemIsLowStock(item)).length,
        outOfStockItems: stats?.outOfStock ?? items.filter(item => item.quantity === 0).length
      },
      categoryBreakdown: Object.entries(stats?.categories ?? analyticsData.categoryDistribution).map(([category, count]) => ({
        category,
        count,
        percentage: (stats?.total ?? items.length) > 0 ? ((count / (stats?.total ?? items.length)) * 100).toFixed(1) : '0.0'
      })),
      lowStockItems: analyticsData.lowStockAlerts,
      topSuppliers: Object.entries(analyticsData.supplierPerformance)
        .sort(([, a], [, b]) => b.totalValue - a.totalValue)
        .slice(0, 5)
        .map(([supplier, data]) => ({
          supplier,
          items: data.items,
          totalValue: data.totalValue,
          lowStockItems: data.lowStockItems
        }))
    };

    const reportText = `
INVENTORY MANAGEMENT REPORT
Generated: ${new Date().toLocaleDateString()}

SUMMARY:
- Total Items: ${reportData.summary.totalItems}
- Total Inventory Value: ${formatCurrency(reportData.summary.totalValue, 'INR')}
- Low Stock Items: ${reportData.summary.lowStockItems}
- Out of Stock Items: ${reportData.summary.outOfStockItems}

CATEGORY BREAKDOWN:
${reportData.categoryBreakdown.map(cat => `- ${cat.category}: ${cat.count} items (${cat.percentage}%)`).join('\n')}

LOW STOCK ALERTS:
${reportData.lowStockItems.map(item => `- ${item.name} (${item.category}): ${item.currentStock}/${item.minimumThreshold}`).join('\n')}

TOP SUPPLIERS:
${reportData.topSuppliers.map(supplier => `- ${supplier.supplier}: ${supplier.items} items, ${formatCurrency(supplier.totalValue, 'INR')}`).join('\n')}
    `.trim();

    const blob = new Blob([reportText], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = `inventory-report-${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

  const applyAdvancedFilters = () => {
    let filteredItems = [...items];

    // Date range filter (if we had date fields)
    if (advancedFilters.dateRange.start && advancedFilters.dateRange.end) {
      // Would filter by date fields
    }

    // Cost range filter
    filteredItems = filteredItems.filter(item => {
      const cost = item.costPerUnit || 0;
      return cost >= advancedFilters.costRange.min && cost <= advancedFilters.costRange.max;
    });

    // Supplier filter
    if (advancedFilters.supplier) {
      filteredItems = filteredItems.filter(item => 
        item.supplier?.name?.toLowerCase().includes(advancedFilters.supplier.toLowerCase())
      );
    }

    // Location filter
    if (advancedFilters.location) {
      filteredItems = filteredItems.filter(item => {
        const location = item.location;
        if (!location) return false;
        const locationString = `${location.building || ''} ${location.floor || ''} ${location.room || ''}`.toLowerCase();
        return locationString.includes(advancedFilters.location.toLowerCase());
      });
    }

    return filteredItems;
  };

  // Phase 5: Performance Optimizations
  const memoizedItems = React.useMemo(() => {
    return applyAdvancedFilters();
  }, [items, advancedFilters]);

  // Stats come from the dedicated backend endpoint (aggregated across ALL items)
  const memoizedStats = stats;

  // Phase 5: Data Visualization Helpers
  const getCategoryColor = (category: string) => {
    const colors = {
      linens: 'bg-blue-500',
      toiletries: 'bg-green-500',
      cleaning: 'bg-yellow-500',
      maintenance: 'bg-purple-500',
      food_beverage: 'bg-red-500',
      other: 'bg-gray-500'
    };
    return colors[category as keyof typeof colors] || 'bg-gray-500';
  };

  const getUrgencyIcon = (urgency: string) => {
    switch (urgency) {
      case 'critical':
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      default:
        return <CheckCircle className="h-4 w-4 text-green-500" />;
    }
  };

  // Table columns
  const columns = [
    {
      key: 'selection',
      header: 'Select',
      render: (value: unknown, row: InventoryItem) => (
        <div className="flex items-center justify-center">
          <input
            type="checkbox"
            checked={selectedItems.includes(row._id)}
            onChange={() => toggleItemSelection(row._id)}
            className="rounded border-gray-300"
          />
        </div>
      ),
      align: 'center' as const
    },
    {
      key: 'name',
      header: 'Item',
      render: (value: string, row: InventoryItem) => (
        <div>
          <div className="font-medium">{value}</div>
          <div className="text-sm text-gray-500">SKU: {row.sku}</div>
        </div>
      )
    },
    {
      key: 'category',
      header: 'Category',
      render: (value: string) => (
        <StatusBadge 
          status={value} 
          variant="pill" 
          size="sm"
          className="capitalize"
        />
      )
    },
    {
      key: 'quantity',
      header: 'Stock Level',
      render: (value: number, row: InventoryItem) => (
        <div className="flex items-center">
          <div className="flex-1">
            <div className="flex items-center justify-between mb-1">
              <span className="font-medium">{value} {row.unit}</span>
              {itemIsLowStock(row) && (
                <AlertTriangle className="h-4 w-4 text-yellow-500" />
              )}
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className={`h-2 rounded-full ${
                  itemIsLowStock(row) ? 'bg-yellow-500' : 'bg-green-500'
                }`}
                style={{ 
                  width: `${row.maximumCapacity > 0 ? Math.min((value / row.maximumCapacity) * 100, 100) : 0}%`
                }}
              />
            </div>
            <div className="text-xs text-gray-500 mt-1">
              Min: {row.minimumThreshold} | Max: {row.maximumCapacity}
            </div>
          </div>
        </div>
      )
    },
    {
      key: 'costPerUnit',
      header: 'Cost',
      render: (value: number) => (
        <div className="flex items-center">
          <Coins className="h-4 w-4 text-gray-400 mr-1" />
          <span>{value ? formatCurrency(value, 'INR') : 'N/A'}</span>
        </div>
      ),
      align: 'center' as const
    },
    {
      key: 'location',
      header: 'Location',
      render: (_value: unknown, row: InventoryItem) => {
        const loc = row.location;
        return (
          <div className="flex items-center">
            <MapPin className="h-4 w-4 text-gray-400 mr-1" />
            <span className="text-sm">
              {loc ? `${loc.building || ''} ${loc.floor || ''} ${loc.room || ''}`.trim() || 'Not specified' : 'Not specified'}
            </span>
          </div>
        );
      }
    },
    {
      key: 'lastRestocked',
      header: 'Last Restocked',
      render: (value: string) => (
        <div className="text-sm">
          {value ? format(parseISO(value), 'MMM dd, yyyy') : 'Never'}
        </div>
      )
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (value: unknown, row: InventoryItem) => (
        <div className="flex items-center space-x-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSelectedItem(row);
              setShowDetailsModal(true);
            }}
          >
            <Eye className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => openEditModal(row)}
          >
            <Edit className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => openRestockModal(row)}
          >
            <ShoppingCart className="h-4 w-4 text-blue-600" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleDeleteItem(row._id)}
          >
            <Trash2 className="h-4 w-4 text-red-500" />
          </Button>
        </div>
      ),
      align: 'center' as const
    }
  ];

  if (!selectedPropertyId) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/30">
        <div className="p-6 max-w-7xl mx-auto">
          <PropertyBreadcrumb items={['Inventory']} />
          <div className="text-center py-12">
            <Package className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Property Selected</h3>
            <p className="text-gray-500">Please select a property to view inventory management.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/30 relative overflow-hidden">
      {/* Animated Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-gradient-to-br from-blue-400/20 to-indigo-400/20 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-gradient-to-br from-purple-400/20 to-pink-400/20 rounded-full blur-3xl animate-pulse delay-1000"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-gradient-to-br from-cyan-400/10 to-blue-400/10 rounded-full blur-3xl animate-pulse delay-500"></div>
      </div>

      <div className="relative z-10 p-3 sm:p-4 md:p-6 max-w-7xl mx-auto space-y-6">
        <PropertyBreadcrumb items={['Inventory']} />
        {/* Ultra-Modern Header with Advanced Glassmorphism */}
        <div className="relative mb-8 group">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-600/10 via-indigo-600/10 to-purple-600/10 rounded-3xl blur-3xl group-hover:blur-2xl transition-all duration-500"></div>
          <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/5 via-blue-500/5 to-indigo-500/5 rounded-3xl animate-pulse"></div>
          <div className="relative bg-white/90 backdrop-blur-md border border-white/30 rounded-3xl p-4 sm:p-6 lg:p-8 shadow-2xl group-hover:shadow-3xl transition-all duration-500 transform group-hover:scale-[1.02]">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 sm:gap-6">
              <div className="flex-1">
                <div className="flex items-center gap-3 sm:gap-4 mb-4">
                  <div className="relative p-2 sm:p-3 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-2xl shadow-lg group-hover:shadow-xl transition-all duration-300 transform group-hover:rotate-6">
                    <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent rounded-2xl"></div>
                    <Package className="h-6 w-6 sm:h-8 sm:w-8 text-white relative z-10" />
                  </div>
                  <div>
                    <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent animate-pulse">
                      Inventory Management
                    </h1>
                    <p className="text-gray-600 text-sm sm:text-base mt-2 flex items-center gap-2">
                      <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                      Manage hotel supplies and stock levels with precision
                    </p>
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                <Button
                  variant="secondary"
                  onClick={() => setShowFilters(!showFilters)}
                  className="bg-white/60 hover:bg-white/80 backdrop-blur-sm border border-white/30 text-gray-700 hover:text-gray-900 transition-all duration-300 shadow-lg hover:shadow-xl"
                >
                  <Filter className="h-4 w-4 mr-2" />
                  <span className="hidden sm:inline">Filters</span>
                </Button>
                {selectedItems.length > 0 && (
                  <>
                    <Button
                      variant="secondary"
                      onClick={() => {
                        setBulkAction('restock');
                        setShowBulkModal(true);
                      }}
                      className="bg-orange-50 hover:bg-orange-100 border border-orange-200 text-orange-700 hover:text-orange-800 transition-all duration-300 shadow-lg hover:shadow-xl"
                    >
                      <ShoppingCart className="h-4 w-4 mr-2" />
                      <span className="hidden sm:inline">Bulk Restock</span> ({selectedItems.length})
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => {
                        setBulkAction('export');
                        handleBulkExport();
                      }}
                      className="bg-green-50 hover:bg-green-100 border border-green-200 text-green-700 hover:text-green-800 transition-all duration-300 shadow-lg hover:shadow-xl"
                    >
                      <BarChart3 className="h-4 w-4 mr-2" />
                      <span className="hidden sm:inline">Export</span> ({selectedItems.length})
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={clearSelection}
                      className="bg-red-50 hover:bg-red-100 text-red-600 hover:text-red-700 transition-all duration-300"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </>
                )}
                <Button
                  onClick={() => openCreateModal()}
                  className="bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-110 hover:-translate-y-1 relative overflow-hidden group"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                  <Plus className="h-4 w-4 mr-2 relative z-10 group-hover:rotate-90 transition-transform duration-300" />
                  <span className="hidden sm:inline relative z-10">Add Item</span>
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => setShowAnalytics(!showAnalytics)}
                  className="bg-purple-50 hover:bg-purple-100 border border-purple-200 text-purple-700 hover:text-purple-800 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105 hover:-translate-y-1 relative overflow-hidden group"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-purple-100/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                  <BarChart3 className="h-4 w-4 mr-2 relative z-10 group-hover:scale-110 transition-transform duration-300" />
                  <span className="hidden sm:inline relative z-10">Analytics</span>
                </Button>
                <Button
                  variant="secondary"
                  onClick={generateInventoryReport}
                  className="bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 hover:text-indigo-800 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105 hover:-translate-y-1 relative overflow-hidden group"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-indigo-100/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                  <TrendingUp className="h-4 w-4 mr-2 relative z-10 group-hover:scale-110 transition-transform duration-300" />
                  <span className="hidden sm:inline relative z-10">Generate Report</span>
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Ultra-Modern Stats Cards with Advanced Animations */}
        {memoizedStats && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            {/* Total Items Card */}
            <div className="relative group cursor-pointer">
              <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 to-indigo-500/20 rounded-2xl blur-xl group-hover:blur-2xl transition-all duration-500"></div>
              <div className="absolute inset-0 bg-gradient-to-br from-blue-400/10 to-indigo-400/10 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
              <div className="relative bg-white/90 backdrop-blur-md border border-white/40 rounded-2xl p-4 sm:p-6 shadow-2xl hover:shadow-3xl transition-all duration-500 transform hover:scale-110 hover:-translate-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3 sm:space-x-4">
                    <div className="relative p-2 sm:p-3 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-xl shadow-lg group-hover:shadow-xl transition-all duration-300 transform group-hover:rotate-12 group-hover:scale-110">
                      <div className="absolute inset-0 bg-gradient-to-br from-white/30 to-transparent rounded-xl"></div>
                      <Package className="h-5 w-5 sm:h-6 sm:w-6 text-white relative z-10" />
                    </div>
                    <div>
                      <p className="text-xs sm:text-sm font-medium text-gray-600 group-hover:text-gray-800 transition-colors duration-300">Total Items</p>
                      <p className="text-xl sm:text-2xl font-bold text-gray-900 group-hover:text-blue-600 transition-colors duration-300">{formatNumber(memoizedStats.total)}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="w-3 h-3 bg-gradient-to-r from-green-400 to-emerald-400 rounded-full animate-pulse shadow-lg"></div>
                    <div className="w-1 h-1 bg-green-300 rounded-full animate-ping absolute top-0 right-0"></div>
                  </div>
                </div>
                <div className="mt-3 h-1 bg-gray-200 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full w-full animate-pulse"></div>
                </div>
              </div>
            </div>

            {/* Low Stock Card */}
            <div className="relative group cursor-pointer">
              <div className="absolute inset-0 bg-gradient-to-r from-yellow-500/20 to-orange-500/20 rounded-2xl blur-xl group-hover:blur-2xl transition-all duration-500"></div>
              <div className="absolute inset-0 bg-gradient-to-br from-yellow-400/10 to-orange-400/10 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
              <div className="relative bg-white/90 backdrop-blur-md border border-white/40 rounded-2xl p-4 sm:p-6 shadow-2xl hover:shadow-3xl transition-all duration-500 transform hover:scale-110 hover:-translate-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3 sm:space-x-4">
                    <div className="relative p-2 sm:p-3 bg-gradient-to-br from-yellow-500 to-orange-500 rounded-xl shadow-lg group-hover:shadow-xl transition-all duration-300 transform group-hover:rotate-12 group-hover:scale-110">
                      <div className="absolute inset-0 bg-gradient-to-br from-white/30 to-transparent rounded-xl"></div>
                      <AlertTriangle className="h-5 w-5 sm:h-6 sm:w-6 text-white relative z-10" />
                    </div>
                    <div>
                      <p className="text-xs sm:text-sm font-medium text-gray-600 group-hover:text-gray-800 transition-colors duration-300">Low Stock</p>
                      <p className="text-xl sm:text-2xl font-bold text-gray-900 group-hover:text-yellow-600 transition-colors duration-300">{formatNumber(memoizedStats.lowStock)}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`w-3 h-3 rounded-full animate-pulse shadow-lg ${memoizedStats.lowStock > 0 ? 'bg-gradient-to-r from-yellow-400 to-orange-400' : 'bg-gradient-to-r from-green-400 to-emerald-400'}`}></div>
                    <div className={`w-1 h-1 rounded-full animate-ping absolute top-0 right-0 ${memoizedStats.lowStock > 0 ? 'bg-yellow-300' : 'bg-green-300'}`}></div>
                  </div>
                </div>
                <div className="mt-3 h-1 bg-gray-200 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full w-full animate-pulse ${memoizedStats.lowStock > 0 ? 'bg-gradient-to-r from-yellow-500 to-orange-500' : 'bg-gradient-to-r from-green-500 to-emerald-500'}`}></div>
                </div>
              </div>
            </div>

            {/* Out of Stock Card */}
            <div className="relative group cursor-pointer">
              <div className="absolute inset-0 bg-gradient-to-r from-red-500/20 to-pink-500/20 rounded-2xl blur-xl group-hover:blur-2xl transition-all duration-500"></div>
              <div className="absolute inset-0 bg-gradient-to-br from-red-400/10 to-pink-400/10 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
              <div className="relative bg-white/90 backdrop-blur-md border border-white/40 rounded-2xl p-4 sm:p-6 shadow-2xl hover:shadow-3xl transition-all duration-500 transform hover:scale-110 hover:-translate-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3 sm:space-x-4">
                    <div className="relative p-2 sm:p-3 bg-gradient-to-br from-red-500 to-pink-500 rounded-xl shadow-lg group-hover:shadow-xl transition-all duration-300 transform group-hover:rotate-12 group-hover:scale-110">
                      <div className="absolute inset-0 bg-gradient-to-br from-white/30 to-transparent rounded-xl"></div>
                      <TrendingDown className="h-5 w-5 sm:h-6 sm:w-6 text-white relative z-10" />
                    </div>
                    <div>
                      <p className="text-xs sm:text-sm font-medium text-gray-600 group-hover:text-gray-800 transition-colors duration-300">Out of Stock</p>
                      <p className="text-xl sm:text-2xl font-bold text-gray-900 group-hover:text-red-600 transition-colors duration-300">{formatNumber(memoizedStats.outOfStock)}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`w-3 h-3 rounded-full animate-pulse shadow-lg ${memoizedStats.outOfStock > 0 ? 'bg-gradient-to-r from-red-400 to-pink-400' : 'bg-gradient-to-r from-green-400 to-emerald-400'}`}></div>
                    <div className={`w-1 h-1 rounded-full animate-ping absolute top-0 right-0 ${memoizedStats.outOfStock > 0 ? 'bg-red-300' : 'bg-green-300'}`}></div>
                  </div>
                </div>
                <div className="mt-3 h-1 bg-gray-200 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full w-full animate-pulse ${memoizedStats.outOfStock > 0 ? 'bg-gradient-to-r from-red-500 to-pink-500' : 'bg-gradient-to-r from-green-500 to-emerald-500'}`}></div>
                </div>
              </div>
            </div>

            {/* Total Value Card */}
            <div className="relative group cursor-pointer">
              <div className="absolute inset-0 bg-gradient-to-r from-green-500/20 to-emerald-500/20 rounded-2xl blur-xl group-hover:blur-2xl transition-all duration-500"></div>
              <div className="absolute inset-0 bg-gradient-to-br from-green-400/10 to-emerald-400/10 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
              <div className="relative bg-white/90 backdrop-blur-md border border-white/40 rounded-2xl p-4 sm:p-6 shadow-2xl hover:shadow-3xl transition-all duration-500 transform hover:scale-110 hover:-translate-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3 sm:space-x-4">
                    <div className="relative p-2 sm:p-3 bg-gradient-to-br from-green-500 to-emerald-500 rounded-xl shadow-lg group-hover:shadow-xl transition-all duration-300 transform group-hover:rotate-12 group-hover:scale-110">
                      <div className="absolute inset-0 bg-gradient-to-br from-white/30 to-transparent rounded-xl"></div>
                      <Coins className="h-5 w-5 sm:h-6 sm:w-6 text-white relative z-10" />
                    </div>
                    <div>
                      <p className="text-xs sm:text-sm font-medium text-gray-600 group-hover:text-gray-800 transition-colors duration-300">Total Value</p>
                      <p className="text-lg sm:text-xl font-bold text-gray-900 group-hover:text-green-600 transition-colors duration-300">{formatCurrency(memoizedStats.totalValue, 'INR')}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="w-3 h-3 bg-gradient-to-r from-green-400 to-emerald-400 rounded-full animate-pulse shadow-lg"></div>
                    <div className="w-1 h-1 bg-green-300 rounded-full animate-ping absolute top-0 right-0"></div>
                  </div>
                </div>
                <div className="mt-3 h-1 bg-gray-200 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-green-500 to-emerald-500 rounded-full w-full animate-pulse"></div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Enhanced Filters Section */}
        {showFilters && (
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-gray-500/10 to-slate-500/10 rounded-2xl blur-xl"></div>
            <div className="relative bg-white/80 backdrop-blur-sm border border-white/30 rounded-2xl p-4 sm:p-6 shadow-xl">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <Filter className="h-5 w-5 text-blue-600" />
                  Advanced Filters
                </h3>
                <Button
                  variant="ghost"
                  onClick={() => setShowFilters(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
                  <select
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 bg-white/60 backdrop-blur-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-300"
                    value={filters.category || ''}
                    onChange={(e) => setFilters({ ...filters, category: e.target.value || undefined, page: 1 })}
                  >
                    <option value="">All Categories</option>
                    <option value="linens">Linens</option>
                    <option value="toiletries">Toiletries</option>
                    <option value="cleaning">Cleaning</option>
                    <option value="maintenance">Maintenance</option>
                    <option value="food_beverage">Food & Beverage</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Stock Status</label>
                  <select
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 bg-white/60 backdrop-blur-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-300"
                    value={filters.lowStock ? 'true' : ''}
                    onChange={(e) => setFilters({ ...filters, lowStock: e.target.value === 'true', page: 1 })}
                  >
                    <option value="">All Items</option>
                    <option value="true">Low Stock Only</option>
                  </select>
                </div>

                <div className="flex items-end">
                  <Button
                    variant="secondary"
                    onClick={() => setFilters({ page: 1, limit: 10 })}
                    className="w-full bg-white/60 hover:bg-white/80 backdrop-blur-sm border border-white/30 text-gray-700 hover:text-gray-900 transition-all duration-300 shadow-lg hover:shadow-xl"
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Clear Filters
                  </Button>
                </div>
                <div className="flex items-end">
                  <Button
                    variant="secondary"
                    onClick={selectAllItems}
                    className="w-full bg-white/60 hover:bg-white/80 backdrop-blur-sm border border-white/30 text-gray-700 hover:text-gray-900 transition-all duration-300 shadow-lg hover:shadow-xl"
                  >
                    <BarChart3 className="h-4 w-4 mr-2" />
                    Select All
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

      {/* Phase 5: Advanced Filters */}
      {showAnalytics && (
        <Card>
          <CardHeader>
            <CardTitle>Advanced Analytics & Filters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Cost Range (INR)</label>
                <div className="flex space-x-2">
                  <Input
                    type="number"
                    placeholder="Min"
                    value={advancedFilters.costRange.min}
                    onChange={(e) => setAdvancedFilters({
                      ...advancedFilters,
                      costRange: { ...advancedFilters.costRange, min: parseInt(e.target.value) || 0 }
                    })}
                  />
                  <Input
                    type="number"
                    placeholder="Max"
                    value={advancedFilters.costRange.max}
                    onChange={(e) => setAdvancedFilters({
                      ...advancedFilters,
                      costRange: { ...advancedFilters.costRange, max: parseInt(e.target.value) || 10000 }
                    })}
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Supplier</label>
                <Input
                  type="text"
                  placeholder="Search by supplier"
                  value={advancedFilters.supplier}
                  onChange={(e) => setAdvancedFilters({ ...advancedFilters, supplier: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
                <Input
                  type="text"
                  placeholder="Search by location"
                  value={advancedFilters.location}
                  onChange={(e) => setAdvancedFilters({ ...advancedFilters, location: e.target.value })}
                />
              </div>
              <div className="flex items-end">
                <Button
                  variant="secondary"
                  onClick={() => setAdvancedFilters({
                    dateRange: { start: '', end: '' },
                    costRange: { min: 0, max: 10000 },
                    supplier: '',
                    location: '',
                    lastRestocked: ''
                  })}
                  className="w-full"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Clear Advanced Filters
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Phase 4: Advanced Analytics Dashboard */}
      {showAnalytics && (
        <div className="space-y-6 mb-8">
          {/* Analytics Navigation Tabs */}
          <Card>
            <CardHeader>
              <CardTitle>Advanced Analytics & Reporting</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex space-x-1 bg-gray-100 rounded-lg p-1 mb-6">
                {[
                  { id: 'overview', name: 'Overview', icon: BarChart3 },
                  { id: 'trends', name: 'Trend Analysis', icon: LineChart },
                  { id: 'cost', name: 'Cost Optimization', icon: DollarSign },
                  { id: 'compliance', name: 'Compliance', icon: Shield },
                  { id: 'forecasting', name: 'Demand Forecasting', icon: Target }
                ].map((tab) => {
                  const Icon = tab.icon;
                  return (
                    <button
                      aria-label={tab.name}
                      key={tab.id}
                      onClick={() => setActiveAnalyticsTab(tab.id as typeof activeAnalyticsTab)}
                      className={`flex-1 flex items-center justify-center px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                        activeAnalyticsTab === tab.id
                          ? 'bg-white text-blue-600 shadow-sm'
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      <Icon className="w-4 h-4 mr-2" />
                      {tab.name}
                    </button>
                  );
                })}
              </div>

              {/* Tab Content */}
              {activeAnalyticsTab === 'overview' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  {/* Cost Analysis */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Cost Analysis</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">Total Value:</span>
                          <span className="font-semibold">{formatCurrency(analyticsData.costAnalysis.totalValue || 0, 'INR')}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">Average Cost:</span>
                          <span className="font-semibold">{formatCurrency(analyticsData.costAnalysis.averageCost || 0, 'INR')}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">Highest Cost Item:</span>
                          <span className="font-semibold">{formatCurrency(analyticsData.costAnalysis.highestCost || 0, 'INR')}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">Lowest Cost Item:</span>
                          <span className="font-semibold">{formatCurrency(analyticsData.costAnalysis.lowestCost || 0, 'INR')}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Category Distribution - prefer server-side stats when available */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Category Distribution</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {Object.entries(stats?.categories ?? analyticsData.categoryDistribution).map(([category, count]) => (
                          <div key={category} className="flex items-center justify-between">
                            <div className="flex items-center">
                              <div className={`w-3 h-3 rounded-full mr-2 ${getCategoryColor(category)}`}></div>
                              <span className="text-sm capitalize">{category.replace('_', ' ')}</span>
                            </div>
                            <div className="flex items-center space-x-2">
                              <span className="text-sm font-medium">{count}</span>
                              <span className="text-xs text-gray-500">
                                ({(stats?.total ?? items.length) > 0 ? ((count / (stats?.total ?? items.length)) * 100).toFixed(1) : '0.0'}%)
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Low Stock Alerts */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Low Stock Alerts</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {analyticsData.lowStockAlerts.slice(0, 5).map((alert) => (
                          <div key={alert.id} className="flex items-center justify-between p-2 bg-red-50 rounded">
                            <div className="flex items-center">
                              {getUrgencyIcon(alert.urgency)}
                              <div className="ml-2">
                                <div className="font-medium text-sm">{alert.name}</div>
                                <div className="text-xs text-gray-500 capitalize">{alert.category}</div>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className={`text-sm font-medium ${alert.urgency === 'critical' ? 'text-red-600' : 'text-yellow-600'}`}>
                                {alert.currentStock}/{alert.minimumThreshold}
                              </div>
                              <div className="text-xs text-gray-500">{alert.urgency}</div>
                            </div>
                          </div>
                        ))}
                        {analyticsData.lowStockAlerts.length === 0 && (
                          <div className="text-center text-gray-500 py-4">
                            No low stock alerts
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Top Suppliers */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Top Suppliers</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {Object.entries(analyticsData.supplierPerformance)
                          .sort(([, a], [, b]) => b.totalValue - a.totalValue)
                          .slice(0, 5)
                          .map(([supplier, data]) => (
                            <div key={supplier} className="flex items-center justify-between">
                              <div>
                                <div className="font-medium text-sm">{supplier}</div>
                                <div className="text-xs text-gray-500">{data.items} items</div>
                              </div>
                              <div className="text-right">
                                <div className="text-sm font-medium">{formatCurrency(data.totalValue, 'INR')}</div>
                                <div className="text-xs text-gray-500">{data.lowStockItems} low stock</div>
                              </div>
                            </div>
                          ))}
                        {Object.keys(analyticsData.supplierPerformance).length === 0 && (
                          <div className="text-center text-gray-500 py-4">
                            No supplier data available
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}

              {activeAnalyticsTab === 'trends' && (
                <InventoryTrendAnalysis />
              )}

              {activeAnalyticsTab === 'cost' && (
                <CostOptimizationDashboard />
              )}

              {activeAnalyticsTab === 'compliance' && (
                <ComplianceCenter />
              )}

              {activeAnalyticsTab === 'forecasting' && (
                <PredictiveDemandChart />
              )}
            </CardContent>
          </Card>
        </div>
      )}

        {/* Ultra-Modern Inventory Table */}
        <div className="relative group">
          <div className="absolute inset-0 bg-gradient-to-r from-white/50 to-gray-50/50 rounded-3xl blur-2xl group-hover:blur-xl transition-all duration-500"></div>
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 via-purple-500/5 to-pink-500/5 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
          <div className="relative bg-white/95 backdrop-blur-md border border-white/40 rounded-3xl p-4 sm:p-6 shadow-2xl group-hover:shadow-3xl transition-all duration-500">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="relative p-2 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-xl shadow-lg group-hover:shadow-xl transition-all duration-300 transform group-hover:rotate-6 group-hover:scale-110">
                  <div className="absolute inset-0 bg-gradient-to-br from-white/30 to-transparent rounded-xl"></div>
                  <Package className="h-5 w-5 text-white relative z-10" />
                </div>
                <div>
                  <h2 className="text-xl sm:text-2xl font-bold text-gray-900 group-hover:text-indigo-600 transition-colors duration-300">Inventory Items</h2>
                  <p className="text-sm text-gray-600 flex items-center gap-2">
                    <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                    Manage your hotel supplies and stock levels
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="text-sm text-gray-600">Total Items</p>
                  <p className="text-lg font-semibold text-gray-900 group-hover:text-indigo-600 transition-colors duration-300">{stats?.total ?? pagination.total}</p>
                </div>
                <div className="w-12 h-12 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-xl flex items-center justify-center">
                  <div className="w-6 h-6 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-full animate-pulse"></div>
                </div>
              </div>
            </div>
            <DataTable
              data={memoizedItems}
              columns={columns}
              loading={loading}
              searchable={true}
              searchPlaceholder="Search items..."
              pagination={false}
              pageSize={filters.limit || 10}
              emptyMessage="No inventory items found"
              onRowClick={(item) => {
                setSelectedItem(item);
                setShowDetailsModal(true);
              }}
            />

            {/* Server-side Pagination Controls */}
            {pagination.pages > 1 && (
              <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-200">
                <p className="text-sm text-gray-600">
                  Showing {((pagination.current - 1) * (filters.limit || 10)) + 1}
                  {' '}-{' '}
                  {Math.min(pagination.current * (filters.limit || 10), pagination.total)}
                  {' '}of {pagination.total} items
                </p>
                <div className="flex items-center space-x-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={pagination.current <= 1}
                    onClick={() => setFilters({ ...filters, page: (filters.page || 1) - 1 })}
                  >
                    Previous
                  </Button>
                  {Array.from({ length: Math.min(pagination.pages, 5) }, (_, i) => {
                    let pageNum: number;
                    if (pagination.pages <= 5) {
                      pageNum = i + 1;
                    } else if (pagination.current <= 3) {
                      pageNum = i + 1;
                    } else if (pagination.current >= pagination.pages - 2) {
                      pageNum = pagination.pages - 4 + i;
                    } else {
                      pageNum = pagination.current - 2 + i;
                    }
                    return (
                      <Button
                        key={pageNum}
                        variant={pagination.current === pageNum ? 'default' : 'secondary'}
                        size="sm"
                        onClick={() => setFilters({ ...filters, page: pageNum })}
                        className={pagination.current === pageNum ? 'bg-blue-600 text-white' : ''}
                      >
                        {pageNum}
                      </Button>
                    );
                  })}
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={pagination.current >= pagination.pages}
                    onClick={() => setFilters({ ...filters, page: (filters.page || 1) + 1 })}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Phase 4: Advanced Functional Modals */}
      
      {/* Create/Edit Item Modal */}
      {(showCreateModal || showEditModal) && (
        <Modal
          isOpen={showCreateModal || showEditModal}
          onClose={() => {
            setShowCreateModal(false);
            setShowEditModal(false);
            resetFormData();
          }}
          title={showCreateModal ? "Add Inventory Item" : "Edit Inventory Item"}
        >
          <div className="space-y-6">
            {/* Basic Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Item Name *</label>
                <Input
                  type="text"
                  required
                  placeholder="Enter item name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="border border-gray-200 rounded-xl px-4 py-3 bg-white/60 backdrop-blur-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-300"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">SKU *</label>
                <Input
                  type="text"
                  required
                  placeholder="Enter SKU"
                  value={formData.sku}
                  onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                  className="border border-gray-200 rounded-xl px-4 py-3 bg-white/60 backdrop-blur-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-300"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                <select
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value as string })}
                >
                  <option value="linens">Linens</option>
                  <option value="toiletries">Toiletries</option>
                  <option value="cleaning">Cleaning</option>
                  <option value="maintenance">Maintenance</option>
                  <option value="food_beverage">Food & Beverage</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Unit</label>
                <select
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                  value={formData.unit}
                  onChange={(e) => setFormData({ ...formData, unit: e.target.value as string })}
                >
                  <option value="pieces">Pieces</option>
                  <option value="bottles">Bottles</option>
                  <option value="rolls">Rolls</option>
                  <option value="kg">Kilograms</option>
                  <option value="liters">Liters</option>
                  <option value="sets">Sets</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Cost per Unit (INR)</label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={formData.costPerUnit}
                  onChange={(e) => setFormData({ ...formData, costPerUnit: parseFloat(e.target.value) || 0 })}
                />
              </div>
            </div>

            {/* Stock Levels */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Current Quantity</label>
                <Input
                  type="number"
                  placeholder="0"
                  value={formData.quantity}
                  onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) || 0 })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Minimum Threshold</label>
                <Input
                  type="number"
                  placeholder="0"
                  value={formData.minimumThreshold}
                  onChange={(e) => setFormData({ ...formData, minimumThreshold: parseInt(e.target.value) || 0 })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Maximum Capacity</label>
                <Input
                  type="number"
                  placeholder="0"
                  value={formData.maximumCapacity}
                  onChange={(e) => setFormData({ ...formData, maximumCapacity: parseInt(e.target.value) || 0 })}
                />
              </div>
            </div>

            {/* Supplier Information */}
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-3">Supplier Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Supplier Name</label>
                  <Input
                    type="text"
                    required
                    placeholder="Enter supplier name"
                    value={formData.supplier.name}
                    onChange={(e) => setFormData({ 
                      ...formData, 
                      supplier: { ...formData.supplier, name: e.target.value }
                    })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Contact</label>
                  <Input
                    type="text"
                    placeholder="Enter contact number"
                    value={formData.supplier.contact}
                    onChange={(e) => setFormData({ 
                      ...formData, 
                      supplier: { ...formData.supplier, contact: e.target.value }
                    })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <Input
                    type="email"
                    required
                    placeholder="Enter email address"
                    value={formData.supplier.email}
                    onChange={(e) => setFormData({ 
                      ...formData, 
                      supplier: { ...formData.supplier, email: e.target.value }
                    })}
                  />
                </div>
              </div>
            </div>

            {/* Location Information */}
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-3">Storage Location</h3>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Building</label>
                  <Input
                    type="text"
                    placeholder="Building"
                    value={formData.location.building}
                    onChange={(e) => setFormData({ 
                      ...formData, 
                      location: { ...formData.location, building: e.target.value }
                    })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Floor</label>
                  <Input
                    type="text"
                    placeholder="Floor"
                    value={formData.location.floor}
                    onChange={(e) => setFormData({ 
                      ...formData, 
                      location: { ...formData.location, floor: e.target.value }
                    })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Room</label>
                  <Input
                    type="text"
                    placeholder="Room"
                    value={formData.location.room}
                    onChange={(e) => setFormData({ 
                      ...formData, 
                      location: { ...formData.location, room: e.target.value }
                    })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Shelf</label>
                  <Input
                    type="text"
                    placeholder="Shelf"
                    value={formData.location.shelf}
                    onChange={(e) => setFormData({ 
                      ...formData, 
                      location: { ...formData.location, shelf: e.target.value }
                    })}
                  />
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end space-x-3 pt-4 border-t border-gray-200">
              <Button
                variant="secondary"
                onClick={() => {
                  setShowCreateModal(false);
                  setShowEditModal(false);
                  resetFormData();
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  if (showCreateModal) {
                    handleCreateItem(formData);
                  } else if (showEditModal && selectedItem) {
                    handleUpdateItem(selectedItem._id, formData);
                    setShowEditModal(false);
                  }
                }}
                disabled={updating || !formData.name.trim() || !formData.sku.trim() || formData.costPerUnit < 0 || formData.maximumCapacity < 1 || formData.minimumThreshold < 0 || formData.maximumCapacity < formData.minimumThreshold}
              >
                <Save className="h-4 w-4 mr-2" />
                {showCreateModal ? 'Create Item' : 'Update Item'}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Item Details Modal */}
      {showDetailsModal && selectedItem && (
        <Modal
          isOpen={showDetailsModal}
          onClose={() => {
            setShowDetailsModal(false);
            setSelectedItem(null);
          }}
          title="Item Details"
        >
          <div className="space-y-6">
            {/* Item Header */}
            <div className="border-b border-gray-200 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">{selectedItem.name}</h3>
                  <p className="text-sm text-gray-500">SKU: {selectedItem.sku}</p>
                </div>
                <StatusBadge status={selectedItem.category} variant="pill" className="capitalize" />
              </div>
            </div>

            {/* Stock Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Current Stock</label>
                  <div className="flex items-center mt-1">
                    <Package className="h-4 w-4 text-gray-400 mr-2" />
                    <span className="font-medium">{selectedItem.quantity} {selectedItem.unit}</span>
                    {itemIsLowStock(selectedItem) && (
                      <AlertTriangle className="h-4 w-4 text-yellow-500 ml-2" />
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Stock Level</label>
                  <div className="mt-2">
                    <div className="w-full bg-gray-200 rounded-full h-3">
                      <div 
                        className={`h-3 rounded-full ${
                          itemIsLowStock(selectedItem) ? 'bg-yellow-500' : 'bg-green-500'
                        }`}
                        style={{ 
                          width: `${selectedItem.maximumCapacity > 0 ? Math.min((selectedItem.quantity / selectedItem.maximumCapacity) * 100, 100) : 0}%`
                        }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-gray-500 mt-1">
                      <span>Min: {selectedItem.minimumThreshold}</span>
                      <span>Max: {selectedItem.maximumCapacity}</span>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Cost Information</label>
                  <div className="flex items-center mt-1">
                    <Coins className="h-4 w-4 text-gray-400 mr-2" />
                    <span>{selectedItem.costPerUnit ? formatCurrency(selectedItem.costPerUnit, 'INR') : 'Not set'}</span>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Last Restocked</label>
                  <div className="flex items-center mt-1">
                    <Calendar className="h-4 w-4 text-gray-400 mr-2" />
                    <span>{selectedItem.lastRestocked ? format(parseISO(selectedItem.lastRestocked), 'MMM dd, yyyy') : 'Never'}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                {/* Supplier Information */}
                {selectedItem.supplier && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Supplier</label>
                    <div className="mt-2 space-y-2">
                      <div className="flex items-center">
                        <Building className="h-4 w-4 text-gray-400 mr-2" />
                        <span>{selectedItem.supplier.name}</span>
                      </div>
                      {selectedItem.supplier.contact && (
                        <div className="flex items-center">
                          <Phone className="h-4 w-4 text-gray-400 mr-2" />
                          <span>{selectedItem.supplier.contact}</span>
                        </div>
                      )}
                      {selectedItem.supplier.email && (
                        <div className="flex items-center">
                          <Mail className="h-4 w-4 text-gray-400 mr-2" />
                          <span>{selectedItem.supplier.email}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Location Information */}
                {selectedItem.location && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Storage Location</label>
                    <div className="flex items-center mt-1">
                      <MapPin className="h-4 w-4 text-gray-400 mr-2" />
                      <span>
                        {selectedItem.location.building || selectedItem.location.floor || selectedItem.location.room || selectedItem.location.shelf 
                          ? `${selectedItem.location.building || ''} ${selectedItem.location.floor || ''} ${selectedItem.location.room || ''} ${selectedItem.location.shelf || ''}`.trim()
                          : 'Not specified'
                        }
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end space-x-3 pt-4 border-t border-gray-200">
              <Button
                variant="secondary"
                onClick={() => {
                  setShowDetailsModal(false);
                  setSelectedItem(null);
                }}
              >
                Close
              </Button>
              <Button
                onClick={() => {
                  openEditModal(selectedItem);
                  setShowDetailsModal(false);
                }}
              >
                <Edit className="h-4 w-4 mr-2" />
                Edit Item
              </Button>
              <Button
                onClick={() => {
                  openRestockModal(selectedItem);
                  setShowDetailsModal(false);
                }}
              >
                <ShoppingCart className="h-4 w-4 mr-2" />
                Restock
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Restock Modal */}
      {showRestockModal && selectedItem && (
        <Modal
          isOpen={showRestockModal}
          onClose={() => {
            setShowRestockModal(false);
            setSelectedItem(null);
            setRestockData({ quantity: 0, costPerUnit: 0 });
          }}
          title="Restock Item"
        >
          <div className="space-y-6">
            {/* Item Info */}
            <div className="border-b border-gray-200 pb-4">
              <h3 className="text-lg font-semibold text-gray-900">{selectedItem.name}</h3>
              <p className="text-sm text-gray-500">Current stock: {selectedItem.quantity} {selectedItem.unit}</p>
            </div>

            {/* Restock Form */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Quantity to Add</label>
                <Input
                  type="number"
                  placeholder="0"
                  value={restockData.quantity}
                  onChange={(e) => setRestockData({ ...restockData, quantity: parseInt(e.target.value) || 0 })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Cost per Unit (INR)</label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder={selectedItem.costPerUnit?.toString() || "0.00"}
                  value={restockData.costPerUnit}
                  onChange={(e) => setRestockData({ ...restockData, costPerUnit: parseFloat(e.target.value) || 0 })}
                />
              </div>
            </div>

            {/* Summary */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <h4 className="font-medium text-gray-900 mb-2">Restock Summary</h4>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span>Current Stock:</span>
                  <span>{selectedItem.quantity} {selectedItem.unit}</span>
                </div>
                <div className="flex justify-between">
                  <span>Adding:</span>
                  <span>{restockData.quantity} {selectedItem.unit}</span>
                </div>
                <div className="flex justify-between font-medium">
                  <span>New Total:</span>
                  <span>{selectedItem.quantity + restockData.quantity} {selectedItem.unit}</span>
                </div>
                {restockData.costPerUnit > 0 && (
                  <div className="flex justify-between">
                    <span>Total Cost:</span>
                    <span>{formatCurrency(restockData.quantity * restockData.costPerUnit, 'INR')}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end space-x-3 pt-4 border-t border-gray-200">
              <Button
                variant="secondary"
                onClick={() => {
                  setShowRestockModal(false);
                  setSelectedItem(null);
                  setRestockData({ quantity: 0, costPerUnit: 0 });
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={() => handleRestock(selectedItem._id, restockData.quantity, restockData.costPerUnit)}
                disabled={updating || restockData.quantity <= 0}
              >
                <ShoppingCart className="h-4 w-4 mr-2" />
                Restock Item
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Bulk Operations Modal */}
      {showBulkModal && (
        <Modal
          isOpen={showBulkModal}
          onClose={() => {
            setShowBulkModal(false);
            setBulkAction('restock');
          }}
          title="Bulk Operations"
        >
          <div className="space-y-6">
            <div className="border-b border-gray-200 pb-4">
              <h3 className="text-lg font-semibold text-gray-900">Bulk Restock</h3>
              <p className="text-sm text-gray-500">
                Restock {selectedItems.length} selected items
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Quantity to Add</label>
                <Input
                  type="number"
                  placeholder="0"
                  value={restockData.quantity}
                  onChange={(e) => setRestockData({ ...restockData, quantity: parseInt(e.target.value) || 0 })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Cost per Unit (INR)</label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={restockData.costPerUnit}
                  onChange={(e) => setRestockData({ ...restockData, costPerUnit: parseFloat(e.target.value) || 0 })}
                />
              </div>
            </div>

            <div className="bg-gray-50 p-4 rounded-lg">
              <h4 className="font-medium text-gray-900 mb-2">Operation Summary</h4>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span>Selected Items:</span>
                  <span>{selectedItems.length}</span>
                </div>
                <div className="flex justify-between">
                  <span>Quantity to Add:</span>
                  <span>{restockData.quantity}</span>
                </div>
                {restockData.costPerUnit > 0 && (
                  <div className="flex justify-between">
                    <span>Total Cost:</span>
                    <span>{formatCurrency(restockData.quantity * restockData.costPerUnit * selectedItems.length, 'INR')}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end space-x-3 pt-4 border-t border-gray-200">
              <Button
                variant="secondary"
                onClick={() => {
                  setShowBulkModal(false);
                  setBulkAction('restock');
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={() => handleBulkRestock(restockData.quantity, restockData.costPerUnit)}
                disabled={updating || restockData.quantity <= 0}
              >
                <ShoppingCart className="h-4 w-4 mr-2" />
                Bulk Restock
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}


export default withErrorBoundary(AdminInventory, { level: 'page' });