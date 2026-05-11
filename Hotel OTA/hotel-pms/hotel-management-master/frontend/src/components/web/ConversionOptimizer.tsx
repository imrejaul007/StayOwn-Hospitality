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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { 
  TrendingUp, 
  TrendingDown,
  Target, 
  MousePointer, 
  Eye, 
  Users,
  BarChart3,
  Zap,
  AlertTriangle,
  CheckCircle,
  Clock,
  Settings,
  Plus,
  Play,
  Pause,
  RotateCcw,
  Download,
  Upload
} from 'lucide-react';

interface ConversionGoal {
  id: string;
  name: string;
  type: 'page_view' | 'form_submission' | 'button_click' | 'purchase' | 'custom';
  target: string;
  value: number;
  currentRate: number;
  targetRate: number;
  status: 'active' | 'paused' | 'completed';
}

interface HeatmapData {
  element: string;
  clicks: number;
  impressions: number;
  clickRate: number;
  position: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

interface UserJourney {
  step: string;
  page: string;
  visitors: number;
  dropoff: number;
  dropoffRate: number;
  conversionRate: number;
}

interface OptimizationRecommendation {
  id: string;
  type: 'layout' | 'content' | 'cta' | 'form' | 'navigation';
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  effort: 'high' | 'medium' | 'low';
  status: 'pending' | 'implemented' | 'dismissed';
  estimatedImprovement: number;
}

const ConversionOptimizer: React.FC = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [goals, setGoals] = useState<ConversionGoal[]>([]);
  const [heatmapData, setHeatmapData] = useState<HeatmapData[]>([]);
  const [userJourney, setUserJourney] = useState<UserJourney[]>([]);
  const [recommendations, setRecommendations] = useState<OptimizationRecommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateGoalDialog, setShowCreateGoalDialog] = useState(false);
  const [showRecommendationDialog, setShowRecommendationDialog] = useState(false);
  const [selectedRecommendation, setSelectedRecommendation] = useState<OptimizationRecommendation | null>(null);

  const [newGoal, setNewGoal] = useState({
    name: '',
    type: 'page_view' as const,
    target: '',
    targetRate: 0
  });

  useEffect(() => {
    fetchOptimizationData();
  }, []);

  const fetchOptimizationData = async () => {
    try {
      setLoading(true);
      const hotelId = localStorage.getItem('hotelId');

      if (!hotelId) return;

      // Fetch conversion goals
      const { data: goalsData } = await api.get(`/web-optimization/${hotelId}/conversion-goals`);
      setGoals(goalsData.data || []);

      // Fetch heatmap data
      const { data: heatmapResult } = await api.get(`/web-optimization/${hotelId}/heatmap-data`);
      setHeatmapData(heatmapResult.data || []);

      // Fetch user journey data
      const { data: journeyData } = await api.get(`/web-optimization/${hotelId}/user-journey`);
      setUserJourney(journeyData.data || []);

      // Fetch optimization recommendations
      const { data: recommendationsData } = await api.get(`/web-optimization/${hotelId}/recommendations`);
      setRecommendations(recommendationsData.data || []);
    } catch {
      // Error handled silently
    } finally {
      setLoading(false);
    }
  };

  const createConversionGoal = async () => {
    try {
      const hotelId = localStorage.getItem('hotelId');

      if (!hotelId) return;

      await api.post(`/web-optimization/${hotelId}/conversion-goals`, newGoal);
      setShowCreateGoalDialog(false);
      setNewGoal({ name: '', type: 'page_view', target: '', targetRate: 0 });
      fetchOptimizationData();
    } catch {
      // Error handled silently
    }
  };

  const implementRecommendation = async (recommendationId: string) => {
    try {
      const hotelId = localStorage.getItem('hotelId');

      if (!hotelId) return;

      await api.post(`/web-optimization/${hotelId}/recommendations/${recommendationId}/implement`);
      fetchOptimizationData();
    } catch {
      // Error handled silently
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'low': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getImpactColor = (impact: string) => {
    switch (impact) {
      case 'high': return 'text-green-600';
      case 'medium': return 'text-yellow-600';
      case 'low': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
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
          <h2 className="text-2xl font-bold text-gray-900">Conversion Optimization</h2>
          <p className="text-gray-600 mt-1">
            Analyze user behavior and optimize your website for better conversions
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export Data
          </Button>
          <Button variant="outline">
            <Upload className="h-4 w-4 mr-2" />
            Import Heatmap
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="goals">Goals</TabsTrigger>
          <TabsTrigger value="heatmap">Heatmap</TabsTrigger>
          <TabsTrigger value="journey">User Journey</TabsTrigger>
          <TabsTrigger value="recommendations">Recommendations</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Key Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4 text-center">
                <Target className="h-8 w-8 mx-auto mb-2 text-blue-600" />
                <p className="text-2xl font-bold">{goals.length}</p>
                <p className="text-sm text-gray-600">Active Goals</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <TrendingUp className="h-8 w-8 mx-auto mb-2 text-green-600" />
                <p className="text-2xl font-bold">
                  {goals.length > 0 ? (goals.reduce((sum, goal) => sum + goal.currentRate, 0) / goals.length).toFixed(1) : 0}%
                </p>
                <p className="text-sm text-gray-600">Avg Conversion Rate</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <Users className="h-8 w-8 mx-auto mb-2 text-purple-600" />
                <p className="text-2xl font-bold">
                  {userJourney.length > 0 ? userJourney[0]?.visitors || 0 : 0}
                </p>
                <p className="text-sm text-gray-600">Total Visitors</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <Zap className="h-8 w-8 mx-auto mb-2 text-orange-600" />
                <p className="text-2xl font-bold">
                  {recommendations.filter(r => r.status === 'pending').length}
                </p>
                <p className="text-sm text-gray-600">Pending Recommendations</p>
              </CardContent>
            </Card>
          </div>

          {/* Recent Activity */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Optimization Activity</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {recommendations.slice(0, 5).map((rec) => (
                  <div key={rec.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <Badge className={getPriorityColor(rec.priority)}>
                        {rec.priority}
                      </Badge>
                      <div>
                        <p className="font-medium">{rec.title}</p>
                        <p className="text-sm text-gray-500">{rec.description}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-medium ${getImpactColor(rec.impact)}`}>
                        +{rec.estimatedImprovement}%
                      </span>
                      <Button size="sm" variant="outline">
                        <Eye className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="goals" className="space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Conversion Goals</h3>
            <Dialog open={showCreateGoalDialog} onOpenChange={setShowCreateGoalDialog}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Goal
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create Conversion Goal</DialogTitle>
                  <DialogDescription>
                    Set up a new conversion goal to track and optimize
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="goalName">Goal Name</Label>
                    <Input
                      id="goalName"
                      value={newGoal.name}
                      onChange={(e) => setNewGoal({ ...newGoal, name: e.target.value })}
                      placeholder="e.g., Booking Form Completion"
                    />
                  </div>
                  <div>
                    <Label htmlFor="goalType">Goal Type</Label>
                    <Select value={newGoal.type} onValueChange={(value: Record<string, unknown>) => setNewGoal({ ...newGoal, type: value })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="page_view">Page View</SelectItem>
                        <SelectItem value="form_submission">Form Submission</SelectItem>
                        <SelectItem value="button_click">Button Click</SelectItem>
                        <SelectItem value="purchase">Purchase</SelectItem>
                        <SelectItem value="custom">Custom Event</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="goalTarget">Target Element/Page</Label>
                    <Input
                      id="goalTarget"
                      value={newGoal.target}
                      onChange={(e) => setNewGoal({ ...newGoal, target: e.target.value })}
                      placeholder="e.g., /booking/confirmation"
                    />
                  </div>
                  <div>
                    <Label htmlFor="targetRate">Target Conversion Rate (%)</Label>
                    <Input
                      id="targetRate"
                      type="number"
                      min="0"
                      max="100"
                      value={newGoal.targetRate}
                      onChange={(e) => setNewGoal({ ...newGoal, targetRate: Number(e.target.value) })}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowCreateGoalDialog(false)}>
                    Cancel
                  </Button>
                  <Button onClick={createConversionGoal}>Create Goal</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {goals.map((goal) => (
              <Card key={goal.id}>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-lg">{goal.name}</CardTitle>
                      <CardDescription>{goal.target}</CardDescription>
                    </div>
                    <Badge className={getStatusColor(goal.status)}>
                      {goal.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-600">Current Rate</p>
                      <p className="text-2xl font-bold">{goal.currentRate.toFixed(2)}%</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Target Rate</p>
                      <p className="text-2xl font-bold">{goal.targetRate.toFixed(2)}%</p>
                    </div>
                  </div>
                  
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>Progress to Target</span>
                      <span>{((goal.currentRate / goal.targetRate) * 100).toFixed(1)}%</span>
                    </div>
                    <Progress value={(goal.currentRate / goal.targetRate) * 100} className="h-2" />
                  </div>

                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" className="flex-1">
                      <BarChart3 className="h-4 w-4 mr-2" />
                      View Details
                    </Button>
                    <Button size="sm" variant="outline" className="flex-1">
                      <Settings className="h-4 w-4 mr-2" />
                      Configure
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="heatmap" className="space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Click Heatmap</h3>
            <div className="flex gap-2">
              <Button variant="outline" size="sm">
                <Play className="h-4 w-4 mr-2" />
                Start Recording
              </Button>
              <Button variant="outline" size="sm">
                <Pause className="h-4 w-4 mr-2" />
                Pause
              </Button>
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Page Element Performance</CardTitle>
              <CardDescription>
                Click rates and interaction data for page elements
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {heatmapData.map((data, index) => (
                  <div key={`heatmapData-${index}`} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <MousePointer className="h-5 w-5 text-gray-400" />
                      <div>
                        <p className="font-medium">{data.element}</p>
                        <p className="text-sm text-gray-500">
                          {data.clicks} clicks • {data.impressions} impressions
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold">{data.clickRate.toFixed(2)}%</p>
                      <p className="text-sm text-gray-500">Click Rate</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="journey" className="space-y-6">
          <h3 className="text-lg font-semibold">User Journey Analysis</h3>
          
          <Card>
            <CardHeader>
              <CardTitle>Conversion Funnel</CardTitle>
              <CardDescription>
                Track user progression through your booking flow
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {userJourney.map((step, index) => (
                  <div key={`userJourney-${index}`} className="relative">
                    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                          <span className="text-sm font-bold text-blue-600">{index + 1}</span>
                        </div>
                        <div>
                          <p className="font-medium">{step.step}</p>
                          <p className="text-sm text-gray-500">{step.page}</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-4 text-right">
                        <div>
                          <p className="text-lg font-bold">{step.visitors.toLocaleString()}</p>
                          <p className="text-sm text-gray-500">Visitors</p>
                        </div>
                        <div>
                          <p className="text-lg font-bold text-red-600">{step.dropoff.toLocaleString()}</p>
                          <p className="text-sm text-gray-500">Dropoffs</p>
                        </div>
                        <div>
                          <p className="text-lg font-bold text-green-600">{step.conversionRate.toFixed(1)}%</p>
                          <p className="text-sm text-gray-500">Rate</p>
                        </div>
                      </div>
                    </div>
                    {index < userJourney.length - 1 && (
                      <div className="flex justify-center my-2">
                        <div className="w-px h-8 bg-gray-300"></div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="recommendations" className="space-y-6">
          <h3 className="text-lg font-semibold">Optimization Recommendations</h3>
          
          <div className="space-y-4">
            {recommendations.map((rec) => (
              <Card key={rec.id}>
                <CardContent className="p-4">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-3">
                      <Badge className={getPriorityColor(rec.priority)}>
                        {rec.priority}
                      </Badge>
                      <div>
                        <h4 className="font-medium">{rec.title}</h4>
                        <p className="text-sm text-gray-500">{rec.description}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`text-lg font-bold ${getImpactColor(rec.impact)}`}>
                        +{rec.estimatedImprovement}%
                      </p>
                      <p className="text-sm text-gray-500">Est. Improvement</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-1">
                        <span className="text-sm text-gray-600">Impact:</span>
                        <Badge variant="outline" className={getImpactColor(rec.impact)}>
                          {rec.impact}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-sm text-gray-600">Effort:</span>
                        <Badge variant="outline">
                          {rec.effort}
                        </Badge>
                      </div>
                    </div>
                    
                    <div className="flex gap-2">
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => {
                          setSelectedRecommendation(rec);
                          setShowRecommendationDialog(true);
                        }}
                      >
                        <Eye className="h-4 w-4 mr-2" />
                        View Details
                      </Button>
                      {rec.status === 'pending' && (
                        <Button 
                          size="sm"
                          onClick={() => implementRecommendation(rec.id)}
                        >
                          <Zap className="h-4 w-4 mr-2" />
                          Implement
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* Recommendation Details Dialog */}
      <Dialog open={showRecommendationDialog} onOpenChange={setShowRecommendationDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selectedRecommendation?.title}</DialogTitle>
            <DialogDescription>
              Detailed analysis and implementation guide
            </DialogDescription>
          </DialogHeader>
          
          {selectedRecommendation && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Priority</Label>
                  <Badge className={getPriorityColor(selectedRecommendation.priority)}>
                    {selectedRecommendation.priority}
                  </Badge>
                </div>
                <div>
                  <Label>Estimated Improvement</Label>
                  <p className={`text-2xl font-bold ${getImpactColor(selectedRecommendation.impact)}`}>
                    +{selectedRecommendation.estimatedImprovement}%
                  </p>
                </div>
              </div>
              
              <div>
                <Label>Description</Label>
                <p className="text-sm text-gray-600 mt-1">{selectedRecommendation.description}</p>
              </div>
              
              <div>
                <Label>Implementation Steps</Label>
                <div className="mt-2 space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center">
                      <span className="text-xs font-bold text-blue-600">1</span>
                    </div>
                    <span className="text-sm">Analyze current user behavior data</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center">
                      <span className="text-xs font-bold text-blue-600">2</span>
                    </div>
                    <span className="text-sm">Create A/B test for the recommended change</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center">
                      <span className="text-xs font-bold text-blue-600">3</span>
                    </div>
                    <span className="text-sm">Monitor performance and iterate</span>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRecommendationDialog(false)}>
              Close
            </Button>
            {selectedRecommendation?.status === 'pending' && (
              <Button onClick={() => {
                if (selectedRecommendation) {
                  implementRecommendation(selectedRecommendation.id);
                  setShowRecommendationDialog(false);
                }
              }}>
                <Zap className="h-4 w-4 mr-2" />
                Implement Recommendation
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ConversionOptimizer;
