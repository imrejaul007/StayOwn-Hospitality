import React from 'react';
import { motion } from 'framer-motion';

export interface MobileOptimizedProps {
  children: React.ReactNode;
  className?: string;
  enableSwipeGestures?: boolean;
}

const MobileOptimized: React.FC<MobileOptimizedProps> = ({
  children,
  className = '',
  enableSwipeGestures = false
}) => {
  const mobileAnimations = {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -20 },
    transition: { duration: 0.3, ease: 'easeInOut' }
  };

  const swipeGestures = enableSwipeGestures ? {
    drag: 'x' as const,
    dragConstraints: { left: -100, right: 100 },
    dragElastic: 0.1,
    onDragEnd: (event: unknown, info: Record<string, unknown>) => {
      // Handle swipe gestures
      const threshold = 50;
      if (Math.abs(info.offset.x) > threshold) {
        // Trigger swipe action
      }
    }
  } : {};

  return (
    <motion.div
      className={`
        ${className}
        /* Mobile First Responsive Design */
        w-full
        /* Touch-friendly spacing */
        px-4 sm:px-6 lg:px-8
        py-2 sm:py-4
        /* Improved touch targets */
        [&_button]:min-h-[44px]
        [&_input]:min-h-[44px]
        [&_select]:min-h-[44px]
        [&_textarea]:min-h-[44px]
        /* Better mobile typography */
        [&_h1]:text-2xl sm:[&_h1]:text-3xl
        [&_h2]:text-xl sm:[&_h2]:text-2xl
        [&_h3]:text-lg sm:[&_h3]:text-xl
        /* Improved mobile spacing */
        [&_.space-y-2>*+*]:mt-2 sm:[&_.space-y-2>*+*]:mt-3
        [&_.space-y-4>*+*]:mt-3 sm:[&_.space-y-4>*+*]:mt-4
        [&_.space-y-6>*+*]:mt-4 sm:[&_.space-y-6>*+*]:mt-6
        /* Mobile-friendly grids */
        [&_.grid-cols-1]:grid-cols-1
        [&_.md\\:grid-cols-2]:grid-cols-1 md:[&_.md\\:grid-cols-2]:grid-cols-2
        [&_.lg\\:grid-cols-3]:grid-cols-1 sm:[&_.lg\\:grid-cols-3]:grid-cols-2 lg:[&_.lg\\:grid-cols-3]:grid-cols-3
        [&_.lg\\:grid-cols-4]:grid-cols-1 sm:[&_.lg\\:grid-cols-4]:grid-cols-2 lg:[&_.lg\\:grid-cols-4]:grid-cols-4
        /* Mobile navigation improvements */
        [&_.flex-col]:flex-col
        [&_.sm\\:flex-row]:flex-col sm:[&_.sm\\:flex-row]:flex-row
        [&_.lg\\:flex-row]:flex-col lg:[&_.lg\\:flex-row]:flex-row
        /* Responsive text sizes */
        [&_.text-sm]:text-sm
        [&_.text-base]:text-sm sm:[&_.text-base]:text-base
        [&_.text-lg]:text-base sm:[&_.text-lg]:text-lg
        [&_.text-xl]:text-lg sm:[&_.text-xl]:text-xl
        /* Better mobile tables */
        [&_table]:block sm:[&_table]:table
        [&_thead]:hidden sm:[&_thead]:table-header-group
        [&_tbody]:block sm:[&_tbody]:table-row-group
        [&_tr]:block sm:[&_tr]:table-row
        [&_tr]:border-b sm:[&_tr]:border-b-0
        [&_tr]:mb-4 sm:[&_tr]:mb-0
        [&_td]:block sm:[&_td]:table-cell
        [&_td]:text-right sm:[&_td]:text-left
        [&_td]:border-none sm:[&_td]:border
        [&_td]:px-0 sm:[&_td]:px-6
        [&_td]:py-2 sm:[&_td]:py-4
        [&_td]:relative
        [&_td]:before:content-[attr(data-label)]
        [&_td]:before:absolute
        [&_td]:before:left-0
        [&_td]:before:w-1/2
        [&_td]:before:text-left
        [&_td]:before:font-medium
        [&_td]:before:text-gray-700
        sm:[&_td]:before:content-none
        /* Accessibility improvements */
        focus-visible:outline-2
        focus-visible:outline-offset-2
        focus-visible:outline-indigo-600
        /* Performance optimizations */
        will-change-transform
      `}
      {...mobileAnimations}
      {...swipeGestures}
    >
      {children}
    </motion.div>
  );
};

export default MobileOptimized;