import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Calendar, TrendingUp, TrendingDown, Users, DollarSign } from 'lucide-react';
import AnalyticsChart, { ChartData } from './AnalyticsChart';
import { format, subDays, subMonths, startOfDay, endOfDay } from 'date-fns';

export interface BookingTrend {
  date: string;
  bookings: number;
  revenue: number;
  guests: number;
  averageRate: number;
}

export interface BookingTrendsChartProps {
  data: BookingTrend[];
  timeRange: 'week' | 'month' | 'quarter' | 'year';
  onTimeRangeChange: (range: 'week' | 'month' | 'quarter' | 'year') => void;
  loading?: boolean;
  className?: string;
}

const BookingTrendsChart: React.FC<BookingTrendsChartProps> = ({
  data,
  timeRange,
  onTimeRangeChange,
  loading = false,
  className = ''
}) => {
  const [activeMetric, setActiveMetric] = useState<'bookings' | 'revenue' | 'guests' | 'rate'>('bookings');

  const getChartData = (): ChartData => {
    const labels = data.map(item => {
      const date = new Date(item.date);
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

    const getDataForMetric = () => {
      switch (activeMetric) {
        case 'bookings':
          return data.map(item => item.bookings);
        case 'revenue':
          return data.map(item => item.revenue);
        case 'guests':
          return data.map(item => item.guests);
        case 'rate':
          return data.map(item => item.averageRate);
        default:
          return data.map(item => item.bookings);
      }
    };

    return {
      labels,
      datasets: [
        {
          label: getMetricLabel(activeMetric),
          data: getDataForMetric(),
          borderColor: 'rgba(99, 102, 241, 1)',
          backgroundColor: 'rgba(99, 102, 241, 0.1)',
          fill: true,
          tension: 0.4,
        }
      ]
    };
  };

  const getMetricLabel = (metric: string): string => {
    switch (metric) {
      case 'bookings':
        return 'Number of Bookings';
      case 'revenue':
        return 'Revenue ($)';
      case 'guests':
        return 'Number of Guests';
      case 'rate':
        return 'Average Rate ($)';
      default:
        return 'Bookings';
    }
  };

  const getMetricIcon = (metric: string) => {
    switch (metric) {
      case 'bookings':
        return Calendar;
      case 'revenue':
        return DollarSign;
      case 'guests':
        return Users;
      case 'rate':
        return TrendingUp;
      default:
        return Calendar;
    }
  };

  const calculateTrend = (): { value: number; isPositive: boolean } => {
    if (data.length < 2) return { value: 0, isPositive: true };

    const current = data[data.length - 1];
    const previous = data[data.length - 2];

    let currentValue = 0;
    let previousValue = 0;

    switch (activeMetric) {
      case 'bookings':
        currentValue = current.bookings;
        previousValue = previous.bookings;
        break;
      case 'revenue':
        currentValue = current.revenue;
        previousValue = previous.revenue;
        break;
      case 'guests':
        currentValue = current.guests;
        previousValue = previous.guests;
        break;
      case 'rate':
        currentValue = current.averageRate;
        previousValue = previous.averageRate;
        break;
    }

    const change = previousValue === 0 ? 0 : ((currentValue - previousValue) / previousValue) * 100;
    return {
      value: Math.abs(change),
      isPositive: change >= 0
    };
  };

  const trend = calculateTrend();

  const chartOptions = {
    plugins: {
      tooltip: {
        callbacks: {
          label: function(context: unknown) {
            const value = context.parsed.y;
            switch (activeMetric) {
              case 'revenue':
              case 'rate':
                return `${context.dataset.label}: $${value.toLocaleString()}`;
              default:
                return `${context.dataset.label}: ${value.toLocaleString()}`;
            }
          }
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          callback: function(value: Record<string, unknown>) {
            switch (activeMetric) {
              case 'revenue':
              case 'rate':
                return `$${value.toLocaleString()}`;
              default:
                return value.toLocaleString();
            }
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
          <h3 className="text-lg font-semibold text-gray-900">Booking Trends</h3>
          <div className="flex items-center gap-2 mt-1">
            {trend.isPositive ? (
              <TrendingUp className="h-4 w-4 text-green-600" />
            ) : (
              <TrendingDown className="h-4 w-4 text-red-600" />
            )}
            <span className={`text-sm font-medium ${
              trend.isPositive ? 'text-green-600' : 'text-red-600'
            }`}>
              {trend.isPositive ? '+' : '-'}{trend.value.toFixed(1)}% vs previous period
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

      {/* Metric Selector */}
      <div className="flex flex-wrap gap-2 mb-6">
        {(['bookings', 'revenue', 'guests', 'rate'] as const).map((metric) => {
          const Icon = getMetricIcon(metric);
          return (
            <button aria-label="Close"
              key={metric}
              onClick={() => setActiveMetric(metric)}
              className={`flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                activeMetric === metric
                  ? 'bg-indigo-100 text-indigo-700 border border-indigo-200'
                  : 'bg-gray-50 text-gray-600 hover:bg-gray-100 border border-transparent'
              }`}
            >
              <Icon className="h-4 w-4" />
              {getMetricLabel(metric)}
            </button>
          );
        })}
      </div>

      {/* Chart */}
      <AnalyticsChart
        type="line"
        data={getChartData()}
        height={350}
        options={chartOptions}
      />

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-6 border-t border-gray-200">
        {(['bookings', 'revenue', 'guests', 'rate'] as const).map((metric) => {
          const Icon = getMetricIcon(metric);
          const total = data.reduce((sum, item) => {
            switch (metric) {
              case 'bookings':
                return sum + item.bookings;
              case 'revenue':
                return sum + item.revenue;
              case 'guests':
                return sum + item.guests;
              case 'rate':
                return sum + item.averageRate;
              default:
                return sum;
            }
          }, 0);

          const average = metric === 'rate' ? total / data.length : total;

          return (
            <div key={metric} className="text-center">
              <div className="flex items-center justify-center mb-2">
                <Icon className="h-5 w-5 text-indigo-600" />
              </div>
              <p className="text-2xl font-bold text-gray-900">
                {metric === 'revenue' || metric === 'rate'
                  ? `$${Math.round(average).toLocaleString()}`
                  : Math.round(average).toLocaleString()
                }
              </p>
              <p className="text-sm text-gray-600">
                {metric === 'rate' ? 'Avg ' : 'Total '}
                {getMetricLabel(metric).replace(' ($)', '')}
              </p>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
};

export default BookingTrendsChart;