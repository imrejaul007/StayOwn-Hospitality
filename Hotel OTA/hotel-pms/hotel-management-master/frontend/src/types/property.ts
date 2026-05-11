/** Transformed property used in multi-property management views */
export interface Property {
  id: string;
  name: string;
  brand: string;
  type: 'hotel' | 'resort' | 'aparthotel' | 'hostel' | 'boutique';
  location: {
    address: string;
    city: string;
    country: string;
    coordinates: { lat: number; lng: number };
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
  amenities: string[];
  rating: number;
  status: 'active' | 'inactive' | 'maintenance';
  features: {
    pms?: boolean;
    pos?: boolean;
    wifi: boolean;
    parking: boolean;
    restaurant: boolean;
    gym?: boolean;
    spa: boolean;
    pool: boolean;
    businessCenter?: boolean;
    petFriendly?: boolean;
    fitness?: boolean;
    [key: string]: boolean | undefined;
  };
  operationalHours?: {
    checkIn: string;
    checkOut: string;
    frontDesk: string;
  };
  originalHotel?: Record<string, unknown>;
}

export interface PropertyGroup {
  id: string;
  _id: string;
  name: string;
  description: string;
  groupType?: string;
  status?: string;
  isActive?: boolean;
  properties: string[];
  manager?: string;
  budget?: number;
  performance?: {
    totalRevenue: number;
    avgOccupancy: number;
    avgADR: number;
    totalRooms: number;
  };
  metrics?: {
    totalProperties: number;
    totalRooms: number;
    averageOccupancyRate: number;
    totalRevenue: number;
    activeUsers: number;
  };
}
