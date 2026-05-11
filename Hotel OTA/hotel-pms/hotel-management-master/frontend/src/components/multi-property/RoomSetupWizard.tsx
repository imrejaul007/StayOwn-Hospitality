import React, { useState } from 'react';
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { Badge } from "../ui/badge";
import { Trash2, Plus, Bed, Hash, Settings, CheckCircle } from 'lucide-react';

interface RoomTypeConfig {
  count: number;
  basePrice: number;
  amenities: string[];
  size: number;
}

interface RoomsConfig {
  roomTypes: {
    [key: string]: RoomTypeConfig;
  };
  numberingPattern: 'sequential' | 'floor-based' | 'type-based' | 'custom';
  startingNumber: number;
  floorPlan?: {
    pattern: string;
    floors: number;
  };
}

interface RoomSetupWizardProps {
  onComplete: (roomsConfig: RoomsConfig) => void;
  onCancel: () => void;
  initialConfig?: RoomsConfig;
}

const defaultAmenities = [
  'WiFi', 'AC', 'TV', 'Desk', 'Mini Fridge', 'Safe', 'Balcony',
  'City View', 'Ocean View', 'Room Service', 'Premium Bedding',
  'Coffee Maker', 'Microwave', 'Sofa', 'Jacuzzi'
];

const roomTypeTemplates = {
  single: {
    count: 10,
    basePrice: 2000,
    amenities: ['WiFi', 'AC', 'TV', 'Desk'],
    size: 25
  },
  double: {
    count: 15,
    basePrice: 3000,
    amenities: ['WiFi', 'AC', 'TV', 'Desk', 'Mini Fridge'],
    size: 35
  },
  deluxe: {
    count: 8,
    basePrice: 4500,
    amenities: ['WiFi', 'AC', 'TV', 'Desk', 'Mini Fridge', 'Premium Bedding'],
    size: 45
  },
  suite: {
    count: 5,
    basePrice: 7000,
    amenities: ['WiFi', 'AC', 'TV', 'Desk', 'Mini Fridge', 'Sofa', 'Balcony'],
    size: 65
  }
};

export const RoomSetupWizard: React.FC<RoomSetupWizardProps> = ({
  onComplete,
  onCancel,
  initialConfig
}) => {
  const [step, setStep] = useState(1);
  const [config, setConfig] = useState<RoomsConfig>(initialConfig || {
    roomTypes: {},
    numberingPattern: 'sequential',
    startingNumber: 100
  });

  const [newRoomType, setNewRoomType] = useState({
    name: '',
    count: 1,
    basePrice: 2000,
    amenities: [] as string[],
    size: 30
  });

  const totalRooms = Object.values(config.roomTypes).reduce((sum, type) => sum + type.count, 0);

  const addRoomType = () => {
    if (!newRoomType.name.trim()) return;

    setConfig(prev => ({
      ...prev,
      roomTypes: {
        ...prev.roomTypes,
        [newRoomType.name]: {
          count: newRoomType.count,
          basePrice: newRoomType.basePrice,
          amenities: newRoomType.amenities,
          size: newRoomType.size
        }
      }
    }));

    setNewRoomType({
      name: '',
      count: 1,
      basePrice: 2000,
      amenities: [],
      size: 30
    });
  };

  const removeRoomType = (typeName: string) => {
    setConfig(prev => {
      const newRoomTypes = { ...prev.roomTypes };
      delete newRoomTypes[typeName];
      return {
        ...prev,
        roomTypes: newRoomTypes
      };
    });
  };

  const addTemplate = (templateName: string) => {
    const template = roomTypeTemplates[templateName as keyof typeof roomTypeTemplates];
    if (template) {
      setConfig(prev => ({
        ...prev,
        roomTypes: {
          ...prev.roomTypes,
          [templateName]: { ...template }
        }
      }));
    }
  };

  const toggleAmenity = (amenity: string) => {
    setNewRoomType(prev => ({
      ...prev,
      amenities: prev.amenities.includes(amenity)
        ? prev.amenities.filter(a => a !== amenity)
        : [...prev.amenities, amenity]
    }));
  };

  const renderStepIndicator = () => (
    <div className="flex items-center justify-center mb-8">
      {[1, 2, 3, 4].map((stepNum) => (
        <div key={stepNum} className="flex items-center">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
            step >= stepNum ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'
          }`}>
            {step > stepNum ? <CheckCircle className="h-4 w-4" /> : stepNum}
          </div>
          {stepNum < 4 && (
            <div className={`w-16 h-0.5 ${step > stepNum ? 'bg-blue-600' : 'bg-gray-200'}`} />
          )}
        </div>
      ))}
    </div>
  );

  const renderStep1 = () => (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <Bed className="h-12 w-12 text-blue-600 mx-auto mb-4" />
        <h3 className="text-xl font-semibold text-gray-900">Room Types Configuration</h3>
        <p className="text-gray-600">Define the types of rooms in your property</p>
      </div>

      <Tabs defaultValue="templates" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="templates">Quick Templates</TabsTrigger>
          <TabsTrigger value="custom">Custom Room Type</TabsTrigger>
        </TabsList>

        <TabsContent value="templates" className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {Object.entries(roomTypeTemplates).map(([name, template]) => {
              const isSelected = config.roomTypes[name];
              return (
                <Card
                  key={name}
                  className={`cursor-pointer hover:shadow-md transition-all ${
                    isSelected
                      ? 'ring-2 ring-green-500 bg-green-50 border-green-200'
                      : 'hover:border-blue-300'
                  }`}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className={`text-sm capitalize ${isSelected ? 'text-green-800' : ''}`}>
                        {name} Room
                        {isSelected && <CheckCircle className="inline h-4 w-4 ml-1 text-green-600" />}
                      </CardTitle>
                      <Badge variant={isSelected ? "default" : "secondary"} className={isSelected ? "bg-green-600" : ""}>
                        {template.count} rooms
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-2">
                    <div className={`text-xs space-y-1 ${isSelected ? 'text-green-700' : 'text-gray-600'}`}>
                      <p>₹{template.basePrice}/night</p>
                      <p>{template.size} sq ft</p>
                      <p>{template.amenities.length} amenities</p>
                    </div>
                    <Button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        addTemplate(name);
                      }}
                      className={`w-full mt-3 text-xs ${
                        isSelected
                          ? 'bg-green-600 text-white hover:bg-green-700'
                          : ''
                      }`}
                      variant={isSelected ? "default" : "outline"}
                      disabled={isSelected}
                    >
                      {isSelected ? (
                        <>
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Added
                        </>
                      ) : (
                        'Add Template'
                      )}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="custom" className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="roomTypeName">Room Type Name</Label>
              <Input
                id="roomTypeName"
                value={newRoomType.name}
                onChange={(e) => setNewRoomType(prev => ({ ...prev, name: e.target.value }))}
                placeholder="e.g., Executive Suite"
              />
            </div>
            <div>
              <Label htmlFor="roomCount">Number of Rooms</Label>
              <Input
                id="roomCount"
                type="number"
                min="1"
                value={newRoomType.count}
                onChange={(e) => setNewRoomType(prev => ({ ...prev, count: parseInt(e.target.value) || 1 }))}
              />
            </div>
            <div>
              <Label htmlFor="basePrice">Base Price (₹/night)</Label>
              <Input
                id="basePrice"
                type="number"
                min="0"
                value={newRoomType.basePrice}
                onChange={(e) => setNewRoomType(prev => ({ ...prev, basePrice: parseInt(e.target.value) || 0 }))}
              />
            </div>
            <div>
              <Label htmlFor="roomSize">Room Size (sq ft)</Label>
              <Input
                id="roomSize"
                type="number"
                min="0"
                value={newRoomType.size}
                onChange={(e) => setNewRoomType(prev => ({ ...prev, size: parseInt(e.target.value) || 0 }))}
              />
            </div>
          </div>

          <div>
            <Label className="text-sm font-medium">Amenities</Label>
            <div className="grid grid-cols-3 gap-2 mt-2">
              {defaultAmenities.map(amenity => (
                <label key={amenity} className="flex items-center space-x-2 text-sm">
                  <input
                    type="checkbox"
                    checked={newRoomType.amenities.includes(amenity)}
                    onChange={() => toggleAmenity(amenity)}
                    className="rounded border-gray-300"
                  />
                  <span>{amenity}</span>
                </label>
              ))}
            </div>
          </div>

          <Button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              addRoomType();
            }}
            className="w-full"
            disabled={!newRoomType.name.trim()}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Room Type
          </Button>
        </TabsContent>
      </Tabs>

      {Object.keys(config.roomTypes).length > 0 && (
        <div>
          <h4 className="font-medium text-gray-900 mb-3">Added Room Types</h4>
          <div className="space-y-2">
            {Object.entries(config.roomTypes).map(([name, type]) => (
              <div key={name} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <span className="font-medium capitalize">{name}</span>
                    <Badge>{type.count} rooms</Badge>
                    <span className="text-sm text-gray-600">₹{type.basePrice}/night</span>
                  </div>
                </div>
                <Button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    removeRoomType(name);
                  }}
                  variant="ghost"
                  size="sm"
                  className="text-red-600 hover:text-red-700"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
          <div className="mt-3 text-sm text-gray-600">
            Total: {totalRooms} rooms
          </div>
        </div>
      )}
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <Hash className="h-12 w-12 text-blue-600 mx-auto mb-4" />
        <h3 className="text-xl font-semibold text-gray-900">Room Numbering</h3>
        <p className="text-gray-600">Configure how rooms will be numbered</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="startingNumber">Starting Number</Label>
          <Input
            id="startingNumber"
            type="number"
            min="1"
            value={config.startingNumber}
            onChange={(e) => setConfig(prev => ({ ...prev, startingNumber: parseInt(e.target.value) || 100 }))}
          />
        </div>
        <div>
          <Label htmlFor="numberingPattern">Numbering Pattern</Label>
          <Select
            value={config.numberingPattern}
            onValueChange={(value) => setConfig(prev => ({ ...prev, numberingPattern: value as string }))}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="sequential">Sequential (100, 101, 102...)</SelectItem>
              <SelectItem value="floor-based">Floor-based (101, 102, 201, 202...)</SelectItem>
              <SelectItem value="type-based">Type-based (S101, D201, ST301...)</SelectItem>
              <SelectItem value="custom">Custom Pattern</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {config.numberingPattern === 'custom' && (
        <div>
          <Label htmlFor="customPattern">Custom Pattern</Label>
          <Input
            id="customPattern"
            placeholder="e.g., ROOM-{number}"
            value={config.floorPlan?.pattern || ''}
            onChange={(e) => setConfig(prev => ({
              ...prev,
              floorPlan: { ...prev.floorPlan, pattern: e.target.value, floors: prev.floorPlan?.floors || 1 }
            }))}
          />
          <p className="text-xs text-gray-500 mt-1">Use {"{number}"} as placeholder for room numbers</p>
        </div>
      )}

      <div className="bg-gray-50 rounded-lg p-4">
        <h4 className="font-medium text-gray-900 mb-2">Preview</h4>
        <div className="text-sm text-gray-600">
          Based on your configuration, rooms will be numbered like:
          <div className="mt-2 font-mono text-blue-600">
            {config.numberingPattern === 'sequential' && `${config.startingNumber}, ${config.startingNumber + 1}, ${config.startingNumber + 2}...`}
            {config.numberingPattern === 'floor-based' && '101, 102, 103, 201, 202, 203...'}
            {config.numberingPattern === 'type-based' && 'S101, S102, D201, D202, ST301...'}
            {config.numberingPattern === 'custom' && config.floorPlan?.pattern?.replace('{number}', config.startingNumber.toString())}
          </div>
        </div>
      </div>
    </div>
  );

  const renderStep3 = () => (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <Settings className="h-12 w-12 text-blue-600 mx-auto mb-4" />
        <h3 className="text-xl font-semibold text-gray-900">Additional Settings</h3>
        <p className="text-gray-600">Configure advanced room options</p>
      </div>

      <div className="space-y-4">
        {config.numberingPattern === 'floor-based' && (
          <div>
            <Label htmlFor="floors">Number of Floors</Label>
            <Input
              id="floors"
              type="number"
              min="1"
              value={config.floorPlan?.floors || 1}
              onChange={(e) => setConfig(prev => ({
                ...prev,
                floorPlan: { ...prev.floorPlan, floors: parseInt(e.target.value) || 1, pattern: prev.floorPlan?.pattern || '' }
              }))}
            />
          </div>
        )}

        <div className="bg-blue-50 rounded-lg p-4">
          <h4 className="font-medium text-blue-900 mb-2">Room Generation Summary</h4>
          <div className="space-y-1 text-sm text-blue-800">
            <p>Total rooms to be created: <span className="font-medium">{totalRooms}</span></p>
            <p>Numbering pattern: <span className="font-medium">{config.numberingPattern}</span></p>
            <p>Starting from: <span className="font-medium">{config.startingNumber}</span></p>
          </div>
        </div>
      </div>
    </div>
  );

  const renderStep4 = () => (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <CheckCircle className="h-12 w-12 text-green-600 mx-auto mb-4" />
        <h3 className="text-xl font-semibold text-gray-900">Review Configuration</h3>
        <p className="text-gray-600">Review your room setup before finalizing</p>
      </div>

      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Room Types Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Object.entries(config.roomTypes).map(([name, type]) => (
                <div key={name} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <div className="font-medium capitalize">{name}</div>
                    <div className="text-sm text-gray-600">
                      {type.count} rooms • ₹{type.basePrice}/night • {type.size} sq ft
                    </div>
                    <div className="text-xs text-gray-500">
                      Amenities: {type.amenities.join(', ')}
                    </div>
                  </div>
                  <Badge>{type.count}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Numbering Configuration</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-600">Pattern:</span>
                <div className="font-medium capitalize">{config.numberingPattern}</div>
              </div>
              <div>
                <span className="text-gray-600">Starting Number:</span>
                <div className="font-medium">{config.startingNumber}</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="bg-green-50 rounded-lg p-4">
          <div className="flex items-center gap-2 text-green-800">
            <CheckCircle className="h-5 w-5" />
            <span className="font-medium">Ready to Create</span>
          </div>
          <p className="text-sm text-green-700 mt-1">
            {totalRooms} rooms will be created for your property
          </p>
        </div>
      </div>
    </div>
  );

  const canProceed = () => {
    switch (step) {
      case 1:
        return Object.keys(config.roomTypes).length > 0;
      case 2:
        return config.startingNumber > 0;
      case 3:
        return true;
      case 4:
        return true;
      default:
        return false;
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      {renderStepIndicator()}

      {/* Progress Summary - Show selected room types */}
      {Object.keys(config.roomTypes).length > 0 && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <span className="text-sm font-medium text-green-800">
              {Object.keys(config.roomTypes).length} room type(s) selected: {Object.keys(config.roomTypes).join(', ')}
            </span>
          </div>
        </div>
      )}

      <div className="min-h-[400px] max-h-[500px] overflow-y-auto">
        {step === 1 && renderStep1()}
        {step === 2 && renderStep2()}
        {step === 3 && renderStep3()}
        {step === 4 && renderStep4()}
      </div>

      {/* Fixed Navigation Bar */}
      <div className="sticky bottom-0 bg-white border-t border-gray-200 mt-6 pt-4">
        <div className="flex justify-between items-center">
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onCancel();
              }}
            >
              Cancel
            </Button>
            {step > 1 && (
              <Button
                type="button"
                variant="outline"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setStep(step - 1);
                }}
              >
                Previous
              </Button>
            )}
          </div>

          <div className="flex items-center gap-3">
            {/* Progress feedback */}
            {step === 1 && Object.keys(config.roomTypes).length === 0 && (
              <span className="text-sm text-gray-500">Select room types to continue</span>
            )}
            {step === 1 && Object.keys(config.roomTypes).length > 0 && (
              <span className="text-sm text-green-600">✓ Ready to proceed</span>
            )}

            {step < 4 ? (
              <Button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setStep(step + 1);
                }}
                disabled={!canProceed()}
                className="bg-blue-600 text-white disabled:bg-gray-300"
              >
                Next
              </Button>
            ) : (
              <Button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onComplete(config);
                }}
                className="bg-green-600 text-white"
              >
                Complete Setup
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};