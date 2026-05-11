import React, { ReactNode } from 'react';
import { useAuth } from '../../context/AuthContext';
import { AlertCircle } from 'lucide-react';

interface RoleGateProps {
  allowedRoles: string[];
  children: ReactNode;
  fallback?: ReactNode;
  showError?: boolean;
}

/**
 * Component that conditionally renders children based on user role
 *
 * @param allowedRoles - Array of roles that can see the content
 * @param children - Content to show if user has permission
 * @param fallback - Optional content to show if user doesn't have permission
 * @param showError - Whether to show an error message when access is denied (default: false)
 */
export function RoleGate({
  allowedRoles,
  children,
  fallback = null,
  showError = false
}: RoleGateProps) {
  const { user } = useAuth();

  // If no user, don't show anything
  if (!user) return fallback || null;

  // Check if user's role is in allowed roles
  const hasAccess = allowedRoles.includes(user.role);

  // If user doesn't have access
  if (!hasAccess) {
    // Show error message if requested
    if (showError) {
      return (
        <div className="flex items-center justify-center p-8">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md">
            <div className="flex items-start space-x-3">
              <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
              <div>
                <h3 className="text-sm font-semibold text-red-800">Access Denied</h3>
                <p className="text-sm text-red-600 mt-1">
                  You don't have permission to view this content.
                  Please contact your administrator if you believe this is an error.
                </p>
                <p className="text-xs text-red-500 mt-2">
                  Required roles: {allowedRoles.join(', ')}
                </p>
              </div>
            </div>
          </div>
        </div>
      );
    }

    // Otherwise show fallback
    return <>{fallback}</>;
  }

  // User has access, show children
  return <>{children}</>;
}

/**
 * Higher-order component version of RoleGate
 */
export function withRoleGate<P extends object>(
  Component: React.ComponentType<P>,
  allowedRoles: string[],
  fallback?: ReactNode
) {
  return function RoleGatedComponent(props: P) {
    return (
      <RoleGate allowedRoles={allowedRoles} fallback={fallback}>
        <Component {...props} />
      </RoleGate>
    );
  };
}

export default RoleGate;
