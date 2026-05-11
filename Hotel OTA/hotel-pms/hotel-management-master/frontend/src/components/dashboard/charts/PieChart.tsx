import React from 'react';
import { PieChart as RechartsPieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { cn } from '../../../utils/cn';

interface PieChartData {
  name: string;
  value: number;
  color?: string;
  percentage?: number;
}

interface PieChartProps {
  data: PieChartData[];
  height?: number;
  showLegend?: boolean;
  showTooltip?: boolean;
  showLabels?: boolean;
  innerRadius?: number;
  outerRadius?: number;
  startAngle?: number;
  endAngle?: number;
  centerContent?: React.ReactNode;
  className?: string;
}

export function PieChart({
  data,
  height = 300,
  showLegend = true,
  showTooltip = true,
  showLabels = false,
  innerRadius = 0,
  outerRadius = 80,
  startAngle = 90,
  endAngle = -270,
  centerContent,
  className,
}: PieChartProps) {
  const defaultColors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#84cc16', '#f97316'];

  if (!data || data.length === 0) {
    return (
      <div className={cn('flex items-center justify-center', className)} style={{ height }}>
        <p className="text-gray-500">No data available</p>
      </div>
    );
  }

  // Sanitize numeric values to prevent NaN reaching recharts
  const dataWithColors = data.map((item, index) => {
    const v = Number(item.value);
    const pct = Number(item.percentage);
    return {
      ...item,
      value: Number.isFinite(v) ? v : 0,
      percentage: Number.isFinite(pct) ? pct : undefined,
      color: item.color || defaultColors[index % defaultColors.length],
    };
  });

  const CustomTooltip = ({ active, payload }: Record<string, unknown>) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
          <div className="flex items-center space-x-2 mb-1">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: data.color }}
            />
            <span className="text-sm font-medium text-gray-900">{data.name}</span>
          </div>
          <p className="text-sm text-gray-600">
            Value: <span className="font-medium">{(Number(data.value) || 0).toLocaleString()}</span>
          </p>
          {data.percentage != null && Number.isFinite(Number(data.percentage)) && (
            <p className="text-sm text-gray-600">
              Percentage: <span className="font-medium">{Number(data.percentage).toFixed(1)}%</span>
            </p>
          )}
        </div>
      );
    }
    return null;
  };

  const CustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, value, name }: Record<string, unknown>) => {
    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    return (
      <text
        x={x}
        y={y}
        fill="white"
        textAnchor={x > cx ? 'start' : 'end'}
        dominantBaseline="central"
        className="text-xs font-medium"
      >
        {value}
      </text>
    );
  };

  const CustomLegend = ({ payload }: Record<string, unknown>) => (
    <div className="flex flex-wrap gap-4 justify-center mt-4">
      {payload.map((entry: Record<string, unknown>, index: number) => (
        <div key={`legend-${entry.value || index}`} className="flex items-center space-x-2">
          <div
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-sm text-gray-700">{entry.value}</span>
        </div>
      ))}
    </div>
  );

  return (
    <div className={cn('w-full relative', className)}>
      <ResponsiveContainer width="100%" height={height}>
        <RechartsPieChart>
          <Pie
            data={dataWithColors}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={showLabels ? CustomLabel : false}
            outerRadius={outerRadius}
            innerRadius={innerRadius}
            fill="#8884d8"
            dataKey="value"
            startAngle={startAngle}
            endAngle={endAngle}
          >
            {dataWithColors.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          {showTooltip && <Tooltip content={<CustomTooltip />} />}
          {showLegend && <Legend content={<CustomLegend />} />}
        </RechartsPieChart>
      </ResponsiveContainer>
      
      {centerContent && innerRadius > 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center">
            {centerContent}
          </div>
        </div>
      )}
    </div>
  );
}

// Donut Chart (Pie chart with inner radius)
interface DonutChartProps extends Omit<PieChartProps, 'innerRadius'> {
  innerRadius?: number;
}

export function DonutChart({ innerRadius = 50, ...props }: DonutChartProps) {
  return <PieChart {...props} innerRadius={innerRadius} />;
}