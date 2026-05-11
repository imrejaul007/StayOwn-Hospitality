import React from 'react';
import { Card, CardContent, CardHeader } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import {
  Building2,
  MapPin,
  Star,
  Phone,
  Mail,
  Bed,
  Users,
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  MoreVertical,
  Eye
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator
} from '../ui/dropdown-menu';

interface Property {
  id: string;
  name: string;
  brand: string;
  type: string;
  location: {
    city: string;
    country: string;
  };
  contact: {
    phone: string;
    email: string;
    manager: string;
  };
  rooms: {
    total: number;
    occupied: number;
    available: number;
    outOfOrder: number;
  };
  performance: {
    occupancyRate: number;
    adr: number;
    revpar: number;
    revenue: number;
    lastMonth: {
      occupancyRate: number;
      adr: number;
      revpar: number;
      revenue: number;
    };
  };
  rating: number;
  status: 'active' | 'inactive' | 'maintenance';
  features: {
    wifi: boolean;
    parking: boolean;
    restaurant: boolean;
    gym: boolean;
    spa: boolean;
    pool: boolean;
  };
}

interface MobilePropertyCardProps {
  property: Property;
  onSelect: (property: Property) => void;
  onEdit: (property: Property) => void;
  onDelete: (propertyId: string) => void;
}

const getStatusColor = (status: string) => {
  switch (status) {
    case 'active': return 'text-green-600 bg-green-50 border-green-200';
    case 'inactive': return 'text-red-600 bg-red-50 border-red-200';
    case 'maintenance': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    default: return 'text-gray-600 bg-gray-50 border-gray-200';
  }
};

const getPerformanceIndicator = (current: number, previous: number) => {
  if (current > previous) {
    return <ArrowUpRight className="h-3 w-3 text-green-500" />;
  } else if (current < previous) {
    return <ArrowDownRight className="h-3 w-3 text-red-500" />;
  }
  return null;
};

export const MobilePropertyCard: React.FC<MobilePropertyCardProps> = ({
  property,
  onSelect,
  onEdit,
  onDelete
}) => {
  const occupancyChange = property.performance.occupancyRate - property.performance.lastMonth.occupancyRate;
  const revenueChange = property.performance.revenue - property.performance.lastMonth.revenue;

  return (
    <Card className="w-full hover:shadow-md transition-shadow duration-200 active:scale-[0.98]">
      <CardHeader className="pb-3">
        {/* Header with name and actions */}
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Building2 className="h-4 w-4 text-blue-600 flex-shrink-0" />
              <h3 className="font-semibold text-base truncate">{property.name}</h3>
            </div>
            <p className="text-sm text-muted-foreground truncate">
              {property.brand} • {property.type}
            </p>
          </div>

          <div className="flex items-center gap-2 ml-2">
            <Badge className={`${getStatusColor(property.status)} border text-xs px-2 py-1`}>
              {property.status}
            </Badge>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onSelect(property)}>
                  <Eye className="mr-2 h-4 w-4" />
                  View Details
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onEdit(property)}>
                  <Eye className="mr-2 h-4 w-4" />
                  Edit Property
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-red-600"
                  onClick={() => onDelete(property.id)}
                >
                  <Eye className="mr-2 h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Location and rating */}
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-1 text-muted-foreground">
            <MapPin className="h-3 w-3" />
            <span className="truncate">{property.location.city}, {property.location.country}</span>
          </div>
          <div className="flex items-center gap-1">
            <Star className="h-3 w-3 text-yellow-500 fill-current" />
            <span className="text-sm font-medium">{property.rating}</span>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Key metrics - Mobile optimized grid */}
        <div className="grid grid-cols-2 gap-3">
          <div className="text-center p-2 bg-muted/50 rounded-md">
            <div className="text-sm font-bold text-blue-600">{property.performance.occupancyRate}%</div>
            <div className="text-xs text-muted-foreground">Occupancy</div>
            <div className="flex items-center justify-center mt-1">
              {getPerformanceIndicator(property.performance.occupancyRate, property.performance.lastMonth.occupancyRate)}
              <span className={`text-xs ml-1 ${occupancyChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {occupancyChange >= 0 ? '+' : ''}{occupancyChange.toFixed(1)}%
              </span>
            </div>
          </div>

          <div className="text-center p-2 bg-muted/50 rounded-md">
            <div className="text-sm font-bold text-green-600">₹{property.performance.adr.toLocaleString()}</div>
            <div className="text-xs text-muted-foreground">ADR</div>
            <div className="flex items-center justify-center mt-1">
              {getPerformanceIndicator(property.performance.adr, property.performance.lastMonth.adr)}
              <span className={`text-xs ml-1 ${property.performance.adr >= property.performance.lastMonth.adr ? 'text-green-600' : 'text-red-600'}`}>
                {((property.performance.adr - property.performance.lastMonth.adr) / property.performance.lastMonth.adr * 100).toFixed(1)}%
              </span>
            </div>
          </div>
        </div>

        {/* Room stats - Compact layout */}
        <div className="grid grid-cols-4 gap-2 text-center text-xs">
          <div>
            <div className="font-bold text-blue-600">{property.rooms.total}</div>
            <div className="text-muted-foreground">Total</div>
          </div>
          <div>
            <div className="font-bold text-green-600">{property.rooms.occupied}</div>
            <div className="text-muted-foreground">Occupied</div>
          </div>
          <div>
            <div className="font-bold text-orange-600">{property.rooms.available}</div>
            <div className="text-muted-foreground">Available</div>
          </div>
          <div>
            <div className="font-bold text-red-600">{property.rooms.outOfOrder}</div>
            <div className="text-muted-foreground">OOO</div>
          </div>
        </div>

        {/* Features - Mobile optimized */}
        <div className="flex flex-wrap gap-1">
          {Object.entries(property.features)
            .filter(([, enabled]) => enabled)
            .slice(0, 4)
            .map(([feature]) => (
              <Badge key={feature} variant="outline" className="text-xs px-2 py-0.5">
                {feature.charAt(0).toUpperCase() + feature.slice(1)}
              </Badge>
            ))}
          {Object.entries(property.features).filter(([, enabled]) => enabled).length > 4 && (
            <Badge variant="outline" className="text-xs px-2 py-0.5">
              +{Object.entries(property.features).filter(([, enabled]) => enabled).length - 4}
            </Badge>
          )}
        </div>

        {/* Revenue and action */}
        <div className="flex items-center justify-between pt-2 border-t">
          <div>
            <div className="text-sm font-bold">₹{(property.performance.revenue / 1000).toFixed(0)}K</div>
            <div className="text-xs text-muted-foreground">Monthly Revenue</div>
          </div>
          <Button
            size="sm"
            onClick={() => onSelect(property)}
            className="h-8 px-3 text-xs"
          >
            View Details
          </Button>
        </div>

        {/* Contact info - Expandable */}
        <div className="text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <Users className="h-3 w-3" />
            <span className="truncate">{property.contact.manager}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};