import React from 'react';

/**
 * Accessibility utilities for keyboard navigation and ARIA support.
 */

/**
 * Makes a non-button element keyboard accessible.
 * Usage: <div {...makeClickableAccessible(onClick)} />
 */
export const makeClickableAccessible = (onClick: () => void) => ({
  role: 'button' as const,
  tabIndex: 0,
  onClick,
  onKeyDown: (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick();
    }
  },
});

/**
 * Generate ARIA attributes for a form field.
 */
export const formFieldA11y = (id: string, label: string, error?: string) => ({
  id,
  'aria-label': label,
  'aria-invalid': error ? true : undefined,
  'aria-describedby': error ? `${id}-error` : undefined,
});

/**
 * Generate ARIA attributes for a loading state.
 */
export const loadingA11y = (isLoading: boolean) => ({
  'aria-busy': isLoading,
  'aria-live': 'polite' as const,
});
