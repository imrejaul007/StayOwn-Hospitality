import React, { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/button';
import { CheckCircle, Square, CheckSquare } from 'lucide-react';
import { cn } from '../../utils/cn';

interface TaskStep {
  id: string;
  label: string;
  description?: string;
  required: boolean;
  completed: boolean;
}

interface TaskCompletionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: (completedSteps: string[]) => void;
  title: string;
  taskName: string;
  steps: TaskStep[];
  loading?: boolean;
}

export function TaskCompletionModal({
  isOpen,
  onClose,
  onComplete,
  title,
  taskName,
  steps,
  loading = false
}: TaskCompletionModalProps) {
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set());
  const [localSteps, setLocalSteps] = useState<TaskStep[]>([]);

  useEffect(() => {
    if (isOpen && steps) {
      setLocalSteps(steps);
      const alreadyCompleted = steps.filter(step => step.completed).map(step => step.id);
      setCompletedSteps(new Set(alreadyCompleted));
    }
  }, [isOpen, steps]);

  const toggleStep = (stepId: string) => {
    const newCompletedSteps = new Set(completedSteps);
    if (newCompletedSteps.has(stepId)) {
      newCompletedSteps.delete(stepId);
    } else {
      newCompletedSteps.add(stepId);
    }
    setCompletedSteps(newCompletedSteps);
  };

  const requiredSteps = localSteps.filter(step => step.required);
  const requiredCompleted = requiredSteps.filter(step => completedSteps.has(step.id));
  const canComplete = requiredCompleted.length === requiredSteps.length;
  const allStepsCompleted = localSteps.every(step => completedSteps.has(step.id));

  const handleComplete = () => {
    onComplete(Array.from(completedSteps));
  };

  const handleReset = () => {
    setCompletedSteps(new Set());
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="lg">
      <div className="space-y-6">
        {/* Task Header */}
        <div className="relative group">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-2xl blur opacity-75 group-hover:opacity-100 transition duration-200"></div>
          <div className="relative bg-white/90 backdrop-blur-sm p-6 rounded-2xl border border-white/20 shadow-xl">
            <h3 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent mb-3">
              {taskName}
            </h3>
            <p className="text-gray-600 font-medium">
              Complete the checklist below to mark this task as finished
            </p>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-r from-gray-100 to-gray-200 rounded-2xl blur opacity-50"></div>
          <div className="relative bg-white/90 backdrop-blur-sm p-4 rounded-2xl border border-white/20 shadow-lg space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-gray-700 font-medium">
                Progress: {completedSteps.size} of {localSteps.length} completed
              </span>
              <span className={cn(
                "font-bold px-3 py-1 rounded-lg",
                canComplete
                  ? "bg-gradient-to-r from-green-500 to-emerald-500 text-white"
                  : "bg-gradient-to-r from-orange-500 to-yellow-500 text-white"
              )}>
                {canComplete ? "Ready to complete" : `${requiredCompleted.length}/${requiredSteps.length} required`}
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3 shadow-inner">
              <div
                className={cn(
                  "h-3 rounded-full transition-all duration-500 shadow-lg",
                  allStepsCompleted
                    ? "bg-gradient-to-r from-green-500 to-emerald-500"
                    : canComplete
                    ? "bg-gradient-to-r from-blue-500 to-indigo-500"
                    : "bg-gradient-to-r from-orange-500 to-yellow-500"
                )}
                style={{
                  width: `${(completedSteps.size / localSteps.length) * 100}%`
                }}
              />
            </div>
          </div>
        </div>

        {/* Steps Checklist */}
        <div className="space-y-3 max-h-80 overflow-y-auto pr-2 scrollbar-thin scrollbar-track-gray-100 scrollbar-thumb-gray-300">
          {localSteps.map((step) => {
            const isCompleted = completedSteps.has(step.id);
            return (
              <div role="button" tabIndex={0}
                key={step.id}
                className="group/step relative"
                onClick={() => toggleStep(step.id)}
               onKeyDown={(e: React.KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleStep(step.id); } }}>
                <div className={cn(
                  "absolute inset-0 rounded-2xl blur opacity-50 transition duration-200",
                  isCompleted
                    ? "bg-gradient-to-r from-green-200 to-emerald-200 group-hover/step:opacity-100"
                    : "bg-gradient-to-r from-gray-100 to-gray-200 group-hover/step:opacity-100"
                )}></div>
                <div
                  className={cn(
                    "relative flex items-start space-x-4 p-4 rounded-2xl border cursor-pointer transition-all duration-300 transform hover:scale-102 shadow-lg hover:shadow-xl",
                    isCompleted
                      ? "bg-white/90 backdrop-blur-sm border-green-300"
                      : "bg-white/90 backdrop-blur-sm border-gray-200 hover:border-blue-300"
                  )}
                >
                  <div className="flex-shrink-0 mt-1">
                    <div className={cn(
                      "relative group p-1 rounded-full transition-all duration-200",
                      isCompleted
                        ? "bg-gradient-to-r from-green-500 to-emerald-500"
                        : "bg-gray-200 hover:bg-blue-200"
                    )}>
                      {isCompleted ? (
                        <CheckSquare className="h-5 w-5 text-white" />
                      ) : (
                        <Square className="h-5 w-5 text-gray-500" />
                      )}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-3 mb-2">
                      <p className={cn(
                        "font-semibold text-lg",
                        isCompleted ? "line-through text-green-700" : "text-gray-900"
                      )}>
                        {step.label}
                      </p>
                      {step.required && (
                        <span className="inline-flex items-center px-3 py-1 rounded-xl text-xs font-bold bg-gradient-to-r from-red-500 to-pink-500 text-white shadow-lg">
                          Required
                        </span>
                      )}
                    </div>
                    {step.description && (
                      <p className={cn(
                        "text-sm font-medium",
                        isCompleted ? "text-green-600" : "text-gray-600"
                      )}>
                        {step.description}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Action Buttons */}
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-r from-gray-100 to-gray-200 rounded-2xl blur opacity-50"></div>
          <div className="relative bg-white/90 backdrop-blur-sm p-4 rounded-2xl border border-white/20 shadow-lg">
            <div className="flex items-center justify-between">
              <div className="flex space-x-3">
                <Button
                  size="sm"
                  onClick={handleReset}
                  disabled={loading || completedSteps.size === 0}
                  className="bg-gradient-to-r from-gray-500 to-gray-600 hover:from-gray-600 hover:to-gray-700 text-white shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105 rounded-xl"
                >
                  Reset All
                </Button>
              </div>

              <div className="flex space-x-3">
                <Button
                  onClick={onClose}
                  disabled={loading}
                  className="bg-gradient-to-r from-gray-400 to-gray-500 hover:from-gray-500 hover:to-gray-600 text-white shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105 rounded-xl"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleComplete}
                  disabled={!canComplete || loading}
                  className={cn(
                    "flex items-center space-x-2 shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105 rounded-xl",
                    allStepsCompleted
                      ? "bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
                      : canComplete
                      ? "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
                      : "bg-gradient-to-r from-gray-400 to-gray-500"
                  )}
                >
                  <CheckCircle className="h-4 w-4" />
                  <span>{loading ? "Completing..." : "Complete Task"}</span>
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Completion Status */}
        {!canComplete && requiredSteps.length > 0 && (
          <div className="relative group">
            <div className="absolute inset-0 bg-gradient-to-r from-orange-500 to-yellow-500 rounded-2xl blur opacity-75 group-hover:opacity-100 transition duration-200"></div>
            <div className="relative bg-white/90 backdrop-blur-sm p-4 rounded-2xl border border-white/20 shadow-lg">
              <p className="text-sm font-medium text-orange-800">
                <strong className="text-orange-900">Note:</strong> Please complete all required steps before marking this task as finished.
              </p>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

// Helper function to generate default steps for different task types
export const getDefaultSteps = (taskType: 'housekeeping' | 'maintenance' | 'guest_service', specificType?: string) => {
  switch (taskType) {
    case 'housekeeping':
      return getHousekeepingSteps(specificType);
    case 'maintenance':
      return getMaintenanceSteps(specificType);
    case 'guest_service':
      return getGuestServiceSteps(specificType);
    default:
      return [];
  }
};

// Helper function to generate steps based on actual service variations
export const getServiceVariationSteps = (serviceVariations: string[], completedServiceVariations?: string[]) => {
  const steps: TaskStep[] = [];
  
  // Base steps
  steps.push({
    id: 'understand_request',
    label: 'Understand Request',
    description: 'Clearly understand what the guest is requesting',
    required: true,
    completed: false
  });

  // Add each service variation as a step
  serviceVariations.forEach((variation, index) => {
    steps.push({
      id: `service_${index}`,
      label: variation,
      description: `Complete: ${variation}`,
      required: true,
      completed: completedServiceVariations?.includes(variation) || false
    });
  });

  // Final steps
  steps.push({
    id: 'follow_up',
    label: 'Follow Up',
    description: 'Check with guest to ensure satisfaction',
    required: true,
    completed: false
  });

  return steps;
};

const getHousekeepingSteps = (type?: string): TaskStep[] => {
  const baseSteps: TaskStep[] = [
    {
      id: 'safety_check',
      label: 'Safety Check',
      description: 'Ensure room is safe to enter and work in',
      required: true,
      completed: false
    },
    {
      id: 'supplies_ready',
      label: 'Supplies Ready',
      description: 'Gather all necessary cleaning supplies and equipment',
      required: true,
      completed: false
    }
  ];

  if (type === 'cleaning' || type === 'checkout_clean') {
    return [
      ...baseSteps,
      {
        id: 'bed_linens',
        label: 'Change Bed Linens',
        description: 'Remove used linens and replace with fresh ones',
        required: true,
        completed: false
      },
      {
        id: 'bathroom_clean',
        label: 'Clean Bathroom',
        description: 'Clean toilet, shower, sink, and mirror',
        required: true,
        completed: false
      },
      {
        id: 'vacuum_floors',
        label: 'Vacuum/Clean Floors',
        description: 'Vacuum carpets or mop hard floors',
        required: true,
        completed: false
      },
      {
        id: 'dust_surfaces',
        label: 'Dust Surfaces',
        description: 'Dust all furniture, lamps, and surfaces',
        required: true,
        completed: false
      },
      {
        id: 'amenities_restock',
        label: 'Restock Amenities',
        description: 'Replace toiletries, towels, and other amenities',
        required: true,
        completed: false
      },
      {
        id: 'final_inspection',
        label: 'Final Inspection',
        description: 'Check room thoroughly for cleanliness and completeness',
        required: true,
        completed: false
      }
    ];
  }

  if (type === 'deep_clean') {
    return [
      ...baseSteps,
      {
        id: 'move_furniture',
        label: 'Move Furniture',
        description: 'Move furniture to clean underneath',
        required: false,
        completed: false
      },
      {
        id: 'deep_bathroom',
        label: 'Deep Clean Bathroom',
        description: 'Scrub tiles, grout, and deep clean all fixtures',
        required: true,
        completed: false
      },
      {
        id: 'carpet_shampoo',
        label: 'Carpet Shampooing',
        description: 'Shampoo carpets and upholstery if needed',
        required: false,
        completed: false
      },
      {
        id: 'window_cleaning',
        label: 'Clean Windows',
        description: 'Clean all windows inside and outside if accessible',
        required: true,
        completed: false
      }
    ];
  }

  return baseSteps;
};

const getMaintenanceSteps = (type?: string): TaskStep[] => {
  const baseSteps: TaskStep[] = [
    {
      id: 'safety_assessment',
      label: 'Safety Assessment',
      description: 'Assess work area for safety hazards',
      required: true,
      completed: false
    },
    {
      id: 'tools_equipment',
      label: 'Gather Tools & Equipment',
      description: 'Collect all necessary tools and equipment',
      required: true,
      completed: false
    }
  ];

  if (type === 'plumbing') {
    return [
      ...baseSteps,
      {
        id: 'water_shutoff',
        label: 'Turn Off Water',
        description: 'Shut off water supply if necessary',
        required: true,
        completed: false
      },
      {
        id: 'repair_work',
        label: 'Complete Repair Work',
        description: 'Perform the necessary plumbing repairs',
        required: true,
        completed: false
      },
      {
        id: 'test_functionality',
        label: 'Test Functionality',
        description: 'Test the repair to ensure it works properly',
        required: true,
        completed: false
      },
      {
        id: 'cleanup',
        label: 'Clean Up Area',
        description: 'Clean work area and dispose of debris',
        required: true,
        completed: false
      }
    ];
  }

  if (type === 'electrical') {
    return [
      ...baseSteps,
      {
        id: 'power_shutoff',
        label: 'Turn Off Power',
        description: 'Shut off electrical power at circuit breaker',
        required: true,
        completed: false
      },
      {
        id: 'electrical_work',
        label: 'Complete Electrical Work',
        description: 'Perform the necessary electrical repairs',
        required: true,
        completed: false
      },
      {
        id: 'test_electrical',
        label: 'Test Electrical Systems',
        description: 'Test to ensure electrical work is functioning safely',
        required: true,
        completed: false
      }
    ];
  }

  return [
    ...baseSteps,
    {
      id: 'complete_work',
      label: 'Complete Work',
      description: 'Finish the maintenance task',
      required: true,
      completed: false
    },
    {
      id: 'test_result',
      label: 'Test Result',
      description: 'Verify the work was completed successfully',
      required: true,
      completed: false
    }
  ];
};

const getGuestServiceSteps = (type?: string): TaskStep[] => {
  const baseSteps: TaskStep[] = [
    {
      id: 'understand_request',
      label: 'Understand Request',
      description: 'Clearly understand what the guest is requesting',
      required: true,
      completed: false
    },
    {
      id: 'gather_resources',
      label: 'Gather Resources',
      description: 'Collect everything needed to fulfill the request',
      required: true,
      completed: false
    }
  ];

  if (type === 'room_service') {
    return [
      ...baseSteps,
      {
        id: 'prepare_order',
        label: 'Prepare Order',
        description: 'Prepare or coordinate the room service order',
        required: true,
        completed: false
      },
      {
        id: 'deliver_service',
        label: 'Deliver Service',
        description: 'Deliver the service to the guest room',
        required: true,
        completed: false
      },
      {
        id: 'guest_satisfaction',
        label: 'Confirm Guest Satisfaction',
        description: 'Ensure the guest is satisfied with the service',
        required: true,
        completed: false
      }
    ];
  }

  return [
    ...baseSteps,
    {
      id: 'fulfill_request',
      label: 'Fulfill Request',
      description: 'Complete the guest service request',
      required: true,
      completed: false
    },
    {
      id: 'follow_up',
      label: 'Follow Up',
      description: 'Check with guest to ensure satisfaction',
      required: true,
      completed: false
    }
  ];
};