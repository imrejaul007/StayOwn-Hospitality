import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { DollarSign, TrendingUp, Calendar, Award, Clock, CheckCircle } from 'lucide-react';
import AnalyticsChart, { ChartData } from './AnalyticsChart';
import { format } from 'date-fns';

export interface CommissionData {
  period: string;
  totalCommission: number;
  paidCommission: number;
  pendingCommission: number;
  bonusCommission: number;
  commissionRate: number;
  bookingCount: number;
}

export interface CommissionChartProps {
  data: CommissionData[];
  agentId?: string;
  agentName?: string;
  timeRange: 'week' | 'month' | 'quarter' | 'year';
  onTimeRangeChange: (range: 'week' | 'month' | 'quarter' | 'year') => void;
  loading?: boolean;
  className?: string;
}

const CommissionChart: React.FC<CommissionChartProps> = ({
  data,
  agentId,
  agentName,
  timeRange,
  onTimeRangeChange,
  loading = false,
  className = ''
}) => {
  const [activeView, setActiveView] = useState<'commission' | 'rate' | 'status'>('commission');

  const getCommissionChartData = (): ChartData => {
    const labels = data.map(item => {
      const date = new Date(item.period);
      switch (timeRange) {
        case 'week':
          return format(date, 'EEE');
        case 'month':
          return format(date, 'MMM dd');
        case 'quarter':
        case 'year':
          return format(date, 'MMM yyyy');
        default:
          return format(date, 'MMM dd');
      }
    });

    if (activeView === 'commission') {
      return {
        labels,
        datasets: [
          {
            label: 'Total Commission',
            data: data.map(item => item.totalCommission),
            backgroundColor: 'rgba(99, 102, 241, 0.8)',
            borderColor: 'rgba(99, 102, 241, 1)',
          },
          {
            label: 'Bonus Commission',
            data: data.map(item => item.bonusCommission),
            backgroundColor: 'rgba(16, 185, 129, 0.8)',
            borderColor: 'rgba(16, 185, 129, 1)',
          }
        ]
      };
    } else if (activeView === 'rate') {
      return {
        labels,
        datasets: [
          {
            label: 'Commission Rate (%)',
            data: data.map(item => item.commissionRate),
            borderColor: 'rgba(245, 158, 11, 1)',
            backgroundColor: 'rgba(245, 158, 11, 0.1)',
            fill: true,
            tension: 0.4,
          }
        ]
      };
    } else {
      return {
        labels,
        datasets: [
          {
            label: 'Paid Commission',
            data: data.map(item => item.paidCommission),
            backgroundColor: 'rgba(16, 185, 129, 0.8)',
            borderColor: 'rgba(16, 185, 129, 1)',
          },
          {
            label: 'Pending Commission',
            data: data.map(item => item.pendingCommission),
            backgroundColor: 'rgba(245, 158, 11, 0.8)',
            borderColor: 'rgba(245, 158, 11, 1)',
          }
        ]
      };
    }
  };

  const getTotalStats = () => {
    const totals = data.reduce((acc, item) => ({
      totalCommission: acc.totalCommission + item.totalCommission,
      paidCommission: acc.paidCommission + item.paidCommission,
      pendingCommission: acc.pendingCommission + item.pendingCommission,
      bonusCommission: acc.bonusCommission + item.bonusCommission,
      bookingCount: acc.bookingCount + item.bookingCount,
    }), {
      totalCommission: 0,
      paidCommission: 0,
      pendingCommission: 0,
      bonusCommission: 0,
      bookingCount: 0,
    });

    const averageRate = data.length > 0
      ? data.reduce((sum, item) => sum + item.commissionRate, 0) / data.length
      : 0;

    return { ...totals, averageRate };
  };

  const stats = getTotalStats();

  const chartOptions = {
    plugins: {
      tooltip: {
        callbacks: {
          label: function(context: unknown) {
            const value = context.parsed.y;
            if (activeView === 'rate') {
              return `${context.dataset.label}: ${value.toFixed(2)}%`;
            }
            return `${context.dataset.label}: $${value.toLocaleString()}`;
          }
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          callback: function(value: Record<string, unknown>) {
            if (activeView === 'rate') {
              return `${value}%`;
            }
            return `$${value.toLocaleString()}`;
          }
        }
      }
    }
  };

  if (loading) {
    return (
      <div className={`bg-white rounded-lg shadow-sm p-6 ${className}`}>
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded mb-4 w-1/3"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`bg-white rounded-lg shadow-sm p-6 ${className}`}
    >
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Commission Analytics</h3>
          {agentName && (
            <p className="text-sm text-gray-600 mt-1">Agent: {agentName}</p>
          )}
        </div>

        {/* Time Range Selector */}
        <div className="flex bg-gray-100 rounded-lg p-1">
          {(['week', 'month', 'quarter', 'year'] as const).map((range) => (
            <button aria-label="Close"
              key={range}
              onClick={() => onTimeRangeChange(range)}
              className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${
                timeRange === range
                  ? 'bg-white text-indigo-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {range.charAt(0).toUpperCase() + range.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* View Selector */}
      <div className="flex flex-wrap gap-2 mb-6">
        <button
          onClick={() => setActiveView('commission')}
          className={`flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
            activeView === 'commission'
              ? 'bg-indigo-100 text-indigo-700 border border-indigo-200'
              : 'bg-gray-50 text-gray-600 hover:bg-gray-100 border border-transparent'
          }`}
        >
          <DollarSign className="h-4 w-4" />
          Commission Amount
        </button>
        <button
          onClick={() => setActiveView('rate')}
          className={`flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
            activeView === 'rate'
              ? 'bg-indigo-100 text-indigo-700 border border-indigo-200'
              : 'bg-gray-50 text-gray-600 hover:bg-gray-100 border border-transparent'
          }`}
        >
          <TrendingUp className="h-4 w-4" />
          Commission Rate
        </button>
        <button
          onClick={() => setActiveView('status')}
          className={`flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
            activeView === 'status'
              ? 'bg-indigo-100 text-indigo-700 border border-indigo-200'
              : 'bg-gray-50 text-gray-600 hover:bg-gray-100 border border-transparent'
          }`}
        >
          <Clock className="h-4 w-4" />
          Payment Status
        </button>
      </div>

      {/* Chart */}
      <AnalyticsChart
        type={activeView === 'rate' ? 'line' : 'bar'}
        data={getCommissionChartData()}
        height={350}
        options={chartOptions}
      />

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-6 border-t border-gray-200">
        <div className="text-center">
          <div className="flex items-center justify-center mb-2">
            <DollarSign className="h-5 w-5 text-indigo-600" />
          </div>
          <p className="text-2xl font-bold text-gray-900">
            ${stats.totalCommission.toLocaleString()}
          </p>
          <p className="text-sm text-gray-600">Total Commission</p>
        </div>

        <div className="text-center">
          <div className="flex items-center justify-center mb-2">
            <CheckCircle className="h-5 w-5 text-green-600" />
          </div>
          <p className="text-2xl font-bold text-green-600">
            ${stats.paidCommission.toLocaleString()}
          </p>
          <p className="text-sm text-gray-600">Paid Commission</p>
        </div>

        <div className="text-center">
          <div className="flex items-center justify-center mb-2">
            <Clock className="h-5 w-5 text-yellow-600" />
          </div>
          <p className="text-2xl font-bold text-yellow-600">
            ${stats.pendingCommission.toLocaleString()}
          </p>
          <p className="text-sm text-gray-600">Pending Commission</p>
        </div>

        <div className="text-center">
          <div className="flex items-center justify-center mb-2">
            <Award className="h-5 w-5 text-purple-600" />
          </div>
          <p className="text-2xl font-bold text-purple-600">
            ${stats.bonusCommission.toLocaleString()}
          </p>
          <p className="text-sm text-gray-600">Bonus Commission</p>
        </div>
      </div>

      {/* Performance Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6 pt-6 border-t border-gray-200">
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="h-5 w-5 text-indigo-600" />
            <span className="font-medium text-gray-900">Average Commission Rate</span>
          </div>
          <p className="text-2xl font-bold text-indigo-600">
            {stats.averageRate.toFixed(2)}%
          </p>
        </div>

        <div className="bg-gray-50 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <Calendar className="h-5 w-5 text-green-600" />
            <span className="font-medium text-gray-900">Total Bookings</span>
          </div>
          <p className="text-2xl font-bold text-green-600">
            {stats.bookingCount.toLocaleString()}
          </p>
        </div>

        <div className="bg-gray-50 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="h-5 w-5 text-purple-600" />
            <span className="font-medium text-gray-900">Avg Commission per Booking</span>
          </div>
          <p className="text-2xl font-bold text-purple-600">
            ${stats.bookingCount > 0
              ? Math.round(stats.totalCommission / stats.bookingCount).toLocaleString()
              : '0'
            }
          </p>
        </div>
      </div>
    </motion.div>
  );
};

export default CommissionChart;