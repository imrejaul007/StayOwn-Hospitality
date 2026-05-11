import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Phone, Plus, Trash2, Save, X } from 'lucide-react';
import { api } from '../../services/api';
import { withErrorBoundary } from '../ErrorBoundary';

interface PhoneExtension {
  _id?: string;
  extensionNumber: string;
  displayName: string;
  description?: string;
  phoneType: string;
  phoneModel?: string;
  roomId?: string;
  features: string[];
  location: {
    floor?: number;
    wing?: string;
    area?: string;
    coordinates?: {
      x?: number;
      y?: number;
    };
  };
  status: string;
  isAvailable: boolean;
  callSettings: {
    allowOutgoingCalls: boolean;
    allowInternationalCalls: boolean;
    allowLongDistanceCalls: boolean;
    restrictedNumbers: Array<{
      number: string;
      reason: string;
    }>;
    speedDialNumbers: Array<{
      label: string;
      number: string;
      position: number;
    }>;
  };
  directorySettings: {
    showInDirectory: boolean;
    publicListing: boolean;
    category: string;
    sortOrder: number;
  };
  integrationSettings: {
    pbxId?: string;
    sipAddress?: string;
    macAddress?: string;
    ipAddress?: string;
    firmwareVersion?: string;
  };
  notes?: string;
  internalNotes?: string;
}

interface Room {
  _id: string;
  roomNumber: string;
  floor: number;
  roomType: string;
}

interface PhoneExtensionFormProps {
  extension?: PhoneExtension | null;
  onClose: () => void;
  onSuccess: () => void;
}

const PhoneExtensionForm: React.FC<PhoneExtensionFormProps> = ({ 
  extension, 
  onClose, 
  onSuccess 
}) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // Available options
  const [options, setOptions] = useState<{
    phoneTypes: string[];
    statuses: string[];
    categories: string[];
    features: string[];
  } | null>(null);
  
  const [rooms, setRooms] = useState<Room[]>([]);
  
  // Form data
  const [formData, setFormData] = useState<PhoneExtension>({
    extensionNumber: '',
    displayName: '',
    description: '',
    phoneType: 'room_phone',
    phoneModel: '',
    roomId: '',
    features: [],
    location: {
      floor: undefined,
      wing: '',
      area: '',
      coordinates: {
        x: undefined,
        y: undefined
      }
    },
    status: 'active',
    isAvailable: true,
    callSettings: {
      allowOutgoingCalls: true,
      allowInternationalCalls: false,
      allowLongDistanceCalls: false,
      restrictedNumbers: [],
      speedDialNumbers: []
    },
    directorySettings: {
      showInDirectory: true,
      publicListing: true,
      category: 'guest_rooms',
      sortOrder: 0
    },
    integrationSettings: {
      pbxId: '',
      sipAddress: '',
      macAddress: '',
      ipAddress: '',
      firmwareVersion: ''
    },
    notes: '',
    internalNotes: ''
  });

  // Form state
  const [activeTab, setActiveTab] = useState('basic');

  useEffect(() => {
    fetchOptions();
    fetchRooms();
    
    if (extension) {
      setFormData({
        ...extension,
        location: extension.location || {
          floor: undefined,
          wing: '',
          area: '',
          coordinates: { x: undefined, y: undefined }
        },
        callSettings: extension.callSettings || {
          allowOutgoingCalls: true,
          allowInternationalCalls: false,
          allowLongDistanceCalls: false,
          restrictedNumbers: [],
          speedDialNumbers: []
        },
        directorySettings: extension.directorySettings || {
          showInDirectory: true,
          publicListing: true,
          category: 'guest_rooms',
          sortOrder: 0
        },
        integrationSettings: extension.integrationSettings || {
          pbxId: '',
          sipAddress: '',
          macAddress: '',
          ipAddress: '',
          firmwareVersion: ''
        }
      });
    }
  }, [extension]);

  const fetchOptions = async () => {
    try {
      const { data: data } = await api.get('/phone-extensions/options');
      {
        setOptions(data.data);
      }
    } catch {
      // Error handled silently
    }
  };

  const fetchRooms = async () => {
    try {
      const hotelId = localStorage.getItem('currentHotelId') || 'default-hotel-id';
      const { data: data } = await api.get(`/rooms/hotels/${hotelId}`);
      {
        setRooms(data.data?.rooms || []);
      }
    } catch {
      // Error handled silently
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const hotelId = localStorage.getItem('currentHotelId') || 'default-hotel-id';

      // Clean up form data
      const submitData = {
        ...formData,
        roomId: formData.roomId || undefined,
        location: {
          ...formData.location,
          floor: formData.location.floor || undefined,
          coordinates: {
            x: formData.location.coordinates?.x || undefined,
            y: formData.location.coordinates?.y || undefined
          }
        }
      };

      const url = extension
        ? `/api/v1/phone-extensions/${extension._id}`
        : `/api/v1/phone-extensions/hotels/${hotelId}`;

      const method = extension ? 'PUT' : 'POST';

      const { data: result } = extension
        ? await api.put(`/phone-extensions/${extension._id}`, submitData)
        : await api.post(`/phone-extensions/hotels/${hotelId}`, submitData);

      toast({
        title: 'Success',
        description: result.message || `Phone extension ${extension ? 'updated' : 'created'} successfully`
      });
      onSuccess();
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to save phone extension',
        variant: 'destructive'
      });
    } finally {
      setSaving(false);
    }
  };

  const handleFeatureToggle = (feature: string) => {
    setFormData(prev => ({
      ...prev,
      features: prev.features.includes(feature)
        ? prev.features.filter(f => f !== feature)
        : [...prev.features, feature]
    }));
  };

  const handleAddRestrictedNumber = () => {
    setFormData(prev => ({
      ...prev,
      callSettings: {
        ...prev.callSettings,
        restrictedNumbers: [
          ...prev.callSettings.restrictedNumbers,
          { number: '', reason: '' }
        ]
      }
    }));
  };

  const handleRemoveRestrictedNumber = (index: number) => {
    setFormData(prev => ({
      ...prev,
      callSettings: {
        ...prev.callSettings,
        restrictedNumbers: prev.callSettings.restrictedNumbers.filter((_, i) => i !== index)
      }
    }));
  };

  const handleAddSpeedDial = () => {
    const nextPosition = Math.max(
      0,
      ...formData.callSettings.speedDialNumbers.map(sd => sd.position)
    ) + 1;

    setFormData(prev => ({
      ...prev,
      callSettings: {
        ...prev.callSettings,
        speedDialNumbers: [
          ...prev.callSettings.speedDialNumbers,
          { label: '', number: '', position: nextPosition }
        ]
      }
    }));
  };

  const handleRemoveSpeedDial = (index: number) => {
    setFormData(prev => ({
      ...prev,
      callSettings: {
        ...prev.callSettings,
        speedDialNumbers: prev.callSettings.speedDialNumbers.filter((_, i) => i !== index)
      }
    }));
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Phone className="w-5 h-5" />
            {extension ? 'Edit Phone Extension' : 'Add Phone Extension'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid grid-cols-5 w-full">
              <TabsTrigger value="basic">Basic</TabsTrigger>
              <TabsTrigger value="location">Location</TabsTrigger>
              <TabsTrigger value="calls">Call Settings</TabsTrigger>
              <TabsTrigger value="directory">Directory</TabsTrigger>
              <TabsTrigger value="technical">Technical</TabsTrigger>
            </TabsList>

            <TabsContent value="basic" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="extensionNumber">Extension Number *</Label>
                  <Input
                    id="extensionNumber"
                    value={formData.extensionNumber}
                    onChange={(e) => setFormData(prev => ({ 
                      ...prev, 
                      extensionNumber: e.target.value 
                    }))}
                    placeholder="e.g., 1001"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="displayName">Display Name *</Label>
                  <Input
                    id="displayName"
                    value={formData.displayName}
                    onChange={(e) => setFormData(prev => ({ 
                      ...prev, 
                      displayName: e.target.value 
                    }))}
                    placeholder="e.g., Room 101 Phone"
                    required
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description || ''}
                  onChange={(e) => setFormData(prev => ({ 
                    ...prev, 
                    description: e.target.value 
                  }))}
                  placeholder="Optional description..."
                  rows={2}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="phoneType">Phone Type *</Label>
                  <Select
                    value={formData.phoneType}
                    onValueChange={(value) => setFormData(prev => ({ 
                      ...prev, 
                      phoneType: value 
                    }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {options?.phoneTypes.map(type => (
                        <SelectItem key={type} value={type}>
                          {type.replace('_', ' ')}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="phoneModel">Phone Model</Label>
                  <Input
                    id="phoneModel"
                    value={formData.phoneModel || ''}
                    onChange={(e) => setFormData(prev => ({ 
                      ...prev, 
                      phoneModel: e.target.value 
                    }))}
                    placeholder="e.g., Cisco 7941"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="status">Status</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(value) => setFormData(prev => ({ 
                      ...prev, 
                      status: value 
                    }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {options?.statuses.map(status => (
                        <SelectItem key={status} value={status}>
                          {status.replace('_', ' ')}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="roomId">Assigned Room</Label>
                  <Select
                    value={formData.roomId || ''}
                    onValueChange={(value) => setFormData(prev => ({ 
                      ...prev, 
                      roomId: value || undefined 
                    }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select room (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">No room assigned</SelectItem>
                      {rooms.map(room => (
                        <SelectItem key={room._id} value={room._id}>
                          {room.roomNumber} - Floor {room.floor}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="isAvailable"
                  checked={formData.isAvailable}
                  onCheckedChange={(checked) => setFormData(prev => ({ 
                    ...prev, 
                    isAvailable: checked 
                  }))}
                />
                <Label htmlFor="isAvailable">Extension is available for use</Label>
              </div>

              <div>
                <Label>Phone Features</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {options?.features.map(feature => (
                    <Badge
                      key={feature}
                      variant={formData.features.includes(feature) ? "default" : "outline"}
                      className="cursor-pointer"
                      onClick={() => handleFeatureToggle(feature)}
                    >
                      {feature.replace('_', ' ')}
                    </Badge>
                  ))}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="location" className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="floor">Floor</Label>
                  <Input
                    id="floor"
                    type="number"
                    value={formData.location.floor || ''}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      location: {
                        ...prev.location,
                        floor: e.target.value ? parseInt(e.target.value) : undefined
                      }
                    }))}
                    placeholder="e.g., 1"
                  />
                </div>

                <div>
                  <Label htmlFor="wing">Wing</Label>
                  <Input
                    id="wing"
                    value={formData.location.wing || ''}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      location: {
                        ...prev.location,
                        wing: e.target.value
                      }
                    }))}
                    placeholder="e.g., North Wing"
                  />
                </div>

                <div>
                  <Label htmlFor="area">Area</Label>
                  <Input
                    id="area"
                    value={formData.location.area || ''}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      location: {
                        ...prev.location,
                        area: e.target.value
                      }
                    }))}
                    placeholder="e.g., Lobby"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="coordinateX">Coordinate X</Label>
                  <Input
                    id="coordinateX"
                    type="number"
                    value={formData.location.coordinates?.x || ''}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      location: {
                        ...prev.location,
                        coordinates: {
                          ...prev.location.coordinates,
                          x: e.target.value ? parseFloat(e.target.value) : undefined
                        }
                      }
                    }))}
                    placeholder="X coordinate"
                  />
                </div>

                <div>
                  <Label htmlFor="coordinateY">Coordinate Y</Label>
                  <Input
                    id="coordinateY"
                    type="number"
                    value={formData.location.coordinates?.y || ''}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      location: {
                        ...prev.location,
                        coordinates: {
                          ...prev.location.coordinates,
                          y: e.target.value ? parseFloat(e.target.value) : undefined
                        }
                      }
                    }))}
                    placeholder="Y coordinate"
                  />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="calls" className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="flex items-center space-x-2">
                  <Switch
                    id="allowOutgoing"
                    checked={formData.callSettings.allowOutgoingCalls}
                    onCheckedChange={(checked) => setFormData(prev => ({
                      ...prev,
                      callSettings: {
                        ...prev.callSettings,
                        allowOutgoingCalls: checked
                      }
                    }))}
                  />
                  <Label htmlFor="allowOutgoing">Allow Outgoing Calls</Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    id="allowInternational"
                    checked={formData.callSettings.allowInternationalCalls}
                    onCheckedChange={(checked) => setFormData(prev => ({
                      ...prev,
                      callSettings: {
                        ...prev.callSettings,
                        allowInternationalCalls: checked
                      }
                    }))}
                  />
                  <Label htmlFor="allowInternational">International Calls</Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    id="allowLongDistance"
                    checked={formData.callSettings.allowLongDistanceCalls}
                    onCheckedChange={(checked) => setFormData(prev => ({
                      ...prev,
                      callSettings: {
                        ...prev.callSettings,
                        allowLongDistanceCalls: checked
                      }
                    }))}
                  />
                  <Label htmlFor="allowLongDistance">Long Distance</Label>
                </div>
              </div>

              {/* Speed Dial Numbers */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label>Speed Dial Numbers</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleAddSpeedDial}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Speed Dial
                  </Button>
                </div>

                <div className="space-y-2">
                  {formData.callSettings.speedDialNumbers.map((speedDial, index) => (
                    <div key={`formData-callSettings-speedDialNumbers-${index}-${speedDial.label}`} className="flex gap-2 items-center">
                      <Input
                        placeholder="Position"
                        type="number"
                        value={speedDial.position}
                        onChange={(e) => {
                          const newSpeedDials = [...formData.callSettings.speedDialNumbers];
                          newSpeedDials[index].position = parseInt(e.target.value) || 1;
                          setFormData(prev => ({
                            ...prev,
                            callSettings: {
                              ...prev.callSettings,
                              speedDialNumbers: newSpeedDials
                            }
                          }));
                        }}
                        className="w-20"
                      />
                      <Input
                        placeholder="Label"
                        value={speedDial.label}
                        onChange={(e) => {
                          const newSpeedDials = [...formData.callSettings.speedDialNumbers];
                          newSpeedDials[index].label = e.target.value;
                          setFormData(prev => ({
                            ...prev,
                            callSettings: {
                              ...prev.callSettings,
                              speedDialNumbers: newSpeedDials
                            }
                          }));
                        }}
                        className="flex-1"
                      />
                      <Input
                        placeholder="Number"
                        value={speedDial.number}
                        onChange={(e) => {
                          const newSpeedDials = [...formData.callSettings.speedDialNumbers];
                          newSpeedDials[index].number = e.target.value;
                          setFormData(prev => ({
                            ...prev,
                            callSettings: {
                              ...prev.callSettings,
                              speedDialNumbers: newSpeedDials
                            }
                          }));
                        }}
                        className="flex-1"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveSpeedDial(index)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="directory" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center space-x-2">
                  <Switch
                    id="showInDirectory"
                    checked={formData.directorySettings.showInDirectory}
                    onCheckedChange={(checked) => setFormData(prev => ({
                      ...prev,
                      directorySettings: {
                        ...prev.directorySettings,
                        showInDirectory: checked
                      }
                    }))}
                  />
                  <Label htmlFor="showInDirectory">Show in Directory</Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    id="publicListing"
                    checked={formData.directorySettings.publicListing}
                    onCheckedChange={(checked) => setFormData(prev => ({
                      ...prev,
                      directorySettings: {
                        ...prev.directorySettings,
                        publicListing: checked
                      }
                    }))}
                  />
                  <Label htmlFor="publicListing">Public Listing</Label>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="category">Directory Category</Label>
                  <Select
                    value={formData.directorySettings.category}
                    onValueChange={(value) => setFormData(prev => ({
                      ...prev,
                      directorySettings: {
                        ...prev.directorySettings,
                        category: value
                      }
                    }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {options?.categories.map(category => (
                        <SelectItem key={category} value={category}>
                          {category.replace('_', ' ')}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="sortOrder">Sort Order</Label>
                  <Input
                    id="sortOrder"
                    type="number"
                    value={formData.directorySettings.sortOrder}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      directorySettings: {
                        ...prev.directorySettings,
                        sortOrder: parseInt(e.target.value) || 0
                      }
                    }))}
                    placeholder="0"
                  />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="technical" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="pbxId">PBX ID</Label>
                  <Input
                    id="pbxId"
                    value={formData.integrationSettings.pbxId || ''}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      integrationSettings: {
                        ...prev.integrationSettings,
                        pbxId: e.target.value
                      }
                    }))}
                    placeholder="PBX system ID"
                  />
                </div>

                <div>
                  <Label htmlFor="sipAddress">SIP Address</Label>
                  <Input
                    id="sipAddress"
                    value={formData.integrationSettings.sipAddress || ''}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      integrationSettings: {
                        ...prev.integrationSettings,
                        sipAddress: e.target.value
                      }
                    }))}
                    placeholder="SIP address"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="macAddress">MAC Address</Label>
                  <Input
                    id="macAddress"
                    value={formData.integrationSettings.macAddress || ''}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      integrationSettings: {
                        ...prev.integrationSettings,
                        macAddress: e.target.value
                      }
                    }))}
                    placeholder="00:00:00:00:00:00"
                  />
                </div>

                <div>
                  <Label htmlFor="ipAddress">IP Address</Label>
                  <Input
                    id="ipAddress"
                    value={formData.integrationSettings.ipAddress || ''}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      integrationSettings: {
                        ...prev.integrationSettings,
                        ipAddress: e.target.value
                      }
                    }))}
                    placeholder="192.168.1.100"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="firmwareVersion">Firmware Version</Label>
                <Input
                  id="firmwareVersion"
                  value={formData.integrationSettings.firmwareVersion || ''}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    integrationSettings: {
                      ...prev.integrationSettings,
                      firmwareVersion: e.target.value
                    }
                  }))}
                  placeholder="v1.0.0"
                />
              </div>

              <div>
                <Label htmlFor="notes">Public Notes</Label>
                <Textarea
                  id="notes"
                  value={formData.notes || ''}
                  onChange={(e) => setFormData(prev => ({ 
                    ...prev, 
                    notes: e.target.value 
                  }))}
                  placeholder="Public notes visible to staff..."
                  rows={3}
                />
              </div>

              <div>
                <Label htmlFor="internalNotes">Internal Notes</Label>
                <Textarea
                  id="internalNotes"
                  value={formData.internalNotes || ''}
                  onChange={(e) => setFormData(prev => ({ 
                    ...prev, 
                    internalNotes: e.target.value 
                  }))}
                  placeholder="Internal notes for technical staff..."
                  rows={3}
                />
              </div>
            </TabsContent>
          </Tabs>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button type="button" variant="outline" onClick={onClose}>
              <X className="w-4 h-4 mr-2" />
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? (
                'Saving...'
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  {extension ? 'Update Extension' : 'Create Extension'}
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default withErrorBoundary(PhoneExtensionForm, { level: 'component' });