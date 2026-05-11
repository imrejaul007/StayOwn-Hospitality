import React from 'react';
import { BarChart as RechartsBarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { cn } from '../../../utils/cn';

interface BarChartProps {
  data: unknown[];
  xDataKey: string;
  bars?: {
    dataKey: string;
    name?: string;
    color?: string;
    radius?: number;
    stackId?: string;
  }[];
  height?: number;
  showGrid?: boolean;
  showLegend?: boolean;
  showTooltip?: boolean;
  layout?: 'horizontal' | 'vertical';
  className?: string;
  onBarClick?: (data: Record<string, unknown>) => void;
}

export function BarChart({
  data,
  xDataKey,
  bars = [],
  height = 300,
  showGrid = true,
  showLegend = true,
  showTooltip = true,
  layout = 'horizontal',
  className,
  onBarClick,
}: BarChartProps) {
  const defaultColors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

  if (!data || data.length === 0) {
    return (
      <div className={cn('flex items-center justify-center', className)} style={{ height }}>
        <p className="text-gray-500">No data available</p>
      </div>
    );
  }

  // Sanitize data: replace NaN/undefined/null/Infinity with 0 for all bar dataKeys
  const barKeys = bars.map(b => b.dataKey);
  const sanitizedData = data.map(item => {
    const row = { ...(item as Record<string, unknown>) };
    for (const key of barKeys) {
      const v = Number(row[key]);
      row[key] = Number.isFinite(v) ? v : 0;
    }
    return row;
  });

  // Calculate dynamic Y-axis domain based on sanitized data
  let maxValue = 0;
  for (const item of sanitizedData) {
    for (const bar of bars) {
      const v = Number(item[bar.dataKey]) || 0;
      if (Number.isFinite(v) && v > maxValue) maxValue = v;
    }
  }
  const yAxisMax = Number.isFinite(maxValue) ? Math.max(maxValue + 2, 10) : 10;
  const yAxisDomain: [number, number] = [0, yAxisMax];

  const CustomTooltip = ({ active, payload, label }: Record<string, unknown>) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
          <p className="text-sm font-medium text-gray-900 mb-2">{label}</p>
          {payload.map((entry: Record<string, unknown>, index: number) => (
            <div key={`tooltip-${entry.name || index}`} className="flex items-center space-x-2">
              <div
                className="w-3 h-3 rounded-sm"
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-sm text-gray-600">{entry.name}:</span>
              <span className="text-sm font-medium text-gray-900">
                {typeof entry.value === 'number' ? entry.value.toLocaleString() : entry.value}
              </span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className={cn('w-full', className)} style={{ height: height || '300px' }}>
      <ResponsiveContainer width="100%" height="100%">
        <RechartsBarChart
          data={sanitizedData}
          margin={{ top: 20, right: 30, left: 20, bottom: layout === 'horizontal' ? 60 : 5 }}
          layout={layout}
          barCategoryGap="20%"
        >
          {showGrid && (
            <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
          )}
          <XAxis
            type={layout === 'horizontal' ? 'category' : 'number'}
            dataKey={layout === 'horizontal' ? xDataKey : undefined}
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 10, fill: '#6b7280' }}
            dy={layout === 'horizontal' ? 10 : 0}
            angle={layout === 'horizontal' ? -45 : 0}
            textAnchor={layout === 'horizontal' ? 'end' : 'middle'}
            height={layout === 'horizontal' ? 60 : undefined}
            interval={0}
            tickFormatter={layout === 'vertical' ? (value) =>
              typeof value === 'number' && value >= 1000
                ? `${(value / 1000).toFixed(0)}k`
                : value
              : (value) => value
            }
          />
          <YAxis
            type={layout === 'horizontal' ? 'number' : 'category'}
            dataKey={layout === 'horizontal' ? undefined : xDataKey}
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 12, fill: '#6b7280' }}
            domain={layout === 'horizontal' ? yAxisDomain : undefined}
            tickFormatter={layout === 'horizontal' ? (value) =>
              typeof value === 'number' && value >= 1000
                ? `${(value / 1000).toFixed(0)}k`
                : value
              : undefined
            }
            width={layout === 'vertical' ? 80 : undefined}
          />
          {showTooltip && <Tooltip content={<CustomTooltip />} />}
          {showLegend && (
            <Legend 
              wrapperStyle={{ paddingTop: '20px' }}
              iconType="rect"
            />
          )}
          {bars && bars.length > 0 ? bars.map((bar, index) => {
            return (
              <Bar
                key={bar.dataKey}
                dataKey={bar.dataKey}
                name={bar.name || bar.dataKey}
                fill={bar.color || defaultColors[index % defaultColors.length]}
                radius={[4, 4, 0, 0]}
                onClick={onBarClick ? (data) => onBarClick(data.payload) : undefined}
                style={{ 
                  cursor: onBarClick ? 'pointer' : 'default'
                }}
              />
            );
          }) : (
            <Bar
              dataKey="value"
              fill={defaultColors[0]}
              radius={[0, 2, 2, 0]}
              minPointSize={2}
              stroke="#000"
              strokeWidth={1}
              onClick={onBarClick ? (data) => onBarClick(data.payload) : undefined}
              style={{ cursor: onBarClick ? 'pointer' : 'default' }}
            />
          )}
        </RechartsBarChart>
      </ResponsiveContainer>
    </div>
  );
}