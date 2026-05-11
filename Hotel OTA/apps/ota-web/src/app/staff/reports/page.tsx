'use client';

import { useState, useEffect } from 'react';

interface ReportData {
  requestsByType: { type: string; count: number; avgTime: number }[];
  responseTimeTrend: { date: string; avgTime: number }[];
  slaCompliance: { type: string; compliance: number }[];
  staffPerformance: { name: string; requests: number; avgTime: number; rating: number }[];
  hourlyDistribution: { hour: number; count: number }[];
  totalRequests: number;
  completedRequests: number;
  avgResponseTime: number;
  overallSlaCompliance: number;
}

export default function ReportsPage() {
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [timeRange, setTimeRange] = useState<'day' | 'week' | 'month'>('week');
  const [reportType, setReportType] = useState<'overview' | 'requests' | 'performance' | 'sla'>('overview');

  useEffect(() => {
    fetchReportData();
  }, [timeRange]);

  const fetchReportData = async () => {
    setLoading(true);
    try {
      // Simulated data
      const mockData: ReportData = {
        requestsByType: [
          { type: 'Housekeeping', count: 145, avgTime: 25 },
          { type: 'Room Service', count: 98, avgTime: 18 },
          { type: 'Spa & Wellness', count: 42, avgTime: 55 },
          { type: 'Laundry', count: 67, avgTime: 95 },
          { type: 'Maintenance', count: 38, avgTime: 35 },
          { type: 'Concierge', count: 56, avgTime: 12 },
        ],
        responseTimeTrend: [
          { date: '2024-01-11', avgTime: 22 },
          { date: '2024-01-12', avgTime: 19 },
          { date: '2024-01-13', avgTime: 21 },
          { date: '2024-01-14', avgTime: 18 },
          { date: '2024-01-15', avgTime: 16 },
          { date: '2024-01-16', avgTime: 15 },
          { date: '2024-01-17', avgTime: 17 },
        ],
        slaCompliance: [
          { type: 'Housekeeping', compliance: 96 },
          { type: 'Room Service', compliance: 94 },
          { type: 'Spa & Wellness', compliance: 92 },
          { type: 'Laundry', compliance: 88 },
          { type: 'Maintenance', compliance: 91 },
          { type: 'Concierge', compliance: 98 },
        ],
        staffPerformance: [
          { name: 'Sarah Johnson', requests: 45, avgTime: 12, rating: 4.9 },
          { name: 'Mike Chen', requests: 38, avgTime: 15, rating: 4.8 },
          { name: 'Lisa Patel', requests: 32, avgTime: 22, rating: 4.7 },
          { name: 'Tom Wilson', requests: 28, avgTime: 18, rating: 4.6 },
        ],
        hourlyDistribution: [
          { hour: 6, count: 12 },
          { hour: 7, count: 25 },
          { hour: 8, count: 45 },
          { hour: 9, count: 38 },
          { hour: 10, count: 32 },
          { hour: 11, count: 28 },
          { hour: 12, count: 35 },
          { hour: 13, count: 42 },
          { hour: 14, count: 30 },
          { hour: 15, count: 25 },
          { hour: 16, count: 22 },
          { hour: 17, count: 28 },
          { hour: 18, count: 35 },
          { hour: 19, count: 40 },
          { hour: 20, count: 32 },
          { hour: 21, count: 25 },
          { hour: 22, count: 18 },
        ],
        totalRequests: 446,
        completedRequests: 412,
        avgResponseTime: 18,
        overallSlaCompliance: 93,
      };

      setReportData(mockData);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const exportReport = async (format: 'pdf' | 'csv') => {
    // Simulated export
    alert(`Exporting report as ${format.toUpperCase()}...`);
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center h-64">
        <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reports & Analytics</h1>
          <p className="text-gray-500 mt-1">Generate insights and track performance trends</p>
        </div>

        <div className="flex flex-wrap gap-3">
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value as typeof timeRange)}
            className="px-4 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="day">Today</option>
            <option value="week">This Week</option>
            <option value="month">This Month</option>
          </select>

          <button
            onClick={() => exportReport('csv')}
            className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Export CSV
          </button>

          <button
            onClick={() => exportReport('pdf')}
            className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
            Export PDF
          </button>
        </div>
      </div>

      {/* Report Type Tabs */}
      <div className="bg-white rounded-xl border border-gray-200 mb-6">
        <div className="flex border-b border-gray-200">
          {(['overview', 'requests', 'performance', 'sla'] as const).map((type) => (
            <button
              key={type}
              onClick={() => setReportType(type)}
              className={`px-6 py-3 text-sm font-medium transition-colors capitalize ${
                reportType === type
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {type}
            </button>
          ))}
        </div>
      </div>

      {/* Report Content */}
      {reportData && (
        <>
          {reportType === 'overview' && (
            <div className="space-y-6">
              {/* Summary Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <SummaryCard
                  label="Total Requests"
                  value={reportData.totalRequests}
                  icon="📋"
                  color="bg-blue-100 text-blue-700"
                />
                <SummaryCard
                  label="Completed"
                  value={reportData.completedRequests}
                  icon="✅"
                  color="bg-green-100 text-green-700"
                />
                <SummaryCard
                  label="Avg Response Time"
                  value={`${reportData.avgResponseTime}m`}
                  icon="⏱️"
                  color="bg-amber-100 text-amber-700"
                />
                <SummaryCard
                  label="SLA Compliance"
                  value={`${reportData.overallSlaCompliance}%`}
                  icon="🎯"
                  color="bg-purple-100 text-purple-700"
                />
              </div>

              {/* Requests by Type */}
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Requests by Service Type</h2>
                <div className="space-y-4">
                  {reportData.requestsByType.map((item) => {
                    const maxCount = Math.max(...reportData.requestsByType.map((i) => i.count));
                    const percentage = (item.count / maxCount) * 100;
                    return (
                      <div key={item.type}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="font-medium text-gray-700">{item.type}</span>
                          <span className="text-gray-500">
                            {item.count} requests • {item.avgTime}m avg
                          </span>
                        </div>
                        <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full transition-all"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Hourly Distribution */}
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Request Distribution by Hour</h2>
                <div className="h-48 flex items-end gap-1">
                  {reportData.hourlyDistribution.map((item) => {
                    const maxCount = Math.max(...reportData.hourlyDistribution.map((h) => h.count));
                    const height = (item.count / maxCount) * 100;
                    return (
                      <div
                        key={item.hour}
                        className="flex-1 bg-blue-500 rounded-t hover:bg-blue-600 transition-colors relative group"
                        style={{ height: `${height}%`, minHeight: '4px' }}
                        title={`${item.hour}:00 - ${item.count} requests`}
                      >
                        <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                          {item.hour}:00 - {item.count}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="flex justify-between mt-2 text-xs text-gray-500">
                  <span>6 AM</span>
                  <span>12 PM</span>
                  <span>6 PM</span>
                  <span>10 PM</span>
                </div>
              </div>
            </div>
          )}

          {reportType === 'requests' && (
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Request Trends</h2>
              <div className="h-80 flex items-end gap-2">
                {reportData.responseTimeTrend.map((day, index) => {
                  const maxTime = Math.max(...reportData.responseTimeTrend.map((d) => d.avgTime));
                  const height = (day.avgTime / maxTime) * 100;
                  const isLast = index === reportData.responseTimeTrend.length - 1;
                  return (
                    <div key={day.date} className="flex-1 flex flex-col items-center gap-2">
                      <div className="w-full relative" style={{ height: '256px' }}>
                        <div
                          className={`absolute bottom-0 w-full rounded-t transition-all ${isLast ? 'bg-blue-600' : 'bg-blue-400'}`}
                          style={{ height: `${height}%`, minHeight: '4px' }}
                        />
                      </div>
                      <span className="text-xs text-gray-500">
                        {new Date(day.date).toLocaleDateString('en-US', { weekday: 'short' })}
                      </span>
                    </div>
                  );
                })}
              </div>
              <div className="flex justify-between mt-4 text-sm text-gray-600">
                <span>Average Response Time (minutes)</span>
                <span className="font-medium text-blue-600">
                  Current: {reportData.responseTimeTrend[reportData.responseTimeTrend.length - 1].avgTime}m
                </span>
              </div>
            </div>
          )}

          {reportType === 'performance' && (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">Staff Performance Report</h2>
              </div>
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Staff Member
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Requests Handled
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Avg Response Time
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Rating
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Performance
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {reportData.staffPerformance.map((staff, index) => (
                    <tr key={staff.name} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center text-gray-600 font-semibold text-sm">
                            {staff.name.split(' ').map((n) => n[0]).join('')}
                          </div>
                          <span className="font-medium text-gray-900">{staff.name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-gray-700">
                        {staff.requests}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-gray-700">
                        {staff.avgTime}m
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-1">
                          <span className="text-amber-400">{'★'.repeat(Math.floor(staff.rating))}</span>
                          <span className="text-gray-400">{'★'.repeat(5 - Math.floor(staff.rating))}</span>
                          <span className="ml-1 text-sm text-gray-600">{staff.rating}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="w-32 h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-green-500 rounded-full"
                            style={{ width: `${(staff.requests / reportData.staffPerformance[0].requests) * 100}%` }}
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {reportType === 'sla' && (
            <div className="space-y-6">
              {/* SLA Compliance Overview */}
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">SLA Compliance by Service Type</h2>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {reportData.slaCompliance.map((item) => {
                    const isGood = item.compliance >= 90;
                    const isWarning = item.compliance >= 80 && item.compliance < 90;
                    return (
                      <div
                        key={item.type}
                        className={`p-4 rounded-xl border-2 ${
                          isGood
                            ? 'border-green-200 bg-green-50'
                            : isWarning
                            ? 'border-amber-200 bg-amber-50'
                            : 'border-red-200 bg-red-50'
                        }`}
                      >
                        <p className="text-sm text-gray-600 mb-1">{item.type}</p>
                        <p
                          className={`text-3xl font-bold ${
                            isGood
                              ? 'text-green-600'
                              : isWarning
                              ? 'text-amber-600'
                              : 'text-red-600'
                          }`}
                        >
                          {item.compliance}%
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          {isGood ? 'Meeting SLA' : isWarning ? 'Needs Improvement' : 'Below Target'}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* SLA Target Reference */}
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">SLA Targets</h2>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-600">Housekeeping</p>
                    <p className="text-lg font-bold text-gray-900">30 min</p>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-600">Room Service</p>
                    <p className="text-lg font-bold text-gray-900">20 min</p>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-600">Spa & Wellness</p>
                    <p className="text-lg font-bold text-gray-900">60 min</p>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-600">Laundry</p>
                    <p className="text-lg font-bold text-gray-900">120 min</p>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-600">Maintenance</p>
                    <p className="text-lg font-bold text-gray-900">45 min</p>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-600">Concierge</p>
                    <p className="text-lg font-bold text-gray-900">15 min</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// Summary Card Component
function SummaryCard({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: string | number;
  icon: string;
  color: string;
}) {
  return (
    <div className={`${color} rounded-xl p-4`}>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xl">{icon}</span>
        <p className="text-sm font-medium opacity-80">{label}</p>
      </div>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  );
}
