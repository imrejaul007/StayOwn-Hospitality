import React, { useState, useEffect } from 'react';
import { cn } from '../../../utils/cn';
import {
  MetricCard,
  ChartCard,
  DataTable,
  FilterBar,
  QuickFilters,
  AlertCard,
  ExportButton,
  BarChart,
  PieChart,
} from '../../../components/dashboard';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Modal } from '@/components/ui/Modal';
import { toast } from '../../../utils/toast';
import { useAlerts } from '../../../hooks/useDashboard';
import { useProperty } from '../../../context/PropertyContext';
import { formatRelativeTime, sortAlerts } from '../../../utils/dashboardUtils';
import type { Alert } from '../../../types/dashboard';
import { withErrorBoundary } from '../../../components/ErrorBoundary';

function AlertsDashboard() {
  const { selectedPropertyId } = useProperty();

  const [filters, setFilters] = useState({
    hotelId: selectedPropertyId || '',
    severity: '',
    category: '',
    status: 'active',
  });

  useEffect(() => {
    if (selectedPropertyId) {
      setFilters(prev => ({ ...prev, hotelId: selectedPropertyId }));
    }
  }, [selectedPropertyId]);

  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);
  const [showAcknowledgeModal, setShowAcknowledgeModal] = useState(false);

  const alertsQuery = useAlerts(
    filters.hotelId,
    filters.severity,
    filters.category,
    filters.status,
    undefined,
    { refetchInterval: 30000 }
  );

  const handleFilterChange = (key: string, value: unknown) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const handleQuickFilter = (severity: string) => {
    setFilters(prev => ({ ...prev, severity }));
  };

  const handleAcknowledgeAlert = (alertId: string) => {
    toast.success(`Alert ${alertId} acknowledged`);
    setShowAcknowledgeModal(false);
    alertsQuery.refetch();
  };

  const handleViewAlertDetails = (alert: Alert) => {
    setSelectedAlert(alert);
  };

  const data = alertsQuery.data?.data;
  const sortedAlerts = data?.alerts ? sortAlerts(data.alerts) : [];

  const getSeverityStats = () => {
    if (!data?.alerts) return [];
    
    const stats = data.alerts.reduce((acc, alert) => {
      acc[alert.severity] = (acc[alert.severity] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(stats).map(([severity, count]) => ({
      severity,
      count,
      percentage: (count / data.alerts.length) * 100,
    }));
  };

  const getTypeStats = () => {
    if (!data?.alerts) return [];
    
    const stats = data.alerts.reduce((acc, alert) => {
      acc[alert.type] = (acc[alert.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(stats).map(([type, count]) => ({
      name: type.replace('_', ' ').toUpperCase(),
      value: count,
    }));
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Alerts Dashboard</h1>
          <p className="text-gray-600 mt-1">Real-time monitoring and notification management</p>
        </div>
        <div className="flex items-center space-x-3">
          <Button
            onClick={() => alertsQuery.refetch()}
            loading={alertsQuery.isLoading}
            variant="secondary"
          >
            Refresh
          </Button>
          <ExportButton
            endpoint="alerts"
            params={{
              hotelId: filters.hotelId,
              severity: filters.severity,
              category: filters.category,
            }}
            filename="alerts-report"
          />
        </div>
      </div>

      {/* Quick Severity Filters */}
      <QuickFilters
        options={[
          { key: '', label: 'All Alerts', icon: null },
          { 
            key: 'critical', 
            label: 'Critical', 
            icon: (
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            )
          },
          { 
            key: 'urgent', 
            label: 'Urgent',
            icon: (
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            )
          },
          { key: 'high', label: 'High' },
          { key: 'medium', label: 'Medium' },
          { key: 'low', label: 'Low' },
        ]}
        activeFilter={filters.severity}
        onChange={handleQuickFilter}
      />

      {/* Filters */}
      <FilterBar
        filters={[
          {
            key: 'hotelId',
            label: 'Hotel',
            type: 'select',
            options: [
              { value: selectedPropertyId || '', label: 'Select Hotel' },
            ],
          },
          {
            key: 'category',
            label: 'Category',
            type: 'select',
            options: [
              { value: '', label: 'All Categories' },
              { value: 'incident', label: 'Incident' },
              { value: 'maintenance', label: 'Maintenance' },
              { value: 'finance', label: 'Finance' },
              { value: 'service', label: 'Service' },
              { value: 'system', label: 'System' },
            ],
          },
          {
            key: 'status',
            label: 'Status',
            type: 'select',
            options: [
              { value: 'active', label: 'Active' },
              { value: 'acknowledged', label: 'Acknowledged' },
              { value: 'resolved', label: 'Resolved' },
              { value: 'all', label: 'All Status' },
            ],
          },
        ]}
        values={filters}
        onChange={handleFilterChange}
      />

      {/* Alert Summary KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          title="Total Active Alerts"
          value={data?.summary.total || 0}
          color="blue"
          loading={alertsQuery.isLoading}
        />

        <MetricCard
          title="Critical Alerts"
          value={data?.summary.critical || 0}
          color="red"
          loading={alertsQuery.isLoading}
        />

        <MetricCard
          title="High Priority"
          value={data?.summary.high || 0}
          color="yellow"
          loading={alertsQuery.isLoading}
        />

        <MetricCard
          title="Medium / Low"
          value={`${data?.summary.medium || 0} / ${data?.summary.low || 0}`}
          color="green"
          loading={alertsQuery.isLoading}
        />
      </div>

      {/* Alert Analytics Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Alerts by Severity */}
        <ChartCard
          title="Alerts by Severity"
          subtitle="Distribution of alert severity levels"
          loading={alertsQuery.isLoading}
          height="350px"
        >
          <BarChart
            data={getSeverityStats()}
            xDataKey="severity"
            bars={[
              {
                dataKey: 'count',
                name: 'Count',
                color: '#ef4444',
              }
            ]}
            height={300}
          />
        </ChartCard>

        {/* Alerts by Type */}
        <ChartCard
          title="Alerts by Type"
          subtitle="Alert distribution by category"
          loading={alertsQuery.isLoading}
          height="350px"
        >
          <PieChart
            data={getTypeStats()}
            height={300}
          />
        </ChartCard>
      </div>

      {/* Alert Timeline */}
      <ChartCard
        title="Alert Timeline"
        subtitle="Current alerts by severity"
        loading={alertsQuery.isLoading}
        height="300px"
      >
        {sortedAlerts.length === 0 ? (
          <div className="flex items-center justify-center h-[250px] text-gray-500">
            No alert data available
          </div>
        ) : (
          <BarChart
            data={getSeverityStats()}
            xDataKey="severity"
            bars={[
              {
                dataKey: 'count',
                name: 'Count',
                color: '#3b82f6',
              }
            ]}
            height={250}
          />
        )}
      </ChartCard>

      {/* Active Alerts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Critical & Urgent Alerts */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex justify-between items-center">
                <span>Critical & Urgent Alerts</span>
                <Badge variant="secondary" className="bg-red-100 text-red-800">
                  {sortedAlerts.filter(alert => 
                    alert.severity === 'critical' || alert.severity === 'urgent'
                  ).length}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {alertsQuery.isLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 3 }, (_, i) => (
                    <div key={i} className="animate-pulse">
                      <div className="h-20 bg-gray-200 rounded"></div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {sortedAlerts
                    .filter(alert => alert.severity === 'critical' || alert.severity === 'urgent')
                    .slice(0, 5)
                    .map((alert) => (
                      <AlertCard
                        key={alert.id}
                        alert={alert}
                        onAcknowledge={handleAcknowledgeAlert}
                        onViewDetails={handleViewAlertDetails}
                        compact={false}
                      />
                    ))}
                  
                  {sortedAlerts.filter(alert => 
                    alert.severity === 'critical' || alert.severity === 'urgent'
                  ).length === 0 && (
                    <div className="text-center py-8">
                      <svg className="w-12 h-12 text-green-400 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                          d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <p className="text-gray-500 text-sm">No critical or urgent alerts</p>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Alert Summary Panel */}
        <div className="space-y-6">
          {/* Severity Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle>Severity Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              {alertsQuery.isLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 4 }, (_, i) => (
                    <div key={i} className="animate-pulse h-4 bg-gray-200 rounded"></div>
                  ))}
                </div>
              ) : (
                <div className="space-y-3">
                  {[
                    { severity: 'critical', label: 'Critical', color: 'bg-red-500', count: data?.summary.critical || 0 },
                    { severity: 'high', label: 'High', color: 'bg-orange-500', count: data?.summary.high || 0 },
                    { severity: 'medium', label: 'Medium', color: 'bg-yellow-500', count: data?.summary.medium || 0 },
                    { severity: 'low', label: 'Low', color: 'bg-green-500', count: data?.summary.low || 0 },
                  ].map((item) => (
                    <div key={item.severity} className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <div className={cn('w-3 h-3 rounded-full', item.color)} />
                        <span className="text-sm font-medium text-gray-700">{item.label}</span>
                      </div>
                      <Badge variant="secondary">{item.count}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Alert Summary */}
          <Card>
            <CardHeader>
              <CardTitle>Alert Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Total active</span>
                    <span className="font-medium text-blue-600">{data?.summary.active || 0}</span>
                  </div>
                </div>
                <div className="text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Acknowledged</span>
                    <span className="font-medium text-yellow-600">{data?.summary.acknowledged || 0}</span>
                  </div>
                </div>
                <div className="text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Resolved</span>
                    <span className="font-medium text-green-600">{data?.summary.resolved || 0}</span>
                  </div>
                </div>
                <div className="text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Total alerts</span>
                    <span className="font-medium text-gray-900">{data?.summary.total || 0}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Button
                  variant="secondary"
                  size="sm"
                  className="w-full"
                  onClick={() => {
                    const criticalAlerts = sortedAlerts.filter(a => a.severity === 'critical');
                    criticalAlerts.forEach(a => handleAcknowledgeAlert(a.id));
                    if (criticalAlerts.length === 0) {
                      toast.info('No critical alerts to acknowledge');
                    }
                  }}
                >
                  Acknowledge All Critical
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  className="w-full"
                  onClick={() => alertsQuery.refetch()}
                >
                  Refresh Alerts
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* All Alerts Table */}
      <DataTable
        title="All Alerts"
        data={sortedAlerts}
        columns={[
          {
            key: 'severity',
            header: 'Severity',
            render: (value) => (
              <Badge 
                variant="secondary"
                className={cn(
                  value === 'critical' && 'bg-red-100 text-red-800',
                  value === 'urgent' && 'bg-red-50 text-red-700',
                  value === 'high' && 'bg-orange-100 text-orange-800',
                  value === 'medium' && 'bg-yellow-100 text-yellow-800',
                  value === 'low' && 'bg-gray-100 text-gray-800'
                )}
              >
                {value.toUpperCase()}
              </Badge>
            ),
            width: '100px',
            sortable: true,
          },
          {
            key: 'type',
            header: 'Type',
            render: (value) => (
              <span className="capitalize">{value.replace('_', ' ')}</span>
            ),
            width: '120px',
          },
          {
            key: 'title',
            header: 'Alert',
            sortable: true,
          },
          {
            key: 'hotel',
            header: 'Hotel',
            width: '120px',
          },
          {
            key: 'timestamp',
            header: 'Time',
            render: (value, row) => formatRelativeTime(value || row?.createdAt),
            width: '120px',
            sortable: true,
          },
          {
            key: 'actions',
            header: 'Actions',
            render: (_, row) => (
              <div className="flex space-x-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleViewAlertDetails(row)}
                >
                  View
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleAcknowledgeAlert(row.id)}
                  className="text-green-600 hover:text-green-700"
                >
                  Acknowledge
                </Button>
              </div>
            ),
            width: '150px',
          },
        ]}
        loading={alertsQuery.isLoading}
        searchable={true}
        pagination={true}
        pageSize={15}
        emptyMessage="No alerts found"
      />

      {/* Alert Details Modal */}
      {selectedAlert && (
        <Modal
          isOpen={!!selectedAlert}
          onClose={() => setSelectedAlert(null)}
          title="Alert Details"
        >
          <div className="space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-medium text-gray-900">{selectedAlert.title}</h3>
                <p className="text-sm text-gray-600 mt-1">{selectedAlert.message}</p>
              </div>
              <Badge 
                variant="secondary"
                className={cn(
                  selectedAlert.severity === 'critical' && 'bg-red-100 text-red-800',
                  selectedAlert.severity === 'high' && 'bg-orange-100 text-orange-800',
                  selectedAlert.severity === 'medium' && 'bg-yellow-100 text-yellow-800',
                  selectedAlert.severity === 'low' && 'bg-gray-100 text-gray-800'
                )}
              >
                {selectedAlert.severity.toUpperCase()}
              </Badge>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-600">Type:</span>
                <span className="ml-2 font-medium capitalize">{selectedAlert.type.replace('_', ' ')}</span>
              </div>
              <div>
                <span className="text-gray-600">Time:</span>
                <span className="ml-2 font-medium">{formatRelativeTime(selectedAlert.timestamp || selectedAlert.createdAt)}</span>
              </div>
              {selectedAlert.hotel && (
                <div>
                  <span className="text-gray-600">Hotel:</span>
                  <span className="ml-2 font-medium">{selectedAlert.hotel}</span>
                </div>
              )}
              {selectedAlert.guest && (
                <div>
                  <span className="text-gray-600">Guest:</span>
                  <span className="ml-2 font-medium">{selectedAlert.guest}</span>
                </div>
              )}
            </div>

            {selectedAlert.action && selectedAlert.actionUrl && (
              <div className="pt-4 border-t border-gray-200">
                <Button
                  variant="primary"
                  onClick={() => window.open(selectedAlert.actionUrl, '_blank')}
                  className="w-full"
                >
                  {selectedAlert.action}
                </Button>
              </div>
            )}

            <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
              <Button variant="secondary" onClick={() => setSelectedAlert(null)}>
                Close
              </Button>
              <Button
                variant="primary"
                onClick={() => handleAcknowledgeAlert(selectedAlert.id)}
              >
                Acknowledge Alert
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

export default withErrorBoundary(AlertsDashboard);
