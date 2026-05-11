import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { Badge } from '../../components/ui/badge';
import { Alert, AlertDescription } from '../../components/ui/alert';
import {
  TrendingUp,
  BarChart3,
  Target,
  Users,
  MousePointer,
  Eye,
  Settings,
  Zap,
  Activity,
  ChevronRight,
  Plus,
  Play,
  Pause,
  RotateCcw
} from 'lucide-react';
import { useProperty } from '../../context/PropertyContext';
import { PropertyBreadcrumb } from '../../components/common/PropertyBreadcrumb';
import ABTestingManager from '../../components/web/ABTestingManager';
import ConversionOptimizer from '../../components/web/ConversionOptimizer';
import PerformanceMonitor from '../../components/web/PerformanceMonitor';
import UserBehaviorTracker from '../../components/web/UserBehaviorTracker';
import PersonalizationRules from '../../components/web/PersonalizationRules';
import { api } from '../../services/api';
import { withErrorBoundary } from '../../components/ErrorBoundary';

interface OptimizationSummary {
  activeTests: number;
  totalConversions: number;
  averagePageLoad: number;
  bounceRate: number;
  activeRules: number;
  totalVisitors: number;
}

interface RecentActivity {
  id: string;
  type: 'test' | 'conversion' | 'performance' | 'behavior';
  message: string;
  timestamp: string;
  status: 'success' | 'warning' | 'info';
}

const AdminWebOptimization: React.FC = () => {
  const { selectedPropertyId, selectedProperty, viewMode } = useProperty();
  const [activeTab, setActiveTab] = useState('overview');
  const [summary, setSummary] = useState<OptimizationSummary>({
    activeTests: 0,
    totalConversions: 0,
    averagePageLoad: 0,
    bounceRate: 0,
    activeRules: 0,
    totalVisitors: 0
  });
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (selectedPropertyId) {
      fetchOptimizationData();
    }
  }, [selectedPropertyId]);

  // Early return if no property selected in single mode
  // NOTE: This must be AFTER all hooks to comply with React rules of hooks
  if (!selectedPropertyId && viewMode === 'single') {
    return <div className="p-6">Please select a property</div>;
  }

  const fetchOptimizationData = async () => {
    try {
      setLoading(true);
      // Fetch optimization summary data
      if (!selectedPropertyId) return;

      const { data } = await api.get(`/web-optimization/${selectedPropertyId}/optimization/report`);
      setSummary(data.summary || summary);
      setRecentActivity(data.recentActivity || []);
    } catch {
      // Error handled silently
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    {
      title: 'Active A/B Tests',
      value: summary.activeTests,
      icon: Target,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      change: '+2 this week'
    },
    {
      title: 'Total Conversions',
      value: summary.totalConversions.toLocaleString(),
      icon: TrendingUp,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
      change: '+12.3% vs last month'
    },
    {
      title: 'Avg Page Load',
      value: `${summary.averagePageLoad.toFixed(2)}s`,
      icon: Zap,
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-50',
      change: '-0.3s improved'
    },
    {
      title: 'Bounce Rate',
      value: `${summary.bounceRate.toFixed(1)}%`,
      icon: Users,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
      change: '-2.1% improved'
    }
  ];

  const quickActions = [
    {
      title: 'Create A/B Test',
      description: 'Test different versions of your booking flow',
      icon: Target,
      action: () => setActiveTab('ab-testing'),
      color: 'text-blue-600'
    },
    {
      title: 'Analyze Performance',
      description: 'Monitor website speed and user experience',
      icon: Activity,
      action: () => setActiveTab('performance'),
      color: 'text-green-600'
    },
    {
      title: 'View Behavior',
      description: 'Understand how users interact with your site',
      icon: MousePointer,
      action: () => setActiveTab('behavior'),
      color: 'text-purple-600'
    },
    {
      title: 'Setup Personalization',
      description: 'Create dynamic content for different user segments',
      icon: Eye,
      action: () => setActiveTab('personalization'),
      color: 'text-orange-600'
    }
  ];

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Property Breadcrumb */}
      <PropertyBreadcrumb items={['Configuration', 'Web Optimization']} />

      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Web Optimization</h1>
          <p className="text-gray-600 mt-2">
            Advanced A/B testing, performance monitoring, and conversion optimization
          </p>
        </div>
        <Button onClick={fetchOptimizationData} variant="outline">
          <RotateCcw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="ab-testing">A/B Testing</TabsTrigger>
          <TabsTrigger value="conversion">Conversion</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="behavior">Behavior</TabsTrigger>
          <TabsTrigger value="personalization">Personalization</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Statistics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {statCards.map((stat, index) => (
              <Card key={`statCards-${index}-${stat.title}`}>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">{stat.title}</p>
                      <p className="text-3xl font-bold text-gray-900 mt-2">{stat.value}</p>
                      <p className="text-xs text-gray-500 mt-1">{stat.change}</p>
                    </div>
                    <div className={`p-3 rounded-full ${stat.bgColor}`}>
                      <stat.icon className={`h-6 w-6 ${stat.color}`} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Quick Actions
              </CardTitle>
              <CardDescription>
                Common optimization tasks and workflows
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {quickActions.map((action, index) => (
                  <Button
                    key={`quickActions-${index}-${action.title}`}
                    variant="outline"
                    className="h-auto p-4 flex flex-col items-start gap-2"
                    onClick={action.action}
                  >
                    <div className="flex items-center gap-2 w-full">
                      <action.icon className={`h-5 w-5 ${action.color}`} />
                      <ChevronRight className="h-4 w-4 ml-auto text-gray-400" />
                    </div>
                    <div className="text-left">
                      <p className="font-medium text-gray-900">{action.title}</p>
                      <p className="text-xs text-gray-500">{action.description}</p>
                    </div>
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Recent Activity */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Recent Activity
              </CardTitle>
            </CardHeader>
            <CardContent>
              {recentActivity.length > 0 ? (
                <div className="space-y-4">
                  {recentActivity.slice(0, 10).map((activity) => (
                    <div key={activity.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                      <Badge 
                        variant={activity.status === 'success' ? 'default' : activity.status === 'warning' ? 'destructive' : 'secondary'}
                        className="capitalize"
                      >
                        {activity.type}
                      </Badge>
                      <div className="flex-1">
                        <p className="text-sm text-gray-900">{activity.message}</p>
                        <p className="text-xs text-gray-500">{new Date(activity.timestamp).toLocaleString()}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <Alert>
                  <AlertDescription>
                    No recent optimization activity found. Start by creating your first A/B test or enabling performance monitoring.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ab-testing">
          <ABTestingManager />
        </TabsContent>

        <TabsContent value="conversion">
          <ConversionOptimizer />
        </TabsContent>

        <TabsContent value="performance">
          <PerformanceMonitor />
        </TabsContent>

        <TabsContent value="behavior">
          <UserBehaviorTracker />
        </TabsContent>

        <TabsContent value="personalization">
          <PersonalizationRules />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default withErrorBoundary(AdminWebOptimization);