import React, { createContext, useContext, useState, useEffect, useMemo, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { api } from '../services/api';
import { authService } from '../services/authService';
import { useAuth } from './AuthContext';
import type { User } from '../types/auth';

const HOTEL_SWITCH_ROLES = new Set(['admin', 'manager']);

function readStoredPropertyId(): string | null {
  const stored = localStorage.getItem('selectedPropertyId');
  if (!stored || stored === 'null' || stored === 'undefined') {
    if (stored === 'null' || stored === 'undefined') {
      localStorage.removeItem('selectedPropertyId');
    }
    return null;
  }
  return stored;
}

function getPrimaryHotelIdString(user: User | null): string | null {
  if (!user?.hotelId) return null;
  if (typeof user.hotelId === 'string') return user.hotelId;
  const ref = user.hotelId as { _id?: string };
  if (ref._id) return ref._id;
  return null;
}

/**
 * Hotel/Property Interface
 * Represents a single hotel property in the multi-property system
 */
interface Hotel {
  _id: string;
  name: string;
  address: {
    city: string;
    state: string;
    country: string;
  };
  totalRooms: number;
  propertyGroupId?: string;
  groupSettings?: {
    inheritSettings: boolean;
    lastSyncAt: Date;
  };
}

/**
 * Property Context Type
 * Provides property selection state and management across the application
 */
interface PropertyContextType {
  selectedPropertyId: string | null;
  selectedProperty: Hotel | null;
  properties: Hotel[];
  viewMode: 'single' | 'all';
  isMultiProperty: boolean;
  isLoading: boolean;
  error: Error | null;
  /** Primary property id from JWT (`/auth/me`); API tenant overrides match this on mutating routes */
  primaryTenantHotelId: string | null;
  /** True while a switchHotel call is in-flight */
  isSwitchingProperty: boolean;
  setSelectedPropertyId: (id: string) => void;
  setViewMode: (mode: 'single' | 'all') => void;
}

export const PropertyContext = createContext<PropertyContextType | undefined>(undefined);

/**
 * PropertyProvider Component
 *
 * Manages global property selection state for multi-property hotel management.
 *
 * Features:
 * - Fetches user's properties from /auth/me endpoint using React Query
 * - Persists selected property to localStorage
 * - Supports single property view and portfolio view (all properties)
 * - Auto-selects first property if none selected
 * - Handles multi-property vs. single-property users
 *
 * @example
 * ```tsx
 * <PropertyProvider>
 *   <App />
 * </PropertyProvider>
 * ```
 */
export function PropertyProvider({ children }: { children: React.ReactNode }) {
  const { user, isLoading: authLoading, updateUser } = useAuth();
  const queryClient = useQueryClient();

  // State management for selected property
  const [selectedPropertyId, setSelectedPropertyIdState] = useState<string | null>(() =>
    readStoredPropertyId()
  );
  const selectedPropertyIdRef = useRef<string | null>(null);
  selectedPropertyIdRef.current = selectedPropertyId;

  // State management for view mode (single property or all properties/portfolio)
  const [viewMode, setViewModeState] = useState<'single' | 'all'>(() => {
    const saved = localStorage.getItem('propertyViewMode');
    return (saved as 'single' | 'all') || 'single';
  });

  const ADMIN_LIKE_ROLES = new Set(['admin', 'staff', 'frontdesk']);
  const isAdminLike = !!user && ADMIN_LIKE_ROLES.has(user.role);

  /**
   * For admin-like roles, ALWAYS fetch all accessible properties from /admin/hotels.
   * The backend's getUserPropertyIds collects owned + assigned + allowed + primary + hotelId,
   * so this returns the full list — not just the User.properties array.
   */
  const { data: allAccessibleHotels, isLoading: hotelsQueryLoading, error } = useQuery({
    queryKey: ['admin-hotels-all', user?.role, getPrimaryHotelIdString(user)],
    queryFn: async () => {
      const response = await api.get('/admin/hotels', { params: { limit: 100 } });
      return (response.data?.data?.hotels || []) as Hotel[];
    },
    enabled: isAdminLike && !authLoading,
    staleTime: 5 * 60 * 1000,
    retry: 1,
    refetchOnWindowFocus: false,
  });

  const properties: Hotel[] = useMemo(() => {
    if (!user) return [];

    // For admin-like roles, prefer the full list from /admin/hotels (includes owned hotels)
    if (isAdminLike && allAccessibleHotels && allAccessibleHotels.length > 0) {
      return allAccessibleHotels;
    }

    // For non-admin roles (or while admin query is loading), use user.properties
    if (user.properties && Array.isArray(user.properties) && user.properties.length > 0) {
      return user.properties as Hotel[];
    }
    if (user.hotelId && typeof user.hotelId === 'object' && (user.hotelId as { _id?: string })._id) {
      return [user.hotelId as unknown as Hotel];
    }
    return [];
  }, [user, isAdminLike, allAccessibleHotels]);

  const isLoading = authLoading || (isAdminLike && hotelsQueryLoading);
  const isMultiProperty = properties.length > 1;

  const primaryTenantHotelId = useMemo(() => getPrimaryHotelIdString(user), [user]);
  const [isSwitchingProperty, setIsSwitchingProperty] = useState(false);

  // Find selected property object
  const selectedProperty = properties.find((p: Hotel) => p._id === selectedPropertyId) || null;

  // Auto-select first property if none selected and in single view mode
  useEffect(() => {
    if (!selectedPropertyId && properties.length > 0 && viewMode === 'single') {
      const firstPropertyId = properties[0]._id;
      setSelectedPropertyIdState(firstPropertyId);
      localStorage.setItem('selectedPropertyId', firstPropertyId);
    }
  }, [properties, selectedPropertyId, viewMode]);

  // Validate selected property is still valid (user might have lost access)
  useEffect(() => {
    if (selectedPropertyId && properties.length > 0) {
      const isValid = properties.some((p: Hotel) => p._id === selectedPropertyId);

      if (!isValid) {
        // Selected property no longer accessible, reset to first property
        const fallbackId = properties[0]._id;
        setSelectedPropertyIdState(fallbackId);
        localStorage.setItem('selectedPropertyId', fallbackId);
      }
    }
  }, [properties, selectedPropertyId]);

  /**
   * Set selected property ID and switch to single view mode
   * Persists selection to localStorage
   */
  const setSelectedPropertyId = (id: string) => {
    const prevId = selectedPropertyIdRef.current;
    const tenantId = getPrimaryHotelIdString(user);
    const shouldSyncJwt =
      !!user &&
      HOTEL_SWITCH_ROLES.has(user.role) &&
      !!tenantId &&
      id !== tenantId;

    setSelectedPropertyIdState(id);
    localStorage.setItem('selectedPropertyId', id);

    // When selecting a specific property, switch to single view mode
    setViewModeState('single');
    localStorage.setItem('propertyViewMode', 'single');

    if (shouldSyncJwt) {
      setIsSwitchingProperty(true);
      authService
        .switchHotel(id)
        .then(({ user: nextUser }) => {
          updateUser(nextUser);
          // Invalidate all cached queries so they refetch with the new JWT
          queryClient.invalidateQueries();
        })
        .catch(() => {
          if (prevId) {
            setSelectedPropertyIdState(prevId);
            localStorage.setItem('selectedPropertyId', prevId);
          } else {
            setSelectedPropertyIdState(null);
            localStorage.removeItem('selectedPropertyId');
          }
          toast.error('Could not switch property. Try again or re-login.');
        })
        .finally(() => {
          setIsSwitchingProperty(false);
        });
    } else {
      // Same JWT hotel — just invalidate cached data for the new property scope
      queryClient.invalidateQueries();
    }
  };

  /**
   * Set view mode (single property or all properties)
   * Persists selection to localStorage
   *
   * When switching to 'single' mode, auto-selects first property if none selected
   */
  const setViewMode = (mode: 'single' | 'all') => {
    setViewModeState(mode);
    localStorage.setItem('propertyViewMode', mode);

    // If switching to single mode and no property selected, select first property
    if (mode === 'single' && !selectedPropertyId && properties.length > 0) {
      setSelectedPropertyId(properties[0]._id);
    }
  };

  const value: PropertyContextType = {
    selectedPropertyId,
    selectedProperty,
    properties,
    viewMode,
    isMultiProperty,
    isLoading,
    error: error as Error | null,
    primaryTenantHotelId,
    isSwitchingProperty,
    setSelectedPropertyId,
    setViewMode,
  };

  return (
    <PropertyContext.Provider value={value}>
      {children}
    </PropertyContext.Provider>
  );
}

/**
 * useProperty Hook
 *
 * Access property context from any component.
 * Throws error if used outside PropertyProvider.
 *
 * @returns PropertyContextType
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { selectedPropertyId, selectedProperty, setSelectedPropertyId } = useProperty();
 *
 *   return (
 *     <div>
 *       <h1>Current Property: {selectedProperty?.name}</h1>
 *       <p>Property ID: {selectedPropertyId}</p>
 *     </div>
 *   );
 * }
 * ```
 *
 * @example Property switching
 * ```tsx
 * function PropertySwitcher() {
 *   const { properties, selectedPropertyId, setSelectedPropertyId } = useProperty();
 *
 *   return (
 *     <select
 *       value={selectedPropertyId || ''}
 *       onChange={(e) => setSelectedPropertyId(e.target.value)}
 *     >
 *       {properties.map(property => (
 *         <option key={property._id} value={property._id}>
 *           {property.name}
 *         </option>
 *       ))}
 *     </select>
 *   );
 * }
 * ```
 *
 * @example Multi-property check
 * ```tsx
 * function AdminDashboard() {
 *   const { isMultiProperty, viewMode, setViewMode } = useProperty();
 *
 *   if (isMultiProperty) {
 *     return (
 *       <div>
 *         <button onClick={() => setViewMode('all')}>
 *           View Portfolio
 *         </button>
 *         {viewMode === 'all' && <PortfolioDashboard />}
 *       </div>
 *     );
 *   }
 *
 *   return <SinglePropertyDashboard />;
 * }
 * ```
 */
export function useProperty() {
  const context = useContext(PropertyContext);

  if (context === undefined) {
    throw new Error('useProperty must be used within a PropertyProvider');
  }

  return context;
}

// Export types for external use
export type { Hotel, PropertyContextType };
