import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FaHistory,
  FaChartLine,
  FaDownload,
  FaInfoCircle,
  FaExclamationTriangle,
  FaArrowUp,
  FaArrowDown,
  FaExchangeAlt,
  FaAdjust,
  FaRecycle,
  FaTrendingUp,
  FaTrendingDown,
  FaCalendarAlt,
  FaDollarSign,
  FaBox,
  FaUser
} from 'react-icons/fa';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from 'recharts';
import { stockMovementsService, Transaction, ItemStatisticsResponse } from '../../services/stockMovementsService';
import { format, parseISO } from 'date-fns';

interface ItemTransactionLogProps {
  itemId: string;
  itemName: string;
  onClose?: () => void;
}

const ItemTransactionLog: React.FC<ItemTransactionLogProps> = ({ itemId, itemName, onClose }) => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [statistics, setStatistics] = useState<ItemStatisticsResponse['data'] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'transactions' | 'analytics' | 'trends'>('transactions');
  const [dateRange, setDateRange] = useState(30); // days

  // Fetch item data
  const fetchItemData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [transactionsResponse, statisticsResponse] = await Promise.all([
        stockMovementsService.getItemTransactions(itemId, { limit: 100 }),
        stockMovementsService.getItemStatistics(itemId, dateRange)
      ]);

      if (transactionsResponse.success) {
        setTransactions(transactionsResponse.data.transactions);
      }

      if (statisticsResponse.success) {
        setStatistics(statisticsResponse.data);
      }
    } catch (err: unknown) {
      setError(err.message || 'Failed to fetch item data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItemData();
  }, [itemId, dateRange]);

  // Export item data
  const exportItemData = async () => {
    try {
      const data = {
        itemId,
        itemName,
        statistics,
        transactions: transactions.map(t => ({
          date: t.timestamps.created,
          type: t.transactionType,
          quantity: t.quantity,
          stockLevel: t.newQuantity,
          cost: t.totalCost,
          reason: t.reason,
          performedBy: t.performedBy.name
        }))
      };

      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${itemName.replace(/\s+/g, '_')}_transaction_log_${format(new Date(), 'yyyy-MM-dd')}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
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
        return 'text-green-600 bg-green-50 border-green-200';
      case 'OUT':
      case 'CONSUMPTION':
        return 'text-red-600 bg-red-50 border-red-200';
      case 'TRANSFER':
        return 'text-blue-600 bg-blue-50 border-blue-200';
      case 'ADJUSTMENT':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  // Prepare chart data
  const prepareStockTrendData = () => {
    if (!statistics) return [];

    return statistics.usage.pattern.map(point => ({
      date: `${point._id.month}/${point._id.day}`,
      stockIn: point.totalIn,
      stockOut: point.totalOut,
      netChange: point.totalIn - point.totalOut
    }));
  };

  const prepareUsageByTypeData = () => {
    if (!statistics) return [];

    return Object.entries(statistics.usage.byType).map(([type, data]) => ({
      type,
      quantity: data.quantity,
      cost: data.cost,
      count: data.count
    }));
  };

  const COLORS = ['#10B981', '#EF4444', '#3B82F6', '#F59E0B', '#8B5CF6', '#EC4899'];

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
          <FaHistory className="h-6 w-6 text-blue-600" />
          <div>
            <h2 className="text-2xl font-bold text-gray-900">{itemName}</h2>
            <p className="text-sm text-gray-500">Transaction History & Analytics</p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <select
            value={dateRange}
            onChange={(e) => setDateRange(Number(e.target.value))}
            className="px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          >
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
            <option value={365}>Last year</option>
          </select>

          <button
            onClick={exportItemData}
            className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            <FaDownload className="h-4 w-4 mr-2" />
            Export
          </button>

          {onClose && (
            <button
              onClick={onClose}
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Close
            </button>
          )}
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

      {/* Item Overview Cards */}
      {statistics && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <FaBox className="h-6 w-6 text-blue-400" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      Current Stock
                    </dt>
                    <dd className="text-lg font-medium text-gray-900">
                      {statistics.item.currentStock} {statistics.item.unit}
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
                  <FaHistory className="h-6 w-6 text-green-400" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      Total Transactions
                    </dt>
                    <dd className="text-lg font-medium text-gray-900">
                      {statistics.statistics.totalTransactions}
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
                  <FaTrendingUp className="h-6 w-6 text-purple-400" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      Turnover Rate
                    </dt>
                    <dd className="text-lg font-medium text-gray-900">
                      {statistics.statistics.turnoverRate.toFixed(2)}x
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
                  <FaDollarSign className="h-6 w-6 text-green-400" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      Total Value
                    </dt>
                    <dd className="text-lg font-medium text-gray-900">
                      ${statistics.statistics.totalCost.toFixed(2)}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Stock Level Alert */}
      {statistics && statistics.performance.stockoutRisk !== 'low' && (
        <div className={`p-4 rounded-md ${
          statistics.performance.stockoutRisk === 'high'
            ? 'bg-red-50 border border-red-200'
            : 'bg-yellow-50 border border-yellow-200'
        }`}>
          <div className="flex">
            <div className="flex-shrink-0">
              <FaExclamationTriangle className={`h-5 w-5 ${
                statistics.performance.stockoutRisk === 'high' ? 'text-red-400' : 'text-yellow-400'
              }`} />
            </div>
            <div className="ml-3">
              <h3 className={`text-sm font-medium ${
                statistics.performance.stockoutRisk === 'high' ? 'text-red-800' : 'text-yellow-800'
              }`}>
                {statistics.performance.stockoutRisk === 'high' ? 'Critical Stock Level' : 'Low Stock Warning'}
              </h3>
              <div className={`mt-2 text-sm ${
                statistics.performance.stockoutRisk === 'high' ? 'text-red-700' : 'text-yellow-700'
              }`}>
                <p>
                  Current stock ({statistics.item.currentStock} {statistics.item.unit}) is
                  {statistics.performance.stockoutRisk === 'high' ? ' critically low' : ' below recommended levels'}.
                  {statistics.performance.reorderNeeded && (
                    <span> Suggested reorder: {statistics.performance.suggestedReorderQuantity} {statistics.item.unit}</span>
                  )}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('transactions')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'transactions'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <FaHistory className="inline h-4 w-4 mr-2" />
            Transaction Log
          </button>
          <button
            onClick={() => setActiveTab('analytics')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'analytics'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <FaChartLine className="inline h-4 w-4 mr-2" />
            Analytics
          </button>
          <button
            onClick={() => setActiveTab('trends')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'trends'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <FaTrendingUp className="inline h-4 w-4 mr-2" />
            Trends
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        {activeTab === 'transactions' && (
          <motion.div
            key="transactions"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-4"
          >
            {/* Transaction Timeline */}
            <div className="bg-white shadow overflow-hidden sm:rounded-md">
              <div className="px-4 py-5 sm:p-6">
                <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                  Recent Transactions
                </h3>

                {transactions.length === 0 ? (
                  <div className="text-center py-12">
                    <FaHistory className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                    <p className="text-lg font-medium text-gray-500">No transactions found</p>
                    <p className="text-sm text-gray-400">No stock movements recorded for this item</p>
                  </div>
                ) : (
                  <div className="flow-root">
                    <ul className="-mb-8">
                      {transactions.map((transaction, index) => (
                        <li key={transaction._id}>
                          <div className="relative pb-8">
                            {index !== transactions.length - 1 && (
                              <span
                                className="absolute top-4 left-4 -ml-px h-full w-0.5 bg-gray-200"
                                aria-hidden="true"
                              />
                            )}
                            <div className="relative flex space-x-3">
                              <div>
                                <span className={`h-8 w-8 rounded-full flex items-center justify-center ring-8 ring-white ${getTransactionColor(transaction.transactionType)}`}>
                                  {getTransactionIcon(transaction.transactionType)}
                                </span>
                              </div>
                              <div className="min-w-0 flex-1 pt-1.5 flex justify-between space-x-4">
                                <div>
                                  <p className="text-sm text-gray-900">
                                    <span className="font-medium">{transaction.transactionType}</span> transaction
                                    <span className={`ml-2 font-medium ${
                                      transaction.quantity >= 0 ? 'text-green-600' : 'text-red-600'
                                    }`}>
                                      {transaction.formattedQuantity || (transaction.quantity >= 0 ? '+' : '')}{transaction.quantity} {statistics?.item.unit}
                                    </span>
                                  </p>
                                  <p className="text-sm text-gray-500">
                                    Stock: {transaction.previousQuantity} → {transaction.newQuantity}
                                  </p>
                                  <p className="text-sm text-gray-500 mt-1">
                                    {transaction.reason}
                                  </p>
                                  {transaction.reference && (
                                    <p className="text-xs text-gray-400 mt-1">
                                      {transaction.reference.type}: {transaction.reference.description}
                                    </p>
                                  )}
                                </div>
                                <div className="text-right text-sm whitespace-nowrap text-gray-500">
                                  <p>{format(parseISO(transaction.timestamps.created), 'MMM dd, yyyy')}</p>
                                  <p className="text-xs">{format(parseISO(transaction.timestamps.created), 'HH:mm')}</p>
                                  <p className="text-xs mt-1">by {transaction.performedBy.name}</p>
                                  {transaction.totalCost > 0 && (
                                    <p className="text-xs font-medium text-gray-700">${transaction.totalCost.toFixed(2)}</p>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'analytics' && statistics && (
          <motion.div
            key="analytics"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-6"
          >
            {/* Usage by Type Chart */}
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Usage by Transaction Type</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={prepareUsageByTypeData()}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ type, quantity }) => `${type}: ${quantity}`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="quantity"
                    >
                      {prepareUsageByTypeData().map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value, name) => [`${value} ${statistics.item.unit}`, name]} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Performance Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white p-6 rounded-lg shadow">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Performance Metrics</h3>
                <div className="space-y-4">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-500">Net Flow</span>
                    <span className={`text-sm font-medium ${
                      statistics.statistics.netFlow >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {statistics.statistics.netFlow >= 0 ? '+' : ''}{statistics.statistics.netFlow} {statistics.item.unit}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-500">Average Transaction Value</span>
                    <span className="text-sm font-medium text-gray-900">
                      ${statistics.statistics.avgTransactionValue.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-500">Stock-out Risk</span>
                    <span className={`text-sm font-medium ${
                      statistics.performance.stockoutRisk === 'high' ? 'text-red-600' :
                      statistics.performance.stockoutRisk === 'medium' ? 'text-yellow-600' : 'text-green-600'
                    }`}>
                      {statistics.performance.stockoutRisk.charAt(0).toUpperCase() + statistics.performance.stockoutRisk.slice(1)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-500">Reorder Needed</span>
                    <span className={`text-sm font-medium ${
                      statistics.performance.reorderNeeded ? 'text-red-600' : 'text-green-600'
                    }`}>
                      {statistics.performance.reorderNeeded ? 'Yes' : 'No'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-white p-6 rounded-lg shadow">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Recent Activity</h3>
                <div className="space-y-4">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-500">Recent Transactions</span>
                    <span className="text-sm font-medium text-gray-900">
                      {statistics.usage.recentActivity.transactions}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-500">Recent Quantity Moved</span>
                    <span className="text-sm font-medium text-gray-900">
                      {statistics.usage.recentActivity.quantity} {statistics.item.unit}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-500">Recent Value</span>
                    <span className="text-sm font-medium text-gray-900">
                      ${statistics.usage.recentActivity.cost.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-500">Average Cost</span>
                    <span className="text-sm font-medium text-gray-900">
                      ${statistics.item.avgCost.toFixed(2)} per {statistics.item.unit}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'trends' && statistics && (
          <motion.div
            key="trends"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-6"
          >
            {/* Stock Movement Trend */}
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Stock Movement Trends</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={prepareStockTrendData()}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip formatter={(value, name) => [`${value} ${statistics.item.unit}`, name]} />
                    <Line
                      type="monotone"
                      dataKey="stockIn"
                      stroke="#10B981"
                      strokeWidth={2}
                      name="Stock In"
                    />
                    <Line
                      type="monotone"
                      dataKey="stockOut"
                      stroke="#EF4444"
                      strokeWidth={2}
                      name="Stock Out"
                    />
                    <Line
                      type="monotone"
                      dataKey="netChange"
                      stroke="#3B82F6"
                      strokeWidth={2}
                      name="Net Change"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Transaction Volume by Type */}
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Transaction Volume by Type</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={prepareUsageByTypeData()}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="type" />
                    <YAxis />
                    <Tooltip formatter={(value, name) => [`${value}`, name]} />
                    <Bar dataKey="count" fill="#3B82F6" name="Transaction Count" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ItemTransactionLog;