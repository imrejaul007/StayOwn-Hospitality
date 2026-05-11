import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Label } from '../ui/label';
import { Switch } from '../ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { X } from 'lucide-react';
import { useProperty } from '../../context/PropertyContext';
import { api } from '../../services/api';

interface HotelArea {
  _id: string;
  areaName: string;
  areaCode: string;
  areaType: string;
  status: string;
  totalRooms: number;
  availableRooms: number;
  hierarchyLevel: number;
  fullPath: string;
  parentAreaId?: {
    _id: string;
    areaName: string;
    areaCode: string;
  };
  assignedStaff: Array<{
    staffId: {
      firstName: string;
      lastName: string;
      role: string;
    };
    role: string;
    shift: string;
    isActive: boolean;
  }>;
  statistics: {
    averageOccupancy: number;
    averageRate: number;
    totalRevenue: number;
    guestSatisfactionScore: number;
    maintenanceRequestCount: number;
  };
  displaySettings: {
    color: string;
    icon: string;
    displayOrder: number;
    showInPublicAreas: boolean;
  };
  auditInfo: {
    createdBy: {
      firstName: string;
      lastName: string;
    };
    createdAt: string;
    updatedAt: string;
  };
}

interface ParentAreaOption {
  _id: string;
  areaName: string;
  areaCode: string;
}

interface HotelAreaFormProps {
  area: HotelArea | null;
  onClose: () => void;
  onSave: () => void;
}

const areaTypes = [
  { value: 'building', label: 'Building' },
  { value: 'wing', label: 'Wing' },
  { value: 'floor', label: 'Floor' },
  { value: 'section', label: 'Section' },
  { value: 'block', label: 'Block' },
  { value: 'tower', label: 'Tower' },
  { value: 'annex', label: 'Annex' },
  { value: 'pavilion', label: 'Pavilion' },
];

const statusOptions = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'under_maintenance', label: 'Under Maintenance' },
  { value: 'renovation', label: 'Renovation' },
];

export default function HotelAreaForm({ area, onClose, onSave }: HotelAreaFormProps) {
  const { selectedPropertyId } = useProperty();
  const hotelId = selectedPropertyId || localStorage.getItem('hotelId') || '';

  const [areaName, setAreaName] = useState('');
  const [areaCode, setAreaCode] = useState('');
  const [areaType, setAreaType] = useState('building');
  const [parentAreaId, setParentAreaId] = useState('');
  const [description, setDescription] = useState('');
  const [floorNumber, setFloorNumber] = useState('');
  const [totalSqft, setTotalSqft] = useState('');
  const [status, setStatus] = useState('active');
  const [amenities, setAmenities] = useState('');
  const [color, setColor] = useState('#3B82F6');
  const [displayOrder, setDisplayOrder] = useState('0');

  const [parentAreas, setParentAreas] = useState<ParentAreaOption[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    fetchParentAreas();
  }, [hotelId]);

  useEffect(() => {
    if (area) {
      setAreaName(area.areaName);
      setAreaCode(area.areaCode);
      setAreaType(area.areaType);
      setParentAreaId(area.parentAreaId?._id || '');
      setDescription('');
      setFloorNumber('');
      setTotalSqft('');
      setStatus(area.status);
      setAmenities('');
      setColor(area.displaySettings?.color || '#3B82F6');
      setDisplayOrder(String(area.displaySettings?.displayOrder ?? 0));
    }
  }, [area]);

  const fetchParentAreas = async () => {
    if (!hotelId) return;
    try {
      const { data } = await api.get(`/hotel-areas/${hotelId}/areas?limit=100`);
      const areas: ParentAreaOption[] = (data.data?.areas || []).map(
        (a: { _id: string; areaName: string; areaCode: string }) => ({
          _id: a._id,
          areaName: a.areaName,
          areaCode: a.areaCode,
        })
      );
      // Exclude current area from parent options
      if (area) {
        setParentAreas(areas.filter((a) => a._id !== area._id));
      } else {
        setParentAreas(areas);
      }
    } catch {
      // Silently ignore - parent area dropdown will just be empty
    }
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!areaName.trim()) newErrors.areaName = 'Area name is required';
    if (!areaCode.trim()) newErrors.areaCode = 'Area code is required';
    if (areaCode.trim() && !/^[A-Z0-9_-]+$/.test(areaCode.trim())) {
      newErrors.areaCode = 'Must be uppercase letters, numbers, underscores, or hyphens';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setSaving(true);
    setLoadError('');

    const payload: Record<string, unknown> = {
      areaName: areaName.trim(),
      areaCode: areaCode.trim().toUpperCase(),
      areaType,
      status,
      displaySettings: {
        color,
        displayOrder: Number(displayOrder) || 0,
      },
    };

    if (description.trim()) payload.description = description.trim();
    if (floorNumber !== '') payload.floorNumber = Number(floorNumber);
    if (totalSqft !== '') payload.totalSqft = Number(totalSqft);
    if (parentAreaId) payload.parentAreaId = parentAreaId;

    // Parse comma-separated amenities into an array
    if (amenities.trim()) {
      payload.amenities = amenities
        .split(',')
        .map((a) => a.trim())
        .filter(Boolean);
    }

    try {
      if (area) {
        await api.patch(`/hotel-areas/areas/${area._id}`, payload);
      } else {
        await api.post(`/hotel-areas/${hotelId}/areas`, payload);
      }
      onSave();
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Failed to save area';
      setLoadError(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div
        aria-hidden="true"
        className="fixed inset-0 bg-black bg-opacity-50"
        onClick={onClose}
      />
      <Card className="relative z-10 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>{area ? 'Edit Area' : 'Create Area'}</CardTitle>
          <button
            aria-label="Close"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-5 h-5" />
          </button>
        </CardHeader>
        <CardContent>
          {loadError && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-md text-sm">
              {loadError}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Basic Information */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                Basic Information
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Area Name"
                  value={areaName}
                  onChange={(e) => setAreaName(e.target.value)}
                  required
                  error={errors.areaName}
                  placeholder="e.g. Main Building"
                />
                <Input
                  label="Area Code"
                  value={areaCode}
                  onChange={(e) => setAreaCode(e.target.value.toUpperCase())}
                  required
                  error={errors.areaCode}
                  placeholder="e.g. MAIN-BLD"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label>Area Type</Label>
                  <Select value={areaType} onValueChange={setAreaType}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      {areaTypes.map((t) => (
                        <SelectItem key={t.value} value={t.value}>
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Parent Area</Label>
                  <Select value={parentAreaId} onValueChange={setParentAreaId}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="None (top level)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">None (top level)</SelectItem>
                      {parentAreas.map((pa) => (
                        <SelectItem key={pa._id} value={pa._id}>
                          {pa.areaName} ({pa.areaCode})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Textarea
                label="Description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional description of this area"
                rows={2}
              />
            </div>

            {/* Details */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                Details
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Input
                  label="Floor Number"
                  type="number"
                  value={floorNumber}
                  onChange={(e) => setFloorNumber(e.target.value)}
                  placeholder="e.g. 3"
                />
                <Input
                  label="Total Sqft"
                  type="number"
                  value={totalSqft}
                  onChange={(e) => setTotalSqft(e.target.value)}
                  placeholder="e.g. 5000"
                />
                <div>
                  <Label>Status</Label>
                  <Select value={status} onValueChange={setStatus}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {statusOptions.map((s) => (
                        <SelectItem key={s.value} value={s.value}>
                          {s.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Input
                label="Amenities"
                value={amenities}
                onChange={(e) => setAmenities(e.target.value)}
                placeholder="Comma-separated, e.g. WiFi, Pool, Gym"
                helperText="Enter amenities separated by commas"
              />
            </div>

            {/* Display Settings */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                Display Settings
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label>Color</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <input
                      type="color"
                      value={color}
                      onChange={(e) => setColor(e.target.value)}
                      className="h-10 w-14 rounded border border-gray-300 cursor-pointer"
                    />
                    <Input
                      value={color}
                      onChange={(e) => setColor(e.target.value)}
                      placeholder="#3B82F6"
                      className="flex-1"
                    />
                  </div>
                </div>
                <Input
                  label="Display Order"
                  type="number"
                  value={displayOrder}
                  onChange={(e) => setDisplayOrder(e.target.value)}
                  placeholder="0"
                  helperText="Lower numbers appear first"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving} loading={saving}>
                {area ? 'Update Area' : 'Create Area'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
