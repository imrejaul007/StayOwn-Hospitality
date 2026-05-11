import React from 'react';
import { AreaChart as RechartsAreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { cn } from '../../../utils/cn';

interface AreaChartProps {
  data: unknown[];
  xDataKey: string;
  areas: {
    dataKey: string;
    name?: string;
    color?: string;
    strokeWidth?: number;
    fillOpacity?: number;
    stackId?: string;
  }[];
  height?: number;
  showGrid?: boolean;
  showLegend?: boolean;
  showTooltip?: boolean;
  curved?: boolean;
  stacked?: boolean;
  className?: string;
}

export function AreaChart({
  data,
  xDataKey,
  areas,
  height = 300,
  showGrid = true,
  showLegend = true,
  showTooltip = true,
  curved = true,
  stacked = false,
  className,
}: AreaChartProps) {
  const defaultColors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

  if (!data || data.length === 0) {
    return (
      <div className={cn('flex items-center justify-center', className)} style={{ height }}>
        <p className="text-gray-500">No data available</p>
      </div>
    );
  }

  // Sanitize data: replace NaN/undefined/null/Infinity with 0 for all area dataKeys
  const areaKeys = areas.map(a => a.dataKey);
  const sanitizedData = (data || []).map(item => {
    const row = { ...(item as Record<string, unknown>) };
    for (const key of areaKeys) {
      const v = Number(row[key]);
      row[key] = Number.isFinite(v) ? v : 0;
    }
    return row;
  });

  const CustomTooltip = ({ active, payload, label }: Record<string, unknown>) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
          <p className="text-sm font-medium text-gray-900 mb-2">{label}</p>
          {payload.map((entry: Record<string, unknown>, index: number) => (
            <div key={`tooltip-${entry.name || index}`} className="flex items-center space-x-2">
              <div
                className="w-3 h-3 rounded-full"
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
    <div className={cn('w-full', className)}>
      <ResponsiveContainer width="100%" height={height}>
        <RechartsAreaChart data={sanitizedData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
          <defs>
            {areas.map((area, index) => {
              const color = area.color || defaultColors[index % defaultColors.length];
              return (
                <linearGradient key={area.dataKey} id={`gradient-${area.dataKey}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={color} stopOpacity={area.fillOpacity || 0.3} />
                  <stop offset="95%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              );
            })}
          </defs>
          {showGrid && (
            <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
          )}
          <XAxis
            dataKey={xDataKey}
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 12, fill: '#6b7280' }}
            dy={10}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 12, fill: '#6b7280' }}
            tickFormatter={(value) => 
              typeof value === 'number' && value >= 1000 
                ? `${(value / 1000).toFixed(0)}k`
                : value
            }
          />
          {showTooltip && <Tooltip content={<CustomTooltip />} />}
          {showLegend && (
            <Legend 
              wrapperStyle={{ paddingTop: '20px' }}
              iconType="rect"
            />
          )}
          {areas.map((area, index) => {
            const color = area.color || defaultColors[index % defaultColors.length];
            return (
              <Area
                key={area.dataKey}
                type={curved ? 'monotone' : 'linear'}
                dataKey={area.dataKey}
                name={area.name || area.dataKey}
                stackId={stacked ? area.stackId || 'default' : undefined}
                stroke={color}
                strokeWidth={area.strokeWidth || 2}
                fill={`url(#gradient-${area.dataKey})`}
                fillOpacity={1}
              />
            );
          })}
        </RechartsAreaChart>
      </ResponsiveContainer>
    </div>
  );
}