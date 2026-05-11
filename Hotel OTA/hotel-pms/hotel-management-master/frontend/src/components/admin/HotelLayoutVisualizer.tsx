import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Building,
  ChevronDown,
  ChevronRight,
  X,
  Layers,
  MapPin,
  Hash,
  Activity
} from 'lucide-react';

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

interface HotelLayoutVisualizerProps {
  areas: HotelArea[];
  onClose: () => void;
  onAreaSelect: (area: HotelArea) => void;
}

const AREA_TYPE_ORDER: Record<string, number> = {
  building: 0,
  wing: 1,
  floor: 2,
  section: 3,
};

const AREA_TYPE_ICONS: Record<string, React.ReactNode> = {
  building: <Building className="w-4 h-4" />,
  wing: <Layers className="w-4 h-4" />,
  floor: <MapPin className="w-4 h-4" />,
  section: <Hash className="w-4 h-4" />,
};

function getStatusBadge(status: string) {
  const s = status.toLowerCase();
  if (s === 'active') return <Badge variant="success" size="sm">Active</Badge>;
  if (s === 'maintenance') return <Badge variant="warning" size="sm">Maintenance</Badge>;
  if (s === 'inactive') return <Badge variant="error" size="sm">Inactive</Badge>;
  return <Badge variant="default" size="sm">{status}</Badge>;
}

function getTypeBadge(areaType: string) {
  const t = areaType.toLowerCase();
  if (t === 'building') return <Badge variant="info" size="sm">Building</Badge>;
  if (t === 'wing') return <Badge variant="secondary" size="sm">Wing</Badge>;
  if (t === 'floor') return <Badge variant="default" size="sm">Floor</Badge>;
  if (t === 'section') return <Badge variant="outline" size="sm">Section</Badge>;
  return <Badge variant="default" size="sm">{areaType}</Badge>;
}

interface TreeNode {
  area: HotelArea;
  children: TreeNode[];
}

function buildTree(areas: HotelArea[]): TreeNode[] {
  const areaMap = new Map<string, TreeNode>();
  const roots: TreeNode[] = [];

  // Create nodes
  for (const area of areas) {
    areaMap.set(area._id, { area, children: [] });
  }

  // Build parent-child relationships
  for (const area of areas) {
    const node = areaMap.get(area._id)!;
    if (area.parentAreaId && areaMap.has(area.parentAreaId._id)) {
      areaMap.get(area.parentAreaId._id)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  // Sort children by displayOrder, then by type order
  const sortNodes = (nodes: TreeNode[]) => {
    nodes.sort((a, b) => {
      const typeA = AREA_TYPE_ORDER[a.area.areaType.toLowerCase()] ?? 99;
      const typeB = AREA_TYPE_ORDER[b.area.areaType.toLowerCase()] ?? 99;
      if (typeA !== typeB) return typeA - typeB;
      return (a.area.displaySettings?.displayOrder ?? 0) - (b.area.displaySettings?.displayOrder ?? 0);
    });
    for (const node of nodes) {
      sortNodes(node.children);
    }
  };

  sortNodes(roots);
  return roots;
}

function AreaTreeNode({
  node,
  depth,
  onAreaSelect,
}: {
  node: TreeNode;
  depth: number;
  onAreaSelect: (area: HotelArea) => void;
}) {
  const [expanded, setExpanded] = useState(depth < 2);
  const hasChildren = node.children.length > 0;
  const area = node.area;

  return (
    <div>
      <div
        className="flex items-center gap-2 p-3 rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50 cursor-pointer transition-colors group"
        style={{ marginLeft: depth * 24 }}
        onClick={() => onAreaSelect(area)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onAreaSelect(area);
          }
        }}
      >
        {/* Expand/collapse toggle */}
        {hasChildren ? (
          <button
            className="p-0.5 rounded hover:bg-gray-200 transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              setExpanded(!expanded);
            }}
            aria-label={expanded ? 'Collapse' : 'Expand'}
          >
            {expanded ? (
              <ChevronDown className="w-4 h-4 text-gray-500" />
            ) : (
              <ChevronRight className="w-4 h-4 text-gray-500" />
            )}
          </button>
        ) : (
          <div className="w-5" />
        )}

        {/* Area type icon */}
        <span className="text-gray-500">
          {AREA_TYPE_ICONS[area.areaType.toLowerCase()] || <Activity className="w-4 h-4" />}
        </span>

        {/* Area name and code */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-gray-900 truncate">{area.areaName}</span>
            <span className="text-xs text-gray-400 font-mono">{area.areaCode}</span>
          </div>
        </div>

        {/* Badges */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {getTypeBadge(area.areaType)}
          {getStatusBadge(area.status)}
        </div>

        {/* Stats */}
        <div className="text-right flex-shrink-0 text-xs text-gray-500 hidden sm:block">
          {area.totalRooms > 0 ? (
            <span>{area.totalRooms} rooms</span>
          ) : area.statistics?.totalRevenue ? (
            <span>${area.statistics.totalRevenue.toLocaleString()}</span>
          ) : null}
        </div>
      </div>

      {/* Children */}
      {hasChildren && expanded && (
        <div className="mt-1 space-y-1">
          {node.children.map((child) => (
            <AreaTreeNode
              key={child.area._id}
              node={child}
              depth={depth + 1}
              onAreaSelect={onAreaSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function HotelLayoutVisualizer({ areas, onClose, onAreaSelect }: HotelLayoutVisualizerProps) {
  const tree = useMemo(() => buildTree(areas), [areas]);

  // Group areas by type for summary
  const typeSummary = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const area of areas) {
      const t = area.areaType.toLowerCase();
      counts[t] = (counts[t] || 0) + 1;
    }
    return counts;
  }, [areas]);

  if (areas.length === 0) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Building className="w-5 h-5 text-blue-600" />
            Hotel Layout
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 text-gray-400">
            <Building className="w-12 h-12 mb-3" />
            <p className="text-sm font-medium">No areas configured</p>
            <p className="text-xs mt-1">Add hotel areas to see the layout visualization.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Building className="w-5 h-5 text-blue-600" />
            Hotel Layout
          </CardTitle>
          <p className="text-sm text-gray-500 mt-1">
            {areas.length} area{areas.length !== 1 ? 's' : ''} configured
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose}>
          <X className="w-4 h-4" />
        </Button>
      </CardHeader>
      <CardContent>
        {/* Type summary row */}
        <div className="flex flex-wrap gap-3 mb-4 pb-4 border-b border-gray-100">
          {Object.entries(typeSummary)
            .sort(([a], [b]) => (AREA_TYPE_ORDER[a] ?? 99) - (AREA_TYPE_ORDER[b] ?? 99))
            .map(([type, count]) => (
              <div key={type} className="flex items-center gap-1.5 text-sm text-gray-600">
                {AREA_TYPE_ICONS[type] || <Activity className="w-3.5 h-3.5" />}
                <span className="capitalize">{type}s:</span>
                <span className="font-semibold text-gray-900">{count}</span>
              </div>
            ))}
        </div>

        {/* Tree view */}
        <div className="space-y-1">
          {tree.map((node) => (
            <AreaTreeNode
              key={node.area._id}
              node={node}
              depth={0}
              onAreaSelect={onAreaSelect}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
