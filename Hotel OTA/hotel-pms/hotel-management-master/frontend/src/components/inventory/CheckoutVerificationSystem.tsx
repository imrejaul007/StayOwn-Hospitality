import React, { useState, useEffect } from 'react';
import {
  CheckCircle,
  XCircle,
  AlertTriangle,
  Camera,
  IndianRupee,
  Clock,
  User,
  MapPin,
  Package,
  Tv,
  Wifi,
  Bath,
  Bed,
  Coffee,
  Phone,
  AirVent,
  Shield,
  Save,
  RefreshCw,
  FileText,
  CreditCard
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LoadingSpinner } from '../LoadingSpinner';
import { roomInventoryService, CheckoutInspection, RoomInventory } from '../../services/roomInventoryService';
import { formatCurrency } from '../../utils/formatters';
import { withErrorBoundary } from '../ErrorBoundary';

interface CheckoutVerificationSystemProps {
  bookingId: string;
  roomId: string;
  guestId?: string;
  onComplete?: (inspection: CheckoutInspection) => void;
  onCancel?: () => void;
}

interface EquipmentCheck {
  category: 'electronics' | 'plumbing' | 'furniture' | 'amenities' | 'cleanliness' | 'safety';
  item: string;
  description: string;
  icon: React.ReactNode;
  status: 'working' | 'not_working' | 'missing' | 'damaged' | 'dirty' | 'satisfactory';
  severity?: 'minor' | 'moderate' | 'major' | 'critical';
  actionRequired: 'none' | 'clean' | 'repair' | 'replace' | 'report_maintenance';
  estimatedCost: number;
  notes: string;
  photos: string[];
  checked: boolean;
}

interface InventoryCheck {
  itemId: string;
  itemName: string;
  category: string;
  expectedQuantity: number;
  actualQuantity: number;
  condition: string;
  verified: boolean;
  discrepancy: 'none' | 'missing' | 'damaged' | 'extra' | 'wrong_condition';
  replacementNeeded: boolean;
  chargeGuest: boolean;
  chargeAmount: number;
  location: string;
  notes: string;
  photos: string[];
}

interface Damage {
  type: 'inventory_damage' | 'room_damage' | 'missing_item' | 'extra_usage';
  category?: string;
  itemId?: string;
  itemName?: string;
  description: string;
  severity: 'minor' | 'moderate' | 'major' | 'critical';
  quantity: number;
  estimatedCost: number;
  chargeGuest: boolean;
  chargeAmount: number;
  chargeReason: string;
  location: string;
  photos: string[];
  reportedToMaintenance: boolean;
}

const equipmentCategories = [
  {
    category: 'electronics' as const,
    items: [
      { item: 'Television', description: 'Main TV functionality', icon: <Tv className="w-5 h-5" /> },
      { item: 'TV Remote', description: 'Remote control working', icon: <Phone className="w-5 h-5" /> },
      { item: 'Air Conditioning', description: 'AC unit functionality', icon: <AirVent className="w-5 h-5" /> },
      { item: 'WiFi Connection', description: 'Internet connectivity', icon: <Wifi className="w-5 h-5" /> },
      { item: 'Room Phone', description: 'Phone service', icon: <Phone className="w-5 h-5" /> },
      { item: 'Mini Fridge', description: 'Refrigerator functionality', icon: <Package className="w-5 h-5" /> }
    ]
  },
  {
    category: 'plumbing' as const,
    items: [
      { item: 'Bathroom Tap', description: 'Hot/cold water flow', icon: <Bath className="w-5 h-5" /> },
      { item: 'Shower Head', description: 'Water pressure and temperature', icon: <Bath className="w-5 h-5" /> },
      { item: 'Toilet Flush', description: 'Flushing mechanism', icon: <Bath className="w-5 h-5" /> },
      { item: 'Sink Drainage', description: 'Water drainage', icon: <Bath className="w-5 h-5" /> }
    ]
  },
  {
    category: 'furniture' as const,
    items: [
      { item: 'Bed Frame', description: 'Structural integrity', icon: <Bed className="w-5 h-5" /> },
      { item: 'Mattress', description: 'Condition and cleanliness', icon: <Bed className="w-5 h-5" /> },
      { item: 'Wardrobe/Closet', description: 'Doors and shelves', icon: <Package className="w-5 h-5" /> },
      { item: 'Chair/Sofa', description: 'Condition and cleanliness', icon: <Package className="w-5 h-5" /> },
      { item: 'Desk/Table', description: 'Surface condition', icon: <Package className="w-5 h-5" /> }
    ]
  },
  {
    category: 'safety' as const,
    items: [
      { item: 'Door Lock', description: 'Security mechanism', icon: <Shield className="w-5 h-5" /> },
      { item: 'Window Lock', description: 'Window security', icon: <Shield className="w-5 h-5" /> },
      { item: 'Safe Box', description: 'In-room safe functionality', icon: <Shield className="w-5 h-5" /> }
    ]
  }
];

function CheckoutVerificationSystem({
  bookingId,
  roomId,
  guestId,
  onComplete,
  onCancel
}: CheckoutVerificationSystemProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [roomInventory, setRoomInventory] = useState<RoomInventory | null>(null);
  const [existingInspection, setExistingInspection] = useState<CheckoutInspection | null>(null);
  const [equipmentChecks, setEquipmentChecks] = useState<EquipmentCheck[]>([]);
  const [inventoryChecks, setInventoryChecks] = useState<InventoryCheck[]>([]);
  const [damages, setDamages] = useState<Damage[]>([]);
  const [inspectorNotes, setInspectorNotes] = useState('');
  const [roomConditionScore, setRoomConditionScore] = useState(100);
  const [inspectionStartTime] = useState(Date.now());
  const [timeSpent, setTimeSpent] = useState(0);
  const [canCheckout, setCanCheckout] = useState(false);

  const steps = [
    'Equipment Check',
    'Inventory Verification',
    'Damage Assessment', 
    'Final Review'
  ];

  useEffect(() => {
    fetchData();
    const timer = setInterval(() => {
      setTimeSpent(Math.floor((Date.now() - inspectionStartTime) / 1000 / 60));
    }, 60000);
    return () => clearInterval(timer);
  }, [bookingId, roomId]);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      const [roomResponse, inspectionResponse] = await Promise.all([
        roomInventoryService.getRoomInventory(roomId),
        roomInventoryService.getCheckoutInspection(bookingId).catch(() => ({ data: { inspection: null } }))
      ]);

      setRoomInventory(roomResponse.data.roomInventory);
      
      if (inspectionResponse.data.inspection) {
        setExistingInspection(inspectionResponse.data.inspection);
        loadExistingInspectionData(inspectionResponse.data.inspection);
      } else {
        initializeNewInspection(roomResponse.data.roomInventory);
      }
    } catch {
      // Error handled silently
    } finally {
      setLoading(false);
    }
  };

  const initializeNewInspection = (inventory: RoomInventory) => {
    // Initialize equipment checks
    const equipment: EquipmentCheck[] = [];
    equipmentCategories.forEach(category => {
      category.items.forEach(item => {
        equipment.push({
          category: category.category,
          item: item.item,
          description: item.description,
          icon: item.icon,
          status: 'working',
          actionRequired: 'none',
          estimatedCost: 0,
          notes: '',
          photos: [],
          checked: false
        });
      });
    });
    setEquipmentChecks(equipment);

    // Initialize inventory checks
    const inventoryItems: InventoryCheck[] = inventory.items.map(item => ({
      itemId: item.itemId._id,
      itemName: item.itemId.name,
      category: item.itemId.category,
      expectedQuantity: item.expectedQuantity,
      actualQuantity: item.currentQuantity,
      condition: item.condition,
      verified: false,
      discrepancy: 'none' as const,
      replacementNeeded: false,
      chargeGuest: false,
      chargeAmount: 0,
      location: item.location || '',
      notes: '',
      photos: []
    }));
    setInventoryChecks(inventoryItems);
  };

  const loadExistingInspectionData = (inspection: CheckoutInspection) => {
    setEquipmentChecks(inspection.checklistItems.map(item => ({
      category: item.category,
      item: item.item,
      description: item.description || '',
      icon: <Package className="w-5 h-5" />,
      status: item.status,
      severity: item.severity,
      actionRequired: item.actionRequired,
      estimatedCost: item.estimatedCost || 0,
      notes: item.notes || '',
      photos: item.photos?.map(p => p.url) || [],
      checked: true
    })));

    setInventoryChecks(inspection.inventoryVerification.map(item => ({
      itemId: item.itemId._id,
      itemName: item.itemName,
      category: item.category,
      expectedQuantity: item.expectedQuantity,
      actualQuantity: item.actualQuantity,
      condition: item.condition,
      verified: item.verified,
      discrepancy: item.discrepancy,
      replacementNeeded: item.replacementNeeded,
      chargeGuest: item.chargeGuest,
      chargeAmount: item.chargeAmount || 0,
      location: item.location || '',
      notes: item.notes || '',
      photos: item.photos?.map(p => p.url) || []
    })));

    setDamages(inspection.damagesFound);
    setInspectorNotes(inspection.notes || '');
    setRoomConditionScore(inspection.roomConditionScore || 100);
    setCanCheckout(inspection.canCheckout);
  };

  const updateEquipmentCheck = (index: number, updates: Partial<EquipmentCheck>) => {
    setEquipmentChecks(prev => prev.map((item, i) => 
      i === index ? { ...item, ...updates } : item
    ));
  };

  const updateInventoryCheck = (index: number, updates: Partial<InventoryCheck>) => {
    setInventoryChecks(prev => prev.map((item, i) => 
      i === index ? { ...item, ...updates } : item
    ));
  };

  const addDamage = () => {
    const newDamage: Damage = {
      type: 'room_damage',
      description: '',
      severity: 'minor',
      quantity: 1,
      estimatedCost: 0,
      chargeGuest: false,
      chargeAmount: 0,
      chargeReason: '',
      location: '',
      photos: [],
      reportedToMaintenance: false
    };
    setDamages(prev => [...prev, newDamage]);
  };

  const updateDamage = (index: number, updates: Partial<Damage>) => {
    setDamages(prev => prev.map((damage, i) => 
      i === index ? { ...damage, ...updates } : damage
    ));
  };

  const removeDamage = (index: number) => {
    setDamages(prev => prev.filter((_, i) => i !== index));
  };

  const calculateTotalCharges = () => {
    const equipmentCharges = equipmentChecks
      .filter(check => check.status !== 'working' && check.status !== 'satisfactory')
      .reduce((sum, check) => sum + check.estimatedCost, 0);

    const inventoryCharges = inventoryChecks
      .filter(check => check.chargeGuest)
      .reduce((sum, check) => sum + check.chargeAmount, 0);

    const damageCharges = damages
      .filter(damage => damage.chargeGuest)
      .reduce((sum, damage) => sum + damage.chargeAmount, 0);

    return equipmentCharges + inventoryCharges + damageCharges;
  };

  const calculateRoomScore = () => {
    let score = 100;
    let totalItems = equipmentChecks.length + inventoryChecks.length;

    // Deduct points for equipment issues
    equipmentChecks.forEach(check => {
      if (check.status === 'not_working' || check.status === 'damaged') {
        score -= check.severity === 'critical' ? 20 : check.severity === 'major' ? 15 : 
                 check.severity === 'moderate' ? 10 : 5;
      }
    });

    // Deduct points for inventory discrepancies
    inventoryChecks.forEach(check => {
      if (check.discrepancy !== 'none') {
        score -= check.discrepancy === 'missing' ? 15 : 
                 check.discrepancy === 'damaged' ? 10 : 5;
      }
    });

    // Deduct points for damages
    damages.forEach(damage => {
      score -= damage.severity === 'critical' ? 25 : damage.severity === 'major' ? 20 : 
               damage.severity === 'moderate' ? 15 : 10;
    });

    const finalScore = Math.max(0, Math.floor(score));
    setRoomConditionScore(finalScore);
    
    // Determine if checkout can proceed
    const criticalIssues = [...equipmentChecks, ...damages].filter(item => 
      ('severity' in item && item.severity === 'critical') || 
      ('status' in item && item.status === 'not_working')
    );
    
    setCanCheckout(criticalIssues.length === 0 && finalScore >= 60);
    
    return finalScore;
  };

  const submitInspection = async () => {
    try {
      setSaving(true);
      
      const totalCharges = calculateTotalCharges();
      const finalScore = calculateRoomScore();
      
      const inspectionData = {
        roomId,
        bookingId,
        guestId,
        checklistItems: equipmentChecks.map(check => ({
          category: check.category,
          item: check.item,
          description: check.description,
          status: check.status,
          severity: check.severity,
          actionRequired: check.actionRequired,
          estimatedCost: check.estimatedCost,
          notes: check.notes,
          photos: check.photos.map(url => ({
            url,
            description: 'Checkout inspection photo',
            uploadedAt: new Date().toISOString()
          })),
          checkedAt: new Date().toISOString()
        })),
        inventoryVerification: inventoryChecks.map(check => ({
          itemId: { _id: check.itemId } as unknown,
          itemName: check.itemName,
          category: check.category,
          expectedQuantity: check.expectedQuantity,
          actualQuantity: check.actualQuantity,
          condition: check.condition,
          verified: check.verified,
          discrepancy: check.discrepancy,
          replacementNeeded: check.replacementNeeded,
          chargeGuest: check.chargeGuest,
          chargeAmount: check.chargeAmount,
          location: check.location,
          notes: check.notes,
          photos: check.photos.map(url => ({
            url,
            description: 'Inventory verification photo',
            uploadedAt: new Date().toISOString()
          }))
        })),
        damagesFound: damages,
        roomConditionScore: finalScore,
        totalCharges,
        chargesSummary: {
          damages: damages.filter(d => d.chargeGuest).reduce((sum, d) => sum + d.chargeAmount, 0),
          missing: inventoryChecks.filter(c => c.discrepancy === 'missing' && c.chargeGuest).reduce((sum, c) => sum + c.chargeAmount, 0),
          extra: 0,
          cleaning: 0
        },
        inspectionStatus: canCheckout ? (totalCharges > 0 ? 'pending_charges' : 'passed') : 'failed',
        canCheckout,
        checkoutBlocked: !canCheckout,
        blockingIssues: !canCheckout ? equipmentChecks
          .filter(check => check.severity === 'critical' || check.status === 'not_working')
          .map(check => ({
            issue: `${check.item}: ${check.status}`,
            severity: check.severity || 'major',
            resolution: check.actionRequired
          })) : undefined,
        followUpRequired: damages.some(d => d.severity === 'major' || d.severity === 'critical') || 
                          equipmentChecks.some(c => c.actionRequired === 'report_maintenance'),
        timeSpent,
        notes: inspectorNotes,
        completedAt: new Date().toISOString(),
        inspectionDuration: timeSpent
      };

      let response;
      if (existingInspection) {
        response = await roomInventoryService.updateCheckoutInspection(bookingId, inspectionData);
      } else {
        response = await roomInventoryService.createCheckoutInspection(inspectionData);
      }

      onComplete?.(response.data.inspection);
    } catch {
      // Error handled silently
    } finally {
      setSaving(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'working':
      case 'satisfactory': return 'text-green-600 bg-green-50';
      case 'not_working':
      case 'damaged': return 'text-red-600 bg-red-50';
      case 'missing': return 'text-gray-600 bg-gray-50';
      case 'dirty': return 'text-yellow-600 bg-yellow-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getSeverityColor = (severity?: string) => {
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

  return (
    <div className="max-w-6xl mx-auto p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Checkout Verification</h1>
            <p className="text-gray-600">
              Room {roomInventory?.roomId.roomNumber} - Booking #{bookingId.slice(-6)}
            </p>
          </div>
          <div className="text-right">
            <div className="flex items-center space-x-4">
              <div className="text-center">
                <div className="text-lg font-bold text-gray-900">{roomConditionScore}/100</div>
                <div className="text-sm text-gray-600">Room Score</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold text-gray-900">{formatCurrency(calculateTotalCharges())}</div>
                <div className="text-sm text-gray-600">Total Charges</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold text-gray-900">{timeSpent}m</div>
                <div className="text-sm text-gray-600">Time Spent</div>
              </div>
            </div>
          </div>
        </div>

        {/* Checkout Status */}
        <div className="mt-4">
          <Badge 
            variant="secondary" 
            className={canCheckout ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}
          >
            {canCheckout ? '✓ Ready for Checkout' : '✗ Checkout Blocked'}
          </Badge>
        </div>
      </div>

      {/* Progress Steps */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          {steps.map((step, index) => (
            <div key={step} className={`flex items-center ${
              index < steps.length - 1 ? 'flex-1' : ''
            }`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                index <= currentStep ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'
              }`}>
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
        {/* Step 0: Equipment Check */}
        {currentStep === 0 && (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold text-gray-900">Equipment & Systems Check</h2>
            <p className="text-gray-600">Verify all room equipment and systems are working properly</p>

            {equipmentCategories.map((category, categoryIndex) => (
              <div key={category.category} className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-800 capitalize">
                  {category.category} ({category.items.length} items)
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {category.items.map((item, itemIndex) => {
                    const checkIndex = equipmentCategories
                      .slice(0, categoryIndex)
                      .reduce((sum, cat) => sum + cat.items.length, 0) + itemIndex;
                    const check = equipmentChecks[checkIndex];
                    
                    return (
                      <Card key={item.item} className={`p-4 border-l-4 ${
                        check?.checked 
                          ? check.status === 'working' || check.status === 'satisfactory'
                            ? 'border-green-500'
                            : 'border-red-500'
                          : 'border-gray-300'
                      }`}>
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center space-x-3">
                            {item.icon}
                            <div>
                              <h4 className="font-semibold text-gray-900">{item.item}</h4>
                              <p className="text-sm text-gray-600">{item.description}</p>
                            </div>
                          </div>
                          <Badge 
                            variant="secondary" 
                            className={check ? getStatusColor(check.status) : 'bg-gray-100 text-gray-600'}
                          >
                            {check?.status.replace('_', ' ') || 'Not Checked'}
                          </Badge>
                        </div>

                        <div className="space-y-3">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Status
                            </label>
                            <select
                              value={check?.status || 'working'}
                              onChange={(e) => updateEquipmentCheck(checkIndex, {
                                status: e.target.value as EquipmentCheck['status'],
                                checked: true
                              })}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            >
                              <option value="working">Working</option>
                              <option value="not_working">Not Working</option>
                              <option value="damaged">Damaged</option>
                              <option value="missing">Missing</option>
                              <option value="dirty">Needs Cleaning</option>
                              <option value="satisfactory">Satisfactory</option>
                            </select>
                          </div>

                          {check && (check.status !== 'working' && check.status !== 'satisfactory') && (
                            <>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div>
                                  <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Severity
                                  </label>
                                  <select
                                    value={check.severity || 'minor'}
                                    onChange={(e) => updateEquipmentCheck(checkIndex, {
                                      severity: e.target.value as EquipmentCheck['severity']
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
                                    Estimated Cost ($)
                                  </label>
                                  <input
                                    type="number"
                                    value={check.estimatedCost}
                                    onChange={(e) => updateEquipmentCheck(checkIndex, {
                                      estimatedCost: parseFloat(e.target.value) || 0
                                    })}
                                    step="0.01"
                                    min="0"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                  />
                                </div>
                              </div>

                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                  Notes
                                </label>
                                <textarea
                                  value={check.notes}
                                  onChange={(e) => updateEquipmentCheck(checkIndex, {
                                    notes: e.target.value
                                  })}
                                  rows={2}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                  placeholder="Describe the issue..."
                                />
                              </div>
                            </>
                          )}
                        </div>
                      </Card>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Step 1: Inventory Verification */}
        {currentStep === 1 && (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold text-gray-900">Inventory Verification</h2>
            <p className="text-gray-600">Verify all room inventory items are present and in good condition</p>

            <div className="space-y-4">
              {inventoryChecks.map((check, index) => (
                <Card key={check.itemId} className={`p-4 border-l-4 ${
                  check.verified
                    ? check.discrepancy === 'none' ? 'border-green-500' : 'border-yellow-500'
                    : 'border-gray-300'
                }`}>
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center space-x-3">
                      <Package className="w-5 h-5 text-gray-600" />
                      <div>
                        <h4 className="font-semibold text-gray-900">{check.itemName}</h4>
                        <p className="text-sm text-gray-600">{check.category}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge variant="secondary" className={
                        check.discrepancy === 'none' ? 'bg-green-100 text-green-800' :
                        check.discrepancy === 'missing' ? 'bg-red-100 text-red-800' :
                        'bg-yellow-100 text-yellow-800'
                      }>
                        {check.discrepancy === 'none' ? 'OK' : check.discrepancy.replace('_', ' ')}
                      </Badge>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Expected Quantity
                      </label>
                      <div className="px-3 py-2 bg-gray-100 rounded-md text-center">
                        {check.expectedQuantity}
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Actual Quantity
                      </label>
                      <input
                        type="number"
                        value={check.actualQuantity}
                        onChange={(e) => {
                          const actual = parseInt(e.target.value) || 0;
                          const discrepancy = actual === check.expectedQuantity ? 'none' :
                                            actual < check.expectedQuantity ? 'missing' : 'extra';
                          updateInventoryCheck(index, {
                            actualQuantity: actual,
                            discrepancy,
                            verified: true
                          });
                        }}
                        min="0"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-center"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Condition
                      </label>
                      <select
                        value={check.condition}
                        onChange={(e) => {
                          const condition = e.target.value;
                          const discrepancy = condition === 'damaged' || condition === 'worn' ? 'wrong_condition' :
                                            check.actualQuantity !== check.expectedQuantity ? 
                                            (check.actualQuantity < check.expectedQuantity ? 'missing' : 'extra') : 'none';
                          updateInventoryCheck(index, {
                            condition,
                            discrepancy,
                            verified: true
                          });
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="excellent">Excellent</option>
                        <option value="good">Good</option>
                        <option value="fair">Fair</option>
                        <option value="worn">Worn</option>
                        <option value="damaged">Damaged</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Location
                      </label>
                      <input
                        type="text"
                        value={check.location}
                        onChange={(e) => updateInventoryCheck(index, {
                          location: e.target.value
                        })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Room location"
                      />
                    </div>
                  </div>

                  {check.discrepancy !== 'none' && (
                    <div className="bg-yellow-50 p-4 rounded-lg">
                      <div className="flex items-center justify-between mb-3">
                        <h5 className="font-medium text-yellow-800">Charge Guest?</h5>
                        <label className="flex items-center">
                          <input
                            type="checkbox"
                            checked={check.chargeGuest}
                            onChange={(e) => updateInventoryCheck(index, {
                              chargeGuest: e.target.checked,
                              chargeAmount: e.target.checked ? 20 : 0
                            })}
                            className="mr-2"
                          />
                          <span className="text-sm text-yellow-800">Yes, charge guest</span>
                        </label>
                      </div>

                      {check.chargeGuest && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-sm font-medium text-yellow-700 mb-1">
                              Charge Amount ($)
                            </label>
                            <input
                              type="number"
                              value={check.chargeAmount}
                              onChange={(e) => updateInventoryCheck(index, {
                                chargeAmount: parseFloat(e.target.value) || 0
                              })}
                              step="0.01"
                              min="0"
                              className="w-full px-3 py-2 border border-yellow-300 rounded-md focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-yellow-700 mb-1">
                              Reason
                            </label>
                            <textarea
                              value={check.notes}
                              onChange={(e) => updateInventoryCheck(index, {
                                notes: e.target.value
                              })}
                              rows={2}
                              className="w-full px-3 py-2 border border-yellow-300 rounded-md focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
                              placeholder="Reason for charge..."
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Step 2: Damage Assessment */}
        {currentStep === 2 && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Damage Assessment</h2>
                <p className="text-gray-600">Document any damages or issues found during inspection</p>
              </div>
              <Button onClick={addDamage} size="sm">
                <Plus className="w-4 h-4 mr-1" />
                Add Damage
              </Button>
            </div>

            {damages.length === 0 ? (
              <Card className="p-8 text-center">
                <CheckCircle className="mx-auto h-12 w-12 text-green-500 mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No Damages Found</h3>
                <p className="text-gray-600">The room is in excellent condition with no damages to report.</p>
              </Card>
            ) : (
              <div className="space-y-4">
                {damages.map((damage, index) => (
                  <Card key={`damages-${index}-${damage.type}`} className="p-4 border-l-4 border-l-red-500">
                    <div className="space-y-4">
                      <div className="flex items-start justify-between">
                        <h4 className="font-semibold text-gray-900">Damage #{index + 1}</h4>
                        <Button
                          onClick={() => removeDamage(index)}
                          size="sm"
                          variant="secondary"
                          className="text-red-600 hover:bg-red-50"
                        >
                          Remove
                        </Button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Type
                          </label>
                          <select
                            value={damage.type}
                            onChange={(e) => updateDamage(index, {
                              type: e.target.value as Damage['type']
                            })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          >
                            <option value="room_damage">Room Damage</option>
                            <option value="inventory_damage">Inventory Damage</option>
                            <option value="missing_item">Missing Item</option>
                            <option value="extra_usage">Extra Usage</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Severity
                          </label>
                          <select
                            value={damage.severity}
                            onChange={(e) => updateDamage(index, {
                              severity: e.target.value as Damage['severity']
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
                            Location
                          </label>
                          <input
                            type="text"
                            value={damage.location}
                            onChange={(e) => updateDamage(index, {
                              location: e.target.value
                            })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            placeholder="Where in the room"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Description
                        </label>
                        <textarea
                          value={damage.description}
                          onChange={(e) => updateDamage(index, {
                            description: e.target.value
                          })}
                          rows={2}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          placeholder="Detailed description of the damage..."
                        />
                      </div>

                      <div className="bg-yellow-50 p-4 rounded-lg">
                        <div className="flex items-center justify-between mb-3">
                          <h5 className="font-medium text-yellow-800">Guest Charges</h5>
                          <label className="flex items-center">
                            <input
                              type="checkbox"
                              checked={damage.chargeGuest}
                              onChange={(e) => updateDamage(index, {
                                chargeGuest: e.target.checked
                              })}
                              className="mr-2"
                            />
                            <span className="text-sm text-yellow-800">Charge guest</span>
                          </label>
                        </div>

                        {damage.chargeGuest && (
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <div>
                              <label className="block text-sm font-medium text-yellow-700 mb-1">
                                Estimated Cost ($)
                              </label>
                              <input
                                type="number"
                                value={damage.estimatedCost}
                                onChange={(e) => updateDamage(index, {
                                  estimatedCost: parseFloat(e.target.value) || 0
                                })}
                                step="0.01"
                                min="0"
                                className="w-full px-3 py-2 border border-yellow-300 rounded-md focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-yellow-700 mb-1">
                                Charge Amount ($)
                              </label>
                              <input
                                type="number"
                                value={damage.chargeAmount}
                                onChange={(e) => updateDamage(index, {
                                  chargeAmount: parseFloat(e.target.value) || 0
                                })}
                                step="0.01"
                                min="0"
                                className="w-full px-3 py-2 border border-yellow-300 rounded-md focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-yellow-700 mb-1">
                                Charge Reason
                              </label>
                              <input
                                type="text"
                                value={damage.chargeReason}
                                onChange={(e) => updateDamage(index, {
                                  chargeReason: e.target.value
                                })}
                                className="w-full px-3 py-2 border border-yellow-300 rounded-md focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
                                placeholder="Brief reason"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Step 3: Final Review */}
        {currentStep === 3 && (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold text-gray-900">Final Review</h2>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card className="p-4 text-center">
                <div className="text-2xl font-bold text-gray-900">{calculateRoomScore()}/100</div>
                <div className="text-sm text-gray-600">Room Score</div>
                <div className={`text-xs mt-1 ${
                  roomConditionScore >= 80 ? 'text-green-600' :
                  roomConditionScore >= 60 ? 'text-yellow-600' : 'text-red-600'
                }`}>
                  {roomConditionScore >= 80 ? 'Excellent' :
                   roomConditionScore >= 60 ? 'Fair' : 'Poor'}
                </div>
              </Card>

              <Card className="p-4 text-center">
                <div className="text-2xl font-bold text-gray-900">
                  {equipmentChecks.filter(c => c.status !== 'working' && c.status !== 'satisfactory').length}
                </div>
                <div className="text-sm text-gray-600">Equipment Issues</div>
                <div className="text-xs text-orange-600 mt-1">
                  {equipmentChecks.filter(c => c.severity === 'critical').length} Critical
                </div>
              </Card>

              <Card className="p-4 text-center">
                <div className="text-2xl font-bold text-gray-900">
                  {inventoryChecks.filter(c => c.discrepancy !== 'none').length}
                </div>
                <div className="text-sm text-gray-600">Inventory Issues</div>
                <div className="text-xs text-red-600 mt-1">
                  {inventoryChecks.filter(c => c.chargeGuest).length} Chargeable
                </div>
              </Card>

              <Card className="p-4 text-center">
                <div className="text-2xl font-bold text-gray-900">{damages.length}</div>
                <div className="text-sm text-gray-600">Damages Found</div>
                <div className="text-xs text-red-600 mt-1">
                  {formatCurrency(calculateTotalCharges())} Total
                </div>
              </Card>
            </div>

            {/* Checkout Status */}
            <Card className={`p-6 ${canCheckout ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className={`text-lg font-semibold ${canCheckout ? 'text-green-900' : 'text-red-900'}`}>
                    {canCheckout ? '✓ Checkout Approved' : '✗ Checkout Blocked'}
                  </h3>
                  <p className={`text-sm ${canCheckout ? 'text-green-700' : 'text-red-700'}`}>
                    {canCheckout 
                      ? 'Guest can proceed with checkout' 
                      : 'Critical issues must be resolved before checkout'
                    }
                  </p>
                </div>
                <div className="text-right">
                  <div className={`text-2xl font-bold ${canCheckout ? 'text-green-900' : 'text-red-900'}`}>
                    {formatCurrency(calculateTotalCharges())}
                  </div>
                  <div className={`text-sm ${canCheckout ? 'text-green-700' : 'text-red-700'}`}>
                    {calculateTotalCharges() > 0 ? 'Additional charges' : 'No charges'}
                  </div>
                </div>
              </div>
            </Card>

            {/* Inspector Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Final Notes
              </label>
              <textarea
                value={inspectorNotes}
                onChange={(e) => setInspectorNotes(e.target.value)}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Add any final notes about the inspection..."
              />
            </div>

            {/* Issues Summary */}
            {!canCheckout && (
              <Card className="p-4 bg-red-50 border-red-200">
                <h4 className="font-semibold text-red-900 mb-3">Blocking Issues</h4>
                <div className="space-y-2">
                  {equipmentChecks
                    .filter(check => check.severity === 'critical' || check.status === 'not_working')
                    .map((check, index) => (
                      <div key={`-${index}-${check.status}`} className="flex items-center justify-between p-2 bg-red-100 rounded">
                        <span className="text-red-800">{check.item}: {check.status}</span>
                        <Badge variant="secondary" className="bg-red-200 text-red-800">
                          {check.severity}
                        </Badge>
                      </div>
                    ))
                  }
                  {damages
                    .filter(damage => damage.severity === 'critical')
                    .map((damage, index) => (
                      <div key={`damage-${index}`} className="flex items-center justify-between p-2 bg-red-100 rounded">
                        <span className="text-red-800">{damage.description}</span>
                        <Badge variant="secondary" className="bg-red-200 text-red-800">
                          Critical
                        </Badge>
                      </div>
                    ))
                  }
                </div>
              </Card>
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
            <Button onClick={() => setCurrentStep(prev => prev + 1)}>
              Next Step
            </Button>
          ) : (
            <Button
              onClick={submitInspection}
              disabled={saving}
              className={canCheckout ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}
            >
              {saving ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  {canCheckout ? 'Approve Checkout' : 'Submit Inspection'}
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export { CheckoutVerificationSystem };
export default withErrorBoundary(CheckoutVerificationSystem, { level: 'component' });