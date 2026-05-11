import React, { useState, useEffect } from 'react';
import {
  CheckCircle,
  XCircle,
  AlertTriangle,
  Camera,
  Plus,
  Minus,
  Save,
  RefreshCw,
  ClipboardCheck,
  Package,
  Wrench,
  Clock
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LoadingSpinner } from '../LoadingSpinner';
import { formatCurrency } from '../../utils/formatters';
import { roomInventoryService, RoomInventory, InventoryItem } from '../../services/roomInventoryService';
import { withErrorBoundary } from '../ErrorBoundary';

interface HousekeepingInspectionFormProps {
  roomId: string;
  inspectionType: 'daily_cleaning' | 'checkout_inspection' | 'maintenance' | 'setup';
  onComplete?: (inspection: Record<string, unknown>) => void;
  onCancel?: () => void;
}

interface ItemInspection {
  itemId: string;
  itemName: string;
  category: string;
  expectedQuantity: number;
  actualQuantity: number;
  condition: 'excellent' | 'good' | 'fair' | 'worn' | 'damaged' | 'missing';
  needsReplacement: boolean;
  location: string;
  notes: string;
  photos: string[];
}

interface InspectionFinding {
  itemId: string;
  issue: string;
  severity: 'minor' | 'moderate' | 'major' | 'critical';
  action: 'none' | 'cleaned' | 'replaced' | 'repaired' | 'reported';
  cost: number;
  chargedToGuest: boolean;
}

function HousekeepingInspectionForm({
  roomId,
  inspectionType,
  onComplete,
  onCancel
}: HousekeepingInspectionFormProps) {
  const [roomInventory, setRoomInventory] = useState<RoomInventory | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [itemInspections, setItemInspections] = useState<ItemInspection[]>([]);
  const [findings, setFindings] = useState<InspectionFinding[]>([]);
  const [overallScore, setOverallScore] = useState(0);
  const [notes, setNotes] = useState('');
  const [timeSpent, setTimeSpent] = useState(0);
  const [startTime] = useState(Date.now());

  const steps = [
    'Room Overview',
    'Item Inspection',
    'Issues & Findings',
    'Summary & Submit'
  ];

  useEffect(() => {
    fetchRoomInventory();
    const timer = setInterval(() => {
      setTimeSpent(Math.floor((Date.now() - startTime) / 1000 / 60));
    }, 60000);
    return () => clearInterval(timer);
  }, [roomId]);

  const fetchRoomInventory = async () => {
    try {
      setLoading(true);
      const response = await roomInventoryService.getRoomInventory(roomId);
      const inventory = response.data.roomInventory;
      setRoomInventory(inventory);
      
      // Initialize item inspections
      const inspections = inventory.items.map(item => ({
        itemId: item.itemId._id,
        itemName: item.itemId.name,
        category: item.itemId.category,
        expectedQuantity: item.expectedQuantity,
        actualQuantity: item.currentQuantity,
        condition: item.condition,
        needsReplacement: item.needsReplacement,
        location: item.location || '',
        notes: item.notes || '',
        photos: []
      }));
      setItemInspections(inspections);
    } catch {
      // Error handled silently
    } finally {
      setLoading(false);
    }
  };

  const updateItemInspection = (itemId: string, updates: Partial<ItemInspection>) => {
    setItemInspections(prev => prev.map(item =>
      item.itemId === itemId ? { ...item, ...updates } : item
    ));
  };

  const addFinding = (itemId: string, issue: string, severity: InspectionFinding['severity']) => {
    const newFinding: InspectionFinding = {
      itemId,
      issue,
      severity,
      action: 'none',
      cost: 0,
      chargedToGuest: false
    };
    setFindings(prev => [...prev, newFinding]);
  };

  const updateFinding = (index: number, updates: Partial<InspectionFinding>) => {
    setFindings(prev => prev.map((finding, i) =>
      i === index ? { ...finding, ...updates } : finding
    ));
  };

  const removeFinding = (index: number) => {
    setFindings(prev => prev.filter((_, i) => i !== index));
  };

  const calculateOverallScore = () => {
    if (itemInspections.length === 0) return 0;
    
    let totalScore = 0;
    itemInspections.forEach(item => {
      switch (item.condition) {
        case 'excellent': totalScore += 100; break;
        case 'good': totalScore += 80; break;
        case 'fair': totalScore += 60; break;
        case 'worn': totalScore += 40; break;
        case 'damaged': totalScore += 20; break;
        case 'missing': totalScore += 0; break;
      }
    });
    
    // Deduct points for findings
    findings.forEach(finding => {
      switch (finding.severity) {
        case 'critical': totalScore -= 30; break;
        case 'major': totalScore -= 20; break;
        case 'moderate': totalScore -= 10; break;
        case 'minor': totalScore -= 5; break;
      }
    });
    
    const score = Math.max(0, Math.floor(totalScore / itemInspections.length));
    setOverallScore(score);
    return score;
  };

  const submitInspection = async () => {
    try {
      setSaving(true);
      
      const inspectionData = {
        inspectionType,
        findings: findings.map(f => ({
          itemId: f.itemId,
          issue: f.issue,
          severity: f.severity,
          action: f.action,
          cost: f.cost,
          chargedToGuest: f.chargedToGuest
        })),
        overallStatus: overallScore >= 80 ? 'passed' : overallScore >= 60 ? 'needs_attention' : 'failed',
        score: calculateOverallScore(),
        timeSpent,
        notes,
        itemUpdates: itemInspections.map(item => ({
          itemId: item.itemId,
          condition: item.condition,
          currentQuantity: item.actualQuantity,
          needsReplacement: item.needsReplacement,
          notes: item.notes
        }))
      };

      const response = await roomInventoryService.recordRoomInspection(roomId, inspectionData);
      onComplete?.(response.data.roomInventory);
    } catch {
      // Error handled silently
    } finally {
      setSaving(false);
    }
  };

  const getConditionColor = (condition: string) => {
    switch (condition) {
      case 'excellent': return 'text-green-600 bg-green-50';
      case 'good': return 'text-blue-600 bg-blue-50';
      case 'fair': return 'text-yellow-600 bg-yellow-50';
      case 'worn': return 'text-orange-600 bg-orange-50';
      case 'damaged': return 'text-red-600 bg-red-50';
      case 'missing': return 'text-gray-600 bg-gray-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'text-red-600 bg-red-50 border-red-200';
      case 'major': return 'text-orange-600 bg-orange-50 border-orange-200';
      case 'moderate': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'minor': return 'text-blue-600 bg-blue-50 border-blue-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner />
      </div>
    );
  }

  if (!roomInventory) {
    return (
      <div className="text-center p-8">
        <AlertTriangle className="mx-auto h-12 w-12 text-yellow-500 mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Room Not Found</h3>
        <p className="text-gray-600">Unable to load room inventory data.</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Room {roomInventory.roomId.roomNumber} Inspection
            </h1>
            <p className="text-gray-600">
              {inspectionType.replace('_', ' ').toUpperCase()} - {roomInventory.roomId.type}
            </p>
          </div>
          <div className="text-right">
            <div className="flex items-center text-sm text-gray-500 mb-1">
              <Clock className="w-4 h-4 mr-1" />
              Time spent: {timeSpent}m
            </div>
            <Badge variant="secondary" className="bg-blue-100 text-blue-800">
              Score: {overallScore}/100
            </Badge>
          </div>
        </div>
      </div>

      {/* Progress Steps */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          {steps.map((step, index) => (
            <div
              key={step}
              className={`flex items-center ${
                index < steps.length - 1 ? 'flex-1' : ''
              }`}
            >
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  index <= currentStep
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-600'
                }`}
              >
                {index < currentStep ? (
                  <CheckCircle className="w-5 h-5" />
                ) : (
                  index + 1
                )}
              </div>
              <span className={`ml-2 text-sm ${
                index <= currentStep ? 'text-gray-900 font-medium' : 'text-gray-500'
              }`}>
                {step}
              </span>
              {index < steps.length - 1 && (
                <div className={`flex-1 h-0.5 mx-4 ${
                  index < currentStep ? 'bg-blue-600' : 'bg-gray-200'
                }`} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Step Content */}
      <Card className="p-6 mb-6">
        {/* Step 0: Room Overview */}
        {currentStep === 0 && (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold text-gray-900">Room Overview</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="flex items-center mb-2">
                  <Package className="w-5 h-5 text-blue-600 mr-2" />
                  <span className="font-medium">Total Items</span>
                </div>
                <p className="text-2xl font-bold text-gray-900">{roomInventory.items.length}</p>
              </div>
              
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="flex items-center mb-2">
                  <ClipboardCheck className="w-5 h-5 text-green-600 mr-2" />
                  <span className="font-medium">Last Inspection</span>
                </div>
                <p className="text-sm text-gray-600">
                  {roomInventory.lastInspectionDate
                    ? new Date(roomInventory.lastInspectionDate).toLocaleDateString()
                    : 'Never'
                  }
                </p>
              </div>
              
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="flex items-center mb-2">
                  <Wrench className="w-5 h-5 text-yellow-600 mr-2" />
                  <span className="font-medium">Status</span>
                </div>
                <Badge variant="secondary" className={
                  roomInventory.status === 'clean' ? 'bg-green-100 text-green-800' :
                  roomInventory.status === 'dirty' ? 'bg-yellow-100 text-yellow-800' :
                  'bg-red-100 text-red-800'
                }>
                  {roomInventory.status}
                </Badge>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Inspection Notes
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Add any general notes about the room condition..."
              />
            </div>
          </div>
        )}

        {/* Step 1: Item Inspection */}
        {currentStep === 1 && (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold text-gray-900">Item Inspection</h2>
            
            <div className="space-y-4">
              {itemInspections.map((item, index) => (
                <Card key={item.itemId} className="p-4 border-l-4 border-l-blue-500">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900">{item.itemName}</h3>
                      <p className="text-sm text-gray-600">{item.category}</p>
                    </div>
                    <Badge variant="secondary" className={getConditionColor(item.condition)}>
                      {item.condition}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Quantity
                      </label>
                      <div className="flex items-center space-x-2">
                        <Button
                          onClick={() => updateItemInspection(item.itemId, {
                            actualQuantity: Math.max(0, item.actualQuantity - 1)
                          })}
                          size="sm"
                          variant="secondary"
                        >
                          <Minus className="w-4 h-4" />
                        </Button>
                        <span className="px-3 py-1 bg-gray-100 rounded text-center min-w-[60px]">
                          {item.actualQuantity} / {item.expectedQuantity}
                        </span>
                        <Button
                          onClick={() => updateItemInspection(item.itemId, {
                            actualQuantity: item.actualQuantity + 1
                          })}
                          size="sm"
                          variant="secondary"
                        >
                          <Plus className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Condition
                      </label>
                      <select
                        value={item.condition}
                        onChange={(e) => updateItemInspection(item.itemId, {
                          condition: e.target.value as ItemInspection['condition']
                        })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="excellent">Excellent</option>
                        <option value="good">Good</option>
                        <option value="fair">Fair</option>
                        <option value="worn">Worn</option>
                        <option value="damaged">Damaged</option>
                        <option value="missing">Missing</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Location
                      </label>
                      <input
                        type="text"
                        value={item.location}
                        onChange={(e) => updateItemInspection(item.itemId, {
                          location: e.target.value
                        })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="e.g., Bathroom, Closet"
                      />
                    </div>
                  </div>

                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Notes
                    </label>
                    <textarea
                      value={item.notes}
                      onChange={(e) => updateItemInspection(item.itemId, {
                        notes: e.target.value
                      })}
                      rows={2}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Add specific notes about this item..."
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={item.needsReplacement}
                        onChange={(e) => updateItemInspection(item.itemId, {
                          needsReplacement: e.target.checked
                        })}
                        className="mr-2"
                      />
                      <span className="text-sm text-gray-700">Needs replacement</span>
                    </label>

                    {(item.condition === 'damaged' || item.condition === 'missing' || item.actualQuantity !== item.expectedQuantity) && (
                      <Button
                        onClick={() => addFinding(item.itemId, `${item.itemName} issue`, 'moderate')}
                        size="sm"
                        variant="secondary"
                      >
                        <AlertTriangle className="w-4 h-4 mr-1" />
                        Add Issue
                      </Button>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Step 2: Issues & Findings */}
        {currentStep === 2 && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900">Issues & Findings</h2>
              <Button
                onClick={() => addFinding('', 'New issue', 'minor')}
                size="sm"
              >
                <Plus className="w-4 h-4 mr-1" />
                Add Finding
              </Button>
            </div>

            {findings.length === 0 ? (
              <div className="text-center py-8">
                <CheckCircle className="mx-auto h-12 w-12 text-green-500 mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No Issues Found</h3>
                <p className="text-gray-600">Great! The room is in excellent condition.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {findings.map((finding, index) => (
                  <Card key={`findings-${index}`} className="p-4">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Issue Description
                          </label>
                          <textarea
                            value={finding.issue}
                            onChange={(e) => updateFinding(index, { issue: e.target.value })}
                            rows={2}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            placeholder="Describe the issue..."
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Severity
                          </label>
                          <select
                            value={finding.severity}
                            onChange={(e) => updateFinding(index, {
                              severity: e.target.value as InspectionFinding['severity']
                            })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          >
                            <option value="minor">Minor</option>
                            <option value="moderate">Moderate</option>
                            <option value="major">Major</option>
                            <option value="critical">Critical</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Action Taken
                          </label>
                          <select
                            value={finding.action}
                            onChange={(e) => updateFinding(index, {
                              action: e.target.value as InspectionFinding['action']
                            })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          >
                            <option value="none">No action</option>
                            <option value="cleaned">Cleaned</option>
                            <option value="replaced">Replaced</option>
                            <option value="repaired">Repaired</option>
                            <option value="reported">Reported to maintenance</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Estimated Cost ($)
                          </label>
                          <input
                            type="number"
                            value={finding.cost}
                            onChange={(e) => updateFinding(index, {
                              cost: parseFloat(e.target.value) || 0
                            })}
                            step="0.01"
                            min="0"
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            placeholder="0.00"
                          />
                        </div>
                      </div>

                      <Button
                        onClick={() => removeFinding(index)}
                        size="sm"
                        variant="secondary"
                        className="ml-4 text-red-600 hover:bg-red-50"
                      >
                        <XCircle className="w-4 h-4" />
                      </Button>
                    </div>

                    <div className="flex items-center justify-between">
                      <Badge variant="secondary" className={getSeverityColor(finding.severity)}>
                        {finding.severity}
                      </Badge>
                      
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={finding.chargedToGuest}
                          onChange={(e) => updateFinding(index, {
                            chargedToGuest: e.target.checked
                          })}
                          className="mr-2"
                        />
                        <span className="text-sm text-gray-700">Charge to guest</span>
                      </label>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Step 3: Summary & Submit */}
        {currentStep === 3 && (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold text-gray-900">Inspection Summary</h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="p-4 text-center">
                <div className="text-3xl font-bold text-gray-900 mb-2">{calculateOverallScore()}</div>
                <div className="text-sm text-gray-600">Overall Score</div>
                <div className={`text-xs mt-1 ${
                  overallScore >= 80 ? 'text-green-600' :
                  overallScore >= 60 ? 'text-yellow-600' : 'text-red-600'
                }`}>
                  {overallScore >= 80 ? 'Excellent' :
                   overallScore >= 60 ? 'Needs Attention' : 'Failed'}
                </div>
              </Card>

              <Card className="p-4 text-center">
                <div className="text-3xl font-bold text-gray-900 mb-2">{findings.length}</div>
                <div className="text-sm text-gray-600">Issues Found</div>
                <div className="text-xs text-orange-600 mt-1">
                  {findings.filter(f => f.severity === 'critical').length} Critical
                </div>
              </Card>

              <Card className="p-4 text-center">
                <div className="text-3xl font-bold text-gray-900 mb-2">{timeSpent}m</div>
                <div className="text-sm text-gray-600">Time Spent</div>
                <div className="text-xs text-blue-600 mt-1">
                  {itemInspections.filter(i => i.needsReplacement).length} Need Replacement
                </div>
              </Card>
            </div>

            <div>
              <h3 className="font-semibold text-gray-900 mb-3">Items Needing Attention</h3>
              {itemInspections.filter(item => 
                item.condition === 'damaged' || 
                item.condition === 'missing' || 
                item.needsReplacement ||
                item.actualQuantity !== item.expectedQuantity
              ).length === 0 ? (
                <p className="text-gray-500 text-center py-4">No items need attention</p>
              ) : (
                <div className="space-y-2">
                  {itemInspections
                    .filter(item => 
                      item.condition === 'damaged' || 
                      item.condition === 'missing' || 
                      item.needsReplacement ||
                      item.actualQuantity !== item.expectedQuantity
                    )
                    .map(item => (
                      <div key={item.itemId} className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg">
                        <div>
                          <span className="font-medium">{item.itemName}</span>
                          <span className="text-gray-600 ml-2">({item.condition})</span>
                        </div>
                        <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
                          {item.needsReplacement ? 'Needs Replacement' : 'Attention Required'}
                        </Badge>
                      </div>
                    ))
                  }
                </div>
              )}
            </div>

            {findings.length > 0 && (
              <div>
                <h3 className="font-semibold text-gray-900 mb-3">Issues Summary</h3>
                <div className="space-y-2">
                  {findings.map((finding, index) => (
                    <div key={`findings-${index}`} className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                      <div className="flex-1">
                        <span className="font-medium">{finding.issue}</span>
                        {finding.cost > 0 && (
                          <span className="text-gray-600 ml-2">{formatCurrency(finding.cost)}</span>
                        )}
                      </div>
                      <div className="flex items-center space-x-2">
                        <Badge variant="secondary" className={getSeverityColor(finding.severity)}>
                          {finding.severity}
                        </Badge>
                        {finding.chargedToGuest && (
                          <Badge variant="secondary" className="bg-red-100 text-red-800">
                            Guest Charge
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <div className="flex space-x-3">
          {onCancel && (
            <Button onClick={onCancel} variant="secondary">
              Cancel
            </Button>
          )}
          {currentStep > 0 && (
            <Button
              onClick={() => setCurrentStep(prev => prev - 1)}
              variant="secondary"
            >
              Previous
            </Button>
          )}
        </div>

        <div className="flex space-x-3">
          {currentStep < steps.length - 1 ? (
            <Button
              onClick={() => {
                calculateOverallScore();
                setCurrentStep(prev => prev + 1);
              }}
            >
              Next Step
            </Button>
          ) : (
            <Button
              onClick={submitInspection}
              disabled={saving}
              className="bg-green-600 hover:bg-green-700"
            >
              {saving ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Complete Inspection
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export { HousekeepingInspectionForm };
export default withErrorBoundary(HousekeepingInspectionForm, { level: 'component' });