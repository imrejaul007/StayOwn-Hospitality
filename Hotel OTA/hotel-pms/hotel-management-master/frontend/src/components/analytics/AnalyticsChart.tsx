import React, { useMemo } from 'react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

export interface ChartData {
  labels: string[];
  datasets: {
    label: string;
    data: number[];
    backgroundColor?: string | string[];
    borderColor?: string | string[];
    borderWidth?: number;
    fill?: boolean;
    tension?: number;
  }[];
}

export interface AnalyticsChartProps {
  type: 'line' | 'bar' | 'pie' | 'doughnut';
  data: ChartData;
  title?: string;
  height?: number;
  options?: unknown;
  className?: string;
}

const defaultColors = {
  gradient: [
    'rgba(99, 102, 241, 0.8)',
    'rgba(16, 185, 129, 0.8)',
    'rgba(245, 158, 11, 0.8)',
    'rgba(239, 68, 68, 0.8)',
    'rgba(139, 92, 246, 0.8)',
    'rgba(236, 72, 153, 0.8)',
  ]
};

const defaultStrokeColors = [
  'rgba(99, 102, 241, 1)',
  'rgba(16, 185, 129, 1)',
  'rgba(245, 158, 11, 1)',
  'rgba(239, 68, 68, 1)',
  'rgba(139, 92, 246, 1)',
  'rgba(236, 72, 153, 1)',
];

const AnalyticsChart: React.FC<AnalyticsChartProps> = ({
  type,
  data,
  title,
  height = 300,
  options = {},
  className = ''
}) => {
  // Convert Chart.js data format to Recharts format
  const rechartsData = useMemo(() => {
    if (type === 'pie' || type === 'doughnut') {
      // For pie/doughnut: create array of { name, value, fill } from first dataset
      const dataset = data.datasets[0];
      if (!dataset) return [];
      const bgColors = Array.isArray(dataset.backgroundColor)
        ? dataset.backgroundColor
        : defaultColors.gradient;
      return data.labels.map((label, i) => ({
        name: label,
        value: dataset.data[i],
        fill: bgColors[i % bgColors.length],
      }));
    } else {
      // For line/bar: create array of { name, [datasetLabel]: value, ... }
      return data.labels.map((label, i) => {
        const point: Record<string, unknown> = { name: label };
        data.datasets.forEach((dataset) => {
          point[dataset.label] = dataset.data[i];
        });
        return point;
      });
    }
  }, [data, type]);

  // Resolve colors for each dataset
  const getStrokeColor = (dataset: ChartData['datasets'][0], index: number): string => {
    if (dataset.borderColor) {
      return Array.isArray(dataset.borderColor) ? dataset.borderColor[0] : dataset.borderColor;
    }
    return defaultStrokeColors[index % defaultStrokeColors.length];
  };

  const getFillColor = (dataset: ChartData['datasets'][0], index: number): string => {
    if (dataset.backgroundColor) {
      return Array.isArray(dataset.backgroundColor) ? dataset.backgroundColor[0] : dataset.backgroundColor;
    }
    return defaultColors.gradient[index % defaultColors.gradient.length];
  };

  const renderChart = () => {
    switch (type) {
      case 'line':
        return (
          <LineChart data={rechartsData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Legend />
            {data.datasets.map((dataset, index) => (
              <Line
                key={dataset.label}
                type="monotone"
                dataKey={dataset.label}
                stroke={getStrokeColor(dataset, index)}
                strokeWidth={dataset.borderWidth ?? 2}
                dot={false}
                activeDot={{ r: 4 }}
              />
            ))}
          </LineChart>
        );

      case 'bar':
        return (
          <BarChart data={rechartsData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Legend />
            {data.datasets.map((dataset, index) => (
              <Bar
                key={dataset.label}
                dataKey={dataset.label}
                fill={getFillColor(dataset, index)}
                radius={[4, 4, 0, 0]}
              />
            ))}
          </BarChart>
        );

      case 'pie':
      case 'doughnut':
        return (
          <PieChart>
            <Pie
              data={rechartsData}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={type === 'doughnut' ? '40%' : 0}
              outerRadius="80%"
              strokeWidth={2}
              stroke="#fff"
            >
              {rechartsData.map((entry: Record<string, unknown>, index: number) => (
                <Cell key={`cell-${index}`} fill={entry.fill} />
              ))}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        );

      default:
        return null;
    }
  };

  return (
    <div className={`bg-white rounded-lg shadow-sm p-6 ${className}`}>
      {title && (
        <h3 className="text-base font-semibold mb-4" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
          {title}
        </h3>
      )}
      <div style={{ height: `${height}px` }}>
        <ResponsiveContainer width="100%" height="100%">
          {renderChart()!}
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default AnalyticsChart;
