/** Populated hotel or minimal shape from `/auth/me` when multi-property data is present */
export interface UserPropertyRef {
  _id: string;
  name?: string;
  address?: { city?: string; state?: string; country?: string };
  totalRooms?: number;
  propertyGroupId?: string;
}

export interface User {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  avatar?: string;
  role: 'guest' | 'staff' | 'admin' | 'manager' | 'frontdesk' | 'housekeeping' | 'supervisor' | 'travel_agent';
  hotelId?: string | UserPropertyRef;
  properties?: UserPropertyRef[];
  preferences?: {
    bedType?: string;
    floor?: string;
    smokingAllowed?: boolean;
    other?: string;
  };
  loyalty?: {
    points: number;
    tier: string;
  };
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AuthResponse {
  status: string;
  token?: string;  // Optional -- not returned by /refresh or /me
  user: User;
}