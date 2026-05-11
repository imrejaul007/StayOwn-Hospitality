import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { DollarSign, TrendingUp, TrendingDown, BarChart3, PieChart, Target } from 'lucide-react';
import AnalyticsChart, { ChartData } from './AnalyticsChart';
import { format } from 'date-fns';

export interface RevenueData {
  period: string;
  totalRevenue: number;
  roomRevenue: number;
  additionalServices: number;
  taxes: number;
  discounts: number;
  netRevenue: number;
  bookingCount: number;
  averageRevenuePerBooking: number;
}

export interface RevenueChartProps {
  data: RevenueData[];
  timeRange: 'week' | 'month' | 'quarter' | 'year';
  onTimeRangeChange: (range: 'week' | 'month' | 'quarter' | 'year') => void;
  forecastData?: RevenueData[];
  target?: number;
  loading?: boolean;
  className?: string;
}

const RevenueChart: React.FC<RevenueChartProps> = ({
  data,
  timeRange,
  onTimeRangeChange,
  forecastData = [],
  target,
  loading = false,
  className = ''
}) => {
  const [activeView, setActiveView] = useState<'trend' | 'breakdown' | 'forecast'>('trend');

  const getRevenueChartData = (): ChartData => {
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

    if (activeView === 'trend') {
      const datasets = [
        {
          label: 'Total Revenue',
          data: data.map(item => item.totalRevenue),
          borderColor: 'rgba(99, 102, 241, 1)',
          backgroundColor: 'rgba(99, 102, 241, 0.1)',
          fill: true,
          tension: 0.4,
        },
        {
          label: 'Net Revenue',
          data: data.map(item => item.netRevenue),
          borderColor: 'rgba(16, 185, 129, 1)',
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          fill: true,
          tension: 0.4,
        }
      ];

      // Add forecast data if available
      if (forecastData.length > 0) {
        const forecastLabels = forecastData.map(item => {
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

        datasets.push({
          label: 'Forecast',
          data: [...Array(data.length).fill(null), ...forecastData.map(item => item.totalRevenue)],
          borderColor: 'rgba(245, 158, 11, 1)',
          backgroundColor: 'rgba(245, 158, 11, 0.1)',
          borderDash: [5, 5],
          fill: false,
          tension: 0.4,
        });

        return {
          labels: [...labels, ...forecastLabels],
          datasets
        };
      }

      return { labels, datasets };
    } else if (activeView === 'breakdown') {
      return {
        labels,
        datasets: [
          {
            label: 'Room Revenue',
            data: data.map(item => item.roomRevenue),
            backgroundColor: 'rgba(99, 102, 241, 0.8)',
            borderColor: 'rgba(99, 102, 241, 1)',
          },
          {
            label: 'Additional Services',
            data: data.map(item => item.additionalServices),
            backgroundColor: 'rgba(16, 185, 129, 0.8)',
            borderColor: 'rgba(16, 185, 129, 1)',
          },
          {
            label: 'Taxes',
            data: data.map(item => item.taxes),
            backgroundColor: 'rgba(245, 158, 11, 0.8)',
            borderColor: 'rgba(245, 158, 11, 1)',
          }
        ]
      };
    } else {
      // Revenue breakdown pie chart for latest period
      const latest = data[data.length - 1];
      if (!latest) return { labels: [], datasets: [] };

      return {
        labels: ['Room Revenue', 'Additional Services', 'Taxes', 'Discounts'],
        datasets: [{
          data: [
            latest.roomRevenue,
            latest.additionalServices,
            latest.taxes,
            Math.abs(latest.discounts)
          ],
          backgroundColor: [
            'rgba(99, 102, 241, 0.8)',
            'rgba(16, 185, 129, 0.8)',
            'rgba(245, 158, 11, 0.8)',
            'rgba(239, 68, 68, 0.8)'
          ],
          borderColor: [
            'rgba(99, 102, 241, 1)',
            'rgba(16, 185, 129, 1)',
            'rgba(245, 158, 11, 1)',
            'rgba(239, 68, 68, 1)'
          ],
          borderWidth: 2
        }]
      };
    }
  };

  const getTotalStats = () => {
    const totals = data.reduce((acc, item) => ({
      totalRevenue: acc.totalRevenue + item.totalRevenue,
      roomRevenue: acc.roomRevenue + item.roomRevenue,
      additionalServices: acc.additionalServices + item.additionalServices,
      taxes: acc.taxes + item.taxes,
      discounts: acc.discounts + item.discounts,
      netRevenue: acc.netRevenue + item.netRevenue,
      bookingCount: acc.bookingCount + item.bookingCount,
    }), {
      totalRevenue: 0,
      roomRevenue: 0,
      additionalServices: 0,
      taxes: 0,
      discounts: 0,
      netRevenue: 0,
      bookingCount: 0,
    });

    const averageRevenuePerBooking = totals.bookingCount > 0
      ? totals.totalRevenue / totals.bookingCount
      : 0;

    return { ...totals, averageRevenuePerBooking };
  };

  const calculateGrowthRate = (): { value: number; isPositive: boolean } => {
    if (data.length < 2) return { value: 0, isPositive: true };

    const current = data[data.length - 1].totalRevenue;
    const previous = data[data.length - 2].totalRevenue;

    const change = previous === 0 ? 0 : ((current - previous) / previous) * 100;
    return {
      value: Math.abs(change),
      isPositive: change >= 0
    };
  };

  const stats = getTotalStats();
  const growth = calculateGrowthRate();

  const chartOptions = {
    plugins: {
      tooltip: {
        callbacks: {
          label: function(context: unknown) {
            const value = context.parsed.y || context.parsed;
            return `${context.dataset.label}: $${value.toLocaleString()}`;
          }
        }
      }
    },
    scales: activeView !== 'forecast' ? {
      y: {
        beginAtZero: true,
        ticks: {
          callback: function(value: Record<string, unknown>) {
            return `$${value.toLocaleString()}`;
          }
        }
      }
    } : {}
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
          <h3 className="text-lg font-semibold text-gray-900">Revenue Analytics</h3>
          <div className="flex items-center gap-2 mt-1">
            {growth.isPositive ? (
              <TrendingUp className="h-4 w-4 text-green-600" />
            ) : (
              <TrendingDown className="h-4 w-4 text-red-600" />
            )}
            <span className={`text-sm font-medium ${
              growth.isPositive ? 'text-green-600' : 'text-red-600'
            }`}>
              {growth.isPositive ? '+' : '-'}{growth.value.toFixed(1)}% vs previous period
            </span>
          </div>
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
          onClick={() => setActiveView('trend')}
          className={`flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
            activeView === 'trend'
              ? 'bg-indigo-100 text-indigo-700 border border-indigo-200'
              : 'bg-gray-50 text-gray-600 hover:bg-gray-100 border border-transparent'
          }`}
        >
          <TrendingUp className="h-4 w-4" />
          Revenue Trend
        </button>
        <button
          onClick={() => setActiveView('breakdown')}
          className={`flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
            activeView === 'breakdown'
              ? 'bg-indigo-100 text-indigo-700 border border-indigo-200'
              : 'bg-gray-50 text-gray-600 hover:bg-gray-100 border border-transparent'
          }`}
        >
          <BarChart3 className="h-4 w-4" />
          Revenue Breakdown
        </button>
        <button
          onClick={() => setActiveView('forecast')}
          className={`flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
            activeView === 'forecast'
              ? 'bg-indigo-100 text-indigo-700 border border-indigo-200'
              : 'bg-gray-50 text-gray-600 hover:bg-gray-100 border border-transparent'
          }`}
        >
          <PieChart className="h-4 w-4" />
          Revenue Composition
        </button>
      </div>

      {/* Target Progress Bar (if target is provided) */}
      {target && (
        <div className="mb-6 p-4 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-lg border border-indigo-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">Revenue Target Progress</span>
            <span className="text-sm font-bold text-indigo-600">
              ${stats.totalRevenue.toLocaleString()} / ${target.toLocaleString()}
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-gradient-to-r from-indigo-600 to-purple-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${Math.min((stats.totalRevenue / target) * 100, 100)}%` }}
            ></div>
          </div>
          <div className="flex items-center justify-between mt-2">
            <span className="text-xs text-gray-600">
              {((stats.totalRevenue / target) * 100).toFixed(1)}% achieved
            </span>
            <span className="text-xs text-gray-600">
              ${(target - stats.totalRevenue).toLocaleString()} remaining
            </span>
          </div>
        </div>
      )}

      {/* Chart */}
      <AnalyticsChart
        type={activeView === 'forecast' ? 'doughnut' : activeView === 'breakdown' ? 'bar' : 'line'}
        data={getRevenueChartData()}
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
            ${stats.totalRevenue.toLocaleString()}
          </p>
          <p className="text-sm text-gray-600">Total Revenue</p>
        </div>

        <div className="text-center">
          <div className="flex items-center justify-center mb-2">
            <TrendingUp className="h-5 w-5 text-green-600" />
          </div>
          <p className="text-2xl font-bold text-green-600">
            ${stats.netRevenue.toLocaleString()}
          </p>
          <p className="text-sm text-gray-600">Net Revenue</p>
        </div>

        <div className="text-center">
          <div className="flex items-center justify-center mb-2">
            <BarChart3 className="h-5 w-5 text-purple-600" />
          </div>
          <p className="text-2xl font-bold text-purple-600">
            ${Math.round(stats.averageRevenuePerBooking).toLocaleString()}
          </p>
          <p className="text-sm text-gray-600">Avg per Booking</p>
        </div>

        <div className="text-center">
          <div className="flex items-center justify-center mb-2">
            <Target className="h-5 w-5 text-orange-600" />
          </div>
          <p className="text-2xl font-bold text-orange-600">
            ${Math.abs(stats.discounts).toLocaleString()}
          </p>
          <p className="text-sm text-gray-600">Total Discounts</p>
        </div>
      </div>
    </motion.div>
  );
};

export default RevenueChart;