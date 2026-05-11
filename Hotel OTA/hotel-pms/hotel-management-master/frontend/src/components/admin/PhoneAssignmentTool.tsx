import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { 
  Building, 
  Phone, 
  Search, 
  RefreshCw, 
  CheckCircle,
  XCircle,
  AlertTriangle,
  Zap
} from 'lucide-react';
import { DataTable } from '@/components/ui/data-table';
import { api } from '../../services/api';

interface PhoneExtension {
  _id: string;
  extensionNumber: string;
  displayName: string;
  phoneType: string;
  status: string;
  roomId?: string;
  roomNumber?: string;
}

interface Room {
  _id: string;
  roomNumber: string;
  floor: number;
  roomType: string;
  status: string;
  hasExtension?: boolean;
  currentExtension?: {
    _id: string;
    extensionNumber: string;
  };
}

interface Assignment {
  extensionId: string;
  roomId: string | null;
  extensionNumber: string;
  roomNumber?: string;
}

interface PhoneAssignmentToolProps {
  onClose: () => void;
  onSuccess: () => void;
}

const PhoneAssignmentTool: React.FC<PhoneAssignmentToolProps> = ({ onClose, onSuccess }) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // Data
  const [unassignedExtensions, setUnassignedExtensions] = useState<PhoneExtension[]>([]);
  const [availableRooms, setAvailableRooms] = useState<Room[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  
  // Filters
  const [extensionSearch, setExtensionSearch] = useState('');
  const [roomSearch, setRoomSearch] = useState('');
  const [floorFilter, setFloorFilter] = useState('');
  const [phoneTypeFilter, setPhoneTypeFilter] = useState('');
  
  // UI State
  const [activeTab, setActiveTab] = useState('manual');
  const [autoAssignPattern, setAutoAssignPattern] = useState('room_number');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const hotelId = localStorage.getItem('currentHotelId') || 'default-hotel-id';

      // Fetch unassigned extensions
      const [extensionsResponse, roomsResponse] = await Promise.all([
        api.get(`/phone-extensions/hotels/${hotelId}?phoneType=room_phone&roomId=null&status=active`),
        api.get(`/rooms/hotels/${hotelId}`)
      ]);

      const extensionsData = extensionsResponse.data;
      const roomsData = roomsResponse.data;

      setUnassignedExtensions(extensionsData.data?.extensions || []);

      // Process rooms to show extension status
      const rooms = (roomsData.data?.rooms || []).map((room: Record<string, unknown>) => ({
        ...room,
        hasExtension: Boolean(room.phoneExtensions && room.phoneExtensions.length > 0),
        currentExtension: room.phoneExtensions?.[0]
      }));

      setAvailableRooms(rooms);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to fetch extensions and rooms data',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleManualAssignment = (extensionId: string, roomId: string | null) => {
    const extension = unassignedExtensions.find(ext => ext._id === extensionId);
    const room = roomId ? availableRooms.find(r => r._id === roomId) : null;

    if (!extension) return;

    const existingIndex = assignments.findIndex(a => a.extensionId === extensionId);
    const newAssignment: Assignment = {
      extensionId,
      roomId,
      extensionNumber: extension.extensionNumber,
      roomNumber: room?.roomNumber
    };

    if (existingIndex >= 0) {
      const newAssignments = [...assignments];
      newAssignments[existingIndex] = newAssignment;
      setAssignments(newAssignments);
    } else {
      setAssignments([...assignments, newAssignment]);
    }
  };

  const handleRemoveAssignment = (extensionId: string) => {
    setAssignments(assignments.filter(a => a.extensionId !== extensionId));
  };

  const handleAutoAssign = async () => {
    setLoading(true);
    try {
      const hotelId = localStorage.getItem('currentHotelId') || 'default-hotel-id';

      const { data: result } = await api.post(`/phone-extensions/hotels/${hotelId}/auto-assign`, {
        pattern: autoAssignPattern
      });
      toast({
        title: 'Auto Assignment Complete',
        description: `Successfully assigned ${result.data.successCount} extensions`
      });

      // Refresh data and close
      await fetchData();
      onSuccess();
      onClose();
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Auto assignment failed',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveAssignments = async () => {
    if (assignments.length === 0) {
      toast({
        title: 'Warning',
        description: 'No assignments to save',
        variant: 'destructive'
      });
      return;
    }

    setSaving(true);
    try {
      const hotelId = localStorage.getItem('currentHotelId') || 'default-hotel-id';

      const { data: result } = await api.patch(`/phone-extensions/hotels/${hotelId}/bulk-assign`, {
        assignments: assignments.map(a => ({
          extensionId: a.extensionId,
          roomId: a.roomId
        }))
      });
      toast({
        title: 'Success',
        description: `Successfully assigned ${result.data.successCount} extensions`
      });

      if (result.data.failureCount > 0) {
        toast({
          title: 'Partial Success',
          description: `${result.data.failureCount} assignments failed`,
          variant: 'destructive'
        });
      }

      onSuccess();
      onClose();
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to save assignments',
        variant: 'destructive'
      });
    } finally {
      setSaving(false);
    }
  };

  const getExtensionAssignment = (extensionId: string) => {
    return assignments.find(a => a.extensionId === extensionId);
  };

  const filteredExtensions = unassignedExtensions.filter(ext => {
    const matchesSearch = !extensionSearch || 
      ext.extensionNumber.toLowerCase().includes(extensionSearch.toLowerCase()) ||
      ext.displayName.toLowerCase().includes(extensionSearch.toLowerCase());
    
    const matchesType = !phoneTypeFilter || ext.phoneType === phoneTypeFilter;
    
    return matchesSearch && matchesType;
  });

  const filteredRooms = availableRooms.filter(room => {
    const matchesSearch = !roomSearch || 
      room.roomNumber.toLowerCase().includes(roomSearch.toLowerCase());
    
    const matchesFloor = !floorFilter || room.floor.toString() === floorFilter;
    
    return matchesSearch && matchesFloor;
  });

  const extensionColumns = [
    {
      accessorKey: 'extensionNumber',
      header: 'Extension',
      cell: ({ row }: Record<string, unknown>) => (
        <div className="font-mono font-semibold">
          {row.original.extensionNumber}
        </div>
      )
    },
    {
      accessorKey: 'displayName',
      header: 'Name',
      cell: ({ row }: Record<string, unknown>) => (
        <div className="font-medium">{row.original.displayName}</div>
      )
    },
    {
      accessorKey: 'phoneType',
      header: 'Type',
      cell: ({ row }: Record<string, unknown>) => (
        <Badge variant="outline">
          {row.original.phoneType.replace('_', ' ')}
        </Badge>
      )
    },
    {
      accessorKey: 'assignment',
      header: 'Assignment',
      cell: ({ row }: Record<string, unknown>) => {
        const extension = row.original;
        const assignment = getExtensionAssignment(extension._id);
        
        return (
          <div className="flex items-center gap-2">
            <Select
              value={assignment?.roomId || 'unassigned'}
              onValueChange={(value) => 
                handleManualAssignment(extension._id, value === 'unassigned' ? null : value)
              }
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Select room..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unassigned">
                  <span className="text-muted-foreground">Unassigned</span>
                </SelectItem>
                {filteredRooms.map(room => (
                  <SelectItem key={room._id} value={room._id}>
                    <div className="flex items-center gap-2">
                      <span>{room.roomNumber}</span>
                      {room.hasExtension && (
                        <Badge variant="secondary" className="text-xs">
                          Has Extension
                        </Badge>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            {assignment && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleRemoveAssignment(extension._id)}
              >
                <XCircle className="w-4 h-4 text-red-500" />
              </Button>
            )}
          </div>
        );
      }
    }
  ];

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building className="w-5 h-5" />
            Phone Assignment Tool
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="manual">Manual Assignment</TabsTrigger>
            <TabsTrigger value="auto">Auto Assignment</TabsTrigger>
          </TabsList>

          <TabsContent value="manual" className="space-y-4">
            {/* Summary */}
            <div className="grid grid-cols-3 gap-4">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center space-x-2">
                    <Phone className="w-4 h-4 text-blue-600" />
                    <div>
                      <p className="text-sm font-medium">Unassigned Extensions</p>
                      <p className="text-2xl font-bold">{unassignedExtensions.length}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center space-x-2">
                    <Building className="w-4 h-4 text-green-600" />
                    <div>
                      <p className="text-sm font-medium">Available Rooms</p>
                      <p className="text-2xl font-bold">{availableRooms.length}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center space-x-2">
                    <CheckCircle className="w-4 h-4 text-purple-600" />
                    <div>
                      <p className="text-sm font-medium">Pending Assignments</p>
                      <p className="text-2xl font-bold">{assignments.length}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Filters */}
            <Card>
              <CardContent className="p-4">
                <div className="flex flex-wrap gap-4">
                  <Input
                    placeholder="Search extensions..."
                    value={extensionSearch}
                    onChange={(e) => setExtensionSearch(e.target.value)}
                    className="max-w-sm"
                  />
                  
                  <Input
                    placeholder="Search rooms..."
                    value={roomSearch}
                    onChange={(e) => setRoomSearch(e.target.value)}
                    className="max-w-sm"
                  />
                  
                  <Select value={floorFilter} onValueChange={setFloorFilter}>
                    <SelectTrigger className="w-[150px]">
                      <SelectValue placeholder="Floor" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">All Floors</SelectItem>
                      {Array.from(new Set(availableRooms.map(r => r.floor.toString()))).map(floor => (
                        <SelectItem key={floor} value={floor}>
                          Floor {floor}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Button
                    variant="outline"
                    onClick={fetchData}
                    disabled={loading}
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Refresh
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Extensions Table */}
            <Card>
              <CardHeader>
                <CardTitle>Extensions Assignment</CardTitle>
                <CardDescription>
                  Manually assign extensions to rooms
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <DataTable
                  columns={extensionColumns}
                  data={filteredExtensions}
                  loading={loading}
                />
              </CardContent>
            </Card>

            {/* Pending Assignments Summary */}
            {assignments.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Pending Assignments ({assignments.length})</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {assignments.map(assignment => (
                      <div
                        key={assignment.extensionId}
                        className="flex items-center justify-between p-2 bg-muted rounded"
                      >
                        <div>
                          <span className="font-mono font-medium">
                            {assignment.extensionNumber}
                          </span>
                          <span className="mx-2">→</span>
                          <span className="font-medium">
                            {assignment.roomNumber || 'Unassigned'}
                          </span>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveAssignment(assignment.extensionId)}
                        >
                          <XCircle className="w-4 h-4 text-red-500" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="auto" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="w-5 h-5" />
                  Automatic Assignment
                </CardTitle>
                <CardDescription>
                  Automatically assign extensions to rooms based on patterns
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">
                    Assignment Pattern
                  </label>
                  <Select value={autoAssignPattern} onValueChange={setAutoAssignPattern}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="room_number">
                        Match extension number to room number
                      </SelectItem>
                      <SelectItem value="sequential">
                        Assign sequentially (first extension to first room)
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="p-4 bg-muted rounded-lg">
                  <h4 className="font-medium mb-2">Pattern Preview</h4>
                  {autoAssignPattern === 'room_number' ? (
                    <div className="text-sm text-muted-foreground">
                      <p>• Extension "101" will be assigned to room "101"</p>
                      <p>• Extension "1001" will be assigned to room "101"</p>
                      <p>• Extensions without matching rooms will remain unassigned</p>
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground">
                      <p>• Extensions will be assigned to rooms in order</p>
                      <p>• First available extension → First available room</p>
                      <p>• Continues until all extensions or rooms are assigned</p>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <AlertTriangle className="w-4 h-4 text-yellow-600" />
                  <div className="text-sm text-yellow-700">
                    <p className="font-medium">Warning:</p>
                    <p>This will automatically assign extensions and cannot be undone easily.</p>
                  </div>
                </div>

                <Button
                  onClick={handleAutoAssign}
                  disabled={loading}
                  className="w-full"
                >
                  {loading ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Zap className="w-4 h-4 mr-2" />
                      Run Auto Assignment
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Footer Actions */}
        <div className="flex justify-between items-center pt-4 border-t">
          <div className="text-sm text-muted-foreground">
            {assignments.length > 0 && `${assignments.length} assignments ready to save`}
          </div>
          
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            {activeTab === 'manual' && assignments.length > 0 && (
              <Button
                onClick={handleSaveAssignments}
                disabled={saving}
              >
                {saving ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Save Assignments
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PhoneAssignmentTool;