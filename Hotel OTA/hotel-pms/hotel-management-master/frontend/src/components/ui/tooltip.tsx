import React, { ReactNode, useState } from 'react';
import { cn } from '../../utils/cn';

interface TooltipProps {
  children: ReactNode;
}

interface TooltipTriggerProps {
  asChild?: boolean;
  children: ReactNode;
}

interface TooltipContentProps {
  children: ReactNode;
  className?: string;
  side?: 'top' | 'bottom' | 'left' | 'right';
  align?: 'start' | 'center' | 'end';
}

const TooltipContext = React.createContext<{
  open: boolean;
  setOpen: (open: boolean) => void;
}>({
  open: false,
  setOpen: () => {},
});

export function TooltipProvider({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

export function Tooltip({ children }: TooltipProps) {
  const [open, setOpen] = useState(false);
  
  return (
    <TooltipContext.Provider value={{ open, setOpen }}>
      <div className="relative inline-block">
        {children}
      </div>
    </TooltipContext.Provider>
  );
}

export function TooltipTrigger({ children, asChild }: TooltipTriggerProps) {
  const { setOpen } = React.useContext(TooltipContext);
  
  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children, {
      onMouseEnter: () => setOpen(true),
      onMouseLeave: () => setOpen(false),
      onFocus: () => setOpen(true),
      onBlur: () => setOpen(false),
    });
  }
  
  return (
    <div
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      {children}
    </div>
  );
}

export function TooltipContent({ 
  children, 
  className, 
  side = 'top',
  align = 'center' 
}: TooltipContentProps) {
  const { open } = React.useContext(TooltipContext);
  
  if (!open) return null;
  
  const sideClasses = {
    top: '-top-2 -translate-y-full',
    bottom: '-bottom-2 translate-y-full',
    left: '-left-2 -translate-x-full top-1/2 -translate-y-1/2',
    right: '-right-2 translate-x-full top-1/2 -translate-y-1/2',
  };
  
  const alignClasses = {
    start: side === 'top' || side === 'bottom' ? 'left-0' : 'top-0',
    center: side === 'top' || side === 'bottom' ? 'left-1/2 -translate-x-1/2' : 'top-1/2 -translate-y-1/2',
    end: side === 'top' || side === 'bottom' ? 'right-0' : 'bottom-0',
  };
  
  return (
    <div
      className={cn(
        'absolute z-50 px-3 py-2 text-sm text-white bg-gray-900 rounded-md shadow-lg',
        'animate-in fade-in-0 zoom-in-95',
        sideClasses[side],
        alignClasses[align],
        className
      )}
    >
      {children}
    </div>
  );
}

export default Tooltip;