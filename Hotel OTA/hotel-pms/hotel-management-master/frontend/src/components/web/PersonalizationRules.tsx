import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '../ui/dialog';
// Alert component - using div with alert styling
import { Switch } from '../ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { 
  Users, 
  Target, 
  Plus, 
  Edit, 
  Trash2, 
  Play, 
  Pause, 
  BarChart3,
  TrendingUp,
  Eye,
  Settings,
  Zap,
  AlertTriangle,
  CheckCircle,
  Clock,
  Globe,
  Smartphone,
  Monitor,
  MapPin,
  Calendar,
  Filter,
  Copy,
  Save
} from 'lucide-react';

interface PersonalizationRule {
  id: string;
  name: string;
  description: string;
  status: 'active' | 'paused' | 'draft';
  priority: number;
  conditions: PersonalizationCondition[];
  actions: PersonalizationAction[];
  targetAudience: {
    segments: string[];
    percentage: number;
  };
  performance: {
    impressions: number;
    conversions: number;
    conversionRate: number;
    revenue: number;
  };
  createdAt: string;
  updatedAt: string;
}

interface PersonalizationCondition {
  id: string;
  type: 'user_segment' | 'device' | 'location' | 'time' | 'referrer' | 'behavior' | 'custom';
  operator: 'equals' | 'not_equals' | 'contains' | 'not_contains' | 'greater_than' | 'less_than' | 'in' | 'not_in';
  value: string | string[] | number;
  field?: string;
}

interface PersonalizationAction {
  id: string;
  type: 'show_content' | 'hide_content' | 'change_text' | 'change_image' | 'redirect' | 'show_popup' | 'apply_discount';
  target: string;
  value: string;
  parameters?: Record<string, unknown>;
}

interface UserSegment {
  id: string;
  name: string;
  description: string;
  criteria: unknown[];
  userCount: number;
  createdAt: string;
}

const PersonalizationRules: React.FC = () => {
  const [activeTab, setActiveTab] = useState('rules');
  const [rules, setRules] = useState<PersonalizationRule[]>([]);
  const [segments, setSegments] = useState<UserSegment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateRuleDialog, setShowCreateRuleDialog] = useState(false);
  const [showCreateSegmentDialog, setShowCreateSegmentDialog] = useState(false);
  const [selectedRule, setSelectedRule] = useState<PersonalizationRule | null>(null);
  const [editingRule, setEditingRule] = useState<PersonalizationRule | null>(null);

  const [newRule, setNewRule] = useState({
    name: '',
    description: '',
    priority: 1,
    conditions: [] as PersonalizationCondition[],
    actions: [] as PersonalizationAction[],
    targetAudience: {
      segments: [] as string[],
      percentage: 100
    }
  });

  const [newSegment, setNewSegment] = useState({
    name: '',
    description: '',
    criteria: [] as unknown[]
  });

  useEffect(() => {
    fetchPersonalizationData();
  }, []);

  const fetchPersonalizationData = async () => {
    try {
      setLoading(true);
      const hotelId = localStorage.getItem('hotelId');

      if (!hotelId) return;

      // Fetch personalization rules
      const { data: rulesData } = await api.get(`/web-optimization/${hotelId}/personalization-rules`);
      setRules(rulesData.data || []);

      // Fetch user segments
      const { data: segmentsData } = await api.get(`/web-optimization/${hotelId}/user-segments`);
      setSegments(segmentsData.data || []);
    } catch {
      // Error handled silently
    } finally {
      setLoading(false);
    }
  };

  const createPersonalizationRule = async () => {
    try {
      const hotelId = localStorage.getItem('hotelId');

      if (!hotelId) return;

      await api.post(`/web-optimization/${hotelId}/personalization-rules`, newRule);
      setShowCreateRuleDialog(false);
      setNewRule({
        name: '',
        description: '',
        priority: 1,
        conditions: [],
        actions: [],
        targetAudience: { segments: [], percentage: 100 }
      });
      fetchPersonalizationData();
    } catch {
      // Error handled silently
    }
  };

  const createUserSegment = async () => {
    try {
      const hotelId = localStorage.getItem('hotelId');

      if (!hotelId) return;

      await api.post(`/web-optimization/${hotelId}/user-segments`, newSegment);
      setShowCreateSegmentDialog(false);
      setNewSegment({ name: '', description: '', criteria: [] });
      fetchPersonalizationData();
    } catch {
      // Error handled silently
    }
  };

  const toggleRuleStatus = async (ruleId: string, action: 'activate' | 'pause') => {
    try {
      const hotelId = localStorage.getItem('hotelId');

      if (!hotelId) return;

      await api.post(`/web-optimization/${hotelId}/personalization-rules/${ruleId}/${action}`);
      fetchPersonalizationData();
    } catch {
      // Error handled silently
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'paused': return 'bg-yellow-100 text-yellow-800';
      case 'draft': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active': return <CheckCircle className="h-4 w-4" />;
      case 'paused': return <Pause className="h-4 w-4" />;
      case 'draft': return <Clock className="h-4 w-4" />;
      default: return <Settings className="h-4 w-4" />;
    }
  };

  const addCondition = () => {
    const newCondition: PersonalizationCondition = {
      id: `condition_${Date.now()}`,
      type: 'user_segment',
      operator: 'equals',
      value: ''
    };
    setNewRule({
      ...newRule,
      conditions: [...newRule.conditions, newCondition]
    });
  };

  const addAction = () => {
    const newAction: PersonalizationAction = {
      id: `action_${Date.now()}`,
      type: 'show_content',
      target: '',
      value: ''
    };
    setNewRule({
      ...newRule,
      actions: [...newRule.actions, newAction]
    });
  };

  const removeCondition = (conditionId: string) => {
    setNewRule({
      ...newRule,
      conditions: newRule.conditions.filter(c => c.id !== conditionId)
    });
  };

  const removeAction = (actionId: string) => {
    setNewRule({
      ...newRule,
      actions: newRule.actions.filter(a => a.id !== actionId)
    });
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
          <h2 className="text-2xl font-bold text-gray-900">Personalization Rules</h2>
          <p className="text-gray-600 mt-1">
            Create dynamic content and experiences based on user behavior and segments
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <BarChart3 className="h-4 w-4 mr-2" />
            Analytics
          </Button>
          <Button variant="outline">
            <Copy className="h-4 w-4 mr-2" />
            Import Rules
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="rules">Personalization Rules</TabsTrigger>
          <TabsTrigger value="segments">User Segments</TabsTrigger>
        </TabsList>

        <TabsContent value="rules" className="space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Personalization Rules</h3>
            <Dialog open={showCreateRuleDialog} onOpenChange={setShowCreateRuleDialog}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Rule
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Create Personalization Rule</DialogTitle>
                  <DialogDescription>
                    Define conditions and actions to personalize user experiences
                  </DialogDescription>
                </DialogHeader>
                
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="ruleName">Rule Name</Label>
                      <Input
                        id="ruleName"
                        value={newRule.name}
                        onChange={(e) => setNewRule({ ...newRule, name: e.target.value })}
                        placeholder="e.g., Show VIP Offers to Premium Users"
                      />
                    </div>
                    <div>
                      <Label htmlFor="priority">Priority</Label>
                      <Input
                        id="priority"
                        type="number"
                        min="1"
                        max="100"
                        value={newRule.priority}
                        onChange={(e) => setNewRule({ ...newRule, priority: Number(e.target.value) })}
                      />
                    </div>
                  </div>
                  
                  <div>
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      value={newRule.description}
                      onChange={(e) => setNewRule({ ...newRule, description: e.target.value })}
                      placeholder="Describe what this rule does..."
                      rows={3}
                    />
                  </div>

                  {/* Conditions */}
                  <div>
                    <div className="flex justify-between items-center mb-4">
                      <Label>Conditions</Label>
                      <Button size="sm" onClick={addCondition}>
                        <Plus className="h-4 w-4 mr-2" />
                        Add Condition
                      </Button>
                    </div>
                    <div className="space-y-3">
                      {newRule.conditions.map((condition) => (
                        <Card key={condition.id}>
                          <CardContent className="p-4">
                            <div className="grid grid-cols-4 gap-3">
                              <Select 
                                value={condition.type} 
                                onValueChange={(value: Record<string, unknown>) => {
                                  const updatedConditions = newRule.conditions.map(c => 
                                    c.id === condition.id ? { ...c, type: value } : c
                                  );
                                  setNewRule({ ...newRule, conditions: updatedConditions });
                                }}
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="user_segment">User Segment</SelectItem>
                                  <SelectItem value="device">Device</SelectItem>
                                  <SelectItem value="location">Location</SelectItem>
                                  <SelectItem value="time">Time</SelectItem>
                                  <SelectItem value="referrer">Referrer</SelectItem>
                                  <SelectItem value="behavior">Behavior</SelectItem>
                                  <SelectItem value="custom">Custom</SelectItem>
                                </SelectContent>
                              </Select>
                              
                              <Select 
                                value={condition.operator} 
                                onValueChange={(value: Record<string, unknown>) => {
                                  const updatedConditions = newRule.conditions.map(c => 
                                    c.id === condition.id ? { ...c, operator: value } : c
                                  );
                                  setNewRule({ ...newRule, conditions: updatedConditions });
                                }}
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="equals">Equals</SelectItem>
                                  <SelectItem value="not_equals">Not Equals</SelectItem>
                                  <SelectItem value="contains">Contains</SelectItem>
                                  <SelectItem value="not_contains">Not Contains</SelectItem>
                                  <SelectItem value="greater_than">Greater Than</SelectItem>
                                  <SelectItem value="less_than">Less Than</SelectItem>
                                  <SelectItem value="in">In</SelectItem>
                                  <SelectItem value="not_in">Not In</SelectItem>
                                </SelectContent>
                              </Select>
                              
                              <Input
                                value={condition.value as string}
                                onChange={(e) => {
                                  const updatedConditions = newRule.conditions.map(c => 
                                    c.id === condition.id ? { ...c, value: e.target.value } : c
                                  );
                                  setNewRule({ ...newRule, conditions: updatedConditions });
                                }}
                                placeholder="Value"
                              />
                              
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={() => removeCondition(condition.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>

                  {/* Actions */}
                  <div>
                    <div className="flex justify-between items-center mb-4">
                      <Label>Actions</Label>
                      <Button size="sm" onClick={addAction}>
                        <Plus className="h-4 w-4 mr-2" />
                        Add Action
                      </Button>
                    </div>
                    <div className="space-y-3">
                      {newRule.actions.map((action) => (
                        <Card key={action.id}>
                          <CardContent className="p-4">
                            <div className="grid grid-cols-4 gap-3">
                              <Select 
                                value={action.type} 
                                onValueChange={(value: Record<string, unknown>) => {
                                  const updatedActions = newRule.actions.map(a => 
                                    a.id === action.id ? { ...a, type: value } : a
                                  );
                                  setNewRule({ ...newRule, actions: updatedActions });
                                }}
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="show_content">Show Content</SelectItem>
                                  <SelectItem value="hide_content">Hide Content</SelectItem>
                                  <SelectItem value="change_text">Change Text</SelectItem>
                                  <SelectItem value="change_image">Change Image</SelectItem>
                                  <SelectItem value="redirect">Redirect</SelectItem>
                                  <SelectItem value="show_popup">Show Popup</SelectItem>
                                  <SelectItem value="apply_discount">Apply Discount</SelectItem>
                                </SelectContent>
                              </Select>
                              
                              <Input
                                value={action.target}
                                onChange={(e) => {
                                  const updatedActions = newRule.actions.map(a => 
                                    a.id === action.id ? { ...a, target: e.target.value } : a
                                  );
                                  setNewRule({ ...newRule, actions: updatedActions });
                                }}
                                placeholder="Target Element/URL"
                              />
                              
                              <Input
                                value={action.value}
                                onChange={(e) => {
                                  const updatedActions = newRule.actions.map(a => 
                                    a.id === action.id ? { ...a, value: e.target.value } : a
                                  );
                                  setNewRule({ ...newRule, actions: updatedActions });
                                }}
                                placeholder="New Value/Content"
                              />
                              
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={() => removeAction(action.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>

                  {/* Target Audience */}
                  <div>
                    <Label>Target Audience</Label>
                    <div className="grid grid-cols-2 gap-4 mt-2">
                      <div>
                        <Label htmlFor="segments">User Segments</Label>
                        <Select 
                          value={newRule.targetAudience.segments[0] || ''} 
                          onValueChange={(value) => {
                            setNewRule({
                              ...newRule,
                              targetAudience: {
                                ...newRule.targetAudience,
                                segments: [value]
                              }
                            });
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select segment" />
                          </SelectTrigger>
                          <SelectContent>
                            {segments.map((segment) => (
                              <SelectItem key={segment.id} value={segment.id}>
                                {segment.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="percentage">Percentage of Audience</Label>
                        <Input
                          id="percentage"
                          type="number"
                          min="1"
                          max="100"
                          value={newRule.targetAudience.percentage}
                          onChange={(e) => setNewRule({
                            ...newRule,
                            targetAudience: {
                              ...newRule.targetAudience,
                              percentage: Number(e.target.value)
                            }
                          })}
                        />
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="flex justify-end space-x-2 pt-4">
                  <Button variant="outline" onClick={() => setShowCreateRuleDialog(false)}>
                    Cancel
                  </Button>
                  <Button onClick={createPersonalizationRule}>Create Rule</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <div className="space-y-4">
            {rules.map((rule) => (
              <Card key={rule.id}>
                <CardContent className="p-4">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h4 className="font-medium">{rule.name}</h4>
                      <p className="text-sm text-gray-500">{rule.description}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={getStatusColor(rule.status)}>
                        {getStatusIcon(rule.status)}
                        {rule.status}
                      </Badge>
                      <Badge variant="outline">Priority: {rule.priority}</Badge>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                    <div>
                      <p className="text-sm text-gray-600">Impressions</p>
                      <p className="font-medium">{rule.performance.impressions.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Conversions</p>
                      <p className="font-medium">{rule.performance.conversions.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Conversion Rate</p>
                      <p className="font-medium">{rule.performance.conversionRate.toFixed(2)}%</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Revenue</p>
                      <p className="font-medium">${rule.performance.revenue.toLocaleString()}</p>
                    </div>
                  </div>
                  
                  <div className="flex gap-2">
                    {rule.status === 'draft' && (
                      <Button 
                        size="sm" 
                        onClick={() => toggleRuleStatus(rule.id, 'activate')}
                      >
                        <Play className="h-4 w-4 mr-2" />
                        Activate
                      </Button>
                    )}
                    {rule.status === 'active' && (
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => toggleRuleStatus(rule.id, 'pause')}
                      >
                        <Pause className="h-4 w-4 mr-2" />
                        Pause
                      </Button>
                    )}
                    {rule.status === 'paused' && (
                      <Button 
                        size="sm" 
                        onClick={() => toggleRuleStatus(rule.id, 'activate')}
                      >
                        <Play className="h-4 w-4 mr-2" />
                        Resume
                      </Button>
                    )}
                    <Button size="sm" variant="outline">
                      <Edit className="h-4 w-4 mr-2" />
                      Edit
                    </Button>
                    <Button size="sm" variant="outline">
                      <BarChart3 className="h-4 w-4 mr-2" />
                      Analytics
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="segments" className="space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">User Segments</h3>
            <Dialog open={showCreateSegmentDialog} onOpenChange={setShowCreateSegmentDialog}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Segment
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create User Segment</DialogTitle>
                  <DialogDescription>
                    Define criteria to group users for personalization
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="segmentName">Segment Name</Label>
                    <Input
                      id="segmentName"
                      value={newSegment.name}
                      onChange={(e) => setNewSegment({ ...newSegment, name: e.target.value })}
                      placeholder="e.g., Premium Users"
                    />
                  </div>
                  <div>
                    <Label htmlFor="segmentDescription">Description</Label>
                    <Textarea
                      id="segmentDescription"
                      value={newSegment.description}
                      onChange={(e) => setNewSegment({ ...newSegment, description: e.target.value })}
                      placeholder="Describe this user segment..."
                      rows={3}
                    />
                  </div>
                </div>
                <div className="flex justify-end space-x-2 pt-4">
                  <Button variant="outline" onClick={() => setShowCreateSegmentDialog(false)}>
                    Cancel
                  </Button>
                  <Button onClick={createUserSegment}>Create Segment</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {segments.map((segment) => (
              <Card key={segment.id}>
                <CardContent className="p-4">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h4 className="font-medium">{segment.name}</h4>
                      <p className="text-sm text-gray-500">{segment.description}</p>
                    </div>
                    <Badge variant="outline">{segment.userCount.toLocaleString()} users</Badge>
                  </div>
                  
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline">
                      <Edit className="h-4 w-4 mr-2" />
                      Edit
                    </Button>
                    <Button size="sm" variant="outline">
                      <BarChart3 className="h-4 w-4 mr-2" />
                      Analytics
                    </Button>
                    <Button size="sm" variant="outline">
                      <Copy className="h-4 w-4 mr-2" />
                      Duplicate
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default PersonalizationRules;
