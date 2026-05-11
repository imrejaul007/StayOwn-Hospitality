import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Edit, Trash2, Settings, TrendingUp } from 'lucide-react';

interface PricingRule {
  _id: string;
  ruleId: string;
  name: string;
  type: string;
  isActive: boolean;
  priority: number;
  conditions: unknown;
  applicableRoomTypes: unknown[];
  dateRange?: {
    startDate: Date;
    endDate: Date;
  };
}

const PricingRulesManagement: React.FC = () => {
  const [rules, setRules] = useState<PricingRule[]>([]);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedRule, setSelectedRule] = useState<PricingRule | null>(null);
  const [loading, setLoading] = useState(true);

  const [formData, setFormData] = useState({
    name: '',
    type: '',
    priority: 1,
    conditions: {
      occupancyThresholds: [{ minOccupancy: 0, maxOccupancy: 100, adjustment: 0, adjustmentType: 'percentage' }],
      daysOfWeek: [],
      seasonalPeriods: [],
      lengthOfStay: [],
      geographicRules: []
    },
    applicableRoomTypes: [],
    dateRange: {
      startDate: '',
      endDate: ''
    }
  });

  useEffect(() => {
    fetchPricingRules();
  }, []);

  const fetchPricingRules = async () => {
    try {
      setLoading(true);
      const { data } = await api.get('/revenue-management/pricing-rules');
      if (data.success) {
        setRules(data.data);
      } else {
      }
    } catch {
      // Error handled silently
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRule = async () => {
    try {
      const { data } = await api.post('/revenue-management/pricing-rules', {
        ...formData,
        isActive: true
      });
      if (data.success) {
        fetchPricingRules();
        setIsCreateModalOpen(false);
        resetForm();
        alert('Pricing rule created successfully!');
      } else {
        alert('Error creating rule: ' + data.message);
      }
    } catch (error) {
      alert('Error creating rule');
    }
  };

  const handleUpdateRule = async () => {
    if (!selectedRule) return;

    try {
      const { data } = await api.put(`/revenue-management/pricing-rules/${selectedRule._id}`, formData);
      if (data.success) {
        fetchPricingRules();
        setIsEditModalOpen(false);
        setSelectedRule(null);
        resetForm();
        alert('Pricing rule updated successfully!');
      } else {
        alert('Error updating rule: ' + data.message);
      }
    } catch (error) {
      alert('Error updating rule');
    }
  };

  const handleDeleteRule = async (ruleId: string) => {
    if (!confirm('Are you sure you want to delete this pricing rule?')) return;

    try {
      const { data } = await api.delete(`/revenue-management/pricing-rules/${ruleId}`);
      if (data.success) {
        fetchPricingRules();
        alert('Pricing rule deleted successfully!');
      } else {
        alert('Error deleting rule: ' + data.message);
      }
    } catch (error) {
      alert('Error deleting rule');
    }
  };

  const toggleRuleStatus = async (ruleId: string, currentStatus: boolean) => {
    try {
      const { data } = await api.put(`/revenue-management/pricing-rules/${ruleId}`, { isActive: !currentStatus });
      if (data.success) {
        fetchPricingRules();
      }
    } catch {
      // Error handled silently
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      type: '',
      priority: 1,
      conditions: {
        occupancyThresholds: [{ minOccupancy: 0, maxOccupancy: 100, adjustment: 0, adjustmentType: 'percentage' }],
        daysOfWeek: [],
        seasonalPeriods: [],
        lengthOfStay: [],
        geographicRules: []
      },
      applicableRoomTypes: [],
      dateRange: {
        startDate: '',
        endDate: ''
      }
    });
  };

  const openEditModal = (rule: PricingRule) => {
    setSelectedRule(rule);
    setFormData({
      name: rule.name,
      type: rule.type,
      priority: rule.priority,
      conditions: rule.conditions,
      applicableRoomTypes: rule.applicableRoomTypes.map(rt => rt._id),
      dateRange: {
        startDate: rule.dateRange?.startDate ? new Date(rule.dateRange.startDate).toISOString().split('T')[0] : '',
        endDate: rule.dateRange?.endDate ? new Date(rule.dateRange.endDate).toISOString().split('T')[0] : ''
      }
    });
    setIsEditModalOpen(true);
  };

  const getRuleTypeColor = (type: string) => {
    const colors = {
      occupancy_based: 'bg-blue-100 text-blue-800',
      day_of_week: 'bg-green-100 text-green-800',
      seasonal: 'bg-orange-100 text-orange-800',
      length_of_stay: 'bg-purple-100 text-purple-800',
      geographic: 'bg-yellow-100 text-yellow-800',
      demand_based: 'bg-red-100 text-red-800',
      competitor_based: 'bg-gray-100 text-gray-800'
    };
    return colors[type as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  const formatRuleType = (type: string) => {
    return type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const addOccupancyThreshold = () => {
    setFormData({
      ...formData,
      conditions: {
        ...formData.conditions,
        occupancyThresholds: [
          ...formData.conditions.occupancyThresholds,
          { minOccupancy: 0, maxOccupancy: 100, adjustment: 0, adjustmentType: 'percentage' }
        ]
      }
    });
  };

  const updateOccupancyThreshold = (index: number, field: string, value: unknown) => {
    const thresholds = [...formData.conditions.occupancyThresholds];
    thresholds[index] = { ...thresholds[index], [field]: value };
    
    setFormData({
      ...formData,
      conditions: {
        ...formData.conditions,
        occupancyThresholds: thresholds
      }
    });
  };

  const removeOccupancyThreshold = (index: number) => {
    const thresholds = formData.conditions.occupancyThresholds.filter((_, i) => i !== index);
    setFormData({
      ...formData,
      conditions: {
        ...formData.conditions,
        occupancyThresholds: thresholds
      }
    });
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Pricing Rules Management</h1>
        <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Create Rule
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create Pricing Rule</DialogTitle>
            </DialogHeader>
            <PricingRuleForm
              formData={formData}
              setFormData={setFormData}
              onSubmit={handleCreateRule}
              onCancel={() => setIsCreateModalOpen(false)}
              addOccupancyThreshold={addOccupancyThreshold}
              updateOccupancyThreshold={updateOccupancyThreshold}
              removeOccupancyThreshold={removeOccupancyThreshold}
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* Rules List */}
      {loading ? (
        <div className="flex justify-center py-8">
          <div className="text-lg">Loading pricing rules...</div>
        </div>
      ) : (
        <div className="grid gap-6">
          {rules.map((rule) => (
            <Card key={rule._id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-lg flex items-center space-x-2">
                      <span>{rule.name}</span>
                      <Badge className={getRuleTypeColor(rule.type)}>
                        {formatRuleType(rule.type)}
                      </Badge>
                    </CardTitle>
                    <p className="text-sm text-gray-600">Priority: {rule.priority}</p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button
                      size="sm"
                      variant={rule.isActive ? "default" : "outline"}
                      onClick={() => toggleRuleStatus(rule._id, rule.isActive)}
                    >
                      {rule.isActive ? 'Active' : 'Inactive'}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openEditModal(rule)}
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDeleteRule(rule._id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {rule.conditions.occupancyThresholds?.length > 0 && (
                    <div>
                      <h4 className="font-semibold text-sm">Occupancy Thresholds:</h4>
                      {rule.conditions.occupancyThresholds.map((threshold: Record<string, unknown>, index: number) => (
                        <p key={`item-${index}`} className="text-sm text-gray-600">
                          {threshold.minOccupancy}% - {threshold.maxOccupancy}%: {threshold.adjustment}% adjustment
                        </p>
                      ))}
                    </div>
                  )}
                  
                  {rule.applicableRoomTypes.length > 0 && (
                    <div>
                      <h4 className="font-semibold text-sm">Room Types:</h4>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {rule.applicableRoomTypes.map((roomType: Record<string, unknown>) => (
                          <Badge key={roomType._id} variant="secondary" className="text-xs">
                            {roomType.name}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {rule.dateRange && (
                    <div>
                      <h4 className="font-semibold text-sm">Valid Period:</h4>
                      <p className="text-sm text-gray-600">
                        {new Date(rule.dateRange.startDate).toLocaleDateString()} - {new Date(rule.dateRange.endDate).toLocaleDateString()}
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
          
          {rules.length === 0 && (
            <Card>
              <CardContent className="text-center py-8">
                <TrendingUp className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">No pricing rules configured</p>
                <p className="text-sm text-gray-400">Create your first pricing rule to start dynamic pricing</p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Edit Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Pricing Rule</DialogTitle>
          </DialogHeader>
          <PricingRuleForm
            formData={formData}
            setFormData={setFormData}
            onSubmit={handleUpdateRule}
            onCancel={() => setIsEditModalOpen(false)}
            addOccupancyThreshold={addOccupancyThreshold}
            updateOccupancyThreshold={updateOccupancyThreshold}
            removeOccupancyThreshold={removeOccupancyThreshold}
            isEdit
          />
        </DialogContent>
      </Dialog>
    </div>
  );
};

const PricingRuleForm: React.FC<{
  formData: Record<string, unknown>;
  setFormData: (data: Record<string, unknown>) => void;
  onSubmit: () => void;
  onCancel: () => void;
  addOccupancyThreshold: () => void;
  updateOccupancyThreshold: (index: number, field: string, value: unknown) => void;
  removeOccupancyThreshold: (index: number) => void;
  isEdit?: boolean;
}> = ({ formData, setFormData, onSubmit, onCancel, addOccupancyThreshold, updateOccupancyThreshold, removeOccupancyThreshold, isEdit }) => {
  
  return (
    <Tabs defaultValue="basic" className="w-full">
      <TabsList>
        <TabsTrigger value="basic">Basic Info</TabsTrigger>
        <TabsTrigger value="conditions">Conditions</TabsTrigger>
        <TabsTrigger value="schedule">Schedule</TabsTrigger>
      </TabsList>

      <TabsContent value="basic" className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="name">Rule Name</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Enter rule name"
            />
          </div>

          <div>
            <Label htmlFor="type">Rule Type</Label>
            <Select value={formData.type} onValueChange={(value) => setFormData({ ...formData, type: value })}>
              <SelectTrigger>
                <SelectValue placeholder="Select rule type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="occupancy_based">Occupancy Based</SelectItem>
                <SelectItem value="day_of_week">Day of Week</SelectItem>
                <SelectItem value="seasonal">Seasonal</SelectItem>
                <SelectItem value="length_of_stay">Length of Stay</SelectItem>
                <SelectItem value="geographic">Geographic</SelectItem>
                <SelectItem value="demand_based">Demand Based</SelectItem>
                <SelectItem value="competitor_based">Competitor Based</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="priority">Priority (1-10)</Label>
            <Input
              id="priority"
              type="number"
              min="1"
              max="10"
              value={formData.priority}
              onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) })}
            />
          </div>
        </div>
      </TabsContent>

      <TabsContent value="conditions" className="space-y-4">
        {formData.type === 'occupancy_based' && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Occupancy Thresholds</h3>
              <Button onClick={addOccupancyThreshold} size="sm">
                <Plus className="w-4 h-4 mr-2" />
                Add Threshold
              </Button>
            </div>
            
            {formData.conditions.occupancyThresholds.map((threshold: Record<string, unknown>, index: number) => (
              <div key={`item-${index}`} className="grid grid-cols-5 gap-4 items-end p-4 border rounded-lg">
                <div>
                  <Label>Min Occupancy (%)</Label>
                  <Input
                    type="number"
                    value={threshold.minOccupancy}
                    onChange={(e) => updateOccupancyThreshold(index, 'minOccupancy', parseInt(e.target.value))}
                  />
                </div>
                <div>
                  <Label>Max Occupancy (%)</Label>
                  <Input
                    type="number"
                    value={threshold.maxOccupancy}
                    onChange={(e) => updateOccupancyThreshold(index, 'maxOccupancy', parseInt(e.target.value))}
                  />
                </div>
                <div>
                  <Label>Adjustment</Label>
                  <Input
                    type="number"
                    value={threshold.adjustment}
                    onChange={(e) => updateOccupancyThreshold(index, 'adjustment', parseFloat(e.target.value))}
                  />
                </div>
                <div>
                  <Label>Type</Label>
                  <Select
                    value={threshold.adjustmentType}
                    onValueChange={(value) => updateOccupancyThreshold(index, 'adjustmentType', value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percentage">Percentage</SelectItem>
                      <SelectItem value="fixed">Fixed Amount</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => removeOccupancyThreshold(index)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </TabsContent>

      <TabsContent value="schedule" className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="startDate">Start Date</Label>
            <Input
              id="startDate"
              type="date"
              value={formData.dateRange.startDate}
              onChange={(e) => setFormData({
                ...formData,
                dateRange: { ...formData.dateRange, startDate: e.target.value }
              })}
            />
          </div>

          <div>
            <Label htmlFor="endDate">End Date</Label>
            <Input
              id="endDate"
              type="date"
              value={formData.dateRange.endDate}
              onChange={(e) => setFormData({
                ...formData,
                dateRange: { ...formData.dateRange, endDate: e.target.value }
              })}
            />
          </div>
        </div>
      </TabsContent>

      <div className="flex justify-end space-x-2 mt-6">
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={onSubmit}>
          {isEdit ? 'Update' : 'Create'} Rule
        </Button>
      </div>
    </Tabs>
  );
};

export default PricingRulesManagement;