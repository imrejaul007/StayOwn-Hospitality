import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { 
  Plus, 
  Search, 
  Filter, 
  Settings, 
  Users, 
  Building, 
  TrendingUp,
  CheckCircle,
  XCircle,
  AlertCircle,
  Eye,
  Edit,
  Trash2,
  Play,
  MoreHorizontal
} from 'lucide-react';
import { format } from 'date-fns';
import assignmentRulesService, { AssignmentRule, AssignmentRuleFilters, AssignmentRulesStats, AutoAssignCriteria } from '@/services/assignmentRulesService';
import AssignmentRuleForm from './AssignmentRuleForm';
import AssignmentRuleDetails from './AssignmentRuleDetails';
import { toast } from 'react-hot-toast';

const AssignmentRules: React.FC = () => {
  const [assignmentRules, setAssignmentRules] = useState<AssignmentRule[]>([]);
  const [stats, setStats] = useState<AssignmentRulesStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<AssignmentRuleFilters>({
    page: 1,
    limit: 10,
    sortBy: 'priority',
    sortOrder: 'asc'
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [selectedRule, setSelectedRule] = useState<AssignmentRule | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [editingRule, setEditingRule] = useState<AssignmentRule | null>(null);
  const [autoAssigning, setAutoAssigning] = useState(false);
  const [pagination, setPagination] = useState({
    current: 1,
    pages: 1,
    total: 0
  });

  useEffect(() => {
    fetchAssignmentRules();
    fetchStats();
  }, [filters]);

  const fetchAssignmentRules = async () => {
    try {
      setLoading(true);
      const result = await assignmentRulesService.getAssignmentRules(filters);
      setAssignmentRules(result.data);
      setPagination(result.pagination);
    } catch {
      toast.error('Failed to load assignment rules');
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const statsData = await assignmentRulesService.getAssignmentRulesStats();
      setStats(statsData);
    } catch {
      toast.error('Failed to load assignment rule statistics');
    }
  };

  const handleSearch = () => {
    const searchFilters: AssignmentRuleFilters = {
      ...filters,
      page: 1
    };

    if (statusFilter !== 'all') {
      searchFilters.isActive = statusFilter === 'active';
    }

    if (priorityFilter !== 'all') {
      searchFilters.priority = parseInt(priorityFilter);
    }

    setFilters(searchFilters);
  };

  const handleToggleStatus = async (rule: AssignmentRule) => {
    try {
      const updatedRule = await assignmentRulesService.updateAssignmentRule(rule._id, {
        ...rule,
        conditions: rule.conditions,
        actions: rule.actions,
        restrictions: rule.restrictions
      });
      
      setAssignmentRules(prev => 
        prev.map(r => r._id === rule._id ? { ...updatedRule, isActive: !rule.isActive } : r)
      );
    } catch {
      toast.error('Failed to update assignment rule status');
    }
  };

  const getStatusBadge = (isActive: boolean) => {
    return isActive ? (
      <Badge className="bg-green-100 text-green-800 flex items-center gap-1">
        <CheckCircle className="w-3 h-3" />
        ACTIVE
      </Badge>
    ) : (
      <Badge className="bg-red-100 text-red-800 flex items-center gap-1">
        <XCircle className="w-3 h-3" />
        INACTIVE
      </Badge>
    );
  };

  const getPriorityBadge = (priority: number) => {
    const colors = {
      1: 'bg-red-100 text-red-800',
      2: 'bg-orange-100 text-orange-800',
      3: 'bg-yellow-100 text-yellow-800',
      4: 'bg-blue-100 text-blue-800',
      5: 'bg-gray-100 text-gray-800'
    };
    
    return (
      <Badge className={colors[Math.min(priority, 5) as keyof typeof colors] || 'bg-gray-100 text-gray-800'}>
        Priority {priority}
      </Badge>
    );
  };

  const handleAutoAssign = async () => {
    if (!window.confirm('Are you sure you want to auto-assign rooms based on active assignment rules? This will assign rooms to unassigned bookings.')) {
      return;
    }

    try {
      setAutoAssigning(true);
      const result = await assignmentRulesService.autoAssignRooms();

      toast.success(
        `Auto-assignment completed! ${result.assigned} rooms assigned, ${result.failed} failed, ${result.skipped} skipped.`
      );

      // Refresh stats after auto-assignment
      fetchStats();

    } catch (error) {
      toast.error('Failed to auto-assign rooms. Please try again.');
    } finally {
      setAutoAssigning(false);
    }
  };

  const handleEditRule = (rule: AssignmentRule) => {
    setEditingRule(rule);
    setShowEditForm(true);
  };

  const handleDeleteRule = async (rule: AssignmentRule) => {
    if (!window.confirm(`Are you sure you want to delete the rule "${rule.ruleName}"? This action cannot be undone.`)) {
      return;
    }

    try {
      await assignmentRulesService.deleteAssignmentRule(rule._id);
      setAssignmentRules(prev => prev.filter(r => r._id !== rule._id));
      toast.success('Assignment rule deleted successfully');
      fetchStats();
    } catch (error) {
      toast.error('Failed to delete assignment rule. Please try again.');
    }
  };

  const handleCreateSuccess = (newRule: AssignmentRule) => {
    setAssignmentRules(prev => [newRule, ...prev]);
    setShowCreateForm(false);
    fetchStats();
  };

  const handleEditSuccess = (updatedRule: AssignmentRule) => {
    setAssignmentRules(prev =>
      prev.map(rule => rule._id === updatedRule._id ? updatedRule : rule)
    );
    setShowEditForm(false);
    setEditingRule(null);
    fetchStats();
  };

  if (loading && assignmentRules.length === 0) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Room Assignment Rules</h1>
          <p className="text-gray-600">Configure automatic room assignment logic</p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            onClick={handleAutoAssign}
            disabled={autoAssigning || assignmentRules.length === 0}
            variant="outline"
            className="flex items-center gap-2"
          >
            <Play className="w-4 h-4" />
            {autoAssigning ? 'Auto-Assigning...' : 'Auto-Assign'}
          </Button>
          <Button onClick={() => setShowCreateForm(true)} className="flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Create Rule
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Active Rules</p>
                  <p className="text-xl font-semibold">
                    {stats.statusStats.find(s => s._id === true)?.count || 0}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-100 rounded-lg">
                  <XCircle className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Inactive Rules</p>
                  <p className="text-xl font-semibold">
                    {stats.statusStats.find(s => s._id === false)?.count || 0}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <TrendingUp className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Avg Priority</p>
                  <p className="text-xl font-semibold">
                    {stats.statusStats.find(s => s._id === true)?.avgPriority?.toFixed(1) || '0.0'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <Settings className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Total Rules</p>
                  <p className="text-xl font-semibold">
                    {stats.statusStats.reduce((sum, stat) => sum + stat.count, 0)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-4 items-center">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <Input
                  placeholder="Search assignment rules..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
            
            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Priorities</SelectItem>
                <SelectItem value="1">Priority 1</SelectItem>
                <SelectItem value="2">Priority 2</SelectItem>
                <SelectItem value="3">Priority 3</SelectItem>
                <SelectItem value="4">Priority 4</SelectItem>
                <SelectItem value="5">Priority 5</SelectItem>
              </SelectContent>
            </Select>
            
            <Button onClick={handleSearch} variant="outline" className="flex items-center gap-2">
              <Filter className="w-4 h-4" />
              Filter
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Assignment Rules Table */}
      <Card>
        <CardHeader>
          <CardTitle>Assignment Rules ({pagination.total})</CardTitle>
        </CardHeader>
        <CardContent>
          {assignmentRules.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Settings className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No assignment rules found</p>
              <p className="text-sm">Create your first assignment rule to get started</p>
            </div>
          ) : (
            <div className="space-y-4">
              {assignmentRules.map((rule) => (
                <div
                  key={rule._id}
                  className="border rounded-lg p-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <Settings className="w-4 h-4 text-gray-500" />
                        <h3 className="font-semibold text-lg">{rule.ruleName}</h3>
                        {getStatusBadge(rule.isActive)}
                        {getPriorityBadge(rule.priority)}
                      </div>
                      
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-600 mb-3">
                        <div className="flex items-center gap-2">
                          <Users className="w-4 h-4" />
                          <span>Guest Types: {rule.conditions.guestType?.length || 0}</span>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <Building className="w-4 h-4" />
                          <span>Room Types: {rule.conditions.roomTypes?.length || 0}</span>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <TrendingUp className="w-4 h-4" />
                          <span>Upgrades: {rule.actions.upgradeEligible ? 'Yes' : 'No'}</span>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <CheckCircle className="w-4 h-4" />
                          <span>Created: {format(new Date(rule.createdAt), 'MMM dd, yyyy')}</span>
                        </div>
                      </div>
                      
                      {rule.createdBy && (
                        <div className="text-sm text-gray-600">
                          <span>Created by: {rule.createdBy.name}</span>
                        </div>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={rule.isActive}
                        onCheckedChange={() => handleToggleStatus(rule)}
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedRule(rule)}
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" size="sm">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleEditRule(rule)}>
                            <Edit className="w-4 h-4 mr-2" />
                            Edit Rule
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => handleDeleteRule(rule)}
                            className="text-red-600 focus:text-red-600"
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Delete Rule
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Assignment Rule Dialog */}
      <Dialog open={showCreateForm} onOpenChange={setShowCreateForm}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Assignment Rule</DialogTitle>
            <DialogDescription>
              Create a new room assignment rule to automate room allocation
            </DialogDescription>
          </DialogHeader>
          <AssignmentRuleForm
            onSuccess={handleCreateSuccess}
            onCancel={() => setShowCreateForm(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Edit Assignment Rule Dialog */}
      <Dialog open={showEditForm} onOpenChange={setShowEditForm}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Assignment Rule</DialogTitle>
            <DialogDescription>
              Modify the existing room assignment rule
            </DialogDescription>
          </DialogHeader>
          <AssignmentRuleForm
            editRule={editingRule}
            onSuccess={handleEditSuccess}
            onCancel={() => {
              setShowEditForm(false);
              setEditingRule(null);
            }}
          />
        </DialogContent>
      </Dialog>

      {/* Assignment Rule Details Dialog */}
      <Dialog open={!!selectedRule} onOpenChange={() => setSelectedRule(null)}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          {selectedRule && (
            <AssignmentRuleDetails
              assignmentRule={selectedRule}
              onUpdate={(updatedRule) => {
                setAssignmentRules(prev => 
                  prev.map(rule => 
                    rule._id === updatedRule._id ? updatedRule : rule
                  )
                );
                setSelectedRule(updatedRule);
              }}
              onClose={() => setSelectedRule(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AssignmentRules;