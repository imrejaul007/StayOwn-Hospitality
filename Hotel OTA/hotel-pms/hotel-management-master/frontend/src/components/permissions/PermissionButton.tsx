import React, { ButtonHTMLAttributes } from 'react';
import { Button, buttonVariants } from '../ui/button';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '../ui/tooltip';
import { usePermissions } from '../../hooks/usePermissions';
import { cn } from '../../utils/cn';
import { VariantProps } from 'class-variance-authority';

interface PermissionButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  requiredRole?: string | string[];
  requiredPermission?: {
    resource: string;
    action: 'view' | 'edit' | 'delete' | 'approve';
  };
  children: React.ReactNode;
  loading?: boolean;
  tooltipMessage?: string;
}

/**
 * Button component that's disabled if user doesn't have required permission
 *
 * @param requiredRole - Role(s) required to enable the button
 * @param requiredPermission - Specific permission required (resource + action)
 * @param tooltipMessage - Custom tooltip message when disabled due to permissions
 * @param children - Button content
 * @param disabled - External disabled state (combined with permission check)
 * @param loading - Loading state
 */
export function PermissionButton({
  requiredRole,
  requiredPermission,
  children,
  disabled = false,
  loading = false,
  tooltipMessage = "You don't have permission for this action",
  variant,
  size,
  className,
  ...props
}: PermissionButtonProps) {
  const permissions = usePermissions();

  // Check if user has required permission
  let hasPermission = true;

  if (requiredRole) {
    hasPermission = permissions.hasRole(requiredRole);
  } else if (requiredPermission) {
    const { resource, action } = requiredPermission;
    switch (action) {
      case 'view':
        hasPermission = permissions.canView(resource);
        break;
      case 'edit':
        hasPermission = permissions.canEdit(resource);
        break;
      case 'delete':
        hasPermission = permissions.canDelete(resource);
        break;
      case 'approve':
        hasPermission = permissions.canApprove();
        break;
      default:
        hasPermission = false;
    }
  }

  const isDisabled = disabled || !hasPermission;

  // If disabled due to permissions, show tooltip
  if (!hasPermission && !disabled) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-block">
              <Button
                variant={variant}
                size={size}
                disabled={true}
                loading={loading}
                className={cn(className, 'cursor-not-allowed')}
                {...props}
              >
                {children}
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent side="top">
            <p className="text-xs">{tooltipMessage}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // Normal button if has permission
  return (
    <Button
      variant={variant}
      size={size}
      disabled={isDisabled}
      loading={loading}
      className={className}
      {...props}
    >
      {children}
    </Button>
  );
}

export default PermissionButton;
