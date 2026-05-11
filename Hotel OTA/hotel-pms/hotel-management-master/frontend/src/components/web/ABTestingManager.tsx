import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '../ui/dialog';
import { Alert, AlertDescription } from '../ui/alert';
import { Progress } from '../ui/progress';
import { 
  Target, 
  Plus, 
  Play, 
  Pause, 
  BarChart3, 
  TrendingUp, 
  TrendingDown,
  Users,
  Eye,
  MousePointer,
  Zap,
  AlertTriangle,
  CheckCircle,
  Clock,
  Settings
} from 'lucide-react';

interface ABTest {
  testId: string;
  testName: string;
  status: 'draft' | 'running' | 'paused' | 'completed';
  variants: ABVariant[];
  startDate?: string;
  endDate?: string;
  hypothesis: string;
  trafficAllocation: number;
  conversions: {
    [variantId: string]: {
      visitors: number;
      conversions: number;
      conversionRate: number;
    };
  };
  statisticalSignificance?: {
    isSignificant: boolean;
    confidenceLevel: number;
    pValue: number;
    winner?: string;
  };
}

interface ABVariant {
  variantId: string;
  variantName: string;
  description?: string;
  isControl: boolean;
  trafficAllocation: number;
  changes: {
    element: string;
    property: string;
    value: string;
  }[];
}

const ABTestingManager: React.FC = () => {
  const [tests, setTests] = useState<ABTest[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedTest, setSelectedTest] = useState<ABTest | null>(null);
  const [showResultsDialog, setShowResultsDialog] = useState(false);

  const [newTest, setNewTest] = useState({
    testName: '',
    hypothesis: '',
    trafficAllocation: 100,
    variants: [
      {
        variantName: 'Control',
        isControl: true,
        trafficAllocation: 50,
        changes: []
      },
      {
        variantName: 'Variant A',
        isControl: false,
        trafficAllocation: 50,
        changes: []
      }
    ]
  });

  useEffect(() => {
    fetchABTests();
  }, []);

  const fetchABTests = async () => {
    try {
      setLoading(true);
      const hotelId = localStorage.getItem('hotelId');

      if (!hotelId) return;

      const { data } = await api.get(`/web-optimization/${hotelId}/ab-tests`);
      setTests(data.data || []);
    } catch {
      // Error handled silently
    } finally {
      setLoading(false);
    }
  };

  const createABTest = async () => {
    try {
      const hotelId = localStorage.getItem('hotelId');

      if (!hotelId) return;

      await api.post(`/web-optimization/${hotelId}/ab-tests`, newTest);
      setShowCreateDialog(false);
      setNewTest({
        testName: '',
        hypothesis: '',
        trafficAllocation: 100,
        variants: [
          {
            variantName: 'Control',
            isControl: true,
            trafficAllocation: 50,
            changes: []
          },
          {
            variantName: 'Variant A',
            isControl: false,
            trafficAllocation: 50,
            changes: []
          }
        ]
      });
      fetchABTests();
    } catch {
      // Error handled silently
    }
  };

  const toggleTestStatus = async (testId: string, action: 'start' | 'pause') => {
    try {
      const hotelId = localStorage.getItem('hotelId');

      if (!hotelId) return;

      await api.post(`/web-optimization/${hotelId}/ab-tests/${testId}/${action}`);
      fetchABTests();
    } catch {
      // Error handled silently
    }
  };

  const viewTestResults = async (test: ABTest) => {
    try {
      const hotelId = localStorage.getItem('hotelId');

      if (!hotelId) return;

      const { data } = await api.get(`/web-optimization/${hotelId}/ab-tests/${test.testId}/results`);
      setSelectedTest({ ...test, ...data.data });
      setShowResultsDialog(true);
    } catch {
      // Error handled silently
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'draft': return <Clock className="h-4 w-4" />;
      case 'running': return <Play className="h-4 w-4" />;
      case 'paused': return <Pause className="h-4 w-4" />;
      case 'completed': return <CheckCircle className="h-4 w-4" />;
      default: return <Settings className="h-4 w-4" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return 'bg-gray-100 text-gray-800';
      case 'running': return 'bg-green-100 text-green-800';
      case 'paused': return 'bg-yellow-100 text-yellow-800';
      case 'completed': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">A/B Testing</h2>
          <p className="text-gray-600 mt-1">
            Test different versions of your booking experience to optimize conversions
          </p>
        </div>
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Create Test
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create New A/B Test</DialogTitle>
              <DialogDescription>
                Design and configure a new A/B test to optimize your website performance
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="testName">Test Name</Label>
                <Input
                  id="testName"
                  value={newTest.testName}
                  onChange={(e) => setNewTest({ ...newTest, testName: e.target.value })}
                  placeholder="e.g., Checkout Button Color Test"
                />
              </div>
              <div>
                <Label htmlFor="hypothesis">Hypothesis</Label>
                <Textarea
                  id="hypothesis"
                  value={newTest.hypothesis}
                  onChange={(e) => setNewTest({ ...newTest, hypothesis: e.target.value })}
                  placeholder="Describe what you expect to happen and why..."
                  rows={3}
                />
              </div>
              <div>
                <Label htmlFor="trafficAllocation">Traffic Allocation (%)</Label>
                <Input
                  id="trafficAllocation"
                  type="number"
                  min="1"
                  max="100"
                  value={newTest.trafficAllocation}
                  onChange={(e) => setNewTest({ ...newTest, trafficAllocation: Number(e.target.value) })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                Cancel
              </Button>
              <Button onClick={createABTest}>Create Test</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {tests.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Target className="h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No A/B Tests Yet</h3>
            <p className="text-gray-500 text-center mb-4 max-w-md">
              Start optimizing your website by creating your first A/B test. Test different versions 
              of your booking flow, pricing displays, or call-to-action buttons.
            </p>
            <Button onClick={() => setShowCreateDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Your First Test
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {tests.map((test) => (
            <Card key={test.testId} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-lg">{test.testName}</CardTitle>
                    <CardDescription className="mt-1">
                      {test.hypothesis.substring(0, 100)}...
                    </CardDescription>
                  </div>
                  <Badge className={`${getStatusColor(test.status)} flex items-center gap-1`}>
                    {getStatusIcon(test.status)}
                    {test.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Test Metrics */}
                <div className="grid grid-cols-2 gap-4">
                  {test.variants.map((variant) => (
                    <div key={variant.variantId} className="bg-gray-50 p-3 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium text-sm">{variant.variantName}</span>
                        {variant.isControl && (
                          <Badge variant="outline" className="text-xs">Control</Badge>
                        )}
                      </div>
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span>Visitors:</span>
                          <span>{test.conversions?.[variant.variantId]?.visitors || 0}</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span>Conversions:</span>
                          <span>{test.conversions?.[variant.variantId]?.conversions || 0}</span>
                        </div>
                        <div className="flex justify-between text-xs font-medium">
                          <span>Rate:</span>
                          <span>{(test.conversions?.[variant.variantId]?.conversionRate || 0).toFixed(2)}%</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Statistical Significance */}
                {test.statisticalSignificance && (
                  <Alert>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      {test.statisticalSignificance.isSignificant ? (
                        <span className="text-green-600">
                          Statistically significant result! Confidence: {test.statisticalSignificance.confidenceLevel}%
                        </span>
                      ) : (
                        <span className="text-orange-600">
                          Not yet statistically significant. Continue test for reliable results.
                        </span>
                      )}
                    </AlertDescription>
                  </Alert>
                )}

                {/* Action Buttons */}
                <div className="flex gap-2">
                  {test.status === 'draft' && (
                    <Button 
                      size="sm" 
                      onClick={() => toggleTestStatus(test.testId, 'start')}
                      className="flex-1"
                    >
                      <Play className="h-4 w-4 mr-2" />
                      Start Test
                    </Button>
                  )}
                  {test.status === 'running' && (
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => toggleTestStatus(test.testId, 'pause')}
                      className="flex-1"
                    >
                      <Pause className="h-4 w-4 mr-2" />
                      Pause Test
                    </Button>
                  )}
                  {test.status === 'paused' && (
                    <Button 
                      size="sm" 
                      onClick={() => toggleTestStatus(test.testId, 'start')}
                      className="flex-1"
                    >
                      <Play className="h-4 w-4 mr-2" />
                      Resume Test
                    </Button>
                  )}
                  <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={() => viewTestResults(test)}
                    className="flex-1"
                  >
                    <BarChart3 className="h-4 w-4 mr-2" />
                    View Results
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Results Dialog */}
      <Dialog open={showResultsDialog} onOpenChange={setShowResultsDialog}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>{selectedTest?.testName} - Results</DialogTitle>
            <DialogDescription>
              Detailed analysis of your A/B test performance
            </DialogDescription>
          </DialogHeader>
          
          {selectedTest && (
            <div className="space-y-6">
              {/* Overall Performance */}
              <div className="grid grid-cols-3 gap-4">
                <Card>
                  <CardContent className="p-4 text-center">
                    <Users className="h-8 w-8 mx-auto mb-2 text-blue-600" />
                    <p className="text-2xl font-bold">
                      {Object.values(selectedTest.conversions || {}).reduce((sum, variant) => sum + variant.visitors, 0)}
                    </p>
                    <p className="text-sm text-gray-600">Total Visitors</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <Target className="h-8 w-8 mx-auto mb-2 text-green-600" />
                    <p className="text-2xl font-bold">
                      {Object.values(selectedTest.conversions || {}).reduce((sum, variant) => sum + variant.conversions, 0)}
                    </p>
                    <p className="text-sm text-gray-600">Total Conversions</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <TrendingUp className="h-8 w-8 mx-auto mb-2 text-purple-600" />
                    <p className="text-2xl font-bold">
                      {((Object.values(selectedTest.conversions || {}).reduce((sum, variant) => sum + variant.conversions, 0) /
                        Object.values(selectedTest.conversions || {}).reduce((sum, variant) => sum + variant.visitors, 1)) * 100).toFixed(2)}%
                    </p>
                    <p className="text-sm text-gray-600">Overall Rate</p>
                  </CardContent>
                </Card>
              </div>

              {/* Variant Comparison */}
              <div className="space-y-4">
                <h4 className="text-lg font-semibold">Variant Performance</h4>
                {selectedTest.variants.map((variant) => {
                  const variantData = selectedTest.conversions?.[variant.variantId] || {
                    visitors: 0,
                    conversions: 0,
                    conversionRate: 0
                  };
                  
                  return (
                    <Card key={variant.variantId}>
                      <CardContent className="p-4">
                        <div className="flex justify-between items-center mb-3">
                          <div className="flex items-center gap-2">
                            <h5 className="font-medium">{variant.variantName}</h5>
                            {variant.isControl && (
                              <Badge variant="outline">Control</Badge>
                            )}
                            {selectedTest.statisticalSignificance?.winner === variant.variantId && (
                              <Badge className="bg-green-100 text-green-800">Winner</Badge>
                            )}
                          </div>
                          <div className="text-2xl font-bold">
                            {variantData.conversionRate.toFixed(2)}%
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-3 gap-4 mb-3">
                          <div>
                            <p className="text-sm text-gray-600">Visitors</p>
                            <p className="font-medium">{variantData.visitors.toLocaleString()}</p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-600">Conversions</p>
                            <p className="font-medium">{variantData.conversions.toLocaleString()}</p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-600">Traffic Share</p>
                            <p className="font-medium">{variant.trafficAllocation}%</p>
                          </div>
                        </div>
                        
                        <Progress value={variantData.conversionRate} className="h-2" />
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              {/* Statistical Significance */}
              {selectedTest.statisticalSignificance && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Statistical Analysis</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <p className="text-sm text-gray-600">Confidence Level</p>
                        <p className="text-2xl font-bold">{selectedTest.statisticalSignificance.confidenceLevel}%</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">P-Value</p>
                        <p className="text-2xl font-bold">{selectedTest.statisticalSignificance.pValue.toFixed(4)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Result</p>
                        <p className={`text-2xl font-bold ${selectedTest.statisticalSignificance.isSignificant ? 'text-green-600' : 'text-orange-600'}`}>
                          {selectedTest.statisticalSignificance.isSignificant ? 'Significant' : 'Not Significant'}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ABTestingManager;