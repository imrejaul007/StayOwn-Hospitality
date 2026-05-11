import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { bookingEngineService } from '@/services/bookingEngineService';

const BookingEngineTest: React.FC = () => {
  const [dashboardData, setDashboardData] = useState<unknown>(null);
  const [widgets, setWidgets] = useState<unknown[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const testDashboardAPI = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const data = await bookingEngineService.getMarketingDashboard();
      setDashboardData(data);
      
    } catch (err: unknown) {
      setError(err.message || 'Failed to fetch dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const testWidgetsAPI = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const data = await bookingEngineService.getBookingWidgets();
      setWidgets(data);
      
    } catch (err: unknown) {
      setError(err.message || 'Failed to fetch widgets');
    } finally {
      setLoading(false);
    }
  };

  const testAllAPIs = async () => {
    await testDashboardAPI();
    await testWidgetsAPI();
  };

  useEffect(() => {
    // Auto-test on component mount
    testAllAPIs();
  }, []);

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Booking Engine API Test</h1>
        <div className="space-x-2">
          <Button onClick={testDashboardAPI} disabled={loading}>
            Test Dashboard
          </Button>
          <Button onClick={testWidgetsAPI} disabled={loading}>
            Test Widgets
          </Button>
          <Button onClick={testAllAPIs} disabled={loading}>
            Test All APIs
          </Button>
        </div>
      </div>

      {loading && (
        <Card>
          <CardContent className="p-4">
            <div className="text-center">🔄 Testing APIs...</div>
          </CardContent>
        </Card>
      )}

      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-4">
            <div className="text-red-800">❌ Error: {error}</div>
          </CardContent>
        </Card>
      )}

      {dashboardData && (
        <Card>
          <CardHeader>
            <CardTitle>✅ Dashboard API Response</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div><strong>Widget Performance:</strong></div>
              <div className="ml-4">
                <div>• Impressions: {dashboardData.widgetPerformance?.totalImpressions || 0}</div>
                <div>• Clicks: {dashboardData.widgetPerformance?.totalClicks || 0}</div>
                <div>• Conversions: {dashboardData.widgetPerformance?.totalConversions || 0}</div>
                <div>• Conversion Rate: {dashboardData.widgetPerformance?.conversionRate?.toFixed(2) || 0}%</div>
              </div>
              <div><strong>Email Marketing:</strong></div>
              <div className="ml-4">
                <div>• Total Sent: {dashboardData.emailMarketing?.totalSent || 0}</div>
                <div>• Open Rate: {dashboardData.emailMarketing?.openRate?.toFixed(2) || 0}%</div>
                <div>• Click Rate: {dashboardData.emailMarketing?.clickRate?.toFixed(2) || 0}%</div>
              </div>
              <div><strong>Total Widgets:</strong> {dashboardData.totalWidgets || 0}</div>
              <div><strong>Active Campaigns:</strong> {dashboardData.activeCampaigns || 0}</div>
            </div>
          </CardContent>
        </Card>
      )}

      {widgets.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>✅ Widgets API Response</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div><strong>Total Widgets:</strong> {widgets.length}</div>
              {widgets.map((widget, index) => (
                <div key={widget._id} className="ml-4 border-l-2 pl-3">
                  <div><strong>Widget {index + 1}:</strong></div>
                  <div>• Name: {widget.name}</div>
                  <div>• Type: {widget.type}</div>
                  <div>• Status: {widget.isActive ? 'Active' : 'Inactive'}</div>
                  <div>• Impressions: {widget.performance?.impressions || 0}</div>
                  <div>• Clicks: {widget.performance?.clicks || 0}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>📋 Test Instructions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <div>1. <strong>Check Console:</strong> Open browser console to see API calls and responses</div>
            <div>2. <strong>Verify Data:</strong> Ensure data is displayed correctly above</div>
            <div>3. <strong>Check Network:</strong> Verify API calls in Network tab</div>
            <div>4. <strong>Test Buttons:</strong> Use buttons to manually test individual APIs</div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default BookingEngineTest;
