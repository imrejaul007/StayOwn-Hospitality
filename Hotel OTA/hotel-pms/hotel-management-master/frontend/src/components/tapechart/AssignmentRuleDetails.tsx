import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AssignmentRule } from '@/services/assignmentRulesService';

interface AssignmentRuleDetailsProps {
  assignmentRule: AssignmentRule;
  onUpdate: (rule: AssignmentRule) => void;
  onClose: () => void;
}

const AssignmentRuleDetails: React.FC<AssignmentRuleDetailsProps> = ({
  assignmentRule,
  onUpdate,
  onClose
}) => {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">{assignmentRule.ruleName}</h2>
        <Button onClick={onClose} variant="outline">Close</Button>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle>Rule Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-600">Priority</label>
              <p className="text-lg">{assignmentRule.priority}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-600">Status</label>
              <p className="text-lg">
                <Badge variant={assignmentRule.isActive ? "default" : "secondary"}>
                  {assignmentRule.isActive ? "Active" : "Inactive"}
                </Badge>
              </p>
            </div>
          </div>
          
          {assignmentRule.conditions && (
            <div className="mt-4">
              <h4 className="font-medium mb-2">Conditions</h4>
              <div className="text-sm text-gray-600">
                {assignmentRule.conditions.guestType && (
                  <p>Guest Types: {assignmentRule.conditions.guestType.join(', ')}</p>
                )}
                {assignmentRule.conditions.roomTypes && (
                  <p>Room Types: {assignmentRule.conditions.roomTypes.join(', ')}</p>
                )}
              </div>
            </div>
          )}
          
          {assignmentRule.actions && (
            <div className="mt-4">
              <h4 className="font-medium mb-2">Actions</h4>
              <div className="text-sm text-gray-600">
                <p>Upgrade Eligible: {assignmentRule.actions.upgradeEligible ? 'Yes' : 'No'}</p>
                {assignmentRule.actions.preferredFloors && (
                  <p>Preferred Floors: {assignmentRule.actions.preferredFloors.join(', ')}</p>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AssignmentRuleDetails;