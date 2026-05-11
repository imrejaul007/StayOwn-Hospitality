import { useAuth } from '../context/AuthContext';

export interface PermissionConfig {
  resource: string;
  action: 'view' | 'edit' | 'delete' | 'approve';
}

/**
 * Hook for checking user permissions based on role
 */
export function usePermissions() {
  const { user } = useAuth();

  /**
   * Check if user can edit a specific resource
   */
  const canEdit = (resource: string): boolean => {
    if (!user) return false;

    // Admin can edit everything
    if (user.role === 'admin') return true;

    // FrontDesk has limited edit permissions
    if (user.role === 'frontdesk') {
      const editableResources = [
        'bookings',
        'rooms',
        'housekeeping',
        'maintenance',
        'guest-services',
        'service-requests',
        'inventory-requests',
        'daily-check',
        'checkout',
        'billing',
        'payments',
        'meet-up',
        'supply-requests',
      ];
      return editableResources.includes(resource);
    }

    // Staff has very limited edit permissions
    if (user.role === 'staff') {
      const editableResources = [
        'service-requests',
        'inventory-requests',
        'daily-check',
      ];
      return editableResources.includes(resource);
    }

    // Guest cannot edit anything
    return false;
  };

  /**
   * Check if user can delete a specific resource
   */
  const canDelete = (resource: string): boolean => {
    if (!user) return false;

    // Only admin can delete most resources
    if (user.role === 'admin') return true;

    // FrontDesk can delete very limited items
    if (user.role === 'frontdesk') {
      const deletableResources = [
        'service-requests',
        'inventory-requests',
      ];
      return deletableResources.includes(resource);
    }

    return false;
  };

  /**
   * Check if user can approve items (bypass approvals)
   */
  const canApprove = (): boolean => {
    if (!user) return false;
    return user.role === 'admin' || user.role === 'frontdesk';
  };

  /**
   * Check if user is admin
   */
  const isAdmin = (): boolean => {
    return user?.role === 'admin';
  };

  /**
   * Check if user is frontdesk
   */
  const isFrontDesk = (): boolean => {
    return user?.role === 'frontdesk';
  };

  /**
   * Check if user is staff
   */
  const isStaff = (): boolean => {
    return user?.role === 'staff';
  };

  /**
   * Check if user is guest
   */
  const isGuest = (): boolean => {
    return user?.role === 'guest';
  };

  /**
   * Check if user has a specific role
   */
  const hasRole = (role: string | string[]): boolean => {
    if (!user) return false;
    if (Array.isArray(role)) {
      return role.includes(user.role);
    }
    return user.role === role;
  };

  /**
   * Check if user can view a specific resource
   */
  const canView = (resource: string): boolean => {
    if (!user) return false;

    // Admin can view everything
    if (user.role === 'admin') return true;

    // FrontDesk can view most things
    if (user.role === 'frontdesk') {
      const restrictedResources = [
        'api-management',
        'security-dashboard',
        'financial-analytics',
      ];
      return !restrictedResources.includes(resource);
    }

    // Staff has limited view permissions
    if (user.role === 'staff') {
      const viewableResources = [
        'dashboard',
        'bookings',
        'rooms',
        'housekeeping',
        'service-requests',
        'inventory-requests',
        'daily-check',
        'guest-services',
      ];
      return viewableResources.includes(resource);
    }

    // Guest can only view their own bookings
    if (user.role === 'guest') {
      const viewableResources = ['bookings', 'profile'];
      return viewableResources.includes(resource);
    }

    return false;
  };

  /**
   * Check if user can access financial data
   */
  const canAccessFinancials = (): boolean => {
    if (!user) return false;
    return user.role === 'admin';
  };

  /**
   * Check if user can manage staff
   */
  const canManageStaff = (): boolean => {
    if (!user) return false;
    return user.role === 'admin' || user.role === 'frontdesk';
  };

  /**
   * Check if user can manage room types
   */
  const canManageRoomTypes = (): boolean => {
    if (!user) return false;
    // Only admin can fully manage room types
    // FrontDesk can view but not create/delete
    return user.role === 'admin';
  };

  return {
    canEdit,
    canDelete,
    canApprove,
    canView,
    canAccessFinancials,
    canManageStaff,
    canManageRoomTypes,
    isAdmin,
    isFrontDesk,
    isStaff,
    isGuest,
    hasRole,
  };
}
