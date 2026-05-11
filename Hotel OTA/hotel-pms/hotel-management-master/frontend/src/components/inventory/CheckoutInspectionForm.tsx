import React, { useState, useEffect } from 'react';
import { 
  CheckCircle, 
  XCircle, 
  Camera, 
  AlertTriangle,
  IndianRupee,
  Clock,
  FileText
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LoadingSpinner } from '../LoadingSpinner';
import { roomInventoryService, CheckoutInspection } from '../../services/roomInventoryService';
import { formatCurrency } from '../../utils/formatters';
import { withErrorBoundary } from '../ErrorBoundary';

interface CheckoutInspectionFormProps {
  bookingId: string;
  roomId: string;
  guestId?: string;
  onComplete?: (inspection: CheckoutInspection) => void;
  onCancel?: () => void;
}

function CheckoutInspectionForm({ 
  bookingId, 
  roomId, 
  guestId,
  onComplete,
  onCancel 
}: CheckoutInspectionFormProps) {
  const [inspection, setInspection] = useState<CheckoutInspection | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [totalCharges, setTotalCharges] = useState(0);

  const steps = [
    'Electronics Check',
    'Plumbing & Fixtures',
    'Furniture & Amenities',
    'Inventory Verification',
    'Final Review'
  ];

  useEffect(() => {
    loadOrCreateInspection();
  }, [bookingId]);

  const loadOrCreateInspection = async () => {
    try {
      setLoading(true);
      
      // Try to load existing inspection
      let inspectionData: CheckoutInspection;
      try {
        const response = await roomInventoryService.getCheckoutInspection(bookingId);
        inspectionData = response.data.inspection;
      } catch (error) {
        // Create new inspection if not found
        const response = await roomInventoryService.createCheckoutInspection({
          roomId,
          bookingId,
          guestId
        });
        inspectionData = response.data.inspection;
      }

      setInspection(inspectionData);
      setTotalCharges(inspectionData.totalCharges);
    } catch {
      // Error handled silently
    } finally {
      setLoading(false);
    }
  };

  const updateChecklistItem = (itemIndex: number, updates: Record<string, unknown>) => {
    if (!inspection) return;

    const updatedInspection = {
      ...inspection,
      checklistItems: inspection.checklistItems.map((item, index) =>
        index === itemIndex ? { ...item, ...updates } : item
      )
    };

    setInspection(updatedInspection);
  };

  const updateInventoryItem = (itemIndex: number, updates: Record<string, unknown>) => {
    if (!inspection) return;

    const updatedInspection = {
      ...inspection,
      inventoryVerification: inspection.inventoryVerification.map((item, index) =>
        index === itemIndex ? { ...item, ...updates } : item
      )
    };

    setInspection(updatedInspection);
    
    // Recalculate charges
    const newCharges = updatedInspection.inventoryVerification
      .filter(item => item.chargeGuest)
      .reduce((sum, item) => sum + (item.chargeAmount || 0), 0);
    
    setTotalCharges(newCharges);
  };

  const addDamage = () => {
    if (!inspection) return;

    const newDamage = {
      type: 'inventory_damage' as const,
      description: '',
      severity: 'minor' as const,
      quantity: 1,
      estimatedCost: 0,
      chargeGuest: false,
      reportedToMaintenance: false
    };

    setInspection({
      ...inspection,
      damagesFound: [...inspection.damagesFound, newDamage]
    });
  };

  const updateDamage = (damageIndex: number, updates: Record<string, unknown>) => {
    if (!inspection) return;

    const updatedInspection = {
      ...inspection,
      damagesFound: inspection.damagesFound.map((damage, index) =>
        index === damageIndex ? { ...damage, ...updates } : damage
      )
    };

    setInspection(updatedInspection);

    // Recalculate total charges
    const damageCharges = updatedInspection.damagesFound
      .filter(damage => damage.chargeGuest)
      .reduce((sum, damage) => sum + (damage.chargeAmount || 0), 0);
    
    const inventoryCharges = updatedInspection.inventoryVerification
      .filter(item => item.chargeGuest)
      .reduce((sum, item) => sum + (item.chargeAmount || 0), 0);

    setTotalCharges(damageCharges + inventoryCharges);
  };

  const saveInspection = async (status: string = 'in_progress') => {
    if (!inspection) return;

    try {
      setSaving(true);
      
      const updateData = {
        ...inspection,
        inspectionStatus: status,
        totalCharges
      };

      const response = await roomInventoryService.updateCheckoutInspection(
        bookingId,
        updateData
      );

      setInspection(response.data.inspection);

      if (status === 'completed' && onComplete) {
        onComplete(response.data.inspection);
      }
    } catch {
      // Error handled silently
    } finally {
      setSaving(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'working':
      case 'satisfactory':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'not_working':
      case 'damaged':
      case 'missing':
        return <XCircle className="w-5 h-5 text-red-500" />;
      case 'dirty':
        return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
      default:
        return <Clock className="w-5 h-5 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'working':
      case 'satisfactory':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'not_working':
      case 'damaged':
      case 'missing':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'dirty':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'major':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'moderate':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'minor':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner />
      </div>
    );
  }

  if (!inspection) {
    return (
      <div className="text-center py-8">
        <AlertTriangle className="mx-auto h-12 w-12 text-red-500 mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">Unable to Load Inspection</h3>
        <p className="text-gray-600">There was an error loading the checkout inspection.</p>
        <Button onClick={loadOrCreateInspection} className="mt-4">
          Try Again
        </Button>
      </div>
    );
  }

  const currentStepItems = inspection.checklistItems.filter(item => {
    switch (currentStep) {
      case 0:
        return item.category === 'electronics';
      case 1:
        return item.category === 'plumbing';
      case 2:
        return ['furniture', 'amenities', 'cleanliness', 'safety'].includes(item.category);
      case 3:
        return false; // Inventory verification
      case 4:
        return false; // Final review
      default:
        return false;
    }
  });

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Checkout Inspection</h1>
          <p className="text-gray-600">
            Room {inspection.roomId.roomNumber} • Booking #{bookingId}
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Badge variant="secondary" className={getStatusColor(inspection.inspectionStatus)}>
            {inspection.inspectionStatus.replace('_', ' ')}
          </Badge>
          {inspection.checkoutBlocked && (
            <Badge variant="secondary" className="bg-red-100 text-red-800">
              Checkout Blocked
            </Badge>
          )}
        </div>
      </div>

      {/* Progress Steps */}
      <div className="flex items-center space-x-4 overflow-x-auto pb-2">
        {steps.map((step, index) => (
          <div role="button" tabIndex={0}
            key={`steps-${index}-${step}`}
            className={`flex items-center space-x-2 cursor-pointer ${
              index === currentStep ? 'text-blue-600' : 
              index < currentStep ? 'text-green-600' : 'text-gray-400'
            }`}
            onClick={() => setCurrentStep(index)}
           onKeyDown={(e: React.KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); const clickHandler = () => setCurrentStep(index); if (typeof clickHandler === 'function') { clickHandler(e as any); } } }}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
              index === currentStep ? 'bg-blue-100' : 
              index < currentStep ? 'bg-green-100' : 'bg-gray-100'
            }`}>
              {index < currentStep ? <CheckCircle className="w-5 h-5" /> : index + 1}
            </div>
            <span className="whitespace-nowrap text-sm font-medium">{step}</span>
            {index < steps.length - 1 && (
              <div className={`w-8 h-px ${
                index < currentStep ? 'bg-green-300' : 'bg-gray-300'
              }`} />
            )}
          </div>
        ))}
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Inspection Form */}
        <div className="lg:col-span-2 space-y-6">
          {currentStep < 3 && (
            <Card className="p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                {steps[currentStep]}
              </h2>
              
              <div className="space-y-4">
                {currentStepItems.map((item, index) => {
                  const itemIndex = inspection.checklistItems.findIndex(
                    checkItem => checkItem.item === item.item
                  );
                  
                  return (
                    <div key={`currentStepItems-${index}-${item.status}`} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <h3 className="font-medium text-gray-900">{item.item}</h3>
                          {item.description && (
                            <p className="text-sm text-gray-600 mt-1">{item.description}</p>
                          )}
                        </div>
                        {getStatusIcon(item.status)}
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
                        {['working', 'not_working', 'damaged', 'missing'].map((status) => (
                          <Button
                            key={status}
                            variant={item.status === status ? 'primary' : 'secondary'}
                            size="sm"
                            className="text-xs"
                            onClick={() => updateChecklistItem(itemIndex, { 
                              status,
                              checkedAt: new Date().toISOString()
                            })}
                          >
                            {status.replace('_', ' ')}
                          </Button>
                        ))}
                      </div>

                      {item.status !== 'working' && item.status !== 'satisfactory' && (
                        <div className="space-y-3 mt-4 pt-3 border-t">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Severity
                            </label>
                            <select
                              value={item.severity || 'minor'}
                              onChange={(e) => updateChecklistItem(itemIndex, { severity: e.target.value })}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                            >
                              <option value="minor">Minor</option>
                              <option value="moderate">Moderate</option>
                              <option value="major">Major</option>
                              <option value="critical">Critical</option>
                            </select>
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Estimated Cost (₹)
                            </label>
                            <input
                              type="number"
                              value={item.estimatedCost || 0}
                              onChange={(e) => updateChecklistItem(itemIndex, { 
                                estimatedCost: parseFloat(e.target.value) || 0 
                              })}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                              min="0"
                              step="1"
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Notes
                            </label>
                            <textarea
                              value={item.notes || ''}
                              onChange={(e) => updateChecklistItem(itemIndex, { notes: e.target.value })}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                              rows={2}
                              placeholder="Describe the issue..."
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </Card>
          )}

          {currentStep === 3 && (
            <Card className="p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Inventory Verification
              </h2>
              
              <div className="space-y-4">
                {inspection.inventoryVerification.map((item, index) => (
                  <div key={`inspection-inventoryVerification-${index}-${item.category}`} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h3 className="font-medium text-gray-900">{item.itemName}</h3>
                        <p className="text-sm text-gray-600">{item.category}</p>
                      </div>
                      <Badge 
                        variant="secondary" 
                        className={item.verified ? getStatusColor('working') : getStatusColor('damaged')}
                      >
                        {item.verified ? 'Verified' : 'Issue Found'}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mb-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Expected Quantity
                        </label>
                        <input
                          type="number"
                          value={item.expectedQuantity}
                          readOnly
                          className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Actual Quantity
                        </label>
                        <input
                          type="number"
                          value={item.actualQuantity}
                          onChange={(e) => updateInventoryItem(index, { 
                            actualQuantity: parseInt(e.target.value) || 0,
                            verified: parseInt(e.target.value) === item.expectedQuantity && item.condition !== 'damaged'
                          })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                          min="0"
                        />
                      </div>
                    </div>

                    <div className="mb-3">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Condition
                      </label>
                      <select
                        value={item.condition}
                        onChange={(e) => updateInventoryItem(index, { 
                          condition: e.target.value,
                          verified: item.actualQuantity === item.expectedQuantity && e.target.value !== 'damaged'
                        })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="excellent">Excellent</option>
                        <option value="good">Good</option>
                        <option value="fair">Fair</option>
                        <option value="worn">Worn</option>
                        <option value="damaged">Damaged</option>
                        <option value="missing">Missing</option>
                      </select>
                    </div>

                    {!item.verified && (
                      <div className="space-y-3 pt-3 border-t">
                        <div className="flex items-center">
                          <input
                            type="checkbox"
                            id={`charge-${index}`}
                            checked={item.chargeGuest}
                            onChange={(e) => updateInventoryItem(index, { 
                              chargeGuest: e.target.checked,
                              chargeAmount: e.target.checked ? item.itemId?.effectiveReplacementPrice || 0 : 0
                            })}
                            className="mr-2"
                          />
                          <label htmlFor={`charge-${index}`} className="text-sm font-medium text-gray-700">
                            Charge Guest
                          </label>
                        </div>

                        {item.chargeGuest && (
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Charge Amount (₹)
                            </label>
                            <input
                              type="number"
                              value={item.chargeAmount || 0}
                              onChange={(e) => updateInventoryItem(index, { 
                                chargeAmount: parseFloat(e.target.value) || 0
                              })}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                              min="0"
                              step="1"
                            />
                          </div>
                        )}

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Notes
                          </label>
                          <textarea
                            value={item.notes || ''}
                            onChange={(e) => updateInventoryItem(index, { notes: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                            rows={2}
                            placeholder="Describe the issue..."
                          />
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          )}

          {currentStep === 4 && (
            <Card className="p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Final Review & Charges
              </h2>

              {/* Summary of Issues */}
              <div className="space-y-4 mb-6">
                <div>
                  <h3 className="font-medium text-gray-900 mb-2">Equipment Issues</h3>
                  {inspection.checklistItems.filter(item => 
                    item.status !== 'working' && item.status !== 'satisfactory'
                  ).length === 0 ? (
                    <p className="text-sm text-green-600">No equipment issues found</p>
                  ) : (
                    <div className="space-y-2">
                      {inspection.checklistItems.filter(item => 
                        item.status !== 'working' && item.status !== 'satisfactory'
                      ).map((item, index) => (
                        <div key={`-${index}-${item.status}`} className="flex items-center justify-between p-2 bg-red-50 rounded">
                          <span className="text-sm">{item.item}: {item.status.replace('_', ' ')}</span>
                          <Badge variant="secondary" className={getSeverityColor(item.severity || 'minor')}>
                            {item.severity || 'minor'}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <h3 className="font-medium text-gray-900 mb-2">Inventory Issues</h3>
                  {inspection.inventoryVerification.filter(item => !item.verified).length === 0 ? (
                    <p className="text-sm text-green-600">All inventory verified</p>
                  ) : (
                    <div className="space-y-2">
                      {inspection.inventoryVerification.filter(item => !item.verified).map((item, index) => (
                        <div key={`item-${index}`} className="flex items-center justify-between p-2 bg-yellow-50 rounded">
                          <span className="text-sm">
                            {item.itemName}: {item.actualQuantity}/{item.expectedQuantity} ({item.condition})
                          </span>
                          {item.chargeGuest && (
                            <span className="text-sm font-medium text-red-600">
                              ₹{item.chargeAmount}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Additional Damages */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-medium text-gray-900">Additional Damages</h3>
                  <Button size="sm" onClick={addDamage}>
                    <Plus className="w-4 h-4 mr-1" />
                    Add Damage
                  </Button>
                </div>
                
                {inspection.damagesFound.length === 0 ? (
                  <p className="text-sm text-green-600">No additional damages reported</p>
                ) : (
                  <div className="space-y-3">
                    {inspection.damagesFound.map((damage, index) => (
                      <div key={`inspection-damagesFound-${index}`} className="border rounded-lg p-3">
                        <div className="grid grid-cols-2 gap-3 mb-3">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Description
                            </label>
                            <input
                              type="text"
                              value={damage.description}
                              onChange={(e) => updateDamage(index, { description: e.target.value })}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                              placeholder="Describe the damage..."
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Estimated Cost (₹)
                            </label>
                            <input
                              type="number"
                              value={damage.estimatedCost}
                              onChange={(e) => updateDamage(index, { 
                                estimatedCost: parseFloat(e.target.value) || 0,
                                chargeAmount: damage.chargeGuest ? parseFloat(e.target.value) || 0 : 0
                              })}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                              min="0"
                              step="1"
                            />
                          </div>
                        </div>

                        <div className="flex items-center justify-between">
                          <div className="flex items-center">
                            <input
                              type="checkbox"
                              id={`damage-charge-${index}`}
                              checked={damage.chargeGuest}
                              onChange={(e) => updateDamage(index, { 
                                chargeGuest: e.target.checked,
                                chargeAmount: e.target.checked ? damage.estimatedCost : 0
                              })}
                              className="mr-2"
                            />
                            <label htmlFor={`damage-charge-${index}`} className="text-sm font-medium text-gray-700">
                              Charge Guest (₹{damage.chargeGuest ? damage.chargeAmount || 0 : 0})
                            </label>
                          </div>
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => {
                              const updatedDamages = inspection.damagesFound.filter((_, i) => i !== index);
                              setInspection({ ...inspection, damagesFound: updatedDamages });
                            }}
                          >
                            Remove
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Final Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Final Inspection Notes
                </label>
                <textarea
                  value={inspection.notes || ''}
                  onChange={(e) => setInspection({ ...inspection, notes: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                  rows={3}
                  placeholder="Any additional notes about the room condition..."
                />
              </div>
            </Card>
          )}
        </div>

        {/* Summary Panel */}
        <div className="space-y-4">
          <Card className="p-4">
            <h3 className="font-medium text-gray-900 mb-3">Inspection Progress</h3>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Electronics</span>
                <span className="text-green-600">
                  {inspection.checklistItems.filter(item => 
                    item.category === 'electronics' && (item.status === 'working' || item.status === 'satisfactory')
                  ).length}/
                  {inspection.checklistItems.filter(item => item.category === 'electronics').length}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Plumbing</span>
                <span className="text-green-600">
                  {inspection.checklistItems.filter(item => 
                    item.category === 'plumbing' && (item.status === 'working' || item.status === 'satisfactory')
                  ).length}/
                  {inspection.checklistItems.filter(item => item.category === 'plumbing').length}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Furniture & Amenities</span>
                <span className="text-green-600">
                  {inspection.checklistItems.filter(item => 
                    ['furniture', 'amenities', 'cleanliness'].includes(item.category) && 
                    (item.status === 'working' || item.status === 'satisfactory')
                  ).length}/
                  {inspection.checklistItems.filter(item => 
                    ['furniture', 'amenities', 'cleanliness'].includes(item.category)
                  ).length}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Inventory</span>
                <span className="text-green-600">
                  {inspection.inventoryVerification.filter(item => item.verified).length}/
                  {inspection.inventoryVerification.length}
                </span>
              </div>
            </div>
          </Card>

          {totalCharges > 0 && (
            <Card className="p-4">
              <h3 className="font-medium text-gray-900 mb-3">Guest Charges</h3>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Equipment Issues</span>
                  <span>
                    ₹{inspection.checklistItems
                      .filter(item => item.estimatedCost && item.estimatedCost > 0)
                      .reduce((sum, item) => sum + (item.estimatedCost || 0), 0)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Inventory Issues</span>
                  <span>
                    ₹{inspection.inventoryVerification
                      .filter(item => item.chargeGuest)
                      .reduce((sum, item) => sum + (item.chargeAmount || 0), 0)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Additional Damages</span>
                  <span>
                    ₹{inspection.damagesFound
                      .filter(damage => damage.chargeGuest)
                      .reduce((sum, damage) => sum + (damage.chargeAmount || 0), 0)}
                  </span>
                </div>
                <div className="border-t pt-2 mt-2">
                  <div className="flex justify-between font-semibold">
                    <span>Total Charges</span>
                    <span className="text-red-600">₹{totalCharges}</span>
                  </div>
                </div>
              </div>
            </Card>
          )}

          <Card className="p-4">
            <h3 className="font-medium text-gray-900 mb-3">Room Status</h3>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm">Condition Score</span>
                <span className="font-semibold">
                  {inspection.roomConditionScore || 0}/100
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Can Checkout</span>
                <Badge variant="secondary" className={inspection.canCheckout ? getStatusColor('working') : getStatusColor('damaged')}>
                  {inspection.canCheckout ? 'Yes' : 'No'}
                </Badge>
              </div>
              {inspection.checkoutBlocked && (
                <div className="text-sm text-red-600">
                  <AlertTriangle className="w-4 h-4 inline mr-1" />
                  Checkout blocked due to critical issues
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>

      {/* Navigation & Actions */}
      <div className="flex items-center justify-between pt-6 border-t">
        <div className="flex items-center space-x-3">
          {currentStep > 0 && (
            <Button
              variant="secondary"
              onClick={() => setCurrentStep(currentStep - 1)}
            >
              Previous
            </Button>
          )}
          {onCancel && (
            <Button variant="secondary" onClick={onCancel}>
              Cancel
            </Button>
          )}
        </div>

        <div className="flex items-center space-x-3">
          <Button
            variant="secondary"
            onClick={() => saveInspection('in_progress')}
            disabled={saving}
          >
            {saving ? <LoadingSpinner size="sm" /> : <FileText className="w-4 h-4 mr-2" />}
            Save Draft
          </Button>

          {currentStep < steps.length - 1 ? (
            <Button
              onClick={() => setCurrentStep(currentStep + 1)}
            >
              Next
            </Button>
          ) : (
            <Button
              onClick={() => saveInspection('completed')}
              disabled={saving}
              className="bg-green-600 hover:bg-green-700"
            >
              {saving ? <LoadingSpinner size="sm" /> : <CheckCircle className="w-4 h-4 mr-2" />}
              Complete Inspection
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export { CheckoutInspectionForm };
export default withErrorBoundary(CheckoutInspectionForm, { level: 'component' });