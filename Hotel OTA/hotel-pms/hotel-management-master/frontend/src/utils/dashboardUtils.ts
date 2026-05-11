import { format, parseISO, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear } from 'date-fns';
import type { ChartDataPoint, TimeSeriesData } from '../types/dashboard';

// Date range utilities
export const getDateRange = (period: 'today' | 'week' | 'month' | 'quarter' | 'year') => {
  const now = new Date();
  
  switch (period) {
    case 'today':
      return {
        start: format(startOfDay(now), 'yyyy-MM-dd'),
        end: format(endOfDay(now), 'yyyy-MM-dd'),
      };
    case 'week':
      return {
        start: format(startOfWeek(now), 'yyyy-MM-dd'),
        end: format(endOfWeek(now), 'yyyy-MM-dd'),
      };
    case 'month':
      return {
        start: format(startOfMonth(now), 'yyyy-MM-dd'),
        end: format(endOfMonth(now), 'yyyy-MM-dd'),
      };
    case 'quarter':
      const quarterStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
      const quarterEnd = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3 + 3, 0);
      return {
        start: format(quarterStart, 'yyyy-MM-dd'),
        end: format(quarterEnd, 'yyyy-MM-dd'),
      };
    case 'year':
      return {
        start: format(startOfYear(now), 'yyyy-MM-dd'),
        end: format(endOfYear(now), 'yyyy-MM-dd'),
      };
    default:
      return {
        start: format(startOfDay(now), 'yyyy-MM-dd'),
        end: format(endOfDay(now), 'yyyy-MM-dd'),
      };
  }
};

// Format numbers with appropriate suffixes
export const formatNumber = (num: number | string | undefined | null, decimals: number = 0): string => {
  // Handle null, undefined, or invalid values
  if (num === null || num === undefined || num === '') {
    return '0';
  }
  
  // Convert to number if it's a string
  const numValue = typeof num === 'string' ? parseFloat(num) : num;
  
  // Check if it's a valid number
  if (isNaN(numValue) || !isFinite(numValue)) {
    return '0';
  }
  
  if (numValue >= 1000000000) {
    return (numValue / 1000000000).toFixed(decimals) + 'B';
  }
  if (numValue >= 1000000) {
    return (numValue / 1000000).toFixed(decimals) + 'M';
  }
  if (numValue >= 1000) {
    return (numValue / 1000).toFixed(decimals) + 'K';
  }
  return numValue.toFixed(decimals);
};

// Format currency
export const formatCurrency = (amount: number | string | undefined | null, currency: string = 'INR'): string => {
  // Handle null, undefined, or invalid values
  if (amount === null || amount === undefined || amount === '') {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: currency || 'INR',
    }).format(0);
  }
  
  // Convert to number if it's a string
  const numValue = typeof amount === 'string' ? parseFloat(amount) : amount;
  
  // Check if it's a valid number
  if (isNaN(numValue) || !isFinite(numValue)) {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: currency || 'INR',
    }).format(0);
  }
  
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: currency || 'INR',
  }).format(numValue);
};

// Format percentage
export const formatPercentage = (value: number | string | undefined | null, decimals: number = 1): string => {
  // Handle null, undefined, or invalid values
  if (value === null || value === undefined || value === '') {
    return '0.0%';
  }
  
  // Convert to number if it's a string
  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  
  // Check if it's a valid number
  if (isNaN(numValue) || !isFinite(numValue)) {
    return '0.0%';
  }
  
  return `${numValue.toFixed(decimals)}%`;
};

// Calculate percentage change
export const calculatePercentageChange = (current: number, previous: number): number => {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
};

// Get trend direction
export const getTrendDirection = (change: number): 'up' | 'down' | 'neutral' => {
  if (change > 0) return 'up';
  if (change < 0) return 'down';
  return 'neutral';
};

// Color utilities for charts and status
export const getStatusColor = (status: string): string => {
  // Handle undefined or null status
  if (!status) {
    return '#6b7280'; // Default gray color
  }
  
  const colors: Record<string, string> = {
    // General status colors
    healthy: '#10b981',
    warning: '#f59e0b',
    critical: '#ef4444',
    success: '#10b981',
    error: '#ef4444',
    
    // Booking statuses
    confirmed: '#10b981',
    pending: '#f59e0b',
    cancelled: '#ef4444',
    checked_in: '#3b82f6',
    checked_out: '#6b7280',
    no_show: '#ef4444',
    
    // Payment statuses
    paid: '#10b981',
    refunded: '#6b7280',
    failed: '#ef4444',
    
    // Task statuses
    completed: '#10b981',
    in_progress: '#3b82f6',
    assigned: '#f59e0b',
    overdue: '#ef4444',
    
    // Alert severities
    low: '#6b7280',
    medium: '#f59e0b',
    high: '#f97316',
    urgent: '#ef4444',
    
    // Room statuses
    occupied: '#ef4444',
    vacant: '#10b981',
    reserved: '#8b5cf6',
    dirty: '#f59e0b',
    out_of_order: '#6b7280',
    maintenance: '#f97316',
  };
  
  return colors[status.toLowerCase()] || '#6b7280';
};

// Generate chart colors
export const getChartColors = (count: number): string[] => {
  const baseColors = [
    '#3b82f6', // blue
    '#10b981', // emerald
    '#f59e0b', // amber
    '#ef4444', // red
    '#8b5cf6', // violet
    '#06b6d4', // cyan
    '#84cc16', // lime
    '#f97316', // orange
    '#ec4899', // pink
    '#14b8a6', // teal
  ];
  
  const colors: string[] = [];
  for (let i = 0; i < count; i++) {
    colors.push(baseColors[i % baseColors.length]);
  }
  
  return colors;
};

// Data transformation utilities
export const transformToChartData = (
  data: Record<string, unknown>[],
  xKey: string,
  yKey: string,
  labelKey?: string
): ChartDataPoint[] => {
  return data.map((item, index) => ({
    label: String(labelKey ? item[labelKey] : item[xKey]),
    value: Number(item[yKey]) || 0,
    color: getChartColors(data.length)[index],
  }));
};

// Time series data formatting
export const formatTimeSeriesData = (
  data: Record<string, unknown>[],
  dateKey: string,
  valueKeys: string[]
): TimeSeriesData[] => {
  return data.map(item => {
    const formattedItem: TimeSeriesData = {
      date: format(parseISO(String(item[dateKey])), 'MMM dd'),
    };

    valueKeys.forEach(key => {
      const val = item[key];
      formattedItem[key] = typeof val === 'number' ? val : String(val ?? '');
    });

    return formattedItem;
  });
};

// Occupancy rate calculation
export const calculateOccupancyRate = (occupied: number, total: number): number => {
  if (total === 0) return 0;
  return (occupied / total) * 100;
};

// Average calculation
export const calculateAverage = (values: number[]): number => {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
};

// Room status priorities for sorting
export const getRoomStatusPriority = (status: string): number => {
  const priorities: Record<string, number> = {
    out_of_order: 1,
    maintenance: 2,
    dirty: 3,
    reserved: 4,
    vacant: 5,
    occupied: 6,
  };
  return priorities[status] || 6;
};

// Alert severity priorities
export const getAlertSeverityPriority = (severity: string): number => {
  const priorities: Record<string, number> = {
    critical: 1,
    urgent: 2,
    high: 3,
    medium: 4,
    low: 5,
  };
  return priorities[severity] || 6;
};

// Sort alerts by severity and timestamp
export const sortAlerts = (alerts: { severity: string; timestamp?: string; createdAt?: string }[]): { severity: string; timestamp?: string; createdAt?: string }[] => {
  return [...alerts].sort((a, b) => {
    const severityDiff = getAlertSeverityPriority(a.severity) - getAlertSeverityPriority(b.severity);
    if (severityDiff !== 0) return severityDiff;

    // If same severity, sort by timestamp (newest first) — handle both timestamp and createdAt
    const timeA = new Date(a.timestamp || a.createdAt || 0).getTime();
    const timeB = new Date(b.timestamp || b.createdAt || 0).getTime();
    return timeB - timeA;
  });
};

// Generate summary statistics
export const generateSummaryStats = (data: number[]) => {
  if (data.length === 0) {
    return { min: 0, max: 0, avg: 0, total: 0, count: 0 };
  }
  
  const sorted = [...data].sort((a, b) => a - b);
  const total = data.reduce((sum, val) => sum + val, 0);
  
  return {
    min: sorted[0],
    max: sorted[sorted.length - 1],
    avg: total / data.length,
    total,
    count: data.length,
  };
};

// Time formatting utilities
export const formatDuration = (minutes: number): string => {
  if (minutes < 60) {
    return `${minutes}m`;
  }
  
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  
  if (remainingMinutes === 0) {
    return `${hours}h`;
  }
  
  return `${hours}h ${remainingMinutes}m`;
};

// Relative time formatting
export const formatRelativeTime = (date: string | Date | undefined | null): string => {
  if (!date) return 'Unknown';
  
  try {
    const now = new Date();
    const targetDate = typeof date === 'string' ? parseISO(date) : date;
    
    if (!targetDate || isNaN(targetDate.getTime())) return 'Invalid date';
    
    const diffInMinutes = Math.floor((now.getTime() - targetDate.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours}h ago`;
    
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) return `${diffInDays}d ago`;
    
    return format(targetDate, 'MMM dd, yyyy');
  } catch (error) {
    return 'Unknown';
  }
};

// Data export utilities
export const downloadBlob = (blob: Blob, filename: string) => {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
};

// Generate filename for exports
export const generateExportFilename = (
  type: string,
  hotelId?: string,
  dateRange?: { start: string; end: string }
): string => {
  const timestamp = format(new Date(), 'yyyy-MM-dd-HHmm');
  const hotel = hotelId ? `-${hotelId}` : '';
  const range = dateRange ? `-${dateRange.start}-to-${dateRange.end}` : '';
  
  return `${type}${hotel}${range}-${timestamp}`;
};

// Format date utility
export const formatDate = (date: string | Date | undefined | null, formatString: string = 'MMM dd, yyyy'): string => {
  if (!date) return 'N/A';
  
  try {
    const dateObj = typeof date === 'string' ? parseISO(date) : date;
    if (!dateObj || isNaN(dateObj.getTime())) return 'Invalid date';
    
    return format(dateObj, formatString);
  } catch (error) {
    return 'Invalid date';
  }
};