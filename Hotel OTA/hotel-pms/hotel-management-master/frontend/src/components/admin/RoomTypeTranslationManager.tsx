import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from '@/utils/toast';
import { 
  Globe, 
  Plus, 
  Edit, 
  CheckCircle, 
  Clock, 
  AlertTriangle,
  Loader2,
  Settings,
  Languages
} from 'lucide-react';
import { 
  roomTypeLocalizationService, 
  type LocalizedRoomType, 
  type TranslationProgress 
} from '@/services/roomTypeLocalizationService';

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && error !== null && 'message' in error) return String((error as Record<string, unknown>).message);
  return 'An unexpected error occurred';
};

interface RoomTypeTranslationManagerProps {
  hotelId: string;
}

const RoomTypeTranslationManager: React.FC<RoomTypeTranslationManagerProps> = ({ hotelId }) => {
  const [roomTypes, setRoomTypes] = useState<LocalizedRoomType[]>([]);
  const [availableLanguages, setAvailableLanguages] = useState<Array<{ code: string; name: string; nativeName: string }>>([]);
  const [selectedRoomType, setSelectedRoomType] = useState<LocalizedRoomType | null>(null);
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [isInitializingTranslations, setIsInitializingTranslations] = useState(false);
  const [showBulkDialog, setShowBulkDialog] = useState(false);
  const [selectedRoomTypes, setSelectedRoomTypes] = useState<string[]>([]);

  useEffect(() => {
    loadData();
  }, [hotelId]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [roomTypesResponse, languagesResponse] = await Promise.all([
        roomTypeLocalizationService.getRoomTypesWithTranslationStatus(hotelId),
        roomTypeLocalizationService.getAvailableLanguages()
      ]);
      
      setRoomTypes(roomTypesResponse.data);
      setAvailableLanguages(languagesResponse);
    } catch (error: unknown) {
      toast.error(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const handleInitializeTranslations = async (roomTypeId: string, languages: string[]) => {
    try {
      setIsInitializingTranslations(true);
      await roomTypeLocalizationService.initializeTranslations(roomTypeId, {
        targetLanguages: languages,
        autoTranslate: true
      });
      
      toast.success('Translations initialized successfully');
      await loadData(); // Reload to get updated status
    } catch (error: unknown) {
      toast.error(getErrorMessage(error));
    } finally {
      setIsInitializingTranslations(false);
    }
  };

  const handleBulkInitializeTranslations = async () => {
    if (selectedRoomTypes.length === 0 || selectedLanguages.length === 0) {
      toast.error('Please select room types and languages');
      return;
    }

    try {
      setIsInitializingTranslations(true);
      const result = await roomTypeLocalizationService.bulkInitializeTranslations(hotelId, {
        roomTypeIds: selectedRoomTypes,
        targetLanguages: selectedLanguages,
        autoTranslate: true
      });
      
      toast.success(`Translations initialized: ${result.data.summary.successful} successful, ${result.data.summary.failed} failed`);
      setShowBulkDialog(false);
      setSelectedRoomTypes([]);
      setSelectedLanguages([]);
      await loadData();
    } catch (error: unknown) {
      toast.error(getErrorMessage(error));
    } finally {
      setIsInitializingTranslations(false);
    }
  };

  const getTranslationStatusBadge = (status: string, completeness: number) => {
    switch (status) {
      case 'published':
        return <Badge className="bg-green-100 text-green-800">Published ({completeness}%)</Badge>;
      case 'approved':
        return <Badge className="bg-blue-100 text-blue-800">Approved ({completeness}%)</Badge>;
      case 'translated':
        return <Badge className="bg-yellow-100 text-yellow-800">Translated ({completeness}%)</Badge>;
      case 'pending':
        return <Badge className="bg-gray-100 text-gray-800">Pending ({completeness}%)</Badge>;
      default:
        return <Badge className="bg-red-100 text-red-800">Not Started</Badge>;
    }
  };

  const getOverallCompleteness = (roomType: LocalizedRoomType): number => {
    if (!roomType.translationProgress) return 0;
    const { total, approved } = roomType.translationProgress;
    return total > 0 ? Math.round((approved / total) * 100) : 0;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-8 h-8 animate-spin mr-2" />
        <span>Loading room types and translation data...</span>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Languages className="w-8 h-8" />
            Room Type Translation Manager
          </h1>
          <p className="text-gray-600 mt-2">
            Manage multilingual content for room types and amenities
          </p>
        </div>
        <Button onClick={() => setShowBulkDialog(true)} className="flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Bulk Initialize Translations
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">{roomTypes.length}</div>
            <div className="text-sm text-gray-600">Total Room Types</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-green-600">
              {roomTypes.filter(rt => getOverallCompleteness(rt) === 100).length}
            </div>
            <div className="text-sm text-gray-600">Fully Translated</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-yellow-600">
              {roomTypes.filter(rt => {
                const completeness = getOverallCompleteness(rt);
                return completeness > 0 && completeness < 100;
              }).length}
            </div>
            <div className="text-sm text-gray-600">Partially Translated</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-red-600">
              {roomTypes.filter(rt => getOverallCompleteness(rt) === 0).length}
            </div>
            <div className="text-sm text-gray-600">Not Translated</div>
          </CardContent>
        </Card>
      </div>

      {/* Room Types Table */}
      <Card>
        <CardHeader>
          <CardTitle>Room Types Translation Status</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Room Type</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Base Language</TableHead>
                <TableHead>Overall Progress</TableHead>
                <TableHead>Translation Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {roomTypes.map(roomType => (
                <TableRow key={roomType._id}>
                  <TableCell>
                    <div>
                      <div className="font-medium">{roomType.name}</div>
                      <div className="text-sm text-gray-500">{roomType.code}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{roomType.category}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Globe className="w-4 h-4" />
                      {roomType.content.baseLanguage}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="w-20 bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-blue-500 h-2 rounded-full transition-all"
                          style={{ width: `${getOverallCompleteness(roomType)}%` }}
                        />
                      </div>
                      <span className="text-sm font-medium">
                        {getOverallCompleteness(roomType)}%
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {roomType.content.translations.length === 0 ? (
                        <Badge className="bg-gray-100 text-gray-800">No Translations</Badge>
                      ) : (
                        roomType.content.translations.map(translation => (
                          <div key={translation.language} className="text-xs">
                            {getTranslationStatusBadge(translation.status, translation.completeness)}
                          </div>
                        ))
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => setSelectedRoomType(roomType)}
                        >
                          <Settings className="w-4 h-4 mr-1" />
                          Manage
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-2xl">
                        <DialogHeader>
                          <DialogTitle>Manage Translations - {roomType.name}</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div>
                            <Label>Select Languages to Initialize</Label>
                            <div className="grid grid-cols-3 gap-2 mt-2">
                              {availableLanguages
                                .filter(lang => lang.code !== roomType.content.baseLanguage)
                                .map(language => (
                                <label key={language.code} className="flex items-center space-x-2">
                                  <input
                                    type="checkbox"
                                    checked={selectedLanguages.includes(language.code)}
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        setSelectedLanguages([...selectedLanguages, language.code]);
                                      } else {
                                        setSelectedLanguages(selectedLanguages.filter(l => l !== language.code));
                                      }
                                    }}
                                  />
                                  <span className="text-sm">{language.name} ({language.code})</span>
                                </label>
                              ))}
                            </div>
                          </div>
                          <Button
                            onClick={() => handleInitializeTranslations(roomType._id, selectedLanguages)}
                            disabled={isInitializingTranslations || selectedLanguages.length === 0}
                            className="w-full"
                          >
                            {isInitializingTranslations && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                            Initialize Translations
                          </Button>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Bulk Initialize Dialog */}
      <Dialog open={showBulkDialog} onOpenChange={setShowBulkDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Bulk Initialize Translations</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Select Room Types</Label>
              <div className="max-h-40 overflow-y-auto border rounded p-2 mt-1">
                {roomTypes.map(roomType => (
                  <label key={roomType._id} className="flex items-center space-x-2 p-1">
                    <input
                      type="checkbox"
                      checked={selectedRoomTypes.includes(roomType._id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedRoomTypes([...selectedRoomTypes, roomType._id]);
                        } else {
                          setSelectedRoomTypes(selectedRoomTypes.filter(id => id !== roomType._id));
                        }
                      }}
                    />
                    <span className="text-sm">{roomType.name} ({roomType.code})</span>
                  </label>
                ))}
              </div>
            </div>
            
            <div>
              <Label>Select Target Languages</Label>
              <div className="grid grid-cols-3 gap-2 mt-2">
                {availableLanguages.map(language => (
                  <label key={language.code} className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={selectedLanguages.includes(language.code)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedLanguages([...selectedLanguages, language.code]);
                        } else {
                          setSelectedLanguages(selectedLanguages.filter(l => l !== language.code));
                        }
                      }}
                    />
                    <span className="text-sm">{language.name} ({language.code})</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex gap-2">
              <Button 
                variant="outline" 
                onClick={() => setShowBulkDialog(false)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleBulkInitializeTranslations}
                disabled={isInitializingTranslations}
                className="flex-1"
              >
                {isInitializingTranslations && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Initialize Translations
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default RoomTypeTranslationManager;