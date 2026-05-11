import React from 'react';

interface ApprovalBadgeProps {
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  size?: 'sm' | 'md' | 'lg';
}

const ApprovalBadge: React.FC<ApprovalBadgeProps> = ({ status, size = 'md' }) => {
  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-3 py-1 text-sm',
    lg: 'px-4 py-1.5 text-base',
  };

  const statusConfig = {
    pending: {
      bgColor: 'bg-yellow-100',
      textColor: 'text-yellow-800',
      label: 'Pending Approval',
      icon: '⏳',
    },
    approved: {
      bgColor: 'bg-green-100',
      textColor: 'text-green-800',
      label: 'Approved',
      icon: '✓',
    },
    rejected: {
      bgColor: 'bg-red-100',
      textColor: 'text-red-800',
      label: 'Rejected',
      icon: '✗',
    },
    cancelled: {
      bgColor: 'bg-gray-100',
      textColor: 'text-gray-800',
      label: 'Cancelled',
      icon: '○',
    },
  };

  const config = statusConfig[status];

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-medium ${config.bgColor} ${config.textColor} ${sizeClasses[size]}`}
    >
      <span>{config.icon}</span>
      <span>{config.label}</span>
    </span>
  );
};

export default ApprovalBadge;
