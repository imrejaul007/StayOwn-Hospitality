import React, { useState } from 'react';
import { withErrorBoundary } from '../../components/ErrorBoundary';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import {
  Package,
  Plus,
  BarChart3,
  Clock,
  AlertTriangle,
  CheckCircle,
  TrendingUp,
  Settings,
  Download,
  RefreshCw
} from 'lucide-react';
import { useProperty } from '../../context/PropertyContext';
import { PropertyBreadcrumb } from '../../components/common/PropertyBreadcrumb';
import LaundryDashboard from '@/components/inventory/LaundryDashboard';
import LaundryTransactionForm from '@/components/inventory/LaundryTransactionForm';
import LaundryStatusTracker from '@/components/inventory/LaundryStatusTracker';

const AdminLaundryManagement: React.FC = () => {
  const { selectedPropertyId, selectedProperty, viewMode } = useProperty();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [showTransactionForm, setShowTransactionForm] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleTransactionSuccess = (result: Record<string, unknown>) => {
    setShowTransactionForm(false);
    setRefreshKey(prev => prev + 1); // Trigger refresh of dashboard and tracker
  };

  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1);
  };

  if (!selectedPropertyId && viewMode === 'single') {
    return <div className="p-6">Please select a property</div>;
  }

  return (
    <div className="space-y-6">
      <PropertyBreadcrumb items={['Laundry Management']} />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Laundry Management</h1>
          <p className="text-gray-600">
            Track and manage laundry items from rooms to laundry service and back to inventory
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Button onClick={handleRefresh} variant="outline">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh All
          </Button>
          <Dialog open={showTransactionForm} onOpenChange={setShowTransactionForm}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Send Items to Laundry
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Send Items to Laundry</DialogTitle>
                <DialogDescription>
                  Select items from room inventory to send for laundry service
                </DialogDescription>
              </DialogHeader>
              <LaundryTransactionForm
                propertyId={selectedPropertyId}
                onSuccess={handleTransactionSuccess}
                onCancel={() => setShowTransactionForm(false)}
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="dashboard" className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4" />
            Dashboard
          </TabsTrigger>
          <TabsTrigger value="tracker" className="flex items-center gap-2">
            <Clock className="w-4 h-4" />
            Status Tracker
          </TabsTrigger>
          <TabsTrigger value="transactions" className="flex items-center gap-2">
            <Package className="w-4 h-4" />
            All Transactions
          </TabsTrigger>
          <TabsTrigger value="reports" className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            Reports
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="space-y-6">
          <LaundryDashboard key={refreshKey} propertyId={selectedPropertyId} />
        </TabsContent>

        <TabsContent value="tracker" className="space-y-6">
          <LaundryStatusTracker key={refreshKey} propertyId={selectedPropertyId} />
        </TabsContent>

        <TabsContent value="transactions" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="w-5 h-5" />
                All Laundry Transactions
              </CardTitle>
              <CardDescription>
                Complete list of all laundry transactions with filtering and search capabilities
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12">
                <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">All Transactions View</h3>
                <p className="text-gray-600 mb-4">
                  This view will show all laundry transactions with advanced filtering, sorting, and bulk operations.
                </p>
                <Button variant="outline">
                  <Settings className="w-4 h-4 mr-2" />
                  Configure View
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reports" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5" />
                  Laundry Statistics
                </CardTitle>
                <CardDescription>
                  Performance metrics and cost analysis
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8">
                  <BarChart3 className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Statistics Report</h3>
                  <p className="text-gray-600 mb-4">
                    Detailed analytics on laundry performance, costs, and trends.
                  </p>
                  <Button variant="outline">
                    <Download className="w-4 h-4 mr-2" />
                    Generate Report
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5" />
                  Overdue Items Report
                </CardTitle>
                <CardDescription>
                  Items that are past their expected return date
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8">
                  <Clock className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Overdue Report</h3>
                  <p className="text-gray-600 mb-4">
                    Track and manage items that are overdue for return.
                  </p>
                  <Button variant="outline">
                    <Download className="w-4 h-4 mr-2" />
                    Export Report
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5" />
                  Quality Control Report
                </CardTitle>
                <CardDescription>
                  Quality assessment and issue tracking
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8">
                  <CheckCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Quality Report</h3>
                  <p className="text-gray-600 mb-4">
                    Monitor quality issues and laundry service performance.
                  </p>
                  <Button variant="outline">
                    <Download className="w-4 h-4 mr-2" />
                    View Report
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="w-5 h-5" />
                  Cost Analysis Report
                </CardTitle>
                <CardDescription>
                  Detailed cost breakdown and budget tracking
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8">
                  <TrendingUp className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Cost Report</h3>
                  <p className="text-gray-600 mb-4">
                    Analyze laundry costs by category, room, and time period.
                  </p>
                  <Button variant="outline">
                    <Download className="w-4 h-4 mr-2" />
                    Generate Report
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminLaundryManagement;
