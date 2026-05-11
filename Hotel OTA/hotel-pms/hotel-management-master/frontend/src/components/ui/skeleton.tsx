import React from 'react';
import { cn } from "@/utils/cn"

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
  width?: string | number;
  height?: string | number;
  rounded?: boolean;
  lines?: number;
  variant?: 'text' | 'rectangular' | 'circular';
}

function Skeleton({
  className,
  width,
  height,
  rounded = false,
  lines = 1,
  variant = 'rectangular',
  ...props
}: SkeletonProps) {
  const getVariantClasses = () => {
    switch (variant) {
      case 'text':
        return 'h-4 rounded';
      case 'circular':
        return 'rounded-full';
      case 'rectangular':
      default:
        return rounded ? 'rounded-lg' : 'rounded-md';
    }
  };

  const style: React.CSSProperties = {};
  if (width) {
    style.width = typeof width === 'number' ? `${width}px` : width;
  }
  if (height) {
    style.height = typeof height === 'number' ? `${height}px` : height;
  }

  if (lines > 1) {
    return (
      <div className="space-y-2">
        {Array.from({ length: lines }).map((_, index) => (
          <div
            key={`_-${index}`}
            className={cn(
              "animate-pulse bg-muted",
              getVariantClasses(),
              index === lines - 1 && variant === 'text' ? 'w-2/3' : '',
              className
            )}
            style={style}
            {...props}
          />
        ))}
      </div>
    );
  }

  return (
    <div
      className={cn("animate-pulse bg-muted", getVariantClasses(), className)}
      style={style}
      {...props}
    />
  );
}

// Predefined skeleton components for common use cases
export const SkeletonCard: React.FC<{ className?: string }> = ({ className }) => (
  <div className={cn('space-y-3 p-4', className)}>
    <Skeleton height={200} rounded />
    <div className="space-y-2">
      <Skeleton height={20} />
      <Skeleton height={16} width="60%" />
    </div>
  </div>
);

export const SkeletonTable: React.FC<{
  rows?: number;
  columns?: number;
  className?: string;
}> = ({
  rows = 5,
  columns = 4,
  className
}) => (
  <div className={cn('space-y-2', className)}>
    {/* Header */}
    <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
      {Array.from({ length: columns }).map((_, index) => (
        <Skeleton key={`header-${index}`} height={20} />
      ))}
    </div>
    {/* Rows */}
    {Array.from({ length: rows }).map((_, rowIndex) => (
      <div
        key={`row-${rowIndex}`}
        className="grid gap-4"
        style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}
      >
        {Array.from({ length: columns }).map((_, colIndex) => (
          <Skeleton key={`cell-${rowIndex}-${colIndex}`} height={16} />
        ))}
      </div>
    ))}
  </div>
);

export const SkeletonProfile: React.FC<{ className?: string }> = ({ className }) => (
  <div className={cn('flex items-center space-x-4', className)}>
    <Skeleton variant="circular" width={60} height={60} />
    <div className="space-y-2 flex-1">
      <Skeleton height={20} width="40%" />
      <Skeleton height={16} width="60%" />
    </div>
  </div>
);

export { Skeleton }