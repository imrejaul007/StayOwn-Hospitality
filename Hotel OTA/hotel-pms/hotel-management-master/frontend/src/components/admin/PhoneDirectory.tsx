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
import { api } from '../../services/api';
import {
  Phone,
  Search, 
  Download, 
  Users, 
  Building,
  Shield,
  PhoneCall,
  AlertCircle,
  FileText,
  Filter,
  Map
} from 'lucide-react';

interface DirectoryEntry {
  extensionNumber: string;
  displayName: string;
  description?: string;
  phoneType: string;
  location?: {
    floor?: number;
    wing?: string;
    area?: string;
  };
  room?: {
    number: string;
    floor: number;
    type: string;
  };
  features: string[];
  isAvailable: boolean;
}

interface DirectoryCategory {
  name: string;
  entries: DirectoryEntry[];
}

interface PhoneDirectoryData {
  metadata: {
    hotelId: string;
    generatedAt: string;
    totalEntries: number;
    includeInternal: boolean;
    category: string;
  };
  categories: Record<string, DirectoryCategory>;
}

interface PhoneDirectoryProps {
  onClose: () => void;
}

const PhoneDirectory: React.FC<PhoneDirectoryProps> = ({ onClose }) => {
  const { toast } = useToast();
  const [directory, setDirectory] = useState<PhoneDirectoryData | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [floorFilter, setFloorFilter] = useState('');
  const [includeInternal, setIncludeInternal] = useState(false);
  
  // UI State
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [expandedCategories, setExpandedCategories] = useState<string[]>([]);

  useEffect(() => {
    fetchDirectory();
  }, [categoryFilter, includeInternal]);

  const fetchDirectory = async () => {
    setLoading(true);
    try {
      const hotelId = localStorage.getItem('currentHotelId') || 'default-hotel-id';

      const params = new URLSearchParams({
        includeInternal: includeInternal.toString()
      });

      if (categoryFilter) {
        params.append('category', categoryFilter);
      }

      const { data } = await api.get(`/phone-extensions/hotels/${hotelId}/directory?${params}`);
      if (data?.data) {
        setDirectory(data.data);
        // Auto-expand all categories initially
        setExpandedCategories(Object.keys(data.data.categories || {}));
      } else {
        throw new Error('Failed to fetch directory');
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to fetch phone directory',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleExportDirectory = async (format: 'pdf' | 'csv') => {
    try {
      const hotelId = localStorage.getItem('currentHotelId') || 'default-hotel-id';

      const params = new URLSearchParams({
        format,
        includeInternal: includeInternal.toString()
      });

      if (categoryFilter) {
        params.append('category', categoryFilter);
      }

      const response = await api.get(`/phone-extensions/hotels/${hotelId}/directory?${params}`, { responseType: 'blob' });
      const blob = response.data;
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `phone-directory.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: 'Success',
        description: `Directory exported as ${format.toUpperCase()}`
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to export directory',
        variant: 'destructive'
      });
    }
  };

  const toggleCategoryExpansion = (categoryKey: string) => {
    setExpandedCategories(prev => 
      prev.includes(categoryKey)
        ? prev.filter(key => key !== categoryKey)
        : [...prev, categoryKey]
    );
  };

  const getFilteredEntries = (entries: DirectoryEntry[]) => {
    return entries.filter(entry => {
      const matchesSearch = !search || 
        entry.extensionNumber.toLowerCase().includes(search.toLowerCase()) ||
        entry.displayName.toLowerCase().includes(search.toLowerCase()) ||
        (entry.description && entry.description.toLowerCase().includes(search.toLowerCase())) ||
        (entry.room && entry.room.number.toLowerCase().includes(search.toLowerCase()));

      const matchesFloor = !floorFilter || 
        (entry.room && entry.room.floor.toString() === floorFilter) ||
        (entry.location && entry.location.floor?.toString() === floorFilter);

      return matchesSearch && matchesFloor;
    });
  };

  const getCategoryIcon = (categoryKey: string) => {
    const iconMap: Record<string, React.ReactNode> = {
      guest_rooms: <Building className="w-4 h-4" />,
      common_areas: <Map className="w-4 h-4" />,
      staff: <Users className="w-4 h-4" />,
      services: <PhoneCall className="w-4 h-4" />,
      emergency: <AlertCircle className="w-4 h-4" />,
      admin: <Shield className="w-4 h-4" />
    };
    return iconMap[categoryKey] || <Phone className="w-4 h-4" />;
  };

  const getPhoneTypeColor = (phoneType: string) => {
    const colorMap: Record<string, string> = {
      room_phone: 'bg-blue-100 text-blue-800',
      desk_phone: 'bg-green-100 text-green-800',
      conference: 'bg-purple-100 text-purple-800',
      emergency: 'bg-red-100 text-red-800',
      service: 'bg-orange-100 text-orange-800',
      admin: 'bg-gray-100 text-gray-800'
    };
    return colorMap[phoneType] || 'bg-gray-100 text-gray-800';
  };

  const renderDirectoryEntry = (entry: DirectoryEntry) => (
    <div
      key={entry.extensionNumber}
      className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
    >
      <div className="flex items-center space-x-4">
        <div className="text-center">
          <div className="font-mono text-lg font-bold text-primary">
            {entry.extensionNumber}
          </div>
          <Badge 
            variant="outline" 
            className={`text-xs ${getPhoneTypeColor(entry.phoneType)}`}
          >
            {entry.phoneType.replace('_', ' ')}
          </Badge>
        </div>
        
        <div className="flex-1">
          <h4 className="font-semibold text-lg">{entry.displayName}</h4>
          {entry.description && (
            <p className="text-muted-foreground text-sm">{entry.description}</p>
          )}
          
          {/* Location Info */}
          <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
            {entry.room && (
              <div className="flex items-center gap-1">
                <Building className="w-3 h-3" />
                <span>Room {entry.room.number} (Floor {entry.room.floor})</span>
              </div>
            )}
            
            {!entry.room && entry.location?.area && (
              <div className="flex items-center gap-1">
                <Map className="w-3 h-3" />
                <span>
                  {entry.location.area}
                  {entry.location.floor && ` (Floor ${entry.location.floor})`}
                  {entry.location.wing && ` - ${entry.location.wing} Wing`}
                </span>
              </div>
            )}
          </div>
          
          {/* Features */}
          {entry.features.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {entry.features.slice(0, 3).map(feature => (
                <Badge key={feature} variant="secondary" className="text-xs">
                  {feature.replace('_', ' ')}
                </Badge>
              ))}
              {entry.features.length > 3 && (
                <Badge variant="secondary" className="text-xs">
                  +{entry.features.length - 3} more
                </Badge>
              )}
            </div>
          )}
        </div>
      </div>
      
      <div className="text-right">
        {entry.isAvailable ? (
          <Badge variant="default" className="bg-green-100 text-green-800">
            Available
          </Badge>
        ) : (
          <Badge variant="destructive">
            Unavailable
          </Badge>
        )}
      </div>
    </div>
  );

  const renderGridEntry = (entry: DirectoryEntry) => (
    <Card key={entry.extensionNumber} className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="text-center mb-3">
          <div className="font-mono text-xl font-bold text-primary mb-1">
            {entry.extensionNumber}
          </div>
          <h4 className="font-semibold">{entry.displayName}</h4>
          {entry.description && (
            <p className="text-muted-foreground text-sm mt-1">{entry.description}</p>
          )}
        </div>
        
        <div className="space-y-2">
          <div className="flex justify-center">
            <Badge 
              variant="outline" 
              className={`${getPhoneTypeColor(entry.phoneType)}`}
            >
              {entry.phoneType.replace('_', ' ')}
            </Badge>
          </div>
          
          {entry.room && (
            <div className="text-center text-sm text-muted-foreground">
              Room {entry.room.number}, Floor {entry.room.floor}
            </div>
          )}
          
          {!entry.room && entry.location?.area && (
            <div className="text-center text-sm text-muted-foreground">
              {entry.location.area}
            </div>
          )}
          
          <div className="flex justify-center">
            {entry.isAvailable ? (
              <Badge variant="default" className="bg-green-100 text-green-800 text-xs">
                Available
              </Badge>
            ) : (
              <Badge variant="destructive" className="text-xs">
                Unavailable
              </Badge>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );

  if (loading) {
    return (
      <Dialog open={true} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Loading Phone Directory...</DialogTitle>
          </DialogHeader>
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const totalEntries = directory ? Object.values(directory.categories)
    .reduce((sum, category) => sum + getFilteredEntries(category.entries).length, 0) : 0;

  const availableFloors = directory ? Array.from(new Set(
    Object.values(directory.categories).flatMap(category =>
      category.entries.map(entry => 
        entry.room?.floor?.toString() || entry.location?.floor?.toString()
      ).filter(Boolean)
    )
  )).sort() : [];

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Phone Directory
            {directory && (
              <Badge variant="secondary" className="ml-2">
                {directory.metadata.totalEntries} entries
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Filters and Actions */}
          <div className="flex flex-wrap gap-4 items-center justify-between">
            <div className="flex flex-wrap gap-4 items-center">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Search directory..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10 w-64"
                />
              </div>
              
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Categories</SelectItem>
                  {directory && Object.entries(directory.categories).map(([key, category]) => (
                    <SelectItem key={key} value={key}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {availableFloors.length > 0 && (
                <Select value={floorFilter} onValueChange={setFloorFilter}>
                  <SelectTrigger className="w-[120px]">
                    <SelectValue placeholder="All Floors" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All Floors</SelectItem>
                    {availableFloors.map(floor => (
                      <SelectItem key={floor} value={floor}>
                        Floor {floor}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              <label className="flex items-center space-x-2 text-sm">
                <input
                  type="checkbox"
                  checked={includeInternal}
                  onChange={(e) => setIncludeInternal(e.target.checked)}
                  className="rounded"
                />
                <span>Include Internal</span>
              </label>
            </div>
            
            <div className="flex gap-2">
              <Select onValueChange={setViewMode}>
                <SelectTrigger className="w-[100px]">
                  <SelectValue placeholder={viewMode} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="list">List</SelectItem>
                  <SelectItem value="grid">Grid</SelectItem>
                </SelectContent>
              </Select>
              
              <Button
                variant="outline"
                onClick={() => handleExportDirectory('csv')}
                size="sm"
              >
                <Download className="w-4 h-4 mr-2" />
                CSV
              </Button>
              
              <Button
                variant="outline"
                onClick={() => handleExportDirectory('pdf')}
                size="sm"
              >
                <Download className="w-4 h-4 mr-2" />
                PDF
              </Button>
            </div>
          </div>

          {/* Directory Content */}
          {directory && (
            <div className="space-y-6">
              {search && (
                <div className="text-sm text-muted-foreground">
                  Found {totalEntries} matching entries
                </div>
              )}

              {Object.entries(directory.categories).map(([categoryKey, category]) => {
                const filteredEntries = getFilteredEntries(category.entries);
                
                if (filteredEntries.length === 0) {
                  return null;
                }

                const isExpanded = expandedCategories.includes(categoryKey);

                return (
                  <Card key={categoryKey}>
                    <CardHeader 
                      className="cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => toggleCategoryExpansion(categoryKey)}
                    >
                      <CardTitle className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {getCategoryIcon(categoryKey)}
                          <span>{category.name}</span>
                          <Badge variant="secondary">
                            {filteredEntries.length}
                          </Badge>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {isExpanded ? 'Click to collapse' : 'Click to expand'}
                        </div>
                      </CardTitle>
                    </CardHeader>
                    
                    {isExpanded && (
                      <CardContent>
                        {viewMode === 'list' ? (
                          <div className="space-y-3">
                            {filteredEntries.map(renderDirectoryEntry)}
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {filteredEntries.map(renderGridEntry)}
                          </div>
                        )}
                      </CardContent>
                    )}
                  </Card>
                );
              })}

              {totalEntries === 0 && (
                <Card>
                  <CardContent className="p-8 text-center">
                    <Phone className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-semibold mb-2">No entries found</h3>
                    <p className="text-muted-foreground">
                      Try adjusting your search criteria or filters.
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* Footer Info */}
          {directory && (
            <div className="text-sm text-muted-foreground text-center pt-4 border-t">
              Directory generated on {new Date(directory.metadata.generatedAt).toLocaleString()}
            </div>
          )}
        </div>

        {/* Close Button */}
        <div className="flex justify-end pt-4 border-t">
          <Button onClick={onClose}>
            Close Directory
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PhoneDirectory;