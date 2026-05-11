import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { api } from '@/services/api';
import {
  QrCode,
  Download,
  Printer,
  RefreshCw,
  Loader2,
  Search,
  Plus,
  Grid3X3,
  List,
  CheckCircle,
  XCircle,
  Calendar,
  Building,
  Copy,
  ExternalLink
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { withErrorBoundary } from '@/components/ErrorBoundary';
import { formatDate } from '@/utils/formatters';
import PageWrapper from '@/components/PageWrapper';

interface Room {
  roomId: string;
  roomNumber: string;
  roomType: string;
  floor: number;
  status: string;
  hasActiveGuest: boolean;
  currentGuest?: {
    name: string;
    checkOut: string;
  };
}

interface GeneratedQR {
  roomId: string;
  roomNumber: string;
  roomType: string;
  floor: number;
  qrCode: string;
  url: string;
}

const AdminRoomQRManagement: React.FC = () => {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [generatingAll, setGeneratingAll] = useState(false);
  const [generatedQRCodes, setGeneratedQRCodes] = useState<GeneratedQR[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRoom, setSelectedRoom] = useState<string | null>(null);
  const [validityDays, setValidityDays] = useState(30);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [activeTab, setActiveTab] = useState('rooms');

  const fetchRooms = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.get('/room-qr', {
        params: { limit: 100 }
      });
      const data = response.data?.data;
      setRooms(data?.rooms || []);
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Failed to fetch rooms');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRooms();
  }, [fetchRooms]);

  const generateSingleQR = async (roomId: string) => {
    setGenerating(true);
    setSelectedRoom(roomId);
    try {
      const response = await api.post('/room-qr/generate', {
        roomId,
        validUntil: new Date(Date.now() + validityDays * 24 * 60 * 60 * 1000).toISOString()
      });

      const qrData = response.data?.data;
      if (qrData) {
        setGeneratedQRCodes(prev => {
          const filtered = prev.filter(qr => qr.roomId !== roomId);
          return [...filtered, {
            roomId: qrData.roomId,
            roomNumber: qrData.roomNumber,
            roomType: qrData.roomType,
            floor: qrData.floor,
            qrCode: qrData.qrCode,
            url: qrData.url
          }];
        });
        toast.success(`QR code generated for Room ${qrData.roomNumber}`);
      }
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Failed to generate QR code');
    } finally {
      setGenerating(false);
      setSelectedRoom(null);
    }
  };

  const generateAllQRCodes = async () => {
    setGeneratingAll(true);
    try {
      const response = await api.post('/room-qr/generate-all', {
        validUntil: new Date(Date.now() + validityDays * 24 * 60 * 60 * 1000).toISOString()
      });

      const data = response.data?.data;
      if (data?.rooms) {
        setGeneratedQRCodes(data.rooms.map((qr: any) => ({
          roomId: qr.roomId,
          roomNumber: qr.roomNumber,
          roomType: qr.roomType,
          floor: qr.floor,
          qrCode: qr.qrCode,
          url: qr.url
        })));
        toast.success(`Generated ${data.count} QR codes`);
        setActiveTab('generated');
      }
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Failed to generate QR codes');
    } finally {
      setGeneratingAll(false);
    }
  };

  const downloadQRCode = (qr: GeneratedQR) => {
    const link = document.createElement('a');
    link.href = qr.qrCode;
    link.download = `room-${qr.roomNumber}-qr.png`;
    link.click();
  };

  const copyURL = (url: string) => {
    navigator.clipboard.writeText(url);
    toast.success('URL copied to clipboard');
  };

  const printAllQRCodes = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const html = generatedQRCodes.map(qr => `
      <div style="width: 3in; height: 4in; padding: 10px; border: 1px solid #ccc; margin: 10px; text-align: center; page-break-inside: avoid;">
        <h3 style="margin: 5px 0;">Room ${qr.roomNumber}</h3>
        <p style="margin: 5px 0; color: #666;">${qr.roomType} - Floor ${qr.floor}</p>
        <img src="${qr.qrCode}" style="width: 200px; height: 200px; margin: 10px 0;" />
        <p style="font-size: 12px; color: #888;">Scan for room services</p>
      </div>
    `).join('');

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Room QR Codes</title>
          <style>
            body { font-family: Arial, sans-serif; display: flex; flex-wrap: wrap; justify-content: center; }
            @media print { .qr-card { page-break-inside: avoid; } }
          </style>
        </head>
        <body>${html}</body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  const filteredRooms = rooms.filter(room =>
    room.roomNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
    room.roomType?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getRoomStatusBadge = (room: Room) => {
    if (room.hasActiveGuest) {
      return <Badge className="bg-green-100 text-green-800">Occupied</Badge>;
    }
    return <Badge className="bg-gray-100 text-gray-800">Vacant</Badge>;
  };

  const hasGeneratedQR = (roomId: string) =>
    generatedQRCodes.some(qr => qr.roomId === roomId);

  return (
    <PageWrapper>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <QrCode className="h-8 w-8 text-blue-600" />
              Room QR Code Management
            </h1>
            <p className="text-gray-500 mt-1">
              Generate QR codes for rooms to enable guest room service access
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500">Valid for:</span>
              <Select value={validityDays.toString()} onValueChange={(v) => setValidityDays(parseInt(v))}>
                <SelectTrigger className="w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">7 days</SelectItem>
                  <SelectItem value="30">30 days</SelectItem>
                  <SelectItem value="90">90 days</SelectItem>
                  <SelectItem value="365">1 year</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              variant="outline"
              onClick={generateAllQRCodes}
              disabled={generatingAll || rooms.length === 0}
            >
              {generatingAll ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Plus className="h-4 w-4 mr-2" />
              )}
              Generate All QR Codes
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="rooms">Rooms</TabsTrigger>
            <TabsTrigger value="generated">
              Generated ({generatedQRCodes.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="rooms" className="space-y-4">
            {/* Search and Filter */}
            <div className="flex items-center gap-4">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search rooms..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant={viewMode === 'grid' ? 'default' : 'outline'}
                  size="icon"
                  onClick={() => setViewMode('grid')}
                >
                  <Grid3X3 className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === 'list' ? 'default' : 'outline'}
                  size="icon"
                  onClick={() => setViewMode('list')}
                >
                  <List className="h-4 w-4" />
                </Button>
              </div>
              <Button variant="outline" onClick={fetchRooms}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
            </div>

            {/* Rooms Grid/List */}
            {loading ? (
              <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
              </div>
            ) : viewMode === 'grid' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filteredRooms.map(room => {
                  const hasQR = hasGeneratedQR(room.roomId);
                  const isGenerating = selectedRoom === room.roomId;
                  return (
                    <Card key={room.roomId} className={hasQR ? 'border-green-200' : ''}>
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-lg">Room {room.roomNumber}</CardTitle>
                          {getRoomStatusBadge(room)}
                        </div>
                        <CardDescription>
                          {room.roomType} • Floor {room.floor}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {room.hasActiveGuest && room.currentGuest && (
                          <div className="text-sm bg-blue-50 p-2 rounded">
                            <p className="font-medium">{room.currentGuest.name}</p>
                            <p className="text-gray-500">
                              Checkout: {formatDate(room.currentGuest.checkOut)}
                            </p>
                          </div>
                        )}
                        {hasQR ? (
                          <div className="space-y-2">
                            <div className="flex items-center gap-2 text-green-600">
                              <CheckCircle className="h-4 w-4" />
                              <span className="text-sm font-medium">QR Generated</span>
                            </div>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                className="flex-1"
                                onClick={() => {
                                  const qr = generatedQRCodes.find(q => q.roomId === room.roomId);
                                  if (qr) downloadQRCode(qr);
                                }}
                              >
                                <Download className="h-4 w-4 mr-1" />
                                Download
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <Button
                            className="w-full"
                            onClick={() => generateSingleQR(room.roomId)}
                            disabled={generating}
                          >
                            {isGenerating ? (
                              <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            ) : (
                              <QrCode className="h-4 w-4 mr-2" />
                            )}
                            Generate QR Code
                          </Button>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <Card>
                <CardContent className="p-0">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        <th className="text-left p-4 font-medium">Room</th>
                        <th className="text-left p-4 font-medium">Type</th>
                        <th className="text-left p-4 font-medium">Floor</th>
                        <th className="text-left p-4 font-medium">Status</th>
                        <th className="text-left p-4 font-medium">Current Guest</th>
                        <th className="text-left p-4 font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredRooms.map(room => {
                        const hasQR = hasGeneratedQR(room.roomId);
                        const isGenerating = selectedRoom === room.roomId;
                        return (
                          <tr key={room.roomId} className="border-b hover:bg-gray-50">
                            <td className="p-4 font-medium">{room.roomNumber}</td>
                            <td className="p-4">{room.roomType}</td>
                            <td className="p-4">{room.floor}</td>
                            <td className="p-4">{getRoomStatusBadge(room)}</td>
                            <td className="p-4">
                              {room.hasActiveGuest ? room.currentGuest?.name : '-'}
                            </td>
                            <td className="p-4">
                              {hasQR ? (
                                <div className="flex gap-2">
                                  <Button size="sm" variant="outline" onClick={() => {
                                    const qr = generatedQRCodes.find(q => q.roomId === room.roomId);
                                    if (qr) downloadQRCode(qr);
                                  }}>
                                    <Download className="h-4 w-4" />
                                  </Button>
                                </div>
                              ) : (
                                <Button
                                  size="sm"
                                  onClick={() => generateSingleQR(room.roomId)}
                                  disabled={generating}
                                >
                                  {isGenerating ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <QrCode className="h-4 w-4" />
                                  )}
                                </Button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="generated" className="space-y-4">
            {generatedQRCodes.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center h-64">
                  <QrCode className="h-16 w-16 text-gray-300 mb-4" />
                  <p className="text-gray-500 mb-4">No QR codes generated yet</p>
                  <Button onClick={() => setActiveTab('rooms')}>
                    Go to Rooms
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <p className="text-gray-500">
                    {generatedQRCodes.length} QR codes generated
                  </p>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={printAllQRCodes}>
                      <Printer className="h-4 w-4 mr-2" />
                      Print All
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        generatedQRCodes.forEach(qr => downloadQRCode(qr));
                      }}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Download All
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {generatedQRCodes.map(qr => (
                    <Card key={qr.roomId} className="overflow-hidden">
                      <CardHeader className="bg-gradient-to-r from-blue-500 to-purple-600 text-white py-4">
                        <CardTitle className="text-xl">Room {qr.roomNumber}</CardTitle>
                        <CardDescription className="text-blue-100">
                          {qr.roomType} • Floor {qr.floor}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="p-4 space-y-3">
                        <div className="flex justify-center bg-white p-2 rounded-lg">
                          <img
                            src={qr.qrCode}
                            alt={`QR for Room ${qr.roomNumber}`}
                            className="w-48 h-48 object-contain"
                          />
                        </div>
                        <div className="space-y-2">
                          <Button
                            variant="outline"
                            className="w-full"
                            onClick={() => copyURL(qr.url)}
                          >
                            <Copy className="h-4 w-4 mr-2" />
                            Copy URL
                          </Button>
                          <Button
                            variant="outline"
                            className="w-full"
                            onClick={() => downloadQRCode(qr)}
                          >
                            <Download className="h-4 w-4 mr-2" />
                            Download PNG
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </PageWrapper>
  );
};

export default withErrorBoundary(AdminRoomQRManagement, 'AdminRoomQRManagement');
