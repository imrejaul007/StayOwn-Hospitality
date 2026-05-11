import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { X, Plus } from 'lucide-react';
import assignmentRulesService, { AssignmentRule, CreateAssignmentRuleData } from '@/services/assignmentRulesService';

interface AssignmentRuleFormProps {
  onSuccess: (rule: AssignmentRule) => void;
  onCancel: () => void;
  assignmentRule?: AssignmentRule;
  editRule?: AssignmentRule;
}

const AssignmentRuleForm: React.FC<AssignmentRuleFormProps> = ({
  onSuccess,
  onCancel,
  assignmentRule,
  editRule
}) => {
  const currentRule = editRule || assignmentRule;
  const [formData, setFormData] = useState<CreateAssignmentRuleData>({
    ruleName: currentRule?.ruleName || '',
    priority: currentRule?.priority || 1,
    conditions: {
      guestType: currentRule?.conditions.guestType || [],
      reservationType: currentRule?.conditions.reservationType || [],
      roomTypes: currentRule?.conditions.roomTypes || [],
      lengthOfStay: currentRule?.conditions.lengthOfStay || {},
      advanceBooking: currentRule?.conditions.advanceBooking || {},
      seasonality: currentRule?.conditions.seasonality || [],
      occupancyLevel: currentRule?.conditions.occupancyLevel || {}
    },
    actions: {
      preferredFloors: currentRule?.actions.preferredFloors || [],
      preferredRoomNumbers: currentRule?.actions.preferredRoomNumbers || [],
      avoidRoomNumbers: currentRule?.actions.avoidRoomNumbers || [],
      upgradeEligible: currentRule?.actions.upgradeEligible || false,
      upgradeFromTypes: currentRule?.actions.upgradeFromTypes || [],
      upgradeToTypes: currentRule?.actions.upgradeToTypes || [],
      amenityPackages: currentRule?.actions.amenityPackages || [],
      specialServices: currentRule?.actions.specialServices || [],
      rateOverrides: currentRule?.actions.rateOverrides || {}
    },
    restrictions: {
      maxUpgrades: currentRule?.restrictions.maxUpgrades || 0,
      blockoutDates: currentRule?.restrictions.blockoutDates || [],
      minimumRevenue: currentRule?.restrictions.minimumRevenue || 0,
      requiredApproval: currentRule?.restrictions.requiredApproval || 'none'
    }
  });

  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [newRoomNumber, setNewRoomNumber] = useState('');
  const [newFloor, setNewFloor] = useState('');

  const handleInputChange = (field: string, value: unknown) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const handleNestedInputChange = (section: keyof CreateAssignmentRuleData, field: string, value: unknown) => {
    setFormData(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        [field]: value
      }
    }));
  };

  const handleArrayToggle = (section: keyof CreateAssignmentRuleData, field: string, item: string) => {
    setFormData(prev => {
      const currentArray = (prev[section] as unknown)[field] || [];
      const newArray = currentArray.includes(item)
        ? currentArray.filter((i: string) => i !== item)
        : [...currentArray, item];
      
      return {
        ...prev,
        [section]: {
          ...prev[section],
          [field]: newArray
        }
      };
    });
  };

  const handleAddRoom = (type: 'preferred' | 'avoid') => {
    if (!newRoomNumber.trim()) return;
    
    const field = type === 'preferred' ? 'preferredRoomNumbers' : 'avoidRoomNumbers';
    const currentRooms = formData.actions[field] || [];
    
    if (!currentRooms.includes(newRoomNumber)) {
      handleNestedInputChange('actions', field, [...currentRooms, newRoomNumber]);
    }
    setNewRoomNumber('');
  };

  const handleRemoveRoom = (type: 'preferred' | 'avoid', roomNumber: string) => {
    const field = type === 'preferred' ? 'preferredRoomNumbers' : 'avoidRoomNumbers';
    const currentRooms = formData.actions[field] || [];
    handleNestedInputChange('actions', field, currentRooms.filter(room => room !== roomNumber));
  };

  const handleAddFloor = () => {
    if (!newFloor.trim()) return;
    
    const floorNumber = parseInt(newFloor);
    if (isNaN(floorNumber)) return;
    
    const currentFloors = formData.actions.preferredFloors || [];
    if (!currentFloors.includes(floorNumber)) {
      handleNestedInputChange('actions', 'preferredFloors', [...currentFloors, floorNumber]);
    }
    setNewFloor('');
  };

  const handleRemoveFloor = (floor: number) => {
    const currentFloors = formData.actions.preferredFloors || [];
    handleNestedInputChange('actions', 'preferredFloors', currentFloors.filter(f => f !== floor));
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.ruleName?.trim()) {
      newErrors.ruleName = 'Rule name is required';
    }

    if (!formData.priority || formData.priority < 1 || formData.priority > 10) {
      newErrors.priority = 'Priority must be between 1 and 10';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    try {
      setLoading(true);
      
      const ruleData = {
        ...formData,
        // Clean up empty arrays and objects
        conditions: {
          ...formData.conditions,
          guestType: formData.conditions.guestType?.length ? formData.conditions.guestType : undefined,
          reservationType: formData.conditions.reservationType?.length ? formData.conditions.reservationType : undefined,
          roomTypes: formData.conditions.roomTypes?.length ? formData.conditions.roomTypes : undefined,
          seasonality: formData.conditions.seasonality?.length ? formData.conditions.seasonality : undefined
        },
        actions: {
          ...formData.actions,
          preferredFloors: formData.actions.preferredFloors?.length ? formData.actions.preferredFloors : undefined,
          preferredRoomNumbers: formData.actions.preferredRoomNumbers?.length ? formData.actions.preferredRoomNumbers : undefined,
          avoidRoomNumbers: formData.actions.avoidRoomNumbers?.length ? formData.actions.avoidRoomNumbers : undefined,
          upgradeFromTypes: formData.actions.upgradeFromTypes?.length ? formData.actions.upgradeFromTypes : undefined,
          upgradeToTypes: formData.actions.upgradeToTypes?.length ? formData.actions.upgradeToTypes : undefined,
          amenityPackages: formData.actions.amenityPackages?.length ? formData.actions.amenityPackages : undefined,
          specialServices: formData.actions.specialServices?.length ? formData.actions.specialServices : undefined
        }
      };

      let result: AssignmentRule;
      if (currentRule) {
        result = await assignmentRulesService.updateAssignmentRule(currentRule._id, ruleData);
      } else {
        result = await assignmentRulesService.createAssignmentRule(ruleData);
      }
      
      onSuccess(result);
    } catch (error) {
      setErrors({ general: 'Failed to save assignment rule. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {errors.general && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {errors.general}
        </div>
      )}

      <Tabs defaultValue="basic" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="basic">Basic Info</TabsTrigger>
          <TabsTrigger value="conditions">Conditions</TabsTrigger>
          <TabsTrigger value="actions">Actions</TabsTrigger>
          <TabsTrigger value="restrictions">Restrictions</TabsTrigger>
        </TabsList>

        <TabsContent value="basic" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Basic Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="ruleName">Rule Name *</Label>
                <Input
                  id="ruleName"
                  value={formData.ruleName}
                  onChange={(e) => handleInputChange('ruleName', e.target.value)}
                  placeholder="Enter rule name"
                  className={errors.ruleName ? 'border-red-500' : ''}
                />
                {errors.ruleName && <p className="text-red-500 text-sm mt-1">{errors.ruleName}</p>}
              </div>

              <div>
                <Label htmlFor="priority">Priority (1-10) *</Label>
                <Input
                  id="priority"
                  type="number"
                  min="1"
                  max="10"
                  value={formData.priority}
                  onChange={(e) => handleInputChange('priority', parseInt(e.target.value))}
                  className={errors.priority ? 'border-red-500' : ''}
                />
                {errors.priority && <p className="text-red-500 text-sm mt-1">{errors.priority}</p>}
                <p className="text-sm text-gray-500 mt-1">Lower numbers have higher priority</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="conditions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Rule Conditions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Guest Types */}
              <div>
                <Label>Guest Types</Label>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  {assignmentRulesService.getGuestTypes().map((type) => (
                    <div key={type} className="flex items-center space-x-2">
                      <Checkbox
                        id={`guest-${type}`}
                        checked={formData.conditions.guestType?.includes(type) || false}
                        onCheckedChange={() => handleArrayToggle('conditions', 'guestType', type)}
                      />
                      <Label htmlFor={`guest-${type}`} className="capitalize">
                        {type.replace('_', ' ')}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              {/* Room Types */}
              <div>
                <Label>Room Types</Label>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  {assignmentRulesService.getRoomTypes().map((type) => (
                    <div key={type} className="flex items-center space-x-2">
                      <Checkbox
                        id={`room-${type}`}
                        checked={formData.conditions.roomTypes?.includes(type) || false}
                        onCheckedChange={() => handleArrayToggle('conditions', 'roomTypes', type)}
                      />
                      <Label htmlFor={`room-${type}`} className="capitalize">
                        {type}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              {/* Length of Stay */}
              <div>
                <Label>Length of Stay (nights)</Label>
                <div className="grid grid-cols-2 gap-4 mt-2">
                  <div>
                    <Label htmlFor="minStay">Minimum</Label>
                    <Input
                      id="minStay"
                      type="number"
                      min="1"
                      value={formData.conditions.lengthOfStay?.min || ''}
                      onChange={(e) => handleNestedInputChange('conditions', 'lengthOfStay', {
                        ...formData.conditions.lengthOfStay,
                        min: parseInt(e.target.value) || undefined
                      })}
                      placeholder="Min nights"
                    />
                  </div>
                  <div>
                    <Label htmlFor="maxStay">Maximum</Label>
                    <Input
                      id="maxStay"
                      type="number"
                      min="1"
                      value={formData.conditions.lengthOfStay?.max || ''}
                      onChange={(e) => handleNestedInputChange('conditions', 'lengthOfStay', {
                        ...formData.conditions.lengthOfStay,
                        max: parseInt(e.target.value) || undefined
                      })}
                      placeholder="Max nights"
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="actions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Rule Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Preferred Floors */}
              <div>
                <Label>Preferred Floors</Label>
                <div className="flex gap-2 mt-2">
                  <Input
                    value={newFloor}
                    onChange={(e) => setNewFloor(e.target.value)}
                    placeholder="Floor number"
                    type="number"
                  />
                  <Button type="button" onClick={handleAddFloor} size="sm">
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2 mt-2">
                  {formData.actions.preferredFloors?.map((floor) => (
                    <Badge key={floor} variant="secondary" className="flex items-center gap-1">
                      Floor {floor}
                      <X
                        className="w-3 h-3 cursor-pointer"
                        onClick={() => handleRemoveFloor(floor)}
                      />
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Preferred Room Numbers */}
              <div>
                <Label>Preferred Room Numbers</Label>
                <div className="flex gap-2 mt-2">
                  <Input
                    value={newRoomNumber}
                    onChange={(e) => setNewRoomNumber(e.target.value)}
                    placeholder="Room number"
                  />
                  <Button type="button" onClick={() => handleAddRoom('preferred')} size="sm">
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2 mt-2">
                  {formData.actions.preferredRoomNumbers?.map((room) => (
                    <Badge key={room} variant="secondary" className="flex items-center gap-1">
                      {room}
                      <X
                        className="w-3 h-3 cursor-pointer"
                        onClick={() => handleRemoveRoom('preferred', room)}
                      />
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Upgrade Settings */}
              <div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="upgradeEligible"
                    checked={formData.actions.upgradeEligible || false}
                    onCheckedChange={(checked) => handleNestedInputChange('actions', 'upgradeEligible', checked)}
                  />
                  <Label htmlFor="upgradeEligible">Enable upgrades for this rule</Label>
                </div>
              </div>

              {/* Amenity Packages */}
              <div>
                <Label>Amenity Packages</Label>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  {assignmentRulesService.getAmenityPackages().map((amenity) => (
                    <div key={amenity} className="flex items-center space-x-2">
                      <Checkbox
                        id={`amenity-${amenity}`}
                        checked={formData.actions.amenityPackages?.includes(amenity) || false}
                        onCheckedChange={() => handleArrayToggle('actions', 'amenityPackages', amenity)}
                      />
                      <Label htmlFor={`amenity-${amenity}`} className="capitalize">
                        {amenity.replace('_', ' ')}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="restrictions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Rule Restrictions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="maxUpgrades">Maximum Upgrades</Label>
                <Input
                  id="maxUpgrades"
                  type="number"
                  min="0"
                  value={formData.restrictions?.maxUpgrades || 0}
                  onChange={(e) => handleNestedInputChange('restrictions', 'maxUpgrades', parseInt(e.target.value) || 0)}
                />
              </div>

              <div>
                <Label htmlFor="minimumRevenue">Minimum Revenue</Label>
                <Input
                  id="minimumRevenue"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.restrictions?.minimumRevenue || 0}
                  onChange={(e) => handleNestedInputChange('restrictions', 'minimumRevenue', parseFloat(e.target.value) || 0)}
                  placeholder="0.00"
                />
              </div>

              <div>
                <Label htmlFor="requiredApproval">Required Approval Level</Label>
                <Select
                  value={formData.restrictions?.requiredApproval || 'none'}
                  onValueChange={(value) => handleNestedInputChange('restrictions', 'requiredApproval', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    <SelectItem value="supervisor">Supervisor</SelectItem>
                    <SelectItem value="manager">Manager</SelectItem>
                    <SelectItem value="gm">General Manager</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="flex justify-end space-x-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={loading}>
          {loading ? 'Saving...' : assignmentRule ? 'Update Rule' : 'Create Rule'}
        </Button>
      </div>
    </form>
  );
};

export default AssignmentRuleForm;