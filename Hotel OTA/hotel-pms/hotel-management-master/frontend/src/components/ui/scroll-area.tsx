import React, { ReactNode } from 'react';
import { cn } from '../../utils/cn';

interface ScrollAreaProps {
  children: ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export function ScrollArea({ children, className, style }: ScrollAreaProps) {
  return (
    <div 
      className={cn('overflow-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100', className)}
      style={style}
    >
      {children}
    </div>
  );
}

export default ScrollArea;