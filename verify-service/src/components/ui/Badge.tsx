'use client'

import React from 'react'

type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info'
type BadgeSize = 'sm' | 'md' | 'lg'

interface BadgeProps {
  children: React.ReactNode
  variant?: BadgeVariant
  size?: BadgeSize
  className?: string
  icon?: React.ReactNode
}

const variantClasses: Record<BadgeVariant, string> = {
  default: 'bg-gray-100 text-gray-700 border-gray-200',
  success: 'bg-green-100 text-green-700 border-green-200',
  warning: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  danger: 'bg-red-100 text-red-700 border-red-200',
  info: 'bg-blue-100 text-blue-700 border-blue-200',
}

const sizeClasses: Record<BadgeSize, string> = {
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-2.5 py-1 text-sm',
  lg: 'px-3 py-1.5 text-base',
}

export function Badge({
  children,
  variant = 'default',
  size = 'md',
  className = '',
  icon,
}: BadgeProps) {
  return (
    <span
      className={`
        inline-flex items-center gap-1 rounded-full border font-medium
        ${variantClasses[variant]}
        ${sizeClasses[size]}
        ${className}
      `}
    >
      {icon}
      {children}
    </span>
  )
}

interface StatusBadgeProps {
  status: string
  size?: BadgeSize
  className?: string
}

const statusVariantMap: Record<string, BadgeVariant> = {
  ACTIVE: 'success',
  INACTIVE: 'default',
  DRAFT: 'warning',
  PAUSED: 'warning',
  COMPLETED: 'info',
  SUSPENDED: 'danger',
  FLAGGED: 'danger',
  INVALID: 'danger',
  ALLOW: 'success',
  FLAG: 'warning',
  BLOCK: 'danger',
  PENDING: 'warning',
  CLAIMED: 'success',
  EXPIRED: 'default',
  CANCELLED: 'default',
}

const statusLabelMap: Record<string, string> = {
  ACTIVE: 'Active',
  INACTIVE: 'Inactive',
  DRAFT: 'Draft',
  PAUSED: 'Paused',
  COMPLETED: 'Completed',
  SUSPENDED: 'Suspended',
  FLAGGED: 'Flagged',
  INVALID: 'Invalid',
  ALLOW: 'Allowed',
  FLAG: 'Flagged',
  BLOCK: 'Blocked',
  PENDING: 'Pending',
  CLAIMED: 'Claimed',
  EXPIRED: 'Expired',
  CANCELLED: 'Cancelled',
  CREATED: 'Created',
  SCANNED_FIRST: 'Scanned',
  MULTI_SCAN: 'Multi-scanned',
  BUDGET_EXHAUSTED: 'Budget Exhausted',
  STARTER: 'Starter',
  GROWTH: 'Growth',
  ENTERPRISE: 'Enterprise',
  PER_SCAN: 'Per Scan',
  FIRST_N: 'First N',
  GEO_TARGETED: 'Geo Targeted',
  TIME_BOOST: 'Time Boost',
}

export function StatusBadge({ status, size = 'md', className = '' }: StatusBadgeProps) {
  const variant = statusVariantMap[status] || 'default'
  const label = statusLabelMap[status] || status

  return (
    <Badge variant={variant} size={size} className={className}>
      {label}
    </Badge>
  )
}
